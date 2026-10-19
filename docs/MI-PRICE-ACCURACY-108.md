# WU-108 — 국내/해외 가격비교 MI 정확도 E2E (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「**코드부터 수정하지 말고** production 경로를 실제 데이터
> 한 건씩 끝까지 추적해서 **「판정 → 가격 → 화면」 중 어디에서 정확도가 깨지는지 먼저
> 확정**」 · 새 AI 검색 ❌ · 8축 ❌ · 「국내 EXACT 0」 ❌ · Registry ❌ · discovery ❌

---

# [WU-108 완료 보고]

## 1. 조사 대상 / 표본

```
🟢 S1 = B226AC010 (Booty Ghosts T-shirt) · 후보 **15**
🟢 S2 = B226AC009 (Hug Hairy Monster T-shirt) · 후보 **12**
🔴 **B226AC112 는 쓰지 않았다**(WU-102 분모 오류) · 🔴 **새 AI 검색 0**
🟢 두 표본 모두 **동일상품이 실재** 하고 **국내·해외·가격있음·가격없음·SAME·CONFLICT 가 섞여 있다**
```
운영 owner 를 **그대로** 호출: `collectUrlCandidatePool → withConfidence →
enrichCandidatePrices → attachMatchTruth → judgeDomesticCandidate →
classifyCandidateMarket → summarizeCandidateOverseasPrices`.
🔴 **tier 를 지어내지 않았다** — `JUDGED.priceTier` 를 읽고, 그 값은 **샵당 best 1건에만** 있다.

## 2. MI 판정 결과

| | SAME | PRESUMED | SIMILAR | CONFLICT |
|---|---:|---:|---:|---:|
| **S1**(15) | **4** | 4 | 2 | 5 |
| **S2**(12) | **3** | 3 | 1 | 5 |

🟢 **`CONFLICT` 는 전건 `tier = EXCLUDED`** 로 떨어졌다(S1 2 · S2 3 — tier 가 매겨진 것 기준).
🟢 `SAME` 은 전건 `truth = STRONG_IDENTIFIER` 이고 tier 가 매겨진 것은 **EXACT** 다.

## 3. 국내 가격 결과

```
S1  [KR-SUM] count **0**  — 🔴 국내 자격 후보가 **0건**
S2  [KR-SUM] count **1**  — 🟢 biskuit.kr **KRW 88,000** · tier **COMPARISON** · market **KR**
                             byCurrency {KRW:{count:1,lowestAmount:88000}}
```
🟢🟢 **국내 축이 실제로 작동한다** — S2 에서 ₩88,000 이 국내 집계에 들어갔다.
🟢 `biskuit.kr` 은 URL 에 **`b226ac009`** 가 있어 **동일상품 후보**가 맞다(관측).

## 4. 해외 가격 결과

```
S1 [OS-SUM] count 7 · byCurrency **USD{2, 최저 44} · GBP{2, 최저 33} · CAD{1, 64}**
             byPriceTier {UNJUDGED 2 · EXACT 3 · EXCLUDED 2}
S2 [OS-SUM] count 7 · byCurrency **USD{2, 최저 58} · EUR{1, 40} · GBP{1, 33}**
             byPriceTier {EXACT 2 · UNJUDGED 1 · EXCLUDED 3 · COMPARISON 1}
```

🟢🟢 **`EXCLUDED` 가 금액에서 «정확히» 빠진다** — `count 7` 인데 `byCurrency` 합은 **5** 다.
```
S1 OVERSEAS 가격 7건 중 EXCLUDED 2건(bobochoses EUR 35 · junioredition GBP 35)
⟹ 🟢 **EUR 이 byCurrency 에 없다** · GBP 최저가가 35(EXCLUDED)가 아니라 **33** 이다
🟢 WU-062 설계 그대로다 — `byMarket`/`byPriceTier`/`count` 는 **관측으로 남고**
   `byCurrency`(금액)에서만 제외된다. 🔴 「관측을 지운다」가 아니다.
```
🟢 **통화를 섞지 않는다** · **환산 0** · **합계 칸 없음**(헌장 `overseas-reference` 계약).

## 5. 🔴 잘못 포함된 가격 — **0건**

| 검증 항목(CPO §2) | 결과 |
|---|---|
| ⑤ 국내/해외가 **서로 뒤섞이는가** | 🟢 **0** — 국내 1건은 `KR`, 해외 14건은 `OVERSEAS`. 중복 집계 **0** |
| ⑥ 가격 없는 후보가 **있는 것처럼** 표시되는가 | 🟢 **0** — `price:null` 은 전건 어느 축에도 안 들어갔다 |
| ⑦ `EXCLUDED/SIMILAR/DIFFERENT/UNVERIFIED` 가 **잘못 들어가는가** | 🟢 **0** — `EXCLUDED` 는 금액 제외 · `UNVERIFIED_SEARCH` 는 `priceKrw` null 로 국내 탈락 |
| ② **DIFFERENT 를 동일상품으로 잘못 잡는가** | 🟢 이 표본에서 **0** — `CONFLICT` 전건 `EXCLUDED` |
| C. 해외 KRW 가 국내로 들어가는가 | 🟢 **0** — `m.luxboy.com` KRW 59,000 이 **어느 축에도 안 들어갔다**(아래) |
| C. 환산가격 ↔ 실제 판매가 혼동 | 🟢 **0** — 환산 코드가 **없다** |

### 🟢 `m.luxboy.com` KRW 59,000 — **설계대로 «버려졌고» 그게 정답이었다**
```
`.com` + KRW → basis `KRW_WITHOUT_DOMAIN_EVIDENCE` → market **UNKNOWN**
⟹ 국내 아님(WU-020: 통화 단독 결정 금지) · 해외 금액도 아님(WU-051: KRW 를 해외에 안 넣는다)
🟢🟢 **그리고 WU-077 이 그 ₩59,000 을 Human DIFFERENT 로 측정했다** ⟹ 🟢 **안 넣은 것이 정답**
```

## 6. 🔴🔴 누락된 가격 — **1건. 이것이 이 WU 의 유일한 결함 후보다**

```
[SAME-URL] global.trenbe.com   MI=**SAME** · truth=**STRONG_IDENTIFIER** · tier=**EXACT**
                               market=UNKNOWN · price=**null** · priceStatus=UNVERIFIED_SEARCH
⟹ 🔴 **동일상품(URL 에 품번) · MI SAME · tier EXACT 인데 가격이 없어 어느 축에도 못 들어간다**
```
🔴 **CPO 의 「A. SAME 인데 가격비교에서 빠지는 경우」가 실제로 1건 관측됐다.**

## 7. 실제 원인 — 🟢 **MI 가 아니라 «가격 추출» 이다**

```
① MI 판정 문제 🔴 **아니다** — SAME · STRONG_IDENTIFIER · EXACT 까지 **정상 도달**
② aggregation/qualification 문제 🔴 **아니다** — 자격식이 `price != null` 을 요구하고
   그 요구는 **올바르다**(가격 없는 것을 최저가로 쓸 수 없다)
③ UI 전달 문제 🔴 **아니다** — 집계에 넣을 값 자체가 없다
🟢🟢 **원인 = `factsFromProductUrl` 이 `global.trenbe.com` 에서 가격을 못 읽는다.**
   `priceStatus = UNVERIFIED_SEARCH` 이고 `enrichCandidatePrices` 도 채우지 못했다.
```

🔴 **그리고 그 자리는 이미 CPO 가 HOLD 한 곳이다** — WU-079 `MI-PRICE-EVIDENCE-RECOVERY`
**REJECT**: 「generic 숫자 parser ❌ · 사이트 전용 adapter ❌ · 안전 축이 회수하는 1건이
**Human DIFFERENT**」. 🔴 그래서 **이번에도 고치지 않았다.**

🟡 단 **이번 건은 WU-079 표본과 다르다** — 그때는 `beaumonde`(JS 렌더)였고 이번은
`global.trenbe.com` 이며 **MI 가 SAME/EXACT 까지 간 후보** 다. 🔴 **새 정보** 이므로 기록한다.

## 8. 수정 내용 — **0**

```
운영 코드 변경 **0** · 배포 **0** · 8축 0 · threshold 0 · Registry 0 · discovery 0 · UI 0
🔴 §7 의 원인(가격 추출)은 **CPO 가 WU-079 에서 REJECT 한 축** 이라 **임의로 열지 않았다**
```

## 9. E2E 결과 — CPO 8개 확인 항목

| | 항목 | 결과 |
|---|---|---|
| ① | SAME 이 실제 동일상품을 잡는가 | 🟡 **부분** — `biskuit`(국내)·`trenbe`(해외)를 잡았다. 🔴 **사람 확인 없음** |
| ② | DIFFERENT 를 동일상품으로 잘못 잡는가 | 🟢 **0**(CONFLICT 전건 EXCLUDED) |
| ③ | SAME 후보 **국내 가격**이 정확히 노출되는가 | 🟢 **1/1**(biskuit ₩88,000) |
| ④ | SAME 후보 **해외 가격**이 정확히 노출되는가 | 🟡 **5/6** — 🔴 `trenbe` 1건 누락(§6) |
| ⑤ | 국내/해외 뒤섞임 | 🟢 **0** |
| ⑥ | 가격 없는 후보가 있는 것처럼 | 🟢 **0** |
| ⑦ | EXCLUDED/UNVERIFIED 오포함 | 🟢 **0** |
| ⑧ | 화면에서 국내/해외를 정확히 이해 가능 | 🔴 **CTO 가 확인할 수 없다**(로그인 뒤) ⟹ CEO 몫 |

## 10. 회귀 / typecheck / build

```
typecheck **0** · apps/admin **600 files / 8,367 passed** · failed **0** · HTTP 약 90(read-only)
🔴 build/배포는 **하지 않았다** — 운영 코드가 바뀌지 않았다
```

## 11. production 상태 — **변경 없음**

---

## 🔴 Known Unknowns

```
① 🔴 **Human GT 가 없다** — `biskuit ₩88,000` 과 `trenbe` 가 **진짜 동일상품인지** 사람이
   확인하지 않았다. 근거는 **URL 품번** 하나다
② 🔴 표본 **상품 2개 · 후보 27건** 이다. 정확도 지표로 일반화하지 않는다
③ 🔴 `tier` 는 **샵당 best 1건에만** 있다(운영 구조) ⟹ 같은 샵의 2번째 후보는
   `tier=null` 이고 **금액 집계에 `UNJUDGED` 로 들어간다**(S1 2건 · S2 1건).
   🔴 그것이 **의도된 동작인지 CPO 확인이 필요하다** — 내가 판단하지 않았다
④ 🔴 `UNKNOWN` 시장 후보의 가격은 **해외 금액 집계에 들어간다**(운영 조건 `market !== "KR"`).
   🟢 이 표본에서는 `UNKNOWN` + 가격 있음이 **0건** 이라 발화하지 않았다
⑤ 🔴 화면(⑧)은 **측정하지 못했다** — 로그인 뒤이고 CTO 가 볼 수 없다
⑥ 🔴 `trenbe` 가격 미획득의 **구체 원인**(JSON-LD 부재 / JS 렌더 / 차단)은 **가르지 않았다**
```

## 12. CEO Action — 🟡 **최종 화면 확인 1회** (🔴 수정/배포는 없다)

```
🔴 **코드를 바꾸지 않았으므로 「수정 검증」이 아니다.** 지금 화면이 정확한지 봐 주십시오.
URL   https://ttaejyo.vercel.app/pipeline  (로그인 필요)
상품  Bobo Choses **Hug Hairy Monster T-shirt** (B226AC009)
      https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt

확인
 ① 🇰🇷 국내 가격이 **₩88,000**(biskuit)으로 뜨는가 — 그리고 그것이 **같은 상품**인가
 ② 🌎 해외 가격이 **USD 58 / EUR 40 / GBP 33** 로 뜨는가(통화별로 갈려서)
 ③ 🔴 **「동일상품 아님」 후보의 금액이 최저가로 섞여 있지 않은가**
    (bobochoses EUR 35 · junioredition GBP 33 · kids21 SGD 70 이 그 후보다)
 ④ 가격 상태/설명이 오해 없이 보이는가

🔴 정상인데 FAIL 로 보기 쉬운 것 둘
 · `global.trenbe.com` 이 **가격 없이** 뜬다 — 🔴 그 1건이 이 WU 가 찾은 결함이다
 · `m.luxboy.com ₩59,000` 이 **국내 가격에 안 들어간다** — 🟢 그것이 **정답** 이다
   (Human DIFFERENT 로 측정된 상품 · WU-077)
```

## 13. 결론 — 🟡 **HOLD**

```
🟢 ②⑤⑥⑦ **PASS** — 잘못 포함된 가격 **0** · 국내/해외 분리 **정확** · EXCLUDED 금액 제외 **정확**
🟢 ③ **PASS**(1/1) — 국내 축이 실제로 작동한다
🟡 ④ **부분** — 🔴 **SAME/EXACT 인데 가격이 없어 빠지는 1건**(`global.trenbe.com`)
🔴 ① **사람 확인 필요** · ⑧ **CTO 측정 불가**
⟹ 🔴 완료 기준 4개 중 **②③는 증명 · ①④는 미완** ⟹ **1차 목표 완료로 올리지 않는다**
🔴 유일한 결함의 원인은 **가격 추출** 이고 그 축은 **CPO 가 WU-079 에서 REJECT** 했다 —
   🔴 **다시 열지 여부는 CPO 판정** 이고 CTO 가 구현하지 않았다
```
