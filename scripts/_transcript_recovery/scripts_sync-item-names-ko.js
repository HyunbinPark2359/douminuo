'use strict';

/**
 * modifiers.json 의 items 키(= PokeAPI item slug)마다
 * GET /api/v2/item/{slug}/ → names 중 language.name === 'ko' 를 읽어
 * 각 항목에 nameKo 를 넣고, 한글은 PokeAPI 출처만 쓰도록 aliases 를 제거한다.
 *
 * PokeAPI에 ko 가 없으면 scripts/item-ko-fallback.json 에서 공식 한글명을 찾는다.
 * 거기도 없으면 nameKo 는 건드리지 않고 aliases 는 유지하며 MISSING_KO 로그.
 *
 * node scripts/sync-item-names-ko.js
 */
const fs = require('fs');
const path = require('path');

const modPath = path.join(__dirname, '..', 'extension', 'modifiers.json');
const fallbackPath = path.join(__dirname, 'item-ko-fallback.json');
const DELAY_MS = 80;

function loadFallback() {
  try {
    const raw = fs.readFileSync(fallbackPath, 'utf8');
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : {};
  } catch (e) {
    return {};
  }
}

function koNameFromPayload(j) {
  if (!j || !Array.isArray(j.names)) return null;
  const row = j.names.find((n) => n.language && n.language.name === 'ko');
  return row && row.name ? String(row.name).trim() : null;
}

async function fetchItemKo(slug) {
  const url = 'https://pokeapi.co/api/v2/item/' + encodeURIComponent(slug) + '/';
  const res = await fetch(url);
  if (!res.ok) return { slug, ko: null, err: res.status };
  const j = await res.json();
  return { slug, ko: koNameFromPayload(j), err: null };
}

async function main() {
  const mod = JSON.parse(fs.readFileSync(modPath, 'utf8'));
  const itemKeys = Object.keys(mod.items || {});
  const missing = [];
  const fallback = loadFallback();

  for (const slug of itemKeys) {
    const row = await fetchItemKo(slug);
    const item = mod.items[slug];
    if (!item || typeof item !== 'object') continue;

    let ko = row.ko;
    const fb = fallback[slug];
    if (!ko && typeof fb === 'string' && fb.trim()) {
      ko = fb.trim();
      console.log('FALLBACK_KO:', slug, '→', ko);
    }

    if (ko) {
      item.nameKo = ko;
      delete item.aliases;
    } else {
      missing.push(slug + (row.err ? ':' + row.err : ''));
      if (!item.nameKo) {
        console.error('MISSING_KO (no nameKo, keep aliases if any):', slug, row.err || '');
      }
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  fs.writeFileSync(modPath, JSON.stringify(mod, null, 2) + '\n', 'utf8');

  if (missing.length) {
    console.error('MISSING_KO count:', missing.length);
    console.error(missing.join('\n'));
  }
  console.log('sync-item-names-ko: wrote', modPath, 'items:', itemKeys.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
