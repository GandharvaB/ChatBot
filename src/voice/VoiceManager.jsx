import React, { useEffect } from 'react';
import useAvatarStore, { AVATAR_STATES } from '../store/avatarStore';
import { voiceController } from './VoiceController';
import { responseController } from './ResponseController';
import { speakController } from './SpeakController';
import { belliStateMachine } from './BelliStateMachine';

/**
 * VoiceManager — orchestrates the entire Belli voice pipeline (Phases 1-6)
 */
export function VoiceManager() {

  useEffect(() => {
    // 1. Initial Load: Auto-start Passive Listening (Phase 1)
    console.log('[VoiceManager] Initializing Siri-style Voice Pipeline...');
    voiceController.initPassive();

    // 2. Event Listeners for State Transitions

    // Phase 3 Complete -> Start Phase 4 (Thinking/Streaming)
    const handleVoiceInputReady = (event) => {
      const transcript = event.detail;
      responseController.startResponse(transcript);
    };

    // Barge-in (Interruption)
    const handleBargeIn = () => {
      console.log('[VoiceManager] Interruption Catch: Stopping current activity...');
      responseController.handleBargeIn();
      speakController.stop();
    };

    // Cleanup and Restart Passive listening (Phase 6)
    const handleBelliFinished = () => {
      voiceController.playChime('deactivation');
      voiceController.initPassive();
    };

    // Error/No-Input/Retry Messages
    const handleRetry = () => {
       speakController.reset(); // Clear barge-in flag
       belliStateMachine.transitionTo(AVATAR_STATES.SPEAKING);
       speakController.enqueueSpeak("Sorry, I didn't catch that. Could you try again?");
    };

    const handleNoInput = () => {
       speakController.reset();
       belliStateMachine.transitionTo(AVATAR_STATES.SPEAKING);
       speakController.enqueueSpeak("I'm still here — just say 'Hello Belli' to start.");
    };

    const handleSleep = () => {
       speakController.reset();
       belliStateMachine.transitionTo(AVATAR_STATES.SPEAKING);
       speakController.enqueueSpeak("Going to sleep now. Say 'Hello Belli' when you need me.");
    };

    window.addEventListener('voice-input-ready', handleVoiceInputReady);
    window.addEventListener('belli-barge-in', handleBargeIn);
    window.addEventListener('belli-finished-speaking', handleBelliFinished);
    window.addEventListener('belli-retry-trigger', handleRetry);
    window.addEventListener('belli-no-input-trigger', handleNoInput);
    window.addEventListener('belli-sleep-trigger', handleSleep);

    return () => {
      window.removeEventListener('voice-input-ready', handleVoiceInputReady);
      window.removeEventListener('belli-barge-in', handleBargeIn);
      window.removeEventListener('belli-finished-speaking', handleBelliFinished);
      window.removeEventListener('belli-retry-trigger', handleRetry);
      window.removeEventListener('belli-no-input-trigger', handleNoInput);
      window.removeEventListener('belli-sleep-trigger', handleSleep);
    };
  }, []);

  // --- GREETING ON STARTUP ---
  useEffect(() => {
    const speakGreeting = () => {
      const state = useAvatarStore.getState();
      if (state.avatarState === AVATAR_STATES.GREETING && !state.greetingDone) {
        console.log('[VoiceManager] Playing startup greeting...');
        
        // Mark greeting as done immediately to prevent re-fires
        state.setGreetingDone();
        
        // Transition to speaking and use SpeakController for the greeting
        belliStateMachine.transitionTo(AVATAR_STATES.SPEAKING);
        speakController.reset();
        speakController.enqueueSpeak("Hello! I am Belli. How can I help you today?");
      }
    };

    // Small delay for AudioContext readiness + user interaction requirement
    const timeout = setTimeout(speakGreeting, 1500);
    return () => clearTimeout(timeout);
  }, []);

  // Watch state changes to trigger Barge-In listeners
  const avatarState = useAvatarStore((s) => s.avatarState);

  useEffect(() => {
    // When Belli starts thinking or speaking, start the Barge-in listener
    if (avatarState === AVATAR_STATES.THINKING || avatarState === AVATAR_STATES.SPEAKING) {
      voiceController.startBargeIn();
    } else if (avatarState !== AVATAR_STATES.LISTENING) {
      voiceController.stopBargeIn();
    }
  }, [avatarState]);

  return null; // Logic-only component
}
