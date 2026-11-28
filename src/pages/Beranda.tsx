import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { CalendarCheck, Coins, HandCoins, UsersThree } from '@phosphor-icons/react';
import { IlustrasiHonor } from '../components/IlustrasiHonor';
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, FileSignature, Info, Plus, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import type { Pengguna } from '../lib/types';
import { AngkaHidup, Kartu, Kerangka, Lencana, Tombol, cx, urutan } from '../components/ui';
import { BULAN_PENDEK, LABEL_STATUS, labelBulan, rentang, rupiah, rupiahRingkas, sapaan, statusKegiatan, tanggal } from '../lib/format';

type DataBeranda = {
  hari: string; bulan: string;
  statistik: { mitra_aktif: number; kegiatan_berjalan: number; kegiatan_tahun_ini: number; honor_bulan_ini: number; mitra_bertugas_bulan_ini: number; bayar_bulan_ini: number; mitra_dibayar_bulan_ini: number };
  grafik: { bulan: string; total: number; mitra: number }[];
  kegiatanAktif: { id: number; nama: string; tanggal_mulai: string; tanggal_selesai: string; bulan_honor: string; bulan_kegiatan: string; seri_id: number | null; target_petugas: number | null; jumlah_petugas: number }[];
  perhatian: { jenis: 'bahaya' | 'peringatan' | 'info'; judul: string; detail: string; tautan: string }[];
  pengguna: Pengguna;
};

export function Beranda() {
  const { data } = useQuery({ queryKey: ['beranda'], queryFn: () => api.get<DataBeranda>('/beranda') });
  const nav = useNavigate();

  if (!data)
    return (
      <div className="space-y-6">
        <Kerangka className="h-16 w-80" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Kerangka key={i} className="h-32" />)}</div>
        <Kerangka className="h-72" />
      </div>
    );

  const s = data.statistik;
  const kartu = [
    { label: 'Mitra aktif', nilai: s.mitra_aktif, ikon: UsersThree, warna: 'from-teal-500 to-emerald-500', ke: '/mitra' },
    { label: 'Kegiatan berjalan', nilai: s.kegiatan_berjalan, ikon: CalendarCheck, warna: 'from-sky-500 to-indigo-500', ke: '/kegiatan', sub: `${s.kegiatan_tahun_ini} kegiatan tahun ini` },
    { label: `Honor kegiatan ${labelBulan(data.bulan)}`, nilai: s.honor_bulan_ini, ikon: Coins, warna: 'from-amber-500 to-orange-500', ke: '/rekap', uang: true, sub: `${s.mitra_bertugas_bulan_ini} mitra bertugas` },
    { label: `Dibayar ${labelBulan(data.bulan)}`, nilai: s.bayar_bulan_ini, ikon: HandCoins, warna: 'from-rose-500 to-pink-500', ke: `/rekap?bulan=${data.bulan}&dasar=bayar`, uang: true, sub: `${s.mitra_dibayar_bulan_ini} mitra menerima pembayaran` },
  ];
  const maksGrafik = Math.max(1, ...data.grafik.map((g) => g.total));
  const totalGrafik = data.grafik.reduce((a, g) => a + g.total, 0);
  const namaDepan = data.pengguna.nama.split(' ')[0];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-semibold text-brand-700">{tanggal(data.hari)}</motion.p>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
            {sapaan()}, {namaDepan} <motion.span className="inline-block origin-[70%_70%]" animate={{ rotate: [0, 16, -8, 14, 0] }} transition={{ delay: 0.4, duration: 1.2 }}>👋</motion.span>
          </h1>
          <p className="mt-1 text-stone-500">Berikut ringkasan administrasi mitra hari ini.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/mitra?baru=1"><Tombol varian="kedua" ikon={<UserPlus className="size-4" />}>Mitra</Tombol></Link>
          <Link to="/kegiatan?baru=1"><Tombol varian="kedua" ikon={<Plus className="size-4" />}>Kegiatan</Tombol></Link>
          <Link to="/dokumen"><Tombol ikon={<FileSignature className="size-4" />}>Buat SPK / BAST</Tombol></Link>
        </div>
      </div>

      <motion.div variants={urutan.wadah} initial="awal" animate="tampil" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kartu.map((k) => (
          <motion.div key={k.label} variants={urutan.anak} whileHover={{ y: -3 }}>
            <Link to={k.ke}>
              <Kartu className="group relative h-full overflow-hidden p-3.5 sm:p-5">
                <div className={cx('mb-3 grid size-9 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm sm:mb-4 sm:size-11 sm:rounded-2xl', k.warna)}><k.ikon className="size-5 sm:size-6" weight="duotone" /></div>
                <div className="text-xs font-semibold text-stone-500 sm:text-[13px]">{k.label}</div>
                <div className="mt-0.5 truncate text-lg font-extrabold tracking-tight text-stone-900 sm:text-2xl xl:text-[26px]">
                  <AngkaHidup nilai={k.nilai} format={k.uang ? (n) => rupiah(n) : undefined} />
                </div>
                {k.sub && <div className="mt-0.5 text-xs text-stone-400">{k.sub}</div>}
                <ArrowRight className="absolute right-4 top-5 size-4 sm:right-5 sm:top-6 text-stone-300 transition group-hover:translate-x-1 group-hover:text-brand-500" />
              </Kartu>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Kartu className="relative overflow-hidden p-4 sm:p-6 xl:col-span-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-brand-100/60 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold text-stone-900">Honor mitra per bulan kegiatan · {data.bulan.slice(0, 4)}</h2>
              <p className="mt-0.5 text-sm text-stone-500">Total tahun ini</p>
              <p className="text-2xl font-extrabold tracking-tight text-brand-700 sm:text-3xl"><AngkaHidup nilai={totalGrafik} format={(n) => rupiah(n)} /></p>
              <p className="mt-1 text-xs text-stone-400">Klik batang untuk melihat rekap bulan itu</p>
            </div>
            <IlustrasiHonor className="-mr-1 -mt-2 hidden h-24 w-40 shrink-0 sm:block lg:h-28 lg:w-48" />
          </div>
          {totalGrafik === 0 ? (
            <div className="relative flex h-48 flex-col items-center justify-center text-center sm:h-56">
              <IlustrasiHonor className="h-24 w-40 opacity-80 sm:hidden" />
              <p className="mt-2 font-semibold text-stone-600">Belum ada honor di tahun ini</p>
              <p className="text-sm text-stone-400">Tambahkan petugas ke kegiatan, grafik akan terisi otomatis.</p>
            </div>
          ) : (
            <div className="relative mt-4">
              {/* garis bantu */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
                {[0, 1, 2, 3].map((g) => <div key={g} className="border-t border-dashed border-stone-200/80" />)}
              </div>
              <div className="relative flex h-48 items-end gap-1 sm:h-56 sm:gap-2.5">
                {data.grafik.map((g, i) => {
                  const ini = g.bulan === data.bulan;
                  const puncak = g.total > 0 && g.total === maksGrafik;
                  return (
                    <button key={g.bulan} onClick={() => nav(`/rekap?bulan=${g.bulan}`)} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <span className={cx('pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-lg bg-stone-900 px-2 py-1 text-[11px] font-semibold text-white shadow group-hover:block', i < 3 ? 'left-0' : i > 8 ? 'right-0' : '')}>
                        {rupiah(g.total)} · {g.mitra} mitra
                      </span>
                      {puncak && <span className="pointer-events-none whitespace-nowrap text-[10px] font-bold text-brand-700 group-hover:invisible sm:text-[11px]">{rupiahRingkas(g.total)}</span>}
                      <motion.div
                        className={cx('relative w-full max-w-10 rounded-t-xl rounded-b-md transition-all',
                          g.total ? (ini ? 'bg-gradient-to-t from-brand-600 to-brand-400 shadow-md shadow-brand-500/20' : 'bg-gradient-to-t from-brand-300 to-brand-200 group-hover:from-brand-400 group-hover:to-brand-300') : 'bg-stone-100')}
                        initial={{ height: 0 }} animate={{ height: `${Math.max(3, (g.total / maksGrafik) * 100)}%` }}
                        transition={{ delay: 0.2 + i * 0.04, type: 'spring', stiffness: 140, damping: 20 }}
                      >
                        {ini && g.total > 0 && <span className="absolute inset-x-0 top-1.5 mx-auto size-1.5 rounded-full bg-amber-300" />}
                      </motion.div>
                      <span className={cx('text-[11px] font-semibold', ini ? 'rounded-full bg-brand-50 px-1.5 text-brand-700' : 'text-stone-400')}>{BULAN_PENDEK[i]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Kartu>

        <Kartu className="p-4 sm:p-6 xl:col-span-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="mb-4 font-bold text-stone-900">Perlu perhatian</h2>
          {data.perhatian.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.3 }}><CheckCircle2 className="size-12 text-emerald-400" /></motion.div>
              <p className="mt-3 font-semibold text-stone-700">Semua beres!</p>
              <p className="text-sm text-stone-400">Tidak ada yang perlu ditindaklanjuti.</p>
            </div>
          ) : (
            <motion.ul variants={urutan.wadah} initial="awal" animate="tampil" className="space-y-2">
              {data.perhatian.map((p, i) => (
                <motion.li key={i} variants={urutan.anak}>
                  <Link to={p.tautan} className={cx('flex gap-3 rounded-xl p-3 transition hover:brightness-[0.97]',
                    p.jenis === 'bahaya' ? 'bg-rose-50' : p.jenis === 'peringatan' ? 'bg-amber-50' : 'bg-sky-50')}>
                    {p.jenis === 'bahaya' ? <AlertOctagon className="size-5 shrink-0 text-rose-500" /> : p.jenis === 'peringatan' ? <AlertTriangle className="size-5 shrink-0 text-amber-500" /> : <Info className="size-5 shrink-0 text-sky-500" />}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-800">{p.judul}</div>
                      <div className="text-xs text-stone-500">{p.detail}</div>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </Kartu>
      </div>

      <Kartu className="mt-6 p-4 sm:p-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-stone-900">Kegiatan berjalan & 30 hari ke depan</h2>
          <Link to="/kegiatan" className="text-sm font-semibold text-brand-700 hover:underline">Semua kegiatan</Link>
        </div>
        {data.kegiatanAktif.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">Belum ada kegiatan dalam waktu dekat. <Link to="/kegiatan?baru=1" className="font-semibold text-brand-700">Tambah kegiatan</Link></p>
        ) : (
          <motion.div variants={urutan.wadah} initial="awal" animate="tampil" className="divide-y divide-stone-100">
            {data.kegiatanAktif.map((k) => {
              const st = statusKegiatan(k);
              const persen = k.target_petugas ? Math.min(100, (k.jumlah_petugas / k.target_petugas) * 100) : null;
              return (
                <motion.div key={k.id} variants={urutan.anak}>
                  <Link to={`/kegiatan/${k.id}`} className="-mx-2 flex flex-col gap-2 rounded-xl px-2 py-3 transition hover:bg-stone-50 sm:flex-row sm:items-center sm:gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-stone-800">{k.nama}</div>
                      <div className="text-xs text-stone-400">{rentang(k.tanggal_mulai, k.tanggal_selesai)}{k.seri_id ? ' · bulanan' : ''} · dibayar {labelBulan(k.bulan_honor)}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-36">
                        <div className="mb-1 flex justify-between text-xs"><span className="text-stone-500">Petugas</span><span className="font-semibold text-stone-700">{k.jumlah_petugas}{k.target_petugas ? ` / ${k.target_petugas}` : ''}</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                          <motion.div className="h-full rounded-full bg-brand-500" initial={{ width: 0 }} animate={{ width: `${persen ?? (k.jumlah_petugas ? 100 : 0)}%` }} transition={{ duration: 0.8 }} />
                        </div>
                      </div>
                      <Lencana warna={st === 'berjalan' ? 'hijau' : 'biru'} titik>{LABEL_STATUS[st]}</Lencana>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </Kartu>
    </div>
  );
}
