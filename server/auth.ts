/** LOGIN & SESI — kata sandi di-hash (scrypt), sesi disimpan di cookie bertanda tangan. */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { db, kunciRahasia } from './db.ts';

export type Pengguna = { id: number; username: string; nama: string; peran: 'admin' | 'operator' };
export type Env = { Variables: { pengguna: Pengguna } };

const COOKIE = 'seemitra_sesi';
const MASA_SESI_HARI = 30;

/* ---------------- Kata sandi ----------------
 * scrypt dijalankan secara async agar server tetap melayani pengguna lain selama menghitung hash. */
const scrypt = promisify(crypto.scrypt) as (sandi: string, garam: string, panjang: number) => Promise<Buffer>;

export async function hashSandi(sandi: string): Promise<string> {
  const garam = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(sandi, garam, 64);
  return `${garam}:${hash.toString('hex')}`;
}
export async function cocokSandi(sandi: string, simpanan: string): Promise<boolean> {
  const [garam, hash] = String(simpanan).split(':');
  if (!garam || !hash) return false;
  const uji = await scrypt(sandi, garam, 64);
  const asli = Buffer.from(hash, 'hex');
  return asli.length === uji.length && crypto.timingSafeEqual(uji, asli);
}
/** Hash tiruan: dipakai bila username tidak ada, supaya lama respons tidak membocorkan username mana yang terdaftar. */
const HASH_TIRUAN = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
export const cocokSandiTiruan = (sandi: string) => cocokSandi(sandi, HASH_TIRUAN).then(() => false);

/* ---------------- Sesi ----------------
 * Isi cookie: { id, v, exp } + tanda tangan HMAC.
 * v = versi_sesi pengguna. Saat keluar / ganti sandi, versi_sesi dinaikkan sehingga semua cookie lama tidak berlaku. */
function tandaTangan(isi: string) {
  return crypto.createHmac('sha256', kunciRahasia()).update(isi).digest('base64url');
}
function samaPersis(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
export function buatSesi(c: Context, id: number) {
  const row = db.prepare('SELECT versi_sesi FROM pengguna WHERE id = ?').get(id) as { versi_sesi: number } | undefined;
  const isi = Buffer.from(JSON.stringify({ id, v: row?.versi_sesi ?? 0, exp: Date.now() + MASA_SESI_HARI * 864e5 })).toString('base64url');
  setCookie(c, COOKIE, `${isi}.${tandaTangan(isi)}`, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MASA_SESI_HARI * 86400,
  });
}
export const hapusSesi = (c: Context) => deleteCookie(c, COOKIE, { path: '/' });

/** Membatalkan SEMUA sesi pengguna ini di semua perangkat. */
export function cabutSemuaSesi(id: number) {
  db.prepare('UPDATE pengguna SET versi_sesi = versi_sesi + 1 WHERE id = ?').run(id);
}

/** Membaca cookie sesi; mengembalikan id pengguna bila tanda tangan sah, belum kedaluwarsa, dan versinya cocok. */
function bacaSesi(c: Context): { id: number } | null {
  const nilai = getCookie(c, COOKIE);
  if (!nilai || nilai.length > 1024) return null;
  const [isi, ttd] = nilai.split('.');
  if (!isi || !ttd || !samaPersis(tandaTangan(isi), ttd)) return null;
  try {
    const { id, v, exp } = JSON.parse(Buffer.from(isi, 'base64url').toString());
    if (typeof exp !== 'number' || typeof v !== 'number' || !Number.isInteger(id) || Date.now() > exp) return null;
    const row = db.prepare('SELECT versi_sesi FROM pengguna WHERE id = ?').get(id) as { versi_sesi: number } | undefined;
    if (!row || row.versi_sesi !== v) return null;
    return { id };
  } catch {
    return null;
  }
}

export function penggunaDariSesi(c: Context): Pengguna | null {
  const s = bacaSesi(c);
  if (!s) return null;
  return (db.prepare("SELECT id, username, nama, peran FROM pengguna WHERE id = ? AND status = 'aktif'").get(s.id) as Pengguna) ?? null;
}

export async function wajibLogin(c: Context<Env>, next: Next) {
  const p = penggunaDariSesi(c);
  if (!p) return c.json({ pesan: 'Sesi berakhir, silakan masuk kembali.' }, 401);
  c.set('pengguna', p);
  await next();
}
export async function wajibAdmin(c: Context<Env>, next: Next) {
  if (c.get('pengguna')?.peran !== 'admin') return c.json({ pesan: 'Hanya admin yang dapat melakukan ini.' }, 403);
  await next();
}
