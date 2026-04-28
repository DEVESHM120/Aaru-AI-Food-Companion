"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { PersonAddress } from "@/lib/profiles/types";

interface Props {
  addresses: PersonAddress[];
  onSelect: (address: PersonAddress) => void;
  onCancel: () => void;
}

export default function AddressPickerSheet({ addresses, onSelect, onCancel }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={onCancel}
        />

        {/* Sheet */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderBottom: "none",
            boxShadow: "0 -16px 48px rgba(0,0,0,0.4)",
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--border)" }} />
          </div>

          <div className="px-5 pb-2">
            <h2 className="text-base font-bold mb-1" style={{ color: "var(--text)" }}>Where should we deliver?</h2>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Pick your delivery address</p>

            {/* Address options */}
            <div className="space-y-2 mb-5">
              {addresses.map((addr) => (
                <button
                  key={addr.addressId}
                  onClick={() => setSelected(addr.addressId)}
                  className="w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center gap-3"
                  style={selected === addr.addressId ? {
                    backgroundColor: "rgba(255,69,0,0.08)",
                    border: "1px solid rgba(255,69,0,0.35)",
                  } : {
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Icon */}
                  <span className="text-lg flex-shrink-0">
                    {addr.label === "Home" ? "🏠" : addr.label === "Office" ? "💼" : addr.label === "College" ? "🎓" : "📍"}
                  </span>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{addr.label}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{addr.locationName}</p>
                  </div>

                  {/* Radio */}
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={selected === addr.addressId ? {
                      background: "linear-gradient(135deg, #FF4500, #FF7A00)",
                    } : {
                      border: "2px solid var(--border)",
                    }}
                  >
                    {selected === addr.addressId && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pb-safe pb-6">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                disabled={!selected}
                onClick={() => {
                  const addr = addresses.find((a) => a.addressId === selected);
                  if (addr) onSelect(addr);
                }}
                className="flex-1 py-3 rounded-2xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #FF4500, #FF7A00)" }}
              >
                Deliver here →
              </button>
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
