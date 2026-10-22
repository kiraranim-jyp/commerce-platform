# ▶ CTO CURRENT HANDOFF — 스마트스토어 상품자동등록

> 🔴🔴 **새 세션은 이 문서만 읽고 바로 시작한다.** 과거 조사/결정을 다시 읽지 않는다.
> 🔴 과거 WU 상세는 **작업 좌표가 아니다** — 막혔을 때만 해당 `HANDOFF-WU-*.md` 를 연다.
> 🔴 이 파일이 **유일한 진입점** 이다(`CLAUDE.md` §12 · 메모리가 여기를 가리킨다).
> 두 번째 진입 문서를 만들지 않는다 — 둘이 되면 서로 다른 말을 하게 된다(실제로 났다).

---

## 1. CURRENT STATE

```
현재 WU     WU-149  (남은 범위 = STEP 1 · 6 · 7)
코드 baseline  f152f927      ← 이 숫자를 보고서의 「변경 전」 으로 쓴다
HEAD           e7b2fe66      ← 그 위의 **문서 전용** 커밋(코드 0)
main        clean · origin 0 / 0 · 배포 Ready
HTTP        /  200   ·  인증 라우트 307(정상)
typecheck   PASS (0)
build       PASS (0)
regression  626 files / 8,734 passed / 0 failed
```

🔴 지시서의 「HEAD: f152f927」은 **코드 baseline** 을 가리킨다 — 작업트리 HEAD 는
`e7b2fe66`(문서 전용)이다. 🟢 코드 기준선은 **같다**(그 사이 코드 변경 0).

**CEO Action: 없음.** 배포 후 실제 상품 UI 최종 테스트가 필요한 시점에만 **1회** 요청한다.

---

## 2. NORTH STAR

이 제품은 **후보 검색 결과를 많이 보여주는 시스템이 아니다.**

```
상품 1개 입력 → 동일상품 후보 탐색 → MI 가 SAME 판정
→ SAME 상품의 판매상태/가격 확보 → 셀러에게 시장가격 판단 근거 제공
```

| ❌ 중요하지 않다 | ✅ 중요하다 |
|---|---|
| 후보가 몇 개인가 | **동일상품 2~3개의 가격** |
| 유사상품이 몇 개인가 | 🇰🇷 국내 **시장 가격대** |
| AI 검색 결과가 몇 개인가 | 🌎 해외 **통화별 최저 확인가** |
| 셀러가 후보를 하나씩 판단 | 가격 없으면 **원본 확인 링크** |

🔴 **SIMILAR · DIFFERENT · UNDECIDED 는 seller surface 에 노출하지 않는다.**
🔴 셀러가 직접 SAME/SIMILAR 를 판단하지 않는다 — MI 가 한다.

---

## 3. MARKET RULE

🔴 국내/해외는 **검색/MI 파이프라인을 분리하지 않는다.** 공통이다:

```
원상품 → 후보 수집 → MI SAME 판정 → 판매상태 → 가격 추출
```

**차이는 «최종 가격 해석» 만이다.**

```
🇰🇷 국내   SAME 0    → 가격대 없음
          SAME 1    → **가격대 확정 불가**(1개를 가격대라고 부르지 않는다)
          SAME 2~3  → **시장 가격대**(최저 ─ 최고)
          🔴 평균 · 추천가격 계산 금지

🌎 해외   같은 통화   → 그 통화의 **최저 확인가**
          여러 통화   → **통화별로 각각** 표시
          🔴 환산 금지 · 🔴 **통화가 다른 숫자를 서로 비교하지 않는다**
```

---

## 4. ABSOLUTE FREEZE

```
MI 판정축 · SAME threshold · discovery algorithm · Registry · adapter ·
price_alerts · DB schema · Gemini/API 비용 구조 · 추천 판매가격 · 마진 계산 ·
통화 환산 · 새 후보 검색 알고리즘 · 새 seller candidate UI · 국내 SAME 판정축 개선
```

🔴🔴 **국내 SAME = 0 을 이번 WU 에서 해결하려 하지 않는다.** 국내 공급은 **별도 WU** 다.
🟢 근거는 측정돼 있다 — 첫 divergence 는 **공급**(AI 답변 URL 국내 6·4 : 해외 30·25)이고
어댑터 게이트는 **국내 0/2 · 해외 3/22** 로 양쪽을 거의 같게 막는다(재조사 금지).

---

## 5. ALREADY DONE — DO NOT REIMPLEMENT

WU-145~148 에서 닫힌 것을 **재구현하면 하나인 것을 둘로 쪼갠다.**

```
Seller Decision      최종 owner **하나**(`seller-decision`)
Price owner          시장가격 숫자를 **여러 영역에서 중복 표시하지 않는다**
Price interpretation 🇰🇷 market price band · 🌎 lowest confirmed price ·
                     mixed currency → 통화별 · conversion 0 · recommendation 0
MI blocker           1차 **건수만** · 사유는 `▸ MI 상세 분석`(2차) — 삭제가 아니라 이동
후보 접힘             모든 후보 구역이 `candidate-fold`(기본 접힘 · `open` 금지)
```

### SAME_PRICE_CAP = 3 — 🔴 **가격 «계산» 에만** 적용

```
🔴 SAME **건수를 3개로 잘라 숨기지 않는다** — 아래는 그대로 표시한다:
     동일상품 확인 5곳 · 가격 확인 5곳
🟢 가격 계산에 쓰는 데이터만 **통화별 최대 3개** 다 — GBP 3 · USD 3 · EUR 3 …
🔴🔴 **전역으로 3개를 잘라 통화를 섞으면 안 된다**(GBP 37 < USD 58 ? = 환산 없는 비교)
   ⟹ 그러면 한 통화 축이 통째로 떨어져 **「최저 확인가」가 거짓** 이 된다
🟢 목적 하나 — **각 통화의 최저 확인가를 잃지 않는다**
```

🟢 관련 계약·변이는 **이미 추가·검증** 됐고 전체 회귀 PASS 다(`wu-148-market-price-signal` D).

---

## 6. NEXT WORK — ONLY THIS

> **STEP 1 → STEP 6 → STEP 7.** 그 외는 하지 않는다.

### STEP 1 — seller surface 에서 **legacy candidate research UI 제거**

좌표는 **이미 조사돼 있다**(`docs/HANDOFF-WU-149.md` §STEP 1 · **재조사 금지**).

```
제거 대상(seller 에게 보이는 연구 UI)
  CommerceWorkspace.tsx:3884  <DomesticShopSearch …/>
  CommerceWorkspace.tsx:3900  <ComparisonShopSearch …/>
  그에 딸린 `marketEvidence` wiring · seller-facing candidate research panels
```

🔴🔴 **절대 하지 않을 것 — 내부 candidate pipeline 을 삭제하지 않는다**:
```
candidate collection · MI · candidate data · review/history · price extraction
그리고 backend API 둘(`/api/domestic-price-sources/search` · `/api/comparison/search`)
⟹ 🟢 **엔진은 보존하고, 셀러에게 연구 로그를 보여주는 UI 만 제거한다**
```

🔴 **범위 주의 — `DomesticPriceIntelligencePanel` 을 «통째로» 지우지 않는다.**
그 패널이 `▸ 판단 근거` 접힘 · 📚 검토 이력 · **후보 검토 저장 경로**(WU-131/141-R1)를
들고 있다. ⟹ 🟢 제거 대상은 그 **안의 research 구역과 위 두 패널** 이고, 패널의
review/history/MI 배선은 **보존** 한다(§6 의 「review/history 는 손대지 않는다」와 일치).

### STEP 6/7 — SELLER SURFACE RULE

셀러에게 남는 것은 **하나의 최종 판단 영역** 이다:

```
📊 시장 판매 판단
 ↓ 🇰🇷 국내 동일상품 가격대
 ↓ 🌎 해외 동일상품 최저 확인가
 ↓ 판매상태
 ↓ 가격 근거(없으면 🔗 원본 링크)
```

🔴 **숨긴다**: SIMILAR · DIFFERENT · UNDECIDED · 유사상품 목록 · 후보 수를 강조하는
연구 UI · 「후보 24건 / 25건」류 legacy 목록 · 자동검색 후보 목록 · 이전 확인 후보 목록 ·
후보별 판단 과정 · 셀러가 직접 후보를 판정해야 하는 UI.

### STEP 6 — 가격 owner 는 **하나** 다

```
Seller Decision
  └─ Market Price Evidence        ← 가격 숫자의 **유일한** owner
🔴 같은 정보를 보여주는 **별도 「시장가격 비교」 영역** 이 남아 있으면 제거한다
🔴 두 번째 가격 판단 영역을 **새로 만들지 않는다**
```

### 🔴 가격이 **없는** SAME 후보 — 지우지 않는다

```
🟢 SAME 판정은 **유지** 한다 — 가격이 없다는 이유로 후보를 버리지 않는다
🟢 그 자리에 🔗 **원본 상품 확인** 링크를 준다
⟹ SAME + 판매상태 + (가격 있으면 가격 / 없으면 원본 링크)
```

---

## 7. EARLY STOP 범위

🔴 이번 WU 에서 **collection orchestration 순차화를 하지 않는다.**

```
❌ 후보 수집 → SAME 3개 발견 → 나머지 수집 중단   (구조 개편 · 하지 않는다)
🟢 적용된 최소 변경 — 가격 판단/표시에 쓰는 SAME 을 **통화별 최대 3개** 로 제한
🟢 수집 파이프라인은 **유지** 한다
```

---

## 8. IMPLEMENTATION ORDER — 코드 변경 후 중단하지 않는다

```
1  HANDOFF 좌표 확인(docs/HANDOFF-WU-149.md §STEP 1)
2  §4 freeze 재확인
3  legacy seller candidate UI 제거
4  내부 candidate pipeline 보존 확인
5  SIMILAR/DIFFERENT/UNDECIDED seller 노출 제거
6  Seller Decision 단일 가격 owner 확인 · 중복 가격 영역 제거
7  영향 계약 업데이트(방향을 뒤집어 다시 쓴다 · 삭제로 우회 금지)
8  **targeted tests**        ← 🔴 전체 회귀보다 먼저
9  **mutation test** M1~M7
10 **2-product E2E** (B226AC009 · B226AC010)
11 **full regression**   12 typecheck   13 build
14 deploy                15 production check   16 최종 보고 1회
```

🔴 순서를 뒤집지 않는다 — targeted → mutation → E2E → full regression → typecheck → build.
전체 회귀를 먼저 돌리면 **내 계약이 틀렸는지, 기존 계약이 깨졌는지** 를 가를 수 없다.

---

## 9. CONTRACT / SAFETY — 이 숫자를 **다시 조사하지 않는다**

```
handleRequestPriceReview     9 refs
marketEvidence               7 refs
PRICE_COMPARISON_ANCHOR_ID   4 refs   🔴 WU-141-R3 **보존 계약** — 지우지 않는다
관련 운영 파일                6
영향 계약                    5  (wu-056r1 · mi-022 · wu-130 F-3 ·
                                 예상: product-tab-first-screen · mi-ux-final)
```

🔴 계약 다섯은 **그 구역의 «존재» 를 글자로 단언** 한다 ⟹ 제거하면 **「없다」로 방향을
뒤집어** 다시 써야 한다. 🔴 약화가 아니다 — 「seller 화면에 없다」 **그리고**
「backend/API·review 경로는 **살아 있다**」를 **같이** 단언한다.
🔴🔴 **계약을 지워서 테스트를 통과시키지 않는다.** 계약의 «목적» 을 현재 구조에 맞춘다.

### MUTATION — M1~M7 · 전부 **FAIL 해야** 한다 (실행 후 바이트 복구)

```
M1  legacy candidate UI 를 seller surface 에 되살린다            → FAIL
M2  SIMILAR / DIFFERENT / UNDECIDED 를 seller 기본 화면에 노출   → FAIL
M3  Seller Decision 밖에 **두 번째 가격 owner** 를 만든다        → FAIL
M4  통화별 상한을 **전역 상한** 으로 바꾼다                       → FAIL
M5  **SAME 건수** 를 가격 상한 때문에 3개로 잘라 숨긴다           → FAIL
M6  `PRICE_COMPARISON_ANCHOR_ID` 앵커 div 를 지운다              → FAIL  (보존 계약)
M7  backend API 둘을 지운다                                      → FAIL  (엔진 보존)
```

🔴 M4·M5 계약은 **이미 있다**(`wu-148-market-price-signal` D) — **재구현하지 말고 재사용** 한다.

### 2-PRODUCT E2E — 무엇을 보는가

```
A  SAME 있음        → 판매상태 → 가격 → Seller Decision 한 줄까지
B  SAME 부족/가격 없음 → 「가격대 확정 불가」 **또는** 🔗 원본 확인 링크
+  mixed currency 가 있으면 **USD 와 GBP 가 섞이지 않고 각각 유지** 되는지
```

### ACCEPTANCE — 셀러 화면이 이걸 전부 만족해야 PASS

```
Seller Decision 이 최상위 판단 영역 · 판단 근거는 **동일상품만** ·
SIMILAR/DIFFERENT/UNDECIDED **없음** · 후보 연구 목록 **없음** ·
중복 시장가격 영역 **없음** · 가격 owner **하나** ·
🇰🇷 2개 이상에서만 «가격대» · 🇰🇷 1개는 「참고」(가격대 아님) ·
🌎 통화별 최저 확인가 · 환산 **없음** · 추천가 **없음** · 마진 **없음** ·
가격 없는 SAME 에 원본 링크 **가능** · 🔴 SAME **건수는 상한 때문에 숨지 않는다**
```

---

## 10. STOP RULE

**아래일 때만** 안전 종료한다:
```
코드 변경 «전» 예상치 못한 구조적 위험 발견 · production destructive action 필요 ·
business/security policy 승인 필요 · 기존 freeze 를 깨야만 해결 가능
```
🔴 그 외에는 **코드 변경 → 검증 → 배포까지 계속 진행한다.**
🔴🔴 **「코드 변경 후 세션이 부족할 것 같다」를 이유로 중간 중단하지 않는다** —
**작업 시작 전에 범위를 잡고 끝까지 닫는다.**

---

## 11. DEPLOY → PRODUCTION CHECK

```
배포 후 확인  /  ·  인증 redirect  ·  Seller Decision route  ·  상품 상세/판단 화면
🔴 그리고 Production 에서 **legacy candidate UI 가 실제로 사라졌는지** 확인한다
🔴 「Deployment successful」만 적지 않는다(§9 헌장) · 🔴 401/307 을 route 증거로 쓰지 않는다
```

---

## 12. REPORT RULE — 중간 보고 없음 · 최종 1회

```
[WU-149 STEP 1/6/7 완료]

HEAD:
변경 파일:
제거한 seller UI:
보존한 internal pipeline:

계약:          mutation:      E2E:
Regression:    Typecheck:     Build:

Deploy:        Production check:

국내 SAME:     해외 SAME:

CEO Action:
```

---

## 13. CEO RULE

CEO 는 코드·계약·commit 을 검토하지 않는다. **배포 전에는 아무것도 요청하지 않는다.**
배포가 끝난 뒤 **최종 테스트 1회** 만 요청하고, 그때 형식은 **넷** 이다:

```
테스트 URL:      테스트 상품:      테스트 순서:      예상 결과:
```

🔴🔴 **작업 중 아래를 묻지 않는다 — 전부 이미 결정된 범위다**:
```
「legacy UI 를 제거할까요?」      「flag 로 숨길까요?」
「A/B 중 어떤 방식이?」          「국내 SAME 문제도 같이 고칠까요?」
「Registry 를 늘릴까요?」        「adapter 를 추가할까요?」
「Gemini 를 다시 켤까요?」       「early stop 을 진짜 구현할까요?」
「CEO 가 중간 테스트해볼까요?」  「계약을 어떻게 바꿀까요?」
```

---

## 14. SESSION START

```
CURRENT   WU-149 · 코드 baseline f152f927 · clean/deployed
NEXT      STEP 1 → STEP 6 → STEP 7

DO NOT REINVESTIGATE
  WU-130~148 closed decisions · MI architecture ·
  domestic/overseas pipeline architecture · SAME threshold ·
  Registry/adapter · price interpretation · SAME_PRICE_CAP

DO NOW
  legacy seller candidate UI 제거
  → contracts → mutation → E2E → regression → typecheck → build → deploy

CEO
  배포 전 요청 금지 · 최종 테스트 1회만
```

## 15. 실행 명령 (복붙)

```bash
# 회귀 — 🔴 출력을 파일로 받는다(실패 이름을 놓치지 않기 위해)
cd apps/admin && npx vitest run > /tmp/reg.txt 2>&1; grep -nE "FAIL |AssertionError" /tmp/reg.txt

# typecheck · build — 🔴 grep 종료코드를 tsc 의 것으로 읽지 않는다(파일로 받는다)
cd .. && npx tsc -p apps/admin/tsconfig.json --noEmit
cd apps/admin && npm run build

# 배포 확인
npx vercel ls --yes | grep -A1 "Age "
```

🔴 **변이는 `python3` 없이 `Edit` 로만** 한다(이 환경에 python3 이 없어 「적용 실패」가
「통과」로 읽힌 적이 있다 · 적용 여부를 `grep -c` 로 확인한다).
🔴 **미커밋 구현을 `git checkout` 으로 되돌리지 않는다** — 백업 복사 후 **바이트 대조** 로 확인한다.
🔴 소스 문자열 검사는 **주석을 벗기고** 한다. 🔴 화면은 **마운트한 DOM** 으로만 완료 선언한다.

---

## 16. 완료 정의 — 이 **19개가 전부 체크될 때만** WU-149 를 닫는다

```
[ ] legacy seller candidate UI 제거        [ ] internal candidate pipeline 보존
[ ] SIMILAR/DIFFERENT/UNDECIDED 노출 제거  [ ] Seller Decision 단일 가격 owner
[ ] 중복 market price UI 제거              [ ] SAME_PRICE_CAP 기존 구현 유지
[ ] 통화별 상한 유지                        [ ] SAME 건수 불변
[ ] 🇰🇷 가격대 규칙 유지                     [ ] 🌎 최저 확인가 규칙 유지
[ ] 환산 없음                              [ ] 추천가 없음
[ ] 계약 업데이트(우회 아님)                [ ] mutation M1~M7 PASS
[ ] 2-product E2E PASS                    [ ] full regression PASS
[ ] typecheck PASS                        [ ] build PASS
[ ] deploy 완료 + production 확인 완료
```

🔴 **성공 기준은 「후보를 더 많이 보여주는 것」이 아니다** — 셀러가 후보를 다시
판단하지 않고도 **SAME 상품의 가격 근거만으로** 시장가격을 판단할 수 있는
**단일 Seller Decision 화면** 으로 정리되는 것이다.

---

## FINAL PRINCIPLE

> 인수인계 문서는 **역사를 전달하는 문서가 아니다.** 새 세션이
> 「지금 어디까지 됐고 → 무엇을 하면 되고 → 무엇을 건드리면 안 되는가」를
> **1~2분 안에** 파악하고 바로 작업하기 위한 **좌표** 다.

🔴 **후보를 많이 보여주는 것이 목적이 아니다.** 동일상품을 정확히 찾아
**2~3개의 가격 근거** 로 셀러가 시장가격을 판단할 수 있게 하는 것이 목적이다.
