"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onAddKey: () => void;
  onClose: () => void;
}

export default function TrialPaywall({ open, onAddKey, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "linear-gradient(135deg, #FF7A00, #FF3C78)" }}>
                🍽️
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                  5 trial orders done!
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  You&apos;ve used all your free trial orders. Add your Anthropic key to keep ordering with full access — no limits, no paywalls.
                </p>
              </div>
            </div>

            {/* What you get */}
            <div className="rounded-2xl p-4 flex flex-col gap-2"
              style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {[
                "Unlimited orders via Swiggy & Zomato",
                "Real-time cart & order tracking",
                "Instamart grocery delivery",
                "Dineout restaurant booking",
                "Voice mode + AI food memory",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
                  <span className="text-green-500 font-bold">✓</span> {f}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onAddKey}
                className="w-full py-3.5 rounded-2xl text-sm font-bold"
                style={{ background: "linear-gradient(135deg, #FF7A00, #FF3C78)", color: "#fff" }}
              >
                Add Anthropic Key — Unlock Full Access
              </motion.button>
              <button
                onClick={onClose}
                className="text-xs text-center"
                style={{ color: "var(--text-muted)" }}
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
