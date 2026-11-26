/**
 * Komponen tampilan dasar (tombol, kotak isian, jendela, dll).
 * Ubah warna/bentuk di sini, dan seluruh aplikasi ikut berubah.
 */
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type HTMLMotionProps } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { BULAN_PENDEK, inisial, labelBulan, warnaAvatar } from '../lib/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export const pegas = { type: 'spring', stiffness: 420, damping: 32 } as const;

/* ------------------------------ Tombol ------------------------------ */
type Varian = 'utama' | 'kedua' | 'hantu' | 'bahaya' | 'lembut';
const GAYA_TOMBOL: Record<Varian, string> = {
  utama: 'bg-brand-600 text-white shadow-sm shadow-brand-900/10 hover:bg-brand-700',
  kedua: 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300 hover:bg-stone-50',
  hantu: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  bahaya: 'bg-rose-600 text-white hover:bg-rose-700',
  lembut: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
};
type PropsTombol = Omit<HTMLMotionProps<'button'>, 'children'> & {
  varian?: Varian; ikon?: ReactNode; memuat?: boolean; kecil?: boolean; children?: ReactNode;
};
export const Tombol = forwardRef<HTMLButtonElement, PropsTombol>(function Tombol(
  { varian = 'utama', ikon, memuat, kecil, className, children, disabled, ...rest }, ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.96 }}
      transition={pegas}
      disabled={disabled || memuat}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        kecil ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        GAYA_TOMBOL[varian], className,
      )}
      {...rest}
    >
      {memuat ? <Loader2 className="size-4 animate-spin" /> : ikon}
      {children}
    </motion.button>
  );
});

export function TombolIkon({ className, label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx('grid size-9 place-items-center rounded-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 active:scale-90', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Isian ------------------------------ */
export function Kolom({ label, wajib, petunjuk, galat, children, className }: {
  label: string; wajib?: boolean; petunjuk?: ReactNode; galat?: string; children: ReactNode; className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-stone-600">
        {label} {wajib && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {galat ? <span className="mt-1 block text-xs text-rose-600">{galat}</span> : petunjuk && <span className="mt-1 block text-xs text-stone-400">{petunjuk}</span>}
    </label>
  );
}

export const Masukan = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Masukan({ className, ...p }, ref) {
  return <input ref={ref} className={cx('input', className)} {...p} />;
});

/** Isian angka rupiah: tampil "1.250.000", nilai disimpan sebagai angka */
export function MasukanRupiah({ nilai, ubah, className, ...p }: { nilai: number | null | undefined; ubah: (n: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const tampil = nilai ? Math.round(nilai).toLocaleString('id-ID') : '';
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-stone-400">Rp</span>
      <input
        inputMode="numeric"
        className={cx('input pl-10 angka', className)}
        value={tampil}
        onChange={(e) => ubah(Number(e.target.value.replace(/\D/g, '')) || 0)}
        {...p}
      />
    </div>
  );
}

/** Pilihan berbentuk tombol bersebelahan dengan indikator yang meluncur */
export function Segmen<T extends string>({ nilai, ubah, opsi, id, kecil }: {
  nilai: T; ubah: (v: T) => void; opsi: { nilai: T; label: ReactNode; jumlah?: number }[]; id: string; kecil?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1">
      {opsi.map((o) => (
        <button key={o.nilai} type="button" onClick={() => ubah(o.nilai)}
          className={cx('relative rounded-lg font-semibold transition-colors', kecil ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]',
            nilai === o.nilai ? 'text-stone-900' : 'text-stone-500 hover:text-stone-800')}>
          {nilai === o.nilai && <motion.span layoutId={`segmen-${id}`} transition={pegas} className="absolute inset-0 rounded-lg bg-white shadow-sm" />}
          <span className="relative flex items-center gap-1.5">
            {o.label}
            {o.jumlah !== undefined && <span className="rounded-md bg-stone-200/70 px-1.5 text-[11px] text-stone-600">{o.jumlah}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Saklar({ aktif, ubah, label }: { aktif: boolean; ubah: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" onClick={() => ubah(!aktif)} className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
      <span className={cx('flex h-6 w-11 rounded-full p-0.5 transition-colors', aktif ? 'justify-end bg-brand-500' : 'justify-start bg-stone-300')}>
        <motion.span layout transition={pegas} className="size-5 rounded-full bg-white shadow" />
      </span>
      {label}
    </button>
  );
}

export function Kotak({ aktif, ubah, label }: { aktif: boolean; ubah: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" onClick={() => ubah(!aktif)} className="inline-flex items-center gap-2.5 text-left text-sm text-stone-700">
      <span className={cx('grid size-5 shrink-0 place-items-center rounded-md border-2 transition', aktif ? 'border-brand-600 bg-brand-600' : 'border-stone-300 bg-white')}>
        <AnimatePresence>
          {aktif && (
            <motion.svg initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} viewBox="0 0 24 24" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={4}>
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ pathLength: 0 }} transition={{ duration: 0.2 }} />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
      {label}
    </button>
  );
}

export function KotakCari({ nilai, ubah, placeholder, className, autoFocus }: { nilai: string; ubah: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      <input autoFocus={autoFocus} className="input pl-10 pr-9" placeholder={placeholder ?? 'Cari…'} value={nilai} onChange={(e) => ubah(e.target.value)} />
      <AnimatePresence>
        {nilai && (
          <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} type="button" onClick={() => ubah('')}
            className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-stone-200 text-stone-600 hover:bg-stone-300">
            <X className="size-3.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------ Kartu & lencana ------------------------------ */
export function Kartu({ className, children, ...p }: HTMLMotionProps<'div'>) {
  return <motion.div className={cx('rounded-2xl border border-stone-200/70 bg-white shadow-lembut', className)} {...p}>{children}</motion.div>;
}

const WARNA_LENCANA = {
  hijau: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  biru: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  kuning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  merah: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  abu: 'bg-stone-100 text-stone-600 ring-stone-500/10',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/15',
};
export function Lencana({ warna = 'abu', children, className, titik }: { warna?: keyof typeof WARNA_LENCANA; children: ReactNode; className?: string; titik?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', WARNA_LENCANA[warna], className)}>
      {titik && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({ nama, besar }: { nama: string; besar?: boolean }) {
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full font-bold', besar ? 'size-14 text-lg' : 'size-9 text-xs', warnaAvatar(nama))}>
      {inisial(nama)}
    </span>
  );
}

/** Batang kemajuan (mis. honor vs batas SBML) */
export function Batang({ nilai, maks, className, tebal, ambang = 80 }: { nilai: number; maks: number | null | undefined; className?: string; tebal?: boolean; ambang?: number }) {
  if (!maks) return null;
  const persen = Math.min(100, (nilai / maks) * 100);
  const warna = nilai > maks ? 'bg-rose-500' : persen >= ambang ? 'bg-amber-400' : 'bg-brand-500';
  return (
    <div className={cx('overflow-hidden rounded-full bg-stone-100', tebal ? 'h-2' : 'h-1.5', className)}>
      <motion.div className={cx('h-full rounded-full', warna)} initial={{ width: 0 }} animate={{ width: `${persen}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

/** Angka yang "berhitung" naik saat berubah */
export function AngkaHidup({ nilai, format = (n) => Math.round(n).toLocaleString('id-ID') }: { nilai: number; format?: (n: number) => string }) {
  const mv = useMotionValue(0);
  const teks = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const c = animate(mv, nilai, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [nilai, mv]);
  return <motion.span className="angka">{teks}</motion.span>;
}

export function Kosong({ ikon, judul, pesan, aksi }: { ikon: ReactNode; judul: string; pesan?: ReactNode; aksi?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center px-6 py-14 text-center">
      <motion.div initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...pegas, delay: 0.05 }}
        className="mb-4 grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">{ikon}</motion.div>
      <h3 className="text-base font-bold text-stone-800">{judul}</h3>
      {pesan && <p className="mt-1 max-w-sm text-sm text-stone-500">{pesan}</p>}
      {aksi && <div className="mt-5">{aksi}</div>}
    </motion.div>
  );
}

export function Memuat({ teks = 'Memuat data…' }: { teks?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-stone-400">
      <Loader2 className="size-5 animate-spin text-brand-500" /> {teks}
    </div>
  );
}

export function Kerangka({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-stone-200/60', className)} />;
}

/* ------------------------------ Jendela (modal) & laci ------------------------------ */
export function Jendela({ buka, tutup, judul, sub, children, kaki, lebar = 'max-w-lg' }: {
  buka: boolean; tutup: () => void; judul: ReactNode; sub?: ReactNode; children: ReactNode; kaki?: ReactNode; lebar?: string;
}) {
  useEsc(buka, tutup);
  // Dirender ke <body> agar selalu menutupi seluruh layar, apa pun induknya
  return createPortal(
    <AnimatePresence>
      {buka && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px]" onClick={tutup} />
          <motion.div
            role="dialog"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={pegas}
            className={cx('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-melayang sm:rounded-3xl', lebar)}
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 pb-4 pt-5 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-stone-900">{judul}</h2>
                {sub && <p className="mt-0.5 text-sm text-stone-500">{sub}</p>}
              </div>
              <TombolIkon label="Tutup" onClick={tutup} className="-mr-2 -mt-1"><X className="size-5" /></TombolIkon>
            </div>
            <div className="scroll-tipis flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {kaki && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">{kaki}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Laci({ buka, tutup, children, lebar = 'max-w-xl' }: { buka: boolean; tutup: () => void; children: ReactNode; lebar?: string }) {
  useEsc(buka, tutup);
  return createPortal(
    <AnimatePresence>
      {buka && (
        <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-stone-900/25 backdrop-blur-[2px]" onClick={tutup} />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className={cx('scroll-tipis absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto bg-white shadow-melayang', lebar)}
          >
            <TombolIkon label="Tutup" onClick={tutup} className="absolute right-4 top-4 z-10 bg-white/80 backdrop-blur"><X className="size-5" /></TombolIkon>
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function useEsc(aktif: boolean, fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!aktif) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && ref.current();
    window.addEventListener('keydown', h);
    const lama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = lama;
    };
  }, [aktif]);
}

/* ------------------------------ Pemilih bulan ------------------------------ */
export function PemilihBulan({ nilai, ubah }: { nilai: string; ubah: (b: string) => void }) {
  const [buka, setBuka] = useState(false);
  const [tahun, setTahun] = useState(Number(nilai.slice(0, 4)));
  const [arah, setArah] = useState(0);
  const geser = (n: number) => {
    const [y, m] = nilai.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setArah(n);
    ubah(d.toISOString().slice(0, 7));
  };
  useEffect(() => setTahun(Number(nilai.slice(0, 4))), [nilai]);
  return (
    <div className="relative inline-flex items-center rounded-2xl border border-stone-200 bg-white p-1 shadow-lembut">
      <TombolIkon label="Bulan sebelumnya" onClick={() => geser(-1)}><ChevronLeft className="size-5" /></TombolIkon>
      <button type="button" onClick={() => setBuka(!buka)} className="relative h-9 w-40 overflow-hidden rounded-xl text-[15px] font-bold text-stone-800 hover:bg-stone-50">
        <AnimatePresence mode="popLayout" initial={false} custom={arah}>
          <motion.span key={nilai} custom={arah} className="absolute inset-0 grid place-items-center"
            initial={{ y: arah >= 0 ? 18 : -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: arah >= 0 ? -18 : 18, opacity: 0 }} transition={pegas}>
            {labelBulan(nilai)}
          </motion.span>
        </AnimatePresence>
      </button>
      <TombolIkon label="Bulan berikutnya" onClick={() => geser(1)}><ChevronRight className="size-5" /></TombolIkon>
      <AnimatePresence>
        {buka && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setBuka(false)} />
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={pegas}
              className="absolute left-1/2 top-full z-40 mt-2 w-72 -translate-x-1/2 rounded-2xl border border-stone-200 bg-white p-3 shadow-melayang">
              <div className="mb-2 flex items-center justify-between">
                <TombolIkon label="Tahun sebelumnya" onClick={() => setTahun(tahun - 1)}><ChevronLeft className="size-4" /></TombolIkon>
                <span className="font-bold">{tahun}</span>
                <TombolIkon label="Tahun berikutnya" onClick={() => setTahun(tahun + 1)}><ChevronRight className="size-4" /></TombolIkon>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {BULAN_PENDEK.map((b, i) => {
                  const v = `${tahun}-${String(i + 1).padStart(2, '0')}`;
                  return (
                    <button key={b} type="button" onClick={() => { setArah(v > nilai ? 1 : -1); ubah(v); setBuka(false); }}
                      className={cx('rounded-lg py-2 text-sm font-semibold transition', v === nilai ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100')}>
                      {b}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------ Kepala halaman ------------------------------ */
export function KepalaHalaman({ judul, sub, aksi, kembali }: { judul: ReactNode; sub?: ReactNode; aksi?: ReactNode; kembali?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 lg:flex-1">
        {kembali}
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-[28px]">{judul}</h1>
        {sub && <p className="mt-1 text-[15px] text-stone-500">{sub}</p>}
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">{aksi}</div>}
    </div>
  );
}

/** Area unggah file dengan seret & lepas */
export function AreaUnggah({ terima, pilih, file, teks }: { terima: string; pilih: (f: File | null) => void; file: File | null; teks: string }) {
  const [seret, setSeret] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <motion.div
      animate={{ scale: seret ? 1.02 : 1 }}
      onDragOver={(e) => { e.preventDefault(); setSeret(true); }}
      onDragLeave={() => setSeret(false)}
      onDrop={(e) => { e.preventDefault(); setSeret(false); pilih(e.dataTransfer.files[0] ?? null); }}
      onClick={() => ref.current?.click()}
      className={cx('cursor-pointer rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
        seret ? 'border-brand-400 bg-brand-50' : file ? 'border-brand-300 bg-brand-50/40' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50')}
    >
      <input ref={ref} type="file" accept={terima} className="hidden" onChange={(e) => pilih(e.target.files?.[0] ?? null)} />
      {file ? (
        <p className="text-sm"><span className="font-bold text-brand-700">{file.name}</span><br /><span className="text-stone-500">Klik untuk mengganti file</span></p>
      ) : (
        <p className="text-sm text-stone-500"><span className="font-semibold text-stone-700">{teks}</span><br />seret file ke sini atau klik untuk memilih</p>
      )}
    </motion.div>
  );
}

/** Tombol halaman: ‹ 1 2 3 › beserta keterangan "1–5 dari 12" */
export function Paginasi({ halaman, total, perHalaman, ubah, className }: { halaman: number; total: number; perHalaman: number; ubah: (h: number) => void; className?: string }) {
  const jumlah = Math.max(1, Math.ceil(total / perHalaman));
  if (total <= perHalaman) return null;
  const awal = (halaman - 1) * perHalaman + 1;
  const akhir = Math.min(total, halaman * perHalaman);
  // tampilkan maksimal 5 nomor di sekitar halaman aktif
  const mulai = Math.max(1, Math.min(halaman - 2, jumlah - 4));
  const nomor = Array.from({ length: Math.min(5, jumlah) }, (_, i) => mulai + i);
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-2', className)}>
      <span className="text-xs text-stone-500">Menampilkan <b>{awal}–{akhir}</b> dari {total}</span>
      <div className="flex items-center gap-1">
        <TombolIkon label="Halaman sebelumnya" disabled={halaman <= 1} onClick={() => ubah(halaman - 1)} className="size-8 disabled:opacity-30"><ChevronLeft className="size-4" /></TombolIkon>
        {nomor.map((n) => (
          <button key={n} type="button" onClick={() => ubah(n)}
            className={cx('relative grid size-8 place-items-center rounded-lg text-xs font-bold transition-colors', n === halaman ? 'text-white' : 'text-stone-600 hover:bg-stone-200/60')}>
            {n === halaman && <motion.span layoutId={`paginasi-${perHalaman}-${total}`} transition={pegas} className="absolute inset-0 rounded-lg bg-brand-600" />}
            <span className="relative">{n}</span>
          </button>
        ))}
        <TombolIkon label="Halaman berikutnya" disabled={halaman >= jumlah} onClick={() => ubah(halaman + 1)} className="size-8 disabled:opacity-30"><ChevronRight className="size-4" /></TombolIkon>
      </div>
    </div>
  );
}

/** Animasi masuk berurutan untuk daftar */
export const urutan = {
  wadah: { tampil: { transition: { staggerChildren: 0.035 } } },
  anak: { awal: { opacity: 0, y: 10 }, tampil: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } } },
} as const;
