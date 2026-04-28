"use client";

import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /FBAN|FBAV|Instagram|Twitter|LinkedInApp|WhatsApp|Snapchat|TikTok|Line\/|MicroMessenger/i.test(ua) ||
    (/Android/i.test(ua) && /wv\b/.test(ua)) // Android WebView
  );
}

export default function LoginPage() {
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "https://aaru-food-companion.vercel.app/login";

  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{ backgroundColor: "var(--bg-primary, #FAFAF9)" }}
      className="min-h-screen flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm flex flex-col items-center gap-8"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-6xl">🍽️</div>
          <div className="flex flex-col items-center gap-1">
            <h1
              className="text-4xl font-bold tracking-tight"
              style={{ color: "var(--text-primary, #1C1917)" }}
            >
              Aaru
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary, #78716C)" }}>
              Your AI food companion
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="w-full rounded-2xl p-8 flex flex-col gap-6 shadow-sm"
          style={{
            backgroundColor: "var(--bg-card, #FFFFFF)",
            border: "1px solid var(--border, #E7E5E4)",
          }}
        >
          {inApp ? (
            /* ── In-app browser warning ── */
            <>
              <div className="flex flex-col gap-2 text-center">
                <div className="text-3xl">🌐</div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary, #1C1917)" }}>
                  Open in Chrome or Safari
                </h2>
                <p className="text-sm" style={{ color: "var(--text-secondary, #78716C)" }}>
                  Google sign-in doesn&apos;t work inside WhatsApp, Instagram, or other apps. Open this link in your browser to continue.
                </p>
              </div>

              <div
                className="rounded-xl px-3 py-2.5 text-xs font-mono break-all"
                style={{
                  backgroundColor: "var(--bg-primary, #FAFAF9)",
                  border: "1px solid var(--border, #E7E5E4)",
                  color: "var(--text-secondary, #78716C)",
                }}
              >
                {url}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCopy}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "var(--accent, #D97706)", color: "#FFFFFF" }}
              >
                {copied ? "Copied ✓" : "Copy link"}
              </motion.button>

              <p className="text-xs text-center" style={{ color: "var(--text-muted, #A8A29E)" }}>
                Paste in Chrome or Safari → sign in there
              </p>
            </>
          ) : (
            /* ── Normal login ── */
            <>
              <div className="flex flex-col gap-1 text-center">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary, #1C1917)" }}>
                  Sign in to continue
                </h2>
                <p className="text-sm" style={{ color: "var(--text-secondary, #78716C)" }}>
                  Tell Aaru what you&apos;re craving — it&apos;ll handle the rest.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => signIn("google", { callbackUrl: "/chat" })}
                className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-medium text-sm transition-all"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  color: "#374151",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                <GoogleIcon />
                Continue with Google
              </motion.button>
            </>
          )}
        </div>

        <p className="text-xs text-center" style={{ color: "var(--text-muted, #A8A29E)" }}>
          By signing in you agree to use this app responsibly.
        </p>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
