/**
 * KEBIJAKAN KATA SANDI
 * - Operator / pengamat: minimal 6 karakter. Admin: minimal 10 karakter.
 * - Tidak boleh sama dengan / memuat username.
 * - Tidak boleh termasuk kata sandi yang terlalu umum (daftar di server/data/sandi-umum.txt — boleh ditambah).
 */
import fs from 'node:fs';
import path from 'node:path';
import { GagalError } from './util.ts';

const SANDI_UMUM = new Set(
  fs.readFileSync(path.join(import.meta.dirname, 'data/sandi-umum.txt'), 'utf8')
    .split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter((s) => s && !s.startsWith('#')),
);

export const PANJANG_MIN = { admin: 10, lain: 6 };

/** Melempar galat ramah bila kata sandi baru tidak memenuhi kebijakan. */
export function cekSandiBaru(sandi: unknown, username: string, peran: string): string {
  if (typeof sandi !== 'string' || !sandi) throw new GagalError('Kata sandi wajib diisi.');
  const min = peran === 'admin' ? PANJANG_MIN.admin : PANJANG_MIN.lain;
  if (sandi.length < min) throw new GagalError(`Kata sandi minimal ${min} karakter${peran === 'admin' ? ' untuk admin' : ''}.`);
  if (sandi.length > 128) throw new GagalError('Kata sandi maksimal 128 karakter.');
  const kecil = sandi.toLowerCase(), u = username.trim().toLowerCase();
  if (u && (kecil === u || (u.length >= 4 && kecil.includes(u)))) throw new GagalError('Kata sandi tidak boleh sama dengan atau memuat username.');
  if (SANDI_UMUM.has(kecil)) throw new GagalError('Kata sandi ini terlalu umum dan mudah ditebak. Coba gabungan beberapa kata, mis. "kopi-pagi-gunungtua".');
  return sandi;
}
