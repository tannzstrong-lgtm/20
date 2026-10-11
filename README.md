# TannnVideo AI

PWA studio pembuat video sinematik berdurasi target **60 detik**, dibuat untuk upload ke GitHub dan deploy di Vercel. Frontend memakai HTML/CSS/JavaScript biasa; tidak memerlukan Supabase, database, Node.js lokal, npm, atau proses build. Endpoint `/api/*.js` berjalan sebagai Vercel Serverless Functions di runtime Node.js milik Vercel.

## Fitur

- UI studio responsif untuk desktop dan mobile, dapat dipasang sebagai PWA.
- Story prompt, pilihan genre, rasio 9:16 / 16:9 / 1:1, dan gaya visual.
- Storyboard otomatis 12 adegan; setiap adegan ditargetkan 5 detik.
- Mengirim klip secara paralel maksimal dua pekerjaan, polling status, menampilkan kegagalan dan opsi mencoba ulang.
- Merender 12 klip melalui canvas + MediaRecorder browser menjadi satu file WebM berdurasi target 60 detik. Proses render berjalan realtime di browser, sehingga perlu membiarkan tab tetap terbuka kira-kira satu menit setelah klip siap.
- API key disimpan di Vercel Environment Variables. Endpoint pembuatan/status/media dilindungi cookie sesi `HttpOnly` dan kode akses.

## Deploy ke GitHub + Vercel

1. Buat repository GitHub baru (misalnya `TannnVideoAI`) dan upload seluruh file/folder dalam direktori proyek ini. Pastikan folder `api/` ikut ter-upload.
2. Masuk ke Vercel, pilih **Add New → Project**, import repository GitHub tersebut. Framework boleh dipilih **Other**; tidak ada Build Command dan Output Directory yang perlu diisi.
3. Buka **Project → Settings → Environment Variables**, lalu tambahkan variabel di bawah untuk Production (tambahkan ke Preview juga bila dibutuhkan).
4. Deploy atau lakukan Redeploy setelah seluruh variabel disimpan.

### Environment Variables wajib

| Nama | Nilai |
|---|---|
| `APP_ACCESS_CODE` | Kode akses pribadi yang panjang dan unik. Bagikan hanya kepada pengguna yang dipercaya. |
| `SEEDANCE_API_KEY` | API key yang didapat dari penyedia Seedance/API resmi yang kamu gunakan. |
| `SEEDANCE_API_BASE_URL` | URL endpoint create-task yang didukung oleh API provider. |
| `SEEDANCE_MODEL` | ID model Seedance 2.0 persis seperti tertulis di console provider. |

Opsional: `SEEDANCE_MEDIA_HOSTS` adalah whitelist hostname file output yang dipisahkan koma, misalnya `cdn.example.com,video.example.com`. Atur jika provider memberi domain output yang tetap.

**Penting:** nama “Seedance 2.0” tidak menjamin semua penyedia menggunakan endpoint, model ID, atau format request yang sama. Adapter bawaan menggunakan format task asinkron yang kompatibel dengan pola BytePlus/ModelArk: `POST` ke `SEEDANCE_API_BASE_URL`, lalu `GET {baseUrl}/{taskId}`; request berisi `model`, `content`, `ratio`, `duration`, dan `watermark`. Aku tidak dapat memverifikasi dokumentasi live penyedia API dari sesi ini, jadi pastikan base URL, ID model, format request, format status, dan bentuk URL output sesuai dokumentasi API yang kamu punya. Jika penyedia menggunakan format berbeda, sesuaikan `lib/provider.js`; jangan pernah memindahkan API key ke `app.js` atau HTML.

## Mengatur API Seedance

Contoh base URL ModelArk-compatible:

```env
SEEDANCE_API_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks
SEEDANCE_API_KEY=API_KEY_DARI_PROVIDER
SEEDANCE_MODEL=MODEL_ID_SEEDANCE_2_0_DARI_CONSOLE
APP_ACCESS_CODE=kode_akses_pribadi_yang_acak
```

Contoh itu menunjukkan bentuk endpoint, **bukan jaminan** akun/region/provider kamu mendukung model Seedance 2.0 pada URL yang sama. Jangan commit file `.env` atau nilai asli rahasia ke GitHub.

## Batasan dan catatan

- API video umumnya menagih per generate. Aplikasi membuat 12 tugas klip; klik tombol generate ulang dapat menghasilkan tagihan baru. Periksa harga dan kuota di provider sebelum digunakan.
- Target 60 detik dibuat dari 12 klip × 5 detik. Hasil final memakai WebM di browser, bukan MP4. Untuk MP4, tambahkan konversi/transcoding tepercaya di pipeline server atau gunakan aplikasi konversi lokal.
- Render final diproses realtime di perangkat (sekitar 60 detik) dan audio digabung jika browser dan media sumber mendukungnya. Browser yang paling cocok adalah Chrome/Edge desktop terbaru; browser mobile dapat memiliki batas memori/MediaRecorder.
- Konsistensi karakter antar klip tidak dapat dijamin oleh prompt saja; kualitasnya bergantung pada model dan endpoint. Adapter ini tidak mengirim reference image.
- Kode akses merupakan gerbang sederhana untuk deployment pribadi, bukan sistem akun multi-pengguna. Jika situs akan dipublikasikan untuk umum, tambahkan autentikasi individual, rate limiting per pengguna, limit biaya, dan monitoring di sisi server.
- PWA dapat menyimpan shell UI untuk dibuka kembali, tetapi generasi video tetap memerlukan koneksi internet dan API provider.

## Struktur proyek

```text
TannnVideoAI/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── icon.svg
├── sw.js
├── vercel.json
├── .env.example
├── README.md
├── lib/
│   ├── auth.js
│   └── provider.js
└── api/
    ├── health.js
    ├── session.js
    ├── generate.js
    ├── status.js
    └── media.js
```

## Pemeriksaan sebelum dipakai

Setelah deploy, buka alamat situs dan masukkan `APP_ACCESS_CODE`. Jika konfigurasi API belum lengkap, studio akan menunjukkan pesan status. Coba generate satu adegan atau satu proyek kecil terlebih dahulu, cek log pada **Vercel → Functions**, dan pastikan respons provider mengandung task ID, status task, serta URL video yang dapat diakses. Jika responsnya berbeda, sesuaikan adapter di `lib/provider.js`.
