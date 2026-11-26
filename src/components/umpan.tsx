/** Notifikasi kecil (toast) dan dialog konfirmasi yang bisa dipanggil dari mana saja. */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, Undo2, X, XCircle } from 'lucide-react';
import { Tombol, cx, pegas } from './ui';

type Jenis = 'sukses' | 'galat' | 'info';
type Toast = { id: number; jenis: Jenis; pesan: ReactNode; urungkan?: () => void; durasi: number };
type Konfirmasi = { judul: string; pesan?: ReactNode; tombol?: string; bahaya?: boolean };

type Ctx = {
  beritahu: (jenis: Jenis, pesan: ReactNode, opsi?: { urungkan?: () => void }) => void;
  konfirmasi: (k: Konfirmasi) => Promise<boolean>;
};
const UmpanCtx = createContext<Ctx>(null!);
export const useUmpan = () => useContext(UmpanCtx);

const IKON = {
  sukses: <CheckCircle2 className="size-5 text-emerald-500" />,
  galat: <XCircle className="size-5 text-rose-500" />,
  info: <Info className="size-5 text-sky-500" />,
};

export function PenyediaUmpan({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(Konfirmasi & { jawab: (v: boolean) => void }) | null>(null);
  const id = useRef(0);

  const tutup = useCallback((x: number) => setDaftar((d) => d.filter((t) => t.id !== x)), []);
  const beritahu = useCallback<Ctx['beritahu']>((jenis, pesan, opsi) => {
    const t: Toast = { id: ++id.current, jenis, pesan, urungkan: opsi?.urungkan, durasi: opsi?.urungkan ? 7000 : jenis === 'galat' ? 6000 : 3500 };
    setDaftar((d) => [...d.slice(-3), t]);
    setTimeout(() => tutup(t.id), t.durasi);
  }, [tutup]);
  const konfirmasi = useCallback<Ctx['konfirmasi']>((k) => new Promise((res) => setDialog({ ...k, jawab: res })), []);
  const jawab = (v: boolean) => { dialog?.jawab(v); setDialog(null); };

  return (
    <UmpanCtx.Provider value={{ beritahu, konfirmasi }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        <AnimatePresence initial={false}>
          {daftar.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }} transition={pegas}
              className="pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl border border-stone-200 bg-white py-3.5 pl-4 pr-3 shadow-melayang">
              <span className="mt-px">{IKON[t.jenis]}</span>
              <div className="min-w-0 flex-1 break-words text-sm font-medium text-stone-700">{t.pesan}</div>
              {t.urungkan && (
                <button onClick={() => { t.urungkan!(); tutup(t.id); }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-brand-700 hover:bg-brand-50">
                  <Undo2 className="size-4" /> Urungkan
                </button>
              )}
              <button onClick={() => tutup(t.id)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
              <motion.span className={cx('absolute bottom-0 left-0 h-0.5', t.jenis === 'galat' ? 'bg-rose-400' : 'bg-brand-400')}
                initial={{ width: '100%' }} animate={{ width: 0 }} transition={{ duration: t.durasi / 1000, ease: 'linear' }} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {dialog && (
          <motion.div className="fixed inset-0 z-[70] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px]" onClick={() => jawab(false)} />
            <motion.div role="alertdialog" aria-modal="true" tabIndex={-1} ref={(el) => el?.focus({ preventScroll: true })} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); jawab(false); } }} initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} transition={pegas}
              className="scroll-tipis relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-melayang outline-none">
              <div className={cx('mb-4 grid size-12 place-items-center rounded-2xl', dialog.bahaya ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600')}>
                <AlertTriangle className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900">{dialog.judul}</h3>
              {dialog.pesan && <div className="mt-1.5 text-sm text-stone-500">{dialog.pesan}</div>}
              <div className="mt-6 flex justify-end gap-2">
                <Tombol varian="kedua" onClick={() => jawab(false)}>Batal</Tombol>
                <Tombol varian={dialog.bahaya ? 'bahaya' : 'utama'} onClick={() => jawab(true)}>{dialog.tombol ?? 'Ya, lanjutkan'}</Tombol>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </UmpanCtx.Provider>
  );
}
