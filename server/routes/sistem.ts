/** PENGATURAN, PENGGUNA, BATAS HONOR, TEMPLATE DOKUMEN, CADANGAN DATA, RIWAYAT */
import crypto from 'node:crypto';
import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import { db, ambilPengaturan, simpanPengaturan, catat, transaksi, isiCadangan, pulihkanCadangan, validasiCadangan, bacaIsiCadangan, verifikasiRiwayat, GagalCadangan, BACKUP_DIR, TEMPLATE_DIR, PENGATURAN_AWAL } from '../db.ts';
import { adaKunciServer, EKSTENSI_TERENKRIPSI, kunciDenganSandi } from '../enkripsi.ts';
import { s3Aktif } from '../s3.ts';
import { cekSandiBaru } from '../sandi.ts';
import { bacaSesi } from '../auth.ts';
import { wajibAdmin, hashSandi, cocokSandi, cabutSemuaSesi, buatSesi, type Env } from '../auth.ts';
import { GagalError } from '../util.ts';
import { unduh, siapkanUnduhan } from './data.ts';
import { bacaExcel, buatExcel } from '../excel.ts';
import { fileTemplate, fileTemplateBawaan, JENIS_TEMPLATE, PENANDA, ujiTemplate, type JenisTemplate } from './dokumen.ts';

export const sistem = new Hono<Env>();

/* ---------- Pengaturan umum ---------- */
sistem.get('/pengaturan', (c) => c.json(ambilPengaturan()));
sistem.put('/pengaturan', wajibAdmin, async (c) => {
  const b = await c.req.json();
  const izin = Object.keys(PENGATURAN_AWAL);
  const bersih = Object.fromEntries(Object.entries(b).filter(([k]) => izin.includes(k)));
  if ('jeda_pembayaran' in bersih) {
    const j = Number(bersih.jeda_pembayaran);
    if (!(j >= 0 && j <= 6)) throw new GagalError('Jeda bulan pembayaran harus 0 sampai 6 bulan.');
    bersih.jeda_pembayaran = Math.round(j);
  }
  if ('ambang_sbml' in bersih) {
    const a = Number(bersih.ambang_sbml);
    if (!(a >= 10 && a <= 100)) throw new GagalError('Ambang peringatan SBML harus antara 10 dan 100 persen.');
    bersih.ambang_sbml = a;
  }
  if ('pendaftaran_terbuka' in bersih) bersih.pendaftaran_terbuka = bersih.pendaftaran_terbuka === true;
  if ('batas_ekspor_harian' in bersih) {
    const n = Number(bersih.batas_ekspor_harian);
    if (!(Number.isInteger(n) && n >= 1 && n <= 1000)) throw new GagalError('Batas ekspor harian harus 1 sampai 1000.');
    bersih.batas_ekspor_harian = n;
  }
  for (const k of ['daftar_peran', 'daftar_satuan', 'daftar_jenis']) {
    if (k in bersih) {
      const arr = [...new Set((bersih[k] as string[]).map((x) => String(x).trim()).filter(Boolean))];
      if (!arr.length) throw new GagalError('Daftar tidak boleh kosong.');
      bersih[k] = arr;
    }
  }
  const lamaTerbuka = ambilPengaturan().pendaftaran_terbuka;
  const hasil = simpanPengaturan(bersih);
  catat(c.get('pengguna').nama, 'Ubah pengaturan', lamaTerbuka !== hasil.pendaftaran_terbuka ? `pendaftaran ${hasil.pendaftaran_terbuka ? 'DIBUKA untuk umum' : 'ditutup (hanya undangan)'}` : undefined);
  return c.json(hasil);
});

/* ---------- SBML per peran per tahun ---------- */
sistem.get('/sbml', (c) => c.json(db.prepare('SELECT * FROM sbml ORDER BY tahun DESC, peran').all()));
/** Simpan SBML satu tahun: { tahun: 2026, nilai: { PPL: 3500000, PML: 4000000 } } (nilai kosong/0 = dihapus) */
sistem.put('/sbml', wajibAdmin, async (c) => {
  const { tahun, nilai } = (await c.req.json()) as { tahun: number; nilai: Record<string, number> };
  if (!Number(tahun) || Number(tahun) < 2000) throw new GagalError('Tahun tidak valid.');
  transaksi(() => {
    db.prepare('DELETE FROM sbml WHERE tahun = ?').run(Number(tahun));
    for (const [peran, n] of Object.entries(nilai ?? {})) {
      if (peran.trim() && Number(n) > 0) db.prepare('INSERT INTO sbml VALUES (?, ?, ?)').run(Number(tahun), peran.trim(), Number(n));
    }
  });
  catat(c.get('pengguna').nama, 'Ubah SBML', `${tahun}: ${Object.entries(nilai ?? {}).filter(([, n]) => Number(n) > 0).map(([p, n]) => `${p} ${n}`).join(', ') || 'dihapus'}`);
  return c.json({ ok: true });
});

/** Hapus SBML satu tahun (mis. karena salah isi) */
sistem.delete('/sbml/:tahun', wajibAdmin, (c) => {
  const tahun = Number(c.req.param('tahun'));
  if (!tahun) throw new GagalError('Tahun tidak valid.');
  const r = db.prepare('DELETE FROM sbml WHERE tahun = ?').run(tahun);
  db.prepare('DELETE FROM batas_honor WHERE tahun = ?').run(tahun);
  catat(c.get('pengguna').nama, 'Hapus SBML', `${tahun} (${r.changes} peran)`);
  return c.json({ jumlah: Number(r.changes) });
});

/* ---------- Pengguna ---------- */
sistem.get('/pengguna', wajibAdmin, (c) => c.json(db.prepare("SELECT id, username, nama, peran, status, dibuat, boleh_ekspor, totp_aktif, password_hash = '!' AS perlu_sandi FROM pengguna ORDER BY status DESC, nama").all()));
const PERAN = ['admin', 'operator', 'pengamat'];
const peranDari = (v: unknown) => (PERAN.includes(String(v)) ? String(v) : 'operator');
sistem.post('/pengguna', wajibAdmin, async (c) => {
  const b = await c.req.json();
  const nama = teks(b.nama), username = teks(b.username), sandi = typeof b.sandi === 'string' ? b.sandi : '';
  if (!username || !nama || !sandi) throw new GagalError('Nama, username, dan kata sandi wajib diisi.');
  if (nama.length > 100) throw new GagalError('Nama maksimal 100 karakter.');
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) throw new GagalError('Username 3–30 karakter, hanya huruf, angka, titik, garis bawah, atau strip.');
  const peranBaru = peranDari(b.peran);
  cekSandiBaru(sandi, username, peranBaru);
  const hash = await hashSandi(sandi);
  try {
    db.prepare('INSERT INTO pengguna (username, nama, password_hash, peran, boleh_ekspor) VALUES (?, ?, ?, ?, ?)').run(
      username, nama, hash, peranBaru, b.boleh_ekspor === false ? 0 : 1);
  } catch {
    throw new GagalError('Username sudah dipakai.');
  }
  catat(c.get('pengguna').nama, 'Tambah pengguna', username);
  return c.json({ ok: true });
});
sistem.put('/pengguna/:id', wajibAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json();
  const peran = peranDari(b.peran);
  if (peran !== 'admin') {
    const sisa = (db.prepare("SELECT COUNT(*) n FROM pengguna WHERE peran = 'admin' AND status = 'aktif' AND id <> ?").get(id) as { n: number }).n;
    if (!sisa) throw new GagalError('Harus ada minimal satu admin.');
  }
  const status = b.status === 'menunggu' ? 'menunggu' : 'aktif';
  if (id === c.get('pengguna').id && (status !== 'aktif' || peran !== 'admin')) throw new GagalError('Anda tidak dapat menonaktifkan atau menurunkan akun sendiri.');
  const nama = teks(b.nama);
  if (!nama || nama.length > 100) throw new GagalError('Nama wajib diisi (maksimal 100 karakter).');
  const lama = db.prepare('SELECT username, peran, status, boleh_ekspor, totp_aktif FROM pengguna WHERE id = ?').get(id) as { username: string; peran: string; status: string; boleh_ekspor: number; totp_aktif: number } | undefined;
  if (!lama) throw new GagalError('Pengguna tidak ditemukan.', 404);
  const sandi = typeof b.sandi === 'string' ? b.sandi : '';
  if (sandi) cekSandiBaru(sandi, lama.username, peran);
  const hash = sandi ? await hashSandi(sandi) : null;
  const bolehEkspor = b.boleh_ekspor === undefined ? lama.boleh_ekspor : b.boleh_ekspor ? 1 : 0;
  const matikan2fa = b.matikan_2fa === true && lama.totp_aktif === 1;
  const turunHak = (lama.peran === 'admin' && peran !== 'admin') || (lama.peran === 'operator' && peran === 'pengamat');
  transaksi(() => {
    db.prepare('UPDATE pengguna SET nama = ?, peran = ?, status = ?, boleh_ekspor = ? WHERE id = ?').run(nama, peran, status, bolehEkspor, id);
    if (hash) db.prepare('UPDATE pengguna SET password_hash = ? WHERE id = ?').run(hash, id);
    if (matikan2fa) db.prepare('UPDATE pengguna SET totp_aktif = 0, totp_rahasia = NULL WHERE id = ?').run(id);
    // sandi direset / hak diturunkan / dinonaktifkan / 2FA direset → pengguna itu keluar dari semua perangkat
    if (hash || turunHak || status !== 'aktif' || matikan2fa) cabutSemuaSesi(id);
  });
  catat(c.get('pengguna').nama, 'Ubah pengguna', `${nama}${hash ? ' (kata sandi direset)' : ''}${lama.peran !== peran ? ` (peran: ${lama.peran} → ${peran})` : ''}${bolehEkspor !== lama.boleh_ekspor ? ` (izin ekspor: ${bolehEkspor ? 'ya' : 'tidak'})` : ''}${matikan2fa ? ' (verifikasi 2 langkah direset)' : ''}`);
  return c.json({ ok: true });
});
sistem.delete('/pengguna/:id', wajibAdmin, (c) => {
  const id = Number(c.req.param('id'));
  if (id === c.get('pengguna').id) throw new GagalError('Anda tidak dapat menghapus akun sendiri.');
  const sisa = (db.prepare("SELECT COUNT(*) n FROM pengguna WHERE peran = 'admin' AND id <> ?").get(id) as { n: number }).n;
  if (!sisa) throw new GagalError('Harus ada minimal satu admin.');
  db.prepare('DELETE FROM pengguna WHERE id = ?').run(id);
  catat(c.get('pengguna').nama, 'Hapus pengguna', String(id));
  return c.json({ ok: true });
});
sistem.post('/pengguna/:id/setujui', wajibAdmin, (c) => {
  const id = Number(c.req.param('id'));
  db.prepare("UPDATE pengguna SET status = 'aktif' WHERE id = ?").run(id);
  const u = db.prepare('SELECT nama FROM pengguna WHERE id = ?').get(id) as { nama: string } | undefined;
  catat(c.get('pengguna').nama, 'Setujui pendaftaran', u?.nama);
  return c.json({ ok: true });
});
/* ---------- Undangan pendaftaran (khusus admin) ----------
 * Token acak 32 byte dikirim SEKALI ke admin (untuk dibagikan lewat WhatsApp dsb.), server hanya menyimpan hash-nya. */
export const MASA_UNDANGAN_JAM = 72;
export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
sistem.get('/undangan', wajibAdmin, (c) => c.json(db.prepare(
  "SELECT id, peran, untuk, dibuat_oleh, dibuat, kedaluwarsa FROM undangan WHERE dipakai IS NULL AND kedaluwarsa > datetime('now','localtime') ORDER BY id DESC",
).all()));
sistem.post('/undangan', wajibAdmin, async (c) => {
  const b = await c.req.json();
  const peran = peranDari(b.peran);
  const untuk = typeof b.untuk === 'string' ? b.untuk.trim().slice(0, 100) || null : null;
  const aktif = (db.prepare("SELECT COUNT(*) n FROM undangan WHERE dipakai IS NULL AND kedaluwarsa > datetime('now','localtime')").get() as { n: number }).n;
  if (aktif >= BATAS_UNDANGAN_AKTIF) throw new GagalError('Terlalu banyak undangan aktif. Batalkan undangan yang tidak dipakai terlebih dahulu.');
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare(`INSERT INTO undangan (hash_token, peran, untuk, dibuat_oleh, kedaluwarsa) VALUES (?, ?, ?, ?, datetime('now','localtime', '+${MASA_UNDANGAN_JAM} hours'))`)
    .run(hashToken(token), peran, untuk, c.get('pengguna').nama);
  catat(c.get('pengguna').nama, 'Buat undangan pendaftaran', `${peran}${untuk ? ` untuk ${untuk}` : ''}`);
  return c.json({ token, jam: MASA_UNDANGAN_JAM });
});
/* ---------- Undangan massal: unggah daftar pegawai (Excel/CSV) ---------- */
const BATAS_UNDANGAN_AKTIF = 500;
const MAKS_UNDANGAN_SEKALI = 200;
const PETA_UNDANGAN: Record<string, string[]> = {
  nama: ['nama', 'nama pegawai', 'nama lengkap'],
  peran: ['peran', 'role', 'hak akses'],
  no_wa: ['no wa', 'no whatsapp', 'whatsapp', 'no hp', 'nomor hp', 'hp', 'telepon'],
};
/** Nomor HP Indonesia → format internasional untuk tautan WhatsApp (0812… → 62812…) */
const nomorWa = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length < 9 || d.length > 15) return null;
  return d.startsWith('0') ? '62' + d.slice(1) : d.startsWith('8') ? '62' + d : d;
};
sistem.get('/undangan/contoh', wajibAdmin, async (c) => {
  const buf = await buatExcel('Pegawai', [
    { judul: 'Nama', kunci: 'nama', lebar: 30 }, { judul: 'Peran', kunci: 'peran', lebar: 14 }, { judul: 'No WA', kunci: 'no_wa', lebar: 18 },
  ], [
    { nama: 'Contoh Nama Pegawai', peran: 'operator', no_wa: '081234567890' },
    { nama: 'Contoh Pimpinan', peran: 'pengamat', no_wa: '' },
  ]);
  return unduh(c, buf, 'Contoh Undangan Pegawai.xlsx');
});
sistem.post('/undangan/massal', wajibAdmin, async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  if (!file || typeof file === 'string') throw new GagalError('Pilih file Excel (.xlsx) atau CSV daftar pegawai.');
  const alamat = typeof body.alamat === 'string' && /^https?:\/\/[\w.-]+(:\d+)?$/.test(body.alamat) ? body.alamat : '';
  const baris = (await bacaExcel(await file.arrayBuffer(), PETA_UNDANGAN, file.name))
    .map((r) => ({ nama: String(r.nama ?? '').trim().slice(0, 100), peran: String(r.peran ?? '').trim().toLowerCase(), no_wa: nomorWa(r.no_wa) }))
    .filter((r) => r.nama && !/^contoh /i.test(r.nama));
  if (!baris.length) throw new GagalError('Tidak ada nama yang terbaca. Pastikan ada kolom "Nama" (lihat file contoh).');
  if (baris.length > MAKS_UNDANGAN_SEKALI) throw new GagalError(`Maksimal ${MAKS_UNDANGAN_SEKALI} nama per unggahan. Bagi file menjadi beberapa bagian.`);
  const aktif = (db.prepare("SELECT COUNT(*) n FROM undangan WHERE dipakai IS NULL AND kedaluwarsa > datetime('now','localtime')").get() as { n: number }).n;
  if (aktif + baris.length > BATAS_UNDANGAN_AKTIF) throw new GagalError(`Undangan aktif akan melebihi ${BATAS_UNDANGAN_AKTIF}. Batalkan undangan lama yang tidak dipakai terlebih dahulu.`);
  const oleh = c.get('pengguna').nama;
  const hasil = transaksi(() => {
    const st = db.prepare(`INSERT INTO undangan (hash_token, peran, untuk, dibuat_oleh, kedaluwarsa) VALUES (?, ?, ?, ?, datetime('now','localtime', '+${MASA_UNDANGAN_JAM} hours'))`);
    return baris.map((r) => {
      const peran = peranDari(r.peran === 'admin' || r.peran === 'pengamat' ? r.peran : 'operator');
      const token = crypto.randomBytes(32).toString('base64url');
      st.run(hashToken(token), peran, r.nama, oleh);
      return { nama: r.nama, peran, no_wa: r.no_wa, token };
    });
  });
  const kedaluwarsa = (db.prepare(`SELECT datetime('now','localtime', '+${MASA_UNDANGAN_JAM} hours') k`).get() as { k: string }).k;
  // file Excel berisi tautan — hanya bisa diunduh sekali ini (token asli tidak disimpan di server)
  const buf = await buatExcel('Tautan undangan', [
    { judul: 'Nama', kunci: 'nama', lebar: 30 }, { judul: 'Peran', kunci: 'peran', lebar: 12 }, { judul: 'No WA', kunci: 'no_wa', lebar: 16 },
    { judul: 'Tautan undangan (sekali pakai)', kunci: 'tautan', lebar: 90 }, { judul: 'Berlaku sampai', kunci: 'sampai', lebar: 20 },
  ], hasil.map((h) => ({ ...h, tautan: `${alamat}/?undangan=${h.token}`, sampai: kedaluwarsa })), `Tautan undangan Seemitra Lite — berlaku ${MASA_UNDANGAN_JAM} jam, rahasiakan`);
  catat(oleh, 'Buat undangan massal', `${hasil.length} undangan (${file.name})`);
  return c.json({ jumlah: hasil.length, kedaluwarsa, daftar: hasil, unduhan: siapkanUnduhan(c, buf, `Tautan Undangan ${new Date().toISOString().slice(0, 10)}.xlsx`) });
});
/** Membatalkan semua undangan yang belum dipakai sekaligus */
sistem.delete('/undangan', wajibAdmin, (c) => {
  const r = db.prepare('DELETE FROM undangan WHERE dipakai IS NULL').run();
  catat(c.get('pengguna').nama, 'Batalkan semua undangan', `${r.changes} undangan`);
  return c.json({ jumlah: r.changes });
});

sistem.delete('/undangan/:id', wajibAdmin, (c) => {
  db.prepare('DELETE FROM undangan WHERE id = ? AND dipakai IS NULL').run(Number(c.req.param('id')));
  catat(c.get('pengguna').nama, 'Batalkan undangan pendaftaran');
  return c.json({ ok: true });
});

/** Setiap pengguna boleh mengganti kata sandinya sendiri */
sistem.post('/ganti-sandi', async (c) => {
  const { sandi, sandi_lama } = await c.req.json();
  const saya = c.get('pengguna');
  if (typeof sandi_lama !== 'string' || !sandi_lama) throw new GagalError('Isi kata sandi saat ini.');
  if (typeof sandi !== 'string') throw new GagalError('Isi kata sandi baru.');
  const u = db.prepare('SELECT password_hash FROM pengguna WHERE id = ?').get(saya.id) as { password_hash: string };
  if (!(await cocokSandi(sandi_lama, u.password_hash))) throw new GagalError('Kata sandi saat ini salah.');
  cekSandiBaru(sandi, saya.username, saya.peran);
  if (sandi === sandi_lama) throw new GagalError('Kata sandi baru harus berbeda dari yang sekarang.');
  const hash = await hashSandi(sandi);
  transaksi(() => {
    db.prepare('UPDATE pengguna SET password_hash = ? WHERE id = ?').run(hash, saya.id);
    cabutSemuaSesi(saya.id, bacaSesi(c)?.id); // perangkat lain otomatis keluar, perangkat ini tetap masuk
  });
  catat(saya.nama, 'Ganti kata sandi');
  return c.json({ ok: true });
});

function teks(v: unknown) { return typeof v === 'string' ? v.trim() : ''; }
function cekPanjangSandi(sandi: string) {
  if (sandi.length < 6 || sandi.length > 128) throw new GagalError('Kata sandi 6–128 karakter.');
}

/* ---------- Template dokumen ---------- */
const jenisValid = (j: string): JenisTemplate => {
  if (!JENIS_TEMPLATE.includes(j as JenisTemplate)) throw new GagalError('Jenis template tidak dikenal.');
  return j as JenisTemplate;
};
sistem.get('/template', (c) =>
  c.json({
    penanda: PENANDA,
    status: Object.fromEntries(JENIS_TEMPLATE.map((j) => {
      const f = path.join(TEMPLATE_DIR, `${j}.docx`);
      return [j, fs.existsSync(f) ? { khusus: true, diubah: fs.statSync(f).mtime.toISOString() } : { khusus: false }];
    })),
  }),
);
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
sistem.get('/template/:jenis', (c) => {
  const j = jenisValid(c.req.param('jenis') ?? '');
  return unduh(c, fs.readFileSync(fileTemplate(j)), `Template ${j.toUpperCase()}.docx`, DOCX);
});
sistem.get('/template/:jenis/bawaan', (c) => {
  const j = jenisValid(c.req.param('jenis') ?? '');
  return unduh(c, fs.readFileSync(fileTemplateBawaan(j)), `Template ${j.toUpperCase()} (bawaan).docx`, DOCX);
});
sistem.post('/template/:jenis', wajibAdmin, async (c) => {
  const j = jenisValid(c.req.param('jenis') ?? '');
  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  if (!file || typeof file === 'string') throw new GagalError('Pilih file Word (.docx) terlebih dahulu.');
  if (!file.name.toLowerCase().endsWith('.docx')) throw new GagalError('File harus berformat .docx (Word). Simpan ulang dokumen sebagai .docx.');
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    ujiTemplate(buf, j);
  } catch (e) {
    throw e instanceof GagalError ? e : new GagalError('File tidak dapat dibaca sebagai dokumen Word (.docx).');
  }
  fs.writeFileSync(path.join(TEMPLATE_DIR, `${j}.docx`), buf);
  catat(c.get('pengguna').nama, 'Ganti template', j.toUpperCase());
  return c.json({ ok: true });
});
sistem.delete('/template/:jenis', wajibAdmin, (c) => {
  const j = jenisValid(c.req.param('jenis') ?? '');
  fs.rmSync(path.join(TEMPLATE_DIR, `${j}.docx`), { force: true });
  catat(c.get('pengguna').nama, 'Kembalikan template bawaan', j.toUpperCase());
  return c.json({ ok: true });
});

/* ---------- Cadangan & pemulihan ----------
 * Unduhan cadangan SELALU dienkripsi dengan kata sandi yang diketik admin saat mengunduh. */
const sandiCadangan = (v: unknown) => {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) throw new GagalError('Kata sandi cadangan minimal 8 karakter.');
  return v;
};
const tglFile = () => new Date().toISOString().slice(0, 10);
const fileCadanganServer = (nama: unknown) => {
  const f = path.join(BACKUP_DIR, path.basename(String(nama ?? '')));
  if (!/\.(json|seemitra-backup)$/.test(f) || !fs.existsSync(f)) throw new GagalError('File cadangan tidak ditemukan.', 404);
  return f;
};
sistem.get('/cadangan', wajibAdmin, (c) => {
  const daftar = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json') || f.endsWith(EKSTENSI_TERENKRIPSI)).sort().reverse()
    .map((f) => ({ nama: f, ukuran: fs.statSync(path.join(BACKUP_DIR, f)).size, waktu: fs.statSync(path.join(BACKUP_DIR, f)).mtime.toISOString(), terenkripsi: f.endsWith(EKSTENSI_TERENKRIPSI) }));
  const uji = db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'uji_pemulihan'").get() as { nilai: string } | undefined;
  return c.json({ daftar, enkripsi_otomatis: adaKunciServer(), salinan_luar: s3Aktif(), uji_terakhir: uji ? JSON.parse(uji.nilai) : null });
});
sistem.post('/cadangan/unduh', wajibAdmin, async (c) => {
  const sandi = sandiCadangan((await c.req.json()).sandi);
  const isi = Buffer.from(JSON.stringify(kunciDenganSandi(Buffer.from(JSON.stringify(isiCadangan())), sandi)));
  catat(c.get('pengguna').nama, 'Unduh cadangan (terenkripsi)');
  return unduh(c, isi, `cadangan-seemitra-${tglFile()}${EKSTENSI_TERENKRIPSI}`, 'application/octet-stream');
});
/** Cadangan otomatis di server diunduh ulang dengan kata sandi pilihan admin (bukan BACKUP_KEY server). */
sistem.post('/cadangan/file/:nama', wajibAdmin, async (c) => {
  const sandi = sandiCadangan((await c.req.json()).sandi);
  const f = fileCadanganServer(c.req.param('nama'));
  let data: ReturnType<typeof isiCadangan>;
  try { data = bacaIsiCadangan(fs.readFileSync(f, 'utf8')); } catch (e) { throw new GagalError((e as Error).message); }
  const isi = Buffer.from(JSON.stringify(kunciDenganSandi(Buffer.from(JSON.stringify(data)), sandi)));
  catat(c.get('pengguna').nama, 'Unduh cadangan server (terenkripsi)', path.basename(f));
  return unduh(c, isi, path.basename(f).replace(/\.(json|seemitra-backup)$/, '') + EKSTENSI_TERENKRIPSI, 'application/octet-stream');
});
async function bacaKiriman(c: import('hono').Context): Promise<{ data: ReturnType<typeof isiCadangan>; sumber: string }> {
  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  const sandi = typeof body.sandi === 'string' && body.sandi ? body.sandi : undefined;
  try {
    if (file && typeof file !== 'string') return { data: bacaIsiCadangan(await file.text(), sandi), sumber: file.name };
    if (typeof body.nama === 'string') { const f = fileCadanganServer(body.nama); return { data: bacaIsiCadangan(fs.readFileSync(f, 'utf8'), sandi), sumber: path.basename(f) }; }
  } catch (e) {
    if (e instanceof GagalError) throw e;
    throw new GagalError(e instanceof GagalCadangan ? e.message : 'File cadangan tidak bisa dibaca.');
  }
  throw new GagalError('Pilih file cadangan (.seemitra-backup atau .json).');
}
sistem.post('/cadangan/pulihkan', wajibAdmin, async (c) => {
  const { data, sumber } = await bacaKiriman(c);
  try {
    pulihkanCadangan(data);
  } catch (e) {
    if (e instanceof GagalCadangan) throw new GagalError(e.message);
    console.error('[cadangan] pemulihan gagal:', e);
    throw new GagalError('Pemulihan gagal; data tidak diubah. Periksa kembali file cadangan.');
  }
  // akun & riwayat tidak ditimpa, jadi sesi yang sedang berjalan tetap berlaku
  catat(c.get('pengguna').nama, 'Pulihkan cadangan', sumber);
  return c.json({ ok: true });
});
/** Latihan pemulihan: membuka & memeriksa cadangan TANPA mengubah data. Disarankan setiap 3 bulan. */
sistem.post('/cadangan/uji', wajibAdmin, async (c) => {
  const { data, sumber } = await bacaKiriman(c);
  let hasil;
  try { hasil = validasiCadangan(data); } catch (e) { throw new GagalError((e as Error).message); }
  const catatan = { waktu: new Date().toISOString(), oleh: c.get('pengguna').nama, sumber, jumlah: hasil.jumlah };
  db.prepare("INSERT INTO pengaturan VALUES ('uji_pemulihan', ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai").run(JSON.stringify(catatan));
  catat(c.get('pengguna').nama, 'Uji pemulihan cadangan (berhasil)', `${sumber} — ${hasil.jumlah.mitra} mitra, ${hasil.jumlah.kegiatan} kegiatan, ${hasil.jumlah.penugasan} penugasan`);
  return c.json({ ok: true, ...hasil });
});

/* ---------- Riwayat aktivitas ---------- */
sistem.get('/riwayat', (c) => c.json(db.prepare('SELECT id, waktu, pengguna, aksi, detail FROM riwayat ORDER BY id DESC LIMIT 300').all()));
/** Memeriksa apakah riwayat pernah diubah/dihapus di luar aplikasi (rantai hash). */
sistem.get('/riwayat/verifikasi', wajibAdmin, (c) => {
  const h = verifikasiRiwayat();
  catat(c.get('pengguna').nama, 'Periksa keutuhan riwayat', h.utuh ? `utuh (${h.jumlah} baris)` : `RUSAK di baris #${h.rusak_di}`);
  return c.json(h);
});
