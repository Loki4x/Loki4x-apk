import { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, ProgressBar, Screen, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { fetchAttempts, fetchQuizCounts, fetchVideos, fetchWatchedIds } from "@/lib/academy";
import { ACADEMY_CATEGORIES, bestAttempt, QUIZ_PASS_PERCENT, type AcademyVideo, type QuizAttempt } from "@/shared/academy";

export default function CourseScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const meta = ACADEMY_CATEGORIES[String(slug)];
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [videos, setVideos] = useState<AcademyVideo[] | null>(null);
  const [watched, setWatched] = useState<Set<string> | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [questions, setQuestions] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!meta || !userId) return;
    try {
      const [v, w, a, counts] = await Promise.all([
        fetchVideos(meta.db),
        fetchWatchedIds(userId),
        fetchAttempts(userId),
        fetchQuizCounts().catch(() => ({}) as Record<string, number>),
      ]);
      setVideos(v);
      setWatched(w);
      setAttempts(a.filter((x) => x.category === meta.db));
      setQuestions(counts[String(slug)] ?? 0);
      setError(null);
    } catch {
      setError("Video belum bisa dimuat. Tarik ke bawah untuk mencoba lagi.");
    }
  }, [meta, userId, slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return <Redirect href="/login" />;
  if (!meta || !hasAccess(profile?.effectiveTier, "MEMBERSHIP")) return <Redirect href="/academy" />;

  const watchedCount = videos && watched ? videos.filter((v) => watched.has(v.id)).length : 0;
  const best = bestAttempt(attempts);

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <BackHeader title={meta.title} fallback="/academy" />
      <T variant="bodySm" color="textSecondary">{meta.subtitle}</T>
      {error && <T variant="bodySm" color="error">{error}</T>}

      {videos && (
        <Card>
          {watched && (
            <>
              <View style={styles.between}>
                <T variant="label" color="textMuted">Progres video</T>
                <T variant="bodySm" style={{ fontWeight: "700" }}>{watchedCount}/{videos.length}</T>
              </View>
              <ProgressBar percent={videos.length ? (watchedCount / videos.length) * 100 : 0} color={colors.primary} />
            </>
          )}
          <View style={[styles.between, { marginTop: watched ? 6 : 0 }]}>
            <T variant="label" color="textMuted">Kuis</T>
            {best ? (
              <Badge label={`Terbaik ${best.score}/${best.total}${best.passed ? " · Lulus" : ""}`} tone={best.passed ? "success" : "warning"} />
            ) : (
              <T variant="caption" color="textMuted">{questions > 0 ? "Belum dikerjakan" : "Belum tersedia"}</T>
            )}
          </View>
          {questions > 0 && (
            <>
              <T variant="caption" color="textMuted">
                {questions} soal pilihan ganda · lulus minimal {QUIZ_PASS_PERCENT}% · sudah {attempts.length}x dicoba
              </T>
              <Button title={attempts.length ? "Kerjakan kuis lagi" : "Mulai kuis"} onPress={() => router.push(`/quiz/${slug}`)} />
            </>
          )}
        </Card>
      )}

      {!videos && !error && <T variant="bodySm" color="textMuted">Memuat…</T>}
      {videos && videos.length === 0 && (
        <Card>
          <T variant="bodySm" color="textSecondary">Belum ada video di kategori ini.</T>
        </Card>
      )}

      {videos?.map((v) => {
        const done = watched?.has(v.id) ?? false;
        return (
          <Pressable key={v.id} onPress={() => router.push(`/video/${v.id}`)}>
            {({ pressed }) => (
              <Card style={{ padding: 0, overflow: "hidden", gap: 0, opacity: pressed ? 0.85 : 1 }}>
                <View style={[styles.thumb, { backgroundColor: colors.surface2 }]}>
                  {v.thumbnail_url ? <Image source={{ uri: v.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                  <View style={styles.play}>
                    <Ionicons name="play" size={26} color="#FFFFFF" />
                  </View>
                  {done && (
                    <View style={[styles.done, { backgroundColor: colors.success }]}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      <T variant="caption" style={{ color: "#FFFFFF", fontWeight: "700" }}>Ditonton</T>
                    </View>
                  )}
                </View>
                <View style={{ padding: 14, gap: 4 }}>
                  <T variant="body" style={{ fontWeight: "700" }} numberOfLines={2}>{v.title}</T>
                  {v.description ? <T variant="caption" color="textSecondary" numberOfLines={2}>{v.description}</T> : null}
                </View>
              </Card>
            )}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  thumb: { aspectRatio: 16 / 9, width: "100%", alignItems: "center", justifyContent: "center" },
  play: { width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  done: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
