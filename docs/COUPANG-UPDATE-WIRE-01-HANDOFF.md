# COUPANG-UPDATE-WIRE-01 — CONTINUE (다음 세션 착수점)

> CPO 확정(2026-09-28). **새 세션은 이 문서부터 읽고 ①로 바로 들어간다.**
> 앞 스프린트 설명을 다시 읽을 필요 없다 — 필요한 것은 전부 아래에 있다.

## 0. 지금 상태 (확인됨, `74b23f5` · 2026-09-28 갱신)

```
작업트리                 clean · origin/main 대비 ahead 0   ← 🔴 둘을 같이 본다
Production 배포          Ready (테스트 376파일/5112건 실측 통과)
SmartStore Production    그대로 (수정 경로 무손상)
Coupang capability       UNKNOWN  ← 화면이 거짓 capability 를 노출하지 않는다
서버 실행부               검증됨 (55 테스트) · UI 미연결
실제 Production PUT       아직 «없음»
PUT 용 토큰               아직 «발급 안 함»   ← 🔴 지금 발급하지 않는다
```

---

## 1. 🔴 최우선 발견 — seam 은 「타입」이 아니라 「출처」다

앞 세션에서 「제네릭 타입 하나로 감싸면 된다」로 갔다가 **실제 코드가 그 방향을
잡아냈다.** 두 채널은 «보낼 값을 만드는 방법» 자체가 다르다.

```
SmartStore                          Coupang
Master                              Coupang GET baseline
 ↓ payload 재생성                     ↓
 ↓                                  Seller 가 실제로 수정한 draft
registered baseline 과 비교           ↓
 ↓                                  baseline 에 draft 변경만 overlay
editedFields                        ↓
 ↓                                  outgoing
UPDATE                              UPDATE
```

**이번 seam 의 핵심 질문: 「현재 outgoing value 를 누가 만드는가?」**

🔴 SmartStore 의 `current payload` 개념을 쿠팡에 **재사용하지 않는다.**
쿠팡에서 Master 재생성은 CPO 최우선 금지다.

### 현물 — 지금 코드가 이렇다 (`CommerceWorkspace.tsx`)

```ts
// :2552  상태가 네이버 타입에 «묶여 있다»
const [channelEdit, setChannelEdit] = useState<{
  model: ChannelEditModel;
  basePayload: NaverProductRegistrationPayload;
} | null>(null);

// :2570  URL 하드코딩
`/api/smartstore/registered-product?snapshotId=...`

// :2608  🔴 여기가 그 «출처» 다 — Master 빌더가 지금 만든 payload
const current = smartStorePayload ?? channelEdit.basePayload;
const edited  = smartStoreEditAdapter.editedFields(channelEdit.basePayload, current);
```

그 외 분기: `:3038` · `:3045` · `:3095` (`platform === "smartstore"`) ·
`:3750` · `:3808` (`tab === "smartstore"`).

---

## 2. 구현 원칙 (CPO 확정)

1. **SmartStore 를 먼저 보호한다** — `Master → payload → editedFields` 구조 유지.
2. **Coupang 은 별도 source-of-outgoing** — `GET baseline + draft → CoupangProductEdits → overlay`.
3. **Common Core 를 다시 설계하지 않는다** — 최소 seam 만 추출.

```
ChannelEdit
 ├─ registered baseline
 ├─ draft
 └─ outgoing source strategy
       ├─ SmartStore: rebuilt/current payload
       └─ Coupang:    baseline + explicit edits
```
타입명은 실제 코드를 보고 **최소 변경**으로 정한다.

---

## 3. 🔴 코드 변경 «전에» 추적할 일곱 가지

1. `ChannelEditPanel` 의 `EditableField` 목록
2. 각 필드가 draft 에 들어가는 방식
3. SmartStore 에서 `current` 가 생성되는 지점
4. 같은 draft 를 `CoupangProductEdits` 로 변환하는 방법
5. 기존 `ChannelEditModel` / `ChangeSet` 에서 재사용 가능한 부분
6. 실제 UI 필드 ↔ Coupang PUT 필드의 1:1 대응
7. baseline 에 있지만 UI 에서 수정하지 않는 필드의 **보존 방식**

---

## 4. 순서 — 🔴 Production PUT 을 «마지막까지» 미룬다

```
① outgoing-source seam 조사
② Workspace orchestration
③ registered-product GET 라우트
④ Coupang adapter 등록 + capability(SUPPORTED_WHEN_SAVED)
⑤ 전체 테스트 / 음성 대조
⑥ build / deploy
⑦ 여기서 «1회용» PUT token 발급        ← 🔴 그 전에 발급하지 않는다
⑧ GET → PUT → GET
⑨ 증거 확보
⑩ route 삭제 → 재배포 → «토큰이 유효한 동안» 404 확인 → 그 다음 token 폐기
```

🔴 **⑩ 의 순서가 규칙이다** — 토큰을 먼저 버리면 삭제를 증명할 수 없다.
미들웨어가 `/api/*` 를 인증 앞단에서 막아 **존재하지 않는 라우트도 401** 을 준다
(2026-09-28 실측: `/api/coupang/zzz-not-a-route-9x8y7z` → 401). 인증 없는 curl 은
「삭제됨」과 「살아 있지만 보호됨」을 구분하지 못한다. 전문은 루트 `CLAUDE.md` §10.

---

## 5. 이미 만들어져 있고 «검증된» 것 (재사용)

| 파일 | 역할 | 테스트 |
|---|---|---|
| `listing/coupang/registered-baseline.ts` | overlay · 상태 게이트(`coupangUpdateGate`) | 32 |
| `listing/coupang/update-preflight.ts` | 손실 가드(`detectCoupangUpdateLoss`) | ↑ |
| `api/coupang/_lib/update-product.ts` | GET→상태→overlay→손실검사→PUT→번호검증 | 23 |
| `channel-lifecycle.ts` | `SUPPORTED_WHEN_SAVED` · `resolveSavedScopedUpdate()` | ↑ |
| `api/coupang/_lib/client.ts` | `PUT` 허용(`DELETE` 불가) | ↑ |

**아직 없는 것**(④에서 같이 만든다): `edit-adapters/coupang.ts` ·
`api/coupang/registered-product/route.ts` — 앞 세션에서 만들었다가 **일부러
거뒀다**(부르는 화면이 없으면 죽은 코드이고, 존재 자체가 「할 수 있다」는 주장).

🔴 그 판단을 강제한 가드 넷을 **약화시키지 마라** —
`commerce3-capability-parity ①·⑤` · `p0channel03-sprintA-commerce-core ②` ·
`p0channel03-lifecycle ⑥`(`resolveLifecycle.length === 3`).

---

## 6. 테스트 (기존 9 + 이번 orchestration)

1 SmartStore 기존 수정 PASS · 2 Coupang Saved PASS · 3 Approved BLOCK ·
4 Unknown BLOCK · 5 GET baseline 실패 BLOCK · 6 Master 재생성 경로 호출 FAIL ·
7 baseline 필드 삭제 BLOCK · 8 `items[]` 삭제 BLOCK · 9 `sellerProductItemId`
삭제 BLOCK · 10 certifications fabricated BLOCK · 11 비수정 필드 보존 ·
12 수정 필드만 변경 · 13 `sellerProductId` 유지 · 14 PUT 실패가 성공처럼 보이지
않음 · 15 재조회 결과와 UI 상태 일치.

🔴 negative test 는 **일부러 깨뜨려** 가드가 실제로 도는지 확인한다.

---

## 7. Production 실측 (⑧) — 범위 고정

대상: 기존 `sellerProductId` 중 **SAVED 1건**(예: `16394846257`).
변경: **상품명 하나**. 🔴 가격·재고·옵션·인증정보는 **건드리지 않는다.**

대조 항목: PUT 전 baseline · outgoing payload · PUT response · PUT 후 GET ·
`sellerProductId` · 변경 필드 · 비변경 필드 · `items[]` · `certifications`.

---

## 8. 최종 판정 기준

```
실제 PUT 성공 전   Coupang SAVED UPDATE = Implemented / Not Production Verified
실제 PUT 성공 후   Coupang SAVED UPDATE = Production Verified
승인 상품          항상 UNKNOWN / BLOCKED
```

🔴 **실제 PUT 이 성공하기 전에는 절대 `Coupang UPDATE Production PASS` 라고
보고하지 않는다.**

## 9. 금지 (그대로)

승인 상품 UPDATE 지원 선언 ❌ · Master 재생성 PUT ❌ · `certifications` 임의
생성/삭제 ❌ · 전체 payload 새로 생성 ❌ · SmartStore 수정 orchestration 회귀 ❌ ·
기존 capability guard 삭제/약화 ❌ · `resolveLifecycle` 숨은 인자 ❌ · 새 Commerce ❌.
