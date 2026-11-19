import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, ProgressBar, Screen, T } from "@/components/ui";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { fetchAttempts, fetchQuizCounts, fetchVideos, fetchWatchedIds } from "@/lib/academy";
import { ACADEMY_CATEGORIES, ACADEMY_SLUGS, bestAttempt, type AcademyVideo, type QuizAttempt } from "@/shared/academy";

type IconName = keyof typeof Ionicons.glyphMap;

interface Overview {
  videos: AcademyVideo[];
  watched: Set<string> | null;
  attempts: QuizAttempt[];
  quizCounts: Record<string, number>;
}

export default function AcademyScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const allowed = hasAccess(profile?.effectiveTier, "MEMBERSHIP");
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!allowed || !userId) return;
    try {
      const [videos, watched, attempts, quizCounts] = await Promise.all([
        fetchVideos(),
        fetchWatchedIds(userId),
        fetchAttempts(userId),
        fetchQuizCounts().catch(() => ({}) as Record<string, number>),
      ]);
      setData({ videos, watched, attempts, quizCounts });
      setError(null);
    } catch {
      setError("Akademi belum bisa dimuat. Tarik ke bawah untuk mencoba lagi.");
    }
  }, [allowed, userId]);

  // Muat ulang tiap tab dibuka supaya progres terbaru (setelah nonton / kuis) langsung terlihat.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!allowed) {
    return (
      <Screen>
        <T variant="h2">Akademi</T>
        <Card style={{ borderColor: colors.primary }}>
          <T variant="h3">Khusus Membership 🔒</T>
          <T variant="bodySm" color="textSecondary">
            Video belajar teknikal, fundamental, dan psikologi trading, lengkap dengan progres belajar dan kuis.
          </T>
          <Button title="Upgrade sekarang" onPress={() => router.push("/upgrade")} />
        </Card>
      </Screen>
    );
  }

  const total = data?.videos.length ?? 0;
  const watchedTotal = data?.watched ? data.videos.filter((v) => data.watched!.has(v.id)).length : 0;
  const passedCount = ACADEMY_SLUGS.filter((s) =>
    data?.attempts.some((a) => a.category === ACADEMY_CATEGORIES[s].db && a.passed)
  ).length;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <T variant="h2">Akademi</T>
      {error && <T variant="bodySm" color="error">{error}</T>}

      {data && data.watched && (
        <Card>
          <T variant="label" color="textMuted">Progres belajar kamu</T>
          <View style={styles.summary}>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="h2">{total > 0 ? Math.round((watchedTotal / total) * 100) : 0}%</T>
              <T variant="caption" color="textMuted">{watchedTotal} dari {total} video ditonton</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="h2">{passedCount}/{ACADEMY_SLUGS.length}</T>
              <T variant="caption" color="textMuted">kuis kategori lulus</T>
            </View>
          </View>
          <ProgressBar percent={total > 0 ? (watchedTotal / total) * 100 : 0} color={colors.primary} />
        </Card>
      )}

      {!data && !error && <T variant="bodySm" color="textMuted">Memuat…</T>}

      {data &&
        ACADEMY_SLUGS.map((slug) => {
          const meta = ACADEMY_CATEGORIES[slug];
          const vids = data.videos.filter((v) => v.category === meta.db);
          const watched = data.watched ? vids.filter((v) => data.watched!.has(v.id)).length : null;
          const best = bestAttempt(data.attempts.filter((a) => a.category === meta.db));
          const questions = data.quizCounts[slug] ?? 0;
          return (
            <Pressable key={slug} onPress={() => router.push(`/course/${slug}`)}>
              {({ pressed }) => (
                <Card style={{ opacity: pressed ? 0.85 : 1 }}>
                  <View style={styles.head}>
                    <View style={[styles.icon, { backgroundColor: colors.primarySubtle }]}>
                      <Ionicons name={meta.icon as IconName} size={22} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T variant="h3">{meta.title}</T>
                      <T variant="caption" color="textSecondary">{meta.subtitle}</T>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </View>
                  {watched !== null && vids.length > 0 && (
                    <>
                      <ProgressBar percent={(watched / vids.length) * 100} color={colors.primary} />
                      <T variant="caption" color="textMuted">{watched}/{vids.length} video ditonton</T>
                    </>
                  )}
                  {watched === null && <T variant="caption" color="textMuted">{vids.length} video</T>}
                  <View style={styles.badges}>
                    {questions > 0 ? (
                      best ? (
                        <Badge
                          label={`Kuis terbaik ${best.score}/${best.total}${best.passed ? " · Lulus" : ""}`}
                          tone={best.passed ? "success" : "warning"}
                        />
                      ) : (
                        <Badge label={`Kuis ${questions} soal · belum dikerjakan`} tone="muted" />
                      )
                    ) : (
                      <Badge label="Kuis belum tersedia" tone="muted" />
                    )}
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
  summary: { flexDirection: "row", gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
