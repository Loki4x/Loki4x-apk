import { useState } from "react";
import { Linking } from "react-native";
import { Redirect } from "expo-router";
import { Badge, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, OptionChips } from "@/components/form";
import { ReviewButtons, STATUS_TONE } from "@/components/AdminReview";
import { AuthImage } from "@/components/AuthImage";
import { useAuth } from "@/lib/auth";
import { formatDateTimeWib } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { PLAN_LABEL, reviewUsdtPayment, slipPath, type UsdtPayment } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

/** Verifikasi manual pembayaran USDT (sama dengan /admin/usdt-payments di web). */
export default function AdminUsdtPaymentsScreen() {
  const { session, profile } = useAuth();
  const { data, error, load, refresh, refreshing } = useAdminData<UsdtPayment[]>("usdt-payments");
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  const shown = (data ?? []).filter((p) => filter === "ALL" || p.status === "PENDING");

  async function review(id: string, action: "approve" | "reject") {
    setBusy(id);
    setMsg(null);
    try {
      await reviewUsdtPayment(id, action);
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="Pembayaran USDT" fallback="/admin" />
      <T variant="bodySm" color="textSecondary">Verifikasi manual pembayaran via USDT — cek bukti transfer sebelum approve.</T>
      <OptionChips label="Tampilkan" options={[{ value: "PENDING", label: "Menunggu" }, { value: "ALL", label: "Semua" }]} value={filter} onChange={setFilter} />
      {(error || msg) && <T variant="bodySm" color="error">{msg ?? error}</T>}
      {!data && !error && <SkeletonPage variant="list" />}
      {data && shown.length === 0 && (
        <Card>
          <T variant="bodySm" color="textMuted">{filter === "PENDING" ? "Tidak ada pembayaran yang menunggu." : "Belum ada pembayaran USDT."}</T>
        </Card>
      )}
      {shown.map((p) => {
        const slip = p.slip_url ? slipPath(p.slip_url) : null;
        const isPdf = /\.pdf$/i.test(p.slip_url ?? "");
        return (
          <Card key={p.id}>
            <T variant="bodySm" style={{ fontWeight: "700" }}>{p.profiles?.full_name || p.profiles?.email || p.user_id}</T>
            {p.profiles?.email ? <T variant="caption" color="textMuted">{p.profiles.email}</T> : null}
            <T variant="body" style={{ fontWeight: "700" }}>{PLAN_LABEL[p.plan] ?? p.plan} · {p.amount} USDT</T>
            {p.promo_code ? <T variant="caption" color="textSecondary">Promo {p.promo_code}{p.discount_amount ? ` (−${p.discount_amount})` : ""}</T> : null}
            {p.payment_method ? <T variant="caption" color="textSecondary">Network: {p.payment_method.replace("usdt_", "").toUpperCase()}</T> : null}
            {p.note ? <T variant="caption" color="textSecondary">Catatan: {p.note}</T> : null}
            <T variant="caption" color="textMuted">Order {p.order_id} · {formatDateTimeWib(p.created_at)} WIB</T>
            {p.slip_url && slip && !isPdf ? <AuthImage path={slip} style={{ width: "100%", height: 260, borderRadius: 10 }} /> : null}
            {p.slip_url && (!slip || isPdf) ? (
              <T variant="bodySm" color="primary" onPress={() => (slip ? undefined : Linking.openURL(p.slip_url!))}>
                {slip ? "Bukti berupa PDF: buka di panel admin web." : "Lihat bukti transfer"}
              </T>
            ) : null}
            {!p.slip_url && <T variant="caption" color="textMuted">Tanpa bukti transfer.</T>}
            <Badge label={p.status} tone={STATUS_TONE[p.status]} />
            {p.status === "PENDING" && <ReviewButtons busy={busy === p.id} onReview={(a) => review(p.id, a)} />}
          </Card>
        );
      })}
    </Screen>
  );
}
