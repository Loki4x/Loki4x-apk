# Catatan untuk pengembangan aplikasi Loki4x Academy

- **Versi aplikasi**: setiap PR yang mengubah aplikasi (perbaikan / fitur baru) WAJIB menaikkan `expo.version`
  di `app.json` (patch: 1.0.1 → 1.0.2, dst). `versionCode` Android diisi otomatis oleh GitHub Actions
  (= nomor run), jangan diubah manual.
- **Update di aplikasi**: build di `main` menerbitkan Release `build-<run>` berisi APK + `latest.json`.
  Aplikasi membaca `releases/latest/download/latest.json` saat dibuka dan menampilkan banner update
  (`src/components/UpdateBanner.tsx`, `src/lib/app-update.ts`). APK harus selalu ditandatangani dengan
  kunci yang sama supaya bisa meng-update aplikasi yang sudah terpasang.
- Bahasa UI: Indonesia (teks) dengan terjemahan Inggris di `src/i18n/en.ts`.
