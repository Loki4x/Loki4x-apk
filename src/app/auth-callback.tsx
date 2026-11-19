import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { T } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { completeGoogleLogin } from "@/lib/google-auth";

/** Tujuan link loki4x://auth-callback setelah login Google. Menukar kode jadi sesi lalu masuk ke Dashboard. */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (session) return;
    const code = typeof params.code === "string" ? params.code : null;
    if (!code) {
      const timer = setTimeout(() => setFailed(true), 4000);
      return () => clearTimeout(timer);
    }
    completeGoogleLogin(Linking.createURL("auth-callback", { queryParams: { code } })).catch(() => setFailed(true));
  }, [params.code, session]);

  if (session) return <Redirect href="/" />;
  if (failed || params.error_description) return <Redirect href="/login" />;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
      <T variant="bodySm" color="textSecondary">Menyelesaikan login Google…</T>
    </View>
  );
}
