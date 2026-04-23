"use client";

import { motion } from "framer-motion";

export default function AIThinking() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-start gap-3 px-4"
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-sm flex-shrink-0">
        🍽️
      </div>

      {/* Thinking bubble */}
      <div className="flex items-center gap-3 bg-stone-100 border border-stone-200 rounded-2xl rounded-tl-sm px-4 py-3">
        {/* Dots */}
        <div className="flex gap-1 items-center">
          <span className="dot-1 w-2 h-2 rounded-full bg-amber-500 block" />
          <span className="dot-2 w-2 h-2 rounded-full bg-amber-500 block" />
          <span className="dot-3 w-2 h-2 rounded-full bg-amber-500 block" />
        </div>

        {/* Rotating emoji + label */}
        <motion.div
          className="flex items-center gap-1.5 text-stone-500 text-sm"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <motion.span
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            🤔
          </motion.span>
          <span>Aaru is deciding...</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
