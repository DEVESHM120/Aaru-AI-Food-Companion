import { NextRequest, NextResponse } from "next/server";
import { MCPServerStreamableHttp } from "@openai/agents";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 });

  const server = new MCPServerStreamableHttp({
    name: "swiggy-food",
    url: "https://mcp.swiggy.com/food",
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });

  try {
    await server.connect();
    const result = await server.callTool("get_addresses", {});
    await server.close();
    const text = (result as { type: string; text?: string }[]).find(c => c.type === "text")?.text ?? "[]";
    const addresses = JSON.parse(text);
    return NextResponse.json({ addresses });
  } catch (err) {
    try { await server.close(); } catch {}
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
