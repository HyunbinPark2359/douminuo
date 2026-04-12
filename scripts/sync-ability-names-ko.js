'use strict';

/**
 * modifiers.json 의 abilities 키(= PokeAPI ability slug)마다
 * GET /api/v2/ability/{slug}/ → names 중 language.name === 'ko'
 * → nameKo 설정 후 aliases 제거 (sync-item-names-ko.js 와 동일 정책).
 *
 * PokeAPI에 ko 가 없으면 scripts/ability-ko-fallback.json 에서 공식 한글명을 찾는다.
 * 거기도 없으면 기존 nameKo·aliases 유지하고 MISSING_KO 로그.
 *
 * node scripts/sync-ability-names-ko.js
 */
const fs = require('fs');
const path = require('path');

const modPath = path.join(__dirname, '..', 'extension', 'modifiers.json');
const fallbackPath = path.join(__dirname, 'ability-ko-fallback.json');
const DELAY_MS = 80;

function loadJsonObject(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
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

async function fetchAbilityKo(slug) {
  const url = 'https://pokeapi.co/api/v2/ability/' + encodeURIComponent(slug) + '/';
  const res = await fetch(url);
  if (!res.ok) return { slug, ko: null, err: res.status };
  const j = await res.json();
  return { slug, ko: koNameFromPayload(j), err: null };
}

async function main() {
  const mod = JSON.parse(fs.readFileSync(modPath, 'utf8'));
  const keys = Object.keys(mod.abilities || {});
  const missing = [];
  const fallback = loadJsonObject(fallbackPath);

  for (const slug of keys) {
    const row = await fetchAbilityKo(slug);
    const ab = mod.abilities[slug];
    if (!ab || typeof ab !== 'object') continue;

    let ko = row.ko;
    const fb = fallback[slug];
    if (!ko && typeof fb === 'string' && fb.trim()) {
      ko = fb.trim();
      console.log('FALLBACK_KO:', slug, '→', ko);
    }

    if (ko) {
      ab.nameKo = ko;
      delete ab.aliases;
    } else {
      missing.push(slug + (row.err ? ':' + row.err : ''));
      if (!ab.nameKo) {
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
  console.log('sync-ability-names-ko: wrote', modPath, 'abilities:', keys.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
