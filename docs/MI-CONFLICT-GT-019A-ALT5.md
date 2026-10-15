# WU-019A-ALT-5 — MI **CONFLICT** 축 GT 검증 (sample N=30)

🔴 새 검색 0 · suggest 재실행 0 · DDG 0 · AI API 0 · MI 코드 0 · threshold 0 ·
색상사전 0 · `PRESUMED_SAME` 0 · Registry 0 · UI/DB/API 0 · 새 URL normalizer 0 ·
**운영 코드 변경 0** · 비용 **₩0**. 🟡 페이지 GET **30회**. 입력은 ALT-3 의 148건 그대로.

---

## ① 표본 — 기계적 선정(임의 선별 0)
```
후보 풀 148 → 제외 41(ALT-3 11 · ALT-4 30) → **CONFLICT 대상 85**
pri 분포   pri1(동일 품번) **0** · pri2(브랜드+상품명 강일치) **2** · pri3 **21** · pri4 **62**
검증 **30** = pri2 2 + pri3 21 + pri4 7   (상한 30 도달 → 즉시 종료)
GET 성공 **30** / 실패 **0**
```
🔴🔴 **직전 보고를 정정한다** — 「동일 품번 CONFLICT 2건」이라 적었지만 그 2건은
**pri2(브랜드+상품명 강일치)** 다. **동일 품번 CONFLICT 는 실제로 0건** 이다.
🟢 즉 1순위 축은 **대상 자체가 없었다**(측정 실패가 아니다).

## ② GT
```
SAME **0** · DIFFERENT **29** · UNVERIFIED **1**
```
🔴 `_psq`·`_pos`·`_sid` 는 GT 증거에서 제외하고 URL API 로 제거한 뒤 **본문** 만 판독.

## ③ CONFLICT → GT
```
CONFLICT → SAME       **0 / 30**
CONFLICT → DIFFERENT  **29 / 30**
CONFLICT → UNVERIFIED **1 / 30**
MI missed-SAME        **0**
missed-SAME rate      🔴 **산출하지 않는다** — GT SAME 이 0 이므로(§5 규정)
```

## ④ 주요 사례
```
🟢 SAME 누락 사례 **없음** — CONFLICT 30건 중 실제 SAME 0
🟢 동일 품번 사례 **없음**(pri1 = 0건 · 대상 자체가 없다)
🟡 강일치 사례(pri2 2건) — 둘 다 GT **DIFFERENT**. 브랜드·상품명 토큰은 겹쳤지만
   본문 품번이 달랐다 → MI CONFLICT 가 **옳았다**
🟡 UNVERIFIED 1건 — `Darlyn Sequin Ballet Slippers in Violett`
   품번 🔴 · 상품명 토큰 🟢(`lulu`/`t`/`bar` 중 일부 일치) · 색상 🔴
   → 🔴 확정 불가라 **DIFFERENT 로 추정하지 않았다**(§4 준수)
CONFLICT 원인 패턴 — 같은 브랜드/상품군의 **다른 모델** 이 주류(Darlyn 슬리퍼류 ·
   Almost Moiré 재킷류 · 타 브랜드 트랙수트). 🟢 전부 실제로 다른 상품이었다
```

## ⑤ ALT-3 + ALT-4 + ALT-5 종합 — 🔴 분모를 같이 적는다

| MI 판정 | GT SAME | GT DIFFERENT | UNVERIFIED | 분모 |
|---|---:|---:|---:|---|
| `SAME` | **5** | 0 | 0 | 5 / 5 (ALT-3) |
| `PRESUMED_SAME` | 0 | **6** | 0 | 6 / 6 (ALT-3) |
| `SIMILAR` | 0 | **30** | 0 | 30 / 31 (ALT-4) |
| `CONFLICT` | **0** | **29** | **1** | 30 / 85 (ALT-5) |

```
🟢🟢 False SAME    **0**  (검증 71건 전체)
🟢🟢 missed-SAME   **0**  (SIMILAR 30 + CONFLICT 30 = 60건에서 실제 SAME 0)
🔴 측정하지 않은 축 — CONFLICT 55/85 · SIMILAR 1/31 · UNKNOWN 21 → **0 으로 적지 않는다**
🔴 N=71 · 원상품 6 · 샵 11 — **일반화 금지**
```

## ⑥ 정책 판정 — §7-A 조건 충족(CONFLICT → GT SAME = 0)
```
MI               **유지**
threshold        **유지** — 내릴 근거(missed-SAME) 0 · 올릴 근거(False SAME) 0
색상사전          **유지** — 색상 기인 누락 0(관찰만)
PRESUMED_SAME    **유지** — 6/6 GT DIFFERENT. 보류가 정확했다
```
🟢 이번 측정의 의미: **MI 의 보수적 판정이 「SAME 을 과도하게 버리는」 쪽이 아니다** —
SIMILAR·CONFLICT 60건에서 실제 SAME 이 **하나도** 나오지 않았다.

## ⑦ 다음 작업 후보 — **1개만**
🟡 **`PRESUMED_SAME` 의 성질 규명** — 유일하게 「MI 가 올렸는데 GT 가 DIFFERENT」인 축이고
(6/6), 그 6건 중 3건이 **같은 품번·다른 색상**(B10 계열)이다. 🔴 정책 변경이 아니라
**그 6건이 downstream(tier/가격)에 닿는지**가 이미 WU-018-P10 에서 `COMPARISON` 으로
확인됐으므로, 남은 질문은 「**화면에 어떻게 보이는가**」 하나다.
🔴 그 외 축은 **추가 측정 필요** — 특히 CONFLICT 55건·UNKNOWN 21건이 미측정이다.

🔴 **CEO Action: NONE.**
