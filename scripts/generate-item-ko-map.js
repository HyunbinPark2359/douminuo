/**
 * PokeAPI 전 아이템 → extension/itemKoMap.json (한글명 → item slug).
 *   node scripts/generate-item-ko-map.js
 *
 * Node 18+ (fetch). ko 가 없는 항목은 맵에 안 넣음 → extension/itemKoFallback.json 사용.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'extension', 'itemKoMap.json');

async function main() {
  const urls = [];
  let next = 'https://pokeapi.co/api/v2/item?limit=500';
  while (next) {
    const res = await fetch(next);
    if (!res.ok) throw new Error('item list ' + res.status);
    const j = await res.json();
    for (const r of j.results || []) {
      if (r.url) urls.push(r.url);
    }
    next = j.next || null;
  }

  const byKo = {};
  const batch = 40;
  for (let i = 0; i < urls.length; i += batch) {
    const chunk = urls.slice(i, i + batch);
    const details = await Promise.all(
      chunk.map((u) =>
        fetch(u).then((r) => {
          if (!r.ok) return null;
          return r.json();
        })
      )
    );
    for (const it of details) {
      if (!it || !it.name) continue;
      const ko = (it.names || []).find((n) => n.language && n.language.name === 'ko');
      if (ko && ko.name) byKo[String(ko.name).trim()] = it.name;
    }
    if (i % 400 === 0) console.error('items', i, '/', urls.length);
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
