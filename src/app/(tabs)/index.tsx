import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { MarketSessionsCard } from "@/components/MarketSessionsCard";
import { ToolsGrid } from "@/components/ToolsGrid";
import { unreadCount } from "@/lib/notifications";
import { hasAccess, useAuth, type Tier } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiGet } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { formatDate, formatDayWib, formatMoney, formatPnl, formatTimeWib, todayWib, type Currency } from "@/lib/format";

interface Summary {
  accountName: string;
  currency: Currency;
  balance: number;
  totalPnl: number;
  todayPnl: number;
  winRate: number;
  closedTrades: number;
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

async function loadSummary(userId: string): Promise<Summary | null> {
  const { data: accounts } = await supabase
    .from("trading_accounts")
    .select("id, name, initial_balance, currency")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  const account = accounts?.[0];
  if (!account) return null;

  const { data: trades } = await supabase
    .from("trades")
    .select("pnl, trade_date")
    .eq("user_id", userId)
    .eq("account_id", account.id)
    .eq("status", "CLOSED");

  const closed = (trades ?? []).filter((t) => t.pnl !== null).map((t) => ({ pnl: Number(t.pnl), date: t.trade_date as string }));
  const totalPnl = closed.reduce((s, t) => s + t.pnl, 0);
  const today = todayWib();
  return {
    accountName: account.name,
    currency: account.currency === "IDR" ? "IDR" : "USD",
    balance: Number(account.initial_balance) + totalPnl,
    totalPnl,
    todayPnl: closed.filter((t) => t.date === today).reduce((s, t) => s + t.pnl, 0),
    winRate: closed.length ? (closed.filter((t) => t.pnl > 0).length / closed.length) * 100 : 0,
    closedTrades: closed.length,
  };
}

export default function DashboardScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);
  const [news, setNews] = useState<NewsEvent[] | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  // Jumlah notifikasi belum dibaca diperbarui tiap tab Dashboard dibuka.
  useFocusEffect(
    useCallback(() => {
      if (session) unreadCount(session.user.id).then(setUnread).catch(() => {});
    }, [session])
  );

  const tier = profile?.effectiveTier ?? "FREE";
  const isMember = hasAccess(tier, "MEMBERSHIP");

  const load = useCallback(async () => {
    if (!session) return;
    if (!isMember) return;
    const [s, n] = await Promise.allSettled([
      loadSummary(session.user.id),
      apiGet<{ events: NewsEvent[] }>("/api/mobile/calendar"),
    ]);
    setSummary(s.status === "fulfilled" ? s.value : null);
    if (n.status === "fulfilled") {
      setNews(n.value.events);
      setNewsError(null);
    } else {
      setNewsError("Kalender belum bisa dimuat.");
    }
  }, [session, isMember]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshProfile(), load()]);
    setRefreshing(false);
  }

  const name = profile?.full_name?.split(" ")[0] ?? "Trader";
  const expiry = profile?.vip_expires_at && tier !== "FREE" ? formatDate(profile.vip_expires_at) : null;

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

      <ToolsGrid tier={tier} />

      {isMember && (
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="wallet-outline" size={16} color={colors.primary} />
            <T style={{ fontWeight: "600", flex: 1 }}>Ringkasan Trading</T>
            {summary && <T variant="caption" color="textMuted">{summary.accountName}</T>}
          </View>
          {summary === undefined ? (
            <T variant="bodySm" color="textMuted">Memuat…</T>
          ) : summary === null ? (
            <T variant="bodySm" color="textMuted">
              Belum ada akun journaling. Buat dulu di tab Journal.
            </T>
          ) : (
            <View style={styles.kpis}>
              {[
                { label: "Balance", value: formatMoney(summary.balance, summary.currency), color: colors.text },
                { label: "Total P&L", value: formatPnl(summary.totalPnl, summary.currency), color: summary.totalPnl >= 0 ? colors.success : colors.error },
                { label: "P&L hari ini", value: formatPnl(summary.todayPnl, summary.currency), color: summary.todayPnl >= 0 ? colors.success : colors.error },
                { label: "Win rate", value: `${summary.winRate.toFixed(1)}%`, color: colors.text },
              ].map((k) => (
                <View key={k.label} style={[styles.kpi, { backgroundColor: colors.surface2 }]}>
                  <T variant="caption" color="textMuted">{k.label}</T>
                  <T style={{ color: k.color, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{k.value}</T>
                </View>
              ))}
              <T variant="caption" color="textMuted">{summary.closedTrades} trade tertutup</T>
            </View>
          )}
        </Card>
      )}

      {isMember && (
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <T style={{ fontWeight: "600", flex: 1 }}>News High Impact</T>
            <T variant="caption" color="textMuted">7 hari ke depan</T>
          </View>
          {newsError ? (
            <T variant="bodySm" color="textMuted">{newsError}</T>
          ) : news === null ? (
            <T variant="bodySm" color="textMuted">Memuat…</T>
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
});
