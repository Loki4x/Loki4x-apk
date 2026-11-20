import { StyleSheet, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { formatDate } from "@/lib/format";
import { idr, PLAN_LABEL, type AdminDashboard, type ExpiringRow } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";
import { useI18n } from "@/lib/i18n";

type IconName = keyof typeof Ionicons.glyphMap;

function timeAgo(ts: number, t: (k: string, v?: Record<string, string | number>) => string) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return t("baru saja");
  if (m < 60) return t("{n} mnt lalu", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("{n} jam lalu", { n: h });
  return t("{n} hari lalu", { n: Math.floor(h / 24) });
}

const usdt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`;
const shortIdr = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1000 ? `${Math.round(n / 1000)}rb` : String(n));

/** Grafik batang sederhana. */
function Bars({ values, labels, color, every = 1, format }: { values: number[]; labels: string[]; color: string; every?: number; format?: (n: number) => string }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.bars}>
        {values.map((v, i) => (
          <View key={i} style={styles.barCol}>
            {format && v > 0 ? <T variant="caption" color="textMuted" style={{ fontSize: 9 }}>{format(v)}</T> : null}
            <View style={{ height: Math.max(2, (v / max) * 110), backgroundColor: v > 0 ? color : colors.surface2, borderRadius: 3, alignSelf: "stretch" }} />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        {labels.map((l, i) => (
          <T key={i} variant="caption" color="textMuted" style={{ flex: 1, fontSize: 9, textAlign: "center" }}>
            {i % every === 0 ? l : ""}
          </T>
        ))}
      </View>
    </View>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: IconName; tone?: "success" | "warning" | "primary" }) {
  const { colors } = useTheme();
  const color = tone ? colors[tone] : colors.text;
  return (
    <Card style={styles.kpi}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={14} color={colors.textMuted} />
        <T variant="caption" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>{label}</T>
      </View>
      <T variant="h3" style={{ color }} numberOfLines={1}>{value}</T>
    </Card>
  );
}

function MemberList({ title, empty, rows, note }: { title: string; empty: string; rows: ExpiringRow[]; note: (r: ExpiringRow) => string }) {
  const { colors } = useTheme();
  return (
    <Card>
      <T variant="h3">{title}</T>
      {rows.length === 0 ? (
        <T variant="bodySm" color="textMuted">{empty}</T>
      ) : (
        rows.slice(0, 10).map((r) => (
          <View key={r.id} style={[styles.member, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <T variant="bodySm" style={{ fontWeight: "600" }} numberOfLines={1}>{r.name}</T>
              <T variant="caption" color="textMuted" numberOfLines={1}>{r.email ?? ""}</T>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <T variant="caption" color="primary" style={{ fontWeight: "700" }}>{r.tier}</T>
              <T variant="caption" color="textMuted">{note(r)}</T>
            </View>
          </View>
        ))
      )}
      {rows.length > 10 && (
        <T variant="caption" color="primary" onPress={() => router.push("/admin/users")}>+{rows.length - 10} lainnya, lihat Users</T>
      )}
    </Card>
  );
}

export default function AdminDashboardScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { data: d, error, refresh, refreshing } = useAdminData<AdminDashboard>("dashboard");

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="Admin Dashboard" fallback="/admin" />
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!d && !error && <SkeletonPage variant="dashboard" />}
      {d && (
        <>
          <View style={styles.grid}>
            <Kpi label="Total Users" value={String(d.total)} icon="people-outline" />
            <Kpi label="Member berbayar" value={String(d.paidNow)} icon="ribbon-outline" tone="primary" />
            <Kpi label="Signup 7 hari" value={`${d.last7} (${d.signupDelta})`} icon="person-add-outline" />
            <Kpi label="Pernah bayar / signup" value={`${d.conversion.toFixed(1)}%`} icon="trending-up-outline" />
            <Kpi label="Pendapatan bulan ini" value={idr(d.revenueMonthIdr)} icon="wallet-outline" tone="success" />
            <Kpi label="Total pendapatan (IDR)" value={idr(d.revenueAllIdr)} icon="wallet-outline" tone="success" />
            <Kpi label="Total pendapatan (USDT)" value={usdt(d.revenueAllUsdt)} icon="wallet-outline" tone="success" />
            <Kpi label="USDT menunggu review" value={String(d.pendingUsdt)} icon="hourglass-outline" tone={d.pendingUsdt > 0 ? "warning" : undefined} />
          </View>

          <Card>
            <T variant="h3">Signup 30 hari</T>
            <Bars values={d.signupData.map((x) => x.signups)} labels={d.signupData.map((x) => x.day)} color={colors.primary} every={5} />
          </Card>

          <Card>
            <T variant="h3">Pendapatan 6 bulan (IDR)</T>
            <Bars values={d.revenueData.map((x) => x.idr)} labels={d.revenueData.map((x) => x.month)} color={colors.success} format={shortIdr} />
          </Card>

          <Card>
            <T variant="h3">Rincian membership</T>
            <T variant="caption" color="textMuted">Free {d.freeNow} · VIP {d.vipNow} · Membership {d.membershipNow}</T>
            <View style={[styles.tr, { borderBottomColor: colors.border }]}>
              <T variant="caption" color="textMuted" style={{ flex: 1.4 }}>Paket</T>
              <T variant="caption" color="textMuted" style={styles.num}>Order</T>
              <T variant="caption" color="textMuted" style={[styles.num, { flex: 1.4 }]}>IDR</T>
              <T variant="caption" color="textMuted" style={styles.num}>USDT</T>
            </View>
            {d.planRows.map((r) => (
              <View key={r.plan} style={[styles.tr, { borderBottomColor: colors.border }]}>
                <T variant="bodySm" style={{ flex: 1.4 }}>{PLAN_LABEL[r.plan] ?? r.plan}</T>
                <T variant="bodySm" style={styles.num}>{r.count}</T>
                <T variant="bodySm" style={[styles.num, { flex: 1.4 }]}>{idr(r.idr)}</T>
                <T variant="bodySm" style={styles.num}>{r.usdt ? r.usdt.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "-"}</T>
              </View>
            ))}
            <T variant="caption" color="textMuted">
              Termasuk pembayaran uji coba sandbox jika ada. Membership yang diberikan manual oleh admin tidak dihitung sebagai order.
            </T>
          </Card>

          <Card>
            <T variant="h3">Pertumbuhan user (6 bulan)</T>
            <View style={styles.bars}>
              {d.growthData.map((g) => {
                const max = Math.max(1, ...d.growthData.map((x) => x.free + x.vip));
                return (
                  <View key={g.month} style={styles.barCol}>
                    <T variant="caption" color="textMuted" style={{ fontSize: 9 }}>{g.free + g.vip}</T>
                    <View style={{ height: Math.max(2, (g.vip / max) * 110), backgroundColor: colors.primary, alignSelf: "stretch", borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
                    <View style={{ height: Math.max(0, (g.free / max) * 110), backgroundColor: colors.surface2, alignSelf: "stretch" }} />
                  </View>
                );
              })}
            </View>
            <View style={styles.barLabels}>
              {d.growthData.map((g) => (
                <T key={g.month} variant="caption" color="textMuted" style={{ flex: 1, fontSize: 9, textAlign: "center" }}>{g.month}</T>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Legend color={colors.primary} label="Berbayar" />
              <Legend color={colors.surface2} label="Free" />
            </View>
          </Card>

          <MemberList
            title={t("Berakhir dalam 14 hari ({n})", { n: d.expiringSoon.length })}
            empty="Tidak ada membership yang segera berakhir."
            rows={d.expiringSoon}
            note={(r) => (r.daysLeft === 0 ? t("berakhir hari ini") : `${t("{n} hari lagi", { n: r.daysLeft ?? 0 })} (${formatDate(r.expiresAt!)})`)}
          />
          <MemberList
            title={t("Berakhir 14 hari terakhir ({n})", { n: d.recentlyExpired.length })}
            empty="Belum ada yang berakhir baru-baru ini."
            rows={d.recentlyExpired}
            note={(r) => `${t("berakhir")} ${formatDate(r.expiresAt!)}`}
          />

          <Card>
            <T variant="h3">Aktivitas terbaru</T>
            {d.activity.length === 0 && <T variant="bodySm" color="textMuted">Belum ada aktivitas.</T>}
            {d.activity.map((a) => (
              <View key={a.id} style={styles.activity}>
                <View style={[styles.dot, { backgroundColor: a.type === "signup" ? colors.primarySubtle : colors.successSubtle }]}>
                  <Ionicons name={a.type === "signup" ? "person-add-outline" : "card-outline"} size={14} color={a.type === "signup" ? colors.primary : colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="bodySm" style={{ fontWeight: "600" }} numberOfLines={1}>{a.title}</T>
                  <T variant="caption" color="textMuted" numberOfLines={1}>{a.type === "signup" ? t("Bergabung di Loki4x Academy") : a.subtitle}</T>
                </View>
                <T variant="caption" color="textMuted">{timeAgo(a.ts, t)}</T>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <T variant="caption" color="textMuted">{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { width: "48%", flexGrow: 1, gap: 6, padding: 12 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 130 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 2 },
  barLabels: { flexDirection: "row", gap: 2 },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  num: { flex: 1, textAlign: "right" },
  member: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  activity: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
