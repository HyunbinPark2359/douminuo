const https = require('https');
function post(path, bodyObj) {
  const data = JSON.stringify(bodyObj);
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'smartnuo.com',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Accept: 'application/json',
          Origin: 'https://smartnuo.com',
          Referer: 'https://smartnuo.com/',
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode, buf }));
      }
    );
    req.write(data);
    req.end();
  });
}
(async () => {
  const shapes = [
    { params: { keyword: 'tackle', type: 0 } },
    { params: { keyword: 'tackle', type: 1 } },
    { data: { params: { keyword: 'tackle', type: 0 } } },
    { body: { params: { keyword: 'tackle', type: 0 } } },
    { request: { params: { keyword: 'tackle', type: 0 } } },
  ];
  for (const s of shapes) {
    const r = await post('/api/move/select/search', s);
    const preview = r.buf.slice(0, 300).replace(/\s+/g, ' ');
    console.log(JSON.stringify(s).slice(0, 80), '->', r.status, preview);
  }
})();
