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
import AddressPickerSheet from "@/components/AddressPickerSheet";
import ProfileManager from "@/components/ProfileManager";
import AIThinking from "@/components/AIThinking";
import SettingsModal from "@/components/SettingsModal";
import SetupWizard, { UserKeys } from "@/components/SetupWizard";
import type { VoiceInputHandle } from "@/components/VoiceInput";
import TrialBanner from "@/components/TrialBanner";
import CartDrawer from "@/components/CartDrawer";
import InstamartGrid from "@/components/InstamartGrid";
import DineoutPicker from "@/components/DineoutPicker";
import OrderTracker from "@/components/OrderTracker";
import {
  Message, InputMode, Restaurant, OrderDetails,
  WeatherContext, VoiceState, QuickChip, Dish, ClarificationBlock,
  CartBlock, InstamartBlock, DineoutBlock, OrderStatusBlock,
} from "@/lib/types";
import { PersonProfile, PersonAddress, PastOrder } from "@/lib/profiles/types";
import { getAllProfiles, saveProfile, newProfileId, addMemory, setMemories } from "@/lib/profiles/store";

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

// Fetch with abort timeout — used for profile-seeding calls on mount
function fetchWithTimeout<T>(url: string, fallback: T, ms = 8000): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal })
    .then((r) => r.json() as Promise<T>)
    .catch(() => fallback)
    .finally(() => clearTimeout(id));
}

// Shared AudioContext — once resumed from a user gesture, stays unlocked all session
let sharedAudioCtx: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;

function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioCtx;
}

function stopActiveAudio() {
  try { activeSource?.stop(); } catch {}
  activeSource = null;
}

async function playTTS(text: string, elevenLabsKey?: string): Promise<void> {
  stopActiveAudio();
  return new Promise((resolve, reject) => {
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, elevenLabsKey }),
    })
      .then((r) => {
        const ct = r.headers.get("Content-Type") ?? "";
        if (!r.ok || !ct.includes("audio")) return Promise.reject(new Error("not audio"));
        return r.arrayBuffer();
      })
      .then(async (buffer) => {
        const ctx = getAudioCtx();
        // Ensure context is running (iOS suspends it between gestures)
        if (ctx.state === "suspended") await ctx.resume();
        const audioBuffer = await ctx.decodeAudioData(buffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        activeSource = source;
        source.onended = () => { activeSource = null; resolve(); };
        source.start(0);
      })
      .catch((err) => reject(err));
  });
}

const LEARNING_SIGNAL = /\b(don'?t|never|always|prefer|hate|love|allergic|remember|told you|wrong|actually|favourite|dislike|not again|bored of|i'?m|vegan|vegetarian|keto|lactose|avoid|stop|please no)\b/i;

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
  const [pendingOrderNoAddr, setPendingOrderNoAddr] = useState<OrderDetails | null>(null);
  const [orderPlaced, setOrderPlaced] = useState<OrderDetails | null>(null);
  const [activeProfile, setActiveProfile] = useState<PersonProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<PersonProfile[]>([]);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [quickChips] = useState<QuickChip[]>(getQuickChips());
  const [chipsVisible, setChipsVisible] = useState(true);
  const [preloadedAddresses, setPreloadedAddresses] = useState<{ address_id: string; location_name: string }[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [userKeys, setUserKeys] = useState<UserKeys>({ anthropicKey: "", elevenLabsKey: "", zomatoToken: "", swiggyToken: "", tier: "trial" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [trialUsed, setTrialUsed] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartBlock | null>(null);
  const [instamartItems, setInstamartItems] = useState<InstamartBlock | null>(null);
  const [dineoutOptions, setDineoutOptions] = useState<DineoutBlock | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderStatusBlock | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);

  // Onboarding state machine
  type OnboardingStep = null | "diet" | "budget" | "cuisines" | "done";
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(null);
  const [onboardingTargetId, setOnboardingTargetId] = useState<string>("");

  const isThinking = voiceState === "thinking";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceInputRef = useRef<VoiceInputHandle>(null);
  const isVoiceModeRef = useRef(isVoiceMode);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);

  // ── iOS AudioContext unlock — resume shared ctx on first user gesture ────────
  useEffect(() => {
    const unlock = () => {
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume().then(() => {
          // Play 1 frame of silence so iOS marks this context as "user-activated"
          const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        }).catch(() => {});
      }
    };
    document.addEventListener("touchstart", unlock, { once: true, capture: true });
    document.addEventListener("click", unlock, { once: true, capture: true });
    return () => {
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("click", unlock, true);
    };
  }, []);

  // ── Theme + user keys + trial init ───────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("aaru-theme") as "dark" | "light" | null;
    const initial = saved ?? "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);

    try {
      const raw = localStorage.getItem("aaru-user-keys");
      if (raw) setUserKeys((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {}

    const used = parseInt(localStorage.getItem("aaru-trial-msgs-used") ?? "0", 10);
    setTrialUsed(isNaN(used) ? 0 : used);

    // Read OAuth tokens passed back via URL params after OAuth redirect
    const params = new URLSearchParams(window.location.search);
    const swiggyToken = params.get("swiggy_token");
    const zomatoToken = params.get("zomato_token");
    if (swiggyToken || zomatoToken) {
      setUserKeys((prev) => {
        const next = { ...prev, ...(swiggyToken ? { swiggyToken, tier: "full" as const } : {}), ...(zomatoToken ? { zomatoToken, tier: "full" as const } : {}) };
        localStorage.setItem("aaru-user-keys", JSON.stringify(next));
        return next;
      });
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Auto-open wizard on first visit
    if (!localStorage.getItem("aaru-setup-seen")) {
      setTimeout(() => setWizardOpen(true), 600);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("aaru-theme", next);
  };

  // ── On mount: load profiles and pre-fetch everything in parallel ──────────────
  useEffect(() => {
    const existing = getAllProfiles();

    function syncMemoriesForProfile(profile: PersonProfile) {
      fetch(`/api/memories?profileName=${encodeURIComponent(profile.name)}`)
        .then((r) => r.json())
        .then(({ memories }: { memories: string[] }) => {
          if (memories.length > 0) {
            setMemories(profile.id, memories);
            setActiveProfile((prev) => prev ? { ...prev, memories } : prev);
          }
        })
        .catch(() => {});
    }

    if (existing.length > 0) {
      setAllProfiles(existing);
      setActiveProfile(existing[0]);
      fetch("/api/addresses").then((r) => r.json()).then(setPreloadedAddresses).catch(() => {});
      syncMemoriesForProfile(existing[0]);
      // Merge in any additional profiles from KV (e.g. added on another device)
      fetch("/api/profiles")
        .then((r) => r.json())
        .then(({ profiles: kvProfiles }: { profiles: PersonProfile[] }) => {
          if (!Array.isArray(kvProfiles) || kvProfiles.length === 0) return;
          const localIds = new Set(getAllProfiles().map((p) => p.id));
          const newOnes = kvProfiles.filter((p) => !localIds.has(p.id));
          if (newOnes.length > 0) {
            newOnes.forEach(saveProfile);
            setAllProfiles(getAllProfiles());
          }
        })
        .catch(() => {});
      return;
    }

    // No local profiles — check KV first before seeding from Zomato
    setIsSeeding(true);
    fetch("/api/profiles")
      .then((r) => r.json())
      .then(({ profiles: kvProfiles }: { profiles: PersonProfile[] }) => {
        if (Array.isArray(kvProfiles) && kvProfiles.length > 0) {
          kvProfiles.forEach(saveProfile);
          setAllProfiles(kvProfiles);
          setActiveProfile(kvProfiles[0]);
          setIsSeeding(false);
          fetch("/api/addresses").then((r) => r.json()).then(setPreloadedAddresses).catch(() => {});
          syncMemoriesForProfile(kvProfiles[0]);
          return;
        }
        seedFromZomato();
      })
      .catch(() => seedFromZomato());

    function seedFromZomato() {
      Promise.all([
      fetchWithTimeout<{ address_id: string; location_name: string }[]>("/api/addresses", [], 8000),
      fetchWithTimeout<{ name: string | null; diet?: string; budgetRange?: string; preferredCuisines?: string[]; allergies?: string[] }>("/api/user", { name: null }, 8000),
      fetchWithTimeout<any[]>("/api/orders", [], 8000),
      fetchWithTimeout<any[]>("/api/contacts", [], 8000),
      fetchWithTimeout<any[]>("/api/swiggy-orders", [], 8000),
    ]).then(([addresses, userInfo, orders, contacts, swiggyOrders]) => {
      const safeOrders = Array.isArray(orders) ? orders : [];
      const safeSwiggy = Array.isArray(swiggyOrders) ? swiggyOrders : [];
      const allOrders = [...safeOrders, ...safeSwiggy]
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
      setIsSeeding(false);
      // Save newly seeded profiles to KV for cross-device access
      fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles: allNew }),
      }).catch(() => {});
    }).catch(() => setIsSeeding(false));
    } // end seedFromZomato
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

  // ── Order select — address picker logic ───────────────────────────────────────
  const handleOrderSelect = useCallback((order: OrderDetails) => {
    if (activeProfile && activeProfile.addresses.length > 1) {
      setPendingOrderNoAddr(order);
    } else {
      const addr = activeProfile?.addresses[0];
      setPendingOrder({
        ...order,
        deliveryAddress: addr
          ? { label: addr.label, locationName: addr.locationName, addressId: addr.addressId }
          : undefined,
      });
    }
  }, [activeProfile]);

  const handleAddressPicked = useCallback((addr: PersonAddress) => {
    if (!pendingOrderNoAddr) return;
    setPendingOrderNoAddr(null);
    setPendingOrder({
      ...pendingOrderNoAddr,
      deliveryAddress: { label: addr.label, locationName: addr.locationName, addressId: addr.addressId },
    });
  }, [pendingOrderNoAddr]);

  const trialExhausted = !userKeys.anthropicKey && trialUsed >= 50;

  // ── Core send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string, mode: InputMode = "text") => {
      if (!text.trim() || voiceState === "thinking") return;
      if (trialExhausted) { setWizardOpen(true); return; }

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
            anthropicKey: userKeys.anthropicKey || undefined,
            zomatoToken: userKeys.zomatoToken || undefined,
            swiggyToken: userKeys.swiggyToken || undefined,
            isTrial: !userKeys.anthropicKey,
          }),
        });

        if (!res.body) throw new Error("No response body from server");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let gotDone = false;

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

              if (event.type === "token_expired") {
                setTokenExpired(true);
                setMessages((prev) =>
                  prev.map((m) => m.id === aiId ? { ...m, content: "Your Swiggy/Zomato session expired. Reconnect in Settings to continue ordering.", streaming: false } : m)
                );
                setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
                gotDone = true;
              }

              if (event.type === "error") {
                setMessages((prev) =>
                  prev.map((m) => m.id === aiId ? { ...m, content: event.message || "Something went wrong. Try again!", streaming: false } : m)
                );
                setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
                gotDone = true;
              }

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

                const rMatch = fullText.match(/```restaurants\n([\s\S]*?)\n```/);
                if (rMatch) { try { setRestaurants(JSON.parse(rMatch[1])); } catch {} }
                const dMatch = fullText.match(/```dishes\n([\s\S]*?)\n```/);
                if (dMatch) { try { setDishes(JSON.parse(dMatch[1])); } catch {} }

                if (mode === "voice" && !streamTTSStarted && displayText.length > 8) {
                  const sentenceMatch = displayText.match(/^(.{6,}?[.!?।])\s/);
                  if (sentenceMatch) {
                    streamTTSFirstText = sentenceMatch[1].trim();
                    streamTTSStarted = true;
                    setVoiceState("speaking");
                    setIsTTSSpeaking(true);
                    streamTTSPromise = playTTS(streamTTSFirstText, userKeys.elevenLabsKey || undefined)
                      .catch(() => { setVoiceError("Voice output failed — check your ElevenLabs key in Settings."); });
                  }
                }
              }

              if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) => m.id === aiId ? { ...m, content: event.cleanText, streaming: false } : m)
                );
                // Increment trial counter if in trial mode
                if (!userKeys.anthropicKey) {
                  setTrialUsed((prev) => {
                    const next = prev + 1;
                    localStorage.setItem("aaru-trial-msgs-used", String(next));
                    return next;
                  });
                }
                if (event.restaurants) setRestaurants(event.restaurants);
                if (event.dishes) setDishes(event.dishes);
                if (event.orderDetails) handleOrderSelect(event.orderDetails);
                if (event.clarification) setClarification(event.clarification);
                if (event.instamartItems) setInstamartItems(event.instamartItems);
                if (event.dineoutVenues) setDineoutOptions(event.dineoutVenues);
                if (event.cart) setCart(event.cart);
                if (event.orderStatus) setActiveOrder(event.orderStatus);

                if (mode === "voice" && event.shouldSpeak && event.cleanText) {
                  try {
                    if (streamTTSStarted && streamTTSPromise) {
                      await streamTTSPromise;
                      const remaining = event.cleanText.slice(streamTTSFirstText.length).trim();
                      if (remaining) await playTTS(remaining, userKeys.elevenLabsKey || undefined);
                    } else {
                      setVoiceState("speaking");
                      setIsTTSSpeaking(true);
                      await playTTS(event.cleanText, userKeys.elevenLabsKey || undefined);
                    }
                  } catch {
                    setVoiceError("Voice output failed — check your ElevenLabs key in Settings.");
                  }
                }
                setIsTTSSpeaking(false);
                setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
                gotDone = true;

                // Background memory extraction — fires only on learning signals, zero latency impact
                if (activeProfile && LEARNING_SIGNAL.test(text) && event.cleanText) {
                  fetch("/api/extract-memory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userMessage: text,
                      assistantReply: event.cleanText,
                      profileName: activeProfile.name,
                    }),
                  })
                    .then((r) => r.json())
                    .then(({ fact }: { fact: string | null }) => {
                      if (fact && activeProfile) {
                        addMemory(activeProfile.id, fact);
                        setActiveProfile((prev) => prev
                          ? { ...prev, memories: [fact, ...(prev.memories ?? [])].slice(0, 30) }
                          : prev
                        );
                      }
                    })
                    .catch(() => {});
                }
              }
            } catch {}
          }
        }
        // Safety net: if stream closed without a done/error event, unblock the UI
        if (!gotDone) {
          setMessages((prev) =>
            prev.map((m) => m.id === aiId && m.streaming ? { ...m, streaming: false } : m)
          );
          setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
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
    [messages, voiceState, isVoiceMode, activeProfile, allProfiles, weather, handleOrderSelect]
  );

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

  // Sync profiles to KV whenever they change (background, cross-device)
  const handleAllProfilesChange = useCallback((updated: PersonProfile[]) => {
    setAllProfiles(updated);
    fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profiles: updated }),
    }).catch(() => {});
  }, []);

  const handleClarificationSelect = useCallback(
    (option: string) => {
      setClarification(null);
      sendMessage(option, isVoiceMode ? "voice" : "text");
    },
    [sendMessage, isVoiceMode]
  );

  // ── Onboarding helpers ────────────────────────────────────────────────────────
  function injectAaruMessage(content: string) {
    setMessages((prev) => [
      ...prev,
      { id: `onboarding-${Date.now()}`, role: "assistant", content, timestamp: new Date() },
    ]);
  }

  const ONBOARDING_PROMPTS: Record<string, string> = {
    diet: "Quick one — are you veg, non-veg, or do you eat both? (Tap to skip anytime)",
    budget: "What's your usual budget per meal?",
    cuisines: "Any cuisines you love? Pick all that apply, then tap Done.",
    done: "Got it! I'll keep these in mind for every recommendation. So — what are you craving? 🍱",
  };

  function getOnboardingChips(step: string): string[] {
    if (step === "diet") return ["🥦 Veg", "🍗 Non-veg", "🍽️ Both", "Skip"];
    if (step === "budget") return ["💰 Budget (<₹200)", "🍴 Mid (₹200–500)", "✨ Premium (₹500+)", "Skip"];
    if (step === "cuisines") return ["🍛 Indian", "🍕 Pizza", "🍜 Chinese", "🥙 Mughlai", "🥗 Healthy", "🍔 Fast food", "Done"];
    return [];
  }

  const handleOnboardingAnswer = useCallback((value: string) => {
    const profile = getAllProfiles().find((p) => p.id === onboardingTargetId) ?? activeProfile;
    if (!profile) return;

    if (value !== "Skip" && value !== "Done") {
      if (onboardingStep === "diet") {
        const diet: "veg" | "nonveg" | "both" = value.includes("Non") ? "nonveg" : value.includes("Veg") ? "veg" : "both";
        const updated = { ...profile, preferences: { ...profile.preferences, diet } };
        saveProfile(updated);
        if (profile.id === activeProfile?.id) setActiveProfile(updated);
      }
      if (onboardingStep === "budget") {
        const priceRange: "budget" | "mid" | "premium" = value.includes("Budget") ? "budget" : value.includes("Mid") ? "mid" : "premium";
        const updated = { ...profile, preferences: { ...profile.preferences, priceRange } };
        saveProfile(updated);
        if (profile.id === activeProfile?.id) setActiveProfile(updated);
      }
      if (onboardingStep === "cuisines") {
        const cuisine = value.replace(/^[^\w]+/, "").trim().split(" ")[0];
        const likes = [...new Set([...(profile.preferences.likes ?? []), cuisine])];
        const updated = { ...profile, preferences: { ...profile.preferences, likes } };
        saveProfile(updated);
        if (profile.id === activeProfile?.id) setActiveProfile(updated);
        return; // Stay on cuisines step — multiple picks until "Done"
      }
    }

    const nextMap: Record<string, OnboardingStep> = { diet: "budget", budget: "cuisines", cuisines: "done" };
    const nextStep = nextMap[onboardingStep ?? ""] ?? null;
    setOnboardingStep(nextStep);
    if (nextStep) injectAaruMessage(ONBOARDING_PROMPTS[nextStep]);
    handleAllProfilesChange(getAllProfiles());
  }, [onboardingStep, onboardingTargetId, activeProfile, handleAllProfilesChange]);

  // Start onboarding for a given profile id
  const startOnboarding = useCallback((profileId: string) => {
    setOnboardingTargetId(profileId);
    setOnboardingStep("diet");
    injectAaruMessage(ONBOARDING_PROMPTS.diet);
  }, []);

  // ── Order status polling ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeOrder || activeOrder.status === "delivered") return;
    const interval = setInterval(() => {
      sendMessage(
        `Check the current delivery status for my ${activeOrder.platform} order ${activeOrder.orderId}. Use MCP tools and return an order_status block.`,
        "text"
      );
    }, 120000); // every 2 minutes
    return () => clearInterval(interval);
  }, [activeOrder?.orderId, activeOrder?.status]);

  // Auto-dismiss orderPlaced banner after 6 seconds
  useEffect(() => {
    if (!orderPlaced) return;
    const t = setTimeout(() => setOrderPlaced(null), 6000);
    return () => clearTimeout(t);
  }, [orderPlaced]);

  const toggleVoiceMode = () => {
    const next = !isVoiceMode;
    setIsVoiceMode(next);
    setVoiceState(next ? "listening" : "idle");
    setInterimText("");
    // Call directly within the tap handler — preserves iOS gesture context
    if (next) {
      voiceInputRef.current?.startListening();
    } else {
      voiceInputRef.current?.stopListening();
    }
  };

  const handleConfirmOrder = useCallback(async () => {
    if (!pendingOrder) return;

    // Save to profile pastOrders optimistically
    if (activeProfile) {
      const newPastOrder: PastOrder = {
        restaurantName: pendingOrder.restaurant.name,
        itemName: pendingOrder.item,
        price: pendingOrder.price,
        platform: pendingOrder.platform,
        orderedAt: new Date().toISOString(),
      };
      const updated = {
        ...activeProfile,
        pastOrders: [newPastOrder, ...(activeProfile.pastOrders ?? [])].slice(0, 20),
      };
      saveProfile(updated);
      setActiveProfile(updated);
      handleAllProfilesChange(getAllProfiles());
    }

    setOrderPlaced(pendingOrder);
    setPendingOrder(null);

    const addr = pendingOrder.deliveryAddress?.locationName ?? "my saved home address";
    await sendMessage(
      `Place an order for ${pendingOrder.item} (₹${pendingOrder.price}) from ${pendingOrder.restaurant.name} on ${pendingOrder.platform} to ${addr}. Use the ${pendingOrder.platform} MCP tools to complete the order now, then return an order_status block with the orderId and status.`,
      isVoiceModeRef.current ? "voice" : "text"
    );
  }, [pendingOrder, activeProfile, sendMessage, handleAllProfilesChange]);

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
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>
      <VoiceInput
        ref={voiceInputRef}
        isVoiceMode={isVoiceMode}
        isSpeaking={isTTSSpeaking}
        onInterimTranscript={setInterimText}
        onFinalTranscript={handleFinalTranscript}
        onListeningChange={handleListeningChange}
        onError={(msg) => { setVoiceError(msg); setIsVoiceMode(false); setVoiceState("idle"); }}
      />

      {/* Header */}
      <header
        className="px-4 py-3 flex items-center justify-between flex-shrink-0 z-30"
        style={{
          backgroundColor: "var(--header-bg)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-lg">🔥</span>
          <span className="font-bold text-base tracking-tight" style={{ color: "var(--text)" }}>
            aaru
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Syncing indicator */}
          {isSeeding && (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="text-xs px-2 py-1 rounded-full"
              style={{ color: "var(--accent-2)", backgroundColor: "rgba(255,122,0,0.08)", border: "1px solid rgba(255,122,0,0.15)" }}
            >
              Syncing...
            </motion.span>
          )}

          <ProfileManager
            activeProfile={activeProfile}
            profiles={allProfiles}
            preloadedAddresses={preloadedAddresses}
            onProfileChange={setActiveProfile}
            onAllProfilesChange={handleAllProfilesChange}
          />

          {/* Settings */}
          <motion.button
            onClick={() => userKeys.anthropicKey ? setSettingsOpen(true) : setWizardOpen(true)}
            whileTap={{ scale: 0.93 }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
            style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
            title="Settings"
          >
            ⚙️
          </motion.button>

          {/* Theme toggle */}
          <motion.button
            onClick={toggleTheme}
            whileTap={{ scale: 0.93 }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
            style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </motion.button>

          {/* Weather */}
          {weather && (
            <span
              className="hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-full"
              style={{ color: "var(--text-muted)", backgroundColor: "var(--surface-2)" }}
            >
              {weather.isHot ? "☀️" : weather.isRaining ? "🌧️" : "🌤️"} {weather.tempC}°C
            </span>
          )}
        </div>
      </header>

      {/* Trial banner */}
      <AnimatePresence>
        {!userKeys.anthropicKey && trialUsed < 50 && (
          <TrialBanner used={trialUsed} onUpgrade={() => setWizardOpen(true)} />
        )}
      </AnimatePresence>

      {/* Voice error banner */}
      <AnimatePresence>
        {voiceError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
            style={{ backgroundColor: "rgba(220,38,38,0.08)", borderBottom: "1px solid rgba(220,38,38,0.18)", color: "#DC2626" }}
          >
            <span>🎤 {voiceError}</span>
            <button onClick={() => setVoiceError(null)} className="opacity-60 hover:opacity-100 text-base leading-none">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name prompt banner */}
      <AnimatePresence>
        {activeProfile && (activeProfile.name === "Me" || activeProfile.name === "") && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 flex items-center gap-3 text-sm"
            style={{
              backgroundColor: "rgba(255,69,0,0.06)",
              borderBottom: "1px solid rgba(255,69,0,0.12)",
            }}
          >
            <span>👤</span>
            <span className="flex-1" style={{ color: "var(--text)" }}>What should Aaru call you?</span>
            <NameInput
              onSave={(name) => {
                const updated = { ...activeProfile, name };
                saveProfile(updated);
                setActiveProfile(updated);
                handleAllProfilesChange(getAllProfiles());
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token expired banner */}
      <AnimatePresence>
        {tokenExpired && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
            style={{ backgroundColor: "rgba(234,179,8,0.08)", borderBottom: "1px solid rgba(234,179,8,0.2)", color: "#CA8A04" }}
          >
            <span>⚠️ Swiggy/Zomato session expired — reconnect in Settings</span>
            <button onClick={() => { setTokenExpired(false); setWizardOpen(true); }} className="font-semibold underline">Reconnect</button>
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
            className="px-4 py-3 text-sm font-medium flex items-center justify-between"
            style={{
              backgroundColor: "rgba(34,197,94,0.08)",
              borderBottom: "1px solid rgba(34,197,94,0.15)",
              color: "#22C55E",
            }}
          >
            <span>
              🎉 Ordering from <strong>{orderPlaced.restaurant.name}</strong> via {orderPlaced.platform} — ~{orderPlaced.estimatedDelivery} min delivery
            </span>
            <button onClick={() => setOrderPlaced(null)} className="text-lg ml-4 opacity-60 hover:opacity-100">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order tracker — live delivery status */}
      <AnimatePresence>
        {activeOrder && (
          <OrderTracker
            order={activeOrder}
            onViewInApp={() => {
              const url = activeOrder.platform === "swiggy"
                ? `https://www.swiggy.com/order/${activeOrder.orderId}`
                : `https://www.zomato.com/order/${activeOrder.orderId}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
            onDismiss={() => setActiveOrder(null)}
          />
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
              <p className="text-xs mb-2 px-1" style={{ color: "var(--text-muted)" }}>Quick picks</p>
              <div className="flex gap-2 flex-wrap">
                {quickChips.map((chip) => (
                  <motion.button
                    key={chip.label}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => sendMessage(chip.query, "text")}
                    className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-2xl transition-all"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,69,0,0.3)";
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,69,0,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface)";
                    }}
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
              onSelect={handleOrderSelect}
            />
          )}
        </AnimatePresence>

        {/* Dish cards */}
        <AnimatePresence>
          {dishes && !isThinking && (
            <DishCards
              dishes={dishes}
              onSelect={(dish) =>
                handleOrderSelect({
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

        {/* Onboarding preference chips */}
        <AnimatePresence>
          {onboardingStep && onboardingStep !== "done" && !isThinking && (
            <ClarificationChips
              question=""
              options={getOnboardingChips(onboardingStep)}
              onSelect={handleOnboardingAnswer}
              disabled={isThinking}
            />
          )}
        </AnimatePresence>

        {/* Instamart grocery grid */}
        <AnimatePresence>
          {instamartItems && !isThinking && (
            <InstamartGrid
              data={instamartItems}
              onAddItem={(itemName) => {
                sendMessage(`Add ${itemName} to my Instamart cart`, "text");
              }}
            />
          )}
        </AnimatePresence>

        {/* Dineout restaurant picker */}
        <AnimatePresence>
          {dineoutOptions && !isThinking && (
            <DineoutPicker
              data={dineoutOptions}
              onBook={(restaurantName, slot, partySize, date) => {
                sendMessage(
                  `Book a table for ${partySize} at ${restaurantName} at ${slot}${date ? ` on ${date}` : " today"} using Swiggy Dineout MCP tools.`,
                  "text"
                );
                setDineoutOptions(null);
              }}
            />
          )}
        </AnimatePresence>

        {/* AI thinking indicator */}
        <AnimatePresence>
          {isThinking && <AIThinking />}
        </AnimatePresence>

        <div className="h-4" />
      </div>

      <VoiceStatusBar state={voiceState} />

      {/* Input bar */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{
          backgroundColor: "var(--input-bg)",
          backdropFilter: "blur(16px)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={displayInput}
              onChange={(e) => { setInput(e.target.value); setInterimText(""); }}
              onKeyDown={handleKeyDown}
              placeholder={isVoiceMode ? "Listening… speak now" : "Ask aaru what to eat..."}
              rows={1}
              disabled={isThinking || isTTSSpeaking}
              className="w-full resize-none rounded-2xl px-4 py-3 text-sm leading-relaxed disabled:opacity-50 max-h-32 focus:outline-none transition-all placeholder:opacity-40"
              style={{
                backgroundColor: interimText ? "rgba(255,69,0,0.06)" : "var(--surface)",
                border: `1px solid ${interimText ? "rgba(255,69,0,0.25)" : "var(--border)"}`,
                color: "var(--text)",
                boxShadow: "none",
              }}
              onFocus={(e) => {
                if (!interimText) e.currentTarget.style.borderColor = "rgba(255,69,0,0.35)";
              }}
              onBlur={(e) => {
                if (!interimText) e.currentTarget.style.borderColor = "var(--border)";
              }}
              readOnly={!!interimText}
            />
            {interimText && (
              <span className="absolute right-3 bottom-3 text-xs font-medium" style={{ color: "var(--accent)" }}>
                speaking...
              </span>
            )}
          </div>

          {/* Mic button — right next to send, thumb-reachable */}
          <motion.button
            type="button"
            onClick={toggleVoiceMode}
            whileTap={{ scale: 0.93 }}
            className="mb-1 w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={isVoiceMode ? {
              background: "linear-gradient(135deg, #FF4500, #FF7A00)",
              boxShadow: "0 0 16px rgba(255,69,0,0.45)",
            } : {
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
            title={isVoiceMode ? "Stop voice" : "Voice input"}
          >
            {isVoiceMode ? (
              <motion.span
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="text-lg"
              >
                🎤
              </motion.span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: "var(--text-muted)" }}>
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              </svg>
            )}
          </motion.button>

          {/* Send button */}
          <motion.button
            type="submit"
            disabled={!input.trim() || isThinking || isTTSSpeaking}
            whileTap={{ scale: 0.93 }}
            className="mb-1 w-11 h-11 rounded-full text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #FF4500, #FF7A00)", boxShadow: "0 4px 12px rgba(255,69,0,0.25)" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </motion.button>
        </form>
      </div>

      {/* Cart drawer */}
      {cart && (
        <CartDrawer
          cart={cart}
          onCheckout={() => {
            sendMessage(
              `Checkout and place the order for ${cart.items.map((i) => i.dishName).join(", ")} from ${cart.restaurantName} on ${cart.platform} to my home address. Use ${cart.platform} MCP tools to complete the order and return an order_status block.`,
              "text"
            );
            setCart(null);
          }}
          onClear={() => setCart(null)}
        />
      )}

      {/* Address picker sheet — shown before OrderConfirmation when user has multiple addresses */}
      {pendingOrderNoAddr && activeProfile && (
        <AddressPickerSheet
          addresses={activeProfile.addresses}
          onSelect={handleAddressPicked}
          onCancel={() => setPendingOrderNoAddr(null)}
        />
      )}

      <OrderConfirmation
        order={pendingOrder}
        onConfirm={handleConfirmOrder}
        onCancel={() => setPendingOrder(null)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(keys) => setUserKeys((prev) => ({ ...prev, ...keys }))}
      />

      <SetupWizard
        open={wizardOpen}
        onClose={(keys) => {
          setUserKeys(keys);
          setWizardOpen(false);
          // Start preference onboarding for new users with no prefs set
          if (activeProfile && activeProfile.preferences.likes.length === 0 && !activeProfile.preferences.notes) {
            setTimeout(() => startOnboarding(activeProfile.id), 400);
          }
        }}
        initialStep={trialExhausted ? 1 : 0}
      />
    </div>
  );
}

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
        className="rounded-full px-3 py-1 text-xs focus:outline-none w-28"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid rgba(255,69,0,0.25)",
          color: "var(--text)",
        }}
        autoFocus
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-full text-white text-xs font-semibold px-3 py-1 disabled:opacity-40 transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #FF4500, #FF7A00)" }}
      >
        Save
      </button>
    </form>
  );
}
