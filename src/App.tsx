import { Route, Routes } from 'react-router';
import { motion } from 'motion/react';
import { useSaya } from './lib/hooks';
import { Tata } from './components/Tata';
import { Masuk } from './pages/Masuk';
import { Beranda } from './pages/Beranda';
import { HalamanMitra } from './pages/Mitra';
import { HalamanKegiatan } from './pages/Kegiatan';
import { DetailKegiatan } from './pages/DetailKegiatan';
import { Rekap } from './pages/Rekap';
import { Dokumen } from './pages/Dokumen';
import { HalamanPengaturan } from './pages/Pengaturan';
import { Panduan } from './pages/Panduan';
import { Kosong, Tombol } from './components/ui';
import { Compass } from 'lucide-react';
import { Link } from 'react-router';

export default function App() {
  const { data, isLoading } = useSaya();
  if (isLoading || !data)
    return (
      <div className="grid min-h-dvh place-items-center">
        <motion.img src="/logo.svg" className="size-14" animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} />
      </div>
    );
  if (!data.pengguna) return <Masuk setup={data.perluSetup} />;
  return (
    <Tata pengguna={data.pengguna}>
      <Routes>
        <Route path="/" element={<Beranda />} />
        <Route path="/mitra" element={<HalamanMitra />} />
        <Route path="/kegiatan" element={<HalamanKegiatan />} />
        <Route path="/kegiatan/:id" element={<DetailKegiatan />} />
        <Route path="/rekap" element={<Rekap />} />
        <Route path="/dokumen" element={<Dokumen />} />
        <Route path="/pengaturan" element={<HalamanPengaturan />} />
        <Route path="/panduan" element={<Panduan />} />
        <Route path="*" element={<Kosong ikon={<Compass className="size-7" />} judul="Halaman tidak ditemukan" aksi={<Link to="/"><Tombol>Kembali ke Beranda</Tombol></Link>} />} />
      </Routes>
    </Tata>
  );
}
