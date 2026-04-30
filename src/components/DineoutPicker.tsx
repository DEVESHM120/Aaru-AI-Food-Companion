"use client";

import { motion } from "framer-motion";
import { DineoutBlock } from "@/lib/types";

interface Props {
  data: DineoutBlock;
  onBook: (restaurantName: string, slot: string, partySize: number, date?: string) => void;
}

const StarIcon = () => (
  <svg className="w-3 h-3 fill-current" style={{ color: "#FFB800" }} viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

export default function DineoutPicker({ data, onBook }: Props) {
  const partySize = data.partySize ?? 2;
  const date = data.bookingDate ?? new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 mt-2"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>🍽️ Dineout</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: "rgba(252,128,25,0.1)", color: "#FC8019", border: "1px solid rgba(252,128,25,0.2)" }}
        >
          {partySize} people · {date}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {data.restaurants.map((r, i) => (
          <motion.div
            key={`${r.name}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-xl p-3"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Restaurant info */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-sm" style={{ color: "var(--text)" }}>{r.name}</h4>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{r.cuisine} · {r.location}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="flex items-center gap-1 justify-end">
                  <StarIcon />
                  <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{r.rating}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>~₹{r.avgCost}/person</p>
              </div>
            </div>

            {/* Time slots */}
            {r.availableSlots.length > 0 && (
              <div>
                <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Available slots</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.availableSlots.map((slot) => (
                    <motion.button
                      key={slot}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onBook(r.name, slot, partySize, data.bookingDate)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        backgroundColor: "rgba(252,128,25,0.08)",
                        color: "#FC8019",
                        border: "1px solid rgba(252,128,25,0.25)",
                      }}
                    >
                      {slot}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
