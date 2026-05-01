create table if not exists public.aaru_user_profiles (
  user_email text primary key,
  profiles jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.aaru_profile_memories (
  id bigserial primary key,
  user_email text not null,
  profile_name text not null,
  fact text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_aaru_profile_memories_lookup
  on public.aaru_profile_memories (user_email, profile_name, created_at desc);

alter table public.aaru_user_profiles enable row level security;
alter table public.aaru_profile_memories enable row level security;

drop policy if exists "read_own_profiles" on public.aaru_user_profiles;
create policy "read_own_profiles"
  on public.aaru_user_profiles
  for select
  to authenticated
  using (auth.jwt()->>'email' = user_email);

drop policy if exists "write_own_profiles" on public.aaru_user_profiles;
create policy "write_own_profiles"
  on public.aaru_user_profiles
  for all
  to authenticated
  using (auth.jwt()->>'email' = user_email)
  with check (auth.jwt()->>'email' = user_email);

drop policy if exists "read_own_memories" on public.aaru_profile_memories;
create policy "read_own_memories"
  on public.aaru_profile_memories
  for select
  to authenticated
  using (auth.jwt()->>'email' = user_email);

drop policy if exists "write_own_memories" on public.aaru_profile_memories;
create policy "write_own_memories"
  on public.aaru_profile_memories
  for all
  to authenticated
  using (auth.jwt()->>'email' = user_email)
  with check (auth.jwt()->>'email' = user_email);

