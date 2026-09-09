/**
 * audit 리포트 mismatch 를 regulationSpeedTable.json 에 반영.
 *   node scripts/apply-speed-audit-fixes.js
 *   node scripts/apply-speed-audit-fixes.js --dry-run
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadTable, TABLE_JSON } = require('./lib/regulationSpeedAudit');

const REPORT = path.join(__dirname, 'regulation-speed-audit-report.json');

function main() {
  const dry = process.argv.indexOf('--dry-run') >= 0;
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const doc = loadTable();
  const by = doc.bySpeed;

  const moves = [];
  for (let i = 0; i < report.mismatch.length; i++) {
    const m = report.mismatch[i];
    if (m.refNamu != null && m.refSpeed != null && m.refNamu !== m.refSpeed) {
      continue;
    }
    const ref = m.refSpeed;
    if (ref == null) continue;
    moves.push({ name: m.name, from: m.ourTier, to: ref });
  }

  for (let j = 0; j < moves.length; j++) {
    const mv = moves[j];
    const fromKey = String(mv.from);
    const toKey = String(mv.to);
    const arr = by[fromKey];
    if (!arr) continue;
    const idx = arr.indexOf(mv.name);
    if (idx < 0) continue;
    arr.splice(idx, 1);
    if (!arr.length) delete by[fromKey];
    if (!by[toKey]) by[toKey] = [];
    if (by[toKey].indexOf(mv.name) < 0) by[toKey].push(mv.name);
    console.log(mv.name, mv.from, '->', mv.to);
  }

  const keys = Object.keys(by).sort(function (a, b) {
    return parseInt(a, 10) - parseInt(b, 10);
  });
  const sorted = {};
  for (let k = 0; k < keys.length; k++) {
    sorted[keys[k]] = by[keys[k]].sort();
  }
  doc.bySpeed = sorted;
  doc.meta = doc.meta || {};
  doc.meta.verifiedAt = new Date().toISOString().slice(0, 10);
  doc.meta.reference = 'pokeapi+namuwiki-audit';

  if (dry) {
    console.log('dry-run:', moves.length, 'moves');
    return;
  }
  fs.writeFileSync(TABLE_JSON, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log('Updated', TABLE_JSON);
}

main();
