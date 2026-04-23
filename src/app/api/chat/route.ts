import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { Restaurant } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseRestaurantsFromResponse(text: string): Restaurant[] | undefined {
  const match = text.match(/```restaurants\n([\s\S]*?)\n```/);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

function parseOrderFromResponse(text: string) {
  const match = text.match(/```order\n([\s\S]*?)\n```/);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

function cleanMessageText(text: string): string {
  return text
    .replace(/```restaurants[\s\S]*?```/g, "")
    .replace(/```order[\s\S]*?```/g, "")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { messages, inputMode } = await req.json();

    const hasMcpTokens =
      process.env.ZOMATO_MCP_AUTH_TOKEN && process.env.SWIGGY_MCP_AUTH_TOKEN;

    let response;

    if (hasMcpTokens) {
      // Use real MCP servers when tokens are available
      const mcpServers = [
        {
          type: "url" as const,
          url: "https://mcp.zomato.com",
          name: "zomato",
          authorization_token: process.env.ZOMATO_MCP_AUTH_TOKEN,
        },
        {
          type: "url" as const,
          url: "https://mcp.swiggy.com/food",
          name: "swiggy",
          authorization_token: process.env.SWIGGY_MCP_AUTH_TOKEN,
        },
      ];

      response = await (client.beta.messages as any).create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
        mcp_servers: mcpServers,
        betas: ["mcp-client-2025-04-04"],
      });
    } else {
      // Demo mode — Claude without MCP tools
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system:
          SYSTEM_PROMPT +
          "\n\nNOTE: You are in demo mode. When suggesting restaurants, include realistic mock restaurant data in the ```restaurants JSON block. Use Indian restaurant names, INR prices, and realistic delivery times.",
        messages,
      });
    }

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const restaurants = parseRestaurantsFromResponse(rawText);
    const orderDetails = parseOrderFromResponse(rawText);
    const cleanText = cleanMessageText(rawText);

    return NextResponse.json({
      message: cleanText,
      restaurants,
      orderDetails,
      shouldSpeak: inputMode === "voice",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to get response" },
      { status: 500 }
    );
  }
}
