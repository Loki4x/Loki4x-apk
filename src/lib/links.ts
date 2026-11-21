import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { supabase } from "@/lib/supabase";
import { apiRequest, apiUpload } from "@/lib/api";
import { filePart } from "@/lib/upload";

// Halaman link ala Linktree (sama dengan /links di web). Data dibaca langsung dari Supabase (RLS: publik
// hanya melihat link aktif, admin melihat semua). Perubahan oleh admin lewat /api/mobile/admin/links/*.

export type LinkTheme = "dark" | "light" | "glass" | "brand";
export const LINK_THEMES: { value: LinkTheme; label: string }[] = [
  { value: "dark", label: "Gelap" },
  { value: "light", label: "Terang" },
  { value: "glass", label: "Glassmorphism" },
  { value: "brand", label: "Biru Loki4x" },
];

export const SOCIALS = [
  { key: "instagram", label: "Instagram", icon: "logo-instagram", placeholder: "https://instagram.com/akunmu" },
  { key: "tiktok", label: "TikTok", icon: "logo-tiktok", placeholder: "https://tiktok.com/@akunmu" },
  { key: "youtube", label: "YouTube", icon: "logo-youtube", placeholder: "https://youtube.com/@channelmu" },
  { key: "telegram", label: "Telegram", icon: "paper-plane-outline", placeholder: "https://t.me/akunmu" },
  { key: "whatsapp", label: "WhatsApp", icon: "logo-whatsapp", placeholder: "https://wa.me/628xxxxxxxxxx" },
  { key: "x", label: "X (Twitter)", icon: "logo-twitter", placeholder: "https://x.com/akunmu" },
  { key: "email", label: "Email", icon: "mail-outline", placeholder: "mailto:halo@domainmu.com" },
] as const;
export type SocialKey = (typeof SOCIALS)[number]["key"];

export interface LinkPageProfile {
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  theme: LinkTheme;
  socials: Partial<Record<SocialKey, string>>;
  views?: number;
}

export interface LinkItem {
  id: string;
  kind: "LINK" | "HEADER";
  title: string;
  url: string | null;
  description: string | null;
  image_url: string | null;
  featured: boolean;
  active: boolean;
  position: number;
  clicks: number;
}

const DEFAULT_PROFILE: LinkPageProfile = { display_name: "Loki4x Academy", bio: null, avatar_url: null, theme: "dark", socials: {} };

export async function fetchLinkPage(includeInactive = false): Promise<{ profile: LinkPageProfile; items: LinkItem[] }> {
  let q = supabase
    .from("link_items")
    .select("id, kind, title, url, description, image_url, featured, active, position, clicks")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeInactive) q = q.eq("active", true);
  const [{ data: page, error: pageError }, { data: items, error }] = await Promise.all([
    supabase.from("link_page").select("display_name, bio, avatar_url, theme, socials, views").eq("id", 1).maybeSingle(),
    q,
  ]);
  if (error || pageError) throw new Error((error ?? pageError)!.message);
  return {
    profile: page ? ({ ...DEFAULT_PROFILE, ...page, socials: page.socials ?? {} } as LinkPageProfile) : DEFAULT_PROFILE,
    items: (items ?? []) as LinkItem[],
  };
}

export const recordLinkPageView = () => supabase.rpc("increment_link_page_view").then(() => null, () => null);

/** Catat klik lalu buka tujuan (web di browser dalam aplikasi, mailto/tel/aplikasi lain lewat sistem). */
export async function openLinkItem(item: LinkItem) {
  const { data } = await supabase.rpc("increment_link_click", { item_id: item.id });
  const url = (typeof data === "string" && data) || item.url;
  if (!url) return;
  if (/^https?:/i.test(url) && !/(wa\.me|t\.me|instagram\.com|tiktok\.com|youtube\.com|youtu\.be)/i.test(url)) {
    await WebBrowser.openBrowserAsync(url);
  } else {
    await Linking.openURL(url);
  }
}

export const openSocial = (url: string) => Linking.openURL(url);

// ---------- Admin ----------

const photoPart = (uri: string, name: string) => filePart(uri, name);

export function saveLinkProfile(fields: Record<string, string>, avatarUri: string | null, removeAvatar: boolean) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (avatarUri) form.append("avatar", photoPart(avatarUri, "avatar.jpg"));
  if (removeAvatar) form.append("remove_avatar", "1");
  return apiUpload<{ ok: true }>("/api/mobile/admin/links/profile", form);
}

export function saveLinkItem(
  fields: { id?: string; kind: "LINK" | "HEADER"; title: string; url?: string; description?: string; featured?: boolean },
  imageUri: string | null,
  removeImage: boolean
) {
  const form = new FormData();
  if (fields.id) form.append("id", fields.id);
  form.append("kind", fields.kind);
  form.append("title", fields.title);
  if (fields.kind === "LINK") {
    form.append("url", fields.url ?? "");
    form.append("description", fields.description ?? "");
    form.append("featured", fields.featured ? "1" : "0");
  }
  if (imageUri) form.append("image", photoPart(imageUri, "link.jpg"));
  if (removeImage) form.append("remove_image", "1");
  return apiUpload<{ ok: true }>("/api/mobile/admin/links/items", form);
}

export const setLinkActive = (id: string, active: boolean) => apiRequest<{ ok: true }>("PATCH", `/api/mobile/admin/links/items/${id}`, { active });
export const deleteLinkItem = (id: string) => apiRequest<{ ok: true }>("DELETE", `/api/mobile/admin/links/items/${id}`);
export const reorderLinks = (ids: string[]) => apiRequest<{ ok: true }>("POST", "/api/mobile/admin/links/reorder", { ids });

// Cache sederhana supaya layar edit link langsung terisi tanpa memuat ulang.
const itemCache = new Map<string, LinkItem>();
export const cacheLinkItems = (list: LinkItem[]) => list.forEach((i) => itemCache.set(i.id, i));
export const cachedLinkItem = (id: string) => itemCache.get(id) ?? null;
