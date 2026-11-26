import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ChevronDown, Download, FileSignature, Wallet } from 'lucide-react';
import { api, unduhFile } from '../lib/api';
import type { BarisRekap } from '../lib/types';
import { useUmpan } from '../components/umpan';
import { AngkaHidup, Avatar, Batang, KepalaHalaman, Kartu, Kosong, Kotak, KotakCari, Kerangka, PemilihBulan, Tombol, cx } from '../components/ui';
import { angka, bulanIni, cocok, labelBulan, rupiah } from '../lib/format';

type DataRekap = { bulan: string; baris: BarisRekap[]; kegiatan: { id: number; nama: string; satuan: string; petugas: number; total: number }[]; batas: number | null };

export function Rekap() {
  const [param, setParam] = useSearchParams();
  const bulan = param.get('bulan') ?? bulanIni();
  const setBulan = (b: string) => setParam({ bulan: b }, { replace: true });
  const [q, setQ] = useState('');
  const [hanyaLebih, setHanyaLebih] = useState(false);
  const [buka, setBuka] = useState<number | null>(null);
  const { beritahu } = useUmpan();
  const { data, isFetching } = useQuery({ queryKey: ['rekap', bulan], queryFn: () => api.get<DataRekap>(`/rekap?bulan=${bulan}`), placeholderData: (p) => p });

  const batas = data?.batas ?? null;
  const baris = useMemo(() => (data?.baris ?? []).filter((b) => (!hanyaLebih || (batas && b.total > batas)) && (!q || cocok(`${b.nama} ${b.sobat_id ?? ''} ${b.kecamatan ?? ''}`, q))), [data, q, hanyaLebih, batas]);
  const total = (data?.baris ?? []).reduce((s, b) => s + b.total, 0);
  const lebih = (data?.baris ?? []).filter((b) => batas && b.total > batas).length;

  return (
    <div>
      <KepalaHalaman judul="Rekap Honor Bulanan" sub="Total honor setiap mitra berdasarkan bulan pembayaran kegiatan."
        aksi={<>
          <PemilihBulan nilai={bulan} ubah={setBulan} />
          <Tombol varian="kedua" ikon={<Download className="size-4" />} onClick={() => unduhFile(`/rekap/ekspor?bulan=${bulan}`).catch((e) => beritahu('galat', e.message))}>Ekspor Excel</Tombol>
          <Link to={`/dokumen?bulan=${bulan}`}><Tombol ikon={<FileSignature className="size-4" />}>SPK & BAST</Tombol></Link>
        </>} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total honor', <AngkaHidup key="a" nilai={total} format={rupiah} />],
          ['Mitra menerima honor', <AngkaHidup key="b" nilai={data?.baris.length ?? 0} />],
          ['Kegiatan', <AngkaHidup key="c" nilai={data?.kegiatan.length ?? 0} />],
          ['Melebihi batas SBML', batas ? <span key="d" className={lebih ? 'text-rose-600' : 'text-emerald-600'}><AngkaHidup nilai={lebih} /> <span className="text-sm font-semibold text-stone-400">/ batas {rupiah(batas)}</span></span> : <Link key="d" to="/pengaturan?tab=batas" className="text-base text-brand-700 underline">Atur batas</Link>],
        ].map(([l, v], i) => (
          <Kartu key={i} className="p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="text-[13px] font-semibold text-stone-500">{l}</div>
            <div className="mt-1 text-xl font-extrabold tracking-tight text-stone-900">{v}</div>
          </Kartu>
        ))}
      </div>

      {data && data.kegiatan.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {data.kegiatan.map((k) => (
            <Link key={k.id} to={`/kegiatan/${k.id}`} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm transition hover:border-brand-300 hover:shadow-lembut">
              <span className="font-semibold text-stone-700">{k.nama}</span>
              <span className="ml-2 text-stone-400">{k.petugas} mitra · {rupiah(k.total)}</span>
            </Link>
          ))}
        </div>
      )}

      <Kartu className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-100 p-3 sm:flex-row sm:items-center">
          <KotakCari nilai={q} ubah={setQ} placeholder="Cari mitra…" className="flex-1 sm:max-w-sm" />
          {batas && <Kotak aktif={hanyaLebih} ubah={setHanyaLebih} label="Hanya yang melebihi batas" />}
          {isFetching && <span className="text-xs text-stone-400 sm:ml-auto">memperbarui…</span>}
        </div>
        {!data ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Kerangka key={i} className="h-14" />)}</div> : baris.length === 0 ? (
          <Kosong ikon={<Wallet className="size-7" />} judul={data.baris.length ? 'Tidak ada yang cocok' : `Belum ada honor untuk ${labelBulan(bulan)}`}
            pesan={data.baris.length ? undefined : 'Honor muncul di sini setelah mitra ditugaskan pada kegiatan dengan bulan honor ini.'} />
        ) : (
          <motion.ul key={bulan} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-stone-100">
            {baris.map((b, i) => {
              const terbuka = buka === b.mitra_id;
              const lewat = !!batas && b.total > batas;
              return (
                <motion.li key={b.mitra_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 15) * 0.02 } }}>
                  <button onClick={() => setBuka(terbuka ? null : b.mitra_id)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-stone-50/70">
                    <span className="w-6 text-right text-xs font-semibold text-stone-300">{i + 1}</span>
                    <Avatar nama={b.nama} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="truncate font-semibold text-stone-800">{b.nama}</span>{lewat && <AlertTriangle className="size-4 shrink-0 text-rose-500" />}</div>
                      <div className="truncate text-xs text-stone-400">{b.tugas.length} tugas · {[...new Set(b.tugas.map((t) => t.kegiatan))].join(', ')}</div>
                    </div>
                    <div className="hidden w-48 sm:block"><Batang nilai={b.total} maks={batas} tebal /></div>
                    <span className={cx('angka w-32 text-right font-bold', lewat ? 'text-rose-600' : 'text-stone-800')}>{rupiah(b.total)}</span>
                    <motion.span animate={{ rotate: terbuka ? 180 : 0 }}><ChevronDown className="size-4 text-stone-400" /></motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {terbuka && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} className="overflow-hidden">
                        <div className="mx-4 mb-4 rounded-2xl bg-stone-50 p-4 sm:ml-[4.5rem]">
                          <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs text-stone-400"><th className="pb-2 font-semibold">Kegiatan</th><th className="pb-2 font-semibold">Peran</th><th className="pb-2 text-right font-semibold">Volume</th><th className="pb-2 text-right font-semibold">Tarif</th><th className="pb-2 text-right font-semibold">Honor</th></tr></thead>
                            <tbody>
                              {b.tugas.map((t, j) => (
                                <tr key={j} className="border-t border-stone-200/60">
                                  <td className="py-2"><Link to={`/kegiatan/${t.kegiatan_id}`} className="font-medium text-stone-700 hover:text-brand-700">{t.kegiatan}</Link></td>
                                  <td className="py-2 text-stone-500">{t.peran}</td>
                                  <td className="angka py-2 text-right">{angka(t.volume)} {t.satuan}</td>
                                  <td className="angka py-2 text-right">{rupiah(t.tarif)}</td>
                                  <td className="angka py-2 text-right font-semibold">{rupiah(t.honor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                            <span>{[b.bank, b.no_rekening].filter(Boolean).join(' · ') || 'Rekening belum diisi'}</span>
                            <div className="flex gap-3">
                              <Link to={`/mitra?lihat=${b.mitra_id}`} className="font-semibold text-brand-700 hover:underline">Profil mitra</Link>
                              <Link to={`/dokumen?bulan=${bulan}&mitra=${b.mitra_id}`} className="font-semibold text-brand-700 hover:underline">SPK/BAST mitra ini</Link>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </Kartu>
    </div>
  );
}
