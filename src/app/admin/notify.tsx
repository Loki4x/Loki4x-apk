import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { friendlyApiError } from "@/lib/journal";
import { sendAnnouncement } from "@/lib/admin";

type Audience = "ALL" | "FREE" | "VIP" | "MEMBERSHIP";

/** Admin: kirim pengumuman (sama dengan menu Notifikasi di panel admin web). */
export default function AdminNotify() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [target, setTarget] = useState<"ALL" | "USER">("ALL");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState({ push: true, website: true, email: false });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  async function send() {
    setResult(null);
    setSending(true);
    try {
      const res = await sendAnnouncement({
        target,
        audience,
        email: email.trim(),
        title: title.trim(),
        message: message.trim(),
        ch_push: channels.push ? "true" : "false",
        ch_website: channels.website ? "true" : "false",
        ch_email: channels.email ? "true" : "false",
      });
      setResult({ ok: true, text: res.message });
      setTitle("");
      setMessage("");
    } catch (err) {
      setResult({ ok: false, text: friendlyApiError(err) });
    } finally {
      setSending(false);
    }
  }

  const CHANNELS: { key: keyof typeof channels; label: string }[] = [
    { key: "push", label: "Push (HP & browser)" },
    { key: "website", label: "Notifikasi di website" },
    { key: "email", label: "Email" },
  ];

  return (
    <Screen>
      <BackHeader title="Admin · Pengumuman" fallback="/admin" />
      <Card style={{ gap: 14 }}>
        <OptionChips
          label="Kirim ke"
          options={[
            { value: "ALL", label: "Banyak user" },
            { value: "USER", label: "Satu user (email)" },
          ]}
          value={target}
          onChange={setTarget}
        />
        {target === "ALL" ? (
          <OptionChips
            label="Tier"
            options={[
              { value: "ALL", label: "Semua" },
              { value: "FREE", label: "Free" },
              { value: "VIP", label: "VIP" },
              { value: "MEMBERSHIP", label: "Membership" },
            ]}
            value={audience}
            onChange={setAudience}
          />
        ) : (
          <Field label="Email user" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="user@email.com" />
        )}
        <Field label="Judul" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
        <Field label="Pesan" value={message} onChangeText={setMessage} multiline autoCapitalize="sentences" />
        <View style={{ gap: 8 }}>
          <T variant="bodySm" color="textSecondary">Kanal</T>
          {CHANNELS.map((c) => (
            <Pressable key={c.key} onPress={() => setChannels((s) => ({ ...s, [c.key]: !s[c.key] }))} style={styles.check}>
              <Ionicons name={channels[c.key] ? "checkbox" : "square-outline"} size={22} color={channels[c.key] ? colors.primary : colors.textMuted} />
              <T variant="bodySm">{c.label}</T>
            </Pressable>
          ))}
        </View>
        {result && <T variant="bodySm" color={result.ok ? "success" : "error"}>{result.text}</T>}
        <Button
          title="Kirim pengumuman"
          onPress={send}
          loading={sending}
          disabled={!title.trim() || !message.trim() || (target === "USER" && !email.trim())}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: "row", alignItems: "center", gap: 10 },
});
