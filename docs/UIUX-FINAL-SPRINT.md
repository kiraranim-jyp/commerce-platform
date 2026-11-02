# UI/UX FINAL SPRINT — **STEP 1 audit 완료 · STEP 2~7 은 조사 0 으로 착수 가능**

> 🔵 CPO LONG SPRINT 작업지시서 수령(2026-11-01). 🔴 **이 문서 하나만 읽고 STEP 2 로 들어간다.**
> 🔴 **STEP 1 은 지시서 §18 의 첫 단계이자 §18 STEP 6 이 「먼저 확인하라」고 명시한 선행조건** 이다.
> 🔴 그 조사가 **STEP 3·6·7 의 설계를 실제로 바꿨다** — 아래 둘을 읽기 «전» 에 코드를 쓰지 않는다.

---

## 🔴🔴🔴 0. STEP 1 이 찾은 것 둘 — **이것 때문에 지시서대로 구현하면 안 된다**

### ① 「최종 선택 가격」은 **이미 제품에 있다**(`priceOverrideKrw`)

지시서 §10 은 그것을 **「신규 핵심 UX」** 로 적었다. 🔴 **그대로 만들면 제품에 최종가가 둘이 된다.**

```
packages/shared/src/product-types.ts:442   priceOverrideKrw?: ProvenanceField<number>
packages/shared/src/master-product.ts:153  priceOverrideKrw: "SELLING"   ← 층이 **SOURCE 와 분리돼 있다**
apps/admin/.../PriceEditor.tsx:81          finalPriceKrw = priceOverrideKrw?.value ?? 권장가
apps/admin/.../PriceEditor.tsx:147         <ValueBadge kind="userConfirmed" />  ← 「셀러가 정했다」 표시
apps/admin/.../profitability.ts:48         「셀러가 확정한 값. 없으면 권장가로 폴백한다」
apps/admin/.../MarketPriceComparison.tsx:263 「`PriceEditor` 의 「최종 판매가격에 적용」(:158)과
                                              **같은 handler** 다」  ← 가격비교 영역에 **이미 배선돼 있다**
```

🟢 **그래서 지시서 §12·§22 의 요구가 «이미» 구조적으로 보장된다** — 고칠 것이 없다:
```
§12 candidate 원본 가격 변경 X · evidence 변경 X · price history 변경 X · MI 계산값 변경 X
  ⟹ `priceOverrideKrw` 는 **SELLING 층** 이고 candidate 가격은 **SOURCE 층** 이다.
     `master-product.ts:118` 이 「두 개를 같은 층에 두면 원본이 …」라고 **그 이유를 적어 뒀다**.
§13 저장 → 재진입 복원
  ⟹ `canonicalProduct` 안의 칸이므로 **`product_snapshots.workspace` 에 이미 저장·복원된다.**
     🔴 **새 migration·새 칸·새 테이블이 필요 없다.**
§22 M1·M2·M4 (원본가 ↔ 최종가 독립)
  ⟹ 층 분리로 **이미 성립** 한다. 🟢 계약으로 **잠그면** 되고 구현은 0 이다.
```

🔴🔴 **그러므로 STEP 6 의 실제 작업은 「새 가격 만들기」가 아니라 「이미 있는 owner 를 가격비교
영역에서 편집 가능하게 «노출» 하기」** 다. 🔴 새 state·새 저장 경로를 만들면 헌장 §8
(「ALREADY DONE — 재구현하면 하나인 것을 둘로 쪼갠다」)을 바로 위반한다.

🟡 **그런데 여기서 CPO 결정이 필요하다**(CTO 가 고르지 않았다):
```
현재 `PriceEditor` 는 **커머스 플랫폼 탭에만** 있다(`DomesticPriceIntelligencePanel.tsx:1868`
  주석이 「MI 패널과 PriceEditor 는 서로 다른 탭」이라고 적어 뒀다).
⟹ 가격비교 영역(§11)에 편집 UI 를 두면 **같은 한 값을 «두 화면» 에서 편집** 하게 된다.
⒜ 두 surface 가 같은 `priceOverrideKrw` 를 편집한다(값 하나 · 편집기 둘)
⒝ MI 영역은 **표시 + 「이 가격으로 확정」** 만(편집은 기존 탭 하나로 유지)
⒞ 편집기를 MI 영역으로 **옮긴다**(커머스 탭에서는 읽기)
🔴 ⒜ 는 「한 값에 owner 가 둘」로 읽힐 위험이 있고, 이 트랙이 **그 모양으로 여러 번 실패** 했다
   (START-HERE §0 「한 자리에 상태가 둘이면 상수도 둘이다」).
🔴 그리고 지시서 §17 이 **price policy 변경 금지** 라, 어느 쪽이든 CTO 가 임의로 못 고른다.
```

### ② 문제 1·2(「최초 진입에 안 보인다 · `[다시 분석]` 필요」)의 **구조는 이미 닫혀 있다**

🔴 지시서 §4 는 「버튼이 없어도 결과가 나오는 구조가 **먼저** 완성되어야 한다」고 했다.
🟢 **그 구조는 어제·오늘 배포됐다.** 실측 좌표:

```
최초 분석   page.tsx:529  `/check` 가 **isFirstInsert 블록 안에서 1회** 발화 →
            `setAutoCheckResult` → 패널 effect → 7개 evidence state → `rows` → 표시
            (WU-082 가 「응답을 버리고 있었다」를 고친 그 경로)
재진입      `?resume={id}` → GET `/api/price-history/{id}` → **`savedCandidateRows`** →
            `rows = anyEvidence ? live : saved` → 표시
            🔵 **이것이 `ef00d766`(오늘 13:33 UTC 배포)의 B-3 다**
`/check` 호출부는 **둘 뿐이고 재진입은 둘 다 안 탄다**:
            page.tsx:529  `isFirstInsert`                 ⟹ 재진입은 false
            page.tsx:305  `if (suppliedUrls.length > 0)`  ⟹ **북마크릿 전용**
```

🔴🔴 **그래서 CPO 가 본 화면이 «언제» 것인지가 STEP 2·3 의 범위를 가른다**:
```
⒜ `ef00d766` **이전** 화면이면 — 문제 1·2 는 **이미 수정됐을 수 있다** ⟹ STEP 2 는
   「구조 구현」이 아니라 **「실제 화면에서 확인」** 이고, STEP 3 은 그 확인 **뒤** 에 한다
⒝ `ef00d766` **이후** 화면인데도 비어 있었다면 — **B-3 가 화면까지 닿지 않는 것** 이고
   그것이 이 Sprint 의 **진짜 1순위** 다(원인 좌표는 아래 §1 에 미리 적어 뒀다)
🔴 제가 그것을 가를 수 없습니다 — **로그인 뒤 화면이고 CTO 는 볼 수 없다**
   (실측: `/pipeline?resume=` → **307 → /login** · GET → **401**)
```

🔴 **그래서 `[다시 분석]` 을 지금 제거하지 않았다.** §4 가 금지한 「버튼을 없애서 문제를 숨기는 것」이
정확히 그 모양이고, ⒝ 라면 버튼이 **유일한 탈출구** 인 상태에서 그것을 없애는 것이 된다.

---

## 1. STEP 2·3 이 ⒝ 였을 때 볼 좌표 — **조사 0 으로 바로 들어간다**

```
의심 순서(비용 낮은 것부터)
① `data?.savedCandidateRows` 가 패널에 **도달하는가** — GET 응답 → `setData` → memo deps
   좌표 `DomesticPriceIntelligencePanel.tsx` `marketComparisonInput` memo + deps 끝줄
② `rows` 가 **CommerceWorkspace 까지** 올라가는가 — `onMarketComparisonChange` →
   `marketComparison?.rows` (`CommerceWorkspace.tsx:3667`)
③ 영역 자체의 **탭 게이트** — `workSurface !== "CHANNEL"`(`CommerceWorkspace.tsx:3665`)
   🔴 WU-152 가 게이트를 `stageFocus.mi` → **탭** 으로 바꿨다. 상품정보 탭에서 MI 패널이
      HIDDEN 이어도 결론 영역은 서야 한다 — 그 둘이 갈린 자리다
④ 저장분이 **그 스냅샷에 있는가** — 운영 124행 중 `price_status` 보유 **1행** 뿐이다
   🔴 저장은 `OVERSEAS_AUTO`·`GEMINI`·`SELLER_URL` **세 생산자만** 이고
      `WEB_SEARCH`·`DOMESTIC_LISTING` 후보는 **애초에 저장되지 않는다** ⟹
      그 경로로만 후보가 나온 상품은 **재진입에 복원할 것이 없다**(= 빈 화면)
   🔵🔵 **이것이 ⒝ 의 가장 유력한 원인이다** — 확대는 `ReviewSource` **DB check
      constraint 변경** 이라 **CPO 결정** 이다(지시서 §17 범위 밖)
```

🟢 **운영 데이터로 이미 확인된 것**(fixture 아님 · 재조사 금지):
```
snapshot 6db15ecc (Hug Hairy Monster T-shirt · B226AC009)
  저장 4행 → 복원 4/4 → 화면 카드 4/4 · LIKELY 2 · PRESUMED 2
  🇰🇷 블록 YES · 🌎 블록 YES · `mi-same-row` 0 · 중복 URL 0 · 환산 0 · 금지 토큰 0
  카드 순서 = 이미지 → 판정 → 가격 → (검증 전) → 판매처 → 경고 → 선택 → 링크
⟹ 🟢 **복원 + 단일 surface + 카드 hierarchy 는 운영 데이터에서 성립한다**(지시서 §7 형태와 일치)
```

---

## 2. STEP 4·5 는 범위가 **지시서보다 좁다**(실측)

```
STEP 4 국내/해외 템플릿 통일
  🟢 **이미 `MarketBlock` 하나** 를 `(["KR","OVERSEAS"] as const).map` 으로 돈다
     (`MarketPriceComparison.tsx` · 전용 컴포넌트 0 · 카드 내 시장 분기 0 — 실측)
  ⟹ 🔴 「중복 component 를 만들지 않는다」는 **이미 지켜져 있다**. 남은 것은 **그 블록 안에
     「최종 선택 가격」 줄을 추가** 하는 것뿐이고, 그것이 §0-① 의 CPO 결정에 걸린다
STEP 5 텍스트 최소화
  🟢 카드 안은 **이미 정리돼 있다** — 운영 데이터 실측 카드 최대 **192자** ·
     raw enum/blocker code/score/similarity **0**(16종 토큰 전수 grep)
  🔴 그러므로 「텍스트가 많다」의 대상은 **카드가 아니라 카드 «밖»** 이다 —
     📊 영역의 요약·설명·접힘 머리글·`▸ MI 상세 분석`·판단 근거 블록
  🔵 3층(§14) 분류 대상 목록은 **STEP 5 착수 시 그 영역에서 세면 된다**(카드는 건드리지 않는다)
```

---

## 3. 🔴 착수 전 중단 조건 (다음 세션이 이것부터 본다)

```
[C-1 용량]  STEP 2~7 + DOM parity 10 + 변이 M1~M5 + 전체 회귀 **2회(각 ~7분)** +
            build 2회 + deploy 를 한 세션에 끝낼 수 없으면 **착수 금지**(§4-C).
            🔴 이 트랙은 그 판단을 늦게 해서 **세 번** 중단했고 한 번은 착수 후 revert 였다.
[C-2 정책]  §0-① 의 ⒜⒝⒞ 중 **CPO 가 고르기 전에는 STEP 6 을 구현하지 않는다**
            (한 값에 편집 owner 를 둘 만드는 것은 price policy 결정이다 · 지시서 §17).
[C-3 전제]  §0-② 의 ⒜/⒝ 가 갈리기 전에는 **`[다시 분석]` 을 제거하지 않는다**(§4 의 금지).
[C-4 범위]  §17 NO-TOUCH 중 하나라도 손대야 하면 STOP.
```

---

## 4. 지시서 ↔ 실측 대조표 (STEP 2~7 의 실제 범위)

| STEP | 지시서가 가정한 것 | 실측 | 실제 범위 |
|---|---|---|---|
| 2 자동 표시 | 구조를 만들어야 한다 | 🟢 **이미 배포됨**(`ef00d766`) | **화면 확인** → 안 되면 §1 ①~④ |
| 3 `[다시 분석]` 제거 | 제거한다 | 🟡 구조는 닫혔으나 **화면 미확인** | STEP 2 확인 **뒤** |
| 4 템플릿 통일 | 통일한다 | 🟢 **이미 `MarketBlock` 하나** | 「최종가 줄」 추가뿐 |
| 5 텍스트 최소화 | 카드 정리 | 🟢 카드는 정리됨(192자·토큰 0) | **카드 밖** 영역 |
| 6 최종가 editable | **신규 UX** | 🔴 **`priceOverrideKrw` 로 이미 존재** | **노출** · 🔴 CPO 결정 |
| 7 저장/재진입 | 저장 구조 필요 | 🟢 `canonicalProduct` 에 **이미 저장·복원** | 계약으로 **잠그기** |

🔴 **STEP 6·7 에서 새 칸·새 테이블·새 migration·새 state 를 만들지 않는다.**

---

## 5. 이번 세션에서 한 것 / 하지 않은 것

```
🟢 한 것 — STEP 1 전체 audit(운영 DB read-only · 코드 전수 추적) · 설계 정정 2건 발견
🔴 하지 않은 것 — 운영 코드 **0** · UI **0** · 테스트 **0** · schema **0** · migration **0** ·
   `[다시 분석]` 제거 **0** · 새 가격 개념 **0** · Discovery **0** · Identity/threshold/Search **0**
🟢 작업트리 clean · HEAD 불변
```

---

## 🟢🟢 실행 완료 기록 — **구현 전부 완료 · CEO 확인 1회만 남았다**(2026-11-02)

```
R2  배포 `f9e8c171`  STEP 4(CTA 제거) + STEP 7/8(최종 선택 가격)
S6  배포 `a3472e84`  STEP 6(카드 밖 텍스트 1,033 → 920자)
회귀 756 files / 9,900 passed · 0 failed · typecheck 0 · build 0 · clean · 0/0
```

### 🔴 CPO 가 닫은 결정 둘(2026-11-02) — 다시 열지 않는다

```
⒜ **최종 선택 가격은 `＋ 상세정보 보기` 안에 둔다**(현재 위치 유지)
   사유 — 1차에 올리면 가격 숫자가 넷(권장·국내·해외·최종)이 되어 **직관성이 떨어진다** ·
   최종가의 편집 owner 는 이미 `PriceEditor` 다 · 이번 Sprint 는 가격정책 변경이 아니다
   ⟹ 🔴 CTO 가 보고한 「접힘 안에 있다」는 **버그가 아니라 선택사항** 이다(CPO 문장)
⒝ 외화 후보는 **확정 불가** · 환산 신규 도입 **❌** — 「원화 후보에서만 확정할 수
   있습니다」를 적고, 최종 KRW 는 기존 `PriceEditor` 에서 수정한다
```

### 🔴 STEP 6 에서 **자르지 않은 것과 이유**(다음 사람이 다시 묻지 않게)

```
MI_SAME_AREA_SCOPE (95자)  2026-09-19 사고를 막는 문장 · **이미 상세 안**
unresolvedNote     (77자)  「확인 못 한 후보가 어디 있는가」 — 빼면 후보가 사라진 것으로 읽힌다
marketDecisionLines        WU-146 상태 기계(판정·가격 문장) ⟹ §5 금지
「MI 상세 분석」            이미 **8자** 다 · 이름을 바꾸면 계약 **9파일** + 그 라벨을
                           글자로 가리키는 문장 **2개** 가 깨진다 ⟹ 0자 이득 · **유지**
                           🟢 CPO 도 「얻는 것이 거의 없고 계약 리스크만 크다」로 확정
```

### 🟡 알려진 한계 — **CPO 가 범위 밖으로 판정했다**

```
🔴 저장되는 생산자가 **셋** 이다(실측 `OVERSEAS_AUTO` 103 · `GT_IMPORT` 17 · `SELLER_URL` 4)
   ⟹ `WEB_SEARCH`·`DOMESTIC_LISTING` 로만 나온 후보는 **재진입 복원 대상이 아니다**
   ⟹ 재진입 후보 수가 최초 분석보다 **적을 수 있다**
   🔴 확대는 `ReviewSource` **DB check constraint 변경** 이라 이번 범위 밖이다
🔴 `price_status` 보유 운영 행이 **1건** ⟹ **P1 의 운영 분모가 1** 이다(나머지는 P2 가 정상)
🔴 `sold_out` 운영 분모 **0**(124행 전건 null)
🔴 실제 화면은 CTO 가 볼 수 없다(`/pipeline` → 307 → /login) ⟹ 최종 판정은 **CEO**
```

🟡 **CEO Action — `docs/START-HERE.md` §18 ⑤항**(테스트 URL·상품·순서·예상결과 + 거짓경보 5).
🔴 그 확인이 PASS 면 **UI/UX Sprint CLOSED** 이고 **추가 UI/UX WU 를 만들지 않는다.**
🔴 Sprint 3(Discovery)는 **CPO 가 별도로 GO** 를 결정한다 — CTO 가 선제 설계하지 않는다.

---

## 🔵🔵🔵 CLOSE-3 착수점 — **구현은 검증됐고, 남은 것은 계약 범위 조정 17건**

🔴 **다시 조사하지 않는다.** 아래가 전부다. 코드는 한 번 구현해 **typecheck 0** 까지 통과했고
그 뒤 전체 회귀가 **계약 범위 문제** 를 드러내 되돌렸다(작업트리 clean 유지).

### 🟢 1. 구현 — 이미 검증된 모양(그대로 다시 쓰면 된다)

```
`MarketPriceComparison.tsx`
  import  { formatKrw, convertToKrwStrict } from "@commerce/pricing"
  카드 가격 줄 **바로 아래** 에 추가(원본 줄은 한 글자도 안 바꾼다):
    row.priceAmount != null && row.priceCurrency && row.priceCurrency !== "KRW"
      → convertToKrwStrict(row.priceAmount, row.priceCurrency)
          있으면  <p data-testid="mi-candidate-price-krw">약 ₩XX,XXX</p>
          null    <p data-testid="mi-candidate-price-krw-unavailable">원화 환산 불가</p>
  확정 CTA — KRW 는 원값 · 외화는 `?.amountKrw`, **null 이면 버튼 대신 안내문**
`recommended-price-copy.ts`
  CANDIDATE_PRICE_KRW_PREFIX = "약 " · CANDIDATE_PRICE_KRW_UNAVAILABLE = "원화 환산 불가"
  CONFIRM_PRICE_NO_RATE_NOTE = "환율 정보가 없어 확정할 수 없습니다"
  🔴 `CONFIRM_PRICE_FOREIGN_NOTE` 는 **폐기** 지만 상수는 남긴다(소비처 0 · 결정 이력)
`CommerceWorkspace.tsx`  🟢 **변경 0** — R2 에서 이미 세 prop 을 넘긴다
```

### 🔴🔴 2. 진짜 작업 — **계약 «범위» 조정 17건 / 12파일**

🔴🔴 **범위를 카드로 좁혀도 이 숫자가 줄지 않는다 — 이유를 적는다:**
```
그 계약들은 `container.textContent`(= **영역 전체**)를 읽는다. 카드는 그 영역 «안» 에
있으므로, 카드에만 환산을 그려도 **그 텍스트에 잡힌다**.
🔴 그리고 일부는 **개수** 계약이다(「금액 owner 는 하나 · ₩ N개」) ⟹ 환산 줄이
   그 count 를 올린다.
```

🟢 **그래서 고치는 방법은 «뜻 반전» 이 아니라 «범위 명시» 다**(약화 0 · WU-148 의미 보존):
```ts
/** 🔵 CLOSE-3 — 환산은 **후보 카드 안에서만** 허용된다(CPO LOCK ②).
 *  🔴 그래서 이 단언의 분모에서 카드를 «뺀다» — 집계/요약 영역의 환산 금지는 **그대로** 다. */
const clone = container.cloneNode(true) as HTMLElement;
for (const c of [...clone.querySelectorAll('[data-testid="mi-candidate-row"]')]) c.remove();
const text = (clone.textContent ?? "").replace(/\s+/g, " ");   // ← 이것으로 기존 단언을 그대로 돌린다
```
🔴 **금지 목록을 줄이거나 단언을 지워서 PASS 시키지 않는다** — 분모만 바꾼다.

### 🔴 3. 대상 파일 · 단언 수(실측 grep)

```
core-2e-price-purpose 3 · wu-141-r3-price-owner 2 · wu-144-seller-decision-e2e 2 ·
wu-145-seller-decision-screen 2 · wu-146-seller-decision-contract 2 ·
wu-148-market-price-signal 2 · core-2s-seller-screen 1 · core-2v-seller-reading-order 1 ·
core-2w-price-qualification 1 · core-next-step4-recommended-price 1
+ core-2ao-r1-screen-dump(「약 ₩」 금지 목록) · wu-132-mi-same-price-comparison
+ 🟢 내 파일 둘은 **방향 전환** 이다(범위 조정 아님) —
  `r2-final-price-and-cta`(R2-C-2 외화 확정 허용 · R2-D-1/D-3 환산 어휘 허용) ·
  `ux04-b3-restore-render`(⒞-3 의 DATA_DEPENDENT 에 `mi-candidate-price-krw` 추가)
```

### 🔴 4. 변이 M1~M6(지시서 §10) — 설계 확정

```
M1 환산값을 `row.priceAmount` 에 대입            → 원본 줄 단언이 FAIL 해야 한다
M2 `convertToKrw`(비-strict)로 바꿔 모르는 통화에 숫자 생성 → 「환산 불가」 단언 FAIL
M3 외화 확정에 `row.priceAmount` 를 그대로 전달    → R2-D-3 FAIL
M4 환산값을 `buildPriceGuide`/집계 입력에 전달      → 집계 불변 단언 FAIL
M5 시장별 전용 카드 분기 추가                      → parity 단언 FAIL
M6 확정 후 후보 row 를 mutate                      → source 불변 단언 FAIL
```

### 🟡 5. 왜 이 세션에서 끝내지 않았는가(§4-C)

🔴 이 세션은 B-3 스프린트 · Sprint-2 Audit · CPO 2차 검증 · R2 · STEP 6 · CLOSE-2 를
연속으로 돌렸고 **전체 회귀 6회**(각 ~6분)를 포함했다. 남은 용량으로 **12파일 / 17단언 +
회귀 2회 + build + deploy** 를 끝까지 갈 수 없다 ⟹ 착수하면 **배선 절반에서 끊긴다**.
🟢 그래서 **clean 으로 멈췄다**(배포 `a3472e84` 영향 0) — §4-C 가 「가장 나쁘다」고 적은
상태를 만들지 않았다. 🔴 다음 세션은 위 1~4 로 **조사 0** 에서 시작한다.

---

## 🔴🔴🔴 FINAL UX REBUILD — CEO 화면 NO-GO · 착수점(2026-11-02)

🔴 **CPO 판정: NO-GO.** 기술은 `8f83ab1` 로 PASS 지만 **제품 화면이 우리가 정한 제품이 아니다.**
🔴 다음 세션은 **이 절만 읽고 착수한다.** 아래 ②를 **먼저** 읽지 않으면 엉뚱한 층을 판다.

### ① CEO 가 연 화면의 사실 — 실측(추측 0)

```
URL  /pipeline?resume=**79a09cfb**-5e0c-4cc4-a8b5-349d89a603f7
🔴 §18 이 준비한 상품은 **6db15ecc**(후보 4 · 🇰🇷1 + 🌎3) 였는데 **다른 스냅샷** 이 열렸다.
🔴 그 스냅샷의 저장 후보는 **정확히 1건** 이다(운영 DB 실측):
   junioredition.com · GBP 37 · market=OVERSEAS · verdict=SAME · tier=EXACT
   ⟹ **국내 후보 0 · 해외 후보 1.** 「국내가 비어 있다」는 **그 상품의 데이터 사실** 이다
```

### ② 🔴🔴 **정정 — 「복원 계약이 성립하지 않는다」는 사실이 아니다**

```
🟢 복원은 **성립했다.** 그 화면에 실제로 떠 있는 것들이 전부 복원 산출이다:
   · 「최저 확인가 GBP 37」      · 판매처 표의 `junioredition.com` / GBP 37
   · 「해외 소싱 후보 1곳」       · 「최종 선택 가격 ₩92,000 · 선택됨」(priceOverrideKrw 복원)
🔴 안 보이는 것은 **후보 «카드»** 이고, 이유는 복원 실패가 아니라 **접힘 2겹** 이다:
   `MarketPriceComparison.tsx:700`  <details data-testid="price-detail-fold">   ← 1겹
   `MarketPriceComparison.tsx:1693` <details data-testid="mi-candidate-list">   ← 2겹
   ⟹ 카드가 **두 번 펼쳐야** 보인다. 첫 화면에서 보이지 않는 것이 당연하다.
🔴🔴 **그러므로 「B-3 복원을 다시 디버그」하지 않는다** — 고칠 층은 **배치/접힘** 이다.
   (복원 경로는 계약 B3-01~B3-10 + 운영 데이터 E2E 로 이미 잠겨 있다)
```

### ③ 🟢 CPO 지적 중 **전적으로 타당한 것**(이것이 진짜 작업이다)

```
🔴 정보 우선순위가 뒤집혀 있다 — 설명·진단이 먼저 오고 의사결정 정보가 묻힌다
🔴 첫 화면이 「가격 분석 · 판매 판단 · 가격 판단 기준 · MI 상세 분석 · 판매처·가격 근거 …」
   로 거의 같은 중요도로 나열된다 ⟹ 「어디서 얼마에 사면 되는가」가 **한눈에 안 보인다**
🔴 후보 카드가 2겹 접힘 뒤 ⟹ 「판단 → 가격 → 후보 선택 → 근거」 흐름이 **작동하지 않는다**
```

### ④ 목표 화면(CPO 확정 · 그대로 구현한다)

```
상품명 → 상품 판단(🟢) → 소싱 가격[국내 | 해외 2열 · 최저가 · 약 ₩ · 판매처 N개 · [후보 보기]]
→ 추천 판매가 + [가격 수정] [이 가격으로 확정] → ▼ 판매처/근거 확인(접힘)

후보 카드(열었을 때만)
  🟢 동일상품 가능성 높음 / GBP 37 / 약 ₩64,380 / [이 가격으로 확정] / 판매처 / ▼ 근거 확인
  🔴 matchReasons · blockers · 내부 판정 문구는 **기본 화면에서 제거**(근거 안으로)
```

### ⑤ 🔴 착수 전 반드시 볼 것

```
[1] 접힘 2겹을 푸는 것이 **첫 수** 다 — 단 `mi-candidate-list` 의 `open` 금지는
    **WU-091 불변식**(펼치면 「유력 후보」로 읽힌다 · 2026-09-19 사고)이다.
    ⟹ 🔴 `open` 을 붙이지 말고 **카드를 접힘 «밖» 으로 옮기거나** 요약(최저가·판매처 수·
       [후보 보기])을 1차로 올리는 쪽으로 설계한다. CPO 목표 화면이 정확히 그 모양이다.
[2] 검증 상품은 **6db15ecc**(🇰🇷1+🌎3)를 쓴다 — 79a09cfb 는 후보 1건이라
    「비교 화면」을 증명할 수 없다(분모 부족).
[3] PASS 기준이 바뀌었다 — **실제 mounted DOM 에 `mi-candidate-row` 가 있어야** PASS.
    「DB 에 있다」를 PASS 근거로 쓰지 않는다.
[4] 금지 — 새 기능 · Discovery · 기존 화면에 문구 «추가» · Identity/Search/가격정책 변경
[5] 🔴 건드리면 깨지는 계약이 많다 — 1차/상세 배치는 `core-2ao-r1`·`core-2v`·`wu-146`
    등이 「긴 설명은 1차에 없다 / 상세에 있다」를 **양방향** 으로 물고 있다.
    ⟹ 배치를 바꾸면 그 계약들의 **분모(1차 ↔ 상세)** 를 같이 갱신해야 한다.
```

### ⑥ 🔵🔵 새 계약축 — **「존재」가 아니라 «노출»을 잰다**(CPO 확정 2026-11-02)

🔴 이 트랙이 **기술 PASS / 화면 FAIL** 을 **세 번** 낸 구조적 원인이다. 내 계약은
노드가 **있는지** 는 쟀지만 **몇 겹 뒤에 있는지** 를 재지 않았다 — 그 사이에
**배치/접힘** 이라는 층이 있고 CEO 가 보는 것은 그 층이다.

```
기존(유지)  데이터 존재 · DOM mounted · 후보 카드 존재
🔵 신규     ⒜ **접힘 깊이**            카드의 조상 `<details>` 수 == 기대값
            ⒝ **1차 화면 노출 여부**   `price-detail-fold` **밖** 에 무엇이 서는가
            ⒞ **의사결정 정보 우선순위** 판단 → 가격 → 후보수 → 확정 **순서**
            ⒟ **국내/해외 구조 대칭**   두 칸의 testid 척추가 **순서까지** 같다
```

🟢 **구현 힌트(조사 0)** — 깊이는 마운트 DOM 에서 바로 잴 수 있다:
```ts
const depth = (el: Element) => { let d = 0, p = el.parentElement;
  while (p) { if (p.tagName.toLowerCase() === "details") d++; p = p.parentElement; } return d; };
expect(depth(card)).toBeLessThanOrEqual(1);   // 🔴 지금은 2 다
```
🔴 그리고 **1차 노출** 은 `price-detail-fold` 를 **제거한 clone** 의 textContent 로 잰다
(CLOSE-3 이 쓴 「분모 분리」와 **같은 기법** · 새 패턴 0).

### ⑦ 🟡 고정된 운영 상태(다음 세션이 그대로 쓴다)

```
UI/UX FINAL SPRINT  **NO-GO**        B-3 복원      **PASS**(다시 파지 않는다)
운영 코드           변경 없음         배포          `8f83ab1` 유지
Sprint 3 Discovery  **대기**          검증 상품     **6db15ecc** 고정
다음                **FINAL UX REBUILD 1회 LONG SPRINT**
```
🔴 **「계약 PASS」를 제품 PASS 로 쓰지 않는다** — 「첫 화면에 무엇이 보이는가」가
**별도의 CPO/CEO acceptance 기준** 으로 들어왔다(CPO 확정).

### ⑧ 🟢 Blast Radius 실측 — **착수 전에 쟀다**(2026-11-02 · 코드 변경 0)

```
1차/상세 경계를 «양방향» 으로 무는 계약 — **4 파일**(14 가 아니다 · 생각보다 좁다)
  core-2ao-r1-screen-dump · core-2r5-domestic-reference-to-mi ·
  core-next-step4-recommended-price · core-ux-seller-01-decision-order
  🔴 배치를 바꾸면 이 넷의 **분모(`firstScreen()` · `MUST_NOT_BE_ON_FIRST_SCREEN`)** 가
     같이 바뀐다 — 후보 카드를 1차로 올리면 `mi-candidate-warning`(「⚠ 확인 필요」)도
     **같이 1차로 올라간다**. 그 문구가 「긴 설명 금지」 목록과 충돌하는지 먼저 본다.
🟢 그래서 작업 단위 = 배치 이동 + **계약 4파일 분모 갱신** + 신규 계약 10(§7-3) +
   변이 7(§7-4) + 회귀 2회 + build + deploy.
```

---

## 🟢🟢🟢 FINAL UX REBUILD — **실행 완료 기록**(2026-11-02 · 운영 2파일 + 계약 4파일)

🔴 **다시 조사하지 않는다.** 남은 것은 **CEO 화면 확인 1회** 다(§⑨).

### ① 🔴🔴 먼저 — **접힘 깊이가 2 가 아니라 «3» 이었다**(실측 정정)

위 ②는 `price-detail-fold`(:700) + `mi-candidate-list`(:1693) **둘** 을 셌다. 🔴 그 사이에
**`mi-detail-fold`(:1070)가 하나 더** 있었다 ⟹ 셀러는 후보 카드를 보려고 **세 번** 펼쳐야 했다.
🟢 그래서 **새 계약이 깊이를 숫자로 재고**(`UXR-D-1`) 지금은 **정확히 1** 이다.

```
전  price-detail-fold → mi-detail-fold → mi-candidate-list → 카드    (깊이 3)
후  mi-candidate-list → 카드                                        (깊이 1)
🔴 `mi-candidate-list` 에 `open` 을 **붙이지 않았다**(WU-091 ① · 2026-09-19 기전) ⟹
   1차에 서는 것은 **「후보 N곳」 요약 한 줄** 이고 그것이 CPO 목표 화면의 `[후보 보기]` 다
```

### ② 🟢 구현 — **이동뿐이다**(새 기능 0 · Discovery 0 · 가격정책 0)

```
I1 1차 순서 재배치   판매판단 → **소싱 가격** → **후보 칸** → 추천 판매가 + 확정 → ⓘ → ▼ 상세
   🔴 CPO ④ 가 `market-next-step`(추천가)을 `market-blocks`(소싱가) **뒤** 로 옮겼다 —
      CORE-UX-SELLER-01 의 「② 권장가 → ③ 근거」가 **그 반대** 였다(방향 전환 · 약화 0)
I2 후보 격자 승격    `MarketColumn` ×2 를 `mi-detail-fold` «밖 · 격자 밖» 으로 들어 올렸다
   🟢 JSX·props·순서·testid 를 **한 글자도** 바꾸지 않았다(순수 이동)
I3 설명/제외/최종가  `mi-same-empty` · `mi-same-excluded` · `market-final-price` 를
   **상세 근거 블록**(`MarketBlock` `variant="DETAIL"`)으로 옮겼다
   🔴 **CPO LOCK ⒜ 를 지켰다** — 최종 선택 가격은 상세 안이다(1차에 올리면 가격 숫자가 넷)
   🟢 `market-final-price`·`market-edit-final-price` **개수 2 가 그대로** 다(계약 R2 유지)
I4 카드 안 근거      `mi-candidate-warning` 을 `mi-candidate-evidence` **접힘 안** 으로
   🔴 CPO ④ 「blockers · 내부 판정 문구는 기본 화면에서 제거(근거 안으로)」
   🔴 경고가 없으면 **접힘이 서지 않는다**(빈 틀 금지) · `open` 금지
```

🔴 **하지 «않은» 것** — ⒜ 「[가격 수정]」을 1차에 **추가하지 않았다**(CPO ④ 목업에는 있지만
`market-edit-final-price` 를 1차에 더하면 **한 값에 편집 입구가 셋** 이 되고 계약 R2 의 개수 2 가
깨진다 ⟹ LOCK ⒜ 와 충돌한다. **CPO 판정 사안으로 남긴다**) ⒝ MI 판정·threshold·8축·집계·
환산·Discovery·Registry·DB·schema **전부 0**.

### ③ 🟢 새 계약축 — **「존재」가 아니라 «노출» 을 잰다**(신규 1파일 · 12건)

`__tests__/core-ux-rebuild-01-exposure-depth.test.ts` — 입력은 **운영 `candidate_reviews`
실덤프**(`ux04-b3-reviews.json` · 두 시장 둘 다).

```
⒜ 접힘 깊이   UXR-D-1 카드 조상 `<details>` == **1**(2+ 도 0 도 FAIL) · D-2 그 조상이
              `mi-candidate-list` 다 · D-3 `open` 금지
⒝ 1차 노출    UXR-F-1 후보 요약이 1차에 선다 · F-2 두 시장 둘 다 · F-3 **최종가는 1차 0 ·
              전체 2**(LOCK ⒜) · F-4 설명문 1차 0 · 전체 ≥1(이동이지 삭제가 아니다)
⒞ 우선순위    UXR-O-1 **일곱의 전순서** · O-2 후보 칸이 상세 접힘보다 앞
⒟ 대칭        UXR-S-1 두 칸 척추가 순서까지 같다
카드          UXR-C-1 경고는 `mi-candidate-evidence` 안에만 · C-2 빈 틀 0 · `open` 0
🔴 1차 노출 축은 `price-detail-fold` **만** 제거한 clone 으로 잰다 — 기존 `firstScreen()`
   (닫힌 details 전부 제거)은 접힘의 `summary` 까지 지워 「요약이 1차에 보인다」를 **못 잰다**
```

### ④ 🔴 기존 계약 **3파일 분모/방향 갱신** — 약화 0

```
core-2r5     1차 층 슬라이스에서 **후보 구역을 걷어낸다**(CLOSE-3 의 「분모 분리」 기법 ·
             숫자 `1` 은 그대로) + 순서 단언 **방향 전환**(blocks < next-step)
             🔴 분모도 같이 잠갔다 — 후보 구역을 못 걷어내면 FAIL 한다
core-ux-01   UX-01-a **다섯 → 여섯** 의 새 전순서(항목이 늘었다 · 여전히 엄격)
ux04-b3      `mi-candidate-evidence` 를 `DATA_DEPENDENT` 에 더했다(경고와 **같은 데이터 조건**)
🔴 **예상보다 좁았다** — Blast Radius 실측은 4파일이었고 실제 FAIL 은 **3파일 3건** 이다
   (`core-2ao-r1`·`core-next-step4` 는 **한 건도 깨지지 않았다**)
```

### ⑤ 🟢 음성 대조 **M1~M7 전부 FAIL → md5 바이트 복구**

```
M1 격자를 상세 접힘 안으로 되돌림        **5 FAIL**
M2 `mi-candidate-list` 에 `open`         1 FAIL
M3 최종가의 `!isSummary` 게이트 제거      1 FAIL
M4 설명문을 1차 후보 칸으로 되돌림        1 FAIL
M5 1차 순서 되돌림(추천가 → 소싱가)      **3 FAIL**(신규 1 + 기존 2)
M6 카드 근거 접힘 제거(경고 직접 노출)    1 FAIL
M7 경고 없어도 접힘 렌더(빈 틀)          1 FAIL
🟢 복구 md5 `39b4f999cf27e88943c9336249ddf0b3` — **적용 확인 마커를 매 변이마다** 찍었다
   (「적용 실패」를 「통과」로 읽은 과거 함정 · WU-134/140)
```

### ⑥ 🟢 측정

```
회귀 **757 files / 9,913 passed · 0 failed**(기준선 756/9,901 → **+1 파일 +12 건** = 신규 계약)
typecheck **0** · build **exit 0**
```

### ⑦ 🔴🔴 측정불가 / 한계 — 넘겨 읽지 않는다

```
⒜ 🔴 **실제 따져 화면은 CTO 가 볼 수 없다**(`/pipeline` → 307 → /login) ⟹ 위는 전부
   **마운트 DOM 축** 이다. 「Production UI PASS」로 적지 않는다 — **CEO 1회로만** 닫힌다
⒝ 🔴 표본은 운영 덤프 **하나**(`ux04-b3-reviews.json`) 다 — 「모든 상품에서 깊이 1」이
   아니라 「그 입력에서 전건 1」이다
⒞ 🔴 `price_status` 보유 운영 행이 **1건** · `sold_out` 분모 **0** 은 그대로다(P2 가 정상)
⒟ 🔴 저장 생산자가 **셋** 이라 재진입 후보 수가 최초보다 적을 수 있다 — **범위 밖**(CPO)
⒠ 🔴 「[가격 수정] 1차 배치」는 **구현하지 않았다**(위 ② 🔴⒜ · CPO 판정 사안)
```

---

## 🟢🟢🟢 PRICE & CANDIDATE UX FINAL FIX — **실행 완료 기록**(2026-11-02 · 운영 2파일)

### ⓪ 🔴🔴 **먼저 — `6db15ecc` 를 운영 DB 로 실제로 깠다**(§1 · 쓰기 0)

```
snapshot 6db15ecc  title "Hug Hairy Monster T-shirt" · status IN_PROGRESS
  🔴 priceOverrideKrw = **null**        ← 그 상품은 **최종가를 아직 고른 적이 없다**
  🟢 원상품 가격 EUR 40 (ORIGINAL)
candidate_reviews **4행** — 🇰🇷 **1** · 🌎 **3**  ⟹ 🟢 **지시서 기대와 정확히 일치**
  🇰🇷 miniboutique.co.kr   KRW 88,000 · PRESUMED_SAME · COMPARISON · SELLER_URL
  🌎 junioredition.com     GBP 37     · SAME         · EXACT      · OVERSEAS_AUTO
  🌎 villagekids.co.uk     GBP 21.2   · PRESUMED_SAME · COMPARISON · OVERSEAS_AUTO
  🌎 global.trenbe.com     USD 80     · SAME         · EXACT      · SELLER_URL
  🔴 price_status **전건 null** · image_url **전건 null** · sold_out **전건 null**
```

🔴🔴 **그래서 §12 분기는 A 가 아니다** — 데이터는 **전부 있다**. 분기 **C+D**(가격 «표시» ·
정보 우선순위)로 확정했고, **DB·복원 경로는 한 줄도 건드리지 않았다.**

🟢 **그리고 `79a09cfb` 와의 차이가 숫자로 갈렸다**(§2):
```
79a09cfb  후보 **1**(해외) · priceOverrideKrw **92,000 USER_EDITED** · price_status VERIFIED_CURRENT
   ⟹ CEO 캡처의 「최종 선택 가격 ₩92,000 ✓선택됨」은 **복원 산출이고 정상** 이다
🔴 그 스냅샷의 「국내 0」을 후보군 회귀 증거로 **쓰지 않았다**(§2 그대로)
```

### ① 🟢 구현 — **표시/배치만**(§11 금지 전수 준수)

```
P1 해외 1차 소싱가에 **원 통화 + 약 ₩ 환산 병기**
   🔴🔴 **CORE-2E §4-4 가 보류해 둔 그 줄이다.** 그때 막은 둘을 지시서 §4 가 풀었다 —
      ⒜ `convertToKrwStrict`(모르는 통화 → **숫자를 만들지 않는다**) ⒝ 「원화 환산 불가」
   🔴 국내에는 그리지 않는다(같은 숫자 두 번) · **통화가 섞이면 만들지 않는다**(WU-148)
   🔴 집계·FX 정책 **변경 0** — `buildPriceGuide`/`byCurrency` 는 이 값을 **읽지 않는다**
P2 1차에 **[가격 수정 →]**(`market-edit-price-link`)
   🔴 **새 편집기 0** — `onOpenPriceEditor` 는 상세의 것과 **같은 함수**(owner `PriceEditor` 하나)
   🔴 `market-edit-final-price` 를 **쓰지 않았다** — 그 testid 는 「두 시장에 같은 구조」(개수 **2**)
      를 뜻한다 ⟹ 1차의 단일 진입점과 **축이 다르다**(계약 R2 개수 2 **불변**)
P3 후보 요약에 **행동** 을 적는다 — 「… N곳 · **후보 보기**」(`mi-candidate-list-hint`)
   🔴 `open` 은 붙이지 않는다(WU-091 ①) — 바뀐 것은 **말** 뿐이다
```

### ② 🔴 기존 계약 **4파일 방향/분모 갱신** — 약화 0

```
core-2e-price-purpose D-1   🔴🔴 **방향 전환** — 그 줄이 CORE-2E §4-4 의 「되돌렸다」를
   고정하고 있었다. 🟢 지금은 **더 세게** 문다 — ⒜ 환산은 **그 줄 하나** ⒝ 그 줄을 빼면
   블록에 `₩` 가 **여전히 0**(다른 자리로 새지 않았다)
core-2v D-3 · core-2w W-14 · wu-141-r3 C-1-b  **분모에 환산 줄 하나를 더 뺀다**
   (CLOSE-3 이 카드에 쓴 「분모 분리」와 **같은 기법** · 금지 문구는 글자 그대로 남는다)
```

### ③ 🟢 신규 계약 **12**(`core-ux-rebuild-02-price-candidate.test.ts`)

```
⒜ 가격  PX-A-1 원 통화 + 환산 병기(기대값은 **운영 함수** 로 만든다) ·
        A-2 국내엔 환산 0 · A-3 **통화 혼합이면 환산 0** · A-4 **모르는 통화 → 숫자 0 + 사유**
⒜-2 최종가  PX-B-1 1차 [가격 수정] · B-2 핸들러 없으면 0 · B-3 **같은 핸들러**(1차 ↔ 상세) ·
        B-4 `market-edit-final-price` **2 불변** · B-5 1차 `₩` 개수
⒝ 후보  PX-C-1 건수 + 행동 · C-2 `open` 0 · C-3 카드가 **쓸 수 있는 상태**(판정·가격·판매처·확정) ·
        C-4 외화 카드는 원 통화 + 환산
```

### ④ 🟢 음성 대조 — **전부 FAIL → md5 바이트 복구**

```
M3 외화 원가격을 KRW owner 로 직접      1 FAIL
M4 **하드코딩 환율**(strict 우회)        2 FAIL
M5 해외 환산 표시 제거                  2 FAIL
M8 「후보 보기」 행동 제거               1 FAIL
M9 1차 [가격 수정] 제거                 2 FAIL
M10 국내/해외 대칭 파괴                 3 FAIL
🟢 복구 md5 `432245d7ea9d0a76fb23b94b2767409b`
🔴 **M8 이 1차에 「적용되지 않은 채 25 passed」로 나왔다** — perl 패턴이 안 맞았다.
   🟢 적용 확인 마커가 그것을 잡았고 다시 돌려 **1 FAIL** 을 얻었다(그 함정의 재발 방지).
```

### ⑤ 🟢 측정

```
회귀 **758 files / 9,926 passed · 0 failed**(직전 757/9,913 → +1 파일 +13 건 = 신규 계약)
typecheck **0** · build **exit 0**
🔴 DB·schema·migration·복원 경로·FX 정책·집계 정책 **변경 0**
```

### ⑥ 🔴🔴 측정불가 / 한계 — 넘겨 읽지 않는다

```
⒜ 🔴 **6db15ecc 의 해외는 통화가 둘(GBP·USD)** 이라 1차 환산 줄이 **서지 않는다** —
   「최저가를 하나로 고를 수 없다」는 WU-148 정책의 귀결이다(결함이 아니다).
   🟢 그 상품에서 환산은 **후보 카드마다** 보인다(CLOSE-3).
⒝ 🔴 운영 덤프 `ux04-b3-reviews.json` 만으로는 1차 가격 가이드를 세울 수 없다
   (해외 행이 거의 `PRESUMED_SAME · COMPARISON`) ⟹ **그 축에서만** 리포의 기존 빌더를 썼다.
⒞ 🔴🔴 **거짓 입력을 환산이 «증폭» 한다** — 덤프에 `GBP 30,200` 같은 행이 있고 화면이
   「약 ₩52,548,000」을 적는다. 🔴 그것은 **환산의 결함이 아니라 그 행의 가격/통화 문제** 다.
   §11 이 가격 적격성 정책 변경을 금지하므로 **고치지 않았다** — CPO 판정 사안으로 올린다.
⒟ 🔴 `price_status` 전건 null ⟹ 6db15ecc 후보는 **전부 P2**(「상세 검증 전」)가 정상
⒠ 🔴 실제 따져 화면은 CTO 가 볼 수 없다 ⟹ 위는 **운영 DB + 마운트 DOM** 이다
```

### ⑦ 🟡 **CEO Action — 화면 1회**



```
URL   /pipeline?resume=6db15ecc-7aa8-4589-b7d7-04375c25679e   (🇰🇷1 + 🌎3)
질문  「추가 설명 없이 **어디가 동일상품이고 얼마이며 어느 판매처를 선택하고 얼마를
       확정하면 되는지** 가 바로 이해되는가?」
보여야 할 순서 — 판매 판단 → 소싱 가격(🇰🇷 | 🌎) → 「🇰🇷/🌎 후보 N곳」 → 추천 판매가 +
       [최종 판매가격에 적용] → ⓘ → ＋ 상세정보 보기
🔴 거짓 경보(정상이다) — ⒜ 후보 카드는 **한 번 펼쳐야** 보인다(펼쳐 두면 「유력 후보」로
   읽히는 2026-09-19 사고 방지) ⒝ 「최종 선택 가격」은 **＋ 상세정보 보기 안** 이다
   (CPO LOCK ⒜) ⒞ 후보가 전부 「상세 검증 전」로 보이는 것은 기존 상품에서 정상
   ⒟ 재진입 후보 수가 최초보다 적을 수 있다(저장 생산자 셋 · 범위 밖)
```
