# WU-019A-ALT-4 — MI 가 **SAME 을 놓치는지** 검증 (SIMILAR/CONFLICT → GT)

🔴 새 검색 0 · 새 검색어 0 · Registry 0 · AI API 0 · DDG 0 · threshold 0 · 색상사전 0 ·
`PRESUMED_SAME` 정책 0 · 운영 코드 변경 0 · 비용 **₩0**. 🟡 페이지 GET **30회**.
🟢 입력은 ALT-3 이 저장한 **148건 그대로**(재수집 0).

---

## ① 표본
```
148 중 ALT-3 에서 검증한 11건(MI SAME/PRESUMED_SAME) 제외 → **대상 풀 137**
풀 분포  SIMILAR **31** · CONFLICT 85(pri2 2 · pri3 21 · pri4 62) · UNKNOWN 21
실제 검증 **30건**(지시서 §4 상한) · GET 성공 **30** / 실패 **0**
```
🔴🔴 **그래서 검증된 30건은 전부 `SIMILAR` 다** — §4 의 자르기 순서가 「SIMILAR 전체 →
CONFLICT…」 이고 SIMILAR 가 31건이라 상한 30 에서 **CONFLICT 가 한 건도 들어가지 못했다.**
🔴 「CONFLICT → SAME」은 **측정불가**(분모 0)이고 **0 으로 적지 않는다.**

## ② GT
```
SAME **0** · DIFFERENT **30** · UNVERIFIED **0**
```
🔴 `_psq`·`_pos`·`_sid` 는 GT 증거로 쓰지 않았다(URL API 로 제거 후 **본문** 만 판독).

## ③ MI → GT
```
MI SIMILAR → GT SAME     **0/30**  (SIMILAR 31 중 30 검증)
MI CONFLICT → GT SAME    🔴 **측정불가**(분모 0)
MI missed-SAME           **0** (검증된 30건 기준)
False SAME               **0** (이번 표본에 MI SAME 판정이 없다 — ALT-3 축이다)
missed-SAME rate         0/30 = **0%** (sample N=30 · 🔴 SIMILAR 축에 한정)
```

## ④ 주요 사례
```
🟢 SAME 누락 사례 **없음** — 검증 30건 전부 실제로 다른 상품이었다
🟢 유형 A(정상적 보수 판정: MI SIMILAR + GT UNVERIFIED) **0건** —
   페이지 증거가 전부 충분해서 DIFFERENT 로 확정됐다(판단 불가가 아니었다)
🟢 유형 B(실제 False Negative: MI SIMILAR/CONFLICT + GT SAME) **0건**
🔴 색상 때문에 보수적으로 보인 사례 **0건**(이번 30건에는 같은 품번·다른 색상 쌍이 없다 —
   그 부류는 ALT-3 에서 `PRESUMED_SAME` 으로 올라갔다)
```

## ⑤ ALT-3 + ALT-4 종합 — 🔴 **두 실험을 섞지 않는다**

| MI 판정 | GT SAME | GT DIFFERENT | UNVERIFIED | 분모 |
|---|---|---|---|---|
| `SAME` | **5** | 0 | 0 | 5 (ALT-3) |
| `PRESUMED_SAME` | 0 | **6** | 0 | 6 (ALT-3) |
| `SIMILAR` | **0** | **30** | 0 | 30/31 (ALT-4) |
| `CONFLICT` | — | — | — | 🔴 **0 · 측정불가** |

```
🟢🟢 해석 가능한 KPI (검증 41건)
   False SAME            **0**   — `SAME` 5/5 가 전부 GT SAME
   missed-SAME(SIMILAR)  **0**   — SIMILAR 30건 중 실제 SAME 0
   🔴 `PRESUMED_SAME` 6/6 이 GT DIFFERENT — 「확정 보류」가 **옳게 작동** 했다
   🔴 CONFLICT 축은 **미측정** 이라 전체 recall 을 말할 수 없다
```

## ⑦ 정책 판정 (관찰만 · 변경 0)
```
threshold         **유지** — 올릴 근거도(False SAME 0) 내릴 근거도(missed-SAME 0) 없다
색상사전           **유지** — 이번 표본에 색상 기인 누락이 0 이다(관찰만)
PRESUMED_SAME     **유지** — 6/6 이 GT DIFFERENT 였다. 보류가 정확했다
다음 조사 후보      🟡 **CONFLICT 축**(분모 0) — 상한 때문에 못 봤다. 열 때는
                   「동일 품번 CONFLICT(pri2 2건) → 강일치(pri3 21건)」 순서가 그대로 남아 있다
```
🔴 **CEO Action: NONE.**
