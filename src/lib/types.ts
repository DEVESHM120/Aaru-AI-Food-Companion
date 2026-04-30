export type InputMode = "text" | "voice";
export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export type { PersonProfile, PersonAddress, PastOrder } from "./profiles/types";
// UserProfile is now PersonProfile — keep the alias for any legacy usage
export type { PersonProfile as UserProfile } from "./profiles/types";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  inputMode?: InputMode;
  timestamp: Date;
  streaming?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  deliveryTime: number;
  price: number;
  platform: "zomato" | "swiggy";
  imageUrl?: string;
  offer?: string;
}

export interface OrderDetails {
  restaurant: Restaurant;
  item: string;
  price: number;
  platform: "zomato" | "swiggy";
  estimatedDelivery: number;
  autonomous?: boolean;
  deliveryAddress?: { label: string; locationName: string; addressId?: string };
}

export interface Dish {
  restaurantName: string;
  platform: "zomato" | "swiggy";
  dishName: string;
  price: number;
  rating: number;
  isVeg: boolean;
  description?: string;
  deliveryTime?: number;
  offer?: string;
  isRecommended?: boolean;
  whyRecommended?: string;
}

export interface WeatherContext {
  city: string;
  tempC: number;
  description: string;
  isHot: boolean;
  isRaining: boolean;
}

export interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  inputMode: InputMode;
  activeProfile?: import("./profiles/types").PersonProfile | null;
  allProfiles?: import("./profiles/types").PersonProfile[];
  weather?: WeatherContext | null;
}

export interface QuickChip {
  label: string;
  emoji: string;
  query: string;
}

export interface ClarificationBlock {
  question: string;
  options: string[];
}

export interface CartItem {
  dishName: string;
  restaurantName: string;
  price: number;
  qty: number;
  platform: "zomato" | "swiggy";
  isVeg: boolean;
}

export interface CartBlock {
  items: CartItem[];
  total: number;
  platform: "zomato" | "swiggy";
  restaurantName: string;
}

export interface InstamartItem {
  name: string;
  brand: string;
  price: number;
  unit: string;
  isAvailable: boolean;
}

export interface InstamartBlock {
  items: InstamartItem[];
  deliveryTime: number;
}

export interface DineoutRestaurant {
  name: string;
  cuisine: string;
  location: string;
  rating: number;
  avgCost: number;
  availableSlots: string[];
}

export interface DineoutBlock {
  restaurants: DineoutRestaurant[];
  bookingDate?: string;
  partySize?: number;
}

export interface OrderStatusBlock {
  orderId: string;
  status: "accepted" | "preparing" | "picked_up" | "on_the_way" | "delivered";
  eta: number;
  platform: "zomato" | "swiggy";
}
