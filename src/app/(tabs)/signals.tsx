import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Card, Screen, T } from "@/components/ui";
import { SignalCard } from "@/components/SignalCard";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { fetchSignals } from "@/lib/signals";
import { computeSignalStats, isTerminalStatus } from "@/shared/signal-metrics";
import type { Signal, SignalType } from "@/shared/signal-types";

type PositionTab = "ACTIVE" | "DONE";

function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surface2 }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <T variant="bodySm" style={{ fontWeight: "600", color: active ? colors.text : colors.textSecondary }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SignalsScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<PositionTab>("ACTIVE");
  const [type, setType] = useState<SignalType>("REGULAR");

  const allowed = hasAccess(profile?.effectiveTier, "VIP");

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      setSignals(await fetchSignals());
      setError(null);
    } catch {
      setError("Sinyal belum bisa dimuat. Tarik ke bawah untuk mencoba lagi.");
    }
  }, [allowed]);

  // Muat ulang setiap kali tab dibuka (mis. setelah membuka notifikasi sinyal).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const ofType = useMemo(() => (signals ?? []).filter((s) => (s.signal_type ?? "REGULAR") === type), [signals, type]);
  const list = useMemo(
    () => ofType.filter((s) => (tab === "ACTIVE" ? !isTerminalStatus(s.status) : isTerminalStatus(s.status))),
    [ofType, tab]
  );
  const stats = useMemo(() => computeSignalStats(ofType), [ofType]);

  if (!allowed) {
    return (
      <Screen>
        <T variant="h2">Sinyal</T>
        <Card style={{ borderColor: colors.primary }}>
          <T variant="h3">Khusus member VIP 🔒</T>
          <T variant="bodySm" color="textSecondary">
            Sinyal trading lengkap dengan entry, TP, SL, update real-time, dan notifikasi tersedia untuk VIP & Membership.
          </T>
          <Button title="Upgrade sekarang" onPress={() => router.push("/upgrade")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T variant="h2">Sinyal</T>

      <Segmented<SignalType>
        options={[
          { key: "REGULAR", label: "Reguler" },
          { key: "NEWS", label: "News" },
        ]}
        value={type}
        onChange={setType}
      />

      <Card style={styles.stats}>
        {[
          { label: "Win rate", value: `${stats.winRate.toFixed(0)}%`, color: colors.text },
          { label: "Total pips", value: `${stats.totalPips > 0 ? "+" : ""}${stats.totalPips.toFixed(0)}`, color: stats.totalPips >= 0 ? colors.success : colors.error },
          { label: "Menang / Kalah", value: `${stats.wins} / ${stats.losses}`, color: colors.text },
          { label: "Aktif", value: String(stats.activeCount), color: colors.primary },
        ].map((s) => (
          <View key={s.label} style={styles.stat}>
            <T variant="caption" color="textMuted">{s.label}</T>
            <T style={{ fontWeight: "700", color: s.color, fontVariant: ["tabular-nums"] }}>{s.value}</T>
          </View>
        ))}
      </Card>

      <Segmented<PositionTab>
        options={[
          { key: "ACTIVE", label: "Aktif" },
          { key: "DONE", label: "Selesai" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {error ? (
        <T variant="bodySm" color="error">{error}</T>
      ) : signals === null ? (
        <T variant="bodySm" color="textMuted">Memuat sinyal…</T>
      ) : list.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 24 }}>
          <T variant="bodySm" color="textMuted">
            {tab === "ACTIVE" ? "Belum ada sinyal aktif. Kamu akan dapat notifikasi saat sinyal baru diposting." : "Belum ada sinyal selesai."}
          </T>
        </Card>
      ) : (
        list.map((s) => <SignalCard key={s.id} signal={s} onPress={() => router.push(`/signal/${s.id}`)} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: "transparent" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: { flexBasis: "45%", flexGrow: 1, gap: 2 },
});
