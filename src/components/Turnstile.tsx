/**
 * Widget pemeriksaan keamanan (Cloudflare Turnstile) untuk halaman masuk & daftar.
 * Biasanya berjalan otomatis tanpa perlu diklik. Hanya tampil bila admin server mengaktifkannya
 * (TURNSTILE_SITE_KEY & TURNSTILE_SECRET_KEY di Railway).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opsi: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SKRIP = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let muatSkrip: Promise<void> | null = null;
function pastikanSkrip() {
  muatSkrip ??= new Promise<void>((ok, gagal) => {
    const s = document.createElement('script');
    s.src = SKRIP; s.async = true;
    s.onload = () => ok();
    s.onerror = () => { muatSkrip = null; gagal(new Error('Turnstile gagal dimuat')); };
    document.head.appendChild(s);
  });
  return muatSkrip;
}

export type PeganganTurnstile = { reset: () => void };

export const Turnstile = forwardRef<PeganganTurnstile, { kunciSitus: string; aksi: 'masuk' | 'daftar'; onToken: (t: string) => void }>(
  function Turnstile({ kunciSitus, aksi, onToken }, ref) {
    const wadah = useRef<HTMLDivElement>(null);
    const idWidget = useRef<string | undefined>(undefined);
    const panggil = useRef(onToken);
    panggil.current = onToken;
    const [status, setStatus] = useState<'memuat' | 'siap' | 'gagal'>('memuat');

    useImperativeHandle(ref, () => ({
      reset: () => { panggil.current(''); if (idWidget.current) window.turnstile?.reset(idWidget.current); },
    }));

    useEffect(() => {
      let batal = false;
      pastikanSkrip().then(() => {
        if (batal || !wadah.current || !window.turnstile) return;
        idWidget.current = window.turnstile.render(wadah.current, {
          sitekey: kunciSitus, action: aksi, theme: 'light', language: 'id', size: 'flexible',
          callback: (t: string) => { setStatus('siap'); panggil.current(t); },
          'expired-callback': () => panggil.current(''),
          'error-callback': () => { setStatus('gagal'); panggil.current(''); },
        });
      }).catch(() => { setStatus('gagal'); panggil.current(''); });
      return () => {
        batal = true;
        if (idWidget.current) window.turnstile?.remove(idWidget.current);
        idWidget.current = undefined;
      };
    }, [kunciSitus, aksi]);

    return (
      <div>
        <div ref={wadah} className="flex min-h-[65px] justify-center" />
        {status === 'gagal' ? (
          <p className="mt-1 text-center text-xs text-rose-600">Pemeriksaan keamanan tidak dapat dimuat. Periksa koneksi internet lalu muat ulang halaman.</p>
        ) : status === 'memuat' && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-stone-400"><ShieldCheck className="size-3.5" /> Memeriksa keamanan… Bila muncul kotak, centang kotaknya.</p>
        )}
      </div>
    );
  },
);
