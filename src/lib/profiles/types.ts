export interface PersonAddress {
  addressId: string;
  locationName: string;
  city: string;
  label: string; // "Home", "Office", "Mom's place"
}

export interface PastOrder {
  restaurantName: string;
  itemName: string;
  price: number;
  platform: "zomato" | "swiggy";
  orderedAt: string; // ISO date string
}

export interface PersonProfile {
  id: string;
  name: string; // "Divya", "Devesh"
  addresses: PersonAddress[];
  defaultAddressId?: string;
  preferences: {
    likes: string[];
    dislikes: string[];
    diet: "veg" | "nonveg" | "both";
    priceRange: "budget" | "mid" | "premium";
    notes: string; // free text: "doesn't like sweet in periods", "lactose intolerant"
  };
  pastOrders: PastOrder[];
  memories?: string[]; // learned facts from conversations, newest first, max 30
}
