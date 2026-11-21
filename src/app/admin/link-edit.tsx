import { useState } from "react";
import { Image, Pressable, StyleSheet, Switch, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { pickPhoto } from "@/lib/media";
import { friendlyApiError } from "@/lib/journal";
import { cachedLinkItem, saveLinkItem } from "@/lib/links";

/** Tambah / ubah satu link atau judul bagian di Link Page. ?kind=LINK|HEADER untuk baru, ?id=<id> untuk ubah. */
export default function AdminLinkEditScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const existing = params.id ? cachedLinkItem(String(params.id)) : null;
  const kind: "LINK" | "HEADER" = existing?.kind ?? (params.kind === "HEADER" ? "HEADER" : "LINK");
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [featured, setFeatured] = useState(existing?.featured ?? false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;
  if (params.id && !existing) return <Redirect href="/admin/links" />;

  const image = removeImage ? null : (imageUri ?? existing?.image_url ?? null);
  const isHeader = kind === "HEADER";

  async function save() {
    if (!title.trim()) return setError("Judul wajib diisi.");
    if (!isHeader && !url.trim()) return setError("URL tujuan wajib diisi.");
    setSaving(true);
    setError(null);
    try {
      await saveLinkItem({ id: existing?.id, kind, title: title.trim(), url: url.trim(), description: description.trim(), featured }, imageUri, removeImage);
      router.back();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <BackHeader title={`${existing ? "Ubah" : "Tambah"} ${isHeader ? "judul bagian" : "link"}`} fallback="/admin/links" />
      <Card style={{ gap: 12 }}>
        <Field label={isHeader ? "Teks judul" : "Judul tombol"} value={title} onChangeText={setTitle} placeholder={isHeader ? "Mulai di sini" : "Daftar akun Loki4x"} autoCapitalize="sentences" />
        {!isHeader && (
          <>
            <Field label="URL tujuan" value={url} onChangeText={setUrl} placeholder="https://…" keyboardType="url" />
            <Field label="Keterangan (opsional)" value={description} onChangeText={setDescription} placeholder="Teks kecil di bawah judul" autoCapitalize="sentences" />
            <View style={{ gap: 8 }}>
              <T variant="bodySm" color="textSecondary">Foto pratinjau (opsional)</T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 6 }}>
                  <Button
                    title="Pilih foto"
                    variant="secondary"
                    onPress={async () => {
                      const uri = await pickPhoto();
                      if (uri) {
                        setImageUri(uri);
                        setRemoveImage(false);
                      }
                    }}
                  />
                  {image && (
                    <T
                      variant="caption"
                      color="error"
                      style={{ fontWeight: "700", textAlign: "center" }}
                      onPress={() => {
                        setImageUri(null);
                        setRemoveImage(true);
                      }}
                    >
                      Hapus foto
                    </T>
                  )}
                </View>
              </View>
              <T variant="caption" color="textMuted">Tampil sebagai ikon kecil di kiri tombol.</T>
            </View>
            <Pressable onPress={() => setFeatured((v) => !v)} style={[styles.toggle, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <T variant="bodySm" style={{ fontWeight: "700" }}>Tampilkan besar</T>
                <T variant="caption" color="textMuted">Foto tampil penuh (16:9) di atas judul, cocok untuk promo atau video. Butuh foto pratinjau.</T>
              </View>
              <Switch value={featured} onValueChange={setFeatured} trackColor={{ true: colors.primary, false: colors.surface2 }} thumbColor="#FFFFFF" />
            </Pressable>
          </>
        )}
        {error && <T variant="bodySm" color="error">{error}</T>}
        <Button title="Simpan" onPress={save} loading={saving} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: 12 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
});
