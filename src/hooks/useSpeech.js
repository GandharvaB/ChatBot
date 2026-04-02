import { useCallback, useRef } from 'react';
import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';
import { speechToText, chatCompletion, textToSpeech, detectLanguageFromCode } from '../services/sarvamai';
import { startMicCapture, stopMicCapture, playAudioBuffer, getRMSVolume } from '../services/audioCapture';

export function useSpeech() {
  const analyserRef = useRef(null);
  const audioSourceRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const playbackAnalyserRef = useRef(null);

  const {
    setAvatarState,
    addMessage,
    setCurrentTranscript,
    setCurrentResponse,
    setDetectedLanguage,
    setMicActive,
    setAudioPlaying,
    setMicVolume,
    setError,
    getConversationContext,
    settings,
    avatarState,
  } = useAvatarStore.getState();

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const store = useAvatarStore.getState();
      if (store.avatarState === AVATAR_STATES.SPEAKING) {
        // Stop current playback first
        stopPlayback();
      }

      const { analyserNode } = await startMicCapture();
      analyserRef.current = analyserNode;

      useAvatarStore.getState().setMicActive(true);
      useAvatarStore.getState().setAvatarState(AVATAR_STATES.LISTENING);

      // Start VAD monitoring
      vadIntervalRef.current = setInterval(() => {
        if (analyserRef.current) {
          const volume = getRMSVolume(analyserRef.current);
          useAvatarStore.getState().setMicVolume(volume);
        }
      }, 50);
    } catch (error) {
      useAvatarStore.getState().setError(error.message);
      useAvatarStore.getState().setAvatarState(AVATAR_STATES.IDLE);
    }
  }, []);

  // Stop recording and process
  const stopRecording = useCallback(async () => {
    try {
      // Stop VAD monitoring
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }

      useAvatarStore.getState().setMicActive(false);
      useAvatarStore.getState().setMicVolume(0);

      const audioBlob = await stopMicCapture();
      // Ignore empty or extremely short micro-clicks that cause format corruption errors
      if (!audioBlob || audioBlob.size < 800) {
        console.warn('Audio clip too small, ignoring.');
        useAvatarStore.getState().setAvatarState(AVATAR_STATES.IDLE);
        return;
      }

      // Transition to THINKING while processing
      useAvatarStore.getState().setAvatarState(AVATAR_STATES.THINKING);

      // Step 1: Speech-to-Text
      const { transcript, languageCode } = await speechToText(audioBlob);
      if (!transcript || transcript.trim() === '') {
        useAvatarStore.getState().setAvatarState(AVATAR_STATES.IDLE);
        return;
      }

      // Filter Whisper STT hallucinations (e.g. static translated as "હા હા હા" or repeated identical bits)
      const words = transcript.trim().split(/\s+/);
      const uniqueWords = new Set(words);
      if (words.length > 5 && uniqueWords.size <= 2) {
        console.warn("Detected repetitive STT hallucination from silence, ignoring sequence:", transcript);
        useAvatarStore.getState().setAvatarState(AVATAR_STATES.IDLE);
        return;
      }

      useAvatarStore.getState().setCurrentTranscript(transcript);
      useAvatarStore.getState().setDetectedLanguage(languageCode);
      useAvatarStore.getState().addMessage('user', transcript, languageCode);

      // Step 2: Chat completion
      const context = useAvatarStore.getState().getConversationContext();
      const { content: aiResponse } = await chatCompletion(context);
      useAvatarStore.getState().setCurrentResponse(aiResponse);
      useAvatarStore.getState().addMessage('assistant', aiResponse, languageCode);

      // Step 3: Text-to-Speech
      const currentSettings = useAvatarStore.getState().settings;
      const langInfo = detectLanguageFromCode(languageCode);
      
      // Clean <think> tags completely so the avatar doesn't speak its thought process
      let cleanText = aiResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (!cleanText) cleanText = "I see.";
      // Sarvam TTS limit is 500 characters
      if (cleanText.length > 500) {
        cleanText = cleanText.substring(0, 497) + '...';
      }

      const audioBuffer = await textToSpeech(cleanText, langInfo.code, currentSettings.speaker);

      // Step 4: Play audio with lip sync
      useAvatarStore.getState().setAvatarState(AVATAR_STATES.SPEAKING);
      useAvatarStore.getState().setAudioPlaying(true);

      const playback = await playAudioBuffer(audioBuffer);
      audioSourceRef.current = playback.source;
      playbackAnalyserRef.current = playback.analyser;

      // Wait for audio to finish
      playback.source.onended = () => {
        useAvatarStore.getState().setAudioPlaying(false);
        useAvatarStore.getState().setAvatarState(AVATAR_STATES.IDLE);
        audioSourceRef.current = null;
        playbackAnalyserRef.current = null;
      };
    } catch (error) {
      console.error('Speech pipeline error:', error);
      useAvatarStore.getState().setError(error.message);
      useAvatarStore.getState().setAudioPlaying(false);
      useAvatarStore.getState().setAvatarState(AVATAR_STATES.IDLE);
    }
  }, []);

  // Stop current playback
  const stopPlayback = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      audioSourceRef.current = null;
    }
    playbackAnalyserRef.current = null;
    useAvatarStore.getState().setAudioPlaying(false);
    useAvatarStore.getState().setAvatarState(AVATAR_STATES.IDLE);
  }, []);

  // Get current playback analyser for lip sync
  const getPlaybackAnalyser = useCallback(() => {
    return playbackAnalyserRef.current;
  }, []);

  return {
    startRecording,
    stopRecording,
    stopPlayback,
    getPlaybackAnalyser,
  };
}
