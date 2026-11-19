# TTAEJYO — 다음 세션 인수인계 (§B-38 실행)

> 🔴 **이 문서 하나로 시작한다.** 전략 재조사·재논의·확인 질문 없이 **STEP 1 부터** 실행한다.
> 🔴 이미 확정된 전략·동결 정책·대상을 다시 묻지 않는다.
> 🟢 상세 이력은 `docs/CTO-SESSION-START.DRAFT.md` §B-18~§B-38 에 있다 — **막혔을 때만** 연다.

---

## 0. 이번 세션의 목표 — 한 건

**`junioredition.com × B226AC033` 의 해외 MI 판정을 바로잡거나, 근거에 따라 수정안을 기각한다.**

```
수정 → KIDS 전체 회귀 → 셀러 화면 E2E → Production 검증   ← 하나의 통합 작업
```
🔴 분석 보고서를 더 만드는 세션이 **아니다**. 🔴 새 WU 를 만들지 않는다.

---

## 1. 🔴🔴 합격·기각 조건 (절대 기준)

```
① Human SAME       → 시스템 **SAME**            대상 `junioredition.com × B226AC033`
② Human DIFFERENT  → 시스템 **DIFFERENT 유지**   대조군 `designerkidswear.com`(Stone Island)
🔴 둘 중 하나라도 실패하면 **수정안 전체를 기각** 한다.
🔴 SAME 숫자 증가 · 후보 수 증가 · 평균 점수 향상은 **합격 기준이 아니다.**
🔴 잘못된 SAME 을 **하나라도** 만들면 실패다.
```

---

## 2. 이미 확정된 진단 (재조사 금지)

| 영역 | B226AC033 실측 | 판정 |
|---|---|---|
| 🇰🇷 국내 후보 | URL 은 있었고 **수집에서 죽었다**(HTTP_429 → TimeoutError) | **수집 문제** · 🔴 **금지 축**(약관·429·어댑터) |
| 🌎 해외 후보 | 후보 **6** · **SAME 0 · PRESUMED_SAME 6** · 가격 **6 보유** | 🔴🔴 **MI 판단 문제 ← 이번 수정 지점** |
| 💰 가격 | `PRESUMED_SAME` 은 가격 자격 집합에 **포함** · 화면에 GBP/CAD/USD 표시됨 | 🟢 **정상 · 손대지 않는다** |
| 🖥 셀러 연결 | 실제 가격 표시 확인됨 | 🟢 **정상 · 손대지 않는다** |

🟢 대상 후보의 기존 상태 — `brandAxis` **MATCH** · `state` **CORRECT** · Human GT **SAME** · 시스템 **PRESUMED_SAME**.

---

## 3. STEP 1 — 축·blockers 추출 (첫 명령)

### 운영 판정 owner (추측 금지 · 이름 확정됨)

```
packages/crawler/src/comparison-search/cross-seller.ts   `compareCrossSellerProducts(`
packages/crawler/src/comparison-search/match.ts:581      `withConfidence(query, candidates)`
packages/crawler/src/comparison-search/match-truth.ts:74 `deriveMatchTruth(`
```
🔴 **운영 순서대로** 부른다 — `withConfidence` 가 확인 배선(`confirmBrandCodeInEvidence`)을
돌리므로 `compareCrossSellerProducts` 를 **직접만** 부르면 **운영 값이 아니다**(CORE-2I 선례).

### 근거 자료 4개 (실재 확인됨 · 경로 그대로 사용)

```
apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/wu-059-gt-facts.json   원상품 facts(origins S1~S6)
docs/MI-KIDS-CODE-NAME-CAUSES.json                                                  원인 코드(code.cause · name.cause · axis*)
apps/admin/src/app/api/price-history/_lib/__tests__/preserved/a-identity-axis.json  축 상태(26쌍)
docs/MI-BRAND-TITLE-FILL-FINAL.json                                                 Human SAME 라벨 근거(B226AC033 2행)
```
🔴 조인 키는 **(originCode, candidateUrl)** 다 — 도메인·URL 단독 조인은 **어긋난다**(실측).

### 뽑아야 할 것

```
blockers 전수 · 축별 MATCH / MISMATCH / UNKNOWN · **SAME 정원 집계**
🔴 정원 규칙 — `SAME_MIN_AXES` **5** · `PRESUMED_SAME_MIN_AXES` **3** ·
   `IMAGE` 제외 · **1점 `TITLE`** 제외(기전: 축 배열 필터 `axis.axis !== "IMAGE" && !(TITLE && points===1)`)
🔴 「모른다 ↔ 달랐다」를 가른다 — 관찰된차이 9종만 `OBSERVED_DIFFERENCE_BLOCKERS` 이고
   `BRAND_UNCONFIRMED` · `COLOR_VARIANT` 는 **보류** 다 · `SIZE_SYSTEM` 은 어휘에만 있고 **push 0**
⟹ **SAME 을 막는 축(또는 복합 원인) 하나를 특정** 한다
```

---

## 4. STEP 2~5 (변경 금지)

```
STEP 2 공통 MI 수정   원인이 확인된 경우에만 · 기존 축·기존 증거만 · 사이트 예외 0 · 새 증거 생성 0
STEP 3 KIDS 전체 회귀  대상 SAME 확인 · 대조군 DIFFERENT 유지 확인 · 다른 상품 회귀 0
STEP 4 셀러 화면 E2E  **마운트 DOM** 기준 · 판정 ↔ 표시 일치 · 결함 없으면 UI 수정 0
STEP 5 Production     배포 · 대상/대조군 실제 판정 확인 · 🔴 미확인은 **NOT VERIFIED** 로 적는다
```

---

## 5. 🔴 돌아가지 않는 영역

```
검색 쿼리 연구·A/B · 국내 후보 탐색 반복 조사 · 국내 수집(약관·429·어댑터·우회) ·
가격 계산·가격 적격성 · 정상 확인된 셀러 연결·UI · 닫힌 과거 평가 재실행 · 새 WU 생성
🔴 국내 수집 문제와 해외 MI 판정 문제를 **분리** 한다. 이번은 **해외 MI 판정 한 건** 이다.
```

---

## 6. 동결·보호 (CEO 승인 없이 변경 금지)

```
`SAME_MIN_AXES = 5` · `PRESUMED_SAME_MIN_AXES = 3` · `IMAGE` 정원 제외 · **1점 TITLE** 정원 제외
설명문만으로 SAME 승격 금지 · 이미지 단독 SAME 금지 · 품번 충돌 무시 금지 ·
제목 토큰 → `brandModelCode` 승격 금지(REJECT 선례 `32a0f374` · 계약 11건) ·
사이트 전용 예외 금지 · 가격 정책·G6 변경 금지 · `isCollectionBlocked` 변경 금지 ·
DB 스키마·migration 금지 · `git add .` 금지 · 사용자 수정 파일 보존
보호 문서  `docs/START-HERE.md` · `docs/CEO-GT-LEDGER-2026-11-08.md` · `CLAUDE.md` · `docs/STANDARD-V1.md`
frozen     `mi-locale-link-01` = **7b093ef4**(수정·병합·배포 금지)
```

---

## 7. 시작 기준선 (다르면 **차이를 보고**한다 · 임의 정리 금지)

```
작업트리 **121건**(사용자 수정+untracked) · CTO 미커밋 **0**
origin/main **f7ad9d26** · ahead/behind **0 0** · 운영 코드 변경 **0** · Production **200**
frozen **7b093ef4** · G6 동결 · SAME 기준 동결 · 가격 로직 동결 · 약관 게이트 동결
```

### 실행 명령 참고

```
단위 테스트  cd apps/admin && npx vitest run <파일>
타입         cd apps/admin && npx tsc --noEmit -p tsconfig.json         (기준 0)
전체 회귀     cd apps/admin && npx vitest run \
  --exclude "src/app/pipeline/__tests__/golf01-wire-page-chain.test.ts" \
  --exclude "../../packages/crawler/src/comparison-search/__tests__/kids-locale-link-integration-design.test.ts"
🔴 그 두 파일은 **사용자 untracked 테스트** 이고 기준선에서 이미 실패한다(내 변경과 무관 · 손대지 않는다)
🟢 기준선 숫자 — 928 files / 11,451 passed / 0 failed
```

---

## 8. 최종 보고 형식 (한 번에)

```
A 원인   실제 blocker · 축별 상태 · SAME 을 막은 **코드 경로** · 원본↔후보 근거 비교
B 수정   변경 파일 · 변경한 공통 로직 · 변경 전후 판정 차이 · 사이트 예외 여부
C 검증   대상 SAME 결과 · **대조군 DIFFERENT 결과** · KIDS 회귀 · 셀러 E2E · Production
D 안전성  threshold/동결/가격/약관 변경 여부 · 보호 문서·사용자 파일 보존 · frozen 영향
E Git    커밋 SHA · 변경 파일 · 테스트 명령과 결과 · 배포 여부 · Production 근거
F 판정   **PASS** / **REJECT**(①② 중 하나라도 실패) / **BLOCKED**(명확한 장애)
🔴 부분 완료를 전체 완료로 적지 않는다. 코드 변경·테스트·배포·실제 동작 확인을 **구분** 한다.
```

---

## 9. 🔴 이 트랙에서 반복된 함정 (다음 세션이 먼저 읽는다)

```
① **칸 이름을 추측하지 않는다** — 타입·운영 코드에서 **읽고** 쓴다(이 트랙에서 12번 틀렸다)
② **운영 호출 순서를 그대로 베낀다** — 함수를 직접만 부르면 배선이 빠진다(§5-B)
③ **주석을 근거로 단언하지 않는다** — 주석 제거 후 사라지는 이름이 실재한다(`coreAxisCount`)
④ 🔴 주석 제거 정규식 `//[^\n]*` 은 **`https://` 의 `//` 를 먹는다** ⟹ URL 단언은 **원문** 으로
⑤ **금지 토큰은 런타임에 조립** 한다 — 리터럴로 적으면 **내 목록이 내 파일을 잡는다**(7번 났다)
⑥ **조인 키를 버리지 않는다** — 산출물에 `originCode` 를 남긴다(없으면 되짚을 수 없다)
⑦ **「측정불가」를 0 으로 적지 않는다** · 분모와 측정 범위를 같이 적는다
⑧ 가드가 내 변경을 막으면 **가드를 풀지 말고 이름을 옮긴다**
```

---

**이번 세션 종료 상태:** 수정 지점 특정 및 실행 준비 완료 — **제품 작업 완료가 아니다.**
**다음 세션 목표:** 대상 페어의 MI 판정 수정 + 전체 검증 완료, **또는** 근거에 따른 기각.
