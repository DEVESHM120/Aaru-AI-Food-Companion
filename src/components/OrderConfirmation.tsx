"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { OrderDetails } from "@/lib/types";

interface OrderConfirmationProps {
  order: OrderDetails | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const platformBadge: Record<string, { bg: string; label: string }> = {
  swiggy: { bg: "#FC8019", label: "Swiggy" },
};

const AUTO_CONFIRM_SECONDS = 5;

export default function OrderConfirmation({ order, onConfirm, onCancel }: OrderConfirmationProps) {
  const [countdown, setCountdown] = useState(AUTO_CONFIRM_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!order) {
      setCountdown(AUTO_CONFIRM_SECONDS);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (order.autonomous) {
      setCountdown(AUTO_CONFIRM_SECONDS);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            onConfirm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [order, onConfirm]);

  return (
    <AnimatePresence>
      {order && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed inset-x-4 bottom-8 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-8 sm:w-96 rounded-3xl z-50 overflow-hidden"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            {/* Auto-confirm progress bar */}
            {order.autonomous && (
              <motion.div
                className="h-0.5"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: AUTO_CONFIRM_SECONDS, ease: "linear" }}
                style={{ background: "linear-gradient(135deg, #FF4500, #FF7A00)" }}
              />
            )}

            {/* Header */}
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                    {order.autonomous ? "Auto-ordering in..." : "Confirm Order"}
                  </p>
                  <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>{order.restaurant.name}</h2>
                  <span
                    className="inline-block text-xs font-semibold text-white px-2 py-0.5 rounded-full mt-1"
                    style={{ backgroundColor: (platformBadge[order.platform] ?? platformBadge.swiggy).bg }}
                  >
                    via {(platformBadge[order.platform] ?? platformBadge.swiggy).label}
                  </span>
                </div>
                {order.autonomous && (
                  <motion.div
                    key={countdown}
                    initial={{ scale: 1.3, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
                  >
                    <span className="text-xl font-bold" style={{ color: "var(--text)" }}>{countdown}</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="px-5 py-4 space-y-3">
              <Row label="Item" value={order.item} />
              <Row label="Amount" value={`₹${order.price}`} bold />
              <Row label="Delivery in" value={`~${order.estimatedDelivery} min`} />
              {order.deliveryAddress ? (
                <Row
                  label="Deliver to"
                  value={`${order.deliveryAddress.label} — ${shortLocation(order.deliveryAddress.locationName)}`}
                />
              ) : (
                <Row label="Deliver to" value="Default address" muted />
              )}
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,69,0,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                {order.autonomous ? "Stop ✋" : "Cancel"}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #FF4500, #FF7A00)" }}
              >
                {order.autonomous ? "Order Now 🚀" : "Place Order 🎉"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between text-sm" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className={bold ? "font-bold" : "font-medium"}
        style={{ color: muted ? "var(--text-muted)" : "var(--text)" }}
      >
        {value}
      </span>
    </div>
  );
}

function shortLocation(locationName: string): string {
  const parts = locationName.split(",");
  return parts.slice(0, 2).join(",").trim();
}
