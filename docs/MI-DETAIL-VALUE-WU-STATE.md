# 국내 후보 «상세확인» 가치 측정 WU

> 🟢 **종료.** 판정 — **현재 목록 기반 Precision 경로 유지** (상세확인을 MVP 경로에
> 넣을 근거가 없다).
> 🔴 **조사 전용.** 코드 0 · threshold 0 · scoring 0 · 검색어 0 · Registry 0 · DB 0.
> 🔴🔴 **SAME 승격 = 0건.** 그리고 그 이유가 둘로 분명히 갈린다(§3).

---

## 1. 🔴🔴 가치 상한이 «owner 를 읽는 순간» 확정됐다

`DOMESTIC_IDENTIFIER_EXTRACTORS`(domestic-identifiers.ts:88)에 등록된 도메인은
**단 2개** 다:

```
🟢 foretforet.com   → fetchForetforetModelCode  (실제 HTTP)
🟢 bobochoses.com   → extractBobochosesModelCode (URL 파싱 · HTTP 없음)
```

🔴 `fetchDomesticModelCode(domain, url)`(:97)은 **등록 안 된 도메인에 `null`** 을
돌려준다(`extractor ? extractor(url) : null`).

### 활성 자동수집 샵 7곳 중 지원되는 곳 — **1곳**

| | 샵 | 도메인 |
|---|---|---|
| 🔴 | CHOCO.EL(초코엘) | chocoel.co.kr |
| 🔴 | **LOOXLOO** | looxloo.com |
| 🔴 | RULII(루리샵) | rulii.co.kr |
| 🔴 | 스카이스포츠 | skysport.co.kr |
| 🟢 | **포레포레** | foretforet.com |
| 🔴 | DEUXBEBE(듀베베) | deuxbebe.com |
| 🔴 | LITTLE LUNA(리틀루나) | littleluna.co.kr |

🔴 **그런데 후보 대부분을 LOOXLOO 가 낸다**(직전 WU 실측: 6/6 · 14/17).
→ 🔴 **상세확인을 「켜도」 후보 23개 중 20개는 한 건도 바뀌지 않는다.**
**구조적으로 가치 상한이 작다.**

---

## 2. 측정 결과 (실상품 2건 · 후보 23개 전수 · 실제 HTTP)

```
상세확인 가능한 후보              **3/23**
🔴 상세확인 불가(추출기 없음)       **20/23**
상세에서 modelCode 를 얻은 후보    **3/3**  🟢 추출기는 작동한다
🟢 verdict 가 바뀐 후보            **0**
🟢🟢 SAME 으로 승격한 후보         **0**

verdict before  SIMILAR 4 · UNKNOWN 15 · CONFLICT 4
verdict after   SIMILAR 4 · UNKNOWN 15 · CONFLICT 4   ← 🔴 **완전히 동일**
비용            실제 상세 fetch **3회**
```

### 🟢 상세확인이 실제로 돈 3건 (포레포레 · Astrid 자켓)

```
SS26 Astrid 자켓 Cream Floral Haven  상세code = LM26KSJAC0074CFH
SS25 Astrid 자켓 Cream Rosa Festa    상세code = LM25KSJAC0178CRF
SS25 Astrid 자켓 Yellow Capri Cove   상세code = LM25KSJAC0177YCC
  목록code None → 상세code 획득 🟢
  🔴 원상품 품번 = **None**
  SIMILAR → SIMILAR · axes 2 → 2   (변화 없음)
```

---

## 3. 🔴🔴 SAME 승격이 0 인 이유 — **둘로 갈린다**

```
① 🔴 추출기가 없다 (20/23)
   LOOXLOO·RULII·CHOCO.EL·DEUXBEBE·LITTLE LUNA·스카이스포츠는 등록되지 않았다
   → 상세확인이 **실행조차 되지 않는다.** 🔴 「효과 0」이 아니라 **미측정** 이다

② 🟢 추출기가 돌았지만 «대조할 원상품 품번» 이 없다 (3/23)
   포레포레 3건은 상세 품번을 **정상으로 얻었다**(LM26KSJAC0074CFH 등)
   🔴 그런데 **원상품(Smallable/Louise Misha)의 brandModelCode 가 null** 이다
   → 비교할 대상이 없으니 `MODEL_CODE` 축이 생길 수 없다. axes 2 → 2.
   🟢 이것은 **설계된 동작** 이다 — 한쪽만 있는 품번으로 SAME 을 만들지 않는다
```

🔴 **그러므로 「상세확인은 가치가 없다」로 결론하면 틀린다.** 정확히는:
```
🔴 이 표본에서는 **상세확인의 가치를 측정할 수 없었다.**
   · 20건은 추출기가 없어 실행 안 됨
   · 3건은 실행됐으나 원상품 품번이 null 이라 대조 불가
🟢 다만 «그 상태에서 상세확인을 MVP 에 넣으면 비용만 든다» 는 것은 확실하다
```

---

## 4. 판정 — **현재 목록 기반 Precision 경로 유지**

CPO 가 준 세 갈래 중:

```
🔴 「상세 확인으로 SAME 증가가 의미 있음 → MVP 경로에 활용」  → 해당 없음(0건)
🟢 「SAME 증가 거의 없음 → 현재 목록 기반 Precision 경로 유지」 → **이것이다**
🔴 「비용이 너무 큼 → 제한적 확인만 유지」                      → 비용은 작았다(3회)
```

🟢 **비용이 문제가 아니라 «대상이 없다».** 지금 상세확인을 켜면
요청 23회 중 3회만 실행되고 그 3회도 verdict 를 바꾸지 못한다.

### 🔴 상세확인이 가치를 가지려면 선행 조건 둘이 **먼저** 필요하다

```
① 🔴 후보를 내는 샵에 추출기가 있어야 한다
   현재 후보의 87%(20/23)를 LOOXLOO 등 **미등록 샵** 이 낸다
   → 🔴 단 「추출기를 추가하자」는 결론을 내지 않는다. 선행 WU 가
      「그 샵이 상품명·URL 에 해외 품번을 적는가」를 판별 기준으로 확정했고
      looxloo/rulii 는 **적지 않는다** 고 실측됐다(메모
      domestic-discovery-dies-at-low-not-at-search). 추출기를 붙여도 0 이다
② 🔴 **원상품 쪽 품번이 있어야 한다**
   Smallable 상품은 `brandModelCode = null` 이다(Bobo 공식은 있다)
   → 양쪽이 다 있어야 MODEL_CODE 축이 생긴다
```

🟢 **즉 상세확인은 「Bobo 공식 원상품 × foretforet 후보」 조합에서만 의미가 있고,
그 조합이 이 표본에 없었다.** 🔴 그 조합의 가치는 **미측정** 이다.

---

## 5. Known Unknowns

```
🔴 sample N=2 상품 / 후보 23개 / 상세확인 실행 **3회**. 🔴 일반화 금지
🔴 「Bobo 공식 원상품(품번 있음) × foretforet 후보」 조합은 **미측정** —
   이 조합이 상세확인의 유일한 유효 후보다
🔴 colorText 를 상세에서 채우는 경로는 **없다**(추출기는 modelCode 만 돌려준다)
   → 색상 축은 상세확인으로도 살아나지 않는다
🔴 bobochoses.com 추출기는 URL 파싱이라 HTTP 가 없다(비용 0) — 단 그 샵은 비활성
🔴 `MAX_DETAIL_CONFIRMATIONS_PER_SHOP = 2` 상한은 이 하니스에서 적용하지 않았다
   (운영 저장경로의 장치다) → 운영에서는 3건 중 2건만 확인될 수 있다
🔴 CONFLICT 4건의 blocker 내용은 이 WU 에서도 펼치지 않았다
```
