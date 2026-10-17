# WU-057 FINAL — 두 축

> **축 A (`BRAND_UNCONFIRMED` → EXACT) = 🟡 HOLD · 구현 0** — 원인 확정 · 전수조사 완료 ·
> 🔴 완화하면 CPO §11 의 「False SAME 증가 없음」을 **증명할 수 없다**(FP 분모 0).
> **축 B (소싱 UI 제거) = 🔴 미착수 · 용량 분리 요청** — §4-B 「용량 판단은 시작 전에
> 한다」 적용. 측정된 범위를 §B 에 적었다.
> 🔴 운영 코드 변경 **0** · 작업트리 clean.

---

# 축 A — `BRAND_UNCONFIRMED`

## 1. 전체 현황 (GT 51건 · 운영 경로 실측)

```
후보 단위 blocker 분포
  BRAND_UNCONFIRMED **11** · NO_TITLE_OVERLAP 4 · COLOR_VARIANT 2 · MATERIAL 2 ·
  SAME_SELLER_DISTINCT_LISTING 2 · GARMENT_FORM 1 · BRAND_MISMATCH 1
```

🔴🔴 **11건은 「빈 쪽」으로 둘로 갈린다** — 같은 blocker 이름이지만 **다른 문제** 다:

| 빈 쪽 | 건수 | 품번 O | 품번 X |
|---|---|---|---|
| **CANDIDATE** (origin brand 있음) | 6 | SAME **5** | DIFFERENT 1 |
| **ORIGIN** (🔴 원상품 brand = `null`) | 5 | SAME 2 + GT없음 1 | DIFFERENT 2 |

```
domain                human      code         originBrand    candBrand        빈 쪽
beaumonde.co.kr       SAME       B226AC010    Bobo Choses    (없음)           CANDIDATE
bobochoses.co.jp      SAME       B126AI018    Bobo Choses    (없음)           CANDIDATE
donokids.com ×3       SAME       AW26MS185    Main Story     (없음)           CANDIDATE
beaumonde.co.kr       DIFFERENT  —            Pèpè Shoes     (없음)           CANDIDATE
kihanan.com           SAME       B226AC117    **(없음)**      BOBOCHOSES ボボ…  ORIGIN
m.web.mustit.co.kr    (GT없음)    B226AC117    **(없음)**      보보쇼즈          ORIGIN
biskuit.kr            SAME       B226AC117    **(없음)**      **비스킷**        ORIGIN
tinyapple.net         DIFFERENT  —            **(없음)**      Bobo Choses      ORIGIN
ladida.com            DIFFERENT  —            **(없음)**      Bobo Choses      ORIGIN
```

🟢 **교차표가 완벽히 갈린다** — 품번 O → Human **SAME 7/7** · 품번 X → **DIFFERENT 3/3**.

---

## 2. 근본 원인 — 코드 두 줄

```
cross-seller.ts:751   brandKnown = Boolean(x.brand && y.brand)   ← **한쪽만 비어도 false**
             :999     if (!brandKnown) blockers.push(BRAND_UNCONFIRMED)
             :1079    if (!blocked && **brandOk** && corePoints >= SAME_MIN_AXES) return "SAME"
             :920     identifierBackedCrossSeller = **brandOk** && modelCode === "exact" && …
⟹ 🔴 품번이 exact 여도 `brandOk` 가 false 면 **SAME 에 닿는 경로가 둘 다 막힌다.**
```

🔴 그리고 **원상품 brand 가 비는 것(5/11)은 후보 문제가 아니다** — `bobochoses.co.jp`
스냅샷의 canonical brand 가 비어 있다(S6). 그것은 **brand resolver/backfill** 영역이고
헌장이 **변경 금지**로 못 박은 구역이다.

---

## 3. 적용한 evidence — **없다(의도)**

🔴 WU-037 의 기존 안전 규칙(`isSameStoreListingAcrossMarkets` = registrable label +
market-neutral path)을 **먼저 확인했다.** 🔴 그것은 「같은 스토어의 다국가 리스팅」을
가르는 규칙이고 **브랜드를 확인해 주지 않는다** — 이 11건에는 쓸 수 없다.

🔴 **금지 구역과 정면으로 만나는 길만 남았다**(CPO §4 · WU-054 §10):

```
한글 브랜드 사전            ❌   「보보쇼즈 → Bobo Choses」 치환 ❌
domain → brand 강제 주입    ❌   (bobochoses.co.jp → "Bobo Choses")
품번만 같으면 SAME          ❌   (게이트 완화)
origin brand resolver 변경  ❌   (헌장 금지)
```

---

## 4–5. EXACT 변화 **0** · False SAME 변화 **0**

```
구현하지 않았으므로 두 숫자 모두 **변화 0** 이다.
🔴 그리고 **완화했을 때의 FP 를 측정할 수 없다** — 품번 O 그룹에 Human DIFFERENT 가
   **0건** 이라 **분모가 없다**(§5-B 「측정불가 ≠ 0%」). N=7 이다.
⟹ CPO §11 의 GO 조건 「False SAME 증가 없음」을 **증명할 수 없다** → HOLD 조건 충족.
```

### 🔴🔴 그리고 완화가 **위험하다는 실증** 이 나왔다

```
`biskuit.kr` 후보의 brand 가 **"비스킷"** 으로 읽혔다 — **샵 이름** 이다(브랜드 아님).
🟢 지금은 원상품 brand 가 null 이라 `BRAND_MISMATCH` 를 **면하고** 있다.
🔴 브랜드를 「채우는」 쪽으로 가면 그 값이 브랜드가 되고 **BRAND_MISMATCH 로 바뀐다**
   — EXACT 가 늘기는커녕 **더 막힌다.** 테스트가 그것을 실행으로 증명한다.
🟢 WU-034 의 「브랜드를 «추정» 하는 것과 «확인» 하는 것을 섞지 않는다」가 데이터로 재확인됐다.
```

---

## 6. C27 — 두 문제를 **분리해서** 적는다 (CPO §5)

```
A. Identity   🟡 **해결 가능성 있으나 안전하지 않다** — 후보 brand 가 비어 있고
              (beaumonde 는 구조화 데이터 0) 채우는 길이 전부 금지 구역이다.
              🔴 품번(B226AC010)은 **이미 확인된다**(WU-054 addendum 재확인).
B. Price      🔴 **본문 텍스트 가격이 맞다** — JSON-LD 0 · microdata 0 ·
              본문에 「88,000원」. `VERIFIED_CURRENT` 미승격 → 국내 집계 미도달.
              🟢 CPO §6 대로 **일반 숫자 parser 를 만들지 않았다** → **HOLD**.
🔴 둘을 하나로 묶지 않았다 — A 가 풀려도 B 는 그대로 막히고, 그 반대도 같다.
🟢 그리고 **같은 상품군의 국내 가격은 이미 보인다** — biskuit.kr 이 KRW 88,000 으로
   국내 집계에 도달했다(WU-056 실측 · Human SAME).
```

---

## 7–11. 보호계약 회귀 · mutation · 검증

```
🔴 mutation 없음 — **운영 코드 변경이 0** 이라 변이 대상이 없다(CPO §8 은 구현 시 조건).
🟢 대신 현재 게이트를 **단언으로 고정** 했다(5건):
   ① BRAND_UNCONFIRMED 가 남고 verdict ≠ SAME
   ② 🟢 CONFLICT 로 단정하지도 않는다(보류다)
   ③ 브랜드를 확인하면 같은 입력이 통과한다(게이트가 브랜드 하나임의 증명)
   ④ 🔴🔴 샵 이름을 브랜드로 채우면 **BRAND_MISMATCH 로 더 막힌다**(위험 실증)
   ⑤ 🔴 **품번 exact 만으로 SAME 이 되지 않는다** ← 게이트 완화 금지를 코드로 잠금
보호계약 유지 — COLOR_VARIANT · SIZE_SYSTEM · compareModelCode · 국내/해외 축 분리 ·
   환산 금지 · priceSource detail · transient · EXCLUDED 라벨 · 가격 구역 식별
   **전건 통과**(전체 회귀)
회귀      admin **8,219 passed · failed 0**   ·   typecheck **0**
build     🔴 미실행 — 운영 코드 변경 0 · 같은 tsconfig 의 `tsc --noEmit` 이 0
Production 변경 0 — 배포 `002b2738` 그대로
```

---

# 축 B — 소싱 UI 제거 · 🔴 **미착수(용량 분리 요청)**

## B-1. 측정된 범위 — 「UI 제거」가 아니라 **workflow 구조 변경** 이다

```
운영 6파일
  workflow.ts        BigStepKey union · BIG_STEP_ORDER · BIG_STEP_LABELS ·
                     buildSourceSelecting() · steps 배열 · SourcingSignal 입력
  stage-focus.ts     MAIN_BY_STAGE · IMAGE_ROLE_BY_STAGE · StageFocus.sourcing
  StageBody.tsx      「소싱 선택」 섹션(접힘 + 본문)
  CommerceWorkspace  SourcingPanel 마운트 · sourcing signal 배선
  page.tsx           sourcing 참조
  SourcingPanel.tsx  「+ 소싱처 직접 추가」 · 「소싱처 주소」 입력 (§A-2 대상)
계약 테스트  전용 1(`pivot03c-sourcing-panel`) + `workflow.test` + `stage-focus.test` +
            `wu-049r`(단계→표현 매핑) + 부수 언급 다수
🟢 backend 정책 테스트(`sourcing-candidate-policy` · `pivot03b-*`)는 §A-5 대로 **대상 아님**
```

## B-2. 🔴🔴 **B-1(본문)과 B-2(상단 단계)를 나눌 수 없다**

```
본문 소싱 UI 만 제거하면 → 상단 플로우에 **아무것도 없는 단계** 가 남는다
   ⟹ CPO §A-1 이 **금지한 상태**(「소싱 단계 때문에 남는 빈 공간 또는 잘못된 단계 번호」)
상단 단계만 제거하면 → 본문 소싱 섹션이 **갈 곳 없이** 남는다
⟹ 두 변경은 **같은 커밋에서** 가야 한다.
```

## B-3. 🔴 그래서 착수하지 않았다 — §4-B 「용량 판단은 시작 전에 한다」

```
🔴 이 변경은 **상품 탭 전체의 내비게이션 구조** 를 바꾼다. 그리고 바로 직전에
   **핵심 가격비교 루프가 Production UI PASS** 로 닫혔다(WU-056/056-R1).
🔴 그 루프를 지나는 화면의 단계 구조를, 한 세션 끝에서 CEO 확인 없이 배포하는 것은
   「작업트리를 더럽힌 채 중간에 끊기는 것이 가장 나쁘다」는 규칙이 막는 쪽이다.
🟢 그래서 **한 줄도 건드리지 않았다** — 작업트리 clean · 운영 변경 0.
🟢 대신 **파일 목록과 분리 불가 사유를 측정해 올린다**(위 B-1·B-2).
   다음 WU 는 조사를 처음부터 반복하지 않아도 된다.
```

🔴 **CPO 판정 요청** — 축 B 를 **WU-058 로 분리** 하고 그 WU 에 아래를 포함해 주십시오:

```
① 단계 제거 후의 **번호/라벨** 확정
   (① 수집 → ② 시장 판단 → ③ 등록 준비 → ④ 커머스 등록)
② `SourcingSignal` 입력과 `SOURCING_SIGNAL_NOT_STARTED` 를 **타입에서도 뺄 것인가**
   (뺀다면 CommerceWorkspace/page.tsx 배선까지 · 안 뺀다면 dead code 가 남는다)
③ `pivot03c-sourcing-panel.test.ts`(전용 계약)를 **삭제할 것인가 재범위할 것인가**
④ backend(`sourcing_candidates` · API · schema)는 §A-5 대로 **건드리지 않는다** 확인
⑤ 배포 후 CEO 1회 테스트 — 「상단에 소싱 단계 없음 + 소싱 URL 추가 UI 없음」
```

---

# 13. 최종 판정

```
축 A  🟡 **HOLD** — 원인 확정 · 전수조사 완료 · 🔴 완화 시 FP 를 증명할 수 없고
                   「브랜드 채우기」는 **더 막는다**(실증). CPO §11 HOLD 조건 충족
축 B  🔴 **미착수** — 용량 분리 요청(§4-B). 측정된 범위를 올렸다
🔴 STOP 아님 — 보안/ToS/MI 안전성 훼손 요인 없음
────────────────────────────────────────────
**HOLD** (축 A) + **분리 요청** (축 B)
```

# 14. CEO Action — **NONE**

🔴 화면이 한 픽셀도 바뀌지 않았다(운영 코드 변경 0). 축 B 가 열리면 그때 1회 필요하다.
