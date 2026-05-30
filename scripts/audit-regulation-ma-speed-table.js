/**
 * 레귤 M-A 스피드표 vs PokeAPI(+나무 스냅샷) 감사.
 *   node scripts/build-pokeapi-speed-cache.js   (최초 1회)
 *   node scripts/fetch-regulation-ma-speed-namu.js  (선택)
 *   node scripts/audit-regulation-ma-speed-table.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadTable,
  flattenTable,
  loadOverrides,
  resolvePokeapiTarget,
  resolveRefSpeed,
} = require('./lib/regulationMaSpeedAudit');

const CACHE = path.join(__dirname, '.cache', 'pokeapi-speed-cache.json');
const NAMU_REF = path.join(__dirname, 'regulationMaSpeedRefNamu.json');
const OUT = path.join(__dirname, 'regulation-ma-speed-audit-report.json');

function main() {
  if (!fs.existsSync(CACHE)) {
    console.error('Missing', CACHE, '— run: node scripts/build-pokeapi-speed-cache.js');
    process.exit(1);
  }
  const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const speciesKo = cache.speciesKo || {};
  const pokemonBySlug = cache.pokemonBySlug || {};

  let namuRef = null;
  if (fs.existsSync(NAMU_REF)) {
    namuRef = JSON.parse(fs.readFileSync(NAMU_REF, 'utf8'));
  }

  const ovDoc = loadOverrides();
  const overrides = ovDoc.overrides || {};

  const entries = flattenTable(loadTable());
  const mismatch = [];
  const unmapped = [];
  const conflict = [];
  const ok = [];
  const duplicate = [];
  /** PokeAPI slug 기준과 티어 불일치 — refSpeed 오버라이드 없음 (사용자 검토용). */
  const suspicious = [];

  const seen = {};
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (seen[e.name]) duplicate.push({ name: e.name, tiers: [seen[e.name], e.tierSpeed] });
    else seen[e.name] = e.tierSpeed;
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const ov = overrides[e.name] || {};
    const target = resolvePokeapiTarget(e.name, ov, speciesKo, pokemonBySlug);
    if (!target) {
      unmapped.push({ name: e.name, ourTier: e.tierSpeed, reason: 'no_pokeapi_slug' });
      continue;
    }
    const refPoke =
      target.slug && pokemonBySlug[target.slug] ? pokemonBySlug[target.slug].speed : null;
    const ref = resolveRefSpeed(target, pokemonBySlug);
    if (ref == null) {
      unmapped.push({ name: e.name, ourTier: e.tierSpeed, reason: 'no_ref_speed' });
      continue;
    }
    const refNamu = namuRef && namuRef.byName ? namuRef.byName[e.name] : null;

    if (refNamu != null && refPoke != null && refNamu !== refPoke) {
      conflict.push({
        name: e.name,
        ourTier: e.tierSpeed,
        refPokeapi: refPoke,
        refNamu: refNamu,
        slug: target.slug,
      });
    }

    if (
      refPoke != null &&
      e.tierSpeed !== refPoke &&
      !(ov.refSpeed != null) &&
      target.source !== 'override-refSpeed'
    ) {
      suspicious.push({
        name: e.name,
        ourTier: e.tierSpeed,
        refPokeapi: refPoke,
        slug: target.slug,
        resolveSource: target.source,
      });
    }
    if (ref == null) {
      unmapped.push({ name: e.name, ourTier: e.tierSpeed, reason: 'no_speed_stat' });
      continue;
    }
    if (e.tierSpeed !== ref) {
      mismatch.push({
        name: e.name,
        ourTier: e.tierSpeed,
        refSpeed: ref,
        refNamu: refNamu,
        delta: ref - e.tierSpeed,
        slug: target.slug,
        resolveSource: target.source,
      });
    } else {
      ok.push({ name: e.name, speed: ref });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: entries.length,
      ok: ok.length,
      mismatch: mismatch.length,
      suspicious: suspicious.length,
      unmapped: unmapped.length,
      conflict: conflict.length,
      duplicate: duplicate.length,
      namuSnapshot: !!(namuRef && namuRef.byName),
    },
    mismatch: mismatch.sort(function (a, b) {
      return Math.abs(b.delta) - Math.abs(a.delta);
    }),
    suspicious: suspicious.sort(function (a, b) {
      return Math.abs(b.refPokeapi - b.ourTier) - Math.abs(a.refPokeapi - a.ourTier);
    }),
    unmapped: unmapped,
    conflict: conflict,
    duplicate: duplicate,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('Summary:', JSON.stringify(report.summary, null, 2));
  console.log('Wrote', OUT);
  if (mismatch.length) {
    console.log('\nTop mismatches:');
    for (let m = 0; m < Math.min(20, mismatch.length); m++) {
      const x = mismatch[m];
      console.log(' ', x.name, 'our', x.ourTier, 'ref', x.refSpeed, 'slug', x.slug);
    }
  }
  if (unmapped.length) {
    console.log('\nUnmapped (' + unmapped.length + '):');
    for (let u = 0; u < Math.min(15, unmapped.length); u++) {
      console.log(' ', unmapped[u].name);
    }
  }
  if (suspicious.length) {
    console.log('\nSuspicious (tier vs PokeAPI, no refSpeed override):');
    for (let s = 0; s < suspicious.length; s++) {
      const x = suspicious[s];
      console.log(' ', x.name, 'tier', x.ourTier, 'pokeapi', x.refPokeapi, x.slug);
    }
  }
}

main();
