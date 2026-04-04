import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';
import { chatCompletionStream } from '../services/sarvamai';
import { belliStateMachine } from './BelliStateMachine';
import { speakController } from './SpeakController';

class ResponseController {
  constructor() {
    this.currentRequestController = null;
    this.isBargeInCaught = false;
    this.fullResponse = "";
  }

  /**
   * PHASE 4: THINKING (Stream AI response)
   * 
   * @param {string|Array} input - Either a plain transcript string OR a pre-built messages array
   * @param {Object} options - Optional config
   * @param {boolean} options.addUserMessage - Whether to add the user message to store (default: true for string input)
   */
  async startResponse(input, options = {}) {
    this.reset();
    // CRITICAL: Reset the speak controller's barge-in flag so TTS works
    speakController.reset();

    const { setCurrentResponse, addMessage } = useAvatarStore.getState();

    // Normalize input: accept either a string transcript or a messages array
    let messages;
    let userTranscript = '';

    if (typeof input === 'string') {
      // Called from VoiceManager event (voice-input-ready) with a plain string
      userTranscript = input;
      const context = useAvatarStore.getState().getConversationContext();
      addMessage('user', userTranscript);
      messages = [...context, { role: 'user', content: userTranscript }];
    } else if (Array.isArray(input)) {
      // Called from useSpeech/ControlBar with a pre-built context array
      // The user message is already added to the store by the caller
      messages = input;
      userTranscript = input[input.length - 1]?.content || '';
    } else {
      console.error('[ResponseController] Invalid input type:', typeof input);
      return;
    }

    // Create AbortController for barge-in cancellation
    this.currentRequestController = new AbortController();

    // Transition to THINKING state
    belliStateMachine.transitionTo(AVATAR_STATES.THINKING);

    try {
      console.log('[ResponseController] Starting AI Stream for:', userTranscript);
      const stream = chatCompletionStream(messages, null, this.currentRequestController.signal);

      let firstTokenArrived = false;
      let fullResponse = '';

      // Reliability Guard: If no token arrives in 7s, trigger fallback
      const fallbackTimeout = setTimeout(() => {
        if (!firstTokenArrived && !this.isBargeInCaught) {
          console.error('[ResponseController] Stream timeout, triggering fallback');
          this.handleBargeIn(); // Terminate the stalled stream
          speakController.reset();
          belliStateMachine.transitionTo(AVATAR_STATES.SPEAKING);
          speakController.enqueueSpeak("Sorry, I didn't quite get that. Could you repeat?");
        }
      }, 7000);

      try {
        for await (const token of stream) {
          if (this.isBargeInCaught) break;

          if (!firstTokenArrived) {
            clearTimeout(fallbackTimeout);
            console.log('[ResponseController] First token received! Transitioning to Phase 5');
            belliStateMachine.transitionTo(AVATAR_STATES.SPEAKING);
            firstTokenArrived = true;
          }

          fullResponse += token;
          setCurrentResponse(fullResponse);

          // Send token to SpeakController (Phase 5)
          speakController.onToken(token);
        }
      } finally {
        clearTimeout(fallbackTimeout);
      }

      if (!this.isBargeInCaught) {
        console.log('[ResponseController] Stream complete.');
        speakController.onStreamEnd();
        this.fullResponse = fullResponse;
        addMessage('assistant', fullResponse);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[ResponseController] AI stream aborted by barge-in');
      } else {
        console.error('[ResponseController] error:', error);
        // Speak a fallback error message
        speakController.reset();
        belliStateMachine.transitionTo(AVATAR_STATES.SPEAKING);
        speakController.enqueueSpeak("Sorry, I had a hiccup. Please try again!");
      }
    } finally {
      this.currentRequestController = null;
    }
  }

  handleBargeIn() {
    console.log('[ResponseController] Barge-in detected, killing stream');
    this.isBargeInCaught = true;
    if (this.currentRequestController) {
      this.currentRequestController.abort();
    }
  }

  reset() {
    this.isBargeInCaught = false;
    this.fullResponse = "";
    if (this.currentRequestController) {
      this.currentRequestController.abort();
      this.currentRequestController = null;
    }
    useAvatarStore.getState().setCurrentResponse('');
  }

  stop() {
    this.handleBargeIn();
    speakController.stop();
    this.reset();
  }
}

export const responseController = new ResponseController();
export default responseController;
