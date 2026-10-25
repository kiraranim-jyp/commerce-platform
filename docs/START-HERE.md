# ▶ CTO CURRENT HANDOFF — 스마트스토어 상품자동등록

> 🔴🔴 **새 세션은 이 문서만 읽고 바로 시작한다.** 과거 조사/결정을 다시 읽지 않는다.
> 🔴 과거 WU 상세는 **작업 좌표가 아니다** — 막혔을 때만 해당 `HANDOFF-WU-*.md` 를 연다.
> 🔴 이 파일이 **유일한 진입점** 이다(`CLAUDE.md` §12 · 메모리가 여기를 가리킨다).
> 두 번째 진입 문서를 만들지 않는다 — 둘이 되면 서로 다른 말을 하게 된다(실제로 났다).

---

## 1. CURRENT STATE

```
현재        🟡 **CORE-2AO-R1 배포 완료 — 남은 것은 «CEO 화면 확인 1회» 다**(2026-10-26)
            🔴 CTO 가 할 코드 작업이 **없다.** 선제적으로 WU 를 만들지 않는다
            🟢 CORE-2AO ⒝(표시 조립) + R1(CEO FAIL 3건 수정) — §6-AO
            🟢 CORE-2AA(VERIFIED_SAME 가격 자격 배선) 배포 완료 — §6-AA
            🟢 CORE-2AC(PLAIN_HTML parity) 배포 · 🔵 2AB·2AD·2AE·2AF·2AG·2AH·2AI 조사(운영 0)
            🟢 CORE-2S/2T/2U-A/2V/2W(셀러 화면) CLOSED · 2X(STOP-C) · 2Y(PASS-Y) · 2Z(PASS)
main        clean · origin 0 / 0 · `ea4391ba`
deploy      🟢 Ready (CORE-2AO-R1) · HTTP 200 / 307 / 401
typecheck   PASS (0)      build PASS (exit 0)
regression  apps/admin **674 files / 9,150 passed / 0 failed**
            🔴 `packages/crawler/.../p54c1-grounding-redirect`(라이브 네트워크) 1건은
               **CPO 가 합산 제외** 한 baseline 이고 이 트랙과 무관하다
```

### 🔴🔴🔴 1-AO. **CORE-2AO-R1 이 남긴 교훈 — 이것부터 읽는다**

```
🔴🔴 **「상수를 고쳤다」가 「화면이 바뀌었다」가 아니다.**
   CORE-2AO 가 「해외에서 동일상품 주장 제거」를 받고 `OVERSEAS_REFERENCE_TITLE` 을
   고쳤는데, **그 상수는 해외 SAME 0 일 때만 서는 쪽** 이었다. 실제 화면 owner 는
   `PRICE_GUIDE_TITLE.OVERSEAS` 이고 B226AC009 는 해외 SAME 4 라 그쪽이 뜬다
   ⟹ **배포하고도 한 글자도 안 바뀌었고 CEO 캡처가 그것을 잡았다.**
   🟢 이제 둘이 **한 상수에서 파생** 한다(한쪽만 고치는 길이 구조적으로 없다).
🔴 **같은 슬롯에 상태가 둘이면 상수도 둘이다** — WU-145 가 「자리가 둘이었다」로
   이미 적어 둔 함정의 **재발** 이다. 문구 WU 는 **상태 전수** 를 먼저 센다.
🟢 **그래서 배포 전 화면 실측 계약을 만들었다** —
   `core-2ao-r1-screen-dump.test.ts` 가 운영 컴포넌트를 B226AC009 모양으로 마운트해
   **1차 화면 텍스트를 찍고** ⒜ 같은 «금액» 이 두 번 ⒝ 같은 «문장» 이 두 번 ⒞ 근거
   설명이 펼쳐짐 — 셋을 막는다. 🔴 실제로 그 계약이 **내 1차 수정의 새 중복**
   (「통화가 여러 개라…」가 블록·결론 두 번)을 **배포 전에** 잡았다.
🔴 **금액 owner 는 «시장 블록» 하나다**(CORE-2W §4-C 는 닫혔다) — 결론(💡 판매 판단)은
   금액을 만들지 않는다. 🔴 단 **「가격 없음」으로 뒤집지 않는다**(계약이 양쪽을 문다).
```

### 🔵 1-SI3. **다음 WU 가 들어오기 전에 알아야 하는 것 — SI-3 트랙 요약**

🔴🔴 **재조사 금지.** 2AB~2AI 가 닫은 것을 다시 열지 않는다. 전문은 각 커밋 메시지.

```
SI-3 정의   「TITLE 축 2점(STRONG_TITLE_OVERLAP) 이면 AUDIENCE_LINE 을 비차단으로」
            🔴 **운영에 넣지 않았다**(CPO 2026-10-25 · 「⒜ 품번 없을 때만」도 보류)
측정 결과   WU-143 false SAME 재발 **0/5** · SI-3 가 만든 누출 **0** · 회수 **1**(kids21)
            누적 CEO GT **36건** · fixture 순서쌍 **930** · 공식몰 같은그래픽 **108쌍**
            ⟹ 🔴 직접 반례(CEO DIFFERENT + GARMENT 같음) **0건**

🔴🔴 **그리고 그 0 의 «이유» 가 구조적이다** — 이것이 2AI 의 핵심이다:
  공식몰 AB/AC 108쌍 = **108/108 MODEL_CODE conflict** ⟹ **조기 반환**(axes: []) ⟹
  TITLE 축이 **계산조차 되지 않는다** ⟹ SI-3 이 **발화할 수 없다**
  ⟹ SI-3 의 사정거리는 **「후보에 브랜드 품번이 없을 때」** 뿐이다(kids21 · cissywears)
  🔴 CPO: 「108/108 이 막힌다고 남은 영역의 false SAME 이 없다는 뜻은 아니다」

차단 구조   CEO SAME 8건을 막는 것은 **전부 blocker/conflict** 다(점수 부족은 1건뿐) —
            AUDIENCE_LINE 2 · MODEL_CODE conflict 2 · NO_TITLE_OVERLAP 2 ·
            BRAND_MISMATCH 1 · BRAND_UNCONFIRMED 1 · 증거부재 1(stockmann)
            🟢 `kids21` 은 corePoints **5** 로 문턱을 **이미 충족** 했고 blocker 하나만 걸린다

🔴 다시 열지 않는 것 — AUDIENCE_LINE 제거/완화 · GARMENT_FORM 조건 추가 ·
   SAME_MIN_AXES · corePoints 산식 · TITLE partial 점수 · crossSellerReserved ·
   MODEL_CODE conflict · compareMaterial(소재 어휘 정규화는 **CPO 판정 대기**)
🟡 CPO 가 승인한 다음 방향 = ⒝ **품번 없는 리테일러 축에서 신규 표본 수집**
   🔴 그 WU 는 **CPO 가 발행한다.** CTO 가 먼저 착수하지 않는다
```

🟢 **CI 에 상주하는 회귀(네트워크 0 · 다음 세션이 믿고 쓸 것)**
```
core-2aa  17  국내 가격 회귀 — KRW 59,000~88,000 · 3곳 · sellerKey dedupe
core-2af   4  WU-143 false SAME 5쌍 — SI-1/2/3 재발 0/5
core-2ab   3  PLAIN_HTML 빈 칸 **다섯** + Shopify 비대칭
core-2ac   8  parity 세 칸 범위(🔴 소재는 «채우지 않는다» 가 계약이다)
core-2ad   5  corePoints 산식 바이트 고정   core-2ae 5  AUDIENCE_LINE 발화 경로
core-2ag   4  표본 출처/SI-3 정의          core-2ah 3  GT 합집합  core-2ai 4  반례 모양
🔴 라이브 축은 환경변수로만 돈다 — CORE2Z/2AB/2AC/2AD/2AE/2AF/2AG/2AH/2AI_LIVE=1
```

🔴🔴🔴 **이 트랙의 축이 «갈렸다». 다음 세션은 이 문장부터 읽는다**(CPO 2026-10-25):
```
가격 축   🟢 **끝났다.** 자격(`VERIFIED_SAME`)만 주면 기존 집계기가 그대로 작동한다
          (국내 59,000~88,000 · 해외 EUR 35~40/GBP 33/USD 56 · leakage 0)
          🔴 **더 파지 않는다** — 「가격 쪽은 더 파지 않습니다」(CPO 문장)
SAME 축   🔴 **여기가 유일하게 남은 문제다** —
          「왜 자동 MI 가 CEO 가 SAME 으로 확정한 **8개** 를 자동 SAME 으로 회복하지 못하는가」
          🔴 단 **CORE-2X 가 증거 레버 C0~C6 전수에서 0/8 을 측정** 했다(STOP-C) ⟹
             다음 범위는 **CPO 가 지정** 한다. CTO 가 threshold/8축/crossSellerReserved 로 되돌아가지 않는다
```

🟡 **지금 막혀 있는 것은 하나 — CEO 화면 확인 1회**(§6-AA 끝).
🔵 그 뒤 범위는 **CPO 가 지정한다.** 🔴 CTO 가 할 코드 작업이 없다.

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

### 🔵 2-B. 최종 방향 — **원가가 들어온 «뒤» 의 사슬**(CPO 확정 2026-10-24)

```
국내 시장가격 → 해외 최저 소싱가 → 비용/배송/세금/수수료 → 목표마진
             → 추천 판매가격 → 판매 여부
```

🔴🔴 **이 사슬은 아직 «열리지 않았다».** `CLAUDE.md §00-B` 의 가격 보류가 그대로 유효하고,
**추천 판매가 · 마진 · 예상수익 계산은 §4 ABSOLUTE FREEZE 에 남아 있다.**
🔴 위 문장을 **착수 승인으로 읽지 않는다** — 그 범위는 **CPO 가 따로 지정** 한다.
🟢 지금 열려 있는 입력은 **원가 한 칸** 이고, 화면은 그것이 비었다는 사실만 말한다
(「🧾 현재 판단」 · CORE-2S ⓔ).

### 🟢 2-C. CORE-2S 의 전략적 위치 — **전략 변경이 아니다**(CPO 대조 2026-10-24)

> 「전략을 바꾼 게 아니라, 전략의 핵심인 **「시장가격 의사결정 시스템」을 셀러 화면에
> 제대로 표현하는 단계**」 (CPO 문장)

🔴 그래서 CORE-2S 를 「UI 미화」로 읽지 않는다 — 11개 전략축 대조에서 **전부 ✅** 였다
(후보 비전면화 · MI 가 판정 · 셀러에게 안 떠넘김 · 🇰🇷 최상단 · 🌎 별도 · 통화 분리 ·
1곳은 가격대 아님 · 가격→판매판단 연결 · 「못 찾음」↔「수익성 판단 불가」 분리 ·
추천가 미착수 · MI 상세 접힘).

🔴🔴 **그리고 이 두 문장을 같은 말로 쓰지 않는다** — CORE-2S 가 화면에서 가른 그것이다:
```
동일상품 «확정»  = MI 가 엄격하게 SAME 으로 확정한 수        ← 0 이어도 정상이다
참고가격        = 동일상품으로 «보이는» 후보에서 확보한 실제 판매가격
⟹ 「MI 가 아직 확정하지 못했지만 **시장가격 정보는 확보했다**」는 상태를 숨기지 않는다
```

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

## 6-AO. 🟡 **CORE-2AO + R1 — 표시만 조립했다 · CEO 확인 1회 대기**(`ea4391ba`)

> 🔴🔴 **진입은 이 절 하나다.** 🔴 **CTO 가 할 코드 작업이 없다.** 다음 범위는 CPO 지정.
> 🔴 아래 §6-AA 이하는 **종료된 기록** 이다.

```
🟢 ⒝ 표시 조립만 — **데이터 의미 0 변경**(CPO 2026-10-25 결정 ⒝)
   🌎 제목  「해외 동일상품 확인 가격」 → **「해외 최저 소싱가」**
            🔴 분모에 `COMPARISON` 이 들어갈 수 있어 「동일상품」을 단정할 수 없다
   🇰🇷 제목  **「국내 참고가격」 그대로**(CPO: 유지 → 정상)
   💡 신규  **「판매가격 판단」** 2줄(판단 근거 + 별도 반영 축) + 원가 없으면 보류 2줄
🟢 R1(CEO FAIL 3건)
   ① 해외 제목 owner 를 **하나로 묶었다**(§1-AO 의 그 교훈)
   ② 결론에서 **금액 전부 제거** — `KRW 88,000` 이 두 군데 떴다(CORE-2W §4-C 닫음)
   ③ 「💡 가격 판단 기준」 **접음**(근거 설명 · 문장 삭제 0)
🔴 **변경 0** — MI · 8축 · threshold · 수집 · 가격 추출/검증/집계 · sellerKey ·
   VERIFIED_SAME · priceTierFromLink · 시장 분류 · 환산 · 추천 판매가 · DB · API · 등록 payload
```

🔴🔴 **CEO Action — 화면 1회**(이것 하나로 닫힌다):
```
https://ttaejyo.vercel.app/pipeline → B226AC009 → **「새 상품 분석」**
🔴 「다시 분석」이 아니다 — 참고가격은 POST 응답에만 실린다(§6-A-0 transient 수명)

보실 것(📊 영역 위→아래)
  🇰🇷 국내 참고가격 KRW 88,000 · 확인 1곳
  🌎 **해외 최저 소싱가** · 동일상품 확인 N곳 · 최저 확인가 GBP 37 · USD 58
  ▸ 가격 판단 기준            ← **접혀 있어야** 한다
  💡 판매 판단                 ← **숫자가 없어야** 한다(판단 문장만)
  💡 판매가격 판단             ← 2줄 + 원가 보류 2줄
  ▸ 판매처·가격 근거           ← 접힘

🔴 FAIL — 「해외 **동일상품** 확인 가격」이 남음 · 같은 금액/문장이 두 군데 ·
         「추천 판매가 ₩…」 · 해외에 「약 ₩…」 환산
🟢 정상인데 FAIL 로 보이기 쉬운 것 — 🇰🇷 가 1곳이면 **범위가 아니라 금액 하나** ·
   🌎 통화가 여럿이면 **합치지 않고 통화별로** 적는다
```

🟡 **CPO 판정 대기 1건(CTO 가 고치지 않았다)** — 🌎 블록의
「확인 가능한 가격 1건 기준입니다 — 시장 평균가가 아닙니다」가 **판매처 4곳인데** 뜬다.
`basis` 가 **통화별로** SINGLE 이기 때문이고 **WU-139 가 만든 기존 동작** 이다(이번 변경 밖).
🔴 가격 «해석» 축이라 임의로 고치지 않았다.

---

## 6-AA. 🟢🟢 **CORE-2AA CLOSED — 사람이 확정한 SAME 이 가격 자격을 «갖는다»**(`6bf1f75b`)

> 🔴 **[종료된 기록]** 현재 좌표는 **§6-AO** 다.

🔴🔴 **CPO 가 범위를 «좁게» 고정했고 그것이 이 WU 의 핵심이다**(2026-10-25):
```
특정 스냅샷 + 특정 candidate URL  →  VERIFIED_SAME  →  가격 자격
🔴 **URL 전역 SAME 으로 만들지 않는다** — 같은 URL 이 다른 원상품에서는 다른 상품일 수 있다
🟢 자격 매핑  SAME → VERIFIED_SAME  ·  DIFFERENT / UNCERTAIN / UNDECIDED → EXCLUDED
🔴 `SIMILAR` 도 자격 없음(CORE-2U — 「유사상품을 형성대에 섞지 않는다」)
```

🔴🔴🔴 **범위가 다른 «두 리더» 를 가른 것이 이 WU 의 설계 결정이다**:
```
재투입(발견)    listReviewedSameUrls        snapshot **∪** origin_code  — 넓다
                ⟹ 위험이 **fetch 비용** 뿐(판정은 페이지를 다시 열어 새로 낸다)
가격 자격       listSnapshotVerifiedSameKeys  snapshot **만**(`.eq("snapshot_id")`) — 좁다
                ⟹ 위험이 **오판**(그 금액이 셀러의 가격 판단에 들어간다)
🔴 재사용하면 좁은 쪽이 **넓은 쪽으로 끌려간다** ⟹ CPO 가 막은 「URL 전역」이 조용히 생긴다
🔴 그리고 `listCandidateReviews` 는 `snapshotId` 를 **돌려주지 않아** 사후 필터도 불가능하다
```

🟢 **owner 하나 · 순수 함수** — `priceTierWithVerifiedSame(run-domestic-price-check.ts)`
```
🔴 **단조(monotonic)** 다 — 자격이 없다고 자동값을 «내리지» 않는다.
   내리면 「검토 안 한 상품의 가격이 사라진다」 = CPO 회귀 기준 위반이다
🔴 `priceTierFromLink` 를 **수정하지 않았다** — 그 산출 «위에» 자격만 덮는다
   ⟹ CPO 가 거부한 ⒜(「`verified` 가 `matchTruth` 를 이기게 순서 변경」)가 **아니다**
🔴 자동 MI **불변** — matchTruth 0 · verified 0 · SAME_MIN_AXES 0 · crossSellerReserved 0
🟢 WU-131 격리 **유지** — `market-intelligence.ts`·`domestic-product-link.ts` 는
   `humanVerdict` 를 끝까지 **모른다**(계약 삭제 **0**)
```

🟢 **CPO 가 지정한 순서를 지켰다 — 회귀를 «먼저» 잠갔다**:
```
STEP 1  core-2aa AA-1~AA-8  배선 «전» 에 8/8 PASS (네트워크 0 ⟹ CI 에서 매번 돈다)
STEP 2  core-2aa AA-9~AA-17 배선 계약 9 · 음성대조 M1~M7 전부 FAIL → 바이트 복구
🔴 CORE-2Z 는 `CORE2Z_LIVE=1` 없이는 SKIP 이라 회귀를 지켜 주지 못한다 — 그 자리를 2AA 가 맡는다
🟢 CORE-2Z 라이브를 **운영 owner 경유로 교체**(복제 제거) — 숫자 한 자리도 불변
```

### 🟡 6-AA. CEO Action — **화면 1회**(CPO 가 시점을 정한다)

🔴 **CPO 가 「배선 후 최종 확인 시점에 한 번만」으로 미뤘다** — CTO 가 먼저 요청하지 않는다.
🔴 그때 보는 것 — 셀러가 후보를 「동일상품」으로 누른 **뒤** 🇰🇷 가격이 **「참고가격」에서
「동일상품 확인 가격」으로 바뀌는가**. 🔴 경로는 **「새 상품 분석」** 이다(§6-A-0 — transient 수명).

---

## 6. 🟢🟢 [종료] **CORE-2U-A — 가격은 살아 있고 SAME 은 거짓말하지 않는다**(`c6c0891e`)

> 🔴🔴 **진입은 이 절 하나다.** 🔴 **CTO 가 할 코드 작업이 없다.** 다음 범위는 CPO 지정.
> 🟡 남은 것은 **CEO 화면 확인 1회**(§6-A-0 의 경로 결정이 **선행** — 「새 상품 분석」으로).

🔴🔴🔴 **먼저 — CEO 화면이 「국내 가격 형성대  유사상품 1」로 떴고 CPO 가 반려했다.**
그 숫자의 근거가 `COMPARISON`(유사상품)이라서 **「형성대」라 부르면 의사결정 기준이 틀린다**.

🔴 **두 값이 갈라지는 최초 좌표는 «하나» 다**(코드 확정 · **고치지 않았다**):
```
match-truth.ts:233 crossSellerReserved → :237 식별자 경로 **차단** → **TEXT_CONFIRMED**
  ├ domestic-product-link.ts:88 → **COMPARISON**    (참고 축 통과 → 금액이 선다)
  └ match-display.ts:268        → **PRESUMED_SAME** (SAME 축 탈락 → 「동일상품 0」)
⟹ 🔴 국내에서 SAME/EXACT 는 **구조적으로 도달 불가** 다 — 그 완화는 WU-066 실측
   precision **91.7% → 55.6%** 로 **영구 폐기**(8축 · threshold · crossSellerReserved FREEZE).
```

🟢 **CPO 결정 A — 가격을 «없애지 않고» 이름을 정직하게 가른다**
```
① 제목 「국내 가격 형성대」 → **「국내 참고가격」**(CORE-2T 의 이름을 되돌렸다)
   🔴 **「형성대 / 가격대」는 SAME 가격이 있을 때만 쓴다**
② 금액 **바로 아래** 「**동일상품으로 확정된 국내 판매처는 없습니다**」
   🟢 그 블록은 `sameCount === 0` 분기 안에만 있다 ⟹ **구조적으로 항상 참**
③ 「유사상품 1」(내부 등급 분포)을 **국내에서 끈다** — 기본값 true 라 **해외 불변**
④ 가격이 1차에 섰으면 **후보 수를 또 말하지 않는다**(숫자 하나) · 조건부라 기존 동작 불변
⑤ MI 보류 줄을 **▸ MI 상세 분석 2차로 이동**(삭제 0)
⑥ 「유사상품까지 포함한 참고 축」 내부 어휘 **제거** · 가격 판단 기준 문장 교체
🔴 SAME · crossSellerReserved · threshold · 8축 · 검색 · 가격 수집 · 해외 가격 ·
   market classification · 원가 · 마진 · 추천가 · 수익성 — **전부 변경 0**
```

🔵 **CPO 판정 대기 1건(고치지 않았다)** — 🌎 해외에도 **같은 성질의 모순** 이 있다:
제목이 「해외 **동일상품** 참고가격」인데 `tierNote` 가 「**동일상품 1 · 유사상품 1**」이다.
🔴 §9(해외 변경 금지)를 지켜 **그대로 뒀다.** 계약으로 잠긴 곳은 없어 끄는 것은 **1줄** 이지만
그것은 **해외 화면 변경** 이라 CPO 범위 결정이다.

🟢 계약 신규 **17**(Case A~F · 숫자 하나 · 금지축) · 기존 3 갱신 · 변이 **U1~U5 전부 FAIL →
복구**(흔적 0) · 회귀 **793 files / 9,038 passed / 1 failed**(`p54c1` · 합산 제외) ·
typecheck 0 · build 0 · 배포 `ttaejyo-rns81d5k2` ● Ready · `/` 200 · 307 · 401.

🔴 **음성대조에서 내 단언 둘이 틀렸고 코드가 맞았다** — ⒜ 첫 화면 전체에서 「판매처 1곳」을
금지했는데 그것은 **해외 축의 기존 어휘**(§9 충돌) ⒝ `costPrice` 를 금지했는데 그 prop 은
CORE-2S §5-⑤ 의 **CPO 승인** 항목이고 **계산 0** 이다 ⟹ 금지를 **「계산」** 으로 좁혔다.

### 🟡 6-U. CEO Action — **화면 1회**
```
/pipeline → **B226AC009 URL 붙여넣기 → 분석** (🔴 저장된 스냅샷을 그냥 열면 안 뜬다 · §6-A-0)
확인 하나 — 「국내 참고가격 **KRW 88,000**」과 「**동일상품으로 확정된 국내 판매처는 없습니다**」가
          **모순 없이** 보이는가.
🔴 「동일상품 확인 0곳」 자체는 **정상** 이다 · 「형성대」라는 말이 보이면 **FAIL** 이다
```

---

## 6-T. 🟢 [종료] **CORE-2T — 국내 가격 «형성대» 가 화면까지 간다**(`6405f784`)

> 🔴🔴 **진입은 이 절 하나다.** 🔴 **CTO 가 할 코드 작업이 없다.** 다음 범위는 CPO 지정.
> 🟡 남은 것은 **CEO 화면 확인 1회**(§6-A-0 의 경로 결정이 **선행** 이다).

🔴🔴🔴 **먼저 — 「조사에서 사라진다」는 «사실이 아니었다».** 라이브 실측(B226AC009)으로 확정:
```
② 목록 탐색 → 상세 URL **2건**        ③ 후보 accepted 2 · usable 2 · miEligible 2
④ donokids     COMPARISON · KRW 88,000 · VERIFIED_CURRENT · market KR(등록부)
   miniboutique COMPARISON · KRW 88,000 · VERIFIED_CURRENT · market KR(.kr TLD)
⑦ comparison **2곳** avg=88,000      ⑧ 후보 2건 · **고유 URL 2건** ⟹ 🟢 **중복 0**
🔴 그래서 **검색·수집·MI 를 한 줄도 건드리지 않았다**(§17 그대로).
```

🔴🔴 **결함은 «전달의 마지막 한 줄» 이었다**:
```
🔴 A  `highestAmount` 는 CORE-2R-5 가 **이미 집계** 하는데 `buildOverseasReference` 가
      그 칸을 **한 번도 읽지 않았다** ⟹ 금액이 **서로 달라도** 최저가 한 줄만 떴다
      = CPO 가 지적한 **「단일 참고가격으로 보이는 상태」**
🔴 B  집계 레코드에 **URL 도 도메인도 없었다** ⟹ 「판매처 N곳」이 **수집 레코드 수** 이고
      중복을 **막을 방법이 없었다**
```

🟢 **고친 것 셋**
```
① 화면이 최고가를 읽는다 — `KRW 83,600 ~ 88,000`
   🔴 **1건·같은 금액은 범위로 만들지 않는다**(§4 · `88,000 ~ 88,000` 금지 · 판별은 «금액» 비교)
② 어휘 — 「국내 참고가격」 → **「국내 가격 형성대」** · 「판매처」 → **「확인 N곳」**
   🔴 해외는 **기본값 그대로**(「🧾 해외 동일상품 참고가격」·「판매처 N곳」 · §9 불변)
③ 중복이 **구조적으로** 막힌다 — 옵셔널 `sellerKey`(국내=도메인)로 **판매처당 최저 확인가
   하나** 로 접는다(D1·D3). 🔴 실측 효과 **0**(고유 URL 2 · 도메인 2) — 전제(sink 샵당 1건 ·
   러너 canonical 중복제거)가 바뀌면 숫자가 **조용히 틀려지므로** 둔다 · 🔴 해외엔 안 넘긴다
```

🔵 **CPO 판정 대기 1건** — §4 예시는 `₩83,600 ~ ₩88,000` 인데 **`KRW 83,600 ~ 88,000`**(ISO)로 냈다.
그 영역의 `₩` 는 **계약 6건이 금지** 하고 근거가 실측이다(`convertToKrw` 가 모르는 통화를 그대로
KRW 로 취급해 `CAD 64` → **「약 ₩64」**). 🔴 기호 표기는 **가격 표시 정책** 이다.

🟢 계약 신규 **9**(`core-2t-domestic-price-band`) + `core-2r5` C-3~C-6 · `wu-056` 형성대 3 ·
갱신 4(`wu-049`·`wu-061`·`mi-020`·`core-2s`) · 변이 **T1~T5 전부 FAIL → 복구**(흔적 0) ·
회귀 **792 files / 9,021 passed / 1 failed**(`p54c1` · 합산 제외) · typecheck 0 · build 0 ·
배포 `ttaejyo-c1xdlrnve` ● Ready · `/` 200 · `/pipeline` 307 · `/check` 401.

🔴 **원가 · 마진 · 추천 판매가 · 수익성 · SAME · 검색 · 해외 가격 — 전부 변경 0.**
🔴 **CORE-3A(원가 입력) 작업지시서는 CPO 가 철회했다** — 그 축을 열지 않는다(§2-B).

### 🟡 6-T. CEO Action — **화면 1회**
```
https://ttaejyo.vercel.app/pipeline → **B226AC009 URL 붙여넣기 → 분석**
   🔴 저장된 스냅샷을 그냥 열면 transient 참고가격이 **뜨지 않는다**(§6-A-0)
기대  🇰🇷 **국내 가격 형성대 / KRW 88,000 / 확인 2곳**
      🔴 금액이 **같으므로 범위가 아닌 것이 정상** 이다(§13-D4)
확인  ① 형성대가 보이는가 ② 실제 조사 가격과 같은가 ③ 확인 수가 unique 판매처 수인가
      ④ 같은 가격/판매처가 중복 표시되지 않는가 ⑤ 🌎 와 섞이지 않는가
      ⑥ 「동일상품 확정 0곳」과 혼동되지 않는가 ⑦ 재분석을 요구하지 않는가
```

---

## 6-S. 🟢 [종료] **CORE-2S — 셀러 화면이 「0곳」 대신 «가격» 을 먼저 말한다**

> 🔴🔴 **진입은 이 절 하나다.** 상세 근거·좌표는 `docs/HANDOFF-CORE-2S.md`(막혔을 때만).
> 🔴 **CTO 가 할 코드 작업이 없다.** 다음 범위는 **CPO 가 지정** 한다.

🟢🟢 **CORE-2R 트랙(수집→전달)은 CLOSED** — CEO Production 확인으로 사슬이 닫혔다:
```
🇰🇷 국내 참고가격 **KRW 88,000 · 판매처 1곳**   🌎 GBP 37 · USD 58
배포 `aa8b7e5e → 1027fbf1`(2R-4·5·6·7) · ttaejyo-in0nlfuzx ● Ready · clean · 0/0
```
🔴 **다시 열지 않는다** — 국내/해외 검색 · 2-hop · SAME/MI · 가격 추출 · 시장 분류 ·
`EXACT/COMPARISON` 정책 · crossSeller · 새 쇼핑몰/adapter/AI.

### 🔴🔴 CORE-2S 가 고친 것 — **「1곳 ↔ 0곳」은 모순이 아니다**

```
🔴 전 화면: 🇰🇷 블록이 **「동일상품 확인 0곳 — …」을 먼저** 말하고 그 **뒤** 에
   `KRW 88,000` 이 섰다 ⟹ 셀러가 「0 이니까 가격도 없다」로 읽었다.
   그리고 같은 「0」이 **네 곳**(결론 · verdict · 🇰🇷 · 🌎)에서 반복됐다.
🟢 ⓐ 블록 안 **순서를 뒤집었다** — 위는 돈(🇰🇷/🧾) · 아래는 판정(**「🔎 동일상품 확인」** 라벨)
🟢 ⓑ **🌎 해외 참고가격을 1차로 올렸다**(전엔 접힘을 열어야 보였다 — 🇰🇷 와 비대칭)
     🔴 **복제가 아니라 이동** — 2차 두 칸은 `reference={null}` 로 껐다(금액 화면에 1회)
🟢 ⓒ 결론(`seller-decision`)이 **참고가격을 말한다** — 새 상태 `NO_SAME_WITH_REFERENCE`
     🔴 결론에 **금액을 적지 않는다**(금액 owner 는 두 블록 하나)
🟢 ⓓ **「💡 가격 판단 기준」 신설** — 「왜 그 가격인가」를 자연어로(금액 0 · 내부 토큰 0 ·
     전부 **조건부**). 🔴 ③ 수익성의 `ⓘ 가격 계산 기준`과 **다른 이름** 이다
🟢 ⓔ **「🧾 현재 판단」 신설** — 원가 없으면 「수익성 판단 보류 · 원가 입력」 + 「시장가격을
     **찾지 못한 것이 아니다**」 (UNKNOWN ≠ 실패) · 🔴 계산 **0**(추천가·마진·예상수익)
🟢 ⓕ **중복 제거** — `market-verdict`(분류 라벨)를 `▸ MI 상세 분석` 2차로 **이동**(삭제 0)
🟢 ⓖ **셀러에게 일을 돌려주지 않는다** — 「사진으로 확인해 주세요」 **2곳 제거**
     (`MARKET_EMPTY_REVIEW_HINT` · `pendingNote`) + `MI_SAME_AREA_SCOPE` 1곳
🔴 MI · threshold · SAME 판정 · 집계 · 가격 수집 · 2-hop · DB · 등록 · 환산 **전부 0**
```

🔴🔴 **WU-154 계약이 못 잡은 자리를 CORE-2S 가 잡았다 — 이 교훈을 남긴다**:
> `wu-154 A-2` 는 「셀러에게 조사를 요구하는 말」을 **`MarketPriceComparison.tsx` 소스**
> 에서만 금지했다. 🔴 그런데 그 문장들은 **상수 파일**(`mi-same-candidates.ts`)에 있어서
> **살아남았다.** 🟢 그래서 CORE-2S 계약은 **마운트 DOM 의 「첫 화면 텍스트」** 로 본다
> (닫힌 `<details>` 를 떼어 낸 뒤) — 문구를 어느 파일에 적어도 잡힌다.

🟢 계약 **신규 34**(`core-2s-seller-screen`) · 기존 **4건 갱신·강화**
(`core-2r5` A-4 + **A-4-b 신설** · `wu-056` 배선 · `wu-132` B-6 · `wu-130` F-3) ·
변이 **M1~M10 전부 FAIL → 바이트 동일 복구**(md5 대조 · 흔적 0).

🔴🔴 **그 변이가 내 가드의 구멍을 하나 찾았다(적어 둔다)** — `marketDecisionLines(judgement,
references)` 의 **두 번째 인자를 떼어도 C-1 이 통과** 했다(순수 함수를 **직접** 불렀기
때문 · WU-110 이 적어 둔 그 함정). 🟢 **마운트 DOM 축(C-1-b) + 소스 앵커** 를 더해 잠갔다.

### 🔴🔴🔴 6-A-0. **먼저 — 「진입만」으로는 참고가격이 뜨지 않는다**(코드 확정 2026-10-25)

🔴 CPO 가 CEO 테스트에서 「🔄 다시 분석」을 **제외** 했고, 그 조건으로는 기준 1~5 가
**전부 FAIL 로 보인다.** 🔴 그것은 **CORE-2S 결함이 아니라 transient 수명 구조** 다:

```
① 참고가격은 transient 다 — **GET 경로가 싣지 않는다**
   `[snapshotId]/route.ts:22  computeMarketIntelligence(snapshotId, workspaceId)` ← 인자 2개
   🟢 문구 자체가 그렇게 적혀 있다(`DOMESTIC_REFERENCE_SCOPE`):
      「이번 확인에만 쓰이고 저장되지 않습니다 — **새로고침하면 사라집니다**」
② 자동 1회차 POST `/check` 는 **`isFirstInsert` 블록 «안»** 에만 있다(`page.tsx:529`).
   🔴 그 주석이 직접 말한다 — 「탭 이동/리렌더/**새로고침** 은 그 블록을 다시 타지
      않으므로(`snapshotIdRef` 가 이미 채워짐) **자동으로 재호출되지 않는다**」
③ ⟹ **이미 저장된 스냅샷을 그냥 열면** `autoCheckResult = null` ⟹ 두 참고가격 `null`
   ⟹ 🇰🇷/🌎 는 「동일상품 확인 0곳 — 후보를 찾지 못했습니다」만 뜬다
🟢 직전 CEO PASS(🇰🇷 88,000)도 **「🔄 다시 분석」 경로로 얻은 값** 이다
```

🟡 **그래서 CEO 경로는 CPO 결정 대기** 다. CTO 가 고르지 않았다:
```
⒜ 🟢 **권고 — 「새 상품 분석」으로 B226AC009 URL 투입**
     `isFirstInsert` → 자동 1회차 발화 ⟹ 셀러가 **아무것도 누르지 않아도** 채워진다
     🟢 **재분석 요구 0** 이고 실제 셀러 **첫 사용 경로** 다(전략과 같은 모양)
⒝ 🔴 「🔄 다시 분석」 1회 — CPO 가 조건에서 제외했다
⒞ 🔴🔴 참고가격 **영속화** — **WU-059 가 금지한 축**(참고가격이 그것을 만든 POST 보다
     오래 살아 **옆의 판정(GET=DB 전용)과 벌어진다**) ⟹ 제품 정책 · CTO 가 열지 않는다
```

🟡 **그리고 이것이 드러낸 별개의 제품 구멍 1건**(고치지 않았다 · CPO 판정):
> 셀러가 **어제 분석한 상품을 오늘 다시 열면 시장가격이 비어 있다.**
🟢 CORE-2S 가 만든 것이 **아니다** — 전부터 그랬고 가격을 1차로 올려 **눈에 띄게 됐을 뿐** 이다.
🔴 해소는 ⒞ 또는 「진입 시 자동 재조회」이고 **둘 다 §00-B 가격 보류·WU-059 금지축** 에 걸린다.

### 🟡 6-A. CEO Action — **화면 1회** (🔴 위 6-A-0 의 경로 결정이 **선행** 이다)

```
① 🇰🇷 블록에서 **가격(KRW 88,000 · 판매처 1곳)이 「동일상품 확인 0곳」보다 «위»** 에 있는가
② 🌎 블록에 **GBP 37 · USD 58 이 «접힘을 열지 않고»** 보이는가(🇰🇷 와 같은 모양인가)
③ 「💡 판매 판단」 결론이 **참고가격이 있다는 사실을 말하는가**(「없습니다」로만 끝나면 FAIL)
④ 「💡 가격 판단 기준」이 **그 가격이 무엇인지** 를 설명하는가
⑤ 「🧾 현재 판단」이 **「원가를 입력하면 수익을 계산한다」** 로 보이는가
   (「데이터 없음」·「실패」로 읽히면 FAIL)
⑥ **같은 금액이 두 곳에 뜨지 않는가** · 같은 「0곳」이 반복되지 않는가
⑦ 셀러에게 **후보를 고르라거나 다시 분석하라고 요구하지 않는가**
```
🔴 「동일상품 확인 **0곳**」 자체는 **정상** 이다(등급이 보류라는 사실의 표시).
🔴 원가 미입력이라 최종 판단이 **UNKNOWN** 이어도 정상이다 — ⑤가 그것을 설명한다.
🔴 **CTO 는 실제 따져 화면을 볼 수 없다** ⟹ 「Production UI PASS」로 적지 않는다.

---

### 🔴 [그때의 기록] CORE-2R-4/5 배포 시점 메모

> 🔴 아래 「CORE-2R-4 ②③ 착수점」부터는 **그때의 기록** 이고 좌표가 아니다.

```
배포   `aa8b7e5e → eacee468` **2커밋**(CORE-2R-4 · CORE-2R-5) · clean · ahead 0 / behind 0
       Production `/` **200** · `/pipeline` 307 · `/api/price-history/check` 401(정상 보호)
게이트 typecheck 0 · build exit 0 · 회귀 **790 files / 8,963 passed / 1 failed**
       🔴 유일한 실패 `p54c1-grounding-redirect` — 이 트랙과 무관하고 CPO 가 **합산 제외**
```

🟢🟢 **「국내 가격을 못 찾는 단계」는 끝났다**(CPO 문장). 등록부 진입점만으로:
```
B226AC009 → 국내 목록 2-hop → 상세 URL 2건 → KRW 88,000 ×2(VERIFIED_CURRENT)
          → market KR → COMPARISON → **국내 기준가 88,000** → computeSellability
🟢 반사실(원가 40,000 가정) → **GREEN** · 🔴 원가 미입력이면 UNKNOWN 이 **정상**
```

🔴🔴 **여전히 0 인 것 하나 — 그리고 그것이 정상이다**: 두 후보가 `PRESUMED_SAME` 이라
화면의 **SAME 축(동일상품 확인 가격)은 0** 이다. 🟢 그 자리는 **국내 참고가격**(위 88,000)이
1차 🇰🇷 블록에 선다. 🔴 **SAME 게이트를 열지 않는다**(CPO 확정 — 그 방향으로 가면 안 된다).

🟡 **CEO Action — 화면 1회**(§12 형식 · `/pipeline` → B226AC009 → 🔄 다시 분석):
```
① 🇰🇷 블록에 **국내 참고가격 KRW 88,000** 이 보이는가(「찾지 못했습니다」만 뜨면 FAIL)
② 같은 금액이 **두 곳에 뜨지 않는가**
③ 🌎 해외(GBP 37 · USD 58 계열)와 **섞이지 않는가**
④ 「🔄 다시 분석」이 **있는가**
🔴 「동일상품 확인 0곳」은 **정상** 이다 — 등급이 보류(PRESUMED_SAME)라는 사실의 표시다
🔴 원가 미입력이라 최종 판단이 **UNKNOWN** 이어도 정상이다
```

🔵 **다음 범위는 CPO 가 지정한다.** 🔴 CTO 가 선제적으로 열지 않는다.

---

### 🔴 [그때의 기록] CORE-2R-4 ②③ 착수점

> 🔴🔴🔴 **다음 세션은 `docs/HANDOFF-CORE-2R-4.md` 를 읽고 «STEP 2 구현부터» 시작한다.**
> 그 문서에 **13절**(제품 목적 · 역할 · 배포/DB 상태 · A단계 원인 · WU-063 정리 ·
> 작업 순서 ①~⑨ · 파일·함수·라인 좌표 · 허용/금지 · B226AC009 E2E 목표 ·
> CEO 1회 · 토큰 절약 · **이전 실수 2건과 함정 7** · 보고 형식 · 첫 명령)이 **전부** 있다.
> 🔴 **재조사 금지** — 좌표는 코드/DB/실측으로 확정된 값이다.

🟢🟢 **배포 완료** — `2364b048 → aa8b7e5e`(18커밋) · `ahead 0 / behind 0` ·
Production `/` **200** · `/pipeline` 307 · `/api/price-history/check` 401(정상 보호).
그 안에 WU-145/146/148/**149**(후보 연구 UI 제거·가격 owner 단일화)가 들어 있다.

🔴🔴 **CORE-2R 은 OPEN.** CEO 화면 FAIL 의 원인은 **A 단계** 로 확정됐다 —
`donokids` 후보가 **운영에서 생성되지 않는다**(게이트 둘 · 아래 ②).

### 🔵🔵 **CPO 최종 확정(2026-10-24) — 다음 세션은 «STEP 2 구현» 부터다**

🔴 **재조사 금지.** 아래 순서 ①~⑨ 가 CPO 확정이고 조사는 전부 끝나 있다.

```
① 기존 WU-149 **코드/계약** 확인   🔴 Production UI PASS 로 주장하지 않는다(화면 못 봄)
② **2-hop production wiring**     ← 🟢 **여기부터 구현**
③ **별도 `marketEvidence`** 최소 추출 구조 추가
④ evidence **composite** 로 KR / OVERSEAS / UNKNOWN 판정
⑤ B226AC009 → Dono **₩88,000** 실제 연결
⑥ `domestic.exact.averagePriceKrw` → 기존 MI
⑦ seller UI / 중복 / 다시 분석 확인
⑧ 회귀 + clean + 배포
⑨ 그때 **CEO 최종 1회** 테스트
🔴 그리고 **하니스 결과를 E2E 라고 부르지 않는다**(CPO 명시 · 내가 틀린 자리).
```

🔴🔴 **③ 의 타입 설계가 수정됐다 — `ProductFacts` 에 넣지 않는다**
```
❌ `ProductFacts` 14칸에 시장정보를 **추가하지 않는다** — 그 타입은 **상품
   identity/evidence 용** 이고, 섞으면 「상품 ↔ 판매자/사이트 ↔ 시장」이 다시 뒤섞인다
🟢 **별도 구조** 로 붙인다:
     ComparisonCandidate
       ├─ productFacts
       └─ **marketEvidence**
🟢 추출은 **이미 Fetch 한 HTML** 에서 한다 — **추가 HTTP 원칙적으로 0**
   (`fetchPlainHtml` 이 본문을 이미 받는다 · WU-053 microdata reader 와 같은 모양)
```

🔵 **③ 최소 범위(CPO 고정) — 처음부터 전부 구조화하지 않는다**
```
강한 증거  businessRegistration · mailOrderRegistration · businessAddress ·
          customs / import-duty / customs-clearance 신호
보조 증거  shipping · payment · 기존 TLD / currency / domain
판정       기존 데이터 → marketEvidence → **복수 증거 종합** → KR / OVERSEAS / UNKNOWN
🔴 **어느 한 필드 하나만으로 KR 을 확정하면 안 된다**(WU-063 이 금지한 그 모양) —
   🟢 WU-063 과 **충돌하지 않는다**: 그것이 막은 것은 「단일 신호를 결정자로」이고
      이번은 「여러 증거를 모으는 구조」다(CPO 정리).
```

🔵 **⑤ 첫 운영 대상은 하나다** — `donokids.com / B226AC009 / ₩88,000`.
🟢 `costPriceKrw = null` 이라 **UNKNOWN 으로 끝나도 PASS** 다(원가/마진 시스템을 만드는 일이 아니다).

🔴 **CLOSED 유지(건드리지 않는다)** — SAME 기준 · product-code weighting ·
`crossSellerReserved` · MI threshold · 가격 계산 · `computeSellability` · 추천 판매가 ·
마진 · 검색엔진 · AI API · 신규 adapter · 국내 가격소스 대량 등록.

### 🔴 좌표 상세 — ②③ 하나로 묶인다(조사는 끝났다)

```
② **2-hop 수집기 운영 배선**(새 검색 0 · 새 어댑터 0 · donokids 하드코딩 금지)
   🟢 모듈은 **이미 있다** — `_lib/domestic-listing-hop.ts`(1-hop · sitemap/robots) ·
      `_lib/domestic-listing-hop-2.ts`(2-hop · 목록 텍스트로 상세 URL 선별)
   🔴 **운영 호출부 0**(전수 grep 확인) ⟹ 그 둘을 후보 공급 경로에 **최소 연결** 한다
   🔴 막는 게이트 둘(`comparison-search/index.ts`)
      :271  collectionStrategy 가 AUTO_API/AUTO_SCRAPE 아니면 **unsupported**
      :278  `findPriceSourceAdapter(domain,"DOMESTIC")` 없으면 **unsupported**
      ⟹ 🔴 **등록부 경로로는 못 연다**(CPO 가 새 어댑터를 금지했다)
   🟢 그래서 붙일 자리는 **transient 생산자** 다 — `TRANSIENT_SHOP_IDS` 에 네 번째를
      더하는 모양이고 WU-130 이 `__overseas_auto__` 로 **같은 일을 이미 했다**(그 선례를 베낀다)
   🔴 계약 넷을 같이 지킨다 — ⒜ 일시 샵 집합에 **반드시 추가**(안 하면 DB 로 흘러간다)
      ⒝ `shopId` 를 등록부 uuid 로 넣지 않는다 ⒞ `GeminiTransientEvidence.source` 를
      **새 값으로 가른다** ⒟ 국내 등록부 후보는 sink 로 보내지 않는다(이중 집계)

③ **Registry 의존 제거** — 🟢 **CPO 가 WU-063 충돌을 정리했다(2026-10-24)**
```
🟢 WU-063 은 **유지** 된다 · `mi-020` 도 **폐기하지 않는다**
🔴 금지 — 신호 «하나» 로 KR 강제: `lang=ko` 단독 · 사업자등록 단독 ·
   `.com+KRW` 단독 · **registry 등록 단독**
🟢 허용 — TLD · currency · URL/domain · 기존 Extract · shipping · customs ·
   payment · business information · footer · address · 판매조건을 **종합**
🟢 부족하면 **최소 추가 evidence** · 그래도 불명확하면 **UNKNOWN**
🔵 그래서 ③ 의 첫 일은 「**KR 판정용 composite evidence gate 가 현재 데이터로
   가능한가**」를 **측정** 하는 것이다(CPO 문장 그대로).
```

🔴🔴 **그 첫 질문의 답은 이미 나왔다(2026-10-24 코드 전수 확인)**:
```
`ProductFacts`(packages/shared) · `ComparisonCandidate`(crawler types) ·
`product-data-extractor` 전수 grep —
  businessRegistration · 사업자 · 통신판매 · mailOrder · bizNo ·
  companyAddress · customsCode · 통관   ⟹ **칸이 하나도 없다(0건)**
🟢 `ProductFacts` 의 실제 칸은 14개다 — urlSlug · brand · brandModelCode ·
   sellerSku · title · coreTitleTokens · categoryText · colorText · materialText ·
   fitText · ageRangeText · sizeLabels · audienceSignals · imageUrls
⟹ 🔴🔴 **composite gate 는 「현재 데이터」로 불가능하다** — 종합할 증거 칸이 없다.
   🟢 그러므로 ③ 은 **「최소 추가 evidence 수집」이 선행** 이고(CPO 가 허용한 그 축),
      그 수집은 **본문 1회 fetch 로 가능** 하다(`fetchPlainHtml` 이 이미 HTML 을 받는다 ·
      WU-053/CORE-2L 선례 — 추가 HTTP **0** 으로 순수 파서를 더하는 모양).
   🔴 단 **그 칸을 추가하는 것** 이 운영 타입 변경이므로 CPO 범위 확인이 필요하다
      (CPO §7 「허용 — **필요한 최소 market evidence extraction/gate**」에 해당한다고 읽힌다).
```

🔴 **옛 ③ 메모(아래)는 CPO 정리 이전 버전이다 — 위 블록이 이긴다.**

③-old **Registry 의존 제거**(CPO 가 이번에 새로 지시한 축)
   🔴 현재 `classifyCandidateMarket` 의 `REGISTERED_SHOP_AND_KRW` 가 KR 근거다
      (`run-domestic-price-check.ts:1574` ← `registeredDomains`)
   🔴 CPO: 「`domestic_price_sources` 를 국내 판정의 **권위 있는 근거로 쓰지 않는다**」
   🟢 대체 축은 **사이트 자체 증거** — 사업자등록번호 · 통신판매업 신고번호 ·
      국내 주소 · 배송/반품 · 개인통관고유부호. 🟢 `donokids` 페이지에 **실재한다**(CPO 확인)
   🔴🔴 **그러나 WU-063 이 그 축을 이미 측정해 REJECT 했다** —
      「페이지 단위 신호(사업자등록·`lang=ko`)는 **같은 샵에서 갈린다**」(donokids
      C21✓C22✓**C43✗**) ⟹ 🔴 그 선례를 **반드시 먼저 읽고** 설계해야 한다.
      🟡 CPO 지시가 그 REJECT 를 **덮는지** 가 첫 판단이다(CTO 가 정하지 말고 확인).
   🔴 그리고 WU-020 계약 `mi-020` 이 「KR 증거는 `.kr` TLD · 등록부 **둘뿐**」을
      **테스트로 잠가 뒀다** ⟹ 그 계약 갱신이 동반된다
   🟢 DB 의 `donokids` 행은 **삭제하지 않는다**(CPO 명시) — 다만 KR 판정 원인이 되면 안 된다
```

🔵 **그 뒤 ⑥⑦ 은 «배포 후 화면» 을 봐야 한다** — 가격 중복(`CommerceWorkspace.tsx:3884·3900`
의 자기 검색 패널 둘)은 **WU-149 가 제거했다고 기록** 돼 있고 그 WU 가 **이번에 처음 배포됐다**
⟹ 🟡 **이미 해결됐을 수 있다.** 🔴 추측해서 고치지 않는다 — CEO 화면 증거가 먼저다.
🟢 「🔄 다시 분석」도 같다 — 경로(`POST /api/price-history/check`)는 **이미 있다**.

🔴 **CTO 가 ②③ 을 이번 세션에 착수하지 않았다**(헌장 §4-C 용량 판단) — 운영 파일 다수
변경 + 측정 + 회귀 + 배포를 한 세션에 끝낼 수 없고, **작업트리를 더럽힌 채 끊는 것이
가장 나쁘다**. 🟢 조사는 **끝났고** 위 좌표로 바로 구현에 들어갈 수 있다.

---

## 6-B. [종료] CORE-2R-2 — 국내 88,000 → MI 입력 하니스 검증

## 6-C. [종료] CORE-2M — 육안 판정 화면 생성

🟡 **CORE-2M — 화면 준비 · CEO 판정 수신 완료**

🔴🔴 **진입은 이 절 하나다.** 운영 코드 **0** · 배포 **0** · **push 0**.
🟡 **CEO 액션 — 아래 화면에서 10건 판정 1회**(15~25분).

```
화면   https://claude.ai/code/artifact/dbdb6d4e-a58c-45a3-bc80-582c683dffda
파일   docs/core-2m-visual-review.html (6.30MB · 자립형 · 원격 이미지 0)
생성기 apps/.../__tests__/core-2m-visual-review-build.test.ts
```

🟢 **방향이 바뀌었다**(CPO 2026-10-24) — MI 가 **결론을 내는 것이 아니라** CEO 가 판단할
수 있게 **비교 재료를 압축해 보여준다**. CEO 판정이 **MI 의 정답 데이터** 가 된다.

```
검토 대상            **10**   (MI 가 SAME 을 확정하지 못한 후보 전부)
MI 확정 SAME(제외)    **3**    tinyapple · trenbe · thefrontshop → 가격 근거로 바로 간다
측정불가(제외)        **1**    miniboutique.co.kr(4회 연속 UNREACHABLE)
🟢🟢 이미지 확보      **10 / 10**
```

🔴 **3단 점진 공개** — 처음부터 20개 항목을 보여주지 않는다(CPO 명시).
`핵심(브랜드·품번·상품명·유형·핵심어) + 사진` → `▸ 추가(색상·소재·핏·대상·사이즈)`
→ `▸ 기타(판매처 SKU·URL·상세설명 발췌·추가 이미지)`. CEO 는 **동일 / 유사 / 판단불가** 셋 중 하나.

🟢 **계약으로 잠근 것 다섯**(생성기 테스트)
```
① MI 내부 토큰 노출 **0** — `NO_TITLE_OVERLAP`·`PRESUMED_SAME`·`matchLevel`·
   `confidence`·`SAME_MIN_AXES` 등 **전수 단언**(CPO 「축 이름·점수 보여줄 필요 없다」)
② **원격 이미지 0** — 전부 `data:` URI(WU-093 에서 사진이 안 떠 12건이 측정불가가 됐다)
③ **미리 선택된 칸 0** — CTO 가 판정하지 않았다
④ 1단은 **펼쳐져** 있고 2·3단은 `details` 안이며 **핵심 표가 접힘보다 앞** 에 온다
⑤ 원상품 패널 **sticky** · 후보당 3택
```

🔴 **값을 지어내지 않았다** — `ProductFacts` 에 **패턴/디테일 칸이 없다** ⟹ 화면이
「수집하는 칸이 없습니다 — 사진으로 보셔야 합니다」라고 **직접 말한다**.
🔴 그리고 **「표기 같음 / 표기 다름」 칩은 «글자» 비교** 이고 상품 동일성 판정이 아니라고
화면에 **적었다**(그 구분을 안 적으면 CEO 가 시스템 판정으로 읽는다).

🔴 **이미지 보충을 숨기지 않았다** — 4건이 `imageUrls` 가 **애초에 비어 있었고**(그중 셋이
CPO 핵심 fixture) WU-100 선례대로 `og:image` → JSON-LD `Product.image`(둘 다 **표준 칸** ·
사이트별 규칙 0 · 운영 추출기 변경 0)로 보충했다. 🟢 그 사실을 **사진 밑에 적는다**.

🟡 **CEO 판정 뒤의 분류**(CPO 확정) — 동일 → **SAME fixture** · 유사 → **SAME 제외** ·
판단불가 → **추가 데이터 필요 사례로 분리**.

🔵 **CTO 가 할 코드 작업은 없다.** 🔴 정규화·identifier-only 승격·threshold·CATEGORY 는
**계속 닫혀 있다**.

---

## 6-D. [종료] CORE-2L — 본문 확대 반사실

🟡 **CORE-2L — 본문 확대는 «안전하지만 이득이 0.5건» 이다**

🔴🔴 **진입은 이 절 하나다.** 운영 코드 **0** · **push 0 · deploy 0** · CEO 액션 **없음**.
전문 하니스 `apps/admin/src/app/api/price-history/_lib/__tests__/core-2l-body-evidence-cf.test.ts`.

🟢 **CPO 5 KPI (분모 13 · `miniboutique` UNREACHABLE = 측정불가 1)**
```
                             ① 현재      ② +VISIBLE   ③ +RAW_HTML
① stockmann                  SIMILAR  →  **PRESUMED_SAME**  PRESUMED_SAME   🟡 변화 있음
② m.luxboy identifier leak     0      →      0              0              🟢 **증가 0**
③ Different-Code leakage       0      →      0              0              🟢 유지
④ seller-SKU 재오염            —      →      **0**          **0**          🟢 재오염 없음
⑤ negative fixture leakage     0      →      0              0              🟢 유지
🟢 human SAME **신규 SAME 회복 = 0**(VISIBLE·RAW 둘 다)
```

🔴🔴 **그래서 결론이 갈린다 — 「안전하다」와 「이득이 있다」는 다른 문장이다**
```
🟢 **안전성은 전 축에서 불변** 이다(②③④⑤ 전부 0 → 0) — 위험이 늘지 않았다
🟡 그러나 **SAME 회복은 0** 이다. stockmann 은 `SIMILAR → PRESUMED_SAME` 까지만 간다
   (= `TEXT_CONFIRMED` · **가격 참고** 진입이고 **동일상품 가격은 아니다**)
🔴 ⟹ CPO 가 「①의 이득보다 ②~⑤ 안전성이 우선」이라 했고, 안전은 지켜졌지만
   **이득도 「SAME 1건」이 아니라 「등급 한 칸」** 이다. 그 값을 과장하지 않는다
🟢 VISIBLE 과 RAW_HTML 이 **완전히 같은 결과** 다 ⟹ 더 위험한 RAW 를 쓸 이유가 없다
```

🟢 **핵심 fixture 넷 — 전부 CPO 기대대로**
```
stockmann.ee      null/unavailable/SIMILAR → **B226AC009**/exact/PRESUMED_SAME  🟡
m.luxboy.com      exact/PRESUMED_SAME → **변화 0**(세 조건 동일) 🟢 위험 증가 없음
junioredition.com `B226AB040`/conflict/CONFLICT → **①②③ 전부 유지** 🟢 안전장치 산다
kids21.com        null/unavailable → **①②③ 전부 판매처 SKU 재오염 0** 🟢 CORE-2K 유효
```

🔴 **반사실을 운영 primitive 로 만들었다** — 새 함수 **0**. `confirmBrandCodeInTitle`
(토큰 **전체** 일치 · 부분 일치 금지)에 본문을 넣었고, 운영의 **`=== null` 조건을 그대로**
복제해 **오염된 칸을 덮지 않는다**. 🔴 그래서 `226AC009` 는 본문에 있어도 **채택되지 않는다**
(donokids 는 ①②③ 전부 `unavailable` · **정규화 금지 유지** · 계약으로 잠갔다).

🔴🔴 **그리고 이 WU 가 «새 사실» 하나를 찾았다 — 같은 후보의 fetch 경로가 실행마다 갈린다**
```
`bobochoses.com`(GT 후보) 이 CORE-2K 측정에서는 `PLAIN_HTML`(품번 **null**) ·
CORE-2L 에서는 `SHOPIFY_JSON`(품번 **B226AB040** → **conflict/CONFLICT**) 이었다.
🟢 **CORE-2K 의 부작용이 아니다** — 그 slug 는 **글자로 시작** 해 가드와 무관하고,
   `compareModelCode` 가 공통접두 `B226A`(5자)로 **conflict** 를 내는 것은 설계다.
🔴 원인은 `product-url-facts.ts:285` 주석이 적어 둔 그것 — 「Shopify 로 «보였지만»
   JSON 이 없는 경우가 있다(일부 매장이 `/products/*.json` 을 막는다)」.
🔴🔴 ⟹ **그 후보는 실행마다 `CONFLICT` ↔ `PRESUMED_SAME` 으로 갈린다.** 고치지 않았다.
🟡 그리고 그 GT 후보는 **AC↔AB(baby) 라인** 사안이다(CEO 가 SAME 이라 라벨했지만
   품번 보호가 막는다) — **WU-048/069/112 가 HOLD 해 둔 그 축** 이고 CPO 가 닫아 뒀다.
```

🟢 게이트 — typecheck **0** · 회귀 **642 files / 8,908 passed / 1 failed**(`p54c1` · 합산 제외).

🔵 **CPO 단일 결정 대기** — 「본문 탐색을 실제 운영에 넣을지 / 닫을지」.
🔴 CTO 는 고르지 않았다. 🔴 정규화와 identifier-only 승격은 **계속 닫혀 있다**.

---

## 6-E. [종료] CORE-2K — seller SKU 오염 제거(운영 1줄)

🟢🟢 **CORE-2K — 운영 «코드 1줄» 로 Identity 칸을 정화했다**

🔴🔴 **진입은 이 절 하나다.** 🔴 **push 0 · deploy 0**(`662df3be`·`d04cd768` 포함) · CEO 액션 **없음**.
전문 하니스 `apps/admin/src/app/api/price-history/_lib/__tests__/core-2k-seller-sku-purity.test.ts`.

🟢🟢 **운영 변경이 정확히 «코드 1줄» 이다**(`git diff` 34줄 중 33줄이 주석):
```
packages/shared/src/product-facts.ts  `extractCodeLikeSlugSegment`
   + if (/^[0-9]/.test(first)) return null;     ← **숫자로 시작하면 판매처 재고번호다**
🟢 새 정책이 아니다 — 그 함수 주석이 **원래 그것을 약속** 하고 있었고
   (「판매처 재고번호가 여기 걸리지 않는다」) `kids21 700005621lbl` 로 깨져 있었다.
🟢 판별축도 **WU-071 이 이미 측정하고 보류** 한 그것이다(진짜 품번 전부 글자 시작 ·
   샵 SKU 전부 숫자 시작 · N=13 · 잃는 것 0). 🔴 WU-072 는 **recall** 목적이라 REJECT 했고
   CORE-2K 는 **Identity field purity** 목적이다 — **같은 축, 다른 질문**.
```

🟢 **CPO 6 KPI (분모 13 · 🔴 `miniboutique` UNREACHABLE = 측정불가 1)**
```
Seller-SKU pollution       1 → **0**        False CONFLICT            1 → **0**
Human SAME recovery        3 → **3**(변화 0 · 🟢 CPO 가 「0 이어도 PASS」 명시)
Different-Code leakage     **0** 유지        m.luxboy identifier leak  **0** 유지
Negative fixture leakage   **0** 유지
```

🟢 **CPO 요구 3건 개별 판정 — 전부 PASS**
```
kids21         `700005621LBL` → **null** · unavailable · CONFLICT → **PRESUMED_SAME/TEXT_CONFIRMED**
               🔴 **SAME 이 된 것은 아니다**(CPO 가정 금지 준수)
junioredition  `B226AB040` **유지** · **conflict 유지** · **CONFLICT 유지** 🟢 안전장치 산다
m.luxboy       품번 **exact** 인데 **PRESUMED_SAME/TEXT_CONFIRMED** —
               🟢 `NO_TITLE_OVERLAP` + `crossSellerReserved` **이중 잠금이 승격을 막는다**
```

🟢🟢 **최대 위험 통과** — 원상품 slug 도 같은 함수를 지나는데 **`B226AC009` 가 살아 있다**
(사라지면 확인 경로의 입력이 없어져 전체가 망가진다 ⟹ 계약으로 잠갔다).

🔴 **금지 축 전부 0**(소스 단언으로 잠금) — `SAME_MIN_AXES` · threshold · CATEGORY · TITLE ·
COLOR · **code normalization**(`226AC009` 는 여전히 `partial`) · `crossSellerReserved` ·
`NO_TITLE_OVERLAP` · `EXACT_IDENTIFIER` 승격조건 · MI verdict · 검색 · Adapter ·
Gemini/OpenAI/Naver · **데이터 모델 확장**(`ShopifyProductLike` 에 `sku` 칸 추가 0).

🟢 변이 **K1**(가드 무력화) **3 FAIL** · **K2**(과잉 — 숫자가 「있으면」 거부) **3 FAIL**
⟹ **양방향 잠금**(지우면 오염 복귀 · 넓히면 원상품 품번 소실). 바이트 복구 확인.

🔴🔴 **기존 계약 2건이 FAIL 했고 «의도된 변경» 이라 갱신·강화했다**:
```
`wu-071-l4-risk-shape` — 그 테스트가 **「둘을 가를 수 없다」** 고 적고 있었다.
   🟢🟢 CORE-2K 가 정확히 그것을 갈랐고, 이제 **양방향**(SKU 거부 + 품번 유지)으로 잠근다
`core-2j-identity-field-purity` — **결함 동작을 고정** 해 둔 줄이 뒤집혔다(설명은 보존)
```

🟢 게이트 — typecheck **0** · build **exit 0** · 회귀 **641 files / 8,906 passed / 1 failed**
(`p54c1` · CPO 가 합산 제외 명시 · `packages/crawler` 무관).

🔵 **CPO 결정 대기** — CPO 가 정한 다음 순서는 「**CORE-2K 결과 재판정 → 그때 `stockmann`
본문 탐색 여부 결정**」이다. 🔴 정규화와 identifier-only 승격은 **계속 닫혀 있다**.

---

## 6-F. [종료] CORE-2J — Identity 칸 순수성 조사

🔴🔴 **CORE-2J 완료 — CORE-2I 의 「국내 SAME」을 정정한다**

🔴🔴 **진입은 이 절 하나다.** 운영 코드 **0** · 배포 **0** · **push 안 함**(`662df3be` 포함).
전문 하니스 `apps/admin/src/app/api/price-history/_lib/__tests__/core-2j-identity-field-purity.test.ts`.

🔴🔴🔴 **먼저 — CORE-2I 의 두 숫자를 정정한다. 넘겨 읽지 않는다**:
```
⒜ 🔴 CORE-2I 는 `compareCrossSellerProducts` 를 **직접** 불러 `match.ts:627` 의
   **확인(confirm) 배선이 한 번도 돌지 않았다** ⟹ 그 base 는 **운영 값이 아니다**
   🟢 운영 순서(`withConfidence`)로 다시 재니 확인 배선이 **실제로 3건을 채운다** —
      biskuit · **trenbe(→ `EXACT_IDENTIFIER`)** · m.luxboy
⒝ 🔴🔴 **「donokids SAME」은 정규화 변경과 «같은 효과» 였다** — CORE-2I 가 넣은
   `226AC009` 는 **선행문자가 없는 꼴** 이고, 그것을 품번으로 인정하는 것이 곧
   CPO §6 이 금지한 변경이다. 🔴 **원형(`B226AC009`)만** 넣는 규칙으로 다시 재니
   **SAME 회복 = 0** 이다(donokids 는 전 자리가 「선행문자없음」).
```

🟢🟢 **그리고 CPO 가 요구한 분리 구조가 «이미 있다»** — `domestic-identifiers.ts:40`:
> 「품번을 **추출** 하지 않는다. 이미 확정된 품번이 제목에 있는지 **확인** 한다.」
```
불변식 셋이 「sellerSku 가 officialProductCode 를 대체하지 않는다」를 **구조로** 보장한다 —
① 해외에서 **이미 확정된** 문자열만 받는다  ② 산출은 `foreignCode` 아니면 `null` 둘뿐
③ ⟹ `compareModelCode` 가 **`exact` | `unavailable`** 밖에 못 낸다
   🔴 `partial`·`conflict` 를 **구조적으로 만들 수 없다**(지어낸 충돌 0 · 실측 확인)
🟢 판매처 SKU `700005621LBL` 를 넣어도 **채택되지 않는다**(실측 null)
```

🔴🔴 **오염의 생산자가 특정됐다 — 한 줄이다**
```
`seller-facts.ts:208`  extractLabeledProductCode(description) ?? **extractCodeLikeSlugSegment(slug)**
   🔴 그 slug 승격이 `kids21 700005621lbl` → `700005621LBL` 로 **conflict 를 지어낸다**
   🟢 공식 품번 slug 는 같은 함수가 **exact** 를 낸다(승격 자체는 유용하다)
   🟢 숫자만인 세그먼트는 **null**(WU-095 가드 작동)
🟢 `PLAIN_HTML` 경로는 `brandModelCode: **null**` 하드코딩이고 **그것이 의도** 다
   (포레포레 자체코드를 넣으면 「모델코드 충돌」을 지어낸다 — 소스 주석)
```

🟢 **오염 제거 효과 실측 2건** — `kids21` · `junioredition` 이 **CONFLICT → PRESUMED_SAME**
(= `TEXT_CONFIRMED` · 가격 참고 진입 가능) ⟹ **human SAME 둘이 살아난다**.
🔴 **그런데 「오염이 확인 경로를 막는다」는 내 가설은 이 분모에서 반증됐다** — 막힌 후보 **0**
(kids21 은 페이지에 품번이 없어 확인 경로도 `null` 이다).

🔴 **품번을 못 채우는 «정확한 이유» 둘이 확정됐다**
```
stockmann.ee  품번이 **본문에만** 있다 — 건초더미는 **title · url · sku** 셋뿐이다
donokids.com  전 자리(JSON-LD·`<title>`·본문)가 **「선행문자없음」**(`226AC009`)
              ⟹ `confirmBrandCodeInTitle` 의 **토큰 전체 일치** 를 통과하지 못한다
```

🔴🔴 **핵심 Negative fixture — `m.luxboy.com`(CPO 승격 지시)**
```
**human DIFFERENT** 인데 JSON-LD·meta·`<title>`·본문 **전부에 `B226AC009` 원형** 이 있다
⟹ 🔴 **확인 경로가 운영에서 그것을 `exact` 로 «이미» 채우고 있다**
🟢 그래도 `NO_TITLE_OVERLAP`(관측차이) + `crossSellerReserved` **이중 잠금** 이
   식별자 승격을 막아 `PRESUMED_SAME / TEXT_CONFIRMED` 에 머문다(CORE-2I M3+M4 로 측정)
🔴 ⟹ 「확인 경로는 판매처 SKU 를 막으므로 안전하다」로 **넘겨 읽지 않는다**.
🔴 그리고 `TEXT_CONFIRMED` 는 **COMPARISON(가격 참고)** 이라 그 금액이 국내 축에 들 수 있다
```

🟢 **Negative 전수 PASS** — 깨끗한 공급으로도 human DIFFERENT 의 **SAME 누출 0** ·
**식별자 등급 누출 0** · 같은 브랜드 다른 품번 **3/3 conflict** · 기존 fixture 유지.

🟢 게이트 — typecheck **0** · 회귀 **640 files / 8,903 passed / 1 failed**(`p54c1` · 무관).

🔵 **CPO 결정 대기(CTO 는 아무것도 고르지 않았다)**
```
① 🔴 **오염 제거**(slug 승격이 공식 코드체계와 충돌하는 값을 넣지 않게) — 효과 **2건**
   🟢 가장 좁고, 「모르면 UNKNOWN」이라는 CPO 원칙과 정확히 같은 방향
② 🟡 **건초더미 확대**(본문/description) — `stockmann` 1건. 🔴 그런데 `m.luxboy` 도
   같이 채워지므로 **이중 잠금에 더 의존하게 된다**
③ 🔴 **표기 정규화**(선행문자 없는 꼴) — `donokids` 가 걸려 있지만 CPO §6 이 **금지** 했다
④ 🔴 **식별자 단독 경로** — `m.luxboy` 반례 때문에 **위험**(CTO 권하지 않는다)
```

---

## 6-G. [종료] CORE-2I — Identity / Seller-data 분리

🟢🟢🟢 **CORE-2I — 국내 SAME 이 났다(단 위 ⒝ 정정을 같이 읽는다)**

🔴🔴 **진입은 이 절 하나다.** 운영 코드 **0** · 배포 **0** · **push 안 함**.
전문 하니스 `apps/admin/src/app/api/price-history/_lib/__tests__/core-2i-identity-vs-seller-data.test.ts`.

🔴🔴🔴 **CORE-2H 의 「세 축 중 열 가치가 있는 축이 없다」를 «정정한다»** — 그 결론은
**축 수(threshold)** 를 병목으로 봤지만, **진짜 병목은 「Identity 칸이 비어 있다」** 였다.

```
🟢🟢🟢 donokids.com  PRESUMED_SAME → **SAME / STRONG_IDENTIFIER**
   축 ["TITLE","MODEL_CODE","CATEGORY"] = 2+2+1 = **정확히 5점** · blockers **[]**
   🔴🔴 **`SAME_MIN_AXES = 5` 를 한 글자도 안 건드렸다** — 품번이 `partial`(2점)로
      들어오자 **기존 threshold 그대로** SAME 에 닿았다
   발화 조건 **둘 동시** — ⒜ 브랜드 복구(`brand-alias`) ⒝ **페이지에 적힌 품번**(`226AC009`)
🟢 **CF-BOTH SAME 4** · 그중 human DIFFERENT **0** · NEG-BOTH SAME **0/13**
```

🔴🔴 **병목의 실체 — 숫자 셋**
```
품번 칸이 **비어 있는** 후보            **11 / 13**
그런데 **페이지에는 품번이 있는** 후보     **4 / 13**
🔴 **둘 다**(= 읽을 수 있는데 안 읽는다)   **4** — biskuit · stockmann · m.luxboy · donokids
🔴 품번 칸이 **판매처 자체 SKU/다른 라인** 인 후보 **2** — kids21 `700005621LBL` ·
   junioredition `B226AB040` ⟹ 둘 다 **human SAME 인데 CONFLICT**
   🟢 그 칸을 **비우면 2/2 가 CONFLICT 를 탈출** 한다(→ PRESUMED_SAME)
```

🟢🟢 **Seller-managed 데이터는 SAME 축에 «없다»**(소스 전수 · 주석 제거 후) —
`PRICE` · `SKU` · `MARKET` · `URL` · `OPTION` 이 `axes.push` 에 **0건**.
🟢 고유 축 **9** = TITLE(2/1) · MODEL_CODE(**3**/2) · CATEGORY · COLOR · MATERIAL ·
FIT · AUDIENCE · SIZE · IMAGE(각 1). 🔴 품번 `exact` 는 **3점** 이고 혼자서 5 에 못 닿는다(설계).

🔴🔴🔴 **그러나 「Brand+Code 는 최강 증거」에 대한 실측 반례가 «우리 분모 안에» 있다**
```
m.luxboy.com  **human DIFFERENT** 인데 페이지에 `B226AC009` 가 있어 품번 **exact**
   🟢 막는 것은 **이중 잠금** 이다 —
      M3 단독(`crossSellerReserved` 제거)        변화 **0**
      M4 단독(`NO_TITLE_OVERLAP` 관측차이 제거)   변화 **0**
      **M3+M4** → **STRONG_IDENTIFIER = EXACT tier = 「동일상품 가격」** 🔴 누출
🔴 ⟹ **품번 exact 단독 승격 경로를 새로 만들면 틀린 가격이 동일상품 가격이 된다.**
🟢 CPO 가 CORE-2F/2G 에서 「`NO_TITLE_OVERLAP` 은 그대로 닫음」이라 한 그 결정이
   **이 측정으로 처음 직접 정당화됐다**.
```

🔴 **측정불가** — `miniboutique.co.kr` 이 **2회 연속 `UNREACHABLE`**(CORE-2H 에서는 읽혔다) ⟹
그 후보는 **0 이 아니라 측정불가** 다. 🔴 human DIFFERENT 분모 **2** 로 「leakage 0」을 강한
방어 증거로 쓰지 않는다.

🔵 **CPO 결정 대기(CTO 는 축을 고르지 않았다)** — ① **품번 추출**(Layer A 를 채우는 일 ·
threshold 와 무관) ② **Layer C 오염 제거**(판매처 SKU 가 Identity 칸을 점령하는 것)
③ 품번 **표기 변형**(선행 영문자 누락 = `partial`) ④ 식별자 단독 경로는 🔴 **위 반례 때문에 위험**.

---

## 6-H. [종료] CORE-2H — MI 3축 Counterfactual

### 🔴🔴🔴 다음 세션은 이 문단만 읽고 시작한다

```
CPO 요구 표(운영 코드 변경 **0** · 반사실은 **입력만** 바꿨다 · WU-134/164 방식):
  실험      SAME(human SAME)   🔴 DIFFERENT leakage   conflicts
  BASE            3                   0                  9
  TITLE           3                   0                  9   ← **변화 0**
  BRAND           3                   0                  7   ← **변화 0**(blocker 만 7로)
🟢 leakage **전부 0** — 🔴 단 **DIFFERENT 분모가 2** 다(parkette.ca · m.luxboy.com)
   ⟹ 「leakage 0」을 **강한 방어 증거로 쓰지 않는다**(WU-164 와 같은 한계)
```

### 🔴🔴🔴 **결정적 숫자는 leakage 가 아니라 «축 수» 다**

```
미니부띠끄  base axes = **["CATEGORY"]** → 축 **1**
           H1 1 · H2 1 (🔴 **둘 다 변화 0**)
           blockers 는 끝까지 `[NO_TITLE_OVERLAP]`
도노키즈    base axes = **["TITLE","CATEGORY"]** → 축 **2**
           🟢🟢 H2 에서 **blockers = [] 0 이 됐다**(복구된 brand `"Bobo Choses"`)
           🔴 **그런데 verdict 는 여전히 `PRESUMED_SAME`** 이고 축은 **2 그대로** 다
⟹ 🔴🔴 **SAME 은 `SAME_MIN_AXES = 5` 를 요구한다**(기존 계약).
   축이 **1·2** 인데 blocker 를 없애도 **SAME 이 될 수 없다.**
⟹ 🔴 「blocker 를 열면 국내 SAME 이 생긴다」는 **사실이 아니다** —
   그 둘을 SAME 으로 만들려면 **threshold(축 수)를 내려야** 하고 그것은 CPO 금지축이다
```

### 🟢🟢 H-3 MARKET 만 «구조적으로 안전» 하다 — 그런데 그것도 SAME 을 만들지 못한다

```
도노키즈   market **UNKNOWN**(`KRW_WITHOUT_DOMAIN_EVIDENCE`) → 등록부에 있다면 **KR**
🟢🟢 leakage **0/8** — 외화 후보 **8건 전수** 가 `UNKNOWN`(충돌)으로 막힌다
   (tinyapple·trenbe·stockmann·thefrontshop·bobochoses·junioredition·kids21·parkette)
   ⟹ 🟢 WU-020 ④ 충돌 규칙이 그 축을 **구조적으로** 방어한다. 분모가 **8** 이라
      위 TITLE/BRAND 의 분모 2 보다 **훨씬 강한 증거** 다
🔴 **그러나** tier 는 여전히 `PRESUMED_SAME` 이라 `buildMarketJudgement`(SAME 만 센다)가
   그 가격을 **가격대에 넣지 않는다** ⟹ **국내 가격대는 그대로 0** 이다
🟡 그래서 MARKET 축은 「안전하지만 **단독으로는 효과 0**」 이다
```

### 🔴 H-1 TITLE 이 변화 0 인 «이유» — 게이트 탓이 아니다

```
원상품     coreTitleTokens = ["hug","hairy","monster","shirt"]
미니부띠끄  coreTitleTokens = ["shirt","b226ac009","미니부띠끄","miniboutique"]
⟹ 공통은 **`shirt` 하나** 이고 그것은 **카테고리 토큰** 이라 `distinctive` 가 제거한다
⟹ 🔴 **두 제목에 공통 distinctive 토큰이 «실제로» 없다.** 게이트가 과한 것이 아니다
🔴 열려면 **새 유사도 규칙**(품번 토큰을 제목 축으로 인정 · 느슨한 매칭)이 필요하고
   그것은 CPO 금지이며 WU-164 가 이미 같은 결론으로 닫았다(이번엔 **미니부띠끄 증거** 로 재확인)
```

### 🔵 CPO 결정 — **판단 재료가 정리됐다**

```
🔴 CTO 는 **아무 축도 열지 않았다** · 다음 축을 **고르지 않는다**.
🔵 측정이 말하는 것:
   ⒜ **TITLE** — 🔴 입력으로 열 수 없다(공통 토큰이 실제로 없다) · 새 규칙 = 금지
   ⒝ **BRAND** — 🟢 blocker 를 **실제로 없앤다**(도노키즈 `[]`) · leakage 0 ·
        🔴 그런데 **SAME 을 만들지 못한다**(축 2 < 5)
   ⒞ **MARKET** — 🟢🟢 **가장 안전하다**(leakage 0/8 · 분모 8) ·
        🔴 그런데 **단독 효과 0**(tier 가 안 바뀐다)
🔴🔴 ⟹ **세 축 중 어느 하나도 국내 SAME 을 만들지 못한다.** 공통 병목은
   **`SAME_MIN_AXES = 5`** 이고 그것은 **threshold** 다(CPO 가 닫아 둔 축).
🟡 그래서 남은 선택지는 **둘** 이고 **CPO 가 고른다**:
   ⒟ **threshold 축을 열 것인가**(🔴 역대 모든 WU 가 금지해 온 그 축)
   ⒠ 「국내 SAME 0」을 **정상으로 확정** 하고 해외 최저 소싱가로 진행
🟢 그리고 **BRAND·MARKET 둘은 「국내 가격 증거의 질」을 올린다** — SAME 이 아니어도
   도노키즈가 **KR** 이 되고 blocker 가 **0** 이 된다. 🔵 그 둘만 여는 것도 선택지다
```

### 🟢 CORE-2H 게이트

```
🔴 운영 코드 변경 **0** — 반사실을 **입력으로만** 했다(코드 패치 0 · 복구 불필요)
🔴 MI 완화 0 · threshold 0 · synonym 0 · alias 추가 0 · market rule 0 ·
   Adapter 0 · Search API 0 · Gemini/OpenAI/Naver 0 · Seller UI 0 · 가격대 강제 투입 0
🟢 측정 대상 **14**(WU-112 GT 12 + 신규 2) · 외화 leakage 분모 **8**
typecheck **0** · build **exit 0** · 회귀 **638 files / 8,895 passed / 1 failed**(`p54c1`)
```

### 🔴 내가 두 번 틀렸고 둘 다 사전에 잡았다

```
⒜ 1차 H-2 가 **`og:title` «만»** 봤다. 도노키즈 `og:title` 이 **빈 문자열** 이라
   alias 가 발화하지 못했고 **「변화 0」** 이 나왔다. 🔴 그런데 그 후보의
   `coreTitleTokens` 에는 **「보보쇼즈」가 이미 있었다** ⟹ 「브랜드를 복구할 수단이
   없다」가 **거짓** 이었다. 🟢 제목 출처를 **셋**(og:title → facts.title →
   coreTitleTokens)으로 넓혀 다시 재니 **blockers = [] 0** 이 됐다
⒝ 마지막 실행에서 brand 복구가 **3/3 실패** 해 게이트가 **측정을 거부** 했다
   🟢 그 거부가 맞다 — 열화된 숫자를 보고하지 않았다. 다른 WU 와 같은 보강을 넣고 다시 쟀다
```

---

## 6-I. [종료] CORE-2G — Dono Kids 2-hop

### 🟢🟢🟢 다음 세션은 이 문단만 읽고 시작한다

```
🟢🟢 **2-hop 성공 — 도노키즈 상세 URL 을 확보했다**(실측):
   목록 4페이지(fetch **4회**) → 블록 188 → 품번 일치 **1** →
   🇰🇷 `donokids.com/shop/shopdetail.html?branduid=3362785`
   → Fetch 🟢 → Extract 🟢 → **KRW 88,000** · `VERIFIED_CURRENT`
   🔴 **상세 전수 Fetch 를 하지 않았다** — 188개 중 **1개** 만 열었다(CPO 금지 준수)
🟢🟢 **국내 가격 증거가 «2곳» 이 됐다** — 도노키즈 ₩88,000 · 미니부띠끄 ₩88,000
🔴🔴 **그런데 둘이 «서로 다른 축» 에서 막힌다** — 이것이 이 WU 의 핵심 발견이다:
   `donokids.com`      tier=PRESUMED_SAME · market **UNKNOWN**(`KRW_WITHOUT_DOMAIN_EVIDENCE`)
                       blockers **[BRAND_UNCONFIRMED]** · conflicts **0**
                       제목 「[보보쇼즈] Hug Hairy Monster T-shirt #226AC009」
   `miniboutique.co.kr` tier=PRESUMED_SAME · market **KR**(`KR_TLD_AND_KRW`)
                       blockers **[NO_TITLE_OVERLAP]** · conflicts **0**
⟹ 🔴 **「하나의 레버」가 없다**(WU-138 이 국내에서 적은 그 문장이 재현됐다)
   도노키즈는 ⒜ `.com` 이라 market 축 ⒝ 브랜드 축 **둘** 이 막고,
   미니부띠끄는 **제목 축** 하나가 막는다
⟹ 🟡 **CPO 판정 B** — 상세 URL + 가격은 찾았고 MI 에서 SAME 이 아니다
```

### 🔴🔴 CORE-2F 가 도노키즈에서 0 을 낸 **진짜 원인 둘**(이번에 밝혀졌다)

```
⒜ 목록 URL 이 `shopdetail.html?branduid=3362785` — **품번이 URL 에 없다**
   ⟹ slug 기반 선별기(CORE-2F)는 **구조적으로 0** 이다
⒝ 🔴🔴 그리고 도노키즈는 품번을 **`#226AC009`**(선행 `B` **없이**) 로 적는다
   ⟹ `B226AC009` 로만 찾으면 **영원히 0** 이다
🟢 목록 **HTML 텍스트** 에는 있었다 —
   `<li class="dsc">[보보쇼즈] Hug Hairy Monster T-shirt  #226AC009`
🟢 그래서 `codeVariants` 는 **두 꼴만** 만든다(원형 · 선행 영문자 1개 제거).
   🔴 그 외 변형은 **만들지 않는다** — 오탐이 곧 「다른 상품을 국내 가격대에 넣기」다
```

### 🔴🔴 하니스가 **또 거짓 0 을 낼 뻔했다** — 이번엔 실측이 잡았다

```
1차 실행이 **품번 일치 0** 을 찍었다. 🔴 그런데 curl 로는 같은 페이지에 `226AC009` 가
**2회** 있었다 ⟹ 메모대로 **하니스부터 의심** 했고 거리를 쟀다:
   code@58173 → 가장 가까운 href 거리 **470자**(창 1200 안)
🔴🔴 원인 — 도노키즈는 한 상품을 **두 번** 링크한다(썸네일 + 이름 · **같은 href**).
   내 코드가 **블록 단계에서 href 를 dedupe** 해서 **이른 썸네일 위치만** 남겼고
   그 창에는 **상품명이 없다**.
🟢 고침 — 블록은 **등장마다** 만들고 중복 제거는 `pickByListingText` 가 한다.
   ⟹ 블록 60 → **120** · 품번 일치 0 → **1**
🔴 그대로 보고했으면 「도노키즈에서 상세 URL 을 못 찾는다」는 **거짓 결론** 이었다
```

### 🔵 CPO 결정 — **판정 B 의 다음 갈래**

```
🔴 CTO 는 `NO_TITLE_OVERLAP` 도 `BRAND_UNCONFIRMED` 도 **열지 않았다**(동결 유지).
🔵 그리고 이번 실측이 **새 사실 하나** 를 더했다 — 두 샵의 blocker 가 **다르다**.
   ⟹ 「제목 축 하나만 열면 국내 가격 2곳」이 **아니다**:
     미니부띠끄는 제목 축만 열면 SAME 이 될 **가능성** 이 있지만(market 이 이미 KR),
     도노키즈는 **brand 축 + market 축** 둘을 열어야 한다
   🔴 그 셋 모두 CPO 가 닫아 둔 축이다(WU-077 market · WU-080 brand · WU-138/164 title)
🟡 그래서 다음 선택지는 **둘** 이고 **CPO 가 고른다**:
   ⒜ 국내 SAME 을 열기 위한 **counterfactual 전용 WU**(세 축을 **하나씩** · leakage 측정)
   ⒝ 「국내 SAME 0」을 **정상으로 확정** 하고 해외 최저 소싱가만으로 진행
🔴 `p54c1` 은 이번 작업에 섞지 않았다(CPO 명시 · 별도 WU)
```

### 🟢 CORE-2G 게이트

```
신규 `domestic-listing-hop-2.ts`(🔴 **운영 호출부 0**) · 계약 **9**(네트워크 0 + 실측 1)
변이 **M1~M4** — M1 품번변형 제거 **3F** · M2 블록 dedupe 되돌림 **1F** ·
   M3 품번일치 제거(전수투입) **1F** · M4 페이지 상한 제거 **1F**
   → 🟢 **바이트 동일 복구** · 흔적 **0** · 변이마다 **적용 확인**
🔴 robots 를 먼저 봤다 — `donokids.com` **Allow: /** 🟢 · 보몽드는 **건드리지 않았다**
🔴 다른 사이트/Adapter/Registry/Search API **0** · MI/SAME/threshold **0** ·
   Gemini/OpenAI/Naver **0** · 「국내니까 KRW」 우회 **0** · 상세 전수 Fetch **0**
typecheck **0** · build **exit 0** · 회귀 **638 files / 8,895 passed / 1 failed**(`p54c1`)
```

---

## 6-J. [종료] CORE-2F — 국내 1-hop 공급

### 🟢🟢🟢 다음 세션은 이 문단만 읽고 시작한다

```
🟢🟢 **1-hop 이 작동한다 — 국내 상세 URL 공급이 열렸다**(실측 B226AC009):
   `miniboutique.co.kr` → 공식 **`sitemap.xml`**(HTTP **2회**) → loc **2,718** 중 품번 일치 **1**
     🇰🇷 `https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac009/28043/`
   → Fetch 🟢 → Extract 🟢 → **KRW 88,000** · market **KR**(`basis=KR_TLD_AND_KRW`) ·
     `VERIFIED_CURRENT` 🟢
🔴🔴 **그리고 막힌 칸이 «하나» 로 확정됐다 — ④ MI SAME**:
   `tier=PRESUMED_SAME` · `matchTruth=TEXT_CONFIRMED` ·
   **`blockers = [NO_TITLE_OVERLAP]` 하나뿐** · `conflicts = []` **0**
   제목: `[BOBO CHOSES]T-Shirt - B226AC009 - 미니부띠끄 miniboutique`
   ⟹ 🔴 **그 축은 CPO 가 동결했다**(WU-138/164 · MI 완화 금지) ⟹ **SAME 0 · 가격 0**
🟡 그래서 §10 의 「국내 가격 2~3개」는 **미달** 이다 — 🔴 그러나 **원인이 공급이 아니다.**
   공급은 열렸고 **마지막 한 칸이 정책으로 닫혀 있다.**
```

### 🟢 1-hop 의 안전 경계(실측 · robots 를 **먼저** 봤다)

```
`donokids.com`       robots **Allow: /** 🟢 · 🔴 sitemap **없음** · 목록 href **183** 중
                     품번 일치 **0** ⟹ 목록에 품번이 안 적혀 있다(상세를 열어야 안다)
                     🟡 페이지네이션 **4페이지** 가 있다 — 🔴 이번 범위(1-hop)에서 안 따라갔다
`miniboutique.co.kr` robots 🟢(관리·주문·**`search.html`** 만 금지) · 🟢 **sitemap 있음**
                     🔴 그래서 **`search.html` 을 쓰지 않았다** — robots 가 막는 경로다
🔴 보몽드(`Disallow: /`)는 **건드리지 않았다**(WU-154 가 폐기한 그 축)
```

### 🔴 URL 을 «지어내지» 않았다 — 출처가 둘뿐이다

```
⒜ 공식 `sitemap.xml`(sitemaps.org 표준) ⒝ 진입 페이지의 실제 `href`
🔴 경로 조합(`/product/<code>`) **금지** · 🔴 샵 내부 검색 **구현 0**
🔴 **목록을 전부 밀어넣지 않는다** — 품번이 **slug 에 있는** 것만 고른다
   (WU-121 이 측정한 함정: 목록 href 를 그대로 쓰면 SNS·기프트카드가 섞인다)
🟢 fetch owner 는 **기존 `fetchPlainHtml` 하나** — SSRF/DNS 가드(WU-025/026)와
   429 폴백(WU-084)을 그대로 지난다(새 fetch 스택 0)
🔴 **운영 호출부 0** — `query-planner` 선례다. 배선은 **CPO 결정** 이다
```

### 🔴🔴 변이가 **내 코드의 실제 결함** 을 찾았다 — robots 주석

```
M3(전면금지 무시)이 **1차에 통과했다** ⟹ 🔴 「통과」를 「잠겼다」로 읽지 않고 계약 A-7 을
추가했고, **그 계약이 내 파서의 결함을 잡았다**:
   `Disallow: /  # block all` → `trim()` 이 `"/  # block all"` ⟹ `=== "/"` **false**
   ⟹ 🔴🔴 **전면 금지를 「허용」으로 읽는다**(건드리면 안 되는 사이트를 긁는 방향)
🟢 RFC 9309 는 값 뒤 주석을 허용한다 ⟹ **주석을 벗기도록 고쳤다**(`split("#")[0]`)
```

### 🔵 CPO 결정 — **하나로 좁혀졌다**

```
🔵 `NO_TITLE_OVERLAP` 를 열 것인가 — 🔴 **CTO 가 열지 않았다**(동결 유지).
   🟢 이번 케이스의 모양은 **역대 가장 안전한 쪽** 이다:
     · `conflicts = []` **0**(색상·품번·상품군 충돌 **없음**)
     · 후보 제목에 **품번 `B226AC009` 가 그대로** 있다
     · market **KR** · 가격 **VERIFIED_CURRENT KRW 88,000**
   🔴 그래도 WU-138 의 반사실(**DIFFERENT 방어 4/4 → 3/4** · `m.luxboy.com` 누출)이
      그 축을 닫아 둔 근거다 ⟹ **CPO 판정 사안** 이다
🟡 그리고 **공급을 더 열 축이 둘 남았다**(이번 범위 밖 · 측정만 했다):
   ⒜ `donokids` **페이지네이션 4페이지**(1-hop → 2-hop) ⒝ 다른 국내 전문몰 sitemap
🔴 `p54c1` 리다이렉트는 **별도 기록** 이고 이번 작업에 섞지 않았다(CPO 명시)
```

### 🟢 CORE-2F 게이트

```
신규 `domestic-listing-hop.ts`(운영 호출부 **0**) · 계약 **8**(네트워크 0 + 실측 1)
변이 **M1~M4** — M1 품번선별 제거 **2F** · M2 짧은품번 가드 제거 **1F** ·
   M3 robots 전면금지 무시 **1F**(🔴 계약 추가 후) · M4 중복제거 제거 **1F**
   → 🟢 **바이트 동일 복구** · 흔적 **0** · 변이마다 **적용 확인**
MI/SAME/threshold/가격 로직 **0** · Gemini/OpenAI/Naver/유료API/계정 **0** ·
Adapter/Registry **0** · Seller URL 입력 **0** · bookmarklet 요구 **0**
typecheck **0** · build **exit 0** · 회귀 **637 files / 8,886 passed / 1 failed**(`p54c1`)
```

---

## 6-K. [종료] CORE-2E — 가격 목적 재정의

### 🟢🟢🟢 다음 세션은 이 문단만 읽고 시작한다

```
§16 의 질문 — 「SAME 가격 증거로 국내 시장가격대 / 해외 통화별 최저 소싱가를
안정적으로 얻을 수 있는가」에 대한 답:
🟢🟢 **🌎 해외 = YES**   실측 B226AC009 — SAME 3 · 가격확인 2 ·
   `byCurrency [{USD, lowest 58, n 2}]` · 통화 단일 ⟹ **「최저 확인가 USD 58」**
🔴 **🇰🇷 국내 = NO** 이고 **손실 지점이 특정됐다**(§16 가 요구한 그것):
   국내 상세 URL 2건이 들어왔는데 **둘 다 ⑧ 에서 DROPPED** 다
     `lfmall.co.kr`     9KB SPA shell(WU-160 실측) ⟹ facts 부족
     `m.bunjang.co.kr`  **중고** 리스팅 ⟹ MI 가 올바르게 거부
   그리고 🔴🔴 **`bobochoses.com` 은 SAME + EUR 40 인데 market=UNKNOWN** 이다
     (`basis=CONFLICT_REGISTERED_SHOP_WITH_FOREIGN_CURRENCY`)
     ⟹ 국내도 해외도 **아니다** ⟹ 두 축 **어디에도 안 들어간다**
     🟢 그것이 **정확한 동작** 이다(WU-020) — 국내 등록부 샵인데 EUR 로 값을 매기면
        증거가 **충돌** 한다. KR 로 올리면 「국내 시장가격」이 **EUR 40** 이 되어 거짓이다
⟹ 🔴 손실은 **가격 집계가 아니라 「국내 신품 상세 URL 공급」** 이다(CORE-2/2B 와 같은 결론)
```

### 🟢🟢 §3·§4 규칙은 **이미 구현돼 있었다**(WU-139/148) — 재구현 0

```
🇰🇷 `domesticPriceBand` — 2건↑ **그리고** 최저<최고 → **BAND**(`min ─ max`) ·
   1건이거나 같은 금액 둘 → **SINGLE**(「가격대 확정 불가」) · 통화 혼합 → **NONE**
🌎 `overseasLowestText` — **통화별 최저** · 통화 하나일 때만 「최저 확인가」로 단정
🟢 그래서 이 WU 는 **규칙을 만들지 않고 실데이터로 검증** 했고, 계약 **20** 으로 잠갔다
```

### 🔴🔴🔴 §4-4 를 **구현했다가 되돌렸다** — 사유를 코드·계약에 남겼다

```
CPO 는 `GBP 37 (약 ₩XX,XXX)` 를 **「허용」** 했다(요구가 아니다). 🟢 구현해 붙였고
**두 가지가 동시에 드러나 되돌렸다**:
🔴🔴 ① **거짓 숫자** — 실측 `CAD 64` → **「약 ₩64」**. `convertToKrw` 는 주석대로
   「모르는 통화는 그대로 KRW 로 취급」 한다(`pricing/currency.ts:24`) ·
   고정표에 **CAD 가 없다** ⟹ 「약」을 붙여도 **거짓** 이다
🔴 ② **기존 계약 6건** 이 그 영역 전체에 `₩` 를 금지한다 —
   `wu-141-r3` C-1-b · `wu-144` F · `wu-145` B-3 · `wu-146` 1-b · `wu-148` B-2 · `wu-139` B-5
   (지키는 것: 「가격 숫자 owner 하나」 · 「통화를 합치지 않는다」)
🔵 **CPO 판정 사안** — 넣으려면 ⒜ `convertToKrwStrict`(모르는 통화 → null) ⒝ 여섯 앵커를
   **성질 기반** 으로 갱신. 🟢 계약 **C-3 가 그 사실을 CONTROL 로 고정** 했다 —
   CAD 가 환율표에 들어오면 **그 단언이 FAIL** 하고 그때 다시 판단한다
```

### 🔴🔴🔴 그리고 **내 과거 보고를 정정한다** — 그 회귀 실패는 「외부 변화」가 아니다

```
`p54c1-grounding-redirect` 1건을 내가 **6세션 동안** 「외부 사이트가 더 이상 www 로
리다이렉트하지 않는다」로 적었다. 🔴🔴 **실측으로 반증됐다**:
   curl -L   → 3/3 `https://www.junioredition.com/...` · HTTP **200**
   curl (no -L) → **HTTP 301** · `location: https://www.junioredition.com/...`
   브라우저 UA 로도 **301**
⟹ 🔴 그 호스트는 **여전히 리다이렉트한다.** 실패 원인은 **우리 probe 가 최종 URL 을
   읽지 못하는 것** 이고 **원인 미규명** 이다.
🔴 그 경로는 WU-075 의 `REDIRECTED_AWAY` 방어 전제(=최종 URL 을 읽는다)와 직결된다
   ⟹ 🔵 **제품 결함 가능성** 이므로 CPO 판정 사안으로 올린다.
🟢 CORE-2E 변경과의 관련성 **0** — `packages/crawler` 를 **한 글자도** 안 건드렸다.
```

### 🟢 CORE-2E 게이트

```
운영 변경 **0**(§4-4 되돌림 뒤 · 주석만 남았다) · MI/SAME/threshold/모델코드/브랜드 **0** ·
Gemini/OpenAI/Naver/유료API/계정 **0** · Seller UI 신규 **0** · 추천판매가/마진 **0** · 등록 **0**
계약 신규 **20** · 변이 **M1~M5 전부 FAIL → 바이트 동일 복구**(M1 1F · M2 1F · M3 2F ·
   M4 4F · M5 1F) · 흔적 **0** · 🟢 변이마다 **적용 확인** 을 붙였다
typecheck **0** · build **exit 0** · 회귀 **636 files / 8,880 passed / 1 failed**(위 정정 참조)
하니스 `core-2e-price-evidence`(`CORE2E_LIVE=1` 실측) · 계약 `core-2e-price-purpose`
```

### 🔵 다음 작업 제안(🔴 CTO 가 고르지 않는다)

```
🔵 ① **국내 상세 URL 공급** — CORE-2/2B 가 특정한 그 하나. 선택지는 CPO 가 닫아 둔 축이다
     (⒜ 포털 공식 API ⒝ 1-hop 목록→상세 ⒞ 국내 SAME 0 을 정상으로 확정)
🔵 ② **§4-4 환산 표시** — `convertToKrwStrict` + 앵커 6 갱신(가격 표시 정책)
🔵 ③ **`p54c1` 리다이렉트** — 우리 probe 가 최종 URL 을 읽지 못하는 원인 규명
     (🔴 WU-075 방어의 전제라 **조용히 두면 안 된다**)
🔵 ④ CORE-2D **CEO 테스트** — 배포됐고(`2364b048`) 절차는 §6-G 에 있다
```

---

## 6-L. [종료] CORE-2D — 북마크릿 전달 UX

### 🟢🟢🟢 다음 세션은 이 문단만 읽고 시작한다

```
🟢 **Track B 가 제품에서 «사용 가능» 해졌다**(CORE-2C 배선 + CORE-2D 전달 UI):
   상품 분석 → `/pipeline` 하단 **「🔎 AI 검색으로 후보 찾기」** 섹션 →
   상품별 북마크릿을 **북마크바로 드래그** → AI/검색에서 검색 → **북마크 1클릭** →
   `/pipeline?resume=…&candidateUrls=…` → 기존 `/check` → 기존 MI/가격
🟢 운영 파일 — `SmartSearchBookmarklet.tsx`(신규) · `page.tsx`(렌더 1줄 + import)
🔵 **남은 것은 CPO 배포 판단 + 그 뒤 CEO 실브라우저 1회** 다
```

### 🔴🔴🔴 이 WU 의 핵심 발견 — **React 19 가 북마크릿을 조용히 죽인다**

```
`react-dom@19.2.4` `sanitizeURL`(react-dom-client.development.js:**3166**) 실측:
  isJavaScriptProtocol.test(url)
    ? "javascript:throw new Error('React has blocked a javascript: URL as a
       security precaution.')"
⟹ 🔴 JSX 로 `href={bookmarklet}` 을 주면 **그 차단 코드가 북마크에 등록된다.**
   셀러는 등록에 성공한 것처럼 보이고 누르면 **아무 일도 일어나지 않는다**
🟢 그래서 **마운트 후 `setAttribute("href", …)`** 로 넣는다(sanitize 를 지나지 않는다)
🔴 `href` **prop 을 주지 않는다** — D-1 이 소스로 잠근다
🔴🔴 **행동 축으로는 잡을 수 없다** — `href` prop 을 추가하는 변이에서 A-1·A-2 가
   **통과했다**(effect 가 sanitize 뒤에 덮어쓴다) ⟹ 🟢 그래서 **D-1 소스 앵커 +
   A-2b CONTROL**(React 가 실제로 막는 것을 증명) **둘** 로 지킨다.
   🔴 「변이가 통과했다」를 「계약이 충분하다」로 읽지 않았다
```

### 🟢 CORE-2D 구현 — CPO 금지 전수 준수

```
🟢 UI 는 **네 조각** 뿐 — 제목 「🔎 AI 검색으로 후보 찾기」 · 한 문단 설명 ·
   사용법 **1·2·3**(`<li>` **정확히 3개**) · 드래그용 버튼 하나
🔴 **검색 결과·후보 URL 목록 0** — 표 0 · `tbody` 0 · 외부 링크 0 · `img` 0 ·
   「동일상품/유사상품/최저가/가격비교/₩/원」 **0**(마운트 DOM 으로 단언)
🔴 **입력 요소 0** — `input`/`textarea`/`form` 전부 0(셀러 URL 입력 부활 금지)
🔴 **검색 실행 0** — `fetch`/XHR 0 · 외부 요청 0
🔴 `snapshotId` 가 없으면 **아무것도 렌더하지 않는다** ⟹ 상품 간 혼선 **구조적으로 불가**
🟢 상품별 — `resume=snap-A` ↔ `resume=snap-B` 가 **다르다**(A-4)
🔴 **클릭 실행을 막는다**(`e.preventDefault()`) — 페이지 안 `javascript:` 클릭은
   브라우저가 막을 수 있고 그러면 셀러가 **고장으로 오해** 한다. 정상 경로는 **북마크 실행**
🔴 자리는 `CommerceWorkspace` **뒤** — 도구가 판단 결과보다 먼저 서면 WU-140-R1 의 FAIL 모양
```

### 🟢 CORE-2D 게이트

```
계약 신규 **24**(마운트 DOM 축 + 소스 앵커 + **CONTROL 1**) — CPO 10항 전부 커버:
  ① 생성 A-1 ② snapshotId A-3·A-4 ③ 추출 B-5 ④ navigation B-1 ⑤ 잘못된 URL B-3
  ⑥ 중복 B-4 ⑦ 상한 50 B-2 ⑧ 비-HTTP B-3 ⑨ `/check` 연결 D-5 ⑩ 중복 실행 방지 D-6
음성 대조 **5종** — M1 href prop **1F**(D-1) · M2 effect 제거 **5F** ·
  M3 snapshotId 가드 제거 **1F** · M4 draggable 제거 **1F** · M5 자리 앞으로 **1F**
  → 🟢 **바이트 동일 복구**(diff -q) · 변이 흔적 **0**
🔴 변이 둘이 **적용 실패** 했고 둘 다 사전에 잡았다 — ⒜ 쉘 정규식 이스케이프
   ⒝ **CRLF**(`\n` 앞에 `\r` 이라 문자열 검색이 빗나갔다) ⟹ **Edit 로** 적용했다
🔴 내 단언이 **두 번 틀렸고 코드가 맞았다** — ⒜ 「판매처」 전면 금지(설명문의 **일반 명사**
   하나다 ⟹ 🟢 **개수 ≤1 + 구조**(표·외부링크·img 0)로 바꿨다) ⒝ `.test.tsx` 로 썼다가
   **수집조차 되지 않았다**(vitest `include` 는 `*.test.ts` 뿐 ⟹ `createElement` 로 재작성)
typecheck **0** · build **exit 0** · 회귀 **635 files / 8,860 passed / 1 failed**
   🔴 그 1건은 **외부 사이트 변화**(`p54c1-grounding-redirect` · 6세션 연속 동일)
```

### 🔵 CEO 테스트(배포 뒤 · CPO 가 전달)

```
① 상품 분석(예: B226AC009) → 화면 하단 「🔎 AI 검색으로 후보 찾기」 확인
② 그 버튼을 **북마크바로 드래그**
③ 쓰시는 AI/검색에서 「Bobo Choses B226AC009」 검색
④ 검색 결과 화면에서 **그 북마크 1클릭** → 따져로 돌아온다
⑤ **그 상품** 의 국내/해외 후보가 늘어나는지 확인
🔴 FAIL 기준 — 다른 상품에 붙는다 · 북마크가 눌려도 아무 일 없다 · 후보가 안 늘어난다
```

---

## 6-M. [종료] CORE-2C — 핸드오프 배선

### 🟢🟢🟢 다음 세션은 이 문단만 읽고 시작한다

```
🟢 **배선이 들어왔다**(운영 **2 파일** · 신규 모듈 **1**):
   `pipeline/supplied-url-handoff.ts`(신규 · 순수 · HTTP 0)
     · `SUPPLIED_URL_PARAM` = **`candidateUrls`**  · `MAX_HANDOFF_URLS` = **50**
     · `parseSuppliedUrlsParam(search)`      파라미터 → URL 배열(http(s) 만 · 중복 제거 · 상한)
     · `collectFromResultLinks(hrefs, origin)` 북마크릿과 **같은 로직 owner**(사본 0)
     · `buildBookmarkletForSnapshot(origin, snapshotId)` **상품에 묶인** 북마크릿
   `pipeline/page.tsx` — `?resume=` 복원 **직후** 에 그 파라미터를 읽어
     기존 `POST /api/price-history/check` 에 **`candidateUrls` 를 실어** 보내고
     응답을 기존 `setAutoCheckResult` 로 흘린다(WU-082 가 깐 길 · 새 API/state **0**)
🔴 **CPO 금지 전수 준수** — MI 0 · SAME/threshold 0 · Price 0 · Adapter/Registry 0 ·
   검색 API 0 · Gemini/OpenAI/Naver 0 · **Seller URL 입력 복구 0**(flag 기본 false 불변) ·
   DB 0 · **새 UI 0** · **후보를 셀러에게 새로 노출 0**
🔵 **남은 것 — CPO 배포 판단 + 그 뒤 CEO 실브라우저 3/3**(CTO 는 push 하지 않았다)
```

### 🔴🔴 설계가 «강제된» 이유 — 세 제약을 동시에 피하는 길이 하나다

```
① CORS   `html.duckduckgo.com` 은 Origin 헤더를 보내면 **403**
② CSP    DDG 는 `connect-src` 를 자기 도메인으로 제한 ⟹ bookmarklet `fetch()` 차단
         (🟢 andisearch·you.com 은 CSP 가 **없다** — 서비스마다 달라 **어디선가 깨진다**)
③ 쿠키   우리 세션 쿠키 **`sameSite: "lax"`** ⟹ cross-site **POST** 에 안 실린다
🟢 ⟹ **top-level GET 내비게이션** 하나가 셋을 동시에 피한다
   (CORS 무관 · connect-src 무관 · 🟢 **Lax 는 top-level 내비게이션에 쿠키를 싣는다**)
🔴 그래서 북마크릿이 `fetch` 를 **쓰지 않는다** — 계약 B-2 가 그것을 잠근다
```

### 🔴 추측하지 않은 자리 하나

```
🔴 `candidateUrls` 만 오고 **`resume` 이 없으면 아무것도 하지 않는다.**
   🔴 북마크릿은 **새 탭** 에 착지하고 그 탭의 `sessionStorage` 는 비어 있다
      (복원 순서 실측: `?resume` → sessionStorage) ⟹ 스냅샷을 **URL 로만** 안다
   🔴 「최근 상품」으로 넘겨짚으면 **엉뚱한 상품에 가격 후보가 붙는다** ⟹ 안 했다
🟡 그래서 북마크릿은 **상품마다 다르다** — `buildBookmarkletForSnapshot` 가 만든다.
   🔵 그것을 **화면에 어떻게 내보일지는 CPO 결정** 이다(UI 변경이라 CTO 가 안 했다)
```

### 🟢 CORE-2C 게이트

```
계약 신규 **19**(파서 6 · 북마크릿 4 · **배선 소스 앵커 8** · owner 단일성 1)
음성 대조 **6종** — M1 배선 끊기 1F · M2 빈목록 가드 제거 1F · M3 URL 정리 제거 1F ·
   M4 북마크릿을 fetch 로 2F · M5 비-HTTP 거부 제거 1F · M6 상한 갈라놓기 1F
   → 🟢 **바이트 동일 복구**(diff -q) · 변이 흔적 **0**
🔴🔴 **M5 가 1차에 「통과」했고 그것은 «적용 실패» 였다** — 쉘로 정규식을 편집해
   패턴이 안 맞았다. 🟢 **적용 확인** 을 넣고 Edit 로 다시 변이해 **1F** 를 받았다
   (메모 `정규식을 쉘/파이썬으로 편집하지 않는다` 의 재발 · 이번엔 사전에 잡았다)
🔴 기존 계약 **1건 FAIL → 갱신·강화** — `wu-082` 의 「check POST 는 1개」가
   **의도된 변경** 으로 깨졌다. 🟢 「개수」가 아니라 **성질**(둘이 **상호 배타적 블록**
   에 있고 빈 목록이면 안 돈다)로 바꿨다 — 세 번째가 생기면 FAIL 한다
typecheck **0** · build **exit 0**(`✓ Compiled successfully`) ·
회귀 **634 files / 8,836 passed / 1 failed**
   🔴 그 1건은 **외부 사이트 변화**(`p54c1-grounding-redirect` · 5세션 연속 동일)
```

### 🔴 CTO 가 할 수 «없는» 것 — CEO 테스트가 그 자리다

```
🔴 **실제 브라우저 3/3 E2E 를 CTO 가 못 돌렸다** — `/pipeline` 은 Supabase 인증 뒤이고
   로컬에 그 자격증명이 없다(service-role 키 부재 · `ADMIN_*` 는 Production Sensitive).
🟢 대신 증명한 것 — ⒜ 헤더 기반 기술 제약(CORS/CSP/쿠키) ⒝ 파서·북마크릿 **계약 19**
   ⒞ **배선 소스 앵커 8 + 변이 6종** ⒟ CORE-2B 의 **상품 3개 서버 수신 7·3·1**
🔵 CEO 는 배포 뒤 **한 번** — 상품 분석 → 검색 → 북마크 클릭 → `/pipeline` 복귀 →
   국내/해외 후보가 **늘어나는지**(상품 3개)
```

---

## 6-N. [종료] CORE-2B — 브라우저 핸드오프 PoC

### 🟢🟢🟢 다음 세션은 이 문단만 읽고 시작한다

```
🟢🟢 **사용자 브라우저 → candidateUrls[] → 서버 수신** 이 **상품 3개 전부** 성공했다
   (운영 `collectUrlCandidatePool` 경계로 측정 · 외부 계정 0 · 비용 0):
     B226AC009  검색결과 10 → 핸드오프 10 → accepted 7 → usable 7 → **miEligible 7**
                후보 호스트 7 — bobochoses · tinyapple · global.trenbe · **lfmall.co.kr** ·
                thefrontshop · cissywears · m.bunjang
     B226AC010  8 → 8 → 5 → 3 → **miEligible 3**(bobochoses · eraldo · tinyapple)
     B226AC117  7 → 7 → 1 → 1 → **miEligible 1**(kihanan.com)
   🔴 측정 범위는 **Discovery 성공 여부까지** 다 — MI/SAME/가격은 재지 않았다(CPO 지시)
🔵 **남은 것은 UI 한 줄** — 페이지가 `?candidateUrls=` 를 읽는 배선. 🔴 UI 변경이라 **안 했다**
```

### 🔴🔴 설계를 «결정한» 기술 증명 — 셋을 동시에 피하는 길이 하나뿐이다

```
① CORS   `html.duckduckgo.com` 은 **Origin 헤더를 보내면 403**(브라우저 origin 능동 거부) ·
         `api.duckduckgo.com` 은 `ACAO: *` 인데 **Instant Answer** 라 검색 목록이 아니다 ·
         `s.jina.ai` 는 **CORS 를 반사** 하지만 **401**(키 필요)
         ⟹ 🔴 **확장 없이 브라우저가 검색 API 를 직접 때리는 길은 없다**
② CSP    `html.duckduckgo.com`·`duckduckgo.com` 은 `connect-src` 를 **자기 도메인으로 제한**
         ⟹ bookmarklet 의 `fetch()` 가 우리 서버로 **못 간다**
         🟢 반면 **`andisearch.com`·`you.com` 은 CSP 가 아예 없다** ⟹ 서비스마다 **다르다**
         ⟹ 🔴 `fetch` 에 의존하는 설계는 **어디선가 깨진다**
③ 우리 서버  세션 쿠키 **`sameSite: "lax"`**(`login/route.ts:30`) · **CORS 헤더 코드 0**(전수 grep)
         ⟹ 🔴 **cross-origin 「인증된 POST」는 구조적으로 불가**(Lax 는 cross-site POST 에
            쿠키를 싣지 않는다)
🟢🟢 ⟹ **내비게이션 핸드오프** 가 유일해가 된다 — `location.href = 우리페이지?candidateUrls=…`
   ⒜ CORS **무관** ⒝ `connect-src` **무관**(내비게이션은 fetch 가 아니다)
   ⒞ 🟢 **`SameSite=Lax` 가 top-level GET 내비게이션에는 쿠키를 싣는다** ⟹ **인증 유지**
   ⒟ 🟢 **서버 코드·CORS·인증 변경 0**
```

### 🟢 TRACK B 네 방식 판정

| 방식 | 기술 가능 | 약관 | 사용자 행위 | CWS 등록 | 판정 |
|---|---|---|---|---|---|
| **① bookmarklet + 내비게이션** | 🟢🟢 **가능**(CSP 무관) | 🟢 사용자 직접 실행 · 자동화 0 | 🟡 북마크 1클릭 | 🟢 **불필요** | 🟢🟢 **1순위** |
| **② 확장(content script)** | 🟢 가능(`apps/*` workspace 라 설정 변경 0) | 🟡 CWS 정책 + 대상 약관 | 🟢 설치 1회 후 1클릭 | 🟡 **개발자 모드 PoC 는 불필요** | 🟡 **2순위** |
| **③ 브라우저가 검색 API 직접 fetch** | 🔴 **불가**(위 ①) | — | — | — | 🔴 **NO** |
| **④ 소비자 AI 웹앱 자동 로그인/백그라운드** | 🟡 | 🔴🔴 **robots/AUP 금지** | — | — | 🔴 **NO**(CPO 금지) |

🟢 **CPO 지적이 맞았다 — CORS 하나로 TRACK B 를 닫은 것은 범위가 틀렸다.** 막히는 것은
**③ 하나** 이고 ①②는 **열려 있다**(①은 **지금 측정으로 증명됐다**).

### 🟢 PoC 산출물(운영 번들에 들어가지 않는다)

```
`core-2b-browser-handoff.test.ts` 안의 **`BOOKMARKLET_SOURCE`** 문자열 + 순수 함수
`collectFromResultLinks(hrefs, pageOrigin)`
🔴 성질 — `fetch` **안 쓴다** · `uddg` 래퍼 **푼다** · 검색 서비스 자신의 링크 **제외** ·
   중복 **제거** · 상한 **50**(URL 길이) · 비-HTTP **버린다**
🟢 계약 **5건**(A-1~A-5 · 네트워크 0)이 그 다섯 성질을 잠근다
```

### 🔵 CPO 결정 — **하나**

```
🔵 「페이지가 `?candidateUrls=` 를 읽는 배선을 넣을 것인가」 — **UI 변경** 이라 CTO 가 안 했다
   🟢 그 한 줄이면 **사용자 브라우저 검색 → 우리 MI** 가 **외부 계정·비용 0 으로** 닫힌다
   🔴 WU-154 와 구분된다 — 셀러가 URL 을 **찾는** 것이 아니라 **검색 결과 페이지에서
      북마크를 한 번 누르는** 것이다(URL 수집은 **코드가** 한다)
🟡 그 다음 선택 — ② 확장으로 「1클릭」을 더 줄일 것인가(🔴 CWS 정책 검토 필요)
🔴 CTO 는 둘 다 열지 않았다 — UI 0 · 확장 0 · 외부 계정 0 · 배포 0
```

### 🟢 CORE-2B 게이트

```
비용 **$0** · 외부 계정 **0** · 자동 로그인 **0** · 백그라운드 자동화 **0**
운영 코드 **0** — MI 0 · Price 0 · UI 0 · Adapter/Registry 0 · Seller 입력 부활 0 · DB 0
typecheck **0** · 회귀 **633 files / 8,817 passed / 1 failed**
  🔴 그 1건은 **외부 사이트 변화**(`p54c1-grounding-redirect` · 4세션 연속 동일 · 내 변경 무관)
하니스 `core-2b-browser-handoff`(계약 5 + `CORE2B_POC=1` 실측)
```

---

## 6-O. [종료] CORE-2 — 무과금 외부 Search 후보 조사

### 🔴🔴🔴 다음 세션은 이 문단만 읽고 시작한다

```
CPO 지시 — 비용 0 이 **1순위 제약** · Gemini/OpenAI 결제 ❌ · Naver ❌ ·
소비자 AI 웹앱 자동화 ❌ · 「실제로 B226AC009 를 검색해 URL 을 받아왔는가」로 판정.

🔴🔴 **TRACK A 의 구조적 벽 — 「무료」는 많은데 «키 없이» 되는 것이 없다**
   키 없이 호출 가능하다고 명시한 **FreeSerp** → 🔴 **HTTP 523**(origin 도달 불가 · 실측)
   **FreeSea** → 🔴 키 필요(「It will ask you for a key first」 · 실측)
   나머지 전부(Tavily·Exa·Decodo·Context.dev·TinyFish·LangSearch·You.com) → **키 발급 필요**
   🔴 **CTO 는 계정을 만들 수 없다**(이메일·약관 동의 = CEO 행위)
⟹ 🔵 **그래서 막는 것은 「돈」이 아니라 「무료 키 1개 발급」** 이다.

🟢🟢 **TRACK B 의 답은 «이미 제품 안에 있다»**
   「사용자 브라우저 → AI Search → 결과 붙여넣기 → `candidateUrls[]` → Fetch/Extract/MI」
   경로가 **전부 구현돼 있고** `NEXT_PUBLIC_MI_SUPPLIED_URL_INPUT=true` **한 줄** 로 돌아온다
   (owner `isSuppliedUrlInputVisible()` · `DomesticPriceIntelligencePanel.tsx:2441`).
   🟢 WU-086 이 그것을 **이미 측정** 했다 — 산문 붙여넣기 → **11 발견 → 8 통과**
   🔴 방식 A·B(우리 페이지가 검색 결과 DOM 을 읽는다)는 **CORS 로 구조적 불가** 다 —
      cross-origin `window.open()` 의 `document` 접근은 same-origin policy 위반이고
      **서버 설정으로 바꿀 수 없다**(상대 사이트가 CORS 헤더를 주지 않는다)
   🟡 방식 C(확장)는 기술적으로 가능하나 CWS 정책 + 대상 사이트 약관이 남는다
```

### 🟢 TRACK A — 후보표(🔴 **내가 1차자료로 확인한 것만** 🟢 로 적었다)

| 후보 | 무료 한도 | 카드 | 고갈 시 | 국가/언어 | 저장 약관 | 실측 | 판정 |
|---|---|---|---|---|---|---|---|
| **Tavily** | 🟢 **1,000/월** | 🟢 **불필요** | 🟢 **하드 스톱**(자동과금 0) | ❔ | 🟡 미판독 | 🟢 문서 확인 | 🟢🟢 **1순위** |
| **Decodo** | 🟢 **10K recurring** | 🟢 **불필요** | 🔴 **문서에 없음** | 🟢🟢 **geo+language 195개국** | 🔴 페이지에 없음 | 🟢 문서 확인 | 🟢 **2순위**(KR 손잡이) |
| **Exa** | 🟢 $10/월(~2,500) | 🟢 **결제수단 불필요** | 🔴 미명시 | ❔ | 🔴 **약관이 PDF · 판독 불가**(과거 §4.2(a) 저장 금지) | 🟢 문서 확인 | 🟡 **보류** |
| **Perplexity** | 🔴 무료 한도 미확인 | ❔ | ❔ | ❔ | 🟢🟢 **「Customer owns all Output」** · 저장 금지 **없음** | 🟢 ToS 확인 | 🟡 **후보** |
| **Brave** | 🟡 $20/월 상당 | 🔴 **필요**(「To prevent abuse」) | ❔ | 🟢 | 🔴 **저장은 유료 플랜만**("storage rights") | 🟢 문서 확인 | 🔴 **NO** |
| **FreeSerp** | 🟢 키 불필요 주장 | 🟢 | — | ❔ | ❔ | 🔴 **HTTP 523 다운** | 🔴 **NO(가용성)** |
| **FreeSea** | 🟡 | 🟢 | ❔ | ❔ | 🟡 | 🔴 **키 필요** | 🟡 후보 |
| LangSearch · TinyFish · You.com · Context.dev · Andi | 🟡 **CPO 제시값** | 🟡 | 🟡 | 🟡 | 🟡 | 🔴 **CTO 미확인** | 🟡 표만 |
| `html.duckduckgo.com` | 🟢 키 0 · 결제 0 | 🟢 | — | 🟢 `kl=kr-kr` | 🟡 금지 조항 **없음**(robots `Allow: /`) | 🔴🔴 **운영자가 차단** | 🔴 **NO** |

### 🔴🔴 실제 검색 실행 결과 — **유효 측정 1건 · 나머지 측정불가**

```
🟢🟢 **1차 실행의 유효한 1건** — KR 지역 `"Bobo Choses" "B226AC009"` → 결과 5 중
   🇰🇷 **`lfmall.co.kr/app/product/DNSVXX00636`** = **한국 몰 상품 상세 URL**
   🟢🟢 **CORE-1B 의 US-only 검색에서는 나오지 않았다** ⟹ **「KR 색인에는 있다」의
      첫 직접 증거**(🔴 N=1 · 일반화 금지)
   🔴 그런데 운영 파이프라인에서 **DROPPED** — LF몰은 **9KB SPA shell**(WU-160 실측)이라
      Fetch 는 되는데 **Extract 가 안 된다**(가격 0)
🔴🔴 **그 뒤 전부 차단** — `HTTP 202` + 본문 `anomaly`. 60초 간격에도 **유효 응답 0/6**
   ⟹ 🔴 KR/US 비교 숫자를 **KPI 로 내보내지 않는다**(「측정불가 ≠ 0」)
🔴🔴 **내가 또 `ok` 를 잘못 읽었다** — 차단 페이지가 **202** 로 와서 `res.ok === true` 였고
   1차 실행이 「15 질의 0 결과」를 **정상 측정처럼** 찍었다. 🔴 WU-105 의 **재발** 이다.
   🟢 `status !== 200 || /anomaly/` 게이트를 박아 그 거짓을 **FAIL 로 뒤집었다**
```

### 🔵 CPO/CEO 결정 — **하나**

```
🔵🔵 **무료 키 1개 발급**(비용 0 · 카드 0):
   1순위 **Tavily** — 🟢 카드 불필요 · 🟢 고갈 시 **하드 스톱**(자동 과금 **구조적으로 없다**)
   2순위 **Decodo** — 🟢 10K recurring · 🟢🟢 **geo=KR + language=ko** (국내 색인 손잡이)
   🟢 둘 다 키만 있으면 **CTO 가 즉시 B226AC009 전 KPI 를 측정** 한다(구현 전)
🟡 그리고 **TRACK B 는 결정 하나로 열린다** — `NEXT_PUBLIC_MI_SUPPLIED_URL_INPUT=true`
   🔴 단 WU-154 의 교훈을 지켜야 한다 — 「셀러가 URL 을 **찾아** 넣는다」는 CPO 가 폐기했다.
      🟢 이 경로는 「셀러가 **AI 답변 하나를 붙여넣는다**」이고 **파서가 URL 을 뽑는다**
         (`extractCandidateUrlsFromAiAnswer`) ⟹ **다른 UX** 다
🔴 CTO 는 아무것도 열지 않았다 — 키 발급 0 · 계정 0 · 결제 0 · flag 0 · 코드 0
```

### 🟢 CORE-2 게이트

```
비용               🟢 **$0**(키 0 · 계정 0 · 결제 0)
운영 코드 변경      **0** — MI 0 · Price 0 · UI 0 · Adapter/Registry 0 · threshold 0 ·
                   MODEL_CODE 0 · synonym 0 · Seller 입력 0 · 수동 injection 0 · DB 0
typecheck          0
회귀                632 files / **8,812 passed** / 1 failed(외부 사이트 변화 ·
                   `p54c1-grounding-redirect` · 3세션 연속 같은 실패 · 내 변경과 무관)
하니스              `core-2-free-discovery`(`CORE2_FREE=1` · 차단 판별 게이트 포함)
```

---

## 6-P. [종료] CORE-1D — AI Search 실행경로 비교

### 🔴🔴🔴 먼저 — **내 CORE-1B 결론을 «내가» 약화시킨다**

```
CORE-1B 는 「국내 신품 상세 URL 이 검색 색인에 없다 ⟹ 병목은 executor 가 아니다」로 닫았다.
🔴🔴 그 측정에 쓴 무료 검색 도구가 **US-only 색인** 이다(도구 명세 원문: 「US-only」).
⟹ 🔴 **「색인에 없다」가 「US 색인에 없다」일 수 있다.** 한국 몰은 KR 지역화 검색에서
   훨씬 잘 걸릴 수 있고, 그 축은 **측정하지 않았다**.
🟢🟢 그리고 바로 그 축의 손잡이가 **OpenAI 에 타입으로 존재한다** —
   `WebSearchTool.user_location = { type:"approximate", country:"KR", city, region, timezone }`
🔴 운영 Gemini 경로에는 **지역/언어 파라미터가 없다**(`preferredDomains` 를 프롬프트에
   적는 것뿐 · `google-discovery.ts:188·217`) ⟹ 지역은 Google 서버가 정한다.
⟹ 🔵 **그래서 executor 를 여는 것이 여전히 가치가 있다.** CORE-1B 의 숫자를 폐기하지는
   않되(그 측정은 유효하다) **「전수 결론」으로 쓰지 않는다**.
```

### 🟢🟢 Executor 비교표 — **1차자료로 채웠다**

| 방식 | AI Search | 실제 URL | 국내 상품 | Production | 비용 | 정책 | 구현 | 판정 |
|---|---|---|---|---|---|---|---|---|
| **Gemini Grounding** | 🟢 O | 🟢 `groundingChunks` **구조화** | 🟡 과거 trenbe·mustit(리세일) | 🔴 **402**(prepay $0) | 🟢🟢 **$14/1k + 월 5,000 무료** · 재개 **최소 $5** | 🟢 이미 운영 · 저장 금지 없음 | 🟢 **거의 0** | 🟢🟢 **1순위** |
| **OpenAI web search** | 🟢 O | 🟢 **`sources` 목록** + `url_citation` | 🟢🟢 **`user_location.country="KR"`** | 🔴 키 **없다** | 🟡 **$10/1k**(reasoning) · **$25/1k**(non-reasoning) | 🟢 **저장/DB 금지 조항 없음** | 🔴 **SDK 업그레이드 필요** | 🟡 **2순위** |
| **Perplexity Search API** | 🟢 O | 🟡 「raw web search results」(모양 미확인) | ❔ | 🔴 키 없다 | 🟢🟢 **$1/1k**(fast) · $5/1k | 🟢🟢 **「Customer owns all Output」** · 저장 금지 **없음** | 🟡 provider 1파일 | 🟡 **3순위 후보** |
| **Playwright → AI Search 웹 UI** | 🟢 | 🟢 DOM | 🟡 | 🟢🟢 **런타임 실재** | 🟢 0원 | 🔴🔴 **robots 금지** | 🔴 | 🔴 **NO** |
| Exa / Brave | 🟢 | 🟢 | ❔ | 🔴 키 0 | — | 🔴 **DB 구축 금지 약관** | — | 🔴 **NO** |

### 🟢🟢 ① Gemini — **402 의 정체가 확정됐다**(같은 키로 반사실 측정)

```
같은 키 · grounding **없이** 호출        → 🔴 **402**
같은 키 · `google_search` tool 포함      → 🔴 **402**
`gemini-3.8-flash`(최신 권장 모델)       → 🔴 **402**
본문: 「Your prepayment credits are depleted … ai.studio/projects … billing#prepay」
⟹ 🟢 **키는 유효하다**(401/403 아님) · 🟢 **grounding 전용 문제가 아니다** ·
   🟢 **모델 문제가 아니다** ⟹ 🔴 **원인은 「선불 크레딧 $0」 하나다**
```

🔴🔴 **그리고 공식 billing 문서가 길을 좁혔다**(1차자료 인용):
```
「Prepay 잔액이 $0 이면 **그 billing account 에 묶인 모든 프로젝트의 모든 API 키가
  동시에 멈춘다**」 · 「**무료 티어로 자동 강등되지 않는다**」
🔴🔴 「**Prepay → Postpay 전환은 지원되지 않는다**」 ⟹ 종량제로 바꿀 수 없다
🟢 유일한 길 — **크레딧 구매**(최소 **$5** · 최대 $5,000)
🟡 우회 하나 — **Free Tier 는 billing account 가 필요 없다**(새 프로젝트/새 키).
   🔴 단 Free Tier 는 「Content used to improve our products」다 ⟹ **제품 데이터 정책 결정**
   이고 grounding 포함 여부도 **미확인** ⟹ CTO 가 열지 않았다
```

🟢🟢 **비용이 처음으로 «숫자» 가 됐다**(그동안 UNKNOWN 이었다):
```
Grounding with Google Search  **$14 / 1,000 requests**
                              🟢 **월 5,000 무료**(「shared across all Gemini 3 and newer models」)
planner 8축 = 상품당 8 requests ⟹ 🟢 **월 625 상품까지 무료 할당 안** 이다
             (현재 스냅샷 498 → 8축 전수면 3,984 requests/월 ⟹ **무료 범위**)
🔴 그 무료 할당이 **prepay $0 상태에서도 나가는지는 미확인** — 실측이 402 다.
   🔴 그래서 「$5 만 넣으면 사실상 공짜」로 **단정하지 않는다**
```

### 🟡 ② OpenAI — 🔴 **「SDK 가 이미 있다」는 내 직전 보고를 정정한다**

```
설치본 `openai@**4.104.0**` 실측 — `sources` 칸 **0** · `'web_search'`(비-preview) **없음** ·
  모델 목록이 `gpt-4o-search-preview` 세대 · 최신은 **7.43.0**(메이저 **3단계** 뒤)
공식 문서 실측 — 현행은 `web_search` 이고 **`sources` 필드로 URL 전체 목록** 을 준다 ·
  지원 모델 `gpt-6-astra`·`gpt-5.5`(Responses) · `gpt-5-search-api`(Chat) ·
  `web_search_preview` 계열은 **legacy/deprecated**
⟹ 🔴 **「타입이 있다 = 호출 가능」이 아니다**(CPO 가 경고한 그 함정) — **SDK 업그레이드 선행**
🟢 유리한 점 둘 — ⒜ **`user_location.country="KR"`**(국내 축의 유일한 명시적 손잡이)
   ⒝ **저장·DB 구축 금지 조항이 없다**(Exa/Brave 와 다르다)
🔴 키는 **로컬·Production 모두 없다** ⟹ 확보 경로 = platform.openai.com 결제 등록 +
   project API key 발급 ⟹ **CEO 비용/계정 결정**
🟢 참고 — `packages/image/src/providers/classifier/openai.provider.ts:27` 이 이미
   `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` 를 쓴다(패턴은 있다)
```

### 🔴 ③ 브라우저 기반 AI Search — **런타임은 되고 정책이 막는다**

```
🟢🟢 런타임 전제는 **충족** 된다 — `apps/admin/next.config.ts` 가 `playwright-core` ·
   `@sparticuz/chromium` 을 `serverExternalPackages` + 번들 포함으로 **명시 패키징** 한다
   ⟹ 「서버에서 브라우저를 못 띄운다」는 **사실이 아니다**
🔴🔴 그런데 **대상 서비스가 전부 자동화를 금지한다**(robots 원문 실측):
   `chatgpt.com/robots.txt`      → 공개 랜딩만 Allow 하고 마지막이 **`Disallow: /`**
                                   (대화·검색 경로 전부 차단)
   `gemini.google.com/robots.txt` → `Disallow: /app/` · **`Disallow: /chat/`**
🔴 그리고 Anthropic AUP 는 「**services that route requests through consumer
   subscriptions**」를 **글자로** 금지한다(메모 `no-external-ai-api-and-no-subscription-routing`)
🟡 CPO 조건(「공식적으로 자동화를 허용하는 경우만 후보」)을 충족하는 AI Search 웹 UI를
   **찾지 못했다** — 공식 자동화 경로를 가진 곳은 전부 **API 를 내놓는다**(= ①②③ 축)
⟹ 🔴 **축 3 는 NO.** 🔴 단 「브라우저 자동화라서」가 아니라 **「대상이 금지해서」** 다
```

### 🔵 CPO/CEO 결정 — **하나로 좁혀졌다**

```
🔵🔵 **Gemini billing 에 크레딧 $5 를 넣을 것인가**(≈ ₩7,000 · 최소 단위)
   🟢 그러면 **코드 변경 0 으로** 즉시 실행경로가 열린다(`collectGeminiCandidatePool` 이 있다)
   🟢 월 5,000 무료 검색이 유효하면 **실사용 비용이 토큰뿐** 일 수 있다(🔴 미확인)
   🔴 flag 는 **전역 스위치** 다 ⟹ 1상품 1회 probe 로만 열고 즉시 OFF
🟡 차선 — OpenAI 키 발급 + **SDK 7.43 업그레이드**
   🟢 그 축만이 **`country="KR"`** 를 준다 ⟹ CORE-1B 의 US-only 한계를 **직접** 깬다
   🔴 비용이 Gemini 보다 비싸고(무료 할당 없음) SDK 메이저 3단계 업그레이드가 선행
🟡 3순위 — Perplexity Search API(**$1/1k** 최저 · Output 소유권 Customer) · 🔴 AUP 미판독
🔴 CTO 는 셋 중 아무것도 열지 않았다 — 키 발급 0 · 결제 0 · SDK 업그레이드 0 · 구현 0
```

---

## 6-Q. [종료] CORE-1B — 🔴 결론은 위 §6 이 **US-only 한계로 약화시켰다**

### 🔴🔴🔴 이 한 문단이 CORE-1B 의 결론이다

```
CPO 가 지정한 executor 둘은 **둘 다 자격증명에서 막혔다**(실측):
  Gemini  → 🔴 **402 Payment Required**(1 call · grounding 0 · URL 0 · 운영 owner 로 측정)
  OpenAI  → 🔴 키가 **로컬·Production 모두 없다**(Production env 28개 전수 · OpenAI 계열 0)
🔴 그래서 **과금 0** 인 검색으로 planner 8축을 돌려 **「돈을 쓸 가치가 있는가」** 를 직접 쟀다.
🔴🔴 **답 — 병목은 executor 가 아니다**:
   국내 호스트 **12** → 운영 모양 게이트 **4** → fetch **3** → MI 판정 **3**
     global.trenbe.com  SAME · 🔴 market **OVERSEAS**(USD 80 · basis FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE)
     tinyapple.net      SAME · OVERSEAS(USD 58)
     m.bunjang.co.kr    🟢 **DROPPED** — 중고 리스팅을 MI 가 거부했다(누출 0)
   ⟹ 🔴 **국내 SAME = 0** 이고 그 이유가 **MI 도 executor 도 아니다**.
      신품 국내 판매처(보몽드·쿠팡·롯데ON·크로켓·럭서스베이비·OCO·신세계·GS)의
      **상품 상세 URL 이 검색 색인에 없다** — 홈·브랜드·컬렉션·검색 페이지만 걸린다.
```

🔴🔴 **그리고 planner 의 한글 축이 «발화하지 않았다»** — 이것이 CORE-1 의 가설을 반증한다:

| planner 축 | 국내 상세 URL | 실제로 걸린 것 |
|---|---|---|
| `BRAND_CODE`(영문) | **1** | `global.trenbe.com/products/…b226ac009…` |
| `CODE_ONLY` | 1(중복) | 같은 trenbe · 나머지는 위키백과·eBay 소음 |
| `BRAND_DESIGN` | 1(중복) | 같은 trenbe · 나머지는 해외 Shopify |
| `SHOP_EN` | 1(중복) | 같은 trenbe |
| `BRAND_CODE_KO`(한글) | **0** | 쿠팡 **shop** · 보몽드 **홈** · 번개장터 keywords |
| `BRAND_DESIGN_KO` | **0** | donokids **홈** · 해외 Shopify 다수 |
| `PURCHASE_KO` | **1** | ocokorea `brand_view`(🔴 모양만 PRODUCT_PAGE · **UNREACHABLE**) |
| `PRICE_KO` | **1** | 번개장터 `products/99927762`(🔴 **중고**) |

```
🟢 고유 국내 상세 **4** — trenbe(신품·USD) · ocokorea(UNREACHABLE) · 번개장터(중고) · 당근(중고·다른상품)
🔴 ⟹ **신품 국내 판매처의 상세 URL 은 1건도 못 얻었다.**
🟢 검색 «답변 텍스트» 는 가격을 안다(쿠팡 89,540 · 보몽드 88,000) —
   🔴 그러나 그것은 snippet 이고 **CPO 가 성공으로 세지 말라고 한 것** 이다
🔴 WU-116/156/158 이 적은 「샵 이름은 나오는데 상세 URL 이 검색 결과에 없다」가
   **planner 의 8축으로도 재현** 됐다 ⟹ 질의를 더 만들어 풀리는 문제가 아니다
```

🟡 **그래도 Gemini 를 「무가치」로 적지 않는다** — WU-023-B(N=1)에서 Gemini 는
`global.trenbe.com`(SAME) + `m.web.mustit.co.kr`(PRESUMED_SAME · KRW 74,000)을 찾았다.
🔴 **그런데 그 둘은 이번 무료 검색이 찾은 것과 «같은 부류»**(한국 **리세일** 플랫폼)이고,
trenbe 는 통화 때문에 **OVERSEAS** 이며 mustit 은 `UNVERIFIED_SEARCH` 로 운영 게이트를 못 지났다.
⟹ 🔴 **유료 executor 를 열어도 「국내 SAME」이 생긴다는 증거가 없다.**

### 🔵 CPO 가 결정할 것 — 축이 **바뀌었다**

```
🔴 전 세션의 「Gemini 비용을 열까 / OpenAI 키를 발급할까」는 **1순위가 아니다** —
   둘 다 **같은 웹 색인** 을 보고, 그 색인에 국내 신품 상세 URL 이 **없다**.
🔵 실제로 남은 축은 **셋** 이고 전부 **CPO 정책** 이다:
   ⒜ **포털/오픈마켓 공식 API** — 🟡 Production env 에 `NAVER_DATALAB_CLIENT_ID/SECRET`(50d) ·
      `NAVER_API_ACCESS_KEY/SECRET_KEY`(37d)가 **실재한다**(이름 확인 · 값은 CTO 가 못 읽는다)
      🔴 `run-price-check.ts:31` 의 「네이버 검색 자격증명은 한 번도 설정된 적 없다」는
         **다른 키 이름**(`NAVER_SEARCH_CLIENT_ID`)에 대한 말이다 ⟹ **그 둘을 섞지 않는다**
      🔴 쇼핑 검색 API 권한 보유 여부 **미확인** · 반환 `link` 가 몰 상세인지 **미측정**
   ⒝ **1-hop 목록→상세**(WU-162 가 20 상세 URL · 가격 7/8 로 **이미 측정**)
      🔴 WU-052/073 HOLD 와 정면으로 만난다 ⟹ CPO 가 열어야 한다
   ⒞ **국내 SAME 0 을 «정상» 으로 확정**(§3 MARKET RULE 이 이미 그 모양이다)
🔴 CTO 는 셋 중 아무것도 열지 않았다 — Adapter 0 · Registry 0 · robots 우회 0 · 키 발급 0
```

### 🟢 CORE-1B 게이트

```
Gemini flag        🟢 **한 번도 ON 하지 않았다** — 운영 owner 는 flag 를 보지 않는다
                      (호출부가 본다) ⟹ 「probe 뒤 OFF」보다 안전하다. 계약으로 단언했다
실제 과금           🔴 **UNKNOWN** — CTO 는 Billing 을 읽을 수 없다(402 라 0 일 가능성이 크지만 **단정 안 함**)
운영 코드 변경      **0** · Adapter/Registry/MI/SAME/MODEL_CODE/가격/UI/seed **전부 0**
typecheck          0
회귀                632 files / **8,812 passed** / 1 failed
                   🔴 그 1건은 **외부 사이트 변화** 다 — `p54c1-grounding-redirect` 가
                      `www.junioredition.com` 을 기대하는데 그 사이트가 더 이상 `www.` 로
                      리다이렉트하지 않는다(내 변경과 무관 · 직전 세션에도 같은 실패)
하니스              `core-1b-executor-probe`(`CORE1B_PROBE=1`) · `core-1b-free-executor`(`CORE1B_FREE=1`)
```

### 🔴🔴 부수 발견 — **FINAL-1 의 원인 진단이 반증됐다**(고치지 않았다)

```
FINAL-1 은 brand 복구 실패를 「사이트가 429 로 거부한다」로 적었다. 🔴 **둘 다 반증했다**:
  ⒜ 「고정 429」 ❌ — 같은 HTML 을 **단독으로 받으면 856,663B 성공**(3/3)
  ⒝ 「products.json 직후라서」 ❌ — 즉시 HTML 이 **성공** 한 실행도 있다
🟢 실제는 **간헐적 거부** 다 — 같은 실행에서 즉시 🟢 · +3s 🔴 · +18s 🟢
🔴 그래서 **프로세스의 첫 시도** 는 여전히 노출돼 있다(memo 는 1회 성공 뒤에만 돕는다).
   이번 두 측정에서 brand 복구가 **1회·2회·4회** 째에 성공했다(실측).
🔴🔴 **그 영향이 작지 않다** — brand 가 비면 planner 가 `CODE_ONLY` **1축** 으로 쪼그라든다
   (1차 실행에서 실제로 그랬다). ⟹ 🔵 **CPO 판정 사안**(FINAL-1 은 CPO 가 GO/수용으로 닫았다)
🟢 하니스는 **운영 함수를 재시도** 해서 확보했다 — 값을 지어내지 않았다
```

---

## 6-R. [종료] EXECUTOR FEASIBILITY — 🔴 아래 추천 1순위는 **CORE-1B 가 정정했다**

### 🔴🔴 먼저 — **내가 planner 를 이미 `main` 에 push 했다**(CPO 「배포 보류」와 어긋난다)

```
🔴 `a46a8d19` 가 `main` 에 들어갔고 이 리포는 **main push = Production 배포** 다
🟢 그러나 **동작 변화는 0** 이다 — `query-planner.ts` 의 **운영 호출부가 0** 이다
   (전수 grep: 자기 파일과 자기 테스트 말고 참조 **없음**) ⟹ 죽은 코드다
🔴 되돌리는 것도 **또 한 번의 Production 배포** 다 ⟹ **CTO 가 임의로 되돌리지 않았다**
🟡 CPO 선택 — ⒜ 그대로 둔다(동작 0) ⒝ `git revert a46a8d19`(또 배포) ⒞ executor 결정까지 보류
🟢 `ce3a42ca`(FINAL-1 · brand 93%)는 **그대로 유지** 된다
```

### 🔴🔴 Executor 후보 전수 — **설치/키/정책을 코드로 확인했다**

| Executor | Production 호출 | URL 반환 | 다중 Query | 국내 상품 URL | 비용/조건 | 연결 난이도 | 판정 |
|---|---|---|---|---|---|---|---|
| **Gemini grounding**(REST · 기존 코드) | 🟢 **코드 있다** | 🟢 `groundingChunks` | 🟢 | 🟡 **실측 있다**(아래) | 🔴 **402 크레딧 소진** | 🟢 **거의 0** | 🟡 **비용 결정** |
| **OpenAI Responses `web_search`** | 🟡 SDK **이미 설치** | 🟢 citations | 🟢 | ❔ **미측정** | 🔴 키 **미설정** · 단가 UNKNOWN | 🟡 provider 1파일 | 🟡 **정책+비용** |
| Exa | 🔴 하니스만 · 키 0 | 🟢 | 🟢 | ❔ | 🔴 §4.2(a) **저장 금지** 약관 | 🟡 | 🔴 **NO** |
| Anthropic `web_search` | 🔴 하니스만 · 키 0 | 🟢 | 🟢 | ❔ | 🔴 CPO 전략상 제외 | 🟡 | 🔴 **NO** |
| Naver Search API | 🔴 **제거됨** | 🟢 | 🟢 | 🟢 **최적일 것** | 🔴 **한 번도 설정된 적 없다** | 🟡 신규 가입 | 🟡 **미탐색** |
| Playwright + 포털 검색 | 🟢 설치됨 | 🟢 | 🟢 | 🟢 | 🔴🔴 **약관 금지** | 🔴 | 🔴 **NO** |
| 소매처 직접(robots+sitemap+suggest) | 🟢 0원 | 🟢 | 🟢 | 🟡 | 🟢 **0원** | 🔴 | 🔴 커버리지 상한 = **Registry**(§12-0 충돌) |

🟢 **코드로 확인한 사실**:
```
설치 SDK — `openai@**4.104.0**`(🟢 `WebSearchTool` 존재 · `responses.d.ts:3596` ·
   type `web_search_preview`) · `@google/generative-ai@0.21.0`(🔴 `googleSearch` tool **없음**
   ⟹ 운영 Gemini 는 SDK 가 아니라 **직접 REST** 다) · `playwright@1.47`
운영이 읽는 AI 키 — `GEMINI_API_KEY`(🟢 설정됨) · `EXA_API_KEY`·`ANTHROPIC_API_KEY`
   (🔴 **벤치마크 하니스에서만** 읽는다 · 키 **미설정**)
`NAVER_SEARCH_CLIENT_ID` — 🔴 **주석뿐**(「제거했다 · 한 번도 설정된 적 없다」)
```

### 🟢🟢 추천 1순위 — **Gemini**(🔴 단 비용 결정이 선행)

```
🟢 연결 난이도가 **거의 0** 이다 — `collectGeminiCandidatePool` → `searchResults` 합류 구조와
   `candidateUrls` 경계가 **이미 있다**(WU-024/130 이 깔아 둔 길)
🟢🟢 그리고 **유일하게 「국내 후보를 실제로 찾은」 실측 증거가 있다** — WU-023-B(N=1):
   Gemini 1 call · grounding 3 · discovered 5 → usable 2 → MI candidates 2
   **SAME 1 · PRESUMED_SAME 1** 이고 그 둘이 **한국 리세일 플랫폼**
   (`global.trenbe.com` · `m.web.mustit.co.kr`) ⟹ 🟢 **우리 등록부 밖을 찾아왔다**
🔴 막는 것은 **비용 하나** 다 — 402(크레딧 소진) · 상품당 원화 단가 **UNKNOWN**
   (CTO 는 Billing 을 읽을 수 없다 · WU-012/013 에서 확정)
🔴 그리고 flag 는 **전역 스위치** 다 — 켜면 `/today` 일괄이 잔액을 한 번에 태운다
   ⟹ 🔴 **1상품 1회 probe 로만** 열어야 한다
```

🟡 **차선 — OpenAI `web_search`**: 🟢 SDK 가 **이미 있다**(추가 의존성 0) · 🔴 키 미설정 ·
🔴 **국내 상품 URL 품질은 미측정** · 🔴 §12-0 「외부 AI/검색 API 전면 제외」에 걸린다.

### 🔵 CPO 가 결정할 것 — **하나**

```
🔵 「Gemini 를 **1상품 1회 probe** 로 다시 열 것인가」(비용 결정 · flag 는 즉시 OFF)
   🟢 그 1회로 나오는 것 — 국내 상세 URL 수 · SAME 수 · 가격 수 · **실제 과금액**
   ⟹ 그 숫자가 있으면 **executor 선택이 끝난다**
🟡 또는 「OpenAI web_search 를 §12-0 예외로 열 것인가」(정책 결정 + 키 발급)
🔴 CTO 는 둘 중 아무것도 열지 않았다 · Gemini flag **OFF 유지** · 키 발급 **0**
```

🟢 이번 작업 — **코드 추가 0** · 배포 **0**(위 push 건은 별도) · Query 추가 실험 **0** ·
Adapter/Registry/MI/SAME/MODEL_CODE/synonym/seed **전부 0**.

---

## 6-S. [종료] CORE-1 전반부 — Query Planner PASS

### 🔴🔴🔴 Q1 — **Production runtime 의 AI Search capability = 0**(전수 확인)

```
외부 «검색» endpoint 전수 = `generativelanguage.googleapis.com` **둘** 뿐
   · `vision-evidence.ts:167`(이미지 Vision)
   · `google-discovery.ts:53`(Gemini grounding) ← 🔴 **CPO 가 폐기한 그것**
🔴 그 외 검색 provider endpoint **0** · 검색 API 키 **0**
🔴 `NAVER_SEARCH_CLIENT_ID` 는 **주석뿐** —
   `run-price-check.ts:31` 「제거했다 — 실제로 **한 번도 설정된 적이** 없다」
🔴 `packages/image/.../openai.provider.ts` 는 **이미지 분류기**(`tools` 없음 · 웹검색 0)
⟹ 🔴🔴 **CORE-1 의 「Search 실행」은 현재 금지 집합 안에 수단이 0 이다**
   (⒝ 외부 검색 API = §12-0 전면 제외 · ⒞ Gemini = CPO NO-GO)
```

### 🟢🟢 Q2~Q4 — **Query Planner 는 구현했다**(순수 · MI 경계 잠금)

🟢 `packages/crawler/src/discovery-core/query-planner.ts` — `buildDiscoveryQuerySet(identity)`
```
상품당 질의 **8개**(고정 N 이 아니다 — 증거가 없으면 그 축을 **만들지 않는다**)
  BRAND_CODE       "Bobo Choses" "B226AC009"
  BRAND_CODE_KO    "보보쇼즈" "B226AC009"          ← 🟢 **운영 질의에 없던 축**
  CODE_ONLY        "B226AC009"
  BRAND_DESIGN     "Bobo Choses" "Hug Hairy Monster T-shirt"
  BRAND_DESIGN_KO  "보보쇼즈" "Hug Hairy Monster T-shirt"  ← 🟢 **혼합**(브랜드만 한글)
  PURCHASE_KO      "보보쇼즈" "B226AC009" 구매
  PRICE_KO         "보보쇼즈" "B226AC009" 가격
  SHOP_EN          "Bobo Choses" "B226AC009" shop
🔴 **새 사전 0** — 쓰는 자산은 둘뿐이다: `lookupBrandAlias`(기존) ·
   `buildPrimaryQuery(...).tokens`(기존 denylist)
🔴 **한글 디자인명 음역 축은 만들지 않았다** — 그 자산이 0 이고, 만들면 그것이 바로
   CPO 가 FINAL-2 에서 **추가하지 않기로 한** 사전이다
🟢 계약 **14** — 특히 **C-1/C-2 가 「Search↔MI」 경계를 양방향으로 잠근다**
   (planner 가 MI 를 import 하지 않고 · MI 가 planner 를 import 하지 않는다)
🟢 B-2 는 **소스의 한글 리터럴을 전수** 로 보고 `"구매"`·`"가격"` **둘만** 허용한다
   ⟹ 🔴 다음 사람이 음역 사전을 몰래 넣으면 **FAIL 한다**
```

🔴🔴 **계약이 내 설계 결함을 잡았다** — D-4 가 1차에서 FAIL 했다. 품번이 있으면
`buildPrimaryQuery` 가 `L1_MODEL_CODE` 로 가서 `tokens` 가 **[브랜드, 품번]** 이 되고
**디자인명이 안 나온다.** 🟢 규칙을 복제하지 않고 **같은 owner 를 품번만 비워** 불러 고쳤다.

### 🔴 Q5 — **질의를 넓혀도 국내 상세 URL 은 0**(아홉 번째 재현)

```
`"보보쇼즈" "B226AC009" 구매`(= 운영에 없던 PURCHASE_KO 축) 실측 —
   스니펫은 **쿠팡 89,540 · 보몽드 88,000 · 번장 66,000** 을 적는다
   🔴 그런데 링크는 **샵 홈 · 검색결과 · 위키백과 · eBay** ⟹ 국내 **상세 URL 0**
⟹ 🔴🔴 **병목은 planner 가 아니라 executor 다** — WU-156/158/159/161 과 합쳐
   **질의 9종+** 에서 같은 모양이 재현됐다
```

### 🔵 CORE-1 판정 — **전반부 PASS · 후반부 BLOCKED**

```
🟢 Query Planner        구현·계약 완료(MI 변경 0 · 새 사전 0 · HTTP 0)
🔴 Search 실행           **capability 0** ⟹ CORE-1 PASS 조건(3상품 자동 SAME) **미충족**
🔴 그 수단을 여는 것은 **CPO 가 닫아 둔 두 축**(⒝ 외부 검색 API · ⒞ Gemini) 뿐이다
🔴 CTO 는 둘 중 아무것도 열지 않았고, 자기 검색 도구를 **「Production capability」로
   쓰지 않았다**(그것은 CTO 도구이고 서버의 능력이 아니다 · WU-157 에서 확정)
```

🟢 운영 코드 — **planner 1파일 신설**(MI·가격·UI·Registry·Adapter **0**) · 배포는 CPO 판정 뒤.
🟢 typecheck **0** · 회귀 **8,812 passed / 1 failed**(🔴 외부 간헐 ·
`p54c1-grounding-redirect` · `www.junioredition.com` · 실패→통과→실패→실패 **4회 관측**).

---

## 6-T. [종료] WU-FINAL 1·2·3

### 🟢🟢 FINAL-1 — **배포 완료**(`ce3a42ca`) · brand 복구 **20% → 93%**

```
구현 — `fillRejectedBrand`(shopify.site-strategy.ts)에 **호스트 단위 기억** 한 겹
🟢 근거: `og:site_name` == JSON-LD `Organization.name` 은 **상점 단위 상수** 다
🔴 429 수정 0 · retry 대수술 0 · cache 설계 0 · DB 저장 0 · MI/SAME 게이트 0 ·
   호스트명을 브랜드로 간주 0 · 음성 캐시 0(실패를 기억하면 영구 포기)
실측 — 3/15(20%) → **14/15(93%)**  (AC009 4/5 · AC010 5/5 · AC117 5/5)
계약 **9** · 음성대조 M1 **2 FAIL** · M2b **1 FAIL** · M3 **1 FAIL** → 9/9 복구
🔴 M2 1차는 **무효 변이** 였다(`""` 를 담아 `if (memo)` 에 안 걸렸다) — 실효 변이로 다시 했다
```

### 🟢 FINAL-2 — **추가 코드 0 으로 종료**(CPO 수용)

```
🟢 품목 한/영 synonym · 브랜드 alias 는 **이미 있다**(WU-165/167/151 실측)
🔴 그 둘의 **TITLE 축 효과는 0** 이다 — 품목명은 **taxon 으로 통합** 되어 토큰이 안 겹치고
   브랜드는 **노이즈로 제거** 된다
🔴 더 나가는 것(상품명 token 교차 매칭)은 **DIFFERENT 5/6 을 같이 연다**(WU-171)
⟹ 🔴 추가하면 CPO 의 「precision regression 전체 통과」 조건을 **깬다** ⟹ 하지 않았다
```

### 🔴🔴 FINAL-3 — **자동 경로는 돈다. 그런데 국내 SAME 이 0 이다**

| 상품 | brand | 자동후보 | detail | fetch | extract | MI | SAME | 가격 | 최종 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| B226AC009 | 🔴 (빔) | 6 | 6 | 6 | 6 | 6 | **0** | 0 | **A** |
| B226AC010 | Bobo Choses | 16 | 16 | 16 | 16 | 16 | **0** | 0 | **A** |
| B226AC117 | Bobo Choses | 16 | 16 | 16 | 16 | 16 | **0** | 0 | **A** |

🔴 **`candidateUrls` 주입 0** — 운영 자동 생산자(`searchDomesticShops`)만 돌렸다.

```
🟢🟢 **공급·fetch·추출은 전부 작동한다** — 후보 6~16 · detail 16/16 · fetch 16 · **extract 16**
🔴 그런데 전부 **DROPPED** (looxloo 8 · rulii 3 · foretforet 5)
🔴 원인은 MI 결함이 아니다 — **그 샵들이 그 상품을 팔지 않는다**
   (WU-130 이 후보 내용을 전수 확인했다: 앞치마·턱받이·레깅스… · confidence 0.00~0.10)
🔴🔴 그리고 **실제로 그 상품을 파는 샵은 어댑터가 없다** —
   보몽드 · 비스킷 · 머스트잇 · 도노키즈 **전부 등록부/어댑터 밖** 이다
⟹ 🔴🔴 **자동 경로로는 국내 가격 참고가 «구조적으로» 0 이다**
```

🔴 **자동 생산자 셋의 상태(코드 사실)**:
```
① `candidateUrls` — 🔴 자동 1회차가 **보내지 않는다**(`pipeline/page.tsx:481` 이
   `{ snapshotId }` 하나만 보낸다)
② 등록부 `searchDomesticShops` — 🟢 **돈다**(위 표) · 🔴 어댑터 8개가 상한
③ `__reviewed_same__` — 🟢 조건 없이 돈다 · 🔴 **사람이 이미 SAME 이라 표시한 URL만**
   ⟹ 새 상품엔 비어 있다(닭-달걀) · service-role 필요 ⟹ **측정불가**
```

🟡 **대조 — 수동 주입이면 되는 것은 WU-172 가 이미 증명했다**(같은 상품·같은 코드):
```
B226AC009 → **B 가격 참고 1건**(보몽드 KRW 83,600 · tier SAME · market KR)
B226AC010 → **B 가격 참고 1건**(보몽드 KRW 83,600 · tier SAME · market KR)
B226AC117 → A (비스킷 ₩258,000 · 머스트잇 ₩233,000 **추출됐지만** PRESUMED_SAME)
🟢🟢 DIFFERENT 오염 **0**(luksusbaby.kr human DIFFERENT → CONFLICT)
⟹ 🔵 **엔진은 살아 있고 막힌 것은 「그 URL 이 자동으로 오지 않는다」 하나다**
```

### 🔵 CPO 판정 사안 — **공급의 주인 하나**

```
🔴 CTO 가 고를 수 없다(전부 CPO 가 닫아 둔 축이다):
   ⒜ 셀러 URL 입력 되살리기      — WU-154 에서 CPO 가 **폐기**
   ⒝ 서버가 외부 검색 호출       — §12-0 **외부 AI/검색 API 전면 제외**
   ⒞ Gemini flag ON             — 비용 · WU-157 에서 **축 폐기**
   ⒟ 어댑터/Registry 확대        — §12-0 금지(🔴 단 **그 상품을 파는 4곳이 전부 거기 있다**)
   ⒠ 🟡 `candidate_reviews` 시딩 — 🟢 **코드 변경 0** · 자동 재투입(③)이 **이미 돈다**
      🔴 사람이 SAME 을 한 번 표시해야 한다(닭-달걀을 **한 번만** 깨면 된다)
```

🟢 운영 코드 **0**(FINAL-3) · typecheck **0** · 회귀 **631 files / 8,798 passed / 1 failed**
🔴 그 1건은 **외부 사이트 간헐** 이다(`p54c1-grounding-redirect` · `www.junioredition.com` ·
실패→통과→실패 3회 관측 · 🟢 내 변경과 무관).

---

## 6-U. [종료] WU-173 — brand 실패 원인은 추가 fetch 의 429

> 🟢🟢 원인이 **한 지점으로** 좁혀졌다. 🔴 그리고 **운영에 이미 그 장치가 있다** —
> 그래서 「코드로 못 고친다」가 아니라 **「그 장치가 이 경로에서 부족하다」** 다.

### §5 안정성 표 — 상품 3종 × **5회**(시도 사이 **25초 간격**)

| 상품 | 시도 | brand 발견 | 미발견 | 성공률 |
|---|---:|---:|---:|---:|
| B226AC009 | 5 | 0 | 5 | **0%** |
| B226AC010 | 5 | 1 | 4 | **20%** |
| B226AC117 | 5 | 2 | 3 | **40%** |
| **전체** | **15** | **3** | **12** | **20%** |

### 🟢 §4 원인 분해 — **분기 다섯 중 ④ 하나** 다(raw evidence)

```
① vendor      🟢 정상 — 전건 **"AW26"**(브랜드로 쓸 수 없는 값)
② 거부 판정    🟢 정상 — 전건 `resolveBrandName` 이 **거부**(복구 경로에 제대로 진입한다)
③ 중복 방지    🟢 해당 없음
④ 추가 fetch   🔴🔴 **여기서 전부 실패한다** —
      직접 fetch 도 **429** …… **6/15**
      직접 fetch 는 **200 + "Bobo Choses" 복구** …… **6/15**
⑤ og/Organization 부재  🟢 **0건** — HTML 이 오면 **항상** 두 값이 있고 같다
⑥ 추출 실패   🟢 **0건**        ⑦ merge 소실  🟢 **0건**
```

🔴🔴 **그 「6/15 는 직접 fetch 가 200」을 «운영 fetch 의 별도 결함» 으로 읽지 않는다** —
내 직접 fetch 는 운영 fetch **20초 뒤**에 일어난다(내가 넣은 간격). 🟢 그것이 말하는 것은
**「시간이 지나면 429 가 풀린다」** 이고, 🔴 **동시 비교가 아니다**(내 하니스의 한계).

### 🔴🔴 그리고 **「내가 429 를 유발했다」도 단정할 수 없다**

```
운영 `domain-rate-limiter.ts` 가 **이미** 그 429 를 다룬다 —
   `MAX_RETRY_ON_429 = 1`(지수 백오프) · `Retry-After` 기록 · 429 시 **node:https 폴백**
🔴 그 파일 주석이 **실측으로 반증해 뒀다** — 「이 429 는 **「요청이 많다」가 아니다**」
   `node fetch(undici)` **429** · 헤더를 바꿔도 **429** · **새 프로세스의 첫 fetch 도 429**
⟹ 🔴 **내 호출 빈도만으로 설명되지 않는다.** 둘 다 섞여 있을 수 있고 **분리하지 못했다**
```

### 🟡 판정 — **HOLD**(🔴 단 NO-GO 는 아니다)

```
🟢 GO 조건(「반복 측정에서 안정적」)은 **미충족** — 20% 다
🔴 NO-GO 조건(「다른 안정적 brand source 가 없다」)도 **아니다** —
   🟢 HTML 이 오면 `og:site_name` == `Organization.name` 이 **항상** 있다(⑤⑥ 0건)
   🟢 그리고 운영에 **429 재시도/폴백 장치가 이미 있다**
⟹ 🟡 **「장치가 이 경로에서 부족하다」** 가 정확한 상태다
```

### 🔵 다음 WU 가 **먼저 재야 할 한 가지**(🔴 CTO 가 고치지 않았다)

```
🔵 「`fetchPlainHtmlWithFinalUrl` → `fetchWithDomainRateLimit` 경로에서 **429 폴백이
   실제로 발화하는가**」 — 🔴 **미측정** 이다(계측/로그 없이는 볼 수 없다)
   🟢 발화하는데도 20% 면 **재시도 1회가 부족** 하다는 뜻이고,
   🔴 발화하지 않으면 **그 경로가 폴백을 안 타는 것** 이다 — 처방이 **완전히 다르다**
🟡 최소 수정 후보 둘(판정 뒤에) — ⒜ **재시도/백오프 확대** ⒝ 🟢 **원상품 brand 캐시**
   (같은 원상품을 반복 추출할 때 추가 fetch **0** · 🔴 저장이라 **정책 영역**)
```

🟡 **그리고 WU-172 의 관측 ⒝ 가 «간헐» 로 확정됐다** — `p54c1-grounding-redirect` 가
이번 회귀에서 **통과** 했다(`junioredition.com` 의 `www.` 가 돌아왔다) ⟹ 🔴 그 테스트는
**외부 사이트에 묶여 흔들린다**. 🔴 고치지 않았다(이 WU 범위 밖).

🟢 운영 코드 **0** · 배포 **0** · typecheck **0** · 회귀 **8,790 passed · 0 failed**.
🟢 하니스 `wu-173-origin-brand-stability.test.ts`(`WU_173_PROBE=1` · `WU_173_N` · `WU_173_GAP_MS`).

---

## 6-V. [종료] WU-172 — 국내 가격비교 E2E HOLD

> 🟢🟢 **처음으로 국내 SAME 이 실제로 섰다**(2상품 · `tier=SAME · market=KR · KRW 83,600`).
> 🔴 그런데 그것이 **실행마다 흔들린다** — 원인을 찾았다.

### §11 표 (국내 후보는 전부 **human GT 의 실제 URL** · 지어낸 것 0)

| 상품 | 후보 | Detail | Fetch | Extract | MI | **SAME** | 판매중 | **가격** | 최종 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| B226AC009 | 3 | 3 | 2 | 2 | 2 | **1** | 0 | **1** | **B** 가격 참고 1건 |
| B226AC010 | 3 | 3 | 3 | 3 | 3 | **1** | 0 | **1** | **B** 가격 참고 1건 |
| B226AC117 | 2 | 2 | 2 | 2 | 2 | 0 | 0 | 0 | **A** 참고 불가 |

```
🟢🟢 DIFFERENT 오염 **0** — `luksusbaby.kr`(human DIFFERENT · KRW 73,000)이 **CONFLICT** 로 차단됐다
🟢 SAME 가격은 실제 국내가다 — 보몽드 **KRW 83,600** · market **KR** · basis **SINGLE**
🔴 B226AC117 은 비스킷 **₩258,000** · 머스트잇 **₩233,000** 이 **추출까지 됐는데**
   둘 다 **PRESUMED_SAME** 이라 가격비교에 못 든다 ⟹ 🔵 **CASE C 에 가장 가까운 상품**
```

### 🔴🔴🔴 핵심 발견 — **원상품 brand 추출이 실행마다 흔들린다**

```
실측 3회 × 3상품 = 9 시도 중 brand 복구 성공 **2건(22%)**
  회차1 AC009 "" · AC010 "Bobo Choses" · AC117 ""
  회차2 전부 ""      회차3 AC009 "Bobo Choses" · 나머지 ""
🔴 그 값은 WU-134 `siteBrandName` 이 **HTML 1회를 더 받아** 복구한다(vendor 가 `AW26` 라 거부됨).
   그 추가 fetch 가 실패하면 **빈다.** 🔴 실패 원인은 **미규명**.
🔴🔴 비면 WU-133 의 사슬이 그대로 발화 — 원상품 brand 공백 ⟹ **모든 후보 BRAND_UNCONFIRMED**
   ⟹ PRESUMED_SAME ⟹ `crossSellerReserved` ⟹ 가격비교 **제외**
🟢 그래서 1차 실행은 **3상품 전부 CASE A** 였고, brand 가 살아난 재실행에서 **2상품이 CASE B** 가 됐다
🔴 **그 1차 숫자를 제품 사실로 적지 않았다** — 열화된 실행이다(메모 `degraded-live-run-is-not-a-zero`)
```

### CPO Q1~Q6 — 답

```
Q1 국내 후보 공급 충분한가        🔴 **자동 공급 0**(구조) — `page.tsx:481` 이 `{snapshotId}` 만 보낸다 ·
                                 등록부 검색은 이 상품들에서 후보 0(WU-114/130)
Q2 MI 가 너무 탈락시키는가         🔴 **아니다** — 탈락의 즉각 원인은 **원상품 brand 공백** 이다
Q3 SAME 인데 가격이 막히는가       🟢 **아니다** — 가격은 4건 다 나왔다(83,600 · 73,000 · 258,000 · 233,000)
Q4 실제 국내 판매가격인가          🟢 **그렇다**(KRW · market KR · `VERIFIED_CURRENT`)
Q5 동일상품 가격만 보여주는가      🟢 그렇다 — `buildPriceGuide` basis **SINGLE**(1건을 「가격대」로 부르지 않는다)
Q6 DIFFERENT 를 다시 노출하는가    🟢 **오염 0** · 🟢 셀러 화면의 후보 목록은 WU-149/152 에서 이미 제거됐다
```

### 🟡 판정 — **HOLD**

🟢 국내 SAME → 가격 → 「가격 참고 1건」까지 **실제로 연결된다**(2상품). 🔴 그러나
⒜ **자동 공급이 0** 이고 ⒝ **brand 복구가 22%** 라 **불안정** 하다 ⟹ CPO 기준 HOLD.

```
실제 병목 = **공급**(자동 0) **＋ Extract 이전의 「원상품 brand」**
🔵 다음 최소 WU = **원상품 brand 복구 안정화** — 🔴 MI·threshold·동의어 **전부 불필요** 하고,
   `siteBrandName` 의 **추가 fetch 실패율** 만 보면 된다(재시도 ↔ 캐시 ↔ 실패 사유 분류)
🟢 그것이 안정되면 B226AC117 이 **CASE C 후보** 다(가격 2건이 이미 추출된다)
```

🟡 **관측 2건(고치지 않았다)**:
```
⒜ 🔴 `soldOut` 이 국내 전건 **undefined**(= 모름)인데 verdict 가 **`SAME_BUT_NONE_ON_SALE`** 로
   나온다 ⟹ 「모름」이 셀러에게 **「파는 곳이 없다」** 로 읽힐 수 있다(WU-136 의 UNKNOWN 축)
⒝ 🔴 라이브 테스트 1건이 **외부 사이트 변화** 로 실패한다 —
   `p54c1-grounding-redirect` 가 `www.junioredition.com` 을 기대하는데 그 사이트가 **`www.` 를
   더는 안 붙인다**(단독 2회 재현 · 🟢 내 변경과 무관 · 운영 코드 변경 0)
```

🟢 운영 코드 **0** · 배포 **0** · typecheck **0** · 회귀 **630 passed / 1 failed(위 ⒝ · 외부 요인)**.
🟢 하니스 `wu-172-domestic-price-e2e.test.ts`(`WU_172_PROBE=1`).

---

## 6-W. [종료] WU-171 — 증거별 가치표

> 🟢🟢 CPO 가 물은 것(「상품명에 몇 주를 더 투자할 가치가 있는가」)에 **답이 나왔다.**

### 🔴 분모 — **25행**(human SAME 19 · DIFFERENT 6) · 원상품 **2개**

🟢 B226AC010 원상품 URL 을 **추측해 쓰지 않고 검증** 했다(`…/b226ac010-booty-ghosts-t-shirt.json`
→ handle·제목이 그 상품) ⟹ 분모가 12 → **25** 로 늘었다. 🔴 UNCERTAIN 2 는 뺐다.
🔴 **현재 SAME 을 못 받는 human SAME = 13** ← 회수 대상.

### 🔴🔴 증거별 가치표(운영 `axes/conflicts` 재집계 · 새 extractor 0)

| 축 | 회수기여 | leakage | SAME 일치율 | DIFF 일치율 | 판단 |
|---|---:|---:|---:|---:|---|
| **품번확인** | 0 | **0** | **5%** | **0%** | 🟢 **오염 0 · 그런데 거의 안 뜬다** |
| **COLOR** | 1 | **0** | 26% | **0%** | 🟢🟢 **가장 깨끗한 보조** |
| TITLE | 7 | 2 | 68% | 33% | 🟡 보조 |
| CATEGORY | 7 | 3 | 68% | 50% | 🔴 단독 위험 |
| AUDIENCE | 6 | 3 | 63% | 50% | 🔴 단독 위험 |
| MATERIAL | 1 | 2 | 26% | 33% | 🔴 **역방향** |
| SIZE | 0 | 1 | 26% | 17% | 🔴 단독 위험 |
| MODEL_CODE(축) | 0 | 0 | 5% | 0% | 🟡 약하다 |
| 🔵 **상품명 token** | 13 | **5** | **100%** | **83%** | 🔴🔴 **식별력 거의 없다** |

### 🔴🔴🔴 그래서 상품명 token 은 **투자 가치가 없다**

```
`SAME 100%` ↔ `DIFFERENT 83%` — 분리도 **0.17** 이다.
⟹ 🔴 그 축을 열면 human DIFFERENT **5/6** 이 **같이 열린다**
⟹ 🔴🔴 WU-166/167 이 「성립하지 않는다」로 닫은 것이 **옳았고**, 그 이유가 이제
   「자산이 없어서」가 아니라 **「열어도 식별력이 없어서」** 로 **더 강하게** 확정됐다
🟢 **CPO 분류 C** — 회수 대상 13 중 **강한 증거**(품번·색상·소재)가 있는 것 **2** · 없는 것 **11**
```

### 🟢 방어 쪽에서 드러난 것 — **색상이 가장 깨끗하다**

```
COLOR        DIFFERENT 차단 **3/6** · 🔴 SAME 오차단 **0/19**   ⟹ 🟢🟢 유일하게 깨끗하다
MODEL_CODE   DIFFERENT 차단 1/6 · 🔴 **SAME 오차단 4/19**        ⟹ 🔴 **과잉 차단**
             (헌장 WU-068 의 「품번 충돌 과잉 차단」과 정합한다)
COMPOSITION  DIFFERENT 차단 0/6 · 🔴 SAME 오차단 1/19            ⟹ 🔴 순손실
```

### 🔵 그래서 다음 좌표가 «상품명 밖» 으로 바뀐다 — CPO 결정

```
① 🟢 **품번 축을 넓히는 것**(WU-170)이 유일하게 **오염 0** 인 방향이다 —
   🔴 단 그것만으로는 **4점**(SAME 5점 필요) · 움직인 CF 기록 4건 중 **C47 기전 미규명**
② 🟡 **색상 축** — 깨끗한데 **일치율 26%** 다. 🔴 후보 페이지가 색상을 **안 준다**
   ⟹ 레버는 「색상 비교 규칙」이 아니라 **「색상 수집률」** 이다(WU-064 가 닫아 둔 자리와 다른 축)
③ 🔴🔴 **`MODEL_CODE` 과잉 차단 4/19** — 이 분모에서 **가장 큰 단일 손실** 이다.
   🔴 그 축은 CPO 가 금지해 둔 자리라 **CTO 가 열지 않았다**
🔴 상품명(동의어·음역·token)은 **격하** — 더 파지 않는다
```

🔴 분모 25(DIFFERENT **6**) · 원상품 **2개** — 「가치」를 일반화하지 않는다. 🔴 이 표는
**기여도** 이고 **어느 축도 단독으로 SAME 을 만들지 않는다**.
🟢 운영 코드 **0** · 새 extractor **0** · 새 사전 **0** · 배포 **0** ·
회귀 **631 files / 8,790 passed · 0 failed** · typecheck **0**.
🟢 하니스 `wu-171-evidence-value.test.ts`(`WU_171_PROBE=1`).

---

## 6-X. [종료] WU-170 — 품번 회수는 발화하지만 1점 부족

> 🔴🔴 **CPO 성공조건 미충족 ⟹ 배포하지 않았고 운영 코드를 되돌렸다.**
> 조건은 「Biskuit 이 운영 MI 에서 **SAME** 으로 회수 **+** 전체 regression **green**」이었다.

### 🟢🟢 변경은 **실제로 발화했다**(운영 경로 실측)

```
비스킷 후보 —  품번확인 🔴 → **🟢**  ·  축 합계 **1 → 4**  ·  verdict **SIMILAR → PRESUMED_SAME**
🟢 트렌비 **SAME 유지**(7점) · 🟢 luxboy **미회수 유지**(DIFFERENT 방어)
🟢 baseline precision **불변** — 통합 GT 64: EXACT 16 · SAME 14 · **False SAME 2** · 87.5%
```

### 🔴 그런데 **SAME 에 1점 부족하다**(`SAME_MIN_AXES = 5` · 비스킷 4점)

```
🔴 브랜드까지 고쳐도(WU-164 CF-A **재측정**) blocker 가 **`NO_TITLE_OVERLAP` 하나** 남고
   점수는 **그대로** 다 ⟹ 남은 1점은 **TITLE 축** 이고 그것이 **한글 제목 문제**(WU-166/167)
⟹ 🔴🔴 **두 병목은 «더해져야» 한다** — WU-170 은 그중 **하나** 를 닫는다
```

### 🔴 그리고 기존 CF 측정 기록 **4건** 이 움직였다

```
🟢 WU-063 — 금지된 완화(CF-4)가 Human DIFFERENT **C23·C24** 를 **더는 올리지 않는다**
            ⟹ **방어가 강해졌다**(안전한 방향)
🟢 WU-064 — 결론 방향 동일(tier 변화 없음)
🔴 WU-065 / WU-068 — **C47(= biskuit · Human SAME)의 CF 승격이 사라졌다**
   🔴 baseline 은 **불변** 이고 C47 의 행도 **글자 그대로 같다**(토글로 대조 확인)
   🔴 **기전 미규명** ⟹ 그 상태로 앵커를 갱신하지 않았다
```

🟢 대조 방법 — `urlCodeHaystacks` 유무를 소스로 감지하는 토글로 **전/후를 같은 세션에서**
돌렸다(`WU170_OFF=1`). 🟢 그 토글은 **보고 후 제거** 했다(디버그 스위치 잔존 금지).

### 🟢 계약은 **되돌린 상태에서도 살아 있다**(쿠팡 고시 선례)

`wu-170-url-code-segments.test.ts` — `urlCodeHaystacks` 유무를 **스스로 감지** 한다:
```
🔴 Z-1  **현재 결함을 고정** 한다 — URL 에 `b226ac009` 가 분명히 있는데 **못 찾는다**
        🟢 수정이 들어가면 그 단언이 **FAIL 로 뒤집히고 그것이 수정의 증거** 다
🟢 Z-2  마지막 세그먼트는 **지금도** 찾는다(결함 범위를 좁혀 둔다)
🟢 Z-3  luxboy 방어는 **수정 전/후 둘 다** 지켜야 한다
🟢 Z-4  비교 규칙·문턱 상수가 그대로다(수정 범위 밖임을 잠근다)
🟢 A·D  **적용되면 자동으로 켜진다** — 특히 **D(세그먼트 경계)** 가 핵심 안전장치다
```

### 🔵 적용할 **정확한 변경**(다음 WU 가 그대로 쓴다 · 재설계 금지)

`packages/crawler/src/comparison-search/cross-seller.ts` — `slugCarriesCode`(:679)
```
slug 하나 대신 **건초더미 목록** 을 돌린다
  needle = normalizeFactText(code).replace(/[^a-z0-9]/g, "")   ← 비교 규칙 그대로
  for (const hay of urlCodeHaystacks(facts))
      if (hay.replace(/[^a-z0-9]/g,"").includes(needle)) return true

새 함수 `urlCodeHaystacks(facts)` —
  ① `facts.urlSlug ?? extractUrlSlug(facts.sourceUrl)` 를 **먼저** 넣는다(기존 동작 포함)
  ② `decodeURIComponent(new URL(sourceUrl).pathname).split("/")` 의 **각 세그먼트** 를
     `normalizeFactText` 로 넣는다
🔴 **`pathname` 을 통째로 이어붙이지 않는다**(음성대조 M2 가 3 FAIL 로 잠근다)
```
🟢 음성 대조 실측 — **M1**(세그먼트 스캔 제거) **2 FAIL** · **M2**(pathname 이어붙이기)
**3 FAIL**(거짓 일치 2 + 소스 앵커 1) → **바이트 복구**.

### 🔵 CPO 결정 사안 둘

```
① **PRESUMED_SAME 까지만 올리는 것을 받아들일 것인가** — 그러면 WU-170 을 적용하고
   움직인 CF 기록 4건의 앵커를 갱신한다(🔴 단 C47 기전 규명이 선행돼야 한다)
② **TITLE 축(한글 제목)을 함께 열 것인가** — 그래야 비스킷이 **SAME** 에 닿는다
   🔴 그 축은 WU-166/167 이 「기존 자산으로 성립하지 않는다」로 닫아 둔 자리다
```

🟢 운영 코드 **0**(되돌렸다) · 배포 **0** · 회귀 **631 files / 8,790 passed · 0 failed** · typecheck **0**.

---

## 6-Y. [종료] WU-169 — URL 품번 회수 가능성 GO

> 🟢🟢 **통제군 3/3 기대 일치 · DIFFERENT 오회수 0 · 잃은 것 0 · 숫자-only 가드 유지.**
> 🔴 단 분모 39 · 원상품 소수 ⟹ **HOLD 요소를 같이 적는다**(아래 ⑦).

### ① 기존 구조 — 병목은 **건초더미** 다(코드 실측)

```
`slugCarriesCode(facts, code)` (cross-seller.ts:679)
   slug = `facts.urlSlug ?? extractUrlSlug(sourceUrl)`   ← 🔴 **마지막 세그먼트 하나**
   → `slug.replace(/[^a-z0-9]/g,"").includes(code 정규화)` · `code.length < 4` 면 false
   🟢 **양방향** 으로 부른다(대칭)
`extractCodeLikeSlugSegment(slug)` → 🔴 그 slug 의 **`split("-")[0]`**(첫 조각)만 본다
   ⟹ 비스킷은 품번이 **마지막 하이픈 조각** 이라 이 함수로도 안 잡힌다
🟢 **비교 규칙(`compareModelCode`)은 이 병목과 무관하다** — 건초더미만 좁다
```

### ② 반사실 — **세그먼트별** 검사(분모 39 = wu-112/111/116/125 전수)

```
🟢 **새로 회수 1** (SAME 1 · DIFFERENT **0**)
   biskuit.kr — 마지막 세그먼트 `"1"` → 걸린 세그먼트 `보보쇼즈-허그-…-b226ac009`
🟢 기존 유지 2 (SAME 2) · 🔴 미회수 36 · 🟢 **잃은 것 0**
```

🔴🔴 **그리고 내 1차 반사실이 틀렸고, 그 틀림이 «설계 조건» 을 드러냈다**:
```
1차에 `carries(pathname 전체, code)` 로 썼다. 🔴 정규화가 `/` 까지 지우므로
**세그먼트가 이어붙는다** — `…-b226ac009` + `/8891/` → `b226ac0098891`.
🔴🔴 그것은 실제 위험이다 — `/b226/ac009/` 같은 URL 이 **경계를 넘어 거짓 일치** 를 만든다.
🟢 그래서 **세그먼트별** 로 고쳐 다시 쟀다.
⟹ 🔴 **나중에 구현할 때의 조건: pathname 을 통째로 이어붙이지 않는다.**
```

### ③ 통제군 — **3/3 기대와 일치**

| | human | CF-0 | CF-1 | 기대 | |
|---|---|---|---|---|---|
| biskuit | SAME | NO | **YES** | YES | 🟢 |
| trenbe ×2 | SAME | YES | **YES** | YES | 🟢 |
| luxboy | DIFFERENT | NO | **NO** | NO | 🟢 |

### ④⑤ 오회수 · SKU 오인

```
🟢 **DIFFERENT 가 새로 identifier 를 얻은 것 = 0**
🟢 **신규 회수 중** 품번이 더 긴 코드의 일부 = **0**
🟡 (참고) 기존에도 그랬던 것 2 — `trenbe …-b226ac009-**451**-…`(human SAME · CF-1 이 만든 위험 아님)
🟢 중간 세그먼트에 **다른 code-like 토큰** 이 있는 URL = **0**(이 분모에서 WU-071 kids21 모양 미발생)
🟢 숫자-only 가드 유지 — `"1"`·`"8891"`·`"70"`·`"display"` → **전부 null** · `"b226ac009"` → `B226AC009`
```

🔴🔴 **내 자동 판정도 1차에 과도했다** — 「더 긴 코드」를 **전체** 에서 세어 `trenbe`(CF-0 에서
**이미** 일치하던 human SAME)까지 위험으로 찍고 「GO 아님」을 냈다. 🟢 이 WU 가 묻는 것은
**「CF-1 이 «새로» 만드는 위험」** 이라 **신규 회수분에서만** 세도록 고쳤다.

### ⑥ 판정 — 🟡 **GO 조건 충족** (🔴 단 아래 한계 포함)

### ⑦ 다음 작업 좌표 — 🔵 **CPO 결정**

```
🔵 최소 수정 = `slugCarriesCode` 의 **건초더미 한 줄** 을
   「마지막 세그먼트」 → 「**경로 세그먼트 각각**」 으로(🔴 이어붙이지 않는다)
🟢 비교 규칙 · threshold · 8축 · 숫자-only 가드 **전부 불변**
🔴 **HOLD 요소(같이 본다)** — ⒜ 분모 **39** · 신규 회수 **1건** ⒝ 원상품 소수 ⒞ 이 측정은
   **「후보 URL 이 원상품 품번을 품는가」 한 방향** 이다(반대 방향은 후보 `brandModelCode`
   가 **전건 null** 이라 측정 불가 · WU-168) ⒟ 다른 카테고리/사이트에서 **중간 세그먼트에
   샵 SKU** 가 있는 경우는 **이 분모에 없었다**(0건) — **없다는 증명이 아니다**
🔴 CTO 는 구현하지 않았다(CPO §8: GO 일 때 **별도 변경 WU** 로 분리).
```

🟢 하니스 `wu-169-url-code-recovery.test.ts`(`WU_169_PROBE=1`).

---

## 6-Z. [종료] WU-168 — 병목은 URL 품번 추출 범위다

> 🟢🟢🟢 **이 트랙에서 가장 중요한 발견이다.** WU-164~167 이 다섯 번 두드린 벽이
> **`NO_TITLE_OVERLAP` 이 아니었다.** 🔴 비스킷의 **품번 축이 안 선다**.

### 🔴🔴 ② 반사실 — 제목을 무시해도 **비스킷은 열리지 않는다**

```
분모 12(SAME 10 · DIFFERENT 2) · 운영 산출 재조합만(새 축 0 · 동의어 0 · 음역 0)
CF-0 운영 SAME        **3** · leakage **0**
CF-1 제목 무시         **3** · leakage **0**   ← 🔴 **비스킷 안 열림**
CF-2 +속성충돌 없음    **3** · leakage **0**   ← 🔴 **비스킷 안 열림**
🔴 비스킷 축 합계 = **1점**(`CATEGORY:1`) — `SAME_MIN_AXES=5` 에 **한참 못 미친다**
   ⟹ 제목 blocker 를 지워도 **점수가 없어서** 안 열린다
```

### 🔴🔴🔴 ④-B 진단 — **품번이 URL «중간» 에 있어 못 읽는다**

```
판매처        brandModelCode  마지막 세그먼트                          URL중품번  제목중품번  human
biskuit.kr    null            **"1"**                                  🟢        🟢        SAME
trenbe        null            "...-b226ac009-451-160484657-p"          🟢        🟢        SAME
m.luxboy.com  null            "A14338197CB8698CD92C86431CCE8D05"       🔴        🟢        DIFFERENT

🔴 `extractUrlSlug` 는 **마지막 경로 세그먼트만** 본다(product-facts.ts:715)
   비스킷 URL = `/product/<한글슬러그>-**b226ac009**/8891/category/70/display/1/`
   ⟹ Cafe24 꼬리표 `…/display/1/` 때문에 slug 가 `"1"` 이고 **품번은 중간에 있다**
🟢 trenbe 는 마지막 세그먼트에 품번이 있어 `identifierConfirmed` 🟢 였다 — **같은 상품, 다른 URL 구조**
🟢 WU-094/095 가 기록한 그 꼬리표 구조이고 **숫자-only 가드는 올바르다**(`"1"` 은 식별자 아님)
🔴 그러나 **중간 세그먼트의 품번을 회수하는 경로가 없다**
```

### 🟢🟢🟢 그리고 **DIFFERENT 를 가르는 축이 바로 그것이다**

```
비스킷 — URL 중간에 품번 **있음** · 제목에 품번 있음 · human **SAME**
luxboy — URL 에 품번 **없음**     · 제목에만 품번 있음 · human **DIFFERENT**
⟹ 🔴 **제목만 보면 둘을 못 가른다**(둘 다 품번이 있다)
⟹ 🟢🟢 **「URL 에 품번이 있는가」가 둘을 가른다** —
   「URL 전 세그먼트에서 품번을 찾는다」는 비스킷을 **열고** luxboy 를 **열지 않는다**
```

### 🔵 CPO 판정 사안 — **축이 바뀌었다**(CTO 구현 0)

```
🔵 **「URL 품번 추출 범위를 마지막 세그먼트 → 전 세그먼트로 넓힐 것인가」**
🟢 그것은 **비교 규칙(`compareModelCode`) 변경이 아니다** — **추출 범위** 다.
   🟢 WU-095 의 숫자-only 가드는 **그대로 산다**(`extractCodeLikeSlugSegment` 가
      글자+숫자를 **둘 다** 요구하므로 `"1"`·`"8891"`·`"70"` 은 여전히 거부된다)
🔴 **미측정 위험** — 다른 사이트의 **중간 세그먼트에 샵 SKU/분류코드** 가 있으면
   거짓 품번이 될 수 있다(WU-071 의 kids21 `700005621lbl` 계열). 🔴 **전수 미측정** 이다
🔴 그리고 CPO 금지 목록의 「`MODEL_CODE` 변경 ❌」에 **닿을 수 있다** ⟹ CTO 가 열지 않았다
```

🔴 분모 **12** · 원상품 **1개** · DIFFERENT **2** — 「leakage 0」을 강한 precision 증명으로
쓰지 않는다. 🟢 동의어 사전 **0** · 음역 **0** · 새 축 **0** · 운영 코드 **0** · 배포 **0**.
🟢 하니스 `wu-168-identity-evidence-cf.test.ts`(`WU_168_PROBE=1`).

---

## 6-AA. [종료] WU-167 — 한글 토큰화 자산 검토

> 🟢🟢 **그리고 「띄어쓰기로 축이 죽는다」의 «정확한 기전» 이 밝혀졌다** — 이것이
> 이 WU 의 핵심이다. 🔴 원인은 음역이 아니라 **토큰화 + `includes` 조합** 이다.

### 🟢🟢 ① 이미 있는 한글 자산은 **생각보다 많다**(코드 실측)

```
`CATEGORY_TAXON_WORDS`(match.ts) 한글 **12** — 티셔츠·셔츠·후드·바지·팬츠·청바지·
   원피스·스커트·자켓·패딩·**양말**·슈즈
   🟢🟢 **매칭이 `normalized.includes(w)` 다**(토큰 완전일치가 **아니다**) ⟹ **붙임 제목에도 걸린다**
`AUDIENCE` 한글 **6** — 아동·키즈·주니어·베이비·여성·남성
`GARMENT_FORM_WORDS` 한글 **16** — 🔴 단 `words.has(token)`(완전일치)라 **붙임에 안 걸린다**
`brand-alias` 한글 **7** — 보보쇼즈·페페·에밀에이다·콩제슬래드…
🔴 **붙임 제목을 제거·분할하는 운영 코드 = 전수 grep 0** ·
   **한글 형태소 라이브러리 의존성 = 0**(package.json 전수)
⟹ 🟢 `includes` 는 **판별 자산** 이고 🔴 **분해 자산이 아니다**
```

### 🔴🔴 ② 「축이 죽는다」의 기전 — **`includes` 가 고유명까지 통째로 지운다**

```
한글 제목 **12** 중 `distinctive` 가 **빈 것 3**
   DIFFERENT  보보쇼즈 허그헤어리몬스터숏양말
   **SAME**   보보쇼즈 허그몬스터티셔츠      ← 🔴 human SAME 인데 TITLE 축에 **참여 못 한다**
   DIFFERENT  보보쇼즈 허그몬스터스웨트셔츠

기전 — 붙임 토큰 **1개** → `extractCategoryTaxon` 이 `includes("티셔츠")` 로 taxon 판정
     → `distinctive` 필터(cross-seller.ts:919)가 **그 토큰을 제거**
     → TITLE 축 입력이 **비어 버린다**
⟹ 🔴 「허그몬스터티셔츠」는 **음역이 아니라 토큰화 단계에서** 죽는다
🟢🟢 그리고 이것이 **WU-166 과 완전히 정합한다** — 비스킷만 띄어쓰기가 있어
   `["허그","헤어리","몬스터",…]` 로 살아남았고 **유일하게 발화했다**
```

### 🔴 ③④ 어휘 앵커는 걸리지만 **나머지가 쪼개지지 않는다**

```
🟢 붙임 토큰 **7/10** 에서 기존 어휘가 걸린다(판별은 된다)
   허그헤어리몬스터티셔츠 → ["티셔츠","셔츠"] → 나머지 ["허그헤어리몬스터"]
   허그헤어리몬스터숏양말 → ["양말"]        → 나머지 ["허그헤어리몬스터숏"]
   허그몬스터스웨트셔츠   → ["셔츠"]         → 나머지 ["허그몬스터스웨트"]
   bc앰버데님팬츠        → ["팬츠"]         → 나머지 ["bc앰버데님"]
🔴 그런데 나머지가 **전부 1조각** 이다 — 영문은 **3토큰**(hug/hairy/monster)
   ⟹ **1:3 비대칭 7/7** · 대응 가능 **0/7**
🔴 어휘가 **아예 안 걸리는 것 3** — 도기앞치마세트 · 플라워앞치마세트 · 모노하트이유식턱받이
```

### 🔴🔴 ⑥ 판정 — **기존 자산만으로는 음역 CF 재측정이 성립하지 않는다**

```
분해 자산 **없다**(①⑤) · 어휘 앵커로 대응 가능한 붙임 토큰 **0/7**(④)
🔴 그리고 `distinctive` 가 비는 **3건** 은 TITLE 축에 **애초에 참여하지 않는다** —
   음역 규칙을 어떻게 만들어도 **그 분모는 늘어나지 않는다**
```

🟡 **관측 하나만 더 적는다(구현/제안 0)** — `MH_mom&baby밴드` 가 `["mh","mom","baby밴드"]`
로 쪼개졌다 ⟹ 🔴 토크나이저는 **문자체계 경계에서 쪼개지 않는다**(라틴+한글이 한 토큰).
🔴 그것을 쪼개는 것도 **새 규칙** 이다.

### 🔵 그래서 CPO 가 결정할 것이 **다시 하나로 좁혀졌다**

> **「붙임 한글 제목을 분해할 것인가」** — 그리고 분해한다면 **어떤 자산으로**
> (형태소 분석기 도입 ↔ 디자인명 사전 ↔ taxon 앵커 + **고유명 내부 분해 규칙**)

🔴 **CTO 는 어느 것도 설계·제안하지 않았다.** 🔴 `B226AC009` 전용 예외 **0** ·
`NO_TITLE_OVERLAP` 삭제 **0** · threshold **0** · 운영 코드 **0** · 배포 **0**.
🟢 하니스 `wu-167-korean-tokenization.test.ts`(`WU_167_PROBE=1`).

🔴🔴 **그리고 내 하니스가 또 결론을 미리 박았고 고쳤다**(이 트랙 **네 번째**) — §4·§6 을
데이터 없이 단정하는 `console.log` 로 써 뒀다가 **측정값에 걸도록** 바꿨고, §5 의
「grep 0」은 **주장 전에 직접 실행해** 확인했다.

---

## 6-AB. [종료] WU-166 — 음역 CF 세 개 전부 미발화

> 🔴🔴🔴 **「leakage 0」을 안전 증거로 쓰지 않는다.** 분모가 **참여하지 못했다.**

### 🟢 §2 먼저 — 음역 자산은 **이미 있었다**(새로 만들지 않았다)

```
🟢 `wu-078-language-evidence.test.ts` 에 **자음 뼈대** 비교가 있다 —
   `romanize` · `generalize`(sh/sy→s · ch→c · c→k · 중복자음 축약) · `skeleton` · `engSkeleton`
   🔴 테스트라 export 가 없어 **그대로 옮겼다(사본)** · **한 글자도 바꾸지 않았다**
🟢🟢 그리고 **GT 에 CPO §4 분모가 있었다** — `wu-093-human-gt.json` S1 **5건**
   「허그헤어리몬스터**숏양말**」 DIFFERENT(양말) ×2 · 「허그몬스터**스웨트셔츠**」 DIFFERENT(색상)
   ⟹ 「동일 브랜드 + 다른 디자인」 · 「한/영 제목이 우연히 유사한 DIFFERENT」가 **실재한다**
```

### 🔴🔴 CF-0/1/2/3 결과 — 숫자는 좋아 보이지만 **읽으면 안 된다**

```
분모 7 = URL 2(비스킷 · luxboy) + GT 제목 5 · 원상품 **1개**
CF-0 기존 TITLE          겹침 0 = **7/7**
CF-1 음역 단독           열림 **1** (SAME 1 · DIFFERENT 0)
CF-2 음역 + **품번 동반**  열림 **1** (SAME 1 · DIFFERENT 0)
🔵 CF-3 뼈대 **접두 일치** + 품번(참고 전용 · 새 규칙)  열림 **1** · leakage 0
```

🔴🔴 **그런데 발화가 1/7 이다. 「leakage 0」은 방어가 아니라 미발화다**:
```
🔴 기존 음역 함수가 그 토큰들을 **못 잇는다**(진단 출력으로 확정)
   허그   → `hg`    🟢 일치 (hug → hg)
   헤어리 → `hr`    🔴 **불일치** (hairy → `hry`)   ← 어말 y
   몬스터 → `mnst`  🔴 **불일치** (monster → `mnstr`) ← 어말 r
🔴 나머지 6건이 **CF 에 참여조차 못 한 이유 둘**
   ⒜ `m.luxboy.com` — 디자인명 토큰이 **없다**(키즈·명품쇼핑·럭스보이·since·2002)
   ⒝ `wu-093` 5건 — 제목이 **공백 없는 한 덩어리** 라 토큰이 **1개**
      (`허그헤어리몬스터숏양말` → `hghrmnsttsk`) ⟹ 어떤 영문 토큰과도 안 맞는다
      🔴 메모 「한국어 제목은 **띄어쓰기** 로 축이 죽는다」(WU-092)가 **음역 축에서도** 재현됐다
⟹ 🔴🔴 **CF-1/2/3 은 「NO-GO」가 아니라 «판정 불가» 다**(측정이 성립하지 않았다)
```

🟢 유일하게 발화한 비스킷도 근거가 **뼈대 1개**(`hg` / CF-3 는 `mnst`)다 — 🔴 2~4자
뼈대 단독이라 **우연 가능성을 배제할 수 없다.** 🔴 「회수 1건 확보」로 적지 않는다.

### 🔵 그래서 CPO 가 결정할 것이 **둘로 갈렸다**

```
① **음역 규칙의 형태** — 어말 r/y 를 잇는가(= WU-078 이 「과적합」으로 금지한 조정) ·
   또는 **뼈대 접두 일치**(CF-3 · 새 규칙 · fuzzy 에 인접) · 둘 다 **CPO 금지 범위에 닿는다**
② 🔴🔴 **그 «앞» 에 띄어쓰기 없는 한글 제목의 토큰화** 가 있다 — 이것을 풀지 않으면
   국내 GT 5건이 **어떤 음역 규칙에서도 참여하지 못한다** ⟹ class C 를 평가할 수 없다
   🔴 그 정규화도 **새 매칭 규칙** 이고 메모가 금지로 적어 뒀다
```

🔴 **CTO 는 ①②중 어느 것도 설계·제안하지 않았다.** `B226AC009` 전용 임시 예외 **0** ·
`NO_TITLE_OVERLAP` 삭제 **0** · threshold **0** · `MODEL_CODE` 단독 승격 **0** ·
「품번 일치 = SAME」 **0** · 번역 API/LLM **0** · 운영 코드 **0**.
🟢 하니스 `wu-166-translit-identity-cf.test.ts`(`WU_166_PROBE=1`).

---

## 6-AC. [종료] WU-165 동의어 전수조사

> 🔴🔴 **CPO 가 WU-164 의 동결을 정정했다**(2026-10-22) — 「**WU-078 의 «음역 축 종료»
> 를 «동의어 검토 전체 종료» 로 잘못 해석했다. 그건 다른 얘기다**」.
> ⟹ 🟢 WU-165 에서 **제품 전체 동의어/명칭 변형을 전수 조사했다**(코드 0).

### 🟢🟢 WU-165 ① 이미 있는 동의어 자산 — **생각보다 많다**(코드 실측)

```
🟢 **품목명 한/영 동의어는 이미 있다** — `product-facts.ts:450~463`
   SHIRT  shirt·blouse·polo·tee·**셔츠**·**티셔츠**   SWEATSHIRT  …·**맨투맨**·**스웨트셔츠**
   HOODIE  …·**후디**·**후드집업**                     PANTS  …·**바지**·**팬츠**·**레깅스**
   ⟹ **CATEGORY 축에서 작동한다**(TOP 으로 뭉친다 · CPO 2026-09-10 지시)
🟢 **브랜드 한/영 alias 7건** — `brand-alias.ts`(보보쇼즈·페페·에밀에이다·콩제슬래드…)
🟢 **표기 변형은 이미 정규화된다** — `tokenizeFactText` 가 영숫자/한글 **이외 전부** 를
   구분자로 쪼갠다(하이픈·공백·대괄호·특수문자) · NFC 통일 · 1글자 버림
🟢 **시즌 표기도 걷어낸다** — `SEASON_CODE_RE = /^(ss|aw|fw|pe)\d{2}$/i`
🔴 **색상명 한/영 확대는 WU-044 가 금지**(COLOR_VARIANT 보류 계약)
🔴 **고유 상품명(디자인명) 한/영 — 전용 자산 0.** 그것이 유일한 공백이다
```

### 🔴🔴 WU-165 ② 실측 — 겹침 0 은 **13행 중 3행**(고유 2건)

```
원상품 distinctive = **["hug","hairy","monster"]**  (품목명 `shirt` 는 빠진다)
라틴 문자 후보 10건 — 전부 겹침 **2~3** (jaccard 0.286~1.000) 🟢 TITLE 축이 정상 작동
겹침 **0** 인 것 = **혼재(한글) 3행** 뿐
   SAME       biskuit.kr   ["보보쇼즈","허그","헤어리","몬스터","b226ac009"]   ← GT 행
   SAME       biskuit.kr   (같은 상품 · WU-163 이 회수한 URL)
   DIFFERENT  m.luxboy.com ["보보쇼즈","키즈","b226ac009","since","2002","no","명품쇼핑","럭스보이"]
```

🔴🔴 **그래서 WU-163/164 의 한 단어를 정정한다** — 그 비스킷 URL 은 **WU-112 GT 에 이미
있었다**(같은 id `8891` · `category/` 조각만 다르다). ⟹ 🔴 **「신규 판매처」가 아니다.**
🟢 WU-163 이 새로 증명한 것은 **「자동 경로가 그것을 «재발견» 할 수 있다」** 다(검색 →
브랜드 목록 → 페이지네이션 → 상세 URL). 🔴 그리고 WU-164 의 분모 「13」은 **고유 12** 다
(비스킷이 두 번 세어졌다 · 🟢 CF-A 결론 「회수 0 · leakage 0」은 **영향 없음**).

### 🔴🔴 WU-165 ③ 동의어 class 네 개 — **효과와 위험을 같이 쟀다**

| class | 자산 | 효과 | 위험 |
|---|---|---|---|
| **A** 품목명을 TITLE 축에 되돌리기 | 🟢 있다 | 🔴 **0** | — |
| **B** 브랜드 한/영 alias | 🟢 있다(7) | 🔴 **0** | — |
| **C** 고유 상품명 한/영(음역) | 🔴 **없다** | 🟡 **유일하게 있다** | 🟡 아래 |
| **D** 샵 prefix/suffix · 시즌 노이즈 제거 | 🟢 일부 | 🔴 **0** | — |

🟢🟢 **A 가 0 인 이유가 측정으로 밝혀졌다 — 이것이 이 WU 의 핵심 발견이다**:
```
품목명 동의어는 **taxon 으로 통합** 된다(`extractCategoryTaxon` → `SHIRT`).
토큰은 여전히 `shirt` ↔ `티셔츠` 로 **서로 다른 글자** 다 ⟹ TITLE 축에 되돌려도
**겹치지 않는다**(실측 `interAll` = 0/3). 🔴 「품목명 동의어가 있으니 제목도 될 것」은 **거짓** 이다
```
🔴 B 가 0 인 이유 — 브랜드는 core token 에서 **노이즈로 제거** 된다(설계). alias 로
비스킷의 `보보쇼즈` 를 지워도 **겹침은 0 이고 분모만 줄어든다**.
🔴 D — 실제로 남은 노이즈는 `키즈` **1건** 뿐이었다. 🔴 내가 예측한 `26fw` 는 그 후보
제목에 **없었다** ⟹ **이 표본에서 미발화**(가설을 통과시키지 않는다).

### 🟡 WU-165 ④ class C 의 위험 — **분모가 작지만 방향은 좋다**

```
🟢 비스킷에는 음역 대응이 **있다** — 허그/헤어리/몬스터 ↔ hug/hairy/monster
🟢🟢 `m.luxboy.com`(human **DIFFERENT**)에는 그 **대응 토큰이 없다**
   (`키즈`·`명품쇼핑`·`럭스보이`·`since`·`2002`) ⟹ 🟢 **음역 규칙으로도 열리지 않는다**
🔴 그리고 luxboy 는 **품번 `b226ac009` 를 품고 있는데 human DIFFERENT** 다 —
   헌장 WU-112 가 기록한 「품번 같아도 색이 다르면 DIFFERENT」 그 케이스다
🔴 **분모 3행(고유 2건)** 이다 — 「안전하다」로 일반화하지 않는다
```

### 🔵 그래서 CPO 가 결정할 것 — **class C 하나**

> **「고유 상품명의 한/영 음역을 identity 증거로 인정할 것인가」**
> (그리고 인정한다면 **어떤 형태로** — 사전 ↔ 음역 규칙 ↔ 품번 동반 조건)

🔴 **CTO 는 설계하지 않았다** — 새 규칙이고 WU-078 이 「위험 축」으로 적어 둔 자리다.
🔴 `B226AC009` 전용 **임시 예외 0** · threshold **0** · `MODEL_CODE` **0**.
🟢 하니스 `wu-165-synonym-survey.test.ts`(`WU_165_PROBE=1`).

---

## 6-AD. [참고] WU-164 시점의 동결 판단 — 🔴 **CPO 가 위와 같이 정정했다**

> 🔴🔴🔴 **「공급이 안 된다」가 아니다.** 🟢 **공급은 해결됐고**, 남은 한 칸은
> **제품 정책** 이다. 🔴 그 정책이 **class C**(위)이고 **조사까지 끝났다**.

### 🟢 현재 제품 엔진의 실제 상태 (WU-155~164 로 전 구간 실증됐다)

```
원상품 → AI/Search 공급 → 국내 전문몰 목록 → **실제 페이지네이션** →
실제 상품 상세 URL → Fetch 🟢 → 상품정보/가격 추출 🟢 → **KRW 88,000** · market **KR** 🟢
→ MI → **PRESUMED_SAME** → 🔴 **`NO_TITLE_OVERLAP`** ⟹ 시장가격 판단에 **들어가지 않는다**
```

🟢 **그 마지막 상태가 「정합적인 결과」다**(CPO 문장) — 비스킷 88,000원은 **내부적으로
발견·가격수집까지 성공** 했지만 **셀러 판단에는 넣지 않는다**. 🔴 **결함이 아니다.**

### 🔴🔴 동결 목록 — **다시 두드리지 않는다**(CPO 확정)

```
❌ `BRAND_MISMATCH` 완화        — CF-A 측정됨: leakage 0 **이지만 회수 0**(WU-164)
❌ `NO_TITLE_OVERLAP` 완화      — 쓸 수 있는 기존 증거 **없음** · 새 규칙은 금지
❌ `MODEL_CODE`                 — 계속 금지
❌ threshold 완화               — 금지
❌ 음역 / 느슨한 title matching  — 금지(WU-078 에서 이미 종료)
❌ 공급 · 페이지네이션 추가 작업   — 🟢 **현재 불필요**(WU-162/163 이 열었다)
❌ Adapter / Registry           — 불필요
❌ Gemini / 크레딧 / API         — 불필요(WU-157 에서 축 폐기)
❌ 대형몰 추출기                 — 불필요(WU-160: 쿠팡 403 · LF몰 SPA shell)
❌ CEO 테스트                    — 없음
```

🔴🔴 **그러므로 WU-155~164 를 다시 측정하지 않는다.** 아래 각 WU 절은 **종료된 결론** 이다.
🔴 그리고 **「한 상품을 살리려고 전체 SAME precision 계약을 다시 여는 것」** 이 그 완화의
실체다(CPO 문장) — 그것이 동결의 이유다.

### 🔵 남은 결정은 **제품 정책 하나** 이고 CTO 가 열지 않는다

> **「언어가 다른 동일상품을 MI 가 SAME 으로 인정할 것인가」**

🔴 그 결정이 열릴 때만 `NO_TITLE_OVERLAP` 축을 다시 본다. 🔴 **CPO 가 지정한다.**

---

## 6-AE. [종료된 결론] WU-155~164 — 🔴 재측정 금지

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

### 🔴🔴🔴 WU-164 — **두 축 다 NO-GO · 그리고 헌장의 한 줄이 반증됐다**(코드 0)

> 🔴 CPO 규칙대로 **한 축씩** 쟀고 **동시에 완화하지 않았다**. 🟢 반사실은 **운영 함수에
> 입력만 바꿔** 넣었다(코드 0 · WU-134 STEP-2 방식).

#### 🔴🔴 CF-A (`BRAND_MISMATCH` 단독) — **leakage 0 인데 회수도 0**

```
🔴🔴 **먼저 헌장을 정정한다** — WU-138 은 「제거 수단도 있다(`extractSiteBrandName`)」로
   적었다. **호출해 보니 `null` 이다.** 그 함수는 `og:site_name == JSON-LD Organization.name`
   을 요구하고 **사이트 이름** 을 낸다 ⟹ 비스킷에서는 그것이 **틀린 브랜드** 다.
🟢 실제로 쓸 수 있는 증거는 **WU-151 이 이미 배포한** `lookupBrandByAliasInTitle` 이다 —
   og:title `[보보쇼즈] 허그 헤어리 몬스터 티셔츠 B226AC009 - 비스킷` → **"Bobo Choses"**

CF-A = 후보 facts 의 **브랜드 칸 하나만** 그 값으로 바꾼다(제목·품번·색상·소재 **전부 그대로**)
분모 13 = WU-112 GT 의 B226AC009 **12**(SAME 10 · DIFFERENT 2) + 비스킷 신규 **1**

                    human      baseline   CF-A
biskuit.kr(신규)     SAME       SIMILAR  → **SIMILAR**   🔴 변화 없음
m.luxboy.com        DIFFERENT  SIMILAR  → SIMILAR      🟢 열리지 않았다
(나머지 11건 전부 불변)
baseline SAME∩humanSAME 3 · humanDIFFERENT **0**
CF-A     SAME∩humanSAME 3 · humanDIFFERENT **0**   ⟹ 🟢 **leakage 증가 0**
🔴 그러나 **회수 0** — 비스킷 blockers 가 `[BRAND_MISMATCH, NO_TITLE_OVERLAP]` →
   **`[NO_TITLE_OVERLAP]`** 으로 줄었을 뿐 verdict 가 안 바뀐다
⟹ 🔴 **CF-A 단독 NO-GO**(이 축만으로는 열리지 않는다)
```

🔴 **분모 한계를 같이 적는다** — DIFFERENT 가 **2** 다. 「leakage 0」을 강한 방어 증거로
쓰지 않는다. 🔴 B226AC010 쪽 DIFFERENT 4 는 **원상품 URL 을 지어내지 않으려** 제외했다.
🔴 그리고 이 표의 `baseline` 은 `compareCrossSellerProducts.verdict`(상류)이고
WU-163 이 적은 `PRESUMED_SAME` 은 `domesticMatchDisplay(matchTruth).tier`(하류)다 —
**다른 층이라 같은 칸으로 비교하지 않는다.**

#### 🔴 CF-B (`NO_TITLE_OVERLAP` 단독) — **돌리지 않았다**(조사로 닫았다)

CPO §2 가 물은 「기존 금지축을 건드리지 않고 쓸 수 있는 **이미 존재하는 alias/normalized
title 증거**」 ⟹ 🔴 **없다**:
```
· 발화 조건 = `jaccard(distinctive(coreTitleTokens)) === 0`(cross-seller.ts:922·929)
· `coreTitleTokens` 는 **brand-alias 를 쓰지 않는다**(전수 grep **0**)
· `brand-alias` 소비처는 **`product-url-facts.ts:248` 하나** 이고 **브랜드 축 전용** 이다
· 음역 축은 **WU-078 에서 CPO 가 종료** 했다(회수 0 · DIFFERENT 를 열 위험)
⟹ 🔴 새 유사도/느슨한 토큰 매칭 없이는 성립하지 않는다 = **CPO 금지** ⟹ **측정하지 않았다**
```

🔴🔴 **그래서 남은 것은 코드가 아니다** — 공급은 WU-163 에서 열렸고(KRW 88,000 · KR),
마지막 한 칸은 **`NO_TITLE_OVERLAP`(한글 제목 ↔ 영문 원상품)** 하나이며 그 축을 여는
수단이 **금지 범위 안에 없다.** 🔴 **CPO 결정 사안** 이고 CTO 가 열지 않았다.

🟢 하니스 `wu-164-blocker-counterfactual.test.ts`(`WU_164_PROBE=1`).

---

### 🟢🟢🟢 WU-163 — **공급이 열렸다. 목표 상품을 찾아 가격까지 수집했다**(코드 0)

> 🟢🟢🟢 **이 트랙에서 처음으로 「국내 동일상품 후보를 시스템이 스스로 찾아」 가격까지
> 수집했다.** 🔴 그리고 **남은 것은 공급이 아니라 MI 축 하나** 로 좁혀졌다.

```
🟢 ① 1페이지에 **실제 페이지네이션 링크 6건** 이 있다(URL 추측 0 · HTML 의 링크만)
🟢 ② 열어 본 목록 **12페이지**(상한 12) — `?page=1…7` · `?page=36…39`
🟢 ③ 회수한 상세 URL(고유) **218**
🟢🟢 ④ **`page=7` 에서 목표 상품을 찾았다**
     biskuit.kr/product/보보쇼즈-허그-헤어리-몬스터-티셔츠-**b226ac009**/8891/category/70/display/1/
🟢🟢 ⑤ 기존 파이프라인 그대로 — fetch 🟢 · 추출 🟢 · **KRW 88,000** · market **KR**
🔴 ⑥ tier = **PRESUMED_SAME**(SAME 아님) · blockers = **`BRAND_MISMATCH` · `NO_TITLE_OVERLAP`**
```

🔴🔴 **그 두 blocker 는 헌장 WU-138 이 적어 둔 «그것» 이다** — biskuit 가 brand 자리에
**자기 이름(「비스킷」)** 을 적고, 제목이 **한글** 이라 원상품(영문)과 토큰 겹침이 0 이다.
🔴 **둘 다 CPO 가 닫은 금지축** 이라 **건드리지 않았다**(완화 0 · MI 0).

🔴 **「1-hop 만으로 됐다」로 적지 않는다** — **1페이지에는 없었다.** 필요한 것은
**2-hop(실제 페이지네이션)** 이었고, 그것이 **작동했다**. 🔴 그리고 목록은 **39페이지+** 다
(`page=36~39` 링크 관측) — **상한 12 안에서 찾은 것은 BFS 순서 덕** 이고, 「앞 N페이지만
보면 된다」로 일반화하지 않는다.

🟡 **CPO 판정 재료 하나(CTO 가 구현하지 않았다)** — WU-138 은 「`BRAND_MISMATCH` 제거
수단이 있다(`extractSiteBrandName`) · **효과는 국내 0 → 0**」으로 닫았다. 🔴 그 「효과 0」은
**당시 국내 후보·가격이 0 이었기 때문** 이고 **지금은 가격이 있다**(KRW 88,000 · KR) ⟹
**효과 계산의 분모가 바뀌었다.** 🔴 단 **그것만으로는 열리지 않는다** — blocker 가 **둘** 이고
`NO_TITLE_OVERLAP` 이 남는다. 🔴 두 축 다 금지라 **CPO 결정 사안** 이다.

🔴 **WU-151 의 brand alias 층이 발화하지 않은 이유도 확정됐다** — `lookupBrandByAliasInTitle`
은 `brandFromHtml` 의 **4번째 슬롯** 이고 앞 슬롯이 성공하면 가지 않는다. biskuit 은
brand 자리에 「비스킷」을 **명시** 하므로 1번째 슬롯이 이긴다. 🔴 고치지 않았다(추출기 변경).

🟢 하니스 `wu-163-biskuit-pagination.test.ts`(`WU_163_PROBE=1`) · robots 가드 내장
(`/skin-` · `/exec/front/` · `page_4=` · `page_6=` · board 계열 전부 **따라가지 않는다**).

---

### 🟢🟢🟢 WU-162 결론 — **비스킷 1-hop 이 작동한다 · 판정 ③ 혼재**(코드 0)

> 🟢🟢 **이 트랙에서 처음으로 「국내 공급이 실제로 열리는」 증거가 나왔다.**
> CPO 1차 KPI = 「브랜드 전용 목록에서 **실제 상품 상세 URL 을 안정적으로 회수**
> 할 수 있느냐」 ⟹ **비스킷에서 YES**.

```
비스킷  목록 HTTP **200** · 180KB · 링크 164 · 같은 호스트 159 · 🔴 robots 제외 25
        🟢 **상세 URL 20건**(샵의 관측된 모양 기준)
        🟢 상세 fetch **8/8 status OK** · 🟢 **가격까지 추출 7/8**
        실측 추출값 — B226AC117 **₩258,000** · B226AC116 **₩218,000** ·
                     B226AC115 **₩172,000** · B226AI07x ₩48,000 · 라운지웨어 3건 ·
                     B226AC112 (가격 없음 1건)
        🟢🟢 **26FW(B226AC…) 상품이 브랜드·품번·가격까지 읽힌다**
도노키즈 목록 200 · 287KB인데 🔴 **상세 링크 0건**(`product.html?branduid=` 가 없다)
        ⟹ 목록이 상품 링크를 **HTML 로 주지 않는다**(JS 로 그리는 것으로 보인다 · 미확정)
보몽드  🔴 **robots Disallow(ClaudeBot/GPTBot 명시)** ⟹ 분모 제외 · **우회하지 않았다**
⟹ 🟡 **판정 ③ 혼재** — 한 샵 🟢 · 한 샵 🔴 · 한 샵 금지
```

🔴 **목표 품번 B226AC009 는 그 목록 1페이지에 없다**(HTML·URL 둘 다 0).
🟢 CPO 가 「목록에 없어도 실패가 아니다」로 미리 가른 자리다. 🔴 헌장 WU-138 은
biskuit 에 그 상품이 **KRW 88,000** 으로 있었다고 적는다 ⟹ **다른 페이지 ↔ 품절/삭제**
를 **가르지 못했다**(페이지네이션은 **2-hop** 이라 범위 밖) ⟹ **측정불가** 로 남긴다.

🔴🔴 **내 하니스가 1차에 거짓 숫자를 냈고 잡았다 — 이것이 이 WU 의 가장 중요한 교훈**:
```
`classifyUrlShape(u) === "PRODUCT_PAGE"` 만으로 세어 **「상세 URL 70건」** 을 냈고,
문서 순서 앞 8개를 열어 **「가격 0/8」** 을 찍었다.
🔴 그 8건의 제목이 **「회원 로그인」·「브랜드」·「기획전」·「비스킷 | Biskuit」** 였다 —
   **상품 페이지가 아니다.** 그대로 보고했으면 **「1-hop 불가」라는 거짓 결론** 이었다.
🟢 원인 둘 — ⒜ 그 분류기는 한국 CMS 링크를 **오통과** 한다(WU-073 이 기록) ⒝ 내가
   **헤더/내비 링크** 를 샘플로 열었다.
🟢 **검색이 실제로 돌려준 URL 모양** 으로 좁혀 다시 쟀다(지어낸 규칙 0 · 운영 분류기 변경 0)
   ⟹ 비스킷 70 → **20** · 가격 **0/8 → 7/8**. 🔴 두 숫자를 **같이** 출력하게 했다.
```

🔴 그리고 블록 주석에 `/skin-` + 와일드카드를 글자로 적어 **`*/` 가 주석을 조기 종료** 시켜
파일이 파싱조차 되지 않았다(🟢 빌드가 즉시 잡았다).

🟢 하니스 `wu-162-brand-listing-hop.test.ts`(`WU_162_PROBE=1`) · 상세 fetch 상한 **8**(예의상).

---

### 🔴🔴🔴 WU-161 결론 — **회수 방법 6종 전부 실패 · NO-GO**(코드 0)

> CPO GO 기준 = 「B226AC009 의 **신규** 국내 SAME + 가격 **≥1건**」(보몽드 CONTROL 제외) ⟹ **0건**.

```
① `site:beaumonde.co.kr` × 5 모양(한국어명·품번·시즌·영문명·**가격 토큰**)  목표 **0**
② `site:donokids.com` + 한국어 상품명        🟢 다른 상품 상세 3 · 🔴 목표 **0**
③ `site:donokids.com 226AC009`(샵 표기 = **B 없음**)  🔴 **질의 붕괴**(숫자열로 취급)
④ `site:donokids.com` + 샵의 **영문 제목 패턴**  🟢 다른 상품 상세 2 · 🔴 목표 **0**
⑤ `site:coupang.com` + 한국어명              🟡 상세 1 · 🔴 **측정불가**(403 / shell)
⑥ `site:biskuit.kr` + 한국어 상품명          🟢 다른 상품 상세 **6** · 🔴 목표 **0**
```

🔴🔴 **여섯 번 전부 같은 모양이다** — 엔진은 상품을 **읽는다**(도노키즈 「88,000원 ·
4/5y·6/7y·10/11y」 · 비스킷 「`B226AC014` 88,000원」) 그런데 **그 URL 만** 돌려주지 않는다.
🟡 ③이 유용한 음성 정보다 — **샵이 쓰는 표기(`226AC009`)로 좁히면 질의가 붕괴한다.**

🔴 **그리고 신규 전문몰 «추출» 도 확인되지 않았다**(「읽힌다」로 적지 않는다):
```
비스킷 3건 → **UNREACHABLE 2** · 읽힌 1건도 **가격 없음** ⟹ 가격 **0/3** · DROPPED
🔴 헌장 WU-138 은 biskuit 에 **KRW 88,000 가격 O** 로 적어 두었다 — **그 기록과 다르다.**
   🔴 원인 미규명(URL 별 차이 ↔ 실행 간 불안정) · **단정하지 않는다** · **측정불가** 로 남긴다
```

🟢🟢 **유일하게 «안정적으로» 회수되는 것 — 브랜드 목록 URL**(🔴 구현하지 않았다):
```
도노키즈  `shop/shopbrand.html?xcode=058&type=X`
비스킷    `category/bobo-choses/70/` · `brand/bobochoses.html`
보몽드    `goods/goods_list.php?brandCd=070031`
⟹ 🔴 그 목록에서 **1-hop** 하면 상세 URL 이 나온다. **WU-120/121 이 HOLD 한 축** 이다.
🟢 단 **분모가 그때보다 훨씬 좁다** — WU-120 은 **홈**(상품링크 498개)에서 쟀고
   지금 회수되는 것은 **그 브랜드만** 담긴 목록이다. 🔴 효과는 **미측정** 이다.
```

🔴🔴 **내 하니스가 낙관적 문장을 무조건 찍었고 고쳤다**(이 트랙 **세 번째**) —
「신규 전문몰이 읽힌다」를 데이터와 무관하게 출력했다. 🟢 `extractedWithPrice > 0` 에 걸었다.

🟢 하니스 `wu-161-specialty-recovery.test.ts`(`WU_161_PROBE=1`).

---

### 🔴🔴🔴 WU-160 결론 — **국내 «대형» 채널은 현 Fetch 로 읽을 수 없다**(코드 0)

> 🟢 CPO 지시대로 **검색을 더 만지지 않고 추출 가능성만** 쟀다. 🟢 그래서 목표 상품이
> 필요 없었다 — 그 채널의 **실제 상세 URL 아무것이든** 되기 때문이다(병목 분리).

```
채널            URL  추출OK  판정
쿠팡              1     0    🔴 **차단** — 날것 fetch **403 · 1KB** · 운영 `UNREACHABLE`
LF몰              3     0    🔴 **② 확정** — 200 이지만 **9KB shell**
                             (ld+json 0 · og:title 0 · 브랜드 토큰 0 · 「원」 0) = SPA
롯데홈쇼핑           1     0    🔴 **분모 오염** — 그 URL 은 애초에 **기획전 페이지** 다
                             (title 「이거 괜찮지? [롯데홈쇼핑] [한정특가]…」 · WU-155 와 동일)
도노키즈            3     1    🟡 **③ 혼재** — 2건 **0KB 빈 응답** · 1건 🟢 완전 성공
                             (`Bigtooth Lemon #226AC007` · **KRW 88,000**)
보몽드(CONTROL)     1     1    🟢 정상 (123KB · og:title · 브랜드 · KRW 83,600)
전체 — URL **9** · 추출 OK **2**
🔴 롯데ON · 신세계 는 **상세 URL 미확보** 라 분모에서 뺐다(URL 을 지어내지 않았다)
```

🔴🔴 **그래서 ①(추출기 문제)은 «확정하지 못했다»** — 유일한 ① 후보가 롯데홈쇼핑 1건인데
그 페이지가 **상품 상세가 아니다**(기획전). 🔴 「국내 대형몰은 추출기만 고치면 된다」로
**적지 않는다.** 🟢 확정된 것은 **②(LF몰 shell)와 차단(쿠팡 403)** 이다.

🟢🟢 **전략적 함의 — 읽히는 쪽과 안 읽히는 쪽이 갈렸다**:
```
🟢 읽힌다   Cafe24/고도몰 계열 **전문몰**(보몽드 · 도노키즈) — og:title/본문에 상품정보가 있다
🔴 안 읽힌다 **대형 채널**(쿠팡 403 · LF몰 SPA shell · 롯데 계열 상세 URL 미확보)
⟹ 🔴 「AI Search 가 URL 을 주면 된다」가 **대형 채널에는 성립하지 않는다**
⟹ 🟢 그리고 **MI 는 여전히 이 병목과 무관하다**(CONTROL 2건이 가격까지 정상)
```

🔴🔴 **내 자동 판정이 1차에 세 곳에서 틀렸고 고쳤다**:
```
`status === "OK"` 를 「추출 성공」으로 썼다 ⟹ LF몰 3건(title **「나를 나답게 LFmall.com」** =
사이트 슬로건)과 롯데홈쇼핑(기획전 배너)이 **「🟢 추출 정상」** 으로 찍혔다.
🔴 그대로 보고했으면 **「LF몰·롯데홈쇼핑은 읽힌다」는 거짓 결론** 이었다.
🔴 **WU-074 가 기록한 그 함정** 이다 — `<title>` 이 있으면 `OK` 가 된다.
🟢 기준을 **「상품정보가 실제로 나왔는가(가격)」** 로 바꿨고 추출 OK 가 **6 → 2** 가 됐다.
🟢 그리고 「② JS 렌더」 한 등급으로 뭉갰던 것을 **차단 / shell / 빈 응답 / 혼재** 로 갈랐다.
```

🟢 하니스 `wu-160-domestic-extract-rate.test.ts`(`WU_160_PROBE=1`) — 운영 추출 결과와
**날것 HTML 을 같이** 본다(하나만 보면 ①과 ②를 가를 수 없다).

---

### 🔴🔴🔴 WU-159 결론 — **2차 표적 검색으로도 회수되지 않는다 · NO-GO**(코드 0)

> 🔴 CPO GO 기준 = 「2차 회수로 **새로** 얻은 국내 SAME 상세 URL **≥2곳**」 ⟹ **0곳**.

```
2차 표적 검색이 회수한 국내 상세 URL   **4**(쿠팡 1 · 도노키즈 3)
🔴 그중 목표 상품                       **0**
🇰🇷 SAME                               1 — 🔴 **CONTROL 뿐이다**(사람이 WU-150 에서 확보)
판정                                   🔴 **NO-GO**
🟢 CONTROL 재현 PASS(`SAME · KR · KRW 83,600`) ⟹ 이 측정은 유효하다(§5-B)
```

🔴🔴 **그런데 실패가 «세 가지 다른 모양» 이다 — 하나로 적으면 처방이 틀린다**:

```
⒜ 🔴 **URL 이 아예 안 돌아온다**(보몽드) — `site:` 5개 모양 · 가격 토큰까지 시도.
   엔진은 그 페이지를 **읽는데**(B226AC009 88,000원 인용) 링크를 주지 않는다
⒝ 🔴🔴 **URL 은 회수됐는데 «우리가 읽을 수 없다»**(쿠팡) — 새 축이다.
   `coupang.com/vp/products/8039018268` fetch **OK** 인데 title 이 **「- 티셔츠 | 쿠팡」**
   ⟹ `lvl=low` → **DROPPED**. 🔴 스니펫은 「B226AC009 · 89,540원」이라 말했지만
      **우리 추출기가 본 페이지에는 그 정보가 없다**(JS 렌더 shell)
   🔴 그래서 **그 URL 이 목표 상품인지 우리는 확인할 수 없다 = 측정불가**(SAME 도 DIFFERENT 도 아니다)
⒞ 🔴 **상세 URL 인데 추출 0**(도노키즈 2/3 `NO_FACTS`) — robots 차단이 아니라 추출 실패다.
   🟢 나머지 1건은 읽혔고 **다른 상품**(`Bigtooth Lemon #226AC007`)이라 올바르게 DROPPED
```

🟢 **그래서 WU-158 의 한 줄은 좁혀진다** — 「검색이 URL 을 안 준다」가 전부가 아니고,
**국내 대형 채널(쿠팡)은 URL 을 줘도 우리가 상품정보를 못 읽는다.** 🔴 그 둘은
**다른 WU** 다. 🔴 CTO 는 어느 것도 고치지 않았다(어댑터·Playwright·robots 전부 금지축).

🟢 하니스 `wu-159-url-recovery.test.ts`(`WU_159_PROBE=1`) · CONTROL 게이트 내장.

---

### 🔴🔴🔴 WU-158 결론 — **병목은 「검색이 그 URL 을 링크로 주지 않는다」 하나다**

> 🔴 CPO 정정 반영 — 「AI Search 가 **없다**」가 아니라 「AI Search 의 **국내 상세
> URL 품질** 문제」다. 🟢 그 문장이 **측정으로 확정됐다.**

```
🟢🟢 **파이프라인은 정상이다**(운영 함수 · 실제 HTTP · B226AC009)
   supplied 13 → accepted 13 → usable 13 → miEligible **13**(전건 통과)
   샵 대표 = **CONTROL** · tier **SAME** · market **KR** · **KRW 83,600** · lvl medium/0.79
   🟢 다른 12건은 대표 경쟁에서 밀렸다 ⟹ **MI 가 다른 상품을 올바르게 거른다**
🔴 **검색이 돌려준 「국내 동일상품」 상세 URL = 0 / 질의 8종**(목표 ≥3 미달)
🟢 **검색이 돌려준 국내 상세 URL(다른 상품) = 12** ⟹ URL 모양·채널은 작동한다
```

🟢🟢 **방법론적 발견 — `site:<샵>` + 한국어 상품명/시즌 이 상세 URL 을 낸다**:
```
WU-156 일반 질의 5종                        국내 상세 **0**
`site:beaumonde.co.kr 보보쇼즈 허그 헤어리 몬스터 티셔츠`  🟢 `goods_view.php` **7**
`site:beaumonde.co.kr 보보쇼즈 26FW`                    🟢 `goods_view.php` **4**
🔴 그런데 **그 상품의 URL 만** 한 번도 안 돌아왔다
```

🔴🔴 **원인을 셋으로 갈라 적는다 — 「검색 못함」으로 뭉개지 않는다**:
```
⒜ 색인 신선도 문제 **아니다** — ⑧이 `goodsNo=1000014101·1000014104`(26FW)를 냈고
   목표는 `goodsNo=**1000014022**` 로 **같은 번호대** 다
⒝ 품번 색인 **없다** — `site:<샵> B226AC009` 가 무관 결과로 떨어진다
⒞ 🔴🔴 엔진은 그 페이지를 **읽는다** — 답변 문장이 `B226AC009 · 88,000원` 과
   자매상품 `B226AC028 · 135,000원` 까지 인용했다. **URL 만 링크로 주지 않는다.**
   🔴 우리 파이프라인은 **링크만** 받을 수 있다 ⟹ **그것이 병목이다**
⟹ 🔴 **질의 문구로 열리지 않는다**(가장 좁은 `site:` 표적까지 8종 시도)
```

🟡 **같이 측정된 운영 위험 하나(고치지 않았다)** — `maxUrls = **10**`
(`run-domestic-price-check.ts:1131` · 상수 `:163`)이라 **13건 중 3건은 열어 보지도
못한다.** 🔴 정답 URL 이 11번째면 **잃는다.** 🔴 붙여넣기 경로와 **공유 상수** 라
혼자 올리지 않았다(WU-132 가 「재투입 13 중 3건 미열람」으로 이미 겪었다).

🟢 하니스 `wu-158-domestic-url-yield.test.ts`(`WU_158_PROBE=1`) · §5-B **CONTROL 게이트 내장**.

🔴🔴 **그 게이트가 내 오류를 두 번 잡았고 둘 다 적는다**:
```
⒜ CONTROL URL 을 `goodsNo=1000014021` 로 썼다 → 그것은 **`B226AC010 Booty Ghosts`** 다
   (한 자리 틀렸다 · 실제 `1000014022`). 🔴 그리고 그때 **후보를 한 개씩** 넘겨
   ⑧ 증거 게이트가 **전건 DROPPED** 를 냈다 ⟹ 그대로 보고했으면 「MI 가 12건을
   올바르게 걸렀다」는 **거짓 결론** 이었다(실제로는 하니스가 고장난 상태)
⒝ `c.modelCode` 를 찍었는데 **그 칸이 없다**(TS2339) — 실행은 `code=-` 를 찍었으므로
   **「품번 전건 null」이라는 거짓 사실** 이 될 자리였다 🟢 typecheck 가 잡았다
```

---

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

## 6-AF. [완료 기록] WU-156 — Case C / NO-GO

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

## 6-AG. [참고] 그 전의 좌표 — WU-149 STEP 1·6·7

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

## 6-AH. [완료 기록] STEP 1 → 6 → 7 이 무엇이었나

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
