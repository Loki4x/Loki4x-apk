import { supabase } from "@/lib/supabase";
import { apiRequest, apiUpload } from "@/lib/api";
import { pipSizeFor } from "@/shared/signal-metrics";
import type { AcademyCategory } from "@/shared/academy";
import type { SignalStatus, SignalUpdateType } from "@/shared/signal-types";

// Menu admin aplikasi. Semua perubahan lewat API admin web (/api/mobile/admin/...), yang memakai
// logika yang sama dengan panel admin web (validasi, audit log, email & push notifikasi).

export const SIGNAL_STATUSES: SignalStatus[] = ["OPEN", "HIT_ENTRY", "TP", "SL", "PARTIAL", "CANCEL", "MISS"];
export const RESULT_STATUSES: SignalStatus[] = ["TP", "SL", "PARTIAL"];
export const TERMINAL: SignalStatus[] = ["TP", "SL", "PARTIAL", "CANCEL", "MISS"];
export const UPDATE_TYPES: SignalUpdateType[] = ["SL_TO_BE", "PARTIAL_CLOSE", "MOVE_SL", "MOVE_TP", "NOTE"];

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Pips dari entry → harga (positif = untung sesuai arah), sama dengan lib/signal-pips.ts di web. */
export function pipsBetween(symbol: string, side: "BUY" | "SELL", entry: number, price: number): number {
  const move = side === "BUY" ? price - entry : entry - price;
  return round1(move / pipSizeFor(symbol.trim().toUpperCase()));
}

/** Angka dari input ("1,25" → "1.25"); kosong → "". */
export const cleanNum = (v: string) => v.trim().replace(",", ".");
export const toNum = (v: string): number | null => {
  const s = cleanNum(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Tanggal & jam WIB "YYYY-MM-DD HH:mm" (atau dengan T) → format yang diterima server "YYYY-MM-DDTHH:mm". */
export function wibDateTime(v: string): string | null | "invalid" {
  const s = v.trim().replace(" ", "T");
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? s : "invalid";
}

function photoPart(uri: string, name: string) {
  return { uri, name, type: "image/jpeg" } as unknown as Blob;
}

// ---------- Sinyal ----------

export function createSignal(fields: Record<string, string>, chartUri: string | null) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (chartUri) form.append("chart_image", photoPart(chartUri, "chart.jpg"));
  return apiUpload<{ ok: true }>("/api/mobile/admin/signals", form);
}

export function updateSignalStatus(
  id: string,
  input: { status: SignalStatus; current_price: string; result_pips: string; closed_at: string },
  resultUri: string | null
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(input)) form.append(k, v);
  if (resultUri) form.append("result_image", photoPart(resultUri, "result.jpg"));
  return apiUpload<{ ok: true }>(`/api/mobile/admin/signals/${id}/status`, form);
}

export const addSignalUpdate = (id: string, input: { type: SignalUpdateType; message: string; price: string; send_email: "1" | "0" }) =>
  apiRequest<{ ok: true }>("POST", `/api/mobile/admin/signals/${id}/updates`, input);

export const deleteSignal = (id: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/admin/signals/${id}`);

// ---------- Akademi ----------

export const addVideo = (input: { category: AcademyCategory; title: string; description: string; video_url: string; thumbnail_url: string }) =>
  apiRequest<{ ok: true }>("POST", "/api/mobile/admin/videos", input);

export const deleteVideo = (id: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/admin/videos/${id}`);

export interface AdminQuizQuestion {
  id: string;
  category: AcademyCategory;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
}

/** Soal + kunci jawaban: RLS hanya mengizinkan admin membaca tabel ini. */
export async function fetchQuizQuestions(category: AcademyCategory): Promise<AdminQuizQuestion[]> {
  const { data, error } = await supabase
    .from("academy_quiz_questions")
    .select("id, category, question, options, correct_index, explanation")
    .eq("category", category)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminQuizQuestion[];
}

export const addQuizQuestion = (input: { category: AcademyCategory; question: string; options: string[]; correct_index: number; explanation: string }) =>
  apiRequest<{ ok: true }>("POST", "/api/mobile/admin/quiz", input);

export const deleteQuizQuestion = (id: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/admin/quiz/${id}`);

// ---------- Pengumuman ----------

export const sendAnnouncement = (input: {
  target: "ALL" | "USER";
  audience: "ALL" | "FREE" | "VIP" | "MEMBERSHIP";
  email: string;
  title: string;
  message: string;
  ch_push: "true" | "false";
  ch_website: "true" | "false";
  ch_email: "true" | "false";
}) => apiRequest<{ ok: true; message: string }>("POST", "/api/mobile/admin/notify", input);
