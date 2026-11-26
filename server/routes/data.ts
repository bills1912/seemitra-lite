/**
 * DATA UTAMA: Mitra, Kegiatan, dan Penugasan (alokasi mitra ke kegiatan).
 */
import { Hono, type Context } from 'hono';
import crypto from 'node:crypto';
import { db, catat, transaksi, ambilPengaturan, simpanCadanganKeFile } from '../db.ts';
import { wajibAdmin, type Env } from '../auth.ts';
import { akhirBulan, GagalError, geserBulan, isiNomor, labelBulan } from '../util.ts';
import { bacaExcel, buatExcel } from '../excel.ts';

export const data = new Hono<Env>();

const kosong = (v: unknown) => (v === undefined || v === '' ? null : v);
const teks = (v: unknown) => (v === undefined || v === null ? null : String(v).trim() || null);

/**
 * SBML (batas honor mitra per bulan) — berbeda untuk setiap PERAN dan dicek PER BULAN KEGIATAN
 * (bulan honor). Contoh: honor PPL seorang mitra di bulan Maret dibandingkan dengan SBML PPL tahun itu.
 */
export function sbmlTahun(tahun: number): Record<string, number> {
  const rows = db.prepare('SELECT peran, nominal FROM sbml WHERE tahun = ?').all(tahun) as { peran: string; nominal: number }[];
  return Object.fromEntries(rows.map((r) => [r.peran, r.nominal]));
}
export const sbmlBulan = (bulan: string) => sbmlTahun(Number(bulan.slice(0, 4)));

/** Honor setiap mitra pada satu bulan, dirinci per peran: Map<mitra_id, { PPL: 1200000, PML: … }> */
export function honorPeranBulan(bulan: string): Map<number, Record<string, number>> {
  const rows = db
    .prepare(
      `SELECT p.mitra_id, p.peran, SUM(p.volume * p.tarif) AS total
       FROM penugasan p JOIN kegiatan k ON k.id = p.kegiatan_id
       WHERE k.dihapus IS NULL AND k.bulan_kegiatan = ? GROUP BY p.mitra_id, p.peran`,
    )
    .all(bulan) as { mitra_id: number; peran: string; total: number }[];
  const peta = new Map<number, Record<string, number>>();
  for (const r of rows) peta.set(r.mitra_id, { ...(peta.get(r.mitra_id) ?? {}), [r.peran]: r.total });
  return peta;
}

/** Daftar mitra yang melebihi SBML pada bulan tsb (minimal satu peran). */
export function mitraLewatSbml(bulan: string) {
  const batas = sbmlBulan(bulan);
  const hasil: { mitra_id: number; peran: string; honor: number; batas: number }[] = [];
  for (const [id, per] of honorPeranBulan(bulan)) {
    for (const [peran, honor] of Object.entries(per)) if (batas[peran] && honor > batas[peran]) hasil.push({ mitra_id: id, peran, honor, batas: batas[peran] });
  }
  return hasil;
}

/* =============================== MITRA =============================== */
const KOLOM_MITRA = [
  'sobat_id', 'nama', 'nik', 'jenis_kelamin', 'pekerjaan', 'alamat', 'kecamatan', 'desa',
  'no_hp', 'email', 'bank', 'no_rekening', 'status', 'catatan',
] as const;

function nilaiMitra(b: Record<string, unknown>) {
  const nama = teks(b.nama);
  if (!nama) throw new GagalError('Nama mitra wajib diisi.');
  const v: Record<string, unknown> = {};
  for (const k of KOLOM_MITRA) v[k] = teks(b[k]);
  v.nama = nama;
  v.status = v.status === 'nonaktif' ? 'nonaktif' : 'aktif';
  return v;
}

data.get('/mitra', (c) => {
  const terhapus = c.req.query('terhapus') === '1';
  const bulan = new Date().toISOString().slice(0, 7);
  const rows = db
    .prepare(
      `SELECT m.*,
        (SELECT COUNT(DISTINCT p.kegiatan_id) FROM penugasan p JOIN kegiatan k ON k.id=p.kegiatan_id
           WHERE p.mitra_id = m.id AND k.dihapus IS NULL) AS jumlah_kegiatan,
        (SELECT MAX(k.bulan_kegiatan) FROM penugasan p JOIN kegiatan k ON k.id=p.kegiatan_id
           WHERE p.mitra_id = m.id AND k.dihapus IS NULL) AS terakhir_bertugas,
        (SELECT COALESCE(SUM(p.volume*p.tarif),0) FROM penugasan p JOIN kegiatan k ON k.id=p.kegiatan_id
           WHERE p.mitra_id = m.id AND k.dihapus IS NULL AND k.bulan_kegiatan = ?) AS honor_bulan_ini
       FROM mitra m WHERE ${terhapus ? 'm.dihapus IS NOT NULL' : 'm.dihapus IS NULL'}
       ORDER BY m.nama COLLATE NOCASE`,
    )
    .all(bulan) as Record<string, unknown>[];
  const batas = sbmlBulan(bulan);
  const per = honorPeranBulan(bulan);
  return c.json(rows.map((m) => {
    const h = per.get(Number(m.id)) ?? {};
    const rasio = Math.max(0, ...Object.entries(h).map(([p, v]) => (batas[p] ? v / batas[p] : 0)));
    return { ...m, rasio_sbml: Object.keys(batas).length ? rasio : null };
  }));
});

data.get('/mitra/:id', (c) => {
  const id = Number(c.req.param('id'));
  const mitra = db.prepare('SELECT * FROM mitra WHERE id = ?').get(id);
  if (!mitra) throw new GagalError('Mitra tidak ditemukan.', 404);
  const tugas = db
    .prepare(
      `SELECT p.*, k.nama AS kegiatan, k.bulan_honor, k.bulan_kegiatan, k.satuan, k.tanggal_mulai, k.tanggal_selesai, (p.volume*p.tarif) AS honor
       FROM penugasan p JOIN kegiatan k ON k.id = p.kegiatan_id
       WHERE p.mitra_id = ? AND k.dihapus IS NULL ORDER BY k.bulan_kegiatan DESC, k.tanggal_mulai DESC`,
    )
    .all(id);
  const tahun = [...new Set((tugas as { bulan_kegiatan: string }[]).map((t) => Number(t.bulan_kegiatan.slice(0, 4))))];
  return c.json({ mitra, tugas, sbml: Object.fromEntries(tahun.map((t) => [t, sbmlTahun(t)])), ambang: ambilPengaturan().ambang_sbml });
});

data.post('/mitra', async (c) => {
  const v = nilaiMitra(await c.req.json());
  const r = db
    .prepare(`INSERT INTO mitra (${KOLOM_MITRA.join(',')}) VALUES (${KOLOM_MITRA.map(() => '?').join(',')})`)
    .run(...KOLOM_MITRA.map((k) => v[k] as string | null));
  catat(c.get('pengguna').nama, 'Tambah mitra', String(v.nama));
  return c.json({ id: Number(r.lastInsertRowid) });
});

data.put('/mitra/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const v = nilaiMitra(await c.req.json());
  db.prepare(`UPDATE mitra SET ${KOLOM_MITRA.map((k) => `${k} = ?`).join(', ')}, diubah = datetime('now','localtime') WHERE id = ?`).run(
    ...KOLOM_MITRA.map((k) => v[k] as string | null),
    id,
  );
  catat(c.get('pengguna').nama, 'Ubah mitra', String(v.nama));
  return c.json({ ok: true });
});

data.delete('/mitra/:id', (c) => {
  const id = Number(c.req.param('id'));
  db.prepare("UPDATE mitra SET dihapus = datetime('now','localtime') WHERE id = ?").run(id);
  const m = db.prepare('SELECT nama FROM mitra WHERE id = ?').get(id) as { nama: string } | undefined;
  catat(c.get('pengguna').nama, 'Hapus mitra', m?.nama);
  return c.json({ ok: true });
});
data.post('/mitra/:id/pulihkan', (c) => {
  const id = Number(c.req.param('id'));
  db.prepare('UPDATE mitra SET dihapus = NULL WHERE id = ?').run(id);
  catat(c.get('pengguna').nama, 'Pulihkan mitra', String(id));
  return c.json({ ok: true });
});

const PETA_IMPOR_MITRA: Record<string, string[]> = {
  nama: ['nama', 'nama mitra', 'nama lengkap'],
  sobat_id: ['sobat id', 'id sobat', 'sobat', 'id mitra'],
  nik: ['nik', 'no ktp', 'nomor induk kependudukan'],
  jenis_kelamin: ['jenis kelamin', 'jk', 'l/p'],
  pekerjaan: ['pekerjaan'],
  alamat: ['alamat', 'alamat lengkap', 'alamat detail'],
  kecamatan: ['kecamatan', 'kec'],
  desa: ['desa', 'desa/kelurahan', 'kelurahan'],
  no_hp: ['no hp', 'nomor hp', 'hp', 'no telp', 'telepon', 'no whatsapp'],
  email: ['email', 'e-mail'],
  bank: ['bank', 'nama bank'],
  no_rekening: ['no rekening', 'nomor rekening', 'rekening'],
  status: ['status'],
  catatan: ['catatan', 'keterangan'],
};
const JUDUL_IMPOR_MITRA = [
  'Nama', 'SOBAT ID', 'NIK', 'Jenis Kelamin', 'Pekerjaan', 'Alamat', 'Kecamatan', 'Desa',
  'No HP', 'Email', 'Bank', 'No Rekening', 'Status', 'Catatan',
];

data.get('/mitra-impor/contoh', async (c) => {
  const kunci = ['nama', 'sobat_id', 'nik', 'jenis_kelamin', 'pekerjaan', 'alamat', 'kecamatan', 'desa', 'no_hp', 'email', 'bank', 'no_rekening', 'status', 'catatan'];
  const buf = await buatExcel(
    'Mitra',
    JUDUL_IMPOR_MITRA.map((j, i) => ({ judul: j, kunci: kunci[i], lebar: i === 0 || i === 5 ? 28 : 16 })),
    [{ nama: 'Contoh Nama Mitra', sobat_id: '127800001', jenis_kelamin: 'Perempuan', pekerjaan: 'Wiraswasta', alamat: 'Jl. Contoh No. 1', kecamatan: 'Padang Bolak', desa: 'Sigama', no_hp: '081234567890', status: 'aktif' }],
  );
  return unduh(c, buf, 'Contoh Impor Mitra.xlsx');
});

data.post('/mitra-impor', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  if (!file || typeof file === 'string') throw new GagalError('Pilih file Excel (.xlsx) atau CSV terlebih dahulu.');
  const rows = await bacaExcel(await file.arrayBuffer(), PETA_IMPOR_MITRA, file.name);
  if (!rows.length) throw new GagalError('Tidak ada data yang terbaca. Pastikan salah satu dari 10 baris pertama berisi judul kolom, minimal kolom "Nama".');
  if (!('nama' in rows[0])) throw new GagalError('Kolom "Nama" tidak ditemukan di file Excel.');
  let baru = 0, diperbarui = 0, dilewati = 0;
  transaksi(() => {
    for (const r of rows) {
      if (!r.nama) { dilewati++; continue; }
      const jk = (r.jenis_kelamin || '').toLowerCase();
      r.jenis_kelamin = jk.startsWith('l') ? 'Laki-laki' : jk.startsWith('p') ? 'Perempuan' : r.jenis_kelamin;
      r.status = (r.status || '').toLowerCase().includes('non') ? 'nonaktif' : 'aktif';
      const v = nilaiMitra(r);
      const ada = (r.sobat_id && db.prepare('SELECT id FROM mitra WHERE sobat_id = ? AND dihapus IS NULL').get(r.sobat_id)) ||
        (r.nik && db.prepare('SELECT id FROM mitra WHERE nik = ? AND dihapus IS NULL').get(r.nik)) ||
        db.prepare('SELECT id FROM mitra WHERE nama = ? COLLATE NOCASE AND dihapus IS NULL').get(r.nama);
      if (ada) {
        const kolomIsi = KOLOM_MITRA.filter((k) => r[k] !== undefined && r[k] !== '');
        db.prepare(`UPDATE mitra SET ${kolomIsi.map((k) => `${k} = ?`).join(', ')}, diubah = datetime('now','localtime') WHERE id = ?`).run(
          ...kolomIsi.map((k) => v[k] as string | null), (ada as { id: number }).id);
        diperbarui++;
      } else {
        db.prepare(`INSERT INTO mitra (${KOLOM_MITRA.join(',')}) VALUES (${KOLOM_MITRA.map(() => '?').join(',')})`).run(
          ...KOLOM_MITRA.map((k) => v[k] as string | null));
        baru++;
      }
    }
  });
  catat(c.get('pengguna').nama, 'Impor mitra', `${baru} baru, ${diperbarui} diperbarui`);
  return c.json({ baru, diperbarui, dilewati });
});

data.get('/mitra-ekspor', async (c) => {
  const rows = db.prepare('SELECT * FROM mitra WHERE dihapus IS NULL ORDER BY nama COLLATE NOCASE').all() as Record<string, unknown>[];
  const kunci = ['nama', 'sobat_id', 'nik', 'jenis_kelamin', 'pekerjaan', 'alamat', 'kecamatan', 'desa', 'no_hp', 'email', 'bank', 'no_rekening', 'status', 'catatan'];
  const buf = await buatExcel('Mitra', JUDUL_IMPOR_MITRA.map((j, i) => ({ judul: j, kunci: kunci[i], lebar: i === 0 || i === 5 ? 28 : 16 })), rows);
  return unduh(c, buf, `Daftar Mitra ${new Date().toISOString().slice(0, 10)}.xlsx`);
});

/* =============================== KEGIATAN =============================== */
const KOLOM_KEGIATAN = ['nama', 'singkatan', 'jenis', 'tanggal_mulai', 'tanggal_selesai', 'bulan_kegiatan', 'bulan_honor', 'satuan', 'mak', 'target_petugas', 'tarif', 'keterangan'] as const;

/**
 * Aturan bulan:
 * - bulan_kegiatan = bulan dari TANGGAL SELESAI → dasar pengecekan SBML, SPK & BAST.
 * - bulan_honor    = BULAN PEMBAYARAN. Jika tidak diisi: bulan kegiatan + jeda (Pengaturan, bawaan n+1).
 */
function nilaiKegiatan(b: Record<string, unknown>) {
  const nama = teks(b.nama);
  if (!nama) throw new GagalError('Nama kegiatan wajib diisi.');
  const mulai = teks(b.tanggal_mulai), selesai = teks(b.tanggal_selesai);
  if (!mulai || !selesai) throw new GagalError('Tanggal mulai dan selesai wajib diisi.');
  if (selesai < mulai) throw new GagalError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
  const bulanKegiatan = selesai.slice(0, 7);
  const bulan = teks(b.bulan_honor) ?? geserBulan(bulanKegiatan, ambilPengaturan().jeda_pembayaran);
  if (!/^\d{4}-\d{2}$/.test(bulan)) throw new GagalError('Bulan pembayaran tidak valid.');
  const tarif: Record<string, number> = {};
  for (const [k, v] of Object.entries((b.tarif as Record<string, unknown>) ?? {})) {
    const n = Number(v);
    if (k && n > 0) tarif[k] = n;
  }
  return {
    nama, singkatan: teks(b.singkatan), jenis: teks(b.jenis) ?? 'Survei', tanggal_mulai: mulai, tanggal_selesai: selesai,
    bulan_kegiatan: bulanKegiatan, bulan_honor: bulan, satuan: teks(b.satuan) ?? 'Dokumen', mak: teks(b.mak),
    target_petugas: kosong(b.target_petugas) === null ? null : Number(b.target_petugas),
    tarif: JSON.stringify(tarif), keterangan: teks(b.keterangan),
  };
}

/** Membuat daftar kegiatan bulanan (satu baris per bulan) untuk kegiatan yang berulang sepanjang tahun. */
function jadwalBulanan(b: Record<string, unknown>) {
  const tahun = Number(b.tahun);
  const dari = Number(b.bulan_dari ?? 1), sampai = Number(b.bulan_sampai ?? 12);
  const hariMulai = Math.min(28, Math.max(1, Number(b.hari_mulai ?? 1)));
  const hariSelesai = Math.max(1, Number(b.hari_selesai ?? 31));
  const jeda = b.jeda_bayar === undefined || b.jeda_bayar === null || b.jeda_bayar === '' ? ambilPengaturan().jeda_pembayaran : Number(b.jeda_bayar);
  if (!(tahun >= 2000 && tahun <= 2100)) throw new GagalError('Tahun kegiatan bulanan tidak valid.');
  if (!(dari >= 1 && sampai <= 12 && dari <= sampai)) throw new GagalError('Rentang bulan tidak valid.');
  const hasil: { tanggal_mulai: string; tanggal_selesai: string; bulan_honor: string }[] = [];
  for (let m = dari; m <= sampai; m++) {
    const akhir = new Date(Date.UTC(tahun, m, 0)).getUTCDate();
    const bln = `${tahun}-${String(m).padStart(2, '0')}`;
    const mulai = `${bln}-${String(Math.min(hariMulai, akhir)).padStart(2, '0')}`;
    const selesai = `${bln}-${String(Math.min(Math.max(hariSelesai, hariMulai), akhir)).padStart(2, '0')}`;
    hasil.push({ tanggal_mulai: mulai, tanggal_selesai: selesai, bulan_honor: geserBulan(bln, jeda) });
  }
  return hasil;
}

const SQL_KEGIATAN = `
  SELECT k.*,
    (SELECT COUNT(DISTINCT p.mitra_id) FROM penugasan p WHERE p.kegiatan_id = k.id) AS jumlah_petugas,
    (SELECT COALESCE(SUM(p.volume*p.tarif),0) FROM penugasan p WHERE p.kegiatan_id = k.id) AS total_honor,
    (SELECT COALESCE(SUM(p.volume),0) FROM penugasan p WHERE p.kegiatan_id = k.id) AS total_volume
  FROM kegiatan k`;
const parsKegiatan = (k: Record<string, unknown>) => ({ ...k, tarif: JSON.parse(String(k.tarif || '{}')) });

data.get('/kegiatan', (c) => {
  const terhapus = c.req.query('terhapus') === '1';
  const rows = db
    .prepare(`${SQL_KEGIATAN} WHERE ${terhapus ? 'k.dihapus IS NOT NULL' : 'k.dihapus IS NULL'} ORDER BY k.tanggal_mulai DESC, k.id DESC`)
    .all() as Record<string, unknown>[];
  return c.json(rows.map(parsKegiatan));
});

data.get('/kegiatan/:id', (c) => {
  const id = Number(c.req.param('id'));
  const k = db.prepare(`${SQL_KEGIATAN} WHERE k.id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!k) throw new GagalError('Kegiatan tidak ditemukan.', 404);
  const petugas = db
    .prepare(
      `SELECT p.*, (p.volume*p.tarif) AS honor, m.nama, m.sobat_id, m.kecamatan, m.desa, m.no_hp, m.dihapus AS mitra_dihapus
       FROM penugasan p JOIN mitra m ON m.id = p.mitra_id WHERE p.kegiatan_id = ? ORDER BY p.peran, m.nama COLLATE NOCASE`,
    )
    .all(id) as Record<string, unknown>[];
  const per = honorPeranBulan(String(k.bulan_kegiatan));
  const seri = k.seri_id
    ? db.prepare(
        `SELECT k.id, k.tanggal_mulai, k.tanggal_selesai, k.bulan_kegiatan, k.bulan_honor,
           (SELECT COUNT(DISTINCT mitra_id) FROM penugasan WHERE kegiatan_id = k.id) AS jumlah_petugas
         FROM kegiatan k WHERE k.seri_id = ? AND k.dihapus IS NULL ORDER BY k.tanggal_mulai`,
      ).all(Number(k.seri_id))
    : null;
  return c.json({
    kegiatan: parsKegiatan(k),
    seri,
    petugas: petugas.map((p) => ({ ...p, honor_peran: per.get(Number(p.mitra_id)) ?? {} })),
    sbml: sbmlBulan(String(k.bulan_kegiatan)),
    ambang: ambilPengaturan().ambang_sbml,
  });
});

/** Daftar mitra aktif + total honor bulan tsb + jumlah kegiatan yang tanggalnya bentrok. */
data.get('/kegiatan/:id/kandidat', (c) => {
  const id = Number(c.req.param('id'));
  const k = db.prepare('SELECT * FROM kegiatan WHERE id = ?').get(id) as Record<string, string> | undefined;
  if (!k) throw new GagalError('Kegiatan tidak ditemukan.', 404);
  const per = honorPeranBulan(k.bulan_kegiatan);
  const rows = db
    .prepare(
      `SELECT m.id, m.nama, m.sobat_id, m.kecamatan, m.desa, m.pekerjaan,
         (SELECT GROUP_CONCAT(p.peran) FROM penugasan p WHERE p.mitra_id = m.id AND p.kegiatan_id = ?) AS peran_di_sini,
         (SELECT COUNT(*) FROM penugasan p JOIN kegiatan k2 ON k2.id = p.kegiatan_id
            WHERE p.mitra_id = m.id AND k2.id <> ? AND k2.dihapus IS NULL
              AND k2.tanggal_mulai <= ? AND k2.tanggal_selesai >= ?) AS bentrok
       FROM mitra m WHERE m.dihapus IS NULL AND m.status = 'aktif' ORDER BY m.nama COLLATE NOCASE`,
    )
    .all(id, id, k.tanggal_selesai, k.tanggal_mulai) as Record<string, unknown>[];
  return c.json({
    mitra: rows.map((r) => ({ ...r, honor_peran: per.get(Number(r.id)) ?? {} })),
    sbml: sbmlBulan(k.bulan_kegiatan),
    ambang: ambilPengaturan().ambang_sbml,
  });
});

data.post('/kegiatan', async (c) => {
  const b = await c.req.json();
  const sisip = db.prepare(`INSERT INTO kegiatan (${KOLOM_KEGIATAN.join(',')}) VALUES (${KOLOM_KEGIATAN.map(() => '?').join(',')})`);
  if (b.pola === 'bulanan') {
    // Kegiatan berulang setiap bulan: dibuat satu kegiatan per bulan dalam satu "seri"
    const jadwal = jadwalBulanan(b);
    const ids = transaksi(() => {
      const hasil: number[] = [];
      for (const j of jadwal) {
        const v = nilaiKegiatan({ ...b, ...j });
        hasil.push(Number(sisip.run(...KOLOM_KEGIATAN.map((k) => v[k])).lastInsertRowid));
      }
      db.prepare(`UPDATE kegiatan SET seri_id = ? WHERE id IN (${hasil.map(() => '?').join(',')})`).run(hasil[0], ...hasil);
      return hasil;
    });
    catat(c.get('pengguna').nama, 'Tambah kegiatan bulanan', `${b.nama} (${ids.length} bulan, ${b.tahun})`);
    // arahkan ke bulan yang sedang berjalan bila ada, jika tidak ke bulan pertama
    const bulanIni = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
    const idx = jadwal.findIndex((j) => j.tanggal_selesai.startsWith(bulanIni));
    return c.json({ id: ids[idx >= 0 ? idx : 0], jumlah: ids.length });
  }
  const v = nilaiKegiatan(b);
  const r = sisip.run(...KOLOM_KEGIATAN.map((k) => v[k]));
  catat(c.get('pengguna').nama, 'Tambah kegiatan', v.nama);
  return c.json({ id: Number(r.lastInsertRowid) });
});

data.put('/kegiatan/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const v = nilaiKegiatan(body);
  const lama = db.prepare('SELECT tarif FROM kegiatan WHERE id = ?').get(id) as { tarif: string } | undefined;
  transaksi(() => {
    db.prepare(`UPDATE kegiatan SET ${KOLOM_KEGIATAN.map((k) => `${k} = ?`).join(', ')}, diubah = datetime('now','localtime') WHERE id = ?`).run(
      ...KOLOM_KEGIATAN.map((k) => v[k]), id);
    // Jika tarif berubah dan pengguna memilih "terapkan ke petugas", perbarui tarif petugas yang tarifnya masih sama dengan tarif lama
    if (body.terapkan_tarif && lama) {
      const tl = JSON.parse(lama.tarif || '{}') as Record<string, number>;
      const tb = JSON.parse(v.tarif) as Record<string, number>;
      for (const [peran, nilai] of Object.entries(tb)) {
        db.prepare('UPDATE penugasan SET tarif = ? WHERE kegiatan_id = ? AND peran = ? AND (tarif = ? OR tarif = 0)').run(nilai, id, peran, tl[peran] ?? 0);
      }
    }
  });
  // Terapkan perubahan umum (bukan tanggal) ke bulan-bulan berikutnya dalam seri
  let ikutDiubah = 0;
  if (body.terapkan_seri) {
    const ini = db.prepare('SELECT seri_id, tanggal_mulai FROM kegiatan WHERE id = ?').get(id) as { seri_id: number | null; tanggal_mulai: string };
    if (ini?.seri_id) {
      const r = db.prepare(
        `UPDATE kegiatan SET nama = ?, singkatan = ?, jenis = ?, satuan = ?, mak = ?, target_petugas = ?, tarif = ?, keterangan = ?, diubah = datetime('now','localtime')
         WHERE seri_id = ? AND id <> ? AND tanggal_mulai > ? AND dihapus IS NULL`,
      ).run(v.nama, v.singkatan, v.jenis, v.satuan, v.mak, v.target_petugas, v.tarif, v.keterangan, ini.seri_id, id, ini.tanggal_mulai);
      ikutDiubah = Number(r.changes);
      // tarif petugas di bulan-bulan berikutnya ikut diperbarui (hanya yang masih memakai tarif lama)
      if (body.terapkan_tarif && lama) {
        const tl = JSON.parse(lama.tarif || '{}') as Record<string, number>;
        for (const [peran, nilai] of Object.entries(JSON.parse(v.tarif) as Record<string, number>)) {
          db.prepare(
            `UPDATE penugasan SET tarif = ? WHERE peran = ? AND (tarif = ? OR tarif = 0)
             AND kegiatan_id IN (SELECT id FROM kegiatan WHERE seri_id = ? AND tanggal_mulai > ? AND dihapus IS NULL)`,
          ).run(nilai, peran, tl[peran] ?? 0, ini.seri_id, ini.tanggal_mulai);
        }
      }
    }
  }
  catat(c.get('pengguna').nama, 'Ubah kegiatan', v.nama + (ikutDiubah ? ` (+${ikutDiubah} bulan berikutnya)` : ''));
  return c.json({ ok: true, ikutDiubah });
});

data.delete('/kegiatan/:id', (c) => {
  const id = Number(c.req.param('id'));
  const seri = c.req.query('seri') === '1' ? (db.prepare('SELECT seri_id FROM kegiatan WHERE id = ?').get(id) as { seri_id: number | null })?.seri_id : null;
  if (seri) {
    const r = db.prepare("UPDATE kegiatan SET dihapus = datetime('now','localtime') WHERE seri_id = ? AND dihapus IS NULL").run(seri);
    catat(c.get('pengguna').nama, 'Hapus seri kegiatan bulanan', `${r.changes} bulan`);
    return c.json({ ok: true, seri });
  }
  db.prepare("UPDATE kegiatan SET dihapus = datetime('now','localtime') WHERE id = ?").run(id);
  const k = db.prepare('SELECT nama FROM kegiatan WHERE id = ?').get(id) as { nama: string } | undefined;
  catat(c.get('pengguna').nama, 'Hapus kegiatan', k?.nama);
  return c.json({ ok: true });
});
data.post('/kegiatan/:id/pulihkan', (c) => {
  const id = Number(c.req.param('id'));
  if (c.req.query('seri') === '1') {
    const k = db.prepare('SELECT seri_id, dihapus FROM kegiatan WHERE id = ?').get(id) as { seri_id: number | null; dihapus: string };
    if (k?.seri_id) db.prepare('UPDATE kegiatan SET dihapus = NULL WHERE seri_id = ? AND dihapus = ?').run(k.seri_id, k.dihapus);
  }
  db.prepare('UPDATE kegiatan SET dihapus = NULL WHERE id = ?').run(id);
  catat(c.get('pengguna').nama, 'Pulihkan kegiatan', c.req.param('id'));
  return c.json({ ok: true });
});

/** Salin kegiatan (mis. survei rutin bulanan) beserta petugasnya bila diminta. */
data.post('/kegiatan/:id/salin', async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json();
  const asal = db.prepare('SELECT * FROM kegiatan WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!asal) throw new GagalError('Kegiatan asal tidak ditemukan.', 404);
  const v = nilaiKegiatan({ ...asal, bulan_honor: undefined, tarif: JSON.parse(String(asal.tarif)), ...b });
  const baruId = transaksi(() => {
    const r = db
      .prepare(`INSERT INTO kegiatan (${KOLOM_KEGIATAN.join(',')}) VALUES (${KOLOM_KEGIATAN.map(() => '?').join(',')})`)
      .run(...KOLOM_KEGIATAN.map((k) => v[k]));
    const nid = Number(r.lastInsertRowid);
    if (b.salin_petugas) {
      db.prepare(
        `INSERT INTO penugasan (kegiatan_id, mitra_id, peran, volume, tarif, dibuat_oleh)
         SELECT ?, p.mitra_id, p.peran, ${b.salin_volume ? 'p.volume' : '0'}, p.tarif, ? FROM penugasan p
         JOIN mitra m ON m.id = p.mitra_id WHERE p.kegiatan_id = ? AND m.dihapus IS NULL`,
      ).run(nid, c.get('pengguna').nama, id);
    }
    return nid;
  });
  catat(c.get('pengguna').nama, 'Salin kegiatan', `${asal.nama} → ${v.nama}`);
  return c.json({ id: baruId });
});

/** Salin petugas kegiatan ini ke bulan-bulan berikutnya dalam seri yang sama (yang sudah ada tidak ditimpa). */
data.post('/kegiatan/:id/salin-petugas-seri', async (c) => {
  const id = Number(c.req.param('id'));
  const { salin_volume } = await c.req.json();
  const k = db.prepare('SELECT seri_id, tanggal_mulai, nama FROM kegiatan WHERE id = ?').get(id) as { seri_id: number | null; tanggal_mulai: string; nama: string } | undefined;
  if (!k?.seri_id) throw new GagalError('Kegiatan ini bukan kegiatan bulanan.');
  const tujuan = db.prepare('SELECT id FROM kegiatan WHERE seri_id = ? AND tanggal_mulai > ? AND dihapus IS NULL').all(k.seri_id, k.tanggal_mulai) as { id: number }[];
  if (!tujuan.length) throw new GagalError('Tidak ada bulan berikutnya dalam seri ini.');
  let jumlah = 0;
  transaksi(() => {
    for (const t of tujuan) {
      const r = db.prepare(
        `INSERT OR IGNORE INTO penugasan (kegiatan_id, mitra_id, peran, volume, tarif, dibuat_oleh)
         SELECT ?, p.mitra_id, p.peran, ${salin_volume ? 'p.volume' : '0'}, p.tarif, ? FROM penugasan p
         JOIN mitra m ON m.id = p.mitra_id WHERE p.kegiatan_id = ? AND m.dihapus IS NULL`,
      ).run(t.id, c.get('pengguna').nama, id);
      jumlah += Number(r.changes);
    }
  });
  catat(c.get('pengguna').nama, 'Salin petugas ke bulan berikutnya', `${k.nama}: ${jumlah} penugasan ke ${tujuan.length} bulan`);
  return c.json({ jumlah, bulan: tujuan.length });
});

/* =============================== PENUGASAN =============================== */
type ItemTugas = { mitra_id: number; peran: string; volume?: number; tarif?: number; catatan?: string };

data.post('/kegiatan/:id/petugas', async (c) => {
  const id = Number(c.req.param('id'));
  const { items } = (await c.req.json()) as { items: ItemTugas[] };
  const k = db.prepare('SELECT nama, tarif FROM kegiatan WHERE id = ?').get(id) as { nama: string; tarif: string } | undefined;
  if (!k) throw new GagalError('Kegiatan tidak ditemukan.', 404);
  if (!items?.length) throw new GagalError('Belum ada mitra yang dipilih.');
  const tarif = JSON.parse(k.tarif || '{}') as Record<string, number>;
  transaksi(() => {
    const st = db.prepare(
      `INSERT INTO penugasan (kegiatan_id, mitra_id, peran, volume, tarif, catatan, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kegiatan_id, mitra_id, peran) DO UPDATE SET volume = excluded.volume, tarif = excluded.tarif, catatan = excluded.catatan`,
    );
    const oleh = c.get('pengguna').nama;
    for (const it of items) {
      if (!it.peran) throw new GagalError('Peran petugas wajib dipilih.');
      st.run(id, it.mitra_id, it.peran, Number(it.volume ?? 0), Number(it.tarif ?? tarif[it.peran] ?? 0), teks(it.catatan), oleh);
    }
  });
  catat(c.get('pengguna').nama, 'Tambah petugas', `${items.length} mitra → ${k.nama}`);
  return c.json({ ok: true, jumlah: items.length });
});

data.put('/petugas/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json();
  const lama = db.prepare('SELECT * FROM penugasan WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!lama) throw new GagalError('Data penugasan tidak ditemukan.', 404);
  try {
    db.prepare('UPDATE penugasan SET peran = ?, volume = ?, tarif = ?, catatan = ? WHERE id = ?').run(
      String(b.peran ?? lama.peran), Number(b.volume ?? lama.volume), Number(b.tarif ?? lama.tarif),
      b.catatan === undefined ? (lama.catatan as string | null) : teks(b.catatan), id);
  } catch {
    throw new GagalError('Mitra ini sudah memiliki peran tersebut di kegiatan ini.');
  }
  return c.json({ ok: true });
});

data.delete('/petugas/:id', (c) => {
  const id = Number(c.req.param('id'));
  const lama = db.prepare('SELECT * FROM penugasan WHERE id = ?').get(id);
  db.prepare('DELETE FROM penugasan WHERE id = ?').run(id);
  catat(c.get('pengguna').nama, 'Hapus petugas', `penugasan #${id}`);
  return c.json({ ok: true, lama });
});

const PETA_IMPOR_TUGAS: Record<string, string[]> = {
  nama: ['nama', 'nama mitra', 'nama petugas'],
  sobat_id: ['sobat id', 'id sobat', 'sobat', 'id mitra'],
  peran: ['peran', 'jabatan', 'posisi', 'tugas'],
  volume: ['volume', 'jumlah', 'beban kerja', 'target', 'jumlah satuan'],
};
data.post('/kegiatan/:id/petugas-impor', async (c) => {
  const id = Number(c.req.param('id'));
  const k = db.prepare('SELECT nama, tarif FROM kegiatan WHERE id = ?').get(id) as { nama: string; tarif: string } | undefined;
  if (!k) throw new GagalError('Kegiatan tidak ditemukan.', 404);
  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  if (!file || typeof file === 'string') throw new GagalError('Pilih file Excel (.xlsx) atau CSV terlebih dahulu.');
  const rows = await bacaExcel(await file.arrayBuffer(), PETA_IMPOR_TUGAS, file.name);
  const tarif = JSON.parse(k.tarif || '{}') as Record<string, number>;
  const peranAwal = Object.keys(tarif)[0] ?? ambilPengaturan().daftar_peran[0];
  const tidakKetemu: string[] = [];
  let masuk = 0;
  transaksi(() => {
    for (const r of rows) {
      const m = ((r.sobat_id && db.prepare('SELECT id FROM mitra WHERE sobat_id = ? AND dihapus IS NULL').get(r.sobat_id)) ||
        (r.nama && db.prepare('SELECT id FROM mitra WHERE nama = ? COLLATE NOCASE AND dihapus IS NULL').get(r.nama))) as { id: number } | undefined;
      if (!m) { tidakKetemu.push(r.nama || r.sobat_id || '(tanpa nama)'); continue; }
      const peran = r.peran || peranAwal;
      db.prepare(
        `INSERT INTO penugasan (kegiatan_id, mitra_id, peran, volume, tarif, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(kegiatan_id, mitra_id, peran) DO UPDATE SET volume = excluded.volume`,
      ).run(id, m.id, peran, Number(String(r.volume || '0').replace(',', '.')) || 0, tarif[peran] ?? 0, c.get('pengguna').nama);
      masuk++;
    }
  });
  catat(c.get('pengguna').nama, 'Impor petugas', `${masuk} → ${k.nama}`);
  return c.json({ masuk, tidakKetemu });
});

data.get('/kegiatan/:id/ekspor', async (c) => {
  const id = Number(c.req.param('id'));
  const k = db.prepare('SELECT * FROM kegiatan WHERE id = ?').get(id) as Record<string, string>;
  if (!k) throw new GagalError('Kegiatan tidak ditemukan.', 404);
  const rows = db
    .prepare(
      `SELECT m.nama, m.sobat_id, m.kecamatan, m.desa, m.no_hp, p.peran, p.volume, p.tarif, (p.volume*p.tarif) AS honor
       FROM penugasan p JOIN mitra m ON m.id = p.mitra_id WHERE p.kegiatan_id = ? ORDER BY p.peran, m.nama`,
    )
    .all(id) as Record<string, unknown>[];
  const buf = await buatExcel(
    'Petugas',
    [
      { judul: 'Nama', kunci: 'nama', lebar: 28 }, { judul: 'SOBAT ID', kunci: 'sobat_id' }, { judul: 'Peran', kunci: 'peran', lebar: 12 },
      { judul: 'Kecamatan', kunci: 'kecamatan' }, { judul: 'Desa', kunci: 'desa' }, { judul: 'No HP', kunci: 'no_hp' },
      { judul: `Volume (${k.satuan})`, kunci: 'volume', lebar: 12 }, { judul: 'Tarif', kunci: 'tarif', uang: true },
      { judul: 'Honor', kunci: 'honor', uang: true },
    ],
    rows,
    `${k.nama} — bulan kegiatan ${labelBulan(k.bulan_kegiatan)}, dibayar ${labelBulan(k.bulan_honor)}`,
  );
  return unduh(c, buf, `Petugas ${k.nama}.xlsx`);
});

/**
 * Daftar seluruh penugasan mitra pada satu BULAN KEGIATAN (bulan honor) — untuk tombol "Cek kegiatan mitra".
 * Dipakai agar beberapa pegawai yang mengisi kegiatan berbeda bisa melihat mitra sudah dialokasikan di mana saja.
 */
data.get('/alokasi-bulan', (c) => {
  const bulan = c.req.query('bulan') ?? '';
  if (!/^\d{4}-\d{2}$/.test(bulan)) throw new GagalError('Bulan tidak valid.');
  // Rentang tanggal pelaksanaan yang dicek (bawaan: satu bulan penuh). Kegiatan yang tanggalnya beririsan ikut ditampilkan.
  const dari = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('dari') ?? '') ? c.req.query('dari')! : `${bulan}-01`;
  const sampai = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('sampai') ?? '') ? c.req.query('sampai')! : akhirBulan(bulan);
  const rows = db
    .prepare(
      `SELECT p.id, p.mitra_id, m.nama, m.sobat_id, k.id AS kegiatan_id, k.nama AS kegiatan, k.tanggal_mulai, k.tanggal_selesai,
              k.bulan_kegiatan, k.bulan_honor, k.satuan, p.peran, p.volume, p.tarif, (p.volume * p.tarif) AS honor, p.dibuat_oleh, p.dibuat
       FROM penugasan p JOIN kegiatan k ON k.id = p.kegiatan_id JOIN mitra m ON m.id = p.mitra_id
       WHERE k.dihapus IS NULL AND m.dihapus IS NULL AND k.tanggal_mulai <= ? AND k.tanggal_selesai >= ?
       ORDER BY m.nama COLLATE NOCASE, k.tanggal_mulai`,
    )
    .all(sampai, dari);
  const nomor = Object.fromEntries(
    (db.prepare('SELECT mitra_id, urut FROM nomor_dokumen WHERE bulan = ?').all(bulan) as { mitra_id: number; urut: number }[]).map((r) => [r.mitra_id, r.urut]),
  );
  const p = ambilPengaturan();
  return c.json({
    bulan, dari, sampai, rows, sbml: sbmlBulan(bulan), ambang: p.ambang_sbml,
    nomor: Object.fromEntries(Object.entries(nomor).map(([id, u]) => [id, isiNomor(p.format_nomor_spk, u, bulan)])),
  });
});

/* =============================== HAPUS BANYAK & RESET (khusus admin) =============================== */
const daftarId = (v: unknown) => {
  const ids = Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : [];
  if (!ids.length) throw new GagalError('Belum ada data yang dipilih.');
  return ids;
};
const tanda = (ids: number[]) => ids.map(() => '?').join(',');

/** Hapus banyak = dipindah ke tempat sampah (bisa dipulihkan). */
for (const tabel of ['mitra', 'kegiatan'] as const) {
  data.post(`/${tabel}/hapus-banyak`, wajibAdmin, async (c) => {
    const ids = daftarId((await c.req.json()).ids);
    const r = db.prepare(`UPDATE ${tabel} SET dihapus = datetime('now','localtime') WHERE dihapus IS NULL AND id IN (${tanda(ids)})`).run(...ids);
    catat(c.get('pengguna').nama, `Hapus banyak ${tabel}`, `${r.changes} data`);
    return c.json({ jumlah: Number(r.changes) });
  });
  data.post(`/${tabel}/pulihkan-banyak`, wajibAdmin, async (c) => {
    const ids = daftarId((await c.req.json()).ids);
    const r = db.prepare(`UPDATE ${tabel} SET dihapus = NULL WHERE id IN (${tanda(ids)})`).run(...ids);
    catat(c.get('pengguna').nama, `Pulihkan banyak ${tabel}`, `${r.changes} data`);
    return c.json({ jumlah: Number(r.changes) });
  });
}

data.get('/reset/ringkasan', wajibAdmin, (c) => {
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return c.json({
    mitra: n('SELECT COUNT(*) n FROM mitra'), kegiatan: n('SELECT COUNT(*) n FROM kegiatan'), penugasan: n('SELECT COUNT(*) n FROM penugasan'),
  });
});

/**
 * RESET DATA — menghapus PERMANEN mitra dan/atau kegiatan (termasuk yang di tempat sampah).
 * Sebelum menghapus, server selalu membuat file cadangan sehingga masih bisa dipulihkan dari Pengaturan → Cadangan data.
 */
data.post('/reset', wajibAdmin, async (c) => {
  const b = (await c.req.json()) as { mitra?: boolean; kegiatan?: boolean; konfirmasi?: string };
  if (!b.mitra && !b.kegiatan) throw new GagalError('Pilih data yang ingin direset.');
  if (String(b.konfirmasi ?? '').trim().toUpperCase() !== 'HAPUS SEMUA') throw new GagalError('Ketik HAPUS SEMUA untuk mengonfirmasi.');
  const cadangan = simpanCadanganKeFile('sebelum-reset');
  const hasil = transaksi(() => {
    const out: Record<string, number> = {};
    out.penugasan = Number(db.prepare('DELETE FROM penugasan').run().changes);
    db.exec('DELETE FROM nomor_dokumen; DELETE FROM spk_bulan;');
    if (b.kegiatan) out.kegiatan = Number(db.prepare('DELETE FROM kegiatan').run().changes);
    if (b.mitra) out.mitra = Number(db.prepare('DELETE FROM mitra').run().changes);
    return out;
  });
  catat(c.get('pengguna').nama, 'RESET DATA', `${b.mitra ? 'mitra ' : ''}${b.kegiatan ? 'kegiatan ' : ''}— cadangan: ${cadangan}`);
  return c.json({ ...hasil, cadangan });
});

/* =============================== PENCARIAN CEPAT =============================== */
data.get('/cari', (c) => {
  const q = `%${(c.req.query('q') ?? '').trim()}%`;
  const mitra = db.prepare("SELECT id, nama, sobat_id, kecamatan FROM mitra WHERE dihapus IS NULL AND (nama LIKE ? OR sobat_id LIKE ? OR nik LIKE ?) ORDER BY nama LIMIT 6").all(q, q, q);
  const kegiatan = db.prepare("SELECT id, nama, bulan_honor, bulan_kegiatan FROM kegiatan WHERE dihapus IS NULL AND (nama LIKE ? OR singkatan LIKE ?) ORDER BY tanggal_mulai DESC LIMIT 6").all(q, q);
  return c.json({ mitra, kegiatan });
});

/**
 * UNDUHAN FILE
 * Agar unduhan selalu berhasil di semua browser, file tidak dikirim lewat JavaScript.
 * Aplikasi web meminta file dengan header "X-Siapkan: 1"; server menyimpan file sementara (15 menit)
 * dan membalas alamat unduhan. Browser lalu mengunduh langsung dari alamat itu seperti unduhan biasa
 * (nama file benar, bisa "Coba lagi", aman walau jendela "Simpan sebagai" dibiarkan terbuka lama).
 */
const MASA_SIMPAN_UNDUHAN = 15 * 60e3;
const unduhanSementara = new Map<string, { buf: Uint8Array; nama: string; tipe: string; sampai: number }>();

export function unduh(c: Context, buf: Uint8Array, nama: string, tipe?: string) {
  const jenis = tipe ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (c.req.header('x-siapkan') === '1') {
    const sekarang = Date.now();
    for (const [k, v] of unduhanSementara) if (v.sampai < sekarang) unduhanSementara.delete(k);
    const token = crypto.randomBytes(24).toString('hex');
    unduhanSementara.set(token, { buf, nama, tipe: jenis, sampai: sekarang + MASA_SIMPAN_UNDUHAN });
    return c.json({ url: `/api/unduh/${token}/${encodeURIComponent(nama)}`, nama });
  }
  return kirimFile(c, buf, nama, jenis);
}

export function kirimFile(c: Context, buf: Uint8Array, nama: string, tipe: string) {
  const ascii = nama.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
  return c.body(buf as Uint8Array<ArrayBuffer>, 200, {
    'Content-Type': tipe,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nama)}`,
    'Content-Length': String(buf.byteLength),
    'Cache-Control': 'no-store',
  });
}

export function ambilUnduhan(token: string) {
  const u = unduhanSementara.get(token);
  if (!u || u.sampai < Date.now()) return null;
  return u;
}
