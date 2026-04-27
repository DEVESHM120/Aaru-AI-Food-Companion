"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import ChatMessages from "@/components/ChatMessages";
import VoiceInput from "@/components/VoiceInput";
import VoiceStatusBar from "@/components/VoiceStatusBar";
import RestaurantCards from "@/components/RestaurantCards";
import DishCards from "@/components/DishCards";
import ClarificationChips from "@/components/ClarificationChips";
import OrderConfirmation from "@/components/OrderConfirmation";
import ProfileManager from "@/components/ProfileManager";
import {
  Message, InputMode, Restaurant, OrderDetails,
  WeatherContext, VoiceState, QuickChip, Dish, ClarificationBlock,
} from "@/lib/types";
import { PersonProfile, PersonAddress } from "@/lib/profiles/types";
import { getAllProfiles, saveProfile, newProfileId } from "@/lib/profiles/store";

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hey! 👋 What are you craving?",
  timestamp: new Date(),
};

function getQuickChips(): QuickChip[] {
  const h = new Date().getHours();
  if (h < 11) return [
    { emoji: "🥐", label: "Breakfast", query: "what should I have for breakfast?" },
    { emoji: "☕", label: "Chai & Snacks", query: "chai and something to snack on" },
    { emoji: "🥗", label: "Healthy", query: "something healthy to start the day" },
  ];
  if (h < 15) return [
    { emoji: "🍛", label: "Biryani", query: "biryani for lunch, my usual" },
    { emoji: "🍱", label: "Thali", query: "a good thali for lunch" },
    { emoji: "🌮", label: "Street Food", query: "street food for lunch" },
  ];
  if (h < 18) return [
    { emoji: "☕", label: "Coffee", query: "cold coffee — it's hot" },
    { emoji: "🍟", label: "Snacks", query: "something quick to snack on" },
    { emoji: "🌶️", label: "Spicy", query: "something spicy for evening" },
  ];
  if (h < 22) return [
    { emoji: "🍕", label: "Pizza", query: "pizza for dinner" },
    { emoji: "🍖", label: "Non-veg", query: "non veg dinner, something filling" },
    { emoji: "🍜", label: "Noodles", query: "noodles or pasta for tonight" },
  ];
  return [
    { emoji: "🍔", label: "Burger", query: "burger for late night" },
    { emoji: "🍕", label: "Pizza", query: "pizza, late night" },
    { emoji: "🍛", label: "Biryani", query: "biryani delivery right now" },
  ];
}

// Module-level ref so any call can stop the current audio before starting new
let activeAudio: HTMLAudioElement | null = null;

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
}

async function playTTS(text: string): Promise<void> {
  stopActiveAudio();
  return new Promise((resolve) => {
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        activeAudio = audio;
        const cleanup = () => {
          URL.revokeObjectURL(url);
          if (activeAudio === audio) activeAudio = null;
          resolve();
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        audio.play().catch(cleanup);
      })
      .catch(() => resolve());
  });
}

function extractCity(locationName: string): string {
  const parts = locationName.split(",");
  for (const part of parts.reverse()) {
    const trimmed = part.trim();
    if (trimmed && trimmed.length > 2 && !trimmed.match(/^\d/)) return trimmed;
  }
  return "Delhi";
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [clarification, setClarification] = useState<ClarificationBlock | null>(null);
  const [pendingOrder, setPendingOrder] = useState<OrderDetails | null>(null);
  const [orderPlaced, setOrderPlaced] = useState<OrderDetails | null>(null);
  const [activeProfile, setActiveProfile] = useState<PersonProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<PersonProfile[]>([]);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [quickChips] = useState<QuickChip[]>(getQuickChips());
  const [chipsVisible, setChipsVisible] = useState(true);
  const [preloadedAddresses, setPreloadedAddresses] = useState<{ address_id: string; location_name: string }[]>([]);
  const [isSeeding, setIsSeeding] = useState(false); // auto-seeding profile from Zomato

  const isThinking = voiceState === "thinking";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // BUG-009 fix: keep current isVoiceMode in a ref so async sendMessage closures don't go stale
  const isVoiceModeRef = useRef(isVoiceMode);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);

  // ── On mount: load profiles and pre-fetch everything in parallel ──────────────
  useEffect(() => {
    const existing = getAllProfiles();

    if (existing.length > 0) {
      setAllProfiles(existing);
      setActiveProfile(existing[0]);
      // Still pre-load addresses for ProfileManager (for adding new addresses)
      fetch("/api/addresses").then((r) => r.json()).then(setPreloadedAddresses).catch(() => {});
      return;
    }

    // No profiles yet — auto-seed from Zomato + Swiggy MCP in parallel
    setIsSeeding(true);
    Promise.all([
      fetch("/api/addresses").then((r) => r.json()).catch(() => [] as { address_id: string; location_name: string }[]),
      fetch("/api/user").then((r) => r.json()).catch(() => ({ name: null })),
      fetch("/api/orders").then((r) => r.json()).catch(() => []),
      fetch("/api/contacts").then((r) => r.json()).catch(() => []),
      fetch("/api/swiggy-orders").then((r) => r.json()).catch(() => []),
    ]).then(([addresses, userInfo, orders, contacts, swiggyOrders]) => {
      // Merge Zomato + Swiggy orders, sorted newest first, capped at 20
      const allOrders = [...(orders as any[]), ...(swiggyOrders as any[])]
        .sort((a, b) => new Date(b.orderedAt ?? 0).getTime() - new Date(a.orderedAt ?? 0).getTime())
        .slice(0, 20);
      setPreloadedAddresses(addresses);

      if (addresses.length === 0 && !userInfo?.name) {
        setIsSeeding(false);
        return;
      }

      const autoName: string = userInfo?.name || "Me";
      const ADDRESS_LABEL_DEFAULTS = ["Home", "Office", "College", "Gym", "Other"];

      const profile: PersonProfile = {
        id: newProfileId(),
        name: autoName,
        addresses: (addresses as { address_id: string; location_name: string }[]).map((a, i) => ({
          addressId: a.address_id,
          locationName: a.location_name,
          city: extractCity(a.location_name),
          label: ADDRESS_LABEL_DEFAULTS[i] ?? `Address ${i + 1}`,
        } as PersonAddress)),
        defaultAddressId: addresses[0]?.address_id,
        preferences: {
          likes: userInfo?.preferredCuisines ?? [],
          dislikes: [],
          diet: (userInfo?.diet as "veg" | "nonveg" | "both") ?? "both",
          priceRange: (userInfo?.budgetRange as "budget" | "mid" | "premium") ?? "mid",
          notes: userInfo?.allergies?.length ? `Allergies: ${userInfo.allergies.join(", ")}` : "",
        },
        pastOrders: allOrders,
      };

      // Seed contact profiles (Divya, Mom, etc.) from Zomato saved contacts
      const contactProfiles: PersonProfile[] = (contacts as { name: string; diet?: string; notes?: string; addresses?: { label: string; locationName: string }[] }[])
        .filter((c) => c.name)
        .map((c) => ({
          id: newProfileId(),
          name: c.name,
          addresses: (c.addresses ?? []).map((a) => ({
            addressId: `${c.name.toLowerCase()}-${a.label.toLowerCase()}`,
            locationName: a.locationName,
            city: extractCity(a.locationName),
            label: a.label,
          })),
          preferences: {
            likes: [],
            dislikes: [],
            diet: (c.diet as "veg" | "nonveg" | "both") ?? "both",
            priceRange: "mid",
            notes: c.notes ?? "",
          },
          pastOrders: [],
        }));

      const allNew = [profile, ...contactProfiles];
      allNew.forEach(saveProfile);
      setAllProfiles(allNew);
      setActiveProfile(profile);

      // Write profile.md server-side — fire-and-forget
      fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryProfile: profile, contacts, userInfo }),
      }).catch(() => {});

      setIsSeeding(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch weather whenever active profile's default city changes ───────────────
  useEffect(() => {
    if (!activeProfile) return;
    const defaultAddr = activeProfile.addresses.find(
      (a) => a.addressId === activeProfile.defaultAddressId
    ) ?? activeProfile.addresses[0];
    if (!defaultAddr?.city) return;

    fetch(`/api/weather?city=${encodeURIComponent(defaultAddr.city)}`)
      .then((r) => r.json())
      .then(setWeather)
      .catch(() => {});
  }, [activeProfile?.id, activeProfile?.defaultAddressId]);

  // ── Auto-resize textarea ──────────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // ── Core send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string, mode: InputMode = "text") => {
      if (!text.trim() || voiceState === "thinking") return;

      setChipsVisible(false);
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        inputMode: mode,
        timestamp: new Date(),
      };

      stopActiveAudio();
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setInterimText("");
      setRestaurants(null);
      setDishes(null);
      setClarification(null);
      setVoiceState("thinking");

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const aiId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: aiId, role: "assistant", content: "", timestamp: new Date(), streaming: true },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            inputMode: mode,
            activeProfile,
            allProfiles,
            weather,
          }),
        });

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        // Streaming TTS state — speak first sentence as soon as it arrives
        let streamTTSFirstText = "";
        let streamTTSStarted = false;
        let streamTTSPromise: Promise<void> | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const event = JSON.parse(raw);

              if (event.type === "chunk") {
                fullText += event.text;
                const displayText = fullText
                  .replace(/```restaurants[\s\S]*?```/g, "")
                  .replace(/```dishes[\s\S]*?```/g, "")
                  .replace(/```order[\s\S]*?```/g, "")
                  .replace(/```clarification[\s\S]*?```/g, "")
                  .trim();
                setMessages((prev) =>
                  prev.map((m) => m.id === aiId ? { ...m, content: displayText } : m)
                );

                // Mid-stream card parsing
                const rMatch = fullText.match(/```restaurants\n([\s\S]*?)\n```/);
                if (rMatch) { try { setRestaurants(JSON.parse(rMatch[1])); } catch {} }
                const dMatch = fullText.match(/```dishes\n([\s\S]*?)\n```/);
                if (dMatch) { try { setDishes(JSON.parse(dMatch[1])); } catch {} }

                // Streaming TTS — speak first complete sentence immediately in voice mode
                if (mode === "voice" && !streamTTSStarted && displayText.length > 8) {
                  const sentenceMatch = displayText.match(/^(.{6,}?[.!?।])\s/);
                  if (sentenceMatch) {
                    streamTTSFirstText = sentenceMatch[1].trim();
                    streamTTSStarted = true;
                    setVoiceState("speaking");
                    setIsTTSSpeaking(true);
                    streamTTSPromise = playTTS(streamTTSFirstText); // fire immediately, don't await
                  }
                }
              }

              if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) => m.id === aiId ? { ...m, content: event.cleanText, streaming: false } : m)
                );
                if (event.restaurants) setRestaurants(event.restaurants);
                if (event.dishes) setDishes(event.dishes);
                if (event.orderDetails) setPendingOrder(event.orderDetails);
                if (event.clarification) setClarification(event.clarification);

                if (mode === "voice" && event.shouldSpeak && event.cleanText) {
                  if (streamTTSStarted && streamTTSPromise) {
                    await streamTTSPromise;
                    // Slice by character count — avoids mismatch from .replace() when
                    // cleanText has minor whitespace differences from the streamed version
                    const remaining = event.cleanText.slice(streamTTSFirstText.length).trim();
                    if (remaining) await playTTS(remaining);
                  } else {
                    setVoiceState("speaking");
                    setIsTTSSpeaking(true);
                    await playTTS(event.cleanText);
                  }
                }
                // BUG-010 fix: always reset TTS state regardless of shouldSpeak
                // (streaming TTS may have set isTTSSpeaking=true even when shouldSpeak is false)
                setIsTTSSpeaking(false);
                // BUG-009 fix: read current isVoiceMode from ref, not stale closure
                setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
              }
            } catch {}
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: "Sorry, hit a snag. Try again!", streaming: false }
              : m
          )
        );
        setVoiceState(isVoiceMode ? "listening" : "idle");
      }
    },
    [messages, voiceState, isVoiceMode, activeProfile, allProfiles, weather]
  );

  // Memoized voice callbacks
  const handleFinalTranscript = useCallback(
    (text: string) => sendMessage(text, "voice"),
    [sendMessage]
  );
  const handleListeningChange = useCallback(
    (l: boolean) => {
      if (isVoiceMode && !isTTSSpeaking) setVoiceState(l ? "listening" : "idle");
    },
    [isVoiceMode, isTTSSpeaking]
  );

  const handleClarificationSelect = useCallback(
    (option: string) => {
      setClarification(null);
      sendMessage(option, isVoiceMode ? "voice" : "text");
    },
    [sendMessage, isVoiceMode]
  );

  const toggleVoiceMode = () => {
    const next = !isVoiceMode;
    setIsVoiceMode(next);
    setVoiceState(next ? "listening" : "idle");
    setInterimText("");
  };

  const handleConfirmOrder = useCallback(async () => {
    if (!pendingOrder) return;
    setOrderPlaced(pendingOrder);
    setPendingOrder(null);
    // BUG-008 fix: use current voice mode so Aaru speaks the confirmation in voice mode
    await sendMessage(
      `Yes, confirm the order from ${pendingOrder.restaurant.name} on ${pendingOrder.platform}.`,
      isVoiceModeRef.current ? "voice" : "text"
    );
  }, [pendingOrder, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, "text");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input, "text");
    }
  };

  const displayInput = interimText || input;

  return (
    <div className="flex flex-col h-screen bg-[#FAFAF9]">
      <VoiceInput
        isVoiceMode={isVoiceMode}
        isSpeaking={isTTSSpeaking}
        onInterimTranscript={setInterimText}
        onFinalTranscript={handleFinalTranscript}
        onListeningChange={handleListeningChange}
      />

      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md px-4 py-3 flex items-center justify-between flex-shrink-0 z-30">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-xl">🍽️</span>
          <span className="font-bold text-stone-900 group-hover:text-amber-600 transition-colors">Aaru</span>
        </Link>

        <div className="flex items-center gap-2">
          {isSeeding && (
            <span className="text-xs text-stone-400 animate-pulse">Syncing Zomato...</span>
          )}

          <ProfileManager
            activeProfile={activeProfile}
            profiles={allProfiles}
            preloadedAddresses={preloadedAddresses}
            onProfileChange={setActiveProfile}
            onAllProfilesChange={setAllProfiles}
          />

          <motion.button
            onClick={toggleVoiceMode}
            whileTap={{ scale: 0.93 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isVoiceMode
                ? "bg-amber-500 text-white shadow-md shadow-amber-200"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {isVoiceMode ? (
              <>
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>🎤</motion.span>
                Voice ON
              </>
            ) : (
              <><span>🎤</span> Voice</>
            )}
          </motion.button>

          {weather && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-stone-500 bg-stone-100 px-2 py-1 rounded-full">
              {weather.isHot ? "☀️" : weather.isRaining ? "🌧️" : "🌤️"} {weather.tempC}°C
            </span>
          )}
        </div>
      </header>

      {/* Auto-seed name prompt — shown when profile name is generic */}
      <AnimatePresence>
        {activeProfile && (activeProfile.name === "Me" || activeProfile.name === "") && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-3 text-sm"
          >
            <span className="text-amber-600">👤</span>
            <span className="text-stone-700 flex-1">What should Aaru call you?</span>
            <NameInput
              onSave={(name) => {
                const updated = { ...activeProfile, name };
                saveProfile(updated);
                setActiveProfile(updated);
                setAllProfiles(getAllProfiles());
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
              🎉 Ordered from <strong>{orderPlaced.restaurant.name}</strong> via {orderPlaced.platform}! ~{orderPlaced.estimatedDelivery} min.
            </span>
            <button onClick={() => setOrderPlaced(null)} className="text-green-600 text-lg ml-4">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <ChatMessages messages={messages} />

        {/* Quick chips */}
        <AnimatePresence>
          {chipsVisible && messages.length <= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="px-4 pb-2"
            >
              <p className="text-xs text-stone-400 mb-2 px-1">Quick picks</p>
              <div className="flex gap-2 flex-wrap">
                {quickChips.map((chip) => (
                  <motion.button
                    key={chip.label}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => sendMessage(chip.query, "text")}
                    className="flex items-center gap-1.5 bg-white border border-stone-200 hover:border-amber-300 hover:bg-amber-50 text-stone-700 text-sm font-medium px-4 py-2 rounded-2xl transition-all shadow-sm"
                  >
                    <span>{chip.emoji}</span> {chip.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
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

        {/* Dish cards */}
        <AnimatePresence>
          {dishes && !isThinking && (
            <DishCards
              dishes={dishes}
              onSelect={(dish) =>
                setPendingOrder({
                  restaurant: {
                    id: `${dish.restaurantName}-${dish.platform}`,
                    name: dish.restaurantName,
                    cuisine: dish.dishName,
                    rating: dish.rating,
                    deliveryTime: dish.deliveryTime ?? 30,
                    price: dish.price,
                    platform: dish.platform,
                  },
                  item: dish.dishName,
                  price: dish.price,
                  platform: dish.platform,
                  estimatedDelivery: dish.deliveryTime ?? 30,
                })
              }
            />
          )}
        </AnimatePresence>

        {/* Clarification chips */}
        <AnimatePresence>
          {clarification && !isThinking && (
            <ClarificationChips
              question={clarification.question}
              options={clarification.options}
              onSelect={handleClarificationSelect}
              disabled={isThinking}
            />
          )}
        </AnimatePresence>

        <div className="h-4" />
      </div>

      <VoiceStatusBar state={voiceState} />

      {/* Input bar */}
      <div className="border-t border-stone-200 bg-white/90 backdrop-blur-md px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={displayInput}
              onChange={(e) => { setInput(e.target.value); setInterimText(""); }}
              onKeyDown={handleKeyDown}
              placeholder={isVoiceMode ? "Listening... speak now 🎤" : "Ask Aaru what to eat..."}
              rows={1}
              disabled={isThinking || isTTSSpeaking}
              className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50 max-h-32 overflow-y-auto leading-relaxed transition-colors ${
                interimText ? "bg-amber-50 border-amber-300" : "bg-stone-50 border-stone-200"
              }`}
              readOnly={!!interimText}
            />
            {interimText && (
              <span className="absolute right-3 bottom-3 text-xs text-amber-500 font-medium">speaking...</span>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={!input.trim() || isThinking || isTTSSpeaking}
            whileTap={{ scale: 0.93 }}
            className="mb-1 w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-md shadow-amber-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </motion.button>
        </form>
      </div>

      <OrderConfirmation
        order={pendingOrder}
        onConfirm={handleConfirmOrder}
        onCancel={() => setPendingOrder(null)}
      />
    </div>
  );
}

// Inline name input component for the onboarding banner
function NameInput({ onSave }: { onSave: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSave(value.trim()); }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Your name"
        className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-400 w-28"
        autoFocus
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1 transition-colors"
      >
        Save
      </button>
    </form>
  );
}
