import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Screen, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { formatDateTimeWib } from "@/lib/format";
import { fetchInbox, markAllRead, markRead, type InboxItem } from "@/lib/notifications";

type IconName = keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
const TYPE_ICON: Record<string, IconName> = {
  ANNOUNCEMENT: "megaphone-outline",
  TIER_UPGRADE: "rocket-outline",
  EXPIRY_WARNING: "time-outline",
  EXPIRY_ENDED: "alert-circle-outline",
};

/** Kotak notifikasi (sama dengan lonceng notifikasi di web). */
export default function NotificationsScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setItems(await fetchInbox(userId));
      setError(null);
    } catch {
      setError("Notifikasi belum bisa dimuat.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session || !userId) return <Redirect href="/login" />;

  const unread = items?.filter((n) => !n.is_read).length ?? 0;

  async function toggle(n: InboxItem) {
    setOpen((o) => (o === n.id ? null : n.id));
    if (!n.is_read && userId) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? null);
      await markRead(userId, n.id).catch(() => {});
    }
  }

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <BackHeader title="Notifikasi" />
      {unread > 0 && (
        <T
          variant="bodySm"
          color="primary"
          style={{ fontWeight: "700", alignSelf: "flex-end" }}
          onPress={async () => {
            setItems((list) => list?.map((x) => ({ ...x, is_read: true })) ?? null);
            await markAllRead(userId).catch(() => {});
          }}
        >
          Tandai semua sudah dibaca
        </T>
      )}
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!items && !error && <T variant="bodySm" color="textMuted">Memuat…</T>}
      {items && items.length === 0 && (
        <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <Ionicons name="notifications-off-outline" size={36} color={colors.textMuted} />
          <T variant="bodySm" color="textMuted">Belum ada notifikasi.</T>
        </Card>
      )}
      {items?.map((n) => (
        <Pressable key={n.id} onPress={() => toggle(n)}>
          {({ pressed }) => (
            <Card style={[styles.item, { opacity: pressed ? 0.85 : 1, borderColor: n.is_read ? colors.border : colors.primary }]}>
              <View style={[styles.icon, { backgroundColor: n.is_read ? colors.surface2 : colors.primarySubtle }]}>
                <Ionicons name={TYPE_ICON[n.type] ?? "notifications-outline"} size={18} color={n.is_read ? colors.textMuted : colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <T variant="bodySm" style={{ fontWeight: n.is_read ? "500" : "700" }}>{n.title}</T>
                <T variant="caption" color="textSecondary" numberOfLines={open === n.id ? undefined : 2}>{n.message}</T>
                <T variant="caption" color="textMuted">{formatDateTimeWib(n.created_at)} WIB</T>
              </View>
              {!n.is_read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </Card>
          )}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
