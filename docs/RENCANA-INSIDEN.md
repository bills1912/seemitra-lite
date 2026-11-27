# Rencana Insiden Keamanan — Seemitra Lite

Satu halaman ini dipakai bila ada dugaan **akun dibobol, data bocor, atau aplikasi diserang**. Lakukan berurutan, jangan panik.

## 0. Siapa yang dihubungi
| Peran | Nama | Kontak |
|---|---|---|
| Pengelola aplikasi (admin utama) | _isi nama_ | _isi no. WA_ |
| Cadangan pengelola | _isi nama_ | _isi no. WA_ |
| Atasan yang wajib diberi tahu | _isi nama/jabatan_ | _isi no. WA_ |

## 1. Hentikan akses (5 menit pertama)
1. **Keluarkan semua orang sekaligus:** Railway → layanan *seemitra-lite* → **Variables** → ganti nilai `SESSION_SECRET` dengan teks acak baru (64 karakter, mis. dari `openssl rand -hex 32`). Railway menjalankan ulang aplikasi; semua sesi langsung berakhir.
2. **Akun tertentu saja:** Pengaturan → Pengguna → ubah akun itu → atur **kata sandi baru** (otomatis keluar dari semua perangkat). Bila perlu, ubah status atau hapus akunnya.
3. **Tutup pendaftaran:** Pengaturan → Pengguna → *Keamanan akses* → pastikan "Izinkan pendaftaran tanpa undangan" **mati**, lalu batalkan semua undangan yang masih berlaku.
4. **Darurat berat** (mis. data sedang disedot): Railway → layanan → **Settings → Pause / Remove public domain** sementara. Aplikasi tidak bisa dibuka siapa pun sampai domain dipasang lagi.

## 2. Cari tahu apa yang terjadi
- Pengaturan → **Keamanan** → *Catatan masuk* (siapa mencoba masuk, dari IP mana) dan *Sesi aktif*.
- Pengaturan → **Riwayat aktivitas** (siapa mengubah/mengekspor apa). Tekan **Periksa sekarang** di tab Keamanan untuk memastikan riwayat tidak dipalsukan.
- Railway → **Logs** untuk pesan galat atau lonjakan permintaan.
- Catat waktu kejadian, akun yang terlibat, dan data apa yang mungkin terlihat.

## 3. Pulihkan data (bila data rusak/terhapus)
1. Pengaturan → **Cadangan data** → pilih cadangan otomatis sebelum kejadian → **Uji** dulu, lalu **Pulihkan**.
2. Bila server tidak bisa dipakai sama sekali: buat proyek Railway baru dari repo GitHub yang sama, isi Variables yang sama (`SESSION_SECRET` baru, `BACKUP_KEY` **yang lama** agar cadangan otomatis bisa dibuka), lalu pulihkan dari file cadangan `.seemitra-backup` (perlu kata sandi cadangan) atau dari bucket `seemitra-cadangan`.
3. Setelah pemulihan, akun yang belum ada di server baru dibuat tanpa kata sandi — admin mengatur ulang kata sandinya.

## 4. Ganti kunci-kunci rahasia (bila diduga bocor)
| Variabel | Akibat bila diganti |
|---|---|
| `SESSION_SECRET` | Semua orang keluar, harus masuk ulang. |
| `BACKUP_KEY` | Cadangan otomatis **lama** tidak bisa dibuka lagi oleh server. Sebelum mengganti, unduh dulu cadangan terbaru (dikunci kata sandi). |
| `TURNSTILE_SECRET_KEY` | Buat kunci baru di Cloudflare → Turnstile → *Rotate secret*. |
| Kredensial bucket | Railway → bucket *seemitra-cadangan* → **Credentials → Reset**. Variabel aplikasi mengikuti otomatis. |
| Akun GitHub / Railway | Ganti sandi, cabut sesi lain, pastikan 2FA aktif. |

## 5. Beri tahu
- Bila **data pribadi mitra** (NIK, rekening, alamat) mungkin bocor: laporkan ke atasan pada hari yang sama, sertakan catatan langkah 2. Ikuti ketentuan pelindungan data pribadi yang berlaku di kantor (UU 27/2022 tentang Pelindungan Data Pribadi).
- Beri tahu pengguna aplikasi untuk mengganti kata sandi.

## 6. Setelah aman
- Tulis ringkasan singkat: apa yang terjadi, penyebab, langkah yang diambil, perbaikan agar tidak terulang.
- Lakukan **uji pemulihan** cadangan dan periksa keutuhan riwayat sekali lagi.
