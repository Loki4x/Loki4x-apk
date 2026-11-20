import { Alert, View } from "react-native";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

/** Tombol Approve / Reject dengan konfirmasi (pengajuan VIP & pembayaran USDT). */
export function ReviewButtons({ busy, onReview }: { busy: boolean; onReview: (action: "approve" | "reject") => void }) {
  const { t } = useI18n();
  const ask = (action: "approve" | "reject") =>
    Alert.alert(action === "approve" ? t("Setujui?") : t("Tolak?"), action === "approve" ? t("User akan langsung mendapat aksesnya.") : t("Pengajuan akan ditolak."), [
      { text: t("Batal"), style: "cancel" },
      { text: action === "approve" ? "Approve" : "Reject", style: action === "reject" ? "destructive" : "default", onPress: () => onReview(action) },
    ]);
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Button title="Approve" onPress={() => ask("approve")} loading={busy} style={{ flex: 1 }} />
      <Button title="Reject" variant="secondary" onPress={() => ask("reject")} disabled={busy} style={{ flex: 1 }} />
    </View>
  );
}

export const STATUS_TONE = { PENDING: "warning", APPROVED: "success", COMPLETED: "success", REJECTED: "error", FAILED: "error" } as const;
