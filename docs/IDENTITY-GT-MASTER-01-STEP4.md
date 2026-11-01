# IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 — Step 4 (70후보 raw evidence · A/B/C/D)

> 🔴🔴🔴 **이 문서의 세 숫자는 Step 5 에서 정정됐다 — 그쪽이 이긴다**
> (`docs/IDENTITY-GT-MASTER-01-STEP5.md`):
> ```
> ① blocker 증거 비율 13/18 → **15/18**
>    (`SAME_SELLER_DISTINCT_LISTING` 의 입력은 **URL(host+slug)** 이고 `sellerSku` 가
>     아니다 — 그 함수는 sellerSku 를 **0회** 쓴다 · cross-seller.ts:762 전수 확인)
> ② `composition` 행 — 🔴 **운영과 다른 개념을 쟀다.** 운영 `COMPOSITION_PATTERN` 은
>    **「세트 구성(pack/set/bundle/kit)」** 이고 내 reader 는 **「소재 조성(100% cotton)」**
>    이었다 ⟹ 「51/51 제목 미포함 ⟹ 그 축이 발화 못 한다」는 문장을 **폐기** 한다
>    (그 축은 **드물게 발화하도록 설계** 됐고 발화 0 은 정상이다)
> ③ SAME-FN 원인 — `kihanan.com` 은 「증거를 갖고 판단」이 아니라 **원상품측 brand 공백**
>    이다(후보 brand 는 `A`)
> ```
> 🟢 나머지(필드별 A/B/C/D · B 3분할 · FP 0/8 · REVIEW 10 · GT conflict 4)는 **유효하다**.

> 🔴 **측정만 했다.** 운영 코드 변경 **0** · 배포 **0** · DB 쓰기 **0** · 정책 결정 **0**.
> 🔴 **분모 LOCK 유지** — 공식 **80**(생성기 행) · 보조 **70**(고유 (상품,URL)).
> 🔴 CPO §7 금지 전수 준수 — threshold · `SAME_MIN_AXES` · blocker 삭제 · 새 점수축 ·
> Search provider/query · candidate cap · price eligibility · UI · Registry · DB 데이터 ·
> CEO GT · 공식 분모 80→70 **전부 변경 0**.

```
기준점   172f1298 (Step 3 CLOSED) → Step 4
하니스   apps/.../__tests__/gt-master-step4.test.ts        계약 4 + LIVE 1
분류기   apps/.../__tests__/gt-master-step4-fields.ts      🔴 **분류 전용**(운영 격리 계약)
산출     docs/identity-gt-master/STEP4-EVIDENCE.json       70행 × 17필드 전수
         docs/identity-gt-master/STEP4-TABLE.md            CPO §6 전수표
게이트   GTM4_LIVE=1 (없으면 LIVE SKIP · 회귀에서 외부 HTTP 0)
```

---

## 0. 🔴🔴🔴 측정 전에 확정한 구조 — 이것이 Step 4 의 전제다

### 0-1. 조사 필드 17 ↔ 수집 칸 — **1:1 이 아니다**

```
EvidenceSource          = TITLE | DESCRIPTION | IMAGE   🔴 **구조화 데이터가 출처가 아니다**
IDENTITY_EVIDENCE_AXES  = BRAND · MODEL_CODE · PRODUCT_NAME · FORM · COLOR · MATERIAL
PROBE_EVIDENCE_AXES     = FIT · COMPOSITION · SET · OPTION_SKU · IMAGE  (관측 전용)
```

🔴 **수집 칸이 아예 없는 필드 셋** — `composition` · `season` · `collection`
⟹ 사이트에 있어도 **구조적으로 `A` 가 될 수 없다**. 🔴 이것을 모르고 「사이트에 없다(C)」로
적으면 CPO §2 의 금지를 어긴다.
🔴 **비교(판정)에 들어가지 않는 필드 넷** — `description` · `season` · `collection` · `image`
⟹ 이 넷이 `B` 여도 **Identity 결함으로 셀 수 없다**.

### 0-2. 🟢 이름이 같고 owner 가 둘인 함정 하나를 확정했다

```
ProductEvidence["FIT"] · ["COMPOSITION"]   PROBE 축 — 「판정에 넣지 않는다」(그 파일 주석)
ProductFacts.fitText                        🔴 compareFit(cross-seller.ts:673)이 **읽는다**
                                               ⟹ blocker FIT 이 발화한다
```

⟹ 🟢 Step 3 의 `SAME-FN blockers: FIT 4` 는 **계약 위반이 아니다.** 🔴 두 축을 같은
이름으로 섞어 읽으면 틀린 결론이 난다.

🟢 그리고 `cross-seller.ts` 의 **제어문자 0** 을 실측했다 — grep 의 `binary` 판정은
오탐이고 **WU-078 함정이 아니다**.

---

## 1. ① 필드별 A/B/C/D (분모 70 · 셀 1,190)

| 필드 | A | B | C | D | 비교입력 | 수집 칸 |
|---|---:|---:|---:|---:|:---:|---|
| brand | **52** | 2 | 10 | 6 | 🟢 | `brand` |
| modelCode | 27 | 0 | **37** | 6 | 🟢 | `brandModelCode` |
| title | 58 | 6 | 0 | 6 | 🟢 | `title` |
| description | 53 | 9 | 2 | 6 | — | `description` |
| category | 49 | 0 | 15 | 6 | 🟢 | `categoryText` |
| color | 36 | 3 | 25 | 6 | 🟢 | `colorText` |
| material | 35 | 2 | 27 | 6 | 🟢 | `materialText` |
| composition | **0** | **51** | 13 | 6 | 🟢 | 🔴 **없음** |
| fit | 18 | 5 | 41 | 6 | 🟢 | `fitText` |
| size | 46 | 1 | 17 | 6 | 🟢 | `sizeLabels` |
| age | **0** | 20 | 44 | 6 | 🟢 | `ageRangeText` |
| audience | 51 | 12 | 1 | 6 | 🟢 | `audienceSignals` |
| season | **0** | 27 | 37 | 6 | — | 🔴 **없음** |
| collection | **0** | 46 | 18 | 6 | — | 🔴 **없음** |
| sellerSku | **0** | **40** | 24 | 6 | 🟢 | `sellerSku` |
| image | 55 | 6 | 3 | 6 | — | `imageUrls` |
| price | 56 | 0 | 8 | 6 | — | (candidate) |

🔴 `D` 가 전 필드 **6** 으로 같다 — 후보 **6건**의 페이지를 열 수 없었다(아래 §6).

---

## 2. ⑦ 🔴🔴 crawler missing ↔ site missing — **B 를 세 종류로 갈라야 한다**

```
A 수집됨 536 · B 230 · C 322 · D 102     (셀 1,190)
```

🔴🔴 **1차 분석이 거짓 결론 직전이었다** — `B 230` 을 한 덩어리로 보고 ⑨(「증거가 없어
보류」)를 세니 **구조적으로 0** 이 나왔다. `composition` 이 거의 모든 행에서 `B` 라
⑧을 오염시킨 것이다. 🟢 그래서 **세 종류로 갈랐다**:

| 종류 | 건수 | 의미 |
|---|---:|---|
| **B-STRUCT** | **73** | `season`·`collection` — 칸도 없고 **비교도 안 된다** ⟹ Identity 와 무관 |
| **B-DERIVED** | **51** | `composition` — 칸은 없지만 **비교 시 제목에서 즉석 추출** 된다 |
| 🔴 **B-FAIL** | **106** | 칸이 **있는데** 못 가져왔다 = **진짜 수집 실패** |

B-FAIL 분해 — `sellerSku 40` · `age 20` · `audience 12` · `description 9` ·
`image 6` · `title 6` · `fit 5` · `color 3` · `material 2` · `brand 2` · `size 1`.

### 🔴🔴 그 안에서 가장 센 신호 둘

```
① 칸이 있는데 A 가 **0/70** 인 필드 — **age**(`ageRangeText`) · **sellerSku**(`sellerSku`)
   ⟹ 그 둘은 **한 번도 채워지지 않는다**. B 20 · 40 은 사이트가 말하는데 못 가져온 것이다
② 🔴 **composition 은 제목에 있는 경우가 51건 중 «0» 이다**
   운영 `COMPOSITION_PATTERN` 은 **제목만** 본다(cross-seller.ts:482) ⟹
   51곳 전부 **본문에만** 조성이 있어 그 축이 **구조적으로 발화할 수 없다**
   🟢 실측 정합 — 이번 70후보에서 `COMPOSITION` conflict **발화 0**
```

🔴 **고치지 않았다** — Step 4 는 측정만 한다(CPO §7).

---

## 3. ② CEO SAME 34(고유) 의 evidence coverage

| 필드 | A | B | C | D |
|---|---:|---:|---:|---:|
| brand | 28 | 2 | 3 | 1 |
| modelCode | 12 | 0 | **21** | 1 |
| title | 31 | 2 | 0 | 1 |
| category | 27 | 0 | 6 | 1 |
| color | 17 | 2 | 14 | 1 |
| material | 17 | 1 | 15 | 1 |
| composition | 0 | 25 | 8 | 1 |
| fit | 8 | 4 | 21 | 1 |
| size | 25 | 0 | 8 | 1 |
| age | 0 | 9 | 24 | 1 |
| audience | 28 | 5 | 0 | 1 |
| sellerSku | 0 | 22 | 11 | 1 |

🔴🔴 **CEO 가 SAME 이라 한 후보의 `modelCode` 가 21/34 에서 «사이트에 아예 없다»**(C).
⟹ 🟢 그러므로 「품번으로 SAME 을 확정한다」는 경로는 **이 분모의 62% 에서 입력이 없다**.
🔴 그것이 「MODEL_CODE 축을 완화하라」는 뜻이 **아니다** — 입력이 없으면 완화해도 0 이다.

---

## 4. ③ SAME-FN 12 / 23 — **전수 원인 추적** (CPO P0)

전수는 `STEP4-TABLE.md` 와 `STEP4-EVIDENCE.json` 에 있다. 요약:

```
FN 의 모양   TEXT_CONFIRMED / PRESUMED_SAME **9** · CONFLICT / CONFLICT 2 · CONFLICT / PRESUMED_SAME 1
blockers     FIT 4 · BRAND_UNCONFIRMED 3 · MODEL_CODE_AGE_LINE 2 ·
             BRAND_MISMATCH 1 · NO_TITLE_OVERLAP 1 · SAME_SELLER_DISTINCT_LISTING 1
🔴 blockers 가 **아예 없는 FN 3건** — cissywears.com(P-02) · cemarose.ca(P-02) · rboutique.com(P-03)
   + bobochoses.com(P-03) ⟹ 🔴 **보호축이 아니라 축 수 부족** 쪽이다(CPO 가 지목한 그 셋)
🔴 CEO SAME 인데 **미도달 11건** — 공급 축이고 **Identity 오판이 아니다**(합쳐 세지 않는다)
```

### 🔴🔴🔴 가장 중요한 표 — blocker 축 × **그 축의 증거가 사이트에 있었나**

| blocker → 축 | 건 | A | B | C | D |
|---|---:|---:|---:|---:|---:|
| `BRAND_UNCONFIRMED` → brand | 5 | 2 | **1** | **2** | 0 |
| `FIT` → fit | 4 | **4** | 0 | 0 | 0 |
| `AUDIENCE_LINE` → audience | 2 | 2 | 0 | 0 | 0 |
| `NO_TITLE_OVERLAP` → title | 2 | 2 | 0 | 0 | 0 |
| `MODEL_CODE_AGE_LINE` → modelCode | 2 | 2 | 0 | 0 | 0 |
| `SAME_SELLER_DISTINCT_LISTING` → sellerSku | 2 | 0 | **2** | 0 | 0 |
| `BRAND_MISMATCH` → brand | 1 | 1 | 0 | 0 | 0 |

🟢🟢 **이 표가 CPO 의 질문에 답한다** — blocker **18건 중 13건은 그 축의 증거를 «수집한
상태»** 에서 막았다(A). ⟹ 🔴 **「데이터가 없어서 막았다」가 아니라 「증거를 보고 다르다고
판단했다」** 다. 🔴🔴 **그러므로 threshold 완화로 풀 문제가 아니다**(CPO 경고가 정확했다).

🔴 **갈리는 자리는 둘뿐이다**:
```
⒜ BRAND_UNCONFIRMED 의 B 1건 — bobochoses.co.jp(P-04 · CEO SAME)
   🔴 사이트가 브랜드를 말하는데(shopify.vendor) 운영이 못 가져왔다 ⟹
   **Step 4 가 찾은 유일한 「쓸 수 있었는데 못 쓴」 인과 일치 사례** 다
⒝ SAME_SELLER_DISTINCT_LISTING 2건 — `sellerSku` 가 **B**(미수집)인데 그 축으로 막혔다
   🔴 그 blocker 가 `sellerSku` 가 아닌 **다른 신호**(URL slug 등)로 발화할 가능성이 있다 —
   🔴 **단정하지 않는다**(축 매핑이 내 분석의 가정이고 운영 구현을 추적하지 않았다)
```

---

## 5. ⑧ / ⑨ — 두 축을 **겹쳐 세지 않았다**

```
⑧ Identity 가 «쓸 수 있었던» 증거를 못 쓴 사례   **31건**(B-FAIL ∩ 비교입력)
   🔴 그중 **「막힌 축 == 못 쓴 축」인 것은 1건** 뿐이다(bobochoses.co.jp / brand)
   🔴 나머지 30건은 **못 쓴 축과 막힌 축이 다르다** ⟹ **인과가 아니다**
      (대부분 `composition`·`sellerSku`·`age` 인데 그 축으로 막힌 것이 아니다)
⑨ 증거가 «실제로 사이트에 없어» 보류한 사례      **2건**
   donokids.com(P-02 CEO SAME) · donokids.com(P-05 CEO DIFFERENT) — 둘 다
   `BRAND_UNCONFIRMED → brand: C`(사이트에 브랜드가 없다) ⟹ 🟢 **정확한 보류**
```

🔴 **「⑧ 31건」을 「Identity 결함 31건」으로 적지 않는다** — 인과가 확인된 것은 **1건** 이다.

---

## 6. ⑤ REVIEW 10 접근 결과 — 🔴 SAME/DIFFERENT 로 판정하지 않았다

| 상품 | 후보 | 운영 추출 | 원문 | Identity |
|---|---|---|---|---|
| P-02 | miniboutique.co.kr | `UNREACHABLE` | html fetch 실패 | 미도달 |
| P-03 | beaumonde.co.kr | `OK` | html 174KB | 미도달 |
| P-03 | kream.co.kr | `OK` | html 712KB | 미도달 |
| P-03 | luksusbaby.kr | `OK` | shopify json | 미도달 |
| P-04 | kids21.com | `REDIRECTED_AWAY` | html 2.0MB | 미도달 |
| P-05 | main-story.com | `REDIRECTED_AWAY` | html 186KB | 미도달 |
| P-06 | thefrontshop.com | `REDIRECTED_AWAY` | html 836KB | 미도달 |
| P-07 | kids21.com | `REDIRECTED_AWAY` | html 2.0MB | 미도달 |
| P-07 | global.trenbe.com ×2 | `UNREACHABLE` | shopify json 실패 | 미도달 |

🔴 **사유가 셋으로 갈린다** — `REDIRECTED_AWAY` **4** · `UNREACHABLE` **3** ·
🔴 **`OK` 인데 미도달 3**(beaumonde · kream · luksusbaby).
🟢 Step 3 은 그 3건을 「샵당 1건 접힘 / 판정 단계」로 분류했다 ⟹ **추출은 됐고 뒤에서
떨어졌다**. 🔴 「목록 URL 이라서」는 **사실이 아니다**(Step 3 의 그 추정을 정정한다).

---

## 7. ④ DIFFERENT-FP = **0 / 8** (고유 22 · 미도달 14)

🟢 오포함 **0** 이고 가격 축 진입도 **0** 이다. 🔴 **분모는 8 이고 24 가 아니다**(CPO 판정).

차단 8건의 **차단 수단**(전수) — `AUDIENCE_LINE` 2 · `BRAND_UNCONFIRMED` 2 ·
`SAME_SELLER_DISTINCT_LISTING` 1 · ⚠`COLOR` 1 · ⚠`MODEL_CODE` 1 · ⚠`COLOR`+`MODEL_CODE` 1.
🟢 즉 **보호축이 실제로 일하고 있다** — 그중 **COLOR·MODEL_CODE conflict 3건** 은
WU-071 이 「단독 하중」이라 한 그 축이다.

---

## 8. ⑥ GT conflict **4** — 🔴 CTO 가 어느 쪽도 고르지 않았다

```
GT_CONFLICT(생성기 3) — m.luxboy.com(P-02) · bornyesterdaykids.com(P-02) · luksusbaby.kr(P-03)
🔴 GT_CONFLICT_CROSS_ORIGIN(1) — global.trenbe.com(P-02)
      originRaw=B226AC009 → **SAME**      ← core-same03 + wu-112
      originRaw=S2        → **DIFFERENT** ← wu-059
```
🟢 네 건 모두 **SAME/DIFFERENT 어느 분모에도 넣지 않았다**(CPO §5).

---

## 9. 측정불가 / 한계 (추정으로 채우지 않는다)

```
D 102 셀 = 후보 **6건** × 17필드 — 페이지를 열 수 없어 **존재 여부 자체를 모른다**
  UNREACHABLE 6 · REDIRECTED_AWAY 6(그중 일부는 원문은 받았으나 도착지가 상품이 아니다)
🔴 PRODUCT-01 AC157 — 원상품 facts 가 없어 Identity 축은 **여전히 측정불가**(CPO 판정 유지)
🔴 축 매핑(blocker → 필드)은 **내 분석의 가정** 이다 — 운영 구현을 줄 단위로 추적하지 않았다
   ⟹ `SAME_SELLER_DISTINCT_LISTING → sellerSku` 는 **단정하지 않는다**
🔴 site-presence reader 는 **구조화 데이터 우선 + 텍스트 패턴 보조** 다 ⟹ 텍스트 패턴이
   맞은 B(`composition`·`age`·`season`·`fit`·`audience`)는 **「사이트가 그 칸을 정식으로
   선언했다」가 아니다** — 「본문에 그렇게 적혀 있다」까지다
🔴 FP 분모 8 · FN 분모 23 — **작은 분모** 다. 백분율로 일반화하지 않는다
```

---

## 10. 변경 파일 (조사 전용)

```
신규  apps/.../__tests__/gt-master-step4.test.ts          하니스 · 계약 4 + LIVE 1
신규  apps/.../__tests__/gt-master-step4-fields.ts        🔴 **분류 전용** reader + 필드 지도
신규  docs/IDENTITY-GT-MASTER-01-STEP4.md                 이 문서
신규  docs/identity-gt-master/STEP4-EVIDENCE.json         70행 × 17필드 전수
신규  docs/identity-gt-master/STEP4-TABLE.md              CPO §6 전수표
🟢 운영 파일 **0** · fixture 추가 **0**(그래서 `core-same06` 분류 목록은 **건드리지 않았다**)
```

### 격리 장치 — 🔴 「측정용으로 만들었다」를 보장으로 쓰지 않았다

```
GTM4-A  공식 분모 80 · 보조 70 · 43/24/10/3 을 **바꾸지 않는다**
GTM4-B  필드 17 · 수집칸 없는 셋 · 비교 안 되는 넷을 **수치로 고정**
GTM4-C  🔴🔴 **운영 코드가 분류 전용 reader 를 import 하면 FAIL**(`git grep` 전수)
GTM4-D  Step 3 도달 **33행이 전부** Step 4 분모에 붙는다 ⟹ join 키가 갈리면 즉시 FAIL
LIVE    쓰기 불가 단언 · 전건 fetch 실패면 **측정 무효** 로 FAIL
fetch   🔴 운영 `fetchPlainHtmlWithFinalUrl` 재사용 — 자작 fetch **0**
        (SSRF · DNS rebinding · rate-limit 가드 유지 · WU-084 와 같은 이유)
```

---

## 11. 🔴 내 결함 3건 — 전부 적는다

```
① 루프에서 `continue` 대신 **`return`** — 분모가 70 → 11 로 잘릴 자리였다. 🟢 계약이 잡았다
② `ProductFacts` 를 `Record<string, unknown>` 으로 받으려 했다 — 🟢 **typecheck 가 잡았다**
   (그대로 두면 `facts.colorTxt` 같은 오타가 **전건 null** 로 조용히 통과한다)
③ 🔴🔴 **B 230 을 한 덩어리로 세어 ⑨가 「0」이 됐다** — `composition`(칸 없음)이 거의 모든
   행에서 B 라 ⑧을 오염시켰다. 🟢 B 를 **STRUCT / DERIVED / FAIL** 로 갈라 바로잡았고,
   그 과정에서 「composition 은 제목에서만 추출된다」는 **새 사실**(51/51 제목 미포함)이 나왔다
```

---

## 12. CPO 판정 대기 (CTO 가 고르지 않았다)

```
① 🔴 `sellerSku`·`age` 가 **A 0/70** — 칸이 있는데 한 번도 채워지지 않는다.
   수집을 고칠 것인가(🔴 추출기 변경이라 CPO 영역) · 측정불가로 둘 것인가
② 🔴 `composition` 이 **제목에서만** 추출된다(51/51 제목 미포함) ⟹ 그 축이 사실상
   발화하지 못한다. 본문까지 보게 할 것인가 — 🔴 **그것은 새 증거 경로** 다
   (메모 `description-evidence-turns-same-into-blockers` 가 그 방향의 위험을 이미 측정했다)
③ 🔴 `BRAND_UNCONFIRMED` 의 **B 1건**(bobochoses.co.jp) — 유일한 인과 일치. 브랜드 수집을
   고치면 그 1건이 열리는데, WU-080 이 「원상품 공백 메우기는 악화」로 REJECT 한 축과
   **다른 자리**(후보측)인지 확인이 필요하다
④ 🔴 `SAME_SELLER_DISTINCT_LISTING → sellerSku` 축 매핑 — 내 가정이다. 운영 발화 조건
   확인이 필요한가
⑤ Step 5 의 분모 표기 — 공식 80 ↔ 보조 70 ↔ 도달 33 ↔ FN 분모 23 ↔ FP 분모 8
```

---

## 13. 현재 좌표 / 다음 한 수

```
현재   🟢 **Step 4 CLOSED** — 70후보 × 17필드 전수에 증거 상태 존재 · B/C/D 구분 가능 ·
       SAME-FN 12 전수 원인 추적 · **정책 변경 0** ⟹ CPO 종료 조건 4/4 충족
       🟢🟢 핵심 산출 — **blocker 18건 중 13건은 증거를 «갖고» 막았다** ⟹
          threshold 완화로 풀 문제가 **아니다**(CPO 경고가 실측으로 확인됐다)
       🔴 「쓸 수 있었는데 못 쓴」 인과 일치는 **1건**(bobochoses.co.jp / brand)

다음   **Step 5** — 위 §12 의 ①~⑤ 를 CPO 가 판정한 뒤 정책 후보만 설계한다
       🔴 CTO 는 정책을 만들지 않는다 · Search · Price · UI · Registry 재진입 금지
```
