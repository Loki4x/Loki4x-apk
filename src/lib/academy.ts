import { supabase } from "@/lib/supabase";
import { apiGet, apiRequest } from "@/lib/api";
import type { AcademyCategory, AcademyVideo, PublicQuizQuestion, QuizAttempt, QuizResult } from "@/shared/academy";

// Video, progres tonton, dan riwayat kuis dibaca langsung dari Supabase (RLS: milik sendiri).
// Soal kuis & penilaian lewat API web, karena kunci jawaban hanya boleh dibaca server.

export async function fetchVideos(category?: AcademyCategory): Promise<AcademyVideo[]> {
  let q = supabase
    .from("academy_videos")
    .select("id, title, description, thumbnail_url, video_url, category")
    .order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((v) => ({ ...v, id: String(v.id) })) as AcademyVideo[];
}

export async function fetchVideo(id: string): Promise<AcademyVideo | null> {
  const { data } = await supabase
    .from("academy_videos")
    .select("id, title, description, thumbnail_url, video_url, category")
    .eq("id", id)
    .maybeSingle();
  return data ? ({ ...data, id: String(data.id) } as AcademyVideo) : null;
}

/** null = tabel progres belum ada (SQL belum dijalankan) → fitur progres disembunyikan. */
export async function fetchWatchedIds(userId: string): Promise<Set<string> | null> {
  const { data, error } = await supabase.from("academy_video_progress").select("video_id").eq("user_id", userId);
  if (error) return null;
  return new Set((data ?? []).map((p) => String(p.video_id)));
}

export async function setWatched(userId: string, videoId: string, watched: boolean): Promise<void> {
  const { error } = watched
    ? await supabase
        .from("academy_video_progress")
        .upsert({ user_id: userId, video_id: videoId }, { onConflict: "user_id,video_id", ignoreDuplicates: true })
    : await supabase.from("academy_video_progress").delete().eq("user_id", userId).eq("video_id", videoId);
  if (error) throw new Error(error.message);
}

export async function fetchAttempts(userId: string): Promise<QuizAttempt[]> {
  const { data } = await supabase
    .from("academy_quiz_attempts")
    .select("category, score, total, passed, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as QuizAttempt[];
}

export const fetchQuizCounts = () => apiGet<{ quizCounts: Record<string, number> }>("/api/mobile/academy").then((r) => r.quizCounts);

export const fetchQuiz = (slug: string) =>
  apiGet<{ passPercent: number; questions: PublicQuizQuestion[] }>(`/api/mobile/academy/quiz/${slug}`);

export const submitQuiz = (slug: string, answers: Record<string, number>) =>
  apiRequest<{ ok: true; result: QuizResult }>("POST", `/api/mobile/academy/quiz/${slug}`, { answers }).then((r) => r.result);
