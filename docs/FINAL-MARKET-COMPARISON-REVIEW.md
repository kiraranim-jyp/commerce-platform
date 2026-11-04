# FINAL MARKET COMPARISON — CPO 데이터 검토표 (2026-11-04)

> 기준 HEAD `11929d05` · 🔴 **운영 코드 변경 0** · 네트워크 **0** · 과금 **0** · DB 쓰기 **0**.
> 🔴 LOCK 전수 준수 — Identity 판정 · 가격 eligibility · `SIMILAR → textOnly` · 가격 안전장치 ·
> A(HOLD) · B(NO-GO) · C(LOCK) · 검색 공급량 · 가격 정책 — **전부 손대지 않았다.**
>
> 🔵 **이 문서는 CPO §3 「데이터 검토 게이트」에 올리는 표다.** 🔴 CPO 검토 전에는
> 이 데이터를 「정상 노출」로 확정하지 않는다.

---

## 0. 먼저 — 🔴 측정 한계 (이것을 넘겨 읽으면 결론이 틀린다)

**로컬에서는 운영 discovery 를 재현할 수 없다.** 실측으로 확인한 두 원인:
```
comparison-shop.ts:141   getSupabaseAdmin() 없으면 `return []`  ⟹ 해외 등록부 **0**
[SP07-websearch]         skipped "NOT_CONFIGURED"               ⟹ AI Search **0**
```
🟢 그래서 `core-e2e-close-06` 라이브는 **스스로 측정을 거부했다**(열화 게이트가 작동했다 —
「후보가 전건 0 — 이 실행의 숫자를 제품 사실로 쓰지 않는다」).
🔴 **그 0 을 「국내/해외 후보가 없다」로 적지 않는다.** 로컬 env 한계다.

🟢 **그래서 운영이 이미 낸 산출물을 읽었다** — `candidate_reviews`(164행) — 그리고
**화면이 쓰는 그 함수**(`summarizeCandidateOverseasPrices` · `buildOverseasReference`)를
**직접 불러** 노출 문자열을 만들었다. 복제 계산 **0**.

### 0-A. 🔴🔴 분모를 두 번 틀렸고 둘 다 적는다

```
⒜ 1차에 `origin_code` 로 묶어 **39개 분석을 합친 값**(후보 92 · 판매처 73)을 찍었다 —
   🔴 화면은 **한 스냅샷** 을 그린다. 스냅샷 단위로 다시 보니 **후보 4건** 이다
⒝ 그 92행을 「중복 URL 3건(×39 ×31 ×2)」으로 적을 뻔했다 —
   🟢 실측: 39행 = **39개 서로 다른 snapshot** · 같은 `(snapshot_id, candidate_url)` 2행
      이상은 **0건** 이다(부분 유니크가 지킨다 · WU-141-R1 수정이 운영에서 동작한다)
   ⟹ 🟢 **중복이 아니라 «누적» 이다.** 거짓 결함이 될 뻔했다
```

---

## 1. 🔵 CPO 검토표 — 실제 화면 한 장 (운영 데이터)

**원상품** `B226AC009` Bobo Choses *Hug Hairy Monster T-shirt* (Light blue · loose fit)
**스냅샷** `6db15ecc` (가장 가격이 많은 스냅샷 · 2026-11-02) · **후보 4건** (🇰🇷 1 · 🌎 3)

| 시장 | 판매처 | verdict | tier | 가격 | 신뢰도 | 사람 | 상품명 |
|---|---|---|---|---|---|---|---|
| 🇰🇷 KR | `miniboutique.co.kr` | PRESUMED_SAME | COMPARISON | **KRW 88,000** | 🔴 `null`(모름) | — | `[BOBO CHOSES]T-Shirt - B226AC009 - 미니부띠끄` |
| 🌎 OS | `villagekids.co.uk` | PRESUMED_SAME | COMPARISON | **GBP 21.2** | 🔴 `null`(모름) | — | `Pale Blue 3D Logo T-Shirt` |
| 🌎 OS | `global.trenbe.com` | **SAME** | **EXACT** | **USD 80** | 🔴 `null`(모름) | — | `Bobo Choses Kids Hug Hairy Monster **Long Sleeve**` |
| 🌎 OS | `junioredition.com` | **SAME** | **EXACT** | **GBP 37** | 🟢 `VERIFIED_CURRENT` | — | `Hug Hairy Monster T-Shirt by Bobo Choses` |

### 1-A. 그 데이터로 **화면이 실제로 내는 문자열** (운영 뷰 빌더 호출 결과)

```
🇰🇷 국내 참고가격      KRW 88,000        · 판매처 1곳
🌎 해외 최저 소싱가     GBP 21.2 ~ 37     · 판매처 2곳
                      USD 80            · 판매처 1곳
등급 분포(참고)        🇰🇷 「동일상품 추정 1」
                      🌎 「동일상품 추정 1 · 동일상품 2」
🔴 등급 분포 줄은 **현재 화면에서 꺼져 있다**(`showTierNote: false` · 🇰🇷/🌎 둘 다) —
   위 문자열은 내가 `true` 로 켜서 **어휘를 확인한 것** 이다(STAGE 4-I 검증과 같은 축)
```
🟢🟢 **STAGE 4-I 의 어휘 정합이 실데이터에서 발화했다** — `COMPARISON` 이
「**동일상품 추정**」으로 뜬다(전에는 「유사상품」이었다).

---

## 2. 🟢 정확성 점검 — **모순 0** (CPO §2 항목별)

| 점검 | 결과 |
|---|---|
| 판매처명·상품명 표시 | 🟢 **4/4** 전건 있다 |
| 실제 가격 표시 | 🟢 **4/4** |
| 가격 없는 후보에 금액이 붙는가 | 🟢 **0건** |
| 도메인 ↔ 시장 분류 모순(`.kr`↔OVERSEAS 등) | 🟢 **0건** |
| 후보 중복(같은 스냅샷 안) | 🟢 **0건** (고유 URL 4/4) |
| `matchTruth` → `priceTier` 불일치 | 🟢 **0건** |
| 품절인데 가격이 집계에 남는가 | 🟢 **0건** |
| 🔴 **원화 환산** | 🟢 **이 영역은 환산하지 않는다** — 통화별로만 적는다(`wu-056r1` 계약) · `₩`/`약` **0** |
| 가격과 판매처가 서로 다른 후보로 연결 | 🟢 **없다** — 집계가 `sellerKey`(도메인)로 접는다(CORE-2T) |

🔴 **환율이 없을 때 잘못된 금액을 만드는가** → 🟢 **구조적으로 불가능하다.** 이 영역에
환산 경로가 **없다**(합계 칸도 없다). 🔴 그래서 「환산 정확성」은 **검토 대상이 아니라
«정상적으로 부재» 하는 축** 이다.

---

## 3. 🔵🔵 CPO 판정이 필요한 것 — **셋** (🔴 전부 LOCK 영역이라 내가 고치지 않았다)

### ① 🔴🔴 가격 4건 중 **3건이 신뢰도 「모름(`null`)」인데 전부 금액 집계에 들어간다**
```
검증됨 1 · 미검증 0 · 🔴 **모름(null) 3**
집계 진입 4 · 🔴 그중 VERIFIED_CURRENT 가 아닌 것 **3**
   miniboutique.co.kr  KRW 88,000   status=null   ← 🔴 **국내 유일 가격** 이다
   villagekids.co.uk   GBP 21.2     status=null   ← 🔴 **해외 최저값** 이다
   global.trenbe.com   USD 80       status=null
```
🔴 집계는 `priceStatus` 를 **보지 않고**(EXCLUDED 만 뺀다) UI 숫자 표시는
**`VERIFIED_CURRENT` 만** 본다(`isPriceDisplayable`) ⟹ **WU-111 모순이 실데이터에서 재현된다**
— 「최저가는 뜨는데 그 근거 줄은 「가격 확인 필요」」.
🔴🔴 그리고 WU-111 때는 `UNVERIFIED_SEARCH` 였는데 지금은 **`null`(= 모른다)** 이다.
🔴 **내 1차 측정이 이것을 0 으로 보고할 뻔했다** — `status && status !== VERIFIED` 로 세서
`null` 을 미검증에서 빼먹었다(헌장 §5 「거부/null/0 을 올바른 부재로 가정했는가」).
🟡 **CPO 판정** — ⒜ `null` 을 집계에서 뺀다(🔴 국내 가격이 **사라진다**) ⒝ UI 가 그 상태를
말한다 ⒞ 현상 유지. 🔴 **가격 정책이라 CTO 가 고르지 않았다.**

### ② 🔴🔴 `GBP 21.2 ~ 37` 범위가 **서로 다른 등급을 한 줄로 합친다**
```
GBP 21.2  villagekids.co.uk   PRESUMED_SAME(추정)  「Pale Blue 3D Logo T-Shirt」
GBP 37    junioredition.com   **SAME**(확정)        「Hug Hairy Monster T-Shirt by Bobo Choses」
```
🔴 셀러는 「영국 21.2~37 파운드」로 읽는데 **최저값 21.2 는 동일상품 «확정» 이 아니다.**
🔴🔴 그리고 `villagekids / Pale Blue 3D Logo T-Shirt` 는 **STAGE 4-G-R2 가 찾은 GT 모순쌍** 이다
(같은 쌍에 사람 라벨이 `DIFFERENT`(09:05) ↔ `SAME`(16:29) 둘 다 있다).
🟡 **CPO 판정** — 범위를 `tier` 별로 가를 것인가, 아니면 범위 자체를 쓰지 않을 것인가.
🔴 가격 표시 정책이라 CTO 가 고치지 않았다(「후보를 많이 보여주는 것 ≠ 잘못된 가격을 보여주는 것」).

### ③ 🟡 `global.trenbe.com` 「**Long Sleeve**」가 `SAME · EXACT` 로 들어간다
원상품은 `Hug Hairy Monster **T-shirt**`(반팔)이고 후보 제목에 `Long Sleeve` 가 있다.
🔴 **소매 길이를 보는 축은 없다**(WU-123/125 가 「새 축 금지 · 재현 0/18」로 닫았다).
🟡 **CPO 검토** — 이 건이 사람 눈으로 동일상품인가. 🔴 **CTO 는 판정하지 않았다.**

---

## 4. 측정 산출물 (재현 도구 · 커밋됨)

```
packages/database/scripts/final-market-review-dump.mjs   운영 데이터 덤프(READ-ONLY · 쓰기 0)
  ORIGIN_CODE=... SNAPSHOT_ID=... 로 다른 상품/스냅샷도 같은 표를 낸다
apps/.../__tests__/final-market-review.test.ts           운영 집계기·뷰 빌더 호출 → 검토표 렌더
  🟢 덤프가 없으면 **skip** 한다(CI 안전) · 네트워크 0
```

---

## 5. 남은 문제 / 잔여 위험

```
⒜ 🔴 **상품당 후보가 2~4건** 이다(스냅샷 단위 실측 · 8개 스냅샷 전부 2~4).
   🔴 그 수가 적은 원인은 **공급** 이고(AI Search 1회 · 등록부 어댑터 부재) 이 WU 범위가 아니다
⒝ 🔴 사람 판정이 이 스냅샷에서 **0/4** 다 ⟹ 「동일상품 여부」는 **CPO/CEO 검토 전까지 미확정**
⒞ 🔴 `price_status` 가 **3/4 에서 null** 이다 — 그 칸을 채우는 것은 가격 정책 영역이다
⒟ 🔴 실제 따져 화면은 CTO 가 볼 수 없다 — 이번 증명 축은 **운영 집계기·뷰 빌더 호출** 이다
   ⟹ 🔵 **CPO §5 「배포 후 실제 화면 확인」은 CPO/CEO 가 해야 닫힌다**
⒠ 🔴 로컬 env 로는 discovery 를 못 돌린다(§0) ⟹ 「수집이 정상인가」는 **운영 로그/산출물** 로만 본다
```

## 6. 내가 틀린 것 넷 (전부 사전 포착)

```
⒜ 🔴 DB 칸 이름을 추측했다 — `created_at` (실제 `first_seen_at`/`last_seen_at`) → 42703
⒝ 🔴 `origin_code` 로 묶어 **39개 분석 합산** 을 화면 값처럼 찍었다 → 스냅샷 단위로 정정
⒞ 🔴 뷰 빌더 칸 이름을 추측했다 — `amount`/`sellerCount` (실제 `lowest`/`scope`) →
   전건 `undefined` 를 찍었고, 그대로 보고했으면 **「화면에 금액이 안 뜬다」는 거짓 결함** 이었다
⒟ 🔴 `price_status = null` 을 미검증에서 빼먹어 **「미검증 0」** 이라는 거짓 숫자를 냈다
   ⟹ 🟢 셋으로 갈라 세도록 고쳤다(검증됨 / 미검증 / **모름**)
```
🔴 넷 중 셋이 **「칸 이름·분모를 추측한 것」** 이다. 이 트랙이 반복해서 적어 둔 그 함정이다.
