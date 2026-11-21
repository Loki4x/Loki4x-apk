import * as SecureStore from "expo-secure-store";
import { supabase } from "@/lib/supabase";
import { GOOGLE_REDIRECT } from "@/lib/google-auth";

// Lupa password di aplikasi: Supabase mengirim email berisi link. Link dibuka di HP ini →
// loki4x://auth-callback?code=... → kode ditukar jadi sesi pemulihan (PKCE, verifier ada di HP ini)
// → layar /reset-password untuk membuat password baru. Redirect URL yang sama dengan login Google
// (sudah terdaftar di Supabase → Authentication → URL Configuration).

const KEY = "loki4x-password-recovery";
const TTL_MS = 60 * 60 * 1000;

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: GOOGLE_REDIRECT });
  // Error sengaja tidak ditampilkan rinci (sama dengan web): jangan bocorkan email mana yang terdaftar.
  if (error && /rate|limit|too many/i.test(error.message)) throw new Error("rate_limited");
  await SecureStore.setItemAsync(KEY, String(Date.now()));
}

/** true kalau link yang baru dibuka adalah link reset password (diminta dari HP ini < 1 jam lalu). */
export async function isRecoveryPending(): Promise<boolean> {
  const at = Number(await SecureStore.getItemAsync(KEY));
  return !!at && Date.now() - at < TTL_MS;
}

export const clearRecovery = () => SecureStore.deleteItemAsync(KEY).catch(() => {});
