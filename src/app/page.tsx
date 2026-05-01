"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const floatingFoods = ["🍕", "🍜", "🍱", "🍔", "🥗", "🍛", "🧆", "🍣"];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Floating food background */}
      {floatingFoods.map((emoji, i) => (
        <motion.span
          key={i}
          className="absolute text-3xl select-none pointer-events-none"
          style={{
            left: `${10 + (i * 11) % 85}%`,
            top: `${8 + (i * 13) % 80}%`,
          }}
          animate={{
            y: [0, -18, 0],
            rotate: [0, i % 2 === 0 ? 12 : -12, 0],
            opacity: [0.18, 0.32, 0.18],
          }}
          transition={{
            duration: 3.5 + i * 0.4,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeInOut",
          }}
        >
          {emoji}
        </motion.span>
      ))}

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-lg mx-auto">
        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className="w-20 h-20 rounded-3xl bg-amber-100 border-2 border-amber-200 flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg"
        >
          🍽️
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-4xl sm:text-5xl font-bold text-stone-900 tracking-tight"
        >
          Meet{" "}
          <span className="text-amber-600">Aaru</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-xl text-stone-500 mt-3 font-medium"
        >
          Your AI Food Companion
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-stone-400 mt-2 text-sm leading-relaxed"
        >
          Decides what to eat. Talks like a friend. Orders for you — on Swiggy.
        </motion.p>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="flex flex-wrap justify-center gap-2 mt-6"
        >
          {["🎤 Voice First", "🧠 Context Aware", "🛒 Real Orders", "💬 Conversational"].map((tag) => (
            <span key={tag} className="bg-stone-100 border border-stone-200 text-stone-600 text-xs font-medium px-3 py-1.5 rounded-full">
              {tag}
            </span>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-8"
        >
          <Link href="/chat">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-8 py-4 rounded-2xl text-base shadow-lg shadow-amber-200 transition-colors"
            >
              Start Talking with Aaru →
            </motion.button>
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xs text-stone-400 mt-4"
        >
          Powered by your real Swiggy account
        </motion.p>
      </div>

      {/* Bottom credit */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-6 text-xs text-stone-300"
      >
        Built by Devesh Mishra · AI + Product
      </motion.p>
    </main>
  );
}
