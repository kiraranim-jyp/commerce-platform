# WU-018-P10 — 그 `PRESUMED_SAME` 하나가 가격/판매/등록까지 가는가

🔴 AI 0 · Gemini 0 · 외부 검색 API 0 · 키 0 · 결제 **₩0** · DB 쓰기 0 · schema 0 ·
UI 0 · threshold 0 · **색상 사전 0** · **보류 정책 0** · Registry 0 · 배포 0 ·
**운영 코드 변경 0**. 🟡 판매처 GET 1회. 🔴 P10 **한 건만** 봤다.

---

## 1. 🟢 현재 — crossing 이 **구조적으로 불가능하다**

```
`collectAiAnswerCandidatePool` 의 **운영 호출부 = 0**
(정의 1줄 + index 재노출 1줄뿐 · 주석 벗긴 전수 스캔으로 테스트가 잠갔다)
→ 새 AI URL 경로의 후보는 **tier·가격·판매판정·등록판정에 도달할 수 없다.**
🔴 호출부가 생기면 그 테스트가 FAIL 한다 — 그때 이 trace 를 다시 돌린다.
```

## 2. 🔴 「배선되면」 어디까지 가는가 — 운영 함수로 실측

🔴 복제식 0 — 운영 `judgeDomesticCandidate`(run-domestic-price-check.ts:619)와
`priceTierFromLink`(domestic-product-link.ts:86)를 **그대로** 불렀다.

```
원상품    AW26MS185 Bubble Sweatshirt **Grey Melange** (Main Story)
후보      deuxbebe 「AW26MS185 - Bubble Sweatshirt - **Rose Shadow**」
MI        crossSeller=PRESUMED_SAME · matchLevel=low · conf=0.62
후보 facts colorText **null** · brandModelCode "AW26MS185"
judgement kind=JUDGED · modelCode evidence=**exact** · domestic="AW26MS185"
          matchTruth **TEXT_CONFIRMED** · verified **false**
🔴 tier    **COMPARISON**   ← 🟢 **EXACT(동일상품 가격)에 닿지 않았다**
후보 가격  KRW 117,000 · priceStatus **UNVERIFIED_SEARCH**
```

🟢🟢 **품번이 글자 하나까지 같은데(`exact`) EXACT 가 되지 않았다.** 그것이 이 WU 의 답이다.

## 3. 🟢🟢 막는 것은 **두 겹** 이고 각각 단독으로 충분하다 (음성 대조)

`deriveMatchTruth`(match-truth.ts)의 한 분기에 세 조건이 OR 로 묶여 있다 —
`!observedDifference && !crossSellerReserved && !colorUnverified`.

| 변형 | 결과 |
|---|---|
| M1 `colorUnverified` 만 무력화 | **변화 없음** (TEXT_CONFIRMED / COMPARISON) |
| M2 `crossSellerReserved`(=PRESUMED_SAME) 만 무력화 | **변화 없음** |
| M3 **둘 다** 무력화 | 🔴 `STRONG_IDENTIFIER` / tier **EXACT** / verified **true** → 단언 FAIL |
| 원상복구 | TEXT_CONFIRMED / COMPARISON / PASS |

🔴 **내 가설이 반증됐다** — 처음에 「색상 미확인 방어가 막았다」고 읽었는데, M1 이
변화 0 을 냈다. 실제로는 **「PRESUMED_SAME = 확정 보류」가 단독으로도 막고**, 색상
미확인 방어가 **같은 방향의 두 번째 겹** 이다. 🔴 하나만 보고 단정하면 틀린다.

🟢 그리고 M3 에서 `verified` 가 **true** 로 바뀐다 — 그 두 겹이 없으면 **자동확정** 까지
열린다. 안전장치의 가치가 수치로 드러났다.

## 4. 🟢 운영 재현 일치 (§5-B 성격의 증거)

운영 DB 의 이 쌍(`domestic_product_links`)에 저장된 값이 **`match_truth = TEXT_CONFIRMED`
(confidence 0.4)** 다. 🟢 이 trace 가 낸 값과 **같다.** 🔴 confidence 숫자는 다르다
(0.62 vs 0.4) — 운영은 어댑터(목록 마크업) 경로로 더 많은 사실을 얻는다. **어느 쪽이
맞다고 단정하지 않는다.**

## 5. 그 뒤 단계 — 🔴 **이 WU 에서 재조사하지 않았다**(CPO 범위)

```
representative price / sellability / registration readiness 는 **EXACT 버킷** 기반이고
이 후보는 COMPARISON 이라 그 입력이 되지 않는다.
🟢 근거는 기존 확정 기록 인용이다 — 「exact.sellerCount>0 이면 COMPARISON 전체가
   무시된다」 · 「돈은 EXACT 버킷에서만 움직인다(price-history.ts:644)」.
🔴 **재측정하지 않았다**(WU-015A/016 재감사 금지). 「측정했다」로 적지 않는다.
🔴 가격도 `UNVERIFIED_SEARCH` 라 운영 가격 게이트(`VERIFIED_CURRENT && KRW`)를 통과
   하지 못한다 — 🔴 이것도 **기존 기록 인용** 이고 이 WU 에서 게이트를 다시 재지 않았다.
```

## 6. 결론

```
영향 있음/없음   🟢 **없음** — ① 현재 호출부 0 ② 배선돼도 tier 는 COMPARISON
영향 단계        COMPARISON 까지(동일상품 가격 등급에 미도달)
최소 수정 필요    🔴 **없음** — 코드 변경 0 으로 닫는다
```

🔴 색상 사전 · threshold · 보류 정책 **전부 건드리지 않았다.**
🔴 P10 외의 정확도 문제로 확장하지 않았다.
🔴 **CEO Action: NONE** · main 미반영 · 배포 0.
