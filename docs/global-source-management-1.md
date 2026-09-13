# GLOBAL-SOURCE-MANAGEMENT-1

**등록일** 2026-09-13 · **지시** CEO, 2026-09-13 · **상태** 🔵 Phase 1 조사 중
**선행 스프린트** MATCHING-2.0 (후보 발견 로직 개선까지 유지, 그 이후 중단)

---

## 0. 이 이슈가 생긴 경위

`MATCHING-2.0-INTEGRATION-4` 검증 중, Smallable 430701의 Bobo Choses 동일상품이
MI에 뜨지 않는 직접 원인이 **매칭이 아니라 소스 설정**임이 실측으로 드러났다.

```
domestic_price_sources.enabled            = false   2026-09-10 23:35:27Z  (카탈로그)
workspace_domestic_shop_settings.enabled  = false   2026-09-11 03:03:59Z  (워크스페이스)
   → 실효값 false → 검색 목록에서 제외 (run-domestic-price-check.ts:331)
```
`03:03:59.941Z` 한 시각에 `29cm · musinsa · ssfshop · wconcept · bobochoses` 5곳이
동시에 off 됐다. 설정 화면에서 일괄로 끈 것으로 보인다.

**CTO가 "Bobo를 임시로 켜서 검증하자"고 제안했고, CEO가 그것을 기각했다.**
임시로 켜면 잘못된 상태를 고정하기 때문이다. 그 판단이 옳다.

## 1. 이번 사건에서 얻은 설계 결론 (CEO 확정)

> **"국내 가격을 제공하는 사이트"와 "국내 판매처"는 같은 개념이 아니다.**
>
> **"글로벌 사이트에서 KR 가격을 제공한다"와 "그 사이트를 국내 편집샵 검색 대상으로
> 삼는다"도 같은 개념이 아니다.**

Bobo Choses를 `국내 편집샵 관리`에서 끄면 MI에서 **완전히 사라지는** 현재 구조가
이 개념을 분리하지 못하고 있다는 신호다. 이 구조를 두면 Nike·Adidas·COS·Zara 같은
글로벌 사이트를 추가할 때마다 국내 소스 관리 구조를 억지로 이용하는 문제가
반복된다.

## 2. 목표

```
국내 / 해외 / 글로벌 판매처를 구분하고,
글로벌 판매처의 국가별 가격을 독립적으로 관리할 수 있는 구조 확립
```

## 3. 분리해야 할 두 축 (CEO 확정)

이 둘은 **다른 개념**이며, 현재 구조는 이를 섞고 있다.

| A · 판매처 유형 | B · 제공 시장 |
|---|---|
| 국내 판매처 | KR |
| 해외 판매처 | US / JP / FR … |
| 글로벌 공식몰 | 여러 시장 |
| 마켓플레이스 | |

```
SOURCE  Bobo Choses   (유형 = GLOBAL)
   ├── MARKET KR → ₩168,000
   ├── MARKET FR → €75
   ├── MARKET US → $…
   └── MARKET JP → ¥…
```
`seller_type`은 이미 있다(마이그레이션 046: `DOMESTIC / OVERSEAS / GLOBAL / MARKETPLACE`,
그리고 `bobochoses.com`은 이미 `GLOBAL`로 지정돼 있다). **새 seller_type을 만드는
것부터 시작하지 않는다.**

## 4. 파이프라인 분리 (CEO 확정)

글로벌 소스를 **국내 가격 검색과 같은 파이프라인에 넣지 않는다.** 목적이 다르다.

```
국내 시장 분석          한국에서 경쟁 상품이 얼마에 팔리고 있는가?
                       → P0/P1 우선순위 · 국내 후보

글로벌 판매처 분석      동일상품이 다른 판매처에서 얼마에 팔리고 있는가?
                       → 동일상품 후보 탐색 · 판매처별 가격
```

이 분리가 있어야 다음이 자연스럽게 설명된다:
```
Smallable KR  ₩113,629
Bobo KR       ₩168,000
```

## 5. MI 화면의 세 영역 (CEO 확정)

```
국내 시장           국내 판매처 중심
글로벌 시장         원본 판매처의 국가별 가격
동일상품 판매처     국내/해외/글로벌 구분 없이 SAME으로 확정된 판매처만
```

**중요:** Bobo가 `GLOBAL`이라는 이유로 **동일상품 비교에서 빠질 이유가 없다.**
오히려 `Bobo Choses · GLOBAL · KR ₩168,000` 으로 자연스럽게 들어가야 한다.

## 6. 설정 화면 방향 (CEO 제안)

현재 `국내 편집샵 관리` 하나에 전부 들어 있는 것은 구조적으로 맞지 않다.

```
가격 수집 소스 관리
  [ 국내 판매처 ]   무신사 · 29CM · W Concept …
  [ 해외 판매처 ]   Smallable …
  [ 글로벌 공식몰 ] Bobo Choses …
                      ├─ 🇰🇷 KR
                      ├─ 🇫🇷 FR
                      ├─ 🇺🇸 US
                      └─ 🇯🇵 JP     ← 시장별 probe/수집을 따로 관리
```

## 7. Phase 1 — 조사만 한다

> **기존 DB와 migration을 바로 변경하지 말고 먼저 현재 구조를 조사한다.** (CEO)

반드시 검토할 10개:

```
1.  seller_type                 실제 값 분포 · 누가 읽는가 · 읽지 않는다면 왜
2.  source enabled              카탈로그 전역 플래그
3.  workspace enabled           워크스페이스별 플래그 (047)
4.  domestic category_scope     049 · sourceFitsScopes
5.  market_code                 046 · 관측 시점의 시장 코드
6.  market_country              046 · source가 선언한 기준 국가
7.  global market probe         MARKET_PROBE source_label · 비용 기준 관측
8.  동일상품 매칭                cross-seller / match-truth / domestic_product_links
9.  국내 가격 집계               market-intelligence.ts · summarizeDomesticMarketSplit
10. 글로벌 판매처 가격 비교      global-market.ts · same-product-sellers.ts
```

산출물: `docs/global-source-management-1-findings.md`
**코드 변경 0줄 · 마이그레이션 0건 · DB 쓰기 0건.**

## 8. Phase 1에서 반드시 답해야 할 질문

1. `seller_type`이 실제로 **읽히는가**? 읽히지 않는다면 그게 이번 사건의 뿌리다.
   (046이 값을 넣어 뒀는데 아무도 안 보면, Bobo는 이름만 GLOBAL이고 동작은 DOMESTIC이다.)
2. 한 소스를 끄면 **무엇이 함께 꺼지는가**? 국내 검색 / 글로벌 시장 관측 /
   동일상품 비교 — 이 셋이 한 플래그에 묶여 있는지.
3. `market_code` / `market_country`가 **소스 단위로 관리되는 자리가 있는가**,
   아니면 관측 결과에만 있는가?
4. 글로벌 시장 관측(`MARKET_PROBE`)은 어떤 플래그를 보고 도는가? 국내 검색과
   같은 플래그인가?
5. 지금 off된 5곳(`29cm · musinsa · ssfshop · wconcept · bobochoses`)은
   각각 어떤 유형이어야 하는가?
6. Smallable은 카탈로그에 있는가? 없다면 원본 판매처는 어떻게 표현되고 있는가?

## 9. 하지 말 것

```
❌ Bobo Choses를 임시로 켜서 430701 검증 끝내기   ← CEO가 명시적으로 기각
❌ 마이그레이션 작성 / DB 쓰기 / seller_type 값 변경
❌ 새 seller_type 신설부터 시작
❌ 설정 화면 구현 (Phase 1은 조사다)
❌ MATCHING-2.0 판정 로직 손대기 (별건: matching-2.0-regression-430632.md)
```

## 10. 이 스프린트가 끝나면

설계 확정 후 **Bobo를 첫 번째 실상품**으로 써서 다시 검증한다:
```
430701  →  B226AC114  →  🟢 동일상품  →  ₩168,000  →  MI 화면
```

## 11. 미결로 넘어가는 항목

- **MATCHING-2.0-INTEGRATION-4 STEP 2~6** — 미검증. 이 스프린트 이후로 연기.
- **`F-21`** `/api/price-history/check` 에 `maxDuration` export 없음 → 타임아웃 시
  링크만 남고 관측이 통째로 빌 수 있다. 실제 결함 후보이나 검증 변수를 늘리지
  않기 위해 보류 중(CEO 동의).
- **`430632` SAME 오탐** → `docs/matching-2.0-regression-430632.md`
- **`430651 ↔ B226AC043`** 진위 미확인.
- **누가 왜 5곳을 껐는지** 감사 로그 미확인.
