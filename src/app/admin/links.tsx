import { useCallback, useState } from "react";
import { Alert, Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, Field } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { WEB_URL } from "@/lib/config";
import { pickPhoto } from "@/lib/media";
import { friendlyApiError } from "@/lib/journal";
import {
  cacheLinkItems,
  deleteLinkItem,
  fetchLinkPage,
  LINK_THEMES,
  reorderLinks,
  saveLinkProfile,
  setLinkActive,
  SOCIALS,
  type LinkItem,
  type LinkPageProfile,
} from "@/lib/links";

type Msg = { ok: boolean; text: string } | null;

/** Admin → Link Page: profil, tema, sosmed, dan daftar link halaman /links (sama dengan panel web). */
export default function AdminLinksScreen() {
  const { session, profile: me } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [page, setPage] = useState<LinkPageProfile | null>(null);
  const [items, setItems] = useState<LinkItem[] | null>(null);
  const [draft, setDraft] = useState<LinkPageProfile | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchLinkPage(true);
      setPage(data.profile);
      setDraft((d) => d ?? data.profile);
      setItems(data.items);
      cacheLinkItems(data.items);
      setError(null);
    } catch (e) {
      setError(friendlyApiError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return <Redirect href="/login" />;
  if (!me?.is_admin) return <Redirect href="/account" />;

  async function saveProfile() {
    if (!draft) return;
    setSaving(true);
    setMsg(null);
    try {
      const fields: Record<string, string> = { display_name: draft.display_name, bio: draft.bio ?? "", theme: draft.theme };
      for (const s of SOCIALS) fields[`social_${s.key}`] = draft.socials[s.key] ?? "";
      await saveLinkProfile(fields, avatarUri, removeAvatar);
      setAvatarUri(null);
      setRemoveAvatar(false);
      setMsg({ ok: true, text: t("Profil disimpan.") });
      setDraft(null);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: friendlyApiError(e) });
    } finally {
      setSaving(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!items) return;
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
    await reorderLinks(next.map((i) => i.id)).catch((e) => setError(friendlyApiError(e)));
  }

  async function toggle(item: LinkItem) {
    setItems((l) => l?.map((x) => (x.id === item.id ? { ...x, active: !x.active } : x)) ?? null);
    await setLinkActive(item.id, !item.active).catch((e) => {
      setError(friendlyApiError(e));
      load();
    });
  }

  function remove(item: LinkItem) {
    Alert.alert(t("Hapus link ini?"), item.title, [
      { text: t("Batal"), style: "cancel" },
      {
        text: t("Hapus"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteLinkItem(item.id);
            await load();
          } catch (e) {
            setError(friendlyApiError(e));
          }
        },
      },
    ]);
  }

  const avatar = removeAvatar ? null : (avatarUri ?? draft?.avatar_url ?? null);
  const totalClicks = items?.reduce((s, i) => s + (i.kind === "LINK" ? i.clicks : 0), 0) ?? 0;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <BackHeader title="Link Page" fallback="/admin" />
      {error && <T variant="bodySm" color="error">{error}</T>}
      {(!draft || !items) && !error && <SkeletonPage variant="list" count={4} />}

      {draft && items && (
        <>
          <Card>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <T variant="caption" color="textMuted">Alamat halaman</T>
                <T variant="bodySm" color="primary" style={{ fontWeight: "700" }} numberOfLines={1}>{WEB_URL.replace(/^https?:\/\//, "")}/links</T>
              </View>
              <Button title="Lihat" variant="secondary" onPress={() => router.push("/links")} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <T variant="caption" color="textMuted">Kunjungan</T>
                <T variant="h3">{(page?.views ?? 0).toLocaleString("id-ID")}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T variant="caption" color="textMuted">Total klik</T>
                <T variant="h3">{totalClicks.toLocaleString("id-ID")}</T>
              </View>
            </View>
            <T variant="caption" color="primary" style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${WEB_URL}/links`)}>
              Buka di browser
            </T>
          </Card>

          <Card style={{ gap: 12 }}>
            <T variant="label" color="textMuted">Profil</T>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }]}>
                  <T style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "800" }}>{(draft.display_name || "L").charAt(0).toUpperCase()}</T>
                </View>
              )}
              <View style={{ flex: 1, gap: 8 }}>
                <Button
                  title="Ganti foto"
                  variant="secondary"
                  onPress={async () => {
                    const uri = await pickPhoto();
                    if (uri) {
                      setAvatarUri(uri);
                      setRemoveAvatar(false);
                    }
                  }}
                />
                {avatar && (
                  <T
                    variant="caption"
                    color="error"
                    style={{ fontWeight: "700", textAlign: "center" }}
                    onPress={() => {
                      setAvatarUri(null);
                      setRemoveAvatar(true);
                    }}
                  >
                    Hapus foto
                  </T>
                )}
              </View>
            </View>
            <Field label="Nama" value={draft.display_name} onChangeText={(v) => setDraft({ ...draft, display_name: v })} autoCapitalize="sentences" />
            <Field label="Bio" value={draft.bio ?? ""} onChangeText={(v) => setDraft({ ...draft, bio: v })} multiline autoCapitalize="sentences" />
            <View style={{ gap: 6 }}>
              <T variant="bodySm" color="textSecondary">Tema</T>
              <View style={styles.themes}>
                {LINK_THEMES.map((th) => {
                  const on = draft.theme === th.value;
                  return (
                    <Pressable
                      key={th.value}
                      onPress={() => setDraft({ ...draft, theme: th.value })}
                      style={[styles.theme, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySubtle : colors.surface2 }]}
                    >
                      <View style={[styles.swatch, { backgroundColor: SWATCH[th.value] }]} />
                      <T variant="caption" style={{ fontWeight: "700", color: on ? colors.primary : colors.textSecondary }}>{th.label}</T>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <T variant="bodySm" color="textSecondary">Ikon media sosial (opsional)</T>
            {SOCIALS.map((s) => (
              <Field
                key={s.key}
                label={s.label}
                value={draft.socials[s.key] ?? ""}
                onChangeText={(v) => setDraft({ ...draft, socials: { ...draft.socials, [s.key]: v } })}
                placeholder={s.placeholder}
                keyboardType={s.key === "email" ? "email-address" : "url"}
              />
            ))}
            {msg && <T variant="bodySm" color={msg.ok ? "success" : "error"}>{msg.text}</T>}
            <Button title="Simpan profil" onPress={saveProfile} loading={saving} />
          </Card>

          <Card style={{ gap: 10 }}>
            <View style={styles.between}>
              <T variant="label" color="textMuted" style={{ flex: 1 }}>Link</T>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title="+ Judul bagian" variant="secondary" onPress={() => router.push("/admin/link-edit?kind=HEADER")} style={{ flex: 1 }} />
              <Button title="+ Tambah link" onPress={() => router.push("/admin/link-edit?kind=LINK")} style={{ flex: 1 }} />
            </View>
            {items.length === 0 && <T variant="bodySm" color="textMuted">Belum ada link.</T>}
            {items.map((item, i) => (
              <View key={item.id} style={[styles.row, { backgroundColor: colors.surface2, borderColor: colors.border, opacity: item.active ? 1 : 0.55 }]}>
                <View>
                  <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6} style={{ opacity: i === 0 ? 0.3 : 1 }}>
                    <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => move(i, 1)} disabled={i === items.length - 1} hitSlop={6} style={{ opacity: i === items.length - 1 ? 0.3 : 1 }}>
                    <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
                {item.kind === "LINK" && item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name={item.kind === "HEADER" ? "text-outline" : "link-outline"} size={18} color={colors.primary} />
                  </View>
                )}
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/admin/link-edit?id=${item.id}`)}>
                  <T variant="bodySm" style={{ fontWeight: "700" }} numberOfLines={1}>{item.title}</T>
                  <T variant="caption" color="textMuted" numberOfLines={1}>
                    {item.kind === "HEADER" ? t("Judul bagian") : `${item.featured ? `${t("Besar")} · ` : ""}${item.clicks} ${t("klik")} · ${item.url}`}
                  </T>
                </Pressable>
                <Pressable onPress={() => toggle(item)} hitSlop={6}>
                  <Ionicons name={item.active ? "eye-outline" : "eye-off-outline"} size={19} color={colors.textMuted} />
                </Pressable>
                <Pressable onPress={() => remove(item)} hitSlop={6}>
                  <Ionicons name="trash-outline" size={19} color={colors.error} />
                </Pressable>
              </View>
            ))}
            <T variant="caption" color="textMuted">Ketuk link untuk mengubah. Panah mengatur urutan, ikon mata menyembunyikan tanpa menghapus.</T>
          </Card>
        </>
      )}
    </Screen>
  );
}

const SWATCH: Record<string, string> = { dark: "#050810", light: "#F4F6FB", glass: "#5B4FB8", brand: "#3F62C4" };

const styles = StyleSheet.create({
  between: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  themes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  theme: { width: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  swatch: { width: 22, height: 22, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.5)" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  thumb: { width: 40, height: 40, borderRadius: 10 },
});
