import { existsSync } from "fs";
import type { ConfigContext, ExpoConfig } from "expo/config";

// Konfigurasi dasar ada di app.json. File ini hanya menambahkan Firebase (push notification Android)
// KALAU google-services.json tersedia saat build. GitHub Actions menulis file itu dari secret
// GOOGLE_SERVICES_JSON. Tanpa file itu aplikasi tetap bisa di-build, hanya push yang nonaktif.
const GOOGLE_SERVICES_FILE = "./google-services.json";

export default ({ config }: ConfigContext): ExpoConfig => {
  const pushEnabled = existsSync(GOOGLE_SERVICES_FILE);
  return {
    ...config,
    name: config.name ?? "Loki4x Academy",
    slug: config.slug ?? "loki4x-academy",
    android: {
      ...config.android,
      ...(pushEnabled ? { googleServicesFile: GOOGLE_SERVICES_FILE } : {}),
    },
    extra: {
      ...config.extra,
      pushEnabled,
    },
  };
};
