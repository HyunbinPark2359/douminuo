# PARTY_PRESET_PLAN — 파티 저장·불러오기 + 박스

> 브랜치: `feat/party-preset` (main 에서) · 작성 2026-09-26 · 상태: **구현 완료 (세션 3, 2026-09-26) — Task 1~9 + 최종 리뷰 통과 (Critical 0). 병합 방식 결정 대기. 보류 Minor = §12 끝**
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
| 파티 카드 | **3안** — 한 줄 6칸 타입색 타일, 이름 없음, 일러 50 + 지닌 물건 20 (사이트 카드 비율 0.4, 일러 상자 오른쪽 아래 겹침), 빈 슬롯 = 흰 점선 칸 → **Checkpoint B 에서 3×2 + 왼쪽 정렬 이름으로 개편** (§4.4) | 목업 선택 → 실물 보고 사용자 변경 |
| 박스 높이 | 목록 영역 **420px 고정** (탭 전환·빈 목록에도 창 안 움직임) | Checkpoint B 사용자 요청 |
| 파티 상한 | **20개** (샘플 100 유지) | 사용자 결정 |
| 저장 방식 | 슬롯 원본 JSON 로컬 저장 (샘플과 동일, SAMPLE_LIBRARY §2 "저장 방식 A") | 서버 트래픽 0 |

## 3. 사이트 실측 (2026-09-25, 내장 브라우저)

### 3.1 파티 상태 · 쓰기 경로 (번들 `DafyGzG7.js` party store, `BFJqrx6L.js` party 페이지)
- 상태 키 변동 없음: `$sparty.active_slot` / `$sparty.slots` / `$sparty.input` / `$sparty._loading_from_slot` (SAMPLE §3.1).
- store `set_slot(h,E)` = `slots.value = slots.slice(); b[h]=E` (배열 **통째 재대입**). persist 플러그인 = `watch(slots)` + `watch(active_slot)` → 100ms 디바운스 → localStorage `smartnuo.party = { active_slot, slots }`.
  → 배열 재대입(`state['$sparty.slots'] = 새 배열`)은 persist watcher 를 깨움. `slots[i]` 제자리 변경은 안 깨움 (SAMPLE §3.1 관찰과 일치).
- 사이트 파티 URL 불러오기(`nt`, all): 6번 `set_slot(e, 변환본)` → `load_active_slot_to_input()` (= `input = clone(slots[active-1])` + `slot_display='#'+active`, 빈 슬롯이면 빈 입력).
- 편집 패널 watcher: `watch(input, deep)` → `set_slot(active-1, clone(input))` (포켓몬 있을 때). `watch(slots[active-1])` → 비었고 입력에 포켓몬 있으면 `load_active_slot_to_input()`.
- 사이트 '샘플 불러오기' 창 URL 칸 (`ht`): `#ps=<id>` = 서버 GET 후 `nt`, **`#party=<base64(UTF-8 JSON)>` = 서버 없이 `atob` → `nt`** (`{ all:true, data:[6] }` 또는 `{ slot, data }`). `nt` 는 칸마다 사이트 정규화 `ot`(도감 이름 매칭·성격 객체화 등)를 거침. 단 `ht` 는 창 컴포넌트 내부 함수 — 창 입력칸 값 + '불러오기' 클릭으로만 도달.
- 공유 URL 생성 (`background.js` 파티 복사) = `POST /api/party/share` → `#ps=` — 서버 호출이라 저장·불러오기 경로로는 안 씀 (OPTIMIZATION §A, SAMPLE §2 "저장 방식 B" 기각과 같은 이유).
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

### 4.4 파티 카드 (`renderPartyCard`, 3안 → 3×2 + 이름)
> **Checkpoint B 개편 (2026-09-26, 사용자 요청, `2782def`)**: 3칸 × 2줄 grid, 타일 높이 74, 타일 위에 종 이름 11px/500 `#000` **왼쪽 정렬** (샘플 카드 최소화판 — "메가한카리아스Z" 한 줄), 긴 이름 말줄임, 일러 가운데. 옛 1열 6칸 = git 태그 `party-card-1row`. 아래 줄은 옛 1열 기준 기록.
> **BP-B 후 추가 다듬기 (2026-09-26, 사용자 요청)**: 카드 여백 0 (hover 테두리가 칸에 붙음, radius 7), **한 장 카드** — 칸 사이 여백·칸 모서리 0, 바깥만 카드 `overflow:hidden` 로 둥글게, 칸 구분 = 배경색. 빈 칸 = 연회색 `#f5f5f5` + 가운데 슬롯 번호 14px/500 `#b5b5b5`. 저장 아이콘 = 외곽선 북마크, 복사·저장 아이콘 선 1.5/16.
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

- **파티 쓰기 경로 미검증** — §3.1 은 번들 읽기로 추론. 구현 Task 1 에서 실측 전엔 UI 작업 착수 금지. 실패 시 대안 = **`#party=` base64 경로** (§3.1 — 서버 0, 사이트 자기 정규화): 사이트 '샘플 불러오기' 창을 코드로 열어 입력칸에 `#party=` 값 + '불러오기' 클릭. 창 번쩍임·창 구조 의존이 단점이라 2순위. 대안으로 바꿀 땐 사용자에게 먼저 알림.
- 사이트 배포로 아이콘 줄·중앙 열 구조가 바뀔 수 있음 → 앵커 텍스트/구조 기반, 실패 시 조용히 미삽입 (기존).
- 도우미 버튼 제거 = 환경설정 입구가 박스 안 톱니 + 툴바 팝업뿐 → README/CHANGELOG 에 명시.
- 저장된 슬롯 = 사이트 스키마 스냅샷 → 먼 미래 불러오기 실패 가능 → 최소 검사 + `version`.
- 스피드 탭 공격측/수비측 라벨이 그 페이지 패널 명칭과 맞는지 구현 시 확인 (다르면 사용자에게 문의).

## 11. 세션 분할 (breakpoint)

| 세션 | 범위 | 종료 조건 |
|------|------|-----------|
| 1 (2026-09-25~26) | 브레인스토밍 → 본 스펙 → 구현 플랜(§12) | 플랜 완성, CLAUDE.md §1·§3 등록, 브랜치 생성 — **BP-A** |
| 2 | 파티 쓰기 실측 → 공용 부품(저장소·파티 카드·다이얼로그·박스) → 파티 탭 전체(박스 버튼·아이콘·저장·불러오기·사이트 창 롤백) | 사용자 실확장 파티 탭 검증 통과 + 커밋 — **BP-B** |
| 3 | 계산기·스피드(박스·공격/수비 창·"내 파티" 줄) → 문서(§8) → security-review·§9 체크리스트·최종 리뷰 | 병합 준비 완료 |

각 breakpoint 에서 `handoff` 스킬로 인계 문서 생성, 본 문서 §12 체크박스 갱신. 새 세션은 CLAUDE.md §1 루틴 → 본 문서 §12 의 다음 미완료 Task 부터.

## 12. 구현 플랜

# 파티 저장·불러오기 + 박스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파티(6슬롯)를 확장 로컬에 이름 붙여 저장·불러오고, 저장은 파티 탭 아이콘 줄, 불러오기는 중앙 열 `박스` 버튼으로 샘플과 한 체계로 재배치한다.

**Architecture:** MAIN bridge 에 `$sparty.slots` 배열 재대입 메시지(`NUO_TEAM_WRITE_PARTY`)를 추가하고, `sampleLibrary.js` 의 저장소를 `makeStore(key)` 로 일반화해 샘플(100)·파티(20) 두 인스턴스를 둔다. 박스 모달(`openBox`)·이름 창·공격/수비 창은 기존 다이얼로그 셸 위 부품, 파티 탭 흐름은 `sampleParty.js`, 계산기 흐름은 `calcFill.js` 가 `nuoBoxHandlers.{team,calc}` 로 등록하고 `prefsEntry.js` 의 `박스` 버튼이 라우트별로 호출한다.

**Tech Stack:** Chrome MV3 확장, 런타임 ES5 IIFE(`var`/`function`/콜백, 한국어 주석). 테스트 인프라 없음 → `node --check`·1회용 node assert(스크래치, 커밋 안 함)·사용자 실확장 + Claude in Chrome.

**Spec:** 본 문서 §1~§11 (이 플랜과 같은 파일).

## Global Constraints

- 런타임 코드 ES5: `var`, IIFE `(function (g) { ... })(typeof globalThis !== 'undefined' ? globalThis : self);`, `function () {}`. let/const/화살표/async/class 금지.
- 한국어 주석, 의도·근거 위주. 요청된 것만 — drive-by 리팩터·미관 정리·새 의존성 금지. 자기 변경이 만든 고아만 정리.
- 새 permission / host_permissions / web_accessible_resources 변경 금지. 스마트누오 서버 런타임 호출 추가 0 (도구 아이콘 정적 이미지 제외).
- 저장 키: 샘플 `nuo_fmt_sampleLibrary` (변경 없음, 100개), 파티 `nuo_fmt_partyLibrary = { version: 1, items: [{ id, name, savedAt, slots: [6 × (slot|null)], arts: [6 × string] }] }` (20개), 최신이 앞.
- bridge 가드 `__NUO_TEAM_BUILDER_BRIDGE_V9__` → `__NUO_TEAM_BUILDER_BRIDGE_V10__`. 새 메시지 `NUO_TEAM_WRITE_PARTY { slots }` → `NUO_TEAM_WRITE_REPLY { ok, error }`, source `nuo-team-ext` / `nuo-team-bridge`.
- 사이트 파티 쓰기 = `state['$sparty.slots'] = 새 배열` (재대입) + 활성 슬롯 `state['$sparty.input']` 동기화. `slots[i]` 제자리 변경 금지.
- 사용자 노출 오류 = `mapCalcFillError` 통과 또는 고정 한국어. 새 코드: `party_save_failed`, `party_read_failed`, `party_delete_failed`, `party_invalid`, `party_limit`. 빈 슬롯/빈 파티 = `포켓몬을 먼저 선택해 주세요`.
- 사용자 텍스트(이름·종·물건)는 innerHTML 전 `esc()`, 이미지 URL 은 `safeUrl()`.
- 클릭 결과 오류 = busy 해제 **후** `window.alert` (TEMPLATES §0). 성공 = 말풍선.
- 문구 (확정): 확인창 `'X' 파티를 불러올까요?` / `저장되지 않은 파티 내용은 사라집니다.`, `'X' 샘플을 #N 슬롯에 불러올까요?` / `저장되지 않은 샘플 내용은 사라집니다.`, 공격/수비 `'X' 샘플을 어디에 입력할까요?`, 덮어쓰기 `'X' 파티가 이미 있어요. 덮어쓸까요?` / `기존 파티 내용은 복구할 수 없습니다.`, 버튼 `박스`.
- 커밋 메시지: 영어 conventional (`feat(ext): ...`), 본문 끝 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 커밋 직후 repo 루트에서 `qmd update` → `qmd embed --chunk-strategy auto` → `qmd status` (CLAUDE.md §1).
- 작업 트리의 미커밋 `CHANGELOG.md` 수정은 사용자 것 — Task 8 전까지 스테이징 금지 (`git add` 는 파일 지정).
- CRLF 함정: 여러 줄 수정은 Edit 도구로.
- 확장 새로고침은 사용자 수동 — 체크포인트에서 "확장 새로고침 + 스마트누오 탭 새로고침" 요청. alert 가 뜨면 Claude in Chrome 이 막힘 → 사용자 확인 (TEMPLATES §12 v12).

## Review Focus

1. **불러온 파티에서 활성 슬롯이 빈 칸** — 편집 패널이 비워지고, 이전 편집 포켓몬이 그 빈 슬롯에 되살아나지 않아야 함 (사이트 input watcher 경합). → Task 1 Step 5 실측 B.
2. **한글 IME 조합 중 Enter** (이름 창) — 조합만 확정되고 저장/닫힘이 일어나지 않아야 함. → Task 3 `isComposing` 가드 + Task 6 Step 3 수동.
3. **이름에 HTML 특수문자·앞뒤 공백·공백만** — 파티 카드·확인창에 글자 그대로, 공백만이면 저장 안 됨, `' A '` 와 `'A'` 는 같은 이름(덮어쓰기 확인). → Task 2 node 검사 + Task 3 `submit` trim.
4. **확인창 취소 후 박스에서 다른 카드 선택** — 앞 선택이 실행되지 않고 새 선택만 확인창이 뜸. → Task 6 Step 3 수동.
5. **사이트 '이미지 저장'(파티 리스트·슬롯 캡처)** — 우리 [복사][저장] 아이콘이 이미지에 찍히지 않아야 함 (사이트 아이콘과 같은 처리). → Task 6 Step 3 수동, 찍히면 host 에 `capture-hide` 클래스 추가.

---

## 세션 2 (BP-A → BP-B): 파티 쓰기 실측 + 공용 부품 + 파티 탭

### Task 1: bridge `NUO_TEAM_WRITE_PARTY` + RPC + 에러 코드 + 실측 게이트

**Files:**
- Modify: `extension/teamBuilderBridge.js` (가드 6~7행, 파일 끝 `})();` 앞에 리스너 추가)
- Modify: `extension/teamBuilderShared.js` (`writeInputToBridge` 뒤 함수 추가, export)
- Modify: `extension/calcFillShared.js` (`CALC_FILL_ERR_MSG` 끝)

**Interfaces:**
- Produces: `nuoTeamBuilderShared.writePartyToBridge(slots: Array<object|null>(6)) → Promise<{ ok: boolean, error?: string }>`; 매퍼 코드 5개.

- [x] **Step 1: 가드 버전 올림** — `teamBuilderBridge.js` 6~7행:

```js
  if (window.__NUO_TEAM_BUILDER_BRIDGE_V10__) return;
  window.__NUO_TEAM_BUILDER_BRIDGE_V10__ = true;
```

- [x] **Step 2: 파티 쓰기 리스너** — `teamBuilderBridge.js` 마지막 `})();` 바로 앞 (READ/WRITE_INPUT 리스너 뒤)에 추가:

```js

  /**
   * 파티 불러오기 (PARTY_PRESET_PLAN §4.2). 6칸 배열 통째 재대입 = 사이트 store set_slot 과 같은 경로
   * → persist watcher 가 localStorage `smartnuo.party` 저장. 활성 슬롯은 편집 패널에도 반영
   * (사이트 load_active_slot_to_input 과 같음). 활성 슬롯이 빈 칸이면 사이트 watcher 가 빈 입력으로 되돌림.
   */
  function isPartySlotsShape(slots) {
    if (!Array.isArray(slots) || slots.length !== 6) return false;
    var i;
    for (i = 0; i < 6; i++) {
      var x = slots[i];
      if (x === null) continue;
      if (!x || typeof x !== 'object' || !x.pokemon || !x.pokemon.name) return false;
    }
    return true;
  }

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return; // READ/WRITE_INPUT 과 같은 출처 가드
    var d = ev.data;
    if (!d || d.source !== MSG_EXT || d.type !== 'NUO_TEAM_WRITE_PARTY') return;
    var rid = d.requestId != null ? String(d.requestId) : '';
    waitForPokeListReady(2000, 100).then(function () {
      var s = getNuxtState();
      var active = s && Number(s['$sparty.active_slot']);
      if (!s || !Array.isArray(s['$sparty.slots']) || !(active >= 1 && active <= 6)) {
        postInputReply('NUO_TEAM_WRITE_REPLY', rid, { ok: false, error: 'bridge_state_missing' });
        return;
      }
      var next = cloneSlots(d.slots);
      if (!isPartySlotsShape(next)) {
        postInputReply('NUO_TEAM_WRITE_REPLY', rid, { ok: false, error: 'party_invalid' });
        return;
      }
      try {
        s['$sparty.slots'] = next;
        var cur = cloneSlots(next[active - 1]);
        if (cur) {
          cur.slot_display = '#' + active;
          s['$sparty.input'] = cur;
        }
      } catch (eW) {
        postInputReply('NUO_TEAM_WRITE_REPLY', rid, { ok: false, error: 'bridge_state_missing' });
        return;
      }
      postInputReply('NUO_TEAM_WRITE_REPLY', rid, { ok: true });
    });
  });
```

- [x] **Step 3: 콘텐츠 RPC** — `teamBuilderShared.js` `writeInputToBridge` 함수 뒤:

```js

  /** 파티 불러오기 — 6칸 통째 쓰기 (PARTY_PRESET_PLAN §4.2). */
  function writePartyToBridge(slots) {
    return injectTeamBridgeOnce().then(function () {
      return bridgeRpc('NUO_TEAM_WRITE_PARTY', 'NUO_TEAM_WRITE_REPLY', { slots: slots });
    });
  }
```

export 객체의 `writeInputToBridge: writeInputToBridge,` 다음 줄에 `writePartyToBridge: writePartyToBridge,`.

- [x] **Step 4: 매퍼** — `calcFillShared.js` `sample_limit: ...,` 다음 줄에:

```js
    party_save_failed: '파티를 저장하지 못했습니다.',
    party_read_failed: '저장한 파티를 불러오지 못했습니다.',
    party_delete_failed: '파티를 삭제하지 못했습니다.',
    party_invalid: '이 파티는 불러올 수 없습니다.',
    party_limit: '파티는 최대 20개까지 저장할 수 있습니다.',
```

Run: `node --check extension/teamBuilderBridge.js && node --check extension/teamBuilderShared.js && node --check extension/calcFillShared.js && echo OK`
Expected: `OK`

- [x] **Step 5: 실측 게이트 (§10 — 통과 전 Task 2 이후 착수 금지)** — 사용자에게 "확장 새로고침 + 파티 탭 새로고침, 파티에 포켓몬 2마리 이상, 원본은 스크립트가 백업·복원함" 요청 후 동의 받고 Claude in Chrome `javascript_tool` (MAIN world, 파티 탭)에서:

```js
// A: 활성 슬롯이 차 있는 새 파티 (칸 순서 뒤집기)
var st = window.__NUXT__.state;
window.__nuoProbeBackup = localStorage.getItem('smartnuo.party');
var orig = JSON.parse(JSON.stringify(st['$sparty.slots']));
var rev = orig.slice().reverse().map(function (x) { return x && x.pokemon && x.pokemon.name ? x : null; });
window.postMessage({ source: 'nuo-team-ext', type: 'NUO_TEAM_WRITE_PARTY', requestId: 'probeA', slots: rev }, '*');
await new Promise(function (r) { setTimeout(r, 600); });
var ls = JSON.parse(localStorage.getItem('smartnuo.party'));
({
  stateNames: st['$sparty.slots'].map(function (x) { return x && x.pokemon ? (x.pokemon.name_kr || '') : null; }),
  lsNames: ls.slots.map(function (x) { return x && x.pokemon ? (x.pokemon.name_kr || '') : null; }),
  active: st['$sparty.active_slot'],
  inputName: st['$sparty.input'].pokemon.name_kr,
  display: st['$sparty.input'].slot_display
})
```

Expected: `stateNames` = `lsNames` = 원래 순서의 뒤집힌 배열, `inputName` = `stateNames[active-1]`, `display` = `'#'+active`. 좌측 카드 스크린샷도 뒤집힌 순서.

```js
// B: 활성 슬롯이 빈 칸인 새 파티
var st = window.__NUXT__.state;
var a = st['$sparty.active_slot'];
var cur = JSON.parse(JSON.stringify(st['$sparty.slots']));
cur[a - 1] = null;
cur = cur.map(function (x) { return x && x.pokemon && x.pokemon.name ? x : null; });
window.postMessage({ source: 'nuo-team-ext', type: 'NUO_TEAM_WRITE_PARTY', requestId: 'probeB', slots: cur }, '*');
await new Promise(function (r) { setTimeout(r, 600); });
var ls = JSON.parse(localStorage.getItem('smartnuo.party'));
({ slotA: st['$sparty.slots'][a - 1], lsA: ls.slots[a - 1], inputHasMon: !!st['$sparty.input'].pokemon.name })
```

Expected: `slotA` = `null`, `lsA` = `null`, `inputHasMon` = `false` (Review Focus 1). 편집 패널 비어 있음.

```js
// 복원
localStorage.setItem('smartnuo.party', window.__nuoProbeBackup);
location.reload();
```

복원 후 파티가 원래대로인지 사용자 확인. **A·B 중 하나라도 기대와 다르면 멈추고 사용자와 §10 대안(`#party=` 경로) 논의.**

- [x] **Step 6: 커밋**

```bash
git add extension/teamBuilderBridge.js extension/teamBuilderShared.js extension/calcFillShared.js
git commit -m "feat(ext): bridge party write (NUO_TEAM_WRITE_PARTY) + party error codes"
```

---

### Task 2: 저장소 일반화 + 파티 순수 로직 + 파티 카드

**Files:**
- Modify: `extension/sampleLibrary.js` (상수 11~14행, 순수 로직 41~52행, 카드 렌더 뒤, 저장소 151~207행, export)
- Modify: `extension/styles/sampleCard.js` (`nuoSampleCardCss` 끝)
- Test: `<scratchpad>/check-party-lib.js` (커밋 안 함)

**Interfaces:**
- Consumes: 기존 `normName`, `findByName`, `withSaved`, `withoutId`, `typeBg`, `textOf`, `esc`, `safeUrl`, `COPY_SVG`, `TRASH_SVG`.
- Produces (내부): `makeStore(key, failCode) → { readAll(): Promise<items>, save(entry): Promise, remove(id): Promise, onChange(cb): teardown }`, `samples`, `parties`, `newId()`.
- Produces (export `nuoSampleLibrary`): `PARTY_LIMIT` (20), `canAdd(items, name, limit?)`, `readParties()`, `savePartyEntry(name, slots, arts)`, `removePartyEntry(id)`, `isPartyLoadable(item)`, `renderPartyCard(item)`. 기존 `readAll`/`saveEntry`/`removeEntry` 이름·동작 유지 (샘플).

- [x] **Step 1: 실패하는 검사 작성** — `<scratchpad>/check-party-lib.js`:

```js
// 1회용 검사 (커밋 안 함). 실행: node <이 파일> <repo 경로>
const assert = require('assert');
const path = require('path');
const repo = process.argv[2];
globalThis.nuoCsCommon = {};
globalThis.NUO_SAMPLE_CARD_ASSETS = { stat: [], move: {}, tera: {}, pokeball: 'PB' };
require(path.join(repo, 'extension', 'sampleLibrary.js'));
const L = globalThis.nuoSampleLibrary;
const P = L._pure;

// 상한: 샘플 100 기본, 파티 20. 같은 이름 덮어쓰기는 꽉 차도 허용.
const twenty = Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: 'p' + i }));
assert.strictEqual(L.PARTY_LIMIT, 20);
assert.strictEqual(P.canAdd(twenty, 'new', 20), false);
assert.strictEqual(P.canAdd(twenty, ' p3 ', 20), true);
assert.strictEqual(P.canAdd(twenty, 'new'), true); // 기본 = 100

// 파티 불러오기 가능 판정
const mon = (id, extra) => Object.assign({ pokemon: Object.assign({ name: { id: id }, name_kr: id }, extra || {}) }, {});
assert.strictEqual(P.isPartyLoadable({ slots: [mon('a'), null, null, null, null, null] }), true);
assert.strictEqual(P.isPartyLoadable({ slots: [null, null, null, null, null, null] }), false);
assert.strictEqual(P.isPartyLoadable({ slots: [mon('a')] }), false);
assert.strictEqual(P.isPartyLoadable({ slots: [{ pokemon: {} }, null, null, null, null, null] }), false);
assert.strictEqual(P.isPartyLoadable(null), false);

// 파티 카드: 6칸 항상, 빈 칸 점선, 타입색, 물건 경로, 이스케이프·URL 차단 (Review Focus 3)
const card = P.renderPartyCard({
  id: 'x', name: '<b>"비\'', arts: ['https://raw.githubusercontent.com/a.png', 'javascript:alert(1)', '', '', '', ''],
  slots: [
    mon('garchomp', { first_type: 'dragon', equipment: { en: 'Choice Scarf', kr: '구애스카프' } }),
    mon('evil', { first_type: 'ghost', sprite: 'javascript:bad' }),
    null, null, null, null
  ]
});
assert.strictEqual((card.match(/class="tl/g) || []).length, 6);
assert.strictEqual((card.match(/class="tl e"/g) || []).length, 4);
assert.ok(card.includes('background:#CBD0F6'));
assert.ok(card.includes('/data/party/equipment/' + encodeURIComponent('구애스카프') + '.png'));
assert.ok(card.includes('src="https://raw.githubusercontent.com/a.png"'));
assert.ok(!card.includes('javascript:'));
assert.ok(card.includes('&lt;b&gt;&quot;비&#39;'));
assert.ok(!card.includes('<b>"비'));
assert.ok(card.includes('class="card pt"'));
assert.ok(card.includes('aria-label="파티 복사"'));
// 물건 없는 칸 = 물건 img 없음
const bare = P.renderPartyCard({ id: 'y', name: 'n', arts: [], slots: [mon('a', { equipment: '' }), null, null, null, null, null] });
assert.ok(!bare.includes('class="it"'));
console.log('party lib OK');
```

- [x] **Step 2: 실패 확인**

Run: `node <scratchpad>/check-party-lib.js "C:/Users/qkrgu/Documents/nuo-formatter"`
Expected: FAIL — `AssertionError` (`PARTY_LIMIT` undefined) 또는 `P.isPartyLoadable is not a function`.

- [x] **Step 3: 상수** — `sampleLibrary.js` 11~14행을:

```js
  var KEY = 'nuo_fmt_sampleLibrary';
  var PARTY_KEY = 'nuo_fmt_partyLibrary';
  var SCHEMA = 1;
  // 2026-09-24 실측: 카드 1장 HTML ≈ 18KB(아이콘 data URI 반복) → 100장 그리기 44~72ms. 넘기려면 아이콘을 CSS 로 한 번만 두고 올릴 것.
  var LIMIT = 100;
  var PARTY_LIMIT = 20; // 사용자 결정 (PARTY_PRESET_PLAN §2)
```

- [x] **Step 4: 순수 로직** — 기존 `canAdd` 를 교체하고 `isLoadable` 뒤에 `isPartyLoadable` 추가:

```js
  /** 새 이름은 limit 미만일 때만, 같은 이름 덮어쓰기는 항상 가능. limit 기본 = 샘플 LIMIT. */
  function canAdd(items, name, limit) {
    return items.length < (limit || LIMIT) || !!findByName(items, name);
  }
```

```js
  /** 파티 = 6칸, 칸마다 null 또는 포켓몬 이름 있는 슬롯, 최소 1마리. */
  function isPartyLoadable(item) {
    var s = item && item.slots;
    if (!Array.isArray(s) || s.length !== 6) return false;
    var i, n = 0;
    for (i = 0; i < 6; i++) {
      if (s[i] === null) continue;
      if (!s[i] || !s[i].pokemon || !s[i].pokemon.name) return false;
      n++;
    }
    return n > 0;
  }
```

- [x] **Step 5: 파티 카드 렌더러** — `renderCard` 함수 끝(`return h + '</div></div>';` 다음 `}`) 뒤에:

```js

  /**
   * 파티 항목 → 카드 마크업 (PARTY_PRESET_PLAN §4.4, 목업 3안). 머리 줄은 샘플 카드와 같은 부품.
   * 타일 = 타입색 + 일러 50 + 지닌 물건 20 (사이트 카드 75/30 비율·위치), 빈 칸 = 흰 점선.
   * @param {{ id: string, name: string, slots: Array, arts: Array }} item
   * @returns {string}
   */
  function renderPartyCard(item) {
    var id = esc(item.id);
    var slots = Array.isArray(item.slots) ? item.slots : [];
    var arts = Array.isArray(item.arts) ? item.arts : [];
    var h = '<div class="head"><span class="nm">' + esc(item.name) + '</span><span class="acts">' +
      '<button type="button" class="cp" data-id="' + id + '" aria-label="파티 복사">' + COPY_SVG + '</button>' +
      '<button type="button" class="del" data-id="' + id + '" aria-label="삭제">' + TRASH_SVG + '</button></span></div>' +
      '<div class="card pt" role="button" tabindex="0" data-id="' + id + '">';
    var k;
    for (k = 0; k < 6; k++) {
      var p = slots[k] && slots[k].pokemon;
      if (!p || !p.name) { h += '<div class="tl e"></div>'; continue; }
      var equip = textOf(p.equipment);
      var art = safeUrl(arts[k]) || safeUrl(p.sprite);
      h += '<div class="tl" style="background:' + typeBg(p.first_type) + '"><span class="ab">' +
        (art ? '<img class="a" src="' + esc(art) + '" alt="">' : '') +
        (equip ? '<img class="it" src="/data/party/equipment/' + encodeURIComponent(equip) + '.png" alt="">' : '') +
        '</span></div>';
    }
    return h + '</div>';
  }
```

- [x] **Step 6: 저장소 일반화** — `/* ===== 저장소 ===== */` 부터 `onItemsChange` 함수 끝까지(151~207행)를 교체:

```js
  /* ===== 저장소 — 샘플·파티 같은 모양 문서 { version, items } (PARTY_PRESET_PLAN §4.1) ===== */

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * @param {string} key chrome.storage.local 키
   * @param {string} failCode 읽기·쓰기 실패 reject 코드
   */
  function makeStore(key, failCode) {
    function readAll() {
      return new Promise(function (resolve, reject) {
        try {
          chrome.storage.local.get([key], function (got) {
            if (chrome.runtime.lastError) { reject(new Error(failCode)); return; }
            var doc = got && got[key];
            resolve(doc && doc.version === SCHEMA && Array.isArray(doc.items) ? doc.items : []);
          });
        } catch (e) {
          reject(new Error(failCode));
        }
      });
    }
    function writeAll(items) {
      return new Promise(function (resolve, reject) {
        try {
          var obj = {};
          obj[key] = { version: SCHEMA, items: items };
          chrome.storage.local.set(obj, function () {
            if (chrome.runtime.lastError) { reject(new Error(failCode)); return; }
            resolve();
          });
        } catch (e) {
          reject(new Error(failCode));
        }
      });
    }
    return {
      readAll: readAll,
      save: function (entry) { return readAll().then(function (items) { return writeAll(withSaved(items, entry)); }); },
      remove: function (id) { return readAll().then(function (items) { return writeAll(withoutId(items, id)); }); },
      /** 다른 탭 저장·삭제 즉시 반영. @returns {function} teardown */
      onChange: function (cb) {
        if (typeof CS.onLocalPrefChange !== 'function') return function () {};
        return CS.onLocalPrefChange([key], function () { readAll().then(cb, function () {}); });
      }
    };
  }

  var samples = makeStore(KEY, 'storage_failed');
  var parties = makeStore(PARTY_KEY, 'party_save_failed');

  /**
   * @param {object} slot bridge 가 읽은 보강 슬롯 (sample_name 포함)
   * @param {string} art 일러스트 URL
   */
  function saveEntry(slot, art) {
    return samples.save({ id: newId(), name: normName(slot.sample_name), savedAt: Date.now(), slot: slot, art: art || '' });
  }

  /**
   * @param {string} name 파티 이름
   * @param {Array} slots 6칸 (빈 칸 null)
   * @param {Array} arts 6칸 일러 URL
   */
  function savePartyEntry(name, slots, arts) {
    return parties.save({ id: newId(), name: normName(name), savedAt: Date.now(), slots: slots, arts: arts });
  }
```

그리고 `mountList` 안 `readAll().then(...)` 과 `onItemsChange(...)` 두 줄은 Task 3 에서 교체되므로 이 Task 에선 임시로 `samples.readAll()` / `samples.onChange(...)` 로 이름만 바꿔 문법·동작 유지. `mountList` 삭제 버튼의 `removeEntry(d.id)` 도 `samples.remove(d.id)` 로.

- [x] **Step 7: export** — `g.nuoSampleLibrary = { ... }` 를:

```js
  g.nuoSampleLibrary = {
    LIMIT: LIMIT,
    PARTY_LIMIT: PARTY_LIMIT,
    normName: normName,
    findByName: findByName,
    canAdd: canAdd,
    isLoadable: isLoadable,
    isPartyLoadable: isPartyLoadable,
    readAll: samples.readAll,
    saveEntry: saveEntry,
    removeEntry: samples.remove,
    readParties: parties.readAll,
    savePartyEntry: savePartyEntry,
    removePartyEntry: parties.remove,
    renderCard: renderCard,
    renderPartyCard: renderPartyCard,
    mountList: mountList,
    confirmDialog: function (q, ok, sub) { return confirmDialog(q, ok, sub); },
    openListDialog: function (o) { return openListDialog(o); },
    _pure: {
      normName: normName, findByName: findByName, withSaved: withSaved, withoutId: withoutId,
      isLoadable: isLoadable, isPartyLoadable: isPartyLoadable, spColor: spColor, natureDot: natureDot, typeBg: typeBg,
      esc: esc, renderCard: renderCard, renderPartyCard: renderPartyCard,
      renderList: renderList, canAdd: canAdd, LIMIT: LIMIT, listTitleHtml: listTitleHtml
    }
  };
```

(`openListDialog`/`listTitleHtml` 은 Task 3 에서 제거.)

- [x] **Step 8: 파티 카드 CSS** — `styles/sampleCard.js` `nuoSampleCardCss` 배열의 마지막 항목(`'.st .v { font-weight: 500; }'`) 뒤에 `,` 붙이고:

```js
    // 파티 카드 (PARTY_PRESET_PLAN §4.4) — .card 의 hover·클릭·키보드 규칙 재사용, 높이·여백만 덮음.
    '.card.pt { height: auto; padding: 4px; gap: 4px; align-items: stretch; }',
    '.tl { flex: 1; min-width: 0; height: 60px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }',
    '.tl.e { background: #fff; border: 1px dashed #e0e0e0; }',
    // 물건 = 일러 상자 오른쪽 아래 겹침 — 사이트 카드(일러 75 · 물건 30)와 같은 0.4 비율·위치.
    '.tl .ab { position: relative; width: 50px; height: 50px; }',
    '.tl .a { display: block; width: 50px; height: 50px; object-fit: contain; }',
    '.tl .it { position: absolute; right: 0; bottom: 0; width: 20px; height: 20px; }'
```

- [x] **Step 9: 통과 확인**

Run: `node --check extension/sampleLibrary.js && node --check extension/styles/sampleCard.js && node <scratchpad>/check-party-lib.js "C:/Users/qkrgu/Documents/nuo-formatter"`
Expected: `party lib OK`

- [x] **Step 10: 커밋**

```bash
git add extension/sampleLibrary.js extension/styles/sampleCard.js
git commit -m "feat(ext): party library store and party card renderer"
```

---

### Task 3: 박스 모달 + 탭 목록 + 이름 창 + 공격/수비 창

**Files:**
- Modify: `extension/sampleLibrary.js` (`/* ===== 목록 ===== */` 구역 전체, `/* ===== 다이얼로그 셸 ===== */` 의 `listTitleHtml`/`openListDialog` 구역, export)
- Modify: `extension/styles/sampleCard.js` (`nuoSampleCardCss`·`nuoSampleDialogCss`)
- Test: `<scratchpad>/check-party-lib.js` (항목 추가)

**Interfaces:**
- Consumes: Task 2 `samples`, `parties`, `renderPartyCard`, `isPartyLoadable`, `PARTY_LIMIT`; 기존 `openShell`, `dismiss`, `confirmDialog`, `X_SVG`, `BOX_SVG`, `A.pokeball`.
- Consumes (클릭 시점): `g.nuoTeamCopy.copySampleSlot(slot)` (기존), `g.nuoTeamCopy.copyPartySlots(slots)` (Task 5), `g.nuoPrefsModal.open()` (기존 prefsEntry).
- Produces (export): `openBox({ kinds: string[], onPick: function(item, kind, box) }) → box` (`box.close()` 로 닫음), `nameDialog(title, label) → Promise<string|null>`, `sideDialog(question, { attacker, defender }) → Promise<'attacker'|'defender'|null>`, `mountList(box, { kinds, onPick(item, kind) }) → teardown`. `openListDialog` 제거.

- [x] **Step 1: 실패하는 검사 추가** — `check-party-lib.js` 의 `console.log` 앞에:

```js
// 목록 머리: 탭 / 단일 라벨, 개수 뱃지는 종류별 상한, 빈 상태에도 머리 줄 (탭 전환 가능해야 함)
const tabs = P.headHtml(['sample', 'party'], 'party');
assert.ok(tabs.includes('class="tab on" data-kind="party"'));
assert.ok(tabs.includes('class="tab" data-kind="sample"'));
assert.ok(tabs.includes('<i></i>'));
assert.strictEqual(P.headHtml(['sample'], 'sample'), '<span class="lbl">샘플</span>');
const emptyParty = P.renderList([], P.KINDS.party, P.headHtml(['sample', 'party'], 'party'));
assert.ok(emptyParty.includes('0/20'));
assert.ok(emptyParty.includes('저장한 파티가 없습니다'));
assert.ok(emptyParty.includes('data-kind="sample"'));
const oneSample = P.renderList([{ id: 's', name: 'n', art: '', slot: { pokemon: { name: { id: 'a' } } } }], P.KINDS.sample, P.headHtml(['sample'], 'sample'));
assert.ok(oneSample.includes('1/100'));
assert.ok(oneSample.includes('class="list"'));
```

Run: `node <scratchpad>/check-party-lib.js "C:/Users/qkrgu/Documents/nuo-formatter"`
Expected: FAIL — `P.headHtml is not a function`.

- [x] **Step 2: 종류 표 + 목록 렌더** — `/* ===== 목록 ===== */` 아래 기존 `renderList` 함수를 교체:

```js
  /* ===== 목록 — 샘플·파티 공용 (PARTY_PRESET_PLAN §4.3) ===== */

  var KINDS = {
    sample: { store: samples, limit: LIMIT, render: renderCard, noun: '샘플', obj: '샘플을', empty: '저장한 샘플이 없습니다',
      readErr: 'storage_read_failed', delErr: 'storage_delete_failed', loadable: isLoadable, invalid: 'sample_invalid', copied: '샘플 복사 완료' },
    party: { store: parties, limit: PARTY_LIMIT, render: renderPartyCard, noun: '파티', obj: '파티를', empty: '저장한 파티가 없습니다',
      readErr: 'party_read_failed', delErr: 'party_delete_failed', loadable: isPartyLoadable, invalid: 'party_invalid', copied: '파티 복사 완료' }
  };

  /** 목록 머리 가운데 — 종류 1개면 라벨, 2개면 사이트 상단 메뉴식 텍스트 탭 (세로 구분선). */
  function headHtml(kinds, cur) {
    if (kinds.length === 1) return '<span class="lbl">' + KINDS[cur].noun + '</span>';
    return '<span class="lbl tabs">' + kinds.map(function (k) {
      return '<button type="button" class="tab' + (k === cur ? ' on' : '') + '" data-kind="' + k + '" aria-pressed="' + (k === cur) + '">' +
        KINDS[k].noun + '</button>';
    }).join('<i></i>') + '</span>';
  }

  /** 머리 줄은 빈 상태에도 그림 (탭 전환). 개수 뱃지 = 파티 탭 "SP 66/66" 뱃지 실측 + 회색. */
  function renderList(items, k, head) {
    var top = '<div class="count">' + head + '<span class="badge">' + BOX_SVG + items.length + '/' + k.limit + '</span></div>' +
      '<p class="msg" role="status"></p>';
    if (!items.length) return top + '<p class="empty">' + k.empty + '</p>';
    return top + '<div class="shell"><div class="list">' + items.map(k.render).join('') + '</div>' +
      '<div class="sb"><div class="thumb"></div></div><div class="tip" role="status" hidden></div></div>';
  }
```

- [x] **Step 3: `mountList` 일반화** — 기존 `mountList` 의 JSDoc~`box.addEventListener('click', ...)` 핸들러 끝까지(스크롤바 코드 앞)를 교체. 스크롤바·키보드·이미지 error 핸들러·return teardown 은 그대로 두되 teardown 의 `off()` 를 `offs.forEach(function (f) { f(); })` 로:

```js
  /**
   * box(Shadow 안 요소)에 목록을 그리고 저장소 변경을 따라감. 탭 = 종류 전환, 카드 클릭 = onPick(item, kind),
   * 휴지통 = 확인 후 삭제, 복사 = 파티 탭 복사 아이콘과 같은 변환 (teamBuilderFill.js nuoTeamCopy).
   * box 가 속한 Shadow root 에 nuoSampleCardCss 가 있어야 함.
   * @param {Element} box
   * @param {{ kinds: string[], onPick: function(object, string) }} opts
   * @returns {function} teardown
   */
  function mountList(box, opts) {
    var kinds = opts.kinds && opts.kinds.length ? opts.kinds : ['sample'];
    var cur = kinds[0];
    var items = [];
    var tipTimer = null;
    function draw() { box.innerHTML = renderList(items, KINDS[cur], headHtml(kinds, cur)); }
    /** 결과 말풍선 — .list 가 overflow 로 자르므로 .shell 기준으로 버튼 위에 띄움. */
    function showTip(btn, text, ms) {
      var tip = box.querySelector('.shell > .tip');
      var shell = box.querySelector('.shell');
      if (!tip || !shell) return;
      var b = btn.getBoundingClientRect();
      var s = shell.getBoundingClientRect();
      tip.textContent = text;
      tip.style.left = (b.left + b.width / 2 - s.left) + 'px';
      tip.style.top = (b.top - s.top) + 'px';
      tip.hidden = false;
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function () { tip.hidden = true; }, ms);
    }
    function setMsg(t) {
      var m = box.querySelector('.msg');
      if (m) m.textContent = t || '';
    }
    function itemOf(el) {
      var id = el.getAttribute('data-id');
      var i;
      for (i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
      return null;
    }
    function load() {
      var k = cur;
      KINDS[k].store.readAll().then(function (it) {
        if (k !== cur) return; // 읽는 사이 탭이 바뀜
        items = it;
        draw();
      }, function () {
        if (k !== cur) return;
        items = [];
        draw();
        setMsg(mapErr(KINDS[k].readErr));
      });
    }
    load();
    var offs = kinds.map(function (k) {
      return KINDS[k].store.onChange(function (it) {
        if (k !== cur) return;
        items = it;
        draw();
      });
    });

    box.addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (tab) {
        var nk = tab.getAttribute('data-kind');
        if (nk !== cur && KINDS[nk]) { cur = nk; load(); }
        return;
      }
      var cp = e.target.closest('.cp');
      if (cp) {
        var c = itemOf(cp);
        var TC = g.nuoTeamCopy;
        if (!c || cp.classList.contains('busy') || !TC) return;
        var kc = KINDS[cur];
        var job = cur === 'party' ? TC.copyPartySlots && TC.copyPartySlots(c.slots) : TC.copySampleSlot(c.slot);
        if (!job) return;
        cp.classList.add('busy');
        job.then(function () {
          cp.classList.remove('busy');
          showTip(cp, kc.copied, 1500);
        }, function (err) {
          cp.classList.remove('busy');
          window.alert((err && err.message) || '변환 실패');
        });
        return;
      }
      var del = e.target.closest('.del');
      if (del) {
        var d = itemOf(del);
        var kd = KINDS[cur];
        if (!d) return;
        confirmDialog('\'' + d.name + '\' ' + kd.obj + ' 삭제할까요?', '삭제하기', '삭제하면 복구할 수 없습니다.').then(function (yes) {
          if (yes) kd.store.remove(d.id).catch(function () { window.alert(mapErr(kd.delErr)); });
        });
        return;
      }
      var card = e.target.closest('.card');
      if (!card) return;
      var it = itemOf(card);
      if (!it) return;
      if (!KINDS[cur].loadable(it)) { window.alert(mapErr(KINDS[cur].invalid)); return; }
      opts.onPick(it, cur);
    });
```

- [x] **Step 4: 박스·이름 창·공격/수비 창** — `listTitleHtml` 과 `openListDialog` (JSDoc 포함)를 삭제하고 그 자리에:

```js
  // Material "settings" (사이트 아이콘 세트와 같은 계열), 16px 회색 — 박스 헤더 X 왼쪽.
  var GEAR_SVG = '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm112-260q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Z"/></svg>';

  function titleHtml(text) {
    return '<span class="ttl">' + (A.pokeball ? '<img src="' + esc(A.pokeball) + '" alt="">' : '') + esc(text) + '</span>';
  }

  /**
   * 박스 — 중앙 열 `박스` 버튼(prefsEntry)의 모달 (PARTY_PRESET_PLAN §4.3). 톱니 = 박스 닫고 환경설정.
   * 카드 클릭은 닫지 않음 — 호출자가 확인 후 box.close().
   * @param {{ kinds: string[], onPick: function(object, string, object) }} opts
   * @returns {{ close: function() }}
   */
  function openBox(opts) {
    var sh = openShell('list-box',
      '<div class="hd">' + titleHtml('박스') + '<span class="hacts">' +
      '<button type="button" class="gear" aria-label="환경설정">' + GEAR_SVG + '</button>' +
      '<button type="button" class="x" aria-label="닫기">' + X_SVG + '</button></span></div><div class="lib"></div>');
    sh.root.querySelector('.x').addEventListener('click', function () { dismiss(sh); });
    sh.root.querySelector('.gear').addEventListener('click', function () {
      dismiss(sh);
      if (g.nuoPrefsModal && typeof g.nuoPrefsModal.open === 'function') g.nuoPrefsModal.open();
    });
    sh.teardown = mountList(sh.root.querySelector('.lib'), {
      kinds: opts.kinds,
      onPick: function (item, kind) { opts.onPick(item, kind, sh); }
    });
    return sh;
  }

  /**
   * 이름 입력 창 — 사이트 '샘플 불러오기' 창 복제 (제목 + 라벨 필드 + [취소][저장]). Enter = 저장.
   * @param {string} title '파티 저장' / '샘플 저장'
   * @param {string} label '파티 이름' / '샘플 이름'
   * @returns {Promise<string|null>} trim 한 이름, 취소면 null
   */
  function nameDialog(title, label) {
    return new Promise(function (resolve) {
      var sh = openShell('name-box',
        '<div class="hd">' + titleHtml(title) + '<button type="button" class="x" aria-label="닫기">' + X_SVG + '</button></div>' +
        '<label class="nf"><span class="nl">' + esc(label) + '</span>' +
        '<input type="text" maxlength="16" placeholder="이름을 입력해주세요" spellcheck="false" autocomplete="off"></label>' +
        '<div class="row"><button type="button" class="btn plain" data-a="no">취소</button>' +
        '<button type="button" class="btn ok" data-a="yes">저장</button></div>',
        function () { resolve(null); });
      var inp = sh.root.querySelector('input');
      function submit() {
        var v = normName(inp.value);
        if (!v) { inp.focus(); return; } // 빈 이름 = 창 유지 (§4.5)
        sh.close();
        resolve(v);
      }
      sh.root.querySelector('.x').addEventListener('click', function () { dismiss(sh); });
      sh.root.querySelector('.row').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.getAttribute('data-a') === 'yes') submit();
        else dismiss(sh);
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter 무시 (Review Focus 2)
        e.preventDefault();
        submit();
      });
      inp.focus();
    });
  }

  /**
   * 계산기·스피드 — 샘플을 공격/수비 어느 쪽에 넣을지 (확인창 틀, 설명 줄 자리에 버튼 2개).
   * 색 = 사이트 '계산' 결과창 공격측 #E9C46A / 수비측 #8FC31F.
   * @param {string} question
   * @param {{ attacker: string, defender: string }} icons 사이트 칼/방패 img src ('' 이면 글자만)
   * @returns {Promise<'attacker'|'defender'|null>}
   */
  function sideDialog(question, icons) {
    function ic(src) {
      var u = safeUrl(src);
      return u ? '<img src="' + esc(u) + '" alt="">' : '';
    }
    return new Promise(function (resolve) {
      var sh = openShell('confirm',
        '<p class="q">' + esc(question) + '</p>' +
        '<div class="sides"><button type="button" class="side atk" data-a="attacker">' + ic(icons && icons.attacker) + '공격측</button>' +
        '<button type="button" class="side def" data-a="defender">' + ic(icons && icons.defender) + '수비측</button></div>' +
        '<div class="acts"><button type="button" class="btn ghost" data-a="no">취소</button></div>',
        function () { resolve(null); });
      sh.root.querySelector('.box').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var a = b.getAttribute('data-a');
        sh.close();
        resolve(a === 'attacker' || a === 'defender' ? a : null);
      });
      sh.root.querySelector('.side.atk').focus();
    });
  }
```

- [x] **Step 5: export 갱신** — `nuoSampleLibrary` 에서 `openListDialog` 줄 삭제, 다음 추가: `openBox: function (o) { return openBox(o); }, nameDialog: function (t, l) { return nameDialog(t, l); }, sideDialog: function (q, i) { return sideDialog(q, i); },`. `_pure` 에서 `listTitleHtml` 삭제, `headHtml: headHtml, KINDS: KINDS` 추가.

- [x] **Step 6: CSS** — `styles/sampleCard.js`:
  - `nuoSampleCardCss` 의 `.count .lbl` 줄 다음에:

```js
    // 박스 파티 탭 — 사이트 상단 메뉴("계산기 | 스피드 | 도감")식 텍스트 탭 + 세로 구분선 (목업 합의 2026-09-26).
    '.tabs { display: flex; align-items: center; }',
    '.tab { padding: 0; border: 0; background: none; font: inherit; letter-spacing: inherit; color: #b5b5b5; cursor: pointer; transition: color 0.15s; }',
    '.tab:hover { color: var(--nuo-text-muted); }',
    '.tab.on { color: var(--nuo-text-strong); cursor: default; }',
    '.tabs i { display: block; width: 1px; height: 12px; margin: 0 10px; background: #d0d0d0; }',
    '.tab:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 2px; }',
```

  - `nuoSampleDialogCss` 의 `.x { ... }` 줄 다음에:

```js
    '.hacts { display: flex; align-items: center; gap: 10px; }',
    '.gear { width: 16px; height: 16px; padding: 0; border: 0; background: none; color: var(--nuo-text-muted); cursor: pointer; line-height: 0; transition: color 0.15s; }',
    '.gear:hover { color: var(--nuo-primary); }',
    '.gear svg { width: 16px; height: 16px; fill: currentColor; }',
    // 이름 창 = 사이트 '샘플 불러오기' 창(폭 320) + 사이트 라벨 필드(높이 50, #d8d8d8, radius 8, 라벨 9px).
    '.box.name-box { width: 320px; padding-top: 20px; }',
    '.nf { position: relative; display: block; margin-bottom: 12px; }',
    '.nl { position: absolute; top: -6px; left: 12px; padding: 0 4px; background: #fff; font-size: 9px; line-height: 1; color: var(--nuo-text-muted); white-space: nowrap; }',
    '.nf input { display: block; width: 100%; height: 50px; padding: 8px 12px; border: 1px solid var(--nuo-field-border); border-radius: 8px; background: #fff; font: 400 14px var(--nuo-font); color: var(--nuo-text-strong); outline: none; box-sizing: border-box; }',
    '.nf input::placeholder { color: #9e9e9e; }',
    '.nf input:focus { border-color: var(--nuo-primary); }',
    '.row { display: flex; justify-content: flex-end; gap: 6px; }',
    '.btn.plain { background: transparent; color: #272727; }',
    // 공격/수비 창 버튼 — 확인창 설명 줄 자리, 96×32 (사용자 요청: 보기 쉽게 크게).
    '.sides { display: flex; justify-content: center; gap: 8px; margin: 12px 0; }',
    '.side { display: flex; align-items: center; justify-content: center; gap: 6px; width: 96px; height: 32px; padding: 0; border: 0; border-radius: 8px; font: 400 14px var(--nuo-font); color: #fff; cursor: pointer; }',
    '.side.atk { background: #E9C46A; }',
    '.side.def { background: #8FC31F; }',
    '.side img { width: 16px; height: 16px; filter: brightness(0) invert(1); }',
```

  - 같은 배열의 focus 규칙 `'.x:focus-visible, .btn:focus-visible { ... }'` 을 `'.x:focus-visible, .btn:focus-visible, .gear:focus-visible, .side:focus-visible { outline: 2px solid var(--nuo-primary-focus); outline-offset: 1px; }'` 로.
  - `.count` 규칙은 `<p>` → `<div>` 로 바뀌어도 클래스 선택자라 그대로.

- [x] **Step 7: 통과 확인**

Run: `node --check extension/sampleLibrary.js && node --check extension/styles/sampleCard.js && node <scratchpad>/check-party-lib.js "C:/Users/qkrgu/Documents/nuo-formatter"`
Expected: `party lib OK`. (`calcFill.js` 는 아직 `openListDialog` 를 부르지만 `typeof ... !== 'function'` 가드로 조용히 무시 — Task 7 에서 정리.)

- [x] **Step 8: 커밋**

```bash
git add extension/sampleLibrary.js extension/styles/sampleCard.js
git commit -m "feat(ext): box dialog with sample/party tabs, name and side dialogs"
```

---

### Task 4: `박스` 버튼 + 파티 탭 저장·불러오기 흐름 + 사이트 창 롤백

**Files:**
- Modify: `extension/prefsEntry.js` (머리 주석, `build`)
- Rewrite: `extension/sampleParty.js` (전체 교체)
- Modify: `extension/styles/sampleCard.js` (`nuoSampleTipCss`·`nuoSampleSaveCss` 삭제, 46행 주석)

**Interfaces:**
- Consumes: Task 1 `TBS.writePartyToBridge`; Task 2·3 `LIB.readAll/readParties/saveEntry/savePartyEntry/canAdd/findByName/normName/confirmDialog/nameDialog/openBox/LIMIT/PARTY_LIMIT`; 기존 `TBS.getSlotsFromBridge/readInputFromBridge/writeInputToBridge`.
- Produces: `globalThis.nuoPartyBox = { saveSlot(n: 1..6, fb), saveParty(fb) }` (fb = `{ busy(), idle(), done(text), fail(msg) }`, Task 5 가 호출), `globalThis.nuoBoxHandlers.team = function ()`; `prefsEntry` 가 `nuoBoxHandlers.team|calc` 호출.

- [x] **Step 1: `박스` 버튼** — `prefsEntry.js` 머리 주석 1~3행을:

```js
/**
 * 중앙 버튼 열 `박스` 버튼 (옛 `도우미`, PARTY_PRESET_PLAN §5.6) + 환경설정 모달(popup.html?embed=1 iframe).
 * 박스 클릭 = 라우트별 nuoBoxHandlers.team (sampleParty.js) / .calc (calcFill.js). 환경설정은 박스 헤더 톱니가 nuoPrefsModal.open().
 */
```

`CS.keepInjected({ key: 'prefs-entry', ... build: ... })` 의 `build` 를:

```js
    build: function (root) {
      root.innerHTML = '<style>:host{all:initial;display:block}\n' + css + '</style>' +
        '<button type="button" class="entry" aria-label="박스 — 저장한 샘플·파티">박스</button>';
      root.querySelector('.entry').addEventListener('click', function () {
        var h = globalThis.nuoBoxHandlers || {};
        var fn = CS.getRoute && CS.getRoute() === 'team' ? h.team : h.calc;
        if (typeof fn === 'function') fn();
      });
    }
```

- [x] **Step 2: `sampleParty.js` 전체 교체**:

```js
/**
 * 파티 탭 저장·불러오기 (PARTY_PRESET_PLAN §5.2·§5.3).
 * 저장 = teamBuilderFill 아이콘 줄 저장 버튼 → nuoPartyBox.saveSlot(n) / saveParty().
 * 불러오기 = 중앙 열 `박스` (prefsEntry) → nuoBoxHandlers.team → 박스 [샘플 | 파티].
 * 사이트 '샘플 불러오기' 창·샘플 이름 칸은 건드리지 않음 (사이트 원래 동작).
 */
(function (g) {
  'use strict';

  var CS = g.nuoCsCommon || {};
  var TBS = g.nuoTeamBuilderShared || {};
  var LIB = g.nuoSampleLibrary;
  if (!LIB || typeof TBS.getSlotsFromBridge !== 'function' || typeof CS.findTextLeaves !== 'function') return;

  var EMPTY_MSG = '포켓몬을 먼저 선택해 주세요';
  var STOP = {}; // 사용자가 멈춘 흐름(취소·빈 슬롯) — catch 에서 조용히 끝냄
  var SAMPLE_O = { limit: LIB.LIMIT, limitCode: 'sample_limit', subj: '샘플이', what: '샘플' };
  var PARTY_O = { limit: LIB.PARTY_LIMIT, limitCode: 'party_limit', subj: '파티가', what: '파티' };

  function mapErr(code) {
    return typeof g.mapCalcFillError === 'function' ? g.mapCalcFillError(code) : String(code || '');
  }

  function stop() { throw STOP; }

  function hasMon(slot) {
    return !!(slot && slot.pokemon && slot.pokemon.name);
  }

  /** 슬롯 #n 좌측 카드의 공식 일러스트 URL (§4.1 arts). 헤더 `#n` leaf → 헤더 줄 → 다음 형제 = 카드. */
  function findArt(n) {
    var leaves = CS.findTextLeaves(new RegExp('^#' + n + '$'));
    var i;
    for (i = 0; i < leaves.length; i++) {
      var row = leaves[i].parentElement && leaves[i].parentElement.parentElement;
      var card = row && row.nextElementSibling;
      var img = card && card.querySelector('img[src*="official-artwork"]');
      if (img) return img.src;
    }
    return '';
  }

  /** bridge 보강 슬롯 6칸 (GET_SLOTS). 실패 코드는 매퍼에 있는 것으로 통일. */
  function readSlots() {
    return TBS.getSlotsFromBridge().then(function (r) {
      if (!r || !r.ok || !Array.isArray(r.slots) || r.slots.length !== 6) throw new Error('bridge_state_missing');
      return r.slots;
    });
  }

  /** 상한·같은 이름 확인. @returns {Promise<boolean>} */
  function okToSave(items, name, o) {
    if (!LIB.canAdd(items, name, o.limit)) {
      window.alert(mapErr(o.limitCode));
      return Promise.resolve(false);
    }
    if (!LIB.findByName(items, name)) return Promise.resolve(true);
    return LIB.confirmDialog('\'' + name + '\' ' + o.subj + ' 이미 있어요. 덮어쓸까요?', '덮어쓰기', '기존 ' + o.what + ' 내용은 복구할 수 없습니다.');
  }

  function endFlow(fb) {
    return function (err) {
      fb.idle();
      if (err !== STOP) window.alert(mapErr(err && err.message));
    };
  }

  /** 슬롯 #n → 샘플 저장. 이름 없으면 이름 창 → 저장본 sample_name 에도 (사이트 슬롯 이름은 그대로). */
  function saveSlot(n, fb) {
    var slot;
    fb.busy();
    readSlots().then(function (slots) {
      slot = slots[n - 1];
      if (!hasMon(slot)) { fb.idle(); window.alert(EMPTY_MSG); stop(); }
      return LIB.normName(slot.sample_name) || LIB.nameDialog('샘플 저장', '샘플 이름');
    }).then(function (name) {
      if (!name) stop();
      slot.sample_name = name;
      return LIB.readAll().then(function (items) { return okToSave(items, name, SAMPLE_O); });
    }).then(function (go) {
      if (!go) stop();
      return LIB.saveEntry(slot, findArt(n) || String(slot.pokemon.sprite || ''));
    }).then(function () {
      fb.done('샘플 저장 완료');
    }).catch(endFlow(fb));
  }

  /** 파티 6칸 저장 — 이름 창 필수 (사이트에 파티 이름 칸 없음). */
  function saveParty(fb) {
    var slots, arts;
    fb.busy();
    readSlots().then(function (all) {
      slots = all.map(function (s) { return hasMon(s) ? s : null; });
      if (!slots.some(Boolean)) { fb.idle(); window.alert(EMPTY_MSG); stop(); }
      arts = slots.map(function (s, i) { return s ? (findArt(i + 1) || String(s.pokemon.sprite || '')) : ''; });
      return LIB.nameDialog('파티 저장', '파티 이름');
    }).then(function (name) {
      if (!name) stop();
      return LIB.readParties().then(function (items) {
        return okToSave(items, name, PARTY_O).then(function (go) {
          if (!go) stop();
          return LIB.savePartyEntry(name, slots, arts);
        });
      });
    }).then(function () {
      fb.done('파티 저장 완료');
    }).catch(endFlow(fb));
  }

  function alertErr(err) {
    window.alert(mapErr(err && err.message));
  }

  function checkWrite(r) {
    if (!r || !r.ok) throw new Error((r && r.error) || 'bridge_timeout');
  }

  /** 박스 [샘플 | 파티] — 카드마다 확인창 후 쓰기, 성공 시 박스 닫힘. 취소 = 박스로 돌아감. */
  function openTeamBox() {
    LIB.openBox({
      kinds: ['sample', 'party'],
      onPick: function (item, kind, box) {
        if (kind === 'party') {
          LIB.confirmDialog('\'' + item.name + '\' 파티를 불러올까요?', '불러오기', '저장되지 않은 파티 내용은 사라집니다.').then(function (yes) {
            if (!yes) return null;
            return TBS.writePartyToBridge(item.slots).then(function (r) { checkWrite(r); box.close(); });
          }).catch(alertErr);
          return;
        }
        TBS.readInputFromBridge().then(function (r) {
          checkWrite(r);
          return LIB.confirmDialog('\'' + item.name + '\' 샘플을 #' + r.active + ' 슬롯에 불러올까요?', '불러오기', '저장되지 않은 샘플 내용은 사라집니다.');
        }).then(function (yes) {
          if (!yes) return null;
          return TBS.writeInputToBridge(item.slot).then(function (r) { checkWrite(r); box.close(); });
        }).catch(alertErr);
      }
    });
  }

  g.nuoPartyBox = { saveSlot: saveSlot, saveParty: saveParty };
  g.nuoBoxHandlers = g.nuoBoxHandlers || {};
  g.nuoBoxHandlers.team = openTeamBox;
})(typeof globalThis !== 'undefined' ? globalThis : self);
```

- [x] **Step 3: 고아 CSS 정리** — `styles/sampleCard.js` 에서 `g.nuoSampleTipCss = [...].join('\n');` 블록과 `// 파티 탭 샘플 이름 칸 저장 버튼 ...` 주석 + `g.nuoSampleSaveCss = [...].join('\n');` 블록 삭제. 46행 주석의 `모양은 nuoSampleTipCss 와 같음.` → `모양은 styles/teamCopyIcons.js .tip 과 같음.`. 파일 머리 주석의 `말풍선 = styles/teamCopyIcons.js .tip 과 같은 실측값 — 한쪽 바꾸면 다른 쪽도.` 는 유지.

Run: `node --check extension/prefsEntry.js && node --check extension/sampleParty.js && node --check extension/styles/sampleCard.js && echo OK`
Expected: `OK`

그리고 Grep 도구로 `nuoSampleTipCss|nuoSampleSaveCss|findSaveAnchor|buildDialogList|data-nuo-sample-wide` 를 `extension/` 에서 검색 → Expected: 0건.

- [x] **Step 4: 커밋**

```bash
git add extension/prefsEntry.js extension/sampleParty.js extension/styles/sampleCard.js
git commit -m "feat(ext): box button replaces helper; party-tab save/load flows; restore site sample dialog"
```

---

### Task 5: 파티 탭 아이콘 [복사][저장] — 항상 보임 + 빈 슬롯 alert + 파티 카드 복사

**Files:**
- Modify: `extension/teamBuilderFill.js` (`SUM_SVG` 근처 상수, `buildIcon` → `buildIcons`, `runCopyPartyShareUrl`/`runCopySlot` 빈 검사, `copySampleSlot` 뒤 `copyPartySlots`, `registerInjectors`, `filled`/`clearFilled`/`refreshSlots`)
- Modify: `extension/styles/teamCopyIcons.js`

**Interfaces:**
- Consumes (클릭 시점): `globalThis.nuoPartyBox.saveSlot(n, fb)` / `.saveParty(fb)` (Task 4).
- Produces: `globalThis.nuoTeamCopy = { copySampleSlot, copyPartySlots(slots: Array(6)) → Promise<void> }` (Task 3 목록 복사 버튼이 호출).

- [x] **Step 1: 상수** — `SUM_SVG` 줄 다음에:

```js
  // 샘플·파티 저장 = 북마크 (옛 샘플 이름 칸 저장 버튼과 같은 아이콘, PARTY_PRESET_PLAN §5.1).
  var SAVE_SVG = '<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Z"/></svg>';
  var EMPTY_MSG = '포켓몬을 먼저 선택해 주세요';
```

- [x] **Step 2: `buildIcon` → `buildIcons`** — JSDoc 포함 `buildIcon` 함수 전체를 교체:

```js
  /**
   * host 1개 = [복사][저장] 두 버튼 (순서 결정적 — PARTY_PRESET_PLAN §5.1). 버튼마다 피드백 핸들
   * fb = { busy(), idle(), done(text), fail(msg) }. 말풍선은 누른 버튼 위 가운데.
   * @param {string} kind 'slot' | 'party'
   * @param {{ copy: string, save: string }} labels aria-label
   * @param {{ copy: function(object), save: function(object) }} handlers
   * @returns {function} teardown (타이머 정리)
   */
  function buildIcons(root, kind, labels, handlers) {
    root.innerHTML = '<style>' + ICON_CSS + '</style>' +
      '<button type="button" class="ic ' + kind + '" data-a="copy">' + SUM_SVG + '</button>' +
      '<button type="button" class="ic ' + kind + '" data-a="save">' + SAVE_SVG + '</button>' +
      '<div class="tip" role="status" hidden></div>';
    var tip = root.querySelector('.tip');
    var timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    [].slice.call(root.querySelectorAll('.ic')).forEach(function (btn) {
      var a = btn.getAttribute('data-a');
      btn.setAttribute('aria-label', labels[a]);
      var fb = {
        busy: function () {
          clearTimers();
          tip.hidden = true;
          btn.classList.add('busy');
          btn.setAttribute('aria-busy', 'true');
        },
        idle: function () {
          btn.classList.remove('busy');
          btn.removeAttribute('aria-busy');
        },
        done: function (text) {
          fb.idle();
          tip.textContent = text || '샘플 복사 완료';
          tip.style.left = (btn.offsetLeft + btn.offsetWidth / 2) + 'px';
          tip.hidden = false;
          timers.push(setTimeout(function () { tip.hidden = true; }, 1500));
        },
        fail: function (msg) {
          fb.idle();
          window.alert(msg ? String(msg) : mapErr(''));
        }
      };
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (btn.classList.contains('busy')) return;
        handlers[a](fb);
      });
    });
    return clearTimers;
  }
```

- [x] **Step 3: 빈 검사 문구** — `runCopySlot` 의 `fb.fail('빈 슬롯입니다.');` → `fb.fail(EMPTY_MSG);`. `runCopyPartyShareUrl` 의 `var partySlots = ...;` 다음 줄에:

```js
      if (!partySlots || !Array.isArray(r.filled) || r.filled.indexOf(true) < 0) {
        fb.fail(EMPTY_MSG);
        return;
      }
```

- [x] **Step 4: 파티 카드 복사** — `copySampleSlot` 함수 뒤, `globalThis.nuoTeamCopy = ...` 줄을 교체:

```js
  /**
   * 저장한 파티 복사 (박스 파티 카드 복사 버튼) — runCopyPartyShareUrl 과 같은 변환·환경설정.
   * 빈 칸 null → {} (bridge GET_SLOTS 가 주는 빈 슬롯 모양과 같게). pathname '/party' 고정.
   * @param {Array} slots 저장된 6칸
   * @returns {Promise<void>} 실패 시 reject(Error(한국어 문구))
   */
  function copyPartySlots(slots) {
    return new Promise(function (resolve, reject) {
      readFormatOptions(function (fo) {
        chrome.runtime.sendMessage(
          {
            type: 'COPY_PARTY_SHARE_URL',
            origin: location.origin,
            pathname: '/party',
            partySlots: slots.map(function (s) { return s || {}; }),
            formatOptions: fo,
          },
          function (bg) {
            if (chrome.runtime.lastError || !bg) { reject(new Error('변환 실패')); return; }
            if (!bg.ok) { reject(new Error(bg.error || '변환 실패')); return; }
            var t = bg.text != null ? String(bg.text) : '';
            if (!t) { reject(new Error('출력이 비었습니다.')); return; }
            copyTextBestEffort(t);
            resolve();
          }
        );
      });
    });
  }
  globalThis.nuoTeamCopy = { copySampleSlot: copySampleSlot, copyPartySlots: copyPartySlots };
```

- [x] **Step 5: 등록 — 항상 보임** — `registerInjectors` 전체를:

```js
  function registerInjectors() {
    var i;
    for (i = 1; i <= 6; i++) {
      (function (idx1) {
        injectors.push(CS.keepInjected({
          key: 'tb-slot-copy-' + idx1,
          hostStyle: HOST_INLINE + 'margin-left:4px;',
          // 빈 슬롯에도 보임 — 누르면 alert (처음 쓰는 사람이 기능을 알아보게, PARTY_PRESET_PLAN §2)
          enabled: function () { return bridgeReady && isTeamBuilderRoute(); },
          find: function () { return findSlotIconRow(idx1); },
          build: function (root) {
            return buildIcons(root, 'slot', { copy: '요약 샘플 복사', save: '샘플 저장' }, {
              copy: function (fb) { runCopySlot(idx1, fb); },
              save: function (fb) { if (globalThis.nuoPartyBox) globalThis.nuoPartyBox.saveSlot(idx1, fb); }
            });
          }
        }));
      })(i);
    }
    injectors.push(CS.keepInjected({
      key: 'tb-party-copy',
      hostStyle: HOST_INLINE + 'margin-right:4px;',
      enabled: function () { return bridgeReady && isTeamBuilderRoute(); },
      find: findPartyIconGroup,
      build: function (root) {
        return buildIcons(root, 'party', { copy: '파티 샘플 복사', save: '파티 저장' }, {
          copy: function (fb) { runCopyPartyShareUrl(fb); },
          save: function (fb) { if (globalThis.nuoPartyBox) globalThis.nuoPartyBox.saveParty(fb); }
        });
      }
    }));
  }
```

- [x] **Step 6: `filled` 고아 정리** — `var filled = [false, ...];` 줄 삭제, `clearFilled` 함수 삭제, `refreshSlots` 를:

```js
  function refreshSlots() {
    if (!bridgeReady) return;
    if (!isTeamBuilderRoute()) {
      refreshInjectors();
      return;
    }
    getSlotsFromBridge().then(function (r) {
      // C-5a/b: 슬롯 hot snapshot + 영속 캐시 갱신. 계산기 페이지가 같은 탭 내에서
      // (또는 다음 부팅 후) 이 데이터를 읽어 "내 파티" 줄에 사용.
      if (isTeamBuilderRoute() && r && r.ok && r.slots && typeof TBS.setSlotSnapshot === 'function') {
        TBS.setSlotSnapshot({ slots: r.slots, slotArt: r.slotArt });
      }
      refreshInjectors();
    });
  }
```

그리고 파일 머리 주석 2~3행 `슬롯 요약 복사 / 파티 복사.` → `슬롯 요약 복사·샘플 저장 / 파티 복사·파티 저장 (저장 흐름은 sampleParty.js).`.

- [x] **Step 7: 아이콘 CSS** — `styles/teamCopyIcons.js` `.ic.busy` 줄 앞에:

```js
    '.ic + .ic { margin-left: 4px; }', // [복사][저장] 사이 = 사이트 아이콘 간격 (슬롯 ml-1 · 초록 그룹 mr-1)
```

Run: `node --check extension/teamBuilderFill.js && node --check extension/styles/teamCopyIcons.js && echo OK`
Expected: `OK`. 그리고 Grep `filled\b|clearFilled|buildIcon\(` 를 `extension/teamBuilderFill.js` 에서 → Expected: `r.filled` 참조(runCopySlot·runCopyPartyShareUrl)만 남음.

- [x] **Step 8: 커밋**

```bash
git add extension/teamBuilderFill.js extension/styles/teamCopyIcons.js
git commit -m "feat(ext): always-visible copy+save icons on party tab, party copy for saved parties"
```

---

### Task 6: Checkpoint B — 파티 탭 전체 검증 + BP-B

**Files:** 없음 (검증·문서 체크박스·인계)

- [x] **Step 1: 정적 검사** — Run:

`node --check extension/teamBuilderBridge.js && node --check extension/teamBuilderShared.js && node --check extension/calcFillShared.js && node --check extension/sampleLibrary.js && node --check extension/styles/sampleCard.js && node --check extension/styles/teamCopyIcons.js && node --check extension/teamBuilderFill.js && node --check extension/sampleParty.js && node --check extension/prefsEntry.js && node <scratchpad>/check-party-lib.js "C:/Users/qkrgu/Documents/nuo-formatter"`
Expected: `party lib OK`

- [x] **Step 2: 사용자에게 "확장 새로고침 + 스마트누오 파티 탭 새로고침" 요청.**

- [x] **Step 3: 파티 탭 확인 (Claude in Chrome 스크린샷 + alert 는 사용자 확인)**
  1. 중앙 열 `계산기 / 초기화 / 사용법 / 박스` — 박스가 사이트 버튼과 같은 모양, `도우미` 없음.
  2. 초록 그룹 `[복사][저장] + 사이트 4개`, 슬롯 #1~#6 `[복사][저장] + 사이트 4개` — 빈 슬롯에도 보임. 간격 4px.
  3. 빈 슬롯 복사·저장, 전부 빈 파티 복사·저장 → alert `포켓몬을 먼저 선택해 주세요` (사용자 확인).
  4. 슬롯 저장: 이름 있는 슬롯 → 말풍선 `샘플 저장 완료` (누른 아이콘 위). 이름 없는 슬롯 → 이름 창 → 한글 조합 중 Enter 로 저장 안 됨 (Review Focus 2) → 저장. 같은 이름 → 덮어쓰기 확인.
  5. 파티 저장: 이름 창 → `파티 저장 완료`. 같은 이름 → `'X' 파티가 이미 있어요. 덮어쓸까요?`. 이름에 `<b>"x'` → 목록에 글자 그대로 (Review Focus 3). 공백만 → 창 유지.
  6. 박스: 제목 포켓볼 + `박스`, 톱니·X, `샘플 | 파티` 탭, 뱃지 `N/100` ↔ `N/20`, 빈 문구, 파티 카드 3안(타입색·일러·물건 겹침·빈 칸 점선), hover 분홍 테두리. 톱니 → 박스 닫히고 환경설정.
  7. 샘플 카드 → `'X' 샘플을 #N 슬롯에 불러올까요?` → 취소 → 박스 그대로 → 다른 카드 → 새 이름으로 확인창 (Review Focus 4) → 불러오기 → 편집 슬롯 반영, 박스 닫힘.
  8. 파티 카드 → 확인 → 6슬롯·좌측 카드 반영, 새로고침해도 유지 (`smartnuo.party`).
  9. 카드 복사(샘플·파티) → 말풍선, 붙여넣기 내용이 파티 탭 복사와 같은 형식. 삭제 → 확인 → 목록에서 빠짐.
  10. 사이트 샘플 이름 칸 업로드 버튼 → 사이트 원래 창 (폭 320, 우리 목록 없음, 우리 저장 버튼 없음).
  11. 사이트 이미지 저장(초록 그룹·슬롯) → 저장된 이미지에 우리 아이콘 없음 (Review Focus 5). 찍히면 `teamBuilderFill` host 에 `capture-hide` 클래스(`host.className = 'capture-hide'` — `keepInjected` build 의 두 번째 인자 host 사용) 추가 후 재확인.
  12. 다른 탭에서 저장 → 열린 박스 목록 즉시 갱신.

- [x] **Step 4: 고친 게 있으면 커밋** (파일 지정 `git add`).

- [x] **Step 5: BP-B** — 본 문서 §12 Task 1~6 체크박스 갱신, 머리 상태 줄 `세션 2 완료 (BP-B)`, `handoff` 스킬로 인계 문서, 문서 커밋:

```bash
git add PARTY_PRESET_PLAN.md
git commit -m "docs: party preset plan — session 2 done (BP-B)"
```

**여기서 세션 종료 → 새 세션은 CLAUDE.md §1 루틴 후 Task 7 부터.**

---

## 세션 3 (BP-B → 병합 준비): 계산기·스피드 + 문서 + 마무리

### Task 7: 계산기·스피드 박스 + 공격/수비 창 + "내 파티" 줄 정리

**Files:**
- Modify: `extension/calcFill.js` (`UPLOAD_SVG`, `buildPartyRow` 마크업·불러오기 핸들러, 파일 안 박스 핸들러 추가)
- Modify: `extension/styles/calcPartyRow.js`

**Interfaces:**
- Consumes: `LIB.openBox`, `LIB.sideDialog` (Task 3), 기존 `orchestrateCalcFillFromSlot(slot, side)`.
- Produces: `globalThis.nuoBoxHandlers.calc = function ()` (prefsEntry 가 계산기·스피드 라우트에서 호출).

- [x] **Step 1: 줄 마크업** — `buildPartyRow` 의 `root.innerHTML = ...` 를:

```js
    root.innerHTML = '<style>' + ROW_CSS + '</style>' +
      '<div class="sec"><div class="fld"><p class="ttl">내 파티</p>' +
      '<div class="chips">' + chipsHtml + '<span class="empty" hidden></span></div></div></div>';
```

그리고 `// 저장한 샘플 불러오기 (SAMPLE_LIBRARY_PLAN §5.3·§5.4) ...` 주석부터 `root.querySelector('.load').addEventListener(...)` 블록 끝(`});`)까지 삭제. `var UPLOAD_SVG = ...;` 줄 삭제.

- [x] **Step 2: 박스 핸들러** — `rowSpec` 함수 앞에:

```js
  /* ===== 박스 (PARTY_PRESET_PLAN §5.4) — 중앙 열 `박스` 버튼(prefsEntry)이 계산기·스피드에서 호출 ===== */

  /** 사이트 칼/방패 아이콘 — 해시 파일명(/_nuxt/attacker.<해시>.png)이라 패널 헤더에 떠 있는 src 를 그대로 씀. */
  function siteSideIcon(side) {
    var img = document.querySelector('img[src*="/_nuxt/' + side + '."]');
    return img ? img.src : '';
  }

  function openCalcBox() {
    var LIB = globalThis.nuoSampleLibrary;
    if (!LIB || typeof LIB.openBox !== 'function') return;
    LIB.openBox({
      kinds: ['sample'],
      onPick: function (item, kind, box) {
        LIB.sideDialog('\'' + item.name + '\' 샘플을 어디에 입력할까요?', {
          attacker: siteSideIcon('attacker'),
          defender: siteSideIcon('defender')
        }).then(function (side) {
          if (!side) return; // 취소 = 박스로 돌아감
          box.close();
          orchestrateCalcFillFromSlot(item.slot, side).catch(function (err) {
            window.alert((err && err.message) || mapErr(''));
          });
        });
      }
    });
  }
  globalThis.nuoBoxHandlers = globalThis.nuoBoxHandlers || {};
  globalThis.nuoBoxHandlers.calc = openCalcBox;
```

- [x] **Step 3: 줄 CSS** — `styles/calcPartyRow.js` 에서:
  - 14~15행 주석(불러오기 버튼 중심·구분선) 삭제, 18행 주석 → `// 칸 안 간격 12 (테두리↔첫 칩, 마지막 칩↔테두리) — 칩 사이는 space-between (불러오기 버튼·구분선은 박스로 이관, PARTY_PRESET_PLAN §5.5).`
  - `.fld` 의 `padding: 0 0 0 12px;` → `padding: 0 12px;`
  - `.chips` 줄 → `'.chips { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; }',`
  - `.bar`, `// 불러오기 = ...` 주석, `.load`, `.load svg` 네 줄 삭제.
  - 머리 주석 4행 `필드형 재배치 (SAMPLE_LIBRARY_PLAN §5.3).` 뒤에 ` 불러오기 버튼 제거 = PARTY_PRESET_PLAN §5.5.` 추가.

Run: `node --check extension/calcFill.js && node --check extension/styles/calcPartyRow.js && echo OK`
Expected: `OK`. Grep `openListDialog|UPLOAD_SVG|\.load|\.bar` 를 `extension/` 에서 → Expected: 0건.

- [x] **Step 4: 사용자 확인** — 확장 새로고침 + 계산기·스피드 탭 새로고침 후:
  1. 계산기 중앙 열 `교체 / 초기화 / 계산 / 박스`, 스피드 탭 중앙 열에도 박스.
  2. 좌·우 "내 파티" 칸: 칩 6개가 칸 폭 전체, 오른쪽 버튼·구분선 없음.
  3. 박스 → 제목 `박스` + 톱니·X, 머리 `샘플` (탭 없음) + `N/100`.
  4. 카드 → `'X' 샘플을 어디에 입력할까요?` [공격측(칼)][수비측(방패)] / [취소] → 공격측 → 왼쪽 패널 입력, 수비측 → 오른쪽. 취소 → 박스 유지.
  5. 스피드 탭 패널 명칭이 공격/수비와 맞는지 (§10) — 다르면 사용자에게 문의.
  6. 톱니 → 환경설정 모달.

- [x] **Step 5: 커밋**

```bash
git add extension/calcFill.js extension/styles/calcPartyRow.js
git commit -m "feat(ext): calculator/speed box with attacker/defender picker; drop row load button"
```

---

### Task 8: 문서 (§8)

**Files:**
- Modify: `PRIVACY.md`, `CHANGELOG.md`, `README.md`, `TEMPLATES.md`, `CLAUDE.md`, `SAMPLE_LIBRARY_PLAN.md`

- [x] **Step 1: 각 문서 해당 구간 Read** (README·PRIVACY·CHANGELOG 는 100줄 이하 → Read, TEMPLATES 는 §5 머리·§9·§12 구간만).

- [x] **Step 2: PRIVACY.md** — 샘플 로컬 저장 문장이 있는 곳에 "저장한 파티(6마리 슬롯 데이터)도 같은 방식으로 이 브라우저(`chrome.storage.local`)에만 보관하며 외부로 보내지 않습니다." 한 줄.

- [x] **Step 3: CHANGELOG.md** — 작업 트리의 사용자 미커밋 수정을 그대로 둔 채 `[2.0.0]` 목록에 추가:
  - `파티 저장·불러오기 — 파티 리스트 아이콘 줄의 저장 버튼으로 파티를 이름 붙여 보관(최대 20개), 가운데 [박스] 버튼에서 불러오기.`
  - `[도우미] 버튼이 [박스]로 바뀜 — 저장한 샘플·파티를 한곳에서 불러오고, 환경설정은 박스 오른쪽 위 톱니.`
  - `샘플 저장은 슬롯마다 있는 저장 아이콘으로, 계산기에서는 [박스]에서 샘플을 골라 공격측/수비측 선택.`

- [x] **Step 4: README.md** — 기능 소개·FAQ 의 `도우미` 버튼 언급을 `박스`(환경설정 = 박스 톱니 또는 툴바 아이콘)로, 샘플 저장 위치(슬롯 저장 아이콘)·파티 저장·불러오기 한 단락.

- [x] **Step 5: TEMPLATES.md** — §5 파일 목록 설명: `prefsEntry.js(중앙 버튼 열 `박스` + 환경설정 모달)`, `sampleLibrary.js(샘플·파티 저장소·카드 렌더·박스/이름/확인/공격수비 다이얼로그)`, `sampleParty.js(파티 탭 저장·불러오기 흐름)`. §12 맨 위에 v13:

```
- **2026-09-26 v13** — 파티 저장·불러오기 + 박스 (PARTY_PRESET_PLAN). (1) **사이트 파티 6칸 쓰기** = `state['$sparty.slots'] = 새 배열` 재대입 (사이트 store set_slot 과 같은 경로 → persist watcher 가 localStorage 저장) + 활성 슬롯은 `$sparty.input` 동기화. 제자리 `slots[i]` 변경은 watcher 안 깨움. (2) 사이트 아이콘 줄에 우리 버튼 여러 개 = **host 1개에 버튼 여러 개** (별도 host 를 같은 앵커 "첫 자식 앞"에 넣으면 삽입 시점에 따라 순서가 바뀜). (3) 라우트별 동작이 다른 공용 버튼 = `globalThis.nuoBoxHandlers.{team,calc}` 등록 + 버튼 소유 모듈이 클릭 시점에 조회 (manifest 순서 무관). (작성: Claude)
```

- [x] **Step 6: CLAUDE.md** — §3 파티 프리셋 줄을 "완료 — PARTY_PRESET_PLAN" 으로, §1 의 플랜 등록은 병합 후 §2 로 내림 (병합 전이면 §1 유지). **SAMPLE_LIBRARY_PLAN.md** §13 끝에 `- 진입점 재배치(저장 = 아이콘 줄, 불러오기 = 박스, 사이트 창 롤백) = PARTY_PRESET_PLAN.` 한 줄.

- [x] **Step 7: 커밋**

```bash
git add PRIVACY.md CHANGELOG.md README.md TEMPLATES.md CLAUDE.md SAMPLE_LIBRARY_PLAN.md
git commit -m "docs: party preset and box button in readme, privacy, changelog, templates"
```

(CHANGELOG 의 사용자 미커밋 수정도 이 커밋에 함께 들어감 — 커밋 전 사용자에게 한 줄로 알리고 동의 받기.)

---

### Task 9: 리뷰·체크리스트·마무리

- [x] **Step 1: `security-review` 스킬** — 초점: `NUO_TEAM_WRITE_PARTY` 출처 가드·입력 검증, 저장 데이터 → innerHTML 경로(`esc`/`safeUrl`), 새 외부 호출 없음.
- [x] **Step 2: TEMPLATES §9 체크리스트** — manifest 순서(새 파일 없음 → 변화 없음 확인), bridge 가드 V10, 새 메시지 3곳(bridge·RPC·매퍼), 새 storage 키 onChanged 반영, lastError 폴백, CHANGELOG·TEMPLATES 갱신.
- [x] **Step 3: 최종 리뷰** — `superpowers:requesting-code-review` (main...HEAD 전체), 지적 반영 커밋.
- [x] **Step 4: 본 문서 머리 상태 줄·§12 체크박스 갱신 + 커밋, `superpowers:finishing-a-development-branch` 로 병합 방식 결정 (사용자).

### 세션 3 결과 (2026-09-26)

- Task 7 `43d27cf` (Claude in Chrome 실측: 계산기·스피드 박스, 공격/수비 입력, 취소, 톱니), Task 8 `ef9deab`. security-review 0건. 최종 리뷰(Opus) = Critical 0, Important 1 → CHANGELOG 줄 삭제는 사용자 수정·동의로 유지.
- **보류 Minor** (사용자 판단):
  1. `teamBuilderFill` `runCopyPartyShareUrl` — 브리지 읽기 실패에도 "포켓몬을 먼저 선택해 주세요" (슬롯 복사는 "슬롯을 읽지 못했습니다.").
  2. `sampleLibrary` `mountList` 탭 전환 — 저장소 읽는 몇 ms 사이 옛 카드 클릭 시 새 종류 검사 → 잘못된 "불러올 수 없습니다" alert (전환 시 `items = []; draw()` 먼저).
  3. `openBox` 가 포커스를 옮기지 않음 — `박스` 버튼에 포커스 남아 Enter/Space 로 박스가 겹쳐 열림.
  4. 이름 있는 슬롯 두 개를 몇 ms 안에 저장 → read-modify-write 경합으로 하나 유실 (기존 샘플 패턴).
  5. `removePartyEntry` export 호출자 0.
