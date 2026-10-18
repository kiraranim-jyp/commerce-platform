# WU-072 — 국내 COLOR 부재 × L4 위험 정량화 + 숫자시작 SKU (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「L4 구현이 아니라 **국내 시장에서 L4 가 왜 위험한지 최종 수치화**」
> 「색상 추출기를 개선하지 않는다 — **이미 존재하는 evidence 를 측정만** 한다」

---

## 0. 결론 — 🔴 **L4 종료 · 숫자시작 SKU 도 효과 0**

```
① 국내 17건 중 **구조화 색상이 있는 것은 1건** 이다(C08 JSON-LD 「블루」).
   🔴 그리고 microdata 색상 「0」은 **「없어서」가 아니라 「읽는 코드가 없어서」** 다.
② 국내에서 L4 는 **아무것도 바꾸지 않는다**(네 모드 전부 EXACT 1 · SAME 0 · DIFFERENT 1).
   🔴 그 이유는 안전해서가 **아니라** 조건 ③(`!colorUnverified`)에 **14/17 이 막혀서** 다.
🔴🔴 그리고 국내/한국계 현재 EXACT **1건이 Human DIFFERENT** 다(C06) — **국내 precision 0/1**.
③ 「숫자 시작 slug 는 품번으로 쓰지 않는다」 → **S2-4 가 회복되지 않는다.**
   전체 GT·파생·precision·recall **전부 불변**. 🟢 잃는 것도 0 · 🔴 얻는 것도 0.
⟹ **L4 종료 권고** · ③은 **단독으로는 무의미**(별 WU 로도 가치 낮음)
```

---

## 1. ① 국내 color evidence — **소스별 분해** (17건 · 캐시 HTML)

| 소스 | 있음 |
|---|---|
| `colorText`(운영 결과) | **3/17** — C06 · C28 · C32 · 🔴 전부 **제목에서** 뽑힌 것 |
| **JSON-LD `color`** | **1/17** — C08 `블루` |
| **microdata** | 🔴 **미지원** — 읽는 칸 자체가 없다(Product scope 도 0건) |
| `og:color` / `product:color` | **1/17** — C08 |
| `itemprop="color"` | **0/17** |
| 「색상/컬러」 **문자열** | **10/17** 🔴 **산문 안** 이다 |
| 🔴 **구조화 색상이 하나라도** | **1/17** |

🔴🔴 **WU-064 의 「전건 null」보다 정확한 그림이다**:
```
`colorText` 는 **3건 있다**(제목 유래) — 「전건 null」은 **국내 버킷 5건** 기준이었다
구조화 색상은 **1건** 뿐이고, 색상 «글자» 는 10건에 있지만 **산문** 이다
   (biskuit 8회 · biskuit 7회 · littleluna 4회 · luksusbaby 3회 …)
```

🔴 **그리고 측정 중에 결함을 하나 더 찾았다** — `ExtractedProductData` 에 **`color` 칸이 없다.**
처음에 `extractMicrodataFromHtml(html)?.color` 로 읽었다가 **typecheck 가 잡았다**
(이 트랙 **14번째** 칸 이름 추측 오류). 🟢 그래서 「microdata 색상 0」은
**「페이지에 없다」가 아니라 「우리가 읽지 않는다」** 로 적어야 한다.

---

## 2. ② 국내 L4 counterfactual — 국내/해외 분리

| 모드 | 국내 EXACT | 해외 EXACT | 파생 EXACT |
|---|---|---|---|
| Baseline | **1** (SAME 0 · 🔴 DIFF **1**) | 15 (SAME 14 · DIFF 1) | 0 |
| **L4** | **1** (SAME 0 · DIFF 1) | 18 (SAME 17 · DIFF 1) | **0** |
| L4 − COLOR | **1** (불변) | 19 (SAME 17 · 🔴 DIFF **2**) | 🔴 **11** |
| L4 − CATEGORY | **1** (불변) | 18 | 🔴 **1** |

```
🔴 국내 17건의 `colorUnverified`: **14/17**
⟹ L4 조건 ③(`!colorUnverified`)을 통과하는 국내 후보: **3건** 뿐이고
   그 셋 중 CONFLICT+MODEL_CODE뿐+같은브랜드 를 동시에 만족하는 것은 **0건** 이다
```

🔴🔴 **그래서 「국내에서 L4 가 안전하다」가 아니다 — 「국내에서 L4 가 발화하지 못한다」 다.**
색상이 복구되면 조건 ③이 열리고, 그때 국내는 **해외와 같은 구조**가 된다
(해외에서는 COLOR 를 빼는 순간 **12건**이 뚫렸다 · WU-071).

### 🔴🔴 그리고 더 나쁜 사실 하나

```
국내/한국계 **현재** EXACT 는 **1건** 이고 그것이 **Human DIFFERENT**(C06 trenbe) 다.
⟹ 국내 precision = **0/1 = 0%** · 국내 Human SAME 중 EXACT 도달 **0건**
🔴 즉 국내 가격 비교는 지금 «동일상품 가격» 을 **한 건도 올바르게** 내지 못하고 있다.
```

---

## 3. ③ 숫자 시작 SKU counterfactual

```
변경안   `extractCodeLikeSlugSegment` 결과가 **숫자로 시작하는 slug** 에서 왔으면 품번으로 쓰지 않는다
```

| | 전 | 후 |
|---|---|---|
| 품번이 바뀌는 후보 | — | **1건** — S2-4 kids21 `700005621LBL` → `null` |
| **S2-4 tier** | EXCLUDED | 🔴 **EXCLUDED** (회복 **안 됨**) |
| 전체 GT EXACT | 16 (SAME 14 · DIFF 2) | **16 (14 · 2)** |
| 파생 135 EXACT | 0 | **0** |
| precision / recall | 87.5% / 37.8% | **87.5% / 37.8%** |

🔴🔴 **S2-4 가 회복되지 않는 이유**: 품번을 `null` 로 만들어도 **cross-seller 가 여전히
`conflicts [MODEL_CODE]` 를 낸다.** slug 가드는 `deriveMatchTruth` 입력만 바꾸고
`compareCrossSellerProducts` **내부의 품번 비교는 바꾸지 않는다** — 삼중 잠금의 ①이 그대로다.

```
🟢 **잃는 것 0** — 바뀌는 후보가 kids21 3건뿐이고 진짜 품번(bobochoses 10건)은 불변이다
🟢 **기존 DIFFERENT 보호 손실 0** · 파생 135 영향 0
🔴 **얻는 것도 0** — 단독으로는 무의미하다
⟹ 별 WU 로 분리할 가치도 **낮다**. cross-seller 쪽까지 함께 고쳐야 의미가 생긴다.
```

---

## 4. 회귀 / Mutation

**Mutation** — baseline **2 passed**
| | 변형 | 결과 |
|---|---|---|
| Z1 | `COLOR` 충돌 push 제거 | 🔴 **2 failed** |
| Z2 | slug 추출 전면 무력화 | 🔴 **1 failed** |
| — | 원상복구 | 🟢 **2 passed** |

**전체 회귀** — 🔴 CPO §10 포착 장치 적용
```
apps/admin  **578 files / 8,263 passed** / failed **0** (skipped 95)
포착된 실패명 **없음** · typecheck **0** · build **exit 0**
🔴 typecheck 가 한때 **1** 이었다(위 §1 의 `color` 칸 추측) — baseline 과 **비교해서** 잡았다
🟢 WU-071 baseline(577/8,262)에서 **+1 file / +1 test** — 이 WU 의 신규 계약뿐이다
```

🔴 금지 준수 — 운영 코드 변경 **0** · L4 0 · COLOR 완화/신규 source 0 ·
`compareModelCode` 0 · `crossSellerReserved` 우회 0 · CF-2 0 · `bbambam`/soft-404 미접촉.

---

## 5. 두 안건의 GO/HOLD/REJECT 근거

| 안건 | 근거 | 판정 |
|---|---|---|
| **L4** | 해외에서 COLOR 를 빼면 12건 뚫림(WU-071) · **국내는 COLOR 가 1/17** · 국내에서 L4 는 **발화하지 못할 뿐** 안전한 것이 아니다 · 색상 복구와 결합하면 해외와 동일 위험 | 🔴 **REJECT(종료)** |
| **숫자시작 SKU** | S2-4 **회복 안 됨** · 전체 지표 **전부 불변** · 잃는 것 0 · 얻는 것 0 | 🔴 **REJECT(단독 무의미)** |

🟢 **CPO §4 의 전략 고정 문장을 그대로 채택한다**:
> **품번 충돌 보호를 완화하는 대신, 국내 가격 비교 recall 은 다른 축에서 해결한다.**

---

## 6. 🔴 Known Unknowns

```
① 🔴 **국내 EXACT 가 0 인 것이 아니라 «1건인데 그것이 틀렸다»** — precision 0/1.
   분모 1 이라 「국내 precision 0%」를 전략 숫자로 쓰지 않는다
② 🔴 색상 「산문 10/17」을 구조화로 바꾸는 경로는 **WU-047 이 HOLD** 한 자리다
③ 🔴 `extractMicrodataFromHtml` 이 색상을 안 읽는 것이 **의도인지 누락인지** 미확인
④ 🔴 국내 표본 17건 · 브랜드 2곳 — 전수 498 값이 아니다
⑤ 🔴 ③의 「잃는 것 0」은 **N=13 · 브랜드 2곳** 에서만이다
```

---

## 7. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지
```

## 8. CEO Action — **없음**

---

## 9. 🟢 다음 축 제안 (CPO 판단용 · CTO 가 고르지 않았다)

L4 가 종료되므로 국내 recall 은 **다른 축**이어야 한다. 이 트랙에서 측정된 것만 적는다:

```
🔴 이미 기각된 것 — 색상사전 확대(효과 0) · meta description 색상(단독 효과 0) ·
   NO_TITLE_OVERLAP 완화(효과 0) · crossSellerReserved 우회(precision 55.6%) ·
   L4(국내 발화 0 · COLOR 단독 하중) · 숫자시작 SKU(효과 0)
🟡 아직 재지 않은 것 — ⒜ 국내 후보 **발견량** 자체(현재 17건이 전부인가)
   ⒝ 한국어↔영어 **음역 매칭**(WU-064 가 「범위 밖」으로 남긴 축)
   ⒞ soft-404/목록 URL 이 후보 목록을 **오염** 시키는 문제(WU-067 에서 관측만)
```
