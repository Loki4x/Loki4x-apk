// Sama dengan lib/academy.ts & lib/video-embed.ts di web (bagian yang aman untuk member).

export type AcademyCategory = "TECHNICAL" | "FUNDAMENTAL" | "PSYCHOLOGY";

export const ACADEMY_CATEGORIES: Record<string, { db: AcademyCategory; title: string; subtitle: string; icon: string }> = {
  technical: {
    db: "TECHNICAL",
    title: "Belajar Teknikal",
    subtitle: "Analisa chart, indikator, dan strategi teknikal.",
    icon: "trending-up-outline",
  },
  fundamental: {
    db: "FUNDAMENTAL",
    title: "Fundamental Forex",
    subtitle: "Ekonomi makro, berita, dan sentimen pasar.",
    icon: "globe-outline",
  },
  psychology: {
    db: "PSYCHOLOGY",
    title: "Psikologi & Risk",
    subtitle: "Manajemen risiko dan psikologi trading.",
    icon: "shield-checkmark-outline",
  },
};

export const ACADEMY_SLUGS = Object.keys(ACADEMY_CATEGORIES);

export const QUIZ_PASS_PERCENT = 70;

export interface AcademyVideo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string;
  category: AcademyCategory;
}

export interface QuizAttempt {
  category: AcademyCategory;
  score: number;
  total: number;
  passed: boolean;
  created_at: string;
}

export interface PublicQuizQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface QuizResultItem {
  id: string;
  question: string;
  options: string[];
  selected: number | null;
  correct: number;
  explanation: string | null;
}

export interface QuizResult {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  items: QuizResultItem[];
}

/** Percobaan dengan persentase tertinggi. */
export function bestAttempt(attempts: QuizAttempt[]): QuizAttempt | null {
  return attempts.reduce<QuizAttempt | null>((b, a) => {
    const pct = a.total > 0 ? a.score / a.total : 0;
    const bestPct = b && b.total > 0 ? b.score / b.total : -1;
    return pct > bestPct ? a : b;
  }, null);
}

export type EmbedKind = "iframe" | "video" | "unknown";

/** Link Google Drive / YouTube / Vimeo / file video langsung → src yang bisa diputar. */
export function getVideoEmbed(url: string): { kind: EmbedKind; src: string } {
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && url.includes("drive.google.com")) {
    return { kind: "iframe", src: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
  }
  const ytMatch =
    url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/) ??
    url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ??
    url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/) ??
    url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (ytMatch) return { kind: "iframe", src: `https://www.youtube.com/embed/${ytMatch[1]}?playsinline=1` };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return { kind: "video", src: url };
  return { kind: "unknown", src: url };
}
