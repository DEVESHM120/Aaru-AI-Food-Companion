"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CartBlock } from "@/lib/types";

interface Props {
  cart: CartBlock;
  onCheckout: () => void;
  onClear: () => void;
}

export default function CartDrawer({ cart, onCheckout, onClear }: Props) {
  const color = "#FC8019";
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        key="cart-drawer"
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 18, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed left-3 right-3 z-30 rounded-2xl shadow-2xl"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 86px)",
          backgroundColor: "var(--bg)",
          border: "1px solid var(--border)",
          maxWidth: 456,
          margin: "0 auto",
        }}
      >
        <div className="px-3 py-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="min-w-0 flex-1 text-left"
              aria-label={isExpanded ? "Collapse cart" : "Expand cart"}
            >
              <p className="truncate text-sm font-bold" style={{ color: "var(--text)" }}>
                Your Cart
              </p>
              <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                {cart.restaurantName} ·{" "}
                <span className="font-semibold" style={{ color }}>
                  {cart.platform.charAt(0).toUpperCase() + cart.platform.slice(1)}
                </span>
              </p>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="rounded-full px-3 py-1.5 text-xs"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                {isExpanded ? "Hide" : "Items"}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="rounded-full px-3 py-1.5 text-xs"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Clear
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mb-2 max-h-[28vh] space-y-2 overflow-y-auto pr-1">
                  {cart.items.map((item, i) => (
                    <div
                      key={`${item.dishName}-${i}`}
                      className="flex items-center justify-between rounded-xl px-3 py-2"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.isVeg ? "#22C55E" : "#EF4444" }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                            {item.dishName}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Qty: {item.qty}
                          </p>
                        </div>
                      </div>
                      <span className="ml-2 shrink-0 text-sm font-semibold" style={{ color }}>
                        Rs {item.price * item.qty}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            <div
              className="flex min-w-0 flex-1 items-center justify-between rounded-xl px-3 py-2.5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Total
              </span>
              <span className="text-base font-bold" style={{ color: "var(--text)" }}>
                Rs {cart.total}
              </span>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onCheckout}
              className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
            >
              Checkout
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
