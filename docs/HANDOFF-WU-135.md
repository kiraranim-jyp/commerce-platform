# 🟡 WU-135 — **원상품 → MI → 가격비교 → 등록 payload** 까지 연결됐다 (실등록은 STOP)

> 🔴 CPO 지시(2026-10-20): 「전략 변경 금지. 검증된 흐름을 **상품등록까지 연결**. MI 를
> 다시 뜯지 않는다. 중간 보고 금지 · 보고 1회. CEO Action 없음.」
>
> 🟢 **등록 «직전» 까지 전부 연결·실측됐다.** 🔴 **실제 등록(STEP 5/6)은 하지 않았다** —
> 막는 것이 **코드가 아니라 ⒜ 셀러 설정 7칸 ⒝ 실등록 승인/세션** 이고, 그 둘은 CTO 범위 밖이다.

---

## 1. STEP 1 — WU-134 baseline freeze

🟢 **새 테스트를 중복으로 만들지 않았다** — baseline 은 **이미 계약으로 잠겨 있다**:

```
wu-134-site-brand-recovery  16건  브랜드 복구의 «좁은 조건» 전수(A-1~8 · B-1~5 · C-1~3)
wu-134-live-origin           2건  실제 URL 배선 + 실제 경로 E2E(trueSAME 3 · falseSAME 0 · DIFF 3/3)
wu-132-mi-same-price-comparison 36건  SAME-only 가격비교 선별 + 영역 하나
🟢 그리고 **WU-135 E2E 가 그 값을 다시 고정** 한다 — `brand.value === "Bobo Choses"` 와
   payload 의 `brandName === "Bobo Choses"` 를 단언한다(사슬 양끝).
```
🔴 이 숫자들을 **개선 대상으로 다시 열지 않는다**(CPO STEP 1).

---

## 2. STEP 2 — 상품등록 경로 전수 조사 (코드 기준)

```
CommerceWorkspace
  → PLATFORM_ADAPTERS.smartstore.toListingModel(product, category, …)   ← ListingModel owner 하나
  → buildNaverProductPayload({ product, listing, …resolveNaverContext })
  → validateNaverPayload(payload, input, categoryRequiresChildCertification, compliance?)
  → POST /api/smartstore/register
      requireRegistrationAccess          ← 🔴 로그인 세션
      resolveNaverContext                ← 주소록·반품택배사·원산지·판매자프로필을 **매번 새로** 조회
      getNaverCredentials                ← 🔴 `commerce_accounts`(DB) 우선 · env 폴백
      issueNaverAccessToken → uploadNaverProductImages → callNaverApi(/v2/products)
      markSnapshotRegistered · linkChannelProduct · recordAuditLog
```

🟢 **자격증명/상태 실측(읽기 전용 · 값은 출력하지 않았다)**
```
commerce_accounts   naver  client_id ✅ client_secret ✅   ·  lotteon ❌/❌
coupang_seller_settings  1행
product_snapshots   543  (IN_PROGRESS 506 · **REGISTERED 37**)  ← 과거 실등록 이력이 있다
B226AC009 스냅샷    5건 (전부 IN_PROGRESS)
```
🔴 **새 Registry·새 Adapter·새 Payload 모델을 만들지 않았다**(CPO §3) — 전부 기존 함수다.

---

## 3. STEP 3·4 — MI → 등록 데이터 연결 + 운영 validation (실측)

🔴 **실제 상품 1개**: `B226AC009 Hug Hairy Monster T-shirt`(원상품 URL **해외** ·
`bobochoses.com/ko-kr/...`). WU-134 에서 실제 SAME + 가격비교가 발생한 그 상품이다.

```
① 원상품 재추출(실제 HTTP)   brand = **"Bobo Choses"** · code = B226AC009
② 저장된 스냅샷과 비교        저장분 brand = **""** ↔ 재추출 **"Bobo Choses"**
③ payload                    brandName **null → "Bobo Choses"**   ⟸ 복구가 등록 칸까지 닿는다
④ 운영 validation            ok=false · 항목 **36** · READY **28** · MISSING **7** · **BLOCKED 0**
⑤ MI → 등록 데이터 생존      브랜드 ✅ 상품명 ✅ 대표이미지 ✅ 상세정보 ✅ 재고 ✅ 판매가 ✅ (**6/6**)
```

🟢🟢 **정보 손실·오매핑 0** — CPO STEP 3 이 물은 것의 답이다.
🔴 **가격 정책은 한 글자도 바꾸지 않았다** — MI SAME 가격을 등록가로 덮어쓰지 않는다.

### 🔴 MISSING 7 은 전부 «셀러 설정/입력» 이다 (코드 결함 0)
```
deliveryInfo.deliveryCompany                     Settings > 배송 프로필(출고 택배사)
productInfoProvidedNotice(WEAR).material         원본/상세에서 미확인 → 「상세페이지 참조」 대체 가능
productInfoProvidedNotice(WEAR).manufacturer     등록화면 「제조사」 또는 Settings > 브랜드 관리
productInfoProvidedNotice(WEAR).warrantyPolicy   Settings > 판매자 정보(품질보증기준)
productInfoProvidedNotice(WEAR).afterServiceDirector  Settings > 판매자 정보(A/S 연락처)
detailAttribute.afterServiceInfo.afterServiceTelephoneNumber  Settings > 판매자 정보
detailAttribute.optionInfo.optionCombinations    Settings > 기본 재고 수량(옵션 조합 복구)
🟢 **BLOCKED 0** — 스키마 미확인·인증정보 때문에 막힌 것은 **없다**
```

---

## 4. 🔴🔴 STEP 5·6 — 실제 등록을 «하지 않았다» (사유를 정확히 적는다)

```
⒜ 🔴 **셀러 설정 7칸이 비어 있다** — 위 MISSING. 그 값은 **셀러/CEO 가 입력하는 사업
   데이터** 다(A/S 전화번호 · 품질보증기준 · 택배사 · 기본 재고). 🔴 CTO 가 지어내면
   그것이 그대로 **공개 상품의 신고 내용** 이 된다(헌장 §「payload 상수에는 근거가 있어야」).
⒝ 🔴 **실등록은 외부로 나가는 되돌리기 어려운 상업 행위** 다 — 라이브 스토어에 공개
   상품이 생긴다. 헌장 §12 가 「실등록은 STOP」을 유지 포인터로 두고 §3 이 사업적
   승인을 **CEO** 에게 둔다. 🔴 CPO 지시가 있었지만 **계정 소유자의 승인 사안** 이라
   CTO 가 임의로 실행하지 않았다.
⒞ 🔴 **기술적으로도 이 환경에서 호출할 수 없다** — `requireRegistrationAccess`(로그인
   세션)와 egress 프록시가 앞에 있고, CTO 는 Production 화면을 몰 수 없다
   (메모 `production-payload-is-unreachable`).
```
🟢 **그래서 남은 것은 코드가 아니다.** 등록을 막는 7칸이 **정확히 특정됐고** BLOCKED 는 0 이다.

---

## 5. STEP 7 — 회귀

```
회귀 **8,524 passed · failed 0** (skipped 140) · typecheck **0** · build **exit 0**
🟢 이번 WU 의 운영 코드 변경 **0** — 하니스/계약만 추가했다(등록 구조 재설계 금지 준수)
```

---

## 6. 🔴 남은 제한사항

```
⒜ 🔴🔴 **기존 스냅샷 543건은 brand 가 빈 채로 저장돼 있다**(WU-134 한계 그대로).
   등록 전에 **「새 상품 분석」을 다시 해야** 브랜드가 payload 에 들어간다.
   🔴 일괄 재추출(543회 외부 HTTP)은 **CTO 가 임의로 돌리지 않았다**
⒝ 국내 가격비교는 **여전히 0**(8축 CLOSED · 이번에 안 건드렸다)
⒞ 표본 **원상품 1개 · 채널 1개(SmartStore)** — lotteon 은 자격증명이 **없다**(DB 실측)
⒟ validation 컨텍스트(주소록·배송비)는 선례 하니스의 값을 썼다 — 실등록 시에는
   `resolveNaverContext` 가 **운영 값** 으로 다시 채운다(이 측정의 대상이 아니다)
⒠ 🔴 하니스에서 **칸 이름을 두 번 틀렸다** — `brandName`(실제는
   `detailAttribute.naverShoppingSearchInfo` 밑) · validation 배열(`checks`✗ → **`fields`**).
   🟢 둘 다 **「브랜드가 사라졌다」·「검사 항목 0」이라는 거짓 결론이 되기 직전에** 잡았다
```

---

## 7. 🟡 다음 — CEO/CPO 결정 둘 (CTO 가 고르지 않았다)

```
① **셀러 설정 7칸 입력** — Settings 에서 A/S 연락처 · 품질보증기준 · 출고 택배사 ·
   기본 재고 · 제조사(또는 브랜드 관리). 🟢 그 7칸이 채워지면 validation 이 ok 로 간다
② **실등록 승인** — 어느 상품을 어느 채널에 **실제로 올릴지**. 🔴 공개 상품이 생기는
   행위라 CEO 승인 사안이다
🟢 ①②가 열리면 CTO 가 할 일은 **등록 실행과 결과 확인** 이고 코드 작업은 없다
```

🔴 **CEO Action 은 CPO 가 정리해 한 번에 전달한다**(§3 — CTO 가 CEO 에게 직접 요청하지 않는다).
