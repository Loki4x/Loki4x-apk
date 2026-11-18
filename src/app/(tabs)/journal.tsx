import { useCallback, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { DisciplineCard } from "@/components/DisciplineCard";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { WEB_URL } from "@/lib/config";
import { formatMoney, formatPnl, todayWib } from "@/lib/format";
import { fetchAccounts, fetchTrades, getActiveAccountId, setActiveAccountId } from "@/lib/journal";
import { computeDiscipline } from "@/shared/discipline";
import { EMOTION_LABEL, isEmotion } from "@/shared/journal-tags";
import type { Trade, TradingAccount } from "@/shared/journal-types";

const SESSION_LABEL: Record<string, string> = { LONDON: "London", NEW_YORK: "New York", ASIA: "Asia", OVERLAP: "Overlap" };

interface GroupRow {
  key: string;
  count: number;
  winRate: number;
  pnl: number;
}

function groupBy(closed: Trade[], keyOf: (t: Trade) => string | null): GroupRow[] {
  const map = new Map<string, { count: number; wins: number; pnl: number }>();
  for (const t of closed) {
    const k = keyOf(t);
    if (!k) continue;
    const g = map.get(k) ?? { count: 0, wins: 0, pnl: 0 };
    g.count++;
    if ((t.pnl ?? 0) > 0) g.wins++;
    g.pnl += t.pnl ?? 0;
    map.set(k, g);
  }
  return Array.from(map.entries())
    .map(([key, g]) => ({ key, count: g.count, winRate: (g.wins / g.count) * 100, pnl: g.pnl }))
    .sort((a, b) => b.count - a.count);
}

export default function JournalScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState<TradingAccount[] | null>(null);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  // Ref supaya load() tidak dibuat ulang (dan memuat dua kali) setiap akun aktif berganti.
  const activeRef = useRef<string | null>(null);
  const setActiveId = (id: string) => {
    activeRef.current = id;
    setActiveIdState(id);
  };
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const allowed = hasAccess(profile?.effectiveTier, "MEMBERSHIP");
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!allowed || !userId) return;
    try {
      const list = await fetchAccounts(userId);
      setAccounts(list);
      if (list.length === 0) {
        setTrades([]);
        return;
      }
      const saved = await getActiveAccountId();
      const current = list.find((a) => a.id === (activeRef.current ?? saved)) ?? list[0];
      setActiveId(current.id);
      setTrades(await fetchTrades(userId, current.id));
      setError(null);
    } catch {
      setError("Jurnal belum bisa dimuat. Tarik ke bawah untuk mencoba lagi.");
    }
  }, [allowed, userId]);

  // Muat ulang setiap kali tab dibuka (mis. setelah menambah/mengedit trade).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const account = accounts?.find((a) => a.id === activeId) ?? null;

  const view = useMemo(() => {
    if (!account || !trades) return null;
    const closed = trades.filter((t) => t.status === "CLOSED" && t.pnl !== null);
    const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
    const losses = closed.filter((t) => (t.pnl ?? 0) < 0);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const grossWin = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
    const today = todayWib();
    return {
      balance: account.initial_balance + totalPnl,
      totalPnl,
      todayPnl: closed.filter((t) => t.trade_date === today).reduce((s, t) => s + (t.pnl ?? 0), 0),
      winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? grossWin : 0,
      count: trades.length,
      discipline: computeDiscipline(account, trades, today),
      bySession: groupBy(closed, (t) => (t.session ? SESSION_LABEL[t.session] ?? t.session : null)),
      byStrategy: groupBy(closed, (t) => t.strategy),
      byEmotion: groupBy(closed, (t) => (t.emotion && isEmotion(t.emotion) ? EMOTION_LABEL[t.emotion] : null)),
      byPlan: groupBy(closed, (t) => (t.followed_plan === true ? "Sesuai rencana" : t.followed_plan === false ? "Melanggar rencana" : null)),
      recent: [...trades].reverse(),
    };
  }, [account, trades]);

  async function selectAccount(id: string) {
    if (!userId || id === activeId) return;
    setActiveId(id);
    setTrades(null);
    await setActiveAccountId(id);
    try {
      setTrades(await fetchTrades(userId, id));
    } catch {
      setError("Trade akun ini belum bisa dimuat.");
    }
  }

  if (!allowed) {
    return (
      <Screen>
        <T variant="h2">Trading Journal</T>
        <Card style={{ borderColor: colors.primary }}>
          <T variant="h3">Khusus Membership 🔒</T>
          <T variant="bodySm" color="textSecondary">
            Catat trade, pasang aturan risiko & target, lihat statistik, dan import statement MT4/MT5.
          </T>
          <Button title="Upgrade di web" onPress={() => Linking.openURL(`${WEB_URL}/upgrade`)} />
        </Card>
      </Screen>
    );
  }

  const cur = account?.currency ?? "USD";

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <T variant="h2">Trading Journal</T>

      {error && <T variant="bodySm" color="error">{error}</T>}

      {accounts && accounts.length === 0 && (
        <Card>
          <T variant="bodySm" color="textSecondary">
            Belum ada akun journaling. Buka halaman Journal di web sekali, akun pertama dibuat otomatis.
          </T>
          <Button title="Buka Journal di web" variant="secondary" onPress={() => Linking.openURL(`${WEB_URL}/trades`)} />
        </Card>
      )}

      {accounts && accounts.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {accounts.map((a) => {
            const active = a.id === activeId;
            return (
              <Pressable
                key={a.id}
                onPress={() => selectAccount(a.id)}
                style={[
                  styles.chip,
                  { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySubtle : colors.surface },
                ]}
              >
                <T variant="bodySm" style={{ fontWeight: "600", color: active ? colors.primary : colors.textSecondary }}>{a.name}</T>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {account && !view && <T variant="bodySm" color="textMuted">Memuat jurnal…</T>}

      {account && view && (
        <>
          <Card style={styles.kpis}>
            {[
              { label: "Balance", value: formatMoney(view.balance, cur), color: colors.text },
              { label: "Total P&L", value: formatPnl(view.totalPnl, cur), color: view.totalPnl >= 0 ? colors.success : colors.error },
              { label: "P&L hari ini", value: formatPnl(view.todayPnl, cur), color: view.todayPnl >= 0 ? colors.success : colors.error },
              { label: "Win rate", value: `${view.winRate.toFixed(1)}%`, color: colors.text },
              { label: "Profit factor", value: view.profitFactor.toFixed(2), color: colors.text },
              { label: "Total trade", value: String(view.count), color: colors.text },
            ].map((k) => (
              <View key={k.label} style={styles.kpi}>
                <T variant="caption" color="textMuted">{k.label}</T>
                <T style={{ fontWeight: "700", color: k.color, fontVariant: ["tabular-nums"] }}>{k.value}</T>
              </View>
            ))}
          </Card>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title="+ Tambah trade" onPress={() => router.push(`/trade/new?account=${account.id}`)} style={{ flex: 1 }} />
            <Button title="Import" variant="secondary" onPress={() => router.push(`/journal-import?account=${account.id}`)} style={{ flex: 1 }} />
          </View>

          <DisciplineCard summary={view.discipline} currency={cur} onEdit={() => router.push(`/journal-rules?account=${account.id}`)} />

          {[
            { title: "Per sesi", rows: view.bySession },
            { title: "Per strategi", rows: view.byStrategy },
            { title: "Per emosi", rows: view.byEmotion },
            { title: "Sesuai rencana vs melanggar", rows: view.byPlan },
          ]
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <Card key={g.title} style={{ gap: 6 }}>
                <T variant="label" color="textMuted">{g.title}</T>
                {g.rows.slice(0, 6).map((r) => (
                  <View key={r.key} style={styles.groupRow}>
                    <T variant="bodySm" style={{ flex: 1 }} numberOfLines={1}>{r.key}</T>
                    <T variant="caption" color="textMuted" style={{ width: 54, textAlign: "right" }}>{r.count} trade</T>
                    <T variant="caption" style={{ width: 44, textAlign: "right", fontWeight: "700", color: r.winRate >= 50 ? colors.success : colors.error }}>
                      {r.winRate.toFixed(0)}%
                    </T>
                    <T variant="caption" style={{ width: 86, textAlign: "right", fontWeight: "700", color: r.pnl >= 0 ? colors.success : colors.error }}>
                      {formatPnl(r.pnl, cur)}
                    </T>
                  </View>
                ))}
              </Card>
            ))}

          <T variant="label" color="textMuted">Riwayat trade</T>
          {view.recent.length === 0 ? (
            <Card>
              <T variant="bodySm" color="textMuted">Belum ada trade. Tekan "+ Tambah trade" atau import statement MT4/MT5.</T>
            </Card>
          ) : (
            view.recent.slice(0, 100).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/trade/${t.id}`)}
                style={({ pressed }) => [styles.trade, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <T style={{ fontWeight: "700" }}>{t.symbol}</T>
                    <Badge label={t.side} tone={t.side === "BUY" ? "success" : "error"} />
                    {t.status === "OPEN" && <Badge label="Open" tone="primary" />}
                    {t.followed_plan === false && <Badge label="Melanggar rencana" tone="warning" />}
                  </View>
                  <T variant="caption" color="textMuted">
                    {t.trade_date}
                    {t.strategy ? ` · ${t.strategy}` : ""}
                    {t.emotion && isEmotion(t.emotion) ? ` · ${EMOTION_LABEL[t.emotion]}` : ""}
                  </T>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {t.pnl !== null && (
                    <T style={{ fontWeight: "700", color: t.pnl >= 0 ? colors.success : colors.error, fontVariant: ["tabular-nums"] }}>
                      {formatPnl(t.pnl, cur)}
                    </T>
                  )}
                  {t.pips !== null && <T variant="caption" color="textMuted">{t.pips > 0 ? "+" : ""}{t.pips} pips</T>}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))
          )}
          {view.recent.length > 100 && (
            <T variant="caption" color="textMuted" style={{ textAlign: "center" }}>
              Menampilkan 100 trade terbaru. Riwayat lengkap & export CSV ada di Journal web.
            </T>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kpi: { flexBasis: "29%", flexGrow: 1, gap: 2 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  trade: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
});
