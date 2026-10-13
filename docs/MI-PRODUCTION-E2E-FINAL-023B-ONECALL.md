# WU-023 **B** — Gemini 1 call 실측 결과

> 🟢 **정확히 1 call.** `geminiCalls = 1` · `queriesUsed = 1` · outcomes `{OK: 1}` ·
> failureDetails **[]**. 🔴 Production flag **건드리지 않았다**(여전히 OFF · env 에 키 없음).
> 🔴🔴 **원화 비용·잔액은 이 문서에 없다** — CTO 는 Billing 을 읽을 수 없다(헌장 §10).
> 토큰·grounding·호출 수만 실측값이고 **금액은 CPO 가 AI Studio 에서 읽어 채운다.**

---

## 1. §11 계측표 — **실측값만** (추정 0)

| 항목 | 값 |
|---|---:|
| Gemini API calls | **1** |
| Products | **1** |
| Calls / product | **1** |
| Input tokens | **1,899** |
| Output tokens | **300** |
| Thoughts tokens | **1,790** |
| **Total tokens** | **3,989** |
| **Grounding queries** | **3** |
| Discovered URLs | **5** |
| Usable product URLs | **2** |
| MI candidates | **2** |
| SAME | **1** |
| PRESUMED_SAME | **1** |
| SIMILAR / CONFLICT / UNKNOWN | **0 / 0 / 0** |
| Price candidates (금액이 붙은 후보) | **1** |
| Domestic price evidence (유효) | 🔴 **0** (§4) |
| Overseas price evidence | **0** |
| model | `gemini-flash-latest` |
| resolve calls | 5 |
| fetch calls (🔴 Gemini 아님) | 7 |
| **실제 원화 비용 / 잔액 차이** | 🔴 **CTO 측정 불가 — CPO 기입** |

🔴 **STOP 기준 점검**: 호출 1회 · 실패 0 · 상한 초과 0 · 이상값 0 → **정상.** 중단 사유 없음.

---

## 2. 🟢 실제로 보낸 Primary Query — WU-014 가 의도한 그 모양이다

```
level        **L1_MODEL_CODE**
tokenCount   **3**
text         **"Bobo Choses B226AC010"**     ← 브랜드 + 품번, 그 둘만
```

🟢 WU-014 전에는 Primary 가 **상품명 단독**(15/15)이었고 품번이 Primary 에 들어간 것이
**0/3** 이었다. 이번 1건은 **품번 기반 쿼리가 실제로 나갔다.**

### 🔴 Gemini 가 «내부에서» 만든 검색어 3개 — 전문을 적는다

```
site:item.rakuten.co.jp "B226AC010"
Bobo Choses B226AC010
site:trenbe.com "B226AC010"
```

🟢 세 개 **전부 품번을 그대로 썼다.** 🟢 그리고 둘은 **스스로 `site:` 로 좁혔다.**
🔴 그 두 사이트(라쿠텐·트렌비)는 **우리가 넘긴 `preferredDomains` 에 없다** — Gemini 가
자기 판단으로 고른 것이다. 🔴 「우리가 사이트를 지정했다」로 적지 않는다.

### 🔴🔴 「5.5 → 3 으로 줄었다」로 적지 **않는다**

```
이전 관측 5.5 q/call 은 **조건이 다르다** — 상품당 Query **2** + **구 Primary(상품명 단독)**
· 분모 **N=8 호출**. 이번은 Query **1** + 신 Primary · 분모 **N=1 호출**.
🔴 헌장이 명시한 금지다(「5.5 를 Before 로 쓰지 않는다」). 적을 수 있는 것은
   **「이 1 call 에서 grounding query 가 3개였다」** 하나다.
```

---

## 3. 🟢🟢 MI 판정 — Gemini 후보가 **SAME 에 닿았다** (국내 시장 사이트에서)

| domain | verdict | confidence | price | priceStatus |
|---|---|---:|---|---|
| `global.trenbe.com` | 🟢 **SAME** | 0.53 | **없음** | `UNVERIFIED_SEARCH` |
| `m.web.mustit.co.kr` | 🟡 **PRESUMED_SAME** | 0.02 | **KRW 74,000** | `UNVERIFIED_SEARCH` |

🟢 둘 다 **한국 리세일 플랫폼** 이다(트렌비 · 머스트잇). 🟢 즉 Gemini 가 우리 등록부
«밖» 에서 국내 시장 후보를 찾아왔고, **기존 MI 가 그것을 판정했다**(전용 규칙 0).
🟢 trenbe URL 에 품번 `b226ac010` 이 그대로 들어 있다 — 품번 쿼리가 통한 직접 증거다.

---

## 4. 🔴🔴 그런데 **유효 국내 가격 증거는 여전히 0** 이다 — 이유를 정확히 적는다

```
① trenbe   SAME 인데 **가격이 없다**(price null) → 가격 증거가 될 수 없다
② mustit   KRW 74,000 이 있는데 **priceStatus = UNVERIFIED_SEARCH** 다
   🔴 운영 저장 블록은 `priceStatus === "VERIFIED_CURRENT" && currency === "KRW"` 일
      때만 `priceKrw` 를 채운다(run-domestic-price-check.ts 의 evidence push).
   → 🟢 그래서 이 후보는 **국내 최저가 축에 들어가지 않는다.** 설계대로다.
   🔴 그리고 PRESUMED_SAME 이라 tier 도 EXACT 가 아니다.
→ 🔴 **「유효 domestic EXACT」= 0 이 이번에도 유지된다.** WU-011 의 결론과 같다.
```

🔴 **다만 「0」의 성질이 달라졌다** — 전에는 「후보 자체가 국내 시장이 아니었다」였고,
이번은 **「국내 시장 후보를 찾았는데 가격이 검증 단계를 통과하지 못했다」** 다.
🔴 그것이 개선인지 아닌지는 **N=1 로 판단하지 않는다.**

### 🔴 보고해야 할 UX 위험 하나 (고치지 않았다)

```
WU-022 의 transient 구역은 `priceAmount`/`priceCurrency` 를 **priceStatus 와 무관하게**
그대로 보여준다. → 이번 mustit 건은 화면에 **「KRW 74,000」** 으로 보인다.
🔴 그런데 그 값은 **검색 목록에서 긁은 미검증 가격**(UNVERIFIED_SEARCH)이다.
🟢 판매판정·국내 최저가에는 **들어가지 않는다**(구역 문구가 그렇게 말하고 있고 실제로 그렇다).
🔴 그래도 「미검증」 표시가 없으면 셀러가 확정 가격으로 읽을 수 있다 —
   **제품 문구/표시 정책** 이라 CTO 가 임의로 바꾸지 않았다. CPO 판정 사안.
```

---

## 5. 🔴 이 하니스가 **기록하지 않은 것**

```
🔴 tier(EXACT/COMPARISON) — 판정 결과의 `matchTruth`/`verified` 를 기록하지 않았다
   (후보 칸의 `matchTruth` 는 둘 다 null 이다. 그건 다른 값이다).
   → 「EXACT 였다/아니었다」로 적지 않는다. **미기록** 이다.
🔴 `fetchDomesticModelCode` 를 **호출하지 않았다**(stub) — 비용 축을 늘리지 않으려고
   의도적으로 껐다. 운영은 그것을 부른다 → 판정이 운영보다 **보수적** 일 수 있다.
🔴 Production 실행이 아니다. **같은 함수·같은 인자** 를 로컬에서 불렀다.
🔴 상품 **1개** 값이다. 전수(498)로 환산하지 않는다.
```

---

## 6. CPO 가 채울 칸 (CTO 가 계산하지 않는다)

```
호출 전 잔액   ₩3,171 (CPO 제공)
호출 후 잔액   ____________   ← AI Studio 판독
실제 차감액     ____________   ← 위 둘의 차
🔴 그 숫자가 나와야 「상품당 비용」을 처음으로 **실측값으로** 말할 수 있다.
🔴 CTO 는 토큰·grounding 수까지만 책임진다(총 3,989 tokens · grounding 3).
```

---

## 7. 준수

```
🟢 Gemini 호출 **1**(= 승인 범위) · 상품 1 · Primary 1 · 후보 cap 3 · 재시도 0 · 루프 0
🟢 Production flag **변경 0**(env 에 키 없음) · `/today` bulk **미사용** · DB 쓰기 0
🟢 판정/threshold/Registry/카테고리/가격추적/URL 저장 변경 **0**
🔴 A(Production flag ON)로 **넘어가지 않았다** — CPO 가 B 결과를 보고 판단한다
🟢 하니스는 기본 **SKIP** 이다(`MI_P0_02_ONE_CALL=1` 전용 키) — 회귀에서 돈이 새지 않는다
```
