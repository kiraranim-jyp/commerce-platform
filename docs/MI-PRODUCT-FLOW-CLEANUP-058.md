# WU-058 — Product Flow Cleanup & Production Readiness (롱스프린트)

> 🔴 **CPO 지시 2026-10-17.** 「이번에는 더 이상 작은 WU 를 계속 쪼개지 않습니다.」
> 축 A~K 를 한 덩어리로 닫고 **최종보고 1회** 만 올린다(헌장 §4-B).

---

## 0. 한 줄 결론

```
🟢 축 A(소싱 완전 제거)  **구현 완료 / 배포 완료**  — 흐름이 넷으로 고정됐다
🟢 축 B(가격비교 동결)    **동결 유지**            — 가격비교 운영 파일 변경 **0**
🔴 축 C(BRAND_UNCONFIRMED) **HOLD 유지**          — 안전성 우선(WU-057 판정 그대로)
🔴 축 D(C27 본문 가격)     **HOLD 유지**          — 안전한 추출 기준 없음(WU-052 계열)
🟢 축 E(UI 잔재)          **전수 확인 · 1건 정정** — 「소싱가」→「원가」
🟢 축 F(UX 점검)          **PASS**                — 빈 단계 0 · 번호 1~4 연속
🟢 축 G(transient/reload)  **설계 확인**           — 저장 차단 불변식 생존
🟢 축 H(price_alerts)     **경로 불변**           — 쓰기 owner 변경 0
🟢 축 I(dead code)        **UI 만 제거**           — backend/schema 보존(CPO §1·§5)
🟢 축 J(보안 회귀)        **경계 불변**           — SSRF/DNS 파일 변경 0
🟢 축 K(문서/헌장)        **§12 갱신 완료**
```

🔴🔴 **그리고 이 WU 가 배포 «전» 에 실제 결함 1건을 잡았다**(§9).

---

## 1. Scope

```
🟢 한 것        소싱 단계·소싱 URL UI 를 제품에서 제거 · 흐름 4단계 고정 ·
                단계 번호 owner 수정 · UI 잔재 전수 · 보호계약 16항 생존 확인 ·
                §12 갱신 · Production 배포 + smoke
🔴 안 한 것     가격비교 로직 · identity 정책 · 가격 추출 기준 · threshold ·
                Registry · schema · backend producer 삭제 · 새 UI · AI 호출
```

---

## 2. 변경 내용 (운영 6파일 · 삭제 1파일)

| 파일 | 변경 |
|---|---|
| `commerce/workflow.ts` | `BigStepKey`/`BIG_STEP_ORDER`/`BIG_STEP_LABELS` 에서 `SOURCE_SELECTING` 제거 · `SourcingSignal` · `buildSourceSelecting` · `SOURCING_SIGNAL_NOT_STARTED` · `WorkflowInput.sourcing` · `NavTarget` 의 `"sourcing"` 제거 · 🔴 **단계 번호를 배열 순서에서 파생** |
| `commerce/stage-focus.ts` | `MAIN_BY_STAGE`/`IMAGE_ROLE_BY_STAGE` 의 `SOURCE_SELECTING` · `StageMain "SOURCING"` · `StageFocus.sourcing` 제거 |
| `commerce/StageBody.tsx` | `sourcing` prop · `focus.main === "SOURCING"` 본문 · `CollapsibleSection "소싱 선택"` 제거 |
| `CommerceWorkspace.tsx` | `SourcingPanel` 마운트 · `sourcingSignal` state/handler/deps · nav 분기 · 탭 전환 분기 제거 |
| `pipeline/page.tsx` | `SOURCING_SIGNAL_NOT_STARTED` import · `sourcing:` 배선 제거 |
| `commerce/registration-readiness-outcome.ts:162` | 사용자 노출 문구 「소싱가나 판매가」 → **「원가나 판매가」** |
| `commerce/SourcingPanel.tsx` | 🔴 **삭제**(487줄) — 운영 참조 0 확인 후 |

계약 테스트: `pivot03c-sourcing-panel.test.ts` **삭제**(그 UI 전용 계약) ·
단계 수/인덱스 단언 **5파일 갱신**(workflow · stage-focus · price-single-surface ·
three-layer-realign · wu-049r) · fixture **7파일** 정리 · 신규 `wu-058-sourcing-removed.test.ts`.

---

## 3. 조사 결과 — 축별

### 축 A · E — 「소싱」 전수 조사 (문자열 grep 으로 지우지 않았다)

🔴 CPO §5: 「단순 문자열 삭제가 아니라 **실제 사용자 노출 지점** 을 기준으로 전수 확인합니다.」
그래서 판정 기준을 **하나** 로 세웠다 — **「사용자에게 소싱이라는 «기능/단계» 를 가리키는가」**.

| 남은 위치 | 성질 | 판정 |
|---|---|---|
| `coupang/register`·`shipping-place` 「소싱 국가」 | 쿠팡 **출고지** 선택 | 🟢 일반 명사 · 유지 |
| `market-intelligence` 「국내 소싱」 | **원가 축** 어휘(국제배송 구간 부재) | 🟢 유지 |
| `market-signals` 「소싱 가격」·「해외 소싱가」 | **해외 매입 원가** | 🟢 유지(축 B 동결 구역) |
| `page.tsx` 「상품을 많이 소싱하는 셀러」·「소싱 담당자」 | 랜딩의 **셀러 직무** 설명 | 🟢 유지 |
| `SellerProfileSummaryCard` 「소싱 국가에 맞춰 자동 선택」 | 출고지 | 🟢 유지 |
| `master-ready.ts` 「소싱 후보 중에서 …」 | **API 응답 전용** · UI 소비자 **0** | 🟢 보존(§I) |
| `api/products/**` · `*-policy.ts` 오류 문구 | backend | 🟢 보존(CPO §1·§5) |
| `registration-readiness-outcome:162` 「소싱가」 | 🔴 **사용자 노출 · 기능 어휘** | 🔴 **정정 → 「원가」** |

🟢 **UI 호출부 0 을 실측** — `.tsx` 전수에서 `sourcing-candidates`·`selected-source` 호출 **0건**.

### 축 B — 가격비교 동결

이 커밋이 건드린 **17파일 전수**(§2 표 + 테스트)에 가격비교 운영 파일이 **0** 이다.
`market-intelligence.ts` · `overseas-reference.ts` · `check/route.ts` ·
`product-url-facts.ts` · `price-source-adapter.ts` · `cross-seller.ts` **전부 미변경**.

### 축 C — `BRAND_UNCONFIRMED`

🔴 **WU-057 의 HOLD 를 유지한다.** 현재 코드 상태가 그대로임을 확인했다 —
`cross-seller.ts:751` `brandKnown = Boolean(x.brand && y.brand)` ·
`:1000` blocker push · `:163` 「SAME 차단 목록에 들어가지 않는다」 주석.
🔴 HOLD 이유(WU-057 실측): **FP 분모가 0** 이고 `biskuit.kr` 의 brand 가 샵 이름
「비스킷」으로 오염돼 있어 **완화하면 거짓 SAME 이 생길 수 있다.** 측정 없이 풀지 않는다.

### 축 D — C27(beaumonde) 본문 텍스트 가격

🔴 **HOLD 유지.** JSON-LD 도 microdata 도 없고 가격이 **본문 텍스트** 다.
WU-052 가 확정한 것과 같은 성질 — **안전한 판별 기준이 없으면 구현하지 않는다**(CPO).

### 축 G — transient 수명

🟢 저장 차단 불변식 생존: `run-domestic-price-check.ts:1110`
`if (isTransientShopId(shopId)) return;` — upsert **앞** 에서 끊는다.
🔴 그래서 **새로고침하면 참고가격이 사라지는 것은 설계** 다. 문구 보강은 CPO 판정(§12 ③④).

### 축 H — `price_alerts`

🟢 쓰기 owner 는 `_lib/price-alerts.ts` 하나이고 **변경 0** 이다.
🔴 그리고 그것이 `DOMESTIC_REFERENCE_SCOPE` 에서 「판매판정 미반영」을 **국내에 단정하지
않은 이유** 다(POST `/check` 가 transient 포함 `sellerAction` 으로 알림을 갱신한다).

### 축 I · J — 삭제 범위와 보안

🟢 `sourcing_candidates` 참조가 **DB·API·schema 에 그대로** 있다(route 2 · store 1 ·
migration 3 · schema.prisma · script 1). 🔴 **무조건 삭제 금지**(CPO §1·§5) 를 지켰다.
🟢 보안 경계(`outbound-guard.ts` · `guardedLookup` · `url-candidate-pool.ts`) **변경 0** —
URL fetch 경계를 우회하지 않았고 producer 를 잘못 지우지 않았다.

---

## 4~7. 구현 / Data / Payload / UI

Data·DB **변경 0** · Payload **변경 0** · schema **0** · migration **0**.
UI 는 **제거만** 했다 — 새 컴포넌트 **0**.

```
상단 Flow   ① 상품 수집 → ② 시장 판단 → ③ 등록 준비 → ④ 커머스 등록
본문        COLLECTION / MARKET / PREPARE / REGISTER  (1:1 · 빈 단계 0 · 중복 0)
```

---

## 8. Positive Test — 신규 `wu-058-sourcing-removed.test.ts` (11건)

```
A 상단 Flow      단계 넷 · 라벨에 「소싱」 0 · 네 단계가 각각 본문 하나(중복 0) ·
                 번호 [1,2,3,4] 연속 · key 순서 일치
B 진입점         SourcingPanel 파일 없음 · StageBody/Workspace 에 소싱 어휘 0 ·
                 🔴🔴 **마운트 DOM** 4조합에 「소싱」·「URL 추가」 0
C 핵심 루프 보호   __url_candidates__ 생산자 · transient 저장 차단 ·
                 응답 두 축(overseasReference·domesticReference) ·
                 priceSource:"detail" 계약 · SSRF 경계
```

🔴 소스 검사만으로는 「접혀 있다」와 「없다」를 구분하지 못하므로 **B 는 마운트 DOM** 이다.

---

## 9. 🔴🔴 Negative / Mutation — 그리고 **배포 전에 잡은 실제 결함**

### 9-A. 내 새 테스트가 잡은 결함 (가장 중요한 산출물)

```
🔴 builder 들이 단계 `index` 를 **하드코딩** 하고 있었다(1·2·4·5).
   소싱(③)을 빼자 화면 진행 표시가 **「① ② ④ ⑤」** 가 됐다.
   → CPO §A-1 이 금지한 「잘못된 단계 번호」 상태를 **그대로 배포할 뻔했다.**
🟢 수정 — `resolveWorkflow` 가 **배열 순서에서** 번호를 매긴다:
     const steps = [collecting, market, prepare, register]
       .map((step, i) => ({ ...step, index: i + 1 }));
🟢 그래서 다음에 단계 수가 바뀌어도 번호가 어긋나지 않는다.
```

### 9-B. Mutation 5종 (CPO §13 지정)

baseline = `wu-058-sourcing-removed` + `wu-056r1-price-section-identity` +
`wu-056-domestic-reference` = **28 passed**

| | 변형 | 결과 |
|---|---|---|
| M1 | 소싱 단계 복구(`SOURCE_SELECTING` 되살리기) | 🔴 **4 failed** |
| M2 | 단계 라벨에 「소싱」 되살리기(`"소싱·등록 준비"`) | 🔴 **1 failed** |
| M3 | 해외 구역에 `≈ ₩59,960` 삽입 | 🔴 **2 failed** |
| M4 | 국내/해외 구역 **합치기**(같은 `testId`) | 🔴 **4 failed** |
| M5 | 가격 구역 **제목 충돌**(해외 → 「글로벌 시장 가격」) | 🔴 **1 failed** |
| — | **원상복구** | 🟢 **28 passed** |

🟢 다섯 전부 FAIL 로 잡혔다 — 소싱 제거와 가격 구역 분리가 **계약으로 잠겼다**.

---

## 10. Regression

```
apps/admin  566 files / **8,211 passed** / failed 0
```

---

## 11~12. Typecheck / Build

```
typecheck  **0 errors**  (🔴 baseline 10 → 이 트랙에서 0 으로 내려와 있다)
build      **exit 0**
```

---

## 13. Commit / Push

```
52046660  feat(058): 소싱 단계/소싱 URL UI 를 제품에서 제거한다 (축 A 구현)
git status                                   → clean
git rev-list --left-right --count origin/main...HEAD  → 0   0
```

---

## 14. Deploy

```
main push → Vercel Production 자동 배포 · ● Ready (Production) · duration 4m
🔴 커밋 해시는 CLI 가 보여주지 않는다 — **타임스탬프로만** 대응시켰다(단정하지 않는다).
   확실한 증거는 빌드 로그의 `Commit:` 줄이다(메모 production-307-is-not-route-evidence).
```

---

## 15. Production Evidence (read-only GET · 인증 앞단)

```
GET  /                            **200**
GET  /pipeline                    307   🟢 인증 리다이렉트(정상 보호)
GET  /today                       307   🟢 같음
POST /api/price-history/check     401   🟢 인증 가드(정상)
🔴 307/401 을 「route 가 없다」로 읽지 않는다.
```

---

## 16. External API Evidence

```
AI / Gemini / 외부 검색 API  **0 호출** · 키 0 · 결제 0 · ₩0
외부 HTTP                    **0** (전부 기존 fixture · 순수 함수)
```

---

## 17. Known Unknowns — 🔴 0% 로 적지 않는다

```
① 🔴 **셀러가 소싱 UI 를 실제로 쓰고 있었는가** — 사용 로그를 CTO 가 읽을 수 없다.
   `sourcing_candidates` 행 수는 DB 로 셀 수 있지만 **이 WU 에서 세지 않았다**(범위 밖).
② 🔴 **backend 를 언제 지울 것인가** — 참조 관계 확인 전 삭제 금지라 **미결** 이다.
③ 🔴 Production 실화면의 ① ② ③ ④ 표시는 **CEO 만 확인할 수 있다**(로그인 뒤).
   🟢 CTO 가 증명한 것은 **마운트 DOM + 단계 번호 파생** 까지다.
④ 🔴 축 C·D 는 **측정 불가가 아니라 정책 HOLD** 다 — 「효과 0」으로 적지 않는다.
```

---

## 18. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     🔴 CEO 확인 1회 필요(§19)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음(외부 호출 0)
Build PASS:  🟢        Production PASS:        🟡 §19 확인 후 확정
```

보호계약 **16항 전건 생존** 확인(운영 파일 grep) — transient 생산자 · SSRF/DNS ·
COLOR_VARIANT · SIZE_SYSTEM · compareModelCode · microdata · derivePriceStatus ·
priceSource detail · classifyCandidateMarket · 국내/해외 분리 · 환산 금지 ·
TIER_LABEL · DOMESTIC_REFERENCE_SCOPE · 가격 구역 식별 · 단계 넷 · 소싱 backend 보존.

---

## 19. 🟡 CEO Production UI 확인 — **한 번만** (7항)

```
URL     https://ttaejyo.vercel.app/pipeline       (로그인 필요)
상품    기존에 쓰던 상품 아무 것 하나 → 「🔄 다시 분석」 1회
```

| | 확인할 것 | 기대 |
|---|---|---|
| ① | 상단 진행 표시의 **단계 수** | **넷** — 상품 수집 / 시장 판단 / 등록 준비 / 커머스 등록 |
| ② | 단계 **번호** | **① ② ③ ④** (🔴 「① ② ④ ⑤」면 FAIL) |
| ③ | 「소싱 선택」 단계·섹션 | **없다** |
| ④ | 「소싱 URL 추가」 버튼/입력칸 | **없다** |
| ⑤ | 🇰🇷 **국내 참고가격** 구역 | 원래 통화 그대로 · 뱃지 한국어(「동일상품」·「유사상품」) |
| ⑥ | 🧾 **해외 동일상품 참고가격** 구역 | 외화만 · 🔴 **구역 «안» 에 `₩`·「약」이 없다** |
| ⑦ | 빈 단계 / 아무것도 없는 화면 | **없다** — 네 단계 모두 본문이 있다 |

🔴 **FAIL 이면 수정하지 않고 화면 그대로 전달한다**(§3 게이트).
🟢 ⑤⑥ 은 WU-056-R1 에서 이미 PASS 받은 구역이고, 이번 확인은 **회귀 여부** 를 본다.
