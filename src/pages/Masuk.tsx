import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, Hourglass, LogIn, Sparkles, UserPlus } from 'lucide-react';
import { api, queryClient } from '../lib/api';
import { Kolom, Masukan, Tombol, cx } from '../components/ui';

type Mode = 'masuk' | 'daftar' | 'terkirim';

/**
 * Halaman masuk & pendaftaran.
 * - Selalu dibuka di halaman MASUK; ada tautan ke halaman DAFTAR.
 * - Pendaftar pertama (saat aplikasi masih kosong) otomatis menjadi admin.
 * - Pendaftar berikutnya menunggu persetujuan admin.
 */
export function Masuk({ setup }: { setup: boolean }) {
  const [mode, setMode] = useState<Mode>('masuk');
  const [f, setF] = useState({ nama: '', username: '', sandi: '', ulang: '' });
  const [lihat, setLihat] = useState(false);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [goyang, setGoyang] = useState(0);

  const ganti = (m: Mode) => { setMode(m); setGalat(''); setF((x) => ({ ...x, sandi: '', ulang: '' })); };

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    setGalat('');
    if (mode === 'daftar' && f.sandi !== f.ulang) { setGalat('Kata sandi dan ulangan kata sandi belum sama.'); setGoyang((g) => g + 1); return; }
    setMemuat(true);
    try {
      if (mode === 'masuk') {
        await api.post('/auth/masuk', { username: f.username, sandi: f.sandi });
        await queryClient.invalidateQueries({ queryKey: ['saya'] });
      } else {
        const r = await api.post<{ ok: boolean; masuk: boolean }>('/auth/daftar', { nama: f.nama, username: f.username, sandi: f.sandi });
        if (r.masuk) await queryClient.invalidateQueries({ queryKey: ['saya'] });
        else ganti('terkirim');
      }
    } catch (err) {
      setGalat((err as Error).message);
      setGoyang((g) => g + 1);
    } finally {
      setMemuat(false);
    }
  };

  const kolomSandi = (kunci: 'sandi' | 'ulang', label: string, petunjuk?: string) => (
    <Kolom label={label} wajib petunjuk={petunjuk}>
      <div className="relative">
        <Masukan type={lihat ? 'text' : 'password'} autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'}
          value={f[kunci]} onChange={(e) => setF({ ...f, [kunci]: e.target.value })} className="pr-11" />
        <button type="button" tabIndex={-1} onClick={() => setLihat(!lihat)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
          {lihat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Kolom>
  );

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <motion.div className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-brand-200/50 blur-3xl" animate={{ x: [0, 60, 0], y: [0, 40, 0] }} transition={{ duration: 16, repeat: Infinity }} />
      <motion.div className="absolute -bottom-40 -right-20 size-[30rem] rounded-full bg-amber-200/40 blur-3xl" animate={{ x: [0, -50, 0], y: [0, -30, 0] }} transition={{ duration: 18, repeat: Infinity }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }} className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.img src="/logo.svg" className="mb-4 size-16" initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }} />
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">Seemitra <span className="text-brand-600">Lite</span></h1>
          <p className="mt-1 text-stone-500">Administrasi kegiatan mitra statistik</p>
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/80 p-7 shadow-melayang backdrop-blur-xl">
          {mode === 'terkirim' ? (
            <motion.div key="terkirim" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <motion.div initial={{ rotate: -30, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
                className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Hourglass className="size-7" /></motion.div>
              <h2 className="text-lg font-bold text-stone-900">Pendaftaran terkirim</h2>
              <p className="mt-1.5 text-sm text-stone-500">Akun <b>{f.username}</b> sudah dibuat dan sedang menunggu persetujuan admin. Setelah disetujui, Anda bisa masuk dengan username dan kata sandi yang tadi dibuat.</p>
              <Tombol className="mt-6 w-full" onClick={() => ganti('masuk')} ikon={<ArrowLeft className="size-4" />}>Kembali ke halaman masuk</Tombol>
            </motion.div>
          ) : (
            <motion.form key={mode + goyang} initial={goyang ? false : { opacity: 0, x: mode === 'daftar' ? 24 : -24 }} animate={goyang ? { x: [0, -10, 10, -6, 6, 0] } : { opacity: 1, x: 0 }}
              transition={{ duration: goyang ? 0.4 : 0.25 }} onSubmit={kirim} className="space-y-4">
              <div className="mb-1">
                <h2 className="text-xl font-bold text-stone-900">{mode === 'masuk' ? 'Masuk' : 'Daftar akun baru'}</h2>
                <p className="text-sm text-stone-500">{mode === 'masuk' ? 'Gunakan username dan kata sandi Anda.' : setup ? 'Akun pertama otomatis menjadi admin.' : 'Akun baru aktif setelah disetujui admin.'}</p>
              </div>

              {setup && mode === 'masuk' && (
                <div className="flex gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">
                  <Sparkles className="size-5 shrink-0" />
                  <p>Aplikasi ini belum memiliki akun. <button type="button" onClick={() => ganti('daftar')} className="font-bold underline">Daftar sekarang</button> untuk membuat akun admin pertama.</p>
                </div>
              )}

              {mode === 'daftar' && (
                <Kolom label="Nama lengkap" wajib>
                  <Masukan autoFocus value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="mis. Bill Zalukhu" />
                </Kolom>
              )}
              <Kolom label="Username" wajib petunjuk={mode === 'daftar' ? 'Huruf/angka tanpa spasi, mis. bill.z' : undefined}>
                <Masukan autoFocus={mode === 'masuk'} autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
              </Kolom>
              {kolomSandi('sandi', 'Kata sandi', mode === 'daftar' ? 'Minimal 6 karakter' : undefined)}
              {mode === 'daftar' && kolomSandi('ulang', 'Ulangi kata sandi')}

              {galat && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{galat}</motion.p>}

              <Tombol type="submit" memuat={memuat} ikon={mode === 'masuk' ? <LogIn className="size-4" /> : <UserPlus className="size-4" />} className="h-11 w-full text-[15px]">
                {mode === 'masuk' ? 'Masuk' : 'Daftar'}
              </Tombol>

              <p className={cx('pt-1 text-center text-sm text-stone-500')}>
                {mode === 'masuk'
                  ? <>Belum punya akun? <button type="button" onClick={() => ganti('daftar')} className="font-bold text-brand-700 hover:underline">Daftar di sini</button></>
                  : <>Sudah punya akun? <button type="button" onClick={() => ganti('masuk')} className="font-bold text-brand-700 hover:underline">Masuk</button></>}
              </p>
            </motion.form>
          )}
        </div>
        {mode === 'masuk' && <p className="mt-5 text-center text-xs text-stone-400">Lupa kata sandi? Minta admin mengatur ulang dari menu Pengaturan → Pengguna.</p>}
      </motion.div>
    </div>
  );
}
