import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';
import { textToSpeech } from '../services/sarvamai';
import { 
  FLUSH_WORD_COUNT, 
  FLUSH_PUNCTUATION, 
  belliStateMachine
} from './BelliStateMachine';

class SpeakController {
  constructor() {
    this.tokenBuffer = "";
    this.ttsQueue = [];
    this.ttsPlaying = false;
    this.isBargeInCaught = false;
    this.audioContext = null;
    this.currentSource = null;
  }

  // --- PHASE 5: SPEAKING (Stream tokens to TTS) ---
  onToken(token) {
    if (this.isBargeInCaught) return;

    this.tokenBuffer += token;
    
    // Check for flush triggers (punctuation or word count)
    const words = this.tokenBuffer.trim().split(/\s+/);
    const hasPunct = FLUSH_PUNCTUATION.test(token);

    if (hasPunct || words.length >= FLUSH_WORD_COUNT) {
      const chunk = this.tokenBuffer.trim();
      if (chunk) {
        this.enqueueSpeak(chunk);
        this.tokenBuffer = "";
      }
    }
  }

  onStreamEnd() {
    if (this.tokenBuffer.trim()) {
      this.enqueueSpeak(this.tokenBuffer.trim());
      this.tokenBuffer = "";
    }
  }

  enqueueSpeak(text) {
    console.log(`[SpeakController] Enqueuing: "${text}"`);
    this.ttsQueue.push(text);
    if (!this.ttsPlaying) this.processNextChunk();
  }

  async processNextChunk() {
    if (this.isBargeInCaught || this.ttsQueue.length === 0) {
      this.ttsPlaying = false;
      if (!this.isBargeInCaught) {
        this.onBelliFinishedSpeaking();
      }
      return;
    }

    this.ttsPlaying = true;
    const text = this.ttsQueue.shift();
    
    try {
      console.log(`[SpeakController] Fetching Sarvam TTS (Meera) for: "${text}"`);
      const audioBuffer = await textToSpeech(text, 'en-IN', 'meera');
      
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const decodedData = await this.audioContext.decodeAudioData(audioBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = decodedData;
      source.connect(this.audioContext.destination);
      
      this.currentSource = source;

      source.onended = () => {
        console.log(`[SpeakController] Finished: "${text}"`);
        useAvatarStore.getState().setMouthOpen(false);
        this.currentSource = null;
        this.processNextChunk();
      };

      // Trigger animation and play
      useAvatarStore.getState().setMouthOpen(true);
      useAvatarStore.getState().setAudioPlaying(true);
      source.start(0);

    } catch (e) {
      console.error('[SpeakController] Sarvam TTS error:', e);
      useAvatarStore.getState().setMouthOpen(false);
      // Fallback skip or try next chunk
      this.processNextChunk();
    }
  }

  onBelliFinishedSpeaking() {
    console.log('[SpeakController] Finished all chunks. Transitioning back to Phase 1');
    useAvatarStore.getState().setAudioPlaying(false);
    
    // Siri closing chime ping
    window.dispatchEvent(new CustomEvent('belli-finished-speaking'));
    
    // Final state transition back to passive listening
    belliStateMachine.transitionTo(AVATAR_STATES.PASSIVE);
  }

  // --- BARGE-IN SUPPORT ---
  stop() {
    console.log('[SpeakController] Barge-in/Stopping TTS immediately');
    this.isBargeInCaught = true;
    
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch(e) {}
      this.currentSource = null;
    }

    this.ttsQueue = [];
    this.tokenBuffer = "";
    this.ttsPlaying = false;
    
    useAvatarStore.getState().setMouthOpen(false);
    useAvatarStore.getState().setAudioPlaying(false);
  }

  reset() {
    this.isBargeInCaught = false;
    this.ttsPlaying = false;
    this.ttsQueue = [];
    this.tokenBuffer = "";
  }
}

export const speakController = new SpeakController();
export default speakController;
