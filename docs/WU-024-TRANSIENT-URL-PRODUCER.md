# WU-024 — 병목 A: Registry 밖 국내 후보의 Transient 유입 경로 (2026-10-15)

🔴 **이 문서는 «기록» 이다. 착수점이 아니다.** 현재 상태와 다음 범위는 `CLAUDE.md` §12 가
유일한 source of truth 다. 🔴 이 문서를 근거로 새 작업을 시작하지 않는다.

🔴 **비용/호출 전수**: AI **0** · Gemini **0** · 외부 검색 API **0** · 키 발급 **0** ·
결제 **0** · DB 쓰기 **0** · migration **0** · Registry 변경 **0** · threshold 변경 **0** ·
Production 배포 **0**. 쓴 것은 공개 상품 페이지 **HTTP GET 45회** 와 운영 DB **읽기** 뿐이다.

---

## 1. 최종 판정 — 🟡 **HOLD**

```
구현   🟢 완료 — 생산자 계약이 생겼고 Registry 밖 후보가 운영 판정까지 들어온다
E2E    🟢 완료 — 실제 GT 판매처 31곳 · 실제 HTTP · 운영 판정 함수
회귀   🟢 546 files / 7,907 passed · failed 0 (기준선 545 / 7,857 → +50 = 신규 테스트 수와 일치)
배포   🔴 **HOLD** — 배포 경계를 분리할 수 없다(아래 §9). CTO 범위 밖이다.
```

🔴 **GO 로 적지 않는 이유 하나**: 헌장 §6/§13 이 「Production 에서 증명되어야 완료」로
정의한다. 지금은 `Implemented / Not Production Verified` 다. 🟢 단 §13-A(「최소 변경이
존재하고 그것을 구현해 E2E 까지 성공시킨다」)는 **충족됐다** — 막는 것은 **배포 승인** 하나다.

---

## 2. 병목 A — 무엇이 막고 있었나 (WU-023 결론 그대로)

> **「transient consumer 는 이미 Registry 를 우회할 수 있지만, 그 consumer 에 후보를
> 공급하는 «생산자 계약» 이 Gemini 에 종속되어 있다.」**

```
🟢 소비자  run-domestic-price-check.ts — Registry 를 요구하지 않는다(가상 샵 id 로 저장만 차단)
🔴 생산자  collectGeminiCandidatePool(gemini-candidate-pool.ts) **하나뿐** 이고
           입력이 `dna` 라 **후보 URL 을 넣을 칸이 없다** → 스스로 Gemini 를 호출한다
🔴 다른 생산자  searchDomesticShops — `findPriceSourceAdapter(domain,"DOMESTIC")` 가 없으면
           `status:"unsupported"` 로 즉시 끝난다(요청 0) → **쿼리형 생산자는 구조상 Registry 에 묶인다**
```

🔴🔴 **그래서 구조적 사실이 하나 확정된다 — 이 문장을 그대로 쓴다**:
> **생산자는 Registry 없이 «URL» 은 공급할 수 있지만, Registry 없이 «쿼리» 는 공급할 수 없다.**
> 모르는 샵의 검색창을 두드리는 어댑터가 없기 때문이다.

---

## 3. 전수검토 10축 — **실제 코드/DB 로 판정** (지시서 §5)

| 축 | 판정 | 근거(측정/코드 위치) |
|---|---|---|
| ① 기존 코드 재사용 | 🟢 **가능 — 채택** | `extractCandidateUrlsFromAiAnswer`(ai-answer-urls.ts:70) + `factsFromProductUrl`(product-url-facts.ts:127) + `withConfidence` + `judgeDomesticCandidate` 가 **이미 전부 있다**. 🔴 **새 파서·정규화기·판정기 0** |
| ② 기존 consumer 계약 그대로 | 🟢 **가능 — 채택** | 소비자가 요구하는 모양은 `ComparisonSearchResult`(host 별) 하나다. 생산자를 바꾸지 않고 **같은 모양만 내면** 된다 → 소비 루프를 공유했다 |
| ③ 최소 계약 변경 | 🟢 **가능 — 채택** | `DomesticPriceCheckInput.candidateUrls?`(선택 인자). 🟢 **하위호환** — 안 넘기면 한 줄도 돌지 않는다. 🔴 `GeminiPoolInput` 은 **건드리지 않았다**(AI 경로에 비-AI 입력을 섞지 않는다) |
| ④ 비-AI producer(기존 데이터) | 🔴 **불가능 — DB 전수로 확인** | URL 보유 칸 **7개 전수**(`information_schema`) 조사: `domestic_product_links` 등록부 밖 host **0** · `price_observations` 밖 host 5곳은 **전부 `SELLER_ORIGIN`(원상품)** · `sourcing_candidates` 1행(macys.com) · `vision_observations` 2행(전부 등록부) · **GT 5곳은 DB 전체에 0건**(registry 0 · links 0 · observations 0 · snapshots 0) |
| ⑤ 기존 Discovery 결과 재사용 | 🔴 **불가능** | WU-022 가 찾은 GT URL 은 `$TEMP` **측정 산출물** 이고 운영 데이터가 아니다. 운영에 저장된 Discovery 결과는 **없다**(저장 금지가 설계다) |
| ⑥ Registry 경유 우회 | 🔴 **채택 안 함(목표 위반)** | 5곳을 등록부에 넣으면 끝나지만 그것이 §12-0 「Registry 확대 금지」와 정면 충돌이고, WU-007 이 **커버리지 상한 = Registry 크기** 를 수치로 닫았다 |
| ⑦ 데이터/UX 경로 | 🟢 **가능 — 채택** | 🔴 기존 진입점은 **없었다**(`links` route = GET/PATCH만 · `search` POST = `title` 필수 · `/check` POST = `{snapshotId}` 만). 🟢 그러나 **배달 경로는 이미 있었다** — WU-022 가 `domesticShop.*Evidence` → 화면 배선을 끝내 뒀다. 입력칸 하나만 비어 있었다 |
| ⑧ 외부 Search / AI | 🔴 **금지(정책)** | CPO 확정 「외부 AI/검색 API 전부 STOP」. 🔴 그리고 **자동 Registry-free 발견은 외부 색인 없이는 구조적으로 불가** 하다(WU-007 실측: 도메인을 찾아 주는 무키 색인이 없다 · Common Crawl 은 urlkey 가 역순 도메인) |
| ⑨ 🔴 현재 «금지된» 방법 — 빼지 않고 적는다 | 🔴 **금지** | ⒜ **Naver 쇼핑 검색 API**(`openapi.naver.com` · 무료 할당) — 🔴🔴 **이것이 유일하게 식별된 «자동» Registry-free 생산자** 다. 리포에 Naver 자격증명 패턴이 **이미 있다**(`NaverDataLabCredentials` · 단 DataLab 은 **검색어 트렌드** 이고 상품 링크가 아니다). 막는 것은 **능력도 비용도 아니라 정책** 이다(외부 검색 API STOP + 키 발급 0). 🔴 저장 허용 여부는 **미판독**(1차자료 확인 안 했다 — 단정하지 않는다) ⒝ 포털 스크래핑 — 약관 ⒞ 소비자 AI UI 자동화 — ToS/CWS |
| ⑩ 새 비용/ToS/보안 | 🟡 **보안 1건 신설 · 비용 0** | 비용 ₩0 · 키 0 · provider 0. 🔴🔴 **새 위험 하나가 실재했다** — 사용자가 준 문자열로 **서버가 HTTP 를 보낸다**(SSRF). 기존 입력 경계는 scheme 과 URL 모양만 봐서 `http://169.254.169.254/products/x` 가 `PRODUCT_PAGE` 로 통과했다 → **공개 라우팅 경계를 신설** 했다 |

🔴 ⑨ 를 **「금지라서 안 적었다」로 두지 않았다** — CPO 가 정책을 바꿀 때 그 자리가 보이도록 적었다.

---

## 4. 선정 해법 — **URL 생산자 + 공용 소비 루프**

```
셀러 입력칸(Panel)  →  POST /api/price-history/check {candidateUrls}
                     →  collectUrlCandidatePool          ← 신규 생산자(AI 0 · provider 0)
                          extractCandidateUrlsFromAiAnswer   입력 경계(순수 · 재사용)
                          isPubliclyRoutableHttpUrl          🔴 SSRF 경계(신설 · 순수)
                          factsFromProductUrl               페이지를 **열어** 사실을 읽는다
                          groupCandidatesByHost             host 별 ComparisonSearchResult
                     →  **공용 소비 루프**(Gemini 와 동일)
                          withConfidence → enrichCandidatePrices → judgeDomesticCandidate
                     →  isTransientShopId 가드 → 저장 **차단** → transient evidence
                     →  화면(별 구역 · 머리 문구 다름)
```

🔴 **왜 Gemini 모듈을 확장하지 않았나** — 그러면 비-AI 입력이 flag 뒤에 묶여 「AI 가 후보를
만든다」는 전제가 되살아난다. 그것이 바로 WU-023 의 병목이었다.

### 변경 파일 (운영 6 · 테스트 6 · 스크립트 1)

```
신규  _lib/transient-candidates.ts     일시 샵 id 2개 · isTransientShopId · host 묶기 · dedupe 키
신규  _lib/url-candidate-pool.ts       생산자 + SSRF 경계
수정  _lib/gemini-candidate-pool.ts    primitive 를 leaf 로 옮기고 **re-export**(호출부 무변경)
수정  _lib/run-domestic-price-check.ts 선택 인자 1 · 공용 소비 루프 · 가드 술어화 · 출처별 배열
수정  check/route.ts                   candidateUrls 모양 검사 + 상한 공유
수정  GeminiTransientCandidates.tsx    heading/testId 선택 prop(같은 컴포넌트 · 다른 구역)
수정  DomesticPriceIntelligencePanel.tsx  입력칸 · state · 두 번째 구역 · 제외 사유 한 줄
```

🔴 **사본 0** — `groupCandidatesByHost` 를 공용으로 빼서 Gemini 경로도 **그 함수를 쓴다**.
🔴 **저장 경로 변경 0** · schema 0 · 환율 0 · 집계 규칙 0 · Registry 0.

---

## 5. 🔴 E2E — 실제 GT · 실제 HTTP · 운영 함수

하니스 `wu-024-live-e2e.test.ts` (기본 **SKIP** · `WU_024_LIVE=1` 로만 실행).
입력: 운영 DB 덤프 원상품 6건(S1~S6) × GT 라벨 후보(등록부 **밖** 만) — **HTTP 45회**.

🔴🔴 **CONTROL 이 먼저 실패해서 함정을 잡았다** — S4 의 덤프 `source_url` 에
`?_pos=1&_sid=…&_ss=r` 가 붙어 있어 문자열 완전일치 비교가 깨졌다(인수인계 §3-5 ② 와
**같은 함정** · WU-022-2 에서 S4 가 통째로 빠진 그 자리). 🟢 운영 정규화기
`canonicalizeProductUrl` 로 비교하도록 고쳐 통과시켰다.

### 5-1. 공급 → 후보 (샵 단위 31조합 · 상품 6건)

```
supplied 45 → accepted 45 → usable 45 → MI 후보 44 (DUPLICATE 1) → 샵 조합 31
provider 호출 0 · Gemini 0 · 비용 ₩0
```

### 5-2. GT → 운영 판정 (🔴 **샵 단위** 로 센다)

🔴 `judgeDomesticCandidate` 는 **샵당 1건** 을 고르므로 후보 44건을 그대로 세면 과대가 된다.
🔴 그리고 31조합 중 **7조합은 한 샵 안에 GT SAME 과 DIFFERENT 가 섞여 있어** 샵 단위 판정을
어느 라벨에 귀속시킬 수 없다 → **측정불가** 로 둔다(0 이나 100% 로 만들지 않는다).

| GT | → EXACT | → COMPARISON | → REFERENCE | → EXCLUDED | → DROPPED | 계 |
|---|---:|---:|---:|---:|---:|---:|
| SAME | 4 | 6 | 1 | 0 | **0** | 11 |
| DIFFERENT | **0** | 7 | 1 | 2 | 3 | 13 |
| 🔴 혼재(측정불가) | 1 | 1 | 0 | 0 | 0 | 7* |

<sub>*혼재 7조합 중 샵 단위 판정이 남은 것은 2 — 나머지는 같은 조합의 중복 행이다.</sub>

```
🟢🟢 **귀속 가능한 GT DIFFERENT 13건에서 EXACT 승격 0** — 잘못된 후보가 동일상품
     가격 버킷에 **들어가지 않았다**(§7 Q3 의 핵심).
🟢 GT SAME 11건 중 **버려진 것 0** — 공급한 정답 후보를 게이트가 삭제하지 않았다.
🔴 GT DIFFERENT 7건이 COMPARISON(비교/참고) 등급을 받았다. 🔴 이것은 **기존 MI 정밀도**
   이고 이 WU 가 만든 것이 아니다(헌장: MI strict Precision 0.622 · False SAME 14/51).
   🟢 그리고 transient 구역은 설계상 국내 최저가·판매판정에 **영향 0** 이다.
```

### 5-3. 🟢🟢 **처음으로 등록부 «밖» 국내 샵에서 KRW 가격 증거가 나왔다**

| 상품 | 판매처(등록부 밖) | 가격 | GT | 판정 | `priceStatus` |
|---|---|---:|---|---|---|
| S2 | `biskuit.kr` | KRW 88,000 | SAME | TEXT_CONFIRMED / COMPARISON | 🔴 UNVERIFIED_SEARCH |
| S2 | `m.luxboy.com` | KRW 59,000 | SAME | TEXT_CONFIRMED / COMPARISON | 🔴 UNVERIFIED_SEARCH |
| S6 | `m.web.mustit.co.kr` | KRW 226,000 | SAME | TEXT_CONFIRMED / COMPARISON | 🔴 UNVERIFIED_SEARCH |
| S6 | `biskuit.kr` | KRW 258,000 | SAME | TEXT_CONFIRMED / COMPARISON | 🔴 UNVERIFIED_SEARCH |
| S4 | `donokids.com` | KRW 117,000 | 혼재 | TEXT_CONFIRMED / COMPARISON | 🔴 UNVERIFIED_SEARCH |
| S4 | `miniboutique.co.kr` | KRW 117,000 | DIFFERENT | TEXT_CONFIRMED / COMPARISON | 🔴 UNVERIFIED_SEARCH |

🔴🔴 **「0 의 성질」을 또 가른다**(WU-023 과 같은 규율):
```
WU-023  국내 후보를 찾았는데 **가격이 검증을 통과하지 못했다**(mustit 1건 · N=1)
WU-024  🟢 **가격 숫자가 6건 붙었다**(KRW · 등록부 밖 · 4건은 GT SAME)
🔴 그러나 **유효 국내 EXACT 는 여전히 0** 이다 — 둘이 막는다:
     ⒜ 등급이 COMPARISON(품번 축이 없다 — 국내 샵 제목이 해외 품번을 안 적는다)
     ⒝ `priceStatus = UNVERIFIED_SEARCH` → 운영 게이트(`VERIFIED_CURRENT && KRW`)를 못 지난다
🔴 N=6 으로 일반화하지 않는다. 498 전수 환산도 하지 않는다.
```

---

## 6. 🔴🔴 측정으로 드러난 **기존 결함 1건 — 고치지 않았다**

```
증상  상세 페이지를 **직접 열어 JSON-LD 에서 읽은** 가격이 `UNVERIFIED_SEARCH` 로 내려앉는다
원인  ① product-url-facts.ts:250 — `priceStatus:"VERIFIED_CURRENT"` 는 넣지만
         **`priceSource:"detail"` 을 넣지 않는다**
      ② match.ts:463 `derivePriceStatus` — `priceSource === "detail"` 이 아니면 **무조건**
         `UNVERIFIED_SEARCH` 로 덮어쓴다 → `withConfidence` 한 번에 증거가 사라진다
      ③ price-source-adapter.ts:250-255 `enrichCandidatePrices` — 선두에서 **전 후보** 를
         `UNVERIFIED_SEARCH` 로 초기화하고 **Shopify handle 이 있는 것만** 승격한다
         → 국내 Cafe24 계열(식별자가 쿼리에 있다)은 **구조적으로 승격 불가**
영향  WU-023-B 의 「mustit KRW 74,000 이 `UNVERIFIED_SEARCH` 였다」가 **이것으로 설명된다**
```

🔴 **왜 고치지 않았나** — ⒜ `derivePriceStatus`/`enrichCandidatePrices` 는 **등록부 경로와
공용** 이라 화면·집계에 번지고 ⒝ transient 구역은 설계상 가격을 판정에 넣지 **않으므로**
이 WU 의 PASS 범위를 위해 필요하지 않으며 ⒞ 「미검증 가격 표시」는 WU-023 에서 이미
**보류된 제품정책** 이다. 🔴 **CPO 판정 사안으로 올린다**(코드 위치는 위에 확정돼 있다).

---

## 7. 음성 대조 (mutation) — 8종 전부 FAIL · 원상복구 PASS

```
기준선 138 passed (6개 테스트 파일)
M1 isTransientShopId → false (저장 차단 무력화)      1 FAIL
M2 SSRF 가드 제거                                     1 FAIL
M3 일시 샵 목록에서 URL 샵 제거                        1 FAIL
M4 출처 병합(evidence 를 한 배열에)                    1 FAIL
M5 dedupe 키를 경로만으로(쿼리 식별자 버림)             1 FAIL
M6 URL 경로 진입 조건 무력화                           1 FAIL
M7 소비자에게 넘기는 push 제거                          1 FAIL
M8 라우트 배열 검증 제거                               1 FAIL
원상복구  138 passed
```

🔴 **M5 가 중요하다** — 국내 Cafe24 는 상품 식별자가 **쿼리스트링** 에 있다
(`?branduid=` · `?product_no=`). Gemini 경로의 `normalizeCandidateUrl`(쿼리 전체 제거)을
그대로 쓰면 **서로 다른 상품 두 건이 한 건으로 접힌다** → 이 경로는 `canonicalizeProductUrl`
(식별 파라미터 **보존**)을 쓴다.

### 🔴 기존 가드 테스트 6건을 갱신했다 — 성질은 **강해졌다**

저장 차단이 `shopId === GEMINI_VIRTUAL_SHOP_ID` → `isTransientShopId(result.shopId)` 로
바뀌면서 소스 앵커를 쓰는 단언 6개(4파일)를 갱신했다. 🔴 **약화가 아니다**:
id 하나와 비교하면 **다른 일시 샵이 저장으로 샌다**. 그리고 새 테스트가
`TRANSIENT_SHOP_IDS.size === 2` + 두 id 전부 + **uuid 는 막지 않음** 을 단언한다.
🟢 `mi-gemini-010r` 의 ±200자 «창» 단언은 **구조 단언**(감싸는 try/catch 블록)으로 바꿨다 —
창은 한 줄만 늘어도 깨지고 무관한 try/catch 에는 속는다.

---

## 8. 품질

```
회귀    admin **546 files / 7,907 passed · failed 0 · skipped 76**
        (기준선 545 / 7,857 / 75 → 테스트 +50 = 신규 50건과 **정확히 일치**)
typecheck  **0 errors** (세션 시작 실측 0 과 동일)
build      exit **0**
eslint     1 error + 8 warning — 🟢 **변경 전과 동일**(전부 기존 것 · stash 대조 확인)
```

---

## 9. 🔴🔴 배포 — **경계를 분리할 수 없다 (HOLD)**

```
branch  wu-010-display-provenance   behind 0 / ahead 0
origin/main  9e0ef9e8               behind 0 / **ahead 63**  ← 머지하면 63커밋이 한 번에 배포된다
```

🔴🔴 **WU-024 만 떼어 `main` 에 올릴 수 없다 — 실측으로 확정했다**:
```
origin/main 에 **없는 파일**   packages/crawler/src/comparison-search/ai-answer-urls.ts  🔴 없음
                              packages/crawler/src/comparison-search/ai-answer-pool.ts  🔴 없음
origin/main 에 **없는 함수**   self-reference.ts 의 `canonicalizeProductUrl`             🔴 0건
```
🔴 그런데 WU-024 생산자는 그 **둘 다** 를 쓴다(입력 경계 재사용 · 식별 파라미터 보존 dedupe).
→ **cherry-pick 단독 배포 불가.** 인수인계 §1-1 의 「분리가 가능해 보인다(미검증)」는
**이 지점에서 반증됐다** — 선행 WU 산출물에 대한 **코드 의존** 이 있다.

🟢 **선택지는 둘이고 둘 다 CPO/CEO 결정이다**:
```
⒜ 63커밋 + WU-024 를 **한 번에** main 에 머지한다 — 한 번의 배포로 전부 Production 에 간다
   🟢 그 63커밋의 기능 변화는 설계상 0 에 가깝다(Gemini flag OFF · WU-022 구역은 미렌더)
   🔴 그러나 **「0 이다」를 CTO 가 Production 실화면으로 증명할 수 없다**(로그인 뒤 · §10)
⒝ 계속 브랜치에 보존한다 — 코드는 remote 에 있고 Production 은 한 글자도 바뀌지 않는다
```
🔴 **CTO 는 ⒜ 를 임의로 실행하지 않는다**(헌장 §8 · `main` push = Production 배포).
🟢 이번 WU 는 ⒝ 로 두고 **브랜치 push 까지** 끝냈다.

---

## 10. 잔여 문제 (전부 **기록만** · 구현 0)

```
① 🔴 priceStatus 강등 — §6. 코드 위치 3곳 확정. 공용 경로라 CPO 판정 사안
② 🔴 자동 Registry-free 생산자는 **여전히 없다** — 이 WU 가 만든 생산자는 **사람** 이다
     🔴 「후보를 자동으로 찾는다」와 「공급된 후보를 검증한다」를 **같은 성과로 적지 않는다**
     🟢 유일하게 식별된 자동 경로는 ⑨의 Naver 쇼핑 검색 API 이고 **정책으로 막혀 있다**
③ 🟡 SSRF 경계는 **DNS 를 보지 않는다** — 공개 도메인이 사설 IP 로 해석되는 rebinding 은
     막지 못한다(순수 함수 · 비용 0 을 지키기 위한 의도된 한계). 숨기지 않고 적는다
④ 🟡 AI 붙여넣기 경로(`collectAiAnswerCandidatePool`)에는 **SSRF 경계를 적용하지 않았다** —
     운영 호출부가 **0** 이라 노출이 없다. 배선하는 WU 가 같이 적용해야 한다
⑤ 🔴 GT 혼재 7조합은 **측정불가** 로 남겼다(샵 단위 판정을 라벨에 귀속시킬 수 없다)
⑥ 🟡 등록부 밖 후보의 가격은 화면에 **금액으로 보인다**(`priceAmount`) — 「미검증」 표시
     추가는 WU-023 에서 보류된 제품정책과 **같은 사안** 이다
```

---

## 11. 완료 조건 10 자가점검 (지시서 §3-3)

```
① 모든 producer 조사            🟢 코드 2개(쿼리형·AI형) + DB 7칸 전수 + 어댑터 등록부
② consumer 전체 downstream      🟢 판정 → 가격 → 집계 → 화면 → 등록 경계까지 추적(P-32 분리 확인)
③ 기존/신규 producer 전수 검토    🟢 10축 표
④ AI·Registry 확대 «없이» 먼저   🟢 채택안에 AI 0 · Registry 0
⑤ 최소 변경안 설계 + 검증        🟢 선택 인자 1개 · 하위호환 · 기존 호출부 무변경
⑥ 실제 GT 데이터로 E2E          🟢 GT 31조합 · 실제 HTTP 45회 · 운영 판정 함수
⑦ 막는 것을 코드 위치와 함께     🟢 §6(가격 강등 3곳) · §9(배포 경계) · ⑨(Naver = 정책)
⑧ GO / HOLD / STOP             🟢 **HOLD**(§1)
⑨ regression · typecheck · build 🟢 §8
⑩ 실제 제품 검증 지점            🟢 만들었다 — 🔴 단 배포 전이라 **아직 셀러가 볼 수 없다**
```

**CEO Action: NONE.** 🔴 실제 화면 테스트는 배포 경계가 정해진 «뒤» 에 CPO 가 전달한다(§3).
