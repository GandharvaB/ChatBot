import { create } from 'zustand';
import { processAudioMessage, processTextMessage } from '../api/sarvamClient';
import { LipsyncEn } from '../avatar/modules/lipsync-en.mjs';

const lipsync = new LipsyncEn();

export const useConversation = create((set, get) => ({
  mediaRecorder: null,
  audioChunks: [],
  isRecording: false,
  isProcessing: false,
  transcript: '',
  replyText: '',

  startRecording: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await get().processAudioConversation(audioBlob);
      };

      recorder.start();
      set({ mediaRecorder: recorder, audioChunks: [], isRecording: true, transcript: '' });
      
      // Update store state natively if needed
      // (assuming useAvatarStore triggers happen externally or here)
    } catch (err) {
      console.error('Mic error:', err);
    }
  },

  stopRecording: () => {
    const { mediaRecorder } = get();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      set({ isRecording: false, isProcessing: true });
    }
  },

  processAudioConversation: async (audioBlob) => {
    set({ isProcessing: true });
    try {
      const res = await processAudioMessage(audioBlob);
      set({ transcript: res.transcript, replyText: res.replyText, isProcessing: false });
      get().playAudioAndLipSync(res.audioBase64, res.replyText);
    } catch (err) {
      console.error(err);
      set({ isProcessing: false });
    }
  },

  processTextConversation: async (text) => {
    set({ isProcessing: true });
    try {
      const res = await processTextMessage(text);
      set({ transcript: res.transcript, replyText: res.replyText, isProcessing: false });
      get().playAudioAndLipSync(res.audioBase64, res.replyText);
    } catch (err) {
      console.error(err);
      set({ isProcessing: false });
    }
  },

  playAudioAndLipSync: (audioBase64, text) => {
    // 1. Play Audio
    const audioContent = `data:audio/wav;base64,${audioBase64}`;
    const audio = new Audio(audioContent);
    
    // 2. Generate Phonemes from Text using Lipsync
    const phonemes = lipsync.wordsToVisemes(text); 
    // `wordsToVisemes` returns an array of [{time, duration, viseme}] relative to duration.
    // However LipsyncEn preToVisemes standard method is just text -> visemes with assumed timing approx 80ms per char.
    
    // Fallback: simple text-based phonetic estimator
    const visemeSchedule = [];
    let currentTime = 0;
    
    // Standard map for characters to visemes (naive but matches TalkingHead approach for text fallback)
    const words = text.split(' ');
    words.forEach(word => {
      // Basic approximation: 
      const estimatedDuration = Math.max(0.2, word.length * 0.08); // 80ms per char
      visemeSchedule.push({
        viseme: 'ih',  // Default open mouth
        start: currentTime,
        end: currentTime + estimatedDuration
      });
      currentTime += estimatedDuration + 0.1; // 100ms pause between words
    });

    audio.play();
    
    // Add logic to update Zustand visemes during playback
    // Using a simple interval ticker for now
    const ticker = setInterval(() => {
      if (audio.ended || audio.paused) {
        clearInterval(ticker);
        window.dispatchEvent(new CustomEvent('avatar-viseme', { detail: { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 } }));
        return;
      }
      
      const t = audio.currentTime;
      const active = visemeSchedule.find(v => t >= v.start && t <= v.end);
      
      let targets = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
      if (active) {
        targets[active.viseme] = 1.0;
      }
      
      // Dispatch to global event or update store
      window.dispatchEvent(new CustomEvent('avatar-viseme', { detail: targets }));

    }, 50);

  }
}));
