# Commerce-6 F-8 후속 — C(Seller 기본 배송설정) · D(이중 스크롤)

> CTO(2026-09-26). **DB 0 · migration 0 · push 0.**
> D 는 구현했고, **C 는 CPO 가 준 게이트에 걸려 «저장소를 만들지 않았다».**

---

## D. 이중 스크롤 — ✅ 제거 완료

### 원인 (확정)

```text
AppShell.tsx:103  div.h-dvh.overflow-hidden        ← 문서가 자랄 길을 닫는다
AppShell.tsx:145  main.overflow-y-auto            ← 🔴 «유일한» 스크롤 주인
AppShell.tsx:96   주석: 「스크롤은 main 하나만 갖는다」

ChannelRegistrationFrame.tsx:69 (이전)
  lg:sticky lg:top-4 lg:max-h-[calc(100dvh - 8rem)] lg:overflow-y-auto
                                    ↑ 🔴 그 main 안에 두 번째 스크롤을 세웠다
```

### 고친 것

```diff
- <div className="order-1 lg:order-2 lg:sticky lg:top-4 lg:max-h-[...] lg:overflow-y-auto lg:self-start">
+ <div className="order-1 lg:order-2 lg:self-start">
```

🔴 **sticky 도 함께 뺐다.** 둘은 분리해서 고를 수 없다:

| | 결과 |
|---|---|
sticky + 내부 스크롤 | 🔴 이중 스크롤(현 상태) |
sticky 만 남김 | 🔴 기둥이 길면 아래 `[상품 수정]`이 **영구히 잘린다**(F-14-7b 가 고쳤던 버그) |
**둘 다 뺌** | ✅ 페이지 스크롤 하나 · 요약 끝까지 · `[상품 수정]`까지 닿는다 |

CPO 우선순위(① 이중 스크롤 제거 ② 요약 전체 접근 ③ `[상품 수정]` 접근 ④ 그 다음 sticky)를 그대로 따랐다.

### 3 Commerce 적용

`ChannelRegistrationFrame` 하나를 **SmartStore · Coupang · LotteON 이 공유**한다
(`PlatformPreview.tsx:1488` · `LotteOnRegistrationPanel.tsx:1980`). 한 번 고쳐 셋에 적용됐다.

### 계약 테스트

`p0channel03-f14-5-edit-summary.test.ts ⑦` 을 **새 계약으로 갱신**했다 — 옛 의도(F-14-7b)를
주석으로 보존하고, 이제 `lg:sticky` · `lg:overflow-y-auto` · `lg:max-h-` 가 **없다**는 것을 고정한다.

---

## C. Seller 기본 배송설정 — 🔴 **저장소를 만들지 않았다**

### 게이트 ① workspace 격리 — **실패**

CPO 지시: 「현재 `seller_settings` reader 가 legacy 한 행을 공유한다면 그 상태에서
새 기본값을 추가하지 않는다.」

```text
apps/admin/src/lib/seller-settings.ts:132  .is("workspace_id", null)   ← 읽기
apps/admin/src/lib/seller-settings.ts:295  .is("workspace_id", null)   ← 쓰기
059 주석: 「NULL 은 «전역» 이 아니라 «귀속을 확인할 수 없는 레거시» 다」
실측(059): workspaces 15개 · 그중 상품 보유 3개
```

🔴 **지금 기본값을 넣으면 15개 워크스페이스가 한 행을 공유한다.**
한 셀러가 「우체국택배」로 바꾸면 다른 셀러의 상품도 그것으로 등록된다.

`lotteon_seller_settings` 는 더 분명하다 — 058 에 **workspace 컬럼이 아예 없고**
`id='default'` 싱글턴이다(grep 0건).

→ **migration/reader 보안 수정이 선행이다.** 그것은 Beta Security 트랙이다.

### 게이트 ② 「의미값 → 코드」 변환 — **불가(UNKNOWN)**

저장소 문제를 풀어도 두 번째 벽이 남는다.

```text
Common 에 저장할 것   "전국 배송" · "우체국택배"     (의미값 — 옳다)
LotteON 에 보낼 것    DV_RGSPR_GRP_CD · DV_CO_CD  (코드)
그 사이 변환          🔴 89 응답의 cdNm 이 무엇인지 «실측 0건»
```

「우체국택배」를 목록에서 고르려면 `cdNm` 이 정확히 그 글자인지 알아야 한다.
**모르는 채로 이름을 맞춰 고르면 그것이 추정이다** — OPLC_CD 와 같은 벽이고,
CPO 가 금지한 「0001 이 롯데택배일 것이다」와 같은 종류다.

🔴 참고: 현재 `autoPick()` 은 **이름을 보지 않는다** — `isDefault` 표시가 있거나
후보가 정확히 하나일 때만 고른다(`LotteOnRegistrationPanel.tsx:230-235`).
그것이 이 저장소가 이미 지키고 있는 경계다.

### 그래서 지금 확정하는 것 — 설계만

```text
Seller 기본값(의미)                     저장 위치 후보   seller_settings
 ├ 배송 가능 지역 = 전국 배송               🔴 workspace 격리 «후»
 ├ 택배사       = 우체국택배
 └ 반품 택배사   = 우체국택배
            │
            └─ Channel binding (저장하지 «않는다» · 매번 조회)
                 SmartStore  naver_delivery_company_code (자유문자열)
                 Coupang     delivery_company_code (정적코드)
                 LotteON     DV_CO_CD · DV_RGSPR_GRP_CD (89 조회)
```

🔴 **Common 에 LotteON 코드를 저장하지 않는다** — CPO 원칙 그대로다.
저장하는 것은 의미값이고, 코드는 조회 결과에서 매번 고른다.

### 해제 조건 (둘 다 필요)

```text
① Beta Security 의 workspace 격리 — reader/writer 가 workspace 행을 읽고 쓸 것
② 89 DV_CO_CD · DV_RGSPR_GRP_CD 실제 응답 1회 — cdNm 형식 확인
```

②가 먼저 풀리면 **자동 선택 없이 목록만 정확해진다**(지금도 동작).
①이 먼저 풀리면 **기본값을 저장할 자리는 생기지만 무엇을 고를지 모른다.**
→ 둘 다 있어야 C 가 완성된다.

---

## 고시 항목코드 — 🟡 UNKNOWN 유지 (닫지 않는다)

```text
payload-preview/route.ts:164-229 가 매 호출마다 탐침한다
  ① PD_ITMS_CD 의 refcChrValEpn1~4      품목별 필수 항목이 실려 있을 수 있다
  ② PD_ARTL_CD 그룹이 89 에 있는가
  ③ 93 상품목록 → 94 상세 → 기등록 상품의 «실제» pdItmsArtlLst
```

🔴 **「없다」가 아니라 «응답을 아직 못 봤다» 다.** 셋 중 하나에서 구조가 확인되면
`상품품목코드 + 고시 항목코드 + Common 값`을 연결할 수 있는지 판정한다.
확인 전까지 추정 매핑을 만들지 않는다.

---

## 현재 상태

| | |
|---|---|
배송 코드 노출 | 🟢 제거 (F-7) |
배송 코드 직접입력 fallback | 🟢 제거 (F-8 A) |
고시 코드 직접입력 | 🟢 제거 (F-8 B) |
Readiness picker 즉시 갱신 | 🟢 (F-7) |
**이중 스크롤** | 🟢 **제거 (F-8 D)** |
**Seller 기본 배송값** | 🔴 **게이트 2개 — 저장소 만들지 않음** |
`PD_ARTL_CD` | 🟡 UNKNOWN (탐침 대기) |
DB · migration | **없음** |

🔴 **LotteON CREATE 는 아직 누르지 않는다** — CPO 지시대로 C 가 남아 있다.
