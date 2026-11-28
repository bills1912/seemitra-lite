/**
 * Ilustrasi halaman masuk (SVG buatan sendiri, mengikuti warna tema aplikasi).
 * Petugas mengelola mitra di laptop, dikelilingi kartu: daftar mitra, rekap honor, SPK/BAST, dan kalender.
 */
import { motion, useReducedMotion } from 'motion/react';

const W = {
  b50: '#effcf9', b100: '#d7f5ee', b200: '#b0eadd', b300: '#7dd8c7', b400: '#45bfab', b500: '#22a391', b600: '#168376', b700: '#146a61', b800: '#14554f', b900: '#134742',
  amber: '#f5b041', amberTua: '#e08e1b', krem: '#fff8ec', kulit: '#f3c7a1', kulitTua: '#e3a87f', rambut: '#1f2a37', putih: '#ffffff', merah: '#f07167',
};

/** Kartu yang melayang naik-turun pelan */
function Melayang({ children, tunda = 0, jarak = 6, durasi = 5 }: { children: React.ReactNode; tunda?: number; jarak?: number; durasi?: number }) {
  const diam = useReducedMotion();
  return (
    <motion.g animate={diam ? undefined : { y: [0, -jarak, 0] }} transition={{ duration: durasi, repeat: Infinity, ease: 'easeInOut', delay: tunda }}>
      {children}
    </motion.g>
  );
}

export function IlustrasiMasuk({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 380" className={className} role="img" aria-label="Ilustrasi petugas mengelola data mitra statistik">
      <defs>
        <linearGradient id="il-gumpal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={W.b300} stopOpacity=".55" />
          <stop offset="1" stopColor={W.b400} stopOpacity=".25" />
        </linearGradient>
        <linearGradient id="il-layar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={W.b50} />
          <stop offset="1" stopColor={W.b100} />
        </linearGradient>
        <filter id="il-bayang" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor={W.b900} floodOpacity=".22" />
        </filter>
      </defs>

      {/* gumpalan latar */}
      <path d="M86 92c34-44 104-62 160-50 46 10 70 40 112 44 44 4 86 22 92 70 7 52-28 84-34 128-6 46-48 74-110 70-50-3-80-24-128-20-52 4-104-8-124-54-18-42 6-74 2-112-3-30 4-52 30-76z" fill="url(#il-gumpal)" />
      {/* titik-titik dekorasi */}
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={392 + (i % 4) * 14} cy={40 + Math.floor(i / 4) * 14} r="2.2" fill={W.b100} opacity=".55" />
      ))}
      <path d="M58 300l10-10M63 290l0 14M52 296l16 0" stroke={W.amber} strokeWidth="3" strokeLinecap="round" opacity=".9" />
      <path d="M420 300c6 0 6-8 12-8s6 8 12 8 6-8 12-8" fill="none" stroke={W.b100} strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <circle cx="120" cy="64" r="5" fill="none" stroke={W.amber} strokeWidth="3" />
      <path d="M368 120l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill={W.amber} />
      <path d="M96 196l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill={W.b100} opacity=".9" />

      {/* lantai */}
      <rect x="40" y="330" width="400" height="5" rx="2.5" fill={W.b900} opacity=".35" />

      {/* tanaman */}
      <g>
        <path d="M402 288c-14-26-8-52 4-68 2 22 6 44-4 68z" fill={W.b300} />
        <path d="M410 290c4-30 22-48 38-54-8 22-18 42-38 54z" fill={W.b400} />
        <path d="M404 292c-20-12-34-30-36-48 18 8 30 26 36 48z" fill={W.b200} />
        <path d="M388 290h40l-6 40h-28z" fill={W.merah} />
        <rect x="384" y="286" width="48" height="8" rx="3" fill="#e05d54" />
      </g>

      {/* meja */}
      <rect x="110" y="262" width="250" height="10" rx="5" fill={W.krem} />
      <rect x="128" y="272" width="8" height="58" rx="3" fill={W.b900} opacity=".8" />
      <rect x="334" y="272" width="8" height="58" rx="3" fill={W.b900} opacity=".8" />
      {/* tumpukan map di meja */}
      <rect x="122" y="246" width="54" height="8" rx="2" fill={W.amber} />
      <rect x="126" y="238" width="48" height="8" rx="2" fill={W.b200} />
      <rect x="120" y="254" width="58" height="8" rx="2" fill={W.b600} />
      {/* cangkir */}
      <rect x="318" y="244" width="16" height="18" rx="3" fill={W.putih} />
      <path d="M334 249c6 0 6 9 0 9" fill="none" stroke={W.putih} strokeWidth="3" />

      {/* kursi */}
      <path d="M286 238c-4-34 8-62 30-70 18-6 30 6 28 28l-6 52z" fill={W.b800} />
      <rect x="258" y="256" width="84" height="12" rx="6" fill={W.b700} />
      <rect x="296" y="268" width="8" height="52" fill={W.b900} />
      <rect x="276" y="318" width="48" height="6" rx="3" fill={W.b900} />

      {/* orang */}
      <g>
        {/* kaki */}
        <path d="M268 258h-48c-10 0-16 6-16 16v46h16v-38h48z" fill={W.b900} />
        <path d="M200 320h26v8h-30c0-5 1-8 4-8z" fill={W.rambut} />
        {/* badan */}
        <path d="M254 186c20 0 32 14 32 36v40h-58l-6-48c-2-16 12-28 32-28z" fill={W.amber} />
        <path d="M244 190l10 16 10-16" fill="none" stroke={W.amberTua} strokeWidth="3" strokeLinejoin="round" />
        {/* lengan ke laptop */}
        <path d="M236 206c-10 10-20 26-24 40l14 4c6-12 14-24 20-30z" fill={W.amberTua} />
        <circle cx="216" cy="248" r="7" fill={W.kulit} />
        {/* leher & kepala */}
        <rect x="246" y="172" width="14" height="18" rx="5" fill={W.kulitTua} />
        <circle cx="254" cy="156" r="22" fill={W.kulit} />
        <path d="M232 152c0-18 12-28 26-28 14 0 24 10 22 24-6-6-14-8-22-6-8 2-14 6-26 10z" fill={W.rambut} />
        <circle cx="246" cy="160" r="2.2" fill={W.rambut} />
        <path d="M246 170c3 2 7 2 10 0" fill="none" stroke={W.kulitTua} strokeWidth="2" strokeLinecap="round" />
        {/* ID card */}
        <rect x="262" y="210" width="12" height="16" rx="2" fill={W.putih} />
        <rect x="264" y="214" width="8" height="3" rx="1" fill={W.b500} />
      </g>

      {/* laptop */}
      <g>
        <path d="M168 196h76l-10 58h-76z" fill={W.b800} />
        <path d="M172 200h68l-9 50h-68z" fill="url(#il-layar)" />
        <rect x="178" y="210" width="26" height="4" rx="2" fill={W.b500} />
        <rect x="176" y="220" width="40" height="3" rx="1.5" fill={W.b300} />
        <rect x="175" y="228" width="34" height="3" rx="1.5" fill={W.b300} />
        <rect x="174" y="236" width="44" height="3" rx="1.5" fill={W.b300} />
        <circle cx="226" cy="214" r="5" fill={W.amber} />
        <path d="M150 254h100l-4 8h-100z" fill={W.b900} />
      </g>

      {/* KARTU: daftar mitra */}
      <Melayang tunda={0} jarak={7}>
        <g filter="url(#il-bayang)">
          <rect x="44" y="104" width="118" height="82" rx="14" fill={W.putih} />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(56 ${118 + i * 22})`}>
              <circle cx="8" cy="6" r="8" fill={[W.b200, '#fde5b8', '#fcd5d1'][i]} />
              <rect x="22" y="1" width={[52, 44, 58][i]} height="4" rx="2" fill={W.b800} opacity=".8" />
              <rect x="22" y="8" width={[34, 40, 28][i]} height="3" rx="1.5" fill={W.b300} />
              <circle cx="92" cy="6" r="6" fill={i === 2 ? W.b100 : W.b500} />
              {i !== 2 && <path d="M89 6l2 2 4-4" fill="none" stroke={W.putih} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            </g>
          ))}
        </g>
      </Melayang>

      {/* KARTU: rekap honor (grafik batang) */}
      <Melayang tunda={1.2} jarak={8} durasi={6}>
        <g filter="url(#il-bayang)">
          <rect x="318" y="150" width="112" height="86" rx="14" fill={W.putih} />
          <rect x="330" y="162" width="44" height="5" rx="2.5" fill={W.b800} opacity=".8" />
          <text x="330" y="182" fontSize="11" fontWeight="800" fill={W.b600} fontFamily="Plus Jakarta Sans, sans-serif">Rp</text>
          {[22, 34, 26, 44, 38].map((t, i) => (
            <rect key={i} x={334 + i * 17} y={226 - t} width="10" height={t} rx="3" fill={i === 3 ? W.amber : W.b400} />
          ))}
        </g>
      </Melayang>

      {/* KARTU: dokumen SPK/BAST dengan stempel */}
      <Melayang tunda={0.6} jarak={6} durasi={5.5}>
        <g filter="url(#il-bayang)" transform="rotate(-6 210 80)">
          <rect x="174" y="38" width="78" height="96" rx="10" fill={W.putih} />
          <rect x="186" y="52" width="40" height="5" rx="2.5" fill={W.b800} opacity=".8" />
          {[0, 1, 2, 3].map((i) => <rect key={i} x="186" y={66 + i * 10} width={[54, 48, 54, 36][i]} height="3" rx="1.5" fill={W.b200} />)}
          <circle cx="226" cy="114" r="11" fill="none" stroke={W.merah} strokeWidth="2.5" />
          <path d="M221 114l4 4 7-8" fill="none" stroke={W.merah} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </Melayang>

      {/* KARTU: kalender */}
      <Melayang tunda={1.8} jarak={5} durasi={4.5}>
        <g filter="url(#il-bayang)">
          <rect x="300" y="52" width="62" height="58" rx="12" fill={W.putih} />
          <rect x="300" y="52" width="62" height="16" rx="12" fill={W.b500} />
          <rect x="300" y="60" width="62" height="8" fill={W.b500} />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={310 + (i % 3) * 15} y={76 + Math.floor(i / 3) * 14} width="9" height="8" rx="2" fill={i === 4 ? W.amber : W.b100} />
          ))}
        </g>
      </Melayang>
    </svg>
  );
}
