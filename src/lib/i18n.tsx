import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { supabase } from "@/lib/supabase";
import { EN } from "@/i18n/en";

// Bahasa aplikasi: Indonesia (default) atau Inggris. Sama seperti web, teks ditulis dalam bahasa
// Indonesia di kode dan dicari terjemahannya di kamus (src/i18n/en.ts). Kalau tidak ada, teks asli dipakai.
// Pilihan bahasa disimpan di HP dan di profiles.language (dipakai juga oleh web, email, & notifikasi).

export type Locale = "id" | "en";
const STORE_KEY = "loki4x-locale";

let current: Locale = "id";
const listeners = new Set<() => void>();

export const isLocale = (v: unknown): v is Locale => v === "id" || v === "en";
export const getLocale = () => current;

function emit() {
  for (const l of listeners) l();
}

/** Muat bahasa yang tersimpan di HP (dipanggil sekali saat aplikasi dibuka). */
export async function loadSavedLocale() {
  const saved = await SecureStore.getItemAsync(STORE_KEY).catch(() => null);
  if (isLocale(saved) && saved !== current) {
    current = saved;
    emit();
  }
}

/**
 * Ganti bahasa. remote = true: simpan juga ke profil (supaya web, email, & notifikasi ikut).
 * remote = false: dipakai saat mengikuti bahasa dari profil yang baru dimuat.
 */
export async function setLocale(next: Locale, remote = true) {
  if (next !== current) {
    current = next;
    emit();
  }
  await SecureStore.setItemAsync(STORE_KEY, next).catch(() => {});
  if (remote) {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (userId) await supabase.from("profiles").update({ language: next }).eq("id", userId);
  }
}

function interpolate(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Terjemahkan satu teks (kunci = teks Indonesia). Variabel ditulis {nama}. */
export function tr(key: string, vars?: Record<string, string | number>): string {
  const base = current === "en" ? EN[key] ?? key : key;
  return interpolate(base, vars);
}

/** Terjemahkan potongan teks dengan mempertahankan spasi di awal/akhir ("  · Lulus" → " · Passed"). */
function trSegment(s: string): string {
  if (current === "id") return s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  if (!m || !m[2]) return s;
  const v = EN[m[2]];
  return v === undefined ? s : m[1] + v + m[3];
}

/** Terjemahkan children React: string tunggal atau array yang berisi string. Elemen lain dibiarkan. */
export function trNode(node: ReactNode): ReactNode {
  if (current === "id") return node;
  if (typeof node === "string") return trSegment(node);
  if (Array.isArray(node)) return node.map((n) => (typeof n === "string" ? trSegment(n) : n));
  return node;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Hook bahasa: komponen yang memakainya ikut render ulang saat bahasa diganti. */
export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  // t dibuat ulang saat bahasa berganti supaya useMemo/useCallback yang memakainya ikut diperbarui.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useCallback((key: string, vars?: Record<string, string | number>) => tr(key, vars), [locale]);
  return { locale, t, setLocale };
}
