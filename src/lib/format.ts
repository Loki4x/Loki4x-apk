// Format angka/mata uang manual (tidak bergantung pada Intl/toLocaleString di Android).
import { getLocale } from "@/lib/i18n";

export type Currency = "USD" | "IDR";

function group(n: number, decimals: number, thousandSep: string, decimalSep: string): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return frac ? `${grouped}${decimalSep}${frac}` : grouped;
}

/** Tanpa tanda plus: "$1,234.50" / "Rp1.234.500" */
export function formatMoney(value: number, currency: Currency = "USD"): string {
  const sign = value < 0 ? "-" : "";
  return currency === "IDR" ? `${sign}Rp${group(value, 0, ".", ",")}` : `${sign}$${group(value, 2, ",", ".")}`;
}

/** Selalu dengan tanda: "+$12.00" / "-Rp5.000" (sama seperti formatCurrency di web) */
export function formatPnl(value: number, currency: Currency = "USD"): string {
  const sign = value < 0 ? "-" : "+";
  return currency === "IDR" ? `${sign}Rp${group(value, 0, ".", ",")}` : `${sign}$${group(value, 2, ",", ".")}`;
}

const WIB_MS = 7 * 3600_000;

/** Tanggal hari ini (YYYY-MM-DD) dalam WIB. */
export function todayWib(date: Date = new Date()): string {
  return new Date(date.getTime() + WIB_MS).toISOString().slice(0, 10);
}

const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const en = () => getLocale() === "en";
const day = (i: number) => (en() ? DAYS_EN : DAYS_ID)[i];
const month = (i: number) => (en() ? MONTHS_EN : MONTHS_ID)[i];

/** "Sen, 16 Nov" (WIB) */
export function formatDayWib(iso: string): string {
  const d = new Date(new Date(iso).getTime() + WIB_MS);
  return `${day(d.getUTCDay())}, ${d.getUTCDate()} ${month(d.getUTCMonth())}`;
}

/** "19:30" (WIB) */
export function formatTimeWib(iso: string): string {
  const d = new Date(new Date(iso).getTime() + WIB_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** "16 Nov 2026, 19:30" (WIB) */
export function formatDateTimeWib(iso: string): string {
  const d = new Date(new Date(iso).getTime() + WIB_MS);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${month(d.getUTCMonth())} ${d.getUTCFullYear()}, ${hh}:${mm}`;
}

/** "hari ini" / "3 hari lalu" */
export function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (en()) return days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  return days <= 0 ? "hari ini" : `${days} hari lalu`;
}

/** "16 Nov 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${month(d.getUTCMonth())} ${d.getUTCFullYear()}`;
}
