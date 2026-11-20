import { Redirect } from "expo-router";
import { Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { formatDateTimeWib } from "@/lib/format";
import { type AuditRow } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

const ACTION_LABEL: Record<string, string> = {
  TIER_CHANGED: "Tier diubah",
  USER_SUSPENDED: "User disuspend",
  USER_UNSUSPENDED: "Suspend dicabut",
  USDT_APPROVED: "Pembayaran USDT disetujui",
  USDT_REJECTED: "Pembayaran USDT ditolak",
  VIP_REQUEST_APPROVED: "Pengajuan VIP disetujui",
  VIP_REQUEST_REJECTED: "Pengajuan VIP ditolak",
  PAYMENT_AUTO_COMPLETED: "Pembayaran otomatis selesai",
  SIGNAL_CREATED: "Sinyal dibuat",
  SIGNAL_STATUS_CHANGED: "Status sinyal diubah",
  SIGNAL_UPDATE_POSTED: "Update sinyal diposting",
  SIGNAL_DELETED: "Sinyal dihapus",
  ANNOUNCEMENT_SENT: "Pengumuman dikirim",
  CALENDAR_ACTUAL_SET: "Actual berita diisi",
  REFERRAL_REWARDED: "Hadiah referral diberikan",
  REFERRAL_CLAIMED: "Hadiah referral diklaim",
  PROMO_CREATED: "Kode promo dibuat",
  PROMO_TOGGLED: "Kode promo diaktifkan/dinonaktifkan",
};

function summarize(details: Record<string, unknown> | null): string {
  if (!details) return "";
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

/** Catatan aksi admin dan sistem (sama dengan /admin/audit-log di web). Hanya baca. */
export default function AdminAuditLogScreen() {
  const { session, profile } = useAuth();
  const { data, error, refresh, refreshing } = useAdminData<AuditRow[]>("audit-log");

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="Audit Log" fallback="/admin" />
      <T variant="bodySm" color="textSecondary">Catatan aksi admin dan sistem (300 terbaru). Catatan tidak bisa diubah atau dihapus dari aplikasi.</T>
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!data && !error && <SkeletonPage variant="list" count={6} />}
      {data && data.length === 0 && (
        <Card>
          <T variant="bodySm" color="textMuted">Belum ada catatan.</T>
        </Card>
      )}
      {data?.map((r) => {
        const target = typeof r.details?.target_email === "string" ? r.details.target_email : (r.target_user_id ?? r.target_id);
        const detail = summarize(r.details);
        return (
          <Card key={r.id} style={{ gap: 3 }}>
            <T variant="bodySm" style={{ fontWeight: "700" }}>{ACTION_LABEL[r.action] ?? r.action}</T>
            <T variant="caption" color="textMuted">{formatDateTimeWib(r.created_at)} WIB · {r.actor_email ?? "—"}</T>
            {target ? <T variant="caption" color="textSecondary">Target: {target}</T> : null}
            {detail ? <T variant="caption" color="textMuted">{detail}</T> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
