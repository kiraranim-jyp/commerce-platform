# ▶ START HERE — 바로 손 움직이는 순서

> 🔴 이 파일만 읽고 **바로 작업 시작**. 다른 문서는 **막혔을 때만** 열어라.
> 🔴 조사·설계를 다시 하지 않는다. 아래 1번을 먼저 읽는다.
> 갱신 2026-10-22 · main `df983db3` 계열(clean · 회귀 **8,672 / 0 failed** · build 0)

---

## 1. 지금 할 일 — 🟡 **CEO 화면 확인 1회. CTO 가 할 코드 작업이 «없다»**

```
🟢🟢 WU-141-R3 · 142 · 143 · 144 **전부 CLOSED.**
   R3   가격 owner 단일화(계약 30건 분류 · 신규 16 · 변이 9 · 배포 `e0b44b19`)
   142  2상품 MI 실측 — precision **6/6** · recall **6/19** · DIFFERENT 누출 **0**
   143  네 레버(C1~C4) 전부 측정 → 🔴 **전부 되돌렸다**(구현 0 · 아래 §1-C)
   144  2상품 Seller Decision E2E — 🟢 **A/B/C/D 전부 통과 · 추가 코드 0**
🔴 **다음 범위는 CPO 가 지정한다.** CTO 가 선제적으로 WU 를 만들지 않는다.
```

### 🔴🔴 §1-C — **MI recall 을 더 풀지 않는다** (WU-143 실측 · 다시 조사 금지)

```
C1 AUDIENCE_LINE 비차단   🔴 **NO-GO** — false SAME **13건**(다른 그래픽 5쌍이 SAME 이 됐다:
                          Mush Monster · Softpaw · Juicy Tomatoes · Bobo Choses Color)
C2 MODEL_CODE 전면 해제    🔴 CPO 명시 **금지**(AC↔AB 한정만 검토 가능)
C3 품번 exact ⟹ brandOk    🔴 **HOLD** — 12파일 16건 충돌(wu-057 · **wu-068 GT 63** · wu-060 · wu-069)
C4 `.kr`+가격없음 ⟹ KR     🔴 **HOLD** — 시장 자격이 **영속 `price_alerts` 체인의 입구** 다
                          (wu-060/063 계약 · 그 측정이 선행)
🟢 2상품 GT 만 보면 넷 다 GO 였다(recall 6/19 → 9/19 · leak 0) —
   🔴 **그 표본이 작아서 안전해 보였을 뿐** 이다. 전체 회귀가 넷 다 막았다.
⟹ 🔴 **「내 표본에서 leak 0」을 GO 근거로 쓰지 않는다.**
🟢 되돌린 사실은 계약이 잠근다 — `wu-143-identity-expressiveness.test.ts`(10건).
   같은 변경을 다시 넣으면 **거기서 먼저 걸리고** 각 축 주석에서 사유를 읽는다.
🟡 BABY/CHILD **사업정책은 유효하다**(CPO 확정) — 적용하려면 범위를 좁힌 규칙
   (「핵심 상품명 토큰이 사실상 동일할 때만 비차단」)이 필요하고 **새 규칙 + 표본** 이 선행이다.
```

🟡 **CEO 가 볼 것 — `/pipeline` → B226AC009 → 📊 시장 판매 판단**
(전문 `docs/HANDOFF-WU-141-R3.md` §⑧)
```
PASS  · 🇰🇷/🌎 판단이 한 곳에서 보인다
      · **위아래 가격 숫자가 다르지 않다**   ← 이것이 R3 의 목적이다
      · 별도 「시장 가격 비교」가 또 나오지 않는다
      · 후보 리스트가 처음부터 길게 나오지 않고 `▸ 판단 근거 보기` 로 열린다
      · 동일/유사/다름 저장이 유지된다
🟡 정상인데 FAIL 로 보이기 쉬운 것 — 🇰🇷 에 금액이 없고 「확인하지 못했습니다」인 것은
   **정상** 이다(국내 tier SAME 0 · WU-138 확정 · 완화 REJECT). 퇴화가 아니다.
```

🔴🔴 **CPO 판정 대기 1건(CTO 가 고치지 않았다)** — R3 가 시장 두 블록을 결론 영역으로
올리면서 그 안의 드릴다운(`▸ 국내/해외 가격 보기`)이 사라졌다 ⟹ `openMarketEvidence` +
`PRICE_COMPARISON_ANCHOR_ID` 스크롤이 **호출자를 잃었다.**
🟢 원자료는 **패널 자신의 헤더** 로 그대로 열린다(계약으로 확인 · 기능 손실 0).
🔴 앵커는 보존 계약이라 **지우지 않았다** — 「결론에서 원자료로 가는 바로가기를 다시
줄 것인가」는 **UI 설계 결정** 이라 CPO 몫이다.

---

## 1-OLD. [기록] WU-141-R2 STEP 1 좌표 (브랜치에서 이미 구현됨)

🟢 WU-140-R1 CEO PASS · 🟢 WU-141-R1 **CLOSED**(STEP 4 저장 CEO PASS) ·
🟢 WU-141-R2 **STEP 2 완료·배포**(`4e7de9bd` — 탐색을 `▸ 판단 근거 보기` 하나로 접었다).

🔴🔴 **진행 중 WU = `docs/HANDOFF-WU-141-R2.md`.** 남은 것은 **STEP 1 → 3 → 7 → 5 → 6**
이고 **좌표가 전부 적혀 있다**. 🔴 CEO 추가 테스트 **없다** — 전부 끝낸 뒤 딱 한 번.

```
STEP 1 ③ buildOverseasMarketEvidence 제거 ← **최우선 · 이것만으로 「두 답」이 사라진다**
       어댑터 하나(`overseasEvidenceFromRows`)로 ① 게이트에서 요약을 만든다
       🟢 그러면 mi-verdict-copy strict 전환이 **자동으로** 닫힌다
STEP 3 ComparisonShopSearch 자체 검색 0  ← 🔴 표 렌더를 맞춰야 해서 **STEP 1 과 분리**
STEP 7 아래 「📊 시장 가격 비교」(StageBody:242) 흡수 + anchor 주인 이전
STEP 5 판단 근거 안의 «행» 순서(구역 재편 ❌ — 출처 축은 WU-130 계약)
STEP 6 중복 전수 점검(STEP 1·3 을 닫은 **뒤** 에)
```

🟢 **CPO 가 C-1~C-7 로 답했다**(R2 §⑥-A) — 판정 카드는 **유지** 하되 **C-3**: 카드가
「국내/해외 가격 · 시장 가격 · 판매처 수」를 **다시 표시하지 않는다**.
🟢 대상 좌표 확정 — `Panel.tsx:3598` `<MarketComparisonView>` · `:3622`
`<OverseasMarketEvidenceView>`. 🟢 4줄 판정 설명은 **그대로**(숫자 없는 정성 문장 ·
「네 줄」이 계약). 🔴 단 그 4줄의 입력 둘을 ① 에서 만들어야 한다(R2 §⑥-A 에 식 있음).

🔴🔴🔴 **C-3 의 작업 지점은 «둘» 이 아니라 «셋» 이다**(R2 §⑥-A 첫 블록) —
`judgement-summary.ts:113·115` 가 1차 화면 맨 위 요약 카드(`Panel:3362`)에
「비교 가격 ₩…」·「해외 시장 £…」를 **또 찍는다**. 🔴 두 뷰만 고치고 「완료」로 적으면
**거짓** 이다. 🟡 그 두 줄을 ⒜ 지울지 ⒝ ① 산출로 바꿀지 **CPO 한 줄** 이 필요하다.

🔴🔴 **그리고 실행 전 CPO 확인이 하나 더 있다**(R2 §⑥-B) — C-3 는 **2026-09-12 CEO 지시**
(「시장 두 칸을 판정 카드로 되돌린다」)를 뒤집는다. 🟢 그 지시의 근거(「판정이 근거 없는
숫자로 읽힌다」)는 WU-140-R1 이 📊 를 **위로** 올려 이미 충족됐다 ⟹ 모순이 아니라 목적을
다른 배치로 만족시키는 것이다. 🔴 그래도 **CEO 가 직접 지시한 배치** 라 조용히 뒤집지 않는다.
🟢 확인만 오면 **즉시 실행** 한다(좌표·식·계약·변이 목록 전부 R2 에 있다).

🔴🔴 **먼저 알아야 할 핵심 사실 — 「집합 둘 + 게이트 셋 + 집계 «셋»」 이다**
```
아래  `mayShowCandidate`(match-display.ts:248) — PRESUMED_SAME·SIMILAR 통과 ·
      품절 **안 봄** · 가격검증 **안 봄** · 그리고 **자기 검색**을 돌린다
      (DomesticShopSearch:188 → /api/domestic-price-sources/search ·
       ComparisonShopSearch:224 → **/api/comparison/search**)
위    tier **SAME** + 품절 아님 + priceStatus **VERIFIED_CURRENT**  (/check 의 MI 산출)

🔴🔴 집계 owner 가 **셋** 이다(한 번 틀렸다가 코드 읽고 정정한 자리다):
  ① mi-same-candidates(/check)        → 📊 시장 판매 판단
  ② 서버 참고가격(/check · 유사 포함)   → 상세 근거
  ③ 🔴 buildOverseasMarketEvidence(market-evidence.ts:243)
     ← **아래 패널 자기 검색**(ComparisonShopSearch:405) → **MI 패널 🌎 요약**
     게이트가 또 다르다(`tier==="SAME" && price!=null` · 품절/검증 **안 봄**)
🔴 ③ 은 `mi-verdict-copy.ts:58` 로 **판정 문구** 에도 닿는다 ⟹ 그냥 끊으면 문구가 바뀐다
🟢 설계안·정책 질문 둘은 `docs/HANDOFF-WU-141-R1.md` **④-B** 에 있다
```

🔴 **R1 의 교훈(남긴다) — 「기둥 안에서 맨 위」는 「화면 맨 위」가 아니다**
```
격자 order 유틸리티(:3640 왼쪽 `order-2 lg:order-1` · :4353 오른쪽 `order-1 lg:order-2`)
⟹ `lg` 미만에서 Action Center 가 내용 기둥보다 먼저 온다.
🔴 최상단 노출이 요구되면 **격자 밖** 에 둔다 · 격자 order 를 뒤집지 않는다.
```

### 1-B. 🔴 **CEO 에게 지금 아무것도 요청하지 않는다** (CPO 확정 2026-10-21)

```
🔴🔴 CPO: 「CEO 테스트를 당분간 다시 시키지 마십시오 … 제품 설계 실패를 CEO
   테스트로 보완하는 방식을 끊겠습니다.」
⟹ WU-141-R2 를 **전부 끝낸 뒤 딱 한 번** 보여준다. 중간 확인 요청 금지.
🟢 이미 받은 PASS 둘 — WU-140-R1 상단 배치 · WU-141-R1 STEP 4 저장.
```

🟡 **그 «한 번» 때 같이 전달할 것**(미리 적어 둔다 — 안 적으면 「퇴화」로 읽힌다):
```
① 🇰🇷 국내에 금액이 없고 「확인하지 못했습니다」인 것은 **정상** 이다 —
   tier SAME 이 **0** 이고 원인 확정·완화 REJECT(WU-138). 완화해서 만들지 않는다
② 「가격 확인 필요」 + 🔗 링크 — 가격을 못 읽은 SAME 후보를 **버리지 않는 것** 이다
③ 「판매여부 확인불가」 — 사이트가 재고를 공개하지 않는다(실측 7/9). 품절이 아니다
④ 후보 목록이 **안 보이는 것** 이 정상이다 — `▸ 판단 근거 보기` 안에 **그대로** 있다
```

---

## 2. 깨질 수 있는 계약 (이름만 — 열지 말고 FAIL 나면 보라)

```
mi-022-gemini-transient-ux        패널 배선 + 후보 구역 접힘
wu-056r1-price-section-identity   가격 구역 식별(제목 상호 비포함 · 해외에 ₩ 0)
wu-130-overseas-auto-pool  F-3    「가격비교 영역은 하나」 + 제목이 하나뿐
wu-132-mi-same-price-comparison   B-1 조회 전 미렌더 · B-2 결론이 제목 바로 뒤
wu-136-market-judgement(-render)  판매여부 3상태 · 접힘 · 순서
wu-139-price-guide                SINGLE/RANGE · 🔗 링크 · 평균 금지
wu-140-market-first               🔴 **화면 순서**(🇰🇷→🌎→결과→상세) · 시장별 상태 넷
wu-141-r2-judgement-basis         🔴 **탐색은 「판단 근거」 접힘 뒤** · open 금지 · 접힘 하나
single-action-center              패널은 한 번만 마운트 — 🔴 **주석을 벗기고** 센다
```
🔴 FAIL 이 **의도된 변경** 이면 앵커를 갱신하고 **강화**한다(약화 금지). 선례가 이 트랙에 여럿 있다.

---

## 3. 절대 하지 말 것 (이것만 기억하면 된다)

```
❌ MI threshold 완화 · 8축 완화 · NO_TITLE_OVERLAP 재개방
   (완화 = Human DIFFERENT 동반 개방이 **열 번** 측정됐다 · WU-138 반사실 순손실)
❌ PRESUMED_SAME → SAME 승격 · human SAME → system SAME
❌ 실등록 실행 (STOP 유지) · Registry 확대 · 543건 재추출
❌ 새 가격비교 영역 추가 (영역은 **하나** 다)
❌ Supabase 기존 32개 테이블 GRANT/RLS/policy 변경 · production test table 생성
```

---

## 4. 현재 완료도 (과장 금지 · 그대로 인용)

```
🇰🇷 국내   미완료 — tier SAME **0**. 원인 확정됨(biskuit 는 MI 축 · beaumonde 는 가격 축)
          🔴 완화로 열지 않는다. 열리는 조건은 **국내 human GT 추가**(현재 분모 2)
          🟢 WU-140 이 고친 것은 **그 0 의 «이유» 를 화면이 말하게** 한 것이다(0 → 0)
🌎 해외   🟢 데이터·판정·**화면 순서까지 완료**(배포 `fae68f6e`)
          🟡 단 **Production 실화면은 CTO 가 볼 수 없다** ⟹ CEO 확인 1회로만 닫힌다
Supabase  기존 권한 **변경 없음** · 신규 migration 계약 **PASS** · ④ 10/30 실측만 남음
```

🔴 **「WU-140 완료」를 「제품 완료」로 읽지 않는다** — 닫힌 것은 **노출 순서와 상태 의미** 다.
국내 SAME 0 은 그대로이고 그것은 **MI 축의 문제**(WU-138 에서 완화 REJECT)다.

---

## 5. 막혔을 때만 열 문서

| 상황 | 문서 |
|---|---|
| 🔴 **지금 작업(WU-141-R2) — 남은 STEP 좌표 · 금지 · 열린 질문** | `docs/HANDOFF-WU-141-R2.md` |
| 데이터 소유권 · 위/아래 차이 · 정책 결정(R1 기록) | `docs/HANDOFF-WU-141-R1.md` |
| 그 다음(WU-142 국내 SAME) — 출발 표 · 금지 레버 · 미측정 가설 | `docs/HANDOFF-WU-141.md` |
| WU-140 세부(이동 구조 · CPO 확정 순서 · R1 원인) | `docs/HANDOFF-WU-140.md` |
| 국내 SAME 왜 0인가 / 완화를 왜 안 하나 | `docs/HANDOFF-WU-138.md` · `-DOMESTIC-GT.md` |
| Supabase 10/30 · ③④ | `docs/HANDOFF-SUPABASE-GRANT-01.md` |
| 가격 가이드 정책(SINGLE/RANGE · 링크) | 🔴 전용 문서 **없다** → `CLAUDE.md` §12 의 **WU-139 절** |
| 브랜드 배선 결함(왜 brand 가 ""였나) | `docs/HANDOFF-WU-137.md` |

🔴 **헌장(`CLAUDE.md`)은 §12 맨 앞 착수점 절만** 보면 된다. 그 아래는 종료된 기록이다.

---

## 6. 실행 명령 (복붙)

```bash
# 회귀 (전체 · 약 3분)
cd apps/admin && npx vitest run

# typecheck · build
cd .. && npx tsc -p apps/admin/tsconfig.json --noEmit
cd apps/admin && npm run build

# 라이브 하니스 (게이트 없으면 SKIP · 외부 HTTP)
WU_138_PROBE=1 npx vitest run src/app/api/price-history/_lib/__tests__/wu-138-same-funnel.test.ts
WU_134_PROBE=1 npx vitest run src/app/api/pipeline/__tests__/wu-134-live-origin.test.ts

# DB 실측 (read-only)
cd packages/database && node --env-file=.env scripts/supabase-grant-audit.mjs

# 배포 확인 — 🔴 HTTP 코드가 아니라 빌드 로그의 Commit: 줄이 증거다
npx vercel ls ttaejyo --yes
npx vercel inspect <deployment-url> --logs | grep -i "Commit:"
```

🔴 `main` push = **Production 배포**다. 배포는 **repo 루트에서만**. `vercel --prod` 쓰지 않는다.
🔴 종료 보고에 `git status` **와** `git rev-list --left-right --count origin/main...HEAD` 를 같이 적는다.
