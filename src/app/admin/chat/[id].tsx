import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonPage, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { ChatComposer } from "@/components/ChatComposer";
import { GlassBackground } from "@/components/GlassBackground";
import { AuthImage, chatImagePath } from "@/components/AuthImage";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { formatDateTimeWib } from "@/lib/format";
import { CHAT_MAX_LEN, fetchSupportMessages, type SupportMessage } from "@/lib/chat";
import { friendlyApiError } from "@/lib/journal";
import { adminChatPatch, adminChatReply } from "@/lib/admin";

const POLL_MS = 20_000;

/** Percakapan Live Chat dengan satu user (admin membalas). */
export default function AdminChatThreadScreen() {
  const { id, name, email } = useLocalSearchParams<{ id: string; name?: string; email?: string }>();
  const threadId = String(id);
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [status, setStatus] = useState<"OPEN" | "CLOSED" | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<SupportMessage>>(null);
  const isAdmin = !!profile?.is_admin;

  const load = useCallback(async () => {
    setMessages(await fetchSupportMessages(threadId));
    const { data } = await supabase.from("chat_threads").select("status").eq("id", threadId).maybeSingle();
    if (data) setStatus(data.status as "OPEN" | "CLOSED");
  }, [threadId]);

  useEffect(() => {
    if (!isAdmin) return;
    load().catch(() => setMessages([]));
    adminChatPatch(threadId, { read: true }).catch(() => {});
    const channel = supabase
      .channel(`admin-chat-${threadId}-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` }, (payload) => {
        const msg = payload.new as SupportMessage;
        setMessages((prev) => (prev ? (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]) : [msg]));
        if (msg.sender_role === "USER") adminChatPatch(threadId, { read: true }).catch(() => {});
      })
      .subscribe();
    const timer = setInterval(() => fetchSupportMessages(threadId).then(setMessages).catch(() => {}), POLL_MS);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [threadId, isAdmin, load]);

  if (!session) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/account" />;

  async function send(photoUri: string | null): Promise<boolean> {
    setError(null);
    try {
      const res = await adminChatReply(threadId, text.trim(), photoUri);
      setMessages((prev) => (prev ? (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]) : [res.message]));
      setText("");
      setStatus("OPEN");
      return true;
    } catch (err) {
      setError(friendlyApiError(err));
      return false;
    }
  }

  async function toggleStatus() {
    const next = status === "CLOSED" ? "OPEN" : "CLOSED";
    setStatus(next);
    await adminChatPatch(threadId, { status: next }).catch(() => setStatus(status));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right", "bottom"]}>
      <GlassBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 4 }}>
          <BackHeader title={name ? String(name) : "Live Chat"} fallback="/admin/chat" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <T variant="caption" color="textMuted" style={{ flex: 1 }} numberOfLines={1}>{email ? String(email) : ""}</T>
            {status && (
              <T variant="caption" color="primary" style={{ fontWeight: "700" }} onPress={toggleStatus}>
                {status === "CLOSED" ? "Buka lagi" : "Tutup percakapan"}
              </T>
            )}
          </View>
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
            ListEmptyComponent={<T variant="bodySm" color="textMuted" style={{ textAlign: "center" }}>Belum ada pesan.</T>}
            renderItem={({ item: m }) => {
              const mine = m.sender_role === "ADMIN";
              return (
                <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                  <View style={[styles.bubble, { backgroundColor: mine ? colors.primarySubtle : colors.surface, borderColor: colors.border }]}>
                    {!mine && <T variant="caption" color="primary" style={{ fontWeight: "700" }}>{name ? String(name) : "User"}</T>}
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
          placeholder="Tulis balasan…"
          top={error ? <T variant="caption" color="error">{error}</T> : undefined}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "85%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  image: { width: 220, height: 220, borderRadius: 10 },
});
