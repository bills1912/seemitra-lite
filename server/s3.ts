/**
 * SALINAN CADANGAN KE PENYIMPANAN LUAR (S3-compatible, mis. Railway Bucket / Cloudflare R2 / AWS S3)
 * Aktif bila variabel berikut diisi:
 *   CADANGAN_S3_ENDPOINT  (mis. https://storage.railway.app)
 *   CADANGAN_S3_BUCKET, CADANGAN_S3_KEY, CADANGAN_S3_RAHASIA, CADANGAN_S3_REGION (bawaan "auto")
 *   CADANGAN_S3_GAYA = "virtual" (bucket di nama host, mis. Railway Bucket) atau "path" (bawaan)
 * Hanya cadangan TERENKRIPSI (.seemitra-backup) yang dikirim. 90 salinan terakhir disimpan.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_DIR } from './db.ts';
import { EKSTENSI_TERENKRIPSI } from './enkripsi.ts';

const E = (k: string) => (process.env[k] ?? '').trim();
const KONF = { endpoint: E('CADANGAN_S3_ENDPOINT').replace(/\/+$/, ''), bucket: E('CADANGAN_S3_BUCKET'), key: E('CADANGAN_S3_KEY'), rahasia: E('CADANGAN_S3_RAHASIA'), region: E('CADANGAN_S3_REGION') || 'auto', virtual: E('CADANGAN_S3_GAYA') === 'virtual' };
export const s3Aktif = () => Boolean(KONF.endpoint && KONF.bucket && KONF.key && KONF.rahasia);
const SIMPAN_MAKS = 90;
const AWALAN = 'seemitra-lite/';

const sha256 = (d: string | Buffer) => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k: Buffer | string, d: string) => crypto.createHmac('sha256', k).update(d).digest();
const kodeUri = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase());

/** Permintaan S3 bertanda tangan AWS Signature V4 (path-style). */
async function permintaan(metode: string, kunciObjek: string, query: Record<string, string> = {}, isi: Buffer = Buffer.alloc(0)) {
  const jalur = kunciObjek ? '/' + kunciObjek.split('/').map(kodeUri).join('/') : '';
  const dasar = new URL(KONF.endpoint);
  const url = KONF.virtual
    ? new URL(`${dasar.protocol}//${KONF.bucket}.${dasar.host}${jalur || '/'}`)
    : new URL(`${KONF.endpoint}/${KONF.bucket}${jalur}`);
  const waktu = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const tanggal = waktu.slice(0, 8);
  const hashIsi = sha256(isi);
  const qs = Object.keys(query).sort().map((k) => `${kodeUri(k)}=${kodeUri(query[k])}`).join('&');
  const kepala: Record<string, string> = { host: url.host, 'x-amz-content-sha256': hashIsi, 'x-amz-date': waktu };
  const namaKepala = Object.keys(kepala).sort();
  const kanonik = [metode, url.pathname, qs, ...namaKepala.map((k) => `${k}:${kepala[k]}`), '', namaKepala.join(';'), hashIsi].join('\n');
  const cakupan = `${tanggal}/${KONF.region}/s3/aws4_request`;
  const teksTtd = ['AWS4-HMAC-SHA256', waktu, cakupan, sha256(kanonik)].join('\n');
  const kTtd = hmac(hmac(hmac(hmac('AWS4' + KONF.rahasia, tanggal), KONF.region), 's3'), 'aws4_request');
  const ttd = crypto.createHmac('sha256', kTtd).update(teksTtd).digest('hex');
  const r = await fetch(`${url.origin}${url.pathname}${qs ? '?' + qs : ''}`, {
    method: metode, body: isi.length ? new Uint8Array(isi) : undefined, signal: AbortSignal.timeout(60e3),
    headers: { ...kepala, Authorization: `AWS4-HMAC-SHA256 Credential=${KONF.key}/${cakupan}, SignedHeaders=${namaKepala.join(';')}, Signature=${ttd}` },
  });
  if (!r.ok) throw new Error(`S3 ${metode} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

/** Mengirim satu file cadangan terenkripsi ke penyimpanan luar, lalu menghapus salinan lama (> 90). */
export async function unggahCadanganLuar(nama: string) {
  if (!s3Aktif() || !nama.endsWith(EKSTENSI_TERENKRIPSI)) return false;
  await permintaan('PUT', AWALAN + nama, {}, fs.readFileSync(path.join(BACKUP_DIR, nama)));
  const daftar = await daftarCadanganLuar();
  for (const k of daftar.slice(0, Math.max(0, daftar.length - SIMPAN_MAKS))) await permintaan('DELETE', k);
  console.log(`[cadangan-luar] ${nama} terkirim (${daftar.length} salinan di penyimpanan luar)`);
  return true;
}

export async function daftarCadanganLuar(): Promise<string[]> {
  if (!s3Aktif()) return [];
  const xml = await (await permintaan('GET', '', { 'list-type': '2', prefix: AWALAN })).text();
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]).sort();
}

/** Memastikan cadangan otomatis terbaru sudah ada di penyimpanan luar (mis. setelah server baru dinyalakan). */
export async function pastikanCadanganLuar() {
  if (!s3Aktif()) return;
  const terbaru = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('otomatis-') && f.endsWith(EKSTENSI_TERENKRIPSI)).sort().pop();
  if (!terbaru) return;
  const ada = await daftarCadanganLuar();
  if (!ada.includes(AWALAN + terbaru)) await unggahCadanganLuar(terbaru);
}
