/**
 * Aturan SBML (batas honor mitra per bulan):
 * - Batas berbeda untuk setiap PERAN (PPL, PML, Pengolahan, …) dan diatur per tahun di menu Pengaturan.
 * - Dicek PER BULAN KEGIATAN (bulan honor): honor seorang mitra untuk satu peran di satu bulan
 *   dijumlahkan dari semua kegiatan, lalu dibandingkan dengan SBML peran tersebut.
 * - "Mendekati" = sudah mencapai ambang peringatan (bawaan 80%) dari SBML; "melebihi" = di atas SBML.
 */
export type StatusSbml = 'tanpa' | 'aman' | 'dekat' | 'lewat';
export type PetaSbml = Record<string, number>;

export function statusSbml(honor: number, batas: number | undefined, ambang: number): StatusSbml {
  if (!batas) return 'tanpa';
  if (honor > batas) return 'lewat';
  if (honor >= (batas * ambang) / 100) return 'dekat';
  return 'aman';
}

const PERINGKAT: Record<StatusSbml, number> = { tanpa: 0, aman: 0, dekat: 1, lewat: 2 };
export const lebihBuruk = (a: StatusSbml, b: StatusSbml | undefined) => PERINGKAT[a] > PERINGKAT[b ?? 'aman'];

export const persen = (honor: number, batas: number) => Math.round((honor / batas) * 100);

/** Honor per peran dari daftar tugas */
export function jumlahPerPeran(tugas: { peran: string; honor: number }[]) {
  const per: Record<string, number> = {};
  for (const t of tugas) per[t.peran] = (per[t.peran] ?? 0) + t.honor;
  return per;
}

/** Status terburuk dari honor per peran */
export function statusTerburuk(per: Record<string, number>, sbml: PetaSbml, ambang: number) {
  let hasil: { status: StatusSbml; peran?: string; rasio: number } = { status: Object.keys(sbml).length ? 'aman' : 'tanpa', rasio: 0 };
  for (const [peran, honor] of Object.entries(per)) {
    const batas = sbml[peran];
    if (!batas) continue;
    const st = statusSbml(honor, batas, ambang);
    const rasio = honor / batas;
    if (rasio > hasil.rasio) hasil = { status: st, peran, rasio };
  }
  return hasil;
}
