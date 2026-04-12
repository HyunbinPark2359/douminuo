/**
 * Showdown/포맷터용 한글·영문 맵 일괄 갱신 (PokeAPI + Showdown moves.ts).
 *   node scripts/refresh-ko-maps-from-pokeapi.js
 *
 * 순서: moveTags → moveKoMap → itemKoMap → abilityKoMap → moveSlugToEn
 * (수 분~십여 분, 네트워크 필요)
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const node = process.execPath;
const dir = __dirname;

const steps = [
  'generate-move-tags.js',
  'generate-move-ko-map.js',
  'generate-item-ko-map.js',
  'generate-ability-ko-map.js',
  'generate-move-slug-to-en.js',
];

for (const script of steps) {
  console.error('\n==>', script);
  const r = spawnSync(node, [path.join(dir, script)], {
    stdio: 'inherit',
    cwd: path.join(dir, '..'),
    env: process.env,
  });
  if (r.status !== 0) {
    console.error('failed:', script);
    process.exit(r.status === null ? 1 : r.status);
  }
}

console.error('\nrefresh-ko-maps-from-pokeapi: ok');
console.error('optional: node scripts/audit-pokeapi-ko-gaps.js');
