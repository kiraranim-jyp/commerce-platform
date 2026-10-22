# ▶ START HERE — 이 파일 **하나만** 읽고 바로 실행한다

> 🔴🔴 **새 페이지/새 세션은 이 10절만 읽는다.** 과거 WU 전체를 다시 읽지 않는다.
> 🔴 `CLAUDE.md` §12 의 WU 기록은 **막혔을 때만** 펼친다(종료된 결론 모음이다).
> 갱신 2026-10-22 · main `85e841c2` 계열 · 회귀 **8,717 passed · 0 failed** · tsc 0 · build 0

---

## 1. Product North Star (고정)

> **상품 URL → MI 가 동일상품/판매상태/가격을 조사 → 셀러에게 «판매 판단» 으로 압축.**

```
🔴 이 제품은 **「셀러에게 후보를 많이 보여주는 AI 조사 도구」가 아니다.**
🟢 의사결정 도구다 — 화면이 답하는 순서는 **판매 판단 → 동일상품 → 판매중 → 기준가격** 이다.
🟢 제품 가치 = 「많은 후보를 MI 가 **대신 조사해서** 셀러에게 **하나의 판단으로 압축**」.
🔴 등록 자동화보다 **MI 정확도** 가 먼저다 · **Recall 보다 Precision** 이 먼저다.
```

---

## 2. 역할 (CPO / CTO / CEO)

```
CPO  작업 범위 · 우선순위 · 작업지시 · **중간 선택지 판단** · 회귀/검증 기준
CTO  조사 → 원인 확정 → 구현 → 테스트 → E2E → 배포 → **보고 1회**  (중간 보고 금지)
CEO  **배포된 따져 화면** 1회 확인 · 정상/비정상 피드백 · 필요할 때 육안 GT
```

🔴 **CTO 가 하지 않는 것** — ⒜ 「⒜⒝⒞ 중 무엇을 열까요」를 **CEO** 에게 묻기(CPO 에게 올린다)
⒝ WU 를 중간에 끊고 승인 받기 ⒞ CEO 가 이미 준 피드백을 다시 묻기 ⒟ 묶음마다 CEO Action 만들기.
🔴 CEO 에게 **원인을 찾게 하지 않는다** — NO 면 CTO 가 화면 문제를 다시 조사한다.

---

## 3. Current Strategy

```
✅ 한다                              ❌ 하지 않는다
MI 정확도 유지                        후보 많이 찾기
동일상품«만» 가격판단에 사용            셀러가 후보 하나씩 검토
판매중 여부 표시                      MI 내부 로직을 셀러에게 떠넘기기
가격 있으면 기준가격 제공               SAME threshold 완화
가격 없으면 **링크** 로 확인 가능        가격 없는데 추정해서 표시
국내/해외를 **한 곳** 에서 비교         국내 SAME 0 을 「국내 상품 없음」으로 단정
셀러가 **첫 화면에서 결론** 을 이해      등록 기능 확장
상세 후보/MI 근거는 **열 때만**         새 UI 영역 계속 추가
```

🔴 **순서** — MI → 가격비교 → 매칭 → 카테고리 일반화 → 커머스 확장.
카테고리 확장은 **MI 정확도 + 실제 상품 검증 이후** 이고 채널 확장은 **마지막** 이다.

---

## 4. Current Production State

```
main 85e841c2 · Production 배포 Ready · `/` 200 · 인증 라우트 307(정상)
🟢 셀러 결론 화면(`📊 시장 판매 판단`) — WU-140·141-R3·144·145·146 으로 완성
   1차  🇰🇷/🌎 블록(동일상품·판매중·가격·확인필요 수 + 기준가격) → **💡 판매 판단**(결론)
   2차  ▸ MI 상세 분석(보류 사유 분포 · 참고가격 블록)
   3차  ▸ 판단 근거(후보 상세 · 📚 과거 확인 후보 — **각 구역도 접힘**)
🟢 🌎 해외   SAME → 판매상태 → 가격까지 **작동한다**(S1 CAD 64·GBP 37·USD 58 / S2 USD 58)
🔴 🇰🇷 국내   MI 최종 SAME **0** — **정상 상태다**(아래 §8). 완화로 열지 않는다
```

---

## 5. Frozen / Prohibited

🔴🔴 **MI core frozen.** 아래는 **조사도 수정도 하지 않는다**(CPO STEP 0):

```
MI threshold · SAME_MIN_AXES · MODEL_CODE · AUDIENCE_LINE · NO_TITLE_OVERLAP ·
BRAND_UNCONFIRMED · BRAND_MISMATCH · SHOP_GATE · SHOP_REP · GARMENT_FORM ·
Registry · price_alerts · MI CASE 계산 · 가격 계산 로직 · DB schema ·
candidate_reviews schema · 외부 AI/API · 등록 로직 · 신규 카테고리 · 신규 채널 ·
새로운 가격 비교 영역
```

🔴 **그리고 이것들도 금지** — 국내 SAME 0 을 풀려고 threshold 낮추기 · 품번→brand 자동 확정 ·
BABY/CHILD 규칙 재설계 · 가격 추정 · 환율로 임의 기준가 생성 · **추천 판매가격 계산** ·
후보를 더 많이 보여주기 · 여성/액세서리/홈 카테고리 확장.

🔴 **MI 결과가 기대와 다르면 먼저 가른다** — 「**표현/배선** 문제인가 **실제 MI** 문제인가」.
MI 문제면 **별도 WU** 다. 이번 WU 에서 **몰래 고치지 않는다.**

---

## 6. Current WU

🟡 **없다 — CEO 화면 확인 1회 대기.** CTO 가 할 코드 작업이 **없다.**
🔴 다음 범위는 **CPO 가 지정한다.** CTO 가 선제적으로 WU 를 만들지 않는다.

```
🟢 WU-146 `Seller Decision 완성` — 구현·배포 완료(전문 `docs/HANDOFF-WU-146.md`)
   ② 「💡 판매 판단」이 **상태별 결론** 이 됐다(가격 유무 · 통화 수 · 국내 0 을 가른다)
   ⟹ 그 전까지는 상태와 무관하게 **같은 한 줄** 이라 결론이 아니라 **안내문** 이었다
   🟢 절대조건 7 + Q1~Q7 을 계약 **24건** 으로 잠갔다 · 변이 **N1~N7 전부 FAIL → 복구**
```

🟡 **CEO Action — 딱 1회** · `/pipeline → 상품 분석 → 📊 시장 판매 판단` (B226AC009 / B226AC010)
> **「후보를 하나씩 조사하지 않고도, 이 상품을 국내에서 팔지 말지와 어느 정도 가격을
> 기준으로 봐야 할지 판단할 수 있는가?」**

```
YES → Seller Decision UX **1차 완료**       NO → **CTO 가** 화면 문제를 다시 조사한다
🟡 정상인데 FAIL 로 보이기 쉬운 것 **넷**
  ① 🇰🇷 「동일상품 확인 0곳」은 **정상** 이다 — 시장 부재가 아니다(§8)
  ② MI 사유(브랜드 미확인/품번 충돌)가 1차에 **없는 것이 목적** 이다 — `▸ MI 상세 분석` 안에 있다
  ③ 「가격 확인 필요 + 🔗」는 가격을 못 읽은 동일상품을 **버리지 않는 것** 이다
  ④ 후보 목록이 **안 보이는 것** 이 정상이다 — `▸ 판단 근거` 안에 그대로 있다
```

---

## 7. Known Closed Decisions (다시 묻지 않는다)

```
🟢 어휘      셀러 가격의 말은 **「동일상품 확인 가격」** 하나(「시장 참고가격」 금지 ·
            그 말은 2차 참고 축이 **다른 뜻** 으로 쓴다 · `wu-056r1` 이 잠금)
🟢 국내 0    1차는 「동일상품 확인 0곳」까지 · 해외는 **확인된 사실만** ·
            해외에 **가격이 있을 때만** 「해외를 기준으로 참고」를 쓴다
🟢 blocker   1차 **건수만** · 사유 분포는 **2차**(삭제가 아니라 이동)
🟢 결론      「💡 판매 판단」 **owner 하나** · 상태별 문장 · 🔴 추천 판매가 **계산 0**
🟢 후보      evidence layer 다(주인공이 아니다) · **기본 접힘** · 출처 축 보존(WU-130)
🔴 MI recall WU-143 이 네 레버(C1~C4) 전부 측정 후 **전부 되돌렸다** — 다시 열지 않는다
            C1 AUDIENCE_LINE 비차단 = false SAME **13건** · C2 CPO 금지 ·
            C3/C4 는 precision·`price_alerts` 계약 충돌(HOLD)
🔴 8축       완화 = Human DIFFERENT 동반 개방이 **열 번** 측정됐다(WU-063~080 · CLOSED)
```

🔴 **「내 표본에서 leak 0」을 GO 근거로 쓰지 않는다** — 2상품 GT 만 보면 넷 다 GO 였고
**전체 회귀가 넷 다 막았다**(표본이 작아서 안전해 보였을 뿐이다).

---

## 8. Known Unknowns (0% 로 적지 않는다)

```
🔴 🇰🇷 국내 SAME 0  원인 **확정됨** · 완화 **REJECT**(WU-138)
   biskuit.kr    BRAND_MISMATCH + NO_TITLE_OVERLAP  ⟹ **A MI 축** · 레버 없음
   beaumonde     BRAND_UNCONFIRMED · **가격 없음** → market UNKNOWN ⟹ A + B 가격 축
   🔴 여는 조건은 **국내 human GT 추가** 다(현재 분모 **2**) — threshold 가 아니다
🔴 Production 실화면  **CTO 가 볼 수 없다**(로그인 뒤) ⟹ 화면 축은 **마운트 DOM** 이다.
   「Production UI PASS」로 적지 않는다 — **CEO 확인 1회로만** 닫힌다
🔴 표본            원상품 **2개**(S1/S2) · 그 산출은 WU-142/143 실측값이다
🔴 `m.luxboy.com`  후보 생성이 실행 간 **O ↔ X** 로 갈린다(원인 미규명 · 차단은 유지)
🟡 `PRICE_COMPARISON_ANCHOR_ID`  R3 이후 **호출자를 잃었다**(CPO 판정 대기 · 지우지 말 것)
```

---

## 9. CEO Action Rule

🔴 **CTO 가 아래 **전부** PASS 한 뒤에만** CEO 에게 넘긴다:

```
contract PASS · mutation PASS · regression PASS · typecheck PASS ·
build PASS · deploy PASS · production route PASS
```

🔴 그때 CEO 에게 주는 것은 **두 상품과 한 URL, 질문 하나** 다(§6). 중간 확인 요청 **금지**.
🔴 CEO 에게 **원인 조사를 넘기지 않는다.**

---

## 10. Next WU

🔴 **CPO 가 지정한다.** CTO 가 만들지 않는다.
🟢 §6 의 CEO YES 를 받은 **뒤** 에 CPO 가 실제 상품군 확대를 다시 판단한다.

```
🔴 지금 열면 안 되는 것 — MI 완화 · Registry 확대 · 등록 · 카테고리/채널 확장(§5)
🟡 CEO 가 NO 면 → **화면 문제** 로 CTO 가 재조사(MI WU 로 바꾸지 않는다)
🟡 국내 SAME 을 열려면 → **국내 human GT 추가** 가 선행이다(§8)
```

---

## 부록 A. 깨질 수 있는 계약 (이름만 — FAIL 나면 열어라)

```
wu-146-seller-decision-contract   🔵 **절대조건 7 + Q1~Q7**(결론 owner · 금지 표현 · 접힘)
wu-145-seller-decision-screen     1차/2차 분리 · 어휘 · 금지 문구 · 📚 접힘
wu-144-seller-decision-e2e        2상품 A~H · 🔴 평균은 **부정문으로만**
wu-140-market-first               🔴 **화면 순서** · 「동일상품 확인 0곳」 · 1차에 사유 부재
wu-141-r2/r3                      탐색은 접힘 뒤 · 가격 owner 단일
wu-139-price-guide                SINGLE/RANGE · 🔗 링크 · 평균 금지
wu-136-market-judgement(-render)  판매여부 3상태 · 접힘 · 순서
wu-133-pending-note-render        사유는 **2차에** · 1차엔 **표 전수로 부재**
wu-130-overseas-auto-pool  F-4    🔴 **그 영역에 집계/판정 어휘 금지**(이름으로 걸린다)
wu-056r1-price-section-identity   가격 구역 식별(제목 상호 비포함 · 해외에 ₩ 0)
single-action-center              패널은 한 번만 마운트 — 🔴 **주석을 벗기고** 센다
```

🔴 FAIL 이 **의도된 변경** 이면 앵커를 갱신하고 **강화** 한다(약화 금지).
🔴🔴 그리고 **가드가 내 이름을 막으면 가드를 풀지 말고 이름을 옮긴다** —
`wu-130 F-4` 가 `sellerDecision` 을 막았고, 그 이름은 **이미 판매판정 owner 의 어휘**였다
(`buildSellerDecision` · `computeSellerAction`). 🟢 `marketDecisionLines` 로 옮겼다.

## 부록 B. 실행 명령 (복붙)

```bash
# 회귀 (전체 · 약 3.5분) — 🔴 출력을 파일로 받는다(실패 이름을 놓치지 않기 위해)
cd apps/admin && npx vitest run > /tmp/reg.txt 2>&1; grep -nE "FAIL |AssertionError" /tmp/reg.txt

# typecheck · build  (🔴 grep 종료코드를 tsc 의 것으로 읽지 않는다 — 파일로 받는다)
cd .. && npx tsc -p apps/admin/tsconfig.json --noEmit
cd apps/admin && npm run build

# 라이브 하니스 (게이트 없으면 SKIP · 외부 HTTP)
WU_138_PROBE=1 npx vitest run src/app/api/price-history/_lib/__tests__/wu-138-same-funnel.test.ts
WU_134_PROBE=1 npx vitest run src/app/api/pipeline/__tests__/wu-134-live-origin.test.ts

# DB 실측 (read-only)
cd packages/database && node --env-file=.env scripts/supabase-grant-audit.mjs

# 배포 확인
npx vercel ls --yes | grep -A1 "Age "
```

🔴 **변이(음성 대조)는 `python3` 없이 `Edit` 로만** 한다(이 환경에 python3 이 없어
「적용 실패」가 「통과」로 읽힌 적이 있다). 🔴 **미커밋 구현을 `git checkout` 으로 되돌리지
않는다** — 백업 복사 후 **바이트 대조** 로 복구를 확인한다.
