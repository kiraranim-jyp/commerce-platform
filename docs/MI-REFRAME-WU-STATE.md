# MI Discovery Value Reframing WU — Newness / Availability / Price Trend 사업가치 검증

> 🟢 **종료.** 최종 판정은 §15 다 — **CHANGE DIRECTION**.
> 🔴🔴 이 WU 가 뒤집은 전제: **병목은 Discovery 가 아니라 «재관측» 이다.**
> 🟢 선행 WU 넷 CLOSED. 전문은 `CLAUDE.md` §12.

---

## 1. Production owners (STEP 0 §5-B Preflight · 전부 코드 실측)

🔴 이번 WU 의 축은 **counterfactual 이 아니다** — 네 owner 전부 운영 호출부가 있다.

| 축 | owner | 운영 호출부 |
|---|---|---|
| Price Change | `computePriceChange` `pricing/price-history.ts:662` | `market-intelligence.ts:159` |
| Price Trend | `computePriceTrend` `:705` | `market-intelligence.ts:160-165` (**6곳**) |
| Price Alert | `computePriceAlertSignal` `price-alert-signal.ts:21` | `market-intelligence.ts:190` |
| Market Alert | `computeMarketAlert` `market-alert.ts:81` | `price-history/check/route.ts` → **DB `price_alerts`** |
| Availability | `price_observations.sold_out` | `market-intelligence.ts:216` — 🔴 **원가 선택을 바꾼다** |
| Seller 출력 | `computeSellerAction` `seller-action.ts:94` | `market-intelligence.ts:479` → UI `DomesticPriceIntelligencePanel.tsx:478` |
| 재관측 | `runPriceCheck` / `runDomesticPriceCheck` | `POST /api/price-history/check` ← **UI 클릭** |

🔴 **owner 가 «없는» 축** (grep 전수 0건 — 추측이 아니다):
```
RESTOCK              재입고 전이를 계산하는 코드가 없다
                     (「재입고」는 폼 안내문 2곳에만 있다 — 계산된 신호가 아니다)
NEW_SELLER           판매처 증가를 신호로 만드는 코드가 없다
SELLER_DISAPPEARED   판매처 소멸을 신호로 만드는 코드가 없다
NEW (상품 신규성)      owner 없음. 🔴 `snapshots/route.ts:59` 의 `isNewAnalysis` 는
                     「새 분석 요청인가」이고 **상품 신규성이 아니다**
```

🔴 **자동 스케줄이 없다** — `apps/admin/vercel.json` 에 `crons` 가 **없다**(파일에
`$schema` 한 줄뿐). 재관측은 UI 의 「가격 일괄 확인」(`today/page.tsx:151`, 동시성 3)
을 **사람이 누를 때만** 일어난다. 🟢 일괄 기능 자체는 **이미 있다.**

---

## 2. Existing Intelligence coverage (STEP 1 · FULL POPULATION)

🟢 운영 owner 로 전수 재계산했다. 스냅샷 **400** · 관측 **1755행** · 국내 링크 **88**.

```
② 가격 변화를 owner 가 내는 스냅샷      97/400 (24.3%)
   🟢 같은 «순간» 두 행을 비교한 것        0/97   ← 의심했는데 **반증됐다**
   🔴 같은 «날» 안에서 비교                13/97
   🟢 실제로 날짜를 건넌 변화              84/97
③ 추세(7d)   NEW 303 · UNCHANGED 55 · DOWN 23 · UP 19
④ 알림 신호  NO_CHANGE 97 · null 303   → 🔴🔴 **발화 0건**
⑤ 관측 날짜  1일 304 · 2일 37 · 3일 16 · 4일+ 40 · 0일 3
⑥ 품절 전이  **0/400**   (sold_out 이 true↔false 로 한 번도 안 바뀐다)
   최신 원가행이 품절      64
⑦ 국내 링크 보유 69 · created≠updated **69(전건)**
```

### 🔴🔴 ④ 가 0 인 이유 — 임계값이 아니라 «변화 폭» 이다

```
운영 임계값  ±10%  (DEFAULT_PRICE_THRESHOLD, price-alert-signal.ts:18)
실측 변화 폭  최대 **3.77%** · 중위 0.00% · 평균 0.35%
             |변화율| ≥ 10% → **0건**  ·  ≥5% → 0  ·  ≥3% → 1  ·  ≥1% → 13
```
🔴 즉 **임계값을 내리라는 결론이 아니다.** 관측 간격이 평균 **1.2일** 이라
가격이 움직일 시간 자체가 없었다.

### 🔴 변화 97건의 «원인» 분해 — 원가 1순위 축에서 실가격 변동 0

```
라벨/통화            전체  변화없음  🔴환율만  🟢실가격
KR_MARKET/KRW        51      16       0       35
ORIGIN_FX/USD         9       2       7        0
ORIGIN_FX/EUR         6       6       0        0
ORIGIN_FX/GBP         4       4       0        0
ORIGIN_FX/CAD         2       2       0        0
null/USD,KRW,EUR,GBP 25      25       0        0
합계                 97      55       7       35

🔴 ORIGIN_FX(= 원가의 1순위, 원본 시장 통화) 분모 21
   → 변화없음 14 · **환율 기인 7** · **실제 가격 변동 0**
🟢 KR_MARKET(판매처의 한국 표시가) 분모 51 → 실가격 35
   🔴 단 이 값에는 판매처 자신의 환율 스프레드가 이미 들어 있다
      (price-observations.ts:294 주석이 명시)
```

🔴 **셀러에게 나가는 「해외 원가 상승/하락」 문구 42건의 실체**(seller-action.ts:127-139):
```
하락 / 🟢실제 가격변동 / KR_MARKET   23
상승 / 🟢실제 가격변동 / KR_MARKET   12
상승 / 🔴환율 기인 / ORIGIN_FX        7   ← USD 금액은 그대로인데 「1.35% 상승」
변화율 0 으로 문구 없음               55
```

### 🔴🔴 용량-반응 — 병목이 무엇인지 가른다 (FULL POPULATION n=400)

```
관측일수   스냅샷   변화율≠0   검출률
 1일        304        0      **0.0%**   ← 구조적으로 불가능
 2일         37        8       21.6%
 3일         16        8       50.0%
 4일+        40       26       **65.0%**
```

🟢 **단조 증가한다.** 다시 보면 변화가 보인다. 🔴 「가격이 안 변한다」가 아니라
**「우리가 다시 보지 않는다」** 다. 1일만 관측된 304건의 0 은 **측정불가** 이고 0% 가 아니다.

---

## 3~8. Signal 축별 판정

| signal | owner | 데이터 | 판정 |
|---|---|---|---|
| **PRICE TREND** | 🟢 있다(끝까지 배선) | 97/400 변화 · 최대 3.77% | 🟡 **배선 완료 · 입력 부족** |
| **AVAILABILITY** | 🟢 있다(원가 선택까지) | 품절 64 · 🔴 전이 **0/400** | 🔴 **측정불가**(분모 0) |
| **RESTOCK** | 🔴 **없다** | 전이 0 | 🔴 **측정불가**(owner·분모 둘 다 0) |
| **NEW_SELLER** | 🔴 **없다** | 링크 88 · created≠updated 전건 | 🔴 **측정불가**(시점 못 가름) |
| **NEW (신규상품)** | 🔴 **없다** | — | 🔴 **측정불가** |

🔴 `NEW_SELLER` 가 측정불가인 이유를 정확히 적는다 — `domestic_product_links` 의
`created_at ≠ updated_at` 이 **69건 전건** 이라 「언제 추가됐는지」와 「언제 갱신됐는지」
를 구분할 수 없다. 🔴 「0건」이 아니다.

---

## 9. False Positive (STEP 5) — 🔴 거짓 신호가 «실제로» 나갔다

### §5-B CONTROL — 🟢 PASS 3/3 (운영이 낸 값을 그대로 재현)

운영 `price_alerts` 에 `ORIGIN_TREND` 3건이 실제로 있다. 전부 2026-08-27 에
열리고 **같은 날 RESOLVED** 됐다.

```
                 운영 알림      재현        현재데이터 기준
Voyage Dress     -39.11%   →  -39.11%  🟢      0
Lucy Cut Out     -36.27%   →  -36.27%  🟢      0
Ginevra           +3.76%   →   +3.76%  🟢      0
```

🔴 「현재 0」을 **불일치로 적으면 틀린다** — 그 뒤 관측이 쌓여
`computePriceChange` 의 `[latest, previous]` 가 다른 두 행이 됐기 때문이다.
🟢 **알림 시점의 두 행**으로 재현하면 세 값이 정확히 나온다.

### 🔴🔴 그 알림의 실체 — 축이 다른 두 값을 시계열로 읽었다

```
Lucy Cut Out Sandals
  2026-08-26  label=null   GBP 210 → KRW 396,226   ← 원본 시장가
  2026-08-27  KR_MARKET    KRW 252,500            ← 판매처의 «한국 표시가»
  (252,500 − 396,226) / 396,226 = −36.27%
→ 🔴 「해외 원가 36% 하락」은 가격 하락이 **아니다.**
```
세 건 전부 같은 모양이고(GBP↔KRW), 전부 같은 날 RESOLVED 됐다.

### 🟢 현재 설계는 이것을 막는다 — 음성 대조로 확인

`price-observations.ts:290` 주석이 이미 적어 뒀다 —
「…을 가격 변동으로 읽어 **없던 급락 알림까지 만든다**」.

```
🟢 ORIGIN_FX«와» KR_MARKET 이 함께 있던 스냅샷  136
   그중 KR_MARKET 이 실제로 제거된 수            **136/136**  PASS
```

### 🔴 Observed Production Defect — 기록만 한다(§13, 고치지 않았다)

```
잔존 위험: 원가 집합에 통화가 둘 이상 섞인 스냅샷 **4건**
  Voyage Dress · Lucy Cut Out · Ginevra · 보보쇼즈 26FW 데님팬츠
  전부 [KRW, GBP] · labels [KR_MARKET, null] · 🔴 ORIGIN_FX 라벨 **없음**
  (단일 통화 93 · 관측 1건뿐 300)

🔴 그 4건 중 **3건이 실제로 거짓 알림을 냈다**(위 CONTROL 대상 셋).
🔴 그 4건에 새 관측이 붙으면 같은 거짓 신호가 다시 날 수 있다.
🟢 단 이것은 «의도된» 동작이다 — `price-observations.ts:299` 가 명시한다:
   「ORIGIN_FX 가 한 건도 없는 스냅샷은 반환값이 예전 필터 결과와 **완전히 동일**
     하다 … 과거 행을 지우거나 다시 계산하지 않는다」
🔴 그래서 **결함으로 단정하지 않는다.** 「과거 데이터를 다시 쓰지 않는다」는 정책과
   「혼재 시계열을 읽지 않는다」는 보호가 충돌하는 **정책 경계** 다 → CPO 판정 사안.
```

---

## 10. Incremental Intelligence (STEP 2/6)

```
signal              기존이 이미 안다          Discovery 만 발견        둘 다      잘못 발견
PRICE TREND         🟢 97/400 (owner 전 구간)  🔴 0 — Discovery 는       —        7(환율)
                                              같은 상품 재관측을
                                              «대체하지 못한다»
AVAILABILITY        🟢 품절 64건 상태 보유      🔴 측정불가(전이 0)       —         —
RESTOCK             🔴 owner 없음              🔴 측정불가               —         —
NEW_SELLER          🔴 시점 못 가름            🟡 이론상 가능 ·          —         —
                                              🔴 owner 가 없어 미측정
NEW                 🔴 owner 없음              🔴 측정불가               —         —
```

🔴🔴 **핵심 — Discovery 는 「새 판매처/새 상품을 찾는」 기능이고, 「같은 상품을
다시 보는」 기능이 아니다.** 시장 변화 감지의 분모는 **재관측 횟수** 이고
Discovery 를 늘려도 그 분모는 변하지 않는다. 용량-반응이 그것을 보여준다.

## 11. Seller Actionability

🟢 실제 운영 산출물이 있다 — `price_alerts` **6행**:
```
PRICE_GAP     OPEN 2 · ACKNOWLEDGED 1   (예: 「최저가 대비 +20.5%」)
ORIGIN_TREND  RESOLVED 3                 🔴 셋 다 위 거짓 신호다
```
🔴 즉 **실제 seller action 으로 연결된 「시장 변화」 신호는 0건**이다
(PRICE_GAP 3건은 변화 신호가 아니라 «현재 가격차» 다).

## 12. Cost

```
재관측 1회     상품당 HTTP fetch 1~2회 (원산지 + 국내) — 기존 경로, 추가 구현 0
Discovery 1회  Gemini 호출 + lightFetch (선행 WU: lightFetch 202 · enrich 40 · Vision 16)
🔴 cost / usable signal       = **측정불가** (usable signal 0 → 분모 0)
🔴 cost / NEW signal          = 측정불가 (owner 없음)
🔴 cost / AVAILABILITY signal = 측정불가 (전이 0)
🟢 정성 비교: 재관측은 **이미 구현된 버튼** 이고 Discovery 보다 훨씬 싸다
```

## 13. §5-B / Numeric Gate — 🟢 PASS

```
ownerGate        🟢 네 축 owner 와 운영 호출부를 코드에서 확인
CONTROL          🟢 PASS 3/3 — 운영 알림 -39.11 / -36.27 / +3.76 «그 값» 재현
음성 대조         🟢 PASS 136/136 — KR_MARKET 이 실제로 제거된다
반증된 의심       🟢 「같은 순간 두 행 비교」 0/97 — 내가 의심했고 **반증됐다**
🔴 하니스 결함 1  음성 대조가 131/136 으로 깨졌다 → 제품이 아니라 내 매핑 결함
                 (`checked_at` 으로 행을 되돌렸는데 같은 순간 행이 207그룹)
```

## 14. Business Value Gate

| | 판정 |
|---|---|
| A. Signal Precision | 🔴 **낮다** — 실제 발화 3건이 전부 거짓(축 혼재) |
| B. Incremental Coverage | 🔴 **없다** — Discovery 는 재관측을 대체하지 못한다 |
| C. Business Relevance | 🔴 **미달** — 시장 변화 신호의 seller action 연결 0건 |
| D. Cost Viability | 🟡 재관측은 싸다(이미 구현) · Discovery 는 비싸고 분모 0 |

## 15. Strategic Decision — **CHANGE DIRECTION**

```
🔴 Discovery 를 시장 변화 감지에 쓰는 것은 레버가 아니다.
🟢 레버는 **재관측(re-observation) 주기** 다 — 용량-반응이 0% → 21.6% → 50% → 65%.
🟢 그 기능은 **이미 있다**(「가격 일괄 확인」, 동시성 3). 없는 것은 **자동 스케줄** 이다.
🔴 단 그것(cron 추가)은 Production 변경이고 이번 WU 범위가 **아니다** — CPO 판정 사안.
```

## 16. Production Change — **0**
코드 0 · DB 0(SELECT 만) · 정책 0 · 발견한 잔존 위험 4건을 **고치지 않았다**(§13).

## 17. Regression
전 패키지 회귀 0 failed · `apps/admin` tsc **0**(baseline 0) · 전 패키지 baseline **10** 유지.

## 18. Git
worktree clean · 🔴 **push 하지 않았다**(push 가 배포를 부른다 — CEO 판단 영역).

## 19. Known Unknowns

```
🔴 품절 전이 0/400 → RESTOCK 은 **측정불가**. 「재입고가 없다」가 아니다
🔴 NEW_SELLER 는 created_at≠updated_at 이 69/69 라 **시점을 못 가른다**. 0건이 아니다
🔴 관측 1일뿐 304건의 「변화 0」은 **구조적 측정불가** 다
🔴 ORIGIN_FX 축 실가격 변동 0/21 — 관측 간격이 짧아서다. 「해외가가 고정」이 아니다
🔴 KR_MARKET 기반 실가격 35건에는 판매처 자신의 환율이 섞여 있다(분리 미측정)
🔴 거짓 알림 3건은 2026-08-27 한 날짜의 것이다. 그 뒤 라벨 체계가 생겼고
   현재 신규 스냅샷에서는 136/136 막힌다 — 🔴 단 과거 4건은 남아 있다
🔴 잔존 위험 4건이 «정책 경계인지 결함인지» 는 CPO 판정이다. CTO 가 단정하지 않았다
🔴 Discovery 의 NEW_SELLER 발견 능력은 **미측정** — owner 가 없어서 비교 대상이 없다
```
