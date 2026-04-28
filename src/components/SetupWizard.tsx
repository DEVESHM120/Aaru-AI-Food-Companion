"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface UserKeys {
  anthropicKey: string;
  elevenLabsKey: string;
  zomatoToken: string;
  swiggyToken: string;
  tier: "trial" | "full";
}

const STORAGE_KEY = "aaru-user-keys";

function loadKeys(): UserKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { anthropicKey: "", elevenLabsKey: "", zomatoToken: "", swiggyToken: "", tier: "trial", ...JSON.parse(raw) };
  } catch {}
  return { anthropicKey: "", elevenLabsKey: "", zomatoToken: "", swiggyToken: "", tier: "trial" };
}

interface Props {
  open: boolean;
  onClose: (keys: UserKeys) => void;
  initialStep?: number;
}

type Step = "welcome" | "zomato" | "swiggy" | "anthropic" | "done";

export default function SetupWizard({ open, onClose, initialStep }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [keys, setKeys] = useState<UserKeys>(loadKeys);
  const [anthropicInput, setAnthropicInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [swiggyConfigured] = useState(!!process.env.NEXT_PUBLIC_SWIGGY_OAUTH);
  const [zomatoConfigured] = useState(!!process.env.NEXT_PUBLIC_ZOMATO_OAUTH);

  useEffect(() => {
    if (open) {
      const loaded = loadKeys();
      setKeys(loaded);
      setAnthropicInput(loaded.anthropicKey);
      setTestResult(null);
      setStep(initialStep === 1 ? "zomato" : "welcome");
    }
  }, [open, initialStep]);

  const save = (updated: Partial<UserKeys>) => {
    const next = { ...keys, ...updated };
    setKeys(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  };

  const handleTryFree = () => {
    const next = save({ tier: "trial" });
    localStorage.setItem("aaru-setup-seen", "1");
    onClose(next);
  };

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicKey: anthropicInput.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ valid: false, error: "Network error" });
    }
    setTesting(false);
  };

  const handleSaveAnthropicAndFinish = () => {
    const next = save({ anthropicKey: anthropicInput.trim(), tier: "full" });
    localStorage.setItem("aaru-setup-seen", "1");
    setStep("done");
    setTimeout(() => onClose(next), 1800);
  };

  const handleSkipToChat = () => {
    const next = save({ tier: "full" });
    localStorage.setItem("aaru-setup-seen", "1");
    onClose(next);
  };

  const hasZomato = !!keys.zomatoToken;
  const hasSwiggy = !!keys.swiggyToken;
  const hasAnthropicKey = !!(anthropicInput.trim() || keys.anthropicKey);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              style={{ backgroundColor: "var(--surface, #FFFFFF)", border: "1px solid var(--border, #E7E5E4)" }}
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
            >
              {/* ── Welcome ── */}
              {step === "welcome" && (
                <div className="p-7 flex flex-col gap-6">
                  <div className="text-center">
                    <div className="text-4xl mb-3">🍽️</div>
                    <h2 className="text-xl font-bold" style={{ color: "var(--text, #1C1917)" }}>Welcome to Aaru</h2>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted, #78716C)" }}>
                      Your AI food companion. How do you want to start?
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Try free card */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleTryFree}
                      className="w-full text-left p-4 rounded-xl border-2 transition-all"
                      style={{ borderColor: "var(--border, #E7E5E4)", backgroundColor: "var(--surface-2, #F5F4F2)" }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">⚡</span>
                        <div>
                          <div className="font-semibold text-sm" style={{ color: "var(--text, #1C1917)" }}>Try free — 50 messages + voice</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted, #78716C)" }}>No setup needed. Full AI + voice experience.</div>
                        </div>
                      </div>
                    </motion.button>

                    {/* Full setup card */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStep("zomato")}
                      className="w-full text-left p-4 rounded-xl border-2 transition-all"
                      style={{ borderColor: "var(--accent, #D97706)", backgroundColor: "rgba(217,119,6,0.04)" }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🚀</span>
                        <div>
                          <div className="font-semibold text-sm" style={{ color: "var(--accent, #D97706)" }}>Full setup — real ordering</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted, #78716C)" }}>Connect Zomato & Swiggy. Order real food to your address.</div>
                        </div>
                      </div>
                    </motion.button>
                  </div>
                </div>
              )}

              {/* ── Zomato ── */}
              {step === "zomato" && (
                <div className="p-7 flex flex-col gap-5">
                  <StepHeader step={1} total={3} title="Connect Zomato" emoji="🍕" onBack={() => setStep("welcome")} />
                  <p className="text-sm" style={{ color: "var(--text-muted, #78716C)" }}>
                    Enter your Zomato phone number → get OTP → done. No password, no token copying.
                  </p>

                  {hasZomato ? (
                    <StatusBadge ok label="Zomato connected" />
                  ) : zomatoConfigured ? (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { window.location.href = "/api/auth/zomato/start"; }}
                      className="w-full py-3 rounded-xl font-semibold text-sm"
                      style={{ backgroundColor: "#E23744", color: "#fff" }}
                    >
                      Connect Zomato →
                    </motion.button>
                  ) : (
                    <ComingSoonBox
                      platform="Zomato"
                      applyUrl="https://www.zomato.com/developer"
                    />
                  )}

                  <SkipNext label="Skip Zomato" onSkip={() => setStep("swiggy")} onNext={() => setStep("swiggy")} nextLabel="Next →" />
                </div>
              )}

              {/* ── Swiggy ── */}
              {step === "swiggy" && (
                <div className="p-7 flex flex-col gap-5">
                  <StepHeader step={2} total={3} title="Connect Swiggy" emoji="🛵" onBack={() => setStep("zomato")} />
                  <p className="text-sm" style={{ color: "var(--text-muted, #78716C)" }}>
                    Enter your Swiggy phone number → OTP → connects Food, Instamart & Dineout in one shot.
                  </p>

                  {hasSwiggy ? (
                    <StatusBadge ok label="Swiggy connected" />
                  ) : swiggyConfigured ? (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { window.location.href = "/api/auth/swiggy/start"; }}
                      className="w-full py-3 rounded-xl font-semibold text-sm"
                      style={{ backgroundColor: "#FC8019", color: "#fff" }}
                    >
                      Connect Swiggy →
                    </motion.button>
                  ) : (
                    <ComingSoonBox
                      platform="Swiggy"
                      applyUrl="https://mcp.swiggy.com/builders/access/"
                    />
                  )}

                  <SkipNext label="Skip Swiggy" onSkip={() => setStep("anthropic")} onNext={() => setStep("anthropic")} nextLabel="Next →" />
                </div>
              )}

              {/* ── Anthropic key ── */}
              {step === "anthropic" && (
                <div className="p-7 flex flex-col gap-5">
                  <StepHeader step={3} total={3} title="Unlimited AI chat" emoji="🤖" onBack={() => setStep("swiggy")} />
                  <p className="text-sm" style={{ color: "var(--text-muted, #78716C)" }}>
                    Optional but recommended. Free to sign up — you get <strong>$5 in free credits</strong> to start.
                  </p>

                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium underline"
                    style={{ color: "var(--accent, #D97706)" }}
                  >
                    Open Anthropic Console →
                  </a>

                  <div className="flex flex-col gap-2">
                    <input
                      type="password"
                      value={anthropicInput}
                      onChange={(e) => { setAnthropicInput(e.target.value); setTestResult(null); }}
                      placeholder="sk-ant-..."
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
                      style={{ backgroundColor: "var(--surface-2, #F5F4F2)", border: "1px solid var(--border, #E7E5E4)", color: "var(--text, #1C1917)" }}
                    />

                    {testResult && (
                      <p className="text-xs font-medium" style={{ color: testResult.valid ? "#16A34A" : "#DC2626" }}>
                        {testResult.valid ? "✓ Key is valid" : `✗ ${testResult.error}`}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleTestKey}
                        disabled={!anthropicInput.trim() || testing}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                        style={{ backgroundColor: "var(--surface-2, #F5F4F2)", border: "1px solid var(--border, #E7E5E4)", color: "var(--text, #1C1917)" }}
                      >
                        {testing ? "Testing..." : "Test key"}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSaveAnthropicAndFinish}
                        disabled={!testResult?.valid}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                        style={{ backgroundColor: "var(--accent, #D97706)", color: "#fff" }}
                      >
                        Save & finish
                      </motion.button>
                    </div>
                  </div>

                  <button
                    onClick={handleSkipToChat}
                    className="text-xs text-center underline"
                    style={{ color: "var(--text-muted, #78716C)" }}
                  >
                    Skip — use 50 free messages instead
                  </button>
                </div>
              )}

              {/* ── Done ── */}
              {step === "done" && (
                <div className="p-7 flex flex-col items-center gap-4 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12 }} className="text-5xl">✅</motion.div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text, #1C1917)" }}>You're all set!</h2>
                  <div className="flex flex-col gap-1.5 text-sm w-full">
                    <CapabilityRow ok={hasZomato} label="Real Zomato ordering" />
                    <CapabilityRow ok={hasSwiggy} label="Real Swiggy ordering" />
                    <CapabilityRow ok={hasAnthropicKey} label="Unlimited AI chat" />
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted, #78716C)" }}>Taking you to Aaru…</p>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function StepHeader({ step, total, title, emoji, onBack }: { step: number; total: number; title: string; emoji: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="text-lg opacity-50 hover:opacity-100 transition-opacity">←</button>
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <div className="text-xs font-medium" style={{ color: "var(--text-muted, #78716C)" }}>Step {step} of {total}</div>
        <div className="text-base font-bold" style={{ color: "var(--text, #1C1917)" }}>{title}</div>
      </div>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: ok ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", color: ok ? "#16A34A" : "#DC2626" }}>
      {ok ? "✓" : "✗"} {label}
    </div>
  );
}

function CapabilityRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span style={{ color: ok ? "#16A34A" : "var(--text-muted, #78716C)" }}>{ok ? "✓" : "–"}</span>
      <span style={{ color: ok ? "var(--text, #1C1917)" : "var(--text-muted, #78716C)" }}>{label}</span>
    </div>
  );
}

function SkipNext({ label, onSkip, onNext, nextLabel }: { label: string; onSkip: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex gap-2 pt-1">
      <button onClick={onSkip} className="flex-1 py-2 text-sm rounded-xl" style={{ color: "var(--text-muted, #78716C)", border: "1px solid var(--border, #E7E5E4)" }}>
        {label}
      </button>
      <motion.button whileTap={{ scale: 0.97 }} onClick={onNext} className="flex-1 py-2 text-sm font-semibold rounded-xl" style={{ backgroundColor: "var(--accent, #D97706)", color: "#fff" }}>
        {nextLabel}
      </motion.button>
    </div>
  );
}

function ComingSoonBox({ platform, applyUrl }: { platform: string; applyUrl: string; note?: string; token?: string; onToken?: (t: string) => void }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: "var(--surface-2, #F5F4F2)", border: "1px solid var(--border, #E7E5E4)" }}>
      <div className="flex items-center gap-2">
        <span className="text-base">📱</span>
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text, #1C1917)" }}>Phone + OTP — coming soon</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted, #78716C)" }}>
            You'll just enter your {platform} phone number and verify with OTP — no token copying needed.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: "rgba(217,119,6,0.08)", color: "var(--accent, #D97706)" }}>
        <span>⏳</span>
        <span>Waiting on {platform} developer access</span>
        <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="ml-auto font-semibold underline">
          Apply →
        </a>
      </div>
    </div>
  );
}
