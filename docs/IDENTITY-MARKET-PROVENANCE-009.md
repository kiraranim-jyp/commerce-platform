# WU-009 — Identity / Market Provenance Integrity

> 🔴 외부 AI API **0** · Gemini **0** · 검색 API **0** · 새 AI Discovery **0** ·
> Registry 확대 **0** · 새 판매처 수집 **0** · 가격 환산 **0** · WU-007A 롤백 **0** ·
> 임계값 완화 **0** · DB 쓰기 **0** · schema **0** · **Production 배포 0** · 비용 **₩0**.
>
> 🔴🔴 **A·B 의 전제가 측정으로 바뀌었다.** 그래서 네 항목의 결과가 다르다:
> ```
> A 브랜드 공백       🔴 **전제 반증** — 상품 데이터에 브랜드가 «없다». 구현하면 추정이 된다
> B low 후보 처리     🟢 **이미 구현돼 있다** — 측정으로 확인. 남은 부분은 노출을 «늘리는» 것
> C 스냅샷 URL 정규화  🟢 **구현 완료** (안전한 절반) · 🔴 중복 병합은 제품 정책이라 제외
> D 시장 표시         🔴 **미구현** — 아래 §4 의 이유로 CPO 결정이 먼저다
> ```

---

## 1. 🔴🔴 A — 브랜드 공백: **원본에 브랜드가 없다**

지시서는 「원본에서 **이미 추출 가능한** 브랜드를 체인에서 잃어버리지 않도록」이었다.
🔴 **그 전제를 먼저 측정했고, 반증됐다.**

### 실측 (무키 GET · `B226AC117`)

```
bobochoses.com /products/b226ac117-….json   vendor = **"AW26"**
bobochoses.co.jp/products/b226ac117-….json  vendor = **"AW26"**
product_type = "Outerwear" · title = "B.C. Embossed tracksuit jacket"
variants[0].sku = "B226AC11742101" · tags = aw26, branded, children, clothing, …
```

상품 상세 HTML(875,913 bytes)의 구조화 데이터:
```
JSON-LD  Product.brand = { "@type":"Brand", "name": **"AW26"** }   ← 같은 값
🟢 og:site_name        = **"Bobo Choses"**                        ← 여기에만 있다
```

### 🔴 그래서 「잃어버린다」가 아니라 「**페이지가 그렇게 적어 뒀다**」 다

```
🟢 현재 동작(브랜드를 비우고 AW26 을 브랜드로 쓰지 않는 것)은 **옳다.**
   `brand-resolver.ts`(SEASON_CODE_PATTERN `/\b(?:SS|AW|FW|SU|WI)\d{2}\b/`)가
   시즌 코드를 브랜드로 승격하지 않도록 **이미 막고 있다.**
```

### 🔴🔴 `og:site_name` 을 브랜드로 쓰면 **안 된다** — FP 가 더 커진다

```
og:site_name 은 **사이트 이름** 이고 상품의 브랜드가 아니다.
브랜드 자기 스토어에서는 둘이 우연히 같지만, 멀티브랜드 리테일러에서는 **판매처 이름** 이다.
🔴 우리 26개 상품의 원본 도메인 전수:
     smallable.com 9 · tennis-warehouse.com 9 · junioredition.com 6 ·
     designerkidswear.com 1 · foretforet.com 1
   → **26건 중 25건이 멀티브랜드/리테일러** 다. 그 전부에 「Smallable」·「Junior Edition」이
     브랜드로 박힌다 → 브랜드 축이 **거짓 일치/거짓 충돌** 을 만든다.
🔴 CPO 가 최상위 KPI 로 둔 False Positive 를 **키우는** 변경이다. 그래서 하지 않았다.
```

### 🟡 CPO 결정이 필요한 선택지 (CTO 가 고르지 않았다)

```
⒜ 「브랜드 미확인」을 **상태로 노출** 하고, 브랜드 없는 상품은 국내 후보 탐색을
   **시도하지 않는다**(WU-014 의 `NO_PRIMARY_QUERY` 선례와 같은 모양).
   🟢 가장 안전하고 FP 를 0 으로 유지한다. 🔴 그 상품은 Discovery 가 멈춘다.
⒝ **공식몰 도메인 → 브랜드** 표를 둔다(bobochoses.com → Bobo Choses).
   🔴 Registry 성격의 데이터라 「Registry 확대 금지」와 만난다 → CPO 판단.
⒞ 브랜드 공백을 그대로 두고 **후보를 저장/노출하지 않는** 현 동작 유지(= 현재 상태).
🔴 ⒝ 를 CTO 가 임의로 만들지 않았다.
```

---

## 2. 🟢 B — low 후보: **이미 구현돼 있다** (측정으로 확인)

CPO 요구 셋을 코드 경로와 1:1 대조했다.

```
요구 ① low → 동일상품 후보/가격 계산에서 제외
  🟢 **이미 그렇다.** `judgeDomesticCandidate` 가 DROPPED / `NOT_MATCHED` 를 내면
     run-domestic-price-check.ts:1087·1106 의 `continue` 가 **upsert 앞에서** 끊는다.
요구 ② low 가격을 판매판정/최저가/대표가격에 쓰지 않는다
  🟢 **이미 그렇다.** 저장되지 않으므로 tier 계산에 들어갈 수 없고, 돈은 EXACT 버킷에서만
     움직인다(price-history.ts:644).
  🟢 실측 확증(WU-008): `B226AC117` 의 국내 링크 **0건** · 후보 5건 전부 low.
요구 ③ 필요하면 「검색 참고 후보」로 별도 표시
  🔴 **하지 않았다.** 화면의 후보 목록은 `/api/domestic-price-sources/links` =
     **DB 링크** 를 읽는다(Panel:1842). low 는 저장되지 않으므로 **지금은 아예 안 보인다.**
     → 「참고 후보」를 추가하는 것은 **노출을 늘리는** 변경이고, CEO 가 지적한
        「무관한 상품이 보인다」를 **악화** 시킨다. 🔴 그래서 CPO 확인 없이 하지 않았다.
```

🔴🔴 **그리고 여기서 중요한 미확인이 하나 생긴다** — low 가 저장도 표시도 되지 않는데
CEO 는 무관한 상품을 봤다. 즉 **그 노출의 출처가 후보 목록이 아니다.** 🔴 어느 화면·어느
구역인지는 **CTO 가 확인할 수 없다**(로그인 뒤 · 메모 `production-payload-is-unreachable`).
→ 🔴 **출처를 모르는 상태에서 UI 를 고치면 엉뚱한 곳을 고친다.**

---

## 3. 🟢 C — 스냅샷 URL 정규화: **구현 완료** (안전한 절반)

### 무엇을 고쳤나
```
packages/crawler/.../self-reference.ts   신규 순수 함수 `canonicalizeProductUrl`
apps/admin/.../snapshots/_lib/snapshot.ts  `saveSnapshot` 진입에서 1줄 적용
```
```ts
const input = { ...inputRaw, sourceUrl: canonicalizeProductUrl(inputRaw.sourceUrl) };
```

### 🟢 새 규칙을 만들지 않았다
제거 대상은 그 파일이 **이미 갖고 있는 두 집합** 뿐이다 —
`NON_IDENTIFYING_PARAMS`(utm_* · fbclid · gclid · igshid · srsltid · search · sort ·
xcode/mcode/scode · gfdt) + `isShopifyContextParam`(밑줄로 시작하는 Shopify 문맥).

### 🔴 합치지 않는 것 (CPO 제약 그대로)
```
host  유지 — `.co.jp` ↔ `.com` 은 **다른 스토어**
경로  유지 — `/en-kr/products/X` ↔ `/products/X` 는 **다른 시장**
그 외 파라미터 유지 — `?variant=` · `?product_no=` · `?branduid=`
🔴 대소문자·끝 슬래시·파라미터 순서도 **건드리지 않는다**(저장용 URL 은 열려야 한다).
🔴 제거할 것이 없으면 **입력 문자열을 그대로** 돌려준다 — 재직렬화로 기존 행과 어긋나지 않게.
```

### 🔴🔴 하지 않은 것 — **중복 병합**
`saveSnapshot` 은 URL 로 기존 스냅샷을 **찾지 않고 항상 insert** 한다(snapshot.ts).
그래서 정규화만으로 기존 13건이 합쳐지지도, 새 중복이 **원천 차단** 되지도 않는다.
🔴 병합은 **제품 정책** 이다 — 두 분석을 한 스냅샷으로 합치면 **셀러가 각각 편집한 내용이
섞인다**. 그리고 기존 13건을 어떻게 처리할지(보존/병합/정리)도 같이 결정해야 한다.
🟢 **정규화로 얻는 것**: 앞으로 `?utm_source=` 류 때문에 같은 URL 이 갈라지지 않는다
(실측 중복의 직접 원인이 그것이었다).

### 테스트 9건 + 음성 대조 2종
```
🟢 `?utm_source=chatgpt.com` 만 다른 두 URL 이 **같아진다**(실측 fixture 그대로)
🟢 추적 5종 · Shopify 밑줄 4종 제거 · 혼합 쿼리 선별
🔴 host 를 합치지 않는다 · 🔴 `/en-kr/` 을 떼지 않는다 · 식별 파라미터 보존
🟢 제거할 것 없으면 입력 그대로 · 열 수 없는 입력 통과(저장을 막지 않는다)
M1 「항상 재직렬화」        → **1 FAIL**
M2 「쿼리 전체 삭제」(과잉)  → **3 FAIL**   ← 더 많이 지우는 잘못된 수정도 막는다
원상복구 **9 passed** · 소스에 `MUTATION` 0건
```

---

## 4. 🔴 D — 시장 표시: **미구현** · 이유를 적는다

🟢 **데이터는 이미 있다**(WU-008 실측): 관측이 `source` + `market_code` + `currency` +
`price_krw` 로 저장되고, `.com` 스냅샷은 `en-kr: KRW 258,000` 을 **전건** 갖고 있다.

🔴 **그런데 지금 UI 를 바꾸지 않았다. 이유 셋**:
```
① §2 의 미확인 — CEO 가 본 노출의 **출처 화면을 모른다.** 후보 목록은 DB 링크 기반이고
   그 상품의 링크는 0 이다. 출처를 모르고 고치면 엉뚱한 구역을 고친다.
② 🟢 「환율 환산이 아니다」류 표시가 **이미 일부 있다**(price-hierarchy.ts:453 ·
   `costBasisIsKrMarket`). D 를 새로 만들기 전에 **그 구역과의 관계** 를 CPO 가 정해야
   중복·모순 문구가 생기지 않는다.
③ 「KR 시장 가격: 확인되지 않음 / 사유: 해당 스토어에 KR 시장 없음」을 적으려면
   **「시장 부재」와 「아직 안 봤다」를 구분하는 상태** 가 필요하다. 🔴 현재 관측 테이블에는
   「probe 했고 404 였다」를 기록하는 칸이 없다 — 행이 **없는 것** 으로만 남는다.
   → 그 구분 없이 「KR 시장 없음」을 적으면 **미관측을 부재로 단정** 하게 된다(§5-B 위반).
```
🟡 **CPO 결정 요청**: ①의 화면 출처 확인(CEO 1문: 「무관한 상품이 어느 구역에 보였는가」)
과 ③의 상태 모델(「시장 부재」를 기록할 것인가)을 받으면 D 는 바로 구현 가능하다.

---

## 5. 필수 회귀 fixture — CPO 지정표 대조

| 요구 | 상태 |
|---|---|
| JP original → ¥26,400 / JPY / ORIGINAL | 🟢 WU-008 하니스가 실측값으로 고정 |
| Global `.com` → €120 / EUR / ORIGINAL | 🟢 동일 |
| KR `.com/en-kr` → ₩258,000 / KRW | 🟢 동일(전건 보유 단언) |
| JP store + `/en-kr` → 404 → KR 관측 없음 | 🟢 동일(`.co.jp` 전건 en-kr 0 단언) · 🟢 404 는 §1 실측 |
| `Bobo Choses` + 품번 → 브랜드가 query 에 살아있음 | 🔴 **불가** — §1 로 전제 반증(브랜드가 원본에 없다). 🟢 대신 「검색어 전수에 브랜드가 없다」를 **현재 사실로 고정** |
| looxloo 무관 상품 → low → 가격/판정 영향 0 | 🟢 WU-008 하니스가 고정 |
| `utm_source=A/B` → 동일 canonical | 🟢 **WU-009 C 테스트가 고정** |
| JP / Global / KR → 시장별 보존 | 🟢 **WU-009 C 테스트가 고정**(host·로케일 미병합) |

## 6. 검증
```
WU-009 C 테스트  **9 passed** · 음성대조 M1 1 FAIL · M2 3 FAIL → 복구 9 passed
회귀 admin       (§본문 보고 참조) · typecheck baseline 10 대조 · build exit 0
운영 변경        self-reference.ts(+순수 함수 1) · snapshot.ts(import+1줄) ·
                 index.ts(export 1단어) — 그 외 운영 파일 0
🔴 Production 배포 0 — 브랜치로만 민다
```
