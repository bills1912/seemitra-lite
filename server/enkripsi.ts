/**
 * ENKRIPSI FILE CADANGAN (AES-256-GCM)
 * - Cadangan yang DIUNDUH dikunci dengan kata sandi yang diketik admin saat mengunduh (kunci diturunkan dengan scrypt + garam acak).
 * - Cadangan OTOMATIS di server dikunci dengan BACKUP_KEY (variabel lingkungan, 64 karakter hex).
 * Tanpa kata sandi / kunci yang benar, isi file tidak bisa dibaca sama sekali.
 */
import crypto from 'node:crypto';

export const FORMAT_TERENKRIPSI = 'seemitra-terenkripsi-1';
export const EKSTENSI_TERENKRIPSI = '.seemitra-backup';

export type FileTerenkripsi = {
  aplikasi: 'seemitra-lite'; format: typeof FORMAT_TERENKRIPSI;
  kdf: 'scrypt' | 'kunci-server'; garam: string; iv: string; tag: string; data: string;
};

/** Kunci server untuk cadangan otomatis (null bila BACKUP_KEY belum diisi) */
const KUNCI_SERVER = (() => {
  const k = (process.env.BACKUP_KEY ?? '').trim();
  if (!k) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(k)) throw new Error('BACKUP_KEY harus 64 karakter hex (buat dengan: openssl rand -hex 32).');
  return Buffer.from(k, 'hex');
})();
export const adaKunciServer = () => KUNCI_SERVER !== null;
if (!KUNCI_SERVER && process.env.NODE_ENV === 'production') {
  console.warn('[keamanan] BACKUP_KEY belum diisi — cadangan otomatis disimpan TANPA enkripsi.');
}

const kunciDariSandi = (sandi: string, garam: Buffer) => crypto.scryptSync(sandi, garam, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

function kunci(isi: Buffer, k: Buffer, kdf: FileTerenkripsi['kdf'], garam: Buffer): FileTerenkripsi {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([c.update(isi), c.final()]);
  return { aplikasi: 'seemitra-lite', format: FORMAT_TERENKRIPSI, kdf, garam: garam.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function kunciDenganSandi(isi: Buffer, sandi: string): FileTerenkripsi {
  const garam = crypto.randomBytes(16);
  return kunci(isi, kunciDariSandi(sandi, garam), 'scrypt', garam);
}
export function kunciDenganKunciServer(isi: Buffer): FileTerenkripsi {
  if (!KUNCI_SERVER) throw new Error('BACKUP_KEY belum diisi.');
  return kunci(isi, KUNCI_SERVER, 'kunci-server', Buffer.alloc(0));
}

export const terenkripsi = (v: unknown): v is FileTerenkripsi =>
  !!v && typeof v === 'object' && (v as FileTerenkripsi).format === FORMAT_TERENKRIPSI;

/** Membuka file terenkripsi. Melempar galat dengan pesan ramah bila sandi salah / file rusak. */
export function bukaKunci(f: FileTerenkripsi, sandi?: string): Buffer {
  let k: Buffer;
  if (f.kdf === 'kunci-server') {
    if (!KUNCI_SERVER) throw new Error('Cadangan ini dikunci dengan BACKUP_KEY server, tetapi BACKUP_KEY belum diisi.');
    k = KUNCI_SERVER;
  } else {
    if (!sandi) throw new Error('Cadangan ini terkunci. Masukkan kata sandi cadangan.');
    k = kunciDariSandi(sandi, Buffer.from(f.garam, 'base64'));
  }
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(f.iv, 'base64'));
    d.setAuthTag(Buffer.from(f.tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(f.data, 'base64')), d.final()]);
  } catch {
    throw new Error(f.kdf === 'kunci-server' ? 'Cadangan tidak bisa dibuka dengan BACKUP_KEY saat ini.' : 'Kata sandi cadangan salah, atau file rusak.');
  }
}
