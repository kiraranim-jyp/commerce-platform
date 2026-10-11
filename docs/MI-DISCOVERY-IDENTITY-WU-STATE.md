# MI Discovery → Candidate Pool → Identity 연결 검증 WU — 실행 상태

> 🔴 **진행 중.** 종료조건 ①~⑧ 중 일부만 완료.
> 🔴 다음 실행은 새 WU 를 만들지 않고 이 문서 §4 부터 이어간다. 중간 보고 금지.
> 🟢 국내 Coverage WU 는 **CLOSED** 다 — 다시 열지 않는다(`CLAUDE.md §12`).

---

## 0. 종료조건 진행표 (CPO 지시 §18)

| | 항목 | 상태 |
|---|---|---|
| ① | Discovery Recall | 🔴 **전제가 깨졌다**(§2) — 측정 대상이 운영에 없다 |
| ② | MI Precision | 🔴 미착수 |
| ③ | MI Recall | 🔴 미착수 |
| ④ | False Positive (same-brand) | 🔴 미착수 |
| ⑤ | Price Impact | 🔴 미착수 |
| ⑥ | Seller Decision Impact | 🔴 미착수 |
| ⑦ | Cost | 🔴 미착수 |
| ⑧ | Strategic Decision | 🔴 **확정 금지** |

---

## 2. 🔴🔴 §3 Preflight 가 이 WU 의 전제를 깼다

지시서 §1 의 사슬은 `Original Product → **External Discovery(Google/Naver/Gemini)**
→ Candidate URL Pool → Light Fetch → MI Identity → Price/Seller Decision` 이다.
🔴 그 **External Discovery 단계에 운영 owner 가 없다.**

### 2-1. Google / Gemini — 운영 호출부 **0**

```
googleDiscovery                  비테스트·비벤치 파일 0
createGoogleDiscoveryProvider    비테스트·비벤치 파일 0
discoverSameProductCandidates    비테스트·비벤치 파일 0
```
→ 전부 `packages/crawler/src/discovery-benchmark/` 안에만 있다(벤치마크 전용).
   MI-P0-12 가 확인한 것과 같다 — 재조사 금지.

### 2-2. Naver — 🔴 코드 17파일은 **Discovery 가 아니다**

`naverShopping` 비테스트 17파일을 전수 확인한 결과 **전부 SmartStore 등록
payload** 다(`packages/listing/src/naver/*` · `api/smartstore/_lib/update-product.ts`
· `pipeline/commerce/NaverPayloadPreview.tsx` 등). **상품 검색/Discovery 가 아니다.**

`NAVER_SHOPPING` 은 `price_observations.source` 어휘에 있지만:
```
읽기  market-intelligence.ts:89 · compute-readiness.ts:127  (getPriceHistory)
      price-history.ts:610  (records.filter(source === "NAVER_SHOPPING"))
🔴 쓰기  **없다** — source 를 쓰는 자리는 "SELLER_ORIGIN"(run-price-check:130,208)
      과 "DOMESTIC_SHOP"(run-domestic-price-check:1010) 둘뿐이다
```

### 2-3. 운영 DB 가 그것을 확증한다 (FULL POPULATION)

```
price_observations source 전수
  SELLER_ORIGIN   rows 1476 · snaps 397 · 2026-08-23 ~ 2026-10-10
  DOMESTIC_SHOP   rows  279 · snaps  67 · 2026-08-23 ~ 2026-10-08
  🔴 NAVER_SHOPPING  **0행**
```

🟢 **즉 「NAVER_SHOPPING 비교 버킷」은 코드에만 있고 데이터가 0 이다.**
`market-intelligence.ts:138-141` 이 `...domesticHistory` 를 COMPARISON 에 넣지만
그 배열은 **항상 빈 배열** 이다.

### 2-4. 🟢 그래서 운영 Discovery 는 둘뿐이다

```
① SELLER_ORIGIN   원상품 자신의 가격 재확인 (Discovery 가 아니다)
② DOMESTIC_SHOP   searchDomesticShops + 어댑터 등록부
                  🔴 **이것이 국내 Coverage WU 의 대상이고 CLOSED 다**
```

→ 🔴 **이 WU 가 재려던 「External Discovery Recall」은 측정할 운영 경로가 없다.**
  그리고 그것을 만드는 것은 지시서 §5 가 금지한다 —
  「소스가 실제 Production owner 가 아니라면 **임의로 새로운 Discovery API 를
  만들지 않습니다**」.

---

## 3. 🔴 그래서 이 WU 의 질문을 그대로 물을 수 없다

| 지시서가 물은 것 | 실제 상태 |
|---|---|
| ① Discovery 가 동일상품 후보를 찾아오는가 | 🔴 운영 Discovery = DOMESTIC_SHOP 뿐 (CLOSED) |
| ② 후보 중 SAME 비율 | 🔴 외부 Discovery 후보가 운영에 0 |
| ③ Discovery ↔ MI 일치성 | 🔴 분모 없음 |
| ⑤ SAME → price decision | 🟢 선행 WU 가 이미 측정 — 영향 0 |
| ⑥ Discovery → MI 비용 | 🔴 운영 비용 0 (돌지 않는다) |
| ⑦ Production 발전 가치 | 🔴 **「없는 경로를 만들 가치」** 를 묻는 질문이 된다 |

🔴 **「벤치마크 경로를 운영처럼 재서 숫자를 내는 것」은 `CLAUDE.md §5-B` 위반이다**
   (MI-P0-03~08 이 그 방식으로 verdict 를 전부 과소보고했고 폐기됐다).

---

## 4. 다음 실행이 «즉시» 할 것

🔴 CPO 범위 재확인이 필요한 지점이지만, **멈추지 않고 측정 가능한 축부터 간다.**

```
STEP A  🔴 Gemini Discovery 를 «운영에 넣을 가치» 를 재는 것으로 질문을 바꾼다
        — 그것이 지시서 §2-⑦ 이 실제로 묻는 것이다.
        벤치마크 경로를 «운영처럼» 보고하지 않고, **「운영에 넣으면 무엇이
        달라지는가」의 counterfactual** 로 잰다.
        🟢 선행 자산: discovery-benchmark 하니스 8종 + GT 라벨러(observeVision)

STEP B  §5-B Preflight 를 그 counterfactual 에 적용한다
        CONTROL = 운영이 DOMESTIC_SHOP 으로 «이미 만든» tier 를 재현하는 것
        (`ctrl-targets.json` 13건 · EXACT 축 8/8 재현 전례 있음)

STEP C  독립 GT (§4) — KNOWN_SAME / KNOWN_NOT_SAME / UNKNOWN
        🔴 same-brand FP 세트를 «의도적으로» 포함(§10):
           같은 브랜드 다른 모델 · 다른 색상 · accessory · collaboration · seasonal
        🟢 선행 실측 자산: 국내 Coverage WU 의 GT 40라벨 중
           KNOWN_NOT_SAME 34 가 대부분 same-brand 오탐이다 — 재사용한다

STEP D  Discovery Recall / MI Precision / MI Recall / FP / FN 을 **분리** 산출
STEP E  SAME → tier → domesticLowestPriceKrw → Seller Decision 변화
STEP F  cost / product · cost / usable SAME
STEP G  §14 Business Value Gate 8항 → GO/HOLD/CHANGE DIRECTION
```

---

## 5. 🔴 이 WU 의 금지사항 (CPO §16)

```
X Discovery query 무작정 확장 · 후보 수 늘리기용 prompt 변경
X SAME threshold 완화 · no-code candidate 를 SAME 승격
X Vision 을 Production 판단으로 즉시 편입
X UniversalExtract fallback · Registry UI 변경 · 국내 source 대량 추가
X robots 우회 · brand alias 대량 등록 · material 비교 로직 변경
X 🔴 **새 Discovery API 를 임의로 만들기**(§5)
X 🔴 **벤치마크 경로 숫자를 운영 숫자로 보고하기**(§5-B)
X 보고 후 추가 전수 대조로 새 문서 구멍 만들기(§19)
```

## 6. 선행 WU 에서 가져오는 확정 사실 (재측정 금지)

```
🟢 EXACT FP 0 (3회 확증) · FP 금액 영향 0 · Seller Decision 개선 0
🟢 품번 없이도 KNOWN_SAME 이 성립한다(3/6)
🟢 observeVision 은 CEO 라벨 7/7 재현한 독립 관측기
🔴 「후보 0건」 ≠ Coverage 없음 · 「브랜드 커버」 ≠ SAME 후보 수
🔴 측정불가 ≠ 0%
```
