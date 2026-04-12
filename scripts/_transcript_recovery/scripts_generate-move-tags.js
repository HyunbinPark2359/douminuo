/**
 * Pokemon Showdown data/moves.ts → extension/moveTags.json
 * Node 18+ (fetch). Usage:
 *   node scripts/generate-move-tags.js [path/to/moves.ts]
 * Without arg, downloads master from GitHub raw.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_URL =
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts';
const OUT = path.join(__dirname, '..', 'extension', 'moveTags.json');

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
  throw new Error('unbalanced braces');
}

function extractMovesInner(ts) {
  const marker = 'export const Moves:';
  const idx = ts.indexOf(marker);
  if (idx === -1) throw new Error('export const Moves not found');
  const eq = ts.indexOf('= {', idx);
  if (eq === -1) throw new Error('Moves = { not found');
  const brace = ts.indexOf('{', eq);
  return extractBalanced(ts, brace).inner;
}

function parseTopLevelKeys(content) {
  const entries = {};
  let i = 0;
  const n = content.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(content[i])) i++;
    if (i >= n) break;

    let key;
    if (content[i] === '"') {
      i++;
      key = '';
      while (i < n && content[i] !== '"') {
        if (content[i] === '\\') i++;
        key += content[i++];
      }
      if (content[i] !== '"') throw new Error('unclosed key string');
      i++;
    } else {
      key = '';
      while (i < n && /[a-z0-9_]/i.test(content[i])) key += content[i++];
    }

    while (i < n && /\s/.test(content[i])) i++;
    if (content[i] !== ':') throw new Error('expected : after key ' + key + ' at ' + i);
    i++;
    while (i < n && /\s/.test(content[i])) i++;
    if (content[i] !== '{') throw new Error('expected { for move ' + key);
    const { inner, end } = extractBalanced(content, i);
    entries[key] = inner;
    i = end;
  }
  return entries;
}

function parseFlagsObject(body) {
  const tags = {};
  const m = body.match(/flags:\s*(\{[^}]*\})/);
  if (!m) return tags;
  const inner = m[1].slice(1, -1);
  const re = /(\w+)\s*:\s*(1|true)\b/g;
  let x;
  while ((x = re.exec(inner)) !== null) {
    tags[x[1]] = true;
  }
  return tags;
}

function parseCategory(body) {
  const m = body.match(/category:\s*"(Physical|Special|Status)"/);
  return m ? m[1] : '';
}

function hasRecoil(body) {
  return /\brecoil:\s*\[/.test(body);
}

function hasSecondaryBlock(body) {
  return /\bsecondary:\s*\{/.test(body);
}

function buildTagsForMoveBody(body) {
  const tags = parseFlagsObject(body);
  const cat = parseCategory(body);
  if (hasRecoil(body)) tags.recoil = true;
  if ((cat === 'Physical' || cat === 'Special') && hasSecondaryBlock(body)) {
    tags.sheerForceEligible = true;
  }
  return tags;
}

async function loadSource() {
  const arg = process.argv[2];
  if (arg) {
    return fs.readFileSync(path.resolve(arg), 'utf8');
  }
  const res = await fetch(DEFAULT_URL);
  if (!res.ok) throw new Error('fetch moves.ts ' + res.status);
  return res.text();
}

async function main() {
  const ts = await loadSource();
  const inner = extractMovesInner(ts);
  const byKey = parseTopLevelKeys(inner);
  const moves = {};
  for (const k of Object.keys(byKey)) {
    const tags = buildTagsForMoveBody(byKey[k]);
    if (Object.keys(tags).length) moves[k] = tags;
  }
  const doc = {
    version: 1,
    source: 'pokemon-showdown data/moves.ts',
    sourceUrl: DEFAULT_URL,
    generatedAt: new Date().toISOString(),
    moves,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 0) + '\n', 'utf8');
  console.log('Wrote', OUT, 'moves with tags:', Object.keys(moves).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
