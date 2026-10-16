# WU-039 — SAME 후보의 가격비교 진입 구조 완결

> 목표: **Registry 에 없는 직접 공급 URL 도, Registry 를 오염시키지 않고
> SAME + VERIFIED 가격이면 현재 분석의 가격비교에 진입한다.**

---

## §1 원인 — 저장 게이트가 아니라 **런타임 전달 누락** 이었다

WU-038 실측: `입력 5 → MI SAME 4 → 가격 VERIFIED 3 → 가격비교 진입 **0**`.

조사해 보니 **구조는 이미 다 있었다**:

```
computeMarketIntelligence(snapshotId, workspaceId, transientEvidence?)   ← 3번째 인자 존재
  └ market === "KR" && priceKrw != null && tier EXACT|COMPARISON
        → exactShopRecords / comparisonShopRecords   ← **가격비교에 들어간다**
  └ 그 외 «가격 있는» 후보 → overseasEvidence (환산 0 · WU-020)
```

🔴 **그런데 `check/route.ts` 가 `geminiEvidence` 만 넘기고 있었다.**
WU-024 가 transient 싱크를 **둘로 갈랐는데**(화면이 「웹 검색」과 「직접 입력」을
구분해야 해서) MI 입력에는 한쪽만 들어갔다.

> **직접 입력한 후보는 SAME 이고 가격이 `VERIFIED_CURRENT` 여도 가격비교에
> «영원히» 들어갈 수 없었다 — 한 줄 때문이다.**

---

## §2 구현 — 한 곳

```ts
const transientEvidence =
  domesticShop.geminiEvidence || domesticShop.urlCandidateEvidence
    ? [...(domesticShop.geminiEvidence ?? []), ...(domesticShop.urlCandidateEvidence ?? [])]
    : null;
await computeMarketIntelligence(snapshotId, workspaceId, transientEvidence);
```

🔴 **응답의 두 배열은 그대로 둔다** — 화면의 출처 구분(WU-028)을 깨지 않는다.
합치는 것은 **MI 입력 한 곳** 뿐이다.

---

## §3 CPO 금지 전수 대조 — **전부 0**

| 금지 | 결과 | 근거 |
|---|---|---|
| Registry 확대 | **0** | 등록부에 아무것도 추가하지 않는다 |
| `source_id` FK 훼손 | **0** | **DB 쓰기 자체가 0** |
| DB 저장 | **0** | `isTransientShopId` 가 upsert 앞에서 그대로 끊는다 |
| AI / Gemini 재활성 | **0** | flag 미변경 |
| threshold 완화 | **0** | 기존 `priceTier` 를 그대로 읽는다 |
| PRESUMED → SAME 승격 | **0** | 승격 코드 없음 |
| 색상사전 | **0** | — |
| **외화 자동 환산** | **0** | 비-KR 은 해외 축으로 가고 **통화별로만** 모인다 |
| **미검증 가격 투입** | **0** | `priceKrw` 는 `VERIFIED_CURRENT && KRW` 일 때만 채워진다(**기존 가드**) |

🟢 MI 가 만드는 transient 레코드는 메모리 id(`gemini-transient:…`)이고 **DB 행이 아니다.**

---

## §4 검증

```
계약 테스트   10 passed (전달 · 안전 게이트 · Registry 무오염 3개 축)
음성대조      M1 직접입력 전달 제거 **1 FAIL** · M2 인자 되돌리기 **1 FAIL** → 복구 10 passed
회귀          admin **554 files / 8,113 passed · failed 0**
typecheck 0 · build exit 0
보안          WU-025 outbound · WU-026 rebinding **95 passed** · client 번들 유입 **0**
배포          `71aecde9` — 빌드 로그 `Commit: 71aecde`
smoke         GET / **200** · POST /api/price-history/check **401**(인증)
```

🔴 **기존 계약 테스트 1건을 갱신했다** — `mi-gemini-009` 가 「`geminiEvidence` 가
`computeMarketIntelligence(` **뒤** 에 나온다」는 **위치** 를 단언하고 있었다. 합치는
const 가 호출 «앞» 으로 가면서 깨졌다. 🟢 보장은 약해지지 않고 **넓어졌으므로**
(두 배열이 전부 MI 입력) 위치가 아니라 **계약** 을 단언하도록 고쳤다.

🔴 **내 테스트가 타입을 두 번 추측했다** — `classifyCandidateMarket`(`url`→`domain`),
`CandidateOverseasPriceRecord`(없는 칸 4개). 둘 다 **타입에서 읽어** 고쳤다.
🔴 회귀에서 쿠팡 테스트 1건이 한 번 실패했는데 **단독 18/18 통과** 이고 재현되지
않았다 — 병렬 간섭이고 이번 변경과 무관하다(원인 미규명으로 적는다).

---

## §5 🔴 그래서 지금 무엇이 되고 무엇이 안 되는가 — 과장하지 않는다

```
🟢 **된다** — 국내 KRW · VERIFIED_CURRENT · tier EXACT/COMPARISON 인 직접 공급 후보는
   이제 **그 분석의 국내 가격비교(최저가·tier 집계)에 들어간다.**
🔴 **이번 표본에는 그런 후보가 0 이었다** — WU-038 의 VERIFIED 3건이 전부
   **EUR 40 · USD 58 · EUR 75**(외화)였다. 그래서 **그 두 상품의 화면은 바뀌지 않는다.**
🔴 **해외 축은 여전히 화면에 없다** — `candidateOverseasPrice` 를 소비하는 UI 가
   **0** 이다(WU-020 §11 이 의도적으로 보류했다). CPO 결정 ①이 그대로 남아 있다.
🔴 **다시 열면 사라진다** — GET `/api/price-history/[snapshotId]` 는
   `computeMarketIntelligence` 를 **인자 2개** 로 부른다. transient 는 저장하지
   않으므로 **「그 분석에서만」** 이다. CPO 가 지정한 범위가 바로 그것이다.
```

---

## §6 최종 판정

```
A 후보 공급   🟢 (WU-038)
B MI          🟢 (WU-038)
C 가격 검증   🟢 (WU-038)
D-1 통화 게이트 🟢 **정상 동작** — 외화는 해외 축으로 간다(환산 0)
D-2 전달      🟢 **고쳤다** — 국내 KRW VERIFIED 후보는 이제 가격비교에 진입한다
──────────────────────────────────────────
**GO** — 구조는 닫혔다.
```

🔴 **남은 것은 제품 정책 둘이고 CTO 가 고르지 않았다**:
```
① 해외 동일상품 가격을 화면에 보여줄 것인가 (데이터는 이미 MI 가 낸다 · 소비자 0)
② 직접 공급한 SAME 을 «영구 저장» 할 것인가 (지금은 그 분석에서만 산다)
   🔴 CPO 가 「domestic_product_links 에 억지로 넣지 않는다」를 이미 확정했으므로,
      연다면 **별도 transient-source 개념**이 필요하다 — 별 WU 다.
```

🔴 **CEO Action: Production 최종 제품 테스트 1회**(직접 URL 입력 → 결과 확인).
