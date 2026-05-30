<!-- Context: 도우미누오 Chrome 확장 — 팀빌더 간단 스피드 패널 "스피드표 펼치기" PR -->

# 팀빌더 스피드 패널 — "스피드표 펼치기" 전체표 패널 구현 플랜

> **상태**: 플랜 작성 중 (2026-05-30). 구현 전. 사인오프 + 남은 진단값 1개(설정패널 rect) 채워지면 Cursor 위임 prompt 작성 → 구현.
> **레이어**: TEMPLATES §5.4(스피드 패널 콘텐츠 스크립트) + §8(임베드 데이터, 변경 없음) + styles CSS-as-JS.
> **편집 주체**: 런타임 코드는 Cursor 위임(CLAUDE.md §4). 본 플랜·문서는 Claude 직접.

---

## 본 PR 범위

1. 팀빌더 우측 편집 패널의 **간단 스피드 계산기 패널**(`speedOutspeedCalc.js`) 하단 중앙에 "**스피드표 펼치기**" 문구 버튼 추가. 버튼 위에 가로 구분선.
2. 버튼 클릭 시 **별도 대형 패널**(362×780)이 설정패널 우측 97px 자리에 열림. 심플 패널이 그쪽으로 확장되는 듯한 **morph 애니메이션**(FAB write-morph 패턴 차용).
3. 대형 패널 = 레귤 M-A 스피드 **전체표**. 최상단 사이트 "파티 리스트" 제목 스타일을 복제한 제목 + 본문은 현재 호버 팝오버 표를 **3프리셋 오버레이**로 확장(라벨 라인 + 색 구분 + 추월 불가 라인).

## 본 PR 범위 밖

- 기존 프리셋 **호버 팝오버**(최속/준속/무보정 hover → 부분표) 동작은 **0 변경**. 본 PR 은 순수 추가.
- 스피드 결정 공식(`computeOutspeedBases` / `findTieSpeciesStat` / `computeFinal`) 로직 변경 없음 — 그대로 재사용.
- 새 `host_permissions` / 외부 fetch / storage 송신 변경 없음 → PRIVACY.md 변경 없음.
- 레귤 스피드표 데이터(`regulationMaSpeedTable.json`) 내용 변경 없음. `embedSpeedData.js` 재실행 불필요.
- ES5 → 모던 JS 마이그레이션 없음. 파일 스타일(`var`/IIFE/`function`) 유지.

---

## 0. 사인오프 표기

| 필드 | 의미 |
|------|------|
| `현재` | 지금 코드가 뭘 하는지 |
| `제안` | 구체적 변경안 |
| `위험` | low / medium / high |
| `노력` | S / M / L (1시간 / 반나절 / 1일+) |
| `의존` | 선후관계 |
| `사인오프` | `[ ] 승인 / [ ] 보류 / [ ] 거절` |

번호 규칙: **ST** = Speed Table 펼치기(본 PR). 부번호 = 레이어 — `ST-C` 콘텐츠 스크립트, `ST-S` 스타일(CSS-as-JS), `ST-R` 렌더(전체표 오버레이), `ST-A` 애니메이션, `ST-P` 위치 앵커, `ST-G` 가드레일.

---

## 1. 배경 — 현재 상태

### 1.1 현재 동작 (1.5.0 기준)

- `speedOutspeedCalc.js` 가 200ms 폴링(`tick`)으로 팀빌더 우측 편집 패널의 스피드 실수값 wrap(`findSpeedRealWrap`, 고정 XPath)을 잡고, 그 wrap 자식으로 Shadow DOM 호스트(`HOST_ID = 'nuo-fmt-speed-outspeed-host'`)를 inline 부착. 호스트는 `position:absolute; left:62px; top:-47px` 로 wrap 우측에 붙음.
- 패널 본문 = 3 프리셋 박스(최속/준속/무보정). `computeFinal(S, 특성, 도구)` 로 최종 실수값 F, `computeOutspeedBases(F, 상대스카프)` 로 프리셋별 추월 가능 최대 종족값(`fastest`/`neutral`/`uninvested`).
- **호버 팝오버**: 프리셋 하나 hover → `fillSpeciesPopover(root, v, presetIdx)` → `buildSpeciesPopoverRows`(앵커 위 3·아래 1 슬라이스) + `getPopoverAnchorCutoff`(추월 컷오프) + `findTieSpeciesStat`(동속). divider 2종: `추월`(cutoff), `동속`(tie). 색: `.species-pop-row.hi .tier`=핑크(`#e4007f`), `.muted`=회색(`#94a3b8`), `.tie`=검정(`#0f172a`). 단일 프리셋이라 라벨에 접두어 없음.
- 전체표 데이터: `regulationSpeedBySpeed`(종족값 문자열 키 → 이름 배열), 메타 제목 = `"Pokémon Champions 「레귤레이션 M-A」 출전 가능 포켓몬 스피드표"` (`regulationSpeedMeta.title`).
- 토글 상태(특성/도구/상대스카프/접힘)는 `chrome.storage.local` 영속. 모듈 스코프 변수 `abilityOn/itemOn/oppScarfOn/collapsed`.

### 1.2 목표 (본 PR 후)

- 심플 패널 하단 중앙에 "스피드표 펼치기" 버튼(위에 가로 구분선). 클릭 → 대형 전체표 패널이 morph 애니메이션으로 열림. 다시 누르면(또는 닫기) 접힘.
- 대형 패널: 폭 362px(사이트 패널 폭), 높이 780px(우측 설정패널과 동일), 설정패널 우측 테두리에서 97px 떨어진 위치(좌측 샘플목록↔우측 설정패널 간격과 동일).
- 대형 패널 최상단 제목 = 사이트 "파티 리스트" 제목 스타일 복제.
- 대형 패널 본문 = **현재 선택 포켓몬 기준** 실시간 전체표(3프리셋 오버레이 + 라벨 라인 + 추월 불가 라인).

---

## 2. 확정 결정 (사용자 답변, 2026-05-30)

| Q | 답변 | 영향 |
|---|------|------|
| **Q1 표 레이아웃** | **오버레이 1표 + 라벨 라인** | 단일 종족값 내림차순 표. 행 색 3분류(무보정 기준), 6 접두어 divider + 추월불가 라인. §4 상세. |
| **Q2 패널 동작** | **별도 대형 패널 + 확장 morph 애니메이션** (심플 패널이 확장되는 듯한 모션, FAB write/settings-morph 느낌) | `.fab-write-morph` 패턴 차용 가능 확인됨(§5). 별도 호스트 + `left/top/width/height/border-radius` transition. |
| **Q3 기준 스피드** | **현재 포켓몬 기준 실시간** | `tick` 이 대형 패널 열림 시 같은 F 로 표 재렌더. 포켓몬 미선택 시 라인 없는 plain 표. |
| **Q4 제목 스타일** | **콘솔 덤프 제공** | 값 확정(§3.1). |

---

## 3. 진단 결과 (콘솔 덤프)

### 3.1 "파티 리스트" 제목 스타일 — 확정

XPath `/html/body/div[1]/div/main/div/div[1]/div/div/div[1]/span` 의 computed style:

```
title  : font-family SCDream(우리도 동일), font-size 15px, font-weight 500,
         color #272727(rgb 39,39,39), letter-spacing normal, line-height 22.5px,
         text-align start, display block, position static
parent : display flex, align-items center, height 22.5px, margin 0 0 9px, padding 0
text   : " 파티 리스트 "  (앞뒤 공백 포함)
```

→ 대형 패널 제목 CSS (Shadow DOM 내부 재현):
```css
.table-title {
  font-family: SCDream, sans-serif;   /* :host all:initial + 기존 베이스와 일관 */
  font-size: 15px; font-weight: 500;
  color: #272727; letter-spacing: normal; line-height: 22.5px;
  text-align: left; margin: 0 0 9px; padding: 0;
}
```
- 우리 패널은 이미 `font-family: SCDream` 베이스(§styles/speedPanel.js) → 폰트 자동 일치.
- 제목 텍스트 = `regulationSpeedMeta.title` (없으면 하드코딩 fallback). 사이트 제목과 달리 길어서 줄바꿈 가능 → `line-height:22.5px` 유지하되 폭 362 안에서 자연 wrap 허용(아래 본문과 9px 간격은 `margin-bottom:9px` 로).

**보너스 확인** (두 번째 "copy styles" 덤프): 우리가 이미 쓰는 색이 곧 사이트 토큰 — `--primary:#e4007f`(핑크), `--p-surface-400:#94a3b8`(회색), `--p-surface-900:#0f172a`(검정), `--panel-border:#ddd`, `--panel-shadow:#e1e1e1`. 즉 색·테두리 0 신규 도입으로 사이트와 일관됨.

### 3.2 설정패널 rect — **확정 (2026-05-30)**

설정패널 루트 XPath `/html/body/div[1]/div/main/div/div[3]` `getBoundingClientRect()`:
```
{ x: 888.8, y: 80, width: 362, height: 780, top: 80, right: 1250.8, bottom: 860, left: 888.8 }
```
- div[3] = 우측 설정패널 루트 **확인**. 폭 **362**·높이 **780** 가정 일치(사용자 명시 상수와 동일).
- **앵커식 확정**: 대형 패널 `left = rect.right + 97`, `top = rect.top`, `width = 362`, `height = 780`. (예시 시점 값: left ≈ 1347.8, top 80.)
- `position: fixed` + 매 `tick`/`scroll`/`resize` 에 div[3] rect 재계산해 추종(§ST-P1). rect 는 라이브 — 하드코딩 금지, XPath 로 매번 측정.

---

## 4. 전체표 오버레이 렌더 모델 (ST-R) — 상세

### 4.1 입력

현재 포켓몬 기준(§Q3): `tick` 이 이미 계산하는 값 재사용.
- `S` = `readSpeedFromWrap(wrap)` (스피드 실수값).
- `F` = `computeFinal(S, abName, abilityOn, itName, itemOn)` (특성·도구 반영 최종 실수값).
- 3 프리셋 `(ev, nat)` = `presetEvNat`: 최속(32, 1.1) / 준속(32, 1.0) / 무보정(0, 1.0).
- `oppScarfOn`.

### 4.2 프리셋별 경계 (기존 함수 재사용)

```
cutoff_최속  = computeOutspeedBases(F, oppScarfOn).fastest      // 추월 가능 최대 종족값
cutoff_준속  = .neutral
cutoff_무보정 = .uninvested
tie_p  = findTieSpeciesStat(F, cutoff_p, ev_p, nat_p, oppScarfOn)  // 동속 종족값(없으면 null)
eff_p(b) = opponentEffSpeed(b, ev_p, nat_p, oppScarfOn)            // 상대 종족값 b 의 최종 스피드
```
- `tie_p` 호출 시 anchor = `cutoff_p` (동속은 컷오프 바로 위 종족값). 기존 `findTieSpeciesStat` 시그너처 그대로.
- 종족값 정렬: `getTierDescFromMap(regulationSpeedBySpeed)` 내림차순.

### 4.3 행 색 규칙 (무보정 기준 3분류 — 모호성 0)

각 종족값 b 에 대해 (우선순위 동속 > 추월 > 불가):
- **검정(동속, `.tie`)**: `eff_최속(b)===F || eff_준속(b)===F || eff_무보정(b)===F`. (서로 다른 ev/nat 라 한 b 에서 두 프리셋 동시 tie 불가 — 충돌 없음.)
- **핑크(추월, `.hi`)**: 위 아님 + `eff_무보정(b) < F` (무보정 상대는 최소한 추월).
- **회색(불가, `.muted`)**: `eff_무보정(b) > F` (무보정 상대도 추월 못 함).

> 근거: 프리셋이 중첩(최속이 가장 빠름)이라 `cutoff_최속 ≤ cutoff_준속 ≤ cutoff_무보정`, `tie_최속 < tie_준속 < tie_무보정`. "무보정 추월 가능 = 핑크" 가 사용자 색 정의(최속·준속·무보정 추월 모두 핑크)와 일치. tie 종족값은 핑크 영역 깊숙이 있어도 검정.

### 4.4 divider 라인 (7종) — **모두 해당 종족값 "위"(헤더)에 배치** (2026-05-30 보정)

> **보정**: Phase 1 적용 후 사용자 피드백 — 모든 divider 는 자기 구간 종족값의 **바로 위(헤더)**에 온다. (초기 mockup 의 "라인-아래" 배치 폐기. 추월/동속/불가 전부 일관되게 위.)

내림차순 렌더 루프, 각 행 b **직전**에 삽입. 결과 레이아웃(내림차순):

```
──── 추월 불가 ────              ← 추월 불가 종족값 전체의 위 (표 최상단)
(회색 종족값 행들)
──── 무보정 동속 ────            ← 동속 행 위
(무보정 동속 행, 검정)
──── 무보정 추월 ────            ← 추월 가능 종족값 위
(핑크 행들)
──── 준속 동속 ────
(준속 동속 행 있으면, 검정)
──── 준속 추월 ────
(핑크 행들)
──── 최속 동속 ────
(최속 동속 행 있으면, 검정)
──── 최속 추월 ────
(핑크 행들 — 최속 컷오프 이하)
```

삽입 규칙(렌더 루프, 내림차순, 모두 행 위):
- `추월 불가`: **첫 회색 행 직전** 1회(= 표 최상단, 추월 불가 종족값 전체 위). 회색 행 없으면 생략.
- `{프리셋} 동속`: 그 프리셋 동속 종족값(`eff_p(b)===F`) 행 **직전**.
- `{프리셋} 추월`: 그 프리셋 추월존 진입 첫 행(`eff_p(b)<F`, 직전 행은 `≥F`) **직전**.
- divider 색: 추월 라벨 = `.species-pop-divider--outspeed`(핑크빛 `#d6689a`). 동속/불가 = 기본 회색(`#64748b`). 기존 `appendSpeciesPopDivider(bodyEl, label, kind)` 재사용(추월만 `kind='outspeed'`).

라벨 접두어: `'최속' | '준속' | '무보정'` + 공백 + `'추월' | '동속'`. 기존 `appendSpeciesPopDivider(bodyEl, label, kind)` 를 라벨 문자열만 바꿔 재사용(신규 헬퍼 불필요).

### 4.5 엣지 케이스

- **포켓몬 미선택 / S 없음**: F 계산 불가 → 라인·색 없이 전체 종족값 목록을 중립(회색 톤)으로 표시 + 상단 안내문 "포켓몬을 선택하면 추월/동속 기준이 표시됩니다." (선택 — 사용자 확인 항목, §6.)
- **cutoff 가 표 범위 밖**(F 매우 큼/작음): 해당 추월 라인이 표 최하단/최상단 밖이면 라인 생략(렌더 루프에서 자연 skip).
- **tie 없음**(eff 가 F 를 건너뜀): 해당 `{p} 동속` 라인·검정 행 생략.
- 표가 김(종족값 수십 단) → 본문 `overflow-y:auto`, 패널 높이 780 안에서 스크롤.

---

## 5. 확장 morph 애니메이션 (ST-A) — 가능성 확인 + 설계

### 5.1 FAB morph 패턴 확인 (참고: `styles/calcPanel.js` `.fab-write-morph`, `styles/teamFab.js` `.fab-settings-morph`)

- 단일 엘리먼트가 `transition: width .22s ease, min-height .24s, max-height .24s, border-radius .2s, …` 로 52px 원 → 280×168 rounded rect 확장. content 는 확장 후 `opacity` fade-in, 기존 아이콘은 fade-out. `prefers-reduced-motion` 분기 있음.
- → **같은 CSS-transition 접근으로 본 PR 재현 가능.** 차이: 우리 대형 패널은 제자리 확장이 아니라 **먼 위치로 슬라이드+확장** → transition 목록에 `left`·`top`(또는 `transform: translate`) 추가.

### 5.2 설계 — 별도 호스트 + 기하 transition

- 심플 패널 호스트와 **별도**의 대형 패널 Shadow DOM 호스트(`HOST_ID_TABLE = 'nuo-fmt-speed-table-host'`) 생성. `position: fixed`(뷰포트 좌표) — 설정패널 rect 기준 앵커이므로 스크롤 시 추종 필요(§ST-P).
- **열기**:
  1. 시작 기하 = 심플 패널 호스트의 `getBoundingClientRect()`(작은 사각형). 대형 패널을 이 위치·크기로 세팅 + `opacity` 낮게.
  2. 다음 프레임(`requestAnimationFrame`)에 목표 기하(left = 설정패널 right + 97, top = 설정패널 top, width 362, height 780) + `border-radius` 12 + `opacity` 1 로 클래스 토글 → CSS `transition` 이 보간. content(제목·표)는 확장 거의 끝날 때 `opacity` fade-in(`transition-delay`).
  3. 곡선·duration = FAB 와 동일 톤(`cubic-bezier(.25,.8,.5,1)`, ~.3s).
- **닫기**: 역재생(목표→시작 기하 + opacity 0) 후 `transitionend` 에서 호스트 hidden/remove.
- **버튼 상태**: 같은 "스피드표 펼치기" 버튼이 토글. 열림 시 라벨 "스피드표 접기"(또는 대형 패널 우상단 X — §6 확인). morph 중 중복 클릭 가드(`isAnimating` 플래그).
- 심플 패널은 그대로 유지(사라지지 않음). "확장되는 듯한" 모션은 대형 패널이 심플 패널 위치에서 자라나는 것으로 시각 구현 — 심플 패널을 가리지 않도록 `z-index` 정리(대형 패널 위, 단 morph 시작점만 겹침).

### 5.3 위험

- `width/height/left/top` 동시 transition = 레이아웃 애니(reflow). 단일 엘리먼트 1개라 비용 무시 가능(FAB 도 width/min-height 레이아웃 애니). `transform` 기반 scale 은 content 왜곡이라 비채택.
- `prefers-reduced-motion: reduce` → transition 끄고 즉시 표시(FAB 패턴 그대로).

---

## 6. 항목별 변경안 (사인오프)

### ST-C1. 심플 패널에 "스피드표 펼치기" 버튼 + 구분선
- **현재**: `mountPanelInto` 의 `root.innerHTML` 에 `.caption`("족 추월") + `.toggle.opp` 까지. 하단 펼치기 진입점 없음.
- **제안**: `.panel` 하단(예: `.caption` 아래 또는 `.toggle.opp` 영역과 겹치지 않는 자리)에 가로 구분선 `<div class="expand-sep">` + 중앙 정렬 문구 버튼 `<button class="expand-btn" id="expand-tbl">스피드표 펼치기</button>`. 클릭 → 대형 패널 토글(§ST-A). 기존 `.toggle.opp` 의 `position:absolute; top:105px` 와 레이아웃 충돌 점검(패널 높이 조금 늘 수 있음).
- **위험**: low. 기존 요소 위치 미세 조정 가능.
- **노력**: S.
- **의존**: ST-S1, ST-A1.
- **사인오프**: `[ ]`

### ST-C2. 대형 패널 마운트/언마운트 + 토글 상태
- **현재**: 대형 패널 개념 없음.
- **제안**: `mountTablePanel()`/`removeTablePanel()` + 모듈 변수 `tableOpen`(런타임만; 영속 불필요 — 매 진입 닫힘 시작이 자연스러움. 영속 원하면 `nuo_fmt_speedTableOpen` 추가 가능, §6 확인). 대형 패널 Shadow DOM = 제목 + 본문 컨테이너(`#table-body`). `tick` 이 `tableOpen && currentRoot` 일 때 표 재렌더 호출.
- **위험**: low.
- **노력**: M.
- **의존**: ST-R1, ST-A1, ST-P1.
- **사인오프**: `[ ]`

### ST-R1. 전체표 오버레이 렌더 함수
- **현재**: `fillSpeciesPopover`(단일 프리셋 슬라이스) 만 존재.
- **제안**: 신규 `renderFullSpeedTable(tableRoot, F, oppScarf)` — §4 모델. 기존 `getTierDescFromMap`/`namesForTier`/`computeOutspeedBases`/`findTieSpeciesStat`/`opponentEffSpeed`/`appendSpeciesPopDivider` 재사용. 호버 팝오버 코드(`buildSpeciesPopoverRows` 등) **0 변경**.
- **위험**: low(순수 추가).
- **노력**: M.
- **의존**: 없음(기존 계산 함수 위).
- **사인오프**: `[ ]`

### ST-S1. CSS — `styles/speedPanel.js` 확장
- **현재**: `globalThis.nuoSpeedPanelCss` 에 심플 패널·호버 팝오버 스타일.
- **제안**: 같은 모듈에 추가(별 파일 신설 안 함): `.expand-sep`(가로선), `.expand-btn`(문구 버튼), 대형 패널 `.table-panel`/`.table-title`(§3.1)/`.table-body`(스크롤)/divider 접두어 색 + morph transition 클래스(`.table-panel.open`). `:host all:initial` 격리·SCDream 베이스는 기존 패턴 따름. 새 색 토큰 0(기존 `#e4007f`/`#94a3b8`/`#0f172a`/`#d9d9d9` 재사용).
- **위험**: low.
- **노력**: M.
- **의존**: 없음.
- **사인오프**: `[ ]`

### ST-A1. morph 애니메이션 wiring
- **제안**: §5.2. 열기/닫기 시퀀스(rAF 2단 + transitionend), `isAnimating` 가드, reduced-motion 분기.
- **위험**: low~medium(transitionend 누락 시 잔류 — 타임아웃 폴백).
- **노력**: M.
- **의존**: ST-S1, ST-P1.
- **사인오프**: `[ ]`

### ST-P1. 위치 앵커 (설정패널 우측 +97px)
- **제안**: 대형 패널 `position:fixed`. 앵커 rect = 설정패널 루트(div[3], §3.2 확정 후) `getBoundingClientRect()`. left = `rect.right + 97`, top = `rect.top`, width 362, height 780(또는 `rect.height`). `tick`(200ms) 에서 열림 중이면 재계산 + `scroll`/`resize` 리스너(디바운스)로 추종. 뷰포트 우측 넘침 시 처리(§6 확인 — 일단 그대로 두고 가로 스크롤 허용 또는 좌측 fallback).
- **위험**: medium(div[3] 가정 틀리면 앵커 어긋남 — §3.2 진단으로 확정).
- **노력**: S~M.
- **의존**: §3.2 진단.
- **사인오프**: `[ ]`

### ST-C3. (Phase 2) 대형 패널 내 컨트롤 — 토글 + 최종 스피드 (2026-05-30 추가)
- **현재**: 특성/도구/상대스카프 토글·최종 스피드(F) 표시는 **심플 패널에만** 있음. 대형 패널은 표만.
- **제안**: 대형 패널 **제목 아래 같은 row** 에 컨트롤 줄 배치 —
  - **좌측 정렬**: 특성 토글 + 도구 토글.
  - **우측 정렬**: 상대 스카프 토글.
  - **최종 스피드 실수치(F)**: 같은 컨트롤 row 의 우측(상대스카프 토글 옆) 또는 제목 row 우측에 `최종: NNN` 형태. 정확한 자리·라벨은 구현 시 확정(제안: 컨트롤 row 우측 끝).
  - 토글은 심플 패널과 **동일 모듈 상태**(`abilityOn`/`itemOn`/`oppScarfOn`) + 동일 storage 키 공유. 한쪽 변경 → 양쪽 즉시 반영(`syncAllState` + 대형 패널 동기화 함수 추가, `persistSpeedPrefs` 그대로). F 변경 시 표 재렌더(기존 `tick` 경로 + 대형 패널 토글 핸들러에서 `lastKey=''` 후 `tick()`).
- **위험**: low(기존 토글 로직 재사용).
- **노력**: M.
- **의존**: ST-C2(대형 패널 마운트). Phase 2 에서 morph(ST-A1)와 함께 진행.
- **사인오프**: `[ ]`

### ST-G1. 가드레일 — 기존 동작 0 회귀
- 심플 패널·호버 팝오버·토글·폴링·스토리지 키 전부 그대로. 본 PR = 순수 추가. `manifest.json` content_scripts 순서 변경 없음(새 파일 없음, `styles/speedPanel.js`·`speedOutspeedCalc.js` 만 수정).
- **검증**: §7. 펼치기 미사용 시 심플 패널이 1.5.0 과 동일.
- **사인오프**: `[ ]`

---

## 7. 수동 검증 절차 (구현 후)

1. 확장 reload + 스마트누오 탭 강제 새로고침. `smartnuo.com/party` 진입.
2. 포켓몬 슬롯 선택 → 심플 스피드 패널 표시. 하단 "스피드표 펼치기" 버튼 + 위 구분선 확인.
3. 버튼 클릭 → 대형 패널이 심플 패널 위치에서 확장되며 설정패널 우측 97px 자리, 362×780 으로 안착(morph 부드러움). 제목 = "파티 리스트" 와 동일 폰트/크기/색(15px/500/#272727).
4. 본문 전체표: 현재 포켓몬 F 기준 핑크(추월)/검정(동속)/회색(불가) 색 분류 + 7 divider(추월 불가, 무보정·준속·최속 × 추월·동속) 라벨이 mockup 순서대로. 종족값 행 스크롤.
5. 포켓몬 변경(스피드 다른 종) / 특성·도구·상대스카프 토글 → 대형 표의 라인·색 실시간 갱신(같은 `tick`).
6. 사이트 스크롤·창 리사이즈 → 대형 패널이 설정패널 우측 97px 정렬 유지.
7. 버튼(또는 X) 재클릭 → 역 morph 후 닫힘. 심플 패널 그대로.
8. **회귀**: 펼치기 안 누른 상태에서 심플 패널·호버 팝오버(최속/준속/무보정 hover → 부분표 + 추월/동속 라인) 가 1.5.0 과 100% 동일.
9. 포켓몬 미선택 상태에서 펼치기 → 안내문 or 중립 표(§4.5 / §6 결정대로).
10. `prefers-reduced-motion` 환경 → 애니 없이 즉시 표시.

---

## 8. PR 체크리스트 (TEMPLATES §9 적용분)

- [ ] `manifest.json` content_scripts 순서 — 신규 파일 0, 변경 없음.
- [ ] host/권한 변경 없음 — PRIVACY.md 변경 없음.
- [ ] 새 storage 키 — 기본 0(`tableOpen` 런타임만). 영속 토글 추가 시 popup/default/onChanged 3곳 반영(§6 확인).
- [ ] Shadow DOM 호스트 ID unique(`nuo-fmt-speed-table-host`), 중복 mount 가드, teardown 에 리스너/타이머 정리.
- [ ] `chrome.runtime.lastError`/storage 실패 폴백 유지.
- [ ] morph transitionend 누락 대비 타임아웃 폴백.
- [ ] CHANGELOG.md 사용자 보이는 변경 한 줄("팀빌더 스피드 패널에 전체 스피드표 펼치기").
- [ ] reduced-motion 분기.
- [ ] 호버 팝오버·심플 패널 0 회귀(ST-G1).

---

## 9. 작업 순서 (의존 그래프)

```
[선행 진단]
§3.2 설정패널 rect 확인 → ST-P1 앵커 확정

[Phase 1 — 렌더·스타일 (애니 없이 정적 표 먼저)]
ST-R1 (전체표 오버레이 렌더 함수)
ST-S1 (CSS: 버튼·구분선·대형 패널·제목·표·divider)
 └─ ST-C1 (심플 패널에 버튼+구분선)

[Phase 2 — 패널 마운트·위치·애니]
ST-P1 (위치 앵커)  ← §3.2
ST-A1 (morph 애니 wiring)  ← ST-S1, ST-P1
 └─ ST-C2 (대형 패널 마운트/토글 + tick 재렌더 연결)  ← ST-R1, ST-A1, ST-P1

[검증]
ST-G1 (회귀 — §7.8)
```

- 추천: Phase 1 에서 **애니 없이** 대형 패널을 즉시 표시(토글 on/off)로 표·색·divider·제목·앵커를 먼저 정확히 맞춤. 그 다음 Phase 2 에서 morph 애니만 입힘. 표 정확성과 애니 디버깅을 분리.
- 예상 노력: **M (반나절)**. 신규 계산 로직 0(기존 함수 재사용), 대부분 렌더·CSS·애니 wiring.

---

## 10. 정보 필요 — **전부 확정 (2026-05-30)**

- [x] **§3.2 설정패널 rect** — div[3] = 설정패널 루트, 362×780, 앵커 `right+97`. 확정.
- [x] **닫기 UX** — 같은 버튼 토글(라벨 펼치기↔접기). (기본 가정 채택.)
- [x] **포켓몬 미선택 시 대형 표** — 안내문 + 중립 회색 표. (기본 가정 채택.)
- [x] **뷰포트 우측 넘침** — 일단 그대로(가로 스크롤 허용), 후속 라운드. (기본 가정 채택.)
- [x] **펼침 상태 영속** — **매 진입 닫힘 시작**(런타임 `tableOpen` 만, storage 키 0). 사용자 확정.

---

## 11. 변경 이력 (Append-only)

- **2026-05-30 v0** — 초기 작성. 사용자 Q1~Q4 답변 반영(오버레이 1표+라벨 라인 / 별도 대형 패널+확장 morph / 현재 포켓몬 기준 실시간 / 제목 콘솔 덤프). FAB write-morph 패턴으로 확장 애니 재현 가능 확인. 제목 스타일 확정(SCDream 15px/500/#272727, parent margin-bottom 9px). 전체표 오버레이 색·divider 모델 확정(§4). 남은 진단: 설정패널 rect(§3.2). 사인오프 + rect 확정 후 Cursor 위임 prompt 작성 예정. (작성: Claude)
- **2026-05-30 v1** — 설정패널 rect 확정(div[3], 362×780, 앵커 `right+97`) + §10 결정 5개 전부 확정. **Phase 1 (정적: 버튼·구분선·대형 패널·전체표 렌더·위치 앵커) Cursor 위임 prompt 전달·적용 성공.** 적용 후 사용자 보정: (1) §4.4 divider 배치 정정 — 추월/동속/불가 **모두 종족값 위(헤더)** 로(초기 mockup "라인-아래" 폐기). (2) 제목 가운데 정렬 + `「레귤레이션 M-A」`/`출전 가능` 줄바꿈. (3) 표 폰트 10→14px. (4) 스크롤바 오토하이드(스크롤 중만 표시, 1.4s 후 fade)·얇은 스타일. (5) 렌더 후 `무보정 추월` 구분선 세로 중앙으로 스크롤. → Phase 1.5 보정 prompt 전달. (6) **ST-C3 신설**(Phase 2): 대형 패널 제목 아래 컨트롤 row — 특성·도구(좌)/상대스카프(우) 토글 + 최종 스피드(F) 표시, 심플 패널과 상태 공유. morph(ST-A1)와 함께 Phase 2. (작성: Claude)
