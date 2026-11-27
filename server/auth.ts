/** LOGIN & SESI — kata sandi di-hash (scrypt), sesi disimpan di cookie bertanda tangan. */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { db, kunciRahasia, konteksPengguna } from './db.ts';

export type Pengguna = { id: number; username: string; nama: string; peran: 'admin' | 'operator' | 'pengamat'; boleh_ekspor: number; totp_aktif: number };
export type Env = { Variables: { pengguna: Pengguna } };

const COOKIE = 'seemitra_sesi';

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
 * Setiap login membuat satu baris di tabel `sesi`. Cookie hanya berisi id sesi acak + tanda tangan HMAC.
 * - Berlaku paling lama 12 jam sejak masuk (batas mutlak), dan berakhir bila 2 jam tidak ada aktivitas.
 * - Sesi bisa dicabut kapan saja (keluar, ganti sandi, menu "Sesi aktif") → cookie langsung tidak berlaku. */
export const MASA_SESI_JAM = 12;
export const BATAS_DIAM_JAM = 2;
const MS_JAM = 3600e3;

function tandaTangan(isi: string) {
  return crypto.createHmac('sha256', kunciRahasia()).update(isi).digest('base64url');
}
function samaPersis(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const ipDari = (c: Context) => ((c.req.header('x-real-ip') || (c.req.header('x-forwarded-for') ?? '').split(',')[0]) ?? '').trim().slice(0, 64) || null;

export function buatSesi(c: Context, idPengguna: number) {
  const id = crypto.randomBytes(24).toString('base64url');
  const kini = Date.now();
  db.prepare('INSERT INTO sesi (id, pengguna_id, dibuat, terakhir_aktif, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, idPengguna, kini, kini, ipDari(c), (c.req.header('user-agent') ?? '').slice(0, 300) || null);
  setCookie(c, COOKIE, `${id}.${tandaTangan(id)}`, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MASA_SESI_JAM * 3600,
  });
}
export const hapusSesi = (c: Context) => deleteCookie(c, COOKIE, { path: '/' });

/** Mencabut satu sesi. */
export function cabutSesi(idSesi: string) {
  db.prepare('UPDATE sesi SET dicabut = ? WHERE id = ? AND dicabut IS NULL').run(Date.now(), idSesi);
}
/** Membatalkan SEMUA sesi pengguna ini di semua perangkat (kecuali sesi yang disebut, bila ada). */
export function cabutSemuaSesi(idPengguna: number, kecuali?: string) {
  db.prepare('UPDATE sesi SET dicabut = ? WHERE pengguna_id = ? AND dicabut IS NULL AND id <> ?').run(Date.now(), idPengguna, kecuali ?? '');
}

type BarisSesi = { id: string; pengguna_id: number; dibuat: number; terakhir_aktif: number; dicabut: number | null };
const tembolok = new WeakMap<Request, BarisSesi | null>();

/** Membaca cookie sesi; mengembalikan baris sesi bila sah, belum dicabut, dan belum lewat batas waktu. */
export function bacaSesi(c: Context): BarisSesi | null {
  if (tembolok.has(c.req.raw)) return tembolok.get(c.req.raw)!;
  let hasil: BarisSesi | null = null;
  const nilai = getCookie(c, COOKIE);
  if (nilai && nilai.length <= 256) {
    const [id, ttd] = nilai.split('.');
    if (id && ttd && samaPersis(tandaTangan(id), ttd)) {
      const s = db.prepare('SELECT id, pengguna_id, dibuat, terakhir_aktif, dicabut FROM sesi WHERE id = ?').get(id) as BarisSesi | undefined;
      const kini = Date.now();
      if (s && !s.dicabut && kini - s.dibuat < MASA_SESI_JAM * MS_JAM && kini - s.terakhir_aktif < BATAS_DIAM_JAM * MS_JAM) {
        // perbarui "terakhir aktif" paling sering sekali per menit
        if (kini - s.terakhir_aktif > 60e3) db.prepare('UPDATE sesi SET terakhir_aktif = ? WHERE id = ?').run(kini, s.id);
        hasil = s;
      }
    }
  }
  tembolok.set(c.req.raw, hasil);
  return hasil;
}

export function penggunaDariSesi(c: Context): Pengguna | null {
  const s = bacaSesi(c);
  if (!s) return null;
  return (db.prepare("SELECT id, username, nama, peran, boleh_ekspor, totp_aktif FROM pengguna WHERE id = ? AND status = 'aktif'").get(s.pengguna_id) as Pengguna) ?? null;
}

/** Membersihkan sesi lama dari database (dijalankan berkala). */
export function bersihkanSesi() {
  db.prepare('DELETE FROM sesi WHERE dibuat < ?').run(Date.now() - 30 * 864e5);
  db.prepare("DELETE FROM log_masuk WHERE waktu < datetime('now','localtime','-90 days')").run();
}

export async function wajibLogin(c: Context<Env>, next: Next) {
  const p = penggunaDariSesi(c);
  if (!p) return c.json({ pesan: 'Sesi berakhir, silakan masuk kembali.' }, 401);
  c.set('pengguna', p);
  await konteksPengguna.run({ id: p.id }, next); // agar catat() tahu id pengguna
}
export async function wajibAdmin(c: Context<Env>, next: Next) {
  if (c.get('pengguna')?.peran !== 'admin') return c.json({ pesan: 'Hanya admin yang dapat melakukan ini.' }, 403);
  await next();
}
/** Ekspor Excel & pembuatan SPK/BAST: admin selalu boleh; operator bila diizinkan admin; pengamat tidak. */
export const bolehEkspor = (p?: Pengguna) => p?.peran === 'admin' || (p?.peran === 'operator' && Boolean(p.boleh_ekspor));
export const PESAN_TANPA_IZIN_EKSPOR = 'Akun Anda tidak diizinkan mengekspor data atau membuat dokumen. Hubungi admin.';
