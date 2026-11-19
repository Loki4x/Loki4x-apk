import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { supabase } from "@/lib/supabase";
import { GOOGLE_WEB_CLIENT_ID } from "@/lib/config";

// Login Google memakai provider Google yang sama dengan web (Supabase Auth).
// Alur: buka halaman login Google di browser aman (Custom Tab) → Supabase mengalihkan ke
// loki4x://auth-callback?code=... → kode ditukar jadi sesi (PKCE, verifier disimpan di SecureStore).
// Syarat sekali saja: "loki4x://auth-callback" ada di Supabase → Authentication → URL Configuration → Redirect URLs.

export const GOOGLE_REDIRECT = Linking.createURL("auth-callback");

let exchanging: Promise<void> | null = null;

/** Tukar ?code= dari URL callback jadi sesi. Aman dipanggil dua kali (hasil browser & deep link). */
export function completeGoogleLogin(url: string): Promise<void> {
  if (exchanging) return exchanging;
  exchanging = (async () => {
    try {
      const parsed = new URL(url);
      const errorDesc = parsed.searchParams.get("error_description") ?? new URLSearchParams(parsed.hash.slice(1)).get("error_description");
      if (errorDesc) throw new Error(errorDesc);
      const code = parsed.searchParams.get("code");
      if (!code) throw new Error("no_code");
      const { data } = await supabase.auth.getSession();
      if (data.session) return; // sudah ditukar oleh jalur lain
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw new Error(error.message);
    } finally {
      setTimeout(() => {
        exchanging = null;
      }, 2000);
    }
  })();
  return exchanging;
}

// ---------- Pemilih akun bawaan Android (popup "Pilih akun") ----------

let configured = false;
const nativeAvailable = () => Platform.OS === "android" && GOOGLE_WEB_CLIENT_ID.length > 0;

/**
 * Login lewat popup akun Google bawaan HP, lalu ID token Google ditukar jadi sesi Supabase.
 * "fallback" = tidak bisa dipakai di HP/build ini (mis. Google Cloud belum dikonfigurasi) → pakai browser.
 */
async function nativeGoogle(): Promise<"ok" | "cancel" | "fallback"> {
  if (!nativeAvailable()) return "fallback";
  try {
    if (!configured) {
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, scopes: ["email", "profile"] });
      configured = true;
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== "success") return "cancel";
    const idToken = res.data.idToken;
    if (!idToken) return "fallback";
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    if (error) {
      console.warn("[google] signInWithIdToken:", error.message);
      return "fallback";
    }
    return "ok";
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) return "cancel";
      if (err.code === statusCodes.IN_PROGRESS) return "cancel";
    }
    // DEVELOPER_ERROR (SHA-1 / client ID belum didaftarkan), Play Services tidak ada, dll.
    console.warn("[google] native sign-in gagal, pakai browser:", err);
    return "fallback";
  }
}

/** Keluar juga dari akun Google di HP, supaya popup pilih akun muncul lagi saat login berikutnya. */
export async function signOutGoogle() {
  if (!nativeAvailable() || !configured) return;
  await GoogleSignin.signOut().catch(() => {});
}

/** Hasil: "ok" (sudah login), "cancel" (user menutup popup/browser). Melempar Error kalau gagal. */
export async function signInWithGoogle(): Promise<"ok" | "cancel"> {
  const native = await nativeGoogle();
  if (native !== "fallback") return native;
  return browserGoogle();
}

/** Alur browser (Custom Tab): dipakai kalau pemilih akun bawaan belum bisa dipakai. */
async function browserGoogle(): Promise<"ok" | "cancel"> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: GOOGLE_REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data?.url) throw new Error(error?.message ?? "oauth_url");

  const res = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT);
  if (res.type === "success" && res.url) {
    await completeGoogleLogin(res.url);
    return "ok";
  }
  // Di sebagian HP, link kembali dibuka lewat layar /auth-callback (bukan hasil browser): tunggu sesi sebentar.
  for (let i = 0; i < 10; i++) {
    const { data: s } = await supabase.auth.getSession();
    if (s.session) return "ok";
    await new Promise((r) => setTimeout(r, 300));
  }
  return "cancel";
}
