# WU-096 — Production funnel 전수 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「**코드 변경을 먼저 하지 않는다.** Production 기준으로
> `AI 후보 → MI → 국내/해외 가격비교 노출` 전체 경로를 실제 데이터로 전수 추적한다.」

---

# [WU-096 FINAL]

## 1. 조사 범위

```
입력   WU-073 저장 AI 산출(🔴 **새 AI 호출 0**) · 원상품 B226AC112(087~089 와 동일)
owner  extractCandidateUrlsFromAiAnswer → collectUrlCandidatePool → withConfidence
       → enrichCandidatePrices → attachMatchTruth → classifyCandidateMarket
       → **judgeDomesticCandidate** → GeminiTransientCandidates(UI)
🔴 **WU-095 수정 «이후» 값으로 다시 쟀다** — 087/088/089 숫자는 수정 전이라 인용 금지
운영 코드 변경 **0** · 배포 **0** · 추가 AI **0**
```

## 2. Production funnel (전체 · N=**182**)

| 단계 | 수 | 증감 |
|---|---:|---:|
| ① AI 후보 | **182** | — |
| ② URL 추출 | 103 | -79 |
| ③ 풀 통과(fetch OK) | **64** | -39 |
| ④ facts 확보 | 64 | 0 |
| ⑤ 가격 확보 | **12** | -52 |
| ⑥ market 확정 | **8** | -4 |
| ⑦ MI 판정 도달 | 64 | — |
| ⑧ 샵 판정(30곳) | 🔴 **JUDGED 4 / DROPPED 26** | — |
| ⑨ 가격비교 자격 | 🔴 **0** | -8 |
| ⑩ UI 노출 | 🔴 **0** | — |

```
풀 이전 탈락   NOT_EXTRACTED 79 · UNREACHABLE 16 · POOL_UNKNOWN 12 ·
               REDIRECTED_AWAY 6 · DUPLICATE 3 · NO_FACTS 2
market basis   NO_PRICE_EVIDENCE 52 · KR_TLD_AND_KRW 5 ·
               KRW_WITHOUT_DOMAIN_EVIDENCE 4 · FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE 3
matchTruth     CONFLICT 42 · INSUFFICIENT_EVIDENCE 17 · TEXT_CONFIRMED 5
matchLevel     **{low: 64}** ← WU-095 이후
```

## 3. 국내 funnel (KR · N=**5**)

| ① | ② | ③ | ④ | ⑤ 가격 | ⑥ market | ⑦ MI | ⑧ 샵판정 | ⑨ 자격 | ⑩ UI |
|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 5 | 5 | 5 | 5 | **5** | **5** | 5 | 🔴 **4곳 전부 DROPPED** | **0** | **0** |

```
🟢 ①~⑦ 은 **손실 0** 이다 — 5건이 전부 가격·시장까지 통과한다
🔴 죽는 곳은 **⑧ 하나** 다:
   biskuit.kr · littleluna.co.kr · miniboutique.co.kr · m.web.mustit.co.kr
   ⟹ **전부 `DROPPED / EVIDENCE_NOT_WORTHWHILE`**
```

## 4. 해외 funnel (OVERSEAS · N=**3**)

| ① | ② | ③ | ④ | ⑤ 가격 | ⑥ market | ⑦ MI | ⑧ | ⑨ | ⑩ |
|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| 3 | 3 | 3 | 3 | **3** | **3** | 3 | 🔴 **DROPPED** | **0** | **0** |

🔴🔴 **국내와 갈리는 최초 지점이 «없다».** 둘 다 ①~⑦ 을 동일하게 통과하고 **⑧ 같은
게이트에서 같이 죽는다**. ⟹ 「해외는 되는데 국내만 안 된다」는 **이 표본에서 성립하지 않는다**.

🟢 **JUDGED 된 4곳**(tinyapple.net · cissywears.com · billsstore.com.au · thefrontshop.com)은
전부 `tier COMPARISON · truth TEXT_CONFIRMED · verified false` 인데
🔴 **`market UNKNOWN` · `price null`(UNVERIFIED_SEARCH)** 이라 **어느 가격축에도 못 들어간다**.

## 5. 🔴🔴 최초 병목 — **⑧ `isEvidenceEvaluationWorthwhile`**

```
run-domestic-price-check.ts:364
  if (candidates[0].matchLevel !== "low") return true;
⟹ **top 후보가 low 면 그 샵 전체를 DROPPED** 한다
⟹ 샵 30곳 중 **26곳**(KR 샵 4곳 전부 포함)이 여기서 끊긴다
```

🔴 그 앞단(①~⑦)은 **정상이다**. 국내 5건이 가격·시장까지 **온전히** 도달한다.

## 6. 원인

```
⑧ 의 입력 = `matchLevel` = `classifyMatchLevel(confidence)` 의 산출
WU-095 이후 이 표본의 matchLevel 은 **전건 low** 다.
```

🔴 **이것이 WU-095 의 회귀인가 — 둘로 갈라 답한다**:

| 경로 | 수정 전 | 수정 후 | 회귀인가 |
|---|---|---|---|
| **AI URL**(원상품 Shopify) | `{low: 64}`(WU-088 실측) | `{low: 64}` | 🟢 **아니다 — 원래 그랬다** |
| **등록부 검색**(원상품 Cafe24) | `very_high 5`(WU-093) → **JUDGED** | `low 5` → 🔴 **DROPPED** | 🔴 **그렇다** |

🟢 전자가 영향을 안 받은 이유도 확인된다 — 원상품이 Shopify(`b226ac112-…`)라 slug 가
**숫자가 아니었고** Cafe24 후보 slug(`"1"`)와 **애초에 달랐다**. 0.95 가 **발화한 적이 없다**.

🔴🔴 후자는 **실측했다**(이 WU 보조 하니스):
```
looxloo.com 후보 5 · matchLevel ["low","low","low","low","low"]
  ⟹ **DROPPED / EVIDENCE_NOT_WORTHWHILE**
```
🔴 수정 전 그 경로는 `very_high` 라 ⑧을 통과해 **JUDGED** 였다(WU-093 의 matchTruth 가 증거).

🟢 **그러나 «잃은 판정» 은 없다** — 통과하던 때에도 그 경로의 결과는 **SAME 0 · 국내 EXACT 0**
이었다(WU-093 GT). 🔴 **달라진 것은 「판정」이 아니라 「후보가 백엔드 산출에 실리는가」** 다.

## 7. 기존 보호정책 영향

```
🟢 8축 · SAME threshold · 가격 정책 · Registry · AI · UI — **전부 변경 0**
🟢 False SAME **0 유지**(SAME 판정 자체가 0)
🔴 ⑧ 게이트는 **보호축이 아니라 비용 게이트** 다(「증거평가를 할 가치가 있는가」)
🔴🔴 그런데 그것이 **노출까지 결정한다** — `transientEvidenceSink.push` 는
   `JUDGED` 뒤에서만 실행되므로 **DROPPED 된 샵은 화면 배열에 아예 안 실린다**
⟹ 🔴 **WU-091 이 세운 정책(「후보 노출 ≠ SAME 판정」)과 이 자리가 충돌한다.**
```

🟢 **단 경로를 갈라야 한다**:
```
등록부 «검색 화면»(DomesticShopSearch) → searchDomesticShops 결과를 **직접** 그린다
   ⟹ ⑧과 무관 · WU-091 UI 그대로 **보인다**
transient 경로(AI URL · Gemini)        → judgeDomesticCandidate **JUDGED 만** 실린다
   ⟹ 🔴 DROPPED 면 **화면에서 사라진다**
```

## 8. 수정 필요 여부 — 🔴 **CTO 가 정하지 않는다**

```
⑧ 을 여는 유일한 방법은 `matchLevel` 문턱을 낮추는 것이고 그것은 **금지** 다
   (WU-017: 적중률 3.8% · `high` 0건 · threshold 완화 금지)
⟹ 🔴 **판정 축에는 또 안전한 레버가 없다** — 여덟 축과 같은 벽이다
🟡 그러나 **새로운 것이 하나 있다**(§7) — ⑧ 이 **「노출」까지 결정한다**는 사실이고,
   그것은 **판정 정확도 문제가 아니라 제품 정책 문제** 다. 🔴 CPO 판정 사안.
```

## 9. 코드 변경 — **0**

```
운영 파일 **0** · 배포 **0** · 추가 AI **0** · Registry **0** · UI **0**
추가된 것: 측정 하니스 2개(funnel · 등록부 경로)
```

## 10. E2E / 회귀 / 배포

```
typecheck **0** · apps/admin **599 files / 8,361 passed** · failed **0** · build **exit 0**
🔴 배포 없음(운영 코드 무변경) · HTTP 약 190 요청(read-only)
```

---

## 11. 🔴 Known Unknown

```
① 🔴 **분모 182 는 WU-089 의 181 과 1 다르다.** 내 URL 집합 구성(정규화 합침)의 차이이고
   **원인을 가르지 않았다**. 🔴 두 숫자를 섞어 쓰지 않는다
② 🔴 **`POOL_UNKNOWN` 12건** — 추출은 됐는데 풀 결과에도 drop 목록에도 없다. **미규명**
③ 🔴 ⑩ 지표를 1차에 `mayShowCandidate` 로 쟀는데 **틀린 owner** 였다
   (transient 카드는 `evidence.map()` 으로 **전건 렌더** · 게이트 0).
   🟢 실제 노출 = **JUDGED 4건** 이고 그 4건은 **가격 미확인**으로 표시된다
④ 🔴 표본은 **원상품 1개 · AI 산출 1덩어리** 다. 전수가 아니다
⑤ 🔴 `fetchModelCode` 를 **`async () => null`** 로 주입했다(추가 HTTP 0).
   운영은 거기서 상세 품번을 읽으므로 **⑧ 이후 값이 달라질 수 있다** — 단 ⑧에서 이미
   26곳이 죽으므로 **이 측정의 결론은 바뀌지 않는다**
⑥ 🔴 「등록부 검색 화면은 ⑧과 무관하다」는 **코드 경로 기준** 이다 — Production 실화면은
   CTO 가 볼 수 없다(메모 `production-payload-is-unreachable`)
⑦ 🔴 정규식을 쉘로 편집하다 **백슬래시가 또 소실됐다**(WU-078 교훈 재발). 🟢 Edit 로 고쳤고
   그 사이 산출된 숫자는 **쓰지 않았다**(typecheck 135 로 즉시 드러났다)
```

## 12. CEO Action — **없음**

## 13. 🔴 CPO 판정 대기사항

```
A. 「국내 가격비교가 왜 부족한가」 → 🟢 **답했다**:
   ①~⑦ 은 손실 0 이고 **⑧ `isEvidenceEvaluationWorthwhile` 하나** 에서 끊긴다.
   그 입력은 `matchLevel` 이고 **완화는 이미 닫힌 축** 이다.
B. 「해외는 어디까지 정상인가」 → 🟢 **국내와 동일하게 ⑦까지** 정상이고 ⑧에서 같이 죽는다.
   ⟹ 🔴 **국내/해외가 갈리는 지점은 없다.**
C. 🟡 **독립적인 병목 후보 1건** — ⑧ 이 「증거평가 비용」 게이트인데 **후보 노출까지**
   결정한다. WU-091 의 「후보 노출 ≠ SAME 판정」과 **충돌** 한다.
   🔴 이것은 **판정 완화가 아니라 «노출 경로» 문제** 이므로 8축·threshold 를 건드리지 않고도
   다룰 수 있는 **유일한 자리** 다. 🔴 열지 여부는 **CPO 판정** 이고 CTO 가 구현하지 않았다.
D. 🔴 WU-095 의 부작용 1건을 **확정해서 보고한다** — 등록부 경로가 이제 ⑧에서 DROPPED 된다.
   🟢 판정 결과는 **잃은 것이 없다**(그 경로도 SAME 0 이었다). 🔴 달라진 것은 **노출** 이다.
```
