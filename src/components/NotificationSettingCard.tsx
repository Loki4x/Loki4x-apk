import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Switch, View } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Card, Skeleton, T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { isPushPreferred, pushAvailable, registerForPush, unregisterPush, type PushStatus } from "@/lib/push";

const MESSAGES: Partial<Record<PushStatus, string>> = {
  denied: "Izin notifikasi ditolak. Aktifkan lewat pengaturan HP.",
  error: "Gagal mengaktifkan notifikasi. Cek koneksi lalu coba lagi.",
  unavailable: "Notifikasi belum tersedia di versi aplikasi ini.",
};

export function NotificationSettingCard() {
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<PushStatus | null>(null);

  useEffect(() => {
    (async () => {
      if (!pushAvailable) {
        setStatus("unavailable");
        setBusy(false);
        setReady(true);
        return;
      }
      const preferred = await isPushPreferred();
      const { status: perm } = await Notifications.getPermissionsAsync();
      const token = await SecureStore.getItemAsync("loki4x-push-token");
      setEnabled(preferred && perm === "granted" && !!token);
      if (preferred && perm !== "granted") setStatus("denied");
      setBusy(false);
      setReady(true);
    })();
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setStatus(null);
    if (next) {
      const result = await registerForPush(true);
      setEnabled(result === "enabled");
      if (result !== "enabled") setStatus(result);
    } else {
      await unregisterPush(true);
      setEnabled(false);
    }
    setBusy(false);
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "600" }}>Notifikasi</T>
          <T variant="caption" color="textMuted">Sinyal baru & update TP/SL, pengingat news, batas risiko, pengumuman.</T>
        </View>
        {!ready ? (
          <Skeleton height={28} width={48} radius={999} />
        ) : busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={toggle}
            disabled={!pushAvailable}
            trackColor={{ true: colors.primary, false: colors.surface2 }}
            thumbColor="#FFFFFF"
          />
        )}
      </View>
      {status && MESSAGES[status] ? (
        <T variant="caption" color={status === "unavailable" ? "textMuted" : "warning"}>
          {MESSAGES[status]}
          {status === "denied" ? (
            <T variant="caption" color="primary" style={{ fontWeight: "700" }} onPress={() => Linking.openSettings()}>
              {"  Buka pengaturan"}
            </T>
          ) : null}
        </T>
      ) : null}
    </Card>
  );
}
