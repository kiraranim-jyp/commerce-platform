# MATCHING-3.2-G — 화면 배지와 판정 의미의 불일치

**등록일** 2026-09-14 · **등록자** CTO · **지시** CPO, 2026-09-14
**상태** 🔵 조사 대기 — **조사만 먼저, 수정은 조사 결과를 보고 결정한다**
**발견 경위** `e109bd2` 회귀 테스트 추가 중 범위 밖 관찰로 보고됨

---

## 1. 무엇이 발견됐나

```
deriveMatchTruth("low", "exact", "PRESUMED_SAME")   →   STRONG_IDENTIFIER
```

품번이 `exact`면 **`crossSeller` 보류와 무관하게** 최상위 등급이 된다. 즉 판정기는
"같다고 확정하지 않는다"(`PRESUMED_SAME` + `SAME_SELLER_DISTINCT_LISTING` 보류)고
말하는데, **화면 배지는 🟢 최상위**를 단다.

해당 범위: `7cd4aed`가 막은 거짓 SAME 중 **품번이 exact인 것 전부**.
`e109bd2`가 고정한 Conker 2쌍(`AW26MS185`)도 여기 해당한다.

## 2. 왜 지금 고치지 않는가 (CPO 판단)

현재 매칭의 핵심 안전장치는 이것이다:

```
화면 badge  ≠  가격 반영 여부
```

**실제 가격 반영은 `isSameProductForPricing`이 막고 있다.** 실측으로 확인됐다 —
Conker 2쌍 모두 `isSameProductForPricing === false`. 그러므로 **금전적 피해는 없다.**

## 3. 그래도 문제인 이유

> 사용자에게 🟢 `STRONG_IDENTIFIER`라고 보여주는 것은 **실제 판정 의미와 불일치**할
> 가능성이 있는 **UX / 신뢰성** 문제다. (CPO)

셀러는 배지를 보고 판단한다. 시스템이 속으로 "확정 못 한다"고 하면서 겉으로
"확정"이라고 말하면, **셀러가 가격을 직접 비교하는 순간 신뢰가 깨진다.**

## 4. 조사해야 할 것

1. **범위.** `exact` + `crossSeller` 보류 조합이 실제 데이터에서 몇 건인가.
   운영 DB와 카탈로그 전수로 세라.
2. **`match-truth.ts`의 우선순위가 왜 그렇게 정해졌는가.** `:71-76` 주석에 근거가
   적혀 있다(포레포레 회귀 — 텍스트 점수 42% low인데 SKU partial 일치). **그 근거가
   지금도 유효한가.**
3. **`STRONG_IDENTIFIER`가 실제로 쓰이는 곳 전부.** 화면 배지 말고도
   `priceTierFromLink` → `EXACT` → 가격 집계로 가는 경로가 있다. **`isSameProductForPricing`과
   `priceTierFromLink`가 서로 다른 답을 낼 수 있는가** — 이것이 가장 중요한 질문이다.
   실제로 다르다면 §2의 "금전적 피해 없음"이 성립하지 않는다.
4. **배지 문구를 바꾸는 것으로 충분한가**, 아니면 등급 산출을 고쳐야 하는가.

## 5. 하지 말 것

```
❌ 조사 없이 deriveMatchTruth 우선순위 변경
   포레포레 골든 쌍(PP24KASHE1195NER)이 이 우선순위로 지켜지고 있다
❌ threshold · 점수 · 어휘 변경
❌ 배지 문구만 바꾸고 §4-3 을 확인하지 않기
❌ 3.2-D/E/F 트랙(색상)과 섞기
```

## 6. 관련

- `docs/matching-3.2-f-variant-loss.md` · `-e-color-safety.md` · `-d-color-authority.md`
- `packages/crawler/src/comparison-search/match-truth.ts:71-105`
- `packages/crawler/src/__tests__/identifier-safety.test.ts` (`e109bd2`)

## 7. 함께 기록 — 같은 보고에서 나온 두 번째 관찰

`Grey Melange ↔ Conker Stripe` 비교의 `axes`에 **`COLOR` 축이 아예 없다.**
색 일치 점수도, 색 불일치 보류도 없다. 색상 트랙(3.2-D/E/F) 영역이라 이 문서에서
다루지 않는다 — **잊지 않기 위해 적어 둔다.**

## 8. 한계 (정직하게)

`e109bd2`가 고정한 자기자신 16건이 **과거 "11건"의 완전한 상위집합이라는 근거는
없다.** 원본 11개 핸들 목록이 저장소에 남아 있지 않다. 상위집합일 가능성이 높지만
단정하지 않는다.
