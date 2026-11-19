import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Screen, T } from "@/components/ui";
import { BackHeader, OptionChips } from "@/components/form";
import { Locked } from "@/components/Locked";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { formatDate } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { compactNumber, fetchCot, type CotAssetRow } from "@/lib/market";

type Sort = "LONG" | "NET";

/** Institutional Positioning (COT) — data resmi CFTC, sama dengan /cot di web. */
export default function CotScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [data, setData] = useState<{ rows: CotAssetRow[]; reportDate: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("LONG");
  const [refreshing, setRefreshing] = useState(false);
  const allowed = hasAccess(profile?.effectiveTier, "VIP");

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      setData(await fetchCot());
      setError(null);
    } catch (err) {
      setError(friendlyApiError(err));
    }
  }, [allowed]);

  useFocusEffect(
    useCallback(() => {
      if (!data) load();
    }, [load, data])
  );

  const rows = useMemo(() => {
    const list = [...(data?.rows ?? [])];
    list.sort((a, b) => (sort === "LONG" ? b.longPct - a.longPct : Math.abs(b.netChangePct) - Math.abs(a.netChangePct)));
    return list;
  }, [data, sort]);

  if (!session) return <Redirect href="/login" />;
  if (!allowed) {
    return (
      <Screen>
        <BackHeader title="COT" />
        <Locked tier="VIP" description="Pantau pergerakan arus big money. Data resmi CFTC (Commitment of Traders)." />
      </Screen>
    );
  }

  const all = data?.rows ?? [];
  const mostLong = all.length ? all.reduce((a, b) => (b.longPct > a.longPct ? b : a)) : null;
  const mostShort = all.length ? all.reduce((a, b) => (b.longPct < a.longPct ? b : a)) : null;
  const biggest = all.length ? all.reduce((a, b) => (Math.abs(b.netChangePct) > Math.abs(a.netChangePct) ? b : a)) : null;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <BackHeader title="Institutional Positioning (COT)" />
      <T variant="bodySm" color="textSecondary">Data resmi CFTC (Commitment of Traders) — dipakai juga oleh CME Group.</T>
      {data?.reportDate && <T variant="caption" color="textMuted">Terakhir diperbarui {formatDate(data.reportDate)}</T>}
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!data && !error && <T variant="bodySm" color="textMuted">Memuat…</T>}
      {data && all.length === 0 && <T variant="bodySm" color="textMuted">Data COT belum tersedia.</T>}

      {mostLong && mostShort && biggest && (
        <View style={styles.highlights}>
          {[
            { title: "Paling Long", row: mostLong, value: `${mostLong.longPct.toFixed(0)}% long`, color: colors.success },
            { title: "Paling Short", row: mostShort, value: `${mostShort.shortPct.toFixed(0)}% short`, color: colors.error },
            {
              title: "Perubahan Terbesar",
              row: biggest,
              value: `${biggest.netChangePct > 0 ? "+" : ""}${biggest.netChangePct.toFixed(1)}%`,
              color: biggest.netChangePct >= 0 ? colors.success : colors.error,
            },
          ].map((h) => (
            <Card key={h.title} style={styles.highlight}>
              <T variant="caption" color="textMuted">{h.title}</T>
              <T variant="h3">{h.row.label}</T>
              <T variant="caption" style={{ color: h.color, fontWeight: "700" }}>{h.value}</T>
            </Card>
          ))}
        </View>
      )}

      {all.length > 0 && (
        <OptionChips
          label="Posisi saat ini & perubahan minggu ini"
          options={[
            { value: "LONG", label: "Urut Long %" },
            { value: "NET", label: "Urut Net Chg" },
          ]}
          value={sort}
          onChange={setSort}
        />
      )}

      {rows.map((r) => (
        <Pressable key={r.label} onPress={() => router.push(`/cot/${r.label}`)}>
          {({ pressed }) => (
            <Card style={{ gap: 8, opacity: pressed ? 0.85 : 1 }}>
              <View style={styles.between}>
                <T variant="h3">{r.label}</T>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <T variant="caption" style={{ fontWeight: "700", color: r.netChangePct >= 0 ? colors.success : colors.error }}>
                    {r.netChangePct > 0 ? "+" : ""}
                    {r.netChangePct.toFixed(1)}% net chg
                  </T>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </View>
              <View style={[styles.bar, { backgroundColor: colors.errorSubtle }]}>
                <View style={{ width: `${r.longPct}%`, backgroundColor: colors.success, borderRadius: 99 }} />
              </View>
              <View style={styles.between}>
                <T variant="caption" color="success">Long {r.longPct.toFixed(1)}% · {compactNumber(r.long)}</T>
                <T variant="caption" color="error">Short {r.shortPct.toFixed(1)}% · {compactNumber(r.short)}</T>
              </View>
              <T variant="caption" color="textMuted">
                Δ Long {r.deltaLong > 0 ? "+" : ""}
                {compactNumber(r.deltaLong)} · Δ Short {r.deltaShort > 0 ? "+" : ""}
                {compactNumber(r.deltaShort)} · OI {compactNumber(r.openInterest)}
              </T>
            </Card>
          )}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  highlights: { flexDirection: "row", gap: 8 },
  highlight: { flex: 1, padding: 12, gap: 2 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bar: { height: 10, borderRadius: 99, overflow: "hidden", flexDirection: "row" },
});
