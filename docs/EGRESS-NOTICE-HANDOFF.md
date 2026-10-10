# EGRESS + 공통 고시정보 — 인수인계 (기준점 `ce877894`, 2026-10-10)

> 🔴 **새 세션은 이 문서 하나만 읽고 ②부터 들어간다.** 아래 「완료」 항목은
> 재조사·재구현 금지다. 조사를 다시 하면 토큰만 쓰고 결론은 같다.

---

## 0. 지금 상태 (한 눈)

```
Commit        ce877894
Migration     078_commerce_egress.sql   (작성됨 · 🔴 아직 «적용되지 않음» · NULL 폴백)
Test          7273/7273 PASS (485 files)
Type          admin·shared·content·category·marketplace 0 · listing 5 · crawler 2 (선재)
Build         PASS
Git           clean · ahead/behind 0  0
Egress        🟢 OCI 정상 (①~⑤ 전부 PASS)
실등록        🔴 STOP — 해제는 CPO 판정 사안
```

---

## 1. 역할과 운영 모델 (고정)

```
CTO (Claude)  조사 → 구현 → 테스트 → mutation → 전수 회귀 → typecheck/build
              → commit → push → deploy → 증거 수집 → 보고
CPO (사용자)   결과 검증 · 위험 판단 · 다음 단계 판정
CEO           배치가 «전부» 끝난 뒤 최종 실물 테스트 1회만
```

🔴 **중간에 CEO/CPO 확인을 요청하지 않는다.** 「이렇게 할까요?」「커밋해도 될까요?」
금지. 한 번 시작하면 가능한 범위까지 자율적으로 닫는다.

🔴 **STOP 조건은 이것뿐이다** — 정책 결정 · Architecture 경계 불명확 ·
DB schema 의미 불명확 · 보안/규제 위험 · Production destructive action 직전 ·
CEO 의 «사업» 승인 필요(채널/상품군 개폐, 과금).

🔴 **컨텍스트 부족은 STOP 사유가 된다.** 등록 경로를 지나가는 리팩터를 반쯤
하고 끊기면 등록이 깨진다. 그때는 안전한 단위까지만 닫고 착수점을 문서/메모리에
고정해 넘긴다 — 이번 세션이 ①까지만 닫은 이유다(CPO 승인됨).

---

## 2. 보고 방식

### 중간 보고 — 하지 않는다
이번 배치는 CPO 가 「최종에 한 번」을 명시했다.

### 최종 보고 — 13절 (CPO 지정 양식)

```
[CTO FINAL REPORT]
 1 Egress            migration 078 · OCI/FIXIE switch · health · history · rollback · security
 2 Stock             UNKNOWN 셀러 입력 · known stock 보존 · 999/0 fabrication 회귀
 3 Product/Model      원문 모델 보존 · 한국어 SEO 상품명
 4 SEO Tags          기존 보존 · AI 추가 · dedupe · 3채널 payload
 5 AI Description    생성 · 편집 · 지속 · 3채널 반영
 6 Detail Blocks     기본 블록 불변 · 추가 블록 텍스트/이미지 편집 · payload 반영
 7 Bulk Reference    필수 필드 · 제외 항목 · modelName 보호
 8 Origin            source · 직접입력 · 지속
 9 Common Notice     공통 의미 모델 · requiredness · 채널 adapter · unknown 처리
10 LotteON           category · notice · stock · tags
11 Tests             unit · integration · DOM/E2E · build · production
12 Deployment        commit · deployment · HTTP · git clean
13 Known limitations 🔴 «증거가 있는 것만»
```

### PASS 는 8등급으로 갈라 적는다 — 뭉치지 않는다

```
Code PASS       구현 완료
Test PASS       테스트 완료
Type PASS       tsc 완료
Build PASS      build 완료
Deploy PASS     Production 배포 완료
Production UI PASS    실제 Production 화면 확인 (CEO 몫)
Production API PASS   실제 외부 API 실행/응답 확인
Production PASS       위 전체 완료
```

🔴 **「테스트 PASS」를 「Production PASS」로 쓰지 않는다.** 실제 외부 호출 전에는
`Implemented / Not Production Verified` 다.

🔴 **증거 출처를 갈라 적는다.** 「CTO 가 로그로 확인」과 「CEO 가 화면으로 확인」을
뭉쳐 「제가 다 봤다」로 쓰지 않는다(이번 세션 ④⑤가 그 예다).

### 실패·미완은 먼저 적는다
숨기면 더 큰 비용이 된다. 이번 세션에서 내가 보고한 자기 과실:
하니스 결함 · 단일 측정 확대 해석 · 소스검사로 UI 닫기 · 분기 누락.

---

## 3. 🔴 토큰/컨텍스트 운용 — 이번 세션에서 실제로 효과가 있었던 것

긴 배치는 **컨텍스트가 먼저 바닥난다.** 작업 자체보다 이 운용이 완주를 가른다.

### 조사는 서브에이전트로 넘긴다 (가장 큰 절약)
전수 조사(파일 여러 개를 훑어 결론만 필요한 일)는 `Explore` 에이전트 4개를
**한 메시지에 병렬로** 띄웠다. 파일 덩어리가 내 컨텍스트에 들어오지 않고
결론만 돌아온다.

```
좋은 프롬프트: 「파일:줄번호 + 코드 인용으로 답하라 · 추측 금지 ·
              못 찾으면 「없음」 + 돌린 grep 을 적어라」
```

### 큰 파일을 통째로 읽지 않는다
`Read` 에 `offset`/`limit` 을 쓰고, 구조만 필요하면 `grep -n "^export function"` 로
목차만 본다. `PlatformPreview.tsx`·`CommerceWorkspace.tsx` 는 수천 줄이라
한 번 읽으면 그 세션을 반쯤 쓴다.

### 편집은 python 스크립트로, heredoc 은 피한다
🔴 bash heredoc 안에 python + 따옴표가 섞이면 깨진다(이번 세션에 2회).
스크립트를 **scratchpad 에 파일로 쓰고** 실행한다.

```
scratchpad = C:\Users\김성길\AppData\Local\Temp\claude\...\scratchpad
🔴 /tmp 쓰기는 Windows 에서 조용히 실패한다 — 쓰지 않는다
🔴 `cat > file` 를 입력 없이 쓰면 stdin 대기로 10분 멈춘다 (이번 세션에 1회)
```

### 측정 출력은 반드시 좁힌다
```
npx vitest run ... 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |× |FAIL" | head -20
```
전체 출력을 흘리면 한 번에 수천 토큰이 날아간다. `--json` 로그도 그냥 받으면
거대하다 — 반드시 `grep -iE` 로 자른다.

### 임시 하니스는 즉시 지운다
라이브 측정 파일은 `zz-live-*.test.ts` 로 만들고 **커밋 전에 `rm`** 한다.
측정 «결론» 만 영구 가드로 옮긴다.

### 백업은 basename 으로 하지 않는다
🔴 `naver/build-payload.ts` 와 `coupang/build-payload.ts` 를 `$(basename)` 로
백업해 **서로를 덮어쓴 사고**가 있었다. 경로를 포함한 이름을 쓴다.
🔴 커밋 안 된 파일에 `git checkout --` 를 쓰면 작업이 날아간다 — `cp` 백업만.

---

## 4. 완료 — 🔴 재조사·재구현 금지

### P5.6 후속 배치 (CPO 검증 전부 PASS)

| 항목 | 증거 수준 |
|---|---|
| ① 기본재고 UX | 마운트 DOM E2E + 음성 대조 |
| ② 상품명/모델명 | 실상품 라이브 + 3채널 payload 실측 |
| ③ 추가 블록 편집 | 마운트 DOM A~F 15/15 + 음성 대조 (CPO 종결) |
| ④ 원산지 공통화 | 마운트 DOM E2E |
| ⑤ 채널 옵션/재고 제거 | 마운트 DOM × 4조합(단품 포함) |
| ⑥ 고시 «의미» 공통화 | `notice/notice-category.ts` + 실상품 실측 |
| ⑦~⑫ 기존 기능 회귀 | 7273/7273 |

커밋 사슬: `cd9aa8b` → `088e912` → `ac1491a` → `368556d` → `ce877894`

### 확정된 규칙 — 다시 묻지 않는다

```
상품명   브랜드 + 원상품 핵심어 + 한국어 보정어
         "Sergio Tacchini Racchetto Polo 남성 셔츠"
         소재는 상품명에서 빼고 태그로만. 상품명 ≠ 모델명.
모델명   원상품명 그대로. AI 생성 금지.
         받는 출처 화이트리스트 = USER_EDITED · ORIGINAL · DETAIL_PAGE_REFERENCE
         (AI_GENERATED · DEFAULT · REQUIRED 는 거부)
재고     옵션 실측 → 판매자 기본값 → UNKNOWN. 999/0 생성 금지.
         빈 값 = 「지움」(undefined) · 0 = 「품절」 ← 다른 사실
상세설명 descriptionKo 단일 출처. 채널별 편집본 금지.
블록     기본 블록 불변. 추가 블록만 `override.added` 안에서 편집.
         🔴 `patches` 에 파생 블록용 칸을 열면 기본 블록이 바뀐다.
원산지   상품정보 한 곳. USER_EDITED 를 자동 수집이 덮지 않는다.
고시     의미는 `resolveNoticeCategory` 한 곳, 코드 변환은 각 builder.
```

### Egress ① (이번 세션)

```
078_commerce_egress.sql
  seller_settings.egress_provider  text NULL   (NULL = env 폴백 = 현재 동작)
  commerce_egress_log  — connect_result / outbound_result 를 «갈라» 기록
🔴 아직 적용되지 않았다. 적용해도 전부 NULL 이라 동작이 바뀌지 않는다.
```

---

## 5. 남은 일 — 착수 순서

### A. Egress ②~⑧ (P0)

```
② outbound-proxy.ts — async resolver 를 «추가»
   🔴 기존 동기 `resolveProxyUrl()` 을 지우지 않는다. 폴백으로 남긴다.
   우선순위: seller_settings.egress_provider → 없으면 env(OUTBOUND_PROXY)

③ 한 채널씩: SmartStore → 회귀 → Coupang → 회귀 → LotteON → 회귀
   (+ apps/admin/src/app/api/lotteon/_lib/request.ts)
   🔴 세 개를 한 번에 바꾸면 등록 경로 셋이 동시에 깨진다.

④ /api/settings/egress
   GET  currentProvider · availableProviders · health · lastCheck ·
        lastSuccess · lastFailure · lastError · recentHistory
        🔴 proxy URL·credential·Authorization 절대 반환 금지
   POST { provider: "OCI" | "FIXIE" }
        현재값 기억 → 임시 적용 → 실제 CONNECT → 실제 외부 HTTPS
        → 성공이면 DB commit / 실패면 «기존 provider 유지» + 실패 log + 오류
        🔴 DB 쓰기 성공을 「정상」으로 쓰지 않는다.

⑤ 설정 → 커머스 설정 관리 UI
   현재 provider · provider별 상태 · 마지막 확인 · 연결 테스트 · 전환 · 이력
   🟢 정상 / 🟡 CONNECT 는 됐으나 outbound 실패 / 🔴 CONNECT 실패
   ⏳ 연결 확인 중 / 🔴 전환 실패 — 기존 방식 유지
   🔴 Proxy URL 표시 금지

⑥ health 3단계 — TCP → Proxy CONNECT → External HTTPS
   🔴 `8888 OPEN + CONNECT hang` 을 정상으로 판정하면 안 된다(이번 장애 양상)
   🔴 무자격 직접 테스트의 `407` 은 「응답 계층이 살아 있다」는 신호다 — 왜곡 금지

⑦ 자동 failover 구현 금지 (수동 전환만)
⑧ Commerce payload/등록 로직 무변경 — 가드 + snapshot 비교로 고정
```

### B. 공통 고시정보 (P1 · 미착수)

기반은 있다 — `packages/listing/src/notice/notice-category.ts` 가 **의미**를
판정하고(`KIDS_APPAREL`/`APPAREL`/`UNKNOWN`) 채널 builder 가 코드로 변환한다.

남은 것: **항목 정의 + 필수여부(required) 공통 관리**.

```
조사 → 세 채널의 고시 구조(카테고리 · 항목명 · required · channel code · payload field)
설계 → Common(의미 + required) / Channel override(코드·포맷)
🔴 자료 없는 항목을 만들지 않는다 → UNKNOWN / NOT_READY 로 남긴다
🔴 LotteON 만 가진 값을 다른 채널로 복사 금지
🔴 채널별 required 가 다르면 common required + channel override 구조
```

### C. 최종 3채널 E2E (마지막)

전 배치 PASS 후에만. SmartStore 실등록 → 상품/태그/상세페이지/옵션·재고 확인
→ Coupang → LotteON.

---

## 6. 명령어 — 그대로 복사해 쓴다

```bash
# 전수 회귀 (유일한 기준)
cd apps/admin && npx vitest run 2>&1 | sed 's/\x1b\[[0-9;]*m//g' \
  | grep -E "^ FAIL|Test Files|Tests " | head -20

# typecheck — 🔴 0 이 기준이 «아니다». baseline 과 비교한다
for p in shared content listing crawler category marketplace; do
  echo "$p=$(npx tsc --noEmit -p packages/$p/tsconfig.json 2>&1 | grep -c 'error TS')"; done
npx tsc --noEmit -p apps/admin/tsconfig.json 2>&1 | grep -c 'error TS'
#   baseline: admin·shared·content·category·marketplace 0 · listing 5 · crawler 2
#   listing 5 · crawler 2 는 «전부 테스트 파일» 이고 선재 결함이다

# build
cd apps/admin && npx next build 2>&1 | tail -5

# 배포 확인 — 🔴 307/401 은 route 증거가 아니다. 빌드 로그의 Commit: 줄을 본다
npx vercel inspect https://ttaejyo.vercel.app --logs 2>&1 | grep -iE "Commit:" | head -1
curl -s -o /dev/null -w "%{http_code}\n" https://ttaejyo.vercel.app/

# 런타임 로그 — 🔴 반드시 grep 으로 자른다(그냥 받으면 거대하다)
npx vercel logs https://ttaejyo.vercel.app 2>&1 \
  | grep -iE "proxy=|proxyOutboundIp|407|NETWORK_ERROR|auth-test" | head -20

# 완료 기준 — 🔴 clean «과» ahead/behind 둘 다
git fetch origin --quiet && git status --short
git rev-list --left-right --count origin/main...HEAD   # → 0  0

# Production env — 이름은 보이고 값은 못 읽는다. 쓰기는 된다
npx vercel env ls production
#   OUTBOUND_PROXY · OCI_PROXY_URL · FIXIE_URL  ← 🔴 FIXIE_PROXY_URL 이 아니다
```

---

## 7. 🔴 함정 — 이번 세션에서 실제로 걸린 것

### 테스트·측정

```
.test.tsx 는 수집되지 않는다          → 반드시 .test.ts
jsdom 테스트는 첫 줄에              // @vitest-environment jsdom
소스 문자열 검사는 주석을 벗기고       strip() 로 /* */ 와 // 제거 (여덟 번 걸린 함정)
Render PASS ≠ 소스 PASS             UI 는 «마운트한 DOM» 으로만 완료 선언
커버리지는 파일명이 아니라 속성        분기를 속성으로 전수 grep (단품/옵션 둘 다)
부정 단정에는 대조군을                「없다」만 재면 통째로 지운 변경과 구별 안 된다
전역 stub 은 afterEach 에서 복구      fetch 스텁을 안 지워 관계없는 테스트가 떨어졌다
```

### React / jsdom

```
제어 컴포넌트는 상태 보유 래퍼로 감싼다  onChange 를 변수에만 담으면 재렌더가 없다
onBlur 는 `focusout` 으로 걸린다       `blur` 는 버블하지 않아 루트 리스너에 안 닿는다
빈 값 → 빈 값은 commit 되지 않는다     EditableText 의 `draft !== value` — 맞는 동작이다
```

### fixture

```
🔴 fixture 는 «더럽게» 만든다          깨끗한 값으로 재면 실제 상품의 공란을 놓친다
backfillCanonicalProduct 는 모든 칸을 채우지 않는다
  → recommendedAge · sku · material · modelName 등을 «비워서 명시» 한다
  (생략하면 `.value` 로 터진다 — 이번 세션에 3회)
```

### 인프라 측정

```
🔴 한 시각에 한 번 잰 것을 «상태» 로 쓰지 않는다
   이번 세션에 또 틀렸다 — TCP 22 를 1회 CLOSED 로 재고 「인스턴스 회수」로
   확대 보고했다. 3회 재측정하니 OPEN 3/3 이었다.
   → 보고서에 «반복 횟수» 를 같이 적는다: `22=OPEN 3/3`
🔴 측정 방법을 대조군으로 검증한다      확실히 닫힌 포트를 같이 재서 CLOSED 확인
🔴 포트 열림 ≠ 프록시 정상             TCP OPEN 인데 CONNECT 가 hang 할 수 있다
🔴 라우트는 실패해도 HTTP 200          실패가 본문에 담긴다. level=error/warn 로 찾는다
🔴 「없음」도 실행으로 확인한다          error 줄 수를 세고 열어 본다. grep 1회로 쓰지 않는다
🔴 elapsed 가 원인을 가른다            수백 ms = 거절(407) · 20~25s = 무응답(hang)
🔴 env 변경은 재배포 전까지 반영되지 않는다
```

---

## 8. 절대 금지

```
중간 CEO/CPO 확인 요청 · 커밋/배포 승인 요청
기존 Commerce payload/등록 로직 광범위 리팩터
완료 기능 재조사 (4절 목록)
자동 failover
OCI/FIXIE 외 provider 추가 · Tinyproxy 를 provider 로 UI 노출
Proxy URL / credential / secret 의 UI·API·로그·DB 노출
modelName AI 임의 생성 · 제조국 추론 · 브랜드 국가 = 제조국
규제/고시 필드 임의 생성 (근거 없으면 UNKNOWN)
재고 999/0 fabrication
상세페이지 기본 블록 수정 · 채널별 상세설명 분리
Egress 문제를 Commerce business logic 수정으로 우회
임의 debug endpoint 추가
CAPTCHA/anti-bot 우회 · UA 위장 · 프록시 우회
사용처 확인 없이 migration/drop
실등록 버튼 (STOP 중)
```

---

## 9. Known Unknowns — 증거 있는 것만

```
① 동일 kind 추가 경계
   셀러 기본값에 있는 kind 를 추가하면 식별자가 겹쳐 `added` 에 안 들어간다.
   고치려면 기본 블록 식별자 체계를 건드려야 해 «현재 범위 밖».
   → CPO 가 현재 범위 유지로 확정. 대조군과 함께 테스트로 명시돼 있다.

② 네이버 고시 연령축 미연결
   네이버 payload 입력에 카테고리 «경로 이름» 이 없다(숫자 id 뿐).
   「경로 없으면 연령축을 본다」로 고쳤다가 **되돌렸다** — 채널 카테고리가
   어린이인증을 요구하지 않는데 KIDS 로 신고하는 것은 실제 등록 없이 확인할
   수 없는 규제 주장이다. 선재 테스트 7건이 그것을 잡았다.

③ LotteON 태그 5개 상한 화면 표시
   상한 자체는 문서 근거가 있는 «정상 정책»(scKwdLst 5개 이하).
   조용히 잘리는 것만 UX 배치에서 표시한다.

④ SmartStore sellerTags 실제 반영
   payload GREEN · 채널 반영은 실등록 전까지 미검증.

⑤ OCI Tinyproxy hang 의 «원인과 주기»
   사실: 22 OPEN 3/3 · 8888 OPEN 3/3 · 대조군 CLOSED · CONNECT 무응답
         → 응답 계층 이상. restart 로 복구됨(이후 407/0.15s = 정상).
   🔴 가설: 「2일 주기」 — 078 이력이 쌓인 뒤에만 판정한다.
```

---

## 10. 관련 메모리

```
commerce-egress-handoff                      Egress ②~⑧ 착수점 · 확인된 구조
p56-followup-cpo-closed-blocked-on-egress    P1 완료 기준 · 재조사 금지
three-channels-fail-together-means-proxy     프록시 장애 진단 · 내가 틀린 기록
production-secrets-are-write-only            값은 못 읽는다 (DB 는 예외)
vercel-runtime-logs-are-reachable            200 들이 분기를 지워 준다
render-pass-is-not-source-pass               화면은 마운트 DOM 으로만
coverage-is-a-property-not-a-filename        분기를 속성으로 전수
fixtures-must-be-dirty                       깨끗한 fixture 는 공란을 놓친다
local-toolchain-silent-noops                 npx turbo 는 exit 0 인데 안 돈다
main-is-not-typecheck-clean                  baseline 과 비교한다
```
