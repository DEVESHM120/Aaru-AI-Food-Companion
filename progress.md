# Aaru — Progress Tracker

> Auto-updated every session. Last updated: 2026-04-23

---

## 🔴 WHY THE APP IS NOT WORKING RIGHT NOW

### Root Cause: API Keys Are Placeholders

The app is running at `http://localhost:3001` but **chat does NOT work** because `.env.local` still has dummy values.

| Variable | Current Value | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-REPLACE_ME` | ❌ FAKE — chat completely broken |
| `ELEVENLABS_API_KEY` | `REPLACE_ME` | ❌ FAKE — voice output broken |
| `ELEVENLABS_VOICE_ID` | `21m00Tcm4TlvDq8ikWAM` | ✅ Valid (Rachel) |
| `ZOMATO_MCP_AUTH_TOKEN` | *(empty)* | ⚠️ Empty — demo mode (mock data) |
| `SWIGGY_MCP_AUTH_TOKEN` | *(empty)* | ⚠️ Empty — demo mode (mock data) |

### Fix Required (do this first):

**Step 1** — Get your Anthropic API key:
- Go to https://console.anthropic.com
- Create API key → copy it
- Paste into `.env.local`: `ANTHROPIC_API_KEY=sk-ant-xxxxx`

**Step 2** — Get your ElevenLabs API key (for voice):
- Go to https://elevenlabs.io → Profile → API Keys
- Copy key → paste into `.env.local`

**Step 3** — Restart the dev server after editing `.env.local`:
```bash
# Stop current server (Ctrl+C), then:
npm run dev -- --port 3001
```

---

## ✅ What Is Done (Fully Built)

### Infrastructure
- [x] Next.js 16 project scaffolded and building without errors
- [x] TypeScript configured — zero type errors
- [x] Tailwind CSS v4 + Framer Motion installed
- [x] Git initialized, first commit made (24 files)
- [x] `.env.example` committed (safe, no secrets)
- [x] `.env.local` gitignored (secrets safe)

### Pages & UI
- [x] **Landing page** (`/`) — animated floating food emojis, hero section, "Start Talking" CTA
- [x] **Chat page** (`/chat`) — full conversational interface
- [x] **ChatMessages** component — scrollable message thread, user/AI bubbles
- [x] **AIThinking** component — "Aaru is deciding..." with animated dots + rotating emoji
- [x] **VoiceInput** component — mic button, waveform animation, Web Speech API STT
- [x] **RestaurantCards** component — side-by-side Zomato (red) vs Swiggy (orange) cards
- [x] **OrderConfirmation** modal — confirm before placing any order

### Backend / API
- [x] `/api/chat` — Claude API route with MCP support + demo mode fallback
- [x] `/api/tts` — ElevenLabs TTS route (voice-in → voice-out logic)

### AI
- [x] **Aaru persona** defined in system prompt
- [x] Conversational decision logic (ask → refine → recommend → confirm)
- [x] Restaurant JSON block parsing from Claude responses
- [x] Order JSON block parsing from Claude responses
- [x] Zomato + Swiggy MCP integration (activates when tokens are present)
- [x] Demo mode with mock restaurant data (no tokens needed)

### Design
- [x] Light theme — warm white `#FAFAF9`, amber accent `#D97706`
- [x] Claude-inspired clean typography (Geist font)
- [x] Zomato red / Swiggy orange platform color coding
- [x] Voice mode badge on user messages
- [x] Order placed success banner

### Docs
- [x] `README.md` — full setup guide, architecture, demo flow
- [x] `PLAN.md` — living architecture document
- [x] `progress.md` — this file

---

## ⚠️ What Is Partially Working

| Feature | Status | Blocker |
|---|---|---|
| Chat AI | ❌ Failing | `ANTHROPIC_API_KEY` is placeholder |
| Voice output (TTS) | ❌ Failing | `ELEVENLABS_API_KEY` is placeholder |
| Voice input (STT) | ✅ Works | Browser Web Speech API — no key needed |
| Restaurant cards | ⚠️ Never shown | Needs working chat first |
| Order confirmation | ⚠️ Never triggered | Needs working chat first |
| Real Zomato orders | ⚠️ Demo mode | MCP token not set |
| Real Swiggy orders | ⚠️ Demo mode | MCP token not set |
| GitHub push | ⚠️ Pending | User needs to create GitHub repo and push |

---

## 📋 What Is Left To Do

### Immediate (app won't work until these are done)
- [ ] **Add real `ANTHROPIC_API_KEY`** to `.env.local`
- [ ] **Add real `ELEVENLABS_API_KEY`** to `.env.local`
- [ ] **Restart dev server** after editing `.env.local`

### Short-term (makes demo complete)
- [ ] **Push to GitHub** — create repo + `git push`
- [ ] **Get Swiggy MCP token** — Claude Desktop OAuth flow → `~/.swiggy_tokens.json`
- [ ] **Get Zomato MCP token** — follow Agnost guide
- [ ] **Test full demo flow** — voice in → Aaru thinks → restaurant cards → order confirm

### Nice-to-have (next features)
- [ ] User profiles (save Riya, self, friends with preferences)
- [ ] Order history view from Zomato/Swiggy past orders
- [ ] Swiggy Instamart integration (quick commerce)
- [ ] Dark mode toggle
- [ ] Deploy to Vercel

---

## 🧪 How To Test If It's Working

After adding your API keys and restarting:

```bash
# 1. Test chat API directly
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"I want biryani"}],"inputMode":"text"}'

# Expected: JSON with "message" field (Aaru's response) and possibly "restaurants" array
# If you get {"error":"Failed to get response"} → API key is wrong/missing
```

---

## 📅 Changelog

| Date | What Changed |
|---|---|
| 2026-04-22 | Project scaffolded, all core features built, first git commit |
| 2026-04-23 | `progress.md` created, root cause of broken app identified |
