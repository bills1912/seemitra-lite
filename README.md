# Seemitra Lite

Aplikasi web sederhana untuk **administrasi kegiatan mitra statistik** BPS: daftar mitra, kegiatan survei/sensus,
penugasan & honor, rekap honor bulanan dengan peringatan batas SBML, serta pembuatan **SPK & BAST** otomatis (Word).

Versi ringan dari [Seemitra](https://github.com/bills1912/rekomendasi-alokasi-mitra-1278) — tanpa peta, fokus administrasi.

📘 **Panduan pemakaian & perawatan (non-IT): [PANDUAN.md](PANDUAN.md)**

## Fitur
- **Beranda** — ringkasan, grafik honor per bulan, daftar hal yang perlu diperhatikan
- **Mitra** — tambah/ubah, impor & ekspor Excel, riwayat penugasan & honor per mitra, tempat sampah + urungkan
- **Kegiatan** — jadwal, bulan honor, satuan, tarif per peran, MAK, target petugas, salin kegiatan rutin
- **Penugasan** — pilih banyak mitra sekaligus, edit volume/tarif langsung di tabel, peringatan SBML & jadwal bentrok, impor Excel
- **Rekap Honor** — per bulan, rincian per kegiatan, ekspor Excel
- **SPK & BAST** — satu klik, nomor urut stabil per mitra per bulan, template Word bisa diganti dari aplikasi
- **Pengaturan** — kantor & PPK, format nomor, batas honor, daftar pilihan, template, pengguna (admin/operator), cadangan otomatis & pemulihan, riwayat aktivitas

## Teknologi
React 19 + TypeScript + Vite + Tailwind CSS 4 + Motion · Node.js 24 + Hono · SQLite bawaan Node (`node:sqlite`) · docxtemplater · ExcelJS

## Menjalankan
```bash
npm install
npm run dev        # pengembangan: http://localhost:5173
npm run build && npm start   # produksi: http://localhost:3000
```
Variabel lingkungan: `PORT` (bawaan 3000), `DATA_DIR` (bawaan `./data`; di Railway `/data` pada volume), `SESSION_SECRET` (wajib di production, ≥32 karakter), `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (CAPTCHA login/daftar), `SETUP_TOKEN` (opsional, kode untuk admin pertama). Lihat PANDUAN.md bagian 4.

Deploy: Railway membaca `Dockerfile` + `railway.json`. Pasang volume di `/data`.
