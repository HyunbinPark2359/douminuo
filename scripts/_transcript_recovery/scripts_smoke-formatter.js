'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const formatterPath = path.join(root, 'extension', 'formatter.js');
const modifiersPath = path.join(root, 'extension', 'modifiers.json');

const ctx = { globalThis: {}, self: {}, console };
ctx.globalThis = ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(formatterPath, 'utf8'), ctx);
const formatSample = ctx.formatSample;
const modifiersDocument = JSON.parse(fs.readFileSync(modifiersPath, 'utf8'));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const raw = [
  '#1|Test',
  'HP : 125 0',
  '공격 : 100 0',
  '방어 : 50 0',
  '특수공격 : 100 0',
  '특수방어 : 60 0',
  '스피드 : 100 0',
  '테라스탈 : 불꽃',
  '기술1 : Tackle',
  '기술2 : --',
  '기술3 : --',
  '기술4 : --',
].join('\n');

const out = formatSample(raw, {
  includeBulkStats: true,
  includeUrls: false,
  modifiersDocument,
});
const wantPhys = Math.round((125 * 50) / 0.411);
const wantSpec = Math.round((125 * 60) / 0.411);
assert(out.includes('물리내구력:' + wantPhys), 'phys bulk');
assert(out.includes('특수내구력:' + wantSpec), 'spec bulk');
const iTera = out.indexOf('테라스탈');
const iPhys = out.indexOf('물리내구력');
const iMove = out.indexOf('Tackle');
assert(iTera !== -1 && iPhys > iTera && iMove > iPhys, 'order: 테라스탈 → 내구력 → 기술');

const off = formatSample(raw, { includeBulkStats: false, includeUrls: false, modifiersDocument });
assert(!off.includes('물리내구력'), 'off switch');

const rawVest = raw.replace(/#1\|Test/, '#1|Test').replace(
  '특성 :',
  '도구 : 돌격조끼\n특성 :'
);
// inject 도구 line after title block - simpler: prepend 도구 to a dedicated raw
const rawVest2 = [
  '#1|Test',
  '특성 : --',
  '도구 : 돌격조끼',
  '성격 : --',
  'HP : 100 0',
  '공격 : 100 0',
  '방어 : 80 0',
  '특수공격 : 100 0',
  '특수방어 : 80 0',
  '스피드 : 100 0',
  '기술1 : --',
  '기술2 : --',
  '기술3 : --',
  '기술4 : --',
].join('\n');

const vestOut = formatSample(rawVest2, {
  includeBulkStats: true,
  includeUrls: false,
  modifiersDocument,
});
const specBase = Math.round((100 * 80) / 0.411);
const specBuff = Math.round((100 * Math.round(80 * 1.5)) / 0.411);
assert(vestOut.includes('물리내구력:' + Math.round((100 * 80) / 0.411), 'vest phys same line');
assert(vestOut.includes('특수내구력:' + specBase + ' (' + specBuff + ')'), 'vest spec paren: ' + vestOut);

console.log('smoke-formatter: ok');
