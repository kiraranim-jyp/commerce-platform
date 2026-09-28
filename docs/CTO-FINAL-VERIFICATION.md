# CTO FINAL VERIFICATION — 3-Commerce 등록 준비

> 대상 커밋 `d4d548a` · Production 반영 완료 · 2026-09-28
> **Render 🟡 → 🟢** (S-24, 아래 §3B) — CPO 가 보류한 한 항목을 닫았다.
>
> ## 🟢 CPO PRE-CHECK PASS (2026-09-28)
>
> Render · Data · Payload · Axis · Regression · Deploy · Evidence 전부 🟢.
> 남은 🟡 셋(외부 API 실호출 · 150/166/89 실응답 · 재고 0 건수)은 **CEO 테스트
> 이후** 항목이다. → CEO 안내: [CEO-FINAL-TEST.md](CEO-FINAL-TEST.md)
>
> 🔴 **CPO 판정 인용** — 「소스/계약 PASS ≠ Render PASS」를 실제로 검증한 사례.
> 이 문장을 앞으로의 완료 기준으로 삼는다.
> 🔴 **「소스에 조건이 있으니 PASS」를 쓰지 않는다.** 이 스프린트에서 그 방식으로
> 두 번 틀렸고(아래 §7), 그래서 아래 항목은 전부 «실행 결과» 다.

---

## 0. CPO 2차 검증용 색인 — 15절 양식 ↔ 이 문서

> 이 문서는 15절 양식([TTAEJYO-VERIFICATION-GATE.md](TTAEJYO-VERIFICATION-GATE.md) §3)
> **확정 전**에 쓰였다. 다시 쓰지 않고 **어디를 보면 되는지만** 적는다 —
> 증거를 나중에 재편집하면 그 자체가 신뢰를 깎는다. 다음 스프린트부터 15절로 쓴다.

| 15절 | 이 문서 | 상태 |
|---|---|---|
| 1. Scope | §1 목표 | 🟢 |
| 2. 변경사항 | §2 | 🟢 |
| 3. Render Evidence | **§3B** (마운트 17건 · 수정 전 화면 · 음성 대조) | 🟢 |
| 4. Data Evidence | §4 (save→load 왕복 7건) | 🟢 |
| 5. Payload Evidence | §5 (Common→Mapping→UI→Payload 6/6) | 🟢 |
| 6. Axis Check | **§0A 아래** — 이 문서에 절이 없어 신설 | 🟢 |
| 7. Failure-path | §3B 「음성 대조」 | 🟢 |
| 8. Regression | §9 (349파일 / 4,700건) | 🟢 |
| 9. Typecheck | §10~13 | 🟢 |
| 10. Build | §10~13 | 🟢 |
| 11. Production Deploy | §10~13 + 배포 사고 기록 | 🟢 |
| 12. Actual Production API | §14-1 | 🟡 자격증명 없음 |
| 13. Known Unknowns | §14 (3건) | 🟢 정직하게 유지 |
| 14. Evidence Links | §3B · §4 · §8 의 테스트 파일명 | 🟢 |
| 15. Commit | `d4d548a` (코드) · `e24e1b4` · `d81137b` (문서) | 🟢 |

**CTO SELF-VERIFICATION — 🟡 PARTIAL**
개발·Render·Data·Payload·Axis·Regression 은 🟢. **12번(외부 API 실호출)이 🟡**
이므로 전체를 🟢 라고 쓰지 않는다.

### §0A. Axis Check — 이번 스프린트에서 실제로 분리한 축

| 섞일 뻔한 쌍 | 어떻게 갈랐나 |
|---|---|
| 브랜드 ≠ 판매처 | S-12 `originSellerLabel()` — 「Bobo Choses」(브랜드)와 「Junior Edition」(수집처)이 같은 줄에 있었다. 호스트는 있는 그대로, 이름은 지어내지 않는다 |
| Common 출고지 ≠ LotteON 출고지 ID | 이름이 같아도 **자동으로 잇지 않는다.** 쿠팡 Wing `24496935` 와 롯데ON `PLO3837441` 은 다른 채널이 발급한 번호다 — 장소의 동일성은 셀러가 선언한다 |
| 설정값 ≠ 우연히 자동 선택된 목록값 | 🔴 S-24 렌더 검증에서 갈랐다. 후보가 1건이면 autopick 이 폼을 채우는데 그것은 「설정에서 온 값」이 아니다. 테스트 fixture 를 **후보 2건**으로 바꿔 두 경로를 분리했다 |
| 상품 원본 재고 ≠ MI 경쟁상품 재고 | `resolveSourceStock` 은 `variants`→product 순으로 **측정된 값**(ORIGINAL·USER_EDITED)만 본다. 999/DEFAULT 는 재고가 아니라 UNKNOWN |
| 국제배송비 ≠ Commerce 고객배송비 | `deliveryCharge`(금액)와 `dvCstPolNo`(판매자센터 등록 «정책»)는 같은 개념이 아니다 — 금액에서 정책을 만들 수 없다 |
| 제조사 ≠ 수입사 ≠ 판매자 | 끝난 사안. `manufacturer` 를 지우거나 이름을 바꾸지 않는다 |

---

## 0B. CPO 2차 검증 대조표 — 확인 항목 ↔ 실제 테스트

> 🔴 **검증 대상 코드는 `d4d548a` 로 고정.** 이 표를 만들면서 코드도 테스트도
> 건드리지 않았다 — 대상이 움직이면 검증이 무의미해진다.
> 테스트 이름은 파일에서 그대로 옮겼다(지어내지 않았다).

### A. 「롯데ON 연결」 — `apps/admin/src/app/settings/__tests__/final-mapping-render.test.ts` (11건)

| CPO 확인 항목 | 테스트 |
|---|---|
| 실제로 6개 값이 존재하는가 | ①「여섯 줄이 DOM 에 선다」 — `select` 6개 + 라벨 6개 |
| 이름이 표시되는가 | ①「목록이 롯데ON 이 준 «이름» 으로 보인다」 |
| 저장값이 화면에 서는가 | ②「연결된 줄은 ✓ 연결됨 + 이름을 보여준다」 |
| 저장값과 목록 후보가 구분되는가 | ②「저장값이 없으면 «연결 필요» 로 선다」 |
| 조회 실패를 정상으로 위장하지 않는가 | ③「실패라고 말하고 다시 불러오기를 준다」 + 「실패했을 때 고르는 select 를 그리지 «않는다»」(0개) |
| 재시도 UI 가 존재하는가 | ③ 「다시 불러오기」 버튼 실재 확인 |
| 내부 코드가 표시되지 않는가 | ④「롯데ON 번호가 글자로 나오지 않는다」 · 「코드를 적는 입력칸이 없다」 |
| 저장 → 재조회 유지 | ⑤「저장한 뒤 다시 열어도 그 값이 서 있다」(언마운트 후 재마운트) |

### B. 상품 → 롯데ON → 배송 — `apps/admin/src/app/pipeline/commerce/__tests__/s24-delivery-collapse-render.test.ts` (6건)

CPO 가 요구한 **4단 분리**를 어디서 보는지:

| 단계 | 증거 위치 |
|---|---|
| ① 설정값 존재 | §4 `final-mapping-roundtrip` — save→load 6/6 |
| ② 설정값이 실제 적용 | `build-context` 사다리 `fixed(form.X, sellerSettings.X)` 6/6 (§5) |
| ③ **「설정값 적용됨」 표시** | ①「여섯 칸이 전부 「설정값 적용됨」으로 선다」 · 「택배사 두 칸이 «빈 자리» 로 남지 않는다」 |
| ④ 실제 Payload 유지 | `build-payload` `owhpNo·rtrpNo·dvCstPolNo·dvRgsprGrpCd·hdcCd·rtngHdcCd` 6/6 (§5) |

🔴 **③과 ④는 서로를 증명하지 않는다** — 택배사 결함이 정확히 그 자리였다(§3B).

부가: ①「🔴 롯데ON 번호가 화면 글자로 나오지 않는다」(`PLO3837441`·`4279402`·
`GN101`·`DV_CO_CD`·`OPLC_CD` 0건) · ②「적용됨 줄이 하나도 서지 않는다」 ·
「고르는 컨트롤이 화면에 남아 있다」(설정이 비면 등록 길이 열린다).

### C. 🔴 §6「설정값 ≠ 우연히 자동 선택된 목록값」 — **증거를 반만 갖고 있다**

CPO 가 가장 중요하다고 지목한 항목이라 **정확히 적는다.**

```
갖고 있는 것   후보 2건 fixture → autopick 이 못 고름 → 설정값이 6칸을 채운다   테스트 있음
갖고 있는 것   실측 관찰 — 후보 «1건» fixture 로 돌렸을 때 「설정값 적용됨」이
               6이 아니라 «3» 이었다. autopick 이 채운 3칸은 그 말을 하지 «않았다».
               (그래서 fixture 를 2건으로 바꿨다)
🟡 없는 것     그 반대 방향을 «고정하는» 테스트.
               「autopick 이 채운 칸은 설정값 적용됨이라고 말하지 않는다」가
               영구 가드로 남아 있지 않다.
```

구조상으로는 `value={form.delivery.X.trim() ? null : sellerFixed?.X}` 가 막는다 —
폼에 값이 있으면(autopick 포함) 그 줄이 그려지지 않는다. **하지만 이 스프린트의
교훈이 「구조가 막는다 ≠ 화면이 그렇다」이므로 «검증했다»고 쓰지 않는다.**

🔴 지금 테스트를 추가하지 않는 이유: **검증 대상이 `d4d548a` 로 고정됐다.**
CPO 판정 후 지시가 있으면 그때 닫는다.

---

## 1. 목표

Common/판매자 설정에서 «한 번» 정한 값이 롯데ON 등록에 자동으로 쓰이고,
셀러가 같은 정보를 다시 입력하지 않는 상태. SmartStore·Coupang 기존 등록은
건드리지 않는다.

## 2. 변경사항

| | |
|---|---|
신규 | `settings/LotteOnDeliveryMapping.tsx` — [배송 프로필] «안» 의 「롯데ON 연결」 |
신규 | `shared/source-stock.ts` · `common-carrier.ts` · `field-requirement.ts` · `listing/common/logistics.ts` |
migration | `067` — `lotteon_seller_settings` workspace 축 + 택배사 4칸 · `seller_settings.importer` (CEO 적용 완료) |
수정 | 재고 해석 단일화(4경로) · 상품코드 단품 폴백 · 라벨 사람화 · ⑤배송 6칸 접기 · MI 축 정렬 |

## 3. 실제 렌더 — 두 탭을 마운트해 «전수» 로 뽑았다

```
              Coupang                     LotteON
① 기본정보    상품명·브랜드·SKU·제조사…    같음
② 카테고리                                 같음
③ 옵션        [재고]                      [옵션 · 재고]
④ 가격                                     같음
⑤ 배송        [배송비 · 반품/교환]         7칸 → 6칸 «접힘 조건» 적용
⑦ 고시        [원산지 · 세탁방법]          [고시 품목 · 고시 항목]
⑧⑨⑩                                       같음
⑪ —                                       롯데ON 고유 코드
```

🔴 섹션 골격은 이미 같았다. 라벨의 「번호/코드」를 걷어냈다(출고지번호→출고지 등).
🔴 `원산지코드→원산지`·`브랜드번호→브랜드` 는 **되돌렸다** — 공통 필드와 개념이
섞인다(테스트가 막았다). → `원산지 선택` · `브랜드 선택`.

## 3B. 🟢 Render RECHECK (S-24) — **그려진 DOM 으로 닫았다**

CPO 판정이 맞았다. 마운트해 보니 **소스 검사가 전부 PASS 였던 자리에서 셋이 나왔다.**

### 수정 전 — 실제로 그려지던 ⑤배송

```
출고지          Hessen 물류센터 · PLO3837441      🔴 코드가 화면에 있다
반품지          반품주소지 · PLO3837441_R         🔴
배송비 정책      업체배송 19800원 · 4279402        🔴
배송 가능 지역   전국 ✓ 설정값 적용됨(GN101)        🔴
택배사          (값 없음, 안내문만)                🔴 빈 칸 — 숨기기만 했다
반품 택배사      (값 없음, 안내문만)                🔴 빈 칸
```

🔴 `s19-lotteon-no-code-on-screen` · `s23-delivery-collapse` 는 **PASS 였다.**
소스에 조건이 있는 것과 화면에 그렇게 그려지는 것은 다른 일이다 — CPO 가 보류한
이유가 정확히 이것이고, 이 스프린트에서 세 번째로 같은 자리다.

### 고친 것

```
① 코드 노출 세 경로
   DeliveryOptionPicker  `name · no` → 이름만 (코드는 data-channel-code 로만)
   SellerSettingApplied  `({value})` 삭제
   SellerSettingApplied  `shownName || value` → sellerFacingName
                          (§262 가 이미 금지한 «코드 fallback» 을 이 줄만 하고 있었다)

② 택배사 두 칸에 「설정값 적용됨」 줄
   숨기는 것과 「어디서 온 값인지 말하는 것」은 다른 일이다.
   위 네 칸은 처음부터 이 줄을 갖고 있었고 택배사 둘만 빠져 있었다.
```

### 검증 — 마운트한 DOM

```
settings/final-mapping-render          11건   「롯데ON 연결」
  여섯 줄이 DOM 에 선다 · 롯데ON 이 준 이름으로 보인다                 PASS
  저장값 → ✓ 연결됨 + 이름 / 저장값 없음 → 연결 필요                  PASS
  🔴 조회 실패 → 「불러오지 못했습니다 + 다시 불러오기」               PASS
     («선택 안 함» 으로 위장하지 않는다 · 실패 시 select 0개)
  코드 노출 0 · 코드 입력칸 0                                         PASS
  고르면 즉시 PUT(여섯 값 통째로) · 언마운트 후 다시 열어도 유지        PASS

commerce/s24-delivery-collapse-render   6건   ⑤배송
  여섯 칸 전부 「설정값 적용됨」 (택배사 둘 포함)                       PASS
  사람이 읽는 이름으로 보인다                                          PASS
  🔴 PLO3837441 · 4279402 · GN101 · DV_CO_CD · OPLC_CD  화면에 0건    PASS
  설정이 비면 고르는 길이 그대로 열린다(적용됨 0줄 · 컨트롤 남음)       PASS
```

### 🔴 이 검사가 «실제로 실패할 수 있는가» — 음성 대조

조용한 fallback 을 일부러 되살려(`if (!listRes.ok …)` → `if (false)`) 돌렸더니
그 두 건이 **즉시 실패**했다. 되돌린 뒤 다시 통과. 빈 DOM 에서 저절로 통과하는
`not.toContain` 에는 앞에 「그려졌는가」를 먼저 세웠다.

### 🔴 결함 B 의 범위를 정확히 적는다 — «UX 결함» 이지 «데이터 결함» 이 아니다

택배사 두 칸이 빈 칸이었던 것은 **화면만** 그랬다. payload 경로는 멀쩡했다 —
사다리가 서버 쪽 `build-context` 에 있어서 화면 렌더와 무관하기 때문이다.

```
build-context   courierCode: fixed(form.courierCode, sellerSettings.courierCode)
                returnCourierCode: fixed(form.returnCourierCode, sellerSettings.returnCourierCode)
build-payload   ...(channel.courierCode ? { hdcCd: channel.courierCode } : {})
                ...(channel.returnCourierCode ? { rtngHdcCd: channel.returnCourierCode } : {})
```

🔴 이 구분을 적어 두는 이유: 「값이 적용되지 않았다」로 기록되면 나중에 누군가
**멀쩡한 payload 경로를 고치려 든다.** 셀러가 「안 들어갔나」 의심하게 만든 것이
실제 피해이고, 고친 것도 그 자리다.

### 함께 잡힌 것

`commerce6-phase-e-seller-settings-source` 가 「네 칸」을 세고 있어서 여섯으로
늘어난 것을 막았다 — **가드가 맞게 반응했다.** 6으로 고쳤다.

## 4. 실제 데이터 저장/재조회 — 실제 함수 왕복

`final-mapping-roundtrip.test.ts` (7건, 프로덕션 코드 · Supabase 만 흉내)

```
save(고른 6값)            → 컬럼 6 + 이름 6 «전부» 실린다        PASS
load()                    → 6값이 그대로 돌아온다                PASS
067 «적용 전»(컬럼 없음)  → undefined→null, 죽지 않는다          PASS
조회 실패                  → source=ERROR·failed=true             PASS
                            («설정 없음» 으로 위장하지 않는다)
```

## 5. Common → Mapping → UI → Payload

```
[배송 프로필] 「롯데ON 연결」 6값 선택 → 즉시 PUT
   ↓ /api/settings/lotteon-seller (비어 있던 라우트를 «부른다»)
lotteon_seller_settings (067)
   ↓ GET — LotteOnRegistrationPanel:722
sellerFixed
   ↓ fixed() 사다리 — build-context  6/6 확인
payload  owhpNo · rtrpNo · dvCstPolNo · dvRgsprGrpCd · hdcCd · rtngHdcCd  6/6 확인
```

🔴 Common(배송 프로필)의 값은 **그대로 둔다**. 롯데ON 번호는 별도로 고른다 —
Common 에 채널 코드를 넣지 않는다.

## 6. 정상 케이스

```
폼이 비었고 설정에 값이 있다   → 설정값이 payload 로 간다        PASS
                                 picker 를 숨긴다               PASS(조건)
이 상품만 다른 출고지를 골랐다 → 설정이 «덮지 않는다»            PASS
```

## 7. 실패/미설정 케이스 — 🔴 여기서 내가 두 번 틀렸다

```
① ⑤배송 picker 숨김  조건은 있었는데 sellerFixed 가 언제나 null 이라
                      «한 번도 발동하지 않았다» → §4 의 저장 경로가 그것을 고쳤다
② 067 컬럼           화면 타입이 몰라서 판단 자체가 불가능했다 → typecheck 가 잡았다

미설정              둘 다 없으면 null → 검증기가 막는다            PASS
조회 실패            「목록 0건」이 아니라 실패라고 말하고 재시도    PASS
내부 코드            이름을 모르면 «코드가 아니라» 「확인 필요」     PASS
```

## 8. 실제 상품 E2E — Pickles / Bobo Choses

`commerce6-e2e-children-fashion.test.ts` (9건)

```
셀러가 채운 값이 «사라지지 않는다»      재고 12 → IN_STOCK qty=12   PASS
쿠팡 ERROR 0건                                                      PASS
롯데ON 에 남는 차단은 «전부 채널 것»    상품정보에서 채울 수 있는데
                                        막힌 항목 «0개»             PASS
```

## 9. 회귀 — SmartStore · Coupang

```
admin       349 파일 / 4,700건   PASS  (S-24 렌더 17건 추가)
listing 530 · pricing 538 · shared 133 · marketplace 42 · category 22   PASS
```
🔴 SmartStore/Coupang 등록 로직은 **건드리지 않았다**(변경 파일 목록 §2 참조).

## 10~13. typecheck / build / deploy / Production

```
typecheck   admin 0 · shared 0 · marketplace 0 · pricing 0 · category 0
            listing 5 → origin/main 에서 온 기존 오류(전부 테스트 파일, 내 파일 아님)
build       next build 성공
deploy      ttaejyo-mff62ediw… ● Ready (Production)
반영 확인    ttaejyo.vercel.app · commerce-platform-mocha.vercel.app  HTTP 200
git         origin/main = d4d548a · 미푸시 0 · tree clean
```

### 🔴 배포 중 내가 낸 사고 — 숨기지 않는다

첫 배포가 **엉뚱한 프로젝트로 나갔다.** Bash 에서 `cd` 한 디렉터리가 PowerShell
에도 남아 있어서 `apps/admin/src/app/api/lotteon/__tests__` 에서 `vercel` 이
실행됐고, 폴더 이름으로 **`__tests__` 라는 새 Vercel 프로젝트**가 만들어져
`tests-silk-delta.vercel.app` 으로 Production 배포됐다.

```
정리한 것   그 폴더의 .vercel/ · .gitignore 삭제 → tree clean (커밋에 안 들어갔다)
재배포      repo 루트에서 다시 실행 → ttaejyo 정상
남은 것     🔴 Vercel 에 `__tests__` 프로젝트와 그 배포가 «그대로 살아 있다»
```

**CPO 처리 지시(2026-09-28) — 지금 건드리지 않는다.**
잘못된 프로젝트가 이미 생겼으므로 **추가 Vercel 관리 작업을 현재 Production 검증과
섞지 않는다.** CEO 테스트가 끝난 뒤 별도 Cleanup 으로 아래 순서로만 처리한다.

```
1. `__tests__` 프로젝트 존재 확인
2. 실제 Production 프로젝트와 연결 관계 «없음» 확인
3. 환경변수 0 확인
4. 최근 배포가 잘못된 테스트 배포 1건인지 확인
5. 삭제
```

🔴 재발 방지 — Bash 의 `cd` 가 PowerShell 세션의 작업 디렉터리에도 남는다.
배포는 **repo 루트에서만** 실행한다(`apps/admin` 에서도 실패한다 — 프로젝트
Root Directory 설정이 `apps/admin` 이라 경로가 겹친다).

## 14. 🔴 미검증 항목 — 정직하게

```
1. 🔴 [정정 2026-09-28] 이 항목은 «틀리게» 적혔다.
   「자격증명이 없다」는 맞지만 「호출된 적이 없다」로 읽히게 썼다.
   저장소가 반증한다 — d02d255 · 2026-09-22 07:18/07:20 에 첫 LIVE 등록이
   실행됐고 returnCode 9999 로 «원산지코드 하나만» 지목받고 거절됐다.
   그 앞(pdItmsCd · 옵션 · trNo · scatNo · dcatLst · 이미지 · 상세)은 전부
   통과했다. → docs/P1-D-CLOSEOUT.md 정정 ①
   «지금 내게 자격증명이 없는 것»과 «한 번도 호출된 적이 없는 것»은 다르다.

2. ✅ **닫혔다** — 「롯데ON 연결」 실제 렌더는 §3B 에서 마운트로 확인했다.
   닫는 과정에서 결함 셋이 나왔고 전부 고쳤다.

3. 롯데ON 150/166/89 «실응답»
   목록이 실제로 몇 건 오는지, cdNm 형식이 무엇인지 본 적이 없다.
   그래서 코드를 추정하지 않고 셀러가 고른 값만 저장한다.

4. 실제 재고 0 상품이 Production 에 몇 건인지 — DB 접근 불가.
```

### 🔴 2번이 CEO 테스트에서 가장 먼저 드러날 자리다

「롯데ON 연결」에서 **목록이 뜨지 않으면** 인증키/IP 문제이고, 그때 화면은
「불러오지 못했습니다 + 다시 불러오기」를 보여준다 — 「선택 안 함」으로 조용히
넘어가지 않는다(§7 계약). 그 화면이 나오면 그것이 신호다.
