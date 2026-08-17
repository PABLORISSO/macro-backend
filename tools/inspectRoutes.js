const r = require('../src/routes/inflationRoute');
console.log((r.stack || []).map(s => s.route ? (s.route.path + ' [' + Object.keys(s.route.methods).join(',') + ']') : s.name));
