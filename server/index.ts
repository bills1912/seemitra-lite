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
import { data } from './routes/data.ts';
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

app.post('/api/auth/setup', async (c) => {
  if (jumlahPengguna() > 0) throw new GagalError('Aplikasi sudah memiliki admin.');
  const { nama, username, sandi } = await c.req.json();
  if (!nama || !username || !sandi) throw new GagalError('Semua isian wajib diisi.');
  if (String(sandi).length < 6) throw new GagalError('Kata sandi minimal 6 karakter.');
  const r = db.prepare("INSERT INTO pengguna (username, nama, password_hash, peran) VALUES (?, ?, ?, 'admin')").run(
    String(username).trim(), String(nama).trim(), hashSandi(sandi));
  buatSesi(c, Number(r.lastInsertRowid));
  catat(nama, 'Membuat akun admin pertama');
  return c.json({ ok: true });
});

const percobaan = new Map<string, { n: number; sampai: number }>();
app.post('/api/auth/masuk', async (c) => {
  const { username, sandi } = await c.req.json();
  const kunci = String(username).toLowerCase();
  const p = percobaan.get(kunci);
  if (p && p.n >= 5 && Date.now() < p.sampai) throw new GagalError('Terlalu banyak percobaan. Coba lagi dalam beberapa menit.', 429);
  const u = db.prepare('SELECT * FROM pengguna WHERE username = ?').get(String(username ?? '').trim()) as
    | { id: number; nama: string; password_hash: string } | undefined;
  if (!u || !cocokSandi(String(sandi ?? ''), u.password_hash)) {
    percobaan.set(kunci, { n: (p?.n ?? 0) + 1, sampai: Date.now() + 5 * 60e3 });
    throw new GagalError('Username atau kata sandi salah.', 401);
  }
  percobaan.delete(kunci);
  buatSesi(c, u.id);
  return c.json({ ok: true });
});
app.post('/api/auth/keluar', (c) => {
  hapusSesi(c);
  return c.json({ ok: true });
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
