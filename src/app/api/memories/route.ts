import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { getMemoriesForProfile } from "@/lib/server/memoryStore";

export async function GET(req: NextRequest) {
  let session = null;
  try { session = await auth(); } catch { /* AUTH_SECRET not configured */ }
  const email = session?.user?.email;
  if (!email) return Response.json({ memories: [] });

  const profileName = req.nextUrl.searchParams.get("profileName") ?? "";
  if (!profileName) return Response.json({ memories: [] });

  const memories = await getMemoriesForProfile(email, profileName);
  return Response.json({ memories });
}
