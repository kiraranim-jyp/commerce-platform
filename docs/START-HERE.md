# ▶ START HERE — 바로 손 움직이는 순서

> 🔴 이 파일만 읽고 **바로 작업 시작**. 다른 문서는 **막혔을 때만** 열어라.
> 🔴 조사·설계를 다시 하지 않는다. 아래 1번을 먼저 읽는다.
> 갱신 2026-10-21 · HEAD `7b25d9b5` · clean · 회귀 8,616 / 0 failed · tsc 0 · build 0

---

## 1. 지금 할 일 — **WU-141-R1 STEP 3+5 설계부터** (조사는 끝났다)

🟢 WU-140-R1 **CEO PASS**(상단 배치 닫힘). 🟢 WU-141-R1 **STEP 4 완료·배포**
(후보 검토 저장 실패 수정 — 원인 `42P10`).

🔴🔴 **남은 것은 STEP 3 + 5 다. 한 묶음으로 설계한다** — 전문 `docs/HANDOFF-WU-141-R1.md`
(①②가 데이터 소유권과 「위/아래가 다른 이유」를 **이미 코드 좌표로** 닫았다 · 재조사 금지).

```
🟢🟢 **설계가 끝났다 — CPO 가 13단계로 고정했다**(`HANDOFF-WU-141-R1.md §⑤`).
     ① = 결론 source of truth · ② = 상세 근거 · ③ = 제거 (CPO 확정)
🔴 **선행 게이트: CEO 저장 테스트 PASS.** 그 전에는 1번도 시작하지 않는다.
🔴 다시 설계하지 않는다 — 바꿀 문자열 좌표까지 §④-B 에 적혀 있다.
```

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

```
🟡 남은 것 하나 — CEO 가 실제 따져 화면을 **1회** 확인한다(시나리오는 §1-B).
🔴 그 확인 전에 화면을 또 손대지 않는다 — 무엇이 문제인지 CEO 피드백이 기준이다.
```

### 1-B. CEO 확인 시나리오 (이것만 전달하면 된다)

```
URL     https://ttaejyo.vercel.app/today → 상품 열기 (로그인 필요)
상품    B226AC009 (해외 SAME 이 실재하는 표본) · 그리고 아무 상품 하나 더
순서    ① 상품 화면을 연다 → ② **스크롤하지 않고** 맨 위를 본다

🔴🔴 1차(`fae68f6e`)는 **이 기준에서 FAIL** 했다 — 결론이 후보 패널보다는 앞이었지만
   **격자 «안»** 이라 `lg`(1024px) 미만에서 Action Center 가 그보다 먼저 왔다.
   🟢 `7b25d9b5` 에서 결론을 **격자 밖** 으로 꺼냈다(계약 C-3 가 그 자리를 잠근다).

🟢 기대 — 「📊 시장 판매 판단」이 **단계 표시·탭 줄 바로 다음**(= 첫 번째 판단 영역)
   이고, 그 안에서
   🇰🇷 국내 블록 → 🌎 해외 블록 → 판매·가격 판단 결과 → ▸ MI 상세 분석 순서다.
   🌎 블록에 「동일상품 확인 N곳 · 판매중 확인 N곳 · 가격 확인 N곳」과 💰 금액이 보인다.
   🇰🇷 블록은 「후보를 찾지 못했습니다」 또는 「후보 N곳을 찾았지만 …」이라고 **이유** 를 말한다.
   후보 목록·검토 이력은 **그 아래** 에 접힌 채로 있다.

🔴 FAIL 로 봐야 하는 것
   · 후보 목록을 지나서야 결론이 나온다(= 순서가 되돌아갔다)
   · 🇰🇷 가 빈 칸이고 **이유를 말하지 않는다**
   · 커머스 탭(스마트스토어·쿠팡·롯데ON)에 「시장 판매 판단」이 보인다

🟡 정상인데 FAIL 로 보이기 쉬운 것 셋 — **이건 FAIL 이 아니다**
   ① 🇰🇷 국내에 금액이 없다 — tier SAME 이 **0** 이고 원인 확정·완화 REJECT(WU-138)
      🔴 STEP 3+5 배포 뒤에는 🇰🇷 판정 줄도 「확인하지 못했습니다」로 바뀐다(예정 · 정상)
   ② 「가격 확인 필요」 + 🔗 링크 — 가격을 못 읽은 SAME 후보를 **버리지 않는 것** 이다
   ③ 「판매여부 확인불가」 — 사이트가 재고를 공개하지 않는다(실측 7/9). 품절이 아니다
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
| 🔴 **지금 작업(STEP 3+5) — 데이터 소유권 · 위/아래 차이 · 막을 계약** | `docs/HANDOFF-WU-141-R1.md` |
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
