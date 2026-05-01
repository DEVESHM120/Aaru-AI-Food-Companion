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
    const content = Array.isArray(result)
      ? result
      : (result as { content?: { type: string; text?: string }[] })?.content ?? [];
    const text = (content as { type: string; text?: string }[]).find(c => c.type === "text")?.text ?? "[]";
    const parsed = JSON.parse(text);
    const addresses = Array.isArray(parsed) ? parsed : parsed.addresses ?? parsed.data ?? [];
    return NextResponse.json({ addresses });
  } catch (err: unknown) {
    try { await server.close(); } catch {}
    const status = (err as { status?: number })?.status;
    return NextResponse.json({ error: String(err) }, { status: status === 401 ? 401 : 500 });
  }
}
