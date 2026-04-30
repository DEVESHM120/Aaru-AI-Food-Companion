"use client";

import { motion } from "framer-motion";

const MSG_LIMIT = 50;
const ORDER_LIMIT = 5;

interface Props {
  used: number;
  ordersUsed?: number;
  onUpgrade: () => void;
}

export default function TrialBanner({ used, ordersUsed = 0, onUpgrade }: Props) {
  const msgsLeft = Math.max(0, MSG_LIMIT - used);
  const ordersLeft = Math.max(0, ORDER_LIMIT - ordersUsed);

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
      <div className="flex items-center gap-3">
        <span>⚡</span>
        <span style={{ color: "var(--text-muted, #78716C)" }}>
          <span className="font-semibold" style={{ color: "var(--accent, #D97706)" }}>
            {msgsLeft} {msgsLeft === 1 ? "msg" : "msgs"}
          </span>{" "}
          &{" "}
          <span className="font-semibold" style={{ color: ordersLeft <= 1 ? "#EF4444" : "var(--accent, #D97706)" }}>
            {ordersLeft} {ordersLeft === 1 ? "order" : "orders"}
          </span>{" "}
          left in trial
        </span>
      </div>

      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onUpgrade}
        className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full transition-all"
        style={{ backgroundColor: "var(--accent, #D97706)", color: "#fff" }}
      >
        Unlock full access →
      </motion.button>
    </motion.div>
  );
}
