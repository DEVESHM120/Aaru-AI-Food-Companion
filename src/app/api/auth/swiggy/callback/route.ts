import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.SWIGGY_MCP_CLIENT_ID;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL ?? "https://aaru-food-companion.vercel.app"}/api/auth/swiggy/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/chat?swiggy_error=${error ?? "no_code"}`, req.url));
  }

  const verifier = req.cookies.get("swiggy_pkce_verifier")?.value;
  const expectedState = req.cookies.get("swiggy_state")?.value;
  if (!verifier || !CLIENT_ID) {
    return NextResponse.redirect(new URL("/chat?swiggy_error=session_expired", req.url));
  }
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/chat?swiggy_error=invalid_state", req.url));
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
    const expiresIn = Number(data.expires_in ?? 432000);
    const expiresAt = Date.now() + expiresIn * 1000;
    const scope = typeof data.scope === "string" ? data.scope : "";

    const redirect = new URL("/chat", req.url);
    redirect.searchParams.set("swiggy_token", token);
    redirect.searchParams.set("swiggy_expires_at", String(expiresAt));
    if (scope) redirect.searchParams.set("swiggy_scope", scope);

    const res = NextResponse.redirect(redirect);
    res.cookies.delete("swiggy_pkce_verifier");
    res.cookies.delete("swiggy_state");
    return res;
  } catch (err) {
    console.error("Swiggy OAuth callback error:", err);
    return NextResponse.redirect(new URL("/chat?swiggy_error=token_exchange_failed", req.url));
  }
}
