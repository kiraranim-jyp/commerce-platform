# E2E-ROOTCAUSE-01 Track A — 입력 URL → ProductFacts → Query

🔴 운영 Query · Identity · MI · Market · Registry · adapter · parser **변경 0**(CPO §5·§12).
🔴 문제 A 와 B 를 **섞지 않았다** — 이 문서는 **A 만** 닫는다.

---

## ① 입력 URL 비교 (운영 추출 경로 그대로)

| 단계 | **A Little Luna**(국내 · 한글 encoding) | **B Main Story**(해외 원상품) |
|---|---|---|
| host | `littleluna.co.kr` | `main-story.com` |
| URL shape | 🟢 **PRODUCT_PAGE** | 🟢 PRODUCT_PAGE |
| percent-encoding | 🟢 **정상 디코딩** — `/product/메인스토리-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/1/display/3/` | — |
| query string | `?icid=MAIN.product_listmain_2` → 🟢 영향 없음 | `?srsltid=…` → 🟢 영향 없음 |
| HTML 확보 | 🟢 OK | 🟢 OK |
| 이미지 | 🟢 **18** | 🟢 6 |
| title | 🟢 `[메인스토리]  AW26MS185 - Bubble Sweatshirt - Grey Melange 8Y` | 🟢 `Bubble Sweatshirt - Grey Melange` |
| brand | 🟢 `MAIN STORY` | 🟢 `Main Story` |
| **price** | 🔴 **null** | 🟢 **57 GBP** |
| sku | `cafe24_littlelunakr_1_4120_P0000GCM000A`(샵 자체 SKU) | null |
| **brandModelCode** | 🔴 **null** (🔴 제목엔 `AW26MS185` 가 **그대로 있다**) | 🔴 **null** |
| color | 🟢 `Grey` | 🔴 **`Our Grey`**(설명문 첫 단어가 섞였다) |
| material | 🔴 **`FW26`**(시즌 코드가 소재 칸에) | 🟢 `100% Organic Cotton` |

## ② 실제 생성된 Query

```
A  "MAIN STORY" 메인스토리 AW26MS185 - Bubble Grey FW26 국내해외 동일상품 판매처
B  "Main Story" Bubble Sweatshirt - Melange Our Grey 100% Organic Cotton 국내해외 동일상품 판매처
```

---

## ⑨ 원인 — **A. Input URL / ProductFacts** (단, CPO 가설은 반증됐다)

### 🔴🔴 반증된 것 — 「한글 URL 이라 못 읽는다」는 **사실이 아니다**
```
🟢 percent-encoding 손상 **0** · URL shape **PRODUCT_PAGE** · HTML 확보 **성공** ·
   제목·브랜드·색상·이미지 18장 **전부 확보** · Query **생성됨**
⟹ 🔴 **Little Luna 는 「상품정보를 못 가져오는」 상태가 아니다.**
   화면에서 안 보였다면 그것은 **추출 실패가 아니라 다른 단계** 다(문제 B 쪽).
```

### 🔴 그러나 **추출 «품질» 결함 넷** 이 실측됐다 — 전부 **일반 계층** 이다

| # | 결함 | 쪽 | 결과 |
|---|---|---|---|
| 1 | **price = null** | A | 국내 URL 을 직접 넣어도 **원상품 가격이 비어** 가격 축이 출발하지 못한다 |
| 2 | **brandModelCode = null** 인데 **제목에 `AW26MS185`** 가 있다 | A·B | 품번 축이 죽는다. 🟢 다만 Query 엔 **코어 토큰으로** 들어갔다 |
| 3 | `material = "FW26"`(시즌 코드) | A | Query 에 **시즌 코드가 소재로** 실린다 |
| 4 | `color = "Our Grey"`(설명문 첫 단어) | B | Query 에 **`Our`** 가 실린다 |

🔴 **고치지 않았다**(CPO §5 「원인 확인 전 수정 금지」 · §12 금지 목록).
🟢 넷 다 **사이트 전용이 아니다** — `resolveBrandModelCode`(라벨+slug 둘뿐) ·
   색상/소재 추출기 · Cafe24 가격 추출의 **일반 계층** 문제다(§10 이 요구한 방향).

### 🟡 2번이 가장 크다 — **제목에 있는 품번을 안 읽는다**
```
`resolveBrandModelCode` = ⒜ 설명문 「Product/Article code:」 라벨 ⒝ URL slug 조각
🔴 **제목을 보지 않는다.** A 의 제목엔 `AW26MS185` 가 통째로 있고,
   slug 는 `메인스토리-aw26ms185-…` 라 한글이 섞여 ⒝ 가 못 뽑는다.
⟹ 🔴 이것은 E2E-HISTORY-10 이 「10건 중 8건 NO_MODEL_CODE」로 적은 **그 owner** 다.
   🟡 「제목에서 품번을 읽는다」는 **Identity 입력 변경** 이라 CPO 판정 사안이다.
```

---

## ⑩~⑫ 변경 · 회귀 · 판정

```
운영 코드 변경 **0**(측정 하니스 + fixture 만)
회귀 734 files / 9,627 passed / 0 failed · typecheck 0
판정 🟡 **PARTIAL** — Track A 원인 확정 · 🔴 Track B·C(후보 funnel)는 **미실행**
```

🔴 **Track B/C 를 이번에 하지 않은 이유** — 세션 용량이다(§4-C). 🟢 그런데 그 둘의
재료는 **이미 있다**: `query-adopt-01-production.json` 이 같은 10상품의
`raw → pool → evidence → verdict → market → price` 를 전부 들고 있고,
Main Story 는 거기서 **`miniboutique.co.kr` KRW 117,000 · SAME · EXACT · KR** 을 냈다.
⟹ 🔴 **「동일/유사 후보가 거의 없다」는 Main Story 에서는 사실이 아니다**(🇰🇷 3 · 🌎 3).

## 🟡 다음 한 수(CPO 결정)

```
① **제목에서 품번을 읽을 것인가** — Identity 입력 변경(2번 결함 · 가장 큰 레버)
② **Cafe24 가격 null** — 일반 가격 추출 계층(사이트 adapter 아님)
③ Track B/C 를 `query-adopt-01-production.json` 위에서 이어서 분석
```
