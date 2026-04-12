/**
 * 스마트누오 이름 검색 API 실험 (2026-04 기준)
 *
 * 프론트 번들(Common.*.js)에 다음이 존재함:
 *   POST /api/move/select/search     body: { params: { keyword, type } }  → 행에 kr, en
 *   POST /api/ability/select/search  body: { params: { keyword, type } }  → name_kr, name_en
 *   POST /api/pokemon/select/search  (동일)
 *
 * Node에서 동일 JSON으로 호출하면 HTTP 200이지만 MySQL ER_PARSE_ERROR로
 * WHERE 절이 비어 있음 → 서버가 body.params를 쓰지 않거나, 브라우저 전용 세션/헤더가
 * 필요한 상태로 보임. 확장에서 안정적인 영문 조회 소스로는 현재 부적합.
 *
 * 실행: node scripts/experiment-smartnuo-lookup.js
 */
const https = require('https');

function postJson(path, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
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
          'User-Agent': 'nuo-formatter-experiment/1.0',
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(buf) });
          } catch {
            resolve({ status: res.statusCode, json: null, raw: buf.slice(0, 500) });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const samples = [
    ['move', '/api/move/select/search', '비검천중파'],
    ['ability', '/api/ability/select/search', '관통드릴'],
    ['pokemon (도구명 검색용)', '/api/pokemon/select/search', '몰드류나이트'],
  ];
  for (const [label, path, keyword] of samples) {
    const r = await postJson(path, { params: { keyword, type: 0 } });
    const j = r.json;
    const ok = Array.isArray(j);
    console.log(label, 'http=', r.status, ok ? 'rows=' + j.length : 'err=', j && j.code, j && j.sqlMessage);
    if (ok && j[0]) console.log('  first:', JSON.stringify(j[0]).slice(0, 200));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
