import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, FileCheck2, FileSignature, RotateCcw, Settings2, Users } from 'lucide-react';
import { api, segarkan, unduhFile } from '../lib/api';
import { useUmpan } from '../components/umpan';
import { useSaya } from '../lib/hooks';
import { Pilihan, PilihTanggal } from '../components/pemilih';
import { Avatar, KepalaHalaman, Kartu, Kolom, Kosong, Kotak, KotakCari, Memuat, PemilihBulan, Tombol, cx } from '../components/ui';
import { akhirBulan, bulanIni, cocok, labelBulan, rupiah } from '../lib/format';

type Pratinjau = {
  bulan: string;
  spk: { tanggal_spk: string; tanggal_mulai: string; tanggal_selesai: string } | null;
  mitra: {
    mitra_id: number; nama: string; total: number; jumlah_tugas: number; kegiatan: number[]; urut: number | null;
    nomor_spk: string | null; nomor_bast: string | null; tugas: { kegiatan_id: number; kegiatan: string; peran: string; honor: number }[];
  }[];
};

export function Dokumen() {
  const admin = useSaya().data?.pengguna?.peran === 'admin';
  const [param, setParam] = useSearchParams();
  const bulan = param.get('bulan') ?? bulanIni();
  const kegiatanAwal = param.get('kegiatan');
  const mitraAwal = param.get('mitra');
  const { beritahu, konfirmasi } = useUmpan();
  const { data } = useQuery({ queryKey: ['dokumen', bulan], queryFn: () => api.get<Pratinjau>(`/dokumen/pratinjau?bulan=${bulan}`) });
  const { data: rekap } = useQuery({ queryKey: ['rekap', bulan], queryFn: () => api.get<{ kegiatan: { id: number; nama: string }[] }>(`/rekap?bulan=${bulan}`) });

  const [tglSpk, setTglSpk] = useState('');
  const [mulai, setMulai] = useState('');
  const [selesai, setSelesai] = useState('');
  const [tglBast, setTglBast] = useState('');
  const [tglSpkBast, setTglSpkBast] = useState('');
  const [kegiatan, setKegiatan] = useState(kegiatanAwal ?? '');
  const [dipilih, setDipilih] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [proses, setProses] = useState<'spk' | 'bast' | null>(null);
  const [tab, setTab] = useState<'spk' | 'bast'>(kegiatanAwal ? 'bast' : 'spk');
  const [selesaiDok, setSelesaiDok] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setTglSpk(data.spk?.tanggal_spk ?? `${bulan}-01`);
    setMulai(data.spk?.tanggal_mulai ?? `${bulan}-01`);
    setSelesai(data.spk?.tanggal_selesai ?? akhirBulan(bulan));
    setTglBast(akhirBulan(bulan));
    setTglSpkBast(data.spk?.tanggal_spk ?? `${bulan}-01`);
    setDipilih(new Set(mitraAwal ? [Number(mitraAwal)] : data.mitra.map((m) => m.mitra_id)));
  }, [data, bulan, mitraAwal]);
  useEffect(() => setKegiatan(kegiatanAwal ?? ''), [bulan, kegiatanAwal]);

  // SPK: semua mitra bulan ini. BAST: hanya mitra pada kegiatan yang dipilih (atau semua).
  const daftarSpk = data?.mitra ?? [];
  const daftarBast = useMemo(() => (data?.mitra ?? []).filter((m) => !kegiatan || m.kegiatan.includes(Number(kegiatan))), [data, kegiatan]);
  const daftarTab = tab === 'spk' ? daftarSpk : daftarBast;
  const mitraTampil = daftarTab.filter((m) => !q || cocok(m.nama, q));
  const terpilihSpk = daftarSpk.filter((m) => dipilih.has(m.mitra_id));
  const terpilihBast = daftarBast.filter((m) => dipilih.has(m.mitra_id));
  const semuaTerpilih = mitraTampil.length > 0 && mitraTampil.every((m) => dipilih.has(m.mitra_id));
  const honorBast = (m: Pratinjau['mitra'][number]) => m.tugas.filter((t) => !kegiatan || t.kegiatan_id === Number(kegiatan)).reduce((s, t) => s + t.honor, 0);

  const buat = async (jenis: 'spk' | 'bast') => {
    setProses(jenis);
    try {
      const ids = (jenis === 'spk' ? terpilihSpk : terpilihBast).map((m) => m.mitra_id);
      const semua = jenis === 'spk' ? ids.length === daftarSpk.length : ids.length === daftarBast.length;
      const nama = jenis === 'spk'
        ? await unduhFile('/dokumen/spk', { bulan, tanggal_spk: tglSpk, tanggal_mulai: mulai, tanggal_selesai: selesai, mitra_ids: semua ? undefined : ids })
        : await unduhFile('/dokumen/bast', { bulan, tanggal_bast: tglBast, tanggal_spk: tglSpkBast || undefined, kegiatan_id: kegiatan ? Number(kegiatan) : undefined, mitra_ids: semua ? undefined : ids });
      setSelesaiDok(nama);
      setTimeout(() => setSelesaiDok(null), 4000);
      segarkan();
    } catch (e) {
      beritahu('galat', (e as Error).message);
    } finally {
      setProses(null);
    }
  };
  const resetNomor = async () => {
    if (!(await konfirmasi({ judul: 'Atur ulang nomor dokumen?', pesan: `Nomor urut SPK/BAST ${labelBulan(bulan)} akan dihitung ulang dari 1 (urut abjad) saat dokumen dibuat berikutnya.`, tombol: 'Atur ulang' }))) return;
    await api.post('/dokumen/reset-nomor', { bulan });
    segarkan();
    beritahu('sukses', 'Nomor dokumen diatur ulang.');
  };

  return (
    <div>
      <KepalaHalaman judul="SPK & BAST" sub="Dibuat per bulan kegiatan (menurut tanggal pelaksanaan), menggabungkan semua kegiatan mitra di bulan tersebut."
        aksi={<PemilihBulan nilai={bulan} ubah={(b) => setParam({ bulan: b }, { replace: true })} />} />

      {!data ? <Memuat /> : data.mitra.length === 0 ? (
        <Kartu><Kosong ikon={<FileSignature className="size-7" />} judul={`Belum ada mitra dengan honor ${labelBulan(bulan)}`}
          pesan="SPK & BAST dibuat dari kegiatan yang dilaksanakan (tanggal selesai) pada bulan ini. Tambahkan petugas di kegiatan terlebih dahulu."
          aksi={<Link to="/kegiatan"><Tombol>Buka Kegiatan</Tombol></Link>} /></Kartu>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-5">
            <KartuDokumen judul="Surat Perjanjian Kerja (SPK)" ikon={<FileSignature className="size-5" />} warna="from-teal-500 to-emerald-500"
              ket="Satu SPK per mitra, berisi semua kegiatannya di bulan ini. Nomor urut tetap sama walau dibuat ulang.">
              <div className="grid gap-4 sm:grid-cols-3">
                <Kolom label="Tanggal SPK"><PilihTanggal nilai={tglSpk} ubah={setTglSpk} /></Kolom>
                <Kolom label="Jangka waktu mulai"><PilihTanggal nilai={mulai} ubah={setMulai} /></Kolom>
                <Kolom label="Jangka waktu selesai"><PilihTanggal nilai={selesai} min={mulai} ubah={setSelesai} /></Kolom>
              </div>
              <Tombol className="mt-5 h-11 w-full" memuat={proses === 'spk'} disabled={!terpilihSpk.length || !!proses} onClick={() => buat('spk')} onMouseEnter={() => setTab('spk')} ikon={<FileSignature className="size-4" />}>
                Buat SPK untuk {terpilihSpk.length} mitra
              </Tombol>
            </KartuDokumen>

            <KartuDokumen judul="Berita Acara Serah Terima (BAST)" ikon={<FileCheck2 className="size-5" />} warna="from-sky-500 to-indigo-500"
              ket="Nomor BAST mengikuti nomor SPK mitra yang sama. Bisa dibuat per kegiatan atau semua sekaligus.">
              <div className="grid gap-4 sm:grid-cols-3">
                <Kolom label="Tanggal BAST"><PilihTanggal nilai={tglBast} ubah={setTglBast} /></Kolom>
                <Kolom label="Tanggal SPK terkait" petunjuk={data.spk ? 'otomatis dari SPK terakhir' : 'samakan dengan tanggal SPK'}><PilihTanggal nilai={tglSpkBast} ubah={setTglSpkBast} /></Kolom>
                <Kolom label="Kegiatan">
                  <Pilihan nilai={kegiatan} ubah={(v) => { setKegiatan(v); setTab('bast'); }} kosong="Semua kegiatan" opsi={(rekap?.kegiatan ?? []).map((k) => ({ nilai: String(k.id), label: k.nama }))} />
                </Kolom>
              </div>
              <Tombol className="mt-5 h-11 w-full" varian="utama" memuat={proses === 'bast'} disabled={!terpilihBast.length || !!proses || !tglSpkBast} onClick={() => buat('bast')} onMouseEnter={() => setTab('bast')} ikon={<FileCheck2 className="size-4" />}>
                Buat BAST untuk {terpilihBast.length} mitra
              </Tombol>
            </KartuDokumen>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-500">
              <Link to="/pengaturan?tab=template" className="flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"><Settings2 className="size-4" /> Ubah isi surat (template Word)</Link>
              <Link to="/pengaturan?tab=kantor" className="hover:underline">Ubah nama PPK / kantor</Link>
              <Link to="/pengaturan?tab=nomor" className="hover:underline">Ubah format nomor</Link>
              {admin && <button onClick={resetNomor} className="flex items-center gap-1.5 hover:text-stone-700"><RotateCcw className="size-3.5" /> Atur ulang nomor bulan ini</button>}
            </div>
          </div>

          <Kartu className="flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden xl:sticky xl:top-8">
            <div className="border-b border-stone-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-stone-900"><Users className="size-4 text-brand-600" /> Pratinjau mitra</h3>
                <Kotak aktif={semuaTerpilih} ubah={(v) => setDipilih(v ? new Set([...dipilih, ...mitraTampil.map((m) => m.mitra_id)]) : new Set([...dipilih].filter((id) => !mitraTampil.some((m) => m.mitra_id === id))))} label={<span className="text-xs font-semibold">Semua</span>} />
              </div>
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
                {(['spk', 'bast'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTab(t)}
                    className={cx('relative rounded-lg py-1.5 text-sm font-bold transition-colors', tab === t ? 'text-stone-900' : 'text-stone-500 hover:text-stone-800')}>
                    {tab === t && <motion.span layoutId="tab-pratinjau" transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="absolute inset-0 rounded-lg bg-white shadow-sm" />}
                    <span className="relative">{t.toUpperCase()} <span className="text-xs font-semibold text-stone-400">({t === 'spk' ? terpilihSpk.length : terpilihBast.length})</span></span>
                  </button>
                ))}
              </div>
              {tab === 'bast' && (
                <p className="mb-2 text-xs text-stone-500">{kegiatan ? <>Kegiatan: <b>{rekap?.kegiatan.find((x) => String(x.id) === kegiatan)?.nama}</b></> : 'Semua kegiatan bulan ini'} · ubah di kartu BAST</p>
              )}
              <KotakCari nilai={q} ubah={setQ} placeholder="Cari mitra…" />
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
            <motion.ul key={tab + kegiatan} initial={{ opacity: 0, x: tab === 'bast' ? 16 : -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="scroll-tipis flex-1 divide-y divide-stone-50 overflow-y-auto">
              {mitraTampil.map((m) => {
                const aktif = dipilih.has(m.mitra_id);
                return (
                  <li key={m.mitra_id}>
                    <button onClick={() => setDipilih((s) => { const n = new Set(s); aktif ? n.delete(m.mitra_id) : n.add(m.mitra_id); return n; })}
                      className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-left transition', aktif ? 'bg-brand-50/40' : 'opacity-60 hover:opacity-100')}>
                      <Kotak aktif={aktif} ubah={() => {}} />
                      <Avatar nama={m.nama} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-stone-800">{m.nama}</div>
                        <div className="truncate text-xs text-stone-400">
                          {tab === 'spk'
                            ? <>{m.nomor_spk ? `No. ${m.nomor_spk}` : 'nomor baru'} · {m.jumlah_tugas} tugas</>
                            : <>{m.nomor_bast ? `No. ${m.nomor_bast}` : 'nomor baru'} · {kegiatan ? m.tugas.find((t) => t.kegiatan_id === Number(kegiatan))?.peran : `${m.jumlah_tugas} tugas`}</>}
                        </div>
                      </div>
                      <span className="angka text-xs font-semibold text-stone-500">{rupiah(tab === 'spk' ? m.total : honorBast(m))}</span>
                    </button>
                  </li>
                );
              })}
              {mitraTampil.length === 0 && <li className="px-4 py-8 text-center text-sm text-stone-400">Tidak ada mitra.</li>}
            </motion.ul>
            </AnimatePresence>
            <p className="border-t border-stone-100 px-4 py-2 text-[11px] text-stone-400">Nomor urut sama untuk SPK & BAST, berulang dari 1 setiap bulan. "Nomor baru" diberikan saat dokumen dibuat.</p>
          </Kartu>
        </div>
      )}

      <AnimatePresence>
        {selesaiDok && (
          <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit items-center gap-3 rounded-2xl bg-stone-900 px-5 py-3.5 text-white shadow-melayang lg:bottom-8">
            <motion.span initial={{ rotate: -90, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}><CheckCircle2 className="size-6 text-emerald-400" /></motion.span>
            <div><div className="text-sm font-bold">Dokumen siap!</div><div className="text-xs text-stone-300">{selesaiDok} — cek folder Unduhan</div></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KartuDokumen({ judul, ket, ikon, warna, children }: { judul: string; ket: string; ikon: ReactNode; warna: string; children: ReactNode }) {
  return (
    <Kartu className="p-4 sm:p-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-5 flex gap-4">
        <div className={cx('grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-sm', warna)}>{ikon}</div>
        <div><h2 className="font-bold text-stone-900">{judul}</h2><p className="text-sm text-stone-500">{ket}</p></div>
      </div>
      {children}
    </Kartu>
  );
}
