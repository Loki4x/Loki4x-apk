import { useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { WEB_URL, isConfigured } from "@/lib/config";

function friendlyError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Email atau password salah.";
  if (/email not confirmed/i.test(message)) return "Email belum diverifikasi. Cek inbox kamu dulu.";
  if (/network|fetch/i.test(message)) return "Tidak bisa terhubung. Cek koneksi internet kamu.";
  return message;
}

export default function LoginScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Isi email dan password.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(friendlyError(err.message));
  }

  const inputStyle = [styles.input, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text }];

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ gap: 20, paddingTop: 40 }}>
        <View style={{ alignItems: "center", gap: 10 }}>
          <Image source={require("../../assets/icon.png")} style={{ width: 72, height: 72, borderRadius: 18 }} />
          <T variant="h2">Loki4x Academy</T>
          <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>
            Masuk dengan akun yang sama seperti di web.
          </T>
        </View>

        <Card style={{ gap: 14 }}>
          {!isConfigured && (
            <T variant="bodySm" color="error">
              Aplikasi belum dikonfigurasi (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY kosong saat build).
            </T>
          )}
          <View style={{ gap: 6 }}>
            <T variant="bodySm" color="textSecondary">Email</T>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="nama@email.com"
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
            />
          </View>
          <View style={{ gap: 6 }}>
            <T variant="bodySm" color="textSecondary">Password</T>
            <View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                style={[inputStyle, { paddingRight: 48 }]}
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eye} hitSlop={10}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {error && (
            <View style={[styles.error, { backgroundColor: colors.errorSubtle }]}>
              <T variant="bodySm" color="error">{error}</T>
            </View>
          )}

          <Button title="Masuk" onPress={handleLogin} loading={loading} />

          <Pressable onPress={() => Linking.openURL(`${WEB_URL}/forgot-password`)}>
            <T variant="bodySm" color="primary" style={{ textAlign: "center" }}>Lupa password?</T>
          </Pressable>
        </Card>

        <Pressable onPress={() => Linking.openURL(`${WEB_URL}/signup`)}>
          <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>
            Belum punya akun? <T variant="bodySm" color="primary">Daftar di web</T>
          </T>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  eye: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  error: { borderRadius: 10, padding: 10 },
});
