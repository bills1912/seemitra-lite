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

export function catat(pengguna: string | undefined, aksi: string, detail?: string) {
  db.prepare('INSERT INTO riwayat (pengguna, aksi, detail) VALUES (?, ?, ?)').run(pengguna ?? '-', aksi, detail ?? null);
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

export function isiCadangan() {
  const tabel: Record<string, unknown[]> = {};
  for (const t of TABEL_CADANGAN) {
    // kunci sesi tidak pernah diekspor: siapa pun yang memegang file cadangan tidak bisa memalsukan login
    tabel[t] = db.prepare(t === 'pengaturan' ? "SELECT * FROM pengaturan WHERE kunci <> 'rahasia'" : `SELECT * FROM ${t}`).all();
  }
  const template: Record<string, string> = {};
  for (const f of fs.readdirSync(TEMPLATE_DIR)) template[f] = fs.readFileSync(path.join(TEMPLATE_DIR, f)).toString('base64');
  return { aplikasi: 'seemitra-lite', versi: MIGRASI.length, dibuat: new Date().toISOString(), tabel, template };
}

/** Nama file template yang boleh ada di file cadangan */
const TEMPLATE_SAH = ['spk.docx', 'bast.docx'];

export function pulihkanCadangan(data: ReturnType<typeof isiCadangan>) {
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
  simpanCadanganKeFile('sebelum-pemulihan');
  // 2) Kunci sesi yang sedang berlaku dipertahankan (baris 'rahasia' dari file lama diabaikan)
  const kunciLama = db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'rahasia'").get() as { nilai: string } | undefined;
  transaksi(() => {
    db.exec('PRAGMA defer_foreign_keys = ON');
    for (const t of [...TABEL_CADANGAN].reverse()) db.exec(`DELETE FROM ${t}`);
    for (const t of TABEL_CADANGAN) {
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

export function simpanCadanganKeFile(awalan: string) {
  const nama = `${awalan}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  fs.writeFileSync(path.join(BACKUP_DIR, nama), JSON.stringify(isiCadangan()));
  return nama;
}

/** Dijalankan saat server hidup & setiap 6 jam: satu cadangan per hari, simpan 30 terakhir. */
export function buatCadanganOtomatis() {
  try {
    const hariIni = new Date().toISOString().slice(0, 10);
    const semua = () => fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('otomatis-')).sort();
    if (semua().some((f) => f.startsWith(`otomatis-${hariIni}`))) return;
    simpanCadanganKeFile('otomatis');
    const daftar = semua();
    while (daftar.length > 30) fs.rmSync(path.join(BACKUP_DIR, daftar.shift()!));
  } catch (e) {
    console.error('[cadangan] gagal:', e);
  }
}
