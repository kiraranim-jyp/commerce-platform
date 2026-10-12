# MI MVP 실상품 E2E 검증 WU

> 🟢 **종료.** 판정 — **MVP E2E PARTIAL** (공통 구조는 돌고, 끊기는 자리는 **후보 확보**).
> 🔴 **코드 변경 0 · DB 쓰기 0 · 배포 0.** HTTP 와 SELECT 만 썼다.
> 🔴 실상품 **9개** 를 운영 owner 로 실제 통과시켰다(아동의류 5 · 테니스 4).

---

## 1. 🔴🔴 지시서 흐름과 «운영 경로» 의 차이 (먼저 적는다)

```
지시서  URL → **Google/Naver 후보 검색** → MI 검증 → 가격 → GO/STOP
🔴 Google/Naver 후보 검색은 **운영 호출부가 없다**(선행 WU 2개가 전수 확정).
   discovery-benchmark 는 실험 모듈이고 운영 가격/판정 경로가 import 하지 않는다.
🟢 운영에 실재하는 후보 경로는 **국내 편집샵 검색** 하나다 —
   searchDomesticShops → withConfidence → judgeDomesticCandidate
→ 🔴 그래서 ②를 **FAIL 이 아니라 「NO_PRODUCTION_PATH」** 로 적었다.
   없는 기능의 실패가 아니다.
```

🔴 **GO/STOP 은 리포에 없는 말이다.** 운영 어휘는
`SellerFacingVerdictCode(RECOMMENDED|CONDITIONAL|NOT_RECOMMENDED)` ·
`PriceDecisionVerdict(MAINTAIN|CONSIDER_LOWER|MARGIN_RISK)` 다. 이 문서의 GO/STOP 은
**지시서 어휘를 쓴 파생 표기** 이고 새 판정을 만든 것이 아니다.

---

## 2. 🟢 실효 탐색 대상 — 샵 **7개** (실측)

```
전수 34 → isBatchSurveyTarget 통과 19 → 그중 AUTO_* **7**
  CHOCO.EL · LOOXLOO · RULII · 포레포레 · DEUXBEBE · LITTLE LUNA  (scope KIDS_FASHION)
  스카이스포츠                                                     (scope TENNIS)
🔴 Bobo Choses Korea(공식)는 workspace 설정 OFF 라 빠진다(선행 WU 확정)
```

---

## 3. 결과표 (지시서 §5 형식 · 실상품 9개)

| 상품 | Discovery(국내) | Identity | 가격정보 | 국내매칭 | GO/STOP | 문제 |
|---|---|---|---|---|---|---|
| 아동 A `B226AB069` Pixel Abduction jogging pants | 🔴 후보 **0** | 측정불가 | 🟢 EUR 47 | 없음 | **STOP** | 후보 0 |
| 아동 B `B226AC002` Boo Bo Choses T-shirt | 🟢 후보 **6** | 🔴 high 이상 **0** | 🟢 EUR 37 | 없음 | **STOP** | 후보는 있는데 high 미달 |
| 아동 C `B226AC018` All About Monsters T-shirt | 🟢 후보 **5** | 🔴 high 이상 **0** | 🟢 EUR 45 | 없음 | **STOP** | 같음 |
| 아동 D Smallable / Bobo Washed T-shirt | 🟢 후보 **10** | 🔴 high 이상 **0** | 🟢 EUR 45 | 없음 | **STOP** | 같음 |
| 아동 E Smallable / Louise Misha Astrid Jacket | 🟢 후보 **17** | 🔴 high 이상 **0** | 🟢 EUR 89 | 없음 | **STOP** | 같음 |
| 테니스 F Damarindo Pique Polo | 🔴 후보 **0** | 측정불가 | 🟢 USD 53.97 | 없음 | **STOP** | 후보 0 |
| 테니스 G Fall Cericho T-Shirt | 🔴 후보 **0** | 측정불가 | 🟢 USD 54 | 없음 | **STOP** | 후보 0 |
| 테니스 H Fall Fico Full Zip Jacket | 🔴 후보 **0** | 측정불가 | 🟢 USD 150 | 없음 | **STOP** | 후보 0 |
| 테니스 I Fall Giocare T-Shirt | 🔴 후보 **0** | 측정불가 | 🟢 USD 48 | 없음 | **STOP** | 후보 0 |

### 단계별 집계

```
① 원본 정보 수집          **9/9 PASS**  🟢 브랜드·가격·통화·색상이 실제로 있다
② Google/Naver 후보 검색   9/9 NO_PRODUCTION_PATH   🔴 FAIL 이 아니다
③ 국내 후보 탐색(실제 호출) **4 PASS** / 5 측정불가(후보 0)
④ Identity                 9/9 측정불가 — 🔴 high 이상 후보가 **0** 이라 판정 단계에
                           도달하지 못했다. 「오판」이 아니라 **미도달** 이다
⑤ 가격·통화               **9/9 PASS**  🟢 전부 원본 통화(EUR/USD) — KRW 오염 0
⑥ GO/STOP                 9/9 **STOP**  🔴 데이터가 없는데 GO 로 추정하지 않았다
```

🟢 **오류샵 0/7 × 9상품 = 검색 자체는 63회 전부 정상 응답했다**(timeout·차단 0).

---

## 4. 실패 목록 (지시서 §5 형식)

```
[상품]      테니스 4건 (Sergio Tacchini 전부)
[실패 단계]  ③ 국내 후보 탐색
[실제 결과]  후보 0 · 오류샵 0
[기대 결과]  동일/유사 후보 ≥1
[원인]      🟢 **제품 결함이 아니다.** TENNIS scope 샵이 «스카이스포츠 1곳» 뿐이고,
            선행 WU 가 그 샵의 브랜드 교집합을 **0** 으로 실측했다(테니스 전문점이
            Sergio Tacchini 를 취급하지 않는다). 🔴 즉 **국내 취급처 부재** 다.
[수정 필요]  🔴 **아니다.** 검색 threshold 를 낮추면 오탐만 늘어난다(지시서 §4-① 금지).
            필요한 것은 테니스 카테고리의 **국내 판매처 조사** 이고 그건 별 WU 다.

[상품]      아동의류 4건 (후보는 나왔다)
[실패 단계]  ④ Identity — high 이상 후보 0
[실제 결과]  후보 5~17개가 나왔으나 matchLevel 이 전부 medium 이하
[기대 결과]  동일상품이면 very_high/high
[원인]      🔴 **미규명.** 후보 제목을 이 WU 에서 열어보지 않았다. 선행 WU 실측
            (품번 축이 양쪽 다 null · littleluna 만 상품명에 품번을 적는다)과
            정합하지만 **이 9건으로 확인한 것은 아니다.**
[수정 필요]  🔴 **판단 보류.** 원인 미규명 상태에서 코드를 고치지 않는다.

[상품]      아동 A (B226AB069)
[실패 단계]  ③ 후보 0 — 🔴 같은 브랜드 B226AC002/AC018 은 후보가 나왔는데 이것만 0
[원인]      🔴 **미규명.** 검색어가 품번 단독("B226AB069")이었다. AC002/AC018 도
            품번 단독이었고 그쪽은 나왔다 → 검색어 형태 문제가 아니다.
[수정 필요]  🔴 조사 필요. 이 1건은 별 과제.
```

---

## 5. 🔴 내 하니스가 세 번 틀렸다 (전부 보고 전에 고쳤다)

```
① `buildCrossSellerSearchQueries` 를 @commerce/crawler 에서 받으려 했다
   → owner 는 **@commerce/shared** 다
② `productFactsFromIdentityDna` 도 같은 실수를 **또** 했다
   → 역시 **@commerce/shared** 다
   🔴 grep 으로 「배럴 노출」을 추측한 것이 원인이다. 🟢 정답은
      **운영 코드의 import 블록**(run-domestic-price-check.ts:1-22)을 베끼는 것이다
③ 🔴🔴 `listDomesticPriceSources` 를 불러 **샵 0개** 를 받았다
   원인: `getSupabaseAdmin()` 이 `SUPABASE_SERVICE_ROLE_KEY` 를 요구하고 그 값은
         로컬에 없다(헌장 §10) → 조용히 `null` → `return []`
   🔴 그대로 두면 **「후보 0 = 검색 실패」라는 완전히 틀린 결론**이 나왔다.
      실제로 첫 실행에서 9/9 가 FAIL 로 찍혔다.
   🟢 같은 머지(카탈로그 + workspace 설정 · 없으면 ON)를 DB 에서 재현해 덤프했다 —
      **로직이 아니라 데이터 출처만** 바꿨다.
```

---

## 6. 판정 — **MVP E2E PARTIAL**

지시서 §6 의 기준으로 읽는다.

```
🟢 공통 구조는 돈다 — ①원본정보 9/9 · ③검색 호출 63/63 정상응답 · ⑤가격·통화 9/9
🟢 그리고 **원본 통화가 오염되지 않았다**(EUR/USD 그대로 · KRW 둔갑 0).
   지시서가 경고한 Smallable JP→EUR 문제는 이 9건에서 재현되지 않았다
🔴 끊기는 자리는 **후보 확보** 다 — 5/9 는 후보 0, 4/9 는 후보는 있으나 high 미달
🟢 지시서 §6 대로 — 테니스 4건의 실패는 **해당 카테고리의 국내 판매처 부재** 이고
   공통 구조가 깨진 것이 아니다 → **전체 MVP FAIL 로 판정하지 않는다**
🔴 GO 는 **0/9** 다. 데이터가 없는데 GO 로 추정하지 않았다(§4-④)
```

### 🔴 이번에 «수정하지 않은» 이유 (지시서 §7)

```
지시서는 「실패가 확인된 경우에만 최소 수정」이다. 그런데 —
🟢 테니스 4건: 원인이 **국내 취급처 부재** 로 규명됐다 → 코드로 고칠 것이 없다
🔴 아동 4건(high 미달) · 아동 A(후보 0): 원인이 **미규명** 이다
   → 🔴 원인을 모르는 상태에서 고치면 threshold 완화가 되고, 그것은 지시서 §4-①
      (Precision 우선 · 억지 매칭 금지)이 **명시적으로 금지** 한 것이다
→ 그래서 **코드 변경 0** 으로 닫는다. 배포도 없다 → CEO 테스트 요청도 없다.
```

---

## 7. Known Unknowns

```
🔴 아동 4건의 「high 이상 0」 원인 미규명 — 후보 제목을 열어보지 않았다
🔴 아동 A(B226AB069)만 후보 0 인 이유 미규명
🔴 sample N=9. 🔴 아동의류 5 · 테니스 4 — 카테고리별로는 더 작다. 일반화 금지
🔴 ④ Identity 는 **미도달** 이라 SAME/SIMILAR/DIFFERENT 분포를 측정하지 못했다.
   「Identity 가 정확한가」는 이 9건으로 답할 수 없다
🔴 옵션별 가격차 · availability 는 이 경로에서 수집되지 않아 미측정
🔴 Google/Naver 축은 운영 호출부가 없어 **측정 자체가 불가능**(0% 가 아니다)
🔴 실제 서비스 UI 로는 돌리지 않았다 — 인증 경로가 CTO 에게 막혀 있다
   (선행 메모 production-payload-is-unreachable). 운영 owner 직접 호출로 대체했다
```
