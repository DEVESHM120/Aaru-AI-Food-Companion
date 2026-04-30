"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CartBlock } from "@/lib/types";

interface Props {
  cart: CartBlock;
  onCheckout: () => void;
  onClear: () => void;
}

const platformColor = { zomato: "#E23744", swiggy: "#FC8019" };

export default function CartDrawer({ cart, onCheckout, onClear }: Props) {
  const color = platformColor[cart.platform] ?? "#FF7A00";

  return (
    <AnimatePresence>
      <motion.div
        key="cart-drawer"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl shadow-2xl pb-safe"
        style={{ backgroundColor: "var(--bg)", borderTop: "1px solid var(--border)", maxWidth: 480, margin: "0 auto" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--border)" }} />
        </div>

        <div className="px-4 pb-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-base" style={{ color: "var(--text)" }}>Your Cart</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {cart.restaurantName} · <span className="font-semibold" style={{ color }}>{cart.platform.charAt(0).toUpperCase() + cart.platform.slice(1)}</span>
              </p>
            </div>
            <button
              onClick={onClear}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              Clear
            </button>
          </div>

          {/* Items */}
          <div className="space-y-2 mb-4">
            {cart.items.map((item, i) => (
              <div
                key={`${item.dishName}-${i}`}
                className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.isVeg ? "#22C55E" : "#EF4444" }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{item.dishName}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Qty: {item.qty}</p>
                  </div>
                </div>
                <span className="font-semibold text-sm ml-2 flex-shrink-0" style={{ color }}>₹{item.price * item.qty}</span>
              </div>
            ))}
          </div>

          {/* Total + CTA */}
          <div
            className="flex items-center justify-between py-3 px-3 rounded-xl mb-3"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <span className="font-medium text-sm" style={{ color: "var(--text-muted)" }}>Total</span>
            <span className="font-bold text-lg" style={{ color: "var(--text)" }}>₹{cart.total}</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onCheckout}
            className="w-full py-3.5 rounded-xl font-bold text-white text-base"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
          >
            Place Order via {cart.platform.charAt(0).toUpperCase() + cart.platform.slice(1)} →
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
