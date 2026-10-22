# 🔵 WU-149 — **Single Market Decision** (착수 전 · 좌표 확정 · 코드 0)

> 🔴🔴 **CTO 가 코드를 바꾸지 않았다.** 용량 판단(§4-C · CPO 가 같은 지시서에 적어 둔
> 예외 조항: 「용량이 부족해질 경우 **코드 변경 전에만** 안전 종료하고, 조사 결과와
> 정확한 다음 실행 좌표를 HANDOFF 에 고정한다. **코드 변경 후 중간에 끊어 미완성
> 작업트리를 남기지 않는다**」). 🟢 작업트리 **clean** · 이 문서가 그 좌표다.
>
> 🔴 **이 세션은 WU-145 · 146 · 147 · 148 넷을 이미 닫았다**(전부 배포 완료).
> WU-149 는 그 넷과 달리 **다중 파일 제거 + 계약 3건 동시 갱신 + 오케스트레이터
> 구조 변경** 이라 남은 용량으로 끝까지 갈 수 없다 — 아래 §측정이 그 근거다.

---

## 🟢🟢 먼저 — **절대조건 15 중 11 은 «이미» PASS 다**

| # | 조건 | 상태 | 근거 |
|---|---|---|---|
| 1 | 후보 리스트 기본 노출 0 | 🔴 **미달** | 레거시 패널 둘이 남아 있다 → **STEP 1** |
| 2 | 유사상품이 가격 판단에 안 들어감 | 🟢 | `selectMiSameCandidates` SAME 전용 · `wu-141-r3 C-1-d` 가 **기계 검증** |
| 3 | SAME 만 가격 판단 | 🟢 | 같은 계약 |
| 4 | SAME 2~3개 확보 후 검색 종료 | 🔴 **미구현** | → **STEP 3**(🔴 아래 설계 문제 있음) |
| 5 | 국내 = 시장 가격대 | 🟢 | **WU-148** `domesticPriceBand` · 1건은 「가격대 확정 불가」 |
| 6 | 해외 = 최저 확인가 | 🟢 | **WU-148** `overseasLowestText` |
| 7 | 통화 환산 없음 | 🟢 | `overseas-reference` + `wu-148 B-2` |
| 8 | 추천 판매가 없음 | 🟢 | `wu-146 C-3` · `wu-148 C-3` |
| 9 | 국내/해외 MI 알고리즘 동일 | 🟢 | **WU-147** 코드로 확정(같은 파일 · 같은 계약 · 한 MI) |
| 10 | 가격 숫자 owner 1개 | 🟢 | `wu-141-r3` · `wu-146 1-b` |
| 11 | 이전 후보 = 엔진 보존 · 셀러 비노출 | 🟡 **절반** | 📚 접힘은 **WU-145 ③** · 완전 비노출은 **STEP 1** |
| 12 | MI precision 유지 | 🟢 | 이 트랙 MI 변경 **0**(WU-143 이 네 레버 전부 되돌렸다) |
| 13 | DIFFERENT → SAME 누출 0 | 🟢 | **WU-142** 실측 precision 6/6 · 누출 0 |
| 14 | `price_alerts` 체인 보호 | 🟢 | 변경 0 |
| 15 | DB/schema 변경 없음 | 🟢 | 변경 0 |

🔴🔴 **그래서 WU-149 는 «둘» 로 줄어든다 — STEP 1 과 STEP 3.**
🔴 STEP 2·5·6·7·8·9 는 **이미 구현돼 있다**(재구현하면 하나인 것을 둘로 쪼갠다).

---

## 🔴 STEP 1 — 레거시 패널 제거: **측정된 파장**(이것이 용량 판단의 근거다)

```
제거 지점 (실측 좌표)
  apps/admin/src/app/pipeline/CommerceWorkspace.tsx:3884  <DomesticShopSearch …/>   (9줄 prop)
                                                :3900  <ComparisonShopSearch …/> (13줄 prop)
  🔴 둘 다 `marketEvidence={ … }` 슬롯 안이고 `PRICE_COMPARISON_ANCHOR_ID` div 가 감싼다

🔴 **지우면 미사용이 되는 심볼**(실측 참조 수 · `noUnusedLocals` 가 잡는다)
  handleRequestPriceReview  **9**   ← 가장 넓다. 다른 소비처가 있는지 **먼저 확인**
  marketEvidence            **7**   ← 슬롯 자체(소비처가 레이아웃 쪽에 있다)
  PRICE_COMPARISON_ANCHOR_ID **4**  🔴 `scrollIntoView` 소비자 — WU-141-R3 에서 **이미
                                      호출자를 잃었다**(CPO 판정 대기 · 지우지 말라고 적혀 있다)
  ComparisonShopSearch      **4**   marketEvidenceVariant **3**
  domesticEvidenceOpen      **2**   overseasEvidenceOpen **2** · marketEvidenceRequest **2**

🔴 **두 컴포넌트를 참조하는 운영 파일이 CommerceWorkspace 하나가 아니다**(실측):
  market-evidence.ts · DomesticPriceIntelligencePanel.tsx · match-display.ts ·
  MarketPriceComparison.tsx · GeminiTransientCandidates.tsx · run-domestic-price-check.ts
  🟢 대부분은 **타입/술어 재사용** 이지만 **전수 확인 없이 지우면 안 된다**(§12-0)

🔴 **동시에 갱신해야 하는 계약 셋** — 이 둘의 존재를 **글자로** 단언한다
  `wu-056r1-price-section-identity`  두 구역의 제목 상호 비포함 · 해외 구역 `₩` 0
  `mi-022-gemini-transient-ux`        패널 배선 + 후보 구역 접힘
  `wu-130-overseas-auto-pool F-3`     「가격비교 영역은 하나 · 제목이 하나뿐」
  🔴 그리고 `product-tab-first-screen` · `mi-ux-final` 이 **같은 화면을 마운트** 한다
     ⟹ 제거하면 그 둘도 FAIL 할 가능성이 크다(전체 회귀로만 확인된다)
```

🟡 **CPO 판정 1 — 방식**: ⒜ **완전 제거**(render tree 에서 삭제) ↔ ⒝ **flag 로 숨김**
(`isSuppliedUrlInputVisible()` 과 같은 모양 · WU-130 ③ 선례 · 파서·배선·계약 전부 보존).
🔴 CPO 지시는 ⒜ 다(「flag 로 계속 숨기는 임시방편보다 seller-facing render tree 에서
제거」). 🔴 그러면 **계약 셋을 「그 구역이 없다」로 뒤집어야** 하고, 그것이 이 WU 의
가장 큰 덩어리다(약화가 아니라 **반대 방향 단언** 으로 다시 써야 한다).

### 🔵 다음 세션 실행 순서 (STEP 1)

```
1  `handleRequestPriceReview` · `marketEvidence` 의 **다른 소비처를 전수 확인**
   (레이아웃 쪽에서 쓰는지 · 쓰면 슬롯만 비우고 심볼은 남긴다)
2  두 컴포넌트 JSX 제거 — 🔴 `PRICE_COMPARISON_ANCHOR_ID` div 는 **남긴다**
   (WU-141-R3 이 「앵커는 보존 계약」이라 적었다 · 지우면 그 판정과 충돌한다)
3  미사용 심볼 정리 → `npx tsc -p apps/admin/tsconfig.json --noEmit` 로 전수 확인
4  계약 셋을 **반대 방향으로** 다시 쓴다 — 「그 구역이 셀러 화면에 **없다**」
   🔴 약화가 아니다: 「없음」 단언 + 「backend/API 는 **살아 있다**」 단언을 **같이** 둔다
5  변이 — ⒜ 패널을 되살린다 ⒝ 앵커 div 를 지운다 ⒞ backend API 를 지운다
6  전체 회귀(🔴 `product-tab-first-screen` · `mi-ux-final` 이 깨질 것을 예상한다)
7  typecheck → build → main 머지 → 배포 → production route
```

---

## 🔴🔴🔴 STEP 3 — **「SAME 3개면 검색 중단」은 flag 가 아니다.** 설계 문제를 먼저 적는다

🔴 CPO 지시: 「`SAME >= 3` → 추가 후보 검색 중단」.
🔴🔴 **그런데 현재 구조에서 그것은 불가능하다** — 이유가 하나다:

```
SAME 은 **수집이 끝난 뒤에** 결정된다.
  수집   run-domestic-price-check:1006·1011·1014·1128·1174 — 다섯 생산자가
         `Promise.allSettled` 로 **병렬** 로 돈다(한 생산자가 다른 생산자를 모른다)
  판정   그 뒤 `withConfidence` → `attachMatchTruth` → `judgeDomesticCandidate`
⟹ 🔴 「SAME 3개」를 알려면 **판정까지 가야** 하고, 판정은 **수집 뒤** 다.
⟹ 🔴 「SAME 3개면 수집 중단」은 **수집과 판정을 교대로 돌리는 구조 변경** 이다
   (병렬 → 순차 + 중간 판정). 그것은 **오케스트레이터 재구조화** 이고 flag 한 줄이 아니다.
```

🟢 **그리고 «같은 취지» 의 조기 종료가 이미 둘 있다**(새로 만들 필요가 없을 수 있다):
```
⒜ `searchOneDomesticShop`(comparison-search/index.ts:330~350)
   검색어 사다리를 돌다가 `crossSellerVerdict === "SAME"` 이 **외부 판매처에서** 확정되면
   `break` — 🟢 **샵 안에서는 이미 「SAME 나오면 멈춘다」** 가 구현돼 있다
   🔴 단 **샵 단위** 다(샵끼리는 독립 병렬) ⟹ 전역 「3개」가 아니다
⒝ `foundVeryHighInP0`(run-domestic-price-check:1014)
   P0 에서 very_high 가 나오면 **P1 등록부를 뒤지지 않는다** — 🟢 전역 조기 종료의 선례
```

🟡 **그래서 STEP 3 의 «최소» 버전 둘**(🔴 CTO 가 고르지 않았다 · CPO 판정):
```
⒜ **수집은 그대로, «표시» 만 2~3개로 끊는다**
   🟢 비용 0 · 구조 변경 0 · 계약 하나(「가격 판단은 SAME 상위 N개만 쓴다」)
   🔴 그러나 CPO 가 원한 「검색 종료」가 아니다 — **비용은 그대로** 다
⒝ **생산자를 순차화하고 사이에 판정을 끼운다**(진짜 조기 종료)
   🔴 오케스트레이터 재구조화 · 병렬성 손실로 **응답 시간이 늘 수 있다** ·
      `foundVeryHighInP0`·`__overseas_auto__` 합류 지점(WU-130 계약)과 충돌 검토 필요
   🔴 그리고 **현재 국내 SAME 이 0** 이라 ⒝ 를 넣어도 **국내에서는 발화하지 않는다**
🔴🔴 **실측 근거** — 이 트랙에서 SAME 이 3개 이상 나온 시장은 **해외뿐** 이고
   그 수는 **3**(S1/S2 둘 다). ⟹ 🔴 「3개면 중단」의 **효과가 현재 데이터에서 0** 이다
   (이미 3개에서 멈춰 있다). 그래서 ⒝ 의 비용/위험을 지금 지불할 근거가 약하다
```

---

## 🟢 STEP 5·6 — **이미 충족돼 있다**(WU-147 이 코드로 확정)

```
🟢 국내/해외가 **같은 파일·같은 단계·같은 `ComparisonCandidate` 계약·같은 MI** 를 쓴다
   (`comparison-search/index.ts` 해외 :232 · 국내 :406 · WU-147 전수 대조)
🟢 「후보가 어디서 왔는지」는 이미 MI 판정 기준이 **아니다** — `source` 는 배지일 뿐이다
🔴 ⟹ **새 Candidate Contract 를 만들지 않는다**(만들면 하나인 것을 둘로 쪼갠다)
🔴 국내 어댑터 추가 **금지**(CPO STEP 5 명시) · Gemini **금지** · Registry 확대 **금지**
🔴 그리고 WU-147 이 측정했다 — 어댑터 게이트는 **국내 0/2 · 해외 3/22** 로 양쪽을 거의
   같게 막는다 ⟹ 「국내만 어댑터가 없어서」가 **아니다.** 첫 divergence 는 **① 공급**
   (AI 답변 URL 국내 6·4 : 해외 30·25 · WU-118)이고 **CPO 결정축** 이다
```

---

## 🔴🔴 측정불가 / 넘겨 읽지 않을 것

```
⒜ 🔴 **🇰🇷 국내 가격대는 현재 데이터에서 서지 않는다** — tier SAME **0**(WU-138 확정 ·
   완화 REJECT). WU-148 의 가격대 로직은 **계약으로만** 증명됐다.
   ⟹ 🔴 STEP 10 의 「국내 SAME 1~3개 가격대」는 **STEP 1/3 을 다 해도 나오지 않는다** —
      그것은 **① 공급(CPO 결정)** 이 열린 뒤의 일이다. 「WU-149 PASS = 국내 가격대 표시」로
      적으면 거짓이 된다
⒝ 🔴 실제 따져 화면은 CTO 가 볼 수 없다 ⟹ 화면 축은 **마운트 DOM** 이다
⒞ 🔴 STEP 3 의 효과는 **현재 데이터에서 0** 이다(해외 SAME 이 이미 3)
⒟ 🟡 `PRICE_COMPARISON_ANCHOR_ID` 는 **여전히 호출자를 잃은 상태** 다(WU-141-R3 ·
   CPO 판정 대기). STEP 1 에서 **지우지 않는다**
```

🟢 **이 문서가 다음 세션에 주는 것** — ① 절대조건 15 중 **남은 것이 1·4·11 뿐** 이라는 사실
② STEP 1 의 좌표와 **미사용 심볼 7개의 참조 수** ③ 깨질 계약 **다섯**(셋 + 예상 둘)
④ STEP 3 이 **flag 가 아니라 구조 변경** 이라는 설계 결론과 **최소 버전 둘**
⑤ 🔴 국내 가격대가 이 WU 로 열리지 **않는다** 는 사실(기대치 고정).

---

## 🟢 실행 완료 기록 — **STEP 3/4 만** 구현·배포 (2026-10-22)

🔴 **STEP 0 동결 전수 준수** — MI threshold · SAME/SIMILAR/DIFFERENT 판정 ·
NO_TITLE_OVERLAP · BRAND 축 · MODEL_CODE · `price_alerts` · Registry · 어댑터 ·
DB schema · 추천 판매가 · 환산 · Gemini/API · 새 검색 알고리즘 · 새 후보 UI — **전부 0.**
운영 **1 파일 · 함수 1개 내부**(`buildPriceGuide`).

```
🟢 `SAME_PRICE_CAP = 3` — **가격 계산에만** 적용되는 통화별 상한
🔴🔴 **통화별** 이다. 전역으로 오름차순 3개를 자르면 **통화를 섞어 숫자를 비교** 하게 되고
   (GBP 37 < USD 58 ?) 그 비교는 환산 없이 무의미하다 ⟹ **USD 축이 통째로 떨어져
   「최저 확인가」가 거짓이 될 수 있다.** 🟢 통화 안에서만 자르면 **각 통화의 최저가가
   항상 보존** 된다(🌎 「최저 확인가」의 전제).
🔴 **건수는 자르지 않았다**(CPO STEP 10 「현재 결과를 숨기지 말고 정확히 표시」) —
   `sameCount`·`onSaleCount`·`pricedCount`·`unpricedCount` 는 **관측된 사실 그대로** 다.
   ⟹ 「동일상품 확인 5곳 · 가격 확인 5곳」인데 가격대는 **하위 3곳 기준** 이 된다.
   🟢 「전체 시장 가격대가 아니다」는 `PRICE_GUIDE_RANGE_NOTE` 가 **이미** 말한다(WU-139)
🟢 수집·판정·오케스트레이션 **변경 0** — CPO STEP 4 의 「뜯어고치지 않는다」 그대로
```

🟢 **계약 4 추가**(`wu-148-market-price-signal` D 블록) — ⒜ 상한이 **실제로 발화한다**
(국내 5곳 → 가격대가 하위 3곳 기준 · **최저가 보존** · 105000 배제) ⒝ **건수는 안 자른다**
⒞ 🔴 **통화별 상한**(USD 4 + GBP 1 → 두 통화 **둘 다 생존** · 각 최저가 보존 · USD 70 배제)
⒟ 상한 이하면 **동작 불변**(기존 계약이 그대로 유효한 이유).

🟢 **음성 대조 Q1**(상한 무력화 `999`) → **2 FAIL** → 바이트 동일 복구.
🟢 회귀 **626 files / 8,734 passed · 0 failed** · typecheck **0** · build **0**.

### 🔴🔴 STEP 1/6/7(레거시 UI 제거)은 **하지 않았다** — 이유를 숨기지 않는다

```
🔴 CPO 지시에 적힌 그대로다 — 「**코드 변경 후** 세션이 부족해질 것 같으면 **즉시 안전
   종료** 하고, 작업트리를 더럽힌 채 임의 중단하지 않는다」.
🔴 이 세션은 WU-145·146·147·148 넷을 닫고 배포했고 WU-149 의 STEP 3/4 까지 배포했다.
🔴 STEP 1 은 **다중 파일 제거 + 미사용 심볼 7개 정리 + 계약 다섯 «반대 방향» 재작성** 이고
   그 파장은 위 §STEP 1 에 **숫자로** 측정돼 있다 ⟹ 지금 시작하면 중간에 끊긴다.
🟢 그래서 **가격 신호 축(STEP 3/4)만** 완전히 닫았다 — 이 증분은 **단독으로 안전** 하다
   (화면 구조를 건드리지 않고 가격 계산 상한만 둔다 · 계약·변이·회귀·배포 전부 통과).
```

🔴 **그러므로 다음 세션의 단일 작업은 STEP 1/6/7 이다** — 좌표는 위 §STEP 1 의 실행 순서
7단계 그대로이고 **조사는 끝나 있다.**
