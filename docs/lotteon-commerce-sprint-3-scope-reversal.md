# LOTTEON COMMERCE SPRINT 3 — 범위 되돌리기 기록 (CEO 확정, 2026-09-14)

이 문서는 **무엇을 왜 지웠고, 되살리려면 무엇을 해야 하는가**만 적는다.
기능 설명이 아니라 스코프 결정의 영수증이다.

되돌리기 직전 커밋: `6e93261`
(= `feat(LOTTEON-SPRINT-2): 롯데ON을 설정·조회·상품등록까지 붙이되 주문을 건드리는 길은 코드에서 막는다`)

---

## 1. 왜 지우는가

CEO가 **판매관리를 이번 제품 범위에서 제거**하기로 확정했다. 축소가 아니라 제외다.
직전 스프린트(`6e93261`)가 만든 판매관리 조회 화면과 그 화면만 쓰던 라우트를 지운다.

품질 문제로 지우는 것이 아니다. 되돌리기 대상 코드는 마지막 상태에서 전부 동작했고,
조사 문서(`docs/lotteon-commerce-sprint-2-survey.md` §5-2, §6-3)의 판정도 그대로 유효하다.
**판매관리 쓰기가 STOP이라는 판정은 바뀌지 않았다** — 그 판정 때문에 조회만 만들었고,
이번에는 그 조회까지 범위에서 뺀 것이다.

---

## 2. 지운 것

| 대상 | 경로 | 무엇이었나 |
|---|---|---|
| 화면 | `apps/admin/src/app/sales/page.tsx` | 판매관리(조회) 화면. 주문 1일치 조회 + 취소/반품/교환 조회 탭. 처리 버튼은 애초에 없었다 |
| 메뉴 | `AppShell.tsx`의 `{ id: "sales", … }` | 사이드바 "판매관리 (조회)" 항목 |
| 라우트 | `apps/admin/src/app/api/lotteon/orders/route.ts` | `209` 출고/회수지시(주문정보) 조회. POST, 조회기간 1일 상한(returnCode `2003`) |
| 라우트 | `apps/admin/src/app/api/lotteon/claims/route.ts` | `50` 취소 · `51` 반품 · `69` 교환 **조회**. 승인/거부는 애초에 만들지 않았다(금지 목록) |

되살리려면: `git show 6e93261 -- <경로>` 로 원문을 그대로 꺼낼 수 있다.
세 파일 모두 이 커밋에서 신규 추가된 것이라 diff가 곧 전문이다.

---

## 3. 🔴 지우지 않은 것 — 210 guard

`apps/admin/src/app/api/lotteon/_lib/forbidden-endpoints.ts` 와 그 테스트
`apps/admin/src/app/api/lotteon/__tests__/forbidden-endpoints.test.ts` 는 **그대로 둔다.**

이유는 하나다. 판매관리 **화면**이 사라져도 롯데ON HTTP 클라이언트
(`_lib/client.ts`)는 상품등록에서 계속 쓰인다. guard는 화면이 아니라 그
클라이언트에 붙어 있다 — 누군가 나중에 주문 경로를 다시 더할 때 막아야 하는
쪽은 여전히 그 guard다. 화면이 없으니 guard도 필요 없다고 판단하는 순간,
`210 연동완료통보`(호출 즉시 주문을 되돌릴 수 없게 전이시킨다)로 가는 길이
조용히 열린다.

금지 목록에서 경로를 빼는 것은 코드 정리가 아니라 **CEO 승인이 필요한 스코프
변경**이다(원문 주석 그대로).

`_lib/client.ts`의 `LOTTEON_READ_PATHS.ordersSearch / cancellationSearch /
returnSearch / exchangeSearch` 상수도 남겼다. 지금은 라우트가 부르지 않지만,
guard 테스트가 "209 조회 경로는 막히지 않고 210 통보 경로는 막힌다"를 고정하는 데
이 상수를 쓴다. 상수를 지우면 그 사실을 검증할 수단이 함께 사라진다.

---

## 4. 남긴 것 — 상품등록에 필요한 것들

| 경로 | 왜 필요한가 |
|---|---|
| `/api/lotteon/product-status` (`93`) | 등록 응답(`87`)에 **단품번호 `sitmNo`가 없다.** `spdNo` → `93`의 `sitmNoLst`로만 얻는다 |
| `/api/lotteon/categories` (onpick `205`/`206`) | 표준 + 전시 2중 카테고리 선택 |
| `/api/lotteon/payload-preview` · `/api/lotteon/register` (`87`) | 등록 정보 확인 · 실제 등록 |
| `/api/settings/lotteon` · `/api/lotteon/auth-test` (`207`) | 인증키 저장 · 연결 확인 |
| `_lib/{account,env,client,request,connection-error,build-context,identity}.ts` | 위 라우트들의 공통 기반 |

---

## 5. 11번가 — 화면에서만 뺐다

CEO 명시: **UI 제거만 허용. 11번가 adapter·코드를 삭제하거나 refactor하지 마라.**

실제로 바꾼 것은 한 줄이다.

```ts
// apps/admin/src/app/pipeline/CommerceWorkspace.tsx
const WORKSPACE_PLATFORM_ORDER: PlatformId[] = PLATFORM_ORDER.filter((id) => id !== "elevenst");
```

상품등록 화면에서 채널을 나열하는 자리(탭 줄 · 준비상태 줄 · Action Center ·
④ 흐름 · 잠정 준비도 계산)가 전부 이 배열 하나를 본다. `PLATFORM_ORDER`
(`packages/marketplace/src/registry.ts`) · `PlatformId` · 11번가 어댑터는 **한 줄도
바뀌지 않았다.** 되살리려면 저 `filter` 하나를 지우면 된다.

`BacklogPanel`의 "11번가 등록" 항목도 함께 뺐다 — 탭에서는 사라졌는데 화면 아래에서
"곧 나온다"고 계속 약속하면 안 된다.

---

## 6. "Preview" 명칭

기능을 지운 것이 아니다. 이름만 바꿨다.

| 위치 | 전 | 후 |
|---|---|---|
| 스마트스토어 탭 섹션 (`NaverPayloadPreview.tsx`) | `Payload Preview` | `등록 정보` |
| 쿠팡 탭 섹션 (`PlatformPreview.tsx`) | `Payload Preview` | `등록 정보` |
| 원문 토글 (스마트스토어 · 롯데ON) | `Payload Preview (…)` | `전송 데이터 원문 보기 (…)` |
| 스마트스토어 탭 배지 (`CommerceWorkspace.tsx`) | `PREVIEW` | `확인 전용` |

개발자용 payload 확인 기능(필드 단위 상세 · JSON 원문 · `CoupangPayloadInspector`)은
전부 그대로다. 세 탭이 **같은 이름**을 쓴다 — 채널마다 다른 이름을 붙이면 같은 것이
세 개로 보인다.

---

## 7. 이 결정을 지키는 테스트

`apps/admin/src/app/pipeline/commerce/__tests__/lotteon-sprint3-scope.test.ts`

되돌리기는 시간이 지나면 슬그머니 되살아나는 종류의 변경이다(메뉴 한 줄, 탭 한 개).
그래서 사람이 기억하는 대신 테스트가 기억한다: 삭제된 파일이 없는지, 210 guard의
15개 항목이 그대로인지, `PLATFORM_ORDER`가 여전히 11번가를 포함하는지(= UI만 뺐다는
증거), 화면에 `Payload Preview`가 남아 있지 않은지.
