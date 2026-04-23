# 🍽️ Aaru — AI Food Companion

> A conversational AI that helps you **decide** what to eat — and orders it for you via Zomato & Swiggy.

Built by **Devesh Mishra** · AI + Design + Product

---

## What is Aaru?

Most food apps show you choices. Aaru **helps you decide**.

- Talks back and forth like a friend
- Asks follow-up questions based on your mood, time, and past orders
- Searches Zomato & Swiggy simultaneously
- Speaks responses aloud when you use voice input
- Places real orders via MCP integration

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + Framer Motion |
| AI | Claude claude-sonnet-4-6 (Anthropic) |
| Ordering | Zomato MCP + Swiggy MCP |
| Voice Input | Web Speech API (browser-native) |
| Voice Output | ElevenLabs TTS |

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/aaru-food-companion.git
cd aaru-food-companion
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional — for voice responses
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Optional — for real Zomato/Swiggy ordering
ZOMATO_MCP_AUTH_TOKEN=...
SWIGGY_MCP_AUTH_TOKEN=...
```

> Without MCP tokens, the app runs in **demo mode** with realistic mock restaurant data.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How to get MCP tokens

### Zomato
Follow the guide at [agnost.ai/blog/zomato-mcp-server-order-food-claude-desktop](https://agnost.ai/blog/zomato-mcp-server-order-food-claude-desktop)

### Swiggy
1. Open Claude Desktop → Settings → Connectors → Add custom connector
2. Add: `https://mcp.swiggy.com/food`
3. Log in with your Swiggy phone number + OTP
4. Copy your token from `~/.swiggy_tokens.json`

---

## Demo Flow

```
You (voice): "I want biryani"

Aaru: "Spicy or mild? And are we talking Hyderabadi or Lucknowi?"

You: "Hyderabadi, spicy"

Aaru: Shows Zomato vs Swiggy restaurant cards with price, ETA, rating

You: Click a card → Confirm → Order placed 🎉
```

---

## Features

- **Conversational decision engine** — Aaru asks, refines, and guides
- **Voice-first** — Speak your craving, hear the response (ElevenLabs)
- **Dual platform** — Zomato & Swiggy side-by-side comparison
- **Context-aware** — Time of day, mood cues, past order references
- **Order confirmation** — Never places an order without your approval
- **Demo mode** — Works without any MCP tokens

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── chat/page.tsx         # Main chat interface
│   └── api/
│       ├── chat/route.ts     # Claude + MCP API
│       └── tts/route.ts      # ElevenLabs TTS
├── components/
│   ├── ChatMessages.tsx
│   ├── AIThinking.tsx        # Animated thinking indicator
│   ├── VoiceInput.tsx        # Mic button + waveform
│   ├── RestaurantCards.tsx   # Zomato vs Swiggy cards
│   └── OrderConfirmation.tsx # Order confirm modal
└── lib/
    ├── types.ts
    ├── systemPrompt.ts       # Aaru's AI persona
    └── mockData.ts           # Demo restaurant data
```

---

## Architecture

```
Voice/Text Input
      ↓
Claude claude-sonnet-4-6 (conversational reasoning)
      ↓
Zomato MCP / Swiggy MCP (restaurant search + ordering)
      ↓
ElevenLabs TTS (if voice input)
      ↓
UI Response (text + restaurant cards + order modal)
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `ELEVENLABS_API_KEY` | No | Voice output (TTS) |
| `ELEVENLABS_VOICE_ID` | No | Defaults to Rachel voice |
| `ZOMATO_MCP_AUTH_TOKEN` | No | Real Zomato ordering |
| `SWIGGY_MCP_AUTH_TOKEN` | No | Real Swiggy ordering |

---

*Built with Claude + MCP · Devesh Mishra*
