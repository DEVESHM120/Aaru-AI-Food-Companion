"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function TrialLimitModal({ open, onClose }: Props) {
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
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-5"
            initial={{ opacity: 0, scale: 0.93, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-7 flex flex-col gap-5 shadow-2xl text-center"
              style={{ backgroundColor: "var(--bg-card, #FFFFFF)", border: "1px solid var(--border, #E7E5E4)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl">🎉</div>

              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold" style={{ color: "var(--text-primary, #1C1917)" }}>
                  You&apos;ve explored Aaru!
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary, #78716C)" }}>
                  You&apos;ve used all 25 trial messages. Aaru is currently a <strong>trial build</strong> made for Swiggy&apos;s review process.
                </p>
              </div>

              <div
                className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                style={{ backgroundColor: "var(--bg-primary, #FAFAF9)", border: "1px solid var(--border, #E7E5E4)", color: "var(--text-secondary, #78716C)" }}
              >
                The full version is launching soon — with <strong style={{ color: "var(--text-primary, #1C1917)" }}>complete voice ordering</strong> from your own Swiggy account. Swiggy is currently reviewing Aaru&apos;s MCP integration that powers real ordering.
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "var(--accent, #D97706)", color: "#FFFFFF" }}
              >
                Got it, I&apos;m excited!
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
