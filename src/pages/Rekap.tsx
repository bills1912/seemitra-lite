import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ChevronDown, Download, FileSignature, Wallet } from 'lucide-react';
import { api, unduhFile } from '../lib/api';
import type { BarisRekap } from '../lib/types';
import { useUmpan } from '../components/umpan';
import { AngkaHidup, Avatar, Batang, KepalaHalaman, Kartu, Kosong, Kotak, KotakCari, Kerangka, Paginasi, PemilihBulan, Segmen, Tombol, cx } from '../components/ui';
import { angka, bulanIni, cocok, labelBulan, rupiah } from '../lib/format';
import { jumlahPerPeran, persen, statusSbml, statusTerburuk, type PetaSbml } from '../lib/sbml';

type DataRekap = { bulan: string; dasar: 'kegiatan' | 'bayar'; baris: BarisRekap[]; kegiatan: { id: number; nama: string; satuan: string; petugas: number; total: number }[]; sbml: PetaSbml; ambang: number };

export function Rekap() {
  const [param, setParam] = useSearchParams();
  const bulan = param.get('bulan') ?? bulanIni();
  // dasar: 'kegiatan' = bulan pelaksanaan (SBML, SPK, BAST) · 'bayar' = bulan pembayaran honor
  const dasar = param.get('dasar') === 'bayar' ? 'bayar' : 'kegiatan';
  const setBulan = (b: string) => setParam({ bulan: b, ...(dasar === 'bayar' ? { dasar } : {}) }, { replace: true });
  const setDasar = (d: string) => setParam({ bulan, ...(d === 'bayar' ? { dasar: d } : {}) }, { replace: true });
  const [q, setQ] = useState('');
  const [hanyaLebih, setHanyaLebih] = useState(param.get('lewat') === '1');
  const [buka, setBuka] = useState<number | null>(null);
  const { beritahu } = useUmpan();
  const { data, isFetching } = useQuery({ queryKey: ['rekap', bulan, dasar], queryFn: () => api.get<DataRekap>(`/rekap?bulan=${bulan}&dasar=${dasar}`), placeholderData: (p) => p });

  const sbml = data?.sbml ?? {};
  const ambang = data?.ambang ?? 80;
  // SBML hanya dicek pada rekap per bulan kegiatan
  const adaSbml = dasar === 'kegiatan' && Object.keys(sbml).length > 0;
  // status SBML setiap mitra: dicek per peran untuk bulan ini
  const semua = useMemo(() => (data?.baris ?? []).map((b) => {
    const per = jumlahPerPeran(b.tugas);
    return { ...b, per, terburuk: statusTerburuk(per, dasar === 'kegiatan' ? data?.sbml ?? {} : {}, data?.ambang ?? 80) };
  }), [data, dasar]);
  const baris = semua.filter((b) => (!hanyaLebih || b.terburuk.status === 'lewat') && (!q || cocok(`${b.nama} ${b.sobat_id ?? ''} ${b.kecamatan ?? ''}`, q)));
  const total = semua.reduce((s, b) => s + b.total, 0);
  const lebih = semua.filter((b) => b.terburuk.status === 'lewat').length;
  const dekat = semua.filter((b) => b.terburuk.status === 'dekat').length;

  return (
    <div>
      <KepalaHalaman judul="Rekap Honor Bulanan" sub={dasar === 'kegiatan' ? 'Honor setiap mitra menurut bulan pelaksanaan kegiatan — dasar pengecekan SBML, SPK & BAST.' : 'Honor setiap mitra yang dibayarkan pada bulan ini (bulan pembayaran).'}
        aksi={<>
          <Segmen id="dasar-rekap" nilai={dasar} ubah={setDasar} opsi={[{ nilai: 'kegiatan', label: 'Bulan kegiatan' }, { nilai: 'bayar', label: 'Bulan pembayaran' }]} />
          <PemilihBulan nilai={bulan} ubah={setBulan} />
          <Tombol varian="kedua" ikon={<Download className="size-4" />} onClick={() => unduhFile(`/rekap/ekspor?bulan=${bulan}&dasar=${dasar}`).catch((e) => beritahu('galat', e.message))}>Ekspor Excel</Tombol>
          {dasar === 'kegiatan' && <Link to={`/dokumen?bulan=${bulan}`}><Tombol ikon={<FileSignature className="size-4" />}>SPK & BAST</Tombol></Link>}
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ['Total honor', <AngkaHidup key="a" nilai={total} format={rupiah} />],
          ['Mitra menerima honor', <AngkaHidup key="b" nilai={data?.baris.length ?? 0} />],
          ['Kegiatan', <AngkaHidup key="c" nilai={data?.kegiatan.length ?? 0} />],
          [dasar === 'bayar' ? 'Status SBML' : 'Melebihi SBML', dasar === 'bayar' ? <button key="d" onClick={() => setDasar('kegiatan')} className="text-base text-brand-700 underline">lihat per bulan kegiatan</button> : adaSbml ? <span key="d" className={lebih ? 'text-rose-600' : 'text-emerald-600'}><AngkaHidup nilai={lebih} /> <span className="text-sm font-semibold text-stone-400">mitra{dekat ? ` · ${dekat} mendekati` : ''}</span></span> : <Link key="d" to="/pengaturan?tab=batas" className="text-base text-brand-700 underline">Atur SBML</Link>],
        ].map(([l, v], i) => (
          <Kartu key={i} className="p-3.5 sm:p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="text-[13px] font-semibold text-stone-500">{l}</div>
            <div className="mt-1 text-base font-extrabold tracking-tight text-stone-900 sm:text-xl">{v}</div>
          </Kartu>
        ))}
      </div>

      {adaSbml && (
        <p className="-mt-2 mb-4 text-xs text-stone-500">SBML {bulan.slice(0, 4)} per bulan: {Object.entries(sbml).map(([p, v]) => `${p} ${rupiah(v)}`).join(' · ')} — dicek per peran untuk setiap bulan.</p>
      )}
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
          {adaSbml && <Kotak aktif={hanyaLebih} ubah={setHanyaLebih} label="Hanya yang melebihi SBML" />}
          {isFetching && <span className="text-xs text-stone-400 sm:ml-auto">memperbarui…</span>}
        </div>
        {!data ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Kerangka key={i} className="h-14" />)}</div> : baris.length === 0 ? (
          <Kosong ikon={<Wallet className="size-7" />} judul={data.baris.length ? 'Tidak ada yang cocok' : `Belum ada honor untuk ${labelBulan(bulan)}`}
            pesan={data.baris.length ? undefined : dasar === 'kegiatan' ? 'Honor muncul di sini setelah mitra ditugaskan pada kegiatan yang dilaksanakan di bulan ini.' : 'Belum ada honor yang dijadwalkan dibayar pada bulan ini.'} />
        ) : (
          <motion.ul key={bulan} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-stone-100">
            {baris.map((b, i) => {
              const terbuka = buka === b.mitra_id;
              const lewat = b.terburuk.status === 'lewat';
              const t = b.terburuk;
              return (
                <motion.li key={b.mitra_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 15) * 0.02 } }}>
                  <button onClick={() => setBuka(terbuka ? null : b.mitra_id)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-stone-50/70">
                    <span className="w-6 text-right text-xs font-semibold text-stone-300">{i + 1}</span>
                    <Avatar nama={b.nama} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="truncate font-semibold text-stone-800">{b.nama}</span>{lewat && <AlertTriangle className="size-4 shrink-0 text-rose-500" />}</div>
                      <div className="truncate text-xs text-stone-400">{b.tugas.length} tugas · {[...new Set(b.tugas.map((t) => t.kegiatan))].join(', ')}</div>
                    </div>
                    <div className="hidden w-48 sm:block">
                      {t.peran && <div className={cx('mb-1 text-right text-[11px] font-semibold', t.status === 'lewat' ? 'text-rose-600' : t.status === 'dekat' ? 'text-amber-600' : 'text-stone-400')}>{t.peran} {Math.round(t.rasio * 100)}% SBML</div>}
                      <Batang nilai={t.rasio} maks={t.peran ? 1 : null} ambang={ambang} tebal />
                    </div>
                    <span className={cx('angka w-32 text-right font-bold', lewat ? 'text-rose-600' : 'text-stone-800')}>{rupiah(b.total)}</span>
                    <motion.span animate={{ rotate: terbuka ? 180 : 0 }}><ChevronDown className="size-4 text-stone-400" /></motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {terbuka && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} className="overflow-hidden">
                        <div className="mx-4 mb-4 rounded-2xl bg-stone-50 p-4 sm:ml-[4.5rem]">
                          {adaSbml && (
                            <div className="mb-3 flex flex-wrap gap-2">
                              {Object.entries(b.per).map(([p, v]) => {
                                const st = statusSbml(v, sbml[p], ambang);
                                return (
                                  <span key={p} className={cx('rounded-lg px-2.5 py-1 text-xs font-semibold', st === 'lewat' ? 'bg-rose-100 text-rose-700' : st === 'dekat' ? 'bg-amber-100 text-amber-800' : 'bg-white text-stone-600')}>
                                    {p}: {rupiah(v)}{sbml[p] ? ` / ${rupiah(sbml[p])} (${persen(v, sbml[p])}%)` : ' · SBML belum diatur'}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <RincianTugas tugas={b.tugas} dasar={dasar} />
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

/** Rincian kegiatan seorang mitra di rekap: 5 baris per halaman + pencarian */
const PER_HALAMAN_RINCIAN = 5;
function RincianTugas({ tugas, dasar }: { tugas: BarisRekap['tugas']; dasar: 'kegiatan' | 'bayar' }) {
  const [q, setQ] = useState('');
  const [halaman, setHalaman] = useState(1);
  const cocokQ = tugas.filter((t) => !q || cocok(`${t.kegiatan} ${t.peran}`, q));
  const jumlahHalaman = Math.max(1, Math.ceil(cocokQ.length / PER_HALAMAN_RINCIAN));
  const hal = Math.min(halaman, jumlahHalaman);
  const tampil = cocokQ.slice((hal - 1) * PER_HALAMAN_RINCIAN, hal * PER_HALAMAN_RINCIAN);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <KotakCari nilai={q} ubah={(v) => { setQ(v); setHalaman(1); }} placeholder="Cari kegiatan atau peran…" className="w-full sm:max-w-xs" />
        <span className="text-xs text-stone-400">{tugas.length} kegiatan · total {rupiah(cocokQ.reduce((s, t) => s + t.honor, 0))}{q ? ' (hasil pencarian)' : ''}</span>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-stone-400"><th className="pb-2 font-semibold">Kegiatan</th><th className="pb-2 font-semibold">{dasar === 'kegiatan' ? 'Dibayar' : 'Bulan kegiatan'}</th><th className="pb-2 font-semibold">Peran</th><th className="pb-2 text-right font-semibold">Volume</th><th className="pb-2 text-right font-semibold">Tarif</th><th className="pb-2 text-right font-semibold">Honor</th></tr></thead>
        <AnimatePresence mode="wait" initial={false}>
          <motion.tbody key={`${hal}-${q}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
            {tampil.map((t, j) => (
              <tr key={j} className="border-t border-stone-200/60">
                <td className="py-2"><Link to={`/kegiatan/${t.kegiatan_id}`} className="font-medium text-stone-700 hover:text-brand-700">{t.kegiatan}</Link></td>
                <td className="py-2 text-xs text-stone-500">{labelBulan(dasar === 'kegiatan' ? t.bulan_honor : t.bulan_kegiatan)}</td>
                <td className="py-2 text-stone-500">{t.peran}</td>
                <td className="angka py-2 text-right">{angka(t.volume)} {t.satuan}</td>
                <td className="angka py-2 text-right">{rupiah(t.tarif)}</td>
                <td className="angka py-2 text-right font-semibold">{rupiah(t.honor)}</td>
              </tr>
            ))}
            {tampil.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-xs text-stone-400">Tidak ada kegiatan yang cocok.</td></tr>}
          </motion.tbody>
        </AnimatePresence>
      </table>
      <Paginasi halaman={hal} total={cocokQ.length} perHalaman={PER_HALAMAN_RINCIAN} ubah={setHalaman} className="mt-2 border-t border-stone-200/60 pt-2" />
    </div>
  );
}
