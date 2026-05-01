import { PersonProfile, WeatherContext } from "./types";

export type UserIntent =
  | "greeting"
  | "smalltalk"
  | "recommend_food"
  | "ask_clarification"
  | "order_now"
  | "order_for_someone"
  | "track_order"
  | "grocery"
  | "dineout";

export interface ConversationContext {
  intent: UserIntent;
  targetProfile: PersonProfile | null;
  activeProfile: PersonProfile | null;
  meal: string;
  timeLabel: string;
  weatherLabel: string;
  summary: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z\s'’-]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMealLabel(hour: number) {
  if (hour < 6) return "late night";
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack time";
  if (hour < 22) return "dinner";
  return "late night";
}

function isGreeting(text: string) {
  return /^(hi|hey|hello|yo|good morning|good afternoon|good evening|sup|what's up|whats up)\b/i.test(text)
    || /\b(hi|hey|hello)\b/i.test(text) && text.trim().split(/\s+/).length <= 4;
}

function hasFoodCue(text: string) {
  return /\b(food|eat|eating|hungry|craving|meal|breakfast|lunch|dinner|snack|order|ordering|recommend|suggest|restaurant|dish|menu|delivery|show me|only|what should i eat|what to eat|what do i eat|sweet|dessert|coffee|options?)\b/i.test(text)
    || /\b(cheesy|spicy|veg|vg|vegetarian|non[- ]?veg|biryani|pizza|burger|wrap|thali|noodles|pasta|momo|paneer|chicken|bowl|salad|kebab|tandoori|rajma|chawal|khichdi|idli|dosa|poha|paratha|uttapam|upma|vada|sambar)\b/i.test(text)
    || /\b(south indian|north indian|chinese|italian|mexican|thai|continental|mughlai|punjabi|street food|fast food|cafe|bakery)\b/i.test(text);
}

function hasOrderingCue(text: string) {
  return /\b(order|checkout|place it|confirm|buy this|add to cart|deliver|send this)\b/i.test(text)
    || /\bordering\b/i.test(text)
    || /\badd\b.*\b(in|to)?\s*cart\b/i.test(text)
    || /\bput\b.*\b(in|to)?\s*cart\b/i.test(text)
    || /\bcart\b.*\b(add|put)\b/i.test(text);
}

function hasTrackingCue(text: string) {
  return /\b(track|status|where is my order|delivery status|order id|ETA|eta)\b/i.test(text);
}

function hasGroceryCue(text: string) {
  return /\b(instamart|groceries|grocery|milk|bread|eggs|fruit|vegetables?|household)\b/i.test(text);
}

function hasDineoutCue(text: string) {
  return /\b(dineout|table|reservation|book a table|reserve|dine in|restaurant booking)\b/i.test(text);
}

function hasConcreteFoodSignal(text: string) {
  return /\b(veg|vg|vegetarian|non[- ]?veg|spicy|cheesy|healthy|light|sweet|dessert|coffee|breakfast|lunch|dinner|snack|biryani|pizza|burger|wrap|thali|noodles|pasta|momo|paneer|chicken|bowl|salad|kebab|tandoori|rajma|chawal|khichdi|idli|dosa|poha|paratha|uttapam|upma|vada|sambar|under \d+|budget|quick|asap|comfort|homely|bored|new)\b/i.test(text)
    || /\b(south indian|north indian|chinese|italian|mexican|thai|continental|mughlai|punjabi|street food|fast food|cafe|bakery)\b/i.test(text);
}

function isVagueFoodAsk(text: string) {
  return /\b(what should i (eat|have)|what to eat|what do i eat|recommend( me)?( food)?|suggest( me)?( something| food)?|i'?m hungry|hungry|craving something|anything works|anything|whatever|surprise me|you pick|your call|help me decide|decide for me)\b/i.test(text);
}

function hasFoodRefinementCue(text: string) {
  if (/\b(not this|something else|another option|different option|try again)\b/i.test(text)) return true;
  return /\b(no|not|avoid|skip|without|don'?t want|dont want|not this|something else|another|different|instead)\b/i.test(text)
    && (
      hasFoodCue(text)
      || /\b(south|north|chinese|italian|mexican|thai|continental|mughlai|punjabi|oily|heavy|fried|rice|bread|roti|idli|dosa|poha|paratha)\b/i.test(text)
    );
}

function resolveTargetProfile(
  text: string,
  activeProfile: PersonProfile | null | undefined,
  allProfiles: PersonProfile[] = [],
) {
  const lowered = normalize(text);
  const match = allProfiles.find((p) => {
    const name = normalize(p.name);
    if (!name) return false;
    const namePattern = escapeRegex(name);
    return new RegExp(`\\b(?:order for|ordering for|for)\\s+${namePattern}\\b`, "i").test(lowered)
      || new RegExp(`\\b${namePattern}\\b`, "i").test(lowered) && /order for|ordering for/i.test(lowered);
  });
  if (match) return match;
  return activeProfile ?? null;
}

function clarificationForProfile(profile: PersonProfile | null) {
  if (!profile) {
    return {
      question: "Veg or non-veg today?",
      options: ["Veg", "Non-veg", "Either works"],
    };
  }

  const diet = profile.preferences.diet;
  if (diet === "veg") {
    return {
      question: "Cheesy, spicy, or light?",
      options: ["Cheesy", "Spicy", "Light"],
    };
  }

  if (diet === "nonveg") {
    return {
      question: "Spicy, grilled, or comfort food?",
      options: ["Spicy", "Grilled", "Comfort"],
    };
  }

  return {
    question: "Spicy, cheesy, light, or comfort food?",
    options: ["Spicy", "Cheesy", "Light", "Comfort"],
  };
}

export function detectConversationIntent(
  text: string,
  activeProfile?: PersonProfile | null,
  allProfiles?: PersonProfile[],
): { intent: UserIntent; targetProfile: PersonProfile | null; needsClarification: boolean; clarificationQuestion?: string; clarificationOptions?: string[] } {
  const targetProfile = resolveTargetProfile(text, activeProfile, allProfiles ?? []);
  const cleaned = text.trim();

  if (isGreeting(cleaned)) {
    return { intent: "greeting", targetProfile, needsClarification: false };
  }
  if (hasTrackingCue(cleaned)) {
    return { intent: "track_order", targetProfile, needsClarification: false };
  }
  if (hasGroceryCue(cleaned)) {
    return { intent: "grocery", targetProfile, needsClarification: false };
  }
  if (hasDineoutCue(cleaned)) {
    return { intent: "dineout", targetProfile, needsClarification: false };
  }

  const foodCue = hasFoodCue(cleaned);
  const orderCue = hasOrderingCue(cleaned);
  const preferenceOnlyCue = /\b(veg|vg|vegetarian|non[- ]?veg|spicy|cheesy|healthy|light|budget|under \d+)\b/i.test(cleaned)
    || hasFoodRefinementCue(cleaned);
  const profileHasSignal =
    !!targetProfile
    && (
      targetProfile.preferences.likes.length > 0
      || targetProfile.preferences.dislikes.length > 0
      || !!targetProfile.preferences.notes.trim()
      || targetProfile.preferences.diet !== "both"
    );

  if ((orderCue || /\bfor\s+[a-z]+\s+add\b/i.test(cleaned)) && /\bfor\s+[a-z]/i.test(cleaned)) {
    return {
      intent: "order_for_someone",
      targetProfile,
      needsClarification: false,
    };
  }

  if (orderCue) {
    return {
      intent: "order_now",
      targetProfile,
      needsClarification: false,
    };
  }

  if (isVagueFoodAsk(cleaned) && !hasConcreteFoodSignal(cleaned)) {
    const clarification = clarificationForProfile(targetProfile);
    return {
      intent: "ask_clarification",
      targetProfile,
      needsClarification: true,
      clarificationQuestion: clarification.question,
      clarificationOptions: clarification.options,
    };
  }

  if (foodCue || preferenceOnlyCue) {
    return { intent: "recommend_food", targetProfile, needsClarification: false };
  }

  return {
    intent: "smalltalk",
    targetProfile,
    needsClarification: false,
  };
}

export function buildConversationContext(
  text: string,
  activeProfile?: PersonProfile | null,
  allProfiles?: PersonProfile[],
  weather?: WeatherContext | null,
): ConversationContext {
  const decision = detectConversationIntent(text, activeProfile, allProfiles);
  const now = new Date();
  const timeLabel = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const meal = getMealLabel(now.getHours());
  const weatherLabel = weather
    ? weather.isRaining
      ? `rainy, ${weather.tempC}°C`
      : weather.isHot
        ? `hot, ${weather.tempC}°C`
        : `${weather.tempC}°C`
    : "no weather data";

  const speaker = decision.targetProfile?.name ?? activeProfile?.name ?? "unknown";
  const diet = decision.targetProfile?.preferences.diet ?? activeProfile?.preferences.diet ?? "both";
  const likes = decision.targetProfile?.preferences.likes.join(", ") || activeProfile?.preferences.likes.join(", ") || "none";
  const dislikes = decision.targetProfile?.preferences.dislikes.join(", ") || activeProfile?.preferences.dislikes.join(", ") || "none";
  let clarificationQuestion = decision.clarificationQuestion;
  let clarificationOptions = decision.clarificationOptions;

  if (decision.needsClarification) {
    const profile = decision.targetProfile ?? activeProfile ?? null;
    if (weather?.isRaining) {
      clarificationQuestion = "Rainy weather: comfort food or something light?";
      clarificationOptions = ["Comfort", "Light", "Spicy"];
    } else if (weather?.isHot) {
      clarificationQuestion = "It's hot out. Light meal, cold drink combo, or spicy?";
      clarificationOptions = ["Light", "Cold drink combo", "Spicy"];
    } else if (profile?.preferences.diet && profile.preferences.diet !== "both") {
      clarificationQuestion = `${meal === "snack time" ? "Snack" : "Meal"} mood: spicy, cheesy, light, or comfort?`;
      clarificationOptions = ["Spicy", "Cheesy", "Light", "Comfort"];
    } else if (meal === "breakfast") {
      clarificationQuestion = "Breakfast mood: light, filling, or chai-side snack?";
      clarificationOptions = ["Light", "Filling", "Chai-side snack"];
    } else if (meal === "late night") {
      clarificationQuestion = "Late night mood: quick snack, comfort meal, or sweet?";
      clarificationOptions = ["Quick snack", "Comfort meal", "Sweet"];
    }
  }

  const summary = [
    `intent=${decision.intent}`,
    `for=${speaker}`,
    `diet=${diet}`,
    `likes=${likes}`,
    `dislikes=${dislikes}`,
    `meal=${meal}`,
    `weather=${weatherLabel}`,
  ].join(" | ");

  return {
    intent: decision.intent,
    targetProfile: decision.targetProfile,
    activeProfile: activeProfile ?? null,
    meal,
    timeLabel,
    weatherLabel,
    summary,
    needsClarification: decision.needsClarification,
    clarificationQuestion,
    clarificationOptions,
  };
}
