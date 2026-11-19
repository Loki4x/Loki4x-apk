import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import { WEB_URL } from "@/lib/config";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field } from "@/components/form";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { authErrorMessage, classifyAuthError, isEmail } from "@/lib/auth-errors";
import { signInWithGoogle } from "@/lib/google-auth";

/** Daftar akun baru dengan email (sama dengan /signup di web): kode verifikasi dikirim ke email. */
export default function SignupScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  async function handleSignup() {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) return setError("Isi nama kamu.");
    if (!isEmail(cleanEmail)) return setError(authErrorMessage("invalid_input"));
    if (password.length < 8 || password.length > 72) return setError(authErrorMessage("weak_password"));
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { full_name: name.trim().slice(0, 80) } },
    });
    setLoading(false);
    if (err) return setError(authErrorMessage(classifyAuthError(err, "signup")));
    router.replace(`/verify-email?email=${encodeURIComponent(cleanEmail)}`);
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setError(authErrorMessage("generic"));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ gap: 16 }}>
        <BackHeader title="Daftar Akun" fallback="/login" />
        <T variant="bodySm" color="textSecondary">
          Buat akun Loki4x Academy gratis. Akun yang sama bisa dipakai di web dan aplikasi.
        </T>

        <Pressable
          onPress={handleGoogle}
          disabled={googleLoading}
          style={({ pressed }) => [styles.google, { borderColor: colors.border, backgroundColor: colors.surface2, opacity: googleLoading ? 0.6 : pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="logo-google" size={18} color={colors.text} />
          <T style={{ fontWeight: "600" }}>{googleLoading ? "Membuka Google…" : "Daftar dengan Google"}</T>
        </Pressable>

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <T variant="caption" color="textMuted">atau daftar dengan email</T>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <Card style={{ gap: 14 }}>
          <Field label="Nama lengkap" value={name} onChangeText={setName} placeholder="Nama kamu" autoCapitalize="sentences" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="nama@email.com" keyboardType="email-address" />
          <View>
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="Minimal 8 karakter" secure={!showPassword} />
            <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eye} hitSlop={10}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {error && (
            <View style={[styles.error, { backgroundColor: colors.errorSubtle }]}>
              <T variant="bodySm" color="error">{error}</T>
            </View>
          )}

          <Button title="Daftar" onPress={handleSignup} loading={loading} disabled={!name || !email || !password} />
          <T variant="caption" color="textMuted" style={{ textAlign: "center" }}>
            Kami akan mengirim kode verifikasi ke email kamu. Dengan mendaftar, kamu setuju dengan{" "}
            <T variant="caption" color="primary" onPress={() => Linking.openURL(`${WEB_URL}/terms`)}>Syarat & Ketentuan</T> dan{" "}
            <T variant="caption" color="primary" onPress={() => Linking.openURL(`${WEB_URL}/privacy`)}>Kebijakan Privasi</T>.
          </T>
        </Card>

        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/login"))}>
          <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>
            Sudah punya akun? <T variant="bodySm" color="primary">Masuk</T>
          </T>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  google: { minHeight: 48, borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  eye: { position: "absolute", right: 14, bottom: 12 },
  error: { borderRadius: 10, padding: 10 },
});
