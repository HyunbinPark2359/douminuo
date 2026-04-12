# 결정력·내구력: 외부 계산 엔진 통합 설계 (초안)

스마트누오 공유 API만으로는 특성·도구 배율이 정리된 형태로 내려오지 않으므로, **규칙이 코드에 들어 있는 데미지 엔진**을 쓰는 편이 일반적입니다.

## 후보: `@smogon/calc` / `smogon/damage-calc`

- 저장소: [smogon/damage-calc](https://github.com/smogon/damage-calc)  
- NPM: `@smogon/calc` — 세대·공격자·수비자·기술·날씨·필드·테라 등을 넣어 **데미지 롤·기대값**을 계산.

## Chrome MV3(service worker)에 넣을 때

- `background.js`는 **ESM import 없이** 단일 번들로 묶이는 경우가 많음.  
- 선택지:
  1. **빌드 단계 추가**: esbuild/rollup으로 `calc-worker.js` 번들 생성 후 `importScripts('calc-bundle.js')` 또는 단일 `background` 번들.  
  2. **Offscreen document** (Chrome API): 무거운 계산을 오프스크린 페이지에서 실행하고 `postMessage`로 결과만 SW에 전달.  
  3. **팝업에서만 계산**: SW는 raw만 넘기고, 팝업이 `formatter`와 함께 번들 로드 — 팝업 닫히면 중단될 수 있어 UX 제약.

번들 **크기**와 **업데이트(세대 패치)** 를 감안해 1 또는 2를 권장.

## 스마트누오 JSON → calc 입력 매핑

공유 응답에서 이미 쓰는 필드 예시:

- `pokemon.name` — 영문 슬러그(`mimikyu-disguised` 등) → 종 식별에 유리.  
- `pokemon.moves[].name` — 영문 기술 id에 가까운 값.  
- `movesKr[]` — 표시용 한글; calc에는 **영문 move id** 매핑 테이블이 있으면 안전.  
- `pokemon.stats.*.real` / `value` — 실능치·노력.  
- `personality`, `equipment`, `ability`, `terastal`, `level` — calc의 nature/item/ability/tera/type.

해야 할 일:

1. **세대 고정**: 스마트누오가 몇 세대 규칙인지 확정(예: 9). `Generations.get(9)` 등.  
2. **Nature**: 한글 성격명 → Showdown nature id (소량 맵 또는 사이트가 영문을 추가로 주는지 확인).  
3. **Item / Ability**: 한글 → 영문 Dex id (테이블 또는 PokeAPI 보조).  
4. **내구력 표시**: “상대”가 없으면 **기준 방어/특방**(예: 0노력 31개체 특정 종, 또는 252+방 진자)을 **옵션으로 고정**해 %만 출력하는 식으로 단순화 가능.

## 단일 REST “배율 표” API

공식적으로 “모든 특성·도구 배율 JSON”만 주는 API는 거의 없음. **PokeAPI**는 설명 텍스트 중심이라 배틀 배율을 숫자로 쓰기엔 부족한 경우가 많음.

## 다음 구현 순서 (제안)

1. [smartnuo-network-audit.md](./smartnuo-network-audit.md)로 사이트 전용 계산 API 유무 확인.  
2. 없으면 `@smogon/calc` 프로토타입을 **Node 스크립트**에서만 돌려, 스마트누오 샘플 JSON 한 건을 수동 매핑해 결과 검증.  
3. 통과하면 MV3 번들/오프스크린 설계 확정 후 확장에 편입.
