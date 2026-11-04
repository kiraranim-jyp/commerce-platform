# STAGE 5 — SELLER SOURCING DECISION → PRODUCT REGISTRATION (2026-11-04)

> 기준 HEAD `a8d63b32` → 산출 커밋은 이 문서 하단. 🔴 **분석만 하고 끝내지 않았다** —
> 측정으로 찾은 **실제 흐름 차단 1건을 고치고 배포** 했다.
> 🔴 LOCK 전수 준수: 판정·점수·threshold·`priceTierFromLink`·eligibility·`SIMILAR → textOnly` ·
> A(HOLD) · B(NO-GO) · 국내 REFERENCE 신설 · Search/가격 집계 구조 — **전부 변경 0**.

---

## 0. 결론

```
🟢 고친 것  등록 검증기의 재고 안내문이 셀러를 **없는 곳(Settings)** 으로 보내고 있었다
            → **상품정보 → 재고**(실제 칸 위치)로 고쳤다 · 운영 코드 **한 줄**
🔴 측정 정정 「등록 MISSING 7」 중 **5 는 운영 값이 아니다** — 하니스가 셀러 설정을 안 읽는다
🟡 운영에서 등록까지 남은 칸 **둘** — 둘 다 **셀러 입력** 이고 **코드 결함이 아니다**
🟢 재발 방지 계약 **8건** — 「안내문이 가리키는 곳이 실재하는가」를 **전수로** 본다
```

---

## 1. 실측 — 등록 게이트의 현재 상태

운영 함수 그대로(`WU_135_PROBE=1` · 실제 상품 `B226AC009`):
```
① 원상품 재추출   brand "Bobo Choses" · code B226AC009          🟢
② 저장 스냅샷     brand ""  ↔ 재추출 "Bobo Choses"               🔴 기존 스냅샷 brand 공백(WU-134 기록)
③ payload         name·brandName·salePrice 91,280·stock 999·대표이미지·상세 173자  🟢
④ validation      ok=false · 항목 36 · READY **28** · MISSING **7** · BLOCKED **0**
⑤ MI → 등록 생존  브랜드·상품명·대표이미지·상세정보·재고·판매가 **6/6**            🟢
```

### 1-A. 🔴 그 MISSING 7 중 5 는 **운영 값이 아니다**

WU-137 이 적어 둔 그 함정이다 — 하니스는 `resolveNaverContext`/`loadSellerSettings` 를 타지 않는다.
**운영 DB 를 직접 읽었다**(READ-ONLY · 쓰기 0):

| MISSING 항목 | 운영 DB 실측 | 판정 |
|---|---|---|
| `deliveryInfo.deliveryCompany` | `coupang_seller_profiles.naver_delivery_company_code` = **EPOST** | 🟢 운영에 있다 |
| `…notice.manufacturer` | `seller_settings.manufacturer` = **규하맘샵** | 🟢 있다 |
| `…notice.warrantyPolicy` | `seller_settings.quality_guarantee` ✓ | 🟢 있다 |
| `…notice.afterServiceDirector` | `seller_settings.as_company_name` = **규하맘샵AS** | 🟢 있다 |
| `…afterServiceTelephoneNumber` | `seller_settings.as_phone_number` ✓ | 🟢 있다 |
| `…notice.material` | 추출 실패 · 🟢 「상세페이지 참조」 경로 **있다**(`MissingFieldsBulkPanel`) | 🟡 셀러 1클릭 |
| `detailAttribute.optionInfo.optionCombinations` | `기본 재고 수량` 미입력 | 🟡 셀러 1칸 |

🔴 **그래서 「MISSING 7」을 「운영 차단 7건」으로 적지 않는다.** 운영에서 남은 것은 **둘** 이고
둘 다 셀러 입력이다. 🟢 재확인 도구를 커밋했다 —
`packages/database/scripts/stage5-seller-settings-probe.mjs` · `…/stage5-profile-probe.mjs`.

---

## 2. 🔴🔴 찾은 차단 — 안내문이 **없는 곳** 을 가리켰다

남은 두 칸 중 `기본 재고 수량` 쪽에서, 셀러가 받는 안내가 틀렸다.

```
전(틀림)  「… **Settings** 의 「기본 재고 수량」을 입력하면 조합이 복구됩니다」
🔴 실측    `apps/admin/src/app/settings` **전수** 에 `기본 재고`·`sellerDefaultStock` **0건**
🟢 실제 칸  상품정보 `SourceDataView` 의 「기본 재고 수량」(`onUpdateSellerDefaultStock`)
```

### 2-A. 🔴 그 문장은 **셀러 화면까지 간다** (LIVE · 추론이 아니다)

```
validate-payload.ts  reason
  → readiness.ts:258        hint = f.reason
  → readiness-state.ts:117  detail → :302 why
  → RegistrationStatusBanner.tsx:158  <p>{guide.why}</p>      ← 셀러가 읽는다
  (배너는 ChannelRegistrationFrame.tsx:141 에서 렌더된다)
```
🔴 그리고 같은 블록의 `where`(sectionId 유래)는 **다른 곳** 을 말했다 ⟹
**인접한 두 줄이 서로 모순** 이었고, 셀러는 **먼저 읽히는 `why`(= Settings)** 를 따라간다.

🟢 `S5-6`·`S5-7` 이 그 사슬을 **운영 함수 호출로** 단언한다(소스 grep 아님).

### 2-B. 🟢 수정 — 화면이 **이미 맞게 적고 있던 말** 로 통일

`PlatformPreview` 의 옵션 섹션은 처음부터 「**상품정보 → 재고**에서 기본 재고수량을 채우면
등록됩니다」라고 적고 있었다. 검증기를 그 말에 맞췄다.
```
운영 코드 변경 = **한 줄**(`packages/listing/src/naver/validate-payload.ts`)
🔴 판정 0 — `MISSING` 그대로 · 재고를 0/999 로 지어내지 않는다 · 점수/게이트 0
```

🔴 **목적지(sectionId)는 바꾸지 않았다** — `section-options` 는 실제로 그려지고(`PlatformPreview`
`sectionProps("section-options")`) 버튼이 동작하며, **그 섹션이 같은 말을 적고 있다**.
`SourceDataView` 에는 DOM id 가 **하나도 없어** 직접 앵커를 만들면 컴포넌트 경계를 넘는
새 메커니즘이 된다 ⟹ 범위를 넓히지 않았다(CPO §4·§8).

---

## 3. 🔵 재발 방지 — 「위치는 주석이 아니라 테스트가 지킨다」

🔴 **이 저장소에서 같은 버그가 7주 넘게 살아 있었다.** `readiness.ts` `naverFieldSectionId`
주석(2026-10-06 CEO 보고): 「바로가기가 기본정보로 보내는데 실제 입력 위치는 고시정보다」.
그 주석이 남긴 문장이 이번 계약의 설계다.

신설 `stage5-guidance-destination.test.ts` **8건**:
```
S5-1  재고 안내문이 **Settings 를 가리키지 않는다**
S5-2  🟢 그 칸이 **정말로** 상품정보에 있다(안내문만 고치면 또 거짓말이다)
S5-3  🔴 Settings 전수에 그 칸이 **없다**(옛 안내문이 틀렸던 이유 · 분모 확인)
S5-4  🟢 검증기와 화면 안내문이 **같은 곳** 을 가리킨다
S5-5  🔵🔵 **체계 가드** — 「Settings」를 가리키며 칸을 «인용한» 안내문 **전수**(현재 2건)가
      실제 Settings 소스에 있는지 본다 ⟹ 없는 곳을 가리키면 **FAIL**
S5-6  🔴 `reason` → `hint` 로 실려 간다(운영 함수 호출)
S5-7  🔴 그 `hint` 가 배너의 **`why`** 가 된다 — 셀러가 읽는 문장이다
S5-8  🟢 목적지 매핑은 바꾸지 않았다(`section-options` 유지 · 죽은 id 아님)
```
🟢 음성 대조 — 안내문을 Settings 로 되돌리면 **3 FAIL**(S5-1 · S5-4 · **S5-5**) → 바이트 복원
(`md5 c6dbab8d…` 동일).

---

## 4. 🟢 조사해서 「이상 없음」으로 닫은 것 (다시 조사하지 않는다)

```
Settings 실재     배송 프로필 · 브랜드 관리 · 판매자 정보(제조사·품질보증기준·A/S 3칸) 전부 있다
소재 해결 경로     「상세페이지 참조로 등록」 버튼이 있다(`MissingFieldsBulkPanel`)
등록 실패 응답     `step` · `retryable` · `resolution` 을 준다(채널별 오류코드 포함)
재시도/수정       SmartStore `editedFields` + **변경 확인 화면** · Coupang 단일 요청
                  🔴 LotteON 은 UPDATE 경로가 **없다**(capability UNKNOWN · 기존 기록)
등록 결과 표시     `RegistrationHistoryPanel`(성공/미리보기/실패 · 외부 상품번호 · 소요시간) ·
                  `markSnapshotRegistered` → 스냅샷 `REGISTERED`
가격 3층 분리      소싱원가(`cost.costKrw`) ↔ 권장 판매가(A) ↔ 최종 선택 가격
                  (`priceOverrideKrw` · `USER_EDITED`)은 **서로 다른 칸** 이다 🟢
후보 선택 → 등록   🔴 `candidate_reviews.human_verdict` 가 등록 payload 에 **안 들어가는 것은
                  설계** 다(WU-131 계약이 그것을 명시한다) ⟹ **건드리지 않았다**
```

---

## 5. 미해결 / 잔여 위험

```
⒜ 🔴 기존 스냅샷 **brand 공백** — 재추출은 "Bobo Choses" 를 내는데 저장분은 "" 다
   (WU-134 가 이미 기록 · 「새 상품 분석」을 다시 해야 채워진다) ⟹ 일괄 재추출은 하지 않았다
⒝ 🟡 시장 기반 추천가(B)는 **어디에도 저장되지 않는다** — 화면 근거 한 줄로만 선다
   (`recommended-price-copy` 가 그 경계를 의도적으로 적어 뒀다) 🔴 가격 구조라 손대지 않았다
⒞ 🔴 LotteON UPDATE 경로 **없음**(기존 상태 · 이번 범위 아님)
⒟ 🔴 실제 등록 실행은 하지 않았다 — 외부로 나가는 되돌리기 어려운 상업 행위이고
   §3 게이트상 CEO 승인 사안이다(그리고 CTO 는 로그인 세션을 쓸 수 없다)
⒠ 🔴 실제 따져 화면은 CTO 가 볼 수 없다 — 이번 증명 축은 **운영 함수 호출 + 계약** 이다
```

## 6. 내가 틀린 것 둘 (둘 다 사전 포착)

```
⒜ 🔴 `grep | sort -u | head -12` 가 잘려 「Settings 에 품질보증기준이 없다」는
   **거짓 결함을 하나 더 보고할 뻔했다** — 전수로 다시 보니 `<Field label="품질보증기준">` 이 있다
   ⟹ 🟢 `S5-5` 를 **전수 분모** 로 만든 이유가 이것이다(내 눈이 아니라 계약이 세게 한다)
⒝ 🔴 `buildPriorityItems` 에 인자를 **둘** 만 넘겼다 — 런타임은 통과했고 **typecheck 가 잡았다**
   (TS2554) ⟹ 「회귀 green」만으로 끝내지 않는 이유다
```
