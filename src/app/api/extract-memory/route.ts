import Groq from "groq-sdk";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { appendMemoryForProfile } from "@/lib/server/memoryStore";

export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const { userMessage, assistantReply, profileName } = await req.json();
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) return Response.json({ fact: null });

  const groq = new Groq({ apiKey: groqApiKey });
  const result = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 60,
    messages: [
      {
        role: "system",
        content: `Extract ONE specific learnable fact about ${profileName}'s food preferences. Return ONLY valid JSON: {"fact":"..."} or {"fact":null}. Max 15 words. Concrete: what they like/dislike/need/prefer. Examples: "Hates mushrooms in any dish", "Lactose intolerant - avoid cheese", "Never orders from Dominos".`,
      },
      { role: "user", content: `User: "${userMessage}"\nAaru: "${assistantReply.slice(0, 300)}"` },
    ],
  });

  let fact: string | null = null;
  try {
    fact = JSON.parse(result.choices[0]?.message?.content ?? "{}").fact ?? null;
  } catch {
    // ignore parse failures
  }

  if (fact) {
    try {
      let session = null;
      try { session = await auth(); } catch { /* AUTH_SECRET not configured */ }
      const email = session?.user?.email;
      if (email) {
        await appendMemoryForProfile(email, profileName, fact);
      }
    } catch {
      // store not configured
    }
  }

  return Response.json({ fact });
}

