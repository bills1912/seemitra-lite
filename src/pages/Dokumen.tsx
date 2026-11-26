import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, FileCheck2, FileSignature, RotateCcw, Settings2, Users } from 'lucide-react';
import { api, segarkan, unduhFile } from '../lib/api';
import { useUmpan } from '../components/umpan';
import { Pilihan, PilihTanggal } from '../components/pemilih';
import { Avatar, KepalaHalaman, Kartu, Kolom, Kosong, Kotak, KotakCari, Memuat, PemilihBulan, Tombol, cx } from '../components/ui';
import { akhirBulan, bulanIni, cocok, labelBulan, rupiah } from '../lib/format';

type Pratinjau = {
  bulan: string;
  spk: { tanggal_spk: string; tanggal_mulai: string; tanggal_selesai: string } | null;
  mitra: { mitra_id: number; nama: string; total: number; jumlah_tugas: number; kegiatan: number[]; urut: number | null; nomor_spk: string | null }[];
};

export function Dokumen() {
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

  const mitraTampil = useMemo(() => (data?.mitra ?? []).filter((m) => (!kegiatan || m.kegiatan.includes(Number(kegiatan))) && (!q || cocok(m.nama, q))), [data, kegiatan, q]);
  const terpilih = mitraTampil.filter((m) => dipilih.has(m.mitra_id));
  const semuaTerpilih = !!data && terpilih.length === mitraTampil.length;

  const buat = async (jenis: 'spk' | 'bast') => {
    setProses(jenis);
    try {
      const ids = terpilih.map((m) => m.mitra_id);
      const semua = ids.length === (data?.mitra.length ?? 0);
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
      <KepalaHalaman judul="SPK & BAST" sub="Buat Surat Perjanjian Kerja dan Berita Acara Serah Terima otomatis dalam format Word."
        aksi={<PemilihBulan nilai={bulan} ubah={(b) => setParam({ bulan: b }, { replace: true })} />} />

      {!data ? <Memuat /> : data.mitra.length === 0 ? (
        <Kartu><Kosong ikon={<FileSignature className="size-7" />} judul={`Belum ada mitra dengan honor ${labelBulan(bulan)}`}
          pesan="SPK & BAST dibuat dari kegiatan yang bulan honornya sama dengan bulan ini. Tambahkan petugas di kegiatan terlebih dahulu."
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
              <Tombol className="mt-5 h-11 w-full" memuat={proses === 'spk'} disabled={!terpilih.length || !!proses} onClick={() => buat('spk')} ikon={<FileSignature className="size-4" />}>
                Buat SPK untuk {terpilih.length} mitra
              </Tombol>
            </KartuDokumen>

            <KartuDokumen judul="Berita Acara Serah Terima (BAST)" ikon={<FileCheck2 className="size-5" />} warna="from-sky-500 to-indigo-500"
              ket="Nomor BAST mengikuti nomor SPK mitra yang sama. Bisa dibuat per kegiatan atau semua sekaligus.">
              <div className="grid gap-4 sm:grid-cols-3">
                <Kolom label="Tanggal BAST"><PilihTanggal nilai={tglBast} ubah={setTglBast} /></Kolom>
                <Kolom label="Tanggal SPK terkait" petunjuk={data.spk ? 'otomatis dari SPK terakhir' : 'samakan dengan tanggal SPK'}><PilihTanggal nilai={tglSpkBast} ubah={setTglSpkBast} /></Kolom>
                <Kolom label="Kegiatan">
                  <Pilihan nilai={kegiatan} ubah={setKegiatan} kosong="Semua kegiatan" opsi={(rekap?.kegiatan ?? []).map((k) => ({ nilai: String(k.id), label: k.nama }))} />
                </Kolom>
              </div>
              <Tombol className="mt-5 h-11 w-full" varian="utama" memuat={proses === 'bast'} disabled={!terpilih.length || !!proses || !tglSpkBast} onClick={() => buat('bast')} ikon={<FileCheck2 className="size-4" />}>
                Buat BAST untuk {terpilih.length} mitra
              </Tombol>
            </KartuDokumen>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-500">
              <Link to="/pengaturan?tab=template" className="flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"><Settings2 className="size-4" /> Ubah isi surat (template Word)</Link>
              <Link to="/pengaturan?tab=kantor" className="hover:underline">Ubah nama PPK / kantor</Link>
              <Link to="/pengaturan?tab=nomor" className="hover:underline">Ubah format nomor</Link>
              <button onClick={resetNomor} className="flex items-center gap-1.5 hover:text-stone-700"><RotateCcw className="size-3.5" /> Atur ulang nomor bulan ini</button>
            </div>
          </div>

          <Kartu className="flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden xl:sticky xl:top-8">
            <div className="border-b border-stone-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-stone-900"><Users className="size-4 text-brand-600" /> Mitra yang dibuatkan</h3>
                <Kotak aktif={semuaTerpilih} ubah={(v) => setDipilih(v ? new Set([...dipilih, ...mitraTampil.map((m) => m.mitra_id)]) : new Set([...dipilih].filter((id) => !mitraTampil.some((m) => m.mitra_id === id))))} label={<span className="text-xs font-semibold">Semua</span>} />
              </div>
              <KotakCari nilai={q} ubah={setQ} placeholder="Cari mitra…" />
            </div>
            <ul className="scroll-tipis flex-1 divide-y divide-stone-50 overflow-y-auto">
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
                        <div className="truncate text-xs text-stone-400">{m.nomor_spk ? `No. ${m.nomor_spk}` : 'nomor baru'} · {m.jumlah_tugas} tugas</div>
                      </div>
                      <span className="angka text-xs font-semibold text-stone-500">{rupiah(m.total)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
    <Kartu className="p-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-5 flex gap-4">
        <div className={cx('grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-sm', warna)}>{ikon}</div>
        <div><h2 className="font-bold text-stone-900">{judul}</h2><p className="text-sm text-stone-500">{ket}</p></div>
      </div>
      {children}
    </Kartu>
  );
}
