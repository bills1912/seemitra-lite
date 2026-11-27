/**
 * PEMBATAS LAJU — membatasi berapa kali sesuatu boleh dilakukan dalam jangka waktu tertentu.
 * Dipakai untuk: tebak sandi, pendaftaran, dan pengambilan data massal (anti sedot data).
 * Data disimpan di memori server; hilang saat server dijalankan ulang (cukup untuk tujuan ini).
 */
import type { Context, Next } from 'hono';
import { catat } from './db.ts';
import type { Env } from './auth.ts';

export function buatPembatas(maks: number, jendelaMs: number, ukuranMaks = 20000) {
  const peta = new Map<string, { n: number; sampai: number; dicatat?: boolean }>();
  const ambil = (k: string) => {
    const e = peta.get(k);
    if (e && Date.now() > e.sampai) { peta.delete(k); return undefined; }
    return e;
  };
  setInterval(() => { const t = Date.now(); for (const [k, e] of peta) if (t > e.sampai) peta.delete(k); }, 5 * 60e3).unref();
  return {
    penuh: (k: string) => (ambil(k)?.n ?? 0) >= maks,
    tambah: (k: string) => {
      const e = ambil(k);
      if (e) { e.n++; return e; }
      if (peta.size >= ukuranMaks) peta.delete(peta.keys().next().value!); // buang yang paling lama
      const baru = { n: 1, sampai: Date.now() + jendelaMs };
      peta.set(k, baru);
      return baru;
    },
    hapus: (k: string) => peta.delete(k),
    /** sisa menit sampai batas dibuka kembali */
    sisaMenit: (k: string) => Math.max(1, Math.ceil(((ambil(k)?.sampai ?? Date.now()) - Date.now()) / 60e3)),
    ambil,
  };
}

/**
 * Batas laju per PENGGUNA untuk satu kelompok aksi (mis. "ekspor").
 * Bila terlampaui: balas 429 dan catat SEKALI di riwayat per jendela waktu.
 */
export function batasiPengguna(kelompok: string, maks: number, jendelaMs: number, pesan: string) {
  const p = buatPembatas(maks, jendelaMs);
  return async (c: Context<Env>, next: Next) => {
    const saya = c.get('pengguna');
    const k = String(saya?.id ?? 0);
    if (p.penuh(k)) {
      const e = p.ambil(k);
      if (e && !e.dicatat) { e.dicatat = true; catat(saya?.nama, 'Dibatasi: terlalu banyak permintaan', kelompok); }
      return c.json({ pesan: `${pesan} Coba lagi dalam ${p.sisaMenit(k)} menit.` }, 429);
    }
    p.tambah(k);
    await next();
  };
}
