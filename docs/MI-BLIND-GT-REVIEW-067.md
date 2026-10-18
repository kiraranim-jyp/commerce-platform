# WU-067 — CEO Blind GT Review 준비 (자료 생성 · 판정 0 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「CTO 는 더 이상 코드/MI 완화 실험을 하지 않는다.
> **CF-2 의 +1 회복이 실제 SAME 인지 사람 라벨로 확인** 하고 국내 가격 비교의
> 마지막 정책 변경 여부를 결정한다.」

---

## 0. 결과 — **리뷰 페이지 준비 완료 · CEO 요청 1회 대기**

```
🟢 블라인드 리뷰 페이지 배포 — 원상품 **6** · 후보 **19건**
🔴 **「CF-2 로 EXACT 가 되는 후보」가 미라벨 풀에 «0건» 이다** (§2) — 그래서
   CPO 가 1순위로 지정한 범주는 **확보하지 못했다.** 대신 더 값있는 것을 찾았다:
🟢🟢 **라벨 없이 현재 EXACT 로 들어가는 후보 4건** — precision 분모를 직접 늘린다
   (WU-066 이 「SAME 분모가 27 에서 멈춰 있다」고 한 한계를 깨는 유일한 경로다)
🔴 운영 코드 변경 **0** · 외부 AI **0** · ₩0 · HTTP 는 읽기 전용 GET **41회**
```

---

## 1. 표본 — 기존 GT 와 겹치지 않는 **미라벨** 후보만

```
출처  `mi-022-gt-worklist.json` **41건** (GT 51 과 교집합 **0**)
🔴 WU-066 의 파생 DIFFERENT 135쌍도 **제외** 했다 — 라벨이 이미 함의돼 있다
운영 owner `factsFromProductUrl` 로 전건 fetch (읽기 전용 GET)
  읽힘 **23** · UNREACHABLE/NO_FACTS **18**
```

## 2. 🔴 CPO 지정 5범주로 분류한 결과

| | 범주 | 건수 |
|---|---|---|
| ① | **CF-2 로 EXACT 가 되는 후보** | 🔴 **0** |
| ② | `NO_TITLE_OVERLAP` 후보 | 10 |
| ③ | 색상 evidence 가 필요한 후보 | 0 |
| ④ | `crossSellerReserved` 가 보호하는 후보 | 1 |
| ⑤ | 경계 사례 | 8 |
| — | 그 외 | 4 |

🔴🔴 **①이 0 인 이유**: 이 풀의 후보는 대부분 `modelCode = unavailable` 이라
CF-2(제목 비차단 + 색상 확인)를 적용해도 식별자 경로가 열리지 않는다.
⟹ **CF-2 의 +1 을 «추가 표본으로» 검증하는 길은 이 풀에 없다.**

🟢🟢 **대신 더 값있는 것이 나왔다 — ⑤ 경계 사례 안의 EXACT 4건**:
```
S1 www.eraldo.com        verdict SAME  → **현재 EXACT**   ← 라벨 없음
S1 cissywears.com        verdict SAME  → **현재 EXACT**   ← 라벨 없음
S1 www.tinyapple.net     verdict SAME  → **현재 EXACT**   ← 라벨 없음
S2 www.thefrontshop.com  verdict SAME  → **현재 EXACT**   ← 라벨 없음
```
🔴 **운영이 지금 EXACT 로 판정하는데 사람 라벨이 없다.** 이 넷이 라벨되면
precision 분모가 12 → 16 이 되고, WU-060 이후 모든 precision 숫자가 **단단해진다**.
🟢 그리고 CONFLICT 로 막은 4건(junioredition · bobochoses × 2 · kids21)도 포함돼
**보호가 옳았는지** 를 동시에 확인한다.

---

## 3. 🔴 품질 점검에서 3건을 **제외** 했다

```
🔴 목록 URL 3건 — 「같은 상품인가」를 물을 수 없다
   beaumonde.co.kr `goods_list.php?page=3&brandCd=…`
   bbambam.com     `product_list.html?type=M` · `?type=X`
⟹ 23 − 3 = **19건** 을 리뷰에 올렸다. (중복 URL 1건도 앞서 제거)
```

🔴🔴 **그리고 부수적으로 결함 하나를 관측했다 — 보고만 한다**:
```
`bbambam.com` 의 제목이 **mojibake** 로 들어온다(「????Ű?????????Դϴ?.」).
EUC-KR 페이지를 UTF-8 로 디코딩한 모양이다.
🔴 이 두 건은 **목록 URL 이라 GT 에 영향이 없다.** 그러나 같은 인코딩을 쓰는
   **다른 한국 샵의 상품 페이지** 에서는 제목 매칭이 통째로 깨질 수 있다.
🔴 **미측정** 이다 — 이번 범위가 아니라 조사하지 않았고 고치지도 않았다.
```

---

## 4. 블라인드 설계 (CPO §1 준수)

```
visible  원상품 제목·URL  ·  후보 제목·도메인·URL
sealed   MI verdict · blockers · modelCode · colorUnverified · tier · CF 결과 · 범주
🟢 `sealed` 를 **HTML 에 넣지 않았다** — 기계 검사로 확인했다(유출 0).
🔴 추천 결론도 적지 않았다. 페이지에 「시스템 판정은 일부러 적지 않았습니다」를 명시했다.
```

🟢 **원상품 단위로 묶었다** — CEO 가 원상품을 한 번 열고 그에 대한 후보를 연달아 보는
것이 실제 작업 흐름이고, 그 그룹화는 **우리 판정을 누설하지 않는다**(원상품은 입력이다).

🟢 진행률·자동저장(`localStorage`)·결과 JSON 복사를 넣었다 — 중간에 닫아도 이어서 할 수 있다.

---

## 5. 구현 결과

```
운영 코드 변경  **0**
신규            wu-067-blind-review-prep.test.ts (자료 생성 · 기본 skip · `WU_067_LIVE=1`)
                fixtures/wu-067-blind-review-set.json (**blind 19건** · sealed 유출 0)
배포            블라인드 리뷰 페이지 (Artifact)
```

🔴 **MI/가격/시장/Registry 를 한 줄도 건드리지 않았다.**

---

## 6~8. Typecheck / Regression / Production

```
typecheck **0** · 리뷰 하니스는 기본 **skip**(LIVE 게이트)
🔴 운영 코드 변경 0 ⟹ Production 거동 불변 · UI 변경 0
외부 AI 0 · 결제 ₩0 · Gemini 잔액 ₩3,171 보존 · HTTP 읽기 전용 GET 41회
```

---

## 9. 🔴 Known Unknowns

```
① 🔴 **CF-2 검증 표본을 늘리지 못했다** — ① 범주가 0건이다. 19건을 라벨해도
   CF-2 의 이득은 여전히 **C47 하나** 일 가능성이 높다
② 🔴 UNREACHABLE **18건** 은 리뷰에서 빠졌다 — 「없다」가 아니라 **읽지 못했다** 다
③ 🔴 `bbambam.com` mojibake 의 **범위가 미측정** 이다(EUC-KR 한국 샵 일반 문제인지)
④ 🔴 19건 중 국내(`.kr`) 도메인은 **wconcept.co.kr 1건** 뿐이다 —
   국내 표본은 여전히 얇다
⑤ 🔴 CEO 라벨이 들어오기 전까지 **어떤 정책 판정도 할 수 없다**
```

---

## 10. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢 (리뷰 페이지)
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(운영 UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        ⚪ 해당 없음
```

---

## 11. 🟡 CEO Action — **1회** (CPO 가 전달)

```
무엇을    원상품 6개에 대한 후보 **19건** 을 보고 **같은 상품인가** 만 판단
어떻게    각 후보의 [후보 페이지 열기] 와 원상품의 [원상품 페이지 열기] 를 열어 비교
선택지    같은 상품 / 다른 상품 / 판단 불가   (셋 중 하나)
기준      같은 상품 = 색상·사이즈 라인까지 같은 그 상품
          다른 상품 = 색상이 다르거나 디자인이 다르거나 아예 다른 상품
          판단 불가 = 페이지가 안 열리거나 사진·정보가 부족하다
소요      **15~25분** (원상품 6개 × 후보 1~9개 · 자동 저장되므로 나눠서 해도 된다)
끝내면    아래 [결과 복사] → CPO 에게 붙여넣기
```

🔴 **코드 승인·MI 정책 승인을 CEO 에게 요구하지 않는다**(CPO §2).
🔴 **시스템 판정을 보여주지 않는다** — 그래서 「우리가 맞았는지」를 묻지 않고
「이 둘이 같은 상품인지」만 묻는다.

---

## 12. 라벨이 들어온 «뒤» 에 할 일 (CTO)

```
① Human GT 51 + 신규 19 = **70건** 으로 Baseline / CF-2 재계산
② 🔴 특히 **현재 EXACT 4건** 의 라벨로 precision 을 다시 낸다(분모 12 → 16)
③ C06 · C08 anchor 유지 확인
④ 🟢 GO 조건(실제 SAME 회복 · False SAME 0 · C06/C08 보호)을 **그때** 판정
⑤ 🔴 GO 라도 `NO_TITLE_OVERLAP` **전체 삭제가 아니다** — 검증된 독립 증거가 있는
   구조에서만 「비교 불가」로 취급하는 **최소 변경** 이다(CPO §4)
```
