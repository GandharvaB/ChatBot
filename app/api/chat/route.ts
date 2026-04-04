import { OpenAIStream, StreamingTextResponse } from 'ai';
import { Configuration, OpenAIApi } from 'openai-edge';

// We map the Sarvam API underneath the OpenAI Edge polyfill driver 
// (which ai@3 natively hooked up with in classical configurations)
const config = new Configuration({
  apiKey: process.env.SARVAM_API_KEY || '',
  basePath: process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai/v1',
});

const sarvam = new OpenAIApi(config);

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const currentTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    const response = await sarvam.createChatCompletion({
      model: 'sarvam-30b',
      stream: true,
      messages: [
        { 
          role: 'system', 
          content: `You are a warm, helpful AI assistant embodied in a 3D avatar.
Current Date and Time: ${currentTime}
Location: Mumbai, India (IST)

Context: You are a warm, helpful AI assistant. 
Voice Rule: When you are speaking, DO NOT use [ANIM: idle] at the start of your message unless you are explicitly pausing. Instead, either use [ANIM: speaking] or do not use a tag at all to let the system handle it automatically.

Keep response short (under 3 sentences). You can control your 3D avatar animations! If asked to playfully animate or explain something, start your sentence with [ANIM: animationName]. Available animations: "dance", "shuffle", "speaking", "listening", "idle".` 
        },
        ...messages
      ],
    });

    // Convert the Sarvam OpenAI-compatible response to a standard AI stream
    const stream = OpenAIStream(response);
    
    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat" }), { status: 500 });
  }
}
