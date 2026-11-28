/**
 * Latar beranimasi halaman masuk:
 * - gelombang air berlapis di bagian bawah yang mengalun pelan,
 * - riak tetesan air (lingkaran melebar lalu memudar) di beberapa titik.
 * Hanya CSS/SVG (ringan) dan otomatis diam bila perangkat meminta "kurangi gerakan".
 */

/** Satu potongan gelombang selebar 1440; dipasang dua kali berdampingan agar bisa bergeser tanpa putus */
const GELOMBANG = 'M0 60 C 240 10 480 10 720 60 S 1200 110 1440 60 V 160 H 0 Z';

const LAPISAN = [
  { warna: 'fill-brand-200/40', durasi: 26, tinggi: 'h-40', mundur: false, naik: 'bottom-0' },
  { warna: 'fill-brand-300/25', durasi: 18, tinggi: 'h-32', mundur: true, naik: '-bottom-2' },
  { warna: 'fill-amber-100/50', durasi: 34, tinggi: 'h-24', mundur: false, naik: '-bottom-3' },
];

const RIAK = [
  { x: '12%', y: '22%', tunda: 0 },
  { x: '86%', y: '16%', tunda: 2.6 },
  { x: '78%', y: '70%', tunda: 5.1 },
  { x: '8%', y: '64%', tunda: 7.4 },
];

export function LatarAnimasi() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {RIAK.map((r, i) => (
        <span key={i} className="absolute" style={{ left: r.x, top: r.y }}>
          {[0, 1, 2].map((k) => (
            <span key={k} className="riak absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-300/50"
              style={{ animationDelay: `${r.tunda + k * 1.1}s` }} />
          ))}
          <span className="tetes absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400/50" style={{ animationDelay: `${r.tunda}s` }} />
        </span>
      ))}
      {LAPISAN.map((l, i) => (
        <div key={i} className={`absolute inset-x-0 ${l.naik} ${l.tinggi} overflow-hidden`}>
          <svg viewBox="0 0 2880 160" preserveAspectRatio="none" className={`ombak h-full w-[200%] ${l.warna}`}
            style={{ animationDuration: `${l.durasi}s`, animationDirection: l.mundur ? 'reverse' : 'normal' }}>
            <path d={GELOMBANG} />
            <path d={GELOMBANG} transform="translate(1440 0)" />
          </svg>
        </div>
      ))}
    </div>
  );
}
