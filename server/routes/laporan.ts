/** BERANDA & REKAP HONOR BULANAN */
import { Hono } from 'hono';
import { db } from '../db.ts';
import type { Env } from '../auth.ts';
import { batasHonor, honorPerMitra, unduh } from './data.ts';
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
  tugas: { kegiatan_id: number; kegiatan: string; peran: string; volume: number; satuan: string; tarif: number; honor: number }[];
};

export function rekapBulan(bulan: string): BarisRekap[] {
  const rows = db
    .prepare(
      `SELECT m.id AS mitra_id, m.nama, m.sobat_id, m.kecamatan, m.desa, m.bank, m.no_rekening,
              k.id AS kegiatan_id, k.nama AS kegiatan, k.satuan, p.peran, p.volume, p.tarif, (p.volume*p.tarif) AS honor
       FROM penugasan p JOIN kegiatan k ON k.id = p.kegiatan_id JOIN mitra m ON m.id = p.mitra_id
       WHERE k.dihapus IS NULL AND m.dihapus IS NULL AND k.bulan_honor = ?
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
    b.tugas.push({ kegiatan_id: r.kegiatan_id, kegiatan: r.kegiatan, peran: r.peran, volume: r.volume, satuan: r.satuan, tarif: r.tarif, honor: r.honor });
    b.total += r.honor;
  }
  return [...peta.values()];
}

laporan.get('/rekap', (c) => {
  const bulan = c.req.query('bulan') ?? hariIni().slice(0, 7);
  const kegiatan = db
    .prepare(
      `SELECT k.id, k.nama, k.satuan, COUNT(DISTINCT p.mitra_id) AS petugas, COALESCE(SUM(p.volume*p.tarif),0) AS total
       FROM kegiatan k LEFT JOIN penugasan p ON p.kegiatan_id = k.id
       WHERE k.dihapus IS NULL AND k.bulan_honor = ? GROUP BY k.id ORDER BY k.tanggal_mulai`,
    )
    .all(bulan);
  return c.json({ bulan, baris: rekapBulan(bulan), kegiatan, batas: batasHonor(Number(bulan.slice(0, 4))) });
});

laporan.get('/rekap/ekspor', async (c) => {
  const bulan = c.req.query('bulan') ?? hariIni().slice(0, 7);
  const batas = batasHonor(Number(bulan.slice(0, 4)));
  const baris = rekapBulan(bulan).map((b, i) => ({
    no: i + 1, ...b,
    rincian: b.tugas.map((t) => `${t.kegiatan} (${t.peran}): ${t.volume} ${t.satuan} × Rp${t.tarif.toLocaleString('id-ID')}`).join('; '),
    status: batas ? (b.total > batas ? 'Melebihi batas' : 'Aman') : '-',
  }));
  const buf = await buatExcel(
    'Rekap Honor',
    [
      { judul: 'No', kunci: 'no', lebar: 6 }, { judul: 'Nama Mitra', kunci: 'nama', lebar: 28 }, { judul: 'SOBAT ID', kunci: 'sobat_id' },
      { judul: 'Kecamatan', kunci: 'kecamatan' }, { judul: 'Rincian Kegiatan', kunci: 'rincian', lebar: 70 },
      { judul: 'Total Honor', kunci: 'total', uang: true }, { judul: 'Bank', kunci: 'bank', lebar: 12 },
      { judul: 'No Rekening', kunci: 'no_rekening' }, { judul: 'Status Batas', kunci: 'status', lebar: 16 },
    ],
    baris,
    `Rekap Honor Mitra — ${labelBulan(bulan)}${batas ? ` (batas Rp${batas.toLocaleString('id-ID')}/bulan)` : ''}`,
  );
  return unduh(c, buf, `Rekap Honor ${labelBulan(bulan)}.xlsx`);
});

laporan.get('/beranda', (c) => {
  const hari = hariIni();
  const bulan = hari.slice(0, 7);
  const tahun = Number(bulan.slice(0, 4));
  const satu = (sql: string, ...p: (string | number)[]) => (db.prepare(sql).get(...p) as { n: number }).n;

  const statistik = {
    mitra_aktif: satu("SELECT COUNT(*) n FROM mitra WHERE dihapus IS NULL AND status = 'aktif'"),
    kegiatan_berjalan: satu('SELECT COUNT(*) n FROM kegiatan WHERE dihapus IS NULL AND tanggal_mulai <= ? AND tanggal_selesai >= ?', hari, hari),
    kegiatan_tahun_ini: satu("SELECT COUNT(*) n FROM kegiatan WHERE dihapus IS NULL AND substr(bulan_honor,1,4) = ?", String(tahun)),
    honor_bulan_ini: satu(
      'SELECT COALESCE(SUM(p.volume*p.tarif),0) n FROM penugasan p JOIN kegiatan k ON k.id=p.kegiatan_id WHERE k.dihapus IS NULL AND k.bulan_honor = ?', bulan),
    mitra_bertugas_bulan_ini: satu(
      'SELECT COUNT(DISTINCT p.mitra_id) n FROM penugasan p JOIN kegiatan k ON k.id=p.kegiatan_id WHERE k.dihapus IS NULL AND k.bulan_honor = ?', bulan),
  };

  const honorBulanan = db
    .prepare(
      `SELECT k.bulan_honor AS bulan, COALESCE(SUM(p.volume*p.tarif),0) AS total, COUNT(DISTINCT p.mitra_id) AS mitra
       FROM kegiatan k LEFT JOIN penugasan p ON p.kegiatan_id = k.id
       WHERE k.dihapus IS NULL AND substr(k.bulan_honor,1,4) = ? GROUP BY k.bulan_honor`,
    )
    .all(String(tahun)) as { bulan: string; total: number; mitra: number }[];
  const grafik = Array.from({ length: 12 }, (_, i) => {
    const b = `${tahun}-${String(i + 1).padStart(2, '0')}`;
    const r = honorBulanan.find((x) => x.bulan === b);
    return { bulan: b, total: r?.total ?? 0, mitra: r?.mitra ?? 0 };
  });

  const kegiatanAktif = db
    .prepare(
      `SELECT k.id, k.nama, k.tanggal_mulai, k.tanggal_selesai, k.bulan_honor, k.target_petugas,
         (SELECT COUNT(DISTINCT mitra_id) FROM penugasan WHERE kegiatan_id = k.id) AS jumlah_petugas
       FROM kegiatan k WHERE k.dihapus IS NULL AND k.tanggal_selesai >= ? AND k.tanggal_mulai <= date(?, '+30 day')
       ORDER BY k.tanggal_mulai LIMIT 8`,
    )
    .all(hari, hari);

  // Hal yang perlu diperhatikan
  const perhatian: { jenis: string; judul: string; detail: string; tautan: string }[] = [];
  const batas = batasHonor(tahun);
  for (const b of [bulan, geserBulan(bulan, 1)]) {
    const bts = batasHonor(Number(b.slice(0, 4)));
    if (!bts) continue;
    const lebih = [...honorPerMitra(b).entries()].filter(([, t]) => t > bts);
    if (lebih.length) {
      perhatian.push({
        jenis: 'bahaya', judul: `${lebih.length} mitra melebihi batas honor ${labelBulan(b)}`,
        detail: `Batas Rp${bts.toLocaleString('id-ID')} per bulan`, tautan: `/rekap?bulan=${b}`,
      });
    }
  }
  if (!batas) perhatian.push({ jenis: 'info', judul: `Batas honor (SBML) ${tahun} belum diatur`, detail: 'Atur agar aplikasi bisa memberi peringatan.', tautan: '/pengaturan?tab=batas' });
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
       WHERE k.dihapus IS NULL AND k.bulan_honor IN (?, ?) AND (p.volume = 0 OR p.tarif = 0) GROUP BY k.id`,
    )
    .all(bulan, geserBulan(bulan, 1)) as { id: number; nama: string; n: number }[];
  for (const k of tanpaVolume) perhatian.push({ jenis: 'peringatan', judul: `${k.n} petugas ${k.nama} belum ada volume/tarif`, detail: 'Honornya masih Rp0.', tautan: `/kegiatan/${k.id}` });

  const pengguna = c.get('pengguna');
  return c.json({ hari, bulan, statistik, grafik, kegiatanAktif, perhatian, pengguna });
});
