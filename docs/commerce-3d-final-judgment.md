# Commerce-3D — 최종 조사 · 검증 · 배포 단위 판단

> CTO 보고(2026-09-26). **코드 변경 0.** 조사 · 회귀 검증 · 배포 구조 판단만.

## 1. LotteON 계약 자료 — 재검색 결과: **새 자료 0건**

전수 재검색했다(코드 · docs · 테스트 · 마이그레이션 · JSON, node_modules 제외):

```
검색 ①  네 엔드포인트 문자열
        item/price/change · item/stock/change · product/v1/product/detail · modification/request
검색 ②  docs/ 에서 lotteon·롯데 를 언급하는 파일 전수(14개)
검색 ③  survey 문서에서 apiNo 90/91/86/94 를 «표 밖» 에서 논한 곳
```

| | 결과 |
|---|---|
`item/price/change`(91) | 🔴 **금지 목록 테스트에만** 등장(`register-lifecycle.test.ts:31` — 「부르지 않는다」) + 이번 보고서들 |
`item/stock/change`(86) | 🔴 같음 |
`product/v1/product/detail`(94) | 상수 1개(`client.ts:205`) · 설계 문서 1줄 · 호출부 0 |
`modification/request`(90) | 상수 1개 · capability 주석 1줄 · 금지 테스트 1줄 · 호출부 0 |
survey 문서의 표 밖 서술 | 🔴 **0건** — 네 apiNo 는 §5-1 엔드포인트 표에만 있다 |
`sprint-3-scope-reversal` · `tech-debt-register` | 🔴 수정 API 계약 내용 **없음**(연결성 장애 기록뿐) |

즉 repo 가 가진 것은 **엔드포인트 경로뿐**이고, 요청 필드 · 응답 필드 · 필수값 ·
식별자 · 수정 가능 필드 · 성공/실패 결과는 **네 API 전부 기록 없음**이다.

🔴 Commerce-3C 에서 이미 확인한 것과 같은 결론이고, **중복 조사가 아니라 전수 확인**이다
(3C 는 문서 위주, 3D 는 저장소 전체 문자열 검색).

## 2. 그래서 구현하지 않는다 — 🔴 **정상적인 조사 부채로 확정**

```
LotteON UPDATE
      ↓
계약 자료 없음(저장소 전수 확인 · API 센터는 로그인 뒤 JS shell)
      ↓
capability UNKNOWN 유지        ← 값을 올리지 않았다
Adapter 등록 ❌                 ← 등록하면 화면이 「수정 가능」이라고 말한다
UPDATE 구현 ❌                  ← 추측으로 만들면 실패 이유를 셀러가 알 수 없다
```

인증키 · 토큰 · IP 를 CEO 에게 요구하지 않았다. 보안 설정도 건드리지 않았다.

## 3. `ac421ce` 최종 회귀 검증

| 확인 항목 | 결과 | 근거 |
|---|---|---|
SmartStore 실패 결과에서 `payload` 제거 | ✅ | `"payload" in result === false` |
LIVE 성공 경로 유지 | ✅ | 서버 응답을 그대로 반환(객체 전체 동등 비교) |
LIVE 호출 경로 유지 | ✅ | `/api/smartstore/register` 1회 |
PREVIEW `payload` 유지 | ✅ | `status=READY` + payload 있음 |
DRY_RUN `payload` 유지 | ✅ | `status=SUBMITTED` + payload 있음 |
validation ERROR 시 API 차단 | ✅ | `fetch` **0회** |
UNKNOWN UX 렌더 | ✅ | 실제 DOM 마운트 — 쿠팡·롯데ON 카드 «있음» · SmartStore «없음» · 버튼 0개 |
capability ↔ 어댑터 ↔ 문구 정합 | ✅ | 위반 주입 시 5건 빨개짐(실행 확인) |

```
admin     4,325 / 314 파일   PASS      typecheck 0      build PASS
listing     471 /  36 파일   PASS
pricing     532 /  40 파일   PASS
crawler     467            PASS      + 사전 존재 스위트 로드 실패 1건
```

### 🔴 「Production PASS」라고 적지 않는다

세 커밋은 **미배포**다. 위 표는 **로컬 회귀**이고, Production 에서 확인된 것은
아니다. SmartStore 실등록/수정이 Production 에서 통과했다는 기록은 **이번 변경
이전**의 것이다 — 이번 변경(가짜 payload 제거)은 네트워크 오류 경로만 건드리므로
Production 성공 경로에 영향이 없다고 **판단**하지만, 그 판단도 실측이 아니다.

### 사전 존재 문제 (변경 전후 동일 — stash 로 확인)

1. `@commerce/listing` typecheck **5건** — 전부 테스트 픽스처가 타입과 어긋남
2. `PlatformPreview.tsx` eslint **3 error + 1 warning** — 기존 훅 문제
3. `packages/crawler` `match-truth-priority.test.ts` — 스위트 로드 실패(`@/lib/supabase-admin` 미해결)
4. `coupang/notice-regression.test.ts` — 전체 스위트에서 **비결정** 실패(4회 중 1회). 3D 실행에서는 재현 안 됨
5. 🔴 `packages/listing` 에 **eslint 미설치** — 그 패키지 변경은 lint 로 검증 불가

## 4. 🔴 배포 단위 — **구조를 합치지 않는다. 그리고 분리도 «불가능» 하다**

### 판단: 세 커밋을 그대로 둔다

* 배포 방식이 **Vercel Git 연동(`main` 브랜치)** 이다 — `.vercel/` 만 있고
  `vercel.json` · CI 워크플로가 **없다**. 즉 **배포 단위는 «push» 이고 커밋이 아니다.**
  합쳐도 배포 결과가 같다.
* 세 커밋은 서로 다른 성격이다 — 테스트 잠금(3) · UX 연결(3B) · 안전성 수정(3C).
  이 저장소는 「왜 그렇게 했나」를 커밋 메시지에 남기는 것이 사실상 유일한 판단 기록이다.
  합치면 세 이유가 한 덩어리가 되고, 나중에 한 줄을 되돌릴 근거를 잃는다.
* 🔴 squash 는 **되돌리기를 어렵게 만든다.** 3C 한 줄만 revert 해야 하는 상황이
  생기면(가짜 payload 를 화면이 실제로 쓰고 있었다면) 합친 커밋에서는 그 경계가 없다.

### 🔴 그런데 «Commerce 만» 배포할 수는 없다

미배포 8개가 **한 줄의 선형 체인**이고 Commerce 가 MI **위에** 있다:

```
c56159e MI-1 ─ 610a7fc MI-2 ─ 37c8293 MI-3 ─ f075d07 MI-4 ─ 865f347 MI-5
                                                                │
                                              0d6a6d7 ─ 3d31f55 ─ ac421ce  Commerce
```

* 파일은 **완전히 갈라져 있다** — Commerce 세 커밋이 건드린 13개 파일 중 MI 파일은
  **0개**다(`git diff --name-only 865f347..ac421ce` 전수 확인).
* 🔴 **그러나 git 위에서는 Commerce 를 push 하면 MI 다섯 개가 «함께» 나간다.**
  `main` 을 push 하는 것이 곧 배포이므로, **Commerce 배포 = MI P0-1 + P0-2-B 배포**다.
* 반대 방향은 가능하다 — `git push origin 865f347:main` 으로 **MI 만** 먼저 배포할 수 있다.

### 그래서 선택지는 셋이고, 전부 CPO 결정이다

| | 내용 | 대가 |
|---|---|---|
**A** | 8개 전부 push(한 번의 배포) | MI P0-1(품번 재사용 차단) + P0-2-B 가 함께 나간다 — **MI 배포 결정이 먼저 필요** |
**B** | `865f347:main` 까지만 push → MI 먼저, Commerce 나중 | 순서가 CPO 의 「Commerce 먼저」와 반대 |
**C** | 아무것도 push 하지 않는다 | 현재 상태 유지 |

🔴 **CTO 는 push 하지 않았다.** 배포는 되돌리기 어려운 외부 영향이고, 이번 지시에
push 권한이 명시되지 않았다. 그리고 A 를 고르면 **MI 배포 결정을 CTO 가 대신 내리는
것이 된다** — 그 결정은 「P0-2 설계 결정까지 본 뒤 P0 묶음으로」라고 CPO 가 이미
보류해 둔 것이다.

## 5. Commerce Sprint 최종 상태

| 영역 | 최종 상태 | 근거 |
|---|---|---|
Commerce Core | ✅ 완료 | 실행 코드에 채널명·벤더 필드명 0 — 테스트로 고정 |
SmartStore CREATE | ✅ 완료 | `register/route.ts:1017-1249` |
SmartStore UPDATE | ✅ 완료 | GET → 비교 → 보존 → 손실검사 → PUT |
SmartStore lifecycle | ✅ 완료 | CREATE/UPDATE/RECREATE/NOOP/BLOCKED 전부 구현+테스트 |
SmartStore 안전성 | ✅ 완료(로컬) | 가짜 payload 제거 · 🔴 Production 미검증 |
Coupang CREATE | ✅ 완료 | `sellerProductId` → `channel_products` |
Coupang UPDATE | 🔴 **UNKNOWN — 실측 필요** | 문서 근거 有 · GET 실측 0건 · 토큰은 비밀 |
Coupang UNKNOWN UX | ✅ 완료 | 우측 요약 카드 렌더 확인 |
LotteON CREATE | ✅ 완료 | `spdNo` → `channel_products` |
LotteON UPDATE | 🔴 **UNKNOWN — 계약 필요** | 엔드포인트만 기록 · request/response 전무 |
LotteON UNKNOWN UX | ✅ 완료 | 우측 요약 카드 렌더 확인 |
ChannelProduct | ✅ 3개 연결 | 세 라우트가 같은 공통 함수 사용 |
Master/Commerce 경계 | ✅ 확인 | 번역은 한 방향 · 채널 값이 Master 를 덮는 길 없음 |
Adapter | ✅ 확인된 채널만 | `EDIT_ADAPTERS = { smartstore }` · 위반 시 테스트 5건 실패 |
미확인 API 추측 구현 | ✅ **없음** | 쿠팡 client 는 타입에서 PUT 차단 · LotteON 91/86 경로 상수조차 없음 |

### CTO 판정

> **Commerce Core + 3개 Commerce 의 «현재 확인 가능한 범위» 까지 완료.**

두 UNKNOWN 은 코드로 메울 수 없고, 메우려는 시도 자체가 이 스프린트가 막아 온 것이다:

```
Coupang   Sensitive 토큰      → 비밀. 요구하지 않는다.
LotteON   로그인 뒤 계약 페이지 → 🟢 비밀이 «아니다». 필드 목록만 있으면 진행 가능.
```

🔴 **둘 중 하나는 보안 우회 없이 풀 수 있다.** LotteON 네 페이지
(91 가격 · 86 재고 · 94 상세 · 90 승인수정)의 요청/응답 필드 목록이 저장소에 들어오면
그 날 C → D → A 가 열린다. 인증키·IP·토큰은 필요 없다 — 이것만 §4 와 함께 올린다.

## 6. 남은 결정 두 가지

1. **배포**: §4 의 A / B / C. 🔴 Commerce 를 배포하면 MI 가 함께 나간다.
2. **LotteON 계약 자료**: 받을 것인가(비밀 아님). 받지 않으면 UNKNOWN 이 유지되고,
   그것도 정직한 상태다.
