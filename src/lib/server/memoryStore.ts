import { PersonProfile } from "@/lib/profiles/types";
import { getSupabaseAdmin } from "./supabase";

type MaybeKv = {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown) => Promise<unknown>;
  lpush: (key: string, value: string) => Promise<unknown>;
  ltrim: (key: string, start: number, stop: number) => Promise<unknown>;
  lrange: (key: string, start: number, stop: number) => Promise<unknown[]>;
};

async function getKv(): Promise<MaybeKv | null> {
  try {
    const { kv } = await import("@vercel/kv");
    return kv as unknown as MaybeKv;
  } catch {
    return null;
  }
}

function normalizeProfileName(profileName: string) {
  return profileName.trim().toLowerCase();
}

export async function getProfilesForUser(email: string): Promise<PersonProfile[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("aaru_user_profiles")
      .select("profiles")
      .eq("user_email", email)
      .maybeSingle();
    if (!error && data?.profiles && Array.isArray(data.profiles)) {
      return data.profiles as PersonProfile[];
    }
  }

  const kv = await getKv();
  if (!kv) return [];
  const data = await kv.get<{ profiles: PersonProfile[] }>(`profiles:${email}`);
  return data?.profiles ?? [];
}

export async function saveProfilesForUser(email: string, profiles: PersonProfile[]) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase
      .from("aaru_user_profiles")
      .upsert(
        {
          user_email: email,
          profiles,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_email" }
      );
    if (!error) return true;
  }

  const kv = await getKv();
  if (!kv) return false;
  await kv.set(`profiles:${email}`, { profiles, updatedAt: Date.now() });
  return true;
}

export async function getMemoriesForProfile(email: string, profileName: string): Promise<string[]> {
  const normalized = normalizeProfileName(profileName);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("aaru_profile_memories")
      .select("fact")
      .eq("user_email", email)
      .eq("profile_name", normalized)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error && data) {
      return data.map((row) => row.fact).filter((v): v is string => typeof v === "string");
    }
  }

  const kv = await getKv();
  if (!kv) return [];
  const memories = await kv.lrange(`mem:${email}:${profileName}`, 0, 29);
  return memories.filter((v): v is string => typeof v === "string");
}

export async function appendMemoryForProfile(email: string, profileName: string, fact: string) {
  const normalized = normalizeProfileName(profileName);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase
      .from("aaru_profile_memories")
      .insert({
        user_email: email,
        profile_name: normalized,
        fact,
      });
    if (!error) {
      const { data: rows } = await supabase
        .from("aaru_profile_memories")
        .select("id")
        .eq("user_email", email)
        .eq("profile_name", normalized)
        .order("created_at", { ascending: false });
      if (rows && rows.length > 30) {
        const staleIds = rows.slice(30).map((r) => r.id);
        if (staleIds.length > 0) {
          await supabase.from("aaru_profile_memories").delete().in("id", staleIds);
        }
      }
      return true;
    }
  }

  const kv = await getKv();
  if (!kv) return false;
  await kv.lpush(`mem:${email}:${profileName}`, fact);
  await kv.ltrim(`mem:${email}:${profileName}`, 0, 29);
  return true;
}
