# NEXT SESSION EXECUTION PROMPT (이 파일 내용만 새 세션에 붙여넣는다)

---

CTO 작업을 이어서 진행한다. 프로젝트 전체를 다시 조사하거나 설명하지 않는다.
인수인계는 `docs/CTO-HANDOVER-NEXT.md` 하나다 — 그것만 읽고 바로 STEP 1 부터 실행한다.

기준 HEAD `288c12e3` · git clean · 회귀 10,207 / 0 failed · typecheck 0 · build 0.
migration 080 은 **적용·검증 완료** 다(재검증 금지).

## STEP 1 — 상태 최소 확인 (3줄)
```
git status --short && git log --oneline -1 && git rev-list --left-right --count origin/main...HEAD
```
완료된 조사·측정을 다시 하지 않는다.

## STEP 2 — 계약 4건 갱신
```
apps/admin/src/app/pipeline/commerce/__tests__/stage2-evidence-recovery.test.ts            D3-4
apps/admin/src/app/api/price-history/_lib/__tests__/core-2r4-listing-wiring.test.ts         A-6
apps/admin/src/app/api/price-history/_lib/__tests__/core-e2e-close-06r-instrumentation.test.ts I-7
apps/admin/src/app/api/price-history/_lib/__tests__/mi-funnel-persist-01.test.ts            B-1
```
네 가드는 079 의 「그 source 를 쓰지 말라」를 고정하고 있다. **080 이 그 전제를 바꿨다.**
→ 다음 불변조건으로 **갱신·강화** 한다(느슨하게 하지 않는다):
```
WEB_SEARCH 는 "WEB_SEARCH" 로 · DOMESTIC_LISTING 은 "DOMESTIC_LISTING" 으로 저장
출처 위장 금지 · 승인되지 않은 source 저장 금지
searchRun 에 URL·제목 유입 금지(O-1 보안계약 유지)
```

## STEP 3 — 국내 후보 배선 (코드 2곳 · 그 외 불필요)
```
check/route.ts :562 `const seen = [` 에 두 줄 추가
  ...(domesticShop.webSearchEvidence ?? []).map((e: GeminiTransientEvidence) => ({ e, source: "WEB_SEARCH" as const })),
  ...(domesticShop.domesticListingEvidence ?? []).map((e: GeminiTransientEvidence) => ({ e, source: "DOMESTIC_LISTING" as const })),

candidate-review.ts :28 `ReviewSource` 에 `| "WEB_SEARCH" | "DOMESTIC_LISTING"` 추가
```
`recordSeenCandidates` 가 필드를 이미 전부 매핑한다 — 새 함수·새 검색·새 수집 경로를 만들지 않는다.
해외 경로는 한 줄도 바꾸지 않는다.

## STEP 4 — 검증 후 배포
변이 3종(출처 위장 / 두 줄 제거 / searchRun 에 URL 유입) 각 FAIL 확인 → 복구 →
전체 회귀 · typecheck · build → commit · push → Production HTTP 확인 → **기존 경로 1회 실행**.

## STEP 5 — 상세설명 Evidence 검증 (해외 180건 우선)
방향을 반드시 지킨다: **원본의 BRAND · PRODUCT_NAME · DETAIL_IDENTIFIER 를 기준으로
후보 상세설명 안에 그 정보가 있는지 찾는다.** 원본 상세설명을 다시 분석하는 작업이 아니다.
우선순위 — BRAND MISMATCH → DETAIL_IDENTIFIER UNKNOWN/MISMATCH → PRODUCT_NAME MISMATCH.
행마다 원문 · 추출값 · 출처 위치 · 기존 판정 · **예상** 판정 변화를 적는다.
🔴 기존 판정을 자동으로 바꾸지 않는다. UNKNOWN 을 MISMATCH 로 바꾸지 않는다.
🔴 같은 원문을 여러 Evidence 로 중복 계산하지 않는다.

🔴 **선행 제약 1건** — `candidate_reviews` 24칸에 후보 상세설명/HTML 칸이 **없다**(확정).
현재 저장분으로는 STEP 5 를 돌릴 수 없고, 사이트 재접속은 금지다. ⟹ CPO 판정 둘 중
하나가 필요하다: ⒜ 상세설명 저장 칸 신설(migration) ⒝ 다음 분석 실행 수집분부터 사용.
**그 판정을 CTO 가 고르지 않는다.** STEP 2~4 는 이 판정과 무관하게 끝낸다.

## STEP 6 — 국내외 MI 비교표 제출 후 **정지**
동일 Evidence 기준으로 국내·해외를 비교한다(해외 기존 결과를 기준선으로 유지).
제출물: 국내 저장 건수(producer별) · 원상품별 국내 후보 · URL/제목/가격/이미지/근거 ·
중복·부분유니크 충돌 · **검색실패 ↔ 후보없음 ↔ 저장실패 구분** ·
해외 HIGH 48 / POSSIBLE 33 과의 원상품별 비교표 · 기존 판정 ↔ 예상 판정 비교.
🔴 `CPO_CONFIRMED`/`CPO_REJECTED` 를 CTO 가 판정하지 않는다. 여기서 멈추고 보고한다.

## STEP 7 — (CPO 승인 후에만) 후보 리스트 UI → 배포 → CEO 확인
기존 `/pipeline` 에 연결한다. 새 화면·중복 Evidence 시스템을 만들지 않는다.
첫 화면=판단 / 상세=근거. 제목 추출값과 상세설명 추출값을 구분 표시.
판매자 SAME / SIMILAR / DIFFERENT / UNDECIDED 는 시스템 verdict 와 **다른 칸**에 보존.
내부 blocker 토큰을 셀러 화면에 노출하지 않는다.

## 변경 금지
해외 검색·수집 로직 · Identity 임계값/판정 · Evidence 정책 · 가격 eligibility ·
CEO GT 38 · 해외 후보 180행 · O-1 보안계약 · 새 검색/수집 경로 · 사이트 재접속 · 429 조사 ·
브랜드 alias 등록부 · 기존 판정 덮어쓰기.

## 보고 원칙
중간 승인 요청을 반복하지 않는다. STEP 6 까지 가서 **한 번** 보고한다.
보안계약 변경 · 해외 회귀 위험 · 데이터 삭제 위험 · 구조적 정책 충돌일 때만 중단 보고한다.
타입 오류와 정책 변경에 따른 기존 테스트 대응은 CTO 가 자체 해결한다.
