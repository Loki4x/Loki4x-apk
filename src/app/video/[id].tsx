import { useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { WEB_URL } from "@/lib/config";
import { fetchVideo, fetchWatchedIds, setWatched } from "@/lib/academy";
import { ACADEMY_CATEGORIES, getVideoEmbed, type AcademyVideo } from "@/shared/academy";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Halaman HTML kecil berisi pemutar. Dimuat dengan baseUrl domain web supaya YouTube/Drive mau diputar (butuh referrer). */
function playerHtml(url: string): string {
  const embed = getVideoEmbed(url);
  const player =
    embed.kind === "video"
      ? `<video src="${esc(embed.src)}" controls autoplay playsinline></video>`
      : `<iframe src="${esc(embed.src)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;height:100%;background:#000}iframe,video{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
</head><body>${player}</body></html>`;
}

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [video, setVideo] = useState<AcademyVideo | null | undefined>(undefined);
  const [watched, setWatchedState] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    fetchVideo(String(id))
      .then(setVideo)
      .catch(() => setVideo(null));
    fetchWatchedIds(userId).then((set) => setWatchedState(set ? set.has(String(id)) : null));
  }, [id, userId]);

  if (!session) return <Redirect href="/login" />;
  if (!hasAccess(profile?.effectiveTier, "MEMBERSHIP")) return <Redirect href="/academy" />;

  async function toggle() {
    if (!userId || watched === null) return;
    setSaving(true);
    setError(null);
    try {
      await setWatched(userId, String(id), !watched);
      setWatchedState(!watched);
    } catch {
      setError("Gagal menyimpan progres. Cek koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const slug = video ? Object.keys(ACADEMY_CATEGORIES).find((s) => ACADEMY_CATEGORIES[s].db === video.category) : undefined;

  return (
    <Screen>
      <BackHeader title="Video" fallback={slug ? `/course/${slug}` : "/academy"} />
      {video === undefined && <T variant="bodySm" color="textMuted">Memuat…</T>}
      {video === null && <T variant="bodySm" color="error">Video tidak ditemukan.</T>}
      {video && (
        <>
          <View style={styles.player}>
            <WebView
              source={{ html: playerHtml(video.video_url), baseUrl: WEB_URL }}
              style={{ flex: 1, backgroundColor: "#000" }}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
            />
          </View>

          <T variant="h3">{video.title}</T>
          {video.description ? <T variant="bodySm" color="textSecondary">{video.description}</T> : null}

          {watched !== null && (
            <Button
              title={watched ? "✓ Sudah ditonton" : "Tandai sudah ditonton"}
              variant={watched ? "secondary" : "primary"}
              onPress={toggle}
              loading={saving}
            />
          )}
          {error && <T variant="bodySm" color="error">{error}</T>}

          <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <T variant="caption" color="textMuted" style={{ flex: 1 }}>
              Video tidak bisa diputar? Buka langsung dari sumbernya.
            </T>
            <T variant="bodySm" color="primary" style={{ fontWeight: "700" }} onPress={() => Linking.openURL(video.video_url)}>
              Buka
            </T>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  player: { width: "100%", aspectRatio: 16 / 9, borderRadius: 14, overflow: "hidden", backgroundColor: "#000" },
});
