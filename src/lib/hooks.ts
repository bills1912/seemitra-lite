import { useMutation, useQuery } from '@tanstack/react-query';
import { api, segarkan } from './api';
import type { Pengaturan, Pengguna } from './types';
import { useUmpan } from '../components/umpan';

export const useSaya = () =>
  useQuery({ queryKey: ['saya'], queryFn: () => api.get<{ pengguna: Pengguna | null; perluSetup: boolean }>('/auth/saya'), staleTime: Infinity });

export const usePengaturan = () => useQuery({ queryKey: ['pengaturan'], queryFn: () => api.get<Pengaturan>('/pengaturan'), staleTime: 60_000 });

/** Membungkus aksi simpan/hapus: tampilkan pesan sukses/gagal lalu segarkan data. */
export function useAksi<A, R = unknown>(fn: (a: A) => Promise<R>, opsi?: { sukses?: string | ((r: R, a: A) => string); setelah?: (r: R, a: A) => void }) {
  const { beritahu } = useUmpan();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, a) => {
      segarkan();
      const s = typeof opsi?.sukses === 'function' ? opsi.sukses(r, a) : opsi?.sukses;
      if (s) beritahu('sukses', s);
      opsi?.setelah?.(r, a);
    },
    onError: (e) => beritahu('galat', (e as Error).message),
  });
}
