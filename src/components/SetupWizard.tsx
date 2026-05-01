"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface UserKeys {
  anthropicKey: string;
  elevenLabsKey: string;
  swiggyToken: string;
  swiggyExpiresAt?: number;
  swiggyScope?: string;
  zomatoToken?: string;
  tier: "trial" | "full";
}

const STORAGE_KEY = "aaru-user-keys";

function defaultKeys(): UserKeys {
  return { anthropicKey: "", elevenLabsKey: "", swiggyToken: "", tier: "trial" };
}

function loadKeys(): UserKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultKeys(), ...JSON.parse(raw) };
  } catch {}
  return defaultKeys();
}

interface Props {
  open: boolean;
  onClose: (keys: UserKeys) => void;
  initialStep?: number;
}

export default function SetupWizard({ open, onClose }: Props) {
  const [keys, setKeys] = useState<UserKeys>(loadKeys);

  useEffect(() => {
    if (!open) return;
    setKeys(loadKeys());
  }, [open]);

  const finishDemo = () => {
    const next = { ...keys, tier: "trial" as const };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem("aaru-setup-seen", "1");
    onClose(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
              <div className="p-7 flex flex-col gap-6">
                <div className="text-center">
                  <div className="text-4xl mb-3">Aaru</div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--text, #1C1917)" }}>Demo mode</h2>
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted, #78716C)" }}>
                    Explore the chat, suggestions, and order flow now. Swiggy access can be added later when approvals land.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={finishDemo}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm"
                    style={{ backgroundColor: "#FC8019", color: "#fff" }}
                  >
                    Start demo
                  </button>
                  <p className="text-xs text-center" style={{ color: "var(--text-muted, #78716C)" }}>
                    This build will work without Swiggy auth.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
