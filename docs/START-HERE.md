# ▶ MASTER HANDOFF — 스마트스토어 상품자동등록

> 🔴🔴🔴 **이 문서가 유일한 진입점이다.** 세 페이지(CPO · CTO · CEO) **전부** 이것을 먼저 읽는다.
> 🔴 **페이지가 바뀌어도 프로젝트 상태는 초기화되지 않는다.** 과거 조사·결정을 다시 읽지 않는다.
> 🔴 **두 번째 진입 문서를 만들지 않는다** — 둘이 되면 서로 다른 말을 한다(이 트랙에서 실제로 났다).
> 🟢 종료된 WU 상세는 `docs/ARCHIVE-CLOSED-WU.md` 와 `docs/HANDOFF-WU-*.md` 에 있고
> **막혔을 때만 해당 절 하나** 를 연다.

---

## 0. 한 줄 상태 — 이것만 보고도 다음 행동이 정해진다

```
🔵🔵🔵 전략   **가격 형성의 주인은 Registry 가 아니라 «비교 가능한 후보» 다**(CPO 2026-10-28)
             판단 기준 = 「등록된 사이트인가?」 ❌ →
             「AI Search 가 발견 → **원본과 동일/유사한가** → 가격을 확보할 수 있는가」
             🔴 카테고리별 **사이트 목록 확대는 전제에서 제거** · 🔴 비교가 **가격보다 먼저**
             🟢 **이미 그렇다** — AI Search/URL 풀은 Registry 를 **참조하지 않는다**(WU-024)
             🟢 POLICY-GATE-01 과 **충돌 없음** — 「등록 요구 제거」 ↔ 「약관 금지 준수」는 다른 축
             🔴🔴 **CPO 판정 1건 대기** — 「UNKNOWN 은 가격 편입 금지」 ↔ 「danawa 가격은
                형성대에 쓸 수 있다」가 코드에서 **서로 다른 답** 이다(부록 AJ-3)
                선택지 ⒜ 현행 유지 ⒝ **제3의 축**(시장 미확정 동일상품 가격) ⒞ KR 증거 확대(🔴 WU-077 순손실)

CURRENT WU   **DISCOVERY-TO-MI-CANONICAL-01** — 🟡 **PARTIAL** · 운영 코드 변경 **0**
             🟢🟢 **① AI Search 목록 → ② MI SAME 목록 → ③ 가격/판매처** 가 닫혔다
                B226AC009: 후보 **4** → crawl 3 → evidence 3 → **SAME 3**
                (PRESUMED 0 · SIMILAR 0 · DIFFERENT 0 · UNKNOWN 0 · 보류/충돌 **0**)
             🟢 **후보가 준 단계는 하나뿐** — ④ crawl 에서 `UNREACHABLE` 1건.
                ②③⑤⑥⑦ 손실 **0** ⟹ **비교→MI SAME 은 손실이 없다**
             🟢 §11 근거 확보 — 「품번 완전 일치 → EXACT_IDENTIFIER」까지 운영 문장 그대로
             🟢 해외 축은 **끝까지** 간다 — SAME 3 → URL 3 → 가격 3 → GBP 37 · USD 58
             🔴 **PASS 5 만 못 넘는다** — AI Search 가 **국내 URL 0건** 이라 분모가 0
                (owner = Search 축 · §10 이 Query 동결 ⟹ **CPO 가 별도 WU 로 지정**)
             🔴 PASS 7 — 따져 화면 **CEO 확인 미완**(CTO 는 그 칸을 볼 수 없다)
             🟢🟢 §4~§6 확인 — 국내/해외가 **이미 한 집합** 이다(같은 evidence 타입 ·
                같은 가격 함수 · `market === "KR"` 한 줄로만 갈린다) ⟹ 별도 모델 **불필요**
             🟢 전문 `docs/HANDOFF-DISCOVERY-TO-MI-CANONICAL-01.md`
[직전]       **DOMESTIC-SAME-PROVIDER-01**
[낡음]       **DOMESTIC-SAME-PROVIDER-01** — 🟡 **PARTIAL**
             🔴🔴 **CPO 한 질문의 답 = 아직 NO** — AI Search 가 B226AC009 에서
                **국내 URL 을 0건** 냈다(organic 4 전부 해외) ⟹ 표시할 것이 없었다
             🟢🟢 **그런데 파이프라인은 준비돼 있다** — 재투입 축에서 그 모양이 실제로 난다
                `biskuit.kr` = URL + **₩88,000** + PRESUMED_SAME + KR + VERIFIED_CURRENT
                (CEO 가 본 ₩88,000 의 근거가 바로 그 후보다 · 숫자만 뜬 게 아니다)
             🔴 국내 2건 중 하나가 `m.luxboy.com ₩59,000` 이고 **human DIFFERENT** 다 ⟹
                국내 참고가격을 **최저가** 로 잡으면 틀린 상품이 이긴다(WU-077 그 모양 · 미수정)
             🟢 탈락 15건 중 **한국 TLD 0** ⟹ pool/policy/crawl/evidence/market/price
                어디에서도 **국내 후보를 잃지 않는다**
             🔴🔴 **분모 정정** — human SAME 18 중 **한국 TLD 는 `biskuit.kr` 하나** 다
                ⟹ 「과거에 국내가 여러 개」가 아니라 **애초에 1~2** 였다
             🟢🟢 **국내/해외는 이미 같은 데이터 모델** — 둘 다 `GeminiTransientEvidence` ·
                가격 함수도 같은 함수 · 갈리는 건 `market === "KR"` 한 줄 ⟹ 국내 전용 모델 **불필요**
             🟢 owner 맵 확정 — 화면 「국내 참고가격」 = `candidateDomesticPrice`(일시),
                `domesticLowestPriceKrw` = `price_observations`(영속) · **다른 칸**(통합은 CPO 승인)
             🟢 §13 **수정 완료** — `deuxbebe.ts` 캡처 `([0-9][0-9,]*)` ·
                117,000→117000 · 134,000원→134000 · 품절→null · 변이 2 FAIL ·
                오염 관측 **1행 삭제**(정상 2행 확인 후 · 잔존 0)
             🟡 CPO 결정 — ① AI Search 국내 URL 0 을 열려면 **별도 WU**(§14 Query 동결)
                ② 국내 참고가격의 **최저가 선별**(₩59,000 틀린 상품 ↔ ₩88,000 정답)
             🟢 전문 `docs/HANDOFF-DOMESTIC-SAME-PROVIDER-01.md`
[직전]       **CANDIDATE-SYNC-01**
[낡음]       **CANDIDATE-SYNC-01** — 🟡 **PARTIAL** · 운영 변경 = **UI 문구 한 자리**
             🔴🔴 **국내 후보 1건의 원인 = Search coverage + «내 하니스 누락»**
                Bobo Choses: raw 4 → pool 4 → policy 4 → crawl 4 → evidence 3 → DOM 5
                WEB_SEARCH 3행은 **전부 해외** · 🇰🇷 1건은 DOMESTIC_LISTING 산출
                ⟹ pool/policy/crawl/market/price/UI 에서 **잃은 국내 후보 0**
             🔴🔴🔴 **§17 1회용 라우트가 `reviewedSameUrls` 재투입을 빠뜨렸다** —
                DB 실측 `candidate_reviews` origin_code=B226AC009 · SAME **13행** 존재
                ⟹ 「후보 1건」은 **내 하니스 수치** 다. CEO 가 「🔄 다시 분석」을 누르면
                   `/check` 가 그 13을 재투입한다(**코드 변경 불필요**)
             🔴🔴 **`117` 의 정체 = Production 가격 쓰기 결함** (원인 한 줄까지 특정)
                `price_observations` DEUXBEBE 같은 URL — 10-08 **117,000** · 10-28 **117**
                `deuxbebe.ts:47` `([0-9]+)` 가 **콤마를 못 받아** `117,000` → `117`
                🟢 국내 목록 탐색 경로는 같은 상품을 117,000 으로 **정확히** 읽었다
                🔴 **고치지 않았다**(Site adapter 금지) ⟹ **CPO GO 필요** ·
                   저장된 `117` 행도 같이 정리해야 한다(최저가를 그 행이 이긴다)
             🟢 owner 분리 확정 — 화면 「국내 참고가격」 = `candidateDomesticPrice`(일시),
                `domesticLowestPriceKrw` = `price_observations`(영속) · **다른 칸**
             🟢 의미 충돌 제거 — 「…국내 판매처는 **없습니다**」 → **「국내 가격 참고값」**
                🔴 1차에 문장 셋을 다 뺐는데 **내 owner 판단이 틀렸다** → note/scope 복귀
                🟢 기존 계약 4파일이 그 과잉 제거를 잡았다(약화 0 · 문자열만 교체)
             🟡 CEO Action 1회 — B226AC009 화면: 부정문 없는지 · 후보 몇 건 서는지
             🟢 전문 `docs/HANDOFF-CANDIDATE-SYNC-01.md`
[직전]       **QUERY-ARCH-01 §17~§20**(Production Search 10/10)
[낡음]       **QUERY-ARCH-01 §17~§20** — 🟡 **PARTIAL** · 운영 로직 변경 **0**
             🟢🟢 **Production Search 10/10** · 전건 `searches:1` · failed **0** · skipped **0**
                ⟹ `1 Product = 1 Search` 가 Production 에서 지켜졌다
             🟢 funnel — organic **74** → accepted 31 → usable 19 → MI자격 18 →
                Evidence **31**(OVERSEAS_AUTO 19 · WEB_SEARCH 9 · DOMESTIC_LISTING 3)
                SAME **6** · PRESUMED_SAME 25 · 🇰🇷 **4** · 🌎 25 · UNKNOWN 2
             🟢🟢 **AI Search 가 국내 후보를 낸 첫 사례** — Main Story `miniboutique.co.kr`
                KR ₩117,000 VERIFIED · 국내 참고가격 3건(deuxbebe·donokids 포함)
             🟢 **API 31 → Client 31 → mounted DOM 31 · 소실 0**(Production 실제 행으로 검증)
             🔴 남은 한 칸 = **§20 CEO 화면 확인(NO)** — CTO 는 로그인 뒤 화면을 볼 수 없다
             🔴 발견한 결함 셋(전부 **고치지 않았다**) — ⒈ UNVERIFIED 금액이 해외 집계
                상한을 오염(12,700 GBP 등 · WU-111 구조) ⒉ Main Story `domesticLowestKrw`
                가 **117**(후보집계는 117,000 · 다른 분모 · MI 금지) ⒊ Racchetto Polo 에서
                **원상품 호스트가 후보로** 섰다(자기참조 계약 구멍 여부 **미측정**)
             🟢 1회용 토큰/라우트 **폐기 완료**(§10 ⑥⑦⑧⑨ · env 0건 · 소스 참조 0)
             🟡 CEO Action 1회 — Main Story · Bobo Choses 두 상품 화면 확인
             🟢 전문 `docs/HANDOFF-QUERY-ARCH-01-PRODUCTION.md`
[직전]       **QUERY-ARCH-01 §15/§16**(Query Preview 10/10) · **E2E-HISTORY-10**
             🟢🟢 **Query 생성 2/10 → 10/10** — `NO_MODEL_CODE → Search 0` 닫혔다
             🔴 진짜 원인은 조립기가 아니라 **재료** 였다 — 운영 호출부가
                `productName/color/productType: null` 을 넘기고 있었다(두 곳 다 고침)
             🟢 설계 = BRAND + [CODE] + 디자인 코어≤4 + 사실≤3 + 「동일상품 판매처」
                (SP-09 가 실측한 신호 · 🔴 SP-08 이 NO-GO 한 **긴 자연어 목적문 아님**)
             🔴 **이 조합 자체는 미측정** 이고 SP-10 이 잰 실행 간 URL 겹침은 3~30% 다
             🔴 §17 10회 Search 는 CTO 불가 — APIFY 토큰 Production 전용 Encrypted
             🟡 CPO 결정 ① §17 개시 여부 ② fit/`100%` 보일러플레이트 제거 여부
             🟢 전문 `docs/HANDOFF-QUERY-ARCH-01.md`
[직전]       **E2E-HISTORY-10** — 🔴 **FAIL** · 코드 변경 **0**(측정·계약 전용)
             대상 = 아동 5(브랜드·호스트 **전부 다름**) + 테니스 5(🔴 브랜드 1·호스트 1 뿐)
             🟢 ① 원본 상품정보 확정 **10/10**(제목·브랜드·색상·가격 전건)
             🔴🔴 ② AI Search 가 **10건 중 8건에서 «실행되지 않는다»**(`NO_MODEL_CODE`)
                — Query owner 가 **품번 전용**(query-planner.ts:97) 이고
                  품번 생산자가 **둘뿐**(라벨 설명문 · URL slug · dna.ts:144)
             🔴 그런데 **품번이 없는 상품이 아니다** — 원문에 모양이 있다
                (BOSS `HB-J53497-10P` · Mini rodini `V276025-9848` · 테니스 `STS226M50459` …)
             🔴 따져 화면 도달 **아동 0/5 · 테니스 0/5** — 후보 탐색이 시작조차 안 된다
             🟡 CPO 결정 셋 — ⒜ Query 축 확대(🔴 주석이 명시 금지) ⒝ **품번 생산자 확대**
                ⒞ 현행 유지(🔴 테니스는 영구 후보 0). **CTO 가 고르지 않았다**
             🟡 CEO Action — `/pipeline` 에서 **2건만** 「🔄 다시 분석」 1회씩
                (Bobo Choses B226AC009 · Main Story AW26MS185 · 🔴 나머지 8건은 눌러도 Search 0)
             🟢 전문 `docs/HANDOFF-E2E-HISTORY-10.md`
[직전]       **MARKET-ATTRIB-01** — 🟢 조사 완료 · **코드 변경 0**
             🟢 `UNKNOWN+KRW` 를 국내로 올릴 **일반 증거 경로가 이미 있고 배선돼 있다**
                (`MarketEvidence` 강한 3 + 종합기 · **강한 2 + KRW = 사실 셋** · WU-020 §4 유지)
             🔴 **danawa 는 그 길로도 KR 이 안 된다** — 원문에 `사업자등록`·`통신판매`·
                `개인통관` **각 0회**(정규식 실패가 아니라 **서빙 HTML 에 없다**)
             🟢 반례도 0 — `junioredition/en-kr`(KRW 61회) **강한 신호 0** ⟹ 보호 유지
             🟡 CPO 선택 — ⒜ 현행 유지 ⒝ 「가격비교 사이트는 판매처가 아니다」 명시
                ⒞ 증거 축 확대 🔴 **지금 제안하지 않는다**(WU-063/077 로 되돌아간다)
[직전]       **E2E-CLOSE-01** — 🟡 **PARTIAL · 사슬은 닫혔다 · 남은 것은 «정책»**
             🔴🔴 POLICY-GATE-01 «이후» funnel(같은 9 URL) —
             `supplied 9 → accepted 3(정책 차단 **4**) → usable 1 → miEligible 1`
             남은 host = **danawa 하나** 이고 그것은 `market=UNKNOWN` ⟹ 🇰🇷 구역이 아니라
             「🛰 AI 검색 후보」에 선다 ⟹ **🇰🇷 구역 후보 = 0**(버그 아님 · 약관 귀결)
             🔴 **`11st` 이 그 실행의 유일한 KR 후보였는데 우리 정책이 막았다**
             🟢 사슬은 전부 잠겼다 — response(E2E-06) · state/rows(E2E-04) ·
                **바깥패널→MiPanelView(이번 추가 · 변이 H1)** · 렌더러→DOM(변이 D1)
             🔴 `MiPanelView` **전체 마운트는 못 했다** — 운영 응답 fixture 를 추측하다
                두 번 터뜨려 멈췄다(그 홉은 **소스 축** 으로만 잠금)
             🟡🟡 **CPO 판정 하나로 모인다** — 국내 대형 마켓이 대부분 `NOT_AVAILABLE` 이라
                AI Search 가 국내를 찾아와도 **열 수 있는 곳이 거의 없다**
                ⒜ 그 분류를 재검토할 것인가 ⒝ 국내는 등록부 경로만 쓰고 AI Search 는 해외 축으로
[직전]       **BROWSER-FALLBACK-03** — 🟡 PARTIAL (CEO 가 올린 **실제 Farfetch HTML**)
             🟢 ProductGroup 인식 · `title` · `sku 37620037-6` · `breadcrumbPath` 확보
             🔴🔴 **`price = null`** — 실제 Farfetch 는 `offers.priceSpecification[]` 이고
                우리 추출기는 **그 모양을 안 읽는다**(가격비교가 목적인데 그 값이 빈다)
             🔴 `brand` · `description` · `color` 전부 null — **부모 ProductGroup 칸이 버려진다**
                (Junior Edition 에서도 **같은 결함 재현**)
             🔴 `B226AC009` 는 화면 문구가 **「Brand style ID」** 라 기존 라벨 정규식
                (`product|article code`)에 **안 걸린다** — 새 parser 만들지 않았다
             🔴🔴 **BF-02 의 「Farfetch 46 USD」를 철회했다** — 내가 손으로 만든 fixture 가
                `offers.price` 모양이어서 생긴 **거짓 양성** 이었다
             🟡 CPO 판정 셋 — ⒜ priceSpecification ⒝ 부모 칸 보존 ⒞ 품번 라벨 확장
                🔴 셋 다 **운영 원상품 경로에도 영향** 이 있다
[직전]       **BROWSER-FALLBACK-02** — 🟡 PARTIAL(junioredition 실제 HTML)
             🟢 실제 HTML(junioredition 826KB)을 **기존 추출기**에 넣으니
                `title` 🟢 · `sku` 🟢 · `price 68,600 KRW` 🟢 (schema 변경 **0**)
             🟢 `ProductGroup + hasVariant` 는 **이미 지원**(N-3.54) — 새 추출기 불필요
             🟡 `brand`·`description` 은 빈다(variant 노드를 돌려주는 탓으로 **추정** · 미확정)
             🔴 **farfetch 전체 HTML 로는 한 번도 못 돌렸다** — 서버 403 · CTO 브라우저 0
             🔴🔴 **내 1차 보고 두 문장을 철회했다** — 없는 칸(`name`)을 읽고
                「추출 실패」·「다른 상품을 집었다」로 적었다(typecheck 가 잡았다)
[직전]       **BROWSER-FALLBACK-01** — 🔴 현재 북마클릿은 **Case A**(URL 만 전달 · 서버 재fetch)
             🔴🔴 현재 북마클릿은 **Case A** 다 — `a[href]` 만 긁어 **URL 목록을 내비게이션**
             으로 넘기고 **서버가 그 URL 을 다시 fetch** 한다 ⟹ 403 을 전혀 건드리지 않는다
             🔴 서버에 **데이터를 받는 입구가 없다**(`candidateUrls` 뿐 · route 전수 0)
             🟡 Case B 는 **구조적으로 가능**(순수 추출기 `extractFromJsonLd` 가 이미 있다)
                — 🔴 단 **미검증** 이고 farfetch 는 **JSON-LD 부재**로 그마저 막힐 가능성
             🔴 V1·V2(브라우저 접근·DOM 읽기)는 **CTO 가 측정할 수 없다**(브라우저 0)
[직전]       **POLICY-GATE-01** — 🟢 **정책 비대칭 해소·배포**
             「수집 가능 여부는 **어디서 발견했는가** 가 아니라 **어떤 사이트인가**」(CPO)
             🟢 술어 **owner 하나**(`isCollectionBlocked`) · 생산자 **5곳 배선** · 등록부 경로 불변
             🔴 **`NOT_AVAILABLE` 만** 막는다 — `MANUAL`(=미조사)까지 막으면 danawa 가 사라진다
             🔴 Search 는 **안 막는다** — 발견은 남고 `COLLECTION_NOT_AVAILABLE` 로 **사유 기록**
             🔴 그 결과 **11st 1건이 후보에서 빠진다 — 그것이 의도다**(회귀로 읽지 않는다)
             🟢 변이 **G1~G6 전부 FAIL** · 회귀 9,573 · typecheck 0 · build 0
[직전]       **E2E-08** — 🟡 403 복구 **HOLD**(실질 상한 1~2건) · 그 조사에서 위 비대칭을 발견
[직전]       **E2E-07** — 🟢 입구 손실 `raw 9 → usable 2` · 최대 손실 **403 5건(71%)**
             403 5건 중 **3건(gmarket ×2 · coupang)은 우리 등록부가 이미 `NOT_AVAILABLE`**
             (= 약관으로 수집 대상 아님) ⟹ 「뚫기」는 기술이 아니라 **약관 결정**
             farfetch 는 200 이어도 **JSON-LD 없음**(JS 렌더) ⟹ 실질 복구 상한 **1~2건**
             🔴🔴 **`11st.co.kr` 도 NOT_AVAILABLE 인데 AI Search 경로가 크롤해 후보를 만들었다** —
             `collection_strategy` 게이트가 **등록부 검색에만** 걸리고 URL 풀에는 안 걸린다
             🟢 추천 = **E(미복구)** + 정책 비대칭 먼저 판정 · 🔴 **구현 0 · 운영 코드 0**
[직전]       **E2E-07** — 🟢 입구 손실 `raw 9 → usable 2` · 최대 손실 **403 5건(71%)**
             `raw 9 → PRODUCT_PAGE 7 → accepted 7 → usable **2** → miEligible 2`
             🔴🔴 **단일 최대 손실 = 403 · 5건(최종 손실의 71%)** —
             gmarket ×2 · coupang · farfetch · babyshop (🇰🇷추정 3건 포함)
             🟢 **검색 결과에 국내 후보는 6/9 로 충분했다** ⟹ **Query 문제가 아니다**
             🔴 403 은 **세기만 했다** — UA·Cookie·Proxy·브라우저·retry **전부 0**(SP-13 유지)
             🟡 403 대응은 **제품/기술 의사결정** — CTO 가 열지 않는다(CPO 판정)
[직전]       **E2E-06** — 🟢🟢 재주입으로 response 까지 직접 증명(CASE A)
             저장된 Search 결과를 **운영 runner 에 재주입**(mock 은 검색 호출 하나뿐) ⟹
             `supplied 9 → accepted 7 → usable 2 → miEligible 2` ·
             **`webSearchEvidence = array(2)`**(11st `KR` · danawa `UNKNOWN`) = **CASE A**
             ⟹ 🔴 UI 도 response 도 아니다. CEO 화면의 0 은 **그 실행의 공급** 이다
             🔴 CPO 전제 정정 — 그 `JUDGED` 는 **CEO 09:44 실행의 값이 아니다**(분모 다름)
             🔴 **danawa 는 market UNKNOWN** 이라 🇰🇷 구역이 아니라 「🛰 AI 검색 후보」에 선다
NEXT         🔵 **CTO 가 할 일이 없다** — 다음 실행 1회의 `[SP07-pool]` 이 공급을 그대로 말한다
             🔴 그 1회를 **만들지 않는다**(`1 Product = 1 Search`) · 재실행으로 때우지 않는다
             🔵 전략은 **docs/DISCOVERY-STRATEGY-LOCK.md** 에 고정됐다(세션 바뀌어도 남는다)
CEO ACTION   🔵🔵 **있다** — docs/DISCOVERY-E2E-02-SCREEN-CHECK.md **부록** 대로
             현재 배포본에서 **「새 상품 분석」 «1회»** · 볼 것은 셋뿐
             (① 🇰🇷 국내 후보가 행으로 보이는가 + **「AI 검색」 출처 표시** ② 해외 후보 유지
              ③ 국내 참고가격 · 해외 최저 소싱가 정상)
             🔴🔴 **같은 상품을 다시 분석하지 않는다** — `1 Product = 1 Search` 를
             우리가 먼저 깨는 일이다(CPO 정정 · CTO 의 「한 번 더 돌리면 된다」는 **철회됐다**)
CLOSED       UX-01 · UX-02 · SAME-01 · SAME-02 · STEP 5 ·
             **SAME-03**(화면 + CEO GT 10/10) · **SAME-04**(FN 3건 원인 확정) ·
             **DESC-EVIDENCE-01**(provenance + 6축 + probe 4축 · 운영 2경로 배선) ·
             **IMAGE-EVIDENCE-01**(공급 32/32 · 판별 실증 · GO) ·
             **IMAGE-EVIDENCE-02**(C22 공급 0→1 · 정규화 Evidence · READY) ·
             **FINAL-VISUAL-01**(QA X-Ray · 운영 UI 격리 · 운영 파일 변경 0) ·
             **SEARCH-PROVIDER-02/03/04**(URL 분류기 2줄 · Query 폭 · Q2/Q3) ·
             **SEARCH-PROVIDER-05**(Q1~Q8 + Planner 8축 전수 64회 · 526 URL · 운영 배선 0) ·
             **SEARCH-PROVIDER-06**(목적형 I-1~I-3 · 🔴 상품명 영어 Query 는 국내 0 · 품번 축만 섞인다) ·
             **SEARCH-PROVIDER-07**(🟢 단일 Query 운영 배선 · 1 Product = 1 Search · MI 미연결) ·
             **SEARCH-PROVIDER-08**(목적 문구 PoC · 🔴 효과는 「목적」이 아니라 「한국어」 · 구현 0) ·
             **SEARCH-PROVIDER-09**(판매처 Signal PoC · 🟢 품번 없어도 Search 0 아님 · 구현 0) ·
             **SEARCH-PROVIDER-10**(안정성 2회 관측 · 🔴 URL 겹침 3~30% · 국내 82%가 한 상품 · HOLD) ·
             **SEARCH-PROVIDER-11**(파이프라인 전수 · 🔴 원상품 47%가 품번 없음 · 입구 손실 44%) ·
             **SEARCH-PROVIDER-12**(🔴🔴 입구 손실의 절반이 **우리 분류기** · 1-hop 은 이미 작동) ·
             **SEARCH-PROVIDER-13**(`-item-{id}.aspx` 상품 분류 · UNKNOWN→PRODUCT 50 · 오분류 0 · 🔴 회수 0) ·
             **SEARCH-PROVIDER-14**(직접 vs 1-hop 분리 · 1-hop 증분 Evidence **4**(+6%) · 오염 0) ·
             **DISCOVERY E2E**(Search 1회 → 후보 3 → 전부 PRESUMED_SAME · 🔴 사람 확인 0/3 ⟹ **HOLD**) ·
             **DISCOVERY E2E-03**(🔴 **단독으로는 닫히지 않았다** — E2E-04 가 이어서 닫는다)
Git          clean · origin/main 0/0 · Production / 200
회귀         **719 files / 9,561 passed / 0 failed / 153 skipped** · typecheck 0 · build 0
```

🔴🔴🔴 **E2E-04 가 남기는 영구 교훈 — 「배선했다」를 「보인다」로 쓰지 않는다**
```
패널의 evidence 소비처는 **넷** 이다(둘이 아니다):
  ① marketComparisonInput.rows      → 📊 시장 판단(집계)
  ② <TransientCandidateSections>    → **후보 카드(화면 행)**
  ③ buildMarketJudgement([...])     → MI 패널 가격 판단
  ④ judgementSummaryInput.transient → 요약 문장
🔴 E2E-03 은 ①만 고쳤다 ⟹ 집계는 움직이는데(`comparisonSellers 2`) **화면 행은 0** 이었다.
🟢 이제 계약이 **runner 결과 타입에서 생산자를 전수로 뽑아** ①~④ 와 🇰🇷 합집합 · 출처 배지까지 본다.
🔴 그리고 **소스 계약으로 완료를 선언하지 않는다** — 마운트 DOM 축을 같이 둔다(헌장 §5).
```

🔴 **CTO 가 할 코드 작업이 없다.** 다음은 **CPO 판정** 이다 — matcher 를 CTO 가 열지 않는다.
🔴 **용어는 여섯뿐** — MEASURED / CLOSED / HOLD / REJECT / 측정불가 / STOP.
🟢 종료된 WU 상세·정합표·과거 측정은 전부 `docs/ARCHIVE-CLOSED-WU.md` 에 있다(막혔을 때만 연다).

---

## 1. PROJECT RESUME — 페이지를 옮길 때 이것만 붙인다

```
[PROJECT RESUME] 따져(TTAEJYO) — 스마트스토어 상품자동등록

진입점     docs/START-HERE.md  ← **이것만 읽고 시작한다**(과거 세션 내용을 붙이지 않는다)
CURRENT    CORE-DESC-EVIDENCE-01 — 지시서 **§9-Y 에 고정** · 🔴 **조사 없이 구현부터** 간다
역할       이 페이지는 [ CPO / CTO / CEO ] 중 하나다
금지       matcher · threshold · 8축 · priceTier · domesticReference · 국내가격 pipeline ·
           A/B 가격 · 셀러 UI · description 연결 · image scoring — **전부 변경 0**
재조사 금지  SAME-01 STEP 1·2·2-R 결론 · UX owner · A/B 정책 · STEP 5 · 8축
용어       MEASURED / CLOSED / HOLD / REJECT / 측정불가 / STOP — 이 여섯만 쓴다
```

🔴 **전체 역사를 복사하지 않는다.** 위 10줄이면 새 페이지가 이어서 일할 수 있다.
🔴 종료된 것은 `docs/ARCHIVE-CLOSED-WU.md` 에 있고 **막혔을 때만** 해당 절 하나를 연다.

---

## 2. 역할

| | 하는 일 | 🔴 하지 않는 일 |
|---|---|---|
| **CEO** | 실제 서비스 화면 사용 · 최종 UI/UX 판단 · 등록 결과 확인 | 코드 · Git · 아키텍처 · 중간 디버깅 |
| **CPO** (GPT) | 전략 · 우선순위 · 정책 · 작업지시 · 결과 판정 · STOP/HOLD/CLOSED · **세션 간 결론 연결** | 코드 설계 강요 |
| **CTO** (Claude) | 조사 → 구현 → 계약 → 변이 → 회귀 → typecheck → build → Git → deploy → 증거 보고 | 정책 결정 · 범위 임의 확장 |

🔴 **CTO 는 기술적으로 결정 가능한 것을 CPO 에게 반복 선택시키지 않는다.**
🔴 단 **제품 정책·전략 판단은 CPO 에게** 올린다. 🔴 **CEO 에게 「다음에 뭘 할까요」를 묻지 않는다.**

---

## 3. 🔴🔴 재조사 금지 프로토콜 — 새 페이지가 가장 먼저 읽는다

새 페이지는 **이 순서로만** 시작한다:

```
① MASTER HANDOFF 읽기 → ② §0 한 줄 상태 → ③ §11 CLOSED/HOLD/금지 → ④ §9 구현
```

**금지 행동 6**:

```
❌ 과거 작업 다시 조사            ❌ CLOSED 된 WU 재검토
❌ 이미 검증된 owner 재조사        ❌ 기존 정책을 새로 추론
❌ 과거와 결과가 다르다는 이유만으로 재실험
❌ 이전 페이지의 측정을 처음부터 반복
```

🟢 **reopen 은 CPO 가 「이 결론을 다시 검증한다」고 명시할 때만** 한다.

### 🔴 실제로 발생하면 안 되는 네 문장 (CEO 지목)

```
❌ 「국내가격이 왜 COMPARISON 인가요? 다시 조사해볼게요」      → 이미 조사됐다(§11)
❌ 「description 을 연결하면 정보가 많아지니 구현해볼까요?」    → CASE C 로 닫혔다(§10)
❌ 「B 가 88,000 이니 권장 판매가격도 88,000 으로 하죠」        → A/B 정책 확정(§6)
❌ 「판매판단은 한 곳만 두는 게 깔끔하니 오른쪽을 지웁니다」    → 「결론은 하나, 표현 위치는 둘」(§9)
```

---

## 4. NORTH STAR

이 제품은 **후보 검색 결과를 많이 보여주는 시스템이 아니다.**

```
상품 1개 입력 → 동일상품 후보 탐색 → MI 가 SAME 판정
→ SAME 상품의 판매상태/가격 확보 → 셀러에게 판매 여부와 판매가격 판단 근거 제공
```

| ❌ 중요하지 않다 | ✅ 중요하다 |
|---|---|
| 후보가 몇 개인가 | **동일상품 2~3개의 가격** |
| 유사상품·AI 결과 개수 | 🇰🇷 국내 **참고가격** · 🌎 해외 **최저 소싱가** |
| 셀러가 후보를 하나씩 판단 | **MI 판매판단 + 권장 판매가격 + 실제 판매가격 설정** |

🔴 **SIMILAR · DIFFERENT · UNDECIDED 는 seller surface 에 노출하지 않는다.**
🔴 셀러가 직접 SAME/SIMILAR 를 판단하지 않는다 — **MI 가 한다.**

**셀러가 5초 안에 답을 얻어야 한다**: 「팔아도 되는가 → 얼마에 팔면 되는가 → 왜 이 가격인가」

### 🔵 최종 방향 — 🔴 **아직 «열리지 않았다»**(CPO 확정 2026-10-24)

```
국내 시장가격 → 해외 최저 소싱가 → 비용/배송/세금/수수료 → 목표마진
             → 추천 판매가격 → 판매 여부
```

🔴🔴 **이 문장을 착수 승인으로 읽지 않는다.** `CLAUDE.md §00-B` 의 가격 보류가 그대로
유효하고 **추천 판매가 · 마진 · 예상수익 «계산» 은 §7 ABSOLUTE FREEZE 에 남아 있다.**
그 범위는 **CPO 가 따로 지정** 한다. 🟢 지금 열려 있는 입력은 **원가 한 칸** 이고, 화면은
그것이 비었다는 사실만 말한다(「🧾 현재 판단」).

### 🔴🔴 이 두 문장을 같은 말로 쓰지 않는다

```
동일상품 «확정»  = MI 가 엄격하게 SAME 으로 확정한 수   ← 🟢 **0 이어도 정상이다**
참고가격        = 동일상품으로 «보이는» 후보에서 확보한 실제 판매가격
⟹ 「MI 가 아직 확정하지 못했지만 **시장가격 정보는 확보했다**」는 상태를 숨기지 않는다
```

---

## 5. MARKET RULE

🔴 국내/해외는 **검색/MI 파이프라인을 분리하지 않는다.** 공통이다:

```
원상품 → 후보 수집 → MI SAME 판정 → 판매상태 → 가격 추출
```

**차이는 «최종 가격 해석» 만이다.**

```
🇰🇷 국내   SAME 0 → 가격대 없음 · SAME 1 → **가격대 확정 불가** · SAME 2~3 → **시장 가격대**
          🔴 평균 · 추천가격 계산 금지
🌎 해외   같은 통화 → **최저 확인가** · 여러 통화 → **통화별로 각각**
          🔴 환산 금지 · 🔴 통화가 다른 숫자를 서로 비교하지 않는다
```

---

## 6. 🔴🔴 가격 정책 A / B — 절대 혼동 금지

```
A = 권장 판매가격   «내가 얼마에 팔 것인가»   — 원가 기반 · 사용자에게 보여주는 값
    landed cost → fee → target margin → **suggestedPriceKrw**   (기존 계산 그대로)
    owner: CommerceWorkspace.tsx:1996 `recommendedPriceKrw`

B = 국내 시장가격   «시장에서 얼마에 팔리고 있는가»   — **근거** 다
    화면 명칭 「🇰🇷 국내 참고가격」 · owner: marketComparison.domesticReference
```

🔴 **금지 3** — B 를 권장 판매가격으로 사용 · A/B 를 합친 새 추천가격 생성 ·
「국내 최저가 = 권장 판매가격」으로 변경.

🟢 실측 기준선(재계산 금지) — 착지원가 ₩230,721 · **A ₩295,796** · **B ₩258,000**
(marketCase B · Net 0.6%) · 셀러 확정가 ₩295,800 ⟹ **셀러가 A 를 그대로 적용했다.**

---

## 7. ABSOLUTE FREEZE

```
MI 판정축 · SAME threshold · 8축 · crossSellerReserved · discovery algorithm ·
Registry · adapter · price_alerts · DB schema · Gemini/API 비용 구조 ·
추천 판매가격 계산 · 마진 계산 · 통화 환산 · 새 후보 검색 알고리즘 ·
새 seller candidate UI · 국내 SAME 판정축 개선
```

🔴🔴 **국내 SAME = 0 을 이번 WU 에서 해결하려 하지 않는다** — 별도 WU 다.
🟢 근거는 측정돼 있다: 첫 divergence 는 **공급**(국내 6·4 : 해외 30·25)이고 어댑터 게이트는
국내 0/2 · 해외 3/22 로 양쪽을 거의 같게 막는다. **재조사 금지.**

---

## 8. ALREADY DONE — 재구현하면 하나인 것을 둘로 쪼갠다

```
Seller Decision      최종 owner **하나**(`seller-decision`)
Price owner          시장가격 숫자를 여러 영역에서 중복 표시하지 않는다
Price interpretation 🇰🇷 가격대 · 🌎 최저 확인가 · 통화별 · 환산 0 · 추천 0
MI blocker           1차 **건수만** · 사유는 `▸ MI 상세 분석`(2차) — 삭제가 아니라 이동
후보 접힘             모든 후보 구역이 `candidate-fold`(기본 접힘 · `open` 금지)
STEP 4               권장 판매가격 A 1차 노출 + **ⓘ 가격 계산 기준 앵커 복구**(배포 `6fe1b0bf`)
```

### SAME_PRICE_CAP = 3 — 🔴 가격 «계산» 에만 적용

```
🔴 SAME **건수를 3개로 잘라 숨기지 않는다** — 「동일상품 확인 5곳」은 그대로 표시한다
🟢 가격 계산에 쓰는 데이터만 **통화별 최대 3개**(GBP 3 · USD 3 · EUR 3 …)
🔴🔴 전역 3개로 자르면 통화가 섞여 **「최저 확인가」가 거짓** 이 된다
```

🟢 계약·변이는 이미 검증됐다(`wu-148-market-price-signal` D) — **재사용하고 재구현하지 않는다.**

---

## 9. 🟢🟢 **CORE-PRICE-SAME-03 — 화면 구현 «완료» · CEO 판정 대기**

> 🟢 산출물 **`docs/core-same03-domestic-review.html`**(4.35MB · 자립형 · 원격 이미지 0).
> 🔴 변경 — matcher **0** · threshold **0** · priceTier **0** · domesticReference **0** ·
> 가격 pipeline **0** · **셀러 UI 0** · 운영 파일 **0**(전부 `__tests__` + `docs/`).
> 🔴 **CTO 가 판정하지 않았다** — 라디오 10 × 3 전부 미선택(`checked` 속성 0).

### 🟢 실측 결과 — **국내 후보 10 / 원상품 2**

```
🇰🇷 B226AC009  biskuit.kr          PRESUMED_SAME  COMPARISON  **국내가격 포함** · BRAND_MISMATCH+NO_TITLE_OVERLAP
              donokids.com        PRESUMED_SAME  COMPARISON  미포함(KRW 88,000 · 🔴 등록부 미조회) · BRAND_UNCONFIRMED
              global.trenbe.com   **SAME**       **EXACT**   미포함(USD 80 · 해외 통화) · 보류 0 · 🔴 CEO 라벨 **충돌**
              m.luxboy.com        PRESUMED_SAME  COMPARISON  미포함(KRW 59,000 · 🔴 등록부 미조회) · 🔴 CEO 라벨 **충돌**
              miniboutique.co.kr  **UNREACHABLE** — 측정불가(🔴 빼지 않고 표시했다)
🇰🇷 B226AC010  beaumonde.co.kr(목록) SIMILAR      EXCLUDED    미포함 · NO_TITLE_OVERLAP+BRAND_UNCONFIRMED
              beaumonde.co.kr(상세) **SAME**     **EXACT**   **국내가격 포함** · 보류 0
              kream.co.kr         **UNREACHABLE** — 측정불가(🔴 실행 간 OK ↔ UNREACHABLE 로 갈린다)
              luksusbaby.kr(1)    **REDIRECTED_AWAY** — 측정불가
              luksusbaby.kr(2)    CONFLICT       EXCLUDED    미포함 · 반증 COLOR
⟹ 페이지 읽기 **7/10** · 이미지 **7/10** · 국내 참고가격 포함 **2** · 과거 판정 충돌 **2**
```

### 🔴🔴🔴 지시서를 **실측으로 정정한 것 셋** — 다시 조사하지 않는다

```
① 「wu-059/067/074 는 originCode 가 없다」  → 🟢 **틀렸다. 전부 증명 가능하게 매핑된다**
   `wu-059.origins[searchId].canonicalProduct.sku.value` 가 그 맵이고,
   🟢 **증명 두 축** 으로 잠갔다 — 원상품 제목 **6/6 일치**(59↔67) ·
   같은 후보 id 가 세 파일에서 **같은 URL 19/19**. 🔴 증명이 깨지면 조인을 **쓰지 않는다**
② 「wu-116 kream.co.kr = AC009」          → 🔴 **AC010 이다**(fixture 가 그렇게 적어 뒀다)
③ 「국내 도메인 11개」                     → 🔴 **분모가 섞여 있었다.** 그 11 에는
   ⒜ 다른 원상품(wconcept → S6 트랙수트)과 ⒝ **가치 라벨**(`wu-099/100` ·
   USEFUL/NOISE · 원상품 **B226AC112**)의 도메인이 들어 있다 —
   `miniboutique` · `mustit` · `littleluna` 가 **거기서만** 나온다
   ⟹ 🟢 동일상품 GT + 원상품 확정 + 국내 = **후보 10 · 도메인 8**
🔴 그리고 「miniboutique 가 KRW 88,000 의 출처」도 **정정한다** — 실측 88,000 은
   **biskuit.kr**(국내 참고가격에 실제로 들어간다)과 **donokids.com** 이고,
   miniboutique 는 **읽히지 않아 가격이 없다**
```

### 🔴🔴 측정불가 / 한계 — **넘겨 읽지 않는다**

```
⒜ 🔴🔴 **이 화면은 국내 판매처 등록부를 조회할 수 없다**(service-role 키 없음) ⟹
   `classifyCandidateMarket` 의 「등록부 + KRW」·「판매자 증거 + KRW」 분기가 **발화하지 않는다**.
   그래서 **KRW 후보 둘**(donokids 88,000 · luxboy 59,000)의 「KR 아님」은 **측정불가** 다 —
   🟢 화면이 그 문장을 **직접** 말한다(「운영에서는 KR 로 확정될 수 있습니다(측정불가)」)
⒝ 🔴 페이지 읽기가 **실행 간 갈린다** — `kream.co.kr` 이 한 실행에서 OK(CONFLICT/COLOR),
   다음 실행에서 UNREACHABLE 이었다. 🔴 「그 사이트를 읽을 수 없다」로 적지 않는다
⒞ 🔴 후보 `imageUrl` 은 추출 경로에서 **하드코딩 null** 이라 **IMAGE 축이 계산되지 않는다** ⟹
   화면의 사진은 `og:image`/JSON-LD 보충이고 **판정에 쓰이지 않았다**(화면에 적었다)
⒟ 🔴 **실제 따져 화면이 아니다** — 이 산출물은 `docs/` 자립형 HTML 이고 셀러 UI 연결 **0**
```

### 🔴🔴 화면이 **드러낸** 것 — 「CEO 가 SAME 이라 봤는데 왜 막혔는가」

```
🟢 `global.trenbe.com` 은 **SAME/EXACT** 이고 보류가 **0** 이다 — 그런데 **CEO 라벨이
   충돌** 한다(wu-112/111 SAME ↔ wu-059 DIFFERENT) ⟹ 🔴 **이 한 건이 이번 판정의 핵심** 이다
🟢 `beaumonde.co.kr` 상세는 **SAME/EXACT + 국내가격 포함** 이다 ⟹ 🔴 「국내 SAME 0」은
   **AC009 에 대한 문장** 이고 AC010 에서는 성립하지 않는다(섹션을 섞어 읽지 않는다)
🔴 반증(`CONFLICT`)을 만난 후보는 `axes: []` 로 **조기 종료** 되어 나머지 축이
   **계산조차 되지 않는다** ⟹ 화면이 `NOT_AVAILABLE` + 「조기 종료」로 **UNKNOWN 과 가른다**
```

### 🟢 변경 파일 — 운영 **0**

```
신규  __tests__/core-same03-inventory.ts        인벤토리·원상품 조인 증명(순수 · 네트워크 0)
신규  __tests__/core-same03-evidence.ts         8축 읽기(순수 · MI 변경 0)
신규  __tests__/core-same03-inventory.test.ts   계약 **20**(CI 상주 · 네트워크 0)
신규  __tests__/core-same03-review-dom.test.ts  **마운트 DOM** 계약(jsdom · 네트워크 0)
신규  __tests__/core-same03-domestic-review-build.test.ts  화면 생성(🔴 `CORE_SAME03_LIVE=1` 로만)
신규  docs/core-same03-domestic-review.html     **CEO 판정 화면**
🔴 `core-2m` 빌더와 그 산출물은 **한 글자도 건드리지 않았다** — 그 파일의 「내부 토큰 0」
   계약과 이 WU 의 「내부 결과 노출」 요구가 **충돌** 하므로 **파일을 둘로 갈랐다**
🟢 변이 **M1~M11 전부 FAIL → 복구**(두 모듈 **바이트 동일** 확인 · 잔여 `MUTATION` 0)
🔴🔴 **변이가 내 계약 셋을 뚫었고 셋 다 메웠다** — ⒜ 원상품 미상 가드가 **발화한 적이 없었다**
   (합성 행으로 직접 찔러 잠갔다) ⒝ 「측정불가를 빼지 않았다」가 **이미 빠진 것을 못 본다**
   (인벤토리 수 ↔ 화면 수 대조로 바꿨다) ⒞ 등록부 경고 대조가 **`0 === 0` 으로 통과**
   (발화 단언 `> 0` 을 앞에 세웠다)
```


---

## 9-B. 🟢🟢 **CORE-PRICE-SAME-04 — CEO GT 10/10 + FN 3건 원인 확정**(운영 변경 0)

### 🔴🔴🔴 분모를 먼저 적는다 — **precision 은 측정불가** 다

```
CEO 라벨   동일 **5** · 판단불가 **5** · **다른제품 0**
⟹ 🔴 「시스템 SAME 인데 사람은 다르다」 분모가 **0** 이므로 **precision 을 측정할 수 없다**.
   🔴 「오포함 0」을 정밀도 근거로 쓰지 않는다 — 분모가 없는 0 이다.
🟢 재현율 — CEO 동일 5 중 system SAME 확정 **2** · 보류(PRESUMED_SAME) **3**
🟢 국내 참고가격 진입 — CEO 동일 5 중 **2**(biskuit · beaumonde)
🔴 판단불가 5 의 성질 — **읽기 실패 3** + 목록 URL 1 + 이미지 부족 1 ⟹ **판정 실패가 아니다**
🔴 사유 **3/10 은 근거 측정불가** — 입력 사유 네 건이 글자 그대로 같았다(붙여넣기) ⟹
   donokids · m.luxboy · beaumonde 의 「무엇을 보고 판단했는가」를 그 후보 서술로 쓰지 않는다
라벨 고정 `fixtures/core-same03-human-gt.json`(**URL 키** · WU-095 교훈)
```

### 🟢 FN 3건 — **실측 trace**(운영 함수 그대로 · 복제 계산은 교차검증했다)

`cross-seller.ts:1202` → `if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME"`

| 후보 | brand | 품번 | TITLE | corePoints | 보류 | **실패 조건 수** |
|---|---|---|---|---:|---|---:|
| biskuit.kr | 🔴 **「비스킷」**(판매처명) | exact | 🔴 겹침 0 | **4** | BRAND_MISMATCH · NO_TITLE_OVERLAP | **3** |
| m.luxboy.com | 🟢 BOBO CHOSES | exact | 🔴 겹침 0 | **5** ✓ | NO_TITLE_OVERLAP | 🔴🔴 **1** |
| donokids.com | 🔴 **null** | 🔴 **null** | 🟢 +2 | **3** | BRAND_UNCONFIRMED | **3** |
| 🟢 trenbe(baseline) | BOBO CHOSES | exact | +1 | 6 | 없음 | 0 |
| 🟢 beaumonde(baseline) | Bobo Choses | exact | +1 | 5 | 없음 | 0 |

🔴🔴 **「축 하나를 열면 3건이 산다」는 거짓이다** — `m.luxboy.com` 만 **단일 차단** 이고
나머지 둘은 **세 조건이 동시에** 실패한다. 🟢 복제식(`corePoints`·`brandOk`)은 운영
verdict 와 **5/5 대조 통과** 했다(틀린 복제로 원인을 적지 않았다).

### 🔴🔴 원인 분류 — **CEO 근거는 페이지에 «있다». 칸까지 오지 않는다**

```
① biskuit    EXTRACTION + NORMALIZATION + AXIS
   raw HTML 에 보보쇼즈 **26** · B226AC009 **21** · BOBO CHOSES **3** ⟹ 공급은 있다
   🔴 그런데 brand 칸 = **「비스킷」**(판매처가 그 자리에 자기 이름을 적었다)
      ⟹ `:807 brandKnown` 참 · `:808 brandOk` **거짓** → `:835 BRAND_MISMATCH`
      🟢 WU-080 이 「extractor 가 명시된 자리를 정직하게 읽었다(결함 아님)」로 닫은 그 모양
   🔴 제목이 **한글 음역만** 이다 — [보보쇼즈·허그·헤어리·몬스터·티셔츠] ↔ [hug·hairy·monster·shirt]
      ⟹ jaccard **0** → `:929 NO_TITLE_OVERLAP` (WU-078 이 음역 축을 REJECT 로 닫았다)
② m.luxboy   🔴🔴 **AXIS 단일** (근본은 SUPPLY)
   brand ✓ · 품번 exact ✓ · brandOk ✓ · corePoints **5** ✓ ⟹ **NO_TITLE_OVERLAP 하나** 가 막는다
   🔴 원인은 그 페이지 제목에 **상품명이 없다** — 「보보쇼즈(BOBO CHOSES) 키즈 긴팔티셔츠
      B226AC009 | SINCE 2002 … 럭스보이」 = 브랜드 + 카테고리 + 품번 + 판매처 홍보문뿐
③ donokids   EXTRACTION + SUPPLY + AXIS
   🔴 brand **null** — 페이지엔 보보쇼즈 10 · BOBO CHOSES 3 이 있고 **breadcrumb 에도** 있다
      (`categoryText = "BOBO CHOSES (대) > F/W 2026 (중)"`) ⟹ brand extractor 가 **제목·breadcrumb 를
      읽지 않는다** → `:1122 BRAND_UNCONFIRMED`
   🔴 품번 **null** — 그 페이지는 **`#226AC009`** 로 적는다(「B」가 없다 · raw 에 `B226AC009` **0회**)
      ⟹ `modelCode = unavailable` → MODEL_CODE 축 **0점**(baseline 둘은 +3)
   🟢 제목 축은 **정상 작동** 했다(+2 hug/hairy/monster) — 영문 상품명을 같이 적기 때문이다
🔴 MATCH_TRUTH **0건** · PRICE_TIER **0건** — `TEXT_CONFIRMED`(`match-truth.ts:233`
   `crossSellerReserved`)와 `COMPARISON`(`domestic-product-link.ts:88`)은 **PRESUMED_SAME 의
   정상 귀결** 이다. 🟢 가격 축은 이미 통과한다(biskuit 이 국내 참고가격에 들어간다)
🔴 luxboy·donokids 의 국내 미포함은 priceTier 가 아니라 **market UNKNOWN** 이고,
   그 판정은 **등록부 미조회 때문에 측정불가** 다(운영에서는 KR 일 수 있다)
```

### 🔴🔴🔴 **CPO 판정 1건 — 코드 주석의 전제가 CEO 라벨로 반증됐다**

```
`cross-seller.ts:802-804` 가 적어 둔 경고:
  「🔴 알려진 의존 — `m.luxboy.com` 은 품번 exact 인데 human **DIFFERENT** 다.
    C3 를 켜면 그 쌍을 막는 것이 **NO_TITLE_OVERLAP 하나** 가 되므로
    그 축을 완화하는 변경과 **절대 같이** 가면 안 된다」
🔴🔴 그 전제의 「human DIFFERENT」가 **이번 CEO 라벨에서 「동일」로 뒤집혔다.**
   그리고 그 주석이 예고한 상태가 **실측으로 그대로 재현** 됐다 — 막는 것이 그 축 하나다.
🔴 **CTO 는 열지 않았다.** 완화의 안전성을 **이 표본으로 증명할 수 없다** —
   「다른제품 0」이라 WU-063~080 이 측정한 「완화 = Human DIFFERENT 동반 개방」의
   위험을 **잴 분모가 없다**. ⟹ 재개 조건은 §10 의 **「GT 기반 정밀도 재측정 WU」** 와 같다.
```

🟢 **COLOR 반증은 이 표본에서 오차단하지 않았다** — 유일한 COLOR 반증(`luksusbaby` t-shirt)의
CEO 라벨이 **판단불가** 다(동일이 아니다) ⟹ 🔴 COLOR 완화 근거로 쓰지 않는다.

---

## 9-C. 🟡🟡 **CORE-PRICE-SAME-05 — STEP 1~4 반사실 측정 완료 · 구현 «전» STOP**

> 🔴 운영 코드 **0**(matcher · threshold · 8축 · priceTier · 가격 pipeline · 셀러 UI 전부 0).
> 🔴 §11 STEP 5(통합)의 전제 — 「P0/P1/P2 가 **각각 안전성을 통과** 했을 때만」 — 가
> **충족되지 않았다.** 그래서 통합하지 않고 STOP 한다.

### 🔴🔴🔴 핵심 — **분모가 둘로 갈려 있고, 그래서 §12 를 충족할 수 없다**

```
안전성(DIFFERENT) 분모   GT 33쌍  SAME 17 · DIFFERENT 10 · UNCERTAIN 6  (wu-059 + wu-068 저장 facts · 네트워크 0)
효과(제목 문제) 분모      SAME-03 FN 3건                                 🔴 **DIFFERENT 0**
🔴 두 분모를 합치면 「recall 올랐고 leakage 없다」가 **서로 다른 표본의 말** 이 된다.
```

### 🟢 baseline (STEP 1 · 계약으로 고정)

```
TP 5/17 · FN **12** · DIFFERENT 방어 8/10 · 🔴 **FP 2** · UNCERTAIN 6(시스템 SAME 0)
🔴🔴 **baseline FP 는 0 이 아니라 2 다** — 이미 알려진 False EXACT 둘이다:
   C06 `global.trenbe.com`(WU-060) · S1-6 `www.tinyapple.net`(WU-068)
   ⟹ §12 기준은 「FP 0」이 아니라 **「2 에서 늘지 않는다」** 다
🔴 FN 12 의 원인 — BRAND_UNCONFIRMED **5** · MODEL_CODE 반증 **3** · FIT 1 · 기타 3
🔴🔴 **P0 축(`NO_TITLE_OVERLAP`)이 막는 FN = 0 / 12** ⟹ 이 GT 로 P0 효과를 못 잰다
```

### 🔴🔴 STEP 2·3·4 반사실 — **안전성 분모에서 「발화 자체가 0」이다**

| 축 | 발화한 쌍 | SAME Δ | FP Δ | 판정 |
|---|---|---:|---:|---|
| P0 TITLE 음역 | **1** (`C27` beaumonde · human **SAME**) | +0 | +0 | 🔴 **leakage 측정불가** |
| P2 MODEL_CODE 복원 | **0** | +0 | +0 | 🔴 **측정불가**(발화 0) |
| P1 BRAND 보강 | **1** (`C27` · human **SAME**) | +0 | +0 | 🔴 **leakage 측정불가** |

🔴🔴 **DIFFERENT 쌍에서 발화한 반사실이 «하나도 없다»** ⟹ `FP +0` 은 **「leakage 가
없다」가 아니라 「측정할 기회가 0 이었다」** 다(§9 측정불가 규칙).
🟢 원인은 데이터다 — DIFFERENT 10 중 **한글 토큰 보유가 1**(C22)이고, 품번 절단형은 **0** 이다.

### 🟡 효과 분모 — FN 3건(라이브 · 운영 순서)

| 후보 | baseline | P0 단독 | P2 단독 | P1 단독 | **셋 통합** |
|---|---|---|---|---|---|
| biskuit.kr | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | 🔴 PRESUMED_SAME |
| m.luxboy.com | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | 🔴 PRESUMED_SAME |
| donokids.com | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | PRESUMED_SAME | 🟢🟢 **SAME** |
| | | **0/3** | **0/3** | **0/3** | **1/3** |

🔴🔴🔴 **CPO 전제가 반증됐다** — 「가장 효과가 큰 `NO_TITLE_OVERLAP` 부터」였는데
**P0 단독 효과가 0/3** 이다. 🟢 유일한 회복(`donokids`)은 **P1+P2**(brand+code)에서 나온다.

```
🔴 biskuit 가 안 되는 이유 — brand 가 **「비스킷」(판매처명)으로 «선언»** 돼 있고,
   §6 이 「inferred 가 declared 를 이기게 하지 말라」고 했으므로 **덮지 않았다**
   ⟹ BRAND_MISMATCH 가 남아 `blocked` 가 유지된다
🔴 luxboy 가 안 되는 이유 — 그 페이지 제목에 **상품명이 아예 없다**(브랜드+카테고리+
   품번+홍보문) ⟹ **음역할 대상이 없다.** 🔴 **이것은 SUPPLY 문제이고 matcher 로 못 푼다**
🟢 donokids 가 되는 이유 — brand 보강(보보쇼즈→Bobo Choses)이 `brandOk` 를 열고,
   품번 복원(`#226AC009`→`B226AC009`)이 MODEL_CODE +3 을 줘 corePoints **6 ≥ 5**
```

### 🟢 통과한 안전 게이트(§10·§12 필수)

```
🟢 필수 안전 케이스 — **품번 exact + human DIFFERENT 2건**(`C19`·`C20` junioredition ·
   품번 재사용 실례)이 **모든 축·모든 모드에서 non-SAME 유지**
🟢 새 FP **0**(FP 2 → 2) · 기존 TP 유지(5 → 5)
🟢 P2 는 **후보 코드가 null 일 때만** 발화한다 ⟹ 값이 있는 후보를 덮지 않아
   `AC042↔AC043` 충돌 보호가 **한 글자도 안 바뀐다**(전수 단언)
🟢 음역 표는 **관측된 3토큰**(허그·헤어리·몬스터) + **기존 `lookupBrandAlias` 역방향** 뿐 —
   새 번역 사전 **0**(§4 금지 준수 · 계약으로 잠금)
```

### 🔴🔴 그래서 **구현하지 않았다** — 통합을 막는 것은 둘

```
① §11 STEP 5 가 「각 축이 **안전성을 통과** 했을 때만 통합」이라 했고,
   P1/P2 의 안전성은 **통과가 아니라 측정불가** 다(DIFFERENT 발화 0)
② §12 중요 — 「SAME recall 개선 **과** DIFFERENT leakage 없음」이 **동시** 여야 하는데
   그 둘이 **서로 다른 분모** 에서만 나온다
🔴 그리고 WU-164(CPO 2026-10-22)가 같은 축을 「leakage 1건이라도 생기면 NO-GO」로
   닫았고, WU-078 은 음역 축을 **종료** 했다 — 그 REJECT 사유를 **반증할 분모가 없다**
```

### 🔵 이것을 열려면 필요한 것 **하나**

```
🔴 **한글 제목 후보가 포함된 DIFFERENT GT** — 지금 GT 의 DIFFERENT 10 은 9 가 영문-영문이다.
🟢 그 GT 가 있으면 P0/P1/P2 의 leakage 를 **같은 분모** 에서 재서 §12 를 충족할 수 있다.
🔴 **CTO 가 새 DIFFERENT fixture 를 만들지 않았다**(§8 금지) — CEO 육안 라벨이 필요하다.
🟡 가장 값싼 경로 — SAME-03 화면에 **국내 후보를 더 넣어 CEO 가 「다른제품」을 라벨** 한다
   (그 화면과 하니스는 이미 있다 · `CORE_SAME03_LIVE=1`).
```

### 🟢 재사용 하니스(네트워크 0 · CI 상주)

```
core-same05-gt.ts              GT 적재 · 운영 판정 호출 · 집계(모듈)
core-same05-gt-baseline  5     baseline 고정 · FN 원인 분포 · 필수 안전 케이스
core-same05-counterfactual 7   축별 반사실 · **발화 확인 단언** · 필수 안전 케이스 전 모드
🔴 라이브 효과 축은 `CORE_SAME05_LIVE=1` 로만 (FN 3건)
```

🔴 **내 하니스 결함 넷을 측정이 잡았다**(그대로 보고했으면 전부 거짓 결론이었다) —
⒜ baseline FP 를 0 으로 단언(실제 **2**) ⒝ 반사실 발화를 0 으로 단언(실제 title 1 · brand 1)
⒞ 발화 쌍을 DIFFERENT 로 단언(실제 **SAME** ⟹ leakage 측정불가가 드러났다)
⒟ `all` 모드에서 **음역이 brand 추론보다 먼저** 돌아 브랜드 토큰을 없앴다
   ⟹ 「셋을 합쳐도 SAME 0」이라는 거짓이 될 자리였다(**brand → code → title** 로 고정).

---

## 9-D. 🔴🔴 **CORE-PRICE-SAME-06 — STOP: P1/P2 안전성 분모 확보 불가**(운영 변경 0)

> 🔴 §7 의 STOP 조건이 **전수 검색으로 확정** 됐다. 새 DIFFERENT GT 를 **만들지 않았다**(§2).
> 🔴 운영 코드 **0** · 새 fixture **0** · matcher **0**.

### 🟢 검색 범위 — **fixture 15개 전수 · 미분류 0**

```
수집 10 · 제외 6(이유를 각각 적었다) · 🔴 미분류 **0**(계약으로 단언)
제외 사유 — wu-093 **URL 없음**(SKU 키) · wu-099/100 **가치 라벨**(원상품 B226AC112) ·
            wu-067 라벨 없음 · wu-074 probe 전용
수집 결과 — 행 **102** · 고유 URL **70**
기존 라벨 — SAME **60** · DIFFERENT **28** · UNDETERMINED **14** · 해석 실패 **0**
DIFFERENT 출처 — wu-059:7 · wu-112:6 · core-2al:6 · wu-125:4 · wu-068:3 · core-2m:1 · wu-116:1
```

### 🔴🔴🔴 전수 교차표 — **발화 × 사람 라벨**(고유 URL 70 · 읽기 실패 3)

| 발화 | SAME | **DIFFERENT** | UNDETERMINED | 충돌 | 합 |
|---|---:|---:|---:|---:|---:|
| P1 BRAND | 1 | **0** | 0 | 0 | 1 |
| P2 MODEL_CODE | 0 | **0** | 0 | 0 | 0 |
| P1+P2 | 1 | **0** | 0 | 0 | 1 |
| 발화 없음 | 31 | 22 | 8 | 4 | 65 |
| 측정불가 | 1 | 0 | 1 | 1 | 3 |

```
발화한 후보는 **둘뿐이고 둘 다 SAME** 이다 — `beaumonde.co.kr`(P1) · `donokids.com`(P1+P2)
🔴 Case A(P1×DIFFERENT) **0** · Case B(P2×DIFFERENT) **0** · Case C **0**
⟹ 🔴🔴 **leakage 를 측정할 분모가 코퍼스 전체에 존재하지 않는다.**
```

### 🔴🔴 왜 구조적으로 0 인가 — **추측이 아니라 실측**

```
① P1 은 **후보 brand 가 null 일 때만** 발화한다(선언된 값을 덮지 않는 §6 계약).
   🔴 그런데 기존 DIFFERENT 16/16 이 **brand 를 이미 들고 있다**(전부 "Bobo Choses"/"BOBO CHOSES")
   🟢 이유도 확인됐다 — `lookupBrandByAliasInTitle` 가 **이미 운영에 배선** 돼 있다
      (`product-url-facts.ts:250`) ⟹ 그 사이트들은 og:title 에서 브랜드가 채워진다
   ⟹ 🔴 **P1 은 기존 DIFFERENT 에서 발화할 수 없다**(가드가 아니라 데이터 성질이다)
② P2 는 **절단형 품번**(`#226AC009` — 「B」 없음)이 제목에 있을 때만 발화한다.
   🔴 그 표기는 **국내 고도몰 계열(donokids)에서만** 관측됐고, 그런 후보에
      **DIFFERENT 라벨이 하나도 없다**(국내 후보의 CEO 라벨은 SAME 5 · 판단불가 5)
```

### 🔴 §13 GO 조건 대조

| 축 | 발화 분모 | DIFFERENT | leakage | 판정 |
|---|---:|---:|---:|---|
| P1 BRAND | 1 (SAME) | **0** | — | 🔴 **측정불가** |
| P2 MODEL_CODE | 1 (SAME) | **0** | — | 🔴 **측정불가** |
| 통합 | 1 (SAME) | **0** | — | 🔴 **측정불가** |

🔴 **GO 도 NO-GO 도 아니다 — 측정불가** 다. §9 규칙대로 **0 으로 처리하지 않는다.**

### 🔵 이것을 여는 길 — **CEO 라벨 하나뿐**(CTO 가 만들 수 없다)

```
🔴 CTO 가 새 DIFFERENT 를 만들면 그것은 §2 위반이고, CPO 가 원한 「사람이 실제 상품을
   보고 내린 GT」가 아니다.
🟡 필요한 것은 **「brand 가 공백이거나 품번이 절단형인 국내 후보」 중 CEO 가 «다른제품»
   이라 판정하는 것** 이다. 🟢 화면과 하니스는 이미 있다:
     docs/core-same03-domestic-review.html  (`CORE_SAME03_LIVE=1` 로 재생성)
     core-same06-safety-gt-search           (발화 검색 · 전수 교차표)
🔴 단 현재 국내 후보 10건의 CEO 라벨은 **SAME 5 · 판단불가 5 · DIFFERENT 0** 이다 ⟹
   **후보를 더 넣어야** 하고, 그 공급은 §7 ABSOLUTE FREEZE(discovery) 밖의 일이다
   ⟹ 🔴 **CPO 범위 결정 사안.**
```

### 🟢 재사용 하니스 (네트워크 0 · CI 상주)

```
core-same06-safety-gt-search  4   검색 범위 전수(미분류 0 단언) · 라벨 분포 · offline 발화 · 라이브 대상
🔴 라이브 — `CORE_SAME06_LIVE=1`(기존 DIFFERENT 17건 발화) ·
            `CORE_SAME06_FULL=1`(고유 URL 70 전수 교차표)
```

---

## 9-E. 🔴🔴 **CORE-MI-PRICE-01 — STOP: Level 2(가격 형성대) 0/3**(운영 변경 0)

> 🔴 새 가격 산식 **0** · UI **0** · matcher **0** · threshold **0**.
> 🟢 **재조사 금지 준수** — WU-172·WU-FINAL-3 가 이미 한 E2E 를 다시 만들지 않고 **실행** 했고,
> 그 입력(human GT 국내 URL)을 **그대로** 썼다.

### 🟢🟢 먼저 — **「가격 형성대」는 이미 구현돼 있다**(§9 의 UI 계약 변경 **불필요**)

```
owner  `mi-same-candidates.ts` — buildPriceGuide · basis **SINGLE ↔ RANGE**
       :519 「🇰🇷 국내 «시장 가격대» — 89,000 ~ 95,000 ⟹ 대략 9만원대에 형성돼 있다」
       :522 「🔴 **1개를 가격대라고 부르지 않는다**」 · :556 「가격대 확정 불가」를 글자로 말한다
⟹ 🟢 CPO 의 **Level 0/1/2 가 이미 코드에 있다**(WU-139/148). 🔴 Level 3(4개+ 「높은 근거」)만 없다.
⟹ 🟢 **§9 STOP(UI 계약 변경)은 발생하지 않았다.**
```

### 🔴🔴🔴 그런데 **집계기가 «둘» 이고 Level 이 둘 다 2 에 못 닿는다**

```
① buildPriceGuide        ← **SAME tier 만** 센다(밴드 문구의 주인)
② domesticReference      ← `priceTier` 가 **EXACT | COMPARISON**(= PRESUMED_SAME 포함 · :318)
```

| 상품 | ① SAME-only | ① Level | ② domRef | ② Level | 🔴 오염 |
|---|---:|---|---:|---|---:|
| B226AC009 | 0 | Level 0 | **1** (88,000) | Level 1 | 0 |
| B226AC010 | 1 (83,600) | Level 1 | 1 (83,600) | Level 1 | 0 |
| B226AC117 | 0 | Level 0 | 0 | Level 0 | 0 |
| | **Level 2 = 0/3** | | **Level 2 = 0/3** | | **합 0** |

🟢🟢 **DIFFERENT 오염 = 0** — `kream`(human DIFFERENT · KRW 65,000)이 CONFLICT 로 정확히 빠졌다.
🟢 Precision 우선 원칙이 지켜졌다 — threshold 완화 **0** · 유사상품 혼입 **0**.

### 🔴🔴 Level 2 를 막는 것이 **제품 사실이 아니라 하니스 한계** 일 수 있다

```
B226AC009 의 human SAME 국내 후보 4건 중 ②에 들어간 것은 **1** 이고, 빠진 셋의 이유가 갈린다:
  beaumonde.co.kr   SIMILAR/EXCLUDED  🟢 **정확한 배제** — 그 URL 은 **AC010 상품** 이다
  m.luxboy.com      KRW 59,000 · 🔴 market **UNKNOWN**(KRW_WITHOUT_DOMAIN_EVIDENCE)
  donokids.com      KRW 88,000 · 🔴 market **UNKNOWN**(같은 사유)
🔴🔴 그 둘은 `.com` 이고, `classifyCandidateMarket` 의 **등록부 분기가 하니스에서 발화하지
   않는다**(service-role 키 없음 · SAME-03 에서 이미 기록). ⟹ **운영에서는 KR 일 수 있다.**
🟡 그렇다면 AC009 의 ② 는 **88,000 / 59,000 / 88,000 = 3건 ⟹ Level 2** 가 된다.
🔴🔴 **그러나 「Level 2 달성」으로 적지 않는다 — 측정불가** 다(§9 규칙).
⟹ 🔴 **이것이 지금 이 트랙에서 가치가 가장 큰 단일 미지수** 다.
```

### 🔴 이번에 측정하지 «않은» 것 — 숨기지 않는다

```
🔴 해외 최저 소싱가 · 판매판단 · 권장 판매가격의 **재측정은 하지 않았다.**
   사유 — ⒜ §6 이 「새 가격 계산 0」이고 그 축은 **이미 CLOSED** 다(§6 기준선
   착지원가 ₩230,721 · A ₩295,796 · B ₩258,000) ⒝ `computeMarketIntelligence` 가
   `fetchLiveExchangeRates()` 를 요구해 이 하니스에서 전 구간을 돌릴 수 없다(WU-021 기록).
🔴 그래서 §12 의 「국내 가격 형성대 + 해외 최저 소싱가 → 판매판단」 **전 구간 E2E 는 미완결** 이다.
🔴 상품 수도 **3** 이고 §7 이 요구한 **5** 가 아니다(원상품 추출이 되는 국내 GT 보유 상품이 3).
```

### 🔴🔴 상세설명(§3) — **연결돼 있지 않고, 연결은 금지축이다**

```
🔴 `ProductFacts` 에 **description 칸이 없다**(SAME-04 가 전수 확인) ⟹ 어느 축에도 안 들어간다.
🔴 그리고 §10 STEP 5 ②가 「상세설명 직접 연결 **금지** — 정답 SAME 악화가 **서로 다른 분모에서
   2회 재현**」으로 닫아 뒀고, §11 금지 목록에도 「description 재연결」이 있다.
🟡 §3 의 「상세설명 기반 **후보 탐색**」은 **discovery** 이고 **SAME 축 추가와 다른 일** 이다 —
   🔴 그 구분을 CPO 가 확정해 주지 않으면 CTO 가 열지 않는다.
```

### 🟢 재사용 하니스

```
core-mi-price-01-band  2   ①↔② 집계기 나란히 · CPO Level 매핑 · **DIFFERENT 오염 단언**
                           🔴 `CORE_MI_PRICE_01_LIVE=1`
기존(재사용) WU_172_PROBE=1 (상품 3종 퍼널) · WU_F3_PROBE=1 (자동 공급 0 확인)
```

---

## 9-F. 🟢🟢 **CORE-MI-PRICE-02 — Level 2 달성(실데이터) · STEP 5·6 미완결**(운영 변경 0)

> 🔴 matcher 0 · threshold 0 · P1/P2 적용 0 · description axis 0 · 새 가격 산식 0 · UI 0.
> 🟢 **CPO 정책 확정 반영** — 가격 형성대의 기준은 **`domesticReference`**(`EXACT|COMPARISON`)다.

### 🟢🟢🟢 STEP 1 — **CASE B 확정** · 등록부 접근이 «필요하지 않았다»

```
🔴🔴 1차 측정(MI-PRICE-01)이 운영 입력을 빠뜨렸다 — `classifyCandidateMarket` 의
   CORE-2R-4 분기는 `marketEvidence` 를 보는데(`candidate-market.ts:104`),
   그 값은 **`factsFromProductUrl` 가 이미 돌려준다**(`product-url-facts.ts:510`) ·
   운영도 그대로 넘긴다(`run-domestic-price-check.ts:1795`).
   ⟹ 그 칸을 안 넘겨서 「UNKNOWN」이 나왔다. 🟢 넘기자 결과가 바뀌었다.

m.luxboy.com   KRW 59,000  🟢 **KR** — basis **KR_SELLER_EVIDENCE_AND_KRW**
                           ⟹ 🔴 **등록부가 아니라 «그 페이지가 스스로 적은 증거» 다**
donokids.com   KRW 88,000  🔴 **UNKNOWN** — basis `KRW_WITHOUT_DOMAIN_EVIDENCE`
                           ⟹ 그 페이지의 강한 KR 신호가 2개 미만 · 🔴 등록부 분기는 **측정불가**
🔴 mock 으로 KR 을 만들지 않았다 · 코드 변경 0 · service-role 0.
```

### 🟢🟢 STEP 2·3·4 — **Level 0/1/2 가 실데이터에서 전부 성립한다**

| 상품 | ② domesticReference | Level | 가격 형성대 | 🔴 오염 |
|---|---:|---|---|---:|
| **B226AC009** | **2** | 🟢🟢 **Level 2** | **KRW 59,000 ~ 88,000** | 0 |
| B226AC010 | 1 | Level 1 — 제한된 근거 | 83,600 (가격대 확정 불가) | 0 |
| B226AC117 | 0 | Level 0 — 국내 참고가격 없음(정상) | 없음 | 0 |

```
AC009 의 2건 = `biskuit.kr` 88,000(KR_TLD_AND_KRW) + `m.luxboy.com` 59,000(KR_SELLER_EVIDENCE)
🟢 둘 다 tier **COMPARISON**(PRESUMED_SAME) ⟹ CPO 가 확정한 기준에서 **정당한 입력** 이다
🟢🟢 **DIFFERENT 오염 = 0** — `kream`(human DIFFERENT · 65,000)이 CONFLICT 로 정확히 빠졌다
🟢 `SIMILAR`·`CONFLICT`·`EXCLUDED`·`UNREACHABLE` 이 가격 축에 **하나도** 들어가지 않았다
🔴 ① SAME-only 집계기로는 Level 2 가 **0/3** 이다 ⟹ CPO 의 ② 선택이 **측정으로 뒷받침된다**
```

### 🟡 STEP 5·6 — **해외 최저 소싱가 → 판매판단 → 권장가 E2E 는 미완결**

```
🔴 이번 세션에서 **돌리지 못했다.** 사유를 그대로 적는다 —
   `computeMarketIntelligence` 가 `fetchLiveExchangeRates()` + 스냅샷 + 셀러 설정을
   요구한다(WU-021 이 같은 자리를 기록했다) ⟹ 하니스에서 전 구간이 서지 않는다.
🟢 재사용 가능한 기준선은 있다 — §6(착지원가 ₩230,721 · A ₩295,796 · B ₩258,000) ·
   AC009 해외가 실측(WU-136: GBP 37 · USD 58 · 판매중 3곳).
⟹ 🔴 §9 시나리오 **D 만 남았다**(A·B·C 는 위에서 PASS).
```

### 🔴 상세설명 — **CPO 전략대로 축을 추가하지 않았다**

```
🟢 description → 새 SAME axis **0** · threshold **0** · 금지축 재개방 **0**.
🟢 이미 추출되는 brand/model code/product name/color/material/category 는
   **기존 계약 안에서 그대로** 쓰인다(새 전달 경로 0).
```

### 🟢 재사용 하니스

```
core-mi-price-01-band  2   ①↔② 집계기 · CPO Level · market basis · **DIFFERENT 오염 단언**
                           🔴 `CORE_MI_PRICE_01_LIVE=1`
🟢 `marketEvidence` 를 운영과 같이 넘긴다 — 다음 세션이 이 입력을 **다시 빠뜨리지 않게** 주석에 박았다
```

---

## 9-G. 🔴🔴 **CORE-MI-PRICE-03 — STOP: 기존 snapshot 입력 경로 실행 불가**(운영 변경 0)

> 🟢 CPO 가 ⒝(CTO 단독 E2E)를 승인했다. 🔴 **실행할 수 없다** — 추론이 아니라 **실행해서**
> 확인했고, 그 사실을 계약으로 고정했다(`core-mi-price-03-e2e-blocker` 3건 · 네트워크 0).

### 🔴🔴🔴 차단 지점은 «하나» 이고 좌표가 확정됐다

```
computeMarketIntelligence(snapshotId, workspaceId)     market-intelligence.ts:105
  :110  const snapshot = await getSnapshot(snapshotId, workspaceId)
  :111  if (!snapshot) return null                     ← 🔴 **여기서 끝난다**
getSnapshot → snapshots/_lib/snapshot.ts → getSupabaseAdmin()
getSupabaseAdmin  lib/supabase-admin.ts:12  `if (!url || !serviceRoleKey) return null`
⟹ 🔴 `SUPABASE_SERVICE_ROLE_KEY` 가 **로컬 어디에도 없다**(.env 전수:
   `.env.local` · `apps/admin/.env.local` · `packages/database/.env` · `scripts/.env`)
🟢 실측 — `computeMarketIntelligence(dummy, dummy)` → **null**(DB 에 닿지도 않는다)
```

### 🔴 그래서 «하지 않은» 것 셋 — 전부 CPO 금지에 걸린다

```
❌ snapshot / seller 설정을 **mock** 으로 만든다            §2 「임의 값 생성 금지」
❌ `computeMarketIntelligence` 를 **주입받게** 고친다        §1 「운영 코드 변경 금지」
❌ DB 를 직접 읽어 downstream 을 **복제 실행** 한다
   🔴 그 함수는 DB 를 **자기가** 읽는다 ⟹ 주입 지점이 없고, 복제식은 대조할
      **운영 산출값(CONTROL)이 없다**(§5-B) ⟹ 「운영 결과 흉내」가 된다
🔴 그리고 `pg` 모듈이 설치돼 있지도 않다(실측 MODULE_NOT_FOUND).
```

### 🟢🟢 이미 닫힌 것 — **국내 축은 CLOSED 다**(다시 재지 않는다)

```
B226AC009  domesticReference **2** · 🟢 **Level 2** · **KRW 59,000 ~ 88,000** · 오염 0
B226AC010  1 · Level 1(가격대 확정 불가)      B226AC117  0 · Level 0(정상)
🟢 §13 시나리오 **A·B·C PASS** · DIFFERENT 오염 **0** · SIMILAR/CONFLICT/EXCLUDED 유입 **0**
```

### 🔴 미완결 — **셋 다 DB 경로 «뒤» 에 있다**

```
해외 최저 소싱가 · sellability · A 권장 판매가격
⟹ 🔴 전부 `getSnapshot` 뒤이고 service-role 없이는 **도달 자체가 불가** 다.
🔴 「해외 가격을 못 읽는다」가 아니다 — **그 앞 문이 안 열린다.** 두 문장을 섞지 않는다.
```

### 🔵 해제 조건 — **하나**

```
`SUPABASE_SERVICE_ROLE_KEY`(🟢 **읽기 권한이면 충분** 하다 — 이 E2E 는 쓰기 0)
🟢 키가 생기면 `core-mi-price-03-e2e-blocker` 의 첫 단언이 **FAIL 로 뒤집힌다** —
   그것이 「지금 착수 가능」이라는 신호다(쿠팡 고시 선례와 같은 모양).
🟡 대안(CPO 결정) — 운영 `/check` 응답 1건을 받는다(CEO 화면 1회 · §12 의 ⒜ 경로)
```

---

## 9-H. 🟢🟢 **CORE-SAME-07 — 판정 기준 v1.0 조사 완료**(구현 0 · 운영 변경 0)

> 🔴 새 축 **0** · matcher **0** · threshold **0** · verdict 체계 **0**.
> 🟢 CPO 의 **10축**과 **A/B 2단계** 가 코드에 이미 있는지를 **소스에서 전수 대조** 했다.

### 🟢🟢 CPO 10축 — **9/10 이 이미 코드에 있다**

| | 축 | 단계 | 코드 실체 |
|---|---|---|---|
| ① | 브랜드 | A | 🟢 `brandKnown`·`brandOk`·BRAND_MISMATCH/UNCONFIRMED · 🔴 **축이 아니라 게이트** |
| ② | 모델코드 | A | 🟢 `compareModelCode` · 🔴 conflict 면 **조기 종료**(CPO 요구와 충돌) |
| ③ | 상품명 | A | 🟢 `coreTitleTokens`·NO_TITLE_OVERLAP |
| ④ | **상세설명** | — | 🔴🔴 **코드에 없다**(`ProductFacts` 에 칸 자체가 없다) |
| ⑤ | 상품 형태 | A | 🟢 GARMENT_FORM blocker **+** CATEGORY conflict(parkette 가 그 사례) |
| ⑥ | 색상 | BOTH | 🟢 `compareColor` + COLOR_VARIANT · 🟡 variant 가 **보류** 로만 있다 |
| ⑦ | 소재 | A | 🟢 축 + 보류 |
| ⑧ | 옵션/SKU | BOTH | 🔴🔴 **`sellerSku` 가 matcher 에 «아예 없다»** — variant 구분이 **사이즈뿐** |
| ⑨ | **세트/단품** | A | 🟢 `compareComposition` **이미 있다** · 🔴🔴 **A 의 conflict 로 들어간다** |
| ⑩ | 이미지 | A | 🟡 축은 있는데 호출부가 증거를 **넘기지 않는다** |

### 🔴🔴🔴 **A/B 혼입 — 이 WU 의 핵심 발견**

```
compareComposition  정의 cross-seller.ts:457 · 호출 :890 → **conflicts.push**
conflicts.length > 0 → **조기 반환 CONFLICT**(axes: []) :898
⟹ 🔴 「세트라서 **가격을 비교할 수 없다**」가 「**다른 상품이다**」와 **같은 출력** 이 된다.
🔴 실측 대조 — CEO 는 `bornyesterdaykids`(상/하의 세트)를 「상의는 동일하지만 가격
   비교에 부적합 ⟹ **판단불가**」로 봤고, 시스템은 **DIFFERENT** 로 처리한다.
⟹ 🟢 **CPO 가 요구한 A/B 분리는 「새 기능」이 아니라 «이 지점을 가르는 일» 이다.**
🔴 CTO 가 가르지 않았다 — verdict 체계 변경이고 **제품 정책** 이다.
```

### 🔴🔴 CPO 요구 ②(「품번 불일치 ≠ 자동 DIFFERENT」)는 **교환이다 — 측정됐다**

```
GT 33쌍 · 품번 «불일치»(conflict) **4건** × human 라벨:
   🟡 human SAME **3**       ← 열리는 것(품번이 달라도 사람은 같다고 봤다)
   🔴 human DIFFERENT **1**  ← 뚫릴 위험(품번 보호가 지금 막고 있는 것)
⟹ 🔴 **둘이 같은 분모 안에 있다.** 「불일치 ≠ 자동 DIFFERENT」는 **3 을 열고 1 을 여는** 교환이다.
🔴 그리고 그 정책은 §11 금지(「MODEL_CODE 정책」·품번 충돌 보호)와 **정면으로 만난다** ⟹ CPO 결정.
```

### 🟢 현재 선별 성능(CPO 성공 기준으로 다시 읽은 값)

```
SAME 회수 **5/17** · 🔴 DIFFERENT 누출 **2/10**(알려진 False EXACT C06·S1-6)
🔴 CPO 기준은 「SAME 몇 건」이 아니라 **누출 0 + 과잉 폐기 최소** 다 —
   지금은 **회수가 낮고 누출이 2** 다. 둘 다 숫자로 고정돼 있다.
```

### 🟢 다중 후보 3-way GT — **화면은 이미 있다. 부족한 것은 후보 공급이다**

```
🟢 재사용 — `core-same03-domestic-review-build`(`CORE_SAME03_LIVE=1`)
   3택(동일/다른제품/판단불가) + 사유 + JSON export + 원상품별 섹션 + 측정불가 표시 **전부 있다**
🔴 현재 국내 후보는 **상품당 2~4건** 이고 CPO 가 요구한 **5~10건** 에 못 미친다
⟹ 🔴 그 공급 확대는 §7 ABSOLUTE FREEZE(discovery) 밖이라 **CPO 범위 결정** 이다
🔴 그리고 카테고리 확장(상의/하의/신발/가방…)은 **원상품 자체가 없다** —
   현재 GT 는 전부 **Bobo Choses 아동 상의** 계열이다(카테고리 공통성 **미측정**)
```

### 🟢 재사용 하니스

```
core-same07-criteria-survey  5(네트워크 0 · CI 상주)
  10축 ↔ 코드 owner 전수(**소스 단언**) · A/B 혼입 좌표 · 품번 불일치 교환 분모 ·
  현재 선별 성능 · 3-way 화면 재사용 가능성
```

🔴 **내 표가 틀렸고 단언이 잡았다** — ⑧ 축 owner 에 `sellerSku` 를 적었는데 `cross-seller.ts`
에 **그 문자열이 아예 없었다**. 🟢 「판정에 쓰지 않는다」보다 **강한 사실** 이고(matcher 가
판매처 SKU 를 **한 번도 보지 않는다**) 그것을 계약으로 잠갔다.

---

## 9-I. 🟡 **CORE-SAME-08 — 착수 대기**(CPO ⒜ 확정 2026-10-26 · 코드 0)

> 🔵🔵 **CPO 가 ⒜(원상품 URL 공급)로 확정했다.** 🔴 **CTO 가 지금 코드를 만들지 않는다**
> (CPO 명시: 「지금은 CTO 에게 추가 코딩을 시키기보다 CEO 가 원상품을 공급하는 게 맞는 단계」).
> 🔴 ⒞(상의 1종으로 강행)는 **CPO 가 명시적으로 배제** 했다.

### 🟡🟡 **받아야 하는 것 — 해외 원상품 URL «3개»**

```
하의 1개 · 원피스 1개 · 가방 1개    🟢 **동시에 줄 필요 없다**(CPO 명시 · 하나씩도 된다)
🟢 기존 상의 5 · 신발 1 · 액세서리 1 과 합쳐 **카테고리 편차** 를 만든다
```

### 🔴 **URL 선택 기준 넷 — 이 트랙의 실패에서 나온 것이다**

```
① 🔴🔴 **국내에서 실제로 유통되는 브랜드** 를 고른다 — 이것이 가장 중요하다.
   실측 근거: 신발(`Pèpè Shoes`)·액세서리(Swim Cap)는 **원상품이 있는데 국내 후보가 0** 이었다.
   국내 후보가 0 이면 A/B 판정을 **할 것이 없다** ⟹ 그 카테고리가 측정에서 빠진다.
② 🟢 **Shopify 스토어면 가장 안전하다**(`/products/...`) — 원상품 추출이 빠른 경로를 탄다.
   🔴 아니면 Playwright 경로라 느리거나 실패할 수 있다(WU-090 실측).
③ 🟢 **품번이 상품 페이지에 적혀 있으면 좋다** — MODEL_CODE 축이 가장 강한 증거다.
   🔴 단 없어도 된다(`cissywears`·`kids21` 처럼 품번 없이 CEO 가 동일이라 한 사례가 있다).
④ 🔴 **상품 상세 URL** 이어야 한다 — 목록·브랜드·컬렉션 URL 은 입구에서 차단된다
   (`classifyUrlShape` · 실측 탈락 사례 다수).
```

### 🔵 **받는 즉시 할 일 — 조사 없이 이 순서로 간다**

```
① 원상품 추출(기존 경로 · brand 복구 포함)  ② 국내 후보 수집  ③ 운영 판정 전수
④ A/B + 증거 13칸을 화면에 추가  ⑤ CEO 3-way × 2축 판정  ⑥ 경계 사례 7종 충족 확인
🟢 ①②③ 은 **기존 하니스 그대로** · ④ 는 `core-same03-domestic-review-build` **확장** 이다
🔴 새 UI·새 matcher·새 fixture **0**
```

### 🔴🔴 CPO 가 요구한 **경계 사례 7종** — 의도적으로 확보한다

```
① 제목만으로 동일            ② 브랜드만으로 동일        ③ 모델코드로 동일
④ 상세설명이 동일성을 보강     ⑤ 상품 형태가 달라 DIFFERENT
⑥ 세트라 A/B 가 갈린다        ⑦ 정보 부족으로 판단불가
🔴 7종이 **다 채워지지 않으면** 「공통 기준 확정」으로 적지 않는다 — 분모를 적고 남긴다
🟢 현재 이미 가진 사례 — ③(biskuit) · ⑤(parkette) · ⑥(bornyesterdaykids) · ⑦(읽기 실패 3)
🔴 비어 있는 것 — ①②④ 는 **상의 외 카테고리에서** 나와야 공통성이 증명된다
```

---

## 9-I-b. 🔴 착수 조건 불성립의 근거(조사 완료 · 재조사 금지)

> 🔴 §4-C 용량 판단을 **착수 «전»** 에 했다. CPO 가 요구한 「다중 카테고리 × 후보 5~10개」가
> **현재 데이터로 성립하지 않는다** — 하니스를 만들어 중간에 끊지 않고 **조사 결과로 닫는다**.

### 🟢 CPO 결정 반영(코드 변경 0)

```
세트 감지 로직        🟢 유지(건드리지 않았다)
A/B 구조 분리         🟢 설계 GO · 🔴 **판정 정책은 HOLD** ⟹ verdict 변경 **0**
세트 자동 SAME 승격    🔴 HOLD — 하지 않았다
품번 불일치 완화       🔴 **NO-GO** — `compareModelCode` 보호 **그대로**(측정된 교환 SAME 3 ↔ DIFF 1)
sellerSku            🟢 matcher 기준에서 제외 — 🔴 애초에 **참조되지 않는다**(SAME-07 실측)
```

### 🔴🔴🔴 착수 조건 — **원상품 가용성 전수**(fixture 실측)

| 원상품 | 품번 | 브랜드 | 카테고리 | 후보 | 🇰🇷 국내 후보 |
|---|---|---|---|---:|---:|
| S1 | B226AC010 | Bobo Choses | 상의 | 8 | **1** |
| S2 | B226AC009 | Bobo Choses | 상의 | 6 | **1** |
| S3 | B126AI018 | Bobo Choses | 액세서리(수영모) | 4 | 🔴 **0** |
| S4 | AW26MS185 | **Main Story** | 상의 | 6 | **1** |
| S5 | 01195-VERNICE-NERO | **Pèpè Shoes** | **신발** | 1 | 🔴 **0** |
| S6 | (품번없음) | Bobo Choses | 상의/아웃터 | 8 | **3** |
| SM430632 | — | Bobo Choses | 상의 | — | — |

```
🟢 브랜드는 **3종** 이다(Bobo Choses · Main Story · Pèpè Shoes) — 하나에 고정돼 있지 않다
🟢 카테고리 원상품 — 상의 **5** · 신발 **1** · 액세서리 **1**
🔴🔴 **하의 0 · 원피스 0 · 가방 0** ⟹ CPO 요구 5개 카테고리 중 **2~3개가 아예 없다**
🔴🔴 그리고 **신발·액세서리는 원상품이 있는데 국내 후보가 0** 이다
   ⟹ 카테고리 공통성을 **그 두 카테고리에서도 측정할 수 없다**
🔴 국내 후보 최대 **3**(S6) — CPO 요구 **5~10** 에 전 상품이 미달
```

### 🔴 그래서 **STOP 이 맞다** — 지금 GT 를 받으면 무엇이 틀리는가

```
🔴 상의(Bobo Choses)만으로 A/B 기준을 세우면 그것은 **「공통 기준」이 아니다** —
   CPO 가 §3 에서 지목한 그 함정(「GT 가 전부 Bobo Choses 아동 상의」)을 그대로 반복한다.
🔴 그리고 A/B 를 분리한 **뒤** 에 GT 를 받아야 한다 — 지금 받으면 같은 후보를
   **두 번** 판정하게 된다(선택지 의미가 달라지므로).
```

### 🔵 착수 가능해지는 조건 — **공급 하나**(CTO 범위 밖)

```
① 하의 · 원피스 · 가방 **원상품 URL**(각 1개 이상) — 🔴 CPO/CEO 가 지정
② 신발 · 액세서리의 **국내 후보** — 🔴 discovery 범위(§7 ABSOLUTE FREEZE 밖)
③ 상품당 국내 후보 **5~10** — 같은 공급 문제
🟢 셋이 열리면 **화면·하니스는 이미 있다** —
   `core-same03-domestic-review-build`(3택+사유+export) 에 **B 축(가격비교 3택)과
   증거 13칸 기록** 을 더하면 끝이다(새 인프라 0 · 그 설계는 아래에 적어 뒀다).
```

### 🟢 다음 세션이 **조사 없이** 쓸 A/B GT 스키마(설계 확정 · 구현 0)

```
A 상품 동일성     동일 · 다른상품 · 판단불가
B 가격비교 가능성   가격비교 가능 · 가격비교 불가 · 판단불가
증거 13칸(제공 여부) TITLE · BRAND · MODEL_CODE · DESCRIPTION_BRAND ·
                   DESCRIPTION_MODEL_CODE · DESCRIPTION_MODEL_NAME · GARMENT_FORM ·
                   COLOR · MATERIAL · FIT · COMPOSITION · OPTION_SKU · IMAGE
🔴 「판단불가」를 DIFFERENT 로 변환하지 않는다 · 🔴 A=SAME 을 자동으로 B=가능으로 두지 않는다
```

---

## 9-J. 🟢🟢 **CORE-SAME-SPRINT-01 — Universal Identity & Comparability**(STEP 1~6 완료 · 구현 0)

> 🔴 운영 변경 **0** · matcher **0** · verdict **0** · threshold **0** · 새 GT **0**.
> 🟢 STEP 1~5 는 이 세션의 SAME-04/07/08 이 이미 측정했고, **STEP 6 Matrix 를 GT 로 채웠다**.

### 🔴🔴🔴 **STEP 6 — Universal Decision Matrix**(GT 33쌍 실측 · 추측 0)

| 증거 조합 | 분모 | human S/D/U | 현재 sys SAME | tier자격 | 판정 |
|---|---:|---|---:|---:|---|
| **Brand + Code 일치** | **2** | **0 / 2 / 0** | 0 | 2 | 🟢 막는다 — 🔴🔴 **전부 DIFFERENT** |
| **Brand + 제품명(코드 없음)** | **12** | **9 / 3 / 0** | **7** | 9 | 🔴 **누출 있음** |
| Title 약함 + Description 강함 | — | **측정불가** | — | — | 🔴 description 칸이 **없다** |
| Code conflict(전체) | 4 | 3 / 1 / 0 | 0 | 0 | 🟢 막는다(교환 3↔1) |
| Code conflict + 제목 겹침 | **0** | 측정불가 | — | — | 🔴 분모 0 |
| Form conflict(GARMENT_FORM) | **0** | 측정불가 | — | — | 🔴 분모 0 |
| Composition conflict(세트) | **0** | 측정불가 | — | — | 🔴 분모 0 |
| Color variant | 2 | 0 / 2 / 0 | 0 | 2 | 🟢 막는다 |
| Color conflict | 1 | 0 / 1 / 0 | 0 | 0 | 🟢 막는다 |
| Image only | — | **측정불가** | — | — | 🔴 증거 **미공급** |
| BRAND_UNCONFIRMED | 14 | 5 / 4 / 5 | 0 | 7 | 🟢 막는다 |
| NO_TITLE_OVERLAP | 7 | 0 / 1 / 6 | 0 | 0 | 🟢 막는다 |
| 같은 판매처 다른 리스팅 | 2 | 0 / 2 / 0 | 0 | 2 | 🟢 막는다 |

🔴 `tier자격` 은 **`priceTier` 만** 본 값이다 — 실제 국내 적재는 `market=KR` **+ KRW** 가 더 필요하다
(🔴 1차에 「가격축 진입」으로 적었고 그러면 「DIFFERENT 가 가격에 들어간다」로 **오독** 된다 ⟹ 라벨을 좁혔다).

### 🔴🔴🔴 **CPO 전제 하나가 이 GT 에서 뒤집혔다**

```
CPO §1  「브랜드 + 모델코드 ⟹ 거의 즉시 SAME 후보」
실측    그 조합 **2건이 전부 human DIFFERENT** 다(`C19`·`C20` junioredition **품번 재사용**)
        반대로 실제 주력은 **「브랜드 + 제품명(코드 없음)」 12건** 이고 human 9/3 이다
⟹ 🔴 **최강 증거가 최강이 아니었다** — 품번을 재사용하는 판매처가 실재한다.
🔴 **일반화하지 않는다** — 분모 2 이고 **한 판매처(junioredition)** 다. 🟢 그러나 그것이
   CPO 의 계층 우선순위(MODEL_CODE > BRAND > NAME)를 **이 분모에서 반증** 한다.
🟢 그리고 「누출 2」가 **그 12건 안에** 있다(C06 · S1-6) ⟹ 개선의 실제 자리는 **거기** 다.
```

### 🔴 A/B 분리(STEP 3) — **설계 GO · 수치는 측정불가**

```
🟢 좌표 확정 — `compareComposition` 정의 cross-seller.ts:457 · 호출 :890 → conflicts.push
   → `conflicts.length > 0` → **조기 반환 CONFLICT**(axes: []) :898
🔴 효과 수치는 **측정불가** — 이 GT 에 `COMPOSITION` 발화가 **0** 이다.
   CEO 가 세트로 판정한 `bornyesterdaykids` 는 **다른 풀**(core-2m·wu-112)이고
   그 풀엔 **저장 facts 가 없다** ⟹ 네트워크-0 분모에서 잴 수 없다.
```

### 🟡 공통 ↔ 카테고리 의존(STEP 5) — **설계 가설 · 측정불가**

```
🟢 공통      BRAND(게이트) · MODEL_CODE · TITLE · CATEGORY/GARMENT_FORM · COMPOSITION · IMAGE
🟡 카테고리 의존 COLOR · MATERIAL · FIT · SIZE/SIZE_SYSTEM · AUDIENCE/AUDIENCE_LINE
🔴🔴 **검증 불가** — 원상품이 상의 5 · 신발 1 · 액세서리 1 이고 **신발·액세서리는 국내 후보 0**
⟹ 🔴 「측정됐다」로 적지 않는다. 이것은 **가설** 이다.
```

### 🔴🔴 **J. CPO 정책 결정 4건**(CTO 가 하나도 열지 않았다)

```
① A/B 분리 구현 범위   🟡 설계 GO · 🔴 verdict 체계 변경이라 **범위를 CPO 가 명시** 해야 한다
                      (COMPOSITION 을 conflicts 에서 빼는 것 = verdict 변경)
② 품번 계층 재설계      🔴 CPO 전제가 반증됐다 ⟹ 「MODEL_CODE 최우선」을 유지할지 재확인 필요
                      🟢 단 **완화는 여전히 NO-GO**(교환 3↔1 · CPO 이미 확정)
③ 개선 우선순위 전환    🔴 실제 누출은 **「브랜드+제품명」 12건** 에 있다 ⟹ 그쪽이 1순위인가
④ description 공급     🟡 Evidence Layer 로만 쓴다는 설계는 GO · 🔴 **ProductFacts 칸 추가** 가
                      선행이고 그것은 계약 변경이다 ⟹ 범위 승인 필요
```

### 🟡 남은 **입력 2개**(CTO 범위 밖)

```
① 원상품 URL 3개(하의·원피스·가방) — §9-I 의 선택 기준 4 그대로
② `SUPABASE_SERVICE_ROLE_KEY`(읽기) — 판매판단 E2E 차단 해제(§9-G)
🟢 둘은 **독립** 이다 — 하나만 와도 그 축은 진행된다
```

### 🟢 재사용 하니스

```
core-sprint01-decision-matrix  3(네트워크 0 · CI 상주) — Matrix 측정 · A/B 반사실 · 공통/의존 분류
core-same07-criteria-survey    5  10축 ↔ 코드 전수 · A/B 혼입 좌표 · 품번 교환 분모
core-same05-gt(모듈) + baseline 5 + counterfactual 7   GT 33쌍 · 발화 확인 · leakage
core-same06-safety-gt-search   4  라벨 전수(행 102 · 고유 70) · 발화 × 라벨 교차표
```

---

## 9-K. 🟢🟢🟢 **CORE-SAME-SPRINT-02 STEP 1~3 — 분리축을 찾았다**(구현 0)

> 🔴 운영 변경 **0** · matcher **0** · threshold **0** · 새 GT **0** · 네트워크 **0**.
> 🟡 STEP 4~6(전체 GT 반사실 · 5행 표)은 **다음 세션** 이다 — 🟢 준비는 끝났다(아래).

### 🟢 STEP 1~2 — CPO 가 지목한 12건 재현 + 전수 증거

```
집합 술어 — `code unavailable` + TITLE 축 있음 + BRAND 보류 없음 ⟹ **12건 재현**
human SAME **9** · DIFFERENT **3** · 누출 **2**(C06 · S1-6 · 둘 다 truth STRONG_IDENTIFIER · tier EXACT)
```

### 🔴🔴 STEP 3-a — **기존 증거 어휘로는 가를 수 없다**(먼저 적는다)

```
DIFFERENT 에만 있는 신호 2 — 축:MODEL_CODE · 보류:COLOR_VARIANT
SAME 에만 있는 신호     2 — 보류:FIT · 값:fit
🔵 **완전 분리축**(DIFFERENT 전건 보유 ∧ SAME 전건 미보유) = **0**
⟹ 🔴 「SAME 9 유지 + DIFFERENT 3 차단」은 **지금 있는 신호의 조합으로는 불가능** 하다.
🔴 threshold·NO_TITLE_OVERLAP 완화로는 DIFFERENT 가 같이 열린다(WU-093 선례).
```

### 🟢🟢🟢 STEP 3-b — **그런데 전수 출력이 분리축을 드러냈다**

```
🔴 SAME-04 는 「`ProductFacts` 에 description 칸이 없다」로 닫았다. **그 말은 맞다** —
   🟢 **그런데 설명문 전문이 `materialText` 로 «이미» 흘러들어오고 있다**(전수 출력 실측).
🔴🔴 그리고 그 안에 **품번이 적혀 있다**:
   C05  후보 소재 「Tinyapple | FW26 Bobo Choses | Hug Hairy Monster … **B226AC009**」
        ⟹ 원상품 `B226AC009` **일치**      human **SAME** 🟢
   S1-6 후보 소재 「Tinyapple | FW26 Bobo Choses | Booty Ghosts … **REF: B226AC141**」
        ⟹ 원상품 `B226AC010` **불일치**    human **DIFFERENT** 🔴
⟹ 🟢🟢 **같은 샵(tinyapple)·같은 sys verdict(SAME) 두 건이 그 품번으로 갈린다.**
```

**반사실 측정(12건 · `facts` 변경 0)**

| | 결과 |
|---|---:|
| 🟢 DIFFERENT 를 **차단할 근거가 생긴 건** | **1** (`S1-6`) |
| 🟢 SAME 에 **근거가 보강된 건** | **1** (`C05`) |
| 🔴 후보 설명에 품번이 없어 **변화 0** | **10** |

```
🟢🟢 **그리고 SAME 9 중 하나도 깨지지 않는다** — 불일치가 난 것은 DIFFERENT 쪽 1건뿐이다.
🔴 전건을 가르지는 **못한다** — `C06`(global.trenbe)은 후보 설명이 **비어 있다** ⟹ **측정불가**.
   `C25`(main-story)는 품번이 없지만 **이미 `COLOR_VARIANT` 로 차단** 돼 있다(PRESUMED_SAME).
⟹ 🟡 누출 2 중 **1 을 막을 근거** 가 생겼고, 나머지 1 은 **다른 증거** 가 필요하다.
```

### 🔵 왜 이것이 CPO 설계와 정확히 맞는가

```
🟢 **새 SAME 축이 아니다** — 기존 `MODEL_CODE` 축에 **증거를 공급** 하는 것이다.
🟢 CPO ④ 「description → model code 복원 · Evidence Layer」와 **글자 그대로 일치** 한다.
🟢 금지축을 하나도 열지 않는다 — threshold 0 · NO_TITLE_OVERLAP 0 ·
   품번 **충돌 보호 유지**(오히려 **강화** 하는 방향이다 · 불일치를 새로 발견한다).
🔴 단 **운영에 넣지 않았다** — 전체 GT 반사실(STEP 5)과 FP 영향 측정이 선행이다.
```

### 🟢🟢🟢 STEP 4~5 — **5행 표 완성**(GT 33쌍 · 운영 반영 0)

| 개선안 | 발화 | SAME 회수 | 🔴 누출 | UND(sysSAME) | 기존FP | 생산적용 |
|---|---:|---:|---:|---:|---:|---|
| Baseline | 0 | 5/17 | **2**/10 | 6(0) | 2 | — |
| **Description→MODEL_CODE** | **3** | **5/17** | **1**/10 | 6(0) | **2→1** | 🟢 **안전**(누출 **-1** · SAME ±0) |
| Form/category | — | 측정불가 | — | — | — | 🔴 이 GT 에 `GARMENT_FORM` 발화 **0** |
| 기존 evidence 조합 | 1 | 5/17 | 2/10 | 6(0) | 2→2 | 🟢 안전(누출 ±0 · SAME ±0) |
| **Integrated** | **4** | **5/17** | **1**/10 | 6(0) | **2→1** | 🟢 **안전**(누출 **-1** · SAME ±0) |

**발화 3건 — 전부 같은 샵(`tinyapple`)이다**

```
C50  human DIFFERENT  복원 B126AC151 ↔ 원상품 B226AC117 ⟹ conflict · sys **CONFLICT** 🟢 차단 강화
C05  human SAME       복원 B226AC009 ↔ 원상품 B226AC009 ⟹ exact    · sys **SAME**     🟢 근거 보강
S1-6 human DIFFERENT  복원 B226AC141 ↔ 원상품 B226AC010 ⟹ conflict · sys **CONFLICT** 🟢🟢 **FP → TN**
```

🟢🟢 **TN 8 → 9** — DIFFERENT 보호가 **강화** 됐다(완화가 아니다).
🔴 **남은 누출 1 = `C06`**(global.trenbe) — 후보 설명이 **비어 있다** ⟹ 이 증거로 못 막는다.
🔴🔴 **발화 3/3 이 한 샵이다** ⟹ 「모든 판매처에서 작동한다」로 **일반화하지 않는다**.

### 🟢🟢 STEP 6 — **안전조건 6/6 PASS**

```
🟢 ① FP 증가 0              baseline 2 → description 1 → integrated 1
🟢 ② seller brand 오염 0    선언된 brand 를 덮은 건 **0**(전수)
🟢 ③ MODEL_CODE 보호 유지    값 덮어쓴 건 **0** · 품번재사용 2건(C19·C20) **전부 non-SAME**
🟢 ④ NO_TITLE_OVERLAP 완화 0 제목 토큰 변경 **0**
🟢 ⑤ threshold 완화 0        운영 함수를 그대로 호출 · 상수 변경 0
🟢 ⑥ 기존 DIFFERENT 보호     TN **8 → 9**(줄지 않았다 · 늘었다)
```

🔴 **운영 반영은 하지 않았다**(CPO 지시) — 이 표가 **GO/HOLD/NO-GO 판정 재료** 다.

### 🔵 CPO 가 GO 를 주면 **조사 없이** 할 일

```
① 공급 지점 하나 — 후보 `brandModelCode` 가 **null 일 때만** 후보측 설명에서
   `/B\d{3}[A-Z]{2}\d{3}/` 로 **정확히 1개** 찾히면 채운다
   🔴 값이 있으면 덮지 않는다 · 🔴 둘 이상이면 고르지 않는다 · 🔴 원상품 설명은 안 본다
② 계약 + 변이(발화 3건이 FAIL 로 뒤집히는지) + 회귀 + typecheck + build + 배포
🔴 새 축 0 · threshold 0 · NO_TITLE_OVERLAP 0 · A/B 분리는 **별개**(여전히 HOLD)
🔴 그리고 설명문이 `materialText` 로 오는 것은 **현재 공급 경로의 성질** 이다 —
   그 칸의 「소재」 용도를 바꾸지 않는다(읽기만 한다)
```

### 🔵 [완료] 다음 세션이 **조사 없이** 할 STEP 4~6

```
① 품번 추출 술어는 이미 있다 — `/B\d{3}[A-Z]{2}\d{3}/`(원상품과 **같은 모양만**)
   🔴 느슨한 숫자 매칭 금지 · 🔴 **후보측 설명만** 본다(원상품 설명을 후보 증거로 쓰면 오염)
② 전체 GT 33쌍 + 기존 FP 2 에 반사실 적용 → CPO 5행 표를 채운다
③ 표 행 — Baseline / Description / Form·category / 기존 축 조합 / Integrated
🟢 하니스 재사용 — `core-sprint02-brandname-separability`(5건) · `core-same05-gt` 모듈
🔴 안전조건 6(CPO §6)은 그대로 — FP 증가 0 · seller brand 오염 0 · MODEL_CODE 보호 유지 ·
   NO_TITLE_OVERLAP 완화 0 · threshold 완화 0 · 기존 DIFFERENT 보호
```

### 🔴 CPO 결정 반영(이번 세션)

```
① A/B 분리        🟢 설계 GO · 🔴 verdict 변경 **0**(COMPOSITION 분모 0 이라 수치 측정불가)
② MODEL_CODE      🟢 **현재 구조 유지** · 완화 **0** — 🟢 이번 발견은 그 보호를 **강화** 한다
③ Brand+제품명     🔵 **이번 스프린트** — 분리축 **1 발견**(위)
④ description     🟢 Evidence Layer 공급 GO — 🔴 반사실까지만 · 운영 적용 **0**
🟡 URL 3개 수신 보류(CPO 확정) — 현재 병목이 카테고리 수가 아니라는 실측과 일치
```

---

## 9-L. 🟢🟢 **CORE-SAME-SPRINT-02 — Description → MODEL_CODE 공급 «배포 완료»**

> 🟢 CPO 제한적 GO(2026-10-26)로 **운영 반영**. 🔴 새 SAME 축 **0** · threshold **0** ·
> `NO_TITLE_OVERLAP` **0** · MODEL_CODE 완화 **0** · `priceTier`/`domesticReference` **0**.

### 🟢 변경 — 운영 **2 파일**(신규 1 · 배선 1줄)

```
신규  packages/crawler/src/comparison-search/model-code-from-detail.ts
      `recoverModelCodeFromDetail(facts)` — 🔴 인자 **하나**(원상품을 볼 방법이 구조적으로 없다)
배선  product-url-facts.ts:335  `const suppliedFacts = recoverModelCodeFromDetail(facts)`
      :366 `facts: suppliedFacts`   🔴 **공급 지점은 하나** 다(계약이 호출 수 1 을 단언)
```

🔴🔴 **공급 지점이 Shopify 경로인 이유 — 샵 편향이 아니라 «구조» 다**
```
상세설명 전문은 **Shopify 경로에서만** `materialText` 로 들어온다
  (`body: body.body_html` → `plainText()`).
🔴 HTML 경로는 `description`/`material` 을 **일부러 넘기지 않는다**(거짓 MATERIAL
   blocker 때문 · `productFactsFromListing` 의 `category` 주석).
⟹ 🔴 그래서 실측 발화가 `tinyapple` 에 몰린 것은 **공급 경로의 성질** 이다.
   「모든 판매처에서 검증됐다」로 **읽지 않는다**.
```

### 🟢 안전계약 A~F — **16/16 PASS** · 변이 **M1~M4 전부 FAIL → 바이트 복구**

```
A 기존 값 보존      값이 있으면 **같은 객체** 를 돌려준다(할당 0) — M1 1 FAIL
B 후보측만          인자 **하나** · 소스에 `origin`/`query` 어휘 **0**(주석 벗기고)
C 다중 보류         서로 다른 품번 2개면 **고르지 않는다** — M2 1 FAIL
D 정확 패턴만       `226AC009`·`AC009`·`B226AC09`·단어경계 위반 전부 **거부** — M3 **7 FAIL**
                   🟢 전역 regex 를 **함수** 로 만들어 `lastIndex` 공유 사고도 잠갔다
E conflict 보호     복원값이 원상품과 다르면 기존 `compareModelCode` 가 conflict 를 낸다
                   🔴 이 파일에 `verdict`/`blocker`/`threshold` 어휘 **0**
F 다른 칸 불변       `brandModelCode` **한 칸만** 바꾼다(전 칸 대조)
배선                `facts: suppliedFacts` 를 끊으면 **M4 1 FAIL**
```

### 🟢 GT 결과 — 🔴 **두 분모를 갈라 적는다**

| | baseline | after |
|---|---:|---:|
| SAME 회수 | 5/17 | **5/17**(유지) |
| 🔴 DIFFERENT 누출 | 2/10 | 2/10 |
| 기존 FP | 2 | 2 |
| TN | 8 | 8 |
| UNDETERMINED | 6(sysSAME 0) | 6(0) |

🔴🔴 **저장 facts GT 는 변하지 않는다 — 그것이 «정상» 이다.** 그 분모는
`factsFromProductUrl` 를 **거치지 않고** 저장된 facts 를 바로 쓰므로 **공급 지점을 지나지 않는다**.
⟹ 🟢 이 표가 증명하는 것은 **「회귀 0」** 이다(개선은 아래 반사실이 증명한다).

🟢🟢 **개선은 반사실에서 측정됐다**(`core-sprint02-step456-matrix` · 공급을 시뮬레이션):
```
SAME 회수 5/17 **유지** · DIFFERENT 누출 **2 → 1** · 기존 FP **2 → 1** · TN **8 → 9**
발화 3건 — C05 exact→SAME 유지 · S1-6 conflict→**FP→TN** · C50 conflict→차단 강화
🔴 남은 누출 1 = `C06`(trenbe) — 후보 설명이 **비어 있어** 이 증거로 못 막는다
```

### 🔴 STOP / Risk

```
🔴🔴 **이번 구현은 Evidence Layer 개선이며, 모든 판매처/카테고리에 대한 범용성
   검증 완료를 의미하지 않는다.**
🔴 발화 분모 — 실측 3건(전부 Shopify) · 🔴 비-Shopify 경로는 **입력이 없어 발화 0**
🔴 `materialText` 를 **description 계약으로 인정하지 않았다** — 읽기 전용이다
   (쓰기 0 · 계약이 `materialText\s*:` 를 금지로 단언) ·
   🟡 정식 `ProductFacts.description` 도입은 **별도 Sprint**(CPO 확정)
🔴 A/B 분리(Comparability)는 **여전히 HOLD** — 이번 범위가 아니다
```

---

## 10. 🟢🔴 STEP 5 = CLOSED (CPO 2026-10-26) — 재개 조건 **하나**

| 트랙 | 판정 |
|---|---|
| ① 품번/모델코드 | 🟢 **유지**(작동 중 · exact 3/4) |
| ② 상세설명 직접 연결 | 🔴🔴 **금지** — 정답 SAME 악화가 **서로 다른 분모에서 2회 재현** |
| ③ 상세 브랜드 단서 | 🔴 근거 부족(`descBrandEvidence` 1/8) |
| ③-b 품번→브랜드(C3) | 🟡 **HOLD**(AC009 이득 0 · 위험 0) |
| ④ 이미지 | 🟡 **HOLD**(후보 `imageUrl` 하드코딩 null · 공급 owner 없음) |
| ⑤ 국내가격 SAME 자격 | 🔴🔴 **HOLD** |

### 🔵 재개 조건 — 구현 WU 가 아니라 **「GT 기반 정밀도 재측정 WU」** 다

```
WU-063~080 의 GT 를 기준으로 **COLOR/FIT 축을 완화했을 때**
  ⒜ SAME precision 이 실제로 개선되는가   ⒝ HUMAN DIFFERENT 가 **함께 열리지 않는가**
🔴 안전한 축이 확인되기 전까지 **현재 운영 MI 를 보존** 한다.
🟢 재사용 하니스 — `core-step5-evidence-c3-gt`(27쌍) · `core-step5-e2-description-evidence`(8쌍) ·
   `core-step5-domestic-lineage`(AC009 live). 🔴 셋 다 **발화 단언** 을 들고 있다
   (반사실이 안 돌면 FAIL · 「변화 0 = 안전」 금지).
```

### 🔴🔴 이 트랙의 전략 결론 — **순서를 뒤집지 않는다**

> **국내가격을 더 많이 가져오는 것이 목표가 아니다.** 먼저 「같은 상품」이라는 증거가
> 신뢰할 수 있어야 하고, **그 다음에** 그 상품의 국내가격만 가격 판단에 쓴다.

🔴 뒤집으면 WU-063~080 이 쌓은 SAME 개선을 무너뜨린다(여덟 축 전수 측정).

---

## 11. CLOSED / HOLD / 금지 — 원장

```
🟢 CLOSED   가격 축(자격만 주면 기존 집계기가 작동 · 국내 59,000~88,000 ·
            해외 EUR 35~40 / GBP 33 / USD 56 · leakage 0) — **더 파지 않는다**(CPO)
            STEP 5 · CORE-2S/2T/2U-A/2V/2W/2X/2Y/2Z/2AA/2AC/2AO · WU-130~152 ·
            여덟 보호축(COLOR·TITLE·MODEL_CODE·LINE·MARKET·PRICE·LANGUAGE·BRAND)

🟡 HOLD     SI-3(품번 없는 후보에서만 발화 · 운영 미적용) · C3 · 이미지 축 ·
            국내가격 SAME 자격 · 소재 어휘 정규화 ·
            CPO 판정 2건 — ⒜ 후보측 brand null 시 BRAND_UNCONFIRMED
                          ⒝ 고도몰 `set_goods_price` 판매가 필드

🔴 금지     SAME-only / EXACT-only 가격 필터 · 국내가격 수집 로직 변경 ·
            priceTierFromLink 변경 · COLOR/FIT blocker 완화 · description 재연결 ·
            AUDIENCE_LINE 완화 · GARMENT_FORM 조건 추가 · SAME_MIN_AXES ·
            corePoints 산식 · TITLE partial 점수 · crossSellerReserved · threshold
```

🔴 **SAME 축에서 확정된 사실** — CEO 가 SAME 으로 확정한 **8개** 를 자동 MI 가 회복하지
못하는 원인은 **전부 blocker/conflict** 다(점수 부족은 1건뿐). CORE-2X 가 증거 레버 C0~C6
전수에서 **0/8** 을 측정했다(STOP-C). ⟹ 다음 범위는 **CPO 가 지정** 한다.

🔴 **SI-3 의 사정거리가 구조적으로 좁다** — 공식몰 AB/AC **108/108 이 MODEL_CODE conflict**
로 조기 반환(axes: [])되어 TITLE 축이 **계산조차 되지 않는다** ⟹ SI-3 은 발화할 수 없다.

🔴 **「국내 SAME 0」은 MI 문제가 «아니다»**(WU-150 · 재조사 금지) — B226AC009 국내 URL 7개 중
**5개는 페이지를 읽을 수 없고**(403 ×2 · SPA ×1 · 목록 ×2), 읽히는 1개(보몽드)는 **품번까지
맞춰 놓고 「brand 칸 하나」로 보류** 된다. 🟢 SKU 는 사라지지 않았다 —
`brandModelCode="B226AC009"` 가 MI 까지 정상 전달된다.

### 🟢 CI 상주 회귀 (네트워크 0 · 믿고 쓸 것)

```
core-2aa 17  국내 가격 회귀(KRW 59,000~88,000 · 3곳 · sellerKey dedupe)
core-2af  4  WU-143 false SAME 5쌍 — SI-1/2/3 재발 0/5
core-2ab  3  PLAIN_HTML 빈 칸 다섯 + Shopify 비대칭
core-2ac  8  parity 세 칸 범위(🔴 소재는 «채우지 않는다» 가 계약이다)
core-2ad  5  corePoints 산식 바이트 고정     core-2ae 5  AUDIENCE_LINE 발화 경로
core-2ag  4  표본 출처 / SI-3 정의          core-2ah 3  GT 합집합   core-2ai 4  반례 모양
core-same03-inventory  20  원상품 조인 **증명**(제목 6/6 · id→URL 19/19) · 분모 둘 ·
                           충돌 2건 · 가치라벨 fixture 격리 · 8축 읽기
core-same03-review-dom  2  생성된 검토 화면 **마운트 DOM**(jsdom · 섹션 2 · 라디오 미선택)
🔴 라이브 축은 환경변수로만 — CORE2Z/2AB/2AC/2AD/2AE/2AF/2AG/2AH/2AI_LIVE=1 ·
   **CORE_SAME03_LIVE=1**(검토 화면 재생성)
```

---

## 12. CONTRACT / SAFETY — 이 숫자를 다시 조사하지 않는다

```
handleRequestPriceReview     9 refs
marketEvidence               7 refs
PRICE_COMPARISON_ANCHOR_ID   4 refs   🔴 WU-141-R3 **보존 계약** — 지우지 않는다
PRICE_CALCULATION_ANCHOR_ID          🔴 STEP 4 가 되살린 앵커 — 지우지 않는다
```

🔴 계약은 그 구역의 **«존재» 를 글자로 단언** 한다 ⟹ 제거하면 「없다」로 **방향을 뒤집어**
다시 쓴다. 🔴 약화가 아니다 — 「seller 화면에 없다」 **그리고** 「backend/API 는 **살아 있다**」를
**같이** 단언한다. 🔴🔴 **계약을 지워서 테스트를 통과시키지 않는다.**

### 🔴 제거 계약엔 보존 단언을 «같이» 둔다

「없다」만 쓰면 다음 사람이 엔진까지 지운다. 금지 어휘는 전면 리터럴이 아니라 **범위/개수** 로
단언한다(필수 부정문이 리터럴 금지에 걸린 적이 **세 번** 있다 — 「평균은 부정문으로만」).

---

## 13. IMPLEMENTATION ORDER — 코드 변경 후 중단하지 않는다

```
1 좌표 확인(§9)  2 §7 freeze 재확인  3 구현  4 영향 계약 갱신(삭제로 우회 금지)
5 **targeted tests**   ← 🔴 전체 회귀보다 먼저
6 **mutation**         (전부 FAIL 해야 한다 · 실행 후 **바이트 복구**)
7 **2-product E2E**    (B226AC009 · B226AC010)
8 full regression   9 typecheck   10 build   11 deploy   12 production check   13 보고 1회
```

🔴 순서를 뒤집지 않는다 — 전체 회귀를 먼저 돌리면 **내 계약이 틀렸는지, 기존 계약이
깨졌는지** 를 가를 수 없다.

---

## 14. TEST RULE — 분모를 반드시 적는다

```
**680 files / 9,231 passed / 0 failed / 140 skipped**   ← 기준선(apps/admin · CORE-PRICE-SAME-03 후)
   🟢 직전 677/9,208 에서 **+3 files / +23 tests** = 이번 WU 가 더한 계약 전부
      (inventory 20 · DOM 2 · 라이브 게이트 1 · 🔴 라이브 생성 본편은 **skip** 된다)
typecheck PASS (0)      build PASS (exit 0)
🔴 라이브 네트워크 하니스 **2건이 병렬에서 간헐 FAIL · 단독 PASS** —
   `p54c1-grounding-redirect`(CPO 가 합산 제외한 baseline) ·
   `core-2m-visual-review-build`(외부 사이트 의존 · `packages/` 변경 0)
🟢 **그 둘이 같이 통과한 실행이 이 기준선이다**(그래서 직전 기록 675/9,180 보다 +1/+1)
🔴 숨기지 않는다 — 다음 실행에서 9,180 이 나오면 **회귀가 아니라 그 2건의 간헐 실패** 다
```

🔴 **기존 테스트를 통과시키려고 수정하지 않는다** — 기능 정책이 바뀐 경우에만 계약을
**의도적으로** 갱신한다. 🔴 소스 문자열 검사는 **주석을 벗기고** 한다.
🔴 화면은 **마운트한 DOM** 으로만 완료 선언한다(Render PASS ≠ 소스 PASS).

---

## 15. 🔴🔴 REPORT RULE — 중간 보고 없음 · 최종 1회 · **마지막 절은 필수**

```
1 목적        2 변경        3 실제 결과     4 회귀
5 변경 금지 영역 준수       6 Git          7 Deploy
8 STOP / Risk              9 CEO Action

+ 변경 파일 · 테스트 분모 · typecheck · build · Production 상태

🔴🔴 **마지막은 반드시 이것이다 (CEO 지시 · 생략 금지)**
   ▸ 현재 프로젝트가 **어디까지 왔는가**
   ▸ 다음에 **정확히 무엇을 해야 하는가**
```

🔴 「이번 세션에서 무엇을 했는가」보다 **「지금 좌표 + 다음 한 수」** 가 중요하다.
🔴 그리고 보고가 끝나면 **이 문서의 §0 과 §9 를 같이 갱신** 한다 — 갱신하지 않으면
다음 페이지가 다시 과거로 되돌아간다.

---

## 16. DEPLOY → PRODUCTION CHECK

```
git fetch origin --quiet ; git status ; git rev-list --left-right --count origin/main...HEAD
🔴 종료 보고에 clean 여부 **와** ahead/behind 숫자를 같이 적는다
배포 후 확인  /  ·  인증 redirect  ·  Seller Decision route  ·  상품 상세/판단 화면
🔴 「Deployment successful」만 적지 않는다 · 🔴 401/307 을 route 증거로 쓰지 않는다
🔴 `main` push 가 Production 배포를 부른다 · `vercel --prod` CLI 는 쓰지 않는다
```

---

## 17. STOP RULE

**아래일 때만** 안전 종료한다:

```
코드 변경 «전» 예상치 못한 구조적 위험 발견 · production destructive action 필요 ·
business/security policy 승인 필요 · 기존 freeze 를 깨야만 해결 가능
```

🔴 그 외에는 **코드 변경 → 검증 → 배포까지 계속 진행한다.**
🔴🔴 「코드 변경 후 세션이 부족할 것 같다」로 **중간 중단하지 않는다** —
**착수 «전» 에 범위를 잡고 끝까지 닫는다**(§4-C 용량 판단은 WU 단위다).

---

## 18. CEO RULE + 현재 CEO Action

CEO 는 코드·계약·commit 을 검토하지 않는다. **배포 전에는 아무것도 요청하지 않는다.**
배포 뒤 **최종 테스트 1회** 만 요청하고, 형식은 **넷** 이다:

```
테스트 URL:      테스트 상품:      테스트 순서:      예상 결과:
```

### 🟢 **[완료] CEO Action ③ — 국내 후보 10건 판정**(2026-10-26 수신 10/10 · §9-B)

🔴 **다시 하지 않는다.** 라벨은 `fixtures/core-same03-human-gt.json` 에 고정됐다.

```
파일        docs/core-same03-domestic-review.html   ← 브라우저로 **그냥 열면 된다**
            (자립형 · 로그인 0 · 네트워크 0 · 사진이 **파일 안에** 들어 있다)
무엇을      원상품 **둘**(B226AC009 · B226AC010) 각각의 국내 후보를
            [동일] / [다른제품] / [판단불가] 로 고르고 **사유 한 줄**
끝나면      맨 아래 **[판정 결과 복사하기]** → 그 JSON 을 붙여 주십시오
```

🔴🔴 **섹션을 넘어 비교하지 마십시오** — 원상품이 둘이고, 섞으면 비교가 거짓이 됩니다.
🔴 **가장 중요한 두 건**(과거 판정이 서로 달랐습니다 · 화면에 🔴 로 표시돼 있습니다):
`global.trenbe.com` · `m.luxboy.com`. 이 둘은 **반드시** 봐 주십시오.

🔴 **정상인데 FAIL 로 보이기 쉬운 것 넷**:
⒜ **측정불가 3건**(miniboutique · kream · luksusbaby) — 저희가 그 **페이지를 읽지 못한** 것이고
  「상품이 없다」가 아닙니다. 사진이 없으면 **판단불가** 가 정답입니다
⒝ `PASS` / `FAIL` 배지는 **시스템의 상태** 일 뿐이고 **정답이 아닙니다** — 대표님 판정이 기준입니다
⒞ `beaumonde.co.kr` 이 **두 줄** 인 것 — 하나는 **목록 페이지** 이고 하나는 상품 상세입니다(다른 URL)
⒟ 「조기 종료」라고 적힌 후보 — 반증을 먼저 만나서 **나머지 축을 계산하지 않은** 것이고,
  점수가 낮아서가 아닙니다

### 🟡🟡 **CEO Action ① — 한 글자 답변**(이것이 STEP 3 착수 여부를 가른다)

> 🔴 **새 상품을 다시 테스트하지 않는다.** 과거 실제 상품 검증 때 biskuit / luxboy 같은
> 후보를 SAME / DIFFERENT 로 판단하면서 **실제로 무엇을 눈으로 보고 판단했는지** 만 묻는다.

```
A. 상품 사진/이미지
B. 상세페이지의 색상·소재·핏 등의 정보
C. 둘 다
D. 둘 다 아니고 상품명/품번/브랜드만
```

🔵 **답에 따라 CTO 가 할 일이 정해진다**(CPO 확정):
```
A 또는 C  →  **STEP 3 IMAGE evidence 측정** 착수(측정 전용 · 구현 0)
B         →  image STEP 3 **보류** · description 은 **REJECT 유지** · 다른 공급선 검토
D         →  image·description 둘 다 보류 · **새 evidence 공급 조사**를 별도 WU 로
```

### 🟡 CEO Action ② — **화면 1회**(UX01 + STEP 4 를 한 번에)

🔵 **UX01 확인 9항** — `/pipeline` 에서 아무 상품 1개(「새 상품 분석」 또는 「🔄 다시 분석」):

```
[ ] 왼쪽 📊 영역에 **판매판단** 이 보인다
[ ] 오른쪽 Action Center 가 **그대로** 있다
[ ] 왼쪽/오른쪽 판매판단이 **동일하다**
[ ] 권장 판매가격 **₩A** 가 눈에 띈다
[ ] **[이 가격으로 설정]** 이 직관적이다
[ ] 🇰🇷 국내 참고가격이 **시장 근거** 로 이해된다
[ ] 🌎 해외 최저 소싱가가 명확하다
[ ] **ⓘ** 를 누르면 **A 의 가격 계산 기준** 이 열린다
[ ] 국내가격 B 를 권장 판매가격 A 로 **오해하지 않는다**
```

🔴 **세 질문에 즉시 답할 수 있어야 한다** — 「팔아도 돼?」 → 판매판단 · 「얼마에 팔아?」 →
권장 판매가격 · 「왜 그 가격이야?」 → 근거 + 계산 기준. **답이 안 나오면 UX01 FAIL** 이다.

### 🟡 같이 보는 것 — **STEP 4 화면**

```
테스트 URL   https://ttaejyo.vercel.app/pipeline   (로그인 필요)
테스트 상품   아무 상품 1개 — 「새 상품 분석」 또는 「🔄 다시 분석」
테스트 순서   ① 맨 위 「📊 가격 분석」 ② 「💡 판매가격 가이드」의 **권장 판매가격 ₩…**
             ③ **「ⓘ 가격 계산 기준 보기」를 누른다**
             ④ 바로 아래 계산 상세(원본가 → 환율 → 착지원가 → 수수료 → 마진)가 펼쳐지는가
             ⑤ 「＋ 상세정보 보기」의 「국내 시장가격에 맞추면 예상 마진 …」 한 줄
예상 결과     🟢 ①~⑤ 가 **한 화면에서** 끝난다 · 🟢 권장 판매가격 금액이 **한 번만** 뜬다
FAIL 기준     ③ 을 눌렀는데 아무 일도 없으면 FAIL · 권장 판매가격이 **두 번** 뜨면 FAIL
```

🔴 **정상인데 FAIL 로 보이기 쉬운 것 셋**:
⒜ 🇰🇷 가 「확인 1곳」이고 「가격대」가 아닌 것 — **1건을 가격대라 부르지 않는 것이 정책**(§5)
⒝ 「수익성 판단 보류 — 매입 원가를 입력하면 …」 — 원가는 셀러 입력이고 **UNKNOWN ≠ 실패**
⒞ 🌎 가 `GBP 37` 처럼 ISO 코드인 것 — **환산 금지 계약** 이고 ₩ 는 권장 판매가격에만 쓴다

🔴🔴 **작업 중 아래를 묻지 않는다 — 전부 이미 결정된 범위다**:

```
「legacy UI 를 제거할까요?」  「flag 로 숨길까요?」      「A/B 중 어떤 방식이?」
「국내 SAME 도 같이 고칠까요?」「Registry 를 늘릴까요?」  「adapter 를 추가할까요?」
「Gemini 를 다시 켤까요?」    「계약을 어떻게 바꿀까요?」「CEO 가 중간 테스트해볼까요?」
```

---

## 19. 세 페이지 운영 방식

| 페이지 | 역할 | 🔴 하지 않는 것 |
|---|---|---|
| **① CPO — MASTER / 전략** | 전략 · 정책 · WU 지정 · 보고 판정 · STOP/HOLD/CLOSED | 코드 직접 수정 |
| **② CTO — EXECUTION** | 조사 · 구현 · 계약 · 변이 · 회귀 · Git · deploy · 보고 | 정책 결정 · 범위 확장 |
| **③ CEO — QA / SCREEN** | Production 결과 · 실제 화면 · 캡처 · 최종 PASS/FAIL | 코드 임의 수정 |

🟢 **CEO 화면 피드백은 ① 로 가져가** 다음 WU 결정에 쓴다.
🔴 **세 페이지 모두 세션 시작에 이 문서를 읽고, 끝에 §0/§9 를 갱신한다.**

---

## 20. 실행 명령 (복붙)

```bash
# 회귀 — 🔴 출력을 파일로 받는다(실패 이름을 놓치지 않기 위해)
cd apps/admin && npx vitest run > /tmp/reg.txt 2>&1; grep -nE "FAIL |AssertionError" /tmp/reg.txt

# typecheck · build — 🔴 grep 종료코드를 tsc 의 것으로 읽지 않는다(파일로 받는다)
cd .. && npx tsc -p apps/admin/tsconfig.json --noEmit
cd apps/admin && npm run build

# 배포 확인
npx vercel ls --yes | grep -A1 "Age "
```

🔴 **변이는 `python3` 없이 `Edit` 로만** 한다(이 환경에 python3 이 없어 「적용 실패」가
「통과」로 읽힌 적이 있다 · 적용 여부를 `grep -c` 로 확인한다).
🔴 **미커밋 구현을 `git checkout` 으로 되돌리지 않는다** — 백업 후 **바이트 대조** 로 확인한다.

---

## 21. 아카이브 — 막혔을 때만 연다

```
docs/ARCHIVE-CLOSED-WU.md   종료된 WU 상세 45절   🔴 진입점이 아니다
docs/HANDOFF-WU-*.md         개별 WU 전문          🔴 해당 절 하나만 읽는다
CLAUDE.md §12                과거 결론 모음        🔴 작업 좌표가 아니다
```

🔴 **그 문서들의 「지금 여기」·「착수점」·「CEO 확인 대기」는 그때의 상태다.**
현재 좌표는 **이 문서 §0** 하나다.

---

## FINAL PRINCIPLE

> 이 프로젝트에서 가장 중요한 것은 **더 많은 기능을 만드는 것이 아니라,
> 이미 검증된 기능을 다시 깨지 않고 연결하는 것** 이다.

```
CLOSED = 닫힌 것      HOLD = 보류된 것
금지   = 건드리지 않는 것   CURRENT WU = 지금 할 것
```

🔴 **과거 작업을 다시 시작하지 않는다.** CPO 가 reopen 하지 않는 한 이전 단계는 **그대로
사실로 취급** 한다.

🔴 **후보를 많이 보여주는 것이 목적이 아니다.** 동일상품을 정확히 찾아 **2~3개의 가격
근거** 로 셀러가 「팔아도 되는가 → 얼마에 팔 것인가 → 왜 그런가」를 한 화면에서 판단하게
하는 것이 목적이다.

---

## 9-M. 🟢🟢 **CORE-SAME-SPRINT-03 — `ProductFacts.description` 정식화 «배포 완료»**

🔴 **판정 변경 0.** threshold · `SAME_MIN_AXES` · 8축 · `NO_TITLE_OVERLAP` · BRAND · COLOR ·
`priceTier` · `domesticReference` · 가격 파이프라인 · 셀러 UI — **전부 변경 0**.
🔴 새 `DESCRIPTION` 축 **0** · 새 blocker/conflict **0** · 「설명이 있다/유사하다 → SAME」 **0**.

### 고친 것 — 「우회」가 실제로 무엇이었는가

```
BEFORE  보강기가 facts.**materialText** 를 raw text 로 읽었다
        🔴 그 칸은 **소재 축(compareMaterial)의 입력** 이다. 설명문이 거기 있던 이유는
           seller-facts.ts:200 의 `material = parse(description).length > 0 ? description : null`
           ⟹ 「소재 조성이 파싱될 때만 설명문 전문을 담는다」는 **우연한 우회** 였다
AFTER   `ProductFacts.description`(optional · Evidence Layer 정식 칸) 신설 ·
        Shopify 경로가 공급(`description: description || null`) · 보강기는 **그 칸만** 읽는다
🔴 `description ?? materialText` **alias 폴백 없음**(CPO §4 금지 · 음성계약으로 잠금)
```

🟢 **부수 효과(설계된 것)** — 「소재 조성이 파싱되지 **않는** 설명문」에서도 품번을 읽는다.
BEFORE 는 그 경우 `materialText === null` 이라 **구조적으로 못 읽었다**.

🔴 **`material` 대입 조건은 한 글자도 바꾸지 않았다**(CPO §5). 그 칸을 「소재 구절」로 좁히는
것은 **`compareMaterial` 의 분모 변경** 이라 이 Sprint 범위가 아니다 ⟹ **별도 CPO 판정 사안**.
🔴 HTML 일반 경로는 `description` 을 **일부러 비운다** — 추정해서 채우지 않는다(계약 C).

### 🟢🟢 하니스에서 «복제식» 을 제거했다 — 이것이 이번 회차의 가장 중요한 발견

```
🔴 core-sprint02-step456-matrix 가 codesIn(facts.materialText) 를 **자기가 다시 구현** 했다
   ⟹ 운영이 정식 칸으로 옮겨가도 **FAIL 하지 않는다**(§5-B 가 경고한 바로 그 자리)
🟢 이제 운영 `recoverModelCodeFromDetail` 을 **그대로 부른다** —
   운영을 되돌리면(description → sellerSku) 그 하니스가 **1 FAIL** 한다(실측)
🟢 숫자는 **동일** — 발화 3 · SAME 회수 5/17 · 누출 1/10 · 기존 FP 2→1 · TN 8→9 · 안전조건 6/6
```

🔴🔴 **저장 GT 는 «옛 계약» 이다 — 숨기지 않는다.** 그 fixture 는 `description` 이 생기기
**전** 스냅샷이라 그 칸이 없다. 그래서 하니스에서만 원문을 정식 칸으로 **승격** 해 운영 함수에
넘긴다. 🔴 **측정용 승격이고 운영 폴백이 아니다.** ⟹ 위 숫자는 「**description 이 공급되는
경로에서** 이렇게 된다」는 뜻이고 「저장된 전체 후보에서 지금 이렇다」가 **아니다**.

### 증거

```
계약 16 → **22**(신규 6) — Contract B 음성계약(같은 글을 materialText 에 넣으면 **읽지 않는다**) ·
  Contract G(읽는 칸 하나 · `materialText` 어휘가 코드에 **없다**) · Shopify 공급 배선 ·
  `material` 조건 불변 · HTML 경로 미주입 · 소재조성 없는 설명문에서 품번 읽기
음성대조  M1(우회 복원) **8 FAIL** · M3(alias 폴백) **2 FAIL** ·
          M2(Shopify 공급 끊기) **1 FAIL** · M4(소재 축 조건 변경) **1 FAIL** → **바이트 복구**
회귀 692 files / **9,303 passed · 0 failed · 140 skipped** · typecheck **0** · build exit **0**
배포 `793bd099` · 작업트리 clean · origin/main **0 / 0** · Production `/` **200**
```

### 🔴 측정불가 / 넘겨 읽지 않는 것

```
⒜ **description coverage 를 재지 않았다** — 전체 후보 중 이 칸이 실제로 채워지는 비율은
   **미측정** 이다. 0% 도 100% 도 아니다 ⟹ CPO 판단 대기
⒝ 공급은 **Shopify 경로뿐** 이다 — 「모든 판매처/카테고리에서 검증됐다」로 **읽지 않는다**
⒞ 저장 GT 숫자(SAME 5/17 · FP 1)는 **승격한 입력** 기준이다(위 설명)
⒟ 🔴 회귀 중 `docs/core-2m-visual-review.html` 이 라이브 재생성되며 국내 biskuit 후보의
   공식 품번이 `없음 → B226AC009` 로 바뀐 것이 관측됐다. 🔴 **내 변경이 원인이라 단정하지
   않는다** — 그 후보는 Cafe24(**HTML 경로**)이고 보강기는 Shopify 경로에만 있으며, 같은
   diff 에 **사이트 내용 변화** 도 함께 있다. ⟹ 범위 밖 산출물이라 **커밋에서 제외** 했다
```

🔵 **다음 좌표** — CPO 가 지정한 순서는 ① description 정식화(**완료**) → ② evidence coverage
측정 → ③ 필요한 evidence 만 Identity 에 연결 → ④ Comparability(A/B) → ⑤ 가격 형성대 →
⑥ 판매판단. 🔴 **CTO 가 ②를 임의로 시작하지 않는다.**

---

## 9-N. 🟢🟢 **CORE-SAME-SPRINT-04 — Evidence Coverage 측정**(측정 only · 운영 변경 **0**)

🔴 **production code change 0.** test-only 하니스 1파일
(`core-sprint04-evidence-coverage.test.ts`). matcher · threshold · `NO_TITLE_OVERLAP` ·
MODEL_CODE conflict · material parser · `priceTier` · `domesticReference` ·
HTML 경로 description 공급 — **전부 변경 0**(CPO §11 금지 1~8 전수 준수).

### 🔴🔴 분모를 «둘» 로 갈랐다 — 섞으면 측정이 틀린다

```
분모 A  저장 facts **33** — 🔴 `description` 이 생기기 «전» 스냅샷이다
        ⟹ 그 칸의 0 은 **계약 버전** 문제이고 「coverage 0%」가 **아니다**
분모 B  라이브 재수집(운영 `factsFromProductUrl`) — 🟢 **이것이 coverage 다**
🔴 candidate rows **33** ↔ unique URL **33** ↔ facts 확보 **26** 을 같은 줄에 적지 않는다
```

### 공급 경로별 description coverage (URL 단위 · facts 확보분)

| 공급 경로 | URL | facts O | desc 있음 | desc 없음 | coverage |
|---|---:|---:|---:|---:|---:|
| SHOPIFY_JSON | 20 | 20 | 19 | 1 | **95.0%** |
| PLAIN_HTML | 13 | 6 | 0 | 6 | **0.0%** 🟢 설계대로 |
| 전체 | 33 | 26 | 19 | 7 | **73.1%** |

🔴 facts 미확보 **7**(`REDIRECTED_AWAY` 5 · `UNREACHABLE` 2)은 **coverage 분모에서 뺐다** —
「description 없음」으로 세지 않는다(측정불가).

### Evidence coverage matrix (분모 B = 26)

```
TITLE 100.0 · BRAND 84.6 · CATEGORY/FORM 76.9 · IMAGE(URL만) 76.9 ·
DESCRIPTION 73.1 · MATERIAL 61.5 · COLOR 53.8 · MODEL_CODE 46.2 · FIT 26.9 ·
OPTION/SKU **0.0** · COMPOSITION **측정불가**(`ProductFacts` 에 칸이 없다)
```

🔴 `COMPOSITION` 은 `compareMaterial` 이 **그 자리에서 파싱** 해 쓰고 facts 에 보존되지
않는다 ⟹ 공급 여부를 읽을 수 없다. 🔴 `OPTION/SKU`(`sellerSku`)는 0% 지만 **matcher 가
읽지 않으므로 병목이 아니다**(SPRINT-01 실측 — 그 어휘가 `cross-seller.ts` 에 **없다**).

### description → MODEL_CODE 추출 3층

```
① description 있음        19/26 (73.1%)
② 그중 품번 «포함»          5/19 (**26.3%**)
③ 그중 «단일» 품번          5/5  (복수 0 ⟹ Contract C 포기 **0건**)
```

### 🔴🔴 하니스 결함 둘 — 둘 다 거짓 결론 직전이었다

```
⒜ `facts` 를 **최상위** 에서 읽어 **전건 null** ⟹ 「coverage 측정불가」가 될 뻔했다.
   실제 자리는 **`candidate.facts`** 다(칸 이름 추측 — 이 트랙의 반복 실수).
   🟢 발화 단언(`readable.length > 0`)이 잡았다
⒝ 라이브 산출에서 「보강 «전» 비어 있음」을 세어 **0/19** 이 나왔다 ⟹ 「발화 0」으로
   적었으면 **거짓** 이다. 그 산출은 **이미 `recoverModelCodeFromDetail` 이 적용된 뒤** 라
   **역산이 불가능** 하다. 🟢 그래서 Q4 는 **분모 A(보강 전)** 에서만 답했다
```

### Q1~Q7 — 실측값

```
Q1 전체 description coverage      **73.1%**(19/26 · facts 확보분) · 🔴 전수 아님(GT 33 URL)
Q2 어느 경로에 집중되는가          **SHOPIFY_JSON 95.0%** · PLAIN_HTML **0.0%**
Q3 description 중 품번 포함         **26.3%**(5/19)
Q4 품번 있는데 기존 코드 비어 있음   **3/4**(분모 A · SPRINT-02 발화 3건과 **일치**)
Q5 extraction 실패 패턴            🔴 품번이 **애초에 없다**(14/19 = 73.7%) ·
                                  보조 관측 — 「매우 짧음(<120)」 6건 · markup 잔존 **0**
Q6 가장 큰 공급 공백               🔴 **PLAIN_HTML 의 description 0%**(구조적) ·
                                  matcher 가 «쓰는» 축 중에서는 **FIT 26.9% · MODEL_CODE 46.2%**
Q7 다음 대상을 객관적으로 하나?     🟡 **예 — 단 CPO 선택이다**(아래)
```

### 🔴🔴 대표성 — 「tinyapple 3건」을 일반화하지 않는다

발화 호스트 분포가 **`tinyapple.net` 3 (100%)** 다. **한 호스트에 몰려 있다** ⟹
「Shopify 전체에서 이 비율로 발화한다」로 **적지 않는다**.

### 증거

```
회귀 693 files / **9,304 passed · 0 failed · 140 skipped** · typecheck **0** · build exit **0**
🔴 직전 실행에서 **1 failed 가 한 번** 났고 재실행에서 **재현되지 않았다**. 🔴 이름을
   특정하지 못했다 — 「일시 실패」로 단정하지 않고 **미규명** 으로 적는다
   (이번 변경은 test-only 이고 운영 영향 0 이다)
HTTP 33 회(read-only) · 운영 변경 **0** · 작업트리 clean · origin/main **0 / 0**
```

### 🟡 CPO 판단 대기 — §13 네 선택지 중

```
🔵 데이터가 가리키는 것 — **B(공급 경로 확장 검토)** 와 **C(핵심 정보 부족)** 가 동시에 성립한다
   B 근거  PLAIN_HTML **0%**(13 URL 중 6 읽힘 · 전건 0) ⟹ 국내 Cafe24 계열이 그 경로다
   C 근거  description 이 있어도 품번 포함은 **26.3%** 뿐이다
🔴 D(Image/Option)는 **아니다** — IMAGE 는 URL 76.9% 이고 OPTION 은 matcher 가 안 읽는다
🔴 **CTO 가 고르지 않았다.** 그리고 금지 7(HTML 경로 임의 공급)이 B 를 막고 있어
   **CPO 가 그 금지를 열어야** 진행된다
```

**STOP — CORE-SAME-SPRINT-04 Evidence Coverage 측정 완료 / 다음 Evidence Layer 우선순위 CPO 판단 대기**

---

## 9-O. 🟢🟢 **CORE-SAME-SPRINT-05 — HTML description 공급 가능성**(측정 · 구현 **0**)

🔴 **production code change 0.** test-only 하니스 1파일(`core-sprint05-html-description.test.ts`).
CPO 금지 **16항 전수 준수** — SAME threshold · `NO_TITLE_OVERLAP` · MODEL_CODE conflict ·
BRAND · TITLE · 새 axis · description similarity · material parser · `materialText` 의미 ·
`priceTier` · `domesticReference` · A/B 가격 · IMAGE scoring · OPTION/SKU · category matcher.

### 분모 (🔴 섞지 않는다)

```
candidate rows 33 · unique URL 33 · facts 확보 **26/33**
SHOPIFY_JSON 20(facts 20) · PLAIN_HTML 13(facts **6**)
🔴 facts 미확보 **7** — REDIRECTED_AWAY 5 · UNREACHABLE 2 ⟹ **별도 분모**(없음으로 세지 않는다)
```

### PLAIN_HTML description 4분류 (분모 = facts 확보 6)

| 분류 | 수 | 호스트 · 근거 |
|---|---:|---|
| `FOUND_AND_EXTRACTABLE` | **4** | rboutique(JSON-LD) · stockmann(JSON-LD) · stadtlandkind(meta) · wconcept(meta) |
| `FOUND_BUT_UNSAFE` | 2 | beaumonde「너무 짧다(9자)」 · donokids「제목과 사실상 같다」 |
| `NOT_FOUND` | **0** | — |
| `ACCESS_UNAVAILABLE` | 7 | facts 미확보분 |

🟢 source 별 — **JSON-LD `Product.description` 3/6(50.0%)** · meta 5/6(83.3%) · og 5/6(83.3%).
🔴 `@type === "Product"` 가 아닌 description(BreadcrumbList·Organization·WebPage)은 **읽지 않았다**.

### 🔴🔴 비교표 — `description` 을 «두 행» 으로 갈랐다(1차 표가 거짓이었다)

| Evidence | SHOPIFY_JSON | PLAIN_HTML | 전체 |
|---|---:|---:|---:|
| facts | 20/20 (100.0%) | 6/13 (46.2%) | 26/33 (78.8%) |
| **description(현재공급)** | 19/20 (95.0%) | **0/6 (0.0%)** | 19/26 (73.1%) |
| description(후보상한) | 19/20 (95.0%) | **6/6 (100%)** | 25/26 (96.2%) |
| 후보 품번(상한) | 5/20 (25.0%) | 1/6 (16.7%) | 6/26 (23.1%) |
| brand | 18/20 (90.0%) | 4/6 (66.7%) | 22/26 (84.6%) |
| model code | 12/20 (60.0%) | **0/6 (0.0%)** | 12/26 (46.2%) |
| category/form | 18/20 (90.0%) | 2/6 (33.3%) | 20/26 (76.9%) |
| color | 13/20 (65.0%) | 1/6 (16.7%) | 14/26 (53.8%) |
| material | 16/20 (80.0%) | **0/6 (0.0%)** | 16/26 (61.5%) |
| fit | 7/20 (35.0%) | **0/6 (0.0%)** | 7/26 (26.9%) |
| image URL | 20/20 (100.0%) | **0/6 (0.0%)** | 20/26 (76.9%) |

🔴 1차 표는 후보 폴백만 써서 PLAIN_HTML 을 **6/6** 으로 적었다 ⟹ 「HTML 도 이미 공급된다」는
**거짓 결론 직전** 이었다.

### Q1~Q6 — 실측

```
Q1 HTML description 공급 가능?   🟢 **4/6**(facts 확보분) · 🔴 URL 전체로는 **4/13**
Q2 가장 신뢰할 수 있는 source?    🟢 **JSON-LD `Product.description`**(3/6 · 스키마가 스스로
                                「그 상품의 설명」이라 말하는 칸) · meta 는 2건에서 **UNSAFE** 로 걸렸다
Q3 Evidence 회복량?              🟢 MODEL_CODE 없음 → 단일 품번 **1/4**(wconcept `B224AC128`) ·
                                BRAND 없음 → 설명문 존재 1/4 · 🔴 나머지 축은 **측정 범위 밖**
Q4 구조적 차이?                   🔴 **PLAIN_HTML 은 model code · material · fit · image 가 전부 0** 이고
                                facts 확보율도 46.2% 다 ⟹ 공백이 **description 하나가 아니다**
Q5 Identity 정책을 건드리는가?     🟢 **아니다** — 공급은 `ProductFacts` 한 칸이고 matcher 는 그 칸을
                                읽지 않는다(SPRINT-03 계약). 🔴 단 품번 회복은 **conflict 를 만들 수 있다**
                                (wconcept 품번이 원상품과 다르면 차단이 **강해진다** · SPRINT-02 와 같은 모양)
Q6 다음 우선순위 하나?            🟡 **CPO 선택** — 아래
```

### 🔴🔴 하니스 결함 셋 — 셋 다 거짓 결론 직전이었다

```
⒜ `fetchPlainHtmlWithFinalUrl` owner 경로가 §12 기록과 달랐다(실제 `src/shopify-product-json`)
⒝ 비교표 description 행이 후보를 포함해 **거짓 100%** 였다
⒞ 🔴 **내 materialText 단언이 틀렸다** — 「값이 같으면 계약 B 위반」으로 썼으나
   계약 B 는 「**값이 같아질 수 있으나 같은 칸이 아니다**」다(Shopify 는 정상적으로 같다).
   🟢 「그 칸이 **변하지 않았다**」로 고쳤다 — PLAIN_HTML material **0/6 불변**
```

### STOP 조건 점검 — 🟢 하나도 발생하지 않았다

```
body 전체 사용 ❌ · 상품 description 과 일반 텍스트 구분 불가 ❌(4분류가 2건을 UNSAFE 로 걸렀다) ·
materialText 오염 ❌(0/6) · seller/title/breadcrumb 혼입 ❌(판정 규칙이 막는다) ·
matcher 결과 변화 ❌(운영 변경 0) · MODEL_CODE conflict 약화 ❌ · matcher 정책 변경 필요 ❌
```

### 증거

```
회귀 693 files / **9,304 passed · 0 failed · 141 skipped** · typecheck **0** · build exit **0**
HTTP — `factsFromProductUrl` 33 + PLAIN_HTML 원문 6 (read-only) · 운영 변경 **0**
작업트리 clean · origin/main **0 / 0** · 🔴 Deploy 없음(test-only)
```

### 🟡 CPO production 적용 판단 대기

```
🔵 구현을 **하지 않았다** — CPO 최종 STOP 문구가 「production 적용 판단 대기」다
🟢 적용한다면 범위는 좁다 — `ListingProductLike` 에 `description?` 추가 + htmlPath 가
   **이미 받아 둔 HTML** 에서 JSON-LD `Product.description` 을 읽어 넘긴다(**추가 HTTP 0**)
🔴 그때 결정해야 할 것 둘 — ⒜ meta description 을 **포함할지**(2건이 UNSAFE 였다 ·
   JSON-LD 만 쓰면 3/6) ⒝ 품번 회복이 **conflict 를 만드는 것**을 수용할지(안전 방향이지만
   SAME 이 늘지 않는다)
🔴 **CTO 가 고르지 않았다.**
```

**STOP — CORE-SAME-SPRINT-05 Universal Evidence Supply 측정 완료 / CPO production 적용 판단 대기**

---

## 9-P. 🟢🟢 **CORE-SAME-SPRINT-06 — PLAIN_HTML Evidence Supply Integration**(배포)

🔴 **새 SAME 축 0 · 새 matcher 0 · meta 0 · 추가 HTTP 0.** CPO 금지 14항 전수 준수 —
`NO_TITLE_OVERLAP` · SAME threshold · BRAND · MODEL_CODE conflict policy · material parser ·
FIT · COLOR · CATEGORY · COMPOSITION · IMAGE scoring · OPTION/SKU · `priceTier` ·
`domesticReference` · A/B 가격 **전부 변경 0**. 🔴 `materialText` 의미 **불변**.

### 구현 (운영 4파일)

```
(신규) jsonld-product-description.ts  JSON-LD **@type=Product 의 description 만**
seller-facts.ts      ListingProductLike.description? + listing facts 공급
                     🔴 materialText 는 **계속 null**(계약 B)
product-url-facts.ts htmlPath 가 **이미 받아 둔 HTML** 에서 공급(추가 HTTP **0**)
                     + 기존 `recoverModelCodeFromDetail` **재사용**(새 정책 0)
```

### 공급 실측

```
PLAIN_HTML URL 13 · facts 확보 6 · **description 공급 3/6**
  🟢 donokids 53자 · rboutique 136자 · stockmann 398자
  🔴 미공급 3 — beaumonde · stadtlandkind · wconcept (**JSON-LD Product.description 부재**)
🔴 SPRINT-05 의 `FOUND_AND_EXTRACTABLE 4` 와 다르다 — 그 2건은 **meta 기반** 이었고
   CPO ⒜ 가 meta 를 **HOLD** 했다 ⟹ **JSON-LD 기준으로는 3** 이다
```

### 🟢🟢 Identity 영향 matrix — **CPO STOP 게이트 통과**

| 효과 | 건수 |
|---|---:|
| human SAME → SAME 유지 | **5** |
| human SAME → 이탈 | **0** |
| human DIFFERENT → 차단 유지 | **9** |
| 🔴 **human DIFFERENT → SAME** | **0** ← 합격선 |
| system SAME→비SAME / 비SAME→SAME | 0 / **0** |
| MODEL_CODE conflict | **5 → 5**(보호 불변) · PLAIN_HTML code 판정 변화 **0/6** |

### 🔴🔴 「변화 0」을 «안전» 으로만 적지 않는다 — **효과도 0** 이다

공급된 3건의 description 에 **품번이 없다** ⟹ 회복 **0**. 🔴 SPRINT-05 가 본 유일한 회복
후보(wconcept `B224AC128`)는 **meta** 에 있었고 JSON-LD 가 없어 **공급되지 않았다**.
🟢 발화 단언(`supplied > 0`)이 통과했으므로 「공급이 안 돼서 0」은 **아니다**.

### 🔴🔴 음성 대조가 «계약 공백» 을 찾았다 — 이 Sprint 의 가장 중요한 기록

```
`@type === "Product"` 게이트를 **지워도 기존 계약이 하나도 FAIL 하지 않았다**
🔴 소스 문자열 계약은 **배선** 을 보고 **동작** 을 보지 않는다(WU-110 과 같은 자리)
🟢 그래서 **행동 계약 15건** 을 신설했다(`core-sprint06-jsonld-description`) —
   WebPage · Organization · BreadcrumbList · CollectionPage 의 description 을 **읽지 않는다**
변이 — N1 게이트 제거 **5 FAIL** · N2 배선 끊기 **2 FAIL** ·
       N3 meta 폴백 **1 FAIL** · N4 소재 칸 오염 **3 FAIL** → **바이트 복구**(적용 확인 포함)
```

### 🟢 기존 계약 둘이 이 변경을 잡았고 «지우지 않고 강화» 했다

```
core-2ab AB-S2  금지 목록에서 `description` **하나만** 빼고 body/html/plainText 는 **유지**
                (이 함수는 **원문을 파싱하지 않는다**) + `materialText: null` 단언 **추가**
                🟢 그 계약의 실패 메시지가 「비대칭이 해소됐는지 다시 측정한다」였다 —
                   SPRINT-04/05 가 실제로 측정했고 이번에 그 자리가 열렸다
core-2ac AC-4   **material 금지는 그대로** 두고 description 은 **source 를 못 박았다**
core-sprint02   「공급 지점 하나」 → **「경로마다 하나」**(둘 · 각 하나)
```

### 증거

```
회귀 694 files / **9,320 passed · 0 failed · 142 skipped** · typecheck **0** · build exit **0**
배포 Ready · Production `/` **200** · 작업트리 clean · origin/main **0 / 0**
```

### 🟡 CPO 판정 대기

```
🟢 성공 기준 10 — 1~8 전부 성립(후보 식별 기준 · 분류 근거 · 공급 가능 · materialText 불변 ·
   matcher 결과 불변 · conflict 보호 불변 · 회귀 악화 0 · URL/host/path 분모)
🔴 **그러나 Evidence 회복은 0 이다.** 「JSON-LD 기반 공급의 안전성이 검증됐다」까지가
   이번 판정 범위다(CPO 문장) — 「HTML 공급이 끝났다」가 **아니다**
🟡 다음 결정 재료 — ⒜ meta 를 열면 +2 공급(그중 1건이 품번 보유) · 🔴 단 SPRINT-05 에서
   meta 는 **2/5 UNSAFE** 였다 ⒝ 공급 3/6 의 분모가 작다(표본 확대) ⒞ C(핵심 정보 부족)로 이동
🔴 **CTO 가 고르지 않았다.**
```

**STOP — CORE-SAME-SPRINT-06 PLAIN_HTML Evidence Supply Integration 완료 / Identity 영향 검증 후 CPO 판정 대기**

---

## 9-Q. 🟢🟢 **CORE-SAME-SPRINT-07 — Evidence Utility Prioritization**(측정 only · 운영 **0**)

🔴 **production code change 0 · 네트워크 0.** matcher 정책 · threshold · `NO_TITLE_OVERLAP` ·
MODEL_CODE conflict · 새 axis · category matcher · description similarity · meta 공급 ·
`priceTier` · `domesticReference` · A/B 가격 — **전부 변경 0**.

### 🟢🟢 설계 — **ablation**(이 Sprint 의 핵심)

```
각 Evidence 칸을 **양쪽(원상품·후보) 다** 비워 판정 변화를 본다
⟹ 「matcher 가 실제로 읽는가(B)」와 「판정 효과(C)」가 **한 번에** 나온다
🔴 한쪽만 비우면 「한쪽 없음」 분기를 타서 **둘을 구별할 수 없다**
   (`brandKnown = Boolean(x.brand && y.brand)` 가 그 모양이다)
🔴 **역방향을 추정하지 않는다** — 「공급을 늘리면 SAME +N」은 이 측정으로 **나오지 않는다**
   (없는 값을 지어내야 한다)
```

### 표 (GT 33 · human SAME 17 · DIFFERENT 10 · UNCERTAIN 6 · baseline SAME **5** · FP **2**)

| Evidence | 공급(후보) | 발화 | matcher | 비웠을때 SAME | 비웠을때 FP |
|---|---:|---:|---|---:|---:|
| TITLE | 33/33 | 33 | 🟢 쓴다 | **0 (-5)** | 0 (-2) |
| BRAND | 24/33 | 30 | 🟢 쓴다 | **0 (-5)** | 0 (-2) |
| MODEL_CODE | 9/33 | 33 | 🟢 쓴다 | **6 (+1)** | 1 (-1) |
| COLOR | 15/33 | 32 | 🟢 쓴다 | 3 (-2) | 2 (+0) |
| MATERIAL | 16/33 | 33 | 🟢 쓴다 | 4 (-1) | 2 (+0) |
| FIT | 7/33 | 28 | 🟢 쓴다 | **6 (+1)** | 2 (+0) |
| CATEGORY/FORM | 19/33 | 33 | 🔴 변화0 | 5 (+0) | 2 (+0) |
| IMAGE(URL) | 21/33 | 33 | 🔴 변화0 | 5 (+0) | 2 (+0) |
| DESCRIPTION | **0/33** | 33 | 🔴 변화0 | 5 (+0) | 2 (+0) |
| OPTION/SKU | 0/33 | 25 | 🔴 변화0 | 5 (+0) | 2 (+0) |
| COMPOSITION | 측정불가 | — | 측정불가 | 측정불가 | 측정불가 |

🔴 **읽는 법** — 이 표는 **「비웠을 때」** 다. SAME 이 **줄면** 그 Evidence 가 SAME 을 **지탱** 한다.

🔴🔴 **TITLE · BRAND 를 비우면 SAME 이 «전멸»(5→0)** ⟹ 둘은 **SAME 의 필수 관문** 이다.
🔴🔴 **MODEL_CODE · FIT 는 비울 때 SAME 이 «늘어난다»(+1)** ⟹ 현재 분모에서 그 축들은
**SAME 을 막는 쪽** 으로 작동한다(품번 conflict 3 · FIT blocker 1).

### ① FN blocker 분포 재집계 (FN = 12 · 중복 집계 · 🔴 과거 분류를 복사하지 않았다)

```
**BRAND_UNCONFIRMED 5** · (blocker 0) **3** · conflict:MODEL_CODE **3** · FIT 1
MODEL_CODE 비교 — unavailable **6** · exact **3** · conflict **3**
🔴 「(blocker 0) 3」은 blocker 없이 SAME 이 안 된 것 ⟹ **축 수 부족**(SAME_MIN_AXES)
🔴 「exact 3」은 **품번이 정확히 일치하는데도** SAME 이 아니다 ⟹ 다른 관문이 막는다
```

### ② safety

```
🔴 이 Sprint 에서 「DIFFERENT → SAME = 0」은 **합격선이 아니다** — ablation 은
   **일부러 약화** 하는 측정이라 누출이 나오는 것이 **정상이고 정보** 다.
🟢 실측 — 최대 누출 증가 **+0**(약화해도 FP 가 늘지 않았다) · 구현이 없으므로 운영 누출 **0**
```

### 🔴🔴 하니스 결함 — 그대로 보고했으면 무의미한 분포였다

```
`blockers`/`conflicts` 를 **문자열 배열로 추측** 해 `.map(String)`·`Object.keys` 를 썼고
**`[object Object]` 6 · `conflict:0` 3** 이 나왔다.
🟢 타입에서 읽어 고쳤다 — 실제는 `{blocker, detail}[]` · `{conflict, detail}[]`
   (`cross-seller.ts:194-195`). 🔴 이 트랙의 「칸 모양 추측」 반복 실수다.
```

### 🟡 추천 — 정확히 **1개**: `C. BRAND evidence quality`

```
① FN 최대 단일 blocker = **BRAND_UNCONFIRMED 5/12 (41.7%)**
② ablation — BRAND 를 비우면 SAME **5 → 0** ⟹ **모든 SAME 이 그 관문을 지난다**
③ 공급률 **24/33** ⟹ 9건 공백이 곧 UNCONFIRMED 분모다
🔴 **MODEL_CODE 를 1순위로 고르지 않은 이유** — 그 축은 비울 때 SAME 이 **늘어난다**(+1)
   ⟹ 공급을 늘리면 conflict 가 늘 위험이 **측정됐다**(SPRINT-06 도 같은 방향 · 회복 0)
🔴 **TITLE 은 공급 33/33 로 포화** ⟹ 「공급」 개선 대상이 아니다(normalization 은 **정책**)
🔴 이 추천은 **BRAND 완화가 아니다**(WU-080 CPO REJECT 유지) — **공급/품질** 축이다
```

### 🔴 측정불가 (0% 로 적지 않는다)

```
COMPOSITION — `ProductFacts` 에 칸이 **없다**(compareMaterial 이 그 자리에서 파싱)
IMAGE scoring — 이 경로에 **없다**(URL 공급만 쟀다 · 별도 트랙)
DESCRIPTION 효과 — 저장 facts 공급 **0/33** ⟹ 이 분모에서 **발화 불가**
「공급 증가 → SAME 증가」 — **역방향 전부 측정불가**
```

### 증거

```
회귀 695 files / **9,323 passed · 0 failed · 142 skipped** · typecheck **0** · build exit **0**
운영 변경 **0** · 네트워크 **0** · 작업트리 clean · origin/main **0 / 0** · 🔴 Deploy 없음
```

**STOP — CORE-SAME-SPRINT-07 Evidence Utility 측정 완료 / 다음 Evidence Layer 1개 우선순위 CPO 판정 대기**

---

## 9-R. 🔴🔴 **CORE-SAME-SPRINT-08 — BRAND Evidence Quality / 🔴 STOP**(운영 변경 **0**)

🔴 **measurement-first · production code change 0 · 네트워크 0.** BRAND gate ·
`BRAND_MISMATCH` · `BRAND_UNCONFIRMED` 통과 규칙 · threshold · `NO_TITLE_OVERLAP` ·
MODEL_CODE conflict · 새 axis · seller name 승격 · 사전 확대 · fuzzy/substring ·
`priceTier` · `domesticReference` · A/B 가격 — **전부 변경 0**. 🔴 `WU-080 REJECT` 유지.

### 🟢 실제 BRAND source hierarchy (가설이 아니라 **코드에서 읽었다**)

```
PLAIN_HTML  `brandFromHtml`(product-url-facts.ts:244) 순서대로
  ① meta og:brand  ② meta product:brand  ③ JSON-LD "brand".name
  ④ og:title → **등록부 alias**(`lookupBrandByAliasInTitle` · WU-151)  ⑤ microdata → null
SHOPIFY     `productFactsFromShopifyProduct`(seller-facts.ts:190)
  ① `brandFromTitleByClause(title ∩ vendor)` ② 검증된 vendor ③ `OFFICIAL_STORE_BRANDS` → null
```

### 🔴🔴 Step 1 — `BRAND_UNCONFIRMED` 5건이 **전부 `BRAND_MISSING`** 이고 **절반이 원상품 공백**

| 건 | host | 비어 있는 쪽 | 근거 |
|---|---|---|---|
| C27 | beaumonde.co.kr | 후보 | title 에 「보보쇼즈」가 **있다** |
| C11 | bobochoses.co.jp | 후보 | title 에 브랜드가 없다 |
| C37 | bobochoses.co.jp | 후보 | C11 과 같은 상품 |
| C48 | bobochoses.com | 🔴 **원상품** | 후보엔 "Bobo Choses" 있다 |
| C14 | kihanan.com | 🔴 **원상품** | 후보엔 "BOBOCHOSES ボボショーズ" 있다 |

🔴 「후보 공급 문제」로 적을 수 없다 — **2/5 가 원상품 공백** 이고 그것을 메우는 것은
WU-080 이 **악화로 측정해 REJECT** 했다(SAME 4 더 막힘 · DIFFERENT 2 열림).

### 🔴🔴🔴 Step 4 결정적 측정 — brand 를 **채워도 SAME 이 안 된다**

등록부에 「보보쇼즈」 alias 가 **이미 있다**(`brand-alias.ts:42`) ⟹ counterfactual A 가 C27 을 채웠다.

```
전  PRESUMED_SAME   blockers [BRAND_UNCONFIRMED]   conflicts []
후  PRESUMED_SAME   blockers []                    conflicts []   ← 🔴 **blocker 가 전부 사라졌다**
```

⟹ 🔴🔴 **남은 관문은 blocker 가 아니라 «축 수»** 다(`corePoints >= SAME_MIN_AXES`).
🟢 SPRINT-07 의 「(blocker 0) **3**」과 **같은 모양** 이다.
🔴 축 수를 올리는 것은 **threshold 변경** 이고 **CPO 금지** 다.

### 결정 매트릭스 (baseline SAME 5/17 · FP 2/10)

| BRAND source | 발화 | SAME 회복 | 🔴 DIFF→SAME | SAME 손실 | Production |
|---|---:|---:|---:|---:|---|
| 현재 baseline | 0 | 5/17 | +0 | 0 | — |
| A 등록부 alias → 후보 title | **1** | **+0** | **+0** | 0 | 🔴 **효과 0** |
| B 원상품 brand 투사 | — | 금지 | — | — | 🔴 WU-080 REJECT |
| C domain → brand | — | 금지 | — | — | 🔴 계약이 2 FAIL 로 잠근다 |
| D seller/store name 승격 | — | 금지 | — | — | 🔴 CPO 명시 금지 |

⟹ 🔴🔴 **production 후보가 «없다». 구현 0 · STOP.**

### 🟡 Step 3 — seller/store 오염 의심 **7/33** 인데 **전부 공식몰** 이다

```
bobochoses.com ×3 · main-story.com ×2 · kids21.com ×2
🔴 그 호스트에서는 **호스트 라벨 == 브랜드가 정답** 이다(WU-076 이 같은 것을 기록했다)
⟹ 🟢 **진짜 오염은 0** 이고 내 술어가 **공식몰을 오탐** 한다
🔴 알려진 음역 사례(biskuit 「비스킷」)는 **이 분모에 0건** 이다(다른 GT)
🔴 「오염 7」은 **하한** 이다 — 음역/번역 상점명은 이 술어로 잡히지 않는다
```

### 최종 질문 5

```
1 원인?            🔴 **전부 BRAND_MISSING** · 2/5 는 **원상품** 공백
2 seller 오염?      🟢 **진짜 0**(의심 7 은 전부 공식몰 · 하한)
3 가장 안전한 source? 🟡 **A**(등록부 alias · 새 사전 0 · 누출 0) — 🔴 단 **효과 0**
4 그 source 의 누출?  🟢 **0건**(발화 1 · DIFF→SAME +0)
5 production 가치?   🔴 **없다** — brand 를 채워도 **축 수** 에서 막힌다
```

### 증거

```
회귀 696 files / **9,326 passed · 0 failed · 142 skipped** · typecheck **0** · build exit **0**
운영 변경 **0** · 네트워크 **0** · 작업트리 clean · origin/main **0 / 0** · 🔴 Deploy 없음
CPO GO 기준 10 — ①~⑨ 전부 측정됨 · ⑩ **추천할 source 가 없다** ⟹ **STOP**
```

### 🔵 다음 좌표 — 데이터가 가리키는 곳이 **바뀌었다**

```
🔴 BRAND 는 **필요조건이지만 충분조건이 아니다** — 고쳐도 SAME 이 늘지 않는다
🟢 남은 병목은 **축 수** 이고, 그것을 늘리는 길은 **threshold 가 아니라 다른 Evidence 공급** 이다
🟡 SPRINT-07 공급률이 그 후보를 말한다 — FIT **7/33** · COLOR **15/33** · MATERIAL **16/33** ·
   CATEGORY **19/33**. 🔴 단 ablation 에서 CATEGORY 는 **효과 0** 이고 FIT 는 **막는 쪽** 이었다
🔴 **CTO 가 다음 범위를 고르지 않았다** — CPO 판정 사안이다
```

**STOP — CORE-SAME-SPRINT-08 BRAND Evidence Quality 측정 완료 / Production 적용 여부 CPO 판정 대기**

---

## 9-S. 🔴🔴 **CORE-SAME-SPRINT-09 — Universal Identity Evidence Chain**(측정 · 운영 **0**)

🔴 **운영 변경 0 · 네트워크 0.** threshold · `SAME_MIN_AXES` · `NO_TITLE_OVERLAP` ·
MODEL_CODE conflict · BRAND policy · 새 axis — **전부 변경 0**.

### 🔴🔴 STEP 1 — 현재 구조는 **「계층」이 아니라 「점수 누적」** 이다

```
① conflicts > 0 → **CONFLICT**(점수를 보기 «전» early return · axes 계산 0)
② blockers 0 ∧ brandOk ∧ **corePoints ≥ SAME_MIN_AXES** → SAME
③ totalPoints ≥ PRESUMED_SAME_MIN_AXES → PRESUMED_SAME  ④ ≥1 SIMILAR  ⑤ UNKNOWN
🔴 `cross-seller.ts:1197` 주석 — 「품번이 일치해도 여기를 지나간다. **예외가 없다**」
```
🟢 **CPO 가 지적한 긴장이 코드로 확인됐다.**

### 🔴🔴🔴 그 예외는 **과거에 있었고 CEO 가 폐기했다** — MATCHING-3.1(CEO 지시 2026-09-14)

`cross-seller.ts:36` 원문:
> 「여기에는 원래 `if (identifierConfirmed) return "SAME"` 한 줄이 있었다 … 그 전제가
> 실측 데이터에서 깨진다. junioredition.com 은 서로 다른 두 상품에 **글자 하나까지 같은
> Product Code** 를 적는다」

```
Minnie Newborn Body / Onesie             둘 다 KS106168-P05261
Bubble Sweatshirt Grey/Graystone/Conker  둘 다 **AW26MS185**
Giulia Flower Sandals 3색                전부 01325
🔴 세 세트 모두 **같은 브랜드 안** 이다 ⟹ **BRAND 를 더해도 그 반례는 막히지 않는다**
```

### 🔴🔴🔴 STEP 2 — 그 반례가 **현재 GT 안에 그대로** 있다

| 건 | brand | code | human | 현재 verdict | 막는 것 |
|---|---|---|---|---|---|
| C19 | Main Story ↔ Main Story | AW26MS185 ↔ 동일 | **DIFFERENT** | PRESUMED_SAME | `SAME_SELLER_DISTINCT_LISTING` |
| C20 | 동일 | 동일 | **DIFFERENT** | PRESUMED_SAME | `COLOR_VARIANT` + 위 |

```
BRAND 호환 ∧ MODEL_CODE exact 인 쌍 = **2/33** 이고 **둘 다 human DIFFERENT** 다
⟹ 🔴🔴 CPO 규칙을 적용하면 **False SAME +2** · 회복되는 human SAME **0**
🟢 현재 그 둘을 막는 것은 **SAME_SELLER_DISTINCT_LISTING**(MATCHING-3.1 이 같이 만든 보호)
```

### 🟢 STEP 3 — Evidence Chain 단계별 (human SAME 17 의 **실제 분포**)

| 단계 | 쌍 | 현재 SAME | human 분포 |
|---|---:|---:|---|
| ③ BRAND만(code 없음) | 13 | 7 | SAME **9** · DIFF 3 · UNC 1 |
| ⑤ 둘 다 없음 | 11 | 0 | SAME 2 · DIFF 4 · UNC 5 |
| ⑥ CODE conflict | 4 | 0 | SAME **3** · DIFF 1 |
| ④ CODE만(brand 없음) | 3 | 0 | SAME **3** |
| ①② BRAND+CODE exact | 2 | 0 | **DIFF 2** |

🔴🔴 **CPO 가 「100% SAME」이라 한 칸에 human SAME 이 «0건» 이다.**
human SAME 17 은 ③(9) · ⑥(3) · ④(3) · ⑤(2) 에 흩어져 있다.

🟡 그래서 체인에서 **실제로 가치가 있는 지점은 ①② 가 아니다** — **④(brand 공백 3건 전부
human SAME)** 와 **⑥(품번 충돌이 human SAME 3건을 막는다)** 다.
🔴 단 ④는 SPRINT-08 이 측정한 자리(원상품 brand 공백 = **WU-080 REJECT**) · ⑥은 **CPO 금지**
(conflict 완화) ⟹ **CTO 가 열지 않았다**.

### 알려진 사례 추적

```
biskuit · luxboy   🔴 **이 GT 에 없다**(측정불가)
donokids   C22  DIFF · SIMILAR        · BRAND_UNCONFIRMED
beaumonde  C27  SAME · PRESUMED_SAME  · BRAND_UNCONFIRMED  ← SPRINT-08 의 그 건
main-story C42  SAME · **SAME** 🟢    / C25 DIFF · PRESUMED_SAME · COLOR_VARIANT
junioredition S1-5  DIFF · **CONFLICT** 🟢(품번 충돌이 올바르게 막았다)
```

### 🔴 분모 주의 · 하니스 결함

```
🔴 이 GT 는 품번이 **9/33** 뿐이라 「강한 증거」 쌍이 **2건** 밖에 없다 ⟹
   그 2건으로 **전수 위험도를 일반화하지 않는다**
🔴 하니스 — 템플릿 리터럴에 **백틱을 중첩** 해 transform 실패(이 트랙의 그 함정) · 🟢 고쳤다
🟢 회귀 697 files / **9,329 passed · 0 failed · 142 skipped** · typecheck 0 · build exit 0
작업트리 clean · origin/main **0 / 0** · 🔴 Deploy 없음
```

### 🟡 CPO 판정 대기 — 이번에 올리는 것은 **정책 충돌** 하나다

```
🔴 「BRAND + MODEL_CODE exact ⟹ SAME」은 **신규 정책이 아니라 CEO 가 폐기한 규칙의 복구** 다.
   그 복구는 이 GT 에서 **False SAME +2**(C19 · C20)를 만들고 **SAME 회복은 0** 이다.
🟡 그러므로 CPO 가 고를 것은 둘 중 하나다 —
   ⒜ 그 규칙을 **「같은 판매처가 아닐 때만」** 으로 좁힌다(C19/C20 은 **같은 판매처** 다)
      🔴 그러면 이 GT 에서 발화 분모가 **0** 이 되어 **효과도 위험도 측정불가** 가 된다
   ⒝ 규칙을 **복구하지 않고** 현재 점수 누적 구조를 유지한다(= MATCHING-3.1 유지)
🔴 **CTO 가 고르지 않았다.** 그리고 어느 쪽도 **CEO 지시를 되돌리는 판단** 이라 CPO→CEO 사안이다
```

**STOP — CORE-SAME-SPRINT-09 Identity Evidence Chain 측정 완료 / Evidence hierarchy ↔ MATCHING-3.1 충돌 CPO 판정 대기**

---

## 9-T. 🟢 **CORE-SAME-SPRINT-10 — Description Evidence Chain**(측정 · 운영 **0**)

🔴 **운영 변경 0.** `identifierConfirmed → SAME` 복구 ❌ · `SAME_MIN_AXES` ❌ ·
`NO_TITLE_OVERLAP` ❌ · MODEL_CODE conflict ❌ · seller name → brand ❌ ·
COLOR/MATERIAL 축 승격 ❌ · IMAGE scoring ❌ · 🔴 **MATCHING-3.1 유지**(SPRINT-09 판정).

### 🔴🔴 라이브 재수집이 **필수**였다

```
저장 facts 의 `description` = **0/33**(SPRINT-03 이전 스냅샷) ⟹ 그 분모로 재면
**언제나 0** 이고 그것은 제품 사실이 아니다.
🟢 운영 `factsFromProductUrl` 로 다시 수집했다(CPO 「operating path 에서 다시 확인」).
```

### 공급 분해 — GT 33 · 라이브 facts **26** · 🔴 제외 7(분모 밖)

| 항목 | 값 |
|---|---:|
| description 존재 | **22/26 (84.6%)** |
| 그중 MODEL_CODE 단일 존재 | **5/22 (22.7%)** |
| 그중 BRAND 존재(등록부 alias) | **0/22 (0.0%)** 🔴 발화 0 ⟹ **측정불가** |
| 둘 다 존재 | 0/22 |

### 🟢 실제 recovery(**운영 경로** · 추정 아님) — MODEL_CODE **5/26**

```
C50  tinyapple      B126AC151  [human DIFFERENT]
C05  tinyapple      B226AC009  [human SAME]
C06  global.trenbe  B226AC009  [human DIFFERENT]  ← §12 가 적은 **현행 False EXACT** 그 건
S1-5 junioredition  B226AC141  [human DIFFERENT]
S1-6 tinyapple      B226AC141  [human DIFFERENT]
```

### 🟢🟢 Identity 효과 — **Precision > Recall 전략과 정확히 일치**

| 단계 | SAME 회복 | 🔴 DIFF→SAME | SAME 손실 | conflict |
|---|---:|---:|---:|---:|
| BEFORE (description 없음) | 5/16 | +0 | 0 | 2 |
| **AFTER-① code recovery(운영)** | 5/16 (+0) | **-1** | **0** | **5** |
| AFTER-② + brand recovery(CF) | 5/16 (+0) | -1 (①대비 0) | 0 | 5 |

🟢 **SAME 을 늘리지 않고 DIFFERENT 누출을 1건 «더 막는다»** · SAME 손실 **0**.
🟢 conflict **2 → 5**(+3)은 **보호가 강해지는 방향** 이다(SPRINT-02/06 과 같은 모양).

### 🔴 BRAND recovery 는 **측정불가**

```
등록부 alias(브랜드당 1개 · 「보보쇼즈」)가 description 에 **한 번도 걸리지 않았다**(0/22)
🔴 「효과 0」이 아니라 **발화 0** 이다 ⟹ 「description 에서 brand 를 찾으면 된다/안 된다」를
   **둘 다 적지 않는다**. 🔴 사전 확대는 CPO 금지이므로 **열지 않았다**.
```

### 증거

```
🔴 typecheck 가 하니스를 잡았다 — `lookupBrandByAliasInTitle` 은 `string | undefined` 다
   (`?? null` 누락 · baseline 0 과 비교해 포착) · 🟢 고쳤다
🟢 회귀 697 files / **9,329 passed · 0 failed · 143 skipped** · typecheck **0** · build exit **0**
HTTP 33 회(read-only) · 운영 변경 **0** · 작업트리 clean · origin/main **0 / 0** · Deploy 없음
```

### 🟡 CPO 판정 대기

```
🟢 **이미 배포된 description → MODEL_CODE recovery 의 가치가 «운영 경로에서» 확인됐다** —
   SPRINT-06 이 「효과 0」이라 적은 것은 **PLAIN_HTML 3건** 기준이었고, 이번 분모
   (Shopify 포함 26)에서는 **DIFFERENT 보호 -1 · conflict +3** 이 측정됐다
🔴 **SAME 회복은 여전히 0** 이다 ⟹ description 은 **recall 레버가 아니라 precision 레버** 다
🟡 그러므로 다음 선택지 — ⒜ Evidence Chain 을 여기서 닫고 **Comparability(A/B)** 로 간다
   ⒝ BRAND recovery 를 재려면 **alias 등록부 확대**가 필요하고 그것은 **CPO 금지 해제** 사안이다
🔴 **CTO 가 고르지 않았다.**
```

**STOP — CORE-SAME-SPRINT-10 Description Evidence Chain 측정 완료 / 다음 범위 CPO 판정 대기**

---

## 9-U. 🔴🔴 **CORE-MI-COMP-01 — Identity → Comparability 분리 실측**(운영 **0**)

🔴 **운영 변경 0 · 새 enum 0 · 가격 계산식 0.** threshold ❌ · BRAND+CODE shortcut ❌ ·
MODEL_CODE conflict ❌ · `NO_TITLE_OVERLAP` ❌ · alias 확대 ❌ · COLOR/MATERIAL 축 ❌ ·
IMAGE scoring ❌ · A/B 통합 ❌ · 🔴 **MATCHING-3.1 유지**.

### 🔴🔴🔴 먼저 — `PRICE_COMPARABLE` 은 운영 코드에 **없다**

```
전수 grep — 나오는 두 곳은 naver `registered-change.ts` 와 내 SPRINT-01 «하니스» 다
🟢 Comparability 의 **운영 owner 는 `DomesticPriceTier`** 이고 그 파일 주석(:59-62)이
   의미를 **직접** 말한다:
     EXACT      「가격비교 허용」     ⟹ COMPARABLE
     COMPARISON 「제한적 가격 참고」   ⟹ COMPARABLE(제한적)
     REFERENCE  「경쟁상품 참고」     ⟹ UNDETERMINED(재조회엔 남는다 · :74)
     EXCLUDED   「가격비교 제외」     ⟹ NOT_COMPARABLE
🔴 그래서 **새 enum 을 만들지 않고** 그 축을 읽었다
```

### 8칸 표 (라이브 **26** · 🔴 제외 7 · 운영 lineage 그대로)

| Identity | Comparability | 후보 | 국내자격 | 국내 KRW | human 분포 |
|---|---|---:|---:|---:|---|
| SAME | COMPARABLE | 6 | 0 | — | SAME 5 · **DIFFERENT 1** |
| DIFFERENT | NOT_COMPARABLE | 5 | 0 | — | DIFFERENT 3 · SAME 2 |
| UNDETERMINED | COMPARABLE | 11 | **1** | **83,600** | SAME 7 · **DIFFERENT 4** |
| UNDETERMINED | NOT_COMPARABLE | 4 | 0 | — | DIFFERENT 2 · SAME 2 |

🔴 빈 칸 넷(`SAME∧NOT_COMPARABLE` · `SAME∧UND` · `DIFFERENT∧COMPARABLE` · `UND∧UND`)은
**구조적으로 비어 있다** — 아래가 그 이유다.

### 🔴🔴🔴 Q1 — 「SAME 이면 비교 가능한가」는 **질문이 성립하지 않는다**

```
system SAME **6/6 전부 COMPARABLE** 이고 그것은 우연이 아니다 —
`priceTierFromLink` 는 `matchTruth` 의 **1:1 함수** 이고 `matchTruth` 는 `verdict` 에서 파생된다
⟹ 🔴🔴 **Comparability 가 Identity 의 «파생값» 이고 독립 축이 아니다**
⟹ 🔴 「세트 ↔ 단품」·「동일 모델 다른 구성」을 가를 **술어가 코드에 없다**(8축에 0)
```

### 🟢 Q2 — 운영은 DIFFERENT 를 가격 축에 **넣지 않는다**

```
system DIFFERENT ∧ COMPARABLE = **0** · 🟢 **human DIFFERENT ∧ 국내 가격 자격 = 0**
```

### 🔴🔴 Q3 — UNDETERMINED 15 중 **11 이 COMPARABLE** 이다

```
그중 **human DIFFERENT 4건** 이 들어 있다 ⟹ WU-123/125 가 지적한 **그 모양** 이다
  (`PRESUMED_SAME` → matchTruth `TEXT_CONFIRMED` → tier **COMPARISON**)
🔴 **CTO 가 승격하지 않았다** — 「현재 운영이 그렇게 한다」는 **관측** 이다
```

### 🔴🔴 국내 가격 형성대는 이 분모에서 **만들어지지 않는다**

```
국내 자격 **1/26**(KRW 83,600) ⟹ `buildPriceGuide` 에서 **SINGLE** 이고
「가격대」가 아니다(WU-139 계약) ⟹ 🔴 sellability · 권장 판매가격까지는 **연결 측정 불가**
```

### 🔴 측정불가 · 하니스 결함

```
🔴 세트/구성 축 — `bornyesterdaykids` 행이 이 GT 에 **0건** 이고 운영에 그 술어가 **없다**
🔴 하니스 둘 — ⒜ `classifyCandidateMarket` owner 를 crawler 로 추측(**실제 apps/admin**)
   ⒝ 입력 모양을 `price` 로 추측(**실제 `currency`·`isRegisteredDomesticShop`·`marketEvidence`**)
   🟢 둘 다 타입에서 읽어 고쳤다. 🔴 `isRegisteredDomesticShop` 은 **false** —
      등록부를 못 읽는 하니스에서 true 를 넣으면 **KR 을 «만들어» 측정이 거짓이 된다**
🟢 회귀 697 files / **9,329 passed · 0 failed · 144 skipped** · typecheck 0 · build exit 0
작업트리 clean · origin/main **0 / 0** · 🔴 Deploy 없음
```

### 🟡 CPO 판정 대기 — 이번에 올리는 것은 **구조 사실** 하나다

```
🔴 **A/B 를 분리하려면 «새 축» 이 필요하다** — 현재 `priceTier` 는 Identity 의 파생이라
   그 안에서 「동일상품이지만 가격 비교 부적합」을 **표현할 자리가 없다**
🟡 선택지 — ⒜ Comparability 를 **별도 필드로 신설**(세트/구성/옵션 축이 필요하고 그것은
   **새 Evidence** 다) ⒝ 현재 구조를 유지하고 **UNDETERMINED∧COMPARABLE 11건** 을 먼저 좁힌다
   (그 11 안에 human DIFFERENT 4 가 있다 · WU-123/125 의 최소안이 그 자리다)
🔴 **CTO 가 고르지 않았다.** ⒝ 는 **가격 집계 변경** 이라 §00-B 보류에 걸린다
```

**STOP — CORE-MI-COMP-01 Comparability 측정 완료 / CPO 판정 대기**

---

## 9-V. 🟡 **CORE-DESC-REVIEW — 상세설명 증거 조서**(CEO 확인 대기 · 운영 **0**)

🔴🔴 **Comparability 구현을 «멈췄다»**(CPO 정정) — 「데이터에 맞춰 전략을 바꾸는 게 아니라
**CEO 가 실제 상품에서 확인한 Evidence 를 기준으로** 데이터를 제대로 추출하게 만든다」.
🔴 운영 변경 **0** · 판정 **0** · 추출기 수정 **0** · 새 축 **0**.

### 🟡🟡 CEO Action — **딱 1회**

```
https://claude.ai/code/artifact/c25d189e-ab42-42ba-8040-655e49b7dd7c
(사본: docs/core-desc-evidence-review.html · 자립형 60KB)
대상 **11건** — C27 · C05 · C06 · C19 · C20 · C50 · S1-5 · S1-6 · C22 · C42 · C25
```

사건마다 **상세설명 전문이 원상품 ↔ 후보 나란히** 있고, 묻는 것은 여섯이다:

```
① 브랜드 ② 품번 ③ 상품 형태 ④ 색상·소재 ⑤ 세트/구성 을 **상세설명만으로** 알 수 있는가
🔴 ⑥ **동일상품이라고 판단되는 «결정적 문구» 가 어디에 있는가**(그 문장을 알려 주십시오)
```

### 🔴🔴 화면에 «한계» 를 먼저 적었다 — 이것이 이 작업의 핵심이다

```
⒜ **현재 BRAND 추출기는 상세설명을 읽지 않는다**(SPRINT-08 코드 추적) ⟹
   SPRINT-10 의 「설명에서 브랜드 0/22」는 **효과 0 이 아니라 읽는 경로가 없다는 뜻** 이다
⒝ **형태·색상·소재·세트 구성도 상세설명에서 추출하는 경로가 0** 이다 ⟹
   빈 칸을 「그 상품에 없다」로 읽지 않는다
⒞ 🔴 CPO 가 지목한 **biskuit · luxboy · bornyesterdaykids 는 이 묶음에 없다**
   (SPRINT-09 실측) — 화면에 **명시** 했다. 「없는 것」을 조용히 빼면 분모를 잘못 읽는다
```

### 증거

```
🟢 후보 상세설명 공급 **10/11** · 원상품 **11/11** · 빈 칸 1(그 1칸도 「못 읽었다」로 표시)
🔴 **CTO 는 판정을 한 칸도 채우지 않았다** — 계약으로 단언(`judgedByCto`/`"ceo":` 부재)
🟢 라이브 재수집(HTTP 15) · 실패 시 저장 스냅샷으로 내려가고 **어느 쪽인지 카드에 적는다**
🟢 번호 ①→⑥ 은 **CPO 가 고정한 Evidence 사슬** 이고 후보 쪽 빈 행은 **줄을 그어** 표시한다
   ⟹ 사슬이 어디서 끊기는지 한눈에 보인다(11/11 사건에서 발화 · 실측)
🟢 회귀 697 files / **9,329 passed · 0 failed · 145 skipped** · typecheck 0
작업트리 clean · origin/main **0 / 0** · 🔴 Deploy 없음(운영 코드 0)
```

### 🔵 다음 — **CEO 답을 받은 뒤에** 설계한다

```
🟡 CEO 가 「상세설명에 브랜드·품번·특징이 다 있다」고 하면 ⟹
   **Description Parser → Structured Evidence → 기존 Identity** 를 만든다
   🔴 새 DESCRIPTION 축을 더하는 것이 **아니다** — 설명문을 **기존 칸으로 분해 공급** 한다
🔴 **CTO 가 먼저 시작하지 않는다.** 그리고 Comparability 는 그 뒤다
```

### 🟢🟢 **입력 보강**(CEO 지적 반영 · 운영 0)

🔴🔴 1차 조서는 **질문만 있고 답할 자리가 없었다** — CEO 지적이 맞았다. 붙인 것:

```
① 사건마다 선택 입력 **18개** — 다섯 문항 × 예/아니오/모름 **+ 최종 판정**
② 🔴 **⑥ 결정적 문구는 «자유 입력»** — 선택지로 대신할 수 없는 질문이다
③ 🟢🟢 **「선택한 문장 담기」** — 상세설명에서 **드래그한 문장을 그대로** 담는다
   🔴 **그 사건 카드 «안» 에서 고른 것만** 받는다(다른 사건 문장이 섞이면 증거 오염)
④ **적는 즉시 저장** · 다시 열면 복원 ⟹ 11건을 한 번에 안 보셔도 된다
⑤ 하단 고정 바 — 진행 수 + **「답변 복사」**(JSON)
   🔴 자동 복사가 막히면 **블록을 띄워 선택해 둔다**(권한/CSP 로 답이 갇히지 않게)
```

🔴 **localStorage 근거** — 이것은 **검증용 artifact** 다. §12 금지 계약은 운영 패널
(`DomesticPriceIntelligencePanel` 의 transient 참고가격)에 대한 것이고 이 화면이 아니다.
🟢 그 칸은 **여기서 한 글자도 읽지 않는다**.

```
🟢 입력 계약 **7건** — 라디오 **198**(=11×18) · textarea **11** · 「문장 담기」 **11** ·
   저장/복사/진행/대체경로 존재 · 사건 식별자가 입력 이름에 들어간다
🟢 음성대조 — D1(자유 입력 제거) **1 FAIL** · D3(문장 담기 제거) **1 FAIL** → **바이트 복구**
🔴 D2(저장 제거)는 **치환이 적용되지 않아 미검증** 이다 — 그 회차의 FAIL 을
   **계약 발화로 세지 않는다**(적용 확인 없는 변이는 증거가 아니다)
🔴 또 **백틱 중첩으로 transform 이 깨졌다 — 이 트랙 세 번째** ·
   🟢 script 블록에 「backtick 쓰지 않는다」를 주석으로 박았다
```

**STOP — CORE-DESC-REVIEW 조서 게시 + 입력 보강 완료 / CEO 답변 1회 대기**

---

## 9-W. 🟢🟢 **CEO 조서 11/11 수신 · GT 고정**(2026-10-27 · 운영 **0**)

🔴 fixture `fixtures/core-desc-review-ceo-gt.json` — **CEO 답을 그대로** 담았다
(CTO 가 해석해 고치지 않았고 **미응답도 미응답으로** 남겼다 · 키는 **사건 id**).

### 🔴🔴🔴 CPO 가 Sprint 를 쓰기 **전**에 알아야 할 정정 하나 — **C06 이 뒤집혔다**

```
C06(global.trenbe.com)  기존 GT **DIFFERENT** → 이번 조서 **SAME**
🔴 §12 는 그 건을 「현행 **False EXACT** 1건 · precision 11/12」로 적고 WU-060 이
   원인까지 확정했다 ⟹ 🔴 **그 「False EXACT」는 사실이 아니다**
🟢 운영 판정이 **SAME** 이고 CEO 도 SAME 이므로 **그 판정이 옳았다**
⟹ 🔴🔴 **FP 2 → 1 · SAME 회복 5/17 → 6/18**(운영 판정 불변 · 라벨만 반영)
   **SPRINT-07 · 09 · 10 이 쓴 FP 분모 2 가 1 로 바뀐다** — 낡은 분모로 설계하면 틀린다
🟢 C06 의 품번은 **unavailable** ⟹ **품번 없이 올바른 SAME** 이 실증됐다
🟢 나머지 10건은 기존 GT 와 **전부 일치**(뒤집힘 1건뿐)
```

### 🔴🔴 핵심 — 상세설명 Evidence 가 **충분해도** DIFFERENT 가 나온다

브랜드·품번·형태·색상소재를 **전부** 얻은 사건 **8건** 중 CEO 판정 **DIFFERENT 6건**:

| 건 | CEO 가 적은 이유 |
|---|---|
| C50 | 「전혀 다른 제품이지만 상세설명에 정보가 다 있다」 |
| C19 · C20 | 「품번이 동일하나 다른 제품 / 컬러가 다르다 — **이미지 확인** 해야 한다」 |
| C25 | 「동일제품 그러나 컬러가 다름」 |
| S1-5 · S1-6 | 「동일 디자인이나 **긴팔 ↔ 반팔**」 |

⟹ 🔴 **「DESCRIPTION 점수 하나를 SAME 에 더하는」 설계는 성립하지 않는다**(계약으로 단언).

### 🟢 그 밖에 확정된 것 셋

```
🟢 **품번은 필수조건이 아니다** — 설명에서 품번을 못 얻었는데 SAME 인 사건 **2건**(C27 · C42)
🔴 **CEO 가 「이미지 확인 필요」라 직접 적은 사건 3건** — C22 · C19 · C20
   ⟹ 🟢 「IMAGE 는 마지막 검증층」이 **육안으로도 확인됐다**. 그 3건이 **다음 단계의 분모** 다
🔴 **C27 은 상세설명이 아니라 «상품명» 에 브랜드·품번이 있었다**(설명 기준 둘 다 no)
   ⟹ 🔴 Evidence source 는 **TITLE 과 DESCRIPTION 을 따로** 봐야 한다
🔴 미응답 **1칸** — `S1-5.set`. 「아니오」로 바꾸지 않았다
```

### 🟢🟢 내가 전에 만든 계약이 이 fixture 추가를 **잡았다**

```
`core-same06` 의 「fixture 를 전수 훑고 **미분류가 있으면 FAIL**」이 발화했다.
🟢 조용히 빼지 않고 **등록 + 한계 명시** 했다 — 이 조서는 **URL 키가 없어**
   그 URL 단위 검색의 분모에 **들어갈 수 없다**(키가 사건 id 다).
```

### 증거

```
🟢 계약 **4**(고정 · 대조 · 재계산 · 핵심) · 회귀 698 files / **9,333 passed · 0 failed** ·
   typecheck **0** · 운영 변경 **0** · 작업트리 clean · origin/main **0 / 0**
```

### 🔵 다음 — **CPO 가 Sprint 를 쓴다**(CTO 선제 구현 **0**)

```
🟡 CPO 가 닫은 GO 넷 — ① 상세설명은 충분한 Evidence source ② 구조화 추출 ③ BRAND+CODE 는
   단독 결정자가 아니다 ④ 텍스트가 충돌하면 **IMAGE 가 마지막 검증층**
🔴 그리고 CPO 가 명시했다 — 「CTO 에 새 구현을 던지기보다 **전체 구현 Sprint 를 한 번에 작성**」
   ⟹ 🔴 **CTO 는 시작하지 않는다.** 이번 회차에 한 것은 **GT 고정과 분모 정정** 뿐이다
🔴 그 Sprint 는 **FP 1**(2 가 아니다)을 기준선으로 써야 한다
```

**STOP — CEO 조서 11/11 고정 완료 / `DESCRIPTION → Structured Evidence` 구현 Sprint CPO 작성 대기**

---

## 9-X. 🔴🔴 **기준선 정정을 «코드에» 반영**(2026-10-27 · 운영 변경 **0**)

🔴 `CORE-DESC-EVIDENCE-01` 의 **구현 전 선행 작업** 이다. 🔴 운영 변경 **0** · matcher **0** ·
threshold **0**. 바뀐 것은 **GT 라벨 한 건과 그 기준선** 이다.

### 🟢 C06 재라벨을 코드에 반영 — `core-same05-gt.ts` 의 `CEO_RELABEL`

```
🔴 **원본 fixture 를 고치지 않았다**(`wu-059-gt-facts.json` 은 역사 기록 · CPO: 「이전
   Sprint 의 FP 2 는 **역사적 측정값으로만** 취급」)
🟢 나중 라벨을 **위에 얹고** 출처를 `src` 에 잇는다(`wu-059+desc-review`) —
   어느 조서가 덮었는지 **추적 가능** 하다
```

### 🔴🔴🔴 **CPO 기준선 숫자 둘이 틀렸고 실측으로 정정했다**

| | CPO 가 적은 값 | 🟢 실측 |
|---|---:|---:|
| GT 총 | 33 | 33 ✅ |
| Human SAME | 18 | 18 ✅ |
| **Human DIFFERENT** | 10 | **9** 🔴 정정 |
| **Human UNCERTAIN** | 5 | **6** 🔴 정정 |
| FP | 1 | 1 ✅ |
| SAME 회복 | — | **6/18** |

🔴 산술이 그렇다 — C06 이 DIFFERENT → SAME 이므로 **DIFFERENT 가 1 줄고 UNCERTAIN 은
변하지 않는다**. **18 + 9 + 6 = 33**.
🟢 `SAME05_BASELINE` 상수를 신설했다 — 하니스가 각자 리터럴로 적으면 기준선이 바뀔 때
**조용히 낡는다**(이번에 실제로 8개 파일이 그랬다).

### 🟢🟢 낡은 기준선을 쓰던 곳 **전수** 가 FAIL 로 드러났다 — 8 파일 / 12 단언

```
core-same05-gt-baseline · core-same05-counterfactual · core-same07-criteria-survey ·
core-sprint02-step456-matrix · core-sprint07-evidence-utility · core-sprint08-brand-evidence ·
core-sprint02-brandname-separability · core-desc-review-gt
🟢 **의도된 발화** 이고 숨기지 않고 전부 갱신했다
```

### 🔴🔴 CPO 의 SPRINT-02 전제도 바뀌었다

```
「Brand + 제품명 12건 = SAME **9** / DIFFERENT **3**」  →  **SAME 10 / DIFFERENT 2**
   (C06 이 그 집합에 있었다)
그 집합의 누출도 **C06+S1-6 둘 → S1-6 하나** 다(baseline FP 1 과 일치)
⟹ 🔴 **「C06 이 FP 다」를 쓰는 서술은 전부 낡았다**
```

🟢 `core-desc-review-gt` 의 두 단언은 **방향을 뒤집어** 갱신했다 — 「뒤집힘이 있다」에서
**「이제 뒤집힘이 0 이다(= 정정이 반영됐다)」** 로. 🔴 그 단언이 깨지면 **GT 소스와 조서가
어긋난 것** 이다(둘 중 하나가 낡았다).

### 증거

```
🟢 회귀 698 files / **9,333 passed · 0 failed · 145 skipped** · typecheck **0** · build exit **0**
운영 변경 **0** · 작업트리 clean · origin/main **0 / 0** · 🔴 Deploy 없음
```

### 🔵 다음 — `CORE-DESC-EVIDENCE-01` **구현**(기준선이 이제 코드에 있다)

```
🟡 CPO 가 §6 에 범위를, §7 에 성공기준 10개를 이미 고정했다 ⟹ **조사 없이 구현부터** 간다
🔴 기준선은 **GT 33 / SAME 18 / DIFFERENT 9 / UNCERTAIN 6 / FP 1 / SAME 회복 6/18**
🔴 이미지 검증 분모는 **C22 · C19 · C20 = 3건**(CEO 가 직접 「이미지 확인 필요」라 적었다)
🔴 guardrail — **Evidence 가 늘었다는 이유만으로 SAME 이 늘어나는 것을 성공으로 보지 않는다**
🔴 §4-C 용량 판단 — 이 Sprint 는 `ProductFacts` provenance 계약 + 추출기 6 + matcher 연결 +
   계약/음성대조/회귀 다. **한 세션에 끝까지 가지 못하면** 안전 종료 지점까지 가고 clean handoff
```

**STOP — 기준선 정정 완료 / `CORE-DESC-EVIDENCE-01` 구현 착수 가능**

---

## 9-Y. 🔵🔵🔵 **`CORE-DESC-EVIDENCE-01` 착수점 — 조사하지 말고 «구현부터» 간다**

🔴🔴 **다음 세션은 이 절만 읽고 바로 코드를 쓴다.** 조사·설계는 **끝났다**(§9-S ~ §9-X).
🔴 §4-C — 이 Sprint 는 **한 덩어리** 다: 계약 → 추출기 → provenance → matcher 연결 →
변이 → 회귀 → 보고 **1회**. **중간 보고 금지.**

### 전략 좌표 — 이 Sprint 가 **어디** 인가

```
SOURCE → **[ Evidence Layer ]** → Identity → Comparability → Domestic Price
       → Sellability → Price A/B → Registration
🔴 이번은 **Evidence Layer «만»** 이다. matcher 를 똑똑하게 만드는 Sprint 가 **아니다**.
```

### 🔴 절대 변경 금지 (CPO §2 전수)

```
Identity      SAME/DIFFERENT/UNDETERMINED 정책 · **MATCHING-3.1** · SAME threshold ·
              PRESUMED_SAME · MODEL_CODE conflict 보호 · `brand+modelCode → SAME` ·
              same-seller conditional shortcut · 기존 blocker 정책
Comparability `DomesticPriceTier` · EXACT/COMPARISON/REFERENCE/EXCLUDED ·
              `priceTierFromLink` · `matchTruth` · 국내 가격 집계 · `buildPriceGuide`
Price         Price A · Price B · 권장 판매가격 식 · 국내 참고가격 표시 정책
UI            seller UI · 가격 입력 · 등록 · 기존 운영 패널
Image         scoring · matcher · threshold · 자동판정 — **이번 Sprint 에 0**
```

### 🔴 기준선 — **코드에 있다**(`SAME05_BASELINE` · `core-same05-gt.ts`)

```
GT 33 · Human SAME **18** · DIFFERENT **9** · UNCERTAIN **6** · FP **1** · SAME 회복 **6/18**
🔴 과거의 `FP 2 / DIFFERENT 10 / UNCERTAIN 5` 는 **역사적 측정값** 이다 — 기준선이 아니다
🔴 하니스는 **그 상수를 import** 한다(리터럴로 적으면 조용히 낡는다 · 8파일 선례)
```

### 구현 순서 (그대로 따른다)

```
① `ProductFacts` 에 **provenance 를 담을 자리** — 🔴 optional 로(breaking change 0)
   목표 모양 — `{ value, source }` · source ∈ { TITLE, DESCRIPTION } · 확장 가능하게
   🔴 **기존 칸(brand/brandModelCode/…)의 타입을 바꾸지 않는다** — 옆에 둔다
② DESCRIPTION 추출기 — BRAND · MODEL_CODE · PRODUCT_NAME · FORM/CATEGORY · COLOR · MATERIAL
   🟢 **MODEL_CODE 는 `recoverModelCodeFromDetail` 을 그대로 재사용**(Contract A~G 유지)
   🟡 FIT · COMPOSITION · SET · OPTION/SKU 는 **추출 가능성만 측정** — matcher 축 승격 **0**
③ TITLE 추출기를 **별도 source 로** — 🔴 C27 이 그 이유다(설명엔 없고 **상품명에** 있었다)
④ matcher 연결은 **마지막에만** — 그리고 「Evidence 증가 ≠ SAME 증가」를 보고에 적는다
```

### 🔴 parser 가 읽어야 하는 실제 표현 (CEO 조서 원문에서 왔다)

```
BRAND        「Brand : BOBO CHOSES」 · 「Bobo Choses」 · 「브랜드 : 보보쇼즈」
MODEL_CODE   「B226AC009」 · 「26FW B226AC009」 · 「SKU : 26FW B226AC009」
PRODUCT_NAME 「Product Name : Bobo Choses Kids Hug Hairy Monster Long Sleeve T-Shirt」
FORM         「T-shirt」 · 「Long Sleeve T-Shirt」 · 「Sweatshirt」
COLOR        「Light Blue」 · 「Conker Stripe」
MATERIAL     「100% Organic Cotton」 · 「Cotton」
```

### 🔴🔴 반드시 보호할 CEO GT 반례 (fixture `core-desc-review-ceo-gt.json` 11건)

| 건 | 지켜야 하는 것 |
|---|---|
| **C06** | 품번 `unavailable` 인데 **SAME** — 품번 없이 올바른 SAME 이 가능하다 |
| **C27** | **TITLE** 에 브랜드·품번(설명엔 없다) → SAME — **source 분리의 이유** |
| **C42** | 품번 **없음** → SAME — 품번 필수화 **금지** |
| **C19 · C20 · C22** | 강한 text evidence 인데 **DIFFERENT** → **IMAGE 필요**(다음 Sprint 분모) |
| **C50** | BRAND+CODE+FORM+COLOR/MAT 전부 있는데 **DIFFERENT** — **score 기반 SAME 금지** |
| **C25** | 동일 디자인 · 컬러 차이 → DIFFERENT — Identity ↔ Comparability 혼합 금지 |
| **S1-5 · S1-6** | 동일 디자인 · **긴팔↔반팔** → DIFFERENT — 형태/구성 Evidence 의 근거 |

🔴 `S1-5.set` 은 **CEO 미응답** 이다 — `yes`/`no` 로 **채우지 않는다**(계약이 그것을 잠근다).

### 🔴 변이 M1~M6 (CPO §12 — 「잘못된 shortcut 을 넣으면 반드시 잡힌다」)

```
M1 DESCRIPTION 추출 배선 제거      → 관련 계약 FAIL
M2 TITLE source 제거               → **C27** 계약 FAIL
M3 설명문 MODEL_CODE recovery 제거 → description-code 계약 FAIL
M4 provenance 제거                 → source 계약 FAIL
M5 description score → SAME 삽입   → **금지 계약** FAIL
M6 brand+modelCode → SAME 삽입     → **C19/C20/C22/C50** 반례 계약 FAIL
🔴 변이는 **Edit 로** 적용하고 **`grep -c` 로 적용을 확인** 한다(이 트랙에서 네 번 틀렸다)
🔴 템플릿 리터럴 안에 **backtick 을 쓰지 않는다**(세 번 transform 이 깨졌다)
```

### 회귀 기준선

```
698 files / **9,333 passed** / 0 failed / 145 skipped · typecheck **0** · build **0**
🔴 파일 수·skip 수가 달라지면 **이유를 보고** 한다
```

### 🔴 STOP 조건 (하나라도 나오면 확장하지 말고 보고)

```
기존 field 의미 변경 필요 · MODEL_CODE shortcut 요구 · threshold 변경 필요 ·
MATCHING-3.1 수정 필요 · **C06 이 다시 DIFFERENT** · C19/C20/C22/C50 이 text 만으로 SAME ·
TITLE provenance 소실 · DESCRIPTION provenance 소실 · price/comparability 변경 필요 ·
IMAGE 구현 필요 · **테스트를 약화해야 통과**
```

### 🔴🔴 성공 정의 — **SAME 을 늘리는 것이 아니다**

> 상품 원문의 정보를 **TITLE 과 DESCRIPTION 에서 구조화 Evidence 로 보존** 하고,
> 그 **출처를 추적 가능** 하게 만들면서, 기존 Identity/Comparability/Price 전략을
> **한 글자도 훼손하지 않는 것**.

🔴 **Evidence 가 늘었다는 이유만으로 SAME 이 늘어나면 그것은 실패다.**

### 🔵 이 Sprint 뒤 — **IMAGE**(C22 · C19 · C20 3건으로만)

```
Text Evidence 충분 → Identity        Text Evidence 충돌/애매 → **IMAGE 검증**
🔴 이번 Sprint 에서 IMAGE 는 **구현하지 않는다**
```

**STOP — `CORE-DESC-EVIDENCE-01` 착수점 고정 완료 / 다음 세션이 조사 없이 구현 시작**

---

## 9-Z. 🟢🟢 **`CORE-DESC-EVIDENCE-01` — Evidence Layer 구현·배포 완료**(2026-10-27)

🔴🔴 **성공 정의를 먼저 적는다 — 「SAME 을 늘린 것」이 아니다.**
원문의 사실을 **TITLE / DESCRIPTION 두 출처로 갈라** 보존하고, 기존 Identity ·
Comparability · Price 를 **한 글자도 건드리지 않은 것** 이 성공이다.
🟢 **matcher verdict / tier 변화 = 0**(저장 GT 33 전수 계약 + 라이브 26건 실측).

```
① `ProductFacts.evidence?` **optional** 추가 — 기존 칸 타입/의미 변경 **0**(계약 P1~P4)
   `EvidenceItem { value, source }` · source ∈ { TITLE, DESCRIPTION } · 축마다 **배열**
   🔴 배열인 이유 — 같은 축을 두 원문이 말하면 하나만 남길 때 **출처가 사라진다**
② 추출기 `product-evidence.ts` — Identity 6축(BRAND · MODEL_CODE · PRODUCT_NAME ·
   FORM · COLOR · MATERIAL) + 🟡 **관측 전용 4축**(FIT · COMPOSITION · SET · OPTION_SKU)
   🟢 **기존 owner 재사용** — `extractDetailModelCodes` · `resolveGarmentForms` ·
      `parseMaterialComposition` · `extractColor*` · `extractFitPhrase` · 등록부 alias
   🔴 **새로 쓴 것은 「라벨이 붙은 값」 읽기뿐**(조서 원문 `Brand :` · `Color :` · `SKU :`)
③ 운영 배선 **2경로**(Shopify :338 · HTML :504) — `attachProductEvidence(recover…)`
   🔴 개수(=2)로 계약을 걸었다 — 한 경로만 배선하면 비-Shopify 에서 조용히 사라진다
```

### 🟢 라이브 coverage(운영 `factsFromProductUrl` · GT 33 → **facts 26** · 🔴 제외 7)

| 축 | 전체 | TITLE | DESCRIPTION | 🔴 DESCRIPTION 에서만 |
|---|---:|---:|---:|---|
| BRAND | 2/26 (7.7%) | 1 | 1 | **1** (C06) |
| MODEL_CODE | 9/26 (34.6%) | 3 | 7 | **6** |
| PRODUCT_NAME | 26/26 (100%) | 26 | 1 | 0 |
| FORM | 21/26 (80.8%) | 20 | 17 | **1** |
| COLOR | 15/26 (57.7%) | 4 | 14 | **11** |
| MATERIAL | 16/26 (61.5%) | **0** | 16 | **16** |

🟡 관측 전용 — FIT 8/26 · COMPOSITION 16/26 · SET **0/26** · OPTION_SKU 1/26.
🟢 `description` 존재 **22/26 (84.6%)** — SPRINT-10 과 **한 자리도 다르지 않다**(교차 확인).

```
🟢🟢 **두 출처를 가른 것이 값을 한다** — MATERIAL 은 TITLE 에서 **0/26** 이고 전부
   설명문에서만 나온다. COLOR 도 11건이 설명문 전용이다 ⟹ 출처를 뭉갰으면
   「상품명만으로 충분하다」는 **거짓 결론** 이 나왔을 자리다.
🟢 C27 이 운영 경로에서 **그대로 재현됐다** — `beaumonde.co.kr` · description **없음** ·
   BRAND:TITLE + MODEL_CODE:TITLE ⟹ 「설명엔 없고 상품명에 있다」가 **표현 가능해졌다**
🔴 BRAND 2/26 은 **등록부 alias 의 한계** 다 — 「보보쇼즈」는 걸리고 영문 「Bobo Choses」는
   alias 에 **없다**. 🔴 「description 에서 brand 를 못 읽는다」로 적지 않는다 —
   **사전 확대가 SPRINT-08 HOLD** 라 열지 않았다(발화 조건 미충족 · 측정불가)
🔴 C22 의 `#AW26MS185` 는 **승인 품번 패턴 밖** 이라 읽지 않았다(새 패턴 = CPO 판정)
```

### 🔴 변이 M1~M6 — 전부 FAIL → 바이트 복구(적용은 `grep -c` 로 확인)

```
M1 DESCRIPTION 추출 배선 제거      **5 FAIL**
M2 TITLE source 제거               **3 FAIL**
M3 설명문 MODEL_CODE recovery 제거 **1 FAIL**
M4 provenance 제거(출처 단일화)     **4 FAIL**
M5 description rich → SAME         🔴 **1차 0 FAIL** → 계약 보강 후 **1 FAIL**
M6 brand + modelCode → SAME        **2 FAIL** (C19 · C20)
```

🔴🔴 **M5 가 1차에 뚫렸고 그 이유를 적는다** — 내 계약 쌍이 **형태 충돌** 이라
`cross-seller.ts:895` 에서 **조기 반환** 됐고, 점수 자리에 넣은 shortcut 이 **실행조차
되지 않았다**. 🟢 「충돌이 없어 점수 로직까지 가는」 쌍(계약 7-b2)을 더해 잠갔다.
🔴 이 트랙이 네 번째 겪는 **「단언 좌표가 틀렸다」** 다.

🔴 **내가 틀린 것 하나 더** — 계약 8-b 를 「관측 전용 축 이름이 비교 모듈에 없다」로
썼다가 FAIL 했다. `FIT`·`COMPOSITION`·`SET` 은 **이 Sprint 이전부터** `cross-seller.ts`
에 있던 축 이름이다(실측 5·2·1) ⟹ 🟢 **코드가 맞고 내 단언이 틀렸다.** 이름을 옮기지
않고(같은 개념을 가리킨다) **승격 «경로»**(import)를 잠그는 쪽으로 고쳤다.

### 증거

```
계약 신규 **27**(순수 · 네트워크 0) · 라이브 측정 1(env `CORE_DESC_EVIDENCE_LIVE=1`)
회귀 **699 files / 9,360 passed / 0 failed / 146 skipped**(기준선 698/9,333/145 대비
     +1 file · +27 tests · +1 skip — **전부 이 WU 산출물로 설명된다**)
typecheck **0** · build exit **0** · 운영 파일 **3**(shared 1 · crawler 2)
🔴 matcher · threshold · MATCHING-3.1 · priceTier · domesticReference · 국내가격 ·
   A/B 가격 · 셀러 UI · IMAGE — **전부 변경 0**
```

### 🔴 다음(CPO 판정 · CTO 가 고르지 않았다)

```
⒜ Evidence 를 **Comparability** 축으로 넘길 것인가(🔴 Identity 와 합치지 않는다)
⒝ **IMAGE** — C19 · C20 · C22 셋이 「text 는 완비인데 DIFFERENT」 분모다
⒞ BRAND alias 확대(🔴 SPRINT-08 HOLD 해제 사안) — 지금은 2/26 이 그 한계다
```

**STOP — `CORE-DESC-EVIDENCE-01` 구현·검증·배포 완료 / 다음 범위 CPO 지정**

---

## 9-AA. 🟢🟢 **`CORE-IMAGE-EVIDENCE-01` — 이미지 Evidence 실현 가능성 = GO**(2026-10-27)

🔴🔴 **image matcher 를 만들지 않았다.** threshold · score · `IMAGE → SAME/DIFFERENT` ·
Comparability · price · priceTier · seller UI · 등록 payload — **전부 변경 0**.
보존한 것은 **대표 이미지 URL 1개** 이고 그 값은 **어떤 판정에도 들어가지 않는다**.

### 🟢 STEP 1 — 공급(운영 `factsFromProductUrl` · 실측)

| 건 | 경로 | imageUrls | 접근 |
|---|---|---:|---|
| 원상품 S4 (Grey Melange) | fixture | 7 | 200 |
| C42 human **SAME** | SHOPIFY_JSON | 6 | 200 |
| C19 DIFFERENT | SHOPIFY_JSON | 6 | 200 |
| C20 DIFFERENT | SHOPIFY_JSON | 8 | 200 |
| C25 DIFFERENT | SHOPIFY_JSON | 5 | 200 |
| **C22** DIFFERENT | **PLAIN_HTML** | 🔴 **0** | — |

🟢 **접근 32/32 (100%)** · 전부 `image/jpeg` · 실패율 **0** · 대표(0번)가 **전건 상품 정면컷**.
🔴 **C22 의 0 은 「페이지에 이미지가 없다」가 아니다** — 페이지에 상품 이미지가 **있고**
(`/shopimages/DONOKIDS/026002000008.jpg` · HTTP 200 · 310KB) **PLAIN_HTML 경로가 수집하지
않는다**(`og:image` 도 0건). 🔴 **고치지 않았다** — 추출기 변경은 이 WU 범위 밖이다.

### 🟢🟢 STEP 2 — 이미지가 **실제로** 차이를 설명한다(CTO 육안 · 🔴 GT 가 아니다)

```
원상품 Grey Melange  회색 + **파란** MAIN STORY MMXVII 프린트
C42  human SAME       **같은 상품**(회색 + 파란 프린트) · 🟢 이미지가 SAME 을 지지한다
C19  DIFFERENT        **보라/크림 가로 줄무늬** · 프린트 없음 ⟹ 한눈에 다른 상품
C20  DIFFERENT        🔴🔴 **네이비 + 노란 프린트**
C25  DIFFERENT        🔴🔴 **네이비 + 노란 프린트**(C20 과 같은 상품)
C22  DIFFERENT        페이지 이미지 = **C19 와 같은 Conker Stripe 줄무늬**
```

🔴🔴🔴 **이 WU 의 가장 중요한 발견 — 텍스트가 «적극적으로» 오해를 유발한다**:
```
「Graystone」은 **회색이 아니라 네이비** 다(C20 · C25 실물 확인).
⟹ COLOR 축이 「Grey Melange」 ↔ 「Graystone」을 글자로 비교하면 **겹쳐 보인다**.
⟹ 🟢 이미지는 그 둘을 **즉시** 가른다(색거리 **156~157**).
🔴 즉 C19/C20/C22 는 「텍스트가 부족한」 사례가 아니라 **「텍스트가 틀리게 비슷한」** 사례다.
```

### 🟢 STEP 3 — 자동화 «가능성» 측정(🔴 도입 결정 아님 · 새 의존성 **0**)

🟢 `sharp@0.34.5` 가 **이미 설치돼 있다**(`packages/image` 의존성) ⟹ 추가 설치 0 으로 실측했다.

| 원상품 대비 | dHash | **dHash(trim)** | aHash(trim) | 색거리 |
|---|---:|---:|---:|---:|
| **C42 (human SAME)** | 26 | 🟢 **3** | 1 | 🟢 **0** |
| C19 DIFFERENT | 14 | **16** | 5 | 33 |
| C20 DIFFERENT | 11 | **17** | 5 | **157** |
| C25 DIFFERENT | 27 | **17** | 5 | **156** |
| C22(페이지) DIFFERENT | 24 | **20** | 5 | 24 |

```
🟢 **trim-dHash 가 깨끗하게 갈린다** — SAME **3** ↔ DIFFERENT **16~20**
🟢 같은 상품 · 다른 판매처 사진  C19 ↔ C22페이지 = trim-dHash **4** · aHash **0**
🟢 같은 색 variant · 다른 판매처 C20 ↔ C25     = trim-dHash **2** · 색거리 **2**
🟢 안정성 0 · 비용 **80ms/장** · 평균 **350KB**
```

🔴🔴 **그런데 전처리가 답을 뒤집는다 — 이것을 먼저 적는다**:
```
**trim 없이** 재면 C42(human SAME)가 **26** 이고 C20(DIFFERENT)이 **11** 이다 ⟹ **역전**.
원인은 판매처마다 **크롭·여백·종횡비** 가 다르기 때문이다
(원상품 1200x1200 ↔ main-story 3333x5000).
⟹ 🔴 「pHash 를 쓰면 된다」가 아니라 **「trim 같은 정규화가 «필수» 다」** 가 측정 결과다.
```

🔴 **dHash 는 회색조** 라 **밝기가 같은 두 색** 은 못 가른다 ⟹ 색거리와 **같이** 써야 한다.
🔴 그리고 이 표본은 **한 상품군(Main Story Bubble Sweatshirt) · SAME쌍 3 · DIFFERENT쌍 4** 다
⟹ 🔴 **임계값을 정하지 않았다**(정할 분모가 아니다).

### 🔴 계약 I1~I6 + 변이

```
I1 IMAGE evidence 가 source 를 잃지 않는다(axis IMAGE · source IMAGE · **대표 1장**)
I2 이미지가 없어도 TITLE/DESCRIPTION 증거 **불변** · 없으면 축 자체가 **없다**(C22 상태)
I3 🟢 추출기에 `fetch`/`http`/`sharp` **0** ⟹ 이미지 접근 실패가 판정에 **닿을 수 없다**
I4 🔴 **이미지 URL 이 완전히 같아도 SAME 이 아니다** · GT 33 전수 verdict/tier **변화 0**
I5 C19 **PRESUMED_SAME** · C20 **PRESUMED_SAME** · C22 **SIMILAR** — 셋 다 **불변**
I6 배선 제거 변이 **5 FAIL** · `IMAGE → SAME` 변이 **1 FAIL** → 바이트 복구
```

🔴 **기존 계약 하나가 FAIL 했고 «의도된 변경» 이라 갱신·강화했다** — `계약 8-c` 가 관측 전용
축을 **개수(4)** 로 세고 있었다(이제 5). 🟢 느슨하게 하지 않고 **구성원 전체를 단언** 하도록
바꿨다 ⟹ 이제 아무 축이나 끼워 넣으면 거기서 잡힌다.

### 증거

```
계약 신규 **19**(I1~I6) · 회귀 **700 files / 9,379 passed / 0 failed / 147 skipped**
(직전 기준선 699/9,360/146 대비 **+1 file · +19 tests · +1 skip** — 전부 이 WU 산출물)
typecheck **0** · build exit **0** · HTTP 33회(read-only) · 운영 파일 **2**
🔴 matcher · threshold · MATCHING-3.1 · priceTier · Comparability · price · UI — **변경 0**
```

### 🔴 STOP 조건 9개 — **하나도 발생하지 않았다**

```
①verdict 변경 0  ②score/threshold 불요  ③shortcut 불요  ④consumer 안 깨짐(optional)
⑤crawler 대규모 변경 불요(단 🟡 C22 는 PLAIN_HTML 수집 보강이 **필요** · 별도 사안)
⑥비용 80ms/350KB — 허용 범위  ⑦판별 **가능** 했다  ⑧false positive 위험은 **전처리**
   에 달려 있다(측정됨 · 임계값 미정)  ⑨price/comparability 변경 0
```

### 🔵 다음(🔴 CTO 가 고르지 않았다 · CPO §16 규칙)

```
GO ⟹ **IMAGE Evidence production integration 설계**
🔴 그 WU 가 반드시 안고 가야 할 측정 결과 셋 —
   ⒜ **정규화(trim)가 없으면 답이 뒤집힌다**
   ⒝ **dHash 단독 금지** — 색거리와 같이 본다
   ⒞ **C22 류(PLAIN_HTML) 공급 보강** 이 없으면 그 경로는 영원히 이미지가 0 이다
🔴 임계값은 **더 큰 분모에서** 정한다 — 이 표본(한 상품군)으로 고정하지 않는다
```

**STOP — `CORE-IMAGE-EVIDENCE-01` 조사 완료 / `IMAGE EVIDENCE = GO` / 다음 범위 CPO 지정**

---

## 9-AB. 🟢🟢 **`CORE-IMAGE-EVIDENCE-02` — 공급 보강 + 정규화 Evidence**(2026-10-27)

🔴🔴 **threshold 를 만들지 않았다.** 저장소 어디에도 「dHash < X → SAME」이 **없다**.
matcher · MATCHING-3.1 · Identity · Comparability · price · priceTier · 추천가 ·
seller UI · AI/embedding — **전부 변경 0**.

### 🟢 A. PLAIN_HTML 이미지 공급 — **C22 가 0 → 1**(운영 경로 실측)

```
원인  htmlPath 가 `productFactsFromListing` 에 **이미지를 한 장도 넘기지 않았다**
해결  `jsonLdProductImages(html)` — 🟢 `description` 과 **같은 JSON-LD 블록** 을 읽는다
      (LD 파서는 **이 파일 하나** · 새 파서 0 · **추가 HTTP 0**)
🔴 `<img>` 태그 ❌  C22 페이지 img **39개** 중 대다수가 **추천상품 썸네일**(`*_represent`)
🔴 `og:image` ❌    C22 에는 **아예 없다**(실측 0건)
🟢 결과  C19 6 · C20 8 · **C22 0 → 1** · C25 5 · C42 6   (운영 `factsFromProductUrl`)
🟢 그 1장이 **C19 와 같은 Conker Stripe** 상품컷이다(CTO 육안 + 정규화 거리 **4**)
```

### 🟢 B. 정규화 — `computeVisualSignature`(`packages/image` · sharp **재사용** · 새 dep 0)

```
orientation(EXIF) → trim → 규격 resize → { rawDHash · normalizedDHash · aHash · color }
🔴 **정규화 전/후를 둘 다** 낸다 — 하나로 합치면 어느 쪽을 보는지 알 수 없다
🔴 digest = `d1:<normalizedDHash>:<r,g,b>` — **binary 를 저장하지 않는다**
🔴 decode 실패는 **던진다**(호출부가 삼킨다 · 0 을 지어내지 않는다)
```

### 🟢 C. control set 재측정 — 01 과 **한 자리도 다르지 않다**

| 원상품 대비 | raw | **normalized** | 색거리 |
|---|---:|---:|---:|
| **C42 human SAME** | 26 | 🟢 **3** | **0** |
| C19 DIFFERENT | 14 | 16 | 33 |
| C20 DIFFERENT | 11 | 17 | **157** |
| C25 DIFFERENT | 27 | 17 | **156** |
| C22 DIFFERENT | 24 | 20 | 24 |

```
🟢 같은 상품·다른 판매처  C19 ↔ C22   raw 18 → **norm 4**
🟢 같은 color variant     C20 ↔ C25   raw 32 → **norm 2**
🟢 정규화 후 SAME **3** < DIFFERENT 최소 **16** ⟹ **분리된다**
🔴🔴 raw 로 재면 C42(SAME) **26** > C20(DIFFERENT) **11** — **여전히 역전한다**
   ⟹ 정규화는 선택이 아니라 **전제** 다
실패 **0/6** · 평균 **350KB** · 🔴 **822 ms/장**(디코드 4패스 — 01 의 80ms 는 1패스였다)
```

🔴 **표본은 한 상품군이다**(SAME쌍 1 · DIFFERENT쌍 4) ⟹ **threshold 를 정하지 않았다.**

### 🔴 계약 I7~I12 + 변이 M7~M10

```
I7  원본 URL 보존 · 대표는 **칸으로** 표시 · digest 는 짧은 문자열(binary 0)
I8  normalized representation 생성   I9  종횡비 달라도 정규화가 **차이를 줄인다**
I10 trim 전/후 분리 · 규격 상수 하나  I11 decode/정규화 실패가 facts 를 안 깨뜨린다
I12 GT 33 verdict·tier **불변** · 🔴 **모든 상품에 같은 digest 를 줘도 SAME 이 아니다**
M7 공급 배선 제거 **1 FAIL** · M8 정규화 제거 **2 FAIL** ·
M9 IMAGE→SAME **3 FAIL** · M10 IMAGE→DIFFERENT **2 FAIL** → 전부 바이트 복구
```

🔴 **기존 계약 하나가 FAIL 했고 «의도된 변경» 이라 갱신·강화했다** — 01 의 `I1-a` 가
`{value, source}` 만 단언하고 있었다(이제 `representative` 까지). 🔴 **단일 파일
실행으로는 안 보였고 전체 회귀가 잡았다** — 그래서 전체 회귀를 생략하지 않는다.

### 🔴 구조 변경 둘(숨기지 않는다)

```
① `apps/admin/vitest.config.ts` 에 **packages/image** 추가 — 그 패키지엔 러너가 없었고
   🔴 **sharp 가 거기에만 설치돼 있어** apps/admin 에서 import 하면 죽는다(실측).
   🟢 config 주석의 기존 원칙(「러너를 또 만들지 않는다」) 그대로 따랐다
② `packages/image` 에 **vitest devDependency** 추가 — crawler·shared·pricing·listing
   **넷 다 이미 그렇게 돼 있다**(이 패키지만 테스트가 없어서 빠져 있었다).
   🔴 AI/embedding 의존성이 **아니다** · lockfile 변경 **4줄**
```

### 증거

```
회귀 **702 files / 9,406 passed / 0 failed / 148 skipped**
(직전 700/9,379/147 대비 **+2 files · +27 tests · +1 skip** — 전부 이 WU 산출물)
typecheck admin **0** · image **0** · build exit **0** · 운영 파일 **4** + 신규 **1**
```

### 🔵 다음(🔴 CTO 가 고르지 않았다)

```
이제 처음으로 「어느 정도의 차이를 SAME/DIFFERENT Evidence 로 볼 것인가」를 검토할 수 있다.
🔴 그때 반드시 안고 가야 할 것 셋 —
   ⒜ **정규화 없이는 순서가 뒤집힌다**(raw 에서 재현됨)
   ⒝ **dHash 단독 금지** — 색을 같이 본다(Grey Melange ↔ Graystone 색거리 157)
   ⒞ **표본이 한 상품군** 이다 — threshold 는 더 큰 분모에서 정한다
🔴 822 ms/장 · 350KB 는 **후보마다 이미지를 받는 설계의 비용** 이다(현재 운영 배선 0)
```

**STOP — `CORE-IMAGE-EVIDENCE-02` 완료 / `IMAGE NORMALIZED EVIDENCE = READY` / 다음은 CPO**

---

## 9-AC. 🟢🟢 **`CORE-FINAL-VISUAL-01` — TEST/QA X-Ray 화면 + 운영 UI 격리**(2026-10-27)

🔴🔴🔴 **운영 파일 변경 «0» 이다.** 이번 WU 의 `git status` 는 **전부 신규 파일** 이었다 —
matcher · MATCHING-3.1 · Identity · Comparability · 국내 참고가격 · 해외 최저 소싱가 ·
MI · 권장 판매가격 · 등록 payload **한 줄도 건드리지 않았다**.

### 🟢 핵심 — **기존 판단을 다시 만들지 않는다**(CPO §2 · §7 · §8)

```
URL        → 기존 `factsFromProductUrl`(운영 경로 그대로)  → 기존 evidence → **설명만**
snapshotId → 기존 `computeMarketIntelligence`(운영 GET 과 **같은 함수**) → **상태만 분류**
⟹ 이 WU 가 «계산» 하는 Identity · 가격 · MI · 권장가가 **하나도 없다**.
```

### 🟢 화면 둘

```
🔵 TEST/QA  `/qa/evidence`  + `POST /api/qa/evidence`(requireUser 그대로)
   ① 기존 판단 결과 — READY / LIMITED / HOLD + **막힌 이유**
   ② 원본(URL · TITLE · DESCRIPTION)   ③ 상품명 구조(BRAND·SEASON·FORM·NAME·CODE·SLEEVE)
   ④ 한/영 의미 분석 · 동의어 묶음      ⑤ 축 10개 Evidence(+ **source** · **recovered**)
   ⑥ IMAGE(개수 · 대표 · 정규화 · digest)  ⑦ **이 화면의 한계**
🔴 운영 화면  내부 Evidence **0** — 격리 계약이 `app/**.tsx` 전수(qa 제외)를 훑어 잠근다
```

### 🔴🔴 가장 중요한 설계 — **동의어가 «차이» 를 지우지 않는다**

```
🟢 같게 읽는다   T-shirt · T shirt · Tee · Tee Shirt · 티셔츠   (기존 어휘 owner 그대로)
🔴 갈라서 읽는다 Long Sleeve ≠ Short Sleeve · T-shirt ≠ Sweatshirt · Top ≠ SHIRT
🔴🔴 **소매 길이를 보는 판정 축은 이 저장소에 «없다»**(WU-124 확정) ⟹ 화면은 그것을
   **관측값** 으로 적고 **「판정 축 아님」을 같이 적는다**. S1-5·S1-6(긴팔↔반팔 DIFFERENT)이
   왜 텍스트로 안 갈리는지를 CEO 가 화면에서 바로 본다.
🔴 그리고 **셔츠↔티셔츠를 같게 읽는 기존 정책** 도 화면이 숨기지 않고 적는다.
```

### 🔴 HOLD 는 «이유» 없이 만들지 않는다 (CPO §9 · §12)

```
READY    전 단계가 기존 값을 냈다
LIMITED  PRESUMED_SAME 등 **기존 정책상 제한된 상태**
HOLD     기존 파이프라인이 값을 내지 못했다 — 🔴 **그 사유를 반드시 적는다**
⟹ CASE A(사람도 못 함 · 수정 안 함) ↔ CASE B(사람은 함 · 개선 대상)를 **가를 수 있다**
```

### 증거 — 계약 **28**(L1~L10 + 격리 3 + READY/HOLD 5 + 마운트 DOM 2)

```
L1 synonym 표시 🟢   L2 한/영 분석 🟢   L3 T-shirt/Sweatshirt/Top 과동일화 금지 🟢
L4 긴팔/반팔 구분 🟢(원문이 안 말하면 **null** — 지어내지 않는다)
L5 TITLE/DESCRIPTION 출처 유지 🟢 + **recovered 품번 구분** 🟢
L6 기존 DESCRIPTION 추출 불변 🟢   L7 IMAGE 표시 🟢
L8 설명기 ↔ matcher **양방향 import 0** · GT 33 verdict/tier **불변** 🟢
L9 C19·C20·C22·C50 SAME 아님 🟢    L10 C06·C27·C42 + 기준선 불변 🟢
격리 운영 `.tsx` 전수에서 QA 모듈·내부 어휘 **0**  ·  QA 화면에서는 **보인다**(삭제 아님)
🟢 마운트 DOM 2건 — 소스 문자열이 아니라 **실제 렌더** 로 확인(헌장 §5)
회귀 **703 files / 9,434 passed / 0 failed / 148 skipped**(직전 702/9,406/148 대비
**+1 file · +28 tests**) · typecheck **0** · build **0**(`/qa/evidence` · `/api/qa/evidence` 생성 확인)
```

🔴 **내 단언이 또 한 번 틀렸고 적는다** — 격리 금지어에 `provenance` 를 넣었더니
`AIContentPanel.tsx` 가 FAIL 했다. 그 파일의 `ProvenanceBadge` 는 **이 Sprint 이전부터
있던 「AI 콘텐츠 출처」 배지** 이고 Evidence provenance 와 **다른 개념** 이다 ⟹ 🟢 코드가
맞고 단언이 틀렸다. 금지어를 **이 Sprint 의 식별자** 로 좁혔다(느슨하게가 아니라 정확하게).

### 🔵🔵 CEO Action — 배포된 TEST 화면에서 실제 상품 확인

```
https://ttaejyo.vercel.app/qa/evidence   (로그인 필요)
① 상품 URL 을 넣는다 → 시스템이 **무엇을 읽었는지** 를 본다
② 스냅샷 ID 를 넣으면 **기존 판단**(Identity · 국내가 · 해외가 · MI · 권장가)과
   READY/LIMITED/HOLD + **막힌 이유** 가 같이 나온다
🔴 확인할 것 — 상품명/상세정보/브랜드/품번을 제대로 읽었는가 · 한글↔영문이 맞는가 ·
   긴팔↔반팔이 유지되는가 · 색상/소재/형태 · 이미지 · **최종 판단이 실제 상품과 맞는가**
🔴 문제를 찾으면 **그 사례 하나만** 알려 주시면 됩니다 — 전체 재설계를 하지 않습니다
```

🔴 **Risk / 아직 검증 못 한 것** — ⒜ 🔴 **실제 따져 화면은 CTO 가 볼 수 없다**(로그인 뒤) ⟹
화면 축은 **마운트 DOM** 이고 「Production UI PASS」로 적지 않는다 ⒝ snapshotId 경로는
**service-role/DB 가 필요** 해 CTO 로컬에서 실행하지 못했다(코드 경로는 운영 GET 과 같은
함수다) ⒞ 한글 형태 어휘는 **관측된 것만** 담았다 — 없는 말은 대응되지 않고 그것이 정상이다.

**STOP — `CORE-FINAL-VISUAL-01` 완료 / `EXISTING JUDGMENT = REUSED` · `MI VISUAL VALIDATION = READY`**

---

## 9-AD. 🔴🔴 **DISCOVERY CORE — 전략 LOCK 고정 · `HOLD`(blocker = B)**(2026-10-27)

🔵🔵🔵 **전략은 이제 `docs/DISCOVERY-STRATEGY-LOCK.md` 에 있다.**
🔴 Discovery 관련 작업을 시작하는 **모든 새 세션/페이지는 그 문서를 먼저** 읽는다.
🔴 §0 이 회전해도 **그 파일은 남는다** — 이번에 전략을 잃어버린 원인이 그것이었다.

### 최종 제품 흐름(변경 금지)

```
상품 URL → Query Planner → **자동 Search** → Candidate URLs → Crawl → Evidence
→ Identity → 국내 참고가격 → 해외 최저 소싱가 → MI → 판매판단 → 등록
🔴 사용자는 Discovery 과정에 **개입하지 않는다**. 북마크릿은 **임시 수단** 이지 최종 구조가 아니다.
```

### 🔴 STEP 1~2 결과 — 막힌 칸은 **하나** 다

| 칸 | 상태 | 위치 |
|---|---|---|
| A Query Planner | 🟢 **동작**(순수 · HTTP 0) | `discovery-core/query-planner.ts` |
| **B Search Execution** | 🔴🔴 **없다 — BLOCKER** | 서버측 실행자 **0건**(전수 grep) |
| C Candidate URL | 🟢 | `url-candidate-pool.ts` |
| D~I Crawl · Evidence · Identity · 국내가 · 해외가 · MI | 🟢 | 기존 pipeline |

🔴 **실행수단 전수 검토(실측)** — 유료 API **미도입** · Gemini **flag OFF**(402 실측) ·
DuckDuckGo 서버 파싱 **403**(Origin 헤더 · 실측) · 소매처 직접은 **Registry 상한**(WU-007 증분 0/6) ·
북마크릿은 **최종 구조 아님**. ⟹ 🔴 **비용 0 으로 서비스가 스스로 검색할 수단이 없다.**

🔴 **「CTO 의 WebSearch 로 됐다」를 근거로 쓰지 않는다** — 그것은 개발자 도구이고
배포된 서비스의 capability 가 아니다(과거 `cto-websearch` 표기 주의).

### 🟢 이번에 «한» 것(STEP 3 은 조건 불성립이라 하지 않았다)

```
🟢 QA X-Ray 에 **Discovery 단계** 추가 — 생성된 검색어 목록 + **실행자 부재(BLOCKED)** 를 적는다
   🔴 `buildDiscoveryQuerySet` 은 **순수 함수** 다 ⟹ 이 배선이 검색을 **실행하지 않는다**
   🟢 계약이 그 사실을 잠근다 — 실행자가 생기면 그 계약이 FAIL 하고 **그것이 열렸다는 증거** 다
🔴 Registry 확대 0 · Adapter 0 · Gemini 0 · 유료 API 0 · Identity/MI/가격 변경 0
```

### 🔴 전략을 잃어버린 지점(재발 방지)

```
CONFIRMED = C + D (부분 E)
  C 채택 전략 둘이 **실행 불가** 라 실제로 도는 등록부 경로로 모든 WU 가 수렴했다
  D 이전 측정이 **등록부를 분모** 로 삼았고 그것이 다음 WU 의 출발점이 됐다
  E START-HERE §0 에 **Discovery 전략 줄이 없었다**
🟢 ⟹ `DISCOVERY-STRATEGY-LOCK.md` 를 만들어 §0 과 **분리해** 고정했다
```

### 증거

```
회귀 **703 files / 9,435 passed / 0 failed / 148 skipped**(직전 703/9,434 대비 **+1 test**)
typecheck **0** · build **0** · 운영 변경 = QA 경로 **3 파일**(운영 셀러 화면 **0**)
```

**STOP — `DISCOVERY CORE = HOLD` · blocker **B(Search Execution)** / 다음은 Search Provider 결정**
