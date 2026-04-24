"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { OrderDetails } from "@/lib/types";

interface OrderConfirmationProps {
  order: OrderDetails | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const platformConfig = {
  zomato: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", btn: "bg-red-500 hover:bg-red-600", progress: "bg-red-400" },
  swiggy: { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", btn: "bg-orange-500 hover:bg-orange-600", progress: "bg-orange-400" },
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onCancel}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed inset-x-4 bottom-8 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-8 sm:w-96 bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Auto-confirm progress bar */}
            {order.autonomous && (
              <motion.div
                className={`h-1 ${platformConfig[order.platform].progress}`}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: AUTO_CONFIRM_SECONDS, ease: "linear" }}
              />
            )}

            <div className={`${platformConfig[order.platform].bg} ${platformConfig[order.platform].border} border-b px-6 py-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    {order.autonomous ? "Auto-ordering in..." : "Confirm Order"}
                  </p>
                  <h2 className="text-lg font-bold text-stone-900 mt-0.5">{order.restaurant.name}</h2>
                  <p className={`text-sm font-medium capitalize ${platformConfig[order.platform].color}`}>
                    via {order.platform}
                  </p>
                </div>
                {order.autonomous && (
                  <motion.div
                    key={countdown}
                    initial={{ scale: 1.3, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-12 h-12 rounded-full bg-white border-2 border-stone-200 flex items-center justify-center"
                  >
                    <span className="text-xl font-bold text-stone-700">{countdown}</span>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Item</span>
                <span className="font-medium text-stone-900">{order.item}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Amount</span>
                <span className="font-semibold text-stone-900">₹{order.price}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Delivery in</span>
                <span className="font-medium text-stone-900">~{order.estimatedDelivery} min</span>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-colors"
              >
                {order.autonomous ? "Stop ✋" : "Cancel"}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-3 rounded-2xl text-white font-semibold text-sm transition-colors ${platformConfig[order.platform].btn}`}
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
