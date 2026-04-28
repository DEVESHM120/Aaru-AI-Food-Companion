"use client";

import { motion } from "framer-motion";

export default function AIThinking() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-end gap-2 px-4"
    >
      <div
        className="flex items-center gap-3 rounded-2xl rounded-bl-sm px-4 py-3"
        style={{ backgroundColor: "var(--bubble-ai-bg)", border: "1px solid var(--bubble-ai-border)" }}
      >
        <span className="block text-xs font-semibold tracking-wide" style={{ color: "var(--accent)" }}>
          aaru
        </span>
        <div className="flex gap-1 items-center">
          <span className="dot-1 w-1.5 h-1.5 rounded-full block" style={{ backgroundColor: "var(--accent)" }} />
          <span className="dot-2 w-1.5 h-1.5 rounded-full block" style={{ backgroundColor: "var(--accent)" }} />
          <span className="dot-3 w-1.5 h-1.5 rounded-full block" style={{ backgroundColor: "var(--accent)" }} />
        </div>
        <motion.span
          className="text-sm"
          style={{ color: "var(--text-muted)" }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          deciding...
        </motion.span>
      </div>
    </motion.div>
  );
}
