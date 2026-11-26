/** Tata letak utama: menu samping, bilah atas, dan pencarian cepat (Ctrl+K). */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, CalendarDays, CornerDownLeft, FileSignature, Home, LogOut, Menu, Plus, Search, Settings, Users, Wallet, X,
} from 'lucide-react';
import { api, queryClient } from '../lib/api';
import type { Pengguna } from '../lib/types';
import { Avatar, cx, pegas } from './ui';
import { labelBulan } from '../lib/format';

export const MENU = [
  { ke: '/', label: 'Beranda', ikon: Home },
  { ke: '/mitra', label: 'Mitra', ikon: Users },
  { ke: '/kegiatan', label: 'Kegiatan', ikon: CalendarDays },
  { ke: '/rekap', label: 'Rekap Honor', ikon: Wallet },
  { ke: '/dokumen', label: 'SPK & BAST', ikon: FileSignature },
  { ke: '/pengaturan', label: 'Pengaturan', ikon: Settings },
  { ke: '/panduan', label: 'Panduan', ikon: BookOpen },
];

export function Tata({ pengguna, children }: { pengguna: Pengguna; children: ReactNode }) {
  const [laci, setLaci] = useState(false);
  const [cari, setCari] = useState(false);
  const lokasi = useLocation();
  useEffect(() => setLaci(false), [lokasi.pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCari((v) => !v); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const keluar = async () => {
    await api.post('/auth/keluar');
    queryClient.clear();
    queryClient.setQueryData(['saya'], { pengguna: null, perluSetup: false });
  };

  const isiMenu = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <img src="/logo.svg" alt="" className="size-10" />
        <div>
          <div className="text-[17px] font-extrabold leading-tight tracking-tight text-stone-900">Seemitra <span className="text-brand-600">Lite</span></div>
          <div className="text-xs font-medium text-stone-400">Administrasi Mitra</div>
        </div>
      </div>
      <button onClick={() => setCari(true)} className="mx-4 mb-4 flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-400 transition hover:border-stone-300">
        <Search className="size-4" /> <span className="flex-1 text-left">Cari cepat…</span>
        <kbd className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-500">Ctrl K</kbd>
      </button>
      <nav className="flex-1 space-y-0.5 px-3">
        {MENU.map((m) => (
          <NavLink key={m.ke} to={m.ke} end={m.ke === '/'} className="relative block">
            {({ isActive }) => (
              <span className={cx('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors', isActive ? 'text-brand-800' : 'text-stone-500 hover:bg-stone-100/70 hover:text-stone-800')}>
                {isActive && <motion.span layoutId="menu-aktif" transition={pegas} className="absolute inset-0 rounded-xl bg-brand-100/70" />}
                <m.ikon className="relative size-[19px]" strokeWidth={isActive ? 2.4 : 2} />
                <span className="relative">{m.label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lembut">
        <Avatar nama={pengguna.nama} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-stone-800">{pengguna.nama}</div>
          <div className="text-xs capitalize text-stone-400">{pengguna.peran}</div>
        </div>
        <button onClick={keluar} title="Keluar" className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"><LogOut className="size-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-stone-200/70 bg-stone-50/80 lg:block">{isiMenu}</aside>

      {/* bilah atas (layar kecil) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200/70 bg-kanvas/85 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setLaci(true)} className="rounded-xl p-2 hover:bg-stone-200/60"><Menu className="size-5" /></button>
        <img src="/logo.svg" alt="" className="size-8" />
        <span className="flex-1 font-extrabold">Seemitra <span className="text-brand-600">Lite</span></span>
        <button onClick={() => setCari(true)} className="rounded-xl p-2 hover:bg-stone-200/60"><Search className="size-5" /></button>
      </header>
      <AnimatePresence>
        {laci && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-stone-900/30" onClick={() => setLaci(false)} />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 330, damping: 34 }}
              className="absolute inset-y-0 left-0 w-72 bg-stone-50">
              <button onClick={() => setLaci(false)} className="absolute right-3 top-3 rounded-xl p-2 hover:bg-stone-200"><X className="size-5" /></button>
              {isiMenu}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          {/* Transisi halaman memakai animasi CSS (lihat .masuk-halaman di index.css):
              selalu selesai walau pengguna berpindah halaman dengan cepat. */}
          <div key={lokasi.pathname} className="masuk-halaman">{children}</div>
        </div>
      </main>

      <PencarianCepat buka={cari} tutup={() => setCari(false)} />
    </div>
  );
}

type Hasil = { mitra: { id: number; nama: string; sobat_id: string | null; kecamatan: string | null }[]; kegiatan: { id: number; nama: string; bulan_honor: string }[] };
type Item = { kunci: string; label: string; sub?: string; ikon: ReactNode; ke: string };

function PencarianCepat({ buka, tutup }: { buka: boolean; tutup: () => void }) {
  const [q, setQ] = useState('');
  const [pilih, setPilih] = useState(0);
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ['cari', q], queryFn: () => api.get<Hasil>(`/cari?q=${encodeURIComponent(q)}`), enabled: buka && q.trim().length > 0 });
  useEffect(() => { if (!buka) setQ(''); }, [buka]);

  const item = useMemo<Item[]>(() => {
    const aksi: Item[] = [
      { kunci: 'a1', label: 'Tambah mitra baru', ikon: <Plus className="size-4" />, ke: '/mitra?baru=1' },
      { kunci: 'a2', label: 'Tambah kegiatan baru', ikon: <Plus className="size-4" />, ke: '/kegiatan?baru=1' },
      ...MENU.map((m) => ({ kunci: m.ke, label: `Buka ${m.label}`, ikon: <m.ikon className="size-4" />, ke: m.ke })),
    ].filter((a) => !q || a.label.toLowerCase().includes(q.toLowerCase()));
    const m: Item[] = (data?.mitra ?? []).map((x) => ({ kunci: 'm' + x.id, label: x.nama, sub: [x.sobat_id, x.kecamatan].filter(Boolean).join(' · ') || 'Mitra', ikon: <Users className="size-4" />, ke: `/mitra?lihat=${x.id}` }));
    const k: Item[] = (data?.kegiatan ?? []).map((x) => ({ kunci: 'k' + x.id, label: x.nama, sub: `Honor ${labelBulan(x.bulan_honor)}`, ikon: <CalendarDays className="size-4" />, ke: `/kegiatan/${x.id}` }));
    return q ? [...m, ...k, ...aksi] : aksi;
  }, [data, q]);
  useEffect(() => setPilih(0), [item.length]);

  const pergi = (it?: Item) => { if (!it) return; nav(it.ke); tutup(); };

  return (
    <AnimatePresence>
      {buka && (
        <motion.div className="fixed inset-0 z-[55] flex items-start justify-center p-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={tutup} />
          <motion.div initial={{ y: -16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -10, scale: 0.97, opacity: 0 }} transition={pegas}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-melayang">
            <div className="flex items-center gap-3 border-b border-stone-100 px-5">
              <Search className="size-5 text-stone-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari mitra, kegiatan, atau menu…"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setPilih((p) => Math.min(p + 1, item.length - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setPilih((p) => Math.max(p - 1, 0)); }
                  if (e.key === 'Enter') pergi(item[pilih]);
                  if (e.key === 'Escape') tutup();
                }}
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-stone-400" />
            </div>
            <div className="scroll-tipis max-h-[50vh] overflow-y-auto p-2">
              {item.length === 0 && <p className="px-4 py-8 text-center text-sm text-stone-400">Tidak ada hasil untuk “{q}”.</p>}
              {item.map((it, i) => (
                <button key={it.kunci} onMouseEnter={() => setPilih(i)} onClick={() => pergi(it)}
                  className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left">
                  {i === pilih && <motion.span layoutId="cari-pilih" transition={pegas} className="absolute inset-0 rounded-xl bg-brand-50" />}
                  <span className="relative grid size-8 place-items-center rounded-lg bg-stone-100 text-stone-500">{it.ikon}</span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-800">{it.label}</span>
                    {it.sub && <span className="block truncate text-xs text-stone-400">{it.sub}</span>}
                  </span>
                  {i === pilih && <CornerDownLeft className="relative size-4 text-brand-500" />}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
