import { auth } from "@/auth";
import { NextRequest } from "next/server";

export async function GET() {
  let session = null;
  try { session = await auth(); } catch { /* AUTH_SECRET not configured */ }
  const email = session?.user?.email;
  if (!email) return Response.json({ profiles: [] });

  try {
    const { kv } = await import("@vercel/kv");
    const data = await kv.get<{ profiles: unknown[] }>(`profiles:${email}`);
    return Response.json({ profiles: data?.profiles ?? [] });
  } catch {
    return Response.json({ profiles: [] });
  }
}

export async function POST(req: NextRequest) {
  let session = null;
  try { session = await auth(); } catch { /* AUTH_SECRET not configured */ }
  const email = session?.user?.email;
  if (!email) return Response.json({ ok: false });

  try {
    const { profiles } = await req.json();
    const { kv } = await import("@vercel/kv");
    await kv.set(`profiles:${email}`, { profiles, updatedAt: Date.now() });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false });
  }
}
