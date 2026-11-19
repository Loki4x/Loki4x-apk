import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Beranda", icon: "home-outline" },
  { name: "signals", title: "Sinyal", icon: "pulse-outline" },
  { name: "journal", title: "Journal", icon: "book-outline" },
  { name: "academy", title: "Akademi", icon: "school-outline" },
  { name: "account", title: "Akun", icon: "person-circle-outline" },
];

export default function TabsLayout() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} color={String(color)} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
