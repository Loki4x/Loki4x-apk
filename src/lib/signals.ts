import { supabase } from "@/lib/supabase";
import { categorizeSymbol } from "@/shared/asset-category";
import { SIGNAL_COLUMNS, type Signal, type SignalStatus, type SignalUpdate, type SignalUpdateType } from "@/shared/signal-types";

/** Sama dengan formatPrice di web (lib/utils.ts). */
export function formatPrice(price: number | null | undefined, symbol: string): string {
  if (price === null || price === undefined) return "—";
  const category = categorizeSymbol(symbol);
  if (category === "COMMODITY" || category === "INDEX" || category === "CRYPTO") return Number(price).toFixed(2);
  if (symbol.toUpperCase().includes("JPY")) return Number(price).toFixed(3);
  return Number(price).toFixed(5);
}

export const STATUS_META: Record<SignalStatus, { label: string; tone: "success" | "error" | "warning" | "primary" | "muted" }> = {
  OPEN: { label: "Pending", tone: "muted" },
  HIT_ENTRY: { label: "Running", tone: "primary" },
  TP: { label: "TP", tone: "success" },
  SL: { label: "SL", tone: "error" },
  PARTIAL: { label: "Partial", tone: "warning" },
  CANCEL: { label: "Dibatalkan", tone: "muted" },
  MISS: { label: "Terlewat", tone: "muted" },
};

export const UPDATE_LABEL: Record<SignalUpdateType, string> = {
  SL_TO_BE: "SL digeser ke BE",
  PARTIAL_CLOSE: "Partial close",
  MOVE_SL: "Geser Stop Loss",
  MOVE_TP: "Geser Take Profit",
  NOTE: "Catatan",
};

const normalize = (s: Record<string, unknown>): Signal =>
  ({
    ...s,
    entry_price: Number(s.entry_price),
    current_price: s.current_price === null ? null : Number(s.current_price),
    take_profit: s.take_profit === null ? null : Number(s.take_profit),
    stop_loss: s.stop_loss === null ? null : Number(s.stop_loss),
    result_pips: s.result_pips === null ? null : Number(s.result_pips),
    risk_percent: Number(s.risk_percent ?? 2),
  }) as Signal;

/** Semua sinyal, terbaru dulu (query sama dengan halaman /signals di web; akses dijaga RLS). */
export async function fetchSignals(): Promise<Signal[]> {
  const { data, error } = await supabase.from("signals").select(SIGNAL_COLUMNS).order("posted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => normalize(s as Record<string, unknown>));
}

export async function fetchSignal(id: string): Promise<{ signal: Signal | null; updates: SignalUpdate[] }> {
  const [{ data: sig }, { data: updates }] = await Promise.all([
    supabase.from("signals").select(SIGNAL_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("signal_updates")
      .select("id, signal_id, type, message, price, created_at")
      .eq("signal_id", id)
      .order("created_at", { ascending: true }),
  ]);
  return {
    signal: sig ? normalize(sig as Record<string, unknown>) : null,
    updates: ((updates ?? []) as SignalUpdate[]).map((u) => ({ ...u, price: u.price === null ? null : Number(u.price) })),
  };
}
