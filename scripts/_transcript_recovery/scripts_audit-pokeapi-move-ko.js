/**
 * moveTags.json 의 각 기술에 대해 PokeAPI에 한국어 name 이 있는지 조사.
 *   node scripts/audit-pokeapi-move-ko.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MOVE_TAGS = path.join(__dirname, '..', 'extension', 'moveTags.json');

async function compactToPokeSlugMap() {
  const res = await fetch('https://pokeapi.co/api/v2/move?limit=3000');
  const j = await res.json();
  const map = {};
  for (const r of j.results || []) {
    const slug = r.name;
    if (!slug) continue;
    map[String(slug).replace(/-/g, '')] = slug;
  }
  return map;
}

async function main() {
  const compactToSlug = await compactToPokeSlugMap();
  const doc = JSON.parse(fs.readFileSync(MOVE_TAGS, 'utf8'));
  const ids = Object.keys(doc.moves || {}).sort();
  const noKo = [];
  const noSlug = [];
  const batch = 25;
  for (let i = 0; i < ids.length; i += batch) {
    const chunk = ids.slice(i, i + batch);
    const rows = await Promise.all(
      chunk.map(async (id) => {
        const slug = compactToSlug[id];
        if (!slug) return { id, slug: null, ko: null };
        const r = await fetch('https://pokeapi.co/api/v2/move/' + encodeURIComponent(slug) + '/');
        if (!r.ok) return { id, slug, ko: null };
        const j = await r.json();
        const ko = (j.names || []).find((n) => n.language && n.language.name === 'ko');
        return { id, slug, ko: ko && ko.name ? ko.name.trim() : null };
      })
    );
    for (const row of rows) {
      if (!row.slug) noSlug.push(row.id);
      else if (!row.ko) noKo.push({ showdownId: row.id, pokeapiSlug: row.slug });
    }
    if (i % 200 === 0) console.error('progress', i, '/', ids.length);
  }
  console.log(JSON.stringify({ total: ids.length, noPokeapiSlug: noSlug.length, noKoreanName: noKo.length, noKoreanList: noKo }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
