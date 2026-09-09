// LEGACY: champions_pokemon.json 기반 파이프라인(scripts/fetch-champions-speed-table.js)으로 대체됨. 참고용으로만 보관.
/**
 * 나무위키 종족치 스피드 스냅샷 (rate limit).
 *   node scripts/legacy/fetch-regulation-ma-speed-namu.js
 *   node scripts/legacy/fetch-regulation-ma-speed-namu.js --limit 10
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadTable,
  flattenTable,
  loadOverrides,
  resolveNamuPage,
  namuWikiUrl,
  parseNamuSpeed,
  sleep,
} = require('../lib/regulationSpeedAudit');

const OUT = path.join(__dirname, 'regulationMaSpeedRefNamu.json');
const PAGE_CACHE = path.join(__dirname, '.cache', 'namu-html');

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'nuo-formatter-speed-audit/1.0 (local dev)',
      Accept: 'text/html',
    },
  });
  if (!res.ok) return { ok: false, status: res.status, html: '' };
  return { ok: true, status: res.status, html: await res.text() };
}

async function getPageHtml(page, cache) {
  if (cache[page]) return cache[page];
  const alt = page.indexOf('(포켓몬스터)') < 0 ? page + '(포켓몬스터)' : page;
  const urls = [namuWikiUrl(page)];
  if (alt !== page) urls.push(namuWikiUrl(alt));

  for (let u = 0; u < urls.length; u++) {
    const r = await fetchHtml(urls[u]);
    await sleep(1200);
    if (r.ok && r.html.length > 500) {
      cache[page] = r.html;
      return r.html;
    }
  }
  cache[page] = null;
  return null;
}

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : 0;

  if (!fs.existsSync(PAGE_CACHE)) fs.mkdirSync(PAGE_CACHE, { recursive: true });

  const ovDoc = loadOverrides();
  const overrides = ovDoc.overrides || {};
  let entries = flattenTable(loadTable());
  if (limit > 0) entries = entries.slice(0, limit);

  const pageCache = {};
  const byName = {};
  const parseFailures = [];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const ov = overrides[e.name] || {};
    const resolved = resolveNamuPage(e.name, ov);
    const page = (ov.namu && ov.namu.page) || resolved.page;
    const form = (ov.namu && ov.namu.form) || resolved.form;

    process.stdout.write('[' + (i + 1) + '/' + entries.length + '] ' + e.name + ' … ');
    const html = await getPageHtml(page, pageCache);
    if (!html) {
      parseFailures.push({ name: e.name, page: page, reason: 'fetch_failed' });
      console.log('FAIL fetch');
      continue;
    }
    const sp = parseNamuSpeed(html, form);
    if (sp == null) {
      parseFailures.push({ name: e.name, page: page, form: form, reason: 'parse_failed' });
      console.log('FAIL parse');
      continue;
    }
    byName[e.name] = sp;
    console.log(sp);
  }

  const doc = {
    fetchedAt: new Date().toISOString(),
    byName: byName,
    parseFailures: parseFailures,
  };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log('Wrote', OUT, 'ok', Object.keys(byName).length, 'fail', parseFailures.length);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
