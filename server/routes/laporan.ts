/** BERANDA & REKAP HONOR BULANAN */
import { Hono } from 'hono';
import { db } from '../db.ts';
import type { Env } from '../auth.ts';
import { mitraLewatSbml, sbmlBulan, unduh } from './data.ts';
import { ambilPengaturan } from '../db.ts';
import { buatExcel } from '../excel.ts';
import { labelBulan } from '../util.ts';

export const laporan = new Hono<Env>();

const hariIni = () => {
  const d = new Date(Date.now() + 7 * 3600e3); // WIB
  return d.toISOString().slice(0, 10);
};
const geserBulan = (bulan: string, n: number) => {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

type BarisRekap = {
  mitra_id: number; nama: string; sobat_id: string | null; kecamatan: string | null; desa: string | null;
  bank: string | null; no_rekening: string | null; total: number;
  tugas: { kegiatan_id: number; kegiatan: string; peran: string; volume: number; satuan: string; tarif: number; honor: number; bulan_kegiatan: string; bulan_honor: string }[];
};

/**
 * Rekap honor per mitra untuk satu bulan.
 * dasar = 'kegiatan' (bawaan; bulan pelaksanaan → SBML, SPK, BAST) atau 'bayar' (bulan pembayaran honor).
 */
export function rekapBulan(bulan: string, dasar: 'kegiatan' | 'bayar' = 'kegiatan'): BarisRekap[] {
  const kolom = dasar === 'bayar' ? 'k.bulan_honor' : 'k.bulan_kegiatan';
  const rows = db
    .prepare(
      `SELECT m.id AS mitra_id, m.nama, m.sobat_id, m.kecamatan, m.desa, m.bank, m.no_rekening,
              k.id AS kegiatan_id, k.nama AS kegiatan, k.satuan, k.bulan_kegiatan, k.bulan_honor, p.peran, p.volume, p.tarif, (p.volume*p.tarif) AS honor
       FROM penugasan p JOIN kegiatan k ON k.id = p.kegiatan_id JOIN mitra m ON m.id = p.mitra_id
       WHERE k.dihapus IS NULL AND m.dihapus IS NULL AND ${kolom} = ?
       ORDER BY m.nama COLLATE NOCASE, k.tanggal_mulai`,
    )
    .all(bulan) as Record<string, never>[];
  const peta = new Map<number, BarisRekap>();
  for (const r of rows) {
    let b = peta.get(r.mitra_id);
    if (!b) {
      b = { mitra_id: r.mitra_id, nama: r.nama, sobat_id: r.sobat_id, kecamatan: r.kecamatan, desa: r.desa, bank: r.bank, no_rekening: r.no_rekening, total: 0, tugas: [] };
      peta.set(r.mitra_id, b);
    }
    b.tugas.push({ kegiatan_id: r.kegiatan_id, kegiatan: r.kegiatan, peran: r.peran, volume: r.volume, satuan: r.satuan, tarif: r.tarif, honor: r.honor, bulan_kegiatan: r.bulan_kegiatan, bulan_honor: r.bulan_honor });
    b.total += r.honor;
  }
  return [...peta.values()];
}

const dasarDari = (v?: string) => (v === 'bayar' ? 'bayar' : 'kegiatan') as 'kegiatan' | 'bayar';

laporan.get('/rekap', (c) => {
  const bulan = c.req.query('bulan') ?? hariIni().slice(0, 7);
  const dasar = dasarDari(c.req.query('dasar'));
  const kegiatan = db
    .prepare(
      `SELECT k.id, k.nama, k.satuan, k.bulan_kegiatan, k.bulan_honor, COUNT(DISTINCT p.mitra_id) AS petugas, COALESCE(SUM(p.volume*p.tarif),0) AS total
       FROM kegiatan k LEFT JOIN penugasan p ON p.kegiatan_id = k.id
       WHERE k.dihapus IS NULL AND ${dasar === 'bayar' ? 'k.bulan_honor' : 'k.bulan_kegiatan'} = ? GROUP BY k.id ORDER BY k.tanggal_mulai`,
    )
    .all(bulan);
  return c.json({ bulan, dasar, baris: rekapBulan(bulan, dasar), kegiatan, sbml: sbmlBulan(bulan), ambang: ambilPengaturan().ambang_sbml });
});

laporan.get('/rekap/ekspor', async (c) => {
  const bulan = c.req.query('bulan') ?? hariIni().slice(0, 7);
  const dasar = dasarDari(c.req.query('dasar'));
  const batas = sbmlBulan(bulan);
  const adaBatas = Object.keys(batas).length > 0;
  const baris = rekapBulan(bulan, dasar).map((b, i) => {
    const per: Record<string, number> = {};
    for (const t of b.tugas) per[t.peran] = (per[t.peran] ?? 0) + t.honor;
    const lewat = Object.entries(per).filter(([p, v]) => batas[p] && v > batas[p]).map(([p]) => p);
    return {
      no: i + 1, ...b,
      rincian: b.tugas.map((t) => `${t.kegiatan} (${t.peran}): ${t.volume} ${t.satuan} × Rp${t.tarif.toLocaleString('id-ID')}`).join('; '),
      per_peran: Object.entries(per).map(([p, v]) => `${p}: Rp${Math.round(v).toLocaleString('id-ID')}`).join('; '),
      // SBML hanya bermakna bila rekap disusun per bulan kegiatan
      status: dasar === 'bayar' ? '-' : !adaBatas ? '-' : lewat.length ? `Melebihi SBML ${lewat.join(', ')}` : 'Aman',
    };
  });
  const buf = await buatExcel(
    'Rekap Honor',
    [
      { judul: 'No', kunci: 'no', lebar: 6 }, { judul: 'Nama Mitra', kunci: 'nama', lebar: 28 }, { judul: 'SOBAT ID', kunci: 'sobat_id' },
      { judul: 'Kecamatan', kunci: 'kecamatan' }, { judul: 'Rincian Kegiatan', kunci: 'rincian', lebar: 70 },
      { judul: 'Honor per Peran', kunci: 'per_peran', lebar: 30 }, { judul: 'Total Honor', kunci: 'total', uang: true }, { judul: 'Bank', kunci: 'bank', lebar: 12 },
      { judul: 'No Rekening', kunci: 'no_rekening' }, { judul: 'Status SBML', kunci: 'status', lebar: 22 },
    ],
    baris,
    `Rekap Honor Mitra — ${dasar === 'bayar' ? 'dibayar' : 'kegiatan'} ${labelBulan(bulan)}${adaBatas && dasar !== 'bayar' ? ` (SBML/bulan: ${Object.entries(batas).map(([p, v]) => `${p} Rp${v.toLocaleString('id-ID')}`).join(', ')})` : ''}`,
  );
  return unduh(c, buf, `Rekap Honor ${dasar === 'bayar' ? 'Pembayaran' : 'Kegiatan'} ${labelBulan(bulan)}.xlsx`);
});

laporan.get('/beranda', (c) => {
  const hari = hariIni();
  const bulan = hari.slice(0, 7);
  const tahun = Number(bulan.slice(0, 4));
  const satu = (sql: string, ...p: (string | number)[]) => (db.prepare(sql).get(...p) as { n: number }).n;

  const statistik = {
    mitra_aktif: satu("SELECT COUNT(*) n FROM mitra WHERE dihapus IS NULL AND status = 'aktif'"),
    kegiatan_berjalan: satu('SELECT COUNT(*) n FROM kegiatan WHERE dihapus IS NULL AND tanggal_mulai <= ? AND tanggal_selesai >= ?', hari, hari),
    kegiatan_tahun_ini: satu("SELECT COUNT(*) n FROM kegiatan WHERE dihapus IS NULL AND substr(bulan_kegiatan,1,4) = ?", String(tahun)),
    honor_bulan_ini: satu(
      'SELECT COALESCE(SUM(p.volume*p.tarif),0) n FROM penugasan p JOIN kegiatan k ON k.id=p.kegiatan_id WHERE k.dihapus IS NULL AND k.bulan_kegiatan = ?', bulan),
    mitra_bertugas_bulan_ini: satu(
      'SELECT COUNT(DISTINCT p.mitra_id) n FROM penugasan p JOIN kegiatan k ON k.id=p.kegiatan_id WHERE k.dihapus IS NULL AND k.bulan_kegiatan = ?', bulan),
    // pembayaran bulan berjalan (real-time): honor yang bulan pembayarannya = bulan ini
    bayar_bulan_ini: satu(
      'SELECT COALESCE(SUM(p.volume*p.tarif),0) n FROM penugasan p JOIN kegiatan k ON k.id=p.kegiatan_id WHERE k.dihapus IS NULL AND k.bulan_honor = ?', bulan),
    mitra_dibayar_bulan_ini: satu(
      'SELECT COUNT(DISTINCT p.mitra_id) n FROM penugasan p JOIN kegiatan k ON k.id=p.kegiatan_id WHERE k.dihapus IS NULL AND k.bulan_honor = ?', bulan),
  };

  const honorBulanan = db
    .prepare(
      `SELECT k.bulan_kegiatan AS bulan, COALESCE(SUM(p.volume*p.tarif),0) AS total, COUNT(DISTINCT p.mitra_id) AS mitra
       FROM kegiatan k LEFT JOIN penugasan p ON p.kegiatan_id = k.id
       WHERE k.dihapus IS NULL AND substr(k.bulan_kegiatan,1,4) = ? GROUP BY k.bulan_kegiatan`,
    )
    .all(String(tahun)) as { bulan: string; total: number; mitra: number }[];
  const grafik = Array.from({ length: 12 }, (_, i) => {
    const b = `${tahun}-${String(i + 1).padStart(2, '0')}`;
    const r = honorBulanan.find((x) => x.bulan === b);
    return { bulan: b, total: r?.total ?? 0, mitra: r?.mitra ?? 0 };
  });

  const kegiatanAktif = db
    .prepare(
      `SELECT k.id, k.nama, k.tanggal_mulai, k.tanggal_selesai, k.bulan_honor, k.bulan_kegiatan, k.seri_id, k.target_petugas,
         (SELECT COUNT(DISTINCT mitra_id) FROM penugasan WHERE kegiatan_id = k.id) AS jumlah_petugas
       FROM kegiatan k WHERE k.dihapus IS NULL AND k.tanggal_selesai >= ? AND k.tanggal_mulai <= date(?, '+30 day')
       ORDER BY k.tanggal_mulai LIMIT 8`,
    )
    .all(hari, hari);

  // Hal yang perlu diperhatikan
  const perhatian: { jenis: string; judul: string; detail: string; tautan: string }[] = [];
  for (const b of [bulan, geserBulan(bulan, 1)]) {
    const lewat = mitraLewatSbml(b);
    const jumlah = new Set(lewat.map((x) => x.mitra_id)).size;
    if (jumlah) {
      const peran = [...new Set(lewat.map((x) => x.peran))].join(', ');
      perhatian.push({ jenis: 'bahaya', judul: `${jumlah} mitra melebihi SBML ${labelBulan(b)}`, detail: `Peran: ${peran}`, tautan: `/rekap?bulan=${b}&lewat=1` });
    }
  }
  if (!Object.keys(sbmlBulan(bulan)).length) perhatian.push({ jenis: 'info', judul: `SBML ${tahun} belum diatur`, detail: 'Isi SBML per peran agar aplikasi bisa memberi peringatan.', tautan: '/pengaturan?tab=batas' });
  const tanpaPetugas = db
    .prepare(
      `SELECT k.id, k.nama FROM kegiatan k WHERE k.dihapus IS NULL AND k.tanggal_selesai >= ? AND k.tanggal_mulai <= date(?, '+14 day')
         AND NOT EXISTS (SELECT 1 FROM penugasan p WHERE p.kegiatan_id = k.id)`,
    )
    .all(hari, hari) as { id: number; nama: string }[];
  for (const k of tanpaPetugas) perhatian.push({ jenis: 'peringatan', judul: `${k.nama} belum memiliki petugas`, detail: 'Kegiatan dimulai dalam 14 hari / sedang berjalan.', tautan: `/kegiatan/${k.id}` });
  const tanpaVolume = db
    .prepare(
      `SELECT k.id, k.nama, COUNT(*) n FROM penugasan p JOIN kegiatan k ON k.id = p.kegiatan_id
       WHERE k.dihapus IS NULL AND k.bulan_kegiatan IN (?, ?) AND (p.volume = 0 OR p.tarif = 0) GROUP BY k.id`,
    )
    .all(bulan, geserBulan(bulan, 1)) as { id: number; nama: string; n: number }[];
  for (const k of tanpaVolume) perhatian.push({ jenis: 'peringatan', judul: `${k.n} petugas ${k.nama} belum ada volume/tarif`, detail: 'Honornya masih Rp0.', tautan: `/kegiatan/${k.id}` });

  const pengguna = c.get('pengguna');
  if (pengguna.peran === 'admin') {
    const n = satu("SELECT COUNT(*) n FROM pengguna WHERE status = 'menunggu'");
    if (n) perhatian.unshift({ jenis: 'info', judul: `${n} pendaftar menunggu persetujuan`, detail: 'Setujui agar mereka bisa masuk ke aplikasi.', tautan: '/pengaturan?tab=pengguna' });
  }
  return c.json({ hari, bulan, statistik, grafik, kegiatanAktif, perhatian, pengguna });
});
