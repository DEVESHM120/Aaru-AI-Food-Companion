import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const CLIENT_ID = process.env.SWIGGY_MCP_CLIENT_ID;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL ?? "https://aaru-food-companion.vercel.app"}/api/auth/swiggy/callback`;

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function GET(req: NextRequest) {
  if (!CLIENT_ID) {
    // OAuth not configured — redirect back with error flag
    return NextResponse.redirect(new URL("/chat?swiggy_error=not_configured", req.url));
  }

  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(Buffer.from(crypto.createHash("sha256").update(verifier).digest()));
  const state = base64url(crypto.randomBytes(16));

  const authUrl = new URL("https://mcp.swiggy.com/auth/authorize");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "mcp:tools");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("swiggy_pkce_verifier", verifier, { httpOnly: true, maxAge: 300, path: "/" });
  res.cookies.set("swiggy_state", state, { httpOnly: true, maxAge: 300, path: "/" });
  return res;
}
