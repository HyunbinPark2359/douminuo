/**
 * PokeAPI 전 포켓몬 → extension/pokemonSlugToDex.json (slug → PokeAPI 내부 id).
 *   node scripts/generate-pokemon-slug-to-dex.js
 *
 * 용도: 구버전 공유 URL 로 로드된 슬롯에서 사이트가 pokemon.sprite 를 채우지
 * 못해 FAB 슬롯에 placeholder 숫자가 뜨는 회귀를 막기 위한 폴백.
 * raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png 구성에 사용.
 *
 * 폼 변형(zygarde-50, minior-red-meteor 등) 은 PokeAPI 내부 id 가 10000+ 라
 * national dex 번호 대신 results[].url 의 끝 path 를 그대로 사용.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { listAll } = require('./lib/pokeapi');

const OUT = path.join(__dirname, '..', 'extension', 'pokemonSlugToDex.json');

function extractIdFromUrl(url) {
  if (!url) return 0;
  var m = /\/pokemon\/(\d+)\/?$/.exec(String(url));
  return m ? parseInt(m[1], 10) : 0;
}

async function main() {
  const results = await listAll('https://pokeapi.co/api/v2/pokemon?limit=20000');

  const bySlug = {};
  for (const r of results) {
    if (!r || !r.name) continue;
    const id = extractIdFromUrl(r.url);
    if (id > 0) bySlug[r.name] = id;
  }

  const doc = {
    version: 1,
    source: 'PokeAPI /api/v2/pokemon ids',
    generatedAt: new Date().toISOString(),
    slugCount: Object.keys(bySlug).length,
    bySlug,
  };
  fs.writeFileSync(OUT, JSON.stringify(doc) + '\n', 'utf8');
  console.log('Wrote', OUT, 'slugs:', Object.keys(bySlug).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
