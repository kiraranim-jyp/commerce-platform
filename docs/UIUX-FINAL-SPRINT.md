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
