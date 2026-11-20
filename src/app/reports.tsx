import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, ProgressBar, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { WEB_URL } from "@/lib/config";
import { formatPnl } from "@/lib/format";
import { fetchAccounts, fetchTrades, getActiveAccountId } from "@/lib/journal";
import type { Trade, TradingAccount } from "@/shared/journal-types";

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_ID = ["S", "S", "R", "K", "J", "S", "M"];
const DAYS_EN = ["M", "T", "W", "T", "F", "S", "S"];
const SESSION_LABEL: Record<string, string> = { LONDON: "London", NEW_YORK: "New York", ASIA: "Asia", OVERLAP: "Overlap" };

const monthKey = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}`;

/** "445k" / "$120" ringkas untuk sel kalender. */
function compact(value: number, currency: "USD" | "IDR") {
  const prefix = currency === "IDR" ? "Rp" : "$";
  const abs = Math.abs(Math.round(value));
  const sign = value < 0 ? "-" : "+";
  if (abs < 1000) return `${sign}${prefix}${abs}`;
  return `${sign}${prefix}${Math.round(abs / 1000)}k`;
}

/** Report & Performance (sama dengan halaman /reports di web), untuk akun journaling aktif. */
export default function ReportsScreen() {
  const params = useLocalSearchParams<{ account?: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [sharing, setSharing] = useState(false);
  const userId = session?.user.id;
  const allowed = hasAccess(profile?.effectiveTier, "MEMBERSHIP");

  const load = useCallback(async () => {
    if (!userId || !allowed) return;
    try {
      const list = await fetchAccounts(userId);
      const wanted = params.account ?? (await getActiveAccountId());
      const a = list.find((x) => x.id === wanted) ?? list[0] ?? null;
      setAccount(a);
      setTrades(a ? await fetchTrades(userId, a.id) : []);
      setError(null);
    } catch {
      setError("Report belum bisa dimuat. Tarik ke bawah untuk mencoba lagi.");
    }
  }, [userId, allowed, params.account]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const view = useMemo(() => {
    if (!trades) return null;
    const closed = trades.filter((tr) => tr.status === "CLOSED" && tr.pnl !== null);
    const wins = closed.filter((tr) => (tr.pnl ?? 0) > 0);
    const losses = closed.filter((tr) => (tr.pnl ?? 0) < 0);
    const avgWin = wins.length ? wins.reduce((s, tr) => s + (tr.pnl ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, tr) => s + (tr.pnl ?? 0), 0) / losses.length) : 0;
    const expectancy = closed.length ? (wins.length / closed.length) * avgWin - (losses.length / closed.length) * avgLoss : 0;

    const byPair = new Map<string, number>();
    for (const tr of closed) byPair.set(tr.symbol, (byPair.get(tr.symbol) ?? 0) + (tr.pnl ?? 0));
    const pairs = Array.from(byPair.entries()).map(([symbol, pnl]) => ({ symbol, pnl })).sort((a, b) => b.pnl - a.pnl);

    const sessions = new Map<string, { wins: number; total: number }>();
    for (const tr of closed) {
      if (!tr.session) continue;
      const g = sessions.get(tr.session) ?? { wins: 0, total: 0 };
      g.total++;
      if ((tr.pnl ?? 0) > 0) g.wins++;
      sessions.set(tr.session, g);
    }

    // Rekap per bulan (terbaru dulu)
    const months = new Map<string, { pnl: number; total: number; wins: number }>();
    for (const tr of closed) {
      const k = tr.trade_date.slice(0, 7);
      const g = months.get(k) ?? { pnl: 0, total: 0, wins: 0 };
      g.pnl += tr.pnl ?? 0;
      g.total++;
      if ((tr.pnl ?? 0) > 0) g.wins++;
      months.set(k, g);
    }
    return {
      closed,
      avgWin,
      avgLoss,
      expectancy,
      pairs,
      sessions: Array.from(sessions.entries()).map(([s, g]) => ({ session: s, winRate: (g.wins / g.total) * 100, total: g.total })),
      months: Array.from(months.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)),
    };
  }, [trades]);

  if (!session) return <Redirect href="/login" />;
  if (!allowed) return <Redirect href="/journal" />;

  const now = new Date();
  const sel = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const selYear = sel.getFullYear();
  const selMonth = sel.getMonth();
  const selKey = monthKey(selYear, selMonth);
  const minKey = view?.closed.reduce((min, tr) => (tr.trade_date.slice(0, 7) < min ? tr.trade_date.slice(0, 7) : min), monthKey(now.getFullYear(), now.getMonth()));
  const canPrev = !!minKey && monthKey(new Date(selYear, selMonth - 1, 1).getFullYear(), new Date(selYear, selMonth - 1, 1).getMonth()) >= minKey;
  const canNext = monthOffset < 0;

  const byDay = new Map<number, number>();
  for (const tr of view?.closed ?? []) {
    if (tr.trade_date.slice(0, 7) === selKey) {
      const d = Number(tr.trade_date.slice(8, 10));
      byDay.set(d, (byDay.get(d) ?? 0) + (tr.pnl ?? 0));
    }
  }
  const maxAbs = Math.max(1, ...Array.from(byDay.values()).map(Math.abs));
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const leading = (new Date(selYear, selMonth, 1).getDay() + 6) % 7; // minggu mulai Senin
  const cells: (number | null)[] = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthPnl = Array.from(byDay.values()).reduce((s, v) => s + v, 0);
  const cur = account?.currency ?? "USD";
  const monthName = (k: string) => `${(locale === "en" ? MONTHS_EN : MONTHS_ID)[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

  async function shareMonth() {
    if (!account) return;
    setSharing(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(`${WEB_URL}/api/share/stats?month=${selKey}&account=${account.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(String(res.status));
      const bytes = new Uint8Array(await res.arrayBuffer());
      const file = new File(Paths.cache, `loki4x-rekap-${selKey}.png`);
      if (file.exists) file.delete();
      file.create();
      file.write(bytes);
      await Sharing.shareAsync(file.uri, { mimeType: "image/png" });
    } catch {
      setError("Gagal membuat gambar. Coba lagi.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen>
      <BackHeader title="Report & Performance" fallback="/journal" />
      <T variant="bodySm" color="textSecondary">
        {t("Pantau performa trading kamu dari berbagai sudut.")}
        {account ? ` · ${account.name}` : ""}
      </T>
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!view && !error && <SkeletonPage variant="kpi" />}

      {view && (
        <>
          <Card style={styles.kpis}>
            {[
              { label: "Avg Win", value: formatPnl(view.avgWin, cur), color: colors.success },
              { label: "Avg Loss", value: formatPnl(-view.avgLoss, cur), color: colors.error },
              { label: "Expectancy / Trade", value: formatPnl(view.expectancy, cur), color: view.expectancy >= 0 ? colors.success : colors.error },
              { label: "Closed Trades", value: String(view.closed.length), color: colors.text },
            ].map((k) => (
              <View key={k.label} style={styles.kpi}>
                <T variant="caption" color="textMuted">{k.label}</T>
                <T style={{ fontWeight: "700", color: k.color }}>{k.value}</T>
              </View>
            ))}
          </Card>

          <Card>
            <View style={styles.between}>
              <Pressable disabled={!canPrev} onPress={() => setMonthOffset((m) => m - 1)} hitSlop={10} style={{ opacity: canPrev ? 1 : 0.3 }}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <View style={{ alignItems: "center" }}>
                <T variant="h3">{monthName(selKey)}</T>
                <T variant="caption" style={{ fontWeight: "700", color: monthPnl >= 0 ? colors.success : colors.error }}>
                  {byDay.size ? formatPnl(monthPnl, cur) : t("Belum ada trade")}
                </T>
              </View>
              <Pressable disabled={!canNext} onPress={() => setMonthOffset((m) => m + 1)} hitSlop={10} style={{ opacity: canNext ? 1 : 0.3 }}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.week}>
              {(locale === "en" ? DAYS_EN : DAYS_ID).map((d, i) => (
                <T key={i} variant="caption" color="textMuted" style={styles.dayHead}>{d}</T>
              ))}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, w) => (
              <View key={w} style={styles.week}>
                {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
                  const pnl = d ? byDay.get(d) : undefined;
                  const ratio = pnl !== undefined ? Math.abs(pnl) / maxAbs : 0;
                  const alpha = pnl === undefined ? 0 : ratio > 0.6 ? 0.45 : ratio > 0.3 ? 0.3 : 0.16;
                  const bg =
                    pnl === undefined ? colors.surface2 : pnl >= 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
                  return (
                    <View key={i} style={[styles.cell, { backgroundColor: d ? bg : "transparent" }]}>
                      {d ? <T variant="caption" color="textMuted" style={{ fontSize: 10 }}>{d}</T> : null}
                      {pnl !== undefined && (
                        <T variant="caption" style={{ fontSize: 9, fontWeight: "700", color: pnl >= 0 ? colors.success : colors.error }} numberOfLines={1}>
                          {compact(pnl, cur)}
                        </T>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
            <Button title={sharing ? "Membuat gambar…" : "Bagikan rekap bulan ini"} variant="secondary" onPress={shareMonth} loading={sharing} disabled={byDay.size === 0} />
            <T variant="caption" color="textMuted">Gambar rekap tidak menampilkan nominal P&L, hanya win rate & pips.</T>
          </Card>

          {view.months.length > 0 && (
            <Card style={{ gap: 6 }}>
              <T variant="label" color="textMuted">Rekap per bulan</T>
              {view.months.slice(0, 12).map(([k, g]) => (
                <Pressable
                  key={k}
                  onPress={() => {
                    const [y, m] = k.split("-").map(Number);
                    setMonthOffset((y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()));
                  }}
                  style={styles.rowLine}
                >
                  <T variant="bodySm" style={{ flex: 1 }}>{monthName(k)}</T>
                  <T variant="caption" color="textMuted" style={{ width: 70, textAlign: "right" }}>{g.total} trade</T>
                  <T variant="caption" style={{ width: 44, textAlign: "right", fontWeight: "700", color: g.wins / g.total >= 0.5 ? colors.success : colors.error }}>
                    {((g.wins / g.total) * 100).toFixed(0)}%
                  </T>
                  <T variant="caption" style={{ width: 90, textAlign: "right", fontWeight: "700", color: g.pnl >= 0 ? colors.success : colors.error }}>
                    {formatPnl(g.pnl, cur)}
                  </T>
                </Pressable>
              ))}
            </Card>
          )}

          <Card style={{ gap: 6 }}>
            <T variant="label" color="textMuted">Top Pairs</T>
            {view.pairs.length === 0 && <T variant="bodySm" color="textMuted">Belum ada trade tertutup.</T>}
            {view.pairs.slice(0, 8).map((p) => (
              <View key={p.symbol} style={styles.rowLine}>
                <T variant="bodySm" style={{ flex: 1, fontWeight: "700" }}>{p.symbol}</T>
                <T variant="bodySm" style={{ fontWeight: "700", color: p.pnl >= 0 ? colors.success : colors.error }}>{formatPnl(p.pnl, cur)}</T>
              </View>
            ))}
          </Card>

          <Card style={{ gap: 10 }}>
            <T variant="label" color="textMuted">Win rate per sesi</T>
            {view.sessions.length === 0 && <T variant="bodySm" color="textMuted">Isi sesi saat mencatat trade untuk melihat statistik ini.</T>}
            {view.sessions.map((s) => (
              <View key={s.session} style={{ gap: 4 }}>
                <View style={styles.between}>
                  <T variant="bodySm">{SESSION_LABEL[s.session] ?? s.session}</T>
                  <T variant="caption" color="textMuted">{s.winRate.toFixed(0)}% · {s.total} trade</T>
                </View>
                <ProgressBar percent={s.winRate} color={s.winRate >= 50 ? colors.success : colors.error} />
              </View>
            ))}
          </Card>
          <T variant="caption" color="textMuted">Statistik per strategi, emosi, dan kepatuhan rencana ada di tab Journal.</T>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kpi: { flexBasis: "45%", flexGrow: 1, gap: 2 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  week: { flexDirection: "row", gap: 4 },
  dayHead: { flex: 1, textAlign: "center" },
  cell: { flex: 1, aspectRatio: 0.9, borderRadius: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 1 },
  rowLine: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
});
