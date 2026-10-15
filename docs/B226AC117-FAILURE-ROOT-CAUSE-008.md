# WU-008 — `B226AC117` Production FAIL **원인 추적** (조사 전용)

> 🔴 Gemini **0** · Anthropic 0 · OpenAI 0 · 검색 API 0 · API 키 0 · 결제 0 ·
> 새 Discovery 기능 **0** · Registry 변경 **0** · 가격 추정/환산 **0** · 임계값 변경 **0** ·
> Production 재배포 **0** · DB 쓰기 **0** · 운영 코드 변경 **0**.
> 🟢 쓴 자원 — 읽기 전용 DB 질의 + 무키 HTTP **소수**(looxloo 등 6샵 검색 2회 + probe 4회).
>
> 🔴🔴 **먼저 보고해야 할 것: CEO 테스트의 전제 하나가 데이터로 반증됐다.**
> `¥26,400` 은 「엉뚱한 판매처 가격」이 **아니라** 테스트에 쓰인 **그 URL 의 원본 시장
> 가격** 이다. 그래서 ②의 「가격 오염」 부분은 **성립하지 않는다.**
> 🟢 단 **다른 결함 셋이 실재** 하고, CEO 가 본 「무관한 상품」은 **사실** 이다.

---

## 1. 🔴🔴 반증 — `¥26,400` 의 provenance

```
운영 DB 에 같은 상품이 **스냅샷 13개** 로 쪼개져 있다:
  bobochoses.co.jp  2건 (Oct 14 = **오늘 테스트로 생성**)
      canonicalProduct.price = { amount: **26400**, currency: **JPY**,
                                 source: **ORIGINAL**, confidence: 0.95 }
  bobochoses.com   11건 (Sep 11 · Sep 22)
      canonicalProduct.price = { amount: **120**, currency: **EUR**, source: ORIGINAL }
```

🔴 **CPO 가 CEO 에게 전달한 테스트 URL 이 `bobochoses.co.jp/...?utm_source=chatgpt.com`**
(일본 스토어)였다. 그 URL 로 오늘 **새 스냅샷 2개** 가 만들어졌고, CEO 가 그 화면을 열었다.
→ 🟢 그 화면의 `¥26,400` 은 **그 URL 의 원본 가격** 이고, 헌장의 「원본 통화 그대로 ·
환산 금지」와 **일치한다.** 🔴 다른 판매처 가격이 섞인 것이 아니다.

🟢 `€120` 은 `bobochoses.com`(기본/EU) 스냅샷의 원본가이고, `₩258,000` 은 `.com` 의
**`en-kr` 시장** 값이다 — **셋이 서로 다른 시장** 이다.

---

## 2. 🟢 `₩258,000` 은 우리가 **이미 갖고 있다** (단, `.com` 스냅샷에만)

```
.com 스냅샷 11/11 전건  →  en-kr : KRW **258,000**  (SELLER_ORIGIN 관측)
                            en-int/en-de/en-fr : EUR 120 (krw 환산 189,196)
.co.jp 스냅샷 2/2       →  🔴 **en-kr 관측 0건** (JPY 만 · krw 환산 223,964)
```

🔴 즉 CEO 화면에 ₩258,000 이 없었던 것은 **그 스냅샷이 `.co.jp` 였기 때문** 이다.

### 🟢 그리고 그것은 **코드 결함이 아니다** — 측정으로 갈랐다

```
GET bobochoses.co.jp/en-kr/products/b226ac117-….json  → **404**
GET bobochoses.com /en-kr/products/b226ac117-….json  → **200**
```
`probeOriginAndKrMarkets`(shopify-market-probe.ts:50-63)는 **어느 Shopify origin 에든**
`en-kr` 을 시도하고, 404 면 「그 market 은 없는 것으로 취급」한다(주석에 명시).
→ 🟢 **일본 스토어에는 한국 시장이 존재하지 않는다.** probe 는 정상 동작했다.

🔴 **그래서 남는 것은 코드 버그가 아니라 제품 결함이다** — 셀러가 `.co.jp` URL 을 넣으면
한국 가격을 **영구히** 볼 수 없고, 화면은 **그 이유를 말하지 않는다.**

---

## 3. 🟢 CEO 가 본 「무관한 상품」은 **사실이다** — 그러나 가격에는 들어가지 않는다

운영 검색 함수(`searchDomesticShops`)를 **같은 입력** 으로 돌린 실측 결과(두 스냅샷 동일):

```
대상 샵 6 (chocoel · deuxbebe · littleluna · looxloo · rulii · foretforet) · 오류 0
후보 **5건** — 전부 `looxloo.com` 이고 전부 **다른 상품** 이다:
   BLUEDOG레깅스(46119-416-04) ₩35,000 · BLUEDOG 가디건 상하세트 ₩83,400 ·
   BLUEDOG 퀼팅 우주복 ₩94,500 · SOFT 플리스 머플러 ₩39,000 ·
   아뜰리에슈 몽소턱받이 ₩85,000
🟢 matchLevel **전건 low** · 🟢 품번 Evidence **0/5** · 🟢 저장된 국내 링크 **0건**
```

🔴🔴 **그래서 ②를 둘로 갈라 적는다**:
```
🟢 「무관한 상품이 후보로 보인다」            = **사실** (실측 5건)
🔴 「그 가격이 동일상품 가격/판정에 들어간다」 = **반증**
   근거 — tier 가 EXACT 가 아니고(low), 링크로 저장되지도 않았다.
   헌장 기록과 정합: 「돈은 EXACT 버킷에서만 움직인다」(price-history.ts:644)
```
🔴 **Gift Bag / Veja 는 이 경로에 없다** — `bobochoses.com` 은 두 workspace 모두
**ws OFF** 라 검색 대상에서 빠진다. 그 둘은 **내가 WU-007 측정에서 bobochoses.com 에
직접 질의했을 때** 나온 이름이다. 🔴 CEO 화면에 실제로 무엇이 그려졌는지는 **CTO 가
확인할 수 없다**(로그인 뒤 · 메모 `production-payload-is-unreachable`).

---

## 4. 🔴 왜 looxloo 가 BLUEDOG 를 돌려주는가 — **브랜드가 비어 있다**

```
canonicalProduct.brand = { value: **""**, source: "REQUIRED" }   ← 12/13 스냅샷
                        { value: **"AW26"** }                    ← 1건(시즌이지 브랜드가 아니다)
🔴 그래서 실제로 나간 검색어 전수에 **「Bobo Choses」가 한 번도 없다**:
   ① "B226AC117"
   ② "embossed tracksuit jacket Outerwear Blue"
   ③ "embossed tracksuit jacket Outerwear"
   ④ "embossed tracksuit jacket"
   ⑤ "embossed tracksuit jacket polyester"
→ Cafe24 검색이 품번/영문명에 대해 **fallback 목록** 을 돌려주고, 그것이 low 후보가 된다.
```
🟢 헌장에 기록된 기존 문제(`brand=AW26` 오염 · 브랜드 축 사망)가 **이 상품에서 재확증** 됐다.

---

## 5. 🔴 결함 목록 — 등급을 섞지 않는다

| | 사실 | 등급 |
|---|---|---|
| ① | 같은 상품이 **스냅샷 13개** 로 중복 생성된다 | 🔴 **결함** |
| ①-b | 🔴 `?utm_source=chatgpt.com` **쿼리만 달라도 별개 스냅샷** 이 된다(실측: 경로가 완전히 동일한 두 건) | 🔴 **결함** · 🟢 WU-007A 와 **같은 계열**(쿼리 정규화) |
| ② | 원본 스토어가 다르면(`.co.jp` ↔ `.com`) **원본 통화가 달라지고**, 화면은 둘이 같은 상품인지 말하지 않는다 | 🔴 **제품 결함** |
| ③ | `.co.jp` 는 **KR 시장이 없어** ₩258,000 을 영구히 못 본다. 🔴 그 이유를 화면이 말하지 않는다 | 🔴 **제품 결함**(코드 버그 아님 — 404 실측) |
| ④ | 브랜드가 **빈 값** → 검색어에 브랜드가 없고 Identity 브랜드 축이 죽는다 | 🔴 **결함**(기존 기록 재확증) |
| ⑤ | 무관한 상품 5건이 **후보 목록에 보인다**(low) | 🔴 **UX 결함** · 🟢 가격/판정 영향 **0** |
| ⑥ | `miniboutique`(ljm8481.cafe24.com) **등록부 미등록** → 그 국내 판매처는 구조적으로 안 보인다 | 🟡 Registry 사안(CPO 금지 구간) |
| ⑦ | WU-007A 의 FP 경로는 이 상품에서 **발화하지 않았다** — `bobochoses.com` 이 ws OFF | 🟢 참고 |

🔴 **②③④가 합쳐져 CEO 화면을 만들었다**: 일본 스토어 URL → 원본 JPY → KR 시장 없음 →
브랜드 공백으로 엉뚱한 국내 후보 → 「다른 상품에 다른 통화」로 보인다.

---

## 6. 🔴 CPO 요청 5항 대조

```
① 후보 chain 추적        🟢 완료 — §3 (대상 샵 6 · 후보 5 · 전부 looxloo · 전건 low)
② 동일상품 판정 최소조건  🟢 완료 — 품번 B226AC117 🟢 있다 · 브랜드 🔴 **빈 값** ·
                          상품명 🟢 · 후보 URL 🟢 실제 상품 페이지 · 검색어 🟢 전수 기록 ·
                          confirmBrandCodeInEvidence 결과 🟢 **0/5**(WU-007A 적용 후)
③ 가격 provenance        🟢 완료 — ¥26,400 = `.co.jp` 원본(ORIGINAL) ·
                          ₩258,000 = `.com`/en-kr · €120 = `.com` 기본
                          🔴 「원본가와 판매처가가 합쳐진 단계」는 **없었다** — 애초에
                             국내 링크가 0 이고 후보는 EXACT 가 아니다
④ 통화/환율 규칙         🟢 **이미 분리돼 있다** — 관측이 `source`+`market_code`+`currency`
                          로 저장되고, KRW 환산은 `price_krw` **별 칸** 이다.
                          🔴 혼입은 관측되지 않았다. 🔴 **고칠 코드를 찾지 못했다**
⑤ 회귀 테스트           🟢 추가 — 6건(사전검증 5 + 실측 1 · 게이트 `MI_P0_02_CHAIN=1`)
                          B226AC117 · 엉뚱한 상품 · JPY 26,400 · KRW 258,000 · EUR 120 을
                          **실측값으로 고정**
```

---

## 7. 🔴 CPO 결정이 필요한 것 (CTO 는 하나도 구현하지 않았다)

```
⒜ **스냅샷 중복/정규화** — 같은 상품 URL 이 쿼리 차이로 갈라지는 것을 막을 것인가
   🟢 WU-007A 와 같은 계열이고 리포에 정규화기(`normalizeCandidateUrl`)가 이미 있다
   🔴 단 **스냅샷 생성 정책** 이라 제품 결정이다(기존 13건을 어떻게 볼지도 포함)
⒝ **스토어/시장 표시** — 「이 URL 은 일본 스토어이고 한국 시장이 없습니다 ·
   같은 상품이 다른 스토어에 있습니다」를 화면에 말할 것인가
⒞ **브랜드 공백** — 빈 브랜드/`AW26` 를 어떻게 다룰 것인가(기존 기록된 미해결 사안)
⒟ **low 후보 노출** — 무관한 low 후보를 후보 목록에서 숨길 것인가
   🔴 지금은 가격·판정에 영향이 0 이지만 **신뢰를 깨는 것은 사실** 이다
```

🔴 **WU-007A 를 되돌릴 근거는 이 조사에서 나오지 않았다** — 이 상품에서 그 FP 경로는
발화조차 하지 않았고(샵 OFF), 수정은 독립적으로 유효하다.

🟢 **CEO Action: NONE.**

## 8. 검증
```
WU-008 테스트  **6 passed**(사전검증 5 + 실측 1) · AI 0 · 키 0 · 결제 0
덤프 2개       mi-008-b226ac117-provenance-dump.mjs · mi-008-market-split-dump.mjs (**READ ONLY**)
회귀/타입/빌드  (§본문 보고 참조)
🔴 그리고 이번에도 칸 이름을 추측해 한 번 깨졌다 — `observed_at` 은 **없는 칸** 이다
   (42703). 🟢 `information_schema` 로 읽어 고쳤다. 이 트랙 **열 번째** 같은 실수다.
```
