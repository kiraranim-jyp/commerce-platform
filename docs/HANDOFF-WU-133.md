# 🔴 WU-133 — **기존 human SAME 전수 추적 · 「SAME 0」 원인 확정** (HOLD)

> 🔴🔴 **CPO 지시(2026-10-20)**: 「`SAME 0`을 「동일상품이 없다」로도 「MI 가 정확하다」로도
> 닫지 말고, **우리가 이미 사람이 SAME 이라 확인한 실제 상품이 현재 시스템에서 어디까지
> 살아가는지** 를 숫자로 내라. threshold 는 낮추지 않는다. CEO 테스트 없음 — CTO 가 먼저 증명.」
>
> 🔴 **판정: HOLD.** 원인은 확정됐고, 해소는 **CPO 가 이미 닫아 둔 두 축** 을 여는 결정이다.
> 🟢 CTO 가 할 수 있는 최소 수정(화면 정직성) 하나는 **구현·배포** 했다.

---

## 0. 🔴 먼저 — WU-132 의 「SAME 0 = 정상」은 닫을 근거가 부족했다

CPO 지적이 맞다. WU-132 는 「MI 가 전부 보류로 판정한다 ⟹ 그게 정확하다」로 닫았는데,
**사람이 이미 SAME 이라 확인한 데이터를 역추적하지 않은 상태** 였다. 이 WU 가 그것을 했다.

---

## 1. 🟢 GT 전수 집계 (URL 키 · 순수 · 네트워크 0)

```
출처  wu-112(27) · wu-111(2) · wu-116(1) · wu-125(9)        ← URL 키
      🔴 wu-099/100 은 **가치 라벨**(USEFUL/NOISE) — 합치지 않는다(§12 금지)
      🔴 wu-093 은 **SKU 키** 라 URL 이 없다 ⟹ URL 추적 **측정불가**(SAME 2/10)
라벨행 39 → 고유 37 (중복키 2 · 🟢 **판단 상충 0**)
고유 human SAME **24** — B226AC010 **11** · B226AC009 **13**
```

🔴🔴 **B226AC010 스냅샷이 DB 에 없다**(`product_snapshots` 543행 전수 검색 · 0건) ⟹
그 **11건은 측정불가** 다. 🔴 「MI 가 못 잡았다」로 세지 않는다.
🟢 추적 가능한 분모는 **B226AC009 13건** 이고, 그 수가 운영 DB `candidate_reviews` 의
`human_verdict='SAME'` **13** 과 **정확히 일치** 한다(독립 교차 확인).

---

## 2. 🔴🔴🔴 단계별 funnel (운영 함수 · 실제 HTTP · 운영 호출 순서 그대로)

```
① GT human SAME                  13
② 자동검색 재발견(URL 일치)        **0**     ← 🔴 원인 ①
②-host 자동검색이 그 판매처를 냄     2
②-reg  등록부에 그 판매처가 있음     4       ← 🔴 GT 호스트 11 중 **7곳이 등록부 밖**
③ canonical 통과                 12       (탈락 1 = DUPLICATE · 올바름)
④ MI input(후보 생성)             10
⑤ 샵 대표 선정                    7       (⑧ 게이트 DROPPED 2 · 샵 2순위 1)
⑥ displayTier SAME               **0**     ← 🔴 원인 ②
⑦ 가격 VERIFIED                   6
⑧ 최종 가격비교                   **0**
```

🔴 **②를 세 층으로 가른 이유** — URL 완전일치만 보면 로케일/경로 변형이 전부
「못 찾았다」로 세어지고 그건 Discovery 문제가 **아니다**. 그래서 ⒜ 등록부에 있는가
⒝ 그 호스트를 냈는가 ⒞ 그 URL 까지 같은가 를 **따로** 적는다.

### 행별 (판정까지 간 7건)

| 판매처 | verdict | matchTruth | 가격 | 보류/충돌 |
|---|---|---|---|---|
| biskuit.kr | PRESUMED_SAME | TEXT_CONFIRMED | KRW 88,000 ✓ | NO_TITLE_OVERLAP · BRAND_UNCONFIRMED |
| tinyapple.net | PRESUMED_SAME | TEXT_CONFIRMED | USD 58 ✓ | BRAND_UNCONFIRMED |
| global.trenbe.com | PRESUMED_SAME | TEXT_CONFIRMED | USD 84 (미검증) | BRAND_UNCONFIRMED |
| thefrontshop.com | PRESUMED_SAME | TEXT_CONFIRMED | USD 58 ✓ | BRAND_UNCONFIRMED |
| cissywears.com | PRESUMED_SAME | TEXT_CONFIRMED | GBP 33 ✓ | AUDIENCE_LINE · BRAND_UNCONFIRMED |
| bobochoses.com | CONFLICT | CONFLICT | EUR 35 ✓ | MODEL_CODE (`b226ab040` ↔ `b226ac009`) |
| kids21.com | CONFLICT | CONFLICT | SGD 70 ✓ | MODEL_CODE |

사유 분포 — **BRAND_UNCONFIRMED 5** · MODEL_CODE 2 · NO_TITLE_OVERLAP 1 · AUDIENCE_LINE 1

---

## 3. 🔴🔴🔴 원인 — CPO 4갈래 중 **①Discovery + ③MI matching** · 단일 사슬로 확정

### ⒜ Discovery — 공급이 구조적으로 막혀 있다
```
사람이 SAME 이라 한 판매처 **11곳 중 7곳이 등록부(`comparison_shops`)에 아예 없다**
⟹ 자동검색이 **영원히** 못 찾는다. 🔴 등록부/어댑터 확대는 §12-0 금지축이다.
🟢 그래서 **WU-132 의 ⑥ 재투입이 그 공백을 메우는 유일한 수단** 이고 실제로 작동한다
   (13 → canonical 12 → MI 10 → 판정 7). ⟸ WU-132 의 진짜 가치가 여기서 측정됐다
```

### ⒝ MI matching — 머리는 **「원상품 brand 가 빈 문자열」** 하나다
```
실측  원상품 facts — brand={"value":"","confident":true} · modelCode=B226AC009
`brandKnown = Boolean(x.brand && y.brand)` 에서 x 가 **원상품** 이므로
   ⟹ **모든 후보가 BRAND_UNCONFIRMED** 가 된다(후보 품질과 **무관**)
   → crossSellerVerdict **PRESUMED_SAME**
   → `crossSellerReserved`(match-truth.ts:233·237)가 식별자 경로를 막는다
   → matchTruth **TEXT_CONFIRMED** → tier COMPARISON → displayTier PRESUMED_SAME
   → 가격비교 **제외**
🔴 그 brand 가 빈 이유: 공식몰 JSON-LD 가 `brand.name = "AW26"`(시즌코드)이고
   `SEASON_CODE` 규칙이 그것을 **올바르게** 버린다(WU-080 실측 그대로다)
```

🔴🔴 **둘 다 CPO 가 이미 닫은 축이다 — CTO 가 열지 않았다**:
```
❌ 등록부/어댑터 확대                      §12-0 금지
❌ BRAND 완화 · extractor 수정 · fallback   WU-080 **CPO REJECT**
   (원상품 공백을 메우면 보류→**충돌** 로 악화 — SAME 4 더 막힘 · DIFFERENT 2 열림)
❌ `crossSellerReserved` 우회               WU-066 실측 precision 91.7% → **55.6%**
❌ threshold 완화 · 8축 재개방              CPO 명시 금지
⟹ 🔴 **HOLD.** 해소는 CPO 결정이다.
```

---

## 4. 🟢 CTO 가 한 최소 수정 — **화면이 거짓말을 멈췄다** (판정 0 · 집계 0 · 완화 0)

```
WU-132 화면  「동일상품으로 판정되고 가격까지 확인된 후보가 아직 없습니다」(끝)
🔴 그런데 **그 아래에 가격까지 확보된 후보 6건이 서 있었다** — 「아무것도 못 찾았다」로 읽힌다
🟢 이제 이미 계산된 보류 사유를 **세어** 같이 적는다:
   「가격까지 확인됐지만 동일상품 판정이 보류·충돌된 후보가 N건 있습니다 — 아래 후보 검토
    구역에서 사진으로 확인하고 판단해 주세요. 주요 사유 — 브랜드 미확인 5 · 품번 충돌 2.」
```
🔴 내부 토큰을 노출하지 않는다 — 축의 «말» 은 **`blocker-text.ts`** 가 소유한다.
🟢 그 파일을 **따로** 만든 이유: 라벨을 선별기에 두면 「선별기에 8축 어휘가 없다」는 계약이
**내 라벨 때문에** FAIL 한다 ⟹ **가드를 느슨하게 하지 않고 코드를 옮겼다.**
🔴 함수 이름을 `summarize…` 로 두지 않은 이유도 같다 — 그 어휘는 **금액 집계** 의 것이고
가격 영역에 들어오지 못하게 하는 계약(`wu-130 F-4`)이 있다 ⟹ `countPendingCandidates`.

---

## 5. 🔴 하니스를 세 번 틀렸고 셋 다 적는다

```
① 라이브 fetch 하니스에 `@vitest-environment jsdom` 을 붙였다 → 전건 UNREACHABLE
   🔴 「jsdom 이 원인」이라 **단정했는데 반증됐다**(node 에서도 같은 현상)
② 「해외검색이 뒤를 오염시킨다」로 단정 → **재현 안 됨**(단독 실행은 정상 · ok 10)
③ 「egress 프록시」로 단정 → **반증**(`setGlobalDispatcher` 를 쓰지 않는다는 주석 확인)
🔴🔴 **원인 미규명** 이다 — 추측을 결론으로 쓰지 않는다.
🟢 대신 **열화를 감지해 측정을 거부** 하는 게이트를 박았다 — 해외 샵 `outcomes.error > 0`
   이면 funnel 을 내지 않고 **FAIL** 한다(「측정불가」와 「0」을 섞지 않는 유일한 방법).
🟢 유효 측정의 근거: ③~⑧ 은 해외검색과 **무관** 하고 **독립 2회**(usable 13 · usable 10)로
   교차확인됐다. 🔴 ② 층별 숫자는 **정상 실행 1회** 값이다(그 사실을 그대로 적는다).
```

---

## 6. 🔴 측정불가 / 한계

```
⒜ B226AC010 human SAME **11건** — 원상품 스냅샷이 DB 에 없다
⒝ wu-093 human SAME **2건** — SKU 키라 URL 추적 불가
⒞ 🔴 **시스템 SAME 이 재현되는 실제 상품이 현재 표본에 0건** 이라 ⑧까지의 E2E 를
   **양성 케이스로 증명하지 못했다**(계약 테스트 마운트 DOM 으로만 증명됐다)
⒟ 반복 실행의 outbound 열화 원인
⒠ 실제 따져 화면은 CTO 가 볼 수 없다(로그인 뒤)
```

---

## 7. 🟡 CPO 결정 대기 (CTO 가 고르지 않았다)

```
① 원상품 brand 공백 — 사슬의 머리다. 🔴 WU-080 이 「메우면 악화」로 REJECT 했는데,
   그 측정은 **후보/도메인 fallback** 축이었다. 「**브랜드 공식몰 원상품** 의 brand 를
   품번 체계로 확정하는」 축은 그 측정 범위에 **없었다** — 열지 여부는 CPO 판정이다
② 사람 SAME 을 가격비교에 쓸 것인가 — 🔴 WU-131 계약이 **금지** 한다
   (「이 값은 MI·가격·알림·등록 payload 에 들어가지 않는다」). CTO 가 깨지 않았다
③ 등록부 밖 7곳 — Registry 확대 금지축과 정면으로 만난다
```

🔴 **CEO 액션 없음.**
