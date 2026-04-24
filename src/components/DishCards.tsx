"use client";

import { motion } from "framer-motion";
import { Dish } from "@/lib/types";

interface DishCardsProps {
  dishes: Dish[];
  onSelect: (dish: Dish) => void;
}

const StarIcon = () => (
  <svg className="w-3.5 h-3.5 text-amber-500 fill-current" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const platformColors = {
  zomato: { bg: "bg-red-50", border: "border-red-100", badge: "bg-red-500", btn: "text-red-600 border-red-200 hover:bg-red-500 hover:text-white" },
  swiggy: { bg: "bg-orange-50", border: "border-orange-100", badge: "bg-orange-500", btn: "text-orange-600 border-orange-200 hover:bg-orange-500 hover:text-white" },
};

export default function DishCards({ dishes, onSelect }: DishCardsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 mt-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {dishes.map((dish, i) => {
          const colors = platformColors[dish.platform];
          return (
            <motion.div
              key={`${dish.restaurantName}-${dish.dishName}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`${colors.bg} ${colors.border} border rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all group`}
              onClick={() => onSelect(dish)}
            >
              {/* Top row: platform + veg indicator + offer */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`${colors.badge} text-white text-xs font-semibold px-2 py-0.5 rounded-full capitalize`}>
                    {dish.platform}
                  </span>
                  {/* Veg / non-veg square indicator (Indian food standard) */}
                  <span
                    title={dish.isVeg ? "Veg" : "Non-veg"}
                    className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${
                      dish.isVeg ? "border-green-600" : "border-red-600"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${dish.isVeg ? "bg-green-600" : "bg-red-600"}`} />
                  </span>
                </div>
                {dish.offer && (
                  <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                    {dish.offer}
                  </span>
                )}
              </div>

              {/* Dish name — primary */}
              <h3 className="font-bold text-stone-900 text-sm leading-tight group-hover:text-amber-700 transition-colors">
                {dish.dishName}
              </h3>

              {/* Restaurant name — secondary */}
              <p className="text-stone-500 text-xs mt-0.5">{dish.restaurantName}</p>

              {/* Description */}
              {dish.description && (
                <p className="text-stone-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                  {dish.description}
                </p>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-3 mt-3 text-xs text-stone-600">
                <span className="flex items-center gap-1">
                  <StarIcon />
                  {dish.rating}
                </span>
                {dish.deliveryTime && <span>⏱ {dish.deliveryTime} min</span>}
                <span className="font-bold text-stone-900 ml-auto text-sm">₹{dish.price}</span>
              </div>

              {/* CTA */}
              <button className={`mt-3 w-full text-xs font-semibold py-2 rounded-xl border transition-all ${colors.btn}`}>
                Order from {dish.platform.charAt(0).toUpperCase() + dish.platform.slice(1)} →
              </button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
