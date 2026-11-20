import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { cacheUsers, membershipOf, type AdminUser, type Tier } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

type Filter = "ALL" | Tier | "SUSPENDED";

const TIER_TONE: Record<Tier, "muted" | "primary" | "success"> = { FREE: "muted", VIP: "primary", MEMBERSHIP: "success" };

/** User Management (sama dengan /admin/users di web). */
export default function AdminUsersScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { data, error, refresh, refreshing } = useAdminData<AdminUser[]>("users");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const shown = useMemo(() => {
    if (!data) return [];
    cacheUsers(data);
    const s = q.trim().toLowerCase();
    return data.filter((u) => {
      const m = membershipOf(u);
      if (filter === "SUSPENDED" ? !u.is_suspended : filter !== "ALL" && m.effective !== filter) return false;
      return !s || (u.full_name ?? "").toLowerCase().includes(s) || (u.email ?? "").toLowerCase().includes(s);
    });
  }, [data, q, filter]);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="Users" fallback="/admin" />
      <View style={[styles.search, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("Cari nama atau email…")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, color: colors.text, paddingVertical: 10 }}
        />
      </View>
      <OptionChips
        label="Filter"
        options={[
          { value: "ALL", label: "Semua" },
          { value: "FREE", label: "Free" },
          { value: "VIP", label: "VIP" },
          { value: "MEMBERSHIP", label: "Membership" },
          { value: "SUSPENDED", label: "Ditangguhkan" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!data && !error && <SkeletonPage variant="list" count={6} />}
      {data && <T variant="caption" color="textMuted">{t("{n} dari {total} user", { n: shown.length, total: data.length })}</T>}
      {shown.slice(0, 200).map((u) => {
        const m = membershipOf(u);
        return (
          <Pressable key={u.id} onPress={() => router.push(`/admin/user/${u.id}`)}>
            {({ pressed }) => (
              <Card style={[styles.row, { opacity: pressed ? 0.85 : 1 }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="bodySm" style={{ fontWeight: "700" }} numberOfLines={1}>{u.full_name || u.email || "User"}</T>
                  <T variant="caption" color="textMuted" numberOfLines={1}>{u.email ?? ""}</T>
                  <T variant="caption" color="textMuted">
                    {t("Daftar")} {formatDate(u.created_at)}
                    {m.effective !== "FREE" && m.daysLeft !== null ? ` · ${t("{n} hari lagi", { n: m.daysLeft })}` : ""}
                    {m.effective !== "FREE" && m.daysLeft === null ? ` · ${t("tanpa batas")}` : ""}
                    {m.expired ? ` · ${t("{tier} kedaluwarsa", { tier: m.stored })}` : ""}
                  </T>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Badge label={m.effective} tone={TIER_TONE[m.effective]} />
                  {u.is_admin && <Badge label="Admin" tone="warning" />}
                  {u.is_suspended && <Badge label="Suspended" tone="error" />}
                </View>
              </Card>
            )}
          </Pressable>
        );
      })}
      {shown.length > 200 && <T variant="caption" color="textMuted">Menampilkan 200 pertama. Persempit dengan pencarian.</T>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
