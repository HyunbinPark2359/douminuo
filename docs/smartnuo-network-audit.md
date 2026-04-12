# 스마트누오 Network 점검 체크리스트

확장이 쓰는 공유 API(`GET/POST /api/party/share`)만으로는 **특성·도구 반영 위력·결정력·내구력** 필드가 내려오지 않는 것으로 보입니다. 사이트 **다른 화면**에서 데미지/방어 계산을 서버나 별도 API로 처리하는지 확인할 때 아래 순서를 씁니다.

## 준비

1. Chrome에서 [smartnuo.com](https://smartnuo.com) 열기  
2. **F12** → **Network** 탭  
3. **Preserve log** 켜기  
4. 필터에서 **Fetch/XHR**만 보기 (필요 시 **All**)

## 해 볼 동작 (사이트 UI에 맞게 조정)

- [ ] 파티/샘플을 연 뒤 **데미지·대미지·계산·시뮬** 등으로 보이는 버튼·탭을 눌러 본다.  
- [ ] 기술을 고르거나 상대 종을 지정하는 등 **계산이 일어날 만한 조작**을 한다.  
- [ ] (있다면) **결정력 / 내구 / 방어** 숫자가 갱신되는 순간을 기준으로 요청을 본다.

## 기록할 것

각 의심 요청마다:

| 항목 | 메모 |
|------|------|
| Request URL | 전체 경로 (`/api/...`) |
| Method | GET / POST |
| Status | 200 여부 |
| Request payload | JSON 필드 요약 |
| Response preview | 결정력·배율·% 등 유무 |

## 이미 알고 있는 API (확장 사용)

- `GET /api/party/share/:id` — 공유 본문(JSON). 기술에 `power`, `type`, `damage_class` 등은 있으나, **특성·도구 보정이 반영된 최종 위력/데미지 롤**은 응답 예시 기준으로는 없음.  
- `POST /api/party/share` — 슬롯별 재공유 URL 발급용.

## 결과 해석

- **별도 `/api/...`가 보이면**: 응답 스키마를 캡처해 두고, 확장에서 호출 가능한지(쿠키·CORS·파라미터) 검토.  
- **XHR이 거의 없고 클라이언트만 계산하면**: 브라우저에 번들된 JS를 역추적하거나, **외부 데미지 라이브러리**([damage-calc-integration.md](./damage-calc-integration.md)) 쪽이 현실적.
