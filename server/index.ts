/**
 * SEEMITRA LITE — SERVER
 * Menjalankan API (/api/...) dan menyajikan tampilan web (folder dist/).
 * Jalankan: npm start   (lihat PANDUAN.md untuk penjelasan lengkap)
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import { db, buatCadanganOtomatis, catat, DATA_DIR } from './db.ts';
import { buatSesi, cocokSandi, hapusSesi, hashSandi, penggunaDariSesi, wajibLogin, type Env } from './auth.ts';
import { GagalError } from './util.ts';
import { data, ambilUnduhan, kirimFile } from './routes/data.ts';
import { laporan } from './routes/laporan.ts';
import { dokumen } from './routes/dokumen.ts';
import { sistem } from './routes/sistem.ts';

const app = new Hono<Env>();

app.onError((err, c) => {
  if (err instanceof GagalError) return c.json({ pesan: err.message }, err.status as 400);
  console.error(err);
  return c.json({ pesan: 'Terjadi kesalahan pada server: ' + err.message }, 500);
});

app.get('/api/sehat', (c) => c.json({ ok: true }));

/* ---------- Login ---------- */
const jumlahPengguna = () => (db.prepare('SELECT COUNT(*) n FROM pengguna').get() as { n: number }).n;

app.get('/api/auth/saya', (c) => c.json({ pengguna: penggunaDariSesi(c), perluSetup: jumlahPengguna() === 0 }));

/**
 * Pendaftaran akun.
 * - Jika belum ada pengguna sama sekali: pendaftar pertama otomatis menjadi ADMIN dan langsung masuk.
 * - Selanjutnya: akun dibuat sebagai operator berstatus "menunggu" sampai disetujui admin
 *   (Pengaturan → Pengguna). Ini mencegah orang asing melihat data mitra.
 */
app.post('/api/auth/daftar', async (c) => {
  const { nama, username, sandi } = await c.req.json();
  if (!nama || !username || !sandi) throw new GagalError('Semua isian wajib diisi.');
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(String(username).trim())) throw new GagalError('Username 3–30 karakter, hanya huruf, angka, titik, garis bawah, atau strip.');
  if (String(sandi).length < 6) throw new GagalError('Kata sandi minimal 6 karakter.');
  const pertama = jumlahPengguna() === 0;
  let id: number;
  try {
    const r = db.prepare('INSERT INTO pengguna (username, nama, password_hash, peran, status) VALUES (?, ?, ?, ?, ?)').run(
      String(username).trim(), String(nama).trim(), hashSandi(sandi), pertama ? 'admin' : 'operator', pertama ? 'aktif' : 'menunggu');
    id = Number(r.lastInsertRowid);
  } catch {
    throw new GagalError('Username sudah dipakai. Pilih username lain.');
  }
  if (pertama) {
    buatSesi(c, id);
    catat(nama, 'Membuat akun admin pertama');
    return c.json({ ok: true, masuk: true });
  }
  catat(nama, 'Mendaftar akun (menunggu persetujuan)', username);
  return c.json({ ok: true, masuk: false });
});

const percobaan = new Map<string, { n: number; sampai: number }>();
app.post('/api/auth/masuk', async (c) => {
  const { username, sandi } = await c.req.json();
  const kunci = String(username).toLowerCase();
  const p = percobaan.get(kunci);
  if (p && p.n >= 5 && Date.now() < p.sampai) throw new GagalError('Terlalu banyak percobaan. Coba lagi dalam beberapa menit.', 429);
  const u = db.prepare('SELECT * FROM pengguna WHERE username = ?').get(String(username ?? '').trim()) as
    | { id: number; nama: string; password_hash: string; status: string } | undefined;
  if (!u || !cocokSandi(String(sandi ?? ''), u.password_hash)) {
    percobaan.set(kunci, { n: (p?.n ?? 0) + 1, sampai: Date.now() + 5 * 60e3 });
    throw new GagalError('Username atau kata sandi salah.', 401);
  }
  percobaan.delete(kunci);
  if (u.status !== 'aktif') throw new GagalError('Akun Anda sudah terdaftar tetapi belum disetujui admin. Hubungi admin aplikasi.', 403);
  buatSesi(c, u.id);
  return c.json({ ok: true });
});
app.post('/api/auth/keluar', (c) => {
  hapusSesi(c);
  return c.json({ ok: true });
});

/* ---------- Unduhan file (alamat sekali pakai berumur 15 menit) ---------- */
app.get('/api/unduh/:token/:nama?', (c) => {
  const u = ambilUnduhan(c.req.param('token'));
  if (!u) return c.html('<p style="font-family:sans-serif;padding:2rem">Tautan unduhan sudah kedaluwarsa. Silakan klik tombol unduh lagi di aplikasi.</p>', 410);
  return kirimFile(c, u.buf, u.nama, u.tipe);
});

/* ---------- API yang memerlukan login ---------- */
app.use('/api/*', wajibLogin);
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

buatCadanganOtomatis();
setInterval(buatCadanganOtomatis, 6 * 3600e3);
