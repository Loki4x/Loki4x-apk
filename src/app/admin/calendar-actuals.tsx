import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { Badge, Button, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { formatDateTimeWib } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { saveActual, type ActualRow } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

/** Isi nilai Actual berita (feed Forex Factory tidak menyediakannya). Sama dengan /admin/calendar-actuals di web. */
export default function AdminCalendarActualsScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { data, error, refresh, refreshing } = useAdminData<ActualRow[]>("calendar-actuals");
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, { saving?: boolean; ok?: boolean; error?: string }>>({});

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  async function save(row: ActualRow) {
    const value = (values[row.key] ?? row.actual).trim();
    setStatus((s) => ({ ...s, [row.key]: { saving: true } }));
    try {
      await saveActual(row.key, value);
      row.actual = value;
      setStatus((s) => ({ ...s, [row.key]: { ok: true } }));
    } catch (e) {
      setStatus((s) => ({ ...s, [row.key]: { error: friendlyApiError(e) } }));
    }
  }

  const now = Date.now();

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="Actual Berita" fallback="/admin" />
      <T variant="bodySm" color="textSecondary">
        Feed Forex Factory tidak menyediakan nilai Actual. Isi di sini setelah berita rilis, dan langsung tampil di halaman Economic News member.
      </T>
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!data && !error && <SkeletonPage variant="list" count={5} />}
      {data && data.length === 0 && (
        <Card>
          <T variant="bodySm" color="textMuted">Tidak ada berita HIGH/MEDIUM dalam 4 hari terakhir.</T>
        </Card>
      )}
      {data?.map((r) => {
        const st = status[r.key] ?? {};
        const released = new Date(r.dateISO).getTime() <= now;
        const missing = released && !r.actual;
        return (
          <Card key={r.key} style={missing ? { borderColor: colors.warning } : undefined}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Badge label={r.impact} tone={r.impact === "HIGH" ? "error" : "warning"} />
              <T variant="caption" color="textMuted" style={{ flex: 1 }}>{formatDateTimeWib(r.dateISO)} WIB</T>
              {!released && <Badge label="Belum rilis" tone="muted" />}
            </View>
            <T variant="bodySm" style={{ fontWeight: "700" }}>{r.currency} · {r.title}</T>
            <T variant="caption" color="textSecondary">Forecast {r.forecast || "-"} · Previous {r.previous || "-"}</T>
            <View style={styles.row}>
              <TextInput
                value={values[r.key] ?? r.actual}
                onChangeText={(v) => {
                  setValues((s) => ({ ...s, [r.key]: v }));
                  setStatus((s) => ({ ...s, [r.key]: {} }));
                }}
                placeholder={t("Actual")}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={40}
                style={[styles.input, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text }]}
              />
              <Button title="Simpan" onPress={() => save(r)} loading={st.saving} />
            </View>
            {st.ok && <T variant="caption" color="success">Tersimpan.</T>}
            {st.error && <T variant="caption" color="error">{st.error}</T>}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
});
