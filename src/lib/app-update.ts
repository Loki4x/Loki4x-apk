import * as Application from "expo-application";
import * as LegacyFS from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

// Update aplikasi di luar Play Store:
// setiap build di main, GitHub Actions menerbitkan Release berisi APK + latest.json
// ({ version, versionCode, apkUrl, notes }). Aplikasi membaca latest.json saat dibuka;
// kalau versionCode-nya lebih besar dari yang terpasang, tampilkan banner update.
// APK diunduh di dalam aplikasi lalu dibuka dengan installer bawaan Android
// (user tetap perlu menekan "Update" sekali — aturan Android untuk aplikasi di luar Play Store).

const LATEST_URL = "https://github.com/Loki4x/Loki4x-apk/releases/latest/download/latest.json";

export interface LatestRelease {
  version: string;
  versionCode: number;
  apkUrl: string;
  notes?: string;
  publishedAt?: string;
}

export const currentVersion = () => Application.nativeApplicationVersion ?? "1.0.0";
export const currentBuild = () => Number(Application.nativeBuildVersion ?? "0") || 0;

/** Rilis terbaru kalau lebih baru dari aplikasi yang terpasang; null kalau sudah terbaru / gagal cek. */
export async function checkForUpdate(): Promise<LatestRelease | null> {
  if (Platform.OS !== "android") return null;
  try {
    const res = await fetch(`${LATEST_URL}?t=${Date.now()}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as LatestRelease;
    if (!data?.apkUrl || !Number.isFinite(data.versionCode)) return null;
    if (!/^https:\/\/github\.com\/Loki4x\/Loki4x-apk\/releases\/download\//.test(data.apkUrl)) return null;
    return data.versionCode > currentBuild() ? data : null;
  } catch {
    return null;
  }
}

/** Unduh APK (progress 0–1) lalu buka layar install Android. */
export async function downloadAndInstall(release: LatestRelease, onProgress: (p: number) => void): Promise<void> {
  const target = `${LegacyFS.cacheDirectory}loki4x-${release.version}-${release.versionCode}.apk`;
  const existing = await LegacyFS.getInfoAsync(target).catch(() => null);
  if (!existing?.exists) {
    const task = LegacyFS.createDownloadResumable(release.apkUrl, target, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) onProgress(totalBytesWritten / totalBytesExpectedToWrite);
    });
    const result = await task.downloadAsync();
    if (!result || result.status !== 200) {
      await LegacyFS.deleteAsync(target, { idempotent: true }).catch(() => {});
      throw new Error("download_failed");
    }
  }
  onProgress(1);
  const contentUri = await LegacyFS.getContentUriAsync(target);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: "application/vnd.android.package-archive",
  });
}

/** Hapus APK lama di cache (dipanggil saat aplikasi sudah versi terbaru). */
export async function cleanupOldApks() {
  try {
    const dir = LegacyFS.cacheDirectory;
    if (!dir) return;
    const files = await LegacyFS.readDirectoryAsync(dir);
    await Promise.all(files.filter((f) => /^loki4x-.*\.apk$/.test(f)).map((f) => LegacyFS.deleteAsync(dir + f, { idempotent: true })));
  } catch {
    // abaikan
  }
}

// Cek manual dari Akun → "Cek pembaruan": banner mendengarkan permintaan ini.
type Listener = () => Promise<boolean>;
let listener: Listener | null = null;
export const onManualCheck = (fn: Listener) => {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
};
/** true kalau ada update (banner langsung muncul), false kalau sudah versi terbaru. */
export const requestUpdateCheck = () => (listener ? listener() : checkForUpdate().then((r) => !!r));
