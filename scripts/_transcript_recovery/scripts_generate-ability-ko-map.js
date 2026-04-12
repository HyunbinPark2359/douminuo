/**
 * PokeAPI ability id 1..N → extension/abilityKoMap.json (한글명 → ability slug).
 *   node scripts/generate-ability-ko-map.js
 *
 * 응답이 JSON이 아니면 해당 id 스킵. ko 없으면 맵에 안 넣음 → abilityKoFallback.json.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'extension', 'abilityKoMap.json');
const MAX_ID = 450;

async function main() {
  const byKo = {};
  let ok = 0;
  for (let id = 1; id <= MAX_ID; id++) {
    const r = await fetch('https://pokeapi.co/api/v2/ability/' + id + '/');
    if (!r.ok) continue;
    const t = await r.text();
    let j;
    try {
      j = JSON.parse(t);
    } catch (_e) {
      continue;
    }
    const ko = (j.names || []).find((n) => n.language && n.language.name === 'ko');
    if (ko && ko.name && j.name) {
      byKo[String(ko.name).trim()] = j.name;
      ok++;
    }
    if (id % 50 === 0) console.error('ability id', id);
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
