# Commerce-6 C-2B — 쿠팡 도서산간 · 롯데ON 내부 필드명 비노출

> CTO(2026-09-26). **DB 0 · migration 0 · 전송값 0줄 변경 · push 0.**

---

## A. `remoteAreaDeliverable` — 🔴 근거가 «없었다»

### ① 생성 경로 (전수)

```text
Common            없음
Seller Settings   없음
Commerce mapping  없음
Coupang payload   packages/listing/src/coupang/build-payload.ts  ← «여기 한 줄이 전부»
검증기 / UI       없음
```

문자열 전수 검색 결과 이 값이 나오는 Production 지점은 **한 곳**이다.

### ② `"N"` 의 실제 근거 — **없다**

```text
도입   591d0d9 "connect Coupang DRY_RUN flow to real Coupang Open API"
       = 공식 스키마에 맞춰 payload 빌더를 재작성하면서 빈 칸을 메운 값
주석   🔴 0줄
```

🔴 같은 블록의 이웃들은 전부 근거를 적어 두었다 — `deliveryMethod: "AGENT_BUY"`
(구매대행 문서 확인), `requested: false`(사람이 Wing 에서 최종 승인). **이 줄만
이유가 없다.** 스키마의 빈 칸을 메우다 들어온 값이 그대로 남아, 모든 쿠팡 상품이
판매자가 결정한 적 없는 「도서산간 배송 불가」로 등록되고 있었다.

### ③ 최종 수정 방식

CPO 원문을 그대로 따랐다 — 「N 이 틀렸으니 Y 로 바꾼다가 아니다」.
**Y 도 똑같이 우리가 정한 값**이므로 근거 없는 상수를 다른 근거 없는 상수로
바꾸는 것은 교정이 아니다.

```text
① sellerConfig 에 remoteAreaDeliverable 자리를 만들었다(값이 흘러들 통로)
② 빌더의 리터럴을 없애고 resolveRemoteAreaDeliverable() 를 거치게 했다
③ 그 함수가 «값» 과 «누가 정했는가»(decidedBySeller)를 함께 돌려준다
④ 미결정 사실을 기존 체크리스트(getCoupangSettingsStatus.recommended)에 띄운다
⑤ 테스트가 리터럴 부활을 막는다 — 「Y 로 뒤집기」도 함께 막는다
```

🔴 **전송값은 여전히 N 이다. 숨기지 않는다.** 바꾸지 않은 이유 둘:

```text
① 쿠팡이 이 필드를 «필수» 로 요구하는지 확인할 근거가 저장소에 없다 → UNKNOWN
② 판매자의 결정을 담을 칸이 없다 → migration → 🔴 CPO 가 지정한 STOP 지점
```

`missing` 이 아니라 `recommended` 에 넣은 이유: `missing` 은 등록 가능성 퍼센트와
게이트를 움직인다. 지금 넣으면 **모든 쿠팡 등록이 막히는데 셀러가 풀 방법이 없다**
(저장할 곳이 없으므로). 새 게이트를 만들지 않으면서 「아무도 모르게 정해진 값」은
아니게 하는 자리가 `recommended` 다.

### ⑥ 기존 Production 등록 payload 영향 — **0**

바이트 단위로 같다. 미결정일 때 `resolveRemoteAreaDeliverable` 이 돌려주는 값이
지금까지 나가던 값과 동일하다. 이미 등록된 상품도 건드리지 않았다.

### 🔴 STOP — CPO 결정이 필요한 지점

```text
질문 1  도서산간 배송 가능 여부를 판매자가 정하게 할 것인가
질문 2  정하게 한다면 저장 위치 — coupang_seller_profiles 에 칸 하나(migration)
질문 3  정할 때까지 쿠팡 등록을 «막을» 것인가(missing) 「알리기만」 할 것인가(현재)
```

---

## B. 롯데ON 내부 API 필드명 — 셀러 UI 전수 제거

### 전수검사 결과

| 통로 | 이전 | 이후 |
|---|---|---|
visible text | 라벨 병기는 REWORK-14 가 이미 제거 | — |
판정표 라벨 | 🔴 `→ owhpNo` **항상 보임** | C-2A 에서 제거 |
`title` | 🔴 「롯데ON API 필드명 owhpNo」 | **제거** |
`aria-label` | 🔴 같은 문구 | **제거** |
`sr-only` | 🔴 같은 문구(스크린리더가 읽음) | **제거** |
InfoTip | 🔴 `apiCodeTip()` | **함수 자체 삭제** |
placeholder | 0건 | — |
help text(note) | `DV_CO_CD` 1건 | C-2A 에서 제거 |

`code` prop 은 `apiCodeTip()` 하나에만 쓰였다(전수 확인) → 컴포넌트 두 곳과
호출부 **15곳**에서 제거했다.

🔴 **남긴 것**: `requirementOf("owhpNo")` 같은 **조회 키**. 화면에 그려지지 않고
검증 결과를 찾는 데 쓴다. 검증기 · `lotteOnField` · 로그 · 테스트의 코드도 그대로다
— CPO 가 명시적으로 허용했다.

### 🔴 테스트를 «지우지 않고 뒤집었다»

`rework14-field-parity` 에 정반대를 요구하는 줄이 있었다 — 「코드가 사라진 것이
아니다 — 문서(title · sr-only)에는 그대로 있다」. REWORK-14 의 결정을 지키던
가드다. CPO 가 그 결정을 뒤집었으므로 **같은 자리에서 반대를 지키게** 바꿨다.
지웠다면 다음 사람이 ⓘ 를 되살려도 아무도 막지 않는다.

---

## C. C-2A 회귀 — 없음

Common 모델(`common/logistics.ts`)은 한 줄도 바뀌지 않았다.
`Common 의미 → Commerce binding → 채널 payload` 원칙을 깨서 쿠팡 문제를 풀지 않았다 —
A 의 수정은 **binding 단계 안에서** 끝난다(Common 에 도서산간 값을 만들지 않았다.
세 채널이 같은 질문을 하지 않으므로 그것은 `CHANNEL_ONLY` 다).

유지된 금지: `lotteon_seller_settings` 삭제 ❌ · 전용 폼 복원 ❌ · backfill ❌ ·
코드 추정 ❌ · `4279402` 하드코딩 ❌ · 89 응답 없는 코드 승격 ❌.

---

## D. 🔴 출고 소요일 Common 판정 (CPO 요청)

```text
Common 에 존재해야 하는 사업 개념인가?     YES
   코드체계가 없는 순수 «일수» 다. 판매자 운영 정책이고 채널이 발급하지 않는다.

현재 Commerce 별 실제 소비
   SmartStore  ❌ payload 에 필드가 «없다»(naver/build-payload 배송 필드 전수 0건)
   Coupang     ✅ outboundShippingTimeDay
   LotteON     ✅ sndBgtNday (일반상품 상한 3일로 자름)

값이 필요한데 payload 미사용인가?          NO
   네이버가 그 필드를 받지 않는다. 우리가 빠뜨린 것이 아니다.

현재 UI 가 사용자에게 잘못된 기대를 주는가? 🔴 YES — 이번에 고쳤다
```

설정 화면이 「배송 정책 (SmartStore · Coupang 공통)」 아래 「배송비/**출고 소요일**은
두 플랫폼에 동일하게 적용됩니다」라고 말하고 있었다. 배송비는 맞고 **출고 소요일은
스마트스토어에 나가지 않는다.** 셀러는 한 번 넣으면 세 곳에 다 적용된다고 읽었다.
문구를 사실로 되돌렸다(구조는 건드리지 않았다 — CPO 지시).

🔴 이것이 Common 모델의 일반적인 함정이다: **「Common 개념이다」와 「모든 채널이
소비한다」는 다르다.** `logistics.ts` 가 `NOT_APPLICABLE` 을 따로 둔 이유다.

---

## 상태

| | |
|---|---|
쿠팡 도서산간 — 상수 제거 · 미결정 표면화 | 🟢 |
쿠팡 도서산간 — 판매자 결정값 저장 | 🔴 STOP(migration) |
롯데ON 내부 필드명 비노출 | 🟢 전 통로 |
C-2A Common 회귀 | 🟢 없음 |
출고 소요일 판정 | 🟢 Common YES · SmartStore 미소비 · UI 문구 교정 |
등록 payload 변경 | 🟢 0 |
89 `DV_CO_CD` 실응답 · Production 교차검증 | 🟡 UNKNOWN(자격증명 접근 불가) |
