import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Button, T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

const MAX = 500;

/**
 * Tombol Approve / Reject (pengajuan VIP & pembayaran USDT).
 * Reject membuka kolom alasan (opsional) yang dikirim ke user lewat notifikasi, push & email.
 */
export function ReviewButtons({
  busy,
  onReview,
  rejectTitle = "Tolak?",
}: {
  busy: boolean;
  onReview: (action: "approve" | "reject", reason: string) => void;
  rejectTitle?: string;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const approve = () =>
    Alert.alert(t("Setujui?"), t("User akan langsung mendapat aksesnya."), [
      { text: t("Batal"), style: "cancel" },
      { text: "Approve", onPress: () => onReview("approve", "") },
    ]);

  return (
    <>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title="Approve" onPress={approve} loading={busy} style={{ flex: 1 }} />
        <Button title={busy ? "Memproses…" : "Reject"} variant="secondary" onPress={() => setOpen(true)} disabled={busy} style={{ flex: 1 }} />
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => {}}>
              <T variant="h3">{rejectTitle}</T>
              <T variant="bodySm" color="textSecondary">Alasan penolakan (opsional)</T>
              <TextInput
                value={reason}
                onChangeText={(v) => setReason(v.slice(0, MAX))}
                placeholder={t("Mis. bukti transfer tidak terbaca / nominal kurang / akun bukan di bawah IB kami")}
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
                style={[styles.input, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text }]}
              />
              <T variant="caption" color="textMuted" style={{ alignSelf: "flex-end" }}>{reason.length}/{MAX}</T>
              <T variant="caption" color="textMuted">Alasan dikirim ke user lewat notifikasi, push, dan email.</T>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button title="Batal" variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
                <Button
                  title="Tolak"
                  onPress={() => {
                    setOpen(false);
                    onReview("reject", reason.trim());
                    setReason("");
                  }}
                  style={{ flex: 1, backgroundColor: colors.error }}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export const STATUS_TONE = { PENDING: "warning", APPROVED: "success", COMPLETED: "success", REJECTED: "error", FAILED: "error" } as const;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 },
  sheet: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: 100, textAlignVertical: "top" },
});
