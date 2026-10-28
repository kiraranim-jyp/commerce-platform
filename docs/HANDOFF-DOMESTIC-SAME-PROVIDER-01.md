# DISCOVERY-DOMESTIC-SAME-PROVIDER-01

🔴 Query · Search · Identity · Market Attribution · MI 계산식 · Registry · adapter **추가 0** ·
새 Search **0** · UNKNOWN→KR 강제 **0**. 🟢 운영 변경 = **가격 정규식 캡처 한 자리**(§13).

---

## A. 국내 축 Funnel — B226AC009 (재투입 경로 · 새 Search 0)

```
사람 확정 후보(candidate_reviews · origin_code=B226AC009)   23행 (SAME 18 · DIFFERENT 5)
고유 URL                                                    21
   ↓  운영 재투입 생산자 `__reviewed_same__`(= `/check` 가 쓰는 그 경로)
Crawl → Evidence 도달                                        **6**
   ↓
Market   🇰🇷 KR **2** · 🌎 OVERSEAS 4 · ❔ UNKNOWN 0
Identity SAME 1 · PRESUMED_SAME 3 · CONFLICT 2
가격 확보 **6 / 6**  (🇰🇷 2/2)
   ↓
🇰🇷 국내 후보 = **URL + 판매처 + 가격 + 판정** 이 **전부 붙어 있다**
```

### 🟢🟢 국내 2건은 **CPO 가 요구한 모양 그대로** 나온다

| 판매처 | URL | 가격 | Identity | market | priceStatus | human |
|---|---|---:|---|---|---|---|
| `biskuit.kr` | `/product/보보쇼즈-허그…` | **₩88,000** | PRESUMED_SAME · COMPARISON | KR | VERIFIED_CURRENT | **SAME** |
| `m.luxboy.com` | `/product/a14338197…` | ₩59,000 | PRESUMED_SAME · COMPARISON | KR | VERIFIED_CURRENT | 🔴 **DIFFERENT** |

🟢 **CEO 가 본 `₩88,000` 의 근거가 바로 `biskuit.kr` 이다** — 가격만 떠 있는 숫자가 아니다.
🔴 **그런데 `m.luxboy.com` 은 사람이 DIFFERENT 라 한 후보** 이고 MI 는 `PRESUMED_SAME · KR ·
₩59,000` 을 낸다 ⟹ 국내 참고가격을 **최저가** 로 잡으면 **₩59,000(틀린 상품)** 이 된다.
🔴 WU-077 이 이미 측정한 그 모양이다. **이번에 고치지 않았다**(Identity/MI 금지).

### 🔴 탈락 15건 — **국내는 하나도 잃지 않았다**

```
human SAME 12건  bornyesterdaykids · junioredition(×3) · kids21 · scoutandcokids ·
                 stockmann.ee · thefrontshop · tinyapple(×2) …   ⟹ **전부 해외 TLD**
human DIFF  3건  cemarose.ca · tinyapple.net · villagekids.co.uk
🟢 **탈락 중 한국 TLD = 0** ⟹ 국내 축 손실은 **pool/policy/crawl/evidence/market/price
   어디에도 없다**. 🔴 해외 12건 탈락은 **다른 축** 이고 이번 범위가 아니다.
```

---

## B. 🔴🔴 CPO 전제 정정 — **「과거 여러 개」의 분모가 다르다**

```
B226AC009 의 human SAME **18건 중 한국 TLD 는 `biskuit.kr` 하나** 다(실측).
나머지는 junioredition · cissywears · tinyapple · stockmann.ee · kids21 ·
scoutandcokids · thefrontshop · bornyesterdaykids · trenbe · bobochoses — **전부 해외**.
🟡 한국 소비자를 보지만 TLD 가 다른 것 둘 — `global.trenbe.com` · `tinyapple.net/en-kr`
   ⟹ 🔴 운영 Market Attribution 은 그것을 KR 로 세지 않는다(§8 유지).
⟹ 🟢 「국내 후보가 줄었다」가 아니라 **「국내 확정 후보가 애초에 1~2」** 다.
```
🔴 그러므로 **「국내 후보를 못 찾았다」로도 「사라졌다」로도 적지 않는다** — 분모가 작다.

---

## C. 기존 13(실측 18) SAME 후보의 현재 상태

```
재투입 여부   🟢 **된다** — `/check` 가 `listReviewedSameUrls({snapshotId, originCode})`
              로 읽어 `reviewedSameUrls` 로 넘긴다(운영 경로 · 코드 변경 불필요)
🔴🔴 그런데 **§17 1회용 라우트가 그 인자를 넘기지 않았다** ⟹ 그 측정의
     「Bobo Choses 후보 1건」은 **내 하니스 수치** 다(제품 결함 아님)
현재 상태     21 URL → Evidence 6 → 🇰🇷 2 · 🌎 4 → 가격 6/6
DOM 노출      🟢 §19 에서 Production 31행이 **소실 0** 으로 마운트됨을 이미 확인했다
```

---

## D. 화면 Owner — **코드로 확정**(추측 0)

| 화면 값 | owner | source |
|---|---|---|
| 🇰🇷 **국내 참고가격** | `candidateDomesticPrice` = `summarizeCandidateOverseasPrices(domesticTransientRecords)` | **일시 후보 evidence**(tier `EXACT\|COMPARISON`) |
| 국내 후보 **URL** | `GeminiTransientEvidence.discoveredUrl` | 같은 evidence 배열 |
| 국내 후보 **가격** | `GeminiTransientEvidence.priceAmount/priceCurrency` | 같은 evidence 배열 |
| 🌎 **해외 최저 소싱가** | `candidateOverseasPrice` = 같은 함수 | 같은 evidence 배열(`market !== "KR"`) |
| 해외 후보 **URL** | `GeminiTransientEvidence.discoveredUrl` | 같은 배열 |
| (참조) `domesticLowestPriceKrw` | `domesticCompetition.lowestPriceKrw` ← `summarizeDomesticMarketSplit` | 🔴 **`price_observations`(영속)** — **다른 칸** |

🟢🟢 **§12 의 답 — 국내와 해외는 «이미» 같은 데이터 모델이다.** 둘 다
`GeminiTransientEvidence` 한 타입이고 가격 함수도 **같은 함수** 다. 갈리는 곳은
`market === "KR"` 한 줄뿐이다 ⟹ 🔴 **국내 전용 후보 모델을 만들 필요가 없다**(만들지 않았다).

🔴 **남은 비대칭은 하나** — 화면 「국내 참고가격」은 ①(일시 후보)을 쓰는데
`domesticLowestPriceKrw` 는 ②(영속 관측)를 쓴다. 🔴 그 통합은 **가격 owner 교체** 라
CPO 승인 사안이고 §10 이 「즉시 갈아엎지 않는다」고 했다 ⟹ **맵핑만 하고 두었다**.

---

## E. §13 — `117,000 → 117` 결함 **수정 완료**

```
원인  deuxbebe.ts  DETAIL_PRICE_RE 의 캡처가 `([0-9]+)` 라 **콤마에서 멈췄다**
수정  `([0-9][0-9,]*)` — 🟢 같은 파일 `parsePrice` 가 이미 `[^0-9]` 를 지운다(새 정규화 0)
검증  `117,000` → **117000** · `117000` → **117000** · `134,000원` → **134000** ·
      「품절」 → **null**(지어내지 않는다)
변이  캡처를 `([0-9]+)` 로 되돌리면 **2 FAIL** → 복구 5 passed
      🔴 1차 변이가 **적용되지 않았는데** 테스트가 통과했다 — 적용 확인 마커가 🟡 를
         찍어 잡았고, 쉘 대신 **Edit 도구** 로 다시 변이했다(메모 그 함정)
정리  오염 관측 **1행 삭제**(DOMESTIC_SHOP · price_krw < 1000 전수 = 1)
      🟢 지우기 전에 같은 URL 의 **정상 관측 2행** 을 확인했다 · 잔존 **0** 확인
🔴 그 1행은 **§17 실행이 쓴 것** 이다(2026-10-28) — 내가 만든 데이터라 내가 정리했다
```

---

## F. §7 Q1~Q10 (B226AC009 · 국내 축)

| Q | 답 |
|---|---|
| Q1 AI Search 가 국내 URL 을 반환했는가 | 🔴 **아니다** — §17 Production 실행의 organic 4건은 전부 해외(bobochoses · tinyapple · junioredition · bridge.babyshop) |
| Q2 몇 건 | **0** |
| Q3 그중 Product URL | 0 (분모 0) |
| Q4 Policy 통과 | 0 (분모 0 · 🔴 **차단된 것도 0** 이다) |
| Q5 Crawl 성공 | 0 |
| Q6 Evidence | 0 |
| Q7 KR 인정 | 0 |
| Q8 Identity | 0 |
| Q9 URL + 가격이 API 에 | **0**(AI Search 축) · 🟢 **2**(재투입 축 · biskuit.kr · m.luxboy.com) |
| Q10 따져 화면 표시 | 🟢 §19 에서 **소실 0** 확인 · 🔴 **AI Search 가 낸 국내 후보는 0 이라 표시할 것이 없었다** |

🔴🔴 **그러므로 CPO 의 한 질문에 대한 답은 아직 NO 다**:
```
「AI Search 가 찾은 국내 후보가 동일/유사 국내 판매처 URL + 가격으로 연결되어
  따져 화면에 보이는가」
→ 🔴 **AI Search 축에서는 NO** (국내 URL 자체를 0건 반환했다)
→ 🟢 **파이프라인은 준비돼 있다** — 재투입 축에서 그 모양이 **실제로 나온다**
     (biskuit.kr: URL + ₩88,000 + PRESUMED_SAME + KR + VERIFIED_CURRENT)
⟹ 🔴 남은 병목은 **Search 가 국내 URL 을 내느냐** 하나다(§14 가 Query 변경을 금지했다)
```

---

## G. 계약 12 + 변이 2

```
분모 3   human 라벨 전수 · 🔴 **한국 TLD 는 1건** · 🟡 한국 소비자용·타 TLD 를 따로 센다
가격 5   콤마 표기 · 무콤마 표기 · 기호/꼬리 혼재 · 금액 없으면 null · 「콤마 없다」 단정 금지
UI  7    (직전 WU) 부정문 금지 · 짧은 라벨 · 상세 근거 보존 · 금액/testid/해외축/숫자줄 보존
변이     캡처 되돌리기 **2 FAIL** · (직전) 부정문 복귀 2 FAIL · 상세 근거 제거 1 FAIL
```

## H. 보고

```
회귀       732 files / 9,620 passed / 0 failed
Typecheck  0
Build      exit 0
Git        아래 커밋 · worktree clean · origin/main 0/0
Deploy     push = Production 배포
판정       🟡 **PARTIAL**
```

🟡 **PARTIAL 인 이유 — §17 의 성공 기준이 「AI Search → 국내」이고 그 축이 0 이다.**
🟢 그 외는 전부 닫혔다 — 국내 후보의 **URL+가격+판정 동시 제공**(실측 2건) · owner 맵핑 ·
가격 결함 수정·검증·정리 · 의미 충돌 문구 제거 · DOM 소실 0.

🟡 **CPO 결정 둘**
```
① 🔴 **AI Search 가 국내 URL 을 0건 낸다** — §14 가 Query 변경을 금지했으므로
   이 축을 열려면 CPO 가 **별도 WU 로 지정** 해야 한다(CTO 가 Query 를 만지지 않았다)
② 🔴 **국내 참고가격이 최저가를 쓰면 `m.luxboy.com ₩59,000`(human DIFFERENT)이 이긴다** —
   `biskuit.kr ₩88,000` 이 정답이다. 그 선별은 **Identity/가격 정책** 이라 손대지 않았다
```
