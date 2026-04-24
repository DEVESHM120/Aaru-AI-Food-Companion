import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let cachedAddresses: { address_id: string; location_name: string }[] | null = null;

export async function GET() {
  if (cachedAddresses) {
    return NextResponse.json(cachedAddresses);
  }

  if (!process.env.ZOMATO_MCP_AUTH_TOKEN) {
    return NextResponse.json([]);
  }

  try {
    const response = await (client.beta.messages as any).create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: "You are a helper. Call the get_saved_addresses_for_user tool and return the result as JSON only. No explanation.",
      messages: [{ role: "user", content: "Get my saved addresses" }],
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

    // BUG-007 fix: try array format first, then object with .addresses field
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        const arr = JSON.parse(arrMatch[0]);
        if (Array.isArray(arr) && arr.length > 0) {
          cachedAddresses = arr;
          return NextResponse.json(arr);
        }
      } catch {}
    }

    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        const addresses = parsed.addresses ?? parsed.data ?? [];
        cachedAddresses = addresses;
        return NextResponse.json(addresses);
      } catch {}
    }

    return NextResponse.json([]);
  } catch {
    return NextResponse.json([]);
  }
}
