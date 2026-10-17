# WU-051 FINAL — AI 발견 국내 URL 6건 완결 + 시장 분류 게이트 안전 수정

> 🔴🔴 **판정 = HOLD** (국내 시장 분류 확대). 🟢 단 **§5 KRW 오분류 결함은 수정·배포 완료.**
> 🔴🔴 그리고 **WU-050 의 내 진단이 이 6건에서는 발화하지 않았다** — 정정한다(§1-C).

---

## 1. §1 — P0-1~P0-4 전건 측정 (🔴 AI 판정·AI 가격 미사용)

```
P0-1 pool 진입        **2 / 6**
P0-2 MI SAME          **0 / 2**
P0-3 검증 KRW         **0 / 0**
P0-4 국내 가격비교    **0 / 0**
```

### A. URL 별 **첫 탈락 지점** (뒤 단계는 도달하지 못했으므로 중복 계상 안 함)

| # | 원상품 | URL(호스트) | 결과 | 단계 |
|---|---|---|---|---|
| 1 | A · AC009 | `beaumonde.co.kr/goods/goods_list.php?cateCd=003` | SIMILAR | **C MI MISS** |
| 2 | B · AC042 | `coupleshot.com/shop/shopbrand.html?type=X&xcode=011` | `NO_FACTS` | **A DISCOVERY MISS** |
| 3 | B · AC042 | `lfmall.co.kr/app/search/result/보보쇼즈+집업` | `NOT_PRODUCT_PAGE` | **A DISCOVERY MISS** |
| 4 | C · AC043 | `beaumonde.co.kr/goods/goods_list.php?cateCd=002&page=4` | SIMILAR | **C MI MISS** |
| 5 | C · AC043 | `lfmall.co.kr/…%%EC%A6%88…` (원본 `%%` 보존) | `NOT_PRODUCT_PAGE` | **A DISCOVERY MISS** |
| 6 | C · AC043 | `lotteon.com/csearch/search/search?q=보보쇼즈26` | `NOT_PRODUCT_PAGE` | **A DISCOVERY MISS** |

```
A DISCOVERY MISS  **4**      B EXTRACTION MISS  0
C MI MISS         **2**      D PRICE GATE MISS  0      E UI MISS  0
HTTP 요청 총 3회 · providerCalls **0** · AI 호출 **0**
```

🔴 **CPO 지시대로 원본을 고치지 않았다** — `utm_source=chatgpt.com` 유지, LFmall C 의
깨진 `%%` 도 유지. 🟢 그 URL 은 `NOT_PRODUCT_PAGE` 로 떨어졌고 **원본 URL 실패로 기록** 한다.
🔴 정정 URL 을 만들어 다시 재지 않았다.

### B. 🔴🔴 가장 중요한 발견 — **6건 중 «상품 페이지» 가 하나도 없다**

```
goods_list.php?cateCd=003    카테고리 **목록** 페이지
shopbrand.html?xcode=011     브랜드 **목록** 페이지
/app/search/result/…         **검색 결과** 페이지  (LFmall ×2)
/csearch/search/search?q=…   **검색 결과** 페이지  (롯데ON)
```

🔴🔴 **즉 외부 AI 는 「국내 동일상품 상품페이지」를 찾아내지 못했다.** 「보보쇼즈를 파는
사이트의 목록/검색 주소」를 돌려줬다. 🔴 그러므로 WU-050 의 출발 질문
—「AI 는 찾았는데 우리가 왜 못 쓰는가」— 의 **전제가 이 표본에서 성립하지 않는다.**
우리 시스템이 활용하지 못한 것이 아니라 **활용할 상품 URL 이 오지 않았다.**

🟢 그리고 우리 경계는 **옳게 동작했다** — 검색/목록 URL 3건을 `NOT_PRODUCT_PAGE` 로
막았고 가격·판정을 오염시키지 않았다.

### C. 🔴🔴 **WU-050 의 내 진단을 정정한다**

```
WU-050 에서 나는 「② 시장 게이트(non-`.kr` → UNKNOWN)가 새 발견이자 병목」이라고 적었다.
🔴 **이 6건에서 ②는 한 번도 발화하지 않았다.**
  · 4건이 `.co.kr`/`.kr` 이라 ②의 문제가 애초에 아니고
  · 2건은 가격 자체가 없어 `NO_PRICE_EVIDENCE` 로 끝났다
🟢 ②는 **구조로서 실재** 한다(WU-050 §2 가 코드로 고정). 🔴 그러나 **이 표본의
   구속 조건이 아니었다.** 구속 조건은 **「입력이 상품 URL 이 아니다」** 였다.
```

🔴 분모를 섞지 않았다 — 기존 Registry 자동검색(후보 175 · very_high 3.8%)과 **합산 0.**

---

## 2. §2 — 안전한 국내 시장 증거 전수 조사 → 🔴 **없다**

조사 대상 전부를 코드에서 확인했다(추측 0):

| 증거 후보 | 현재 상태 |
|---|---|
| 도메인 (`.kr`) | 🟢 **이미 쓴다** (`hasKrTld`) |
| 기존 Registry metadata | 🟢 **이미 쓴다** (충돌 감지용) |
| currency | 🔴 **단독 사용 금지**(WU-020 §4) |
| locale / path | 🔴 `ComparisonCandidate` 에 칸 **0** |
| seller country | 🔴 칸 **0** |
| shipping / market | 🔴 칸 **0** |
| 페이지 언어 (`html lang`) | 🔴 crawler 가 **읽지 않는다**(grep 0) |
| `og:locale` · `hreflang` | 🔴 **읽지 않는다**(grep 0) |
| JSON-LD `areaServed` · `availableAtOrFrom` · `acceptedPaymentMethod` | 🔴 **읽지 않는다**(grep 0) |

```
⟹ 오늘 쓸 수 있는 KR 증거는 **`.kr` TLD · 등록부** 둘뿐이고
   **셋째 증거는 추출조차 되지 않는다.**
```

🔴 즉 §3-B(「기존 페이지 증거 활용」)는 **기존 증거로는 불가능** 하다 — 새 추출기가
선행이고 그것은 새 capability + 정책 결정이다.

---

## 3. §3 — 10축 · A/B/C 비교

| 안 | False domestic | False overseas | Registry 밖 국내 회수 | 가격/판매판정 영향 | 판정 |
|---|---|---|---|---|---|
| **A 현행 유지**(`.kr`/등록부) | 🟢 0 | 🟡 non-`.kr` 국내샵이 UNKNOWN | 🔴 `.kr` 만 | 🟢 0 | 🟢 **채택** |
| **B 기존 페이지 증거** | ⚪ 측정불가 | ⚪ 측정불가 | ⚪ 측정불가 | ⚪ | 🔴 **불가** — 증거가 **추출되지 않는다**(§2) |
| **C KRW 단독** | 🔴 **증가**(해외 샵의 KRW 표시가 국내가 된다) | 🟢 감소 | 🟢 전부 | 🔴 원가·최저가 오염 | 🔴 **금지**(WU-020 §4) |

🔴 **B 를 「측정불가」로 적는다 — 0% 로 적지 않는다.** fixture 로 재려 해도 입력 칸 자체가
없어서 **분모를 만들 수 없다**(§5-B).

```
① Registry 🟢우회가능(재조사0)  ② transient 🟢재사용(재조사0)  ③ candidateUrls 🟢정상(재조사0)
④ searchDomesticShops 🟡다른 실패지점   ⑤ 외부 AI 🔴금지   ⑥ 직접 URL 🟢구현됨
⑦ extraction 🔴 **이 표본의 병목**(목록/검색 URL)   ⑧ MI 🟢정상(SIMILAR 로 올바르게 거부)
⑨ price gate ⚪미도달   ⑩ 시장 게이트 🟡실재하나 이 표본에서 미발화
```

---

## 4. §4 — 보호 조건 유지 확인

```
🟢 bobochoses.com → OVERSEAS → 해외 참고가격   (WU-038 CONTROL 재현 · EUR 40/75)
🟢 「한국 판매처처럼 보인다」는 추측으로 DOMESTIC 승격 **0건** — 코드에 그 경로가 없다
🟢 국내 축 코드 **무변경**
```

---

## 5. §5 — 🟢 **KRW → 「해외 참고가격」 오분류 수정 (구현)**

운영 1파일 · `market-intelligence.ts` 의 `market !== "KR"` 가지 **안** 에 가드 한 덩어리.

```ts
if (e.priceCurrency?.trim().toUpperCase() === "KRW") {
  geminiPricedCount.krwWithoutKrEvidence += 1;
  continue;                       // 🔴 해외 축 push «앞» 에서 끊는다
}
```

🔴 **고치는 방향을 「KRW 면 국내로 본다」로 잡지 않았다** — 그것이 CPO 가 금지한 통화 단독
결정이다. 🟢 대신 **어느 가격 축에도 넣지 않는다** — 이 파일의 기존 원칙과 **같은 처리**
(WU-020 §6 「귀속시킬 수 없는 가격은 버리지 않지만 가격 축에도 넣지 않는다」).

🟢 **정보가 사라지지 않는다** — 후보 자체는 남고, 셀러는 **개별 후보 줄에서 그 금액을
그대로 본다**(WU-028 구역의 `priceText`). 사라지는 것은 **「해외」라는 거짓 라벨** 뿐이다.
🟢 그리고 「0」과 구분되도록 `krwWithoutKrEvidence` 로 **센다.**

```
🟢 KRW + 국내증거 없음 → 해외 참고가격 ❌   (CPO §5 요구 충족)
🟢 EUR / USD / AUD     → 해외 참고가격 ⭕   (무변경 · WU-049 17 passed)
🟢 KRW + market KR     → 국내 축          (이 분기에 들어오지 않는다 · 무변경)
```

---

## 6. §6 — 시장분류 ≠ 가격검증 (유지)

```
🟢 `DOMESTIC + UNVERIFIED` 는 그대로 보존된다 — 두 판정이 **다른 함수** 다
   (`classifyCandidateMarket` ↔ `priceStatus`). 이 WU 에서 둘을 합치지 않았다.
🟢 국내로 분류돼도 `priceKrw` 는 여전히 `VERIFIED_CURRENT && KRW` 를 요구한다(무변경).
```

---

## 7. 검증

```
§1 측정 하니스  wu-051-ai-domestic-urls.test.ts  (WU_051_LIVE=1 · 실제 HTTP 3회 · 읽기만)
CONTROL         🟢 WU-038 하니스 **전건 재현**(EUR 40 · USD 58 · EUR 75 · False SAME 1)
계약            wu-050 **10** · wu-039 10 · mi-020 26 · wu-049 17 → **63 passed**
음성대조        M1 KRW 가드 제거 **1 FAIL** · M2 카운터만 세고 skip 제거 **1 FAIL**
                → 원상복구 **10 passed**
회귀            admin **559 files / 8,172 passed · failed 0**
typecheck       **0**
build           **exit 0**
security        🟢 fetch/URL 경로 **무변경** — SSRF·redirect·DNS rebinding·사설IP 경계
                (`classifyOutboundUrl`·`guardedLookup`) 한 줄도 건드리지 않았다 ·
                client bundle 새 import **0**
금지 전수       소싱→가격비교 연결 0 · Registry 0 · AI/Gemini 0 · threshold 0 ·
                색상/SKU/GTIN 정책 0 · transient 저장 0 · 환율 0 · 새 외부 API 0
```

---

## 8. 최종 판정

```
🟢 GO    — 아니다. 「안전한 기존 증거로 국내 시장을 분류」할 수 없다(§2 — 증거가 추출되지 않는다)
🟡 HOLD  — **그렇다.** 국내 시장 분류 확대는 **새 추출기 + WU-020 §4 재개정** 이 선행이고
           둘 다 CPO 제품정책 판정 사안이다
🔴 STOP  — 아니다. 외부 API/비용/ToS/보안 경계 요인 없음
──────────────────────────────────────────────────
**HOLD**   🟢 단 §5 결함 수정은 **구현 · 검증 · 배포 완료**
```

---

## 9. 남은 문제

```
🔴 ②의 확대 — 「국내 시장 증거」 추출을 만들 것인가(페이지 언어 · locale · areaServed 등).
   🔴 False domestic 위험을 «측정한 뒤» 결정해야 한다. CPO 판정.
🟡 `goods_list.php?cateCd=003` 같은 **목록 URL 이 상품 페이지로 pool 에 진입했다**(2/6).
   🟢 MI 가 SIMILAR 로 올바르게 거부해 피해는 0 이지만, HTTP 1회와 가짜 후보 1개를 쓴다.
   🔴 shape 분류기 보강은 이 WU 범위가 아니라 손대지 않았다.
🔴 외부 AI 가 **상품 URL 을 주지 못한다** 는 이 표본의 사실 — 🔴 N=6 으로 일반화하지 않는다.
🟡 False SAME 1건(trenbe.com) — WU-037 트랙의 기존 과제. 이 WU 에서 건드리지 않았다.
```

---

## 10. CEO Action — **NONE**

🟢 §5 수정은 **화면 문구가 거짓말하지 않게 하는 것** 이고 숫자를 늘리지 않는다.
🔴 CEO 가 다시 테스트할 필요가 없다 — 이전에 보던 「해외 참고가격」에 KRW 가 섞여 있었다면
이제 그 줄이 빠지고, **개별 후보 줄에서는 그대로 보인다.**
