# Aaru AI Food Companion - Product and Engineering Documentation

## One-Line Pitch

Aaru is an AI food companion that helps users decide what to eat through natural conversation, remembers personal food preferences, recommends context-aware dishes, and prepares orders through food delivery integrations.

## Product Vision

Most food apps make users scroll through endless options. Aaru is designed to act like a food-aware friend: it asks follow-up questions, understands short corrections, remembers people and preferences, and makes confident recommendations based on intent, time, weather, diet, and mood.

The long-term goal is to move from "searching food" to "deciding food with a trusted companion."

## Current Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript |
| Styling and Motion | Tailwind CSS, Framer Motion |
| AI Provider | Groq |
| Memory and Persistence | Supabase |
| Auth | NextAuth with Google |
| Voice Input | Browser Web Speech API |
| Voice Output | ElevenLabs / browser fallback |
| Food Ordering Direction | Swiggy MCP, Zomato/Swiggy demo flows |
| Local Demo Mode | Deterministic fallback recommendation engine |

## Core User Experience

1. User opens the chat and asks naturally what they should eat.
2. Aaru identifies the intent: recommendation, follow-up, order, cart action, grocery, dineout, tracking, or small talk.
3. If the request is vague, Aaru asks one useful follow-up question instead of randomly showing dishes.
4. If the request has enough signal, Aaru recommends a primary dish and backup options.
5. The recommendation is validated against diet, profile, time, weather, explicit preferences, delivery speed, and dislikes.
6. The user can refine naturally with messages like "no south indian", "not spicy", "something else", or "show more options".
7. The user can add items to cart and continue chatting without the cart blocking the input.

## Features Added Step by Step

### 1. Groq-First AI Flow

Moved the app direction toward Groq as the main AI provider for active features.

What this enables:
- Faster conversational responses.
- Backend-owned AI key management.
- No user-facing Anthropic key setup.
- Cleaner path to later add Anthropic only from the backend if needed.

Status: Implemented as the active direction. Anthropic user setup should no longer be part of onboarding.

### 2. Supabase Memory Backend

Added Supabase as the server-backed persistence layer for profiles and memories.

What this enables:
- Preferences work across devices.
- Profile memory is not trapped in local browser storage.
- Server-side storage can support future login-based personalization.

Implemented pieces:
- Supabase project created.
- Memory/profile tables created through migration.
- Backend storage helpers added.
- Environment variables added for Supabase URL, service role key, and publishable key.

Relevant files:
- `src/lib/server/supabase.ts`
- `src/lib/server/memoryStore.ts`
- `supabase/migrations/20260501_aaru_memory.sql`
- `supabase/README.md`

### 3. People and Profile Preferences

The People/Profile button stores different food preferences and delivery addresses for different people.

Example use cases:
- Devesh: vegetarian, likes cheesy food.
- Divya: non-veg allowed but mostly eats veg, likes spicy food.

What this enables:
- Ordering for different people.
- Personalized recommendations.
- Separate memory and preference handling per person.
- Manual creation of people and addresses.
- Server sync of manually added profiles through Supabase-backed profile storage.
- Default address selection for area-aware recommendation and ordering flows.

Status: People panel supports saved people, preferences, likes, dislikes, notes, manual addresses, imported addresses, default address selection, and server sync for signed-in users.

Relevant file:
- `src/components/ProfileManager.tsx`

### 3.1 Address-Aware Recommendation Guard

Aaru now checks whether the target person has at least one saved delivery address before giving food recommendations.

Why this matters:
- Restaurant/menu availability depends on delivery location.
- Aaru should not confidently recommend food when it does not know the area.
- Ordering for another person requires that person's address, not the active user's address.

Behavior:
- If no address exists, Aaru asks the user to add an address in People first.
- If addresses exist, the active/default address is included in the profile context used by recommendations.
- Real availability still depends on Swiggy MCP access, but the product flow now collects the necessary address context before recommendation.

### 4. Intent Detection Layer

Added a deterministic intent layer before the LLM response.

Supported intents:
- Greeting
- Small talk
- Food recommendation
- Clarification / follow-up question
- Order now
- Order for someone
- Track order
- Grocery / Instamart
- Dineout

Why this matters:
- The app does not blindly depend on the LLM for routing.
- Short user messages can be handled predictably.
- Cart/order/grocery flows can be separated from casual chat.

Relevant file:
- `src/lib/conversationContext.ts`

### 5. Follow-Up Question Behavior

Added logic so vague food asks trigger one smart follow-up instead of random dishes.

Examples:
- "what should i eat" asks a clarifying question.
- "anything works" asks a clarifying question.
- "you pick for me" asks a clarifying question.
- "what should I have for breakfast?" can recommend directly because breakfast is a clear signal.

The follow-up can use:
- Meal time
- Weather
- Known diet
- Profile preferences

Example follow-ups:
- "Breakfast mood: light, filling, or chai-side snack?"
- "Rainy weather: comfort food or something light?"
- "It's hot out. Light meal, cold drink combo, or spicy?"

### 6. Time and Weather Context

Aaru now has meal context and weather context available in recommendation decisions.

Used signals:
- Breakfast, lunch, snack time, dinner, late night.
- Hot weather.
- Rainy weather.
- Delivery speed for late-night or quick requests.

Why this matters:
- The same user message should produce different recommendations at different times.
- "What should I eat?" in the morning should not feel like the same flow as late-night hunger.

### 7. Recommendation Validation

Added a validation layer after AI/demonstration recommendations.

Validation checks:
- User diet, especially vegetarian preference.
- Explicit words in the latest message.
- Profile likes and dislikes.
- Current meal time.
- Weather context.
- Delivery speed.
- Avoidance/refinement phrases.

Examples:
- If user says "veg only", non-veg dishes are filtered.
- If user says "no south indian", idli/dosa/sambar-style suggestions are filtered.
- If user asks for breakfast, breakfast-appropriate dishes are preferred.
- If user asks for spicy food, the recommended dish should carry a spicy signal.

Relevant file:
- `src/app/api/chat/route.ts`

### 8. Natural Language Refinements

Added support for short correction-style replies that users naturally send after a bad recommendation.

Supported examples:
- "no south indian"
- "not south indian"
- "avoid chinese"
- "dont want spicy"
- "something else"
- "not this"
- "try again"
- "skip dosa"
- "no oily food"

Why this matters:
- Users do not always write full sentences.
- The app should understand follow-up corrections like a human would.
- Refinements should continue the food decision flow, not fall back to small talk.

### 8.1 Dislike Memory and Recommendation Blocking

Added support for item-level dislike learning.

Supported examples:
- "I don't like idli"
- "don't recommend idli"
- "I hate dosa"
- "avoid Chinese"
- "please no sweets"

What happens:
- The dislike is saved into the active person's profile.
- A memory fact is stored, such as "Does not like Idli; avoid unless explicitly asked."
- The recommendation validator reads both profile dislikes and memory facts.
- Future recommendations filter those dishes unless the user explicitly asks for that item.

Example:
- User says: "I don't like idli"
- Aaru replies: "Got it. I won't recommend Idli unless you ask for it."
- Later, "what should I have for breakfast?" should avoid idli by default.

### 9. Better "More Options" Handling

Fixed repeated suggestions when the user asks for more options.

Supported examples:
- "show me more option"
- "show me more options"
- "more options please"
- "another option"

What changed:
- These route to recommendation intent.
- Aaru produces a new set instead of repeating the previous answer.

### 10. Cart UI Improvements

The cart originally blocked the chat input, preventing users from continuing the conversation after adding an item.

Improvement:
- Cart now appears as a compact floating bar above the input.
- It keeps checkout visible.
- It lets the user continue asking for more food.
- Items can be expanded only when needed.

Relevant file:
- `src/components/CartDrawer.tsx`

### 11. Cart Intent Understanding

Added support for natural cart commands.

Supported examples:
- "add poha to cart"
- "add expresso in cart"
- "add cappuccino to cart"
- "put espresso to cart"
- "cart add cold coffee"

Also added basic typo normalization:
- "expresso" becomes "espresso"
- "capachino" becomes "cappuccino"

### 12. Swiggy MCP Direction

The app is structured for Swiggy MCP ordering, but public access depends on Swiggy Builders/enterprise approval.

Current status:
- Demo ordering/cart flow exists.
- Swiggy auth routes exist.
- Real Swiggy MCP ordering needs valid MCP access and OAuth/client setup from Swiggy.

Important product note:
- Until Swiggy grants proper MCP access, friends/users cannot fully connect Swiggy for real ordering through the app.
- Demo mode remains useful for showcasing the product experience.

## Recruiter-Friendly Engineering Highlights

- Built a conversational food decision engine instead of a simple menu search UI.
- Designed a hybrid AI architecture: LLM for language, deterministic routing for product-critical flows.
- Added server-backed memory with Supabase for cross-device personalization.
- Implemented profile-aware recommendations for multiple people.
- Added validation guardrails so recommendations respect diet, dislikes, time, weather, and correction messages.
- Improved UX for ongoing chat while cart is active.
- Built the app toward real ordering via Swiggy MCP while maintaining a demo mode for product testing.

## Demo Script

Use this flow to demonstrate the app:

1. Ask: "what should i eat"
2. Aaru should ask a follow-up question instead of randomly recommending.
3. Reply: "breakfast and veg"
4. Aaru should recommend a breakfast-friendly vegetarian dish.
5. Reply: "no south indian"
6. Aaru should continue the recommendation flow and avoid South Indian dishes.
7. Reply: "show me more options"
8. Aaru should show a different set of options.
9. Reply: "add poha to cart"
10. Cart should appear without blocking the chat input.

## Current Known Limitations

- Real Swiggy ordering depends on Swiggy MCP approval and OAuth/client configuration.
- Recommendation quality still depends partly on Groq output, so validation is important.
- Profile preference UI should continue to evolve into a richer preference editor.
- The README still needs a separate cleanup pass to match the current Groq + Supabase direction.

## Next Feature Ideas

- Add visible "why this recommendation" chips on dish cards.
- Store rejected categories like "no south indian" into memory after user confirms.
- Add recommendation history so "more options" avoids recently shown dishes.
- Add recruiter/demo mode with seeded profiles and sample conversations.
- Add real integration tests for intent routing and recommendation validation.
