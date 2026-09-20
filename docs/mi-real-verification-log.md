# MI 실물 정확도 검증 기록 (진행 중 — GO 아님)

- 시작: 2026-09-20
- 상태: **HOLD.** 실물 독립 검증 **PASS 3 / FAIL 0 / UNVERIFIED 2**
- 이 문서는 **코드 변경 기록이 아니다.** 「실제 상품의 독립 정답 ↔ 시스템 결과」 대조 기록이다.

---

## 🔴 PASS 의 정의가 바뀌었다 (CEO 지시, 2026-09-20)

```text
❌ 정확도 PASS 가 «아닌» 것
   테스트 2,613개 통과 · TypeScript PASS · Production READY · API 응답 성공

✅ 정확도 PASS
   사람이 «독립적으로» 확인한 실제 정답  ==  시스템 결과
```

> **「2,613개 테스트 통과 = MI 정확도 PASS」라는 기준을 폐기한다.**

---

## 검증 프로토콜 (4회 반복으로 안정화)

```text
① 시스템 결과를 «보지 않고» URL 만 꺼낸다
② 해외 원본 페이지를 «직접» 읽는다   — 모델코드·상품명·색상·소재·형태
③ 국내 후보 페이지를 «직접» 읽는다   — 같은 항목
④ 🔴 이미지를 «눈으로» 대조한다      — 구조(스트랩·솔·실루엣)가 판정축이다
⑤ ACTUAL_TRUTH 를 먼저 확정한다     — SAME / DIFFERENT / UNRESOLVED
⑥ 그 «다음에» 시스템 결과를 공개한다
```

🔴 **④를 건너뛰면 UNRESOLVED 다.** 텍스트 일치만으로 SAME 을 주지 않는다.
🔴 애매하면 **DIFFERENT 를 우선**한다. 확정 근거가 없으면 EXACT 가 아니라 COMPARISON 이다.

---

## 결과

| # | 대상 | ACTUAL_TRUTH | 시스템 | 판정 |
|---|---|---|---|---|
| 1 | `b226ac043` 가격 | 시장별로 다른 가격 | `MARKET_PROBE` EUR 75 / `KR_MARKET` ₩162,000 | ✅ **PASS** |
| 2 | PèPè Lulu × DEUXBEBE 8021 | **DIFFERENT** | `SIMILAR` → COMPARISON | ✅ **PASS** |
| 3 | `B226AC009` × Bobo Choses KR | **SAME** | `EXACT_IDENTIFIER` → EXACT | ✅ **PASS** |
| 4 | PèPè Lulu × 포레포레 10226592 | **UNRESOLVED** | `STRONG_IDENTIFIER` → EXACT | ⚪ **UNVERIFIED** |
| 5 | Hard Negative #3 (같은 모델·다른 옵션) | — | — | 미착수 |
| 6 | Product 화면 14항목 | — | — | ⚪ UNVERIFIED |

### ① 가격 — `b226ac043`

```
en-fr / en-int / en-de   EUR 75  → ₩116,742   MARKET_PROBE
en-us                    USD 108 → ₩145,021   MARKET_PROBE
en-kr                    KRW 162,000          KR_MARKET
```

🔴 **CTO 가 처음에 「시스템이 틀렸다」고 경보했다가 정정한 건이다.** 저장된
`source_url` 은 `/en-kr`(₩162,000)인데 헤드라인 원본가는 €75 라서 틀려 보였다.
실측하니 **다국가 가격을 전부 잡고 원본가/한국가를 라벨로 구분**하고 있었다.

> **남은 UX 문제**: 화면의 「원본 상품 보기」를 누르면 시스템이 쓴 가격과 다른
> 숫자가 보인다. 가격 수집 오류가 아니라 **검증 가능성(Explainability)** 문제다.

### ② Hard Negative — PèPè Lulu × DEUXBEBE (거짓 EXACT 를 만들지 않았다)

텍스트는 전부 같았다 — 브랜드 PèPè · 소재 Vernice(에나멜) · 색 Nero · 상품군 동일.
**이미지가 갈랐다:**

| | 해외 원본 | 국내 후보 |
|---|---|---|
| 스트랩 | **T-Bar**(세로+가로 T자) | **사선 스트랩 하나**, 세로 바 없음 |
| 솔 | 두툼한 검정 굽 | 얇고 납작한 탄색 |
| 안감 | 탄/브라운 | 핑크·크림 |

시스템 근거: `모델명 유사도 33% | 색상 일치 | 브랜드 일치` → **SIMILAR 에서 멈췄다.**
🔴 원본에 **모델코드가 아예 없는** 상품인데도 EXACT 로 올리지 않았다.

### ③ Positive — `B226AC009` (진짜 동일상품을 찾았다)

양쪽 모두 모델코드 `B226AC009`. 이미지의 그래픽(초록 몬스터 + 주황 곱슬머리
포옹, 우측 세로 `BOBO CHOSES` 각인)이 동일. 국내 ₩88,000.
시스템 근거: `품번이 URL에 포함됨 | modelCode 완전 일치 — 식별자 증거로 자동확정`

### ④ 🔴 다음 세션의 시작점 — PèPè Lulu × 포레포레 `10226592`

**같은 해외 원본에 국내 후보가 둘인데 시스템이 다르게 판정한다.**

```text
PèPè "Lulu T Bar Shoes in Vernice Nero"
  ├─ DEUXBEBE 8021     → SIMILAR           → COMPARISON   (②에서 DIFFERENT 확정)
  └─ 포레포레 10226592   → STRONG_IDENTIFIER → EXACT        ← 미확인
```

국내 후보 제목(실측):
`FORETFORET_AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈-PP24KASHE1195NER`

**형태가 「T-스트랩」으로 명시돼 있다** — ②를 DIFFERENT 로 가른 바로 그 축이
여기서는 일치한다. 그러나 **상품 이미지를 확보하지 못해** 확정하지 못했다
(그 페이지에서 뽑힌 이미지가 전부 배너였다. MakeShop 이라 상품 이미지 경로가
별도다 — 브라우저로 열면 즉시 보인다).

🔴 **이것이 `DIFFERENT → EXACT` 를 잡을 수 있는 가장 가까운 후보다.**
결과가 DIFFERENT 면 **즉시 FAIL · 표본 확대 중단 · matcher 원인 분석**으로 간다.

---

## 확인 못 한 것

| | |
|---|---|
| **Product 화면 14항목** | CTO 가 인증된 Production 화면을 열 수 없다. **코드 조사로 대체하지 않는다**(CEO 지시). CEO 가 직접 확인하는 별도 트랙 |
| **Smallable `jp/us → EUR`** | 라이브 조회 차단(`fetch failed`). 우회하지 않았다. P0-B 의 「`?currency=EUR` 고정 설계」 설명은 **검증된 사실이 아니라 가설**로 내려 둔다 |

### 🔴 Product 화면에서 반드시 볼 것

**PèPè Lulu 상품**(COMPARISON 만 있는 상품)에서 이런 문구가 나오는지:

```text
국내 최저가 ₩234,900보다 현재 판매가가 높습니다
```

나오면 **P0-D.2 정책 A 가 화면 어딘가에서 우회된 것이므로 즉시 FAIL** 이다.

---

## 현재 결론

> **실물 독립 검증 3건에서 가격 1 PASS · 거짓 EXACT 방지 1 PASS · 진짜 SAME 검출
> 1 PASS. FAIL 0. 그러나 표본이 3건이므로 MI 정확도 GO 를 선언할 수 없다.**

「3건 PASS」와 「MI 전체가 정확하다」는 **분리해서** 유지한다.
