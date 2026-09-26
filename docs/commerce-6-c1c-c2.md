# Commerce-6 C-1c(완료) · C-2(차단)

> CTO(2026-09-26). **DB 0 · migration 0 · push 0.**

---

## C-1c — 완료

`seller_settings` 를 인증 없이 읽던 세 라우트를 기존 가드에 편입했다.

| 라우트 | 이전 | 이후 |
|---|---|---|
`coupang/payload-preview` | 사용자 검증 **0** | `requireRegistrationAccess(null)` |
`lotteon/payload-preview` | **0** (207 identity 까지 호출) | 같음 |
`admin/registration-qa-batch` | **0** (30건 일괄) | 같음 |

🔴 새로 만든 것 없음 — `register` 라우트의 가드 한 줄을 옮겨 썼다. 401/403 을 새로
설계하지 않았고(가드 응답 그대로), 가드가 `loadSellerSettings` 와
`buildLotteOnContext(207)` **앞**에 선다는 것을 테스트가 본다.

C-1b 계약 유지 확인: 라이브러리는 범위만 정하고 차단은 라우트가 한다 ·
workspace 행 DB 오류는 레거시로 흐르지 않는다 · 레거시 삭제 0 · backfill 0.

---

## C-2 — 🔴 차단. 게이트가 «셋» 이고 모두 `lotteon_seller_settings` 에 있다

목표였던 것:
```text
Seller 기본값      전국 배송 · 우체국택배 · 반품 우체국택배
      ↓
LotteON binding   DV_RGSPR_GRP_CD · DV_CO_CD
```

### 게이트 ① 🔴 쓰는 화면이 «없는 게 아니라 지워졌다»

```text
/api/settings/lotteon-seller   GET ✅  PUT ✅ (라우트는 살아 있다)
그 PUT 을 부르는 화면          🔴 «0건»(grep)
유일한 소비자                  LotteOnRegistrationPanel:687 의 GET 하나
```

`LotteOnSellerFixedSettings.tsx` 머리말이 이유를 적어 두었다 —
**LOTTEON-REAL-REGISTRATION-03 ㉢(CEO 확정, 2026-09-22)**: 배송 입력 6칸이 「배송
프로필」과 중복이라 CEO 가 화면을 보고 지적했고, 입력만 지우고 테이블은 남겼다.

🔴 그러니 C-2 를 「설정 화면에 폼을 만든다」로 풀면 **CEO 가 이미 한 번 반려한 중복을
그대로 되살리는 일**이 된다. 그 길은 닫혀 있다.

그리고 이것이 Commerce-5 의 「`delivery_cost_policy_no` 가 비어 있다」의 답이다 —
값이 지워진 게 아니라 **넣을 길이 없었다.**

### 게이트 ② 택배사는 칸이 «없는» 게 아니라 «채널마다 따로» 있다

```text
coupang_seller_profiles
  delivery_company_code          쿠팡 코드
  naver_delivery_company_code    네이버 코드   ← 같은 의미, 두 번째 코드
  (롯데ON 코드)                  🔴 없다       ← 세 번째가 빠졌다
```

058 에도 `courier`/`hdc`/`DV_CO` 0건. 즉 플랫폼은 이미 **「택배사 하나, 채널 코드 N개」**
모양을 쓰고 있고 롯데ON 자리만 비어 있다. 🔴 새 개념을 만들 일이 아니라 D-8
(`naver_delivery_company_code` 재배치)과 **같은 문제**다.

배송가능지역은 058 에 `delivery_region_group_code` + `_label` 로 자리가 있다.
→ **3개 중 1개만 저장소가 있고, 그 1개도 쓰는 화면이 없다.**

### 🔴 부수 발견 — 설정 화면이 셀러에게 틀린 말을 하고 있었다 (이번에 고침)

그 화면은 이렇게 적고 있었다: 「출고지 · 반품지 · 배송비 정책 · 배송 가능 지역 ·
발송 마감시간은 배송 프로필에서 관리하며 **롯데ON 등록에 자동 적용됩니다**」.

```text
배송 프로필에 배송가능지역·발송마감 칸      🔴 «없다»(grep 0건)
롯데ON build-context 가 프로필에서 쓰는 것   출고 소요일 «하나»(:146 이후 전수)
출고지·반품지·배송비정책의 실제 출처        lotteon_seller_settings(빈 값) → 상품 폼
```

셀러는 「설정해 뒀다」고 읽고, 등록 화면에서 매번 다시 고르고 있었다.
값을 못 넣는 것보다 **넣었다고 믿게 만드는 쪽이 나쁘다.** 문구를 사실로
되돌리는 것까지만 했다(저장소는 게이트 뒤).

### 게이트 ③ 🔴 workspace 축이 «없다» — C-1b/C-1c 를 되돌리는 일이 된다

```text
058   workspace 관련 컬럼 0건 · id='default' 싱글턴
```

여기에 기본값을 넣으면 **모든 워크스페이스가 한 행을 공유**한다. 방금 두 단계에
걸쳐 없앤 바로 그 구조다. 🔴 `seller_settings` 에서 고친 문제를 `lotteon_seller_settings`
에서 새로 만드는 셈이 된다.

### 그래서 필요한 것 (설계 확정 · 실행 안 함)

```text
① lotteon_seller_settings 에 workspace 축   (043/059 패턴 그대로:
     workspace_id nullable → UNIQUE(workspace_id, scope_key) →
     레거시 singleton 부분 인덱스. backfill 은 귀속 근거가 없으므로 «하지 않는다»)
② 택배사·반품택배사 칸 2 + label 2
③ 🔴 폼의 «자리» 는 설정의 롯데ON 아코디언이 아니라 «배송 프로필» 이다
     — ㉢ 반려 이유가 중복이었으므로, 같은 자리에 다시 만들지 않는다.
     택배사는 이미 프로필에 채널 코드 2개로 살고 있다(D-8 과 같은 문제).
     🔴 코드 입력이 아니라 89/150/166 «목록에서 고르기» 로만 만든다.
④ reader 를 C-1b 와 같은 규칙으로(workspace 1순위 · 레거시 폴백 · 오류는 폴백 금지)
⑤ courierCode/returnCourierCode 에 fixed() 사다리 연결
     — 지금 이 둘만 trimOrNull(form...) 이다. 나머지 넷은 이미 사다리를 탄다.
```

🔴 ③에서 **셀러가 목록에서 고른 값을 그대로 저장**하면 「우체국택배 = 어떤 코드」를
우리가 «추정하지 않는다». 코드는 롯데ON 이 준 것이고 우리는 옮겨 담을 뿐이다.
그것이 89 `cdNm` 이 UNKNOWN 인 채로도 성립하는 유일한 길이다.

### 🔴 하지 않은 것

```text
❌ migration        게이트 ③ 때문 — 지금 넣으면 방금 고친 격리가 깨진다
❌ 코드 하드코딩     4279402 · 0001 · KR 어느 것도 넣지 않았다
❌ 이름 추정 매핑    「우체국택배니까 이 코드」 금지
❌ 배송 기본값 저장
```

---

## 상태

| | |
|---|---|
C-1b 범위 격리 | 🟢 |
C-1c 접근 차단 | 🟢 |
C-2 기본값 저장 | 🔴 게이트 3개(쓰기 화면 없음 · 칸 없음 · workspace 축 없음) |
89 `DV_CO_CD` 실응답 | 🟡 UNKNOWN |
`PD_ARTL_CD` | 🟡 UNKNOWN |
Production 교차검증 | 🔴 불가(자격증명 접근 막힘) |
