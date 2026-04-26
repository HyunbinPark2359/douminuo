/**
 * PokéAPI 전 포켓몬(폼 포함) → extension/pokemonTypeMap.json
 *
 *   node scripts/generate-pokemon-type-map.js
 *
 * Node 18+ (글로벌 fetch 필요). zip에 안 들어감.
 *
 * 결과:
 *   { version, generatedAt, count, bySlug: { "<en slug>": ["<type1>", "<type2>?"] } }
 *
 * 사용처: extension/background.js 의 resolveSpeciesTypesForSlot.
 * 슬롯의 pokemon.name (영문 slug)으로 lookup → 타입이 한쪽만 있을 때 PokéAPI
 * 런타임 fetch가 일어나지 않게 한다 (어머니 사이트 보호 §A.4 / F20).
 *
 * F-data-2: 페이지네이션·동시성은 scripts/lib/pokeapi.js 헬퍼 사용.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { fetchJson, mapInChunks } = require('./lib/pokeapi');

const OUT = path.join(__dirname, '..', 'extension', 'pokemonTypeMap.json');
const LIST_URL = 'https://pokeapi.co/api/v2/pokemon?limit=2000';

function sortedTypes(types) {
  return (Array.isArray(types) ? types : [])
    .slice()
    .sort(function (a, b) {
      return (a && a.slot ? a.slot : 0) - (b && b.slot ? b.slot : 0);
    })
    .map(function (t) {
      return t && t.type && t.type.name ? String(t.type.name).toLowerCase() : '';
    })
    .filter(Boolean);
}

async function main() {
  process.stdout.write('listing pokemon... ');
  const list = await fetchJson(LIST_URL);
  const items = (list.results || []).filter((x) => x && x.name && x.url);
  console.log(items.length + ' entries');

  const bySlug = Object.create(null);
  await mapInChunks(
    items,
    async (it) => {
      try {
        const p = await fetchJson(it.url);
        const types = sortedTypes(p.types);
        if (p.name && types.length) bySlug[String(p.name).toLowerCase()] = types;
      } catch (e) {
        // 단건 실패는 건너뜀 — 신규/비공개 폼 등 PokéAPI 일관성 깨짐 케이스
      }
    },
    {
      chunk: 12,
      onProgress: (done, total) => {
        if (done % 100 === 0 || done === total) {
          process.stdout.write('  ' + done + '/' + total + '\r');
        }
      },
    }
  );
  console.log('\nresolved: ' + Object.keys(bySlug).length + ' pokemon');

  const out = {
    version: 1,
    source: 'PokeAPI /api/v2/pokemon → types[].type.name (slot 순)',
    generatedAt: new Date().toISOString(),
    count: Object.keys(bySlug).length,
    bySlug: bySlug,
  };

  fs.writeFileSync(OUT, JSON.stringify(out), 'utf8');
  console.log('wrote ' + OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
