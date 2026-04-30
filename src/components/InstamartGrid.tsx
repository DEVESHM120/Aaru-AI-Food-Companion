"use client";

import { motion } from "framer-motion";
import { InstamartBlock } from "@/lib/types";

interface Props {
  data: InstamartBlock;
  onAddItem: (itemName: string) => void;
}

export default function InstamartGrid({ data, onAddItem }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 mt-2"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>🛒 Swiggy Instamart</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: "rgba(252,128,25,0.1)", color: "#FC8019", border: "1px solid rgba(252,128,25,0.2)" }}
        >
          ⚡ {data.deliveryTime} min delivery
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {data.items.map((item, i) => (
          <motion.div
            key={`${item.name}-${i}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex-shrink-0 w-36 rounded-xl p-3 cursor-pointer"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={() => item.isAvailable && onAddItem(item.name)}
            whileTap={item.isAvailable ? { scale: 0.96 } : {}}
          >
            <div className="w-full h-20 rounded-lg mb-2 flex items-center justify-center text-3xl"
              style={{ backgroundColor: "rgba(252,128,25,0.06)" }}
            >
              🛍️
            </div>

            <p className="text-xs font-semibold leading-snug line-clamp-2 mb-0.5" style={{ color: "var(--text)" }}>
              {item.name}
            </p>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
              {item.brand} · {item.unit}
            </p>

            <div className="flex items-center justify-between">
              <span className="font-bold text-sm" style={{ color: "#FC8019" }}>₹{item.price}</span>
              {item.isAvailable ? (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22C55E", fontSize: "10px" }}
                >
                  + Add
                </span>
              ) : (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--border)", color: "var(--text-muted)", fontSize: "10px" }}
                >
                  Out of stock
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
