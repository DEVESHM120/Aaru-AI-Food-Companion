import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const CLIENT_ID = process.env.ZOMATO_MCP_CLIENT_ID;
// Update AUTHORIZE_URL once Zomato developer portal provides OAuth endpoint
const AUTHORIZE_URL = process.env.ZOMATO_MCP_AUTH_URL ?? "https://www.zomato.com/oauth/authorize";
const REDIRECT_URI = "https://aaru-food-companion.vercel.app/api/auth/zomato/callback";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function GET(req: NextRequest) {
  if (!CLIENT_ID) {
    return NextResponse.redirect(new URL("/chat?zomato_error=not_configured", req.url));
  }

  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(Buffer.from(crypto.createHash("sha256").update(verifier).digest()));
  const state = base64url(crypto.randomBytes(16));

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "mcp:tools");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("zomato_pkce_verifier", verifier, { httpOnly: true, maxAge: 300, path: "/" });
  res.cookies.set("zomato_state", state, { httpOnly: true, maxAge: 300, path: "/" });
  return res;
}
