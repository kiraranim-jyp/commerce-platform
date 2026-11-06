# CTO HANDOVER — 다음 세션 즉시 실행

## 1. 현재 상태
```
HEAD  fbbbac33  (feat(국내 후보 영속): 생산자 둘을 candidate_reviews 에 배선)
git   clean · origin/main 0/0
회귀  10,207 passed / 0 failed(기준선 동일) · typecheck 0 · build 0
운영  https://ttaejyo.vercel.app  (/ 200 · /pipeline 307 · /check 401)
      🔴 HTTP 상태는 **배포 증거가 아니다**(메모 production-307-is-not-route-evidence)
```

## 2. 완료(재조사 금지 · 근거는 커밋/경로만)
| 작업 | 커밋 |
|---|---|
| migration **082** — `source` 에 `WEB_SEARCH`·`DOMESTIC_LISTING` 추가·적용·검증 | `288c12e3` + `prisma/migrations_manual/082_*.sql` |
| 🆕 **국내 생산자 배선** — `seen` 이 다섯을 담는다 · 계약 4건 갱신 · 변이 3종 | `fbbbac33` |
| 🆕 082 misfiling 정정(새 디렉터리 + 번호충돌 → 정본 082) · **DB 변경 0** | `fbbbac33` |
| SEARCHRUN-PRESERVATION — 셀러 편집이 `searchRun` 을 지우지 않는다 | `83e70ee5` |
| 한글 질의 생성기(식별력 게이트) | `ae9a47d8` |
| 고확률 2-of-3 표현 계층 + 강/약 불일치 분리 | `49c1dde4` · `809d9d22` |
| 국내 쿼리에 품번 반영 · DNA null-safe | `ef65e33b` |
| Evidence 기준 확정(16절) | `docs/MLS2-FINAL-EVIDENCE-STANDARD.md` |

🟢 **라이브 DB 제약 실측(2026-11-06)** — `candidate_reviews_source_check` 에 **일곱 값 전부** 있다.
🟢 **O-1 보안 계약 유지** — 후보 행은 `candidate_reviews` 로 가고 `searchRun` 은 숫자만 담는다.

## 3. 🔴🔴 지금 막힌 것은 «하나» 고 CTO 범위 밖이다

```
저장 자리는 열렸고 배선도 끝났는데 **국내 행이 0** 이다 — 이유는 **배선 이후 분석 실행이
«아직 0회»** 이기 때문이다. 🔴 「공급 0」·「국내 후보 없음」으로 **읽지 않는다**.

실측 — candidate_reviews 180행 / URL 90 / GT 38 **불변** ·
       OVERSEAS_AUTO 156 · GT_IMPORT 17 · SELLER_URL 7 · 🔴 WEB_SEARCH 0 · DOMESTIC_LISTING 0
🟢 생산자는 전부터 돈다 — searchRun 9건에서 WEB_SEARCH **10** · DOMESTIC_LISTING **3**
🔴 그 9건 중 검색 실패 **3**(SearchTimeoutError) ⟹ 그 0 은 **측정불가** 다
🔴 소급 backfill 은 **하지 않았다** — 재수집이 필요하고 사이트 재접속은 금지다
```

🔴 **CTO 가 그 실행을 일으킬 수 없다(실측 · 추정 아님)**
```
Production /api/price-history/check  → **401**(인증 미들웨어)
로컬 recordSeenCandidates            → getSupabaseAdmin() 이 SUPABASE_SERVICE_ROLE_KEY 를
                                        요구하고 그 키는 **로컬에 없다**(.env.example 뿐)
```

🟡 **CEO Action — 딱 1회**: `/pipeline` → 아동의류 상품 하나 → **「새 상품 분석」**

## 4. 그 1회 뒤 다음 세션이 바로 할 일
```
① node packages/database/scripts/mi-screen-readiness.mjs
   🟢 ① 표의 🇰🇷 열과 ② searchRun 을 **같이** 읽는다
   🔴 배선 이전 180행과 이후 행을 **같은 분모로 세지 않는다**(first_seen_at 로 가른다)
② STEP 6 국내외 비교표를 CPO 에게 제출하고 **정지**
   ① 국내 저장 건수(producer별) ② 원상품별 국내 후보 ③ URL·제목·가격·이미지·근거
   ④ 중복/부분유니크 충돌 ⑤ 검색실패 ↔ 후보없음 ↔ 저장실패 **구분**
   ⑥ 해외 HIGH 48 / POSSIBLE 33 과 원상품별 비교 ⑦ 기존 판정 ↔ 예상 판정(🔴 자동 변경 금지)
🔴 CTO 는 CPO_CONFIRMED/REJECTED 를 판정하지 않는다
```

## 5. 🔴 STEP 5(후보 상세설명 Evidence) — 선행 판정 대기
```
`candidate_reviews` **24칸에 후보 상세설명/HTML 칸이 없다**(확정) ⟹ 현재 저장분으로
돌릴 수 없고, 그 데이터는 후보 페이지를 다시 열어야 생긴다(= **금지된 사이트 재접속**).
🟡 CPO 판정 둘 — ⒜ 상세설명 저장 칸 신설(**migration**) ⒝ 다음 분석 수집분부터 사용
🔴 CTO 가 고르지 않았다.
```
🔴 열릴 때의 방향은 고정이다 — 원본의 BRAND·PRODUCT_NAME·DETAIL_IDENTIFIER 를 **기준으로**
후보 상세설명 안에서 찾는다(원본 상세설명 재분석이 **아니다**). 우선순위 BRAND MISMATCH →
DETAIL_IDENTIFIER UNKNOWN/MISMATCH → PRODUCT_NAME MISMATCH. 🔴 기존 판정 자동 변경 금지 ·
UNKNOWN → MISMATCH 금지 · 같은 원문 중복 계산 금지.

## 6. 🟢 갱신된 계약 — 되돌리지 않는다
| 테스트 | 지금 잠그는 것 |
|---|---|
| D3-4 | **SQL CHECK ↔ TS union 양방향 대조**(한쪽만 늘면 FAIL · 기대값 import 금지) |
| A-6 | **배열 ↔ 라벨 쌍 단언** — 위장·누락·무단추가를 한 번에 잡는다 |
| I-7 | `seen` **다섯** 생산자 · Search/Identity 금지축 단언 유지 |
| I-8 | 079 **무편집** + 082 가 **정확히 둘** 을 더했다(적용된 migration 사후편집 금지) |
| B-1 | 승인된 다섯을 담는다 · **그 이상 금지** |
| O-1 | `searchRun` 은 **숫자만** — URL·제목 유입 금지(🟢 그대로 유효) |

🔴 `REVIEWED_SAME` 은 **승인 밖** 이다 — 그 후보의 행은 이미 이 표에 있고, 기존 값으로
적으면 upsert 가 **원래 출처를 덮는다**.

## 7. 변경 금지
해외 검색·수집 로직 · Identity 임계값/판정 · Evidence 정책 · 가격 eligibility ·
CEO GT 38 · 해외 후보 180행 · O-1 보안계약 · 새 검색/수집 경로 · 사이트 재접속 · 429 조사 ·
브랜드 alias 등록부 · 기존 판정 덮어쓰기 · **적용된 migration 사후 편집**.

## 8. 🔴 이번 세션이 남기는 교훈 1건
```
migration 을 **정본 디렉터리** 에 **빈 번호** 로 넣는다.
082 는 처음 `packages/database/migrations_manual/`(그 커밋이 **새로 만든** 디렉터리)에
`080` 으로 들어갔고, 정본 `prisma/migrations_manual/` 에는 **080·081 이 이미 있었다**
⟹ 정본 순서대로 적용하면 **그 파일이 보이지 않는다**. 🟢 DB 는 멀쩡했다(적용·검증됨) —
   틀린 것은 **파일 위치와 번호** 뿐이었고 그래서 **DB 변경 0** 으로 고쳤다.
```
