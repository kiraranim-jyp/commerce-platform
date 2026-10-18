# WU-080 — BRAND 증거의 정확성 전수 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「BRAND 보호축을 푸는 것이 목표가 아니다. blocker 가
> **잘못 생성되는 구조적 원인**이 있는지만 조사한다」

---

# WU-080 FINAL

## 1. BRAND blocker 전수 분포 (N=51)

| blocker | Human SAME | Human DIFFERENT | UNCERTAIN |
|---|---:|---:|---:|
| `BRAND_MISMATCH` | **1** | 0 | 0 |
| `BRAND_UNCONFIRMED` | **9** | **4** | 0 |
| 없음 | 17 | 19 | 1 |

🔴 **BRAND blocker 총 14건 · 그중 MISMATCH 는 단 1건** 이다. 나머지 13 은 전부
**「확인 못 했다」(UNCONFIRMED)** 이고, 그것은 **충돌이 아니라 보류** 다.

🔴 Human GT 51 **그대로** 쓰고 파생 DIFFERENT 135 는 **섞지 않았다**.

---

## 2. Human SAME / DIFFERENT 분리

```
A. SAME + MISMATCH      **1**  — C07 biskuit.kr
B. SAME + UNCONFIRMED   **9**  — C11 C14 C15 C21 C27 C37 C43 C47 C48
C. DIFFERENT + MISMATCH **0**
D. DIFFERENT + UNCONFIRMED **4** — C13 C22 C50 C51
E. 대조군(blocker 없음)  **37**
```

---

## 3. BRAND evidence owner (코드 위치 · 추정 0)

```
원상품 brand   product_snapshots.workspace->canonicalProduct->brand {value, source}
               🟢 `brand-resolver.ts` 의 SEASON_CODE 규칙이 "AW26" 을 버린다
후보   brand   product-url-facts.ts `brandFromHtml`
                 = og:brand ?? product:brand ?? JSON-LD "brand"."name"
                 ?? extractMicrodataFromHtml(html)?.brand
               Shopify 경로는 `vendor`
정규화         packages/shared/src/brand-identity.ts `resolveBrandIdentity`
                 SEASON_CODE_ONLY · stripTrailingNoise · normalizeFactText
비교           `brandIdentitiesCompatible` — **단어 부분수열 포함**
blocker        cross-seller.ts:751  brandKnown = Boolean(x.brand && y.brand)
               cross-seller.ts:753  brandKnown && !brandOk ⟹ BRAND_MISMATCH
               cross-seller.ts:999  !brandKnown            ⟹ BRAND_UNCONFIRMED
```

🟢 **브랜드 사전/alias 는 없다** — 정규화는 대소문자·공백·악센트(`Pèpè`→`pepe`)까지다.

---

## 4. raw → normalized 전수 (BRAND blocker 14건)

| id | Human | 후보 brand raw | normalized | 원상품 |
|---|---|---|---|---|
| C07 | SAME | **「비스킷」** | `비스킷` | 있음 → MISMATCH |
| C14 | SAME | `BOBOCHOSES ボボショーズ` | `bobochoses ボボショーズ` | **null** |
| C15 | SAME | **「보보쇼즈」** | `보보쇼즈` | **null** |
| C47 | SAME | **「비스킷」** | `비스킷` | **null** |
| C48 | SAME | `Bobo Choses` | `bobo choses` | **null** |
| C50 | **DIFF** | `Bobo Choses` | `bobo choses` | **null** |
| C51 | **DIFF** | `Bobo Choses` | `bobo choses` | **null** |
| C11 C13 C21 C22 C27 C37 C43 | 혼합 | **null** | — | — |

---

## 5. `BRAND_MISMATCH` 원인 — **1건 · 분류 ④**

```
C07 biskuit.kr 후보 brand = **「비스킷」** = **판매처 이름** 이다.
⟹ §6 분류 **④ seller/store 이름을 브랜드로 오인**.
🔴 원인 위치: 그 페이지가 `og:brand` / JSON-LD `brand.name` 에 **샵 이름을 적어 뒀다.**
   우리 extractor 는 **명시된 자리를 그대로 읽었다** — extractor 결함이 아니라
   **판매처의 마크업이 그렇게 돼 있다.**
🟢 그래서 「실제 브랜드가 다르다(①)」가 아니라 **④** 이고, 그것을 우리가 구분할
   독립 증거는 **이 표본에 없다**(샵 이름 목록 = Registry 성격 · §12-0 금지).
```

---

## 6. `BRAND_UNCONFIRMED` 원인 — 🔴🔴 **후보가 아니라 «원상품» 이다**

```
13건 중 **6건은 후보 brand 가 «있다»**(C14 C15 C47 C48 C50 C51).
`brandKnown = Boolean(x.brand && y.brand)` 이므로 ⟹ **원상품(x) 쪽이 null** 이다.
```

🟢 **DB 로 직접 확인했다**(추측 0):

| 원상품 출처 | `brand.value` | `brand.source` |
|---|---|---|
| **bobochoses.com**(브랜드 **공식몰**) | **`""`** · 1건은 `"AW26"` | `REQUIRED` / `ORIGINAL` |
| junioredition.com(리테일러) | **`"Bobo Choses"`** | `ORIGINAL` |

🔴🔴 **역설이다 — 브랜드 공식몰에서 브랜드를 못 읽고, 리테일러에서는 읽는다.**
원인은 WU-009 가 이미 찾았다 — `bobochoses.com` 의 JSON-LD `brand.name` 이
**`"AW26"`(시즌 코드)** 이고 `SEASON_CODE` 규칙이 그것을 **올바르게 버린다.**

🟢 전수 분포(product_snapshots): `ORIGINAL` 486 · `REQUIRED` 39 · 빈값 **42** ·
brand.value 상위 `Bobo Choses` 172 · `Pèpè Shoes` 50 · **`AW26` 44**.
🔴 즉 **전체로 보면 브랜드 공백은 8% 수준** 인데, **우리 GT 원상품이 거기에 몰려 있다.**

---

## 7. 독립 evidence 후보 — 전부 **실격**

| 후보 | 판정 |
|---|---|
| **A** JSON-LD brand | 🔴 **이미 읽고 있다.** 공식몰이 시즌코드를 적어 둔 것이 문제 |
| **B** visible brand label | 🔴 본문 문자열이고 §10 이 금지한 축 · 계약으로 **잠갔다** |
| **C** canonical brand/domain | 🔴 **CPO §17 REJECT 조건**(「domain 만으로 브랜드 확정」) · B5 변이로 잠갔다 |
| **D** seller metadata | 🔴 C07/C47 이 반증 — 샵이 **자기 이름** 을 brand 에 적는다 |
| **E** brand+modelCode | 🔴 §10 금지 — modelCode 는 **이미 별도 축** 이다(중복 증거) |

---

## 8~10. Counterfactual

### CF-1 `BRAND_MISMATCH` 제거
영향 **1건** — SAME 1 · DIFFERENT 0. 🔴 그러나 C07 은 **같은 샵(biskuit)** 이고
WU-059 가 이미 FP 위험을 측정했다. 단건으로 정책을 바꾸지 않는다.

### CF-2 `BRAND_UNCONFIRMED` 제거
영향 **13건** — SAME 9 · 🔴 **DIFFERENT 4**.
🔴 WU-059 의 「단독 완화 = FP +2」와 같은 방향이다.

### CF-3 🔴🔴 **원상품 브랜드를 복구하면 «악화» 된다** (운영 owner 직접 호출)

원상품 brand 를 `"Bobo Choses"` 로 복구했다고 가정하고
`resolveBrandIdentity` + `brandIdentitiesCompatible` 를 **그대로 불러** 계산:

| 결과 | 건수 | 내역 |
|---|---:|---|
| 🟢 BRAND OK | **3** | C48 **SAME** · 🔴 C50 **DIFFERENT** · 🔴 C51 **DIFFERENT** |
| 🔴 **UNCONFIRMED → MISMATCH 악화** | **4** | C07 C14 C15 C47 — **전부 Human SAME** |
| UNCONFIRMED 유지 | 7 | 후보 brand 도 null |

```
🔴🔴 **보류(UNCONFIRMED)가 충돌(MISMATCH)로 바뀐다.** 한글 표기(「보보쇼즈」) ·
   일본어 혼재(`BOBOCHOSES ボボショーズ`) · 샵 이름(「비스킷」)이
   `brandIdentitiesCompatible` 를 통과하지 못하기 때문이다.
🔴 그리고 열리는 3건 중 **2건이 Human DIFFERENT** 다.
⟹ 원상품 브랜드 복구는 **SAME 4건을 더 세게 막고 DIFFERENT 2건을 연다.**
```

---

## 11. 국내 price bucket downstream

```
CF-2 영향 13건 중 **국내 버킷 자격**(market KR + priceKrw + tier EXACT|COMPARISON)
을 가진 것은 **2건** 이고 둘 다 Human **SAME** 이다 — C15(mustit) · C47(biskuit).
🔴 그러나 그 2건을 얻으려면 **`BRAND_UNCONFIRMED` 를 통째로 꺼야** 하고,
   그때 나머지 11건(DIFFERENT 4 포함)도 같이 열린다.
🔴 그리고 WU-069 의 **삼중 잠금** 이 그 뒤에 그대로 있다 — BRAND 만 풀어도
   `crossSellerReserved` / `NO_TITLE_OVERLAP` / `colorUnverified` 가 남는다
   (WU-065·078 이 「하나만 풀면 변화 0」으로 측정했다).
```

---

## 12. False SAME / precision / recall

```
CF-1  SAME +1 · DIFFERENT +0   (🔴 분모 1)
CF-2  SAME +9 · 🔴 DIFFERENT **+4**
CF-3  SAME +1 · 🔴 DIFFERENT **+2** · 🔴 그리고 SAME **4건이 더 세게 막힌다**
⟹ 세 CF 중 **precision 을 올리는 것은 하나도 없다.**
```

---

## 13. Mutation / harness

🔴 CPO §14 대로 **캐시 하니스 금지** — 운영 producer(`brandFromHtml` ·
`resolveBrandIdentity` · `brandIdentitiesCompatible`)를 **직접** 부른다(네트워크 0).

baseline **8 passed**

| | 변형 | 결과 |
|---|---|---|
| B1 | `brandFromHtml` 무력화 | 🔴 **4 failed** |
| B2 | 정규화 무력화(시즌코드 통과) | 🔴 **2 failed** |
| B3 | source precedence 역전(micro 우선) | 🔴 **1 failed** ← 🟡 **하니스 보강 후** |
| B5 | **domain 으로 브랜드 확정**(금지 축) | 🔴 **2 failed** |
| — | 원상복구 | 🟢 8 passed |

🔴 **B3 가 1차에서 통과했고 내가 잡았다** — 내 HTML 에 microdata brand 가 없어
그 분기가 **애초에 타지지 않았다.** 🟢 CPO §14 대로 **하니스를 고쳐**
(JSON-LD + microdata 동시 존재 케이스 추가) 다시 돌리자 **FAIL 로 뒤집혔다.**

🟢 **B5 가 이 WU 의 핵심 안전 계약이다** — 「domain = brand」가 들어오면 **2건이 깨진다.**

---

## 14. Regression / typecheck / build

```
apps/admin  **589 files / 8,302 passed** / failed **0** (skipped 101)
🔴 CPO §10 포착 장치 — 포착된 실패명 **없음**
typecheck **0** · build **exit 0** · WU-079 baseline(587/8,294)에서 **+2 file / +8 test**
```

🔴 금지 준수 — 운영 코드 변경 **0** · BRAND 0 · MI 0 · 시장 0 · 가격 0 · AI 0 · 배포 0.
🟡 DB 는 **읽기만** 했다(원상품 brand 분포 3 쿼리).

---

## 15. Git / Production

`clean` · `behind/ahead 0 0` · Production **200**. 운영 동작 변화 **0**.

---

## 16. Known Unknowns

```
① 🔴 BRAND blocker **14건** · MISMATCH **1건** — 분모가 작다
② 🔴 CF-3 의 「원상품 = Bobo Choses」는 **가정** 이다. 실제 복구 경로는 만들지 않았다
③ 🔴 원상품 brand 공백의 **전수 비율은 8%**(42/527)인데 우리 GT 가 거기 몰려 있다 —
   **표본 편향** 이고 전수 영향은 미측정
④ 🔴 「비스킷」처럼 샵이 **자기 이름을 brand 에 적는** 비율은 **미측정**(관측 2건)
⑤ 🔴 한글/일본어 브랜드 표기를 같다고 인정할 독립 근거는 **이 WU 에서 찾지 못했다**
   (WU-078 의 음역 축은 **회수 0 · 안전조건** 으로 이미 닫혔다)
⑥ 🔴 `product:brand` / microdata brand 가 실제로 쓰이는 빈도 미측정
```

---

## 17. CPO 질문에 대한 최종 답

> **「BRAND blocker 가 실제 상품 차이를 반영하는가, 아니면 증거가 잘못 생성되어 SAME 을 막는가?」**

```
🟡 **둘 다 아니다 — «제3의 답» 이다.**

① `BRAND_MISMATCH`(1건)는 **증거 생성 오류가 맞다** — 샵이 자기 이름(「비스킷」)을
   brand 자리에 적었고 우리는 그 자리를 정직하게 읽었다. 🔴 그러나 그것을 가를
   독립 증거가 **없다**(샵 이름 목록 = Registry).
② `BRAND_UNCONFIRMED`(13건)는 **「잘못된 blocker」가 아니다** — 말 그대로
   **한쪽을 확인하지 못했다** 는 **정확한 상태 보고** 다.
   🔴 그 「한쪽」이 **후보가 아니라 원상품** 이고, 원인은
   **브랜드 공식몰이 JSON-LD brand 에 시즌코드를 적어 둔 것** 이다.
③ 🔴🔴 그리고 **그 공백을 메워도 상황이 나빠진다**(CF-3) — 보류가 충돌로 바뀌고
   Human SAME 4건이 **더 세게** 막히며 Human DIFFERENT 2건이 열린다.
⟹ BRAND 축은 **지금 올바르게 동작하고 있다.** 바꿀 안전한 길이 없다.
```

---

## 18. 🔴 **REJECT**

§17 의 REJECT 조건에 **셋이 해당** 한다:

```
🔴 BRAND blocker 완화가 필요하다(CF-1/CF-2 둘 다 완화다)
🔴 남은 독립 증거 후보가 **seller/domain 뿐** 이다(§17 명시 REJECT 조건)
🔴 Human DIFFERENT 를 열 가능성이 **측정됐다**(CF-2 +4 · CF-3 +2)
```

§15 의 GO 4조건 중 **①만 부분 충족**(원인은 확정했다) · **②③④ 미충족**.

🔴 **그리고 가장 중요한 결론** — 이 트랙에서 반복된 패턴이 또 나왔다:
> **국내 SAME recall 을 올리는 모든 경로가 「보호축 완화」로 수렴하고,
> 그 완화는 예외 없이 Human DIFFERENT 를 같이 연다.**
> WU-063~080 이 **여덟 개 축**(색상·제목·품번·라인·시장·가격·언어·브랜드)에서
> 같은 결과를 냈다. 🔴 **구조적 상한이 재확인됐다.**

---

## 19. CEO Action — **없음**
