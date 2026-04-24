"use client";

import { motion, AnimatePresence } from "framer-motion";
import { VoiceState } from "@/lib/types";

interface VoiceStatusBarProps {
  state: VoiceState;
}

export default function VoiceStatusBar({ state }: VoiceStatusBarProps) {
  return (
    <AnimatePresence>
      {state !== "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="px-4 py-2 flex items-center justify-center gap-3"
        >
          {state === "listening" && <ListeningIndicator />}
          {state === "thinking" && <ThinkingIndicator />}
          {state === "speaking" && <SpeakingIndicator />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ListeningIndicator() {
  return (
    <div className="flex items-center gap-2.5">
      {/* Ripple rings */}
      <div className="relative flex items-center justify-center w-8 h-8">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-amber-400"
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
            style={{ width: 20, height: 20 }}
          />
        ))}
        <div className="w-3 h-3 rounded-full bg-amber-500 z-10" />
      </div>

      {/* Waveform bars */}
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full bg-amber-400"
            animate={{ height: ["4px", "16px", "4px"] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
          />
        ))}
      </div>

      <span className="text-sm font-medium text-amber-600">Listening...</span>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2.5">
      <motion.span
        animate={{ rotate: [0, 15, -15, 0] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="text-lg"
      >
        🍽️
      </motion.span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-stone-400"
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-stone-500">Aaru is thinking...</span>
    </div>
  );
}

function SpeakingIndicator() {
  return (
    <div className="flex items-center gap-2.5">
      {/* Avatar with soundwave halo */}
      <div className="relative flex items-center justify-center w-8 h-8">
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-green-400"
            animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
            style={{ width: 24, height: 24 }}
          />
        ))}
        <motion.span
          className="text-base z-10"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
        >
          🍽️
        </motion.span>
      </div>

      {/* Sound bars */}
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full bg-green-400"
            animate={{ height: ["6px", "20px", "6px"] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
          />
        ))}
      </div>

      <span className="text-sm font-medium text-green-600">Aaru is speaking...</span>
    </div>
  );
}
