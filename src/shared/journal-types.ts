// Tipe jurnal, sama dengan web (lib/types.ts).

export type TradeSide = "BUY" | "SELL";
export type TradeStatus = "OPEN" | "CLOSED";
export type AccountCurrency = "USD" | "IDR";
export type TradeSession = "LONDON" | "NEW_YORK" | "ASIA" | "OVERLAP";

export interface TradingAccount {
  id: string;
  user_id: string;
  name: string;
  initial_balance: number;
  currency: AccountCurrency;
  created_at: string;
  // Aturan risiko & target. null/undefined = tidak dipakai.
  max_daily_loss_pct?: number | null;
  max_trades_per_day?: number | null;
  max_consecutive_losses?: number | null;
  monthly_profit_target?: number | null;
  target_win_rate?: number | null;
}

export interface Trade {
  id: string;
  user_id: string;
  account_id: string | null;
  symbol: string;
  side: TradeSide;
  entry_price: number;
  exit_price: number | null;
  pips: number | null;
  pnl: number | null;
  trade_date: string;
  status: TradeStatus;
  session: TradeSession | null;
  notes: string | null;
  confluence: string | null;
  strategy: string | null;
  emotion: string | null;
  followed_plan: boolean | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  external_id?: string | null;
  created_at: string;
}
