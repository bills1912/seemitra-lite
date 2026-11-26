export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const rupiah = (n: number | null | undefined) => 'Rp' + Math.round(n ?? 0).toLocaleString('id-ID');
export const rupiahRingkas = (n: number) => {
  if (n >= 1e9) return 'Rp' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M';
  if (n >= 1e6) return 'Rp' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
  if (n >= 1e3) return 'Rp' + (n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' rb';
  return rupiah(n);
};
export const angka = (n: number | null | undefined) => (n ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

const tgl = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
};
export const tanggal = (iso?: string | null) => {
  if (!iso) return '-';
  const { y, m, d } = tgl(iso);
  return `${d} ${BULAN_PENDEK[m - 1]} ${y}`;
};
export const rentang = (a: string, b: string) => {
  const x = tgl(a), y = tgl(b);
  if (x.y === y.y && x.m === y.m) return `${x.d}–${y.d} ${BULAN_PENDEK[y.m - 1]} ${y.y}`;
  if (x.y === y.y) return `${x.d} ${BULAN_PENDEK[x.m - 1]} – ${y.d} ${BULAN_PENDEK[y.m - 1]} ${y.y}`;
  return `${tanggal(a)} – ${tanggal(b)}`;
};
export const labelBulan = (b?: string | null) => {
  if (!b) return '-';
  const [y, m] = b.split('-').map(Number);
  return `${BULAN[m - 1]} ${y}`;
};

/** Tanggal hari ini (WIB) dalam format YYYY-MM-DD */
export const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const bulanIni = () => hariIni().slice(0, 7);
export const geserBulan = (b: string, n: number) => {
  const [y, m] = b.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
export const akhirBulan = (b: string) => {
  const [y, m] = b.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
export const tambahHari = (iso: string, n: number) => {
  const { y, m, d } = tgl(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export type StatusKegiatan = 'akan' | 'berjalan' | 'selesai';
export const statusKegiatan = (k: { tanggal_mulai: string; tanggal_selesai: string }): StatusKegiatan => {
  const h = hariIni();
  if (h < k.tanggal_mulai) return 'akan';
  if (h > k.tanggal_selesai) return 'selesai';
  return 'berjalan';
};
export const LABEL_STATUS: Record<StatusKegiatan, string> = { akan: 'Akan datang', berjalan: 'Berjalan', selesai: 'Selesai' };

export const sapaan = () => {
  const j = new Date().getHours();
  if (j < 11) return 'Selamat pagi';
  if (j < 15) return 'Selamat siang';
  if (j < 18) return 'Selamat sore';
  return 'Selamat malam';
};

export const inisial = (nama: string) =>
  nama.replace(/[^A-Za-z\s]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('') || '?';

const WARNA_AVATAR = ['bg-teal-100 text-teal-800', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-800', 'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800', 'bg-lime-100 text-lime-800', 'bg-orange-100 text-orange-800'];
export const warnaAvatar = (nama: string) => WARNA_AVATAR[[...nama].reduce((s, c) => s + c.charCodeAt(0), 0) % WARNA_AVATAR.length];

export const cocok = (teks: string, q: string) => teks.toLowerCase().includes(q.trim().toLowerCase());
