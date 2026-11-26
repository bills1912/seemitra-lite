import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, ChevronDown, FileSignature, Settings, UserPlus, Users, Wallet } from 'lucide-react';
import { KepalaHalaman, Kartu, cx, urutan } from '../components/ui';

const LANGKAH = [
  { ikon: Settings, judul: 'Atur sekali di awal', isi: 'Isi nama kantor & PPK, SBML per peran (PPL, PML, Pengolahan) untuk tahun berjalan, serta peran dan satuan yang dipakai.', ke: '/pengaturan', tombol: 'Buka Pengaturan' },
  { ikon: Users, judul: 'Daftarkan mitra', isi: 'Tambah mitra satu per satu atau impor sekaligus dari Excel. Mitra yang sudah ada akan diperbarui, tidak dobel.', ke: '/mitra', tombol: 'Buka Mitra' },
  { ikon: CalendarDays, judul: 'Buat kegiatan', isi: 'Isi nama, jadwal, satuan, dan tarif per peran. Bulan pembayaran terisi otomatis (n+1). Kegiatan yang ada setiap bulan cukup dibuat sekali dengan pilihan “Bulanan sepanjang tahun”.', ke: '/kegiatan', tombol: 'Buka Kegiatan' },
  { ikon: UserPlus, judul: 'Tugaskan petugas', isi: 'Di halaman kegiatan, klik “Tambah petugas”, centang mitra, pilih peran & volume. Popup peringatan muncul bila honor mitra untuk peran itu di bulan tersebut mendekati atau melebihi SBML.', ke: '/kegiatan', tombol: 'Pilih kegiatan' },
  { ikon: Wallet, judul: 'Periksa rekap honor', isi: 'Lihat total honor setiap mitra per bulan, siapa yang melebihi batas, lalu ekspor ke Excel untuk keuangan.', ke: '/rekap', tombol: 'Buka Rekap' },
  { ikon: FileSignature, judul: 'Cetak SPK & BAST', isi: 'Pilih bulan, isi tanggal, klik Buat. File Word langsung terunduh — satu dokumen untuk semua mitra, siap dicetak.', ke: '/dokumen', tombol: 'Buka SPK & BAST' },
];

const TANYA = [
  ['PPK berganti, apa yang harus diubah?', 'Cukup buka Pengaturan → Kantor & PPK, ganti nama dan NIP, lalu simpan. SPK & BAST berikutnya otomatis memakai nama baru.'],
  ['Saya ingin mengubah kalimat di SPK/BAST.', 'Buka Pengaturan → Template dokumen. Unduh template, edit di Microsoft Word (jangan hapus penanda seperti ${nama_mitra}), lalu unggah kembali. Aplikasi menguji template dulu; bila ada kesalahan, template lama tetap dipakai.'],
  ['Nomor SPK seorang mitra berubah?', 'Tidak. Nomor urut diberikan sekali per mitra per bulan dan tetap sama meski dokumen dibuat ulang. Mitra yang baru ditambahkan mendapat nomor berikutnya. Gunakan “Atur ulang nomor” bila ingin menomori ulang dari 1.'],
  ['Bulan mana yang dipakai untuk SPK, BAST, dan SBML?', 'Bulan kegiatan, yaitu bulan dari tanggal selesai kegiatan. Contoh: kegiatan 1–25 Februari masuk SPK & BAST Februari dan dicek terhadap SBML Februari. Bulan pembayaran (bawaan bulan berikutnya, misal Maret) dipakai untuk rekap pembayaran.'],
  ['Bagaimana dengan kegiatan yang ada setiap bulan?', 'Saat menambah kegiatan pilih “Bulanan sepanjang tahun”. Aplikasi membuat satu kegiatan per bulan dengan petugas masing-masing. Di halaman kegiatan ada pilihan bulan dan tombol “Salin petugas ke bulan berikutnya”. SPK & BAST tetap per bulan dan digabung dengan kegiatan lain.'],
  ['Saya salah menghapus data.', 'Saat menghapus, muncul tombol “Urungkan” selama beberapa detik. Mitra dan kegiatan yang terhapus juga bisa dipulihkan dari tautan “Lihat yang terhapus” di bagian bawah halaman masing-masing.'],
  ['Bagaimana jika data rusak atau hilang?', 'Server membuat cadangan otomatis setiap hari. Admin dapat memulihkannya di Pengaturan → Cadangan data. Disarankan juga mengunduh cadangan setiap bulan dan menyimpannya di Google Drive.'],
  ['Bagaimana menghapus banyak data sekaligus?', 'Admin dapat menekan tombol “Pilih” di halaman Mitra atau Kegiatan, mencentang data, lalu “Hapus”. Data masuk tempat sampah dan bisa diurungkan. Untuk mengosongkan semuanya secara permanen (mis. awal tahun), gunakan Pengaturan → Reset data; aplikasi membuat cadangan otomatis sebelum menghapus.'],
  ['Lupa kata sandi?', 'Minta admin membuka Pengaturan → Pengguna, lalu mengisi kata sandi baru untuk akun Anda.'],
  ['Bagaimana SBML dicek?', 'SBML diatur per peran (PPL, PML, Pengolahan) per tahun. Setiap bulan, honor seorang mitra untuk satu peran dijumlahkan dari semua kegiatan yang dilaksanakan (tanggal selesai) di bulan itu, lalu dibandingkan dengan SBML peran itu. Bulan berikutnya dihitung dari nol lagi.'],
  ['SBML terlewati, apakah penugasan ditolak?', 'Tidak. Saat memilih petugas muncul popup bila honor mitra sudah mendekati SBML (ambang bawaan 80%, bisa diubah). Saat mengisi volume/tarif di tabel, muncul popup bila honor jadi melebihi SBML. Anda bisa membatalkan atau tetap menyimpan.'],
];

export function Panduan() {
  const [buka, setBuka] = useState<number | null>(0);
  return (
    <div>
      <KepalaHalaman judul="Panduan" sub="Alur kerja administrasi mitra dari awal sampai SPK & BAST tercetak." />
      <motion.ol variants={urutan.wadah} initial="awal" animate="tampil" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {LANGKAH.map((l, i) => (
          <motion.li key={i} variants={urutan.anak}>
            <Kartu className="relative h-full overflow-hidden p-5" whileHover={{ y: -3 }}>
              <span className="absolute -right-2 -top-6 text-[96px] font-black leading-none text-stone-100">{i + 1}</span>
              <div className="relative">
                <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><l.ikon className="size-5" /></div>
                <h3 className="font-bold text-stone-900">{l.judul}</h3>
                <p className="mt-1 text-sm text-stone-500">{l.isi}</p>
                <Link to={l.ke} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">{l.tombol} →</Link>
              </div>
            </Kartu>
          </motion.li>
        ))}
      </motion.ol>

      <h2 className="mb-3 mt-10 text-lg font-bold text-stone-900">Pertanyaan yang sering muncul</h2>
      <Kartu className="divide-y divide-stone-100">
        {TANYA.map(([t, j], i) => (
          <div key={i}>
            <button onClick={() => setBuka(buka === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-stone-800 hover:bg-stone-50/60">
              {t}<motion.span animate={{ rotate: buka === i ? 180 : 0 }}><ChevronDown className="size-4 text-stone-400" /></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {buka === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <p className={cx('px-5 pb-4 text-sm leading-relaxed text-stone-600')}>{j}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </Kartu>
      <p className="mt-6 text-center text-xs text-stone-400">Panduan teknis (menjalankan & memperbaiki aplikasi) ada di file PANDUAN.md pada repositori GitHub.</p>
    </div>
  );
}
