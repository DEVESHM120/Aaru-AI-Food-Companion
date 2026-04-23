"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Message } from "@/lib/types";

interface ChatMessagesProps {
  messages: Message[];
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 py-4">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex items-start gap-3 px-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                🍽️
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-amber-100 border border-amber-200 text-stone-900 rounded-tr-sm"
                  : "bg-stone-100 border border-stone-200 text-stone-800 rounded-tl-sm"
              }`}
            >
              {/* Voice indicator */}
              {msg.role === "user" && msg.inputMode === "voice" && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium mb-1 block">
                  🎤 Voice
                </span>
              )}
              {msg.content}
            </div>

            {/* User avatar placeholder */}
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                👤
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
