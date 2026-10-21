# ▶ START HERE — 바로 손 움직이는 순서

> 🔴 이 파일만 읽고 **바로 작업 시작**. 다른 문서는 **막혔을 때만** 열어라.
> 🔴 조사·설계를 다시 하지 않는다. 아래 1번을 먼저 읽는다.
> 갱신 2026-10-21 · HEAD `fae68f6e` · clean · 회귀 8,616 / 0 failed · tsc 0 · build 0

---

## 1. 지금 할 일 — **CTO 코드 작업 없음 · CEO 화면 확인 1회 대기**

🟢 **WU-140 종료**(배포 `fae68f6e`). 🔴 **새 WU 를 선제적으로 만들지 않는다** — 다음 범위는
CPO 가 지정한다(헌장 §12 「CTO 는 선제적으로 WU 를 만들지 않는다」).

```
🟡 남은 것 하나 — CEO 가 실제 따져 화면을 **1회** 확인한다(시나리오는 §1-B).
🔴 그 확인 전에 화면을 또 손대지 않는다 — 무엇이 문제인지 CEO 피드백이 기준이다.
```

### 1-B. CEO 확인 시나리오 (이것만 전달하면 된다)

```
URL     https://ttaejyo.vercel.app/today → 상품 열기 (로그인 필요)
상품    B226AC009 (해외 SAME 이 실재하는 표본) · 그리고 아무 상품 하나 더
순서    ① 상품 화면을 연다 → ② **스크롤하지 않고** 맨 위를 본다

🟢 기대 — 「📊 시장 판매 판단」이 **맨 위** 에 있고, 그 안에서
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
| WU-140 세부(이동 구조 · CPO 확정 순서 · 현재 실측값) | `docs/HANDOFF-WU-140.md` |
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
