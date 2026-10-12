# MI Identity Facts 전달 경로 원인 규명 WU

> 🟢 **종료.** 판정 — **C. 정상 전달** · **코드 수정 필요: NO**.
> 🔴 **조사 전용.** 코드 0 · threshold 0 · scoring 0 · facts 함수 0 · DB 0.
> 🔴🔴 **직전 WU 보고를 정정한다 — 「결함 셋」은 전부 «내 하니스 결함» 이었다.**

---

## 1. 🔴🔴 먼저 정정 — 직전 WU 가 보고한 것이 틀렸다

직전 WU 에서 「새로 드러난 결함 셋」으로 올린 것이 **셋 다 제 측정 오류**였다.

| 직전 보고 | 실제 |
|---|---|
| 🔴 「`color` 전건 null → 색상 축이 영구히 죽어 있다」 | 🟢 **`color` 라는 칸이 `ProductFacts` 에 없다.** 실제 이름은 **`colorText`** 이고 값이 **정상으로 들어 있다** |
| 🔴 「`titleTokens` 전건 null → 제목 겹침 축도 죽어 있다」 | 🟢 **`titleTokens` 칸도 없다.** 실제 이름은 **`coreTitleTokens`** 이고 값이 **정상이다** |
| 🔴 「`axes` 전건 비어 있다 → Cross-Seller 판정에 도달조차 못 했다」 | 🟢 **`match` 라는 칸이 없다.** `match.ts:526-538` 이 `cross` 를 **네 칸으로 펼쳐서** 싣는다 — `crossSellerVerdict` · `crossSellerReasons` · `crossSellerBlockers` · `crossSellerConflicts`. `axes` 는 **아예 실리지 않는다**(`compareCrossSellerProducts` 내부 값이다) |

🔴 **원인은 하나다 — 칸 이름을 owner 타입에서 읽지 않고 추측했다.**
🔴 이 트랙에서 같은 실수를 **네 번** 했다(`match_truth='SAME_PRODUCT'` ·
`canonical_product` 칸 · owner 패키지 2회 · 그리고 이번 칸 이름 3개).

---

## 2. 종료 조건 표 (CPO §형식) — 실상품 2건

| 항목 | ① canonicalProduct | ②-b backfill | ③ DNA | ④ productFacts | 원인 |
|---|---|---|---|---|---|
| **color** | 🟢 `"Heather grey"` / `"Cream"` | 🟢 동일 | 🟢 `color` = 동일 | 🟢 **`colorText`** = 동일 | **정상** |
| **titleTokens** | — | — | 🟢 `coreTitleTokens` `["boo","bo","choses","shirt"]` / `["astrid","jacket"]` | 🟢 **`coreTitleTokens`** = 동일 | **정상** |
| **brand** | 🟢 `"AW26"` / `"Louise Misha"` | 🟢 동일 | 🟢 동일 | 🟢 동일 | **정상 전달** · 🔴 단 `AW26` 은 **원천부터** 그 값이다 |
| brandModelCode | — | — | 🟢 `"B226AC002"` / 🔴 `null` | 🟢 동일 | 정상 |
| materialText | — | — | 🟢 설명문 전체 | 🟢 동일 | 정상 |

🟢 `productFactsFromIdentityDna`(product-identity-dna.ts:219)는 **가공이 없다** —
`colorText: dna.color` · `coreTitleTokens: dna.coreTitleTokens` ·
`brand: dna.brand.value || null` 처럼 **한 줄씩 그대로 옮긴다.**

---

## 3. 🔴 `brand = AW26` 의 출처 — **추출 단계다 (A)**

```
canonicalProduct.brand = { value: "AW26", source: "ORIGINAL" }
🔴 `source: "ORIGINAL"` → **원본 사이트에서 읽은 값** 이라는 뜻이다
🔴 `brandResolution` 칸은 **없다**(undefined)
→ 🟢 **변환 과정의 오매핑이 아니다.** 원천 추출이 Bobo 공식 페이지에서
     시즌 코드 `AW26` 을 브랜드로 읽었다.
```

🔴 그 피해가 실측된다 — 후보에 facts 를 넣어 `compareCrossSellerProducts` 를
돌리면 **`BRAND_MISMATCH` blocker** 가 뜬다:
```
crossSellerBlockers: [{ blocker: "BRAND_MISMATCH", detail: "브랜드 AW26 ↔ AW26" }]
🔴 detail 이 「AW26 ↔ AW26」 이다 — 양쪽이 같은데 blocker 가 걸렸다.
   🔴 이것이 «왜» 그런지는 **미조사** 다(이 WU 범위 밖).
```

---

## 4. 🟢🟢 그리고 판정기는 **실제로 작동한다** (대조군)

같은 facts 를 후보에 넣어 `withConfidence` 를 돌린 결과:

```
Boo Bo Choses T-shirt
  후보 facts 없음 → crossSeller* 칸 전부 undefined   🟢 예상대로(조건이 막는다)
  후보 facts 있음 → crossSellerVerdict = **"PRESUMED_SAME"**
                    reasons [9] 「핵심 상품명 bo/boo/choses」·「브랜드 품번 일치」·
                               「상품군 shirts」·「색상 G…」
                    blockers [1] BRAND_MISMATCH
Astrid Organic Cotton Jacket
  후보 facts 있음 → crossSellerVerdict = **"SAME"**
                    reasons [5] · blockers **[]** · conflicts **[]**
```

🟢 **즉 facts 가 양쪽에 있으면 Cross-Seller 판정이 정상으로 돈다.**
🟢 색상 축도 산다(「근거: 색상 …」이 reasons 에 찍힌다).

🔴 **그러므로 운영에서 판정이 안 도는 이유는 「원상품 facts 가 비어서」가 아니라
«국내 후보 쪽 facts 가 비어서» 다.** 조건은 `query.facts && candidateFacts` 이고
원상품 쪽(`query.facts`)은 **정상** 이었다.

---

## 5. 결론 — **C. 정상 전달**

```
A. 추출 실패   🔴 brand=AW26 **한 건만** 해당(원천이 그렇게 읽었다)
B. 전이 실패   🟢 **해당 없음** — 전이 함수는 가공 없이 한 줄씩 옮긴다
C. 정상 전달   🟢 **color · titleTokens · brand 셋 다 네 지점 전부 정상**
```

### 코드 수정 필요 여부 — **NO**

```
🟢 `productFactsFromIdentityDna` 는 정상이다. 고칠 것이 없다.
🟢 `withConfidence` 도 정상이다 — facts 가 양쪽에 있으면 SAME/PRESUMED_SAME 을 낸다.
🔴 남은 두 축은 이 WU 의 질문이 «아니다»:
   ① brand=AW26 — 원천 추출 문제(Bobo 공식 페이지 파서). 🔴 선행 WU 가
      brand backfill 변경을 금지했으므로 CPO 승인 영역이다
   ② 국내 후보의 facts 가 비는 것 — 🔴 그것이 운영에서 판정이 안 도는 실제 이유다.
      🔴 이 WU 는 «원상품 쪽» 만 추적하라는 지시였으므로 후보 쪽은 미조사다
```

---

## 6. Known Unknowns

```
🔴 국내 후보(ComparisonCandidate)의 facts 가 «왜» 비는지 미조사 —
   이것이 운영에서 Cross-Seller 판정이 안 도는 실제 원인일 가능성이 가장 높다
🔴 BRAND_MISMATCH detail 이 「AW26 ↔ AW26」 인데 blocker 가 걸린 이유 미조사
🔴 brand=AW26 을 만든 추출 경로(Bobo 공식 파서의 어느 선택자) 미조사
🔴 sample N=2 (Bobo 공식 1 · Smallable 1). 일반화 금지
🔴 `identifier` 가 Bobo 공식에서 null 이다(sku 가 빈 문자열) — 영향 미측정
🔴 직전 WU 의 「후보가 정말 다른 상품이다」 결론은 **유효하다**(제목을 사람이 읽었다).
   이번 정정은 «축이 왜 안 쌓였나» 쪽에만 해당한다
```
