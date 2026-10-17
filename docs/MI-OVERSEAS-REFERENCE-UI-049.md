# WU-049 FINAL — 해외 동일상품 가격 비교 UI 소비 경로 E2E 완결

> 🟢 **GO.** 운영 4파일 · 배포 완료(`46e03ebf`) · 🔴 환산 **0** · 국내 축 **무변경** ·
> transient 저장 **0** · threshold/identity **0**.

---

## 1. 원인 — 「UI 가 안 읽어서」가 **아니었다**

```
POST /check   computeMarketIntelligence(…, transientEvidence)  ← **계산은 한다**
              return NextResponse.json({ ...result, domesticShop })
              🔴 `intelligence` 를 **싣지 않는다** — computeMarketAlert 에만 쓰고 버린다
GET  /[id]    computeMarketIntelligence(snapshotId, ws)        ← 🔴 **인자 2개**
              → transient null → `candidateOverseasEvidence` **항상 []**
```
🔴🔴 **그래서 `candidateOverseasPrice` 는 어떤 응답에도 없었다.** 소비자가 0 인 이유다.

🟢 **그리고 개별 후보는 이미 그려지고 있었다** — WU-028 구역이 `priceText` 로
`EUR 75` 처럼 **통화 그대로** 적는다. 빠진 것은 **집계(참고가격) 한 줄** 이었다.

### CPO ①~⑩ 확인 결과

| | 확인 | 결과 |
|---|---|---|
| ① | 해외 SAME 후보가 MI 에서 생성되는가 | 🟢 생성된다(WU-038 실측 SAME 4) |
| ② | 가격/통화가 실제로 있는가 | 🟢 `EUR 40 · USD 58 · EUR 75` VERIFIED |
| ③ | **어디서 사라지는가** | 🔴 **응답 직전** — route 가 안 싣는다 |
| ④ | 해외 가격의 UI 계약 | 🟢 통화 그대로 · 환산 금지(WU-020 §2) |
| ⑤ | 국내 KRW ↔ 해외 분리 | 🟢 MI 가 `market !== "KR"` 로 가른다 |
| ⑥ | SAME ↔ PRESUMED 구분 | 🟢 등급을 **갈라서** 적는다(합치지 않는다) |
| ⑦ | 가격 없음/미검증 표시 | 🟢 「가격 미확인」·「판매판정 미반영」(WU-028) |
| ⑧ | 국내 비교를 깨뜨리지 않는가 | 🟢 국내 축 코드 **무변경** |
| ⑨ | transient 저장 금지 유지 | 🟢 `isTransientShopId` 가드 그대로 |
| ⑩ | 판매/등록 가격과 섞이지 않는가 | 🟢 별 칸 · 별 구역 · 문구로 명시 |

---

## 2. 구현 — 운영 4파일 · **새 계산 0**

```
check/route.ts            응답에 `overseasReference: intelligence?.candidateOverseasPrice ?? null`
overseas-reference.ts     순수 빌더 — 집계를 **문자열로 옮기기만** 한다
OverseasReferencePrice    표현만 — 값이 없으면 **아무것도 렌더하지 않는다**
DomesticPriceIntelligencePanel  state + 전달 + 렌더(한 줄)
```

🔴 **금지 전수 대조 — 전부 0**
```
환율 환산 0   통화별로만 적는다. **합계 칸이 아예 없다**. 모듈이 환산기를 import 조차 안 한다
해외 SAME 을 국내 SAME 으로 간주 0 · PRESUMED→EXACT 승격 0 · 승격 버튼 0
transient 저장 0(DB 쓰기 0) · Registry 0 · threshold 0 · identity 로직 0 · sourcing 연결 0
국내 EXACT/COMPARISON · 판매판정 · 등록 payload **무변경**
```

🔴 **표시 규칙(테스트로 잠갔다)**
```
통화를 기호로 바꾸지 않는다      — `USD`/`AUD` 가 둘 다 `$` 라 통화를 잃는다
`UNKNOWN` 을 「해외」로 적지 않는다 — 「판매 시장을 확인하지 못했습니다」
등급을 합치지 않는다              — 「동일상품 2 · 유사상품 1」
구역이 스스로 말한다              — 「참고용입니다 — 판매판정과 국내 최저가에는 반영되지 않습니다」
```

---

## 3. E2E · Mutation · 회귀

```
계약      17 passed — 마운트 DOM(렌더 문자열) + 소스 가드(배선·경계)
음성대조  M1 응답 칸 제거 **1 FAIL** · M3 안전문구 제거 **1 FAIL** ·
          M4 KRW 환산 주입 **2 FAIL** → 복구 17 passed
          🔴 M2(`count<=0` 가드 제거)는 **통과했고 가드 공백이 아니다** —
             `count` 와 `byCurrency` 가 같은 records 에서 나와 **행동이 동일한 변이** 다.
             이중 방어로 남겼다.
회귀      admin **557 files / 8,153 passed · failed 0** · typecheck **0** · build exit **0**
배포      `46e03ebf` — 빌드 로그 `Commit: 46e03eb`
smoke     GET / **200** · /pipeline 307(인증) · POST /api/price-history/check 401(인증)
```

🔴 **내 단언이 한 번 틀렸다** — 구역 전체에 `/환율/` 금지를 걸었다가 **내 안내문**
(「환율로 환산하지 **않았습니다**」)에 걸렸다. 설명문과 데이터를 섞어 단언한 것이라
**금액 줄만** 보도록 고쳤다.

---

## 4. 🔴 한계 — 과장하지 않는다

```
🔴 **다시 열면 사라진다.** GET `/api/price-history/[snapshotId]` 는 transient 를
   넘기지 않으므로 이 값은 **「그 확인에서만」** 산다. 저장하지 않기 때문이고,
   그것이 설계다(WU-024 불변식).
🔴 **후보가 있어야 보인다.** Gemini flag 는 OFF 이므로 **직접 URL 입력** 으로
   후보를 넣어야 한다(WU-038~039 경로).
🔴 국내 KRW 축에는 **여전히 아무것도 추가되지 않는다** — 해외 가격은 해외 축이다.
```

---

## 5. 최종 판정

```
①~⑩ 전부 확인 · 원인 확정(응답 누락) · 최소 구현 · 금지 전수 0 ·
계약 17 · 음성대조 3 FAIL · 회귀 8,153 · build 0 · 배포 완료
──────────────────────────────────────────
**GO**
```

---

## 6. 🔴 CEO Production 테스트 (복귀 후 1회)

```
URL        https://ttaejyo.vercel.app/pipeline       (로그인 필요)
테스트 상품  Bobo Choses  Hug Hairy Monster T-Shirt  (B226AC009)
```

**순서**
1. 그 상품을 연다.
2. **「소싱처 직접 추가」가 아니라** 가격비교 구역의 **직접 URL 입력칸** 에 아래 둘을 넣는다.
```
https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt
https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue
```
3. **「지금 확인」** 을 누른다.

**기대 결과 🟢**
```
🌐 해외 참고가격
   EUR 40    판매처 1곳
   USD 58    판매처 1곳
   동일상품 2
   「해외 판매처에서 확인한 가격입니다 — 원래 통화 그대로이고, 환율로 환산하지 않았습니다.」
   「참고용입니다 — 판매판정과 국내 최저가에는 반영되지 않습니다.」
그리고 아래 「🔗 직접 입력한 후보」 구역에 두 판매처가 **동일상품** 으로 뜬다.
```

**🔴 보이면 FAIL**
```
원화(₩)로 환산된 금액 · 통화 기호($ €)만 있고 코드가 없는 표기 ·
「국내 최저가」가 EUR/USD 때문에 바뀌는 것 · 판매판정이 해외 가격 때문에 바뀌는 것 ·
「동일상품 확인」 같은 승격 버튼이 참고가격 구역에 있는 것
```

🔴 **질문은 「숫자가 뜨는가」가 아니라 「이 숫자가 무엇인지 화면이 정직하게 말하는가」다.**

---

## 7. 다음 병목 (CTO 가 고르지 않았다)

```
🔴 이 값은 **그 확인에서만** 산다 — 영구화하려면 「transient 를 어디에 둘 것인가」라는
   WU-039 §6 의 미결 결정(별도 transient-source 개념)이 선행이다.
🔴 그리고 후보 공급은 여전히 **직접 URL 입력** 하나다(Gemini OFF · WU-038 결론).
```

🔴 **CEO Action: 위 §6 테스트 1회.**
