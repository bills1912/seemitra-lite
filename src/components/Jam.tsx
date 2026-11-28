/**
 * JAM WAKTU NYATA di bagian atas halaman.
 * Zona waktu mengikuti perangkat pengguna: di Indonesia otomatis WIB / WITA / WIT,
 * di negara lain memakai nama zona setempat (mis. "Waktu Standar Jepang", GMT+9).
 * Klik untuk melihat tanggal lengkap dan perbandingan WIB · WITA · WIT.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, Globe } from '@phosphor-icons/react';
import { cx } from './ui';

const ZONA_INDONESIA = [
  { kode: 'WIB', tz: 'Asia/Jakarta', wilayah: 'Sumatra, Jawa, Kalimantan Barat & Tengah' },
  { kode: 'WITA', tz: 'Asia/Makassar', wilayah: 'Bali, NTB, NTT, Kalimantan Selatan–Utara, Sulawesi' },
  { kode: 'WIT', tz: 'Asia/Jayapura', wilayah: 'Maluku, Papua' },
];
/** Zona IANA lain yang juga berada di Indonesia */
const ALIAS_INDONESIA: Record<string, string> = { 'Asia/Pontianak': 'WIB', 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Ujung_Pandang': 'WITA', 'Asia/Jayapura': 'WIT' };

const bagian = (d: Date, tz: string, opsi: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: tz, ...opsi }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
const jamMenit = (d: Date, tz: string, detik = false) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit', ...(detik ? { second: '2-digit' } : {}), hour12: false }).format(d).replace(/\./g, ':');

function infoZona(tz: string, d: Date) {
  const indo = ALIAS_INDONESIA[tz];
  const kota = tz.split('/').pop()!.replace(/_/g, ' ');
  return {
    tz, kota, indo,
    pendek: indo ?? bagian(d, tz, { timeZoneName: 'short' }),
    panjang: bagian(d, tz, { timeZoneName: 'long' }),
    offset: bagian(d, tz, { timeZoneName: 'longOffset' }).replace('GMT', 'UTC').replace('.', ':') || 'UTC',
  };
}

/** Waktu sekarang, diperbarui tepat setiap pergantian detik */
function useSekarang() {
  const [sekarang, setSekarang] = useState(() => new Date());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const jalan = () => { setSekarang(new Date()); t = setTimeout(jalan, 1000 - (Date.now() % 1000) + 5); };
    t = setTimeout(jalan, 1000 - (Date.now() % 1000) + 5);
    return () => clearTimeout(t);
  }, []);
  return sekarang;
}

export function Jam({ ringkas = false }: { ringkas?: boolean }) {
  const sekarang = useSekarang();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
  const z = infoZona(tz, sekarang);
  const [buka, setBuka] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!buka) return;
    const luar = (e: MouseEvent) => { if (!wadah.current?.contains(e.target as Node)) setBuka(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false); };
    document.addEventListener('mousedown', luar); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', luar); document.removeEventListener('keydown', esc); };
  }, [buka]);

  const tanggal = new Intl.DateTimeFormat('id-ID', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(sekarang);
  const [jm, dtk] = [jamMenit(sekarang, tz), jamMenit(sekarang, tz, true).slice(-2)];

  return (
    <div ref={wadah} className="relative">
      <button type="button" onClick={() => setBuka(!buka)} aria-expanded={buka} title={`${z.panjang} (${z.offset})`}
        className={cx('flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/70 text-stone-700 shadow-sm backdrop-blur transition hover:border-brand-200 hover:bg-white',
          ringkas ? 'px-2.5 py-1.5' : 'px-3.5 py-1.5')}>
        <Clock className="size-4 text-brand-600" weight="duotone" />
        <span className="text-sm font-bold tabular-nums tracking-tight">
          {jm}{!ringkas && <span className="text-stone-400">:{dtk}</span>}
        </span>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{z.pendek}</span>
        {!ringkas && <span className="hidden text-xs text-stone-400 xl:inline">{z.indo ? 'Indonesia' : z.kota}</span>}
      </button>

      <AnimatePresence>
        {buka && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-melayang">
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 px-5 py-4 text-white">
              <div className="text-xs font-medium text-brand-50/80">{tanggal}</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">{jm}<span className="text-brand-100/70">:{dtk}</span></div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-brand-50/90"><Globe className="size-3.5" />{z.panjang} · {z.offset}</div>
              <div className="text-[11px] text-brand-50/70">Zona perangkat: {z.tz}</div>
            </div>
            <ul className="divide-y divide-stone-100 px-2 py-1.5">
              {ZONA_INDONESIA.map((w) => {
                const aktif = z.indo === w.kode;
                return (
                  <li key={w.kode} className={cx('flex items-center gap-3 rounded-xl px-3 py-2', aktif && 'bg-brand-50')}>
                    <span className={cx('w-11 text-xs font-bold', aktif ? 'text-brand-700' : 'text-stone-500')}>{w.kode}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-stone-400" title={w.wilayah}>{w.wilayah}</span>
                    <span className={cx('text-sm font-bold tabular-nums', aktif ? 'text-brand-700' : 'text-stone-700')}>{jamMenit(sekarang, w.tz)}</span>
                  </li>
                );
              })}
            </ul>
            {!z.indo && <p className="border-t border-stone-100 px-5 py-2.5 text-[11px] text-stone-400">Anda berada di luar zona waktu Indonesia ({z.kota}).</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
