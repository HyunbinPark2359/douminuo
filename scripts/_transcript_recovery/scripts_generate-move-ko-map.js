/**
 * extension/moveTags.json 의 각 move id 에 대해 PokeAPI 한글명을 조회해
 * extension/moveKoMap.json 생성 (한글 라벨 → Showdown move id).
 *
 *   node scripts/generate-move-ko-map.js
 *
 * Node 18+ (fetch). 스크립트 끝에 흔한 표기 차이 별칭을 덧씌움.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MOVE_TAGS = path.join(__dirname, '..', 'extension', 'moveTags.json');
const OUT = path.join(__dirname, '..', 'extension', 'moveKoMap.json');

/** PokeAPI와 다른 사이트·구표기 등 (값은 Showdown move id) */
const EXTRA_ALIASES = {
  본러시: 'bonerush',
  록블레스트: 'rockblast',
  씨기관총: 'bulletseed',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function koNameForMoveId(id) {
  const res = await fetch('https://pokeapi.co/api/v2/move/' + encodeURIComponent(id) + '/');
  if (!res.ok) throw new Error('pokeapi move ' + id + ' ' + res.status);
  const j = await res.json();
  const row = (j.names || []).find((n) => n.language && n.language.name === 'ko');
  return row && row.name ? String(row.name).trim() : null;
}

async function main() {
  const doc = JSON.parse(fs.readFileSync(MOVE_TAGS, 'utf8'));
  const ids = Object.keys(doc.moves || {}).sort();
  const byKo = {};
  const collisions = [];

  const batchSize = 12;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const results = await Promise.all(
      chunk.map((id) =>
        koNameForMoveId(id).then((ko) => ({ id, ko })).catch((e) => {
          console.error(id, e.message);
          return { id, ko: null };
        })
      )
    );
    for (const { id, ko } of results) {
      if (!ko) continue;
      const compact = ko.replace(/\s+/g, '');
      function reg(key) {
        if (!key) return;
        if (byKo[key] != null && byKo[key] !== id) {
          collisions.push({ key, was: byKo[key], now: id });
        }
        byKo[key] = id;
      }
      reg(compact);
      if (ko !== compact) reg(ko);
    }
    await sleep(120);
  }

  for (const [alias, id] of Object.entries(EXTRA_ALIASES)) {
    const c = alias.replace(/\s+/g, '');
    byKo[c] = id;
    byKo[alias] = id;
  }

  if (collisions.length) {
    console.warn('ko map collisions (kept last):', collisions.slice(0, 20), '… total', collisions.length);
  }

  const outDoc = {
    version: 1,
    source: 'PokeAPI /api/v2/move/{id}/ names (language ko)',
    generatedAt: new Date().toISOString(),
    moveCount: ids.length,
    byKo,
  };
  fs.writeFileSync(OUT, JSON.stringify(outDoc) + '\n', 'utf8');
  console.log('Wrote', OUT, 'keys:', Object.keys(byKo).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
