/**
 * DATABASE
 * --------
 * Seluruh data disimpan dalam satu file SQLite: <DATA_DIR>/seemitra.db
 * (di Railway, DATA_DIR = /data yang merupakan volume permanen).
 *
 * Perubahan struktur tabel ditulis sebagai "MIGRASI" bernomor di bawah.
 * Migrasi hanya berjalan sekali dan berurutan, jadi data lama tidak hilang.
 * Jika suatu saat perlu kolom baru, TAMBAHKAN migrasi baru di akhir daftar —
 * jangan mengubah migrasi yang sudah ada.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { adaKunciServer, bukaKunci, EKSTENSI_TERENKRIPSI, kunciDenganKunciServer, terenkripsi } from './enkripsi.ts';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const BACKUP_DIR = path.join(DATA_DIR, 'cadangan');
export const TEMPLATE_DIR = path.join(DATA_DIR, 'template');
fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(TEMPLATE_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'seemitra.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const MIGRASI: string[] = [
  /* 1 — struktur awal */ `
  CREATE TABLE pengaturan (kunci TEXT PRIMARY KEY, nilai TEXT NOT NULL);
  CREATE TABLE pengguna (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nama TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    peran TEXT NOT NULL DEFAULT 'operator',
    dibuat TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE mitra (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sobat_id TEXT, nama TEXT NOT NULL, nik TEXT, jenis_kelamin TEXT,
    pekerjaan TEXT, alamat TEXT, kecamatan TEXT, desa TEXT,
    no_hp TEXT, email TEXT, bank TEXT, no_rekening TEXT,
    status TEXT NOT NULL DEFAULT 'aktif', catatan TEXT,
    dibuat TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    diubah TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    dihapus TEXT
  );
  CREATE TABLE kegiatan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL, singkatan TEXT, jenis TEXT NOT NULL DEFAULT 'Survei',
    tanggal_mulai TEXT NOT NULL, tanggal_selesai TEXT NOT NULL,
    bulan_honor TEXT NOT NULL,           -- format YYYY-MM (bulan pencairan honor / bulan SPK)
    satuan TEXT NOT NULL DEFAULT 'Dokumen',
    mak TEXT,                            -- kode beban anggaran
    target_petugas INTEGER,
    tarif TEXT NOT NULL DEFAULT '{}',    -- JSON: { "PPL": 5000, "PML": 6000 }
    keterangan TEXT,
    dibuat TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    diubah TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    dihapus TEXT
  );
  CREATE TABLE penugasan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kegiatan_id INTEGER NOT NULL REFERENCES kegiatan(id) ON DELETE CASCADE,
    mitra_id INTEGER NOT NULL REFERENCES mitra(id) ON DELETE CASCADE,
    peran TEXT NOT NULL,
    volume REAL NOT NULL DEFAULT 0,
    tarif REAL NOT NULL DEFAULT 0,
    catatan TEXT,
    dibuat TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE (kegiatan_id, mitra_id, peran)
  );
  CREATE TABLE nomor_dokumen (
    bulan TEXT NOT NULL, mitra_id INTEGER NOT NULL, urut INTEGER NOT NULL,
    PRIMARY KEY (bulan, mitra_id)
  );
  CREATE TABLE spk_bulan (             -- tanggal SPK yang terakhir dipakai per bulan (dipakai lagi oleh BAST)
    bulan TEXT PRIMARY KEY, tanggal_spk TEXT, tanggal_mulai TEXT, tanggal_selesai TEXT
  );
  CREATE TABLE batas_honor (tahun INTEGER PRIMARY KEY, nominal REAL NOT NULL);
  CREATE TABLE riwayat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waktu TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    pengguna TEXT, aksi TEXT NOT NULL, detail TEXT
  );
  CREATE INDEX idx_penugasan_mitra ON penugasan(mitra_id);
  CREATE INDEX idx_kegiatan_bulan ON kegiatan(bulan_honor);
  `,
  /* 2 — pendaftaran akun: akun baru menunggu persetujuan admin */ `
  ALTER TABLE pengguna ADD COLUMN status TEXT NOT NULL DEFAULT 'aktif';
  `,
  /* 3 — SBML per peran (PPL/PML/Pengolahan/…) per tahun; batas lama disalin ke setiap peran */ `
  CREATE TABLE sbml (
    tahun INTEGER NOT NULL, peran TEXT NOT NULL, nominal REAL NOT NULL,
    PRIMARY KEY (tahun, peran)
  );
  INSERT INTO sbml (tahun, peran, nominal)
    SELECT b.tahun, p.value, b.nominal FROM batas_honor b,
      json_each(COALESCE((SELECT json_extract(nilai, '$.daftar_peran') FROM pengaturan WHERE kunci = 'umum'), '["PPL","PML","Pengolahan"]')) p;
  `,
  /* 4 — catat siapa yang mengentri penugasan (berguna bila beberapa pegawai mengisi kegiatan berbeda) */ `
  ALTER TABLE penugasan ADD COLUMN dibuat_oleh TEXT;
  `,
  /* 5 — bulan kegiatan & kegiatan bulanan (seri)
     - bulan_kegiatan: bulan pelaksanaan (dari tanggal selesai) → dasar SBML, SPK & BAST
     - bulan_honor kini berarti BULAN PEMBAYARAN; yang dulu otomatis disamakan dgn bulan selesai digeser ke bulan berikutnya (n+1)
     - seri_id: mengelompokkan kegiatan bulanan sepanjang tahun */ `
  ALTER TABLE kegiatan ADD COLUMN bulan_kegiatan TEXT;
  ALTER TABLE kegiatan ADD COLUMN seri_id INTEGER;
  UPDATE kegiatan SET bulan_kegiatan = substr(tanggal_selesai, 1, 7);
  UPDATE kegiatan SET bulan_honor = strftime('%Y-%m', date(tanggal_selesai, 'start of month', '+1 month'))
    WHERE bulan_honor = substr(tanggal_selesai, 1, 7);
  CREATE INDEX idx_kegiatan_bulan_kegiatan ON kegiatan(bulan_kegiatan);
  CREATE INDEX idx_kegiatan_seri ON kegiatan(seri_id);
  `,
  /* 6 — keamanan: versi sesi per pengguna. Dinaikkan saat keluar / ganti sandi → cookie lama otomatis tidak berlaku */ `
  ALTER TABLE pengguna ADD COLUMN versi_sesi INTEGER NOT NULL DEFAULT 0;
  `,
  /* 7 — undangan pendaftaran: admin membuat tautan sekali pakai (berlaku 72 jam).
     Yang disimpan hanya HASH token, bukan token aslinya. Tabel ini sengaja TIDAK ikut cadangan. */ `
  CREATE TABLE undangan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash_token TEXT NOT NULL UNIQUE,
    peran TEXT NOT NULL DEFAULT 'operator',
    untuk TEXT,
    dibuat_oleh TEXT,
    dibuat TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    kedaluwarsa TEXT NOT NULL,
    dipakai TEXT,
    dipakai_oleh TEXT
  );
  `,
  /* 8 — keamanan lanjutan:
     - sesi: setiap login = satu baris (bisa dilihat & dicabut dari menu "Sesi aktif")
     - log_masuk: catatan setiap percobaan masuk (berhasil/gagal)
     - pengguna: verifikasi 2 langkah (TOTP) & izin ekspor
     - riwayat: rantai hash (tidak bisa diubah/dihapus diam-diam) + id pengguna */ `
  CREATE TABLE sesi (
    id TEXT PRIMARY KEY,
    pengguna_id INTEGER NOT NULL,
    dibuat INTEGER NOT NULL,
    terakhir_aktif INTEGER NOT NULL,
    ip TEXT, user_agent TEXT,
    dicabut INTEGER
  );
  CREATE INDEX idx_sesi_pengguna ON sesi(pengguna_id);
  CREATE TABLE log_masuk (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waktu TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    username TEXT, ip TEXT, user_agent TEXT, hasil TEXT NOT NULL
  );
  CREATE INDEX idx_log_masuk_waktu ON log_masuk(waktu);
  ALTER TABLE pengguna ADD COLUMN totp_rahasia TEXT;
  ALTER TABLE pengguna ADD COLUMN totp_aktif INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE pengguna ADD COLUMN boleh_ekspor INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE riwayat ADD COLUMN pengguna_id INTEGER;
  ALTER TABLE riwayat ADD COLUMN hash TEXT;
  CREATE TRIGGER riwayat_tanpa_hapus BEFORE DELETE ON riwayat
    BEGIN SELECT RAISE(ABORT, 'Riwayat aktivitas tidak boleh dihapus.'); END;
  CREATE TRIGGER riwayat_tanpa_ubah BEFORE UPDATE ON riwayat WHEN OLD.hash IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'Riwayat aktivitas tidak boleh diubah.'); END;
  `,
];

function jalankanMigrasi() {
  db.exec('CREATE TABLE IF NOT EXISTS _migrasi (versi INTEGER PRIMARY KEY, waktu TEXT)');
  const row = db.prepare('SELECT MAX(versi) AS v FROM _migrasi').get() as { v: number | null };
  const sekarang = row?.v ?? 0;
  MIGRASI.forEach((sql, i) => {
    const versi = i + 1;
    if (versi <= sekarang) return;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare("INSERT INTO _migrasi VALUES (?, datetime('now','localtime'))").run(versi);
      db.exec('COMMIT');
      console.log(`[db] migrasi ${versi} selesai`);
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  });
}
jalankanMigrasi();

/* ---------------- Pengaturan umum (bisa diubah dari menu Pengaturan) ---------------- */
export type Pengaturan = {
  nama_kantor: string;
  wilayah: string;
  alamat_kantor: string;
  ppk_nama: string;
  ppk_nip: string;
  ppk_jabatan: string;
  format_nomor_spk: string;
  format_nomor_bast: string;
  daftar_peran: string[];
  daftar_satuan: string[];
  daftar_jenis: string[];
  /** Persen dari SBML untuk mulai memberi peringatan "hampir mencapai SBML" */
  ambang_sbml: number;
  /** Bulan pembayaran otomatis = bulan kegiatan + jeda ini (bawaan 1 → dibayar bulan berikutnya) */
  jeda_pembayaran: number;
  /** false (bawaan) = akun baru hanya bisa dibuat lewat tautan undangan dari admin */
  pendaftaran_terbuka: boolean;
  /** Admin diberi peringatan di Beranda bila satu pengguna mengekspor/membuat dokumen lebih dari ini dalam sehari */
  batas_ekspor_harian: number;
};

export const PENGATURAN_AWAL: Pengaturan = {
  nama_kantor: 'BPS Kabupaten Padang Lawas Utara',
  wilayah: 'Kabupaten Padang Lawas Utara',
  alamat_kantor:
    'Jl. Lintas Gunung Tua-Padangsidimpuan Km. 5, Sigama, Kec. Padang Bolak, Kabupaten Padang Lawas Utara, Sumatera Utara 22753',
  ppk_nama: 'Ashabul Kahfi Sipahutar, S.Tr.Stat.',
  ppk_nip: '200004022023021004',
  ppk_jabatan: 'Pejabat Pembuat Komitmen',
  format_nomor_spk: '{urut}/PPK/PPIS/SPK/{bulan}/{tahun}',
  format_nomor_bast: '{urut}/PPK/PPIS/BAST/{bulan}/{tahun}',
  daftar_peran: ['PPL', 'PML', 'Pengolahan'],
  daftar_satuan: ['Dokumen', 'Ruta', 'BS', 'SLS', 'Usaha', 'Desa', 'OB', 'Kegiatan'],
  daftar_jenis: ['Survei', 'Sensus', 'Lainnya'],
  ambang_sbml: 80,
  jeda_pembayaran: 1,
  pendaftaran_terbuka: false,
  batas_ekspor_harian: 10,
};

export function ambilPengaturan(): Pengaturan {
  const row = db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'umum'").get() as { nilai: string } | undefined;
  return { ...PENGATURAN_AWAL, ...(row ? JSON.parse(row.nilai) : {}) };
}
export function simpanPengaturan(p: Partial<Pengaturan>) {
  const baru = { ...ambilPengaturan(), ...p };
  db.prepare("INSERT INTO pengaturan VALUES ('umum', ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai").run(
    JSON.stringify(baru),
  );
  return baru;
}

/**
 * Kunci rahasia untuk tanda tangan sesi login.
 * - Production: WAJIB diisi lewat variabel lingkungan SESSION_SECRET (minimal 32 karakter) di Railway.
 *   Mengganti nilainya = semua orang otomatis keluar (berguna bila ada kebocoran).
 * - Tanpa SESSION_SECRET (pengembangan lokal): kunci dibuat otomatis dan disimpan di database.
 *   Kunci di database TIDAK PERNAH ikut ke file cadangan.
 */
const KUNCI_ENV = (process.env.SESSION_SECRET ?? '').trim();
if (KUNCI_ENV && KUNCI_ENV.length < 32) throw new Error('SESSION_SECRET minimal 32 karakter (buat dengan: openssl rand -hex 32).');
if (!KUNCI_ENV && process.env.NODE_ENV === 'production') {
  console.warn('[keamanan] SESSION_SECRET belum diisi — memakai kunci di database. Isi SESSION_SECRET di Railway → Variables.');
}
export function kunciRahasia(): string {
  if (KUNCI_ENV) return KUNCI_ENV;
  const row = db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'rahasia'").get() as { nilai: string } | undefined;
  if (row) return row.nilai;
  const k = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO pengaturan VALUES ('rahasia', ?)").run(k);
  return k;
}

/** Pengguna yang sedang membuat permintaan (diisi oleh wajibLogin) — dipakai catat() untuk mengisi pengguna_id. */
export const konteksPengguna = new AsyncLocalStorage<{ id: number }>();

/* ---------------- Riwayat aktivitas: rantai hash ----------------
 * Setiap baris menyimpan hash = SHA256(hash baris sebelumnya + isi baris).
 * Bila ada baris yang diubah/dihapus langsung di database, rantai putus dan terdeteksi oleh /api/riwayat/verifikasi.
 * Database juga menolak UPDATE/DELETE pada riwayat (trigger di migrasi 8). */
const PEMISAH = '\u001f';
const hashBaris = (sebelum: string, b: { waktu: string; pengguna_id: number | null; pengguna: string | null; aksi: string; detail: string | null }) =>
  crypto.createHash('sha256').update([sebelum, b.waktu, b.pengguna_id ?? '', b.pengguna ?? '', b.aksi, b.detail ?? ''].join(PEMISAH)).digest('hex');
const hashTerakhir = () => (db.prepare('SELECT hash FROM riwayat WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1').get() as { hash: string } | undefined)?.hash ?? '';

export function catat(pengguna: string | undefined, aksi: string, detail?: string) {
  const b = {
    waktu: (db.prepare("SELECT datetime('now','localtime') w").get() as { w: string }).w,
    pengguna_id: konteksPengguna.getStore()?.id ?? null,
    pengguna: String(pengguna ?? '-').slice(0, 200), aksi: String(aksi).slice(0, 200),
    detail: detail === undefined || detail === null ? null : String(detail).slice(0, 2000),
  };
  db.prepare('INSERT INTO riwayat (waktu, pengguna_id, pengguna, aksi, detail, hash) VALUES (?, ?, ?, ?, ?, ?)')
    .run(b.waktu, b.pengguna_id, b.pengguna, b.aksi, b.detail, hashBaris(hashTerakhir(), b));
}

/** Menyegel baris riwayat lama (sebelum ada rantai hash) — dijalankan sekali saat server hidup. */
function segelRiwayatLama() {
  const lama = db.prepare('SELECT id, waktu, pengguna_id, pengguna, aksi, detail FROM riwayat WHERE hash IS NULL ORDER BY id').all() as
    { id: number; waktu: string; pengguna_id: number | null; pengguna: string | null; aksi: string; detail: string | null }[];
  if (!lama.length) return;
  transaksi(() => {
    const st = db.prepare('UPDATE riwayat SET hash = ? WHERE id = ?');
    for (const b of lama) {
      const sebelum = (db.prepare('SELECT hash FROM riwayat WHERE id < ? AND hash IS NOT NULL ORDER BY id DESC LIMIT 1').get(b.id) as { hash: string } | undefined)?.hash ?? '';
      st.run(hashBaris(sebelum, b), b.id);
    }
  });
  console.log(`[riwayat] ${lama.length} baris lama disegel ke rantai hash`);
}

/** Memeriksa keutuhan seluruh rantai riwayat. */
export function verifikasiRiwayat() {
  const baris = db.prepare('SELECT id, waktu, pengguna_id, pengguna, aksi, detail, hash FROM riwayat ORDER BY id').iterate() as Iterable<
    { id: number; waktu: string; pengguna_id: number | null; pengguna: string | null; aksi: string; detail: string | null; hash: string | null }>;
  let sebelum = '', jumlah = 0, idSebelum = 0;
  for (const b of baris) {
    jumlah++;
    if (!b.hash || hashBaris(sebelum, b) !== b.hash) return { utuh: false, jumlah, rusak_di: b.id, pesan: `Rantai putus di baris #${b.id} (setelah #${idSebelum}). Ada data riwayat yang diubah atau dihapus di luar aplikasi.` };
    sebelum = b.hash; idSebelum = b.id;
  }
  return { utuh: true, jumlah, rusak_di: null, pesan: `Semua ${jumlah} baris riwayat utuh.` };
}

/** Jalankan beberapa perintah sekaligus: semua berhasil, atau semua dibatalkan. */
export function transaksi<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/* ---------------- Cadangan data (format JSON, bisa dipulihkan dari menu Pengaturan) ----------------
 * Catatan: tabel `undangan` sengaja tidak dicadangkan (tautan undangan bersifat sementara). */
export const TABEL_CADANGAN = ['pengaturan', 'pengguna', 'mitra', 'kegiatan', 'penugasan', 'nomor_dokumen', 'spk_bulan', 'batas_honor', 'sbml', 'riwayat'];
/** Tabel yang ikut diekspor tetapi TIDAK ditimpa saat pemulihan (akun & jejak audit tetap milik server ini) */
const TABEL_TIDAK_DITIMPA = ['pengguna', 'riwayat'];
/** Kolom rahasia yang tidak pernah ikut file cadangan */
const KOLOM_RAHASIA: Record<string, string[]> = { pengguna: ['password_hash', 'totp_rahasia', 'versi_sesi'] };

export function isiCadangan() {
  const tabel: Record<string, unknown[]> = {};
  for (const t of TABEL_CADANGAN) {
    // kunci sesi tidak pernah diekspor: siapa pun yang memegang file cadangan tidak bisa memalsukan login
    const baris = db.prepare(t === 'pengaturan' ? "SELECT * FROM pengaturan WHERE kunci <> 'rahasia'" : `SELECT * FROM ${t}`).all() as Record<string, unknown>[];
    const buang = KOLOM_RAHASIA[t] ?? [];
    tabel[t] = buang.length ? baris.map((b) => Object.fromEntries(Object.entries(b).filter(([k]) => !buang.includes(k)))) : baris;
  }
  const template: Record<string, string> = {};
  for (const f of fs.readdirSync(TEMPLATE_DIR)) template[f] = fs.readFileSync(path.join(TEMPLATE_DIR, f)).toString('base64');
  return { aplikasi: 'seemitra-lite', versi: MIGRASI.length, dibuat: new Date().toISOString(), tabel, template };
}

/** Nama file template yang boleh ada di file cadangan */
const TEMPLATE_SAH = ['spk.docx', 'bast.docx'];

/** Memeriksa isi cadangan tanpa mengubah apa pun; mengembalikan jumlah baris per tabel. */
export function validasiCadangan(data: ReturnType<typeof isiCadangan>) {
  if (data?.aplikasi !== 'seemitra-lite' || !data.tabel || typeof data.tabel !== 'object') throw new GagalCadangan('File ini bukan file cadangan Seemitra Lite.');
  // 1) Periksa seluruh isi file DULU — belum ada data yang diubah sampai semuanya lolos
  for (const t of TABEL_CADANGAN) {
    const baris = data.tabel[t] ?? [];
    if (!Array.isArray(baris)) throw new GagalCadangan(`Isi tabel "${t}" di file cadangan rusak.`);
    const kolomSah = new Set((db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((k) => k.name));
    for (const b of baris as Record<string, unknown>[]) {
      if (!b || typeof b !== 'object') throw new GagalCadangan(`Isi tabel "${t}" di file cadangan rusak.`);
      for (const k of Object.keys(b)) if (!kolomSah.has(k)) throw new GagalCadangan(`Kolom "${k}" tidak dikenal di tabel "${t}". File cadangan ditolak.`);
    }
  }
  const template = Object.entries(data.template ?? {});
  for (const [f, b64] of template) {
    if (!TEMPLATE_SAH.includes(f) || typeof b64 !== 'string') throw new GagalCadangan(`File template "${f}" tidak dikenal. File cadangan ditolak.`);
  }
  return { jumlah: Object.fromEntries(TABEL_CADANGAN.map((t) => [t, ((data.tabel[t] ?? []) as unknown[]).length])), template: template.map(([f]) => f), dibuat: data.dibuat, versi: data.versi };
}

export function pulihkanCadangan(data: ReturnType<typeof isiCadangan>) {
  validasiCadangan(data);
  const template = Object.entries(data.template ?? {});
  simpanCadanganKeFile('sebelum-pemulihan');
  // 2) Kunci sesi yang sedang berlaku dipertahankan (baris 'rahasia' dari file lama diabaikan)
  const kunciLama = db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'rahasia'").get() as { nilai: string } | undefined;
  transaksi(() => {
    db.exec('PRAGMA defer_foreign_keys = ON');
    for (const t of [...TABEL_CADANGAN].reverse()) if (!TABEL_TIDAK_DITIMPA.includes(t)) db.exec(`DELETE FROM ${t}`);
    // akun: yang sudah ada dipertahankan (sandi & 2FA tidak ada di file); akun dari file yang belum ada
    // dibuat tanpa sandi → admin perlu mengatur ulang sandinya dari menu Pengguna
    for (const u of (data.tabel.pengguna ?? []) as Record<string, unknown>[]) {
      if (typeof u.username !== 'string' || db.prepare('SELECT 1 FROM pengguna WHERE username = ?').get(u.username)) continue;
      db.prepare("INSERT INTO pengguna (username, nama, password_hash, peran, status) VALUES (?, ?, '!', ?, 'aktif')").run(
        u.username, String(u.nama ?? u.username), ['admin', 'operator', 'pengamat'].includes(String(u.peran)) ? String(u.peran) : 'operator');
    }
    for (const t of TABEL_CADANGAN) {
      if (TABEL_TIDAK_DITIMPA.includes(t)) continue;
      for (const baris of (data.tabel[t] ?? []) as Record<string, unknown>[]) {
        if (t === 'pengaturan' && baris.kunci === 'rahasia') continue;
        const kolom = Object.keys(baris);
        if (!kolom.length) continue;
        db.prepare(`INSERT INTO ${t} (${kolom.join(',')}) VALUES (${kolom.map(() => '?').join(',')})`).run(
          ...kolom.map((k) => baris[k] as string | number | null),
        );
      }
    }
    if (kunciLama) db.prepare("INSERT INTO pengaturan VALUES ('rahasia', ?)").run(kunciLama.nilai);
  });
  for (const f of fs.readdirSync(TEMPLATE_DIR)) fs.rmSync(path.join(TEMPLATE_DIR, f));
  for (const [f, b64] of template) fs.writeFileSync(path.join(TEMPLATE_DIR, f), Buffer.from(b64 as string, 'base64'));
}

/** Galat pemulihan cadangan dengan pesan yang ramah (ditampilkan apa adanya ke pengguna) */
export class GagalCadangan extends Error {}

/** Menyimpan cadangan ke folder server. Bila BACKUP_KEY diisi, file dienkripsi (.seemitra-backup). */
export function simpanCadanganKeFile(awalan: string) {
  const cap = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const isi = Buffer.from(JSON.stringify(isiCadangan()));
  const nama = `${awalan}-${cap}${adaKunciServer() ? EKSTENSI_TERENKRIPSI : '.json'}`;
  fs.writeFileSync(path.join(BACKUP_DIR, nama), adaKunciServer() ? JSON.stringify(kunciDenganKunciServer(isi)) : isi);
  return nama;
}

/** Membaca isi file cadangan (biasa atau terenkripsi) menjadi objek cadangan. */
export function bacaIsiCadangan(teks: string, sandi?: string): ReturnType<typeof isiCadangan> {
  let data: unknown;
  try { data = JSON.parse(teks); } catch { throw new GagalCadangan('File cadangan tidak bisa dibaca. Pastikan file dari Seemitra Lite (.seemitra-backup atau .json).'); }
  if (terenkripsi(data)) {
    try { data = JSON.parse(bukaKunci(data, sandi).toString('utf8')); } catch (e) { throw new GagalCadangan((e as Error).message); }
  }
  return data as ReturnType<typeof isiCadangan>;
}

/** Dijalankan saat server hidup & setiap 6 jam: satu cadangan per hari, simpan 30 terakhir. */
export function buatCadanganOtomatis(): string | null {
  try {
    const hariIni = new Date().toISOString().slice(0, 10);
    const semua = () => fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('otomatis-')).sort();
    // satu kali saja: cadangan otomatis lama tanpa enkripsi dienkripsi bila BACKUP_KEY sudah ada
    if (adaKunciServer()) {
      for (const f of fs.readdirSync(BACKUP_DIR).filter((x) => x.endsWith('.json'))) {
        const jalur = path.join(BACKUP_DIR, f);
        fs.writeFileSync(jalur.replace(/\.json$/, EKSTENSI_TERENKRIPSI), JSON.stringify(kunciDenganKunciServer(fs.readFileSync(jalur))));
        fs.rmSync(jalur);
      }
    }
    if (semua().some((f) => f.startsWith(`otomatis-${hariIni}`))) return null;
    const nama = simpanCadanganKeFile('otomatis');
    const daftar = semua();
    while (daftar.length > 30) fs.rmSync(path.join(BACKUP_DIR, daftar.shift()!));
    return nama;
  } catch (e) {
    console.error('[cadangan] gagal:', e);
    return null;
  }
}

segelRiwayatLama();
