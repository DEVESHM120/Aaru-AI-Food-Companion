import { NextResponse } from "next/server";

// Profile is stored in localStorage on the client — no server-side file storage needed.
export async function GET() {
  return NextResponse.json({ content: "", exists: false });
}

export async function POST() {
  return NextResponse.json({ ok: true });
}
