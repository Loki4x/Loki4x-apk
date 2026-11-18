import { useCallback, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, Screen, T } from "@/components/ui";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { fetchSignal, formatPrice, STATUS_META, UPDATE_LABEL } from "@/lib/signals";
import { formatDateTimeWib } from "@/lib/format";
import { signalResultPips, isTerminalStatus } from "@/shared/signal-metrics";
import type { Signal, SignalUpdate } from "@/shared/signal-types";

function ImageBlock({ title, url }: { title: string; url: string }) {
  const { colors } = useTheme();
  return (
    <Card>
      <T variant="label" color="textMuted">{title}</T>
      <Pressable onPress={() => Linking.openURL(url)}>
        <Image
          source={{ uri: url }}
          style={{ width: "100%", aspectRatio: 16 / 10, borderRadius: 12, backgroundColor: colors.surface2 }}
          resizeMode="contain"
        />
      </Pressable>
      <T variant="caption" color="textMuted">Ketuk gambar untuk membuka ukuran penuh.</T>
    </Card>
  );
}

export default function SignalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [signal, setSignal] = useState<Signal | null | undefined>(undefined);
  const [updates, setUpdates] = useState<SignalUpdate[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetchSignal(String(id));
      setSignal(res.signal);
      setUpdates(res.updates);
    } catch {
      setSignal(null);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return <Redirect href="/login" />;

  const header = (
    <View style={styles.topbar}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/signals"))} hitSlop={12} style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <T style={{ fontWeight: "600" }}>Sinyal</T>
      </Pressable>
    </View>
  );

  if (!hasAccess(profile?.effectiveTier, "VIP")) {
    return (
      <Screen>
        {header}
        <T variant="bodySm" color="textSecondary">Detail sinyal khusus member VIP & Membership.</T>
      </Screen>
    );
  }

  if (signal === undefined) {
    return (
      <Screen>
        {header}
        <T variant="bodySm" color="textMuted">Memuat…</T>
      </Screen>
    );
  }
  if (signal === null) {
    return (
      <Screen>
        {header}
        <T variant="bodySm" color="textMuted">Sinyal tidak ditemukan.</T>
      </Screen>
    );
  }

  const meta = STATUS_META[signal.status];
  const buy = signal.side === "BUY";
  const pips = signalResultPips(signal);
  const rr =
    signal.take_profit !== null && signal.stop_loss !== null && signal.entry_price !== signal.stop_loss
      ? Math.abs(signal.take_profit - signal.entry_price) / Math.abs(signal.entry_price - signal.stop_loss)
      : null;

  const rows: { label: string; value: string; color?: string }[] = [
    { label: "Entry", value: formatPrice(signal.entry_price, signal.symbol) },
    { label: "Take Profit", value: formatPrice(signal.take_profit, signal.symbol), color: colors.success },
    { label: "Stop Loss", value: formatPrice(signal.stop_loss, signal.symbol), color: colors.error },
    { label: "Risk : Reward", value: rr === null ? "—" : `1 : ${rr.toFixed(2)}` },
    { label: "Risiko per trade", value: `${signal.risk_percent}%` },
  ];
  if (signal.current_price !== null) {
    rows.push({
      label: "Harga terakhir",
      value: `${formatPrice(signal.current_price, signal.symbol)}${signal.current_price_at ? ` · ${formatDateTimeWib(signal.current_price_at)}` : ""}`,
    });
  }

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {header}

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.side, { backgroundColor: buy ? colors.successSubtle : colors.errorSubtle }]}>
            <T variant="bodySm" style={{ color: buy ? colors.success : colors.error, fontWeight: "800" }}>{signal.side}</T>
          </View>
          <T variant="h2" style={{ flex: 1 }}>{signal.symbol}</T>
          <Badge label={meta.label} tone={meta.tone} />
        </View>
        {pips !== null && (
          <T variant="h3" style={{ color: pips >= 0 ? colors.success : colors.error, fontVariant: ["tabular-nums"] }}>
            {pips > 0 ? "+" : ""}
            {pips.toFixed(1)} pips {isTerminalStatus(signal.status) ? "" : "(berjalan)"}
          </T>
        )}
        <T variant="caption" color="textMuted">
          Diposting {formatDateTimeWib(signal.posted_at)} WIB
          {signal.closed_at ? ` · ditutup ${formatDateTimeWib(signal.closed_at)} WIB` : ""}
          {signal.signal_type === "NEWS" ? " · sinyal news" : ""}
        </T>
      </Card>

      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <T variant="bodySm" color="textSecondary">{r.label}</T>
            <T variant="bodySm" style={{ fontWeight: "700", color: r.color ?? colors.text, fontVariant: ["tabular-nums"] }}>{r.value}</T>
          </View>
        ))}
      </Card>

      {signal.notes ? (
        <Card>
          <T variant="label" color="textMuted">Analisa</T>
          <T variant="bodySm">{signal.notes}</T>
        </Card>
      ) : null}

      {signal.chart_image_url ? <ImageBlock title="Chart analisa" url={signal.chart_image_url} /> : null}
      {signal.result_image_url ? <ImageBlock title="Foto hasil" url={signal.result_image_url} /> : null}

      <Card>
        <T variant="label" color="textMuted">Timeline update</T>
        {updates.length === 0 ? (
          <T variant="bodySm" color="textMuted">Belum ada update untuk sinyal ini.</T>
        ) : (
          updates.map((u, i) => (
            <View key={u.id} style={styles.timelineItem}>
              <View style={{ alignItems: "center" }}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                {i < updates.length - 1 && <View style={[styles.line, { backgroundColor: colors.border }]} />}
              </View>
              <View style={{ flex: 1, paddingBottom: 12 }}>
                <T variant="bodySm" style={{ fontWeight: "700" }}>
                  {UPDATE_LABEL[u.type] ?? "Update"}
                  {u.price !== null ? ` · ${formatPrice(u.price, signal.symbol)}` : ""}
                </T>
                {u.message ? <T variant="bodySm" color="textSecondary">{u.message}</T> : null}
                <T variant="caption" color="textMuted">{formatDateTimeWib(u.created_at)} WIB</T>
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: "row", alignItems: "center" },
  back: { flexDirection: "row", alignItems: "center", gap: 2 },
  side: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, gap: 12 },
  timelineItem: { flexDirection: "row", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  line: { width: 2, flex: 1, marginTop: 2 },
});
