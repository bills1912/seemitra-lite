# Tugas: Perbaikan Keamanan Seemitra Lite (hasil audit 27 Nov 2026)

> Status: **Fase 1 selesai** (commit d91a2f9, migrasi 6) · **Fase 2 selesai** (migrasi 7). Fase 3–5 belum dikerjakan.

> **Cara pakai:** tempel seluruh isi file ini ke sesi pengembangan Seemitra Lite, atau simpan di repo (mis. `docs/PERBAIKAN-KEAMANAN.md`) lalu minta asisten: *"Kerjakan tugas di docs/PERBAIKAN-KEAMANAN.md"*.

## Konteks

Audit keamanan penuh dilakukan pada commit `c4a1203` (metodologi Cloudflare security-audit, uji di sandbox lokal dengan data dummy). Hasilnya: 3 temuan terkonfirmasi dan 7 dugaan yang belum terbukti.

Dokumen ini terdiri dari dua bagian:
- **Fase 1 (Prioritas 1–5):** perbaikan hasil audit + CAPTCHA Turnstile. **Kerjakan sekarang**, berurutan sesuai prioritas.
- **Roadmap Fase 2–5:** anti bot lanjutan, anti scrape/crawl, keamanan sesi, anti espionase, dan ketahanan sistem. Dikerjakan bertahap setelah Fase 1 stabil. Nomor baris mengacu ke commit tersebut; cek ulang lokasinya jika kode sudah berubah.

## Aturan wajib (dari `AGENTS.md`)

- Nama fungsi, variabel, teks tampilan, dan komentar tetap dalam **Bahasa Indonesia**.
- Perubahan struktur DB **hanya** lewat migrasi baru yang ditambahkan **di akhir** array `MIGRASI` (`server/db.ts`). Migrasi lama jangan diubah.
- Jangan pakai `enum`, `namespace`, atau parameter properties. Impor lokal harus berakhiran `.ts`.
- Jalankan `npm run build` (typecheck + build) sebelum commit. Ingat: push ke `main` = deploy otomatis ke Railway. **Kerjakan di branch terpisah** (mis. `perbaikan-keamanan`) dan uji lokal dulu.
- Jangan uji serangan ke situs production. Semua uji pakai server lokal dengan `DATA_DIR` sementara dan akun dummy.

---

## PRIORITAS 1 — Kunci sesi bocor lewat file backup (Medium, TERKONFIRMASI)

**Masalah:** kunci HMAC sesi disimpan di `pengaturan` baris `kunci='rahasia'` (`server/db.ts:187-193`). `isiCadangan()` mengekspor seluruh tabel `pengaturan` (`server/db.ts:213-217`), sehingga setiap backup (unduhan admin, backup otomatis harian, `sebelum-reset`, `sebelum-pemulihan`) berisi kunci itu. Siapa pun yang memegang file backup bisa membuat cookie admin palsu, dan cookie itu tetap valid walaupun sandi sudah diganti. Selain itu, `penggunaDariSesi` (`server/auth.ts:46`) menerima payload tanpa `exp`, sehingga cookie seperti itu **tidak pernah kedaluwarsa**.

**Yang harus dikerjakan:**
1. Baca kunci dari env `SESSION_SECRET` jika ada (minimal 32 karakter). Jika tidak ada, kembali ke kunci di DB (untuk pengembangan lokal saja) dan tampilkan peringatan di log saat `NODE_ENV=production`.
2. `isiCadangan()`: jangan ekspor baris `rahasia`, gunakan `SELECT * FROM pengaturan WHERE kunci <> 'rahasia'`.
3. `pulihkanCadangan()`: lewati baris `pengaturan` dengan `kunci='rahasia'` dari file, dan pertahankan kunci yang sedang berlaku (simpan sebelum DELETE, tulis kembali sesudahnya).
4. `penggunaDariSesi()`: tolak payload jika `typeof exp !== 'number'`. Bandingkan tanda tangan dengan `crypto.timingSafeEqual` (cek panjang buffer dulu).

**Uji terima:**
- Buat backup, lalu pastikan JSON tidak berisi baris `kunci: "rahasia"`.
- Restore backup lama yang masih berisi `rahasia`, lalu pastikan kunci aktif tidak berubah dan sesi yang sedang berjalan tetap valid.
- Cookie dengan payload `{"id":1}` (tanpa `exp`) yang ditandatangani dengan kunci benar harus ditolak (401).

**Setelah deploy (langkah manual oleh pemilik):** set `SESSION_SECRET` di Railway (Variables) dengan nilai acak baru, mis. hasil `openssl rand -hex 32`. Ini sekaligus **merotasi kunci**: semua backup lama di Google Drive yang memuat kunci lama jadi tidak berguna untuk memalsukan sesi. Semua pengguna perlu login ulang satu kali.

---

## PRIORITAS 2 — Sesi tidak dicabut saat logout/ganti sandi (Low, TERKONFIRMASI) + ganti sandi tanpa sandi lama

**Masalah:** sesi berupa cookie stateless `{id, exp}` yang berlaku 30 hari (`server/auth.ts:11,27-47`). Logout (`server/index.ts:80-83`) hanya menghapus cookie di browser. Ganti sandi (`server/routes/sistem.ts:117-122`) dan reset sandi oleh admin (`sistem.ts:93-96`) tidak membatalkan cookie lama. Selain itu, `POST /api/ganti-sandi` tidak meminta sandi lama dan tidak tercatat di `riwayat`.

**Yang harus dikerjakan:**
1. Migrasi baru: `ALTER TABLE pengguna ADD COLUMN versi_sesi INTEGER NOT NULL DEFAULT 0;`
2. `buatSesi()` memasukkan `v: versi_sesi` ke payload. `penggunaDariSesi()` hanya menerima cookie jika `versi_sesi` di DB sama dengan `v`.
3. Tambahkan fungsi `cabutSemuaSesi(id)` yang menaikkan `versi_sesi`. Panggil fungsi ini saat logout, saat ganti sandi sendiri (lalu terbitkan cookie baru untuk sesi yang sedang dipakai), dan saat admin mereset sandi atau menurunkan peran.
4. `POST /api/ganti-sandi` wajib menerima `sandi_lama` dan memverifikasinya dengan `cocokSandi`. Jika salah, kembalikan 400 dengan pesan Bahasa Indonesia. Catat perubahannya dengan `catat(nama, 'Ganti kata sandi')`.
5. UI `src/pages/Pengaturan.tsx` (tab Akun, sekitar baris 530-537): tambahkan kolom "Kata sandi saat ini".

**Uji terima:**
- Login dan simpan cookie A, lalu logout. Request dengan cookie A harus mendapat 401.
- Login di dua browser (cookie A dan B), lalu ganti sandi dari browser A. Cookie B harus mendapat 401, sedangkan browser A tetap masuk.
- Ganti sandi tanpa sandi lama, atau dengan sandi lama yang salah, harus mendapat 400.

---

## PRIORITAS 3 — Ketahanan endpoint publik terhadap bot

**Masalah (gabungan 1 temuan terkonfirmasi dan 3 dugaan):**
- **Pemalsuan riwayat (TERKONFIRMASI):** `POST /api/auth/daftar` mengirim `nama` mentah ke `catat()` (`server/index.ts:59`). Body `{"nama":{}}` membuat kolom bergeser sehingga muncul entri riwayat palsu, mis. aksi `Hapus.semua.mitra`. Jika `nama` berupa array atau `true`, akun tetap terbuat tetapi tidak tercatat di riwayat.
- **Bypass pembatas login:** kunci throttle `String(username).toLowerCase()` tidak di-trim (`index.ts:66`), padahal lookup akun memakai `trim()` dengan `COLLATE NOCASE` (`index.ts:69`). Akibatnya `" admin"`, `"admin "`, dan variasi lain masing-masing mendapat jatah 5 percobaan baru.
- **scrypt sinkron:** `scryptSync` (`server/auth.ts:15,20`) memblokir event loop sekitar 30-40 ms per request di `daftar` dan `masuk`.
- **Tidak ada batas body** di rute mana pun, dan panjang `nama` tidak dibatasi (`nama` 1 MiB terbukti tersimpan dua kali dan ikut tersalin ke setiap backup).

**Yang harus dikerjakan:**
1. `daftar`: validasi tipe. `nama`, `username`, dan `sandi` harus string. Setelah `trim`, `nama` 1-100 karakter dan `sandi` 6-128 karakter. Kirim hanya nilai yang sudah dinormalisasi ke `INSERT` dan `catat`. Bungkus `INSERT` + `catat` dalam `transaksi()`.
2. `masuk`: normalisasi username sekali saja, `const u = String(username ?? '').trim().toLowerCase()`, lalu pakai `u` untuk kunci throttle **dan** lookup. Tambahkan penghitung per-IP (ambil IP dari header `x-forwarded-for` pertama, karena Railway berada di belakang proxy), mis. maksimal 20 percobaan gagal per 15 menit. Bersihkan entri `percobaan` yang sudah lewat secara berkala, dan batasi ukuran Map.
3. Batasi laju `daftar` per IP, mis. 5 per jam.
4. Ganti `scryptSync` dengan versi async (`util.promisify(crypto.scrypt)`). `hashSandi` dan `cocokSandi` menjadi `async`, jadi sesuaikan semua pemanggilnya (`index.ts`, `sistem.ts`). Untuk username yang tidak ada, tetap jalankan scrypt terhadap hash dummy supaya waktu respons tidak membocorkan apakah username terdaftar.
5. Pasang `bodyLimit` dari `hono/body-limit`: sekitar 16 KB untuk `/api/auth/*`, sekitar 5 MB untuk rute impor/template, dan lebih besar hanya untuk `POST /api/cadangan/pulihkan` (khusus admin).

**Uji terima:**
- `{"nama":{}, ...}` mendapat 400, dan tidak ada baris baru di `pengguna` maupun `riwayat`.
- Setelah 5 kali salah untuk `dummyadmin`, percobaan dengan `" dummyadmin"` juga mendapat 429.
- Body lebih dari 16 KB ke `/api/auth/daftar` mendapat 413.
- Selama satu request login berjalan, `GET /api/sehat` tetap merespons cepat.

---

## PRIORITAS 4 — Hardening lainnya (kerjakan bila waktu cukup)

1. **Token unduhan** (`server/routes/data.ts:770-799`, `server/index.ts:86`): hapus entri setelah dipakai pertama kali, simpan `id` pengguna penerbit, dan batasi total byte di Map `unduhanSementara` (mis. 200 MB).
2. **Bootstrap admin pertama** (`index.ts:45-57`): jika env `SETUP_TOKEN` diset, pendaftar pertama wajib mengirim token yang cocok.
3. **Riwayat honor** (`data.ts:507-565`): tambahkan `catat()` di `PUT /api/petugas/:id` (sertakan tarif/volume lama dan baru). Di `POST /api/penugasan/pulihkan`, isi `dibuat_oleh` dari sesi, bukan dari body, dan catat aksinya. Tolak `volume`/`tarif` yang negatif atau bukan angka terhingga.
4. **Impor Excel** (`server/excel.ts:64-77`): batasi baris (mis. 5.000) dan kolom (mis. 50) sebelum loop. Simpan `ws.columnCount` di variabel di luar loop dalam.
5. **Header keamanan**: `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, dan `X-Content-Type-Options: nosniff` (bisa pakai `hono/secure-headers`).
6. **Pesan error** (`index.ts:21-25`): saat production, balas "Terjadi kesalahan pada server." saja, dan tulis detailnya ke log.
7. **Pemulihan backup** (`db.ts:223-241`): validasi nama kolom terhadap `PRAGMA table_info(<tabel>)`, dan tolak kunci template selain `spk.docx`/`bast.docx` **sebelum** ada perubahan apa pun.
8. **`POST /api/dokumen/reset-nomor`** (`dokumen.ts:157-162`): validasi format `bulan` (`/^\d{4}-\d{2}$/`) dan pertimbangkan `wajibAdmin`.

---

## PRIORITAS 5 — CAPTCHA Cloudflare Turnstile di login & pendaftaran (anti bot)

**Tujuan:** bot tidak bisa menembak `POST /api/auth/masuk` dan `POST /api/auth/daftar` tanpa lolos verifikasi Turnstile. Turnstile gratis, kebanyakan pengguna tidak perlu klik apa pun, dan bisa dipakai di domain mana saja termasuk `*.up.railway.app` (tidak harus pakai proxy Cloudflare).

**Prinsip penting:**
- **Validasi di server wajib.** Widget di browser saja tidak melindungi apa-apa.
- Token hanya berlaku sekali, jadi widget harus di-reset setelah setiap percobaan yang gagal.
- Verifikasi Turnstile dijalankan **sebelum** lookup DB dan scrypt, supaya bot tidak membebani server.
- Site key bersifat publik dan dikirim ke browser lewat `/api/auth/saya`, jadi tidak perlu rebuild saat key berganti. Secret key **hanya** disimpan di env server.

### 5.1 Server — file baru `server/turnstile.ts`

```ts
/** VERIFIKASI CAPTCHA (Cloudflare Turnstile) — aktif bila TURNSTILE_SECRET_KEY diset. */
import type { Context } from 'hono';

const RAHASIA = process.env.TURNSTILE_SECRET_KEY ?? '';
export const KUNCI_SITUS = process.env.TURNSTILE_SITE_KEY ?? '';
export const turnstileAktif = () => Boolean(RAHASIA && KUNCI_SITUS);

if (!turnstileAktif() && process.env.NODE_ENV === 'production') {
  console.warn('[turnstile] NONAKTIF — set TURNSTILE_SITE_KEY dan TURNSTILE_SECRET_KEY di Railway.');
}

/** IP klien di belakang proxy Railway (ambil alamat pertama di X-Forwarded-For). */
export function ipKlien(c: Context): string {
  return (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim();
}

/** true bila token sah untuk aksi ini. Gagal terhubung = ditolak (fail-closed). */
export async function cekTurnstile(token: unknown, ip: string, aksi: 'masuk' | 'daftar'): Promise<boolean> {
  if (!turnstileAktif()) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const isi = new URLSearchParams({ secret: RAHASIA, response: token });
  if (ip) isi.set('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: isi, signal: AbortSignal.timeout(5000),
    });
    const d = (await r.json()) as { success: boolean; action?: string; 'error-codes'?: string[] };
    if (!d.success) console.warn('[turnstile] ditolak:', d['error-codes']?.join(','));
    // Dummy key Cloudflare tidak mengirim action yang sama, jadi cek action hanya bila ada
    return d.success === true && (!d.action || d.action === aksi);
  } catch (e) {
    console.error('[turnstile] gagal menghubungi Cloudflare:', e);
    return false;
  }
}
```

### 5.2 Server — pasang di `server/index.ts`

- `GET /api/auth/saya` ikut mengirim site key:
  ```ts
  import { cekTurnstile, ipKlien, KUNCI_SITUS, turnstileAktif } from './turnstile.ts';
  app.get('/api/auth/saya', (c) => c.json({
    pengguna: penggunaDariSesi(c), perluSetup: jumlahPengguna() === 0,
    turnstile: turnstileAktif() ? KUNCI_SITUS : null,
  }));
  ```
- Di awal handler `POST /api/auth/masuk`, **setelah** pengecekan throttle dan **sebelum** query DB/scrypt:
  ```ts
  const body = await c.req.json();
  if (!(await cekTurnstile(body.turnstile, ipKlien(c), 'masuk')))
    throw new GagalError('Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi.', 403);
  ```
  Kegagalan Turnstile juga dihitung sebagai percobaan gagal di penghitung per-IP (Prioritas 3).
- Lakukan hal yang sama di `POST /api/auth/daftar` dengan aksi `'daftar'`, sebelum `hashSandi`.

### 5.3 Frontend — komponen baru `src/components/Turnstile.tsx`

```tsx
/** Widget CAPTCHA Cloudflare Turnstile (render eksplisit). */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opsi: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SKRIP = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let muatSkrip: Promise<void> | null = null;
function pastikanSkrip() {
  muatSkrip ??= new Promise((ok, gagal) => {
    const s = document.createElement('script');
    s.src = SKRIP; s.async = true; s.onload = () => ok(); s.onerror = () => gagal(new Error('Turnstile gagal dimuat'));
    document.head.appendChild(s);
  });
  return muatSkrip;
}

export type PeganganTurnstile = { reset: () => void };

export const Turnstile = forwardRef<PeganganTurnstile, { kunciSitus: string; aksi: 'masuk' | 'daftar'; onToken: (t: string) => void }>(
  function Turnstile({ kunciSitus, aksi, onToken }, ref) {
    const wadah = useRef<HTMLDivElement>(null);
    const idWidget = useRef<string>();
    useImperativeHandle(ref, () => ({ reset: () => { onToken(''); window.turnstile?.reset(idWidget.current); } }));
    useEffect(() => {
      let batal = false;
      pastikanSkrip().then(() => {
        if (batal || !wadah.current || !window.turnstile) return;
        idWidget.current = window.turnstile.render(wadah.current, {
          sitekey: kunciSitus, action: aksi, theme: 'light', language: 'id',
          callback: (t: string) => onToken(t),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
      }).catch(() => onToken(''));
      return () => { batal = true; if (idWidget.current) window.turnstile?.remove(idWidget.current); };
    }, [kunciSitus, aksi]);
    return <div ref={wadah} className="my-3 flex justify-center" />;
  },
);
```

### 5.4 Frontend — pakai di `src/pages/Masuk.tsx`

- Ambil `turnstile` (site key) dari data `/api/auth/saya` yang sudah dipakai halaman ini.
- Jika site key ada: tampilkan `<Turnstile kunciSitus={...} aksi="masuk" onToken={setToken} ref={refCaptcha} />` di atas tombol "Masuk", lalu nonaktifkan tombol selama `token` masih kosong. Lakukan hal yang sama di form daftar dengan `aksi="daftar"`.
- Kirim `turnstile: token` di body `api.post('/auth/masuk', {...})` dan `'/auth/daftar'`.
- Setelah setiap respons gagal (401/403/429), panggil `refCaptcha.current?.reset()`, karena token hanya berlaku sekali.
- Jika site key `null` (Turnstile nonaktif), form berjalan seperti sekarang.

### 5.5 CSP (jika secure headers dari Prioritas 4 dipasang)

Izinkan domain Turnstile: `script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self'`.

### 5.6 Uji terima (lokal, memakai dummy key resmi Cloudflare)

| Skenario | `TURNSTILE_SITE_KEY` | `TURNSTILE_SECRET_KEY` | Harapan |
|---|---|---|---|
| Selalu lolos | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` | Login normal berhasil |
| Selalu gagal di server | `1x00000000000000000000AA` | `2x0000000000000000000000000000000AA` | Login → 403 "Verifikasi keamanan gagal", **tanpa** scrypt/query DB |
| Tantangan interaktif | `3x00000000000000000000FF` | `1x0000000000000000000000000000000AA` | Widget meminta klik, tombol baru aktif setelah lolos |
| Tanpa token (meniru bot) | kunci apa saja | `1x…AA` | `curl` POST tanpa field `turnstile` → 403 |
| Nonaktif | (kosong) | (kosong) | Aplikasi berjalan seperti sebelumnya, ada peringatan di log production |

Dummy key **jangan pernah** dipakai di production.

### 5.7 Aktivasi di production (langkah manual oleh pemilik)

1. Buka Cloudflare Dashboard → **Turnstile** → **Add widget**. Isi nama `Seemitra Lite`, hostname = domain Railway aplikasi (dan custom domain bila ada), mode **Managed**.
2. Salin **Site Key** dan **Secret Key**.
3. Di Railway → service Seemitra Lite → **Variables**: tambahkan `TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY`, lalu redeploy.
4. Buka halaman login dan pastikan widget muncul dan login berhasil. Di dashboard Turnstile, cek grafik "solve rate" setelah beberapa hari.

---

# ROADMAP KEAMANAN BERTAHAP

> Prioritas 1–5 di atas adalah **Fase 1**. Fase berikutnya dikerjakan setelah Fase 1 ter-deploy dan stabil. Setiap butir sebaiknya dijadikan satu branch/PR tersendiri.

## Fase 2 — Anti bot lanjutan & anti scrape/crawl  ✅ selesai (28 Nov 2026, migrasi 7)

1. **Tutup pendaftaran terbuka (direkomendasikan).** Seemitra adalah aplikasi internal satu kantor, jadi ganti `POST /api/auth/daftar` dengan **undangan dari admin**:
   - admin membuat tautan undangan sekali pakai (token acak 32 byte, berlaku 72 jam, disimpan sebagai hash di tabel baru `undangan`);
   - pendaftaran hanya bisa lewat tautan itu.
   - Tambahkan flag di `pengaturan`: `pendaftaran_terbuka: false` (bawaan).
   - Uji terima: daftar tanpa token undangan → 403.
2. **Proxy Cloudflare di depan Railway (opsional, butuh custom domain).** Pasang custom domain yang di-proxy Cloudflare, aktifkan **Bot Fight Mode**, buat aturan WAF rate limiting untuk `/api/auth/*` (mis. 10 permintaan per menit per IP), dan buat aturan yang memblokir negara atau ASN yang tidak relevan bila perlu. Setelah itu, di server, percayai IP dari `CF-Connecting-IP`, bukan `X-Forwarded-For`.
3. **Cegah terindeks mesin pencari:** tambahkan header `X-Robots-Tag: noindex, nofollow` di semua respons dan `public/robots.txt` berisi `Disallow: /`.
4. **Masking data sensitif:**
   - Di daftar mitra dan ekspor milik operator, tampilkan NIK dan nomor rekening dalam bentuk tersamar (mis. `1278••••••••0012`).
   - Sediakan endpoint `GET /api/mitra/:id/sensitif` untuk melihat nilai penuh, dan catat setiap aksesnya di riwayat (`Lihat data sensitif`).
   - SPK/BAST tetap memakai nilai penuh di server.
5. **Batas laju per pengguna untuk data massal:** `GET /api/mitra`, `/api/mitra-ekspor`, `/api/rekap/ekspor`, dan pembuatan dokumen dibatasi, mis. 30 permintaan per menit per pengguna dan maksimal 10 ekspor per jam. Lebih dari itu → 429, dicatat di riwayat.
6. **Deteksi penyedotan data:** setiap ekspor Excel atau dokumen dicatat di riwayat lengkap dengan jumlah baris. Tampilkan peringatan di Beranda admin jika satu pengguna mengekspor lebih dari N kali dalam sehari.

## Fase 3 — Keamanan sesi lanjutan

1. **Umur sesi lebih pendek:** sesi absolut 12 jam dan idle timeout 2 jam. Perbarui `exp` saat ada aktivitas, dengan sliding expiry yang dibatasi oleh batas absolut.
2. **Tabel `sesi`:** simpan `id`, `pengguna_id`, `dibuat`, `terakhir_aktif`, `ip`, `user_agent`, dan `dicabut`. Cookie cukup berisi `id` sesi yang ditandatangani. Dengan ini:
   - menu **"Sesi aktif"** bisa menampilkan daftar sesi lengkap dengan tombol "Keluar dari semua perangkat";
   - admin bisa mencabut sesi pengguna lain.
3. **Cek `Origin`** untuk semua metode selain GET: tolak bila `Origin` bukan domain aplikasi. Atau pasang `csrf()` dari `hono/csrf`.
4. **Catatan login:** setiap login (berhasil maupun gagal) dicatat di tabel `log_masuk` (waktu, username yang dinormalisasi, IP, user agent, hasil). Admin mendapat peringatan di Beranda jika ada lebih dari 20 kegagalan per jam.
5. **Kebijakan sandi:** minimal 10 karakter untuk admin. Tolak sandi yang sama dengan username atau ada di daftar sandi umum (misalnya 1.000 teratas, disimpan lokal). Opsional: **2FA TOTP untuk admin**, mis. memakai `otpauth` + QR.

## Fase 4 — Anti espionase (kebocoran data & ancaman orang dalam)

1. **Enkripsi file backup:**
   - Unduhan backup dienkripsi AES-256-GCM dengan kunci dari sandi yang dimasukkan admin saat mengunduh (turunkan kuncinya dengan scrypt dan salt acak), lalu disimpan dengan format `.seemitra-backup`.
   - Restore meminta sandi yang sama.
   - Backup otomatis di `/data/cadangan` dienkripsi dengan env `BACKUP_KEY`.
   - Hash sandi pengguna **tidak** ikut diekspor.
2. **Enkripsi kolom sensitif (opsional):** NIK dan nomor rekening disimpan terenkripsi (AES-256-GCM, kunci di env `DATA_KEY`). Untuk pencarian NIK, simpan kolom `nik_cari` = HMAC-SHA256(NIK) agar pencocokan dan impor tetap bekerja. Pertimbangkan trade-off-nya sebelum mengerjakan.
3. **Log audit tahan ubah:**
   - Tidak ada rute yang boleh menghapus atau mengubah `riwayat`.
   - Setiap baris menyimpan `hash = SHA256(hash_baris_sebelumnya + isi_baris)` (hash chain).
   - Endpoint admin `GET /api/riwayat/verifikasi` memeriksa apakah rantainya utuh.
   - Kolom `pengguna_id` ditambahkan supaya aktor tidak lagi berupa teks bebas.
4. **Peran lebih halus:** tambahkan peran `pengamat` (hanya baca, tanpa data sensitif). Untuk operator, pertimbangkan izin `boleh_ekspor` yang diatur admin.
5. **Kebijakan kantor (non-teknis):** backup hanya disimpan di folder Drive dengan akses terbatas (bukan "siapa saja yang punya link"), PC kantor wajib dikunci saat ditinggal, dan akun pegawai yang keluar segera dinonaktifkan.

## Fase 5 — Anti hack & ketahanan (agar sistem tidak jatuh)

1. **Akun platform:** wajib 2FA di GitHub dan Railway. Batasi siapa saja yang menjadi anggota project Railway.
2. **Proteksi branch `main`:** wajib lewat Pull Request, dan PR harus lulus `npm run build`. Tambahkan GitHub Action sederhana (`npm ci && npm run build`) yang memblokir merge bila gagal.
3. **Dependensi:** aktifkan Dependabot (`.github/dependabot.yml`, ekosistem npm, mingguan). Jalankan `npm audit --omit=dev` di CI dan gagalkan build bila ada temuan high/critical.
4. **Pemantauan:**
   - Pasang uptime monitor eksternal (mis. UptimeRobot atau Better Stack, gratis) ke `/api/sehat`, dengan notifikasi WhatsApp/email.
   - Gunakan monitor Railway untuk CPU, memori, dan disk volume `/data`, dengan peringatan bila disk lebih dari 80%.
5. **Backup di luar server & latihan restore:**
   - Backup otomatis terenkripsi dikirim ke penyimpanan di luar Railway, mis. bucket Railway lain, Google Drive lewat service account, atau S3.
   - Lakukan **latihan restore** setiap 3 bulan di instance staging dan catat hasilnya.
6. **Lingkungan staging:** buat environment Railway kedua untuk uji perubahan, dengan data dummy, volume terpisah, dan `SETUP_TOKEN` wajib.
7. **Rencana insiden (1 halaman):** siapa yang dihubungi, cara merotasi `SESSION_SECRET` (semua orang otomatis keluar), cara menonaktifkan pendaftaran, cara memulihkan dari backup, dan cara memberi tahu atasan bila data mitra bocor.
8. **Audit ulang berkala:**
   - Setelah Fase 1 selesai, jalankan ulang audit security-audit (run-2) untuk memastikan perbaikannya benar-benar menutup celah.
   - Setelah itu, jalankan audit terbatas (scoped) setiap ada perubahan besar dan audit penuh per kuartal.

---

## Laporan balik yang diminta

Setelah selesai mengerjakan **Fase 1 (Prioritas 1–5)**, buat ringkasan berisi:
- daftar file yang diubah atau dibuat;
- migrasi baru (nomor versi);
- hasil setiap uji terima (lulus/gagal), termasuk tabel uji Turnstile;
- langkah manual yang perlu dilakukan pemilik di Railway: `SESSION_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, dan opsional `SETUP_TOKEN`.

Jangan kerjakan Fase 2–5 sebelum diminta. Untuk tiap fase, buat rencana singkat dulu dan tunggu persetujuan.
