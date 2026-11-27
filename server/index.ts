/**
 * SEEMITRA LITE — SERVER
 * Menjalankan API (/api/...) dan menyajikan tampilan web (folder dist/).
 * Jalankan: npm start   (lihat PANDUAN.md untuk penjelasan lengkap)
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, ambilPengaturan, buatCadanganOtomatis, catat, kunciRahasia, transaksi, DATA_DIR } from './db.ts';
import { bacaSesi, bersihkanSesi, buatSesi, cabutSesi, cocokSandi, cocokSandiTiruan, hapusSesi, hashSandi, penggunaDariSesi, bolehEkspor, PESAN_TANPA_IZIN_EKSPOR, wajibLogin, type Env } from './auth.ts';
import { cekSandiBaru } from './sandi.ts';
import { cekKodeTotp } from './totp.ts';
import { akun } from './routes/akun.ts';
import { pastikanCadanganLuar, unggahCadanganLuar } from './s3.ts';
import { cekTurnstile, ipKlien, KUNCI_SITUS, turnstileAktif } from './turnstile.ts';
import { batasiPengguna, buatPembatas } from './pembatas.ts';
import { GagalError } from './util.ts';
import { data, ambilUnduhan, kirimFile } from './routes/data.ts';
import { laporan } from './routes/laporan.ts';
import { dokumen } from './routes/dokumen.ts';
import { sistem, hashToken } from './routes/sistem.ts';

const app = new Hono<Env>();
const PRODUKSI = process.env.NODE_ENV === 'production';

app.onError((err, c) => {
  if (err instanceof GagalError) return c.json({ pesan: err.message }, err.status as 400);
  console.error(err);
  // detail galat hanya ditulis ke log server, tidak ditampilkan ke pengguna
  return c.json({ pesan: PRODUKSI ? 'Terjadi kesalahan pada server.' : 'Terjadi kesalahan pada server: ' + err.message }, 500);
});

/* ---------- Header keamanan (semua respons) ---------- */
const TURNSTILE = 'https://challenges.cloudflare.com';
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", TURNSTILE],
    frameSrc: [TURNSTILE],
    connectSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // animasi memakai atribut style
    imgSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'", 'data:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
  xFrameOptions: 'DENY',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'same-origin',
  crossOriginEmbedderPolicy: false,
}));

/* ---------- Jangan diindeks mesin pencari (aplikasi internal) ---------- */
app.use('*', async (c, next) => { await next(); c.header('X-Robots-Tag', 'noindex, nofollow, noarchive'); });

/* ---------- Batas ukuran kiriman ---------- */
const terlaluBesar = (batas: string) => (c: import('hono').Context) =>
  c.json({ pesan: `Data yang dikirim terlalu besar (maksimal ${batas}).` }, 413);
const KB = 1024, MB = 1024 * KB;
app.use('/api/auth/*', bodyLimit({ maxSize: 16 * KB, onError: terlaluBesar('16 KB') }));
const batasCadangan = bodyLimit({ maxSize: 200 * MB, onError: terlaluBesar('200 MB') });
const batasUmum = bodyLimit({ maxSize: 5 * MB, onError: terlaluBesar('5 MB') });
app.use('/api/*', (c, next) => (c.req.path === '/api/cadangan/pulihkan' ? batasCadangan(c, next) : batasUmum(c, next)));

/* ---------- Cek asal permintaan (anti CSRF) ----------
 * Perubahan data (POST/PUT/DELETE) hanya diterima dari halaman aplikasi ini sendiri. */
const ALAMAT_SAH = new Set([process.env.RAILWAY_PUBLIC_DOMAIN, ...(process.env.ALAMAT_APLIKASI ?? '').split(',')].map((x) => (x ?? '').trim().toLowerCase()).filter(Boolean));
function asalSah(c: import('hono').Context) {
  const situs = c.req.header('sec-fetch-site');
  if (situs && situs !== 'same-origin' && situs !== 'none') return false;
  const asal = c.req.header('origin');
  if (!asal) return true; // bukan dari browser lintas situs (browser selalu mengirim Origin untuk POST lintas situs)
  let host: string;
  try { host = new URL(asal).host.toLowerCase(); } catch { return false; }
  return host === (c.req.header('host') ?? '').toLowerCase() || host === (c.req.header('x-forwarded-host') ?? '').toLowerCase() || ALAMAT_SAH.has(host);
}
app.use('/api/*', async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !asalSah(c)) {
    return c.json({ pesan: 'Permintaan ditolak: asal halaman tidak dikenal. Buka aplikasi dari alamat resminya lalu coba lagi.' }, 403);
  }
  await next();
});

app.get('/api/sehat', (c) => c.json({ ok: true }));

/* ---------- Pembatas laju (anti tebak sandi / anti bot) ---------- */
const gagalPerAkun = buatPembatas(5, 5 * 60e3);   // 5 salah per akun / 5 menit
const gagalPerIp = buatPembatas(20, 15 * 60e3);   // 20 salah per IP / 15 menit
const daftarPerIp = buatPembatas(5, 60 * 60e3);   // 5 pendaftaran per IP / jam
const cekUndanganPerIp = buatPembatas(30, 15 * 60e3); // 30 pemeriksaan tautan undangan per IP / 15 menit
const PESAN_TERLALU_BANYAK = 'Terlalu banyak percobaan. Silakan tunggu beberapa menit lalu coba lagi.';
const PESAN_CAPTCHA = 'Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi.';

/* ---------- Login ---------- */
const jumlahPengguna = () => (db.prepare('SELECT COUNT(*) n FROM pengguna').get() as { n: number }).n;
/** Bila diisi di Railway, pendaftar PERTAMA (calon admin) wajib memasukkan kode ini. */
const SETUP_TOKEN = (process.env.SETUP_TOKEN ?? '').trim();
const samaPersis = (a: string, b: string) => {
  const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
};
const teks = (v: unknown) => (typeof v === 'string' ? v.trim() : null);

app.get('/api/auth/saya', (c) => {
  const perluSetup = jumlahPengguna() === 0;
  return c.json({
    pengguna: penggunaDariSesi(c), perluSetup,
    perluKodeSetup: perluSetup && Boolean(SETUP_TOKEN),
    pendaftaranTerbuka: ambilPengaturan().pendaftaran_terbuka,
    turnstile: turnstileAktif() ? KUNCI_SITUS : null,
  });
});

type Undangan = { id: number; peran: string; untuk: string | null };
const cariUndangan = (token: unknown) => (typeof token === 'string' && token.length >= 20 && token.length <= 100
  ? db.prepare("SELECT id, peran, untuk FROM undangan WHERE hash_token = ? AND dipakai IS NULL AND kedaluwarsa > datetime('now','localtime')").get(hashToken(token)) as Undangan | undefined
  : undefined);

/** Memeriksa tautan undangan (dipakai halaman daftar untuk menampilkan "Anda diundang sebagai …"). */
app.get('/api/auth/undangan/:token', (c) => {
  const ip = ipKlien(c);
  if (cekUndanganPerIp.penuh(ip)) throw new GagalError(PESAN_TERLALU_BANYAK, 429);
  const u = cariUndangan(c.req.param('token'));
  if (!u) cekUndanganPerIp.tambah(ip);
  return c.json(u ? { sah: true, peran: u.peran, untuk: u.untuk } : { sah: false });
});

/**
 * Pendaftaran akun.
 * - Jika belum ada pengguna sama sekali: pendaftar pertama otomatis menjadi ADMIN dan langsung masuk
 *   (bila SETUP_TOKEN diisi, wajib memasukkan kode tersebut).
 * - Selanjutnya (bawaan): HANYA lewat tautan undangan dari admin → akun langsung aktif dengan peran dari undangan.
 * - Bila admin membuka pendaftaran umum (Pengaturan → Pengguna): tanpa undangan pun bisa mendaftar,
 *   tetapi akun berstatus "menunggu" sampai disetujui admin.
 */
app.post('/api/auth/daftar', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ip = ipKlien(c);
  if (daftarPerIp.penuh(ip)) throw new GagalError(PESAN_TERLALU_BANYAK, 429);
  if (!(await cekTurnstile(body.turnstile, ip, 'daftar'))) throw new GagalError(PESAN_CAPTCHA, 403);
  const nama = teks(body.nama), username = teks(body.username), sandi = typeof body.sandi === 'string' ? body.sandi : null;
  if (!nama || !username || !sandi) throw new GagalError('Semua isian wajib diisi.');
  if (nama.length > 100) throw new GagalError('Nama maksimal 100 karakter.');
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) throw new GagalError('Username 3–30 karakter, hanya huruf, angka, titik, garis bawah, atau strip.');
  const pertama = jumlahPengguna() === 0;
  const undangan = pertama ? undefined : cariUndangan(body.undangan);
  cekSandiBaru(sandi, username, pertama ? 'admin' : undangan?.peran ?? 'operator');
  if (!pertama && !undangan) {
    if (body.undangan) { daftarPerIp.tambah(ip); throw new GagalError('Tautan undangan tidak berlaku (sudah dipakai, dibatalkan, atau lewat 72 jam). Minta tautan baru kepada admin.', 403); }
    if (!ambilPengaturan().pendaftaran_terbuka) throw new GagalError('Pendaftaran hanya bisa lewat tautan undangan dari admin.', 403);
  }
  if (pertama && SETUP_TOKEN && !samaPersis(String(body.kode_setup ?? '').trim(), SETUP_TOKEN)) {
    daftarPerIp.tambah(ip);
    throw new GagalError('Kode setup salah. Tanyakan kode setup kepada pengelola server.', 403);
  }
  const hash = await hashSandi(sandi);
  daftarPerIp.tambah(ip);
  let id = 0;
  try {
    transaksi(() => {
      const peran = pertama ? 'admin' : undangan ? undangan.peran : 'operator';
      const r = db.prepare('INSERT INTO pengguna (username, nama, password_hash, peran, status) VALUES (?, ?, ?, ?, ?)').run(
        username, nama, hash, peran, pertama || undangan ? 'aktif' : 'menunggu');
      id = Number(r.lastInsertRowid);
      if (undangan) {
        // tandai terpakai; bila undangan sudah dipakai orang lain di saat bersamaan → batalkan
        const t = db.prepare("UPDATE undangan SET dipakai = datetime('now','localtime'), dipakai_oleh = ? WHERE id = ? AND dipakai IS NULL").run(username, undangan.id);
        if (!t.changes) throw new Error('undangan terpakai');
      }
      if (pertama) catat(nama, 'Membuat akun admin pertama', username);
      else if (undangan) catat(nama, 'Mendaftar lewat undangan', `${username} (${peran})`);
      else catat(nama, 'Mendaftar akun (menunggu persetujuan)', username);
    });
  } catch {
    throw new GagalError('Username sudah dipakai. Pilih username lain.');
  }
  if (pertama || undangan) {
    buatSesi(c, id);
    return c.json({ ok: true, masuk: true });
  }
  return c.json({ ok: true, masuk: false });
});

/** Catatan setiap percobaan masuk (berhasil maupun gagal) — dilihat admin di Pengaturan → Keamanan. */
function catatMasuk(c: import('hono').Context, username: string, hasil: string) {
  db.prepare('INSERT INTO log_masuk (username, ip, user_agent, hasil) VALUES (?, ?, ?, ?)')
    .run(username.slice(0, 64) || '-', ipKlien(c), (c.req.header('user-agent') ?? '').slice(0, 300), hasil);
}

/* Tiket verifikasi 2 langkah: diberikan setelah sandi benar, berlaku 5 menit, ditandatangani server. */
const MASA_TIKET_MS = 5 * 60e3;
const ttdTiket = (isi: string) => crypto.createHmac('sha256', kunciRahasia()).update('tiket2fa:' + isi).digest('base64url');
const buatTiket = (id: number) => { const isi = Buffer.from(JSON.stringify({ id, exp: Date.now() + MASA_TIKET_MS })).toString('base64url'); return `${isi}.${ttdTiket(isi)}`; };
function bacaTiket(t: unknown): number | null {
  if (typeof t !== 'string' || t.length > 300) return null;
  const [isi, ttd] = t.split('.');
  if (!isi || !ttd || !samaPersis(ttdTiket(isi), ttd)) return null;
  try { const { id, exp } = JSON.parse(Buffer.from(isi, 'base64url').toString()); return typeof exp === 'number' && Date.now() < exp && Number.isInteger(id) ? id : null; } catch { return null; }
}

app.post('/api/auth/masuk', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ip = ipKlien(c);
  // username dinormalisasi sekali, dipakai untuk pembatas DAN pencarian akun
  const u = String(typeof body.username === 'string' ? body.username : '').trim().toLowerCase().slice(0, 64);
  const sandi = typeof body.sandi === 'string' ? body.sandi.slice(0, 256) : '';
  if (gagalPerAkun.penuh(u) || gagalPerIp.penuh(ip)) { catatMasuk(c, u, 'dikunci sementara'); throw new GagalError(PESAN_TERLALU_BANYAK, 429); }
  // CAPTCHA diperiksa sebelum database & hash sandi supaya bot tidak membebani server
  if (!(await cekTurnstile(body.turnstile, ip, 'masuk'))) {
    gagalPerIp.tambah(ip);
    catatMasuk(c, u, 'gagal pemeriksaan keamanan');
    throw new GagalError(PESAN_CAPTCHA, 403);
  }
  const akun = u ? db.prepare('SELECT id, nama, password_hash, status, totp_aktif FROM pengguna WHERE username = ? COLLATE NOCASE').get(u) as
    | { id: number; nama: string; password_hash: string; status: string; totp_aktif: number } | undefined : undefined;
  const benar = akun ? await cocokSandi(sandi, akun.password_hash) : await cocokSandiTiruan(sandi);
  if (!akun || !benar) {
    gagalPerAkun.tambah(u);
    gagalPerIp.tambah(ip);
    catatMasuk(c, u, akun ? 'sandi salah' : 'username tidak dikenal');
    throw new GagalError('Username atau kata sandi salah.', 401);
  }
  if (akun.status !== 'aktif') { catatMasuk(c, u, 'belum disetujui'); throw new GagalError('Akun Anda sudah terdaftar tetapi belum disetujui admin. Hubungi admin aplikasi.', 403); }
  if (akun.totp_aktif) {
    catatMasuk(c, u, 'sandi benar, menunggu kode 2 langkah');
    return c.json({ ok: true, perlu2fa: true, tiket: buatTiket(akun.id) });
  }
  gagalPerAkun.hapus(u);
  buatSesi(c, akun.id);
  catatMasuk(c, u, 'berhasil');
  return c.json({ ok: true });
});

/** Langkah kedua: kode 6 angka dari aplikasi autentikator. */
app.post('/api/auth/masuk-2fa', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ip = ipKlien(c);
  const id = bacaTiket(body.tiket);
  if (!id) throw new GagalError('Waktu memasukkan kode sudah habis. Silakan masuk ulang.', 401);
  const akun = db.prepare("SELECT id, username, totp_rahasia, totp_aktif FROM pengguna WHERE id = ? AND status = 'aktif'").get(id) as
    { id: number; username: string; totp_rahasia: string | null; totp_aktif: number } | undefined;
  if (!akun) throw new GagalError('Akun tidak ditemukan.', 401);
  const u = akun.username.toLowerCase();
  if (gagalPerAkun.penuh(u) || gagalPerIp.penuh(ip)) { catatMasuk(c, u, 'dikunci sementara'); throw new GagalError(PESAN_TERLALU_BANYAK, 429); }
  if (!akun.totp_aktif || !akun.totp_rahasia || !cekKodeTotp(akun.totp_rahasia, body.kode)) {
    gagalPerAkun.tambah(u); gagalPerIp.tambah(ip);
    catatMasuk(c, u, 'kode 2 langkah salah');
    throw new GagalError('Kode salah. Periksa 6 angka terbaru di aplikasi autentikator Anda.', 401);
  }
  gagalPerAkun.hapus(u);
  buatSesi(c, akun.id);
  catatMasuk(c, u, 'berhasil (2 langkah)');
  return c.json({ ok: true });
});

app.post('/api/auth/keluar', (c) => {
  const s = bacaSesi(c);
  if (s) cabutSesi(s.id); // hanya perangkat ini; "keluar dari semua perangkat" ada di menu Akun
  hapusSesi(c);
  return c.json({ ok: true });
});

/* ---------- Unduhan file (alamat sekali pakai berumur 15 menit) ---------- */
app.get('/api/unduh/:token/:nama?', (c) => {
  const u = ambilUnduhan(c.req.param('token'), penggunaDariSesi(c)?.id);
  if (!u) return c.html('<p style="font-family:sans-serif;padding:2rem">Tautan unduhan sudah kedaluwarsa. Silakan klik tombol unduh lagi di aplikasi.</p>', 410);
  return kirimFile(c, u.buf, u.nama, u.tipe);
});

/* ---------- API yang memerlukan login ---------- */
app.use('/api/*', wajibLogin);

/* ---------- Peran "pengamat": hanya melihat ---------- */
const BOLEH_UNTUK_PENGAMAT = ['/api/ganti-sandi', '/api/akun/'];
app.use('/api/*', async (c, next) => {
  const p = c.get('pengguna');
  if (p.peran === 'pengamat') {
    const ubah = !['GET', 'HEAD'].includes(c.req.method);
    if ((ubah && !BOLEH_UNTUK_PENGAMAT.some((x) => c.req.path.startsWith(x))) || /^\/api\/mitra\/\d+\/sensitif$/.test(c.req.path)) {
      return c.json({ pesan: 'Akun Anda hanya untuk melihat data (pengamat). Hubungi admin bila perlu mengubah data.' }, 403);
    }
  }
  await next();
});

/* ---------- Batas laju per pengguna untuk data massal (anti sedot data) ---------- */
const batasDaftarMitra = batasiPengguna('daftar mitra', 60, 60e3, 'Terlalu sering memuat daftar mitra.');
const batasEkspor = batasiPengguna('ekspor Excel', 10, 60 * 60e3, 'Batas ekspor Excel (10 kali per jam) tercapai.');
const batasDokumen = batasiPengguna('pembuatan SPK/BAST', 30, 60 * 60e3, 'Batas pembuatan SPK/BAST (30 kali per jam) tercapai.');
app.use('/api/*', async (c, next) => {
  const p = c.req.path, m = c.req.method;
  if (m === 'GET' && p === '/api/mitra') return batasDaftarMitra(c, next);
  const ekspor = m === 'GET' && (p === '/api/mitra-ekspor' || p === '/api/rekap/ekspor');
  const dokumen = m === 'POST' && (p === '/api/dokumen/spk' || p === '/api/dokumen/bast');
  if ((ekspor || dokumen) && !bolehEkspor(c.get('pengguna'))) return c.json({ pesan: PESAN_TANPA_IZIN_EKSPOR }, 403);
  if (ekspor) return batasEkspor(c, next);
  if (dokumen) return batasDokumen(c, next);
  return next();
});
app.route('/api', akun);
app.route('/api', data);
app.route('/api', laporan);
app.route('/api', dokumen);
app.route('/api', sistem);
app.all('/api/*', (c) => c.json({ pesan: 'Alamat API tidak ditemukan.' }, 404));

/* ---------- Tampilan web ---------- */
const DIST = path.resolve(import.meta.dirname, '../dist');
if (fs.existsSync(DIST)) {
  app.use('/assets/*', serveStatic({ root: path.relative(process.cwd(), DIST) }));
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), DIST) }));
  const indexHtml = () => fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  app.get('*', (c) => c.html(indexHtml()));
}

const PORT = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, () => {
  console.log(`Seemitra Lite berjalan di http://localhost:${PORT}  (data: ${DATA_DIR})`);
});

/* ---------- Pekerjaan berkala: cadangan harian (+ salinan ke penyimpanan luar), bersih-bersih sesi ---------- */
function tugasBerkala() {
  const nama = buatCadanganOtomatis();
  (nama ? unggahCadanganLuar(nama) : pastikanCadanganLuar()).catch((e) => console.error('[cadangan-luar] gagal:', e));
  try { bersihkanSesi(); } catch (e) { console.error(e); }
}
tugasBerkala();
setInterval(tugasBerkala, 6 * 3600e3);
