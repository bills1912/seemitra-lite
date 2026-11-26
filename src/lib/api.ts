/** Penghubung ke server. Semua permintaan data lewat fungsi-fungsi di sini. */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: true, retry: 1 } },
});

export class ApiError extends Error {
  status: number;
  constructor(pesan: string, status: number) {
    super(pesan);
    this.status = status;
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
    try {
      pesan = (await res.json()).pesan ?? pesan;
    } catch { /* bukan JSON */ }
    if (res.status === 401 && !url.startsWith('/auth')) queryClient.setQueryData(['saya'], { pengguna: null, perluSetup: false });
    throw new ApiError(pesan, res.status);
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

/** Mengunduh file (Excel / Word) dari server. */
export async function unduhFile(url: string, body?: unknown) {
  const res = await fetch('/api' + url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let pesan = 'Gagal mengunduh file';
    try { pesan = (await res.json()).pesan ?? pesan; } catch { /* */ }
    throw new ApiError(pesan, res.status);
  }
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
  const nama = m ? decodeURIComponent(m[1]) : 'unduhan';
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return nama;
}

export const kirimFile = <T>(url: string, file: File, extra?: Record<string, string>) => {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(extra ?? {})) fd.append(k, v);
  return minta<T>('POST', url, fd);
};
