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
