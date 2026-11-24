import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Badge, Card, Screen, T } from "@/components/ui";
import { IconRowsSkeleton } from "@/components/Skeletons";
import { BackHeader, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { daysAgo } from "@/lib/format";
import { type AdminChatThread } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

/** Live Chat admin: daftar percakapan dari user (sama dengan /admin/chat di web). */
export default function AdminChatListScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { data, error, load, refresh, refreshing } = useAdminData<AdminChatThread[]>("chat-threads");
  const [filter, setFilter] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");

  // Pesan baru dari user → segarkan daftar.
  useEffect(() => {
    if (!profile?.is_admin) return;
    const channel = supabase
      .channel(`admin-chat-list-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_threads" }, () => load())
      .subscribe();
    // Cadangan kalau realtime tidak terhubung: segarkan daftar tiap 10 detik selama layar terbuka.
    const timer = setInterval(load, 10_000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [profile?.is_admin, load]);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  const shown = (data ?? []).filter((th) => filter === "ALL" || th.status === filter);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="Live Chat" fallback="/admin" />
      <T variant="bodySm" color="textSecondary">Balas pesan dari user yang menghubungi support lewat widget chat.</T>
      <OptionChips
        label="Tampilkan"
        options={[
          { value: "OPEN", label: "Terbuka" },
          { value: "CLOSED", label: "Ditutup" },
          { value: "ALL", label: "Semua" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!data && !error && <IconRowsSkeleton icon={0} />}
      {data && shown.length === 0 && (
        <Card>
          <T variant="bodySm" color="textMuted">Belum ada percakapan.</T>
        </Card>
      )}
      {shown.map((th) => (
        <Pressable key={th.id} onPress={() => router.push({ pathname: "/admin/chat/[id]", params: { id: th.id, name: th.name, email: th.email } })}>
          {({ pressed }) => (
            <Card style={[styles.row, { opacity: pressed ? 0.85 : 1, borderColor: th.admin_unread ? colors.primary : colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bodySm" style={{ fontWeight: th.admin_unread ? "700" : "600" }} numberOfLines={1}>{th.name}</T>
                <T variant="caption" color="textMuted" numberOfLines={1}>{th.email}</T>
                <T variant="caption" color="textSecondary" numberOfLines={1}>{th.last_message_preview ?? ""}</T>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <T variant="caption" color="textMuted">{daysAgo(th.last_message_at)}</T>
                {th.admin_unread && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                {th.status === "CLOSED" && <Badge label="Ditutup" tone="muted" />}
              </View>
            </Card>
          )}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
