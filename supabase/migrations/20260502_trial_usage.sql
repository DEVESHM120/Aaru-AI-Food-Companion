create table if not exists public.aaru_trial_usage (
  user_email text primary key,
  messages_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.increment_trial_usage(p_email text)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  insert into public.aaru_trial_usage (user_email, messages_used, updated_at)
  values (p_email, 1, now())
  on conflict (user_email) do update
    set messages_used = aaru_trial_usage.messages_used + 1,
        updated_at = now()
  returning messages_used into new_count;
  return new_count;
end;
$$;
