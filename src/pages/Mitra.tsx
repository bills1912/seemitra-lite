import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArchiveRestore, CalendarDays, Download, FileSignature, Mail, MapPin, Pencil, Phone, Plus, Trash2, Upload, Users, Wallet,
} from 'lucide-react';
import { api, kirimFile, segarkan, unduhFile } from '../lib/api';
import type { Mitra } from '../lib/types';
import { useAksi } from '../lib/hooks';
import { useUmpan } from '../components/umpan';
import { Pilihan, IsianSaran } from '../components/pemilih';
import {
  AreaUnggah, Avatar, Batang, Laci as LaciDetail, Jendela, KepalaHalaman, Kartu, Kolom, Kosong, KotakCari, Lencana, Masukan, Memuat, Saklar, Segmen, Tombol, TombolIkon, cx,
} from '../components/ui';
import { bulanIni, cocok, labelBulan, rupiah, tanggal } from '../lib/format';

const PER_HALAMAN = 60;

export function HalamanMitra() {
  const [param, setParam] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'semua' | 'aktif' | 'nonaktif'>('aktif');
  const [kec, setKec] = useState('');
  const [sampah, setSampah] = useState(false);
  const [batas, setBatas] = useState(PER_HALAMAN);
  const [form, setForm] = useState<Partial<Mitra> | null>(null);
  const [impor, setImpor] = useState(false);
  const { beritahu, konfirmasi } = useUmpan();

  const { data, isLoading } = useQuery({ queryKey: ['mitra', sampah], queryFn: () => api.get<Mitra[]>(`/mitra${sampah ? '?terhapus=1' : ''}`) });
  const { data: batasHonor } = useQuery({ queryKey: ['batas'], queryFn: () => api.get<{ tahun: number; nominal: number }[]>('/batas-honor') });
  const batasIni = batasHonor?.find((b) => b.tahun === Number(bulanIni().slice(0, 4)))?.nominal ?? null;

  const lihatId = Number(param.get('lihat')) || null;
  useEffect(() => {
    if (param.get('baru')) { setForm({ status: 'aktif' }); param.delete('baru'); setParam(param, { replace: true }); }
  }, [param, setParam]);

  const daftarKec = useMemo(() => [...new Set((data ?? []).map((m) => m.kecamatan).filter(Boolean) as string[])].sort(), [data]);
  const tersaring = useMemo(() => (data ?? []).filter((m) =>
    (sampah || status === 'semua' || m.status === status) && (!kec || m.kecamatan === kec) &&
    (!q || cocok(`${m.nama} ${m.sobat_id ?? ''} ${m.nik ?? ''} ${m.desa ?? ''} ${m.no_hp ?? ''}`, q))), [data, status, kec, q, sampah]);
  useEffect(() => setBatas(PER_HALAMAN), [q, status, kec, sampah]);

  const hitung = (s: string) => (data ?? []).filter((m) => s === 'semua' || m.status === s).length;

  const hapus = async (m: Mitra) => {
    if (!(await konfirmasi({ judul: `Hapus ${m.nama}?`, pesan: 'Mitra dipindahkan ke tempat sampah dan dapat dipulihkan kapan saja.', tombol: 'Hapus', bahaya: true }))) return;
    try {
      await api.del(`/mitra/${m.id}`);
      segarkan();
      beritahu('sukses', <>Mitra <b>{m.nama}</b> dihapus.</>, { urungkan: async () => { await api.post(`/mitra/${m.id}/pulihkan`); segarkan(); } });
    } catch (e) { beritahu('galat', (e as Error).message); }
  };
  const pulihkan = useAksi((m: Mitra) => api.post(`/mitra/${m.id}/pulihkan`), { sukses: (_, m) => `${m.nama} dipulihkan.` });

  return (
    <div>
      <KepalaHalaman
        judul={sampah ? 'Mitra terhapus' : 'Daftar Mitra'}
        sub={sampah ? 'Mitra yang dihapus dapat dipulihkan dari sini.' : `${data?.filter((m) => m.status === 'aktif').length ?? 0} mitra aktif terdaftar`}
        aksi={sampah ? <Tombol varian="kedua" onClick={() => setSampah(false)}>Kembali ke daftar</Tombol> : <>
          <Tombol varian="kedua" ikon={<Upload className="size-4" />} onClick={() => setImpor(true)}>Impor Excel</Tombol>
          <Tombol varian="kedua" ikon={<Download className="size-4" />} onClick={() => unduhFile('/mitra-ekspor').catch((e) => beritahu('galat', e.message))}>Ekspor</Tombol>
          <Tombol ikon={<Plus className="size-4" />} onClick={() => setForm({ status: 'aktif' })}>Tambah Mitra</Tombol>
        </>}
      />

      <Kartu className="mb-4 flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <KotakCari nilai={q} ubah={setQ} placeholder="Cari nama, SOBAT ID, NIK, desa, atau no HP…" className="flex-1" />
        {!sampah && <Segmen id="status-mitra" nilai={status} ubah={setStatus} opsi={[
          { nilai: 'aktif', label: 'Aktif', jumlah: hitung('aktif') }, { nilai: 'nonaktif', label: 'Nonaktif', jumlah: hitung('nonaktif') }, { nilai: 'semua', label: 'Semua' },
        ]} />}
        {daftarKec.length > 0 && <Pilihan nilai={kec} ubah={setKec} opsi={daftarKec} kosong="Semua kecamatan" className="md:w-52" />}
      </Kartu>

      {isLoading ? <Memuat /> : tersaring.length === 0 ? (
        <Kartu>
          <Kosong ikon={<Users className="size-7" />} judul={data?.length ? 'Tidak ada mitra yang cocok' : sampah ? 'Tempat sampah kosong' : 'Belum ada mitra'}
            pesan={data?.length ? 'Coba ubah kata kunci atau filter.' : sampah ? undefined : 'Tambahkan mitra satu per satu, atau impor sekaligus dari file Excel.'}
            aksi={!data?.length && !sampah && <div className="flex gap-2"><Tombol varian="kedua" onClick={() => setImpor(true)} ikon={<Upload className="size-4" />}>Impor Excel</Tombol><Tombol onClick={() => setForm({ status: 'aktif' })} ikon={<Plus className="size-4" />}>Tambah Mitra</Tombol></div>} />
        </Kartu>
      ) : (
        <Kartu className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_88px] gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-400 md:grid">
            <span>Mitra</span><span>Wilayah</span><span>Riwayat</span><span>Honor {labelBulan(bulanIni())}</span><span />
          </div>
          <ul className="divide-y divide-stone-100">
            <AnimatePresence initial={false}>
              {tersaring.slice(0, batas).map((m, i) => (
                <motion.li key={m.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 15) * 0.02 } }} exit={{ opacity: 0, x: -30, height: 0 }}
                  onClick={() => !sampah && setParam({ lihat: String(m.id) })}
                  className={cx('group grid cursor-pointer grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-brand-50/40 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_88px]', sampah && 'cursor-default')}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nama={m.nama} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-stone-800">{m.nama}</span>
                        {m.status === 'nonaktif' && <Lencana>Nonaktif</Lencana>}
                      </div>
                      <div className="truncate text-xs text-stone-400">{[m.sobat_id && `SOBAT ${m.sobat_id}`, m.no_hp].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                  </div>
                  <div className="hidden min-w-0 text-sm text-stone-600 md:block"><div className="truncate">{m.kecamatan || '—'}</div><div className="truncate text-xs text-stone-400">{m.desa}</div></div>
                  <div className="hidden text-sm md:block"><div className="font-semibold text-stone-700">{m.jumlah_kegiatan ?? 0} kegiatan</div><div className="text-xs text-stone-400">{m.terakhir_bertugas ? `terakhir ${labelBulan(m.terakhir_bertugas)}` : 'belum pernah'}</div></div>
                  <div className="hidden md:block">
                    <div className="angka text-sm font-semibold text-stone-700">{m.honor_bulan_ini ? rupiah(m.honor_bulan_ini) : <span className="text-stone-300">—</span>}</div>
                    <Batang nilai={m.honor_bulan_ini ?? 0} maks={m.honor_bulan_ini ? batasIni : null} className="mt-1.5 max-w-36" />
                  </div>
                  <div className="flex justify-end gap-0.5 md:opacity-0 md:transition md:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    {sampah ? <Tombol kecil varian="lembut" ikon={<ArchiveRestore className="size-4" />} onClick={() => pulihkan.mutate(m)}>Pulihkan</Tombol> : <>
                      <TombolIkon label="Ubah" onClick={() => setForm(m)}><Pencil className="size-4" /></TombolIkon>
                      <TombolIkon label="Hapus" onClick={() => hapus(m)} className="hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-4" /></TombolIkon>
                    </>}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {tersaring.length > batas && (
            <div className="border-t border-stone-100 p-3 text-center">
              <Tombol varian="hantu" onClick={() => setBatas(batas + PER_HALAMAN)}>Tampilkan lebih banyak ({tersaring.length - batas} lagi)</Tombol>
            </div>
          )}
        </Kartu>
      )}
      {!sampah && <button onClick={() => setSampah(true)} className="mt-4 flex items-center gap-1.5 text-sm font-medium text-stone-400 hover:text-stone-600"><Trash2 className="size-4" /> Lihat mitra yang terhapus</button>}

      <FormMitra data={form} tutup={() => setForm(null)} daftarKec={daftarKec} />
      <ImporMitra buka={impor} tutup={() => setImpor(false)} />
      <DetailMitra id={lihatId} tutup={() => { param.delete('lihat'); setParam(param, { replace: true }); }} ubah={(m) => setForm(m)} batas={batasIni} />
    </div>
  );
}

/* ---------------------------- Formulir mitra ---------------------------- */
export function FormMitra({ data, tutup, daftarKec }: { data: Partial<Mitra> | null; tutup: () => void; daftarKec: string[] }) {
  const [f, setF] = useState<Partial<Mitra>>({});
  useEffect(() => { if (data) setF(data); }, [data]);
  const set = (k: keyof Mitra) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const simpan = useAksi((v: Partial<Mitra>) => (v.id ? api.put(`/mitra/${v.id}`, v) : api.post('/mitra', v)), {
    sukses: (_, v) => (v.id ? 'Data mitra diperbarui.' : `${v.nama} ditambahkan.`), setelah: tutup,
  });
  const Bagian = ({ judul }: { judul: string }) => <h3 className="col-span-full mt-2 text-xs font-bold uppercase tracking-wider text-brand-700">{judul}</h3>;
  return (
    <Jendela buka={!!data} tutup={tutup} lebar="max-w-2xl" judul={data?.id ? 'Ubah data mitra' : 'Tambah mitra'} sub="Hanya nama yang wajib diisi. Data lain boleh dilengkapi nanti."
      kaki={<><Tombol varian="kedua" onClick={tutup}>Batal</Tombol><Tombol memuat={simpan.isPending} onClick={() => simpan.mutate(f)}>Simpan</Tombol></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); simpan.mutate(f); }}>
        <Bagian judul="Identitas" />
        <Kolom label="Nama lengkap" wajib className="sm:col-span-2"><Masukan autoFocus value={f.nama ?? ''} onChange={set('nama')} /></Kolom>
        <Kolom label="SOBAT ID"><Masukan value={f.sobat_id ?? ''} onChange={set('sobat_id')} /></Kolom>
        <Kolom label="NIK"><Masukan inputMode="numeric" value={f.nik ?? ''} onChange={set('nik')} /></Kolom>
        <Kolom label="Jenis kelamin">
          <Segmen id="jk" nilai={(f.jenis_kelamin ?? '') as string} ubah={(v) => setF({ ...f, jenis_kelamin: v })} opsi={[{ nilai: 'Laki-laki', label: 'Laki-laki' }, { nilai: 'Perempuan', label: 'Perempuan' }]} />
        </Kolom>
        <Kolom label="Pekerjaan"><Masukan value={f.pekerjaan ?? ''} onChange={set('pekerjaan')} /></Kolom>
        <Bagian judul="Kontak & alamat" />
        <Kolom label="No HP / WhatsApp"><Masukan inputMode="tel" value={f.no_hp ?? ''} onChange={set('no_hp')} /></Kolom>
        <Kolom label="Email"><Masukan type="email" value={f.email ?? ''} onChange={set('email')} /></Kolom>
        <Kolom label="Alamat lengkap" className="sm:col-span-2" petunjuk="Dipakai di SPK & BAST."><Masukan value={f.alamat ?? ''} onChange={set('alamat')} /></Kolom>
        <Kolom label="Kecamatan">
          <IsianSaran nilai={f.kecamatan ?? ''} ubah={(v) => setF((x) => ({ ...x, kecamatan: v }))} saran={daftarKec} />
        </Kolom>
        <Kolom label="Desa / kelurahan"><Masukan value={f.desa ?? ''} onChange={set('desa')} /></Kolom>
        <Bagian judul="Pembayaran" />
        <Kolom label="Bank"><Masukan value={f.bank ?? ''} onChange={set('bank')} placeholder="mis. BRI" /></Kolom>
        <Kolom label="No rekening"><Masukan inputMode="numeric" value={f.no_rekening ?? ''} onChange={set('no_rekening')} /></Kolom>
        <Bagian judul="Lainnya" />
        <div className="sm:col-span-2"><Saklar aktif={f.status !== 'nonaktif'} ubah={(v) => setF({ ...f, status: v ? 'aktif' : 'nonaktif' })} label={f.status !== 'nonaktif' ? 'Mitra aktif — muncul saat memilih petugas' : 'Mitra nonaktif — tidak muncul saat memilih petugas'} /></div>
        <Kolom label="Catatan" className="sm:col-span-2"><textarea className="input min-h-20" value={f.catatan ?? ''} onChange={set('catatan')} /></Kolom>
        <button type="submit" className="hidden" />
      </form>
    </Jendela>
  );
}

/* ---------------------------- Impor dari Excel ---------------------------- */
function ImporMitra({ buka, tutup }: { buka: boolean; tutup: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [hasil, setHasil] = useState<{ baru: number; diperbarui: number; dilewati: number } | null>(null);
  const { beritahu } = useUmpan();
  const kirim = useAksi((f: File) => kirimFile<{ baru: number; diperbarui: number; dilewati: number }>('/mitra-impor', f), { setelah: (r) => setHasil(r) });
  useEffect(() => { if (!buka) { setFile(null); setHasil(null); } }, [buka]);
  return (
    <Jendela buka={buka} tutup={tutup} judul="Impor mitra dari Excel / CSV" sub="Mitra yang sudah ada (SOBAT ID/NIK/nama sama) akan diperbarui, bukan diduplikasi."
      kaki={hasil ? <Tombol onClick={tutup}>Selesai</Tombol> : <><Tombol varian="kedua" onClick={tutup}>Batal</Tombol><Tombol disabled={!file} memuat={kirim.isPending} onClick={() => file && kirim.mutate(file)} ikon={<Upload className="size-4" />}>Impor</Tombol></>}>
      <AnimatePresence mode="wait">
        {hasil ? (
          <motion.div key="hasil" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-3 gap-3 text-center">
            {[['Mitra baru', hasil.baru, 'text-brand-700'], ['Diperbarui', hasil.diperbarui, 'text-sky-700'], ['Dilewati', hasil.dilewati, 'text-stone-500']].map(([l, n, w]) => (
              <div key={l as string} className="rounded-2xl bg-stone-50 p-4"><div className={cx('text-3xl font-extrabold', w as string)}>{n}</div><div className="text-sm text-stone-500">{l}</div></div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="form" className="space-y-4">
            <ol className="space-y-1.5 text-sm text-stone-600">
              <li>1. Unduh <button className="font-semibold text-brand-700 underline" onClick={() => unduhFile('/mitra-impor/contoh').catch((e) => beritahu('galat', e.message))}>contoh file Excel</button>, atau pakai file Anda sendiri (Excel .xlsx atau CSV).</li>
              <li>2. Pastikan baris pertama berisi judul kolom. Minimal ada kolom <b>Nama</b>.</li>
              <li>3. Kolom lain yang dikenali: SOBAT ID, NIK, Jenis Kelamin, Pekerjaan, Alamat, Kecamatan, Desa, No HP, Email, Bank, No Rekening, Status, Catatan.</li>
            </ol>
            <AreaUnggah terima=".xlsx,.csv" file={file} pilih={setFile} teks="Pilih file Excel (.xlsx) atau CSV (.csv)" />
          </motion.div>
        )}
      </AnimatePresence>
    </Jendela>
  );
}

/* ---------------------------- Detail mitra (laci samping) ---------------------------- */
type DataDetail = {
  mitra: Mitra;
  tugas: { id: number; kegiatan_id: number; kegiatan: string; bulan_honor: string; satuan: string; peran: string; volume: number; tarif: number; honor: number; tanggal_mulai: string; tanggal_selesai: string }[];
};
function DetailMitra({ id, tutup, ubah, batas }: { id: number | null; tutup: () => void; ubah: (m: Mitra) => void; batas: number | null }) {
  const { data } = useQuery({ queryKey: ['mitra-detail', id], queryFn: () => api.get<DataDetail>(`/mitra/${id}`), enabled: !!id });
  const perBulan = useMemo(() => {
    const g = new Map<string, DataDetail['tugas']>();
    for (const t of data?.tugas ?? []) g.set(t.bulan_honor, [...(g.get(t.bulan_honor) ?? []), t]);
    return [...g.entries()];
  }, [data]);
  const m = data?.mitra;
  const total = (data?.tugas ?? []).reduce((s, t) => s + t.honor, 0);

  return (
    <LaciDetail buka={!!id} tutup={tutup}>
      {!m ? <Memuat /> : (
        <div>
          <div className="bg-gradient-to-br from-brand-50 to-amber-50/50 px-6 pb-6 pt-10">
            <div className="flex items-center gap-4">
              <Avatar nama={m.nama} besar />
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold text-stone-900">{m.nama}</h2>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Lencana warna={m.status === 'aktif' ? 'hijau' : 'abu'} titik>{m.status === 'aktif' ? 'Aktif' : 'Nonaktif'}</Lencana>
                  {m.sobat_id && <Lencana>SOBAT {m.sobat_id}</Lencana>}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Tombol kecil varian="kedua" ikon={<Pencil className="size-3.5" />} onClick={() => ubah(m)}>Ubah data</Tombol>
              <Link to={`/dokumen?bulan=${bulanIni()}&mitra=${m.id}`}><Tombol kecil varian="kedua" ikon={<FileSignature className="size-3.5" />}>Buat SPK/BAST</Tombol></Link>
              {m.no_hp && <a href={`https://wa.me/${m.no_hp.replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer"><Tombol kecil varian="kedua" ikon={<Phone className="size-3.5" />}>WhatsApp</Tombol></a>}
            </div>
          </div>
          <div className="grid gap-x-6 gap-y-3 px-6 py-5 text-sm sm:grid-cols-2">
            {[
              [<MapPin key="a" className="size-4" />, 'Alamat', [m.alamat, m.desa, m.kecamatan].filter(Boolean).join(', ')],
              [<Phone key="b" className="size-4" />, 'No HP', m.no_hp], [<Mail key="c" className="size-4" />, 'Email', m.email],
              [<Wallet key="d" className="size-4" />, 'Rekening', [m.bank, m.no_rekening].filter(Boolean).join(' · ')],
              [<Users key="e" className="size-4" />, 'NIK / JK', [m.nik, m.jenis_kelamin].filter(Boolean).join(' · ')],
              [<CalendarDays key="f" className="size-4" />, 'Pekerjaan', m.pekerjaan],
            ].map(([ik, l, v], i) => (
              <div key={i} className="flex gap-3"><span className="mt-0.5 text-stone-400">{ik}</span><div><div className="text-xs text-stone-400">{l}</div><div className="font-medium text-stone-700">{v || '—'}</div></div></div>
            ))}
            {m.catatan && <p className="rounded-xl bg-amber-50 p-3 text-amber-900 sm:col-span-2">{m.catatan}</p>}
          </div>
          <div className="border-t border-stone-100 px-6 py-5">
            <div className="mb-4 flex items-end justify-between">
              <h3 className="font-bold text-stone-900">Riwayat penugasan</h3>
              <span className="text-sm text-stone-500">Total {rupiah(total)}</span>
            </div>
            {perBulan.length === 0 ? <p className="rounded-2xl bg-stone-50 py-8 text-center text-sm text-stone-400">Belum pernah ditugaskan.</p> : (
              <div className="space-y-4">
                {perBulan.map(([b, tg], i) => {
                  const sub = tg.reduce((s, t) => s + t.honor, 0);
                  return (
                    <motion.div key={b} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-stone-100 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <Link to={`/rekap?bulan=${b}`} className="font-semibold text-stone-800 hover:text-brand-700">{labelBulan(b)}</Link>
                        <span className={cx('angka text-sm font-bold', batas && sub > batas ? 'text-rose-600' : 'text-stone-700')}>{rupiah(sub)}</span>
                      </div>
                      <Batang nilai={sub} maks={batas} className="mb-3" />
                      <ul className="space-y-1.5">
                        {tg.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                            <Link to={`/kegiatan/${t.kegiatan_id}`} className="min-w-0 truncate text-stone-600 hover:text-brand-700">
                              <span className="font-medium text-stone-800">{t.kegiatan}</span> · {t.peran}
                            </Link>
                            <span className="angka shrink-0 text-xs text-stone-500">{t.volume} {t.satuan} · {rupiah(t.honor)}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  );
                })}
              </div>
            )}
            <p className="mt-4 text-xs text-stone-400">Terdaftar sejak {tanggal((m as unknown as { dibuat: string }).dibuat)}</p>
          </div>
        </div>
      )}
    </LaciDetail>
  );
}

