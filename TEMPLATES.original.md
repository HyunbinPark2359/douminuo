# 도우미누오 — 코드 템플릿 & 레이어 가이드

> **이 문서의 목적**
> - 새로운 기능을 추가하거나 기존 동작을 손볼 때마다 “어느 레이어를 건드리는지 → 어떤 코드 골격을 따라야 하는지 → 어떤 skill·agent를 부르면 도움이 되는지”를 한 곳에서 보기 위함.
> - [research.md](./research.md)가 “현재 코드가 어떻게 동작하는가”라면, 이 문서는 “새 코드를 어떻게 짤 것인가”의 패턴 모음이다.
> - **살아 있는 문서**다. 새로운 패턴이 정착할 때마다 §11(업데이트 로그)에 한 줄을 더하고, 레이어 본문에 패턴을 추가한다.
>
> **사용 흐름**
> 1. 작업 의도를 한 줄로 적는다 (예: “팀빌더 인라인에 타입 약점 표시 추가”).
> 2. §1 의 레이어 매트릭스로 “어디를 만지는지” 식별.
> 3. 해당 §의 템플릿을 베이스로 작성. 이 프로젝트의 ES5 스타일·IIFE·`globalThis.<NAME>` 컨벤션을 그대로 유지.
> 4. §10 의 “workflow recipes” 중 가까운 항목을 골라 순서대로 진행.
> 5. PR 전 §9 의 “체크리스트”를 통과시킨다.
> 6. 새 패턴을 만들었거나 기존 패턴을 깬 합당한 이유가 있으면 본 문서를 업데이트.

---

## 0. 프로젝트 코드 컨벤션 (모든 레이어 공통)

이 컨벤션은 모든 레이어에 적용되며, 새 코드도 동일하게 따른다 (CLAUDE 프로젝트 룰에 박혀 있음).

- **언어/스타일**: 런타임 코드는 ES5 스타일 — `var`, IIFE, `function () { ... }`, 콜백. async/await·class·let/const·화살표 함수 도입 금지(파일 스타일을 따라간다는 룰). `scripts/`의 Node 도구만 예외.
- **export**: `(function (g) { ... ; g.<NAME> = { ... }; })(typeof globalThis !== 'undefined' ? globalThis : self);`
- **import**: `var FOO = globalThis.<NAME>;` 또는 SW에서는 `importScripts('foo.js')` (manifest content_scripts 배열 순서를 강제 — 의존성 순).
- **JSDoc**: 한국어 주석, 의도/근거 위주. 함수 시그너처에는 `@param`, `@returns` 정확히.
- **키 네이밍**: 사용자 환경설정은 `nuo_fmt_<name>`, SW 캐시는 `nuo_fmt_<bundle>Cache`, MAIN bridge 가드는 `__NUO_<NAME>_BRIDGE_<VER>__`.
- **postMessage 프로토콜**: `{ source: 'nuo-<feature>-(ext|page|bridge)', type: 'NUO_<VERB>_<NOUN>_V<n>', requestId, ... }`. requestId로 응답 매칭, 항상 timeout.
- **에러 코드**: 사용자에게 노출되는 모든 에러는 `mapCalcFillError` 같은 단일 매퍼를 거쳐 한국어로. 사용자 메시지에 영문 에러 코드 직접 노출 금지.
- **조용한 실패**: `chrome.runtime.lastError`, `chrome.storage` 실패는 try/catch 또는 lastError 체크 후 기본값으로 폴백. 사이트 페이지의 동작을 막거나 콘솔 폭주를 일으키지 않는다.
- **호스트 권한**: 코드가 새 도메인을 fetch하면 manifest `host_permissions`를 갱신해야 한다 — 가능하면 추가하지 않는다(PRIVACY.md 영향).
- **스코프**: 요청된 것만 구현. drive-by 리팩터·미관 정리·새 의존성 도입 금지.

---

## 1. 레이어 매트릭스 (어디를 만질지)

| 작업 의도 예시 | 영향 받는 레이어 | 비고 |
|----------------|----------------|------|
| 새 도구·특성 결정력 룰 추가 | §3 데이터 + §4.1 결정력 | `modifiers.json` + (필요 시) `simpleMovePower.js` 분기 |
| 새 기술 위력 메커닉 (예: 다단히트) | §4.1 결정력 + §3 데이터(`moveTags.json`) | scripts/ 도구로 `moveTags.json` 재생성 |
| 팀빌더 인라인에 새 항목 표시 | §5.3 콘텐츠 + §4.1 결정력 + §2 SW(`ANNOTATE_BUILDER_SLOT` 응답) | Phase 2 atomic swap 패턴 유지 |
| 계산기에 새 필드 자동 입력 | §6 MAIN bridge + §4.2 페이로드 | Vue prop 이름·세대 nextTick 시퀀스 주의 |
| 환경설정 옵션 추가 | §7 팝업 + 해당 레이어 reader | `chrome.storage.local` 키만 단일 진실 |
| 새 사이트 도메인 지원 | §1 manifest + §5 매칭 + PRIVACY.md | host_permissions 갱신, **사실상 권장 안 함** |
| Showdown 변환 규칙 변경 | §4.3 Showdown 변환 | EV DP 동작 단위테스트화 권장 (§9) |
| 새 스피드 종족표/포맷 | §8 임베드 데이터 + §5.4 스피드 패널 | `embedSpeedData.js` 재실행 |
| 신규 외부 API 호출 | §2 SW + manifest + PRIVACY.md | host_permissions·정책 변경 동시 진행 |

---

## 2. 레이어 A — Service Worker / Background

**파일**: `extension/background.js` + `importScripts(...)`로 합쳐지는 SW 모듈 (`shareToRaw.js`, `fmtCommon.js`, `formatter.js`, `calcPayload.js`, `simpleMovePower.js`, `attackerFormOverride.js`, `showdownPaste.js`).

**역할**: 외부 fetch, 사이트 API 호출, 결정력/내구력 계산, 메시지 라우팅.

### 2.1 새 메시지 핸들러 추가 템플릿

```js
// 1) background.js 내 chrome.runtime.onMessage 라우터에 분기 한 개 추가:
if (msg.type === 'YOUR_NEW_VERB') {
  yourNewHandler(msg)
    .then(function (result) {
      sendResponse({ ok: true, ...result });
    })
    .catch(function (err) {
      sendResponse({ ok: false, error: mapShareError(err) });
    });
  return true; // 비동기 응답 표시 — 빠뜨리면 sendResponse 가 무시됨
}

// 2) 핸들러는 항상 Promise 반환, 에러는 throw new Error('<영문 코드>')
function yourNewHandler(msg) {
  if (!msg || !msg.requiredField) {
    return Promise.reject(new Error('bad_input'));
  }
  return Promise.resolve(/* ... */);
}

// 3) mapShareError 또는 mapBuilderFormatError 에 새 코드의 한국어 매핑 추가:
//    if (m === 'bad_input') return '입력값을 확인해 주세요.';
```

**메시지 타입 네이밍**: 동사형 대문자 스네이크. 현재 사용중인 것은 `INJECT_*`, `FORMAT_BUILDER_SLOT`, `ANNOTATE_BUILDER_SLOT`, `GET_CALC_PAYLOADS`, `COPY_PARTY_SHARE_URL` — 결과 객체는 `{ ok: boolean, ... }`로 통일.

### 2.2 외부/사이트 fetch 패턴

```js
function fetchYourThing(origin, id) {
  return fetch(origin + '/api/your/path/' + encodeURIComponent(id), {
    method: 'GET',
    credentials: 'include', // 사이트 API는 쿠키 필요
    headers: { Accept: 'application/json' }
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (t) {
        throw new Error('your_thing_' + res.status + (t ? ': ' + t.slice(0, 80) : ''));
      });
    }
    return res.json();
  });
}
```

- **smartnuo.com 호출**: 항상 `credentials: 'include'`. POST 본문은 `{ params: { data: { ... } } }` 한 단계 래핑이 사이트 컨벤션.
- **PokéAPI 호출**: `credentials` 빼고 `Accept: application/json`만. 율 제한은 명목상 없지만 §10.4의 chunk 패턴을 따라 동시성을 12 정도로 제한.
- **새 호스트가 필요하면 추가하지 마라.** 정말 필요하면 manifest `host_permissions` + PRIVACY.md 동시 갱신 필수 (§9).

### 2.3 번들 캐시 패턴

새 JSON을 SW에서 사용하고 싶다면 `makeBundleLoader`를 그대로 활용:

```js
var ensureYourBundleLoaded = makeBundleLoader(
  'nuo_fmt_yourBundleCache',  // chrome.storage.local 키
  'yourBundle.json',          // extension/yourBundle.json
  parseYourBundle,            // (text) => obj | EMPTY
  EMPTY_YOUR_BUNDLE
);

function parseYourBundle(text) {
  return safeJsonParse(text, function (j) {
    return j && typeof j.entries === 'object' ? j : null;
  }, EMPTY_YOUR_BUNDLE);
}
```

### 2.4 참조해야 하는 skill / agent

- 코드 변경 후 **`Explore` agent** — 같은 사이트 API를 부르는 다른 함수가 있는지(시그너처가 일관한지) 빠르게 확인할 때.
- 호스트 권한·외부 fetch가 추가되면 **`security-review` skill** — 권한 확장 정당성·PRIVACY.md 영향 점검.
- 큰 SW 리팩터(예: 새 모듈 분리) 전에 **`Plan` agent** — 의존성 그래프와 `importScripts` 순서를 미리 확정.
- (Skill로는 직접 도와줄 게 거의 없는 레이어. 대부분 직접 작성 + agent 보조.)

---

## 3. 레이어 B — 데이터 / JSON

**파일**: `extension/modifiers.json`, `moveTags.json`, `moveKoMap.json`, `moveSlugToEn.json`, `moveKoFallback.json`, `itemKoMap.json`, `itemKoFallback.json`, `abilityKoMap.json`, `abilityKoFallback.json`, `typeKoMap.json`, `natureKoMap.json`, `natureStatMul.json`, `regulationMaSpeedTable.json`, `regulationMaSpeedData.js`(생성물).

### 3.1 공통 컨벤션

- 루트는 항상 `{"version": <int>, ...}` 또는 `{"version": ..., "by<Key>": { ... }}` 모양. 손으로 편집한 JSON에는 `version`을 한 칸 올린다.
- **방향성 키 네이밍**:
  - `byKo`: 한국어 → 다른 무엇 (`{"섀도클로": "shadowclaw"}`)
  - `bySlug`: PokéAPI/Showdown slug → 다른 무엇 (`{"choice-band": "Choice Band"}`)
  - `koToSlug`: 한국어 → slug (성격 표).
- 폴백 JSON(`*Fallback.json`)은 PokéAPI에 없는 표기를 수기로 채운다. 메인 맵과 형식이 동일.

### 3.2 modifiers.json — 새 도구·특성 룰 추가 템플릿

```jsonc
// items / abilities 한쪽에 slug 키로 추가. slug는 PokéAPI 표기 우선.
"life-orb": {
  "finalDamageMul": 1.3,
  "nameKo": "생명의구슬"
},

// 결정력 보정 키 (simpleMovePower.js 가 읽음 — §4.1 표 참조):
//   atkMulPhysical, spaMulSpecial, powerMul, powerMulPhysical, powerMulSpecial,
//   boostType + typedPowerMul, ateType + atePowerMul, normalizeAllMoves + normalizePowerMul,
//   pinchBoostType + pinchPowerMul, sandForce + sandForcePowerMul,
//   setsWeather, setsTerrain, spaBoostInSun, ifSheerForceMove + sheerForcePowerMul,
//   ifBasePowerAtMost (cap), boostIfMoveTags { all, physicalOnly|specialOnly, powerMul },
//   movePowerFoeDefenseRuinMul, movePowerFoeSpDefenseRuinMul,
//   stabMul, finalDamageMul

// 내구력 보정 키 (formatter.js 가 읽음):
//   bulkDefMul, bulkSpdMul,
//   bulkHighestOfAtkFamily + bulkHighestDefMul + bulkHighestSpdMul (proto/quark),
//   bulkEmbodyAspect (초상투영 — 종 컨텍스트에서 분기)
```

룰을 추가할 때:
1. **`simpleMovePower.js` 또는 `formatter.js`가 이미 그 키를 읽는지** 확인. 새 키라면 두 파일 중 해당 함수를 같이 수정해야 함 (§4.1).
2. **`fmtCommon.findRuleAndSlugInMap` 의 alias 매칭**(slug, nameKo, aliases[])을 통해 사이트 표기와 매칭됨을 확인. 사이트가 다른 한글 표기를 쓰면 `aliases: ["..."]`를 추가하기보다 `nameKo`를 사이트 표기로 맞추는 쪽을 우선(현 정책: PokéAPI ko 단일 출처).
3. `version` 키 +1.

### 3.3 PokéAPI 인덱스 갱신

신규 패치(아이템/특성/기술 추가) 후:

```bash
# scripts/ 는 Node 18+ (글로벌 fetch). zip에 포함되지 않음.
node scripts/generate-move-tags.js          # Showdown moves.ts → moveTags.json
node scripts/generate-move-ko-map.js        # PokéAPI ko names → moveKoMap.json
node scripts/generate-move-slug-to-en.js    # PokéAPI en names → moveSlugToEn.json
node scripts/generate-item-ko-map.js
node scripts/generate-ability-ko-map.js
node scripts/sync-item-names-ko.js          # modifiers.json items[*].nameKo 동기화
node scripts/sync-ability-names-ko.js
node scripts/audit-pokeapi-ko-gaps.js       # 결손 확인 → fallback 보완
```

`*KoFallback.json`만 수기 보정 대상. 메인 맵은 항상 스크립트로 재생성 — 직접 편집 금지.

### 3.4 참조해야 하는 skill / agent

- **`Explore` agent** — 새 키를 도입하기 전에 “이미 같은 의미의 키가 있나?” 검색 (예: `bulkDefMul` vs `bulkDefenseMul`).
- **(skill 없음)** 데이터 변경은 코드보다 도메인 지식이 핵심. 변경 의도와 출처(공식 메커닉/시리즈/세대)를 커밋 메시지에 적는다.

---

## 4. 레이어 C — 계산 (순수 함수, DOM 없음)

**파일**: `formatter.js`, `simpleMovePower.js`, `showdownPaste.js`, `attackerFormOverride.js`, `calcPayload.js` — 모두 SW에서만 import되며 DOM·`chrome.*` 호출 금지(테스트 가능성·결정성 유지).

### 4.1 simpleMovePower.js — 새 결정력 룰 분기 추가

`oneMovePowerInternal`은 7단(베이스→태그→우격→노말스킨/-ate→타입특성→[조건부]→도구→STAB→스탯→최종)을 지나간다. 새 메커닉을 끼워 넣을 때:

```js
// 1) modifiers.json 의 키를 ar.<newKey> 로 받는다.
// 2) 단계의 의미와 가장 가까운 자리에 분기를 넣는다 — 순서 자체가 게임 메커닉을 반영하므로 함부로 옮기지 않는다.
// 3) 조건부(HP·날씨·전역 플래그 의존)면 skipConditionalAbility 분기에 넣고, abilityHasConditionalPowerDisplay 에 키 이름을 추가:
function abilityHasConditionalPowerDisplay(ar) {
  var a = ar || {};
  return !!(
    a.pinchBoostType != null ||
    a.sandForce === true ||
    a.setsWeather != null ||
    a.setsTerrain != null ||
    a.spaBoostInSun != null ||
    a.<yourNewConditionalKey> != null   // ← 새 조건부면 여기 추가
  );
}
// 그래야 base/buffed 양쪽 표기가 정확히 갈린다.

// 4) Math.round 위치를 기존 단계와 일치시킨다 — 게임 내부 정수화 시점을 모방.
//    틀리면 1 이내 오차가 누적되어 결정력이 1~2 빗나간다.
```

테스트 안 만들고 PR 올리지 말 것 (§9): 최소한 BACKLOG.md ＃3 표의 사례 하나로 손계산 비교.

### 4.2 calcPayload.js — 새 페이로드 필드

스마트누오 계산기 Vue가 읽는 필드만 페이로드에 담는다. 필드 이름은 §6.2의 키 표를 참조.

```js
return {
  speciesKo: speciesKo,
  evs: evs, ivs: ivs, level: level,
  abilityKo: abilityKoFromFlat(flat),
  itemKo: itemKoFromFlat(flat),
  // ...기존 키들...
  yourNewKey: <값>,                  // ← 새 필드
  abilityWeatherKey: defEnv.abilityWeatherKey,
  abilityTerrainKey: defEnv.abilityTerrainKey,
};
```

그리고 `calcFillBridge.js`의 `applyAttackerScalars`/`applyDefenderScalars`에 대응 `vm.$set` 한 줄을 추가 (§6.3).

### 4.3 showdownPaste.js — EV 변환 손대지 않는 것이 정답

`nuoBoostsToShowdownEvs`의 DP 알고리즘과 `clampNuoBoostsSix`/`reduceNuoBoostsUntilClassicCap`은 미묘한 동률·invested 보존 규칙으로 묶여 있다. 변경하려면 §10.5의 단위 테스트 레시피를 먼저 잡고 시작한다.

### 4.4 참조해야 하는 skill / agent

- **`Plan` agent** — 결정력/내구력 룰 추가 시 “기존 단계 어디에 끼울지, base/buffed 분기에 들어가야 하는지”를 미리 정리.
- **`Explore` agent** — 같은 단계에 이미 비슷한 룰이 있는지(예: `boostIfMoveTags` 사용처) 확인.
- 큰 변경(예: 새 단계 도입) 후 **`review` skill** — 결정력 결과 회귀를 사례 기반으로 점검.

---

## 5. 레이어 D — 콘텐츠 스크립트 (smartnuo 페이지)

**파일**: `calcFillShared.js`, `calcFill.js`, `teamBuilderShared.js`, `teamBuilderFill.js`(우하단 FAB), `teamBuilderInlineAnnot.js`(좌측 카드 인라인 어노테이션 — F6 분할), `speedOutspeedCalc.js`, 그리고 CSS-as-JS 모듈 `styles/{calcPanel,teamFab,speedPanel}.js`(F7). content_scripts 에 등록되어 사이트 페이지 isolated world에서 동작.

### 5.1 공통 가드

```js
(function () {
  'use strict';

  var CS = globalThis.nuoCsCommon || {};
  var isLikelyCalculatorView = CS.isLikelyCalculatorView;

  function isSmartnuoHost() {
    var h = (location.hostname || '').toLowerCase();
    return h === 'smartnuo.com' || h === 'www.smartnuo.com';
  }

  // 마운트 함수는 항상:
  // 1) 호스트 element 중복 방지 가드
  // 2) chrome.storage.local 의 옵션 키로 표시 여부 결정
  // 3) storage.onChanged 로 옵션 변경 즉시 반영
  // 4) MutationObserver(디바운스 ≥400ms) + hashchange + visibilitychange
  // 5) isLikelyCalculatorView() 가 true 면 팀빌더 UI 자동 숨김 / vice versa
})();
```

- **팀빌더 슬롯 변경 감지용 MO**는 `document.body` 로 observe 하고, 콜백 entry 에서 `nuoTeamBuilderShared.tbMoRecordsTouchSlotList(records)` 로 슬롯 컨테이너(`getTbSlotListRoot()` 또는 자손) 변경만 `refreshSlots` / `scheduleTeamBuilderInlineAnnotate` 에 전달한다. 컨테이너만 observe 하면 reactive re-render 시 detach 회귀(R2 F32 사후, §12 v5).

### 5.2 새 Shadow DOM 패널 마운트 템플릿

```js
var HOST_ID = 'nuo-fmt-<feature>-host';
var LOCAL_ENABLED_KEY = 'nuo_fmt_<feature>Enabled';

function mountPanel() {
  if (document.getElementById(HOST_ID)) return; // 중복 방지

  var host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  var root = host.attachShadow({ mode: 'open' });
  // CSS 는 styles/<feature>.js 가 globalThis.nuo<Feature>Css 로 export (F7).
  // 모듈 자체는 IIFE 1개 + 배열 + .join('\n') 패턴 — regulationMaSpeedData.js 와 같은 컨벤션.
  // 첫 줄에 ':host { all: initial; }' 로 사이트 스타일 격리.
  // * { box-sizing: border-box; font-family: system-ui, ...; } 베이스만 추가.
  root.innerHTML = '<style>' + (globalThis.nuo<Feature>Css || '') + '</style>' +
                   '<div class="wrap">...</div>';
  // ...event wiring...
  //
  // ★ manifest.json content_scripts.js 배열에서 styles/<feature>.js 를
  //   소비자 스크립트보다 **앞**에 등록해야 globalThis 에 값이 들어 있다.

  return function teardown() {
    if (host.parentNode) host.parentNode.removeChild(host);
  };
}

function syncVisibility() {
  if (!isSmartnuoHost()) { unmount(); return; }
  if (isLikelyCalculatorView()) { unmount(); return; } // 팀빌더 패널이면
  chrome.storage.local.get([LOCAL_ENABLED_KEY], function (got) {
    if (chrome.runtime.lastError) { mountPanel(); return; }
    if (got[LOCAL_ENABLED_KEY] === false) unmount();
    else mountPanel();
  });
}

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== 'local') return;
  if (!Object.prototype.hasOwnProperty.call(changes, LOCAL_ENABLED_KEY)) return;
  syncVisibility();
});
```

### 5.3 인라인 어노테이션 (Phase 1/2 atomic swap)

기존 `runTeamBuilderInlineAnnotate`의 패턴이 표준. 사용자에게 “stale → blank → fresh” 깜빡임을 보여주지 않으려면:

```js
// Phase 1: 비동기로 모든 슬롯의 새 데이터를 모은다. 기존 어노테이션은 그대로 둠.
Promise.all(slots.map(requestSlotAnnot)).then(function (results) {
  if (myGen !== currentGen) return; // 중간에 다른 갱신이 시작되었으면 폐기
  // Phase 2: 한 동기 블록에서 atomic swap.
  clearAllAnnotations();
  results.forEach(applyAnnotation);
});
```

`MutationObserver`가 우리 어노테이션 변경에 다시 반응하지 않게:
1. `mo.disconnect()` → Phase 2 작업 → `requestAnimationFrame(rAF(reconnect))`로 두 프레임 양보 후 다시 observe.
2. 또는 변경 대상에 `data-nuo-tb-ann="1"` 마킹 + 이벤트 필터.

### 5.4 스피드 패널처럼 “사이트 입력값을 읽어 옆에 결과 표시”

- 사이트 입력 위치를 찾을 때 **Vuetify 자동 ID(`input-2673` 등)는 절대 쓰지 않는다.** 매번 바뀜.
- 라벨 텍스트(`<p class="mb-0">스피드 수치</p>`) 기반으로 row → flex 셀 인덱스 → 입력 row의 같은 인덱스 셀 → `input[disabled][readonly][type="text"]` 식 트래버설.
- `setInterval(tick, 200)` 폴링이 표준. Vue가 wrap을 통째로 교체할 수 있어 `lastWrap !== wrap`로 재마운트 감지.
- 호스트는 가능하면 입력 wrap의 자식으로 두고 `position:absolute; left/top` 인라인. 그러면 사이트 스크롤·리사이즈에 자동 따라감.

### 5.5 참조해야 하는 skill / agent

- **`Explore` agent** — 새 컴포넌트가 사이트의 어느 라벨/구조에 의존할지 후보를 빠르게 추리는 데. 직접 사이트 DOM을 보는 게 가장 빠름.
- **(skill 없음)** Shadow DOM/Vuetify 트릭은 본 프로젝트의 기존 패턴이 곧 가장 좋은 참고.
- 큰 UI 추가 후 **`review` skill** — UX 회귀(다크 모드, 좁은 화면, 호버↔클릭 전환) 점검.

---

## 6. 레이어 E — MAIN-world Bridges

**파일**: `calcFillBridge.js`, `teamBuilderBridge.js`. **manifest 에 등록되지 않으며**, 콘텐츠 스크립트가 `INJECT_*` 메시지로 SW에 부탁해 `chrome.scripting.executeScript({ world: 'MAIN', files: [...] })`로 주입.

### 6.1 새 bridge 만들기 템플릿

```js
// extension/yourBridge.js (manifest 미등록)
(function () {
  if (window.__NUO_YOUR_BRIDGE_V1__) return;  // 중복 주입 가드
  window.__NUO_YOUR_BRIDGE_V1__ = true;

  var MSG_EXT = 'nuo-your-ext';      // content → MAIN
  var MSG_BRIDGE = 'nuo-your-bridge';// MAIN → content

  // ... 페이지의 Vue/store 그래프를 만지는 함수들 ...

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== MSG_EXT || d.type !== 'NUO_YOUR_VERB_V1') return;
    var rid = String(d.requestId || '');
    try {
      var result = doYourThing(d);
      window.postMessage({
        source: MSG_BRIDGE, type: 'NUO_YOUR_REPLY_V1',
        requestId: rid, ok: true, ...result
      }, '*');
    } catch (e) {
      window.postMessage({
        source: MSG_BRIDGE, type: 'NUO_YOUR_REPLY_V1',
        requestId: rid, ok: false, error: String((e && e.message) || e)
      }, '*');
    }
  });
})();
```

그리고 SW에 `INJECT_YOUR_BRIDGE` 메시지 핸들러 추가 (§2.1 템플릿).

### 6.2 Vue 인스턴스 발견 — 정착 패턴

새 bridge가 Vue를 만질 일이 있다면 `calcFillBridge.collectAllCalcVmEntries`/`pickBestCalcEntry` 또는 `teamBuilderBridge.pickBestSlots` 패턴을 차용한다. 핵심:

- `#app.__vue__`(Vue2) 트리 순회를 1순위로.
- 못 찾으면 DOM 전수 스캔(`document.querySelectorAll('*')`, `node.__vue__`). Vue3는 `appEl.__vue_app__` + `nodes[k].__vueParentComponent` 추가.
- “모양” 체크: 내가 만지려는 prop 키들이 다 있는지 (`isCalcVmShape: vm.attacker && vm.defender && Array.isArray(vm.pokemon_list)`).
- “보이는지” 체크: `cascadeDisplayed` + `vmLayoutMetrics`. 화면 밖이면 점수 감점.
- 점수 함수: hasLoad +가산, viewport 면적 로그 비례, 키워드(`교체/계산/초기화`) 가산, 깊이가 깊을수록 +(상위 래퍼 함정 회피).
- 상위 N(현재 3)에 broadcast — **하나라도 성공하면 ok**. 너무 깐깐하게 “정확히 1개”를 고르려 들면 사이트 변경 시 바로 깨진다.

### 6.3 Vue prop 패치 — calcFillBridge 4단 nextTick 패턴

스마트누오 계산기는 watcher가 reset을 일으키므로:

1. `vm.$set(vm.attacker, 'name', enName)` + stub 깔기 + `loadAttacker()`.
2. `$nextTick`: name 다시 set + scalars 적용.
3. 둘째 `$nextTick`: 같은 name·move 재set, defender 있으면 동일 패턴.
4. 셋째 `$nextTick`: 풀 re-sync + `trySyncDerived`.
5. `setTimeout(90ms)`: 마지막 보강 후 결과 송신.

새 prop을 set할 때 어느 단계에 넣을지: **이름 의존 prop은 1·2단, 단순 scalar는 2·3단, 파생값(`damage_class_update_handler` 같은)은 3단** 직후가 안전.

### 6.4 새 prop 보낼 때 페이로드↔bridge 매핑 표 (현재)

| 페이로드 키 | bridge가 set 하는 곳 | 비고 |
|------------|----------------------|------|
| `speciesKo` | `vm.attacker.name = pickPokemonEn(vm, ...)` | en 이름을 사이트 도감에서 lookup |
| `evs` | `vm.attacker.effort` (해당 분류만) / `vm.defender.effort_for_hp`·`effort_for_defend` | 6칸 배열 → 분류에 맞는 칸만 |
| `ivs` | `individual_value` / `individual_value_for_hp`·`for_defend` | |
| `level` | `vm.<side>.level` | |
| `abilityKo` | `vm.<side>.ability` (한글 그대로) | |
| `itemKo` | `vm.<side>.equipment` | |
| `attackerPersonality` / `defenderPersonality` | `vm.<side>.personality` (0.9/1/1.1만) | |
| `attackerMove.{name,kr,power,typeKo,damageClass}` | `vm.attacker.move = {...}` + `loadMove()` | 한글 타입으로 변환 |
| `abilityWeatherKey` / `abilityTerrainKey` | `vm.attacker.weather` / `vm.attacker.field` (한글) | 공격: 항상 / 수비: 빈 칸일 때만 |
| `incomingPhysical` (defender) | `vm.defender.effort_for_defend` 분류 결정 | psyshock 트리오 처리 포함 |

새 키를 추가할 때 이 표에도 줄을 추가한다.

### 6.5 참조해야 하는 skill / agent

- **`Plan` agent** — Vue prop 시퀀스(`$set`/`$nextTick`/`load*`) 설계 시.
- **`Explore` agent** — 사이트 페이지 콘솔에서 `document.querySelector('#app').__vue__`로 prop 이름을 직접 확인하는 게 가장 정확. 코드 베이스 검색은 우리 쪽 사용처 추적용.
- **`security-review` skill** — bridge가 페이지로 돌려보내는 데이터에 사용자/사이트 비공개 정보가 섞이지 않는지 (현재는 결과 메시지만 전송).

---

## 7. 레이어 F — 환경설정 팝업 (`popup.{html,js,css}`)

### 7.1 새 옵션 추가 템플릿

```html
<!-- popup.html — 적절한 <section class="options-section"> 안 -->
<label class="settings-option-row" for="yourOptId">
  <input type="checkbox" id="yourOptId" />
  <span>옵션 이름</span>
</label>
```

```js
// popup.js
var LK = {
  // ...
  yourOpt: 'nuo_fmt_yourOpt',
};
var EXTENSION_PREF_KEYS = [/* ... */, LK.yourOpt];

function applyExtensionPrefsFromLocal(got) {
  // chrome.runtime.lastError 분기에서 default 값 설정
  if (chrome.runtime.lastError) {
    // ...
    if (yourOptEl) yourOptEl.checked = true;  // 기본값 명시
    return;
  }
  if (yourOptEl) yourOptEl.checked = got[LK.yourOpt] !== false;  // ← 기본 true
  // 또는 `!!got[LK.yourOpt]`  ← 기본 false
}

if (yourOptEl) {
  yourOptEl.addEventListener('change', function () {
    chrome.storage.local.set({ [LK.yourOpt]: !!yourOptEl.checked });
  });
}

// storage.onChanged 리스너의 hit 검사에 LK.yourOpt 추가.
```

### 7.2 옵션을 읽는 쪽

옵션을 소비하는 콘텐츠 스크립트는:

1. 동일 LK 상수를 자체 정의(예: `LOCAL_TB_INLINE_MOVE`).
2. 마운트 시 `chrome.storage.local.get([LK], cb)`로 초기 값 로드.
3. `chrome.storage.onChanged.addListener`로 변경 즉시 반영.
4. 키가 미정의(`undefined`)일 때의 기본값은 **팝업과 동일**하게 — 어긋나면 “팝업에서는 켰는데 효과는 꺼져 있음” 같은 회귀 발생.

### 7.3 마이그레이션

옛 키를 새 키로 옮길 때는 `migrateSessionFormatToLocalIfNeeded`/`tbInlineLegacy` 패턴을 참고:
- 새 키가 미정이고 옛 키가 정의돼 있으면 옛 값을 새 키로 복제.
- 옛 키는 그대로 두어 다운그레이드 호환을 유지하거나, 마이그레이션 종료 시점을 미리 잡아 한 번에 제거.

### 7.4 참조해야 하는 skill / agent

- **(skill 없음)** popup 자체는 일반 HTML/JS.
- **`review` skill** — 새 옵션 도입 시 “기본값이 사용자 기대와 일치하는가, 옛 키와의 호환은 되는가” 검토.

---

## 8. 레이어 G — 임베드 데이터 (`regulationMaSpeedData.js` 패턴)

페이지에서 `fetch(chrome.runtime.getURL(...))`이 어려운 자원(MAIN-world 또는 CSP 제약)을 콘텐츠 스크립트로 가져오고 싶을 때:

1. 데이터를 `extension/<name>.json`에 둠.
2. `extension/embed<Name>Data.js` Node 도구로 JSON을 한 줄짜리 IIFE에 박아 `extension/<name>Data.js`를 생성.
   ```js
   const out = "(function(){'use strict';globalThis.NUO_<NAME>=" + JSON.stringify(j) + ';})();\n';
   ```
3. `manifest.json`의 `content_scripts.js` 배열에 **소비자 스크립트보다 앞에** 등록.
4. 소비자에서는 `globalThis.NUO_<NAME>`로 동기 접근.

새 임베드 데이터를 도입할 때 `embed<Name>Data.js`도 같은 모양으로 작성하고, README/PRIVACY는 변경 불필요.

### 8.1 참조해야 하는 skill / agent

- **(skill 없음)** Node 도구 한 줄짜리.
- **`Explore` agent** — manifest content_scripts 순서가 의존성과 맞는지 검토.

---

## 9. 변경 후 체크리스트 (PR 전 셀프 점검)

- [ ] `manifest.json` `content_scripts.js` 순서가 의존성과 일치 — 현재 표준: `styles/calcPanel` → `styles/teamFab` → `styles/speedPanel` (F7) → `calcFillShared` → `teamBuilderShared` (F6) → `calcFill` → `calcGhostRing` → `teamBuilderFill` → `teamBuilderInlineAnnot` (F6) → `regulationMaSpeedData` → `speedOutspeedCalc`. (`teamBuilderShared` 가 `calcFill` 앞 — 계산기 FAB 가 hot/캐시 슬롯 헬퍼를 IIFE 시점에 import. `calcGhostRing` 은 `calcFill` 의 mountCalcSamplePanel 끝에서 attach — 비동기 chrome.storage 콜백 안에서 호출되므로 같은 위치 또는 직후 어디에 있어도 OK 지만 가독성을 위해 인접 배치.)
- [ ] `background.js`의 `importScripts` 순서가 `nuoFmtCommon` 의존성을 만족.
- [ ] 새 외부 fetch가 있다면 `host_permissions` + `PRIVACY.md`가 함께 갱신됨.
- [ ] 새 사용자 환경설정 키는 (1) popup, (2) 소비 측 default, (3) `storage.onChanged` 분기 세 곳 모두 반영.
- [ ] 새 메시지 타입은 (1) SW 라우터, (2) 호출 측, (3) 에러 매퍼 세 곳 모두 반영. `return true` 빠뜨리지 않음.
- [ ] MAIN bridge 변경 시 `__NUO_*_BRIDGE_V<n>__` 가드 버전을 올렸는가? (옛 가드가 살아 있어 새 코드를 막는 회귀 방지)
- [ ] Shadow DOM 호스트 ID가 unique, 중복 mount 가드 있음, teardown에 timer/listener 정리 있음.
- [ ] `chrome.runtime.lastError`/`storage` 실패 시 사용자 영향 없는 폴백.
- [ ] 결정력/내구력/Showdown 변환 로직 변경이라면 손계산 사례 비교(아래 §10.5).
- [ ] 매니페스트·content scripts 변경 후 “확장 새로고침 + 사이트 탭 강제 새로고침” 두 가지를 둘 다 했는가.
- [ ] CHANGELOG.md에 사용자 보이는 변경 한 줄, BACKLOG.md에 후속 항목(있으면) 한 줄.
- [ ] 새 패턴이 정착했으면 본 TEMPLATES.md §11에 한 줄 추가.

---

## 10. Workflow Recipes (자주 하는 작업)

### 10.1 “사이트의 응답 스키마가 바뀌어 깨졌어요”

1. 사이트 DevTools Network → 깨진 호출의 새 응답 캡처.
2. 보통 `shareToRaw.js`만 수정 — `classifyShareGetResponse` 또는 `flattenSlot`의 alias 키.
3. **구조가 정말 바뀐 게 아니라 alias 추가면** alias 한 줄만 더하고 끝(이게 정답인 경우가 많다).
4. `dist/<old>/extension/*.json` 과 비교해 회귀 빠지지 않았는지.

### 10.2 “계산기 자동 입력이 한 칸만 안 채워져요”

1. `calcFill.js`에서 보낸 페이로드 (`payloads.attacker`/`defender`)에 그 필드가 들어 있는지 SW 로그로 확인 (`chrome://extensions` → service worker).
2. 들어 있으면 `calcFillBridge.js`의 `applyAttackerScalars`/`applyDefenderScalars`에 대응 `vm.$set`이 있는지.
3. set은 하는데 watcher가 reset한다면 § 6.3의 4단 nextTick 시퀀스 어디에 set을 넣었는지 확인 — 보통 너무 일찍 set해서 `loadAttacker`가 덮어쓰는 케이스.

### 10.3 “팀빌더 인라인이 신규 폼에서 안 떠요”

1. `teamBuilderBridge.normalizeAndValidatePokeapiRawSpriteUrl`이 새 호스트/경로를 통과시키는가? (메가/특수 폼은 `/sprites/pokemon/<sub>/...png`).
2. 통과하지만 카드 매칭 실패면 `findCardRootByMoveTexts` 폴백 경로가 발동했는지(스프라이트 매칭 실패 시).
3. 그래도 안 되면 `findCardRootByGeometry` (이미지 폭 2배) 임계 조정.

### 10.4 “PokéAPI 일괄 fetch 가 필요해요” (런타임 / 빌드 타임)

**원칙 (F0 이후)**: 런타임에 PokéAPI 카탈로그를 페이지 fetch 하지 않는다. 같은 정보가 빌드 타임 번들로 가능하면 그쪽으로 옮긴다.
- 옛 calcPayload 의 `buildKoSlugMapFromPokeapiNetwork` 와 storage 키 `nuo_calc_move_ko_slug_map` 은 F0 으로 통째 제거됨. 한글 → Showdown id 는 빌드타임 번들 `moveKoMap.json` 우선, 부족분만 `moveKoFallback.json` 보충.
- 종 → 타입은 빌드타임 번들 `pokemonTypeMap.json` 우선(F20). 신규 폼 lookup 실패 시에만 PokéAPI 1회 + storage 캐시 폴백.

**빌드 타임 generator** 를 새로 추가할 때 (zip 미포함 `scripts/`):
- `scripts/lib/pokeapi.js` (F-data-2) 의 `fetchJson` / `listAll` / `fetchInChunks` / `mapInChunks` 를 사용한다. 페이지(`limit=100`) + 동시성 12 chunk 패턴이 그 안에 들어 있고, async `onProgress` 로 chunk 사이 throttle 보존.
- 새 도구가 `scripts/generate-pokemon-type-map.js` 와 같은 모양이 되면 정상.

**런타임에 정말 PokéAPI 가 필요한 좁은 경우** (예: 신규 폼의 타입):
- 단건 fetch + `chrome.storage.local` 캐시 (TTL 또는 무제한). manifest `host_permissions` 에 `https://pokeapi.co/*` 가 이미 있는지 확인. 없으면 PRIVACY.md 갱신과 함께만 추가.

### 10.5 결정력/Showdown 변환 손댄 뒤 회귀 점검 레시피

```js
// 임시 스크립트(scripts/test-cases.js 식)로 스코어드 사례 만들기:
const cases = [
  {
    name: '따라큐 / 페어리스킨 / 생명의구슬',
    slot: { /* shareToRaw 가 만드는 모양과 동일 */ },
    expected: { move0: { base: 5040, buffed: 7560 } /* ... */ }
  },
  // ...
];

cases.forEach(c => {
  const got = simpleMovePower.computeMovePowers(c.slot, c.types, mod, mt, mk);
  // assert
});
```

본 프로젝트는 단위 테스트 인프라가 없다. 결정력 룰을 바꿀 때만 임시 Node 러너로 손계산 비교를 돌리고, 끝나면 그 러너는 커밋하지 않거나 `scripts/`에 1회용으로 둔다(드라이브-바이 새 의존성 도입 금지).

---

## 11. Skill / Agent 빠른 참조

### 11.1 사용 가능한 skill

| Skill | 어디서 유용한가 |
|-------|---------------|
| `review` | 변경 후 코드 리뷰가 필요한 모든 PR. 특히 §4(계산), §5(콘텐츠), §6(bridge) 변경. |
| `security-review` | manifest 권한·외부 fetch·MAIN bridge가 페이지로 보내는 데이터 변경 시. PRIVACY.md 영향 점검 동시 수행. |
| `init` | (현재 CLAUDE.md가 있으므로 보통 불필요) 새 디렉터리에 도구 셋을 넣을 때. |
| `skill-creator` | 본 프로젝트에 반복적으로 등장하는 절차(예: PokéAPI 갱신 워크플로)를 별도 skill로 빼고 싶을 때. |
| (docx/pdf/pptx/xlsx) | 이 프로젝트와 무관 — 호출하지 않는다. |

### 11.2 사용 가능한 agent

| Agent | 어디서 유용한가 |
|-------|---------------|
| `Explore` | “이미 같은 의미의 함수/키가 있나?”, “이 alias를 어디서 쓰지?” 식 빠른 리서치. 본 코드는 ES5라 grep로 거의 다 잡히지만, 여러 파일에 걸친 규칙(§2.1 메시지 라우터 vs §6 bridge)은 agent로 한번에 훑는 게 빠름. |
| `Plan` | (a) 결정력/내구력 룰 단계 사이에 새 분기 끼워넣기, (b) MAIN bridge 새 prop 시퀀스 설계, (c) 메시지 타입 + 페이로드 모양 합의. |
| `general-purpose` | 한 번에 §2~§7을 가로지르는 큰 기능(예: 새 페이지 추가). |
| `claude-code-guide`, `statusline-setup` | 본 프로젝트 무관. |

### 11.3 호출 가이드라인

- **사용자가 “agent 써”라고 명시하지 않았다면 기본은 직접 작업.** 본 코드는 작아서 매번 agent를 부르면 비용이 더 든다.
- 코드 변경이 단일 레이어이고 100줄 이내면 직접 작성 → 자체 점검 → §9 체크리스트.
- 복수 레이어를 가로지르거나(예: SW + bridge + 콘텐츠 + popup) 룰 단계 설계가 모호하면 `Plan` 한 번 호출 후 직접 작성.
- 코드 리뷰 단계에서 회귀 우려가 있으면 `review` skill.

---

## 12. 업데이트 로그 (Append-only)

새 패턴을 정착시키거나 본 문서를 손볼 때마다 한 줄 추가. 가장 최근 항목이 위.

- **2026-05-21 v7** — 콘텐츠 스크립트의 chrome.runtime.getURL/fetch 패턴: 확장 context invalidated 상태(chrome.runtime.id === undefined)에서 호출하면 'chrome-extension://invalid/' 반환 → fetch ERR_FAILED 콘솔 잡음. fetch 전에 chrome.runtime.id 가드 + URL prefix 'chrome-extension://invalid' 검사 필수. (작성: Claude)
- **2026-05-21 v6** — Lazy 인덱스 + source-ref 캐시 무효화 패턴 정착. (1) Pinia state 배열(`__NUXT__.state[KEY_POKE_LIST]` 등) lookup: 모듈 스코프에 인덱스 + 빌드 source 의 ref 보관, ref 비교로 invalidate. 사이트가 list 통째 교체 시 자동 재빌드. (2) doc-level map(modifiers.items/abilities, typeKoDoc.byKo) lookup: WeakMap<map, normKey→entry> 로 doc 객체를 key. SW 라이프타임에 doc 안정 — GC 자동. (3) 옛 선형-스캔 함수의 first-match-wins 동등성은 인덱스 first-set-wins 로 보존 — 도입 전 정규화 키 충돌 0 정적 검증 필수(modifiers.json 의 items/abilities 양쪽). (작성: Claude)
- **2026-05-21 v5** — 팀빌더 콘텐츠 스크립트의 MutationObserver 패턴 정착: observe target 은 `document.body` 로 넓게 두고, 콜백 entry 에서 변경된 `record.target` 이 슬롯 컨테이너(`nuoTeamBuilderShared.getTbSlotListRoot()` 또는 그 자손) 안에 있는지 `contains()` 가드로 work 호출 여부 결정. observe target 을 컨테이너로 좁히면 사이트의 reactive re-render 로 observe 가 detach 되는 회귀가 발생함을 R2 F32 사후 확인. 가드 비용은 `contains()` O(depth) 한 번이라 거의 무료. (작성: Claude)
- **2026-05-17 v2** — R2 Tier 1 반영. (1) 팀빌더 콘텐츠 스크립트: 슬롯 변경 `MutationObserver` 는 `getTbSlotListRoot()` 로 scope (§5.1 불렛). (2) 계산기 FAB glow: 그라데이션 `::before`/`::after` 와 충돌하지 않도록 `calcFill.js` 마크업에 `span.fab-glow-ring` 두 층 + `calcPanel.js` 에서 정적 `box-shadow` + opacity 키프레임만 애니. (3) 팀빌더 FAB glow: 동일 색의 `::before`/`::after` opacity cross-fade (`teamFab.js`). (4) `prefers-reduced-motion`·dock 닫힘·비표시 시 `animation-play-state: paused` 패턴 문서화. (작성: Claude)
- **2026-04-27 v4.1** — 계산기 FAB 외관을 팀빌더 FAB 와 통일. (1) 아이콘 색을 mode-tinted dark(`#92400e` atk / `#065f46` def) 로 — 팀빌더의 `#2a6f8f` 패턴. svg 색은 부모(.fab-toggle-ic / .fab-write-gear)에 `color: var(--nuo-cf-color)` + `transition: color` 로 두고 svg 는 currentColor 만 — transition inherit 안 됨 회피. (2) 피드백 layer 색·애니메이션을 팀빌더 fab-btn-feedback 패턴으로 교체 — hover/done bg = `rgba(255,255,255,0.5x)` 밝은 반투명, busy/err bg = `rgba(15,23,42,0.28)` 어두운 반투명. 새 keyframes nuo-cf-busy-out / spin-ic / done-layer / check-pop / err-shake 추가. (3) Write 좌측 puck 을 단일 `.fab-write-morph` 로 통합 — 팀빌더 `.fab-settings-morph` 의 “52→280 사이즈 확장 + border-radius 26→14 + animation 끔 + box-shadow 등장” 패턴 그대로. 별도 panel 엘리먼트 없이 morph 자기 자신이 패널이 됨. 가짜 요소 두 층(atk/def 그라데이션) + bg-expanded 별도 layer(neutral 흰빛). (작성: Claude)
- **2026-04-27 v4** — “팀 슬롯 원클릭” 라운드 후속 수정. (1) 새 패턴 — **CSS 변수 기반 그라데이션 cross-fade 의 Shadow DOM 회귀 워크어라운드**: `@property` 의 `<image>` interpolation 이 Shadow DOM 안에서 안 잡히는 케이스가 있어, “가짜 요소 두 층(`::before` atk / `::after` def) 을 동시에 깔고 opacity 변수만 토글” 패턴으로 갈아탔다. 가짜 요소가 z-index: -1 로 부모 stacking context 에 새지 않도록 `isolation: isolate` 동반. (2) 새 패턴 — **bridge 가 page 상태로 SW 페이로드 override**: SW 는 attacker 정보 없이 defender 단독으로 페이로드를 만들 때 `incomingPhysical` 디폴트(true)로 폴백하지만, bridge 가 `vm.attacker.move.damage_class` (또는 `vm.damage_class`) 를 source of truth 로 EV/IV/personality 를 다시 픽업한다. 옛 두 URL 패널 시절부터 잠재해 있던 결함도 자동으로 회복. SW 는 phys/spec 양쪽 personality 를 모두 페이로드에 박는다(`defenderPersonalityPhys` / `defenderPersonalitySpec`). (3) 새 패턴 — **PokéAPI 슬러그 정규화 맵 SW 부팅 시 reduce + 영속 move meta 캐시**. 옛 “s-hadowclaw, sh-adowclaw…” sequential 추측을 단일 fetch 로. (4) 새 모듈 `extension/calcGhostRing.js` — `.fab-dock--open` 동안 atk/def 패널에 ring 을 그리는 hover-only 격리 모듈. `REMOVE_GHOST_RING` 주석으로 한 줄 + 한 파일 + 매니페스트 1줄 삭제로 깨끗히 제거 가능. (5) §9 체크리스트의 content_scripts 표준 순서에 `calcGhostRing` 추가. (작성: Claude)
- **2026-04-27 v3** — 계산기 자동입력 “팀 슬롯 원클릭” 라운드 반영. (1) §9 체크리스트의 content_scripts 표준 순서를 갱신: `teamBuilderShared` 가 `calcFill` 앞으로 이동(계산기 FAB 가 IIFE 시점에 hot/캐시 헬퍼를 import). (2) 새 패턴 — **콘텐츠 스크립트 isolated world hot snapshot + chrome.storage 영속 캐시 두 층 mirror**. 같은 탭 SPA 라우트 전환을 hot 으로, 부팅/풀 리로드 너머는 캐시로 커버. 한 헬퍼(`setSlotSnapshot`)가 두 곳을 동시에 갱신해 동기화 누락을 막는다. 캐시 키 네이밍은 §0 의 `nuo_fmt_<bundle>Cache` 컨벤션 그대로. (3) 새 패턴 — **계산기 화면에서 팀빌더 bridge 호출 금지**. SPA 라우트 unmount 후 빈 결과로 hot/캐시 를 덮어쓸 위험. 대신 위 두 층만 read. (4) 새 SW 메시지 `GET_CALC_PAYLOADS_FROM_SLOT` — URL 우회. `calcPayload.js` 의 “flatten → 페이로드” 로직을 `buildOneSideFromFlatSlot` 으로 추출해 URL 경로(`buildOneSide`)와 슬롯 직접 경로(`buildSidePayloadFromSlot`)가 공유. (작성: Claude)
- **2026-04-26 v2** — 2026-04-25/26 최적화 라운드 반영. (1) §5 파일 목록에 F6 분할 결과(`teamBuilderShared.js`, `teamBuilderInlineAnnot.js`)와 F7 의 `styles/` CSS-as-JS 모듈 추가. (2) §5.2 Shadow DOM 마운트 템플릿을 `globalThis.nuo<Feature>Css` 패턴으로 갱신. (3) §9 체크리스트의 content_scripts 표준 순서 갱신. (4) §10.4 “PokéAPI fetch” 레시피를 F0 이후 정책(런타임 카탈로그 페이지 fetch 금지 / `scripts/lib/pokeapi.js` 사용)으로 재작성. (작성: Claude)
- **2026-04-25 v1** — 초기 작성. research.md를 토대로 §0~§11을 잡음. (작성: Claude / 도우미누오 1.1.0 시점)
