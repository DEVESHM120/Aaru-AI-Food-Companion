import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { buildSystemPrompt } from "@/lib/systemPrompt";
import { WeatherContext } from "@/lib/types";
import { PersonProfile } from "@/lib/profiles/types";

function readProfileMd(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "data", "profile.md"), "utf-8");
  } catch {
    return "";
  }
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, inputMode, activeProfile, allProfiles, weather } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
      inputMode: string;
      activeProfile?: PersonProfile | null;
      allProfiles?: PersonProfile[];
      weather?: WeatherContext | null;
    };



    const profileMd = readProfileMd();
    const systemPrompt = buildSystemPrompt(activeProfile, allProfiles, weather, profileMd);
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 512,
            system: systemPrompt + "\n\nIMPORTANT: Always include EITHER a ```restaurants block OR a ```dishes block (never both). Use ```dishes when the user asks about specific food items, prices, or menu. Use ```restaurants when the user asks about which place to order from. Default to ```dishes — it's more helpful. Use real Indian names and INR prices.",
            messages,
          });

          let fullText = "";

          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              const text = chunk.delta.text;
              fullText += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "chunk", text })}\n\n`
                )
              );
            }
          }

          const cleanText = fullText
            .replace(/```restaurants[\s\S]*?```/g, "")
            .replace(/```dishes[\s\S]*?```/g, "")
            .replace(/```order[\s\S]*?```/g, "")
            .trim();

          const restaurantMatch = fullText.match(/```restaurants\n([\s\S]*?)\n```/);
          const dishesMatch = fullText.match(/```dishes\n([\s\S]*?)\n```/);
          const orderMatch = fullText.match(/```order\n([\s\S]*?)\n```/);

          let restaurants = null;
          let dishes = null;
          let orderDetails = null;

          if (restaurantMatch) {
            try { restaurants = JSON.parse(restaurantMatch[1]); } catch {}
          }
          if (dishesMatch) {
            try { dishes = JSON.parse(dishesMatch[1]); } catch {}
          }
          if (orderMatch) {
            try { orderDetails = JSON.parse(orderMatch[1]); } catch {}
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                cleanText,
                restaurants,
                dishes,
                orderDetails,
                shouldSpeak: inputMode === "voice",
              })}\n\n`
            )
          );

          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to start stream" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
