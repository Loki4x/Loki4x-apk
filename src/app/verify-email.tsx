import { useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { authErrorMessage, classifyAuthError } from "@/lib/auth-errors";

const RESEND_COOLDOWN = 60;

/** Verifikasi email dengan kode (sama dengan /verify-otp di web). Berhasil → langsung login. */
export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = String(params.email ?? "").trim().toLowerCase();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (session) return <Redirect href="/" />;
  if (!email) return <Redirect href="/signup" />;

  async function verify(value = code) {
    setError(null);
    setNotice(null);
    if (!/^\d{6,8}$/.test(value)) return setError(authErrorMessage("invalid_code"));
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: value, type: "signup" });
    setLoading(false);
    if (err) setError(authErrorMessage(classifyAuthError(err, "otp")));
    // Berhasil: sesi tersimpan → layar ini otomatis pindah ke Dashboard.
  }

  async function resend() {
    setError(null);
    setNotice(null);
    const { error: err } = await supabase.auth.resend({ type: "signup", email });
    if (err) return setError(authErrorMessage(classifyAuthError(err, "resend")));
    setNotice("Kode baru sudah dikirim ulang.");
    setCooldown(RESEND_COOLDOWN);
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ gap: 16 }}>
        <BackHeader title="Verifikasi email kamu" fallback="/signup" />
        <Card style={{ alignItems: "center", gap: 10 }}>
          <View style={[styles.icon, { backgroundColor: colors.primarySubtle }]}>
            <Ionicons name="mail-unread-outline" size={28} color={colors.primary} />
          </View>
          <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>
            {t("Masukkan kode yang kami kirim ke {email}.", { email })}
          </T>

          <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxes}>
            {Array.from({ length: 6 }, (_, i) => {
              const ch = code[i] ?? "";
              const active = i === Math.min(code.length, 5);
              return (
                <View key={i} style={[styles.box, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.surface2 }]}>
                  <T variant="h2">{ch}</T>
                </View>
              );
            })}
          </Pressable>
          {/* Input tersembunyi: mendukung tempel kode & isi otomatis dari SMS/email. */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, "").slice(0, 8);
              setCode(digits);
              if (digits.length === 6) verify(digits);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            maxLength={8}
            style={styles.hidden}
          />

          {error && (
            <View style={[styles.msg, { backgroundColor: colors.errorSubtle }]}>
              <T variant="bodySm" color="error">{error}</T>
            </View>
          )}
          {notice && <T variant="bodySm" color="success">{notice}</T>}

          <Button title="Verifikasi" onPress={() => verify()} loading={loading} disabled={code.length < 6} style={{ alignSelf: "stretch" }} />
          <Button
            title={cooldown > 0 ? t("Kirim ulang kode ({s} dtk)", { s: cooldown }) : "Kirim ulang kode"}
            variant="secondary"
            onPress={resend}
            disabled={cooldown > 0}
            style={{ alignSelf: "stretch" }}
          />
          <T variant="caption" color="textMuted" style={{ textAlign: "center" }}>
            Email belum terlihat? Coba cek folder Spam atau Promosi. Kalau ada di sana, tandai sebagai “Bukan spam”.
          </T>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  boxes: { flexDirection: "row", gap: 8, marginVertical: 6 },
  box: { width: 44, height: 52, borderWidth: 1.5, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
  msg: { borderRadius: 10, padding: 10, alignSelf: "stretch" },
});
