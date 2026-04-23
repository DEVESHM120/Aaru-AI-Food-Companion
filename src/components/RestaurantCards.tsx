"use client";

import { motion } from "framer-motion";
import { Restaurant, OrderDetails } from "@/lib/types";

interface RestaurantCardsProps {
  restaurants: Restaurant[];
  onSelect: (order: OrderDetails) => void;
}

const StarIcon = () => (
  <svg className="w-3.5 h-3.5 text-amber-500 fill-current" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const platformColors = {
  zomato: { bg: "bg-red-50", border: "border-red-100", badge: "bg-red-500", text: "text-red-600" },
  swiggy: { bg: "bg-orange-50", border: "border-orange-100", badge: "bg-orange-500", text: "text-orange-600" },
};

export default function RestaurantCards({ restaurants, onSelect }: RestaurantCardsProps) {
  const zomato = restaurants.filter((r) => r.platform === "zomato");
  const swiggy = restaurants.filter((r) => r.platform === "swiggy");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 mt-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[...zomato, ...swiggy].map((r, i) => {
          const colors = platformColors[r.platform];
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`${colors.bg} ${colors.border} border rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all group`}
              onClick={() =>
                onSelect({
                  restaurant: r,
                  item: r.cuisine,
                  price: r.price,
                  platform: r.platform,
                  estimatedDelivery: r.deliveryTime,
                })
              }
            >
              {/* Platform badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`${colors.badge} text-white text-xs font-semibold px-2 py-0.5 rounded-full capitalize`}>
                  {r.platform}
                </span>
                {r.offer && (
                  <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                    {r.offer}
                  </span>
                )}
              </div>

              {/* Name & cuisine */}
              <h3 className="font-semibold text-stone-900 text-sm group-hover:text-amber-700 transition-colors">
                {r.name}
              </h3>
              <p className="text-stone-500 text-xs mt-0.5">{r.cuisine}</p>

              {/* Stats */}
              <div className="flex items-center gap-3 mt-3 text-xs text-stone-600">
                <span className="flex items-center gap-1">
                  <StarIcon />
                  {r.rating}
                </span>
                <span>⏱ {r.deliveryTime} min</span>
                <span className="font-semibold text-stone-800 ml-auto">₹{r.price}</span>
              </div>

              {/* Order CTA */}
              <button className={`mt-3 w-full text-xs font-semibold py-2 rounded-xl ${colors.text} border ${colors.border} group-hover:${colors.badge} group-hover:text-white transition-all`}>
                Order from {r.platform.charAt(0).toUpperCase() + r.platform.slice(1)} →
              </button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
