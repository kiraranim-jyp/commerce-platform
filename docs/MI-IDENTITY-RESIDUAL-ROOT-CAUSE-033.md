# WU-033 — MI Identity Residual Root-Cause

> 🔴 **측정 전용.** 운영 코드 **변경 0** · HTTP **0**(WU-032 캐시만) · AI **0** · 비용 **₩0**.
> 🔴 CPO 금지 6항 전부 준수 — 색상 재작업 0 · SKU 귀속 0 · threshold 0 ·
> PRESUMED 승격 0 · 도메인→브랜드 매핑 0 · AI 0.

---

## 1. 🔴🔴 먼저 — 첫 측정이 틀렸고, 그것을 고친 것이 이 WU 의 핵심 중 하나다

`compareCrossSellerProducts` 를 **직접** 부르면 운영과 다른 값이 나온다:

```
직접 호출   MISS 14 = PRESUMED_SAME 7 · SIMILAR 7
운영 경로   MISS 14 = PRESUMED_SAME 13 · SIMILAR 1   ← WU-031
```

🔴 원인: `withConfidence`(match.ts:507-520)가 **비교 전에**
`confirmBrandCodeInEvidence(title · url · sku)` 로 후보 품번을 **확인해 채운다**(WU-004).
그 보강을 빼고 재면 **다른 제품을 재는 것** 이다.

🟢 보강을 재현하자 **WU-031 과 전건 일치**(PRESUMED 13 · SIMILAR 1)로 CONTROL 이 복구됐다.
🔴 그리고 이 사실이 「새 축」 후보 하나를 **그 자리에서 탈락**시켰다 —
**「URL slug 에 품번이 있다」는 새 축이 아니다. 이미 운영이 본다.**

---

## 2. 🔴🔴 SAME 의 필요조건은 **축 개수가 아니라 blocker 0** 이다

| | 축 개수 | blocker |
|---|---|---|
| **MI SAME 10건** | 4,4,4,5,6,6,8,8,8,8 | 🟢 **전건 없음 (10/10)** |
| **MISS 14건** | 2,2,2,2,2,3,3,3,4,4,4,4,5,**8** | 🔴 **13/14 에 blocker 있음** |

🔴 **축수로 설명되지 않는다** — SAME 중 **4축이 4건**이고, MISS 중 **8축짜리가 1건**
(`bobochoses.com`, 전 축 일치, confidence 1.0)이다. 그 8축 건을 막은 것은 **blocker 하나**다.

### MISS 14 의 blocker 분포

```
BRAND_UNCONFIRMED   **8**   ← 지배적
NO_TITLE_OVERLAP     4      (3건은 BRAND 와 중복)
BRAND_MISMATCH       1 · MATERIAL 1 · SIZE_SYSTEM 1
blocker 없음         1      (trenbe · 축 2 — 이 1건만 「축 부족」이 맞다)
```

🟢 **그래서 CPO 의 3/2/8 분해를 더 정확히 다시 적는다**:
```
blocker 가 막는다       13 / 14      ← 진짜 게이트
축이 모자라서 막힌다      1 / 14
```

---

## 3. 🔴🔴🔴 **새 병목을 찾았다 — 플랫폼 커버리지다**

| 후보 경로 | n | GT SAME | **MI SAME** | 축 개수 |
|---|---|---|---|---|
| SHOPIFY_JSON | 40 | 17 | **10** | 2~8 |
| **PLAIN_HTML** | 11 | **7** | **0** | **2~4 (최대 4)** |

🔴🔴 **MI SAME 10건은 «전부» Shopify 후보다. 비-Shopify 후보는 GT SAME 7건에서
단 한 건도 SAME 에 도달하지 못했다 — 0%.**

원인은 코드 위치까지 확정된다 — `product-url-facts.ts:212` 의 비-Shopify 경로가
`productFactsFromListing`(= **목록 수준** 빌더)을 쓴다:

```
후보 facts 14칸 채움률
  SHOPIFY_JSON  urlSlug 40 · brand 37 · category 37 · color 28 · material 32 ·
                size 37 · audience 40 · images 40 · modelCode 17
  PLAIN_HTML    urlSlug 11 · brand  6 · 🔴 **나머지 9칸 전부 0**
```

🔴 **국내 샵은 대부분 Cafe24/자체몰 = 비-Shopify** 다. 즉 이것이 **국내 동일상품
연결의 구조적 상한** 이고, 「AI 가 좋은 후보를 가져와도 연결이 안 된다」의 실제 자리다.

---

## 4. 🔴 그런데 그 경로를 고쳐도 ΔSAME = 0 이다 (두 방향으로 확인)

PLAIN_HTML 11건이 **이미 받은 HTML** 안에 들고 있는 구조화 증거:

```
JSON-LD Product 9/11 · sku 9 · brand 6 · category 3 · material 1 · **color 1**
🔴 beaumonde.co.kr 2건은 JSON-LD 자체가 없다
```

🔴 즉 `extractFromJsonLd` 를 그 경로에 배선해도 **brand 3 · category 3 만** 새로 채워지고
(나머지는 이미 있거나 원본에 없다), **WU-032 가 그 조합의 ΔSAME 을 0 으로 실측했다.**
축이 2~4 → 3~5 로 가도 **blocker 가 그대로** 남기 때문이다(§2).

---

## 5. 새 연결축 전수 — 🔴 **쓸 수 있는 것이 없다**

판정기에 **배선하지 않고** 판별력만 쟀다(GT SAME 24 / GT DIFFERENT 27).

| 후보 축 | GT SAME 발화 | GT DIFFERENT 발화 | 판정 |
|---|---|---|---|
| **공유 이미지 자산** | **0 / 24** | 0 | 🔴 **죽은 축** — 샵들이 자기 CDN 에 재업로드해 파일명이 전부 다르다 |
| 품번 ∈ URL slug | 9 (37.5%) | **0** | 🔴 **새 축 아님** — WU-004 가 이미 본다 |
| 품번 ∈ 제목 | 10 (41.7%) | 3 | 🔴 이미 운영 중 |
| **품번 ∈ 이미지 파일명** | **12 (50.0%)** | 2 | 🟡 **유일하게 새 자리** — 아래 |

### 유일한 신규 자리의 증분 — 벌기는 하는데 **판정이 안 바뀐다**

같은 `confirmBrandCodeInEvidence` 규칙에 **이미지 파일명 한 칸만** 더해서 측정:

```
품번을 새로 확정한 후보   **6** (GT SAME 4 · GT DIFFERENT 2)
MI SAME        10 → **10**   (**ΔSAME 0**)
False SAME      0 → **0**    (🟢 안전하긴 하다)
```

🔴 **MODEL_CODE 축을 6건에 더 세워도 SAME 이 하나도 안 늘어난다** — §2 의 결론대로
**막는 것이 축이 아니라 blocker** 이기 때문이다.

---

## 6. 🔴🔴 그래서 이 WU 의 결론 — CPO 가 미리 적어 둔 갈래 중 «두 번째» 다

CPO 지시서:
> 「그 원인이 **상품 식별 구조 자체의 한계**라면 MI 수정 문제가 아니라
>  **새로운 독립 증거 소스가 필요한 문제**가 됩니다.」

세 WU 를 합치면 그 갈래가 **데이터로 선택된다**:

```
WU-031  MI 로직 오류                      **0**
WU-032  증거 완성도 상한(안전)             **+3**
WU-033  새 연결축(이미지·슬러그·파일명)     **ΔSAME 0**
        플랫폼 추출기 보강(JSON-LD 배선)    **ΔSAME 0**
──────────────────────────────────────────────────────
🔴 세 축 전부에서 잔여가 풀리지 않는다.
```

🔴🔴 **막고 있는 것은 blocker 이고, 그 blocker 는 «정당하다»** — `BRAND_UNCONFIRMED` 는
「양쪽 브랜드를 확인하지 못했다」는 **사실의 기술** 이다. 그것을 없애는 것은 정책 완화이고
False SAME 0 을 거는 행위다.

> **따라서 남은 11~14건을 풀려면 «브랜드를 양쪽에서 독립적으로 확인해 주는 증거원»
> 이 필요하다. 그것은 MI 수정도, 추출기 보강도 아니다.**

---

## 7. 🔴 다음에 «하지 말아야» 할 것 — 이 WU 가 근거를 만들었다

```
❌ 색상 추출 보강            ΔSAME 0 (WU-032 ORACLE)
❌ JSON-LD 를 htmlPath 에 배선 ΔSAME 0 (WU-032 + WU-033 §4)
❌ 이미지 파일명 품번 확인     ΔSAME 0 (WU-033 §5)
❌ 공유 이미지 자산 축         발화 0/24
❌ SKU → brandModelCode       +5 / FP +5
❌ blocker 완화 / threshold    False SAME 0 을 건다
```

🟡 **값이 남은 것은 하나뿐이고 그것도 작다** — 브랜드 양쪽 보강 **+3** (WU-032,
FP 천장 0). 🔴 단 그 수단 둘(추출 경로 부재 · 도메인→브랜드 표)이 **둘 다 CPO 결정**
이고, 이 WU 에서 **하나도 구현하지 않았다.**

---

## 8. 최종 판정

```
CPO 10항        ①~⑩ 전부 수행 · 구현 0
CONTROL         🟢 WU-031 전건 재현(MISS 14 · PRESUMED 13 · SIMILAR 1 · SAME 10 · FP 0)
새 연결축        🔴 **없다** (후보 4종 전수 측정 · 전부 ΔSAME 0 또는 이미 운영 중)
새 병목          🟢 **플랫폼 커버리지** — 비-Shopify 후보 GT SAME 7 → SAME **0**
진짜 게이트      🟢 **blocker 0** 이지 축 개수가 아니다 (SAME 10/10 blocker 없음)
지배 blocker     🔴 **BRAND_UNCONFIRMED 8/14**
코드 변경        🟢 **0**
──────────────────────────────────────────
**HOLD** — 잔여는 증거 완성도·추출기·새 축으로 풀리지 않는다.
필요한 것은 **브랜드를 양쪽에서 독립 확인해 주는 새 증거원** 이고, 그 도입 여부는
CPO 판정 사안이다.
```

🔴 **CEO Action: NONE.**
