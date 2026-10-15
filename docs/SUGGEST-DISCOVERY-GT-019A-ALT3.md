# WU-019A-ALT-3-GT — Shopify suggest 후보의 **독립 GT 검증** (sample N=11)

🔴 새 검색 0 · MI 수정 0 · threshold 0 · 색상사전 0 · Registry 0 · UI 0 · DB 0 ·
AI API 0 · 키 0 · 비용 **₩0** · 운영 코드 변경 **0**. 🟡 실제 페이지 GET 11회.

---

## 1. 표본 — 148 후보 중 **MI 가 SAME/PRESUMED_SAME 을 준 11건만**
🔴 148 전수 GT 를 하지 않았다(CPO 범위). 🔴 **MI 판정을 GT 로 쓰지 않았다** — 실제
페이지 본문의 품번·상품명·색상만 봤다.
🔴🔴 **`_psq`·`_pos`·`_sid` 는 GT 증거로 쓰지 않았다**(WU-007A 결함과 같은 축) — URL 에서
제거한 뒤 **본문** 만 읽었다.

| | MI | 품번 | 상품명 | 색상 | **GT** |
|---|---|---|---|---|---|
| S1 booty-ghosts | `SAME` 1.0 | 🟢 | 🟢 | 🟢 | **SAME** |
| S2 hug-hairy-monster | `SAME` 1.0 | 🟢 | 🟢 | 🟢 | **SAME** |
| S3 curious-turnip | `SAME` 1.0 | 🟢 | 🟢 | 🟢 | **SAME** |
| S4 grey-melange | `SAME` 1.0 | 🟢 | 🟢 | 🟢 | **SAME** |
| S5 lulu-vernice-nero | `SAME` 1.0 | 🟢 | 🟢 | 🟢 | **SAME** |
| S4 **conker-stripe** | `PRESUMED_SAME` 0.78 | 🟢 | 🟢 | 🔴 **다름** | **DIFFERENT** |
| S4 **graystone** | `PRESUMED_SAME` 0.78 | 🟢 | 🟢 | 🔴 **다름** | **DIFFERENT** |
| S6 moschino jacket | `PRESUMED_SAME` 0.25 | 🔴 | 🔴 | 🟢 | **DIFFERENT** |
| S6 gcds tracksuit | `PRESUMED_SAME` 0.2 | 🔴 | 🔴 | 🟢 | **DIFFERENT** |
| S6 missoni tracksuit | `PRESUMED_SAME` 0.17 | 🔴 | 🟢 | 🔴 | **DIFFERENT** |
| S6 village navy tracksuit | `PRESUMED_SAME` 0.14 | 🔴 | 🔴 | 🔴 | **DIFFERENT** |

## 2. KPI (검증된 표본 한정 · **N=11**)
```
MI SAME           5/5 → GT SAME 5 · DIFFERENT 0   🟢🟢 **False SAME = 0**
MI PRESUMED_SAME  6/6 → GT SAME 0 · DIFFERENT 6
검증 성공 11/11 · 실패 0
Precision(SAME 만)        5/5  = **100%**
Precision(SAME+PRESUMED)  5/11 = **45%**
```
🔴 **두 기준을 같이 적는다** — `PRESUMED_SAME` 을 「동일상품으로 올렸다」로 세면 45%,
「확정 보류」로 보면 SAME 축은 100% 다. 하나만 쓰면 결과가 숨는다.
🔴 **Search Discovery KPI 는 산출하지 않았다** — known-positive 분모(bobochoses.com)가
이 등록부 11샵 실험과 **맞지 않는다**.

## 3. 🟢🟢 재현된 현상 — WU-018 **B10 과 같은 축**
`AW26MS185` 의 **Conker Stripe · Graystone** 은 같은 품번 · **다른 색상** 인데
`PRESUMED_SAME 0.78` 이다. 🔴 B10(Rose Shadow)과 같은 품번 · 같은 성질이고,
이번에 **독립 2건이 추가** 돼 **N=1 → N=3** 이 됐다.
🟢 그리고 WU-018-P10 이 확인한 두 겹 안전장치(`PRESUMED_SAME` → `COMPARISON` ·
EXACT 차단)가 적용되는 부류다. 🔴 **수정하지 않았다**(CPO 판정 유지).

## 4. 🔴 하니스 오류 2건 (둘 다 그 자리에서 잡았고 운영 코드는 건드리지 않았다)
```
⒜ `searchShopifySuggest` 를 **barrel 에서** import → `undefined` 호출 → 66× TypeError
   🟢 원인 확정(barrel 미노출) · 🔴 barrel 에 export 추가는 **운영 코드 변경** 이라 하지
      않고 **직접 경로 import** 로만 고쳤다. 그리고 에러 **message 를 버리지 않게** 고쳤다
      (이전엔 `e.name` 만 남겨 원인을 못 봤다).
⒝ URL 정리를 **직접 정규식** 으로 해서 `?` 를 지워 `&_psid=` 가 경로에 붙었다 → **전건 404**
   🟢 `URL.searchParams.delete` 로 고쳐 11/11 → 200.
   🔴🔴 **교훈(세 번째 같은 계열)** — URL 처리 owner 가 리포에 **이미 있다**
      (`discoveryUrlRecord` / WU-007A 의 검색문맥 제거). **손으로 다시 만들지 않는다.**
```
🔴 그래서 이 측정을 다시 돌릴 때도 **`discoveryUrlRecord`/URL API 만** 쓴다. 새 URL 처리
로직을 만들지 않는다(CPO 지시).

## 5. 재현 경계 (정직하게)
```
🟢 커밋된 것   suggest PoC 하니스(후보 148 수집 · 결과 JSON) + 이 문서
🔴 커밋 안 된 것 GT 단계는 **일회성 스크립트** 로 돌렸다(저장된 결과 JSON + 페이지 GET).
                 다시 돌릴 때는 **반드시** `discoveryUrlRecord` 로 URL 을 정리한다.
🔴 숫자 범위    N=11 · 원상품 6 · 샵 11 — **일반화 금지**
```
🔴 **CEO Action: NONE.**
