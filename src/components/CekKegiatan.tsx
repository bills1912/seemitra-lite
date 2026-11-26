/**
 * CEK KEGIATAN MITRA
 * Menampilkan kegiatan apa saja yang sudah dialokasikan ke mitra pada BULAN KEGIATAN tertentu
 * (bulan honor kegiatan yang sedang diisi — bukan bulan hari ini), beserta honor dan siapa yang mengentri.
 */
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ClipboardList, FileSignature } from 'lucide-react';
import { api } from '../lib/api';
import { angka, cocok, labelBulan, rentang, rupiah } from '../lib/format';
import { jumlahPerPeran, persen, statusSbml, type PetaSbml } from '../lib/sbml';
import { AnimatePresence } from 'motion/react';
import { Avatar, KotakCari, Lencana, Memuat, Paginasi, TombolIkon, cx } from './ui';
import { Mengambang } from './pemilih';
import { X } from 'lucide-react';

export type BarisAlokasi = {
  id: number; mitra_id: number; nama: string; sobat_id: string | null; kegiatan_id: number; kegiatan: string;
  tanggal_mulai: string; tanggal_selesai: string; satuan: string; peran: string; volume: number; tarif: number; honor: number;
  dibuat_oleh: string | null; dibuat: string;
};
export type DataAlokasi = { bulan: string; rows: BarisAlokasi[]; sbml: PetaSbml; ambang: number; nomor: Record<string, string> };

export const useAlokasiBulan = (bulan: string, aktif = true) =>
  useQuery({ queryKey: ['alokasi', bulan], queryFn: () => api.get<DataAlokasi>(`/alokasi-bulan?bulan=${bulan}`), enabled: aktif && !!bulan });

/** Rincian kegiatan satu mitra (dipakai di dalam baris pemilih petugas) */
export function RincianMitra({ rows, data, kegiatanIni, semua }: {
  rows: BarisAlokasi[]; data: DataAlokasi; kegiatanIni?: number;
  /** Semua kegiatan mitra (untuk ringkasan honor per peran) bila `rows` hanya sebagian, mis. satu halaman */
  semua?: BarisAlokasi[];
}) {
  const per = jumlahPerPeran(semua ?? rows);
  const nomor = data.nomor[String((semua ?? rows)[0]?.mitra_id)];
  return (
    <div className="rounded-xl bg-stone-50 p-3 text-sm">
      <table className="w-full">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-stone-200/60 last:border-0">
              <td className="py-1.5 pr-2">
                <Link to={`/kegiatan/${r.kegiatan_id}`} className="font-semibold text-stone-700 hover:text-brand-700">{r.kegiatan}</Link>
                {r.kegiatan_id === kegiatanIni && <Lencana warna="brand" className="ml-1.5">kegiatan ini</Lencana>}
                <div className="text-xs text-stone-400">{rentang(r.tanggal_mulai, r.tanggal_selesai)}{r.dibuat_oleh ? ` · dientri ${r.dibuat_oleh}` : ''}</div>
              </td>
              <td className="py-1.5 pr-2 text-xs font-semibold text-stone-500">{r.peran}</td>
              <td className="angka py-1.5 pr-2 text-right text-xs text-stone-500">{angka(r.volume)} {r.satuan}</td>
              <td className="angka py-1.5 text-right font-semibold text-stone-700">{rupiah(r.honor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {Object.entries(per).map(([p, v]) => {
          const st = statusSbml(v, data.sbml[p], data.ambang);
          return (
            <span key={p} className={cx('rounded-md px-2 py-0.5 font-semibold', st === 'lewat' ? 'bg-rose-100 text-rose-700' : st === 'dekat' ? 'bg-amber-100 text-amber-800' : 'bg-white text-stone-600')}>
              {p} {rupiah(v)}{data.sbml[p] ? ` · ${persen(v, data.sbml[p])}% SBML` : ''}
            </span>
          );
        })}
        <span className="ml-auto flex items-center gap-1 text-stone-400"><FileSignature className="size-3.5" />{nomor ? `SPK No. ${nomor}` : 'nomor SPK diberikan saat SPK dibuat'}</span>
      </div>
    </div>
  );
}

/** Daftar lengkap semua mitra yang sudah dialokasikan pada bulan tsb */
export function DaftarAlokasiBulan({ bulan, q, kegiatanIni }: { bulan: string; q: string; kegiatanIni?: number }) {
  const { data } = useAlokasiBulan(bulan);
  const grup = useMemo(() => {
    const peta = new Map<number, BarisAlokasi[]>();
    for (const r of data?.rows ?? []) peta.set(r.mitra_id, [...(peta.get(r.mitra_id) ?? []), r]);
    return [...peta.values()].filter((rows) => !q || cocok(`${rows[0].nama} ${rows[0].sobat_id ?? ''} ${rows.map((r) => r.kegiatan).join(' ')}`, q));
  }, [data, q]);
  if (!data) return <Memuat />;
  if (!grup.length)
    return (
      <div className="flex flex-col items-center py-10 text-center text-sm text-stone-400">
        <ClipboardList className="mb-2 size-8 text-stone-300" />
        {data.rows.length ? 'Tidak ada mitra yang cocok dengan pencarian.' : `Belum ada mitra yang dialokasikan pada ${labelBulan(bulan)}.`}
      </div>
    );
  const total = grup.reduce((s, rows) => s + rows.reduce((a, r) => a + r.honor, 0), 0);
  return (
    <div>
      <p className="mb-2 text-xs text-stone-500">{grup.length} mitra sudah dialokasikan pada <b>{labelBulan(bulan)}</b> · total {rupiah(total)}</p>
      <ul className="scroll-tipis max-h-[42vh] space-y-2 overflow-y-auto pr-1">
        {grup.map((rows, i) => (
          <motion.li key={rows[0].mitra_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.02 } }}>
            <div className="mb-1.5 flex items-center gap-2.5">
              <Avatar nama={rows[0].nama} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-stone-800">{rows[0].nama}</div>
                <div className="text-xs text-stone-400">{rows.length} kegiatan · {rupiah(rows.reduce((a, r) => a + r.honor, 0))}</div>
              </div>
            </div>
            <RincianMitra rows={rows} data={data} kegiatanIni={kegiatanIni} />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/** Popup mengambang berisi rincian kegiatan satu mitra (tidak memanjangkan daftar; cukup digulir di dalam popup).
 *  Bila lebih dari 1 kegiatan: ada pencarian dan halaman berisi 3 kegiatan. */
const PER_HALAMAN_POPUP = 3;
export function PopupRincianMitra({ buka, tutup, jangkar, rows, data, kegiatanIni, nama, bulan }: {
  buka: boolean; tutup: () => void; jangkar: RefObject<HTMLElement | null>; rows: BarisAlokasi[]; data?: DataAlokasi; kegiatanIni?: number; nama: string; bulan: string;
}) {
  const [q, setQ] = useState('');
  const [halaman, setHalaman] = useState(1);
  useEffect(() => { setQ(''); setHalaman(1); }, [nama, buka]);
  const total = rows.reduce((s, r) => s + r.honor, 0);
  const banyak = rows.length > 1;
  const cocokQ = rows.filter((r) => !q || cocok(`${r.kegiatan} ${r.peran} ${r.dibuat_oleh ?? ''}`, q));
  const jumlahHalaman = Math.max(1, Math.ceil(cocokQ.length / PER_HALAMAN_POPUP));
  const hal = Math.min(halaman, jumlahHalaman);
  const tampil = banyak ? cocokQ.slice((hal - 1) * PER_HALAMAN_POPUP, hal * PER_HALAMAN_POPUP) : rows;
  return (
    <Mengambang buka={buka} tutup={tutup} jangkar={jangkar} lebar={480} tinggi={460}>
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-stone-900">{nama}</div>
          <div className="text-xs text-stone-500">Kegiatan di {labelBulan(bulan)} · {rows.length} kegiatan · {rupiah(total)}</div>
        </div>
        <TombolIkon label="Tutup" onClick={tutup} className="-mr-1 size-8"><X className="size-4" /></TombolIkon>
      </div>
      {banyak && (
        <div className="border-b border-stone-100 px-3 py-2">
          <KotakCari nilai={q} ubah={(v) => { setQ(v); setHalaman(1); }} placeholder="Cari kegiatan, peran, atau pengentri…" />
        </div>
      )}
      <div className="scroll-tipis max-h-80 overflow-y-auto p-3">
        {!data ? <Memuat /> : !rows.length ? (
          <p className="rounded-xl bg-stone-50 p-4 text-center text-xs text-stone-500">Belum dialokasikan ke kegiatan apa pun pada {labelBulan(bulan)}.</p>
        ) : !tampil.length ? (
          <p className="rounded-xl bg-stone-50 p-4 text-center text-xs text-stone-500">Tidak ada kegiatan yang cocok dengan “{q}”.</p>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${hal}-${q}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
              <RincianMitra rows={tampil} semua={rows} data={data} kegiatanIni={kegiatanIni} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      {banyak && cocokQ.length > PER_HALAMAN_POPUP && (
        <div className="border-t border-stone-100 px-3 py-2">
          <Paginasi halaman={hal} total={cocokQ.length} perHalaman={PER_HALAMAN_POPUP} ubah={setHalaman} />
        </div>
      )}
    </Mengambang>
  );
}
