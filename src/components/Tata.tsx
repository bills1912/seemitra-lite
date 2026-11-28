/** Tata letak utama: menu samping, bilah atas, dan pencarian cepat (Ctrl+K). */
import { Kredit } from './Kredit';
import { Jam } from './Jam';
import { BookOpenText, CalendarDots, Coins, GearSix, House, Signature, UsersThree } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays, ChevronsLeft, CornerDownLeft, LogOut, Menu, Plus, Search, Users, X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Pengguna } from '../lib/types';
import { Avatar, cx, pegas } from './ui';
import { labelBulan } from '../lib/format';

const LEBAR_PENUH = 256;
const LEBAR_RINGKAS = 84;

/** Keterangan kecil yang muncul di kanan saat ikon disorot (dipakai saat menu dikecilkan). */
function Tip({ label, aktif = true, children }: { label: string; aktif?: boolean; children: ReactNode }) {
  if (!aktif) return <>{children}</>;
  return (
    <div className="group/tip relative">
      {children}
      <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition duration-150 group-hover/tip:translate-x-0 group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:translate-x-0 group-has-[:focus-visible]/tip:opacity-100">
        {label}
        <span className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rotate-45 bg-stone-900" />
      </span>
    </div>
  );
}

export const MENU = [
  { ke: '/', label: 'Beranda', ikon: House },
  { ke: '/mitra', label: 'Mitra', ikon: UsersThree },
  { ke: '/kegiatan', label: 'Kegiatan', ikon: CalendarDots },
  { ke: '/rekap', label: 'Rekap Honor', ikon: Coins },
  { ke: '/dokumen', label: 'SPK & BAST', ikon: Signature },
  { ke: '/pengaturan', label: 'Pengaturan', ikon: GearSix },
  { ke: '/panduan', label: 'Panduan', ikon: BookOpenText },
];

export function Tata({ pengguna, children }: { pengguna: Pengguna; children: ReactNode }) {
  const [laci, setLaci] = useState(false);
  // Menu samping bisa dikecilkan (hanya ikon). Pilihan disimpan di browser ini.
  const [ringkas, setRingkas] = useState(() => { try { return localStorage.getItem('seemitra-menu-ringkas') === '1'; } catch { return false; } });
  const ubahRingkas = (v: boolean) => { setRingkas(v); try { localStorage.setItem('seemitra-menu-ringkas', v ? '1' : '0'); } catch { /* abaikan */ } };
  const [cari, setCari] = useState(false);
  const lokasi = useLocation();
  useEffect(() => setLaci(false), [lokasi.pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCari((v) => !v); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); setRingkas((v) => { try { localStorage.setItem('seemitra-menu-ringkas', v ? '0' : '1'); } catch { /* */ } return !v; }); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const [keluarProses, setKeluarProses] = useState(false);
  const keluar = async () => {
    setKeluarProses(true);
    try { await api.post('/auth/keluar'); } catch { /* tetap keluar walau jaringan bermasalah */ }
    // Muat ulang halaman agar semua data di memori bersih dan langsung kembali ke halaman masuk.
    window.location.replace('/');
  };

  const isiMenu = (ringkas: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cx('flex items-center gap-3 pb-6 pt-6', ringkas ? 'justify-center px-0' : 'px-5')}>
        <img src="/logo.svg" alt="" className="size-10 shrink-0" />
        {!ringkas && (
          <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }} className="min-w-0 whitespace-nowrap">
            <div className="text-[17px] font-extrabold leading-tight tracking-tight text-stone-900">Seemitra <span className="text-brand-600">Lite</span></div>
            <div className="text-xs font-medium text-stone-400">Administrasi Mitra</div>
          </motion.div>
        )}
      </div>
      {ringkas ? (
        <div className="mb-4 flex justify-center">
          <Tip label="Cari cepat (Ctrl K)">
            <button onClick={() => setCari(true)} className="grid size-11 place-items-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-800">
              <Search className="size-[18px]" />
            </button>
          </Tip>
        </div>
      ) : (
        <button onClick={() => setCari(true)} className="mx-4 mb-4 flex items-center gap-2.5 whitespace-nowrap rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-400 transition hover:border-stone-300">
          <Search className="size-4" /> <span className="flex-1 text-left">Cari cepat…</span>
          <kbd className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-500">Ctrl K</kbd>
        </button>
      )}
      <nav className={cx('flex-1 space-y-0.5', ringkas ? 'px-3' : 'px-3')}>
        {MENU.map((m) => (
          <Tip key={m.ke} label={m.label} aktif={ringkas}>
            <NavLink to={m.ke} end={m.ke === '/'} className="relative block" aria-label={m.label}>
              {({ isActive }) => (
                <span className={cx('relative flex items-center gap-3 rounded-xl py-2.5 text-[15px] font-semibold transition-colors', ringkas ? 'justify-center px-0' : 'px-3',
                  isActive ? 'text-brand-800' : 'text-stone-500 hover:bg-stone-100/70 hover:text-stone-800')}>
                  {isActive && <motion.span layoutId={ringkas ? 'menu-aktif-ringkas' : 'menu-aktif'} transition={pegas} className="absolute inset-0 rounded-xl bg-brand-100/70" />}
                  <m.ikon className="relative size-5 shrink-0" weight={isActive ? 'duotone' : 'regular'} />
                  {!ringkas && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.06 }} className="relative whitespace-nowrap">{m.label}</motion.span>}
                </span>
              )}
            </NavLink>
          </Tip>
        ))}
      </nav>
      {ringkas ? (
        <div className="mb-4 flex flex-col items-center gap-2">
          <Tip label={`${pengguna.nama} · ${pengguna.peran}`}><span className="block"><Avatar nama={pengguna.nama} /></span></Tip>
          <Tip label="Keluar">
            <button onClick={keluar} disabled={keluarProses} className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"><LogOut className="size-4" /></button>
          </Tip>
        </div>
      ) : (
        <div className="m-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lembut">
          <Avatar nama={pengguna.nama} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-stone-800">{pengguna.nama}</div>
            <div className="text-xs capitalize text-stone-400">{pengguna.peran}</div>
          </div>
          <button onClick={keluar} disabled={keluarProses} title="Keluar" className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"><LogOut className="size-4" /></button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh">
      <motion.aside initial={false} animate={{ width: ringkas ? LEBAR_RINGKAS : LEBAR_PENUH }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-stone-200/70 bg-stone-50/95 backdrop-blur lg:block">
        {isiMenu(ringkas)}
        <button onClick={() => ubahRingkas(!ringkas)} title={ringkas ? 'Lebarkan menu (Ctrl B)' : 'Kecilkan menu (Ctrl B)'} aria-label={ringkas ? 'Lebarkan menu' : 'Kecilkan menu'}
          className="absolute -right-3.5 top-9 grid size-7 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-lembut transition hover:scale-110 hover:border-brand-300 hover:text-brand-700">
          <motion.span animate={{ rotate: ringkas ? 180 : 0 }} transition={pegas}><ChevronsLeft className="size-4" /></motion.span>
        </button>
      </motion.aside>

      {/* bilah atas (layar kecil) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200/70 bg-kanvas/85 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setLaci(true)} className="rounded-xl p-2 hover:bg-stone-200/60"><Menu className="size-5" /></button>
        <img src="/logo.svg" alt="" className="size-8" />
        <span className="min-w-0 flex-1 truncate font-extrabold"><span className="hidden min-[400px]:inline">Seemitra <span className="text-brand-600">Lite</span></span></span>
        <Jam ringkas />
        <button onClick={() => setCari(true)} className="rounded-xl p-2 hover:bg-stone-200/60"><Search className="size-5" /></button>
      </header>
      <AnimatePresence>
        {laci && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-stone-900/30" onClick={() => setLaci(false)} />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 330, damping: 34 }}
              className="absolute inset-y-0 left-0 w-72 bg-stone-50">
              <button onClick={() => setLaci(false)} className="absolute right-3 top-3 rounded-xl p-2 hover:bg-stone-200"><X className="size-5" /></button>
              {isiMenu(false)}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="transition-[padding] duration-300 ease-out lg:pl-[var(--lebar-menu)]" style={{ '--lebar-menu': `${ringkas ? LEBAR_RINGKAS : LEBAR_PENUH}px` } as CSSProperties}>
        <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 pb-5 pt-6 sm:px-6 lg:px-10 lg:pt-5">
          {/* bilah atas (layar besar): jam waktu nyata */}
          <div className="mb-3 hidden justify-end lg:flex"><Jam /></div>
          {/* Transisi halaman memakai animasi CSS (lihat .masuk-halaman di index.css):
              selalu selesai walau pengguna berpindah halaman dengan cepat. */}
          {pengguna.peran === 'pengamat' && (
            <div className="mb-5 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-800">Anda masuk sebagai <b>pengamat</b>: bisa melihat data, tetapi tidak bisa mengubah, mengekspor, atau melihat NIK/rekening lengkap.</div>
          )}
          <div key={lokasi.pathname} className="masuk-halaman flex-1">{children}</div>
          <Kredit className="mt-10 border-t border-stone-200/70 pt-4" />
        </div>
      </main>

      <PencarianCepat buka={cari} tutup={() => setCari(false)} />
    </div>
  );
}

type Hasil = { mitra: { id: number; nama: string; sobat_id: string | null; kecamatan: string | null }[]; kegiatan: { id: number; nama: string; bulan_honor: string; bulan_kegiatan: string }[] };
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
    const k: Item[] = (data?.kegiatan ?? []).map((x) => ({ kunci: 'k' + x.id, label: x.nama, sub: `Bulan kegiatan ${labelBulan(x.bulan_kegiatan)} · dibayar ${labelBulan(x.bulan_honor)}`, ikon: <CalendarDays className="size-4" />, ke: `/kegiatan/${x.id}` }));
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
