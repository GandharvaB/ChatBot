import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';

// Load variables from server/.env
dotenv.config({ path: './server/.env' });

const app = express();
const port = 3001;
const apiKey = process.env.SARVAM_API_KEY;

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Basic emotion keyword mapping from prompt
function detectEmotion(text) {
  const t = text.toLowerCase();
  if (t.includes('hello') || t.includes('hi ') || t.includes('greetings')) return 'GREETING';
  if (t.includes('think') || t.includes('maybe') || t.includes('uncertain')) return 'THINKING';
  if (t.includes('help') || t.includes('great') || t.includes('yes')) return 'POSITIVE';
  return 'NEUTRAL';
}

app.post('/api/chat/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });
    
    console.log(`[Text Chat Input]: ${text}`);

    // Step 2: LLM
    let replyText = "";
    try {
      const llmPayload = {
        model: "sarvam-2-alpha", // Using a more stable model name
        messages: [
          { role: 'system', content: 'You are a helpful, friendly AI assistant represented as a 3D avatar. Keep responses conversational, warm, and concise (2-4 sentences). Speak naturally as if talking, not writing.' },
          { role: 'user', content: text }
        ],
        temperature: 0.7
      };

      console.log(`[LLM] Calling with payload:`, JSON.stringify(llmPayload));
      const llmResponse = await axios.post('https://api.sarvam.ai/v1/chat/completions', llmPayload, {
        headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey }
      });
      replyText = llmResponse.data.choices[0].message.content;
      console.log(`[LLM] Success: ${replyText}`);
    } catch (llmErr) {
      console.error("[LLM Error]:", llmErr.response?.data || llmErr.message);
      throw new Error(`LLM failed: ${JSON.stringify(llmErr.response?.data || llmErr.message)}`);
    }

    const emotion = detectEmotion(replyText);

    // Step 3: TTS
    try {
      const ttsPayload = {
        inputs: [replyText],
        target_language_code: 'hi-IN', 
        speaker: 'meera', // Try a different speaker
        pitch: 0,
        pace: 1.0,
        speech_sample_rate: 16000,
        enable_preprocessing: true,
        model: "bulbul:v1"
      };

      console.log(`[TTS] Calling with payload:`, JSON.stringify(ttsPayload));
      const ttsResponse = await axios.post('https://api.sarvam.ai/text-to-speech', ttsPayload, {
        headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey }
      });

      console.log(`[TTS] Success`);
      res.json({
        transcript: text,
        replyText,
        emotion,
        audioBase64: ttsResponse.data.audios[0] 
      });
    } catch (ttsErr) {
      console.error("[TTS Error]:", ttsErr.response?.data || ttsErr.message);
      throw new Error(`TTS failed: ${JSON.stringify(ttsErr.response?.data || ttsErr.message)}`);
    }
  } catch (err) {
    console.error(`[Sarvam Pipeline Error (Text)]:`, err?.response?.data || err.message);
    if (err.response) {
      console.error("Sarvam Error Details:", JSON.stringify(err.response.data, null, 2));
    }
    res.status(500).json({ 
        error: 'Failed in the Sarvam Pipeline', 
        details: err.message,
        sarvamError: err?.response?.data 
    });
  }
});

app.post('/api/chat/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio provided' });

    // Step 1: STT
    let transcript = "";
    try {
      const sttForm = new FormData();
      sttForm.append('file', req.file.buffer, { filename: 'audio.wav', contentType: req.file.mimetype });
      sttForm.append('model', 'saaras:v3');

      console.log(`[STT] Processing audio...`);
      const sttResponse = await axios.post('https://api.sarvam.ai/speech-to-text', sttForm, {
        headers: { 
          ...sttForm.getHeaders(),
          'api-subscription-key': apiKey 
        }
      });
      transcript = sttResponse.data.transcript || sttResponse.data.text;
      console.log(`[STT] Recognized: ${transcript}`);
    } catch (sttErr) {
      console.error("[STT Error]:", sttErr.response?.data || sttErr.message);
      throw new Error(`STT phase failed: ${JSON.stringify(sttErr.response?.data || sttErr.message)}`);
    }

    if (!transcript) throw new Error("STT failed to parse text");

    // Step 2: LLM
    let replyText = "";
    try {
      const llmPayload = {
        model: "sarvam-2-alpha",
        messages: [
          { role: 'system', content: 'You are a helpful, friendly AI assistant represented as a 3D avatar. Keep responses conversational, warm, and concise (2-4 sentences).' },
          { role: 'user', content: transcript }
        ],
        temperature: 0.7
      };
      console.log(`[LLM] Calling...`);
      const llmResponse = await axios.post('https://api.sarvam.ai/v1/chat/completions', llmPayload, {
        headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey }
      });
      replyText = llmResponse.data.choices[0].message.content;
      console.log(`[LLM] Reply: ${replyText}`);
    } catch (llmErr) {
      console.error("[LLM Error]:", llmErr.response?.data || llmErr.message);
      throw new Error(`LLM phase failed: ${JSON.stringify(llmErr.response?.data || llmErr.message)}`);
    }

    const emotion = detectEmotion(replyText);

    // Step 3: TTS
    try {
      const ttsPayload = {
        inputs: [replyText],
        target_language_code: 'hi-IN', 
        speaker: 'meera', 
        pitch: 0,
        pace: 1.0,
        speech_sample_rate: 16000,
        enable_preprocessing: true,
        model: "bulbul:v1"
      };
      console.log(`[TTS] Requesting audio...`);
      const ttsResponse = await axios.post('https://api.sarvam.ai/text-to-speech', ttsPayload, {
        headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey }
      });
      console.log(`[TTS] Success`);
      res.json({
        transcript,
        replyText,
        emotion,
        audioBase64: ttsResponse.data.audios[0] 
      });
    } catch (ttsErr) {
      console.error("[TTS Error]:", ttsErr.response?.data || ttsErr.message);
      throw new Error(`TTS phase failed: ${JSON.stringify(ttsErr.response?.data || ttsErr.message)}`);
    }

  } catch (err) {
    console.error(`[Sarvam Pipeline Error]:`, err?.response?.data || err.message);
    if (err.response) {
        console.error("Sarvam Error Details:", JSON.stringify(err.response.data, null, 2));
    }
    res.status(500).json({ 
        error: 'Failed in the Sarvam Pipeline', 
        details: err.message,
        sarvamError: err?.response?.data 
    });
  }
});

app.listen(port, () => {
  console.log(`Sarvam express proxy listening on port ${port}`);
});
