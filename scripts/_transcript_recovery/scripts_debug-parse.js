const fs = require('fs');

const ts = fs.readFileSync(
  process.argv[2] ||
    'C:/Users/qkrgu/.cursor/projects/c-Users-qkrgu-Documents-nuo-formatter/agent-tools/2af3c281-87da-4db0-91a1-31e9b9c4c760.txt',
  'utf8'
);

function extractBalanced(s, openIdx) {
  let depth = 0;
  let i = openIdx;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') {
      i += 2;
      while (i < n && s[i] !== '\n' && s[i] !== '\r') i++;
      continue;
    }
    if (c === '/' && s[i + 1] === '*') {
      i += 2;
      while (i < n - 1 && !(s[i] === '*' && s[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c;
      i++;
      while (i < n) {
        if (s[i] === '\\') {
          i += 2;
          continue;
        }
        if (s[i] === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === '{') {
      depth++;
      i++;
      continue;
    }
    if (c === '}') {
      depth--;
      i++;
      if (depth === 0) return { inner: s.slice(openIdx + 1, i - 1), end: i };
      continue;
    }
    i++;
  }
  throw new Error('unbalanced');
}

const marker = 'export const Moves:';
const idx = ts.indexOf(marker);
const eq = ts.indexOf('= {', idx);
const brace = ts.indexOf('{', eq);
const inner = extractBalanced(ts, brace).inner;
console.log('inner len', inner.length);
const pos = 483640;
console.log('--- context ---');
console.log(inner.slice(Math.max(0, pos - 150), Math.min(inner.length, pos + 150)));
