import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PersonProfile, PastOrder } from "@/lib/profiles/types";
import { ZomatoUserInfo } from "@/app/api/user/route";
import { ZomatoContact } from "@/app/api/contacts/route";

const PROFILE_PATH = path.join(process.cwd(), "data", "profile.md");

export async function GET() {
  try {
    const content = fs.readFileSync(PROFILE_PATH, "utf-8");
    return NextResponse.json({ content, exists: true });
  } catch {
    return NextResponse.json({ content: "", exists: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { primaryProfile, contacts, userInfo } = await req.json() as {
      primaryProfile: PersonProfile;
      contacts: ZomatoContact[];
      userInfo: ZomatoUserInfo;
    };

    const md = buildProfileMd(primaryProfile, contacts, userInfo);

    const dir = path.dirname(PROFILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROFILE_PATH, md, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

function buildProfileMd(
  profile: PersonProfile,
  contacts: ZomatoContact[],
  userInfo: ZomatoUserInfo
): string {
  const lines: string[] = [];

  lines.push(`# Aaru Profile — ${profile.name}`);
  lines.push("");

  // About
  lines.push("## About");
  lines.push(`- Name: ${profile.name}`);
  const diet = userInfo.diet ?? profile.preferences.diet;
  lines.push(`- Diet: ${diet}`);
  const budget = userInfo.budgetRange ?? profile.preferences.priceRange;
  const budgetLabel = budget === "budget" ? "budget (under ₹150)" : budget === "premium" ? "premium (₹400+)" : "mid (₹150–400 per person)";
  lines.push(`- Budget: ${budgetLabel}`);
  if (userInfo.allergies && userInfo.allergies.length > 0) {
    lines.push(`- Allergies/Restrictions: ${userInfo.allergies.join(", ")}`);
  }
  lines.push("");

  // Preferred cuisines / likes
  const cuisines = userInfo.preferredCuisines ?? [];
  const likes = [...new Set([...cuisines, ...profile.preferences.likes])];
  if (likes.length > 0) {
    lines.push("## Likes");
    lines.push(`- ${likes.join(", ")}`);
    lines.push("");
  }

  // Dislikes
  if (profile.preferences.dislikes.length > 0) {
    lines.push("## Dislikes");
    lines.push(`- ${profile.preferences.dislikes.join(", ")}`);
    lines.push("");
  }

  // Addresses
  if (profile.addresses.length > 0) {
    lines.push("## Delivery Addresses");
    for (const addr of profile.addresses) {
      lines.push(`- ${addr.label}: ${addr.locationName}`);
    }
    lines.push("");
  }

  // Recent orders
  const orders = profile.pastOrders.slice(0, 10);
  if (orders.length > 0) {
    lines.push("## Recent Orders");
    for (const o of orders) {
      const date = o.orderedAt ? new Date(o.orderedAt).toISOString().split("T")[0] : "";
      lines.push(`- ${o.itemName} — ${o.restaurantName} (₹${o.price}, ${o.platform})${date ? ` — ${date}` : ""}`);
    }
    lines.push("");
  }

  // Known contacts / family
  if (contacts.length > 0) {
    lines.push("## Known People (Saved Contacts)");
    for (const c of contacts) {
      const addrs = c.addresses?.map((a) => `${a.label}: ${a.locationName}`).join("; ") ?? "no address";
      const notes = c.notes ? ` — ${c.notes}` : "";
      lines.push(`- ${c.name}: ${c.diet ?? "any diet"}, addresses: [${addrs}]${notes}`);
    }
    lines.push("");
  }

  // Notes — user-editable section, left blank by auto-generation
  lines.push("## Notes");
  lines.push("(Edit this section freely. Aaru reads it on every message.)");
  lines.push("");

  return lines.join("\n");
}
