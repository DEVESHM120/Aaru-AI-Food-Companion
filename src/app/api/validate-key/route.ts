import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { anthropicKey } = await req.json();
    if (!anthropicKey) return NextResponse.json({ valid: false, error: "No key provided" }, { status: 400 });

    const client = new Anthropic({ apiKey: anthropicKey });
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    });

    return NextResponse.json({ valid: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuthError = msg.includes("401") || msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("invalid");
    return NextResponse.json({ valid: false, error: isAuthError ? "Invalid API key" : "Could not connect to Anthropic" });
  }
}
