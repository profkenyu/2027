# FIELD ARCHIVE 반환 및 전체 검증 — 2026-09-08

## 수정

- `Return to Mission`: 이전 방문 기록이 있으면 `history.back()`으로 복귀한다. referrer가 비어 있다는 이유로 임무 시작 페이지를 여는 조건을 제거했다.
- 직접 진입하여 이전 기록이 없으면 해당 배포 경로의 임무 HTML을 연다. `dist/FIELD_ARCHIVE.html`은 `TERRA_INCOGNITA.html`을 사용한다.
- 설계도 검사의 즉시 `suspend()`가 지연된 모델 캡처를 취소하던 문제를 수정했다. 실제 두 프레임의 캡처 완료를 확인한 뒤 검사한다. 작품의 초기 노이즈 표시 순서는 유지한다.
- `npm run archive:return`을 추가하고 전체 `release` 검사에 포함했다.

## 검증 결과

아래 항목 모두 통과했다. 최초 release 실행은 설계도 검사에서 중단되었으며, 검사 수정 후 해당 단계부터 나머지 항목을 순서대로 재실행했다.

| 검사 | 결과 |
| --- | --- |
| build / verify | 통과 |
| terrain / memory / observation | 통과 |
| harness | 통과 |
| model — HIGH / MID / LOW | 통과 |
| docking — 경사·방향 36조건, 격납 고정 및 잘못된 완료 방지 | 통과 |
| archive:return — HTTP 3경로 × 2화면, referrer 없는 복귀·새로고침·직접 진입 | 통과 |
| archive:return — 로컬 HTML 3경로 복귀 | 통과 |
| blueprints — 데스크톱 및 태블릿 화면·동작 감소 설정 4조건 | 통과 |
| smoke:entry — 직접·외부 링크 첫 진입 및 재진입 | 통과 |
| smoke — 실제 Chrome WebGPU | 통과 |
| smoke:sequence — BODY 01 → BODY 02 → BODY 03 | 통과 |
| smoke:completion — 데스크톱·세로·가로 | 통과 |
| smoke:mobile — 844×390 | 통과 |
| smoke:mobile:portrait — 390×844 | 통과 |
| smoke:mobile:narrow — 320×568 | 통과 |

모바일 검사는 Chrome 화면·터치 에뮬레이션이다. 실제 iPhone/iPad Safari 및 장시간 발열은 이번 검사 범위에 포함하지 않았다.

## 배포 파일

`field-archive.html`, `works/terra_incognita/field-archive.html`, `dist/FIELD_ARCHIVE.html`의 SHA-256은 모두 다음과 같다.

`ae8285bee72bf0c9284ecc5e7daa062da7173c3229d797787ba85ec7a9de9b50`

재검증 명령: `npm run release`
