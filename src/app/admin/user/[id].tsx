import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Badge, Button, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, Field, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import {
  cachedUser,
  cacheUsers,
  fetchAdminData,
  fetchUserStats,
  membershipOf,
  setUserSuspended,
  setUserTier,
  type AdminUser,
  type Tier,
  type UserStats,
} from "@/lib/admin";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Detail user: ubah tier & masa aktif, tangguhkan, statistik trading (sama dengan modal di web). */
export default function AdminUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [user, setUser] = useState<AdminUser | null>(() => cachedUser(String(id)));
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tier, setTier] = useState<Tier>("FREE");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!user) {
      fetchAdminData<AdminUser[]>("users")
        .then((list) => {
          cacheUsers(list);
          setUser(list.find((u) => u.id === id) ?? null);
        })
        .catch((e) => setMsg({ ok: false, text: friendlyApiError(e) }));
    }
    fetchUserStats(String(id)).then(setStats).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Mulai dari tier yang berlaku sekarang (masa aktif habis = FREE).
  useEffect(() => {
    if (!user) return;
    const m = membershipOf(user);
    setTier(m.effective);
    setExpires(m.expired ? "" : (user.vip_expires_at?.slice(0, 10) ?? ""));
  }, [user]);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  async function saveTier() {
    if (!user) return;
    const exp = expires.trim();
    if (tier !== "FREE" && exp && !DATE_RE.test(exp)) {
      setMsg({ ok: false, text: t("Format tanggal YYYY-MM-DD, mis. 2026-12-31.") });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const value = tier !== "FREE" && exp ? exp : null;
      await setUserTier(user.id, tier, value);
      const next = { ...user, tier, vip_expires_at: tier !== "FREE" ? value : null };
      cacheUsers([next]);
      setUser(next);
      setMsg({ ok: true, text: t("Tier disimpan.") });
    } catch (e) {
      setMsg({ ok: false, text: friendlyApiError(e) });
    } finally {
      setSaving(false);
    }
  }

  function toggleSuspend() {
    if (!user) return;
    const suspend = !user.is_suspended;
    Alert.alert(
      suspend ? t("Tangguhkan akun ini?") : t("Cabut penangguhan?"),
      suspend ? t("User tidak bisa login sampai penangguhan dicabut.") : t("User bisa login kembali."),
      [
        { text: t("Batal"), style: "cancel" },
        {
          text: suspend ? t("Tangguhkan") : t("Cabut"),
          style: suspend ? "destructive" : "default",
          onPress: async () => {
            setMsg(null);
            try {
              await setUserSuspended(user.id, suspend);
              const next = { ...user, is_suspended: suspend };
              cacheUsers([next]);
              setUser(next);
            } catch (e) {
              setMsg({ ok: false, text: friendlyApiError(e) });
            }
          },
        },
      ]
    );
  }

  const m = user ? membershipOf(user) : null;

  return (
    <Screen>
      <BackHeader title="Detail User" fallback="/admin/users" />
      {!user && !msg && <SkeletonPage variant="detail" />}
      {msg && <T variant="bodySm" color={msg.ok ? "success" : "error"}>{msg.text}</T>}
      {user && m && (
        <>
          <Card>
            <T variant="h3">{user.full_name || "User"}</T>
            <T variant="bodySm" color="textSecondary">{user.email}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Badge label={m.effective} tone={m.effective === "FREE" ? "muted" : "primary"} />
              {user.is_admin && <Badge label="Admin" tone="warning" />}
              {user.is_suspended && <Badge label="Suspended" tone="error" />}
            </View>
            <T variant="caption" color="textMuted">
              {t("Daftar")} {formatDate(user.created_at)}
              {user.vip_expires_at ? ` · ${t("Masa aktif sampai")} ${formatDate(user.vip_expires_at)}` : m.effective !== "FREE" ? ` · ${t("tanpa batas")}` : ""}
            </T>
          </Card>

          <Card>
            <T variant="h3">Ubah tier</T>
            <OptionChips
              label="Tier"
              options={[
                { value: "FREE", label: "FREE" },
                { value: "VIP", label: "VIP" },
                { value: "MEMBERSHIP", label: "MEMBERSHIP" },
              ]}
              value={tier}
              onChange={setTier}
            />
            {tier !== "FREE" && (
              <Field
                label="Berakhir pada (opsional)"
                value={expires}
                onChangeText={setExpires}
                placeholder="YYYY-MM-DD"
                hint="Kosongkan untuk tanpa batas waktu."
              />
            )}
            <Button title="Simpan tier" onPress={saveTier} loading={saving} />
          </Card>

          <Card>
            <T variant="h3">Status akun</T>
            <T variant="bodySm" color="textSecondary">
              {user.is_suspended ? "Akun ini sedang ditangguhkan dan tidak bisa login." : "Akun aktif."}
            </T>
            <Button
              title={user.is_suspended ? "Cabut penangguhan" : "Tangguhkan akun"}
              variant={user.is_suspended ? "primary" : "secondary"}
              onPress={toggleSuspend}
              disabled={user.id === session.user.id}
            />
          </Card>

          <Card>
            <T variant="h3">Statistik trading</T>
            {!stats ? (
              <SkeletonPage variant="list" count={1} />
            ) : (
              <>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <T variant="caption" color="textMuted">Trade (10 terakhir)</T>
                    <T variant="h3">{stats.totalTrades}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="caption" color="textMuted">Win rate</T>
                    <T variant="h3">{stats.winRate.toFixed(1)}%</T>
                  </View>
                </View>
                {stats.recentTrades.length === 0 && <T variant="bodySm" color="textMuted">Belum ada trade.</T>}
                {stats.recentTrades.map((tr) => (
                  <View key={tr.id} style={[styles.trade, { borderTopColor: colors.border }]}>
                    <T variant="bodySm" style={{ fontWeight: "600", flex: 1 }}>{tr.symbol} · {tr.side}</T>
                    <T variant="caption" color="textMuted">{formatDate(tr.trade_date)}</T>
                    <T
                      variant="bodySm"
                      style={{ fontWeight: "700", width: 80, textAlign: "right" }}
                      color={tr.pnl === null ? "textMuted" : tr.pnl >= 0 ? "success" : "error"}
                    >
                      {tr.pnl === null ? tr.status : formatMoney(tr.pnl)}
                    </T>
                  </View>
                ))}
              </>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  trade: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
