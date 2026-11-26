/** PENGATURAN, PENGGUNA, BATAS HONOR, TEMPLATE DOKUMEN, CADANGAN DATA, RIWAYAT */
import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import { db, ambilPengaturan, simpanPengaturan, catat, isiCadangan, pulihkanCadangan, BACKUP_DIR, TEMPLATE_DIR, PENGATURAN_AWAL } from '../db.ts';
import { wajibAdmin, hashSandi, type Env } from '../auth.ts';
import { GagalError } from '../util.ts';
import { unduh } from './data.ts';
import { fileTemplate, fileTemplateBawaan, JENIS_TEMPLATE, PENANDA, ujiTemplate, type JenisTemplate } from './dokumen.ts';

export const sistem = new Hono<Env>();

/* ---------- Pengaturan umum ---------- */
sistem.get('/pengaturan', (c) => c.json(ambilPengaturan()));
sistem.put('/pengaturan', wajibAdmin, async (c) => {
  const b = await c.req.json();
  const izin = Object.keys(PENGATURAN_AWAL);
  const bersih = Object.fromEntries(Object.entries(b).filter(([k]) => izin.includes(k)));
  for (const k of ['daftar_peran', 'daftar_satuan', 'daftar_jenis']) {
    if (k in bersih) {
      const arr = [...new Set((bersih[k] as string[]).map((x) => String(x).trim()).filter(Boolean))];
      if (!arr.length) throw new GagalError('Daftar tidak boleh kosong.');
      bersih[k] = arr;
    }
  }
  const hasil = simpanPengaturan(bersih);
  catat(c.get('pengguna').nama, 'Ubah pengaturan');
  return c.json(hasil);
});

/* ---------- Batas honor (SBML) ---------- */
sistem.get('/batas-honor', (c) => c.json(db.prepare('SELECT * FROM batas_honor ORDER BY tahun DESC').all()));
sistem.put('/batas-honor', wajibAdmin, async (c) => {
  const { tahun, nominal } = await c.req.json();
  if (!Number(tahun)) throw new GagalError('Tahun tidak valid.');
  if (!nominal) db.prepare('DELETE FROM batas_honor WHERE tahun = ?').run(Number(tahun));
  else db.prepare('INSERT INTO batas_honor VALUES (?, ?) ON CONFLICT(tahun) DO UPDATE SET nominal = excluded.nominal').run(Number(tahun), Number(nominal));
  catat(c.get('pengguna').nama, 'Ubah batas honor', `${tahun}: ${nominal}`);
  return c.json({ ok: true });
});

/* ---------- Pengguna ---------- */
sistem.get('/pengguna', wajibAdmin, (c) => c.json(db.prepare('SELECT id, username, nama, peran, status, dibuat FROM pengguna ORDER BY status DESC, nama').all()));
sistem.post('/pengguna', wajibAdmin, async (c) => {
  const b = await c.req.json();
  if (!b.username || !b.nama || !b.sandi) throw new GagalError('Nama, username, dan kata sandi wajib diisi.');
  if (String(b.sandi).length < 6) throw new GagalError('Kata sandi minimal 6 karakter.');
  try {
    db.prepare('INSERT INTO pengguna (username, nama, password_hash, peran) VALUES (?, ?, ?, ?)').run(
      String(b.username).trim(), String(b.nama).trim(), hashSandi(b.sandi), b.peran === 'admin' ? 'admin' : 'operator');
  } catch {
    throw new GagalError('Username sudah dipakai.');
  }
  catat(c.get('pengguna').nama, 'Tambah pengguna', b.username);
  return c.json({ ok: true });
});
sistem.put('/pengguna/:id', wajibAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json();
  const peran = b.peran === 'admin' ? 'admin' : 'operator';
  if (peran !== 'admin') {
    const sisa = (db.prepare("SELECT COUNT(*) n FROM pengguna WHERE peran = 'admin' AND status = 'aktif' AND id <> ?").get(id) as { n: number }).n;
    if (!sisa) throw new GagalError('Harus ada minimal satu admin.');
  }
  const status = b.status === 'menunggu' ? 'menunggu' : 'aktif';
  if (id === c.get('pengguna').id && (status !== 'aktif' || peran !== 'admin')) throw new GagalError('Anda tidak dapat menonaktifkan atau menurunkan akun sendiri.');
  db.prepare('UPDATE pengguna SET nama = ?, peran = ?, status = ? WHERE id = ?').run(String(b.nama).trim(), peran, status, id);
  if (b.sandi) {
    if (String(b.sandi).length < 6) throw new GagalError('Kata sandi minimal 6 karakter.');
    db.prepare('UPDATE pengguna SET password_hash = ? WHERE id = ?').run(hashSandi(b.sandi), id);
  }
  catat(c.get('pengguna').nama, 'Ubah pengguna', b.nama);
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
/** Setiap pengguna boleh mengganti kata sandinya sendiri */
sistem.post('/ganti-sandi', async (c) => {
  const { sandi } = await c.req.json();
  if (!sandi || String(sandi).length < 6) throw new GagalError('Kata sandi minimal 6 karakter.');
  db.prepare('UPDATE pengguna SET password_hash = ? WHERE id = ?').run(hashSandi(sandi), c.get('pengguna').id);
  return c.json({ ok: true });
});

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

/* ---------- Cadangan & pemulihan ---------- */
sistem.get('/cadangan', wajibAdmin, (c) => {
  const daftar = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort().reverse()
    .map((f) => ({ nama: f, ukuran: fs.statSync(path.join(BACKUP_DIR, f)).size, waktu: fs.statSync(path.join(BACKUP_DIR, f)).mtime.toISOString() }));
  return c.json(daftar);
});
sistem.get('/cadangan/unduh', wajibAdmin, (c) => {
  const isi = Buffer.from(JSON.stringify(isiCadangan()));
  catat(c.get('pengguna').nama, 'Unduh cadangan');
  return unduh(c, isi, `cadangan-seemitra-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
});
sistem.get('/cadangan/file/:nama', wajibAdmin, (c) => {
  const nama = path.basename(c.req.param('nama') ?? '');
  const f = path.join(BACKUP_DIR, nama);
  if (!fs.existsSync(f)) throw new GagalError('File cadangan tidak ditemukan.', 404);
  return unduh(c, fs.readFileSync(f), nama, 'application/json');
});
sistem.post('/cadangan/pulihkan', wajibAdmin, async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  let data: unknown;
  if (file && typeof file !== 'string') data = JSON.parse(await file.text());
  else if (typeof body.nama === 'string') data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, path.basename(body.nama)), 'utf8'));
  else throw new GagalError('Pilih file cadangan (.json).');
  try {
    pulihkanCadangan(data as ReturnType<typeof isiCadangan>);
  } catch (e) {
    throw new GagalError((e as Error).message);
  }
  catat(c.get('pengguna').nama, 'Pulihkan cadangan');
  return c.json({ ok: true });
});

/* ---------- Riwayat aktivitas ---------- */
sistem.get('/riwayat', (c) => c.json(db.prepare('SELECT * FROM riwayat ORDER BY id DESC LIMIT 300').all()));
