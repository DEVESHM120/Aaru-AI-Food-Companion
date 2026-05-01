"use client";

import { motion } from "framer-motion";
import { Dish } from "@/lib/types";

interface DishCardsProps {
  dishes: Dish[];
  onSelect: (dish: Dish) => void;
  onAddToCart: (dish: Dish) => void;
}

const StarIcon = () => (
  <svg className="h-3.5 w-3.5 fill-current" style={{ color: "#FFB800" }} viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const platformBadge: Record<string, { bg: string; label: string }> = {
  swiggy: { bg: "#FC8019", label: "Swiggy" },
  zomato: { bg: "#E23744", label: "Zomato" },
};

export default function DishCards({ dishes, onSelect, onAddToCart }: DishCardsProps) {
  const pick = dishes.find((d) => d.isRecommended) ?? dishes[0];
  const rest = dishes.filter((d) => d !== pick);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 flex flex-col gap-3 px-4"
    >
      {pick && <PickCard dish={pick} onSelect={onSelect} onAddToCart={onAddToCart} />}

      {rest.length > 0 && (
        <>
          <p className="px-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            Other options
          </p>
          <div className="grid grid-cols-2 gap-2">
            {rest.map((dish, i) => (
              <SmallCard
                key={`${dish.restaurantName}-${dish.dishName}-${i}`}
                dish={dish}
                index={i}
                onSelect={onSelect}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

function PickCard({
  dish,
  onSelect,
  onAddToCart,
}: {
  dish: Dish;
  onSelect: (d: Dish) => void;
  onAddToCart: (d: Dish) => void;
}) {
  const badge = platformBadge[dish.platform] ?? platformBadge.swiggy;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl p-4"
      style={{
        border: "2px solid rgba(255,69,0,0.45)",
        boxShadow: "0 0 28px rgba(255,69,0,0.12)",
        backgroundColor: "var(--surface)",
      }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
          style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)", color: "#fff" }}
        >
          Aaru&apos;s Pick
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: badge.bg }}>
            {badge.label}
          </span>
          <span
            title={dish.isVeg ? "Veg" : "Non-veg"}
            className="h-3.5 w-3.5 flex-shrink-0 rounded-full"
            style={{
              backgroundColor: dish.isVeg ? "#22C55E" : "#EF4444",
              outline: `2px solid ${dish.isVeg ? "#22C55E" : "#EF4444"}`,
              outlineOffset: "1px",
            }}
          />
        </div>
      </div>

      <h3 className="mb-0.5 text-base font-bold leading-tight" style={{ color: "var(--text)" }}>
        {dish.dishName}
      </h3>
      <p className="mb-1 text-xs font-medium" style={{ color: "rgba(255,69,0,0.8)" }}>
        {dish.restaurantName}
      </p>

      {dish.whyRecommended && (
        <p className="mb-2 text-xs italic" style={{ color: "var(--text-muted)" }}>
          &quot;{dish.whyRecommended}&quot;
        </p>
      )}

      {dish.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {dish.description}
        </p>
      )}

      <div className="mb-3 flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1">
          <StarIcon />
          {dish.rating}
        </span>
        {dish.deliveryTime && <span>{dish.deliveryTime} min</span>}
        {dish.offer && (
          <span
            className="rounded-full px-2 py-0.5 font-medium"
            style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            {dish.offer}
          </span>
        )}
        <span className="ml-auto text-sm font-bold" style={{ color: "#FF7A00" }}>
          Rs {dish.price}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onAddToCart(dish)}
          className="rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ color: "var(--text)", backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          Add to cart
        </button>
        <button
          type="button"
          onClick={() => onSelect(dish)}
          className="rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)" }}
        >
          Order now
        </button>
      </div>
    </motion.div>
  );
}

function SmallCard({
  dish,
  index,
  onSelect,
  onAddToCart,
}: {
  dish: Dish;
  index: number;
  onSelect: (d: Dish) => void;
  onAddToCart: (d: Dish) => void;
}) {
  const badge = platformBadge[dish.platform] ?? platformBadge.swiggy;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl p-3 transition-all"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,69,0,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
      }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="rounded-full px-1.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: badge.bg, fontSize: "10px" }}>
          {badge.label}
        </span>
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: dish.isVeg ? "#22C55E" : "#EF4444" }} />
      </div>

      <h4 className="mb-0.5 line-clamp-2 text-xs font-semibold leading-snug" style={{ color: "var(--text)" }}>
        {dish.dishName}
      </h4>
      <p className="mb-2 line-clamp-1 text-xs" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
        {dish.restaurantName}
      </p>

      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-0.5">
          <StarIcon />
          {dish.rating}
        </span>
        <span className="font-bold" style={{ color: "#FF7A00" }}>
          Rs {dish.price}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onAddToCart(dish)}
          className="rounded-lg px-2 py-1.5 text-[10px] font-semibold"
          style={{ color: "var(--text)", backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => onSelect(dish)}
          className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)" }}
        >
          Order
        </button>
      </div>
    </motion.div>
  );
}
