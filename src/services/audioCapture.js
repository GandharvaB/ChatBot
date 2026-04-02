// Audio capture utilities using Web Audio API

let audioContext = null;
let mediaStream = null;
let mediaRecorder = null;
let analyserNode = null;
let sourceNode = null;
let audioChunks = [];

// Initialize audio context
export function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 24000,
    });
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// Request microphone permission and start capture
export async function startMicCapture() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const ctx = getAudioContext();
    sourceNode = ctx.createMediaStreamSource(mediaStream);
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;
    sourceNode.connect(analyserNode);

    // Start MediaRecorder with base webm/mp4 without codecs strictness
    audioChunks = [];
    let mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    
    // Save a clean version for Blob construction (fallback)
    const baseMimeType = mimeType.split(';')[0]; 
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
    mediaRecorder.baseMimeType = baseMimeType;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start(100); // Collect data every 100ms
    return { analyserNode, mediaRecorder };
  } catch (error) {
    console.error('Microphone access denied:', error);
    throw new Error('Microphone permission denied. Please allow microphone access.');
  }
}

// Stop mic capture and return audio blob
export async function stopMicCapture() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = async () => {
      const webmBlob = new Blob(audioChunks, { type: mediaRecorder.baseMimeType });

      // Convert to WAV for Sarvam API compatibility
      const wavBlob = await convertToWav(webmBlob);

      // Cleanup
      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      audioChunks = [];
      resolve(wavBlob);
    };

    mediaRecorder.stop();
  });
}

// Convert audio blob to WAV format
async function convertToWav(blob) {
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();

  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const numChannels = 1;
    const sampleRate = 16000;
    const length = audioBuffer.length;

    // Resample to 16kHz mono
    const offlineCtx = new OfflineAudioContext(numChannels, (length * sampleRate) / audioBuffer.sampleRate, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const resampledBuffer = await offlineCtx.startRendering();
    const samples = resampledBuffer.getChannelData(0);

    // Create WAV
    const wavBuffer = encodeWAV(samples, sampleRate);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } catch (error) {
    console.error('WAV conversion failed:', error);
    // Return original blob as fallback
    return blob;
  }
}

// Encode PCM samples to WAV format
function encodeWAV(samples, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Get RMS volume from analyser (for VAD)
export function getRMSVolume(analyserNode) {
  if (!analyserNode) return 0;
  const dataArray = new Float32Array(analyserNode.fftSize);
  analyserNode.getFloatTimeDomainData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  return Math.sqrt(sum / dataArray.length);
}

// Get frequency data for visualization
export function getFrequencyData(analyserNode) {
  if (!analyserNode) return new Uint8Array(0);
  const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(dataArray);
  return dataArray;
}

let activePlaybackAnalyser = null;

export function getActiveAnalyser() {
  return activePlaybackAnalyser;
}

// Play audio buffer and return analyser for lip sync
export async function playAudioBuffer(arrayBuffer) {
  const ctx = getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

  const source = ctx.createBufferSource();
  const analyser = ctx.createAnalyser();
  activePlaybackAnalyser = analyser;
  const gainNode = ctx.createGain();

  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.85;
  gainNode.gain.value = 1.0;

  source.buffer = audioBuffer;
  source.connect(analyser);
  analyser.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start(0);

  return {
    source,
    analyser,
    gainNode,
    duration: audioBuffer.duration,
  };
}

// Cleanup
export function cleanup() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }
}
