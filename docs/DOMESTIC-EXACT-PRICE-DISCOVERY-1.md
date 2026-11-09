# DOMESTIC-EXACT-PRICE-DISCOVERY-1 — 국내 「EXACT + 원화」 후보를 확보할 수 있는가

> 🔴 **조사 전용.** 운영 코드 **0** · DB **0** · BRAND 축 **동결 준수** · 국내 EXACT 자격 **유지** ·
> `PRESUMED_SAME` 승격 **0** · matcher/threshold/GT **0** · WU-020 외화 보호 **유지** · 미커밋 39건 보존.
> 기준 스냅샷 `16155f19`(Hug Hairy Monster T-Shirt · CEO 열람분).

---

## 0. 결론 — **현재 소스에서는 확보 불가능**이고, 원인은 «탐색량» 이 아니다

```
🔴🔴 전 DB 전수 — 「KR · KRW · tier EXACT · blocker 0」 = **0건**
    KR + 원화 가격이 있는 후보 **11건** → 전부 `PRESUMED_SAME` · `COMPARISON` · blocker 있음
    blocker 분포  BRAND_UNCONFIRMED **8** · BRAND_MISMATCH **2** · NO_TITLE_OVERLAP 1
    ⟹ 국내 후보를 막는 것은 **10/11 이 BRAND 축** 이다
🔴 그러므로 후보 «수» 를 늘려도 같은 결과가 난다 — CPO 전제와 같다
   (「국내 가격 후보 숫자를 늘리는 것이 목표가 아니다」)
```

🟢🟢 **그리고 새 사실 하나 — BRAND blocker 는 «원상품 탓이 아니다»**
```
이 스냅샷 원상품 brand = **"Bobo Choses"**(source ORIGINAL · confidence 0.95) ⟹ **정상**
🟢 WU-134(빠른 경로 brand 복구)가 **작동하고 있다**
⟹ 🔴 WU-080 이 REJECT 한 것은 「**원상품측** 공백을 메우기」였는데 **그 분모가 아니다.**
   지금 막는 것은 **후보측** 이다 — 이것은 WU-141 이 「미측정 가설」로 남겨 둔 바로 그 자리다.
```

---

## 1. 국내 후보 **3건** 전수 (화면 ↔ 데이터 일치 확인)

`workspace.searchRun.producerMarkets` 실측 — 🟢 화면 「국내 소싱 후보 3곳」과 **정확히 일치**:

| 생산자 | KR | 후보 |
|---|---:|---|
| `WEB_SEARCH` | **1** | `vividvia.com` |
| `DOMESTIC_LISTING` | **1** | `donokids.com` |
| `REVIEWED_SAME` | **1** | 🟢 **§2 의 그 1건**(이전 확인 후보 재투입) |
| GEMINI · SELLER_URL · OVERSEAS_AUTO | 0 | — |

```
전체 생산자 WEB_SEARCH 4 · OVERSEAS_AUTO 1 · REVIEWED_SAME 10 · DOMESTIC_LISTING 1 ·
            GEMINI **0**(flag OFF) · SELLER_URL **0**(셀러 미입력)
weakDropped **12**   검색어 1회 · organic 10 · pages 2
```

### 후보별 증거

| 후보 | URL | 동일상품 | blocker | 가격 | MI 국내 자격 |
|---|---|---|---|---|---|
| `vividvia.com` | `/product/보보쇼즈-26…` | 🔴 PRESUMED_SAME | **BRAND_MISMATCH** | 🟢 KRW 88,000 VERIFIED | 🔴 **없음**(COMPARISON) |
| `donokids.com` | `/shop/shopdetail.html?branduid=3362785` | 🔴 PRESUMED_SAME | **BRAND_UNCONFIRMED** | 🟢 KRW 88,000 VERIFIED | 🔴 **없음**(COMPARISON) |
| 재투입 1건 | (위 둘 중 하나의 이전 스냅샷 판) | 🔴 PRESUMED_SAME | BRAND 계열 | KRW 88,000 | 🔴 없음 |

🟢 **CPO 필수 조건 5개 대조** — 「동일상품 SAME/EXACT」 ✗ · 「blocker 0」 ✗ · 「KRW 가격」 **🟢 있다** ·
「접근 가능한 URL」 **🟢 있다** · 「MI 국내 입력 자격」 ✗.
⟹ 🔴 **막히는 것은 «가격» 이 아니라 «동일상품 자격» 하나다.**

---

## 2. 누락된 transient 1건 — 추적 완료

```
생산자 `REVIEWED_SAME`(= 이전 확인 후보 재투입 · 화면 「이전 확인 후보 10건」의 국내분 1)
🔴 **새 판매처가 아니다** — 같은 `origin_code` 의 KR 후보를 전수로 뽑으니
   `vividvia.com` · `donokids.com` **두 도메인뿐** 이고 나머지는 **같은 URL 의 중복 행** 이다
⟹ 🔴 **국내 후보 3곳 = 실질 판매처 «2곳»** + 재투입 중복 1
🔴 그리고 그 11건 전부 `human_verdict = null` — **사람 판정이 한 번도 없었다**
```

---

## 3. 🔴🔴 BRAND blocker 의 실체 — 후보 페이지를 직접 읽었다(read-only)

| 후보 | 구조화 `brand` | `og:site_name` | 본문 브랜드명 | ⟹ blocker 의 이유 |
|---|---|---|---|---|
| `donokids.com` (**상품 상세**) | 🔴 **없음** | 없음 | 「Bobo Choses」4 · 「보보쇼즈」9 | **선언이 없어서** `BRAND_UNCONFIRMED` — **정확한 상태** |
| `vividvia.com` (🔴 **홈** · 아래 한계) | 🔴 없음 | **"VIVIDVIA"** | 「Bobo Choses」7 · 「보보쇼즈」18 | 샵 이름이 brand 자리에 → `BRAND_MISMATCH` 로 보이는 모양 |

🔴🔴 **그래서 본문에는 브랜드명이 있는데 구조화 칸에는 없다.** 그 간극을 메울 수단은
**전부 이미 닫혀 있다**:
```
본문 라벨에서 brand 읽기   🔴 WU-080 §10 **금지**
domain → brand            🔴 `wu-080-brand-producer.test.ts` 가 **2 FAIL 로 잠근다**
og:site_name → brand      🔴 WU-009 반증(리테일러에서 **샵 이름** 이 들어간다)
                             🟢 `vividvia`("VIVIDVIA")가 **바로 그 사례** 다
BRAND_* 완화              🔴 WU-080 CPO REJECT · WU-138 완화 REJECT(**동결축**)
```

🔴 **한계** — `vividvia` 는 상품 URL 이 퍼센트 인코딩된 한글이라 이번에 **홈을 받았다**.
그 행의 판정 근거는 **상품 페이지** 이므로 위 표의 vividvia 줄은 **미확정** 이다
(donokids 는 실제 상품 상세 URL 이라 확정).

---

## 4. 기존 탐색 경로 — 아직 «쓰지 않은» 것 둘

```
🟡 `GEMINI`        생산자 **0** — flag OFF(비용 미승인 · §12 정책 HOLD)
🟡 `SELLER_URL`    생산자 **0** — 셀러가 URL 을 붙여넣지 않았다(기능은 살아 있다)
🔴 `weakDropped` **12** — 약한 후보로 버려진 12건의 «내용» 은 **저장되지 않는다** ⟹ 측정불가
```
🔴 셋 다 **후보를 늘리는** 수단이고, §0 의 전수 결과대로 **BRAND 축이 그대로면 EXACT 는 0** 이다.
🟢 단 「새 후보에서는 구조화 brand 가 있을 수도 있다」는 **반증되지 않았다**(아래 §5 ⒝).

---

## 5. 확보 가능성 결론

```
🔴 **① 기존 기능으로 확보 가능**         — **아니다**(전 DB 0건 · 11/11 탈락)
🟡 **② 탐색 범위 확장 필요**             — **부분적으로만** 유효하다(아래 ⒝)
🟢 **③ 현재 소스에서는 확보 불가능**      — **이것이 맞다**
```

### 근거를 둘로 갈라 적는다
```
⒜ 🔴 **확정** — 지금 가진 국내 후보(실질 2곳)는 **BRAND 축** 으로 막히고, 그 축과 그것을
   메울 수단(본문/도메인/site_name)은 **전부 동결·REJECT** 다. ⟹ 코드로 열 길이 없다.
⒝ 🟡 **미측정** — 「**구조화 brand 를 선언하는** 국내 판매처」가 존재하면 그 후보는
   BRAND 축을 **그대로 둔 채** EXACT 에 닿을 수 있다. 🔴 현재 표본(11건)에 그런 샵이
   **0곳** 이지만, 그것은 **탐색이 닿은 범위** 의 성질이지 국내 시장 전체의 성질이 아니다.
   🔴 **CTO 가 「국내에 그런 샵이 없다」로 적지 않는다.**
```

### 🔴 그리고 「EXACT + 원화」가 **구조적으로** 어려운 이유 하나 더
```
이 상품에서 유일한 EXACT(blocker 0)는 `bobochoses.com`(브랜드 자기 몰)이고,
그 도메인의 **한국 가격은 이미 존재** 한다 — 이 스냅샷의
`SELLER_ORIGIN / KR_MARKET / ₩70,500`(= **원가 기준**).
🔴 그러나 그것은 **같은 판매자** 다 ⟹ 「국내 시장 비교가격」으로 쓰면 원가와 비교가격이
   같은 출처가 된다(저장소에 `sameSellerDistinctListing` 가드가 있는 이유).
⟹ 🔴 **제3자** 국내 판매처에서 EXACT 를 얻지 못하면 국내 수익성은 열리지 않는다.
```

---

## 6. 🟡 CPO 판정 재료 (🔴 CTO 가 고르지 않았다 · 전부 정책)

```
⒜ **현상 유지** — 국내 수익성은 계속 「판단 불가」. 화면은 이미 그 사실을 정직하게 말한다
   (`MARKET_OPPORTUNITY` → 「국내 판매 사례 확인 필요」 + 다음 행동).
⒝ **탐색 범위 확장** — GEMINI flag(비용) · SELLER_URL(셀러 입력) · 국내 목록 2-hop.
   🔴 효과는 **「구조화 brand 를 쓰는 국내 샵이 실재하는가」** 에 달려 있고 **미측정** 이다.
   🟡 그것만 재는 **좁은 조사** 는 가능하다(국내 샵 N곳의 상품 페이지에서 JSON-LD `brand`
   선언 비율을 세는 것 · 운영 변경 0 · read-only HTTP).
⒞ **사람 판정 경로** — 국내 후보 11건이 **전부 `human_verdict = null`** 이다.
   🔴 CEO 가 「동일상품」이라 확정한 국내 후보가 **아직 0건** 이므로, 사람 판정이 들어오면
   그 후보는 BRAND 축을 **건드리지 않고** 재투입 경로를 탄다.
   🔴 단 그것이 **tier EXACT 를 주는지** 는 이 조사에서 확인하지 않았다(별도 확인 필요).
```

---

## 7. 측정 한계

```
🔴 `candidate_reviews` 는 저장된 부분집합 — 화면 수치와 완전히 같지 않다(§1 은 `searchRun`
   의 생산자별 카운트로 교차 확인했고 **국내 3곳은 일치** 한다)
🔴 `vividvia` 상품 페이지는 **받지 못했다**(한글 퍼센트 인코딩) ⟹ 그 줄은 미확정
🔴 `weakDropped 12` 의 내용은 **저장되지 않는다**
🔴 「국내에 구조화 brand 를 쓰는 샵이 있는가」는 **재지 않았다**(⒝ 의 좁은 조사 대상)
🔴 `marketCase`·`sellability` 는 저장되지 않는 계산값 — 코드 추적이다
```
