# 🔴🔴🔴 WU-150 — **B226AC009 국내 URL 전수 추적**(2026-10-22 · `40cb2a1a`)

> 🔴 CEO/CPO 가 **실제 판매 중인 국내 URL** 을 제시했다 ⟹ 「국내 공급이 없다」 가설은 **폐기**.
> 🟢 그래서 물은 것은 하나다 — **「그 URL 이 우리 파이프라인의 어느 칸에서 죽는가」.**
> 🔴 추측 없이 **운영 함수를 그대로 불러** 쟀다(`wu-150-b226ac009-domestic-trace` · `WU_150_PROBE=1`).

---

## 🔴🔴 STEP 1 — 7개 URL 이 **서로 다른 칸** 에서 죽는다

| 판매처 | HTTP | 죽는 칸 | 성질 |
|---|---|---|---|
| 신세계몰 공식스토어 | **403** | ① URL 모양 `UNKNOWN_PAGE` | 🔴 **외부 거부** — 분류기를 고쳐도 **못 읽는다** |
| 신세계몰 아울렛 | **403** | 같음 | 같음 |
| LF몰 | 200 | ⑥ 샵 게이트 `EVIDENCE_NOT_WORTHWHILE` | 🔴 **SPA 껍데기**(9.5KB) — 본문에 상품정보 **0** |
| 쁘띠루이 | — | ① `LISTING_PAGE` | 🟢 **정확한 차단**(CEO 가 준 URL 이 목록이다) |
| 도노키즈 | 200 | ② `NO_FACTS` | 🟢 같음(`shopbrand.html` = 목록) |
| **보몽드** | 200 | 🧠 **MI `BRAND_UNCONFIRMED`** + 💰 가격 없음 | 🟡 **유일하게 읽히는 국내 상세** |
| 주니어에디션 | 200 | 🌎 해외(GBP 37) | 🟢 **SAME 으로 통과**(정확) |

```
🔴🔴 읽을 수 있는 «국내 상세» 는 7 중 **1** 이다(보몽드).
🔴 11번가 · POSTY 는 **URL 이 제공되지 않았다** ⟹ **측정불가**(0 으로 세지 않는다).
```

### 🔴🔴🔴 보몽드 — **품번까지 맞춰 놓고 「브랜드 칸」 하나로 보류된다**

```
facts.brandModelCode  "B226AC009"   🟢 **정상 추출**
facts.brand           null          🔴 ← 이것 하나
crossSellerReasons    근거: 핵심 상품명 일부 hairy/hug/monster
                      근거: **브랜드 품번 일치**      ← 🟢 MI 가 스스로 적었다
                      근거: 상품군 TOP↔TOP · 근거: 대상 KIDS
                      **보류: 양쪽 브랜드를 확인하지 못했다**  ← 🔴 PRESUMED_SAME 의 원인
verdict PRESUMED_SAME · tier ≠ SAME · price null · market UNKNOWN
```

**통과한 주니어에디션과의 차이는 `brand` 한 칸이다**(그쪽은 `facts.brand="Bobo Choses"` · 근거 8 · 보류 0).

🔴 **그런데 보몽드 페이지에 브랜드가 «있다»**(실측): `og:title` = 「**보보쇼즈** 26FW … B226AC009」 ·
본문 「보보쇼즈」 **27회** · 「Bobo Choses」 **3회**. 🔴 JSON-LD **0** · `itemprop` **0** · `meta brand` **0**
⟹ **안전한 브랜드 추출 경로가 그 페이지에 없다**(한글 음역뿐).

### 🔴 가격도 막힌다 — 단 **WU-059 의 근거는 부분 반증됐다**

```
🔴 og:price 0 · JSON-LD 0 · itemprop 0
🟡 그러나 hidden input 이 **둘** 있다(실측):
     set_goods_price       83600    ← **판매가**
     set_goods_fixedPrice  88000.00 ← 정가
🔴 WU-059 는 「유일한 구조화 후보가 `set_goods_fixedPrice`(= 정가) ⟹ 가격 오인 위험」으로 HOLD 했다.
   🟢 **판매가 필드가 따로 있다는 것은 그때 기록되지 않았다** — 새 정보다.
🔴 그래도 CTO 가 열지 않았다: WU-079 가 「generic/사이트 전용 parser」를 **REJECT** 했고
   §12-0 이 「사이트 Adapter 추가」를 금지한다 ⟹ **CPO 판정 사안**.
```

---

## 🟢 STEP 2 — **SKU 는 사라지지 않았다**(CEO 가설 반증)

```
brand           "Bobo Choses"   🟢 (WU-134 복구가 운영에서 발화한다)
brandModelCode  "B226AC009"     🟢 **MI 입력까지 정상 전달**
검색어 1번째     "B226AC009"     🟢 품번이 **첫 질의** 다
canonical sku   ""              ← 🔴 CEO 가 본 「SKU 없음」의 정체(판매처 재고번호 · 이 상품엔 없다)
```

🔴 **둘은 다른 값이다.** 데이터 전달 결함이 **아니었고**, 빠진 것은 **그 값을 보여주는 줄** 이었다.

---

## 🟢 STEP 6 — Source Data 에 **「브랜드 품번」** 줄 신설(구현·배포)

```
🟢 읽기 전용 · 파생값(`buildProductIdentityDna().brandModelCode`) · MI/검색/가격 변경 **0**
🔴 품번을 **지어내지 않는다** — owner 가 못 찾으면 화면도 「확인되지 않음」
🟢 식별 칸이 이제 **셋** 이고 서로 다른 이름이다:
     SKU(판매처 재고번호) · **브랜드 품번**(MI 기준) · 네이버 쇼핑 카탈로그 모델명
```

🔴 **계약이 1차에 뚫렸다** — `makeProduct()` 는 `sku === brandModelCode === "B226AC043"` 이라
「화면이 `sku` 를 보여주도록」 바꾼 변이(M9)가 **통과** 했다. 🟢 **두 값이 갈리는 실제 모양**
(sku `""` · URL 이 품번을 들고 있음)으로 fixture 를 바꿔 **M9 가 FAIL** 하게 했다.

---

## 🔴🔴 STEP 3/4 — **하지 않았다.** 그 이유를 숫자로 적는다

```
보몽드의 blocker = BRAND_UNCONFIRMED **하나**
  🔴 WU-059 실측 — 그 단독 완화는 Human DIFFERENT **3건**(C50·C51 …)을 같이 연다
  🔴 WU-080 — BRAND 완화 · extractor 수정 · seller/domain fallback **CPO REJECT**
  🔴 WU-078 — 음역/언어 축 **CPO 종료**(「생산 로직에 넣지 않는다」)
⟹ 지시서 STEP 3 의 조건(「precision contract 와 충돌하지 않는 경우에만」)이 **충족되지 않는다**

가격: WU-079 가 generic/사이트 전용 parser **REJECT** · §12-0 이 어댑터 추가 금지
⟹ 🔴 **CTO 가 임의로 열 수 없다**(§3 STOP — 정책 결정).
```

🟡 **그래서 CPO 판정이 필요한 것은 둘이고, 이제 «어느 것이 얼마를 여는지» 가 숫자로 있다**:

```
⒜ 후보측 brand 가 null 일 때의 BRAND_UNCONFIRMED  — 보몽드 1건이 열린다 · FP 위험 WU-059 측정치
⒝ 고도몰 `set_goods_price` 판매가 필드            — 보몽드 가격 83,600 이 들어온다 · 사이트 종속
🔴 둘 **다** 열려야 국내 가격대가 선다(하나만으로는 SAME 이 돼도 가격이 없다 / 가격이 있어도 SAME 이 아니다).
```

---

## 🔴 측정불가 / 넘겨 읽지 않을 것

```
⒜ 11번가 · POSTY — URL 미제공 ⟹ **측정하지 않았다**
⒝ SSG 403 의 **이유** 는 단정하지 않았다(우회 시도 0 · 금지 방향)
⒞ LF몰은 Playwright 로는 읽힐 수 있다 — 🔴 그 경로의 비용/정책은 **미측정**
⒟ 표본은 **원상품 1개** 다 — 「국내는 언제나 이렇다」로 일반화하지 않는다
⒠ 🔴 실제 따져 화면은 CTO 가 볼 수 없다 ⟹ 화면 축은 **마운트 DOM** 이다
```
