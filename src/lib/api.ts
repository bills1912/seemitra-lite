/** Penghubung ke server. Semua permintaan data lewat fungsi-fungsi di sini. */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: true, retry: 1 } },
});

export class ApiError extends Error {
  status: number;
  /** isi lengkap balasan galat dari server (mis. daftar baris bermasalah) */
  data: Record<string, unknown> | undefined;
  constructor(pesan: string, status: number, data?: Record<string, unknown>) {
    super(pesan);
    this.status = status;
    this.data = data;
  }
}

async function minta<T>(metode: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch('/api' + url, {
    method: metode,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let pesan = `Gagal (${res.status})`;
    let data: Record<string, unknown> | undefined;
    try {
      data = await res.json();
      pesan = (data?.pesan as string) ?? pesan;
    } catch { /* bukan JSON */ }
    if (res.status === 401 && !url.startsWith('/auth')) {
      // sesi berakhir: tampilkan halaman masuk, lalu ambil ulang konfigurasi masuk (kunci Turnstile dsb.) dari server
      queryClient.setQueryData(['saya'], (lama: Record<string, unknown> | undefined) => ({ ...(lama ?? {}), pengguna: null, perluSetup: false }));
      void queryClient.invalidateQueries({ queryKey: ['saya'] });
    }
    throw new ApiError(pesan, res.status, data);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => minta<T>('GET', url),
  post: <T = { ok: boolean }>(url: string, body?: unknown) => minta<T>('POST', url, body ?? {}),
  put: <T = { ok: boolean }>(url: string, body?: unknown) => minta<T>('PUT', url, body ?? {}),
  del: <T = { ok: boolean }>(url: string) => minta<T>('DELETE', url),
};

/** Setelah data berubah, segarkan semua tampilan agar saling sinkron. */
export const segarkan = () => queryClient.invalidateQueries();

/**
 * Mengunduh file (Excel / Word / cadangan) dari server.
 * Langkah 1: server menyiapkan file (galat ditampilkan sebagai pesan bila gagal).
 * Langkah 2: browser mengunduh langsung dari alamat yang diberikan server — unduhan biasa,
 * sehingga tidak gagal walau jendela "Simpan sebagai" dibiarkan terbuka lama.
 */
export async function unduhFile(url: string, body?: unknown) {
  const res = await fetch('/api' + url, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Siapkan': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let pesan = 'Gagal menyiapkan file';
    try { pesan = (await res.json()).pesan ?? pesan; } catch { /* */ }
    throw new ApiError(pesan, res.status);
  }
  const { url: alamat, nama } = (await res.json()) as { url: string; nama: string };
  const a = document.createElement('a');
  a.href = alamat;
  a.download = nama;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return nama;
}

export const kirimFile = <T>(url: string, file: File, extra?: Record<string, string>) => {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(extra ?? {})) fd.append(k, v);
  return minta<T>('POST', url, fd);
};
