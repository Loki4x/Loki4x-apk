import { Pressable, StyleSheet, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { Linking } from "react-native";
import { router } from "expo-router";
import { WEB_URL } from "@/lib/config";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

export function BackHeader({ title, fallback = "/" }: { title: string; fallback?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <T variant="h3" style={{ flex: 1 }}>{title}</T>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  hint,
  autoCapitalize = "none",
  secure,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  hint?: string;
  autoCapitalize?: "none" | "characters" | "sentences";
  /** Sembunyikan isi (kata sandi). */
  secure?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <T variant="bodySm" color="textSecondary">{label}</T>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ? t(placeholder) : placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        secureTextEntry={secure}
        style={[
          styles.input,
          { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text },
          multiline && { minHeight: 84, textAlignVertical: "top" },
        ]}
      />
      {hint ? <T variant="caption" color="textMuted">{hint}</T> : null}
    </View>
  );
}

export function OptionChips<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="bodySm" color="textSecondary">{label}</T>
      <View style={styles.chips}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value || "none"}
              onPress={() => onChange(o.value)}
              style={[
                styles.chip,
                { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySubtle : colors.surface2 },
              ]}
            >
              <T variant="bodySm" style={{ fontWeight: "600", color: active ? colors.primary : colors.textSecondary }}>{o.label}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Checkbox persetujuan S&K (link ke bagian terkait di halaman /terms web). */
export function TermsCheckbox({
  checked,
  onChange,
  anchor,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  anchor: "paket-berbayar" | "vip-ib";
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(!checked)} style={styles.check} hitSlop={6}>
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={checked ? colors.primary : colors.textMuted} />
      <T variant="bodySm" color="textSecondary" style={{ flex: 1 }}>
        Saya sudah membaca dan menyetujui{" "}
        <T variant="bodySm" color="primary" style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${WEB_URL}/terms#${anchor}`)}>
          Syarat & Ketentuan
        </T>
        .
      </T>
    </Pressable>
  );
}

/** Angka dari keyboard HP: koma desimal ("1,25") diubah jadi titik. */
export const normalizeNumber = (v: string) => v.trim().replace(",", ".");

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});
