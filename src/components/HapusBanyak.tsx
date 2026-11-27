/** Komponen untuk memilih banyak data sekaligus lalu menghapusnya (khusus admin). */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckSquare, Eraser, Trash2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Jendela, Kerangka, Kolom, Kotak, Masukan, Tombol, cx, pegas } from './ui';
import { api, segarkan } from '../lib/api';
import { useUmpan } from './umpan';

/** Bilah mengambang di bawah layar saat mode pilih aktif */
export function BilahPilihan({ aktif, jumlah, totalTampil, pilihSemua, kosongkan, batal, hapus, aksiLain }: {
  aktif: boolean; jumlah: number; totalTampil: number; pilihSemua: () => void; kosongkan: () => void; batal: () => void; hapus: () => void;
  /** tombol tambahan (mis. Hapus penugasan) */
  aksiLain?: ReactNode;
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
          {aksiLain}
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

type RingkasPenugasan = { penugasan: number; mitra: number; kegiatan: number; per_mitra: Record<string, number> };
type BarisPenugasan = Record<string, unknown>;

/**
 * Popup persetujuan untuk MENGHAPUS PENUGASAN mitra (data mitra & kegiatan tidak dihapus).
 * - mitra = daftar mitra terpilih  → hapus penugasan mitra tersebut
 * - mitra = 'semua'                 → reset penugasan seluruh mitra (wajib ketik HAPUS SEMUA, dibuat cadangan otomatis)
 */
export function JendelaHapusPenugasan({ buka, tutup, mitra, selesai }: {
  buka: boolean; tutup: () => void; mitra: { id: number; nama: string }[] | 'semua'; selesai?: () => void;
}) {
  const semua = mitra === 'semua';
  const ids = semua ? [] : mitra.map((m) => m.id);
  const [paham, setPaham] = useState(false);
  const [ketik, setKetik] = useState('');
  const [memuat, setMemuat] = useState(false);
  const { beritahu } = useUmpan();
  useEffect(() => { if (buka) { setPaham(false); setKetik(''); } }, [buka]);

  const { data: r, isLoading } = useQuery({
    queryKey: ['pratinjau-hapus-penugasan', semua ? 'semua' : ids.join(',')],
    queryFn: () => api.post<RingkasPenugasan>('/mitra/hapus-penugasan', semua ? { semua: true, pratinjau: true } : { ids, pratinjau: true }),
    enabled: buka && (semua || ids.length > 0), staleTime: 0, gcTime: 0,
  });
  const ada = (r?.penugasan ?? 0) > 0;
  const ketikBenar = ketik.trim().toUpperCase() === 'HAPUS SEMUA';
  const siap = ada && paham && (!semua || ketikBenar);
  const daftar = semua ? [] : [...mitra].sort((a, b) => (r?.per_mitra[b.id] ?? 0) - (r?.per_mitra[a.id] ?? 0));

  const setuju = async () => {
    setMemuat(true);
    try {
      const h = await api.post<{ jumlah: number; mitra: number; rows: BarisPenugasan[]; cadangan: string | null }>('/mitra/hapus-penugasan',
        semua ? { semua: true, konfirmasi: ketik } : { ids });
      segarkan();
      tutup();
      selesai?.();
      beritahu('sukses', <><b>{h.jumlah}</b> penugasan dari <b>{h.mitra}</b> mitra dihapus.</>, {
        urungkan: async () => { await api.post('/penugasan/pulihkan', { rows: h.rows }); segarkan(); },
      });
    } catch (e) { beritahu('galat', (e as Error).message); } finally { setMemuat(false); }
  };

  const judul = semua ? 'Reset penugasan seluruh mitra?' : `Hapus penugasan ${ids.length} mitra?`;
  return (
    <Jendela buka={buka} tutup={tutup} judul={judul} sub="Data mitra dan kegiatan tetap ada — hanya riwayat penugasannya yang dikosongkan."
      kaki={<>
        <Tombol varian="kedua" onClick={tutup}>Batal</Tombol>
        <Tombol varian="bahaya" disabled={!siap} memuat={memuat} ikon={<Eraser className="size-4" />} onClick={setuju}>
          {semua ? 'Ya, reset semua penugasan' : `Ya, hapus ${r?.penugasan ?? ''} penugasan`}
        </Tombol>
      </>}>
      <div className="space-y-4">
        {isLoading ? <Kerangka className="h-20" /> : (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Penugasan', r?.penugasan], ['Mitra', r?.mitra], ['Kegiatan', r?.kegiatan]].map(([l, n]) => (
              <div key={l as string} className="rounded-2xl bg-rose-50 px-2 py-3">
                <div className="angka text-xl font-bold text-rose-700">{(n as number) ?? 0}</div>
                <div className="text-xs font-semibold text-rose-900/70">{l as string}</div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && !ada && (
          <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">{semua ? 'Belum ada penugasan sama sekali.' : 'Mitra yang dipilih belum punya penugasan.'} Tidak ada yang perlu dihapus.</p>
        )}
        {!semua && ada && (
          <ul className="scroll-tipis max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-stone-200 p-3 text-sm">
            {daftar.slice(0, 50).map((m) => {
              const n = r?.per_mitra[m.id] ?? 0;
              return (
                <li key={m.id} className={cx('flex items-center justify-between gap-2', !n && 'text-stone-400')}>
                  <span className="truncate">{m.nama}</span>
                  <span className="angka shrink-0 text-xs">{n ? `${n} penugasan` : 'tidak ada'}</span>
                </li>
              );
            })}
            {daftar.length > 50 && <li className="font-semibold text-stone-500">…dan {daftar.length - 50} mitra lainnya.</li>}
          </ul>
        )}
        {ada && (
          <div className="text-sm text-stone-600">
            {semua
              ? <>Semua penugasan beserta <b>nomor SPK/BAST</b> yang sudah diberikan akan dikosongkan. Sebelum dihapus, aplikasi membuat <b>file cadangan otomatis</b> (Pengaturan → Cadangan data). Rekap, SPK, dan BAST semua bulan menjadi kosong.</>
              : <>Penugasan mitra di atas dihapus dari <b>semua kegiatan dan semua bulan</b>, sehingga tidak lagi muncul di rekap, SPK, maupun BAST. Anda masih bisa menekan <b>Urungkan</b> sesaat setelah menghapus.</>}
          </div>
        )}
        {ada && (
          <div className="rounded-xl border border-stone-200 p-3">
            <Kotak aktif={paham} ubah={setPaham} label={<span className="text-sm">Saya mengerti bahwa {r?.penugasan} penugasan dari {r?.mitra} mitra akan dihapus.</span>} />
          </div>
        )}
        {semua && ada && (
          <Kolom label='Ketik "HAPUS SEMUA" untuk melanjutkan'>
            <Masukan value={ketik} onChange={(e) => setKetik(e.target.value)} placeholder="HAPUS SEMUA" className={cx('font-mono', ketik && !ketikBenar && 'border-rose-300')} />
          </Kolom>
        )}
      </div>
    </Jendela>
  );
}
