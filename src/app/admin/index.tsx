import { Pressable, StyleSheet, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Screen, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const ITEMS: { title: string; desc: string; icon: IconName; href: string }[] = [
  { title: "Sinyal", desc: "Posting sinyal baru, update status/hasil, kirim update (SL ke BE, partial, dll).", icon: "pulse-outline", href: "/admin/signals" },
  { title: "Akademi", desc: "Tambah/hapus video dan soal kuis per kategori.", icon: "school-outline", href: "/admin/academy" },
  { title: "Pengumuman", desc: "Kirim notifikasi push, website, dan email ke member.", icon: "megaphone-outline", href: "/admin/notify" },
];

/** Menu admin (hanya untuk akun admin). Menu lain (user, pembayaran, promo, dll) tetap di panel admin web. */
export default function AdminHome() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  return (
    <Screen>
      <BackHeader title="Admin" fallback="/account" />
      {ITEMS.map((it) => (
        <Pressable key={it.href} onPress={() => router.push(it.href)}>
          {({ pressed }) => (
            <Card style={[styles.row, { opacity: pressed ? 0.85 : 1 }]}>
              <View style={[styles.icon, { backgroundColor: colors.primarySubtle }]}>
                <Ionicons name={it.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="h3">{it.title}</T>
                <T variant="caption" color="textSecondary">{it.desc}</T>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Card>
          )}
        </Pressable>
      ))}
      <T variant="caption" color="textMuted">
        Kelola user, pembayaran USDT, pengajuan VIP, kode promo, dan data lain tetap lewat panel admin di web.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
