/* `regulationMaSpeedTable.json` 편집 후: node extension/embedSpeedData.js
 *
 * F-data-1: source JSON 의 fnv1a 해시를 함께 임베드. speedOutspeedCalc 가 런타임에
 * 같은 해시를 다시 계산해서 비교 — mismatch 면 console.warn 으로 "이 스크립트 재실행 필요"
 * 안내. 개발자가 JSON 만 편집하고 이 스크립트 실행을 잊은 silent stale 케이스 차단.
 */
const fs = require('fs');
const path = require('path');

function fnv1a(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const dir = __dirname;
const raw = fs.readFileSync(path.join(dir, 'regulationMaSpeedTable.json'), 'utf8');
const sourceHash = fnv1a(raw);
const j = JSON.stringify(JSON.parse(raw));
const out =
  "(function(){'use strict';" +
  "globalThis.NUO_REGULATION_MA_SPEED=" + j + ";" +
  "globalThis.NUO_REGULATION_MA_SPEED_SOURCE_HASH='" + sourceHash + "';" +
  "})();\n";
fs.writeFileSync(path.join(dir, 'regulationMaSpeedData.js'), out, 'utf8');
console.log('embedded ' + Object.keys(JSON.parse(raw).bySpeed || {}).length + ' speed tiers; source hash = ' + sourceHash);
