import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { Redirect, router } from "expo-router";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { clearRecovery } from "@/lib/password-reset";

/** Buat password baru setelah membuka link reset (sesi pemulihan sudah aktif). Sama dengan /reset-password di web. */
export default function ResetPasswordScreen() {
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Redirect href="/forgot-password" />;

  async function save() {
    if (password.length < 8 || password.length > 72) return setError("Password minimal 8 karakter (maks 72).");
    if (password !== confirm) return setError("Konfirmasi password tidak cocok.");
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setSaving(false);
      return setError(/same|different/i.test(err.message) ? "Password baru harus berbeda dari password lama." : "Gagal menyimpan password. Minta link reset baru lalu coba lagi.");
    }
    // Putuskan sesi di perangkat lain, siapa tahu password lama sudah bocor (sama dengan web).
    await supabase.auth.signOut({ scope: "others" }).catch(() => {});
    await clearRecovery();
    setSaving(false);
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <BackHeader title="Buat password baru" fallback="/" />
        <Card style={{ gap: 12 }}>
          <T variant="bodySm" color="textSecondary">Buat password baru untuk {session.user.email}. Perangkat lain yang sedang login akan dikeluarkan.</T>
          <Field label="Password baru" value={password} onChangeText={setPassword} secure placeholder="Minimal 8 karakter" />
          <Field label="Ulangi password baru" value={confirm} onChangeText={setConfirm} secure />
          {error && <T variant="bodySm" color="error">{error}</T>}
          <Button title="Simpan password" onPress={save} loading={saving} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
