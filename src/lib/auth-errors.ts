// Pesan error login/daftar, sama dengan lib/auth-errors.ts di web (pesan mentah Supabase tidak ditampilkan).

type AuthError = { message?: string; code?: string; status?: number } | null | undefined;

const MESSAGES = {
  invalid_credentials: "Email atau password salah.",
  email_not_confirmed: "Email belum diverifikasi. Masukkan kode yang dikirim ke emailmu, atau kirim ulang kodenya.",
  suspended: "Akun kamu ditangguhkan. Hubungi admin untuk bantuan.",
  rate_limited: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit.",
  weak_password: "Password minimal 8 karakter.",
  invalid_code: "Kode salah atau sudah kedaluwarsa. Minta kode baru.",
  invalid_input: "Data tidak valid. Periksa email dan isianmu.",
  signup_failed: "Pendaftaran gagal. Periksa datamu, atau coba lagi nanti.",
  network: "Tidak bisa terhubung. Cek koneksi internet kamu.",
  generic: "Terjadi kesalahan. Coba lagi.",
} as const;

export type AuthErrorCode = keyof typeof MESSAGES;

export function classifyAuthError(error: AuthError, ctx: "login" | "signup" | "otp" | "resend" = "login"): AuthErrorCode {
  const code = (error?.code ?? "").toLowerCase();
  const msg = (error?.message ?? "").toLowerCase();
  if (/network|fetch/.test(msg)) return "network";
  if (error?.status === 429 || code.includes("rate_limit") || msg.includes("rate limit") || msg.includes("too many")) return "rate_limited";
  if (code === "user_banned" || msg.includes("banned")) return "suspended";
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "invalid_credentials";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) return "email_not_confirmed";
  if (code === "weak_password" || msg.includes("password should") || msg.includes("weak password")) return "weak_password";
  if (ctx === "otp") return "invalid_code";
  if (ctx === "signup") return "signup_failed";
  return "generic";
}

export const authErrorMessage = (code: AuthErrorCode) => MESSAGES[code];

/** Sama dengan isEmail() di web (cukup ketat untuk menolak salah ketik umum). */
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
