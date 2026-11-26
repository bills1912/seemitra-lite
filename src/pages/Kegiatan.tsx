import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { ArchiveRestore, CalendarDays, CheckSquare, Copy, Pencil, Plus, Repeat, Trash2, Users, Wallet } from 'lucide-react';
import { api, segarkan } from '../lib/api';
import type { Kegiatan } from '../lib/types';
import { useAksi, usePengaturan, useSaya } from '../lib/hooks';
import { BilahPilihan, JendelaHapusBanyak } from '../components/HapusBanyak';
import { useUmpan } from '../components/umpan';
import { Pilihan, PilihTanggal, PilihBulanIsian, IsianSaran } from '../components/pemilih';
import { Jendela, KepalaHalaman, Kartu, Kolom, Kosong, Kotak, KotakCari, Lencana, Masukan, MasukanRupiah, Memuat, Segmen, Tombol, TombolIkon, cx } from '../components/ui';
import { BULAN, BULAN_PENDEK, LABEL_STATUS, bulanIni, cocok, geserBulan, labelBulan, rentang, rupiah, statusKegiatan, tambahHari, type StatusKegiatan } from '../lib/format';

const WARNA_STATUS: Record<StatusKegiatan, 'hijau' | 'biru' | 'abu'> = { berjalan: 'hijau', akan: 'biru', selesai: 'abu' };

/** Satu kartu di daftar: kegiatan biasa, atau satu seri kegiatan bulanan (beberapa bulan digabung) */
type Item = { kunci: string; utama: Kegiatan; seri: Kegiatan[] | null };

function statusSeri(seri: Kegiatan[]): StatusKegiatan {
  const st = seri.map(statusKegiatan);
  if (st.includes('berjalan')) return 'berjalan';
  if (st.every((s) => s === 'selesai')) return 'selesai';
  return 'akan';
}
/** Bulan yang "mewakili" seri: bulan berjalan, atau bulan berikutnya yang terdekat, atau bulan terakhir */
function wakilSeri(seri: Kegiatan[]) {
  const ini = bulanIni();
  return seri.find((k) => k.bulan_kegiatan === ini) ?? seri.find((k) => k.bulan_kegiatan > ini) ?? seri[seri.length - 1];
}

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
  // mode pilih banyak (khusus admin); kunci kartu → daftar id kegiatan (seri = semua bulannya)
  const admin = useSaya().data?.pengguna?.peran === 'admin';
  const [modePilih, setModePilih] = useState(false);
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [konfirmHapus, setKonfirmHapus] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  const balikPilih = (kunci: string) => setTerpilih((s) => { const n = new Set(s); n.has(kunci) ? n.delete(kunci) : n.add(kunci); return n; });
  const selesaiPilih = () => { setModePilih(false); setTerpilih(new Set()); };

  const { data, isLoading } = useQuery({ queryKey: ['kegiatan', sampah], queryFn: () => api.get<Kegiatan[]>(`/kegiatan${sampah ? '?terhapus=1' : ''}`) });
  useEffect(() => {
    if (param.get('baru')) { setForm({}); param.delete('baru'); setParam(param, { replace: true }); }
  }, [param, setParam]);

  const daftarTahun = useMemo(() => {
    const s = new Set((data ?? []).map((k) => k.bulan_kegiatan.slice(0, 4)));
    s.add(String(new Date().getFullYear()));
    return [...s].sort().reverse();
  }, [data]);

  // gabungkan kegiatan bulanan (seri) menjadi satu kartu
  const item = useMemo<Item[]>(() => {
    const perTahun = (data ?? []).filter((k) => !tahun || k.bulan_kegiatan.startsWith(tahun));
    const seri = new Map<number, Kegiatan[]>();
    const hasil: Item[] = [];
    for (const k of perTahun) {
      if (k.seri_id) {
        if (!seri.has(k.seri_id)) { seri.set(k.seri_id, []); hasil.push({ kunci: `s${k.seri_id}`, utama: k, seri: seri.get(k.seri_id)! }); }
        seri.get(k.seri_id)!.push(k);
      } else hasil.push({ kunci: `k${k.id}`, utama: k, seri: null });
    }
    for (const it of hasil) if (it.seri) { it.seri.sort((a, b) => a.tanggal_mulai.localeCompare(b.tanggal_mulai)); it.utama = wakilSeri(it.seri); }
    return hasil;
  }, [data, tahun]);
  const stItem = (it: Item) => (it.seri ? statusSeri(it.seri) : statusKegiatan(it.utama));
  const tersaring = item.filter((it) => (status === 'semua' || stItem(it) === status) && (!q || cocok(`${it.utama.nama} ${it.utama.singkatan ?? ''} ${it.utama.mak ?? ''}`, q)));
  const hitung = (s: StatusKegiatan) => item.filter((it) => stItem(it) === s).length;

  const hapus = async (it: Item) => {
    const k = it.utama;
    const seri = !!it.seri;
    if (!(await konfirmasi({
      judul: `Hapus ${k.nama}?`,
      pesan: seri ? `Semua ${it.seri!.length} bulan kegiatan bulanan ini beserta petugasnya akan dihapus. Dapat dipulihkan kembali.`
        : `Kegiatan beserta ${k.jumlah_petugas} petugasnya tidak akan dihitung di rekap honor. Dapat dipulihkan kembali.`,
      tombol: 'Hapus', bahaya: true,
    }))) return;
    try {
      await api.del(`/kegiatan/${k.id}${seri ? '?seri=1' : ''}`);
      segarkan();
      beritahu('sukses', <>Kegiatan <b>{k.nama}</b> dihapus.</>, { urungkan: async () => { await api.post(`/kegiatan/${k.id}/pulihkan${seri ? '?seri=1' : ''}`); segarkan(); } });
    } catch (e) { beritahu('galat', (e as Error).message); }
  };
  const itemTerpilih = item.filter((it) => terpilih.has(it.kunci));
  const hapusBanyak = async () => {
    const ids = itemTerpilih.flatMap((it) => (it.seri ? it.seri.map((x) => x.id) : [it.utama.id]));
    setMenghapus(true);
    try {
      const r = await api.post<{ jumlah: number }>('/kegiatan/hapus-banyak', { ids });
      segarkan();
      setKonfirmHapus(false);
      selesaiPilih();
      beritahu('sukses', <><b>{r.jumlah}</b> kegiatan dipindahkan ke tempat sampah.</>, { urungkan: async () => { await api.post('/kegiatan/pulihkan-banyak', { ids }); segarkan(); } });
    } catch (e) { beritahu('galat', (e as Error).message); } finally { setMenghapus(false); }
  };
  const pulihkan = useAksi((k: Kegiatan) => api.post(`/kegiatan/${k.id}/pulihkan${k.seri_id ? '?seri=1' : ''}`), { sukses: (_, k) => `${k.nama} dipulihkan.` });

  return (
    <div>
      <KepalaHalaman judul={sampah ? 'Kegiatan terhapus' : 'Kegiatan Survei & Sensus'} sub={sampah ? 'Pulihkan kegiatan yang terhapus.' : 'Atur jadwal, tarif honor, dan petugas setiap kegiatan.'}
        aksi={sampah ? <Tombol varian="kedua" onClick={() => setSampah(false)}>Kembali</Tombol> : <>
          {admin && <Tombol varian={modePilih ? 'lembut' : 'kedua'} ikon={<CheckSquare className="size-4" />} onClick={() => (modePilih ? selesaiPilih() : setModePilih(true))}>{modePilih ? 'Batal pilih' : 'Pilih'}</Tombol>}
          <Tombol ikon={<Plus className="size-4" />} onClick={() => setForm({})}>Tambah Kegiatan</Tombol>
        </>} />

      {!sampah && (
        <Kartu className="mb-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <KotakCari nilai={q} ubah={setQ} placeholder="Cari nama kegiatan atau kode anggaran…" className="flex-1" />
          <Segmen id="status-kegiatan" nilai={status} ubah={setStatus} opsi={[
            { nilai: 'semua', label: 'Semua', jumlah: item.length }, { nilai: 'berjalan', label: 'Berjalan', jumlah: hitung('berjalan') },
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
            {tersaring.map((it, i) => {
              const k = it.utama;
              const st = stItem(it);
              const persen = k.target_petugas ? Math.min(100, (k.jumlah_petugas / k.target_petugas) * 100) : null;
              const totalSeri = it.seri?.reduce((s, x) => s + x.total_honor, 0) ?? k.total_honor;
              return (
                <motion.div key={it.kunci} layout initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.03 } }}
                  exit={{ opacity: 0, scale: 0.9 }} whileHover={{ y: -3 }}>
                  <Kartu onClick={() => (modePilih ? balikPilih(it.kunci) : !sampah && nav(`/kegiatan/${k.id}`))}
                    className={cx('group flex h-full cursor-pointer flex-col p-5 transition-shadow hover:shadow-melayang', sampah && 'cursor-default', modePilih && terpilih.has(it.kunci) && 'ring-2 ring-rose-400 bg-rose-50/40')}>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {modePilih && <span onClick={(e) => e.stopPropagation()}><Kotak aktif={terpilih.has(it.kunci)} ubah={() => balikPilih(it.kunci)} /></span>}
                        <Lencana warna={WARNA_STATUS[st]} titik>{LABEL_STATUS[st]}</Lencana>
                        <Lencana warna="brand">{k.jenis}</Lencana>
                        {it.seri && <Lencana warna="biru"><Repeat className="size-3" /> Bulanan</Lencana>}
                      </div>
                      <div className={cx('-mr-2 -mt-1 flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100', modePilih && 'invisible')} onClick={(e) => e.stopPropagation()}>
                        {sampah ? <Tombol kecil varian="lembut" ikon={<ArchiveRestore className="size-4" />} onClick={() => pulihkan.mutate(k)}>Pulihkan</Tombol> : <>
                          {!it.seri && <TombolIkon label="Salin untuk periode lain" onClick={() => setSalin(k)}><Copy className="size-4" /></TombolIkon>}
                          <TombolIkon label={it.seri ? `Ubah (bulan ${labelBulan(k.bulan_kegiatan)})` : 'Ubah'} onClick={() => setForm(k)}><Pencil className="size-4" /></TombolIkon>
                          <TombolIkon label={it.seri ? 'Hapus semua bulan' : 'Hapus'} onClick={() => hapus(it)} className="hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></TombolIkon>
                        </>}
                      </div>
                    </div>
                    <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-stone-900">{k.nama}</h3>
                    {it.seri ? (
                      <>
                        <p className="mt-1 text-sm text-stone-500">{BULAN_PENDEK[Number(it.seri[0].bulan_kegiatan.slice(5)) - 1]}–{BULAN_PENDEK[Number(it.seri[it.seri.length - 1].bulan_kegiatan.slice(5)) - 1]} {it.seri[0].bulan_kegiatan.slice(0, 4)} · {it.seri.length} bulan</p>
                        {/* pilih bulan: tiap kotak = satu bulan; hijau bila sudah ada petugas */}
                        <div className={cx('mt-3 grid grid-cols-6 gap-1', modePilih && 'pointer-events-none')} onClick={(e) => !modePilih && e.stopPropagation()}>
                          {it.seri.map((x) => {
                            const ini = x.id === k.id;
                            return (
                              <button key={x.id} type="button" title={`${labelBulan(x.bulan_kegiatan)} · ${x.jumlah_petugas} petugas · ${rupiah(x.total_honor)}`}
                                onClick={() => !sampah && nav(`/kegiatan/${x.id}`)}
                                className={cx('rounded-md py-1 text-[11px] font-bold transition hover:scale-105',
                                  x.jumlah_petugas ? 'bg-brand-100 text-brand-800' : 'bg-stone-100 text-stone-400',
                                  ini && 'ring-2 ring-brand-500 ring-offset-1')}>
                                {BULAN_PENDEK[Number(x.bulan_kegiatan.slice(5)) - 1]}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-stone-500">{rentang(k.tanggal_mulai, k.tanggal_selesai)}</p>
                    )}
                    <div className="mt-auto pt-5">
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-stone-500"><Users className="size-4" /> Petugas{it.seri ? ` ${BULAN[Number(k.bulan_kegiatan.slice(5)) - 1]}` : ''}</span>
                        <span className="font-semibold text-stone-700">{k.jumlah_petugas}{k.target_petugas ? ` / ${k.target_petugas}` : ''}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <motion.div className={cx('h-full rounded-full', persen === 100 ? 'bg-emerald-500' : 'bg-brand-500')} initial={{ width: 0 }}
                          animate={{ width: `${persen ?? (k.jumlah_petugas ? 100 : 0)}%` }} transition={{ duration: 0.8, delay: 0.1 }} />
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
                        <span className="flex items-center gap-1.5 text-stone-500"><Wallet className="size-4" />{it.seri ? 'Total setahun' : `Dibayar ${labelBulan(k.bulan_honor)}`}</span>
                        <span className="angka font-bold text-stone-800">{rupiah(totalSeri)}</span>
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

      <BilahPilihan aktif={modePilih} jumlah={terpilih.size} totalTampil={tersaring.length}
        pilihSemua={() => setTerpilih(new Set(tersaring.map((it) => it.kunci)))} kosongkan={() => setTerpilih(new Set())} batal={selesaiPilih} hapus={() => setKonfirmHapus(true)} />
      <JendelaHapusBanyak buka={konfirmHapus} tutup={() => setKonfirmHapus(false)} jenis="kegiatan" memuat={menghapus} setuju={hapusBanyak}
        nama={itemTerpilih.map((it) => (it.seri ? `${it.utama.nama} (bulanan, ${it.seri.length} bulan)` : it.utama.nama))}
        keterangan={<>Kegiatan beserta penugasan petugasnya dipindahkan ke <b>tempat sampah</b> dan masih bisa dipulihkan. Kegiatan bulanan ikut terhapus semua bulannya. Untuk mengosongkan seluruh data secara permanen, gunakan <b>Pengaturan → Reset data</b>.</>} />
      <FormKegiatan data={form} tutup={() => setForm(null)} setelahBaru={(id) => nav(`/kegiatan/${id}`)} />
      <SalinKegiatan asal={salin} tutup={() => setSalin(null)} />
    </div>
  );
}

/* ---------------------------- Formulir kegiatan ---------------------------- */
type IsiForm = Partial<Kegiatan> & { pola?: 'sekali' | 'bulanan'; tahun?: number; bulan_dari?: number; bulan_sampai?: number; hari_mulai?: number; hari_selesai?: number; jeda_bayar?: number };

export function FormKegiatan({ data, tutup, setelahBaru }: { data: Partial<Kegiatan> | null; tutup: () => void; setelahBaru?: (id: number) => void }) {
  const { data: atur } = usePengaturan();
  const jeda = atur?.jeda_pembayaran ?? 1;
  const [f, setF] = useState<IsiForm>({});
  const [bayarManual, setBayarManual] = useState(false);
  const [terapkan, setTerapkan] = useState(true);
  const [terapkanSeri, setTerapkanSeri] = useState(true);
  useEffect(() => {
    if (!data) return;
    const tahunIni = new Date().getFullYear();
    setF({
      jenis: 'Survei', satuan: atur?.daftar_satuan[0] ?? 'Dokumen', tarif: {}, pola: 'sekali',
      tahun: tahunIni, bulan_dari: 1, bulan_sampai: 12, hari_mulai: 1, hari_selesai: 31, jeda_bayar: jeda, ...data,
    });
    // bulan pembayaran dianggap "manual" bila berbeda dari aturan otomatis
    setBayarManual(!!data.id && !!data.bulan_kegiatan && data.bulan_honor !== geserBulan(data.bulan_kegiatan, jeda));
    setTerapkanSeri(true);
  }, [data, atur]); // eslint-disable-line react-hooks/exhaustive-deps
  const edit = !!data?.id;
  const bulanan = f.pola === 'bulanan' && !edit;
  const bulanKegiatan = f.tanggal_selesai?.slice(0, 7);
  const bayarOtomatis = bulanKegiatan ? geserBulan(bulanKegiatan, jeda) : undefined;
  const bulanBayar = bayarManual ? f.bulan_honor : bayarOtomatis;

  const tarifBerubah = edit && JSON.stringify(data?.tarif ?? {}) !== JSON.stringify(Object.fromEntries(Object.entries(f.tarif ?? {}).filter(([, v]) => v > 0)));
  const simpan = useAksi(
    (v: IsiForm): Promise<{ id?: number; jumlah?: number; ikutDiubah?: number }> => {
      if (v.id) return api.put(`/kegiatan/${v.id}`, { ...v, bulan_honor: bulanBayar, terapkan_tarif: tarifBerubah && terapkan, terapkan_seri: !!v.seri_id && terapkanSeri });
      if (bulanan) return api.post('/kegiatan', { ...v, pola: 'bulanan' });
      return api.post('/kegiatan', { ...v, pola: 'sekali', bulan_honor: bayarManual ? v.bulan_honor : undefined });
    },
    {
      sukses: (r, v) => (v.id ? `Kegiatan diperbarui${r.ikutDiubah ? ` (juga ${r.ikutDiubah} bulan berikutnya)` : ''}.` : r.jumlah ? `${r.jumlah} kegiatan bulanan dibuat. Sekarang tambahkan petugasnya.` : 'Kegiatan ditambahkan. Sekarang tambahkan petugasnya.'),
      setelah: (r, v) => { tutup(); if (!v.id && setelahBaru && r.id) setelahBaru(r.id); },
    },
  );
  const peranTampil = [...new Set([...(atur?.daftar_peran ?? []), ...Object.keys(f.tarif ?? {})])];
  const tahunPilihan = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - 1 + i));
  const opsiBulan = BULAN.map((b, i) => ({ nilai: String(i + 1), label: b }));

  return (
    <Jendela buka={!!data} tutup={tutup} lebar="max-w-2xl" judul={edit ? `Ubah kegiatan${data?.seri_id ? ` · ${labelBulan(data.bulan_kegiatan)}` : ''}` : 'Tambah kegiatan'}
      kaki={<><Tombol varian="kedua" onClick={tutup}>Batal</Tombol><Tombol memuat={simpan.isPending} onClick={() => simpan.mutate(f)}>{bulanan ? `Buat ${Math.max(0, (f.bulan_sampai ?? 12) - (f.bulan_dari ?? 1) + 1)} kegiatan bulanan` : 'Simpan'}</Tombol></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); simpan.mutate(f); }}>
        {!edit && (
          <div className="sm:col-span-2">
            <Segmen id="pola" nilai={f.pola ?? 'sekali'} ubah={(v) => setF({ ...f, pola: v })} opsi={[
              { nilai: 'sekali', label: <><CalendarDays className="size-4" /> Kegiatan sekali</> },
              { nilai: 'bulanan', label: <><Repeat className="size-4" /> Bulanan sepanjang tahun</> },
            ]} />
            {bulanan && <p className="mt-2 text-xs text-stone-500">Dibuat satu kegiatan untuk setiap bulan, masing-masing dengan petugasnya sendiri. SPK & BAST tetap dibuat per bulan, digabung dengan kegiatan lain di bulan yang sama.</p>}
          </div>
        )}
        <Kolom label="Nama kegiatan" wajib className="sm:col-span-2" petunjuk="Nama ini tercetak di SPK & BAST.">
          <Masukan autoFocus value={f.nama ?? ''} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="mis. Survei Harga Konsumen (SHK)" />
        </Kolom>
        <Kolom label="Jenis kegiatan">
          <Segmen id="jenis" nilai={f.jenis ?? 'Survei'} ubah={(v) => setF({ ...f, jenis: v })} opsi={(atur?.daftar_jenis ?? ['Survei', 'Sensus']).map((j) => ({ nilai: j, label: j }))} />
        </Kolom>
        <Kolom label="Singkatan" petunjuk="Opsional, untuk pencarian."><Masukan value={f.singkatan ?? ''} onChange={(e) => setF({ ...f, singkatan: e.target.value })} placeholder="mis. SHK" /></Kolom>

        {bulanan ? (
          <div className="grid gap-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 sm:col-span-2 sm:grid-cols-4">
            <Kolom label="Tahun"><Pilihan nilai={String(f.tahun)} ubah={(v) => setF({ ...f, tahun: Number(v) })} opsi={tahunPilihan} /></Kolom>
            <Kolom label="Dari bulan"><Pilihan nilai={String(f.bulan_dari)} ubah={(v) => setF({ ...f, bulan_dari: Number(v), bulan_sampai: Math.max(Number(v), f.bulan_sampai ?? 12) })} opsi={opsiBulan} /></Kolom>
            <Kolom label="Sampai bulan"><Pilihan nilai={String(f.bulan_sampai)} ubah={(v) => setF({ ...f, bulan_sampai: Number(v) })} opsi={opsiBulan.filter((o) => Number(o.nilai) >= (f.bulan_dari ?? 1))} /></Kolom>
            <Kolom label="Dibayar">
              <Pilihan nilai={String(f.jeda_bayar ?? jeda)} ubah={(v) => setF({ ...f, jeda_bayar: Number(v) })}
                opsi={[{ nilai: '0', label: 'Bulan yang sama' }, { nilai: '1', label: 'Bulan berikutnya' }, { nilai: '2', label: '2 bulan setelahnya' }, { nilai: '3', label: '3 bulan setelahnya' }]} />
            </Kolom>
            <Kolom label="Tanggal mulai tiap bulan" petunjuk="1–28"><Masukan type="number" min={1} max={28} value={f.hari_mulai ?? 1} onChange={(e) => setF({ ...f, hari_mulai: Number(e.target.value) })} /></Kolom>
            <Kolom label="Tanggal selesai tiap bulan" petunjuk="31 = akhir bulan"><Masukan type="number" min={1} max={31} value={f.hari_selesai ?? 31} onChange={(e) => setF({ ...f, hari_selesai: Number(e.target.value) })} /></Kolom>
            <div className="text-xs text-stone-600 sm:col-span-2 sm:self-center">
              Contoh bulan pertama: <b>{(() => {
                const t = f.tahun ?? new Date().getFullYear(), m = f.bulan_dari ?? 1;
                const akhir = new Date(Date.UTC(t, m, 0)).getUTCDate();
                return `${Math.min(f.hari_mulai ?? 1, akhir)}–${Math.min(Math.max(f.hari_selesai ?? 31, f.hari_mulai ?? 1), akhir)} ${BULAN[m - 1]} ${t}`;
              })()}</b>, dibayar {labelBulan(geserBulan(`${f.tahun}-${String(f.bulan_dari ?? 1).padStart(2, '0')}`, f.jeda_bayar ?? jeda))}.
            </div>
          </div>
        ) : (
          <>
            <Kolom label="Tanggal mulai" wajib><PilihTanggal nilai={f.tanggal_mulai} ubah={(v) => setF({ ...f, tanggal_mulai: v, tanggal_selesai: f.tanggal_selesai && f.tanggal_selesai >= v ? f.tanggal_selesai : v })} /></Kolom>
            <Kolom label="Tanggal selesai" wajib><PilihTanggal nilai={f.tanggal_selesai} min={f.tanggal_mulai} ubah={(v) => setF({ ...f, tanggal_selesai: v })} /></Kolom>
            <div className="rounded-2xl bg-stone-50 p-3 text-sm sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-stone-500">Bulan kegiatan: <b className="text-stone-800">{bulanKegiatan ? labelBulan(bulanKegiatan) : '—'}</b> <span className="text-xs">(dari tanggal selesai · dasar SBML, SPK & BAST)</span></div>
                  <div className="mt-0.5 text-stone-500">Bulan pembayaran: <b className="text-stone-800">{bulanBayar ? labelBulan(bulanBayar) : '—'}</b> {!bayarManual && <span className="text-xs">(otomatis {jeda === 0 ? 'bulan yang sama' : `${jeda} bulan setelah kegiatan`})</span>}</div>
                </div>
                <Kotak aktif={bayarManual} ubah={(v) => { setBayarManual(v); if (v && !f.bulan_honor) setF({ ...f, bulan_honor: bayarOtomatis }); }} label={<span className="text-xs font-semibold">Atur bulan pembayaran sendiri</span>} />
              </div>
              <AnimatePresence>
                {bayarManual && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-3 max-w-xs"><PilihBulanIsian nilai={f.bulan_honor} ubah={(v) => setF({ ...f, bulan_honor: v })} /></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        <Kolom label="Target jumlah petugas"><Masukan type="number" min={0} value={f.target_petugas ?? ''} onChange={(e) => setF({ ...f, target_petugas: e.target.value ? Number(e.target.value) : null })} placeholder="opsional" /></Kolom>
        <Kolom label="Satuan beban kerja" petunjuk="Mis. Dokumen, Ruta, BS.">
          <IsianSaran nilai={f.satuan ?? ''} ubah={(v) => setF({ ...f, satuan: v })} saran={atur?.daftar_satuan ?? []} />
        </Kolom>
        <Kolom label="Kode beban anggaran (MAK)" className="sm:col-span-2"><Masukan value={f.mak ?? ''} onChange={(e) => setF({ ...f, mak: e.target.value })} placeholder="054.01.GG.xxxx.xxx.005.A.521213" /></Kolom>

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
        {edit && data?.seri_id && (
          <div className="rounded-xl bg-sky-50 p-3 sm:col-span-2">
            <Kotak aktif={terapkanSeri} ubah={setTerapkanSeri} label={<span>Terapkan perubahan nama, jenis, satuan, MAK, target, dan tarif ke <b>bulan-bulan berikutnya</b> dalam kegiatan bulanan ini (tanggal tidak berubah)</span>} />
          </div>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Jendela>
  );
}

/* ---------------------------- Salin kegiatan (untuk periode lain) ---------------------------- */
export function SalinKegiatan({ asal, tutup }: { asal: Kegiatan | null; tutup: () => void }) {
  const nav = useNavigate();
  const { data: atur } = usePengaturan();
  const jeda = atur?.jeda_pembayaran ?? 1;
  const [f, setF] = useState({ nama: '', tanggal_mulai: '', tanggal_selesai: '', salin_petugas: true, salin_volume: true });
  useEffect(() => {
    if (!asal) return;
    const geser = (iso: string) => {
      const b = geserBulan(iso.slice(0, 7), 1);
      const hari = Math.min(Number(iso.slice(8, 10)), 28);
      return `${b}-${String(hari).padStart(2, '0')}`;
    };
    const mulai = geser(asal.tanggal_mulai);
    const lama = (Date.parse(asal.tanggal_selesai) - Date.parse(asal.tanggal_mulai)) / 864e5;
    setF({ nama: asal.nama, tanggal_mulai: mulai, tanggal_selesai: tambahHari(mulai, lama), salin_petugas: true, salin_volume: true });
  }, [asal]);
  const kirim = useAksi(() => api.post<{ id: number }>(`/kegiatan/${asal!.id}/salin`, f), { sukses: 'Kegiatan berhasil disalin.', setelah: (r) => { tutup(); nav(`/kegiatan/${r.id}`); } });
  return (
    <Jendela buka={!!asal} tutup={tutup} judul="Salin kegiatan" sub="Jadwal, tarif, dan petugas disalin ke periode baru. Untuk kegiatan yang ada setiap bulan, gunakan pilihan “Bulanan sepanjang tahun” saat menambah kegiatan."
      kaki={<><Tombol varian="kedua" onClick={tutup}>Batal</Tombol><Tombol memuat={kirim.isPending} ikon={<Copy className="size-4" />} onClick={() => kirim.mutate(undefined)}>Salin</Tombol></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Kolom label="Nama kegiatan baru" className="sm:col-span-2"><Masukan value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Kolom>
        <Kolom label="Tanggal mulai"><PilihTanggal nilai={f.tanggal_mulai} ubah={(v) => setF({ ...f, tanggal_mulai: v, tanggal_selesai: f.tanggal_selesai >= v ? f.tanggal_selesai : v })} /></Kolom>
        <Kolom label="Tanggal selesai"><PilihTanggal nilai={f.tanggal_selesai} min={f.tanggal_mulai} ubah={(v) => setF({ ...f, tanggal_selesai: v })} /></Kolom>
        <p className="text-xs text-stone-500 sm:col-span-2">Bulan kegiatan {f.tanggal_selesai ? labelBulan(f.tanggal_selesai.slice(0, 7)) : '—'}, dibayar {f.tanggal_selesai ? labelBulan(geserBulan(f.tanggal_selesai.slice(0, 7), jeda)) : '—'} (otomatis).</p>
        <div className="space-y-3 sm:col-span-2">
          <Kotak aktif={f.salin_petugas} ubah={(v) => setF({ ...f, salin_petugas: v })} label={<span>Salin juga daftar petugas <span className="text-stone-400">({asal?.jumlah_petugas ?? 0} mitra)</span></span>} />
          {f.salin_petugas && <div className="pl-7"><Kotak aktif={f.salin_volume} ubah={(v) => setF({ ...f, salin_volume: v })} label="Salin volume beban kerja (jika tidak, volume diisi 0)" /></div>}
        </div>
      </div>
      <p className="mt-4 text-xs text-stone-400">Tip: buka kegiatan asal di <Link to={`/kegiatan/${asal?.id}`} className="underline" onClick={tutup}>halaman detail</Link> untuk membandingkan.</p>
    </Jendela>
  );
}
