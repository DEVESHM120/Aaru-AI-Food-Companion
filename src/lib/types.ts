export type InputMode = "text" | "voice";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  inputMode?: InputMode;
  timestamp: Date;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  deliveryTime: number; // minutes
  price: number; // INR
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
}

export interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  inputMode: InputMode;
}

export interface ChatResponse {
  message: string;
  restaurants?: Restaurant[];
  orderDetails?: OrderDetails;
  shouldSpeak: boolean;
}
