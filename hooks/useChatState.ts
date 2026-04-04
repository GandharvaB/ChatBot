import { create } from 'zustand';

export type AppState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';

interface ChatState {
  appState: AppState;
  setAppState: (state: AppState) => void;
  currentTranscript: string;
  setCurrentTranscript: (text: string) => void;
  currentAction: string;
  setCurrentAction: (action: string) => void;
  errorMessage: string;
  setErrorMessage: (msg: string) => void;
  isMicMuted: boolean;
  toggleMic: () => void;
}

export const useChatState = create<ChatState>((set) => ({
  appState: 'IDLE',
  setAppState: (state) => set({ appState: state }),
  currentTranscript: '',
  setCurrentTranscript: (text) => set({ currentTranscript: text }),
  currentAction: '',
  setCurrentAction: (action) => set({ currentAction: action }),
  errorMessage: '',
  setErrorMessage: (msg) => set({ errorMessage: msg, appState: msg ? 'ERROR' : 'IDLE' }),
  isMicMuted: false,
  toggleMic: () => set((state) => ({ isMicMuted: !state.isMicMuted })),
}));
