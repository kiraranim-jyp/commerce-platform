# 🔴🔴 WU-138 — **국내 탈락 지점 확정 + (a) 반사실 REJECT**

> 🔴 CPO: 「최종 숫자부터 보지 않는다. 실제 SAME URL 을 넣고 끝까지 따라간다.
> 품번 exact 조건의 `NO_TITLE_OVERLAP` 비차단을 **반사실로 먼저** 재고, 실패하면
> **(a)를 구현하지 않는다.**」
>
> 🔴 **운영 코드 변경 0.** 하니스/계약만. threshold 0 · 8축 0 · Registry 0 · 새 축 0.

---

## 1. 🟢🟢 STEP 1~3 — URL 단위 funnel (B226AC009 · human GT 17)

`wu-138-same-funnel.test.ts`(게이트 `WU_138_PROBE=1`). 운영 함수 · 실제 HTTP · pool 17/17.

| URL | human | 시장 | 후보 | 판정 | 대표 | tier | 가격 | 최종 | 사라진 칸 |
|---|---|---|---:|---:|---:|---|---|---:|---|
| **biskuit.kr** | SAME | 🇰🇷 | **O** | **O** | **O** | PRESUMED_SAME | **KRW 88,000** | **X** | **⑤ MI** (BRAND_MISMATCH · NO_TITLE_OVERLAP) |
| global.trenbe.com | SAME | 🌎 | O | O | O | **SAME** | USD 84 | **O** | 🟢 통과 |
| www.thefrontshop.com | SAME | 🌎 | O | O | O | **SAME** | USD 58 | **O** | 🟢 통과 |
| www.tinyapple.net | SAME | 🌎 | O | O | O | **SAME** | USD 58 | **O** | 🟢 통과 |
| bobochoses.com | SAME | 🌎 | O | O | O | CONFLICT | EUR 35 | X | ⑤ MI (MODEL_CODE) |
| kids21.com | SAME | 🌎 | O | O | O | CONFLICT | SGD 70 | X | ⑤ MI (MODEL_CODE) |
| cissywears.com | SAME | 🌎 | O | O | O | PRESUMED_SAME | GBP 33 | X | ⑤ MI (AUDIENCE_LINE) |
| bornyesterdaykids.com | SAME | 🌎 | O | **X** | X | — | — | X | ③ 샵 게이트(⑧) |
| www.stockmann.ee | SAME | 🌎 | O | **X** | X | — | — | X | ③ 샵 게이트(⑧) |
| www.junioredition.com | SAME | 🌎 | O | O | **X** | — | — | X | ④ 샵 대표 |
| scoutandcokids / junioredition / tinyapple | SAME | 🌎 | X | X | X | — | — | X | 🟡 **중복 URL — 같은 판매처가 다른 URL 로 통과** |

```
🇰🇷 국내  n 1 · human SAME 1 · 후보 1 · 판정 1 · 대표 1 · tierSAME **0** · 가격확인 1 · 최종 **0**
🌎 해외  n 16 · human SAME 12 · 후보 12 · 판정 10 · 대표 9 · tierSAME **3** · 가격확인 7 · 최종 **3**
📊 verdict ON_SALE · 판매중 3 · 확인불가 2 · 🇰🇷 0 · 🌎 3 · GBP 37×2 · USD 58×2
```

🔴🔴 **국내 결론 — CPO 분기표의 B 다.** `biskuit.kr` 은 **후보로 들어오고 · 판정을 받고 ·
샵 대표가 되고 · KR 로 확정되고 · 가격까지 확인된다.** 끊기는 곳은 **MI 판정 하나** 다.
🔴 **discovery 문제도 · 가격 문제도 · wiring 문제도 아니다.**

🔴 **하니스를 한 번 틀렸고 정정했다** — 중복 URL 3건을 「② 후보 생성 실패」로 찍었는데
그 판매처는 **다른 URL 로 최종 비교에 서 있다**(GBP 37). 그대로 보고했으면
**「발견 실패 3건」이라는 거짓 원인** 이었다.

---

## 2. 🔴🔴🔴 STEP 4 반사실 — **(a) REJECT**

조건: `titleOverlap === 0` 이고 **`identifierConfirmed`(품번 exact)** 이면 그 blocker 를
밀지 않는다(**전체 완화 아님** · threshold 0 · 같은 입력 · 같은 후보 집합).

| | BEFORE | AFTER (CF) |
|---|---|---|
| 🇰🇷 국내 tierSAME | 0 | **0** |
| 🇰🇷 국내 최종 비교 | 0 | **0** |
| 🌎 해외 tierSAME | 3 | 4 |
| 🌎 해외 최종 비교 | 3 | 4 |
| **DIFFERENT 방어** | **4/4** | 🔴 **3/4** |
| 가격 축 | GBP 37 · USD 58 | 🔴 **+ KRW 59,000** |

```
🔴🔴 m.luxboy.com (human **DIFFERENT**) → tier **SAME** · 최종 비교 **O** ·
     그리고 **KRW 59,000 이 가격 축에 새로 들어왔다**
🟢 biskuit 는 **열리지 않았다** — `BRAND_MISMATCH` 가 남는다(blockers 가 둘이었다)
```

🔴 **CPO 성공조건 둘이 동시에 깨졌다** — ⒜ 「biskuit → SAME」 **미달** ⒝ 「luxboy 오판
안 함」 **위반**. ⟹ **구현하지 않았다**(CPO §3 그대로 · 운영 코드 변경 0 · 트리 clean).

🔴🔴 **그리고 교환이 «순손실» 이다** — 얻는 국내 **0**, 잃는 정확도 **1**(그 1건이
셀러가 보는 **국내 통화 최저가**가 된다 · WU-077 이 같은 금액으로 측정한 그 위험).

---

## 3. 🟡 CPO §3 이 지시한 「추가 식별조건」 조사 — 측정된 사실

```
biskuit 를 막는 것   **둘** — BRAND_MISMATCH · NO_TITLE_OVERLAP
luxboy 를 막는 것    **하나** — NO_TITLE_OVERLAP 단독
                     🔴 색상 충돌 0 · 품번 충돌 0 · 상품군 충돌 0
```

🟢 **BRAND_MISMATCH 는 거짓 신호다** — `biskuit.kr` 이 `brand` 자리에 **자기 상점 이름
「비스킷」** 을 적는다(WU-080 실측). 🟢 판별 수단도 **이미 있다** —
`extractSiteBrandName`(og:site_name == JSON-LD Organization.name). 후보 `brand` 가 그
사이트 자신의 이름과 같으면 그 값은 **상품 브랜드가 아니다** ⟹ MISMATCH 가 아니라
**UNCONFIRMED(모른다)** 가 정확하다. 🔴 WU-095(숫자 slug)·WU-134(시즌코드)와 **같은
계열의 「거짓 증거 제거」** 이고 완화가 아니다.

🔴 **그러나 그것만으로는 국내가 열리지 않는다**(NO_TITLE_OVERLAP 이 남는다 · 효과 0).

🔴🔴 **그래서 지금 데이터로 biskuit 와 luxboy 를 가르는 축이 «없다»**:
```
두 후보 모두 — NO_TITLE_OVERLAP(한국어 제목) · 색상/품번/상품군 충돌 0
🔴 가를 수 있는 것은 **시장**(.kr ↔ .com+KRW)뿐이고 그것은 **동일성 축이 아니다**
   ⟹ 새 축 신설이고 CPO 금지
⟹ 🔴 이 트랙에서 **열 번째로** 같은 패턴이 측정됐다 —
   「완화 = Human DIFFERENT 동반 개방」(WU-063~080 의 여덟 축 + WU-093 + 이번)
```

---

## 4. 🟡 CPO 판정이 필요한 것 (CTO 가 고르지 않았다)

```
① 🟢 **BRAND_MISMATCH 거짓 신호 제거** — 완화가 아니라 거짓 증거 제거(WU-095 선례).
   🔴 효과는 **국내 0 → 0**(그래도 다음 상품에서 실제 SAME 을 막는 신호가 사라진다)
② 🔴 **국내 축을 지금 열지 않는다** — human SAME 이 **1건** 이고 그 1건을 열려면
   human DIFFERENT 1건이 같이 열린다. 🔴 표본이 1:1 이라 **어느 쪽도 증거가 약하다**
③ 🟡 **국내 human GT 를 늘린다** — 지금 분모가 **1** 이다(B226AC009). 🔴 WU-133 이
   이미 측정했다: B226AC010 의 국내 SAME 은 **스냅샷이 DB 에 없어 측정불가** 다
   ⟹ 국내 축 판단의 전제는 **GT 확보** 이고 그것은 CEO 육안 작업이다
```

🔴 **STEP 5~6 을 실행하지 않았다** — STEP 4 가 REJECT 됐으므로 「국내 + 해외 동시 표시」가
성립하지 않고, 두 번째 상품도 **같은 자리에서 막힌다**(먼저 돌리면 같은 결과를 두 번 센다).

---

## 5. 🟢 검증

```
운영 코드 변경 **0** · 작업트리 **clean** · 계약 신규 1(URL 단위 funnel · 게이트)
회귀 **8,573 passed · failed 0** · typecheck **0** · build **exit 0** · ahead 0 / behind 0
🟢 반사실은 **적용 확인 후** 돌리고 **복구** 했다(「적용 실패」를 「통과」로 읽지 않는다)
🟢 열화 게이트 — pool 가용률이 반 미만이면 funnel 을 내지 않고 FAIL 한다
```

🔴 **측정불가** — ⒜ 국내 human SAME 분모 **1** ⒝ `B226AC010` 국내 SAME 은 스냅샷 부재로
측정불가(WU-133) ⒞ luxboy 가 왜 DIFFERENT 인지의 **사람 사유가 기록에 없다**(그것이
있으면 가를 축을 찾을 수 있다) ⒟ 실제 따져 화면은 CTO 가 볼 수 없다.
