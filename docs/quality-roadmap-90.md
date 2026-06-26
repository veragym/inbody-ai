# INBODY AI 90점대 진입 설계안

작성일: 2026-06-26
현재 기준 점수: 82/100
목표 점수: 91~93/100

이 문서는 현재 배포본을 바로 바꾸는 작업안이 아니라, 검수 후 구현/배포할 수 있는 개선 설계안이다.

## 1. 현재 상태 평가

현재 시스템은 운영 가능한 베타 후반 단계다.

- AI 실패 시 룰 기반 리포트가 생성된다.
- 통증 고민과 체형 고민이 DB, 화면, 분석 엔진에서 분리됐다.
- 이력 추가 흐름은 `이력 -> 사전입력 -> 인바디 촬영`으로 정리됐다.
- 기존 룰 엔진 테스트는 통과한다.
- GitHub Pages 배포 파일과 Supabase Edge Function 배포 흐름은 정상이다.

현재 82점에서 90점대로 올라가지 못하는 가장 큰 이유는 기능 부족보다 검증 밀도 부족이다.

- OCR 오인식 방어가 약하다.
- 리포트 문구가 반복될 가능성이 있다.
- 실제 회원 케이스 기반 회귀 테스트가 부족하다.
- 서버와 브라우저의 룰/범위/금지어가 분산돼 장기 유지보수 리스크가 있다.
- Edge Function 단위 테스트가 룰 엔진 중심에 머물러 있다.

## 2. 90점대 점수 기준

90점대 진입은 아래 기준을 만족해야 한다.

| 영역 | 현재 | 목표 |
|---|---:|---:|
| DB/데이터 구조 | 17/20 | 18/20 |
| 룰 기반 분석 엔진 | 18/20 | 19/20 |
| AI 안정성 | 14/15 | 15/15 |
| 프론트 리포트 품질 | 13/20 | 17/20 |
| UX/입력 흐름 | 8/10 | 9/10 |
| 보안/렌더링 안전성 | 8/10 | 9/10 |
| 테스트/검증 | 4/5 | 5/5 |

목표 총점: 91~93점

## 3. 최우선 개선 5개

### A. OCR 수치 무결성 검증

목표: OCR이 엉뚱한 숫자를 읽어도 그대로 저장되지 않게 한다.

현재 위험:

- OCR 결과가 숫자면 거의 그대로 확인 화면에 들어간다.
- 체지방률 302, BMI 271, 골격근량 2.78 같은 자리수 오류를 자동으로 잡지 못한다.
- InBody 점수, 체중, BMI, 체지방률 사이의 상호 검증이 없다.

설계:

1. `supabase/functions/_shared/ocr_quality.mjs` 추가
2. OCR 결과를 아래 기준으로 검사
   - 물리적 범위 검사
   - InBody 270 일반 범위 검사
   - BMI와 체중/신장 부재 상황의 약식 일관성 검사
   - 체지방량과 체지방률/체중 간 일관성 검사
   - 체중조절/지방조절/근육조절 부호 검사
3. 검사 결과를 `raw.low_confidence_fields`에 추가
4. 프론트 확인 화면에서 위험 필드를 강조

필드별 1차 검증 범위:

| 필드 | 허용 범위 | 강한 경고 |
|---|---:|---:|
| weight | 25~220kg | 35 미만, 160 초과 |
| skeletal_muscle | 8~70kg | 15 미만, 50 초과 |
| body_fat_mass | 2~90kg | 체중보다 큼 |
| body_fat_pct | 3~60% | 5 미만, 50 초과 |
| bmi | 12~50 | 15 미만, 40 초과 |
| inbody_score | 40~120 | 50 미만, 105 초과 |
| visceral_fat_level | 1~30 | 20 초과 |

체지방량 일관성:

```text
expected_body_fat_mass = weight * body_fat_pct / 100
abs(expected_body_fat_mass - body_fat_mass) > max(2.5kg, weight * 0.04) 이면 경고
```

수정 대상:

- `supabase/functions/inbody-ocr-analyze/index.ts`
- `js/screens/ocr-confirm.js`
- 신규 `supabase/functions/_shared/ocr_quality.mjs`
- 신규 `scripts/ocr-quality.test.mjs`

완료 기준:

- 비정상 수치가 `low_confidence_fields`에 들어간다.
- 확인 화면에서 해당 입력칸에 경고 표시가 뜬다.
- 트레이너가 확인하지 않고 넘기기 어려운 UI가 된다.

예상 점수 상승: +3~4점

### B. 샘플 회원 회귀 테스트 세트

목표: 실제 운영에서 자주 나오는 회원 유형별 리포트 품질을 자동 검증한다.

현재 위험:

- 룰 엔진 테스트는 4개뿐이다.
- 실제 케이스별 문구/우선순위/통증-체형 분리/이전 기록 비교가 깨져도 놓칠 수 있다.

설계:

1. `fixtures/report-cases/*.json` 추가
2. 최소 12개 케이스 구성
3. `scripts/report-cases.test.mjs`에서 전체 케이스 실행

필수 케이스:

| 케이스 | 검증 목적 |
|---|---|
| 초방문 여성, 표준 체지방 | 과잉 경고 금지 |
| 초방문 남성, 근육 낮음 | 근육 보강 우선순위 |
| 재방문, 체지방 감소 | 비교 문구 정상 |
| 재방문, 근육 감소 | 부정 변화 문구 정상 |
| 체형 고민만 있음 | 통증 문구 미노출 |
| 통증 고민만 있음 | 체형 문구 미노출 |
| 팔뚝 선택 | 통증으로 해석 금지 |
| OCR 일부 누락 | confidence medium/low |
| 내장지방 높음 | 우선순위 반영 |
| 부위별 근육 불균형 | segmental_analysis 반영 |
| 식단 단백질 부족 | nutrition_strategy 반영 |
| 최소 입력값 | undefined/null 미노출 |

검증 규칙:

- `summary`, `priority_goals`, `exercise_strategy`, `nutrition_strategy` 필수
- `undefined`, `null`, `NaN` 문자열 금지
- 금지어 필터 적용
- 체형 고민이 통증 전략으로 들어가지 않음
- `analysis_confidence`가 입력 품질에 맞게 내려감

수정 대상:

- `fixtures/report-cases/*.json`
- `scripts/report-cases.test.mjs`
- 필요 시 `analysis_engine.mjs`

완료 기준:

- 12개 이상 케이스 테스트 통과
- 버그 수정 시 회귀 방지 가능

예상 점수 상승: +2~3점

### C. 리포트 문구 다양화 엔진

목표: 회원이 보는 첫 문장과 전략 문구가 고정 템플릿처럼 보이지 않게 한다.

현재 위험:

- 현재는 조건 분기형 문구다.
- 같은 유형 회원이 반복되면 같은 제목/보조문구가 반복될 수 있다.

설계:

1. 문구를 완전 랜덤으로 만들지 않는다.
2. 회원/기록 ID 기반 deterministic variant를 사용한다.
3. 같은 기록은 항상 같은 문구가 나오고, 다른 회원/다른 회차는 변형된다.

예시:

```js
function variant(seed, candidates) {
  const n = stableHash(seed) % candidates.length;
  return candidates[n];
}
```

변형 대상:

- 리포트 hero headline
- hero subtitle
- priority goal action 일부
- expected change title/current/improved 표현

금지:

- 의미가 바뀌는 랜덤화
- 과장 표현
- 의료/진단 뉘앙스

수정 대상:

- `js/components/report.js`
- `supabase/functions/_shared/analysis_engine.mjs`
- 신규 `supabase/functions/_shared/text_variants.mjs`
- 신규 `scripts/text-variants.test.mjs`

완료 기준:

- 동일 입력은 동일 출력
- 다른 회원/다른 회차는 2~4개 문구 변형 가능
- 금지어 필터 이후에도 문장 자연스러움 유지

예상 점수 상승: +2~3점

### D. 서버/브라우저 룰 단일 출처 정리

목표: 표준 범위, 체형 고민 분류, 회원용 금지어 규칙이 서로 어긋나지 않게 한다.

현재 위험:

- `analysis_rules.mjs`와 `js/analysis-rules.js`가 별도 파일이다.
- GitHub Pages 제약 때문에 `_shared`를 직접 로드하지 못해 복제가 생겼다.
- 나중에 한쪽만 고치면 그래프와 서버 판정이 달라진다.

현실적인 설계:

1. 소스 오브 트루스는 `supabase/functions/_shared/analysis_rules.mjs`
2. `scripts/build-browser-rules.mjs` 추가
3. 빌드 스크립트가 서버 룰에서 브라우저용 `js/analysis-rules.js`를 생성
4. 테스트에서 두 파일의 핵심 값이 같은지 검사

수정 대상:

- 신규 `scripts/build-browser-rules.mjs`
- `js/analysis-rules.js`는 생성물로 취급
- 신규 `scripts/rules-sync.test.mjs`

완료 기준:

- 표준 범위 수정 시 한 파일만 고치면 됨
- 테스트가 서버/브라우저 룰 불일치를 잡음

예상 점수 상승: +1~2점

### E. 이력/사전정보 UX 마감

목표: 새로 정리한 이력 흐름을 운영자가 헷갈리지 않게 한다.

현재 위험:

- `+이력추가`가 최근 사전정보를 불러오지만, 어떤 값이 이전 값인지 명시가 약하다.
- 사전정보 화면은 읽기 전용이지만, 일부 트레이너는 수정 버튼을 기대할 수 있다.

설계:

1. 사전입력 화면 상단 문구 정리
   - 최근 사전정보를 기본값으로 불러왔습니다.
   - 오늘 상태가 다르면 수정 후 진행하세요.
2. 사전정보 화면에는 읽기 전용 배지 추가
3. 사전정보 화면 하단에 `이 정보로 새 이력 추가` 버튼 추가 여부는 선택
   - 권장: 2차 개선으로 분리
   - 이유: 버튼이 많아지면 `+이력추가`와 역할이 겹친다.

수정 대상:

- `js/screens/pre-input.js`
- `js/screens/history-preinfo.js`
- `css/app.css`

완료 기준:

- 기존 이력 확인과 새 이력 추가 흐름이 분명히 구분된다.
- 기존 기록의 사전정보가 수정되는 것으로 오해하지 않는다.

예상 점수 상승: +1점

## 4. 구현 순서

권장 구현 순서:

1. OCR 수치 무결성 검증
2. 샘플 회원 회귀 테스트
3. 리포트 문구 다양화
4. 룰 단일 출처 빌드 스크립트
5. 이력/사전정보 UX 마감

이 순서가 좋은 이유:

- OCR 방어는 잘못된 분석의 출발점을 막는다.
- 회귀 테스트를 먼저 깔아야 문구/룰 수정이 안전하다.
- 문구 다양화는 테스트 기반 위에서 해야 품질이 흔들리지 않는다.
- 룰 단일 출처는 운영 리스크를 줄이는 유지보수 개선이다.

## 5. 배포 전 검수 체크리스트

구현 후 배포 전 아래를 통과해야 한다.

```powershell
node --test scripts\analysis-engine.test.mjs
node --test scripts\ocr-quality.test.mjs
node --test scripts\report-cases.test.mjs
node --test scripts\rules-sync.test.mjs
node --check js\screens\ocr-confirm.js
node --check js\components\report.js
node --check js\screens\pre-input.js
node --check js\screens\history.js
node --check js\screens\history-preinfo.js
```

Supabase 배포 대상:

```powershell
npx supabase functions deploy inbody-ocr-analyze inbody-generate-scripts --project-ref lrzffwawpoidimlrbfxe --import-map supabase/functions/import_map.json --use-api -j 1
```

GitHub Pages 확인:

```powershell
Invoke-WebRequest "https://veragym.github.io/inbody-ai/index.html?v=<commit>"
Invoke-WebRequest "https://veragym.github.io/inbody-ai/js/analysis-rules.js?v=<commit>"
Invoke-WebRequest "https://veragym.github.io/inbody-ai/js/components/report.js?v=<commit>"
```

## 6. 90점대 완료 판정

아래가 모두 만족되면 91~93점으로 평가 가능하다.

- OCR 이상치가 자동으로 표시된다.
- 회원 케이스 12개 이상 회귀 테스트가 있다.
- 통증/체형 혼선이 테스트로 방지된다.
- 리포트 첫 문장이 회원/회차별로 자연스럽게 달라진다.
- 서버/브라우저 표준 범위 불일치를 테스트가 잡는다.
- 기존 이력의 사전정보와 새 이력의 사전입력 흐름이 분명하다.
- 배포 전 테스트 명령이 고정돼 있다.

## 7. 구현 예상 소요

| 작업 | 예상 시간 |
|---|---:|
| OCR 품질 모듈 + 테스트 | 1.5~2.5시간 |
| 샘플 케이스 테스트 | 1~2시간 |
| 문구 다양화 | 1~1.5시간 |
| 룰 동기화 스크립트 | 1~1.5시간 |
| UX 마감 | 0.5~1시간 |

총 예상: 5~8시간

가장 먼저 구현할 묶음은 A+B다. 이 두 개만 들어가도 평가점수는 약 87~89점까지 올라가고, C까지 들어가면 90점대 진입이 가능하다.
