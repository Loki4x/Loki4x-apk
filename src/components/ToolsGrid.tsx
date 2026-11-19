import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, T } from "@/components/ui";
import { hasAccess, type Tier } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Menu fitur lain (sama dengan menu samping di web). Fitur yang terkunci tetap tampil dengan gembok. */
const TOOLS: { title: string; icon: IconName; href: string; tier: Tier }[] = [
  { title: "Lot Calculator", icon: "calculator-outline", href: "/calculator", tier: "MEMBERSHIP" },
  { title: "Report", icon: "bar-chart-outline", href: "/reports", tier: "MEMBERSHIP" },
  { title: "Kalender Ekonomi", icon: "calendar-outline", href: "/calendar", tier: "FREE" },
  { title: "Fundamental Pasar", icon: "newspaper-outline", href: "/market-news", tier: "MEMBERSHIP" },
  { title: "COT", icon: "business-outline", href: "/cot", tier: "VIP" },
  { title: "Retail Bias", icon: "people-outline", href: "/positioning", tier: "VIP" },
  { title: "Komunitas", icon: "chatbubbles-outline", href: "/community", tier: "FREE" },
  { title: "Chat Admin", icon: "headset-outline", href: "/chat", tier: "FREE" },
];

export function ToolsGrid({ tier }: { tier: Tier }) {
  const { colors } = useTheme();
  return (
    <Card>
      <T variant="label" color="textMuted">Tools & Analisa</T>
      <View style={styles.grid}>
        {TOOLS.map((tool) => {
          const locked = !hasAccess(tier, tool.tier);
          return (
            <Pressable
              key={tool.href}
              onPress={() => (locked ? router.push("/upgrade") : router.push(tool.href))}
              style={({ pressed }) => [styles.item, { backgroundColor: colors.surface2, opacity: pressed ? 0.8 : 1 }]}
            >
              <View>
                <Ionicons name={tool.icon} size={22} color={locked ? colors.textMuted : colors.primary} />
                {locked && (
                  <View style={[styles.lock, { backgroundColor: colors.surface }]}>
                    <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
                  </View>
                )}
              </View>
              <T variant="caption" style={{ textAlign: "center", fontWeight: "600" }} color={locked ? "textMuted" : "text"} numberOfLines={2}>
                {tool.title}
              </T>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  item: { width: "23%", flexGrow: 1, alignItems: "center", gap: 6, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4 },
  lock: { position: "absolute", right: -8, bottom: -4, borderRadius: 8, padding: 2 },
});
