import { apiGet } from "@/lib/api";

// Data pasar dari API web (sumber eksternal & cache ada di server): COT, Retail Bias, berita, kalender.

export interface CotAssetRow {
  label: string;
  category: string;
  long: number;
  short: number;
  longPct: number;
  shortPct: number;
  netPos: number;
  openInterest: number;
  deltaLong: number;
  deltaShort: number;
  deltaOpenInterest: number;
  netChangePct: number;
}

export interface CotHistoryPoint {
  date: string;
  long: number;
  short: number;
  longPct: number;
  netPos: number;
  deltaLong: number;
  deltaShort: number;
  netChangePct: number;
}

export interface RetailBiasItem {
  symbol: string;
  long_percent: number;
  short_percent: number;
  source: "auto" | "manual";
  updated_at: string | null;
}

export interface MarketNewsItem {
  id: string;
  title: string;
  summary: string;
  link: string;
  source: string;
  categories: ("FOREX" | "CRYPTO" | "STOCKS" | "COMMODITIES" | "GOLD")[];
  publishedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  currency: string;
  impact: "HIGH" | "MEDIUM" | "LOW" | "HOLIDAY";
  dateISO: string;
  forecast: string;
  previous: string;
  actual: string;
}

export const fetchCot = () => apiGet<{ rows: CotAssetRow[]; reportDate: string | null }>("/api/mobile/cot");
export const fetchCotHistory = (label: string) =>
  apiGet<{ label: string; points: CotHistoryPoint[] }>(`/api/mobile/cot/${encodeURIComponent(label)}`).then((r) => r.points);
export const fetchPositioning = () => apiGet<{ items: RetailBiasItem[] }>("/api/mobile/positioning").then((r) => r.items);
export const fetchMarketNews = () => apiGet<{ news: MarketNewsItem[] }>("/api/mobile/market-news").then((r) => r.news);
export const fetchFullCalendar = () => apiGet<{ events: CalendarEvent[] }>("/api/mobile/calendar/all").then((r) => r.events);

/** 12345678 → "12.3M", 45600 → "45.6K" */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${Math.round(abs)}`;
}
