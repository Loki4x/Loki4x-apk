import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { formatDate } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { compactNumber, fetchCotHistory, type CotHistoryPoint } from "@/lib/market";

/** Histori COT mingguan satu aset (52 minggu). */
export default function CotHistoryScreen() {
  const { asset } = useLocalSearchParams<{ asset: string }>();
  const label = String(asset ?? "").toUpperCase();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [points, setPoints] = useState<CotHistoryPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = hasAccess(profile?.effectiveTier, "VIP");

  useEffect(() => {
    if (!allowed || !label) return;
    fetchCotHistory(label)
      .then(setPoints)
      .catch((err) => setError(friendlyApiError(err)));
  }, [allowed, label]);

  if (!session) return <Redirect href="/login" />;
  if (!allowed) return <Redirect href="/cot" />;

  const sorted = [...(points ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)); // terbaru dulu
  const latest = sorted[0];
  const min = sorted.length ? Math.min(...sorted.map((p) => p.longPct)) : 0;
  const max = sorted.length ? Math.max(...sorted.map((p) => p.longPct)) : 0;
  const net4 = sorted.slice(0, 4).reduce((s, p) => s + p.netChangePct, 0);

  return (
    <Screen>
      <BackHeader title={`COT · ${label}`} fallback="/cot" />
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!points && !error && <SkeletonPage variant="kpi" />}
      {points && points.length === 0 && <T variant="bodySm" color="textMuted">Data histori belum tersedia.</T>}

      {latest && (
        <View style={styles.stats}>
          {[
            { label: "Long % saat ini", value: `${latest.longPct.toFixed(1)}%`, color: colors.text },
            { label: "Rentang long % periode", value: `${min.toFixed(0)}–${max.toFixed(0)}%`, color: colors.text },
            { label: "Net change · 4 mgg", value: `${net4 > 0 ? "+" : ""}${net4.toFixed(1)}%`, color: net4 >= 0 ? colors.success : colors.error },
          ].map((s) => (
            <Card key={s.label} style={styles.stat}>
              <T variant="caption" color="textMuted">{s.label}</T>
              <T variant="h3" style={{ color: s.color }}>{s.value}</T>
            </Card>
          ))}
        </View>
      )}

      {sorted.length > 0 && (
        <Card style={{ gap: 10 }}>
          <T variant="label" color="textMuted">Posisi mingguan · {sorted.length} minggu</T>
          {sorted.map((p, i) => (
            <View key={p.date} style={{ gap: 4 }}>
              <View style={styles.between}>
                <T variant="caption" color={i === 0 ? "primary" : "textSecondary"} style={{ fontWeight: i === 0 ? "700" : "400" }}>
                  {formatDate(p.date)}
                  {i === 0 ? " · Terbaru" : ""}
                </T>
                <T variant="caption" style={{ fontWeight: "700", color: p.netChangePct >= 0 ? colors.success : colors.error }}>
                  {p.netChangePct > 0 ? "+" : ""}
                  {p.netChangePct.toFixed(1)}%
                </T>
              </View>
              <View style={[styles.bar, { backgroundColor: colors.errorSubtle }]}>
                <View style={{ width: `${p.longPct}%`, backgroundColor: colors.success, borderRadius: 99 }} />
              </View>
              <T variant="caption" color="textMuted">
                Long {p.longPct.toFixed(1)}% · Net {compactNumber(p.netPos)}
              </T>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, padding: 12, gap: 2 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bar: { height: 8, borderRadius: 99, overflow: "hidden", flexDirection: "row" },
});
