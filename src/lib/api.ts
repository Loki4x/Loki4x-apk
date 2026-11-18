import { WEB_URL } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/**
 * Panggil API mobile di web Loki4x (/api/mobile/...) dengan token login Supabase,
 * jadi server memakai aturan & data yang sama dengan web.
 */
export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>("GET", path);
}

export async function apiRequest<T>(method: "GET" | "POST" | "DELETE", path: string, payload?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${WEB_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}
