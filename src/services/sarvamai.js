import axios from 'axios';

const API_KEY = import.meta.env.VITE_SARVAM_KEY;

if (!API_KEY) {
  console.warn('⚠️ VITE_SARVAM_KEY not found in environment variables. API calls will fail.');
}

// Speech-to-Text using Saaras v3
export async function speechToText(audioBlob) {
  try {
    const isWav = audioBlob.type === 'audio/wav';
    const MAX_CHUNK_BYTES = 920000; // ~28.75 seconds of 16kHz 16-bit mono PCM

    if (isWav && audioBlob.size > MAX_CHUNK_BYTES + 44) {
      console.log('Audio duration exceeds 30s limit. Auto-slicing into parallel batch chunks...');
      const headerBlob = audioBlob.slice(0, 44);
      const dataBlob = audioBlob.slice(44);
      const chunks = [];

      for (let offset = 0; offset < dataBlob.size; offset += MAX_CHUNK_BYTES) {
        const slice = dataBlob.slice(offset, offset + MAX_CHUNK_BYTES);
        
        // Dynamically rebuild a valid WAV header for the exact slice size
        const headerBuffer = await headerBlob.arrayBuffer();
        const view = new DataView(headerBuffer);
        view.setUint32(4, 36 + slice.size, true); // adjust file size header
        view.setUint32(40, slice.size, true);     // adjust data chunk size header
        
        const newWavBlob = new Blob([headerBuffer, slice], { type: 'audio/wav' });
        chunks.push(newWavBlob);
      }

      // Execute STT on all chunks in parallel
      const results = await Promise.all(
        chunks.map((chunk, idx) => {
          const fd = new FormData();
          fd.append('file', chunk, `chunk_${idx}.wav`);
          fd.append('model', 'saaras:v3');
          fd.append('mode', 'transcribe');
          return axios.post('https://api.sarvam.ai/speech-to-text', fd, {
            headers: { 'api-subscription-key': API_KEY },
            timeout: 60000,
          }).then(r => r.data);
        })
      );

      // Concatenate all transcribed strings sequentially
      const fullTranscript = results.map(r => (r.transcript || '').trim()).join(' ');
      const mainLang = results[0]?.language_code || 'en-IN';

      return {
        transcript: fullTranscript,
        languageCode: mainLang,
      };
    }

    // Default fast-path processing for < 30s clips
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'saaras:v3');
    formData.append('mode', 'transcribe');

    const response = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
      headers: {
        'api-subscription-key': API_KEY,
      },
      timeout: 30000,
    });

    return {
      transcript: response.data.transcript,
      languageCode: response.data.language_code || 'en-IN',
    };
  } catch (error) {
    console.error('STT Error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.message || 'Speech-to-text failed. Please try again.'
    );
  }
}

// Chat Completion using Sarvam AI
export async function chatCompletion(messages, systemPrompt = null) {
  try {
    const currentDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const systemMessage = {
      role: 'system',
      content:
        systemPrompt ||
        `You are a friendly, intelligent AI assistant embodied as a 3D avatar. You communicate naturally and expressively. Keep responses concise (2-3 sentences) for natural conversation flow. You support multiple Indian languages and English. Match the language of the user's input. Be warm, helpful, and occasionally use natural gestures in your speech like greeting, explaining, or expressing uncertainty.
IMPORTANT: The current real-time date and time is ${currentDate}. You must adapt your knowledge dynamically to the present day. If asked about current events or recently released hardware, act with the knowledge that it is currently ${currentDate}.`,
    };

    const response = await axios.post(
      'https://api.sarvam.ai/v1/chat/completions',
      {
        model: 'sarvam-30b',
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const aiMessage = response.data.choices?.[0]?.message?.content || '';
    return { content: aiMessage };
  } catch (error) {
    console.error('Chat Error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.message || 'Chat completion failed. Please try again.'
    );
  }
}

// Text-to-Speech using Bulbul v3
export async function textToSpeech(text, languageCode = 'en-IN', speaker = 'meera') {
  try {
    // Sarvam TTS has a 2500 char limit for v3
    const truncatedText = text.slice(0, 2400);

    const response = await axios.post(
      'https://api.sarvam.ai/text-to-speech',
      {
        inputs: [truncatedText],
        target_language_code: languageCode,
        speaker: speaker,
        model: 'bulbul:v3',
        pace: 1.0,
        speech_sample_rate: 24000,
        enable_preprocessing: true,
      },
      {
        headers: {
          'api-subscription-key': API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const audioBase64 = response.data.audios?.[0];
    if (!audioBase64) {
      throw new Error('No audio data in TTS response');
    }

    // Decode base64 to ArrayBuffer
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error('TTS Error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.message || 'Text-to-speech failed. Please try again.'
    );
  }
}

// Detect language code from transcript
export function detectLanguageFromCode(code) {
  const langMap = {
    'hi-IN': { name: 'Hindi', flag: '🇮🇳', code: 'hi-IN' },
    'bn-IN': { name: 'Bengali', flag: '🇮🇳', code: 'bn-IN' },
    'ta-IN': { name: 'Tamil', flag: '🇮🇳', code: 'ta-IN' },
    'te-IN': { name: 'Telugu', flag: '🇮🇳', code: 'te-IN' },
    'kn-IN': { name: 'Kannada', flag: '🇮🇳', code: 'kn-IN' },
    'ml-IN': { name: 'Malayalam', flag: '🇮🇳', code: 'ml-IN' },
    'mr-IN': { name: 'Marathi', flag: '🇮🇳', code: 'mr-IN' },
    'gu-IN': { name: 'Gujarati', flag: '🇮🇳', code: 'gu-IN' },
    'pa-IN': { name: 'Punjabi', flag: '🇮🇳', code: 'pa-IN' },
    'od-IN': { name: 'Odia', flag: '🇮🇳', code: 'od-IN' },
    'en-IN': { name: 'English', flag: '🌐', code: 'en-IN' },
  };
  return langMap[code] || { name: 'English', flag: '🌐', code: 'en-IN' };
}
