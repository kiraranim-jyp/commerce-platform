# Commerce-3C — SmartStore 안전성 + LotteON 수정계약 조사

> CTO 보고(2026-09-26). A 는 구현, B 는 조사. capability 값은 한 글자도 올리지 않았다.

## A. SmartStore — 네트워크 오류에 가짜 payload 를 싣지 않는다 ✅

### 바꾼 것: 한 줄

```diff
  } catch (error) {
      return {
        status: "FAILED", platform: "smartstore", mode, retryable: true,
-       payload,
        error: { step: "NETWORK", … },
```

`packages/listing/src/executors/smartstore.executor.ts`

그 자리에 실려 있던 것은 `buildSmartStorePayload()`(DRY_RUN 전용, 그 파일이 스스로
「실제 스키마가 아니다」라고 적어 둔 값)였다. LIVE 에서 실제로 나가는 payload 는 서버가
만들고 응답으로만 돌아온다 — `fetch` 가 던진 자리에서는 **서버가 무엇을 만들었는지
우리가 모른다.** 모르는 것은 비워 둔다.

smartstore 의 프로덕션 mode 는 항상 LIVE 이므로, 이 catch 가 **가짜 payload 가 셀러에게
닿는 유일한 경로**였다.

### 바꾸지 «않은» 것 — 테스트로 함께 고정했다

`packages/listing/src/__tests__/commerce3c-network-failure-payload.test.ts` (6건)

| | 단정 |
|---|---|
실패 | `status=FAILED` · `error.step="NETWORK"` · 🔴 **`"payload" in result === false`**(키 자체가 없다) |
LIVE 경로 | `fetch` 가 `/api/smartstore/register` 로 **1회** 호출된다 |
성공 | 서버가 준 결과를 **그대로** 돌려준다(가짜로 덮지 않는다) |
PREVIEW | 여전히 `payload` 를 낸다 — 🔴 안전을 이유로 미리보기를 조용히 없애지 않았다 |
DRY_RUN | 여전히 `payload` 를 낸다 |
검증 게이트 | ERROR 가 있으면 네트워크 **앞** 에서 막는다 — 호출 **0회** |

### 🔴 가드가 실제로 일하는지 실행으로 확인했다

`payload,` 를 되살려 넣으니 그 단정이 빨개졌다(「실패 결과에 payload 가 실려 있다 —
보낼 적이 없는 값이다」). 되돌렸다. 처음부터 통과하는 테스트는 비어 있을 수 있다.

### 🔴 그리고 내 «잘못된 가정» 하나가 내 단정에 걸렸다

테스트에 「`UNRESOLVED_CATEGORY` 면 카테고리가 ERROR 다」라고 적었다가 사전조건
단정에서 실패했다 — 실제로 어댑터는 미확정 카테고리를 **ERROR 로 내지 않는다.**
가정을 지우고, 검증 항목의 «모양» 은 어댑터 실물 그대로 두고 상태만 ERROR 로 바꿨다.
🔴 사전조건을 단정해 두지 않았다면 이 테스트는 조용히 «다른 것» 을 재고 있었다.

## B. LotteON — C → D → A

### B-0. 🔴 엔드포인트는 «전부» 기록돼 있다. 없는 것은 request/response 다

`docs/lotteon-commerce-sprint-2-survey.md` §5-1 이 여섯 개 상품 쓰기 API 의 경로를
모두 적어 두었다:

| apiNo | 기능 | 엔드포인트 | R/W |
|---|---|---|---|
87 | 상품 등록 | `/v1/openapi/product/v1/product/registration/request` | W |
**90** | 승인 상품 수정 | `/v1/openapi/product/v1/product/modification/request` | W |
**91** | 가격 변경 | `/v1/openapi/product/v1/item/price/change` | W |
**86** | 재고 변경 | `/v1/openapi/product/v1/item/stock/change` | W |
92 | 상품 판매상태 변경 | `/v1/openapi/product/v1/product/status/change` | W |
111 | 단품 판매상태 변경 | `/v1/openapi/product/v1/item/status/change` | W |
93 | 상품 목록 조회 | `/v1/openapi/product/v1/product/list` | R |
**94** | 상품 상세 조회 | `/v1/openapi/product/v1/product/detail` | R |
95 | 승인상태 변경이력 | `/v1/openapi/product/v1/product/approve/history/list` | R |

### B-1. C — apiNo 91 가격 · 86 재고

```
endpoint          ✅ 위 표
request           🔴 기록 없음 — 코드에 경로 상수조차 «없다»(client.ts 의
                     LOTTEON_WRITE_PATHS 에는 productRegistration 하나뿐)
response          🔴 기록 없음
식별자            🔴 기록 없음 — sitmNo? spdNo? 둘 다? 확인된 바 없다
수정 가능 필드     🟢 «문서가 말한다»(아래)
필수 필드          🔴 기록 없음
기존값 필요 여부   🔴 기록 없음
성공/실패 결과     🔴 기록 없음
```

🟢 **repo 가 유일하게 확인해 주는 것**(조사 §5-1, FAQ 원문):

> *"한번 등록한 옵션값/옵션명은 수정이 불가능하고 **상태(가격/재고/판매상태)만 수정
> 가능**. 옵션 추가는 가능, 최대 500개"*

두 방향으로 읽힌다 — **옵션 축은 수정 불가가 «확인됨»**, 그리고 **가격·재고·판매상태는
가능하다고 문서가 «말한다»**. 후자가 C 를 A 보다 먼저 두는 근거다.

### B-2. C 의 선결조건 — 🔴 sitmNo 는 «오늘도 얻을 수 있다»

```
apiNo 93  ✅ 이미 구현됨(/api/lotteon/product-status)
          응답에 sitmNoLst · fnlAprvYn 둘 다 실린다(route.ts:92,:95)
          요청: trGrpCd·trNo(207 Identity) + regStrtDttm/regEndDttm + pageNo/rowsPerPage
                + (선택) epdNo 배열 최대 100
```

🔴 좁히기 키가 `epdNo` 이고 우리는 그것을 저장하지 않는다. **그러나 우회가 있다** —
날짜 구간 + 페이징으로 받아 `spdNo`(저장돼 있다)로 매칭. 즉 **불가능이 아니라 비용
차이**다. CPO 결정대로 `epdNo` 저장도, `sitmNo` DB 캐시도 **하지 않았다.**

즉 C 가 막혀 있는 이유는 식별자 «확보» 가 아니라 **91/86 이 무엇을 요구하는지 모르는
것** 하나다.

### B-3. D — apiNo 94 상품 상세

```
endpoint          ✅ 상수 있음 (client.ts LOTTEON_READ_PATHS.productDetail)
호출부            ❌ 0건
request           🔴 기록 없음 — 무엇으로 상품을 지목하는지(spdNo? epdNo?) 미확인
response          🔴 기록 없음 — 그래서 수정 가능 필드도, 기존값 보존 방법도 모른다
```

🔴 이것이 「등록상품 수정」의 진짜 병목이다. **읽지 못하면 무엇을 보존해야 하는지 알
수 없고**, SmartStore 에서 「상품명만 고쳤는데 재고·상세설명까지 나갔다」를 고친 방법
(GET → 보존 → 비교 → PUT)을 LotteON 에서는 **시작할 수 없다.**

### B-4. A — apiNo 90 승인 상품 수정

```
endpoint          ✅ 상수 있음 (LOTTEON_WRITE_PATHS 에 정의, 호출부 0건)
대상 «상태»        🔴 기록 없음 — 이름이 「승인 상품」 수정인데 어떤 상태가 대상인지 미확인
수정 가능 필드     🔴 기록 없음 (전체 교체인지 부분 수정인지도 미확인)
필수 필드          🔴 기록 없음
기존값 필요 여부   🔴 기록 없음 — 전체 교체라면 D(94)가 «필수 선행» 이다
rollback/재조회    🔴 기록 없음. 87 등록에는 92(판매중지)라는 되돌림이 기록돼 있는데
                     90 에는 그런 수단이 적힌 바 없다
```

🔴 **이것이 capability 를 UNKNOWN 으로 두는 이유이고, 이번에도 올리지 않았다.**

### B-5. 🔴 왜 더 확인할 수 없었나 — 실행으로 확인했다

공식 계약은 **롯데ON API 센터**에 있다(`https://api.lotteon.com/apiService/?…&apiNo=90&…`).
실제로 불러 봤다:

```
WebFetch(apiNo=90 계약 페이지) → "NO CONTRACT CONTENT"
```

JavaScript 앱 셸이고 계약 본문이 HTML 에 없다. 그리고 연동 가이드가 말하는 전제는
**「롯데ON 스토어센터 로그인 → 판매자정보 → OpenAPI 관리」** 다 — 즉 계약 페이지는
**판매자 계정 뒤에 있다.** CTO 는 열 수 없다.

🔴 **쿠팡 토큰과 성격이 다르다.** 토큰은 «비밀» 이라 공유하면 안 되지만, API 센터의
계약 페이지는 **필드 목록일 뿐 비밀이 아니다.** 즉 이것은 보안 우회 없이 해결 가능한
유일한 UNKNOWN 이다 — §D 에 올린다.

## C. 유지한 제약 (전부 지켰다)

| | |
|---|---|
`sitmNo` DB 캐시 | ❌ 하지 않음 |
`epdNo` 저장 | ❌ 하지 않음(우회가 있어 스키마를 바꿀 이유가 아직 없다) |
Coupang · LotteON adapter 등록 | ❌ 하지 않음 |
CommerceWorkspace 일반화 | ❌ 하지 않음(두 번째 어댑터가 생기는 커밋에서) |
`CHANNEL_CAPABILITY` 구조 확장 | ❌ 하지 않음(카드의 「해제 조건」도 넣지 않음) |
추측 UPDATE 구현 | ❌ 하지 않음 |
builder 통합 | ❌ 하지 않음(한 줄만) |
MI 작업 | ❌ 하지 않음 |
보안 정책 변경 · 토큰 요구 | ❌ 하지 않음 |

## D. 다음에 필요한 것 — 🔴 **보안 우회 없이 가능한 한 가지**

Commerce 를 닫기 위해 남은 UNKNOWN 은 두 종류이고, **한쪽만 해결 가능**하다:

| | 막는 것 | 해결 가능? |
|---|---|---|
Coupang 수정 | Sensitive 토큰 값(등록상품 GET 실측) | ❌ 비밀이라 공유 금지 |
**LotteON 수정** | **API 센터 계약 페이지(로그인 뒤)** | 🟢 **비밀이 아니다** |

CEO 가 스토어센터에 로그인해 **네 페이지의 요청/응답 필드 목록**을 그대로 주면
(91 가격 · 86 재고 · 94 상세 · 90 승인수정), CTO 는 추측 없이 C → D → A 를 진행할 수
있다. 🔴 **인증키·IP·토큰은 필요 없다 — 필드 목록만이다.**

## E. 회귀

```
admin      4,325 / 314 파일 PASS · typecheck 0 · build PASS
listing    471 / 36 파일 PASS (신규 6건 포함)
```

### 🔴 사전 존재 문제 세 건 — 숨기지 않는다

1. **`@commerce/listing` typecheck 5건 실패** — `manufacturer-resolver.test.ts`(2) ·
   `coupang/phase-b2`(1) · `naver/phase-b3`(1) · `lotteon/build-payload.test.ts`(1).
   전부 «테스트 픽스처» 가 실제 타입과 어긋난 것이고, baseline(`3d31f55`)을 stash 로
   확인해 **개수·파일이 동일**하다. 내 파일은 0건이다(처음엔 1건 냈고 고쳤다).
2. **`PlatformPreview.tsx` eslint 3 error + 1 warning** — 기존 훅 문제(Commerce-3B 보고).
3. **`coupang/notice-regression.test.ts` 비결정 실패** — Commerce-3B 에서 보고한 그것.
   이번 세션의 listing 스위트 2회 실행에서는 재현되지 않았다.

🔴 `packages/listing` 에는 eslint 가 설치돼 있지 않다(apps/admin 만 있다) — 그래서
이번 변경 두 파일에 대해 **lint 를 돌리지 못했다.** 「통과」라고 적지 않는다.
