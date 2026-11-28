/** Ilustrasi kecil kartu grafik honor: tumpukan koin Rp, dompet, dan panah naik (SVG buatan sendiri, warna tema). */
import { motion, useReducedMotion } from 'motion/react';

export function IlustrasiHonor({ className }: { className?: string }) {
  const diam = useReducedMotion();
  const melayang = (tunda: number) => (diam ? {} : { animate: { y: [0, -4, 0] }, transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const, delay: tunda } });
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Ilustrasi honor mitra">
      <defs>
        <linearGradient id="ih-koin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd27a" /><stop offset="1" stopColor="#f5a524" /></linearGradient>
        <linearGradient id="ih-dompet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22a391" /><stop offset="1" stopColor="#146a61" /></linearGradient>
      </defs>
      <ellipse cx="104" cy="108" rx="78" ry="7" fill="#134742" opacity=".08" />
      <path d="M30 70c10-34 46-52 82-46s58 30 60 56c1 16-10 28-36 28H52c-20 0-28-14-22-38z" fill="#d7f5ee" />
      {/* panah naik */}
      <path d="M40 86l26-22 18 12 32-30" fill="none" stroke="#45bfab" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M104 44h14v14" fill="none" stroke="#45bfab" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* dompet */}
      <rect x="92" y="62" width="62" height="42" rx="9" fill="url(#ih-dompet)" />
      <rect x="92" y="62" width="62" height="12" rx="6" fill="#168376" />
      <rect x="132" y="78" width="26" height="16" rx="6" fill="#14554f" />
      <circle cx="141" cy="86" r="3.5" fill="#f5b041" />
      {/* tumpukan koin */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <ellipse cx="68" cy={100 - i * 8} rx="18" ry="6" fill="#e08e1b" />
          <rect x="50" y={94 - i * 8} width="36" height="6" fill="#e08e1b" />
          <ellipse cx="68" cy={94 - i * 8} rx="18" ry="6" fill="url(#ih-koin)" />
        </g>
      ))}
      <motion.g {...melayang(0)}>
        <circle cx="166" cy="34" r="16" fill="url(#ih-koin)" />
        <circle cx="166" cy="34" r="11.5" fill="none" stroke="#fff3d6" strokeWidth="2" />
        <text x="166" y="38.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#9a5b06" fontFamily="Plus Jakarta Sans, sans-serif">Rp</text>
      </motion.g>
      <motion.g {...melayang(1.3)}>
        <circle cx="136" cy="18" r="9" fill="url(#ih-koin)" />
        <text x="136" y="21.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#9a5b06" fontFamily="Plus Jakarta Sans, sans-serif">Rp</text>
      </motion.g>
      <path d="M26 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#f5b041" />
      <circle cx="186" cy="70" r="3" fill="#7dd8c7" />
      <circle cx="18" cy="64" r="2.5" fill="#7dd8c7" />
    </svg>
  );
}
