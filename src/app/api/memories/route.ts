import { auth } from "@/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  let session = null;
  try { session = await auth(); } catch { /* AUTH_SECRET not configured */ }
  const email = session?.user?.email;
  if (!email) return Response.json({ memories: [] });

  const profileName = req.nextUrl.searchParams.get("profileName") ?? "";
  if (!profileName) return Response.json({ memories: [] });

  try {
    const { kv } = await import("@vercel/kv");
    const memories = await kv.lrange(`mem:${email}:${profileName}`, 0, 29);
    return Response.json({ memories: memories as string[] });
  } catch {
    return Response.json({ memories: [] });
  }
}
