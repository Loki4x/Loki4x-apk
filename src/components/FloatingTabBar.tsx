import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useTheme } from "@/lib/theme";
import { trNode } from "@/lib/i18n";

type IconName = keyof typeof Ionicons.glyphMap;

/** Tinggi pill + jarak dari bawah; dipakai juga untuk ruang kosong di bawah konten layar tab. */
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_GAP = 14;

const CAPSULE_WIDTH = 64;

/** Ikon tab: versi garis saat tidak aktif, versi terisi saat aktif (mis. home-outline → home). */
function filled(icon: IconName): IconName {
  const name = icon.replace(/-outline$/, "") as IconName;
  return name in Ionicons.glyphMap ? name : icon;
}

function TabItem({
  label,
  icon,
  focused,
  onPress,
  onLongPress,
  onLayout,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 6, tension: 140 }).start();
  }, [focused, scale]);
  const color = focused ? colors.primary : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      style={styles.item}
      android_ripple={{ color: "rgba(95,133,219,0.18)", borderless: true, radius: 34 }}
    >
      <Animated.View
        style={{
          transform: [
            { scale: scale.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
            { translateY: scale.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
          ],
        }}
      >
        <Ionicons name={focused ? filled(icon) : icon} size={23} color={color} />
      </Animated.View>
      <Animated.Text numberOfLines={1} style={[styles.label, { color }]}>
        {trNode(label)}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * Bottom bar melayang berbentuk pill dengan kapsul yang bergeser ke tab yang ditekan.
 * Gaya glass: kaca transparan; gaya normal: permukaan solid.
 */
export function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  icons,
}: BottomTabBarProps & { icons: Record<string, IconName> }) {
  const { colors, glass, isDark } = useTheme();
  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});
  const x = useRef(new Animated.Value(0)).current;
  const ready = useRef(false);

  const target = layouts[state.index];
  useEffect(() => {
    if (!target) return;
    const to = target.x + (target.width - CAPSULE_WIDTH) / 2;
    if (!ready.current) {
      x.setValue(to);
      ready.current = true;
      return;
    }
    Animated.spring(x, { toValue: to, useNativeDriver: true, friction: 8, tension: 90 }).start();
  }, [target, x]);

  const barColor = glass ? (isDark ? "rgba(22, 30, 50, 0.72)" : "rgba(255, 255, 255, 0.78)") : colors.surface;
  const borderColor = glass ? (isDark ? "rgba(255,255,255,0.12)" : "#FFFFFF") : colors.border;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) + TAB_BAR_GAP - 8 }]}>
      {/* Bayangan Android (elevation) tembus pada latar transparan, jadi gaya glass tanpa elevation. */}
      <View style={[styles.pill, { backgroundColor: barColor, borderColor }, glass ? styles.glassEdge : isDark ? styles.shadowDark : styles.shadowLight]}>
        {target && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.capsule,
              { backgroundColor: glass ? "rgba(95,133,219,0.22)" : colors.primarySubtle, borderColor: "rgba(95,133,219,0.35)" },
              { transform: [{ translateX: x }] },
            ]}
          />
        )}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = index === state.index;
          const icon = icons[route.name] ?? "ellipse-outline";
          const label = typeof options.title === "string" ? options.title : route.name;
          return (
            <TabItem
              key={route.key}
              label={label}
              icon={icon}
              focused={focused}
              onLayout={(e) => {
                const { x: lx, width } = e.nativeEvent.layout;
                setLayouts((l) => (l[index]?.x === lx && l[index]?.width === width ? l : { ...l, [index]: { x: lx, width } }));
              }}
              onPress={() => {
                const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14 },
  pill: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
  },
  shadowDark: { shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  shadowLight: { shadowColor: "#283C6E", shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  glassEdge: { shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  capsule: { position: "absolute", left: 0, top: 8, width: CAPSULE_WIDTH, height: TAB_BAR_HEIGHT - 18, borderRadius: 26, borderWidth: 1 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: "100%" },
  label: { fontSize: 10.5, fontWeight: "600" },
});

