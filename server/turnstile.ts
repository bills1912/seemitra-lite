/**
 * VERIFIKASI CAPTCHA (Cloudflare Turnstile) — aktif bila TURNSTILE_SITE_KEY dan TURNSTILE_SECRET_KEY diisi.
 * Kebanyakan pengguna tidak perlu mengklik apa pun; widget memeriksa secara otomatis.
 * Site key bersifat publik (dikirim ke browser), secret key hanya disimpan di server.
 */
import type { Context } from 'hono';

const RAHASIA = (process.env.TURNSTILE_SECRET_KEY ?? '').trim();
export const KUNCI_SITUS = (process.env.TURNSTILE_SITE_KEY ?? '').trim();
export const turnstileAktif = () => Boolean(RAHASIA && KUNCI_SITUS);

if (!turnstileAktif() && process.env.NODE_ENV === 'production') {
  console.warn('[turnstile] NONAKTIF — isi TURNSTILE_SITE_KEY dan TURNSTILE_SECRET_KEY di Railway → Variables.');
}

/**
 * IP klien.
 * - PERCAYA_CLOUDFLARE=1 (hanya bila aplikasi diakses lewat domain yang di-proxy Cloudflare): CF-Connecting-IP.
 * - Selain itu: X-Real-IP yang diisi oleh edge Railway (tidak bisa dipalsukan pengunjung),
 *   lalu alamat pertama X-Forwarded-For sebagai cadangan (mis. saat dijalankan di komputer sendiri).
 */
const PERCAYA_CLOUDFLARE = process.env.PERCAYA_CLOUDFLARE === '1';
export function ipKlien(c: Context): string {
  const ip = (PERCAYA_CLOUDFLARE && c.req.header('cf-connecting-ip'))
    || c.req.header('x-real-ip')
    || (c.req.header('x-forwarded-for') ?? '').split(',')[0];
  return (ip ?? '').trim().slice(0, 64) || 'lokal';
}

/** true bila token sah untuk aksi ini. Gagal menghubungi Cloudflare = ditolak (fail-closed). */
export async function cekTurnstile(token: unknown, ip: string, aksi: 'masuk' | 'daftar'): Promise<boolean> {
  if (!turnstileAktif()) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const isi = new URLSearchParams({ secret: RAHASIA, response: token });
  if (ip && ip !== 'lokal') isi.set('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: isi, signal: AbortSignal.timeout(5000),
    });
    const d = (await r.json()) as { success: boolean; action?: string; 'error-codes'?: string[] };
    if (!d.success) console.warn('[turnstile] ditolak:', d['error-codes']?.join(','));
    // kunci uji (dummy) Cloudflare tidak mengirim action yang sama, jadi action hanya dicek bila ada
    return d.success === true && (!d.action || d.action === aksi);
  } catch (e) {
    console.error('[turnstile] gagal menghubungi Cloudflare:', e);
    return false;
  }
}
