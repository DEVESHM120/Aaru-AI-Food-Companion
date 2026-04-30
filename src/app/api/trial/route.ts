import { auth } from "@/auth";

export const TRIAL_ORDER_LIMIT = 5;

function orderKey(email: string) {
  return `trial:orders:${email}`;
}

export async function GET() {
  let session = null;
  try { session = await auth(); } catch {}
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ ordersUsed: 0, limit: TRIAL_ORDER_LIMIT, exhausted: false });
  }
  try {
    const { kv } = await import("@vercel/kv");
    const count = (await kv.get<number>(orderKey(email))) ?? 0;
    return Response.json({ ordersUsed: count, limit: TRIAL_ORDER_LIMIT, exhausted: count >= TRIAL_ORDER_LIMIT });
  } catch {
    return Response.json({ ordersUsed: 0, limit: TRIAL_ORDER_LIMIT, exhausted: false });
  }
}

export async function POST() {
  let session = null;
  try { session = await auth(); } catch {}
  const email = session?.user?.email;
  if (!email) return Response.json({ ok: false, ordersUsed: 0 });

  try {
    const { kv } = await import("@vercel/kv");
    const count = await kv.incr(orderKey(email));
    return Response.json({ ok: true, ordersUsed: count });
  } catch {
    return Response.json({ ok: false, ordersUsed: 0 });
  }
}
