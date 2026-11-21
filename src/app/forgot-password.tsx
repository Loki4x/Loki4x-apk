import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field } from "@/components/form";
import { useTheme } from "@/lib/theme";
import { isEmail } from "@/lib/auth-errors";
import { requestPasswordReset } from "@/lib/password-reset";

/** Lupa password: kirim link reset ke email. Link dibuka di HP ini untuk membuat password baru di aplikasi. */
export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const value = email.trim().toLowerCase();
    if (!isEmail(value)) return setError("Masukkan email yang valid.");
    setSending(true);
    setError(null);
    try {
      await requestPasswordReset(value);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error && e.message === "rate_limited" ? "Terlalu sering meminta. Tunggu beberapa menit lalu coba lagi." : "Gagal mengirim. Cek koneksi lalu coba lagi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <BackHeader title="Lupa password" fallback="/login" />
        {sent ? (
          <Card style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
            <Ionicons name="mail-open-outline" size={40} color={colors.primary} />
            <T variant="h3" style={{ textAlign: "center" }}>Cek email kamu</T>
            <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>
              Kalau email itu terdaftar, kami sudah mengirim link reset password. Buka link tersebut di HP ini, nanti aplikasi langsung meminta password baru.
            </T>
            <T variant="caption" color="textMuted" style={{ textAlign: "center" }}>Tidak ada di inbox? Cek folder spam. Link berlaku 1 jam.</T>
            <Button title="Kirim ulang" variant="secondary" onPress={() => setSent(false)} />
            <Button title="Kembali ke login" onPress={() => router.replace("/login")} />
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <T variant="bodySm" color="textSecondary">Masukkan email akun kamu. Kami kirim link untuk membuat password baru.</T>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
            {error && <T variant="bodySm" color="error">{error}</T>}
            <Button title="Kirim link reset" onPress={send} loading={sending} />
          </Card>
        )}
        <View />
      </Screen>
    </KeyboardAvoidingView>
  );
}
