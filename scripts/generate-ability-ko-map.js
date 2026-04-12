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
const BATCH = 25;

async function main() {
  const byKo = {};
  let ok = 0;
  for (let start = 1; start <= MAX_ID; start += BATCH) {
    const ids = [];
    let k;
    for (k = 0; k < BATCH && start + k <= MAX_ID; k++) {
      ids.push(start + k);
    }
    const rows = await Promise.all(
      ids.map((id) =>
        fetch('https://pokeapi.co/api/v2/ability/' + id + '/').then(async (r) => {
          if (!r.ok) return null;
          const t = await r.text();
          try {
            return JSON.parse(t);
          } catch (_e) {
            return null;
          }
        })
      )
    );
    for (const j of rows) {
      if (!j || !j.name) continue;
      const ko = (j.names || []).find((n) => n.language && n.language.name === 'ko');
      if (ko && ko.name) {
        byKo[String(ko.name).trim()] = j.name;
        ok++;
      }
    }
    if (start % 100 === 1) console.error('ability id', start, '..', start + BATCH - 1);
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
