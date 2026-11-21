import { useCallback, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Button, Card, ProgressBar, Screen, T } from "@/components/ui";
import { ReferralSkeleton } from "@/components/Skeletons";
import { BackHeader } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { apiGet, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";

interface ReferralInfo {
  code: string | null;
  link: string | null;
  balance: number;
  claimedDays: number;
  invited: number;
  joined: number;
  blocked: "MEMBERSHIP" | "PERMANENT_VIP" | null;
  threshold: number;
  rewardDays: number;
  maxRewards: number;
  friends: { id: string; email: string; status: "PENDING" | "REWARDED" | "REJECTED" | "CAPPED"; reward_days: number; claimed: boolean; created_at: string }[];
}

const STATUS_LABEL = {
  PENDING: "Belum bergabung",
  REWARDED: "Hari terkumpul",
  REJECTED: "Tidak memenuhi syarat",
  CAPPED: "Batas hadiah tercapai",
} as const;

/** Referral: ajak teman, kumpulkan hari VIP, klaim. Sama dengan /referral di web. */
export default function ReferralScreen() {
  const { session, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await apiGet<ReferralInfo>("/api/mobile/referral"));
      setError(null);
    } catch (err) {
      setError(friendlyApiError(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return <Redirect href="/login" />;

  async function claim() {
    setClaiming(true);
    setResult(null);
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>("POST", "/api/mobile/referral/claim", {});
      setResult(res);
      if (res.ok) {
        await refreshProfile();
        await load();
      }
    } catch (err) {
      setResult({ ok: false, message: friendlyApiError(err) });
    } finally {
      setClaiming(false);
    }
  }

  return (
    <Screen>
      <BackHeader title="Referral" fallback="/account" />
      {info && (
        <T variant="bodySm" color="textSecondary">
          {t("Ajak teman, dapat hari VIP. Tiap teman yang bergabung sebagai VIP atau Membership memberi +{days} hari VIP, dan bisa diklaim setelah terkumpul {threshold} hari.", {
            days: info.rewardDays,
            threshold: info.threshold,
          })}
        </T>
      )}
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!info && !error && <ReferralSkeleton />}

      {info && (
        <>
          <Card>
            <T variant="label" color="textMuted">Link undangan kamu</T>
            {info.link ? (
              <>
                <T variant="body" style={{ fontWeight: "700" }}>{info.link}</T>
                <T variant="caption" color="textMuted">Kode: {info.code}</T>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button
                    title={copied ? "Tersalin!" : "Salin link"}
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={async () => {
                      await Clipboard.setStringAsync(info.link!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  />
                  <Button
                    title="Bagikan"
                    style={{ flex: 1 }}
                    onPress={() => Share.share({ message: t("Gabung Loki4x Academy lewat link ini: {link}", { link: info.link! }) })}
                  />
                </View>
              </>
            ) : (
              <T variant="bodySm" color="error">Gagal membuat kode referral, coba muat ulang.</T>
            )}
          </Card>

          <Card>
            <T variant="label" color="textMuted">Saldo hari VIP</T>
            <T variant="h2">
              {info.balance}/{info.threshold} <T variant="body" color="textMuted">hari</T>
            </T>
            <ProgressBar percent={(info.balance / info.threshold) * 100} color={colors.primary} />
            {info.blocked === "MEMBERSHIP" && (
              <T variant="caption" color="warning">Kamu sedang Membership, jadi hadiah VIP belum bisa diklaim. Saldo tetap aman.</T>
            )}
            {info.blocked === "PERMANENT_VIP" && <T variant="caption" color="warning">VIP kamu sudah tanpa batas waktu. Saldo tetap tersimpan.</T>}
            {result && <T variant="bodySm" color={result.ok ? "success" : "error"}>{result.message}</T>}
            <Button title="Klaim hari VIP" onPress={claim} loading={claiming} disabled={info.balance < info.threshold || !!info.blocked} />
          </Card>

          <View style={styles.stats}>
            {[
              { label: "Teman diundang", value: String(info.invited), color: colors.text },
              { label: "Sudah bergabung", value: String(info.joined), color: colors.success },
              { label: "Hari sudah diklaim", value: `+${info.claimedDays}`, color: colors.text },
            ].map((s) => (
              <Card key={s.label} style={styles.stat}>
                <T variant="caption" color="textMuted">{s.label}</T>
                <T variant="h3" style={{ color: s.color }}>{s.value}</T>
              </Card>
            ))}
          </View>

          <Card style={{ gap: 6 }}>
            <T variant="label" color="textMuted">Cara kerjanya</T>
            <T variant="bodySm" color="textSecondary">1. {t("Bagikan link undanganmu ke teman.")}</T>
            <T variant="bodySm" color="textSecondary">2. {t("Temanmu mendaftar lewat link itu (akun baru).")}</T>
            <T variant="bodySm" color="textSecondary">
              3. {t("Saat temanmu berlangganan VIP/Membership atau pengajuan VIP IB-nya disetujui, saldomu bertambah +{days} hari VIP.", { days: info.rewardDays })}
            </T>
            <T variant="bodySm" color="textSecondary">
              4. {t("Setelah saldo mencapai {threshold} hari, tekan Klaim: seluruh saldo ditambahkan sebagai VIP di akunmu.", { threshold: info.threshold })}
            </T>
            <T variant="caption" color="textMuted">
              {t("Maksimal {max} hadiah per akun. Hadiah hanya untuk teman yang belum punya akun sebelumnya.", { max: info.maxRewards })}
            </T>
          </Card>

          <Card style={{ gap: 0, paddingVertical: 6 }}>
            {info.friends.length === 0 && (
              <T variant="bodySm" color="textMuted" style={{ paddingVertical: 10 }}>Belum ada teman yang mendaftar lewat link kamu.</T>
            )}
            {info.friends.map((f, i) => (
              <View key={f.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <T variant="bodySm">{f.email}</T>
                  <T variant="caption" color="textMuted">{formatDate(f.created_at)}</T>
                </View>
                <T variant="caption" style={{ fontWeight: "700", color: f.status === "REWARDED" ? colors.success : colors.textSecondary }}>
                  {f.status === "REWARDED" && f.claimed ? t("Sudah diklaim") : t(STATUS_LABEL[f.status])}
                  {f.status === "REWARDED" && f.reward_days > 0 ? ` (+${f.reward_days})` : ""}
                </T>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, padding: 12, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
});
