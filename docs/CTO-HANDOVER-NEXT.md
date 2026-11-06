# CTO HANDOVER — 다음 세션 즉시 실행

## 1. 현재 상태
```
HEAD  288c12e3  (feat(080): candidate_reviews.source 에 국내 생산자 둘을 더했다)
git   clean · origin/main 0/0
회귀  10,207 passed / 0 failed · typecheck 0 · build 0
운영  https://ttaejyo.vercel.app  (/ 200 · /pipeline 307)
```

## 2. 완료(재조사 금지 · 근거는 커밋/경로만)
| 작업 | 커밋 |
|---|---|
| migration 080 — `source` 에 `WEB_SEARCH`·`DOMESTIC_LISTING` 추가·적용·검증 | `288c12e3` + `packages/database/migrations_manual/080_*.sql` |
| SEARCHRUN-PRESERVATION — 셀러 편집이 `searchRun` 을 지우지 않는다 | `83e70ee5` |
| 한글 질의 생성기(식별력 게이트) | `ae9a47d8` + `packages/shared/src/korean-discovery-query.ts` |
| 고확률 2-of-3 표현 계층 + 강/약 불일치 분리 | `49c1dde4` · `809d9d22` + `apps/admin/src/app/pipeline/commerce/seller-probability.ts` |
| 국내 쿼리에 품번 반영 · DNA null-safe | `ef65e33b` |
| Evidence 기준 확정(16절) | `docs/MLS2-FINAL-EVIDENCE-STANDARD.md` |
| 분석 스크립트 5종(read-only) | `packages/database/scripts/mls2-*.mjs` |

## 3. 미완료
```
① 계약 4건 갱신 (079 전제를 고정 중 — 080 이 그 전제를 바꿨다)
② 국내 후보 배선 (구현했으나 ① 때문에 되돌림 · clean)
③ 상세설명 Evidence 검증 → ④ 국내외 MI 비교 → ⑤ CPO 제출 → ⑥ UI/배포
```

## 4. 다음 실행 파일·함수
```
배선  apps/admin/src/app/api/price-history/check/route.ts  :562 `const seen = [`
      → 두 줄 추가:
        ...(domesticShop.webSearchEvidence ?? []).map((e: GeminiTransientEvidence) => ({ e, source: "WEB_SEARCH" as const })),
        ...(domesticShop.domesticListingEvidence ?? []).map((e: GeminiTransientEvidence) => ({ e, source: "DOMESTIC_LISTING" as const })),
타입  apps/admin/src/app/api/price-history/_lib/candidate-review.ts  :28 `ReviewSource`
      → `| "WEB_SEARCH" | "DOMESTIC_LISTING"` 추가
🟢 그 외 코드 불필요 — `recordSeenCandidates` 가 필드를 이미 전부 매핑한다
   (discoveredUrl · title · domain · priceAmount · priceCurrency · market ·
    crossSellerVerdict · matchTruth · priceTier · blockers · matchReasons ·
    originCode = dna.brandModelCode.toUpperCase())
```

## 5. 갱신할 계약 4건
| 파일 | 테스트 |
|---|---|
| `apps/admin/src/app/pipeline/commerce/__tests__/stage2-evidence-recovery.test.ts` | D3-4 |
| `apps/admin/src/app/api/price-history/_lib/__tests__/core-2r4-listing-wiring.test.ts` | A-6 |
| `apps/admin/src/app/api/price-history/_lib/__tests__/core-e2e-close-06r-instrumentation.test.ts` | I-7 |
| `apps/admin/src/app/api/price-history/_lib/__tests__/mi-funnel-persist-01.test.ts` | B-1 |

갱신 방향 — 🔴 「그 값을 쓰지 말라」(079 전제) → 🟢 **「쓰더라도 자기 이름으로만」**:
```
WEB_SEARCH → "WEB_SEARCH" · DOMESTIC_LISTING → "DOMESTIC_LISTING"
출처 위장 금지 · 승인 안 된 source 금지 · searchRun 에 URL·제목 유입 금지(O-1 유지)
```

## 6. 실행 순서
`① 계약 4건 갱신 → ② 배선 → ③ 변이 3(출처위장/두줄제거/searchRun URL유입) → ④ 회귀·typecheck·build → ⑤ 배포 → ⑥ 1회 실행 → ⑦ 상세설명 Evidence 검증 → ⑧ 국내외 비교표 제출 후 정지`

## 7. 변경 금지
해외 검색·수집 로직 · Identity 임계값/판정 · Evidence 정책 · 가격 eligibility ·
CEO GT 38 · 해외 후보 180행 · O-1 보안계약 · 새 검색/수집 경로 · 사이트 재접속 · 429 조사

## 8. CPO 제출물
```
① 국내 후보 저장 건수(producer별)   ② 원상품별 국내 후보 목록
③ URL·제목·가격·이미지·근거 확인표   ④ 중복/부분유니크 충돌 여부
⑤ 검색실패 ↔ 후보없음 ↔ 저장실패 구분
⑥ 해외 HIGH 48 / POSSIBLE 33 과 원상품별 국내외 비교표
⑦ 기존 판정 ↔ 상세설명 반영 «예상» 판정 비교(🔴 자동 변경 금지)
🔴 CTO 는 CPO_CONFIRMED/REJECTED 를 판정하지 않는다
```

## 9. 🔴 다음 세션이 먼저 알아야 할 제약 1건
`candidate_reviews` **24칸에 후보 상세설명/HTML 칸이 없다**(전수 확인). ⟹ STEP 4 의
「기존 후보 상세설명 활용」은 **현재 저장분으로 불가능** 하고, 그 데이터는 후보 페이지를
다시 열어야 생긴다(= 금지된 「사이트 재접속」). 🟡 **CPO 판정 필요** —
⒜ 상세설명 저장 칸을 열 것인가(migration) ⒝ 다음 분석 실행에서 수집되는 것부터 쓸 것인가.
🔴 CTO 가 고르지 않았다. ①~⑥ 은 이 판정과 **무관하게** 진행 가능하다.
