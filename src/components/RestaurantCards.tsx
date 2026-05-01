"use client";

import { motion } from "framer-motion";
import { Restaurant, OrderDetails } from "@/lib/types";

interface RestaurantCardsProps {
  restaurants: Restaurant[];
  onSelect: (order: OrderDetails) => void;
}

const StarIcon = () => (
  <svg className="w-3.5 h-3.5 fill-current" style={{ color: "#FFB800" }} viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const platformBadge: Record<string, { bg: string; label: string }> = {
  swiggy: { bg: "#FC8019", label: "Swiggy" },
};

export default function RestaurantCards({ restaurants, onSelect }: RestaurantCardsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 mt-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {restaurants.map((r, i) => {
          const badge = platformBadge[r.platform] ?? platformBadge.swiggy;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() =>
                onSelect({
                  restaurant: r,
                  item: r.cuisine,
                  price: r.price,
                  platform: r.platform,
                  estimatedDelivery: r.deliveryTime,
                })
              }
              className="rounded-2xl p-4 cursor-pointer transition-all"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,69,0,0.35)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 20px rgba(255,69,0,0.07)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              {/* Platform badge + offer */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-white text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: badge.bg }}
                >
                  {badge.label}
                </span>
                {r.offer && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" }}
                  >
                    {r.offer}
                  </span>
                )}
              </div>

              {/* Name & cuisine */}
              <h3 className="font-semibold text-sm mb-0.5" style={{ color: "var(--text)" }}>{r.name}</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{r.cuisine}</p>

              {/* Stats */}
              <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1">
                  <StarIcon />
                  {r.rating}
                </span>
                <span>⏱ {r.deliveryTime} min</span>
                <span className="font-bold ml-auto" style={{ color: "#FF7A00" }}>₹{r.price}</span>
              </div>

              {/* CTA */}
              <button
                className="mt-3 w-full text-xs font-semibold py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #FF4500, #FF7A00)" }}
              >
                Order from {badge.label} →
              </button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
