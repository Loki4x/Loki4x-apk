import { supabase } from "@/lib/supabase";

// Kotak notifikasi: tabel notifications yang sama dengan lonceng di web (RLS: milik sendiri).

export interface InboxItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export async function fetchInbox(userId: string, limit = 50): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as InboxItem[];
}

export async function unreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}

export async function markRead(userId: string, id: string) {
  await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", userId);
}

export async function markAllRead(userId: string) {
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
}

// ---------- Notifikasi sinyal → detail sinyal ----------

/**
 * Notifikasi sinyal baru di lonceng tidak menyimpan id sinyal, jadi dicocokkan dari isinya:
 * judul "🔔 Sinyal baru: XAUUSD BUY" / "🔔 New signal: XAUUSD BUY" dan isi "Entry 3747.3 · ...".
 */
export function parseSignalNotification(n: Pick<InboxItem, "title" | "message">): { symbol: string; side: "BUY" | "SELL"; entry: number } | null {
  const head = /(?:Sinyal baru|New signal):\s*([A-Z0-9.]+)\s+(BUY|SELL)/i.exec(n.title);
  const entry = /Entry\s+(-?[\d.]+)/i.exec(n.message);
  if (!head || !entry) return null;
  const value = Number(entry[1]);
  if (!Number.isFinite(value)) return null;
  return { symbol: head[1].toUpperCase(), side: head[2].toUpperCase() as "BUY" | "SELL", entry: value };
}

/** Cari id sinyal yang paling cocok (symbol, arah, harga entry, waktu paling dekat dengan notifikasi). */
export async function findSignalForNotification(n: InboxItem): Promise<string | null> {
  const p = parseSignalNotification(n);
  if (!p) return null;
  const { data } = await supabase
    .from("signals")
    .select("id, entry_price, posted_at")
    .eq("symbol", p.symbol)
    .eq("side", p.side)
    .gte("entry_price", p.entry - 1e-6)
    .lte("entry_price", p.entry + 1e-6)
    .limit(20);
  if (!data || data.length === 0) return null;
  const at = new Date(n.created_at).getTime();
  const best = [...data].sort(
    (a, b) => Math.abs(new Date(a.posted_at).getTime() - at) - Math.abs(new Date(b.posted_at).getTime() - at)
  )[0];
  return String(best.id);
}
