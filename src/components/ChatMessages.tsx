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
    <div className="flex flex-col gap-3 py-4">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className={`flex items-end gap-2 px-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Bubble */}
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"
              }`}
              style={{
                backgroundColor: msg.role === "user" ? "var(--bubble-user-bg)" : "var(--bubble-ai-bg)",
                border: `1px solid ${msg.role === "user" ? "var(--bubble-user-border)" : "var(--bubble-ai-border)"}`,
                color: "var(--text)",
              }}
            >
              {/* Voice indicator */}
              {msg.role === "user" && msg.inputMode === "voice" && (
                <span className="flex items-center gap-1 text-xs font-medium mb-1" style={{ color: "var(--accent)" }}>
                  🎤 Voice
                </span>
              )}
              {/* AI label */}
              {msg.role === "assistant" && (
                <span className="block text-xs font-semibold mb-1 tracking-wide" style={{ color: "var(--accent)" }}>
                  aaru
                </span>
              )}
              {msg.content}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
