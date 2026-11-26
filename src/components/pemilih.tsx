/**
 * PEMILIH KUSTOM — pengganti <select>, isian tanggal, isian bulan, dan saran isian bawaan browser,
 * supaya tampilannya seragam dengan tema aplikasi di semua browser.
 *
 * Semua panel pilihan "mengambang" dirender langsung ke <body> (portal) sehingga tidak terpotong
 * oleh jendela/modal atau tabel yang bisa digulir.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as KeyboardEventReact, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cx, pegas } from './ui';
import { BULAN, BULAN_PENDEK, hariIni } from '../lib/format';

/* ------------------------------------------------------------------ */
/* Panel mengambang                                                    */
/* ------------------------------------------------------------------ */
type Posisi = { top?: number; bottom?: number; left: number; width: number; keAtas: boolean };

function usePosisi(buka: boolean, jangkar: RefObject<HTMLElement | null>, lebar?: number, tinggiPerkiraan = 320) {
  const [pos, setPos] = useState<Posisi | null>(null);
  useLayoutEffect(() => {
    if (!buka) return;
    const hitung = () => {
      const el = jangkar.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = Math.max(r.width, lebar ?? 0);
      const ruangBawah = window.innerHeight - r.bottom;
      const keAtas = ruangBawah < tinggiPerkiraan && r.top > ruangBawah;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      setPos(keAtas ? { bottom: window.innerHeight - r.top + 6, left, width: w, keAtas } : { top: r.bottom + 6, left, width: w, keAtas });
    };
    hitung();
    window.addEventListener('resize', hitung);
    window.addEventListener('scroll', hitung, true);
    return () => {
      window.removeEventListener('resize', hitung);
      window.removeEventListener('scroll', hitung, true);
    };
  }, [buka, jangkar, lebar, tinggiPerkiraan]);
  return pos;
}

export function Mengambang({ buka, tutup, jangkar, lebar, tinggi, children, className }: {
  buka: boolean; tutup: () => void; jangkar: RefObject<HTMLElement | null>; lebar?: number; tinggi?: number; children: ReactNode; className?: string;
}) {
  const pos = usePosisi(buka, jangkar, lebar, tinggi);
  const panel = useRef<HTMLDivElement>(null);
  const refTutup = useRef(tutup);
  refTutup.current = tutup;

  useEffect(() => {
    if (!buka) return;
    const klik = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || jangkar.current?.contains(t)) return;
      refTutup.current();
    };
    // Esc menutup panel saja (tidak ikut menutup jendela/modal di belakangnya)
    const tombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); refTutup.current(); }
    };
    document.addEventListener('mousedown', klik);
    window.addEventListener('keydown', tombol, true);
    return () => {
      document.removeEventListener('mousedown', klik);
      window.removeEventListener('keydown', tombol, true);
    };
  }, [buka, jangkar]);

  return createPortal(
    <AnimatePresence>
      {buka && pos && (
        <motion.div
          ref={panel}
          initial={{ opacity: 0, y: pos.keAtas ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.keAtas ? 6 : -6, scale: 0.98, transition: { duration: 0.12 } }}
          transition={pegas}
          style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, transformOrigin: pos.keAtas ? 'bottom' : 'top' }}
          className={cx('z-[80] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-melayang', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Tampilan tombol yang menyerupai kotak isian */
const GAYA_PICU = 'input flex items-center gap-2 text-left cursor-pointer';

/* ------------------------------------------------------------------ */
/* Pilihan (pengganti <select>)                                        */
/* ------------------------------------------------------------------ */
type Opsi = string | { nilai: string; label: string };
const nilaiOpsi = (o: Opsi) => (typeof o === 'string' ? o : o.nilai);
const labelOpsi = (o: Opsi) => (typeof o === 'string' ? o : o.label);

export function Pilihan({ nilai, ubah, opsi, className, kosong, kecil, placeholder }: {
  nilai: string; ubah: (v: string) => void; opsi: Opsi[]; className?: string;
  /** Teks pilihan "kosong" (nilai ''), mis. "Semua kecamatan". */
  kosong?: string; kecil?: boolean; placeholder?: string;
}) {
  const [buka, setBuka] = useState(false);
  const [q, setQ] = useState('');
  const [sorot, setSorot] = useState(0);
  const jangkar = useRef<HTMLButtonElement>(null);
  const daftarRef = useRef<HTMLDivElement>(null);
  const semua: Opsi[] = useMemo(() => (kosong !== undefined ? [{ nilai: '', label: kosong }, ...opsi] : opsi), [opsi, kosong]);
  const pakaiCari = semua.length > 8;
  const tampil = q ? semua.filter((o) => labelOpsi(o).toLowerCase().includes(q.toLowerCase())) : semua;
  const terpilih = semua.find((o) => nilaiOpsi(o) === nilai);

  useEffect(() => {
    if (buka) { setQ(''); setSorot(Math.max(0, semua.findIndex((o) => nilaiOpsi(o) === nilai))); }
  }, [buka]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    daftarRef.current?.querySelector(`[data-i="${sorot}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sorot, buka]);

  const pilih = (o: Opsi) => { ubah(nilaiOpsi(o)); setBuka(false); jangkar.current?.focus(); };
  const keyDown = (e: KeyboardEventReact) => {
    if (!buka && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setBuka(true); return; }
    if (!buka) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSorot((s) => Math.min(s + 1, tampil.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSorot((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (tampil[sorot]) pilih(tampil[sorot]); }
    if (e.key === 'Tab') setBuka(false);
  };

  return (
    <div className={cx('relative', className)}>
      <button ref={jangkar} type="button" onClick={() => setBuka(!buka)} onKeyDown={keyDown} aria-haspopup="listbox" aria-expanded={buka}
        className={cx(kecil
          ? 'flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-stone-700 transition hover:border-stone-200 hover:bg-white focus:border-brand-400 focus:outline-none'
          : GAYA_PICU, buka && !kecil && 'border-brand-400 ring-4 ring-brand-100')}>
        <span className={cx('min-w-0 flex-1 truncate', !terpilih && 'text-stone-400')}>{terpilih ? labelOpsi(terpilih) : placeholder ?? 'Pilih…'}</span>
        <motion.span animate={{ rotate: buka ? 180 : 0 }} transition={pegas} className="shrink-0"><ChevronDown className="size-4 text-stone-400" /></motion.span>
      </button>
      <Mengambang buka={buka} tutup={() => setBuka(false)} jangkar={jangkar} lebar={kecil ? 160 : undefined}>
        {pakaiCari && (
          <div className="relative border-b border-stone-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSorot(0); }} onKeyDown={keyDown} placeholder="Cari…"
              className="w-full rounded-lg bg-stone-50 py-2 pl-8 pr-2 text-sm outline-none focus:bg-stone-100" />
          </div>
        )}
        <div ref={daftarRef} role="listbox" className="scroll-tipis max-h-64 overflow-y-auto p-1.5">
          {tampil.length === 0 && <p className="px-3 py-4 text-center text-sm text-stone-400">Tidak ada pilihan.</p>}
          {tampil.map((o, i) => {
            const aktif = nilaiOpsi(o) === nilai;
            return (
              <button key={nilaiOpsi(o) || '__kosong'} data-i={i} type="button" role="option" aria-selected={aktif}
                onMouseEnter={() => setSorot(i)} onClick={() => pilih(o)}
                className={cx('relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                  aktif ? 'font-semibold text-brand-800' : 'text-stone-700', i === sorot && 'bg-stone-100')}>
                <span className="flex-1 truncate">{labelOpsi(o)}</span>
                {aktif && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="size-4 text-brand-600" /></motion.span>}
              </button>
            );
          })}
        </div>
      </Mengambang>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pilih tanggal (pengganti <input type="date">)                       */
/* ------------------------------------------------------------------ */
const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Format ringkas agar muat di kolom sempit, mis. "Sen, 2 Nov 2026" */
export function labelTanggalPanjang(v: string) {
  const [y, m, d] = v.split('-').map(Number);
  const hari = NAMA_HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()].slice(0, 3);
  return `${hari}, ${d} ${BULAN_PENDEK[m - 1]} ${y}`;
}

export function PilihTanggal({ nilai, ubah, min, max, placeholder = 'Pilih tanggal', bolehKosong, className }: {
  nilai: string | null | undefined; ubah: (v: string) => void; min?: string; max?: string; placeholder?: string; bolehKosong?: boolean; className?: string;
}) {
  const [buka, setBuka] = useState(false);
  const jangkar = useRef<HTMLButtonElement>(null);
  const awal = nilai || min || hariIni();
  const [lihat, setLihat] = useState({ y: Number(awal.slice(0, 4)), m: Number(awal.slice(5, 7)) - 1 });
  const [arah, setArah] = useState(0);
  const [modeBulan, setModeBulan] = useState(false);
  useEffect(() => {
    if (buka) { const a = nilai || min || hariIni(); setLihat({ y: Number(a.slice(0, 4)), m: Number(a.slice(5, 7)) - 1 }); setModeBulan(false); }
  }, [buka]); // eslint-disable-line react-hooks/exhaustive-deps

  const geser = (n: number) => {
    setArah(n);
    setLihat(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  };
  const sel = useMemo(() => {
    const pertama = new Date(Date.UTC(lihat.y, lihat.m, 1));
    const geserAwal = (pertama.getUTCDay() + 6) % 7; // minggu dimulai Senin
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(Date.UTC(lihat.y, lihat.m, 1 - geserAwal + i));
      return { v: d.toISOString().slice(0, 10), tgl: d.getUTCDate(), bulanIni: d.getUTCMonth() === lihat.m };
    });
  }, [lihat]);
  const hari = hariIni();
  const nonaktif = (v: string) => (!!min && v < min) || (!!max && v > max);
  const pilih = (v: string) => { if (nonaktif(v)) return; ubah(v); setBuka(false); };

  return (
    <div className={cx('relative', className)}>
      <button ref={jangkar} type="button" onClick={() => setBuka(!buka)} className={cx(GAYA_PICU, buka && 'border-brand-400 ring-4 ring-brand-100')}>
        <CalendarDays className="size-4 shrink-0 text-brand-600" />
        <span className={cx('min-w-0 flex-1 truncate', !nilai && 'text-stone-400')}>{nilai ? labelTanggalPanjang(nilai) : placeholder}</span>
        {bolehKosong && nilai && (
          <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); ubah(''); }} className="rounded-md p-0.5 text-stone-400 hover:bg-stone-100"><X className="size-3.5" /></span>
        )}
      </button>
      <Mengambang buka={buka} tutup={() => setBuka(false)} jangkar={jangkar} lebar={300} tinggi={380}>
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => (modeBulan ? setLihat({ ...lihat, y: lihat.y - 1 }) : geser(-1))} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"><ChevronLeft className="size-4" /></button>
            <button type="button" onClick={() => setModeBulan(!modeBulan)} className="rounded-lg px-3 py-1 text-sm font-bold text-stone-800 hover:bg-stone-100">
              {modeBulan ? lihat.y : `${BULAN[lihat.m]} ${lihat.y}`}
            </button>
            <button type="button" onClick={() => (modeBulan ? setLihat({ ...lihat, y: lihat.y + 1 }) : geser(1))} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"><ChevronRight className="size-4" /></button>
          </div>
          {modeBulan ? (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {BULAN_PENDEK.map((b, i) => (
                <button key={b} type="button" onClick={() => { setLihat({ ...lihat, m: i }); setModeBulan(false); }}
                  className={cx('rounded-lg py-2.5 text-sm font-semibold transition', i === lihat.m ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100')}>{b}</button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 pb-1">
                {HARI_PENDEK.map((h, i) => <span key={h} className={cx('py-1 text-center text-[11px] font-bold uppercase', i === 6 ? 'text-rose-400' : 'text-stone-400')}>{h}</span>)}
              </div>
              <div className="overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false} custom={arah}>
                  <motion.div key={`${lihat.y}-${lihat.m}`} className="grid grid-cols-7 gap-0.5"
                    initial={{ x: arah >= 0 ? 40 : -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: arah >= 0 ? -40 : 40, opacity: 0 }} transition={{ duration: 0.18 }}>
                    {sel.map((s) => {
                      const dipilih = s.v === nilai;
                      return (
                        <button key={s.v} type="button" disabled={nonaktif(s.v)} onClick={() => pilih(s.v)}
                          className={cx('relative grid h-9 place-items-center rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-25',
                            dipilih ? 'bg-brand-600 font-bold text-white shadow-sm' : s.bulanIni ? 'font-medium text-stone-700 hover:bg-brand-50' : 'text-stone-300 hover:bg-stone-50',
                            !dipilih && s.v === hari && 'ring-1 ring-inset ring-brand-400')}>
                          {s.tgl}
                        </button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/70 px-3 py-2">
          <button type="button" onClick={() => pilih(hari)} disabled={nonaktif(hari)} className="rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40">Hari ini</button>
          {bolehKosong && <button type="button" onClick={() => { ubah(''); setBuka(false); }} className="rounded-lg px-2 py-1 text-sm font-medium text-stone-500 hover:bg-stone-100">Kosongkan</button>}
        </div>
      </Mengambang>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pilih bulan (pengganti <input type="month">)                        */
/* ------------------------------------------------------------------ */
export function PilihBulanIsian({ nilai, ubah, className }: { nilai: string | null | undefined; ubah: (v: string) => void; className?: string }) {
  const [buka, setBuka] = useState(false);
  const jangkar = useRef<HTMLButtonElement>(null);
  const [tahun, setTahun] = useState(Number((nilai || hariIni()).slice(0, 4)));
  useEffect(() => { if (buka) setTahun(Number((nilai || hariIni()).slice(0, 4))); }, [buka]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={cx('relative', className)}>
      <button ref={jangkar} type="button" onClick={() => setBuka(!buka)} className={cx(GAYA_PICU, buka && 'border-brand-400 ring-4 ring-brand-100')}>
        <CalendarDays className="size-4 shrink-0 text-brand-600" />
        <span className={cx('flex-1 truncate', !nilai && 'text-stone-400')}>{nilai ? `${BULAN[Number(nilai.slice(5, 7)) - 1]} ${nilai.slice(0, 4)}` : 'Pilih bulan'}</span>
        <ChevronDown className="size-4 text-stone-400" />
      </button>
      <Mengambang buka={buka} tutup={() => setBuka(false)} jangkar={jangkar} lebar={280} tinggi={240}>
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setTahun(tahun - 1)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"><ChevronLeft className="size-4" /></button>
            <motion.span key={tahun} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold">{tahun}</motion.span>
            <button type="button" onClick={() => setTahun(tahun + 1)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {BULAN_PENDEK.map((b, i) => {
              const v = `${tahun}-${String(i + 1).padStart(2, '0')}`;
              return (
                <button key={b} type="button" onClick={() => { ubah(v); setBuka(false); }}
                  className={cx('rounded-lg py-2.5 text-sm font-semibold transition', v === nilai ? 'bg-brand-600 text-white shadow-sm' : v === hariIni().slice(0, 7) ? 'text-brand-700 ring-1 ring-inset ring-brand-300 hover:bg-brand-50' : 'text-stone-600 hover:bg-stone-100')}>
                  {b}
                </button>
              );
            })}
          </div>
        </div>
      </Mengambang>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Isian dengan saran (pengganti <datalist>)                           */
/* ------------------------------------------------------------------ */
export function IsianSaran({ nilai, ubah, saran, placeholder, className }: {
  nilai: string; ubah: (v: string) => void; saran: string[]; placeholder?: string; className?: string;
}) {
  const [buka, setBuka] = useState(false);
  const [sorot, setSorot] = useState(-1);
  const wadah = useRef<HTMLDivElement>(null);
  const cocok = saran.filter((s) => s.toLowerCase().includes(nilai.trim().toLowerCase()) && s !== nilai).slice(0, 8);
  const tampil = buka && cocok.length > 0;
  const pilih = (s: string) => { ubah(s); setBuka(false); };
  return (
    <div ref={wadah} className={cx('relative', className)}>
      <input className="input pr-9" value={nilai} placeholder={placeholder}
        onChange={(e) => { ubah(e.target.value); setBuka(true); setSorot(-1); }}
        onFocus={() => setBuka(true)}
        onBlur={() => setTimeout(() => setBuka(false), 120)}
        onKeyDown={(e) => {
          if (!tampil) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setSorot((s) => Math.min(s + 1, cocok.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSorot((s) => Math.max(s - 1, 0)); }
          if (e.key === 'Enter' && sorot >= 0) { e.preventDefault(); pilih(cocok[sorot]); }
        }} />
      {saran.length > 0 && (
        <button type="button" tabIndex={-1} onClick={() => setBuka(!buka)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:bg-stone-100">
          <ChevronDown className="size-4" />
        </button>
      )}
      <Mengambang buka={tampil} tutup={() => setBuka(false)} jangkar={wadah} tinggi={260}>
        <div className="scroll-tipis max-h-56 overflow-y-auto p-1.5">
          <p className="px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">Saran</p>
          {cocok.map((s, i) => (
            <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setSorot(i)} onClick={() => pilih(s)}
              className={cx('flex w-full rounded-xl px-3 py-2 text-left text-sm text-stone-700', i === sorot && 'bg-stone-100')}>{s}</button>
          ))}
        </div>
      </Mengambang>
    </div>
  );
}
