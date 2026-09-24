#!/usr/bin/env node
/**
 * 사이트 번들에서 샘플 카드 아이콘 추출 → extension/sampleCardAssets.js 생성 (SAMPLE_LIBRARY_PLAN §4.4).
 * 개발 시 1회 실행, zip 미포함. 사이트 정적 JS 청크를 한 번 훑음 (페이지 1회 로드와 같은 양).
 * Node 18+ (글로벌 fetch).
 *
 * 사용: node scripts/extract-sample-card-assets.js [--list /_nuxt/XXXX.js]
 *   --list: 자동 탐색 실패 시 list 컴포넌트 청크 경로를 직접 지정
 *           (사이트 파티 탭 DevTools: performance.getEntriesByType('resource') 에서 '__name:"list"' 포함 청크).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://smartnuo.com';
const OUT = path.join(__dirname, '..', 'extension', 'sampleCardAssets.js');
const TYPES_KO = ['노말', '불꽃', '물', '풀', '전기', '얼음', '격투', '독', '땅', '비행', '에스퍼', '벌레', '바위', '고스트', '드래곤', '악', '강철', '페어리', '스텔라'];
// 2026-09-24 사용자 파티 카드 DOM 에서 관측한 data URI 길이 — 추출 결과 교차검증 (불일치 = 경고만).
const MOVE_LEN_ANCHOR = { 물: 1630, 페어리: 1658, 강철: 2226, 노말: 2002, 드래곤: 2078 };
const STAT_LEN_ANCHOR = [806, 950, 1190, 1370, 1574, 3170];

async function fetchText(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(u + ' ' + r.status);
  return r.text();
}

async function fetchDataUri(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(u + ' ' + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  return 'data:image/png;base64,' + b.toString('base64');
}

/** /party HTML 에서 시작해 청크가 참조하는 다른 청크까지 전부 수집. */
async function crawl(extra) {
  const html = await fetchText(ORIGIN + '/party');
  const queue = [...new Set([...html.matchAll(/\/_nuxt\/[\w.-]+\.js/g)].map((m) => m[0]))];
  if (extra) queue.push(extra);
  const chunks = {};
  while (queue.length) {
    const p = queue.shift();
    if (chunks[p]) continue;
    chunks[p] = await fetchText(ORIGIN + p);
    const refs = [
      ...chunks[p].matchAll(/["'`]\.\/([\w.-]+\.js)["'`]/g),
      ...chunks[p].matchAll(/["'`]\/?_nuxt\/([\w.-]+\.js)["'`]/g),
    ];
    for (const m of refs) {
      const q = '/_nuxt/' + m[1];
      if (!chunks[q] && !queue.includes(q)) queue.push(q);
    }
  }
  return chunks;
}

function reEsc(s) {
  return s.replace(/[$]/g, '\\$');
}

/** 청크 안 식별자 → 문자열 값 ('data:...' 또는 '/_nuxt/x.png'). import 체인 최대 4단계 추적. */
function resolveIdent(chunks, file, id, depth) {
  if (depth > 4) return null;
  const src = chunks[file];
  if (!src) return null;
  const idRe = reEsc(id);
  let m = src.match(new RegExp('(?:^|[^\\w$])' + idRe + '="([^"]+)"'));
  if (m) return m[1];
  m = src.match(new RegExp('(?:^|[^\\w$])' + idRe + '=""\\+new URL\\("([^"]+)",import\\.meta\\.url\\)\\.href'));
  if (m) return '/_nuxt/' + m[1].replace(/^\.\//, '');
  for (const im of src.matchAll(/import\{([^}]*)\}from"\.\/([\w.-]+\.js)"/g)) {
    for (const spec of im[1].split(',')) {
      const parts = spec.includes(' as ') ? spec.split(' as ').map((s) => s.trim()) : [spec.trim(), spec.trim()];
      if (parts[1] !== id) continue;
      const target = '/_nuxt/' + im[2];
      for (const ex of (chunks[target] || '').matchAll(/export\{([^}]*)\}/g)) {
        for (const es of ex[1].split(',')) {
          const ep = es.includes(' as ') ? es.split(' as ').map((s) => s.trim()) : [es.trim(), es.trim()];
          if (ep[1] === parts[0]) return resolveIdent(chunks, target, ep[0], depth + 1);
        }
      }
      return null;
    }
  }
  return null;
}

async function toDataUri(v) {
  if (!v) throw new Error('빈 값');
  if (v.startsWith('data:')) return v;
  return fetchDataUri(v.startsWith('http') ? v : ORIGIN + v);
}

(async () => {
  const argIx = process.argv.indexOf('--list');
  const extra = argIx > 0 ? process.argv[argIx + 1] : null;
  const chunks = await crawl(extra);
  console.log('청크 수:', Object.keys(chunks).length);

  const listFile = extra || Object.keys(chunks).find((f) => chunks[f].includes('__name:"list"') && chunks[f].includes('{key:"hp",img:'));
  if (!listFile) throw new Error('list 컴포넌트 청크를 못 찾음 — --list 로 직접 지정');
  const src = chunks[listFile];

  const mapRe = new RegExp('\\{' + TYPES_KO.map((k) => k + ':([\\w$]+)').join(',') + '\\}', 'g');
  const maps = [...src.matchAll(mapRe)].map((m) => m.slice(1));
  if (maps.length < 2) throw new Error('타입 아이콘 맵 2개를 못 찾음: ' + maps.length);

  const statM = src.match(/\{key:"hp",img:([\w$]+)\},\{key:"attack",img:([\w$]+)\},\{key:"defense",img:([\w$]+)\},\{key:"special_attack",img:([\w$]+)\},\{key:"special_defense",img:([\w$]+)\},\{key:"speed",img:([\w$]+)\}/);
  if (!statM) throw new Error('스탯 아이콘 배열을 못 찾음');

  // 두 맵 중 값이 *terastal* 파일인 쪽 = 테라 (사용자 Chrome 실측: Fire_icon_terastal.<hash>.png)
  const raw = maps.slice(0, 2).map((ids) => ids.map((id) => resolveIdent(chunks, listFile, id, 0)));
  raw.forEach((vals, i) => vals.forEach((v, k) => { if (!v) throw new Error('식별자 해석 실패: 맵' + i + ' ' + TYPES_KO[k]); }));
  const teraIx = raw.findIndex((vals) => /terastal/i.test(vals[1]));
  if (teraIx < 0) throw new Error('테라 맵 판별 실패');
  const moveIx = 1 - teraIx;

  const move = {};
  const tera = {};
  for (let k = 0; k < TYPES_KO.length; k++) {
    move[TYPES_KO[k]] = await toDataUri(raw[moveIx][k]);
    tera[TYPES_KO[k]] = await toDataUri(raw[teraIx][k]);
  }
  const stat = [];
  for (let k = 1; k <= 6; k++) {
    const v = resolveIdent(chunks, listFile, statM[k], 0);
    if (!v) throw new Error('스탯 식별자 해석 실패: ' + statM[k]);
    stat.push(await toDataUri(v));
  }

  let pokeballPath = null;
  for (const f of Object.keys(chunks)) {
    const m = chunks[f].match(/pokeball\.[\w-]+\.png/);
    if (m) { pokeballPath = '/_nuxt/' + m[0]; break; }
  }
  if (!pokeballPath) throw new Error('pokeball 이미지 경로를 못 찾음');
  const pokeball = await fetchDataUri(ORIGIN + pokeballPath);

  Object.keys(MOVE_LEN_ANCHOR).forEach((k) => {
    if (move[k].length !== MOVE_LEN_ANCHOR[k]) console.warn('경고: 기술 아이콘 길이 다름', k, move[k].length, '기대', MOVE_LEN_ANCHOR[k]);
  });
  stat.forEach((v, i) => {
    if (v.length !== STAT_LEN_ANCHOR[i]) console.warn('경고: 스탯 아이콘 길이 다름', i, v.length, '기대', STAT_LEN_ANCHOR[i]);
  });

  const doc = { version: 1, stat, move, tera, pokeball };
  const out = "(function(){'use strict';globalThis.NUO_SAMPLE_CARD_ASSETS=" + JSON.stringify(doc) + ';})();\n';
  fs.writeFileSync(OUT, out);
  console.log('기술', Object.keys(move).length, '테라', Object.keys(tera).length, '스탯', stat.length, '포켓볼 OK');
  console.log('쓰기:', OUT, Math.round(out.length / 1024) + 'KB');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
