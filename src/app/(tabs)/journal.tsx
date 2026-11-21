import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, SkCard, SkText, Skeleton, T } from "@/components/ui";
import { DisciplineCard } from "@/components/DisciplineCard";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { formatMoney, formatPnl, todayWib } from "@/lib/format";
import { exportTradesCsv, fetchAccounts, fetchTrades, getActiveAccountId, setActiveAccountId } from "@/lib/journal";
import { computeDiscipline } from "@/shared/discipline";
import { EMOTION_LABEL, isEmotion } from "@/shared/journal-tags";
import type { Trade, TradingAccount } from "@/shared/journal-types";
import { useI18n } from "@/lib/i18n";

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
  const { t: tx } = useI18n();
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
  const [exporting, setExporting] = useState(false);
  // Cari & filter riwayat trade (sama dengan tabel Journal di web).
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [strategyFilter, setStrategyFilter] = useState<string>("ALL");
  const [showFilters, setShowFilters] = useState(false);

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
      byEmotion: groupBy(closed, (t) => (t.emotion && isEmotion(t.emotion) ? tx(EMOTION_LABEL[t.emotion]) : null)),
      byPlan: groupBy(closed, (t) => (t.followed_plan === true ? tx("Sesuai rencana") : t.followed_plan === false ? tx("Melanggar rencana") : null)),
      recent: [...trades].reverse(),
    };
  }, [account, trades, tx]);

  const strategies = useMemo(
    () => Array.from(new Set((trades ?? []).map((t) => t.strategy).filter((x): x is string => !!x))).sort(),
    [trades]
  );
  const filtered = useMemo(() => {
    if (!view) return [];
    const q = search.trim().toLowerCase();
    return view.recent.filter(
      (t) =>
        (!q || t.symbol.toLowerCase().includes(q)) &&
        (sideFilter === "ALL" || t.side === sideFilter) &&
        (statusFilter === "ALL" || t.status === statusFilter) &&
        (strategyFilter === "ALL" || t.strategy === strategyFilter)
    );
  }, [view, search, sideFilter, statusFilter, strategyFilter]);
  const filtering = !!search.trim() || sideFilter !== "ALL" || statusFilter !== "ALL" || strategyFilter !== "ALL";

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
          <Button title="Upgrade sekarang" onPress={() => router.push("/upgrade")} />
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
            Belum ada akun journaling. Buat akun pertama kamu untuk mulai mencatat trade.
          </T>
          <Button title="+ Buat akun journaling" onPress={() => router.push("/journal-accounts")} />
        </Card>
      )}

      {accounts && accounts.length > 0 && (
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
          <Pressable
            onPress={() => router.push("/journal-accounts")}
            style={[styles.chip, styles.manage, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Ionicons name="settings-outline" size={14} color={colors.textSecondary} />
            <T variant="bodySm" style={{ fontWeight: "600" }} color="textSecondary">Kelola akun</T>
          </Pressable>
        </ScrollView>
      )}

      {!accounts && !error && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Skeleton height={34} width={110} radius={999} />
          <Skeleton height={34} width={120} radius={999} />
        </View>
      )}
      {(!accounts || (account && !view)) && !error && <JournalSkeleton />}

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

          <Button title="+ Tambah trade" onPress={() => router.push(`/trade/new?account=${account.id}`)} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title="Import" variant="secondary" onPress={() => router.push(`/journal-import?account=${account.id}`)} style={{ flex: 1 }} />
            <Button
              title="Export CSV"
              variant="secondary"
              loading={exporting}
              disabled={!trades || trades.length === 0}
              onPress={async () => {
                if (!trades) return;
                setExporting(true);
                try {
                  await exportTradesCsv(account.name, trades);
                } catch {
                  setError("Export gagal. Coba lagi.");
                } finally {
                  setExporting(false);
                }
              }}
              style={{ flex: 1 }}
            />
          </View>

          <Button title="📊 Report & Performance" variant="secondary" onPress={() => router.push(`/reports?account=${account.id}`)} />

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

          <View style={styles.histHead}>
            <T variant="label" color="textMuted" style={{ flex: 1 }}>Riwayat trade</T>
            <Pressable onPress={() => setShowFilters((v) => !v)} hitSlop={8} style={styles.filterBtn}>
              <Ionicons name="options-outline" size={16} color={filtering ? colors.primary : colors.textSecondary} />
              <T variant="caption" style={{ fontWeight: "700", color: filtering ? colors.primary : colors.textSecondary }}>Filter</T>
            </Pressable>
          </View>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={tx("Cari simbol…")}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ flex: 1, color: colors.text, paddingVertical: 9 }}
            />
            {!!search && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          {showFilters && (
            <Card style={{ gap: 10 }}>
              <FilterRow
                label="Arah"
                value={sideFilter}
                onChange={setSideFilter}
                options={[
                  { value: "ALL", label: "Semua" },
                  { value: "BUY", label: "Buy" },
                  { value: "SELL", label: "Sell" },
                ]}
              />
              <FilterRow
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "ALL", label: "Semua" },
                  { value: "OPEN", label: "Open" },
                  { value: "CLOSED", label: "Closed" },
                ]}
              />
              {strategies.length > 0 && (
                <FilterRow
                  label="Strategi"
                  value={strategyFilter}
                  onChange={setStrategyFilter}
                  options={[{ value: "ALL", label: "Semua" }, ...strategies.map((x) => ({ value: x, label: x }))]}
                />
              )}
              {filtering && (
                <T
                  variant="caption"
                  color="primary"
                  style={{ fontWeight: "700" }}
                  onPress={() => {
                    setSearch("");
                    setSideFilter("ALL");
                    setStatusFilter("ALL");
                    setStrategyFilter("ALL");
                  }}
                >
                  Reset filter
                </T>
              )}
            </Card>
          )}
          {filtering && <T variant="caption" color="textMuted">{tx("{n} dari {total} trade", { n: filtered.length, total: view.recent.length })}</T>}
          {view.recent.length === 0 ? (
            <Card>
              <T variant="bodySm" color="textMuted">Belum ada trade. Tekan "+ Tambah trade" atau import statement MT4/MT5.</T>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <T variant="bodySm" color="textMuted">Tidak ada trade yang cocok dengan filter.</T>
            </Card>
          ) : (
            filtered.slice(0, 100).map((t) => (
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
                    {t.emotion && isEmotion(t.emotion) ? ` · ${tx(EMOTION_LABEL[t.emotion])}` : ""}
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
          {filtered.length > 100 && (
            <T variant="caption" color="textMuted" style={{ textAlign: "center" }}>
              Menampilkan 100 trade terbaru. Semua trade ikut ter-export di Export CSV.
            </T>
          )}
        </>
      )}
    </Screen>
  );
}

function FilterRow<V extends string>({ label, value, onChange, options }: { label: string; value: V; onChange: (v: V) => void; options: { value: V; label: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="caption" color="textMuted">{label}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[styles.chip, { paddingVertical: 5, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySubtle : colors.surface2 }]}
            >
              <T variant="caption" style={{ fontWeight: "700", color: active ? colors.primary : colors.textSecondary }}>{o.label}</T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Kerangka tab Journal: sama persis dengan susunan KPI, tombol, disiplin, dan riwayat trade. */
function JournalSkeleton() {
  const { colors } = useTheme();
  return (
    <>
      <SkCard style={styles.kpis}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={styles.kpi}>
            <SkText variant="caption" width="60%" />
            <SkText variant="body" width="80%" />
          </View>
        ))}
      </SkCard>
      <Skeleton height={48} radius={999} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Skeleton height={48} radius={999} style={{ flex: 1 }} />
        <Skeleton height={48} radius={999} style={{ flex: 1 }} />
      </View>
      <Skeleton height={48} radius={999} />
      <SkCard>
        <SkText variant="label" width="35%" />
        <SkText variant="bodySm" width="70%" />
        <Skeleton height={8} radius={99} />
        <SkText variant="bodySm" width="55%" />
        <Skeleton height={8} radius={99} />
      </SkCard>
      <SkText variant="label" width="30%" />
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.trade, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <SkText variant="body" width={70} />
              <Skeleton height={18} width={40} radius={999} />
            </View>
            <SkText variant="caption" width="50%" />
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <SkText variant="body" width={60} />
            <SkText variant="caption" width={44} />
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  manage: { flexDirection: "row", alignItems: "center", gap: 5, borderStyle: "dashed" },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kpi: { flexBasis: "29%", flexGrow: 1, gap: 2 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  histHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  trade: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
});
