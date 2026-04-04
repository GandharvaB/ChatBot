import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Missing text payload" }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "SARVAM_API_KEY environment variable is not set" }, { status: 500 });
    }

    // Truncate to match Sarvam API limits if necessary (V3 supports 2500)
    const truncatedText = text.slice(0, 2400);

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [truncatedText],
        target_language_code: "en-IN",
        speaker: "ritu",
        model: "bulbul:v3",
        pace: 1.0,
        speech_sample_rate: 24000,
        enable_preprocessing: true,
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Sarvam TTS error:", errorData);
      return NextResponse.json({ error: "Sarvam TTS Api failed", details: errorData }, { status: response.status });
    }

    const data = await response.json();
    const audioBase64 = data.audios?.[0];

    if (!audioBase64) {
      return NextResponse.json({ error: "No audio data returned by Sarvam" }, { status: 500 });
    }

    // Convert base64 to binary buffer to send as raw audio/wav stream so the frontend can decode via AudioContext
    const buffer = Buffer.from(audioBase64, 'base64');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
      },
    });

  } catch (error: any) {
    console.error("TTS API execution error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
