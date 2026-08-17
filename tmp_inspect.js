const XLSX = require('xlsx');
const path = require('path');
const fp = path.resolve(__dirname, 'src', 'data', 'sector_externo', 'raw', 'balanza_pagos_20260605.xls');
console.log('File:', fp);
const wb = XLSX.readFile(fp, { cellDates: true });
console.log('Sheets:', wb.SheetNames);
const sheetName = wb.SheetNames.find(n => /Cuadro 3/i.test(n)) || wb.SheetNames[3] || wb.SheetNames[0];
console.log('Using sheet:', sheetName);
const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
console.log('Rows:', data.length);
for (let i = 0; i < Math.min(30, data.length); i++) {
  console.log(i, data[i].slice(0, 10));
}
