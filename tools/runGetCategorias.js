const { getInflacionCategorias } = require('../src/controllers/inflationController');

const req = {};
const res = {
  status(code) { this.code = code; return this; },
  json(obj) { console.log('json result keys:', Object.keys(obj).slice(0,10)); console.log('labels count:', (obj.labels||[]).length); },
};

getInflacionCategorias(req, res).catch(e => console.error('error', e.message));
