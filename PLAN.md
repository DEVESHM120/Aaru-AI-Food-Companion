# Aaru — AI Food Companion: Living Plan

> **Last updated:** 2026-04-22
> This file is the single source of truth. Updated every time a feature is added, changed, or removed.

---

## Project Goal

A hackathon/portfolio demo of a conversational AI food companion ("Aaru") that:
- Talks back and forth like a human friend
- Helps users **decide** what to eat (not just filter)
- Searches Zomato & Swiggy for real restaurants
- Places actual orders via MCP integration
- Speaks responses aloud when user uses voice input

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + Framer Motion |
| AI | Claude claude-sonnet-4-6 via `@anthropic-ai/sdk` |
| MCP | Zomato MCP + Swiggy MCP (remote servers) |
| Voice Input | Web Speech API (browser-native, free) |
| Voice Output | ElevenLabs API (triggers only on voice input) |
| State | React `useState` (no external store) |

---

## Architecture

```
Browser (Next.js)
  ├── / (landing page)
  └── /chat (main demo)
      ├── ChatMessages — scrollable message thread
      ├── AIThinking — animated "Aaru is deciding..." indicator
      ├── VoiceInput — mic button with waveform
      ├── RestaurantCards — Zomato vs Swiggy side-by-side
      └── OrderConfirmation — confirm modal before placing order

API Routes
  ├── POST /api/chat  → Claude + MCP tools → JSON response
  └── POST /api/tts   → ElevenLabs → MP3 audio stream
```

---

## File Structure

```
g:\Zomato\
├── src/
│   ├── app/
│   │   ├── page.tsx                ← Landing (animated hero)
│   │   ├── chat/page.tsx           ← Main chat interface
│   │   ├── api/chat/route.ts       ← Claude + MCP API
│   │   ├── api/tts/route.ts        ← ElevenLabs TTS
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ChatMessages.tsx
│   │   ├── AIThinking.tsx
│   │   ├── VoiceInput.tsx
│   │   ├── RestaurantCards.tsx
│   │   └── OrderConfirmation.tsx
│   └── lib/
│       ├── types.ts                ← All TS types
│       ├── systemPrompt.ts         ← Aaru's AI persona
│       └── mockData.ts             ← Demo restaurant data
├── .env.local                      ← API keys (not committed)
├── PLAN.md                         ← This file
└── package.json
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `ELEVENLABS_API_KEY` | Optional | Voice output (TTS) |
| `ELEVENLABS_VOICE_ID` | Optional | Defaults to Rachel |
| `ZOMATO_MCP_AUTH_TOKEN` | Optional | Real Zomato orders |
| `SWIGGY_MCP_AUTH_TOKEN` | Optional | Real Swiggy orders |

If MCP tokens are missing → demo mode with mock restaurant data.

---

## Features Built

- [x] Next.js project scaffolded
- [x] Landing page with animated food emojis and CTA
- [x] Chat UI with message bubbles (user/AI)
- [x] Animated AI thinking indicator (Framer Motion)
- [x] Voice input (Web Speech API → STT)
- [x] Voice output (ElevenLabs TTS — triggers on voice input only)
- [x] Claude conversational AI with Aaru persona
- [x] Restaurant cards (Zomato vs Swiggy side-by-side)
- [x] Order confirmation modal
- [x] MCP integration (real Zomato/Swiggy when tokens present)
- [x] Demo/mock mode (works without MCP tokens)
- [x] Voice mode badge on user messages
- [x] Order placed success banner

---

## Upcoming / Backlog

- [ ] User profiles (Riya, self, friends) with saved preferences
- [ ] Order history view from past Zomato/Swiggy orders
- [ ] Mood detection from message tone
- [ ] Predictive ordering ("usual order?")
- [ ] Swiggy Instamart integration (quick commerce)
- [ ] Animated restaurant card image placeholders
- [ ] Dark mode toggle

---

## Design System

| Token | Value |
|---|---|
| Background | `#FAFAF9` (warm white) |
| Primary text | `#1C1917` (stone-900) |
| Muted text | `#78716C` (stone-500) |
| Accent | `#D97706` (amber-600) |
| AI bubble | `#F5F5F4` (stone-100) |
| User bubble | `#FEF3C7` (amber-100) |
| Zomato color | `#EF4444` (red-500) |
| Swiggy color | `#F97316` (orange-500) |
| Font | Geist Sans |

---

## Demo Script (Pitch Flow)

1. Open `localhost:3000` → landing page
2. Click "Start Talking with Aaru"
3. Tap mic → say "I want biryani"
4. Aaru responds (text + voice): asks a follow-up
5. User: "Spicy, under ₹400"
6. Aaru shows Zomato vs Swiggy restaurant cards
7. User clicks a card → order confirmation modal
8. User confirms → Aaru places order (or shows success in demo mode)

---

## Changelog

| Date | Change |
|---|---|
| 2026-04-22 | Initial build — all core features shipped |
