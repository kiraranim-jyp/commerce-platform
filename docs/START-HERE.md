# ▶ START HERE — 바로 손 움직이는 순서

> 🔴 이 파일만 읽고 **바로 작업 시작**. 다른 문서는 **막혔을 때만** 열어라.
> 🔴 조사·설계를 다시 하지 않는다. 아래 1번부터 코드를 고친다.
> 갱신 2026-10-21 · HEAD `cf83ea46` · Production `3dc458b` · clean · 회귀 8,594 / 0 failed

---

## 1. 지금 할 일 (WU-140) — **JSX 이동 하나부터**

파일: `apps/admin/src/app/pipeline/CommerceWorkspace.tsx`

```
현재   3655  {snapshotId ? (
       3656     <DomesticPriceIntelligencePanel …>   ← 후보 패널
       3818     {/* 「**맨 위** 에 둔다」 주석 */}
       3826     <MarketPriceComparison …/>           ← 결론 (지금 여기 = 너무 아래)
       3831     <DomesticShopSearch …/>
       3847     <ComparisonShopSearch …/>

할 것  3826 의 <MarketPriceComparison …/> 를 3655 조건부 블록 **앞** 으로 옮긴다
       + 3818 주석도 같이 옮긴다
금지   `PRICE_COMPARISON_ANCHOR_ID` div 삭제 · `scrollIntoView`(:837) 변경
       props 변경(그대로 `marketComparison?.rows` 등 — state 는 이미 위에 있다)
```

🔴 두 컴포넌트는 **형제가 아니다**(사이 ~170줄). 자르기 전에 그 구간 구조를 **먼저 읽어라.**

### 그 다음 (같은 WU · 순서대로)

**2)** `MarketPriceComparison.tsx` 내부 순서를 이렇게:
```
① 🇰🇷 국내  ② 🌎 해외  ③ 가격/판매 판단 결과  ④ ▸ 상세 근거
```
🔴 지금은 `verdict → 카운트 → 표 → price-guide` 순이다. **시장 블록이 먼저**다(CPO 확정).
🔴 `market-verdict` / `market-sale-counts` / `market-split` / `market-seller-table` /
`price-guide-*` **testid 는 전부 유지**(계약이 본다).

**3)** `mi-same-candidates.ts` 의 `countPendingCandidates(rows)` → **`(rows, market)`**
```
🔴 CPO: 「단순 UI 수정이 아니라 **상태 의미를 정확히 만드는 핵심 수정**」
셀러가 넷을 구분해야 한다 — ⒜ 검색 자체가 안 됨 ⒝ SAME 판정 보류
⒞ SAME 인데 가격 확인 필요 ⒟ 가격 확인 완료
🔴 지금은 ⒜ 와 ⒝ 가 화면에서 **같은 빈 칸** 이다
🟢 집계·판정 변경 0 — 필터 한 줄 + 문구 네 개
```

**4)** 계약 갱신 → 회귀 → typecheck → build → 배포 → CEO 테스트 시나리오 작성

---

## 2. 깨질 수 있는 계약 (이름만 — 열지 말고 FAIL 나면 보라)

```
mi-022-gemini-transient-ux        패널 배선 + 후보 구역 접힘
wu-056r1-price-section-identity   가격 구역 식별(제목 상호 비포함 · 해외에 ₩ 0)
wu-130-overseas-auto-pool  F-3    「가격비교 영역은 하나」 + 제목이 하나뿐
wu-132-mi-same-price-comparison   B-1 조회 전 미렌더 · B-2 결론이 제목 바로 뒤
wu-136-market-judgement(-render)  판매여부 3상태 · 접힘 · 순서
wu-139-price-guide                SINGLE/RANGE · 🔗 링크 · 평균 금지
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
🌎 해외   데이터·판정 정상 — 🔴 WU-140 화면 전환 전이므로 **아직 미완료**
Supabase  기존 권한 **변경 없음** · 신규 migration 계약 **PASS** · ④ 10/30 실측만 남음
```

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
