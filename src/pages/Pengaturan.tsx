import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertOctagon, Building2, Copy, DatabaseBackup, Download, FileText, Hash, History, KeyRound, ListChecks, Pencil, Plus, RotateCcw, Scale, Trash2, Upload, UserCog, X,
} from 'lucide-react';
import { api, kirimFile, queryClient, segarkan, unduhFile } from '../lib/api';
import type { Pengaturan, Pengguna } from '../lib/types';
import { useAksi, usePengaturan, useSaya } from '../lib/hooks';
import { useUmpan } from '../components/umpan';
import { Pilihan } from '../components/pemilih';
import { AreaUnggah, Avatar, Jendela, KepalaHalaman, Kartu, Kolom, Kotak, Lencana, Masukan, MasukanRupiah, Memuat, Tombol, TombolIkon, cx, pegas } from '../components/ui';
import { rupiah, tanggal } from '../lib/format';

const TAB = [
  { id: 'kantor', label: 'Kantor, PPK & bayar', ikon: Building2, admin: true },
  { id: 'nomor', label: 'Format nomor', ikon: Hash, admin: true },
  { id: 'batas', label: 'Batas honor (SBML)', ikon: Scale, admin: false },
  { id: 'daftar', label: 'Peran & satuan', ikon: ListChecks, admin: true },
  { id: 'template', label: 'Template dokumen', ikon: FileText, admin: false },
  { id: 'pengguna', label: 'Pengguna', ikon: UserCog, admin: true },
  { id: 'cadangan', label: 'Cadangan data', ikon: DatabaseBackup, admin: true },
  { id: 'reset', label: 'Reset data', ikon: AlertOctagon, admin: true },
  { id: 'riwayat', label: 'Riwayat aktivitas', ikon: History, admin: false },
  { id: 'akun', label: 'Akun saya', ikon: KeyRound, admin: false },
] as const;

export function HalamanPengaturan() {
  const [param, setParam] = useSearchParams();
  const { data: saya } = useSaya();
  const admin = saya?.pengguna?.peran === 'admin';
  const tabs = TAB.filter((t) => admin || !t.admin);
  const tab = tabs.find((t) => t.id === param.get('tab'))?.id ?? tabs[0].id;

  return (
    <div>
      <KepalaHalaman judul="Pengaturan" sub={admin ? 'Semua yang biasanya berubah dari waktu ke waktu bisa diatur di sini — tanpa mengubah kode.' : 'Beberapa pengaturan hanya bisa diubah oleh admin.'} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-6">
        <nav className="scroll-tipis -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:self-start lg:px-0 lg:pb-0 lg:sticky lg:top-8">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setParam({ tab: t.id }, { replace: true })}
              className={cx('relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors', tab === t.id ? 'text-brand-800' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800')}>
              {tab === t.id && <motion.span layoutId="tab-atur" transition={pegas} className="absolute inset-0 rounded-xl bg-white shadow-lembut" />}
              <t.ikon className="relative size-4" /><span className="relative">{t.label}</span>
            </button>
          ))}
        </nav>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}>
            {tab === 'kantor' && <div className="space-y-5"><TabKantor /><PanelPembayaran /></div>}
            {tab === 'nomor' && <TabNomor />}
            {tab === 'batas' && <TabBatas admin={admin} />}
            {tab === 'daftar' && <TabDaftar />}
            {tab === 'template' && <TabTemplate admin={admin} />}
            {tab === 'pengguna' && <TabPengguna saya={saya?.pengguna?.id} />}
            {tab === 'cadangan' && <TabCadangan />}
            {tab === 'reset' && <TabReset />}
            {tab === 'riwayat' && <TabRiwayat />}
            {tab === 'akun' && <TabAkun />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Panel({ judul, ket, children, kaki }: { judul: string; ket?: ReactNode; children: ReactNode; kaki?: ReactNode }) {
  return (
    <Kartu className="overflow-hidden">
      <div className="border-b border-stone-100 px-4 py-4 sm:px-6 sm:py-5"><h2 className="font-bold text-stone-900">{judul}</h2>{ket && <p className="mt-0.5 text-sm text-stone-500">{ket}</p>}</div>
      <div className="p-4 sm:p-6">{children}</div>
      {kaki && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-4 py-3 sm:px-6 sm:py-4">{kaki}</div>}
    </Kartu>
  );
}

function useFormPengaturan() {
  const { data } = usePengaturan();
  const [f, setF] = useState<Partial<Pengaturan>>({});
  useEffect(() => { if (data) setF(data); }, [data]);
  const simpan = useAksi((v: Partial<Pengaturan>) => api.put('/pengaturan', v), { sukses: 'Pengaturan disimpan.' });
  return { data, f, setF, simpan };
}

function TabKantor() {
  const { data, f, setF, simpan } = useFormPengaturan();
  if (!data) return <Memuat />;
  const isi = (k: keyof Pengaturan) => ({ value: (f[k] as string) ?? '', onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });
  return (
    <Panel judul="Kantor & Pejabat Pembuat Komitmen" ket="Data ini otomatis dipakai di SPK & BAST. Ganti di sini bila PPK berganti — tidak perlu mengedit template."
      kaki={<Tombol memuat={simpan.isPending} onClick={() => simpan.mutate(f)}>Simpan perubahan</Tombol>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Kolom label="Nama kantor" petunjuk="${nama_kantor}"><Masukan {...isi('nama_kantor')} /></Kolom>
        <Kolom label="Wilayah" petunjuk="${wilayah}"><Masukan {...isi('wilayah')} /></Kolom>
        <Kolom label="Alamat kantor" className="sm:col-span-2" petunjuk="${alamat_kantor}"><Masukan {...isi('alamat_kantor')} /></Kolom>
        <Kolom label="Nama PPK (beserta gelar)" petunjuk="${ppk_nama}"><Masukan {...isi('ppk_nama')} /></Kolom>
        <Kolom label="NIP PPK" petunjuk="${ppk_nip}"><Masukan {...isi('ppk_nip')} /></Kolom>
        <Kolom label="Jabatan" petunjuk="${ppk_jabatan}"><Masukan {...isi('ppk_jabatan')} /></Kolom>
      </div>
    </Panel>
  );
}

function PanelPembayaran() {
  const { data, f, setF, simpan } = useFormPengaturan();
  if (!data) return null;
  return (
    <Panel judul="Bulan pembayaran honor" ket="Bulan pembayaran setiap kegiatan diisi otomatis dari bulan kegiatan (tanggal selesai) ditambah jeda ini. Tetap bisa diubah per kegiatan."
      kaki={<Tombol memuat={simpan.isPending} onClick={() => simpan.mutate({ jeda_pembayaran: f.jeda_pembayaran })}>Simpan</Tombol>}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-stone-600">Honor dibayar</span>
        <Pilihan nilai={String(f.jeda_pembayaran ?? 1)} ubah={(v) => setF({ ...f, jeda_pembayaran: Number(v) })} className="w-64"
          opsi={[{ nilai: '0', label: 'pada bulan yang sama' }, { nilai: '1', label: '1 bulan setelah kegiatan (n+1)' }, { nilai: '2', label: '2 bulan setelah kegiatan' }, { nilai: '3', label: '3 bulan setelah kegiatan' }]} />
        <span className="text-xs text-stone-400">Berlaku untuk kegiatan yang dibuat setelahnya.</span>
      </div>
    </Panel>
  );
}

function TabNomor() {
  const { data, f, setF, simpan } = useFormPengaturan();
  if (!data) return <Memuat />;
  const contoh = (fmt = '') => fmt.replaceAll('{urut}', '7').replaceAll('{urut3}', '007').replaceAll('{bulan}', '3').replaceAll('{bulan2}', '03').replaceAll('{romawi}', 'III').replaceAll('{tahun}', '2026');
  const Token = ({ t, k }: { t: string; k: 'format_nomor_spk' | 'format_nomor_bast' }) => (
    <button type="button" onClick={() => setF({ ...f, [k]: (f[k] ?? '') + t })} className="rounded-lg bg-stone-100 px-2 py-1 font-mono text-xs font-semibold text-stone-600 hover:bg-brand-100 hover:text-brand-800">{t}</button>
  );
  return (
    <Panel judul="Format nomor surat" ket="Nomor urut diberikan per mitra per bulan, dan tidak berubah walaupun dokumen dibuat ulang."
      kaki={<Tombol memuat={simpan.isPending} onClick={() => simpan.mutate(f)}>Simpan</Tombol>}>
      <div className="space-y-6">
        {(['format_nomor_spk', 'format_nomor_bast'] as const).map((k) => (
          <div key={k}>
            <Kolom label={k === 'format_nomor_spk' ? 'Nomor SPK' : 'Nomor BAST'}><Masukan className="font-mono" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Kolom>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {['{urut}', '{urut3}', '{bulan}', '{bulan2}', '{romawi}', '{tahun}'].map((t) => <Token key={t} t={t} k={k} />)}
              <span className="ml-auto text-sm text-stone-500">Contoh: <motion.b key={f[k]} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className="font-mono text-stone-800">{contoh(f[k])}</motion.b></span>
            </div>
          </div>
        ))}
        <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-500">{'{urut}'} = nomor urut · {'{urut3}'} = 007 · {'{bulan}'} = 3 · {'{bulan2}'} = 03 · {'{romawi}'} = III · {'{tahun}'} = 2026</p>
      </div>
    </Panel>
  );
}

function TabBatas({ admin }: { admin: boolean }) {
  const { data: daftar } = useQuery({ queryKey: ['sbml'], queryFn: () => api.get<{ tahun: number; peran: string; nominal: number }[]>('/sbml') });
  const { data: atur } = usePengaturan();
  const tahunIni = new Date().getFullYear();
  const [tahun, setTahun] = useState(tahunIni);
  const [nilai, setNilai] = useState<Record<string, number>>({});
  const [ambang, setAmbang] = useState(80);
  useEffect(() => {
    if (!daftar) return;
    setNilai(Object.fromEntries(daftar.filter((d) => d.tahun === tahun).map((d) => [d.peran, d.nominal])));
  }, [daftar, tahun]);
  useEffect(() => { if (atur) setAmbang(atur.ambang_sbml); }, [atur]);
  const simpan = useAksi(() => api.put('/sbml', { tahun, nilai }), { sukses: `SBML ${tahun} disimpan.` });
  const { konfirmasi, beritahu } = useUmpan();
  const tersimpanTahun = (t: number) => (daftar ?? []).filter((d) => d.tahun === t);
  /** Hapus SBML satu tahun — dengan popup persetujuan dan tombol Urungkan */
  const hapusTahun = async (t: number) => {
    const lama = tersimpanTahun(t);
    if (!lama.length) return;
    const ok = await konfirmasi({
      judul: `Hapus SBML ${t}?`,
      pesan: (
        <div className="space-y-2">
          <p>SBML berikut akan dihapus. Selama belum diisi lagi, aplikasi <b>tidak memberi peringatan SBML</b> untuk kegiatan tahun {t}.</p>
          <ul className="rounded-xl bg-rose-50 p-3 text-rose-800">{lama.map((d) => <li key={d.peran} className="flex justify-between"><span>{d.peran}</span><b className="angka">{rupiah(d.nominal)}</b></li>)}</ul>
        </div>
      ),
      tombol: `Hapus SBML ${t}`, bahaya: true,
    });
    if (!ok) return;
    try {
      await api.del(`/sbml/${t}`);
      segarkan();
      if (t === tahun) setNilai({});
      beritahu('sukses', `SBML ${t} dihapus. Silakan isi ulang bila perlu.`, {
        urungkan: async () => { await api.put('/sbml', { tahun: t, nilai: Object.fromEntries(lama.map((d) => [d.peran, d.nominal])) }); segarkan(); },
      });
    } catch (e) { beritahu('galat', (e as Error).message); }
  };
  const simpanAmbang = useAksi(() => api.put('/pengaturan', { ambang_sbml: ambang }), { sukses: 'Ambang peringatan disimpan.' });
  const peran = [...new Set([...(atur?.daftar_peran ?? []), ...(daftar ?? []).filter((d) => d.tahun === tahun).map((d) => d.peran)])];
  const tahunAda = [...new Set([tahunIni, tahunIni + 1, ...(daftar ?? []).map((d) => d.tahun)])].sort((a, b) => b - a);
  const perTahun = tahunAda.map((t) => ({ t, isi: (daftar ?? []).filter((d) => d.tahun === t) })).filter((x) => x.isi.length);

  return (
    <div className="space-y-5">
      <Panel judul="SBML honor mitra per bulan, per peran"
        ket={<>Batas honor <b>berbeda untuk setiap peran</b> dan dicek <b>per bulan kegiatan</b>: honor seorang mitra untuk satu peran di satu bulan (dari semua kegiatan) dibandingkan dengan SBML peran tersebut. Penugasan tetap bisa disimpan setelah peringatan dikonfirmasi.</>}
        kaki={admin ? <>
          {tersimpanTahun(tahun).length > 0 && <Tombol varian="hantu" className="mr-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700" ikon={<Trash2 className="size-4" />} onClick={() => hapusTahun(tahun)}>Hapus SBML {tahun}</Tombol>}
          <Tombol varian="kedua" ikon={<RotateCcw className="size-4" />} onClick={() => setNilai(Object.fromEntries(tersimpanTahun(tahun).map((d) => [d.peran, d.nominal])))}>Kembalikan isian</Tombol>
          <Tombol memuat={simpan.isPending} onClick={() => simpan.mutate(undefined)}>Simpan SBML {tahun}</Tombol>
        </> : undefined}>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-stone-600">Tahun</span>
          <Pilihan nilai={String(tahun)} ubah={(v) => setTahun(Number(v))} opsi={tahunAda.map(String)} className="w-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {peran.map((p) => (
            <Kolom key={p} label={`SBML ${p}`} petunjuk="per mitra per bulan · kosongkan bila tidak dibatasi">
              <MasukanRupiah nilai={nilai[p]} ubah={(n) => setNilai({ ...nilai, [p]: n })} disabled={!admin} placeholder="belum diatur" />
            </Kolom>
          ))}
        </div>
        <p className="mt-4 text-xs text-stone-400">Daftar peran mengikuti <b>Pengaturan → Peran &amp; satuan</b>.</p>
      </Panel>

      <Panel judul="Ambang peringatan dini" ket="Saat memilih petugas, aplikasi menampilkan popup bila honor mitra sudah mencapai persentase ini dari SBML perannya."
        kaki={admin ? <Tombol memuat={simpanAmbang.isPending} onClick={() => simpanAmbang.mutate(undefined)}>Simpan ambang</Tombol> : undefined}>
        <div className="flex items-center gap-4">
          <input type="range" min={50} max={100} step={5} value={ambang} disabled={!admin} onChange={(e) => setAmbang(Number(e.target.value))} className="w-64 accent-brand-600" />
          <span className="text-2xl font-extrabold text-stone-900">{ambang}%</span>
          <span className="text-sm text-stone-500">mis. SBML Rp3.000.000 → peringatan mulai {rupiah((3000000 * ambang) / 100)}</span>
        </div>
      </Panel>

      {perTahun.length > 0 && (
        <Panel judul="Ringkasan SBML tersimpan">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs font-bold uppercase tracking-wide text-stone-400"><th className="pb-2">Tahun</th>{peran.map((p) => <th key={p} className="pb-2 text-right">{p}</th>)}{admin && <th className="pb-2 text-right">Aksi</th>}</tr></thead>
              <tbody className="divide-y divide-stone-100">
                {perTahun.map(({ t, isi }) => (
                  <tr key={t} className="cursor-pointer hover:bg-stone-50" onClick={() => setTahun(t)}>
                    <td className="py-2.5 font-bold text-stone-800">{t}</td>
                    {peran.map((p) => { const v = isi.find((x) => x.peran === p)?.nominal; return <td key={p} className="angka py-2.5 text-right text-stone-700">{v ? rupiah(v) : <span className="text-stone-300">—</span>}</td>; })}
                    {admin && (
                      <td className="py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex">
                          <TombolIkon label={`Ubah SBML ${t}`} onClick={() => { setTahun(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil className="size-4" /></TombolIkon>
                          <TombolIkon label={`Hapus SBML ${t}`} onClick={() => hapusTahun(t)} className="hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></TombolIkon>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function EditorDaftar({ label, nilai, ubah }: { label: string; nilai: string[]; ubah: (v: string[]) => void }) {
  const [baru, setBaru] = useState('');
  const tambah = () => { const v = baru.trim(); if (v && !nilai.includes(v)) ubah([...nilai, v]); setBaru(''); };
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold text-stone-600">{label}</div>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-200 p-3">
        <AnimatePresence>
          {nilai.map((n) => (
            <motion.span key={n} layout initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
              className="inline-flex items-center gap-1 rounded-xl bg-brand-50 py-1 pl-3 pr-1 text-sm font-semibold text-brand-800">
              {n}<button onClick={() => ubah(nilai.filter((x) => x !== n))} className="rounded-lg p-1 hover:bg-brand-100"><X className="size-3.5" /></button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input value={baru} onChange={(e) => setBaru(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tambah(); } }} onBlur={tambah}
          placeholder="+ tambah, tekan Enter" className="min-w-40 flex-1 bg-transparent px-2 text-sm outline-none" />
      </div>
    </div>
  );
}

function TabDaftar() {
  const { data, f, setF, simpan } = useFormPengaturan();
  if (!data) return <Memuat />;
  return (
    <Panel judul="Pilihan peran, satuan, dan jenis kegiatan" ket="Muncul sebagai pilihan saat mengisi kegiatan dan penugasan."
      kaki={<Tombol memuat={simpan.isPending} onClick={() => simpan.mutate(f)}>Simpan</Tombol>}>
      <div className="space-y-5">
        <EditorDaftar label="Peran petugas" nilai={f.daftar_peran ?? []} ubah={(v) => setF({ ...f, daftar_peran: v })} />
        <EditorDaftar label="Satuan beban kerja" nilai={f.daftar_satuan ?? []} ubah={(v) => setF({ ...f, daftar_satuan: v })} />
        <EditorDaftar label="Jenis kegiatan" nilai={f.daftar_jenis ?? []} ubah={(v) => setF({ ...f, daftar_jenis: v })} />
      </div>
    </Panel>
  );
}

type InfoTemplate = { penanda: Record<'umum' | 'spk' | 'bast', Record<string, string>>; status: Record<'spk' | 'bast', { khusus: boolean; diubah?: string }> };
function TabTemplate({ admin }: { admin: boolean }) {
  const { data } = useQuery({ queryKey: ['template'], queryFn: () => api.get<InfoTemplate>('/template') });
  const [unggah, setUnggah] = useState<'spk' | 'bast' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lihat, setLihat] = useState<'spk' | 'bast'>('spk');
  const { beritahu, konfirmasi } = useUmpan();
  const kirim = useAksi((v: { j: string; f: File }) => kirimFile(`/template/${v.j}`, v.f), { sukses: 'Template baru dipasang dan sudah diuji.', setelah: () => { setUnggah(null); setFile(null); } });
  const reset = async (j: string) => {
    if (!(await konfirmasi({ judul: `Kembalikan template ${j.toUpperCase()} bawaan?`, pesan: 'Template yang Anda unggah akan diganti dengan template bawaan aplikasi.', tombol: 'Kembalikan' }))) return;
    await api.del(`/template/${j}`); segarkan(); beritahu('sukses', 'Template bawaan dipakai kembali.');
  };
  if (!data) return <Memuat />;
  return (
    <div className="space-y-5">
      <Panel judul="Template dokumen Word" ket="Isi surat diambil dari file Word. Ubah kalimat, tata letak, atau kop surat langsung di Microsoft Word, lalu unggah kembali.">
        <ol className="mb-6 grid gap-3 text-sm sm:grid-cols-3">
          {['Unduh template yang sedang dipakai', 'Edit di Microsoft Word. Biarkan penanda seperti ${nama_mitra} tetap utuh', 'Unggah kembali — aplikasi menguji template sebelum dipakai'].map((t, i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-stone-50 p-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span><span className="text-stone-600">{t}</span></li>
          ))}
        </ol>
        <div className="grid gap-4 md:grid-cols-2">
          {(['spk', 'bast'] as const).map((j) => (
            <div key={j} className="rounded-2xl border border-stone-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-lg font-extrabold text-stone-900">{j.toUpperCase()}</span>
                {data.status[j].khusus ? <Lencana warna="brand">Template unggahan · {tanggal(data.status[j].diubah)}</Lencana> : <Lencana>Template bawaan</Lencana>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Tombol kecil varian="kedua" ikon={<Download className="size-3.5" />} onClick={() => unduhFile(`/template/${j}`).catch((e) => beritahu('galat', e.message))}>Unduh</Tombol>
                {admin && <Tombol kecil varian="lembut" ikon={<Upload className="size-3.5" />} onClick={() => setUnggah(j)}>Unggah baru</Tombol>}
                {admin && data.status[j].khusus && <Tombol kecil varian="hantu" ikon={<RotateCcw className="size-3.5" />} onClick={() => reset(j)}>Bawaan</Tombol>}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel judul="Daftar penanda" ket="Klik untuk menyalin, lalu tempel di dokumen Word. Penanda diawali $ dan diapit kurung kurawal.">
        <div className="mb-4 inline-flex gap-1 rounded-xl bg-stone-100 p-1">
          {(['spk', 'bast'] as const).map((j) => <button key={j} onClick={() => setLihat(j)} className={cx('rounded-lg px-4 py-1.5 text-sm font-bold', lihat === j ? 'bg-white shadow-sm' : 'text-stone-500')}>{j.toUpperCase()}</button>)}
        </div>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {Object.entries({ ...data.penanda[lihat], ...data.penanda.umum }).map(([k, v]) => {
            const teks = k.includes('…') ? k.split(' … ').map((x) => '${' + x + '}').join(' … ') : '${' + k + '}';
            return (
              <button key={k} onClick={() => { navigator.clipboard?.writeText(teks); beritahu('info', <>Disalin: <code>{teks}</code></>); }}
                className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-stone-50">
                <span className="min-w-0"><code className="text-[13px] font-semibold text-brand-700">{teks}</code><span className="block truncate text-xs text-stone-400">{v}</span></span>
                <Copy className="size-3.5 shrink-0 text-stone-300 group-hover:text-brand-600" />
              </button>
            );
          })}
        </div>
      </Panel>
      <Jendela buka={!!unggah} tutup={() => { setUnggah(null); setFile(null); }} judul={`Unggah template ${unggah?.toUpperCase()}`}
        kaki={<><Tombol varian="kedua" onClick={() => setUnggah(null)}>Batal</Tombol><Tombol disabled={!file} memuat={kirim.isPending} onClick={() => file && unggah && kirim.mutate({ j: unggah, f: file })}>Uji & pasang</Tombol></>}>
        <AreaUnggah terima=".docx" file={file} pilih={setFile} teks="Pilih file Word (.docx)" />
        <p className="mt-3 text-xs text-stone-400">Jika ada penanda yang rusak (mis. kurung kurawal terhapus), aplikasi akan menolak dan menjelaskan letak kesalahannya — template lama tetap dipakai.</p>
      </Jendela>
    </div>
  );
}

function TabPengguna({ saya }: { saya?: number }) {
  const { data } = useQuery({ queryKey: ['pengguna'], queryFn: () => api.get<Pengguna[]>('/pengguna') });
  const [form, setForm] = useState<(Partial<Pengguna> & { sandi?: string }) | null>(null);
  const { konfirmasi } = useUmpan();
  const simpan = useAksi((v: Partial<Pengguna> & { sandi?: string }) => (v.id ? api.put(`/pengguna/${v.id}`, v) : api.post('/pengguna', v)), { sukses: 'Pengguna disimpan.', setelah: () => setForm(null) });
  const hapus = useAksi((u: Pengguna) => api.del(`/pengguna/${u.id}`), { sukses: 'Pengguna dihapus.' });
  const setujui = useAksi((u: Pengguna) => api.post(`/pengguna/${u.id}/setujui`), { sukses: (_, u) => `${u.nama} kini dapat masuk ke aplikasi.` });
  return (
    <Panel judul="Pengguna aplikasi" ket={<><b>Admin</b> dapat mengubah semua pengaturan. <b>Operator</b> dapat mengelola mitra, kegiatan, honor, dan dokumen. Orang yang mendaftar dari halaman masuk baru bisa masuk setelah Anda setujui di sini.</>}>
      <div className="mb-4 flex justify-end"><Tombol kecil ikon={<Plus className="size-4" />} onClick={() => setForm({ peran: 'operator' })}>Tambah pengguna</Tombol></div>
      <ul className="divide-y divide-stone-100">
        {data?.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-3">
            <Avatar nama={u.nama} />
            <div className="min-w-0 flex-1"><div className="font-semibold text-stone-800">{u.nama} {u.id === saya && <span className="text-xs text-stone-400">(Anda)</span>}</div><div className="text-xs text-stone-400">@{u.username}</div></div>
            {u.status === 'menunggu' ? <>
              <Lencana warna="kuning" titik>Menunggu persetujuan</Lencana>
              <Tombol kecil onClick={() => setujui.mutate(u)}>Setujui</Tombol>
              <Tombol kecil varian="hantu" onClick={async () => (await konfirmasi({ judul: `Tolak pendaftaran ${u.nama}?`, pesan: 'Akun pendaftar akan dihapus.', bahaya: true, tombol: 'Tolak' })) && hapus.mutate(u)}>Tolak</Tombol>
            </> : <>
              <Lencana warna={u.peran === 'admin' ? 'brand' : 'abu'}>{u.peran}</Lencana>
              <TombolIkon label="Ubah" onClick={() => setForm(u)}><Pencil className="size-4" /></TombolIkon>
              {u.id !== saya && <TombolIkon label="Hapus" onClick={async () => (await konfirmasi({ judul: `Hapus ${u.nama}?`, bahaya: true, tombol: 'Hapus' })) && hapus.mutate(u)}><Trash2 className="size-4" /></TombolIkon>}
            </>}
          </li>
        ))}
      </ul>
      <Jendela buka={!!form} tutup={() => setForm(null)} judul={form?.id ? 'Ubah pengguna' : 'Tambah pengguna'}
        kaki={<><Tombol varian="kedua" onClick={() => setForm(null)}>Batal</Tombol><Tombol memuat={simpan.isPending} onClick={() => form && simpan.mutate(form)}>Simpan</Tombol></>}>
        {form && (
          <div className="space-y-4">
            <Kolom label="Nama" wajib><Masukan value={form.nama ?? ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} /></Kolom>
            <Kolom label="Username" wajib><Masukan disabled={!!form.id} value={form.username ?? ''} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Kolom>
            <Kolom label={form.id ? 'Kata sandi baru' : 'Kata sandi'} wajib={!form.id} petunjuk={form.id ? 'Kosongkan jika tidak diganti.' : 'Minimal 6 karakter.'}><Masukan type="text" value={form.sandi ?? ''} onChange={(e) => setForm({ ...form, sandi: e.target.value })} /></Kolom>
            <Kolom label="Peran"><Pilihan nilai={form.peran ?? 'operator'} ubah={(v) => setForm({ ...form, peran: v as Pengguna['peran'] })} opsi={[{ nilai: 'operator', label: 'Operator' }, { nilai: 'admin', label: 'Admin' }]} /></Kolom>
          </div>
        )}
      </Jendela>
    </Panel>
  );
}

function TabCadangan() {
  const { data } = useQuery({ queryKey: ['cadangan'], queryFn: () => api.get<{ nama: string; ukuran: number; waktu: string }[]>('/cadangan') });
  const [file, setFile] = useState<File | null>(null);
  const { beritahu, konfirmasi } = useUmpan();
  const pulihkan = async (sumber: { file?: File; nama?: string }) => {
    if (!(await konfirmasi({ judul: 'Pulihkan data dari cadangan?', pesan: 'Seluruh data saat ini akan diganti dengan isi cadangan. Data saat ini otomatis dicadangkan dulu, jadi tetap aman.', tombol: 'Pulihkan', bahaya: true }))) return;
    try {
      if (sumber.file) await kirimFile('/cadangan/pulihkan', sumber.file);
      else { const fd = new FormData(); fd.append('nama', sumber.nama!); await fetch('/api/cadangan/pulihkan', { method: 'POST', body: fd }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).pesan); }); }
      beritahu('sukses', 'Data berhasil dipulihkan.');
      setFile(null);
      await queryClient.invalidateQueries();
    } catch (e) { beritahu('galat', (e as Error).message); }
  };
  return (
    <div className="space-y-5">
      <Panel judul="Cadangan data" ket="Aplikasi membuat cadangan otomatis setiap hari (30 hari terakhir disimpan). Unduh cadangan secara berkala dan simpan di Google Drive/flashdisk untuk keamanan ekstra.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-brand-50/60 p-5">
            <h3 className="font-bold text-stone-800">Unduh cadangan sekarang</h3>
            <p className="mb-4 mt-1 text-sm text-stone-500">Satu file berisi seluruh data: mitra, kegiatan, honor, pengguna, pengaturan, dan template.</p>
            <Tombol ikon={<Download className="size-4" />} onClick={() => unduhFile('/cadangan/unduh').catch((e) => beritahu('galat', e.message))}>Unduh cadangan</Tombol>
          </div>
          <div className="rounded-2xl bg-stone-50 p-5">
            <h3 className="font-bold text-stone-800">Pulihkan dari file</h3>
            <div className="my-3"><AreaUnggah terima=".json" file={file} pilih={setFile} teks="Pilih file cadangan (.json)" /></div>
            <Tombol varian="bahaya" disabled={!file} onClick={() => file && pulihkan({ file })}>Pulihkan</Tombol>
          </div>
        </div>
      </Panel>
      <Panel judul="Cadangan otomatis di server">
        {!data?.length ? <p className="text-sm text-stone-400">Belum ada.</p> : (
          <ul className="divide-y divide-stone-100">
            {data.map((c) => (
              <li key={c.nama} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="flex-1 font-mono text-xs text-stone-600">{c.nama}</span>
                <span className="text-xs text-stone-400">{(c.ukuran / 1024).toFixed(0)} KB</span>
                <Tombol kecil varian="hantu" ikon={<Download className="size-3.5" />} onClick={() => unduhFile(`/cadangan/file/${encodeURIComponent(c.nama)}`).catch((e) => beritahu('galat', e.message))}>Unduh</Tombol>
                <Tombol kecil varian="hantu" ikon={<RotateCcw className="size-3.5" />} onClick={() => pulihkan({ nama: c.nama })}>Pulihkan</Tombol>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** Reset seluruh data mitra dan/atau kegiatan — dengan persetujuan berlapis & cadangan otomatis */
function TabReset() {
  const { data: ringkas } = useQuery({ queryKey: ['reset-ringkasan'], queryFn: () => api.get<{ mitra: number; kegiatan: number; penugasan: number; sbml: number }>('/reset/ringkasan') });
  const [pilih, setPilih] = useState({ mitra: false, kegiatan: false, sbml: false });
  const [buka, setBuka] = useState(false);
  const [paham, setPaham] = useState(false);
  const [paham2, setPaham2] = useState(false);
  const [ketik, setKetik] = useState('');
  const [, setParam] = useSearchParams();
  const { beritahu } = useUmpan();
  const reset = useAksi(() => api.post<{ mitra?: number; kegiatan?: number; sbml?: number; penugasan?: number; cadangan: string }>('/reset', { ...pilih, konfirmasi: ketik }), {
    setelah: (r) => {
      setBuka(false);
      beritahu('sukses', <>Reset selesai: {[r.mitra !== undefined && `${r.mitra} mitra`, r.kegiatan !== undefined && `${r.kegiatan} kegiatan`, r.penugasan !== undefined && `${r.penugasan} penugasan`, r.sbml !== undefined && `${r.sbml} isian SBML`].filter(Boolean).join(', ')} dihapus. Cadangan otomatis: <b>{r.cadangan}</b></>);
      setPilih({ mitra: false, kegiatan: false, sbml: false });
    },
  });
  const bukaJendela = () => { setPaham(false); setPaham2(false); setKetik(''); setBuka(true); };
  const siap = paham && paham2 && ketik.trim().toUpperCase() === 'HAPUS SEMUA';
  const yangDihapus = [
    pilih.mitra && `${ringkas?.mitra ?? 0} mitra (termasuk yang di tempat sampah)`,
    pilih.kegiatan && `${ringkas?.kegiatan ?? 0} kegiatan (termasuk yang di tempat sampah)`,
    (pilih.mitra || pilih.kegiatan) && `${ringkas?.penugasan ?? 0} penugasan petugas beserta nomor SPK/BAST yang sudah diberikan`,
    pilih.sbml && `SBML semua tahun (${ringkas?.sbml ?? 0} tahun) — peringatan SBML berhenti sampai diisi ulang`,
  ].filter(Boolean) as string[];
  const adaPilihan = pilih.mitra || pilih.kegiatan || pilih.sbml;

  return (
    <Panel judul="Reset data" ket="Menghapus PERMANEN data yang dipilih, mis. untuk memulai tahun baru, setelah uji coba, atau bila SBML salah isi. Pengaturan kantor, pengguna, dan template tidak ikut terhapus.">
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {([['mitra', 'Semua mitra', ringkas?.mitra, 'data · penugasannya ikut terhapus'], ['kegiatan', 'Semua kegiatan', ringkas?.kegiatan, 'data · penugasannya ikut terhapus'], ['sbml', 'Semua SBML', ringkas?.sbml, 'tahun · mitra & kegiatan tidak disentuh']] as const).map(([k, l, n, ket]) => (
          <button key={k} type="button" onClick={() => setPilih({ ...pilih, [k]: !pilih[k] })}
            className={cx('flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition', pilih[k] ? 'border-rose-400 bg-rose-50' : 'border-stone-200 hover:border-stone-300')}>
            <Kotak aktif={pilih[k]} ubah={() => setPilih({ ...pilih, [k]: !pilih[k] })} />
            <div><div className="font-bold text-stone-800">{l}</div><div className="text-xs text-stone-500">{n ?? 0} {ket}</div></div>
          </button>
        ))}
      </div>
      <div className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Sebelum menghapus, aplikasi otomatis membuat <b>file cadangan</b>. Bila salah, data bisa dikembalikan dari{' '}
        <button className="font-bold underline" onClick={() => setParam({ tab: 'cadangan' }, { replace: true })}>Cadangan data</button>.
      </div>
      <p className="mb-4 text-xs text-stone-500">Hanya ingin menghapus SBML satu tahun? Gunakan tombol hapus di tab <button className="font-semibold text-brand-700 underline" onClick={() => setParam({ tab: 'batas' }, { replace: true })}>Batas honor (SBML)</button>.</p>
      <Tombol varian="bahaya" disabled={!adaPilihan} ikon={<AlertOctagon className="size-4" />} onClick={bukaJendela}>Reset data terpilih…</Tombol>

      <Jendela buka={buka} tutup={() => setBuka(false)} judul="Konfirmasi reset data" sub="Tindakan ini menghapus data secara permanen."
        kaki={<>
          <Tombol varian="kedua" onClick={() => setBuka(false)}>Batal</Tombol>
          <Tombol varian="bahaya" disabled={!siap} memuat={reset.isPending} ikon={<Trash2 className="size-4" />} onClick={() => reset.mutate(undefined)}>Hapus permanen</Tombol>
        </>}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">
            <p className="mb-2 font-bold">Yang akan dihapus permanen:</p>
            <ul className="list-disc space-y-1 pl-5">{yangDihapus.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="space-y-3 rounded-xl border border-stone-200 p-3 text-sm">
            <Kotak aktif={paham} ubah={setPaham} label="Saya mengerti data di atas akan dihapus permanen dan tidak bisa dipulihkan dari tempat sampah." />
            <Kotak aktif={paham2} ubah={setPaham2} label="Saya mengerti pemulihan hanya bisa dilakukan dari file cadangan yang dibuat otomatis sebelum reset." />
          </div>
          <Kolom label='Ketik "HAPUS SEMUA" untuk melanjutkan'>
            <Masukan value={ketik} onChange={(e) => setKetik(e.target.value)} placeholder="HAPUS SEMUA" className={cx('font-mono', ketik && !siap && ketik.trim().toUpperCase() !== 'HAPUS SEMUA' && 'border-rose-300')} />
          </Kolom>
        </div>
      </Jendela>
    </Panel>
  );
}

function TabRiwayat() {
  const { data } = useQuery({ queryKey: ['riwayat'], queryFn: () => api.get<{ id: number; waktu: string; pengguna: string; aksi: string; detail: string | null }[]>('/riwayat') });
  return (
    <Panel judul="Riwayat aktivitas" ket="300 aktivitas terakhir — berguna untuk menelusuri siapa mengubah apa.">
      {!data ? <Memuat /> : (
        <ol className="relative space-y-4 border-l-2 border-stone-100 pl-5">
          {data.map((r, i) => (
            <motion.li key={r.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i, 20) * 0.015 } }} className="relative">
              <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-white bg-brand-400" />
              <div className="text-sm"><b className="text-stone-800">{r.aksi}</b>{r.detail && <span className="text-stone-500"> — {r.detail}</span>}</div>
              <div className="text-xs text-stone-400">{r.pengguna} · {r.waktu}</div>
            </motion.li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function TabAkun() {
  const [lama, setLama] = useState('');
  const [sandi, setSandi] = useState('');
  const [ulang, setUlang] = useState('');
  const ganti = useAksi(() => api.post('/ganti-sandi', { sandi_lama: lama, sandi }), {
    sukses: 'Kata sandi diganti. Perangkat lain yang memakai akun ini otomatis keluar.',
    setelah: () => { setLama(''); setSandi(''); setUlang(''); },
  });
  return (
    <Panel judul="Ganti kata sandi" kaki={<Tombol disabled={!lama || !sandi || sandi !== ulang} memuat={ganti.isPending} onClick={() => ganti.mutate(undefined)}>Simpan</Tombol>}>
      <div className="grid max-w-md gap-4">
        <Kolom label="Kata sandi saat ini" petunjuk="Untuk memastikan yang mengganti adalah pemilik akun"><Masukan type="password" autoComplete="current-password" value={lama} onChange={(e) => setLama(e.target.value)} /></Kolom>
        <Kolom label="Kata sandi baru" petunjuk="Minimal 6 karakter"><Masukan type="password" autoComplete="new-password" value={sandi} onChange={(e) => setSandi(e.target.value)} /></Kolom>
        <Kolom label="Ulangi kata sandi" galat={ulang && sandi !== ulang ? 'Kata sandi belum sama' : undefined}><Masukan type="password" value={ulang} onChange={(e) => setUlang(e.target.value)} /></Kolom>
      </div>
    </Panel>
  );
}
