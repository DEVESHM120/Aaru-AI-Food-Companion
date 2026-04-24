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
            max_tokens: 600,
            system: systemPrompt + "\n\nIMPORTANT: Follow the intent classification rules in your instructions. For VAGUE intent with no profile signal → use ONLY the ```clarification block (no dishes/restaurants). For all other intents → use EITHER ```restaurants OR ```dishes (never both, never with clarification). Always use real Indian names and INR prices.",
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
            .replace(/```clarification[\s\S]*?```/g, "")
            .trim();

          const restaurantMatch = fullText.match(/```restaurants\n([\s\S]*?)\n```/);
          const dishesMatch = fullText.match(/```dishes\n([\s\S]*?)\n```/);
          const orderMatch = fullText.match(/```order\n([\s\S]*?)\n```/);
          const clarificationMatch = fullText.match(/```clarification\n([\s\S]*?)\n```/);

          let restaurants = null;
          let dishes = null;
          let orderDetails = null;
          let clarification = null;

          if (restaurantMatch) {
            try { restaurants = JSON.parse(restaurantMatch[1]); } catch {}
          }
          if (dishesMatch) {
            try { dishes = JSON.parse(dishesMatch[1]); } catch {}
          }
          if (orderMatch) {
            try { orderDetails = JSON.parse(orderMatch[1]); } catch {}
          }
          if (clarificationMatch) {
            try { clarification = JSON.parse(clarificationMatch[1]); } catch {}
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                cleanText,
                restaurants,
                dishes,
                orderDetails,
                clarification,
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
