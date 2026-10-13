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
| ⑤ | 실제 등록 UX | 🟡 **배선 PASS / Production 미확인** — WU-022 (아래) |

```
카테고리 확장        🔴 HOLD 가 «아니다» — Phase A 완료 후 **테스트만** 한다
Registry/사이트 관리  🔴 추가 작업 **금지**
가격 추적 / 외부 URL 영구관리  🔴 추가 작업 **금지**
Gemini               🔴 flag **OFF 유지**
```

🔴🔴 **⑤는 「CEO 에게 테스트를 요청할 단계가 아니다」**(CPO 명시) — `geminiEvidence` ·
해외 가격을 **소비하는 UI 코드가 0** 이라 먼저 **CTO 가 UI 배선** 을 해야 한다.
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

### 🔴🔴 현재 착수점 — **없다. 다음은 코드가 아니다** (CPO 확정 2026-10-13 · WU-018 종결)

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
