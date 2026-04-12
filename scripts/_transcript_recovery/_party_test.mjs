import { readFileSync } from 'fs';
import vm from 'node:vm';

const code = readFileSync(new URL('./formatter.js', import.meta.url), 'utf8');
const ctx = { globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);

const input = readFileSync(new URL('./_party_input.txt', import.meta.url), 'utf8');
const expected = readFileSync(new URL('./_party_expected.txt', import.meta.url), 'utf8');

const got = ctx.formatSample(input);
if (got === expected.trimEnd()) {
  console.log('OK');
} else {
  console.log('MISMATCH');
  console.log('--- got ---');
  console.log(got);
  console.log('--- expected ---');
  console.log(expected.trimEnd());
}
