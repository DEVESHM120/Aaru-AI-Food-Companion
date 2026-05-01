# Supabase Setup

Use Supabase as the server memory store for profiles and learned food preferences.

## 1) Create a Supabase project

Create a new project in Supabase and copy:
- `Project URL` -> `SUPABASE_URL`
- `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY`

## 2) Set environment variables

Add to `.env.local`:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

## 3) Apply migration

Run this SQL in Supabase SQL editor:
- [`supabase/migrations/20260501_aaru_memory.sql`](G:/Zomato/supabase/migrations/20260501_aaru_memory.sql)

This creates:
- `aaru_user_profiles`
- `aaru_profile_memories`

and applies RLS policies.

## 4) Verify in app

1. Sign in with Google in Aaru.
2. Update people/preferences.
3. Check that data appears in Supabase tables.
4. Open Aaru on another device with the same login and verify data sync.

## Notes

- If Supabase env vars are missing, the app falls back to Vercel KV.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it to the client.

