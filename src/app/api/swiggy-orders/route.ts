import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { PastOrder } from "@/lib/profiles/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let cachedOrders: PastOrder[] | null = null;

export async function GET() {
  if (cachedOrders) {
    return NextResponse.json(cachedOrders);
  }

  if (!process.env.SWIGGY_MCP_AUTH_TOKEN) {
    return NextResponse.json([]);
  }

  try {
    const response = await (client.beta.messages as any).create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: "You are a helper. Call the available tool to get past orders and return the result as a JSON array. Each item must have: restaurantName (string), itemName (string), price (number in INR), platform ('swiggy'), orderedAt (ISO date string). Return only the JSON array, no explanation.",
      messages: [{ role: "user", content: "Get my recent orders" }],
      mcp_servers: [
        {
          type: "url",
          url: "https://mcp.swiggy.com/food",
          name: "swiggy",
          authorization_token: process.env.SWIGGY_MCP_AUTH_TOKEN,
        },
      ],
      betas: ["mcp-client-2025-04-04"],
    });

    const text = response.content.find((c: any) => c.type === "text")?.text ?? "[]";
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const orders: PastOrder[] = JSON.parse(arrMatch[0]);
      cachedOrders = orders.slice(0, 20);
      return NextResponse.json(cachedOrders);
    }

    return NextResponse.json([]);
  } catch {
    return NextResponse.json([]);
  }
}
