import { NextRequest, NextResponse } from "next/server";
import { WeatherContext } from "@/lib/types";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") || "Delhi";

  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { headers: { "User-Agent": "AaruFoodCompanion/1.0" }, next: { revalidate: 1800 } }
    );

    if (!res.ok) throw new Error("wttr.in unavailable");

    const data = await res.json();
    const current = data.current_condition?.[0];

    const tempC = parseInt(current?.temp_C ?? "30");
    const description = current?.weatherDesc?.[0]?.value ?? "Clear";

    const weather: WeatherContext = {
      city,
      tempC,
      description,
      isHot: tempC > 33,
      isRaining: description.toLowerCase().includes("rain") ||
                 description.toLowerCase().includes("drizzle") ||
                 description.toLowerCase().includes("thunder"),
    };

    return NextResponse.json(weather);
  } catch {
    // Fallback — don't break the app if weather fails
    const fallback: WeatherContext = {
      city,
      tempC: 30,
      description: "Clear",
      isHot: false,
      isRaining: false,
    };
    return NextResponse.json(fallback);
  }
}
