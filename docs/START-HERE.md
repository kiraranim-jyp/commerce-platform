# ▶ CTO CURRENT HANDOFF — 스마트스토어 상품자동등록

> 🔴🔴 **새 세션은 이 문서만 읽고 바로 시작한다.** 과거 조사/결정을 다시 읽지 않는다.
> 🔴 과거 WU 상세는 **작업 좌표가 아니다** — 막혔을 때만 해당 `HANDOFF-WU-*.md` 를 연다.
> 🔴 이 파일이 **유일한 진입점** 이다(`CLAUDE.md` §12 · 메모리가 여기를 가리킨다).
> 두 번째 진입 문서를 만들지 않는다 — 둘이 되면 서로 다른 말을 하게 된다(실제로 났다).

---

## 1. CURRENT STATE

```
현재        **데이터 엔진 축 동결**(CPO 2026-10-22) — WU-149 ~ 153 전부 CLOSED
HEAD        9fd9d585      마지막 코드 배포 `7c44516`(WU-152) 확인
main        clean · origin 0 / 0
HTTP        /  200   ·  인증 라우트 307(정상)
typecheck   PASS (0)      build PASS (0)
regression  629 files / 8,780 passed / 0 failed
```

🟡 **지금 막혀 있는 것은 하나 — CEO 의 WU-152 화면 확인 1회**(§12 형식).
🔵 그 뒤 **WU-154(UI/UX)** 를 CPO 가 지정한다. 🔴 CTO 가 먼저 착수하지 않는다.

🔴🔴 **WU-150 이 3일짜리 질문에 답했다** — 전문 `docs/HANDOFF-WU-150.md`:
```
「국내 SAME 0」은 MI 문제가 **아니다.** B226AC009 국내 URL 7개 중
  **5개는 우리가 페이지를 읽을 수 없고**(403 ×2 · SPA ×1 · 목록 ×2)
  읽히는 1개(보몽드)는 **품번까지 맞춰 놓고 「brand 칸 하나」로 보류** 된다.
🟢 SKU 는 사라지지 않았다 — `brandModelCode="B226AC009"` 가 MI 까지 정상 전달된다.
```

🟡 **CPO 판정 대기 둘**(CTO 가 열지 않았다 · 둘 **다** 열려야 국내 가격대가 선다):
⒜ 후보측 `brand` null 일 때의 `BRAND_UNCONFIRMED` ⒝ 고도몰 `set_goods_price` 판매가 필드.

🟡 **CEO 화면 확인** — WU-149(결론 단일화) + WU-150(브랜드 품번 줄) **한 번에**.

**CEO Action: 없음.** 배포 후 실제 상품 UI 최종 테스트가 필요한 시점에만 **1회** 요청한다.

---

## 2. NORTH STAR

이 제품은 **후보 검색 결과를 많이 보여주는 시스템이 아니다.**

```
상품 1개 입력 → 동일상품 후보 탐색 → MI 가 SAME 판정
→ SAME 상품의 판매상태/가격 확보 → 셀러에게 시장가격 판단 근거 제공
```

| ❌ 중요하지 않다 | ✅ 중요하다 |
|---|---|
| 후보가 몇 개인가 | **동일상품 2~3개의 가격** |
| 유사상품이 몇 개인가 | 🇰🇷 국내 **시장 가격대** |
| AI 검색 결과가 몇 개인가 | 🌎 해외 **통화별 최저 확인가** |
| 셀러가 후보를 하나씩 판단 | 가격 없으면 **원본 확인 링크** |

🔴 **SIMILAR · DIFFERENT · UNDECIDED 는 seller surface 에 노출하지 않는다.**
🔴 셀러가 직접 SAME/SIMILAR 를 판단하지 않는다 — MI 가 한다.

---

## 3. MARKET RULE

🔴 국내/해외는 **검색/MI 파이프라인을 분리하지 않는다.** 공통이다:

```
원상품 → 후보 수집 → MI SAME 판정 → 판매상태 → 가격 추출
```

**차이는 «최종 가격 해석» 만이다.**

```
🇰🇷 국내   SAME 0    → 가격대 없음
          SAME 1    → **가격대 확정 불가**(1개를 가격대라고 부르지 않는다)
          SAME 2~3  → **시장 가격대**(최저 ─ 최고)
          🔴 평균 · 추천가격 계산 금지

🌎 해외   같은 통화   → 그 통화의 **최저 확인가**
          여러 통화   → **통화별로 각각** 표시
          🔴 환산 금지 · 🔴 **통화가 다른 숫자를 서로 비교하지 않는다**
```

---

## 4. ABSOLUTE FREEZE

```
MI 판정축 · SAME threshold · discovery algorithm · Registry · adapter ·
price_alerts · DB schema · Gemini/API 비용 구조 · 추천 판매가격 · 마진 계산 ·
통화 환산 · 새 후보 검색 알고리즘 · 새 seller candidate UI · 국내 SAME 판정축 개선
```

🔴🔴 **국내 SAME = 0 을 이번 WU 에서 해결하려 하지 않는다.** 국내 공급은 **별도 WU** 다.
🟢 근거는 측정돼 있다 — 첫 divergence 는 **공급**(AI 답변 URL 국내 6·4 : 해외 30·25)이고
어댑터 게이트는 **국내 0/2 · 해외 3/22** 로 양쪽을 거의 같게 막는다(재조사 금지).

---

## 5. ALREADY DONE — DO NOT REIMPLEMENT

WU-145~148 에서 닫힌 것을 **재구현하면 하나인 것을 둘로 쪼갠다.**

```
Seller Decision      최종 owner **하나**(`seller-decision`)
Price owner          시장가격 숫자를 **여러 영역에서 중복 표시하지 않는다**
Price interpretation 🇰🇷 market price band · 🌎 lowest confirmed price ·
                     mixed currency → 통화별 · conversion 0 · recommendation 0
MI blocker           1차 **건수만** · 사유는 `▸ MI 상세 분석`(2차) — 삭제가 아니라 이동
후보 접힘             모든 후보 구역이 `candidate-fold`(기본 접힘 · `open` 금지)
```

### SAME_PRICE_CAP = 3 — 🔴 **가격 «계산» 에만** 적용

```
🔴 SAME **건수를 3개로 잘라 숨기지 않는다** — 아래는 그대로 표시한다:
     동일상품 확인 5곳 · 가격 확인 5곳
🟢 가격 계산에 쓰는 데이터만 **통화별 최대 3개** 다 — GBP 3 · USD 3 · EUR 3 …
🔴🔴 **전역으로 3개를 잘라 통화를 섞으면 안 된다**(GBP 37 < USD 58 ? = 환산 없는 비교)
   ⟹ 그러면 한 통화 축이 통째로 떨어져 **「최저 확인가」가 거짓** 이 된다
🟢 목적 하나 — **각 통화의 최저 확인가를 잃지 않는다**
```

🟢 관련 계약·변이는 **이미 추가·검증** 됐고 전체 회귀 PASS 다(`wu-148-market-price-signal` D).

---

## 6. NEXT WORK — 🔴🔴 **Gemini 축 폐기 · 「외부검색 → candidateUrls」 연결부가 좌표다**

> 🔴🔴🔴 **CPO 가 WU-157 방향을 정정했다**(2026-10-22) — 「우리가 만들려는 구조는
> **Gemini API 를 우리 서버에서 호출해서 검색하는 구조가 아니다**」.
>
> ```
> 외부 검색(GPT Search) → 국내/해외 동일상품 후보 URL
>   → 우리 시스템에 후보 URL 전달 → 우리 Fetch/Extractor
>   → MI 가 SAME/DIFFERENT → **SAME 만** 가격 추출 → 시장가격 판단
> ```
>
> 🔴 **전부 폐기** — Gemini 크레딧 확보 ❌ · `MI_GEMINI_DISCOVERY_ENABLED` ON ❌ ·
> Gemini prompt 수정 ❌ · Gemini 를 검색 공급원으로 ❌ · Adapter/Registry 우회 ❌
> 🔴 아래 「6-D」의 Gemini 좌표는 **폐기된 기록** 이다 — 그 방향으로 가지 않는다.

### 🟢🟢 연결부는 **이미 전부 있다**(코드 실측 · 신규 개발 0)

```
외부 검색 산출(산문 또는 URL 목록)
 → `extractCandidateUrlsFromAiAnswer`  (url-candidate-pool.ts · **순수 · HTTP 0** · URL 모양만)
 → POST `/api/price-history/check`  body.`candidateUrls[]`
      인증 `requireUser()`(check/route.ts:39) · payload 상한 **50**(`MAX_SUPPLIED_CANDIDATE_URLS * 5`)
 → `runDomesticPriceCheck` → `collectUrlCandidatePool({ maxUrls: **10** })`
 → `factsFromProductUrl` → `withConfidence` → `enrichCandidatePrices`
 → `judgeDomesticCandidate` → `classifyCandidateMarket` → MI → SAME → 가격 → 시장가격
```

🔴 **빠진 것은 「누가 그 칸을 채우는가」 하나다.** 파이프라인은 WU-150/151 에서
**끝까지 도는 것이 실증됐다**(보몽드 → SAME · KRW 83,600 · market KR).

### 🔴🔴🔴 그래서 CPO 가 가를 것 하나 — **첫 화살표의 주인**

CPO 가 미리 못을 박은 그 전제(「서버가 GPT Search 를 자동 호출할 수 있다고
전제해서도 안 된다」)를 **코드로 확인했고, 부를 수 없다**:

```
운영 코드 전수 — 웹 검색 클라이언트 **0**
  🔴 `packages/image/.../openai.provider.ts` 는 **이미지 분류기** 다
     (`gpt-4o-mini` + `image_url` · `tools` **없음** · 웹검색 능력 0)
  🔴 외부 검색 endpoint 는 **Gemini 하나** 뿐이고 그것이 폐기 축이다
⟹ 🔴 **GPT Search 는 CTO/CPO 의 «도구» 이고 제품 서버의 «능력» 이 아니다**
```

그러면 `candidateUrls` 를 채울 주체가 셋인데 **셋 다 닫혀 있다**:

```
⒜ 셀러가 넣는다      🔴 **CPO 가 WU-154 에서 폐기** ("셀러 조사 업무를 돌려주는 것")
                        입력칸은 `isSuppliedUrlInputVisible()` false 뒤에 보존돼 있다
⒝ 서버가 외부 AI 를 부른다  🔴 **§12-0 「외부 AI/검색 API 전면 제외」와 정면**
                        (약관 축 포함 · 메모 `no-external-ai-api-and-no-subscription-routing`)
⒞ 어댑터/Registry     🔴 **CPO 가 이번에 다시 닫았다**
```

🔴🔴 **이것이 제품의 진짜 교차점이고 CTO 가 고를 수 없다.** 🟢 다만 **지금 쓸 수 있는
형태가 하나 있다** — CPO/CTO 가 조사 세션에서 URL 을 넣어 **GT 를 쌓는** 것.
🔴 그것은 **제품 기능이 아니다**(셀러 화면에 서지 않는다) ⟹ 그 구분을 섞지 않는다.

### 🟡 ⒝ 가 열릴 때 만나는 상한 둘 — **좌표만**(지금 바꾸지 않는다)

```
`maxUrls: 10`  run-domestic-price-check.ts:1131 (`MAX_SUPPLIED_CANDIDATE_URLS` :163)
   🔴 「최대한 많이」가 **10 에서 잘린다** — WU-132 가 「재투입 13 중 3건 미열람」으로
      이미 겪은 그 상수다. 🔴 붙여넣기 경로와 **공유** 하므로 혼자 올리지 않는다
payload 상한 50  check/route.ts:24
```

### 🔴🔴 [폐기된 결론 기록] WU-157 — **「측정불가」였고 NO-GO 가 아니었다**

> 「Gemini 가 국내 후보를 못 찾는다」가 **아니라** 「Gemini 의 국내 후보 공급 능력을
> **아직 측정하지 못했다**」. 🔴 그래서 **NO-GO 를 내리지 않는다.**

```
실측  운영 `collectGeminiCandidatePool` 1회 → **402 Payment Required**(선불 크레딧)
🔴 하니스가 1차에 「후보 0 → NO-GO」를 찍었고 **그것이 거짓 결론이었다** ⟹
   `outcomes.OK === 0` 이면 **판정을 거부하는 게이트** 를 박았다(WU-133 형태)
🟢🟢 그 전에 코드로 확정된 사실 셋 — 🔴 **다시 조사하지 않는다**
   ① 실제 Google Search grounding 을 쓴다(`tools: [{ google_search: {} }]`)
   ② **`candidateUrls` 를 요구하지 않는다** ⟹ 자동 `/check`(body `{ snapshotId }` 뿐)에서
      **닿는 유일한** 국내 공급 생산자다(AI URL 풀은 입력이 없어 영원히 안 돈다)
   ③ prompt 에 국내 지시 **0** · 후보 상한 **3**(국내·해외를 **합친** 수)
⟹ 🟢 「제대로 검색되기만 하면 원하는 구조에 상당히 가깝다」(CPO 문장)
```

---

## 6-C. [완료 기록] WU-156 — Case C / NO-GO

### 🔴🔴🔴 WU-156 결론 — **검색어를 바꿔도 국내 상세 URL 은 열리지 않는다**(코드 0)

> 🟡 CPO 가설(「검색어 자체를 바꾸는 게 1차적으로 맞다」)을 **5개 질의로 측정했고
> 지지되지 않았다.** 🔴 그러므로 **prompt/query 변경을 구현하지 않았다**(CPO §12 Case C).

```
🔴🔴 **Query C 는 «이미 운영 상태» 다** — buildPrimaryQuery 를 호출해 확인했다:
   level = **L1_MODEL_CODE** · text = **"Bobo Choses B226AC009"**
   ⟹ 「품번 중심으로 바꾸자」는 바꿀 것이 없다(A 와 C 는 **같은 질의** 다)

단계                        A/C    B    D    E      (동일 조건 · AI 단계 축소 0)
① raw 검색결과 URL            9   10   10   10
②   그중 🇰🇷 도메인            4    1    4    1
③ URL 모양 PRODUCT_PAGE       4    5    1    0
④ 🔴 **🇰🇷 실제 동일상품 상세**  0    0    0    0   ← **KPI · 전 질의 0**
⑥ usable(fetch 성공)         3    5    0    0
⑧ SAME                      3    3    0    0
⑨ 🇰🇷 SAME                   0    0    0    0
🔴 **GO 기준(≥3) 미달 ⟹ NO-GO.**
```

🔴 **④ 의 「0」을 만든 정체를 추측하지 않고 찍었다**(1차 읽기를 정정했다):
```
A/C 의 🇰🇷 후보 4 = beaumonde.co.kr **홈** · trenbe **×2**(`.com`+USD ⟹ 운영 분류 OVERSEAS) ·
                   gmarket **검색결과**  ⟹ 한국 샵의 «읽을 수 있는 상세» **0**
D 의 유일한 PRODUCT_PAGE = **feelway.com 의 몽클레어 상품**(완전히 무관 · fetch 실패)
🟢 `shop.coupang.com/beaumondekr` 는 **UNKNOWN_PAGE** 다 — 🔴 내가 「오통과」로 읽었다가
   분류기를 **직접 호출해** 정정했다(WU-073 오통과 가족이 **아니다**)
```

🔴🔴 **가장 중요한 한 줄 — 가격은 오는데 URL 이 오지 않는다**:
```
Query D(판매처명+품번)가 스니펫에 **88,000 / 89,540 / 66,000 원** 을 적어 줬다.
그런데 링크는 **샵 홈 · 검색결과 · 위키백과** 였고 **후보 0** 이다.
⟹ 🔴 「AI Search 가 국내 후보를 공급한다」는 **채널명·가격까지만** 참이다.
```

🔴 **Case C 의 범위를 넘겨 적지 않는다** — 쓴 공급원은 `cto-websearch` 이고
**운영 Gemini grounding 과 엔진이 다르다**. 「Gemini 라면 다를까」는 **측정불가**
(flag OFF · 비용 HOLD)이고 **CTO 가 도입 여부를 결정하지 않았다**(CPO §12).

🟡 **고치지 않고 적어 두는 분류기 관측 1건** — `item.rakuten.co.jp/{shop}/{id}/` 가
`UNKNOWN_PAGE` 다(WU-155 측정에서 발견 · WU-073 의 SSG 오차단과 **같은 가족**).
🔴 **URL 분류기 수정 금지**(CPO §2)라 손대지 않았다.

🟢 하니스 `wu-156-query-variants.test.ts`(`WU_156_PROBE=1`) · 운영 코드 **0** ·
회귀 **630 files / 8,786 passed · 0 failed** · typecheck **0** · 배포 **0** · CEO 액션 **없음**.

---

> 🟢 **데이터 엔진 축은 CPO 가 동결했다**(2026-10-22). WU-149~153 으로 닫혔다:
> ```
> 🟢 Seller Decision 단일화 · 후보/MI 화면 제거 · Brand extraction · 가격 extraction
> 🟡 국내 SAME **1**(보몽드 83,600) — 2곳은 **접근 가능한 새 URL 이 공급될 때** 재검증
> ```
> 🔴 **국내 SAME 2곳을 기다리며 멈추지 않는다**(CPO: 「그러면 또 며칠을 B226AC009 하나에 쓴다」).

🔵 **다음은 WU-154 — 「셀러가 3초 안에 이해하는 Seller Decision」 UI/UX 재설계.**
🔴 **아직 착수하지 않는다** — CPO 가 지정하고, 그 앞에 **CEO 의 WU-152 화면 확인 1회**가 있다.

### 🔴🔴 WU-154 가 열릴 때 **먼저 읽어야 할 충돌 하나**(CTO 조사 완료 · 코드 0)

CPO 가 WU-154 방향에 적은 「해외 **원본가격 + 원화 환산 병기**」는 **현재 계약과 정면으로 만난다**:

```
🔴 wu-056r1-price-section-identity
   「🔴🔴 해외 참고가격 구역 «안» 에 환산값이 없다」 — `₩` · `약` · `≈` 가 그 구역 안에 **0**
   🔴 그 계약이 생긴 이유가 **CEO 가 본 실제 사고** 다 — 같은 `EUR 40` 이 두 구역에 떴고
      위 구역의 환산값이 **아래 구역의 환산으로 읽혔다**
🔴 wu-148 B-2  「통화가 섞이면 하나의 최저가를 고르지 않는다」
   근거가 **「비교에 환산이 필요하고 환산은 금지」** 다 ⟹ 환산을 허용하면 **이 근거가 바뀐다**
```

🟡 **그래서 CPO 가 가를 것은 하나다 — 「표시 병기」 ↔ 「판단에 환산 사용」**:

```
⒜ 표시 병기만      GBP 37 (약 ₩XX,XXX)  → 🟢 가능 · 🔴 wu-056r1 을 **방향 전환** 해야 한다
⒝ 판단에도 사용    환산해서 최저가/가격대 계산 → 🔴 WU-148 이 거부한 축(통화 섞어 비교)
```

🟢 **재사용할 수 있는 owner 가 이미 있다**(새로 만들지 않는다):
```
packages/pricing/src/currency.ts  `convertToKrw(amount, currency, liveRates)`
   → { krw, **isEstimate** }  · 라이브 환율 없으면 고정표 + isEstimate=true
🟢 「원본 상품」 헤드라인이 **이미 이 함수** 로 「€50.00 · 약 ₩77,828 · 원화 환산」을 만든다
   (WU-056-R1 이 「정상」으로 닫은 그 표시) ⟹ 🔴 새 환산 경로를 만들 이유가 없다
```

---

## 6-B. [참고] 그 전의 좌표 — WU-149 STEP 1·6·7

> 🟢🟢 **WU-149 STEP 1·6·7 은 끝났다**(`d929a0e9` · 배포 완료 · 전문 `docs/HANDOFF-WU-149.md`).
> 🔴 **CTO 가 할 코드 작업이 없다.** 아래 §6-A 는 **완료된 기록** 이다 — 다시 구현하지 않는다.

```
🟢 제거됨   seller surface 의 후보 연구 UI(두 패널 + 슬롯 + 배선 7) ·
            중복 「📊 시장 가격 비교」 접힘 · `StageFocus.marketEvidence`
🟢 보존됨   컴포넌트 파일 둘 · backend API 둘 · 수집/MI/SAME/판매상태/가격추출 ·
            후보 검토 이력(📚) · `PRICE_COMPARISON_ANCHOR_ID`
🟢 부수효과 셀러 화면의 후보 검색 HTTP **2 → 0**(WU-130 이 적어 둔 중복 해소)
🔴 열지 않음 🇰🇷 국내 SAME = 0 (tier SAME 0 · WU-138) ⟹ **공급 WU · CPO 결정축**
```

🔵 **그 다음 후보는 하나다** — 🇰🇷 **국내 동일상품 «공급»**. 🔴 그것은 Registry/어댑터
확대 ↔ Gemini flag 중 하나를 여는 **정책 결정** 이고 **CTO 가 열지 않는다**(§4 freeze).

---

## 6-A. [완료 기록] STEP 1 → 6 → 7 이 무엇이었나

### STEP 1 — seller surface 에서 **legacy candidate research UI 제거**

좌표는 **이미 조사돼 있다**(`docs/HANDOFF-WU-149.md` §STEP 1 · **재조사 금지**).

```
제거 대상(seller 에게 보이는 연구 UI)
  CommerceWorkspace.tsx:3884  <DomesticShopSearch …/>
  CommerceWorkspace.tsx:3900  <ComparisonShopSearch …/>
  그에 딸린 `marketEvidence` wiring · seller-facing candidate research panels
```

🔴🔴 **절대 하지 않을 것 — 내부 candidate pipeline 을 삭제하지 않는다**:
```
candidate collection · MI · candidate data · review/history · price extraction
그리고 backend API 둘(`/api/domestic-price-sources/search` · `/api/comparison/search`)
⟹ 🟢 **엔진은 보존하고, 셀러에게 연구 로그를 보여주는 UI 만 제거한다**
```

🔴 **범위 주의 — `DomesticPriceIntelligencePanel` 을 «통째로» 지우지 않는다.**
그 패널이 `▸ 판단 근거` 접힘 · 📚 검토 이력 · **후보 검토 저장 경로**(WU-131/141-R1)를
들고 있다. ⟹ 🟢 제거 대상은 그 **안의 research 구역과 위 두 패널** 이고, 패널의
review/history/MI 배선은 **보존** 한다(§6 의 「review/history 는 손대지 않는다」와 일치).

### STEP 6/7 — SELLER SURFACE RULE

셀러에게 남는 것은 **하나의 최종 판단 영역** 이다:

```
📊 시장 판매 판단
 ↓ 🇰🇷 국내 동일상품 가격대
 ↓ 🌎 해외 동일상품 최저 확인가
 ↓ 판매상태
 ↓ 가격 근거(없으면 🔗 원본 링크)
```

🔴 **숨긴다**: SIMILAR · DIFFERENT · UNDECIDED · 유사상품 목록 · 후보 수를 강조하는
연구 UI · 「후보 24건 / 25건」류 legacy 목록 · 자동검색 후보 목록 · 이전 확인 후보 목록 ·
후보별 판단 과정 · 셀러가 직접 후보를 판정해야 하는 UI.

### STEP 6 — 가격 owner 는 **하나** 다

```
Seller Decision
  └─ Market Price Evidence        ← 가격 숫자의 **유일한** owner
🔴 같은 정보를 보여주는 **별도 「시장가격 비교」 영역** 이 남아 있으면 제거한다
🔴 두 번째 가격 판단 영역을 **새로 만들지 않는다**
```

### 🔴 가격이 **없는** SAME 후보 — 지우지 않는다

```
🟢 SAME 판정은 **유지** 한다 — 가격이 없다는 이유로 후보를 버리지 않는다
🟢 그 자리에 🔗 **원본 상품 확인** 링크를 준다
⟹ SAME + 판매상태 + (가격 있으면 가격 / 없으면 원본 링크)
```

---

## 7. EARLY STOP 범위

🔴 이번 WU 에서 **collection orchestration 순차화를 하지 않는다.**

```
❌ 후보 수집 → SAME 3개 발견 → 나머지 수집 중단   (구조 개편 · 하지 않는다)
🟢 적용된 최소 변경 — 가격 판단/표시에 쓰는 SAME 을 **통화별 최대 3개** 로 제한
🟢 수집 파이프라인은 **유지** 한다
```

---

## 8. IMPLEMENTATION ORDER — 코드 변경 후 중단하지 않는다

```
1  HANDOFF 좌표 확인(docs/HANDOFF-WU-149.md §STEP 1)
2  §4 freeze 재확인
3  legacy seller candidate UI 제거
4  내부 candidate pipeline 보존 확인
5  SIMILAR/DIFFERENT/UNDECIDED seller 노출 제거
6  Seller Decision 단일 가격 owner 확인 · 중복 가격 영역 제거
7  영향 계약 업데이트(방향을 뒤집어 다시 쓴다 · 삭제로 우회 금지)
8  **targeted tests**        ← 🔴 전체 회귀보다 먼저
9  **mutation test** M1~M7
10 **2-product E2E** (B226AC009 · B226AC010)
11 **full regression**   12 typecheck   13 build
14 deploy                15 production check   16 최종 보고 1회
```

🔴 순서를 뒤집지 않는다 — targeted → mutation → E2E → full regression → typecheck → build.
전체 회귀를 먼저 돌리면 **내 계약이 틀렸는지, 기존 계약이 깨졌는지** 를 가를 수 없다.

---

## 9. CONTRACT / SAFETY — 이 숫자를 **다시 조사하지 않는다**

```
handleRequestPriceReview     9 refs
marketEvidence               7 refs
PRICE_COMPARISON_ANCHOR_ID   4 refs   🔴 WU-141-R3 **보존 계약** — 지우지 않는다
관련 운영 파일                6
영향 계약                    5  (wu-056r1 · mi-022 · wu-130 F-3 ·
                                 예상: product-tab-first-screen · mi-ux-final)
```

🔴 계약 다섯은 **그 구역의 «존재» 를 글자로 단언** 한다 ⟹ 제거하면 **「없다」로 방향을
뒤집어** 다시 써야 한다. 🔴 약화가 아니다 — 「seller 화면에 없다」 **그리고**
「backend/API·review 경로는 **살아 있다**」를 **같이** 단언한다.
🔴🔴 **계약을 지워서 테스트를 통과시키지 않는다.** 계약의 «목적» 을 현재 구조에 맞춘다.

### MUTATION — M1~M7 · 전부 **FAIL 해야** 한다 (실행 후 바이트 복구)

```
M1  legacy candidate UI 를 seller surface 에 되살린다            → FAIL
M2  SIMILAR / DIFFERENT / UNDECIDED 를 seller 기본 화면에 노출   → FAIL
M3  Seller Decision 밖에 **두 번째 가격 owner** 를 만든다        → FAIL
M4  통화별 상한을 **전역 상한** 으로 바꾼다                       → FAIL
M5  **SAME 건수** 를 가격 상한 때문에 3개로 잘라 숨긴다           → FAIL
M6  `PRICE_COMPARISON_ANCHOR_ID` 앵커 div 를 지운다              → FAIL  (보존 계약)
M7  backend API 둘을 지운다                                      → FAIL  (엔진 보존)
```

🔴 M4·M5 계약은 **이미 있다**(`wu-148-market-price-signal` D) — **재구현하지 말고 재사용** 한다.

### 2-PRODUCT E2E — 무엇을 보는가

```
A  SAME 있음        → 판매상태 → 가격 → Seller Decision 한 줄까지
B  SAME 부족/가격 없음 → 「가격대 확정 불가」 **또는** 🔗 원본 확인 링크
+  mixed currency 가 있으면 **USD 와 GBP 가 섞이지 않고 각각 유지** 되는지
```

### ACCEPTANCE — 셀러 화면이 이걸 전부 만족해야 PASS

```
Seller Decision 이 최상위 판단 영역 · 판단 근거는 **동일상품만** ·
SIMILAR/DIFFERENT/UNDECIDED **없음** · 후보 연구 목록 **없음** ·
중복 시장가격 영역 **없음** · 가격 owner **하나** ·
🇰🇷 2개 이상에서만 «가격대» · 🇰🇷 1개는 「참고」(가격대 아님) ·
🌎 통화별 최저 확인가 · 환산 **없음** · 추천가 **없음** · 마진 **없음** ·
가격 없는 SAME 에 원본 링크 **가능** · 🔴 SAME **건수는 상한 때문에 숨지 않는다**
```

---

## 10. STOP RULE

**아래일 때만** 안전 종료한다:
```
코드 변경 «전» 예상치 못한 구조적 위험 발견 · production destructive action 필요 ·
business/security policy 승인 필요 · 기존 freeze 를 깨야만 해결 가능
```
🔴 그 외에는 **코드 변경 → 검증 → 배포까지 계속 진행한다.**
🔴🔴 **「코드 변경 후 세션이 부족할 것 같다」를 이유로 중간 중단하지 않는다** —
**작업 시작 전에 범위를 잡고 끝까지 닫는다.**

---

## 11. DEPLOY → PRODUCTION CHECK

```
배포 후 확인  /  ·  인증 redirect  ·  Seller Decision route  ·  상품 상세/판단 화면
🔴 그리고 Production 에서 **legacy candidate UI 가 실제로 사라졌는지** 확인한다
🔴 「Deployment successful」만 적지 않는다(§9 헌장) · 🔴 401/307 을 route 증거로 쓰지 않는다
```

---

## 12. REPORT RULE — 중간 보고 없음 · 최종 1회

```
[WU-149 STEP 1/6/7 완료]

HEAD:
변경 파일:
제거한 seller UI:
보존한 internal pipeline:

계약:          mutation:      E2E:
Regression:    Typecheck:     Build:

Deploy:        Production check:

국내 SAME:     해외 SAME:

CEO Action:
```

---

## 13. CEO RULE

CEO 는 코드·계약·commit 을 검토하지 않는다. **배포 전에는 아무것도 요청하지 않는다.**
배포가 끝난 뒤 **최종 테스트 1회** 만 요청하고, 그때 형식은 **넷** 이다:

```
테스트 URL:      테스트 상품:      테스트 순서:      예상 결과:
```

🔴🔴 **작업 중 아래를 묻지 않는다 — 전부 이미 결정된 범위다**:
```
「legacy UI 를 제거할까요?」      「flag 로 숨길까요?」
「A/B 중 어떤 방식이?」          「국내 SAME 문제도 같이 고칠까요?」
「Registry 를 늘릴까요?」        「adapter 를 추가할까요?」
「Gemini 를 다시 켤까요?」       「early stop 을 진짜 구현할까요?」
「CEO 가 중간 테스트해볼까요?」  「계약을 어떻게 바꿀까요?」
```

---

## 14. SESSION START

```
CURRENT   WU-149 · 코드 baseline f152f927 · clean/deployed
NEXT      STEP 1 → STEP 6 → STEP 7

DO NOT REINVESTIGATE
  WU-130~148 closed decisions · MI architecture ·
  domestic/overseas pipeline architecture · SAME threshold ·
  Registry/adapter · price interpretation · SAME_PRICE_CAP

DO NOW
  legacy seller candidate UI 제거
  → contracts → mutation → E2E → regression → typecheck → build → deploy

CEO
  배포 전 요청 금지 · 최종 테스트 1회만
```

## 15. 실행 명령 (복붙)

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
🔴 **미커밋 구현을 `git checkout` 으로 되돌리지 않는다** — 백업 복사 후 **바이트 대조** 로 확인한다.
🔴 소스 문자열 검사는 **주석을 벗기고** 한다. 🔴 화면은 **마운트한 DOM** 으로만 완료 선언한다.

---

## 16. 완료 정의 — **19/19 체크됨**(CEO 화면 확인 1회만 남았다)

```
[x] legacy seller candidate UI 제거        [x] internal candidate pipeline 보존
[x] SIMILAR/DIFFERENT/UNDECIDED 노출 제거  [x] Seller Decision 단일 가격 owner
[x] 중복 market price UI 제거              [x] SAME_PRICE_CAP 기존 구현 유지(재구현 0)
[x] 통화별 상한 유지                        [x] SAME 건수 불변
[x] 🇰🇷 가격대 규칙 유지(변경 0)             [x] 🌎 최저 확인가 규칙 유지(변경 0)
[x] 환산 없음                              [x] 추천가 없음
[x] 계약 업데이트(우회 아님 · 방향 전환)     [x] mutation M1~M7 PASS(8종 FAIL→복구)
[x] 2-product E2E PASS                    [x] full regression PASS (8,750 / 0)
[x] typecheck PASS (0)                    [x] build PASS (0)
[x] deploy 완료 + production route 확인
🟡 남은 하나 — **CEO 실제 상품 화면 확인 1회**(그것으로만 「Production UI PASS」가 된다)
```

🔴 **성공 기준은 「후보를 더 많이 보여주는 것」이 아니다** — 셀러가 후보를 다시
판단하지 않고도 **SAME 상품의 가격 근거만으로** 시장가격을 판단할 수 있는
**단일 Seller Decision 화면** 으로 정리되는 것이다.

---

## FINAL PRINCIPLE

> 인수인계 문서는 **역사를 전달하는 문서가 아니다.** 새 세션이
> 「지금 어디까지 됐고 → 무엇을 하면 되고 → 무엇을 건드리면 안 되는가」를
> **1~2분 안에** 파악하고 바로 작업하기 위한 **좌표** 다.

🔴 **후보를 많이 보여주는 것이 목적이 아니다.** 동일상품을 정확히 찾아
**2~3개의 가격 근거** 로 셀러가 시장가격을 판단할 수 있게 하는 것이 목적이다.
