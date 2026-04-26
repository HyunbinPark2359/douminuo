/**
 * PokeAPI ability id 1..N → extension/abilityKoMap.json (한글명 → ability slug).
 *   node scripts/generate-ability-ko-map.js
 *
 * 응답이 JSON이 아니면 해당 id 스킵. ko 없으면 맵에 안 넣음 → abilityKoFallback.json.
 *
 * F-data-2: 동시성은 scripts/lib/pokeapi.js 헬퍼 사용. id 기반 enumeration 이라 listAll
 *   대신 직접 id 배열 만들어 mapInChunks.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { mapInChunks } = require('./lib/pokeapi');

const OUT = path.join(__dirname, '..', 'extension', 'abilityKoMap.json');
const MAX_ID = 450;

async function main() {
  const ids = [];
  for (let i = 1; i <= MAX_ID; i++) ids.push(i);

  const rows = await mapInChunks(
    ids,
    async (id) => {
      try {
        const r = await fetch('https://pokeapi.co/api/v2/ability/' + id + '/');
        if (!r.ok) return null;
        const t = await r.text();
        try {
          return JSON.parse(t);
        } catch (_e) {
          return null;
        }
      } catch (_e2) {
        return null;
      }
    },
    {
      chunk: 25,
      onProgress: (done, total) => {
        if (done % 100 === 0 || done === total) console.error('ability id', done, '/', total);
      },
    }
  );

  const byKo = {};
  let ok = 0;
  for (const j of rows) {
    if (!j || !j.name) continue;
    const ko = (j.names || []).find((n) => n.language && n.language.name === 'ko');
    if (ko && ko.name) {
      byKo[String(ko.name).trim()] = j.name;
      ok++;
    }
  }

  const doc = {
    version: 1,
    source: 'PokeAPI /api/v2/ability/{id}/ names (language ko) → slug',
    generatedAt: new Date().toISOString(),
    abilitiesWithKo: ok,
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
