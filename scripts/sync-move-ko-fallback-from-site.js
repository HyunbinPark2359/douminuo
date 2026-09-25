/**
 * 스마트누오 현재 기술 도감 표기(GET /api/move → [{ en, kr, power }]) 중
 * moveKoMap.json + moveKoFallback.json 으로 풀리지 않는 한글명을 moveKoFallback.json 에 추가.
 * (moveKoMap 은 PokéAPI ko 기준이라 드래곤클로/드래곤크루 같은 표기 차이·신규 기술이 빠짐.)
 *
 *   node scripts/sync-move-ko-fallback-from-site.js
 *
 * 사이트 트래픽 보호: 응답을 scripts/.cache/smartnuo-move-dex.json 에 저장하고 있으면 재사용 —
 * 사이트 호출은 캐시가 없을 때 1회뿐. 최신 도감으로 다시 맞추려면 캐시 파일을 지우고 실행.
 *
 * 추가 대상: 한글 키 + moveTags.json 에 있는 Showdown id (Z기술·다이맥스기 등 미수록은 제외).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const EXT = path.join(__dirname, '..', 'extension');
const CACHE = path.join(__dirname, '.cache', 'smartnuo-move-dex.json');
const FALLBACK = path.join(EXT, 'moveKoFallback.json');

async function loadSiteDex() {
  if (fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const res = await fetch('https://smartnuo.com/api/move', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('smartnuo /api/move ' + res.status);
  const text = await res.text();
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, text, 'utf8');
  return JSON.parse(text);
}

async function main() {
  const rows = await loadSiteDex();
  const byKoMain = JSON.parse(fs.readFileSync(path.join(EXT, 'moveKoMap.json'), 'utf8')).byKo;
  const tags = JSON.parse(fs.readFileSync(path.join(EXT, 'moveTags.json'), 'utf8')).moves;
  const fb = JSON.parse(fs.readFileSync(FALLBACK, 'utf8'));

  const added = [];
  const conflicts = [];
  for (const r of rows) {
    const ko = String(r.kr || '').replace(/\s+/g, '');
    const id = String(r.en || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!ko || !id || !/[가-힣]/.test(ko) || !tags[id]) continue;
    const cur = byKoMain[ko] != null ? byKoMain[ko] : fb.byKo[ko];
    if (cur === id) continue;
    if (cur != null) {
      conflicts.push(ko + ': ' + cur + ' (사이트 ' + id + ')');
      continue;
    }
    fb.byKo[ko] = id;
    added.push(ko + '=' + id);
  }

  if (conflicts.length) console.warn('기존 매핑과 충돌 (유지):', conflicts);
  if (!added.length) {
    console.log('추가할 항목 없음');
    return;
  }
  fb.version = (fb.version || 0) + 1;
  fs.writeFileSync(FALLBACK, JSON.stringify(fb, null, 2) + '\n', 'utf8');
  console.log('added', added.length, '→ version', fb.version);
  console.log(added.join(' '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
