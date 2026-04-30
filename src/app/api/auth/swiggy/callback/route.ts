import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.SWIGGY_MCP_CLIENT_ID;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL ?? "https://aaru-food-companion.vercel.app"}/api/auth/swiggy/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/chat?swiggy_error=${error ?? "no_code"}`, req.url));
  }

  const verifier = req.cookies.get("swiggy_pkce_verifier")?.value;
  if (!verifier || !CLIENT_ID) {
    return NextResponse.redirect(new URL("/chat?swiggy_error=session_expired", req.url));
  }

  try {
    const tokenRes = await fetch("https://mcp.swiggy.com/auth/token", {
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

    const res = NextResponse.redirect(new URL(`/chat?swiggy_token=${encodeURIComponent(token)}`, req.url));
    res.cookies.delete("swiggy_pkce_verifier");
    res.cookies.delete("swiggy_state");
    return res;
  } catch (err) {
    console.error("Swiggy OAuth callback error:", err);
    return NextResponse.redirect(new URL("/chat?swiggy_error=token_exchange_failed", req.url));
  }
}
