/**
 * 레귤 M-A 스피드표 감사 — flatten, 나무위키 URL 해석, HTML 종족치 파싱.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TABLE_JSON = path.join(ROOT, 'extension', 'regulationMaSpeedTable.json');
const OVERRIDES_JSON = path.join(__dirname, '..', 'regulationMaSpeedKoToSlug.json');

function loadTable() {
  return JSON.parse(fs.readFileSync(TABLE_JSON, 'utf8'));
}

function flattenTable(doc) {
  const out = [];
  const by = doc.bySpeed || doc;
  const keys = Object.keys(by).sort(function (a, b) {
    return parseInt(b, 10) - parseInt(a, 10);
  });
  for (let i = 0; i < keys.length; i++) {
    const tier = parseInt(keys[i], 10);
    const arr = by[keys[i]] || [];
    for (let j = 0; j < arr.length; j++) {
      out.push({ name: arr[j], tierSpeed: tier });
    }
  }
  return out;
}

function loadOverrides() {
  try {
    return JSON.parse(fs.readFileSync(OVERRIDES_JSON, 'utf8'));
  } catch (e) {
    return { overrides: {} };
  }
}

/**
 * 나무위키 문서 제목·폼 라벨 후보 (사용자 규칙).
 * @returns {{ page: string, form: string|null, triedPages: string[] }}
 */
function resolveNamuPage(displayName, ov) {
  const tried = [];
  const entry = ov && ov.namu ? ov.namu : null;
  if (entry && entry.page) {
    return { page: entry.page, form: entry.form || null, triedPages: [entry.page] };
  }

  function push(p) {
    if (tried.indexOf(p) < 0) tried.push(p);
  }

  let form = null;
  let page = displayName;

  if (displayName.indexOf('메가') === 0) {
    form = displayName;
    page = displayName.slice(2);
    push(displayName);
    push(page);
    push(page + '(포켓몬스터)');
    return { page: page, form: form, triedPages: tried };
  }

  push(displayName);
  push(displayName + '(포켓몬스터)');
  return { page: displayName, form: null, triedPages: tried };
}

function namuWikiUrl(page) {
  return 'https://namu.wiki/w/' + encodeURIComponent(page);
}

/**
 * 나무위키 HTML 에서 종족치 스피드 추출.
 * @param {string} html
 * @param {string|null} formLabel — 메가/지역폼 라벨 (예: 메가후딘)
 */
function parseNamuSpeed(html, formLabel) {
  if (!html) return null;

  if (formLabel) {
    const idx = html.indexOf(formLabel);
    if (idx >= 0) {
      const chunk = html.slice(idx, idx + 12000);
      const sp = extractSpeedFromStatBlock(chunk);
      if (sp != null) return sp;
    }
  }

  const markers = ['종족치', '종족값', 'Base Stats'];
  for (let m = 0; m < markers.length; m++) {
    const mi = html.indexOf(markers[m]);
    if (mi < 0) continue;
    const chunk = html.slice(mi, mi + 8000);
    const sp = extractSpeedFromStatBlock(chunk);
    if (sp != null) return sp;
  }

  return extractSpeedFromStatBlock(html.slice(0, 50000));
}

function extractSpeedFromStatBlock(text) {
  const plain = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  const m1 = plain.match(/스피드\s*Spe(?:ed)?\s*(\d{1,3})/i);
  if (m1) return parseInt(m1[1], 10);

  const m2 = plain.match(
    /HP\s*Hp?\s*\d+\s+공격\s*\d+\s+방어\s*\d+\s+특수공격\s*\d+\s+특수방어\s*\d+\s+스피드\s*(\d{1,3})/i
  );
  if (m2) return parseInt(m2[1], 10);

  const labels = plain.split(/\s+/);
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === '스피드' && i + 1 < labels.length) {
      const n = parseInt(labels[i + 1], 10);
      if (n >= 1 && n <= 255) return n;
    }
  }
  return null;
}

/**
 * displayName → PokeAPI pokemon slug/id (overrides + 규칙).
 */
function resolvePokeapiTarget(displayName, ov, speciesKo, pokemonBySlug) {
  const entry = ov || {};
  if (entry.refSpeed != null) {
    return {
      slug: entry.pokeapi || null,
      refSpeed: entry.refSpeed,
      source: 'override-refSpeed',
    };
  }
  if (entry.pokeapi) {
    return { slug: entry.pokeapi, source: 'override' };
  }

  const slug = guessPokeapiSlug(displayName, speciesKo, pokemonBySlug);
  if (slug) return { slug: slug, source: 'guess' };
  return null;
}

/** 감사·표 수정에 쓸 기준 스피드 (refSpeed 우선, 없으면 PokeAPI). */
function resolveRefSpeed(target, pokemonBySlug) {
  if (!target) return null;
  if (target.refSpeed != null) return target.refSpeed;
  if (!target.slug || !pokemonBySlug[target.slug]) return null;
  return pokemonBySlug[target.slug].speed;
}

function guessPokeapiSlug(displayName, speciesKo, pokemonBySlug) {
  if (pokemonBySlug[displayName]) return displayName;

  let base = displayName;
  let suffix = '';

  if (displayName.indexOf('메가') === 0) {
    const rest = displayName.slice(2);
    if (rest === '리자몽X') return 'charizard-mega-x';
    if (rest === '리자몽Y') return 'charizard-mega-y';
    if (rest === '캥카') return 'pinsir-mega';
    if (rest === '메가니움') return 'meganium-mega';
    base = rest;
    suffix = '-mega';
  }

  const paren = displayName.match(/^(.+?)\((.+)\)$/);
  if (paren && displayName.indexOf('메가') !== 0) {
    base = paren[1];
    const tag = paren[2];
    if (tag === '가라르') suffix = '-galar';
    else if (tag === '히스이') suffix = '-hisui';
    else if (tag === '알로라') suffix = '-alola';
    else if (tag === '팔데아') suffix = '-paldea';
    else if (tag === '한밤중') suffix = '-midnight';
    else if (tag === '황혼') suffix = '-dusk';
    else if (tag === '한낮') suffix = '-midday';
    else if (tag === '영원의꽃') suffix = '-eternal';
    else if (tag === '폼체인지') suffix = '';
    else if (tag === '소과종') suffix = '-small';
    else if (tag === '중과종') suffix = '-average';
    else if (tag === '대과종') suffix = '-large';
    else if (tag === '특대과종') suffix = '-super';
  }

  const sp = speciesKo[base];
  if (!sp || !sp.en) return null;

  const candidates = [];
  if (suffix) candidates.push(sp.en + suffix);
  if (displayName.indexOf('메가') === 0) {
    candidates.push(sp.en + '-mega');
    candidates.push(sp.en + '-mega-x');
    candidates.push(sp.en + '-mega-y');
  }
  candidates.push(sp.en);
  candidates.push(
    sp.en + '-male',
    sp.en + '-female',
    sp.en + '-shield',
    sp.en + '-blade',
    sp.en + '-zero',
    sp.en + '-hero',
    sp.en + '-full-belly',
    sp.en + '-family-of-four',
    sp.en + '-disguised',
    sp.en + '-midnight',
    sp.en + '-midday',
    sp.en + '-dusk',
    sp.en + '-eternal',
    sp.en + '-small',
    sp.en + '-average',
    sp.en + '-large',
    sp.en + '-super',
    sp.en + '-galar',
    sp.en + '-hisui',
    sp.en + '-alola',
    sp.en + '-paldea-combat-breed'
  );

  for (let i = 0; i < candidates.length; i++) {
    if (pokemonBySlug[candidates[i]]) return candidates[i];
  }

  if (displayName.indexOf('메가') === 0) {
    for (const slug in pokemonBySlug) {
      if (slug.indexOf(sp.en + '-mega') === 0) return slug;
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

module.exports = {
  ROOT,
  TABLE_JSON,
  OVERRIDES_JSON,
  loadTable,
  flattenTable,
  loadOverrides,
  resolveNamuPage,
  namuWikiUrl,
  parseNamuSpeed,
  resolvePokeapiTarget,
  resolveRefSpeed,
  guessPokeapiSlug,
  sleep,
};
