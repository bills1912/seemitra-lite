import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle, ArrowLeft, Check, Copy, Download, FileSignature, Pencil, Trash2, Upload, UserPlus, Users, Wallet, Package, CalendarRange,
} from 'lucide-react';
import { api, kirimFile, segarkan, unduhFile } from '../lib/api';
import type { Kandidat, Kegiatan, Petugas } from '../lib/types';
import { useAksi, usePengaturan } from '../lib/hooks';
import { useUmpan } from '../components/umpan';
import { Pilihan } from '../components/pemilih';
import {
  AngkaHidup, AreaUnggah, Avatar, Batang, Jendela, KepalaHalaman, Kartu, Kolom, Kosong, Kotak, KotakCari, Lencana, Masukan, MasukanRupiah, Memuat, Segmen, Tombol, TombolIkon, cx,
} from '../components/ui';
import { FormKegiatan, SalinKegiatan } from './Kegiatan';
import { LABEL_STATUS, angka, cocok, labelBulan, rentang, rupiah, statusKegiatan } from '../lib/format';

type Detail = { kegiatan: Kegiatan; petugas: Petugas[]; batas: number | null };

export function DetailKegiatan() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const { beritahu, konfirmasi } = useUmpan();
  const { data, isLoading, error } = useQuery({ queryKey: ['kegiatan', id], queryFn: () => api.get<Detail>(`/kegiatan/${id}`) });
  const [ubah, setUbah] = useState(false);
  const [salin, setSalin] = useState(false);
  const [pilih, setPilih] = useState(false);
  const [impor, setImpor] = useState(false);
  const [q, setQ] = useState('');
  const [peran, setPeran] = useState('semua');

  if (isLoading) return <Memuat />;
  if (error || !data) return <Kosong ikon={<AlertTriangle className="size-7" />} judul="Kegiatan tidak ditemukan" aksi={<Link to="/kegiatan"><Tombol>Kembali</Tombol></Link>} />;
  const { kegiatan: k, petugas, batas } = data;
  const st = statusKegiatan(k);
  const daftarPeran = [...new Set(petugas.map((p) => p.peran))];
  const tampil = petugas.filter((p) => (peran === 'semua' || p.peran === peran) && (!q || cocok(`${p.nama} ${p.sobat_id ?? ''} ${p.kecamatan ?? ''} ${p.desa ?? ''}`, q)));
  const lebih = petugas.filter((p) => batas && p.total_bulan > batas).length;

  const hapusKegiatan = async () => {
    if (!(await konfirmasi({ judul: `Hapus ${k.nama}?`, pesan: 'Kegiatan dapat dipulihkan dari halaman Kegiatan → kegiatan terhapus.', tombol: 'Hapus', bahaya: true }))) return;
    await api.del(`/kegiatan/${k.id}`);
    segarkan();
    nav('/kegiatan');
    beritahu('sukses', 'Kegiatan dihapus.', { urungkan: async () => { await api.post(`/kegiatan/${k.id}/pulihkan`); segarkan(); nav(`/kegiatan/${k.id}`); } });
  };
  const hapusPetugas = async (p: Petugas) => {
    try {
      await api.del(`/petugas/${p.id}`);
      segarkan();
      beritahu('sukses', <><b>{p.nama}</b> dikeluarkan dari kegiatan.</>, {
        urungkan: async () => { await api.post(`/kegiatan/${k.id}/petugas`, { items: [{ mitra_id: p.mitra_id, peran: p.peran, volume: p.volume, tarif: p.tarif, catatan: p.catatan }] }); segarkan(); },
      });
    } catch (e) { beritahu('galat', (e as Error).message); }
  };

  return (
    <div>
      <KepalaHalaman
        kembali={<Link to="/kegiatan" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-400 hover:text-stone-700"><ArrowLeft className="size-4" /> Semua kegiatan</Link>}
        judul={k.nama}
        sub={<span className="flex flex-wrap items-center gap-2"><Lencana warna={st === 'berjalan' ? 'hijau' : st === 'akan' ? 'biru' : 'abu'} titik>{LABEL_STATUS[st]}</Lencana><Lencana warna="brand">{k.jenis}</Lencana>{k.mak && <span className="text-xs text-stone-400">MAK {k.mak}</span>}</span>}
        aksi={<>
          <Tombol varian="kedua" ikon={<Pencil className="size-4" />} onClick={() => setUbah(true)}>Ubah</Tombol>
          <Tombol varian="kedua" ikon={<Copy className="size-4" />} onClick={() => setSalin(true)}>Salin</Tombol>
          <TombolIkon label="Hapus kegiatan" onClick={hapusKegiatan} className="border border-stone-200 bg-white hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></TombolIkon>
        </>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { ikon: CalendarRange, label: 'Jadwal', isi: rentang(k.tanggal_mulai, k.tanggal_selesai), sub: <Link to={`/rekap?bulan=${k.bulan_honor}`} className="hover:text-brand-700 hover:underline">Honor dibayar {labelBulan(k.bulan_honor)}</Link> },
          { ikon: Users, label: 'Petugas', isi: <><AngkaHidup nilai={k.jumlah_petugas} />{k.target_petugas ? <span className="text-stone-400"> / {k.target_petugas}</span> : ''}</>, sub: k.target_petugas ? (k.jumlah_petugas >= k.target_petugas ? 'Target terpenuhi ✓' : `Kurang ${k.target_petugas - k.jumlah_petugas} orang`) : 'mitra' },
          { ikon: Package, label: 'Beban kerja', isi: <><AngkaHidup nilai={k.total_volume} /> <span className="text-base font-semibold text-stone-500">{k.satuan}</span></>, sub: Object.entries(k.tarif).map(([p, t]) => `${p} ${rupiah(t)}`).join(' · ') || 'tarif belum diatur' },
          { ikon: Wallet, label: 'Total honor', isi: <AngkaHidup nilai={k.total_honor} format={rupiah} />, sub: lebih ? <span className="font-semibold text-rose-600">{lebih} mitra melebihi batas bulan ini</span> : batas ? 'semua dalam batas SBML' : 'batas SBML belum diatur' },
        ].map((c, i) => (
          <Kartu key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-stone-500"><c.ikon className="size-4 text-brand-600" />{c.label}</div>
            <div className="text-xl font-extrabold tracking-tight text-stone-900">{c.isi}</div>
            <div className="mt-0.5 truncate text-xs text-stone-400">{c.sub}</div>
          </Kartu>
        ))}
      </div>

      <Kartu className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-100 p-4 lg:flex-row lg:items-center">
          <h2 className="font-bold text-stone-900 lg:mr-2">Daftar petugas</h2>
          <KotakCari nilai={q} ubah={setQ} placeholder="Cari petugas…" className="flex-1 lg:max-w-xs" />
          {daftarPeran.length > 1 && <Segmen kecil id="peran-filter" nilai={peran} ubah={setPeran} opsi={[{ nilai: 'semua', label: 'Semua' }, ...daftarPeran.map((p) => ({ nilai: p, label: p, jumlah: petugas.filter((x) => x.peran === p).length }))]} />}
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <Tombol kecil varian="kedua" ikon={<Upload className="size-3.5" />} onClick={() => setImpor(true)}>Impor</Tombol>
            {petugas.length > 0 && <Tombol kecil varian="kedua" ikon={<Download className="size-3.5" />} onClick={() => unduhFile(`/kegiatan/${k.id}/ekspor`).catch((e) => beritahu('galat', e.message))}>Ekspor</Tombol>}
            {petugas.length > 0 && <Link to={`/dokumen?bulan=${k.bulan_honor}&kegiatan=${k.id}`}><Tombol kecil varian="kedua" ikon={<FileSignature className="size-3.5" />}>SPK/BAST</Tombol></Link>}
            <Tombol kecil ikon={<UserPlus className="size-3.5" />} onClick={() => setPilih(true)}>Tambah petugas</Tombol>
          </div>
        </div>
        {petugas.length === 0 ? (
          <Kosong ikon={<UserPlus className="size-7" />} judul="Belum ada petugas" pesan="Pilih mitra yang akan bertugas di kegiatan ini. Honor dihitung otomatis dari volume × tarif."
            aksi={<Tombol ikon={<UserPlus className="size-4" />} onClick={() => setPilih(true)}>Pilih mitra</Tombol>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-stone-50/70 text-left text-xs font-bold uppercase tracking-wide text-stone-400">
                  <th className="px-4 py-3">Mitra</th><th className="px-2 py-3">Peran</th><th className="px-2 py-3">Volume ({k.satuan})</th><th className="px-2 py-3">Tarif</th>
                  <th className="px-2 py-3 text-right">Honor</th><th className="px-4 py-3">Total honor {labelBulan(k.bulan_honor)}</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <AnimatePresence initial={false}>
                  {tampil.map((p) => <BarisPetugas key={p.id} p={p} batas={batas} hapus={() => hapusPetugas(p)} />)}
                </AnimatePresence>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-100 font-bold text-stone-700">
                  <td className="px-4 py-3" colSpan={2}>{tampil.length} petugas</td>
                  <td className="angka px-2 py-3">{angka(tampil.reduce((s, p) => s + p.volume, 0))}</td><td />
                  <td className="angka px-2 py-3 text-right">{rupiah(tampil.reduce((s, p) => s + p.honor, 0))}</td><td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="border-t border-stone-100 bg-stone-50/50 px-4 py-2.5 text-xs text-stone-400">Klik angka volume atau tarif untuk mengubahnya langsung — tersimpan otomatis.</p>
      </Kartu>

      <FormKegiatan data={ubah ? k : null} tutup={() => setUbah(false)} />
      <SalinKegiatan asal={salin ? k : null} tutup={() => setSalin(false)} />
      <PilihPetugas buka={pilih} tutup={() => setPilih(false)} kegiatan={k} />
      <ImporPetugas buka={impor} tutup={() => setImpor(false)} kegiatan={k} />
    </div>
  );
}

/* ---------------------------- Satu baris petugas dengan isian langsung ---------------------------- */
function BarisPetugas({ p, batas, hapus }: { p: Petugas; batas: number | null; hapus: () => void }) {
  const { data: atur } = usePengaturan();
  const [tersimpan, setTersimpan] = useState(false);
  const simpan = useAksi((v: Partial<Petugas>) => api.put(`/petugas/${p.id}`, v), { setelah: () => { setTersimpan(true); setTimeout(() => setTersimpan(false), 1400); } });
  const lebih = !!batas && p.total_bulan > batas;
  return (
    <motion.tr layout initial={{ opacity: 0, backgroundColor: '#ecfdf5' }} animate={{ opacity: 1, backgroundColor: 'rgba(255,255,255,0)' }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4 }} className="group">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Avatar nama={p.nama} />
          <div className="min-w-0">
            <Link to={`/mitra?lihat=${p.mitra_id}`} className="block truncate font-semibold text-stone-800 hover:text-brand-700">{p.nama}</Link>
            <div className="truncate text-xs text-stone-400">{[p.kecamatan, p.desa].filter(Boolean).join(' · ') || p.sobat_id || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5">
        <Pilihan kecil nilai={p.peran} ubah={(v) => v !== p.peran && simpan.mutate({ peran: v })} opsi={[...new Set([...(atur?.daftar_peran ?? []), p.peran])]} className="w-fit" />
      </td>
      <td className="px-2 py-2.5"><SelLangsung nilai={p.volume} simpan={(v) => simpan.mutate({ volume: v })} /></td>
      <td className="px-2 py-2.5"><SelLangsung nilai={p.tarif} uang simpan={(v) => simpan.mutate({ tarif: v })} /></td>
      <td className="px-2 py-2.5 text-right">
        <span className="inline-flex items-center gap-1.5">
          <AnimatePresence>{tersimpan && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-3" strokeWidth={3} /></motion.span>}</AnimatePresence>
          <span className={cx('angka font-bold', p.honor ? 'text-stone-800' : 'text-amber-600')}><AngkaHidup nilai={p.honor} format={rupiah} /></span>
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cx('angka text-xs font-semibold', lebih ? 'text-rose-600' : 'text-stone-500')}>{rupiah(p.total_bulan)}</span>
          {lebih && <span title="Melebihi batas honor bulanan"><AlertTriangle className="size-3.5 text-rose-500" /></span>}
        </div>
        <Batang nilai={p.total_bulan} maks={batas} className="mt-1 w-32" />
      </td>
      <td className="pr-3"><TombolIkon label="Keluarkan dari kegiatan" onClick={hapus} className="opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></TombolIkon></td>
    </motion.tr>
  );
}

function SelLangsung({ nilai, simpan, uang }: { nilai: number; simpan: (v: number) => void; uang?: boolean }) {
  const [teks, setTeks] = useState(String(nilai));
  const [fokus, setFokus] = useState(false);
  useEffect(() => { if (!fokus) setTeks(String(nilai)); }, [nilai, fokus]);
  const selesai = () => {
    setFokus(false);
    const v = Number(teks.replace(/\./g, '').replace(',', '.'));
    if (!Number.isNaN(v) && v !== nilai) simpan(v);
    else setTeks(String(nilai));
  };
  return (
    <input
      value={fokus ? teks : uang ? rupiah(nilai) : angka(nilai)}
      onFocus={(e) => { setFokus(true); setTeks(String(nilai)); setTimeout(() => e.target.select()); }}
      onChange={(e) => setTeks(e.target.value)}
      onBlur={selesai}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTeks(String(nilai)); (e.target as HTMLInputElement).blur(); } }}
      inputMode="decimal"
      className={cx('angka w-28 rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold outline-none transition hover:border-stone-200 hover:bg-white focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100',
        nilai ? 'text-stone-700' : 'text-amber-600')}
    />
  );
}

/* ---------------------------- Pemilih petugas ---------------------------- */
function PilihPetugas({ buka, tutup, kegiatan: k }: { buka: boolean; tutup: () => void; kegiatan: Kegiatan }) {
  const { data: atur } = usePengaturan();
  const { data } = useQuery({ queryKey: ['kandidat', k.id], queryFn: () => api.get<{ mitra: Kandidat[]; batas: number | null }>(`/kegiatan/${k.id}/kandidat`), enabled: buka });
  const peranAda = Object.keys(k.tarif);
  const [peran, setPeran] = useState('');
  const [volume, setVolume] = useState(0);
  const [tarif, setTarif] = useState(0);
  const [dipilih, setDipilih] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [sembunyi, setSembunyi] = useState(true);
  useEffect(() => {
    if (buka) {
      const p = peranAda[0] ?? atur?.daftar_peran[0] ?? 'PPL';
      setPeran(p); setTarif(k.tarif[p] ?? 0); setVolume(0); setDipilih(new Set()); setQ('');
    }
  }, [buka]); // eslint-disable-line
  const gantiPeran = (p: string) => { setPeran(p); setTarif(k.tarif[p] ?? 0); };

  const batas = data?.batas ?? null;
  const honorBaru = volume * tarif;
  const daftar = useMemo(() => (data?.mitra ?? []).filter((m) =>
    (!sembunyi || !(m.peran_di_sini ?? '').split(',').includes(peran)) &&
    (!q || cocok(`${m.nama} ${m.sobat_id ?? ''} ${m.kecamatan ?? ''} ${m.desa ?? ''}`, q))), [data, q, sembunyi, peran]);
  const tambah = useAksi(() => api.post(`/kegiatan/${k.id}/petugas`, { items: [...dipilih].map((id) => ({ mitra_id: id, peran, volume, tarif })) }), {
    sukses: () => `${dipilih.size} petugas ditambahkan sebagai ${peran}.`, setelah: tutup,
  });
  const balik = (id: number) => setDipilih((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const melebihi = [...dipilih].filter((id) => { const m = data?.mitra.find((x) => x.id === id); return batas && m && m.total_bulan + honorBaru > batas; }).length;

  return (
    <Jendela buka={buka} tutup={tutup} lebar="max-w-3xl" judul="Tambah petugas" sub={k.nama}
      kaki={<>
        <span className="mr-auto text-sm text-stone-500">{dipilih.size ? <><b className="text-stone-800">{dipilih.size}</b> mitra dipilih{melebihi > 0 && <span className="ml-2 font-semibold text-rose-600">· {melebihi} akan melebihi batas</span>}</> : 'Belum ada yang dipilih'}</span>
        <Tombol varian="kedua" onClick={tutup}>Batal</Tombol>
        <Tombol disabled={!dipilih.size} memuat={tambah.isPending} ikon={<UserPlus className="size-4" />} onClick={() => tambah.mutate(undefined)}>Tambahkan</Tombol>
      </>}>
      <div className="mb-4 grid gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-3">
        <Kolom label="Sebagai"><Pilihan nilai={peran} ubah={gantiPeran} opsi={[...new Set([...peranAda, ...(atur?.daftar_peran ?? [])])]} /></Kolom>
        <Kolom label={`Volume (${k.satuan})`} petunjuk="Boleh diisi nanti"><Masukan type="number" min={0} value={volume || ''} onChange={(e) => setVolume(Number(e.target.value))} placeholder="0" /></Kolom>
        <Kolom label="Tarif" petunjuk={honorBaru ? `Honor per orang ${rupiah(honorBaru)}` : 'dari tarif kegiatan'}><MasukanRupiah nilai={tarif} ubah={setTarif} /></Kolom>
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <KotakCari autoFocus nilai={q} ubah={setQ} placeholder="Cari nama, SOBAT ID, atau wilayah…" className="flex-1" />
        <Kotak aktif={sembunyi} ubah={setSembunyi} label={`Sembunyikan yang sudah jadi ${peran}`} />
      </div>
      <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
        <button className="font-semibold text-brand-700 hover:underline" onClick={() => setDipilih(new Set([...dipilih, ...daftar.map((m) => m.id)]))}>Pilih semua yang tampil ({daftar.length})</button>
        {dipilih.size > 0 && <button className="font-semibold hover:underline" onClick={() => setDipilih(new Set())}>Kosongkan pilihan</button>}
      </div>
      {!data ? <Memuat /> : daftar.length === 0 ? <p className="py-10 text-center text-sm text-stone-400">Tidak ada mitra aktif yang cocok. Tambahkan mitra di menu Mitra.</p> : (
        <ul className="scroll-tipis max-h-[42vh] space-y-1 overflow-y-auto pr-1">
          {daftar.slice(0, 300).map((m) => {
            const aktif = dipilih.has(m.id);
            const nanti = m.total_bulan + (aktif ? honorBaru : 0);
            const lewat = !!batas && nanti > batas;
            return (
              <motion.li key={m.id} layout="position">
                <button onClick={() => balik(m.id)} className={cx('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition', aktif ? 'border-brand-300 bg-brand-50/60' : 'border-transparent hover:bg-stone-50')}>
                  <Kotak aktif={aktif} ubah={() => balik(m.id)} />
                  <Avatar nama={m.nama} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-stone-800">{m.nama}</span>
                      {m.peran_di_sini && <Lencana warna="brand">sudah {m.peran_di_sini}</Lencana>}
                      {m.bentrok > 0 && <Lencana warna="kuning">{m.bentrok} kegiatan bersamaan</Lencana>}
                    </div>
                    <div className="truncate text-xs text-stone-400">{[m.kecamatan, m.desa].filter(Boolean).join(' · ') || m.sobat_id || '—'}</div>
                  </div>
                  <div className="w-36 shrink-0 text-right">
                    <div className={cx('angka text-xs font-semibold', lewat ? 'text-rose-600' : 'text-stone-500')}>{rupiah(nanti)}{batas ? <span className="font-normal text-stone-300"> / {rupiah(batas)}</span> : ''}</div>
                    <Batang nilai={nanti} maks={batas} className="ml-auto mt-1 w-28" />
                  </div>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Jendela>
  );
}

function ImporPetugas({ buka, tutup, kegiatan: k }: { buka: boolean; tutup: () => void; kegiatan: Kegiatan }) {
  const [file, setFile] = useState<File | null>(null);
  const [hasil, setHasil] = useState<{ masuk: number; tidakKetemu: string[] } | null>(null);
  const kirim = useAksi((f: File) => kirimFile<{ masuk: number; tidakKetemu: string[] }>(`/kegiatan/${k.id}/petugas-impor`, f), { setelah: (r) => setHasil(r) });
  useEffect(() => { if (!buka) { setFile(null); setHasil(null); } }, [buka]);
  return (
    <Jendela buka={buka} tutup={tutup} judul="Impor petugas dari Excel" sub={k.nama}
      kaki={hasil ? <Tombol onClick={tutup}>Selesai</Tombol> : <><Tombol varian="kedua" onClick={tutup}>Batal</Tombol><Tombol disabled={!file} memuat={kirim.isPending} onClick={() => file && kirim.mutate(file)} ikon={<Upload className="size-4" />}>Impor</Tombol></>}>
      {hasil ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <p className="text-center text-lg"><b className="text-3xl text-brand-700">{hasil.masuk}</b><br />petugas berhasil ditambahkan / diperbarui</p>
          {hasil.tidakKetemu.length > 0 && (
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              <b>{hasil.tidakKetemu.length} nama tidak ditemukan</b> di daftar mitra (tambahkan dulu di menu Mitra):
              <p className="mt-1 text-amber-800">{hasil.tidakKetemu.join(', ')}</p>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="space-y-4 text-sm text-stone-600">
          <p>File Excel cukup berisi kolom <b>Nama</b> (atau <b>SOBAT ID</b>), <b>Peran</b>, dan <b>Volume</b>. Nama harus sama dengan nama di daftar mitra. Tarif diambil dari tarif kegiatan.</p>
          <AreaUnggah terima=".xlsx" file={file} pilih={setFile} teks="Pilih file Excel (.xlsx)" />
        </div>
      )}
    </Jendela>
  );
}
