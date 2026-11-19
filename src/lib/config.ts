// Konfigurasi dari environment saat build (EXPO_PUBLIC_* ikut ter-bundle ke aplikasi).
// Anon key Supabase memang publik (sama seperti di web); keamanan data dijaga oleh RLS.

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Alamat web Loki4x (untuk API mobile dan link "buka di web"). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://www.loki4xacademy.web.id").replace(/\/$/, "");

export const isConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * Web client ID OAuth Google (sama dengan "Client ID" provider Google di Supabase). Kalau diisi, login Google
 * memakai pemilih akun bawaan Android (popup), bukan halaman web. Kosong = pakai alur browser.
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
