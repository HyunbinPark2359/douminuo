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

/* ===== PNG 축소 (stdlib zlib 만) — 테라 200px 원본이 12px 로만 표시돼 용량 낭비 (자산 파일 375KB 중 297KB) ===== */

const zlib = require('zlib');

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** RGBA 8bit PNG (비인터레이스·Adam7) → { w, h, px: Uint8Array RGBA }. 다른 형식은 throw. */
function decodePng(buf) {
  let pos = 8, w = 0, h = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), d = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4); interlace = d[12];
      if (d[8] !== 8 || d[9] !== 6) throw new Error('RGBA 8bit PNG 아님');
    } else if (type === 'IDAT') idat.push(d);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(w * h * 4);
  const passes = interlace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  let off = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy);
    if (pw <= 0 || ph <= 0) continue;
    const stride = pw * 4;
    let prev = new Uint8Array(stride);
    for (let y = 0; y < ph; y++) {
      const f = raw[off++], cur = new Uint8Array(raw.subarray(off, off + stride));
      off += stride;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? cur[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
        cur[i] = (cur[i] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0)) & 255;
      }
      for (let x = 0; x < pw; x++) px.set(cur.subarray(x * 4, x * 4 + 4), ((y0 + y * dy) * w + x0 + x * dx) * 4);
      prev = cur;
    }
  }
  return { w, h, px };
}

/** 면적 평균 축소 (premultiplied alpha — 투명 가장자리 검은 테두리 방지). */
function resizeArea(src, T) {
  const out = new Uint8Array(T * T * 4), sx = src.w / T, sy = src.h / T;
  for (let oy = 0; oy < T; oy++) for (let ox = 0; ox < T; ox++) {
    let r = 0, g = 0, b = 0, a = 0, wsum = 0;
    for (let y = Math.floor(oy * sy); y < Math.ceil((oy + 1) * sy); y++) {
      const wy = Math.min(y + 1, (oy + 1) * sy) - Math.max(y, oy * sy);
      for (let x = Math.floor(ox * sx); x < Math.ceil((ox + 1) * sx); x++) {
        const wt = wy * (Math.min(x + 1, (ox + 1) * sx) - Math.max(x, ox * sx)), i = (y * src.w + x) * 4, al = src.px[i + 3];
        r += src.px[i] * al * wt; g += src.px[i + 1] * al * wt; b += src.px[i + 2] * al * wt; a += al * wt; wsum += wt;
      }
    }
    const o = (oy * T + ox) * 4;
    out[o + 3] = Math.round(a / wsum);
    if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
  }
  return { w: T, h: T, px: out };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const x of buf) c = CRC_TABLE[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** RGBA → PNG (행마다 5필터 중 절댓값 합 최소 선택 + deflate 9). */
function encodePng(img) {
  const stride = img.w * 4, rows = [];
  let prev = new Uint8Array(stride);
  for (let y = 0; y < img.h; y++) {
    const cur = img.px.subarray(y * stride, (y + 1) * stride);
    let best = null, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const row = Buffer.alloc(stride + 1);
      row[0] = f;
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? cur[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
        const v = (cur[i] - (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0)) & 255;
        row[i + 1] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = row; }
    }
    rows.push(best);
    prev = cur;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** data URI PNG 를 T px 정사각으로 축소 (원본이 T 이하거나 정사각 아니면 그대로). */
function shrinkDataUri(uri, T) {
  const img = decodePng(Buffer.from(uri.split(',')[1], 'base64'));
  if (img.w <= T || img.w !== img.h) return uri;
  return 'data:image/png;base64,' + encodePng(resizeArea(img, T)).toString('base64');
}

async function toDataUri(v) {
  if (!v) throw new Error('빈 값');
  if (v.startsWith('data:')) return v;
  return fetchDataUri(v.startsWith('http') ? v : ORIGIN + v);
}

module.exports = { decodePng, encodePng, resizeArea };

if (require.main === module) (async () => {
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
    // 200 → 100px (원본 절반): 12px 표시에서 DPR 1~2 오차 ≤4/255, DPR 3 ≤13 (2026-09-24 측정). 48~72px 는 DPR 1.65 에서 가장자리 번짐 측정됨.
    tera[TYPES_KO[k]] = shrinkDataUri(await toDataUri(raw[teraIx][k]), 100);
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
  const pokeball = await fetchDataUri(ORIGIN + pokeballPath); // 원본 유지 — 축소 절감(~13KB) 대비 DPR 3 오차 큼

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
