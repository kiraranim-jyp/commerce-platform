# DANAWA Evidence 정책 · MI 연결 설계

작성: 2026-09-21 · **코드 0 · DB 0 · migration 0 · Production 0**
전제 기록: [danawa-poc-findings.md](./danawa-poc-findings.md)

> 표기 규칙 — **[FACT]** 실측 확인 · **[DESIGN]** 가능한 설계 ·
> **[REC]** CTO 제안(확정 아님) · **[UNVERIFIED]** 확인하지 못함

---

## 1. Danawa 가격의 정확한 의미

**[FACT]** 상품 페이지가 두 값을 **따로** 노출한다.

```html
<div class="sell-price" data-base-price="60450" data-delivery-price="3000">
```

```text
DANAWA_DISPLAY_MIN_PRICE  = data-base-price   ( = og:description 의 "최저가" )
DANAWA_DELIVERY_PRICE     = data-delivery-price
DANAWA_PURCHASABLE_PRICE  = base + delivery           ← 계산 가능
```

**[FACT]** 페이지가 스스로 밝힌 한계:
> ※ 배송비가 부정확한 업체의 경우 **배송비 미포함 가격**으로 안내됩니다.

**[FACT]** 실측 4건 — **표시 최저가는 「그 판매처 1곳의 상품가」이지 최종 결제금액이 아니다.**

| 상품 | 최저가 판매처 | 표시 최저가 | 배송비 | 구매가능 표시가 |
|---|---|---:|---:|---:|
| `B226AC009` | 옥션 | ₩60,450 | ₩3,000 | **₩63,450** |
| `B226AC010` | 11번가 | ₩76,070 | ₩0 | ₩76,070 |
| `B226AC042` | **머스트잇** | ₩109,500 | ₩0 | ₩109,500 |
| `B226AC070` | G마켓 | ₩162,320 | ₩3,000 | **₩165,320** |

**[FACT]** 회원가는 `box__membership-price` 로 **DOM 상 분리**돼 있다. 일반 최저가와 섞이지 않는다.
→ 전체 숫자 `min()` 은 회원가를 집어온다. **금지.**

**[UNVERIFIED]** 다음은 4개 페이지에서 **문구가 관측되지 않았다.** 「없다」가 아니라 「확인 못 했다」.

```text
품절 / 판매중지 / 재고        0회 관측
해외구매대행 / 병행수입 표기   0회 관측  → 판매처 성격을 페이지로 «판별할 수 없다»
쿠폰                          0회 · 카드할인 1회 (최저가에 미반영으로 «보임»)
옵션 추가금                    미확인
나머지 판매처 가격              🔴 /info/ajax/ 지연로딩 = robots Disallow → 영구 미수집
```

---

## 2. `DOMESTIC_SHOP` 과의 의미 차이

**[FACT]**

| | `DOMESTIC_SHOP` | `DANAWA` |
|---|---|---|
| 가격 의미 | **특정 판매처 1곳**의 관측 판매가 | **여러 판매처 중 최저가** |
| 판매처 수 | 1 | 10곳 (행 11~15) |
| 동일상품 판단 주체 | **TTAEJYO** 매칭 엔진 | **Danawa** 의 `pcode` 그룹핑 |
| 배송비 | 미저장 | **제공됨** |
| 회원가 | 미구분 | 분리됨 |
| 판매처 성격 | 브랜드 공식몰(정가) | 오픈마켓·백화점몰·홈쇼핑·**머스트잇** |

**[FACT]** 실측 4건 전부 기존 값이 시장가보다 높았다 — **₩11,930 ~ ₩52,500**.
원인은 국내 소스가 `Bobo Choses Korea(공식)` 하나뿐이라 **정가를 국내 경쟁가로 써왔기** 때문이다.

---

## 3. 🔴 별도 Evidence 축이 필요한 «기술적» 근거

**[FACT]** 기존 두 유니온은 **닫힌 값이지만 exhaustive 검사가 없다.**

```ts
DomesticPriceTier  = "EXACT" | "COMPARISON" | "EXCLUDED"   // domestic-product-link.ts:49
DomesticPriceBasis = "EXACT" | "COMPARISON" | "NONE"       // price-decision.ts:14
```

**[FACT]** 소비처가 전부 `===` 문자열 비교이고 `never` 소진 검사가 **하나도 없다.**
→ **값을 추가해도 컴파일 에러가 나지 않고, 조용히 «틀린 쪽» 으로 분류된다.**

```ts
// price-hierarchy.ts:1054 — 새 값이 들어오면
domesticBasis === "EXACT" ? "동일상품 기준" : "비교상품 참고가 기준"
//                                            ↑ 🔴 잘못된 라벨이 붙는다

// market-signals.ts:655-666 — 새 값이 들어오면
exact=false → === "COMPARISON" 아님 → "국내에서 동일상품을 찾지 못했습니다"
//                                     ↑ 🔴 잘못된 문장이 나간다
```

**[REC]** 따라서 **기존 유니온을 확장하지 않는다.** `PRICE_COMPARISON` 은
`domesticBasis` 와 **무관한 병렬 필드**여야 한다. 그래야 기존 EXACT/COMPARISON/NONE·UNKNOWN
의미가 **한 글자도 바뀌지 않는다.**

---

## 4. `EXACT` 로 승격하지 않는 근거

**[FACT]** ① 집계값이다 — 「한 판매처의 판매가」라는 `DOMESTIC_SHOP` 정의와 충돌한다.
**[FACT]** ② 실측 1/4 에서 최저가 판매처가 **머스트잇**(명품 리셀/병행수입 성격)이었다.
**[UNVERIFIED]** ③ 그런데 **병행수입/구매대행 여부를 페이지로 판별할 수 없다**(표기 0회).
**[FACT]** ④ 품절/판매중지 여부도 미관측이다 — 「구매 가능한 최저가」임을 보증할 수 없다.

→ EXACT 로 올리면 **판매판정의 기준선이 병행수입 가격이 될 수 있고, 우리는 그걸 알 수 없다.**

## 5. `COMPARISON` 으로 단순 편입하지 않는 이유

**[FACT]** 정책 A(CEO 확정) — 판매판정의 국내가격 근거는 **`EXACT` 만** 사용한다.
`computePriceDecision` 이 `domesticBasis === "EXACT"` 가 아니면 국내가를 `null` 로 만든다.

→ `COMPARISON` 에 넣으면 **수집은 하는데 판정에는 전혀 영향이 없다.** 붙일 실익이 없다.
그리고 §3 대로 **기존 COMPARISON 의 의미(「유사상품 참고가」)와도 다르다.**

---

## 6. 판매판정 직접 사용 가능 여부 → **[REC] 현재 불가**

```text
불가 사유
  · 집계값 ↔ 단일 판매가 의미 불일치 (미해소)
  · 판매처 성격 판별 불가            [UNVERIFIED]
  · 판매 가능 여부(품절) 미확인       [UNVERIFIED]
  · 커버리지 Bobo Choses 편중        [FACT]
```

## 7. 사용 가능 조건 **[DESIGN]**

```text
필수(모두 충족)
  ① pcode 존재
  ② 모델코드가 «그 상품 행» 에서 단어경계 기준 독립 정확 일치
  ③ /info/?pcode= 정상 접근 · og:description 최저가 확인
  ④ data-delivery-price 확인 → purchasablePrice 계산 가능
  ⑤ freshness 기준 내 (§9)

정책 결정이 필요한 것 (CTO 가 정할 수 없음)
  ⑥ 판매처 성격을 판별할 수 없는 상태에서 «그대로 쓸 것인가»
     → 판별 불가이므로 선택지는 둘뿐이다:
        ㉠ 성격 무관하게 사용한다고 «명시적으로 결정»
        ㉡ 판별 가능해질 때까지 판정에 쓰지 않는다
```

---

## 8. 배치 구조 **[DESIGN]**

**[FACT]** `search.danawa.com` → `Crawl-delay: 10`. 현재 MI 는 한 요청에서 판매처 5곳을 수 초 내 훑는다.
→ **실시간 호출은 서버리스 타임아웃을 유발한다. 배치가 유일한 선택지.**

```text
상품 분석 → 조사 대상 생성 → Queue → Danawa Search
  → 행 단위 정확 코드 일치 → pcode → /info/?pcode=
  → PriceComparisonObservation 저장 → MI 는 «저장된 Evidence» 만 읽음
```

**[FACT]** 이론 비용: 상품 100개 → 검색 1,000초(≈17분) + 상세 100회.

## 9. 캐시 / stale **[DESIGN]**

**[REC]** **`pcode` 단위 캐시** — 모델코드가 달라도 같은 `pcode` 면 상세를 재조회하지 않는다.
`B226AC009 → pcode 123688298` 을 이미 조회했다면 다른 상품이 같은 pcode 에 도달해도 재사용.

```text
< 24h   fresh          판정 후보로 사용 가능
24~48h  stale warning  화면에 «마지막 확인 시각» 병기
> 48h   판정 사용 금지  재조회 대상
```

**[UNVERIFIED]** 이 수치는 **근거 없는 제안이다.** 실제 가격 변동 주기를 측정한 적이 없다.
확정 전 최소 1주간 동일 pcode 의 가격 변동을 관측해야 한다.

## 10. 상태값 **[DESIGN]** — enum 구현하지 않음

```text
POC 에서 «실제로 발생한» 것          설계상 필요해 보이는 것
  NO_RESULT        검색 0건            CODE_AMBIGUOUS   부분문자열 등 모호
  NO_PCODE         코드 O · 미묶음      WRONG_PRODUCT    다른 상품 행의 pcode
  UNRESOLVED       그 외                PRICE_UNAVAILABLE og:description 없음
                                       SOURCE_BLOCKED    403/500
```

**[FACT]** `NO_RESULT`·`NO_PCODE` 는 **「국내 가격 없음」이 아니다.** 「다나와 가격비교 미확인」이다.

## 11. 코드 매칭 안전규칙 **[FACT 기반 · 필수]**

**[FACT]** `F26100`(TAO)이 랑방 `F047P26100` 의 **부분 문자열**로 걸렸고,
`pcode` 가 붙은 **유일한 행이 랑방**이었다. 진짜 TAO 상품에는 pcode 가 없었다.

```text
금지   includes() · substring() · 검색결과 첫 pcode 자동 선택
원칙   검색 결과 «각 상품 행» → 그 행의 상품코드 → 단어경계 정확 일치 → «그 행» 의 pcode
```

## 12. 데이터 모델 **[DESIGN]** — 구현하지 않음

```text
DanawaPriceComparisonObservation
  pcode · matchedModelCode · displayMinPriceKrw · deliveryPriceKrw
  purchasablePriceKrw · lowestMallName · mallCount · checkedAt · sourceUrl · status

추가 검토 (현재 페이지에서 «확인된 것만» 만든다)
  deliveryKnown   ✅ data-delivery-price 유무로 판정 가능
  membershipPrice ✅ box__membership-price 존재 시
  sellerType      🔴 만들지 않는다 — 판별 근거가 페이지에 없다
  availability    🔴 만들지 않는다 — 품절 표기 미관측
  priceCondition  🔴 만들지 않는다 — 쿠폰/카드 조건 미확인
```

## 13. UI 정보구조 **[DESIGN]**

**[FACT]** 현재 라벨 — `국내 비교상품`(`DOMESTIC_SHOP`) · `원본 판매자 한국 표시가`(`KR_MARKET`).
`price-hierarchy.ts:115-117` 주석이 **「하나는 내가 살 값이고 하나는 남이 파는 값이다」** 라고
두 한국 가격을 가르는 이유를 명시한다. **세 번째 축도 같은 원칙으로 분리한다.**

```text
국내 가격정보
  ① 국내 동일상품      FORETFORET ₩258,000        ← 판매판정 근거 (정책 A)
  ② 원본 판매자 한국가  ₩230,900
  ③ 다나와 가격비교     최저가 ₩109,500 · 배송 ₩0
                       최저가 판매처 머스트잇 · 가격비교 판매처 10곳
                       (확인 2026-09-21)
```

**[REC] 용어** — **「다나와 가격비교 최저가」** 를 쓴다.
다음은 **쓰지 않는다**: ❌ 국내 최저가 ❌ 한국 최저가 ❌ 국내 전체 최저가
**[FACT]** 다나와 10곳에 포레포레·LOOXLOO 같은 편집샵이 **없다.** 국내 전체를 대표하지 않는다.

🔴 **③ 을 판매판정 근거처럼 보이게 만들지 않는다** — ① 과 시각적으로 같은 위계를 주지 않는다.

---

## 14. 기존 MI 와의 충돌 여부

**[FACT]** 병렬 축으로 두면 충돌 **없음**.

```text
domesticBasis (EXACT/COMPARISON/NONE)   변경 없음
priceTier (EXACT/COMPARISON/EXCLUDED)    변경 없음
computePriceDecision · computeSellability · marketCase · finalVerdict   입력 불변
UNKNOWN 의미                              그대로 유지 (§3 근거)
```

🔴 **반대로, 기존 유니온에 값을 «추가» 하면 §3 의 두 지점에서 조용히 틀린 라벨/문장이 나간다.**

## 15. MI-REAL-13 관계

**[FACT]** Vernice Nero 는 **PèPè** 이고 PèPè 품번 2개 모두 다나와 **NO_RESULT** 다.
→ **Vernice 직접 시뮬레이션 불가.** 이 상태를 유지한다.

**[FACT]** 대체 관측 — `B226AC042`: `DOMESTIC_SHOP ₩162,000` vs `DANAWA ₩109,500` (32% 차).
**[UNVERIFIED]** 마진 영향은 계산하지 않는다 — `price_breakdown` 이 전 테이블 0건이라 착지원가가 없다.

---

## 16. 네 질문에 대한 답

```text
A  독립 Evidence 축이 가장 안전한가?        ✅ 그렇다 — §3 의 silent fallthrough 가 근거
B  현재 판매판정에 직접 쓸 수 있는가?        🔴 아니다 — §6
C  쓰려면 최소 조건은?                      §7 ①~⑤ + ⑥ «정책 결정»(CTO 권한 밖)
D  지금 구현 안 해도 나중에 추가 가능한가?   ✅ 가능 — 기존 타입을 건드리지 않으므로
                                             지금 아무것도 안 해도 손해가 없다
```

## 17. 필요한 구현 범위 **[DESIGN]** · 종료 상태

```text
① 배치 큐 + 워커 (Crawl-delay 10 준수)
② 행 단위 정확 코드 매칭 + 그 행의 pcode 선택
③ DanawaPriceComparisonObservation 저장 (pcode 단위 캐시)
④ UI 3번째 축 표시 (판정 근거처럼 보이지 않게)
⑤ 가격 변동 주기 관측 → stale 기준 확정
```

```text
DANAWA-06   설계 완료 · 정책 «미확정»
구현 착수    🔴 HOLD — §7 ⑥ 은 CPO 결정 사항
코드 0 · DB 0 · migration 0 · Production 0
```

🔴 **이 문서는 정책을 확정하지 않았다.** `PRICE_COMPARISON` 을 독립 축으로 두자는 것은
**[REC]** 이고, 판매판정 사용 여부(§7 ⑥)는 **CPO 검토 전까지 결정되지 않은 상태**로 남는다.
