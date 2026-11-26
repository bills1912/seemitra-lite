/** Komponen untuk memilih banyak data sekaligus lalu menghapusnya (khusus admin). */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckSquare, Trash2, X } from 'lucide-react';
import { Jendela, Kotak, Tombol, pegas } from './ui';

/** Bilah mengambang di bawah layar saat mode pilih aktif */
export function BilahPilihan({ aktif, jumlah, totalTampil, pilihSemua, kosongkan, batal, hapus }: {
  aktif: boolean; jumlah: number; totalTampil: number; pilihSemua: () => void; kosongkan: () => void; batal: () => void; hapus: () => void;
}) {
  return createPortal(
    <AnimatePresence>
      {aktif && (
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={pegas}
          className="fixed inset-x-0 bottom-5 z-40 mx-auto flex w-fit max-w-[95vw] flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white/95 px-4 py-3 shadow-melayang backdrop-blur">
          <span className="flex items-center gap-2 text-sm font-semibold text-stone-700">
            <CheckSquare className="size-4 text-brand-600" />
            <motion.b key={jumlah} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="inline-block min-w-4 text-center text-brand-700">{jumlah}</motion.b> dipilih
          </span>
          <span className="mx-1 h-5 w-px bg-stone-200" />
          {jumlah < totalTampil
            ? <Tombol kecil varian="hantu" onClick={pilihSemua}>Pilih semua yang tampil ({totalTampil})</Tombol>
            : <Tombol kecil varian="hantu" onClick={kosongkan}>Kosongkan pilihan</Tombol>}
          <Tombol kecil varian="bahaya" disabled={!jumlah} ikon={<Trash2 className="size-3.5" />} onClick={hapus}>Hapus {jumlah || ''}</Tombol>
          <Tombol kecil varian="kedua" ikon={<X className="size-3.5" />} onClick={batal}>Selesai</Tombol>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Popup persetujuan sebelum menghapus banyak data */
export function JendelaHapusBanyak({ buka, tutup, jenis, nama, keterangan, memuat, setuju }: {
  buka: boolean; tutup: () => void; jenis: string; nama: string[]; keterangan?: ReactNode; memuat?: boolean; setuju: () => void;
}) {
  const [paham, setPaham] = useState(false);
  useEffect(() => { if (buka) setPaham(false); }, [buka]);
  return (
    <Jendela buka={buka} tutup={tutup} judul={`Hapus ${nama.length} ${jenis}?`} sub="Periksa kembali sebelum melanjutkan."
      kaki={<>
        <Tombol varian="kedua" onClick={tutup}>Batal</Tombol>
        <Tombol varian="bahaya" disabled={!paham} memuat={memuat} ikon={<Trash2 className="size-4" />} onClick={setuju}>Ya, hapus {nama.length} {jenis}</Tombol>
      </>}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">
          <ul className="scroll-tipis max-h-40 space-y-1 overflow-y-auto">
            {nama.slice(0, 50).map((n, i) => <li key={i} className="truncate">• {n}</li>)}
          </ul>
          {nama.length > 50 && <p className="mt-1 font-semibold">…dan {nama.length - 50} lainnya.</p>}
        </div>
        {keterangan && <div className="text-sm text-stone-600">{keterangan}</div>}
        <div className="rounded-xl border border-stone-200 p-3">
          <Kotak aktif={paham} ubah={setPaham} label={<span className="text-sm">Saya mengerti bahwa {nama.length} {jenis} di atas akan dihapus dan tidak lagi dihitung di rekap, SPK, maupun BAST.</span>} />
        </div>
      </div>
    </Jendela>
  );
}
