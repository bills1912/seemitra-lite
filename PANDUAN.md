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
| Menghapus banyak mitra/kegiatan sekaligus (admin) | Tombol **Pilih** di halaman Mitra/Kegiatan → centang → **Hapus** (masuk tempat sampah, bisa diurungkan) |
| Mengosongkan penugasan mitra (admin) | Halaman **Mitra** → **Pilih** → centang mitra → **Hapus penugasan** (bisa diurungkan), atau tombol **Reset penugasan** untuk seluruh mitra (ketik HAPUS SEMUA; cadangan dibuat otomatis). Data mitra & kegiatan tetap ada |
| Menghapus SBML yang salah isi (admin) | **Pengaturan → Batas honor (SBML)** → tombol **Hapus SBML [tahun]** atau ikon tempat sampah di tabel ringkasan (bisa diurungkan) |
| Mengosongkan seluruh data mitra/kegiatan/SBML, mis. awal tahun (admin) | **Pengaturan → Reset data** (permanen; cadangan dibuat otomatis lebih dulu) |
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
> di halaman kegiatan ada pilihan bulan, tombol **Salin petugas ke bulan berikutnya**, dan **Hapus petugas di bulan-bulan…** bila salinan keliru (bisa diurungkan).
>
> Di tabel petugas, centang beberapa petugas (atau centang judul kolom untuk semua) lalu klik **Hapus** untuk mengeluarkan sekaligus.

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

### Pengaturan keamanan di Railway (Variables)
Buka layanan **seemitra-lite** → tab **Variables**, lalu isi:

| Nama | Isi | Keterangan |
|---|---|---|
| `SESSION_SECRET` | teks acak 64 karakter (buat di [it-tools.tech/token-generator](https://it-tools.tech/token-generator) atau `openssl rand -hex 32`) | **Wajib.** Kunci tanda tangan login. Mengganti nilainya = semua orang otomatis keluar (lakukan bila curiga ada kebocoran). |
| `TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY` | dari Cloudflare → Turnstile → *Add widget* (mode **Managed**, hostname = alamat aplikasi) | Pemeriksaan anti-bot di halaman masuk & daftar. Biasanya berjalan otomatis tanpa diklik. |
| `SETUP_TOKEN` | kode bebas | Opsional. Hanya dipakai saat aplikasi masih kosong: pendaftar pertama (admin) wajib memasukkan kode ini. |
| `BACKUP_KEY` | teks acak 64 karakter (`openssl rand -hex 32`) | Mengunci (enkripsi) cadangan otomatis harian di server. **Salin & simpan nilainya di tempat aman di luar Railway** — tanpa kunci ini cadangan otomatis tidak bisa dibuka. |
| `CADANGAN_S3_*` | rujukan ke bucket `seemitra-cadangan` (sudah terpasang) | Salinan cadangan harian terenkripsi dikirim ke bucket terpisah (90 salinan terakhir). |
| `ALAMAT_APLIKASI` | mis. `seemitra.kantor.go.id` | Opsional. Hanya bila memakai domain sendiri; alamat `*.up.railway.app` sudah dikenali otomatis. |
| `PERCAYA_CLOUDFLARE` | `1` | **Hanya** bila aplikasi dibuka lewat domain sendiri yang di-proxy Cloudflare (lihat di bawah). Jangan diisi bila memakai alamat `*.up.railway.app`. |

Setelah mengubah Variables, Railway menjalankan ulang aplikasi otomatis. Hal-hal lain yang sudah aktif tanpa pengaturan:
- Salah kata sandi 5× → akun dikunci 5 menit; 20× dari satu jaringan → jaringan itu dikunci 15 menit.
- **Keluar** dari aplikasi = keluar dari semua perangkat. **Ganti kata sandi** = perangkat lain otomatis keluar.
- Ganti kata sandi wajib mengisi kata sandi saat ini.
- File cadangan tidak berisi kunci login.
- **Akun baru hanya lewat tautan undangan** (Pengaturan → Pengguna → *Buat tautan undangan* → kirim lewat WhatsApp). Tautan berlaku 72 jam dan sekali pakai. Untuk banyak orang sekaligus: **Undang banyak (Excel)** → unduh file contoh, isi Nama / Username / Peran / No WA (username kosong dibuatkan otomatis dari nama), unggah → **pratinjau** muncul dan bisa diedit langsung (baris bermasalah ditandai merah: username ganda/sudah dipakai, nama kosong, dsb.) → *Buat tautan* → kirim per orang lewat tombol WhatsApp atau unduh daftar tautannya (maks. 200 nama per unggahan). Username dari undangan terkunci di formulir pendaftaran. Pendaftaran umum bisa dibuka di panel *Keamanan akses* (tidak disarankan).
- **NIK & nomor rekening tampil tersamar** (mis. `1278••••••••0012`). Klik *Tampilkan NIK & rekening lengkap* di detail mitra bila perlu — setiap akses tercatat di riwayat. Ekspor Excel oleh operator juga tersamar; ekspor admin tetap lengkap. SPK/BAST selalu memakai data asli.
- Pengambilan data dibatasi per pengguna: ekspor Excel 10×/jam, pembuatan SPK/BAST 30×/jam, muat daftar mitra 60×/menit. Bila ada yang mengekspor melebihi batas wajar harian (bawaan 10×, bisa diubah di *Keamanan akses*), Beranda admin menampilkan peringatan.
- Aplikasi tidak diindeks mesin pencari (Google dsb.).
- **Sesi masuk** berakhir otomatis setelah **2 jam tidak dipakai** atau **12 jam** sejak masuk. Daftar perangkat yang sedang masuk ada di **Akun saya**; admin melihat semua sesi dan **catatan masuk** di **Pengaturan → Keamanan**.
- **Verifikasi 2 langkah** (Akun saya → Aktifkan): setelah kata sandi, diminta 6 angka dari aplikasi Google/Microsoft Authenticator. Sangat disarankan untuk admin. Bila HP hilang, admin lain bisa mereset dari menu Pengguna.
- **Kata sandi**: admin minimal 10 karakter, lainnya minimal 6, tidak boleh memuat username atau termasuk kata sandi umum. Tips mudah diingat: gabungkan 3 kata, mis. `kopi-pagi-gunungtua`.
- **Peran**: *Admin* (semua), *Operator* (kelola data; izin ekspor/SPK bisa dicabut per orang), *Pengamat* (hanya melihat, tanpa data pribadi & ekspor).
- **Cadangan yang diunduh dikunci kata sandi** (file `.seemitra-backup`). Catat kata sandinya terpisah dari file. Tekan **Uji** setiap 3 bulan (aman, tidak mengubah data) — Beranda mengingatkan bila sudah waktunya.
- **Riwayat aktivitas tidak bisa dihapus/diubah**, dan setiap baris terkunci berantai. Tombol **Periksa sekarang** (Pengaturan → Keamanan) mendeteksi bila ada yang memalsukannya langsung di database.
- Saat **memulihkan cadangan**, akun pengguna dan riwayat aktivitas **tidak** ditimpa.

#### Kebijakan kantor (non-teknis, wajib dijalankan)
- File cadangan hanya disimpan di folder Google Drive dengan **akses terbatas** (bukan "siapa saja yang memiliki link").
- PC/laptop kantor **dikunci** (Windows + L) setiap ditinggal.
- Pegawai yang pindah/keluar: **hapus atau nonaktifkan akunnya hari itu juga**.
- Jangan berbagi akun; setiap orang memakai akunnya sendiri.
- Akun **GitHub** dan **Railway** pemilik aplikasi wajib memakai **verifikasi 2 langkah**, dan anggota proyek Railway dibatasi seperlunya.

#### Pemeriksaan otomatis & pemantauan
- Setiap perubahan kode diperiksa otomatis oleh GitHub (*Actions → Periksa*: build + audit keamanan dependensi). **Dependabot** mengusulkan pembaruan dependensi setiap Senin.
- Disarankan (sekali atur, gratis): **UptimeRobot** → *Add monitor* → HTTP(s) → `https://seemitra-lite-production.up.railway.app/api/sehat`, interval 5 menit, notifikasi email/WhatsApp.
- Disarankan: GitHub → repo → **Settings → Branches → Add rule** untuk `main`: centang *Require status checks* (pilih `build`) dan *Do not allow force pushes / deletions*. Railway → layanan → **Settings → "Wait for CI"** agar deploy menunggu pemeriksaan lulus.
- Rencana bila terjadi insiden: lihat `docs/RENCANA-INSIDEN.md`.

#### (Opsional) Memasang Cloudflare di depan aplikasi
Butuh domain sendiri (mis. `seemitra.bpspaluta.id`). Tambahkan domain itu di Cloudflare (ikon awan oranye = *Proxied*), arahkan ke Railway (*Settings → Networking → Custom Domain*), lalu di Cloudflare: aktifkan **Security → Bots → Bot Fight Mode**, dan buat aturan **Security → WAF → Rate limiting**: jalur `/api/auth/` maksimal 10 permintaan per menit per IP. Setelah itu isi `PERCAYA_CLOUDFLARE=1` di Railway dan tambahkan domain baru ke widget Turnstile.

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
| `server/auth.ts`, `server/turnstile.ts` | Login, sesi, dan pemeriksaan anti-bot |
| `docs/PERBAIKAN-KEAMANAN.md` | Hasil audit keamanan & rencana keamanan bertahap |
| `docs/RENCANA-INSIDEN.md` | Langkah-langkah bila terjadi insiden keamanan |
| `server/data/sandi-umum.txt` | Daftar kata sandi terlalu umum (boleh ditambah, satu per baris) |

Menjalankan di komputer sendiri (butuh Node.js 22.18+ / 24):
```bash
npm install
npm run build
npm start          # buka http://localhost:3000
```
Mode pengembangan (tampilan langsung berubah saat file disimpan): `npm run dev` lalu buka http://localhost:5173.
