# Catatan untuk asisten AI / pengembang

Aplikasi ini dirawat oleh orang **tanpa latar belakang IT**. Saat mengubah kode:

- Pertahankan **Bahasa Indonesia** untuk nama fungsi/variabel, teks tampilan, dan komentar.
- Utamakan perubahan lewat data/pengaturan (tabel `pengaturan`, menu Pengaturan) daripada nilai yang ditanam di kode.
- **Struktur database**: hanya TAMBAHKAN migrasi baru di akhir array `MIGRASI` di `server/db.ts`. Jangan ubah migrasi lama.
  Tabel baru juga perlu ditambahkan ke `TABEL_CADANGAN` agar ikut dicadangkan.
- Server dijalankan langsung dari TypeScript (Node type-stripping): jangan pakai `enum`, `namespace`, atau parameter properties; impor lokal memakai akhiran `.ts`.
- Penanda template Word memakai delimiter `${ … }` (docxtemplater). Penanda baru harus didaftarkan di `PENANDA` (`server/routes/dokumen.ts`) agar lolos validasi unggah template.
- Setelah perubahan, jalankan `npm run build` (typecheck + build) sebelum commit. Railway otomatis deploy dari cabang `main`.

Struktur: `server/` (API Hono + SQLite), `src/pages/` (halaman React), `src/components/ui.tsx` (komponen dasar), `templates/` (template Word bawaan).

Keamanan (lihat `docs/PERBAIKAN-KEAMANAN.md`):
- Jangan pernah mengekspor baris `pengaturan.kunci = 'rahasia'` atau rahasia lain ke file cadangan/unduhan.
- Rute baru yang mengubah kata sandi/peran pengguna harus memanggil `cabutSemuaSesi(id)`.
- Validasi tipe & panjang semua isian dari pengguna; angka uang/volume harus terhingga dan ≥ 0.
- Uji serangan hanya di server lokal (`DATA_DIR` sementara), jangan ke production.
