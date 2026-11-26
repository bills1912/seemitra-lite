/** LOGIN & SESI — kata sandi di-hash (scrypt), sesi disimpan di cookie bertanda tangan. */
import crypto from 'node:crypto';
import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { db, kunciRahasia } from './db.ts';

export type Pengguna = { id: number; username: string; nama: string; peran: 'admin' | 'operator' };
export type Env = { Variables: { pengguna: Pengguna } };

const COOKIE = 'seemitra_sesi';
const MASA_SESI_HARI = 30;

export function hashSandi(sandi: string): string {
  const garam = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(sandi, garam, 64).toString('hex');
  return `${garam}:${hash}`;
}
export function cocokSandi(sandi: string, simpanan: string): boolean {
  const [garam, hash] = simpanan.split(':');
  const uji = crypto.scryptSync(sandi, garam, 64);
  return crypto.timingSafeEqual(uji, Buffer.from(hash, 'hex'));
}

function tandaTangan(isi: string) {
  return crypto.createHmac('sha256', kunciRahasia()).update(isi).digest('base64url');
}
export function buatSesi(c: Context, id: number) {
  const isi = Buffer.from(JSON.stringify({ id, exp: Date.now() + MASA_SESI_HARI * 864e5 })).toString('base64url');
  setCookie(c, COOKIE, `${isi}.${tandaTangan(isi)}`, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MASA_SESI_HARI * 86400,
  });
}
export const hapusSesi = (c: Context) => deleteCookie(c, COOKIE, { path: '/' });

export function penggunaDariSesi(c: Context): Pengguna | null {
  const nilai = getCookie(c, COOKIE);
  if (!nilai) return null;
  const [isi, ttd] = nilai.split('.');
  if (!isi || !ttd || tandaTangan(isi) !== ttd) return null;
  try {
    const { id, exp } = JSON.parse(Buffer.from(isi, 'base64url').toString());
    if (Date.now() > exp) return null;
    return (db.prepare("SELECT id, username, nama, peran FROM pengguna WHERE id = ? AND status = 'aktif'").get(id) as Pengguna) ?? null;
  } catch {
    return null;
  }
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
