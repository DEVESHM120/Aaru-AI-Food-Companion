import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ZomatoUserInfo {
  name: string | null;
  diet?: "veg" | "nonveg" | "both";
  budgetRange?: "budget" | "mid" | "premium";
  preferredCuisines?: string[];
  allergies?: string[];
}

let cachedUser: ZomatoUserInfo | null = null;

export async function GET() {
  if (cachedUser) return NextResponse.json(cachedUser);

  if (!process.env.ZOMATO_MCP_AUTH_TOKEN) {
    return NextResponse.json({ name: null });
  }

  try {
    const response = await (client.beta.messages as any).create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: `You are a helper. Call the get_user_profile tool and return the result as JSON with these fields:
{
  "name": "string or null",
  "diet": "veg" | "nonveg" | "both" | null,
  "budgetRange": "budget" | "mid" | "premium" | null,
  "preferredCuisines": ["string", ...] or [],
  "allergies": ["string", ...] or []
}
Use the actual data from the profile tool. If a field is not available, use null or []. Return only the JSON object, no explanation.`,
      messages: [{ role: "user", content: "Get my full profile" }],
      mcp_servers: [
        {
          type: "url",
          url: "https://mcp-server.zomato.com/mcp",
          name: "zomato",
          authorization_token: process.env.ZOMATO_MCP_AUTH_TOKEN,
        },
      ],
      betas: ["mcp-client-2025-04-04"],
    });

    const text = response.content.find((c: any) => c.type === "text")?.text ?? "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      cachedUser = {
        name: parsed.name ?? null,
        diet: parsed.diet ?? undefined,
        budgetRange: parsed.budgetRange ?? undefined,
        preferredCuisines: Array.isArray(parsed.preferredCuisines) ? parsed.preferredCuisines : [],
        allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
      };
      return NextResponse.json(cachedUser);
    }
    return NextResponse.json({ name: null });
  } catch {
    return NextResponse.json({ name: null });
  }
}
