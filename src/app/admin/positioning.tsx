import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, Field } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { formatDateTimeWib } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { deletePositioning, savePositioning, type AdminPositioning } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

/** Data long/short per simbol (sama dengan /admin/positioning di web). Simbol yang sama = diperbarui. */
export default function AdminPositioningScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { data, error, load, refresh, refreshing } = useAdminData<AdminPositioning[]>("positioning");
  const [symbol, setSymbol] = useState("");
  const [long, setLong] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  async function submit() {
    setSaving(true);
    setMsg(null);
    try {
      await savePositioning(symbol.trim().toUpperCase(), long.trim().replace(",", "."));
      setSymbol("");
      setLong("");
      setMsg({ ok: true, text: t("Positioning disimpan.") });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: friendlyApiError(e) });
    } finally {
      setSaving(false);
    }
  }

  function remove(p: AdminPositioning) {
    Alert.alert(t("Hapus {s}?", { s: p.symbol }), undefined, [
      { text: t("Batal"), style: "cancel" },
      {
        text: t("Hapus"),
        style: "destructive",
        onPress: async () => {
          try {
            await deletePositioning(p.id);
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
      <BackHeader title="Positioning" fallback="/admin" />
      <T variant="bodySm" color="textSecondary">Kelola data long/short per simbol.</T>
      <Card>
        <T variant="h3">Tambah / perbarui</T>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Field label="Simbol" value={symbol} onChangeText={setSymbol} placeholder="XAUUSD" autoCapitalize="characters" />
          <Field label="Long %" value={long} onChangeText={setLong} placeholder="62" keyboardType="numeric" hint={long && Number(long.replace(",", ".")) <= 100 ? `Short ${(100 - Number(long.replace(",", "."))).toFixed(0)}%` : undefined} />
        </View>
        <Button title="Simpan" onPress={submit} loading={saving} disabled={!symbol.trim() || !long.trim()} />
        {msg && <T variant="bodySm" color={msg.ok ? "success" : "error"}>{msg.text}</T>}
      </Card>
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!data && !error && <SkeletonPage variant="list" />}
      {data && data.length === 0 && (
        <Card>
          <T variant="bodySm" color="textMuted">Belum ada data.</T>
        </Card>
      )}
      {data?.map((p) => (
        <Card key={p.id}>
          <View style={styles.head}>
            <T variant="h3" style={{ flex: 1 }}>{p.symbol}</T>
            <Pressable onPress={() => { setSymbol(p.symbol); setLong(String(p.long_percent)); }} hitSlop={8}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => remove(p)} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
          <View style={[styles.bar, { backgroundColor: colors.error }]}>
            <View style={{ width: `${p.long_percent}%`, backgroundColor: colors.success }} />
          </View>
          <View style={styles.head}>
            <T variant="caption" color="success" style={{ flex: 1, fontWeight: "700" }}>Long {p.long_percent}%</T>
            <T variant="caption" color="error" style={{ fontWeight: "700" }}>Short {p.short_percent}%</T>
          </View>
          <T variant="caption" color="textMuted">{t("Diperbarui")} {formatDateTimeWib(p.updated_at)} WIB</T>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  bar: { height: 10, borderRadius: 5, overflow: "hidden", flexDirection: "row" },
});
