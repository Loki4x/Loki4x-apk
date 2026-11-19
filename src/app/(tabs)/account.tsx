import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { useI18n, type Locale } from "@/lib/i18n";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { NotificationSettingCard } from "@/components/NotificationSettingCard";
import { useAuth, type Tier } from "@/lib/auth";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { WEB_URL } from "@/lib/config";
import { formatDate } from "@/lib/format";

const TIER_LABEL: Record<Tier, string> = { FREE: "Free", VIP: "VIP", MEMBERSHIP: "Membership" };
const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: "system", label: "Ikuti HP", icon: "phone-portrait-outline" },
  { mode: "dark", label: "Gelap", icon: "moon-outline" },
  { mode: "light", label: "Terang", icon: "sunny-outline" },
];

const LANGS: { locale: Locale; label: string; flag: string }[] = [
  { locale: "id", label: "Indonesia", flag: "🇮🇩" },
  { locale: "en", label: "English", flag: "🇬🇧" },
];

/** app: buka layar di aplikasi; web: buka halaman web. */
const LINKS: { label: string; path: string; icon: keyof typeof Ionicons.glyphMap; app?: boolean }[] = [
  { label: "Upgrade / perpanjang membership", path: "/upgrade", icon: "rocket-outline", app: true },
  { label: "Pengaturan akun & notifikasi", path: "/settings", icon: "settings-outline", app: true },
  { label: "Program referral", path: "/referral", icon: "gift-outline", app: true },
  { label: "Notifikasi", path: "/notifications", icon: "notifications-outline", app: true },
  { label: "Chat Admin", path: "/chat", icon: "headset-outline", app: true },
];

export default function AccountScreen() {
  const { profile, session, signOut } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const tier = profile?.effectiveTier ?? "FREE";

  function confirmSignOut() {
    Alert.alert(t("Keluar"), t("Yakin mau keluar dari akun ini?"), [
      { text: t("Batal"), style: "cancel" },
      { text: t("Keluar"), style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <Screen>
      <T variant="h2">Akun</T>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySubtle }]}>
            <T variant="h3" color="primary">{(profile?.full_name ?? session?.user.email ?? "?").charAt(0).toUpperCase()}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "700" }}>{profile?.full_name ?? "Trader"}</T>
            <T variant="caption" color="textMuted">{session?.user.email}</T>
          </View>
          <Badge label={TIER_LABEL[tier]} tone={tier === "FREE" ? "muted" : "primary"} />
        </View>
        {profile?.vip_expires_at && tier !== "FREE" && (
          <T variant="caption" color="textSecondary">Aktif sampai {formatDate(profile.vip_expires_at)}</T>
        )}
      </Card>

      {profile?.is_admin && (
        <Pressable onPress={() => router.push("/admin")}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, borderColor: colors.primary }}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "700" }}>Menu Admin</T>
              <T variant="caption" color="textMuted">Sinyal, Akademi, pengumuman</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </Pressable>
      )}

      <NotificationSettingCard />

      <Card>
        <T variant="label" color="textMuted">Tampilan</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {THEME_OPTIONS.map((o) => {
            const active = mode === o.mode;
            return (
              <Pressable
                key={o.mode}
                onPress={() => setMode(o.mode)}
                style={[
                  styles.themeOption,
                  { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySubtle : colors.surface2 },
                ]}
              >
                <Ionicons name={o.icon} size={18} color={active ? colors.primary : colors.textSecondary} />
                <T variant="caption" style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: "600" }}>{o.label}</T>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <T variant="label" color="textMuted">Bahasa</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {LANGS.map((o) => {
            const active = locale === o.locale;
            return (
              <Pressable
                key={o.locale}
                onPress={() => setLocale(o.locale)}
                style={[
                  styles.themeOption,
                  { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySubtle : colors.surface2 },
                ]}
              >
                <T variant="body">{o.flag}</T>
                <T variant="caption" style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: "600" }}>{o.label}</T>
              </Pressable>
            );
          })}
        </View>
        <T variant="caption" color="textMuted">Bahasa juga dipakai untuk web, email, dan notifikasi.</T>
      </Card>

      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {LINKS.map((l, i) => (
          <Pressable
            key={l.path}
            onPress={() => (l.app ? router.push(l.path) : Linking.openURL(`${WEB_URL}${l.path}`))}
            style={[styles.link, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
          >
            <Ionicons name={l.icon} size={18} color={colors.textSecondary} />
            <T variant="bodySm" style={{ flex: 1 }}>{l.label}</T>
            <Ionicons name={l.app ? "chevron-forward" : "open-outline"} size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </Card>

      <Button title="Keluar" variant="secondary" onPress={confirmSignOut} />
      <T variant="caption" color="textMuted" style={{ textAlign: "center" }}>
        Loki4x Academy v{Constants.expoConfig?.version ?? "1.0.0"}
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  themeOption: { flex: 1, alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 12, paddingVertical: 10 },
  link: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
});
