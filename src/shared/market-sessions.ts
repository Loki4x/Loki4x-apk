// Kill zone ICT dalam waktu New York, ditampilkan dalam WIB. Sama dengan widget di web
// (components/dashboard/MarketSessionsClock.tsx), tapi zona waktu dihitung manual supaya
// tidak bergantung pada dukungan Intl/timeZone di mesin JavaScript Android.

export const DAY = 24 * 60;
const WIB_OFFSET = 7 * 60;

export interface SessionDef {
  key: string;
  label: string;
  startMin: number; // menit sejak 00:00 waktu New York
  endMin: number;
  /** hari (0=Minggu) di New York saat sesi berlangsung */
  days: number[];
  color: "warning" | "primary" | "success" | "secondary";
}

const WEEKDAYS = [1, 2, 3, 4, 5];

export const SESSIONS: SessionDef[] = [
  { key: "ASIA", label: "Asia", startMin: 19 * 60, endMin: 23 * 60, days: [0, 1, 2, 3, 4], color: "warning" },
  { key: "LONDON", label: "London", startMin: 2 * 60, endMin: 5 * 60, days: WEEKDAYS, color: "primary" },
  { key: "NY_AM", label: "New York AM", startMin: 7 * 60 + 30, endMin: 11 * 60, days: WEEKDAYS, color: "success" },
  { key: "NY_PM", label: "New York PM", startMin: 13 * 60 + 30, endMin: 16 * 60, days: WEEKDAYS, color: "secondary" },
];

/** Minggu ke-n (1-based) di bulan tertentu, jam `hourUtc` UTC. */
function nthSundayUtc(year: number, month: number, n: number, hourUtc: number): number {
  const first = new Date(Date.UTC(year, month, 1));
  const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
  return Date.UTC(year, month, firstSunday + (n - 1) * 7, hourUtc);
}

/**
 * Selisih New York terhadap UTC (menit). DST AS: Minggu ke-2 Maret 02:00 EST (07:00 UTC)
 * sampai Minggu ke-1 November 02:00 EDT (06:00 UTC).
 */
export function nyOffsetMinutes(date: Date): number {
  const y = date.getUTCFullYear();
  const t = date.getTime();
  const dstStart = nthSundayUtc(y, 2, 2, 7);
  const dstEnd = nthSundayUtc(y, 10, 1, 6);
  return t >= dstStart && t < dstEnd ? -4 * 60 : -5 * 60;
}

/** Hari (0=Minggu) dan menit sejak tengah malam pada zona dengan offset tertentu. */
function zoned(date: Date, offsetMin: number) {
  const shifted = new Date(date.getTime() + offsetMin * 60000);
  return { dow: shifted.getUTCDay(), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

export const nyParts = (date: Date) => zoned(date, nyOffsetMinutes(date));
export const wibParts = (date: Date) => zoned(date, WIB_OFFSET);

/** Pasar forex tutup dari Jumat 17:00 sampai Minggu 17:00 waktu New York. */
export function isWeekendClosed(date: Date): boolean {
  const { dow, minutes } = nyParts(date);
  return dow === 6 || (dow === 5 && minutes >= 17 * 60) || (dow === 0 && minutes < 17 * 60);
}

export function minutesUntilMarketOpen(date: Date): number {
  const { dow, minutes } = nyParts(date);
  return ((7 - dow) % 7) * DAY + 17 * 60 - minutes;
}

export function isSessionOpen(s: SessionDef, date: Date): boolean {
  const { dow, minutes } = nyParts(date);
  return s.days.includes(dow) && minutes >= s.startMin && minutes < s.endMin && !isWeekendClosed(date);
}

function minutesUntilSessionOpen(s: SessionDef, now: Date): number {
  const { minutes } = nyParts(now);
  const firstStart = (s.startMin - minutes + DAY) % DAY || DAY;
  const candidates = Array.from({ length: 8 }, (_, k) => firstStart + k * DAY);
  return Math.min(...candidates.filter((c) => isSessionOpen(s, new Date(now.getTime() + c * 60000))), 8 * DAY);
}

export interface SessionState extends SessionDef {
  open: boolean;
  wibStart: number;
  wibEnd: number;
  /** menit sampai tutup (kalau buka) atau sampai buka berikutnya */
  countdown: number;
}

export function computeSessions(now: Date): SessionState[] {
  const shift = WIB_OFFSET - nyOffsetMinutes(now);
  const { minutes } = nyParts(now);
  return SESSIONS.map((s) => {
    const open = isSessionOpen(s, now);
    return {
      ...s,
      open,
      wibStart: (((s.startMin + shift) % DAY) + DAY) % DAY,
      wibEnd: (((s.endMin + shift) % DAY) + DAY) % DAY,
      countdown: open ? s.endMin - minutes : minutesUntilSessionOpen(s, now),
    };
  });
}

export function fmtClock(min: number): string {
  const n = ((min % DAY) + DAY) % DAY;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

export function fmtDuration(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) return `${Math.floor(h / 24)} hari ${h % 24} jam`;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}
