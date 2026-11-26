import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, ClipboardList, Copy, Eraser, Repeat, Download, FileSignature, Pencil, Trash2, Upload, UserPlus, Users, Wallet, Package, CalendarRange,
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
import { JendelaHapusBanyak } from '../components/HapusBanyak';
import { DaftarAlokasiBulan, PopupRincianMitra, periodeKegiatan, useAlokasiBulan, type BarisAlokasi } from '../components/CekKegiatan';
import { BULAN_PENDEK, LABEL_STATUS, angka, cocok, labelBulan, rentang, rupiah, statusKegiatan } from '../lib/format';
import { lebihBuruk, persen, statusSbml, type PetaSbml, type StatusSbml } from '../lib/sbml';

type Seri = { id: number; tanggal_mulai: string; tanggal_selesai: string; bulan_kegiatan: string; bulan_honor: string; jumlah_petugas: number };
type Detail = { kegiatan: Kegiatan; seri: Seri[] | null; petugas: Petugas[]; sbml: PetaSbml; ambang: number };

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
  // centang beberapa petugas untuk dihapus sekaligus
  const [terpilih, setTerpilih] = useState<Set<number>>(new Set());
  const [konfirmHapus, setKonfirmHapus] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  useEffect(() => setTerpilih(new Set()), [id]);

  if (isLoading) return <Memuat />;
  if (error || !data) return <Kosong ikon={<AlertTriangle className="size-7" />} judul="Kegiatan tidak ditemukan" aksi={<Link to="/kegiatan"><Tombol>Kembali</Tombol></Link>} />;
  const { kegiatan: k, petugas, sbml, ambang } = data;
  const st = statusKegiatan(k);
  const daftarPeran = [...new Set(petugas.map((p) => p.peran))];
  const tampil = petugas.filter((p) => (peran === 'semua' || p.peran === peran) && (!q || cocok(`${p.nama} ${p.sobat_id ?? ''} ${p.kecamatan ?? ''} ${p.desa ?? ''}`, q)));
  const adaSbml = Object.keys(sbml).length > 0;
  const lebih = new Set(petugas.filter((p) => statusSbml(p.honor_peran[p.peran] ?? 0, sbml[p.peran], ambang) === 'lewat').map((p) => p.mitra_id)).size;
  const dekat = new Set(petugas.filter((p) => statusSbml(p.honor_peran[p.peran] ?? 0, sbml[p.peran], ambang) === 'dekat').map((p) => p.mitra_id)).size;

  const hapusKegiatan = async () => {
    if (!(await konfirmasi({ judul: `Hapus ${k.nama}?`, pesan: 'Kegiatan dapat dipulihkan dari halaman Kegiatan → kegiatan terhapus.', tombol: 'Hapus', bahaya: true }))) return;
    await api.del(`/kegiatan/${k.id}`);
    segarkan();
    nav('/kegiatan');
    beritahu('sukses', 'Kegiatan dihapus.', { urungkan: async () => { await api.post(`/kegiatan/${k.id}/pulihkan`); segarkan(); nav(`/kegiatan/${k.id}`); } });
  };
  const hapusTerpilih = async () => {
    setMenghapus(true);
    try {
      const r = await api.post<{ jumlah: number; rows: unknown[] }>('/petugas/hapus-banyak', { ids: [...terpilih] });
      segarkan();
      setKonfirmHapus(false);
      setTerpilih(new Set());
      beritahu('sukses', <><b>{r.jumlah}</b> petugas dikeluarkan dari kegiatan.</>, { urungkan: async () => { await api.post('/penugasan/pulihkan', { rows: r.rows }); segarkan(); } });
    } catch (e) { beritahu('galat', (e as Error).message); } finally { setMenghapus(false); }
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

      {data.seri && data.seri.length > 1 && <NavigasiSeri seri={data.seri} ini={k.id} punyaPetugas={petugas.length > 0} />}

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { ikon: CalendarRange, label: 'Jadwal', isi: rentang(k.tanggal_mulai, k.tanggal_selesai), sub: <>Bulan kegiatan <Link to={`/rekap?bulan=${k.bulan_kegiatan}`} className="font-semibold hover:text-brand-700 hover:underline">{labelBulan(k.bulan_kegiatan)}</Link> · dibayar <Link to={`/rekap?bulan=${k.bulan_honor}&dasar=bayar`} className="font-semibold hover:text-brand-700 hover:underline">{labelBulan(k.bulan_honor)}</Link></> },
          { ikon: Users, label: 'Petugas', isi: <><AngkaHidup nilai={k.jumlah_petugas} />{k.target_petugas ? <span className="text-stone-400"> / {k.target_petugas}</span> : ''}</>, sub: k.target_petugas ? (k.jumlah_petugas >= k.target_petugas ? 'Target terpenuhi ✓' : `Kurang ${k.target_petugas - k.jumlah_petugas} orang`) : 'mitra' },
          { ikon: Package, label: 'Beban kerja', isi: <><AngkaHidup nilai={k.total_volume} /> <span className="text-base font-semibold text-stone-500">{k.satuan}</span></>, sub: Object.entries(k.tarif).map(([p, t]) => `${p} ${rupiah(t)}`).join(' · ') || 'tarif belum diatur' },
          { ikon: Wallet, label: 'Total honor', isi: <AngkaHidup nilai={k.total_honor} format={rupiah} />, sub: !adaSbml ? <Link to="/pengaturan?tab=batas" className="hover:underline">SBML {k.bulan_kegiatan.slice(0, 4)} belum diatur</Link>
            : lebih ? <span className="font-semibold text-rose-600">{lebih} mitra melebihi SBML {labelBulan(k.bulan_kegiatan)}</span>
            : dekat ? <span className="font-semibold text-amber-600">{dekat} mitra mendekati SBML</span> : 'semua petugas dalam batas SBML' },
        ].map((c, i) => (
          <Kartu key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="p-3.5 sm:p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500 sm:text-[13px]"><c.ikon className="size-4 text-brand-600" />{c.label}</div>
            <div className="truncate text-base font-extrabold tracking-tight text-stone-900 sm:text-xl">{c.isi}</div>
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
            {petugas.length > 0 && <Link to={`/dokumen?bulan=${k.bulan_kegiatan}&kegiatan=${k.id}`}><Tombol kecil varian="kedua" ikon={<FileSignature className="size-3.5" />}>SPK/BAST</Tombol></Link>}
            <Tombol kecil ikon={<UserPlus className="size-3.5" />} onClick={() => setPilih(true)}>Tambah petugas</Tombol>
          </div>
        </div>
        <AnimatePresence>
          {terpilih.size > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-rose-100 bg-rose-50/70 px-4 py-2.5 text-sm">
                <span className="font-semibold text-rose-800"><motion.b key={terpilih.size} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="inline-block">{terpilih.size}</motion.b> petugas dipilih</span>
                {terpilih.size < tampil.length && <Tombol kecil varian="hantu" onClick={() => setTerpilih(new Set(tampil.map((x) => x.id)))}>Pilih semua ({tampil.length})</Tombol>}
                <span className="ml-auto flex gap-2">
                  <Tombol kecil varian="kedua" onClick={() => setTerpilih(new Set())}>Batal</Tombol>
                  <Tombol kecil varian="bahaya" ikon={<Trash2 className="size-3.5" />} onClick={() => setKonfirmHapus(true)}>Hapus {terpilih.size} petugas</Tombol>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {petugas.length === 0 ? (
          <Kosong ikon={<UserPlus className="size-7" />} judul="Belum ada petugas" pesan="Pilih mitra yang akan bertugas di kegiatan ini. Honor dihitung otomatis dari volume × tarif."
            aksi={<Tombol ikon={<UserPlus className="size-4" />} onClick={() => setPilih(true)}>Pilih mitra</Tombol>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-stone-50/70 text-left text-xs font-bold uppercase tracking-wide text-stone-400">
                  <th className="w-10 py-3 pl-4">
                    <Kotak aktif={tampil.length > 0 && tampil.every((x) => terpilih.has(x.id))}
                      ubah={(v) => setTerpilih(v ? new Set([...terpilih, ...tampil.map((x) => x.id)]) : new Set([...terpilih].filter((i) => !tampil.some((x) => x.id === i))))} />
                  </th>
                  <th className="px-3 py-3">Mitra</th><th className="px-2 py-3">Peran</th><th className="px-2 py-3">Volume ({k.satuan})</th><th className="px-2 py-3">Tarif</th>
                  <th className="px-2 py-3 text-right">Honor</th><th className="px-4 py-3" title="Honor mitra untuk peran ini dari semua kegiatan di bulan yang sama, dibanding SBML peran tsb">Honor peran · {labelBulan(k.bulan_kegiatan)} vs SBML</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <AnimatePresence initial={false}>
                  {tampil.map((p) => <BarisPetugas key={p.id} p={p} sbml={sbml} ambang={ambang} bulan={k.bulan_kegiatan} hapus={() => hapusPetugas(p)}
                    dipilih={terpilih.has(p.id)} pilih={() => setTerpilih((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} />)}
                </AnimatePresence>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-100 font-bold text-stone-700">
                  <td className="py-3 pl-4" /><td className="px-3 py-3" colSpan={2}>{tampil.length} petugas</td>
                  <td className="angka px-2 py-3">{angka(tampil.reduce((s, p) => s + p.volume, 0))}</td><td />
                  <td className="angka px-2 py-3 text-right">{rupiah(tampil.reduce((s, p) => s + p.honor, 0))}</td><td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="border-t border-stone-100 bg-stone-50/50 px-4 py-2.5 text-xs text-stone-400">Klik angka volume atau tarif untuk mengubahnya langsung — tersimpan otomatis.</p>
      </Kartu>

      <JendelaHapusBanyak buka={konfirmHapus} tutup={() => setKonfirmHapus(false)} jenis="petugas" memuat={menghapus} setuju={hapusTerpilih}
        nama={petugas.filter((x) => terpilih.has(x.id)).map((x) => `${x.nama} · ${x.peran} · ${rupiah(x.honor)}`)}
        keterangan={<>Petugas dikeluarkan dari <b>{k.nama}</b>{k.seri_id ? <> (hanya bulan {labelBulan(k.bulan_kegiatan)})</> : ''}. Bisa dikembalikan dengan tombol <b>Urungkan</b> setelah dihapus.</>} />
      <FormKegiatan data={ubah ? k : null} tutup={() => setUbah(false)} />
      <SalinKegiatan asal={salin ? k : null} tutup={() => setSalin(false)} />
      <PilihPetugas buka={pilih} tutup={() => setPilih(false)} kegiatan={k} />
      <ImporPetugas buka={impor} tutup={() => setImpor(false)} kegiatan={k} />
    </div>
  );
}

/* ---------------------------- Navigasi bulan untuk kegiatan bulanan ---------------------------- */
function NavigasiSeri({ seri, ini, punyaPetugas }: { seri: Seri[]; ini: number; punyaPetugas: boolean }) {
  const nav = useNavigate();
  const [salin, setSalin] = useState(false);
  const [denganVolume, setDenganVolume] = useState(true);
  const posisi = seri.findIndex((s) => s.id === ini);
  const sisa = seri.length - posisi - 1;
  const [reset, setReset] = useState(false);
  const kirim = useAksi(() => api.post<{ jumlah: number; bulan: number }>(`/kegiatan/${ini}/salin-petugas-seri`, { salin_volume: denganVolume }), {
    sukses: (r) => (r.jumlah ? `${r.jumlah} penugasan disalin ke ${r.bulan} bulan berikutnya.` : 'Semua petugas sudah ada di bulan-bulan berikutnya.'), setelah: () => setSalin(false),
  });
  return (
    <Kartu className="mb-5 p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-stone-800"><Repeat className="size-4 text-sky-600" /> Kegiatan bulanan · {seri.length} bulan</div>
        <div className="flex flex-wrap gap-2">
          <Tombol kecil varian="hantu" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" ikon={<Eraser className="size-3.5" />} onClick={() => setReset(true)}>Hapus petugas di bulan-bulan…</Tombol>
          {punyaPetugas && sisa > 0 && (
            <Tombol kecil varian="lembut" ikon={<Copy className="size-3.5" />} onClick={() => setSalin(true)}>Salin petugas ke {sisa} bulan berikutnya</Tombol>
          )}
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {seri.map((s) => {
          const aktif = s.id === ini;
          return (
            <button key={s.id} type="button" onClick={() => nav(`/kegiatan/${s.id}`)} title={`${labelBulan(s.bulan_kegiatan)} · ${s.jumlah_petugas} petugas · dibayar ${labelBulan(s.bulan_honor)}`}
              className={cx('relative rounded-xl px-1 py-2 text-center transition-colors', aktif ? 'text-white' : s.jumlah_petugas ? 'bg-brand-50 text-brand-800 hover:bg-brand-100' : 'bg-stone-100 text-stone-400 hover:bg-stone-200/70')}>
              {aktif && <motion.span layoutId="seri-aktif" transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-xl bg-brand-600 shadow-sm" />}
              <span className="relative block text-xs font-bold">{BULAN_PENDEK[Number(s.bulan_kegiatan.slice(5)) - 1]}</span>
              <span className={cx('relative block text-[10px]', aktif ? 'text-brand-100' : '')}>{s.jumlah_petugas} ptgs</span>
            </button>
          );
        })}
      </div>
      <ResetPetugasSeri buka={reset} tutup={() => setReset(false)} ini={ini} sisa={sisa} total={seri.length} punyaPetugas={punyaPetugas} bulanIni={seri[posisi]?.bulan_kegiatan} />
      <Jendela buka={salin} tutup={() => setSalin(false)} judul="Salin petugas ke bulan berikutnya"
        sub={`Petugas bulan ini disalin ke ${sisa} bulan berikutnya. Petugas yang sudah ada di bulan tujuan tidak diubah.`}
        kaki={<><Tombol varian="kedua" onClick={() => setSalin(false)}>Batal</Tombol><Tombol memuat={kirim.isPending} ikon={<Copy className="size-4" />} onClick={() => kirim.mutate(undefined)}>Salin</Tombol></>}>
        <Kotak aktif={denganVolume} ubah={setDenganVolume} label="Salin juga volume beban kerja (jika tidak, volume diisi 0 dan diisi per bulan)" />
      </Jendela>
    </Kartu>
  );
}

/** Popup: hapus petugas di beberapa bulan sekaligus (kegiatan bulanan) */
function ResetPetugasSeri({ buka, tutup, ini, sisa, total, punyaPetugas, bulanIni }: {
  buka: boolean; tutup: () => void; ini: number; sisa: number; total: number; punyaPetugas: boolean; bulanIni?: string;
}) {
  const { beritahu } = useUmpan();
  const [cakupan, setCakupan] = useState<'berikutnya' | 'semua'>(sisa > 0 ? 'berikutnya' : 'semua');
  const [hanyaSama, setHanyaSama] = useState(punyaPetugas);
  const [paham, setPaham] = useState(false);
  const [proses, setProses] = useState(false);
  useEffect(() => { if (buka) { setCakupan(sisa > 0 ? 'berikutnya' : 'semua'); setHanyaSama(punyaPetugas); setPaham(false); } }, [buka]); // eslint-disable-line
  const opsi = { cakupan, hanya_sama: hanyaSama && punyaPetugas };
  const { data: pratinjau, isFetching } = useQuery({
    queryKey: ['pratinjau-hapus-seri', ini, opsi.cakupan, opsi.hanya_sama],
    queryFn: () => api.post<{ jumlah: number; bulan: number }>(`/kegiatan/${ini}/hapus-petugas-seri`, { ...opsi, pratinjau: true }),
    enabled: buka,
  });
  const hapus = async () => {
    setProses(true);
    try {
      const r = await api.post<{ jumlah: number; bulan: number; rows: unknown[] }>(`/kegiatan/${ini}/hapus-petugas-seri`, opsi);
      segarkan();
      tutup();
      beritahu('sukses', <><b>{r.jumlah}</b> penugasan dihapus dari {r.bulan} bulan.</>, { urungkan: async () => { await api.post('/penugasan/pulihkan', { rows: r.rows }); segarkan(); } });
    } catch (e) { beritahu('galat', (e as Error).message); } finally { setProses(false); }
  };
  const jumlah = pratinjau?.jumlah ?? 0;
  return (
    <Jendela buka={buka} tutup={tutup} judul="Hapus petugas di bulan-bulan" sub="Untuk membatalkan salinan yang keliru atau mengosongkan petugas kegiatan bulanan."
      kaki={<>
        <Tombol varian="kedua" onClick={tutup}>Batal</Tombol>
        <Tombol varian="bahaya" disabled={!paham || !jumlah || isFetching} memuat={proses} ikon={<Trash2 className="size-4" />} onClick={hapus}>Hapus {jumlah} penugasan</Tombol>
      </>}>
      <div className="space-y-4">
        <Kolom label="Bulan yang dihapus">
          <Segmen id="cakupan-hapus" nilai={cakupan} ubah={(v) => setCakupan(v)} opsi={[
            ...(sisa > 0 ? [{ nilai: 'berikutnya' as const, label: `Bulan berikutnya (${sisa})` }] : []),
            { nilai: 'semua' as const, label: `Semua bulan (${total}, termasuk ${bulanIni ? labelBulan(bulanIni) : 'bulan ini'})` },
          ]} />
        </Kolom>
        {punyaPetugas && (
          <div className="rounded-xl bg-stone-50 p-3">
            <Kotak aktif={hanyaSama} ubah={setHanyaSama} label={<span className="text-sm">Hanya mitra & peran yang <b>sama dengan bulan ini</b> (membatalkan hasil salin). Jika tidak dicentang, <b>semua</b> petugas di bulan-bulan tersebut dihapus.</span>} />
          </div>
        )}
        <motion.div key={`${jumlah}-${pratinjau?.bulan}`} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}
          className={cx('rounded-2xl p-4 text-sm', jumlah ? 'bg-rose-50 text-rose-900' : 'bg-stone-50 text-stone-500')}>
          {isFetching ? 'Menghitung…' : jumlah ? <>Akan dihapus: <b>{jumlah} penugasan</b> di <b>{pratinjau?.bulan} bulan</b>. Mitranya tetap ada di daftar Mitra.</> : 'Tidak ada penugasan yang cocok untuk dihapus.'}
        </motion.div>
        <div className="rounded-xl border border-stone-200 p-3">
          <Kotak aktif={paham} ubah={setPaham} label={<span className="text-sm">Saya mengerti penugasan di atas akan dihapus. Bisa dikembalikan dengan tombol Urungkan sesaat setelah dihapus.</span>} />
        </div>
      </div>
    </Jendela>
  );
}

/* ---------------------------- Satu baris petugas dengan isian langsung ---------------------------- */
function BarisPetugas({ p, sbml, ambang, bulan, hapus, dipilih, pilih }: { p: Petugas; sbml: PetaSbml; ambang: number; bulan: string; hapus: () => void; dipilih: boolean; pilih: () => void }) {
  const { data: atur } = usePengaturan();
  const { konfirmasi } = useUmpan();
  const [tersimpan, setTersimpan] = useState(false);
  const simpan = useAksi((v: Partial<Petugas>) => api.put(`/petugas/${p.id}`, v), { setelah: () => { setTersimpan(true); setTimeout(() => setTersimpan(false), 1400); } });
  const honorPeran = p.honor_peran[p.peran] ?? 0;
  const batas = sbml[p.peran];
  const status = statusSbml(honorPeran, batas, ambang);

  /** Sebelum menyimpan volume/tarif/peran: bila honor peran mitra di bulan ini jadi melebihi SBML, tampilkan peringatan. */
  const ubah = async (v: Partial<Petugas>) => {
    const peranBaru = v.peran ?? p.peran;
    const honorBaru = (v.volume ?? p.volume) * (v.tarif ?? p.tarif);
    const batasBaru = sbml[peranBaru];
    const sekarang = p.honor_peran[peranBaru] ?? 0;
    const nanti = sekarang - (peranBaru === p.peran ? p.honor : 0) + honorBaru;
    if (batasBaru && nanti > batasBaru && nanti > (peranBaru === p.peran ? sekarang : 0)) {
      const ok = await konfirmasi({
        judul: `${p.nama} melebihi SBML ${peranBaru}`,
        pesan: (
          <div className="space-y-2">
            <p>Dengan perubahan ini, honor <b>{peranBaru}</b> mitra ini di <b>{labelBulan(bulan)}</b> menjadi:</p>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-800">
              <div className="flex justify-between"><span>Honor {peranBaru}</span><b className="angka">{rupiah(nanti)}</b></div>
              <div className="flex justify-between"><span>SBML {peranBaru}</span><span className="angka">{rupiah(batasBaru)}</span></div>
              <div className="flex justify-between border-t border-rose-200 pt-1 font-semibold"><span>Kelebihan</span><span className="angka">{rupiah(nanti - batasBaru)} ({persen(nanti, batasBaru)}%)</span></div>
            </div>
            <p>Tetap simpan perubahan?</p>
          </div>
        ),
        tombol: 'Tetap simpan',
        bahaya: true,
      });
      if (!ok) return;
    }
    simpan.mutate(v);
  };

  return (
    <motion.tr layout initial={{ opacity: 0, backgroundColor: '#ecfdf5' }} animate={{ opacity: 1, backgroundColor: 'rgba(255,255,255,0)' }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4 }} className={cx('group', dipilih && 'bg-rose-50/50')}>
      <td className="py-2.5 pl-4"><Kotak aktif={dipilih} ubah={pilih} /></td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <Avatar nama={p.nama} />
          <div className="min-w-0">
            <Link to={`/mitra?lihat=${p.mitra_id}`} className="block truncate font-semibold text-stone-800 hover:text-brand-700">{p.nama}</Link>
            <div className="truncate text-xs text-stone-400">{[p.kecamatan, p.desa].filter(Boolean).join(' · ') || p.sobat_id || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5">
        <Pilihan kecil nilai={p.peran} ubah={(v) => v !== p.peran && ubah({ peran: v })} opsi={[...new Set([...(atur?.daftar_peran ?? []), p.peran])]} className="w-fit" />
      </td>
      <td className="px-2 py-2.5"><SelLangsung nilai={p.volume} simpan={(v) => ubah({ volume: v })} /></td>
      <td className="px-2 py-2.5"><SelLangsung nilai={p.tarif} uang simpan={(v) => ubah({ tarif: v })} /></td>
      <td className="px-2 py-2.5 text-right">
        <span className="inline-flex items-center gap-1.5">
          <AnimatePresence>{tersimpan && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-3" strokeWidth={3} /></motion.span>}</AnimatePresence>
          <span className={cx('angka font-bold', p.honor ? 'text-stone-800' : 'text-amber-600')}><AngkaHidup nilai={p.honor} format={rupiah} /></span>
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={cx('angka text-xs font-semibold', status === 'lewat' ? 'text-rose-600' : status === 'dekat' ? 'text-amber-600' : 'text-stone-500')}>{rupiah(honorPeran)}</span>
          {batas ? <span className="angka text-xs text-stone-300">/ {rupiah(batas)}</span> : <span className="text-xs text-stone-300">· SBML {p.peran} belum diatur</span>}
          {status === 'lewat' && <span title="Melebihi SBML"><AlertTriangle className="size-3.5 text-rose-500" /></span>}
        </div>
        <Batang nilai={honorPeran} maks={batas} ambang={ambang} className="mt-1 w-40" />
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
  const { konfirmasi } = useUmpan();
  const { data } = useQuery({ queryKey: ['kandidat', k.id], queryFn: () => api.get<{ mitra: Kandidat[]; sbml: PetaSbml; ambang: number }>(`/kegiatan/${k.id}/kandidat`), enabled: buka });
  const peranAda = Object.keys(k.tarif);
  const [peran, setPeran] = useState('');
  const [volume, setVolume] = useState(0);
  const [tarif, setTarif] = useState(0);
  const [dipilih, setDipilih] = useState<Set<number>>(new Set());
  // status SBML yang sudah disetujui pengguna saat memilih (agar tidak ditanya dua kali)
  const [disetujui, setDisetujui] = useState<Map<number, StatusSbml>>(new Map());
  const [q, setQ] = useState('');
  const [sembunyi, setSembunyi] = useState(true);
  const [modeCek, setModeCek] = useState(false);
  const [rinci, setRinci] = useState<number | null>(null);
  const jangkarRinci = useRef<HTMLElement | null>(null);
  // semua penugasan mitra di BULAN KEGIATAN ini (bukan bulan hari ini)
  // semua mitra yang bertugas pada BULAN PELAKSANAAN kegiatan ini (menurut tanggal mulai–selesai)
  const periode = periodeKegiatan(k);
  const { data: alokasi } = useAlokasiBulan(k.bulan_kegiatan, buka, periode);
  const alokasiMitra = useMemo(() => {
    const peta = new Map<number, BarisAlokasi[]>();
    for (const r of alokasi?.rows ?? []) peta.set(r.mitra_id, [...(peta.get(r.mitra_id) ?? []), r]);
    return peta;
  }, [alokasi]);
  useEffect(() => {
    if (buka) {
      const p = peranAda[0] ?? atur?.daftar_peran[0] ?? 'PPL';
      setPeran(p); setTarif(k.tarif[p] ?? 0); setVolume(0); setDipilih(new Set()); setDisetujui(new Map()); setQ(''); setModeCek(false); setRinci(null);
    }
  }, [buka]); // eslint-disable-line
  const gantiPeran = (p: string) => { setPeran(p); setTarif(k.tarif[p] ?? 0); setDisetujui(new Map()); };

  const ambang = data?.ambang ?? 80;
  const batas = data?.sbml[peran];
  const honorBaru = volume * tarif;
  const sekarang = (m: Kandidat) => m.honor_peran[peran] ?? 0;
  const nanti = (m: Kandidat) => sekarang(m) + honorBaru;
  const status = (m: Kandidat) => statusSbml(nanti(m), batas, ambang);

  const daftar = useMemo(() => (data?.mitra ?? []).filter((m) =>
    (!sembunyi || !(m.peran_di_sini ?? '').split(',').includes(peran)) &&
    (!q || cocok(`${m.nama} ${m.sobat_id ?? ''} ${m.kecamatan ?? ''} ${m.desa ?? ''}`, q))), [data, q, sembunyi, peran]);

  /** Popup peringatan dini: honor mitra mendekati / melebihi SBML peran ini di bulan kegiatan */
  const peringatan = async (calon: Kandidat[]) => {
    const lewat = calon.some((m) => status(m) === 'lewat');
    return konfirmasi({
      judul: lewat ? `Honor ${peran} melebihi SBML` : `Honor ${peran} mendekati SBML`,
      pesan: (
        <div className="space-y-2">
          <p>Honor <b>{peran}</b> di bulan kegiatan <b>{labelBulan(k.bulan_kegiatan)}</b>{honorBaru ? ' (termasuk kegiatan ini)' : ''} — SBML {rupiah(batas)}:</p>
          <ul className="space-y-1.5">
            {calon.slice(0, 6).map((m) => (
              <li key={m.id} className={cx('rounded-xl px-3 py-2', status(m) === 'lewat' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800')}>
                <div className="flex justify-between gap-2"><b className="truncate">{m.nama}</b><span className="angka shrink-0 font-semibold">{persen(nanti(m), batas!)}%</span></div>
                <div className="angka text-xs">{rupiah(nanti(m))} / {rupiah(batas)}</div>
              </li>
            ))}
          </ul>
          {calon.length > 6 && <p className="text-xs">…dan {calon.length - 6} mitra lainnya.</p>}
          <p>Tetap pilih {calon.length > 1 ? 'mitra-mitra ini' : 'mitra ini'}?</p>
        </div>
      ),
      tombol: 'Tetap pilih',
      bahaya: lewat,
    });
  };

  const catatSetuju = (calon: Kandidat[]) => setDisetujui((d) => { const n = new Map(d); calon.forEach((m) => n.set(m.id, status(m))); return n; });

  const balik = async (m: Kandidat) => {
    if (dipilih.has(m.id)) { setDipilih((s) => { const n = new Set(s); n.delete(m.id); return n; }); return; }
    const st = status(m);
    if ((st === 'dekat' || st === 'lewat') && lebihBuruk(st, disetujui.get(m.id))) {
      if (!(await peringatan([m]))) return;
      catatSetuju([m]);
    }
    setDipilih((s) => new Set(s).add(m.id));
  };
  const pilihSemua = async () => {
    const baru = daftar.filter((m) => !dipilih.has(m.id));
    const berisiko = baru.filter((m) => { const st = status(m); return (st === 'dekat' || st === 'lewat') && lebihBuruk(st, disetujui.get(m.id)); });
    let ambil = baru;
    if (berisiko.length) {
      if (await peringatan(berisiko)) catatSetuju(berisiko);
      else ambil = baru.filter((m) => !berisiko.includes(m));
    }
    setDipilih(new Set([...dipilih, ...ambil.map((m) => m.id)]));
  };

  const tambah = useAksi(() => api.post(`/kegiatan/${k.id}/petugas`, { items: [...dipilih].map((id) => ({ mitra_id: id, peran, volume, tarif })) }), {
    sukses: () => `${dipilih.size} petugas ditambahkan sebagai ${peran}.`, setelah: tutup,
  });
  const kirim = async () => {
    // cek ulang: volume/tarif bisa diubah setelah mitra dipilih
    const terpilih = (data?.mitra ?? []).filter((m) => dipilih.has(m.id));
    const berisiko = terpilih.filter((m) => { const st = status(m); return (st === 'dekat' || st === 'lewat') && lebihBuruk(st, disetujui.get(m.id)); });
    if (berisiko.length && !(await peringatan(berisiko))) return;
    tambah.mutate(undefined);
  };
  const jumlahBerisiko = (data?.mitra ?? []).filter((m) => dipilih.has(m.id) && status(m) !== 'aman' && status(m) !== 'tanpa').length;

  return (
    <Jendela buka={buka} tutup={tutup} lebar="max-w-3xl" judul="Tambah petugas" sub={`${k.nama} · bulan kegiatan ${labelBulan(k.bulan_kegiatan)} · dibayar ${labelBulan(k.bulan_honor)}`}
      kaki={<>
        <span className="mr-auto text-sm text-stone-500">{dipilih.size ? <><b className="text-stone-800">{dipilih.size}</b> mitra dipilih{jumlahBerisiko > 0 && <span className="ml-2 font-semibold text-amber-600">· {jumlahBerisiko} mendekati/melebihi SBML</span>}</> : 'Belum ada yang dipilih'}</span>
        <Tombol varian="kedua" onClick={tutup}>Batal</Tombol>
        <Tombol disabled={!dipilih.size} memuat={tambah.isPending} ikon={<UserPlus className="size-4" />} onClick={kirim}>Tambahkan</Tombol>
      </>}>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl bg-stone-50 p-3 sm:grid-cols-3 sm:p-4">
        <Kolom className="col-span-2 sm:col-span-1" label="Sebagai" petunjuk={batas ? `SBML ${peran}: ${rupiah(batas)}/bulan` : `SBML ${peran} belum diatur`}><Pilihan nilai={peran} ubah={gantiPeran} opsi={[...new Set([...peranAda, ...(atur?.daftar_peran ?? [])])]} /></Kolom>
        <Kolom label={`Volume (${k.satuan})`} petunjuk="Boleh diisi nanti"><Masukan type="number" min={0} value={volume || ''} onChange={(e) => setVolume(Number(e.target.value))} placeholder="0" /></Kolom>
        <Kolom label="Tarif" petunjuk={honorBaru ? `Honor per orang ${rupiah(honorBaru)}` : 'dari tarif kegiatan'}><MasukanRupiah nilai={tarif} ubah={setTarif} /></Kolom>
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <KotakCari autoFocus nilai={q} ubah={setQ} placeholder={modeCek ? 'Cari mitra atau nama kegiatan…' : 'Cari nama, SOBAT ID, atau wilayah…'} className="flex-1" />
        <Tombol varian={modeCek ? 'utama' : 'lembut'} ikon={<ClipboardList className="size-4" />} onClick={() => setModeCek(!modeCek)} className="shrink-0">
          {modeCek ? 'Kembali memilih' : <>Cek kegiatan mitra<span className="hidden sm:inline"> · {periode.label}</span></>}
        </Tombol>
      </div>
      {modeCek ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DaftarAlokasiBulan bulan={k.bulan_kegiatan} q={q} kegiatanIni={k.id} periode={periode} />
        </motion.div>
      ) : <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <Kotak aktif={sembunyi} ubah={setSembunyi} label={<span className="text-xs">Sembunyikan yang sudah jadi {peran}</span>} />
        <button className="font-semibold text-brand-700 hover:underline" onClick={pilihSemua}>Pilih semua yang tampil ({daftar.length})</button>
        {dipilih.size > 0 && <button className="font-semibold hover:underline" onClick={() => setDipilih(new Set())}>Kosongkan pilihan</button>}
      </div>
      {!data ? <Memuat /> : daftar.length === 0 ? <p className="py-10 text-center text-sm text-stone-400">Tidak ada mitra aktif yang cocok. Tambahkan mitra di menu Mitra.</p> : (
        <ul className="scroll-tipis max-h-[55vh] space-y-1 overflow-y-auto pr-1 sm:max-h-[42vh]">
          {daftar.slice(0, 300).map((m) => {
            const aktif = dipilih.has(m.id);
            const tampilHonor = sekarang(m) + (aktif ? honorBaru : 0);
            const st = statusSbml(tampilHonor, batas, ambang);
            return (
              <motion.li key={m.id} layout="position" className={cx('rounded-xl border transition', aktif ? 'border-brand-300 bg-brand-50/60' : 'border-transparent hover:bg-stone-50')}>
                <div className="flex items-center gap-2 pr-2">
                <button onClick={() => balik(m)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left sm:gap-3 sm:px-3">
                  <Kotak aktif={aktif} ubah={() => balik(m)} />
                  <Avatar nama={m.nama} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-stone-800">{m.nama}</span>
                      {m.peran_di_sini && <Lencana warna="brand">sudah {m.peran_di_sini}</Lencana>}
                      {m.bentrok > 0 && <Lencana warna="kuning">{m.bentrok} kegiatan bersamaan</Lencana>}
                      {st === 'dekat' && <Lencana warna="kuning">mendekati SBML</Lencana>}
                      {st === 'lewat' && <Lencana warna="merah">melebihi SBML</Lencana>}
                    </div>
                    <div className="truncate text-xs text-stone-400">{[m.kecamatan, m.desa].filter(Boolean).join(' · ') || m.sobat_id || '—'}</div>
                    <div className={cx('angka text-xs font-semibold sm:hidden', st === 'lewat' ? 'text-rose-600' : st === 'dekat' ? 'text-amber-600' : 'text-stone-500')}>
                      {rupiah(tampilHonor)}{batas ? ` / ${rupiah(batas)}` : ''}
                    </div>
                  </div>
                  <div className="hidden w-40 shrink-0 text-right sm:block">
                    <div className={cx('angka text-xs font-semibold', st === 'lewat' ? 'text-rose-600' : st === 'dekat' ? 'text-amber-600' : 'text-stone-500')}>
                      {rupiah(tampilHonor)}{batas ? <span className="font-normal text-stone-300"> / {rupiah(batas)}</span> : ''}
                    </div>
                    <Batang nilai={tampilHonor} maks={batas} ambang={ambang} className="ml-auto mt-1 w-28" />
                  </div>
                </button>
                {(() => {
                  const n = alokasiMitra.get(m.id)?.length ?? 0;
                  return (
                    <button type="button" onClick={(e) => { jangkarRinci.current = e.currentTarget; setRinci(rinci === m.id ? null : m.id); }} title={`Cek kegiatan mitra di ${periode.label}`}
                      className={cx('flex shrink-0 items-center justify-end gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold transition sm:w-28',
                        n ? 'text-sky-700 hover:bg-sky-50' : 'text-stone-300 hover:bg-stone-100 hover:text-stone-500')}>
                      <ClipboardList className="size-3.5" />{n ? <>{n}<span className="hidden sm:inline"> kegiatan</span></> : <span className="hidden sm:inline">kosong</span>}
                      <ChevronDown className={cx('size-3.5 transition-transform', rinci === m.id && 'rotate-180')} />
                    </button>
                  );
                })()}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
      </>}
      {rinci !== null && (() => {
        const m = data?.mitra.find((x) => x.id === rinci);
        return <PopupRincianMitra buka={!!m} tutup={() => setRinci(null)} jangkar={jangkarRinci} rows={alokasiMitra.get(rinci) ?? []} data={alokasi} kegiatanIni={k.id} nama={m?.nama ?? ''} bulan={k.bulan_kegiatan} labelPeriode={periode.label} />;
      })()}
    </Jendela>
  );
}

function ImporPetugas({ buka, tutup, kegiatan: k }: { buka: boolean; tutup: () => void; kegiatan: Kegiatan }) {
  const [file, setFile] = useState<File | null>(null);
  const [hasil, setHasil] = useState<{ masuk: number; tidakKetemu: string[] } | null>(null);
  const kirim = useAksi((f: File) => kirimFile<{ masuk: number; tidakKetemu: string[] }>(`/kegiatan/${k.id}/petugas-impor`, f), { setelah: (r) => setHasil(r) });
  useEffect(() => { if (!buka) { setFile(null); setHasil(null); } }, [buka]);
  return (
    <Jendela buka={buka} tutup={tutup} judul="Impor petugas dari Excel / CSV" sub={k.nama}
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
          <p>File Excel atau CSV cukup berisi kolom <b>Nama</b> (atau <b>SOBAT ID</b>), <b>Peran</b>, dan <b>Volume</b>. Nama harus sama dengan nama di daftar mitra. Tarif diambil dari tarif kegiatan.</p>
          <AreaUnggah terima=".xlsx,.csv" file={file} pilih={setFile} teks="Pilih file Excel (.xlsx) atau CSV (.csv)" />
        </div>
      )}
    </Jendela>
  );
}
