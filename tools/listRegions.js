const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/data/ipc/ipc_aperturas_largo.csv');
const content = fs.readFileSync(filePath,'utf8');
const lines = content.split(/\r?\n/).filter(Boolean).slice(1);
const regions = new Set();
for(const line of lines){
  const parts = line.split(',');
  regions.add(parts[1]);
}
console.log([...regions].slice(0,200));
console.log('total regions:', regions.size);
