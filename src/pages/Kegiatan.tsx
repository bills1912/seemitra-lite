import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { ArchiveRestore, CalendarDays, Copy, Pencil, Plus, Trash2, Users, Wallet } from 'lucide-react';
import { api, segarkan } from '../lib/api';
import type { Kegiatan } from '../lib/types';
import { useAksi, usePengaturan } from '../lib/hooks';
import { useUmpan } from '../components/umpan';
import { Pilihan, PilihTanggal, PilihBulanIsian, IsianSaran } from '../components/pemilih';
import { Jendela, KepalaHalaman, Kartu, Kolom, Kosong, Kotak, KotakCari, Lencana, Masukan, MasukanRupiah, Memuat, Segmen, Tombol, TombolIkon, cx } from '../components/ui';
import { LABEL_STATUS, cocok, geserBulan, labelBulan, rentang, rupiah, statusKegiatan, tambahHari, type StatusKegiatan } from '../lib/format';

const WARNA_STATUS: Record<StatusKegiatan, 'hijau' | 'biru' | 'abu'> = { berjalan: 'hijau', akan: 'biru', selesai: 'abu' };

export function HalamanKegiatan() {
  const [param, setParam] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'semua' | StatusKegiatan>('semua');
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [sampah, setSampah] = useState(false);
  const [form, setForm] = useState<Partial<Kegiatan> | null>(null);
  const [salin, setSalin] = useState<Kegiatan | null>(null);
  const { beritahu, konfirmasi } = useUmpan();
  const nav = useNavigate();

  const { data, isLoading } = useQuery({ queryKey: ['kegiatan', sampah], queryFn: () => api.get<Kegiatan[]>(`/kegiatan${sampah ? '?terhapus=1' : ''}`) });
  useEffect(() => {
    if (param.get('baru')) { setForm({}); param.delete('baru'); setParam(param, { replace: true }); }
  }, [param, setParam]);

  const daftarTahun = useMemo(() => {
    const s = new Set((data ?? []).map((k) => k.bulan_honor.slice(0, 4)));
    s.add(String(new Date().getFullYear()));
    return [...s].sort().reverse();
  }, [data]);
  const perTahun = (data ?? []).filter((k) => !tahun || k.bulan_honor.startsWith(tahun) || k.tanggal_mulai.startsWith(tahun));
  const tersaring = perTahun.filter((k) => (status === 'semua' || statusKegiatan(k) === status) && (!q || cocok(`${k.nama} ${k.singkatan ?? ''} ${k.mak ?? ''}`, q)));
  const hitung = (s: StatusKegiatan) => perTahun.filter((k) => statusKegiatan(k) === s).length;

  const hapus = async (k: Kegiatan) => {
    if (!(await konfirmasi({ judul: `Hapus ${k.nama}?`, pesan: `Kegiatan beserta ${k.jumlah_petugas} petugasnya tidak akan dihitung di rekap honor. Dapat dipulihkan kembali.`, tombol: 'Hapus', bahaya: true }))) return;
    try {
      await api.del(`/kegiatan/${k.id}`);
      segarkan();
      beritahu('sukses', <>Kegiatan <b>{k.nama}</b> dihapus.</>, { urungkan: async () => { await api.post(`/kegiatan/${k.id}/pulihkan`); segarkan(); } });
    } catch (e) { beritahu('galat', (e as Error).message); }
  };
  const pulihkan = useAksi((k: Kegiatan) => api.post(`/kegiatan/${k.id}/pulihkan`), { sukses: (_, k) => `${k.nama} dipulihkan.` });

  return (
    <div>
      <KepalaHalaman judul={sampah ? 'Kegiatan terhapus' : 'Kegiatan Survei & Sensus'} sub={sampah ? 'Pulihkan kegiatan yang terhapus.' : 'Atur jadwal, tarif honor, dan petugas setiap kegiatan.'}
        aksi={sampah ? <Tombol varian="kedua" onClick={() => setSampah(false)}>Kembali</Tombol> : <Tombol ikon={<Plus className="size-4" />} onClick={() => setForm({})}>Tambah Kegiatan</Tombol>} />

      {!sampah && (
        <Kartu className="mb-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <KotakCari nilai={q} ubah={setQ} placeholder="Cari nama kegiatan atau kode anggaran…" className="flex-1" />
          <Segmen id="status-kegiatan" nilai={status} ubah={setStatus} opsi={[
            { nilai: 'semua', label: 'Semua', jumlah: perTahun.length }, { nilai: 'berjalan', label: 'Berjalan', jumlah: hitung('berjalan') },
            { nilai: 'akan', label: 'Akan datang', jumlah: hitung('akan') }, { nilai: 'selesai', label: 'Selesai', jumlah: hitung('selesai') },
          ]} />
          <Pilihan nilai={tahun} ubah={setTahun} opsi={daftarTahun.map((t) => ({ nilai: t, label: `Tahun ${t}` }))} kosong="Semua tahun" className="lg:w-40" />
        </Kartu>
      )}

      {isLoading ? <Memuat /> : tersaring.length === 0 ? (
        <Kartu><Kosong ikon={<CalendarDays className="size-7" />} judul={data?.length ? 'Tidak ada kegiatan yang cocok' : sampah ? 'Tidak ada kegiatan terhapus' : 'Belum ada kegiatan'}
          pesan={!data?.length && !sampah ? 'Mulai dengan menambahkan kegiatan survei atau sensus beserta tarif honornya.' : undefined}
          aksi={!data?.length && !sampah && <Tombol ikon={<Plus className="size-4" />} onClick={() => setForm({})}>Tambah Kegiatan</Tombol>} /></Kartu>
      ) : (
        <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {tersaring.map((k, i) => {
              const st = statusKegiatan(k);
              const persen = k.target_petugas ? Math.min(100, (k.jumlah_petugas / k.target_petugas) * 100) : null;
              return (
                <motion.div key={k.id} layout initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.03 } }}
                  exit={{ opacity: 0, scale: 0.9 }} whileHover={{ y: -3 }}>
                  <Kartu onClick={() => !sampah && nav(`/kegiatan/${k.id}`)} className={cx('group flex h-full cursor-pointer flex-col p-5 transition-shadow hover:shadow-melayang', sampah && 'cursor-default')}>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Lencana warna={WARNA_STATUS[st]} titik>{LABEL_STATUS[st]}</Lencana>
                        <Lencana warna="brand">{k.jenis}</Lencana>
                      </div>
                      <div className="-mr-2 -mt-1 flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                        {sampah ? <Tombol kecil varian="lembut" ikon={<ArchiveRestore className="size-4" />} onClick={() => pulihkan.mutate(k)}>Pulihkan</Tombol> : <>
                          <TombolIkon label="Salin untuk periode lain" onClick={() => setSalin(k)}><Copy className="size-4" /></TombolIkon>
                          <TombolIkon label="Ubah" onClick={() => setForm(k)}><Pencil className="size-4" /></TombolIkon>
                          <TombolIkon label="Hapus" onClick={() => hapus(k)} className="hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></TombolIkon>
                        </>}
                      </div>
                    </div>
                    <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-stone-900">{k.nama}</h3>
                    <p className="mt-1 text-sm text-stone-500">{rentang(k.tanggal_mulai, k.tanggal_selesai)}</p>
                    <div className="mt-auto pt-5">
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-stone-500"><Users className="size-4" /> Petugas</span>
                        <span className="font-semibold text-stone-700">{k.jumlah_petugas}{k.target_petugas ? ` / ${k.target_petugas}` : ''}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <motion.div className={cx('h-full rounded-full', persen === 100 ? 'bg-emerald-500' : 'bg-brand-500')} initial={{ width: 0 }}
                          animate={{ width: `${persen ?? (k.jumlah_petugas ? 100 : 0)}%` }} transition={{ duration: 0.8, delay: 0.1 }} />
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
                        <span className="flex items-center gap-1.5 text-stone-500"><Wallet className="size-4" /> Honor {labelBulan(k.bulan_honor)}</span>
                        <span className="angka font-bold text-stone-800">{rupiah(k.total_honor)}</span>
                      </div>
                    </div>
                  </Kartu>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
      {!sampah && <button onClick={() => setSampah(true)} className="mt-5 flex items-center gap-1.5 text-sm font-medium text-stone-400 hover:text-stone-600"><Trash2 className="size-4" /> Lihat kegiatan yang terhapus</button>}

      <FormKegiatan data={form} tutup={() => setForm(null)} setelahBaru={(id) => nav(`/kegiatan/${id}`)} />
      <SalinKegiatan asal={salin} tutup={() => setSalin(null)} />
    </div>
  );
}

/* ---------------------------- Formulir kegiatan ---------------------------- */
export function FormKegiatan({ data, tutup, setelahBaru }: { data: Partial<Kegiatan> | null; tutup: () => void; setelahBaru?: (id: number) => void }) {
  const { data: atur } = usePengaturan();
  const [f, setF] = useState<Partial<Kegiatan>>({});
  const [bulanManual, setBulanManual] = useState(false);
  const [terapkan, setTerapkan] = useState(true);
  useEffect(() => {
    if (data) {
      setF({ jenis: 'Survei', satuan: atur?.daftar_satuan[0] ?? 'Dokumen', tarif: {}, ...data });
      setBulanManual(!!data.id);
    }
  }, [data, atur]);
  const tarifBerubah = !!data?.id && JSON.stringify(data.tarif ?? {}) !== JSON.stringify(Object.fromEntries(Object.entries(f.tarif ?? {}).filter(([, v]) => v > 0)));
  const simpan = useAksi(
    (v: Partial<Kegiatan>): Promise<{ id?: number }> => (v.id ? api.put(`/kegiatan/${v.id}`, { ...v, terapkan_tarif: tarifBerubah && terapkan }) : api.post<{ id: number }>('/kegiatan', v)),
    { sukses: (_, v) => (v.id ? 'Kegiatan diperbarui.' : 'Kegiatan ditambahkan. Sekarang tambahkan petugasnya.'), setelah: (r, v) => { tutup(); if (!v.id && setelahBaru) setelahBaru(r.id!); } },
  );
  const ubahSelesai = (v: string) => setF((x) => ({ ...x, tanggal_selesai: v, bulan_honor: bulanManual ? x.bulan_honor : v.slice(0, 7) }));
  const peranTampil = [...new Set([...(atur?.daftar_peran ?? []), ...Object.keys(f.tarif ?? {})])];

  return (
    <Jendela buka={!!data} tutup={tutup} lebar="max-w-2xl" judul={data?.id ? 'Ubah kegiatan' : 'Tambah kegiatan'}
      kaki={<><Tombol varian="kedua" onClick={tutup}>Batal</Tombol><Tombol memuat={simpan.isPending} onClick={() => simpan.mutate(f)}>Simpan</Tombol></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); simpan.mutate(f); }}>
        <Kolom label="Nama kegiatan" wajib className="sm:col-span-2" petunjuk="Nama ini tercetak di SPK & BAST.">
          <Masukan autoFocus value={f.nama ?? ''} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="mis. Survei Sosial Ekonomi Nasional (Susenas) Maret 2026" />
        </Kolom>
        <Kolom label="Jenis kegiatan">
          <Segmen id="jenis" nilai={f.jenis ?? 'Survei'} ubah={(v) => setF({ ...f, jenis: v })} opsi={(atur?.daftar_jenis ?? ['Survei', 'Sensus']).map((j) => ({ nilai: j, label: j }))} />
        </Kolom>
        <Kolom label="Singkatan" petunjuk="Opsional, untuk pencarian."><Masukan value={f.singkatan ?? ''} onChange={(e) => setF({ ...f, singkatan: e.target.value })} placeholder="mis. SUSENAS" /></Kolom>
        <Kolom label="Tanggal mulai" wajib><PilihTanggal nilai={f.tanggal_mulai} ubah={(v) => setF({ ...f, tanggal_mulai: v, tanggal_selesai: f.tanggal_selesai && f.tanggal_selesai >= v ? f.tanggal_selesai : v, bulan_honor: bulanManual ? f.bulan_honor : (f.tanggal_selesai && f.tanggal_selesai >= v ? f.tanggal_selesai : v).slice(0, 7) })} /></Kolom>
        <Kolom label="Tanggal selesai" wajib><PilihTanggal nilai={f.tanggal_selesai} min={f.tanggal_mulai} ubah={ubahSelesai} /></Kolom>
        <Kolom label="Bulan pembayaran honor" wajib petunjuk="Menentukan masuk ke SPK/BAST & rekap bulan apa. Otomatis mengikuti tanggal selesai.">
          <PilihBulanIsian nilai={f.bulan_honor} ubah={(v) => { setBulanManual(true); setF({ ...f, bulan_honor: v }); }} />
        </Kolom>
        <Kolom label="Target jumlah petugas"><Masukan type="number" min={0} value={f.target_petugas ?? ''} onChange={(e) => setF({ ...f, target_petugas: e.target.value ? Number(e.target.value) : null })} placeholder="opsional" /></Kolom>
        <Kolom label="Satuan beban kerja" petunjuk="Mis. Dokumen, Ruta, BS.">
          <IsianSaran nilai={f.satuan ?? ''} ubah={(v) => setF({ ...f, satuan: v })} saran={atur?.daftar_satuan ?? []} />
        </Kolom>
        <Kolom label="Kode beban anggaran (MAK)"><Masukan value={f.mak ?? ''} onChange={(e) => setF({ ...f, mak: e.target.value })} placeholder="054.01.GG.xxxx.xxx.005.A.521213" /></Kolom>

        <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 sm:col-span-2">
          <div className="mb-3">
            <div className="text-sm font-bold text-stone-700">Tarif honor per {f.satuan || 'satuan'}</div>
            <div className="text-xs text-stone-400">Isi hanya peran yang dipakai di kegiatan ini. Honor petugas = volume × tarif.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {peranTampil.map((p) => (
              <Kolom key={p} label={p}>
                <MasukanRupiah nilai={f.tarif?.[p]} ubah={(n) => setF({ ...f, tarif: { ...f.tarif, [p]: n } })} placeholder="0" />
              </Kolom>
            ))}
          </div>
          <AnimatePresence>
            {tarifBerubah && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-3 rounded-xl bg-amber-50 p-3"><Kotak aktif={terapkan} ubah={setTerapkan} label="Terapkan tarif baru ke petugas yang sudah ditugaskan" /></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Kolom label="Keterangan" className="sm:col-span-2"><textarea className="input min-h-16" value={f.keterangan ?? ''} onChange={(e) => setF({ ...f, keterangan: e.target.value })} /></Kolom>
        <button type="submit" className="hidden" />
      </form>
    </Jendela>
  );
}

/* ---------------------------- Salin kegiatan (untuk survei rutin) ---------------------------- */
export function SalinKegiatan({ asal, tutup }: { asal: Kegiatan | null; tutup: () => void }) {
  const nav = useNavigate();
  const [f, setF] = useState({ nama: '', tanggal_mulai: '', tanggal_selesai: '', bulan_honor: '', salin_petugas: true, salin_volume: true });
  useEffect(() => {
    if (!asal) return;
    const geser = (iso: string) => {
      const b = geserBulan(iso.slice(0, 7), 1);
      const hari = Math.min(Number(iso.slice(8, 10)), 28);
      return `${b}-${String(hari).padStart(2, '0')}`;
    };
    const mulai = geser(asal.tanggal_mulai);
    const lama = (Date.parse(asal.tanggal_selesai) - Date.parse(asal.tanggal_mulai)) / 864e5;
    const selesai = tambahHari(mulai, lama);
    setF({ nama: asal.nama, tanggal_mulai: mulai, tanggal_selesai: selesai, bulan_honor: geserBulan(asal.bulan_honor, 1), salin_petugas: true, salin_volume: true });
  }, [asal]);
  const kirim = useAksi(() => api.post<{ id: number }>(`/kegiatan/${asal!.id}/salin`, f), { sukses: 'Kegiatan berhasil disalin.', setelah: (r) => { tutup(); nav(`/kegiatan/${r.id}`); } });
  return (
    <Jendela buka={!!asal} tutup={tutup} judul="Salin kegiatan" sub="Cocok untuk survei rutin: jadwal, tarif, dan petugas disalin ke periode baru."
      kaki={<><Tombol varian="kedua" onClick={tutup}>Batal</Tombol><Tombol memuat={kirim.isPending} ikon={<Copy className="size-4" />} onClick={() => kirim.mutate(undefined)}>Salin</Tombol></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Kolom label="Nama kegiatan baru" className="sm:col-span-2"><Masukan value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Kolom>
        <Kolom label="Tanggal mulai"><PilihTanggal nilai={f.tanggal_mulai} ubah={(v) => setF({ ...f, tanggal_mulai: v })} /></Kolom>
        <Kolom label="Tanggal selesai"><PilihTanggal nilai={f.tanggal_selesai} min={f.tanggal_mulai} ubah={(v) => setF({ ...f, tanggal_selesai: v, bulan_honor: v.slice(0, 7) })} /></Kolom>
        <Kolom label="Bulan honor"><PilihBulanIsian nilai={f.bulan_honor} ubah={(v) => setF({ ...f, bulan_honor: v })} /></Kolom>
        <div className="space-y-3 sm:col-span-2">
          <Kotak aktif={f.salin_petugas} ubah={(v) => setF({ ...f, salin_petugas: v })} label={<span>Salin juga daftar petugas <span className="text-stone-400">({asal?.jumlah_petugas ?? 0} mitra)</span></span>} />
          {f.salin_petugas && <div className="pl-7"><Kotak aktif={f.salin_volume} ubah={(v) => setF({ ...f, salin_volume: v })} label="Salin volume beban kerja (jika tidak, volume diisi 0)" /></div>}
        </div>
      </div>
      <p className="mt-4 text-xs text-stone-400">Tip: buka kegiatan asal di <Link to={`/kegiatan/${asal?.id}`} className="underline" onClick={tutup}>halaman detail</Link> untuk membandingkan.</p>
    </Jendela>
  );
}
