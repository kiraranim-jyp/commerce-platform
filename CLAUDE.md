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

### STOP 조건 (이때만 멈춘다)

```
정책 결정 필요 · Architecture 경계 불명확 · DB schema 의미 불명확
외부 API 계약 불명확 · 보안/규제 위험 · Production destructive action 직전
CEO 의 사업적 승인 필요
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

### 🔴 「clean」은 「push 됐다」가 아니다

`git status` 는 커밋되지 않은 변경만 본다. 커밋만 해도 clean 이 된다.
실제로 이 규칙이 조용히 무력화돼 **커밋 15개가 밀려 있던 적이 있다**(2026-09-28).

```bash
git fetch origin --quiet                 # 로컬 ref 가 낡으면 숫자도 틀린다
git rev-list --count origin/main..HEAD   # ahead  — 0 이어야 한다
git rev-list --count HEAD..origin/main   # behind
```

종료 보고의 Git 절에는 clean 여부와 **ahead/behind 숫자를 같이** 적는다.
push 가 Production 배포를 부르므로, 밀린 커밋을 발견하면 임의로 밀지 말고
CEO 판단을 받는다. 밀 때는 커밋 메시지의 「테스트 통과」를 믿지 말고 **직접 실행**한다.
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
⑤ 필요한 데이터만 반환            ⑥ route 삭제
⑦ 재배포                         ⑧ 「삭제됐다」를 증명 (아래)
⑨ token 폐기                     ⑩ 환경변수 잔존 확인
```

🔴 **토큰은 스프린트 시작에 발급하지 않는다.** 실제 write 실측 «직전» 에 발급한다.

### 🔴 ⑧ — 401 로는 삭제를 증명할 수 없다 (2026-09-28 실측)

미들웨어가 `/api/*` 전체를 인증 앞단에서 막는다. **존재하지 않는 라우트도 401 이다.**

```
/api/coupang/zzz-not-a-route-9x8y7z   401   ← 존재하지 «않는» 것
/api/coupang/registered-product       401   ← 역시 존재하지 않는다(소스 확인)
```

즉 인증 없는 curl 로는 「삭제됨」과 「살아 있지만 보호됨」을 **구분할 수 없다.**
그래서 삭제 증명은 둘로 한다 — ⓐ 배포된 커밋에서 라우트 파일 부재를 확인하고,
ⓑ **토큰이 아직 유효한 동안** 호출해 404 를 받는다. 그 다음에 ⑨로 토큰을 폐기한다.
🔴 토큰을 먼저 버리면 ⑧이 영원히 401 이라 증명이 불가능해진다 — 순서가 규칙이다.

---

## 11. 외부 API 실측 순서

```
GET / read-only → baseline 확보 → 최소 변경 → PUT/POST
```

write 테스트 범위: 기존 데이터 **1건** · 영향 범위가 작은 필드 · 사전 baseline ·
실행 후 GET · 결과 대조 · rollback 가능성 확인.

---

## 12. 현재 스프린트 — COUPANG-UPDATE-WIRE-01

```
Coupang CREATE          Production 검증됨
Coupang GET             Production 실측 PASS
Coupang SAVED UPDATE    실행부 구현 완료 · PUT 미실행 · Not Production Verified
Coupang APPROVED UPDATE UNKNOWN / BLOCKED
DEBUG_COUPANG token     0건
```

착수점과 Phase 1~5 · 안전계약 · 실측 범위는 **`docs/COUPANG-UPDATE-WIRE-01-HANDOFF.md`**
하나에 있다. 새 세션은 그 문서부터 읽고 ①로 들어간다.

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
