const c = require('../src/controllers/inflationController');
(async ()=>{
  const res = { json: (d) => console.log(JSON.stringify(d, null, 2)) };
  await c.getInflacionRegiones({}, res);
})();
