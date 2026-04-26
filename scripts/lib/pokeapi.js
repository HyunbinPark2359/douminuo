/**
 * scripts/ 의 generate-* / audit-* 스크립트가 공유하는 PokéAPI 호출 헬퍼.
 *
 *   const { fetchJson, listAll, fetchInChunks, mapInChunks } = require('./lib/pokeapi');
 *
 * Node 18+ (글로벌 fetch). zip 에 포함되지 않음 (개발자 머신 전용).
 *
 * 옛 패턴(매 스크립트가 자체 fetch + 페이지네이션 + chunk 동시성)을 정리한 것 — F-data-2.
 */
'use strict';

const DEFAULT_CHUNK = 12;

/**
 * GET <url> → JSON. 응답이 200 이 아니면 throw.
 */
async function fetchJson(url, init) {
  const res = await fetch(url, Object.assign({ headers: { Accept: 'application/json' } }, init || {}));
  if (!res.ok) throw new Error(url + ' ' + res.status);
  return res.json();
}

/**
 * 페이지네이션 (`?limit=&offset=` 또는 `next` 링크) 따라가며 전 결과 수집.
 *
 * @param {string} firstUrl 첫 페이지 URL (보통 `https://pokeapi.co/api/v2/<resource>?limit=2000` 등)
 * @param {object} [opts]
 * @param {boolean} [opts.useNext] true 면 page.next 따라감, false 면 firstUrl 만 (기본 true)
 * @returns {Promise<Array>} 모든 페이지의 results 합친 배열
 */
async function listAll(firstUrl, opts) {
  const useNext = !opts || opts.useNext !== false;
  const all = [];
  let next = firstUrl;
  while (next) {
    const j = await fetchJson(next);
    if (j && Array.isArray(j.results)) all.push(...j.results);
    if (!useNext) break;
    next = j && j.next ? j.next : null;
  }
  return all;
}

/**
 * 입력 배열을 chunkSize 크기로 슬라이스해 각 청크 안에서 Promise.all 동시 실행.
 *
 * @param {Array<T>} items
 * @param {(item: T) => Promise<R>} fn
 * @param {object} [opts]
 * @param {number} [opts.chunk=12]
 * @param {(done: number, total: number) => void} [opts.onProgress] 청크 끝날 때마다 호출
 * @returns {Promise<R[]>} fn 결과 배열 (실패 케이스 포함 — fn 이 throw 안 하도록 처리)
 */
async function mapInChunks(items, fn, opts) {
  const chunk = (opts && opts.chunk) || DEFAULT_CHUNK;
  const onProgress = opts && opts.onProgress;
  const out = new Array(items.length);
  for (let i = 0; i < items.length; i += chunk) {
    const slice = items.slice(i, i + chunk);
    const results = await Promise.all(slice.map(fn));
    for (let j = 0; j < results.length; j++) out[i + j] = results[j];
    if (typeof onProgress === 'function') {
      // promise 가 반환되면 await — 호출자가 청크 사이 throttle/sleep 을 끼울 수 있도록.
      const ret = onProgress(Math.min(i + chunk, items.length), items.length);
      if (ret && typeof ret.then === 'function') await ret;
    }
  }
  return out;
}

/**
 * URL 배열을 chunkSize 동시성으로 fetchJson. 실패한 항목은 null.
 */
async function fetchInChunks(urls, opts) {
  return mapInChunks(
    urls,
    async (u) => {
      try {
        return await fetchJson(u);
      } catch (e) {
        return null;
      }
    },
    opts
  );
}

module.exports = {
  fetchJson,
  listAll,
  fetchInChunks,
  mapInChunks,
};
