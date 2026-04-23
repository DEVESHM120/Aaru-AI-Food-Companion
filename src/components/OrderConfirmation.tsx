"use client";

import { motion, AnimatePresence } from "framer-motion";
import { OrderDetails } from "@/lib/types";

interface OrderConfirmationProps {
  order: OrderDetails | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const platformConfig = {
  zomato: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", btn: "bg-red-500 hover:bg-red-600" },
  swiggy: { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", btn: "bg-orange-500 hover:bg-orange-600" },
};

export default function OrderConfirmation({ order, onConfirm, onCancel }: OrderConfirmationProps) {
  return (
    <AnimatePresence>
      {order && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed inset-x-4 bottom-8 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-8 sm:w-96 bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className={`${platformConfig[order.platform].bg} ${platformConfig[order.platform].border} border-b px-6 py-4`}>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Confirm Order</p>
              <h2 className="text-lg font-bold text-stone-900 mt-1">{order.restaurant.name}</h2>
              <p className={`text-sm font-medium capitalize ${platformConfig[order.platform].color}`}>
                via {order.platform}
              </p>
            </div>

            {/* Details */}
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
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Rating</span>
                <span className="font-medium text-stone-900">⭐ {order.restaurant.rating}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-3 rounded-2xl text-white font-semibold text-sm transition-colors ${platformConfig[order.platform].btn}`}
              >
                Place Order 🎉
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
