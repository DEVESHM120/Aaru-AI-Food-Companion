import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import OpenAI from "openai";
import { Agent, Runner, MCPServerStreamableHttp, OpenAIChatCompletionsModel } from "@openai/agents";
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/systemPrompt";
import { WeatherContext } from "@/lib/types";
import { PersonProfile } from "@/lib/profiles/types";
import { auth } from "@/auth";

export const maxDuration = 60;

const TRIAL_ORDER_LIMIT = 5;

// ── Anthropic MCP servers (full mode) — Swiggy only, Zomato is read-only ────
function buildMcpServers(swiggyToken?: string) {
  if (!swiggyToken) return [];
  return [
    { type: "url" as const, name: "swiggy-food", url: "https://mcp.swiggy.com/food", authorization_token: swiggyToken },
    { type: "url" as const, name: "swiggy-instamart", url: "https://mcp.swiggy.com/im", authorization_token: swiggyToken },
    { type: "url" as const, name: "swiggy-dineout", url: "https://mcp.swiggy.com/dineout", authorization_token: swiggyToken },
  ] as Anthropic.Beta.BetaRequestMCPServerURLDefinition[];
}

// ── OpenAI Agents SDK MCP servers (trial mode — Groq model) ─────────────────
function buildAgentMcpServers(swiggyToken?: string) {
  if (!swiggyToken) return [];
  const authHeaders = { headers: { Authorization: `Bearer ${swiggyToken}` } };
  return [
    new MCPServerStreamableHttp({ name: "swiggy-food", url: "https://mcp.swiggy.com/food", requestInit: authHeaders }),
    new MCPServerStreamableHttp({ name: "swiggy-instamart", url: "https://mcp.swiggy.com/im", requestInit: authHeaders }),
    new MCPServerStreamableHttp({ name: "swiggy-dineout", url: "https://mcp.swiggy.com/dineout", requestInit: authHeaders }),
  ];
}

const SYSTEM_SUFFIX = `\n\nIMPORTANT: For VAGUE intent → use ONLY the \`\`\`clarification block. For all other intents → use EITHER \`\`\`restaurants OR \`\`\`dishes (never both, never with clarification). Always real Indian names, INR prices.`;

// Full system prompt suffix for Groq — covers ALL block types so trial gets every feature
const GROQ_SYSTEM_SUFFIX = `\n\nOUTPUT FORMAT — follow exactly, no exceptions:

Pick ONE block type per response based on intent. Never mix block types.

\`\`\`dishes — food/dish recommendation (4–5 items, FIRST item isRecommended:true):
[{"restaurantName":"Behrouz Biryani","platform":"swiggy","dishName":"Chicken Dum Biryani","price":349,"rating":4.4,"isVeg":false,"description":"Slow-cooked aromatic biryani","deliveryTime":28,"offer":"20% off","isRecommended":true,"whyRecommended":"Perfect rainy dinner comfort pick"},{"restaurantName":"Punjab Grill","platform":"zomato","dishName":"Butter Chicken","price":299,"rating":4.2,"isVeg":false,"description":"Creamy tomato gravy","deliveryTime":32,"offer":"","isRecommended":false}]

\`\`\`restaurants — restaurant recommendation (3–4 items):
[{"id":"1","name":"Barbeque Nation","cuisine":"North Indian","rating":4.3,"deliveryTime":28,"price":349,"platform":"zomato","offer":"Free delivery"}]

\`\`\`clarification — vague/unclear only:
{"question":"Veg or non-veg today?","options":["Veg","Non-veg","Either works"]}

\`\`\`order — when user confirms they want to order:
{"restaurant":{"id":"1","name":"Behrouz Biryani","cuisine":"Mughlai","rating":4.4,"deliveryTime":28,"price":349,"platform":"swiggy"},"item":"Chicken Dum Biryani","price":349,"platform":"swiggy","estimatedDelivery":28,"autonomous":false}

\`\`\`order_status — after order confirmed (include after order block):
{"orderId":"ORD-${Date.now()}","status":"accepted","eta":28,"platform":"swiggy"}

\`\`\`cart — when items are added before full checkout:
{"items":[{"dishName":"Chicken Dum Biryani","restaurantName":"Behrouz Biryani","price":349,"qty":1,"platform":"swiggy","isVeg":false}],"total":349,"platform":"swiggy","restaurantName":"Behrouz Biryani"}

\`\`\`instamart — grocery/quick-commerce requests:
{"items":[{"name":"Amul Milk 1L","brand":"Amul","price":68,"unit":"1L","isAvailable":true},{"name":"Brown Bread","brand":"Britannia","price":45,"unit":"400g","isAvailable":true},{"name":"Eggs 6-pack","brand":"Suguna","price":72,"unit":"6 pcs","isAvailable":true}],"deliveryTime":12}

\`\`\`dineout — book table / dine-in requests:
{"restaurants":[{"name":"Barbeque Nation","cuisine":"North Indian","location":"Connaught Place","rating":4.4,"avgCost":900,"availableSlots":["7:00 PM","7:30 PM","8:00 PM","8:30 PM"]},{"name":"Social","cuisine":"Continental","location":"Hauz Khas","rating":4.2,"avgCost":600,"availableSlots":["7:00 PM","8:00 PM","9:00 PM"]}],"partySize":2,"bookingDate":"today"}

Rules: Real Indian restaurant names. Prices in INR. Mix swiggy/zomato platforms. 4–5 items in dishes/restaurants. One punchy sell line before the block.`;

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

    // hasMcp drives the system prompt (tells Claude about live data access) — Swiggy only
    const anthropicMcpServers = buildMcpServers(swiggyToken);
    const hasMcp = anthropicMcpServers.length > 0;

    const systemPrompt = buildSystemPrompt(activeProfile, allProfiles, weather, hasMcp);
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";

          // ── Order limit applies whenever user has no own Anthropic key ───
          const usingOurKey = !anthropicKey;
          if (usingOurKey) {
            let session = null;
            try { session = await auth(); } catch {}
            const email = session?.user?.email;
            if (email) {
              try {
                const { kv } = await import("@vercel/kv");
                const orderCount = (await kv.get<number>(`trial:orders:${email}`)) ?? 0;
                if (orderCount >= TRIAL_ORDER_LIMIT) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "trial_exhausted", ordersUsed: orderCount })}\n\n`));
                  controller.close();
                  return;
                }
              } catch {}
            }
          }

          // ── Trial mode: Groq model + OpenAI Agents SDK MCP ──────────────
          if (isTrial && !anthropicKey) {
            const groqApiKey = process.env.GROQ_API_KEY;
            if (!groqApiKey) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Trial unavailable — GROQ_API_KEY not configured." })}\n\n`));
              controller.close();
              return;
            }

            const agentMcpServers = buildAgentMcpServers(swiggyToken);

            const runGroqDemo = async () => {
              // ── Pure Groq streaming — demo data, no MCP ──────────────────
              const groq = new Groq({ apiKey: groqApiKey });
              const groqStream = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                max_tokens: 1200,
                stream: true,
                messages: [
                  { role: "system", content: systemPrompt + GROQ_SYSTEM_SUFFIX },
                  ...messages.map(m => ({ role: m.role, content: m.content })),
                ],
              });
              for await (const chunk of groqStream) {
                const text = chunk.choices[0]?.delta?.content ?? "";
                if (text) {
                  fullText += text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`));
                }
              }
            };

            if (agentMcpServers.length > 0) {
              // ── Trial with real MCP: Groq + OpenAI Agents SDK ────────────
              // On any auth failure, fall back to Groq demo mode gracefully
              let mcpFailed = false;
              try {
                await Promise.all(agentMcpServers.map(s => s.connect()));
              } catch {
                mcpFailed = true;
              }

              if (!mcpFailed) {
                try {
                  const groqClient = new OpenAI({ apiKey: groqApiKey, baseURL: "https://api.groq.com/openai/v1" });
                  const agent = new Agent({
                    name: "Aaru",
                    instructions: systemPrompt + GROQ_SYSTEM_SUFFIX,
                    model: new OpenAIChatCompletionsModel(groqClient, "llama-3.3-70b-versatile"),
                    mcpServers: agentMcpServers,
                  });
                  const history = messages.slice(0, -1).map(m => `${m.role === "user" ? "User" : "Aaru"}: ${m.content}`).join("\n");
                  const lastMsg = messages[messages.length - 1]?.content ?? "";
                  const input = history ? `${history}\nUser: ${lastMsg}` : lastMsg;
                  const result = await new Runner().run(agent, input);
                  fullText = String(result.finalOutput ?? "");
                } catch (e: unknown) {
                  const status = (e as { status?: number })?.status;
                  if (status === 401) {
                    // Swiggy token expired — tell client to re-auth
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token_expired" })}\n\n`));
                    controller.close();
                    return;
                  }
                  mcpFailed = true;
                } finally {
                  await Promise.all(agentMcpServers.map(s => s.close().catch(() => {})));
                }
              }

              // MCP failed (expired/invalid token) → fall back to Groq demo
              if (mcpFailed) {
                fullText = "";
                await runGroqDemo();
              }
            } else {
              await runGroqDemo();
            }

          } else {
            // ── Full mode: Anthropic + MCP ────────────────────────────────
            const apiKey = anthropicKey || process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "No Anthropic API key. Add your key in Settings." })}\n\n`));
              controller.close();
              return;
            }

            const client = new Anthropic({ apiKey });
            let stream;

            if (hasMcp) {
              stream = client.beta.messages.stream({
                model: "claude-sonnet-4-6",
                max_tokens: 1200,
                system: systemPrompt + SYSTEM_SUFFIX,
                messages,
                mcp_servers: anthropicMcpServers,
                tools: anthropicMcpServers.map(s => ({ type: "mcp_toolset" as const, mcp_server_name: s.name })),
                betas: ["mcp-client-2025-11-20"],
              } as Parameters<typeof client.beta.messages.stream>[0]);
            } else {
              stream = client.messages.stream({
                model: "claude-sonnet-4-6",
                max_tokens: 1000,
                system: systemPrompt + SYSTEM_SUFFIX,
                messages,
              });
            }

            try {
              for await (const chunk of stream) {
                if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                  const text = chunk.delta.text;
                  fullText += text;
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

          // ── Increment order count for our-key users when an order is placed ─
          if (usingOurKey && fullText.includes("```order_status")) {
            try {
              let sess = null;
              try { sess = await auth(); } catch {}
              if (sess?.user?.email) {
                const { kv } = await import("@vercel/kv");
                await kv.incr(`trial:orders:${sess.user.email}`);
              }
            } catch {}
          }

          // ── Parse JSON blocks and emit done ──────────────────────────────
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
