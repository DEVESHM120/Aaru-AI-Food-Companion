import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.ZOMATO_MCP_CLIENT_ID;
const TOKEN_URL = process.env.ZOMATO_MCP_TOKEN_URL ?? "https://www.zomato.com/oauth/token";
const REDIRECT_URI = "https://aaru-food-companion.vercel.app/api/auth/zomato/callback";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/chat?zomato_error=${error ?? "no_code"}`, req.url));
  }

  const verifier = req.cookies.get("zomato_pkce_verifier")?.value;
  if (!verifier || !CLIENT_ID) {
    return NextResponse.redirect(new URL("/chat?zomato_error=session_expired", req.url));
  }

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const data = await tokenRes.json();
    const token: string = data.access_token;

    const res = NextResponse.redirect(new URL(`/chat?zomato_token=${encodeURIComponent(token)}`, req.url));
    res.cookies.delete("zomato_pkce_verifier");
    res.cookies.delete("zomato_state");
    return res;
  } catch (err) {
    console.error("Zomato OAuth callback error:", err);
    return NextResponse.redirect(new URL("/chat?zomato_error=token_exchange_failed", req.url));
  }
}
