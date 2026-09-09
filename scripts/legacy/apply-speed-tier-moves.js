// LEGACY: champions_pokemon.json 기반 파이프라인(scripts/fetch-champions-speed-table.js)으로 대체됨. 참고용으로만 보관.
/**
 * 티어 이동 — regulationSpeedTable.json
 *   node scripts/legacy/apply-speed-tier-moves.js
 */
'use strict';

const fs = require('fs');
const { loadTable, TABLE_JSON } = require('../lib/regulationSpeedAudit');

const MOVES = [
  { name: '픽시', to: 60 },
  { name: '펌킨인(소과종)', to: 99 },
  { name: '펌킨인(중과종)', to: 84 },
  { name: '펌킨인(대과종)', to: 69 },
  { name: '펌킨인(특대과종)', to: 54 },
  { name: '로토무(폼체인지)', to: 86 },
  { name: '메가캥카', to: 100 },
];

function main() {
  const doc = loadTable();
  const by = doc.bySpeed;

  for (let i = 0; i < MOVES.length; i++) {
    const mv = MOVES[i];
    let fromKey = null;
    for (const k in by) {
      const arr = by[k];
      if (arr.indexOf(mv.name) >= 0) {
        fromKey = k;
        arr.splice(arr.indexOf(mv.name), 1);
        if (!arr.length) delete by[k];
        break;
      }
    }
    const toKey = String(mv.to);
    if (!by[toKey]) by[toKey] = [];
    if (by[toKey].indexOf(mv.name) < 0) by[toKey].push(mv.name);
    console.log(mv.name, (fromKey || '?') + ' -> ' + mv.to);
  }

  const sorted = {};
  const keys = Object.keys(by).sort(function (a, b) {
    return parseInt(a, 10) - parseInt(b, 10);
  });
  for (let k = 0; k < keys.length; k++) {
    sorted[keys[k]] = by[keys[k]].sort();
  }
  doc.bySpeed = sorted;
  fs.writeFileSync(TABLE_JSON, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log('Updated', TABLE_JSON);
}

main();
