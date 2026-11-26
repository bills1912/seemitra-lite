import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn, Sparkles } from 'lucide-react';
import { api, queryClient } from '../lib/api';
import { Kolom, Masukan, Tombol } from '../components/ui';

/** Halaman masuk. Bila belum ada pengguna sama sekali, tampil formulir pembuatan admin pertama. */
export function Masuk({ setup }: { setup: boolean }) {
  const [f, setF] = useState({ nama: '', username: '', sandi: '' });
  const [lihat, setLihat] = useState(false);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [goyang, setGoyang] = useState(0);

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    setGalat('');
    setMemuat(true);
    try {
      await api.post(setup ? '/auth/setup' : '/auth/masuk', f);
      await queryClient.invalidateQueries({ queryKey: ['saya'] });
    } catch (err) {
      setGalat((err as Error).message);
      setGoyang((g) => g + 1);
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      {/* latar lembut bergerak */}
      <motion.div className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-brand-200/50 blur-3xl" animate={{ x: [0, 60, 0], y: [0, 40, 0] }} transition={{ duration: 16, repeat: Infinity }} />
      <motion.div className="absolute -bottom-40 -right-20 size-[30rem] rounded-full bg-amber-200/40 blur-3xl" animate={{ x: [0, -50, 0], y: [0, -30, 0] }} transition={{ duration: 18, repeat: Infinity }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }} className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.img src="/logo.svg" className="mb-4 size-16" initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }} />
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">Seemitra <span className="text-brand-600">Lite</span></h1>
          <p className="mt-1 text-stone-500">Administrasi kegiatan mitra statistik</p>
        </div>
        <motion.form key={goyang} animate={goyang ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} onSubmit={kirim}
          className="space-y-4 rounded-3xl border border-white/60 bg-white/80 p-7 shadow-melayang backdrop-blur-xl">
          {setup && (
            <div className="flex gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">
              <Sparkles className="size-5 shrink-0" />
              <p><b>Selamat datang!</b> Buat akun admin pertama. Akun lain dapat ditambahkan nanti dari menu Pengaturan.</p>
            </div>
          )}
          {setup && (
            <Kolom label="Nama lengkap" wajib>
              <Masukan autoFocus value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="mis. Bill Zalukhu" />
            </Kolom>
          )}
          <Kolom label="Username" wajib>
            <Masukan autoFocus={!setup} autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="mis. admin" />
          </Kolom>
          <Kolom label="Kata sandi" wajib petunjuk={setup ? 'Minimal 6 karakter. Simpan baik-baik.' : undefined}>
            <div className="relative">
              <Masukan type={lihat ? 'text' : 'password'} autoComplete={setup ? 'new-password' : 'current-password'} value={f.sandi} onChange={(e) => setF({ ...f, sandi: e.target.value })} className="pr-11" />
              <button type="button" onClick={() => setLihat(!lihat)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
                {lihat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Kolom>
          {galat && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{galat}</motion.p>}
          <Tombol type="submit" memuat={memuat} ikon={<LogIn className="size-4" />} className="h-11 w-full text-[15px]">
            {setup ? 'Buat akun & mulai' : 'Masuk'}
          </Tombol>
        </motion.form>
        {!setup && <p className="mt-5 text-center text-xs text-stone-400">Lupa kata sandi? Minta admin mengatur ulang dari menu Pengaturan → Pengguna.</p>}
      </motion.div>
    </div>
  );
}
