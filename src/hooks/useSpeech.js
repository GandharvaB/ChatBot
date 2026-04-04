import { useCallback, useRef } from 'react';
import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';
import { speechToText, detectLanguageFromCode } from '../services/sarvamai';
import { startMicCapture, stopMicCapture, getRMSVolume } from '../services/audioCapture';
import { responseController } from '../voice/ResponseController';
import { voiceController } from '../voice/VoiceController';

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

  // Start active listening (Phase 3)
  const startRecording = useCallback(async () => {
    try {
      console.log('[useSpeech] Manual trigger: starting active listening');
      // Stop anything current (interruption)
      responseController.stop();
      
      // Delegate to the unified voice controller
      voiceController.startManualActive();
      
    } catch (error) {
      console.error('[useSpeech] startRecording error:', error);
      useAvatarStore.getState().setError(error.message);
    }
  }, []);

  // Process final transcript from any source (Web Speech API or recorded blob)
  const processFinalTranscript = useCallback(async (transcript, languageCode = 'en-US') => {
    try {
      if (!transcript || transcript.trim() === '') {
        useAvatarStore.getState().setAvatarState(AVATAR_STATES.LISTENING);
        return;
      }

      // Filter repetitive hallucinations (only if extremely long/noisy)
      const words = transcript.trim().split(/\s+/);
      const uniqueWords = new Set(words);
      if (words.length > 15 && uniqueWords.size <= 2) {
        console.warn("Detected extreme repetitive transcript, ignoring:", transcript);
        useAvatarStore.getState().setAvatarState(AVATAR_STATES.LISTENING);
        return;
      }

      useAvatarStore.getState().setCurrentTranscript(transcript);
      useAvatarStore.getState().setDetectedLanguage(languageCode);
      useAvatarStore.getState().addMessage('user', transcript, languageCode);

      // Build the conversation context (user message already added above)
      const context = useAvatarStore.getState().getConversationContext();
      console.log('Sending context to Sarvam AI:', JSON.stringify(context, null, 2));

      // ResponseController handles THINKING state transition, streaming, and TTS
      await responseController.startResponse(context);
      
    } catch (error) {
      console.error('Processing error:', error);
      useAvatarStore.getState().setError(error.message);
      useAvatarStore.getState().setAudioPlaying(false);
      useAvatarStore.getState().setAvatarState(AVATAR_STATES.LISTENING);
    }
  }, []);

  // Manual stop (not usually needed in Siri model, but available)
  const stopRecording = useCallback(async () => {
    // In the new model, we rely on silence detection (isFinal) in VoiceController.
    // However, if the user lets go of the button, we can force-finalize.
    console.log('[useSpeech] Manual stop: force finalizing');
    voiceController.stopActive();
  }, []);

  // Stop current playback
  const stopPlayback = useCallback(() => {
    responseController.stop();
    playbackAnalyserRef.current = null;
    useAvatarStore.getState().setAudioPlaying(false);
    useAvatarStore.getState().setAvatarState(AVATAR_STATES.LISTENING);
  }, []);

  // Get current playback analyser for lip sync
  const getPlaybackAnalyser = useCallback(() => {
    return playbackAnalyserRef.current;
  }, []);

  return {
    startRecording,
    stopRecording,
    stopPlayback,
    processFinalTranscript,
    getPlaybackAnalyser,
  };
}
