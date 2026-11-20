import { Redirect } from "expo-router";
import { Badge, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { type AdminReferral } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

const STATUS: Record<AdminReferral["status"], { label: string; tone: "muted" | "success" | "error" | "warning" }> = {
  PENDING: { label: "Belum bergabung", tone: "muted" },
  REWARDED: { label: "Hari terkumpul", tone: "success" },
  REJECTED: { label: "Tidak memenuhi syarat", tone: "error" },
  CAPPED: { label: "Batas hadiah tercapai", tone: "warning" },
};

/** Daftar referral (sama dengan /admin/referrals di web, 300 terbaru). */
export default function AdminReferralsScreen() {
  const { session, profile } = useAuth();
  const { t } = useI18n();
  const { data, error, refresh, refreshing } = useAdminData<AdminReferral[]>("referrals");

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  const rewarded = data?.filter((r) => r.status === "REWARDED").length ?? 0;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="Referral" fallback="/admin" />
      {data && <T variant="bodySm" color="textSecondary">{t("{total} referral tercatat, {rewarded} sudah mendapat hadiah (300 terbaru).", { total: data.length, rewarded })}</T>}
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!data && !error && <SkeletonPage variant="list" />}
      {data && data.length === 0 && (
        <Card>
          <T variant="bodySm" color="textMuted">Belum ada referral.</T>
        </Card>
      )}
      {data?.map((r) => {
        const s = STATUS[r.status];
        return (
          <Card key={r.id}>
            <T variant="caption" color="textMuted">Pengundang</T>
            <T variant="bodySm" style={{ fontWeight: "600" }}>{r.referrer_email ?? r.referrer_id}</T>
            <T variant="caption" color="textMuted">Diundang</T>
            <T variant="bodySm" style={{ fontWeight: "600" }}>{r.referred_email ?? r.referred_id}</T>
            <T variant="caption" color="textMuted">{t("Tanggal daftar")} {formatDate(r.created_at)}</T>
            <Badge
              label={`${r.status === "REWARDED" && r.claimed_at ? t("Sudah diklaim") : t(s.label)}${r.status === "REWARDED" && r.reward_days > 0 ? ` (+${r.reward_days} ${t("hari")})` : ""}`}
              tone={s.tone}
            />
            {r.note ? <T variant="caption" color="textMuted">{r.note}</T> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
