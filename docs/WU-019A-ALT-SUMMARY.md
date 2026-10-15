# WU-019A-ALT-SUMMARY — ALT 트랙 **기준 문서** (새 측정 0)

🔴 새 측정 0 · 새 검색 0 · parser 0 · 정책 0 · UI 0 · Registry 0 · DB 0 ·
운영 코드 **0** · AI 0 · 비용 **₩0**. 🟢 ALT-3~10 의 **기록 정리** 다.

🔴🔴 **다음 세션은 이 문서를 먼저 읽는다.** 아래 §B 의 결론들은 **폐기됐다** —
그 문장을 어디서 보더라도 다시 집지 않는다.

---

## A. 실험별 사실

| WU | 목적 | 대상/표본 | 측정값 | 결론 | commit |
|---|---|---|---|---|---|
| **ALT-3** | Shopify suggest Discovery | 등록부 11샵 × 원상품 6 | suggest 66/66 성공 · 후보 **148** | 경로 작동 🟢 · 🔴 GT 는 별 단계 | `8a9c1dd5` |
| **ALT-3-GT** | MI SAME/PRESUMED 검증 | 11건 | `SAME` 5/5 → GT SAME · `PRESUMED_SAME` 6/6 → GT DIFFERENT | **False SAME 0** | `76c6d9b6` |
| **ALT-4** | SIMILAR 가 SAME 을 놓치는가 | 30/31 | GT SAME **0** · DIFFERENT 30 | missed-SAME **0** | `180c7082` |
| **ALT-5** | CONFLICT 축 | 30/85 | GT SAME **0** · DIFFERENT 29 · UNVERIFIED 1 | missed-SAME **0** · 🔴 pri1(동일품번)은 **0건** | `0437f872` |
| **ALT-6** | `PRESUMED_SAME` 화면 조사 | 코드 경로 | 표시축 = `productMatchTruth` → `matchLevel` 폴백 | 🔴 일부 결론 **폐기**(§B1) | `6f0bd1a1` |
| **ALT-7** | `productMatchTruth` 공백 원인 | 코드 경로 | 운영 호출부 1곳 · 하니스가 그 단계 누락 | 🔴 일부 결론 **폐기**(§B2·B3) | `320e4703` |
| **ALT-8** | CONFLICT → 🔵 경로 대조 | 2건 | `SAME_MODEL_VARIANT` 2/2 → 🔵 「동일 모델·옵션 다름」 | 신규 문구 **불필요** | `0621f829` |
| **ALT-9** | B10 3건 실제 측정 | 3건 | 🟡 **1** (Rose Shadow) · 🔵 **2** (Conker·Graystone) | 정책 **KEEP** | `ec279b4f` |
| **ALT-10** | `splitModelColor` 분포 | 148 | 색상 미추출 **129/148=87%** · 등급 영향 **4/148=2.7%** | **LOW IMPACT** · 축 닫음 | `f672cba8` |

🟢 참고(ALT 이전 같은 트랙): DDG PoC `50f288a4`(4/6 차단) · DDG GT `a8c6f485`(신규 SAME 6) ·
URL 3층 KPI 규격 `cf225a40` · Non-API Gate `4019e15c`(GO 후보 NONE).

### 🟢 종합 confusion (검증 71건 · 🔴 미측정 축을 0 으로 쓰지 않는다)
| MI 판정 | GT SAME | GT DIFFERENT | UNVERIFIED | 분모 |
|---|---:|---:|---:|---|
| `SAME` | **5** | 0 | 0 | 5 / 5 |
| `PRESUMED_SAME` | 0 | **6** | 0 | 6 / 6 |
| `SIMILAR` | 0 | **30** | 0 | 30 / 31 |
| `CONFLICT` | 0 | **29** | 1 | 30 / 85 |
```
False SAME **0** · missed-SAME **0**(SIMILAR 30 + CONFLICT 30)
🔴 미측정 — CONFLICT 55 · SIMILAR 1 · UNKNOWN 21 · 148 중 GT 미확정 다수
🔴 N=71 · 원상품 6 · 샵 11 → **일반화 금지**
```

---

## B. 🔴🔴 **RETRACTED** — 폐기된 결론(다시 집지 않는다)

```
B1  ALT-6 ❌ 「B10 3건이 모두 🟡 동일상품 추정」
    🟢 실제(ALT-9 측정): **1건 🟡 / 2건 🔵**

B2  ALT-7 ❌ 「`SAME_MODEL_OPTION_DIFF` 에는 `cross=CONFLICT` 가 필요」
    🟢 실제(ALT-8·9 측정): **cross 값은 필수 조건이 아니다.**
       rank(product-identity.ts:143)에서 `SAME_MODEL_VARIANT`(4)가 이기면 🔵 가 된다

B3  ALT-7 ❌ 「색상 데이터 부족은 원인이 아니다」
    🟢 실제: Rose Shadow 의 🟡 는 **제목 형식 + splitModelColor 추출 결과** 의 영향을 받는다
    🔴 단 ALT-10 측정상 **현재 영향도는 낮다**(등급 영향 2.7%)

B4  ALT-5 보고 ❌ 「동일 품번 CONFLICT 2건」
    🟢 실제: 그 2건은 **pri2(브랜드+상품명 강일치)** 이고 **동일 품번 CONFLICT 는 0건**

B5  ALT-3 1차 ❌ 「GT SAME 110 / known-positive 0」
    🟢 실제: suggest URL 이 `_psq` 로 우리 질의를 되돌려 넣어 **GT 가 오염** 됐다.
       title 기준 재계산 → GT SAME **0** · 미검증 148 (WU-007A 와 같은 축)

B6  ALT-3 1차 ❌ 「후보 0 = suggest 로는 못 찾는다」
    🟢 실제: `searchShopifySuggest` 를 **barrel 에서 import** 해 `undefined` 호출 →
       66× TypeError. 운영 코드·엔드포인트는 정상이었다
```

---

## C. 현재 확정 정책 (이 목록이 기준이다)
```
MI threshold                변경 **없음**
색상사전                    변경 **없음**
`PRESUMED_SAME` 정책        변경 **없음**
`SAME_MODEL_OPTION_DIFF`    기존 로직 **유지**
`COMPARISON` → EXACT 승격   **차단 유지**(두 겹 안전장치 · WU-018-P10)
신규 검색 / Registry 확대    **없음**
AI API                      **없음**(키 0 · 비용 ₩0)
DDG 재시도                  **없음**(4/6 차단 실측)
운영(생산) 코드 수정         **없음** — ALT 트랙 전체 합계 **0**
```

---

## D. 🔴🔴 측정 원칙 (다음 세션 최상단)
```
① **복합 owner 의 분기 의미를 코드 독해만으로 확정하지 않는다.**
   실제 운영 입력을 owner 에 넣어 **반환값을 측정한 뒤** 결론을 쓴다.
   (이 트랙에서 추측으로 **세 번** 틀렸다 — §B1·B2·B3)
② 하니스 규칙
   · **barrel export 존재를 가정하지 않는다** — 직접 owner 경로를 확인한다(§B6)
   · **인자 타입을 추측하지 않는다** — `attachProductMatchTruth` 는 `ComparisonSearchResult[]`
     를 받는다. 후보 배열을 넘기면 `status !== "ok"` 에서 **조용히 그대로 반환** 된다
   · 운영 **호출 순서를 그대로** 재현한다(한 단계 빠뜨리면 「값이 없다」로 오독한다)
   · **커밋 전에 typecheck + runtime 출력을 직접 확인** 한다(typecheck 0→3 이 실제로 잡았다)
   · URL 처리는 **기존 owner**(`discoveryUrlRecord`/URL API)만 쓴다 — 직접 정규식 금지
     (`?` 를 지워 전건 404 를 만든 적이 있다)
③ 어휘 — 「Recall」금지 → **known-positive discovery rate** ·
   known-positive 외 후보는 GT 확정 전까지 **미검증 신규 후보** ·
   **MI 판정을 GT 로 쓰지 않는다** · 미측정 축을 **0 으로 쓰지 않는다**
```

🔴 **ALT 트랙은 여기서 닫는다.** 새 측정 필요성이 **실제로** 생길 때만 다음 WU 를 연다.
🔴 **CEO Action: NONE.**
