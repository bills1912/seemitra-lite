/**
 * AKUN & KEAMANAN
 * - Sesi aktif (perangkat yang sedang masuk) milik sendiri; keluar dari semua perangkat lain
 * - Verifikasi 2 langkah (TOTP) — opsional, disarankan untuk admin
 * - Admin: melihat & mencabut sesi semua pengguna, melihat catatan masuk
 */
import { Hono } from 'hono';
import QRCode from 'qrcode';
import { db, catat } from '../db.ts';
import { bacaSesi, cabutSemuaSesi, cabutSesi, cocokSandi, wajibAdmin, BATAS_DIAM_JAM, MASA_SESI_JAM, type Env } from '../auth.ts';
import { alamatOtpauth, cekKodeTotp, rahasiaBaru } from '../totp.ts';
import { GagalError } from '../util.ts';

export const akun = new Hono<Env>();

type BarisSesi = { id: string; pengguna_id: number; nama?: string; username?: string; dibuat: number; terakhir_aktif: number; ip: string | null; user_agent: string | null };

/** Ringkasan perangkat dari user-agent, mis. "Chrome · Android" */
function perangkat(ua: string | null) {
  const u = ua ?? '';
  const peramban = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Peramban lain';
  const os = /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Windows/.test(u) ? 'Windows' : /Mac OS X/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'perangkat lain';
  return `${peramban} · ${os}`;
}
const SESI_BERLAKU = `s.dicabut IS NULL AND s.dibuat > ? AND s.terakhir_aktif > ?`;
const batasWaktu = () => [Date.now() - MASA_SESI_JAM * 3600e3, Date.now() - BATAS_DIAM_JAM * 3600e3];
const rapikan = (s: BarisSesi, idSaya?: string) => ({
  id: s.id, pengguna_id: s.pengguna_id, nama: s.nama, username: s.username, perangkat: perangkat(s.user_agent), ip: s.ip,
  masuk: new Date(s.dibuat).toISOString(), terakhir_aktif: new Date(s.terakhir_aktif).toISOString(), ini: s.id === idSaya,
});

/* ---------- Sesi milik sendiri ---------- */
akun.get('/akun/sesi', (c) => {
  const saya = bacaSesi(c)!;
  const rows = db.prepare(`SELECT * FROM sesi s WHERE s.pengguna_id = ? AND ${SESI_BERLAKU} ORDER BY s.terakhir_aktif DESC`).all(c.get('pengguna').id, ...batasWaktu()) as BarisSesi[];
  return c.json(rows.map((s) => rapikan(s, saya.id)));
});
akun.post('/akun/sesi/keluar-lain', (c) => {
  const saya = bacaSesi(c)!;
  cabutSemuaSesi(c.get('pengguna').id, saya.id);
  catat(c.get('pengguna').nama, 'Keluar dari semua perangkat lain');
  return c.json({ ok: true });
});
akun.delete('/akun/sesi/:id', (c) => {
  const id = c.req.param('id') ?? '';
  const s = db.prepare('SELECT pengguna_id FROM sesi WHERE id = ?').get(id) as { pengguna_id: number } | undefined;
  if (!s || s.pengguna_id !== c.get('pengguna').id) throw new GagalError('Sesi tidak ditemukan.', 404);
  cabutSesi(id);
  catat(c.get('pengguna').nama, 'Mengeluarkan satu perangkat');
  return c.json({ ok: true });
});

/* ---------- Verifikasi 2 langkah ---------- */
akun.post('/akun/2fa/mulai', async (c) => {
  const p = c.get('pengguna');
  if (p.totp_aktif) throw new GagalError('Verifikasi 2 langkah sudah aktif. Matikan dulu bila ingin mengganti HP.');
  const rahasia = rahasiaBaru();
  db.prepare('UPDATE pengguna SET totp_rahasia = ?, totp_aktif = 0 WHERE id = ?').run(rahasia, p.id);
  const url = alamatOtpauth(rahasia, p.username);
  return c.json({ rahasia, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) });
});
akun.post('/akun/2fa/aktifkan', async (c) => {
  const p = c.get('pengguna');
  const { kode } = await c.req.json();
  const r = db.prepare('SELECT totp_rahasia FROM pengguna WHERE id = ?').get(p.id) as { totp_rahasia: string | null };
  if (!r.totp_rahasia || !cekKodeTotp(r.totp_rahasia, kode)) throw new GagalError('Kode belum cocok. Pastikan jam HP tepat, lalu masukkan 6 angka terbaru.');
  db.prepare('UPDATE pengguna SET totp_aktif = 1 WHERE id = ?').run(p.id);
  cabutSemuaSesi(p.id, bacaSesi(c)!.id);
  catat(p.nama, 'Mengaktifkan verifikasi 2 langkah');
  return c.json({ ok: true });
});
akun.post('/akun/2fa/matikan', async (c) => {
  const p = c.get('pengguna');
  const { sandi } = await c.req.json();
  const r = db.prepare('SELECT password_hash FROM pengguna WHERE id = ?').get(p.id) as { password_hash: string };
  if (typeof sandi !== 'string' || !(await cocokSandi(sandi, r.password_hash))) throw new GagalError('Kata sandi salah.');
  db.prepare('UPDATE pengguna SET totp_aktif = 0, totp_rahasia = NULL WHERE id = ?').run(p.id);
  catat(p.nama, 'Mematikan verifikasi 2 langkah');
  return c.json({ ok: true });
});

/* ---------- Admin: semua sesi & catatan masuk ---------- */
akun.get('/keamanan/sesi', wajibAdmin, (c) => {
  const saya = bacaSesi(c)!;
  const rows = db.prepare(`SELECT s.*, p.nama, p.username FROM sesi s JOIN pengguna p ON p.id = s.pengguna_id WHERE ${SESI_BERLAKU} ORDER BY s.terakhir_aktif DESC`).all(...batasWaktu()) as BarisSesi[];
  return c.json(rows.map((s) => rapikan(s, saya.id)));
});
akun.delete('/keamanan/sesi/:id', wajibAdmin, (c) => {
  const id = c.req.param('id') ?? '';
  const s = db.prepare('SELECT p.nama FROM sesi s JOIN pengguna p ON p.id = s.pengguna_id WHERE s.id = ?').get(id) as { nama: string } | undefined;
  if (!s) throw new GagalError('Sesi tidak ditemukan.', 404);
  cabutSesi(id);
  catat(c.get('pengguna').nama, 'Mencabut sesi pengguna', s.nama);
  return c.json({ ok: true });
});
akun.get('/keamanan/log-masuk', wajibAdmin, (c) => c.json(db.prepare('SELECT * FROM log_masuk ORDER BY id DESC LIMIT 200').all()));
