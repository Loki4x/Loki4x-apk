import { useEffect } from "react";
import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { routeForUrl } from "@/lib/push";
import { loadSavedLocale } from "@/lib/i18n";

/** Notifikasi ditekan -> buka layar yang sesuai (juga saat aplikasi dibuka dari notifikasi). */
function useNotificationRouting() {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const url = response.notification.request.content.data?.url;
      // Tunda sebentar supaya navigator sudah siap saat aplikasi baru dibuka.
      setTimeout(() => router.push(routeForUrl(url)), 50);
    };
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        open(r);
        if (r) Notifications.clearLastNotificationResponseAsync().catch(() => {});
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}

function RootStack() {
  const { colors, isDark } = useTheme();
  useNotificationRouting();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    loadSavedLocale();
  }, []);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
