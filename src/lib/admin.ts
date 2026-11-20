import { supabase } from "@/lib/supabase";
import { apiRequest, apiUpload } from "@/lib/api";
import { pipSizeFor } from "@/shared/signal-metrics";
import type { AcademyCategory } from "@/shared/academy";
import type { SignalStatus, SignalUpdateType } from "@/shared/signal-types";
import type { SupportMessage } from "@/lib/chat";

// Menu admin aplikasi. Semua perubahan lewat API admin web (/api/mobile/admin/...), yang memakai
// logika yang sama dengan panel admin web (validasi, audit log, email & push notifikasi).

export const SIGNAL_STATUSES: SignalStatus[] = ["OPEN", "HIT_ENTRY", "TP", "SL", "PARTIAL", "CANCEL", "MISS"];
export const RESULT_STATUSES: SignalStatus[] = ["TP", "SL", "PARTIAL"];
export const TERMINAL: SignalStatus[] = ["TP", "SL", "PARTIAL", "CANCEL", "MISS"];
export const UPDATE_TYPES: SignalUpdateType[] = ["SL_TO_BE", "PARTIAL_CLOSE", "MOVE_SL", "MOVE_TP", "NOTE"];

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Pips dari entry → harga (positif = untung sesuai arah), sama dengan lib/signal-pips.ts di web. */
export function pipsBetween(symbol: string, side: "BUY" | "SELL", entry: number, price: number): number {
  const move = side === "BUY" ? price - entry : entry - price;
  return round1(move / pipSizeFor(symbol.trim().toUpperCase()));
}

/** Angka dari input ("1,25" → "1.25"); kosong → "". */
export const cleanNum = (v: string) => v.trim().replace(",", ".");
export const toNum = (v: string): number | null => {
  const s = cleanNum(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Tanggal & jam WIB "YYYY-MM-DD HH:mm" (atau dengan T) → format yang diterima server "YYYY-MM-DDTHH:mm". */
export function wibDateTime(v: string): string | null | "invalid" {
  const s = v.trim().replace(" ", "T");
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? s : "invalid";
}

function photoPart(uri: string, name: string) {
  return { uri, name, type: "image/jpeg" } as unknown as Blob;
}

// ---------- Sinyal ----------

export function createSignal(fields: Record<string, string>, chartUri: string | null) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (chartUri) form.append("chart_image", photoPart(chartUri, "chart.jpg"));
  return apiUpload<{ ok: true }>("/api/mobile/admin/signals", form);
}

export function updateSignalStatus(
  id: string,
  input: { status: SignalStatus; current_price: string; result_pips: string; closed_at: string },
  resultUri: string | null
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(input)) form.append(k, v);
  if (resultUri) form.append("result_image", photoPart(resultUri, "result.jpg"));
  return apiUpload<{ ok: true }>(`/api/mobile/admin/signals/${id}/status`, form);
}

export const addSignalUpdate = (id: string, input: { type: SignalUpdateType; message: string; price: string; send_email: "1" | "0" }) =>
  apiRequest<{ ok: true }>("POST", `/api/mobile/admin/signals/${id}/updates`, input);

export const deleteSignal = (id: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/admin/signals/${id}`);

// ---------- Akademi ----------

export const addVideo = (input: { category: AcademyCategory; title: string; description: string; video_url: string; thumbnail_url: string }) =>
  apiRequest<{ ok: true }>("POST", "/api/mobile/admin/videos", input);

export const deleteVideo = (id: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/admin/videos/${id}`);

export interface AdminQuizQuestion {
  id: string;
  category: AcademyCategory;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
}

/** Soal + kunci jawaban: RLS hanya mengizinkan admin membaca tabel ini. */
export async function fetchQuizQuestions(category: AcademyCategory): Promise<AdminQuizQuestion[]> {
  const { data, error } = await supabase
    .from("academy_quiz_questions")
    .select("id, category, question, options, correct_index, explanation")
    .eq("category", category)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminQuizQuestion[];
}

export const addQuizQuestion = (input: { category: AcademyCategory; question: string; options: string[]; correct_index: number; explanation: string }) =>
  apiRequest<{ ok: true }>("POST", "/api/mobile/admin/quiz", input);

export const deleteQuizQuestion = (id: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/admin/quiz/${id}`);

// ---------- Pengumuman ----------

export const sendAnnouncement = (input: {
  target: "ALL" | "USER";
  audience: "ALL" | "FREE" | "VIP" | "MEMBERSHIP";
  email: string;
  title: string;
  message: string;
  ch_push: "true" | "false";
  ch_website: "true" | "false";
  ch_email: "true" | "false";
}) => apiRequest<{ ok: true; message: string }>("POST", "/api/mobile/admin/notify", input);

// ---------- Panel admin lengkap (data dari /api/mobile/admin/data/<section>) ----------

export type AdminSection =
  | "dashboard"
  | "counts"
  | "users"
  | "vip-requests"
  | "usdt-payments"
  | "promo-codes"
  | "news"
  | "positioning"
  | "calendar-actuals"
  | "referrals"
  | "audit-log"
  | "chat-threads";

export const fetchAdminData = <T>(section: AdminSection) =>
  apiRequest<{ data: T }>("GET", `/api/mobile/admin/data/${section}`).then((r) => r.data);

export type Tier = "FREE" | "VIP" | "MEMBERSHIP";

export interface AdminDashboard {
  total: number;
  paidNow: number;
  membershipNow: number;
  vipNow: number;
  freeNow: number;
  last7: number;
  signupDelta: string;
  conversion: number;
  revenueMonthIdr: number;
  revenueAllIdr: number;
  revenueAllUsdt: number;
  pendingUsdt: number;
  signupData: { day: string; signups: number }[];
  revenueData: { month: string; idr: number }[];
  planRows: { plan: string; count: number; idr: number; usdt: number }[];
  growthData: { month: string; free: number; vip: number }[];
  expiringSoon: ExpiringRow[];
  recentlyExpired: ExpiringRow[];
  activity: { id: string; type: "signup" | "upgrade"; title: string; subtitle: string; ts: number }[];
}
export interface ExpiringRow {
  id: string;
  name: string;
  email: string | null;
  tier: string;
  daysLeft: number | null;
  expiresAt: string | null;
}

export interface AdminCounts {
  vipPending: number;
  usdtPending: number;
  chatUnread: number;
}

export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  tier: string | null;
  vip_expires_at: string | null;
  is_suspended: boolean;
  created_at: string;
}

/** Sama dengan lib/membership.ts di web: tier berbayar yang masa aktifnya lewat = FREE. */
export function membershipOf(u: { tier: string | null; vip_expires_at: string | null }) {
  const stored: Tier = u.tier === "VIP" || u.tier === "MEMBERSHIP" ? u.tier : "FREE";
  if (stored === "FREE") return { effective: "FREE" as Tier, stored, expired: false, daysLeft: null as number | null };
  if (!u.vip_expires_at) return { effective: stored, stored, expired: false, daysLeft: null };
  const diff = new Date(u.vip_expires_at).getTime() - Date.now();
  const expired = diff < 0;
  return { effective: expired ? ("FREE" as Tier) : stored, stored, expired, daysLeft: expired ? 0 : Math.ceil(diff / 86_400_000) };
}

// Cache sederhana supaya halaman detail user langsung tampil tanpa memuat ulang daftar.
const userCache = new Map<string, AdminUser>();
export const cacheUsers = (list: AdminUser[]) => list.forEach((u) => userCache.set(u.id, u));
export const cachedUser = (id: string) => userCache.get(id) ?? null;

export interface UserStats {
  totalTrades: number;
  winRate: number;
  recentTrades: { id: string; symbol: string; side: string; pnl: number | null; status: string; trade_date: string }[];
}
export const fetchUserStats = (id: string) => apiRequest<UserStats>("GET", `/api/mobile/admin/users/${id}`);
export const setUserTier = (id: string, tier: Tier, vipExpiresAt: string | null) =>
  apiRequest<{ ok: true }>("POST", `/api/mobile/admin/users/${id}`, { action: "tier", tier, vip_expires_at: vipExpiresAt });
export const setUserSuspended = (id: string, suspend: boolean) =>
  apiRequest<{ ok: true }>("POST", `/api/mobile/admin/users/${id}`, { action: "suspend", suspend });

export interface VipRequest {
  id: string;
  user_id: string;
  broker_email: string;
  trading_account_id: string;
  broker?: string | null;
  first_deposit: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
}
export const reviewVipRequest = (id: string, action: "approve" | "reject") =>
  apiRequest<{ ok: true }>("POST", `/api/mobile/admin/vip-requests/${id}`, { action });

export interface UsdtPayment {
  id: string;
  user_id: string;
  order_id: string;
  plan: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  slip_url: string | null;
  note: string | null;
  payment_method: string | null;
  promo_code?: string | null;
  discount_amount?: number | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
}
export const reviewUsdtPayment = (id: string, action: "approve" | "reject") =>
  apiRequest<{ ok: true }>("POST", `/api/mobile/admin/usdt-payments/${id}`, { action });
/** Bukti transfer privat ("r2private:<kunci>") dibuka lewat endpoint admin dengan token login. */
export const slipPath = (url: string) =>
  url.startsWith("r2private:") ? `/api/admin/slip?key=${encodeURIComponent(url.slice("r2private:".length))}` : null;

export interface PromoCode {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED_IDR";
  value: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  plans: string[] | null;
  active: boolean;
  note: string | null;
}
export const PROMO_PLANS = ["VIP", "MEMBERSHIP", "MEMBERSHIP_LIFETIME"] as const;
export const PLAN_LABEL: Record<string, string> = { VIP: "VIP", MEMBERSHIP: "Membership", MEMBERSHIP_LIFETIME: "Membership Lifetime" };
export const createPromo = (input: {
  code: string;
  type: "PERCENT" | "FIXED_IDR";
  value: string;
  max_uses: string;
  valid_from: string;
  valid_until: string;
  note: string;
  plans: string[];
}) => apiRequest<{ ok: true }>("POST", "/api/mobile/admin/promo-codes", input);
export const setPromoActive = (id: string, active: boolean) => apiRequest<{ ok: true }>("PATCH", `/api/mobile/admin/promo-codes/${id}`, { active });

export interface AdminNews {
  id: string;
  event_title: string;
  currency: string;
  impact_level: "HIGH" | "MEDIUM" | "LOW";
  release_time: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}
export const addNews = (input: {
  event_title: string;
  currency: string;
  impact_level: string;
  release_time: string;
  forecast: string;
  previous: string;
  actual: string;
}) => apiRequest<{ ok: true }>("POST", "/api/mobile/admin/news", input);
export const deleteNews = (id: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/admin/news/${id}`);

export interface AdminPositioning {
  id: string;
  symbol: string;
  long_percent: number;
  short_percent: number;
  updated_at: string;
}
export const savePositioning = (symbol: string, longPercent: string) =>
  apiRequest<{ ok: true }>("POST", "/api/mobile/admin/positioning", { symbol, long_percent: longPercent });
export const deletePositioning = (id: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/admin/positioning/${id}`);

export interface ActualRow {
  key: string;
  dateISO: string;
  currency: string;
  impact: "HIGH" | "MEDIUM";
  title: string;
  forecast: string;
  previous: string;
  actual: string;
}
export const saveActual = (key: string, actual: string) =>
  apiRequest<{ ok: true }>("POST", "/api/mobile/admin/calendar-actuals", { key, actual });

export interface AdminReferral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referrer_email: string | null;
  referred_email: string | null;
  status: "PENDING" | "REWARDED" | "REJECTED" | "CAPPED";
  reward_days: number;
  note: string | null;
  created_at: string;
  claimed_at: string | null;
}

export interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  target_user_id: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminChatThread {
  id: string;
  user_id: string;
  status: "OPEN" | "CLOSED";
  user_unread: boolean;
  admin_unread: boolean;
  last_message_at: string;
  last_message_preview: string | null;
  name: string;
  email: string;
}
export function adminChatReply(threadId: string, body: string, photoUri: string | null) {
  if (photoUri) {
    const form = new FormData();
    form.append("caption", body);
    form.append("image", photoPart(photoUri, "photo.jpg"));
    return apiUpload<{ ok: true; message: SupportMessage }>(`/api/mobile/admin/chat/${threadId}`, form);
  }
  return apiRequest<{ ok: true; message: SupportMessage }>("POST", `/api/mobile/admin/chat/${threadId}`, { body });
}
export const adminChatPatch = (threadId: string, patch: { read?: true; status?: "OPEN" | "CLOSED" }) =>
  apiRequest<{ ok: true }>("PATCH", `/api/mobile/admin/chat/${threadId}`, patch);

/** Rupiah tanpa desimal, mis. "Rp1.250.000". */
export const idr = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
