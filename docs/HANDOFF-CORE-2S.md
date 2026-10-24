# HANDOFF — CORE-2S (셀러 관점 UI/UX 재정비)

> 🟢🟢🟢 **CORE-2S 는 CLOSED 다**(구현·회귀·배포 완료 · 커밋 `7c331235`).
> 🔴🔴 **이 문서의 §5 「구현 순서」를 다시 실행하지 않는다** — 이미 전부 들어갔다.
> 🔴 **진입점은 `docs/START-HERE.md §6` 하나다**(그 절이 무엇이 바뀌었는지와 CEO 확인
> 7항을 들고 있다). 이 문서는 **막혔을 때 좌표를 찾는 용** 이다.
> 🟡 남은 것은 **CEO 화면 확인 1회** 뿐이고 **CTO 가 할 코드 작업이 없다**.

### 🟢 §5 구현 결과 요약 (이 문서의 지시 ↔ 실제)

```
① 문구 전수 grep        🟢 완료 — 문구↔데이터 축 표를 만들고 owner 를 특정했다
② 「1곳 ↔ 0곳」 모순 제거  🟢 블록 안 **순서 역전**(가격 → 판정) + 「🔎 동일상품 확인」 라벨
                         + 결론의 새 상태 `NO_SAME_WITH_REFERENCE`
③ 💡 가격 판단 기준 복구  🟢 신설 — 금액 0 · 내부 토큰 0 · 전부 조건부
④ 🌎 를 🇰🇷 와 같은 구조  🟢 해외 참고가격을 **1차로 이동**(2차는 `reference={null}`)
⑤ 🧾 원가 보류           🟢 신설 — 「찾지 못한 것이 아니다」까지(UNKNOWN ≠ 실패)
⑥ 후보/기술 데이터 접기   🟢 **이미 접혀 있었다**(변경 0) · 🔴 대신 그 안의 **「사진으로
                         확인해 주세요」 3곳을 제거** 했다(셀러에게 판정을 시키는 말)
⑦ AI 검색 보조 기능화    🟢 **WU-154 가 이미 닫았다**(flag 뒤 · 변경 0)
⑧ 중복 제거 · 어휘 통일   🟢 `market-verdict` 를 2차로 이동 · 금액 화면에 1회
                         🔴 **상태 어휘 넷(✓/△/—/!)은 만들지 않았다** — 기존 상태
                            컴포넌트(`SALE_STATE_TEXT` 셋)가 있고 §5-⑧ 이
                            「기존 상태 컴포넌트가 있으면 새로 만들지 않는다」고 못 박았다
⑨ 계약·변이·회귀·배포     🟢 신규 34 · 기존 4 갱신 · 변이 M1~M10 · 791 files / 9,006 passed
```

---

---

## 1. 🟢🟢 먼저 — **백엔드 트랙은 끝났다. 다시 열지 않는다**

CEO Production 확인(2026-10-24)으로 **A→E 사슬이 닫혔다**:

```
🇰🇷 국내 참고가격  KRW 88,000 · 판매처 **1곳**     ← 화면에 실제로 뜬다
🌎 해외            GBP 37 · USD 58                ← 정상
```

⟹ 🔴 **CORE-2R 트랙(수집·전달)은 CLOSED.** 아래를 **다시 조사하지 않는다**:
`국내/해외 검색 · 2-hop · SAME/MI · 가격 추출 · 시장 분류 · EXACT/COMPARISON 정책 ·
crossSeller · product code · 새 쇼핑몰 · 새 adapter · 새 AI/API`

### 그 사슬을 만든 커밋 넷 (배포 완료 · `● Ready`)
```
04d912b3  CORE-2R-4  국내 목록 2-hop 을 **다섯 번째 transient 생산자** 로 배선 + marketEvidence
eacee468  CORE-2R-5  COMPARISON 가격 → 1차 🇰🇷 블록 · computeSellability 입력 exact→resolved
bfc8537c  CORE-2R-6  Panel 이 `domesticListingEvidence` 를 **안 읽던** 버그(다섯 자리)
1027fbf1  CORE-2R-7  상한 6 이 정답 샵을 **잘랐다** → 포털 제외 후 전문몰 전수(상한 14)
배포  ttaejyo-in0nlfuzx…  ● Ready  (22:31 KST) · `/` 200 · `/pipeline` 307 · `/check` 401
```

🔴 **이 트랙에서 내가 세 번 틀렸다. 같은 함정을 다시 밟지 않도록 적는다**:
```
① 하니스에 조사 사이트를 **손으로 넣었다**(§5-B 위반) ⟹ A 를 PASS 로 착각하고
   B~E 를 코드로만 추정했다 ⟹ 「response 에 있다」는 **거짓 보고** 가 됐다
② 상한(6)을 걸어 놓고 **그 상한이 무엇을 자르는지 배포 전에 확인하지 않았다**
③ 음성대조 fixture 순서 때문에 변이 둘(M6 · N5)이 **통과** 했다
   ⟹ 🟢 셋 다 계약으로 잠갔다(`core-2r4-listing-wiring` E-1~E-5 · `core-2r5…` D-1~D-3)
```

---

## 2. CORE-2S 목적 (CPO 2026-10-24)

> **기능을 더 만들지 않는다.** 이미 확보된 데이터를 **셀러가 10초 안에 이해하고
> 다음 행동을 결정하는 하나의 의사결정 화면** 으로 압축한다.

🔴🔴 **이번 개선의 가장 중요한 포인트 한 줄** —
**「국내 참고가격 1곳」과 「동일상품 확정 0곳」은 «모순이 아니다».** 둘을 UI 에서
**분리해서 설명** 하는 것이 이 WU 의 핵심이다.

### 고정된 정보 우선순위
```
① 조사했다 → ② 🇰🇷 국내 시장가격 → ③ 🌎 해외 소싱가격
          → ④ 가격 판단 «기준» → ⑤ 판매 판단 → ⑥ 셀러가 입력할 것
```

---

## 3. 🔴 절대 변경 금지 (CPO §1 · §20)

```
SAME/DIFFERENT · MI threshold · 국내/해외 가격 수집 · 2-hop · 가격 추출 ·
시장 분류 · EXACT/COMPARISON 정책 · crossSeller · product code · 검색엔진 ·
AI API · 새 쇼핑몰 · 가격 데이터 생성 방식 · 추천판매가/마진 엔진 신규 구현 ·
🔴 **셀러에게 「다시 분석」을 요구하는 UX 추가**(기존 버튼을 새로 만드는 일도 안 한다)
```
🟢 허용 — **이미 response/state 에 있는 데이터를 UI 가 제대로 표현하지 못하는 경우의 연결 수정.**

---

## 4. 🟢 현재 UI 구조 — **좌표 확정 (재조사 금지)**

### 4-A. 렌더 트리
```
CommerceWorkspace.tsx
  :3666  <MarketPriceComparison rows / domesticReference / overseasReference />
         🔴 격자 **밖·위**(WU-140-R1 — 되돌리면 좁은 폭에서 CEO FAIL 재발)
         🔴 게이트 `stageFocus.mi !== "HIDDEN"`(없으면 커머스 탭에도 뜬다)
  :3717  <DomesticPriceIntelligencePanel …/>   ← **「상품정보」 탭에서만** 마운트
         · 데이터는 `onMarketComparisonChange` 로 위 영역에 올려보낸다
         · :3960 「🔄 다시 분석」 버튼이 **여기 있다**(삭제되지 않았다)
         · :3930 「AI 검색으로 후보 찾기」/붙여넣기 = `isSuppliedUrlInputVisible()` 가드
```

### 4-B. `MarketPriceComparison.tsx` 영역 지도
```
:177  <div data-testid="market-blocks">  🇰🇷/🌎 **1차 블록 둘**(MarketBlock)
:445  function MarketBlock
        g = buildPriceGuide(judgement, market)        ← 🔴 **SAME 만** 센다
        g.sameCount === 0 →  marketEmptyNote(…)       ← 「후보를 찾지 못했습니다」
                          +  🇰🇷 일 때 <OverseasReferencePrice summary={domesticReference}/>
                             ← 🟢 CORE-2R-5 가 여기 올렸다(KRW 88,000 이 뜨는 자리)
        g.sameCount > 0  →  price-guide-{domestic|overseas}
:375  <details data-testid="mi-detail-fold">  ▸ MI 상세 분석(**2차 · 기본 접힘**)
        :397 MarketColumn mi-same-domestic   reference={null}  ← 🔴 중복 방지(끔)
        :411 MarketColumn mi-same-overseas   reference={overseasReference}
```

### 4-C. 문구/라벨 owner (🔴 사본을 만들지 않는다)
```
overseas-reference.ts   DOMESTIC_REFERENCE_TITLE 「국내 참고가격」 · _NOTE · _SCOPE
                        TIER_LABEL  EXACT→동일상품 · COMPARISON→**유사상품** · EXCLUDED→동일상품 아님
mi-same-candidates.ts   MARKET_JUDGEMENT_TITLE 「📊 시장 판매 판단」 · marketDecisionLines ·
                        buildPriceGuide · domesticPriceBand/domesticBandText ·
                        marketPriceHeadline(+Label) · priceGuideCountNote ·
                        marketEmptyNote · pendingNote/pendingReasonNote ·
                        countMarketCandidates · countUnresolvedMarketCandidates ·
                        SAME_PRICE_LABEL 「동일상품 확인 가격」 · MI_SAME_AREA_SCOPE
match-display.ts        domesticMatchDisplay(tier 라벨 owner)
```

### 4-D. 🔴 그 영역을 잠그고 있는 **기존 계약**(건드리면 FAIL 한다 — 갱신 대상)
```
wu-056-domestic-reference        국내 블록 렌더 + 배선(이번 세션에 1회 갱신했다)
wu-056r1-price-section-identity  구역 제목 **상호 비포함** · 해외 구역 안 `₩`/`약` **0** · 아이콘 중복 금지
wu-132-mi-same-price-comparison  B-6 국내는 **1차** · 영역에 `domestic-reference` **하나뿐**
wu-139 / wu-144 / wu-145 / wu-146 / wu-148 / wu-141-r3
        · 「평균」은 **부정문으로만**  · 「시장 참고가격」 리터럴 **0**
        · 그 영역에 **`₩` 금지**(CAD 64 가 「약 ₩64」로 뜬 실측 때문)
        · 후보 구역 기본 **접힘**(`open` 금지) · 가격 숫자 **중복 금지**
wu-130 F-3/F-4                   제목 **하나** · 그 영역에 집계/판정 어휘 **0**
core-2r5-domestic-reference-to-mi  A-1~A-7 · B-1~B-5 · C-1~C-2 · D-1~D-3 (이번 세션 신규)
core-2r4-listing-wiring            A-1~A-6 · B-1~B-12 · C-1~C-5 · D-1~D-7 · E-1~E-5
```

---

## 5. 🔵 구현 순서 (CPO §18 산출물 → 구현)

```
① 현재 화면 **문구 전수 grep**(CPO §4) — 아래 아홉을 한 번에 본다
   국내 경쟁상품 · 국내 동일상품 · 국내 후보 · 국내 판매처 · 국내 참고가격 ·
   국내 가격 없음 · 국내 데이터를 찾지 못함 · 경쟁상품 없음 · 동일상품 없음
   🔴 각 문구가 **어느 데이터 축** 인지 표로 적고, 축이 다르면 UI 에서 **분리** 한다
② 「국내 1곳 ↔ 동일상품 0곳」 모순 제거 —
     🔎 동일상품 확인 : 확정 0곳      /      가격 참고자료 : 국내 참고가격 1곳
③ **💡 가격 판단 기준** 영역 복구(CPO §3-C · §5) — 내부 토큰 금지, 자연어로
④ 🌎 해외 블록을 🇰🇷 와 **같은 정보 구조** 로(통화별 최저 · 합치지 않는다)
⑤ 🧾 현재 판단 — 원가 없으면 「**수익성 판단 보류 · 원가 입력 필요**」
   🔴 「데이터 없음」처럼 보이지 않게 한다(UNKNOWN ≠ 실패)
⑥ 후보/Source Data/추출 필드/내부 매칭을 **접거나 하단** 으로(결과 → 근거 → 상세)
⑦ 「AI 검색으로 후보 찾기」를 **보조 기능** 으로 정리(자동 분석을 대체하지 않는다)
⑧ 중복 제거 전수 · 상태 어휘 넷 통일(✓ 확인됨 / △ 일부 / — 확인 안 됨 / ! 보류)
   🔴 **기존 상태 컴포넌트가 있으면 새로 만들지 않는다**
⑨ 계약 갱신(§4-D) + 변이 + 회귀 + typecheck + build + 배포 → **CEO 최종 1회**
```

🔴 **CEO 중간 테스트 금지.** 🔴 §18 구조표를 만든 뒤 구현한다(별도 승인 요청 없이).

---

## 6. 🔴 지켜야 하는 표시 규칙 (CPO §11~§14)

```
🇰🇷  `KRW 88,000`      🔴 `₩88,000` 로 **임의 변경 금지**(계약 6건이 그 영역의 `₩` 를 막는다)
🌎  `GBP 37` · `USD 58` 🔴 **통화를 합쳐 하나의 범위로 만들지 않는다** · 환산은 보조일 뿐
범위 1곳 → **단일 참고가격** · 2곳 이상 **서로 다른 금액** 일 때만 `A ~ B`
    🟢 owner 는 `domesticPriceBand`(같은 금액 둘은 BAND 가 아니다 · WU-139 B-2)
어휘 `COMPARISON`·`PRESUMED_SAME`·`EXACT`·`TEXT_CONFIRMED`·`crossSeller` **노출 금지**
    🔴 현재 88,000 은 **COMPARISON 근거** 다 ⟹ 「동일상품 확정가격」으로 적지 않는다.
       기본 명칭은 **「국내 참고가격」**(= 기존 `DOMESTIC_REFERENCE_TITLE`)
```

---

## 7. 🔴 알려진 함정 (이 저장소에서 실제로 밟은 것)

```
① 소스 문자열 검사는 **주석을 벗기고**(여덟 번 걸렸다)
② 화면은 **마운트 DOM** 으로만 완료 선언(Render PASS ≠ 소스 PASS) ·
   `.test.tsx` 는 vitest 가 수집하지 않는다 → `.test.ts` + `createElement`
③ 단언 좌표 — 같은 이름이 **조건줄에도** 있으면 펼침 줄을 지워도 통과한다(M6 실측)
④ 금지 리터럴을 넣으면 **필수 부정문**(「시장 평균가가 **아닙니다**」)이 FAIL 한다
   ⟹ 「평균은 부정문으로만」 식으로 범위를 좁힌다
⑤ 속성 위치에 `{/* */}` 주석 금지(세 번 밟았다) · `&&( … )` 안 주석은 JSX 를 깨뜨린다
⑥ `python3` 없음 · 정규식/코드를 쉘로 편집하지 않는다(**Edit 툴로만**)
⑦ 회귀 baseline — `packages/crawler/.../p54c1-grounding-redirect` **1 failed 는 무관**
   (CPO 합산 제외) · 전수 기준선 **790 files / 8,971 passed**
⑧ `docs/core-2m-visual-review.html` 은 회귀가 **재생성** 한다 → 커밋 전 `git checkout --`
```

---

## 8. 완료 기준 (CPO §19 · §22)

```
PASS  🇰🇷 KRW 88,000 · 판매처 1곳 · 🌎 GBP 37/USD 58 분리 ·
      「국내 1곳 ↔ 동일상품 0곳」이 **혼동되지 않음** · 가격 판단 기준 **복구** ·
      원가 없음 → **판단 보류 + 원가 입력 필요** · 중복 0 ·
      셀러에게 재분석/후보검색 **요구 0** · MI/가격 데이터 결과 **불변**
FAIL  국내 가격이 있는데 「없음」처럼 보임 · 통화 합산 · 내부 MI 토큰 노출 ·
      같은 가격이 여러 영역에 반복 · 셀러가 후보를 골라야 판단이 되는 구조
```

---

## 9. 보고 형식 (CPO 지정 14항)

`1 문제목록 · 2 변경 전→후 정보구조 · 3 변경 파일 · 4 seller-facing 변경 ·
5 데이터/판정 변경 여부 · 6 중복 제거 · 7 가격 판단 기준 복구 · 8 typecheck ·
9 build · 10 regression · 11 commit · 12 deploy · 13 Production 상태 ·
14 CEO 최종 테스트 URL + 1회 시나리오`

🔴 **「코드상 정상」·「하니스 PASS」·「배포 Ready」를 Production 화면 PASS 의 증거로 쓰지 않는다.**

---

## 10. 첫 명령 (복붙)

```bash
cd /c/Users/김성길/Documents/GitHub/commerce-platform
git fetch origin --quiet && git status && git rev-list --left-right --count origin/main...HEAD
# ① 문구 전수 grep (CPO §4) — 재조사 없이 바로 시작
grep -rn "국내 경쟁상품\|국내 동일상품\|국내 후보\|국내 판매처\|국내 참고가격\|동일상품 없음\|경쟁상품 없음" \
  --include=*.ts --include=*.tsx apps/admin/src/app/pipeline | grep -v __tests__
# ② 좌표는 이 문서 §4 에 있다 — 파일을 처음부터 읽지 않는다
```
