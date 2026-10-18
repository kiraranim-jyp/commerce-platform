# WU-068 — 통합 GT(51 + 19) 재계산 · CF-2 최종 판정 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 12항 · 「CF-2 구현은 **절대** 하지 말 것」
> 「단순히 precision 숫자만 좋아지는 것은 GO 근거로 인정하지 않음」

---

## 0. 판정 — 🟡 **HOLD (CPO 검토 대상)**

CPO 가 준 판정 기준에 그대로 대입한다:
```
False SAME 증가 → 즉시 REJECT          ⟹ 증가 **0** · 해당 없음
False SAME 0 이고 SAME 회복 0 → REJECT  ⟹ 회복 **1** · 해당 없음
🟡 **False SAME 0 + 실제 SAME 회복 ≥1 → CPO 검토 대상으로 HOLD**  ⟸ **여기**
```

---

## 1. 🔴🔴 먼저 — **CPO 집계를 정정한다**

지시서에 「SAME 11 · DIFFERENT 3 · UNCERTAIN 5」로 적혔는데, CEO 가 보낸 JSON 을 세면:
```
S1  SAME 5 (1,2,3,4,7) · DIFFERENT 2 (5,6)
S2  SAME 4 (1,2,3,4)
S3  SAME 1 (1) · UNCERTAIN 1 (2)
S4  UNCERTAIN 1      S5  UNCERTAIN 1
S6  UNCERTAIN 3 (1,2,3) · DIFFERENT 1 (4)
⟹ **SAME 10 · DIFFERENT 3 · UNCERTAIN 6** (합 19)
```
🔴 **분모라서 중요하다.** 아래 모든 숫자는 **10/3/6** 기준이다.

---

## 2~5. 통합 분모와 정책별 재계산

```
분모  기존 50(SAME 27 · DIFFERENT 23) + 신규 13(SAME 10 · DIFFERENT 3) = **63**
      🔴 UNCERTAIN **7건**(기존 1 + 신규 6) 분모에서 **제외** — 억지로 환산하지 않았다
      🔴 기존 51건의 Human GT 는 **한 글자도 바꾸지 않았다**
파생  DIFFERENT **135** (WU-066) — 회귀용
```

| | EXACT | SAME | 🔴 False SAME | precision | recall |
|---|---|---|---|---|---|
| 기존 51만 · Baseline | 12 | 11 | **1** | **91.7%** | 40.7% |
| **통합 63 · Baseline** | **16** | **14** | **2** | **87.5%** | 37.8% |
| **통합 63 · CF-2** | **17** | **15** | **2** | **88.2%** | 40.5% |
| 통합 63 + 파생 135 · Baseline | 16 | 14 | 2 | 87.5% | 37.8% |
| 통합 63 + 파생 135 · CF-2 | 17 | 15 | 2 | 88.2% | 40.5% |

🟢 **파생 135 를 더해도 숫자가 같다** — 파생 분모에서 EXACT 가 **0** 이다(⑨ 회귀 통과).

---

## 6. CF-2 가 **새로** EXACT 로 올리는 것

```
C47  biskuit.kr  (OLD · CEO **SAME**)   COMPARISON → EXACT
그 외 **없음** — 신규 19건에서 tier 가 바뀌는 것 **0건**
```

🔴 즉 WU-065 이후 **이득이 한 건도 늘지 않았다.** 신규 19 는 `modelCode unavailable` 이
대부분이라 CF-2 가 걸리지 않는다(WU-067 §2 가 예고한 그대로다).

---

## 7. WU-067 의 «라벨 없던 EXACT 4건» — 분모 갱신

| | 도메인 | CEO | |
|---|---|---|---|
| S1-2 | eraldo.com | **SAME** | 🟢 |
| S1-3 | cissywears.com | **SAME** | 🟢 |
| **S1-6** | **tinyapple.net** | 🔴 **DIFFERENT** | **「반팔이고, 컬러 다름」** |
| S2-2 | thefrontshop.com | **SAME** | 🟢 |

🔴🔴 **새 False EXACT 1건이 나왔다.** 그리고 **C06 과 같은 클래스**(컬러 차이)이며
**같은 샵**이다 — WU-060 의 C05 가 바로 tinyapple.net 이었다.
⟹ precision 분모가 12 → 16 이 되면서 **91.7% → 87.5%** 로 내려갔다.

---

## 8. C06 / C08 anchor

```
C06  CEO DIFFERENT · base **EXACT** · cf2 **EXACT**   🟢 변함없다(텍스트로 못 막는 그 건)
C08  CEO DIFFERENT · base COMPARISON · cf2 COMPARISON 🟢 보호 유지
```

---

## 9. 파생 135 회귀

```
Baseline  파생에서 EXACT **0/135**
CF-2      파생에서 EXACT **0/135**   🟢 새 False SAME 유입 없음
```

---

## 10. 🔴 세 축을 분리한다 (CPO §10)

```
⒜ 실제 Human SAME 회복(CF-2)           **1건**  — C47 biskuit.kr
⒝ False SAME 증가(CF-2)                **0건**
⒞ 단순 분모 증가로 생긴 precision 변화   91.7% → 87.5%  (**-4.2p**)
   🔴 이것은 **CF-2 와 무관** 하다. 신규 라벨이 들어와 분모가 늘고
      그중 하나(S1-6)가 False EXACT 로 드러났기 때문이다.
🔴🔴 그러므로 「CF-2 로 precision 이 87.5% → 88.2% 올랐다」를 **GO 근거로 쓰지 않는다**
   — 그 +0.7p 는 **분모 16→17 에 SAME 하나가 더해진 산술** 이고 CPO 가 금지한 바로 그 논법이다.
```

---

## 11. 🔴🔴 그리고 **반대 방향 결함**이 커졌다 — 과잉 차단 **5건**

| | 도메인 | modelCode | verdict | CEO |
|---|---|---|---|---|
| C33 | junioredition.com | conflict | CONFLICT | **SAME** |
| C35 | bornyesterdaykids.com | unavailable | CONFLICT | **SAME** |
| S1-7 | **bobochoses.com** | **conflict** | CONFLICT | **SAME** |
| S2-3 | **bobochoses.com** | **conflict** | CONFLICT | **SAME** |
| S2-4 | kids21.com | **conflict** | CONFLICT | **SAME** |

🔴 **브랜드 공식몰(`bobochoses.com`)이 품번 충돌로 EXCLUDED 된다.**
🟢 올바른 차단은 1건이다(S1-5 junioredition · CEO DIFFERENT).
⟹ **CONFLICT 로 막은 것 중 다수가 진짜 동일상품** 이고, 이것이 recall 37.8% 의 최대 덩어리다.

🔴 **이번 WU 에서 손대지 않았다** — `compareModelCode` 는 보호계약이고 CPO 범위 밖이다.
🟡 그러나 **CF-2 보다 훨씬 큰 레버** 로 보인다(1건 vs 5건). 다음 판정 후보로 올린다.

---

## 12. 🔴 `bbambam` 인코딩 — **기록만** (CPO §12)

```
`bbambam.com` 제목이 mojibake 다(EUC-KR 을 UTF-8 로 디코딩 · 「????Ű?????????Դϴ?.」).
🔴 그 2건은 **목록 URL** 이라 GT 에 영향 0 이고, 이번 WU 에서 **수정하지 않았다.**
🔴 같은 인코딩의 «상품» 페이지에서 제목 매칭이 깨지는지는 **미측정** 이다.
```

🔴 **부수 발견 하나 더** — CEO 의 UNCERTAIN 6건은 전부 **404 / 홈페이지**였다.
그런데 우리 fetch 는 `status OK` 로 facts 를 만들었다(제목이 「Kids21 Singapore」·
「trenbe」 같은 **샵 이름**). 🟢 **가격은 전건 `PRICE_UNAVAILABLE`** 이라 가격 집계에는
들어가지 않는다(직접 확인). 🔴 그러나 **후보 목록에는 뜰 수 있다**(WU-010 계열).
🔴 이번 범위가 아니라 **조사하지 않았다.**

---

## 13. Mutation

baseline **11 passed** · 변형마다 원상복구

| | 변형 | 결과 |
|---|---|---|
| V1 | `crossSellerReserved` 우회 | 🔴 **1 failed** |
| V2 | `NO_TITLE_OVERLAP` OBSERVED 분류 제거 | 🟡 **11 passed** |
| V3 | EXACT 게이트에서 색상 축 제거 | 🔴 **3 failed** |
| — | 원상복구 | 🟢 **11 passed** |

🟡 **V2 통과는 가드 공백이 아니다** — 분류표에서 빼도 **blocker 자체는 남고**, 그 효과는
다른 보호층에 가려 **tier 가 안 바뀐다**(WU-065/066 이 「단독 완화 효과 0」으로 이미 측정했다).
🟢 그 변이를 무는 계약은 `wu-065-title-overlap.test.ts` 에 있다(이번 조합에 넣지 않았을 뿐이다).

---

## 14. Regression / Typecheck / Build

```
회귀      apps/admin  **574 files / 8,259 passed** / failed 0 (skipped 95)
typecheck **0 errors**     build **exit 0**
```

🔴 **정직하게 적는다** — 변이 복구 **직후** 같은 커맨드 체인에서 돌린 1회에서
`1 failed` 가 관측됐다. 재실행에서 **574 passed / 0 failed** 였다.
🔴 **어떤 테스트였는지 포착하지 못했다.** 원인 후보는 변이 복원 직후의 모듈 캐시이지만
**단정하지 않는다.** 🔴 「flaky 였다」로도 적지 않는다 — **미규명** 이다.

---

## 15. Production

```
🔴 운영 코드 변경 **0** ⟹ UI 변경 0 ⟹ Production 거동 불변
외부 AI 0 · 결제 ₩0 · Gemini 잔액 ₩3,171 보존
```

---

## 16. 🔴 Known Unknowns

```
① 🔴 CF-2 의 이득이 **여전히 C47 하나** 다 — 표본이 63 으로 늘었는데도 늘지 않았다
② 🔴 UNCERTAIN 7건은 **분모 밖** 이다. 그 7건의 진짜 라벨은 **모른다**
③ 🔴 신규 19건 중 국내(`.kr`)는 **wconcept 1건** 뿐 — 국내 표본은 여전히 얇다
④ 🔴 과잉 차단 5건의 **원인**(왜 공식몰 품번이 conflict 인가)은 **조사하지 않았다**
⑤ 🔴 전체 회귀 1회의 `1 failed` **미규명**
⑥ 🔴 `bbambam` mojibake 의 영향 범위 **미측정**
```

---

## 17. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지
```

## 18. CEO Action — **없음** (운영 코드·UI 변경 0)

---

## 19. 🔴 CPO 판정 요청

| 안건 | 측정 | CTO 권고 |
|---|---|---|
| **CF-2** | SAME 회복 **1** · False SAME 증가 **0** · 파생 135 유입 0 | 🟡 **HOLD** — 기준상 「검토 대상」이지만 **이득 1건** 이다. 🔴 precision +0.7p 를 근거로 쓰지 않는다 |
| 🔴 **과잉 차단 5건** | CONFLICT 차단 중 **5건이 CEO SAME** (올바른 차단 1건) | 🟡 **다음 조사 1순위 권고** — CF-2(1건)보다 **레버가 크다** |
| S1-6 tinyapple **새 False EXACT** | C06 과 같은 클래스·같은 샵 | 🔴 **결함 아님으로 분류 권고**(WU-060 결론과 동일 — 텍스트로 못 막는다) |
| `bbambam` 인코딩 · soft-404 facts | 기록만 함 | 🟡 별 WU |

🟢🟢 **이번 WU 가 확정한 두 문장**:
```
① CF-2 는 **표본을 63 으로 늘려도 이득이 1건** 이다. 「더 큰 GT 면 달라질 것」이라는
   기대는 **데이터로 약해졌다**.
② 🔴 recall 을 막는 가장 큰 덩어리는 `NO_TITLE_OVERLAP` 이나 색상이 아니라
   **품번 충돌(CONFLICT) 과잉 차단 5건** 이다 — 이번에 처음 분모가 생겼다.
```
