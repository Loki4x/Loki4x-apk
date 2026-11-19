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
| 5 | Foto before/after trade, export CSV, kelola akun journaling | ✅ |
| 6 | Upgrade & pembayaran (QRIS/bank, USDT, VIP via IB), bahasa Inggris, menu admin | ✅ |
| 7 | Lot Calculator, Report & Performance, kotak notifikasi, COT, Retail Bias, Fundamental Pasar, kalender ekonomi lengkap | ✅ |
| 8 | Komunitas (chat per tier, realtime, foto, @mention, balas), chat admin, referral, pengaturan profil & notifikasi | ✅ |

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

### Login Google (sekali saja)

Aplikasi memakai provider Google yang sama dengan web (Supabase Auth), lewat browser aman lalu kembali ke
aplikasi. Supabase → **Authentication → URL Configuration → Redirect URLs** → tambahkan:

```
loki4x://auth-callback
```

Dengan langkah ini saja, login Google membuka halaman Google di browser lalu kembali ke aplikasi.

**Popup "Pilih akun" bawaan Android (opsional, disarankan):**

1. Google Cloud Console, di project yang sama dengan OAuth client Google yang dipakai Supabase →
   **APIs & Services → Credentials → Create credentials → OAuth client ID → Android**:
   - Package name: `id.web.loki4xacademy.app`
   - SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (debug keystore yang dipakai build saat ini;
     kalau nanti pakai keystore rilis sendiri / Google Play, tambahkan juga SHA-1 keystore itu).
2. GitHub repo ini → Settings → Secrets and variables → Actions → **Variables** →
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = **Client ID** dari Supabase → Authentication → Providers → Google
   (client ID tipe *Web application*, berakhiran `.apps.googleusercontent.com`; bukan Client Secret).
3. Build ulang APK. Kalau popup gagal (mis. SHA-1 belum terdaftar), aplikasi otomatis memakai alur browser.

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
- `src/lib/` — Supabase (sesi disimpan terenkripsi di SecureStore), auth, tema, API, format, bahasa (`i18n.tsx`).
- `src/i18n/en.ts` — kamus bahasa Inggris. Teks ditulis dalam bahasa Indonesia di kode; komponen `T`, `Button`,
  `Badge`, `Field`, dan chip menerjemahkan otomatis. Kalimat dengan variabel pakai `t("... {nama}", { nama })`.
- `src/shared/` — logika yang sama dengan web (jam kill zone, pips & statistik sinyal, disiplin & target, parser statement MT4/MT5, kategori & pemutar video Akademi).

Folder `android/` dibuat otomatis oleh `expo prebuild` saat build; jangan di-commit.

## Catatan penandatanganan APK

Untuk sementara APK ditandatangani dengan debug keystore bawaan Expo, jadi update baru bisa
langsung di-install menimpa versi lama. Sebelum rilis ke Google Play, ganti ke keystore rilis
sendiri (disimpan di GitHub Secrets).
