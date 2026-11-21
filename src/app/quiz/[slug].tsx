import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, ProgressBar, Screen, T } from "@/components/ui";
import { FormSkeleton } from "@/components/Skeletons";
import { BackHeader } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { fetchQuiz, submitQuiz } from "@/lib/academy";
import { friendlyApiError } from "@/lib/journal";
import { ACADEMY_CATEGORIES, QUIZ_PASS_PERCENT, type PublicQuizQuestion, type QuizResult } from "@/shared/academy";
import { useI18n } from "@/lib/i18n";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function QuizScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const meta = ACADEMY_CATEGORIES[String(slug)];
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [questions, setQuestions] = useState<PublicQuizQuestion[] | null>(null);
  const [passPercent, setPassPercent] = useState(QUIZ_PASS_PERCENT);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setResult(null);
    setAnswers({});
    setIndex(0);
    setQuestions(null);
    try {
      const res = await fetchQuiz(String(slug));
      setPassPercent(res.passPercent);
      setQuestions(res.questions);
    } catch (err) {
      setError(friendlyApiError(err));
      setQuestions([]);
    }
  }

  useEffect(() => {
    if (meta && session) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, session?.user.id]);

  if (!session) return <Redirect href="/login" />;
  if (!meta || !hasAccess(profile?.effectiveTier, "MEMBERSHIP")) return <Redirect href="/academy" />;

  const answered = questions ? questions.filter((q) => answers[q.id] !== undefined).length : 0;

  async function submit() {
    if (!questions) return;
    const run = async () => {
      setSubmitting(true);
      setError(null);
      try {
        // Urutan kunci = urutan soal yang dikerjakan, supaya pembahasan tampil berurutan.
        // Soal yang tidak dijawab dikirim -1 (dinilai salah oleh server).
        const ordered: Record<string, number> = {};
        for (const q of questions) ordered[q.id] = answers[q.id] ?? -1;
        setResult(await submitQuiz(String(slug), ordered));
      } catch (err) {
        setError(friendlyApiError(err));
      } finally {
        setSubmitting(false);
      }
    };
    if (answered < questions.length) {
      Alert.alert(t("Kumpulkan kuis?"), t("Masih ada {n} soal belum dijawab (dihitung salah).", { n: questions.length - answered }), [
        { text: t("Lanjut jawab"), style: "cancel" },
        { text: t("Kumpulkan"), onPress: run },
      ]);
    } else {
      run();
    }
  }

  // ---------- Hasil ----------
  if (result) {
    return (
      <Screen>
        <BackHeader title="Hasil Kuis" fallback={`/course/${slug}`} />
        <Card style={{ alignItems: "center", paddingVertical: 22, borderColor: result.passed ? colors.success : colors.warning }}>
          <Ionicons name={result.passed ? "trophy" : "refresh-circle"} size={44} color={result.passed ? colors.success : colors.warning} />
          <T variant="h1">{result.percent}%</T>
          <T variant="body" style={{ fontWeight: "700" }}>
            {result.score} dari {result.total} benar · {result.passed ? t("Lulus 🎉") : t("Belum lulus (min. {p}%)", { p: passPercent })}
          </T>
          <T variant="caption" color="textMuted">{meta.title}</T>
        </Card>

        <T variant="label" color="textMuted">Pembahasan</T>
        {result.items.map((item, i) => {
          const correct = item.selected === item.correct;
          return (
            <Card key={item.id}>
              <View style={styles.qHead}>
                <Ionicons name={correct ? "checkmark-circle" : "close-circle"} size={20} color={correct ? colors.success : colors.error} />
                <T variant="body" style={{ fontWeight: "700", flex: 1 }}>{i + 1}. {item.question}</T>
              </View>
              {item.options.map((opt, oi) => {
                const isCorrect = oi === item.correct;
                const isPicked = oi === item.selected;
                return (
                  <View
                    key={oi}
                    style={[
                      styles.option,
                      {
                        borderColor: isCorrect ? colors.success : isPicked ? colors.error : colors.border,
                        backgroundColor: isCorrect ? colors.successSubtle : isPicked ? colors.errorSubtle : colors.surface2,
                      },
                    ]}
                  >
                    <T variant="bodySm" style={{ fontWeight: "700", width: 18 }}>{LETTERS[oi]}</T>
                    <T variant="bodySm" style={{ flex: 1 }}>{opt}</T>
                  </View>
                );
              })}
              {item.selected === null && <T variant="caption" color="warning">Tidak dijawab</T>}
              {item.explanation ? (
                <T variant="bodySm" color="textSecondary">💡 {item.explanation}</T>
              ) : null}
            </Card>
          );
        })}

        <Button title="Ulangi kuis" onPress={start} />
        <Button title="Kembali ke video" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/course/${slug}`))} />
      </Screen>
    );
  }

  // ---------- Mengerjakan ----------
  const q = questions?.[index];

  return (
    <Screen>
      <BackHeader title={t("Kuis {title}", { title: t(meta.title) })} fallback={`/course/${slug}`} />

      {questions === null && <FormSkeleton fields={4} />}
      {error && <T variant="bodySm" color="error">{error}</T>}
      {questions && questions.length === 0 && !error && (
        <Card>
          <T variant="bodySm" color="textSecondary">Kuis untuk kategori ini belum tersedia.</T>
        </Card>
      )}

      {questions && q && (
        <>
          <View style={styles.between}>
            <T variant="bodySm" color="textSecondary">Soal {index + 1} dari {questions.length}</T>
            <T variant="caption" color="textMuted">{answered} dijawab · lulus min. {passPercent}%</T>
          </View>
          <ProgressBar percent={((index + 1) / questions.length) * 100} color={colors.primary} />

          <Card>
            <T variant="body" style={{ fontWeight: "700" }}>{q.question}</T>
            {q.options.map((opt, oi) => {
              const active = answers[q.id] === oi;
              return (
                <Pressable
                  key={oi}
                  onPress={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                  style={[
                    styles.option,
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySubtle : colors.surface2 },
                  ]}
                >
                  <T variant="bodySm" style={{ fontWeight: "700", width: 18, color: active ? colors.primary : colors.textSecondary }}>
                    {LETTERS[oi]}
                  </T>
                  <T variant="bodySm" style={{ flex: 1 }}>{opt}</T>
                </Pressable>
              );
            })}
          </Card>

          <View style={styles.dots}>
            {questions.map((qq, i) => (
              <Pressable
                key={qq.id}
                onPress={() => setIndex(i)}
                hitSlop={4}
                style={[
                  styles.dot,
                  {
                    backgroundColor: answers[qq.id] !== undefined ? colors.primary : colors.surface2,
                    borderColor: i === index ? colors.text : "transparent",
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.nav}>
            <Button title="Sebelumnya" variant="secondary" onPress={() => setIndex((i) => i - 1)} disabled={index === 0} style={{ flex: 1 }} />
            {index < questions.length - 1 ? (
              <Button title="Berikutnya" onPress={() => setIndex((i) => i + 1)} style={{ flex: 1 }} />
            ) : (
              <Button title="Kumpulkan" onPress={submit} loading={submitting} style={{ flex: 1 }} />
            )}
          </View>
          {index < questions.length - 1 && answered === questions.length && (
            <Button title="Kumpulkan sekarang" variant="secondary" onPress={submit} loading={submitting} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  qHead: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  option: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  nav: { flexDirection: "row", gap: 10 },
});
