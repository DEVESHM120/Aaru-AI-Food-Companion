import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ZomatoContact {
  name: string;
  diet?: "veg" | "nonveg" | "both";
  notes?: string;
  addresses?: { label: string; locationName: string }[];
}

let cachedContacts: ZomatoContact[] | null = null;

export async function GET() {
  if (cachedContacts) return NextResponse.json(cachedContacts);

  if (!process.env.ZOMATO_MCP_AUTH_TOKEN) {
    return NextResponse.json([]);
  }

  try {
    const response = await (client.beta.messages as any).create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a helper. Try to call any of these MCP tools (use whichever exists):
- get_saved_contacts
- get_family_members
- get_profiles_for_user
- get_order_for_someone_profiles

Return the result as a JSON array of contact objects:
[{
  "name": "string",
  "diet": "veg" | "nonveg" | "both" | null,
  "notes": "string or null",
  "addresses": [{ "label": "string", "locationName": "string" }]
}]

If none of these tools exist or returns no data, return an empty array [].
Return only the JSON array, no explanation.`,
      messages: [{ role: "user", content: "Get my saved contacts or family profiles" }],
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

    const text = response.content.find((c: any) => c.type === "text")?.text ?? "[]";
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        cachedContacts = parsed.filter((c: any) => c && typeof c.name === "string");
        return NextResponse.json(cachedContacts);
      }
    }
    cachedContacts = [];
    return NextResponse.json([]);
  } catch {
    return NextResponse.json([]);
  }
}
