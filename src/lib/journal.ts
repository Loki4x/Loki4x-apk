import * as SecureStore from "expo-secure-store";
import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { apiRequest, apiUpload } from "@/lib/api";
import { todayWib } from "@/lib/format";
import type { Trade, TradingAccount } from "@/shared/journal-types";
import { tradesToCsv, type ImportRow } from "@/shared/trade-import";

// Baca data jurnal langsung dari Supabase (RLS: hanya milik user sendiri).
// Tulis lewat API web (/api/mobile/...) supaya validasi, P&L & notifikasi batas risiko sama dengan web.

const ACTIVE_KEY = "loki4x-active-account";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function fetchAccounts(userId: string): Promise<TradingAccount[]> {
  const { data, error } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    ...a,
    initial_balance: Number(a.initial_balance),
    currency: a.currency === "IDR" ? "IDR" : "USD",
    max_daily_loss_pct: num(a.max_daily_loss_pct),
    max_trades_per_day: num(a.max_trades_per_day),
    max_consecutive_losses: num(a.max_consecutive_losses),
    monthly_profit_target: num(a.monthly_profit_target),
    target_win_rate: num(a.target_win_rate),
  })) as TradingAccount[];
}

export async function fetchTrades(userId: string, accountId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("trade_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    ...t,
    entry_price: Number(t.entry_price),
    exit_price: num(t.exit_price),
    pips: num(t.pips),
    pnl: num(t.pnl),
  })) as Trade[];
}

export async function fetchTrade(userId: string, tradeId: string): Promise<Trade | null> {
  const { data } = await supabase.from("trades").select("*").eq("id", tradeId).eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return { ...data, entry_price: Number(data.entry_price), exit_price: num(data.exit_price), pips: num(data.pips), pnl: num(data.pnl) } as Trade;
}

export async function getActiveAccountId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_KEY);
}

export async function setActiveAccountId(id: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_KEY, id);
}

/** Field form trade, format sama dengan form web (angka boleh string kosong = tidak diisi). */
export interface TradeInput {
  symbol: string;
  side: "BUY" | "SELL";
  entry_price: string;
  exit_price: string;
  pips: string;
  pnl_manual: string;
  trade_date: string;
  session: string;
  strategy: string;
  emotion: string;
  followed_plan: "" | "yes" | "no";
  confluence: string;
  notes: string;
}

const ERRORS: Record<string, string> = {
  invalid_input: "Ada isian yang belum benar. Cek symbol, harga entry, dan tanggal.",
  membership_required: "Trading Journal khusus member Membership.",
  unauthorized: "Sesi login habis. Silakan login ulang.",
};

export const friendlyApiError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (/network|fetch/i.test(msg)) return "Tidak bisa terhubung. Cek koneksi internet kamu.";
  return ERRORS[msg] ?? msg;
};

export const createTrade = (accountId: string, input: TradeInput) =>
  apiRequest<{ ok: true; id: string | null }>("POST", "/api/mobile/trades", { account_id: accountId, ...input });

export const updateTrade = (tradeId: string, input: TradeInput) =>
  apiRequest<{ ok: true }>("PATCH", `/api/mobile/trades/${tradeId}`, input);

export const deleteTrade = (tradeId: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/trades/${tradeId}`);

export const saveRules = (accountId: string, values: Record<string, string>) =>
  apiRequest<{ ok: true }>("PUT", `/api/mobile/accounts/${accountId}/rules`, values);

export const importRows = (accountId: string, rows: ImportRow[]) =>
  apiRequest<{ ok: true; inserted: number; duplicates: number; invalid: number }>("POST", "/api/mobile/trades/import", {
    account_id: accountId,
    rows,
  });

// ---------- Foto before/after ----------

export type PhotoSlot = "before" | "after";

/** Pilih gambar dari galeri lalu perkecil (maks lebar 1600 px, JPEG) supaya di bawah batas 2 MB server. */
export async function pickPhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const ctx = ImageManipulator.manipulate(asset.uri);
  if ((asset.width ?? 0) > 1600) ctx.resize({ width: 1600 });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return saved.uri;
}

export function uploadTradePhoto(tradeId: string, slot: PhotoSlot, uri: string) {
  const form = new FormData();
  form.append("slot", slot);
  // React Native: objek {uri, name, type} dikirim sebagai file.
  form.append("photo", { uri, name: `${slot}.jpg`, type: "image/jpeg" } as unknown as Blob);
  return apiUpload<{ ok: true; url: string }>(`/api/mobile/trades/${tradeId}/photo`, form);
}

export const deleteTradePhoto = (tradeId: string, slot: PhotoSlot) =>
  apiRequest<{ ok: true }>("DELETE", `/api/mobile/trades/${tradeId}/photo?slot=${slot}`);

// ---------- Akun journaling ----------

export const createAccount = (input: { name: string; initial_balance: string; currency: "USD" | "IDR" }) =>
  apiRequest<{ ok: true; id: string | null }>("POST", "/api/mobile/accounts", input);

export const deleteAccount = (accountId: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/accounts/${accountId}`);

// ---------- Export CSV ----------

/** Tulis semua trade akun ke file CSV (format sama dengan Export CSV di web) lalu buka menu bagikan/simpan. */
export async function exportTradesCsv(accountName: string, trades: Trade[]): Promise<void> {
  const sorted = [...trades].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  const safe = accountName.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "akun";
  const file = new File(Paths.cache, `loki4x-journal-${safe}-${todayWib()}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(tradesToCsv(sorted as unknown as Record<string, unknown>[]));
  await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Export jurnal (CSV)", UTI: "public.comma-separated-values-text" });
}
