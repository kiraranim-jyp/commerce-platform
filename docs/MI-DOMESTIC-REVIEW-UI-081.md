# WU-081 — 국내 가격비교 후보 Human Review UI (구현 + 배포)

> 🔴 CPO 지시 2026-10-18. 「국내 MI 판정 로직을 변경하지 않는다 · 기존 해외 UI 구조를
> 재사용한다 · 자동판정과 사람판정을 분리한다 · 영구 schema 를 기본값으로 하지 않는다」

---

# WU-081 FINAL

## 1. 기존 해외 가격비교 UI owner (코드 위치 · 추정 0)

```
패널             DomesticPriceIntelligencePanel.tsx  `MiPanelView`
구역 묶음         같은 파일 `TransientCandidateSections`
금액 «집계» 구역   `OverseasReferencePrice`
                  🇰🇷 국내 참고가격        (WU-056 · DOMESTIC_REFERENCE_TITLE)
                  🧾 해외 동일상품 참고가격  (WU-056-R1)
후보 «행» 구역     `GeminiTransientCandidates.tsx`
                  🔎 웹 검색 후보 (WU-022) · 🔗 직접 입력한 후보 (WU-024)
라벨 owner        `match-display.ts` `tierDisplay` / `domesticMatchDisplay`
```

🟢 **후보 행 컴포넌트가 이미 CPO §4 요구를 「사람 검토」만 빼고 전부 그리고 있었다** —
판매처 · 상품명 · URL 링크 · 가격 · 통화 · 가격 상태 · MI 판단 · blocker · 판단 근거 · 출처 · 시장.

## 2. 국내 candidate data owner

```
후보 생성    ai-answer-pool.ts / url-candidate-pool.ts → factsFromProductUrl
가격         product-url-facts.ts (priceFromJsonLd ?? micro.price) + enrichCandidatePrices
priceStatus  derivePriceStatus(match.ts:537) — priceSource==="detail" ⟹ VERIFIED_CURRENT
market       classifyCandidateMarket (candidate-market.ts)
판정         compareCrossSellerProducts → deriveMatchTruth → priceTier
응답         POST /api/price-history/check → `domesticShop` · `domesticReference`
client       Panel `urlCandidateEvidence` / `geminiEvidence` (GeminiTransientRow[])
```

## 3. 국내 candidate → UI 실제 데이터 흐름

🔴 **새 데이터 출처를 만들지 않았다.** 이미 화면까지 오던 `GeminiTransientRow[]` 에서
`market === "KR"` 인 **행을 옮겼을 뿐** 이다.

## 4. 구현 내용 — 운영 **2 파일**

### ⒜ `GeminiTransientCandidates.tsx`
```
+ export type HumanReview = "SAME" | "DIFFERENT"
+ props  review?: Record<string, HumanReview> · onReview?(url, verdict)
+ 행 하단 「CEO 검토」 블록 — 🔴 `onReview` 가 없으면 **렌더되지 않는다**
+ DOMESTIC_REVIEW_HEADING = "🇰🇷 국내 후보 검토" · DOMESTIC_REVIEW_EMPTY
```
🟢 기존 두 구역은 `onReview` 를 넘기지 않으므로 **한 픽셀도 바뀌지 않는다**.

### ⒝ `DomesticPriceIntelligencePanel.tsx`
```
+ MiPanelView: useState<Record<string, HumanReview>>({}) + handler
+ TransientCandidateSections: isKr / krRows / webRest / suppliedRest
+ 🇰🇷 구역을 해외 참고가격 «뒤», 기존 두 구역 «앞» 에 둔다
+ 후보 0 이면 empty state (🔴 「국내 동일상품이 없다」로 적지 않는다)
```

🔴 **옮긴다. 복제하지 않는다** — 같은 행을 두 구역에 그리면 후보가 두 배로 읽힌다.
총 행 수 불변을 계약으로 잠갔다(H6-b).

## 5. Human Review data lifecycle

```
저장 위치  `MiPanelView` 의 useState — **DB schema 0 · API 0 · 서버 전송 0**
키         후보의 `discoveredUrl`
수명       transient 후보와 **같다**(새로고침하면 둘 다 사라진다 · WU-059 계약과 정합)
```
🟢 CPO §6 의 「state/lifecycle 로 처리 가능한지 조사」 → **가능하다. 영속 schema 불필요.**

## 6. system verdict / human verdict 분리 증거

```
system  row.crossSellerVerdict → tierDisplay      → [data-testid="gt-verdict"]
human   domesticReview[url]    → HUMAN_REVIEW_LABEL → [data-testid="gt-review-result"]
🔴 **다른 state · 다른 타입 · 다른 DOM 노드.** 서로 덮지 않는다.
🟢 마운트 DOM 으로 증명 — SAME 클릭 후 `gt-verdict`·`gt-price`·`gt-blockers` **문자열 동일**.
🟢 그리고 클릭이 `fetch` 를 **0회** 일으킨다(H5-c).
```

## 7. 실제 국내 후보 E2E

🟢 WU-063 이 **운영 경로로** 만든 표에서 `market === "KR"` 후보 **7건**
(§5-B CONTROL — 운영 `classifyCandidateMarket` 재현 mismatch **0/51**):

| id | 판매처 | 가격 | tier |
|---|---|---:|---|
| C07 | biskuit.kr | ₩88,000 | COMPARISON |
| C15 | m.web.mustit.co.kr | ₩226,000 | COMPARISON |
| C23 | littleluna.co.kr | ₩117,000 | COMPARISON |
| C24 | miniboutique.co.kr | ₩117,000 | COMPARISON |
| C28 | luksusbaby.kr | ₩73,000 | **EXCLUDED** |
| C32 | luksusbaby.kr | ₩122,000 | **EXCLUDED** |
| C47 | biskuit.kr | ₩258,000 | COMPARISON |

🔴 **`EXCLUDED` 도 구역에 선다** — §12 대로 정책을 바꾸지 않았다. 금액 집계에서만 빠지고
(WU-062 계약 그대로) **검토 대상으로는 보인다**.

## 8. Mutation H1~H6 (마운트 DOM · 캐시 아님)

baseline **10 passed**

| | 변형 | 결과 |
|---|---|---|
| M1 | 검토 UI 제거 | 🔴 **3 failed** |
| M2 | 「검토 결과:」 접두 제거 | 🔴 **1 failed** ← 🟡 **단언 강화 후** |
| M3 | 국내 필터 무력화(전부 국내) | 🔴 **3 failed** |
| M4 | 행을 **복제**(옮기지 않음) | 🔴 **2 failed** |
| M5 | `onReview` 미배선 | 🔴 **3 failed** |
| — | 원상복구 | 🟢 10 passed |

🔴 **M2 가 1차에서 통과했고 잡았다** — 단언이 값(`동일상품`)만 봐서 「검토 결과」라는
**말이 사라져도** 통과했다. 🟢 그 말이 없으면 시스템 판정과 구분이 안 되므로 강화했다.

## 9. 해외 regression

🟢 `wu-056r1-price-section-identity` · `mi-ux-final` · `wu-024` · `mi-022` 전부 통과.
해외 참고가격 구역(`OverseasReferencePrice`)은 **한 줄도 바꾸지 않았다**.

🔴 **회귀에서 1 failed 가 났고 이름을 포착했다**(§10):
```
mi-022-gemini-transient-ux › 「판매판정/국내 최저가 계산이 transient 값을 읽지 않는다」
🟢 **진짜 위반이 아니다** — 금지목록(sellerDecision·domesticCompetition…) 검사는 통과했고,
   「배선이 사라지지 않았는가」 앵커가 `evidence={geminiEvidence}` **문자열** 을 보고 있었다.
조치: 앵커를 갱신하고 **강화** 했다 — 이름 하나가 아니라 ⒜ `webRest` 의 유도식
      ⒝ `krRows` 의 유도식 ⒞ 국내 구역 변수가 **판정/집계 어휘와 같은 줄에 서지 않는지**.
```

## 10. Regression / typecheck / build

```
apps/admin  **591 files / 8,313 passed** / failed **0** (skipped 101)
typecheck **0** · build **exit 0**
🟢 WU-080 baseline(589/8,302)에서 **+2 file / +11 test**
```

## 11~12. Git / 운영 코드 변경량

```
GeminiTransientCandidates.tsx      약 +55줄 (타입 1 · 상수 2 · props 2 · 검토 블록)
DomesticPriceIntelligencePanel.tsx 약 +40줄 (state 1 · 핸들러 1 · 필터 4 · 구역 1)
🔴 MI 판정 0 · 가격 0 · 시장 0 · 집계 0 · API 0 · schema 0 · DB 0 · AI 0
```

## 13. Known Unknowns

```
① 🔴 `geminiEvidence` 는 flag OFF 라 **항상 null** 이다 — 실제로 보이는 경로는
   **셀러가 URL 을 직접 넣는 `urlCandidateEvidence`** 하나다(WU-024)
② 🔴 검토 결과는 **저장되지 않는다.** 새로고침하면 사라진다(의도 · §6)
③ 🔴 국내 7건은 **WU-063 표본** 이다. 전수 498 값이 아니다
④ 🟢 후보 URL 은 운영이 검증한 `discoveredUrl` 그대로다 — WU-075 가 도착지를 이미
   검증하므로 「링크를 열었더니 홈」인 후보는 애초에 행이 되지 않는다
⑤ 🔴 `EXCLUDED` 가 구역에 서는 것은 **정책 유지** 의 결과다 — 이번에 정하지 않았다
⑥ 🔴 CEO 실화면 확인 전이다 — **Production UI PASS 아님**
```

## 14. 🟢 **GO** (구현 · 배포 완료 · CEO 확인 1회 대기)

§16 GO 7조건 — ① 기존 구조 재사용 🟢 ② 실제 국내 후보 표시 🟢 ③ 가격/URL/evidence 가
운영 데이터와 일치 🟢 ④ Human/system 완전 분리 🟢 ⑤ 영향 0 🟢 ⑥ 해외 regression 0 🟢
⑦ typecheck/build/regression PASS 🟢

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     🔴 **CEO 확인 대기**
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        🟡 CEO 확인 후
```

## 15. CEO Action — **Production UI 1회 확인**

```
URL    https://ttaejyo.vercel.app/pipeline   (로그인 필요)
상품   국내 판매처가 있는 아동의류 상품 하나(예: Bobo Choses 티셔츠)

순서
 ① MI 패널에서 「🔄 다시 분석」 — 입력칸은 **2단 접힘 뒤** 에 있다(WU-049-R)
 ② 비교할 **국내 상품 URL** 을 붙여넣는다
      예) https://biskuit.kr/...   https://www.littleluna.co.kr/...
 ③ 「🔄 다시 분석」을 누른다

기대 결과
 🟢 **🇰🇷 국내 후보 검토** 구역이 선다 —
    판매처 · 상품명 · 가격(₩) · 가격 상태 · 우리 판단 · 보류 근거 ·
    「CEO 검토 [동일상품] [다른 상품]」
 🟢 상품명을 누르면 **그 판매처 페이지** 가 열린다
 🟢 [동일상품] 을 누르면 그 행에 **「검토 결과: ✅ 동일상품」** 이 뜬다
 🔴 그때 **우리 판단 · 가격 · 보류 근거가 하나도 바뀌지 않아야 한다**
 🔴 **판매판정 / 국내 최저가 / 등록 화면도 바뀌지 않아야 한다**
 🟢 해외 상품 URL 을 넣으면 그 후보는 **🔗 직접 입력한 후보** 구역에 서고
    **검토 버튼이 없다**(의도된 동작)

FAIL 로 볼 것
 🔴 같은 후보가 두 구역에 **중복** 으로 보인다
 🔴 [동일상품] 을 눌렀더니 「우리 판단」이 바뀐다
 🔴 국내 최저가 / 판매판정 숫자가 움직인다

🔴 검토 결과는 **저장되지 않습니다** — 새로고침하면 사라집니다(의도된 동작).
```
