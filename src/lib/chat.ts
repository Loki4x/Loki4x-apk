import { supabase } from "@/lib/supabase";
import { apiGet, apiRequest, apiUpload } from "@/lib/api";
import type { Tier } from "@/lib/auth";

// Chat Komunitas & chat ke admin. Pesan dibaca langsung dari Supabase (RLS + realtime),
// pengiriman lewat API web supaya tier, rate limit, foto (R2 privat), dan notifikasi sama dengan web.

export type Room = "ANNOUNCEMENT" | "FREE" | "VIP" | "MEMBERSHIP";
export const ROOMS: Room[] = ["ANNOUNCEMENT", "FREE", "VIP", "MEMBERSHIP"];
export const ROOM_LABEL: Record<Room, string> = { ANNOUNCEMENT: "Pengumuman", FREE: "General", VIP: "VIP", MEMBERSHIP: "Membership" };
const ROOM_RANK: Record<Room, number> = { ANNOUNCEMENT: 0, FREE: 0, VIP: 1, MEMBERSHIP: 2 };
const TIER_RANK: Record<Tier, number> = { FREE: 0, VIP: 1, MEMBERSHIP: 2 };

export const canAccessRoom = (tier: Tier, room: Room) => TIER_RANK[tier] >= ROOM_RANK[room];
export const canWriteRoom = (tier: Tier, room: Room, isAdmin: boolean) => (room === "ANNOUNCEMENT" ? isAdmin : canAccessRoom(tier, room));

export const COMMUNITY_MAX_LEN = 500;
export const CHAT_MAX_LEN = 1000;
const COMMUNITY_COLUMNS =
  "id, room, user_id, author_name, author_tier, is_admin, body, image_key, pinned_at, reply_to, reply_name, reply_excerpt, created_at";
const CHAT_COLUMNS = "id, thread_id, sender_role, body, image_key, created_at";

export interface CommunityMessage {
  id: string;
  room: Room;
  user_id: string;
  author_name: string;
  author_tier: string;
  is_admin: boolean;
  body: string;
  image_key: string | null;
  pinned_at: string | null;
  reply_to: string | null;
  reply_name: string | null;
  reply_excerpt: string | null;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  thread_id: string;
  sender_role: "USER" | "ADMIN";
  body: string;
  image_key: string | null;
  created_at: string;
}

const ERRORS: Record<string, string> = {
  auth: "Sesi login habis. Silakan login ulang.",
  empty: "Tulis pesan atau pilih foto dulu.",
  too_long: "Pesan terlalu panjang.",
  rate_limited: "Terlalu cepat. Tunggu sebentar lalu kirim lagi.",
  suspended: "Akun kamu sedang dinonaktifkan.",
  forbidden: "Kamu tidak bisa menulis di ruang ini.",
  bad_image: "Foto tidak valid. Pakai JPG, PNG, atau WebP.",
  image_too_big: "Ukuran foto maksimal 2 MB.",
  failed: "Pesan gagal terkirim. Coba lagi.",
};
export const chatError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (/network|fetch/i.test(msg)) return "Tidak bisa terhubung. Cek koneksi internet kamu.";
  return ERRORS[msg] ?? msg;
};

const photo = (uri: string) => ({ uri, name: "foto.jpg", type: "image/jpeg" }) as unknown as Blob;

// ---------- Komunitas ----------

export async function fetchRoom(room: Room): Promise<{ messages: CommunityMessage[]; pinned: CommunityMessage | null }> {
  const [list, pin] = await Promise.all([
    supabase.from("community_messages").select(COMMUNITY_COLUMNS).eq("room", room).order("created_at", { ascending: false }).limit(50),
    supabase
      .from("community_messages")
      .select(COMMUNITY_COLUMNS)
      .eq("room", room)
      .not("pinned_at", "is", null)
      .order("pinned_at", { ascending: false })
      .limit(1),
  ]);
  if (list.error) throw new Error(list.error.message);
  return { messages: ((list.data ?? []) as CommunityMessage[]).reverse(), pinned: ((pin.data ?? [])[0] ?? null) as CommunityMessage | null };
}

export async function markRoomRead(userId: string, room: Room) {
  await supabase
    .from("community_reads")
    .upsert({ user_id: userId, room, last_read_at: new Date().toISOString() }, { onConflict: "user_id,room" });
}

export function sendCommunity(input: { room: Room; body: string; replyTo: string | null; mentions: string[]; photoUri: string | null }) {
  if (input.photoUri) {
    const form = new FormData();
    form.append("room", input.room);
    form.append("caption", input.body);
    if (input.replyTo) form.append("reply_to", input.replyTo);
    form.append("mentions", JSON.stringify(input.mentions));
    form.append("image", photo(input.photoUri));
    return apiUpload<{ ok: true; message: CommunityMessage }>("/api/mobile/community/messages", form).then((r) => r.message);
  }
  return apiRequest<{ ok: true; message: CommunityMessage }>("POST", "/api/mobile/community/messages", {
    room: input.room,
    body: input.body,
    reply_to: input.replyTo,
    mentions: input.mentions,
  }).then((r) => r.message);
}

export const searchMentions = (room: Room, q: string) =>
  apiGet<{ people: { id: string; name: string }[] }>(`/api/mobile/community/mentions?room=${room}&q=${encodeURIComponent(q)}`).then((r) => r.people);

export const messageAction = (id: string, action: "report" | "pin" | "unpin") =>
  apiRequest<{ ok: boolean }>("POST", `/api/mobile/community/messages/${id}`, { action });

export const deleteCommunityMessage = (id: string) => apiRequest<{ ok: boolean }>("DELETE", `/api/mobile/community/messages/${id}`);

/** Jumlah pesan belum dibaca per ruang yang bisa diakses (dibandingkan dengan community_reads). */
export async function communityUnread(userId: string, rooms: Room[]): Promise<number> {
  const { data: reads } = await supabase.from("community_reads").select("room, last_read_at");
  const last = new Map((reads ?? []).map((r) => [r.room as string, r.last_read_at as string]));
  let total = 0;
  await Promise.all(
    rooms.map(async (room) => {
      let q = supabase.from("community_messages").select("id", { count: "exact", head: true }).eq("room", room).neq("user_id", userId);
      const since = last.get(room);
      if (since) q = q.gt("created_at", since);
      const { count } = await q;
      total += count ?? 0;
    })
  );
  return total;
}

// ---------- Chat admin (support) ----------

export async function fetchSupportThread(userId: string): Promise<{ id: string; user_unread: boolean } | null> {
  const { data } = await supabase.from("chat_threads").select("id, user_unread").eq("user_id", userId).maybeSingle();
  return data ?? null;
}

export async function fetchSupportMessages(threadId: string): Promise<SupportMessage[]> {
  const { data } = await supabase.from("chat_messages").select(CHAT_COLUMNS).eq("thread_id", threadId).order("created_at", { ascending: true }).limit(200);
  return (data ?? []) as SupportMessage[];
}

export function sendSupport(body: string, photoUri: string | null) {
  if (photoUri) {
    const form = new FormData();
    form.append("caption", body);
    form.append("image", photo(photoUri));
    return apiUpload<{ ok: true; message: SupportMessage; threadId: string }>("/api/mobile/chat", form);
  }
  return apiRequest<{ ok: true; message: SupportMessage; threadId: string }>("POST", "/api/mobile/chat", { body });
}

export const markSupportRead = () => apiRequest<{ ok: true }>("POST", "/api/mobile/chat/read", {}).catch(() => null);
