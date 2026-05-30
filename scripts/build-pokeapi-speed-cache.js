/**
 * PokeAPI species(ko) + pokemon(speed) 캐시 생성.
 *   node scripts/build-pokeapi-speed-cache.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { fetchJson, listAll, mapInChunks } = require('./lib/pokeapi');

const CACHE_DIR = path.join(__dirname, '.cache');
const OUT = path.join(CACHE_DIR, 'pokeapi-speed-cache.json');

async function main() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  console.log('listing pokemon...');
  const pokemonList = await listAll('https://pokeapi.co/api/v2/pokemon?limit=20000');
  console.log('pokemon count', pokemonList.length);

  const speciesKo = {};
  const pokemonBySlug = {};

  const rows = await mapInChunks(
    pokemonList,
    async function (row) {
      if (!row || !row.url) return null;
      try {
        const p = await fetchJson(row.url);
        const slug = p.name;
        const speed = (p.stats || []).find(function (s) {
          return s.stat && s.stat.name === 'speed';
        });
        const spe = speed ? speed.base_stat : null;
        pokemonBySlug[slug] = { speed: spe, id: p.id };

        const spUrl = p.species && p.species.url;
        if (!spUrl) return { slug, spe };
        const sp = await fetchJson(spUrl);
        const ko = (sp.names || []).find(function (n) {
          return n.language && n.language.name === 'ko';
        });
        if (ko && ko.name) {
          speciesKo[ko.name] = { en: sp.name, id: sp.id };
        }
        return { slug, spe };
      } catch (e) {
        return null;
      }
    },
    {
      chunk: 10,
      onProgress: function (done, total) {
        if (done % 100 === 0 || done === total) console.log('  ', done, '/', total);
      },
    }
  );

  const doc = {
    generatedAt: new Date().toISOString(),
    speciesKo: speciesKo,
    pokemonBySlug: pokemonBySlug,
    pokemonCount: Object.keys(pokemonBySlug).length,
    speciesKoCount: Object.keys(speciesKo).length,
  };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log('Wrote', OUT);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
