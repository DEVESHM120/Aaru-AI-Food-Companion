"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
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
import CartDrawer from "@/components/CartDrawer";
import InstamartGrid from "@/components/InstamartGrid";
import DineoutPicker from "@/components/DineoutPicker";
import OrderTracker from "@/components/OrderTracker";
import TrialLimitModal from "@/components/TrialLimitModal";
import {
  Message, InputMode, Restaurant, OrderDetails,
  WeatherContext, VoiceState, QuickChip, Dish, ClarificationBlock,
  CartBlock, InstamartBlock, DineoutBlock, OrderStatusBlock,
} from "@/lib/types";
import { PersonProfile, PersonAddress, PastOrder } from "@/lib/profiles/types";
import { getAllProfiles, saveProfile, newProfileId, addMemory, setMemories } from "@/lib/profiles/store";
import { buildConversationContext } from "@/lib/conversationContext";

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
let browserTTSActive = false;

function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioCtx;
}

function stopActiveAudio() {
  try { activeSource?.stop(); } catch {}
  activeSource = null;
  if (browserTTSActive) {
    try { window.speechSynthesis.cancel(); } catch {}
    browserTTSActive = false;
  }
}

function playBrowserTTS(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    synth.cancel(); // iOS: must cancel before speaking

    const speak = () => {
      const voices = synth.getVoices();
      const voice =
        voices.find(v => v.lang.startsWith("en-IN")) ??
        voices.find(v => v.lang.startsWith("en-US")) ??
        voices.find(v => v.lang.startsWith("en")) ?? null;

      const utt = new SpeechSynthesisUtterance(text);
      if (voice) utt.voice = voice;
      utt.rate = 1.05;
      utt.pitch = 1.0;
      browserTTSActive = true;
      utt.onend = () => { browserTTSActive = false; resolve(); };
      utt.onerror = (e) => {
        browserTTSActive = false;
        if (e.error === "interrupted") { resolve(); return; }
        reject(new Error(`Browser TTS error: ${e.error}`));
      };
      synth.speak(utt);
    };

    const voices = synth.getVoices();
    if (voices.length > 0) {
      speak();
    } else {
      // Chrome loads voices async
      const timeout = setTimeout(speak, 800);
      synth.addEventListener("voiceschanged", function handler() {
        clearTimeout(timeout);
        synth.removeEventListener("voiceschanged", handler);
        speak();
      }, { once: true });
    }
  });
}

async function playTTS(text: string, elevenLabsKey?: string): Promise<void> {
  stopActiveAudio();
  try {
    await new Promise<void>((resolve, reject) => {
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
  } catch {
    // ElevenLabs failed — silently fall back to browser speech synthesis
    await playBrowserTTS(text);
  }
}

const LEARNING_SIGNAL = /\b(don'?t|never|always|prefer|hate|love|allergic|remember|told you|wrong|actually|favourite|dislike|not again|bored of|i'?m|vegan|vegetarian|keto|lactose|avoid|stop|please no)\b/i;

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z\s'’-]/g, " ").replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function mergeNotes(existing: string, addition: string) {
  const parts = [existing.trim(), addition.trim()].filter(Boolean);
  const merged = parts.join(" ");
  return merged.replace(/\s+/g, " ").trim();
}

function extractFoodDislikes(text: string): string[] {
  const lowered = text.toLowerCase();
  const disliked = new Set<string>();
  const knownItems = [
    "idli", "dosa", "poha", "paratha", "uttapam", "upma", "vada", "sambar",
    "biryani", "pizza", "burger", "paneer", "momo", "noodles", "pasta",
    "south indian", "north indian", "chinese", "italian", "sweets", "dessert",
  ];

  const hasDislikeCue = /\b(i\s+don'?t\s+like|i\s+dont\s+like|i\s+hate|hate|dislike|avoid|never recommend|not again|please no|no more|stop recommending|don'?t recommend|dont recommend|no)\b/i.test(lowered);
  if (!hasDislikeCue) return [];

  for (const item of knownItems) {
    const itemPattern = item.replace(/\s+/g, "\\s+");
    if (new RegExp(`\\b${itemPattern}\\b`, "i").test(lowered)) {
      disliked.add(titleCase(item));
    }
  }

  const direct = lowered.match(/\b(?:i\s+don'?t\s+like|i\s+dont\s+like|i\s+hate|hate|dislike|avoid|never recommend|don'?t recommend|dont recommend|please no|no more|no)\s+([a-z][a-z\s-]{1,30})\b/i)?.[1];
  if (direct) {
    const cleaned = direct
      .replace(/\b(food|dish|dishes|please|again|anymore|from now|for me)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned && cleaned.length <= 24) disliked.add(titleCase(cleaned));
  }

  return [...disliked];
}

function isPreferenceOnlyUpdate(text: string) {
  return /\b(i\s+don'?t\s+like|i\s+dont\s+like|i\s+hate|hate|dislike|avoid|never recommend|don'?t recommend|dont recommend|please no|no more|stop recommending)\b/i.test(text)
    && !/\b(what should|recommend|suggest|show me|order|add|cart|checkout|place)\b/i.test(text);
}

function extractCity(locationName: string): string {
  const parts = locationName.split(",");
  for (const part of parts.reverse()) {
    const trimmed = part.trim();
    if (trimmed && trimmed.length > 2 && !trimmed.match(/^\d/)) return trimmed;
  }
  return "Delhi";
}

function normalizeSwiggyAddresses(addresses: Record<string, string>[]): PersonAddress[] {
  return addresses
    .map((a, i) => {
      const locationName = a.address ?? a.formatted_address ?? a.locationName ?? a.location_name ?? "";
      return {
        addressId: a.address_id ?? a.id ?? `swiggy_${i}`,
        label: a.name ?? a.label ?? (i === 0 ? "Home" : `Address ${i + 1}`),
        locationName,
        city: a.city ?? extractCity(locationName),
      };
    })
    .filter((a) => a.addressId && a.locationName);
}

function toAvailableAddresses(addresses: PersonAddress[]) {
  return addresses.map((a) => ({ address_id: a.addressId, location_name: a.locationName }));
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
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartBlock | null>(null);
  const [instamartItems, setInstamartItems] = useState<InstamartBlock | null>(null);
  const [dineoutOptions, setDineoutOptions] = useState<DineoutBlock | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderStatusBlock | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);

  const { data: session } = useSession();

  // Onboarding state machine
  type OnboardingStep = null | "diet" | "budget" | "cuisines" | "done";
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(null);
  const [onboardingTargetId, setOnboardingTargetId] = useState<string>("");

  const isThinking = voiceState === "thinking";

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceInputRef = useRef<VoiceInputHandle>(null);
  const isVoiceModeRef = useRef(isVoiceMode);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);
  const onboardingStepRef = useRef(onboardingStep);
  useEffect(() => { onboardingStepRef.current = onboardingStep; }, [onboardingStep]);
  // populated after handleOnboardingAnswer is defined below
  const handleOnboardingAnswerRef = useRef<(v: string) => void>(() => {});
  // when set, the next message is treated as an address for this profile id
  const awaitingAddressForRef = useRef<string | null>(null);

  const syncSwiggyAddressesForToken = useCallback(async (token: string) => {
    if (!token) return [];
    try {
      const res = await fetch("/api/swiggy/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.status === 401) {
        setTokenExpired(true);
        return [];
      }
      const { addresses } = await res.json();
      if (!Array.isArray(addresses) || addresses.length === 0) return [];

      const mapped = normalizeSwiggyAddresses(addresses);
      setPreloadedAddresses(toAvailableAddresses(mapped));

      const profiles = getAllProfiles();
      if (profiles.length > 0) {
        const updated = {
          ...profiles[0],
          addresses: mapped,
          defaultAddressId: profiles[0].defaultAddressId ?? mapped[0]?.addressId,
        };
        saveProfile(updated);
        setActiveProfile(updated);
        setAllProfiles(getAllProfiles());
      }
      return mapped;
    } catch {
      return [];
    }
  }, []);

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

    let loadedKeys: Partial<UserKeys> = {};
    try {
      const raw = localStorage.getItem("aaru-user-keys");
      if (raw) loadedKeys = JSON.parse(raw);
    } catch {}

    // Read OAuth tokens passed back via URL params after OAuth redirect
    const params = new URLSearchParams(window.location.search);
    const swiggyToken = params.get("swiggy_token");
    const swiggyExpiresAt = Number(params.get("swiggy_expires_at") ?? 0) || undefined;
    const swiggyScope = params.get("swiggy_scope") ?? undefined;
    const swiggyError = params.get("swiggy_error");
    const zomatoToken = params.get("zomato_token");
    const nextKeys: UserKeys = {
      anthropicKey: "",
      elevenLabsKey: "",
      swiggyToken: "",
      tier: "trial",
      ...loadedKeys,
      ...(swiggyToken ? { swiggyToken, swiggyExpiresAt, swiggyScope, tier: "full" as const } : {}),
      ...(zomatoToken ? { zomatoToken, tier: "full" as const } : {}),
    };
    setUserKeys(nextKeys);
    localStorage.setItem("aaru-user-keys", JSON.stringify(nextKeys));

    const usableSwiggyToken =
      nextKeys.swiggyToken && (!nextKeys.swiggyExpiresAt || nextKeys.swiggyExpiresAt > Date.now() + 60_000)
        ? nextKeys.swiggyToken
        : "";

    if (nextKeys.swiggyToken && !usableSwiggyToken) {
      setTokenExpired(true);
    }

    if (swiggyToken || zomatoToken) {
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (swiggyError && !swiggyToken) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (usableSwiggyToken) {
      syncSwiggyAddressesForToken(usableSwiggyToken);
    } else {
      setPreloadedAddresses([]);
    }

    // Auto-open wizard on first visit
    if (!localStorage.getItem("aaru-setup-seen")) {
      setTimeout(() => setWizardOpen(true), 600);
    }
  }, [syncSwiggyAddressesForToken]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("aaru-theme", next);
  };

  // ── On mount: load profiles and pre-fetch everything in parallel ──────────────
  useEffect(() => {
    const existing = getAllProfiles();
    let storedSwiggyToken = "";
    try {
      const raw = localStorage.getItem("aaru-user-keys");
      const keys = raw ? JSON.parse(raw) as Partial<UserKeys> : {};
      const expiresAt = keys.swiggyExpiresAt ?? 0;
      if (keys.swiggyToken && (!expiresAt || expiresAt > Date.now() + 60_000)) {
        storedSwiggyToken = keys.swiggyToken;
      }
    } catch {}

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
      if (storedSwiggyToken) {
        syncSwiggyAddressesForToken(storedSwiggyToken);
      } else {
        fetch("/api/addresses").then((r) => r.json()).then(setPreloadedAddresses).catch(() => {});
      }
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
          if (storedSwiggyToken) {
            syncSwiggyAddressesForToken(storedSwiggyToken);
          } else {
            fetch("/api/addresses").then((r) => r.json()).then(setPreloadedAddresses).catch(() => {});
          }
          syncMemoriesForProfile(kvProfiles[0]);
          return;
        }
        seedFromZomato();
      })
      .catch(() => seedFromZomato());

    function seedFromZomato() {
      const addressPromise = storedSwiggyToken
        ? syncSwiggyAddressesForToken(storedSwiggyToken).then(toAvailableAddresses)
        : fetchWithTimeout<{ address_id: string; location_name: string }[]>("/api/addresses", [], 8000);

      Promise.all([
      addressPromise,
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
    if (!activeProfile || activeProfile.addresses.length === 0) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant" as const,
        content: "Add a delivery address to your profile before ordering — tap your name in the header to open Profile settings.",
        timestamp: new Date(),
      }]);
      return;
    }
    if (activeProfile.addresses.length > 1) {
      setPendingOrderNoAddr(order);
    } else {
      const addr = activeProfile.addresses[0];
      setPendingOrder({
        ...order,
        deliveryAddress: { label: addr.label, locationName: addr.locationName, addressId: addr.addressId },
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

  const handleAddDishToCart = useCallback((dish: Dish) => {
    setCart((prev) => {
      const item = {
        dishName: dish.dishName,
        restaurantName: dish.restaurantName,
        price: dish.price,
        qty: 1,
        platform: dish.platform,
        isVeg: dish.isVeg,
      };

      if (!prev || prev.restaurantName !== dish.restaurantName || prev.platform !== dish.platform) {
        return {
          items: [item],
          total: dish.price,
          platform: dish.platform,
          restaurantName: dish.restaurantName,
        };
      }

      let found = false;
      const items = prev.items.map((existing) => {
        if (existing.dishName !== dish.dishName) return existing;
        found = true;
        return { ...existing, qty: existing.qty + 1 };
      });

      if (!found) items.push(item);
      return {
        ...prev,
        items,
        total: items.reduce((sum, current) => sum + current.price * current.qty, 0),
      };
    });
  }, []);

  function applyConversationProfileHints(text: string): PersonProfile | null {
    if (!activeProfile) return null;

    const raw = text.trim();
    const lowered = raw.toLowerCase();
    const profiles = getAllProfiles();

    const targetNameMatch = raw.match(/\b(?:order for|for|ordering for)\s+([a-z][a-z'’ -]{1,40})\b/i);
    const explicitNameMatch = raw.match(/\b(?:my name is|i am|i'm|call me)\s+([a-z][a-z'’ -]{1,40})\b/i);
    const targetName = targetNameMatch?.[1] ? normalizeName(targetNameMatch[1]) : "";

    const targetProfile =
      targetName && !/^(myself|me|us|ours|self|my)$/.test(targetName)
        ? profiles.find((p) => normalizeName(p.name) === targetName) ?? activeProfile
        : activeProfile;

    let updated: PersonProfile = {
      ...targetProfile,
      preferences: {
        ...targetProfile.preferences,
        likes: [...targetProfile.preferences.likes],
        dislikes: [...targetProfile.preferences.dislikes],
      },
      addresses: [...targetProfile.addresses],
      pastOrders: [...targetProfile.pastOrders],
      memories: [...(targetProfile.memories ?? [])],
    };

    let changed = false;

    if (explicitNameMatch?.[1] && (!updated.name.trim() || normalizeName(updated.name) === "me")) {
      updated = { ...updated, name: titleCase(explicitNameMatch[1]) };
      changed = true;
    }

    const addLike = (label: string) => {
      if (!updated.preferences.likes.some((item) => normalizeName(item) === normalizeName(label))) {
        updated.preferences.likes = [...updated.preferences.likes, label];
        changed = true;
      }
    };

    const addDislike = (label: string) => {
      if (!updated.preferences.dislikes.some((item) => normalizeName(item) === normalizeName(label))) {
        updated.preferences.dislikes = [...updated.preferences.dislikes, label];
        changed = true;
      }
    };

    if (/\bnon[- ]?veg\b/.test(lowered) || /\bnonvegetarian\b/.test(lowered)) {
      if (/\bmostly\b/.test(lowered) || /\bbut\b/.test(lowered) || /\bhowever\b/.test(lowered)) {
        if (updated.preferences.diet !== "both") {
          updated.preferences.diet = "both";
          changed = true;
        }
        updated.preferences.notes = mergeNotes(updated.preferences.notes, "Mostly eats veg but also orders non-veg sometimes.");
      } else if (updated.preferences.diet !== "nonveg") {
        updated.preferences.diet = "nonveg";
        changed = true;
      }
    } else if (/\bvegetarian\b|\bveg\b/.test(lowered)) {
      if (updated.preferences.diet !== "veg") {
        updated.preferences.diet = "veg";
        changed = true;
      }
    }

    const interestMap: Array<{ test: RegExp; label: string; note?: string }> = [
      { test: /\bchees(y|e)|cheese burst|loaded\b/, label: "Cheesy", note: "likes cheesy food" },
      { test: /\bspicy|heat|fiery|schezwan|peri[- ]?peri|chilli|chili\b/, label: "Spicy", note: "likes spicy food" },
      { test: /\bhealthy|light|salad|protein|clean|fresh\b/, label: "Healthy", note: "prefers lighter meals" },
      { test: /\bbiryani\b/, label: "Biryani" },
      { test: /\bpizza\b/, label: "Pizza" },
      { test: /\bburger\b/, label: "Burger" },
      { test: /\bchinese\b/, label: "Chinese" },
      { test: /\bnorth indian\b/, label: "North Indian" },
      { test: /\bsouth indian\b/, label: "South Indian" },
      { test: /\bstreet food\b/, label: "Street Food" },
      { test: /\bdessert|sweet\b/, label: "Desserts" },
      { test: /\bseafood\b/, label: "Seafood" },
    ];

    const hasNegativePreference = /\b(i\s+don'?t\s+like|i\s+dont\s+like|i\s+hate|hate|dislike|avoid|never recommend|not again|please no|no more|stop recommending|don'?t recommend|dont recommend|no)\b/i.test(lowered);

    for (const item of interestMap) {
      if (!hasNegativePreference && item.test.test(lowered)) {
        addLike(item.label);
        if (item.note) {
          updated.preferences.notes = mergeNotes(updated.preferences.notes, item.note);
        }
      }
    }

    const dislikedFoods = extractFoodDislikes(raw);
    for (const food of dislikedFoods) {
      addDislike(food);
      const fact = `Does not like ${food}; avoid unless explicitly asked.`;
      if (!updated.memories?.some((memory) => normalizeName(memory) === normalizeName(fact))) {
        updated.memories = [fact, ...(updated.memories ?? [])].slice(0, 30);
        changed = true;
      }
    }

    if (/\bnot too oily\b|\bavoid oily\b/.test(lowered)) addDislike("Too Oily");
    if (/\bavoid sweets\b|\bno sweets\b/.test(lowered)) addDislike("Sweets");
    if (/\blactose intolerant\b/.test(lowered)) {
      updated.preferences.notes = mergeNotes(updated.preferences.notes, "Lactose intolerant.");
      addDislike("Heavy Dairy");
    }

    if (changed) {
      saveProfile(updated);
      const latest = getAllProfiles();
      setAllProfiles(latest);
      handleAllProfilesChange(latest);
    }

    if (targetProfile.id !== activeProfile.id || changed) {
      setActiveProfile(updated);
    }

    return updated;
  }

  // ── Core send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string, mode: InputMode = "text") => {
      if (!text.trim() || voiceState === "thinking") return;

      // During onboarding, route voice input to the onboarding handler instead of Groq
      if (onboardingStepRef.current && onboardingStepRef.current !== "done") {
        handleOnboardingAnswerRef.current(text.trim());
        return;
      }

      // If Aaru asked for an address, capture the next message as the address
      if (awaitingAddressForRef.current) {
        const profileId = awaitingAddressForRef.current;
        awaitingAddressForRef.current = null;
        const raw = text.trim();
        const skip = /^(skip|cancel|no|later|nevermind|nope)$/i.test(raw);
        if (!skip) {
          const words = raw.split(/\s+/);
          const city = words.length > 1 ? words[words.length - 1] : raw;
          const newAddress: PersonAddress = {
            addressId: `addr_${Date.now()}`,
            locationName: raw,
            city,
            label: "Home",
          };
          const profiles = getAllProfiles();
          const profile = profiles.find((p) => p.id === profileId);
          if (profile) {
            const updated = {
              ...profile,
              addresses: [...profile.addresses, newAddress],
              defaultAddressId: profile.defaultAddressId ?? newAddress.addressId,
            };
            saveProfile(updated);
            if (profile.id === activeProfile?.id) setActiveProfile(updated);
            handleAllProfilesChange(getAllProfiles());
            setMessages((prev) => [
              ...prev,
              { id: Date.now().toString(), role: "user", content: raw, inputMode: mode, timestamp: new Date() },
              { id: (Date.now() + 1).toString(), role: "assistant", content: `Got it! Saved "${raw}" as your delivery address. Now what are you craving?`, timestamp: new Date() },
            ]);
            setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
            if (isVoiceModeRef.current) {
              playTTS(`Got it! Saved ${raw} as your delivery address. Now what are you craving?`, userKeys.elevenLabsKey || undefined).catch(() => {});
            }
            return;
          }
        }
        setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
        return;
      }

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

      const inferredProfile = applyConversationProfileHints(text.trim()) ?? activeProfile;
      const liveProfiles = getAllProfiles();
      const liveActiveProfile = inferredProfile
        ? liveProfiles.find((p) => p.id === inferredProfile.id) ?? inferredProfile
        : null;
      const turnContext = buildConversationContext(text.trim(), liveActiveProfile ?? activeProfile, liveProfiles, weather);
      try {
        localStorage.setItem("aaru-turn-context", JSON.stringify({
          intent: turnContext.intent,
          targetProfileId: turnContext.targetProfile?.id ?? null,
          targetProfileName: turnContext.targetProfile?.name ?? null,
          summary: turnContext.summary,
          updatedAt: new Date().toISOString(),
        }));
      } catch {}

      const dislikedFoods = extractFoodDislikes(text.trim());
      if (isPreferenceOnlyUpdate(text.trim()) && dislikedFoods.length > 0) {
        const label = dislikedFoods.join(", ");
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Got it. I won't recommend ${label} unless you ask for it.`,
            timestamp: new Date(),
          },
        ]);
        setVoiceState("idle");
        return;
      }

      const recommendationProfile = turnContext.targetProfile ?? liveActiveProfile;
      if (turnContext.intent === "recommend_food" && recommendationProfile && recommendationProfile.addresses.length === 0 && !onboardingStepRef.current) {
        awaitingAddressForRef.current = recommendationProfile.id;
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `What's your delivery address for ${recommendationProfile.name}? Just say or type it — like "Sector 23 Panchkula" or "Koramangala Bangalore".`,
            timestamp: new Date(),
          },
        ]);
        if (isVoiceModeRef.current) {
          playTTS(`What's your delivery address for ${recommendationProfile.name}? Just say it.`, userKeys.elevenLabsKey || undefined).catch(() => {});
        }
        setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
        return;
      }

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
            activeProfile: liveActiveProfile,
            allProfiles: liveProfiles,
            weather,
            conversationContext: turnContext,
            zomatoToken: userKeys.zomatoToken || undefined,
            swiggyToken: userKeys.swiggyToken || undefined,
            isTrial: true,
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

              if (event.type === "trial_exhausted") {
                setShowTrialModal(true);
                setMessages((prev) => prev.filter((m) => m.id !== aiId));
                setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
                gotDone = true;
              }

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
                      .catch(() => {});
                  }
                }
              }

              if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) => m.id === aiId ? { ...m, content: event.cleanText, streaming: false } : m)
                );
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
                    // playTTS already fell back to browser TTS — only show error if that also failed
                  }
                }
                setIsTTSSpeaking(false);
                setVoiceState(isVoiceModeRef.current ? "listening" : "idle");
                gotDone = true;

                // Background memory extraction — fires only on learning signals, zero latency impact
                if (liveActiveProfile && LEARNING_SIGNAL.test(text) && event.cleanText) {
                  fetch("/api/extract-memory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userMessage: text,
                      assistantReply: event.cleanText,
                      profileName: liveActiveProfile.name,
                    }),
                  })
                    .then((r) => r.json())
                    .then(({ fact }: { fact: string | null }) => {
                      if (fact && liveActiveProfile) {
                        addMemory(liveActiveProfile.id, fact);
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
  // keep ref current so sendMessage can access it without circular deps
  useEffect(() => { handleOnboardingAnswerRef.current = handleOnboardingAnswer; }, [handleOnboardingAnswer]);

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

    const deliveryAddr = pendingOrder.deliveryAddress;
    const addrStr = deliveryAddr
      ? `${deliveryAddr.label}: ${deliveryAddr.locationName}${deliveryAddr.addressId ? ` [address_id: ${deliveryAddr.addressId}]` : ""}`
      : "my first saved address";

    await sendMessage(
      `Place an order for "${pendingOrder.item}" (₹${pendingOrder.price}) from "${pendingOrder.restaurant.name}" on Swiggy. ` +
      `Deliver to ${addrStr}. ` +
      `Use swiggy-food MCP tools: call get_addresses to confirm the address_id, then add_to_cart, then place_order. ` +
      `Return a \`\`\`order_status block with orderId and status when complete.`,
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
            swiggyToken={userKeys.swiggyToken || undefined}
            onProfileChange={setActiveProfile}
            onAllProfilesChange={handleAllProfilesChange}
          />

          {/* Settings */}
          <motion.button
            onClick={() => setSettingsOpen(true)}
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

          {/* Login / Logout */}
          {session?.user ? (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => signOut({ callbackUrl: "/login" })}
              title={`Signed in as ${session.user.email}\nClick to sign out`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all"
              style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                  {session.user.name?.[0] ?? session.user.email?.[0] ?? "?"}
                </span>
              )}
              <span className="hidden sm:block max-w-[80px] truncate">{session.user.name ?? session.user.email}</span>
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => window.location.href = "/login"}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
              style={{ backgroundColor: "var(--accent)", color: "#fff" }}
            >
              Sign in
            </motion.button>
          )}

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
            <span>⚠️ Swiggy session expired — tap to reconnect</span>
            <button onClick={() => { window.location.href = "/api/auth/swiggy/start"; }} className="font-semibold underline">Reconnect →</button>
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
                    onClick={() => sendMessage(chip.query, isVoiceMode ? "voice" : "text")}
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
              onAddToCart={handleAddDishToCart}
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
                sendMessage(`Add ${itemName} to my Instamart cart`, isVoiceMode ? "voice" : "text");
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
                  isVoiceMode ? "voice" : "text"
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
              isVoiceMode ? "voice" : "text"
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

      <TrialLimitModal open={showTrialModal} onClose={() => setShowTrialModal(false)} />

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
        initialStep={0}
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

