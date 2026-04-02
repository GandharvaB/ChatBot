import axios from 'axios';

// All frontend API calls are routed through the local proxy server to protect the Sarvam API Key
const API_URL = 'http://localhost:3001/api/chat';

export const processAudioMessage = async (audioBlob) => {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    const res = await axios.post(`${API_URL}/audio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    return res.data;
  } catch (error) {
    console.error('Error processing audio via proxy:', error);
    throw error;
  }
};

export const processTextMessage = async (text) => {
  try {
    const res = await axios.post(`${API_URL}/text`, { text }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return res.data;
  } catch (error) {
    console.error('Error processing text via proxy:', error);
    throw error;
  }
};
