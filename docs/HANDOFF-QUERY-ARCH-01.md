# DISCOVERY-QUERY-ARCHITECTURE-01 — Query Preview (Search 0회)

🔴 **§15 까지만 수행했다** — CPO 가 「Preview 를 먼저 보고 Search 로 넘어가자」고 정했고,
   §17 의 10회 Search 는 **CTO 가 실행할 수 없다**(아래 §F).

---

## A. Query — 10건 **전부** 생성된다 (전 2건 → **10건**)

| # | 카테고리 | 상품 | Brand | Model Code | Product Name(코어) | Facts | tok | 최종 Query |
|---|---|---|---|---|---|---|---:|---|
| 1 | 아동 | Bobo Choses | Bobo Choses | `B226AC009` | Hug Hairy Monster T-shirt | Light blue · loose fit | 13 | `"Bobo Choses" "B226AC009" Hug Hairy Monster T-shirt Light blue loose fit 동일상품 판매처` |
| 2 | 아동 | Main Story | Main Story | `AW26MS185` | Bubble Sweatshirt Melange | Grey · 100% Organic Cotton · relaxed fit | 14 | `"Main Story" "AW26MS185" Bubble Sweatshirt Melange Grey 100% Organic Cotton relaxed fit 동일상품 판매처` |
| 3 | 아동 | BOSS | BOSS | **없음** | Baby Boys Logo Top | White · 100% Cotton | 10 | `"BOSS" Baby Boys Logo Top White 100% Cotton 동일상품 판매처` |
| 4 | 아동 | Louis Louise | Louis Louise | **없음** | Holly Hearts Ribbed Velvet | Pink · 100% Cotton | 11 | `"Louis Louise" Holly Hearts Ribbed Velvet Pink 100% Cotton 동일상품 판매처` |
| 5 | 아동 | Mini rodini | Mini rodini | **없음** | Violas aop Winter jacket | 100% recycled polyester | 11 | `"Mini rodini" Violas aop Winter jacket 100% recycled polyester 동일상품 판매처` |
| 6 | 테니스 | Damarindo Pique Polo | Sergio Tacchini | **없음** | Men's Damarindo Pique Polo | Humus · 100% Cotton · true to size | 14 | `"Sergio Tacchini" Men's Damarindo Pique Polo Humus 100% Cotton true to size 동일상품 판매처` |
| 7 | 테니스 | Fall Cericho T-Shirt | Sergio Tacchini | **없음** | Men's Fall Cericho T-Shirt | Brilliant White · 100% Cotton · true to size | 15 | `"Sergio Tacchini" Men's Fall Cericho T-Shirt Brilliant White 100% Cotton true to size 동일상품 판매처` |
| 8 | 테니스 | Magro Long Sleeve | Sergio Tacchini | **없음** | Men's Magro Long Sleeve | Brilliant White · true to size | 13 | `"Sergio Tacchini" Men's Magro Long Sleeve Brilliant White true to size 동일상품 판매처` |
| 9 | 테니스 | Racchetto Polo | Sergio Tacchini | **없음** | Men's Racchetto Polo | Brilliant White · 100% Polyester · true to size | 14 | `"Sergio Tacchini" Men's Racchetto Polo Brilliant White 100% Polyester true to size 동일상품 판매처` |
| 10 | 테니스 | Trattino Short | Sergio Tacchini | **없음** | Men's Trattino Short | Galaxy Blue · true to size | 12 | `"Sergio Tacchini" Men's Trattino Short Galaxy Blue true to size 동일상품 판매처` |

```
Query 생성 **10 / 10**   (직전 E2E-HISTORY-10 에서는 2 / 10)
품번 사용 2건 · 품번 없이 생성 **8건**  ⟹ 🟢 `NO_MODEL_CODE → Search 0` **닫혔다**
토큰 10~15 · 질의당 Search **1회**(변경 0)
```

## B. 🔴🔴 **진짜 원인은 조립기가 아니라 «재료» 였다**

```
run-domestic-price-check.ts 가 identity 를 이렇게 넘기고 있었다 —
   productName: null · productType: null · color: null · season: null
⟹ 조립기를 아무리 고쳐도 **쓸 재료가 없어** 질의가 품번 하나로 쪼그라든다.
🟢 그래서 고친 곳이 **둘** 이다 — 조립기 «그리고» 호출부.
```

## C. 설계 — **이미 측정된 것 위에만 세웠다**

```
BRAND(따옴표) + [CODE](따옴표) + 디자인 코어 ≤4 + 사실 ≤3 + 「동일상품 판매처」
🟢 디자인 코어는 **기존 buildPrimaryQuery denylist** 재사용(새 사전 0)
🟢 「동일상품 판매처」는 **SP-09 가 실측한 짧은 신호** — 전체 Evidence 판매처 9 → 17 ·
   SP-10 2회 관측 합계에서도 최고(39)
🔴 **긴 자연어 목적 문장은 쓰지 않았다** — SP-08 이 **NO-GO** 로 닫았다(효과의 정체가
   「목적」이 아니라 **「한국어 토큰」** 이었고 영어 CONTROL 은 국내가 전혀 안 늘었다)
🔴 「국내외 판매처」(S-C)도 쓰지 않았다 — 국내 1→7 인데 **Crawl 이 절반 이하**(17→8)이고
   한 상품은 **해외가 0** 이 됐다
🔴 따옴표는 **식별자에만** — 디자인명·사실까지 감싸면 정확일치 요구가 되어 recall 이 죽는다
🔴 사이즈·연령은 넣지 않았다(denylist 가 노이즈로 판정한 축)
```

## D. 🔴 넘겨 읽지 않을 것

```
⒜ 🔴🔴 **이 조합은 «미측정» 이다.** SP-09/10 이 잰 것은 S-A·S-C·S-D «각각» 이고
   「S-A + facts + 신호」는 **한 번도 실행된 적이 없다**. 「더 좋아졌다」로 적지 않는다.
⒝ 🔴 SP-10 실측 — **같은 질의의 실행 간 URL 겹침이 3~30%** ⟹ 1회 관측으로 우열 불가.
⒞ 🔴 SP-10 실측 — 국내 Evidence 11건 중 **9건(82%)이 한 상품** 에서 나왔다 ⟹
   「Query 문구로 국내를 연다」가 아니라 **그 브랜드가 국내에 유통되는가** 가 정한다.
⒟ 🟡 `true to size`(fit)가 **모든 Sergio Tacchini 질의에 똑같이** 들어간다 — 식별력
   없는 보일러플레이트일 수 있다. 🔴 빼려면 「일반적 fit 문구」라는 **의미 규칙** 이
   필요하고 그것은 새 사전이다 ⟹ **CTO 가 임의로 빼지 않았다 · CPO 판정 사안**.
⒠ 🟡 `100%` 접두(소재)도 같은 성질이다 — 남겼고 **판정하지 않았다**.
⒡ 🔴 BOSS 의 `J53497` 은 **여전히 품번으로 안 잡힌다**(§21 Identity 변경 금지 준수).
   🟢 다만 이제 **품번 없이도 질의가 서므로** 그것이 Search 를 막지는 않는다.
```

## E. 계약 11 + 음성 대조 4

```
Q1 품번 없어도 질의가 선다        Q2 품번 단독이 아니다(**운영 진입점 포함**)
Q3 재료 전무면 만들지 않는다       Q4 질의는 **한 개**
Q5 따옴표는 식별자에만            Q6 같은 단어 두 번 금지
Q7 사실의 **구를 깨지 않는다**     Q8 끊긴 기능어 금지(SP-09 S-A2)
Q9 사이즈 금지                    Q10 판정 모듈 import 금지
Q11 **운영 호출부가 재료를 비워 보내지 않는다**

N1 facts 제거                         → **2 FAIL**
N3 기능어를 구 «안쪽까지» 거름         → **1 FAIL**
N4 호출부 productName: null 복귀       → **1 FAIL**
N5 운영 진입점에 품번 단독 단축 삽입   → 🔴 **1차 통과** → 🟢 Q2 강화 후 **1 FAIL**
전부 복구 후 11 passed
```

🔴🔴 **내 계약이 한 번 뚫렸다** — Q2 가 `buildCompositeDiscoveryQuery` 만 봐서, **운영이
부르는** `buildDiscoverySearchQuery` 가 품번 단독으로 되돌아가도 통과했다. 🟢 두 자리를
같이 단언하도록 고쳤다.

🟢 **기존 가드 둘이 내 변경을 잡았다**(약화하지 않고 등록·강화):
- `core-1 B-2`(새 한글 사전 금지) → 고정 의도 키워드 allowlist 에 근거와 함께 추가하고
  **상한 3** 을 새로 걸었다(길어지면 그것이 사전이다).
- `core-same06`(fixture 전수 분류) → preview 산출물 등록.

## F. 🔴🔴 §17 Search 는 **CTO 가 실행할 수 없다**

```
APIFY_API_TOKEN 은 **Production 전용 · Encrypted** 다.
실측 — `vercel env ls` → Production only · `vercel env pull` → **빈 문자열**(§10).
⟹ 로컬 실행은 `skipped: "NOT_CONFIGURED"` = **「못 물어봤다」** 이고 0 이 아니다.
🟢 Preview 는 Search 를 쓰지 않으므로 **여기까지는 전부 실측** 이다.
```

🟡 **CPO 결정 둘** — ① 이 Query 로 §17 을 열 것인가 · ② ⒟⒠ 의 보일러플레이트를 뺄 것인가.

**판정 — 🟢 §15/§16 PASS(10/10 · 1 Product = 1 Search 유지) · 🔴 §17~§20 미실행.**
