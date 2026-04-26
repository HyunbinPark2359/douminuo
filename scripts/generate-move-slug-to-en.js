/**
 * PokeAPI 전 기술 → extension/moveSlugToEn.json (slug → 영어 표기명).
 *   node scripts/generate-move-slug-to-en.js
 *
 * Showdown 붙여넣기·moveKoMap compact id 매칭에 사용.
 *
 * F-data-2: 페이지네이션·동시성 패턴은 scripts/lib/pokeapi.js 공용 헬퍼 사용.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { listAll, fetchInChunks } = require('./lib/pokeapi');

const OUT = path.join(__dirname, '..', 'extension', 'moveSlugToEn.json');

async function main() {
  const results = await listAll('https://pokeapi.co/api/v2/move?limit=2000');

  const urls = results.map((r) => r.url);
  const rows = await fetchInChunks(urls, {
    chunk: 40,
    onProgress: (done, total) => {
      if (done % 400 === 0 || done === total) console.error('moves', done, '/', total);
    },
  });

  const bySlug = {};
  for (const m of rows) {
    if (!m || !m.name) continue;
    const en = (m.names || []).find((n) => n.language && n.language.name === 'en');
    if (en && en.name) bySlug[m.name] = en.name;
  }

  const doc = {
    version: 1,
    source: 'PokeAPI /api/v2/move names (language en)',
    generatedAt: new Date().toISOString(),
    moveCount: results.length,
    bySlug,
  };
  fs.writeFileSync(OUT, JSON.stringify(doc) + '\n', 'utf8');
  console.log('Wrote', OUT, 'slugs:', Object.keys(bySlug).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
