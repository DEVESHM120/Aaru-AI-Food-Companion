"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { UserKeys } from "@/components/SetupWizard";

export type { UserKeys };

const STORAGE_KEY = "aaru-user-keys";

function loadKeys(): UserKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { anthropicKey: "", elevenLabsKey: "", swiggyToken: "", tier: "trial" as const, ...JSON.parse(raw) };
  } catch {}
  return { anthropicKey: "", elevenLabsKey: "", swiggyToken: "", tier: "trial" as const };
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return key;
  return "********" + key.slice(-4);
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (keys: UserKeys) => void;
}

export default function SettingsModal({ open, onClose, onSave }: Props) {
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    const keys = loadKeys();
    setElevenLabsKey(keys.elevenLabsKey);
    setSaved(false);
  }, [open]);

  const handleSave = () => {
    const existing = loadKeys();
    const keys: UserKeys = { ...existing, elevenLabsKey: elevenLabsKey.trim() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    onSave(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div
              className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-xl"
              style={{ backgroundColor: "var(--bg-card, #FFFFFF)", border: "1px solid var(--border, #E7E5E4)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary, #1C1917)" }}>
                    Settings
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary, #78716C)" }}>
                    Demo-first mode. Swiggy auth will come back after access is approved.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-xl leading-none p-1 rounded-lg hover:opacity-60 transition-opacity"
                  style={{ color: "var(--text-secondary, #78716C)" }}
                >
                  x
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" style={{ color: "var(--text-primary, #1C1917)" }}>
                    ElevenLabs Key <span className="font-normal text-xs" style={{ color: "var(--text-muted, #A8A29E)" }}>(optional voice)</span>
                  </label>
                  <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: "var(--accent, #D97706)" }}>
                    Get key
                  </a>
                </div>
                <input
                  type="password"
                  value={elevenLabsKey}
                  onChange={(e) => setElevenLabsKey(e.target.value)}
                  placeholder="sk_..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none transition-all"
                  style={{ backgroundColor: "var(--bg-primary, #FAFAF9)", border: "1px solid var(--border, #E7E5E4)", color: "var(--text-primary, #1C1917)" }}
                />
                {elevenLabsKey && (
                  <p className="text-xs" style={{ color: "var(--text-muted, #A8A29E)" }}>
                    Set: {maskKey(elevenLabsKey)}
                  </p>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ backgroundColor: "var(--accent, #D97706)", color: "#FFFFFF" }}
              >
                {saved ? "Saved" : "Save settings"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
