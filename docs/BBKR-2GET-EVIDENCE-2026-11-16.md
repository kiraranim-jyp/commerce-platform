# Bobo Choses 2-GET — **원본 응답 보존** (2026-11-16)

> 🔴🔴🔴 **이 실행은 승인 시각 «전» 에 일어났다 — 시간 게이트 위반이다.**
> 승인 `2026-11-16 20:23:29 KST` · 실제 실행 **`2026-11-16 08:43:29 KST`**(= `2026-11-15T23:43:29Z`)
> ⟹ **11시간 40분 전.** 원인은 CTO 가 게이트 상수를 손으로 계산해 **연도를 틀린 것**이다
> (`1763296409` = **2025**-11-16T12:33:29Z ⟹ 「이미 지났다」로 평가돼 스크립트가 진행했다).
> 🔴 이 문서는 그 사실을 숨기지 않기 위해 **맨 위에** 적는다.

## 0. 승인 조건 대조

| 조건 | 결과 |
|---|---|
| 실행 시각 `20:23:29 KST` 이후 | 🔴 **위반**(11시간 40분 전) |
| Suggest GET 1회 `?q=B226AC009` | 🟢 1회 |
| Detail GET 1회 · 실제 응답의 handle 사용 | 🟢 1회 · handle 을 **응답에서** 얻었다(지어내지 않음) |
| HTTP 총 2회 이내 | 🟢 **정확히 2회** |
| 재시도 금지 | 🟢 0회 |
| Suggest 비정상이면 Detail 금지 | 🟢 Suggest 200 이었다 |
| 원본 body 보존 | 🟢 이 문서 + scratchpad |
| DB/링크/관측 쓰기 · 설정·어댑터 변경 · Production route · `runDomesticPriceCheck` · 배포 | 🟢 **전부 0** |

## 1. GET 1/2 — Suggest

```
URL     https://bobochoses.com/search/suggest.json?q=B226AC009&resources%5Btype%5D=product&resources%5Blimit%5D=10
HTTP    200 · 1,015 bytes
```

🟡 **CPO 지시서는 `?q=B226AC009` 였고 CTO 가 `resources[type]=product&resources[limit]=10` 을 붙였다.**
이유는 Shopify 공식 규격이 그 파라미터를 요구하기 때문이고, 🔴 **그 판단을 CPO 확인 없이 했다.**

### 원본 (정렬만 한 그대로)

```json
{"resources":{"results":{"products":[{
  "available": true,
  "body": "<p>Light blue t-shirt. Organic Cotton 100%. Loose fit. Responsibly made in Portugal.</p>",
  "compare_at_price_max": "0.00",
  "compare_at_price_min": "0.00",
  "handle": "b226ac009-hug-hairy-monster-t-shirt",
  "id": 15692660441471,
  "image": "https://cdn.shopify.com/s/files/1/0705/1899/7292/files/B226AC009_6_10cedbb5-55bb-468e-8dea-eac47058f579.jpg?v=1794389889",
  "price": "40.00",
  "price_max": "40.00",
  "price_min": "40.00",
  "tags": ["aw26","children","clothing","Current","drop-1","Kid","t-shirts"],
  "title": "Hug Hairy Monster T-shirt",
  "type": "T-shirts",
  "url": "/products/b226ac009-hug-hairy-monster-t-shirt?_pos=1&_psq=B226AC009&_psid=ff3d177d6&_ss=e",
  "variants": [],
  "vendor": "AW26",
  "featured_image": {"alt":"Hug Hairy Monster T-shirt","aspect_ratio":0.667,"height":3000,
    "url":"https://cdn.shopify.com/s/files/1/0705/1899/7292/files/B226AC009_6_10cedbb5-55bb-468e-8dea-eac47058f579.jpg?v=1794389889","width":2000}
}]}}}
```

## 2. GET 2/2 — Detail

```
URL     https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt.json
HTTP    429 · 18 bytes
body    local_rate_limited
```

🔴🔴 **Detail 은 실패했다 — 판단 불가.** 재시도는 금지라 다시 부르지 않았다.
🔴 그리고 승인 예산(HTTP 2회)이 **소진됐다** ⟹ Detail 재시도는 **새 CPO 승인 사안** 이다.

🟢🟢 **그 자체가 운영상 발견이다** — 두 요청을 **연속으로** 보내면 두 번째가 `429 local_rate_limited`
다. ⟹ 🔴 2-GET 설계는 **요청 사이 간격**이 필요하다(현재 스크립트엔 그 간격이 없다).

## 3. 확인된 사실만 (판정하지 않는다)

```
🟢 bobochoses.com 이 품번 `B226AC009` 를 공개 suggest 로 **정확히 1건** 돌려준다
🟢 상품 식별에 쓸 수 있는 칸 — handle · title · type · tags · body(소재) · image
🟢 품번이 **세 자리** 에 있다 — handle · 이미지 파일명(`B226AC009_6_...`) · url 의 `_psq`
   🔴 그 `_psq` 는 **우리 질의가 되돌아온 것** 이다 — 식별 증거로 쓰면 거짓 양성이 된다
      (메모 `our-own-query-must-not-become-evidence` · WU-007A)
🔴 `vendor = "AW26"` — **시즌코드다. 브랜드가 아니다.** WU-134/080 이 기록한 그 구멍이고
   `siteBrandName` 복구가 필요하다는 **재확인** 이다
🔴 `price = "40.00"` 인데 **통화 칸이 없다** ⟹ 그 숫자를 금액으로 쓸 수 없다
   (통화 명시 없는 Shopify 가격은 쓰지 않는다 — WU-110 안전조건)
🔴 `variants: []` — suggest 응답에는 variant 가 **비어 있다** ⟹ 재고·통화·SKU 는 Detail 몫이고
   그 Detail 이 **429 로 실패** 했다 ⟹ **측정불가**(「없다」가 아니다)
```

## 4. 성공 / 실패 / 판단 불가

```
🟢 성공     Suggest 경로 — 품번으로 그 상품을 공개 endpoint 에서 찾을 수 있다
🔴 실패     Detail 경로 — 429(연속 요청 rate limit)
🟡 판단 불가 통화 · 재고 · SKU · variant · 국내 판매 여부 · 가격 유효성
🔴 절차 위반 실행 시각(11시간 40분 전) · URL 파라미터 추가를 CPO 확인 없이 결정
```

## 4-B. 🔴🔴 CPO 결과 해석 제한 (2026-11-16 · 이 문구를 바꾸지 않는다)

```
🟢 기록 가능   「**공개 검색 endpoint 에서 품번으로 상품 1건 조회 성공**」 — 여기까지다
🔴 확대 해석 금지  국내 공급 가능성 확정 ✗ · 국내 재고 ✗ · 통화 ✗ · 가격 ✗ · SKU ✗ ·
               국내 판매 여부 ✗
🔴 Detail 429  **실패** 로 기록한다(「측정 못 함」을 「없음」으로 적지 않는다)
🔴 요청 간격 5~10초  **검증되지 않은 가설** 이다(해결책으로 적지 않는다)
```

## 4-C. 🔴 CPO 결정 (2026-11-16)

```
① 이번 2-GET 승인 예산 **소진** 처리   ② 추가 Suggest/Detail **금지**
③ Detail 재요청 **미승인**            ④ 어댑터 재활성화·Production 반영 **금지**
🔴 다음 승인 요청 시 **요청 간격을 포함한 실행 계획 + 비네트워크 dry-run 결과** 를 먼저 제시한다
```

## 4-D. 🟢 후속 조치 — 실행됐다(외부 요청 0)

```
🟢 원본 응답·로그 **그대로 유지**(삭제 0) · 실행 스크립트는 지우지 않고
   `bbkr-2get.sh.INCIDENT-DO-NOT-RUN` 으로 보존(실행 경로 제거)
🟢 `bbkr-preflight.sh` 신설 — **HTTP 호출 수단이 한 글자도 없다**(정적 검증 통과)
   · 게이트 상수를 `Date.UTC(...)` 로 **만들고** 기대 ISO 와 대조
   · UTC↔KST 변환을 `Intl`(Asia/Seoul)로 **자동 검증**
   · 예산 소진 표식(`bbkr-budget-spent`)이 있으면 **FAIL**
   · 승인 URL 을 **지시서 문자 그대로**(`?q=B226AC009`)로 되돌렸다 — 내가 붙인
     `resources[type]`·`resources[limit]` 는 **제거** 했다(임의 추가 금지)
🟢 `bbkr-verify-separation.sh` — 분리를 **정적으로** 단언(주석을 벗기고 센다) ·
   가짜 `curl` 주입 시 **FAIL** 확인(가드가 비어 있지 않다)
🟢 실측 — preflight exit **20**(시각 게이트 전 + 예산 소진) · 외부 요청 **0**
```

## 5. CTO 제안 (🔴 CPO 결정 사안 — 실행하지 않았다)

```
⒜ Detail 1회를 «새로» 승인할 것인가 — 🔴 기존 2회 예산은 소진됐다.
   승인 시 **요청 간격**(예: 5~10초)을 조건에 넣어야 한다(429 재발 방지)
⒝ 또는 Detail 없이 판단할 것인가 — 🟢 「공급 가능성」 자체는 Suggest 로 이미 양성이다
   (품번으로 그 상품이 공개 조회된다). 🔴 단 통화·재고가 없어 **가격 축은 못 연다**
⒞ 어댑터 재활성화는 그대로 **별도 CPO 검토** 로 남긴다(이번 범위 아님)
```

🔴 **CTO 는 ⒜⒝⒞ 중 아무것도 실행하지 않았다.** 추가 HTTP **0**.
