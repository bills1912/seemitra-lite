/** Bantuan membaca & membuat file Excel (.xlsx). */
import ExcelJS from 'exceljs';

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

/** Membaca sheet pertama; mengembalikan baris berupa objek { kunci: nilai } sesuai peta judul kolom. */
export async function bacaExcel(buf: ArrayBuffer, peta: Record<string, string[]>) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  // cari baris judul: baris pertama (dari 1..10) yang memuat salah satu judul yang dikenal
  let barisJudul = 1;
  const indeks: Record<string, number> = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const ketemu: Record<string, number> = {};
    row.eachCell((cell, col) => {
      const t = normal(String(cell.text ?? ''));
      for (const [kunci, alias] of Object.entries(peta)) if (alias.some((a) => normal(a) === t)) ketemu[kunci] = col;
    });
    if (Object.keys(ketemu).length >= 1 && Object.keys(ketemu).length >= Object.keys(indeks).length) {
      Object.assign(indeks, ketemu);
      barisJudul = r;
      if (Object.keys(ketemu).length >= 2) break;
    }
  }
  const hasil: Record<string, string>[] = [];
  for (let r = barisJudul + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, string> = {};
    let ada = false;
    for (const [kunci, col] of Object.entries(indeks)) {
      const v = row.getCell(col).text?.toString().trim() ?? '';
      if (v) ada = true;
      obj[kunci] = v;
    }
    if (ada) hasil.push(obj);
  }
  return hasil;
}
