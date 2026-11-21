import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { UpgradeSkeleton } from "@/components/Skeletons";
import { BackHeader, Field, TermsCheckbox } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { formatDate } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import {
  ADMIN_CONTACT_LINK,
  fetchUpgradeInfo,
  formatIdr,
  PLAN_INFO,
  planCtaLabel,
  submitVipRequest,
  type UpgradeInfo,
} from "@/lib/upgrade";

const VIP_STATUS: Record<"PENDING" | "APPROVED" | "REJECTED", { label: string; tone: "warning" | "success" | "error" }> = {
  PENDING: { label: "Sedang diproses", tone: "warning" },
  APPROVED: { label: "Disetujui", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "error" },
};

/** Upgrade & perpanjangan (sama dengan halaman /upgrade web): pilih paket, atau daftar VIP via IB broker. */
export default function UpgradeScreen() {
  const { session, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [info, setInfo] = useState<UpgradeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Form VIP via IB
  const [broker, setBroker] = useState("exness");
  const [email, setEmail] = useState("");
  const [accountId, setAccountId] = useState("");
  const [deposit, setDeposit] = useState("");
  const [agreeIb, setAgreeIb] = useState(false);
  const [sending, setSending] = useState(false);
  const [ibError, setIbError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await fetchUpgradeInfo());
      setError(null);
      refreshProfile();
    } catch (err) {
      setError(friendlyApiError(err));
    }
  }, [refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return <Redirect href="/login" />;

  async function sendIb() {
    setIbError(null);
    setSending(true);
    try {
      await submitVipRequest({ broker, broker_email: email.trim(), trading_account_id: accountId.trim(), first_deposit: deposit.trim().replace(",", ".") });
      await load();
    } catch (err) {
      setIbError(friendlyApiError(err));
    } finally {
      setSending(false);
    }
  }

  const status = info?.status;
  const isFree = status?.tier === "FREE";
  const ibPending = info?.vipRequest && info.vipRequest.status !== "REJECTED";

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <BackHeader title="Upgrade & Perpanjangan" fallback="/account" />
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!info && !error && <UpgradeSkeleton />}

      {info && status && (
        <>
          <Card>
            <View style={styles.between}>
              <T variant="bodySm" color="textSecondary">Tier kamu sekarang</T>
              <Badge label={status.tier} tone={isFree ? "muted" : "primary"} />
            </View>
            {!isFree && status.permanent && <T variant="caption" color="textMuted">Aktif tanpa batas waktu</T>}
            {!isFree && !status.permanent && status.expiresAt && (
              <T variant="caption" color="textMuted">Aktif sampai {formatDate(status.expiresAt)}</T>
            )}
            {status.expired && status.expiresAt && (
              <T variant="bodySm" color="warning">
                {t("Masa aktif {tier} kamu berakhir pada {date}. Perpanjang untuk membuka kembali fitur berbayar.", { tier: status.storedTier, date: formatDate(status.expiresAt) })}
              </T>
            )}
            {!isFree && !status.permanent && info.plans.length > 0 && (
              <T variant="caption" color="textMuted">
                Perpanjangan bulanan ditambahkan dari tanggal berakhir saat ini, jadi sisa waktu kamu tidak hangus.
              </T>
            )}
          </Card>

          {info.plans.length === 0 ? (
            <Card>
              <T variant="bodySm" color="textSecondary">
                {t("Akun kamu aktif di tier {tier} tanpa batas waktu. Nggak perlu bayar lagi.", { tier: status.tier })}
              </T>
            </Card>
          ) : (
            <>
              <T variant="label" color="textMuted">{isFree ? "Cara 1 — Bayar langsung" : "Pilih paket"}</T>
              {info.plans.map((plan) => {
                const p = PLAN_INFO[plan];
                return (
                  <Card key={plan} style={p.featured ? { borderColor: colors.primary } : undefined}>
                    <View style={styles.between}>
                      <T variant="h3">{p.name}</T>
                      {p.featured && <Badge label="Paling Populer" tone="primary" />}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                      <T variant="h1">{p.price}</T>
                      <T variant="bodySm" color="textMuted">{p.period}</T>
                    </View>
                    {p.features.map((f) => (
                      <View key={f} style={styles.feature}>
                        <Ionicons name="checkmark" size={16} color={colors.primary} />
                        <T variant="bodySm" color="textSecondary" style={{ flex: 1 }}>{f}</T>
                      </View>
                    ))}
                    <Button
                      title={`${t(planCtaLabel(plan, status.tier))} — ${formatIdr(info.priceIdr[plan])}`}
                      variant={p.featured ? "primary" : "secondary"}
                      onPress={() => router.push(`/payment?plan=${plan}`)}
                    />
                    <T variant="caption" color="textMuted" style={{ textAlign: "center" }}>QRIS · Transfer Bank · USDT</T>
                  </Card>
                );
              })}
              <Pressable onPress={() => Linking.openURL(ADMIN_CONTACT_LINK)} style={styles.link}>
                <T variant="bodySm" color="textSecondary">Atau hubungi admin manual di Telegram</T>
                <Ionicons name="open-outline" size={14} color={colors.textSecondary} />
              </Pressable>
            </>
          )}

          {isFree && (
            <>
              <T variant="label" color="textMuted">Cara 2 — Daftar via IB Broker (VIP gratis)</T>
              {ibPending ? (
                <Card>
                  <T variant="bodySm" color="textSecondary">Status pengajuan VIP kamu:</T>
                  <Badge label={VIP_STATUS[info.vipRequest!.status].label} tone={VIP_STATUS[info.vipRequest!.status].tone} />
                  {info.vipRequest!.status === "PENDING" && (
                    <T variant="caption" color="textMuted">
                      Admin akan meninjau pengajuanmu dan memverifikasi akun trading yang kamu daftarkan.
                    </T>
                  )}
                </Card>
              ) : (
                <Card style={{ gap: 14 }}>
                  <T variant="bodySm" color="textSecondary">
                    Daftar akun trading baru lewat link referral di bawah, lalu isi form ini biar admin bisa verifikasi.
                  </T>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {Object.entries(info.brokers).map(([key, b]) => {
                      const active = broker === key;
                      return (
                        <Pressable
                          key={key}
                          onPress={() => setBroker(key)}
                          style={[
                            styles.broker,
                            { borderColor: active ? colors.success : colors.border, backgroundColor: active ? colors.successSubtle : colors.surface2 },
                          ]}
                        >
                          <T variant="bodySm" style={{ fontWeight: "700", color: active ? colors.success : colors.textSecondary }}>{b.name}</T>
                        </Pressable>
                      );
                    })}
                  </View>
                  {info.brokers[broker] && (
                    <Button
                      title={t("Daftar akun {broker}", { broker: info.brokers[broker].name })}
                      onPress={() => WebBrowser.openBrowserAsync(info.brokers[broker].link)}
                    />
                  )}
                  {info.vipRequest?.status === "REJECTED" && (
                    <T variant="bodySm" color="error">
                      {t("Pengajuan sebelumnya ditolak. Silakan cek kembali data akunmu dan ajukan ulang.")}
                      {info.vipRequest.rejection_reason ? `\n${t("Alasan:")} ${info.vipRequest.rejection_reason}` : ""}
                    </T>
                  )}
                  <Field label="Email yang terdaftar di broker" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
                  <Field label="ID Account Trading" value={accountId} onChangeText={setAccountId} placeholder="12345678" />
                  <Field label="Deposit pertama (USD)" value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" placeholder="15" hint="*Minimal deposit $15" />
                  <TermsCheckbox anchor="vip-ib" checked={agreeIb} onChange={setAgreeIb} />
                  {ibError && <T variant="bodySm" color="error">{ibError}</T>}
                  <Button title="Ajukan verifikasi" onPress={sendIb} loading={sending} disabled={!agreeIb || !email || !accountId || !deposit} />
                </Card>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  feature: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingVertical: 4 },
  broker: { flex: 1, alignItems: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
});
