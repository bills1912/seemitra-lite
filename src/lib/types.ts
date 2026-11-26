export type Pengguna = { id: number; username: string; nama: string; peran: 'admin' | 'operator'; status?: 'aktif' | 'menunggu'; dibuat?: string };

export type Mitra = {
  id: number; sobat_id: string | null; nama: string; nik: string | null; jenis_kelamin: string | null;
  pekerjaan: string | null; alamat: string | null; kecamatan: string | null; desa: string | null;
  no_hp: string | null; email: string | null; bank: string | null; no_rekening: string | null;
  status: 'aktif' | 'nonaktif'; catatan: string | null; dihapus: string | null;
  jumlah_kegiatan?: number; terakhir_bertugas?: string | null; honor_bulan_ini?: number; rasio_sbml?: number | null;
};

export type Kegiatan = {
  id: number; nama: string; singkatan: string | null; jenis: string; tanggal_mulai: string; tanggal_selesai: string;
  bulan_honor: string; bulan_kegiatan: string; seri_id: number | null; satuan: string; mak: string | null; target_petugas: number | null;
  tarif: Record<string, number>; keterangan: string | null; dihapus: string | null;
  jumlah_petugas: number; total_honor: number; total_volume: number;
};

export type Petugas = {
  id: number; kegiatan_id: number; mitra_id: number; peran: string; volume: number; tarif: number; honor: number;
  catatan: string | null; nama: string; sobat_id: string | null; kecamatan: string | null; desa: string | null;
  no_hp: string | null; honor_peran: Record<string, number>; mitra_dihapus: string | null;
};

export type Kandidat = {
  id: number; nama: string; sobat_id: string | null; kecamatan: string | null; desa: string | null; pekerjaan: string | null;
  peran_di_sini: string | null; bentrok: number; honor_peran: Record<string, number>;
};

export type Pengaturan = {
  nama_kantor: string; wilayah: string; alamat_kantor: string; ppk_nama: string; ppk_nip: string; ppk_jabatan: string;
  format_nomor_spk: string; format_nomor_bast: string; daftar_peran: string[]; daftar_satuan: string[]; daftar_jenis: string[]; ambang_sbml: number; jeda_pembayaran: number;
};

export type BarisRekap = {
  mitra_id: number; nama: string; sobat_id: string | null; kecamatan: string | null; desa: string | null;
  bank: string | null; no_rekening: string | null; total: number;
  tugas: { kegiatan_id: number; kegiatan: string; peran: string; volume: number; satuan: string; tarif: number; honor: number; bulan_kegiatan: string; bulan_honor: string }[];
};
