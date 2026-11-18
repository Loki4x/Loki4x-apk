// Tipe sinyal, sama dengan web (lib/types.ts).

export type SignalSide = "BUY" | "SELL";

/**
 * OPEN       -> baru diposting, menunggu harga menyentuh entry (pending order)
 * HIT_ENTRY  -> harga sudah menyentuh entry, posisi berjalan
 * TP / SL / PARTIAL -> ditutup dengan hasil
 * CANCEL / MISS     -> dibatalkan / terlewat (tidak dihitung sebagai posisi)
 */
export type SignalStatus = "OPEN" | "HIT_ENTRY" | "TP" | "SL" | "PARTIAL" | "CANCEL" | "MISS";

export type SignalType = "REGULAR" | "NEWS";

export interface Signal {
  id: string;
  symbol: string;
  side: SignalSide;
  entry_price: number;
  current_price: number | null;
  current_price_at: string | null;
  take_profit: number | null;
  stop_loss: number | null;
  status: SignalStatus;
  result_pips: number | null;
  risk_percent: number;
  signal_type: SignalType;
  notes: string | null;
  chart_image_url: string | null;
  result_image_url?: string | null;
  posted_at: string;
  closed_at: string | null;
}

export type SignalUpdateType = "SL_TO_BE" | "PARTIAL_CLOSE" | "MOVE_SL" | "MOVE_TP" | "NOTE";

export interface SignalUpdate {
  id: string;
  signal_id: string;
  type: SignalUpdateType;
  message: string | null;
  price: number | null;
  created_at: string;
}

export const SIGNAL_COLUMNS =
  "id, symbol, side, entry_price, current_price, current_price_at, take_profit, stop_loss, status, result_pips, risk_percent, signal_type, notes, chart_image_url, result_image_url, posted_at, closed_at";
