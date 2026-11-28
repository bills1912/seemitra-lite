/**
 * KREDIT PEMBUAT — tampil di bagian bawah setiap halaman (termasuk halaman masuk).
 * Sesuai LICENSE, keterangan ini tidak boleh dihapus atau disembunyikan.
 */
import { cx } from './ui';

export const PEMBUAT = { nama: 'Bill Van Ricardo Zalukhu', github: 'bills1912', tahun: 2026 };

/** Logo GitHub (Invertocat) */
function LogoGithub({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Kredit({ className }: { className?: string }) {
  const { nama, github, tahun } = PEMBUAT;
  const tahunIni = new Date().getFullYear();
  return (
    <footer className={cx('flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-stone-400', className)}>
      <span>Seemitra Lite © {tahunIni > tahun ? `${tahun}–${tahunIni}` : tahun} <span className="font-semibold text-stone-500">{nama}</span></span>
      <span aria-hidden="true" className="hidden sm:inline">·</span>
      <a href={`https://github.com/${github}`} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md px-1 font-semibold text-stone-500 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500">
        <LogoGithub className="size-3.5" /> github.com/{github}
      </a>
    </footer>
  );
}
