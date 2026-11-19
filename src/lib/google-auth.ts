import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

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

/** Hasil: "ok" (sudah login), "cancel" (user menutup browser). Melempar Error kalau gagal. */
export async function signInWithGoogle(): Promise<"ok" | "cancel"> {
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
