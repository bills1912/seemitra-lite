# Panduan Seemitra Lite (untuk pengelola non-IT)

Dokumen ini menjelaskan cara **memakai, mengatur, merawat, dan memperbaiki** Seemitra Lite tanpa perlu
latar belakang pemrograman. Simpan baik-baik dan teruskan ke pengelola berikutnya.

---

## 1. Hal yang TIDAK perlu mengubah kode

Hampir semua hal yang biasa berubah dari tahun ke tahun bisa diatur langsung dari aplikasi:

| Yang ingin diubah | Caranya |
|---|---|
| Nama/NIP PPK, nama & alamat kantor | **Pengaturan → Kantor & PPK** |
| SBML (batas honor mitra per bulan) per peran PPL/PML/Pengolahan, tahun baru, dan ambang peringatan | **Pengaturan → Batas honor (SBML)** |
| Format nomor SPK / BAST | **Pengaturan → Format nomor** |
| Daftar peran (PPL, PML, …), satuan, jenis kegiatan | **Pengaturan → Peran & satuan** |
| Isi kalimat, kop, tata letak SPK & BAST | **Pengaturan → Template dokumen** (edit di Microsoft Word) |
| Menambah / menghapus akun pengguna, reset kata sandi | **Pengaturan → Pengguna**. Rekan juga bisa klik *Daftar di sini* di halaman masuk, lalu admin klik **Setujui** |
| Mencadangkan / memulihkan data | **Pengaturan → Cadangan data** |
| Melihat siapa mengubah apa | **Pengaturan → Riwayat aktivitas** |

### Mengubah isi SPK / BAST
1. Buka **Pengaturan → Template dokumen**, klik **Unduh** pada SPK atau BAST.
2. Buka file di Microsoft Word, ubah kalimat sesuai kebutuhan.
3. **Jangan menghapus/mengubah penanda** seperti `${nama_mitra}`. Daftar semua penanda ada di halaman yang sama (klik untuk menyalin).
   - `${#mitra}` … `${/mitra}` = bagian yang diulang untuk setiap mitra (satu salinan surat per mitra).
   - `${#tugas}` … `${/tugas}` = baris tabel yang diulang untuk setiap kegiatan mitra. Letakkan `${#tugas}` di sel pertama dan `${/tugas}` di sel terakhir pada baris tabel yang sama.
4. Simpan sebagai `.docx`, lalu klik **Unggah baru**. Aplikasi menguji template; jika ada penanda yang salah ketik atau rusak, aplikasi menolak dan menyebutkan letak kesalahannya — template lama tetap dipakai.
5. Ingin kembali ke awal? Klik **Bawaan**.

---

## 2. Alur kerja harian

1. **Mitra** — tambah satu per satu, atau **Impor Excel** (minimal kolom *Nama*). Mitra yang sudah ada (SOBAT ID/NIK/nama sama) diperbarui, tidak dobel.
2. **Kegiatan** — isi nama, tanggal, *bulan pembayaran honor*, satuan, dan tarif per peran. Survei rutin? Klik ikon **Salin** pada kegiatan bulan lalu.
3. **Tambah petugas** di halaman kegiatan → centang mitra → pilih peran & volume. Angka volume/tarif di tabel bisa diklik dan diubah langsung (tersimpan otomatis).
4. **Rekap Honor** — cek total honor per mitra per bulan & siapa yang melebihi batas; **Ekspor Excel** untuk keuangan.
5. **SPK & BAST** — pilih bulan, isi tanggal, klik **Buat**. File Word langsung terunduh.

> Penting: **SPK, BAST, dan pengecekan SBML** memakai **bulan kegiatan** (bulan dari tanggal selesai kegiatan).
> **Bulan pembayaran** terisi otomatis = bulan kegiatan + 1 (bisa diubah per kegiatan, atau aturan umumnya di Pengaturan → Kantor, PPK & bayar).
> Rekap Honor bisa dilihat per *bulan kegiatan* atau per *bulan pembayaran*.
>
> Kegiatan yang ada **setiap bulan** (mis. SHK): saat menambah kegiatan pilih **Bulanan sepanjang tahun**. Aplikasi membuat satu kegiatan per bulan;
> di halaman kegiatan ada pilihan bulan dan tombol **Salin petugas ke bulan berikutnya**.

Salah hapus? Tekan **Urungkan** pada notifikasi yang muncul, atau buka tautan *"Lihat yang terhapus"* di bawah halaman Mitra/Kegiatan.

---

## 3. Keamanan data

- Server otomatis membuat **cadangan harian** (30 hari terakhir disimpan).
- Sebaiknya **setiap awal bulan**, admin membuka **Pengaturan → Cadangan data → Unduh cadangan** lalu menyimpan file `.json` tersebut di Google Drive kantor.
- Memulihkan cadangan akan mengganti seluruh data. Sebelum memulihkan, aplikasi otomatis mencadangkan data yang sekarang.

---

## 4. Di mana aplikasi berjalan?

- Aplikasi berjalan di **Railway** (layanan hosting). Kode sumbernya ada di **GitHub** (`bills1912/seemitra-lite`).
- Data tersimpan di **volume Railway** yang terpasang di folder `/data` — data **tidak hilang** saat aplikasi diperbarui atau dijalankan ulang.
- Setiap perubahan yang disimpan ke GitHub (cabang `main`) otomatis membuat Railway memperbarui aplikasi dalam 2–4 menit.

### Jika aplikasi tidak bisa dibuka
1. Masuk ke [railway.com](https://railway.com) → buka proyek **seemitra-lite** → layanan **seemitra-lite**.
2. Lihat tab **Deployments**. Jika ada yang merah (*Failed/Crashed*), klik deployment hijau terakhir → **Redeploy** (atau *Rollback*) untuk kembali ke versi yang berjalan.
3. Tab **Logs** menampilkan pesan kesalahan. Pesan ini bisa disalin dan ditanyakan ke Claude/AI lain beserta isi file `AGENTS.md`.

### Mengubah teks kecil di tampilan (opsional)
Teks tampilan ada di folder `src/pages/` (satu file per halaman, nama dalam Bahasa Indonesia, mis. `Beranda.tsx`, `Mitra.tsx`).
Bisa diedit langsung di situs GitHub (ikon pensil ✏️ → *Commit changes*). Railway akan memperbarui aplikasi otomatis.
Jika hasilnya gagal, gunakan **Rollback** seperti di atas.

---

## 5. Ringkasan teknis (untuk yang ingin tahu)

| Bagian | Isi |
|---|---|
| `server/` | Server (Node.js + Hono). `db.ts` = database & pengaturan awal, `routes/` = fitur |
| `server/routes/dokumen.ts` | Pembuatan SPK & BAST |
| `src/pages/` | Halaman tampilan (React + TypeScript) |
| `src/components/ui.tsx` | Tombol, kotak isian, jendela, dll. — ubah sekali, seluruh aplikasi ikut berubah |
| `templates/` | Template Word bawaan SPK & BAST |
| `Dockerfile`, `railway.json` | Resep untuk Railway |

Menjalankan di komputer sendiri (butuh Node.js 22.18+ / 24):
```bash
npm install
npm run build
npm start          # buka http://localhost:3000
```
Mode pengembangan (tampilan langsung berubah saat file disimpan): `npm run dev` lalu buka http://localhost:5173.
