import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, SkCard, SkText, Skeleton, T } from "@/components/ui";
import { MarketSessionsCard } from "@/components/MarketSessionsCard";
import { ToolsGrid } from "@/components/ToolsGrid";
import { EquityChart } from "@/components/EquityChart";
import { DisciplineCard } from "@/components/DisciplineCard";
import { unreadCount } from "@/lib/notifications";
import { hasAccess, useAuth, type Tier } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatDayWib, formatMoney, formatPnl, formatTimeWib, type Currency } from "@/lib/format";
import type { DisciplineSummary } from "@/shared/discipline";

interface Trading {
  accountId: string;
  accountName: string;
  currency: Currency;
  balance: number;
  totalPnl: number;
  todayPnl: number;
  winRate: number;
  closedTrades: number;
  equity: { date: string; balance: number }[];
  topPairs: { symbol: string; pnl: number }[];
  discipline: DisciplineSummary;
}

interface Dashboard {
  onboarding: { key: "trade" | "upgrade"; label: string; description: string; done: boolean }[];
  history: {
    id: string;
    kind: "VIP_IB" | "PAYMENT";
    title: string;
    status: string;
    created_at: string;
    amount: number | null;
    currency: string | null;
    reason: string | null;
  }[];
  trading: Trading | null;
  market: {
    cot: { positive: { label: string; netChangePct: number }[]; negative: { label: string; netChangePct: number }[]; reportDate: string | null };
    longTop: { symbol: string; percent: number }[];
    shortTop: { symbol: string; percent: number }[];
  } | null;
}

interface NewsEvent {
  id: string;
  title: string;
  currency: string;
  dateISO: string;
  forecast: string;
  previous: string;
}

const TIER_LABEL: Record<Tier, string> = { FREE: "Free", VIP: "VIP", MEMBERSHIP: "Membership" };
const PLAN_LABEL: Record<string, string> = { VIP: "VIP", MEMBERSHIP: "Membership", MEMBERSHIP_LIFETIME: "Membership Lifetime", "VIP via IB": "VIP via IB" };
const STATUS: Record<string, { label: string; tone: "warning" | "success" | "error" | "muted" }> = {
  PENDING: { label: "Menunggu", tone: "warning" },
  APPROVED: { label: "Disetujui", tone: "success" },
  COMPLETED: { label: "Berhasil", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "error" },
  FAILED: { label: "Ditolak", tone: "error" },
  EXPIRED: { label: "Kedaluwarsa", tone: "muted" },
};

function CardHeader({ icon, title, right, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; right?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.cardHeader}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <T style={{ fontWeight: "600", flex: 1 }}>{title}</T>
      {right ? <T variant="caption" color="textMuted">{right}</T> : null}
      {onPress && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
    </Pressable>
  );
}

/** Kerangka kartu Ringkasan Trading (KPI + kurva saldo), ukurannya sama dengan kartu aslinya. */
function TradingSkeleton() {
  const { colors } = useTheme();
  return (
    <>
      <SkCard>
        <View style={styles.cardHeader}>
          <Skeleton height={16} width={16} radius={4} />
          <SkText variant="body" width="40%" />
          <View style={{ flex: 1 }} />
          <SkText variant="caption" width={70} />
        </View>
        <View style={styles.kpis}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.kpi, { backgroundColor: colors.surface2 }]}>
              <SkText variant="caption" width="55%" />
              <SkText variant="body" width="75%" />
            </View>
          ))}
          <SkText variant="caption" width="30%" />
        </View>
      </SkCard>
      <SkCard>
        <View style={styles.cardHeader}>
          <Skeleton height={16} width={16} radius={4} />
          <SkText variant="body" width="35%" />
        </View>
        <SkText variant="caption" width="25%" />
        <Skeleton height={150} radius={12} />
        <SkText variant="caption" width="100%" />
      </SkCard>
    </>
  );
}

function NewsSkeleton() {
  const { colors } = useTheme();
  return (
    <>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.newsRow, { borderTopColor: colors.border }]}>
          <View style={{ width: 70 }}>
            <SkText variant="caption" width="80%" />
            <SkText variant="bodySm" width="60%" />
          </View>
          <View style={{ flex: 1 }}>
            <SkText variant="bodySm" width="85%" />
            <SkText variant="caption" width="50%" />
          </View>
        </View>
      ))}
    </>
  );
}

export default function DashboardScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashError, setDashError] = useState(false);
  const [news, setNews] = useState<NewsEvent[] | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const tier = profile?.effectiveTier ?? "FREE";
  const isMember = hasAccess(tier, "MEMBERSHIP");

  const load = useCallback(async () => {
    if (!session) return;
    const [d, n] = await Promise.allSettled([
      apiGet<Dashboard>("/api/mobile/dashboard"),
      isMember ? apiGet<{ events: NewsEvent[] }>("/api/mobile/calendar") : Promise.resolve(null),
    ]);
    if (d.status === "fulfilled") {
      setDash(d.value);
      setDashError(false);
    } else {
      setDashError(true);
    }
    if (n.status === "fulfilled") {
      if (n.value) setNews(n.value.events);
      setNewsError(null);
    } else {
      setNewsError("Kalender belum bisa dimuat.");
    }
  }, [session, isMember]);

  // Data & jumlah notifikasi diperbarui tiap tab Beranda dibuka.
  useFocusEffect(
    useCallback(() => {
      if (session) unreadCount(session.user.id).then(setUnread).catch(() => {});
      load();
    }, [session, load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshProfile(), load()]);
    setRefreshing(false);
  }

  const name = profile?.full_name?.split(" ")[0] ?? "Trader";
  const expiry = profile?.vip_expires_at && tier !== "FREE" ? formatDate(profile.vip_expires_at) : null;
  const trading = dash?.trading ?? null;
  const onboardingTodo = dash ? dash.onboarding.some((s) => !s.done) : false;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.greeting}>
        <View style={{ flex: 1 }}>
          <T variant="bodySm" color="textSecondary">Selamat datang kembali</T>
          <T variant="h2">Halo, {name} 👋</T>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Badge label={TIER_LABEL[tier]} tone={tier === "FREE" ? "muted" : "primary"} />
          {expiry && <T variant="caption" color="textMuted">aktif s/d {expiry}</T>}
        </View>
        <Pressable onPress={() => router.push("/notifications")} hitSlop={10} style={[styles.bell, { backgroundColor: colors.surface2 }]}>
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {unread > 0 && (
            <View style={[styles.badgeDot, { backgroundColor: colors.error }]}>
              <T variant="caption" style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>{unread > 9 ? "9+" : String(unread)}</T>
            </View>
          )}
        </Pressable>
      </View>

      {!isMember && (
        <Card style={{ borderColor: colors.primary }}>
          <T variant="h3">Buka semua fitur 🚀</T>
          <T variant="bodySm" color="textSecondary">
            Upgrade ke Membership untuk Trading Journal, kalender news, sinyal, dan Akademi.
          </T>
          <Button title="Upgrade sekarang" onPress={() => router.push("/upgrade")} />
        </Card>
      )}

      <MarketSessionsCard />

      {dash && onboardingTodo && (
        <Card>
          <CardHeader icon="flag-outline" title="Langkah Awal" right={`${dash.onboarding.filter((s) => s.done).length}/${dash.onboarding.length}`} />
          {dash.onboarding.map((s) => (
            <Pressable
              key={s.key}
              disabled={s.done}
              onPress={() =>
                s.key === "upgrade"
                  ? router.push("/upgrade")
                  : trading
                    ? router.push(`/trade/new?account=${trading.accountId}`)
                    : router.push("/journal")
              }
              style={[styles.step, { backgroundColor: colors.surface2, opacity: s.done ? 0.7 : 1 }]}
            >
              <Ionicons name={s.done ? "checkmark-circle" : "ellipse-outline"} size={22} color={s.done ? colors.success : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <T variant="bodySm" style={{ fontWeight: "600", textDecorationLine: s.done ? "line-through" : "none" }}>{s.label}</T>
                <T variant="caption" color="textMuted">{s.description}</T>
              </View>
              {!s.done && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
            </Pressable>
          ))}
        </Card>
      )}

      <ToolsGrid tier={tier} />

      {isMember && !dash && !dashError && <TradingSkeleton />}
      {isMember && dashError && !dash && (
        <Card>
          <T variant="bodySm" color="textMuted">Ringkasan belum bisa dimuat. Tarik ke bawah untuk mencoba lagi.</T>
        </Card>
      )}

      {isMember && trading && (
        <>
          <Card>
            <CardHeader icon="wallet-outline" title="Ringkasan Trading" right={trading.accountName} onPress={() => router.push("/journal")} />
            <View style={styles.kpis}>
              {[
                { label: "Balance", value: formatMoney(trading.balance, trading.currency), color: colors.text },
                { label: "Total P&L", value: formatPnl(trading.totalPnl, trading.currency), color: trading.totalPnl >= 0 ? colors.success : colors.error },
                { label: "P&L hari ini", value: formatPnl(trading.todayPnl, trading.currency), color: trading.todayPnl >= 0 ? colors.success : colors.error },
                { label: "Win rate", value: `${trading.winRate.toFixed(1)}%`, color: colors.text },
              ].map((k) => (
                <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surface2 }]}>
                  <T variant="caption" color="textMuted">{k.label}</T>
                  <T style={{ color: k.color, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{k.value}</T>
                </View>
              ))}
              <T variant="caption" color="textMuted">{t("{n} trade tertutup", { n: trading.closedTrades })}</T>
            </View>
          </Card>

          <Card>
            <CardHeader icon="trending-up-outline" title="Kurva saldo" />
            <EquityChart data={trading.equity} currency={trading.currency} />
          </Card>

          <Card>
            <CardHeader icon="trophy-outline" title="Top Pairs" onPress={() => router.push(`/reports?account=${trading.accountId}`)} />
            {trading.topPairs.length === 0 ? (
              <T variant="bodySm" color="textMuted">Belum ada trade tertutup.</T>
            ) : (
              trading.topPairs.map((p, i) => (
                <View key={p.symbol} style={[styles.row, { borderTopColor: colors.border }]}>
                  <T variant="caption" color="textMuted" style={{ width: 18 }}>{i + 1}</T>
                  <T variant="bodySm" style={{ flex: 1, fontWeight: "600" }}>{p.symbol}</T>
                  <T variant="bodySm" style={{ fontWeight: "700", color: p.pnl >= 0 ? colors.success : colors.error }}>{formatPnl(p.pnl, trading.currency)}</T>
                </View>
              ))
            )}
          </Card>

          <DisciplineCard summary={trading.discipline} currency={trading.currency} onEdit={() => router.push(`/journal-rules?account=${trading.accountId}`)} />
        </>
      )}
      {isMember && dash && !trading && (
        <Card>
          <T variant="bodySm" color="textMuted">Belum ada akun journaling. Buat dulu di tab Journal.</T>
        </Card>
      )}

      {dash?.market && (
        <Card>
          <CardHeader icon="analytics-outline" title="Sorotan Pasar" right={dash.market.cot.reportDate ? `COT ${formatDate(dash.market.cot.reportDate)}` : undefined} />
          <View style={styles.twoCol}>
            <Pressable style={{ flex: 1, gap: 4 }} onPress={() => router.push("/cot")}>
              <T variant="caption" color="textMuted">COT Net Chg % +</T>
              {dash.market.cot.positive.length === 0 && <T variant="caption" color="textMuted">Data COT belum tersedia.</T>}
              {dash.market.cot.positive.map((c) => (
                <View key={c.label} style={styles.miniRow}>
                  <T variant="bodySm" style={{ flex: 1 }} numberOfLines={1}>{c.label}</T>
                  <T variant="bodySm" color="success" style={{ fontWeight: "700" }}>+{c.netChangePct.toFixed(1)}%</T>
                </View>
              ))}
            </Pressable>
            <Pressable style={{ flex: 1, gap: 4 }} onPress={() => router.push("/cot")}>
              <T variant="caption" color="textMuted">COT Net Chg % −</T>
              {dash.market.cot.negative.map((c) => (
                <View key={c.label} style={styles.miniRow}>
                  <T variant="bodySm" style={{ flex: 1 }} numberOfLines={1}>{c.label}</T>
                  <T variant="bodySm" color="error" style={{ fontWeight: "700" }}>{c.netChangePct.toFixed(1)}%</T>
                </View>
              ))}
            </Pressable>
          </View>
          <View style={[styles.twoCol, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 }]}>
            <Pressable style={{ flex: 1, gap: 4 }} onPress={() => router.push("/positioning")}>
              <T variant="caption" color="textMuted">Retail long terbanyak</T>
              {dash.market.longTop.length === 0 && <T variant="caption" color="textMuted">Belum ada data positioning.</T>}
              {dash.market.longTop.map((r) => (
                <View key={r.symbol} style={styles.miniRow}>
                  <T variant="bodySm" style={{ flex: 1 }}>{r.symbol}</T>
                  <T variant="bodySm" color="success" style={{ fontWeight: "700" }}>{Math.round(r.percent)}%</T>
                </View>
              ))}
            </Pressable>
            <Pressable style={{ flex: 1, gap: 4 }} onPress={() => router.push("/positioning")}>
              <T variant="caption" color="textMuted">Retail short terbanyak</T>
              {dash.market.shortTop.map((r) => (
                <View key={r.symbol} style={styles.miniRow}>
                  <T variant="bodySm" style={{ flex: 1 }}>{r.symbol}</T>
                  <T variant="bodySm" color="error" style={{ fontWeight: "700" }}>{Math.round(r.percent)}%</T>
                </View>
              ))}
            </Pressable>
          </View>
          <T variant="caption" color="textMuted">Retail Bias dibaca sebagai posisi kontrarian.</T>
        </Card>
      )}

      {isMember && (
        <Card>
          <CardHeader icon="calendar-outline" title="News High Impact" right="7 hari ke depan" onPress={() => router.push("/calendar")} />
          {newsError ? (
            <T variant="bodySm" color="textMuted">{newsError}</T>
          ) : news === null ? (
            <NewsSkeleton />
          ) : news.length === 0 ? (
            <T variant="bodySm" color="textMuted">Tidak ada news high impact dalam 7 hari ke depan.</T>
          ) : (
            news.slice(0, 8).map((e) => (
              <View key={e.id} style={[styles.newsRow, { borderTopColor: colors.border }]}>
                <View style={{ width: 70 }}>
                  <T variant="caption" color="textMuted">{formatDayWib(e.dateISO)}</T>
                  <T variant="bodySm" style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}>{formatTimeWib(e.dateISO)}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="bodySm" style={{ fontWeight: "600" }}>
                    {e.currency} · {e.title}
                  </T>
                  {(e.forecast || e.previous) && (
                    <T variant="caption" color="textMuted">
                      {[e.forecast && `F: ${e.forecast}`, e.previous && `P: ${e.previous}`].filter(Boolean).join(" · ")}
                    </T>
                  )}
                </View>
              </View>
            ))
          )}
        </Card>
      )}

      {dash && dash.history.length > 0 && (
        <Card>
          <CardHeader icon="receipt-outline" title="Riwayat Pembelian" onPress={() => router.push("/upgrade")} />
          {dash.history.slice(0, 6).map((h) => {
            const st = STATUS[h.status] ?? { label: h.status, tone: "muted" as const };
            return (
              <View key={`${h.kind}-${h.id}`} style={[styles.history, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="bodySm" style={{ fontWeight: "600" }}>
                    {PLAN_LABEL[h.title] ?? h.title}
                    {h.amount !== null ? ` · ${h.currency === "USDT" ? `${h.amount} USDT` : formatMoney(h.amount, "IDR")}` : ""}
                  </T>
                  <T variant="caption" color="textMuted">{formatDate(h.created_at)}</T>
                  {h.reason && (st.tone === "error") ? <T variant="caption" color="error">{t("Alasan:")} {h.reason}</T> : null}
                </View>
                <Badge label={st.label} tone={st.tone} />
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  badgeDot: { position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  greeting: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: { flexBasis: "47%", flexGrow: 1, borderRadius: 12, padding: 12, gap: 2 },
  newsRow: { flexDirection: "row", gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  step: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 12 },
  twoCol: { flexDirection: "row", gap: 14 },
  miniRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  history: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
