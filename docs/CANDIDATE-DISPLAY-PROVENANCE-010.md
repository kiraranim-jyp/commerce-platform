# WU-010 STEP 1 — 화면 후보의 **실제 source 확정**

> 🔴 외부 AI 0 · Gemini 0 · 검색 API 0 · 키 0 · 결제 0 · Registry 변경 0 · schema 0 ·
> DB 쓰기 0 · 환산 0 · 임계값 0 · **Production 배포 0** · 비용 ₩0.
>
> 🟢 **결과: 후보를 화면에 넣는 경로는 «셋» 이고 전수로 셌다.** 그중 둘은 이 상품에서
> **표시 0 으로 측정** 됐고, 🔴🔴 **세 번째가 남았으며 그것이 실제로 살아 있다.**

---

## 1. 🟢 전수 — 후보가 화면에 도착하는 경로는 **셋**

```
① 저장된 링크 (DB)
   DomesticPriceIntelligencePanel.tsx:1842
   GET /api/domestic-price-sources/links?snapshotId=…
   → sortDomesticCandidatesByTrust → 패널 후보 목록

② transient 국내 라이브 검색  🔴 **DB 가 아니다**
   DomesticShopSearch.tsx:180 (렌더: CommerceWorkspace.tsx:3808)
   POST /api/domestic-price-sources/search
   → searchDomesticShops → excludeSelfReference → attachMatchTruth
   → route.ts:220 `NextResponse.json({ ok: true, results })`
   → 화면 게이트 `mayShowCandidate`

③ transient **해외** 라이브 검색  🔴 **DB 가 아니다**
   ComparisonShopSearch.tsx:218
   POST /api/comparison/search
   → listComparisonShops → searchComparisonShops → attachProductMatchTruth
   → 화면 게이트 `mayShowCandidate`(같은 문)
```
🟢 `candidates` 를 돌려주는 API 라우트 전수에서 **상품 상세 화면에 후보를 공급하는 것은
이 셋뿐** 이다(나머지는 카테고리 추천·소싱 후보 등 다른 화면이다).

---

## 2. 🟢 ①② 는 이 상품에서 **표시 0** — 측정했다

### ① 저장된 링크 = **0행**
WU-008 실측: `B226AC117` 의 13 스냅샷 전부 `domestic_product_links` **0건**.
🟢 이유도 코드로 확정됐다 — `judgeDomesticCandidate` 가 DROPPED/`NOT_MATCHED` 를 내면
`run-domestic-price-check.ts:1087·1106` 의 `continue` 가 **upsert 앞에서** 끊는다.
→ 🟢 패널 후보 목록에는 **아무것도 그려지지 않는다.**

### ② transient 국내 = 후보 5건 · **표시 0건** (운영 함수로 재현)
```
searchDomesticShops → excludeSelfReference(제외 0) → attachMatchTruth
후보 **5건** 전부 looxloo.com (BLUEDOG 레깅스/가디건/우주복 · 머플러 · 턱받이)
matchTruth 분포   **INSUFFICIENT_EVIDENCE 5/5**
displayTier 분포  **UNKNOWN 5/5**
🔴 화면 표시 대상 **0 / 5**  ← `mayShowCandidate` 가 전건 차단
```
🟢 그리고 **「더 보기」에도 없다** — `DomesticShopSearch.tsx:571-583` 주석이 명시한다:
> 「관련성이 낮아 목록에 설 수 없는 후보 → **아예 없다**(hiddenRows 를 쓰지 않는다).
>  관련성은 통과했는데 상위 3건 밖인 후보 → 「더 보기」에 남는다(g.overflow).」

🔴 즉 **②는 이 상품에서 화면에 한 건도 그리지 않는다.**

---

## 3. 🔴🔴 ③ 해외 경로가 **남았고, 이 상품에서 실제로 살아 있다**

운영 DB `comparison_shops` 전수(35행)에서 **읽기 전용** 확인:
```
bobochoses.com   access_status=null   **is_active = true**   scope ["KIDS_FASHION"]
(그 외 junioredition · smallable · designerkidswear · nickis … 전부 active)
```

🔴 **그래서 해외 비교 구역은 이 Bobo Choses 상품으로 `bobochoses.com` 을 검색한다.**
🔴 그리고 **브랜드가 빈 값** 이라(WU-009 §A) 질의가 상품명 기반으로 나간다 —
WU-007 에서 내가 `bobochoses.com/search/suggest.json` 에 그런 질의를 넣었을 때 받은 것이
**정확히 Gift Bag · Veja 운동화** 였다.

### 🟢🟢 측정 완료 — **③은 무관한 상품을 실제로 화면에 올린다**

운영 필터(`isActive && isCollectableAccess && sourceFitsScopes`)와 운영 함수
(`searchComparisonShops` → `attachProductMatchTruth` → `overseasMatchDisplay` →
`mayShowCandidate`)를 **그대로** 돌렸다.

```
대상 샵 **30** · 응답 30 · 🔴 오류 **20** · 후보 **31**
productMatchTruth  CONFLICT **18** · SIMILAR **7** · INSUFFICIENT_EVIDENCE **6**
🔴🔴 화면 표시 대상 **1 / 31**
   junioredition.com · 「Elovera Jacket in Washed Grey Denim by **ICHI**」 · **GBP 39**
   productMatchTruth **SIMILAR** · matchLevel low · confidence **0.33**(≥ 0.2) → 보인다
   🔴 원상품은 Bobo Choses `B226AC117` ¥26,400 — **브랜드도 상품도 다르다**
```

🟢 **게이트는 30/31 을 막았다** — CONFLICT 18 · UNKNOWN 6 은 기본 노출에서 빠지고,
SIMILAR 7 중 **6건은 confidence 0.14~0.17 로 하한(0.2) 미달** 이라 차단됐다.
🔴 통과한 1건의 confidence 0.33 은 제목에서 **`jacket` 한 단어** 가 겹친 결과로 보인다
(원상품 "B.C. Embossed tracksuit **jacket**" ↔ 후보 "Elovera **Jacket** in Washed Grey Denim").

🔴 **그래서 ②와 ③의 성질이 다르다**:
```
② 국내 transient — 5건 전부 INSUFFICIENT_EVIDENCE → **표시 0**
③ 해외 transient — 31건 중 **1건이 SIMILAR 로 표시된다**  ← CEO 가 본 것과 같은 성질
```

### 🔴 단정하지 않는 것 셋
```
① 「CEO 가 본 것이 바로 이 ICHI 재킷이다」로 **단정하지 않는다** — 로그인 뒤 DOM 을 읽을 수 없다.
   🟢 확정된 것은 「③이 무관한 상품을 표시 대상으로 만든다」는 **성질** 이다.
② 🔴 **샵 20/30 이 오류였다.** 그 샵들이 응답하면 표시 후보가 더 늘 수 있다 — 이 숫자는
   **하한** 이고 전수가 아니다.
③ 「브랜드가 있었으면 CONFLICT 가 됐을 것」이라고 **단정하지 않는다.** 이번 질의의
   `brand` 는 **null** 이었다(WU-009 §A). 🟡 그 반사실은 **같은 HTTP 로 1회 더 돌려
   측정 가능** 하다 — 브랜드만 주입해 ICHI 후보가 CONFLICT 로 바뀌는지 보는 것이고,
   그것이 WU-009-A 의 가치를 **추정 없이** 재는 방법이다(CPO 결정 입력).
```

---

## 4. 🔴 그리고 내가 정직하게 적어야 할 것 하나

「Gift Bag / Veja」라는 **이름은 내 WU-007 보고서에서 나왔다.** 그 표현이 CEO 테스트
시나리오(②)에 그대로 들어갔고, FAIL 보고도 그 어휘로 돌아왔다.
🔴 그래서 **CEO 가 실제로 그 두 품목을 봤는지, 아니면 다른 무관 상품을 봤는지는 구분되지
않는다.** 🔴 로그인 뒤 화면은 CTO 가 읽을 수 없다(메모 `production-payload-is-unreachable`).
🟢 다만 ③ 경로가 그 두 품목을 **실제로 돌려줄 수 있다**는 것은 WU-007 실측으로 확정이다.

---

## 5. 🟢 STEP 2 — 저장 게이트는 건드리지 않았다 · low 노출 정책의 현재 사실

```
🟢 요구「DROPPED/NOT_MATCHED → 저장 안 함」           **이미 그렇다**(§2-①)
🟢 요구「low 가격을 판정/최저가/대표가에 쓰지 않음」   **이미 그렇다**(저장 0 → tier 진입 불가)
🟢 요구「LOW/NOT_MATCHED → 동일상품 후보 UI 제거」     **이미 그렇다**(§2-② · 더 보기에도 없음)
🔴 요구「참고 후보로 다시 보여주지 않는다」            **그런 기능이 없다** — 만들지 않았다
```

🔴🔴 **그리고 「low 를 화면에서 빼라」를 `matchLevel` 로 구현하면 안 된다** — 하니스 ①-4 가
그것을 단언으로 잠갔다. 리포 기록(`DomesticShopSearch.tsx:60-67`, P-24 Sprint 2):
> 진짜 동일상품(포레포레 · `STRONG_IDENTIFIER` · SKU 일치)의 confidence 가 **0.42(= low)**
> 였고, 그때 걸려 있던 `matchLevel !== "low"` 필터가 그 후보를 숨겼다 → **의도적으로 제거** 됐다.

🟢 현재 축은 `matchTruth`(식별 증거) + `confidence >= MIN_DISPLAY_SIMILARITY(0.2)` 다.
🔴 `matchLevel` 은 표시 게이트의 **입력이 아니다.**

---

## 6. 🔴 STEP 3 — 「시장 부재」를 기록할 자리: **조사 결과 없다**

`price_observations` 칸 전수(읽기 전용 확인):
```
id · snapshot_id · source · source_label · source_product_url · currency ·
price_amount · shipping_cost_amount · tax_amount · exchange_rate · price_krw ·
checked_at · created_at · source_ref_id · sale_price_krw · original_price_krw ·
sold_out · market_code · market_country · shipping_policy_status · shipping_policy_note
```
🔴 **「probe 했고 404 였다」를 담을 칸이 없다.** 관측은 **행이 생기는 것** 으로만 표현되고,
시장이 없으면 **행이 없다** → 「미관측」과 「시장 부재」가 **같은 모양** 이다.

🟡 **기존 자리 후보 둘**(🔴 둘 다 CPO 승인 없이 쓰지 않았다):
```
⒜ `shipping_policy_status` 처럼 **상태 문자열 칸을 하나 더** 두는 방식
   🟢 선례가 같은 테이블에 있다(정책 상태를 행에 적는다)
   🔴 그러나 「가격이 없는 관측 행」을 만드는 것이 되어 **읽는 쪽 4곳이 모두 영향**
      받는다(헌장 §12 의 `overseas-observation-storage-impact` 교훈).
⒝ `domestic_price_sources.last_error_code` 처럼 **시도 기록을 샵/상품 축에 두는** 방식
   🔴 현재 그 축은 «샵» 단위이고 «상품×시장» 단위가 아니다.
```
🔴 그래서 **최소 상태 모델 제안은 CPO 결정 뒤에** 올린다. 🔴 새 테이블을 먼저 만들지 않았다.

---

## 7. 검증
```
WU-010 하니스  사전검증 **4 passed**(HTTP 0) + 실측 1 passed · AI 0 · 키 0 · 결제 0
🔴 실측에서 반환 모양을 한 번 추측해 깨졌다 — `excludeSelfReference` 는 배열이 아니라
   `{ results, excluded }` 다. 🟢 route.ts:215 와 **같은 분해** 로 고쳤다.
🔴 그리고 DB 칸을 또 추측해 깨졌다 — `comparison_shops.enabled` 는 없고 **`is_active`** 다
   (42703). 이 트랙 **열한 번째** 같은 실수다.
회귀/typecheck/build  (§본문 보고 참조)
```

---

# WU-010A — 브랜드 **반사실** 측정 결과

🔴 임계값·게이트·판정 로직 변경 **0** · AI 0 · 키 0 · 결제 0 · DB 쓰기 0 · 운영 변경 **0** ·
배포 0. 🟢 B 의 브랜드는 **원본 상품 URL 의 `og:site_name` 실측값** 이고 운영 규칙이 아니다.

```
A  brand 공백        대상 샵 30 · 오류 20 · 후보 31 · 표시 **0**
B  brand "Bobo Choses" 대상 샵 30 · 오류 20 · 후보 31 · 표시 **0**
공통 후보 **31**
🔴🔴 판정이 바뀐 후보 **0** · 표시가 바뀐 후보 **0**
A→B 전이  CONFLICT→CONFLICT 18 · SIMILAR→SIMILAR 6 · INSUFFICIENT→INSUFFICIENT 7
```

## 🔴 판정 — CPO 기준의 **두 번째 갈래** 다

> 「B 에서도 그대로 SIMILAR 라면 → 브랜드 공백만으로 설명할 수 없다」

🟢 **브랜드 주입은 31건 전부에서 판정을 한 건도 바꾸지 않았다.** 특히 SIMILAR 6건이
**그대로 SIMILAR** 다 — ICHI 와 같은 등급이다.
→ 🔴 **브랜드 공백은 이 판정 결과의 원인이 아니다**(이 후보 집합에서).

## 🔴🔴 그런데 **직전 관측이 이 실행에서 재현되지 않았다** — 먼저 적는다

```
직전(③)  SIMILAR 7 · INSUFFICIENT 6 · **표시 1**(ICHI · confidence 0.33)
이번(④)  SIMILAR 6 · INSUFFICIENT 7 · **표시 0** · 🔴 ICHI 후보가 **집합에 없다**
```
🔴 즉 그 ICHI 후보는 **이번 두 arm 어디에도 나타나지 않았다.** 그래서
**「그 후보에 대한 브랜드 효과」는 측정되지 않았다**(공통 집합에 없으므로).
🔴 그리고 **「표시 1」은 실행마다 재현되지 않는다** — 샵 응답이 매번 다르다(오류 20/30).
→ 🔴 **「해외 경로는 평균 1건을 띄운다」로 일반화하지 않는다.** 관측은 **불안정** 하다.

## 🟡 그래서 다음은 CPO 기준대로 **SIMILAR 판정 경로 조사** 다

🔴 다만 조사 전에 **먼저 확인해야 할 가설 하나** 가 생겼다 — 브랜드를 주입해도
**아무 축도 바뀌지 않았다**는 것은 「후보 쪽에 브랜드가 없어서 브랜드 축이 애초에
비교되지 않는다」는 뜻일 수 있다(그러면 원상품 브랜드를 채워도 효과가 0 이다).
🟢 그것은 후보 facts 의 brand 칸을 보는 것으로 **HTTP 추가 없이** 확인된다.
🔴 단정하지 않는다 — 다음 단위의 첫 측정으로 둔다.

🔴 **샵 20/30 오류는 P1 로 유지** 한다(CPO). 이 상태에서 나온 표시 숫자를 해외 Discovery
품질로 일반화하지 않는다.

---

# WU-011 — 해외 검색 **신뢰도: 샵별 원인 분류** (분류만)

🔴 threshold 변경 **0** · SIMILAR 차단 0 · brand resolver 0 · 검색 query 변경 **0** ·
Registry 0 · AI/API 0 · 배포 0 · 운영 코드 변경 **0** · DB 쓰기 0.

## 🔴🔴 결론 — **「오류 20/30」은 오류가 아니었다**

```
대상 샵 **30** · 총 소요 **1,261ms**
status 분류   **unsupported 20** · **ok 10** · 🟢 **error 0** · not_configured 0
🔴 error 문자열을 들고 온 샵 **0건**
```

🔴🔴 내가 앞서 적은 「오류 20」은 `status !== "ok"` 였다. 운영 타입이 **네 상태** 를 명시적으로
가르고(types.ts:139-154) 그 주석이 **바로 이 뭉개기를 금지** 한다:
> `unsupported` = 이 소스를 읽을 **파서/어댑터가 없다 — 요청을 보내지 않았다**
> 🔴 「물어보지도 못한 것을 **없다**고 말하지 않는다」

🟢 **교차 증거**: 전체가 **1.26초** 에 끝났다. 20곳이 네트워크 실패/타임아웃이었다면 불가능하다.

### 🔴 그래서 정체는 «실패» 가 아니라 **어댑터 커버리지** 다
```
🔴 unsupported 20 — 요청 자체를 보내지 않는다
   alexandalexa · aliexpress · amazon · babyshop · **bobochoses.com** ·
   bucketsandspades · cissyweras · ebay · kids-world · kidsdepartment ·
   kidsroom · luksusbaby · melijoe · mytheresa · pandaandcub · scoutandcokids ·
   shopping.google · **smallable.com** · studioplay · walmart
🟢 ok 10 — childrensalon · designerkidswear · folkberlin · isolabellakids ·
   junioredition · kidbizkid · nickis · petitemaisonkids · shoppiccoliandco · villagekids
```
🔴🔴 **`bobochoses.com` 과 `smallable.com` 이 `unsupported` 다** — 등록부에 `is_active`
여도 **검색되지 않는다.** 🟢 그래서 「Gift Bag 이 bobochoses.com 에서 왔다」는 경로는
**이 실행에서는 성립하지 않는다**(요청이 나가지 않는다).

## 🟢 ok 샵만의 후보 품질 (분모를 섞지 않았다)
```
ok 10 중 **후보 0건인 샵 3** — childrensalon · folkberlin · isolabellakids
후보 총수 **29** — CONFLICT **18** · SIMILAR **5** · INSUFFICIENT_EVIDENCE **6**
🔴 표시 대상 **0** — SIMILAR 5건의 confidence 가 **0.14 · 0.17 · 0.17 · 0.17 · 0.17**
   로 전부 하한(0.2) 미달
```
🟢 **「표시 0」이 2회 연속 재현** 됐다(WU-010A ④ · WU-011 ⑤).
🔴 그리고 ICHI(conf 0.33)는 **3회 실행 중 1회만** 나타났다 → **예외적 관측** 이다.
🔴 **그 1건으로 임계값을 조작하지 않는다**(CPO 지시와 같은 결론).

## 🔴 이 숫자로 하지 않을 해석
```
❌ 「해외 샵이 불안정하다」      → 🟢 error 0 이다. 불안정한 것은 **커버리지** 가 아니라
                                 **어느 샵이 후보를 내놓는지** 다
❌ 「30곳을 검색한다」           → 🔴 실제로 요청이 가는 곳은 **10곳** 이다
❌ 「해외 Discovery 품질 = 29건」 → 🔴 분모가 **ok 10** 이고 등록부 30 이 아니다
❌ 1회 관측을 재현성으로 사용     → 🔴 ICHI 가 1/3 회만 나타났다
```

## 🟡 CPO 결정 입력 — 측정으로 좁혀진 선택지
```
⒜ 어댑터 없는 20곳 중 **무엇을 열 것인가** 는 🔴 Registry/어댑터 확대라 금지 구간이다
   🟢 다만 「30곳 중 10곳만 검색된다」는 사실은 **화면이 말하지 않는다** — 셀러는
      30곳을 봤다고 읽을 수 있다. 그 표시 문제는 코드 확대 없이 고칠 수 있다(CPO 판단).
⒝ confidence 하한은 **건드리지 않았다.** 🟢 현재 데이터에서 하한이 실제로 일하고 있다
   (0.17 × 4 · 0.14 를 전부 막았다).
⒞ 🔴 **재현성** 이 별 사안으로 남는다 — 같은 상품·같은 샵인데 실행마다 후보 집합이
   달라진다(ICHI 1/3). 원인은 미조사다.
```

---

# WU-013 — Fetch Cache Audit (**코드 읽기만** · HTTP 0)

🔴 코드 수정 0 · HTTP 재실행 0 · threshold/SIMILAR/brand/Registry/adapter/query/AI 0 · 배포 0.

## 결론

```
프로세스 내 캐시                    **NO**
HTTP / Next fetch cache             **NO**
외부 캐시(Redis/KV/DB)              **NO**
request dedupe                      **NO**
WU-012 3회 반복이 캐시 영향을 받을 가능성   **NO** (우리 코드 기준)
```

## 근거 — 파일 + 함수 + 코드

```
① fetch 옵션 전수   `cache:`/`revalidate`/`next: {}` → packages/crawler/src 와
   apps/admin/src/app/api/{comparison,domestic-price-sources} 에 **0건**
   → Next fetch 캐시에 **opt-in 한 곳이 없다**
② 외부 캐시        `redis|upstash|@vercel/kv|memcach` → 리포 전체 **0건**
③ module-level 캐시 crawler 전체에서 `new Map`/`new Set` 상수는 **둘뿐**
     match.ts:6            `STOPWORDS`      — 불변 단어 집합(응답 아님)
     domain-rate-limiter.ts:18 `DOMAIN_STATE` — 호스트별 **rate-limit 상태**
       (`blockedUntil` 등). 🔴 **응답 본문을 담지 않는다** → 캐시가 아니다
④ 실제 fetch       domain-rate-limiter.ts:162 `fetchWithDomainRateLimit`
     `let response = await fetch(url, init)` → **매번 네트워크로 나간다**
     429 일 때만 backoff 재시도 · 🔴 결과 저장/재사용 코드 **없음**
⑤ shopify fetcher  shopify-product-json.ts · shopify-suggest.ts 에
     `memo|cached|new Map` **0건**
⑥ 라우트 선언      `export const revalidate` / `dynamic` / `unstable_cache` →
     두 API 디렉터리에 **0건**
```

🟢 **그리고 WU-012 하니스는 Next 런타임이 아니라 vitest/Node 에서 돌았다** — Next 의
fetch 패치가 **적용되지 않는 환경** 이다. 즉 평범한 undici `fetch` 이고 응답 캐시가 없다.

## 🔴 그래서 WU-012 해석은 **유지** 된다 — 단 원인은 여전히 외부다

```
🟢 3회가 동일한 것은 **우리 캐시 때문이 아니다**(위 ①~⑥).
🔴 그러면 남는 설명은 둘이고 **아직 가르지 못했다**:
   ⒜ 5초 안의 3회라서 **외부 샵/CDN 이 같은 응답을 돌려줬다**(Shopify CDN 캐시 등)
      🔴 그것은 **그쪽 캐시** 이고 우리가 코드로 확인할 수 없다
   ⒝ 그 시점의 샵 상태가 실제로 안정적이었다
🔴 WU-010A(표시 0) → WU-011(표시 0) → WU-012(표시 1) 의 분 단위 변동은
   위 ⒜/⒝ 중 어느 쪽으로도 설명될 수 있다. **단정하지 않는다.**
```

🟡 **다음 단계 입력** — 우리 캐시가 없음이 확정됐으므로, CPO 가 지시한 「프로세스를 나눈
3회 반복」이 **의미 있는 측정** 이 된다(같은 프로세스가 아니어도 결과가 같다면 ⒝,
간격을 벌리면 달라진다면 ⒜ 쪽이다).

---

# WU-014 — Cross-Process Reproducibility (측정만)

🔴 threshold 0 · SIMILAR 0 · brand 0 · Registry 0 · adapter 0 · query 개선 0 · AI 0 ·
배포 0 · 운영 코드 변경 0. 🟢 새 인프라 0 — WU-012 의 같은 게이트 테스트를 **별도 Node
프로세스로 3번 호출** 했다(vitest 호출 1회 = 프로세스 1개).

## 결론 — 최초 divergence는 **축 C**, 프로세스 분리 자체는 결과를 바꾸지 않는다

```
P1(약 20분 전) <-> P2 / P3 / P4(연속)
  A query SAME · B status SAME · **C raw DIFF** · D DIFF · E DIFF · F DIFF
  최초 divergence  **C**
  C 가 갈린 샵 4곳 — junioredition.com · nickis.com · shoppiccoliandco.com · villagekids.co.uk

P2<->P3 · P2<->P4 · P3<->P4  (연속 · 서로 다른 프로세스)
  A SAME · B SAME · C SAME · D SAME · E SAME · F SAME  →  **divergence 없음**
```

| 산출물 | ok | unsupported | error | 후보 | 표시 |
|---|---:|---:|---:|---:|---:|
| P1 | 10 | 20 | 0 | 29 | **1** |
| P2 | 10 | 20 | 0 | 29 | **0** |
| P3 | 10 | 20 | 0 | 29 | **0** |
| P4 | 10 | 20 | 0 | 29 | **0** |

## 🟢 CPO 기준의 **첫 번째 갈래** 다
```
🟢 프로세스가 달라도 동일하다 — P2·P3·P4 가 A~F 전 축에서 같다.
🟢 우리 fetch 호출 · 정규화 · 판정 · 표시 계층은 **같은 입력에서 같은 답** 을 낸다.
🔴 바뀌는 변수는 프로세스가 아니라 **시간** 이다 — 약 20분 사이 축 C(외부 샵이 돌려준
   후보 URL 집합)가 **4개 샵에서** 달라졌고 그 차이가 D → E → F 로 **전파** 되어
   표시 1 → 0 이 됐다.
🟢 D·E·F 의 DIFF 는 불안정이 아니라 **올바른 전파** 다(입력이 다르면 결과가 다르다).
```
🔴 **한계** — 산출물 4개 · 시점 **2개** 다. 「20분이면 바뀐다」로 일반화하지 않는다.
🔴 WU-013 이 우리 캐시를 배제했으므로 변동은 **외부 샵 응답(또는 그쪽 CDN)** 쪽이고,
   어느 쪽인지는 코드로 확인할 수 없다.
