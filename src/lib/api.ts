import { WEB_URL } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/**
 * Panggil API mobile di web Loki4x (/api/mobile/...) dengan token login Supabase,
 * jadi server memakai aturan & data yang sama dengan web.
 */
export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>("GET", path);
}

export async function apiRequest<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, payload?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  // GET selalu ambil data terbaru: jangan pakai salinan lama dari cache HTTP perangkat/CDN.
  const url = method === "GET" ? `${WEB_URL}${path}${path.includes("?") ? "&" : "?"}_t=${Date.now()}` : `${WEB_URL}${path}`;
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

/** Upload multipart (foto) ke API mobile. Content-Type diisi otomatis oleh fetch (boundary). */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${WEB_URL}${path}`, {
    method: "POST",
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}
