import { useCallback, useEffect, useRef, useState } from "react";
import { ActionSheetIOS, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Badge, T } from "@/components/ui";
import { ChatSkeleton } from "@/components/Skeletons";
import { BackHeader } from "@/components/form";
import { ChatComposer } from "@/components/ChatComposer";
import { GlassBackground } from "@/components/GlassBackground";
import { AuthImage, communityImagePath } from "@/components/AuthImage";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { formatDateTimeWib } from "@/lib/format";
import {
  canAccessRoom,
  canWriteRoom,
  chatError,
  COMMUNITY_MAX_LEN,
  deleteCommunityMessage,
  fetchRoom,
  markRoomRead,
  messageAction,
  ROOM_LABEL,
  ROOMS,
  searchMentions,
  sendCommunity,
  type CommunityMessage,
  type Room,
} from "@/lib/chat";

const isRoom = (v: unknown): v is Room => typeof v === "string" && (ROOMS as string[]).includes(v);
const POLL_MS = 30_000;

/** Komunitas: chat grup per tier (sama dengan /community di web), realtime lewat Supabase. */
export default function CommunityScreen() {
  const params = useLocalSearchParams<{ room?: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const isAdmin = !!profile?.is_admin;
  const tier = isAdmin ? "MEMBERSHIP" : (profile?.effectiveTier ?? "FREE");
  const [room, setRoom] = useState<Room>(isRoom(params.room) ? params.room : tier);
  const [messages, setMessages] = useState<CommunityMessage[] | null>(null);
  const [pinned, setPinned] = useState<CommunityMessage | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommunityMessage | null>(null);
  const [mentioned, setMentioned] = useState<Map<string, string>>(new Map());
  const [suggest, setSuggest] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<CommunityMessage>>(null);
  const userId = session?.user.id;

  const allowed = canAccessRoom(tier, room);
  const canWrite = canWriteRoom(tier, room, isAdmin);

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      const res = await fetchRoom(room);
      setMessages(res.messages);
      setPinned(res.pinned);
    } catch {
      setError("Pesan belum bisa dimuat.");
    }
  }, [room, allowed]);

  // Ganti ruang: muat ulang, tandai dibaca, ikuti pesan baru (realtime + cadangan polling).
  useEffect(() => {
    setMessages(null);
    setPinned(null);
    setReplyTo(null);
    setMentioned(new Map());
    setError(null);
    if (!allowed || !userId) return;
    load();
    markRoomRead(userId, room).catch(() => {});

    const channel = supabase
      .channel(`community-${room}-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages", filter: `room=eq.${room}` }, (payload) => {
        const msg = payload.new as CommunityMessage;
        setMessages((prev) => (prev ? (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]) : prev));
        markRoomRead(userId, room).catch(() => {});
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_messages", filter: `room=eq.${room}` }, (payload) => {
        const msg = payload.new as CommunityMessage;
        setMessages((prev) => prev?.map((m) => (m.id === msg.id ? { ...m, pinned_at: msg.pinned_at } : m)) ?? prev);
        setPinned((prev) => (msg.pinned_at ? msg : prev?.id === msg.id ? null : prev));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_messages" }, (payload) => {
        const id = (payload.old as { id?: string })?.id;
        if (id) setMessages((prev) => prev?.filter((m) => m.id !== id) ?? prev);
      })
      .subscribe();
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [room, allowed, userId, load]);

  // Saran @mention: kata terakhir yang diawali "@".
  useEffect(() => {
    const m = /@([^\s@]{0,24})$/.exec(text);
    if (!m || !canWrite) {
      setSuggest([]);
      return;
    }
    const handle = setTimeout(() => {
      searchMentions(room, m[1]).then(setSuggest).catch(() => setSuggest([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [text, room, canWrite]);

  if (!session || !userId) return <Redirect href="/login" />;

  function pickMention(p: { id: string; name: string }) {
    setText((v) => v.replace(/@([^\s@]{0,24})$/, `@${p.name} `));
    setMentioned((m) => new Map(m).set(p.id, p.name));
    setSuggest([]);
  }

  async function send(photoUri: string | null): Promise<boolean> {
    setError(null);
    const body = text.trim();
    const mentions = Array.from(mentioned.entries())
      .filter(([, name]) => body.includes(`@${name}`))
      .map(([id]) => id);
    try {
      const msg = await sendCommunity({ room, body, replyTo: replyTo?.id ?? null, mentions, photoUri });
      setMessages((prev) => (prev ? (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]) : [msg]));
      setText("");
      setReplyTo(null);
      setMentioned(new Map());
      return true;
    } catch (err) {
      setError(chatError(err));
      return false;
    }
  }

  function openActions(m: CommunityMessage) {
    const options: { label: string; run: () => void; destructive?: boolean }[] = [];
    if (canWrite) options.push({ label: t("Balas"), run: () => setReplyTo(m) });
    if (m.user_id !== userId)
      options.push({
        label: t("Laporkan ke admin"),
        run: () =>
          messageAction(m.id, "report")
            .then(() => Alert.alert(t("Terima kasih"), t("Laporan terkirim ke admin.")))
            .catch((err) => Alert.alert(t("Gagal"), t(chatError(err)))),
      });
    if (isAdmin) {
      options.push({ label: m.pinned_at ? t("Lepas sematan") : t("Sematkan"), run: () => messageAction(m.id, m.pinned_at ? "unpin" : "pin").then(load) });
      options.push({
        label: t("Hapus pesan"),
        destructive: true,
        run: () =>
          Alert.alert(t("Hapus pesan"), t("Pesan ini akan dihapus untuk semua member."), [
            { text: t("Batal"), style: "cancel" },
            { text: t("Hapus"), style: "destructive", onPress: () => deleteCommunityMessage(m.id).then(load) },
          ]),
      });
    }
    if (options.length === 0) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options.map((o) => o.label), t("Batal")], cancelButtonIndex: options.length, destructiveButtonIndex: options.findIndex((o) => o.destructive) },
        (i) => options[i]?.run()
      );
    } else {
      Alert.alert(m.author_name, undefined, [...options.map((o) => ({ text: o.label, onPress: o.run, style: o.destructive ? ("destructive" as const) : undefined })), { text: t("Batal"), style: "cancel" as const }]);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right", "bottom"]}>
      <GlassBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
          <BackHeader title="Komunitas" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {ROOMS.map((r) => {
              const active = r === room;
              const locked = !canAccessRoom(tier, r);
              return (
                <Pressable
                  key={r}
                  onPress={() => setRoom(r)}
                  style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySubtle : colors.surface }]}
                >
                  {locked && <Ionicons name="lock-closed" size={12} color={colors.textMuted} />}
                  <T variant="bodySm" style={{ fontWeight: "600", color: active ? colors.primary : colors.textSecondary }}>{ROOM_LABEL[r]}</T>
                </Pressable>
              );
            })}
          </ScrollView>
          {pinned && (
            <View style={[styles.pinned, { backgroundColor: colors.warningSubtle }]}>
              <Ionicons name="pin" size={14} color={colors.warning} />
              <T variant="caption" style={{ flex: 1 }} numberOfLines={2}>
                <T variant="caption" style={{ fontWeight: "700" }}>{pinned.author_name}: </T>
                {pinned.body || "📷"}
              </T>
            </View>
          )}
        </View>

        {!allowed ? (
          <View style={styles.center}>
            <Ionicons name="lock-closed-outline" size={36} color={colors.textMuted} />
            <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>
              {t("Ruang {room} khusus member {room}.", { room: ROOM_LABEL[room] })}
            </T>
          </View>
        ) : messages === null ? (
          error ? (
            <View style={styles.center}>
              <T variant="bodySm" color="textMuted">{error}</T>
            </View>
          ) : (
            <View style={{ padding: 16 }}>
              <ChatSkeleton />
            </View>
          )
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<T variant="bodySm" color="textMuted" style={{ textAlign: "center" }}>Belum ada pesan. Sapa member lain!</T>}
            renderItem={({ item: m }) => {
              const mine = m.user_id === userId;
              return (
                <Pressable onLongPress={() => openActions(m)} delayLongPress={300} style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                  <View style={[styles.bubble, { backgroundColor: mine ? colors.primarySubtle : colors.surface, borderColor: colors.border }]}>
                    {!mine && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <T variant="caption" style={{ fontWeight: "700" }}>{m.author_name}</T>
                        {m.is_admin ? <Badge label="Admin" tone="primary" /> : m.author_tier !== "FREE" ? <Badge label={m.author_tier} tone="muted" /> : null}
                      </View>
                    )}
                    {m.reply_to && (
                      <View style={[styles.quote, { borderLeftColor: colors.primary }]}>
                        <T variant="caption" color="textMuted" numberOfLines={2}>
                          <T variant="caption" style={{ fontWeight: "700" }} color="textSecondary">{m.reply_name}: </T>
                          {m.reply_excerpt}
                        </T>
                      </View>
                    )}
                    {m.image_key && <AuthImage path={communityImagePath(m.image_key)} style={styles.image} />}
                    {m.body ? <T variant="bodySm">{m.body}</T> : null}
                    <T variant="caption" color="textMuted" style={{ fontSize: 10, alignSelf: "flex-end" }}>
                      {m.pinned_at ? "📌 " : ""}
                      {formatDateTimeWib(m.created_at)}
                    </T>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {allowed && canWrite && (
          <ChatComposer
            value={text}
            onChangeText={setText}
            onSend={send}
            maxLength={COMMUNITY_MAX_LEN}
            top={
              <>
                {error && messages !== null && <T variant="caption" color="error">{error}</T>}
                {replyTo && (
                  <View style={[styles.replyBar, { backgroundColor: colors.surface2 }]}>
                    <T variant="caption" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
                      {t("Membalas {name}", { name: replyTo.author_name })}: {replyTo.body || "📷"}
                    </T>
                    <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                )}
                {suggest.length > 0 && (
                  <View style={[styles.suggest, { backgroundColor: colors.surface2 }]}>
                    {suggest.map((p) => (
                      <Pressable key={p.id} onPress={() => pickMention(p)} style={styles.suggestItem}>
                        <T variant="bodySm">@{p.name}</T>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            }
          />
        )}
        {allowed && !canWrite && (
          <T variant="caption" color="textMuted" style={{ textAlign: "center", padding: 12 }}>Hanya admin yang bisa menulis di ruang Pengumuman.</T>
        )}
        {allowed && canWrite && <T variant="caption" color="textMuted" style={{ textAlign: "center", paddingBottom: 6 }}>Tekan lama pesan untuk membalas atau melaporkan.</T>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pinned: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, padding: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  bubble: { maxWidth: "85%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  quote: { borderLeftWidth: 3, paddingLeft: 8 },
  image: { width: 220, height: 220, borderRadius: 10 },
  replyBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 8 },
  suggest: { borderRadius: 10, paddingVertical: 4 },
  suggestItem: { paddingHorizontal: 12, paddingVertical: 8 },
});
