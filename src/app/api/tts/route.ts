import { NextRequest, NextResponse } from "next/server";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID!;
const MODEL_ID = "eleven_turbo_v2_5"; // pinned — same model across all pool keys

function getKeyPool(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const k = process.env[i === 1 ? "ELEVENLABS_API_KEY" : `ELEVENLABS_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  // Fisher-Yates shuffle so load is distributed randomly
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys;
}

async function tryKey(apiKey: string, text: string): Promise<ArrayBuffer | null> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    }
  );
  if (response.status === 401 || response.status === 429) return null; // rotate to next key
  if (!response.ok) throw new Error(`ElevenLabs error: ${response.statusText}`);
  return response.arrayBuffer();
}

export async function POST(req: NextRequest) {
  const { text, elevenLabsKey } = await req.json();

  if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  // User-provided key always takes priority and is tried once only
  if (elevenLabsKey) {
    try {
      const buf = await tryKey(elevenLabsKey, text);
      if (buf) return new NextResponse(buf, { headers: { "Content-Type": "audio/mpeg" } });
    } catch (err) {
      console.error("TTS user-key error:", err);
    }
    return NextResponse.json({ error: "ElevenLabs key failed" }, { status: 503 });
  }

  const pool = getKeyPool();
  if (pool.length === 0) return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 503 });

  for (const key of pool) {
    try {
      const buf = await tryKey(key, text);
      if (buf) return new NextResponse(buf, { headers: { "Content-Type": "audio/mpeg" } });
    } catch (err) {
      console.error("TTS pool-key error:", err);
    }
  }

  // All keys exhausted — client should fall back to browser TTS
  return NextResponse.json({ error: "All TTS keys exhausted" }, { status: 503 });
}
