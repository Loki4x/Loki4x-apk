import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { pickPhoto } from "@/lib/media";

/** Kolom tulis pesan + lampiran foto. `onSend` mengembalikan true kalau berhasil (kolom dikosongkan). */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  maxLength,
  placeholder = "Tulis pesan…",
  top,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSend: (photoUri: string | null) => Promise<boolean>;
  maxLength: number;
  placeholder?: string;
  /** Konten di atas kolom (mis. balasan / saran @mention). */
  top?: ReactNode;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    if (sending || (!value.trim() && !photo)) return;
    setSending(true);
    try {
      if (await onSend(photo)) setPhoto(null);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.wrap, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
      {top}
      {photo && (
        <View style={styles.preview}>
          <Image source={{ uri: photo }} style={styles.thumb} />
          <T variant="caption" color="textMuted" style={{ flex: 1 }}>Foto siap dikirim</T>
          <Pressable onPress={() => setPhoto(null)} hitSlop={10}>
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      )}
      <View style={styles.row}>
        <Pressable
          onPress={async () => {
            const uri = await pickPhoto().catch(() => null);
            if (uri) setPhoto(uri);
          }}
          hitSlop={8}
          style={styles.icon}
        >
          <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={t(placeholder)}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={maxLength}
          style={[styles.input, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text }]}
        />
        <Pressable onPress={send} disabled={sending} style={[styles.send, { backgroundColor: colors.primary, opacity: value.trim() || photo ? 1 : 0.5 }]}>
          {sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 6 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  icon: { paddingBottom: 9 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, maxHeight: 120 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  preview: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
});
