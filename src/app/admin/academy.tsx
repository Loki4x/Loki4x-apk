import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { friendlyApiError } from "@/lib/journal";
import { fetchVideos } from "@/lib/academy";
import { addQuizQuestion, addVideo, deleteQuizQuestion, deleteVideo, fetchQuizQuestions, type AdminQuizQuestion } from "@/lib/admin";
import { ACADEMY_CATEGORIES, type AcademyCategory, type AcademyVideo } from "@/shared/academy";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const CATEGORY_OPTIONS = Object.values(ACADEMY_CATEGORIES).map((c) => ({ value: c.db, label: c.title }));

/** Admin: kelola video & soal kuis Akademi per kategori. */
export default function AdminAcademy() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [category, setCategory] = useState<AcademyCategory>("TECHNICAL");
  const [tab, setTab] = useState<"VIDEO" | "QUIZ">("VIDEO");
  const [videos, setVideos] = useState<AcademyVideo[] | null>(null);
  const [questions, setQuestions] = useState<AdminQuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form video
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  // Form soal
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [v, q] = await Promise.all([fetchVideos(category), fetchQuizQuestions(category).catch(() => [] as AdminQuizQuestion[])]);
      setVideos(v);
      setQuestions(q);
    } catch {
      setError("Data belum bisa dimuat.");
    }
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  async function run(fn: () => Promise<unknown>, okText: string, reset: () => void) {
    setMsg(null);
    setSaving(true);
    try {
      await fn();
      reset();
      setMsg({ ok: true, text: okText });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: friendlyApiError(err) });
    } finally {
      setSaving(false);
    }
  }

  function confirm(titleText: string, body: string, onYes: () => Promise<unknown>) {
    Alert.alert(titleText, body, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await onYes();
            await load();
          } catch (err) {
            Alert.alert("Gagal", friendlyApiError(err));
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <BackHeader title="Admin · Akademi" fallback="/admin" />
      <OptionChips label="Kategori" options={CATEGORY_OPTIONS} value={category} onChange={(c) => { setCategory(c); setVideos(null); setQuestions(null); }} />
      <OptionChips
        label="Kelola"
        options={[
          { value: "VIDEO", label: `Video${videos ? ` (${videos.length})` : ""}` },
          { value: "QUIZ", label: `Soal kuis${questions ? ` (${questions.length})` : ""}` },
        ]}
        value={tab}
        onChange={(v) => { setTab(v); setMsg(null); }}
      />
      {error && <T variant="bodySm" color="error">{error}</T>}

      {tab === "VIDEO" && (
        <>
          <Card style={{ gap: 12 }}>
            <T variant="label" color="textMuted">Tambah video</T>
            <Field label="Judul" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
            <Field label="Deskripsi (opsional)" value={desc} onChangeText={setDesc} multiline autoCapitalize="sentences" />
            <Field label="Link video" value={videoUrl} onChangeText={setVideoUrl} placeholder="YouTube / Google Drive / Vimeo / .mp4" keyboardType="url" />
            <Field label="Link thumbnail (opsional)" value={thumbUrl} onChangeText={setThumbUrl} placeholder="https://…" keyboardType="url" />
            {msg && <T variant="bodySm" color={msg.ok ? "success" : "error"}>{msg.text}</T>}
            <Button
              title="Tambah video"
              loading={saving}
              disabled={!title.trim() || !videoUrl.trim()}
              onPress={() =>
                run(
                  () => addVideo({ category, title: title.trim(), description: desc.trim(), video_url: videoUrl.trim(), thumbnail_url: thumbUrl.trim() }),
                  "Video ditambahkan.",
                  () => {
                    setTitle("");
                    setDesc("");
                    setVideoUrl("");
                    setThumbUrl("");
                  }
                )
              }
            />
          </Card>
          {videos?.map((v) => (
            <Card key={v.id} style={styles.item}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bodySm" style={{ fontWeight: "700" }} numberOfLines={2}>{v.title}</T>
                <T variant="caption" color="textMuted" numberOfLines={1}>{v.video_url}</T>
              </View>
              <Pressable hitSlop={10} onPress={() => confirm("Hapus video", `"${v.title}" akan dihapus.`, () => deleteVideo(v.id))}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </Card>
          ))}
        </>
      )}

      {tab === "QUIZ" && (
        <>
          <Card style={{ gap: 12 }}>
            <T variant="label" color="textMuted">Tambah soal</T>
            <Field label="Pertanyaan" value={question} onChangeText={setQuestion} multiline autoCapitalize="sentences" />
            {options.map((opt, i) => (
              <View key={i} style={styles.optRow}>
                <Pressable onPress={() => setCorrect(i)} hitSlop={6}>
                  <Ionicons
                    name={correct === i ? "radio-button-on" : "radio-button-off"}
                    size={22}
                    color={correct === i ? colors.success : colors.textMuted}
                  />
                </Pressable>
                <Field
                  label={`Pilihan ${LETTERS[i]}${correct === i ? " (jawaban benar)" : ""}`}
                  value={opt}
                  onChangeText={(v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)))}
                  autoCapitalize="sentences"
                />
              </View>
            ))}
            {options.length < 6 && (
              <T variant="bodySm" color="primary" style={{ fontWeight: "700" }} onPress={() => setOptions((o) => [...o, ""])}>
                + Tambah pilihan
              </T>
            )}
            <T variant="caption" color="textMuted">Tekan lingkaran untuk menandai jawaban benar. Pilihan kosong diabaikan.</T>
            <Field label="Pembahasan (opsional)" value={explanation} onChangeText={setExplanation} multiline autoCapitalize="sentences" />
            {msg && <T variant="bodySm" color={msg.ok ? "success" : "error"}>{msg.text}</T>}
            <Button
              title="Simpan soal"
              loading={saving}
              disabled={question.trim().length < 5}
              onPress={() =>
                run(
                  () => addQuizQuestion({ category, question: question.trim(), options, correct_index: correct, explanation: explanation.trim() }),
                  "Soal disimpan.",
                  () => {
                    setQuestion("");
                    setOptions(["", "", "", ""]);
                    setCorrect(0);
                    setExplanation("");
                  }
                )
              }
            />
          </Card>
          {questions?.map((q, qi) => (
            <Card key={q.id} style={{ gap: 6 }}>
              <View style={styles.item}>
                <T variant="bodySm" style={{ fontWeight: "700", flex: 1 }}>{qi + 1}. {q.question}</T>
                <Pressable hitSlop={10} onPress={() => confirm("Hapus soal", "Soal ini akan dihapus.", () => deleteQuizQuestion(q.id))}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
              {q.options.map((o, oi) => (
                <T key={oi} variant="caption" color={oi === q.correct_index ? "success" : "textSecondary"} style={oi === q.correct_index ? { fontWeight: "700" } : undefined}>
                  {LETTERS[oi]}. {o}{oi === q.correct_index ? "  ✓" : ""}
                </T>
              ))}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: 10 },
  optRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
});
