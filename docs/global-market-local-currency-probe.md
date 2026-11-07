# GLOBAL-MARKET-LOCAL-CURRENCY-PROBE

**등록일** 2026-09-13 · **지시** CEO, 2026-09-13 (`GLOBAL-ORIGIN-PRICE-WIRING-1` STEP 8)
**상태** 🔴 **완료 조건 1·2 의 전제가 반증됐다 — 판정은 `docs/PHASE2-SMALLABLE-LOCAL-CURRENCY-VERDICT.md`**

---

## 🔴🔴🔴 2026-11-07 추가 — **이 문서를 읽고 바로 구현하지 않는다**

```
🔴 아래 완료 조건 1·2 는 **「`?currency=JPY` 가 돌려주는 값이 일본 시장이 스스로 정한
   엔화 가격」** 이라는 전제 위에 있다. 🔴 **라이브 실측이 그 전제를 반증했다**(PHASE 2).

국가 × 통화 격자(상품 430753 · 2026-11-07)
          EUR      JPY        USD
   JP      54     10,078       63
   KR      49      9,145       57
   US      53      9,892       62
   JPY/EUR  186.630 · 186.633 · 186.642   편차 **0.006%**
   🔴 단일 환율 구간이 비어 있지 않다 ⟹ **하나의 환율표가 격자 전부를 설명한다**

⟹ 🔴🔴 Smallable 의 `?currency=JPY` 는 **사이트가 자기 환율로 EUR 를 바꾼 값** 이다.
   그것을 저장하는 것은 **이 문서 §2 가 절대 금지한 그 행위** 와 같은 산술이다
   (환산 주체만 우리에서 사이트로 바뀐다).
🟢 운영 코드가 처음부터 그렇게 적어 뒀다 — `smallable-market-probe.ts:28-30`.

🟢 **현지통화 관측은 다른 경로에서 «이미» 작동한다**(운영 DB 실측) —
   `louisemisha.com` en-jp **JPY**(6통화) · `bobochoses.com` en-us **USD** ·
   `junioredition.com` en-int JPY ↔ `www.smallable.com` **1통화(EUR)**.
   ⟹ 🔴 아래 §1 의 「지금은 전부 EUR이다」는 **Smallable 한 판매처의 성질** 이고
      제품 전체의 결함이 아니다.

🟢 완료 조건 **3·4·5 는 이미 충족** 돼 있다(`—` 표시 · 원본가 불변 · 라이브 실측).
🔴 완료 조건 **1·2 는 Smallable 에서 구조적으로 달성 불가** 다.
🟢 그 결론을 **계약 10건 + 변이 3종** 으로 잠갔다 —
   `packages/crawler/src/__tests__/phase2-market-currency-is-not-site-fx.test.ts`.
🔴 그리고 PHASE 1 의 「① `market_country` 채우기」는 **효과 0 · 의미 충돌** 로 정정됐다
   (글로벌 시장 카드가 그 칸을 읽지 않고 `global-market.ts:44` 가 읽기를 금지한다).
```

---

## 1. 문제

글로벌 시장 카드의 각 줄은 **그 시장의 현지 통화**로 말해야 한다. 지금은 전부 EUR이다.

```
현재 (Production DB, Smallable 430701)     원하는 모습
🇫🇷 프랑스   €75   ≈ ₩116,742              🇫🇷 €75      ≈ ₩116,742
🇰🇷 한국     €73   ≈ ₩113,629              🇰🇷 ₩114,464
🇺🇸 미국     €79   ≈ ₩122,968              🇺🇸 $91      ≈ ₩…
🇯🇵 일본     €81   ≈ ₩126,081              🇯🇵 ¥13,365  ≈ ₩…
```

원인은 크롤러가 **모든 시장에 `currency=EUR`을 강제**하기 때문이다
(`packages/crawler/src/smallable-market-probe.ts`). 그래서 45행 전부 EUR이고
JPY·USD 관측이 단 한 건도 없다.

## 2. 절대 금지 — 이것이 이 문서의 존재 이유

```
❌ €81  →  환율  →  ¥13,365  로 표시하거나 저장
```

CEO 원문: *"실제 JP 시장에서 JPY로 관측된 데이터가 있어야 한다. 없으면 임의 환산하지 않는다."*

**환산이 아니라 실제 JPY 관측을 수집하는 방식으로 해결한다.** 관측이 없으면 `—`.

## 3. 실측 (2026-09-13, 한국 egress)

### Smallable — 축 2개, 둘 다 접속 위치가 기본값

```
?currency=EUR&country=JP   →  EUR 81
?currency=JPY&country=JP   →  JPY 13,365      ← 일본 시장의 현지 통화 가격
?currency=JPY&country=KR   →  JPY 12,045      ← 한국 가격을 엔화로 쓴 것.  일본 가격 아님
?currency=USD&country=US   →  USD 91
?currency=KRW&country=KR   →  KRW 114,464
?country=JP  (통화 미지정)  →  KRW 127,008    ← 한국에서 요청했기 때문
```

**`currency`를 주지 않으면 응답 통화가 egress에 좌우된다.** RULE 1(접속 국가 무관)을
지키려면 통화를 명시하는 수밖에 없고, 그 말은 **시장 → 통화 대응을 우리가 정해야
한다**는 뜻이다. 이것이 이 작업의 핵심 설계 결정이다.

### Bobo Choses — 축 1개, 시장이 통화를 함께 선언

```
?country=ES  →  EUR 75        ?country=US  →  USD 108
?country=GB  →  EUR 83.50     ?country=KR  →  KRW 168,000
```
**대응표가 필요 없다.** `?country=XX`만 주면 스토어가 통화를 알려준다.

⚠️ 단, `ships_to_countries`에 없는 나라는 **본국 가격을 조용히 돌려준다**:
```
?country=JP  ≡  ?country=XX  →  EUR 75 (스페인 가격)
```
`14a7f7c`에서 `marketMayBeObserved()` 가드를 넣어 이 경로는 막혔다.

## 4. 그래서 설계 질문

1. **시장 → 통화 대응을 어디에 둘 것인가.** 코드에 국가별 목록을 심는 것은
   `GLOBAL-SOURCE-PRICE-POLICY-FINAL` §F에서 금지됐다. 사이트가 스스로 선언하는
   값을 쓸 수 있는가?(Shopify `localization`/`/meta.json`은 가능, Smallable은 미확인)
2. **Smallable이 유효 시장 목록을 선언하는가?** 선언하지 않으면 Bobo의
   `ships_to_countries` 같은 가드를 어떻게 만들 것인가.
3. **한국 행은 `₩114,464`인가 `€73`인가.** 현지 통화 원칙대로면 원화다.
   (CEO 예시표에는 `€73`으로 적혀 있어 확인이 필요하다.)
4. **기존 EUR 관측 45행을 어떻게 할 것인가.** 역사 데이터 불변 원칙상 보존한다.
   그러면 한 시장에 EUR 관측과 현지통화 관측이 공존하는데, 화면이 무엇을 고를지
   규칙이 필요하다.

## 5. 하지 말 것

```
❌ 환율로 현지 통화를 만들어 내기
❌ 국가 → 통화 목록을 코드에 하드코딩          (§F 금지)
❌ 기존 EUR 관측 삭제·재계산
❌ 배송하지 않는 시장에 프로브 (Bobo JP 사례 — 본국 가격이 그 나라 관측으로 저장됨)
❌ 원본 가격을 건드리기 — 이 작업은 글로벌 시장 카드 전용
```

## 6. 완료 조건

1. JP 행이 **실제 JPY 관측**으로 표시된다 (`¥13,365 ≈ ₩…`).
2. US 행이 실제 USD 관측으로 표시된다.
3. 관측이 없는 시장은 `—`. 지어낸 값이 0건.
4. 원본 가격이 바뀌지 않는다 — Smallable FR €75 / Bobo ES €75 / Junior Edition £37.
5. 라이브 실측으로 확인. 손으로 쓴 fixture 불인정.

## 7. 선행 조건

```
① Bobo ES €75 → ORIGIN_FX 연결  (GLOBAL-ORIGIN-PRICE-WIRING-1)
② Production 화면 확인
③ 이 작업                                     ← 여기
④ Similar / 가격비교 영역 최종 정리
```
