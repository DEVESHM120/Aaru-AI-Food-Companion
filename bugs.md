# Aaru Bug Report

## BUG-001 — CRITICAL: ProfileManager dropdown never shows auto-seeded profile

**File:** `src/app/chat/page.tsx` (lines 107–155) + `src/components/ProfileManager.tsx` (lines 47–51)

**Symptom:** After first load, Zomato MCP auto-seeds a profile and saves it to localStorage. But the ProfileManager dropdown still shows "No profiles yet." User can't select the auto-seeded profile from the dropdown.

**Root cause:** ProfileManager manages its OWN local `allProfiles` state (line 38) independently from the parent. It reads localStorage once on mount (line 47–51) via a `useEffect` with empty deps. At mount time, seeding hasn't completed yet, so localStorage is empty, so ProfileManager stores `[]` locally. When seeding completes and the parent calls `setAllProfiles([profile])`, ProfileManager's local state is never updated — there is no prop flowing profile data back DOWN from parent to ProfileManager.

**Impact:** User sees "Add Person" instead of their profile. Auto-seeded profile is invisible in the UI (though it exists in localStorage and parent state).

---

## BUG-002 — CRITICAL: "No address for Divya" — addresses not linked in profile

**File:** `src/lib/systemPrompt.ts` (lines 129–139) + `src/components/ProfileManager.tsx` (lines 262–309)

**Symptom:** Aaru says "I have no address for Divya" even after creating a profile for Divya.

**Root cause:** When a profile is created via "Add person +" in ProfileManager, addresses must be manually linked by toggling checkboxes in the edit sheet (Delivery Addresses section). If the user just fills in the name and saves without ticking any address — or if `availableAddresses` is empty because MCP is not configured — the profile is saved with `addresses: []`. 

`buildKnownPeopleBlock` then renders:
```
- Divya: veg, mid, addresses: [no address]
```
Claude correctly reads this and tells the user Divya has no saved address.

**Secondary cause:** The Delivery Addresses section shows "No Zomato addresses found. Connect Zomato MCP to load." when `ZOMATO_MCP_AUTH_TOKEN` is not set, giving the user no way to link an address at all.

**Impact:** Core ordering-for-others flow is completely broken without MCP token.

---

## BUG-003 — CRITICAL: Voice mode off doesn't stop recognition (stale closure restart loop)

**File:** `src/components/VoiceInput.tsx` (lines 118–132, 170)

**Symptom:** After toggling voice mode off, recognition continues running in the background for an indefinite period. Spoken words can be submitted as messages even when voice mode appears off.

**Root cause:** `startRecognition` captures `isVoiceMode` and `isSpeaking` from its closure at creation time (they're in the dep array). When voice mode is toggled off:
1. New `startRecognition` (with `isVoiceMode=false`) is created → useEffect fires → `stopRecognition()` is called → `abort()` triggers `onend` asynchronously
2. `onend` handler still holds the OLD `startRecognition` closure (where `isVoiceMode=true`)
3. OLD `onend` checks `if (isVoiceMode && !isSpeaking)` → TRUE (stale value) → calls `setTimeout(() => startRecognition(), 200)`
4. 200ms later: old `startRecognition` (with `isVoiceMode=true`) runs → starts recognition again
5. New recognition's `onend` has the same old closure → loop restarts perpetually

No new useEffect is triggered after step 4 (deps didn't change again), so nothing kills the restarted recognition.

**Impact:** Recognition keeps running after voice mode off; accidental mic submissions possible.

---

## BUG-004 — HIGH: `preloadedAddresses` optimization is always bypassed

**File:** `src/components/ProfileManager.tsx` (lines 53–61)

**Symptom:** `/api/addresses` is always called twice on page load — once from `chat/page.tsx` and again from ProfileManager — even though the parent passes `preloadedAddresses` as a prop to avoid the double fetch.

**Root cause:** The guard in ProfileManager's effect is:
```typescript
useEffect(() => {
  if (preloadedAddresses && preloadedAddresses.length > 0) return;
  fetch("/api/addresses")...
}, []); // ← empty deps, runs only on mount
```
At mount time, `preloadedAddresses` prop is always `[]` (parent's initial state — the async fetch hasn't resolved yet). So `preloadedAddresses.length > 0` is always `false` at mount, and ProfileManager always fetches independently. By the time the parent resolves and sets `preloadedAddresses`, the effect has already run and will never run again.

**Impact:** Double MCP call on load; wasted latency; pointless prop.

---

## BUG-005 — HIGH: `allProfiles` includes active user in "Known People" block

**File:** `src/lib/systemPrompt.ts` (lines 21, 129–139)

**Symptom:** When `activeProfile` is "Devesh" and `allProfiles` is `[Devesh, Divya]`, the system prompt shows Devesh in BOTH the "Active user" section AND the "Known People" section. Claude has two conflicting entries for the same person.

**Root cause:** `buildSystemPrompt` calls `buildKnownPeopleBlock(allProfiles ?? [])` without filtering out the active user. All profiles including the active one are passed in.

**Impact:** Claude may get confused between the active user context and their Known People entry. In voice ordering scenarios it could misroute order intent.

---

## BUG-006 — HIGH: `onProfileChange` + `onAllProfilesChange` both update parent's `allProfiles` redundantly

**File:** `src/app/chat/page.tsx` (lines 387–392) + `src/components/ProfileManager.tsx` (lines 100–107)

**Symptom:** When a profile is saved in ProfileManager, the parent's `setAllProfiles` is called twice — once via `onAllProfilesChange(updated)` (line 104 in ProfileManager) and again via `setAllProfiles(getAllProfiles())` inside `onProfileChange` (line 389 in page.tsx). Both produce the same result but it's wasteful and fragile.

**Root cause:** Two separate callbacks exist for what should be one sync: `onAllProfilesChange` (the intended channel) and a manual `setAllProfiles(getAllProfiles())` inside `onProfileChange` handler.

**Impact:** Low (no incorrect behavior today), but creates a maintenance trap — any future divergence between the two paths could cause subtle state bugs.

---

## BUG-007 — MEDIUM: MCP response parsing in `/api/addresses` is regex-fragile

**File:** `src/app/api/addresses/route.ts` (lines 37–43)

**Symptom:** If the Zomato MCP returns addresses in a different JSON structure (e.g., wrapped differently, or with a top-level array instead of `{"addresses": [...]}`), the parsing silently fails and returns `[]`.

**Root cause:**
```typescript
const jsonMatch = text.match(/\{[\s\S]*\}/);  // only matches objects, not arrays
const parsed = JSON.parse(jsonMatch[0]);
const addresses = parsed.addresses ?? [];      // assumes field named "addresses"
```
If the MCP response is a JSON array `[...]` at the top level, or uses a different key, `addresses` will always be `[]`.

**Impact:** Silently zero addresses; no error surfaced; profile auto-seeding silently skipped.

---

## BUG-008 — MEDIUM: Order confirmation always sends as text mode even in voice mode

**File:** `src/app/chat/page.tsx` (line 343)

**Symptom:** When the user confirms an order in voice mode via tapping "Confirm" in the OrderConfirmation modal, the confirmation message is sent as `"text"` mode. Aaru responds in text but doesn't speak the confirmation.

**Root cause:**
```typescript
await sendMessage(
  `Yes, confirm the order from ${pendingOrder.restaurant.name}...`,
  "text"   // ← hardcoded, ignores current mode
);
```
The current `inputMode` (voice/text) is not passed to this call.

**Impact:** In voice mode, user sees silent text response for order confirmations. Breaks the voice-first experience.

---

## BUG-009 — MEDIUM: `setVoiceState` at response end uses stale `isVoiceMode` from closure

**File:** `src/app/chat/page.tsx` (line 297, 299)

**Symptom:** If the user toggles voice mode on/off while a response is streaming, `setVoiceState` at the end sets the wrong state.

**Root cause:** `sendMessage` is a `useCallback` with `[messages, voiceState, isVoiceMode, ...]` deps. `isVoiceMode` captured at the time of the call. If voice mode is toggled mid-stream, the closure still has the old `isVoiceMode` value, so `setVoiceState(isVoiceMode ? "listening" : "idle")` uses the wrong branch.

**Impact:** Minor — voice/idle indicator can briefly show the wrong state after toggling during a response.

---

## BUG-010 — LOW: `setIsTTSSpeaking(false)` never called when streaming TTS fires but done block skips

**File:** `src/app/chat/page.tsx` (lines 266–272, 284–300)

**Symptom:** If a first-sentence TTS is started during streaming (line 271: `streamTTSPromise = playTTS(...)`), but then the `done` event path does NOT enter the voice+shouldSpeak block (e.g., `event.shouldSpeak` is false), `setIsTTSSpeaking(false)` is never called. TTS speaking state is stuck as `true`.

**Root cause:**
```typescript
// line 270: setIsTTSSpeaking(true) — streaming TTS started
// ...
if (mode === "voice" && event.shouldSpeak && event.cleanText) {
  // setIsTTSSpeaking(false) is here ← only reached if shouldSpeak=true
} else {
  setVoiceState(...); // ← setIsTTSSpeaking(false) NOT called here
}
```
If `shouldSpeak` is false but `streamTTSStarted` is true, the audio plays but `isTTSSpeaking` is never reset.

**Impact:** Voice input permanently disabled (recognition never restarts because `isSpeaking=true`).

---

---

## BUG-011 — CRITICAL: Aaru hears its own TTS voice and submits it as user input

**File:** `src/components/VoiceInput.tsx` (lines 172–181) + `src/app/chat/page.tsx` (lines 284–297)

**Symptom:** While Aaru is speaking a response via TTS, the microphone is still active (or restarts immediately after TTS ends), picks up the spoken audio, transcribes it, and submits it as a new user message — creating an infinite echo loop.

**Root cause:** Two compounding issues:

1. **Restart delay is too short.** After TTS ends, `isSpeaking` flips to `false` → useEffect restarts recognition with a 200ms delay. Audio from speakers may still be reverberating at that point, especially on laptop speakers or in a small room.

2. **`isSpeaking` state lag.** `setIsTTSSpeaking(false)` is called AFTER `await playTTS(...)` resolves (line 296), but the audio element's `onended` event fires when playback finishes — not when the acoustic sound has actually faded from the room. So recognition restarts before the last syllables of TTS audio have decayed.

3. **No acoustic echo cancellation (AEC) enforcement.** The Web Speech API uses the default audio input device. On devices without hardware AEC (or when using external speakers), the mic picks up the speaker output directly.

**What would fix it:**
- Extend restart delay from 200ms → 800–1200ms after TTS ends
- Use `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })` and route recognition through that constrained stream (Web Speech API doesn't support custom streams directly, so a workaround is needed)
- Or: gate recognition restart on a short "cooldown" ref that is set when TTS starts and cleared 1s after it ends

**Impact:** Critical — causes runaway message loop in voice mode. Every Aaru response triggers another message, infinite recursion.

---

## Summary Table

| ID | Severity | File | Status | Fix |
|----|----------|------|--------|-----|
| BUG-001 | CRITICAL | `chat/page.tsx` + `ProfileManager.tsx` | ✅ Fixed | Added `profiles` prop to ProfileManager; parent owns state |
| BUG-002 | CRITICAL | `systemPrompt.ts` + `ProfileManager.tsx` | ✅ Fixed | Address sync now reactive to `preloadedAddresses` prop |
| BUG-003 | CRITICAL | `VoiceInput.tsx` | ✅ Fixed | `isVoiceMode`/`isSpeaking` moved to refs; removed from closure |
| BUG-004 | HIGH | `ProfileManager.tsx` | ✅ Fixed | Syncs from prop via `useEffect([preloadedAddresses])`; 800ms fallback fetch |
| BUG-005 | HIGH | `systemPrompt.ts` | ✅ Fixed | Active user filtered from `allProfiles` before passing to `buildKnownPeopleBlock` |
| BUG-006 | HIGH | `chat/page.tsx` + `ProfileManager.tsx` | ✅ Fixed | `onProfileChange` → `setActiveProfile` only; `onAllProfilesChange` handles allProfiles |
| BUG-007 | MEDIUM | `api/addresses/route.ts` | ✅ Fixed | Tries array format first, then object `.addresses`/`.data` fallback |
| BUG-008 | MEDIUM | `chat/page.tsx` | ✅ Fixed | `handleConfirmOrder` uses `isVoiceModeRef.current` |
| BUG-009 | MEDIUM | `chat/page.tsx` | ✅ Fixed | `setVoiceState` uses `isVoiceModeRef.current` instead of stale closure |
| BUG-010 | LOW | `chat/page.tsx` | ✅ Fixed | `setIsTTSSpeaking(false)` always called after response, not just in voice branch |
| BUG-011 | CRITICAL | `VoiceInput.tsx` | ✅ Fixed | `ttsCooldownRef` blocks recognition during TTS + 1.2s echo decay window |
