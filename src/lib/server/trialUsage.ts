import { getSupabaseAdmin } from "./supabase";

export const TRIAL_MESSAGE_LIMIT = 25;

export async function getTrialUsage(email: string): Promise<{ used: number; exhausted: boolean }> {
  const db = getSupabaseAdmin();
  if (!db) return { used: 0, exhausted: false };

  const { data } = await db
    .from("aaru_trial_usage")
    .select("messages_used")
    .eq("user_email", email)
    .single();

  const used = data?.messages_used ?? 0;
  return { used, exhausted: used >= TRIAL_MESSAGE_LIMIT };
}

export async function incrementTrialUsage(email: string): Promise<number> {
  const db = getSupabaseAdmin();
  if (!db) return 0;

  const { data } = await db.rpc("increment_trial_usage", { p_email: email });
  return (data as number) ?? 0;
}
