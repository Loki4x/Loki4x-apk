import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

// Sesi login disimpan terenkripsi di SecureStore. Satu nilai SecureStore sebaiknya kecil,
// sedangkan sesi Supabase bisa lebih dari 2 KB, jadi nilainya dipecah jadi beberapa potongan.
const CHUNK = 1800;
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(`${k}.n`));
    if (!count) return SecureStore.getItemAsync(k);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    await chunkedSecureStorage.removeItem(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${k}.n`, String(count));
  },
  async removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(`${k}.n`));
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
    await SecureStore.deleteItemAsync(`${k}.n`);
    await SecureStore.deleteItemAsync(k);
  },
};

export const supabase = createClient(SUPABASE_URL || "https://invalid.supabase.co", SUPABASE_ANON_KEY || "missing", {
  auth: {
    storage: chunkedSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Perbarui token hanya saat aplikasi aktif di layar (hemat baterai, sesuai anjuran Supabase untuk React Native).
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
