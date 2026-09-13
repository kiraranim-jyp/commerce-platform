# MI-MATCHING-3.0 — EDIT-SHOP DISCOVERY / EVIDENCE PIPELINE

- 지시: CEO, 2026-09-14 · 실측 수행 2026-09-14, 브랜치 `main`, 시작 HEAD `4a2322a`
- `bobochoses.com`은 **어디에도 추가하지 않았고 아무것도 켜지 않았다**(CEO 금지 조항 전부 준수).
  `comparison_shops`/`domestic_price_sources`의 기존 두 행은 상태 그대로 둔다.
- DB는 SELECT만 했다. 마이그레이션 0건, DB write 0건.
- 조사용 임시 스크립트는 저장소 밖(스크래치)에서 돌리고 지웠다.

---

## 0. STEP 0 — 429는 차단이었다. 그리고 원인은 헤더가 아니다

### 0-1. 무엇을 쟀는가

직전 조사의 관측("같은 순간 같은 IP에서 node `fetch`는 429, `curl`은 200")을 확정하기
위해, **429가 실제로 발생한 순간**에 같은 URL·같은 헤더로 다섯 가지 클라이언트를
번갈아 던졌다(junioredition.com / nickis.com / villagekids.co.uk, 2회 재현).

| 클라이언트 | 첫 확인(3도메인 각 2회) | 이어서 18회씩 교차 측정 |
|---|---|---|
| `node fetch` (undici) — **운영 코드가 쓰던 것** | **429 / 429** | **429 × 18 (100% 차단)** |
| `node:https` (HTTP/1.1) | 200 / 200 | 200 × 15 · 429 × 3 |
| `node:http2` (HTTP/2) | 200 / 200 | **200 × 18** |
| `curl` (HTTP/1.1, 같은 UA/Accept) | **200** | (직접 셸 확인, `http/1.1`) |
| `node fetch` + curl User-Agent/Accept | **429** | — |
| **새 프로세스**의 첫 `node fetch` | **429** (2회) | — |

응답 헤더: `server: cloudflare`, `retry-after` **없음**, `cf-ray` 있음.

### 0-2. 그래서 원인이 무엇이 아닌가

```
헤더            ❌  UA/Accept 를 curl 것으로 바꿔도 undici 는 429 그대로
요청량          ❌  새 프로세스의 첫 요청도 429 (같은 순간 다른 스택은 200)
커넥션 재사용    ❌  같은 이유(새 프로세스 = 새 커넥션)
HTTP 버전       ❌  h1.1(node:https)도 h2(node:http2)도 200
IP              ❌  같은 순간 같은 IP 의 curl/node:https/node:http2 가 200
재고 없음        ❌  차단이 풀리자 같은 질의가 같은 후보를 그대로 돌려준다
```

즉 **차단이 맞고, 구분선은 "클라이언트 스택"이다.** undici가 가장 먼저·가장 세게
막히고, `node:https`는 대체로 통과하며(18회 중 15), `node:http2`는 이번 표본에서
전부 통과했다. 차단은 영구적이지 않다 — 잠시 뒤 다시 재면 undici도 200으로 돌아온다
(실측 확인). **정확한 기전(TLS 지문 vs 스택별 요청 집계)까지는 확정하지 못했다.
확정한 것은 "헤더로는 고쳐지지 않는다"와 "다른 스택은 같은 순간 통과한다" 둘이다.**

### 0-3. 이것이 왜 중요한가

이 429는 화면에서 **"해외 편집샵에 그 상품이 없다"**로 읽혔다. 재고 없음과 차단은
전혀 다른 사실인데 같은 자리에 도착하고 있었다. 실제로 이번 조사 중 15개 상품을
연속 측정하다가 **지원 9개 Shopify 판매처가 동시에 429**로 넘어갔고, 그 뒤 4개
상품의 해외 후보가 전부 0건이 됐다(아래 0-5 표).

### 0-4. 무엇을 고쳤는가 (최소 범위)

`packages/crawler/src/rate-limit/domain-rate-limiter.ts` —
기존 429 재시도가 끝난 뒤에도 429면, **이미 저장소에 있던** `node:https` 경로
(`utils/direct-html-fetch.ts` — smallable의 응답 헤더 19KB 초과 때문에 이미 같은
"fetch로는 못 받는다" 문제로 만들어 둔 함수)로 **한 번만** 더 묻는다.

```
우회 프록시 ❌   재시도 폭주 ❌   헤더 위장 ❌
429일 때만 요청 1건 추가, 그마저 실패하면 원래 429를 그대로 돌려준다
→ errorKind="RATE_LIMITED"가 지금처럼 화면까지 정직하게 전달된다
```

`fetchHtmlDirect`에는 선택적 헤더 override 인자만 더했다(suggest.json은
`Accept: application/json`이 필요하다). 넘기지 않으면 기존 동작 그대로다.

`node:http2`가 18/18로 더 나았지만 **채택하지 않았다** — 새 HTTP 클라이언트(리다이렉트·
타임아웃·에러 처리 일체)를 저장소에 들이는 일이고, 표본 18건·3도메인으로 표준을 바꾸기에는
근거가 얇다. 관측만 남긴다.

### 0-5. 고친 뒤 결과가 바뀌었는가 — **바뀌었다**

차단이 **살아 있는 상태에서**(직후 raw `node fetch`는 여전히 429) 같은 상품을 다시 쟀다.

| | 429 차단 중 · 수정 전 | 429 차단 중 · 수정 후 |
|---|---|---|
| 해외 판매처 상태 | 9곳 전부 `error: Shopify suggest API 429` | **9곳 전부 `ok`** |
| 해외 후보 수(430701) | **0** | **16** (junioredition 5 · Village Kids 5 · Folk Berlin 5 · Piccoli 1) |
| 국내 후보 수 | 5 | 5 |

즉 "해외 0건"의 **일부는 재고 없음이 아니라 차단이었다.**
다만 **B226AC114에 대해서는 결론이 바뀌지 않는다** — 차단이 없는 상태에서 쟀을 때도
지원 편집샵 어디에도 그 상품이 없었다(§1).

---

## 1. STEP 2 — Ground Truth 발견 여부: `B226AC114` = **NOT FOUND**

차단이 없는 상태에서, 활성 편집샵만 대상으로 기존 파이프라인을 그대로 실행했다.

```
원본        Smallable 430701 (https://www.smallable.com/en/product/…-430701)
질의 사다리  ["Bobo Choses zipped sweat Heather grey",
             "Bobo Choses zipped sweat",
             "Bobo Choses zipped sweat organic cotton"]
검색 대상    국내 자동수집 5곳 + 해외 파서 보유 10곳 = 15곳
후보        21건 (국내 5 · 해외 16)
B226AC114   ❌ NOT FOUND  (제목/URL 어디에도 `b226ac114` / `bolder` 없음)
```

**FAILURE A(검색 도달) 21 / FAILURE B(판정 탈락) 0.**
판정에서 떨어진 것이 아니라 **후보로 나온 적이 없다.** 직전 조사(19×16 전수)와 같은
결론이고, 이유도 같다 — AW26 신상이라 편집샵이 아직 들여오지 않았다. **이것은 결함이
아니라 사실이다.**

> 참고로 CEO가 금지한 공식몰은 Ground Truth 기준으로만 썼다: 그 상품은 실재하고
> (`B226AC114`, €75), 질의도 충분히 좋다. 검색어 문제가 아니다.

---

## 2. STEP 1 — 검색 대상 배선 감사 (DB 실측 2026-09-14)

### 2-1. 해외 (`comparison_shops` 25행 전부 `is_active=true`)

| 도메인 | DB 행 | 코드 참조 | 실제 fetch | 후보 변환 |
|---|---|---|---|---|
| junioredition / nickis / isolabellakids / petitemaisonkids / shoppiccoliandco / designerkidswear / kidbizkid / villagekids / folkberlin | ✅ | ✅ `SHOPIFY_SUGGEST_DOMAINS` | ✅ | ✅ |
| childrensalon.com | ✅ | ✅ 전용 파서 | ✅ | ✅ (**이번에 facts까지 — §4**) |
| **bobochoses.com** | ✅ | ❌ 목록에 없음 | ❌ | ❌ `unsupported` | 
| alexandalexa · babyshop · bucketsandspades · cissyweras · kids-world · kidsdepartment.nl · kidsroom.de · luksusbaby · melijoe · mytheresa · pandaandcub · scoutandcokids · smallable · studioplay (14곳) | ✅ | ❌ | ❌ | ❌ `unsupported` |
| **kidswearcollective.com** | ❌ **행 없음** | ✅ 코드 목록에 있음 | ❌ | ❌ |
| **kidsatelier.com** | ❌ **행 없음** | ✅ 코드 목록에 있음 | ❌ | ❌ |

### 2-2. 국내 (`domestic_price_sources` 16행)

| 도메인 | enabled | strategy | 파서 | 실제 fetch | 후보 변환 |
|---|---|---|---|---|---|
| looxloo.com · foretforet.com · rulii.co.kr · deuxbebe.com · chocoel.co.kr | ✅ | AUTO_SCRAPE | ✅ | ✅ | ✅ (**이번에 facts까지 — §4**) |
| chouchouenfant.kr · coconjennie.com · karymarket.com · kidikidi.elandmall.co.kr · nokimore.com · ocokorea.com | ✅ | MANUAL | ❌ | ❌ | ❌ |
| 29cm · musinsa · ssfshop · wconcept | ❌ | MANUAL | ❌ | ❌ | ❌ |
| **bobochoses.com** | ❌ | AUTO_API | ✅ 있음 | ❌ | ❌ |

### 2-3. 연결 누락 — **기록만 한다. 아무것도 추가·활성화하지 않았다**

**등록 의도가 명백한데 행이 없어서 죽은 것 (CEO 판단 필요):**

```
kidswearcollective.com   SHOPIFY_SUGGEST_DOMAINS 에 있다(N-3.12에서 실측 확인 후 추가)
kidsatelier.com          그런데 comparison_shops 에 행이 없다 → 영원히 검색되지 않는다
```
두 도메인은 2026-08-12에 "표준 Shopify suggest 응답을 준다"고 실측 확인하고 코드에
넣은 것이다(index.ts 주석). 즉 **빠뜨린 것이지 뺀 것이 아니다.** 행을 넣으면 곧바로
검색 대상이 된다 — 넣을지는 CEO가 정한다.

**고치지 않는 것(CEO 금지):** `bobochoses.com`. 두 테이블의 행을 그대로 뒀다.

**성격이 다른 것(보고만):** 해외 14곳·국내 6곳은 파서가 없어 `unsupported`다. 목록
노이즈일 뿐 데이터를 잃고 있지는 않다.

---

## 3. STEP 4 — Matching authority (조사만. 삭제·통합하지 않았다)

### 3-1. 국내 = **저장 경로**(`run-domestic-price-check.ts`) — 두 계층이 합쳐서 쓰인다

```
① 문지기        toDomesticMatchType(best.matchLevel)   ← 구판 점수
   low → NOT_MATCHED → continue (링크 없음)
   예외 두 개로만 살아난다:
     modelCodeEvidence ∈ {exact, partial}                      (:437)
     crossSellerVerdict ∈ {SAME, PRESUMED_SAME}                (:449)

② 등급 결정     deriveMatchTruth(level, modelCode, crossSeller)  ← match-truth.ts
   crossSeller === CONFLICT      → CONFLICT      (무조건 이긴다, 최우선)
   modelCode   === conflict      → CONFLICT
   modelCode   ∈ {exact,partial} → EXACT/STRONG_IDENTIFIER
   그 외                          → max(구판 텍스트 등급, 교차판매처 등급)

③ 가격 사용     priceTierFromLink(matchTruth)  EXACT / COMPARISON / EXCLUDED
```

> **권위의 정확한 모양:** 2.0(`compareCrossSellerProducts`)은 **거부권과 상한**을 갖는다
> (CONFLICT면 무조건 배제, SAME이면 구판 low를 뚫고 STRONG_IDENTIFIER까지 올린다).
> 구판(`scoreCandidateMatch`)은 **하한과 문지기**다 — 저장되는 `matchConfidence`
> 숫자 자체이고, low면 2.0이 SAME/PRESUMED_SAME을 말하지 않는 한 후보가 버려진다.
> 어느 한쪽이 단독 권위가 아니다.

### 3-2. 국내 = **화면 경로**(`/api/domestic-price-sources/search`) — 저장하지 않는다

`attachMatchTruth`가 같은 `deriveMatchTruth`를 부른다. 다만 **문지기 ①이 없다** —
low 후보도 화면에는 남는다. 그래서 화면과 DB가 서로 다른 개수를 보여줄 수 있다.

### 3-3. 해외 = **화면 전용**(`/api/comparison/search`) — DB에 아무것도 저장하지 않는다

`attachProductMatchTruth` → `deriveProductMatchTruth`가 권위다. 여기서도 2.0이
거부권을 갖는다(`cross === CONFLICT` → CONFLICT, 단 `SAME_MODEL_VARIANT`만 예외).

### 3-4. 🔴 이번에 새로 발견한 결함 — **판매처가 두 상품에 같은 품번을 적는다**

`compareCrossSellerProducts`는 `identifierConfirmed`면 **보류를 보지 않고 즉시 SAME**을
돌려준다(cross-seller.ts:487). 그 전제는 "브랜드 품번이 같으면 같은 상품"이다.
**그 전제가 실제 데이터에서 깨진다.** 라이브 실측(2026-09-14, junioredition.com
`/products/*.js` 설명문 원문):

```
Minnie Newborn Body   in Rosetto by Konges Sløjd … Product Code KS106168-P05261 AW26 Made in China.
Minnie Newborn Onesie in Rosetto by Konges Sløjd … Product Code KS106168-P05261 AW26 Made in China.
                                                                ^^^^^^^^^^^^^^^ 글자 하나까지 같다

Bubble Sweatshirt in Grey Melange by Main Story … Product Code AW26MS185
Bubble Sweatshirt in Graystone    by Main Story … Product Code AW26MS185
```

결과(실측 판정):

```
Body ↔ Onesie          SAME   근거: 브랜드 품번 일치 / 핵심 상품명 minnie·newborn / 소재 / 대상
Grey Melange ↔ Graystone SAME 근거: 브랜드 품번 일치 / 핵심 상품명 bubble / 상품군 / 소재 / 핏
```

바디수트와 우주복은 다른 상품이고, 그레이 멜란지와 그레이스톤은 다른 색이다.
`SAME`은 가격 비교에 **그대로 쓰이는** 등급이다(`isSameProductForPricing`).

**이 결함은 이번 변경과 무관하다** — 이 후보들은 `shopify-suggest.ts`가 이미
facts를 채우고 있던 경로에서 나온다(MATCHING-2.0-CORE 이후 계속 이 상태였다).
**고치지 않았다**: STEP 4는 "조사만"이고, "식별자 일치 = 동일상품"이라는 전제를
바꾸는 것은 판정 정책 변경이라 CEO 판단이 먼저다. 재현 경로와 원문을 그대로 남긴다.

### 3-5. 같은 정답쌍에서 두 계층이 정반대라는 관측은 여전히 참이다

```
430701 ↔ B226AC114   compareCrossSellerProducts  SAME  (corePoints 7)
                     scoreCandidateMatch          0.38 → low
```
저장 경로에서는 ①의 예외(SAME)가 그 후보를 살리고 ②가 STRONG_IDENTIFIER로 올린다.
**즉 오늘 구조에서는 이 쌍이 버려지지 않는다.** 구판 점수는 화면 숫자로만 남는다.

---

## 4. STEP 3 — 국내 facts 배선 정상화 (이번 작업의 본체) · **수정함**

### 4-1. 어디서 소실되는가 — 정확한 지점

```
search  ✅  질의 사다리(buildCrossSellerSearchQueries)가 국내 5곳에 정상 도달
fetch   ✅  응답 200, 파싱 성공
parser  🔴  ← 여기다
facts   🔴  ComparisonCandidate.facts 를 아무도 채우지 않았다
cand    ✅  후보 객체 자체는 정상 생성(가격·이미지·제목 다 있다)
matching🔴  match.ts:487 `query.facts && c.facts` 가 언제나 거짓
verdict 🔴  crossSellerVerdict = undefined (판정 미실행)
links   ⚠️  구판 점수만으로 저장 여부가 결정됨
```

**데이터가 없어서가 아니다.** 파서는 이미 읽고 있었다:

| 판매처 | 목록에서 **이미 읽던 값** | 담긴 칸 | 판정기가 보는가 |
|---|---|---|---|
| LOOXLOO | `rel="브랜드"` → `BOBO CHOSES`, `ec-data-src` 이미지, 제목 속 `(75A7D-415-16)` | `candidate.brand` / `.imageUrl` / `.sku` | **아니오** |
| 포레포레 | `<div class="brand">` → `BOBO CHOSES`, 이미지, 제목 끝 `BB26KSSOCI008BLU` | 〃 | **아니오** |
| RULII | `rel="브랜드"`, 이미지, 모델코드 | 〃 | **아니오** |
| DEUXBEBE | 첫 rel 필드 브랜드, 이미지, `자체 상품코드` | 〃 | **아니오** |
| CHOCO.EL | 제목·이미지(브랜드 칸 자체가 없음 — 실측) | 〃 | **아니오** |
| Childrensalon(해외) | `<div class="designer">` 브랜드, 이미지 | 〃 | **아니오** |

즉 소실 지점은 **파서가 만드는 후보 객체 리터럴 한 곳**이다. 판정기는 `brand`/
`imageUrl`/`sku` 세 칸을 보지 않는다 — `facts`만 본다.

### 4-2. LOOXLOO JSON-LD / 포레포레 mpn·사이즈는 어디에 있는가

**상세 페이지에만 있고, 검색 경로는 상세를 facts 목적으로 열지 않는다.**

```
extractLooxlooOptions / extractRuliiOptions / extractDeuxbebeOptions
  → 구현돼 있고 index.ts 에서 export 까지 되지만 **호출부가 저장소 전체에 0곳**이다(죽은 export)
fetchForetforetModelCode / fetchDomesticModelCode
  → 호출된다. 다만 결과가 compareModelCode 로만 가고 facts 로는 가지 않는다
LOOXLOO 목록의 rel="상품색상"
  → 실재하지만 값이 색 이름이 아니라 **개수**다(실측: "0" / "1" / "2") → 쓸 수 없다
```

### 4-3. 무엇을 고쳤는가

`seller-facts.ts`에 `productFactsFromListing()`을 더하고(기존
`productFactsFromShopifyProduct`와 **같은 파일·같은 헬퍼**), 6개 파서가 그것을
호출하게 했다. **새 추출기·새 정규식·새 어휘를 만들지 않았다.** 네트워크 요청도
늘지 않는다 — 이미 읽고 있던 값을 담는 칸만 바뀐다.

불변식 하나를 명시적으로 지켰다:

```
포레포레 BB26KSSSTC045041 · LOOXLOO 75A7D-415-16 은 국내 유통사/판매처 번호다
→ facts.brandModelCode 에 절대 넣지 않는다 (언제나 null, sellerSku 칸에만 둔다)
   넣으면 ① compareModelCode 가 없는 충돌을 지어내고
          ② slugCarriesCode 가 우연히 걸려 근거 없는 SAME 이 만들어진다
```

### 4-4. 회귀 — 새 오탐이 생기는가 · **생기지 않는다(구조적으로)**

국내 후보가 `SAME`에 도달하려면 둘 중 하나가 필요하다.

```
① identifierConfirmed   brandModelCode 가 null 이라 경로가 닫혀 있다
② 보류 0 + 브랜드 확인 + corePoints ≥ 5
   한국어 제목은 영문 원제목과 겹치는 말이 없어 NO_TITLE_OVERLAP 보류가 반드시 붙는다
```

실측(430701, 국내 5건):

| 후보 | 수정 전 | 수정 후 | 맞는가 |
|---|---|---|---|
| 보보쇼즈BS고BOBO트랙수트팬츠 | 미실행 | **CONFLICT** (상품군 PANTS↔TOP) | ✅ 다른 상품 |
| 보보쇼즈 베이비 롱퍼프숏양말 | 미실행 | **CONFLICT** (상품군 ACCESSORY↔TOP) | ✅ |
| 보보쇼즈 뉴본 머시몬스터양말팩GN | 미실행 | **CONFLICT** | ✅ |
| 보보쇼즈 베이비 고BOBO데님윈터캡 | 미실행 | SIMILAR | ✅ 과장 없음 |
| 보보쇼즈 컬러링북AW26 | 미실행 | UNKNOWN | ✅ |

**운영 DB에 실재하는 유일한 확정 동일상품 쌍**으로 직접 회귀를 쟀다
(`domestic_product_links` 38행이 전부 이 한 상품이다):

```
junioredition  Lulu T Bar Shoes in Vernice Nero by PèPè  (brandModelCode 01195-VERNICE-NERO)
  ↔ 포레포레  AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈-PP24KASHE1195NER

crossSellerVerdict  SIMILAR   (CONFLICT 아님 — 브랜드 "PePe"↔"PEPE SHOES" 호환 확인)
deriveMatchTruth    modelCode=partial 이 먼저 이겨서 STRONG_IDENTIFIER 유지
priceTier           EXACT 유지  →  회귀 없음
```

같은 실행에서 Childrensalon이 돌려준 Guess 상품 5건은 이제 전부 `CONFLICT: 브랜드`다 —
지금까지 이 판매처 후보는 브랜드 반증을 한 번도 받은 적이 없었다.

### 4-5. 남은 것 (이번에 하지 않았다 · 기록)

- 상세 페이지 facts(LOOXLOO 이미지 8장·offers 색상/사이즈, 포레포레 사이즈 옵션)는
  배선하지 않았다. 후보마다 HTTP 요청이 늘어나고, 이번 변경의 "요청 0건 증가"
  성질을 깬다. 죽은 export 3개(`extract*Options`)가 그 자리의 재료다.
- **한국어 어휘가 죽어 있는 자리(기록만, CEO 금지 준수 — 대량 추가하지 않았다):**

| 관측된 국내 표기 | 어휘 목록의 말 | 토큰 일치 | 결과 |
|---|---|---|---|
| `스웻셔츠` | `스웨트셔츠` | ❌ | 옷의 형태 판독 실패 |
| `헤더그레이` | `그레이` | ❌ | 색상 판독 실패 |
| `롱삭스` / `양말팩` | `양말` | ❌ | 형태 판독 실패 |
| `뉴본` | (KIDS 토큰에 없음) | ❌ | 대상 판독 실패 |

  원인은 `resolveGarmentForms`/`resolveColorHueGroups`가 **토큰 완전일치**를 쓰기
  때문이다(영어에서는 `sweat`↔`sweatshirt` 오탐을 막는 옳은 선택). 한국어는 수식어가
  띄어쓰기 없이 붙어 한 토큰이 되므로 같은 선택이 "한글 전멸"이 된다. 어휘를 몇 개
  더 넣어 해결될 문제가 아니다 — **한국어 쪽 매칭 방식 자체에 대한 판단이 필요하다.**

---

## 5. STEP 5 — 해외 Query 실험 (확정하지 않는다)

이번에 확인한 구조적 사실 하나만 기록한다.

```
국내 경로  searchOneDomesticShop 이 query.searchTerms 사다리를 순서대로 던지고
           결과가 나오면 멈춘다                                (index.ts:316-322)
해외 경로  searchOneShop 은 사다리를 쓰지 않는다 — query.title 원문 하나뿐  (index.ts:194)
           그리고 /api/comparison/search 는 searchTerms 를 만들지도 않는다
```

즉 **같은 판정기를 쓰면서 질의 정책은 두 경로가 다르다.** 해외는 정제되지 않은
10단어 영문 제목이 그대로 나간다.

또 하나: 화면 경로의 DNA는 `identityDnaFromFields`로 만들어지고 그 함수는
`category: null`을 넣는다 → `productTypeTokenOf`가 빈 문자열 → 사다리의 ②/③칸이
합쳐진다. 저장 경로(`run-domestic-price-check`)는 실제 DNA를 써서 유형 토큰이 산다.
**두 경로의 질의가 같지 않다.** 고치지 않았다(범위 밖) — 기록만.

### 5-1. 18개 상품에서 실제로 나간 1차 질의 (기록만 · 최종 질의를 확정하지 않는다)

| 1차 질의의 모양 | 상품 수 | 관측 |
|---|---|---|
| **브랜드 품번 단독**(`B226AC009`, `01325`, `KS106168-P05261` …) | 10 | 원본 판매처에서 그 상품을 1위로 물어온다. 다만 §7-2 — 판매처가 같은 품번을 여러 상품에 쓰면 그 질의가 **여러 상품을 한꺼번에** 물어온다 |
| **브랜드 + 핵심명 + 색상**(품번이 없을 때) | 8 | Smallable 원본은 전부 이쪽이다(페이지에 브랜드 품번이 없다 — 직전 조사와 동일) |

숫자로 남길 만한 한 가지: 품번 단독 질의 10건은 **평균 7.3개 샵**에서 후보를 얻었고
(`[7,6,7,6,4,10,9,7,8,9]`), 그 외 8건은 평균 4.1개였다(`[2,1,1,1,9,1,8,10]`).
다만 뒤쪽 낮은 값들은 **429 차단 중이던 행**이다 — 차단이 없던 두 건은 9와 10이다.
즉 이 차이의 상당 부분은 질의가 아니라 차단이 만든 것이고, **이 차이를 규칙으로
굳히지 않는다.**

---

## 6. STEP 6 — 이미지 실험 (독립 유지 · Matching 미연결)

직전 결과는 재측정하지 않고 그대로 쓴다(첫 장만 비교해서 순서가 뒤집혔다 / 전체 쌍이면
정상 / pHash가 최선 / 단 정답쌍이 같은 원본 사진).

이번에 채운 칸은 **미측정으로 남아 있던 하나**다 — *국내 편집샵 자체 촬영 이미지 ↔
해외 편집샵 이미지*의 실제 동일상품 쌍. 그런 쌍이 데이터셋에 딱 하나 있다(PèPè Lulu
T-Bar Vernice Nero: junioredition ↔ 포레포레/DEUXBEBE, 셋 다 자기 사진을 쓴다).

### 6-1. 실측 (전부 로컬 계산 · `sharp` + 기존 `computeDifferenceHash` + pHash 실험값)

| 쌍 | 성격 | dHash 전체쌍 최소 | dHash 첫장만 | **pHash(contain) 전체쌍 최소** |
|---|---|---|---|---|
| JE Lulu T-Bar ↔ 포레포레 `PP24KASHE1195NER` | **동일상품** | 69 | 86 | **16** |
| JE Lulu T-Bar ↔ DEUXBEBE 페페 VERNICE NERO | **동일상품** | 86 | 114 | **26** |
| JE Lulu T-Bar ↔ 포레포레 `PP24KASHE3000NER` | 다른 스트랩 슈즈 | 95 | 103 | **22** |
| JE Lulu T-Bar ↔ RULII 페페 쪼리샌들 | 다른 상품 | 124 | 124 | 26 |
| JE Lulu T-Bar ↔ LOOXLOO 아페페양말 | 명백히 다름 | 119 | 119 | 32 |

### 6-2. 이 표가 말하는 것 — **직전 조사의 낙관은 일반화되지 않는다**

```
동일상품 26  >  비동일(다른 스트랩) 22     ← pHash 순서가 뒤집힌다
동일상품 86  vs 비동일 95                  ← dHash 여유가 9뿐이고, 현행 임계값 95면
                                             비동일 쌍까지 "강한 일치"로 들어온다
```

직전 조사에서 pHash가 동일 2 / 비동일 14로 7배 갈린 것은 **Smallable이 브랜드 공식
사진을 그대로 받아 쓰는 쌍**이었기 때문이다. 판매처가 각자 촬영하는 쌍에서는 그 분리가
사라지고 **역전까지 난다**. 표본이 5쌍뿐이지만, 방향이 뒤집힌다는 사실 자체가 "임계값을
조정하면 된다"는 길을 닫는다.

→ CEO 지시대로 이번에 연결하지 않는다. **그리고 이번 측정은 연결하지 않는 것이 옳다는
쪽의 증거다.**

```
❌ image score 를 Matching 축에 연결하지 않았다
❌ SAME 판정이 이미지 때문에 바뀌지 않는다
❌ threshold 변경 없음 (CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE = 95 그대로)
```

---

## 7. STEP 7 — Ground Truth 데이터셋 (18건)

선정 기준은 **편집샵이 실제로 취급하는 상품**이다(전부 운영 DB의 실제 등록 상품이고,
원본 판매처가 지금도 팔고 있는 것만 남겼다). 브랜드 9종(PePe · Bobo Choses · The
Animals Observatory · Konges Slojd · Main Story · Mini Rodini · Misha & Puff ·
Louis Louise · Liewood)과 시즌(SS25/SS26/AW26/Sale)을 섞었다.

측정은 **운영 코드 그대로**다(`searchDomesticShops` + `searchComparisonShops`,
질의는 `buildCrossSellerSearchQueries`). `429` 열이 0이 아닌 행은 그 시점에 해외
9곳이 차단 중이라 국내 결과만 담긴 행이다 - 지우지 않고 그대로 둔다(§0의 증거이기도 하다).

| # | 원본(등록상품) | 브랜드 | 브랜드 품번 | 1차 질의 | 검색된 샵 | 429 | 후보 | facts | SAME | PRESUMED | SIMILAR | UNKNOWN | CONFLICT | 판정 미실행 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | [Lulu T Bar Shoes in Vernice Nero by PèPè -](https://www.junioredition.com/en-kr/collections/pepe-shoes/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe) · junioredition.com | Pèpè Shoes | 01195-VERNICE-NERO | `01195-VERNICE-NERO` | 7/15 | 0 | 25 | 25 | 1 | 0 | 9 | 0 | 15 | 0 |
| 2 | [Hug Hairy Monster T-Shirt by Bobo Choses](https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses) · junioredition.com | Bobo Choses AW26 | B226AC009 | `B226AC009` | 6/15 | 0 | 16 | 16 | 1 | 0 | 3 | 2 | 10 | 0 |
| 3 | [Booty Ghosts Long Sleeve T-Shirt by Bobo C](https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses) · junioredition.com | Bobo Choses AW26 | B226AC010 | `B226AC010` | 7/15 | 0 | 23 | 23 | 1 | 0 | 3 | 2 | 17 | 0 |
| 4 | [Stamp Bloom All Over Denim Pants by Bobo C](https://www.junioredition.com/en-kr/collections/bobo-choses/products/stamp-bloom-all-over-denim-pants-by-bobo-choses) · junioredition.com | Bobo Choses AW26 | B226AC070 | `B226AC070` | 6/15 | 0 | 22 | 22 | 1 | 0 | 2 | 1 | 18 | 0 |
| 5 | [Curious Turnip All Over Swim Cap by Bobo C](https://www.junioredition.com/en-kr/products/curious-turnip-all-over-swim-cap-by-bobo-choses) · junioredition.com | Bobo Choses 60% Off Sale | B126AI018 | `B126AI018` | 4/15 | 0 | 16 | 16 | 1 | 0 | 0 | 3 | 12 | 0 |
| 6 | [Bobo Choses Organic Cotton T-shirt | Ecru](https://www.smallable.com/en/product/bobo-choses-organic-cotton-t-shirt-ecru-bobo-choses-430700) · smallable.com | Bobo Choses | 없음 | `Bobo Choses shirt Ecru` | 2/15 | 9 | 10 | 10 | 0 | 0 | 6 | 1 | 3 | 0 |
| 7 | [All About Monsters Washed T-shirt Organic ](https://www.smallable.com/en/product/all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632) · smallable.com | Bobo Choses | 없음 | `Bobo Choses all about monsters washed shirt Blue` | 1/15 | 9 | 5 | 5 | 0 | 0 | 1 | 0 | 4 | 0 |
| 8 | [Jean Holly Baby Hearts | Blue](https://www.smallable.com/en/product/jean-holly-baby-hearts-blue-louis-louise-441174) · smallable.com | Louis Louise | 없음 | `Louis Louise jean holly baby hearts Blue` | 1/15 | 9 | 5 | 5 | 0 | 0 | 0 | 0 | 5 | 0 |
| 9 | [Bobo Choses Zipped Sweat Organic Cotton | ](https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701) · smallable.com | Bobo Choses | 없음 | `Bobo Choses zipped sweat Heather grey` | 1/15 | 9 | 5 | 5 | 0 | 0 | 1 | 1 | 3 | 0 |
| 10 | [Pupfish Kid T-Shirt in Grey Heather by The](https://www.junioredition.com/collections/the-animals-observatory/products/pupfish-kid-t-shirt-in-grey-heather-by-the-animals-observatory) · junioredition.com | The Animals Observatory AW26 | F26100 | `F26100` | 10/15 | 0 | 40 | 40 | 1 | 0 | 2 | 1 | 36 | 0 |
| 11 | [Minnie Newborn Body in Rosetto by Konges S](https://www.junioredition.com/en-kr/collections/konges-slojd/products/minnie-newborn-body-in-rosetto-by-konges-slojd) · junioredition.com | Konges Sløjd Clothing AW26 | KS106168-P05261 | `KS106168-P05261` | 9/15 | 0 | 30 | 30 | 2 | 0 | 4 | 0 | 24 | 0 |
| 12 | [Bubble Sweatshirt in Grey Melange by Main ](https://www.junioredition.com/en-kr/collections/kids-clothing/products/bubble-sweatshirt-in-grey-melange-by-main-story) · junioredition.com | Main Story AW26 | AW26MS185 | `AW26MS185` | 7/15 | 0 | 28 | 28 | 2 | 0 | 6 | 0 | 20 | 0 |
| 13 | [Elephant Shrew Chenille Sweatshirt in Pink](https://www.junioredition.com/en-kr/collections/mini-rodini/products/elephant-shrew-chenille-sweatshirt-in-pink-by-mini-rodini) · junioredition.com | Mini Rodini AW26 | 2672013228 | `2672013228` | 8/15 | 0 | 32 | 32 | 1 | 0 | 0 | 0 | 31 | 0 |
| 14 | [Violas aop Winter jacket](https://houseofkids.com/products/mini-rodini-violas-aop-winter-jacket-blue) · houseofkids.com | Mini rodini | 없음 | `Mini rodini violas aop winter jacket` | 9/15 | 0 | 42 | 42 | 0 | 2 | 0 | 0 | 40 | 0 |
| 15 | [Striped organic cotton polo neck sweater |](https://www.smallable.com/en/product/striped-organic-cotton-polo-neck-sweater-blue-bobo-choses-430703) · smallable.com | Bobo Choses | 없음 | `Bobo Choses striped polo neck sweater Blue` | 1/15 | 9 | 5 | 5 | 0 | 0 | 2 | 0 | 3 | 0 |
| 16 | [Max Hearts Recycled Fiber UV Protection Sw](https://www.smallable.com/en/product/max-hearts-recycled-fiber-uv-protection-swimsuit-pink-liewood-409775) · smallable.com | Liewood | 없음 | `Liewood max hearts fiber uv protection swimsuit Pink` | 8/15 | 0 | 40 | 40 | 0 | 3 | 1 | 0 | 36 | 0 |
| 17 | [Baby Circus Stripe Cardigan in Antique Ros](https://www.junioredition.com/en-kr/collections/misha-puff/products/baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff) · junioredition.com | Misha & Puff Fall 26 | B1408F26-670 | `Misha & Puff Fall 26 baby circus stripe cardigan Antique Rose` | 10/15 | 0 | 42 | 42 | 3 | 0 | 0 | 0 | 39 | 0 |
| 18 | [Giulia Flower Sandals in Ombretto Pink by ](https://www.junioredition.com/products/giulia-flower-sandals-in-ombretto-pink-by-pepe) · junioredition.com | Pèpè Shoes 50% Off | 01325 | `01325` | 9/15 | 0 | 34 | 34 | 4 | 0 | 0 | 0 | 30 | 0 |

### SAME / PRESUMED_SAME 로 올라온 후보 전체 (사람이 확인할 목록)

| # | 판정 | 판매처 | 상품명 | 가격 | URL | 대표 이미지 |
|---|---|---|---|---|---|---|
| 1 | SAME | junioredition.com | Lulu T Bar Shoes in Vernice Nero by PèPè - Last On | 119 GBP | https://junioredition.com/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe | https://cdn.shopify.com/s/files/1/0874/8574/files/Pepe-SS25-Lulu-T-Bar-Shoes-Vernice-Nero.jpg?v=1740567403 |
| 2 | SAME | junioredition.com | Hug Hairy Monster T-Shirt by Bobo Choses | 37 GBP | https://junioredition.com/products/hug-hairy-monster-t-shirt-by-bobo-choses | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Hug-Hairy-Monster-T-Shirt_a4e1b85d-5763-471f-8fed-dbfa6bfe2720.jpg?v=1784286493 |
| 3 | SAME | junioredition.com | Booty Ghosts Long Sleeve T-Shirt by Bobo Choses | 37 GBP | https://junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Booty-Ghosts-Long-Sleeve-T-Shirt.jpg?v=1784286195 |
| 4 | SAME | junioredition.com | Stamp Bloom All Over Denim Pants by Bobo Choses | 90 GBP | https://junioredition.com/products/stamp-bloom-all-over-denim-pants-by-bobo-choses | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Stamp-Bloom-All-Over-Denim-Pants.jpg?v=1784288131 |
| 5 | SAME | junioredition.com | Curious Turnip All Over Swim Cap by Bobo Choses -  | 21.6 GBP | https://junioredition.com/products/curious-turnip-all-over-swim-cap-by-bobo-choses | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Curious-Turnip-All-Over-Swim-Cap-2.jpg?v=1768483793 |
| 10 | SAME | junioredition.com | Pupfish Kid T-Shirt in Grey Heather by The Animals | 31 GBP | https://junioredition.com/products/pupfish-kid-t-shirt-in-grey-heather-by-the-animals-observatory | https://cdn.shopify.com/s/files/1/0874/8574/files/The-Animals-Observatory-AW26-Pupfish-Kid-T-Shirt-Medium-Heather-Grey.jpg?v=1784901690 |
| 11 | SAME | junioredition.com | Minnie Newborn Body in Rosetto by Konges Sløjd | 28 GBP | https://junioredition.com/products/minnie-newborn-body-in-rosetto-by-konges-slojd | https://cdn.shopify.com/s/files/1/0874/8574/files/Konges-Slojd-AW26-Minnie-Newborn-Body-Rosetto-2.jpg?v=1783962724 |
| 11 | SAME | junioredition.com | Minnie Newborn Onesie in Rosetto by Konges Sløjd | 42 GBP | https://junioredition.com/products/minnie-newborn-onesie-in-rosetto-by-konges-slojd | https://cdn.shopify.com/s/files/1/0874/8574/files/Konges-Slojd-AW26-Minnie-Newborn-Onesie-Rosetto-1.jpg?v=1783962783 |
| 12 | SAME | junioredition.com | Bubble Sweatshirt in Grey Melange by Main Story | 57 GBP | https://junioredition.com/products/bubble-sweatshirt-in-grey-melange-by-main-story | https://cdn.shopify.com/s/files/1/0874/8574/files/Main-Story-AW26-Bubble-Sweatshirt-Grey-Melange.jpg?v=1786095760 |
| 12 | SAME | junioredition.com | Bubble Sweatshirt in Graystone by Main Story | 57 GBP | https://junioredition.com/products/bubble-sweatshirt-in-graystone-by-main-story | https://cdn.shopify.com/s/files/1/0874/8574/files/Main-Story-AW26-Bubble-Sweatshirt-Graystone.jpg?v=1786095718 |
| 13 | SAME | junioredition.com | Elephant Shrew Chenille Sweatshirt in Pink by Mini | 55 GBP | https://junioredition.com/products/elephant-shrew-chenille-sweatshirt-in-pink-by-mini-rodini | https://cdn.shopify.com/s/files/1/0874/8574/files/Mini-Rodini-AW26-Elephant-Shrew-Chenille-Sweatshirt-Pink.jpg?v=1786449075 |
| 14 | PRESUMED_SAME | junioredition.com | Violas Puffer Jacket in Blue by Mini Rodini | 120 GBP | https://junioredition.com/products/violas-puffer-jacket-in-blue-by-mini-rodini | https://cdn.shopify.com/s/files/1/0874/8574/files/Mini-Rodini-AW26-Violas-Puffer-Jacket-Blue-1.jpg?v=1784883286 |
| 14 | PRESUMED_SAME | junioredition.com | Violas Heavy Hooded Puffer Jacket in Multi by Mini | 130 GBP | https://junioredition.com/products/violas-heavy-hooded-puffer-jacket-in-multi-by-mini-rodini | https://cdn.shopify.com/s/files/1/0874/8574/files/Mini-Rodini-AW26-Violas-Heavy-Hooded-Puffer-Jacket-Multi.jpg?v=1787668068 |
| 16 | PRESUMED_SAME | folkberlin.com | UV Swim Jumpsuit ''Tuscany Rose'' | 22 EUR | https://folkberlin.com/products/swim-jumpsuit-tuscany-rose | https://cdn.shopify.com/s/files/1/0543/4900/4997/products/babyschwimkleidung.png?v=1642856422 |
| 16 | PRESUMED_SAME | folkberlin.com | UV Swim Jumpsuit ''Leopard'' | 35 EUR | https://folkberlin.com/products/swim-jumpsuit-leopard | https://cdn.shopify.com/s/files/1/0543/4900/4997/products/Max-swim-jumpsuit_LW17602_1493_Leopard-Sandy_1-23_1.w610.h610.fill.webp?v=1677756510 |
| 16 | PRESUMED_SAME | folkberlin.com | Maxime Baby Long Sleeve Swimsuit ''Sea Creature'' | 38.5 EUR | https://folkberlin.com/products/maxime-baby-long-sleeve-swimsuit-sea-creature | https://cdn.shopify.com/s/files/1/0543/4900/4997/files/Liewood_maxime_long_sleeve_swimsuit_jpg.webp?v=1705050169 |
| 17 | SAME | junioredition.com | Baby Circus Stripe Cardigan in Antique Rose by Mis | 159 GBP | https://junioredition.com/products/baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff | https://cdn.shopify.com/s/files/1/0874/8574/files/Misha-And-Puff-Fall-26-Baby-Circus-Stripe-Cardigan-Antique-Rose.jpg?v=1787238015 |
| 17 | SAME | junioredition.com | Baby Circus Stripe Romper in Antique Rose by Misha | 151 GBP | https://junioredition.com/products/baby-circus-stripe-romper-in-antique-rose-by-misha-puff | https://cdn.shopify.com/s/files/1/0874/8574/files/Misha-And-Puff-Fall-26-Baby-Circus-Stripe-Romper-Antique-Rose_6951604c-3747-4b4f-8c3d-20f42cf139dc.jpg?v=1787238075 |
| 17 | SAME | junioredition.com | Circus Stripe Cardigan in Mink by Misha & Puff | 183 GBP | https://junioredition.com/products/circus-stripe-cardigan-in-mink-by-misha-puff | https://cdn.shopify.com/s/files/1/0874/8574/files/Misha-And-Puff-Fall-26-Circus-Stripe-Cardigan-Mink.jpg?v=1787239550 |
| 18 | SAME | junioredition.com | Giulia Flower Sandals in Ombretto Pink by PèPè | 70 GBP | https://junioredition.com/products/giulia-flower-sandals-in-ombretto-pink-by-pepe | https://cdn.shopify.com/s/files/1/0874/8574/files/Pepe-SS25-Giulia-Flower-Sandals-Ombretto-Pink-4.jpg?v=1750333655 |
| 18 | SAME | junioredition.com | Giulia Flower Sandals in Bubblegum Pink Patent by  | 70 GBP | https://junioredition.com/products/giulia-flower-sandals-in-bubblegum-pink-patent-by-pepe | https://cdn.shopify.com/s/files/1/0874/8574/files/Pepe-SS25-Giulia-Flower-Sandals-Bubblegum-Pink-Patent-1.jpg?v=1750333649 |
| 18 | SAME | junioredition.com | Giulia Flower Sandals in Camelia by PèPè | 124 GBP | https://junioredition.com/products/giulia-flower-sandals-in-camelia-by-pepe | https://cdn.shopify.com/s/files/1/0874/8574/files/Pepe-SS25-Giulia-Flower-Sandal-Camelia-6.jpg?v=1750333654 |
| 18 | SAME | junioredition.com | Giulia Flower Sandals in Cacao by PèPè | 124 GBP | https://junioredition.com/products/giulia-flower-sandals-in-cacao-by-pepe | https://cdn.shopify.com/s/files/1/0874/8574/files/Pepe-Giulia-Flower-Sandals-Cacao.jpg?v=1750333631 |


### 7-1. 자동 검증 가능 / 사람이 봐야 하는 것

```
자동 검증 가능 (사람 불필요)
  후보에 facts 가 실렸는가            18건 전부 · 후보 400건 전부 OK (판정 미실행 0건)
  판정이 실행됐는가                    후보 400건 전부 OK
  브랜드/상품군 불일치가 CONFLICT 인가  CONFLICT 356건 - 표본 확인 전부 다른 브랜드/상품군
  원본 상품 자신을 SAME 으로 맞히는가   자기 판매처가 검색된 14건 전부 OK
  이미지 URL 이 실제로 열리는가         위 목록 전부 200 image/*

사람이 봐야 하는 것 - 딱 두 묶음, 총 10건
  (1) 아래 7-2 의 거짓 SAME 7건  (CEO 판단이 필요한 정책 질문 1개로 압축된다)
  (2) PRESUMED_SAME 3건(#16 folkberlin Liewood 수영복) - 참고 등급이라 급하지 않다
```

### 7-2. 데이터셋이 드러낸 것 - **거짓 SAME 7건, 원인은 전부 하나**

SAME 22건 중 14건은 "원본 상품 자신"(정상)이고, 나머지 8건 중 **7건이 거짓**이다.
전부 §3-4의 같은 기전이다 - 판매처가 여러 상품에 같은 `Product Code`를 적는다.

| # | 원본 | 거짓 SAME 상대 | 공유된 품번 | 왜 다른 상품인가 |
|---|---|---|---|---|
| 11 | Minnie Newborn **Body** | Minnie Newborn **Onesie** | `KS106168-P05261` | 바디수트 vs 우주복 |
| 12 | Bubble Sweatshirt **Grey Melange** | Bubble Sweatshirt **Graystone** | `AW26MS185` | 다른 색 |
| 17 | Baby Circus Stripe **Cardigan** Antique Rose | Baby Circus Stripe **Romper** Antique Rose | 공유 | 가디건 vs 롬퍼 |
| 17 | 위와 같음 | Circus Stripe Cardigan **Mink** | 공유 | 다른 색 · 베이비 아님 |
| 18 | Giulia Flower Sandals **Ombretto Pink** | 같은 모델 **Bubblegum Pink Patent** | `01325` | 다른 색 · 다른 소재 |
| 18 | 위와 같음 | 같은 모델 **Camelia** | `01325` | 다른 색(가격도 70 vs 124) |
| 18 | 위와 같음 | 같은 모델 **Cacao** | `01325` | 다른 색(가격도 70 vs 124) |

주목: 같은 판매처가 **일관성조차 없다** - PePe Lulu는 품번에 색을 붙이고
(`01195-VERNICE-NERO`) Giulia는 붙이지 않는다(`01325`). 즉 "품번에 색이 들어간다"를
가정할 수도 없다.

이 7건은 전부 `identifierConfirmed -> 즉시 SAME`(cross-seller.ts:487) 경로이고,
**보류도 축 점수도 보지 않는다.** #18은 `430651 vs B226AC042/043`(색상만 다른 상품)을
막으려고 만든 `compareModelCode` 규칙이 **정확히 같은 상황에서 무력화되는** 사례다 -
그때는 품번이 달랐고(`...042` vs `...043`) 이번에는 품번이 아예 같다.

**고치지 않았다.** "식별자가 같으면 같은 상품"은 이 저장소 판정의 뿌리 전제이고,
그것을 바꾸는 것은 threshold 조정이 아니라 정책 변경이다(보고서 §11 참고).

---

## 8. 절대 금지 조항 준수 확인

```
bobochoses.com 추가/활성화        하지 않음 (두 테이블 행 그대로)
임의 편집샵 추가·활성화            하지 않음
threshold / SAME_MIN_AXES 변경    하지 않음
한국어 synonym 대량 추가           하지 않음 (§4-5에 기록만)
검색어 확장으로 문제 해결          하지 않음 (질의 한 줄도 바꾸지 않았다)
이미지 Matching 통합               하지 않음
가격 계산 / MI UI / 채널 등록 변경  하지 않음
특정 상품 hardcode / Bobo 예외처리  하지 않음
unrelated refactor                하지 않음
vercel --prod                     하지 않음 (Git 연동 배포)
DB write / 마이그레이션            하지 않음 (SELECT만)
토큰/커넥션 문자열 출력            하지 않음
임시 스크립트 저장소 잔류          없음 (전부 삭제)
```
