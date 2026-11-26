/**
 * DOKUMEN SPK & BAST
 * ------------------
 * Dokumen dibuat dari template Word (.docx) yang berisi penanda seperti ${nama_mitra}.
 * Template bawaan ada di folder /templates. Template dapat diganti dari menu
 * Pengaturan → Template Dokumen tanpa mengubah kode (cukup edit di Microsoft Word).
 */
import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { db, ambilPengaturan, catat, TEMPLATE_DIR, transaksi } from '../db.ts';
import type { Env } from '../auth.ts';
import { rekapBulan } from './laporan.ts';
import { unduh } from './data.ts';
import { akhirBulan, angka, GagalError, hari, isiNomor, labelBulan, namaBulan, rupiah, tanggalPanjang, terbilang, keTanggal } from '../util.ts';

export const dokumen = new Hono<Env>();

export const JENIS_TEMPLATE = ['spk', 'bast'] as const;
export type JenisTemplate = (typeof JENIS_TEMPLATE)[number];
const FOLDER_BAWAAN = path.resolve(import.meta.dirname, '../../templates');

export const fileTemplate = (jenis: JenisTemplate) => {
  const khusus = path.join(TEMPLATE_DIR, `${jenis}.docx`);
  return fs.existsSync(khusus) ? khusus : path.join(FOLDER_BAWAAN, `${jenis}.docx`);
};
export const fileTemplateBawaan = (jenis: JenisTemplate) => path.join(FOLDER_BAWAAN, `${jenis}.docx`);

/** Daftar penanda yang tersedia — ditampilkan juga di menu Pengaturan agar mudah diedit. */
export const PENANDA = {
  umum: {
    nama_kantor: 'Nama kantor', wilayah: 'Nama wilayah', alamat_kantor: 'Alamat kantor',
    ppk_nama: 'Nama PPK', ppk_nip: 'NIP PPK', ppk_jabatan: 'Jabatan PPK',
  },
  spk: {
    '#mitra … /mitra': 'Pengulangan: satu salinan dokumen untuk setiap mitra',
    nomor_spk: 'Nomor SPK', hari_spk: 'Hari tanda tangan (mis. Senin)', tanggal_spk: 'Tanggal dalam kata (mis. dua)',
    tanggal_spk_angka: 'Tanggal lengkap (mis. 2 Maret 2026)', bulan_spk: 'Nama bulan', tahun_kegiatan: 'Tahun (angka)',
    tahun_kata: 'Tahun dalam kata', nama_mitra: 'Nama mitra', alamat_mitra: 'Alamat mitra', sobat_id: 'SOBAT ID',
    nik: 'NIK', tanggal_mulai_spk: 'Awal jangka waktu', tanggal_berakhir_spk: 'Akhir jangka waktu',
    honorMitraTotal: 'Total honor (Rp…,-)', terbilang_honor_total: 'Total honor dalam kata',
    '#tugas … /tugas': 'Pengulangan baris tabel: satu baris per kegiatan',
    no: 'Nomor baris', kegiatanMitra: 'Nama kegiatan', peran: 'Peran (PPL/PML/…)', uraian: 'Peran + nama kegiatan',
    tanggal_mulai_kegiatan: 'Tanggal mulai kegiatan', tanggal_berakhir_kegiatan: 'Tanggal selesai kegiatan',
    volume_satuan: 'Volume', jenis_pembayaran: 'Satuan', hargaSatuan: 'Harga satuan', honorMitra: 'Honor baris ini',
    bebanAnggaran: 'Kode beban anggaran (MAK)',
  },
  bast: {
    '#mitra … /mitra': 'Pengulangan: satu salinan dokumen untuk setiap mitra',
    nomor_bast: 'Nomor BAST', nomor_spk: 'Nomor SPK terkait', hari_bast: 'Hari BAST', tanggal_bast: 'Tanggal dalam kata',
    tanggal_ttd: 'Tanggal BAST lengkap', bulan_bast: 'Nama bulan BAST', tahun_kegiatan: 'Tahun', tahun_kata: 'Tahun dalam kata',
    tanggal_spk: 'Tanggal SPK lengkap', nama_mitra: 'Nama mitra', alamat_mitra: 'Alamat mitra', honorMitraTotal: 'Total honor',
    terbilang_honor_total: 'Total honor dalam kata',
    '#tugas … /tugas': 'Pengulangan baris tabel', no: 'Nomor baris', kegiatanMitra: 'Nama kegiatan', peran: 'Peran',
    uraian: 'Peran + nama kegiatan', volume_satuan: 'Volume', jenis_pembayaran: 'Satuan', hargaSatuan: 'Harga satuan',
    honorMitra: 'Honor baris ini',
  },
};

function isiTemplate(berkas: Buffer, data: Record<string, unknown>) {
  const zip = new PizZip(berkas);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '${', end: '}' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render(data);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}

/** Ubah pesan galat docxtemplater menjadi kalimat yang mudah dipahami. */
export function jelaskanGalatTemplate(e: unknown): string {
  const err = e as { properties?: { errors?: { properties?: { explanation?: string; xtag?: string } }[] }; message?: string };
  const daftar = err.properties?.errors?.map((x) => x.properties?.explanation ?? '').filter(Boolean) ?? [];
  return daftar.length ? 'Template bermasalah: ' + daftar.slice(0, 3).join(' | ') : `Template bermasalah: ${err.message}`;
}

/** Memeriksa template sebelum dipakai: penanda harus utuh dan dikenal. */
export function ujiTemplate(berkas: Buffer, jenis: JenisTemplate) {
  const zip = new PizZip(berkas);
  const dikenal = new Set(['mitra', 'tugas']);
  for (const k of [...Object.keys(PENANDA.umum), ...Object.keys(PENANDA[jenis])]) if (!k.includes('…')) dikenal.add(k);
  const masalah: string[] = [];
  for (const nama of Object.keys(zip.files).filter((f) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(f))) {
    const teks = zip.file(nama)!.asText().replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
    let i = teks.indexOf('${');
    while (i >= 0) {
      const akhir = teks.indexOf('}', i);
      const isi = akhir < 0 ? teks.slice(i + 2, i + 30) : teks.slice(i + 2, akhir);
      const bersih = isi.replace(/^[#/]/, '');
      if (akhir < 0 || isi.includes('${') || isi.includes('\n') || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(bersih)) {
        masalah.push(`penanda "\${${isi.slice(0, 25)}…" tidak ditutup dengan "}" atau berisi karakter tidak sah`);
      } else if (!dikenal.has(bersih)) {
        masalah.push(`penanda "\${${isi}}" tidak dikenal (cek ejaan, huruf besar/kecil berpengaruh)`);
      }
      i = teks.indexOf('${', i + 2);
    }
  }
  if (masalah.length) throw new GagalError('Template bermasalah: ' + [...new Set(masalah)].slice(0, 4).join('; ') + '.');
  try {
    isiTemplate(berkas, { mitra: [{ tugas: [{}] }] });
  } catch (e) {
    throw new GagalError(jelaskanGalatTemplate(e));
  }
}

/** Nomor urut dokumen per mitra per bulan — tetap sama walau dokumen dibuat ulang. */
function nomorUrut(bulan: string, mitraIds: number[], namaUrut: Map<number, string>) {
  return transaksi(() => {
    const ada = new Map(
      (db.prepare('SELECT mitra_id, urut FROM nomor_dokumen WHERE bulan = ?').all(bulan) as { mitra_id: number; urut: number }[]).map((r) => [r.mitra_id, r.urut]),
    );
    let maks = Math.max(0, ...ada.values());
    const belum = mitraIds.filter((id) => !ada.has(id)).sort((a, b) => (namaUrut.get(a) ?? '').localeCompare(namaUrut.get(b) ?? '', 'id'));
    const st = db.prepare('INSERT INTO nomor_dokumen (bulan, mitra_id, urut) VALUES (?, ?, ?)');
    for (const id of belum) {
      maks++;
      st.run(bulan, id, maks);
      ada.set(id, maks);
    }
    return ada;
  });
}

function ambilBaris(bulan: string, mitraIds?: number[], kegiatanId?: number) {
  let baris = rekapBulan(bulan);
  if (mitraIds?.length) baris = baris.filter((b) => mitraIds.includes(b.mitra_id));
  if (kegiatanId) baris = baris.map((b) => ({ ...b, tugas: b.tugas.filter((t) => t.kegiatan_id === kegiatanId) })).filter((b) => b.tugas.length);
  return baris;
}

dokumen.get('/dokumen/pratinjau', (c) => {
  const bulan = c.req.query('bulan')!;
  if (!/^\d{4}-\d{2}$/.test(bulan ?? '')) throw new GagalError('Bulan tidak valid.');
  const baris = rekapBulan(bulan);
  const nomor = new Map(
    (db.prepare('SELECT mitra_id, urut FROM nomor_dokumen WHERE bulan = ?').all(bulan) as { mitra_id: number; urut: number }[]).map((r) => [r.mitra_id, r.urut]),
  );
  const spk = db.prepare('SELECT * FROM spk_bulan WHERE bulan = ?').get(bulan) ?? null;
  const p = ambilPengaturan();
  return c.json({
    bulan, spk,
    mitra: baris.map((b) => ({
      mitra_id: b.mitra_id, nama: b.nama, total: b.total, jumlah_tugas: b.tugas.length,
      kegiatan: [...new Set(b.tugas.map((t) => t.kegiatan_id))],
      urut: nomor.get(b.mitra_id) ?? null,
      nomor_spk: nomor.has(b.mitra_id) ? isiNomor(p.format_nomor_spk, nomor.get(b.mitra_id)!, bulan) : null,
    })),
  });
});

dokumen.post('/dokumen/reset-nomor', async (c) => {
  const { bulan } = await c.req.json();
  db.prepare('DELETE FROM nomor_dokumen WHERE bulan = ?').run(bulan);
  catat(c.get('pengguna').nama, 'Atur ulang nomor dokumen', labelBulan(bulan));
  return c.json({ ok: true });
});

dokumen.post('/dokumen/spk', async (c) => {
  const b = (await c.req.json()) as { bulan: string; tanggal_spk: string; tanggal_mulai?: string; tanggal_selesai?: string; mitra_ids?: number[] };
  if (!/^\d{4}-\d{2}$/.test(b.bulan ?? '')) throw new GagalError('Bulan tidak valid.');
  if (!b.tanggal_spk) throw new GagalError('Tanggal SPK wajib diisi.');
  const mulai = b.tanggal_mulai || b.tanggal_spk;
  const selesai = b.tanggal_selesai || akhirBulan(b.bulan);
  const baris = ambilBaris(b.bulan, b.mitra_ids);
  if (!baris.length) throw new GagalError(`Belum ada mitra dengan honor pada ${labelBulan(b.bulan)}.`);
  db.prepare(
    'INSERT INTO spk_bulan VALUES (?, ?, ?, ?) ON CONFLICT(bulan) DO UPDATE SET tanggal_spk=excluded.tanggal_spk, tanggal_mulai=excluded.tanggal_mulai, tanggal_selesai=excluded.tanggal_selesai',
  ).run(b.bulan, b.tanggal_spk, mulai, selesai);
  const p = ambilPengaturan();
  const urut = nomorUrut(b.bulan, baris.map((x) => x.mitra_id), new Map(baris.map((x) => [x.mitra_id, x.nama])));
  baris.sort((a, z) => urut.get(a.mitra_id)! - urut.get(z.mitra_id)!);
  const tahun = keTanggal(b.tanggal_spk).getUTCFullYear();
  const infoKegiatan = new Map(
    (db.prepare('SELECT id, tanggal_mulai, tanggal_selesai, mak FROM kegiatan').all() as { id: number; tanggal_mulai: string; tanggal_selesai: string; mak: string }[]).map((k) => [k.id, k]),
  );
  const detailMitra = new Map((db.prepare('SELECT id, alamat, nik, sobat_id FROM mitra').all() as { id: number; alamat: string; nik: string; sobat_id: string }[]).map((m) => [m.id, m]));
  const data = {
    ...umum(p),
    mitra: baris.map((m) => ({
      nomor_spk: isiNomor(p.format_nomor_spk, urut.get(m.mitra_id)!, b.bulan),
      hari_spk: hari(b.tanggal_spk),
      tanggal_spk: terbilang(keTanggal(b.tanggal_spk).getUTCDate()),
      tanggal_spk_angka: tanggalPanjang(b.tanggal_spk),
      bulan_spk: namaBulan(b.tanggal_spk),
      tahun_kegiatan: String(tahun),
      tahun_kata: terbilang(tahun),
      nama_mitra: m.nama,
      alamat_mitra: detailMitra.get(m.mitra_id)?.alamat ?? '',
      nik: detailMitra.get(m.mitra_id)?.nik ?? '',
      sobat_id: m.sobat_id ?? '',
      tanggal_mulai_spk: tanggalPanjang(mulai),
      tanggal_berakhir_spk: tanggalPanjang(selesai),
      honorMitraTotal: rupiah(m.total),
      terbilang_honor_total: terbilang(m.total) + ' rupiah',
      tugas: m.tugas.map((t, i) => {
        const k = infoKegiatan.get(t.kegiatan_id);
        return {
          no: i + 1, kegiatanMitra: t.kegiatan, peran: t.peran, uraian: `${t.peran} ${t.kegiatan}`,
          tanggal_mulai_kegiatan: k ? tanggalPanjang(k.tanggal_mulai) : '', tanggal_berakhir_kegiatan: k ? tanggalPanjang(k.tanggal_selesai) : '',
          volume_satuan: angka(t.volume), jenis_pembayaran: t.satuan, hargaSatuan: rupiah(t.tarif), honorMitra: rupiah(t.honor),
          bebanAnggaran: k?.mak ?? '',
        };
      }),
    })),
  };
  let hasil: Buffer;
  try {
    hasil = isiTemplate(fs.readFileSync(fileTemplate('spk')), data);
  } catch (e) {
    throw new GagalError(jelaskanGalatTemplate(e));
  }
  catat(c.get('pengguna').nama, 'Buat SPK', `${labelBulan(b.bulan)} — ${baris.length} mitra`);
  const nama = baris.length === 1 ? `SPK ${baris[0].nama} - ${labelBulan(b.bulan)}.docx` : `SPK ${labelBulan(b.bulan)}.docx`;
  return unduh(c, hasil, nama, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

dokumen.post('/dokumen/bast', async (c) => {
  const b = (await c.req.json()) as { bulan: string; tanggal_bast: string; tanggal_spk?: string; kegiatan_id?: number; mitra_ids?: number[] };
  if (!/^\d{4}-\d{2}$/.test(b.bulan ?? '')) throw new GagalError('Bulan tidak valid.');
  if (!b.tanggal_bast) throw new GagalError('Tanggal BAST wajib diisi.');
  const spk = db.prepare('SELECT * FROM spk_bulan WHERE bulan = ?').get(b.bulan) as { tanggal_spk: string } | undefined;
  const tglSpk = b.tanggal_spk || spk?.tanggal_spk;
  if (!tglSpk) throw new GagalError('Tanggal SPK belum diketahui. Buat SPK bulan ini terlebih dahulu atau isi tanggal SPK.');
  const semua = ambilBaris(b.bulan);
  const baris = ambilBaris(b.bulan, b.mitra_ids, b.kegiatan_id ? Number(b.kegiatan_id) : undefined);
  if (!baris.length) throw new GagalError('Tidak ada mitra yang sesuai pilihan.');
  const p = ambilPengaturan();
  // nomor urut mengikuti SPK (semua mitra bulan itu), supaya nomor BAST = nomor SPK
  const urut = nomorUrut(b.bulan, semua.map((x) => x.mitra_id), new Map(semua.map((x) => [x.mitra_id, x.nama])));
  baris.sort((a, z) => urut.get(a.mitra_id)! - urut.get(z.mitra_id)!);
  const tahun = keTanggal(b.tanggal_bast).getUTCFullYear();
  const alamat = new Map((db.prepare('SELECT id, alamat FROM mitra').all() as { id: number; alamat: string }[]).map((m) => [m.id, m.alamat]));
  const data = {
    ...umum(p),
    mitra: baris.map((m) => ({
      nomor_bast: isiNomor(p.format_nomor_bast, urut.get(m.mitra_id)!, b.bulan),
      nomor_spk: isiNomor(p.format_nomor_spk, urut.get(m.mitra_id)!, b.bulan),
      hari_bast: hari(b.tanggal_bast),
      tanggal_bast: terbilang(keTanggal(b.tanggal_bast).getUTCDate()),
      tanggal_ttd: tanggalPanjang(b.tanggal_bast),
      bulan_bast: namaBulan(b.tanggal_bast),
      tahun_kegiatan: String(tahun),
      tahun_kata: terbilang(tahun),
      tanggal_spk: tanggalPanjang(tglSpk),
      nama_mitra: m.nama,
      alamat_mitra: alamat.get(m.mitra_id) ?? '',
      honorMitraTotal: rupiah(m.tugas.reduce((s, t) => s + t.honor, 0)),
      terbilang_honor_total: terbilang(m.tugas.reduce((s, t) => s + t.honor, 0)) + ' rupiah',
      tugas: m.tugas.map((t, i) => ({
        no: i + 1, kegiatanMitra: t.kegiatan, peran: t.peran, uraian: `${t.peran} ${t.kegiatan}`,
        volume_satuan: angka(t.volume), jenis_pembayaran: t.satuan, hargaSatuan: rupiah(t.tarif), honorMitra: rupiah(t.honor),
      })),
    })),
  };
  let hasil: Buffer;
  try {
    hasil = isiTemplate(fs.readFileSync(fileTemplate('bast')), data);
  } catch (e) {
    throw new GagalError(jelaskanGalatTemplate(e));
  }
  const kg = b.kegiatan_id ? (db.prepare('SELECT nama FROM kegiatan WHERE id = ?').get(b.kegiatan_id) as { nama: string })?.nama : null;
  catat(c.get('pengguna').nama, 'Buat BAST', `${kg ?? 'Semua kegiatan'} ${labelBulan(b.bulan)} — ${baris.length} mitra`);
  const nama = `BAST ${kg ? kg + ' ' : ''}${baris.length === 1 ? baris[0].nama + ' ' : ''}- ${labelBulan(b.bulan)}.docx`;
  return unduh(c, hasil, nama, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

function umum(p: ReturnType<typeof ambilPengaturan>) {
  return {
    nama_kantor: p.nama_kantor, wilayah: p.wilayah, alamat_kantor: p.alamat_kantor,
    ppk_nama: p.ppk_nama, ppk_nip: p.ppk_nip, ppk_jabatan: p.ppk_jabatan,
  };
}
