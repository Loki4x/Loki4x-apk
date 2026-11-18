import { Pressable, StyleSheet, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/components/ui";
import { useTheme } from "@/lib/theme";

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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  hint?: string;
  autoCapitalize?: "none" | "characters" | "sentences";
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <T variant="bodySm" color="textSecondary">{label}</T>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
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

/** Angka dari keyboard HP: koma desimal ("1,25") diubah jadi titik. */
export const normalizeNumber = (v: string) => v.trim().replace(",", ".");

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});
