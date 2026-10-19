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

### 🔴🔴 4-B. CTO WU 는 «한 덩어리» 다 (CPO 확정 2026-10-15)

🔴 이 절은 **스프린트와 무관하게 항상** 유효하다. §12 가 회전해도 남는다.

```
CTO WU = 조사 → 원인 확정 → **해결안 전수검토** → 최적안 선정
         → 구현 → E2E → 회귀 → 배포 → 최종보고 **1회**
```

🔴 **CPO 가 자기 작업지시 설계를 정정해서 생긴 규칙이다.** WU-023 에 「병목 A 를
transient 경로로 해결 가능한지 확인하고 가능하면 구현」이라는 **한 줄짜리** 지시가
나갔고, CTO 는 「소비자는 있는데 생산자가 Gemini 에 하드결합 → 불가」로 **좁게** 닫았다.
발견은 옳았지만 **설계 공간을 끝까지 탐색하라는 지시가 빠져 있었다**(CPO 판정).
🔴 그러므로 **다음부터는 지시가 짧아도 CTO 가 그 범위를 스스로 연다.**

#### A. 문제 정의 — 다섯을 먼저 적는다

```
실제 사용자 영향 · 발생 빈도 · KPI · 기존 GT 근거 · 현재 코드 진입점 · 현재 운영 경로
```

#### B. 전체 경로를 «끝까지» 추적한다 — 한 구간만 보지 않는다

```
입력 → 생산자 → 후보 생성 → 정규화 → 검증 → MI/판정
     → 가격 수집 → 저장 → UI → 등록
```

🔴 WU-023 이 좁았던 이유가 이것이다 — **소비자만 보고 생산자·대체 생산자를 안 봤다.**

#### C. 해결안 **전수검토 10축** — 하나도 건너뛰지 않는다

```
① 기존 코드 재사용   ② 기존 계약 확장    ③ 다른 기존 producer  ④ transient 경로
⑤ Registry          ⑥ 외부 Search       ⑦ AI                 ⑧ 데이터/UX 우회
⑨ 현재 정책상 금지된 방법               ⑩ 새 비용/ToS/보안 문제
각 축마다 — 가능 / 불가능 / 금지 / 비용 / 위험 / 구현 난이도 / 예상 효과
```

🔴 ⑨ 를 **빼지 않는다** — 「금지라서 안 적었다」가 아니라 **「금지」로 적는다.**
그래야 CPO 가 정책을 바꿀 때 그 자리가 보인다.

#### D. 🔴🔴 「불가능」 판정 조건 — 강화됐다

```
❌ 「현재 producer 가 없다 → 구현 불가」로 끝낸다
✅ **「현재 계약을 «최소 변경» 하면 가능한가」** 까지 조사하고 그 변경안을 설계한다
✅ 막는 것이 **계약인지 · 정책인지 · 외부 capability 인지** 를 **코드 위치와 함께** 특정한다
🔴 단 계약 변경이 필요하면 **임의 구현하지 않는다** — 변경 범위와 부작용까지 «분석» 해 올린다
```

#### E. 구현 가능하면 **끝까지** 간다 — 중간 보고 없다

```
설계 → 코드 → 단위 테스트 → 실제 데이터 → E2E → regression
     → build/typecheck → deploy → 실제 URL/UI 검증
```

🔴 CEO 에게는 **실제 상품 화면/URL 테스트가 필요한 순간에만** 전달한다(§3 게이트 유지).

#### 🔴 완료 조건 10 — WU 마다 작업지시에 «포함되어» 온다

CPO 는 이제 「§7 확인해 주세요」 같은 짧은 검증 요청을 하지 않는다. **완료 조건 자체가
지시서에 들어온다.** 지시서가 그것을 빠뜨렸더라도 아래 꼴로 CTO 가 세운다.

```
① 해당 경로의 **모든 producer** 를 조사했는가
② consumer 의 **전체 downstream** 을 추적했는가
③ 공급 가능한 **기존/신규 producer 를 모두** 검토했는가
④ 금지 수단(AI·Registry 확대) **없이** 가능한 경로를 «먼저» 탐색했는가
⑤ 계약 변경이 필요하면 **최소 변경안** 을 설계하고 구현 가능성을 검증했는가
⑥ 구현 가능하면 **실제 GT 데이터로 E2E** 를 돌렸는가
⑦ 불가능하면 **무엇이 막는지** 를 코드 위치와 함께 확정했는가
⑧ 🔴 **GO / HOLD / STOP** 중 하나를 최종 판정했는가 (단순 「조사 종료」 금지)
⑨ 코드를 바꿨으면 **regression · typecheck · build** 까지 했는가
⑩ 배포 가능한 상태면 **실제 제품 검증 지점** 까지 만들었는가
```

🔴 **§「용량 판단은 시작 전에 한다」는 그대로 유효하다** — WU 가 커진 만큼 더 중요하다.
한 세션에 끝까지 못 갈 크기면 **착수 전에** 범위를 줄이거나 다음 세션으로 넘긴다.
작업트리를 더럽힌 채 중간에 끊기는 것이 가장 나쁘다.

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

### 🔴🔴🔴 00. **이것부터 읽는다 — 목표는 «하나» 다** (CPO 재정립 2026-10-19)

🔴🔴 **CPO 자기정정**: 「제가 **수단을 목표보다 앞세웠습니다.** 이건 제가 방향을 잘못
잡은 겁니다.」 ⟹ 아래 한 문장이 **이 트랙의 유일한 목표** 다:

> **외부 AI 가 찾아온 후보를 우리 MI 가 정확하게 판단하고 →
> 국내 가격 + 해외 가격을 정확하게 비교해서 보여주면 끝.**

```
① **AI 는 «후보 수집기» 다**
   AI 가 10개를 가져오든 5개를 가져오든 **일단 후보로 받는다**
   🔴 **AI 자체의 정확도를 프로젝트 핵심 KPI 로 삼지 않는다**
② **MI 가 핵심이다** — SAME/SIMILAR/DIFFERENT · 동일상품 가격인지 구분 ·
   국내 가격 · 해외 가격 · 최종 비교 표시
③ **CEO 육안 검수는 «MI 개선용 GT» 다**
   실제 화면에서 틀린 판단 발견 → SAME/DIFFERENT 기준 축적 → **MI 규칙 최소 수정**
   → 다시 E2E → 정확해지면 종료
   🔴🔴 **CEO 는 개발 과정에서 계속 판단하는 역할이 아니다** —
        **실제 화면을 보고 «최종» 판단하는 역할** 이다
④ **완료 기준**
   AI 후보 → MI → 동일상품 판별 **정확** → 🇰🇷 국내 동일상품 가격 + 🌎 해외 동일상품 가격
   → **가격 비교가 실제 화면에 정확하게 표시** ⟹ **1차 제품 목표 완료**
```

🔴🔴🔴 **그래서 작업 선별 기준이 «한 줄» 로 고정됐다**:

> **「국내/해외 가격비교가 정확하게 되느냐?」 — 이 질문에 «직접» 영향을 주는 작업만 한다.**

```
🔴 **후순위로 미룬다**(가격비교 정확도가 확보된 «뒤») —
   AI discovery 자체의 recall · 새 Registry · 불필요한 분류 개선
   (예: `UNREACHABLE` 의 4xx/미도달 분류 · AI 원문 저장 정책)
🔴 **다시 열지 않는다** — **8개 축**(COLOR·TITLE·MODEL_CODE·LINE·MARKET·PRICE·
   LANGUAGE·BRAND) · **「국내 EXACT 0」**. 둘 다 **CLOSED 유지** 다
🔴 **WU-107 의 「근거 추가 확보 대기」는 «AI discovery 축» 에만** 적용된다 —
   가격비교 정확도 작업은 그 대기와 **무관하게** CPO 지시로 진행된다
🔴 CTO 는 **선제적으로 WU 를 만들지 않는다.** CPO 가 이 기준으로 **하나씩** 준다
```

### 🔴🔴🔴 00-B. **작업 순서가 고정됐다 — 가격 작업 전부 보류** (CPO 확정 2026-10-19)

🔴🔴 **CPO 자기정정**: 「제가 범위를 잘못 잡았습니다. 앞으로 작업 순서를 고정하겠습니다.」
🔴 **이 절은 §00 의 목표를 «실행 순서» 로 번역한 것이고, 순서 충돌 시 이 절이 이긴다.**

```
[국내 동일상품 후보 확보] + [해외 동일상품 후보 확보]
        ↓
[CEO 육안 GT]          ← 후보 «목록» 만 잘 만들면 CEO 가 SAME/DIFFERENT 를 판단한다
        ↓
[MI 최소 수정] (필요할 때만)
        ↓
[동일상품 판정 E2E]
        ↓
[배포] → [따져 실제 화면 확인] → **완료** → [그 다음 작업]
🔴🔴 **가격은 이 완료 «이후» 다.**
```

🔴🔴🔴 **그래서 지금 «중단» 된 것 전부**(다시 열지 않는다 · CPO 명시):
```
❌ `priceStatus` 정책      ❌ 가격 집계 조건     ❌ 가격 파서
❌ UI 가격 표시          ❌ 가격 추출률 KPI    ❌ 최저가 집계 손질
🔴 WU-111 의 「표시 모순 1건」도 **그 보류에 들어간다** — 결론만 보존하고 **손대지 않는다**
```

🔴 **그리고 두 단계를 섞지 않는다**(CPO 명시):
```
① 동일상품 찾기가 **끝난 뒤에만** 가격을 본다
② SAME 으로 **확정된** 상품만 가격 추출 대상이다
③ DIFFERENT 상품 가격은 **아무리 정확해도** 비교 대상에서 제외한다
🔴 CTO 는 임의로 「동일상품이다」를 확정하지 않는다 — **후보 목록을 만드는 것까지** 가 CTO 일이다
```

🔴 **현재 작업 범위는 하나다**:
> **국내/해외 동일상품 후보를 최대한 확보해 «목록» 으로 만들고 → CEO 가 육안 검토할 수 있게 한다.**

### 🔴🔴🔴 0. 먼저 읽는다 — **제품 구조 정정** (CPO 자기정정 2026-10-13)

> **우리는 「많은 쇼핑몰을 관리하는 시스템」을 만드는 게 아니라, 「어떤 상품을 넣어도
> Gemini 가 후보를 찾고 → MI 가 검증·수집하고 → MI 가 판매 여부를 판단하는 상품
> 자동등록 시스템」을 만든다.**

🔴🔴 **CPO 가 자기 지시를 정정했다** — 「국내 후보가 부족하다 → Registry 를 보완한다 →
카테고리를 늘린다」는 사고 방향은 **잘못이었고 이미 폐기된 방향** 이다. 아래 §12 본문에
그 틀로 적힌 문장들이 남아 있으니 **이 절이 이긴다.**

```
① Gemini   1차 Discovery — 웹 전체에서 동일/유사 · 국내/해외 후보를 찾아온다
                            🔴 사이트 Registry 를 늘리는 것이 «목적이 아니다»
② MI       2차 Verification + 정보 수집 — 상품명·브랜드·모델/SKU·색상·소재·
            이미지/특징·가격·통화·국내/해외 시장을 모으고
            SAME / PRESUMED_SAME / SIMILAR / CONFLICT / UNKNOWN 판정
③ MI       3차 판매 여부 판단 — 판매 가능/추천 · 조건부 · 정보 부족 · 제외
                            ↓
                          등록
```

🔴 **현재 제품의 목표가 «아닌» 것 일곱**(CPO 명시):
```
❌ 카테고리별 국내 쇼핑몰 Registry 확대      ❌ 카테고리마다 별도 사이트 Adapter 추가
❌ 국내/해외 비교 사이트를 계속 관리          ❌ 가격 추적 시스템 구축
❌ 외부 URL 영구 저장                        ❌ 카테고리별 Discovery 인프라 확장
❌ 여성의류 등을 «지금» 별도 개발
```

🔴 **「국내/해외」의 의미도 정정됐다** — 우리가 관리하는 것은 **국내 사이트 목록 /
해외 사이트 목록이 아니다.** Gemini 가 찾은 결과가 한국이면 한국 후보, 해외면 해외
후보일 뿐이다. 🔴🔴 **사이트가 늘어나도 우리 시스템이 사이트별로 커지면 안 된다.**

#### 🟢 Phase A — 닫아야 할 것은 **다섯** 이고 카테고리 확장은 **없다**

아동의류 + 테니스의류 **실제 상품** 으로 아래 다섯을 제품 기준으로 닫는다.
🔴 상태는 **CPO 가 고정한 값** 이다(2026-10-13):

| | 항목 | CPO 상태 |
|---|---|---|
| ① | Gemini 실제 Discovery 실측 | 🔴 **HOLD** — **비용 승인 전에는 호출 금지** |
| ② | MI 후보 검증 | 🟢 **CLOSED** (WU-019R) |
| ③ | MI 상품정보/가격 수집 | 🟡 **PARTIAL** — JSON-LD 범위 CLOSED · microdata-only **보류** |
| ④ | 최종 판매판정 | 🟢 **CLOSED** (WU-021) |
| ⑤-a | 실제 등록 UX **배선** | 🟢 **배선 PASS** (WU-022 · CLOSED) |
| ⑤-b | Production **실화면** | 🔴 **미확인** |

### 🟡 WU-023 **실행 중 · A 는 HOLD** (CPO 2026-10-14)

```
①② 계측 로그 + 호출 상한        🟢 완료   (maxQueries 2 → **1** · [MI-023-metrics])
③  회귀/build                   🟢 완료   516 files / 7,687 passed · typecheck 10=baseline
④  Production 배포              🟢 **Ready** — 최신 main 배포가 `ttaejyo.vercel.app` 에 alias
     (🔴 커밋 해시는 CLI 가 안 보여줘 **타임스탬프로만** 대응시켰다 — 단정하지 않는다.
      확실한 증거는 빌드 로그의 `Commit:` 줄이다 · 메모 production-307-is-not-route-evidence)
     🟢 기능 변화 **0** — flag 키가 env 에 **없다**
B   Gemini 1 call 실측           🟢 **완료** (`docs/MI-PRODUCTION-E2E-FINAL-023B-ONECALL.md`)
A   Production flag ON 테스트    🔴 **HOLD — 비용 미확정**
```

🟢 **B 결과(실측 · N=1)**:
```
Gemini calls **1** · queriesUsed 1 · outcomes {OK:1} · 실패 0
tokens input 1,899 / output 300 / thoughts 1,790 / **total 3,989** · **grounding 3**
discovered 5 → usable 2 → MI candidates 2 · **SAME 1 · PRESUMED_SAME 1**
Primary = **L1_MODEL_CODE** "Bobo Choses B226AC010"(3토큰)
Gemini 내부 검색어 3개가 **전부 품번** 을 썼고 둘은 스스로 `site:` 로 좁혔다
  (🔴 그 사이트들은 우리가 넘긴 preferredDomains 에 **없다** — Gemini 자기 판단)
🟢🟢 후보가 **한국 리세일 플랫폼**(global.trenbe.com SAME 0.53 · m.web.mustit.co.kr
   PRESUMED_SAME 0.02 · KRW 74,000)이고 **우리 등록부 밖** 이다 — 기존 MI 가 전용 규칙 0 으로 판정
```

🔴🔴 **CPO 판정 — PASS 범위를 넘겨 읽지 않는다**:
```
🟢 PASS 인 것: 「호출 자체가 정상이고 **1-call 상한도 지켰다**」 까지
🔴 **상품당 실제 비용은 미확정** 이다 — 원화 차감액이 없다(CTO 는 Billing 을 읽을 수 없다)
🔴 그래서 **A 를 승인하지 않는다.** ₩3,171 → 호출 후 잔액 확인이 **선행** 이다
🔴 유효 국내 가격 증거는 **여전히 0** — trenbe 는 가격 없음 · mustit 은
   `priceStatus = UNVERIFIED_SEARCH` 라 운영 게이트(VERIFIED_CURRENT && KRW)를 못 지난다
   🔴 단 **「0」의 성질이 달라졌다** — 전엔 「국내 후보가 아니었다」, 이번엔
      「국내 후보를 찾았는데 가격이 검증을 통과하지 못했다」. 🔴 N=1 로 일반화하지 않는다
🔴 **498 전수 환산을 하지 않는다**(CPO 명시) — 관측값 하나로만 판단한다
🔴 「grounding 5.5 → 3 으로 줄었다」로 적지 않는다 — 조건·분모가 다르다
```

🔴 **보류된 제품정책 1건 (고치지 않는다)** — WU-022 transient 구역이 `priceStatus` 와
무관하게 금액을 보여줘서 **미검증 가격(mustit KRW 74,000)이 확정 가격처럼 보일 수 있다.**
🟢 판정·국내 최저가에는 들어가지 않는다. 🔴 「미검증」 표시 추가는 **제품정책 판단 대상**
이고 WU-022 의 PASS 범위를 깨지 않기 위해 **임의로 수정하지 않는다**(CPO 확정).

🔴 **A 를 열 때의 순서**(그때만): 배포 Ready 확인 → flag ON → **CEO 가 특정 상품 1개에서
「🔄 다시 분석」 1회** → **즉시 flag OFF** → 결과/비용 확인.
🔴🔴 그리고 그때 CEO 에게 **「`/today` 일괄 확인을 절대 누르지 말 것」** 을 명시해야 한다
(메모 `gemini-flag-is-a-global-switch-not-a-per-product-control`).

### 🔴🔴 현재 착수점 — **없다. 핵심 루프 CLOSED · 다음 WU 는 CPO 가 지정** (CPO 확정 2026-10-17)

🔴🔴 **이 절이 §12 의 유일한 현재 상태다.** 아래 WU 표와 그 뒤 절들은 **종료된 결론**
이고, 「… 지금 여기」로 적힌 줄이 남아 있어도 **이 절이 이긴다.**

```
WU-073 ~ 080     🟢 **전부 CLOSED**(측정 7 · 구현 1) — 🔴🔴 **국내 recall 은 현 구조의 한계로 확정**
                 073 발견량은 병목이 아니다 · 074 ④ 원인 확정 · **075 구현/배포**(도착지 방어) ·
                 076 200 soft-404 HOLD · 077 ⑥ 완화 불가 · 078 언어 축 종료 ·
                 079 가격 증거 REJECT(안전 회수 1건이 틀린 상품) · 080 BRAND REJECT(공백은 원상품 쪽)
                 🔴🔴 **여덟 축 전부에서 「완화 = Human DIFFERENT 동반 개방」이 측정됐다**
                 (COLOR·TITLE·MODEL_CODE·LINE·MARKET·PRICE·LANGUAGE·BRAND)
WU-096 ~ 107     🟢 **전부 CLOSED** — 🔴🔴 **수정할 병목 없음 · 「근거 추가 확보 대기」**
                 096 funnel(⑧ 병목 → **폐기**) · 097 sink 분리 **HOLD** · 098 설계 조사 ·
                 **099/100 CEO 평가 2회**(기준 고정 후 **USEFUL 0/26**) · 101 **폐기** ·
                 **102 분모 오류 발견**(B226AC112 는 조사 대상이 아니었다) ·
                 103/104 올바른 분모 재측정(**⑥⑧ 소실 0/5**) · 105 skroutz **HTTP 403** ·
                 **106 종합 판정** · 107 **대기**
                 🔴🔴 **CPO 확정(2026-10-19)** — 「현재 확인 가능한 동일상품 표본에서는
                 **후단 파이프라인이 동일상품을 버린다는 증거가 없다**. AI discovery 만
                 후보이지만 **표본·저장 데이터로 확정 불가**」
                 🔴 **8개 축과 「국내 EXACT 0」을 이번 결과로 다시 열지 않는다**(CLOSED 유지)
WU-090 ~ 095     🟢 **전부 CLOSED**(구현 3 · 측정 3) — 🔴🔴 **거짓 식별 신호를 하나 제거했다**
                 090 Smallable 두 경로 OK · **091 후보 노출 ≠ SAME 판정**(배포) ·
                 092 S1=matching / S2=coverage 분리 · **093 CEO GT 10건**(SAME 2 · DIFF 8) ·
                 094 `very_high` 는 **거짓값** 이었다 · **095 숫자 slug 가드**(배포)
                 🔴🔴 **CPO 확정** — 「**정상화된 matchLevel 만 사용한다**」 ·
                 WU-093 의 **「very_high 40% precision」은 폐기** ·
                 「숫자-only recall 손실」은 **독립 증거가 있을 때만** 다룬다 ·
                 **리팩터로 범위를 넓히지 않는다**
                 🔴 다음 WU 는 「AI 후보 → MI → 국내/해외 가격비교 노출」에 **직접 영향을 주는
                 독립적인 병목이 확인될 때만** CPO 가 지정한다
WU-081 ~ 089     🟢 **전부 CLOSED**(구현 3 · 측정 6) — 🔴🔴 **가격/MI 경로에 남은 안전 레버 0**
                 **081** 국내 후보 Human Review UI(배포) · **082** 자동 1회차 응답 배선(배포) ·
                 083 Smallable 품번 REJECT · **084** Header overflow 복구(배포) ·
                 085 후보가 «생성되지 않는다»(등록부) · 086 AI URL 경로 **이미 있다**(코드 0) ·
                 087 AI funnel HOLD · 088 비용 게이트 **발화 0** REJECT · 089 AI URL 품질 **산출 0** REJECT
                 🔴🔴 **병목 지도(확정)** — AI 181 → 상세 68 → evidence 61 → **price 12**
                 → market 8 → **MI 자격 8**. 🔴 상류(AI URL)를 **완벽히 해도 산출 0 증가**(089)
                 🔴 그 아래 owner 는 **matchLevel 자격 필터** 이고 **전건 low** 라 상세확인이
                 **한 번도 안 돈다**(088). 🔴 그 축은 **이미 닫혀 있다**(WU-017 · threshold 완화 금지)
                 🟡 **보존되는 Known Unknown** — 「AI 에게 상세 URL 만 요구하면 AI 가 **더 좋은**
                 후보를 낼 것인가」는 **측정하지 못했다**(새 AI 호출 금지). 🔴 그 가설을 위해
                 **별도 코드/가격축 WU 를 만들지 않는다**(CPO 확정 2026-10-19)
WU-056 / 056-R1  🟢🟢 **CLOSED — Production UI PASS**(CEO 확인 2026-10-17 · 배포 `959cea45`)
                 확인된 것: 🇰🇷 국내 참고가격 ₩88,000 · 🧾 해외 동일상품 참고가격 EUR 40 ·
                 원본 상품 `EUR 40.00 + 약 ₩59,960`(🟢 정상 · 제거하지 않았다) ·
                 두 축 안 섞임 · 내부 토큰 노출 0
WU-058           🟢 **CLOSED** — 소싱 **UI 제거 완료** · 가격비교 **동결 유지** ·
                 남은 정책 **HOLD** (배포 `52046660` · 2026-10-17)
WU-072           🔴🔴 **L4 종료(REJECT)** — 국내 COLOR × L4 정량화 · 운영 변경 0
                 ① 국내 17건 중 **구조화 색상이 있는 것은 1건**(C08 JSON-LD 「블루」).
                 `colorText` 는 3건(전부 **제목 유래**) · 「색상/컬러」 **문자열** 은 10건인데
                 **산문** 이다. 🔴 그리고 microdata 색상 0 은 **「읽는 칸이 없어서」** 다
                 (`ExtractedProductData` 에 `color` 칸이 **없다** — typecheck 가 잡았다)
                 ② 국내에서 L4 는 **네 모드 전부 불변**(EXACT 1 · SAME 0 · DIFF 1).
                 🔴 안전해서가 아니라 **조건 ③에 14/17 이 막혀 발화하지 못해서** 다
                 🔴🔴 **국내/한국계 현재 EXACT 1건이 Human DIFFERENT 다**(C06) —
                 국내 precision **0/1** · 국내 Human SAME 중 EXACT 도달 **0건**
                 ③ 「숫자 시작 slug 거부」 → **S2-4 회복 안 됨** · 전체 지표 전부 불변
                 (cross-seller 가 여전히 `conflicts[MODEL_CODE]` 를 낸다 — 삼중 잠금 ①)
                 ⟹ 🔴 **두 안건 다 REJECT.** 전략 고정 —
                 **「품번 충돌 보호를 완화하는 대신 국내 recall 은 다른 축에서 해결한다」**
                 (`docs/MI-DOMESTIC-COLOR-L4-072.md`)
WU-071           🔴 **L4 보류 유지** — 위험 형태 탐색 + 샵 SKU 경로 · 운영 변경 0
                 🔴 위험 형태(라인다름+같은브랜드+COLOR/CATEGORY 충돌 없음+DIFFERENT) **0건**
                 — 🔴 단 「안전」이 아니다. 라인 다른 DIFFERENT 17쌍이 **브랜드 9 · COLOR 8** 로
                 걸린 것이고 **라인을 보는 축은 없다**(「아무것도 안 막음」 0)
                 🔴🔴 **방어축 분해 — COLOR 가 단독 하중** 이다. 빼면 **12건 즉시 뚫린다**
                 (그 목록에 CPO 가 지목한 **S1/C33** 이 있다) · CATEGORY 제거는 1건
                 🔴🔴 **그리고 국내 후보에는 그 COLOR 방어가 애초에 없다**
                 (`colorText` 전건 null · WU-064) ⟹ L4 안전성은 **해외 표본에서만** 쟀다
                 🟢 ⑤ 샵 SKU 경로 확정 — `seller-facts.ts:208` 이 slug 를 품번으로 승격
                 (`extractCodeLikeSlugSegment` · kids21 `700005621lbl` 통과).
                 🔴 그 함수 주석의 「재고번호는 안전하게 빠진다」 전제가 **반증됐다**
                 🟡 안전 후보 1 — 승격 13건에서 **진짜 품번은 전부 글자 시작 · 샵 SKU 는
                 전부 숫자 시작**(N=13 · 잃는 것 0) 🔴 새 규칙이라 수정하지 않았다
                 (`docs/MI-L4-RISK-SHAPE-071.md`)
WU-070           🟢 **DIFFERENT 분모 확보 · L4 위험 측정됨** — 운영 변경 0
                 🔴🔴 **WU-069 의 「분모 0」을 정정한다** — AC↔AB 에 DIFFERENT **2건**,
                 라인 구조가 있는 DIFFERENT 전체 **26쌍** 이다(AC↔AC 10 · AC↔AI 9 · AI↔AB 1 · AI↔AC 5)
                 🟢 품번 구조가 파싱된다 — `B<season><LINE><num>` · 관측 라인 AC 6 · AB 2 · AI 1
                 🔴 번호 변환 규칙 **없다**(AC009↔AB040 차 31 · AC010↔AB046 차 36)
                 🟢🟢 **L4 가 26쌍을 하나도 뚫지 않는다**(False SAME 증가 0 · 여는 3건 전부 SAME)
                 🔴🔴 **그러나 막는 것은 «라인» 이 아니다** — 브랜드 다름 13 ·
                 COLOR/CATEGORY 충돌 동반 13 이다. 라인 코드는 **아무도 보지 않는다**
                 🔴 남은 구멍 — 「AC↔AB + 같은브랜드 + 같은색 + DIFFERENT」 표본이 **0** 이다
                 (그것이 L4 가 뚫릴 **유일한 모양** 이고 **미측정** 이다)
                 (`docs/MI-LINE-CODE-CONFLICT-070.md`)
WU-069           🔴 **HOLD · 품번 보호 동결** — CONFLICT 5건 분해 · 운영 변경 0
                 🔴🔴 **`compareModelCode` 는 이 5건의 원인이 아니다** — 5건 전부
                 `crossSeller CONFLICT` 가 **먼저 이긴다**(match-truth.ts:176 > :178).
                 그래서 modelCode 를 바꾸는 counterfactual 은 **변화 0건** 이었다
                 🔴 **삼중 잠금** — ①을 「보류」로 내리면 ③`crossSellerReserved` 가 다시
                 막는다 ⟹ L1·L2·L3 **전부 0건**. 셋을 다 풀어야(L4) 움직인다
                 🟡 L4 = SAME **+3**(C33·S1-7·S2-3) · False SAME **+0** · 파생 **0/135** ·
                 prec 87.5→89.5% · recall 37.8→45.9% — 🔴 그러나 **품번 보호의 해체** 다
                 🔴🔴 과잉 차단의 실체는 **`AC`(kids) ↔ `AB`(baby) 라인 차이** 이고
                 **WU-048 이 이미 HOLD 한 그 질문** 이다. 🔴 CEO 가 그걸 «인지하고»
                 SAME 이라 했는지 **미확인**(사유 공란) — 그 답이 L4 의 전제다
                 🔴 5건의 원인이 셋으로 갈린다 — ⒜ 라인차이 3 ⒝ 샵 자체 SKU 1(kids21
                 `700005621LBL`) ⒞ **소재 충돌** 1(C35 · 품번 문제가 아니다)
                 (`docs/MI-MODEL-CODE-CONFLICT-069.md`)
WU-068           🟡 **HOLD(CPO 검토 대상)** — 통합 GT 63 재계산 · 운영 변경 0
                 🔴 **CPO 집계 정정** — CEO 라벨은 SAME **10** · DIFF **3** · UNCERTAIN **6**
                 (지시서의 11/5 가 아니다). 분모 = 50 + 13 = **63**(UNCERTAIN 7 제외)
                 Baseline EXACT **16** = SAME 14 · **False SAME 2** · prec **87.5%**(91.7%→)
                 CF-2     EXACT **17** = SAME 15 · False SAME 2 · prec 88.2% · 파생 135 유입 **0**
                 🔴🔴 **새 False EXACT 1건** — `S1-6 tinyapple.net`「반팔이고, 컬러 다름」
                 C06 과 **같은 클래스·같은 샵** 이다
                 ⒜ SAME 회복 **1**(C47) ⒝ False SAME 증가 **0** ⒞ 분모효과 **-4.2p**
                 🔴 **precision +0.7p 를 GO 근거로 쓰지 않는다**(CPO 금지 논법)
                 🔴🔴 **recall 최대 덩어리가 바뀌었다** — 제목·색상이 아니라
                 **품번 충돌 과잉 차단 5건**(CEO SAME 인데 EXCLUDED · 올바른 차단은 1건).
                 `bobochoses.com`(브랜드 공식몰)이 conflict 로 막힌다
                 (`docs/MI-INTEGRATED-GT-068.md`)
WU-067           🟢 **CLOSED** — 블라인드 리뷰 19건 · CEO 라벨 수신 완료
                 🔴 미라벨 41건 fetch → 읽힘 23 → 목록URL 3 제외 → **리뷰 19건**
                 🔴🔴 CPO 1순위 범주(「CF-2 로 EXACT 가 되는 후보」)가 **0건** 이다
                 (이 풀은 `modelCode unavailable` 이 대부분이라 CF-2 가 안 걸린다)
                 🟢🟢 **대신 라벨 없이 현재 EXACT 로 들어가는 4건을 찾았다**
                 (eraldo · cissywears · tinyapple · thefrontshop) — 라벨되면
                 precision 분모가 **12 → 16** 이 되어 WU-060 이후 숫자가 단단해진다
                 🔴 부수 관측 — `bbambam.com` 제목이 **mojibake**(EUC-KR 오디코딩).
                 그 둘은 목록 URL 이라 GT 영향 0 이지만 **범위는 미측정** 이다
                 🟡 **CEO Action 1회** — 19건 · 15~25분 (`docs/MI-BLIND-GT-REVIEW-067.md` §11)
WU-066           🟡 **HOLD** — GT 확대(186쌍) · 운영 변경 0 · 🔴 **CF-3 REJECT 확정**
                 🔴 Human GT 는 CTO 가 못 만든다 ⟹ 사람 라벨에서 **함의되는** 쌍만 파생했다
                 (Human SAME 27 × 다른 원상품 5 = **파생 DIFFERENT 135** · 총 186)
                 🟢🟢 **A 군 분모를 깼다** — WU-065 의 0 이 **18쌍** 이 됐고 **전부 DIFFERENT**
                 ⟹ `NO_TITLE_OVERLAP` 은 **진짜 다른 상품을 잘 잡는다.** 풀지 않는다
                 🔴🔴 **CF-3(`crossSellerReserved` 우회) = 참사** — precision 91.7% → **55.6%** ·
                 False SAME 1 → **16** · 파생 분모에서 4건 누출 · **C08 이 뚫린다**
                 🟢 base/cf1/cf2 는 파생 135쌍에서 False SAME **0/135**
                 🟡 CF-2(제목+색상)만 +1 SAME · FP 0 — 이득이 **1건** 이라 GO 미충족
                 🔴 **SAME 분모는 27 그대로** — 더 가려면 **코드가 아니라 사람 라벨** 이다
                 (`docs/MI-EXPANDED-GT-066.md`)
WU-065           🟡 **HOLD** — `NO_TITLE_OVERLAP` 전수 · 운영 변경 0
                 🔴🔴 **국내 마지막 구간은 «세 겹» 으로 막혀 있다** — ① NO_TITLE_OVERLAP
                 (한국어 제목) ② colorUnverified(색상 추출 실패) ③ crossSellerReserved
                 (PRESUMED_SAME 보류). 🔴 **하나만 풀면 아무 일도 안 일어난다**
                 (CF-1 전면비차단 · CF-2 품번 · CF-3 독립증거 — **전부 변화 0건**)
                 🔴 NO_TITLE_OVERLAP 은 **4/51 · 전부 국내**(원 LA → 후보 MIXED) ·
                 **A 군(같은 문자체계인데 겹침 0) 0건** ⟹ 「진짜 불일치」 분모가 없다
                 🔴🔴 B 군(품번 exact+독립증거≥2) **2건 중 1건이 Human DIFFERENT**(C08)
                 ⟹ 독립증거 «개수» 로는 동일성을 가를 수 없다
                 🟡 결합(색상+비차단)만 C47 +1 SAME · FP 0 — 🔴 N=1 · 금지 둘 동시 해제 필요
                 🟢 C08 은 결합에서도 ③이 막았다 · 🟢 C06 은 전 CF 불변(anchor)
                 (`docs/MI-TITLE-OVERLAP-065.md`)
WU-064           🔴 **HOLD** — 국내 색상 evidence · 운영 변경 0
                 🔴🔴 **색상을 «완벽히» 복구해도 tier 변화가 «0건» 이다**(EXACT 12 → 12).
                 ⟹ WU-063 의 「색상 미확인이 직접 원인」을 **정정한다** — 그것은 EXACT
                 게이트에서 **마지막으로** 걸리는 조건이지 「그것만 풀면 된다」가 아니다.
                 🟢🟢 **진짜 원인은 「한국어 제목」** 이다 → 원상품(영문)과 토큰 겹침 0
                 → `NO_TITLE_OVERLAP`(관측된 차이) → **색상·품번과 무관하게** EXACT 차단
                 🔴 원인 위치: `seller-facts.ts:264` 가 **제목 전용** 이고 HTML 을 안 본다 ·
                 `extractColorFromTitle` 은 **화이트리스트** 다(주석이 한계를 자인한다)
                 🔴 국내 17건 HTML — JSON-LD color **1/17** · itemprop/og **0/17**
                 🟡 결합 CF(색상 복구 **+** NO_TITLE_OVERLAP 비차단) → 국내 EXACT **1건**
                 (C47) · **FP 0** · precision 91.7→92.3% — 🔴 단 **금지 둘** 을 풀어야 하고 **N=1**
                 (`docs/MI-DOMESTIC-COLOR-EVIDENCE-064.md`)
WU-063           🔴 **HOLD** — 국내 체인 전수 역추적 · 운영 변경 0 · **완화 불가를 증명했다**
                 🔴🔴 병목이 **셋** 이고 가격 parser 는 그중 **최소** 다(17건 중 2건).
                 종착지: 국내버킷 **5**(전부 COMPARISON) · 해외 4(올바름) ·
                 **KRW+UNKNOWN 4**(최대 회수 대상) · 가격없음 2 · EXCLUDED 2(올바름)
                 🔴🔴 **국내 EXACT 0 의 원인 = 색상 «미확인»** — 5건 전부
                 `modelCode exact` + `colorUnverified true` · 후보 `colorText` **전건 null**
                 ⟹ MI threshold/SAME 조건과 **무관** 하다
                 🔴 CF 다섯 **전부 기각** — 특히 CF-4(색상 완화)는 **순손실** 이다
                 (올라가는 2건이 **둘 다 Human DIFFERENT** · Human SAME 회복 **0**)
                 🔴 CF-2(KR 증거 확대)는 **같은 샵 안에서 갈린다**(donokids C21✓C22✓**C43✗**)
                 🟢 해외 대조군 오탐 0 · 🟢 상품페이지/가격/priceStatus 는 국내가 약하지 않다
                 (`docs/MI-DOMESTIC-CHAIN-063.md`)
WU-062           🟢 **구현 완료 / 배포** — `EXCLUDED` 를 **해외 금액 집계에서만** 제외(**1줄**)
                 🟢 관측은 남는다 — `byPriceTier`/`byMarket`/`count` **불변** ⟹ 「동일상품 아님 N」 유지
                 🔴 **셀러가 보는 숫자가 바뀐다** — EUR 최저 9→40 · USD 12→98 · 「판매처 N곳」 감소
                 🟢 국내 축 **불변**(국내 입력엔 EXCLUDED 가 애초에 없다) · `REFERENCE` 유지
                 🔴 **CEO Production 확인 1회 필요**(`docs/MI-EXCLUDED-AGGREGATE-062.md` §19 의 7항)
WU-061           🟢 **CLOSED** — 가격 증거/비교 경계 닫기 · 운영 변경 0
                 🟢🟢 **국내 가격 증거 회수 11/13** — 실패 2건은 **같은 사이트 하나**(beaumonde.co.kr)
                 🔴🔴 **가격 계층 3층(meta)을 추가하지 않는다** — 증분 회수 **0** 인데
                 불일치가 들어온다(C15 mustit ①226,000 ↔ ③233,000 KRW · 1/12 = 8.3%)
                 🔴 `EXCLUDED` 영향도 산출 — 금액 집계에서 빼면 EUR 9→40 · USD 12→98
                 🟢🟢 **transient 는 알림을 만들지 못한다** — `computeSellerAction`+
                 `computeMarketAlert` 를 **직접 불러** null 을 단언했다(소스 grep 아님)
                 🟢 Vision 실험 설계만 산출(FP 후보 **1** · precision 11/12 · recall 11/27)
                 (`docs/MI-PRICE-EVIDENCE-CLOSURE-061.md`)
WU-060           🟢 **CLOSED** — C06 False EXACT **원인 확정** · 운영 변경 0
                 🔴🔴 **게이트가 놓친 FP 가 아니다** — 다섯 축 전부 일치 · blockers 0 ·
                 후보가 **스스로** 같은 품번·같은 색상명을 적는다(사람은 **눈으로** 다른 색을 봤다)
                 🔴 C05(SAME)과 `colorText` 가 **글자 그대로 같다** → 텍스트 축에 신호 0
                 🔴 보호조건 6개 전수 측정 — 차단 성공 셋은 전부 **「데이터 풍부도」 프록시** ·
                 분모 **1** 이라 고를 수 없다 → **구현 0** (`docs/MI-FALSE-EXACT-ROOT-CAUSE-060.md`)
                 🟢🟢 **CF-3 을 열어도 알림 체인은 닫혀 있다** — 승격 5건 중 국내 축 자격 **0**
                 (시장 4 + **가격 1**). 즉 ①②의 실제 게이트는 **④(가격 추출)** 다 · N=5
WU-059           🟢 **CLOSED / HOLD** — 잔여 5영역 전수 측정 · **운영 동작 변경 0**
                 (배포 `339cc8e1` · 2026-10-18) · 🔴 **CPO 판정 5건** 이 §19 에 있다
                 (`docs/MI-RESIDUAL-AREAS-059.md`) — ①CF-3 ②파생 알림 ③해외 tier
                 ④`fixedPrice` 칸 ⑤C06 False EXACT. 🔴🔴 **①과 ②는 같이 판정한다**
가격비교 루프      🟢🟢 **CLOSED** — 더 쪼개지 않는다
다음             🔴 **CPO 가 지정한다.** CTO 가 선제적으로 WU 를 만들지 않는다
                 🔴🔴🔴 CPO 확정(2026-10-19 · WU-107): **「코드 수정 대기 상태가 아니라
                 «근거 추가 확보» 대기 상태」** — 🔴 새 WU 를 **자동 착수하지 않는다**.
                 🔴 재개 조건은 **둘 중 하나** 다:
                 ⒜ **동일상품 검색 표본 추가** — S3/S6 또는 별도 실제 조사 ·
                    원상품 URL/facts 확정 · 동일상품 후보를 **독립 GT 할 수 있어야** 한다
                 ⒝ **AI 조사 원문 저장이 가능한 정책으로 변경** — prompt/query/instruction ·
                    응답 원문 · 조사 대상 상품 식별자 · 모델/검색 세션 구분
                 🔴 그 전에는 **discovery 개선을 추측으로 구현하지 않는다**
CTO 지금 할 일    🔴 **없다** — 코드/기능/정책을 만지지 않는다
CEO Action       🟡 **Production UI 1회 확인**(WU-058 보고서 §19 의 7항)
```

🟢🟢 **제품 흐름이 «넷» 으로 고정됐다**(WU-058 축 A) — 이 네 단어가 화면의 진행 표시다:
```
① 상품 수집 → ② 시장 판단 → ③ 등록 준비 → ④ 커머스 등록
🔴 ③ 소싱 선택(`SOURCE_SELECTING`)은 **제품에서 제거됐다.** 그 자리는
   **AI 후보 URL → MI → 국내/해외 가격비교** 가 가졌다.
🔴🔴 **backend 는 지우지 않았다**(CPO §1·§5) — `sourcing_candidates` 테이블 ·
   `/api/products/[id]/sourcing-candidates` · `selected-source` · schema 전부 **그대로**.
   🟢 UI 호출부는 **0** 이다(`.tsx` 전수 grep). 「UI 없음」과 「backend 없음」을 섞지 않는다.
🔴 **문자열 grep 으로 지우지 않았다** — 「소싱 국가」(쿠팡 출고지) · 「국내 소싱」(원가 축) ·
   「소싱 가격」(해외 매입 원가) · 랜딩의 「소싱 담당자」(셀러의 직무)는 **일반 명사** 라 유지.
   기준은 하나다 — **「사용자에게 소싱이라는 «기능/단계» 를 가리키는가」**.
🔴 `master-ready.ts` 의 소싱 문구는 **API 응답 전용** 이고 UI 소비자가 **0** 이다(보존).
```

🔴🔴 **WU-058 이 배포 «전» 에 실제 결함을 잡았다 — 이 교훈을 남긴다**:
> builder 들이 단계 번호를 **하드코딩** 하고 있어서 소싱을 빼자 화면이 **「① ② ④ ⑤」**
> 가 됐다. 🟢 `resolveWorkflow` 가 **배열 순서에서** 번호를 매기도록 고쳤다.
> 🔴 「단계를 지웠다」로 끝내면 **번호가 거짓말을 한다** — 단계 수를 바꿀 때는
> **번호의 owner** 를 같이 본다.

🟢🟢 **핵심 전략 루프가 Production UI 까지 닫혔다** — 이 문장을 그대로 쓴다:
> **AI 후보 URL → 우리 MI 판정 → 가격 검증 → 국내/해외 가격비교 집계 → 사용자 UI**
> 두 축(국내·해외)이 **응답을 타고 화면까지** 연결됐고 **Production UI 에서 확인됐다**
> (WU-049 → 055 → 056 → 056-R1 · CEO PASS 2026-10-17).

🔴 **그래도 과장하지 않는다 — 남은 병목은 전부 «제품 정책» 이다** (🔴 WU-059 가 전수로 쟀다):
```
① 국내 `EXACT` **0** — 🔴🔴 **원인이 정정됐다**(WU-059). 「`BRAND_UNCONFIRMED` 가 남는다」는
   **증상** 이고, EXACT 를 막는 코드는 `match-truth.ts:233·237` 의
   **`crossSellerReserved`**(`verdict === "PRESUMED_SAME"`) 다. 🔴 `matchLevel` 은 **레버가 아니다**
   (`very_high` ↔ `low` 로 바꿔도 tier 가 같다 — 식별자 경로 둘이 모두 EXACT 로 매핑된다).
   🔴🔴 그리고 **WU-057 의 「FP 분모 0」은 틀렸다** — 완화는 «게이트» 단위로 적용되므로
   분모도 `BRAND_UNCONFIRMED` **단독** 군이어야 하고 거기에 Human DIFFERENT 가 **3건** 있다.
   GT 51 측정: 현행 EXACT 12(SAME 11·DIFF **1**) · 전면완화 28(DIFF **9**) ·
   단독완화 19(DIFF **3** — C50·C51) · **+품번 exact 17(DIFF 1 · FP +0)** ← 🟡 유일한 후보
   🔴 그 CF-3 도 **구현하지 않았다** — 품번 재사용 샵의 **다른 리스팅을 못 본 경우** 가
   표본에 없다(C19·C20 은 둘 다 관측돼서 막혔다) → **미측정 FP 모드.** CPO 판정 사안.
   🔴 현행에 **False EXACT 1건**(C06 `global.trenbe.com`)이 **이미 있다** — precision 11/12.
② beaumonde(C27) 가격이 **본문 텍스트** → 🔴 WU-059 실측으로 HOLD 가 강화됐다:
   `ld+json` 0 · microdata 0 · `og:price` 0 · `itemprop=price` 0 · **본문 금액 8개**(168,000원 포함) ·
   유일한 구조화 후보가 `set_goods_fixedPrice`(= **정가**, 플랫폼 종속) → 가격 오인 위험
③ transient 수명 — 🟢 **WU-059 가 보호계약으로 확정했다.** 참고 축은 POST 응답에서만 set 되고
   GET 이 **덮지 않는다**(세션 내 생존 · F5 에만 소멸). 🔴 client 영속화를 넣으면 참고가격이
   그것을 만든 POST 보다 오래 살아 **옆의 판정(GET=DB 전용)과 벌어진다** → 도입 금지.
④ 🔴🔴 **국내 참고가격은 «판정 입력» 이다**(WU-039 가 의도적으로 합쳤다 · WU-059 전수 확인).
   해외는 `push` 뒤 `continue` 라 판정에 **닿지 않는다**(문구가 정확하다).
   🔴 그리고 국내 경로가 `computeMarketAlert → openAlertIfNotActive` 로 **영속 `price_alerts`
   행** 을 만들 수 있다 — 「저장되지 않습니다」는 **가격** 이야기다.
   🟢 지금은 국내 EXACT 0 이라 발화하지 않는다. 🔴🔴 **그래서 ①과 ④는 «같은 선» 이다 —
   CF-3 을 승인하면 ④가 함께 열린다. 따로 판정하면 안 된다.**
⑤ 해외/국내 집계의 **tier 비대칭** — 국내는 적재 시점에 `EXACT|COMPARISON` 둘뿐인데
   해외 집계기(`summarizeCandidateOverseasPrices`)는 **tier 를 필터하지 않는다** →
   🔴 「동일상품 아님」(`EXCLUDED`)이 「해외 **동일상품** 참고가격」의 **최저가** 가 될 수 있다.
   🔴 WU-059 가 **숫자를 바꾸지 않았다**(CPO: 임의 필터링 금지) → CPO 판정.
```

### 🔴🔴 **지금 유효한 보호 계약 — 건드리기 전에 반드시 읽는다**

| 계약 | 소유 코드 | 불변식 |
|---|---|---|
| transient 저장 금지 | `transient-candidates.ts` · runner | `isTransientShopId(shopId)` 가 upsert 앞에서 끊는다 |
| `__url_candidates__` 생산자 | `url-candidate-pool.ts` (WU-024) | 🟢 **WU-023 병목은 이것으로 해소됐다** · AI 0 · Registry 참조 0 |
| SSRF / DNS rebinding | `outbound-guard.ts` · `guardedLookup` (WU-025/026) | 사설IP·루프백·비표준포트·리다이렉트·DNS 재바인딩 차단 |
| `COLOR_VARIANT` 보류 | `cross-seller.ts` (WU-044) | 색조 일치 + 색상명 불일치 → **보류**(DIFFERENT 아님) · 색상사전 확대 금지 |
| `SIZE_SYSTEM` 비차단 | `cross-seller.ts` (WU-045) | 사이즈 라인 차이 **단독으로 SAME 을 막지 않는다**(reasons 관측으로만) |
| 품번 충돌 보호 | `compareModelCode` | 공통 접두 ≥4자 뒤 분기 → **conflict**(AC042↔AC043 를 가른다) |
| microdata reader | `extractMicrodataFromHtml` (WU-053) | Product scope **정확히 1개** 일 때만 읽는다(2개+ = 목록) · Playwright 0 |
| 가격 신뢰도 단일 owner | `derivePriceStatus`(match.ts:537) | `priceSource === "detail"` ⟹ `VERIFIED_CURRENT` · 그 외 `UNVERIFIED_SEARCH` |
| 상세 가격 보존 | `product-url-facts` · `enrichCandidatePrices` (WU-055) | 상세에서 읽은 가격을 **되돌리지 않는다**(`priceSource:"detail"`) |
| 시장 분류 | `classifyCandidateMarket` (WU-020) | KR 증거는 **`.kr` TLD · 등록부 둘뿐** · **통화 단독 결정 금지** |
| 국내/해외 축 분리 | `market-intelligence.ts` | 국내 = `market==="KR" && priceKrw && tier EXACT\|COMPARISON` · 그 외는 해외/참고 |
| 환산 금지 | `overseas-reference.ts` | 통화별로만 집계 · **합계 칸이 없다** · 기호 변환 0 |
| 참고가격 라벨 | `TIER_LABEL` (WU-056) | `EXCLUDED → "동일상품 아님"` — 🔴 **영문 내부 토큰 노출 금지** |
| 국내 문구 경계 | `DOMESTIC_REFERENCE_SCOPE` (WU-056) | 🔴 「판매판정 미반영」을 **국내에 단정하지 않는다**(알림 경로 때문) |
| 🔴 **가격 구역 식별** | `wu-056r1-price-section-identity.test.ts` | 구역 제목 **상호 비포함** · 해외 구역 «안» 에 `₩`/`약`/`≈`/통화기호 **0** · 아이콘 중복 금지 — **Panel mount DOM 으로** 본다 |
| 🔴 **단계는 넷 · 번호는 파생** | `workflow.ts` · `stage-focus.ts` (WU-058) | 큰 단계 **4** · 라벨에 「소싱」 0 · 단계마다 본문 **하나**(빈 단계 0) · **번호는 배열 순서에서 파생**(하드코딩 금지) |
| 🔴 **URL 분류기는 양방향 오류** | `classifyUrlShape` (WU-073) | 한국 CMS 목록(`goods_list`·`product_list`·`shopbrand`)이 **PRODUCT_PAGE** · SSG `itemView.ssg` 는 **오차단** — 🔴 「②의 탈락 = 정확한 차단」으로 읽지 않는다 · 고치지 않는다(WU-052 HOLD) |
| 🟢 **UI 는 `priceTier` 를 읽지 않는다** | `GeminiTransientCandidates` (WU-098) | 그 필드가 **필수** 인 이유는 화면이 아니라 **MI 집계** 다 · 🟢 그래서 「판정 보류 후보」는 **tier 없이** 화면에 설 수 있다 · 🔴 단 **MI 인자에 넘기지 않아야** 한다 |
| 🔴🔴🔴 **transient sink 는 «집계 입력» 이다** | `transientEvidenceSink` → `market-intelligence:226` (WU-097) | 화면 배열이자 **가격 축 적재 입력** 이다 · 🔴 「보여주려고」 넣으면 **가격 집계가 오염된다** · 🔴 `priceTier` 가 **필수** 라 판정 없는 후보는 **넣을 수 없다**(지어내면 금지) · 🟢 계약 6건이 이 경계를 잠근다 |
| 🔴 **[WU-098 에서 정정] 판정하지 않은 후보에도 «교차판매처» 라벨은 있다** | `observed.candidate` (WU-098) | `DROPPED` 는 verdict·matchTruth·blocker 가 **존재하지 않는다** ⟹ WU-091 의 「행마다 판정 라벨」을 **못 지킨다** · 🔴 「판정 보류」라는 새 상태는 **제품 정책** 이고 CTO 가 만들지 않는다 |
| 🔴🔴 **⑧ 은 «비용» 게이트인데 «노출» 까지 결정한다** | `isEvidenceEvaluationWorthwhile` + `transientEvidenceSink.push` (WU-096) | `candidates[0].matchLevel !== "low"` 가 false 면 **샵 전체 DROPPED** → transient 배열에 **안 실린다** → 화면에서 사라진다 · 🔴 **WU-091 의 「후보 노출 ≠ SAME 판정」과 충돌** · 🟢 등록부 «검색 화면» 은 이 게이트와 **무관**(직접 렌더) |
| 🔴 **UI 게이트가 경로마다 다르다** | `mayShowCandidate` ↔ `evidence.map()` (WU-096) | 등록부 검색 표 = `mayShowCandidate` · **transient 카드 = 게이트 0(전건 렌더)** · 🔴 섞으면 「UI 에서 사라진다」는 **거짓 결론** 이 난다(실제로 1차에 났다) |
| 🟢🟢 **샵 대표는 «색상 증거» 를 2차 키로 쓴다** | `orderByCrossSellerVerdict` (WU-113) | verdict 등급이 **같을 때만** 발화하는 2차 키 · 색이 **있고 COLOR 충돌이 없는** 후보가 먼저 · 🔴 1차 키를 **넘지 못한다** · 🔴 원상품 색 없으면 **순서 불변** · 🔴 제목에 색을 적은 후보가 **유사도에서 손해** 보는 모양이 실재했다(tinyapple USD 53 ↔ 58) · M1~M4 가 잠근다 |
| 🔴🔴 **집계와 UI 가 `priceStatus` 를 다르게 본다** | `summarizeCandidateOverseasPrices` ↔ `isPriceDisplayable` (WU-111) | 집계는 **안 보고**(EXCLUDED 만 뺀다) UI 는 **VERIFIED_CURRENT 만** 숫자를 낸다 ⟹ 🔴 「해외 최저가」가 뜨는데 **그 근거 줄에는 「가격 확인 필요」** 가 뜰 수 있다(S1 EUR 40 실측) · 🔴 **가격 정책이라 CTO 가 고치지 않는다** |
| 🟢 **Shopify JSON 가격은 «통화가 명시될 때만»** | `shopifyVariantPrice` (WU-110) | `variants[0].price` **AND** `price_currency` 둘 다 있어야 한다 · 통화 **대문자 3글자** · 0 이하 **null** · 🔴 **`variants[0]` 고정**(선택 규칙은 `fetchShopifyProductJson` 소관) · 🔴 **추가 HTTP 0** · M1~M5 가 잠근다 |
| 🔴🔴 **판정 함수를 직접 부르는 테스트는 «배선» 을 못 본다** | WU-110 교훈 | `price: shopifyVariantPrice(body)` 를 `null` 로 되돌려도 **0 failed** 였다 · 🟢 **소스 앵커를 같이** 둔다(배선 + 안전조건) |
| 🟢🟢 **숫자만인 URL 세그먼트는 식별자가 아니다** | `SLUG_IS_NUMERIC_ONLY` ×3 (WU-095) | `match.ts` · `product-identity.ts` · `shared/product-facts.ts` **세 벌 전부** 같은 가드 · 🔴 하나만 고치면 다른 경로에서 거짓 신호가 계속 난다(M1~M3 각 2 FAIL) · 🔴 **Shopify handle 일치는 그대로 살아 있다**(M4 3 FAIL 이 양방향으로 잠근다) |
| 🔴 **GT 라벨은 «인덱스» 로 붙이지 않는다** | `fixtures/wu-093-human-gt.json` (WU-095) | `withConfidence` 가 **정렬** 하므로 코드가 바뀌면 순서가 바뀐다 · 🔴 실제로 「human SAME 인데 conf 0」이 나왔다 · 🟢 **SKU 키** 로 고정 |
| 🔴🔴🔴 **`matchLevel` 을 신뢰하지 않는다** | `extractSlug` · `match.ts:81·477` (WU-094) | Cafe24 URL 이 전부 `…/display/1/` 로 끝나 **slug 가 「1」로 충돌** → 0.95 바닥값이 **무조건** 발화 · 🔴 CF 로 끄면 **0.95 → 0.1** · 🔴 소비처 **여섯**(그중 **Gemini 스킵**·**가격 비용**) · 🔴 **SAME 로직에 결합 금지**(정밀도 2/5) |
| 🔴 **「모델명 유사도 0%」와 「URL slug 일치」가 같이 있으면 버그다** | `matchReasons` (WU-094) | 두 문장은 같이 설 수 없다 — reasons 가 **스스로 모순을 적고 있었다** · 🔴 점수를 볼 때 **reasons 를 같이** 읽는다 |
| 🔴🔴 **「안 맞는다」를 「틀린 답」으로 읽지 않는다** | WU-093 GT (CEO 라벨 10건) | **False SAME 0 · Human DIFFERENT 8/8 차단 · recall 0/2** ⟹ 증상은 **「답 없음」** 이다 · 🔴 그리고 **같은 화면의 S1(matching)과 S2(coverage)는 서로 다른 문제** 라 한 처방으로 안 풀린다 |
| 🔴🔴🔴 **S1 의 SAME 2 와 DIFFERENT 1 은 «구별 불가» 다** | `crossSellerReasons` (WU-093) | 축 문자열이 **글자 그대로 같다**(코드 null · 색상 null · 상품군 TOP · 제목겹침 「보보쇼즈」) ⟹ 🔴 **완화 = False SAME +1**(precision 2/3) · 🔴 가격 축은 **만들지 않는다**(S1-1 이 가격 달라도 SAME) |
| 🔴🔴 **「후보 0」을 보면 하니스부터 의심한다** | `DomesticSourceRef` (WU-092) | `collectionStrategy`/`currency` 가 없으면 운영이 **요청을 안 보내고** `unsupported` 를 준다 · 🔴 `as never` 로 타입을 가리면 **「A_DISCOVERY」라는 거짓 결론** 이 난다(실제로 났다) |
| 🔴 **한국어 제목은 «띄어쓰기» 로 축이 죽는다** | `coreTitleTokens` (WU-092 관측) | 「허그 헤어리 몬스터 티셔츠」 ↔ 「허그헤어리몬스터티셔츠」가 **브랜드명 한 토큰만** 겹친다 · 🔴 정규화는 **새 매칭 규칙** 이라 금지 · 🔴 전수 빈도 **미측정** |
| 🔴🔴 **후보 노출 ≠ SAME 판정** | `CandidateComparison` (WU-091) | SAME 이 아닌 후보도 **보인다** · 🔴 단 **기본 접힘**(`details` 에 `open` 금지) · **행마다 판정 라벨** · 「가격비교에 사용되지 않습니다」 명시 — 넷 중 하나라도 빠지면 **2026-09-19 사고**(「유력 후보 5건」)가 되돌아온다 · 🔴 `isVisualCheckTier` 정책은 **불변** |
| 🔴 **「후보 없음」과 「동일상품 없음」은 다른 문장** | `NO_CANDIDATE_AT_ALL` / `NO_SAME_BUT_CANDIDATES` | 둘을 같은 말로 만들면 셀러에게 **같은 실패** 로 보인다(M6 가 1 FAIL 로 잠금) |
| 🔴 **사람 검토는 시스템 판정을 덮지 않는다** | `GeminiTransientCandidates` · `MiPanelView` (WU-081) | `gt-verdict`(시스템)와 `gt-review-result`(사람)는 **다른 state·타입·DOM** · 클릭이 `fetch` **0회** · MI/가격/알림/판매판정/등록 payload 에 **들어가지 않는다** · 🔴 `onReview` 없는 구역엔 버튼이 **렌더되지 않는다** |
| 🔴 **국내 행은 «옮긴다» 복제하지 않는다** | `TransientCandidateSections` (WU-081) | `market==="KR"` 행만 🇰🇷 구역으로 이동 · 기존 두 구역은 나머지 · **총 행 수 불변**(계약) |
| 🔴🔴🔴 **여덟 보호축을 다시 파지 않는다** | WU-063~080 통합 (CPO CLOSED 2026-10-18) | **COLOR · TITLE · MODEL_CODE · LINE · MARKET · PRICE · LANGUAGE · BRAND** — 여덟 축 전부에서 「완화하면 Human DIFFERENT 가 같이 열린다」가 **측정됐다** · 🔴 **국내 recall 은 현 구조의 한계로 «확정»** · 🔴 「gate 가 너무 엄격하다」로 읽지 않는다 · 🔴 **이 축들을 다시 파는 WU 를 만들지 않는다**(새 경로는 **CPO 가 지정**) |
| 🔴🔴 **AI URL 품질은 산출을 못 늘린다** | WU-089 counterfactual | 상세페이지 전용으로 바꿔도 **price 12→12 · market 8→8 · 국내 9→9 · 해외 3→3**(전부 **0**) · 줄어드는 건 **분모**(181→68) · 🔴 「AI 지침」 owner 가 **코드에 없다**(붙여넣기 경로) |
| 🔴🔴 **가격 상세확인은 «상한» 이 아니라 «자격» 에서 막힌다** | `selectCandidatesForDetailConfirmation` (WU-088) | ⒜ matchLevel 자격 필터에서 **64/64 전건 탈락** · ⒝ 상한 2 는 **발화 0** ⟹ 🔴 **상한을 올려도 변화 0** · 「비용 게이트가 낮다」로 읽지 않는다 |
| 🟢 **헤더 초과만 직접 스택으로** | `domain-rate-limiter.ts` `isHeadersOverflow` (WU-084) | `UND_ERR_HEADERS_OVERFLOW` **전용 코드** 로만 판별(문구 금지) · **overflow 에서만** 1회 재시도 · 기존 `retryThroughDirectStack`(64KB · SSRF 가드) 재사용 · hostname 조건 **0** · 실패 시 **원래 오류 전파** |
| 🔴 **domain = brand 금지(계약으로 잠김)** | `wu-080-brand-producer.test.ts` | 도메인/판매처 이름으로 브랜드를 만들면 **2 FAIL** · 🔴 샵이 `brand` 자리에 **자기 이름** 을 적는 경우가 실재한다(biskuit 「비스킷」) |
| 🔴🔴 **BRAND_UNCONFIRMED 는 «정확한 상태» 다** | `cross-seller.ts:751·999` (WU-080) | 13건 중 6건은 **원상품 brand 가 null** 이라 걸린다(후보는 있다) · 🔴 원상품 공백을 메우면 보류→**충돌** 로 악화(SAME 4 더 막힘 · DIFFERENT 2 열림) |
| 🔴 **generic 숫자 parser 금지(계약으로 잠김)** | `wu-079-price-producer.test.ts` | 「N원」을 가격으로 쓰면 **4 FAIL** · 🔴 `class`(price/sale/cost) 축은 성공군에서 **5/9 오추출**(배송비·적립금·다른상품) |
| 🔴 **통화 가드의 owner 는 pricing 패키지다** | `packages/pricing/src/price-validity.ts` `resolveSourcePrice` | `priceFromJsonLd` 의 `if (!currency)` 는 **도달하지 않는 2차 방어선** — 통화 규칙을 고칠 때 **그 파일을 본다** |
| 🟡 **SHOPIFY_JSON 경로는 HTML 을 안 본다** | `factsFromProductUrl` (WU-079) | 그 경로 후보는 페이지의 JSON-LD 가격을 **영구히 못 본다** · 🟢 지금은 `enrichCandidatePrices` 가 메운다 · 🔴 그 경로 실패 조건은 **미측정** |
| 🔴🔴 **보호축을 «하나씩» 풀지 않는다** | WU-065~078 통합 (CPO 확정 2026-10-18) | `NO_TITLE_OVERLAP` 효과 **0** · `COLOR` 위험 확인 · `MODEL_CODE/CONFLICT` FP 위험 · `MARKET` 안전한 추가 증거 **없음** · `BRAND` **FP +2 실측**(WU-059) ⟹ 🔴 **현재 MI 보호 로직을 그대로 유지한다** · 🔴 BRAND·MODEL_CODE 약화 방향 **계속 금지** |
| 🟡 **언어 축은 «안전조건» 이지 회수수단이 아니다** | WU-078 | `NO_TITLE_OVERLAP` 4건은 **품번 exact 4/4**(한글 제목에 라틴 품번) · 음역은 SAME 3(≥2) / DIFF 1(=1) 로 갈리지만 **회수 0**(BRAND 축이 남는다) · 🟢 풀 때 **C08 이 뚫리는 것을 막는 전제조건** · 🔴 단독 WU 로 다시 열지 않는다 |
| 🔴 **정규식을 쉘/파이썬으로 편집하지 않는다** | WU-078 교훈 | 이스케이프가 **0x08·0x01 제어문자**로 박혀 측정이 조용히 틀렸다 · 🔴 역참조(``) 금지 · Edit/Write 로 쓴다 |
| 🔴🔴 **⑥ market gate 는 완화 불가** | `classifyCandidateMarket` (WU-077) | 탈락 10 = 해외 4 + **증거부족 4** + 가격없음 2 · 🔴 회수하면 **국내 최저가가 Human DIFFERENT(₩59,000)** 로 바뀐다 · 한국어/사업자 축은 **같은 4건**(독립 아님) · `.kr` 단독은 **변화 0** |
| 🔴 **라벨만 보면 놓치는 오류가 있다** | WU-077 CF-2 | KRW 단독 완화의 최저가는 Human **SAME** 인데 출처가 **해외 사이트의 한국 표시가**(junioredition) — 🔴 Human GT 만으로 CF 를 판정하지 않는다 |
| 🟡 **200 soft-404 는 «능력만» 실재** | WU-076 CONTROL | 40 호스트 중 **2**(littleluna·wconcept · **둘 다 한국몰**) · 🟢 **후보 적중 0/90** → HOLD · 🔴 텍스트 휴리스틱 **금지 유지**(정상상품 11/64 오차단) · 🟢 열 때의 축은 **`canonical`→루트**(오차단 0/64 · 추가 HTTP 0) |
| 🔴 **CONTROL twin 은 «식별자» 를 바꿔야 한다** | WU-076 | 경로 **마지막 칸** 을 바꾸면 Cafe24 는 `…/display/1/` 꼬리표라 **같은 상품** 이 온다 — 🔴 1차에서 「200 5건」이 나왔고 실제는 **2건** 이었다 · 무효 판정 = **bogus 제목 == 후보 제목** |
| 🟢🟢 **도착지 모양 방어** | `product-url-facts.ts` · `fetchPlainHtmlWithFinalUrl` (WU-075) | `classifyUrlShape(finalUrl) !== PRODUCT_PAGE` ⟹ **`REDIRECTED_AWAY`** · 추가 HTTP **0** · 🔴 fetch owner 는 `fetchPlainHtmlWithFinalUrl` **하나**(`fetchPlainHtml` 은 위임 껍데기) · 🔴 리다이렉트 **없는** 200 soft-404 는 **미방어**(WU-076) |
| 🔴 **④ 의 과거 결함(WU-074)** | `product-url-facts.ts` (기록) | HTTP ok + `<title>` 이 전부였고 `response.url` 을 버렸다 → 홈/soft-404 가 통과 · 🟢 **WU-075 에서 닫혔다** · 🔴 CEO 의 「404」 4건이 **전부 HTTP 200** 이라는 사실은 유효 |
| 🟢🟢 **최종 URL 모양이 유일한 안전축** | `classifyUrlShape(finalUrl)` (WU-074) | 비상품 6/6 차단 · 오차단 **0/64** · **추가 HTTP 0** · 🔴 JSON-LD/og:type/soft-404 텍스트는 **전부 정상상품을 죽인다** |
| 🔴 **방어 배선이 둘로 갈려 있다** | `resolveCandidate` (WU-074) | Gemini 경로만 거친다 · **AI·URL 후보 경로는 안 거친다** · 🔴 고치는 것은 CPO 판정 사안 |
| 🔴 **발견량은 병목이 아니다** | WU-073 funnel | AI 국내 후보 **46** → 최종 EXACT **0** · 레버는 **② URL 분류 → ⑥ 시장 증거** 순 · 🔴 discovery 를 늘리는 WU 를 만들지 않는다 |
| 🔴 **소싱 backend 보존** | `sourcing_candidates` · 관련 route/schema | UI 호출부 **0** 이지만 **지우지 않는다**(참조 확인 전 삭제 금지 · CPO §1·§5) |
| 🔴 **EXACT 보류 게이트** | `match-truth.ts:233·237` (WU-059) | `PRESUMED_SAME` ⟹ 식별자 경로도 **막는다** · `BRAND_UNCONFIRMED` 단독 완화 **금지**(FP +2 실측) |
| 🔴 **참고가격 ↔ 판정 경계** | `market-intelligence.ts:253·318` (WU-059) | 해외 = `push` 뒤 `continue`(판정 0) · 국내 = `EXACT\|COMPARISON` **만** 적재(판정 입력) |
| 🔴 **transient 수명** | `DomesticPriceIntelligencePanel` (WU-059) | 참고 축은 **POST 응답에서만** set · GET 이 덮지 않는다 · `sessionStorage`/`localStorage` **금지** |
| 🔴 **색상 축이 마지막 방어** | `isColorUnverified` · `COLOR_VARIANT` (WU-060) | C22(품번 exact·단독 blocker)를 막는 **유일한** 축 — 빼면 **False EXACT** 가 된다 |
| 🔴 **동일판매처 이중 잠금** | `sameSellerDistinctListing` + `crossSellerReserved` | 🔴 분류표만 빼도 결과가 **안 바뀐다**(잠금이 둘) — 「통과했다」를 「가드 없다」로 읽지 않는다 |
| 🔴 **False EXACT 보호조건 금지** | `wu-060-false-exact.test.ts` | 사이즈/소재/카테고리 **부재** 를 EXACT 차단 근거로 쓰지 않는다(인과 0 · 쓰레기를 보상) |
| 🔴 **후보 가격 계층은 둘** | `product-url-facts.ts:248` (WU-061) | `priceFromJsonLd ?? micro?.price` **만** · `extractFromOpenGraph` 는 **원상품 전용**(후보에 끌어오면 불일치) |
| 🔴 **해외 금액 집계 = EXCLUDED 제외** | `candidate-market.ts` (WU-062) | 금액(`byCurrency`)에서만 뺀다 · `byPriceTier`/`byMarket`/`count` **유지** · `REFERENCE` 는 **빼지 않는다** |
| 🟢 **transient 는 알림 0** | `computeSellerAction`+`computeMarketAlert` | transient 만 있으면 alert **null** · 🔴 `priceLevel` 이 오르는 순간 **열린다**(CF-3 과 결합) |
| 🔴 **색상 축이 국내 마지막 방어** | `isColorUnverified` (WU-063) | 국내 버킷 5건 전부 `exact`+`colorUnverified` · 풀면 **Human DIFFERENT 2건만** 올라간다(순손실) |
| 🔴 **색상 생산자는 제목 전용** | `seller-facts.ts:264` (WU-064) | `extractColorFromTitle(title)` **화이트리스트** · HTML 미사용 · 임의 텍스트를 색상으로 쓰지 않는다 |
| 🔴 **국내 EXACT 0 의 진짜 원인** | `NO_TITLE_OVERLAP` (WU-064) | 한국어 제목 ↔ 영문 원상품 = 토큰 겹침 0 → **관측된 차이** 로 분류돼 EXACT 영구 차단 |
| 🔴 **국내는 «세 겹» 으로 막힌다** | WU-065 | ①NO_TITLE_OVERLAP ②colorUnverified ③PRESUMED_SAME 보류 — **하나만 풀면 변화 0** |
| 🔴 **국내 구조화 색상은 1/17** | WU-072 | microdata 색상은 **읽는 칸 자체가 없다** · 색상 글자 10/17 은 **산문**(WU-047 HOLD 자리) |
| 🔴🔴 **COLOR 가 L4 의 단독 하중** | `cross-seller.ts` COLOR conflict (WU-071) | 빼면 **12건** 즉시 False SAME · 🔴 국내 후보엔 그 방어가 **애초에 없다**(colorText null) |
| 🔴 **slug 가 품번으로 승격된다** | `seller-facts.ts:208` · `extractCodeLikeSlugSegment` | kids21 **샵 자체 SKU** 가 통과한다 · 🟢 지금은 conflict → EXCLUDED 로 **안전 방향** 오류다 |
| 🔴 **라인 코드를 보는 코드는 없다** | `compareModelCode` (WU-070) | `AC`/`AB`/`AI` 를 **아무도 구분하지 않는다** · L4 를 막는 것은 색상·카테고리·브랜드다 |
| 🔴 **CONFLICT 는 삼중 잠금** | `match-truth.ts:176·178` + `crossSellerReserved` (WU-069) | ①cross CONFLICT ②modelCode conflict ③보류 — **하나만 풀면 변화 0** · 셋 해제는 품번 보호 해체 |
| 🔴🔴 **`crossSellerReserved` 는 정밀도의 기둥** | `match-truth.ts:233` (WU-066) | 우회하면 186쌍에서 precision **91.7% → 55.6%** · False SAME 1→16 — **영구 폐기안** |
| 🔴 **`NO_TITLE_OVERLAP` 은 유효하다** | `cross-seller.ts:871` (WU-066) | A 군 **18/18 이 DIFFERENT** — 전면 비차단 금지(단독 완화는 효과도 0) |
| 🔴 **KR 증거는 샵 단위여야 한다** | `classifyCandidateMarket` (WU-063) | 페이지 단위 신호(사업자등록·`lang=ko`)는 **같은 샵에서 갈린다** — 채택 금지 |
| 🔴 **통화 단독 KR 결정 금지** | `classifyCandidateMarket` | `.kr`+외화 = **충돌** · KRW+도메인증거없음 = UNKNOWN (mutation M2b·M2c 로 잠겼다) |

### 🟡 WU-099 `MI-DROPPED-REVIEW` — **가치 검증 페이지 구축 · CEO 평가 대기** (운영 0)

🟢 전문 `docs/MI-DROPPED-REVIEW-099.md`. 🔴 **운영 파일 변경 0** · 배포 0 · MI 전달 0 · UI 본편 0.
```
URL  https://claude.ai/code/artifact/5249e23c-ce08-4afd-891f-0cb977453335
대상 운영 judgeDomesticCandidate 의 **DROPPED 샵당 top 1건** = **26건**(JUDGED 4)
     crossSellerVerdict **CONFLICT 16 · SIMILAR 8 · UNKNOWN 2** · dropGate **전건 EVIDENCE_NOT_WORTHWHILE**
🟢 보존 범위가 샵당 1건이라 **DomesticJudgement 계약 변경 0**(WU-098 §5 앞쪽 선택지)
🔴 생성물에 `priceTier` **0** · `matchTruth` **0**(grep) — **만들지 않았다**
```

🔴 **이미지 11/26 없음 — 「차단」이 아니라 「없음」이다**: `imageUrl` 이 **애초에 null 11/11** ·
fetch 실패 **0**. 🔴 WU-093 에서 한 번 오진한 자리라 **갈라서** 적는다. 운영 추출은 **고치지 않았다**.

🔴🔴 **CEO 지적으로 한 번 고쳤다 — 「원상품이 뭔지 알려줘야 비교할 수 있다」**:
1차 페이지는 후보만 보여주고 **원상품을 설명 문장에만** 적었다. 육안 비교가 목적인데
**비교 대상이 화면에 없었다**(내 누락). 🟢 **맨 위에 고정되는 원상품 패널** 을 넣었다 —
`Bobo Choses Pop T-shirt · B226AC112 · offwhite` · 🔴 **가격 없음**(SHOPIFY_JSON · 지어내지 않음).
🔴 운영 추출기는 **고치지 않았다**(검증 화면용으로 facts 를 읽기만 했다).

🟢 회귀 **600 files / 8,367 passed · failed 0** · typecheck 0 · build exit 0.
🔴🔴 **CEO 평가 26/26 수신 — 그런데 «절반이 측정불가» 다**:
```
USEFUL **2** · NOISE **12** · UNSURE **12**
🔴🔴 UNSURE 12 ↔ **이미지 문제 12** 가 «완전히 일치» 한다(교차 확인)
   imageUrl 이 애초에 null **11** + 이미지가 잘려서 판단불가 **1**(luksusbaby)
   「이미지 null 인데 UNSURE 아닌 곳」 **0** ⟹ 가치 판단이 아니라 **못 본 것** 이다
⟹ 유효 분모는 26 이 아니라 **14**(53.8%) · 🔴 나머지 12 는 **측정불가**(0% 아님)
```

🔴🔴 **그리고 USEFUL 2 가 같은 상품군을 NOISE 라 한 것과 «충돌» 한다**:
```
NOISE   bobochoses.com     Booty Ghosts T-shirt
NOISE   junioredition.com  Booty Ghosts T-Shirt by Bobo Choses
USEFUL  eraldo.com         Booty Ghost-print **Long-sleeve** T-shirt   ← 더 다른데 USEFUL
USEFUL  kolkid.ca          Booty Ghosts T-Shirt                       ← 사실상 같은 제목
🔴 「유용함」이 **동일상품인지 참고가치인지 기준이 글로 없다** · CTO 가 해석하지 않았다
```

🔴 ⟹ **「DROPPED 보존이 가치 있다/없다」를 이 숫자로 결정하지 않는다.**
🟡 재측정 선택지 둘(**CTO 가 고르지 않았다**) — ⒜ 이미지 11건을 검증 화면용 `og:image` 로
보충해 분모를 26 으로(WU-093 에서 원상품에 쓴 방법 · 운영 추출기 변경 0) ⒝ **「유용함」의
기준을 한 줄로 고정**. 🔴 ⒝ 없이는 재측정해도 **같은 충돌이 난다**.

🟢 CEO 라벨은 `fixtures/wu-099-human-value.json` 에 **도메인 키** 로 고정했다(WU-095 교훈).

### 🟡 WU-116 `MI-DOMESTIC-SUPPLY-116` — **AI 경로도 국내 공급을 못 늘렸다** (구현 0 · 가격 0)

🟢 전문 `docs/MI-DOMESTIC-SUPPLY-116.md`. 🔴 운영 변경 **0** · 배포 0 · 가격 **0** ·
Registry **0** · Adapter **0** · 8축 **0** · AI API **0** · 자동 브라우저 **0** · 포털 **0**.

🟢 공급원 = `cto-websearch`(WU-073 과 같은 라벨 · 비용 0) · 질의 **2건**.
🔴 검색이 돌려준 URL 을 **그대로** 넣었고 **best 선정·가격 보강을 부르지 않았다**
(`judgeDomesticCandidate` 0 · `enrichCandidatePrices` 0 ⟹ 후보가 잘리지 않는다).

```
        AI URL  추출통과  후보  **새 후보**
S1        7       3       1      **1**
S2        6       2       1      **0**(trenbe · 기존 GT)
[NEW] kream.co.kr  PRODUCT_PAGE · market **KR** · **CONFLICT** · 품번 null
      「(Kids) Bobo Choses Long Puff T-Shirt Lavender」 ← 🔴 제목이 **다른 상품** 이다
      🔴 단 **CTO 가 판정하지 않았다** · CEO 판정 1건 대기
```

🔴🔴 **관측된 병목이 Registry 가 아니다**:
```
AI 가 준 13 URL 중 **상품 상세는 5개** · 나머지는 브랜드/컬렉션/홈/가이드글/중고키워드/쿠팡샵
🟢 그 탈락은 **올바르다**(운영 추출기·classifyUrlShape 가 걸렀다)
🔴🔴 ⟹ **한국어 검색이 「상품 상세 URL」 을 거의 돌려주지 않는다.**
   국내에서 **파는 샵 이름은 나오는데**(보몽드·도노키즈·크로켓·OCO·쿠팡)
   그 샵의 **상세 URL 이 검색 결과에 없다**
🔴 그 상세 URL 을 **내가 추측해 만들지 않았다**(URL 지어내기는 금지 행위)
🔴 **일반화 금지** — 원상품 2개 · 질의 2건 · 검색어 튜닝 반복 **안 함**
```

🔴 **WU-115 결론은 그대로 유지** — 「현재 Registry 만으로는 공급이 부족하다」.
🔴 그러나 「국내 동일상품을 찾을 수 없다」로 **올리지 않는다**(표본 2건).

### 🔴🔴 WU-115 `MI-DOMESTIC-SUPPLY` — **국내 공급 부족 확정 · 어댑터가 막는다** (구현 0)

🟢 전문 `docs/MI-DOMESTIC-SUPPLY-115.md`. 🔴 운영 변경 **0** · DB 변경 **0** · Registry 변경 **0** · 가격 **0**.

🔴 **`MANUAL` 은 12곳이 아니라 13곳이다**(DB 실측) — 지시서/헌장의 「12」를 정정한다.

🔴🔴 **STEP 2 결과 — 새 국내 후보 0건이고, 원인이 「MANUAL 이라서」가 아니다**:
```
판매처 4곳(chouchouenfant · coconjennie · karymarket · nokimore)에 반사실로
**AUTO_SCRAPE 를 세워도** 전부 `status: "unsupported"` · 후보 **0**
🔴 게이트가 **둘** 이다(index.ts:271·278):
  ① 전략이 AUTO_* 가 아니면 unsupported
  ② **findPriceSourceAdapter(domain,"DOMESTIC") === null** 이면 unsupported  ← 🔴 여기서 막힌다
⟹ 🔴🔴 **등록부 전략을 바꿔도 후보는 0 이다. 막는 것은 «도메인 어댑터 부재» 다.**
🟢 국내 어댑터는 **8개** — looxloo · bobochoses(**disabled**) · rulii · skysport(**TENNIS**) ·
   deuxbebe · littleluna · chocoel · foretforet ⟹ 아동의류 실효 **6곳**
🔴 등록부 34곳 중 **26곳은 어댑터가 없다** — 「등록부에 있다」≠「뒤질 수 있다」
```

🟢 **조사 전에 대상을 가렸다** — 포털/오픈마켓 **9곳은 검색하지 않았다**(약관 · 메모
`portal-scraping-blocked-by-terms`). robots 13곳 전수 조회 — 200 **11** · 실패 2 ·
**전면차단 4**(musinsa · wconcept · kidikidi · shoppinghow — 전부 포털).

🔴🔴 **STEP 4 성립 — 「현재 Registry 구조로는 국내 동일상품 후보 공급이 부족하다」 확정**:
```
① MANUAL 13 중 판매처는 **4** 이고 그 4곳은 **어댑터가 없어 검색 자체가 안 된다**
② 나머지 **9곳은 포털** 이고 약관으로 자동수집 대상이 아니다
③ 아동의류 실효 6곳은 WU-114 에서 **정상 응답 + 후보 0**(그 상품을 안 판다)
⟹ 🔴 공급을 늘리는 길은 **샵별 어댑터 추가** 하나이고 그것은 §12-0 이 **금지한 방향** 이다
   ⇒ 🔴 **CTO 는 어댑터를 만들지 않았다.** 다음 결정은 CPO 몫이다
🟡 참고 — 현재 국내 후보 3건은 **전부 「AI URL 풀」** 산출이다(WU-114) ⇒
   🔴 지금 국내 공급은 **등록부가 아니라 AI 가 하고 있다**(그 확대는 AI 정책 영역)
```

🔴 **측정불가로 남긴 것** — 판매처 4곳이 그 상품을 **파는지 안 파는지는 모른다**
(검색이 돌지 않았으므로 「없다」가 아니라 **「확인 불가」**). 포털 9곳도 「후보 0」으로 세지 않는다.

### 🔴🔴 WU-114 `MI-CANDIDATE-INVENTORY` — **국내는 「노출」이 아니라 「공급」 문제다** (구현 0)

🟢 전문 `docs/MI-CANDIDATE-INVENTORY-114.md`. 🔴 운영 변경 **0** · 배포 0 · 가격 작업 **0**.

🔴🔴 **WU-112 분모를 정정한다 — 국내 후보 생산자는 «둘» 이다**:
```
ⓐ AI URL 풀  collectUrlCandidatePool  — WU-112 가 쟀다(27건)
ⓑ 등록부 검색  searchDomesticShops      — 🔴 WU-112 **분모 밖** 이었다
🔴🔴 그 ⓑ 를 운영 함수로 돌렸다 — **후보 0 / 0**
   S1 · S2 둘 다 샵 응답 **{ok: 6} · 오류 0** 인데 **후보가 0** 이다
   ⟹ 「검색 실패」가 아니다 — **그 상품을 안 판다**(WU-009/010/085/092 와 같은 답)
⟹ 🔴 **국내 후보 공급자는 사실상 「AI URL 풀」 하나다**
```

🔴 **후보 재고 전수**:
```
        총 후보  AI풀  등록부  🇰🇷국내  🌎해외  ❔미확정  🔴화면에 서는 수
S1        15     15     **0**      2      10      3        **8**
S2        12     12     **0**      1       9      2        **9**
🇰🇷 한국 도메인 후보 — S1 **4**(beaumonde ×2 · luksusbaby ×2) · S2 **1**(biskuit)
🟢 국내 Human SAME **2건**(beaumonde · biskuit)은 **둘 다 샵 대표로 화면에 선다**
🔴 단 beaumonde 는 가격이 없어 market **UNKNOWN** — 국내 축에는 못 들어간다
   🔴 그 복구는 **가격 작업** 이라 보류다(§00-B)
```

🔴🔴 **CPO 분기표 — 답**:
```
① 국내 후보 충분함                    ❌ 아니다(상품당 1~4건 · 공급자 하나)
② 발견 단계 문제                     🟡 **여기에 가장 가깝다**(등록부 0 · AI 풀만 산출)
③ 전부 SIMILAR/CONFLICT              ❌ 아니다(beaumonde · biskuit 가 PRESUMED_SAME)
④ SAME 인데 UI 에 안 보인다           🟡 **국내가 아니라 «해외» 에서 4건**
   rboutique(⑧) · cissywears(샵 2순위) · stockmann(⑧) · bornyesterdaykids(⑧)
⟹ 🔴 「국내가 안 보인다」의 원인은 **노출이 아니라 공급** 이다
```

🔴 주의 — 테이블에서 **가격 칸을 뻐다**. 1차 출력이 biskuit 를 「가격없음」으로 찍었고
원인은 **필드 이름을 섞은 것**(AI 풀 `priceAmount` ↔ 등록부 `price`) 이다 — 실제는 **KRW 88,000** 이 있다.

### 🟢🟢 WU-113 `MI-BEST-SELECTION` — **샵 대표 선택 P1 · 구현/배포**

🟢 전문 `docs/MI-BEST-SELECTION-113.md`. 운영 **1 파일** · 🔴 새 데이터 0 · 새 HTTP 0 ·
새 색상사전 0 · threshold 0 · 8축 0 · ⑧ 게이트 0 · 가격 0 · UI 0 · Registry 0 · AI 0.

🔴🔴 **원인 — 같은 등급에서 «색을 적은 후보» 가 그 토큰 때문에 밀렸다**:
```
tinyapple (원상품 색상 **heather grey**)
 #0 BEST  v=SAME truth=STRONG_IDENTIFIER conf **1.00** color **null**  → Human **DIFFERENT**(반팔) USD 53
 #1       v=SAME truth=STRONG_IDENTIFIER conf **0.64** color **"shirt heather grey"** → Human **SAME** USD 58
⟹ verdict·truth 가 **같아** 2차 키가 없던 코드는 **confidence** 로 갈렸고,
   제목에 색을 적은 후보가 **유사도에서 손해** 를 봤다 ⟹ 「USD 최저가 53」이 **다른 상품** 이었다
```

🟢 **구현 — 기존 신호 둘만 2차 키로 쓴다**(새 규칙 0):
```
colorRank = 색이 «있고»(isColorUnverified===false) **COLOR 충돌이 없으면** 0, 그 외 1
sort((a,b) => rank(a)-rank(b) **||** colorRank(a)-colorRank(b))
🟢 isColorUnverified 는 **EXACT 게이트가 이미 쓰는 술어**(match-truth.ts:58) · 같은 파일이 이미 import
🔴 **2차 키** 라 1차 키(SAME 0 … CONFLICT 3)를 **넘지 못한다** · 원상품 색 없으면 **순서 불변**
🔴 색이 **어긋난** 후보는 올려주지 않는다 — 「색만 있으면 이긴다」가 아니다
```

🟢🟢 **E2E(GT 27건 재조인 · URL 키) — best 가 바뀐 곳은 «하나» 다**:
```
- tinyapple USD 53 [DIFFERENT] tier EXACT → **null**   + tinyapple USD 58 [SAME] → **EXACT**
🟢 나머지 21 샵 대표 **불변**
Human DIFFERENT 가 best      1 → **0**      Human SAME 인데 best 탈락  1 → **0**
금액 집계 진입 9 → 9 (**구성이 정확해졌다**) · 오포함 **1 → 0** · tier EXACT 정밀도 **5/6 → 6/6**
🟢🟢 **해외 USD 최저가 53 → 58** · 🟢 EUR 40 · GBP 33 · CAD 64 · 🇰🇷 ₩88,000 **전부 불변**
```

🔴🔴 **음성 대조가 내 단언의 구멍을 찾았다** — 1차 M2(COLOR 충돌 검사 제거) **0 failed**.
원인은 그 케이스의 색상 후보가 **충돌 하나뿐** 이라 `colorTieBreak` 가 false 가 되어
**colorRank 에 도달하지 않은 것** 이다. 🟢 「깨끗한 색상 + 충돌 색상이 **같이** 있는」 모양을 추가해
M1 3F · M2 1F · M3 1F · M4 1F → 복구 **12 passed**.
🔴 그리고 **미커밋 상태에서 `git checkout --` 로 복구해 구현을 지웠다**(1차 M2~M4 무효) —
🟢 이후 **파일 백업** 으로 복구했다. 🔴 미커밋 구현의 복구 수단으로 git checkout 을 쓰지 않는다.

🟢 회귀 **603 files / 8,396 passed · failed 0** · typecheck 0 · build exit 0 · 배포.
🔴 **보류 전수 대조** — P2 ⑧ 게이트 ❌(술어 원문 그대로 · 계약으로 잠금) · P3 샵당 1건 구조 ❌ ·
P4 품번 보호 ❌(AB 라인 4건 **여전히 EXCLUDED**) · P5 가격 ❌ · 8축 ❌ · threshold ❌.
🟡 **CEO Action — 따져 실제 화면 1회**(🔴 USD 최저가가 **58** 인지 · 53 이면 FAIL).
🔴 후보 27건은 **그대로** 라 **다시 판정하실 필요 없다**(기존 GT 유효).

### 🟢 WU-112 `MI-CANDIDATE-LIST` — **후보 전수 목록 구축 · CEO GT 대기** (구현 0)

🟢 전문 `docs/MI-CANDIDATE-LIST-112.md`. 🔴 운영 변경 **0** · 배포 0 · MI 입력 0 ·
저장 0 · AI 0 · Registry 0 · 8축 0 · **가격 작업 0**(CPO 보류 준수).

```
목록  https://claude.ai/code/artifact/e333b58b-d70a-4e83-b21c-2af4b6bff8e5
      docs/wu-112-candidate-list.html (자립형 7.53MB) · 이미지 **27/27**(실패 0)
      🟢 **원상품 패널이 sticky** — 스크롤해도 비교 대상이 사라지지 않는다(WU-099 지적 반영)
후보  **27** = 🇰🇷 국내 3 · 🌎 해외 19 · ❔ 미확정 5 (원상품 2개 · 샵 22)
      S1 B226AC010 15 · S2 B226AC009 12 · DROPPED 샵의 후보 **6** · 품번 9 · 가격 25
verdict S1 **SAME 4** · PRESUMED_SAME 5 · SIMILAR 2 · CONFLICT 4
        S2 **SAME 3** · PRESUMED_SAME 3 · SIMILAR 1 · CONFLICT 5
      🔴 WU-093 의 「SAME 0」과 **분모가 다르다**(그쪽 등록부 검색 · 이쪽 AI URL)
      🔴 이 SAME 은 **시스템 판정** 이고 Human GT 가 아니다 — 그것이 검토 대상이다
```

🔴🔴 **운영 산출이 아니라 «후보 전수» 를 냈다** — ⑧ 게이트가 샵 전체를 DROPPED 로 떨어뜨리고
sink 는 **샵당 best 1건** 만 실으므로(WU-096/109) 운영 산출만 쓰면 **CEO 가 볼 후보가 사라진다**.
🟢 그래서 전수를 싣고 운영 판정값을 **같이** 보여준다(verdict · tier · 「이 샵은 제외됨」).
🔴 **판정 없는 후보의 `priceTier` 는 null 로 뒀다** — 지어내지 않았다(두 번 틀린 그 행위).
🟢 화면에 「시스템 줄은 참고용 · 대표님 판정이 정답」이라고 **적었다**.

🔴 **이 목록에 «없는» 것**: ⒜ **등록부 검색 경로** 후보(🟢 B226AC009 의 그 경로 5건은
**WU-093 에서 이미 GT** — 전부 DIFFERENT) ⒝ 원상품은 **2개** 다 ⒞ 새 AI 호출 **0**.
🔴 그래서 「후보를 최대한 확보했다」로 적지 않는다 — **AI URL 풀 한 생산자** 의 산출이다.

🟢🟢 **CEO GT 수신 27/27 — SAME 19 · DIFFERENT 6 · UNCERTAIN 2**(2026-10-19 ·
전문 `docs/MI-CANDIDATE-LIST-112-GT.md` · 라벨 `fixtures/wu-112-human-gt.json` **URL 키**):
```
🔴🔴 ⒜ **「이 샵은 제외됨」 안에 Human SAME 3건** — rboutique USD 44 · stockmann EUR 40 ·
   bornyesterdaykids ⟹ **⑧ EVIDENCE_NOT_WORTHWHILE 가 동일상품을 버린다**(3/6)
   🔴 WU-100 의 「26/26 NOISE」와 **반대** 지만 모순이 아니다 — **분모가 다르다**
      (그 원상품 B226AC112 는 **조사 대상이 아니었다** · WU-102) ⟹ 「분모 밖」으로 적는다
🔴🔴 ⒝ **False EXACT 1건이 «셀러가 보는 최저가» 다** — tinyapple **USD 53**(반팔 ·
   Human DIFFERENT)이 tier **EXACT** 로 집계에 들어가 **S1 USD 최저가** 가 됐다
   🔴 원인은 **8축이 아니라 «같은 샵 안의 대표 선택»** — 같은 샵의 Human SAME
      `…-heather-grey` **USD 58** 이 «샵 2순위» 라 적재되지 않았다(WU-109 §4 가 남긴 자리)
🔴 **Human SAME 19 중 가격비교 반영 8 (42%)** · 손실 11 = EXCLUDED(품번충돌) **4** ·
   샵 제외(⑧) **3** · 샵 2순위 **2** · 가격 없음 1(beaumonde) · KRW+시장미확정 1(billsstore)
🟢 정밀도 — 시스템 SAME **6/7** · tier EXACT **5/6**
🔴 **WU-108 의 「오포함 0」을 정정한다** — 그때는 Human GT 가 없었다(지금 **오포함 1**)
```

🟢 **CEO 라벨이 열려 있던 질문 둘에 답했다**:
```
① 🔴🔴 **AC ↔ AB(baby) 라인 차이 = CEO 기준 동일상품** — `b226ab046`·`b226ab040` **둘 다 SAME**
   ⟹ WU-048/069 가 HOLD 한 질문에 라벨이 붙었다(WU-093 S1-1 과 합쳐 **N=3**)
   🔴 그러나 그 완화는 WU-069/070 에서 **「품번 보호 해체」** 로 측정됐다 ⟹ **CPO 판정**
② 🟢 **품번이 같아도 색이 다르면 DIFFERENT** — luxboy 는 품번 **exact** 인데 Human DIFFERENT
   🟢🟢 우리는 PRESUMED_SAME + market UNKNOWN 으로 **금액에서 빼냈다 = 정답**
   🔴 ⟹ ①과 ②는 **같은 레버의 양면** 이다. ①을 단독으로 열면 ②가 뚫린다
🟡 CEO 는 **반팔↔긴팔을 다른 상품** 으로, **kids↔baby 라인·세트 구성을 같은 상품** 으로 봤다
   🔴 소매 길이를 보는 코드는 **없다**(8축에 없다) · 🔴 새 축을 만들지 않았다
```

🟡 **최소 수정 설계 — 🔴 구현 0 · CPO 지정 대기**(영향 큰 순):
```
P1 **샵 대표(best) 선택**   🔴 False EXACT 제거 + S1 USD 최저가 53→**58** · 🟢 8축 무변경 · 가장 좁다
P2 ⑧ 게이트               🟢 SAME 3 회수 · 🔴 노이즈 3 동반(6건 중 3)
P3 샵당 1건 제한(sink)     🟢 SAME 2 회수 · 🔴 집계 구조 변경
P4 품번 충돌(AB·샵SKU)     🟢 SAME 4 회수 · 🔴🔴 **품번 보호 해체** · luxboy 가 뚫릴 방향
P5 billsstore·beaumonde    🔴 **가격 작업이라 보류 중**(§00-B)
🔴 CTO 는 하나도 구현하지 않았다 — P1 도 판정 산출을 바꾸므로 **CPO 가 지정한다**
```

🟡 **CEO Action — 후보 27건 판정 1회**(15~25분). 🔴 **「이 샵은 제외됨」 안에 SAME 이 있으면
우리가 동일상품을 버리고 있다는 증거** 다. 🔴 가격은 보지 않아도 된다.
🔴 GT 수신 후에만 ⒜ DROPPED 안의 SAME ⒝ 시스템 SAME 중 Human DIFFERENT 를 보고
**그 둘이 나올 때만** MI 최소 수정을 설계한다(8축 CLOSED 유지).

### 🔴🔴 WU-111 `MI-PRICESTATUS` — **집계와 UI 가 다른 기준을 쓴다** (구현 0)

🟢 전문 `docs/MI-PRICESTATUS-111.md`. 🔴 운영 변경 **0** · 배포 0.

🔴🔴 **먼저 — WU-110 보고서의 샵 이름을 정정한다**: S1 에 새로 들어온 **EUR 40** 은
**`stockmann.ee` 가 아니라 `eraldo.com`** 이다. 🔴 같은 금액이라 **같은 샵이라 추정하고
확인하지 않았다.** 🔴 CEO 테스트 대상도 그에 맞춰 정정했다.

🟢 **CPO 가 물은 것(`priceStatus = undefined`)은 문제가 아니다**:
```
factsFromProductUrl 직후 **undefined** → withConfidence 의 **derivePriceStatus** 가
다시 정한다 → 운영 값 **UNVERIFIED_SEARCH** · UI 두 곳은 `?? "UNVERIFIED_SEARCH"` 폴백
```

🔴🔴🔴 **그 조사에서 «다른 결함» 이 드러났다 — 집계와 UI 의 기준이 다르다**:
```
해외 **금액 집계**  priceStatus 를 **보지 않는다**(EXCLUDED 만 뺀다 · WU-062)
**UI 숫자 표시**    isPriceDisplayable = **VERIFIED_CURRENT 만**(price-truth.ts:14)
⟹ 🔴 실측 — S1 **EUR 최저 40(eraldo.com) · UNVERIFIED_SEARCH**
   「해외 최저가 EUR 40」이 표시되는데 **그 근거 후보 줄에는 「가격 확인 필요」** 가 뜬다
   🔴 그 통화 축의 **유일한 근거** 라 셀러가 40 의 출처를 **화면에서 확인할 수 없다**
   (S2 의 trenbe USD 84 도 같은 모양 · 🟢 단 최저가가 아니라 영향 0)
🟢 나머지 최저가는 전부 VERIFIED_CURRENT (USD 53/58 · GBP 37/33 · CAD 64 · KRW 88,000)
```

🔴 **WU-110 이 만든 결함이 «아니다»** — `UNVERIFIED_SEARCH` 가 금액 집계에 들어가는 것은
**원래 그랬고**(WU-062 는 `EXCLUDED` 만 뺐다) WU-110 이 후보를 늘려 **드러낸** 것이다.
🟢 그래서 **WU-110 을 되돌릴 이유가 아니다**(되돌리면 SAME/EXACT 누락이 돌아온다).

🔴 **수정하지 않았다 — 가격 정책이다**: ⒜ UNVERIFIED 를 금액에서 제외(🔴 S1 **EUR 축이
사라진다**) ⒝ UI 에 「검증 전」 표시(🔴 **UI 변경** · CPO 금지) ⒞ 현상 유지(🔴 모순 잔존).
🔴 CPO 가 금지한 「priceStatus 를 예쁘게 채우기」와 **다른 축** 이다 — **집계 «조건»** 문제다.

🟢 **STEP 3 — 육안 GT 페이지 구축**(판정은 CEO · 운영 변경 0 · HTTP 9 read-only):
```
https://claude.ai/code/artifact/f8060423-ea80-4e02-8ba8-705194f93509
A B226AC010 eraldo.com **EUR 40** · tier COMPARISON · TEXT_CONFIRMED · 품번 증거 **0**
  🔴 후보 제목에 **「Long-sleeve」** 가 있고 원상품엔 없다(관측 · CTO 판정 안 함)
  🔴 **WU-099/100 의 CEO 라벨을 끌어오지 않는다** — 그 원상품은 **B226AC112** 였다(분모 다름)
B B226AC009 trenbe **USD 84** · tier EXACT · 제목·URL 에 **B226AC009 그대로**
  🟢 **USD 최저가는 58** 이라 이 GT 결과와 **무관하게** 최저가는 58 이어야 한다
```

🔴🔴 **STEP 3 새 관측 — 같은 URL 이 «두 통화» 를 낸다**(고치지 않았다):
```
eraldo  Shopify JSON variants[0] **40.00 + EUR** ← 우리 집계가 쓰는 값
        HTML og:price **67,077 KRW**            ← 사람이 그 페이지에서 보는 값
🟢 WU-110 안전조건은 지켜졌다(통화가 **명시된** 값만 썼다)
🔴 그러나 「해외 참고가격」과 **셀러가 링크를 눌러 보는 금액이 다를 수 있다**
🟢 우리 버그가 아니다 — Smallable 과 같은 성질(WU-090) · 🔴 전수 빈도 **미측정**
```

🟢🟢 **CEO GT 수신 — 둘 다 SAME**(2026-10-19 · 「후보 2개 동일상품이야」):
```
B226AC010 eraldo.com EUR 40 → **SAME**   ·   B226AC009 trenbe USD 84 → **SAME**
🟢 **False SAME 0** — 둘 다 금액 집계에 들어가 있고 **오포함이 아니다**
🟢🟢 **WU-110 이 되살린 가격이 «진짜 동일상품의 가격» 이었다** ⟹ 그 수정은 올바른 방향
🟡 eraldo 는 제목에 **「Long-sleeve」** 가 있는데도 Human SAME · 품번 증거 **0**
   🔴 「제목 표기 차이」를 새 축으로 만들면 **이 SAME 을 막는다** · 🔴 **N=1 로 8축 안 건드린다**
라벨 `fixtures/wu-111-human-gt.json` (**도메인 키** · WU-095 교훈)
```

🔴🔴 **그 GT 가 선택지 하나를 지웠다 — 방향이 정정됐다**:
```
⒜ UNVERIFIED 를 금액 집계에서 제외 → 🔴🔴 **순손실 확정** — Human SAME 인 EUR 40 이
   사라지고 S1 의 **EUR 축 자체가 없어진다** ⟹ 목표(동일상품 해외가 정확 표시)에 **역행**
⒝ UI 가 그 숫자의 상태를 말한다 → 🟡 **남은 유일한 방향** · 🔴 UI 변경이라 **CPO 판정**
⟹ 🟢 문제는 **「집계가 그 가격을 쓰는 것」이 아니라 「UI 가 그 가격을 못 보여주는 것」** 이다
🔴 `priceStatus` 를 예쁘게 채우지 않는다 — `UNVERIFIED_SEARCH` 는 **정확한 상태** 다
```

🔴 **`priceStatus` 즉시 수정 여부 — NO**: ① GT 입력이 **아직 없다** ② 영향 **분모 미측정**
③ 어느 선택지에도 비용이 있다 ④ 🟢 지금 **판매판정에는 닿지 않는다**(해외는 `continue` ·
국내는 `VERIFIED_CURRENT && KRW`) ⟹ **급한 안전 결함이 아니다**. 🔴 모순은 남는다 · CPO 판정.

🟡 **CEO Action 2건** — ⒜ WU-110 배포 결과 **최종 화면 1회** ⒝ 위 GT 페이지에서 **2건 판정**
(🔴 B226AC010 의 대상은 **eraldo.com** 이다 — `stockmann.ee` 가 아니다).

### 🟢🟢 WU-110 `MI-SHOPIFY-PRICE` — **해외 가격 누락 해소 · 구현/배포**

🟢 전문 `docs/MI-SHOPIFY-PRICE-110.md`. 운영 **1 파일 · +44/-2줄**(대부분 주석) ·
🔴 **추가 HTTP 0** · 8축 0 · threshold 0 · 국내 로직 0 · UI 0 · Registry 0 · WU-079 재개방 0.

🟢🟢 **MI 가 SAME/EXACT 로 판정한 동일상품의 해외 가격이 들어왔다**:
```
global.trenbe.com   price **null → USD 84** · market **UNKNOWN → OVERSEAS**
                    tier **EXACT 유지** · httpCalls **1**(추가 HTTP 0)
원인은 **이미 받은 JSON 을 읽지 않은 것** 이었다 —
   variants[0].price "84.00" + **price_currency** 가 둘 다 있었다
   (`price_currency` 는 shopify-product-json.ts:61 에 **이미 선언돼 있었다**)
```

🔴 **안전조건(CPO 고정)** — `price` **AND** `price_currency` 둘 다 · 통화는 **대문자 3글자** ·
숫자 아니거나 0 이하면 **null** · **`variants[0]` 고정**(선택 규칙은 가져오지 않았다).
🟢 파일 머리의 「통화를 모르므로 가격을 만들지 않는다」는 **그대로 유효** 하다 —
바뀐 것은 **그 JSON 이 통화를 명시한다는 사실을 읽는다** 는 것뿐이다.

🟢 **회귀 0** — 국내 **₩88,000 불변** · `EXCLUDED` 금액 제외 **유지** · 통화 분리 **유지** ·
DIFFERENT 오포함 **0** · S2 해외 최저가 **58 불변**.
🟡 🔴 **S1 에 `EUR 40`(stockmann)이 «새로» 들어왔다** — 예상한 영향 범위다
(「모든 Shopify 후보에 가격이 생긴다」). 🟢 **다른 통화 최저가는 하나도 안 바뀌었다**.
🔴 그 후보가 **진짜 동일상품인지는 사람이 확인하지 않았다**.

🔴🔴 **음성 대조가 두 구멍을 찾았다 — 이 교훈을 남긴다**:
```
1차 M1(안전조건 절반 제거) **0 failed** · M5(**배선 제거**) **0 failed**
🔴 원인 — 단언이 판정 함수를 «직접» 부르므로 **배선이 끊겨도 통과** 한다
🟢 소스 앵커 2건(배선 · 안전조건)을 더해 **M1~M5 전부 1 failed** 로 잠갔다
```
🔴 그 과정에서 **두 번 더 틀렸다** — ⒜ **정규식을 스크립트로 편집하다 백슬래시가 또**
**소실됐다**(WU-078 재발 · 파일이 구문 오류가 됐다) → 🟢 **정규식을 아예 쓰지 않는 앵커** 로
바꿨다 ⒝ **단언 좌표가 틀렸다**(`fetchPath` 의 **첫 등장이 타입 선언**) → 🟢 **쉼표가 붙은**
실제 반환 리터럴로 고쳤다. 🟢 둘 다 **FAIL 로 드러났다**.

🟢 계약 **11**(네트워크 0) · 회귀 **601 files / 8,378 passed · failed 0** · typecheck 0 ·
build exit 0 · 배포 `f8dee897` · Production **200**.
🟡 **CEO Action — 최종 화면 1회**(보고서 §CEO).

### 🔴🔴 WU-109 `MI-AGGREGATE-ACCURACY` — **Trenbe 결함 확정 · 구현은 다음 세션**

🟢 전문 `docs/MI-AGGREGATE-ACCURACY-109.md`. 🔴 운영 변경 **0** · 배포 0 · 작업트리 **clean**.

🟢 **① UNJUDGED 집계 — 정상. 내 하니스 오류였다**:
```
`transientEvidenceSink.push` 는 **한 곳**(:1255)이고 **JUDGED 분기 안** 이다
⟹ 🟢 **샵당 best 1건** 만 집계 입력. `UNJUDGED` 는 **운영에 존재하지 않는다**
🔴 WU-108 의 「UNJUDGED 가 집계에 들어간다」는 **내가 전 후보를 넣어서** 생긴 값이다
   (이 트랙 **네 번째** 같은 종류의 하니스 오류)
🟢 중복 집계 **0**(샵당 1건) · 운영 재현 byPriceTier — S1 {EXACT 3·EXCLUDED 2} ·
   S2 {EXACT 2·EXCLUDED 3·COMPARISON 1} ⟹ **UNJUDGED 0**
🔴 **WU-108 숫자 정정** — S1 OS count 7→**5**(USD 최저 44→**53** · GBP 33→**37**) ·
   S2 OS 7→**6**(🔴 **EUR 40 이 사라졌다** — 원인 미규명) · S2 KR **1 · ₩88,000** 불변
```

🔴🔴🔴 **② Trenbe 가격 누락 — 진짜 결함이다**:
```
운영  status OK · fetchPath **SHOPIFY_JSON** · price **null**
🔴 가격이 **두 곳에 다 있다**:
   ⒜ 운영이 **이미 받은** Shopify JSON — variants[0].price **"84.00"** +
      **`price_currency` 필드가 있다**(키 전수 출력으로 확인)
   ⒝ HTML — JSON-LD priceCurrency **USD** · og:price **84.00 / USD**
⟹ 🔴 **통화까지 있는데 운영이 읽지 않는다**
🟢🟢 **WU-079 가 「보류 보관」한 바로 그 자리이고, 그때 「미측정」이던 조건이 측정됐다** —
   `enrichCandidatePrices` 가 **메우지 못한 실례** 이고 그 후보가 **SAME/EXACT** 다
```

🟡 **최소 수정안(🔴 아직 구현 안 함 · CPO 승인 필요)** — `product-url-facts.ts` 의
`SHOPIFY_JSON` 분기에서 **이미 받은 JSON** 의 `variants[0].price` + `price_currency` 를 읽는다.
🟢 **추가 HTTP 0** · 🔴 `price_currency` 없으면 **null 유지**(통화 가드 계약) ·
🔴 사이트 전용/generic parser 가 **아니다**. 🔴 단 **모든 Shopify 후보에 가격이 새로 생겨**
영향 범위가 넓다 ⟹ **WU-079 가 REJECT 한 축과 인접** 하므로 **CPO 판정 사안**.

🔴🔴 **구현을 이번 세션에 하지 않은 이유 — 헌장 §4-B 「용량 판단」**:
「한 세션에 끝까지 못 갈 크기면 넘긴다 · **작업트리를 더럽힌 채 끊기는 것이 가장 나쁘다**」

🟢 **정확도 현황** — 국내 **PASS**(1/1) · 해외 **부분**(누락 1) ·
**DIFFERENT 오포함 0** · **SAME 누락 1** · typecheck 0 · 600 files / 8,367 passed.

### 🟡 WU-108 `MI-PRICE-ACCURACY` — **가격비교는 정확하다 · 누락 1건** (구현 0)

🟢 전문 `docs/MI-PRICE-ACCURACY-108.md`. 🔴 운영 변경 **0** · 배포 0 · 새 AI 검색 0.
🟢 모집단 **S1(B226AC010) 15 · S2(B226AC009) 12** — 동일상품이 **실재** 하는 표본.

🟢🟢 **잘못 포함된 가격 0 — 네 축이 전부 정확하다**:
```
국내/해외 뒤섞임 **0**(국내 1 = KR · 해외 14 = OVERSEAS · 중복 집계 0)
가격 없는 후보가 있는 것처럼 **0** · EXCLUDED/UNVERIFIED 오포함 **0**
🟢 **EXCLUDED 가 금액에서 «정확히» 빠진다** — count 7 인데 byCurrency 합 **5**
   S1 에서 EUR 35(EXCLUDED)가 빠져 **EUR 칸이 아예 없고** GBP 최저가가 35 가 아니라 **33** 이다
   🟢 WU-062 설계 그대로 — byMarket/byPriceTier/count 는 **관측으로 남는다**
🟢 **국내 축이 실제로 작동한다** — S2 biskuit.kr **KRW 88,000 · COMPARISON · KR**
🟢 CONFLICT → EXCLUDED **전건** · 통화 섞임 0 · 환산 0
```

🔴🔴 **유일한 결함 — SAME/EXACT 인데 가격이 없어 빠진다(1건)**:
```
global.trenbe.com  MI **SAME** · truth **STRONG_IDENTIFIER** · tier **EXACT**
                   price **null** · priceStatus UNVERIFIED_SEARCH ⟹ 어느 축에도 못 들어간다
🟢 원인은 **MI 도 집계도 UI 도 아니다** — `factsFromProductUrl` 이 **가격을 못 읽는다**
🔴 그 축은 **CPO 가 WU-079 에서 REJECT** 했다(generic parser ❌ · site adapter ❌)
   ⟹ 🔴 **이번에도 고치지 않았다.** 🟡 단 표본이 다르다(그때 beaumonde · 이번 trenbe,
   그리고 **MI 가 SAME/EXACT 까지 간 후보**) — **새 정보** 라 기록한다
```

🟢 **설계대로 «버려진» 것도 확인했다** — `m.luxboy.com` **KRW 59,000** 이 `.com`+KRW 라
**UNKNOWN** 이 되어 국내·해외 **어느 축에도 안 들어갔다**. 🟢🟢 그리고 **WU-077 이 그 금액을
Human DIFFERENT 로 측정했다** ⟹ **안 넣은 것이 정답** 이었다.

🔴 **미해결로 남긴 질문 1** — `tier` 는 **샵당 best 1건에만** 있어 같은 샵 2번째 후보가
**`UNJUDGED` 로 해외 금액 집계에 들어간다**(S1 2 · S2 1). 🔴 **의도된 동작인지 CPO 확인 필요** ·
CTO 가 판단하지 않았다.

🟡 **CEO Action — 최종 화면 1회**(🔴 수정/배포 없음 · 「정상인데 FAIL 로 보기 쉬운 것 둘」 포함).
🔴 결론 **HOLD** — 완료 기준 4개 중 **②③ 증명 · ①(사람 확인)④(누락 1건) 미완**.

### 🔴🔴🔴 WU-106 `MI-BOTTLENECK-VERDICT` — **수정할 병목 없음 · 현 상태 유지** (종합)

🟢 전문 `docs/MI-BOTTLENECK-VERDICT-106.md`. 🔴 새 측정 **0** · 운영 변경 **0** · 배포 0.

🔴🔴 **WU-101~105 를 합친 최종 판정**:
```
후단 전 구간(URL추출 · 상품판정 · fetch · facts · selection · ⑧ · matching · 가격 게이트)에서
**동일상품을 잃는다는 증거가 «하나도» 없다**.
유일한 병목 후보는 **AI discovery recall** 이고 🔴 **표본 2건 + 프롬프트 원문 부재** 로 확정 불가.
⟹ 🔴 **추가 독립 데이터가 필요하다. 현 상태를 유지한다.**
```

🟢 **구간별 결론**:
```
① AI discovery   측정됨 — S1 36→**2**(5.6%) · S2 29→**3**(10.3%) · 🔴 **품번 기반 하한**
                 🟢 knownAnswersFound — cto-websearch **3/5** · claude **2/5**
                 🔴 측정불가 — 프롬프트/응답 **원문 없음**(영구 소급 불가)
② 추출/상품판정   🟢 **실제 손실 0** — 탈락 2건은 네이버 **검색 URL** 1 + **자기참조** 1(둘 다 올바름)
③ fetch          **403 외부 거부 1 확정**(WU-105) · 네트워크 미도달 **0 관측** ·
                 🔴 **기타 미분류 15** ⟹ 🔴 「접근 실패 16」으로 쓰지 않는다
④ selection/⑧    🟢🟢 **동일상품 소실 0/5** · 도달 2건 = EXACT 1 + COMPARISON 1
⑤ MI/가격비교     🟢 ⑥⑧ · matching · 비용 게이트 · AI URL 품질 · 집계 — **전부 병목 아님**
```

🔴🔴 **이 종합이 «폐기» 로 확정하는 것**(다음 세션이 되살리지 않게 한 자리에 모았다):
```
WU-096 「최초 병목 = ⑧」               → **폐기**(동일상품 손실 설명으로)
WU-101 「AI 가 B226AC112 를 못 찾았다」  → **폐기**(조사 대상이 아니었다)
WU-103 「동일상품 전부 통과(4/5)」       → **정정**(정밀 trace **2/5** · 유효분모 2/3)
WU-099 「USEFUL 2」                     → **폐기**(기준 고정 후 **0/26**)
WU-094 「very_high 정밀도 40%」         → **폐기**(거짓 0.95 바닥값 위)
WU-093 「very_high 5/5 는 분모 차이」    → **폐기**(원인은 **버그**)
「UNREACHABLE 16 = 접근 실패 16」       → **쓰지 않는다**(4xx 섞여 있다)
```

🟡 **필요한 추가 데이터는 둘뿐이다**(🔴 둘 다 CPO/CEO 결정 · CTO 가 하지 않았다) —
⒜ **동일상품이 실재하는 검색 표본 추가** ⒝ **프롬프트/응답 원문 저장**.
🔴 matching 완화 · Registry 확대 · fetch 우회 · discovery 코드 변경 — **전부 보류**.

### 🟢 WU-105 `MI-SKROUTZ-403` — **원인은 HTTP 403(외부 거부)** (구현 0)

🟢 전문 `docs/MI-SKROUTZ-403-105.md`. 🔴 운영 변경 0 · 배포 0 · AI 0 · 우회 시도 0.

```
① DNS         🟢 정상(104.18.33.2 · 172.64.154.254 — Cloudflare 대역)
② 운영 owner   factsFromProductUrl → **UNREACHABLE** · httpCalls 1 · PLAIN_HTML
③ raw fetch    🟢 **HTTP 403** · text/html — 🔴 **예외가 아니다**
④ node:https   16KB **403**(6,112B) · 64KB **403**(6,112B) ⟹ 🔴 **overflow 아니다**
🔴 TLS/connection/timeout 오류 **0건** — 응답이 정상적으로 왔다
```

🔴 **WU-084 와 다른 유형이다** — overflow 판별식(16KB 실패 · 64KB 성공)이 **성립하지 않는다**.
🟢 **우리 fetcher 결함이 아니다** — `fetchPlainHtmlWithFinalUrl` 의 `!response.ok → null` 이
**설계대로** 동작해 403 을 `UNREACHABLE` 로 떨어뜨렸다.

🔴🔴 **내 1차 판정 줄이 틀렸고 정정했다** — 하니스가 「🟡 우리 쪽(상한을 올리면 받아진다)」
로 출력했다. 원인은 판정식이 `big.ok` 를 본 것인데 그 `ok` 는 **「응답을 받았다」** 지
**「200 이다」가 아니다**(403 도 true). 🔴 그대로 보고했으면 **「우리 fetcher 를 고치면 된다」는
거짓 결론** 이었다.

🟡 **관측 1건(고치지 않았다)** — `UNREACHABLE` 이라는 이름이 **「거부됨(4xx)」과 「닿지 못함」을
뭉갠다**. 🔴 WU-096 의 `UNREACHABLE 16건` 중 **4xx 비율은 미측정** 이다.
🔴 403 의 이유도 **단정하지 않았다** — 우회 시도(UA 변경 등)는 **하지 않았다**(금지 방향).

### 🟡 WU-104 `MI-SAME-TRACE` — **WU-103 의 「전부 통과」를 정정한다** (구현 0)

🟢 전문 `docs/MI-SAME-TRACE-104.md`. 🔴 운영 변경 0 · 배포 0 · 새 AI 호출 0.

🔴🔴 **동일상품 5건을 «한 건씩» 돌렸더니 후단 도달이 2/5 다**(WU-103 은 4 로 셌다 —
그 보고서가 적은 한계 ②「풀 소실 계산이 거칠다」가 **맞았다**):
```
1 bobochoses.com/**ko-kr**/  ①🟢②🟢③PRODUCT④OK → 🔴 **자기참조 제외**(같은 호스트)
2 search.shopping.naver.com  ①🟢 ②🔴**추출 탈락** ③**LISTING_PAGE** → 🔴 미도달
3 global.trenbe.com          ①🟢②🟢③PRODUCT④OK → 🟢 **JUDGED / EXACT**
4 www.skroutz.ro             ①🟢②🟢③PRODUCT ④🔴**UNREACHABLE** → 🔴 미도달
5 biskuit.kr                 ①🟢②🟢③PRODUCT④OK → 🟢 **JUDGED / COMPARISON**
```

🟢 **분모를 정직하게 가르면 유효 후보는 3건** 이다 — #1 은 **원상품 자신의 다른 로케일**
(판매처 후보가 아니다) · #2 는 **검색 결과 페이지**(상품 URL 이 아니다). ⟹ **2/3 도달**,
🔴 손실 1건은 **UNREACHABLE** 이라 **우리 판정 로직의 손실이 아니다**.

🟢🟢 **⑥/⑧ 소실은 여전히 0 이다** — 죽은 지점은 ②추출 1(올바름) · ④fetch 1 · 자기참조 1.
⟹ 🟢 **WU-103 의 핵심 결론(selection 이 동일상품을 안 버린다)은 유지** 된다.

🔴🔴 **교차검증에서 새 사실** — 두 통과 후보 **둘 다 `facts.brandModelCode` 가 null** 인데
(URL 에는 `b226ac009` 가 있다) `trenbe` 가 **EXACT** 에 닿았다 ⟹ 🟢
`confirmBrandCodeInEvidence`(WU-004 가 건초더미를 title+url+sku 로 넓힌 함수)가 **URL 에서
품번을 확인한 증거** 다. 🟢 `biskuit.kr` 은 brand 가 **「비스킷」(샵 이름)** 인데도 COMPARISON
에 닿았다 — 그 현상은 **EXACT 승격만** 막는다.

🔴 **한계** — 유효 표본 **3건** · `skroutz.ro` UNREACHABLE **원인 미규명**(WU-084 헤더
overflow 여부 **미확인**) · 「동일상품 5건」은 **URL 품번 기반 하한** · `trenbe` EXACT 의
**정답 여부는 사람이 확인하지 않았다**.

### 🟢🟢 WU-103 `MI-FUNNEL-TRUE` — **파이프라인은 동일상품을 «거의 잃지 않는다»** (구현 0)

🟢 전문 `docs/MI-FUNNEL-TRUE-103.md`. 🔴 운영 변경 0 · 배포 0 · **새 AI 호출 0**.
🟢 WU-102 가 정정한 뒤 **올바른 분모**(AI 가 정답을 찾은 S1·S2)로 다시 쟀다.

```
S1 원상품 b226ac010 (brand·code·color **셋 다 있음**) · AI URL **36** · 동일상품 **2**
   🟢 bobochoses.com/**ko-kr**/… → 추출 → 풀 → **JUDGED**
   🔴 search.shopping.naver.com/search?query=B226AC010 → ② 추출 탈락 **(올바름 · 검색 URL)**
S2 원상품 b226ac009 · AI URL **29** · 동일상품 **3**
   🟢 global.trenbe → JUDGED · 🟢 biskuit.kr → JUDGED · 🔴 skroutz.ro → ③④ **UNREACHABLE**
🟢🟢 **⑥ candidate selection 소실 = 0 / 0** ⟹ `EVIDENCE_NOT_WORTHWHILE` 는
     **동일상품을 버리지 않는다**. JUDGED 가 실제로 났다(S1 1 · S2 3)
🔴 손실은 **①의 «비율»** 이다 — AI URL 중 동일상품 **2/36(5.6%) · 3/29(10.3%)**
```

🔴🔴 **WU-096 의 「최초 병목 = ⑧」은 동일상품 손실의 설명으로 «폐기» 된다** —
올바른 분모에서 **⑥ 소실이 0** 이다. 🟡 「다른 상품이 거기서 많이 걸러진다」는 **관측으로 유효**.
🟢 그리고 이번 WU 가 **WU-100 의 보강 증거** 를 줬다 — 게이트는 동일상품을 **안 버린다**(0/5).

🔴 **한계** — ⒜ 동일상품을 「품번이 URL 에 있는가」로 1차 판정했으니 **2/36·3/29 는 하한**
⒝ 내 「풀 소실」 계산이 **거칠다**(S2 에서 통과 3·소실 1 이 동시에 나왔다 · 합쳐 쓰지 않는다)
⒞ 표본 **검색 2 · 동일상품 5** ⟹ 「최초 손실 지점」은 **표본 부족으로 판별 불가**
⒟ S1 통과 1건은 **같은 샵 다른 로케일** 이다 — 「다른 판매처」가 **아니다**
⒠ 🔴 **AI 가 왜 그 비율인지 추론하지 않았다**(프롬프트 원문 없음 · CPO 금지)

### 🔴🔴🔴 WU-102 `MI-AI-DISCOVERY-CAUSE` — **WU-101 을 정정한다** (구현 0)

🟢 전문 `docs/MI-AI-DISCOVERY-CAUSE-102.md`. 🔴 운영 변경 0 · AI 호출 0 · Registry 0.

🔴🔴🔴 **WU-101 의 「AI 가 못 찾았다」는 «틀렸다» — AI 에게 물어본 적이 없다**:
```
저장 AI 산출 rows 24 = **4 모델 × 6 검색(S1~S6)**
  S1 B226AC010/B226AB046 · S2 B226AC009/B226AB040 · S3 B126AI018/B126AC130
  S4·S5 (URL에 품번 없음) · S6 B226AC117/B126AC151/B225FC012/B226AC160
🔴🔴 **B226AC112 는 파일 전체에 «한 번도» 없다**(전수 문자열 검색)
⟹ 그 181건은 **다른 여섯 상품** 조사 결과이고 **B226AC112 는 조사 대상이 아니었다**
```

🔴 **내가 WU-087 에서 만든 분모 오류다** — 그 보고서에 **내가 직접** 「B226AC112 를
새로 조사시킨 결과가 아니다」라고 적어 놓고 **WU-088~101 에서 그 경고를 잃어버렸다**.

🔴🔴 **무효 범위를 «등급을 갈라» 적는다**:
```
WU-096  🟡 단계별 **기술 손실**(추출·fetch·가격)은 **유효** ·
        🔴 「동일상품이 어디서 죽는가」로 읽으면 **무효**
WU-099/100 🔴 **26/26 NOISE 는 «예상된 결과»** — 애초에 다른 상품이다
WU-100  🔴 **「⑧ 게이트 정확도 26/26」은 증거로 약하다** — 좋은 후보가 **입력에 없었다**
WU-101  🔴 **정정** — 원인은 AI 실패가 아니라 **조사 대상 불일치**
WU-088/089 🟢 **유효** — 게이트 발화/분모를 쟀지 상품 동일성을 재지 않았다
```

🟢🟢 **반대 사실도 나왔다 — AI 는 정답을 찾을 때가 있다**:
```
knownAnswersFound — cto-websearch **3/5** · claude **2/5** · gemini 0/5 · gpt 0/5
⟹ 🔴 「AI discovery 가 동일상품을 못 찾는다」는 **이 데이터로 지지되지 않는다**
```

🔴 **CPO 네 항목 중 셋이 측정불가** — 저장 데이터에 **프롬프트·질의·응답 원문이 없다**
(`prompt`·`query`·`question`·`instruction` 키 **전부 0**). ④는 **질문이 성립하지 않는다**.

🟡 **CPO 판단 재료**(CTO 가 고르지 않았다) — ⒜ B226AC112 를 실제로 물어본다(🔴 새 AI 호출)
⒝ 🟢 **이미 조사된 S1·S2 를 원상품으로 삼아 funnel 을 다시 잰다**(**새 AI 호출 0** ·
그 둘은 **AI 가 정답을 찾은 케이스**) ⒞ 앞으로 **프롬프트·응답 원문을 같이 저장**한다.

### 🔴🔴🔴 WU-101 `MI-COVERAGE-CAUSE` — **최초 원인은 ① AI discovery 다** (구현 0)

🟢 전문 `docs/MI-COVERAGE-CAUSE-101.md`. 🔴 운영 변경 **0** · 배포 0 · AI API 0 · Registry 0.

🔴🔴🔴 **종료 조건 문장 — 데이터로 채웠다**:
> 「동일상품 후보가 없는 최초 원인은 **① AI 가 애초에 동일상품 URL 을 찾지 못한 것**
> 이며, 전체 손실 중 **181 / 181(전건)** 이다.」

```
원상품 B226AC112(Pop T-shirt)를 네 축으로 찾았다 — **전부 0**:
  AI URL 181 중 문자열 `b226ac112`        **0**  (🔴 원상품 호스트 자신도 **0**)
  AI URL 중 `pop` / `pop-t-shirt`          **0**
  fetch facts(94 시도·OK 69) code 일치      **0**
  읽힌 품번 **25개** 중 B226AC112           **0**
  🟢 CEO 육안(WU-100 · 26건)                **26/26 NOISE**
🟢 읽힌 품번은 AW26MS185 6 · B126AI018 4 · B226AC010 2 · B226AC117 2 … **전부 다른 상품**
```

🔴🔴 **CPO 6분류가 ①에서 끝난다** — ②URL추출 ③상품판정 ④fetch ⑤facts ⑥selection 에서
잃은 동일상품은 **전부 0** 이다. **없는 것을 잃을 수는 없다.**
🔴 그래서 WU-096 이 센 `NOT_EXTRACTED 79 · UNREACHABLE 16 · REDIRECTED_AWAY 6` 는
**전부 다른 상품의 탈락** 이고, 🔴 **「동일상품을 잃었다」로 읽으면 틀린다**.

🟢 **WU-092 S2 와 같은 방향(공급 부재)** 이다 — 🔴 단 **주체가 다르다**(S2 는 **등록부**,
이번은 **AI**). 같은 말로 적지 않는다.

🔴 **제목 축은 측정불가** — WU-087 캐시에 `title` 칸이 **없다**(내가 안 넣었다).
「제목에 Pop 이 있는 후보 0건」으로 **적지 않는다**. 🟢 다른 세 축이 같은 답을 줬다.

🔴 **표본 원상품 1개** — 「AI 가 항상 못 찾는다」로 **일반화 금지**. WU-092 **S1 에서는
동일상품이 후보에 있었다**(2건). 🟡 「AI 가 왜 못 찾았는가」는 **새 AI 호출/프롬프트
정책** 영역이라 **CPO/CEO 결정** 이다(현재 AI API 금지).

### 🔵 WU-100 — **기준 고정 + 이미지 보강 재측정** (운영 0 · CEO 재평가 대기)
```
STEP1 🟢 화면에 기준을 **박았다** — 「USEFUL = 원상품과 «동일상품» 후보로 다시 볼 가치」
       🔴 「같은 브랜드라 참고할 만하다」는 **불필요** 라고 화면에 명시
STEP2 🟢 이미지 **15 → 25 / 26** — 🔴 사이트별 규칙 **0**(모든 후보에서 `og:image` 우선)
       ⟹ ⒜ imageUrl null 11건 ⒝ 잘려서 판단불가 1건 을 **한 규칙으로** 해결
       🔴 화면에 「페이지 대표 이미지 / 목록 썸네일」 중 무엇인지 **적었다**
       🔴 운영 추출기 **한 글자도 안 바꿨다** · MI 0 · 가격비교 0
       🔴 11.85MB 로 커져서 **한 장만** 넣도록 줄였다(7.47MB)
STEP3 🔴 **1차 라벨을 화면에 표시하지 않는다**(정답 취급 금지) · fixture 에는 보존
🔴 남은 것 — 이미지 **1건 여전히 없음** · `og:image` 가 로고/배너일 가능성 **미확인**
```

🟢🟢 **WU-100 결과 — 26/26 전부 NOISE · UNSURE 0** (CEO 재평가 수신 2026-10-19)
```
USEFUL **0** · NOISE **26** · UNSURE **0**  ⟹ 🟢 이미지 보강이 **측정불가를 전부 해소**
🔴 1차의 USEFUL 2(eraldo·kolkid)가 **둘 다 NOISE 로 바뀌었다** ⟹ 1차의 「유용함」은
   **「같은 브랜드라 참고할 만하다」** 였다. 🟢 **WU-099 의 USEFUL 2 는 폐기**
```

🔴🔴🔴 **그래서 WU-096 의 「최초 병목 = ⑧」 서술을 «정정» 한다**:
```
⑧ 이 버린 26건을 사람이 보니 **26/26 전부 「동일상품 후보 아님」** 이다
⟹ 🟢 **⑧ EVIDENCE_NOT_WORTHWHILE 은 이 표본에서 하나도 틀리지 않았다**
⟹ 🔴 「게이트가 후보를 잘못 버린다」는 가설은 **반증됐다**
⟹ 🔴🔴 **WU-097/098 의 「판정 보류 후보 보존」은 구현할 이유가 없다** —
      넣으면 셀러에게 **노이즈 26건** 을 보여주는 것이 된다
```

🔴 **진짜 문제는 coverage 다** — ①~⑦ 은 손실 0 으로 통과하는데 그 안에 **동일상품이
애초에 없다**(26건 중 원상품과 같은 상품 **0**). ⟹ WU-092 S2 의 「A: coverage」와 **같은 자리**.
🔴 표본 **원상품 1개 · 26건 · 샵당 top 1건** — 「DROPPED 는 언제나 노이즈」로 **일반화 금지**.
🟢 라벨은 `fixtures/wu-100-human-value.json`(2차) · `wu-099-human-value.json`(1차) 에 **둘 다 보존**. 🔴 「대부분이 충돌로 보이는 것」이 **이 WU 가 묻는 질문** 이다.

### 🟡 WU-098 `MI-PENDING-STATE` — **분리는 가능하다 · 가치는 미측정** (구현 0)

🟢 전문 `docs/MI-PENDING-STATE-098.md`. 🔴 운영 변경 **0** · 배포 0 · 테스트 0 · UI 0.

🔴🔴 **WU-097 의 한 줄을 정정한다** — 「DROPPED 후보에는 라벨이 없다」는 **과했다**:
```
DROPPED 샵의 후보 **53건** · crossSellerVerdict — CONFLICT 38 · SIMILAR 12 · UNKNOWN 3
⟹ 🟢 **null 0건.** 판정 어휘가 **이미 있다**
없는 것은 matchTruth / verified / **priceTier**(= 「국내 링크 판정」 계열)뿐이다
⟹ 🟢 **WU-091 의 ③「행마다 판정 라벨」은 충족 가능하다**
🔴 WU-097 의 **나머지 결론(기존 sink 재사용 불가)은 그대로 유효** 하다
```

🟢🟢 **UI 는 `priceTier` 를 «읽지 않는다»** — `GeminiTransientCandidates` 가 읽는 칸 전수에
그 필드가 **없다**. 필수인 이유는 UI 가 아니라 **MI 집계** 다(`market-intelligence:226`).

🟢 **필요한 필드가 전부 이미 있다** — domain·title·url·market·price·priceStatus·
crossSellerVerdict/Blockers/Conflicts·matchReasons·matchLevel·**dropGate**.
🔴 지어내야 하는 값 **0**. 🔴 matchTruth/verified/priceTier 는 **넣지 않는다**.

🟢 **분리 경로가 «한 줄» 이다** — 세 번째 배열을 `computeMarketIntelligence` 인자에
**넣지 않으면** 가격 축에 들어갈 경로가 **구조적으로 없다**. 운영 소비처 파일은 **넷**.

🔴 **보존 범위가 계약을 가른다** — `DROPPED` 는 `observed.candidate` **top 1건** 만 들고
나온다. 「샵당 1줄」이면 계약 변경 **0**, 「후보 전부」면 `DomesticJudgement` **계약 변경** 이다.

🔴🔴 **가치는 측정되지 않았다** — DROPPED 후보 53건 중 **CONFLICT 38** 이다(노이즈 다수
가능성). 🔴 WU-093 GT(SAME 2/DIFF 8)는 **다른 표본** 이라 쓰지 않는다.
🔴 상태 이름 · 구역 문구 · 보존 범위는 **전부 제품 정책** 이고 **CTO 가 정하지 않았다**.

### 🔴 WU-097 `MI-SINK-BOUNDARY` — **안전한 분리가 성립하지 않는다 · HOLD** (구현 0)

🟢 전문 `docs/MI-SINK-BOUNDARY-097.md`. 🔴 운영 변경 **0** · 배포 0 · UI 0 · 8축 0.

🔴🔴 **핵심 사실 — sink 는 «화면 전용 배열» 이 아니다**:
```
judgeDomesticCandidate → DROPPED → [MI-REAL-12] → **continue** (sink 이전에서 끊긴다)
                       → JUDGED  → … → **transientEvidenceSink.push**
그 배열의 소비처가 **둘** 이다:
  check/route.ts:159        두 배열을 **합쳐** computeMarketIntelligence 에 넘긴다
  market-intelligence:226   `for (const e of geminiEvidence ?? [])` → **가격 축 적재**
                            (:252 overseasEvidence.push · 국내는 domesticTransientRecords)
  GeminiTransientCandidates:223  evidence.map() — 전건 렌더
⟹ 🔴 **A(노출)와 B(판정/가격비교)가 «같은 배열» 을 쓴다.**
```

🔴 **그래서 「sink 앞에서 보존」은 안전하지 않다** — ⒜ 집계 루프를 탄다(가격 오염) ·
⒝ `priceTier` 가 **필수 필드** 라 **지어내야** 한다(이 트랙이 세 번 틀린 그 행위) ·
⒞ 국내 축은 **판정 입력** 이라 `price_alerts` **영속 행** 이 생길 수 있다(WU-039/059).

🔴🔴 **설계안(별도 배열)도 마지막 축을 못 지킨다** — WU-091 의 ③**「행마다 판정 라벨」**:
```
DROPPED 후보는 **판정을 하지 않았다** ⟹ verdict·matchTruth·blocker 가 **존재하지 않는다**
⟹ 「판정 보류」라는 **새 상태 어휘** 가 필요하고 그것은 **제품 정책** 이다
🔴 라벨 없이 보여주면 **2026-09-19 사고 모양**(「유력 후보 5건」)에 다시 가까워진다
```

🟢 **코드 0 으로 한 것 — 현재 경계를 계약 6건으로 잠갔다**(`wu-097-sink-boundary.test.ts` ·
네트워크 0). 🟢 나중에 분리를 구현하면 **③⑤⑥ 이 FAIL 로 뒤집히고 그것이 수정의 증거** 다.

🔴 **행동 단언은 포기했다** — `computeMarketIntelligence` 를 직접 부르려 했으나 손으로 만든
입력이 **집계 루프에 도달하지 못했다**(결과 불변). 🔴 그 상태로 「영향 없음」이라 적으면
거짓이라 **소스 수준 단언으로 낮추고** 한계를 보고서에 적었다.

🟢 회귀 **600 files / 8,367 passed · failed 0** · typecheck 0.

### 🔴🔴 WU-096 `MI-FUNNEL` — **최초 병목은 ⑧ 하나다** (측정 전용 · 구현 0)

🟢 전문 `docs/MI-FUNNEL-096.md`. 🔴 운영 변경 **0** · 배포 0 · AI 0 · UI 0 · 8축 0.
🔴 **WU-095 «이후» 값으로 다시 쟀다** — 087/088/089 숫자는 수정 전이라 **인용 금지**.

```
① AI 182 → ② 추출 103 → ③ fetch 64 → ④ facts 64 → ⑤ 가격 12 → ⑥ market 8
→ ⑦ MI 판정 64 → **⑧ 샵판정 30곳: JUDGED 4 / 🔴 DROPPED 26** → ⑨ 자격 0 → ⑩ UI 0
국내(KR 5) ①~⑦ **손실 0** · 해외(3)도 **손실 0** ⟹ 🔴 **둘이 갈리는 지점이 «없다»**
   둘 다 **⑧ 같은 게이트** 에서 죽는다
```

🔴🔴 **최초 병목 = `isEvidenceEvaluationWorthwhile`**(run-domestic-price-check:364):
```
if (candidates[0].matchLevel !== "low") return true;   ⟹ top 이 low 면 **샵 전체 DROPPED**
KR 후보를 가진 샵 4곳(biskuit·littleluna·miniboutique·mustit) **전부 DROPPED**
🟢 JUDGED 4곳은 전부 **market UNKNOWN · price null** ⟹ 어느 가격축에도 못 들어간다
```

🔴 **CPO §4 분리** — 가격 **실패 52**(전부 `NO_PRICE_EVIDENCE`) ↔ 가격은 있는데
**판정으로 제외 12**(국내 5 · 해외 3). 🔴 **두 수를 합치지 않는다**.

🔴 **CPO §5 분리** — **UI 에서 사라지는 것 0**. transient 카드는 `evidence.map()` 으로
**전건 렌더**(게이트 0)다. 🔴 1차에 `mayShowCandidate` 로 쟀는데 **틀린 owner** 였다
(그건 등록부 «검색 표» 게이트다). 🟢 실제 노출 = **JUDGED 4건**(전부 가격 미확인).

🔴🔴 **WU-095 의 부작용 1건을 확정했다 — 둘로 갈라 적는다**:
```
AI URL 경로(원상품 Shopify)   수정 전후 **둘 다 {low:64}** ⟹ 🟢 **회귀 아니다**
   (원상품 slug 가 숫자가 아니라 Cafe24 후보 slug "1" 과 **애초에 달랐다**)
등록부 경로(원상품 Cafe24)    very_high 5 → **low 5** ⟹ 🔴 **이제 DROPPED** (실측)
🟢 단 **잃은 판정은 없다** — 통과하던 때에도 그 경로는 **SAME 0 · 국내 EXACT 0** 이었다
🔴 달라진 것은 「판정」이 아니라 **「후보가 백엔드 산출에 실리는가」** 다
```

🔴🔴 **그래서 독립 병목 후보가 «하나» 나왔다(CPO 판정 사안)** — ⑧ 은 **증거평가 «비용»**
게이트인데 `transientEvidenceSink.push` 가 그 뒤에 있어 **후보 노출까지 결정한다**.
🔴 **WU-091 의 「후보 노출 ≠ SAME 판정」과 충돌** 한다. 🟢 이것은 **판정 완화가 아니라
«노출 경로» 문제** 라 **8축·threshold 를 건드리지 않고** 다룰 수 있는 **유일한 자리** 다.
🔴 **CTO 는 구현하지 않았다.**

🟢 회귀 **599 files / 8,361 passed · failed 0** · typecheck 0 · build exit 0.

### 🟢🟢 WU-095 `MI-SLUG-FIX` — **거짓 slug 신호 제거 · 구현/배포**

🟢 전문 `docs/MI-SLUG-FIX-095.md`. 운영 **3 파일 · +59/-3줄**(대부분 주석) ·
🔴 새 SAME 규칙 **0** · threshold **0** · 8축 **0** · UI **0** · 가격 정책 **0** · Registry **0**.

🔴🔴 **수정은 「1개 함수」로 끝나지 않았다 — 복제본이 «셋» 이다**(CPO 질문의 답):
```
① match.ts:81            extractSlug      → 0.95 바닥값(:477) · 품번 URL 포함(:494)
② product-identity.ts:60 extractSlug(복제) → 🔴 **즉시 EXACT_PRODUCT**(:155) → 화면 🟢「동일상품」
③ shared/product-facts.ts:717 extractUrlSlug → sameSellerDistinctListing · slugCarriesCode ·
                               dedupe key · extractCodeLikeSlugSegment
🔴 ②가 **더 센 경로** 다 — 점수가 아니라 **확정** 이고 `overseasMatchDisplay` 가 TIERS.SAME 으로 바꾼다
🟢 ③은 **결과가 안 바뀐다**(「둘 다 "1"」과 「둘 다 null」이 같은 분기) — 그래도 같이 고쳤다
```

🟢 **고친 방법 — 새 규칙이 아니라 «기존 기준의 재사용»**:
```
숫자만으로 된 세그먼트는 **식별 신호로 쓰지 않는다**(null = 「모른다」)
🟢 근거: `extractCodeLikeSlugSegment` 가 이미 식별자에 `[a-z]`와 `[0-9]`를 **둘 다** 요구한다
🔴 「두 번째 세그먼트를 쓴다」는 **사이트별 규칙** 이라 채택하지 않았다
```

🟢 **STEP2 유형별 실측(N=4,247)** — Cafe24 유형 **32/32(100%)** 가 숫자 slug ·
🟢 **Shopify(/products/) 1,402 중 숫자는 1건(0.07%)** ⟹ 그쪽은 정상이고 **깨뜨리지 않았다**.
🔴 slug `"1"` 하나가 **URL 26 · 호스트 3 · 거짓 일치 쌍 325** 를 만들고 있었다.

🟢🟢 **STEP5 전후 비교(S1 5건 · 운영 함수)**:
```
          수정 전                      수정 후
conf      **0.95 ×5**                  **0.1 ×3 · 0 ×2**
matchLevel **very_high ×5**            **low ×5**
reason    「URL slug 일치」 ×5          **사라짐**
matchType **EXACT ×5**                 **NOT_MATCHED ×5**
pTruth    **EXACT_PRODUCT ×3**         **0** (SIMILAR/CONFLICT)
🔴 SAME 승격 **0** — 성공 기준은 「SAME 증가」가 **아니다**(CPO §5)
🟢 False SAME **0 유지**
```

🔴 **STEP6 가격** — 상세확인 대상 **2 → 0**(잘못된 very_high 가 고른 2건이 사라졌다 · 정책 변경 0).
🔴 **STEP7 Gemini** — `foundVeryHighInP0` 의 입력이 **very_high 5 → 0** ⟹ **거짓 스킵이 사라진다**.
🔴 flag OFF 라 **호출 증가량은 측정불가** 이고 **비용 추정도 하지 않았다**.

🔴🔴 **측정 오류를 하나 잡았다** — GT 를 **인덱스** 로 매핑했는데 `withConfidence` 가 **정렬**
을 해서 수정 전/후로 **라벨이 엉뚱한 후보에 붙었다**(수정 후 「human SAME 인데 conf 0」).
🔴 그대로 보고했으면 **거짓 결론** 이었다. 🟢 fixture 를 **SKU 키** 로 바꿔 고정했다.

🟢 계약 **7**(네트워크 0) · 음성대조 **M1 2F · M2 2F · M3 2F · M4(조건 반전) 3F** → 복구 7 passed.
🟢🟢 회귀 **599 files / 8,361 passed · failed 0** — 기존 계약이 **하나도 안 깨졌다**
(= 그 거짓 신호에 **의존하는 올바른 계약이 없었다**). typecheck 0 · build exit 0.

🔴🔴 **CPO 최종 판정(2026-10-19) — GO / CLOSED**:
```
🟢 「단순 정확도 개선이 아니라 **잘못된 식별 신호가 운영 판정·비용 게이트·Gemini
   게이트까지 전파되던 공통 결함을 제거한 것**」 (CPO 문장)
🟢 **SAME 이 증가하지 않은 것은 실패가 아니다** — 목적은 거짓 증거 제거였다
🔴 **후속 위험 하나는 «열지 않는다»** — 「상품번호 4117 같은 숫자-only 세그먼트가
   null 이 되어 생기는 recall 손실」은 **별도 문제** 이고, 숫자-only 가 실제
   상품 식별자로 쓰이는 사이트에서 recall 을 잃는다는 **독립 증거가 확보될 때만** 다룬다
🔴 **네 번째 복제는 계약 테스트가 막는다** ⟹ **지금 리팩터로 범위를 넓히지 않는다**
```

### 🔴🔴🔴 WU-094 `MI-MATCHLEVEL` — **`very_high` 는 지금 «거짓값» 이다** (구현 0)

🟢 전문 `docs/MI-MATCHLEVEL-094.md`. 🔴 운영 변경 **0** · 배포 0 · 8축 0 · UI 0 · 가격 정책 0.

🔴🔴🔴 **CPO 의 세 질문에 답하기 «전에» 결함이 나왔다**:
```
`extractSlug`(match.ts:81)가 **경로의 마지막 세그먼트** 를 쓰는데
Cafe24 상품 URL 은 전부 `…/display/**1**/` 로 끝난다 ⟹ **slug 가 서로 「1」로 같다**
⟹ match.ts:477 `score = Math.max(score, 0.95)` **무조건 발화** ⟹ 전부 very_high
🔴 **CF: 그 바닥값만 끄면 conf 0.95 → 0.1 / 0.0** (진짜 점수는 0.1 이하 · 전부 low 여야 한다)
🟢 증거가 화면에 **이미 있었다** — reasons 가 「모델명 유사도 **0%**」와 「URL slug 일치」를
   **동시에** 적는다. 두 문장은 같이 설 수 없다
🟢 **WU-076 이 같은 성질을 기록해 뒀다**(Cafe24 꼬리표) — 🔴 그때는 **CONTROL 설계 문제**
   로만 읽었고 **운영 점수 경로에 같은 함정이 있다는 것을 보지 못했다**
```

🔴 **소비처가 여섯이고 둘은 «비용·탐색 정책» 이다**:
```
① toDomesticMatchType            very_high → **EXACT · autoVerified**(초기값 · matchTruth 가 덮는다)
② selectCandidatesForDetailConfirmation  가격 **상세확인 자격** = 외부 HTTP **비용**
③ foundVeryHighInP0              🔴🔴 **Gemini 호출을 스킵**(WU-016 게이트)
④ isEvidenceEvaluationWorthwhile  `matchLevel !== "low"`
⑤ attach-match-truth             deriveMatchTruth 의 **첫 인자**
⑥ ComparisonShopSearch.tsx:83    해외 폴백 `very_high → tier **SAME**` 표시
```

🔴 **GT 교차(N=10 · 일반화 금지)** — `very_high` **5건 = human SAME 2 · DIFFERENT 3**.
🔴🔴 **그 「정밀도 2/5 = 40%」는 WU-095 에서 «폐기» 됐다**(CPO 확정) — **거짓 0.95 바닥값**
위에서 잰 값이기 때문이다. 🔴 **어떤 지표로도 인용하지 않는다.** 🟢 단 `matchTruth` 가 EXACT 를 **하나도 내지 않아**
**False SAME 0**(깊이방어 작동) — 🔴 「안전하다」가 아니라 **「다른 축이 막아 줬다」** 다.

🔴🔴 **모집단 정정** — WU-093 이 「분모가 달라서 very_high 가 많다」로 적은 것을 **정정한다**.
원인은 모집단이 아니라 **버그** 다(① AI URL low 64/64 · ② Registry very_high 1/175 · ③ 5/10).

🔴 **STEP4** — 상한 2 가 **발화했다**(자격 5 → 2). 🔴 WU-088 의 「발화 0」과 다르다.
🔴🔴 그 2건이 Human SAME 과 일치한 것은 **rank 가 가른 게 아니다** — `EXACT_PRODUCT` 가
**3건**(S1-5 포함)이라 **동률** 이고 **배열 순서** 로 앞의 둘이 뽑혔다. 🔴 「2/2」로 적지 않는다.

🔴 **CPO 세 질문** — A 🟡 설계상 ranking 이나 **값이 틀렸다** · B 🔴 **NO** · C 🔴🔴 **NO**.
🔴 **고치지 않았다** — 영향이 ②③에 걸쳐 **CPO 판정 사안** 이다(「필요할 때만 구현 결정」).

🟢 분모 — 저장 URL 4,259 중 마지막 세그먼트가 **숫자 157** · 값 **「1」이 26건** ·
호스트는 **전부 한국 쇼핑몰**(looxloo·biskuit·miniboutique·mustit·littleluna·luxboy·wconcept).
🟢 해외 Shopify handle 은 **고유 문자열이라 안 걸린다**.

### 🟢 WU-093 `MI-GT-REVIEW` — **CEO GT 수신 완료 · 구별 불가가 확정됐다** (운영 0)

🟢 전문 `docs/MI-GT-REVIEW-093.md`. 🔴 운영 변경 **0** · 배포 **0** · DB 읽기만 ·
API 0 · schema 0 · 8축 0 · **UI 본편 개편 0**. 🔴 검증 페이지는 **`apps/admin` 밖** 이다.

```
URL   https://claude.ai/code/artifact/9d4a3278-b3ea-4282-8338-5eb7bc3a8ddb
파일  docs/wu-093-gt-review.html (자립형 2.48MB) · 생성기 scripts/wu-093-build-review.mjs
🟢 이미지 12장을 **data: URI** 로 임베드 — 원격 이미지 **0** ⟹ 로그인·네트워크 없이 사진이 뜬다
   (육안 비교가 목적이라 **사진이 안 뜨면 이 WU 가 성립하지 않는다**)
```

🟢 **후보 전수 10건 · 운영이 낸 그대로**(§6 필터링 0) — 둘 다 `looxloo.com` 만 후보를 냈고
나머지 **5곳은 `status: ok` 인데 후보 0** 이다(🔴 「검색 실패」가 **아니다**).
```
S1 B226AC009  후보 5 · facts 5/5 · SIMILAR 3 · CONFLICT 2 · **matchLevel very_high 5**
S2 B226AC042  후보 5 · facts 5/5 · CONFLICT 1 · UNKNOWN 4 · matchLevel low 5
```

🔴 **CTO 는 판정하지 않았다**(§9) — 산출 JSON 의 `humanReview` 는 **전부 null** 이고
「같아 보인다」를 한 줄도 적지 않았다. 🔴 §11 의 ①은 **CEO 판정 대기** 다.

🔴 **버그 하나를 잡았다** — 1차에 이미지 **10/12 실패**. 원인은 `Referer` 에 **한글이 든 URL** 을
넣어 fetch 가 던진 것(`ByteString`)이고 🔴 **이미지 자체는 200** 이었다 —
「판매처가 막는다」로 읽었으면 틀렸다. 🟢 `origin` 만 보내 **12/12** 성공.

🔴 **S1 원상품 이미지가 운영 facts 에 없어**(`imageUrl: null`) 검증 화면용으로만 `og:image` 를
가져왔고 **화면에 그 사실을 적었다**. 🔴 운영 추출기는 **고치지 않았다**.

🟢🟢 **CEO 라벨 10/10 수신**(2026-10-19) — **human SAME 2 · DIFFERENT 8 · UNCERTAIN 0**
```
시스템 SAME 판정 **0** ⟹ 🟢 **False SAME 0** (틀린 것을 SAME 이라 한 적이 «없다»)
Human DIFFERENT 8 ⟹ 🟢 **8/8 전건 차단**(양말·앞치마·턱받이·밴드 전부 올바르게 배제)
Human SAME 2      ⟹ 🔴 **recall 0/2**
⟹ 🔴 **「너무 안 맞다」의 실체는 「틀린 답」이 아니라 「답 없음」** 이다.
   거기에 **WU-091 이 후보를 전부 보여주기 시작한 것** 이 겹쳐 인상이 나빠졌다.
   🔴 그러나 **S2 의 5건은 전부 DIFFERENT 가 맞다** — 그 화면에서 시스템은 틀리지 않았다.
```

🔴🔴🔴 **가장 중요한 발견 — 셋이 «구별 불가» 하다**:
```
S1-1 human **SAME**       sys SIMILAR / very_high / 축 3
S1-4 human **SAME**       sys SIMILAR / very_high / 축 3
S1-5 human **DIFFERENT**  sys SIMILAR / very_high / 축 3   ← 축 문자열이 **글자 그대로 같다**
가를 수 있는 축 전수 — 상품코드 null·null·null · 색상 null·null·null ·
상품군 TOP·TOP·TOP · 제목겹침 「보보쇼즈」 하나씩 ⟹ 🔴 **전부 동일**
⟹ 문턱을 낮춰 2건을 살리면 **S1-5 도 같이 열린다** · False SAME **+1** · precision **2/3**
🔴 **여덟 축에서 측정된 그 패턴의 «아홉 번째» 재현** 이다(완화 = Human DIFFERENT 동반 개방)
🟡 유일하게 갈리는 것은 **가격**(원상품 88,000 == S1-4 88,000) — 🔴 **구현/제안 안 한다**
   (새 매칭 규칙 · §8 금지 · 그리고 **S1-1 은 가격이 달라도 SAME** 이라 1/2 밖에 못 잡는다)
```

🔴🔴 **§11 세 질문의 답 — 두 샘플은 «서로 다른» 처방을 요구한다**:
```
S1 → **matching**  동일상품이 후보에 **실재한다**(2건) · 🔴 완화하면 FP 가 같이 열린다
S2 → **coverage**  5건 전부 다른 상품 ⟹ 🔴 **매칭을 아무리 고쳐도 0** 이다
```

🔴 **추가 관측(CPO 판단 재료 · CTO 가 고르지 않는다)**:
```
⒜ 🔴 **S1-1 이 「베이비」 라인인데 CEO 가 SAME 이라 했다** — WU-069 가 HOLD 한 **그 질문** 이다.
   🔴 메모가 비어 있어 **인지 여부는 여전히 미확인** · **N=1 로 그 HOLD 를 풀지 않는다**
⒝ 🔴🔴 **[WU-095 에서 폐기]** 「matchLevel very_high 5/5 는 **분모가 다르다**」
   (그쪽은 AI URL 후보 · 이쪽은 **등록부 검색 후보**) ⟹ WU-088 의 가격 자격 필터를
   **통과하는 모양이 실재한다**. 🔴 1상품이라 일반화하지 않는다
⒞ 🔴 **matchLevel 과 verdict 가 갈린다** — very_high 인데 CONFLICT 가 2건이다
```

🔴 **코드를 한 줄도 바꾸지 않았다**(§8 금지 전수 준수) · **CEO Action 없음**.

### 🔴🔴 WU-092 `MI-CANDIDATE-CAUSE` — **두 샘플은 «서로 다른» 문제다** (구현 0)

🟢 전문 `docs/MI-CANDIDATE-CAUSE-092.md`. 🔴 운영 변경 **0** · 배포 0 · DB 읽기만 · 8축 0.

```
S1 biskuit B226AC009    → **C(matching)** — 동일상품 후보가 «실제로 왔는데» 축이 **2/5**
S2 bobochoses B226AC042 → **A(coverage)** — 등록부 샵이 그 상품을 **팔지 않는다**
🔴 「동일상품을 못 찾음」이라는 **한 문장으로 적으면 둘 다 틀린다**(CPO §3)
```

🟢 **STEP 2 — URL 정규화 문제가 «아니다»**(CPO 가설 확인) — 쿼리 O/X 결과가 **완전히 동일**.
🔴 단 S2 는 `price: null` 이다 — `fetchPath=SHOPIFY_JSON` 이 **HTML 을 안 받아** JSON-LD
가격을 영구히 못 본다(**WU-079 가 보류 보관한 그 자리** · CEO 는 ₩162,000 을 봤다).

🔴🔴 **하니스 결함을 잡았다 — 그대로 보고했으면 거짓 결론이었다**:
```
1차: SHOPS 를 {id,name,domain} 만으로 만들고 `as never` 로 타입을 **가렸다**
  → collectionStrategy 가 없어 운영이 요청을 **안 보내고** status:"unsupported"
  → 6/6 unsupported · 후보 0 ⟹ 「A_DISCOVERY」로 보고할 뻔했다
🟢 DB 값을 넣자 후보 **5건씩** → 결론이 **A → C 로 뒤집혔다**
```

🔴🔴 **그리고 내 1차 원인 가설이 counterfactual 로 «반증» 됐다**:
```
가설   원상품 brand 가 **「비스킷」**(샵 이름)이라 BRAND_MISMATCH 가 막는다(WU-080 사례)
실측   brand 를 「Bobo Choses」로 바꾸면 **blockers 는 사라지는데**
       **verdict 가 하나도 안 바뀐다**(SIMILAR 3 · CONFLICT 2 그대로) · **SAME 0 → 0**
⟹ 🔴 **brand 는 구속 조건이 아니다.**

🟢 진짜 구속 = **축 2/5** (SAME_MIN_AXES=5)
   원상품/후보 **둘 다** code null · color null (후보는 샵 자체 SKU 76A7D-L30-05)
   축 = [핵심 상품명 일부 「보보쇼즈」, 상품군 TOP↔TOP]
🔴🔴 **제목 축이 브랜드명 한 토큰뿐인 이유 = 띄어쓰기**(새 관측)
   원상품 「허그 헤어리 몬스터 티셔츠」 ↔ 후보 「허그헤어리몬스터티셔츠」
   🔴 **고치지 않았다** — 새 매칭 규칙이라 CPO 금지(「후보 판정 기준 변경」)
```

🔴 **부수 관측** — 등록부 검색 후보의 `matchLevel` 이 **very_high 5건** 이다.
WU-017/088 의 「전건 low」와 **분모가 다르다**(그쪽은 **AI URL 후보**) ⟹ 🔴 **WU-088 의
가격 자격 필터를 «통과하는» 모양이 실재한다.** 🔴 단 N=5 · 1상품이라 **일반화하지 않는다**.

🟢 **등록부 실측** — 전체 34 · `biskuit.kr` **없다** · `bobochoses.com` 있으나 **enabled=false** ·
AUTO_*+enabled **7곳**. 🔴 등록부를 **바꾸지 않았다**.

🟢 **STEP 5 — 시장조사 카테고리는 «유지»**(A). WU-082 의 소비처 셋이 그대로 있고
③ `resolveCategoryCostPolicy` 는 **가격 계산에 들어간다**. 남은 것은 **UX 개선**(제품 정책).

🟢 typecheck **0**(🔴 한때 2 — `ProductFacts` 에 **없는 칸** 을 읽으려 했고 **타입이 막았다**.
이 트랙 19번째 같은 실수인데 **처음으로 사전에** 잡혔다) · 회귀 **598 files / 8,354 passed**.

### 🟢🟢 WU-091 `MI-CANDIDATE-VISIBILITY` — **후보 노출과 SAME 판정을 갈랐다** (구현/배포)

🟢 전문 `docs/MI-CANDIDATE-VISIBILITY-091.md`. 🔴 판정 0 · 가격 0 · 시장 0 · 집계 0 ·
API 0 · schema 0 · DB 0 · AI 0 · Registry 0 · 8축 0. 운영 **5 파일 · +210/-24줄**.

🔴🔴 **이 WU 는 2026-09-19 사고와 «정면으로» 만난다** — 먼저 적는다:
```
그때: 국내에 동일상품이 0 인데 후보 5건이 **가격까지 달고** 떴다(Pèpè Lulu T Bar Shoes)
🟢 **사고의 본질은 「보여줬다」가 아니라 「유력 후보처럼 보여줬다」** 였다
   (펼쳐져 있었고 · 가격이 달려 있었고 · **판정 라벨이 없었다**)
⟹ 그래서 넷을 **동시에** 지킨다 — ① 기본 **접힘**(open 없음) ② 「동일상품 없음」을
   **먼저** 말함 ③ **행마다 판정 라벨 + note(제외 이유)** ④ 「가격비교에 사용되지 않습니다」
```

🟢🟢 **데이터는 «이미» 화면까지 오고 있었다** — 원인은 컴포넌트 **안의 필터 한 줄**:
```
rows = r.candidates 전부  →  **selectVisualCheckCandidates** (SAME/옵션다름만)  →  카드
🟢 그래서 **데이터 전달 경로 수정이 필요 없었다**(CPO §7 허용 범위를 쓰지 않았다)
🟢 **상품코드도 이미 왔다** — search route 가 `NextResponse.json({ok,results})` 로
   후보를 **통째로** 직렬화한다 ⟹ UI 타입이 **선언만 안 했을 뿐** (서버 0 · 판정 0)
```

🟢 **「후보 없음」과 「동일상품 없음」을 갈랐다**(CPO §6 의 핵심):
```
후보 0            🔎 비교 후보를 찾지 못했습니다.
후보 N · SAME 0   🟡 후보는 찾았지만 동일상품으로 확인된 판매처가 없습니다.
                  + 「N곳 · M건 검색됨」 + **[후보 M건 보기]**(접힘)
🟢 국내/해외는 **원래 같은 컴포넌트** 라 한 번에 적용됐다
🔴 네이버 검색 링크 **제거** · 직접 URL 입력은 **「+ 다른 판매처 URL 직접 확인」 접힘** 으로
```

🔴 **회귀 2건 실패를 둘 다 규명했다** — ⒜ `product-tab-mounted` 는 **의도된 라벨 변경** 인데
그 실패가 **내 실수를 같이 잡았다**(summary + sr-only label 이 **같은 문구를 두 번**) →
🟢 `aria-label` 로 고쳐 중복 0. 계약은 **문자열만 갱신 · 항목 수 불변**.
⒝ `p54b-product-url-facts` 는 **네트워크 일시 실패**(`packages/` 변경 **0** · 단독 13 passed).

🟢 음성대조 **6종 전부 FAIL**(M1 13 · **M2 open 1** · M3 3 · M4 2 · M5 1 · **M6 1**) → 복구 19 passed.
🟢 회귀 **598 files / 8,354 passed · failed 0** · typecheck **0** · build exit 0.

🔴 **CEO Action — Production UI 1회 확인**(보고서 §CEO · 「정상인데 FAIL 로 보기 쉬운 것 둘」 포함).

### 🟢 WU-090 `MI-SMALLABLE-E2E` — **두 경로 모두 작동 · CEO 육안 1회 대기** (구현 0)

🟢 전문 `docs/MI-SMALLABLE-E2E-090.md`. 🔴 운영 변경 **0** · 배포 **0**(테스트만).

🔴🔴 **Smallable URL 이 들어가는 경로는 «둘» 이고 서로 다른 코드를 탄다** — 이것을 먼저 적는다:
```
「새 상품 분석」(원상품)  /api/pipeline → **universalExtract**
    site-strategy 는 **shopify·prestashop 둘뿐** → Smallable 은 **Playwright** 경로
    ⟹ 헤더 상한 문제가 **애초에 없다** · 🔴 **WU-084 와 무관**
「다시 분석」 후보 URL   collectUrlCandidatePool → factsFromProductUrl
    → fetchPlainHtmlWithFinalUrl → **fetchWithDomainRateLimit**  ← 🟢 **WU-084 가 고친 자리**
🔴 즉 WU-016 의 「Smallable UNREACHABLE」은 **후보 경로** 였다.
```

🟢 **둘 다 실측으로 작동한다**:
```
원상품(Playwright)  title "Bobo Choses Organic Cotton T-shirt | Ecru" · brand **Bobo Choses**
                    price **EUR 50** · images **6** (🔴 일부 전략 TimeoutError 섞였으나 전체 성공)
후보(fetch)         UNREACHABLE → **OK** · brand **Bobo Choses** · price **KRW 82,673** ·
                    httpCalls **1** · modelCode **null**(WU-083 유지)
```

🔴🔴 **같은 URL 인데 경로마다 통화가 다르다**(EUR 50 ↔ KRW 82,673) — Smallable 이 **방문자에
따라 통화를 바꾼다**(메모 `smallable-market-is-shipping-destination` 계열). 🔴 **우리 버그가
아니지만** 셀러가 두 통화를 볼 수 있다는 **사실은 기록** 한다. 🔴 이번 범위에서 고치지 않았다.

🔴 **CEO 테스트는 «두 경로 모두»** 봐야 한다 — CPO 시나리오(새 상품 분석)만 하면
**WU-084 가 고친 자리를 보지 못한다**. 보고서 §CEO 에 A/B 와 **「정상인데 FAIL 로 보이기 쉬운 셋」**
(통화 차이 · 품번 없음 · 국내 비교 미진입)을 적어 뒀다.

### 🔴 WU-089 `MI-AI-URL-QUALITY` — **「상세페이지만」 요구해도 산출 0 증가 · REJECT** (구현 0)

🟢 전문 `docs/MI-AI-URL-QUALITY-089.md`. 🔴 운영 변경 **0** · HTTP **0**(캐시 재사용) · 배포 0.

🔴🔴 **붙여넣기 경로에는 「AI 지침」 owner 가 «코드에 없다»** — `ai-answer-urls` /
`ai-answer-pool` / `url-candidate-pool` **전부 0**. UI 문구는 **셀러에게** 하는 말이고,
`buildPrompt`(WU-014)는 **Gemini API 경로 · flag OFF** 다. ⟹ §9 조건 ① **불충족**.

🟢 **181 전수 유형**(🔴 URL 모양이 아니라 **운영 판정** 으로 분류):
```
PRODUCT_DETAIL **68**(국내 20 · 해외 48)  ├ evidence 61  └ evidence 없음 7
NOT_EXTRACTED **88** · UNREACHABLE 15 · REDIRECTED_AWAY 8 · NO_FACTS 2
비율 — 전체 **37.6%** · 국내 **43.5%** · 해외 **35.6%**
NOT_EXTRACTED 88 의 운영 모양: **LISTING 58 · UNKNOWN 29 · PRODUCT_PAGE 1**
```

🔴🔴 **KPI — 상세페이지 전용으로 바꿔도 «산출이 그대로» 다**:
```
URL 181 → **68**(-113) · extraction 93 → 68(-25) · fetch 68 → 68(**0**)
evidence 61 → 61(**0**) · **price 12 → 12(0)** · **market 8 → 8(0)**
국내 price 9→9(0) · 해외 price 3→3(0)
⟹ 줄어드는 것은 **분모** 뿐이다. §10 GO 조건 **하나도 성립하지 않는다**.
```

🔴 **내가 1차에 틀렸다** — `PRODUCT_DETAIL` 을 `status OK && (brand||code)` 로 정의해
**가격은 있는데 brand/품번 없는 3건** 을 빼먹었고 「상세만 남기면 가격이 준다」는 **거짓
결론** 이 될 뻔했다. 🟢 owner 는 `factsFromProductUrl` 의 `status` 다 — 그걸로 고쳤다.

🔴🔴 **이 WU 가 상류/하류를 최종적으로 갈랐다** — 상류(AI URL 품질)를 **완벽히 해도**
가격 12 · 자격 8 은 **그대로** 다. 남은 병목은 **전부 하류** 이고 그 owner 는
**matchLevel**(WU-088)이며 그 축은 **이미 닫혔다**(WU-017 · threshold 완화 금지).
🟡 측정된 유일한 이득은 **비용/시간**(fetch 93 → 68 · **-27%**) 이고 그것은 **운영 문서** 영역이다.

### 🔴 WU-088 `MI-PRICE-GATE` — **비용 게이트는 «한 번도 발화하지 않는다» · REJECT** (구현 0)

🟢 전문 `docs/MI-PRICE-GATE-088.md`. 🔴 운영 변경 **0** · 배포 0 · 추가 HTTP **0**.

🔴🔴🔴 **CPO 질문의 답 = 0 이고, 분모 자체가 0 이다.**

```
게이트는 «두 겹» 이다 (price-confirmation.ts):
  ⒜ **자격 필터**  matchLevel ∈ {very_high, high, medium} OR truth === SAME_MODEL_VARIANT
  ⒝ **샵당 상한**  MAX_DETAIL_CONFIRMATIONS_PER_SHOP = **2**

후보 64 · matchLevel 분포 **{"low": 64}** — **전건 low**
  A 상세확인 대상        **0**
  B1 ⒜ 자격 필터 탈락    **64**(국내 20 · 해외 44)
  B2 ⒝ 상한에 밀림       **0**        ← 🔴 **상한에 «도달조차» 안 한다**
  현재 가격 확보          12(국내 9 · 해외 3) ← 🟢 상세확인과 **무관**
                                        (`factsFromProductUrl` 의 JSON-LD/microdata)
CF 대상 0 · 추가 HTTP **0** · 추가 회수 **0** · incremental value **0**
⟹ 상한을 2 → N 으로 올려도 **변화가 없다.**
```

🔴 **WU-087 의 내 서술을 정정한다** — 「`selectCandidatesForDetailConfirmation` 이 0 이라
보강이 안 돈다」는 맞지만 원인은 **상한이 아니라 자격 필터** 다.
🔴 **B1 과 B2 를 합치지 않았다**(CPO §3) — 합치면 「비용 게이트를 풀면 N 건이 산다」가 거짓이 된다.
🔴 CF 에서 `matchLevel` 을 **주입하려다 멈췄다**(금지) — 운영이 만든 후보 **그대로** 를
한 개짜리 배열로 넘겨 **상한만** 비활성화했다.

🔴🔴 **그래서 「가격 gate 를 올리자」는 근거가 전혀 없다.** 진짜 owner 는 **matchLevel** 이고
그것은 **이미 닫힌 축** 이다(WU-017: 적중률 3.8% · `high` **0건** · threshold 완화 **금지**).
🟢 남는 비(非)코드 레버는 WU-087 의 그것 하나 — **AI 에게 「상품 상세 URL 만」 요구하기**.

### 🟡 WU-087 `MI-AI-FUNNEL` — **배선은 끝났다 · 병목은 «가격» 과 «AI URL 품질»** (구현 0)

🟢 전문 `docs/MI-AI-FUNNEL-087.md`. 🔴 운영 변경 **0** · AI API 0 · 배포 0.
🔴 **새 AI 를 부르지 않았다** — WU-073 저장분(4개 모델 · URL **181**)을 답변 산문으로 되돌려
운영 추출기에 넣었다. ⟹ 「B226AC112 를 새로 조사시킨 결과가 **아니다**」.

| 단계 | 전체 | 국내 | 해외 |
|---|---:|---:|---:|
| ① AI URL | **181** | 46 | 135 |
| ② URL 추출 | 94 | 30 | 64 |
| ③ fetch OK | 69 | 20 | 49 |
| ④ evidence | 62 | 13 | 49 |
| ⑤ **가격** | **12** | 9 | 3 |
| ⑥ market 확정 | 8 | 5 | 3 |
| ⑦ 자격 | **8** | **5** | **3** |

🔴🔴 **⑤ 가 최대 손실(62→12 · -50)** 이고 **분모 오염이 아니다** — 운영 경로
(`collectUrlCandidatePool → withConfidence → **enrichCandidatePrices**`)로 다시 돌려
**같은 숫자**(국내 자격 5)를 얻었다. 🟢 owner: `price-source-adapter.ts` 의
`selectCandidatesForDetailConfirmation` 이 0 이면 **보강이 아예 안 돈다** +
Shopify 경로는 `price:null` 고정(fetch OK 69 중 **SHOPIFY_JSON 53**).
🔴 **버그가 아니라 비용 정책** 이다 ⟹ §7 의 수정 조건 **불충족 · 코드 변경 0**.

🔴 **AI URL 의 48% 가 상품 페이지가 아니다** — `PRODUCT_PAGE 94 · LISTING 58 · UNKNOWN 29`.
🟢 `REDIRECTED_AWAY` **8건** — **WU-075 가 실제로 일하고 있다**.
🟢 `KRW_WITHOUT_DOMAIN_EVIDENCE` 4건을 **KR 로 올리지 않았다**(CPO §4 준수).

🟡 **HOLD** — 배선은 연결되나 **양**(181 → 국내 **5** · 2.8%)이 운영 가치를 말하기엔 부족하다.
🔴 국내 5건에 **품번이 0건** 이다 — 「동일상품 5건」이 아니라 **「가격 자격 5건」** 이다.
🔴🔴 **다음 레버는 코드가 아니다** — ⒜ 가격 확보는 **비용 정책** ⒝ AI URL 품질은
**프롬프트/운영 지침**. 🔴 둘 다 CPO/CEO 영역이고 CTO 가 정하지 않는다.

### 🟢🟢 WU-086 `MI-AI-URL-E2E` — **AI URL → 국내 가격비교 경로는 «이미 있다»** (구현 0)

🟢 전문 `docs/MI-AI-URL-E2E-086.md`. 🔴 운영 변경 **0** · Registry 0 · 8축 0 · AI API 0 · 배포 0.

```
외부 AI 답변(산문) → A 추출 **11 발견 → 8 통과** (탈락 3 = 홈/카테고리/스토어 · 올바름)
  → B 후보 풀  accepted 8 · **usable 6** · MI 자격 6 · 탈락 2(feelway UNREACHABLE)
               🟢🟢 **Registry 참조가 «코드» 에 0** (언급 2회는 주석)
               🔴 탈락 사유에 Registry 계열 **0** — 계약으로 잠갔다
  → C 시장/가격  **market KR + KRW 4건** · provider 호출 **0**
       miniboutique **B226AC112 · ₩108,000 · KR** / biskuit ₩88,000 / littleluna ₩117,000
       donokids ×2 는 UNKNOWN(`.com`+KRW) 🟢 올바르다(WU-051/077)
```

🟢🟢 **WU-085 의 「직접 입력」 결과가 AI 경로에서 재현됐다** — 「중간에서 버리는 코드」는
**발견되지 않았다**. 탈락 둘 다 **올바른 이유** 다. ⟹ CPO §5 의 「**코드 변경 0 도 정상
결론**」에 해당한다.

🔴 **과장하지 않는다** — 잰 것은 **「국내 가격 자격」까지** 다. `priceTier` 게이트는
`judgeDomesticCandidate` 가 만들고 **이 하니스가 만들지 않았다**(WU-085 에서 지어내다 걸렸다).
🔴 그리고 CoupleShot·BBambam·Beaumonde·SSG 는 **B226AC112 URL 미확보** → 미측정
(URL 을 **지어내지 않았다**).

🔴 **라벨 오류 1건 자가 정정** — `searchResults.length`(도메인 묶음 4)를 「통과 4」로 적었다.
후보 수는 **6**(`usableProductUrls`)이다. 계약을 그 칸으로 고쳤다.

### 🟡 WU-085 `MI-B226AC112-E2E` — **백엔드는 작동한다 · 후보가 «생성되지 않는다»** (구현 0)

🟢 전문 `docs/MI-B226AC112-E2E-085.md`. 🔴 운영 변경 **0** · 배포 0.

🔴🔴 **CPO §5 의 분리 답 — 둘 다 아니다**:
```
URL 을 «넣으면» 백엔드는 **끝까지 간다**(실측):
   miniboutique  code **B226AC112** · ₩108,000 · VERIFIED_CURRENT · market **KR** 🟢
   smallable     market UNKNOWN(KRW_WITHOUT_DOMAIN_EVIDENCE) 🟢 올바르다(WU-051)
   SSG           **NOT_PRODUCT_PAGE** 🔴 WU-073 이 기록한 «오차단»(WU-052 HOLD 자리)
🔴 그런데 **그 샵들이 국내 등록부에 없다** — control 11곳 중 등록부에 있는 것은 **3곳**
   (gmarket · littleluna · ssg[**NOT_AVAILABLE**]) · **miniboutique·bbambam·feelway·
   beaumonde·coupleshot 은 없다**(등록부 전체 34)
🔴 그리고 자동 1회차 POST `/check` body 는 `{snapshotId}` 뿐 ⟹ **URL 풀도 안 돈다**
⟹ 자동 분석에서 그 후보는 **존재한 적이 없다.** UI 가 숨긴 것도, 백엔드가 제거한 것도 아니다.
```

🟢 **WU-009/010 의 결론이 이 control 에서 재현됐다** — 「`NO_LINK` 의 원인은 검색이 아니라
**등록부**」. 🔴 새 원인이 아니다.

🔴 **최소 수정이 없다** — 등록부 추가(§12-0 금지) · 자동 1회차에 넣을 URL 없음 ·
SSG 분류기(WU-052 HOLD) · 8축 완화(금지). ⟹ 🟡 **HOLD**.

🟢🟢 **그리고 이 WU 는 「국내 가격비교가 고장났다」를 반증했다** — 후보 URL 하나만 주어지면
**fetch → 품번 → 가격 → 시장 → 국내 자격** 까지 간다. 막힌 것은 **「그 URL 이 어디서 오는가」** 다.

🔴 **내가 두 번 틀렸고 둘 다 적는다** — ⒜ `priceTierFromLink` 에 `{matchTruth:null,
verified:false}` 를 **지어넣어** COMPARISON 을 얻었다(이 트랙 **2번째** 같은 실수) →
**tier 를 「측정불가」로 되돌렸다** ⒝ 등록부 칸을 `scope` 로 추측했다(실제 `category_scope` ·
이 트랙 **18번째**) → `information_schema` 로 읽어 고쳤다.

### 🟢🟢 WU-084 `MI-HEADER-OVERFLOW` — **공통 fetch 복구 · 구현/배포**

🟢 전문 `docs/MI-HEADER-OVERFLOW-084.md`. 운영 **1 파일 · +33줄** · 새 fetch 방식 **0** ·
hostname 조건 **0** · MI/보호축/가격/시장 **0**.

```
🟢 판별   err.cause.code === "UND_ERR_HEADERS_OVERFLOW"  (undici 전용 코드)
   🔴 `TypeError: fetch failed` **문구로 판단하지 않는다** — DNS 실패·연결 거부도 같은 문구다
🟢🟢 복구  **429 폴백이 이미 쓰는** `retryThroughDirectStack` → `fetchHtmlDirect` 재사용
   그 경로가 **maxHeaderSize 64KB** 이고 `classifyOutboundUrl`+`guardedLookup`
   (WU-025/026 SSRF·DNS rebinding 계약)을 **그대로 지킨다**
   🔴 `node:https` 를 새로 부르면 그 가드를 **우회** 했을 것이다 — 그래서 안 만들었다
🔴 **overflow 에서만** 재시도 · 직접 스택도 실패하면 **원래 오류를 던진다**
```

🔴 **분모를 숨기지 않는다** — 91 URL / 41 호스트 전수에서 **overflow 1건 / 1 호스트**
(나머지: 정상 76 · network 5 · 404/403/503 9). ⟹ §7 조건 ⑩만 약하고 나머지 9개는 충족.

🟢🟢 **Smallable E2E — `UNREACHABLE` → `OK`** · `httpCalls` **1**(요청 불변) ·
brand **"Bobo Choses"** · price **82673 KRW** · 🔴 `modelCode` **null 그대로**
(WU-083 REJECT 유지 — 품번을 **만들지 않았다**).

🔴🔴 **운영상 의미를 과장하지 않는다** — 이것은 「Smallable 을 비교에 넣었다」가 아니라
**「입구를 열었다」** 다. 품번 없음 · `colorText` null(WU-064) · `.com`+KRW ⟹ **UNKNOWN**
(WU-051 대로 올바르다) ⟹ **어느 금액 축에도 안 들어간다.** 🟢 화면 후보로는 보인다.

🟢 **회귀가 수정을 증명했다** — WU-083 의 `UNREACHABLE` 단언이 **FAIL** 로 뒤집혔다.
계약을 갱신하며 `httpCalls 1`·brand·price 단언을 **추가** 했고 원인 기록은 주석에 남겼다.
🟢 mutation M1(무차별 retry) 1F · M2(폴백 제거) 2F · M3(조용히 삼킴) 1F ·
**M4(「문구」로 판별) 1F** → 복구 5 passed.

### 🔴 WU-083 `MI-SELLER-SKU` — **품번 복원 REJECT · 원인은 «헤더 크기»** (구현 0)

🟢 전문 `docs/MI-SELLER-SKU-083.md`. 🔴 운영 변경 **0** · MI 0 · 보호축 0 ·
AI/Vision/OCR/검색엔진 **0** · 배포 0.

🔴🔴 **세 단계가 갈렸다**:
```
① 데이터를 못 가져온다  🔴🔴 **원인이 파싱이 아니라 «응답 헤더 크기» 다**
     운영 owner → UNREACHABLE · raw fetch → TypeError
     🟢 실측: 16,384B(Node 기본) **Header overflow** → 65,536B **200 · 본문 745KB · 헤더 19,197B**
     🟢 메모 `smallable-market-is-shipping-destination` 과 WU-016 의 UNREACHABLE 이 **같은 원인**
     🔴 **일반화되지 않는다** — WU-076 의 UNREACHABLE 15건 중 헤더 원인 **0건**(분모 1 호스트)
② 가져오면 읽히는가     🟢 **JSON-LD Product 가 정상** — brand `Bobo Choses` · color `Ecru` ·
     `82673 KRW` · 사이즈 141 declination. 🟢 공통 extractor 가 그대로 읽을 모양이다
③ 제조사 품번           🔴🔴 **페이지에 «없다»** — `B226AC112` 0건 · 품번 «모양» 0건 · `mpn` null
     🔴 **8건 전수** 에서 0건(1건이 아니다). 전부 Smallable 자체 SKU(`AAA…`) · 상품번호(`430700`)
```

🔴 **CPO §3 분기 C 확정** ⟹ **추론 금지 · Smallable 전용 mapping 금지 · §10 GO 조건 ①⑥ 불충족**
⟹ 🔴 **REJECT(품번 복원).** 🟢 control — 공식몰 OK · 국내 OK(제목에 품번) · SSG 는 WU-073 오차단.

🟡 **별개 레버 하나(구현 0 · CPO 판정)** — Smallable 이 MI 에 못 들어가는 **직접** 원인은
품번이 아니라 **fetch 실패** 다. 🟢 그 페이지엔 WU-016 이 「품번 없이 SAME(0.81)」에 닿을 때
쓴 **다섯 축이 전부 구조화 데이터로** 있다. 🟡 최소안 = `fetchPlainHtmlWithFinalUrl`(WU-075 의
**단일 fetch owner**)에서 **실패 시 1회만** `node:https`(maxHeaderSize 64KB) 재시도
(hostname 조건 0 · 성공 경로 불변). 🔴 **분모 1 호스트** 라 이 트랙 기준(「N=1 로 일반화 금지」)에
걸리고 이 WU 의 GO 조건이 승인하지 않는다 ⟹ **CTO 가 운영 fetch 를 임의로 바꾸지 않았다.**

🟡 **CEO Action — 육안 비교 1회**(보고서 §11 · Smallable 4개 상품에 Bobo 품번이 정말 없는지).

### 🟢🟢 WU-082 `MI-AUTO-CHECK-WIRING` — **국내 가격비교 미노출 원인 확정 + 최소 수정**

🟢 전문 `docs/MI-AUTO-CHECK-WIRING-082.md`. 🔴 API 0 · schema 0 · DB 0 · MI 0 · 가격 0 ·
시장 0 · 집계 0 · AI 0. 운영 **3 파일 · 약 +35줄** · **새 호출 0**.

🔴🔴 **원인 — 「후보가 없어서」가 아니라 «응답을 버려서» 다**:
```
page.tsx:465 자동 1회차 POST /check 가 `.catch`/`.finally` 만 달고 **body 를 읽지 않았다**.
⟹ 그 응답에만 있는 참고 축(domesticReference · overseasReference ·
   domesticShop.urlCandidateEvidence)이 **통째로 버려졌다**.
⟹ 패널은 GET 으로만 그리는데 **GET 은 transient 를 넘기지 않는다**(WU-049/056).
⟹ 셀러가 「🔄 다시 분석」을 **누르기 전까지 국내 가격비교가 화면에 존재하지 않았다.**
🔴 **해외 참고가격도 같은 이유로 안 보였다** — 이번 수정이 둘 다 고친다.
🟢 WU-022 설계가 「⒝ 자동 1회차 포함 여부」를 CPO 결정으로 남긴 **바로 그 자리** 다.
🟢 WU-081 이 틀린 게 아니다 — 값이 «도달한 상태» 를 쟀고 production 은 도달하지 못했다(분모 차이).
```

🔴🔴 **시장조사 카테고리는 «실제로 쓰인다» — 제거하지 않았다**:
```
① 국내 샵 scope   resolveMarketCategoryScopes (check/route:100 · trigger:76)
② 해외 scope      comparison/search/route:84
③ 🔴 **원가 정책**  market-intelligence:568 resolveCategoryCostPolicy  ← 가격 계산에 들어간다
🟢 셀러 URL 직접 입력 경로(`collectUrlCandidatePool`)는 **안 쓴다**(grep 0) —
   🔴 그러나 **같은 분석 1회가 ①②③ 을 함께 돌려** 그 경로만 떼어 낼 수 없다.
⟹ §4 제거 조건 **A 불충족** ⟹ **유지 + owner 보고**(CPO §9).
```

🔴🔴 **회귀가 내 설계 실수를 잡았다**(§10 포착) — `wu-030` 의 「transient 는 누적되지
않는다」. 1차 구현의 `setGeminiEvidence((prev) => prev ?? …)` 가 **상품 A 의 후보를
상품 B 화면에 남긴다**. 🟢 덮어쓰기로 고쳤고 `prev` 는 **애초에 불필요** 했다
(effect 는 `autoCheckResult` 가 바뀔 때만 돌고 「다시 분석」은 그 값을 안 바꾼다).

🔴🔴 **하니스를 두 번 고쳤다** — ⒜ 1차 render 테스트가 **틀린 컴포넌트**(MiPanelView)를
마운트했다(effect 는 바깥 패널) ⒝ **변이 5개가 전부 「통과」로 나왔는데 하니스가
로드조차 안 됐다**(정규식 이스케이프 파손 · 이 트랙 **다섯 번째**). 🟢 고친 뒤 W1~W5 전부 FAIL.

🔴 **CEO Action — Production UI 1회 확인**(보고서 §17 · 「다시 분석을 누르지 않고」 A 시나리오).

### 🟢🟢 WU-081 `MI-DOMESTIC-REVIEW-UI` — **구현/배포 · CEO 확인 1회 대기**

🟢 전문 `docs/MI-DOMESTIC-REVIEW-UI-081.md`. 🔴 MI 판정 0 · 가격 0 · 시장 0 · 집계 0 ·
API 0 · schema 0 · DB 0 · AI 0. 운영 **2 파일**(약 +95줄).

```
🇰🇷 **국내 후보 검토** 구역 신설 — 기존 후보 카드(`GeminiTransientCandidates`)를
   **그대로** 쓰고 「CEO 검토 [동일상품][다른 상품]」 블록만 더했다.
🔴 `onReview` 가 없으면 렌더되지 않으므로 기존 두 구역(🔎웹·🔗직접입력)은 **불변**.
🔴 `market === "KR"` 행을 **옮긴다 — 복제하지 않는다**(총 행 수 불변을 계약으로 잠금).
🔴 후보 0 이면 「국내 비교 후보가 없습니다」 — **「동일상품이 없다」로 적지 않는다**.
```

🟢🟢 **system verdict 와 human review 는 다른 state · 다른 타입 · 다른 DOM 노드** 다 —
SAME 클릭 후 `gt-verdict`·`gt-price`·`gt-blockers` **문자열이 동일** 하고 `fetch` **0회**
(마운트 DOM 으로 증명). 🟢 검토는 **화면 state 로만** 산다(영속 schema **불필요** 확인).

🟢 실데이터 — WU-063 표의 `market==="KR"` **7건**(biskuit·mustit·littleluna·miniboutique·
luksusbaby). §5-B CONTROL 재현 mismatch **0/51**. 🔴 `EXCLUDED` 2건도 **구역에 선다**
(WU-062 정책 유지 — 금액 집계에서만 빠진다).

🔴 **회귀 1 failed 포착·규명**(§10) — `mi-022` 의 「배선 존재」 앵커가
`evidence={geminiEvidence}` **문자열** 을 보고 있었다. 🟢 금지목록 검사는 통과했으므로
**진짜 위반이 아니고**, 앵커를 갱신하며 **강화** 했다(유도식 + 판정 어휘 동반 금지).
🔴 mutation M2 도 1차 통과를 잡아 단언을 강화했다(「검토 결과」라는 **말** 까지 단언).

🔴 **CEO Action — Production UI 1회 확인**(보고서 §15 에 URL·순서·기대결과·FAIL 기준).

### 🔴 WU-080 `MI-BRAND-EVIDENCE` — **REJECT · BRAND 는 올바르게 동작한다** (구현 0)

🟢 전문 `docs/MI-BRAND-EVIDENCE-080.md`. 🔴 운영 변경 **0** · 배포 0 · DB 는 **읽기만**.

```
BRAND blocker **14**/51 = MISMATCH **1** + UNCONFIRMED **13**(SAME 9 · 🔴 DIFF 4)
```

🔴🔴 **원인은 후보가 아니라 «원상품» 이다** — UNCONFIRMED 13 중 **6건은 후보 brand 가
있는데도** 걸렸다(`brandKnown = Boolean(x.brand && y.brand)`). 🟢 **DB 로 확인**:
```
bobochoses.com(브랜드 **공식몰**)  brand.value = **""** (1건은 "AW26")
junioredition.com(리테일러)        brand.value = **"Bobo Choses"**
🔴 역설 — **공식몰에서 못 읽고 리테일러에서 읽는다.** 원인은 공식몰 JSON-LD
   `brand.name = "AW26"`(시즌코드)이고 `SEASON_CODE` 규칙이 **올바르게** 버린다
🟢 전수로는 빈값 **42/527 ≈ 8%** — 우리 GT 가 거기 몰려 있다(표본 편향)
```

🔴🔴 **그 공백을 메우면 «악화» 된다**(CF-3 · 운영 owner 직접 호출):
```
🟢 BRAND OK 3 — C48 SAME · 🔴 **C50·C51 DIFFERENT**
🔴 UNCONFIRMED → **MISMATCH 악화 4** — C07 C14 C15 C47 **전부 Human SAME**
   (한글 「보보쇼즈」 · 일본어 혼재 · **샵 이름 「비스킷」** 이 통과 못 한다)
⟹ SAME 4건을 **더 세게 막고** DIFFERENT 2건을 연다
```

🔴 **MISMATCH 1건의 정체는 ④ 샵 이름 오인** — biskuit 가 `brand` 자리에 **자기 이름**
(「비스킷」)을 적었다. 🟢 우리 extractor 는 **명시된 자리를 정직하게 읽었다**(결함 아님).

🔴 **독립 증거 후보 5개 전부 실격** — JSON-LD(이미 읽음) · 본문 라벨(§10 금지) ·
domain(**§17 REJECT 조건**) · seller metadata(C07/C47 이 반증) · brand+modelCode(중복 축).

🔴 **B3 변이가 1차에서 통과했고 잡아서 하니스를 고쳤다**(§14) — microdata brand 가 있는
케이스가 없어 분기가 안 탔다. 🟢 보강 후 **1 FAIL**. 🟢 **B5(domain=brand)가 2 FAIL** 로
그 금지 축을 잠근다.

🔴🔴 **CPO 최종 판정(2026-10-18) — REJECT / CLOSED**:
```
BRAND 완화 ❌ · BRAND extractor 수정 ❌ · seller/domain fallback ❌ ·
추가 WU 자동 생성 ❌ · 기존 MI 보호계약 유지 ✅ · **국내 recall 현 구조의 한계로 확정** ✅
🟢 「`BRAND_UNCONFIRMED` 는 잘못된 판정이 아니라 **현재 확보된 증거 수준을 정확히
   반영하는 상태**」(CPO 문장 그대로)
```

🔴🔴 **누적 결론 — 여덟 축이 같은 답을 냈다**:
> 국내 SAME recall 을 올리는 모든 경로가 **「보호축 완화」로 수렴** 하고,
> 그 완화는 **예외 없이 Human DIFFERENT 를 같이 연다**
> (색상·제목·품번·라인·시장·가격·언어·브랜드 — WU-063~080).

### 🔴 WU-079 `MI-PRICE-EVIDENCE-RECOVERY` — **REJECT** (측정 전용 · 구현 0)

🟢 전문 `docs/MI-PRICE-EVIDENCE-RECOVERY-079.md`. 🔴 운영 변경 **0** · 배포 0 · HTTP 15.

🔴🔴 **분모를 정정했다** — `factsFromProductUrl` **하나만** 불러 「실패군 4건」으로 셌는데
운영 **전체 체인** 에서 luksusbaby 2건은 `enrichCandidatePrices` 가 채워
**`VERIFIED_CURRENT · priceSource="detail"`** 이다. ⟹ **진짜 실패군은 beaumonde 2건뿐.**

```
beaumonde  JSON-LD 0 · microdata 0 · meta 0 · data-* 0 · embedded state 0
           🔴 미치환 템플릿(`<%=displayOptionkey%>`)이 그대로 → **JS 렌더**
           ⟹ 「놓쳤다」가 아니라 **「없다」**
```

| CF | 실패군 회수 | 🔴 성공군 오추출 |
|---|---|---|
| CF-1 「판매가」 라벨 | **1/2**(C13만) | 🟢 **0/9** |
| CF-2 embedded state | 0/2 | — |
| CF-3 `class`(price/sale/cost) | 2/2 | 🔴 **5/9**(배송비·적립금·**다른 상품**) |
| CF-4 사이트 전용 | 🔴 안정 구조 **없음** | — |

🔴🔴 **그런데 회수 방향이 거꾸로다** — 안전 축이 회수하는 1건이 **Human DIFFERENT(C13)**
이고, Human **SAME(C27)** 은 「판매가」가 **설명 문구** 라 **회수 불가** 다.
⟹ 국내 버킷 5→6 · DIFFERENT 2→**3** · precision **60.0% → 50.0%** (최저가는 불변).
🔴 WU-063 제1원칙으로 **REJECT**.

🔴 **Q7 의 답 — 가격 추출은 «다음 병목이 아니다»**: 구조화 데이터가 있는 국내 샵은
**이미 전부 회수된다**(성공군 9/9 · 오추출 0). 남은 2건은 **JS 렌더 사이트 1곳** 의
site 정책 문제이고 WU-054 가 이미 HOLD 했다.

🔴🔴 **1차 하니스가 CPO §11 을 위반했고 내가 잡아 고쳤다** — 캐시만 읽어서
`extractFromJsonLd` 를 **죽여도 통과** 했다. 🟢 운영 owner 직접 호출 계약 6건을 추가했고
**V4(generic 숫자 parser 주입)가 4 FAIL** 로 그 금지를 잠근다.
🔴 V3 무효과도 규명 — 통화 가드의 **진짜 owner 는 `packages/pricing/src/price-validity.ts`**
(`resolveSourcePrice`)이고 `priceFromJsonLd` 의 검사는 **도달하지 않는 2차 방어선** 이다(V3b 4 FAIL).

🟡 **보류 보관 1건** — `fetchPath = SHOPIFY_JSON` 후보는 **HTML 을 받지 않아** 그 페이지의
JSON-LD(`offers.price` + `priceCurrency`)를 **영구히 못 본다**. 🟢 지금은
`enrichCandidatePrices` 가 메워 증상이 없다. 🔴 미측정이라 WU 로 열지 않는다.

### 🟡 WU-078 `MI-LANGUAGE-EVIDENCE` — **언어는 병목이 아니었다** (측정 전용 · 구현 0)

🟢 전문 `docs/MI-LANGUAGE-EVIDENCE-078.md`. 🔴 운영 변경 **0** · 번역/AI/Vision API **0** ·
HTTP 0 · 배포 0.

🔴🔴 **전제가 뒤집혔다** — `NO_TITLE_OVERLAP` 4건은 **전부 한글 제목에 라틴 품번이 그대로**
있고 운영 `modelCode` 가 **exact 4/4** 다. ⟹ 「언어 때문에 증거가 없다」가 **아니다.**

```
C07 SAME  허그 헤어리 몬스터 티셔츠 B226AC009   음역 **4**
C47 SAME  B.C. 엠보스 트랙수트 자켓 B226AC117   음역 **3**
C15 SAME  BC 엠보싱 트렉슈트 바람막이 자켓 …    음역 **2**
C08 DIFF  키즈 긴팔티셔츠 B226AC009 … 럭스보이  음역 **1**  ← 갈린다
🟢 한글 제목 후보 11건 중 「음역 ≥2」 발화 **3건 · 전부 SAME**(오탐 0/3) · 🔴 분모 3
```

🔴🔴 **그런데 회수가 0 이다** — `NO_TITLE_OVERLAP` 을 빼면 남는 blocker:
`C07 BRAND_MISMATCH` · `C15/C47 BRAND_UNCONFIRMED` · **`C08 []`(유일하게 완전히 열린다)**.
🟢🟢 **그래서 음역 축의 가치는 «회수» 가 아니라 «안전» 이다** — 완화 시 **C08(Human
DIFFERENT)이 뚫리는 것을 막는 전제조건**. 🔴 EXACT·버킷·최저가 변화 **전부 0**.

🔴 **병목은 언어가 아니라 «브랜드 축» 임이 확정됐다** — 그 완화는 WU-059 가
「`BRAND_UNCONFIRMED` 단독 완화 금지(FP +2 실측)」로 이미 닫았다. ⟹ **언어 축 종료.**

🔴🔴 **CPO 최종 판정(2026-10-18) — 음역/언어 축을 «생산 로직에 넣지 않는다»**:
```
회수 효과 **0** · 분모 **4**(음역 발화 3) · 문턱 `≥2` 근거 부족 ·
🔴 오히려 **C08 같은 DIFFERENT 를 열 수 있는 위험 축** 이다.
⟹ 언어 축 **종료.** 단독 WU 로 다시 열지 않는다.
```

🔴 **측정 중 제어문자 버그 둘을 잡았다** — 정규식에 **0x08**, 중복자 축약 역참조에 **0x01**
이 박혀 있었다(쉘/파이썬 이스케이프). 고치자 C15 **0→2** · C47 **1→3** 으로 바뀌었다.
🟢 **튜닝이 아니라 버그 수정** 이고 수정 전 숫자를 그대로 남겼다. 🔴 이후 역참조를 쓰지 않는다.

### 🔴 WU-077 `MI-MARKET-KR` — **⑥ 완화 불가 · 최저가가 틀어진다** (측정 전용 · 구현 0)

🟢 전문 `docs/MI-MARKET-KR-077.md`. 🔴 운영 변경 **0** · HTTP **0** · 배포 0.
🟢 §5-B CONTROL — 운영 `classifyCandidateMarket` 을 **그대로 불러** 전건 재현(mismatch **0/51**).

🔴🔴 **분모 셋을 가른다 — WU-073 의 「17」을 정정한다**:
```
① 내 도메인 휴리스틱 **17**  ② WU-063 표의 `kr` 라벨 **9**  ③ 운영 KR 확정 **7**
🔴 WU-073 의 ⑤~⑧ 분모는 **①** 이다. 섞지 않는다.
```

🔴 **CPO 종료 질문의 답 — 탈락 10 은 «셋» 으로 갈린다**:
```
⒜ 실제로 외화 표시        **4** — global.trenbe(USD)×3 · kihanan(JPY) ⟹ 해외가 **맞다**
⒝ KRW 인데 도메인 증거 없음 **4** — luxboy 1 · donokids 3  ← **유일한 회수 후보**
⒞ 가격 자체가 없다        **2** — beaumonde ×2 ⟹ ⑥이 아니라 **⑤ 문제**(이미 HOLD)
```

🔴🔴 **CF 전수 — 완화하면 「국내 최저가」가 틀린 가격이 된다**:

| 축 | KR | 버킷 | SAME | 🔴 DIFF | 최저가 출처 |
|---|---:|---:|---:|---:|---|
| **현재(운영)** | 7 | **5** | 3 | 2 | **₩88,000 biskuit · 🟢 SAME** |
| KRW 만으로 | 27 | 21 | 13 | 8 | ₩40,300 **junioredition(해외)** |
| `.kr` 만으로 | 9 | **5** | 3 | 2 | ₩88,000 · 🟢 SAME (**변화 0**) |
| +한국어 / +사업자 / 복합 | 11 | 9 | 5 | **4** | **₩59,000 luxboy · 🔴 DIFFERENT** |

```
🔴 CF-4·5·6 이 **숫자가 완전히 같다** — 한국어 축과 사업자 축이 **같은 4건** 을 연다
   (독립 증거가 아니다) · precision 60.0% → **55.6%**
🔴🔴 그리고 셀러가 보는 **국내 최저가가 Human DIFFERENT(₩59,000)로 바뀐다**
   ⟹ WU-063 제1원칙(「틀린 최저가가 미노출보다 더 큰 오류」)으로 **기각**
🔴 **CF-2 는 «다른 성질» 로 틀린다** — 최저가가 Human **SAME** 이라 라벨로는 안 잡히는데
   출처가 `junioredition.com`(**해외 사이트의 한국 표시가**)이다. WU-051 이 막은 그 모양.
   🔴 **Human 라벨만 봤으면 놓쳤을 오류다.**
🔴 C22(DIFF)와 C21·C43(SAME)은 **증거가 글자 그대로 같다**(같은 샵) ⟹ 샵 단위로는 못 가른다
```

🔴 **Y2 변이(`.kr`+외화를 KR 로)가 통과했고 조사했다** — 가드 공백이 **아니다**:
표본에 그 모양이 **0건** 이고, 🟢 Y2 를 넣으면 **기존 `mi-020` 계약이 FAIL 한다**(실행 확인).

🔴🔴 **그래서 ⑥은 «가장 큰» 병목이 아니다** — ⑥ 고유 손실은 **4건** 이고 그중 절반이
Human DIFFERENT 다. ⟹ **현재 구조의 상한에 닿았다**(WU-063~072 가 판정 축을 전부 닫았다).

### 🟡 WU-076 `MI-SOFT404-200` — **능력은 실재 · 적중 0 ⟹ HOLD** (측정 전용 · 구현 0)

🟢 전문 `docs/MI-SOFT404-200-076.md`. 🔴 운영 변경 **0** · 배포 0 · HTTP 139(read-only).

🔴🔴 **Human GT 대신 CONTROL probe 를 썼다** — 같은 호스트에 **존재할 수 없는 상품 URL** 을
넣고 무엇이 오는지 본다(사람 라벨이 아니라 **사이트가 스스로 내는 반증**).

```
CONTROL 40 호스트 — 404 **34** · 🔴 **200 2** · 403 2 · 실패 2
🔴 200 soft-404 «능력» 보유: **littleluna.co.kr · wconcept.co.kr** — **둘 다 한국 쇼핑몰**
🟢 **실제 후보 적중 0/90** ⟹ CPO 가 미리 정한 **HOLD 조건 성립**
🟢 덤 — 운영 분포(N=90): OK 66 · UNREACHABLE 15 · **REDIRECTED_AWAY 8** · NO_FACTS 1
   ⟹ **WU-075 가 실제로 일하고 있다**(WU-074 의 6건보다 2건 더)
```

🔴🔴 **1차 CONTROL 이 무효였고 내가 잡았다** — 경로 **마지막 칸** 을 바꿨는데 Cafe24 계열은
마지막이 `…/display/1/` **꼬리표** 라 **같은 상품** 이 왔다(bogus 제목 == 후보 제목).
🟢 **숫자 세그먼트**(상품번호)를 바꾼 2차에서 biskuit·miniboutique·mustit 은 **전부 404**.
🔴 **1차의 「200 5건」을 그대로 보고했으면 틀렸다 — 확정값은 2건이다.**

🟢🟢 **「발화한다면 잡을 축」이 확정됐다** — littleluna 의 soft-404 는 `canonical` 이 **사이트 루트** 다.
🔴 **WU-075 의 축으로는 못 잡는다**(리다이렉트가 없다) ⟹ **두 축은 서로 다른 구멍** 을 덮는다.
🔴 그러나 **지금 차단 이득 0 · 오차단 0/64** ⟹ 「해롭지 않지만 이득도 0」 → **넣지 않았다**.
🟢 wconcept 모양(제목 없음)은 기존 `NO_FACTS` 가 **이미 막는다**.

🔴 **`brand == og:site_name` 은 오염 지표로 쓸 수 없다** — 12건 중 **10건이 브랜드 공식몰**
(bobochoses · main-story)이고 거기서는 그것이 **정답** 이다.
🟢 WU-074 의 `facts.brand = "Kids21"` 오염은 **WU-075 로 사라졌다**.

🟢 **구멍의 모양을 «실행 계약» 으로 고정했다**(`wu-076-soft404-gap.test.ts` · 네트워크 0) —
운영이 지금 그 모양을 **통과시킨다**는 것을 owner 호출로 단언한다. 🔴 나중에 막으면
그 단언이 **FAIL 로 뒤집히고** 그것이 수정 증거다(쿠팡 고시 선례).

### 🟢🟢 WU-075 `MI-REDIRECT-AWAY` — **구현 완료 / 배포** (안 A · 운영 2파일)

🟢 전문 `docs/MI-REDIRECT-AWAY-075.md`. 🔴 추가 HTTP **0** · 새 판별 규칙 0 · UI 0 · schema 0.

```
⒜ `fetchPlainHtmlWithFinalUrl`(shopify-product-json.ts) — `response.url` 을 **보존**
   🔴 기존 `fetchPlainHtml` 은 **남겼다**(새 함수에 위임하는 얇은 껍데기).
      fetch 규칙 owner 를 둘로 가르지 않기 위해서다 — 기존 호출부/테스트 변경 **0**
⒝ `product-url-facts.ts` — `classifyUrlShape(finalUrl) !== "PRODUCT_PAGE"` 면
   **`REDIRECTED_AWAY`**(새 status). 🟢 판별기는 **입구에서 쓰던 그것** 이다
🟢🟢 소비자 변경 **0** — 두 drop union 이 `ProductUrlFactsStatus` 를 그대로 포함한다
```

🟢🟢 **실데이터 E2E(CEO 라벨 19건 · 실제 HTTP)** — 비상품 **6/6 제거** · 정상 **13/13 유지** ·
오차단 **0**. Positive/Negative/경계 **14 계약** · 🔴 mutation **M1 6F · M2 6F ·
M3(`response.url` 안 씀) 6F · M4 1F** → 복구 14 passed.

🔴 **회귀에서 1 failed 가 났고 이름을 포착했다**(§10) — `mi-020` 의 「htmlPath HTTP 1회」
가드가 **함수 이름 문자열** 을 세고 있었다. 🟢 성질은 보존됐고 이름만 바뀐 것이라
가드를 **유지·강화** 했다(원시 `fetch` 추가 경로도 막도록 — **그 가드는 그걸 못 막고 있었다**).

🔴 **남은 상한** — **리다이렉트하지 «않는» 200 soft-404 는 여전히 통과한다**(WU-074 표본
0건 · 미측정). 🔴 텍스트 휴리스틱은 **넣지 않았다** — WU-076 대상(CPO 지시).
🔴 `site-strategies/shopify`(원상품 수집)에는 이 방어가 **없다** — 후보 경로가 아니다.

### 🟢🟢 WU-074 `MI-PRODUCT-EVIDENCE` — **방어는 이미 있다. 배선이 없다** (측정 전용 · 구현 0)

🟢 전문 `docs/MI-PRODUCT-EVIDENCE-074.md`. 🔴 운영 변경 **0** · AI 0 · 배포 0 · HTTP 89(read-only).

🔴🔴 **① 원인 확정** — ④ 의 게이트는 **둘뿐** 이다:
```
⒜ `fetchPlainHtml`(shopify-product-json.ts:602) — `!response.ok` 면 null
   🔴 그런데 `response.url`(최종 도착지)을 **버린다**
⒝ `product-url-facts.ts:226-228` — `<title>`/`og:title` 이 있으면 **OK**
⟹ 「`/products/X` 를 요청했는데 **홈이 왔다**」를 구분할 **수단이 없다**
🔴🔴 CEO 가 「404」라 본 4건이 **전부 HTTP 200** 이다 ⟹ 진짜 soft-404 ·
   `!response.ok` 가드는 구조적으로 **무력**
```

🟢🟢 **② 방어는 이미 구현돼 있다 — 배선 비대칭이 결함의 형태다**:
```
Gemini 후보  gemini-candidate-pool.ts:290 → resolveCandidate 🟢 → :298 facts
AI   후보    ai-answer-pool.ts:95         → factsFromProductUrl **직접** 🔴
URL  후보    url-candidate-pool.ts:154    → factsFromProductUrl **직접** 🔴
🟢 `url-resolver.ts:78-101` 주석이 **`main-story.com` 을 실측 사례로 지명** 한다 —
   그것이 CEO 가 「홈페이지 메인호출」이라 한 **S4-1 바로 그것** 이다
🔴 WU-073 이 funnel 을 잰 경로가 **AI 후보** 다 — 방어가 **없는** 쪽이다
```

🔴 **③ 축별 전수** (비상품 **6**=CEO 사유 라벨 · 정상상품 **64**=CEO13+GT51):

| 축 | 비상품 차단 | 🔴 정상상품 오차단 |
|---|---:|---:|
| 현재 로직(title 만) | **0%** | 0 |
| HTTP 404/410 | **0%** | 0 |
| soft-404 **텍스트** | 33.3% | 🔴 **17.2%**(오탐이 더 많다) |
| JSON-LD Product 없음 | 100% | 🔴 12.5% |
| 구조화+가격 없음 | 100% | 🔴 12.5%(**beaumonde** 포함) |
| `og:type` ≠ product | 100% | 🔴 9.4%(**전부 한국 쇼핑몰**) |
| 🟢 `resolveCandidate`(운영) | **100%** | **0** |
| 🟢🟢 **최종 URL 모양 ≠ 상품** | **100%** | **0** |

🟢🟢 **최적안의 비용이 «0» 이다** — `fetchPlainHtml` 은 **이미 리다이렉트를 따라간다**
(`fetch` 기본값). `response.url` 을 **읽지 않을 뿐** 이다 → 추가 HTTP 0 · 새 파서 0 · 새 규칙 0.

🔴🔴 **변이가 내 인과 설명을 정정했다** — W1(`shape="UNUSABLE"` 줄 제거)이 **통과** 했다.
루트 URL 은 애초에 `PRODUCT_PAGE` 가 아니고 `isCrawlable` 이 그것을 요구하므로 **이미 막힌다.**
⟹ 막는 것은 그 줄이 아니라 **「최종 URL 의 모양을 본다」는 사실 하나** 다(W5 가 FAIL 로 확정).

🔴 **하류** — 비상품 6건은 `PRICE_UNAVAILABLE` **6/6** 이라 **가격엔 안 들어간다**(깊이방어).
🔴 단 ⒜ **화면 후보 목록에 보이고** ⒝ kids21 2건의 `facts.brand` 가 **"Kids21"**(사이트명)이라
**판정 입력이 오염된다**. 🟢 지금은 안전 방향(거짓 충돌)이지만 반대 방향은 **미측정**.

🔴 **구현하지 않았다**(CPO 금지). 안 A(최소 · `response.url` 재분류) / 안 B(전체 배선) 는
보고서 §10 에 있고 **CPO 판정 사안** 이다.

🔴 **CF-8 의 상한** — 「리다이렉트하지 **않는** soft-404」(같은 URL 에 200 으로 「없는 상품」을
그리는 사이트)는 이 표본에 **0건** 이고 그 모양에서는 **발화하지 않는다**(미측정).

### 🟢 WU-073 `MI-DISCOVERY-FUNNEL` — **발견량은 병목이 아니다** (측정 전용 · 구현 0)

🟢 전문 `docs/MI-DISCOVERY-FUNNEL-073.md`. 🔴 운영 변경 **0** · AI 0 · HTTP 0 · 배포 0.

| 단계 | 입력 | 국내 | 탈락(국내) | 원인 |
|---|---:|---:|---:|---|
| ① AI 후보 | 181 | **46** | — | 4 모델 합산 |
| ② URL 분류 | 181 | **30** | **91(16)** | `NOT_PRODUCT_PAGE` 87 · `SELF_REFERENCE` 4 |
| ③ fetch | 90 | 23 | 20(7) | 🔴 GT 선별 — **측정 범위 밖** |
| ④ product evidence | 70 | 23 | **0** | 🔴 통과율 100% |
| ⑤ price | 17 | 15 | 2 | beaumonde 구조화 0 |
| ⑥ market KR | 17 | **7** | 10 | 도메인 증거 없음 · 외화 |
| ⑦ 국내 버킷 | 17 | **5** | 2 | tier EXCLUDED |
| ⑧ 최종 EXACT | 5 | **0** | — | 삼중 잠금(WU-069) |

🔴🔴 **그래서 다음 개선은 discovery 가 아니다** — AI 는 국내 후보를 46건 올린다.
가장 크게 깎이는 구간은 **② URL 분류**(46→30) 이고 그 다음이 **⑥ 시장 확정**(17→7) 이다.

🔴🔴 **`classifyUrlShape` 가 «양방향으로» 틀린다**(이 WU 의 핵심 발견):
```
🔴 오통과 5 — 한국 CMS 목록이 **PRODUCT_PAGE** 가 된다
   beaumonde `goods_list.php` · bbambam `product_list.html`×2 ·
   foretforet `shopbrand.html` · donokids `shopbrand.html`
🔴 오차단 1 — SSG 의 **진짜 상품** `item/itemView.ssg?itemId=` 가 UNKNOWN_PAGE
🟢 `collections/*` 는 올바르게 LISTING_PAGE
⟹ 분류기가 **영문권 URL 문법에 맞춰져** 있다. ②의 91 탈락을 「정확한 차단」으로 읽지 않는다
🔴 **고치지 않았다** — WU-052 가 「안전한 목록/상품 분리 증거 없음」으로 HOLD 한 자리다
```

🔴 **④ product evidence 가 아무것도 거르지 못한다** — 70→70 이고 CEO 가 블라인드에서
**404·홈** 이라 판정한 **6건이 전부 통과** 했다. 🟢 ⑥⑦⑧ 가 막아 **가격에는 안 들어간다**
(깊이방어 작동) 🔴 단 **화면 후보 목록에는 보인다**(WU-010 성질).

🔴 **내가 틀렸다가 정정한 것** — 「오통과 7건」이 실제 **5건** 이다. URL **전체** 로
매칭해 추적 파라미터 `?icid=MAIN.product_listmain_2` 가 걸렸고 **진짜 상품 2건**
(littleluna·miniboutique)이 섞였다. 🟢 **경로만** 보도록 고쳤다 — WU-007A 와 같은 계열.

🔴 **섞지 않는 분모 셋** — ①~④(181 · WU-067 표본) ↔ ⑤~⑧(17 · WU-063 표본) ↔
「국내 46」(도메인 휴리스틱) vs 「⑥ 7」(운영 `classifyCandidateMarket`).

🔴 **금지는 그대로 유효하다** — AI/Gemini API ❌ · 소비자 구독 우회 ❌ · Registry 확대 ❌ ·
sourcing → price comparison 연결 ❌ · threshold 완화 ❌ · PRESUMED_SAME 자동 승격 ❌ ·
SKU-only / GTIN-only SAME ❌ · 색상사전 확대 ❌ · transient 영구 저장 ❌ · 외화 자동 환산 ❌ ·
URL 파일명 blacklist ❌ · 「JSON-LD 부재 = 목록」 ❌ · **소싱 backend 무조건 삭제 ❌**.

---

#### 🔴 아래는 **종료된 트랙 기록** 이다 (착수점이 아니다)

🔴🔴 **방향이 또 바뀌었다** — CPO: 「**지금은 구현보다 기술검토가 먼저다. Gemini API 는
즉시 OFF 유지, 잔액 ₩1 도 사용하지 않는다.**」 그래서 WU-023-A(Production one-shot)는
**열렸다가 보류** 됐고, 트랙이 **AI Web Research 기술검토** 로 옮겨갔다.

```
001 AI-RESEARCH-AUTOMATION-ARCHITECTURE  🟢 CLOSED — 「기술적 가능」과 「약관상 허용」을 가른다
002 AI-WEB-RESEARCH-AUTOMATION           🟢 CLOSED — 소비자 AI 웹 UI 자동화 **STOP**(1차자료)
003 AI-DISCOVERY-STRATEGY                🟢 CLOSED — MI 는 «약한» 게 아니라 **증거가 23% 구간에만** 있다
004 TRACK-A-BRAND-CODE-IDENTITY          🟢 PASS   — 품번을 title «뿐 아니라» URL·sku 에서 찾는다
005 P0 Provider capability matrix        🟢 PASS   — 호출 0 · 키 0
005 P1 Exa 벤치마크                      🟡 하니스만 — 🔴 **키 요청 철회됨**(005R)
005R Hidden AI Web Research 아키텍처      🟢 PASS   — 🔴🔴 채택을 가르는 것은 **가격이 아니라 저장 허용**
006 Anthropic Controlled Benchmark       🔴 **폐기** — 하니스만 남겼다(키 0 · 항상 SKIP)
006R 외부 API 0원 AI Web Research        🔴 **STOP** — 8조건 동시 충족 **0건**
007 Zero-Cost Deterministic Discovery   🔴 **STOP** (증분 0) + 🔴🔴 운영 FP 결함 1건 발견
007A Shopify Search Evidence Sanitize   🟢 CLOSED / FIX(FP 28/28 → 0) · 🔴 배포됐으나
                                        **Production Acceptance = FAIL**(CEO 테스트)
008 B226AC117 FAIL 원인 추적             🟢 완료 / 조사 전용
009 Identity/Market Provenance           🟡 C 만 구현 · A 전제 반증 · B 이미 구현 · D 보류
010 Candidate Display Provenance         🟢 **STEP 1 완료 — 경로 셋 · ③이 원인 성질**
022 AI vs MI 실측 트랙(022~022-11)       🟢 CLOSED — 🔴🔴 **AI 오류 ⊂ MI 오류**(ensemble 전제 붕괴)
023 병목 A — transient 생산자 경로        🟢 **HOLD / CLOSED** — 생산자 진입점 부재(코드 위치 확정)
```
🔴 **이 표에 「← 지금 여기」를 다시 붙이지 않는다.** 현재 상태는 위 착수점 절 하나다.

#### 🟢 WU-024 ~ 056 — **결론만** (CPO 확정 2026-10-17 · 전문은 각 `docs/`)

🔴 **이 표를 다시 해석하지 않는다.** 결론만 기준선으로 쓴다. 보호 계약은 위 표에 있다.

```
024 URL 후보 생산자            🟢 GO  — 🔴🔴 **WU-023 병목 해소** · `__url_candidates__` · AI 0
025 SSRF 입력 경계             🟢 GO  — 규칙 소유자 하나(`classifyOutboundUrl`) · 사본 금지
026 fetch DNS rebinding        🟢 GO  — 요청 직전 층(`guardedLookup`)까지 닫았다
027 배포 게이트                 🟢 GO  — 66커밋 Production 반영
028 MI 결과 정보구조            🟢 GO  — 가격에 **검증상태** 를 붙였다(「표시가 ↔ 상세확인」)
029 transient UX               🟢 GO  — 결과를 되물음 «밖» 으로 (입력은 안에 둔다)
030 ABC 연속 분석               🟢 GO  — 직전 차단 변경 셋 적용
031 Identity 정확도 감사        🟡 HOLD — 🔴 운영 `[object Object]` 버그 1건 발견·수정
032 Evidence 완전성             🟡 HOLD — False SAME 0 을 지키는 단조 축 **없다**
033 잔여 원인                   🟡 HOLD — CONTROL 은 `withConfidence`(WU-004 보강) 로만 성립
034 BRAND_UNCONFIRMED 분해      🟡 HOLD — 🔴 13 이 아니라 **9** (내 집계 정정)
035 브랜드 없는 SAME 구조        🟡 HOLD — 안전한 독립 증거 구조 **없음**(SKU/색상 단독 금지)
036 Human GT 3-Way             🟢 CLOSED — GT 51건 확보(SAME 27 · DIFFERENT 23) · **이후 전 WU 의 분모**
037 SAME MISS 안전 회복         🟢 GO  — 같은 스토어 다국가 리스팅 1건 회복 · FP 0
038 직접 URL E2E               🟢 CLOSED — 🔴 벽 셋 확인(그중 가격검증이 뒤에 주범으로 확정)
039 transient 가격 진입         🟢 GO  — 두 싱크를 MI 입력에서 **합쳤다**(응답 배열은 가른다)
040 sourcing ↔ 가격비교 추적     🟢 CLOSED — 🔴 `sourcing_candidates` 는 price-history 가 **안 읽는다**
041 variant 식별자 조사         🟢 CLOSED — GTIN 식별력은 완벽 · 🔴 verdict 효과는 0
042 GTIN 축 구현                🔴 REVERT — SAME 게이트는 **blockers** 라 축 추가로 안 뚫린다
043 GTIN variant evidence      🔴 REVERT — 색상 보호 없이 완화하면 **새 False SAME**(C25)
044 색상 증거 구조              🟢 GO  — `COLOR_VARIANT` 보류 신설(색상사전 확대 0)
045 SIZE_SYSTEM 비차단          🟢 GO  — +2 SAME · FP 불변
046 C29/C34 증거 부족           🟡 HOLD — 안전한 기존 증거 없음(MISS 를 억지로 줄이지 않는다)
047 C34 충돌 · meta desc        🟡 HOLD — meta description 채택 불가(6 안전기준 미달)
048 baby/kids 품번 정책         🟡 HOLD — **현재 정책 유지가 최적** (AB↔AC 변환 규칙 아님)
049 해외 참고가격 UI            🟢 GO  — 🔴 원인은 「UI 미구현」이 아니라 **응답 누락**
049-R 입력 경로 확정            🟢 GO  — 🔴 입력칸은 **2단 접힘** 뒤 · 버튼명은 「🔄 다시 분석」
050 국내 축 진입 추적            🟡 HOLD — 시장 게이트(KR 증거 둘뿐)는 실재 · 🔴 그 표본의 병목은 아님
051 KRW 오분류 수정             🟢 GO  — KRW 를 「해외 참고가격」에 넣지 않는다 · 🔴 AI URL 6건은 **상품페이지 0**
052 목록/상품 판별              🟡 HOLD — 안전한 분리 증거 **없다**(tennis-warehouse 가 오차단된다)
053 microdata reader           🟢 GO  — JSON-LD 없는 상품을 살렸다(USD 98 · Product scope 1개 게이트)
054 Product evidence gate      🟡 HOLD — 🔴 **Human SAME 1건이 죽는다**(beaumonde 는 구조화 데이터 0)
055 가격 검증 병목              🟢 GO  — 🔴🔴 **`priceSource:"detail"` 누락** 이 원인 · 국내 도달 **0 → 5**
056 국내/해외 집계·노출          🟢 GO  — 응답→화면 연결 완료 · 🔴 `EXCLUDED` 어휘 누출 1건 수정
056-R1 가격 구역 의미 충돌        🟢 **CLOSED / Production UI PASS** — 제목 분리
       「해외 참고가격」(🌐) → **「해외 동일상품 참고가격」(🧾)**
       🔴 환산 owner 는 「원본 상품」 헤드라인이었다(내 1차 추적 정정) · krwEquivalent 무변경
```

🔴 **이 트랙에서 반복된 실수 — 다음 세션이 먼저 읽는다**:
```
🔴 **칸 이름을 추측했다가 틀린 것이 12번** 이다. 타입/운영 코드에서 **읽고** 쓴다
   (`crossSellerAxes`✗ · `ProductFacts.category`✗ · `price_krw`✗ · `ExtractedProductData.name`✗ ·
    `ProductIdentityDna.sku`✗ → 실제는 `identifier` + `tier==="SKU"` …)
🔴 **운영 게이트를 «지어낸» 것이 1번** — 국내 축 자격을 `verdict==="SAME"` 으로 썼다.
   실제는 `market==="KR" && priceKrw && priceTier` 이고 그 앞에 `judgeDomesticCandidate` 가 있다.
   🔴 하니스는 **운영 호출 순서를 그대로 베낀다**(§5-B).
🔴 **변이가 적용됐는지 확인한다** — 「적용 실패」를 「통과」로 읽은 적이 있다.
🔴 **단언 좌표를 확인한다** — 엉뚱한 구간을 slice 해 통과한 적이 3번 이상이다.
```

### 🟢🟢 WU-010 STEP 1 — **화면 후보 공급 경로는 «셋» 이고 ③이 무관 상품을 올린다**

🟢 전문 `docs/CANDIDATE-DISPLAY-PROVENANCE-010.md`. 🔴 AI 0 · 검색 API 0 · 키 0 · 결제 0 ·
Registry 변경 0 · schema 0 · DB 쓰기 0 · 환산 0 · 임계값 0 · **배포 0**.

```
① 저장된 링크(DB)      GET  /api/domestic-price-sources/links  Panel:1842  → **0행**
② transient 국내       POST /api/domestic-price-sources/search DomesticShopSearch:180
                       후보 5 · INSUFFICIENT_EVIDENCE 5/5 → **표시 0**(더 보기에도 없음)
③ transient **해외**    POST /api/comparison/search             ComparisonShopSearch:218
                       후보 31 · CONFLICT 18 · SIMILAR 7 · UNKNOWN 6
                       🔴🔴 **표시 1** — junioredition.com 「Elovera Jacket … by **ICHI**」
                       **GBP 39** · SIMILAR · confidence **0.33**(≥ 0.2)
```
🔴 즉 **CEO 가 본 성질이 ③에서 재현된다** — 원상품은 Bobo Choses `B226AC117` ¥26,400 인데
**브랜드도 상품도 다른** 후보가 「유사상품」으로 선다.
🟢 게이트는 **30/31 을 막았다**(SIMILAR 6건은 confidence 0.14~0.17 로 하한 미달).
🔴 통과한 0.33 은 제목에서 **`jacket` 한 단어** 가 겹친 결과로 보인다.

🔴 **단정하지 않는 것 셋** — ⒜ 「CEO 가 본 것이 바로 그 ICHI 재킷」이라고 단정하지 않는다
(로그인 뒤 DOM 미열람) ⒝ 🔴 **샵 20/30 이 오류** 였으므로 「표시 1」은 **하한** 이다
⒞ 「브랜드가 있었으면 CONFLICT 였을 것」도 단정하지 않는다 — 🟡 **같은 HTTP 로 1회 더
돌려 반사실을 측정할 수 있다**(브랜드만 주입 → ICHI 가 CONFLICT 로 바뀌는지). 그것이
WU-009-A 의 가치를 **추정 없이** 재는 방법이다.

🟢 **STEP 2 — 저장 게이트는 건드리지 않았다.** CPO 요구 셋은 이미 충족돼 있다.
🔴🔴 그리고 **「low 를 `matchLevel` 로 빼면 과거 버그가 되돌아온다**」 — 리포 기록
(`DomesticShopSearch.tsx:60-67`): 진짜 동일상품(STRONG_IDENTIFIER)의 confidence 가
**0.42(=low)** 라 그 필터가 숨겼고 **의도적으로 제거** 됐다. 현재 축은 `matchTruth` +
`confidence ≥ MIN_DISPLAY_SIMILARITY(0.2)` 이고 `matchLevel` 은 게이트 입력이 **아니다**
(하니스 ①-4 가 그 성질을 단언으로 잠갔다).

🔴 **STEP 3 — 「시장 부재」를 기록할 기존 칸이 없다.** `price_observations` 칸 전수 확인:
관측은 **행의 존재** 로만 표현되므로 「미관측」과 「시장 부재」가 **같은 모양** 이다.
🟡 기존 자리 후보 둘(⒜ 상태 문자열 칸 ⒝ 샵 축 시도 기록)만 적었고 **새 테이블은 만들지 않았다**.

### 🟡 WU-009 — 네 항목의 결과가 **서로 다르다** (전문 `docs/IDENTITY-MARKET-PROVENANCE-009.md`)

```
A 브랜드 공백       🔴 **전제 반증** — 상품 데이터에 브랜드가 «없다»
B low 후보 처리     🟢 **이미 구현돼 있다** — 측정으로 확인
C 스냅샷 URL 정규화  🟢 **구현 완료**(안전한 절반) · 🔴 중복 «병합» 은 제품 정책이라 제외
D 시장 표시         🔴 **미구현** — 출처 화면 미확인 + 「시장 부재」 상태 모델 부재
🔴 AI 0 · Gemini 0 · 검색 API 0 · Registry 0 · 환산 0 · 임계값 0 · 배포 0 · 비용 ₩0
```

🔴🔴 **A — `og:site_name` 을 브랜드로 쓰면 FP 가 «커진다»**(실측):
```
vendor = **"AW26"** · JSON-LD Product.brand.name = **"AW26"** ← 페이지가 그렇게 적어 뒀다
🟢 og:site_name = "Bobo Choses" ← **사이트 이름** 이고 상품 브랜드가 아니다
🔴 우리 26건 원본 도메인: smallable 9 · tennis-warehouse 9 · junioredition 6 ·
   designerkidswear 1 · foretforet 1 → **25/26 이 멀티브랜드/리테일러** 다
   → 그 전부에 「Smallable」·「Junior Edition」이 브랜드로 박힌다(거짓 일치/거짓 충돌)
🟢 현재 동작(AW26 을 브랜드로 쓰지 않고 비우는 것)은 **옳다** —
   brand-resolver.ts 의 SEASON_CODE 규칙이 이미 막는다.
🟡 CPO 선택지 ⒜ 「브랜드 미확인」을 상태로 노출하고 탐색을 하지 않는다
   (WU-014 `NO_PRIMARY_QUERY` 선례) ⒝ 공식몰 도메인→브랜드 표(🔴 Registry 성격 →
   「Registry 확대 금지」와 만난다) ⒞ 현상 유지. 🔴 CTO 가 고르지 않았다.
```

🟢 **B — 이미 그렇다**: `judgeDomesticCandidate` 가 DROPPED/`NOT_MATCHED` 를 내면
`run-domestic-price-check.ts:1087·1106` 의 `continue` 가 **upsert 앞에서** 끊는다 →
저장 0 → 패널 후보 목록(= **DB 링크** · Panel:1842)에 **안 보이고** tier 에도 못 들어간다.
🔴🔴 **그래서 미확인이 하나 생긴다** — low 가 저장도 표시도 안 되는데 CEO 는 무관한 상품을
봤다. **그 노출의 출처 화면을 CTO 가 확인할 수 없다.** 🔴 출처를 모르고 UI 를 고치면 엉뚱한
구역을 고친다. 🔴 「참고 후보로 별도 표시」는 **노출을 늘리는** 변경이라 하지 않았다.

🟢 **C — 구현**: `canonicalizeProductUrl`(self-reference.ts 신규 순수함수) + `saveSnapshot`
진입 1줄. 🟢 **새 규칙 0** — 그 파일의 기존 두 집합(`NON_IDENTIFYING_PARAMS` + 밑줄 문맥)만
쓴다. 🔴 host·경로·로케일·식별 파라미터는 **그대로**(시장 보존) · 제거할 것 없으면 **입력
그대로**. 🔴 **병합은 안 했다** — `saveSnapshot` 은 URL 조회 없이 항상 insert 하고, 합치면
**셀러 편집이 섞인다**(제품 정책 · 기존 13건 처리 포함).
🟢 테스트 9 + 음성대조 M1 1 FAIL · **M2(쿼리 전체 삭제=과잉) 3 FAIL** → 복구 9 passed.

🔴 **D 보류 이유 셋** — ① 출처 화면 미확인 ② 「환율 환산이 아니다」류 표시가 **이미 일부
있다**(price-hierarchy.ts:453 · `costBasisIsKrMarket`) → 관계를 CPO 가 정해야 문구가
모순되지 않는다 ③ 🔴 관측 테이블에 **「probe 했고 404 였다」를 기록하는 칸이 없다** → 그
상태 없이 「KR 시장 없음」을 적으면 **미관측을 부재로 단정** 한다(§5-B 위반).

### 🔴🔴 WU-008 — CEO FAIL 의 **원인 추적 완료** (조사 전용 · 구현 0)

🟢 전문 `docs/B226AC117-FAILURE-ROOT-CAUSE-008.md`. 🔴 Gemini 0 · AI 0 · 키 0 · 결제 0 ·
새 기능 0 · Registry 0 · DB 쓰기 0 · 운영 코드 변경 0 · **재배포 0**.

🔴🔴 **전제 하나가 데이터로 반증됐다 — 이 문장을 그대로 쓴다**:
```
`¥26,400` 은 「엉뚱한 판매처 가격」이 **아니라** 테스트에 쓰인 **그 URL 의 원본 시장
가격** 이다. 테스트 URL 이 **bobochoses.co.jp**(일본 스토어 · `?utm_source=chatgpt.com`)
였고 canonicalProduct.price = {26400, JPY, source: **ORIGINAL**} 이다.
→ 🟢 헌장의 「원본 통화 그대로 · 환산 금지」와 **일치** 한다. 가격 오염이 아니다.
🟢 €120 = bobochoses.com 기본 · ₩258,000 = `.com` 의 **en-kr 시장** — 셋이 다른 시장이다.
```

🟢 **`₩258,000` 은 이미 갖고 있다** — `.com` 스냅샷 **11/11** 이 `en-kr: KRW 258,000` 보유.
🔴 `.co.jp` 는 **en-kr 0건** 이고 그 이유는 코드 버그가 **아니다**(실측):
```
GET bobochoses.co.jp/en-kr/products/b226ac117-….json → **404**
GET bobochoses.com /en-kr/products/b226ac117-….json → **200**
→ 🟢 일본 스토어에 **한국 시장이 없다.** probeOriginAndKrMarkets 는 정상 동작했다.
🔴 남는 것은 제품 결함 — `.co.jp` URL 을 넣으면 KR 가격을 영구히 못 보고,
   화면이 **그 이유를 말하지 않는다.**
```

🟢🟢 **CEO 가 본 「무관한 상품」은 사실이다 — 단 가격에는 들어가지 않는다**(실측):
```
운영 searchDomesticShops 재현 — 대상 샵 6 · 오류 0 · 후보 **5건 전부 looxloo.com** ·
전부 다른 상품(BLUEDOG 레깅스/가디건/우주복 · 플리스 머플러 · 턱받이)
🟢 matchLevel **전건 low** · 품번 Evidence **0/5** · 저장된 국내 링크 **0건**
🔴 「무관한 상품이 보인다」 = **사실(UX 결함)**
🔴 「그 가격이 동일상품 가격·판정에 들어간다」 = **반증**(EXACT 아님 · 링크 0)
🔴 Gift Bag/Veja 는 이 경로에 **없다** — bobochoses.com 이 두 workspace 모두 ws OFF.
   그 이름들은 **WU-007 에서 내가 bobochoses.com 에 직접 질의했을 때** 나온 것이다.
🔴 CEO 화면에 실제로 그려진 것은 **CTO 가 확인 불가**(로그인 뒤).
```

🔴 **왜 엉뚱한 후보가 나오는가 — 브랜드가 비어 있다**: `brand={value:"",source:"REQUIRED"}`
가 **12/13**(1건은 `"AW26"` = 시즌). 그래서 실제 검색어 전수에 **「Bobo Choses」가 한 번도
없다**(`B226AC117` · `embossed tracksuit jacket …` 넷). 🟢 기존 브랜드 오염 문제의 재확증.

🔴 **결함 목록(등급 분리)** — ① 스냅샷 **13개 중복** ①-b **쿼리만 달라도 별개 스냅샷**
(🟢 WU-007A 와 같은 계열) ② 스토어별 원본 통화 차이를 화면이 설명하지 않음 ③ `.co.jp` KR
시장 부재(제품 결함 · 코드 버그 아님) ④ 브랜드 공백 ⑤ low 후보 노출(가격 영향 0) ⑥
`miniboutique`(ljm8481.cafe24.com) 등록부 미등록 ⑦ 🟢 WU-007A FP 경로는 이 상품에서
**발화하지 않았다**(샵 OFF).

🔴 **CPO 결정 넷**(CTO 구현 0): ⒜ 스냅샷 URL 정규화/중복 ⒝ 스토어·시장 표시 ⒞ 브랜드 공백
⒟ low 후보 노출. 🔴 **WU-007A 를 되돌릴 근거는 나오지 않았다.**

🟡 **Zero-cost Discovery 전략은 «폐기가 아니라 보류»** 다(CPO 2026-10-14):
```
🟢 증명된 것은 「**무키 구조화 endpoint 의 추가 발견량 = 0/6**」 이고
🔴 「모든 Zero-cost Discovery = 가치 없음」이 **아니다** — 기존 운영 국내검색은 이미
   후보 175 · very_high 1/26 을 만들고 있다.
🔴🔴 **그래서 방향은 「새로 만들기」가 아니라 「이미 있는 Discovery 경로의 정확도와
   Evidence 오염을 먼저 제거하기」 다.** WU-007A 가 그 첫 건이다.
🟡 Common Crawl 도 보류 — 역할 후보는 **「아는 도메인 + 특정 경로 확인」** 까지만.
```

### 🔴🔴 WU-007 결과 — 증분 **0** · 그리고 **운영 거짓 양성 1건을 찾았다**

🟢 전문 `docs/ZERO-COST-DETERMINISTIC-DISCOVERY-007.md`. 🔴 AI 호출 **0** · 키 0 · 결제 0 ·
운영 코드 변경 **0** · 무키 HTTP **58 요청**.

```
① 질의 가능 도메인 상한   등록부 34 → AUTO_* 8 → 🟢 **무키 구조화 검색 가능 1**(bobochoses.com)
① 무키 구조화 증분        🔴 **Code Hit Rate 0/6 = 0%**
② Common Crawl           🔴 **새 도메인 0** — urlkey 가 `com,bobochoses)/…` 라
                         **역순 도메인이 키 앞부분** → 도메인 없이는 질의 불가(실측)
③ 기존 보유              링크 4/26 (EXACT_IDENTIFIER 1 · STRONG 1 · TEXT_CONFIRMED 1 · SIMILAR 2)
기존 운영 국내검색        WU-017 인용 — 후보 175 · very_high **1/26 = 3.8%** (재측정 안 함)
🔴 품번 없는 20건         **측정불가**(결정적 식별자 부재 · 새 매칭 규칙 만들지 않았다)
```

🔴 **소매처 직접 경로의 상한이 수치로 확인됐다** — 도메인을 찾아 주는 무키 색인이 **없어서**
도메인 목록이 **Registry 뿐** 이다. 즉 커버리지 상한 = **Registry 크기** 이고 §12-0 의
「Registry 확대가 목적이 아니다」와 **정면으로 만난다**(CPO 가 이미 지적한 그 긴장).

### 🟢🟢 WU-007A **CLOSED / FIX 적용** — FP 28/28 → **0** (CPO GO)

🟢 전문 `docs/SHOPIFY-SEARCH-EVIDENCE-SANITIZATION-007A.md`.
🔴 AI/외부 API 0 · Gemini 0 · schema 0 · DB 쓰기 0 · **Production 배포 0** · flag OFF.

```
🟢 고친 곳은 **한 곳** — `confirmBrandCodeInEvidence`(domestic-identifiers.ts) 안에서
   URL 을 읽기 «전» 에 **검색 문맥 파라미터만** 걷어낸다(신규 순수 함수
   `stripSearchContextFromUrl` + 로직 1줄). 🔴 호출부 2곳을 각각 고치지 않았다 —
   두 주석이 「**같은 건초더미**를 본다. 갈라지면 화면과 저장이 다른 판정을 낸다」고 명시한다.
🔴 **쿼리 전체를 버리지 않았다** — `?variant=` · `?product_no=` · `?branduid=` 는
   실재하는 식별 정보다. 제거 대상은 ① 🟢측정된 원인 = `_` 로 시작하는 파라미터
   ② 🟡예방 = 검색어 이름(q·query·keyword·keywords·search·searchword·sq·term·s).
   🔴 「측정됨」과 「예방」을 섞어 적지 않는다.
🟢 측정 — FP **0/28**(fixture 는 실제 suggest 응답 28건 · handle 에 품번 있는 것 **0건**) ·
   진짜 양성 **유지** · 기존 verdict **변화 없음** · 🔴 Before 83%(5/6)는 커밋 `2fcff3fd` 보존
🟢 음성대조 M1 3 FAIL · **M2(쿼리 전체 삭제 = 과잉 수정) 3 FAIL** · M3 5 FAIL → 복구 10 passed
🟢 WU-007 하니스 ①-4 가 `toBe(code)` → `toBeNull()` 로 **뒤집혔다** — 그것이 수정의 증거다
🔴 금지 전수 대조: threshold 0 · Identity 완화 0(방향은 **엄격화**) · 품번 질의 삭제 0 ·
   provider/어댑터 변경 0 · 배포 0
🔴 남은 교환(미측정) — 검색어 파라미터에 «진짜» 품번을 싣는 샵의 증거는 사라진다
```

### 🔴 아래는 WU-007 이 올린 «그 결함» 의 원래 기록이다 (🟢 WU-007A 에서 해결)

```
🔴 **우리 검색어가 「상대 페이지의 식별 증거」로 재활용된다.**
   Shopify Predictive Search 가 응답 URL 에 우리 질의를 되돌려 넣는다:
     /products/pony-gift-bag?_pos=1&_psq=Bobo+Choses+B226AC010&_ss=sc
노출 경로(전수 확인):
  buildCrossSellerSearchQueries(product-identity-dna.ts:432) **1번 질의 = 품번 단독**
   → searchShopifySuggest(shopify-suggest.ts:58-60) 쿼리 포함 URL 을 후보에 싣는다
   → match.ts:514 (WU-004 가 URL 을 건초더미에 넣은 줄) + attach-match-truth.ts:124·143
   → matchTruth **EXACT/STRONG** → priceTierFromLink **EXACT** → 국내 최저가·판매판정
   적용 도메인: shopifySuggestAdapter **11(OVERSEAS)** + bobochoses-kr
실측 노출량: 날것 URL 기준 83%(5/6) · **거짓 양성 27/27 = 100%** · 정규화하면 0/6
🟢 수정은 **1줄이고 새 정책이 아니다** — self-reference.ts:63-67 이 이미 적어 뒀다
   「Shopify 는 검색/컬렉션 문맥을 `_pos` `_psq` … 에 싣는다 — 전부 listing 을 가리지 못한다」
   정규화기도 있다 — normalizeCandidateUrl(gemini-candidate-pool.ts:162 · `u.search=""`)
🔴 **WU-007 이 Production 변경 금지라 고치지 않았다.** 대신 하니스 ①-4 가 **현재(결함)
   동작을 단언으로 고정** 했다 → 수정이 들어가면 **그 테스트가 FAIL 로 뒤집힌다**(쿠팡 고시 선례)
🟡 **CTO 권고: 고치는 쪽.** 현재 상태가 「다른 상품의 가격을 국내 최저가로 들여보낼 수 있는」 경로다
🔴 교환 하나 — 쿼리에 «진짜» 품번을 싣는 샵의 증거도 사라진다(그런 샵 존재는 **미측정**)
```

🟢 **CEO Action: NONE.**

### 🔴🔴 WU-006R 결론 — **외부 AI/검색 API 를 사용하지 않는다** (CPO 확정 2026-10-14)

🔴🔴 **전략이 확정됐다** — ❌ Gemini ❌ Anthropic ❌ OpenAI ❌ Perplexity ❌ Exa/Brave
❌ 외부 API 비용 ❌ 키 추가 발급/결제. 🔴 **WU-006 Anthropic 실측은 폐기** 다.

🔴 **CPO 8문 전수 판정 — 동시 충족 0건**(전문 `docs/AI-WEB-RESEARCH-ZERO-COST-006R.md`):
```
① AI 가 웹 검색을 하는가       🟡 일부 가능(Gemini in Chrome auto browse · Workspace Agents)
② 결과 URL 을 우리 시스템으로   🟡 **API 경로만** — 비-API 무료 경로엔 인터페이스가 **없다**
③ 사람 복붙 없이              🔴 아니오    ④ 로그인/승인 없이  🔴 아니오
⑤ 숨겨진 백그라운드           🔴 아니오    ⑥ 약관상 자동화 허용 🔴🔴 **금지**
⑦ 따져 파이프라인 연결         🟢 기술상 가능 — 🔴 ⑥이 깨지므로 무의미
⑧ 외부 API 0원                🔴 불가
🔴🔴 **②와 ⑧이 만나지 않는다** — 검색 가능한 것은 전부 유료, 0원인 것은 검색 능력이 0.
```

🔴🔴 **그리고 「구독으로 공짜로 돌린다」가 가장 먼저 닫힌다 — CTO 가 원문을 직접 확인했다**:
```
Anthropic Usage Policy (anthropic.com/legal/aup) 원문:
 「Resell, proxy, or otherwise provide access to Claude through unauthorized means,
   **including services that route requests through consumer subscriptions** or
   misrepresent the product or client being used」
Claude Code 법적 문서(code.claude.com/docs/en/legal-and-compliance):
 「Anthropic does not permit third-party developers to … **route requests through Free,
   Pro, or Max plan credentials on behalf of their users**」
 「Advertised usage limits for Pro and Max plans assume **ordinary, individual usage**」
🔴 우리가 Claude Code 를 쓰고 있으므로 새 세션이 「그걸 백엔드로 쓰면 0원」으로 갈 수 있다.
   **금지 문장이 그 행위를 직접 지명한다.** 🟢 반대 경계도 명시 — 「자사 인가 사용자(직원)의
   내부 용도」는 제한 대상이 아니다. 축은 「상업적인가」가 아니라 **「최종 고객을 대신해
   요청을 통과시키는가」** 다.
```

🔴 **구조적 결론 — 업계 설계 방향이 반대다**: MCP 공식 문서가 「**AI 앱이** MCP 서버에 연결
한다」이고, 역방향 primitive 였던 **Sampling 이 `2026-07-28` 로 폐기** 되며 공식 권고가
**「New implementations should integrate directly with LLM provider APIs」** 다.
🔴 즉 「숨겨진 AI Web Research」는 provider 들이 **닫는 방향** 이다.
🔴 Gemini CLI 의 무료 개인 OAuth 경로도 **2026-06-18 폐지** 됐다(공식 deprecation 공지).

🟢 **남은 0원 경로는 하나이고 AI 가 아니다 — 🔴 제품정책 결정 사안**:
```
🟢 소매처 직접 Discovery — robots.txt(RFC 9309) + sitemap.xml(sitemaps.org)
   + Shopify Predictive Search `/search/suggest.json`(**공식 문서화 · 무키**)
   + 🟢🟢 Shopify **UCP/MCP** `search_catalog`·**`lookup_catalog`**(품번 조회)·`get_product`
   🟢 CTO 실측(키 0 · 결제 0 · 읽기만): `/.well-known/ucp` **200** · `tools/list` **200** ·
      소매처 robots.txt 머리 주석이 **스스로 에이전트를 초대한다**
   🟢 왜 이것만 남는가 — **금지 조항은 「검색 인덱스를 파는 사업자」에게서 나오고,
      소매처와 직접 말하는 경로에는 그 사업자가 사슬에 없다.**
🔴 과장 금지 넷 — ⒜ 명시된 것은 「crawlable」(접근)이고 **저장 허용 명시는 아니다**
   ⒝ UCP 는 공개 `agent profile` URI 자체 호스팅이 필요하다(키·결제 아님)
   ⒞ robots.txt 가 조건을 달았다(「identity 로 식별」·「**scripted workarounds 없이**」)
   ⒟ 🔴🔴 **이것은 「웹 전체 검색」이 아니라 「아는 소매처 안에서 찾기」** 다 →
      커버리지 상한이 **Registry 크기** 이고 **§12-0 의 「Registry 확대 금지」와 정면으로 만난다**
🟡 보조 — Common Crawl(0원·무키 실측 200 · ToU 에 저장 금지/허용 **둘 다 없음** ·
   🔴 색인 약 1~1.5개월 지연 → **가격·재고 축 불가**, 「품번이 어느 도메인에 있는가」만)
```

🔴 **CPO 결정 둘** — ⒜ 「웹 전체 검색」을 포기하고 소매처 직접으로 갈 것인가(그러면 §12-0
금지와 충돌을 CPO 가 풀어야 한다) ⒝ Common Crawl 을 1차 후보 발견에만 쓸 것인가.
🔴 **CTO 는 둘 중 아무것도 구현하지 않았다.**

🔴 배제 근거(1차자료): Marginalia **CC-BY-NC-SA = 비상업 전용** · Mojeek 은 🟢 저장을 명시
허용하는 유일한 검색 provider 지만 **£3 CPM 유료** · IndexNow/Bing WMT 는 **질의 기능 자체가
없다** · SearxNG 는 **상위 엔진 약관을 상속**(숨기는 것이지 해결이 아니다) · Wikidata 는
🟢 CC0 인데 **분모가 없다**(전 세계 GTIN 2,620건 · 소매 URL 매핑 없음) · Chrome 내장 AI 와
Windows AI 는 **웹검색 능력이 0**(「No data is sent to Google」 = 정의상 검색 불가).

🔴 **미확인 — 사람이 해야 닫힌다**: OpenAI ToU/Usage Policies 본문이 자동 fetch 에 **전 경로
403** 이다. 「Automatically or programmatically extract data or Output」의 정확한 문구·섹션
**미판독** 이고 snippet 을 1차 판독으로 쓰지 않았다.

🔴🔴 **트랙 전체를 가른 한 문장**(005R · 1차자료):
```
**자체 검색 인덱스를 가진 사업자는 전부 「그 결과로 DB 를 만들지 말라」를 명시한다.**
  Google "cache … analyze … Grounded Results" 금지 · Bing "creating a database of
  Bing Services Output" · Brave "create a database of Search Results" · Exa §4.2(a)
🟢 자체 인덱스를 팔지 않는 사업자(**Anthropic**)만 Output 소유권을 넘기고 저장을 규율하지 않는다.
🔴🔴 그래서 Gemini 는 **두 번째 독립 사유로** 닫혔다 — 기존은 «비용», 이번은 «저장 금지».
   비용이 해결돼도 「Gemini 로 찾아 Registry 에 쌓는다」는 조합이 약관과 충돌한다.
```

🔴 **판정표 (CPO 확정 2026-10-14 — 외부 API 전면 제외로 갱신)**:
```
🔴 **외부 AI/검색 API 전부 — 전략상 STOP** (가격·약관 판정과 «무관하게» 사용하지 않는다)
   Anthropic · OpenAI · Gemini · Perplexity · Exa · Brave · Bing · Mojeek
   🔴 Anthropic 의 직전 등급 「🟡 CONDITIONAL GO」는 **전략 결정으로 대체됐다**
   🟢 그때 CPO 가 가른 축은 유지된다 — 「Output ownership = GO」 ≠ 「Registry 장기 저장·
      가격추적 자산으로 쓸 권리 = GO」
🔴 소비자 구독 우회(Claude Pro/Max · Claude Code)  🔴🔴 **STOP — 약관이 지명 금지**
🔴 소비자 AI 웹 UI(Gemini Web · ChatGPT Web · Copilot · Comet)  🔴 STOP
🔴 브라우저 확장으로 AI UI 자동화                  🔴 STOP (CWS 정책 + 2026 AI 조항)
🟢 Chrome 내장 AI · Windows AI                     🔴 **웹검색 능력 0** (약관 아니라 능력)
🟢 **소매처 직접**(robots+sitemap+suggest+UCP/MCP)  🟡 **유일한 0원 경로 · 제품정책 결정**
🟡 Common Crawl                                    🟡 보조(1차 후보 발견만 · 1개월 지연)
🔴 미확인 — OpenAI 정책 4페이지가 403 이라 **사람이 직접 열어야** 확인된다
```

🔴🔴 **승격된 아키텍처 원칙 — 이 문장을 그대로 유지한다**(CPO):
> 「**AI 가 만들어낸 URL 문자열을 그대로 믿지 않는다. URL 은 Discovery signal 이고,
> Evidence 는 따져가 직접 검증한다.**」

🟢 WU-006 하니스가 그것을 **코드로 구현하고 음성 대조로 잠갔다** — 후보 URL 을
`web_search_tool_result` **블록에서만** 뽑고, 산문 URL 은 **개수만** 센다(환각 관측값).
🟢 provider 쪽 보강도 있다 — `web_fetch` 는 **대화에 이미 등장한 URL 만** fetch 한다
(Claude 자기 출력에만 있는 URL 은 `url_not_in_prior_context` 로 거부된다).
🔴 단 `web_fetch` 는 **JS 렌더 사이트를 못 읽는다**(공식) → Evidence 는 여전히 따져가 가져온다.

🔴🔴 **그 하니스를 실행하지 않는다 — 006 은 폐기됐다**(위 WU-006R 절).
`ANTHROPIC_API_KEY` 를 **발급하지 않는다.** 🟢 하니스를 남긴 이유는 ① 게이트가 둘이라 키가
없으면 **항상 SKIP** 이고 ② ①-2 음성대조(「산문 URL 은 후보가 아니다」)가 **provider 와
무관한 영구 계약** 이라 어떤 Discovery worker 에도 그대로 쓰이기 때문이다.
🟢 공식 규격 기록(과금 단위·실패 무과금·URL 제약·JS 렌더 미지원)은 참고자료로 유지한다 —
`docs/AI-WEB-RESEARCH-ANTHROPIC-BENCHMARK-006.md`.

🔴 **전부 고정** — Gemini flag **OFF** · 잔액 **₩3,171 보존** · Production **HOLD** ·
provider 가입 **0** · API 키 발급 **0** · 결제 **0** · 운영 코드 변경 **0**(WU-004 이후 없다).

### 🔴🔴 WU-023 지시서 본문 — `MI-PRODUCTION-E2E-FINAL-023`

🔴🔴 **지금 착수하지 않는다.** 조건부 실행 WU 다(CPO 2026-10-14). 전문 지시서는 CPO 가
줬고 아래는 **착수 판단과 사전조건** 만 남긴 것이다.

```
착수 조건 둘 — **둘 다** 충족돼야 한다
  ① Gemini 실운영 호출 비용/크레딧 사용 **승인**
  ② CPO 가 **Production 배포 + CEO 최종 테스트 개시를 명시적으로 지시**
승인 기준점(실행 시점에 더 최신 승인 커밋이 있으면 그것으로 갱신해 기록한다)
  d6b1defd · origin/mi-gemini-005
🔴 flag `MI_GEMINI_DISCOVERY_ENABLED` 를 **CTO 가 임의로 바꾸지 않는다.**
🔴 실패하면 **즉시 개발 WU 로 전환하지 않는다** — FAIL 지점 · 재현 로그 · 실제 입출력 ·
   코드 경로 · 원인 · 영향범위까지만 보고하고 **CPO 가 분류** 한다
   (수정 필요 / 설정 / 비용 / 데이터 / 제품정책).
🔴 PASS 는 **8항 전부** 다. 「Gemini 가 후보를 찾았다」를 성공으로 쓰지 않는다 —
   MI 판정 → 최종 판매판정 → 등록 UX 까지 본다.
```

#### 🔴🔴 그 WU 를 열기 «전» 에 알아야 할 사전 점검 둘 (CTO 실측 · 코드 변경 0)

```
① 🟢 비용 상한은 **사실상 충족** 돼 있다 — 상품당 Gemini **1 call** 이다.
   🔴 그러나 호출부 파라미터는 `maxQueries: 2`(run-domestic-price-check.ts:901) 다.
   🟢 1 call 이 되는 실제 이유는 pool 이 **1개짜리 배열** 을 만들고
      `.slice(0, Math.max(1, input.maxQueries))`(gemini-candidate-pool.ts:248-255)
      를 걸기 때문이다 — 즉 **상한을 배열 길이가 지키고 파라미터가 지키지 않는다.**
   🔴 나중에 `buildPrimaryQuery` 가 후보 쿼리를 2개 내게 되면 **조용히 2 call** 이 된다.
   🔴 고치지 않았다(코드 변경 금지 구간) — 열 때 같이 판단할 사안이다.

② 🔴🔴 §11 의 계측표를 **CTO 가 Production 에서 읽을 수 없다.**
   `geminiMetrics`(토큰·grounding query 수·discovered/usable URL·outcomes)는
   POST `/check` 응답의 `domesticShop.geminiMetrics` 로 **브라우저까지만** 간다
   (run-domestic-price-check.ts:1329). 🔴 소비 코드 **0** · `console.log` **0건**.
   🔴 그런데 Production 화면은 로그인 뒤이고 CTO 는 브라우저를 몰 수 없다
      (메모 `production-payload-is-unreachable`).
   → 🔴 **그대로 열면 §11 「실제 계측값만 보고한다」를 충족할 수 없다.**
   🟢 선택지 셋 (전부 CPO 결정 · CTO 가 임의로 고르지 않는다):
      ⒜ `[MI-016-gate]` 와 같은 **로그 한 줄** 을 metrics 에 추가 → Vercel 런타임
         로그로 읽는다(메모 `vercel-runtime-logs-are-reachable`). 🔴 **코드 변경** 이라
         지금은 금지 — WU 를 열 때 **포함시켜야 한다.**
      ⒝ CEO/CPO 가 브라우저에서 응답을 복사해 전달한다(코드 변경 0).
      ⒞ 계측 일부를 「측정 불가」로 받아들인다 — 🔴 단 §11 과 충돌한다.
```

### 🔴🔴🔴 그 외에는 — **추가 개발 WU 를 만들지 않는다** (CPO 확정 2026-10-14)

```
🔴🔴 남은 것은 **개발 문제가 아니다** — 「실제 운영 조건에서의 최종 검증」이다.
그 조건은 **둘** 이고 둘 다 CTO 범위 밖이다:
  ① Gemini 크레딧/비용 정책을 **열 것**        ← CEO 비용 승인
  ② 그때 실제 Production 에서 **한 번 테스트할 것**  ← CPO 가 CEO 에게 전달

그 전까지 **전부 고정** 이다:
  Gemini flag           🔴 **OFF**
  Production deploy     🔴 **HOLD**
  추가 Registry 작업     🔴 **없음**
  카테고리 확장          🔴 **없음**
  해외 가격 집계 추가     🔴 **없음**
  microdata parser 추가  🔴 **없음**
  가격 추적 기능          🔴 **없음**
```

🔴 **CTO 는 이 상태에서 코드를 만지지 않는다.** 선제적으로 WU 를 만들지 않는다.
🟢 **CEO Action Required: NONE**(현재). 🔴 조건이 열리는 순간 **CPO 가** 테스트 URL +
정확한 테스트 상품 + 클릭 순서 + 기대 결과를 **한 번에** CEO 에게 전달한다 —
🔴 **CTO 가 CEO 에게 직접 요청하지 않는다**(§3).

🔴 그리고 지금 Production 을 테스트해도 **Gemini 후보 구역은 볼 수 없다** — flag OFF
라 `geminiEvidence === null` 이고 구역이 렌더되지 않는다(그것이 설계된 안전 성질이다).
배선이 끝나 실제 Production 화면을 테스트할 수 있게 된 **뒤에** CPO 가 CEO 에게
테스트 URL + 시나리오 + 기대 결과를 **한 번에** 전달한다.
🔴 다음 WU 범위는 **「MI 결과 → 등록 화면에서 필요한 상품정보/후보/판정 표시 →
기존 등록 흐름과 연결」 하나** 다. 새 Registry · 새 카테고리 · 가격 추적은 **불포함**.

##### 🟢🟢 WU-022 — ⑤ 배선 **구현 완료 / PASS** (`docs/MI-REGISTRATION-UX-WIRING-022.md`)

```
🟢 Gemini 후보가 **등록 화면에 transient 로 표시된다**(실제 마운트 DOM 으로 확인).
   운영 2파일 — (신규) GeminiTransientCandidates.tsx + Panel 배선 **31줄**.
   🟢 「🔄 다시 분석」 응답의 `domesticShop.geminiEvidence` 를 state 로 받아 렌더.
      (그 값은 **이미 응답에 있었고 화면이 버리고 있었다**)
🔴 저장 0 · schema 0 · API 변경 0 · 환산 0 · 해외 집계 0 · 자동 1회차 배선 0
   · 판매판정/등록판정 로직 0 · Registry 0 · 카테고리 0 · flag OFF · 배포 0
🔴 화면 규칙(DOM 으로 잠금): `UNKNOWN` → 시장 뱃지 **없음**(「국내」로 적지 않는다) ·
   통화 그대로(`EUR 75`) · 가격 없으면 **「가격 미확인」** · 고정 문구 두 문장 ·
   「동일상품 확인」 버튼 **없음**(DB 승격 금지).
🟢 mutation 6종 전부 FAIL(원상복구 15 passed) — 특히 **M6「기존 candidates 에 섞기」**.
   🔴 그 단언은 **개수가 아니라 속성** 으로 썼다(판정/집계 어휘와 같은 줄 금지).
🟢 회귀 admin **515 files / 7,678 passed · failed 0** · typecheck 10=baseline ·
   build exit 0 · guard 6/6.
```

🔴🔴 **「셀러가 실제로 본다」는 아직 아니다** — flag OFF 라 `geminiEvidence === null`
이고 구역이 **렌더되지 않는다**. 🟢 그래서 **배포해도 현재 화면이 한 픽셀도 안 바뀐다**
(설계된 안전 성질). 🔴 실제로 보이게 하려면 **① Gemini 크레딧 충전(CEO 비용 승인)** 이
선행돼야 한다(flag 를 켜도 그 전에는 항상 `API_FAILURE` · 실측 16/16).

##### 🟢 ⑤ 설계 근거 — `docs/MI-REGISTRATION-UX-WIRING-DESIGN-022.md`

🔴🔴 **진단이 「렌더가 없다」가 아니다 — 「데이터 출처가 다르다」 다**:
```
후보 목록은 `/api/domestic-price-sources/links`(= **DB 테이블**)를 읽는다(Panel:1833).
🔴 Gemini 후보는 그 테이블에 **절대 저장하지 않는다**(:1067 불변식) → 렌더만 추가해도
   **영구히 안 보인다.**
🔴 그리고 GET `/api/price-history/[id]`(:22)는 `computeMarketIntelligence` 를 **인자 2개**
   로 부른다 → `geminiEvidence` 가 **항상 null** 이다. 패널의 판정/가격은 그 GET 에서 온다.
🔴 GET 이 Gemini 를 부르게 하는 것은 **화면 열 때마다 호출** 이라 비용 구조상 금지.
🟢 **POST `/check` 응답에는 이미 들어 있다** — `{...result, domesticShop}`(:111)의
   `domesticShop.geminiEvidence` 이고, 패널의 「지금 확인」이 **그 json 을 이미 파싱한다**
   (:1977 부근 · `domesticShop` 만 버린다). page.tsx 자동 1회차(:465)는 응답을 통째로 버린다.
→ 🟢 **채택안 = transient prop 배선**(저장 0 · API 변경 0 · DB 0 · 파일 1~2개)
🟢🟢 그리고 **flag OFF 면 `geminiEvidence === null` 이라 구역이 아예 렌더되지 않는다**
   — 배포해도 **현재 화면이 한 픽셀도 바뀌지 않는다.** 그래서 ①(비용 승인)을 기다리지
   않고 ⑤를 먼저 닫을 수 있다(🔴 단 「보인다」는 fixture 주입 **마운트 DOM** 으로 증명).
🔴 화면 규칙: 환산 금지(통화 그대로) · `UNKNOWN` 을 「국내」로 적지 않음 · 가격 없는 후보는
   「가격 미확인」 명시 · **「이번 확인에만 쓰이고 저장되지 않습니다」** 를 구역 머리에 ·
   이 구역이 판매판정과 국내 최저가에 **영향 0**(P-32 와 같은 원칙).
🟢 **등록 흐름 연결은 이미 있다** — onSellerVerdictChange → buildSellAndRegisterView →
   StageBody → 등록 버튼. 🔴 그 선을 건드리지 않는 것이 맞다.
🔴 **CPO 결정 셋**: ⒜ A안 승인 ⒝ 자동 1회차(page.tsx) 포함 여부 ⒞ 해외 가격 «집계»
   구역 1차 포함 여부(**제안: 제외** — 후보 카드 한 줄까지만).
```

🔴 **Phase B 는 「개발」이 아니라 「테스트」다** — 여성의류 등은 **개발 대상이 아니라
테스트 대상** 이다. 실제 URL 몇 개를 넣어 기존 Gemini → MI → 판매판정이 도는지만 본다.
문제가 없으면 끝이고, **문제가 났을 때만** 공통 구조의 결함인지 확인한다.

🔴 **§2 의 「④ 다음 카테고리 ⑤ 카테고리별 실제 상품 검증」은 Commerce 채널 축이고
이 절(MI 축)과 다른 축이다.** 🔴 그러나 MI 축에서 「카테고리를 늘려 개발한다」로 읽으면
위 금지와 충돌한다 — **MI 축에서는 이 절이 기준이다.**

---

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
| **Domestic Link Coverage**<br>`docs/MI-DOMESTIC-LINK-COVERAGE-WU-STATE.md` | CHANGE DIRECTION | 🔴 원인은 검색이 아니라 **등록부** 다 — 취급 샵이 `MANUAL`/비활성이라 «안 뒤진다» |
| **Shop Registry 정책**<br>`docs/MI-SHOP-REGISTRY-WU-STATE.md` | HOLD | 🟢 Registry 는 의도대로 작동한다 — 🔴 좁음의 원인은 **사람의 선택** 둘이다 |
| **MVP 실상품 E2E**<br>`docs/MI-MVP-E2E-WU-STATE.md` | **PARTIAL** | 🟢 공통 구조는 돈다 — 🔴 끊기는 곳은 «후보 확보», GO 는 **0/9** |
| **Identity 원인 규명**<br>`docs/MI-IDENTITY-CAUSE-WU-STATE.md` | 코드수정 **NO** | 🟢 「동일상품인데 high 미달」 **0건** — Identity 는 정상이다 |
| **Facts 전달 경로**<br>`docs/MI-FACTS-TRANSFER-WU-STATE.md` | **C 정상전달** · 수정 **NO** | 🔴 직전 WU 의 「결함 셋」은 전부 **내 하니스 결함** 이었다 |
| **후보 facts 경로**<br>`docs/MI-CANDIDATE-FACTS-WU-STATE.md` | **E 정상** · 수정 **NO** | 🟢 후보 facts 는 전건 있고 판정도 **전건 돈다** — 열두째 WU 가 틀렸다 |
| **상세확인 가치**<br>`docs/MI-DETAIL-VALUE-WU-STATE.md` | **목록 경로 유지** | 🔴 SAME 승격 **0건** — 🔴 단 「가치 없음」이 아니라 **측정 불가** 였다 |
| **Gemini 후보 Identity**<br>`docs/MI-GEMINI-CANDIDATE-001-STATE.md` | **⑤+① · MI 정상** | 🟢🟢 **Dinossi 후보가 `SAME`(0.81)** — MI 는 정보가 있으면 SAME 을 낸다 |
| **Gemini Integration 재현성**<br>`docs/MI-GEMINI-INTEG-002-STATE.md` | **재현됨** | 🟢🟢 SAME 1(conf **1.0**) + PRESUMED_SAME 3 · FETCH_FAIL **0** |
| **Gemini Integration 구현**<br>`docs/MI-GEMINI-INTEGRATION-005-STATE.md` | **IMPLEMENTED /<br>PARTIALLY MEASURED** | 🔴🔴 **Gemini 선불 크레딧 소진(402)으로 측정이 닫혔다** — 🟢 그 장애에서 국내 경로가 **불변**(OFF 35 → ON 35) |

### 🟢🟢 열일곱째 WU — SAME 이 «재현된다» (서로 다른 3개 브랜드)

```
sample 상품 N=5(브랜드 전부 다름) · 후보 상한 3 · Gemini 5 · resolve 9 · fetch 14
후보 단위  SAME **1** · PRESUMED_SAME **3** · SIMILAR 2 · NOT_PRODUCT_PAGE 3
           FETCH_FAIL **0** · UNKNOWN 0 · CONFLICT 0

Bonjour Tunique   Gemini 20 → 🟢🟢 **SAME (conf 1.0)** · blockers 0 · conflicts 0
  reasons 핵심 상품명 clip/hair/tunique · 상품군 blouse · 소재 cotton:100 ·
          대상 KIDS · 사이즈 AGE↔AGE   🟢 **품번 없이** 또 SAME 에 닿았다
BOSS Baby Top     Gemini 12 → 🟡 **PRESUMED_SAME ×3**(conf 1.0·1.0·0.61)
  🔴 blocker 1 의 정체가 reasons 에 찍혔다 — 「보류: **양쪽 브랜드를 확인하지 못했다**」
  🟢 축 5개는 쌓였는데 brand 축이 확인 안 돼 SAME 이 보류됐다(보수적 동작)
  🟢 같은 상품이 **두 URL 에서 각각** conf 1.0 — 재현성의 직접 증거
Bobo Choses · Bonpoint  Gemini **0건** — 🔴 둘 다 color 가 null 이다.
  🔴 단 「색상 null 이 원인」이라고 단정하지 않는다(N=2 · 쿼리 텍스트 미확인).
  🟢 색상이 있던 3건은 **전부 후보를 받았다.**
```

🟢 **선행 WU 의 Dinossi(SAME 0.81)를 합치면 서로 다른 «3개 브랜드» 에서 재현됐다.**
🔴 CPO 세 갈래 중 「여러 상품에서 SAME 가능」 → **Integration 구현 WU 로 이동 가능.**
🔴 단 그것은 Production 변경이고 **CPO/CEO 결정 영역** 이다.
🔴 「Fetch 실패가 많다」는 **해당 없다** — `FETCH_FAIL 0` 이다
   (`NOT_PRODUCT_PAGE 3` 은 fetch 실패가 아니라 **분류 단계** 다).

🔴🔴 **하니스 함정 — `PageProbe` 를 손으로 만들지 않는다**:
```
1차 실행이 **12/12 UNKNOWN_PAGE** 를 냈다 → 「Gemini 후보는 못 쓴다」로 읽힐 숫자.
🔴 원인: PageProbe 를 자작했다. 실제 타입은
   (url) => Promise<{status, finalUrl, canonicalUrl}> 이고 **리다이렉트를 따라가야**
   한다. 내 probe 는 finalUrl 을 그대로 돌려줘 vertexaisearch 리다이렉트가 남았다.
🟢 리포에 실제 구현이 **이미 있다** — `createLivePageProbe`(live-page-probe.ts:87).
   선행 하니스 둘이 그것을 쓰고 있었다.
🔴 메모가 그 함정을 글자 그대로 적어 뒀는데 probe 를 자작해서 **다시 밟았다.**
```

### 🟢🟢 열여섯째 WU — **MI 는 정상이다. 정보가 있으면 SAME 을 낸다**

Gemini 가 준 해외 샵 URL 3개를 운영 owner(`factsFromProductUrl` →
`withConfidence`)에 그대로 넣었다. 원본은 DB 실재(`sku AAA1847110` · Pale Pink).

```
Smallable(navy)  🔴 fetch **UNREACHABLE**(PLAIN_HTML) → 판정 불가
Hive Boutiques   🟡 **PRESUMED_SAME** (0.44) — 제목이 "Holly Trouser" 로 **축약** 돼
                 hearts/ribbed/velvet/pants 가 없다 → 축 4개로 **한 칸 모자람**(정상)
Dinossi          🟢🟢 **SAME** (0.81) · blockers [] · conflicts []
                 reasons: 상품명 5토큰 · 상품군 pants · 색상 PINK · 소재 cotton:100 · KIDS
                 🟢 축 5개가 SAME_MIN_AXES=5 를 채웠다 — **품번 없이 SAME 에 닿았다**
전달 손실 0 (키 수 before == after)
```

🔴🔴 **그래서 판정은 ⑤ + ① 이고, MI 검증 계층을 수정 대상으로 «올리지 않는다».**
```
② ProductFacts 추출 문제  🟢 없음(2/3 전 축)   ③ 전달 문제 🟢 없음
④ Identity 판정 로직 문제  🟢 **없음**
⑤ 후보가 동일상품이고 MI 도 SAME  🟢🟢 **해당**(Dinossi)
① 🟡 부분 — Smallable 후보가 **navy** 였다(원본은 Pale Pink · 지시서와 URL 이 어긋났다)
→ 실제 문제는 **Gemini 결과를 MI 후보 입력으로 «연결하는» Discovery/Integration** 이다
```

🟢 **이 결과는 「국내 판매처에 식별정보가 부족하다」와 충돌하지 않는다** — 이번
후보 셋은 전부 **해외 샵** 이고 **Shopify JSON** 을 준다. 🔴 국내 Cafe24 목록에는
그 JSON 이 없다. 🟢 즉 두 결론이 같은 그림의 다른 부분이다.

🔴 **남은 별 과제 둘**(이 WU 에서 손대지 않았다):
```
① Gemini → MI 후보 연결(경로 D)에는 **운영 호출부가 없다**. 🟢 이 WU 가 그 연결의
   **가치를 처음으로 증명했다**(해외 후보 하나가 품번 없이 SAME).
   🔴 단 Production 변경이라 CPO/CEO 결정 영역이다.
② `factsFromProductUrl` 의 PLAIN_HTML 경로가 `maxHeaderSize` 를 쓰는지 —
   Smallable UNREACHABLE 의 원인 후보다(선행 메모에 CSP 17KB 함정 기록).
```

### 🔴🔴 열다섯째 WU — 상세확인은 «대상이 없다»

```
DOMESTIC_IDENTIFIER_EXTRACTORS(domestic-identifiers.ts:88) 등록 도메인 **단 2개**
  🟢 foretforet.com · 🟢 bobochoses.com(비활성)
  🔴 looxloo · rulii · chocoel · deuxbebe · littleluna · skysport  **전부 미등록**
→ fetchDomesticModelCode(:97)는 미등록 도메인에 **null** 을 준다
🔴 그런데 후보 대부분을 LOOXLOO 가 낸다 → 상세확인을 켜도 **23개 중 20개는 불변**

실측(실상품 2 · 후보 23 전수 · 실제 HTTP)
  상세확인 가능 **3/23** · 불가 **20/23** · modelCode 획득 **3/3**(추출기는 작동)
  🟢 verdict 변화 **0** · 🟢🟢 SAME 승격 **0** · 비용 fetch **3회**
  before/after 완전히 동일 — SIMILAR 4 · UNKNOWN 15 · CONFLICT 4
```

🔴🔴 **「상세확인은 가치가 없다」로 읽으면 틀린다.** 0 의 이유가 둘로 갈린다:
```
① 🔴 추출기가 없다 (20/23) → **실행조차 되지 않았다.** 「효과 0」이 아니라 미측정
② 🟢 추출기는 돌았는데 **원상품 품번이 null** (3/23)
   포레포레 3건은 상세 품번을 정상 획득(LM26KSJAC0074CFH 등). 그런데 원상품
   (Smallable/Louise Misha)의 brandModelCode 가 null → MODEL_CODE 축이 생길 수 없다.
   🟢 한쪽만 있는 품번으로 SAME 을 만들지 않는 **설계된 동작** 이다
→ 🟢 상세확인은 「**Bobo 공식 원상품(품번 있음) × foretforet 후보**」 조합에서만
   의미가 있고 그 조합이 이 표본에 **없었다.** 🔴 그 조합의 가치는 **미측정** 이다.
```

🔴 **「추출기를 추가하자」는 결론을 내지 않았다** — 선행 WU 가 판별 기준을 확정했고
`looxloo`/`rulii` 는 상품명·URL 에 해외 품번을 **적지 않는다** 고 실측됐다
(메모 `domestic-discovery-dies-at-low-not-at-search`). 붙여도 0 이다.
🔴 `colorText` 는 상세확인으로도 **안 채워진다** — 추출기는 `modelCode` 만 준다.

### 🟢🟢 열넷째 WU — **Cross-Seller 판정은 처음부터 정상으로 돌고 있었다**

```
실제 운영 검색 2상품 · 후보 23개 전수
  ① 검색 결과          후보 6 / 17
  ② candidate 생성     6 / 17 (어댑터가 만든다)
  ③ facts 생성         **6/6 · 17/17**  (facts 15칸 · brand 🟢 · coreTitleTokens 🟢)
  ④ facts 주입         **6/6 · 17/17**
  ⑤ crossSellerVerdict **6/6 · 17/17 생성**
verdict  Boo Bo Choses: SIMILAR 1 · UNKNOWN 4 · CONFLICT 1
         Astrid:        SIMILAR 3 · CONFLICT 3 · UNKNOWN 11
→ 🟢 **A/B/C/D 전부 해당 없음. E(정상) 이다.**
```

🔴🔴 **열두째 WU 를 정정한다(두 번째 정정)** — 「axes 전건 비어 있다 → 판정에
도달조차 못 했다」는 **틀렸다.** 판정은 처음부터 돌고 있었고, 내가 `c.match`
(없는 칸)를 읽은 것이다. 🔴 그리고 열셋째 WU 의 추론(「후보 쪽 facts 가 비어서」)
도 **반증됐다** — 후보 facts 는 **전건 있었다**(15칸).

🟢 **SAME 이 안 나오는 실제 이유 — 축이 모자라다(설계된 동작)**:
```
후보 facts  brand 🟢 · coreTitleTokens 🟢 · 🔴 brandModelCode **null**(전건) ·
            🔴 colorText **null**(전건)
🔴 brandModelCode null 에는 «설명이 있다»(match.ts:493-508) —
   confirmBrandCodeInTitle 은 원본 품번이 후보 제목에 **토큰으로 그대로** 있을
   때만 채운다. 🟢 값을 지어내지 않는다. 국내 샵 제목은 자체 품번(76A7D-320-01)
   이라 B226AC002 가 없다 → **null 이 맞다.**
🟢 SAME_MIN_AXES=5 를 채우려면 품번·색상 축이 필요하고 국내 샵 «목록 페이지» 에
   그 정보가 없다 → UNKNOWN/SIMILAR 가 **정상 산출** 이다.
🟢 선행 메모 domestic-discovery-dies-at-low-not-at-search 와 정확히 정합한다.
```

🔴 **남는 선택지는 하나이고 CPO 정책 결정이다** — 「후보 상세 페이지를 열어
품번·색상을 더 읽을 것인가」(비용 × 정확도 교환). 🟢 기존 장치가 이미 있다 —
`fetchDomesticModelCode` · `MAX_DETAIL_CONFIRMATIONS_PER_SHOP = 2`. **신규 개발이 아니다.**

### 🔴🔴 열셋째 WU — 열두째 WU 의 「결함 셋」을 «정정» 한다

```
❌ 「color 전건 null」      → 🟢 ProductFacts 에 `color` 칸이 **없다**.
                               실제는 **colorText** 이고 값이 정상이다
❌ 「titleTokens 전건 null」 → 🟢 실제는 **coreTitleTokens** 이고 정상이다
❌ 「axes 전건 비어 있다」   → 🟢 `match` 칸이 **없다**. match.ts:526-538 이
                               cross 를 **네 칸으로 펼쳐** 싣는다 —
                               crossSellerVerdict / Reasons / Blockers / Conflicts.
                               `axes` 는 아예 실리지 않는다(내부 값이다)
🔴 원인 하나 — **칸 이름을 owner 타입에서 읽지 않고 추측했다.**
🔴 이 트랙에서 같은 실수 **네 번**(match_truth 어휘 · canonical_product 칸 ·
   owner 패키지 2회 · 칸 이름 3개).
```

🟢 **네 지점 전부 정상 — C. 정상 전달**:
```
color  ① canonicalProduct 🟢 → backfill 🟢 → DNA 🟢 → facts.colorText 🟢
titleTokens → DNA/facts.coreTitleTokens 🟢 (["boo","bo","choses","shirt"])
brand  🟢 전 구간 동일 · brandModelCode "B226AC002" 🟢
🟢 productFactsFromIdentityDna(:219)는 **가공이 없다** — 한 줄씩 그대로 옮긴다
```

🔴 **brand=AW26 은 «추출 단계» 다(A)** — `brand = {value:"AW26", source:"ORIGINAL"}`.
`source: ORIGINAL` 은 **원본 사이트에서 읽은 값** 이라는 뜻이다 → 변환 오매핑이
아니다. 🔴 피해 실측: `crossSellerBlockers = [BRAND_MISMATCH "브랜드 AW26 ↔ AW26"]`
— 🔴 양쪽이 같은데 blocker 가 걸린다. **왜 그런지는 미조사다.**

🟢🟢 **판정기는 실제로 작동한다(대조군)** — 후보에 facts 를 넣으면:
```
Boo Bo Choses → crossSellerVerdict **PRESUMED_SAME** (reasons 9 · 품번 일치 · 색상 포함)
Astrid        → crossSellerVerdict **SAME** (reasons 5 · blockers [] · conflicts [])
🔴 그러므로 운영에서 판정이 안 도는 이유는 「원상품 facts 가 비어서」가 «아니라»
   **국내 후보 쪽 facts 가 비어서** 다 — 조건이 query.facts && candidateFacts 이고
   원상품 쪽은 **정상** 이었다. 🔴 후보 쪽은 이 WU 범위가 아니라 미조사다.
```

### 🟢🟢 열두째 WU — Identity 는 «정상» 이다. 고칠 근거가 없다

```
🔴 matchLevel 이 전건 **low** 다 — medium 도 없다. 「high 문턱에 걸렸다」가 아니라
   **점수가 거의 0** 이다(confidence 0 · 0.02 · 0.3 · 0.43 · 0.51).
   → 🔴 threshold 를 낮춰도 해결되지 않는다. low→high 는 한 칸이 아니다.
🔴 axes 가 **전건 비어 있다** — verdict/identifierConfirmed 도 null.
   withConfidence(match.ts:476)는 query.facts && candidateFacts 일 때만
   compareCrossSellerProducts 를 부른다 → **Cross-Seller 판정에 도달조차 못 했다.**
   (남는 matchReasons 는 scoreCandidateMatch 의 산출이고 다른 함수다)
```

🟢 **후보를 열어 보니 «정말 다른 상품» 이다** — 그래서 low 가 **옳다**:
```
Boo Bo Choses T-shirt      → 데님셔츠 · 쁘띠북 · 참(charm)
All About Monsters T-shirt → 쁘띠북 · 컬러링북 · BLUEDOG레깅스(다른 브랜드)
Smallable/Bobo Washed Tee  → 트랙수트팬츠 · 데님윈터캡 · 롱퍼프숏양말
Smallable/L.Misha Astrid   → 🟡 같은 모델이나 **다른 프린트/시즌**
                              (Cream Floral Haven SS26 · Cream Rosa Festa SS25)
🟢 Precision 이 지켜졌다. 「동일상품인데 high 미달」 = **0건**
```

🔴🔴 **그런데 이 WU 가 새 결함 셋을 드러냈다**(고치지 않았다 — 승인 영역):
```
① productFactsFromIdentityDna 가 **color 를 옮기지 못한다**(전건 null).
   원상품엔 색상이 있다(Heather grey · Midnight blue · Blue · Cream)
   → 색상 축이 **영구히 죽어 있다**
② titleTokens 전건 null → 제목 겹침 축도 죽어 있다
③ AW26 브랜드 오염이 **실제 피해** 를 만든다 — Bobo 공식 3건 brand 가 "AW26" 이고
   후보 brand 는 "BOBO CHOSES" → matchReasons 에 「브랜드 불일치」가 찍힌다
🟢 ①②가 살아나면 compareCrossSellerProducts 가 **처음으로 호출된다.**
   🔴 지금은 match 가 null 이라 Cross-Seller 판정이 **아예 돌지 않는다.**
🟢 선행 메모 mi-p0-02-whitelist-works-chain-breaks-at-identity 와 정합한다.
```

🔴 B226AB069 후보 0 — 7샵 전부 0 · 오류샵 0. 같은 브랜드 AC002/AC018 은 나왔으니
**검색 경로·검색어 문제가 아니다.** 🔴 샵 카탈로그 부재 쪽 증거가 강하지만
카탈로그를 전수로 세지 않았으므로 **단정하지 않는다**(측정불가).
🟢 검색어를 바꿔 성공시키지 않았다(금지 사항).
🔴 후보를 낸 샵은 **LOOXLOO · 포레포레 둘뿐** 이고 나머지 5샵은 전건 0 이다.

### 🟢🟢 열한째 WU — 실상품 9개를 운영 owner 로 «실제로» 돌렸다

```
아동의류 5 (Bobo 공식 3 · Smallable 2) · 테니스 4 (Sergio Tacchini)
① 원본 정보        **9/9 PASS**
② Google/Naver     9/9 **NO_PRODUCTION_PATH** 🔴 FAIL 이 아니다(운영 호출부 0)
③ 국내 후보 탐색    **4 PASS** / 5 후보 0 → 🟢 검색 호출은 **63/63 정상응답**(오류샵 0)
④ Identity         9/9 **미도달** — high 이상 후보가 0 이라 판정에 닿지 못했다
⑤ 가격·통화        **9/9 PASS** 🟢 전부 원본 통화(EUR/USD) · **KRW 오염 0**
⑥ GO/STOP          9/9 **STOP** 🔴 데이터 없는데 GO 로 추정하지 않았다
```

🟢 **실효 탐색 샵 7개**(전수 34 → isBatchSurveyTarget 19 → AUTO_* 7):
CHOCO.EL · LOOXLOO · RULII · 포레포레 · DEUXBEBE · LITTLE LUNA(KIDS) · 스카이스포츠(TENNIS)

🔴 **테니스 4건 전부 후보 0 — 그런데 제품 결함이 아니다**:
TENNIS scope 샵이 **스카이스포츠 1곳** 뿐이고 선행 WU 가 그 샵의 브랜드 교집합을
**0** 으로 실측했다(테니스 전문점이 Sergio Tacchini 를 취급하지 않는다).
🔴 **국내 취급처 부재** 다 → threshold 를 낮추면 오탐만 늘어난다(지시서 §4-① 금지).

🔴 **미규명으로 남긴 것 — 그래서 코드를 고치지 않았다**:
```
아동 4건  후보 5~17개가 나왔으나 matchLevel 이 전부 medium 이하(high 이상 0)
아동 A    B226AB069 만 후보 0 (같은 브랜드 AC002/AC018 은 나왔다)
🔴 원인을 모르는 상태에서 고치면 **threshold 완화** 가 되고 그것은 금지 사항이다.
→ 코드 변경 0 · 배포 0 · CEO 테스트 요청 없음.
```

🔴🔴 **하니스 함정 — 로컬에서 운영 함수를 부를 때**:
```
① `listDomesticPriceSources` 는 **로컬에서 못 부른다** — getSupabaseAdmin() 이
   SUPABASE_SERVICE_ROLE_KEY 를 요구하고(§10) 없으면 조용히 null → `return []`.
   🔴 그대로 두면 **「후보 0 = 검색 실패」라는 완전히 틀린 결론** 이 난다.
      실제로 첫 실행이 9/9 FAIL 로 찍혔다.
   🟢 같은 머지(카탈로그 + workspace 설정 · 없으면 ON)를 **DB 로 재현** 한다.
② owner 패키지를 grep 으로 추측하지 않는다 — `buildCrossSellerSearchQueries` 와
   `productFactsFromIdentityDna` 는 둘 다 **@commerce/shared** 다(crawler 아니다).
   🟢 정답은 **운영 코드의 import 블록을 베끼는 것**
      (run-domestic-price-check.ts:1-22).
```

### 🔴🔴 열째 WU — `enabled` 의 owner 를 잘못 짚으면 틀린 처방이 나온다

```
🔴 직전 WU 에서 「domestic_price_sources.enabled=false 라 검색에서 빠진다」고 썼다.
   **그 전제가 틀렸다.** 실효값의 owner 는 **workspace_domestic_shop_settings** 다:
     listDomesticPriceSources(workspaceId)        domestic-price-source.ts:155
       → toSource(row, settings.get(row.id) ?? true)   :187
          🔴 **카탈로그의 enabled 칸은 «무시» 된다** · 설정 없으면 ON(fail-open)
       → run-domestic-price-check:683 이 부르고 :674 주석이 그 사실을 적어 뒀다
🟢 결론은 안 바뀌었다 — 🔴 그러나 「카탈로그를 true 로 되돌리면 된다」는
   **틀린 처방**을 낼 자리였다.
```

🔴🔴 **ON/OFF 와 수집전략은 «서로 다른 두 문» 이다 — 둘 다 통과해야 뒤진다**:
```
types.ts:224 — 「AUTO_API/AUTO_SCRAPE 인 것만 실제로 검색을 시도한다」
실측: COCO & JENNIE 는 ws 설정 null → **실효 ON** 인데 MANUAL 이라 검색 안 됨
     ws 설정 ON 3개(29CM 키즈·W컨셉·무신사 키즈)도 전부 MANUAL → 켜도 안 뒤짐
🔴 그래서 「켜는 것」만으로는 아무 일도 일어나지 않는다. 승격이 같이 필요하다.
```

🟢 **실효로 검색되는 샵 = 7** (링크 보유 workspace 2곳 동일):
```
CHOCO.EL · DEUXBEBE · LITTLE LUNA · LOOXLOO · RULII · 스카이스포츠(TENNIS) · 포레포레
🔴 OFF 1 = Bobo Choses Korea(공식) — 카탈로그·ws 설정(6/6) **둘 다 false**
🟢 아동의류 대상은 6개이고 실제로 링크를 만든 것은 **3개**(포레포레 32·듀베베 23·리틀루나 1)
workspace  설정 보유 6 · 스냅샷 보유 4 · 🔴 링크 보유 **2**
🟢 링크 0 인 2곳은 설정 차이가 아니다 — **스냅샷이 각각 1개뿐** 이다
```

🔴 **좁음의 원인 둘은 「사람의 선택」이다**(사고가 아니다):
```
① Bobo Choses Korea 를 2026-09-10 에 UI 로 껐고(당시 토글이 카탈로그를 직접 바꿨다,
   [id]/route.ts:16), 다음 날 **047 이 그 값을 모든 workspace 로 복사** 했다
   🔴 누가 왜 껐는지는 **구조적으로 확인 불가** — audit_log(422행)가 샵 토글을
      기록하지 않는다(AUTH_*/IMPERSONATION_* 만 남는다)
② MARKETPLACE 5곳(29CM·SSF·W컨셉·무신사·OCO)을 ws 설정에서 껐다
🟢 035 가 끈 것은 ssfshop·29cm·musinsa·wconcept·coupang 이고 **bobochoses 가 아니다**
🟢 apps/admin 코드에 enabled=false 를 쓰는 곳은 **없다**(자동 비활성 경로 아님)
```

🔴 **조사 우선순위 1위는 `coconjennie`**(우리 브랜드 4개 취급 실측) — 🔴 단
**sixshop product path 미관찰**이라 `AUTO_SCRAPE` 승격 후보로 **올리지 않았다**.
🔴 제외 근거 확보: `chouchouenfant`(현 시즌 0) · `nokimore`·`karymarket`(교집합 0).
🔴 `NOT_AVAILABLE` 12곳은 **약관** 이라 대상이 아니다. 🔴 `MANUAL→AUTO` 일괄 변경 금지.

### 🔴🔴 아홉째 WU — `NO_LINK` 의 원인은 «검색» 이 아니라 «등록부» 다

```
🔴 자동수집 가능 샵이 전수 34 중 **7개** 뿐이다
   MANUAL 12 · NOT_AVAILABLE 12(포털/오픈마켓 — 약관) · disabled 1 · 기타
🔴 링크 88건을 실제로 만든 샵은 **4개** — 그중 **Bobo Choses Korea(공식)** 가
   링크 36%(32/88)의 출처인데 **`enabled=false`** 다(이유 미조사)
🟢 활성 자동수집 7개 중 실제로 링크를 만든 것은 3개(포레포레·듀베베·리틀루나)
```

🟢🟢 **`MANUAL` 의 의미를 잘못 읽으면 결론이 뒤집힌다** — owner 주석
(`domestic-price-source.ts:261`, 대표님 지시 N-4.06 Track 1)이 명시한다:
> 「임의로 `AUTO_SCRAPE` 로 확정하지 않는다 — **실제 사이트 구조를 조사하기
>  전까지는 기본값을 `MANUAL` 로 둔다**(추정 금지 원칙).」

🔴 **즉 `MANUAL` 은 「수집 불가」가 아니라 「아직 조사하지 않았다」 다.**
그리고 선행 WU 가 실측한 MANUAL 샵 4곳 중 **2곳이 우리 링크 0 브랜드를 취급한다**:
```
coconjennie.com   (MANUAL) → Louise Misha · Emile et Ida · the new society · Misha&Puff
chouchouenfant.kr (MANUAL) → Bobo Choses · Bonpoint  🔴 단 현 시즌 0(아웃렛)
nokimore · karymarket     → 교집합 **0** (열어도 효과 없다)
🔴 sample N=4 샵. MANUAL 12곳 중 8곳 미측정
```

🔴 **`NO_LINK` 분해 — 합계를 내지 않는다**(상호배타가 아니고 ②④가 측정불가):
```
링크 0 **429** 의 브랜드 상위
  Bobo Choses 139 · AW26 40 · Sergio Tacchini 27 · (빈 브랜드) 25 ·
  Pèpè 19 · The Animals Observatory 18 · Louis Louise 18 · Mini Rodini 17
⑤ 전략상 탐색 안 함   하한 **21** (coconjennie 교집합 중 링크 0)
⑤-b 대상이 비활성      **32** (Bobo Choses Korea)
①-b scope 밖이 맞다    **28** (Sergio Tacchini 27 — 테니스, 0 이 맞다)
③ 식별정보 부족        **25** (브랜드 공백) · ③-b **40** (AW26 은 브랜드가 아니다)
①  국내 미취급         ~170  🟡 **추정** — 직접 확인 안 됨
②④ 검색 실패 / reject  🔴 **구조적 측정불가** — status=ACTIVE 88/88 이라
    떨어진 후보가 DB 에 «행으로 남지 않는다». 0 이 아니다
```

🔴 **다음은 코드가 아니라 조사·정책이다** — ① Bobo Choses Korea 비활성 이유
② coconjennie 승격 여부(product path 미관찰 → 조사 먼저) ③ MANUAL 12곳 중
어디를 조사할지. 🟢 판별 기준은 이미 있다(메모 `auto-source-adoption-standard`).
🔴 NOT_AVAILABLE 12곳은 **약관**이라 대상이 아니다.

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

### 🟢 코드는 remote 에 있다 — 🔴 **Production 은 아직 안 받았다** (2026-10-13)

```
origin/mi-gemini-005   🟢 **66커밋 push 완료** (behind 0 / ahead 0)
origin/main            🔴 HEAD 그대로 `1f030313` — **한 커밋도 받지 않았다**
작업트리               clean
```

🔴🔴 **왜 main 이 아니라 브랜치인가 — 지시 둘이 `main` 에서는 양립하지 않는다.**
CPO 가 「Push 🟢 승인 · Production Deploy 🔴 보류」로 **분리** 판정했다. 그런데
이 리포는 `.vercel/project.json`(루트 · `ttaejyo`)로 Vercel Git 연동이 걸려 있고
GitHub Actions 는 **없다** → **`main` push 가 그대로 Production 배포다**(헌장 §8).
🟢 그래서 브랜치로 밀었다 — 코드는 remote 에 보존되고(push 충족) Production 은
   한 글자도 안 바뀐다(deploy 보류 충족). 🔴 둘 중 하나를 포기하지 않았다.

🟢 **배포 트리거가 0 이라는 구조적 증거**: `origin/main..origin/mi-gemini-005` = 66.
   즉 production branch 가 받은 커밋이 **0** 이다. HTTP 상태코드에 의존하지 않는다
   (메모 `production-307-is-not-route-evidence`).
🟢 참고 실측(read-only GET): `/` **200** · `/today` 307 · `/api/price-history/check` 401.

🔴 **배포는 한 줄이면 된다** — 승인 시 `main` 에 머지하면 그때 **한 번** 배포된다.
   CTO 가 임의로 머지하지 않는다. `vercel --prod` CLI 는 쓰지 않는다
   (메모 `vercel-deploy-from-repo-root`).

### 🟢 WU-014 `DISCOVERY-QUERY` **CLOSED / PASS** — Primary Query 를 코드로 고정 (호출 0)

🟢 전문 `docs/MI-GEMINI-DISCOVERY-QUERY-014.md`. 🔴 Gemini 호출 **0** · ₩3,300 보존.

🔴🔴 **실측으로 확증된 결함** (sample 상품 N=15 · Gemini 호출 0):
```
Primary(queries[0]) = **Q1 15/15** — 상품명 «단독». 브랜드도 품번도 없었다.
품번 보유 3상품 중 Primary 가 품번 query 인 것 **0**
  (`generateQueries` 는 SPECS 순서로 열거하고 pool 이 slice(0,1) 을 썼다 →
   품번 축 Q5/Q6 는 5~6번째라 **도달 불가**)
Primary 토큰 — PRODUCT_NAME 71 · CATEGORY 13 · MATERIAL 7 ·
  🔴 노이즈(MARKETING 6 · COLOR 3 · SIZE 1 · PRICE 1) = 11 · IDENTIFIER 단 **1**
→ 🔴 식별력 거의 없는 긴 상품명을 던지고 있었다. 내부 검색어 확장(5.5)의 원인 후보.
```

🟢 **고친 것** — `buildPrimaryQuery`(discovery-core/query-generator.ts 신규):
```
L1  brand && productCode → `브랜드 품번` 그 둘만(색상·사이즈·마케팅 0)
L2  brand && core        → `브랜드 + 코어 2~4` (denylist 로 노이즈만 제거)
L3  core only            → 브랜드 없을 때
UNAVAILABLE              → **빈 값 · 호출하지 않는다**(NO_PRIMARY_QUERY)
🔴 denylist 다 — allowlist 가 아니다. 「Holly Hearts」·「T Bar」 같은 **고유 디자인명이
   곧 식별자** 이고 allowlist 면 모르는 디자인명이 조용히 죽는다.
🔴 **소재(Ribbed/Velvet)는 제거 목록에 없다** — CPO 예시가 유지한다. 분류기의
   MATERIAL 과 제거 대상을 섞지 않는다.
🟢 `generateQueries`(8축)는 **한 줄도 바꾸지 않았다** — 벤치마크가 8축 전부를 쓴다.
```

🟢 **Prompt v2** — v1 의 첫 줄 「최대한 많이 찾아 주세요」를 **지웠다**(그 지시가 확장을
부른다). 「최대 3개이고 **반드시 3개가 아니다**」·「확실한 후보가 없으면 **반환하지
마라**」·우선순위 5단·제외 8항·「**판정하지 마라**」.

🔴🔴 **보장과 비보장을 가른다** (CPO 정정 — 이 문장을 그대로 쓴다):
```
🟢 우리가 통제한다   1 상품 = 1 API call = **1 Primary Query** = 최대 3 후보
🔴 통제하지 못한다   Gemini 가 그 안에서 내부 검색어 **N** 개를 자동 생성한다
                    (실측 호출당 **5.5**) — API 파라미터로 1 로 **고정할 수 없다**
→ 목표는 「1회 강제」가 아니라 **N 을 최소화하고 실측** 하는 것이다.
```

🟢 **측정 스키마** — `primaryQuery` · `primaryQueryLevel` · `primaryQueryTokenCount` ·
`groundingQueries` · 🔴🔴 **`groundingQueryTexts[]`**(실제 검색어 문자열 전부).
🔴 「grounding query 는 측정할 수 없다」는 전제는 **폐기됐다.**
🔴 아직 보존 안 하는 것 — `modelVersion` · `cachedContentTokenCount`.
   **비용 원인 규명 후** 진행한다(CPO 지시).

🟢 테스트 19건 + **음성대조 4종**(품번우선 제거 2 FAIL · denylist 비우기 7 FAIL ·
상한 제거 2 FAIL · 빈query 방지 제거 3 FAIL → 복구 19/19).
🔴 기존 단언 4건을 **문구 → 의도** 로 갱신했다(`/판[단정]하지 마/` 등). 그리고
negative test 의 grounding **6→3** · 호출 **2→1** 은 **회귀가 아니라 목적** 이다.

🟢 회귀 admin **511 files / 7,614 tests passed · failed 0** · crawler **871 passed ·
실패 테스트 0** · typecheck **10=baseline** · guard 6/6 · build exit 0.

🔴🔴 **증거 등급을 섞지 않는다** (CPO 확정):
```
🟢 **확정** — Query 품질 결함(상품명 단독 15/15 · 품번 Primary 0/3 · 노이즈 11토큰 ·
   Primary 1개로 축소 · 테스트상 calls 2→1 · grounding 6→3)
🔴 **미검증 가설** — 「상품명 단독 Query 가 실제 5.5 grounding 확장의 **직접 원인**」
   → Gemini 를 부르지 않았으므로 **실제 감소량은 측정하지 않았다.**
     「원인을 잡았다」로 적지 않는다.
```

🔴 **다음은 최소 probe 뿐이고 Billing 이 먼저다** (CPO 확정):
```
선행  **Billing reconciliation 먼저.** ₩3,300 은 보존 자산. 지금 10~15 상품 금지.
승인 시 `MI-GEMINI-DISCOVERY-QUERY-VALIDATION-015` — **1~2 상품만**
       1 call/product · Primary 1개 · groundingQueryTexts 전체 기록 · 후보 최대 3 ·
       기존 MI 판정 · 실제 비용 확인
확인 **딱 4개** ① grounding query 수 감소 ② 불필요 후보 감소
             ③ MI 인정 후보 증가 ④ **유효 후보 1개당 비용 하락**
🟢 넷이 확인된 «뒤에» Children/Tennis 전체 표본으로 확대한다.
```

### 🔴🔴 WU-017 게이트 적중률 = **3.8%** — 이 게이트로는 비용이 거의 안 줄어든다

🟢 전문 `docs/MI-GEMINI-DETERMINISTIC-GATE-RATE-017.md`. 🔴 Gemini 호출 **0** ·
🔴 단 **「무료」가 아니다** — 국내 HTTP **111 요청**(상품당 4.27) 사용.

```
sample 상품 N=26 (아동 17 · 테니스 9)
deterministic very_high  **1** → 적중률 **3.8%** · Gemini 호출 필요 **96.2%**
  아동   1/17 = 5.9%        테니스 0/9 = 0.0% (🔴 후보 0 이 **9/9**)
후보 단위 matchLevel — low **173** · medium **1** · very_high **1** · 🔴 `high` **0건**
```

🔴🔴 **「게이트를 낮추자」를 데이터가 먼저 막는다**:
```
`high` 로 낮춘다?   → 🔴 high 가 **0건** 이다. 낮춰도 같다.
`medium` 으로?      → 2/26 = 7.7% 뿐이다.
→ 게이트가 안 걸리는 이유는 **문턱이 아니라 점수가 거의 0** 이기 때문이다.
🟢 헌장 §12 의 기존 기록(「matchLevel 전건 low · 점수가 거의 0」)과 정합하고,
   이번에 **N=26 · 후보 175** 로 확증했다. 🔴 threshold 완화는 금지이자 무효다.
```

🟢 **게이트는 유지한다** — 비용 0 이고 정책 안전한 유일한 술어다.
🔴 **그러나 비용 레버로 기대하지 않는다.** 실제 레버는 다른 쪽이다:
```
① deterministic 게이트   🔴 적중률 3.8% — 효과 거의 없음(실측)
② 당일 가드              🔴 **WU-018 에서 쟀다** — 자격률 0/26 · 실제 횟수는 측정 불가
③ NO_PRIMARY_QUERY       🔴 **WU-018 에서 쟀다** — 0/26, 발화하지 않는다
```

### 🔴🔴 WU-018 — **공짜 게이트 셋이 합쳐서 막는 비율은 3.8% 다**

🟢 전문 `docs/MI-GEMINI-SAME-DAY-GUARD-RATE-018.md`. 🔴 Gemini 호출 **0** ·
국내 HTTP **111 요청**(상품당 4.27) · 운영 변경은 **로그 한 줄**(`[MI-016-gate]`).

```
① veryHighSkipped              **1**   (3.8%)
③ geminiSkippedBySameDayGuard  **0**   (0.0%)
④ noPrimaryQuery               **0**   (0.0%)
⑤ geminiEligible              **25**   (**96.2%**)     sample 상품 N=26
🔴🔴 세 게이트 합계 **3.8%** — 공짜 레버는 여기서 거의 소진됐다
```

🔴 **`sameDayChecked = 0/26` 을 「가드가 효과 없다」로 읽으면 틀린다** — 이 표본의
국내 관측 행이 전부 8~9월 것이라 「오늘 확인됨」이 0 이 나온 **표본 성질** 이다.
🟢 반대로 「막을 것이 있다」는 간접 증거가 하나 있다 — **같은 날 여러 행이 남은
상품 2건**(「지금 확인」 route 가 `skipIfCheckedToday` 를 쓰지 않는다). 🔴 N=2 다.
🔴 「상품당 재확인 **횟수**」는 멱등이 행을 안 남겨 **측정 불가** 다. 잰 것은
**발화 «자격률»** 이고 둘을 같은 숫자로 쓰지 않는다. 🔴 절감액·% 는 산출하지 않았다.

🟢 **`noPrimaryQuery 0`** — primary level **L1_MODEL_CODE 6 · L2_BRAND_NAME 20 ·
UNAVAILABLE 0**. WU-014 가 품번 보유 상품을 식별자 우선 쿼리로 올렸다. 🔴 단
**쿼리 «모양»** 관찰이고 grounding·비용 감소 측정이 아니다.

🔴🔴 **그래서 남은 선택지는 전부 제품 정책이다** — ⒜ 쓸 수 있는 샵이 없는
카테고리에서 Gemini 포기 ⒝ 「지금 확인」에 당일 가드 적용(수동 재확인을 막는다)
⒞ 조건부 호출 축 신설 ⒟ Grounded Search 폐기. **CTO 가 넷 중 아무것도 구현하지 않았다.**

🔴🔴 **음성 대조가 WU-016 의 가드 공백을 찾았다** — deterministic 게이트를
`if (false)` 로 죽여도 42/42 가 통과했다(단언이 **대입문의 문자열만** 보고 있었다).
🟢 술어까지 잠가 **강화** 했다 → 변형 5종 전부 FAIL · 원상복구 PASS.
🔴 이것은 「주석을 벗긴다」와 **다른** 함정이다 — 빠진 것은 **「그 줄을 일으키는 조건」** 이다.

🔴 **`packages/crawler` 를 단독으로 돌려 회귀를 세지 않는다** — 그 패키지에는
러너가 **없다**(config 0 · `test` script 0). 유일한 러너는 apps/admin 이고 config
`include` 가 crawler·pricing·shared·category 를 끌어온다. 단독 실행은 `@/` 별칭이
없어 `match-truth-priority.test.ts` 가 **로드조차 못 한다**(내 diff 를 stash 해도
같은 실패 — 전부터 그렇다). 🟢 admin 전수에서는 `✓ 16 tests` 다.

🔴 **새 레버 하나가 보이는데 정책 결정이다** — 테니스 9/9 후보 0 이고
(TENNIS scope 샵 1곳 · 교집합 0 · 선행 WU 확정) WU-011 에서 Gemini 도 KRW 증거
**0** 이었다. 「scope 에 쓸 수 있는 샵이 사실상 없는 카테고리에서 Gemini 를 부르지
않을 것인가」 — 🔴🔴 그것은 **그 카테고리 Discovery 포기** 라 CPO 결정이다. 구현 0.

🔴 **「Gemini 호출을 X% 줄인다」로 적지 않는다** — 적을 수 있는 것은
「이 표본에서 게이트가 **1/26** 에서 발화했다」 하나다(운영 전수 498 값이 아니다).

### 🟢 WU-016 `COST-MINIMUM-ARCHITECTURE` **완료** — Gemini 를 최후의 보조층으로 (호출 0)

🟢 전문 `docs/MI-GEMINI-COST-MINIMUM-ARCHITECTURE-016.md`.
🔴🔴 **방향이 바뀌었다**(CPO 2026-10-13) — 「Billing 을 기다리며 멈춘다」가 아니라
**비용 0 으로 구조를 먼저 완성하고 마지막에 아주 작게 검증한다.**

```
확정 원칙  기존 MI/국내 검색 → 결정적 후보 우선 → **그래도 못 찾은 경우만** Gemini
          → 1회 · Primary 1개 · 후보 최대 3 → 기존 MI 판정
          → **가격 확인 가능한 경우만** 등록 판단에 반영
🔴 Gemini 를 **기본 검색엔진으로 쓰지 않는다.**
```

🟢🟢 **리포에 있던 선례 셋을 찾아 재사용했다 — 새로 만든 것이 적다**:
```
① `foundVeryHighInP0`(:789) 「very_high 나오면 더 안 뒤진다」 — **이미 제품 규칙**
② `hasObservationToday`(:696) 일 단위 멱등 — **이미 있다**
③ `visionCallCount`(:705) — 이미 있었고 **반환만 안 됐다**
```

🟢 구현(운영 1파일):
```
① deterministic 게이트 — `matchLevel === "very_high"` **기존 조건 그대로**
   🔴 새 threshold 를 만들지 않았다(테스트가 등장 «2곳» 을 잠근다)
② 당일 가드 — 🔴 **전체 경로가 아니라 Gemini 블록만** 막는다
   `skipIfCheckedToday` 를 켜면 「지금 확인」의 수동 재확인이 막히고 그것은
   **기존 제품 동작 변경** 이다. DB 는 **읽기만** 한다(저장 0).
   🟢 셀러가 여러 번 눌러도 **Gemini 비용은 하루 1회** 다.
⑥ `visionCalls` 분리 반환 — Vision 은 **이미지를 보내므로 단가가 다르다.** 합산 금지.
🔴 `geminiSkipReason` — 「호출 0」과 「스킵됨」을 **가른다**(섞으면 효과를 못 잰다)
```

🔴 **7항 대조** — ①⑤⑥ 구현 · ②는 014 에서 완료(🔴 감소량 미측정) ·
③④⑦은 기존 장치를 테스트로 **잠갔다**.

🟢 테스트 21건 + 음성대조 4종(게이트 무력화 · 당일가드 제거 · 스킵조건 분리 ·
Vision 합산 → 각 1 FAIL → 복구 21/21).
🔴 그리고 **내 기존 테스트의 약한 프록시 2건을 고쳤다** — 「블록 닫힘 없음」 검사가
flag 블록이 둘이 되자 깨졌고(「위치만 보면 속는다」고 써 놓고 내가 걸렸다),
고치는 과정에서 `indexOf("enrichCandidatePrices")` 가 **import 문** 을 집어 또 틀렸다.
🟢 **식별자가 아니라 호출 위치** 를 지목하도록 고쳤다.

🟢 회귀 admin **512 files / 7,635 passed · failed 0** · crawler **871 passed · 실패 0** ·
typecheck **10=baseline** · guard 6/6 · build exit 0.

🔴 **예상 비용 변화는 «구조적 추론» 이고 측정값이 아니다** — 「비용 X% 감소」를 적지
않는다. 🟢 단 **게이트 적중률은 Gemini 없이 잴 수 있다**(국내 검색만 돌려 very_high
비율을 센다) — 다음 WU 후보로 남겼다.

### 🟡 013 대조 준비 완료 · 🔴 **015 는 실행하지 않았다** (CPO 지시 2026-10-13)

🟢 `docs/MI-GEMINI-COST-RECONCILIATION-013.md` — **CTO 쪽 칸만 채운 1:1 대조표** 다
(§5 「대조할 준비만 한다」). 🔴 Billing 칸은 **CPO 가 채운다.** Gemini 호출 **0**.

```
CTO 내부 로그   Discovery 호출 **61**(OK 17 · 실패 44) · 토큰 **71,785**(성공 회차만)
                grounding **44** 🔴 **8 호출분만 포착** — 전체 기간 총량으로 쓸 수 없다
                Vision 이 기간 **0**(과거 누적 17행 · 마지막 10-08)
                🔴 cached 토큰 미집계 · 🔴 모델별 사용량 **불가**(별칭만 기록)
                🔴 probe 류 약 6 grounded + 2 non-grounded 는 **추정** · 복원 불가
시간창          🟢 확실 4건(덤프·WU-4 1·2차·WU-011·probe) ·
                🔴 미확정 3건(gemini-005-e2e · vclose-1 · vclose-2) — 추정하지 않는다
```

🔴🔴 **「₩21,700 사용」을 사용액으로 쓰지 않는다**(지시서 §6):
```
✅ 「충전/잔액 «표시» 기준 차액 ≈ ₩21,700」 · **실제 사용액은 미확정**
🔴 7월 충전분 · 기존 잔액 · 만료 · 세금 · 조정 · 환불 · 집계 지연 ·
   회계 기준 차이 · 다른 API/프로젝트/key 가 섞여 있을 수 있다 — 전부 미확정
🔴 **7월 ₩25,000 충전은 내가 몰랐다** → 내 이전 산식의 분모가 흔들린다
```

### 🟢 015 측정 설계를 «미리 등록» 했다 — 🔴 실행은 하지 않았다

🔴🔴 **`5.5` 를 Before 로 쓰지 않는다** — 두 변경이 섞여 있다:
```
BEFORE 관측  grounding 5.5 q/call · 조건 = 상품당 Query **2** + **구 Primary(상품명 단독)**
AFTER 예정   조건 = 상품당 Query **1** + **신 Primary(식별자 우선)**
🟢 분리 설계 — 같은 상품에 두 조건을 각각 1회(상품 1~2개 × 2조건 = **최대 4 호출**)
   ① 구 Primary · Query 1      ② 신 Primary · Query 1
   ① vs ② = **Query 내용 품질** 효과   ① vs 5.5 = **Query 수 감소** 효과
🟢 구 Primary 는 `generateQueries(identity)[0]` 로 그대로 재현된다 —
   WU-014 가 그 함수를 건드리지 않았으므로 **새 코드가 필요 없다.**
🔴 분모를 섞지 않는다 — 5.5 는 N=8 호출 평균이고 ①②는 1회씩이다.
```

🔴 015 KPI 넷(§20) — ① grounding 효율(🔴 `groundingQueryTexts[]` **내용** 까지)
② 후보 품질 ③ MI 유효 후보(threshold 0) ④ **비용 ÷ 유효 후보**
🔴 ④의 분자는 **Billing 이 ground truth** 다 — CTO 가 계산해 확정하지 않는다.
🔴 네 축을 섞지 않는다: `웹 후보 발견 ≠ 국내 동일상품 ≠ 가격 비교 가능 ≠ 등록 판단 변경`

🔴 **보고 금지 표현**(§25): 「grounding 비용 X% 감소」·「Gemini 비용 X원」·
「Recall X%」·「동일상품 X건 찾음」. 그리고 015 상태를 「측정 불가」로 적지 않는다 —
**「현재 실행하지 않음 · Billing reconciliation 선행 필요」** 가 정확한 상태다.

### 🔴🔴 **현재 상태 — Gemini HARD STOP · 다음은 Billing 원장** (CPO 확정 2026-10-13)

```
MI-GEMINI-ACCURACY-LONG-SPRINT-011   → CLOSED
MI-GEMINI-COST-AUDIT-012             → CLOSED
MI-GEMINI-PRICE-EVIDENCE-012         → **HOLD** (비용 원장 확정 전 착수 금지)
MI-GEMINI-COST-RECONCILIATION-013    → **NEXT**
Gemini API                           → **HARD STOP**
현재 잔액 ₩3,300                      → **보존 자산** (테스트 예산이 아니다)
추가 충전                             → 금지
Production                           → HOLD
Search / Intelligence 분리             → **전략 방향 승인**
```

🔴🔴 **「돈을 더 써서 원인을 알아낸다」는 행동은 금지다**(CPO 명시). ₩3,300 을
한 푼도 쓰지 않는다. 원장이 맞춰진 뒤에야 Gemini 사용 여부를 다시 판단한다.

🔴🔴 **그때의 판단 기준도 이미 정해졌다**(CPO):
> 「상품 동일상품 후보 발견이라는 기능 하나를 위해 Gemini Search Grounding 에
>  상품당 수백~수천 원을 태우는 구조라면, **그 구조 자체를 폐기한다.**」

### 🔴🔴 `₩18,700` 은 «원인» 이 아니라 **미조정 금액** 이다 (CPO 정정)

내가 감사에서 「리포 밖에서 와야 한다」로 적었다. **너무 나갔다** — 「다른 Gemini
서비스가 썼다」로 읽힌다. 🔴 그렇게 결론 낼 근거가 없다. 확정된 것은 이것뿐:

```
충전/잔액 기준 소진액                ₩21,700
우리 저장 로그로 «추정 가능한» 사용량   ≈ ₩3,000
현재 설명되지 않는 차액               ≈ ₩18,700  ← **미조정(UNACCOUNTED)**
```

🔴 **그리고 내 산식의 전제가 흔들린다** — CPO 가 **7월 ₩25,000 충전** 을 알려줬고
나는 그것을 몰랐다. 7월분·기존 잔액·만료가 섞이면 **분모 자체가 다르다.**

🔴 **분리해야 할 원장 항목 10개 — 전부 미확정이고 CTO 가 확정할 수 없다**:
```
다른 API 사용 · 다른 프로젝트/API key · modelVersion ↔ alias 차이 ·
grounding 실제 과금 단위(query 당 ↔ prompt 당) · Billing 집계 지연 ·
credit balance ↔ 비용화면 회계 기준 차이 · 7월/10월 충전분과 기존 잔액의 관계 ·
세금·조정·환불·크레딧 만료 · 실패(402) 호출 과금 여부 · 무료 구간 소진 여부
```

### 🔴 WU-013 `COST-RECONCILIATION` — **코드보다 원장이 먼저다**

```
조건  Gemini 호출 **0회** · 코드 변경 0
A. Credit ledger  7월 25,000 / 10월 25,000 / 현재 3,300 사이의 **실제 거래 원장**.
                  특히 「10/12 ₩25,000 구매 → 실제 잔액에 얼마가 더해졌는가」부터 확정
B. Billing project  같은 Account 아래 Gemini API · AI Studio · 다른 project ·
                  다른 API key · 다른 model/service 사용량 **전부 대조**
C. 실제 모델      requested model / resolved model / **modelVersion** 보존 확인
D. Grounding      API request → grounding request → web search query →
                  **실제 billing line item** 을 1:1 로 맞춘다
🔴 우리가 가진 `44 grounding queries` 는 **일부 실행에서만 측정된 내부 관측값** 이고
   ₩21,700 전체의 근거로 **쓸 수 없다**(CPO 명시).
```

### 🔴 비용 상한은 **4중** 이다 — 현재 ①만 있다

```
① 상품당 Gemini API call 상한      🟢 있다 (maxQueries)
② 상품당 grounding query 상한      🔴 **없다** — 호출 1회가 **5.5 쿼리**(실측)
③ 전체 실행 grounding query 상한   🔴 **없다**
④ 전체 실행 **KRW 비용** 상한       🔴 **없다**
🔴 금액 상한을 코드로 구현할지는 **Billing 원장 확인 «후»** 결정한다.
```

### 🔴 계측 보존은 승인 사항 — 지금 실행해 측정하지 않는다

한 실행 단위로 남겨야 할 것(CPO 확정):
`requestedModel · resolvedModel · modelVersion · promptTokens · candidateTokens ·
thoughtsTokens · cachedContentTokenCount · groundingQueries`
🔴 **단 이것을 측정하려고 Gemini 를 다시 실행하지 않는다.** 코드 계측은 비용 원인
규명이 끝난 «후» 진행한다.

### 🔴 「기존 57 vs Gemini 12」를 비용효율 증거로 쓰지 않는다 (CPO 정정)

내가 그 두 숫자를 구조 지지 근거로 썼다. **쓸 수 없다** — 57 이 실제 동일상품
후보인지 모르고 12 가 유효 후보인지도 모른다. 🟢 확정된 것은 **유효 국내 EXACT = 0**
하나다. 🔴 **후보 개수만 비교하지 않는다.** 두 경로 비교는 **여섯 축을 같이** 잰다:
`발견 후보 · TRUE SAME · 국내 KRW 가격 · 유효 domestic EXACT · 상품당 비용 · 호출/쿼리`

### 🟢 비용 감사에서 확정된 사실 (호출 0 으로 얻었다)

🟢 전문 `docs/MI-GEMINI-COST-AUDIT-012.md`. 🔴 **WU-012 는 가격 증거가 아니라 비용 감사로 바뀌었다.**

```
🔴🔴 **Gemini 호출 전면 STOP** — API 호출 ❌ grounding ❌ ON-axis 재실행 ❌
     가격 보강 실험 ❌ 추가 충전 ❌ `MI-GEMINI-PRICE-EVIDENCE-012` 착수 ❌
🔴 잔액 **₩3,300 은 「남은 테스트 비용」이 아니라 «보존해야 할 잔액»** 이다.
   비용 원인이 규명되고 새 구조의 예상 비용이 계산되기 전에는 **0원도 쓰지 않는다.**
🔴 flag 는 계속 OFF.
```

🔴🔴 **감사 결과 — 차액의 86% 가 설명되지 않는다**:
```
충전 ₩25,000 → 잔액 ₩3,300 → 소진 **₩21,700**
  🟢 우리 측정으로 설명  약 **₩3,000** (grounding ~132 쿼리 + 토큰 71,785)
  🔴 **UNACCOUNTED      약 ₩18,700 (약 86%)**
🔴 「토큰이 비싸서」로 닫지 않는다. 추정으로 메우지 않는다.
```

🟢 **호출 0 으로 배제한 가설들**(DB·소스 증거):
```
🔴 Vision 이 **같은 GEMINI_API_KEY·같은 별칭** 을 쓴다(vision-evidence.ts:28) — 사실이다
   🟢 그러나 **오늘 0건** · vision_checked_at 총 17행(마지막 10-08) · vision_observations 2행(09-20)
🟢 내 테스트가 Vision 을 돌렸다 → 배제(runDomesticPriceCheck 테스트 호출부 5곳 전부 vi.mock)
🟢 오늘 운영 가격확인이 Gemini 를 썼다 → 배제(run-price-check 에 Gemini 어휘 0)
🟢 리포 안 Gemini HTTP 호출부는 **2곳 전수** — discovery-core/google-discovery.ts · vision-evidence.ts
→ 🔴 **리포 안에서는 설명이 끝났다.** 남은 86% 는 리포 «밖» 이다(Billing · 별칭 · 실패호출 과금).
```

🔴🔴 **우리는 모델을 고정하지 않았다 — 구조적 위험**:
```
"gemini-flash-latest" 는 **별칭** 이다(google-discovery.ts:52 · vision-evidence.ts:28).
별칭은 Google 쪽에서 움직인다 → **코드가 안 바뀌어도 과금 구조가 바뀔 수 있다.**
🔴 그리고 응답의 `modelVersion` 을 우리 타입이 선언하지 않아 **버린다** →
   「Gemini 3 계열이냐 2.5 계열이냐」를 우리 데이터로 **답할 수 없다**(단가 구조가 다르다).
🔴 `cachedContentTokenCount` 도 집계에 없다(probe 1회에서 1,400 관측).
```

### 🟢🟢 확정된 방향 — **Search 와 Intelligence 를 분리한다**

> 🔴 「Gemini + Google Grounding 으로 웹 검색까지 전부 맡기는 구조」는 **현 비용
>  수준에서 Production 후보에서 제외** 한다(CPO). 우리 서비스의 핵심은 동일상품
>  후보를 찾는 것이고, 매 상품마다 비싼 AI 검색 agent 를 돌리는 것이 아니다.

```
① deterministic 매칭 (Gemini **0회**)
     SKU 동일 / 브랜드+brandModelCode 동일 / 상품명+색상+소재+카테고리 강일치
 ↓ 갈리지 않은 것만
② 기존 검색 경로로 후보 확보 (Gemini 0회) — 국내 등록부 검색 · Naver · 허용 provider
 ↓
③ 우리 crawler / resolver / 가격 추출 (Gemini 0회)
 ↓ 그래도 애매한 것만
④ **Gemini 1회 — 판정 보조만.** 검색을 맡기지 않는다
```
🟢 Gemini 는 **검색엔진이 아니라 최종 판정 보조자** 다 — MI 의 원래 방향과 일치한다.
🔴 실측이 이 구조를 지지한다 — Gemini 후보 중 국내 가격 증거가 된 것 **0/12** 인데
   같은 6상품에서 기존 국내 검색은 후보 **57개** 를 냈다.

🔴 **검색 경로 비교 결론**:
```
🟢 기존 Naver/국내 판매처 직접 검색 — Gemini 비용 0 · 운영 실적 있음 → **1차 검색기로 유지**
🔴 Google Custom Search JSON API — 신규 가입 닫힘 · 2027-01-01 종료 → 장기 해법 아님
🔴🔴 서버측 SERP 자동화(Playwright 등) — **무허가 자동 검색은 약관 충돌** ·
     차단 시 Discovery 가 통째로 죽는다 → **Google 대상 자동화 채택 금지**
     (헌장 메모 portal-scraping-blocked-by-terms 와 같은 원칙)
```

🔴 **CPO 결정 대기 4건**: ① AI Studio↔usage 1:1 대조로 UNACCOUNTED 규명(같은 Billing
Account 의 다른 서비스 · 별칭의 실제 모델) ② `modelVersion`/`cachedContentTokenCount`
보존(비용 0 · 승인 필요) ③ Search↔Intelligence 분리 설계 승인 ④ 상품당 Gemini
호출/쿼리 **상한을 코드에 박을 것인가**(현재 쿼리당 내부 검색 5.5회를 통제하지 못한다).

### 🟢 WU-011 **CLOSED** · Product Direction **CONFIRMED** (CPO 확정 2026-10-13)

```
MI-GEMINI-ACCURACY-LONG-SPRINT-011  →  **CLOSED**
Production                          →  🔴 **HOLD**
Next WU                             →  **MI-GEMINI-PRICE-EVIDENCE-012**
CEO Action                          →  **NONE**
```

🔴🔴 **HOLD 의 이유를 혼동하지 않는다** (CPO 명시):
> 「코드가 불안해서 HOLD 가 아니라, **사업적 효용이 아직 0 이기 때문에** HOLD 다.」
지금 켜도 등록 판단은 **0건 변화** 하고 Gemini 비용만 발생한다.

🔴🔴 **KPI 에서 영구히 합치지 않는 구분** (CPO 명시):
> 「**웹에서 동일상품을 찾는 능력**」 ↔ 「**그 후보가 국내 가격 판단에 쓸 수 있는
>  증거가 되는 능력**」 — 이 둘 사이의 «연결» 이 현재 병목이다.
🟢 Gemini 자체가 실패한 것이 아니다.

### 🔴 WU-012 `MI-GEMINI-PRICE-EVIDENCE-012` — 가격 추출 «순서» 가 지시다

CPO 가 선택지 셋 중 **ⓑ 공통 가격 추출 계층** 으로 확정했다(ⓐ 등록부 어댑터 = 사이트
계속 추가 구조로 회귀 · ⓒ 국내 가격 포기 = 판정 의미 파괴).

```
🔴 **공통 추출 → 기존 crawler 재사용 → 마지막에만 특정 adapter** 순서다.
   ① 기존 crawler 의 공통 가격 추출기
   ② JSON-LD `Product / Offer`
   ③ 페이지 구조화 데이터
   ④ 기존 crawler 가 이미 지원하는 가격 source
   ⑤ Shopify 는 기존 `enrichCandidatePrices` 유지
   ⑥ 특정 사이트군이 **반복적으로** 막히고 초기 카테고리 정확도를 **크게 제한할 때만**
      별도 adapter 검토
🔴 **사이트를 Registry 에 계속 추가하는 방식은 금지.**
```

🔴 **영구 고정할 안전장치**(regression 으로 잠근다 — 이미 테스트 있음):
```
Gemini transient domestic evidence 는 항상
  marketCode = null · currency = KRW · sourceProductUrl = discoveredUrl
🔴 **KRW 가 아니면 국내 가격 증거로 승격하지 않는다.**
🔴 잘못된 marketCode(en-kr)가 들어가면 기존 50,000 이 Gemini 47,000 으로 «교체» 된다
   — 그 재현 테스트를 지우지 않는다.
```

🔴 **WU-012 의 성공 기준** — 「가격이 하나 잡혔다」는 성공이 아니다:
```
SAME + 유효 KRW 국내 가격 + 기존 aggregation 정상
  = 기존 MI 가 **domestic EXACT 판단 가능**
여기까지 가야 사업적 가치로 인정한다(CPO).
KPI 네 축: A Identity · B Price Evidence · C Domestic Validation · D Registration Decision
```

🔴 **입력 scope 를 먼저 깨끗하게** (CPO 명시 — 표본 오염의 교훈):
```
Product Scope → Category validity → Gemini Discovery
🔴 category validity 가 실패하면 Gemini 가 아무리 정확해도 의미가 없다.
🔴 다음 E2E 부터 **입력 fixture/query 자체를 고정** 한다.
```

🟢 비용 KPI 는 **측정 구조 PASS / 실제 원화 단가 미확정** 으로 닫았다 —
🔴 실제 KRW 차감액을 **CTO 가 계산해 확정하지 않는다**(AI Studio 가 ground truth).
🔴 한도 ₩7,607 · 추가 충전 없음 유지.

### 🔴🔴 WU-011 측정 결과 — 유효 국내 EXACT 는 여전히 0 이고, 이유가 하나로 좁혀졌다

🟢 전문은 `docs/MI-GEMINI-CPO-SECOND-REPORT-011.md` **하나** 다. 🔴 CEO 액션 없음.

```
🟢 사슬은 끝까지 배선됐다 — Discovery → self-ref → 가격보강 → 국내집계 → MI 판정
🔴🔴 **유효 국내 EXACT = 0** (sample 상품 N=6 · 상품당 쿼리 1)
     이유가 하나다 — **가격이 붙지 않는다.** KRW 가격 증거 **0/12**
     tier EXACT 2 중 하나는 가격 미확보(tinyapple.net) · 하나는 **EUR**(bobochoses.com)
🟢 identity 는 작동한다 — SAME 2 · PRESUMED_SAME 4 · DROPPED 4(EVIDENCE_NOT_WORTHWHILE)
🟢 안전성 확인 — **기존 국내 증거가 줄어든 상품 0** (Gemini 가 덮어쓰지 않는다)
🟢🟢 **grounding 비용이 처음 측정됐다 — 호출당 5.5 쿼리**(44/8).
     🔴 「측정 불가」라던 이전 보고는 **틀렸다**(usageMetadata 가 아니라
        candidates[].groundingMetadata.webSearchQueries 다). 코드에 배선했다.
🔴 BLOCKER 하나 — `enrichCandidatePrices` 는 **Shopify 전용** 이고 국내 후보 host
   대부분이 handle 을 못 준다. 이것을 푸는 셋은 **전부 CPO 정책 결정** 이다(보고서 §9-①).
🔴 Production **HOLD** — 켜도 판정이 안 바뀌고 비용만 발생한다.
```

🔴🔴 **표본 오염을 내가 찾아 고쳤다 — 숫자를 읽을 때 전제다**:
```
덤프가 `brand NOT ILIKE '%sergio%'` 로 넓혀 **비-아동 상품** 이 KIDS scope 에 들어왔다
 — 일본 라쿠텐 2건, 그중 하나는 **골프 드라이버**. Gemini 호출 2회를 먹었고
   `store.shopping.yahoo.co.jp`(일본)가 **COMPARISON tier** 를 받았다.
🟢 KRW 가 없어 집계에는 안 들어갔다 — 가격 게이트가 막았다.
🟢 덤프 조건 수정 + 그 2건을 **측정에서 제외해 재집계**(추가 Gemini 호출 0).
```

🔴 **예산이 조건을 바꿨다** — CPO 한도 ₩7,607 · 추가 충전 없음. 호출당 약 ₩670~870
추정이라 한도가 9~11 호출분이었고, 그래서 **상품당 쿼리를 2→1 로 줄였다.**
🔴 WU-4 는 쿼리 2 였으므로 **Discovery 계열 KPI 를 1:1 로 비교하지 않는다.**

### 🟢 008A CLOSED — 자기참조 «목록 세그먼트» 가 닫혔다 (CPO 확정 2026-10-13)

```
🟢 canonicalListingKey 에 목록 세그먼트 제거 1줄 — /collections/<c>/products/X 와
   /products/X 는 **같은 listing** 이다(WU-4 에서 EXACT 를 받았던 누출).
   🔴 lookahead 로 `products/` 가 뒤따를 때만 뗀다 → /collections/aaa 같은 목록
      URL 이 뭉개지지 않는다(collision 금지). 쿼리 로직은 **무변경**.
🟢🟢 **로케일은 자기참조가 «아니다» — 확정된 제품 정책이다.**
   /en-kr/products/X ↔ /products/X → **다른 시장** → 자기참조 아님.
   근거 우선순위: mi-real-05-self-reference.test.ts:153 의 「경로가 다르면
   (시장 전환 포함) 제외하지 않는다」가 **제품 정책을 직접 말하는 계약** 이고,
   toCrawlerUrl 의 「로케일 제거」 주석은 **정규화 구현의 성격** 일 뿐이다.
   🔴 주석을 근거로 그 계약을 뒤집지 않는다. 🔴 로케일 섞인 쌍을 **「누출」로
      다시 세지 않는다**(CPO 명시).
🔴 tennis-warehouse 2건은 **URL 구조 미확정** — 추측하지 않는다. 결함으로 세지 않는다.
🟢 회귀 crawler 852 passed(baseline 833 + 신규 19) · admin 7,553(7,534 + 19) ·
   typecheck 10 = baseline · guard 6/6 · build exit 0 · 음성대조 **양방향**
   (collections 제거를 되돌리면 4 FAIL · lookahead 를 지우면 2 FAIL)
```

### 🔴 MI-GEMINI-005 상태 — **IMPLEMENTED / ON-AXIS UNMEASURED** (CPO 확정)

```
WU-1 Core extraction   🟢   Build       🟢 exit 0 · static 104/104
WU-2 Gemini 배선       🟢   Regression  🟢 506 files / 7,534 tests · failed 0
Validation-close       🟢   Typecheck   🟢 10 = baseline
국내 CONTROL           🟢 **2/3 재현** (분모 3 · 실패 1건은 «과거 행» 으로 규명됐다)
Gemini ON 축           🔴 **미측정** — 402 prepayment credits depleted (16/16)
Push                   🟢 브랜치   Production Deploy 🔴 보류   CEO 테스트 🔴 없음
```

### 🟢🟢 WU-4 종합 판정 — **종결됐다** (CPO 확정 2026-10-13)

🔴 **5항은 전부 답이 나왔다. 다시 열지 않는다.**

```
① 유효 국내 Discovery   **DISCOVERY PASS / BUSINESS VALUE 미확정**
② SAME/PRESUMED 품질    **탐색 가능성 PASS / 실전 정밀도 HOLD**
③ Registration 0        **설계상 PASS** — 결함으로 «수정하지 않는다»
④ Grounding/KRW 비용    **COST HOLD** — CPO 의 AI Studio 판독 대기
⑤ 연결 지점             🟢 **확정** — 아래 구조로 고정
전체                    **IMPLEMENTED / VALIDATION PARTIAL / PRODUCTION HOLD**
```

### 🔴🔴 KPI 에서 «절대» 섞지 않는 구분 둘 (CPO 명시)

```
❌ 「Gemini 가 국내 후보 URL 을 찾아올 수 있다」
     ≠
✅ 「Gemini 가 등록 판단에 유효한 «국내 동일상품» 을 추가로 찾아준다」
   🟢 증명된 것은 앞의 것까지다. 🔴 유효 국내 EXACT = **0**.

❌ 「SAME 4 = 유효 동일상품 4건」
   🔴 그 4건에 자기참조(junioredition)·해외 공식몰(bobochoses, Registry 비활성)이
      포함돼 있다. **유효 국내 EXACT 로 인정하지 않는다**(확정).
🔴 그리고 008A 로 닫힌 `/collections/` 문제와 정책상 허용되는 `/en-kr/` 시장 전환을
   **이후 KPI 에서 다시 섞지 않는다.**
```

### 🟢🟢 확정된 제품 방향 — 이 문장을 그대로 쓴다

> **Gemini 는 「새로운 사이트를 계속 등록하는 시스템」이 아니라, 상품 등록
> «순간» 에 웹 전체에서 동일/유사 후보를 발견해 기존 MI 의 판단 근거를 확장하는
> Discovery Layer 다.**

```
상품 등록 요청 → 기존 국내 탐색 + Gemini Web Discovery → 임시 Candidate Pool
→ 기존 MI 판정 → **등록 판단용 transient evidence** → 기존 등록 판단
→ 등록 / 검토 / 차단
```

🔴 **금지 6항**(CPO 확정):
```
❌ 외부 URL 영구 저장            ❌ domestic_product_links 강제 저장
❌ 가격 추적                      ❌ Gemini 때문에 Registry 사이트 계속 추가
❌ threshold 완화                 ❌ Gemini `SAME` 하나만으로 자동 STOP
🔴 마지막 항이 중요하다 — 유효 국내 EXACT 가 **0** 인 상태에서 Gemini 결과만으로
   자동 STOP 을 걸면 오판 위험이 있다.
```

### 🔴🔴 다음 순서 — **코드가 아니다**

```
① CPO 가 AI Studio 에서 실제 KRW 차감액 + Grounding request 수 판독 → 비용 KPI 확정
     실행창(UTC) 1차 02:13:00~02:23:00 · 2차 02:23:27~02:36:08 · 전 잔액 25,000원
     🔴 API 호출 1회 = Grounding query **6회** 가 관측됐다(sample N=1) —
        **호출 수만으로 비용을 계산하지 않는다.**
② 비용이 정상이면 → **Gemini 후보의 transient MI 결과를 실제 등록 판단에 연결하는
   구현 WU**. 🔴 영구 저장·가격추적은 그 WU 에서도 건드리지 않는다.
🔴 CEO 테스트 없음 · Production deploy 없음 · CTO 선제 코드 변경 없음.
```

🔴 **그리고 아래 ON 축 재측정은 코드 변경 0 을 원칙으로 한다.**
```
Gemini 선불 크레딧 확보(🔴 **CEO 비용 승인** — 이 트랙 최초의 진짜 사업 결정)
      ↓ 새 기능 0 · 기존 하니스 재실행만
mi-gemini-005-e2e.test.ts  (MI_P0_02_LIVE=1 · scripts/.env)
      ↓ ON 축 실측
CPO Production Deploy 판정  →  CEO 실상품 테스트
```
🔴 크레딧 전에는 **추가 WU 를 만들지 않는다**(CPO 확정). 모델을 바꿔 성공률을
   만들지 않는다 — grounding 은 `flash-lite` 에서도 402 다.

🔴 아직 모르는 것(0% 로 적지 않는다): Gemini Recall · 후보가 MI 판정을 얼마나
   늘리는가 · 상품당 실제 Gemini 비용 · grounding 비용.
### 🟢🟢 WU-019R `MI-GLOBAL-E2E-TRACE` — **공통 연결 둘이 빠졌다** (조사 WU · 구현 0)

🟢 전문 `docs/MI-GLOBAL-E2E-TRACE-019R.md`. 🔴 **운영 코드 변경 0 · Gemini 0 · HTTP 0.**
🔴🔴 **방향이 바뀌었다**(CPO 2026-10-13) — 목표는 「Gemini 를 켜는 것」이 아니라
**초기 2개 카테고리에서 파이프라인이 어디까지 완성됐는지 닫는 것** 이다.

| 단계 | KIDS | TENNIS |
|---|---|---|
| Identity | 🟢 | 🟡 (category 0/9 · brandModelCode 0/9) |
| Gemini Discovery | 🟡 (구조 ○ · flag OFF) | 🟡 |
| 국내 Candidate | 🟢 | 🔴 (scope 샵 1곳) |
| 해외 Candidate | 🟢 | 🟢 |
| **MI Verification** | 🟢 | 🟢 |
| 국내 Price Evidence | 🟡 | ⚪ 분모 0 |
| 해외 Price Evidence | 🟡 Shopify 만 | 🔴 |
| Aggregation / Final MI | 🟡 국내 KRW 만 | 🔴 |
| Registration | 🟢 **설계상 분리**(P-32) | 🟢 |

🟢🟢 **Gemini↔MI 연결은 정상이다** — 같은 루프(`run-domestic-price-check.ts:938`)·
같은 `judgeDomesticCandidate(:1009)` 이고 **Gemini 전용 판정 규칙이 0** 이다
(분기는 둘뿐 — `:934` 확인기록 skip · `:1067` 저장 차단).
🟢 **MI 는 후보의 시장을 보지 않으므로 해외 후보도 그대로 판정된다**(실측
tennis-warehouse · yahoo.co.jp **PRESUMED_SAME**).

🔴🔴 **빠진 «공통» 연결은 둘이고 둘 다 CPO 결정이다 — 구현 0**:
```
① 후보 가격 추출 «배선»
   🟢 추출기는 **이미 있고 운영에서 돈다** — universalExtract(:176) →
      extractProductData(:858)의 JSON-LD offers.price/priceCurrency(:195-210).
      운영 호출부 pipeline/route.ts:151 → :280-283(원상품 경로).
   🔴 그런데 후보 경로는 그걸 안 부른다 — factsFromProductUrl 이 price 를
      **의도적으로 null** 로 두고(:187·:236) enrich 는 `extractShopifyHandle`(:264)이
      null 이면 포기한다. 실측 **11 도메인 중 가격 획득 1건**(bobochoses · Shopify · EUR).
   🔴 비용 축: fast-path 전략이 **shopify·prestashop 둘뿐** → 그 외는 **Playwright** 다.
      🟢 대안 — PLAIN_HTML 경로가 **이미 HTML 을 받아 온다**(:199-246). JSON-LD 는
         순수 함수라 **HTTP 추가 0** 으로 읽을 수 있다. 🔴 어느 쪽인지는 CPO 결정.
② 해외 가격을 담는 «축»
   PRICE_OBSERVATION_SOURCES = SELLER_ORIGIN · NAVER_SHOPPING · DOMESTIC_SHOP
   (price-history.ts:21) — 🔴 「해외 **경쟁** 판매처 가격」 값이 **없다.**
   🟢 schema 변경 **불필요** (source 는 text · CHECK/트리거 0).
   🔴 필요한 것은 **읽는 쪽** 이다 — 리포의 기존 테스트
      `overseas-observation-storage-impact.test.ts`(GOLF-01.6 축 B)가 고정해 뒀다:
        ② 새 source 로 **저장만** 하면 🟢 **한 원도 안 움직인다**(읽기 4곳이 전부 source 필터)
        ③ `SELLER_ORIGIN` 에 얹으면 🔴 **원가가 오염된다** — 금지
```

🔴🔴 **§6 의 「Source Market」 칸은 제품에 «없다»** — `ComparisonCandidate` 에
market/country/locale 칸이 **0건**(types.ts grep). 그래서 국내/해외 분리는 **CTO 의
사후 추정**(TLD·등록부·통화)이고 **UNKNOWN 6 도메인 / 후보 7** 을 KR 로도 해외로도
세지 않았다.
🔴🔴 **그리고 분류 충돌 하나가 실제 위험을 보여줬다** — `bobochoses.com` 은 국내
등록부에 **「Bobo Choses Korea(공식)」· AUTO_API · KIDS_FASHION** 으로 등록돼 있는데
그 후보의 가격 증거는 **EUR** 였다. 🟢 국내 KRW 축으로 못 들어가게 막은 것은
**통화 게이트 하나**(`priceKrw == null` drop :185 · `currency:"KRW"` 고정 :195) 다.
→ 🔴 **「등록부에 있다」가 「국내 시장이다」를 뜻하지 않는다.**

🔴 **가격 없는 Gemini 후보는 화면에 존재하지 않는다** — `geminiEvidence`(:872)·
`geminiPricedCount`(:875)를 **소비하는 코드가 0** 이다(apps/admin 전수 grep).
「identity evidence 로 남는다」로 적지 않는다.

🟢 **Identity confidence 는 «칸이 없어서» 측정 불가** — `ProductFacts` 에 confidence 가
없고 DNA 의 `brand.confident`(boolean) 하나만 있으며 facts 로 옮겨지지 않는다.

🟢 **TENNIS 는 CASE C 다** — 국내 source 부재이고 **공통 MI 문제로 확대하지 않는다.**
🔴 §14 일곱 질문: 1🟢 2🟢 3🟢 4🟡(Shopify 만) 5🟡(해외 🔴) 6🟡 7🔴 **NO**.
🔴 즉 **여성의류 등 다음 카테고리로 넘어가지 않는다**(CPO 지시).
🔴🔴 **단 그 이유를 「Registry/카테고리 인프라를 더 만들어야 해서」로 읽지 않는다** —
위 §12-0 정정대로 **카테고리는 개발 대상이 아니라 테스트 대상** 이다. 넘어가지 않는
이유는 **Phase A 다섯 항목이 아직 안 닫혔기 때문** 이다.

### 🟢🟢 WU-021 `MI-FINAL-DECISION-TRACE` — **공통 사슬은 끝까지 돈다 (26/26)**

🟢 전문 `docs/MI-FINAL-DECISION-TRACE-021.md`. 🔴 **운영 코드 변경 0 · Gemini 0 ·
외부 HTTP 0 · DB 읽기만 · schema 0 · UI 0 · flag OFF · deploy 0.**

| | KIDS (N=17) | TENNIS (N=9) |
|---|---|---|
| 원가 확보 | 13/17 | **9/9** |
| tier EXACT 레코드 | **2** | **0** |
| `sellerCount>0` | **3** | **0** |
| sellability | GREEN 2 · YELLOW 11 · UNKNOWN 4 | YELLOW 9 |
| representative | READY 2 · MARKET_OPPORTUNITY 11 · NEEDS_INFO 4 | MARKET_OPPORTUNITY 9 |
| **최종 sellerFacing** | 🟢 RECOMMENDED **2** · 🟡 CONDITIONAL 15 | 🟡 CONDITIONAL **9** |

🟢 **26/26 전건이 최종 판정까지 도달한다** — 사슬이 끊기지 않고, 두 카테고리가 **같은
함수를 같은 순서로** 통과한다(카테고리 분기 0). 호출부는 운영 `market-intelligence.ts`
의 `:128 → :303 → :136-146 → :663 → :675 → :698` 과 1:1 이다(복제식 아님).

🟢🟢 **정직성 PASS — 데이터가 없을 때 「추천」이 뜨지 않는다.** TENNIS 9/9(국내 후보 0 ·
가격 0)가 🟡 **CONDITIONAL** 이고 🟢 RECOMMENDED 는 **0** 이다. 문구도 「국내에 없다」가
아니라 **「자동으로 찾지 못했습니다」** 다(sellability.ts:58 · representative :245).
🟢 설계 주석이 그 이유를 적어 뒀다(:26-28 — 「『국내에 없어서 기회』와 『수요가 없어서』를
시스템이 구분할 수 없다는 점은 문구에서 단정하지 않는다」).

🔴 **주석 하나가 낡았다(코드는 고치지 않았다)** — `representative-seller-decision.ts:260`
머리 주석은 「MARKET_OPPORTUNITY → 🟢 판매 추천」이라고 적혀 있지만 **실제 map 은
`MARKET_OPPORTUNITY: "CONDITIONAL"`** 이고 실측이 map 과 일치한다. 🔴 **주석을 근거로
판정을 설명하면 틀린 답이 나온다**(`:147` 주석은 맞다).

🔴🔴 **CONTROL 을 세울 수 없다 — 그래서 「운영 재현」으로 적지 않는다**:
```
운영 최종 verdict 가 **DB 에 저장되지 않는다** — product_snapshots 칸 12개에 판정 칸이
**없고**(id·source_url·title·thumbnail_url·status·workspace·created_at·updated_at·
last_opened_at·job_key·workspace_id·product_id) price_alerts 는 이 표본에 **0행** 이다.
🟢 증명된 것: 「사슬이 끝까지 도는가 + 무엇을 내는가」
🔴 증명 안 된 것: 「운영이 지금 그 값을 낸다」
🟢 단 **입력은 운영 실데이터** 다 — 관측 **75행**(SELLER_ORIGIN 59 · DOMESTIC_SHOP 16) ·
   링크 5행. 🔴 그리고 사슬 한 구간을 **의도적으로 비웠다** — marketCase/landedCost 는
   `fetchLiveExchangeRates()`(:436)가 필요해 HTTP 0 에서 만들 수 없다. 지어내지 않고
   `null` 로 넘겼고, 그래서 ⑦⑧은 **「marketCase 없이」 조건의 값** 이다.
```

🟢 **등록 판정은 설계대로 분리** — `computeRegistrationReadiness`(:109)가 sellVerdict 를
**인자로 받지 않는다**(P-32 불변식 :15-20). 🔴 「등록 판정이 안 된다」가 아니라
**「판매 판정과 독립이다」** 가 맞는 표현이다. ⚪ 입력이 채널 상태라 이 하니스로 미측정.

🔴 **병목은 그대로다** — KIDS 17 중 EXACT 레코드 **2** · TENNIS **0**. 헌장의 핵심 KPI
(55/498 = 11.0%)와 같은 방향이고, **사슬이 아니라 «입구»** 라는 결론이 또 재현됐다.
🔴 이 표본으로 11.0% 를 다시 계산하지 않았다(분모가 다르다).

🔴 **DB 칸 이름을 또 추측했다가 걸렸다** — `domestic_product_links` 에 `domain`·
`shop_name`·`price_krw`·`sold_out` 이 **없다**(선행 덤프의 그 칸들은 source 조인 산출).
🟢 `information_schema` 로 읽어 고쳤다. 🔴 이 트랙 **아홉 번째** 같은 실수다.

🟢 회귀 admin **514 files / 7,663 passed · failed 0** · typecheck **10=baseline** ·
build exit 0 · guard 6/6. 🔴 typecheck 가 한때 **14** 로 올랐다(내 하니스의 `never` 추론
4건) — baseline 과 **비교해서** 잡았다.

### 🟢🟢 WU-020 `MI-CANDIDATE-PRICE-EVIDENCE` — **CLOSED / PARTIAL** (CPO 2026-10-13)

🔴🔴 **결과를 적는 «정확한 표현» 이 CPO 가 확정해 줬다. 다른 말로 바꾸지 않는다**:
```
공통 후보 가격 배선과 국내/해외 시장 분리 규칙은 **구현·검증 완료**.
JSON-LD 기반 후보는 **추가 HTTP 없이** 가격 증거를 연결할 수 있다.
TENNIS 해외처럼 **microdata-only 사이트의 가격은 현재 미지원.**
```
🔴 **「해외 가격이 완전히 해결됐다」로 기록하지 않는다.**
🔴 TENNIS 해외 microdata → **제한사항으로 기록하고 종료.** 새 순수 parser 는 가능하고
   비용도 거의 없지만 **공통 파이프라인을 닫는 데 반드시 필요하지 않다** — 거기서
   extractor 범위를 늘리면 WU 가 끝없이 확장된다(CPO 명시).
🔴 **해외 축의 UI 노출·등록판정 반영도 지금 하지 않는다**(⏸️ 의도적 보류).
   현재 목표는 가격 추적 서비스가 아니라 **공통 구조를 닫는 것** 이다.

🟢 전문 `docs/MI-CANDIDATE-PRICE-EVIDENCE-020.md`. 🔴 **Gemini 0 · 추가 HTTP 0 ·
Playwright 0 · schema 0 · 새 source 값 0 · DB 쓰기 0 · UI 0 · flag OFF · deploy 0.**

```
① 후보 가격      🟢 **이미 받은 HTML 의 JSON-LD 로 닫았다**
   htmlPath 가 `priceFromJsonLd(html)` 을 부른다 → candidate.price/priceStatus
   🟢 `extractFromJsonLd`(product-data-extractor.ts:175)는 **순수 함수** 이고 운영
      원상품 경로가 이미 쓴다 → **새 추출기 0** · fetch 호출 **1회 그대로**
   🟢 측정(캡처 fixture 20건 · HTTP 0): 가격 획득 **12** · KRW 4 · EUR 8
      🔴 분모는 fixture 다 — 「Gemini 후보 가격 획득률」로 쓰지 않는다
② 해외 축        🟢 **닫았다** — classifyCandidateMarket + summarizeCandidateOverseasPrices
   (candidate-market.ts · 둘 다 순수) · 국내 축 진입에 **market === "KR"** 추가
   🟢 통화별로만 집계하고 **환산하지 않는다**(합계 금액 칸이 아예 없다)
   🔴 `SELLER_ORIGIN` 에 얹지 않았다 — M2 가 그것을 FAIL 로 잠근다
```

🔴🔴 **시장 분류의 뼈대 — 증거가 «일치» 할 때만 단정한다**:
```
                 KRW            외화              통화 없음
.kr TLD          🟢 KR          🔴 UNKNOWN(충돌)   🔴 UNKNOWN
등록부 샵         🟢 KR          🔴 UNKNOWN(충돌)   🔴 UNKNOWN
증거 없음         🔴 UNKNOWN     🟢 OVERSEAS        🔴 UNKNOWN
🔴 **등록부 소속은 「시장 증거」가 아니다** — bobochoses.com(등록부 공식샵)의 가격이
   EUR 였던 019R 실측이 그것을 반증했다. 등록부는 **충돌 감지에만** 쓴다.
🔴 **통화 단독 결정 금지** — KRW 인데 도메인 증거가 없으면 UNKNOWN(예: tinyapple.net).
```

🟢 **§8 다섯 케이스를 «실제 집계기» 로 금액 단언** 했다 — 국내 KRW 는 합쳐지고
(최저 198,000 → 150,000), 해외 EUR·Bobo(EUR 충돌)는 국내 숫자를 **한 원도** 안 움직인다.

🔴 **남은 것 하나 — TENNIS 해외 가격 0 이고 원인이 규명됐다**:
```
tennis-warehouse: `application/ld+json` **0개** · og:price **0개**
🟢 가격은 **microdata** 에 있다(`itemprop="price" 120.00` · priceCurrency US…)
🔴 그런데 기존 `extractFromMicrodata(page: Page)`(:476)는 **Playwright 의존** 이라
   §1(Playwright 0)과 충돌한다 → **새 파서를 만들지 않았다.**
🟢 다음 레버: microdata 를 **순수 함수로** 읽는 작은 파서(추가 HTTP 0) — CPO 승인 사안.
```

🔴 **해외 축은 판매 판정에 «의도적으로» 들어가지 않는다** — 그것이 오염 방지의 구현이다.
MI 반환까지 와 있고(`candidateOverseasPrice`·`candidateOverseasEvidence`) 🔴 UI 소비자는
**0** 이다(§11 이 UI 변경을 금지했다). 노출 여부는 CPO 결정.

🔴🔴 **M3 가 처음에 통과했다 — 또 엉뚱한 구간을 단언했다.** slice 를 push «부터»
잡았는데 변이는 그 **앞** 에 `continue` 를 넣었다. 🟢 분기 «진입»~push 사이에 조기
이탈이 없음을 단언하도록 고쳐 M3·M3b 가 FAIL 로 바뀌었다. 🔴 WU-018 과 같은 계열이다.

🟢 회귀 admin **514 files / 7,663 passed · failed 0** · typecheck **10=baseline** ·
build exit 0 · guard 6/6 · mutation M1~M6(+M3b) 전부 FAIL · 원상복구 46 passed.

### 🔴 [종료된 기록 · 착수점이 아니다] WU-018 시점의 판단 (2026-10-13)

🔴🔴 **이 절의 제목은 원래 「현재 착수점」이었다 — 착수점이 «둘» 이 되어 강등했다**
(CPO §12 갱신 GO · 2026-10-17). 🟢 현재 상태는 **§12 맨 앞의 착수점 절 하나** 다.
🔴 아래 「CTO 가 선제적으로 WU 를 만들지 않는다」 같은 **원칙** 은 여전히 유효하고,
   「다음은 코드가 아니다」 같은 **그때의 상태 판단** 은 **낡았다**(WU-024~056 이 그 뒤에 있다).

```
🟢 WU-016 · 017 · 018 **전부 CLOSED / PASS.** 🔴🔴 그리고 CPO 가 명시했다 —
   **「다음 WU 를 바로 코드 작업으로 이어가지 않는다.」**
🔴🔴 **무호출·무료 상태에서 확인할 수 있는 비용 레버는 사실상 소진됐다.**
   (공짜 게이트 셋 합계 차단률 **3.8%** — WU-018 실측)
🔴 현재 브랜치 구현은 **보존** 하고 Production 활성화는 **계속 HOLD** 다.
🟢 **CEO 에게 요청할 사항도 없다.** CTO 가 선제적으로 다음 WU 를 만들지 않는다.

HOLD 사유 넷 (CPO 명시 — 이 넷이 풀리기 전에는 코드가 답이 아니다)
  ① Gemini 실제 비용이 아직 비싸다
  ② 유효 domestic EXACT 의 **사업적 증분효과가 미입증** 이다
  ③ 당일 가드의 **운영 전수 효과** 관측 데이터가 아직 없다
     🟢 단 관측 «가능성» 은 확보됐다 — `[MI-016-gate]` 로그가 flag ON 시 분모를 만든다
  ④ 남은 선택지는 **전부 제품 정책 변경** 이다(⒜~⒟ · WU-018 절)
```

🔴 아래 ⓐ/ⓑ 는 **그 정책 판단이 열릴 때의 입력** 이다 — 지금의 착수점이 아니다.

```
🔴🔴 **ⓐ Gemini 선불 크레딧 충전 — CEO 비용 승인.** 이 트랙 WU 열아홉 개 중
     **처음 발생한 진짜 사업적 결정** 이다. CTO·CPO 가 임의로 결정할 수 없다.
     충전 전에는 flag 를 켜도 **항상 402** 다(실측 16/16).
     🟢 그래도 안전하다 — 402 상태에서 국내 경로가 불변임을 N=8 로 실측했다.
🔴 그 전까지 **CTO 는 코드를 만지지 않는다**(CPO 확정). 추가 WU 없음.
🔴 ⓑ flag 를 Production 에서 켤 것인가 — ON 축 실측 **뒤** 에 판단한다.
   (참고 실측 · sample 성공호출 N=2: 상품당 Gemini 1.6회 · 1,372토큰 · fetch 3.0회)
🔴 497개 기준 비용 환산은 **하지 않는다**(CPO 폐기 지시).
```

```
🔴🔴 **2026-10-13 정정 ②** — 코드는 `origin/mi-gemini-005` 에 **밀려 있고**
     `origin/main` 은 **안 받았다**(위 절). 배포는 머지 한 줄이고 **CPO 판정 대기** 다.
🔴🔴 **2026-10-13 정정 ① — 「배포할 것이 없다」는 더 이상 사실이 아니다.**
     MI-GEMINI-005 가 **운영 파일 2개 + crawler 16파일**을 바꿨다(위 미push 절).
     🟢 단 **기능 변화는 0** 이다 — flag `MI_GEMINI_DISCOVERY_ENABLED` 기본 OFF.
     🔴 그래서 배포 판단이 **열려 있다**: 「OFF 상태로 미리 배포할 것인가」는
        CEO 판단이고 CTO 가 임의로 밀지 않는다.
     🔴🔴 그리고 flag 를 **켜도 지금은 항상 `API_FAILURE` 다** — Gemini 선불
        크레딧이 소진됐다(402 · 실측 10/10). 🟢 그 상태가 안전하다는 것은
        실측했다(OFF 후보 35 → ON 후보 **35**, 완전 동일).
     MVP 흐름 자체는 **이미 Production 에 떠 있다.**
     실측(read-only GET): ttaejyo.vercel.app **200** · /pipeline 307 · /today 307 ·
     /api/price-history/check 401  → 🟢 307/401 은 **정상 보호** 다
     (🔴 「route 가 없다」로 읽지 않는다 — 메모 production-307-is-not-route-evidence)
🔴 그러므로 push 해도 기능이 바뀌지 않는다. 기능 변화 0 인 재배포를 CTO 가
   임의로 일으키지 않는다(헌장 §8). 🟢 **CEO 테스트는 지금 떠 있는 것으로 가능하다.**
🔴 조사 트랙은 **CLOSED** — WU 열일곱 개. 🔴 Production 변경 합계가 **0 이었다가
   MI-GEMINI-005 에서 처음 생겼다**(그 WU 는 조사가 아니라 구현 WU 다).
   더 조사해도 같은 결론만 반복된다(CPO 확정).
```

🟢 **CEO 테스트 재료는 준비돼 있다** — 전문은 `docs/MI-MVP-DEPLOY-READINESS.md` §5.
🔴 CTO 가 CEO 에게 직접 요청하지 않는다(§3). CPO 가 한 번에 전달한다.
```
URL    https://ttaejyo.vercel.app/today · /pipeline  (로그인 필요)
상품 A Louise Misha Astrid Jacket(Cream) — 후보 17 · SIMILAR 3/CONFLICT 3/UNKNOWN 11
상품 B Bobo Choses Boo Bo Choses T-shirt(B226AC002) — 후보 6 · SIMILAR 1/UNKNOWN 4/CONFLICT 1
🔴 기대 결과 — **「GO」가 나오지 않는 것이 정상이다.**
   🟢 보여야 할 것: 원본 통화(EUR) · 국내 후보 + 근거 문구 · 「동일상품 확인」 버튼 ·
      원가가 한국 표시가면 「환율 환산이 아닙니다」
   🔴 보이면 FAIL: 다른 상품(데님셔츠·쁘띠북·양말)이 동일상품으로 승격되어
      가격 비교에 들어가는 것 · 데이터 없는데 「추천/GO」가 뜨는 것
🔴 질문은 「SAME 이 나오는가」가 아니라 **「정보가 부족할 때 제품이 그것을
   정직하게 말하는가」** 다.
```

🔴 **그 11% 의 상한을 다시 적는다** — 「동일상품 확정 + 가격 비교」까지 가는 상품은
**55/498 = 11.0%** 이고, 상한은 **국내 샵이 해외 품번을 적는가** 이지 코드가 아니다.

---

### 과거 전략 질문 (참고 — 전부 답이 나왔다)

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
