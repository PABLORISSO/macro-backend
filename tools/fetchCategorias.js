const http = require('http');
http.get('http://localhost:3000/api/inflacion/categorias', (res) => {
  console.log('status', res.statusCode);
  let body = '';
  res.on('data', (c) => body += c.toString());
  res.on('end', () => {
    console.log('body:', body.slice(0,1000));
  });
}).on('error', (e) => console.error('err', e.message));
