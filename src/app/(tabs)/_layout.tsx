import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FloatingTabBar, TAB_BAR_GAP, TAB_BAR_HEIGHT } from "@/components/FloatingTabBar";
import { TabInsetContext } from "@/components/ui";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Beranda", icon: "home-outline" },
  { name: "signals", title: "Sinyal", icon: "pulse-outline" },
  { name: "journal", title: "Journal", icon: "book-outline" },
  { name: "academy", title: "Akademi", icon: "school-outline" },
  { name: "account", title: "Akun", icon: "person-circle-outline" },
];

const ICONS: Record<string, IconName> = Object.fromEntries(TABS.map((t) => [t.name, t.icon]));

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
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
    <TabInsetContext.Provider value={TAB_BAR_HEIGHT + TAB_BAR_GAP + insets.bottom + 24}>
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} icons={ICONS} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
          }}
        />
      ))}
    </Tabs>
    </TabInsetContext.Provider>
  );
}
