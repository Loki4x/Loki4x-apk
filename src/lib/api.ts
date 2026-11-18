import { WEB_URL } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/**
 * Panggil API mobile di web Loki4x (/api/mobile/...) dengan token login Supabase,
 * jadi server memakai aturan & data yang sama dengan web.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${WEB_URL}${path}`, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}
