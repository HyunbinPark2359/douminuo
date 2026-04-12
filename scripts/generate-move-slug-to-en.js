/**
 * PokeAPI 전 기술 → extension/moveSlugToEn.json (slug → 영어 표기명).
 *   node scripts/generate-move-slug-to-en.js
 *
 * Showdown 붙여넣기·moveKoMap compact id 매칭에 사용.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'extension', 'moveSlugToEn.json');

async function main() {
  const results = [];
  let next = 'https://pokeapi.co/api/v2/move?limit=2000';
  while (next) {
    const res = await fetch(next);
    if (!res.ok) throw new Error('move list ' + res.status);
    const j = await res.json();
    results.push(...(j.results || []));
    next = j.next || null;
  }

  const bySlug = {};
  const batch = 40;
  for (let i = 0; i < results.length; i += batch) {
    const chunk = results.slice(i, i + batch);
    const rows = await Promise.all(
      chunk.map((r) =>
        fetch(r.url)
          .then((x) => (x.ok ? x.json() : null))
          .catch(() => null)
      )
    );
    for (const m of rows) {
      if (!m || !m.name) continue;
      const en = (m.names || []).find((n) => n.language && n.language.name === 'en');
      if (en && en.name) bySlug[m.name] = en.name;
    }
    if (i % 400 === 0) console.error('moves', i, '/', results.length);
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
