import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { getProfilesForUser, saveProfilesForUser } from "@/lib/server/memoryStore";

export async function GET() {
  let session = null;
  try { session = await auth(); } catch { /* AUTH_SECRET not configured */ }
  const email = session?.user?.email;
  if (!email) return Response.json({ profiles: [] });

  const profiles = await getProfilesForUser(email);
  return Response.json({ profiles });
}

export async function POST(req: NextRequest) {
  let session = null;
  try { session = await auth(); } catch { /* AUTH_SECRET not configured */ }
  const email = session?.user?.email;
  if (!email) return Response.json({ ok: false });

  try {
    const { profiles } = await req.json();
    const ok = await saveProfilesForUser(email, Array.isArray(profiles) ? profiles : []);
    return Response.json({ ok });
  } catch {
    return Response.json({ ok: false });
  }
}
