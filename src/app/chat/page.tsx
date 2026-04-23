"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import ChatMessages from "@/components/ChatMessages";
import AIThinking from "@/components/AIThinking";
import VoiceInput from "@/components/VoiceInput";
import RestaurantCards from "@/components/RestaurantCards";
import OrderConfirmation from "@/components/OrderConfirmation";
import {
  Message,
  InputMode,
  Restaurant,
  OrderDetails,
} from "@/lib/types";

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm Aaru 👋 Your AI food companion. Tell me what you're craving — or just say \"surprise me\" and I'll figure it out based on the time and your past orders.",
  timestamp: new Date(),
};

async function playTTS(text: string) {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  } catch {
    // TTS unavailable, silently skip
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [isThinking, setIsThinking] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [pendingOrder, setPendingOrder] = useState<OrderDetails | null>(null);
  const [orderPlaced, setOrderPlaced] = useState<OrderDetails | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const sendMessage = useCallback(
    async (text: string, mode: InputMode = inputMode) => {
      if (!text.trim() || isThinking) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        inputMode: mode,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsThinking(true);
      setRestaurants(null);

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, inputMode: mode }),
        });

        const data = await res.json();

        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);

        if (data.restaurants?.length) {
          setRestaurants(data.restaurants);
        }

        if (data.orderDetails) {
          setPendingOrder(data.orderDetails);
        }

        // Speak back only if user spoke
        if (mode === "voice" && data.shouldSpeak) {
          await playTTS(data.message);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Sorry, I ran into a hiccup. Try again in a moment!",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [messages, inputMode, isThinking]
  );

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      setInputMode("voice");
      sendMessage(text, "voice");
    },
    [sendMessage]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputMode("text");
    sendMessage(input, "text");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setInputMode("text");
      sendMessage(input, "text");
    }
  };

  const handleConfirmOrder = useCallback(async () => {
    if (!pendingOrder) return;
    setOrderPlaced(pendingOrder);
    setPendingOrder(null);

    // Send confirmation message to AI
    await sendMessage(`Yes, please confirm the order from ${pendingOrder.restaurant.name}.`, "text");
  }, [pendingOrder, sendMessage]);

  return (
    <div className="flex flex-col h-screen bg-[#FAFAF9]">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md px-4 py-3 flex items-center justify-between flex-shrink-0 z-30">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-xl">🍽️</span>
          <span className="font-bold text-stone-900 group-hover:text-amber-600 transition-colors">
            Aaru
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 hidden sm:block">
            Powered by Claude + Zomato &amp; Swiggy MCP
          </span>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>
      </header>

      {/* Order placed banner */}
      <AnimatePresence>
        {orderPlaced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-green-50 border-b border-green-200 px-4 py-3 text-sm text-green-800 font-medium flex items-center justify-between"
          >
            <span>
              🎉 Order placed from{" "}
              <strong>{orderPlaced.restaurant.name}</strong> via{" "}
              {orderPlaced.platform}! Arriving in ~{orderPlaced.estimatedDelivery} min.
            </span>
            <button
              onClick={() => setOrderPlaced(null)}
              className="text-green-600 hover:text-green-800 text-lg leading-none ml-4"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <ChatMessages messages={messages} />

        {/* Thinking indicator */}
        <AnimatePresence>
          {isThinking && <AIThinking />}
        </AnimatePresence>

        {/* Restaurant cards */}
        <AnimatePresence>
          {restaurants && !isThinking && (
            <RestaurantCards
              restaurants={restaurants}
              onSelect={(order) => setPendingOrder(order)}
            />
          )}
        </AnimatePresence>

        <div className="h-4" />
      </div>

      {/* Input bar */}
      <div className="border-t border-stone-200 bg-white/90 backdrop-blur-md px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
          {/* Voice button */}
          <div className="mb-1">
            <VoiceInput
              onTranscript={handleVoiceTranscript}
              disabled={isThinking}
            />
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Aaru what to eat... (or tap the mic 🎤)"
              rows={1}
              disabled={isThinking}
              className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50 max-h-32 overflow-y-auto leading-relaxed"
            />
          </div>

          {/* Send button */}
          <motion.button
            type="submit"
            disabled={!input.trim() || isThinking}
            whileTap={{ scale: 0.93 }}
            className="mb-1 w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-md shadow-amber-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </motion.button>
        </form>

        <p className="text-center text-xs text-stone-400 mt-2">
          Voice mode → AI speaks back · Text mode → text only
        </p>
      </div>

      {/* Order confirmation modal */}
      <OrderConfirmation
        order={pendingOrder}
        onConfirm={handleConfirmOrder}
        onCancel={() => setPendingOrder(null)}
      />
    </div>
  );
}
