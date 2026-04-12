import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const vm = require('vm');
const code = readFileSync(new URL('./formatter.js', import.meta.url), 'utf8');
const sandbox = { globalThis: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const sample = `#2 | 룸깔이 따라큐
따라큐
특성 : 탈
도구 : 반짝가루
성격 : 용감
HP : 162 32
공격 : 143 20
방어 : 113 13
특수공격 : 70 0
특수방어 : 126 1
스피드 : 104 0
기술 1 : 치근거리기
기술 2 : 야습
기술 3 : 저주
기술 4 : 트릭룸`;
console.log(sandbox.formatSample(sample));
