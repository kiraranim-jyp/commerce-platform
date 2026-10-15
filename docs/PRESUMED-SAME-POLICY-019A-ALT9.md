# WU-019A-ALT-9 — B10 🟡 유지 여부 **정책 증거 정리** (구현 0)

🔴 정책 변경 0 · threshold 0 · 색상사전 0 · `crossSellerVerdict` 0 · UI 문구 0 ·
새 검색 0 · 새 GT 0 · Registry 0 · DB 0 · **운영 코드 0** · AI 0 · 비용 ₩0.

## 1. B10 3건 증거표 — 🔴 **운영 경로로 측정했다**(추측 0)

| 후보 | cross | matchLevel | existing→`productMatchTruth` | display | 사용자 문구 | GT(ALT-3) |
|---|---|---|---|---|---|---|
| Rose Shadow (deuxbebe) | PRESUMED_SAME | low 0.46 | **VERY_SIMILAR** | `PRESUMED_SAME` | 🟡 동일상품 추정 | DIFFERENT |
| Conker Stripe (junioredition) | PRESUMED_SAME | medium 0.78 | **SAME_MODEL_VARIANT** | `SAME_MODEL_OPTION_DIFF` | 🔵 **동일 모델 · 옵션 다름** | DIFFERENT |
| Graystone (junioredition) | PRESUMED_SAME | medium 0.78 | **SAME_MODEL_VARIANT** | `SAME_MODEL_OPTION_DIFF` | 🔵 **동일 모델 · 옵션 다름** | DIFFERENT |

downstream(전건) — tier **COMPARISON** · EXACT 승격 **차단** · 대표/판매/등록 승격 버튼 **없음**
(WU-018-P10 두 겹 안전장치 + WU-022 규칙). False SAME 위험 — **없음**(가격·판정 진입 0).

## 2. 🔴🔴 ALT-6 · ALT-7 결론을 **둘 다 정정한다**
```
ALT-6 「B10 은 🟡 로 뜬다」            → 🔴 **3건 중 1건만** 그렇다(2건은 이미 🔵)
ALT-7 「🔵 로 가려면 cross=CONFLICT 필요」 → 🔴 **아니다.** rank 비교(product-identity.ts:143)에서
        `SAME_MODEL_VARIANT`(4) > PRESUMED_SAME 계열이라 **existing 이 이긴다**
ALT-7 「색상 데이터 부족은 원인이 아니다」 → 🔴 **과한 폐기였다.** 🟡 1건의 실제 원인은
        후보 **제목 형식** 이다 — 「모델 in 색상 by 브랜드」 패턴이 아니라(deuxbebe 는
        `AW26MS185 - Bubble Sweatshirt - Rose Shadow`) splitModelColor 가 색상을 못 읽어
        existing 이 `VERY_SIMILAR` 로 내려간다
```
🟢 즉 가르는 축은 `crossSellerVerdict` 가 아니라 **후보 제목이 그 패턴을 따르는가** 다.

## 3. ALT-8 🔵 대조군과의 차이
```
같은 두 후보(Conker·Graystone)를 cross=CONFLICT 로도, PRESUMED_SAME 으로도 통과시켰고
**둘 다 🔵** 였다 → cross 값이 이 등급을 바꾸지 않는다(대조군으로 확인).
```

## 4. 정책 결론 — **KEEP**
```
Q1 🟡 표시가 보수적 정책과 일치하는가   → 🟢 **일치**. 패턴을 못 읽으면 약하게 말한다
Q2 GT DIFFERENT 3건이 정책 변경을 요구할 강한 증거인가 → 🔴 **아니다.**
   3건 중 2건은 **이미 🔵** 로 정확히 표시되고, 남은 1건도 downstream 이 차단돼 있다
Q3 `cross=CONFLICT` 필요 구조를 유지해야 하는가 → 🔴 **그 전제가 틀렸다**(필요 없다)
🟢 결론 **KEEP** — 정책 변경 근거 부족. 🔴 구현 0.
```
🟡 남는 관찰 1건 — 「`- 색상` 형식 제목」은 색상을 못 읽는다. 🔴 고치지 않았다(관찰).

## 5. 다음 작업 후보 — 1개
🟡 **`splitModelColor` 가 읽지 못하는 제목 형식의 분포 측정**(예: `모델 - 색상`).
🔴 조사만 · 파서 수정 아님.
