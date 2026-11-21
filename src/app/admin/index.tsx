import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Screen, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { fetchAdminData, type AdminCounts } from "@/lib/admin";

type IconName = keyof typeof Ionicons.glyphMap;
type Item = { title: string; desc: string; icon: IconName; href: string; badge?: keyof AdminCounts };

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Ringkasan",
    items: [
      { title: "Dashboard", desc: "Signup, konversi, pendapatan, dan member yang segera berakhir.", icon: "stats-chart-outline", href: "/admin/dashboard" },
      { title: "Users", desc: "Ubah tier & masa aktif, tangguhkan akun, lihat statistik trading.", icon: "people-outline", href: "/admin/users" },
    ],
  },
  {
    label: "Pembayaran",
    items: [
      { title: "VIP Requests", desc: "Setujui atau tolak pengajuan VIP via IB broker.", icon: "ribbon-outline", href: "/admin/vip-requests", badge: "vipPending" },
      { title: "Pembayaran USDT", desc: "Cek bukti transfer lalu approve / reject.", icon: "wallet-outline", href: "/admin/usdt-payments", badge: "usdtPending" },
      { title: "Kode Promo", desc: "Buat kode diskon dan aktifkan / nonaktifkan.", icon: "pricetag-outline", href: "/admin/promo-codes" },
      { title: "Referral", desc: "Daftar referral dan hadiahnya.", icon: "gift-outline", href: "/admin/referrals" },
    ],
  },
  {
    label: "Konten",
    items: [
      { title: "Sinyal", desc: "Posting sinyal baru, update status/hasil, kirim update (SL ke BE, partial, dll).", icon: "pulse-outline", href: "/admin/signals" },
      { title: "Akademi", desc: "Tambah/hapus video dan soal kuis per kategori.", icon: "school-outline", href: "/admin/academy" },
      { title: "Economic News", desc: "Kelola kalender berita ekonomi manual.", icon: "newspaper-outline", href: "/admin/news" },
      { title: "Actual Berita", desc: "Isi nilai Actual setelah berita rilis.", icon: "create-outline", href: "/admin/calendar-actuals" },
      { title: "Positioning", desc: "Kelola data long/short per simbol.", icon: "swap-vertical-outline", href: "/admin/positioning" },
      { title: "Link Page", desc: "Halaman link ala Linktree: foto profil, bio, tema, sosmed, dan daftar link.", icon: "link-outline", href: "/admin/links" },
    ],
  },
  {
    label: "Komunikasi",
    items: [
      { title: "Live Chat", desc: "Balas pesan dari user yang menghubungi support.", icon: "chatbubbles-outline", href: "/admin/chat", badge: "chatUnread" },
      { title: "Kirim Notifikasi", desc: "Kirim notifikasi push, website, dan email ke member.", icon: "megaphone-outline", href: "/admin/notify" },
      { title: "Audit Log", desc: "Catatan aksi admin dan sistem (300 terbaru).", icon: "document-text-outline", href: "/admin/audit-log" },
    ],
  },
];

/** Menu admin (hanya untuk akun admin): semua menu panel admin web. */
export default function AdminHome() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [counts, setCounts] = useState<AdminCounts | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (profile?.is_admin) fetchAdminData<AdminCounts>("counts").then(setCounts).catch(() => {});
    }, [profile?.is_admin])
  );

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  return (
    <Screen>
      <BackHeader title="Admin" fallback="/account" />
      {GROUPS.map((g) => (
        <View key={g.label} style={{ gap: 10 }}>
          <T variant="label" color="textMuted">{g.label}</T>
          {g.items.map((it) => {
            const n = it.badge && counts ? counts[it.badge] : 0;
            return (
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
                    {n > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.error }]}>
                        <T variant="caption" style={{ color: "#FFFFFF", fontWeight: "700" }}>{n > 99 ? "99+" : String(n)}</T>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </Card>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
});
