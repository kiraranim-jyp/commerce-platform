# WU-019A-ALT-6 — `PRESUMED_SAME` **화면 노출** 검증 (관찰만 · 수정 0)

🔴 UI 수정 0 · 상태명 변경 0 · MI 0 · threshold 0 · 색상사전 0 · `PRESUMED_SAME` 정책 0 ·
DB 0 · 검색 0 · 추가 GT 0 · AI API 0 · 비용 **₩0** · **운영 코드 변경 0**. 코드 조사만.

---

## ① 화면 표시 — 🟢 **내부 enum 을 그대로 노출하지 않는다**
사용자 문구 매핑([market-evidence.ts:103](apps/admin/src/app/pipeline/commerce/market-evidence.ts:103)):
```
SAME                     🟢 동일상품
SAME_MODEL_OPTION_DIFF   🔵 **동일 모델 · 옵션 다름**
PRESUMED_SAME            🟡 동일상품 추정
SIMILAR                  ⚪ 비교상품
UNKNOWN                  ⚪ 판단 불가
CONFLICT                 🔴 다른 상품 가능성
```
보조 문구(`MATCH_LEVEL_LABEL`): `medium` → **「유사상품 · 확인 필요」**.

## ② 🔴🔴 표시 축이 **`crossSellerVerdict` 가 아니다** (이것이 이번 핵심)
`displayTierForCandidate`([ComparisonShopSearch.tsx:81](apps/admin/src/app/pipeline/commerce/ComparisonShopSearch.tsx:81)):
```
① productMatchTruth 가 있으면 → overseasMatchDisplay(그 값)
② 없으면 matchLevel 폴백 — very_high/high → SAME · **medium → PRESUMED_SAME** · 그 외 UNKNOWN
```
🔴 즉 ALT-3/ALT-5 에서 측정한 `crossSellerVerdict = PRESUMED_SAME` 은 **화면 등급을 직접
정하지 않는다.** B10 계열 3건은 `matchLevel` 이 **0.78 = medium** 이므로 ②를 타고
화면에 **🟡 「동일상품 추정」** 으로 뜬다.

## ③ 🔴 오해 가능성 — **존재한다 (단 완화 장치가 있다)**
```
GT  DIFFERENT (같은 품번 AW26MS185 · **다른 색상**)
화면 🟡 **「동일상품 추정」**     ← 🔴 「추정」이지만 «동일상품» 이라는 단어가 들어간다
```
🟢 완화 셋 — ⒜ 🟢 아니라 **🟡** ⒝ 보조 문구가 「유사상품 · **확인 필요**」 ⒞ downstream 은
WU-018-P10 에서 확인된 대로 **`COMPARISON`** 이고 **EXACT(동일상품 가격) 차단** 이다.

🔴🔴 **그리고 가장 중요한 관찰 하나** — 이 경우를 위한 등급이 **이미 있다**:
```
🔵 SAME_MODEL_OPTION_DIFF = 「동일 모델 · 옵션 다름」
```
🔴 그런데 B10 계열은 그 등급에 **닿지 못한다** — 그 등급은 `productMatchTruth` 가 있을 때만
쓰이고, 이번 후보들은 그 값이 없어 `matchLevel` 폴백으로 「동일상품 추정」이 된다.
🟢 즉 **문구를 새로 만들 필요가 없고**, 있는 등급에 닿게 하는 문제다. 🔴 **고치지 않았다**(관찰만).

## ④ 판매/등록 경계
```
대표상품/판매상품/등록 진입  🔴 **이 화면에서 승격 버튼이 없다** — WU-022 가 고정한 규칙
                            (transient 구역에 「동일상품 확인」 버튼 없음 · DB 승격 금지)
비교 후보로만 유지           🟢 그렇다 — tier `COMPARISON` 이고 국내 최저가·판매판정에
                            들어가지 않는다(WU-018-P10 에서 두 겹 안전장치 확인)
🔴 단 **배포된 실화면은 CTO 가 볼 수 없다**(로그인 뒤 · 메모 production-payload-is-unreachable)
```

## ⑤ 정책 판정
```
PRESUMED_SAME   **유지** (정책 변경 없음)
downstream      🟢 안전 — COMPARISON · EXACT 차단 · 승격 버튼 없음
수정 필요 여부   🟡 **문구 축 1건 관찰** — 「동일상품 추정」이 GT DIFFERENT 에 붙는다.
                🔴 이번 WU 에서 수정하지 않았다. 고치는 방향은 **새 문구가 아니라**
                   기존 🔵 등급(`SAME_MODEL_OPTION_DIFF`)에 닿게 하는 쪽이다.
```

## ⑥ 다음 작업 후보 — 1개
🟡 **`productMatchTruth` 가 B10 계열에 왜 비어 있는지** 확인(그 값이 있으면 화면이 이미
🔵 「동일 모델 · 옵션 다름」으로 적는다). 🔴 **조사만** 이고 UI/정책 변경이 아니다.

🔴 **CEO Action: NONE** — 이번 항목은 전부 코드 경로로 확인됐고, 실제 배포 화면을 봐야만
확인되는 항목은 **없었다.**
