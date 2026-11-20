import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, Field, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { formatDateTimeWib } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { addNews, deleteNews, wibDateTime, type AdminNews } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

const EMPTY = { event_title: "", currency: "", impact_level: "MEDIUM", release_time: "", forecast: "", previous: "", actual: "" };
const TONE = { HIGH: "error", MEDIUM: "warning", LOW: "muted" } as const;

/** Kalender berita ekonomi manual (sama dengan /admin/news di web). */
export default function AdminNewsScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { data, error, load, refresh, refreshing } = useAdminData<AdminNews[]>("news");
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const when = wibDateTime(form.release_time);
    if (!form.event_title.trim() || !form.currency.trim() || !when) {
      setMsg({ ok: false, text: t("Lengkapi judul, mata uang, dan waktu rilis.") });
      return;
    }
    if (when === "invalid") {
      setMsg({ ok: false, text: t("Format waktu YYYY-MM-DD HH:mm (WIB).") });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await addNews({ ...form, release_time: new Date(`${when}:00+07:00`).toISOString() });
      setForm(EMPTY);
      setOpen(false);
      setMsg({ ok: true, text: t("Berita ditambahkan.") });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: friendlyApiError(e) });
    } finally {
      setSaving(false);
    }
  }

  function remove(n: AdminNews) {
    Alert.alert(t("Hapus berita ini?"), n.event_title, [
      { text: t("Batal"), style: "cancel" },
      {
        text: t("Hapus"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteNews(n.id);
            await load();
          } catch (e) {
            setMsg({ ok: false, text: friendlyApiError(e) });
          }
        },
      },
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="Economic News" fallback="/admin" />
      <T variant="bodySm" color="textSecondary">Kelola kalender berita ekonomi.</T>
      {msg && <T variant="bodySm" color={msg.ok ? "success" : "error"}>{msg.text}</T>}
      {!open ? (
        <Button title="+ Tambah berita" onPress={() => setOpen(true)} />
      ) : (
        <Card>
          <T variant="h3">Berita baru</T>
          <Field label="Judul event" value={form.event_title} onChangeText={set("event_title")} placeholder="Non-Farm Payrolls" autoCapitalize="sentences" />
          <Field label="Mata uang" value={form.currency} onChangeText={set("currency")} placeholder="USD" autoCapitalize="characters" />
          <OptionChips
            label="Dampak"
            options={[
              { value: "HIGH", label: "HIGH" },
              { value: "MEDIUM", label: "MEDIUM" },
              { value: "LOW", label: "LOW" },
            ]}
            value={form.impact_level}
            onChange={set("impact_level")}
          />
          <Field label="Waktu rilis (WIB)" value={form.release_time} onChangeText={set("release_time")} placeholder="2026-12-05 20:30" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Field label="Forecast" value={form.forecast} onChangeText={set("forecast")} />
            <Field label="Previous" value={form.previous} onChangeText={set("previous")} />
            <Field label="Actual" value={form.actual} onChangeText={set("actual")} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title="Batal" variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
            <Button title="Simpan" onPress={submit} loading={saving} style={{ flex: 1 }} />
          </View>
        </Card>
      )}
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!data && !error && <SkeletonPage variant="list" />}
      {data && data.length === 0 && (
        <Card>
          <T variant="bodySm" color="textMuted">Belum ada berita.</T>
        </Card>
      )}
      {data?.map((n) => (
        <Card key={n.id}>
          <View style={styles.head}>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="bodySm" style={{ fontWeight: "700" }}>{n.currency} · {n.event_title}</T>
              <T variant="caption" color="textMuted">{formatDateTimeWib(n.release_time)} WIB</T>
            </View>
            <Pressable onPress={() => remove(n)} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
          <Badge label={n.impact_level} tone={TONE[n.impact_level] ?? "muted"} />
          <T variant="caption" color="textSecondary">
            Actual {n.actual ?? "-"} · Forecast {n.forecast ?? "-"} · Previous {n.previous ?? "-"}
          </T>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ head: { flexDirection: "row", alignItems: "center", gap: 10 } });
