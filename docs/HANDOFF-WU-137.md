# 🔴🔴 WU-137 — **실등록 전에 치명적 결함 하나를 찾았다** (등록은 CEO 화면에서)

> 🔴 CPO 지시(2026-10-20): 「분석을 더 잘 만드는 것이 아니라 **분석 결과로 실제 상품을
> 등록하는 것**. STEP 2 에서 문제가 생기면 **등록으로 넘어가지 말고 원인 확정 → 최소
> 수정 → 재검증.**」
>
> 🔴🔴 **STEP 2 에서 문제가 났고, 그것이 등록을 막는 결함이었다.** 그래서 CPO 지시대로
> 멈추고 고쳤다. 🟡 실등록 자체는 **CEO 화면 작업** 으로 남는다(§7 · 사유는 §5).

---

## 1. 🔴🔴🔴 STEP 2 에서 찾은 것 — **WU-134 가 운영에서 한 번도 발화하지 않았다**

CPO 의 STEP 2 는 「새로 분석 → 브랜드 = `Bobo Choses` 확인」이다. 🔴 **그 전제가 거짓이었다.**

```
DB 실측 (product_snapshots · source_url ilike '%b226ac009%')
  스냅샷 16건 · brand **16/16 전건 ""**
  🔴 그중 **오늘 20시** 분석도 "" 다 — WU-134 배포는 **18:24 KST** 였다
```

### 원인 — 빠른 경로가 칸 하나를 버린다

```
universalExtract (/api/pipeline 이 부르는 함수)
  → tryFastPath(universal-extractor.ts:143)
      productData 를 **칸 하나씩 손으로** 옮긴다
      🔴 그 목록에 `siteBrandName` 이 **없었다**
  → buildCanonicalProduct 가 그 칸을 못 봐서 거부된 `vendor = "AW26"` 를 복구 못 함
  ⟹ brand = ""
```

🔴🔴 **원인의 원인은 내 테스트 설계다 — WU-110 이 기록한 그 함정의 재발:**
WU-134 의 라이브 테스트가 `shopifySiteStrategy.extract` 를 **직접** 불러
「**전략은 채운다**」까지만 증명하고 **라우트가 실제로 쓰는 경로를 보지 않았다.**

🟢 느린(Playwright) 경로는 `extractProductData` 를 그대로 쓰므로 **영향이 없었다** —
🔴 **Shopify 스토어만 빠른 경로를 타서 브랜드 공식몰이 정확히 그 구멍에 빠졌다.**

---

## 2. 🟢 수정 — **1줄** · 계약 5 · 음성대조 1

```
packages/crawler/src/universal-extractor.ts
  + siteBrandName: siteResult.productData.siteBrandName,

🟢 `productDataSources` 는 **바뀌지 않는다** — `buildSiteStrategySources` 가
   `siteResult.productData`(원본)를 받으므로 그 칸은 이미 반영돼 있었다
🔴 브랜드를 **여기서 정하지 않는다** — 복구 판단은 `canonical-product` 소관이다(계약 A-2)
```

**계약**(`wu-137-fast-path-brand-wiring` · 네트워크 0)
```
A-1 그 리터럴 «안» 에서 siteBrandName 을 옮긴다
A-2 이 경로에 브랜드 규칙 어휘가 **없다**(resolveBrandName · extractSiteBrandName · og:site_name)
A-3 🔴 전략이 채우는 칸 전수가 여기에도 있다 — **이번 버그가 정확히 그 모양이었다**
A-4 느린 경로는 추출기를 그대로 쓴다  ·  A-5 타입에 그 칸이 선언돼 있다
```
🟢 음성대조 **M11**(그 줄 제거) **1 FAIL → 복구 PASS**.

### 🟢🟢 운영 경로 실측 (라우트와 **같은 함수**)
```
universalExtract(ORIGIN)
  brand(vendor)   "AW26"
  siteBrandName   **"Bobo Choses"**     ⟸ 전까지 여기서 사라졌다
buildCanonicalProduct → canonical brand **"Bobo Choses"** (confidence 0.95)
```

---

## 3. 🔴 WU-135 의 「셀러 설정 7칸이 비어 있다」를 **정정한다**

DB 실측(`seller_settings` · scope_key=default · 쓰기 0):
```
🟢 이미 있다 — manufacturer 「규하맘샵」 · as_company_name 「규하맘샵AS」 ·
   as_phone_number · quality_guarantee · as_contact_number
🔴 WU-135 의 그 숫자는 **하니스가 설정을 안 읽은** 값이었다 —
   운영 `resolveNaverContext` 는 `loadSellerSettings()` 를 부른다
🟢 그리고 **브랜드 복구가 고시 `manufacturer` 칸도 같이 닫는다** —
   `resolveManufacturer` 가 「브랜드 프로필 → 상품 브랜드」로 폴백하고
   `coupang_brand_profiles` 는 **0행** 이다(실측)
```

---

## 4. 🔴🔴 측정불가 — **그 validation 숫자를 운영 값으로 쓰지 않는다**

```
운영 컨텍스트 owner = `resolveNaverContext` 이고 그 함수는
  ⒜ 실제 Naver API(토큰·카테고리·반품택배사·원산지)
  ⒝ `loadSellerSettings()` — **service-role 키 필요**(로컬에 없다)
  ⒞ **해결된 leaf 카테고리** 로 고시 타입 결정
🔴 CTO 하니스는 ⒜⒝를 쓸 수 없고 ⒞ 를 `UNRESOLVED_CATEGORY` 로 둔다
⟹ 하니스의 「READY 28 · MISSING 7 · BLOCKED 0」은 **운영 값이 아니다**
🔴 설정 세 칸(품질보증·A/S 책임자·A/S 전화)을 넣어도 MISSING 에 **남았고**
   그 원인(카테고리 미해결 ↔ 배선)을 이 세션에서 **가르지 못했다** —
   「운영에서도 비어 있다」로 **적지 않는다**
🟢 BLOCKED 는 **0** 이다(스키마·자격증명 결함 없음 — WU-135 와 같다)
```

---

## 5. 🔴🔴 실등록(STEP 6)을 CTO 가 하지 못한 이유 — **기술적 사유 하나**

```
🔴 `/api/smartstore/register` 앞에 **`requireRegistrationAccess`(로그인 세션)** 가 있고
   CTO 는 Production 브라우저를 몰 수 없다(메모 `production-payload-is-unreachable`).
🔴 그 가드를 우회하는 route 를 만드는 것은 **외부로 공개 상품을 만드는 경로를 인증
   없이 여는 것** 이라 하지 않았다(§10 의 1회용 토큰은 **debug/probe** 용이다).
🟢 그래서 남은 것은 **화면에서 버튼 한 번** 이고 코드 작업이 아니다.
```

🔴 **그리고 이번 WU 가 그 한 번을 의미 있게 만들었다** — 수정 전에 등록했다면
**브랜드가 빈 상품이 스마트스토어에 공개됐다.**

---

## 6. 🟢 검증

```
계약 신규 **6**(배선 5 + 운영 경로 readiness 1) · 음성대조 **M11 FAIL → 복구**
회귀 **8,573 passed · failed 0** (skipped 142) · typecheck **0** · build **exit 0**
배포 `1137e96` → Production **Ready** · 빌드 로그 `Commit: 1137e96` · root **200**
작업트리 clean · ahead 0 / behind 0
```

🔴 **하니스를 세 번 틀렸고 셋 다 적는다**
```
⒜ `product.title` 을 문자열로 가정했다 — **객체** 다(brand 와 같은 모양)
⒝ validation 칸을 `state`/`label` 로 읽어 **MISSING 목록이 빈 채로 출력** 됐다.
   실제는 `{ field, status, reason }`(validate-payload.ts:57)
   🔴 그대로 보고했으면 **「남은 칸이 없다」는 거짓 결론** 이었다
   🟢 **목록 길이 == `missingCount`** 단언을 넣어 재발을 막았다
⒞ 4번째 인자에 `r.images` 를 넣었다 — 실제 `WorkspaceItem[]` 이고
   🟢 **typecheck 가 잡았다**(WU-135 의 `[]` 가 처음부터 맞았다)
```

---

## 7. 🟡 CEO Action — **실등록 1건** (순서는 기존 문서 그대로)

🔴 **반드시 「새 상품 분석」을 다시 한다** — 저장된 16건은 **전부 brand=""** 이고,
🟢 이번 수정은 **새 추출에만** 적용된다.

```
① https://ttaejyo.vercel.app/pipeline
   → https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt
   → **새 상품 분석**
② 분석 후 **브랜드가 「Bobo Choses」인지** 먼저 본다   ← 🔴 이번 수정의 확인 지점
   (비어 있으면 거기서 멈추고 알려 주십시오 — 원인 확정은 CTO 가 합니다)
③ ② 시장 판단 → 📊 시장 판매 판단 확인(WU-136)
④ 상품정보 — 소재 · 기본 재고수량
⑤ ③ 등록 준비 → 스마트스토어 선택 → [등록 준비 확인]
   🔴 **누락이 0 이 아니면 그 칸 이름이 화면에 그대로 적혀 있습니다** — 그것만 채웁니다
   🔴 **값을 임의로 만들지 않습니다**(그 값이 공개 상품의 신고 내용이 됩니다)
⑥ ④ 커머스 등록 → [선택한 커머스 등록] → 최종 승인
⑦ 등록 후 — 상품번호 · 스마트스토어에서 **브랜드 Bobo Choses** · 이미지 · 가격 ·
   재고 · 옵션 · 고시정보(소재·제조사·품질보증·A/S) · 상세정보
```

🔴 **문제가 나면 그 화면을 그대로 알려 주시면 됩니다** — 재현 → 원인 확정 → 최소 수정은
CTO 가 합니다. 🔴 대표님이 원인을 찾거나 코드를 보실 필요는 없습니다.

---

## 8. 🔴 남은 Known Unknowns

```
⒜ 🔴 운영 validation 의 실제 MISSING 수 — **CTO 하니스로 측정 불가**(§4).
   ⑤ 화면이 그 답을 직접 보여준다
⒝ 🔴 「설정 세 칸을 넣어도 MISSING 에 남는다」의 원인 — 카테고리 미해결인지
   배선인지 **가르지 못했다**. ⑤에서 그 셋이 남으면 그때 추적한다
⒞ 🔴 기존 스냅샷 **16건(B226AC009) · 543건(전체)** 은 brand 가 빈 채로 저장돼 있다 —
   일괄 재추출은 **CTO 가 임의로 돌리지 않았다**(CPO §13 금지)
⒟ 🔴 실제 스마트스토어 등록 결과는 **아직 없다** — 「Production API PASS」로 적지 않는다
```
