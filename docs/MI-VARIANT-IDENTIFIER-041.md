# WU-041 — MI 동일상품 판정 고도화: **variant 식별자 조사**

> 🔴 **조사 전용.** 운영 코드 변경 **0** · AI **0** · 외부 검색 API **0** · 비용 **₩0**.
> HTTP 는 캐시 재사용 + CEO 테스트 상품 확인 **2 요청** 뿐이다.
> 금지 10항 전수 준수(소싱 연결 0 · Registry 0 · threshold 0 · 색상사전 0 ·
> PRESUMED 승격 0 · SKU 단독 SAME 0 · AI 판정 입력 0).

---

## §1 기준선 (WU-037 반영 후)

```
Human SAME 27 · DIFFERENT 23 · UNCERTAIN 1   (전수 51 · 미판정 0)
MI SAME **11** · False SAME **1** · SAME MISS **17**
Precision 0.909 · Recall 0.370
```

### SAME MISS 분해 (WU-037 10축 해부 재사용)

```
정책상 SAME 으로 보면 안 되는 것        6   baby 사이즈 라인 4 · baby 품번 상이 1 · 세트 1
정보가 없어서 못 맞춤                   9   BRAND_UNCONFIRMED (WU-034 가 「안전한 확인 증거원 0」으로 닫음)
정보는 있는데 비교가 안 됨              4   한글 제목 3 · 샵이름 오염 1
정보는 있는데 비교 로직 실패            1   🟢 WU-037 에서 해결(C48)
🔴 **정보는 있는데 추출 실패** — 찾지 못했다(0건)
```

---

## §2 🔴🔴🔴 **variant 식별자는 «실제로 존재한다»**

CPO 가 최우선으로 지정한 조사다. 캐시된 후보 페이지 51건 전수:

| 식별자 | 보유 | 상점 간 비교 가능? |
|---|---:|---|
| **GTIN / barcode** | **24 / 51** | 🟢🟢 **가능** — 전 세계 표준 · variant 단위 |
| JSON-LD `Product.sku` | 33 / 51 | 🔴 상점마다 체계가 다르다 |
| Shopify `variants[].sku` | 30 / 51 | 🔴 상점 고유 |
| Shopify `variants[].id` | 40 / 51 | 🔴 Shopify 내부 id |
| JSON-LD `offers.sku` | 30 / 51 | 🔴 상점 고유 |

🔴 **SKU 류는 전부 탈락** — 상점이 제 멋대로 붙이므로 상점 간 비교에 쓸 수 없다
(이 저장소의 기존 규칙 「판매처 자체 SKU 를 브랜드 품번 칸에 넣지 않는다」와 같은 이유).
🟢 **GTIN 만 다르다** — 상점이 아니라 **브랜드가 variant 마다** 발급한다.

### 🟢🟢 그리고 GTIN 이 색상 변형을 **완전히 가른다**

WU-035 가 「모델번호가 색상 변형을 못 가른다」고 닫았던 바로 그 사례:

```
AW26MS185  Grey Melange  (Human SAME)      GTIN 5056470577332
AW26MS185  Conker Stripe (Human DIFFERENT)  GTIN 5056470576939
AW26MS185  Graystone     (Human DIFFERENT)  GTIN 5056470577257
```

---

## §3 🟢🟢🟢 Human GT 대조 — **14쌍 전부 맞는다**

양쪽에 GTIN 이 있어 측정 가능한 14쌍:

```
GTIN 일치 × Human SAME        **7**
GTIN 일치 × Human DIFFERENT   **0**   ← False SAME 0
GTIN 불일치 × Human DIFFERENT **7**
GTIN 불일치 × Human SAME      **0**   ← SAME MISS 0
```

🔴 **한 건도 틀리지 않았다.** 이 트랙에서 어떤 축도 이런 결과를 내지 못했다
(색상 ΔSAME 0 · 이미지 0/24 · 품번 FP 5 · 브랜드 +3/FP 0).

### 회수 가능한 SAME (MI 가 놓친 것)

| | MI | GTIN | Human |
|---|---|---|---|
| C11 bobochoses.co.jp | PRESUMED_SAME | **일치** | SAME |
| C37 bobochoses.co.jp | PRESUMED_SAME | **일치** | SAME |
| C38 blanchou.ca | SIMILAR | **일치** | SAME |
| C48 bobochoses.com | (WU-037 에서 해결) | 일치 | SAME |

🟢 **+3 회수** · 🟢 그리고 C19·C20(PRESUMED_SAME · Human DIFFERENT)은 **GTIN 불일치로
   계속 막힌다** — 색상 변형 보호가 **강해진다**.

---

## §4 CEO 테스트 상품(B226AC042) — Production control

```
B226AC042  gtin **8445782398136**  sku B226AC042**55101**
B226AC043  gtin **8445782398198**  sku B226AC043**41101**
```
🟢 **CEO 가 테스트한 상품에도 GTIN 이 있다.** 그리고 AC042 ↔ AC043 이 **서로 다르다**
(같은 이름의 다른 색상). 🟢 `bobochoses` 의 `Product.sku` 는 **품번+색상코드** 라
이 사이트에서는 variant 단위다 — 🔴 단 그것은 이 브랜드의 관행이고 **일반화하지 않는다.**

---

## §5 🔴 구현하지 않았다 — 그리고 그 이유를 적는다

설계는 확정됐다:

```
① ProductFacts 에 `gtin: string | null` 추가            (@commerce/shared)
② 추출 — JSON-LD `gtin13|gtin14|gtin8|gtin` + Shopify `barcode`
          🟢 **이미 받은 바이트에서** 읽는다 → 추가 HTTP **0**   (@commerce/crawler)
③ comparator — GTIN 축
          일치 → 강한 SAME 증거 · 불일치 → CONFLICT
          🔴 한쪽만 있으면 **UNKNOWN**(모름)이지 MISMATCH 가 아니다
```

🔴 **그런데 이것은 패키지 셋(shared · crawler extraction · crawler comparator)을
동시에 건드리는 identity 핵심 변경** 이다. 헌장 §4-B 의 용량 규칙을 그대로 따른다:

> 「한 세션에 끝까지 못 갈 크기면 착수 전에 범위를 줄이거나 다음 세션으로 넘긴다.
>  **작업트리를 더럽힌 채 중간에 끊기는 것이 가장 나쁘다.**」

🟢 그래서 **조사를 완결해 설계와 상한을 확정** 하고, 구현은 **다음 WU 의 단일 과제**
로 넘긴다. 측정은 끝났으므로 그 WU 는 **조사를 반복하지 않는다.**

### 🔴 구현 시 반드시 같이 잴 것

```
ΔSAME (상한 **+3**) · ΔFalse SAME (**0 을 넘기면 불채택**) ·
C19/C20 색상 변형이 **계속 막히는가** · C06 이 **여전히 SAME 이 아닌가** ·
GTIN 이 한쪽만 있는 37쌍에서 **아무 변화가 없는가**(UNKNOWN 이어야 한다)
```

---

## §6 최종 판정

```
variant 식별자 존재   🟢 **GTIN 24/51** (SKU 류는 상점 고유라 전부 탈락)
Human GT 대조        🟢🟢 **14/14 완전 일치** (FP 0 · FN 0)
회수 상한            🟢 **+3 SAME** · False SAME **0**
색상 변형 보호        🟢 **강해진다** (C19·C20 이 GTIN 불일치로 막힌다)
CEO 테스트 상품       🟢 GTIN 보유 · AC042 ≠ AC043
코드 변경            🟢 **0**
──────────────────────────────────────────
**GO (조사) / 구현은 다음 WU 단일 과제** — 설계·상한·검증항목이 전부 확정됐다.
```

🔴 **CEO Action: NONE.**
