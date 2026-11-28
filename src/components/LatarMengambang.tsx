/**
 * Latar beranimasi halaman masuk: kotak membulat & lingkaran tembus pandang yang naik pelan sambil berputar.
 * Hanya CSS (ringan), dan otomatis diam bila perangkat meminta "kurangi gerakan".
 */
const BENTUK = [
  // kiri (%), ukuran (px), durasi (detik), tunda (detik, negatif = sudah berjalan), bulat?, warna
  { x: 6, u: 64, d: 26, t: -4, bulat: false, w: 'bg-brand-300/25' },
  { x: 14, u: 18, d: 19, t: -12, bulat: true, w: 'bg-brand-400/30' },
  { x: 22, u: 96, d: 34, t: -20, bulat: false, w: 'bg-white/40' },
  { x: 33, u: 26, d: 22, t: -2, bulat: false, w: 'bg-amber-200/40' },
  { x: 44, u: 12, d: 17, t: -9, bulat: true, w: 'bg-brand-500/25' },
  { x: 52, u: 72, d: 30, t: -15, bulat: true, w: 'bg-brand-200/35' },
  { x: 61, u: 20, d: 21, t: -6, bulat: false, w: 'bg-brand-400/25' },
  { x: 70, u: 110, d: 38, t: -26, bulat: false, w: 'bg-white/35' },
  { x: 79, u: 14, d: 18, t: -14, bulat: true, w: 'bg-amber-300/35' },
  { x: 86, u: 54, d: 27, t: -1, bulat: false, w: 'bg-brand-300/25' },
  { x: 93, u: 22, d: 23, t: -18, bulat: true, w: 'bg-brand-400/25' },
  { x: 40, u: 44, d: 29, t: -24, bulat: false, w: 'bg-brand-200/30' },
];

export function LatarMengambang() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BENTUK.map((b, i) => (
        <span key={i} className={`gelembung absolute bottom-0 ${b.w} ${b.bulat ? 'rounded-full' : 'rounded-[30%]'}`}
          style={{ left: `${b.x}%`, width: b.u, height: b.u, animationDuration: `${b.d}s`, animationDelay: `${b.t}s` }} />
      ))}
    </div>
  );
}
