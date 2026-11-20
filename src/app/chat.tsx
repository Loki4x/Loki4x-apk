import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SkeletonPage, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { ChatComposer } from "@/components/ChatComposer";
import { GlassBackground } from "@/components/GlassBackground";
import { AuthImage, chatImagePath } from "@/components/AuthImage";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { formatDateTimeWib } from "@/lib/format";
import { ADMIN_CONTACT_LINK } from "@/lib/upgrade";
import {
  CHAT_MAX_LEN,
  chatError,
  fetchSupportMessages,
  fetchSupportThread,
  markSupportRead,
  sendSupport,
  type SupportMessage,
} from "@/lib/chat";

const POLL_MS = 20_000;

/** Chat langsung dengan admin (sama dengan widget chat di web). */
export default function SupportChatScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<SupportMessage>>(null);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const thread = await fetchSupportThread(userId).catch(() => null);
    if (!thread) {
      setMessages((m) => m ?? []);
      return;
    }
    setThreadId(thread.id);
    setMessages(await fetchSupportMessages(thread.id));
    if (thread.user_unread) markSupportRead();
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Balasan admin masuk secara realtime (+ cadangan polling).
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`chat-${threadId}-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` }, (payload) => {
        const msg = payload.new as SupportMessage;
        setMessages((prev) => (prev ? (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]) : [msg]));
        if (msg.sender_role === "ADMIN") markSupportRead();
      })
      .subscribe();
    const timer = setInterval(() => fetchSupportMessages(threadId).then(setMessages).catch(() => {}), POLL_MS);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  if (!session) return <Redirect href="/login" />;

  async function send(photoUri: string | null): Promise<boolean> {
    setError(null);
    try {
      const res = await sendSupport(text.trim(), photoUri);
      setThreadId(res.threadId);
      setMessages((prev) => (prev ? (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]) : [res.message]));
      setText("");
      return true;
    } catch (err) {
      setError(chatError(err));
      return false;
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right", "bottom"]}>
      <GlassBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 6 }}>
          <BackHeader title="Chat Admin" />
          <T variant="caption" color="textMuted">
            Tanya soal akun, pembayaran, atau fitur. Admin biasanya membalas dalam beberapa jam. Atau hubungi lewat{" "}
            <T variant="caption" color="primary" style={{ fontWeight: "700" }} onPress={() => Linking.openURL(ADMIN_CONTACT_LINK)}>
              Telegram
            </T>
            .
          </T>
        </View>
        {messages === null ? (
          <View style={{ padding: 16 }}>
            <SkeletonPage variant="list" count={4} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
                <T variant="bodySm" color="textMuted" style={{ textAlign: "center" }}>Belum ada percakapan. Kirim pesan pertama kamu ke admin.</T>
              </View>
            }
            renderItem={({ item: m }) => {
              const mine = m.sender_role === "USER";
              return (
                <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                  <View style={[styles.bubble, { backgroundColor: mine ? colors.primarySubtle : colors.surface, borderColor: colors.border }]}>
                    {!mine && <T variant="caption" color="primary" style={{ fontWeight: "700" }}>Admin Loki4x</T>}
                    {m.image_key && <AuthImage path={chatImagePath(m.image_key)} style={styles.image} />}
                    {m.body ? <T variant="bodySm">{m.body}</T> : null}
                    <T variant="caption" color="textMuted" style={{ fontSize: 10, alignSelf: "flex-end" }}>{formatDateTimeWib(m.created_at)}</T>
                  </View>
                </View>
              );
            }}
          />
        )}
        <ChatComposer
          value={text}
          onChangeText={setText}
          onSend={send}
          maxLength={CHAT_MAX_LEN}
          top={error ? <T variant="caption" color="error">{error}</T> : undefined}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  bubble: { maxWidth: "85%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  image: { width: 220, height: 220, borderRadius: 10 },
});
