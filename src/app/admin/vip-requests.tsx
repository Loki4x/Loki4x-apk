import { useState } from "react";
import { Redirect } from "expo-router";
import { Badge, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, OptionChips } from "@/components/form";
import { ReviewButtons, STATUS_TONE } from "@/components/AdminReview";
import { useAuth } from "@/lib/auth";
import { formatDateTimeWib } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { reviewVipRequest, type VipRequest } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

const brokerName = (b: string | null | undefined) => (b ? b.charAt(0).toUpperCase() + b.slice(1) : "Exness");

/** Pengajuan upgrade VIP via IB broker (sama dengan /admin/vip-requests di web). */
export default function AdminVipRequestsScreen() {
  const { session, profile } = useAuth();
  const { data, error, load, refresh, refreshing } = useAdminData<VipRequest[]>("vip-requests");
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  const shown = (data ?? []).filter((r) => filter === "ALL" || r.status === "PENDING");

  async function review(id: string, action: "approve" | "reject") {
    setBusy(id);
    setMsg(null);
    try {
      await reviewVipRequest(id, action);
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="VIP Requests" fallback="/admin" />
      <T variant="bodySm" color="textSecondary">Pengajuan upgrade VIP via IB broker.</T>
      <OptionChips label="Tampilkan" options={[{ value: "PENDING", label: "Menunggu" }, { value: "ALL", label: "Semua" }]} value={filter} onChange={setFilter} />
      {(error || msg) && <T variant="bodySm" color="error">{msg ?? error}</T>}
      {!data && !error && <SkeletonPage variant="list" />}
      {data && shown.length === 0 && (
        <Card>
          <T variant="bodySm" color="textMuted">{filter === "PENDING" ? "Tidak ada pengajuan yang menunggu." : "Belum ada pengajuan."}</T>
        </Card>
      )}
      {shown.map((r) => (
        <Card key={r.id}>
          <T variant="bodySm" style={{ fontWeight: "700" }}>{r.profiles?.full_name || r.profiles?.email || r.user_id}</T>
          {r.profiles?.email ? <T variant="caption" color="textMuted">{r.profiles.email}</T> : null}
          <T variant="caption" color="textSecondary">Broker: {brokerName(r.broker)}</T>
          <T variant="caption" color="textSecondary">Email broker: {r.broker_email}</T>
          <T variant="caption" color="textSecondary">Akun trading: {r.trading_account_id}</T>
          <T variant="caption" color="textSecondary">Deposit pertama: ${r.first_deposit}</T>
          <T variant="caption" color="textMuted">{formatDateTimeWib(r.created_at)} WIB</T>
          <Badge label={r.status} tone={STATUS_TONE[r.status]} />
          {r.status === "PENDING" && <ReviewButtons busy={busy === r.id} onReview={(a) => review(r.id, a)} />}
        </Card>
      ))}
    </Screen>
  );
}
