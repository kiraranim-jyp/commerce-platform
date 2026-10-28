# QUERY-ARCH-01 §17~§20 — Production 10회 Search 실측

🔴 운영 로직 변경 **0**(Query·Identity·MI·Market Attribution·Registry 전부 불변).
🟢 추가된 것은 **측정 기록 + 계약** 이고, 1회용 측정 라우트는 **삭제됐다**(§G).

---

## A. Search Execution — **10 / 10**

```
Products          10
Queries           10
Search executions 10        🟢 전건 `searches: 1`
Search failures    0        🟢 전건 `failed: false` · `skipped: null`
HTTP               10/10 = 200
소요              26~81초/건
```
🟢 **`1 Product = 1 Search` 계약이 Production 에서 지켜졌다**(재시도 0 · 변형 0 · 분리 0).

## B. 상품별 결과

| # | 상품 | organic | supplied | accepted | usable | miEl | rows | SAME | PRES | 🇰🇷 | 🌎 | 국내가 | 해외최저 | DOM |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| 1 | Bobo Choses | 4 | 4 | 4 | 3 | 3 | **5** | 4 | 1 | **1** | 3 | **₩88,000** | GBP 37 · EUR 40 · USD 58 | 🟢 |
| 2 | BOSS | 9 | 9 | 4 | 3 | 3 | **9** | 1 | 8 | 0 | 9 | — | GBP 21.2 · CAD 95 · EUR 22 | 🟢 |
| 3 | Louis Louise | 9 | 9 | 3 | 1 | 1 | **7** | 0 | 7 | 0 | 7 | — | GBP 44 · CAD 121 · EUR 22 | 🟢 |
| 4 | **Main Story** | 9 | 9 | 8 | 7 | 7 | **5** | 1 | 4 | **3** | 2 | **₩117,000** | GBP 57 · EUR 33 | 🟢 |
| 5 | Mini rodini | **0** | — | — | — | — | 2 | 0 | 2 | 0 | 2 | — | GBP/CAD(🔴 아래) | 🟢 |
| 6 | Damarindo Pique Polo | 7 | 7 | 5 | 1 | 1 | **1** | 0 | 1 | 0 | 1 | — | USD 51 | 🟢 |
| 7 | Fall Cericho T-Shirt | 9 | 9 | 1 | **0** | 0 | **0** | 0 | 0 | 0 | 0 | — | — | 🟡 문장 |
| 8 | Magro Long Sleeve | 9 | 9 | 3 | 2 | 1 | **0** | 0 | 0 | 0 | 0 | — | — | 🟡 문장 |
| 9 | Racchetto Polo | 9 | 9 | 2 | 2 | 2 | **2** | 0 | 2 | 0 | 1 | — | USD 53.97 | 🟢 |
| 10 | Trattino Short | 9 | 9 | 1 | **0** | 0 | **0** | 0 | 0 | 0 | 0 | — | — | 🟡 문장 |

## C. Aggregate Funnel (분모 포함)

```
10 Products → **10 Queries** → **10 Searches** → organic **74**
→ URL 공급 74 → accepted **31** → usable **19** → MI 자격 **18**
→ Evidence 행 **31**(생산자 합산) → Identity: SAME **6** · PRESUMED_SAME **25**
→ tier: EXACT **6** · COMPARISON **25**
→ market: OVERSEAS **25** · **KR 4** · UNKNOWN **2**
→ priceStatus: VERIFIED_CURRENT **13** · UNVERIFIED_SEARCH **18**
→ API 행 31 → Client 행 31 → **mounted DOM 행 31**(소실 **0**)
```
🔴 생산자별 — `OVERSEAS_AUTO` **19** · `WEB_SEARCH` **9** · `DOMESTIC_LISTING` **3**.
   (후보 31 은 **세 생산자 합산** 이다 — AI Search 단독 산출로 읽지 않는다.)

## D. 🟢🟢 이번 측정의 핵심 — **AI Search 가 국내 후보를 냈다**

```
Main Story  WEB_SEARCH  **miniboutique.co.kr · market=KR · KRW 117,000 · VERIFIED_CURRENT**
```
🟢 `WEB_SEARCH` 생산자가 **국내(KR) 후보를 만든 첫 사례** 다. 같은 상품에서
`DOMESTIC_LISTING` 이 deuxbebe ₩117,000 · donokids ₩134,000 을 같이 냈고
**국내 참고가격 축이 3건으로 섰다**.
🟢 Bobo Choses 도 국내 1건(donokids ₩88,000)과 해외 SAME 3건이 **같이** 섰다.

🔴 **그러나 「Query 를 고쳐서 국내가 열렸다」로 적지 않는다** — SP-10 이 측정한 대로
국내 Evidence 는 **그 브랜드가 국내에 유통되는가** 가 정하고, 실제로 국내 후보가 난
상품은 **2/10** 이다(Bobo Choses · Main Story — 둘 다 국내 유통 브랜드).

## E. 🔴 발견한 결함 — **셋이고 전부 고치지 않았다**(§12 금지 준수)

### E-1 🔴🔴 해외 집계에 **비현실적 금액**이 들어간다
```
12,700 GBP · 10,300 USD · 14,300 GBP · 52,700 CAD · 4,100 USD · 31,700 GBP · 24,100 CAD
전부 `UNVERIFIED_SEARCH` · 전부 `OVERSEAS_AUTO` 생산자
⟹ `candidateOverseasPrice.byCurrency[*].highestAmount` 가 오염된다
   (BOSS GBP 21.2~**12,700** · Louis Louise CAD 121~**52,700**)
🟢 **최저가는 영향 없다** — 오염은 상한 쪽이다
🔴 WU-111 이 이미 닫아 둔 구조다(집계는 priceStatus 를 보지 않는다) ⟹ **가격 정책**
```

### E-2 🔴 `domesticLowestKrw` 가 **117** 로 나온다(Main Story)
```
같은 응답의 `candidateDomesticPrice` 는 KRW **117,000** 인데
`domesticCompetition.lowestPriceKrw` 는 **117** 이다.
🔴 **원인을 단정하지 않았다** — 그 값의 owner 는 `domestic_product_links`(영속 축)이고
   후보 집계와 **다른 분모** 다. 🔴 MI 변경 금지라 건드리지 않았다 ⟹ **CPO 판정 사안**
🟢 Bobo Choses 는 **88,000** 으로 정상이다 ⟹ 전역 단위 버그로 읽지 않는다
```

### E-3 🔴 자기 자신이 후보로 선다(Racchetto Polo)
```
원상품 호스트 `tennis-warehouse.com` 이 **후보로** 올라왔다(USD 53.97 = 원상품 가격).
🔴 자기참조 계약은 **같은 listing** 만 접는다(로케일/다른 경로는 다른 시장 · CPO 확정).
🔴 이것이 그 계약의 구멍인지, 실제로 다른 listing 인지 **확인하지 않았다** ⟹ 미측정
```

## F. §19/§20 — API → Client → **mounted DOM**

```
API candidate                **31**
Client candidate             **31**  (같은 배열이 그대로 state 로 간다 · e2e-close-01 소스 계약)
Mounted DOM candidate row    **31**  🟢 **소실 0** (10 상품 전수 마운트)
CEO Production UI 확인       🔴 **NO** — 아직 안 받았다(CTO 는 로그인 뒤 화면을 볼 수 없다)
```
🟢 그 DOM 검증의 입력은 **손으로 만든 fixture 가 아니다** — Production 이 돌려준 그 31행이다.
🟢 출처 배지(`AI 검색` · `국내 목록 탐색`)와 🇰🇷/🌎 분리가 **실제 행으로** 확인됐다.
🟡 후보 0 인 3건은 **빈 화면이 아니라 문장** 을 낸다.
🔴 한계 — 1회용 라우트 응답이 **투영** 이라 `title`/`imageUrl` 을 싣지 않았다 ⟹
   그 둘은 fixture 에서 null 이고 **단언하지 않았다**(하니스 한계 · 제품 사실 아님).

## G. 🔴 1회용 토큰/라우트 — **폐기 완료**(§10 ⑥⑦⑧⑨)

```
① 1회용 token 생성(64자 · 🔴 값은 어디에도 출력하지 않았다)
② Production Sensitive env `DEBUG_QUERY_ARCH_TOKEN` 등록
③ `/api/debug/query-arch-01` 에만 사용(`x-debug-token` · 없으면 404)
④ 10회 실행 ⑤ funnel 만 반환(비밀값 0)
⑥ 🟢 **token 즉시 폐기** — `vercel env rm` 완료 · 재조회 **0건** · 로컬 파일 삭제
⑦ 🟢 **라우트 파일 삭제** — `api/debug/` 에 남은 것은 기존 5개뿐
⑧ 🟢 재배포(아래 커밋)
⑨ 🟢 삭제 증명은 **source + deployment 기준** 이다 —
   소스 참조 전수 grep **0** · 🔴 HTTP 404 를 단독 증거로 쓰지 않았다(§10 ⑧)
```

## H. 변경/회귀/Git

```
운영 로직 변경 0 · 신규 테스트 2파일 · fixture 2 · 1회용 라우트 추가 후 **삭제**
회귀 **729 files / 9,605 passed / 0 failed** · typecheck **0** · build exit **0**
🟢 기존 fixture 분류 가드가 또 잡았다(core-same06) — 약화하지 않고 등록
```

## I. 최종 판정 — 🟡 **PARTIAL**

```
🟢 PASS — §17 Search 10/10(1 Product = 1 Search) · §18 funnel 전 구간 측정 ·
         §19 API→Client→**mounted DOM** 소실 0 · AI Search 가 국내 후보를 낸 첫 사례
🔴 남은 한 칸 — **§20 실제 「따져」 화면 CEO 확인** 이 아직 **NO** 다
   (CTO 는 로그인 뒤 화면을 볼 수 없다 ⟹ 이 축은 CEO 1회로만 닫힌다)
```

🟡 **CEO Action — 1회**: `/pipeline` 에서 **Main Story(Bubble Sweatshirt)** 와
**Bobo Choses(B226AC009)** 두 상품을 열어 확인.
```
① 📊 시장 판단 영역에 **국내 참고가격**이 보이는가(₩117,000 / ₩88,000)
② 후보 구역에 **「AI 검색」 출처 배지**가 붙은 행이 있는가(miniboutique.co.kr)
③ 🇰🇷 / 🌎 가 갈려 보이는가
🔴 내부 어휘(PRESUMED_SAME · score · threshold · Apify · webSearchEvidence)가
   화면에 보이면 **FAIL** 이다
```
