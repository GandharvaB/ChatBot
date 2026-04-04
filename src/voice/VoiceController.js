import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';
import { 
  WAKE_WORDS, 
  CONFIDENCE_THRESHOLD, 
  SILENCE_TIMEOUT_MS, 
  NO_INPUT_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  belliStateMachine
} from './BelliStateMachine';

class VoiceController {
  constructor() {
    this.passiveRecognition = null;
    this.activeRecognition = null;
    this.bargeInRecognition = null;
    this.silenceTimer = null;
    this.noInputTimer = null;
    this.isBargeInActive = false;
    this.audioContext = null;
    this.analyser = null;
    this.volumeInterval = null;
  }

  // --- PHASE 1: PASSIVE LISTENING ---
  initPassive() {
    if (this.passiveRecognition) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech Recognition not supported.');
      return;
    }

    this.passiveRecognition = new SpeechRecognition();
    this.passiveRecognition.continuous = true;
    this.passiveRecognition.interimResults = true; // Use interim for faster response
    this.passiveRecognition.lang = 'en-US';
    this.passiveRecognition.maxAlternatives = 3;

    this.passiveRecognition.onresult = (event) => {
      // Look through all results in the current session
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        const isWakeWord = WAKE_WORDS.some(word => transcript.includes(word));
        
        console.log(`[VoiceController] Passive: "${transcript}" (WakeWord: ${isWakeWord})`);

        if (isWakeWord) {
          this.triggerWake();
          break;
        }
      }
    };

    this.passiveRecognition.onend = () => {
      const currentState = useAvatarStore.getState().avatarState;
      if (currentState === AVATAR_STATES.PASSIVE || currentState === AVATAR_STATES.IDLE) {
        console.log('[VoiceController] Passive Recognition ended, restarting phase 1');
        this.startPassive();
      }
    };

    this.passiveRecognition.onerror = (event) => {
      console.error('[VoiceController] Passive error:', event.error);
      if (event.error === 'not-allowed') {
        // Wait for first click to try again
        window.onclick = () => {
          this.startPassive();
          window.onclick = null;
        };
      }
    };

    this.startPassive();
  }

  startPassive() {
    try {
      this.passiveRecognition.start();
      belliStateMachine.transitionTo(AVATAR_STATES.PASSIVE);
    } catch (e) {
      // Recognition usually already started or blocked
      if (e.name === 'InvalidStateError') {
         // It's already running, ignore
      } else {
         console.warn('Passive start failed:', e.message);
      }
    }
  }

  stopPassive() {
    if (this.passiveRecognition) this.passiveRecognition.stop();
  }

  // --- PHASE 2: WAKE WORD DETECTED / MANUAL TRIGGER ---
  triggerWake() {
    this.stopPassive();
    this.playChime('activation');
    belliStateMachine.transitionTo(AVATAR_STATES.LISTENING);
    this.initActive();
  }

  // Manual entry point for when the user clicks the record button
  startManualActive() {
    console.log('[VoiceController] Manual trigger received. Jumping to Phase 3.');
    this.triggerWake();
  }

  // --- PHASE 3: ACTIVE LISTENING ---
  initActive() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.activeRecognition = new SpeechRecognition();
    this.activeRecognition.continuous = false;
    this.activeRecognition.interimResults = true;
    this.activeRecognition.lang = 'en-US';
    this.activeRecognition.maxAlternatives = 5;

    this.activeRecognition.onresult = (event) => {
      const { setCurrentTranscript } = useAvatarStore.getState();
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript;
      const confidence = lastResult[0].confidence;
      const isFinal = lastResult.isFinal;

      // Real-time transcript feedback
      setCurrentTranscript(transcript);
      
      // Reset silence timeout on interim result
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      this.silenceTimer = setTimeout(() => {
        console.log('[VoiceController] Active: Silence fallback timeout');
        this.finishActive(transcript, confidence);
      }, SILENCE_TIMEOUT_MS);

      if (isFinal) {
        console.log('[VoiceController] Active: Browser determined final');
        this.finishActive(transcript, confidence);
      }
    };

    this.activeRecognition.onstart = () => {
       // Stop previous timeout
       if (this.noInputTimer) clearTimeout(this.noInputTimer);
       this.noInputTimer = setTimeout(() => {
          this.handleNoSpeechTimeout();
       }, NO_INPUT_TIMEOUT_MS);
    };

    this.activeRecognition.onend = () => {
       console.log('[VoiceController] Active recognition ended');
    };

    this.activeRecognition.onerror = (event) => {
      console.warn('[VoiceController] Active error:', event.error);
      if (event.error === 'no-speech') {
        // Handled by noInputTimer
        return;
      }
      belliStateMachine.handleError(event.error, event);
    };

    try {
      this.activeRecognition.start();
      useAvatarStore.getState().setMicActive(true);
      this.startVolumeMonitoring();
    } catch (e) {
       console.warn('Active start failed:', e);
    }
  }

  async startVolumeMonitoring() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      if (this.volumeInterval) clearInterval(this.volumeInterval);
      this.volumeInterval = setInterval(() => {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalizedVolume = Math.min(1, average / 128);
        useAvatarStore.getState().setMicVolume(normalizedVolume);
      }, 50);
    } catch (e) {
      console.warn('Volume monitoring failed:', e);
    }
  }

  finishActive(transcript, confidence) {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.noInputTimer) clearTimeout(this.noInputTimer);
    if (this.volumeInterval) clearInterval(this.volumeInterval);
    
    useAvatarStore.getState().setMicActive(false);
    useAvatarStore.getState().setMicVolume(0);

    if (this.activeRecognition) {
      try { this.activeRecognition.stop(); } catch(e) {}
      this.activeRecognition = null;
    }

    if (confidence < CONFIDENCE_THRESHOLD) {
      console.log(`[VoiceController] Confidence low (${confidence}), retrying...`);
      // Belli says she didn't catch that
      window.dispatchEvent(new CustomEvent('belli-retry-trigger'));
      return;
    }

    console.log(`[VoiceController] Final input caught: "${transcript}"`);
    belliStateMachine.transitionTo(AVATAR_STATES.THINKING);
    window.dispatchEvent(new CustomEvent('voice-input-ready', { detail: transcript }));
  }

  // Force stop active listening (manual release)
  stopActive() {
    if (this.activeRecognition) {
       console.log('[VoiceController] Manual stop requested');
       // We don't call finishActive here because SpeechRecognition.stop() 
       // will trigger its own final result if available.
       try { this.activeRecognition.stop(); } catch(e) {}
    }
  }

  handleNoSpeechTimeout() {
    console.log('[VoiceController] No speech timeout (8s)');
    if (this.activeRecognition) this.activeRecognition.stop();
    window.dispatchEvent(new CustomEvent('belli-no-input-trigger'));
  }

  // --- BARGE-IN SUPPORT ---
  startBargeIn() {
    if (this.isBargeInActive) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.bargeInRecognition = new SpeechRecognition();
    this.bargeInRecognition.continuous = true;
    this.bargeInRecognition.interimResults = false;
    this.bargeInRecognition.lang = 'en-US';

    this.bargeInRecognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log(`[VoiceController] Barge-in detected: "${transcript}"`);
      
      // Stop anything Belli is doing!
      window.dispatchEvent(new CustomEvent('belli-barge-in'));
      this.stopBargeIn();
      
      // Jump immediately to active listen with the barge-in speech
      belliStateMachine.transitionTo(AVATAR_STATES.LISTENING);
      this.initActive();
    };

    this.bargeInRecognition.onerror = (e) => console.log('[VoiceController] Barge-in error:', e.error);
    this.bargeInRecognition.onend = () => {
      if (this.isBargeInActive) this.bargeInRecognition.start();
    };

    this.isBargeInActive = true;
    try {
      this.bargeInRecognition.start();
    } catch (e) {
      console.warn('Barge-in start failed:', e);
    }
  }

  stopBargeIn() {
    this.isBargeInActive = false;
    if (this.bargeInRecognition) {
      this.bargeInRecognition.stop();
      this.bargeInRecognition = null;
    }
  }

  // Chimes using Web Audio API
  playChime(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'activation') {
        // Siri ping: C5 -> C6
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      } else {
        // Deactivation: E5 -> C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      }

      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Chime failed:', e);
    }
  }
}

export const voiceController = new VoiceController();
export default voiceController;
