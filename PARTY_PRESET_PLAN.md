# PARTY_PRESET_PLAN — 파티 저장·불러오기 + 박스

> 브랜치: `feat/party-preset` (main 에서) · 작성 2026-09-26 · 상태: **스펙 작성 — 사용자 검토 대기**
> 목업 원본: `.superpowers/brainstorm/*/content/` (gitignore, 참고용) — `party-card.html`(3안 선택), `overview-v2.html`(최종 부품).
> 선행: [SAMPLE_LIBRARY_PLAN.md](./SAMPLE_LIBRARY_PLAN.md) (샘플 저장소·카드·다이얼로그 셸 — 본 PR 이 재사용·재배치).

---

## 1. 목표 / 성공 기준

**문제 (구글폼 건의 2026-09-25)**: 파티를 여러 개 운영하면 사이트 파티 URL(`#ps=`)을 메모장에 적어 두고 '샘플 불러오기' 창에 붙여 넣어야 함.

**목표**
1. 파티(6슬롯)를 확장 로컬에 이름 붙여 저장하고 한 번에 불러오기.
2. 저장·불러오기 진입점을 샘플과 한 체계로 재배치 — 저장 = 파티 탭 아이콘 줄, 불러오기 = 중앙 열 **박스** 버튼.

**디자인 원칙 (REDESIGN·SAMPLE_LIBRARY 계승)**: 스마트누오 디자인 완전 추종 — 사이트 부품 실측 복제, AI aesthetic(그라데이션·글로우·장식 모션) 금지.

**성공 기준 (관찰 가능)**
- 파티 탭 초록 그룹 저장 아이콘 → 이름 창 → 저장. 박스 → [파티] 탭 → 카드 → 확인 → 6슬롯·좌측 카드·사이트 localStorage `smartnuo.party` 반영.
- 파티 탭 슬롯 줄 저장 아이콘 → 그 슬롯이 샘플로 저장 (편집 중 슬롯이 아니어도).
- 박스 → [샘플] 탭 → 카드 → 확인 → 현재 편집 슬롯(#N)에 입력.
- 계산기·스피드: 박스 → 샘플 카드 → 공격측/수비측 선택 → 해당 패널 입력.
- 사이트 '샘플 불러오기' 버튼·창 = 확장 없는 사이트와 동일 (우리 삽입 0).
- 스마트누오 서버 런타임 호출 추가 0 (저장·불러오기 모두 로컬).
- 사용자 노출 문구 전부 한국어 (`mapCalcFillError` 단일 통과 또는 고정 한국어 alert).

## 2. 결정 기록 (브레인스토밍 합의, 2026-09-25~26)

| 항목 | 결정 | 근거 |
|------|------|------|
| 파티 진입점 범위 | **파티 탭만**. 계산기 "내 파티" 줄은 지금처럼 사이트 파티를 따라감 | 단순. 불러오면 사이트 파티가 바뀌므로 계산기도 자동 추종 |
| 사이트 '샘플 불러오기' 버튼·창 | **우리 삽입 전부 제거 — 사이트 원래 동작** | URL 불러오기는 사이트가 해결. 창 폭 조정·위 여백 문제 소멸 |
| 샘플 이름 칸 저장 버튼 | **제거** | 저장은 아이콘 줄로 일원화 |
| 불러오기 진입점 | 중앙 버튼 열 **`도우미` → `박스`** (계산기·스피드·파티 3탭). 글자 붙여 씀(사이트 2글자 버튼 "교체"와 같음) | 한 버튼 = 한 보관함 |
| 환경설정 입구 | 박스 모달 헤더 X 왼쪽 **작은 톱니** | 도우미 버튼이 유일한 페이지 안 입구였음 |
| 박스 — 파티 탭 | 목록 머리 "내 샘플" → **`샘플 \| 파티`** 텍스트 탭 (사이트 상단 메뉴식) | 사용자 선택 (목업 C) |
| 박스 — 계산기·스피드 | 샘플만 (탭 없음) → 카드 클릭 → **공격측/수비측 선택 창** | 패널별 불러오기 버튼 2개 → 가운데 1개로 통일 |
| 계산기 "내 파티" 줄 | 불러오기 버튼·구분선 **제거**, 칩 6개가 칸 폭 전체에 퍼짐 | 불러오기는 박스로 |
| 저장 아이콘 | 북마크 아이콘 **7개**: 초록 그룹(파티) 1 + 슬롯 헤더 줄 #1~#6. 우리 복사 아이콘 바로 뒤, 사이트 아이콘 4개 앞 | 목업 C·v2 |
| 아이콘 표시 | 우리 복사·저장 아이콘 **항상 보임**. 빈 슬롯/빈 파티에서 누르면 alert "포켓몬을 먼저 선택해 주세요" | 처음 설치한 사용자가 기능 존재를 알 수 있게 (사용자 요청) |
| 파티 저장 이름 | 이름 입력 창 (사이트 '샘플 불러오기' 창 복제) — 최대 16자, Enter = 저장 | 사이트에 파티 이름 칸 없음 |
| 슬롯 저장 이름 | 슬롯 `sample_name` 있으면 바로 저장, 없으면 같은 이름 창("샘플 저장") → 입력값을 저장본 `sample_name` 에도 넣음 (사이트 슬롯 이름은 안 바꿈) | 편집 중이 아닌 슬롯일 수 있어 이름 칸 포커스 불가 |
| 같은 이름 | 덮어쓰기 확인창 (샘플 규칙 그대로) | |
| 불러오기 확인 | **항상** 확인창 — 파티 `'X' 파티를 불러올까요?` / 샘플 `'X' 샘플을 #N 슬롯에 불러올까요?`, 설명 `저장되지 않은 파티/샘플 내용은 사라집니다.` | 카드 오클릭 = 6슬롯 유실 방지. 조사 고정("파티를/샘플을")으로 받침 문제 회피 |
| 파티 카드 | **3안** — 한 줄 6칸 타입색 타일, 이름 없음, 일러 50 + 지닌 물건 20 (사이트 카드 비율 0.4, 일러 상자 오른쪽 아래 겹침), 빈 슬롯 = 흰 점선 칸 | 목업 선택 |
| 파티 상한 | **20개** (샘플 100 유지) | 사용자 결정 |
| 저장 방식 | 슬롯 원본 JSON 로컬 저장 (샘플과 동일, SAMPLE_LIBRARY §2 "저장 방식 A") | 서버 트래픽 0 |

## 3. 사이트 실측 (2026-09-25, 내장 브라우저)

### 3.1 파티 상태 · 쓰기 경로 (번들 `DafyGzG7.js` party store, `BFJqrx6L.js` party 페이지)
- 상태 키 변동 없음: `$sparty.active_slot` / `$sparty.slots` / `$sparty.input` / `$sparty._loading_from_slot` (SAMPLE §3.1).
- store `set_slot(h,E)` = `slots.value = slots.slice(); b[h]=E` (배열 **통째 재대입**). persist 플러그인 = `watch(slots)` + `watch(active_slot)` → 100ms 디바운스 → localStorage `smartnuo.party = { active_slot, slots }`.
  → 배열 재대입(`state['$sparty.slots'] = 새 배열`)은 persist watcher 를 깨움. `slots[i]` 제자리 변경은 안 깨움 (SAMPLE §3.1 관찰과 일치).
- 사이트 파티 URL 불러오기(`nt`, all): 6번 `set_slot(e, 변환본)` → `load_active_slot_to_input()` (= `input = clone(slots[active-1])` + `slot_display='#'+active`, 빈 슬롯이면 빈 입력).
- 편집 패널 watcher: `watch(input, deep)` → `set_slot(active-1, clone(input))` (포켓몬 있을 때). `watch(slots[active-1])` → 비었고 입력에 포켓몬 있으면 `load_active_slot_to_input()`.
- **우리 파티 쓰기** = `state['$sparty.slots'] = clone(6칸)` → 활성 슬롯이 차 있으면 `state['$sparty.input'] = clone(slots[active-1])` + `slot_display`. 비어 있으면 사이트 watcher 가 빈 입력으로 되돌림. **구현 첫 단계에서 localStorage·좌측 카드·편집 패널 반영 실측 필수** (§10).

### 3.2 파티 리스트 헤더 · 슬롯 헤더 아이콘 (사이트 갱신됨)
- 초록 그룹 `absolute right-0 flex items-center px-2 py-1 rounded-[5px] bg-[#66A945]`, 흰 14px img 4개 (`mr-1`, 마지막 제외): 텍스트 복사(`Ze`) / 이미지 저장(`Qe`) / 파티 URL 복사(`Re`, POST `/api/party/share {all:true}`) / 전체 삭제(`J`, 확인창).
- 슬롯 헤더 `#N` 줄 오른쪽 12px 회색 img 4개 (`ml-1`): 텍스트 복사 / 이미지 저장 / 슬롯 URL 복사 / 슬롯 삭제.
- 우리 삽입(기존): 초록 그룹·슬롯 줄 모두 **첫 자식 앞** (`teamBuilderFill.findPartyIconGroup`/`findSlotIconRow`).
- 이미지 저장 캡처는 `.capture-hide` 요소를 지움 — 헤더는 이미 `capture-hide`. 슬롯 줄 아이콘은 캡처 대상 밖(카드만 캡처)인지 구현 시 확인.

### 3.3 중앙 버튼 열
- 계산기 `교체 / 초기화 / 계산`, 파티 `계산기 / 초기화 / 사용법` — `flex flex-col gap-2`, 버튼 64×26 radius 8 `#a1a4ba` 14px/300 흰 글자. 현재 `prefsEntry.js` 가 맨 끝에 `도우미` 삽입.

### 3.4 계산 결과창 공격/수비 아이콘
- `/_nuxt/attacker.<해시>.png`, `/_nuxt/defender.<해시>.png` (해시 배포마다 바뀜 → 계산기 패널 헤더에 떠 있는 img src 를 그때 읽음, SAMPLE §13 `cdfd129` 방식). 색 공격 `#E9C46A` / 수비 `#8FC31F`.

### 3.5 지닌 물건 이미지
- `/data/party/equipment/<encodeURIComponent(kr||en)>.png` (사이트 오리진 상대경로). 없는 물건 = 404 JSON → 우리 목록 기존 `error` 핸들러가 숨김.

## 4. 아키텍처

```
prefsEntry.js      중앙 열 `박스` 버튼 (옛 도우미) + 환경설정 모달(그대로)
  └ 클릭 → nuoBoxHandlers[route]()   (route: team | calc — calc-speed 포함)

sampleLibrary.js   (공용, 확장)
  ├ 저장소: makeStore(key, limit) → samples(nuo_fmt_sampleLibrary, 100) / parties(nuo_fmt_partyLibrary, 20)
  ├ 카드: renderCard(샘플, 기존) + renderPartyCard(3안)
  ├ openBox({ tabs, onPickSample, onPickParty })   — 옛 openListDialog 대체 (제목·톱니·X·탭·뱃지·목록)
  ├ nameDialog(title, label)          → Promise<string|null>
  ├ confirmDialog(q, ok, sub)         (기존)
  └ sideDialog(q)                     → Promise<'attacker'|'defender'|null>

teamBuilderFill.js 아이콘 host 1개 = [복사][저장] (슬롯 6 + 파티 1). 항상 보임. 저장 클릭 → nuoPartyBox.saveSlot(n) / saveParty()
                   nuoTeamCopy.copyPartySlots(slots) 추가 (파티 카드 복사 버튼용)

sampleParty.js     (파티 탭, 재작성) 저장 흐름(슬롯·파티) + nuoBoxHandlers.team
                   ✗ 샘플 이름 칸 저장 버튼 · 사이트 다이얼로그 목록 삽입 · 다이얼로그 폭 조정 삭제

calcFill.js        "내 파티" 줄 불러오기 버튼·구분선 삭제 + nuoBoxHandlers.calc

teamBuilderBridge.js (MAIN, V9→V10)  + NUO_TEAM_WRITE_PARTY
```

### 4.1 저장소
- 샘플: 변화 없음 — `nuo_fmt_sampleLibrary = { version: 1, items: [{ id, name, savedAt, slot, art }] }`, 100개.
- 파티: `nuo_fmt_partyLibrary = { version: 1, items: [{ id, name, savedAt, slots: [6 × (slot|null)], arts: [6 × string] }] }`, 최신이 앞, **20개**.
  - `slots[i]` = bridge `GET_SLOTS` 보강 슬롯 깊은 복사. `pokemon.name` 없는 칸 = `null`.
  - `arts[i]` = 좌측 카드 `official-artwork` img src (`#N` 헤더 → 카드, 샘플 `findActiveArt` 일반화) || `pokemon.sprite` || `''`.
  - 이름 규칙·덮어쓰기·상한 판정 = 샘플 순수 함수 그대로 (`normName`/`findByName`/`withSaved`/`canAdd(limit)`/`withoutId`).
- 용량: 파티 1개 ≈ 12KB × 20 ≈ 240KB. `storage.local` 10MB, 새 permission 없음.
- 구현: 기존 `readAll`/`writeAll`/`saveEntry`/`removeEntry`/`onItemsChange` 를 `makeStore(key, limit)` 로 감싸 두 인스턴스. 샘플 쪽 공개 API 이름은 유지(`LIB.readAll` 등 = 샘플 store) — 호출부 변경 최소화.

### 4.2 MAIN bridge (`teamBuilderBridge.js`)
- 가드 `__NUO_TEAM_BUILDER_BRIDGE_V9__` → `V10`.
- `NUO_TEAM_WRITE_PARTY { slots }` → `NUO_TEAM_WRITE_REPLY { ok, error }`:
  1. `ev.source === window` 가드 (기존 READ/WRITE_INPUT 과 동일).
  2. `slots` 길이 6, 각 칸 `null` 또는 `pokemon.name` 있는 객체 — 아니면 `party_invalid`.
  3. `s['$sparty.slots'] = clone(slots)` (배열 재대입).
  4. `active = s['$sparty.active_slot']`, `cur = clone(slots)[active-1]` 있으면 `cur.slot_display = '#'+active; s['$sparty.input'] = cur`.
  5. 상태 못 찾으면 `bridge_state_missing`.
- 파티 저장·슬롯 저장 **읽기** = 기존 `NUO_TEAM_GET_SLOTS` (보강·복제 완료) 재사용 — 새 읽기 메시지 없음.
- 샘플 불러오기 쓰기 = 기존 `NUO_TEAM_WRITE_INPUT`, 확인창 #N = 기존 `NUO_TEAM_READ_INPUT` 의 `active`.
- 콘텐츠 측 RPC: `teamBuilderShared` 에 `writePartyToBridge(slots)` (기존 `writeInputToBridge` 와 같은 requestId·timeout 패턴).

### 4.3 박스 모달 (`sampleLibrary.openBox`)
- 셸 = 기존 `openShell('list-box', …)` (사이트 Dialog 복제, 폭 380, 사방 20 여백 — 옛 계산기 창과 같음). 마스크 클릭 안 닫힘, Esc = 맨 위 창 닫기 (기존 규칙).
- 헤더: 포켓볼 24px + 핑크 15px/500 **`박스`** / 오른쪽 [톱니 16px `#626262`, hover 핑크][X 18px 검정] 간격 10.
  - 톱니 → 박스 닫고 `nuoPrefsModal.open()`.
- 목록 머리 (기존 `.count` 3칸 grid):
  - 파티 탭: 가운데 `샘플 | 파티` — 14px/500 자간 -0.35, 비활성 `#b5b5b5`, 활성 `#272727`, 구분선 1×12 `#d0d0d0` 좌우 10. 기본 = 샘플.
  - 계산기·스피드: 가운데 `샘플` (현재 "내 샘플" 자리, 같은 스타일).
  - 오른쪽 뱃지 = 박스 아이콘 + `N/100` (샘플) / `N/20` (파티).
- 목록 본문: 탭 전환 = 같은 `.lib` 에 해당 store 로 다시 mount (기존 `mountList` 재사용, `kind` 인자로 카드 렌더러·store·빈 문구 선택).
  - 빈 문구: 샘플 `저장한 샘플이 없습니다` / 파티 `저장한 파티가 없습니다`.
- 카드 머리: 이름 + [복사][삭제] (기존). 파티 복사 = `nuoTeamCopy.copyPartySlots(item.slots)` — 초록 그룹 우리 파티 복사와 같은 변환·환경설정. 결과 말풍선 `파티 복사 완료`.
- 삭제 확인: `'X' 파티를 삭제할까요?` / `삭제하면 복구할 수 없습니다.` [취소][삭제하기].

### 4.4 파티 카드 (`renderPartyCard`, 3안)
- 카드 `display:flex; gap:4px; padding:4px; border:1px solid transparent; radius 8; cursor:pointer`, hover·focus = `#E4007F` 테두리. `role=button tabindex=0` (Enter/Space = 클릭, 기존 키 처리 재사용).
- 타일 6개 `flex:1; height:60px; radius 6; 가운데 정렬`, 배경 = 기존 `typeBg(first_type)`.
  - 일러 상자 `relative 50×50` → `img.a 50×50 contain` + 물건 `img.it absolute right:0 bottom:0 20×20` (사이트 카드 75/30 = 0.4 비율·위치).
  - 빈 칸(`null`) = 흰 배경 + `1px dashed #e0e0e0`.
- 이미지 URL = 기존 `safeUrl` 통과, 텍스트 = `esc`. 물건 이미지 404 → 기존 error 핸들러 숨김.

### 4.5 부품 다이얼로그 (전부 `openShell` 위, 겹쳐 뜸)
- **이름 창** `nameDialog(title, label)` — 헤더 포켓볼 + 핑크 제목(`파티 저장`/`샘플 저장`) + X; 사이트 필드(높이 50, `#d8d8d8`, radius 8, 라벨 9px `#626262`) `파티 이름`/`샘플 이름`, placeholder `이름을 입력해주세요`, `maxlength=16`, 자동 포커스; 버튼 줄 오른쪽 [취소(투명)][저장(`#E9C46A`)] 50×20 10px/300 (사이트 창 실측). Enter = 저장, 빈 이름 저장 = 창 유지 + 필드 포커스 (alert 없음). 결과 = trim 된 이름 | null.
- **확인창** = 기존 `confirmDialog` 그대로 (폭 360, 제목 16px/600, 설명 11px, [취소][확인]).
- **공격/수비 창** `sideDialog(q)` — 확인창 틀. 제목 `'X' 샘플을 어디에 입력할까요?` → 설명 줄 자리에 버튼 2개 (96×32, radius 8, 14px/400 흰 글자, 아이콘 16px 흰 필터, 간격 8, 위아래 12): 공격측 `#E9C46A` + attacker 아이콘 / 수비측 `#8FC31F` + defender 아이콘 → 아래 줄 [취소]. 결과 `'attacker'|'defender'|null`.

## 5. 화면·흐름

### 5.1 파티 탭 — 아이콘 (teamBuilderFill.js)
- 기존 복사 아이콘 host 를 **[복사][저장] 두 버튼 host** 로 확장 (슬롯 6 + 파티 1). 순서 결정적 (host 1개).
  - 초록 그룹: 흰 14px, 버튼 간격 4 (사이트 `mr-1`). 슬롯 줄: 회색 12px `#808080` hover 핑크, 간격 4 (사이트 `ml-1`).
  - 저장 아이콘 = 샘플 저장 버튼의 북마크 SVG (`SAVE_SVG`). aria-label `파티 저장` / `샘플 저장`.
- 게이트: `bridgeReady && isTeamBuilderRoute()` (옛 `filled` 조건 삭제 → 항상 보임).
- 빈 슬롯 복사·저장 / 빈 파티 복사·저장 = busy 없이 alert `포켓몬을 먼저 선택해 주세요` (기존 `빈 슬롯입니다.` 문구 교체).
- 성공 말풍선: 저장 `샘플 저장 완료` / `파티 저장 완료` (기존 말풍선 부품).

### 5.2 파티 탭 — 저장 흐름 (sampleParty.js)
- **파티**: `GET_SLOTS` → 포켓몬 있는 칸 0 → alert. → `nameDialog('파티 저장','파티 이름')` → null 이면 끝 → 새 이름 & 20개 꽉 참 → alert `party_limit` → 같은 이름 → 확인 `'X' 파티가 이미 있어요. 덮어쓸까요?` / `기존 파티 내용은 복구할 수 없습니다.` [덮어쓰기] → 저장 → 말풍선.
- **슬롯 N**: `GET_SLOTS` → `slots[N-1].pokemon.name` 없음 → alert. → 이름 = `sample_name.trim()` 이 비면 `nameDialog('샘플 저장','샘플 이름')` → 입력값을 저장본 `sample_name` 에 대입 → 상한(100)·덮어쓰기 = 기존 샘플 규칙 → `saveEntry(slot, findArt(N))`.

### 5.3 파티 탭 — 박스 (nuoBoxHandlers.team)
- `openBox({ tabs: ['sample','party'], … })`.
- 샘플 카드 → `READ_INPUT` 으로 `active` → 확인 `'X' 샘플을 #N 슬롯에 불러올까요?` / `저장되지 않은 샘플 내용은 사라집니다.` [불러오기] → `WRITE_INPUT` → 박스 닫힘.
- 파티 카드 → 확인 `'X' 파티를 불러올까요?` / `저장되지 않은 파티 내용은 사라집니다.` [불러오기] → `WRITE_PARTY` → 박스 닫힘.
- 확인 취소 = 박스로 돌아감. 실패 = alert (매퍼).

### 5.4 계산기·스피드 — 박스 (nuoBoxHandlers.calc, calcFill.js)
- `openBox({ tabs: ['sample'], … })` → 카드 → `sideDialog` → 선택 시 박스 닫고 `orchestrateCalcFillFromSlot(item.slot, side)`, 실패 alert. 취소 = 박스로 돌아감.
- 공격/수비 아이콘 = 페이지에 떠 있는 `img[src*="/_nuxt/attacker."]` / `defender.` src, 없으면 아이콘 생략 (글자만).

### 5.5 계산기·스피드 — "내 파티" 줄 (calcFill.js, styles/calcPartyRow.js)
- `.bar`·`.load`·`UPLOAD_SVG`·박스 호출 코드 삭제. `.fld` padding `0 12px`, `.chips` margin-right 0 → 칩 6개 space-between 이 칸 폭 전체.
- 칩 동작·빈 상태 문구 변화 없음.

### 5.6 중앙 열 박스 버튼 (prefsEntry.js)
- 라벨 `박스`, aria-label `박스 — 저장한 샘플·파티`. 스타일 = 기존 `.entry` (64×26, 사이트 버튼 복제).
- 클릭 → `route === 'team' ? nuoBoxHandlers.team : nuoBoxHandlers.calc` 호출 (없으면 무시). 환경설정 모달 코드·`nuoPrefsModal` 그대로.

### 5.7 사이트 '샘플 불러오기' 롤백 (sampleParty.js, styles/sampleCard.js)
- 삭제: `findSaveAnchor`/`buildSave`/`sample-save` 등록, `findDialogAnchor`/`closeSiteDialog`/`buildDialogList`/`sample-party-list` 등록, body MO, 폭 조정 style·속성, `nuoSampleSaveCss`.
- 샘플 이름 입력칸 `padding-right` 조정도 함께 사라짐 (사이트 원래값).

### 5.8 공통
- PC(≥820px) 전용·hydration 이후 삽입 = `keepInjected` 규칙 (TEMPLATES §12 v9·v11). 삽입 host `data-nuo-inject`.
- 박스 모달·하위 창은 body 직계 Shadow host (기존 `openShell`), 라우트 전환 시 모두 닫힘 (기존 처리).

## 6. 에러 처리

- 매퍼 `calcFillShared.mapCalcFillError` 에 추가:
  - `party_save_failed` → "파티를 저장하지 못했습니다."
  - `party_read_failed` → "저장한 파티를 불러오지 못했습니다."
  - `party_delete_failed` → "파티를 삭제하지 못했습니다."
  - `party_invalid` → "이 파티는 불러올 수 없습니다."
  - `party_limit` → "파티는 최대 20개까지 저장할 수 있습니다."
- store 는 kind 별 코드로 reject (샘플 = 기존 `storage_*`, 파티 = `party_*`).
- 불러오기 전 검사: 파티 `slots` 길이 6 & 칸마다 null|`pokemon.name` — 아니면 `party_invalid` (항목 유지). 샘플 = 기존 `isLoadable`.
- 빈 슬롯/빈 파티 = 고정 문구 alert `포켓몬을 먼저 선택해 주세요` (사이트 입력 누락 경고와 같은 네이티브 alert, TEMPLATES §0).
- `version` 필드로 추후 스키마 마이그레이션 여지.

## 7. 검증

- 테스트 인프라 없음 (TEMPLATES §10.5). `node --check` 전 파일 + 1회용 node assert 러너(커밋 안 함):
  - `canAdd` 상한 20/100, 같은 이름 덮어쓰기 허용, 공백 이름 판정.
  - `renderPartyCard`: HTML 특수문자 이름 이스케이프, 빈 칸 null·빈 물건·`javascript:` art 차단, 6칸 항상 렌더.
  - 파티 검증 함수(`isPartyLoadable`).
- 사용자 실확장 (확장 새로고침 + 탭 새로고침, alert 는 사용자 확인 — TEMPLATES §12 v12):
  1. 파티 쓰기 실측 먼저 (§3.1) — `smartnuo.party` localStorage·좌측 카드·편집 패널·활성 슬롯 빈 경우.
  2. 아이콘 7개 표시 (빈 파티 포함), 빈 슬롯 alert, 슬롯·파티 저장 (이름 있음/없음/중복/상한).
  3. 박스 3탭 표시·톱니·탭 전환·뱃지·빈 문구·복사·삭제.
  4. 파티 탭 샘플/파티 불러오기 확인 → 반영. 계산기·스피드 공격/수비 입력.
  5. 사이트 '샘플 불러오기' 창 = 원래 모양 (폭 320, 우리 목록 없음), URL 불러오기 정상.
  6. 계산기 "내 파티" 줄 칩 배치. 다른 탭 저장 → 열린 박스 즉시 반영.
- 마무리: `security-review` (bridge 파티 쓰기, 저장 데이터 렌더) + TEMPLATES §9 체크리스트.

## 8. 문서 갱신

- PRIVACY.md — 저장한 파티도 이 브라우저 로컬에만, 외부 전송 없음.
- CHANGELOG.md — `[2.0.0]` 에 파티 저장·불러오기 + 박스 버튼(도우미 대체, 환경설정은 박스 톱니) 한 줄씩. (작업 트리의 기존 미커밋 CHANGELOG 수정은 사용자 것 — 덮어쓰지 말고 이어서 편집.)
- README.md — 도우미 버튼 → 박스, 샘플·파티 저장 위치, FAQ 갱신.
- TEMPLATES.md — §5 파일 설명(`prefsEntry` 박스, `sampleLibrary` 파티·박스), §9 content_scripts 순서(파일 추가 없으면 변화 없음), §12 v13 (배열 재대입 = 파티 쓰기, 아이콘 host 1개 = 순서 결정).
- CLAUDE.md §1·§3 — 본 문서 등록 (BP-A), 종료 시 §2 로.
- SAMPLE_LIBRARY_PLAN.md §13 — "진입점 재배치는 PARTY_PRESET_PLAN" 한 줄.

## 9. 범위 밖

계산기에서 파티 전환, 파티 이름 변경 UI(불러와 다시 저장), 백업/내보내기(BACKLOG 기존), 폴더·검색·정렬, 모바일(<820px), 파티 카드 결정력/내구력 표시, 박스 탭 기억.

## 10. 위험·주의

- **파티 쓰기 경로 미검증** — §3.1 은 번들 읽기로 추론. 구현 Task 1 에서 실측 전엔 UI 작업 착수 금지. 실패 시 사용자와 재논의 (대안 후보 = `active_slot` 을 1~6 순회하며 `input` 대입 — 편집 패널 깜빡임·watcher 부작용이 커서 비추천).
- 사이트 배포로 아이콘 줄·중앙 열 구조가 바뀔 수 있음 → 앵커 텍스트/구조 기반, 실패 시 조용히 미삽입 (기존).
- 도우미 버튼 제거 = 환경설정 입구가 박스 안 톱니 + 툴바 팝업뿐 → README/CHANGELOG 에 명시.
- 저장된 슬롯 = 사이트 스키마 스냅샷 → 먼 미래 불러오기 실패 가능 → 최소 검사 + `version`.
- 스피드 탭 공격측/수비측 라벨이 그 페이지 패널 명칭과 맞는지 구현 시 확인 (다르면 사용자에게 문의).

## 11. 세션 분할 (breakpoint)

| 세션 | 범위 | 종료 조건 |
|------|------|-----------|
| 1 (2026-09-25~26) | 브레인스토밍 → 본 스펙 → 구현 플랜(§12) | 플랜 완성, CLAUDE.md §1·§3 등록, 브랜치 생성 — **BP-A** |
| 2 | 구현 + 사용자 실확장 검증 + 문서 | PR/병합 준비 완료 |

## 12. 구현 플랜

(writing-plans 단계에서 작성)
