import path from 'path';
import XLSX from 'xlsx';
import fs from 'fs';

const fileArg = process.argv[2];
const filePath = fileArg || path.resolve('raw/indec/ipc/sh_ipc_02_26.xls');

if (!fs.existsSync(filePath)) {
  console.error('Archivo no encontrado:', filePath);
  process.exit(1);
}

const wb = XLSX.readFile(filePath, { cellDates: true });
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('Archivo:', filePath);
console.log('Hoja:', sheetName);
console.log('Filas totales:', data.length);
console.log('--- Primeras 80 filas (index: contenido) ---');

for (let i = 0; i < Math.min(80, data.length); i++) {
  const row = data[i];
  const display = row.map((c) => (c === '' ? '""' : String(c))).join(' | ');
  console.log(`${String(i).padStart(3, '0')}: ${display}`);
}

process.exit(0);
