# TTAEJYO — 작업 헌장 (CEO 확정 2026-09-28)

> 🔴 **모든 세션에 자동 적용된다.** 새 세션은 이 문서를 읽은 상태로 시작하므로
> 여기 있는 것을 다시 묻지 않는다. 스프린트별 지시서는 `docs/` 에 있다.

---

## 1. 제품 방향

> **「따져보고 판매하라.」**

상품을 «많이 등록하는 것» 이 목적이 아니다.

```
해외 상품 발견 → 상품 사실 확인 → 시장/가격/수익성 판단
→ 판매 가능 여부 판단 → Commerce 등록
```

제품의 중심은 **Product** 이고 **Commerce 는 출력/배포 수단**이다.
Commerce 는 20~30개+ 로 늘어나며, 늘수록 셀러의 관리 부담은 «줄어야» 한다.

---

## 2. 현재 실행 순서

🔴 **장기 철학과 단기 실행 순서를 혼동하지 않는다.** 「MI 정확도 → 카테고리 확대
→ 추가 Commerce」는 **이전 시점의 순서**이고, 현재는 아래로 재정렬돼 있다.

```
① 아동의류
② SmartStore / Coupang / LotteON 3개 Commerce 완성      ← 지금 여기
③ 실제 등록 루프에서 «필요한» MI/Common 기능만 보완
④ 아동의류 Commerce 안정화 후 다음 카테고리
⑤ 카테고리별 실제 상품 검증
⑥ 추가 Commerce 채널 확대
```

「추가 Commerce 는 마지막」 원칙은 유지된다 — 지금은 그 이전 단계인 3채널
안정화 구간이다. **현재 스프린트는 Coupang UPDATE 를 끝까지 닫는 것이다.**

---

## 3. 역할

### CEO — 최종 의사결정자

제품 방향 · 우선순위 · 사업/정책/규제 결정 · **실제 Production 최종 UI 확인**.

🔴 CEO 가 하지 않는 것: SQL 실행 · 코드 수정 · 테스트 실행 · Git · 배포 ·
중간 디버깅 · 개발환경 설정. **CTO 가 할 수 있는 일을 CEO 에게 넘기지 않는다.**

### CPO (GPT) — 기획 · 구조 · 검토

범위와 P0/P1/P2 확정 · 작업지시서 · Common/Master/Commerce 경계 검토 ·
CTO 보고 검증 · **PASS / REWORK / HOLD 판정**.

🔴 CPO 는 코드를 설계해 CTO 에게 강요하지 않는다. CTO 가 실제 코드에서 더 정확한
구조를 발견하면 그것을 채택하되, **제품 정책과 안전 경계는 CPO 가 결정한다.**

### CTO (Claude) — 조사부터 Production 증거까지

조사 → 구현 → 테스트 → negative test → typecheck → build → commit → push →
deploy → Production 증거 → 보고. 단순 코더가 아니다.

🔴 **한 번 시작하면 가능한 범위까지 자율적으로 끝낸다.** 「이렇게 할까요?」
「이 파일을 수정해도 될까요?」「테스트해볼까요?」를 반복하지 않는다.

### 🔴 Commerce 운영은 CEO 의 일이 아니다 (CPO 확정 2026-09-29)

따져의 일은 **「이 상품을 이 Commerce 에 등록할 수 있는가」를 판단하고 등록까지
처리하는 것**이다. **Commerce 고객센터에 문의하는 것은 따져의 기능이 아니다.**

```
❌ 필드 코드를 모르겠다        → CEO 가 채널에 문의
❌ API 가 무슨 값을 원하는지 모르겠다
❌ 공통코드가 있는지 모르겠다
❌ payload 구조를 모르겠다
✅ 위 넷은 전부 CTO/CPO 의 «조사» 문제다. 공개 자료를 끝까지 파고,
   그래도 모르면 따져 «안에서» UNKNOWN 으로 표시한다
```

모르는 것은 넘기지 않고 **네 상태로 갈라 표시한다**:

```
자동 입력 가능 · 셀러 확인 필요 · Commerce 정책 확인 필요 · 등록 불가
```

🔴 **「외부 확인 필요」라는 이유만으로 개발을 멈추지 않는다.** 등록 엔진은 멈출 필요가
없다 — 확인 못 한 항목만 차단 표시하면 된다.

CEO 에게 올리는 것은 **진짜 사업적 의사결정** 하나다 — 예: 「이 Commerce 가 해당
상품군 판매 자체를 허용하지 않는다」. 그건 채널 개폐 판단이다.

### STOP 조건 (이때만 멈춘다)

```
정책 결정 필요 · Architecture 경계 불명확 · DB schema 의미 불명확
보안/규제 위험 · Production destructive action 직전
CEO 의 사업적 승인 필요(채널/상품군 개폐 같은 «사업» 결정)
```

게이트: **CTO 1차 → CPO 2차 → CEO 최종.** CTO→CEO 직행 금지.
전문은 `docs/TTAEJYO-VERIFICATION-GATE.md`.

---

## 4. 작업 방식 — TOKEN-SAVER

```
조사 → 최소 변경 → 테스트 → 음성 대조 → 전체 회귀 → 배포 → Evidence → 보고
```

🔴 금지: 이미 조사한 것 재조사 · 관련 없는 리팩터 · 파일 대량 변경 · 미래 기능
선행 구현 · 새 abstraction 남발 · 「혹시 모르니까」 DB migration · 근거 없는 자동화.

### 🔴 부분 구현으로 화면이 거짓말하게 만들지 않는다

```
❌ 기능 일부 구현 → 화면에 「지원」 표시
✅ backend → orchestration → adapter → UI → 실제 API → Production 검증
   «전부» 연결된 뒤에 capability 를 올린다
```

Coupang 에서 capability 를 먼저 올렸다가 기존 가드 22개가 잡은 것이 이 이유다.

---

## 5. 테스트 기준

「정상 케이스 PASS」는 테스트가 아니다. 넷을 모두 본다.

| 축 | 확인하는 것 |
|---|---|
| Positive | 정상 동작 |
| Negative | 잘못된 동작이 «차단되는가» |
| Voice / Mutation | 보호장치를 일부러 제거하면 «실패하는가» |
| Regression | 기존 기능이 깨지지 않는가 |

```
정상 코드      32/32 PASS
보호 조건 제거  8 FAIL      ← 가드가 살아 있다는 증거
원상복구       PASS
```

🔴 소스 문자열 검사는 **주석을 벗기고** 한다(여덟 번 걸린 함정).
🔴 화면은 **마운트한 DOM** 으로만 완료 선언한다 — Render PASS ≠ 소스 PASS.

### 🔴🔴 5-B. «측정» 에는 선행 검증 절차가 있다 (CPO 확정 2026-10-12)

위 넷은 **기능** 테스트의 축이다. 숫자를 재서 전략 판단에 쓰는 **측정** 에는
그 앞에 게이트가 하나 더 있다. 🔴 이 절차는 스프린트와 무관하게 **항상** 유효하다.

```
Production owner 확인
      ↓
ownerGate         운영 owner 가 낸 값 == 내가 쓴 입력으로 다시 부른 값
      ↓
CONTROL 선정      Production 이 «이미» 결과를 만든 입력을 표본에 섞는다
      ↓
replicationGate   복제식이 실제 verdict 를 전건 재현  expect(mismatch).toBe(0)
      ↓
Production 결과 재현
      ↓
본 측정
```

#### 🔴🔴 CONTROL 의 «통과 조건» (CPO 불변기준, 2026-10-12)

```
❌ CONTROL 통과 = 「후보가 나왔다」 · 「응답이 왔다」 · 「함수가 돌았다」
✅ CONTROL 통과 = **운영이 낸 «그 값» 이 재현된다**
   예: tier 를 재는 측정이면  `tier === expectedTier`
       verdict 를 재는 측정이면 `verdict === 운영 verdict`
```

🔴 **「돌았다」를 통과로 쓰면 게이트가 통과하는데 측정이 틀린다.** 실증:
한 WU 에서 `controlGate` 를 「후보를 냈다」로 세워 **통과시켰고**, 뒤에 운영 DB 와
대조해 보니 **내가 고른 (상품, 샵) 조합에 애초에 정답이 없었다**(정답 샵이
등록부에서 disabled 였고, 다른 상품은 «다른 색상» 이었다). 그 측정의 「SAME 0」을
**전부 무효 처리** 해야 했다.

🔴 **CONTROL 이 실패하면 그 숫자를 전략 판단에 쓰지 않는다.**
🔴 단 실패를 곧바로 하니스 결함으로도 제품 결함으로도 **단정하지 않고** 순서대로
   가른다 — **호출 경로 → 설정 상태 → 입력 → Production 결과.**
   (실례: `bobochoses.com` 이 등록부 disabled 라 CONTROL 2건이 재현 실패했다.
    하니스 결함이 아니었다.)

🔴 **두 축이 «같은 대상» 을 보는지 확인한다.** 실증: 독립 라벨(Vision)을
   `scored[0]` 에 돌리고 tier 는 운영이 고른 **대표 후보** 기준으로 재서
   **서로 다른 후보를 비교** 했다 — 그 결과 「EXACT FP 1건」이 거짓으로 나왔다.
   owner 가 고른 대상(`DomesticJudgement.JUDGED.best` 같은 칸)을 **타입에서 읽어**
   쓴다. 🔴 그리고 owner 가 이미 내놓은 값(`priceTier`)이 있으면 **복제 계산하지 않는다.**

**왜 필요한가.** 한 트랙에서 「운영 경로를 한 단계 빠뜨렸다」가 **여덟 번** 났고
일곱 번은 **사후** 발견이었다. 여덟 번째만 CONTROL 이 **사전에** 잡았다 —
`searchDomesticShops + withConfidence` 까지만 불렀는데 운영은 그 뒤에
`judgeDomesticCandidate`(게이트 + `fetchDomesticModelCode`)가 더 있었다.
🔴 그리고 그 누락 때문에 MI-P0-03~08 의 verdict 숫자가 전부 과소였다(126쌍).

### 🔴 「측정불가」는 0% 가 아니다

```
❌ ground truth 가 없는 값을 「0%」·「없음」·「후보 없음」으로 적는다
✅ **측정불가** 로 적고 분모가 왜 없는지 같이 쓴다
```

🔴 그리고 표본 기반 숫자는 **그 숫자가 나오는 모든 줄에 `sample N=x`** 를 적는다.
전수와 표본을 같은 표에 섞지 않는다. 호스트당 대표 1건 추정을 전수처럼 쓰지 않는다.

🔴 보고 전 3문 — ① 전수인가 표본인가 ② 그 숫자가 «다음 단계» 를 통과했는가
③ 거부 / null / 0 을 「올바른 부재」로 가정했는가. 하나라도 「아니오」면 먼저 잰다.

---

## 6. PASS 등급 — 반드시 구분한다

| 등급 | 의미 |
|---|---|
| Code PASS | 코드 구현 완료 |
| Test PASS | 테스트 완료 |
| Type PASS | tsc 완료 |
| Build PASS | build 완료 |
| Deploy PASS | Production 배포 완료 |
| Production UI PASS | 실제 Production UI 확인 |
| Production API PASS | 실제 외부 API 실행/응답 확인 |
| Production PASS | 필요한 전체 Production 검증 완료 |

🔴 **「테스트 PASS」를 「Production PASS」로 쓰지 않는다.**
실제 외부 호출 전에는 `Implemented / Not Production Verified` 다.

---

## 7. CTO 최종 보고 양식 (18절)

```
1 Scope          2 변경 내용       3 조사 결과      4 구현 결과
5 Data/DB        6 Payload         7 UI/Render      8 Positive Test
9 Negative/Mutation  10 Regression  11 Typecheck    12 Build
13 Commit/Push   14 Deploy         15 Production Evidence
16 External API Evidence           17 Known Unknowns  18 Final Gate
```

마지막에 반드시:

```
Code PASS:            Deploy PASS:
Test PASS:            Production UI PASS:
Type PASS:            Production API PASS:
Build PASS:           Production PASS:
```

---

## 8. Git

```
git status → 테스트 → typecheck → build → commit → push → deploy
→ production 확인 → git status
```

작업트리는 최종적으로 **clean**. commit 은 스프린트 단위로 의미 있게.
🔴 **push 까지 끝나야 CTO 완료다** — 로컬 commit 으로 끝내지 않는다.

### 🔴 WORKTREE CLEAN ≠ REMOTE SYNCED

`git status` 는 커밋되지 않은 변경만 본다. **커밋만 해도 clean 이 된다.**
실제로 이 규칙이 조용히 무력화돼 **커밋 15개가 clean 상태로 밀려 있었다**(2026-09-28).
실전에서 검증된 규칙이다 — 추정이 아니다.

CTO 완료 기준은 «둘 다» 다:

```bash
git fetch origin --quiet          # 로컬 ref 가 낡으면 아래 숫자도 틀린다
git status                        # → clean
git rev-list --left-right --count origin/main...HEAD
                                  # → 0       0
                                  #   behind  ahead
```

종료 보고의 Git 절에는 clean 여부와 **ahead/behind 숫자를 같이** 적는다.
「clean」만 적는 것은 완료 보고가 아니다.

🔴 push 가 Production 배포를 부르므로, 밀린 커밋을 발견하면 임의로 밀지 말고
CEO 판단을 받는다. 밀 때는 커밋 메시지의 「테스트 통과」를 믿지 말고 **직접 실행**한다.

🔴 **`clean` · `push` · `deploy` · `Production PASS` 를 같은 의미로 취급하지 않는다.**
배포는 **repo 루트에서만** 실행한다(Bash 의 `cd` 가 PowerShell 작업 디렉터리에 남는다).

---

## 9. 배포

`Deployment successful` 만 보고하지 않는다. 최소 — Production HTTP 200 ·
필요한 route 확인 · 핵심 UI/endpoint 확인 · 기존 기능 regression 확인.

실제 Production 기능을 확인하지 않았다면 **`Production Ready` 까지만** 쓴다.

---

## 10. Production Token / Secret

🔴 Production Sensitive 값은 **읽을 수 없다**(`vercel env pull` 도 빈 문자열).

### 절대 하지 않음

기존 Production secret 을 대화로 전달 · service-role key 를 CEO 에게 요구 ·
token 값을 보고서에 출력 · token 을 소스에 hardcode · debug token 장기 유지.

### 1회용 토큰 수명주기

```
① CTO 가 1회용 token 생성        ② Production Sensitive env 등록
③ 해당 debug/probe route 에만 사용 ④ 실제 GET/PUT 수행
⑤ 필요한 데이터만 반환            ⑥ token 즉시 폐기
⑦ route 삭제                     ⑧ 재배포
⑨ 삭제 증명 — source + deployment (아래)
⑩ 환경변수 잔존 확인
```

증명이 토큰에 의존하지 않으므로 **토큰은 ⑥에서 가장 이르게 폐기한다.**

🔴 **토큰은 스프린트 시작에 발급하지 않는다.** 실제 write 실측 «직전» 에 발급한다.

### 🔴 ⑧ — HTTP 상태코드를 삭제 증거로 «단독 사용하지 않는다» (2026-09-28 실측)

미들웨어가 `/api/*` 전체를 인증 앞단에서 막는다. **존재하지 않는 라우트도 401 이다.**

```
/api/실존 route      → 401
/api/없는 route      → 401     ← 401 은 route existence 와 «무관» 하다
```

실측: `/api/coupang/zzz-not-a-route-9x8y7z` → 401 ·
`/api/coupang/registered-product` → 401 (소스에 «없음» 이 확인된 라우트).

🔴 **「401 이면 삭제 확인」을 사용하지 않는다. unauthenticated 404 도 증거가 아니다.**
이 프로젝트의 `/api/*` 인증 middleware 구조에서는 둘 다 유효한 삭제 증거가 아니다.

대신 **source + deployment 기준**으로 판단한다:

```
① 소스에서 route 파일 / registry 존재 여부 확인
② 해당 route 의 호출 참조 제거 확인
③ 배포된 커밋 기준으로 ①②를 재확인
④ 인증 가능한 최소 probe 가 «필요하면» 보조로 수행 — 단독 증거로 쓰지 않는다
```

---

## 11. 외부 API 실측 순서

```
GET / read-only → baseline 확보 → 최소 변경 → PUT/POST
```

write 테스트 범위: 기존 데이터 **1건** · 영향 범위가 작은 필드 · 사전 baseline ·
실행 후 GET · 결과 대조 · rollback 가능성 확인.

---

## 12. 현재 상태 — MI 측정 트랙 **전부 종료** (갱신 2026-10-12)

🔴 **새 세션은 MI 측정을 처음부터 반복하지 않는다.** 아래가 기준선이다.
🔴 **착수점이 아니다.** 종료된 결론 모음이다. 새 범위는 CPO 가 준다.

```
🟢 MI-P0-03 ~ MI-P0-12 · MI Coverage WU «그리고» 그 뒤 롱스프린트 셋까지
   **전부 종료** 됐다. 전 구간 판정: HOLD / CHANGE DIRECTION.
   🟢 Production 코드 변경 **0** · DB 변경 **0** (전 트랙 합계).
🔴 커밋 34개를 «다시 해석하지 않는다» — 결론만 기준선으로 쓴다.
🔴 MI 쪽 코드 실험을 더 돌리지 않는다. 다음 과제는 코드가 아니다.
```

### 🟢 종료된 롱스프린트 넷 — 결론 한 줄씩 (전문은 각 문서)

| WU | 판정 | 🔴 한 줄 결론 |
|---|---|---|
| 국내 SAME Coverage<br>`docs/DOMESTIC-COVERAGE-WU-STATE.md` | CHANGE DIRECTION | Coverage 를 늘리는 것이 핵심 레버라는 **증거가 없다** |
| MI Discovery → Identity<br>`docs/MI-DISCOVERY-IDENTITY-WU-STATE.md` | HOLD | External Discovery 에는 **운영 호출부가 없다**(counterfactual) |
| MI Price Enrichment<br>`docs/MI-PRICE-ENRICHMENT-WU-STATE.md` | HOLD | 후보 가격은 전부 **해외 통화·해외 판매처** 라 국내 축에 못 들어간다 |
| 해외 매입가 Sourcing Value<br>`docs/MI-SOURCING-VALUE-WU-STATE.md` | HOLD | 🔴 **우리는 이미 원가를 갖고 있다 — 397/397** |
| Discovery Value Reframing<br>`docs/MI-REFRAME-WU-STATE.md` | CHANGE DIRECTION | 🔴 **병목은 Discovery 가 아니라 «재관측» 이다** |
| Re-observation Value<br>`docs/MI-REOBSERVATION-WU-STATE.md` | **GO CANDIDATE**(조건부) | 🟢 재관측은 실제로 새 정보를 만든다 — 🔴 단 선행조치 둘 |
| Cadence & Economics<br>`docs/MI-CADENCE-ECONOMICS-WU-STATE.md` | **GO · 2~3일** | 🟢 1일은 비효율 · 7일은 너무 느리다 (🔴 「cron 개발 GO」가 아니다) |
| **MI Core E2E**<br>`docs/MI-CORE-E2E-WU-STATE.md` | **PARTIAL GO** | 🟢 계산 사슬은 작동한다 — 🔴 끊기는 곳은 «입구» 하나 (55/498 = 11.0%) |

### 🟢🟢 여덟째 WU — 핵심 KPI 가 정해졌다: **55/498 = 11.0%**

> 「상품 하나를 넣으면 국내/해외 같은 상품을 찾아 가격을 비교할 수 있는가」 → **PARTIAL**

```
퍼널(전수 N=498)  원상품 498 → 국내 링크 69 → EXACT tier 58 → 국내가 67
                  → 해외 관측 397 → 둘 다 64 → 🟢 **COMPARABLE 55**
끊기는 자리       NO_LINK_AT_ALL **331** · NO_EXACT_LINK 11 ·
                  NO_OVERSEAS_PRICE 2 · NO_DOMESTIC_PRICE 1
🟢 뒤집어 읽으면 — **링크가 있으면 69→55 = 79.7% 가 비교된다.**
   즉 계산 사슬은 작동하고 병목은 «입구» 다.
🟢 비교 결과도 의미가 있다 — 국내 최저가가 해외보다 **중위 +17.0%**
   (국내가 5%+ 비쌈 36 · ±5% 17 · 국내가 더 쌈 2 · 55/55 둘 다 숫자 있음)
```

🔴🔴 **E2E 경로 넷 중 운영에 실재하는 것은 «하나» 다**(전수 확인, 추측 아님):
```
A 국내 URL 직접 입력  🔴 **없다** — links 는 GET/PATCH 뿐 · search POST 는 title 필수
B 해외 URL 직접 입력  🔴 **없다** — 같은 이유
C 국내 후보 탐색      🟢 있다 — searchDomesticShops → withConfidence → judgeDomesticCandidate
D 해외 AI Discovery   🔴 운영 호출부 0 (counterfactual)
🟢 MANUAL 은 «샵» 수집전략이고 상품 URL 입력이 아니다(DomesticSourceCollectionStrategy)
🔴 A/B 성능은 0% 가 아니라 «측정 자체가 불가능» 하다
```

🔴 **병목의 상한은 브랜드의 국내 유통 여부다** (전수 498 / 브랜드 32):
```
🔴 국내 링크가 «한 건도» 없는 브랜드 **26개** → 상품 **204**(41%)
🟢 링크가 있는 브랜드 6개 → 상품 294, 그중 링크 보유 **69 = 23.5%**
  Pèpè Shoes 50중31 **62%** 🟢 / Bobo Choses 167중28 17% / AW26 44중4 9%(브랜드 아님)
  Sergio Tacchini 27중0 🟢(테니스 — 0 이 맞다) / 빈 브랜드 25중0 🔴
🔴 즉 NO_LINK 331 은 두 층 — ①브랜드가 국내에 없다 204 ②검색이 못 찾았다 ~127
   ①을 「검색 실패」로 읽으면 틀린다
```

🟢 **UI 는 가격 의미를 이미 구분한다**(내가 P0 로 올렸다가 반증됐다):
```
costBasis → costBasisIsKrMarket(Panel:2362) → price-hierarchy.ts:453 이
라벨과 기준 문장을 통째로 바꾼다 — 「이 판매처가 한국 방문자에게 직접 보여주는
가격 · **환율 환산이 아닙니다**」 · landedCostComposition 도 갈린다(:535)
🔴 그래서 「해외 축이 한국 표시가라 셀러가 오해한다」는 **결함이 아니다.**
   남는 사실은 COMPARABLE 55 중 42가 KRW/KR_MARKET 이라는 **데이터 구성** 이고
   원본 시장가(ORIGIN_FX)가 함께 있는 것은 10/55 다. 🔴 이유는 미조사.
```

🔴 **P0-1 로 남은 것** — 셀러가 상품 URL 을 직접 넣어 비교후보로 등록할 수 없다.
이 WU 에서 **구현하지 않았다**: `domestic_product_links.source_id` 가 **등록된
샵을 가리키는 FK** 라 임의 URL 을 넣으려면 **샵 등록부 의미**를 바꿔야 하고,
그것은 Registry 구조 변경(CPO §15 금지)이다 → **별 WU**.

🔴 어휘 함정 둘 (내가 추측해서 틀렸다):
```
❌ match_truth='SAME_PRODUCT'  → 그 어휘는 **없다**. MatchTruth(match-truth.ts:33) 는
   EXACT_IDENTIFIER | STRONG_IDENTIFIER | TEXT_CONFIRMED | SIMILAR | CONFLICT | …
❌ product_snapshots.canonical_product 칸 → **없다**. 실제는 `workspace`(jsonb)
   → workspace->'canonicalProduct'->'brand'->>'value'
🟢 tier 는 priceTierFromLink(domestic-product-link.ts:86)를 «호출» 한다(복제 금지)
```

### 🟢🟢 일곱째 WU — 최적 관측 주기는 **2~3일** 이다

🔴 **잴 수 있는 것을 먼저 갈랐다** — 다운샘플링(늦추면 무엇을 잃는가)은 데이터
안에서 가능하고, 「더 촘촘히 봤다면」은 **상향 외삽이라 측정불가** 다.

```
주기   관측수  비용비  변화상품  유지율   평균지연   🔴비가역손실   효율
1일    364    100%     51    100%     0일        0      1.00x
2일    211     58%     48   94.1%   0.08일      46      1.62x
3일    172     47%     43   84.3%   0.49일      74   **1.78x** ← 최고
7일    121     33%     24   47.1%   2.96일     115      1.42x
                                          (sample N=93 상품 / 271쌍)
🟢 CPO 가설 지지 — 1일 → 2일: 비용 **42% 절감** ↔ 변화상품 **6%만** 손실
🔴 7일은 탈락 — 변화상품 **53% 손실** · 지연 3일
🔴 2일도 「무손실」이 아니다 — 구별되는 가격 상태 236 → 190 (46개를 영구히 못 본다)
```

🔴 **2일 ↔ 3일 최종 선택은 CPO/CEO 몫** 이다 — 금액 비용이 **측정불가** 이기 때문이다
(외부 API 요금을 CTO 가 읽을 수 없다). 판단 기준 한 줄:
```
비용이 제약이면 → **3일** (월 4,970회 · 효율 1.78x · 유지율 84%)
정확도가 제약이면 → **2일** (월 7,455회 · 효율 1.62x · 유지율 94%)
전수 497 기준 월 실행수  1일 14,910 · 2일 7,455 · 3일 4,970 · 7일 2,130
🔴 상품당 외부 요청 최소 3회 (원산지 1 + probeAdditionalMarkets 2시장, :341)
🟢 현재 실적은 상품당 1.68회/41일 = 사실상 주기 **24일** 이다
```

🔴 **해석 함정 — 간격별 변화율을 주기 근거로 단독 사용하지 않는다**:
```
실측 1일 224쌍/42.4% · 2일 16/81.2% · 3일 12/100% · 6일 14/57.1%
🔴 간격이 길수록 변화율이 오르는 것은 «당연» 하고, 더 중요하게는
   **가격이 변했으면 2일 뒤에 봐도 여전히 다르다** — 늦게 봐도 같은 변화를
   놓치지 않는다. 주기가 실제로 결정하는 것은 ①지연 ②비가역 손실 둘이다.
```

🔴 **cron 전에 남은 선행조치 둘**(이 WU 가 해결하지 않았다) — §12 의 ③-2 · ③-3 이다.

### 🟢🟢 여섯째 WU — 재관측은 «가치가 있다». 단 GO 가 아니라 GO CANDIDATE 다

```
🟢 Before/After 반사실 (sample N=94 — 재관측이 실제로 있었던 상품만)
   새 신호가 생긴 상품 **42/94 (45%)** · incremental information/product **0.45**
   verdict  NO_NEW_INFORMATION 52 · PRICE_CHANGE 33 · FALSE_SIGNAL 8 · ACTIONABLE 1
   🔴 신호가 «사라진» 상품도 3건 있다 — 재관측은 정보를 지우기도 한다
🟢 변화 품질 정합성 42 = 환율기인 7 + 혼재축 1 + 🟢단일축 실가격 34 → 유효 **81%**
🔴 actionable signal/product 는 **0.011** (1/94) — 낮다
🔴 1일만 관측된 306건은 반사실을 만들 수 없다 → **측정불가**(0% 가 아니다)
```

🔴🔴 **이 WU 가 찾은 구조적 상한 둘** (cron 을 짜기 전에 알아야 한다):
```
① 시계열 해상도 상한이 「일」 이다 — hasObservationToday(run-price-check:242) 가
   (snapshot, source, 날짜) 로 멱등을 잡는다. 🔴 **하루보다 짧은 cron 주기는 무의미** 하다
   (코드가 버린다). 「시간 단위 감시」의 가치는 이 구조에서 측정 자체가 불가능하다.
② bulkRecheck(today/page.tsx:156) 가 `status !== "REGISTERED"` 로 등록 상품을 제외한다
   🔴 단 **지금은 영향 없다** — 실측 반증: IN_PROGRESS 평균 관측일 1.35 ·
      REGISTERED 1.36 (n=33). 내 가설이었고 데이터가 부정했다.
```

🔴 **GO CANDIDATE 의 선행조치 둘** (둘 다 제품 정책 경계 → CPO 판정):
```
① 환율 기인 변화 7/42(17%) — computePriceChange 는 priceKrw 만 본다. 원통화 금액이
   같아도 변화가 난다. 🔴 **결함으로 단정하지 않는다** — 셀러가 지불하는 통화는 KRW
   이므로 「KRW 기준 원가가 올랐다」는 참이다. 문제는 **문구가 「해외 비교가격」이라고
   말하는 것** 이다(seller-action.ts:131/137).
② 과거 혼재 스냅샷 4건 — 자동화하면 그 4건에 새 행이 붙어 거짓 신호가 다시 날 수 있다.
   별 과제 `Historical Alert Integrity` 로 분리됐다(재관측 가치와 **합산 금지**).
```

🔴 **Availability 는 GO 근거가 아니다 — 측정불가다**:
```
seller-action.ts:117 의 soldOutCount 는 **DOMESTIC_SHOP 행만** 센다.
그런데 DOMESTIC_SHOP 279행 중 sold_out=true 가 **0행** 이다(false 166 · null 113).
→ 🔴 「경쟁상품 품절」 신호는 **구조적으로 발화 불가** 다.
🔴 「국내에 품절이 없다」가 아니라 «국내 어댑터가 품절을 true 로 적은 적이 없다» 다.
🟢 SELLER_ORIGIN 에는 sold_out=true 가 319행/66스냅샷 있고 원가 선택에 쓰인다.
🔴 그 0행의 «이유» 는 미조사다 — 어댑터 문제인지 실제 부재인지 추측하지 않는다.
```

🔴 비용은 **금액 측정불가**(외부 API 요금을 CTO 가 읽을 수 없다). 실행 수만:
```
현재 실적  41일 / 673회 / 상품당 **1.68회**
전수 497 기준  매일 월 14,910 · 2일 7,455 · 3일 4,970 · 주1회 2,131
```

### 🔴🔴 다섯째 WU 가 찾아낸 것 — 이 문장을 그대로 쓴다

```
시장 변화 감지(Newness / Price Trend / Availability)의 병목은 Discovery 가 아니다.
🟢 사슬은 **끝까지 배선돼 있다** — computePriceChange/Trend/AlertSignal →
   computeSellerAction → computeMarketAlert → DB price_alerts → UI.
🔴 그런데 **입력이 없다.** 관측 날짜가 1일인 스냅샷이 304/400(76%)다.
🟢 용량-반응이 단조 증가한다 (FULL POPULATION n=400):
     1일 **0.0%** → 2일 21.6% → 3일 50.0% → 4일+ **65.0%**
   → 「가격이 안 변한다」가 아니라 «우리가 다시 보지 않는다» 다.
🟢 재관측 기능은 **이미 있다** — 「가격 일괄 확인」(today/page.tsx:151, 동시성 3).
🔴 없는 것은 **자동 스케줄** 이다 — apps/admin/vercel.json 에 crons 가 없다
   (파일에 $schema 한 줄뿐). 🔴 cron 추가는 Production 변경이라 CPO 판정 사안.
```

🔴 **owner 가 «없는» 축** (grep 전수 0 — 추측이 아니다):
```
RESTOCK · NEW_SELLER · SELLER_DISAPPEARED · NEW(상품 신규성)
🔴 snapshots/route.ts:59 의 isNewAnalysis 는 「새 분석 요청인가」이고
   **상품 신규성이 아니다.** 신규성 owner 로 쓰지 않는다.
🔴 품절 전이 **0/400** · NEW_SELLER 는 created≠updated 가 69/69 라 시점을 못 가른다
   → 둘 다 **측정불가** 다. 「없다」·「0건」으로 적지 않는다.
```

🔴 **Observed Production Defect — 고치지 않았다(정책 경계)**:
```
운영 price_alerts 의 ORIGIN_TREND 3건(-39.11% · -36.27% · +3.76%)은
**전부 거짓 신호** 였다 — 「원본 시장가 GBP」와 「판매처 한국 표시가 KRW」를
시계열로 읽은 것이다. 🟢 §5-B CONTROL 로 세 값을 그대로 재현했다.
🟢 현재 설계가 막는다 — ORIGIN_FX·KR_MARKET 공존 **136/136** 에서 KR_MARKET 제거.
🔴 단 ORIGIN_FX 라벨이 없는 **과거 스냅샷 4건** 에는 혼재가 남는다. 그 4건 중 3건이
   실제로 거짓 알림을 냈다. 🔴 이것은 price-observations.ts:299 가 명시한
   「과거 행을 다시 계산하지 않는다」 정책과 충돌하는 지점이라 **CPO 판정 사안** 이다.
```

### 🔴🔴 마지막 WU 가 뒤집은 전제 — 이 문장을 그대로 쓴다

```
Gemini Discovery 로 「더 싼 해외 매입가를 찾자」는 가설은 **반증됐다.**
이유는 Discovery 가 약해서가 아니라 —
  🟢 운영 SELLER_ORIGIN 관측 1476행 / 스냅샷 **397개 전부에 원가가 이미 있다**
     (costBasis: ORIGIN_FX 257 · KR_MARKET 91 · null 49, FULL POPULATION)
  🔴 그래서 「Discovery 만이 주는 새 가격 정보」 = **0건** (sample N=3)
  🔴 그리고 1/3 상품에서 **NOT_SAME 후보가 SAME 보다 싸다**
     (99,360 < 101,135) → 「싸다」를 채택 근거로 쓰면 오염된다
🔴 이번에 쓴 해외가는 전부 «소매 판매가» 다. 실제 매입가(도매/B2B)가 아니다.
```

🔴 **오독 금지** — 「incremental 0」은 「Discovery 가 쓸모없다」가 **아니다.**
표본에 원가 없는 상품이 하나도 없었다는 뜻이고, 원가 없는 모집단에서는 미측정이다.

🟢 **원가 의미론은 운영 코드에 이미 확정돼 있다**(재조사 금지):
```
selectCostBasisOriginObservations  price-observations.ts:303 — 순수 함수
  ORIGIN_FX 가 있으면 KR_MARKET 을 버린다 (원가 = 원본 시장 통화 기준)
🔴 MARKET_PROBE 는 SELLER_ORIGIN 이지만 **원가가 아니다**(run-price-check:128)
   실측: 397/397 중 MARKET_PROBE 가 원가로 뽑힌 사례 **0** — 분리가 작동한다
🟢 환율 owner 도 이미 있다 — convertToKrwStrict(pricing/currency.ts:73) 는
   모르는 통화에 **null** 을 낸다. DB exchange_rates(frankfurter) 가 살아 있다.
   → 🔴 FX 를 새로 만들지 않는다 · 임의 환율 하드코딩 금지.
```

### 🟢 Coverage 결론 — 이 문장을 그대로 쓴다 (CPO 확정 2026-10-12)

```
❌ 「497 중 428(86%)에 국내 링크가 없다」 → 「국내 후보가 없다」로 읽으면 «틀린다»
❌ 「looxloo 커버 94」 → 「SAME 후보 94」가 아니다. **브랜드 교집합** 일 뿐이다
❌ 「후보 0건」 → 「Coverage 없음」이 아니다

🟢 CPO 확정 표현:
  「국내 Coverage 자체가 나쁜 것이 아니라, **Coverage 를 더 늘리는 것이 현재
    Seller Intelligence 의 핵심 가치 레버라는 증거가 없다.**」
```

### 🟢🟢 국내 SAME Coverage 사업가치 검증 WU — **CLOSED / CHANGE DIRECTION**

전문은 `docs/DOMESTIC-COVERAGE-WU-STATE.md`. 🔴 **다시 열지 않는다.**

```
§5-B CONTROL        PASS (게이트를 「tier === expectedTier」로 세워 EXACT 축 8/8 재현)
Independent GT      ESTABLISHED (observeVision — 판정에 입력되지 않는 관측기)
SAME Recall         4/5 = 80%   🔴 eligible 5 라 «일반화 금지»
False Positive      2/34 = 6%   — 둘 다 COMPARISON
🟢 EXACT FP         **0**       (MI-P0-12 이후 3회 확증)
Price Decision 영향  **0**       exact.sellerCount>0 이면 COMPARISON 전체가 무시된다
Implementation Gate FAIL — ⑤ Seller Decision 개선 = 0
Production/DB/정책   변경 0
```

🔴 **미실행으로 종결된 것들** — 다시 제안하지 않는다:
```
looxloo query 변경 · 한글 alias 추가 · rulii query 변경 · SAME threshold 완화 ·
no-code SAME 승격 · 신규 국내 source 대량 추가 · robots 우회 ·
UniversalExtract fallback · Registry UI 변경 · Cafe24 공통 리팩터링
```

🟢 **source 제외 근거가 확보된 것**: `chouchouenfant`(Bobo 품번 50건 전수에
현행 226 = 0 → 과거시즌 아웃렛) · `skysport`(교집합 0, 테니스 전문 → 0 이 맞다) ·
`chocoel`(교집합 MYMY 1건).
🔴 `coconjennie` 는 sixshop product path 미관찰 → **UNKNOWN 유지**(추측 금지).

🔴 **「측정불가 ≠ 0%」** — 남은 Unknown 을 0 이나 100% 로 만들지 않는다:
`UNKNOWN 90` 의 「미취급 ↔ 검색실패」 · `rulii` 동일 · MANUAL 13 자동성능 ·
GT 분모 5 · deuxbebe confidence 회귀(0.72→0.58, 단 REFERENCE 라 Decision Value 0).

### 🔴 다음 전략 방향 (CPO 확정) — 국내 source 가 «목적» 이 아니다

```
Original Product → Discovery(Google/Naver/Gemini) → Candidate URL Pool
→ Light Fetch → MI Identity → SAME/SIMILAR/NO_MATCH → SAME
→ Price / Seller Decision → Commerce
```

> 「국내 판매처를 더 많이 연결하면 Intelligence 가 좋아진다」가 **아니라**,
> 「좋은 후보를 확보하고 우리 MI 가 정확하게 SAME 을 판정해서 실제 Seller
>  Decision 에 연결하는 것」이 핵심이다.

### 🔴 금지된 단기 레버 5항 (측정으로 근거가 부정됐다)

```
❌ 검색 query 확대                ❌ judgeDomesticCandidate 완화
❌ 품번 없는 후보를 SAME 승격       ❌ source / adapter 대량 추가
❌ UniversalExtract fallback 추가
```

함께 금지된 것 — ❌ `compareMaterial` 수정 · ❌ `SAME` 문턱에 식별 증거 요구
(CEO 정답 3쌍 중 2쌍이 식별 증거 없이 SAME 이다. 테스트가 반대 방향으로 잠갔다:
`mi-p0-11-material-and-same-threshold.test.ts`) · ❌ brand backfill/resolver 변경 ·
❌ pattern/print 축 신설.

### 🟢🟢 대조군 게이트 — **§5-B 로 승격했다**

🔴 이 규칙의 본문은 **§5-B** 에 있다(스프린트와 무관한 영구 규칙이라 그 자리가
맞다 — §12 는 포인터가 회전하면 교체되는 절이다).

이 트랙에서 그 게이트가 실제로 잡은 것: 국내 커버리지 하니스가
`searchDomesticShops + withConfidence` 까지만 불렀는데 운영은 그 뒤에
`judgeDomesticCandidate`(게이트 ②④ + `fetchDomesticModelCode`)가 더 있었다.
CONTROL 상품(운영 링크 2건 보유)이 0건을 내서 **본 측정 전에** 드러났다.

### 🔴 「측정불가」로 남은 것 — 0% 나 「없음」으로 적지 않는다 (규칙은 §5-B)

```
Domestic SAME Recall     ground truth 가 운영 링크 69건뿐 → 측정불가
MANUAL 판매처 12개        자동 후보 경로가 없어 성능 판단 불가
NO_CANDIDATES 72건        「검색이 약함」 ↔ 「그 샵에 그 상품이 없음」 구분 못 함
```

### 🔴 미push 커밋 **34개** — CEO 판단 영역

```
git status  clean · behind 0 / ahead 34 · Production runtime change 0
🟢 전부 `__tests__/` 와 `docs/` 하위다 — 비테스트·비문서 변경 **0**
🔴 「ahead 8」은 2026-10-12 오전 기준이고 낡았다. 숫자는 직접 센다:
   git fetch origin --quiet && git rev-list --count origin/main..HEAD
```

🔴 **vitest 통과를 typecheck 통과로 쓰지 않는다** — vitest 는 타입을 보지 않는다.
실제로 내 하니스에 tsc 에러 4개가 숨어 있었고 테스트는 전부 통과하고 있었다
(`MatchLevel` 을 `@commerce/shared` 에서 받으려 했다. owner 는 crawler 다).
```
전 패키지 실측 — `npx pnpm -r --no-bail typecheck` (2026-10-12)
  listing 5 · pricing 3 · crawler 2 · 🟢 admin **0**   합계 **10**
🟢 2026-09-30 기록(listing 5 · pricing 3 · crawler 2)과 **정확히 같다.**
   → 측정 트랙 36커밋이 추가한 typecheck 에러는 **0** 이다.
🔴 **0 이 기준이 아니다. baseline 10 과 «비교» 한다.**
🔴 `--no-bail` 없이 `pnpm -r` 을 돌리면 pricing 에서 **멈춘다** — 그 뒤 패키지는
   「통과」가 아니라 «측정되지 않은 것» 이다.
```

🔴 push 가 Production 배포를 트리거하므로 **CTO 도 CPO 도 임의로 밀지 않는다.**
🟢 **커밋 push 여부와 Work Unit 완료 여부는 분리해 취급한다**(CPO 확정) — 이 트랙은
코드 변경 없이 **정상 종료** 다. 미완료가 아니다.

### 다음 전략 과제 (코드 작업이 아니다)

🔴 측정 넷이 끝난 뒤 남은 질문은 **둘** 이고, 둘 다 조사·판단이지 코드가 아니다.

> ① 「어떤 국내 판매처를 추가하면 실제 SAME yield 가 증가하는가」

판별 기준은 하나다 — **그 판매처가 상품명·URL·설명문에 「해외 브랜드 품번」을
적는가.** 적지 않으면 추출기를 붙여도 효과가 0 이다(실측). 이것은 판매처 실제
페이지를 보는 **조사** 이고 MI 코드 실험이 아니다.

> ② 🟢 「Discovery 의 가치가 «원가 발견» 이 아니라면 무엇인가」 — **답이 나왔다**

🔴 시장 변화 감지(품절/재입고 · 가격 추세 · 신상품)도 **Discovery 의 축이 아니다.**
다섯째 WU 가 재서 `CHANGE DIRECTION` 으로 닫았다. 남은 질문은 하나다 —

> ③ 🟢 「재관측을 자동화할 것인가」 — **측정은 끝났다**(GO CANDIDATE)

남은 것은 **판정 셋** 이고 전부 CPO/CEO 몫이다. CTO 가 먼저 들어가지 않는다.
```
③-1 🟢 cron 주기는 **측정 끝났다(2~3일)**. 남은 것은 둘 중 하나 선택 + 비용 승인
③-2 「해외 비교가격」 문구가 환율 변동을 포함해도 되는가 — 제품 정책
③-3 과거 혼재 4건 처리 — Historical Alert Integrity (별 과제)
🔴 그리고 국내 sold_out 이 0행인 이유 조사(어댑터 ↔ 실제 부재). 이것만 «조사» 다.
```

### 유지되는 포인터

```
🔴 중간 보고 금지 — 한 묶음 뒤 완료 보고 하나만 올린다.
🔴 실등록은 STOP 이다.
🔴 CEO 최종 테스트 시나리오(확인 12항)는 docs/NOTICE-PARITY-02-HANDOFF.md §8 에
   있다 — 스프린트가 넘어가도 «유효하다». 포인터를 옮길 때 같이 끌고 간다.
🟢 COMMERCE 는 CLOSE 다(bd81b064). ③ 전문은 docs/SMALLABLE-E2E-03-HANDOFF.md.
🔴 ② Semantic Parity 는 PARTIAL CLOSED(재구현 금지). 쿠팡 고시 2건은 별도 backlog
   COUPANG-NOTICE-SEMANTIC-LOSS-01 이다.
🟢 registry 는 **21개** 다(「10개」·「11개」는 둘 다 틀렸다 — 테스트로 잠겼다).
```

### 🔴 자동 로드는 «둘» 이다 — 충돌하면 이 문서가 이긴다 (CPO 확정 2026-10-10)

세션 시작에 자동 로드되는 것은 이 `CLAUDE.md` «와» Claude 의 `MEMORY.md` 둘이다.

```
현재 스프린트 · 착수점 · 금지사항   →  이 문서 §12  (유일한 source of truth)
MEMORY.md                           →  과거 교훈/기록 전용
충돌하면                            →  §12 가 우선
```

🔴 **MEMORY 의 제목이나 description 을 현재 작업 지시로 해석하지 않는다.**
제목이 「… 현 위치」·「… 착수점」·「… 인수인계」인 메모가 **아홉 개** 있고
(2026-10-10 실측) 그중 현재 스프린트를 가리키는 것은 **하나도 없다.** 전부
그때의 기록이다.

🔴 종료 여부가 «확인되지 않은» 과거 메모를 추측으로 CLOSED 처리하지 않는다 —
확인 없이 정리하면 바로 이 문제를 다시 만든다. 닫을 때는 본문과 `description` 을
**같이** 고친다(recall 은 `description` 을 읽는다).

실제로 두 번 났다 — ① §12 가 끝난 스프린트(`COUPANG-UPDATE-WIRE-01`)를
「현재」로 가리키고 있었다. ② 같은 메모가 본문에 「스프린트 CLOSE」라고 적어 둔
채 `description` 에서는 「착수점」이라고 자칭했다. **자동 로드 문서가 틀리면
그 뒤의 모든 판단이 틀린 전제에서 출발한다.**

| | |
|---|---|
| ① Naver Notice Adapter | 🟢 PASS · Production (`8a6733e8`) |
| LotteON B⑥ | 🟢 PASS · Production (`b5cac1de`) |
| Coupang `required` | 🟡 **UNKNOWN** — 실측 근거 없음. 🔴 UNKNOWN ≠ PASS |
| ② Semantic Parity | 🟡 **PARTIAL CLOSED** (`8cddbd17`) — 재구현 금지 |
| ③ Smallable 실상품 E2E | 🟢 **CLOSE** (`bd81b064`) — Commerce 전체 닫힘 |
| ④ 3-Commerce 최종 E2E | 🔴 대기 |
| 실등록 | 🔴 STOP |

### 🔴 ② 가 찾아낸 쿠팡 고시 FAIL 2건 — CPO 판정 대기

```
size       쿠팡만 값 대신 "전체 상품 상세페이지 참조" 가 나간다
           원인: matchProductFieldDetailed(coupang/build-payload.ts:1205) 규칙 표에
                 size 축이 «없다». 값이 없어서가 아니라 있는데 placeholder 가 간다.
asContact  쿠팡만 전화번호 한 조각, 업체명이 빠진다
           원인: KNOWN_NOTICE_VALUES(:1516) 가 contactNumber 만 안다.
                 항목명이 「책임자와 전화번호」라 업체명 누락은 부분 신고다.
```

🔴 **CTO 가 고치지 않았다.** 쿠팡 고시 `content` 를 바꾸는 것은 운영 중인 모든
쿠팡 상품의 «신고 내용» 이 바뀌는 것이라 제품 정책 경계다. 테스트가 현재 동작을
**FAIL 로 명시해** 고정했으므로 고치면 그 두 테스트가 깨진다 — 그때 ② 판정을
다시 적는다.
| Egress | 🟢 OCI 운영 경로 · FIXIE 는 사용량 한도로 종료(코드 정상, 재조사 금지) |

### 🔴 ② 금지 6항 — 다음 세션이 먼저 읽는다

```
① payload 3개 확보 «전» 에 parity 비교 테스트 작성 금지
② adapter 만 비교하고 parity 라고 부르기 금지   ← 실제로 그렇게 쓰다 지웠다
③ builder 를 mock 해서 parity 검증 금지
④ 손으로 쓴 noticeArticles 를 expected payload 로 쓰기 금지
   (LotteON 은 resolveLotteOnNotice() 결과를 쓴다)
⑤ Coupang required 추측 금지 — UNKNOWN 유지
⑥ expected 와 actual 을 «같은 함수» 에서 만드는 circular test 금지
   ← 실제로 걸렸다. 순서 가드가 순서를 하나도 지키지 못했다
```

### 끝난 스프린트 (참고용 — 다시 들어가지 않는다)

`COUPANG-UPDATE-WIRE-01` · `EGRESS-NOTICE` 는 종료됐다. 아래 §12 의 Coupang
UPDATE 안전계약은 **그 기능을 건드릴 때만** 유효한 기록이다.

### 🔴 두 구조를 억지로 하나로 만들지 않는다

```
SmartStore                        Coupang
Master → payload 재생성            GET registered baseline
 → current → edited fields         → seller edits → CoupangProductEdits
 → UPDATE                          → baseline + edits → UPDATE
```

seam 의 축은 타입이 아니라 **「outgoing 을 누가 만드는가」** 다.

### 안전계약 (유지)

baseline GET 이 Source of Truth · Master 가 baseline 을 덮어쓰지 않는다 ·
`items[]` 전체 보존 · `sellerProductItemId` 보존 · `certifications` 는 실측된
`[]` 를 그대로 유지(임의 생성 금지) · 셀러가 수정한 값만 overlay · 나머지는 GET 값 그대로.

### 판정

```
실제 PUT 성공 전   Implemented / Not Production Verified
실제 PUT 성공 후   Production Verified
승인 상품          항상 UNKNOWN / BLOCKED
```

---

## 13. 완료의 정의

> **「기능을 만들었다」는 완료가 아니다. 실제 상품에서 맞게 동작하고, 실패해야 할
> 것은 막히고, Production 에서 증명되어야 완료다.**

실패가 나오면: **실제 실패 확인 → 원인 조사 → 최소 수정 → 재테스트.** 숨기지 않는다.
