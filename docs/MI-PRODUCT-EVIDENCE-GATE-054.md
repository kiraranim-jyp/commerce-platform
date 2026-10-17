# WU-054 FINAL — Product Evidence Gate 전수 검증

> 🔴🔴 **판정 = HOLD. 구현 0.** CPO §8 의 GO 조건 ①③이 깨졌다 —
> **Human GT SAME 1건이 gate 때문에 사라진다.**
> 🟢🟢 그리고 그 1건을 파헤치다 **이 트랙에서 가장 중요한 국내 후보** 를 찾았다(§5).
> 🔴 운영 코드 변경 **0** · 새 URL **0** · AI **0**.

---

## ① 조사 범위 — 🔴 **URL 을 새로 만들지 않았다**

```
① WU-036 Human GT **51건**  — CEO 블라인드 리뷰 · 23 도메인
   humanGt  SAME 27 · DIFFERENT 23 · UNCERTAIN 1
   🔴 이 51건은 **이미 `factsFromProductUrl` 을 통과해 후보가 된 것들** 이다
      ⟹ gate 가 이들을 떨어뜨리면 **순손실** 이다
② 알려진 LISTING **7건** — WU-050/051 AI URL 6 + WU-052 Cafe24 목록 1 (원문 그대로 · `%%` 포함)
측정  운영 리더만 사용 — `extractFromJsonLd` · `extractMicrodataFromHtml`
      🔴 내가 정규식을 따로 쓰지 않았다(운영이 보는 것과 다른 것을 재지 않기 위해)
비용  실제 HTTP **~58회** · 읽기 전용 GET · AI 0 · 외부 API 0
```

---

## ② Product evidence 분포 (51건)

```
JSON_LD    **49**
MICRODATA  **0**     🔴 이 51건에 microdata-only 는 없었다(WU-053 의 tennis 는 이 집합 밖)
BOTH       0
NONE       **2**
UNREACHABLE **0**    🟢 「받지 못했다」가 섞이지 않았다 — 측정이 깨끗하다
NOT_FETCHED 0
```

🔴 **도메인 기준으로는 23개 중 1개(`beaumonde.co.kr`)만 구조화 데이터가 없다.**
🔴 그 1개가 **치명적** 인 이유는 §5 다.

---

## ③ P0-A — LISTING 제거 효과 🟢 **7/7 제외**

| URL | gate 결과 | 사유 |
|---|---|---|
| beaumonde `goods_list.php?cateCd=003` | 🟢 제외 | `NONE` |
| coupleshot `shopbrand.html?xcode=011` | 🟢 제외 | `NONE` |
| beaumonde `goods_list.php?cateCd=002&page=4` | 🟢 제외 | `NONE` |
| lfmall `search/result/…` ×2 | 🟢 제외 | `NOT_FETCHED`(shape 이 먼저 막는다) |
| lotteon `csearch/search` | 🟢 제외 | `NOT_FETCHED` |
| foretforet `product/list.html` | 🟢 제외 | `NOT_FETCHED` |

🟢 **목록 오염 잔존 0/7.** 🔴 단 4건은 **이미 shape 이 막고 있던 것** 이라 gate 의
증분은 **3건**(beaumonde 2 + coupleshot 1)이다. 🔴 「7건을 새로 막았다」로 적지 않는다.

---

## ④ P0-B — 실제 PRODUCT 손실 🔴 **2건**

```
C13  beaumonde.co.kr  ev=NONE  shape=PRODUCT_PAGE  mi=SIMILAR        human=DIFFERENT
C27  beaumonde.co.kr  ev=NONE  shape=PRODUCT_PAGE  mi=PRESUMED_SAME  human=**SAME**
```

🔴 **둘 다 `goods_view.php?goodsNo=…` — `view`(상세) 경로의 «진짜» 상품 페이지다.**

### 🔴 원인 분류 (CPO §4) — 「증거 없음」은 「내용 없음」이 **아니다**

실측으로 확인했다(같은 운영 fetch):

```
goodsNo=1000014021
  og:title = "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt **B226AC010**"
  ld+json 블록 **0** · itemprop **0** · 본문 「원」 금액 **88,000**
goodsNo=1000013334
  og:title = "페페슈즈 유광 부츠 Pepe 00225 VERNICE NERO"
  ld+json 블록 **0** · itemprop **0** · 본문 「원」 금액 **80,000**
```

```
⟹ 원인 = **그 샵이 구조화 데이터를 아예 쓰지 않는다**(JSON-LD 0 · microdata 0).
⟹ 🔴🔴 **「Product evidence 는 상품 페이지의 필요조건이 아니다.」**
   현행 경로는 `og:title` 로 그 페이지를 정상 처리하고 있었고, gate 는 그것을 끊는다.
🔴 내 probe 의 `title/price/brand = false` 는 **구조화 데이터 기준** 이다 —
   「페이지에 제목이 없다」로 읽으면 틀린다(테스트가 그 구분을 단언으로 잠갔다).
```

---

## ⑤ 🟢🟢 **이 WU 의 가장 중요한 발견 — C27 은 버려선 안 되는 후보다**

```
원상품  junioredition  "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses"  (B226AC010)
후보    beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021
        og:title 에 **품번 `B226AC010` 이 그대로 박혀 있다**
        본문에 **88,000원**
        도메인이 **`.co.kr`** → 🟢 WU-050 §2 의 **시장 게이트를 통과한다**
        Human GT = **SAME** · MI = PRESUMED_SAME(blocker `BRAND_UNCONFIRMED`)
```

🔴🔴 **즉 이것이 이 트랙에서 처음 나온 「국내 · 품번 일치 · KRW 가격 보유 · `.co.kr`」
후보다.** 그리고 **CPO 가 WU-050 에서 전달한 AI 가격 목록의 첫 값 `88,000` 이 바로 이
상품이다** — AI 는 목록 URL 을 줬지만, 그 샵의 **상세 URL** 은 이미 우리 GT 안에 있었다.

🔴 **그런데 지금 국내 가격비교에 못 들어간다. 막는 것은 둘이고 gate 가 아니다**:

```
① 가격이 **본문 텍스트** 다 — `88,000원` 은 JSON-LD/microdata 가 아니므로
   `priceStatus` 가 `VERIFIED_CURRENT` 가 되지 않는다 → `priceKrw = null`
   → 국내 축 진입 실패(WU-050 게이트 ③)
② 브랜드가 **한글** 이다 — og:title 이 「보보쇼즈」라 `BRAND_UNCONFIRMED` 가 남고
   verdict 가 `SAME` 이 아니라 `PRESUMED_SAME` 에서 멈춘다
```

🔴 **둘 다 이 WU 의 범위가 아니라 손대지 않았다.** 🟡 그러나 **다음 병목의 좌표** 다.

---

## ⑤-b SAME 손실 · ⑥ 가격증거 손실

```
🔴 Human SAME 손실   **1** (C27)     ← CPO §8 조건 ③ 위반
🟢 MI SAME 손실      0   (C27 의 현재 MI 는 PRESUMED_SAME 이다)
🟢 가격증거 손실     0   (구조화 가격이 애초에 0 이므로 잃을 것이 없다)
🟢 JSON-LD 상품 회귀 0   (49/49 유지)
🟢 microdata-only 유지 — 이 집합엔 0건이고, WU-053 의 tennis 2건은 `MICRODATA` 로 유지된다
🟢 Product scope 다중 — WU-053 게이트가 그대로 보수적으로 동작(변경 0)
```

🔴 **「MI SAME 손실 0」을 안전 근거로 쓰지 않는다** — C27 이 `PRESUMED_SAME` 인 것은
**브랜드 한글 문제 때문** 이고, 그 문제가 풀리면 C27 은 **SAME 이 될 후보** 다.
그때 gate 는 **MI SAME 을 직접 죽인다.**

---

## ⑦ 오류 taxonomy

```
E1  목록인데 들어온다 (FALSE PRODUCT-PAGE)        beaumonde 목록 2 · coupleshot 1 → 🟢 gate 가 막는다
E2  상품인데 구조화 데이터가 없다                   beaumonde 상세 2 → 🔴 **gate 가 죽인다**
E3  shape 이 먼저 막는 목록                        lfmall 2 · lotteon 1 · foretforet 1 → gate 무관
🔴🔴 E1 과 E2 가 **같은 도메인** 이다. 그래서 「도메인 단위 예외」로도 가를 수 없다 —
   beaumonde 를 통과시키면 E1 이 돌아오고, 막으면 E2 가 죽는다.
```

---

## ⑧ 10축 검토

| 축 | 판정 | 근거 |
|---|---|---|
| ① URL shape | 🟢 유지 | 7건 중 4건을 이미 막는다 |
| ② 기존 extractor 결과 | 🔴 분리력 불충분 | `og:title` 만으로는 목록/상세가 같다 |
| ③ product facts 존재 | 🔴 분리력 0 | 목록도 facts 를 만든다 |
| ④ JSON-LD Product | 🟡 49/51 커버 | 🔴 **beaumonde 에서 0** |
| ⑤ Shopify 구조 | 🟢 유지 | 변경 0 |
| ⑥ title/product-name | 🔴 분리력 0 | — |
| ⑦ SKU/model | 🟡 **새 단서** | 🟢 beaumonde `og:title` 에 **품번이 있다**(§5) |
| ⑧ canonical URL | 🔴 분리력 0 | 둘 다 자기 자신 |
| ⑨ `NO_FACTS` | 🟢 이미 동작 | coupleshot 를 막았다 |
| ⑩ MI 진입 게이트 | 🟢 이미 동작 | 목록 후보를 SIMILAR 로 거부 |

🔴 **최종안을 고르지 않았다.** ⑦이 새 단서이지만 「`og:title` 에서 품번을 읽는다」는
**새 식별 규칙** 이고 CPO 가 금지한 구역(SKU 승격 · 패턴 확대)과 맞닿는다.

---

## ⑨ 구현 여부 — **하지 않았다**

CPO §8 체크:

| | 조건 | 결과 |
|---|---|---|
| 1 | 실제 상품 false exclusion = 0 | 🔴 **2건** |
| 2 | 목록 오염 감소 | 🟢 증분 3건 |
| 3 | SAME 후보 손실 = 0 | 🔴 **Human SAME 1건** |
| 4 | price evidence 손실 = 0 | 🟢 0 |
| 5 | JSON-LD 상품 회귀 0 | 🟢 49/49 |
| 6 | microdata-only 유지 | 🟢 |
| 7 | Product scope 다중 안전 | 🟢 변경 0 |
| 8 | mutation 으로 gate 제거 시 FAIL | ⚪ **해당 없음**(구현하지 않았다) |
| 9 | regression/typecheck/build PASS | 🟢 |
| 10 | WU-049/051 해외 참고가격 불변 | 🟢 변경 0 |

🔴 **①③이 깨졌으므로 HOLD.** CPO §4: 「P0-B 가 1건이라도 발생하면 자동 GO 가 아니다」.

---

## ⑩ 검증

```
하니스   wu-054-product-evidence-gate.test.ts (전수 측정 1 + 원인 확인 1 · 둘 다 live)
기본실행 1 passed / 1 skipped → live 2 passed
회귀     admin **562 files / 8,188 passed · failed 0** (직전과 동일 · +1 파일은 skip 기본)
typecheck **0**
build    🔴 미실행 — **운영 코드 변경 0**. 🟢 같은 tsconfig 의 `tsc --noEmit` 이 0
mutation 🔴 **없다** — 구현이 0 이라 변이 대상이 없다(CPO §8-8 은 구현 시 조건)
security 🟢 fetch/URL 경로 **무변경** — SSRF·redirect·DNS rebinding·사설IP 경계 0 변경
금지 전수 URL blacklist 0 · 파일명 지식 0 · `.php`/`.html` 확대 0 ·
         「JSON-LD 부재=목록」 **채택 0** · threshold 0 · SKU 승격 0 · color 0 ·
         Registry 0 · AI/Gemini 0 · sourcing 연결 0
```

---

## ⑪ Production

```
운영 코드 변경 0 → 기능 변화 0 · 화면 변화 0 · 배포 영향 0
직전 배포(dc2b360f · WU-053)가 그대로 유효하다
```

---

## ⑫ 최종 판정

```
🟢 GO    — 아니다. Human GT SAME 1건이 사라진다(§④⑤)
🟡 HOLD  — **그렇다.** gate 의 전제(「Product evidence 는 상품의 필요조건」)가
           **데이터로 반증됐다** — 구조화 데이터를 쓰지 않는 국내 샵이 실재한다
🔴 STOP  — 아니다
──────────────────────────────────────────
**HOLD**
```

🟢 **그리고 이 HOLD 는 실패가 아니다** — 「목록을 더 잘 막겠다」는 방향이 **가장 값진
국내 후보를 죽인다** 는 것을 **구현 전에** 데이터로 잡았다.

---

## ⑬ 남은 문제 — 🔴 다음 병목의 좌표가 바뀌었다

```
🟢🟢 ⒜ **C27 을 살리는 것** 이 목록 차단보다 먼저다. 그 후보는
     국내 · `.co.kr` · 품번 일치 · 88,000원 · Human SAME 이다. 막는 것은 둘:
       ① 가격이 **본문 텍스트**("88,000원")라 `VERIFIED_CURRENT` 가 되지 않는다
       ② 브랜드가 **한글**("보보쇼즈")이라 `BRAND_UNCONFIRMED` 가 남는다
     🔴 둘 다 안전성 측정이 선행이다 — ①은 「본문의 임의 숫자+원」을 가격으로 읽을
        위험, ②는 한글↔영문 브랜드 대응이라 **새 사전** 문제다(CPO 금지 구역과 인접).
🔴 ⒝ Product evidence gate 는 **도메인 예외로도 못 구한다** — E1/E2 가 같은 도메인이다.
🔴 ⒞ 이 측정의 분모는 **51 + 7** 이고 microdata-only 가 **0** 이다. WU-053 의
     tennis 2건은 이 집합 밖이므로 「microdata 가 51건에서 쓸모없었다」로 읽지 않는다.
```

## CEO Action — **NONE**
