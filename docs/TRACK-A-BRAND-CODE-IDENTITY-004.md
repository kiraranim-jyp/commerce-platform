# WU-004 `TRACK-A-BRAND-CODE-IDENTITY` — 브랜드 품번 증거 확장

> 🔴 **Gemini 0 · 외부 Search API 0 · 외부 HTTP 0 · Vision 0 · 비용 ₩0 · flag OFF.**
> 🔴 Registry schema 0 · 가격 로직 0 · Sales Decision 0 · Provider 교체 0.
> 🟢 **구현 «전» 벤치마크 → 구현 → 음성대조 6종** 순서로 했다.
> 🔴🔴 그 과정에서 **진짜 False Negative 하나** 와 **진짜 False Positive 하나** 를 찾았다.

---

## 1. 구현 전 벤치마크 (CPO §7 요구 7항목 · 비용 0)

| # | 항목 | 결과 |
|---|---|---|
| 1 | 원상품 `brandModelCode` 보유 | **6/26 = 23%** |
| 2 | 후보 **URL** 에서 발견 | 🟢 **3/15** |
| 3 | 후보 **title** 에서 발견 | 🔴 **0/15** ← 기존 구현이 보던 유일한 자리 |
| 4 | **JSON-LD sku** 에서 발견 | ⚪ 0/20 — 🔴 **효과 미측정**(fixture 분모가 무관한 상품) |
| 5 | **description** 에서 발견 | ⚪ 0/20 — 🔴 동일 |
| 6 | 실제 동일상품인데 놓침(FN) | 🔴 **전수 측정 불가**(라벨 부족) — 🟢 단 구조적 FN 2건을 **찾았다**(§3) |
| 7 | 유사상품인데 잘못 잡음(FP) | 🔴 전수 측정 불가 — 🟢 단 FP 벡터 1건을 **찾아 막았다**(§4) |

### 🟢 발견된 3건 (전수 그대로)

```
bobochoses.com        /products/b226ac010-booty-ghosts-t-shirt
global.trenbe.com     /products/...-gray-b226ac010-041-160484656-p   ← 등록부 «밖» 리세일
(운영 링크)            /products/b226ac010-...?_psq=B226AC010
```

🔴🔴 **그래서 결론이 하나로 좁혀졌다** — 품번은 **URL 에 적혀 있었고 제목에는 없었다**.
기존 `confirmBrandCodeInTitle` 이 `title` 만 보므로 이 코퍼스에서 **0건** 이었다.
🟢 `global.trenbe.com` 은 WU-023B 에서 Gemini 가 찾아 **SAME(0.53)** 을 받은 그 후보다.

### 🔴 라벨 한계 (그대로 적는다)

```
라벨 보유 후보 **5건**(운영 링크의 match_truth) · 그중 품번 발견 1
라벨 분포 SIMILAR 2 · STRONG_IDENTIFIER 1 · EXACT_IDENTIFIER 1 · TEXT_CONFIRMED 1
🔴 FP/FN 을 **전수로 셀 분모가 없다.** 「0%」로 적지 않는다.
🟢 대신 FP 의 **구조적 상한** 은 말할 수 있다(§5).
```

---

## 2. 구현 — 건초더미만 넓혔다 (운영 3파일)

```
① (신규) confirmBrandCodeInEvidence(code, { title, url, sku })
     domestic-identifiers.ts — 🟢 기존 `confirmBrandCodeInTitle` 은 **그대로 둔다**
     (littleluna 어댑터·기존 테스트가 의존한다)
② match.ts:509 — 주입 지점을 새 함수로. `{ title: c.title, url: c.url, sku: c.sku ?? facts.sellerSku }`
③ attach-match-truth.ts — **두 곳** 모두 같은 건초더미로(둘이 갈라지면 화면과 저장이
     다른 판정을 낸다)
🟢 index.ts 에 export 추가.
🔴 `description` 은 **일부러 넣지 않았다**(§6).
🔴 후보 sku 를 `brandModelCode` 로 **승격하지 않았다** — WU-003 이 그 방향을 FP 로 확정했다.
```

---

## 3. 🔴🔴 찾은 것 ① — **구조적 False Negative 2/6**

```
Pèpè Shoes    `01195-VERNICE-NERO`
Misha & Puff  `B1408F26-670`
```

기존 규칙은 건초더미를 영숫자 아닌 문자로 쪼갠 뒤 **한 토큰이 품번과 같은지** 본다.
🔴 그런데 **품번 자체에 하이픈이 있으면 어떤 토큰과도 같아질 수 없다.** 실측:

```
confirmBrandCodeInEvidence("01195-VERNICE-NERO", { url ".../01195-vernice-nero-shoes" })
  → **null**     🔴 URL 에 «그대로» 적혀 있는데도 못 찾았다
confirmBrandCodeInEvidence("B1408F26-670",       { url ".../b1408f26-670-cardigan"   })
  → **null**
confirmBrandCodeInEvidence("B226AC010",          { url ".../b226ac010-tee"            })
  → B226AC010   🟢 (하이픈 없는 품번만 통과했다)
```

🟢 **고쳤다** — 품번도 같은 규칙으로 쪼개어 **조각들이 연속으로** 있는지 본다.
🔴 즉 품번 보유 6건 중 **4건만** 매칭 가능했던 것이 **6건 전부** 가능해졌다.

---

## 4. 🔴🔴 찾은 것 ② — **진짜 FP 벡터** (음성대조가 잡았다)

처음 구현은 토큰 수열을 그냥 이어 붙였다. 그러자 이런 것이 **거짓으로 성립** 했다:

```
code   B1408F26-670
제목   "B1408F26 사이즈 670"
       🔴 한글 「사이즈」가 영숫자가 아니라 **구분자로 지워져** 두 토큰이 인접해졌다
       → 수열 일치가 성립 → **FP**
```

🟢 **막았다** — 품번 조각 사이에 허용하는 것은 **`- _ . /` 와 «없음» 뿐** 이다.
🔴 **공백도 허용하지 않는다**(「B1408F26 670」을 같은 품번으로 단정하지 않는다).
🔴 그리고 양 끝에 영숫자가 붙으면 안 된다 — 부분일치를 계속 막는다.

```
최종 규칙:  /(?<![A-Z0-9])<조각1>[-_./]?<조각2>…(?![A-Z0-9])/
```

---

## 5. 🟢 FP 의 «구조적» 상한 — 측정이 아니라 **성질** 이다

```
① 원본에서 **확정된 품번만** 받는다 — 후보에서 품번을 추출하지 않는다
② 반환은 `code` 아니면 `null` **둘뿐** → `compareModelCode` 가 `exact|unavailable`
   밖에 낼 수 없다 — 🔴 `partial`·`conflict` 를 **구조적으로 만들 수 없다**
③ 토큰 **전체 일치** + 경계 + 구분자 제한
④ 반환은 **원본 품번 문자열 그대로** — 후보 페이지의 표기 형태를 돌려주지 않는다
```

🔴 즉 남는 FP 는 **「다른 상품의 품번이 그 페이지에 토큰으로 적혀 있는」 경우 하나** 다.
🟢 그 경우도 테스트로 잠갔다(「다른 상품의 품번이면 찾지 않는다」).

---

## 6. 🔴 `description` 을 넣지 않은 이유

```
① 벤치마크에서 **효과가 측정되지 않았다**(0/20 · 분모가 무관한 상품)
② 상세설명에는 «관련상품/추천상품» 품번이 함께 적히는 경우가 있다 →
   **다른 상품의 품번이 토큰으로 걸리는** FP 벡터다
🔴 측정되지 않은 이득을 위해 FP 위험을 먼저 받지 않는다. 필요해지면 **재서** 넣는다.
🟢 타입에 `description` 칸이 **없다** — 테스트가 그것을 잠갔다.
```

---

## 7. 판정 규칙 4단계 — 🟢 **기존 어휘에 매핑한다**(새 상태를 만들지 않았다)

| CPO 요구 | 기존 `MatchTruth` | `priceTierFromLink` | 가격비교 | Registry |
|---|---|---|---|---|
| **VERIFIED** | `EXACT_IDENTIFIER` · `STRONG_IDENTIFIER` | **EXACT** | 🟢 **가능** | 🟢 저장 가능 |
| **PRESUMED** | `TEXT_CONFIRMED` | COMPARISON | 🔴 **불가**(동일상품 가격 아님) | 🔴 저장 불가 |
| **SIMILAR** | `SIMILAR` | REFERENCE | 🔴 불가 | 🔴 불가 |
| **UNVERIFIED** | `CONFLICT` · `INSUFFICIENT_EVIDENCE` · `null` | EXCLUDED | 🔴 불가 | 🔴 불가 |

🟢 **그리고 이 매핑은 이미 운영에서 그렇게 돈다** — `market-intelligence.ts` 가
`EXACT`/`COMPARISON` 만 가격 버킷에 넣고, WU-020 이 시장·통화 게이트를 더했다.
🔴 **새 상태값을 만들지 않았다**(헌장: 새 abstraction 남발 금지 · 어휘 추측 금지).

🔴 **CPO 요구와 한 군데 다르다 — 그대로 보고한다**: CPO 는 「PRESUMED → 가격비교 불가」
라고 했고 현재 코드는 **COMPARISON 을 「비교상품 참고가」로 집계에 넣는다**(동일상품
최저가와는 **분리된 버킷**). 🟢 동일상품 가격으로 쓰지는 않는다. 🔴 그 버킷 자체를
없애는 것은 **기존 가격 정책 변경** 이라 이 WU 범위 밖이고 **건드리지 않았다**.

---

## 8. 통과조건 — CPO §3 「추가 안전장치」

```
CPO 지정:  Brand 일치 + Brand Model Code 일치 + 상품 핵심정보 충돌 없음
🟢 기존 `compareCrossSellerProducts` 가 이미 그 구조다 —
   `!blocked && brandOk && …` 이고 품번은 **축 하나** 일 뿐이다.
   🔴 즉 품번 하나로 SAME 이 되지 않는다(SAME_MIN_AXES=5).
🟢 그래서 이 WU 는 **축을 하나 되살린 것** 이고 문턱을 낮춘 것이 아니다.
🔴 「SKU 만 일치」는 구조적으로 불가능하다 — 반환 값 공간이 §5-② 로 제한돼 있다.
```

---

## 9. 음성 대조 6종 — 🔴 **전부 FAIL 해야 하고, 전부 FAIL 한다**

| 변형 | 내용 | 결과 |
|---|---|---|
| M0 / 원상복구 | 정상 | 🟢 **22 passed** (crawler 전체 266) |
| M1 | 경계 제거(부분일치 허용) | 🔴 **2 FAIL** |
| M2 | 구분자를 `[^A-Z0-9]*` 로 완화(한글 FP 재발) | 🔴 **1 FAIL** |
| M3 | 후보 sku 를 품번으로 승격 | 🔴 **3 FAIL** |
| M4 | 후보 쪽 표기를 반환(값 공간 오염) | 🔴 **3 FAIL** |
| M5 | URL 축 제거 | 🔴 **7 FAIL** |
| M6 | `match.ts` 가 `url` 을 안 넘김 | 🔴 **1 FAIL** |

### 🔴 M4·M6 는 **처음에 통과했다** — 가드를 고쳤다

```
M4  구분자가 **양쪽 다 하이픈** 인 사례만 단언해서, 매치 문자열과 원본이 글자까지
    같아 구별이 안 됐다. 🟢 구분자가 **다른** 형태(`b1408f26670` · `b1408f26_670` ·
    `01195.vernice.nero`)로 단언해 FAIL 하게 만들었다.
M6  호출부가 `url` 을 실제로 넘기는지 보는 단언이 **없었다**(함수만 테스트했다).
    🟢 `match.ts` 소스에서 `url: c.url` 을 단언하고 `url: null` 을 금지했다.
🔴 이 트랙에서 반복되는 같은 계열 실수다 — 「그 줄이 있는가」가 아니라
   **「그 줄이 실제로 효과를 내는가」** 를 봐야 한다.
```

---

## 10. 검증

```
🟢 admin 전수   Test Files **519 passed** / 50 skipped (569)
                Tests      **7712 passed** / 58 skipped (7770) · FAIL **0**
                (WU-003 기준 517/7,689 → **+2 파일 / +23 테스트** = 이번 추가분)
🟢 typecheck    **10** (baseline 10 — 추가 0)
🟢 build        `Compiled successfully` · exit 0
🟢 guard        `no-production-coupling` 6 passed
🟢 mutation     M1~M6 전부 FAIL · 원상복구 PASS
🟢 Gemini 0 · Search API 0 · Vision 0 · HTTP 0 · 비용 ₩0 · flag OFF · deploy 0
🟢 Registry schema 0 · 가격 로직 0 · Sales Decision 0 · Provider 교체 0
```

---

## 11. 🔴 남은 한계 — 넘겨 읽지 않는다

```
🔴 **FP/FN 을 전수로 측정하지 못했다** — 라벨(ground truth)이 운영 링크 5건뿐이다.
   🟢 측정 가능해지는 조건은 알고 있다 — 독립 관측기(`observeVision`)로 라벨을 만든다.
      🔴 단 Vision 단가 실측이 선행이고 이 WU 범위 밖이다(CPO 가 Track B 를 보류했다).
🔴 **sku·description 축의 효과는 미측정** 이다 — fixture 분모가 무관한 상품이었다.
   🟢 sku 는 구조적으로 안전해서 넣었고, description 은 FP 벡터라 **넣지 않았다.**
🔴 이 효과(0 → 3건)는 **저장된 후보 15건** 기준이다. 운영 전수(498) 값이 아니다.
🔴 그리고 품번 보유율 **23%** 가 Track A 의 상한이다 — 나머지 77% 는 이 WU 로 열리지 않는다.
```
