# Commerce-6 Phase C — 실측 · 통합 후보 확정

> CTO(2026-09-26). **코드 0 · DB 0 · migration 0 · 삭제 0 · UI 0.**
> 전제는 Phase A(`…phase-a-field-census.md`) · Phase B(`…phase-b-canonical-concepts.md`).
>
> 🔴 **C-1(실제 DB 값 확인)이 막혔다.** 그 사실과 이유를 §1 에 먼저 적는다 —
> 막힌 것을 막혔다고 적지 않으면 아래 표의 「미확정」이 게으름으로 읽힌다.

---

## 1. 🔴 C-1 — Production DB 에 닿지 못했다

### 한 일

```text
.env.local            VERCEL_OIDC_TOKEN 하나뿐 — Supabase 키 없음
vercel CLI            kiraranim-jyp 로 인증돼 있음
vercel env pull       → 스크래치패드로 «명시 경로» 를 줬다
                        🔴 기본 대상이 ./.env.local 이라 저장소 파일을 덮어쓸 뻔했다
```

### 결과

```text
키 «이름»  51개 내려옴
키 «값»    42/51 이 빈 문자열
             NEXT_PUBLIC_SUPABASE_URL       길이 0
             SUPABASE_SERVICE_ROLE_KEY      길이 0
             NEXT_PUBLIC_SUPABASE_ANON_KEY  길이 0
값이 들어온 9개는 전부 TURBO_* · VERCEL_* 시스템 변수
```

`vercel env ls production` 이 전부 `Encrypted` 로 표시한다.
**이 프로젝트는 환경변수 값을 되읽을 수 없게 설정돼 있다.** CLI 로 가져올 길이 없다.

받은 파일은 **삭제했다.** 저장소 `.env.local` 무사하고 working tree clean.

### 🔴 그러므로 아래 표의 「실측」 칸은 두 종류다

```text
✅ 실측   저장소에 «이미 기록된» 조회 결과(마이그레이션 주석 · CEO 실측 기록)
🔴 미확정 지금 DB 를 봐야만 알 수 있는 것 — 추측으로 채우지 않았다
```

### 기록으로 확보된 실측

| 테이블 | 행 | 값 | 근거 | 시점 |
|---|---|---|---|---|
`workspaces` | **15** (상품 보유 3: 333/21/1건) | — | `059:27` | 2026-09-22 |
`coupang_seller_profiles` | **3** | 🔴 `is_default=true` 1행만 값 있음 · 나머지 2행 판매자/가격 컬럼 전부 null | `059:15-19` · `062:49` | 2026-09-22~23 |
`seller_settings` | **1** | 🔴 `manufacturer` = **NULL** · 지문 `afa6786…` | `059:91` · `062:46` | 2026-09-22~23 |
`product_snapshots` | **381** | — | `063_verify.mjs:19` | 2026-09-25 |
`products` | **0** (Prisma 초기화 잔재) | — | 같음 | 2026-09-25 |
`lotteon_seller_settings` | 🔴 **기록 없음** | `delivery_cost_policy_no` 가 비어 있다는 «서술» 만 | 착수노트 `:69` | 2026-09-26 |
`coupang_brand_profiles` | 🔴 기록 없음 | — | — | — |
`commerce_accounts` | 🔴 기록 없음 | — | — | — |

### 🔴 픽스처를 실측으로 읽지 않는다

```text
"115"(출고지) · "335"(배송비정책) · "GN101"(배송가능지역)
   → 전부 __tests__ 의 단위테스트 mock 이다. 실측 0건.

"4279402"
   → CEO 가 롯데ON 판매자센터 화면에서 «본» 값이다(commerce-5 핸드오프).
      화면 표기: 「4279402 / 업체배송_무기한없음 유료 / 도서산간 3000원 / 제주시 3000원」
      🔴 코드에 넣지 않았다. 이번에도 넣지 않는다.
```

---

## 2. C-2 출고지 · C-3 반품지 — 🔴 **동일성은 DB 로도 증명되지 않는다**

지시받은 대로 「같은 물류센터라는 이유 없이 연결하지 않는다」를 지킨다.
그리고 한 가지를 더 적는다 — **DB 값을 받아도 동일성은 증명되지 않는다.**

```text
쿠팡 출고지    24496935  (Wing 발급)
롯데ON 출고지  115       (판매자센터 발급)
                ↓
두 번호가 같은 창고를 가리키는지 알려면 «주소» 를 대조해야 한다
                ↓
🔴 세 채널 중 출고지 «주소» 를 저장하는 곳이 하나도 없다(Phase B §3)
   쿠팡 실시간 조회(name · countryCode)가 유일한 후보인데 저장되지 않는다
```

### 판정

| | 판정 | 근거 | 🔴 남는 것 |
|---|---|---|---|
출고지 | **B. COMMON + CHANNEL BINDING** (구조상) | 세 채널 모두 발급 ID 가 실재하고 업무 의미가 하나다 | 의미칸을 채울 데이터가 없다 · 동일성 증명 불가 |
반품지 | **B. COMMON + CHANNEL BINDING** (구조상) | 같음. 쿠팡만 주소 5값 보유 | 쿠팡 주소가 타 채널 장소와 같은 곳인지 «알 방법이 없다» |

🔴 **동일성은 「데이터로 증명할 것」이 아니라 「셀러가 선언할 것」이다.**
이것이 C-2/C-3 의 실질 결론이다. Canonical identity 를 우리가 «매칭» 하려는 설계는
증명 수단이 없어 성립하지 않는다 — 셀러가 「이 셋은 같은 창고다」라고 묶어 주는
화면이 있어야 한다. (Phase D 입력값)

---

## 3. C-4 택배사 — 🟡 **매핑 가능성은 «한 방향만» 열려 있다**

| 채널 | 값 | 획득 | 매핑 가능성 |
|---|---|---|---|
쿠팡 | 정적 코드 11종 (`CJGLS` `HANJIN` `LOTTE` `KGB` `EPOST` `KDEXP` `CVSNET` `HDEXP` `ILYANG` `CHUNIL` `DAESIN`) | 🔴 조회 API 없음 · 문서 참조표 | 기준 후보 |
네이버 | 자유 문자열 (`"CJ대한통운"` 추정) | 🔴 조회 API 없음(전수 확인) · 검증 없음 | 🟡 이름 → 코드 매핑은 가능해 보이나 **형식 미확정** |
롯데ON | 공통코드 `DV_CO_CD` | 🔴 **89 실시간 조회** — 값 목록을 지금 모른다 | 🔴 **미확정** |
네이버(반품) | 우선순위 타입 | 🔴 실시간 조회 `GET /v2/product-delivery-info/return-delivery-companies` | 🔴 개념이 다르다(택배사가 아니라 «우선순위») |

### 🔴 매핑할 수 없는 이유 — 억지로 하지 않는다

```text
① 롯데ON DV_CO_CD 의 «값 목록» 을 모른다 — 런타임 조회 전에는 알 수 없다
② 쿠팡 11종조차 원문 미확인이다
   courier-codes.ts 가 스스로 적어 두었다:
   「쿠팡은 이 목록을 조회하는 REST API를 제공하지 않고 문서의 정적 참조표로만
     안내한다. 이번 세션에서 그 문서 페이지 자체를 fetch로 확인하지 못했다
     (문서 사이트 봇 차단) — 아래는 … 흔히 쓰이는 값 기준의 참고 목록이다.」
③ 네이버 값이 «한글 이름» 인지 «코드» 인지 확정되지 않았다(placeholder 추정뿐)
```

### 판정

```text
택배사 = B. COMMON + CHANNEL BINDING     ← 업무 의미(물류사)는 하나다
        🔴 그러나 «값 매핑표» 는 지금 만들 수 없다.
           binding 은 {값, 종류, 획득방법} 세 칸으로 두고
           채널 간 «변환» 은 설계에 넣지 않는다.
```

---

## 4. C-5 배송비 — Phase B 결론 유지 · 🔴 파서가 무엇을 버리는지 확정

```text
apps/admin/src/app/api/lotteon/delivery-settings/route.ts:226-230
  for (const row of list) {
    const no = str(row, "dvCstPolNo", "dv_cst_pol_no");
    if (!no) continue;
    costPolicies.push({ no, name: str(row, "dvCstPolNm", "dv_cst_pol_nm") });
  }
```

**166 응답의 `row` 전체에서 우리가 꺼내는 것은 두 칸뿐이다.** `row` 는 동적 객체라
다른 필드가 있어도 그대로 버려진다.

🔴 **「롯데ON 정책에 금액이 없다」가 아니라 「우리가 안 읽는다」이다.**
CEO 가 화면에서 본 `「업체배송_무기한없음 유료 / 도서산간 3000원 / 제주시 3000원」`
은 그 정책이 **금액 정보를 갖고 있다는 직접 증거**다 — 다만 그것이 166 응답에
실려 오는지는 **미확정**이다(실호출 필요).

### 판정

```text
배송비 = C. CHANNEL-SPECIFIC (두 개념)
   ① 「배송비 금액」        쿠팡 · 네이버 — 우리가 정해 매 상품 전송
   ② 「배송비 정책 참조」    롯데ON      — 채널이 가진 정책을 지목

🔴 통합 금지 유지. 「배송비」라는 이름 하나로 합치지 않는다.
🔴 Extension 수집 가능성 = NO. 배송비 정책은 판매자센터에만 있다.
```

---

## 5. C-6 `delivery_method` — ✅ **확정: 사용하지 않는 legacy**

### 5-1. 도입 의도 (확인됨)

```sql
-- 012_coupang_seller_profiles_business_defaults.sql
-- Sprint A-8(Seller Profile 배송/반품/제조자 정보 관리) — CPO 지시: 상품마다
-- 배송비/반품배송비/교환배송비/출고소요일을 다시 입력하지 않고 판매자 기본값을
-- 자동으로 불러와 쓰도록 한다.
alter table coupang_seller_profiles
  add column if not exists delivery_method text,
```

커밋 `bbee44e`. **배송비·출고소요일과 «한 묶음» 으로 들어왔다** — 개별 판단이 아니라
「판매자 기본값화」라는 한 번의 일괄 작업의 일부였다.

### 5-2. 화면 (확인됨)

```tsx
// settings/page.tsx:1558
<Field label="배송방법" hint="현재 따져는 해외구매대행으로만 등록합니다">
  <input type="text" value={deliveryMethod} … />   ← 🔴 자유 텍스트. 드롭다운 아님
```
기본값 `"구매대행"`. 🔴 **hint 가 스스로 「하나뿐」이라고 말한다.**

### 5-3. 소비처 — payload 도달 0 (확정)

```text
읽기   Settings 폼 · SellerProfileSummaryCard:161 · CoupangPayloadInspector:71
쓰기   POST/PATCH /api/settings/coupang/profiles
payload 도달   ✗   쿠팡은 build-payload.ts:1591 에서 "AGENT_BUY" 하드코딩
                   네이버·롯데ON 은 컬럼을 참조조차 하지 않는다
```

`CoupangPayloadInspector:71` 이 보여주는 `payload.deliveryMethod` 는 **하드코딩된
`"AGENT_BUY"`** 이지 셀러가 입력한 값이 아니다 — 화면이 설정값을 보여주는 것처럼
보이지만 아니다.

### 5-4. 🔴 Phase B 의 「불일치」 서술을 **약화한다**

Phase B §7 이 `AGENT_BUY`(해외구매대행) ↔ `DMST`(국내)를 「같은 상품을 다르게
신고한다」고 적었다. C-6 조사에서 **두 필드가 다른 축일 근거**가 나왔다:

```text
쿠팡     deliveryMethod = AGENT_BUY              조달 방식(해외구매대행)
         overseasPurchased = OVERSEAS_PURCHASED  ← 🔴 «또» 해외라고 신고한다(:1411)
         pccNeeded = true                        ← 구매자 개인통관부호 필요(:1415)

네이버   deliveryType = DELIVERY · NORMAL
         주석(:612-617): 「CartPilot은 해외구매대행 상품을 전부 «국내 택배(EPOST 등)로
         재배송»하므로 DELIVERY + NORMAL 고정값이다」

롯데ON   dmstOvsDvDvsCd = DMST                   배송 «구간» (국내 택배)
```

🔴 즉 「조달은 해외, 배송 구간은 국내」가 **하나의 일관된 사업모델**이고, 쿠팡은
조달을 말하는 필드에, 롯데ON 은 배송 구간을 말하는 필드에 각각 맞게 적었을 수 있다.

**🔴 확정하지 않는다** — 지시대로 「어느 쪽이 맞다」고 결정하지 않는다. 롯데ON 에
조달 방식을 신고하는 필드가 따로 있는지 확인하지 못했다(문서 미확보). 다만
**Phase B 의 「불일치」 단정은 과했다** — 이 문서가 그것을 약화한다.

### 5-5. 판정

```text
delivery_method 컬럼        = 사용하지 않는 legacy   ✅ 확정
「사업모델 = 해외구매대행」 개념 = A. COMMON CONCEPT — 그러나 값이 «상수» 다
각 채널 신고값               = 고정값(binding 이지만 변수가 아니다)

🔴 저장소를 만들지 않는다(PIVOT-02 §10 ④ — 없는 요구로 스키마를 만들지 않는다).
🔴 컬럼을 «지금» 지우지도 않는다 — Phase C 는 구조 확정까지다.
   다만 화면이 「배송방법」을 입력받고도 어디에도 보내지 않는다는 사실은
   셀러에게 거짓말이다. Phase D 의 1순위 후보로 올린다.
```

---

## 6. C-7 `seller_settings.manufacturer` — ✅ **확정: legacy (넘기지만 소비되지 않는다)**

### 추적 결과

```text
seller_settings.manufacturer   (실측값: NULL — 059:91)
        ↓
coupang/register/route.ts:504          manufacturer: sellerSettings.manufacturer ?? ""
coupang/payload-preview/route.ts:97    (동일)
        ↓
CoupangSellerConfig.manufacturer       선언 :51 · 기본값 :103
        ↓
🔴 build-payload.ts 안에서 «읽는 코드가 0» 이다
   :1349 는 사라졌다는 «주석» 이고, :1355 는 resolver 결과 `manufacture` 를 쓴다
```

`resolveManufacturer()` 의 입력에 판매자 값이 아예 없다 — 사다리는
`상품 원문 → 브랜드 프로필 → 브랜드명 → 없음` 이다(`common/manufacturer.ts`).
네이버(`resolve-context.ts:205-207`)·롯데ON(`build-context.ts:262-265`)도 같다.
롯데ON 은 **테스트가 계약으로 고정**하고 있다(`pivot03-lotteon-seller-source.test.ts`).

### 🔴 그런데 화면은 아직 그렇게 말하지 않는다

```tsx
// settings/page.tsx:1721
<Field label="제조자(수입자)" hint="Sprint A-7 실측 1위 블로커 — 여기 입력하면 상품마다 자동 채워집니다">
  <input placeholder="예: 대표님 사업자명" />
```

🔴 **hint 는 「자동 채워집니다」라고 하는데 실제로는 어느 payload 에도 가지 않는다.**
그리고 placeholder 는 「대표님 사업자명」을 요구한다 — 즉 이 칸이 받는 것은 처음부터
**제조자가 아니라 판매 사업자**였고, 라벨만 「제조자(수입자)」다.

`settings-status.ts:34` 가 이 값이 비면 「제조자(수입자)」를 권장 목록에 넣는다 —
채워도 등록에 아무 영향이 없는 항목을 채우라고 안내한다.

### 판정

```text
seller_settings.manufacturer  = legacy 경로 · 🔴 «제거하지 않았다»
개념 「판매 사업자」            = A. COMMON CONCEPT (실재한다 — 이름이 틀렸을 뿐)
개념 「제조자」                 = PRODUCT (이미 분리 완료 · 3채널 공통 사다리)

🔴 Phase D 후보 2건
   ① 화면 hint 「자동 채워집니다」가 사실이 아니다
   ② 권장 체크리스트가 «효과 없는» 항목을 요구한다
```

---

## 7. C-8 — 3종 분류 (최종)

### A. COMMON CONCEPT — 같은 의미 · 여러 Commerce 에서 그대로 사용

| Concept | 저장 | 상태 |
|---|---|---|
**A/S 연락처** | `seller_settings.as_contact_number` | ✅ **이미 통합됨**(059). 롯데ON 은 개념 없음 |
**품질보증기준** | `seller_settings.quality_guarantee` | ✅ 같음 |
**KC 면제문구** | `seller_settings.kc_exemption_text` | ✅ 같음. 롯데ON 미사용 |
**원산지 기본값** | `seller_settings.default_country_of_origin` | ✅ 쿠팡·네이버. 롯데ON 미사용 |
**출고 소요일** | `coupang_seller_profiles.outbound_lead_time_days` | 🟡 3채널 공통이나 «쿠팡» 테이블에 산다 |
**판매 사업자** | `seller_settings.manufacturer` | 🔴 이름이 legacy · 소비처 0 |
**사업모델(해외구매대행)** | 없음(상수) | 🔴 저장소 불필요. `delivery_method` 는 legacy |

### B. COMMON CONCEPT + CHANNEL BINDING

| Concept | 공통 의미 | binding | 🔴 지금 막힌 것 |
|---|---|---|---|
**출고지** | 셀러의 물류 출발지 | 쿠팡 코드 · 네이버 주소록번호(조회) · 롯데ON 번호+label | 의미 데이터 없음 · **동일성 증명 불가** |
**반품지** | 셀러의 회수지 | 같음 (쿠팡만 주소 5값 추가) | 같음 |
**택배사** | 물류사 | 정적코드 · 자유문자열 · 채널공통코드(조회) | **값 매핑표를 만들 수 없다** |

🔴 셋 다 **binding 구조는 확정, 값 연결은 미확정**이다.

### C. CHANNEL-SPECIFIC

| Concept | 채널 | 왜 통합 불가 |
|---|---|---|
**배송비 정책 식별자** `dvCstPolNo` | 롯데ON | 결정 주체가 채널이다. 금액↔번호 변환 불가 |
**배송가능지역** `dvRgsprGrpCd` | 롯데ON | 타 채널에 대응 개념 없음 |
**반품택배사** `rtngHdcCd` | 롯데ON | 쿠팡·네이버는 반품 택배사를 구분하지 않는다 |
**발송마감시간** `nldySndCloseTm` | 롯데ON | 「일수」만 있는 공통 설정에 «시각» 개념이 없다 |
**반품지 주소 5값** | 쿠팡 | 타 채널은 번호만 받는다 |
**반품 택배사 우선순위** | 네이버 | 택배사가 아니라 «우선순위» 다 |
**수입대행코드** `impPrxCd` | 롯데ON | `default_import_proxy_code` 는 HOLD · 미사용 |

---

## 8. Phase C 완료 조건 표

| Concept | 판정 | 근거 | Common 저장 후보 | Channel Binding | 자동수집 |
|---|---|---|---|---|---|
**출고지** | 🟡 **B** (구조 확정 · 값 미확정) | 코드 실측 — DB 미조회 | 🔴 없음(의미 데이터 부재) | ✅ 3채널 실재 | **NO** |
**반품지** | 🟡 **B** (구조 확정 · 값 미확정) | 코드 실측 — DB 미조회 | 🟡 쿠팡 주소 5값뿐 | ✅ 3채널 실재 | **NO** |
**배송비** | ✅ **C** (확정) | payload 전수 | 금액: `delivery_charge` | 롯데ON 만 정책참조 | **NO** |
**택배사** | 🟡 **B** (구조 확정 · 매핑 불가) | 코드/문서 — 값 목록 미확보 | 🔴 「쿠팡」 테이블 탈출 필요 | ✅ 4종류 | **NO** |
**배송 운영주체** | ✅ **A(상수) + legacy 컬럼** (확정) | 3채널 payload + 마이그레이션 012 | 🔴 불필요 | 고정값 | **NO** |
**A/S·품질보증** | ✅ **A** (확정 · 이미 완료) | payload 전수 | `seller_settings` ✅ | 🔴 불필요 | **NO** |

### 확정 / 미확정

```text
✅ 확정  배송비(C) · 배송 운영주체(A+legacy) · A/S·품질보증(A) ·
         delivery_method = legacy · seller_settings.manufacturer = legacy

🟡 구조만 확정  출고지 · 반품지 · 택배사 — 셋 다 B 로 판정하되
                「무엇을 Common 에 담을지」는 DB/런타임 값 없이 정할 수 없다

🔴 미확정  lotteon_seller_settings 실제 값 · coupang_seller_profiles is_default 행의 값 ·
           commerce_accounts / coupang_brand_profiles 행수 ·
           166 응답의 정책 내부 필드 · DV_CO_CD 값 목록 · 네이버 택배사 값 형식 ·
           장소 동일성 · 롯데ON 에 조달방식 신고 필드가 있는지
```

---

## 9. 🔴 Phase C 가 «하지 않은» 것

```text
❌ DB migration · 테이블 삭제 · 필드 이동
❌ lotteon_seller_settings 통합 · coupang_seller_profiles 변경
❌ Extension 구현 · UI 수정 · 새 Commerce 추가
❌ 4279402 하드코딩
❌ delivery_method 컬럼 제거 (legacy 로 «판정» 만 했다)
❌ seller_settings.manufacturer 제거 (legacy 로 «판정» 만 했다)
❌ 쿠팡 AGENT_BUY / 롯데ON DMST 중 어느 쪽이 맞는지 결정
```

## 10. Phase D 가 받는 것

```text
① 동일성은 «셀러가 선언» 한다 — 우리가 매칭하는 설계는 증명 수단이 없다   §2
② 택배사 binding 은 {값, 종류, 획득방법} — 채널 간 변환은 넣지 않는다     §3
③ 🔴 화면이 사실이 아닌 말을 하는 곳 두 군데                              §5·§6
      「배송방법」 입력칸 — 어디에도 보내지 않는다
      「제조자(수입자)」 hint 「자동 채워집니다」 — 소비처가 0 이다
④ Phase B 의 AGENT_BUY↔DMST 「불일치」 단정은 약화됐다 — 다른 축일 수 있다  §5-4
⑤ C-1 은 여전히 열려 있다. §1 의 SELECT 6개가 실행되면 §8 의 🟡 셋이 닫힌다
```
