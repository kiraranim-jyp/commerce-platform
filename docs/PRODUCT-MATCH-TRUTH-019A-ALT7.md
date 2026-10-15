# WU-019A-ALT-7 — B10 의 `productMatchTruth` 공백 **원인 확정** (조사만 · 수정 0)

🔴 코드 수정 0 · UI 0 · 생성 로직 0 · `PRESUMED_SAME` 정책 0 · threshold 0 · 색상사전 0 ·
downstream 0 · DB 0 · 검색 0 · 추가 GT 0 · AI API 0 · 비용 **₩0**.

---

## ① `productMatchTruth` 경로 (코드로 확정)
```
생성  attachProductMatchTruth(product-identity.ts:229) → deriveProductMatchTruth(:121)
운영 호출부  **단 1곳** — apps/admin/src/app/api/comparison/search/route.ts:1
             (해외 비교검색 route). 🔴 그 외 호출부는 price-confirmation.ts 내부 정렬용.
표시  displayTierForCandidate(ComparisonShopSearch.tsx:81)
      ① productMatchTruth 있으면 overseasMatchDisplay(match-display.ts:58) →
         해외 `SAME_MODEL_VARIANT` → 화면 🔵 `SAME_MODEL_OPTION_DIFF`「동일 모델·옵션 다름」
      ② 없으면 matchLevel 폴백(medium → 「동일상품 추정」)
```

## ② 🔴🔴 원인은 **둘이 겹쳤다** — 하나만 적으면 틀린다

### 원인 1 — **내 하니스가 그 함수를 부르지 않았다**(E: 측정 경로 누락)
ALT-3 하니스는 `searchShopifySuggest → withConfidence` 까지만 불렀고
**`attachProductMatchTruth` 를 부르지 않았다.** 🔴 그래서 `productMatchTruth` 가 **없다**.
🟢 즉 「데이터가 비어 있다」가 아니라 **「내가 그 칸을 만드는 단계를 건너뛰었다」** 다.
🔴 이 트랙에서 **열두 번째** 같은 계열(운영 경로를 한 단계 빠뜨림 · 헌장 §5-B).

### 원인 2 — **운영 경로를 불렀어도 B10 은 OPTION_DIFF 가 아니다**(D: 의도된 구조)
`deriveProductMatchTruth`(:134) 분기:
```ts
if (cross === "CONFLICT") {
  return existing === "SAME_MODEL_VARIANT" ? "SAME_MODEL_VARIANT" : "CONFLICT";
}
return RANK[cross] > RANK[existing] ? cross : existing;
```
🔴 `SAME_MODEL_VARIANT`(→ 화면 🔵)로 가는 길은 **`cross === "CONFLICT"` 분기 하나** 다.
B10 은 `crossSellerVerdict = **PRESUMED_SAME**` 이라 그 분기에 **들어가지 못하고**
아래 rank 비교로 간다. 🟢 주석이 그 의도를 적어 뒤 뒀다 — 「**반증은 언제나 이긴다.
단 하나의 예외**가 있다: 기존 계층이 『같은 모델인데 옵션만 다르다』고 **더 구체적으로**
말할 수 있는 경우」. 즉 **반증(CONFLICT)이 있을 때만** 「옵션 다름」으로 구체화한다.

## ③ 정상 사례와의 차이
```
🔵 SAME_MODEL_OPTION_DIFF 가 나오는 조건   cross = **CONFLICT** + existing = SAME_MODEL_VARIANT
B10                                        cross = **PRESUMED_SAME** → 그 조건 **미충족**
🔴 차이는 색상 데이터가 아니라 **crossSellerVerdict 값** 이다.
   (ALT-6 에서 내가 「색상 정보 부족」 쪽을 의심했는데 그것이 직접 원인이 아니다)
```
🟡 참고 — ALT-5 에서 같은 품번·다른 색상 2건(Conker/Graystone)이 **CONFLICT 0.78** 로
나왔다. 🔴 그 둘이 `attachProductMatchTruth` 를 통과하면 **🔵 로 갈 가능성이 있다**(미측정).

## ④ 정책 판정
```
의도된 구조 / 누락 / 기타   → **둘 다** : 원인1 = 내 하니스 누락(기타) · 원인2 = **의도된 구조**
수정 필요 여부              🟡 제품 쪽은 **수정 근거 없음**(설계 의도가 주석에 명시)
                            🔴 내 측정 하니스는 다음에 쓸 때 `attachProductMatchTruth` 를
                               운영과 같은 순서로 불러야 한다
이번 WU 수정                **0**
```
🔴 그리고 ALT-6 의 결론을 **정정한다** — 「B10 이 🔵 등급에 닿지 못한다」는 맞지만,
그 이유가 **`productMatchTruth` 부재**가 아니라 **`cross` 값이 PRESUMED_SAME 이라서** 다.

## ⑤ 다음 작업 후보 — 1개
🟡 **ALT-5 의 CONFLICT 2건(같은 품번·다른 색상)을 `attachProductMatchTruth` 까지 통과시켜
화면 등급이 🔵 「동일 모델 · 옵션 다름」이 되는지 확인** — 🔴 조사만이고 수정이 아니다.
그 결과가 🔵 면 **제품은 이미 그 경우를 정확히 말하고 있다**는 증거가 된다.

🔴 **CEO Action: NONE.**
