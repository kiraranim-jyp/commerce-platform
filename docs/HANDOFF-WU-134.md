# 🟢🟢 WU-134 — **원상품 브랜드 확정성 복구 → 실제 system SAME 재현** (GO)

> 🔴 CPO 지시(2026-10-20): 「원상품 공식 브랜드 확정성 복구 → 기존 human SAME/DIFFERENT
> 전수 재검증 → **실제 system SAME 양성 확인** → 실제 가격비교까지 E2E → 회귀 → 배포 → 1회 보고.
> threshold 낮추지 않는다. 모르면 억지로 채우지 않는다. CEO 테스트 없음.」
>
> 🟢🟢 **완료 기준 달성** — 실제 human SAME 이 system SAME 으로 재현되고 **가격비교에 행이 선다**.
> 🔴 **CEO 액션 없음**(다음 WU 범위는 CPO 가 지정).

---

## 1. 🔴 STEP 1 — 원상품 brand source 전수 측정 (추측 전에 쟀다)

```
원상품 bobochoses.com(브랜드 **공식몰**)
  Shopify vendor          "AW26"            ← 시즌코드
  JSON-LD Product.brand   "AW26"            ← 같은 값
  🟢 og:site_name          "Bobo Choses"
  🟢 JSON-LD Organization  "Bobo Choses"     ← **두 자리가 같다**
  mpn = sku                "B226AC00945101"
후보(리테일러) 17건  Product.brand 보유 **11** · null **6**
                     org/site 는 **자기 상점 이름**(Tinyapple · trenbe · Kids21 · 비스킷 …)
```

🔴 **내 1차 가설은 반증됐다** — 「브랜드 품번을 자기 sku 로 싣는 곳이 공식몰」로 가르려 했는데
`trenbe` · `thefrontshop` · `luxboy`(전부 리테일러)도 `B226AC009` 를 sku 로 싣는다.

🟢 **대신 발화 조건이 리테일러에 걸리지 않는다는 것이 측정됐다** — 「brand 가 **있는데**
시즌코드로 **거부됨**」은 **원상품 1건뿐이고 후보 17건 중 0** 이다.

---

## 2. 🔴🔴 STEP 2 — 반사실을 «구현 전» 에 쟀다 (WU-080 자리라서)

WU-080 이 「원상품 brand 공백을 메우면 **악화**」로 REJECT 한 자리다. 그래서 「이번 축은
다르다」를 말로 주장하지 않고 **같은 후보 집합에 brand 만 바꿔** 두 번 판정했다.

```
BEFORE brand=""              판정 11 · displaySAME 0 · trueSAME 0 · falseSAME 0 · DIFF 방어 2/2
AFTER  brand="Bobo Choses"   판정 12 · displaySAME 5 · trueSAME **3** · falseSAME **0** · DIFF 방어 **3/3**
🟢 Negative 가 **더 강해졌다** — `parkette.ca`(human DIFFERENT)가 **COLOR 충돌로 새로 막혔다**
🔴 악화 1건도 적는다 — `biskuit.kr` 이 BRAND_UNCONFIRMED → **BRAND_MISMATCH** 가 된다
   (그 샵이 brand 자리에 자기 이름 「비스킷」을 적는다 · WU-080 이 본 그 모양)
   🟢 결과 등급은 둘 다 SAME 이 아니라 **변화 0** 이다
```
⟹ **순이익이고 Precision 을 깨지 않는다 ⟹ 구현 GO.**

---

## 3. 🟢 구현 — **좁은 축 하나** (신규 1파일 · 운영 3파일)

```
신규  packages/crawler/src/site-brand-name.ts
      🔴 「브랜드를 추측하는 곳」이 아니다 — 페이지가 **두 자리에 같은 이름** 을 적어
         뒀을 때만 그 문자열을 돌려준다(`og:site_name` == JSON-LD `Organization.name`).
      🔴 그 값도 `resolveBrandName`(브랜드 규칙 owner)을 **통과해야** 한다 — 시즌·
         마케팅·카테고리 문구는 여기서도 거부된다. 🔴 **도메인을 쓰지 않는다**(계약 A-8).

배선  product-data-extractor  `siteBrandName` 칸 하나(이미 받은 html 을 읽는다 · HTTP 0)
      shopify.site-strategy   🔴 **`vendor` 가 거부됐을 때만** HTML 1회 — 기존
                              `fillMissingCurrency` 와 **완전히 같은 모양** 이다
      canonical-product       🔴 복구는 **「brand 가 있었고 + 거부됐고 + 사이트 이름이 있다」**
                              셋을 **동시에** 만족할 때만
```

🔴 **brand 가 애초에 없으면 발화하지 않는다** — 「모르면 억지로 채우지 않는다」(CPO).
그 모양이 멀티브랜드 리테일러의 위험 모양이고, WU-080 의 금지가 그대로 유효하다.

### 🔴🔴 계약이 내 회귀를 잡았다 (B-4)
1차 구현이 `cleaned || recovered || brand || ""` 였다. 거부된 경우 `cleaned` 가 **빈
문자열** 이라 `||` 가 건너뛰고 **`"AW26"` 이 브랜드로 되돌아왔다** — REWORK-12 ④ 가
없앤 버그의 **재발** 이다. 🟢 `recovered || (cleaned ?? brand ?? "")` 로 고쳤다.

---

## 4. 🟢🟢 STEP 4 — 실제 경로 E2E (Positive + Negative 동시)

🔴 순수 계약은 「조건이 맞으면 복구한다」까지만 증명한다. Shopify 경로는 **HTML 을 아예
읽지 않으므로**(WU-079) 배선이 없으면 복구가 **한 번도 돌지 않는다**. 그래서 **실제 URL** 로 쟀다.

```
배선 증명   vendor "AW26" → siteBrandName "Bobo Choses" → canonical brand "Bobo Choses"
E2E         원상품을 **실제 경로로 다시 추출** → DNA → GT 17건 재투입 → 운영 판정 순서
            GT 17건(SAME 13 · DIFFERENT 4) · pool usable **17/17**
            판정 12 · displaySAME 5 · **trueSAME 3** · **falseSAME 0**
            🟢 실제 DIFFERENT 방어 **3/3**
🟢🟢 📊 가격비교 — 국내 0 · **해외 4건**  ⟸ **전까지 0 이었다**
```

🔴 **4건 중 3건이 human SAME 이고 1건은 라벨이 이 분모에 없다**(junioredition/scoutandcokids
계열 · wu-112 GT 의 URL 과 다르다). 🔴 「4건 전부 정답」으로 적지 않는다.

---

## 5. 🔴 측정불가 / 한계 (숨기지 않는다)

```
⒜ 🔴🔴 **기존 스냅샷 543건은 brand 가 빈 채로 저장돼 있다.** 이 수정은 **새 추출** 에만
   적용된다 — 기존 상품은 셀러가 **「새 상품 분석」을 다시 해야** 브랜드가 채워진다.
   (`/check` 는 저장된 `canonicalProduct` 를 읽으므로 재추출하지 않는다)
⒝ 국내 가격비교는 **여전히 0** 이다 — 국내 human SAME 2건 중 `biskuit.kr` 은
   BRAND_MISMATCH + NO_TITLE_OVERLAP 로 막힌다(한국어 제목 · 샵 이름을 brand 에 적음).
   🔴 그 두 축은 **8축 CLOSED** 이고 이번에 건드리지 않았다
⒞ 표본은 **원상품 1개(B226AC009)** 다. `B226AC010` 은 스냅샷이 DB 에 없고(WU-133),
   `B226AC042` 는 human SAME GT 가 0 이다 ⟹ **교차검증 상품이 없다**
⒟ `vendor` 가 시즌코드인 스토어에서 **원상품 추출 HTTP 가 1회 늘어난다**(그 외 0)
⒠ 실제 따져 화면은 CTO 가 볼 수 없다
```

---

## 6. 🟢 검증

```
계약 신규 **17**(순수 16 + 라이브 배선 1) · 음성대조 **M1~M6 전부 FAIL → 복구 PASS**
   M1 두자리일치 1F · M2 brand존재게이트 1F · M3 거부조건 3F · M4 `||`복귀 1F ·
   M5 배선제거 1F · M6 도메인사용 1F
   🔴 M2·M4 는 1차에 **변이가 적용되지 않았다**(sed 가 줄바꿈·`||` 에서 실패) —
      「적용 실패」를 「통과」로 읽지 않도록 **적용 확인을 넣고** 다시 돌렸다
회귀 **8,524 passed · failed 0** · typecheck **0** · build **exit 0**
```

---

## 7. 🟡 다음 (CPO 가 지정한다)

```
① 기존 스냅샷의 brand 공백 — 재추출을 **언제/어떻게** 할지는 제품 정책이다
   (일괄 재분석은 외부 HTTP 543회 · CTO 가 임의로 돌리지 않았다)
② 국내 축 — `biskuit.kr` 의 BRAND_MISMATCH/NO_TITLE_OVERLAP 는 **8축 CLOSED** 다
③ 교차검증 상품 확보 — human SAME GT 가 있는 **다른 원상품 스냅샷** 이 필요하다
```

🔴 **CEO 액션 없음.**
