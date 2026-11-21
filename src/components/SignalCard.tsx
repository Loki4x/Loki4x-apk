import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, SkText, Skeleton, T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { formatPrice, STATUS_META } from "@/lib/signals";
import { daysAgo } from "@/lib/format";
import { isTerminalStatus, signalResultPips } from "@/shared/signal-metrics";
import type { Signal } from "@/shared/signal-types";

export function SignalCard({ signal, onPress }: { signal: Signal; onPress: () => void }) {
  const { colors } = useTheme();
  const meta = STATUS_META[signal.status];
  const pips = signalResultPips(signal);
  const buy = signal.side === "BUY";
  const terminal = isTerminalStatus(signal.status);

  const levels = [
    { label: "Entry", value: formatPrice(signal.entry_price, signal.symbol) },
    { label: "TP", value: formatPrice(signal.take_profit, signal.symbol) },
    { label: "SL", value: formatPrice(signal.stop_loss, signal.symbol) },
  ];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.side, { backgroundColor: buy ? colors.successSubtle : colors.errorSubtle }]}>
          <T variant="caption" style={{ color: buy ? colors.success : colors.error, fontWeight: "800" }}>
            {signal.side}
          </T>
        </View>
        <T variant="h3" style={{ flex: 1 }}>{signal.symbol}</T>
        {signal.signal_type === "NEWS" && <Badge label="NEWS" tone="warning" />}
        <Badge label={meta.label} tone={meta.tone} />
      </View>

      <View style={styles.levels}>
        {levels.map((l) => (
          <View key={l.label} style={[styles.level, { backgroundColor: colors.surface2 }]}>
            <T variant="caption" color="textMuted">{l.label}</T>
            <T variant="bodySm" style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}>{l.value}</T>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <T variant="caption" color="textMuted">{daysAgo(signal.posted_at)}</T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {pips !== null && (
            <T
              variant="bodySm"
              style={{ fontWeight: "700", color: pips >= 0 ? colors.success : colors.error, fontVariant: ["tabular-nums"] }}
            >
              {pips > 0 ? "+" : ""}
              {pips.toFixed(1)} pips{terminal ? "" : " (berjalan)"}
            </T>
          )}
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  side: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  levels: { flexDirection: "row", gap: 8 },
  level: { flex: 1, borderRadius: 10, padding: 8, gap: 2 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});

/** Kerangka SignalCard saat sinyal dimuat (ukuran sama persis dengan kartu aslinya). */
export function SignalCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Skeleton height={22} width={44} radius={8} />
        <SkText variant="h3" width="35%" style={{ flex: 0 }} />
        <View style={{ flex: 1 }} />
        <Skeleton height={20} width={64} radius={999} />
      </View>
      <View style={styles.levels}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.level, { backgroundColor: colors.surface2 }]}>
            <SkText variant="caption" width="45%" />
            <SkText variant="bodySm" width="75%" />
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <SkText variant="caption" width={70} />
        <SkText variant="bodySm" width={90} />
      </View>
    </View>
  );
}
