import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { trNode, useI18n } from "@/lib/i18n";
import { GlassBackground } from "@/components/GlassBackground";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/** Tinggi ruang di bawah konten supaya tidak tertutup bottom bar melayang (diisi oleh layout tab). */
export const TabInsetContext = createContext(0);

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
  const { colors, isDark } = useTheme();
  const inset = useContext(TabInsetContext);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <GlassBackground />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, inset > 0 && { paddingBottom: inset }]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={isDark ? "#0D1321" : "#FFFFFF"}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }, inset > 0 && { paddingBottom: inset }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, glass, isDark } = useTheme();
  // Konten muncul halus (naik sedikit + memudar masuk) saat kartu pertama tampil, misalnya setelah skeleton.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        // Kilau tipis di tepi atas kaca.
        glass && { borderTopColor: isDark ? "rgba(255,255,255,0.18)" : "#FFFFFF" },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
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
  onPress,
}: {
  children: ReactNode;
  variant?: TextVariant;
  color?: keyof ThemeColors;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  useI18n(); // render ulang saat bahasa diganti
  return (
    <Text numberOfLines={numberOfLines} onPress={onPress} style={[TEXT_SIZES[variant], { color: colors[color] }, style]}>
      {trNode(children)}
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
  const { t } = useI18n();
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
        <Text style={{ color: primary ? "#FFFFFF" : colors.text, fontWeight: "600", fontSize: 15 }}>{t(title)}</Text>
      )}
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone: "success" | "error" | "warning" | "primary" | "muted" }) {
  const { colors } = useTheme();
  const { t } = useI18n();
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
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700" }}>{t(label)}</Text>
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

// ---------- Skeleton (kerangka berkilau saat memuat, sama dengan web) ----------

/** Satu blok abu-abu dengan kilau yang bergerak dari kiri ke kanan. */
export function Skeleton({ height = 14, width = "100%", radius = 10, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { isDark } = useTheme();
  const [w, setW] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const shine = isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.85)";
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ height, width, borderRadius: radius, overflow: "hidden", backgroundColor: isDark ? "rgba(148,163,184,0.12)" : "rgba(28,31,38,0.07)" }, style]}
    >
      {w > 0 && (
        <Animated.View
          style={{ position: "absolute", top: 0, bottom: 0, width: w, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-w, w] }) }] }}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="sk" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={shine} stopOpacity={0} />
                <Stop offset="0.5" stopColor={shine} stopOpacity={1} />
                <Stop offset="1" stopColor={shine} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#sk)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

type SkeletonVariant = "list" | "dashboard" | "kpi" | "detail" | "grid";

/** Kerangka satu halaman saat data dimuat. Bentuknya mengikuti tata letak halaman (daftar kartu, KPI, dll). */
export function SkeletonPage({ variant = "list", count = 3 }: { variant?: SkeletonVariant; count?: number }) {
  const { colors } = useTheme();
  const box = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const kpi = (
    <View style={box}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, gap: 6 }}>
            <Skeleton height={10} width="60%" />
            <Skeleton height={18} />
          </View>
        ))}
      </View>
    </View>
  );
  const listCard = (i: number) => (
    <View key={i} style={box}>
      <Skeleton height={18} width="55%" />
      <Skeleton height={32} />
      <Skeleton height={12} width="70%" />
    </View>
  );
  return (
    <View style={{ gap: 14 }}>
      {variant === "dashboard" && (
        <>
          <View style={box}>
            <Skeleton height={18} width="45%" />
            <Skeleton height={34} />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={8} />
            ))}
          </View>
          <View style={box}>
            <Skeleton height={10} width="35%" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} height={62} width="22%" style={{ flexGrow: 1 }} radius={14} />
              ))}
            </View>
          </View>
        </>
      )}
      {variant === "kpi" && (
        <>
          {kpi}
          <Skeleton height={46} radius={999} />
          {Array.from({ length: count }, (_, i) => listCard(i))}
        </>
      )}
      {variant === "detail" && (
        <View style={box}>
          <Skeleton height={22} width="50%" />
          <Skeleton height={14} width="80%" />
          <Skeleton height={140} radius={14} />
          <Skeleton height={14} />
          <Skeleton height={14} width="65%" />
        </View>
      )}
      {variant === "grid" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {Array.from({ length: count * 2 }, (_, i) => (
            <Skeleton key={i} height={150} width="47%" style={{ flexGrow: 1 }} radius={18} />
          ))}
        </View>
      )}
      {variant === "list" && Array.from({ length: count }, (_, i) => listCard(i))}
    </View>
  );
}
