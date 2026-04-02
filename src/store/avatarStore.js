import { create } from 'zustand';

// Avatar states
export const AVATAR_STATES = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  SPEAKING: 'SPEAKING',
  EMOTING: 'EMOTING',
};

// Valid state transitions
const VALID_TRANSITIONS = {
  [AVATAR_STATES.IDLE]: [AVATAR_STATES.LISTENING, AVATAR_STATES.SPEAKING, AVATAR_STATES.EMOTING],
  [AVATAR_STATES.LISTENING]: [AVATAR_STATES.THINKING, AVATAR_STATES.IDLE],
  [AVATAR_STATES.THINKING]: [AVATAR_STATES.SPEAKING, AVATAR_STATES.IDLE],
  [AVATAR_STATES.SPEAKING]: [AVATAR_STATES.IDLE, AVATAR_STATES.LISTENING, AVATAR_STATES.EMOTING],
  [AVATAR_STATES.EMOTING]: [AVATAR_STATES.IDLE, AVATAR_STATES.LISTENING],
};

const useAvatarStore = create((set, get) => ({
  // State machine
  avatarState: AVATAR_STATES.IDLE,
  previousState: null,

  // Conversation
  messages: [],
  currentTranscript: '',
  currentResponse: '',
  detectedLanguage: 'en-IN',

  // Audio
  isMicActive: false,
  isAudioPlaying: false,
  audioAnalyserData: new Float32Array(128),
  micVolume: 0,

  // UI
  isLoading: true,
  loadingProgress: 0,
  error: null,
  showSettings: false,

  // Settings
  settings: {
    language: 'en-IN',
    voiceSpeed: 1.0,
    speaker: 'shubh',
    pushToTalk: true,
  },

  // Gesture
  activeGesture: null,
  currentEmotion: 'neutral', // neutral, happy, sad

  // State transition with validation
  setAvatarState: (newState) => {
    const currentState = get().avatarState;
    if (currentState === newState) return;

    const validNext = VALID_TRANSITIONS[currentState];
    if (!validNext || !validNext.includes(newState)) {
      console.warn(`Invalid state transition: ${currentState} → ${newState}`);
      // Force transition anyway for robustness
    }

    set({
      previousState: currentState,
      avatarState: newState,
    });
  },

  // Messages
  addMessage: (role, content, language) => {
    set((state) => {
      const newMessages = [
        ...state.messages,
        {
          id: Date.now(),
          role,
          content,
          language: language || state.detectedLanguage,
          timestamp: new Date().toISOString(),
        },
      ];
      // Keep last 10 turns (20 messages)
      if (newMessages.length > 20) {
        return { messages: newMessages.slice(-20) };
      }
      return { messages: newMessages };
    });
  },

  clearMessages: () => set({ messages: [] }),

  setCurrentTranscript: (transcript) => set({ currentTranscript: transcript }),
  setCurrentResponse: (response) => set({ currentResponse: response }),
  setDetectedLanguage: (lang) => set({ detectedLanguage: lang }),

  // Audio
  setMicActive: (active) => set({ isMicActive: active }),
  setAudioPlaying: (playing) => set({ isAudioPlaying: playing }),
  setAudioAnalyserData: (data) => set({ audioAnalyserData: data }),
  setMicVolume: (vol) => set({ micVolume: vol }),

  // UI
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingProgress: (progress) => set({ loadingProgress: progress }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

  // Settings
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  // Gesture
  setActiveGesture: (gesture) => set({ activeGesture: gesture }),
  setCurrentEmotion: (emotion) => set({ currentEmotion: emotion }),

  // Get conversation context for API
  getConversationContext: () => {
    const messages = get().messages;
    return messages.slice(-10).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));
  },
}));

export default useAvatarStore;
