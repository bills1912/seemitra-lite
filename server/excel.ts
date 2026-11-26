/** Bantuan membaca & membuat file Excel (.xlsx). */
import ExcelJS from 'exceljs';
import { GagalError } from './util.ts';

export type Kolom = { judul: string; kunci: string; lebar?: number; uang?: boolean };

export async function buatExcel(namaSheet: string, kolom: Kolom[], baris: Record<string, unknown>[], judul?: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Seemitra Lite';
  const ws = wb.addWorksheet(namaSheet.slice(0, 31));
  let mulai = 1;
  if (judul) {
    ws.getCell(1, 1).value = judul;
    ws.getCell(1, 1).font = { bold: true, size: 13 };
    mulai = 3;
  }
  kolom.forEach((k, i) => {
    const sel = ws.getCell(mulai, i + 1);
    sel.value = k.judul;
    sel.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    sel.alignment = { vertical: 'middle', wrapText: true };
    ws.getColumn(i + 1).width = k.lebar ?? 18;
    if (k.uang) ws.getColumn(i + 1).numFmt = '"Rp"#,##0';
  });
  baris.forEach((b, r) => {
    kolom.forEach((k, i) => {
      const v = b[k.kunci];
      ws.getCell(mulai + 1 + r, i + 1).value = (v ?? '') as ExcelJS.CellValue;
    });
  });
  ws.views = [{ state: 'frozen', ySplit: mulai }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Membaca teks CSV (pemisah koma, titik koma, atau tab — dideteksi otomatis). */
function bacaCsv(teks: string): string[][] {
  teks = teks.replace(/^﻿/, '');
  const barisPertama = teks.split(/\r?\n/, 1)[0] ?? '';
  const hitung = (c: string) => barisPertama.split(c).length;
  const pemisah = [';', '\t', ','].reduce((a, b) => (hitung(b) > hitung(a) ? b : a), ',');
  const hasil: string[][] = [];
  let baris: string[] = [], sel = '', kutip = false;
  for (let i = 0; i < teks.length; i++) {
    const ch = teks[i];
    if (kutip) {
      if (ch === '"' && teks[i + 1] === '"') { sel += '"'; i++; }
      else if (ch === '"') kutip = false;
      else sel += ch;
    } else if (ch === '"') kutip = true;
    else if (ch === pemisah) { baris.push(sel); sel = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && teks[i + 1] === '\n') i++;
      baris.push(sel); hasil.push(baris); baris = []; sel = '';
    } else sel += ch;
  }
  if (sel || baris.length) { baris.push(sel); hasil.push(baris); }
  return hasil;
}

/** Membaca sheet pertama Excel (.xlsx) menjadi tabel teks. */
async function bacaXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const hasil: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const isi: string[] = [];
    for (let c = 1; c <= Math.max(ws.columnCount, row.cellCount); c++) isi.push(String(row.getCell(c).text ?? '').trim());
    hasil.push(isi);
  }
  return hasil;
}

/**
 * Membaca file Excel (.xlsx) atau CSV (.csv) lalu mengembalikan baris berupa objek { kunci: nilai }
 * sesuai peta judul kolom. Baris judul dicari otomatis pada 10 baris pertama.
 */
export async function bacaExcel(buf: ArrayBuffer, peta: Record<string, string[]>, namaFile = '') {
  const awal = new Uint8Array(buf.slice(0, 8));
  const zip = awal[0] === 0x50 && awal[1] === 0x4b; // .xlsx = arsip zip "PK"
  const xlsLama = awal[0] === 0xd0 && awal[1] === 0xcf;
  if (xlsLama) throw new GagalError('Format .xls (Excel lama) belum didukung. Buka file di Excel lalu "Simpan Sebagai" format .xlsx atau .csv.');
  let tabel: string[][];
  if (zip) {
    try { tabel = await bacaXlsx(buf); }
    catch { throw new GagalError('File Excel tidak dapat dibaca. Pastikan file tidak rusak dan berformat .xlsx.'); }
  } else if (/\.(csv|txt|tsv)$/i.test(namaFile) || !namaFile) {
    tabel = bacaCsv(new TextDecoder('utf-8').decode(buf));
  } else {
    throw new GagalError('Format file tidak dikenali. Gunakan file Excel (.xlsx) atau CSV (.csv).');
  }

  // cari baris judul
  let barisJudul = -1;
  let indeks: Record<string, number> = {};
  for (let r = 0; r < Math.min(10, tabel.length); r++) {
    const ketemu: Record<string, number> = {};
    tabel[r].forEach((sel, c) => {
      const t = normal(sel);
      for (const [kunci, alias] of Object.entries(peta)) if (!(kunci in ketemu) && alias.some((a) => normal(a) === t)) ketemu[kunci] = c;
    });
    if (Object.keys(ketemu).length > Object.keys(indeks).length) {
      indeks = ketemu;
      barisJudul = r;
      if (Object.keys(ketemu).length >= 2) break;
    }
  }
  if (barisJudul < 0) return [];
  const hasil: Record<string, string>[] = [];
  for (let r = barisJudul + 1; r < tabel.length; r++) {
    const obj: Record<string, string> = {};
    let ada = false;
    for (const [kunci, c] of Object.entries(indeks)) {
      const v = (tabel[r][c] ?? '').trim();
      if (v) ada = true;
      obj[kunci] = v;
    }
    if (ada) hasil.push(obj);
  }
  return hasil;
}
