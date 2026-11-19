# Loki4x Academy — Aplikasi Android

Aplikasi native (React Native + Expo) untuk Loki4x Academy. Login, database, dan data
member **sama** dengan web ([Loki4x-web-trading](https://github.com/Loki4x/Loki4x-web-trading)):
aplikasi terhubung langsung ke Supabase yang sama, dan memakai API khusus mobile di web
(`/api/mobile/...`) untuk logika yang harus berjalan di server.

## Status fitur

| Tahap | Fitur | Status |
|---|---|---|
| 1 | Login, Dashboard (ringkasan trading, kill zone ICT, news high impact), Akun, tema gelap/terang | ✅ |
| 2 | Sinyal (daftar, statistik, detail + timeline) + push notification native | ✅ |
| 3 | Trading Journal (tambah/edit/hapus trade, aturan risiko & target, statistik, import MT4/MT5/CSV) | ✅ |
| 4 | Akademi (video, progres tonton, kuis + pembahasan) | ✅ |

## Unduh APK

Setiap push ke `main` otomatis membuat APK di halaman **Releases** repo ini
(GitHub Actions: `.github/workflows/android-apk.yml`). Buka dari HP, unduh file `.apk`,
lalu install (izinkan "install dari sumber tidak dikenal" kalau diminta).

### Konfigurasi build (sekali saja)

GitHub → **Settings → Secrets and variables → Actions → tab Variables**, tambahkan:

| Nama | Isi |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | sama dengan `NEXT_PUBLIC_SUPABASE_URL` di Vercel |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | sama dengan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di Vercel |
| `EXPO_PUBLIC_WEB_URL` | opsional, default `https://www.loki4xacademy.web.id` |

Anon key Supabase memang bersifat publik (web juga mengirimnya ke browser); keamanan data
dijaga oleh Row Level Security di database.

### Push notification (Firebase, sekali saja)

Push memakai Firebase Cloud Messaging. Tanpa langkah ini APK tetap jalan, hanya notifikasi nonaktif.

1. [console.firebase.google.com](https://console.firebase.google.com) → buat project (mis. "Loki4x").
2. Add app → **Android**, package name **`id.web.loki4xacademy.app`** → unduh **`google-services.json`**.
3. GitHub repo ini → Settings → Secrets and variables → Actions → tab **Secrets** →
   `GOOGLE_SERVICES_JSON` = seluruh isi file `google-services.json`.
4. Firebase → Project settings → **Service accounts** → *Generate new private key* → simpan file JSON.
5. Vercel (project web) → Settings → Environment Variables → `FIREBASE_SERVICE_ACCOUNT` = seluruh isi
   file JSON service account itu, lalu redeploy web.
6. Supabase → SQL Editor → jalankan `supabase/mobile-push.sql` dari repo web.

Setelah itu semua notifikasi web (sinyal baru & update, pengingat news, batas risiko, pengumuman admin)
juga terkirim ke aplikasi.

## Pengembangan

```bash
npm install
npx tsc --noEmit                       # typecheck
npx expo export --platform android     # cek bundle JavaScript
npx expo start                         # jalankan (butuh development build untuk modul native)
```

Struktur:

- `src/app/` — layar (Expo Router). `(tabs)/` = Dashboard, Sinyal, Journal, Akademi, Akun.
- `src/components/` — komponen UI.
- `src/lib/` — Supabase (sesi disimpan terenkripsi di SecureStore), auth, tema, API, format.
- `src/shared/` — logika yang sama dengan web (jam kill zone, pips & statistik sinyal, disiplin & target, parser statement MT4/MT5, kategori & pemutar video Akademi).

Folder `android/` dibuat otomatis oleh `expo prebuild` saat build; jangan di-commit.

## Catatan penandatanganan APK

Untuk sementara APK ditandatangani dengan debug keystore bawaan Expo, jadi update baru bisa
langsung di-install menimpa versi lama. Sebelum rilis ke Google Play, ganti ke keystore rilis
sendiri (disimpan di GitHub Secrets).
