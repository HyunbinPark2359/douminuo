/**
 * PokeAPI 전 아이템 → extension/itemKoMap.json (한글명 → item slug).
 *   node scripts/generate-item-ko-map.js
 *
 * Node 18+ (fetch). ko 가 없는 항목은 맵에 안 넣음 → extension/itemKoFallback.json 사용.
 *
 * F-data-2: 페이지네이션·동시성은 scripts/lib/pokeapi.js 헬퍼 사용.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { listAll, fetchInChunks } = require('./lib/pokeapi');

const OUT = path.join(__dirname, '..', 'extension', 'itemKoMap.json');

async function main() {
  const results = await listAll('https://pokeapi.co/api/v2/item?limit=500');
  const urls = results.filter((r) => r.url).map((r) => r.url);

  const details = await fetchInChunks(urls, {
    chunk: 40,
    onProgress: (done, total) => {
      if (done % 400 === 0 || done === total) console.error('items', done, '/', total);
    },
  });

  const byKo = {};
  for (const it of details) {
    if (!it || !it.name) continue;
    const ko = (it.names || []).find((n) => n.language && n.language.name === 'ko');
    if (ko && ko.name) byKo[String(ko.name).trim()] = it.name;
  }

  const doc = {
    version: 1,
    source: 'PokeAPI /api/v2/item names (language ko) → slug',
    generatedAt: new Date().toISOString(),
    itemCount: urls.length,
    koEntryCount: Object.keys(byKo).length,
    byKo,
  };
  fs.writeFileSync(OUT, JSON.stringify(doc) + '\n', 'utf8');
  console.log('Wrote', OUT, 'ko keys:', Object.keys(byKo).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
