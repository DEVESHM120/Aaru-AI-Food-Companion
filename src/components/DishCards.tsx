"use client";

import { motion } from "framer-motion";
import { Dish } from "@/lib/types";

interface DishCardsProps {
  dishes: Dish[];
  onSelect: (dish: Dish) => void;
}

const StarIcon = () => (
  <svg className="w-3.5 h-3.5 fill-current" style={{ color: "#FFB800" }} viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const platformBadge = {
  zomato: { bg: "#E23744", label: "Zomato" },
  swiggy: { bg: "#FC8019", label: "Swiggy" },
};

export default function DishCards({ dishes, onSelect }: DishCardsProps) {
  const pick = dishes.find((d) => d.isRecommended) ?? dishes[0];
  const rest = dishes.filter((d) => d !== pick);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 mt-2 flex flex-col gap-3"
    >
      {/* ── Aaru's Pick — full width hero card ─────────────────────────── */}
      {pick && <PickCard dish={pick} onSelect={onSelect} />}

      {/* ── Other options — smaller 2-col grid ─────────────────────────── */}
      {rest.length > 0 && (
        <>
          <p className="text-xs px-0.5" style={{ color: "var(--text-muted)" }}>Other options</p>
          <div className="grid grid-cols-2 gap-2">
            {rest.map((dish, i) => (
              <SmallCard key={`${dish.restaurantName}-${dish.dishName}-${i}`} dish={dish} index={i} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

function PickCard({ dish, onSelect }: { dish: Dish; onSelect: (d: Dish) => void }) {
  const badge = platformBadge[dish.platform] ?? platformBadge.zomato;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onSelect(dish)}
      className="rounded-2xl p-4 cursor-pointer relative overflow-hidden"
      style={{
        border: "2px solid rgba(255,69,0,0.45)",
        boxShadow: "0 0 28px rgba(255,69,0,0.12)",
        backgroundColor: "var(--surface)",
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Aaru's Pick badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
          style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)", color: "#fff" }}
        >
          ✦ Aaru's Pick
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-white text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: badge.bg }}
          >
            {badge.label}
          </span>
          <span
            title={dish.isVeg ? "Veg" : "Non-veg"}
            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: dish.isVeg ? "#22C55E" : "#EF4444", outline: `2px solid ${dish.isVeg ? "#22C55E" : "#EF4444"}`, outlineOffset: "1px" }}
          />
        </div>
      </div>

      {/* Dish + restaurant */}
      <h3 className="font-bold text-base leading-tight mb-0.5" style={{ color: "var(--text)" }}>
        {dish.dishName}
      </h3>
      <p className="text-xs font-medium mb-1" style={{ color: "rgba(255,69,0,0.8)" }}>{dish.restaurantName}</p>

      {/* Why recommended */}
      {dish.whyRecommended && (
        <p className="text-xs mb-2 italic" style={{ color: "var(--text-muted)" }}>
          "{dish.whyRecommended}"
        </p>
      )}

      {dish.description && (
        <p className="text-xs mb-3 line-clamp-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {dish.description}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1"><StarIcon />{dish.rating}</span>
        {dish.deliveryTime && <span>⏱ {dish.deliveryTime} min</span>}
        {dish.offer && (
          <span className="px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" }}>
            {dish.offer}
          </span>
        )}
        <span className="font-bold ml-auto text-sm" style={{ color: "#FF7A00" }}>₹{dish.price}</span>
      </div>

      <button
        className="w-full text-sm font-semibold py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg,#FF4500,#FF7A00)" }}
      >
        Order from {badge.label} →
      </button>
    </motion.div>
  );
}

function SmallCard({ dish, index, onSelect }: { dish: Dish; index: number; onSelect: (d: Dish) => void }) {
  const badge = platformBadge[dish.platform] ?? platformBadge.zomato;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => onSelect(dish)}
      className="rounded-xl p-3 cursor-pointer transition-all"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,69,0,0.25)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
      }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-white text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, fontSize: "10px" }}>
          {badge.label}
        </span>
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dish.isVeg ? "#22C55E" : "#EF4444" }}
        />
      </div>
      <h4 className="font-semibold text-xs leading-snug mb-0.5 line-clamp-2" style={{ color: "var(--text)" }}>
        {dish.dishName}
      </h4>
      <p className="text-xs line-clamp-1 mb-2" style={{ color: "var(--text-muted)", fontSize: "10px" }}>{dish.restaurantName}</p>
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-0.5"><StarIcon />{dish.rating}</span>
        <span className="font-bold" style={{ color: "#FF7A00" }}>₹{dish.price}</span>
      </div>
    </motion.div>
  );
}
