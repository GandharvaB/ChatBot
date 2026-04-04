import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';

// Siri-style Voice Interaction Loop Constants
export const WAKE_WORDS = ["hi belli", "hello belli", "hey belli", "ok belli"];
export const CONFIDENCE_THRESHOLD = 0.55;
export const SILENCE_TIMEOUT_MS = 1200;
export const NO_INPUT_TIMEOUT_MS = 8000;
export const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const FLUSH_WORD_COUNT = 9;
export const FLUSH_PUNCTUATION = /[.?!,;:]/;
export const TTS_RATE = 1.05;
export const RETRY_DELAYS_MS = {
  NOT_ALLOWED: -1, // Don't retry
  NETWORK: 2000,
  AUDIO_CAPTURE: 2000,
  DEFAULT: 500
};

class BelliStateMachine {
  constructor() {
    this.sessionTimer = null;
    this.isInitialized = false;
  }

  // Phase Transitions
  transitionTo(newState, data = {}) {
    const { setAvatarState, setError } = useAvatarStore.getState();
    console.log(`[BelliStateMachine] Transitioning: ${newState}`);

    switch (newState) {
      case AVATAR_STATES.PASSIVE:
        this.resetSessionTimer();
        setAvatarState(AVATAR_STATES.PASSIVE);
        // Reset transcript UI
        useAvatarStore.getState().setCurrentTranscript('');
        break;

      case AVATAR_STATES.LISTENING:
        this.resetSessionTimer();
        setAvatarState(AVATAR_STATES.LISTENING);
        break;

      case AVATAR_STATES.THINKING:
        setAvatarState(AVATAR_STATES.THINKING);
        break;

      case AVATAR_STATES.SPEAKING:
        setAvatarState(AVATAR_STATES.SPEAKING);
        break;

      case AVATAR_STATES.ERROR:
        setAvatarState(AVATAR_STATES.ERROR);
        if (data.message) setError(data.message);
        // Auto-recover after delay
        setTimeout(() => this.transitionTo(AVATAR_STATES.PASSIVE), 3000);
        break;

      case AVATAR_STATES.SLEEPING:
        setAvatarState(AVATAR_STATES.SLEEPING);
        break;

      default:
        console.warn(`Unknown state: ${newState}`);
    }
  }

  resetSessionTimer() {
    if (this.sessionTimer) clearTimeout(this.sessionTimer);
    this.sessionTimer = setTimeout(() => {
      console.log('Session timed out (10m). Going to sleep.');
      this.handleSessionTimeout();
    }, SESSION_TIMEOUT_MS);
  }

  handleSessionTimeout() {
    // Phase 6: Session Timeout logic
    const { setAvatarState } = useAvatarStore.getState();
    // Belli says farewell before sleeping - this will be triggered by VoiceController
    window.dispatchEvent(new CustomEvent('belli-sleep-trigger'));
  }

  // Global Error Handler
  handleError(type, error) {
    console.error(`[BelliStateMachine] Error ${type}:`, error);
    
    if (type === 'not-allowed') {
      this.transitionTo(AVATAR_STATES.ERROR, { message: "Microphone permission denied. Please allow mic access to talk to Belli." });
      return;
    }

    const delay = RETRY_DELAYS_MS[type.toUpperCase()] || RETRY_DELAYS_MS.DEFAULT;
    
    if (delay > 0) {
      setTimeout(() => {
        this.transitionTo(AVATAR_STATES.PASSIVE);
      }, delay);
    }
  }
}

export const belliStateMachine = new BelliStateMachine();
export default belliStateMachine;
