import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { apiRequest } from "@/lib/api";

// Push notification native (Firebase Cloud Messaging). Web mengirim notifikasi yang sama dengan
// yang dikirim ke browser (sinyal, news, batas risiko, pengumuman) ke token HP yang terdaftar di
// /api/mobile/push-token.

const TOKEN_KEY = "loki4x-push-token";
const PREF_KEY = "loki4x-push-enabled";

export type PushStatus = "enabled" | "disabled" | "denied" | "unavailable" | "error";

/** Push hanya aktif kalau APK di-build dengan google-services.json (lihat app.config.ts). */
export const pushAvailable = Platform.OS === "android" && Constants.expoConfig?.extra?.pushEnabled === true;

// Saat aplikasi sedang dibuka, notifikasi tetap tampil sebagai banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  // ID harus sama dengan channel_id yang dikirim server (lib/fcm.ts di web).
  await Notifications.setNotificationChannelAsync("default", {
    name: "Notifikasi Loki4x",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#5F85DB",
  });
}

export async function isPushPreferred(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PREF_KEY)) !== "off";
}

/**
 * Minta izin, ambil token FCM, lalu daftarkan ke web. `ask=false` dipakai saat aplikasi dibuka
 * (tidak memunculkan dialog izin lagi kalau user sudah menolak).
 */
export async function registerForPush(ask = true): Promise<PushStatus> {
  if (!pushAvailable || !Device.isDevice) return "unavailable";
  try {
    await ensureChannel();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return "denied";

    const token = (await Notifications.getDevicePushTokenAsync()).data;
    if (typeof token !== "string" || !token) return "error";
    await apiRequest("POST", "/api/mobile/push-token", { token, platform: Platform.OS });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(PREF_KEY, "on");
    return "enabled";
  } catch (err) {
    console.warn("[push] gagal daftar:", err instanceof Error ? err.message : err);
    return "error";
  }
}

/**
 * Berhenti menerima push di HP ini. Dipanggil saat logout (sebelum sesi dihapus, karena butuh token login)
 * dan saat user mematikan notifikasi di tab Akun.
 */
export async function unregisterPush(rememberOff = false): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    await apiRequest("DELETE", "/api/mobile/push-token", { token }).catch(() => {});
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
  if (rememberOff) await SecureStore.setItemAsync(PREF_KEY, "off");
}

/** Notifikasi membawa `url` halaman web (mis. "/signals"); petakan ke layar aplikasi. */
export function routeForUrl(url: unknown): string {
  const path = typeof url === "string" ? url : "";
  if (path.startsWith("/signals")) return "/signals";
  if (path.startsWith("/trades") || path.startsWith("/reports")) return "/journal";
  if (path.startsWith("/academy")) return "/academy";
  if (path.startsWith("/community")) {
    const room = /[?&]room=(ANNOUNCEMENT|FREE|VIP|MEMBERSHIP)/.exec(path)?.[1];
    return room ? `/community?room=${room}` : "/community";
  }
  if (path.startsWith("/news")) return "/calendar";
  if (path.startsWith("/upgrade")) return "/upgrade";
  if (path.startsWith("/settings")) return "/settings";
  for (const p of ["/chat", "/referral", "/notifications", "/cot", "/positioning", "/market-news", "/calculator"]) {
    if (path.startsWith(p)) return p;
  }
  return "/";
}
