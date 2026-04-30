"use client";

import { motion } from "framer-motion";
import { OrderStatusBlock } from "@/lib/types";

interface Props {
  order: OrderStatusBlock;
  onViewInApp: () => void;
  onDismiss: () => void;
}

const STEPS: OrderStatusBlock["status"][] = ["accepted", "preparing", "picked_up", "on_the_way", "delivered"];

const STEP_LABELS: Record<OrderStatusBlock["status"], string> = {
  accepted: "Accepted",
  preparing: "Preparing",
  picked_up: "Picked up",
  on_the_way: "On the way",
  delivered: "Delivered!",
};

const STEP_EMOJI: Record<OrderStatusBlock["status"], string> = {
  accepted: "✅",
  preparing: "👨‍🍳",
  picked_up: "🛵",
  on_the_way: "🚀",
  delivered: "🎉",
};

const platformColor = { zomato: "#E23744", swiggy: "#FC8019" };

export default function OrderTracker({ order, onViewInApp, onDismiss }: Props) {
  const currentIndex = STEPS.indexOf(order.status);
  const color = platformColor[order.platform] ?? "#FF7A00";

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 300 }}
      className="mx-4 mb-2 rounded-2xl overflow-hidden shadow-lg"
      style={{ backgroundColor: "var(--surface)", border: `1px solid ${color}33` }}
    >
      <div
        className="px-4 py-3"
        style={{ background: `linear-gradient(135deg, ${color}15, ${color}05)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{STEP_EMOJI[order.status]}</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                {STEP_LABELS[order.status]}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {order.status !== "delivered" ? `~${order.eta} min away` : "Enjoy your meal!"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewInApp}
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}33` }}
            >
              Track
            </button>
            <button
              onClick={onDismiss}
              className="text-xs px-2 py-1.5 rounded-full"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const done = i <= currentIndex;
            const active = i === currentIndex;
            return (
              <div key={step} className="flex items-center flex-1">
                <div
                  className="flex-1 h-1 rounded-full transition-all duration-500"
                  style={{ backgroundColor: done ? color : "var(--border)" }}
                />
                {i < STEPS.length - 1 && (
                  <motion.div
                    animate={active ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                    transition={{ repeat: active ? Infinity : 0, duration: 1.5 }}
                    className="w-2.5 h-2.5 rounded-full mx-0.5 flex-shrink-0"
                    style={{ backgroundColor: done ? color : "var(--border)" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step labels */}
        <div className="flex justify-between mt-1">
          {STEPS.map((step, i) => (
            <span
              key={step}
              className="text-center flex-1"
              style={{
                fontSize: "8px",
                color: i <= currentIndex ? color : "var(--text-muted)",
                fontWeight: i === currentIndex ? "700" : "400",
              }}
            >
              {STEP_LABELS[step].split(" ")[0]}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
