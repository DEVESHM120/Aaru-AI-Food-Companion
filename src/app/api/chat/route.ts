import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/systemPrompt";
import { WeatherContext } from "@/lib/types";
import { PersonProfile } from "@/lib/profiles/types";

export const maxDuration = 60;

function buildMcpServers(swiggyToken?: string, zomatoToken?: string) {
  const servers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[] = [];
  if (swiggyToken) {
    servers.push(
      { type: "url", name: "swiggy-food", url: "https://mcp.swiggy.com/food", authorization_token: swiggyToken },
      { type: "url", name: "swiggy-instamart", url: "https://mcp.swiggy.com/im", authorization_token: swiggyToken },
      { type: "url", name: "swiggy-dineout", url: "https://mcp.swiggy.com/dineout", authorization_token: swiggyToken },
    );
  }
  if (zomatoToken) {
    servers.push(
      { type: "url", name: "zomato", url: "https://mcp-server.zomato.com/mcp", authorization_token: zomatoToken },
    );
  }
  return servers;
}

const SYSTEM_SUFFIX = `\n\nIMPORTANT: For VAGUE intent → use ONLY the \`\`\`clarification block. For all other intents → use EITHER \`\`\`restaurants OR \`\`\`dishes (never both, never with clarification). Always real Indian names, INR prices.`;

const GROQ_SYSTEM_SUFFIX = `\n\nSTRICT OUTPUT FORMAT — follow exactly:

RULE 1: Start with ONE confident sell line (e.g. "Okay so butter chicken from Punjabi Dhaba — it's dinner time and this one's gonna hit."). NOT a list.

RULE 2: Then output a JSON block with 4–5 items. Pick dishes OR restaurants, never both.

RULE 3: dishes block format (FIRST item gets isRecommended:true + whyRecommended, rest get isRecommended:false):
\`\`\`dishes
[{"restaurantName":"Place Name","platform":"swiggy","dishName":"Top Pick Dish","price":299,"rating":4.3,"isVeg":false,"description":"One line description","deliveryTime":28,"offer":"10% off","isRecommended":true,"whyRecommended":"Best for current mood and time"},{"restaurantName":"Other Place","platform":"zomato","dishName":"Alt Dish","price":249,"rating":4.1,"isVeg":false,"description":"Another option","deliveryTime":32,"offer":"","isRecommended":false}]
\`\`\`

RULE 4: restaurants block format:
\`\`\`restaurants
[{"id":"1","name":"Restaurant Name","cuisine":"North Indian","rating":4.3,"deliveryTime":28,"price":349,"platform":"zomato","offer":"Free delivery"}]
\`\`\`

RULE 5: For vague requests ONLY:
\`\`\`clarification
{"question":"Veg or non-veg today?","options":["Veg","Non-veg","Either works"]}
\`\`\`

RULE 6: Always 4–5 items in dishes/restaurants. Real Indian restaurant names. Prices in INR. Mix platforms (swiggy and zomato). Never output just 1 item.`;

export async function POST(req: NextRequest) {
  try {
    const {
      messages, inputMode, activeProfile, allProfiles, weather,
      anthropicKey, zomatoToken: userZomatoToken, swiggyToken: userSwiggyToken,
      isTrial,
    } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
      inputMode: string;
      activeProfile?: PersonProfile | null;
      allProfiles?: PersonProfile[];
      weather?: WeatherContext | null;
      anthropicKey?: string;
      zomatoToken?: string;
      swiggyToken?: string;
      isTrial?: boolean;
    };

    const swiggyToken = userSwiggyToken || process.env.SWIGGY_MCP_AUTH_TOKEN || undefined;
    const zomatoToken = userZomatoToken || process.env.ZOMATO_MCP_AUTH_TOKEN || undefined;
    const mcpServers = buildMcpServers(swiggyToken, zomatoToken);
    const hasMcp = mcpServers.length > 0;

    const systemPrompt = buildSystemPrompt(activeProfile, allProfiles, weather, hasMcp);
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";

          // ── Trial mode: use Groq (free) ──────────────────────────────────
          if (isTrial && !anthropicKey) {
            const groqApiKey = process.env.GROQ_API_KEY;
            if (!groqApiKey) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Trial unavailable — GROQ_API_KEY not configured." })}\n\n`));
              controller.close();
              return;
            }
            const groq = new Groq({ apiKey: groqApiKey });
            const groqStream = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              max_tokens: 1100,
              stream: true,
              messages: [
                { role: "system", content: systemPrompt + GROQ_SYSTEM_SUFFIX },
                ...messages.map((m) => ({ role: m.role, content: m.content })),
              ],
            });

            for await (const chunk of groqStream) {
              const text = chunk.choices[0]?.delta?.content ?? "";
              if (text) {
                fullText += text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`));
              }
            }
          } else {
            // ── Full mode: use Anthropic (user key or env key) + MCP ──────
            const client = new Anthropic({ apiKey: anthropicKey || process.env.ANTHROPIC_API_KEY });
            let stream;

            if (hasMcp) {
              stream = client.beta.messages.stream({
                model: "claude-sonnet-4-6",
                max_tokens: 1200,
                system: systemPrompt + SYSTEM_SUFFIX,
                messages,
                mcp_servers: mcpServers,
                tools: mcpServers.map(s => ({ type: "mcp_toolset" as const, mcp_server_name: s.name })),
                betas: ["mcp-client-2025-11-20"],
              } as Parameters<typeof client.beta.messages.stream>[0]);
            } else {
              stream = client.messages.stream({
                model: "claude-sonnet-4-6",
                max_tokens: 800,
                system: systemPrompt + SYSTEM_SUFFIX,
                messages,
              });
            }

            try {
              for await (const chunk of stream) {
                if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                  const text = chunk.delta.text;
                  fullText += text;
                  // Skip chunk streaming for MCP — Claude outputs tool-reasoning text users shouldn't see
                  if (!hasMcp) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`));
                  }
                }
              }
            } catch (e: unknown) {
              if ((e as { status?: number })?.status === 401) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token_expired" })}\n\n`));
                controller.close();
                return;
              }
              throw e;
            }
          }

          // ── Parse JSON blocks ─────────────────────────────────────────────
          const cleanText = fullText
            .replace(/```restaurants[\s\S]*?```/g, "")
            .replace(/```dishes[\s\S]*?```/g, "")
            .replace(/```order[\s\S]*?```/g, "")
            .replace(/```clarification[\s\S]*?```/g, "")
            .replace(/```instamart[\s\S]*?```/g, "")
            .replace(/```dineout[\s\S]*?```/g, "")
            .replace(/```cart[\s\S]*?```/g, "")
            .replace(/```order_status[\s\S]*?```/g, "")
            .trim();

          const parse = (re: RegExp) => { try { const m = fullText.match(re); return m ? JSON.parse(m[1]) : null; } catch { return null; } };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "done",
            cleanText,
            restaurants: parse(/```restaurants\n([\s\S]*?)\n```/),
            dishes: parse(/```dishes\n([\s\S]*?)\n```/),
            orderDetails: parse(/```order\n([\s\S]*?)\n```/),
            clarification: parse(/```clarification\n([\s\S]*?)\n```/),
            instamartItems: parse(/```instamart\n([\s\S]*?)\n```/),
            dineoutVenues: parse(/```dineout\n([\s\S]*?)\n```/),
            cart: parse(/```cart\n([\s\S]*?)\n```/),
            orderStatus: parse(/```order_status\n([\s\S]*?)\n```/),
            hasMcp,
            shouldSpeak: inputMode === "voice",
          })}\n\n`));

          controller.close();
        } catch (err) {
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
