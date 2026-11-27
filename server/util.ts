/** Fungsi bantu: format rupiah, tanggal Indonesia, dan angka terbilang. */

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

export function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilang(n - 10) + ' belas';
  if (n < 100) return (terbilang(Math.floor(n / 10)) + ' puluh ' + terbilang(n % 10)).trim();
  if (n < 200) return ('seratus ' + terbilang(n - 100)).trim();
  if (n < 1000) return (terbilang(Math.floor(n / 100)) + ' ratus ' + terbilang(n % 100)).trim();
  if (n < 2000) return ('seribu ' + terbilang(n - 1000)).trim();
  if (n < 1e6) return (terbilang(Math.floor(n / 1000)) + ' ribu ' + terbilang(n % 1000)).trim();
  if (n < 1e9) return (terbilang(Math.floor(n / 1e6)) + ' juta ' + terbilang(n % 1e6)).trim();
  if (n < 1e12) return (terbilang(Math.floor(n / 1e9)) + ' miliar ' + terbilang(n % 1e9)).trim();
  return (terbilang(Math.floor(n / 1e12)) + ' triliun ' + terbilang(n % 1e12)).trim();
}

export const rupiah = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID') + ',-';
export const angka = (n: number) => (Number.isInteger(n) ? n.toLocaleString('id-ID') : n.toLocaleString('id-ID', { maximumFractionDigits: 2 }));

export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** "2026-03-05" -> Date (tanpa pergeseran zona waktu) */
export function keTanggal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
export const hari = (iso: string) => HARI[keTanggal(iso).getUTCDay()];
export const namaBulan = (iso: string) => BULAN[keTanggal(iso).getUTCMonth()];
export function tanggalPanjang(iso: string): string {
  const t = keTanggal(iso);
  return `${t.getUTCDate()} ${BULAN[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}
export function akhirBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number);
  const t = new Date(Date.UTC(y, m, 0));
  return t.toISOString().slice(0, 10);
}
export function geserBulan(bulan: string, n: number): string {
  const [y, m] = bulan.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
export const labelBulan = (bulan: string) => {
  const [y, m] = bulan.split('-').map(Number);
  return `${BULAN[m - 1]} ${y}`;
};

/** Mengisi format nomor, mis. "{urut}/PPK/SPK/{bulan}/{tahun}" */
export function isiNomor(format: string, urut: number, bulan: string): string {
  const [y, m] = bulan.split('-');
  return format
    .replaceAll('{urut}', String(urut))
    .replaceAll('{urut3}', String(urut).padStart(3, '0'))
    .replaceAll('{bulan}', String(Number(m)))
    .replaceAll('{bulan2}', m)
    .replaceAll('{romawi}', ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][Number(m) - 1])
    .replaceAll('{tahun}', y);
}

export class GagalError extends Error {
  status: number;
  constructor(pesan: string, status = 400) {
    super(pesan);
    this.status = status;
  }
}

/**
 * Menyamarkan data sensitif (NIK, nomor rekening) untuk tampilan: 1278••••••••0012.
 * Nilai penuh hanya bisa dilihat lewat tombol "Tampilkan" (tercatat di riwayat) dan dipakai utuh di SPK/BAST.
 */
export function samarkan(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace(/\s+/g, '');
  if (s.length <= 4) return '••••';
  if (s.length < 12) return '•'.repeat(s.length - 4) + s.slice(-4);
  return s.slice(0, 4) + '•'.repeat(s.length - 8) + s.slice(-4);
}
/** true bila nilai berasal dari tampilan tersamar (jangan disimpan menimpa nilai asli) */
export const tersamar = (v: unknown) => typeof v === 'string' && v.includes('•');
