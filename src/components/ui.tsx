import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, type ThemeColors } from "@/lib/theme";

export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.screenContent}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surface}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

type TextVariant = "h1" | "h2" | "h3" | "body" | "bodySm" | "caption" | "label";

const TEXT_SIZES: Record<TextVariant, TextStyle> = {
  h1: { fontSize: 26, fontWeight: "700" },
  h2: { fontSize: 22, fontWeight: "700" },
  h3: { fontSize: 18, fontWeight: "600" },
  body: { fontSize: 15 },
  bodySm: { fontSize: 13 },
  caption: { fontSize: 11 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
};

export function T({
  children,
  variant = "body",
  color = "text",
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: TextVariant;
  color?: keyof ThemeColors;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[TEXT_SIZES[variant], { color: colors[color] }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? colors.primary : colors.surface2,
          borderColor: primary ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? "#FFFFFF" : colors.text} />
      ) : (
        <Text style={{ color: primary ? "#FFFFFF" : colors.text, fontWeight: "600", fontSize: 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone: "success" | "error" | "warning" | "primary" | "muted" }) {
  const { colors } = useTheme();
  const map = {
    success: [colors.successSubtle, colors.success],
    error: [colors.errorSubtle, colors.error],
    warning: [colors.warningSubtle, colors.warning],
    primary: [colors.primarySubtle, colors.primary],
    muted: [colors.surface2, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ percent, color }: { percent: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
      <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: "100%", backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: 16, paddingBottom: 32, gap: 14 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  button: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  track: { height: 8, borderRadius: 99, overflow: "hidden" },
});
