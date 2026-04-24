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
      className="px-4 pb-3"
    >
      <p className="text-sm text-stone-500 italic mb-2.5">{question}</p>
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
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all
              ${disabled
                ? "border-stone-200 text-stone-400 cursor-not-allowed"
                : "border-red-300 text-red-700 bg-white hover:bg-red-50 hover:border-red-400 active:bg-red-100 cursor-pointer"
              }`}
          >
            {option}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
