<!-- Context: 도우미누오 Chrome 확장 — 팀빌더 간단 스피드 패널 "스피드표 펼치기"(인라인 축소판) PR -->

# 팀빌더 스피드 패널 — "스피드표 펼치기" (인라인 height 펼침) 플랜 v3

> **상태**: **구현 완료 (2026-05-30, v3.3까지)**. 인라인 펼침 스피드표 + 오버레이 divider + 커스텀 스크롤바 + sticky 섹션 헤더 + 하단선. 1.5.0 에 포함(CHANGELOG). 사후 참조·회귀 메모용.
> **레이어**: TEMPLATES §5.4 (스피드 패널 콘텐츠 스크립트) 단일. §8 임베드 데이터·CSS-as-JS 약간.
> **편집 주체**: 런타임 코드 = Cursor 위임(CLAUDE.md §4). 문서 = Claude 직접.

---

## 0. 방향 (v2 → v3 축소)

v1/v2 의 "별도 대형 패널 + morph swap" 컨셉을 **전면 폐기**. v3 = **소형 패널이 그 자리에서 아래로 height 만 펼쳐지고, 그 공간에 스피드표가 인라인으로 뜨는** 최소 구현. 보존하는 가치 = **오버레이 표 렌더 로직**(3프리셋 색 분류 + 최속/준속/무보정별 추월·동속 divider). 나머지(대형 패널·morph·위치 앵커·오버레이 스크롤바·패널 내 토글/프리셋 복제·제목/부제목 재구성)는 전부 제거.

### 본 PR 범위 (v3)

1. 소형 패널 하단에 "스피드표 펼치기" 버튼(+위 구분선). **소형 패널 생김새는 현행 유지** — 버튼만 추가.
2. 펼치기 → 소형 패널 `.panel` 의 **height 가 아래로 확장**(`max-height` transition), 그 공간에 **스피드표 인라인 렌더**.
3. 스피드표 문구·스타일 = **소형 패널 호버 팝오버**(최속/준속/무보정 hover 시 표)와 거의 동일. **단, 우리가 만든 최속/준속/무보정별 동속·추월 divider 로직을 그대로 적용**.
4. 펼친 동안 최속/준속/무보정 칸 **hover 팝오버 비활성**(아래 표가 이미 떠 있으므로).

### 본 PR 범위 밖 / v2 에서 버린 것

- 별도 대형 패널 host, morph/확장 애니(원거리 슬라이드), 진짜 swap, 위치 앵커(설정패널 우측 97px), 패널 내 토글/최종/프리셋 복제, 제목("간단 스피드 계산기")·부제목 재구성 — **전부 폐기**.
- **단, 내부 스크롤은 v2 의 커스텀 오버레이 스크롤바를 유지** — 네이티브 숨김 + opacity fade in/out + thumb 드래그. (롤백으로 사라지므로 §3 ST-6 에서 재구현.)
- 스피드 결정 공식(`computeOutspeedBases`/`findTieSpeciesStat`/`computeFinal`) 로직 변경 없음 — 재사용.
- 권한·외부 fetch·storage 송신 변경 없음 → PRIVACY.md 변경 없음.
- `regulationMaSpeedTable.json` 내용 변경 없음(별도 85종 정정은 본 PR 무관, 이미 반영). `embedSpeedData.js` 재실행 불필요.
- ES5 → 모던 JS 마이그레이션 없음.

---

## 1. 배경 — 롤백 후 기준 상태 (PR 이전 순수 패널)

롤백 후 `speedOutspeedCalc.js` = 본 PR 이전 원본. 핵심 구조(구현 시 의존):

- `tick`(200ms 폴링) 이 `findSpeedRealWrap`(고정 XPath)로 스피드 실수값 wrap 을 잡고, 그 자식으로 Shadow DOM 호스트(`HOST_ID = 'nuo-fmt-speed-outspeed-host'`) inline 부착. 패널 CSS = `globalThis.nuoSpeedPanelCss`(`styles/speedPanel.js`).
- `mountPanelInto(wrap)` → `root.innerHTML` = topRow(특성/도구 토글 + `최종`) → `.preset-boxes-wrap`(최속/준속/무보정 박스 `.boxes` + `.species-pop` 호버 팝오버) → `.caption`("족 추월") → `.toggle.opp`("상대 스카프") → `.chev`(패널 접기 쉐브론).
- `computeFinal(S, 특성, 도구)` → 최종 실수값 F. `computeOutspeedBases(F, 상대스카프)` → `{fastest, neutral, uninvested}`(최속/준속/무보정 추월 가능 최대 종족값).
- **호버 팝오버**: `setupSpeciesPopover(root)` 가 각 `.preset` mouseenter → `fillSpeciesPopover(root, v, presetIdx)`. `buildSpeciesPopoverRows`(앵커 위 3·아래 1 슬라이스), `getPopoverAnchorCutoff`, `findTieSpeciesStat`. divider 2종(`추월`/`동속`, 접두어 없음) via `appendSpeciesPopDivider(bodyEl, label, kind)`. 행 색: `.species-pop-row.hi`(핑크 `#e4007f`)/`.muted`(회색 `#94a3b8`)/`.tie`(검정 `#0f172a`).
- 전체표 데이터: `regulationSpeedBySpeed`(종족값 문자열 키 → 이름 배열), `regulationSpeedMeta.title`. `getTierDescFromMap`(내림차순), `namesForTier`, `opponentEffSpeed(b, ev, nat, oppScarf)`.
- 토글 상태(`abilityOn/itemOn/oppScarfOn/collapsed`) = `chrome.storage.local` 영속.

> 본 PR 은 위에 **순수 추가**. 기존 호버 팝오버·토글·폴링 동작 0 변경(펼친 동안 hover 억제만, §3 ST-4).

---

## 2. 펼친 인라인 스피드표 — 오버레이 모델 (보존 IP)

소형 패널 호버 팝오버는 프리셋 1개만 보여줘 단일 추월/동속 라인이지만, 인라인 펼침 표는 3프리셋을 **한 표에 오버레이**한다. 스타일은 팝오버와 동일(`.species-pop-*` 클래스 재사용), 라인에 접두어.

### 2.1 입력 (현재 포켓몬 기준)

`tick` 이 이미 계산: `S = readSpeedFromWrap(wrap)`, `F = computeFinal(S, abName, abilityOn, itName, itemOn)`, `oppScarfOn`. 펼친 상태면 같은 F 로 표 재렌더(실시간).

### 2.2 프리셋별 경계 (기존 함수 재사용)

```
cutoff_최속  = computeOutspeedBases(F, oppScarf).fastest
cutoff_준속  = .neutral
cutoff_무보정 = .uninvested
eff_p(b)     = opponentEffSpeed(b, ev_p, nat_p, oppScarf)
```
프리셋 (ev, nat): 무보정(0,1.0) / 준속(32,1.0) / 최속(32,1.1).

### 2.3 행 색 규칙 (무보정 기준 3분류, 모호성 0)

종족값 b (우선순위 동속 > 추월 > 불가):
- **검정(동속, `.tie`)**: `eff_최속(b)===F || eff_준속(b)===F || eff_무보정(b)===F`. (서로 다른 ev/nat → 한 b 에서 최대 1개 프리셋만 tie.)
- **핑크(추월, `.hi`)**: 위 아님 + `eff_무보정(b) < F`.
- **회색(불가, `.muted`)**: `eff_무보정(b) > F`.

F 없음(포켓몬 미선택) → 전 행 중립(회색) + 안내문.

### 2.4 divider 규칙 — 모두 종족값 "위"(헤더)

내림차순 렌더, 각 행 b **직전** 삽입. `appendSpeciesPopDivider(bodyEl, label, kind)` 재사용(추월만 `kind='outspeed'` → 핑크빛 라벨).

- `추월 불가`: **첫 회색 행 직전** 1회(표 최상단). 회색 없으면 생략.
- `{프리셋} 동속`: `eff_p(b)===F` 인 행 **직전**.
- `{프리셋} 추월`: 그 프리셋 추월존 진입 첫 행(`eff_p(b)<F`, 직전 행 `≥F`) **직전**.
- **라벨 족수 포함 (v3.1)**: `{프리셋} {N}족 {추월|동속}`. 추월 N = `computeOutspeedBases` 컷오프(출력란 박스 값과 동일, 무보정→uninvested/준속→neutral/최속→fastest). 동속 N = 그 동속 종족값 b. 예: `최속 78족 추월`, `최속 79족 동속`, `무보정 124족 동속`. (`추월 불가` 는 숫자 없음.)

결과(내림차순):
```
──── 추월 불가 ────
(회색 종족값들)
──── 무보정 동속 ────
(무보정 동속 행, 검정)
──── 무보정 추월 ────
(핑크 종족값들)
──── 준속 동속 ──── … ──── 최속 추월 ────
(핑크 종족값들 — 최속 컷오프 이하)
```

### 2.5 엣지 케이스

- 포켓몬 미선택/S 없음 → 라인·색 없이 중립 표 + 안내문 "포켓몬을 선택하면 추월/동속 기준이 표시됩니다."
- cutoff 가 표 범위 밖 → 해당 라인 자연 skip. tie 없음 → 해당 `{p} 동속` 라인·검정 행 생략.
- 표 김 → 펼침 영역 `max-height` 캡 + 내부 `overflow-y:auto`. 스크롤바 = **커스텀 오버레이**(네이티브 숨김, fade in/out, 드래그 — §3 ST-6).

---

## 3. 구현 항목 (ST-*, 축소)

### ST-1. 펼치기 버튼 + 구분선 (소형 패널 하단)
- **현재**: `mountPanelInto` innerHTML 의 `.caption`("족 추월") 까지. 펼침 진입점 없음.
- **제안**: `.panel` 안 `.caption` 아래에 `<div class="expand-sep">`(가로선) + `<button class="expand-btn" id="expand-tbl">스피드표 펼치기</button>`. `.toggle.opp`(절대배치 top:105px)와 시각 충돌 점검(겹치면 opp top 미세조정).
- **위험**: low. **노력**: S. **의존**: ST-2/ST-3. **사인오프**: `[ ]`

### ST-2. 인라인 펼침 영역 (height 확장)
- **제안**: `.caption`/버튼 아래에 펼침 컨테이너:
  ```
  .inline-table-wrap (max-height transition, overflow hidden)
    .inline-table-shell (position: relative)
      .inline-table-body (overflow-y:auto, 네이티브 스크롤바 숨김)
      .inline-sb > .inline-sb-thumb (커스텀 오버레이 — ST-6)
  ```
  접힘 = `.inline-table-wrap { max-height:0 }`. 펼침 = `max-height` 를 **JS 측정값**(`shell.offsetHeight`, body 캡 240px)으로 set → `transition: max-height .3s cubic-bezier(.25,.8,.5,1)` 로 확장. `.inline-table-body { max-height: <캡>; overflow-y:auto }`. 버튼 토글, 라벨 펼치기↔접기(ⓑ). 모듈 변수 `inlineExpanded`(런타임, 매 진입 닫힘). 내용 변경 시 펼친 상태면 `max-height` 재측정.
  - **펼침 위치 (v3.1)**: `.inline-table-wrap` 은 **`.expand-sep` 와 `.expand-btn` 사이**. 즉 가로선 아래로 표가 펼쳐지고 "스피드표 펼치기/접기" 버튼은 그 아래에 딸려가 **펼친 동안 패널 최하단**에 위치.
  - **고정 제목 (v3.1)**: 펼친 표 최상단에 `"Pokémon Champions 「레귤레이션 M-A」 출전 가능 포켓몬 스피드표"`(호버 팝오버 제목과 동일, `regulationSpeedMeta.title`). `position:sticky; top:0; background:#fff` 로 **스크롤해도 상단 고정**. `renderInlineTable` 이 body 첫 자식으로 매 렌더 재삽입.
- **위험**: low. **노력**: M. **의존**: ST-1. **사인오프**: `[ ]`

### ST-3. 전체표 렌더 함수
- **제안**: 신규 `renderFullSpeedTable(root, F, oppScarf)` — §2 모델. `inline-table-body` 에 `.species-pop-row`/`.species-pop-tier`/`.species-pop-names`/`.species-pop-divider*` (팝오버와 동일 클래스·스타일) 로 행·라인 빌드. 기존 `getTierDescFromMap`/`namesForTier`/`computeOutspeedBases`/`opponentEffSpeed`/`appendSpeciesPopDivider` 재사용. `tick` 의 키 변경 시(펼친 상태면) 재호출 → 실시간. 호버 팝오버 코드 0 변경.
- **위험**: low(순수 추가). **노력**: M. **의존**: ST-2. **사인오프**: `[ ]`

### ST-4. 펼친 동안 호버 팝오버 비활성
- **제안**: `setupSpeciesPopover` 의 preset mouseenter 핸들러(`openFromPreset`)에 `if (inlineExpanded) return;` 가드 + 펼칠 때 `hideSpeciesPopover(root)`. 접으면 원복.
- **위험**: low. **노력**: S. **의존**: ST-2. **사인오프**: `[ ]`

### ST-5. (옵션) 펼칠 때 "무보정 추월" 중앙 스크롤 (ⓒ)
- **제안**: 신규 `scrollTableToUninvestedOutspeed(root)` — `inline-table-body` 의 `.species-pop-divider-label` 중 textContent `'무보정 추월'` 찾아 `getBoundingClientRect` 차로 세로 중앙 scrollTop. 펼친 직후(max-height transitionend 후 = 풀 높이) + 재렌더 시 호출.
- **위험**: low. **노력**: S. **의존**: ST-3. **사인오프**: `[ ]`

### ST-6. 커스텀 오버레이 스크롤바 (v2 패턴 재구현)
- **제안**: `.inline-table-body` 네이티브 스크롤바 숨김(`scrollbar-width:none` + `::-webkit-scrollbar{width:0}`). 위에 오버레이 `.inline-sb`(absolute, right, `opacity:0; transition:opacity .35s`) + `.inline-sb-thumb`. 로직 = v2 그대로:
  - `updateScrollbar()`: `scrollHeight/clientHeight` 로 thumb 높이·top 계산, 넘침 없으면 thumb 0.
  - `showScrollbar()`: 스크롤 시 `.show` 추가 → 1.4s 후 fade out(드래그 중 유지).
  - `bindDrag()`: thumb mousedown → `mousemove` 로 `scrollTop` 매핑.
  - 트리거: `inline-table-body` scroll 이벤트 + 렌더 후 `updateScrollbar`.
- **영역 0 잠식**: 네이티브 숨김이라 표가 우측 공간 안 먹음. fade in/out 자연스러움.
- **위험**: low. **노력**: M. **의존**: ST-2/ST-3. **사인오프**: `[ ]`

### ST-G. 가드레일 — 0 회귀
- 호버 팝오버·토글·폴링·스토리지·`manifest.json` 0 변경(새 파일 없음). 수정 = `speedOutspeedCalc.js` + `styles/speedPanel.js` 둘만. 펼치기 미사용 시 패널 = 롤백 직후와 동일.
- **사인오프**: `[x] 구현·검증 완료 (2026-05-30)`

---

## 4. 수동 검증 절차

1. 확장 reload → `/party` 강제 새로고침 → 포켓몬 선택 → 소형 패널 + 하단 "스피드표 펼치기"(+위 구분선).
2. 펼치기 클릭 → 패널 height 가 아래로 부드럽게 확장, 그 공간에 스피드표. 라벨 "스피드표 접기".
3. 표 = 팝오버 스타일(폰트·색) + 핑크/검정/회색 3분류 + 7 divider(추월 불가, 무보정·준속·최속 × 추월·동속) **모두 종족값 위**.
4. 펼친 동안 최속/준속/무보정 칸 **hover 해도 팝오버 안 뜸**.
5. 포켓몬·특성/도구/상대스카프 변경 → 표 실시간 갱신. (ⓒ) "무보정 추월" 중앙.
6. **스크롤바**: 평소 안 보임 → 스크롤하면 fade in, ~1.4s 후 fade out, thumb 드래그 가능, 표가 우측 공간 안 먹음(ST-6).
7. 접기 → 패널 원래 높이로 복귀, hover 팝오버 다시 동작.
8. 펼치기 미사용 시 패널·호버 팝오버 = 롤백 직후와 100% 동일.
9. `prefers-reduced-motion` → max-height 애니 없이 즉시.

---

## 5. PR 체크리스트 (TEMPLATES §9 적용분)

- [ ] `manifest.json` content_scripts 0 변경(새 파일 없음).
- [ ] host/권한/storage 키 0 변경 → PRIVACY.md 0.
- [ ] Shadow DOM 단일 호스트(기존) 재사용 — 별도 host 없음. teardown 시 추가 타이머/리스너 정리.
- [ ] `inlineExpanded` 런타임만(영속 키 없음, 매 진입 닫힘).
- [ ] CHANGELOG.md 한 줄("팀빌더 스피드 패널에 전체 스피드표 펼치기").
- [ ] reduced-motion 분기.
- [ ] 호버 팝오버·소형 패널 0 회귀.

---

## 6. 롤백 후 재검토 체크포인트 (Claude 수행)

사용자 롤백 직후 Claude 가 롤백된 `speedOutspeedCalc.js` / `styles/speedPanel.js` 를 다시 보고 본 plan 의 구현 지시가 맞는지 확인:

- `mountPanelInto` innerHTML 의 정확한 구조·삽입 지점(`.caption` 위치, `.toggle.opp`/`.chev` 절대배치 좌표) → ST-1/ST-2 마크업 자리 확정.
- `setupSpeciesPopover`/`openFromPreset` 시그너처·`hideSpeciesPopover` → ST-4 가드 지점 확정.
- `appendSpeciesPopDivider`/`getTierDescFromMap`/`namesForTier`/`opponentEffSpeed`/`computeOutspeedBases`/`findTieSpeciesStat` 존재·시그너처 → ST-3 재사용 확정.
- `tick` 의 키 비교·`updatePanel` 위치 → 펼친 상태 재렌더 훅 자리.
- `globalThis.nuoSpeedPanelCss` 배열에서 `.species-pop-*` 클래스 재사용 가능 확인 → ST-2/ST-3 CSS 신규 최소화.
- 확인 후 plan 의 항목/스니펫에 수정 필요하면 §3 갱신 + changelog 한 줄.

**검토 완료 (2026-05-30)**: 롤백 깨끗(잔여 table/morph 코드 0). `mountPanelInto` innerHTML `.caption "족 추월"` 직후(`.panel` 내부)가 ST-1/ST-2 삽입 지점, `openFromPreset` 이 ST-4 가드 지점, 재사용 함수(`appendSpeciesPopDivider`/`hideSpeciesPopover`/`setupSpeciesPopover`/`buildPresetHtml`/`computeOutspeedBases`/`opponentEffSpeed`/`getTierDescFromMap`/`namesForTier`/`findTieSpeciesStat`)·`.species-pop-*` CSS 전부 존재 확인. **plan §3 무수정 유효.**

---

## 7. 변경 이력 (Append-only)

- **2026-05-30 v0** — 초기 작성. Q1~Q4 답변(오버레이 1표+라벨 라인 / 별도 대형 패널+확장 morph / 현재 포켓몬 기준 / 제목 콘솔 덤프). 제목 스타일 확정. 오버레이 색·divider 모델(§2 의 전신). (작성: Claude)
- **2026-05-30 v1** — 설정패널 rect 확정 + 결정 5개 확정. **Phase 1(정적 대형 패널·전체표·위치 앵커) prompt 적용**. 보정: divider 전부 행 위(§2.4), 제목 가운데+줄바꿈, 표 폰트 14px, 스크롤바 오토하이드, 무보정 추월 센터. (작성: Claude)
- **2026-05-30 v2** — Phase 2(morph + 패널 컨트롤) 적용 후 방향 전환 시도(대형 = "간단 스피드 계산기" 확대판, 진짜 swap, 제목/부제목 재구성, 프리셋·토글 복제). prompt 까지 작성. (작성: Claude)
- **2026-05-30 v3** — **전면 축소**. v1/v2 의 대형 패널·morph·swap·위치앵커·오버레이 스크롤바·패널 내 복제 전부 폐기. 새 컨셉 = **소형 패널이 그 자리에서 아래로 height 만 펼쳐져 스피드표 인라인 표시**(팝오버 스타일 + 우리 오버레이 divider 로직 §2). 펼친 동안 호버 팝오버 억제. **작업 흐름**: 사용자 백업 commit 으로 PR 이전 순수 상태 롤백 → Claude 가 롤백 파일 대조 재검토(§6) → 사인오프 → Cursor 위임 prompt. 보존 IP = §2 오버레이 표 모델 + v2 커스텀 오버레이 스크롤바(ST-6, fade in/out + 드래그). (작성: Claude)
- **2026-05-30 v3.1** — v3 인라인 구현 적용 성공 후 3개 보정: (1) 펼침 영역을 `.expand-sep`↔`.expand-btn` **사이**로 이동(버튼이 표 아래로 딸려가 펼친 동안 패널 하단). (2) 펼친 표 상단에 레귤 제목 `position:sticky` 고정(스크롤해도 유지). (3) divider 라벨에 족수 포함(`{프리셋} {N}족 {추월\|동속}`, §2.4). (작성: Claude)
- **2026-05-30 v3.2** — 추가 기능 3개(§8): (1) 펼친 상태에서 출력란(최속/준속/무보정 박스) 클릭 → 해당 `{프리셋} N족 추월` 구분선 중앙 스크롤. (2) 펼친 동안 표↔"스피드표 접기" 버튼 사이에 두 번째 가로선(접힘 시 숨김, 버튼과 함께 이동). (3) divider **sticky 섹션 헤더** — 제목 바로 아래에 현재 섹션 구분선 1개 고정(스크롤 위치의 가장 가까운 상위 divider), CSS `position:sticky; top:제목높이` 로 자동 교체. (작성: Claude)
- **2026-05-30 v3.3 (최종)** — 사용자 보정: (1) 출력란 클릭 점프 폐기. (2) 하단 가로선을 버튼 위 토글 방식에서 **스피드표 shell `border-bottom`** 으로 변경(펼침 영역 일부 → 자연 collapse). (3) 본문 `max-height` 360→240px, `inlineTargetHeight`=`shell.offsetHeight` 연계. **PR 완료** — CHANGELOG 1.5.0 새 기능 등재, ST 사인오프 전부 완료. (작성: Claude)

---

## 8. v3.2 추가 기능 상세

<!-- v3.3 changelog: 출력란 클릭 점프 폐기 / 하단선 shell border-bottom / max-height 240 -->

### 8.1 출력란 클릭 → 추월 구분선 센터 — **폐기 (v3.3)**
- v3.2 에서 추가했으나 사용자 요청으로 제거. preset `click` 리스너·`scrollInlineToPresetOutspeed` 삭제. (센터링 유틸 `centerInlineDivider`·`scrollInlineToUninvested` 는 펼칠 때 무보정 추월 센터에 계속 사용 — `offsetTop` 기반, `.inline-table-body{position:relative}`.)

### 8.2 펼침 시 하단 가로선 — **방식 변경 (v3.3)**
- v3.2 의 "버튼 위 `.expand-sep-bottom` + JS display 토글" 은 접을 때 부자연스럽게 사라짐 → 폐기.
- 대신 **스피드표 `.inline-table-shell` 의 `border-bottom: 1px`** 로 표 바로 아래 부착. 펼침 영역(`.inline-table-wrap`) 일부라 `max-height` 애니와 함께 자연 collapse. JS 토글 0.
- `inlineTargetHeight` = `shell.offsetHeight`(border 포함)로 변경(기존 `min(cap, body.scrollHeight)` 폐기 — 이래야 border 1px 안 잘림). 버튼과의 간격은 `.expand-btn` padding-top 로.

### 8.3 sticky 섹션 헤더 divider
- `.inline-table-body .species-pop-divider { position:sticky; top: var(--inline-title-h); background:#fff; margin:0; padding:6px 0; z-index:2 }`(인라인 표 스코프 — 호버 팝오버 미영향).
- 제목(`z-index:3`, sticky top:0)은 `margin→padding` 으로 높이 확정, 렌더 시 `body.style.setProperty('--inline-title-h', titleEl.offsetHeight+'px')`.
- 동작: 같은 top 의 sticky divider 들이 스크롤 시 뒤 divider 가 앞 divider 를 덮음(불투명 bg) → 현재 섹션 헤더가 보이고, 위로 스크롤하면 이전 헤더로 복귀. 순수 CSS(JS 0).

### 8.4 v3.3 보정 요약
- (1) 출력란 클릭 점프 폐기(§8.1). (2) 하단 가로선 = shell `border-bottom`(§8.2). (3) 본문 `max-height` 360→**240px**, `inlineTargetHeight` = `shell.offsetHeight` 연계 수정.
