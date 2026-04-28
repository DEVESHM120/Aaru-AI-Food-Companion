"use client";

import { motion } from "framer-motion";

const TRIAL_LIMIT = 50;

interface Props {
  used: number;
  onUpgrade: () => void;
}

export default function TrialBanner({ used, onUpgrade }: Props) {
  const remaining = Math.max(0, TRIAL_LIMIT - used);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
      style={{
        background: "linear-gradient(90deg, rgba(217,119,6,0.12) 0%, rgba(245,158,11,0.08) 100%)",
        borderBottom: "1px solid rgba(217,119,6,0.2)",
      }}
    >
      <div className="flex items-center gap-2">
        <span>⚡</span>
        <span style={{ color: "var(--text-muted, #78716C)" }}>
          <span className="font-semibold" style={{ color: "var(--accent, #D97706)" }}>
            {remaining} free {remaining === 1 ? "message" : "messages"}
          </span>{" "}
          remaining in trial
        </span>
        {/* progress dots */}
        <div className="hidden sm:flex gap-1 ml-1">
          {Array.from({ length: TRIAL_LIMIT }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all"
              style={{ backgroundColor: i < used ? "var(--accent, #D97706)" : "var(--border, #E7E5E4)" }}
            />
          ))}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onUpgrade}
        className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full transition-all"
        style={{ backgroundColor: "var(--accent, #D97706)", color: "#fff" }}
      >
        Set up full access →
      </motion.button>
    </motion.div>
  );
}
