"use client";

import { motion } from "framer-motion";

interface Props {
  question: string;
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

export default function ClarificationChips({ question, options, onSelect, disabled }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="px-4 pb-3 mt-1"
    >
      <p className="text-xs italic mb-2.5" style={{ color: "var(--text-muted)" }}>{question}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option, i) => (
          <motion.button
            key={option}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            whileTap={{ scale: 0.95 }}
            disabled={disabled}
            onClick={() => onSelect(option)}
            className="px-4 py-2 rounded-full text-sm font-medium border transition-all cursor-pointer"
            style={disabled ? {
              borderColor: "var(--border)",
              color: "var(--text-muted)",
              opacity: 0.5,
              cursor: "not-allowed",
            } : {
              borderColor: "rgba(255,69,0,0.3)",
              color: "#FF7A00",
              backgroundColor: "rgba(255,69,0,0.05)",
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,69,0,0.12)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,69,0,0.5)";
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,69,0,0.05)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,69,0,0.3)";
              }
            }}
          >
            {option}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
