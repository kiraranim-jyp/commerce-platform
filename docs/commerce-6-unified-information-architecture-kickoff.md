# Commerce-6 — 통합 Commerce 정보 체계 · 착수 노트

> CTO(2026-09-26). 🔴 **Phase A~F 를 «수행하지 않았다».** 코드 변경 0 · push 0.
> 이 문서가 담는 것은 ① 고정 원칙 ② Phase A 가 바로 쓸 수 있는 «이미 확인된» 재료다.
> 컨텍스트 한계로 여기서 인수인계한다 — 전수 조사를 시작했다가 중간에 끊으면
> 분류표가 반쯤 만들어진 채 남고, 그것이 가장 나쁜 결과다.

## 1. 🔴 고정 원칙 — Commerce 가 늘어날 때 던지는 질문의 «순서»

```
❌  "새 Commerce 니까 새 설정값을 만들자"

✅  ① 이 Commerce 가 요구하는 정보 중 «이미 우리가 가진» 것은 무엇인가
    ② 그중 «다른 Commerce 에서도 같은 의미» 인 것은 무엇인가
    ③ Common 으로 끌어올릴 수 있는가
    ④ 앞으로 Extension 이 수집할 수 있는가
    ⑤ 그래도 남는 것만 Commerce 관리정보로 둔다
```

🔴 **「어디에서 필요하냐」보다 「같은 의미로 재사용할 수 있느냐」가 먼저다.**

그리고 두 가지를 **절대 섞지 않는다**:

```
COMMON 으로 «관리할 수 있다»      ≠      지금 «자동으로 채울 수 있다»
```

어떤 Commerce 가 사업자등록번호를 요구한다고 해서 Extension 이 그것을 수집할 수 있다는
뜻이 아니다. 두 칸을 따로 기록한다.

## 2. Phase A 가 바로 쓸 수 있는 «이미 확인된» 재료

재조사하지 말 것 — 아래는 Commerce-5 에서 코드로 확인한 사실이다.

### 2-1. 🔴 「셀러 설정」이 이미 **둘로 갈라져 있다** — 이것이 Commerce-6 의 1번 증거

| | 저장소 | 담긴 것 | 성격 |
|---|---|---|---|
**(1)** sellerProfile | `/api/settings/seller-settings` | `outboundLeadTimeDays` · `deliveryCompanyCode` · `naverDeliveryCompanyCode` · `outboundShippingPlaceCode` · `returnCenterCode` · `companyContactNumber` · `deliveryCharge` | 🔴 **쿠팡/네이버 모양으로 자란 «공통» 설정** |
**(2)** `lotteon_seller_settings` | 싱글턴 테이블(`SINGLETON_ID`) | `outbound_place_no` · `return_place_no` · `delivery_cost_policy_no` · `delivery_region_group_code` · `weekday_close_time` · `saturday_close_time` | 🔴 **롯데ON 전용으로 새로 만든 설정** |

🔴 **(1)과 (2)는 같은 개념을 서로 다른 이름으로 두 번 저장하고 있다**:

```
출고지   (1) outboundShippingPlaceCode   ↔   (2) outbound_place_no
반품지   (1) returnCenterCode            ↔   (2) return_place_no
배송비   (1) deliveryCharge              ↔   (2) delivery_cost_policy_no  ← 🔴 의미 확인 필요
택배사   (1) deliveryCompanyCode                                          ← (2)에 없음
```

즉 이 저장소는 **이미 §1 이 금지한 방식으로 한 번 자랐다** — 롯데ON 이 추가될 때
「새 Commerce 니까 새 설정 테이블」을 만들었다. Commerce-6 이 고쳐야 할 대상이 바로 이것이고,
**Phase C(중복/통합 후보)의 첫 항목**이다.

🔴 다만 **같은 값인지 아직 확정하지 못했다.** 쿠팡 `outboundShippingPlaceCode` 와 롯데ON
`owhpNo` 는 **각 마켓이 발급한 서로 다른 번호**일 가능성이 높다(같은 「출고지」라는
*개념*이지만 값은 채널마다 다르다). 그렇다면 정답은 「하나로 합치기」가 아니라
**「Canonical 개념 1개 + 채널별 발급번호 N개」** 다. Phase B 가 이것부터 정해야 한다.

### 2-2. 확정된 필드 의미 (재조사 금지)

```
4279402 = dvCstPolNo (배송비정책번호) — apiNo 87 payload · apiNo 166 으로 조회
LotteON 선결 4값 = owhpNo · rtrpNo · dvCstPolNo · dvRgsprGrpCd
   → 넷 다 「셀러가 마켓에 미리 등록해 둔 운영값」이지 상품 정보가 아니다
```

### 2-3. 🔴 LotteON 화면이 비어 있는 원인 — 후보 3개로 좁혀져 있다

Commerce-5 STEP 1 결과 그대로다. Phase E 의 입력값이다:

```
(a) lotteon_seller_settings 행의 delivery_cost_policy_no 가 비어 있다
(b) 🔴 fetch 는 되는데 sellerFixed 가 폼 초기값(dvCstPolNo)에 연결되지 않았다  ← 유력
(c) /api/settings/lotteon-seller 실패를 catch 가 조용히 삼킨다
```

판별: `lotteon-channel-form.ts:860` 의 `dvCstPolNo` 초기값이 `sellerFixed` 를 보는지 확인.

### 2-4. Provenance 는 «이미 있다» — 새로 만들지 말 것

`ProvenanceField<T>` = `{ value, source, confidence }` 가 `packages/shared` 에 있고
`CanonicalProduct` 전체가 그 위에 서 있다(`FieldSource`: ORIGINAL · AI · MANUAL ·
SETTINGS_DEFAULT · DEFAULT_VALUE · REQUIRED …). §10 이 요구한 「Canonical Value +
Source + Last Updated」의 앞 두 칸은 **이미 구현돼 있다.**

🔴 그러므로 Phase B 는 **새 Provenance 개념을 만들지 않고** 이것을 셀러/운영 정보까지
넓힐 수 있는지만 본다. Extension 이 들어오면 `FieldSource` 에 값 하나가 느는 모양이 된다.

### 2-5. 🔴 「상품 vs 운영」 경계는 이미 코드에 있다 — 그 위에 세울 것

`ReadinessItem.sourceStatus` 가 이미 네 갈래를 말한다 — `MANUAL_REQUIRED`(셀러가 직접) ·
`AUTO` · `SETTINGS_DEFAULT` · `DEFAULT_VALUE`. 그리고 `classifyMissing()` 이 그것으로
「입력 필요」와 「확인 필요」를 가른다(`commerce-registry.ts:131`).

🔴 즉 §13 의 목표 UX(「부족 필드만 표시」)를 위한 **분류 축이 이미 존재한다.** Commerce-6 은
그 축을 없애고 새로 만들 것이 아니라, **모든 필드가 그 축을 제대로 달고 있는지**를 보면 된다.

## 3. Phase A 수행 방법 (다음 CTO 용)

전수 조사의 «입구» 는 넷이고, 전부 이미 알고 있다:

```
① 등록 payload 빌더   packages/listing/src/{naver,coupang,lotteon}/build-payload.ts
② 검증기             같은 폴더 validate-*.ts   ← 필수/선택과 BLOCKED 사유가 여기 있다
③ 등록 화면 입력칸    PlatformPreview.tsx · LotteOnRegistrationPanel.tsx ·
                     lotteon-channel-form.ts
④ 설정 저장소        /api/settings/seller-settings · /api/settings/lotteon-seller ·
                     brand-profile · seller-profile
```

🔴 ②가 가장 효율적인 시작점이다 — 검증기는 「무엇이 필수인가」를 이미 한 곳에 모아 두었고,
그것이 곧 「셀러가 채워야 하는 것」의 정의다.

§3 의 13열 분류표는 ②에서 나온 필드 목록에 ①③④를 붙여 채운다.

## 4. 🔴 이번에 하지 않은 것

Phase A(전수 조사) · B(Canonical 설계) · C(중복 통합) · D(최소 구현) · E(LotteON 연결) ·
F(회귀) — **전부 미착수.** DB 변경 0 · 코드 변경 0 · push 0.

🔴 그리고 §1 이 금지한 것을 «미리» 하지 않았다 — 통합 후보를 찾았다고 해서
`lotteon_seller_settings` 를 지우거나 합치지 않았다. §8 이 「즉시 삭제하거나 유지 확정하지
않는다」고 명시했고, Production 데이터 호환성을 확인한 바 없다.
