import Groq from "groq-sdk";
import OpenAI from "openai";
import { Agent, MCPServerStreamableHttp, OpenAIChatCompletionsModel, Runner } from "@openai/agents";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { buildSystemPrompt } from "@/lib/systemPrompt";
import { Dish, WeatherContext } from "@/lib/types";
import { PersonProfile } from "@/lib/profiles/types";
import { buildConversationContext, ConversationContext } from "@/lib/conversationContext";
import { getTrialUsage, incrementTrialUsage, TRIAL_MESSAGE_LIMIT } from "@/lib/server/trialUsage";

export const maxDuration = 60;

function pickGroqKey(): string | undefined {
  const keys: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const k = process.env[i === 1 ? "GROQ_API_KEY" : `GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  if (keys.length === 0) return undefined;
  return keys[Math.floor(Math.random() * keys.length)];
}

function buildAgentMcpServers(swiggyToken?: string) {
  if (!swiggyToken) return [];
  const requestInit = { headers: { Authorization: `Bearer ${swiggyToken}` } };
  return [
    new MCPServerStreamableHttp({ name: "swiggy-food", url: "https://mcp.swiggy.com/food", requestInit }),
    new MCPServerStreamableHttp({ name: "swiggy-instamart", url: "https://mcp.swiggy.com/im", requestInit }),
    new MCPServerStreamableHttp({ name: "swiggy-dineout", url: "https://mcp.swiggy.com/dineout", requestInit }),
  ];
}

const GROQ_SYSTEM_SUFFIX = `\n\nOUTPUT FORMAT - follow exactly, no exceptions:

Pick ONE block type per response based on intent. Never mix block types.

\`\`\`dishes - food/dish recommendation (4-5 items, FIRST item isRecommended:true):
[{"restaurantName":"Behrouz Biryani","platform":"swiggy","dishName":"Chicken Dum Biryani","price":349,"rating":4.4,"isVeg":false,"description":"Slow-cooked aromatic biryani","deliveryTime":28,"offer":"20% off","isRecommended":true,"whyRecommended":"Perfect comfort pick"},{"restaurantName":"Fasos","platform":"swiggy","dishName":"Peri-Peri Chicken Wrap","price":199,"rating":4.2,"isVeg":false,"description":"Spicy peri-peri chicken","deliveryTime":25,"offer":"","isRecommended":false}]

\`\`\`restaurants - restaurant recommendation (3-4 items):
[{"id":"1","name":"Barbeque Nation","cuisine":"North Indian","rating":4.3,"deliveryTime":28,"price":349,"platform":"swiggy","offer":"Free delivery"}]

\`\`\`clarification - vague/unclear only:
{"question":"Veg or non-veg today?","options":["Veg","Non-veg","Either works"]}

\`\`\`order - when user confirms they want to order:
{"restaurant":{"id":"1","name":"Behrouz Biryani","cuisine":"Mughlai","rating":4.4,"deliveryTime":28,"price":349,"platform":"swiggy"},"item":"Chicken Dum Biryani","price":349,"platform":"swiggy","estimatedDelivery":28,"autonomous":false}

\`\`\`order_status - after order confirmed and MCP place_order succeeds:
{"orderId":"SW123456","status":"accepted","eta":28,"platform":"swiggy"}

\`\`\`cart - when items are added before full checkout:
{"items":[{"dishName":"Chicken Dum Biryani","restaurantName":"Behrouz Biryani","price":349,"qty":1,"platform":"swiggy","isVeg":false}],"total":349,"platform":"swiggy","restaurantName":"Behrouz Biryani"}

\`\`\`instamart - grocery/quick-commerce requests:
{"items":[{"name":"Amul Milk 1L","brand":"Amul","price":68,"unit":"1L","isAvailable":true},{"name":"Brown Bread","brand":"Britannia","price":45,"unit":"400g","isAvailable":true}],"deliveryTime":12}

\`\`\`dineout - book table / dine-in requests:
{"restaurants":[{"name":"Barbeque Nation","cuisine":"North Indian","location":"Connaught Place","rating":4.4,"avgCost":900,"availableSlots":["7:00 PM","7:30 PM","8:00 PM"]}],"partySize":2,"bookingDate":"today"}

Rules: Real Indian restaurant names. Prices in INR. Platform must be swiggy. One punchy sell line before the block.
When the user asks to place an order and Swiggy MCP tools are available, call get_addresses, add_to_cart, and place_order before returning order_status. Never fake order_status.`;

function stripBlocks(text: string) {
  return text
    .replace(/```restaurants[\s\S]*?```/g, "")
    .replace(/```dishes[\s\S]*?```/g, "")
    .replace(/```order[\s\S]*?```/g, "")
    .replace(/```clarification[\s\S]*?```/g, "")
    .replace(/```instamart[\s\S]*?```/g, "")
    .replace(/```dineout[\s\S]*?```/g, "")
    .replace(/```cart[\s\S]*?```/g, "")
    .replace(/```order_status[\s\S]*?```/g, "")
    .trim();
}

function parseBlock(text: string, name: string) {
  try {
    const match = text.match(new RegExp("```" + name + "\\n([\\s\\S]*?)\\n```"));
    return match ? JSON.parse(match[1]) : null;
  } catch {
    return null;
  }
}

function statusOf(err: unknown) {
  return (err as { status?: number; response?: { status?: number } })?.status
    ?? (err as { status?: number; response?: { status?: number } })?.response?.status;
}

function parseCartItemFromText(input: string): string | null {
  const text = input.toLowerCase().trim();
  const match =
    text.match(/\badd\s+(.+?)\s+(?:to|in)\s+cart\b/i)
    ?? text.match(/\bput\s+(.+?)\s+(?:to|in)\s+cart\b/i)
    ?? text.match(/\bcart\s+(.+)\b/i);
  if (!match?.[1]) return null;
  const cleaned = match[1]
    .replace(/\b(my|me|please|also|now)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const fixed = cleaned
    .replace(/\bexpresso\b/gi, "espresso")
    .replace(/\bcapachino\b/gi, "cappuccino");
  return fixed.replace(/\b\w/g, (m) => m.toUpperCase());
}

function textForDish(dish: Dish) {
  return `${dish.dishName} ${dish.restaurantName} ${dish.description ?? ""}`.toLowerCase();
}

function buildWeatherValidation(weather?: WeatherContext | null) {
  if (!weather) return "";
  if (weather.isRaining) return "rainy weather";
  if (weather.isHot) return `${weather.tempC}C heat`;
  return `${weather.tempC}C weather`;
}

function buildRecommendationValidation(
  dish: Dish,
  activeProfile?: PersonProfile | null,
  weather?: WeatherContext | null,
  context?: ConversationContext | null,
  userText = "",
) {
  const profile = context?.targetProfile ?? activeProfile ?? null;
  const lowered = userText.toLowerCase();
  const dishText = textForDish(dish);
  const reasons: string[] = [];

  if ((profile?.preferences.diet === "veg" || /\b(vg|veg|vegetarian)\b/i.test(lowered)) && dish.isVeg) {
    reasons.push("passes your veg preference");
  } else if (profile?.preferences.diet === "nonveg" && !dish.isVeg) {
    reasons.push("matches your non-veg profile");
  }

  if (/\bspicy|heat|fiery|chilli|chili|schezwan|peri\b/i.test(lowered) && /spicy|peri|schezwan|chilli|chili/i.test(dishText)) {
    reasons.push("matches the spicy craving");
  } else if (/\bcheesy|cheese|loaded\b/i.test(lowered) && /cheese|loaded|pizza/i.test(dishText)) {
    reasons.push("hits the cheesy craving");
  } else if (/\bsweet|dessert|chocolate|mithai|cake|ice cream\b/i.test(lowered) && /sweet|dessert|chocolate|mithai|cake|ice cream|pastry|jamun|rasmalai/i.test(dishText)) {
    reasons.push("fits the sweet craving");
  } else if (/\bhealthy|light|fresh|clean\b/i.test(lowered) && /salad|grill|bowl|fresh|light|protein/i.test(dishText)) {
    reasons.push("keeps it light");
  }

  if (context?.meal === "breakfast" && /dosa|idli|poha|paratha|chai|coffee|egg|breakfast/i.test(dishText)) {
    reasons.push("works for breakfast");
  } else if (context?.meal === "late night" && (dish.deliveryTime ?? 99) <= 25) {
    reasons.push("quick enough for late night");
  } else if ((dish.deliveryTime ?? 99) <= 25) {
    reasons.push("fast delivery");
  }

  if (weather?.isRaining && /biryani|khichdi|rajma|chai|paratha|soup|comfort|maggi/i.test(dishText)) {
    reasons.push("fits rainy weather");
  } else if (weather?.isHot && /salad|bowl|smoothie|cold|iced|light|coffee/i.test(dishText)) {
    reasons.push("makes sense in the heat");
  }

  if (reasons.length === 0) {
    const weatherReason = buildWeatherValidation(weather);
    if (weatherReason) reasons.push(weatherReason);
    if (context?.meal) reasons.push(context.meal);
  }

  return reasons.slice(0, 2).join(" + ") || "best match right now";
}

function explicitExclusionMatchers(userText: string) {
  const text = userText.toLowerCase();
  const matchers: RegExp[] = [];
  const hasNegativeCue = /\b(no|not|avoid|skip|without|don'?t want|dont want|not this|something else|different|instead)\b/i.test(text);
  if (!hasNegativeCue) return matchers;

  const add = (cue: RegExp, matcher: RegExp) => {
    if (cue.test(text)) matchers.push(matcher);
  };

  add(/\bsouth indian\b|\bsouth\b/, /\b(idli|dosa|uttapam|upma|vada|sambar|rasam|pongal|appam|south indian|saravana|sagar ratna)\b/i);
  add(/\bnorth indian\b|\bnorth\b/, /\b(rajma|chole|paratha|paneer butter|dal makhani|naan|roti|north indian|punjabi|bikanervala|haldiram)\b/i);
  add(/\bchinese\b/, /\b(noodles|fried rice|manchurian|schezwan|hakka|chilli garlic|chinese)\b/i);
  add(/\bitalian\b/, /\b(pizza|pasta|lasagna|risotto|italian|domino|pizza hut)\b/i);
  add(/\bsweet|dessert|sugar\b/, /\b(sweet|dessert|chocolate|pastry|cake|ice cream|jamun|rasmalai|mithai)\b/i);
  add(/\bheavy|oily|fried\b/, /\b(fried|loaded|butter|biryani|paratha|chole|cheese burst|dum)\b/i);
  add(/\bidli\b/, /\bidli\b/i);
  add(/\bdosa\b/, /\bdosa\b/i);
  add(/\bpoha\b/, /\bpoha\b/i);
  add(/\bparatha\b/, /\bparatha\b/i);

  return matchers;
}

function dislikeTermsFromMemories(memories: string[] = []) {
  const terms = new Set<string>();
  const knownItems = ["idli", "dosa", "poha", "paratha", "uttapam", "upma", "vada", "sambar", "biryani", "pizza", "burger", "paneer", "momo", "noodles", "pasta", "south indian", "chinese", "italian"];

  for (const memory of memories) {
    const lowered = memory.toLowerCase();
    if (!/\b(dislike|does not like|don't like|dont like|hate|avoid|never)\b/i.test(lowered)) continue;
    for (const item of knownItems) {
      if (lowered.includes(item)) terms.add(item);
    }
  }

  return terms;
}

function validateDishRecommendations(
  raw: unknown,
  activeProfile?: PersonProfile | null,
  weather?: WeatherContext | null,
  context?: ConversationContext | null,
  userText = "",
): Dish[] | null {
  if (!Array.isArray(raw)) return null;

  const profile = context?.targetProfile ?? activeProfile ?? null;
  const lowered = userText.toLowerCase();
  const wantsVeg = profile?.preferences.diet === "veg" || /\b(vg|veg|vegetarian)\b/i.test(lowered);
  const dislikes = new Set((profile?.preferences.dislikes ?? []).map((v) => v.toLowerCase().trim()).filter(Boolean));
  for (const memoryDislike of dislikeTermsFromMemories(profile?.memories ?? [])) {
    dislikes.add(memoryDislike);
  }
  const exclusions = explicitExclusionMatchers(userText);
  const explicitAskOverrides = new Set<string>();
  for (const item of ["idli", "dosa", "poha", "paratha"]) {
    if (new RegExp(`\\b(want|craving|show|recommend|order|add|get|give).*\\b${item}\\b|\\b${item}\\b.*\\b(please|today|now)`, "i").test(lowered)) {
      explicitAskOverrides.add(item);
    }
  }

  const cleaned = raw
    .filter((dish): dish is Dish => {
      if (!dish || typeof dish !== "object") return false;
      const maybe = dish as Dish;
      return Boolean(maybe.restaurantName && maybe.dishName && typeof maybe.price === "number");
    })
    .map((dish) => ({
      ...dish,
      platform: "swiggy" as const,
      deliveryTime: dish.deliveryTime ?? 30,
      rating: dish.rating ?? 4.1,
      isVeg: Boolean(dish.isVeg),
    }))
    .filter((dish) => {
      if (wantsVeg && !dish.isVeg) return false;
      const haystack = textForDish(dish);
      if (exclusions.some((matcher) => matcher.test(haystack))) return false;
      for (const dislike of dislikes) {
        if (explicitAskOverrides.has(dislike)) continue;
        if (dislike && haystack.includes(dislike)) return false;
      }
      return true;
    })
    .slice(0, 5);

  if (cleaned.length === 0) return null;

  return cleaned.map((dish, index) => ({
    ...dish,
    isRecommended: index === 0,
    whyRecommended: index === 0
      ? buildRecommendationValidation(dish, activeProfile, weather, context, userText)
      : undefined,
  }));
}

function recommendationLine(
  cleanText: string,
  dishes: Dish[] | null,
  activeProfile?: PersonProfile | null,
  weather?: WeatherContext | null,
  context?: ConversationContext | null,
  userText = "",
) {
  if (!dishes?.length) return cleanText;
  const pick = dishes.find((dish) => dish.isRecommended) ?? dishes[0];
  const reason = buildRecommendationValidation(pick, activeProfile, weather, context, userText);
  const person = (context?.targetProfile ?? activeProfile)?.name;
  const target = person ? ` for ${person}` : "";
  return `${pick.dishName} from ${pick.restaurantName}${target} - ${reason}.`;
}

function buildDemoFallback(
  lastUserMessage: string,
  activeProfile?: PersonProfile | null,
  weather?: WeatherContext | null,
  context?: ConversationContext | null,
) {
  if (context?.intent === "greeting") {
    return {
      cleanText: "Heyy, tell me the vibe and I’ll sort the food.",
      clarification: null,
      dishes: null,
    };
  }

  if (context?.intent === "smalltalk" || context?.intent === "track_order" || context?.intent === "grocery" || context?.intent === "dineout") {
    return {
      cleanText: "I’m mostly here for food and orders. Tell me what you want to eat and I’ll take it from there.",
      clarification: null,
      dishes: null,
    };
  }

  if (context?.intent === "ask_clarification") {
    return {
      cleanText: context.clarificationQuestion ?? "Veg or non-veg today?",
      clarification: {
        question: context.clarificationQuestion ?? "Veg or non-veg today?",
        options: context.clarificationOptions ?? ["Veg", "Non-veg", "Either works"],
      },
      dishes: null,
    };
  }

  const text = lastUserMessage.toLowerCase();
  const wantsMoreOptions = /\b(show|give|need|want)\b.*\b(more|another|other)\b.*\b(option|options|choice|choices|recommendation|recommendations)\b/i.test(text)
    || /\bmore options?\b/i.test(text)
    || /\banother option\b/i.test(text);
  const diet = activeProfile?.preferences.diet ?? "both";
  const likes = new Set((activeProfile?.preferences.likes ?? []).map((v) => v.toLowerCase()));
  const dislikes = new Set((activeProfile?.preferences.dislikes ?? []).map((v) => v.toLowerCase()));
  const wantsVeg = diet === "veg" || /\bveg(etarian)?\b/.test(text);
  const wantsNonVeg = diet === "nonveg" || /\bnon[- ]?veg\b/.test(text);
  const wantsSpicy = /\bspicy|heat|fiery|schezwan|peri[- ]?peri|chilli|chili\b/.test(text) || likes.has("spicy");
  const wantsCheesy = /\bchees(y|e)|loaded|extra cheese|cheese burst\b/.test(text) || likes.has("cheesy");
  const wantsSweet = /\bsweet|dessert|chocolate|ice cream|brownie|pastry|mithai|gulab jamun|rasmalai|cake\b/.test(text) || likes.has("desserts");
  const wantsHealthy = /\bhealthy|light|salad|protein|clean|fresh\b/.test(text) || likes.has("healthy");
  const wantsComfort = /\bcomfort|cozy|rain|homely|biryani|khichdi|rajma|dal\b/.test(text);
  const wantsBreakfast = /\bbreakfast|morning|chai|coffee|start the day|poha|idli|dosa\b/.test(text);
  const wantsCoffee = /\bcoffee|espresso|cappuccino|latte|americano|mocha|cold coffee\b/.test(text);
  const wantsNew = /\b(bored|new|usual|not again|different)\b/.test(text);

  if (context?.intent === "order_now" || context?.intent === "order_for_someone") {
    const cartItem = parseCartItemFromText(lastUserMessage);
    if (cartItem) {
      const isVeg = !/\b(chicken|mutton|beef|fish|prawn|egg)\b/i.test(cartItem);
      const price = /\b(espresso|americano)\b/i.test(cartItem) ? 120 : /\b(cappuccino|latte|mocha)\b/i.test(cartItem) ? 190 : 220;
      const restaurantName = /\b(espresso|americano|cappuccino|latte|mocha|coffee)\b/i.test(cartItem) ? "Cafe Coffee Day" : "Behrouz Biryani";
      return {
        cleanText: `Done. Added ${cartItem} to cart.`,
        clarification: null,
        dishes: null,
        cart: {
          items: [{ dishName: cartItem, restaurantName, price, qty: 1, platform: "swiggy", isVeg }],
          total: price,
          platform: "swiggy",
          restaurantName,
        },
      };
    }
    return {
      cleanText: "Got it. Pick a dish first and I'll line up the order.",
      clarification: null,
      dishes: null,
      cart: null,
    };
  }

  const baseText = wantsSweet
    ? "Sweet craving locked. Let’s do dessert properly."
    : wantsBreakfast
    ? "Morning sorted. I’m going with a proper breakfast plate, not a sad snack."
    : wantsHealthy
      ? "Okay, let’s keep it light but actually satisfying."
      : wantsSpicy
        ? "You want heat. I’m leaning into something with real kick."
        : wantsCheesy
          ? "Cheesy comfort is the move here."
          : wantsComfort
            ? "This is comfort-food territory, easy."
            : "Okay, I’ve got a solid pick for you.";

  const candidateSets: Record<string, {
    restaurantName: string;
    platform: "swiggy";
    dishName: string;
    price: number;
    rating: number;
    isVeg: boolean;
    description: string;
    deliveryTime: number;
    offer: string;
    isRecommended: boolean;
    whyRecommended?: string;
  }[]> = {
    breakfast: [
      { restaurantName: "Sagar Ratna", platform: "swiggy", dishName: "Masala Dosa", price: 179, rating: 4.4, isVeg: true, description: "Crisp dosa with potato masala and chutneys", deliveryTime: 24, offer: "20% off", isRecommended: true, whyRecommended: "Bright start without feeling heavy" },
      { restaurantName: "Theobroma", platform: "swiggy", dishName: "Egg Croissant", price: 149, rating: 4.3, isVeg: false, description: "Buttery croissant stuffed fresh", deliveryTime: 20, offer: "", isRecommended: false },
      { restaurantName: "Chaayos", platform: "swiggy", dishName: "Chai & Poha Combo", price: 129, rating: 4.2, isVeg: true, description: "Tea and light breakfast combo", deliveryTime: 18, offer: "Free tea on combo", isRecommended: false },
      { restaurantName: "Bikanervala", platform: "swiggy", dishName: "Aloo Paratha", price: 169, rating: 4.1, isVeg: true, description: "Stuffed paratha with curd and pickle", deliveryTime: 26, offer: "", isRecommended: false },
    ],
    coffee: [
      { restaurantName: "Costa Coffee", platform: "swiggy", dishName: "Cafe Latte", price: 239, rating: 4.4, isVeg: true, description: "Rich latte with balanced espresso", deliveryTime: 22, offer: "", isRecommended: true, whyRecommended: "Smooth late-night pick-me-up" },
      { restaurantName: "Cafe Coffee Day", platform: "swiggy", dishName: "Cappuccino", price: 199, rating: 4.2, isVeg: true, description: "Classic foamy cappuccino", deliveryTime: 20, offer: "", isRecommended: false },
      { restaurantName: "Blue Tokai Coffee Roasters", platform: "swiggy", dishName: "Iced Americano", price: 189, rating: 4.5, isVeg: true, description: "Bold, chilled coffee with no sugar", deliveryTime: 24, offer: "", isRecommended: false },
      { restaurantName: "Third Wave Coffee", platform: "swiggy", dishName: "Mocha", price: 229, rating: 4.3, isVeg: true, description: "Coffee + chocolate comfort", deliveryTime: 23, offer: "", isRecommended: false },
    ],
    more_options: [
      { restaurantName: "Chaayos", platform: "swiggy", dishName: "Masala Maggi", price: 129, rating: 4.1, isVeg: true, description: "Quick savory comfort bowl", deliveryTime: 18, offer: "", isRecommended: true, whyRecommended: "Different vibe, still quick" },
      { restaurantName: "Subway", platform: "swiggy", dishName: "Paneer Tikka Sub", price: 219, rating: 4.2, isVeg: true, description: "Fresh and filling sub", deliveryTime: 24, offer: "", isRecommended: false },
      { restaurantName: "KFC", platform: "swiggy", dishName: "Zinger Burger", price: 229, rating: 4.2, isVeg: false, description: "Crunchy fast comfort", deliveryTime: 26, offer: "", isRecommended: false },
      { restaurantName: "Natural Ice Cream", platform: "swiggy", dishName: "Tender Coconut Ice Cream", price: 169, rating: 4.6, isVeg: true, description: "Light sweet closer", deliveryTime: 20, offer: "", isRecommended: false },
    ],
    healthy: [
      { restaurantName: "Salad Days", platform: "swiggy", dishName: "Grilled Paneer Bowl", price: 289, rating: 4.5, isVeg: true, description: "Paneer, greens, grains and a lemon dressing", deliveryTime: 28, offer: "10% off", isRecommended: true, whyRecommended: "Light, filling, and not boring" },
      { restaurantName: "FreshMenu", platform: "swiggy", dishName: "Chicken Quinoa Bowl", price: 319, rating: 4.4, isVeg: false, description: "Lean protein with quinoa and veggies", deliveryTime: 30, offer: "", isRecommended: false },
      { restaurantName: "Smoodies", platform: "swiggy", dishName: "Cold-pressed Smoothie Bowl", price: 249, rating: 4.2, isVeg: true, description: "Fruit, nuts and seeds in one bowl", deliveryTime: 22, offer: "", isRecommended: false },
      { restaurantName: "Haldiram's", platform: "swiggy", dishName: "Moong Dal Chilla", price: 189, rating: 4.1, isVeg: true, description: "Protein-heavy savory chillas", deliveryTime: 25, offer: "", isRecommended: false },
    ],
    sweet: [
      { restaurantName: "Theobroma", platform: "swiggy", dishName: "Chocolate Truffle Pastry", price: 179, rating: 4.6, isVeg: true, description: "Rich chocolate pastry with ganache layers", deliveryTime: 22, offer: "", isRecommended: true, whyRecommended: "Direct sweet hit, zero compromise" },
      { restaurantName: "Bikanervala", platform: "swiggy", dishName: "Gulab Jamun (2 pcs)", price: 119, rating: 4.3, isVeg: true, description: "Warm syrup-soaked classic mithai", deliveryTime: 24, offer: "", isRecommended: false },
      { restaurantName: "NIC Ice Creams", platform: "swiggy", dishName: "Belgian Chocolate Ice Cream", price: 189, rating: 4.5, isVeg: true, description: "Creamy dense chocolate scoop tub", deliveryTime: 18, offer: "10% off", isRecommended: false },
      { restaurantName: "Haldiram's", platform: "swiggy", dishName: "Rasmalai", price: 149, rating: 4.2, isVeg: true, description: "Soft paneer patties in sweet milk", deliveryTime: 26, offer: "", isRecommended: false },
    ],
    spicy: [
      { restaurantName: "Faasos", platform: "swiggy", dishName: "Peri Peri Chicken Wrap", price: 219, rating: 4.4, isVeg: false, description: "Spicy wrap with a proper kick", deliveryTime: 24, offer: "Buy 1 get 1", isRecommended: true, whyRecommended: "Heat without losing flavour" },
      { restaurantName: "Wow! Momo", platform: "swiggy", dishName: "Schezwan Paneer Momo", price: 199, rating: 4.2, isVeg: true, description: "Steamed momos with fiery sauce", deliveryTime: 20, offer: "", isRecommended: false },
      { restaurantName: "Biryani By Kilo", platform: "swiggy", dishName: "Hyderabadi Chicken Biryani", price: 399, rating: 4.6, isVeg: false, description: "Aromatic dum biryani with real depth", deliveryTime: 35, offer: "", isRecommended: false },
      { restaurantName: "Nasi and Mee", platform: "swiggy", dishName: "Chilli Garlic Noodles", price: 259, rating: 4.3, isVeg: true, description: "Noodles with a sharp chilli-garlic hit", deliveryTime: 26, offer: "", isRecommended: false },
    ],
    cheesy: [
      { restaurantName: "Domino's", platform: "swiggy", dishName: "Four Cheese Pizza", price: 349, rating: 4.5, isVeg: true, description: "Cheese-heavy pizza, zero subtlety", deliveryTime: 28, offer: "Flat 20% off", isRecommended: true, whyRecommended: "Maximum cheese, minimum overthinking" },
      { restaurantName: "Pizza Hut", platform: "swiggy", dishName: "Cheese Burst Margherita", price: 329, rating: 4.3, isVeg: true, description: "Classic pizza with a cheese burst base", deliveryTime: 30, offer: "", isRecommended: false },
      { restaurantName: "Burger King", platform: "swiggy", dishName: "Cheesy Whopper", price: 299, rating: 4.2, isVeg: false, description: "Big burger with lots of cheese", deliveryTime: 24, offer: "", isRecommended: false },
      { restaurantName: "Faasos", platform: "swiggy", dishName: "Cheesy Garlic Bread", price: 179, rating: 4.1, isVeg: true, description: "Garlic bread with gooey cheese", deliveryTime: 18, offer: "", isRecommended: false },
    ],
    comfort: [
      { restaurantName: "Behrouz Biryani", platform: "swiggy", dishName: "Chicken Dum Biryani", price: 369, rating: 4.6, isVeg: false, description: "Slow-cooked biryani with long-grain rice", deliveryTime: 32, offer: "15% off", isRecommended: true, whyRecommended: "Comfort food that actually lands" },
      { restaurantName: "Haldiram's", platform: "swiggy", dishName: "Rajma Chawal", price: 219, rating: 4.3, isVeg: true, description: "Classic homestyle rajma with rice", deliveryTime: 24, offer: "", isRecommended: false },
      { restaurantName: "Bikanervala", platform: "swiggy", dishName: "Paneer Butter Masala Thali", price: 289, rating: 4.2, isVeg: true, description: "Rich thali with paneer butter masala", deliveryTime: 29, offer: "", isRecommended: false },
      { restaurantName: "The Biryani Life", platform: "swiggy", dishName: "Veg Dum Biryani", price: 269, rating: 4.1, isVeg: true, description: "Comfort biryani with good aroma", deliveryTime: 31, offer: "", isRecommended: false },
    ],
    default: [
      { restaurantName: "Behrouz Biryani", platform: "swiggy", dishName: wantsVeg ? "Veg Dum Biryani" : "Chicken Dum Biryani", price: wantsVeg ? 279 : 369, rating: 4.5, isVeg: wantsVeg, description: wantsVeg ? "Aromatic veg biryani with proper depth" : "Slow-cooked chicken biryani", deliveryTime: 30, offer: "10% off", isRecommended: true, whyRecommended: "Safe pick with solid taste" },
      { restaurantName: "Faasos", platform: "swiggy", dishName: wantsVeg ? "Paneer Tikka Wrap" : "Chicken Tikka Wrap", price: wantsVeg ? 199 : 219, rating: 4.3, isVeg: wantsVeg, description: "Reliable wrap that never feels like a compromise", deliveryTime: 24, offer: "", isRecommended: false },
      { restaurantName: "Bikanervala", platform: "swiggy", dishName: "North Indian Meal", price: 249, rating: 4.1, isVeg: true, description: "Proper meal with dal, sabzi and roti", deliveryTime: 27, offer: "", isRecommended: false },
      { restaurantName: "Burger King", platform: "swiggy", dishName: wantsVeg ? "Veg Whopper" : "Chicken Burger", price: wantsVeg ? 219 : 239, rating: 4.0, isVeg: wantsVeg, description: "Familiar, filling, zero drama", deliveryTime: 22, offer: "", isRecommended: false },
    ],
  };

  const key = wantsMoreOptions || wantsNew
    ? "more_options"
    : wantsCoffee
      ? "coffee"
      : wantsSweet
        ? "sweet"
        : wantsBreakfast
          ? "breakfast"
          : wantsHealthy
            ? "healthy"
            : wantsSpicy
              ? "spicy"
              : wantsCheesy
                ? "cheesy"
                : wantsComfort
                  ? "comfort"
                  : "default";
  let dishes = candidateSets[key].filter((dish) => {
    if (wantsVeg && !dish.isVeg) return false;
    if (wantsNonVeg && dish.isVeg && key !== "default") return false;
    if (dislikes.has("sweets") && /dessert|sweet/i.test(dish.dishName)) return false;
    return true;
  });
  if (dishes.length < 4) {
    dishes = candidateSets.default.filter((dish) => wantsVeg ? dish.isVeg : true);
  }
  const recommended = dishes[0];
  const textLine = activeProfile?.name
    ? `${baseText} For ${activeProfile.name}, I’d go with ${recommended.dishName} from ${recommended.restaurantName}.`
    : `${baseText} I’d go with ${recommended.dishName} from ${recommended.restaurantName}.`;
  const hasClarity = /\b(idk|anything|whatever|surprise me|help|not sure|suggest)\b/.test(text)
    && !wantsSpicy
    && !wantsCheesy
    && !wantsSweet
    && !wantsHealthy
    && !wantsComfort
    && !wantsBreakfast
    && !wantsMoreOptions
    && !wantsNew;

  return {
    cleanText: hasClarity ? "Veg or non-veg today?" : textLine,
    clarification: hasClarity
      ? { question: "Veg or non-veg today?", options: ["Veg", "Non-veg", "Either works"] }
      : null,
    dishes: hasClarity ? null : dishes.slice(0, 4),
    cart: null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      messages, inputMode, activeProfile, allProfiles, weather,
      swiggyToken: userSwiggyToken,
    } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
      inputMode: string;
      activeProfile?: PersonProfile | null;
      allProfiles?: PersonProfile[];
      weather?: WeatherContext | null;
      swiggyToken?: string;
    };

    const swiggyToken = userSwiggyToken || process.env.SWIGGY_MCP_AUTH_TOKEN || undefined;
    const mcpServers = buildAgentMcpServers(swiggyToken);
    const hasMcp = mcpServers.length > 0;
    const encoder = new TextEncoder();
    const groqApiKey = pickGroqKey();
    const lastUserMessage = messages[messages.length - 1]?.content ?? "";
    const turnContext = buildConversationContext(lastUserMessage, activeProfile ?? null, allProfiles ?? [], weather ?? null);
    const systemPrompt = buildSystemPrompt(activeProfile, allProfiles, weather, hasMcp, turnContext) + GROQ_SYSTEM_SUFFIX;

    let sessionEmail: string | undefined;
    try {
      const session = await auth();
      sessionEmail = session?.user?.email ?? undefined;
    } catch {}

    const readable = new ReadableStream({
      async start(controller) {
        let fullText = "";
        try {
          // Trial limit check — exhausted users see a modal instead of a response
          let trialUsed = 0;
          if (sessionEmail) {
            const trial = await getTrialUsage(sessionEmail);
            if (trial.exhausted) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "trial_exhausted", used: trial.used })}\n\n`));
              controller.close();
              return;
            }
            trialUsed = trial.used;
          }

          // Order coming soon — always intercept when no live MCP
          if ((turnContext.intent === "order_now" || turnContext.intent === "order_for_someone") && !hasMcp) {
            const remaining = TRIAL_MESSAGE_LIMIT - trialUsed;
            const orderBlockText = `Ordering is coming very soon! Swiggy is reviewing Aaru's MCP integration — once approved, you'll place orders entirely by voice using your own Swiggy account.\n\nYou have ${remaining} trial message${remaining === 1 ? "" : "s"} left — explore more!`;
            const suggestions = {
              question: "What would you like to do?",
              options: ["Explore Instamart 🛒", "Order groceries", "Find stationery 📚", "Book a dineout 🍽️"],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "done",
              cleanText: orderBlockText,
              restaurants: null, dishes: null, orderDetails: null,
              clarification: suggestions,
              instamartItems: null, dineoutVenues: null, cart: null, orderStatus: null,
              hasMcp: false,
              shouldSpeak: inputMode === "voice",
            })}\n\n`));
            controller.close();
            return;
          }

          if (turnContext.intent === "greeting" || turnContext.intent === "smalltalk" || turnContext.intent === "track_order" || turnContext.intent === "grocery" || turnContext.intent === "dineout" || turnContext.intent === "ask_clarification") {
            const fallback = buildDemoFallback(lastUserMessage, activeProfile ?? null, weather ?? null, turnContext);
            const validatedDishes = validateDishRecommendations(fallback.dishes, activeProfile ?? null, weather ?? null, turnContext, lastUserMessage);
            const cleanText = recommendationLine(fallback.cleanText, validatedDishes, activeProfile ?? null, weather ?? null, turnContext, lastUserMessage);
            const maybeBlock = fallback.clarification
              ? `\n\n\`\`\`clarification\n${JSON.stringify(fallback.clarification)}\n\`\`\``
              : validatedDishes
                ? `\n\n\`\`\`dishes\n${JSON.stringify(validatedDishes)}\n\`\`\``
                : "";
            fullText = `${cleanText}${maybeBlock}`;
            if (sessionEmail) await incrementTrialUsage(sessionEmail).catch(() => {});
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "done",
              cleanText,
              restaurants: null,
              dishes: validatedDishes,
              orderDetails: null,
              clarification: fallback.clarification,
              instamartItems: null,
              dineoutVenues: null,
              cart: (fallback as { cart?: unknown }).cart ?? null,
              orderStatus: null,
              hasMcp: false,
              shouldSpeak: inputMode === "voice",
            })}\n\n`));
            controller.close();
            return;
          }

          if (!groqApiKey) {
            const fallback = buildDemoFallback(lastUserMessage, activeProfile ?? null, weather ?? null, turnContext);
            const validatedDishes = validateDishRecommendations(fallback.dishes, activeProfile ?? null, weather ?? null, turnContext, lastUserMessage);
            const cleanText = recommendationLine(fallback.cleanText, validatedDishes, activeProfile ?? null, weather ?? null, turnContext, lastUserMessage);
            const maybeBlock = fallback.clarification
              ? `\n\n\`\`\`clarification\n${JSON.stringify(fallback.clarification)}\n\`\`\``
              : validatedDishes
                ? `\n\n\`\`\`dishes\n${JSON.stringify(validatedDishes)}\n\`\`\``
                : "";
            fullText = `${cleanText}${maybeBlock}`;
            if (sessionEmail) await incrementTrialUsage(sessionEmail).catch(() => {});
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "done",
              cleanText,
              restaurants: null,
              dishes: validatedDishes,
              orderDetails: null,
              clarification: fallback.clarification,
              instamartItems: null,
              dineoutVenues: null,
              cart: (fallback as { cart?: unknown }).cart ?? null,
              orderStatus: null,
              hasMcp: false,
              shouldSpeak: inputMode === "voice",
            })}\n\n`));
            controller.close();
            return;
          }

          if (hasMcp) {
            try {
              await Promise.all(mcpServers.map((server) => server.connect()));
            } catch (err) {
              if (statusOf(err) === 401) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token_expired" })}\n\n`));
                controller.close();
                return;
              }
              throw err;
            }

            try {
              const groqClient = new OpenAI({ apiKey: groqApiKey, baseURL: "https://api.groq.com/openai/v1" });
              const agent = new Agent({
                name: "Aaru",
                instructions: systemPrompt,
                model: new OpenAIChatCompletionsModel(groqClient, "llama-3.3-70b-versatile"),
                mcpServers,
              });
              const history = messages.slice(0, -1).map((m) => `${m.role === "user" ? "User" : "Aaru"}: ${m.content}`).join("\n");
              const lastMsg = messages[messages.length - 1]?.content ?? "";
              const input = history ? `${history}\nUser: ${lastMsg}` : lastMsg;
              const result = await new Runner().run(agent, input);
              fullText = String(result.finalOutput ?? "");
            } catch (err) {
              if (statusOf(err) === 401) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token_expired" })}\n\n`));
                controller.close();
                return;
              }
              throw err;
            } finally {
              await Promise.all(mcpServers.map((server) => server.close().catch(() => {})));
            }
          } else {
            const groq = new Groq({ apiKey: groqApiKey });
            const groqStream = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              max_tokens: 1200,
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                ...messages.map((m) => ({ role: m.role, content: m.content })),
              ],
            });
            for await (const chunk of groqStream) {
              const text = chunk.choices[0]?.delta?.content ?? "";
              if (!text) continue;
              fullText += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`));
            }
          }

          const parsedDishes = validateDishRecommendations(parseBlock(fullText, "dishes"), activeProfile ?? null, weather ?? null, turnContext, lastUserMessage);
          const cleanText = recommendationLine(stripBlocks(fullText), parsedDishes, activeProfile ?? null, weather ?? null, turnContext, lastUserMessage);

          if (sessionEmail) await incrementTrialUsage(sessionEmail).catch(() => {});
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "done",
            cleanText,
            restaurants: parseBlock(fullText, "restaurants"),
            dishes: parsedDishes,
            orderDetails: parseBlock(fullText, "order"),
            clarification: parseBlock(fullText, "clarification"),
            instamartItems: parseBlock(fullText, "instamart"),
            dineoutVenues: parseBlock(fullText, "dineout"),
            cart: parseBlock(fullText, "cart"),
            orderStatus: parseBlock(fullText, "order_status"),
            hasMcp,
            shouldSpeak: inputMode === "voice",
          })}\n\n`));
          controller.close();
        } catch (err) {
          await Promise.all(mcpServers.map((server) => server.close().catch(() => {})));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to start stream" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

function streamError(message: string) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`));
      controller.close();
    },
  });
  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
