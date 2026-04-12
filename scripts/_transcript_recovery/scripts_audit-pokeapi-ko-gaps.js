/**
 * PokeAPI에 한국어(language ko) 이름이 없는 기술·도구·특성 전수 조사.
 * 기술은 moveTags.json 기준 + generation-ix 여부 표기.
 *
 *   node scripts/audit-pokeapi-ko-gaps.js
 *
 * 결과: scripts/pokeapi-ko-gaps-report.json
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOVE_TAGS = path.join(ROOT, 'extension', 'moveTags.json');
const MOVE_FB = path.join(ROOT, 'extension', 'moveKoFallback.json');
const ITEM_FB = path.join(ROOT, 'extension', 'itemKoFallback.json');
const OUT = path.join(__dirname, 'pokeapi-ko-gaps-report.json');

function loadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_e) {
    return fallback;
  }
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

async function compactMoveSlugMap() {
  const j = await fetchJson('https://pokeapi.co/api/v2/move?limit=3000');
  const map = {};
  for (const row of j.results || []) {
    if (!row.name) continue;
    map[String(row.name).replace(/-/g, '')] = row.name;
  }
  return map;
}

async function auditMoves(compactToSlug) {
  const doc = JSON.parse(fs.readFileSync(MOVE_TAGS, 'utf8'));
  const ids = Object.keys(doc.moves || {}).sort();
  const noSlug = [];
  const noKo = [];
  const batch = 25;
  for (let i = 0; i < ids.length; i += batch) {
    const chunk = ids.slice(i, i + batch);
    const rows = await Promise.all(
      chunk.map(async (id) => {
        const slug = compactToSlug[id];
        if (!slug) return { id, slug: null, ko: null, generation: null };
        const j = await fetchJson('https://pokeapi.co/api/v2/move/' + encodeURIComponent(slug) + '/');
        const koRow = (j.names || []).find((n) => n.language && n.language.name === 'ko');
        const gen = j.generation && j.generation.name ? j.generation.name : null;
        return {
          id,
          slug,
          ko: koRow && koRow.name ? koRow.name.trim() : null,
          generation: gen,
        };
      })
    );
    for (const row of rows) {
      if (!row.slug) noSlug.push(row.id);
      else if (!row.ko) {
        noKo.push({
          showdownId: row.id,
          pokeapiSlug: row.slug,
          generation: row.generation,
          isGen9: row.generation === 'generation-ix',
        });
      }
    }
    if (i % 200 === 0) console.error('moves', i, '/', ids.length);
  }
  return { totalShowdownMoves: ids.length, noPokeapiSlug: noSlug, noKoreanName: noKo };
}

async function collectAllItemUrls() {
  const urls = [];
  let next = 'https://pokeapi.co/api/v2/item?limit=500';
  while (next) {
    const j = await fetchJson(next);
    for (const r of j.results || []) {
      if (r.url) urls.push(r.url);
    }
    next = j.next || null;
  }
  return urls;
}

async function auditItems() {
  const urls = await collectAllItemUrls();
  const noKo = [];
  const batch = 40;
  for (let i = 0; i < urls.length; i += batch) {
    const chunk = urls.slice(i, i + batch);
    const rows = await Promise.all(
      chunk.map(async (url) => {
        const j = await fetchJson(url);
        const slug = j.name;
        const koRow = (j.names || []).find((n) => n.language && n.language.name === 'ko');
        return {
          slug,
          ko: koRow && koRow.name ? koRow.name.trim() : null,
        };
      })
    );
    for (const row of rows) {
      if (!row.ko) noKo.push({ pokeapiSlug: row.slug });
    }
    if (i % 400 === 0) console.error('items', i, '/', urls.length);
  }
  return { totalItems: urls.length, noKoreanName: noKo };
}

async function auditAbilities() {
  const noKo = [];
  for (let id = 1; id <= 400; id++) {
    const r = await fetch('https://pokeapi.co/api/v2/ability/' + id + '/');
    if (!r.ok) continue;
    const j = await r.json();
    const koRow = (j.names || []).find((n) => n.language && n.language.name === 'ko');
    if (!koRow || !koRow.name) {
      noKo.push({ id, pokeapiSlug: j.name });
    }
    if (id % 50 === 0) console.error('abilities', id);
  }
  return { noKoreanName: noKo };
}

function annotateFallbacks(moveResult, itemResult) {
  const moveFb = loadJson(MOVE_FB, { byKo: {} }).byKo || {};
  const itemFb = loadJson(ITEM_FB, { byKo: {} }).byKo || {};
  const moveFbValues = new Set(Object.values(moveFb));
  const itemFbValues = new Set(Object.values(itemFb));

  const movesStillNeedingKo = moveResult.noKoreanName.filter((m) => !moveFbValues.has(m.showdownId));
  const movesCoveredByFallback = moveResult.noKoreanName.filter((m) => moveFbValues.has(m.showdownId));

  const itemsStillNeedingKo = itemResult.noKoreanName.filter((it) => !itemFbValues.has(it.pokeapiSlug));
  const itemsCoveredByFallback = itemResult.noKoreanName.filter((it) => itemFbValues.has(it.pokeapiSlug));

  const gen9NoKo = moveResult.noKoreanName.filter((m) => m.isGen9);
  const gen9StillNeeding = movesStillNeedingKo.filter((m) => m.isGen9);

  return {
    movesCoveredByMoveKoFallback: movesCoveredByFallback.length,
    movesStillNeedingKoreanLabel: movesStillNeedingKo,
    gen9MovesNoKoInPokeapi: gen9NoKo,
    gen9MovesStillNeedingLabelAfterFallback: gen9StillNeeding,
    itemsCoveredByItemKoFallback: itemsCoveredByFallback.length,
    itemsStillNeedingKoreanLabel: itemsStillNeedingKo,
  };
}

async function main() {
  console.error('building move slug map…');
  const compactToSlug = await compactMoveSlugMap();
  console.error('auditing moves…');
  const moveResult = await auditMoves(compactToSlug);
  console.error('auditing items…');
  const itemResult = await auditItems();
  console.error('auditing abilities…');
  const abilityResult = await auditAbilities();

  const extra = annotateFallbacks(moveResult, itemResult);

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'PokeAPI v2 (names missing language ko)',
    moves: {
      totalInMoveTags: moveResult.totalShowdownMoves,
      noPokeapiSlugCount: moveResult.noPokeapiSlug.length,
      noPokeapiSlugIds: moveResult.noPokeapiSlug,
      noKoreanNameCount: moveResult.noKoreanName.length,
      noKoreanNameFullList: moveResult.noKoreanName,
      gen9NoKoCount: extra.gen9MovesNoKoInPokeapi.length,
    },
    movesFallbackSummary: {
      coveredByExtensionMoveKoFallback: extra.movesCoveredByMoveKoFallback,
      stillNeedKoreanStringForShowdownPaste: extra.movesStillNeedingKoreanLabel.length,
      stillNeedList: extra.movesStillNeedingKoreanLabel,
      gen9StillNeedCountAfterFallback: extra.gen9MovesStillNeedingLabelAfterFallback.length,
      gen9StillNeedList: extra.gen9MovesStillNeedingLabelAfterFallback,
    },
    items: {
      totalInPokeapi: itemResult.totalItems,
      noKoreanNameCount: itemResult.noKoreanName.length,
      noKoreanNameFullList: itemResult.noKoreanName,
    },
    itemsFallbackSummary: {
      coveredByExtensionItemKoFallback: extra.itemsCoveredByItemKoFallback,
      stillNeedKoreanStringCount: extra.itemsStillNeedingKoreanLabel.length,
      stillNeedSlugList: extra.itemsStillNeedingKoreanLabel.map((x) => x.pokeapiSlug),
    },
    abilities: {
      noKoreanNameCount: abilityResult.noKoreanName.length,
      noKoreanNameList: abilityResult.noKoreanName,
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.error('Wrote', OUT);
  console.log(
    JSON.stringify(
      {
        movesNoKo: moveResult.noKoreanName.length,
        movesGen9NoKo: extra.gen9MovesNoKoInPokeapi.length,
        movesStillAfterFallback: extra.movesStillNeedingKoreanLabel.length,
        itemsNoKo: itemResult.noKoreanName.length,
        itemsStillAfterFallback: extra.itemsStillNeedingKoreanLabel.length,
        abilitiesNoKo: abilityResult.noKoreanName.length,
        reportFile: 'scripts/pokeapi-ko-gaps-report.json',
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
