# WU-022-3 — S4 결측 보완 · 🔴🔴 **022-2 의 결론이 뒤집혔다**

🔴 운영 코드 0 · MI 0 · threshold 0 · 색상사전 0 · `PRESUMED_SAME` 정책 0 · Registry 0 ·
Category/Sourcing 0 · schema 0 · DB 쓰기 0 · AI API 0 · **AI 재검색 0** · 새 검색 0 ·
후보 추가/삭제 **0** · S4 색상 변경 0 · 배포 0. 🟡 후보 GET **37회**(022-2 와 같은 집합).

---

## 1. 🔴🔴 S4 결측의 원인은 «데이터 부재» 가 아니었다 — **내 조회 키가 틀렸다**

지시서는 「S4 원상품을 덤프에 **추가**」로 적혀 있었다. 🔴 **그럴 필요가 없었다.**

```
원상품은 덤프에 **있었다** — id c27d4727
  덤프 source_url
    …/products/bubble-sweatshirt-in-grey-melange-by-main-story**?_pos=1&_sid=a0738e824&_ss=r**
  SEARCH_TARGETS.sourceUrl
    …/products/bubble-sweatshirt-in-grey-melange-by-main-story
🔴 내 다리가 **문자열 완전일치** 로 조회해서 S4 만 통째로 빠졌다(11 후보).
```

🟢 **그리고 그 꼬리는 이 리포가 이미 아는 것이다** — WU-007A 가 다룬 Shopify **검색문맥
`_` 접두 파라미터**(`_pos` · `_sid` · `_ss`) 계열이다.

🟢 **새 규칙을 만들지 않고 기존 owner 를 썼다** — `canonicalizeProductUrl`
(self-reference.ts:167 · WU-009-C). `NON_IDENTIFYING_PARAMS` + `isShopifyContextParam` 만
쓰고 **host·경로·로케일·식별 파라미터는 보존**한다(시장을 뭉개지 않는다).

🔴 **같은 함정이 돌아오지 못하게 단언 3건으로 잠갔다**:
```
① 문자열 완전일치는 **실패한다**(그것이 결측의 원인이었다)
② canonicalizeProductUrl 로 조회하면 **같은 키** 가 된다
③ 로케일(/en-kr/)·경로·`variant=` 는 **보존된다**
```

🟢 결과: **원상품 덤프 누락 0건 · 후보 25 → 36.** 데이터 추가 **0**.

---

## 2. 🔴🔴 그래서 WU-022-2 의 핵심 숫자를 **정정한다**

```
WU-022-2 보고   MI strict  n=17 · Accuracy **1.000** · **False SAME 0** · missed 0
🔴 그 숫자는 **S4 가 빠진 상태의 산물** 이었다. 아래가 맞는 값이다.
```

| 축 | n | Accuracy | Precision(SAME) | **False SAME** | missed-SAME |
|---|---:|---:|---:|---:|---:|
| **MI strict**(PRESUMED_SAME→SAME) | **28** | **0.786** | 0.750 | 🔴 **6** | 0 |
| **MI threeWay**(PRESUMED_SAME→UNCERTAIN) | **28** | 0.750 | 🟢 **1.000** | 🟢 **0** | 7 |

🟢 GT 조인 28 · **거부 0** · 🟢 **gtToken 불일치 0**(세운 GT 가 실제 제목과 전건 일치) ·
미부여 8(UNVERIFIED 2 + UNREACHABLE 6).

---

## 3. searchId 별 — 🔴 **문제는 S4 하나에 몰려 있다**

| S | GT행 | GT SAME | GT DIFF | strict Acc | **False SAME** |
|---|---:|---:|---:|---:|---:|
| S1 | 3 | 3 | 0 | 1.00 | 0 |
| S2 | 5 | 5 | 0 | 1.00 | 0 |
| S3 | 5 | 5 | 0 | 1.00 | 0 |
| **S4** | **11** | 2 | **9** | 🔴 **0.45** | 🔴 **6** |
| S5 | 2 | 1 | 1 | 1.00 | 0 |
| S6 | 2 | 2 | 0 | 1.00 | 0 |

🔴 **S1·S2·S3·S5·S6 은 전부 1.00 이다.** 그리고 S1~S3·S6 은 **GT DIFFERENT 가 0** 이라
「틀릴 기회」가 거의 없던 표본이다 — 🔴 그 1.00 을 성능으로 일반화하지 않는다.
🟢 **DIFFERENT 를 실제로 가른 것은 S4(9건)와 S5(1건)** 이고, S5 는 맞혔다.

---

## 4. 🔴🔴 False SAME 6건 — **전부 S4 · 전부 `PRESUMED_SAME` · 전부 「같은 SKU, 다른 색상」**

원상품 S4 = Main Story Bubble Sweatshirt **Grey Melange**(AW26MS185).

| 모델 | 관측 제목 | GT | MI raw | strict |
|---|---|---|---|---|
| claude | Bubble Sweatshirt in **Blue Topaz** | DIFFERENT | 🟢 CONFLICT | DIFFERENT |
| claude | Bubble Sweatshirt in **Grey Melange** | SAME | 🟢 SAME | SAME |
| claude | Bubble Sweatshirt in **Chocolate Brown** | DIFFERENT | 🟢 CONFLICT | DIFFERENT |
| claude | Bubble Sweatshirt in **Conker Stripe** | DIFFERENT | 🔴 **PRESUMED_SAME** | **SAME** |
| claude | Bubble Sweatshirt in **Graystone** | DIFFERENT | 🔴 **PRESUMED_SAME** | **SAME** |
| gemini | 도노키즈 `_Grey Melange #AW26MS185` | SAME | PRESUMED_SAME | SAME |
| gemini | 도노키즈 `_Conker Stripe #AW26MS185` | DIFFERENT | 🔴 **PRESUMED_SAME** | **SAME** |
| gpt | 리틀루나 `AW26MS185 - Graystone` | DIFFERENT | 🔴 **PRESUMED_SAME** | **SAME** |
| gpt | 미니부띠끄 `AW26MS185 - Graystone*` | DIFFERENT | 🔴 **PRESUMED_SAME** | **SAME** |
| gpt | main-story 공식 `Graystone` | DIFFERENT | 🔴 **PRESUMED_SAME** | **SAME** |
| gpt | main-story 공식 **Rose Shadow** | DIFFERENT | 🟢 CONFLICT | DIFFERENT |

### 🟢 읽어야 할 셋

```
① 🟢 **MI 는 색상을 «보긴» 한다** — Blue Topaz · Chocolate Brown · Rose Shadow 는
   **CONFLICT**(정답)를 냈다. 색상 축이 죽어 있는 것이 아니다.
② 🔴 **갈리는 색상이 둘이다** — `Conker Stripe` 와 `Graystone` 에서만 PRESUMED_SAME 이 나왔다.
   🔴 원인은 **조사하지 않았다**(색상사전 변경 금지 · §지시서). 「색상 사전에 없다」로 **단정하지 않는다**.
③ 🟢🟢 **threeWay 축에서는 False SAME 이 0 이다.** 즉 현재 정책(PRESUMED_SAME 을 확정으로
   올리지 않는 것)이 **이 실패모드를 정확히 막고 있다.**
   🔴 그러므로 「PRESUMED_SAME 을 SAME 으로 승격」은 **이 데이터가 반대한다.**
```

🟢 **019A 의 B10(SAME_MODEL_DIFF_COLOR → PRESUMED_SAME 0.78 → GT DIFFERENT)이 n=1 로
보여 준 것을 이번에 n=6 으로 재현했다.** 두 측정이 독립적으로 같은 곳을 가리킨다.

---

## 5. 모델별 — 🔴 **MI 의 정확도이지 AI 의 정확도가 아니다**

| 모델 | GT행 | GT SAME | GT DIFF | strict Acc | False SAME |
|---|---:|---:|---:|---:|---:|
| claude | 13 | 9 | 4 | 0.85 | 2 |
| gemini | 6 | 5 | 1 | 0.83 | 1 |
| gpt | 9 | 4 | **5** | 0.67 | 3 |

🔴 **이 표로 모델 우열을 말하지 않는다.** ⒜ 분모가 다르다(13 / 6 / 9) ⒝ **난이도가 다르다** —
gpt 의 표본은 GT DIFFERENT 가 5/9 로 「틀리기 쉬운」 후보를 많이 가져왔다 ⒞ 이 Accuracy 의
주어는 **MI** 다. AI 가 판정한 것이 아니다.
🟡 말할 수 있는 것은 하나 — **gpt 가 색상만 다른 후보를 가장 많이 끌고 왔다**(그래서 MI 의
약점이 그 표본에서 더 드러났다).

---

## 6. Discovery (022-2 와 동일 · 재실행 0)

```
claude 후보 17 · known-positive 🟢 **2/5** · 미검증 신규 15
gemini 후보  9 · known-positive 0/5 · 미검증 신규 9
gpt    후보 10 · known-positive 0/5 · 미검증 신규 10
🔴 outcome 18/18 UNLABELED — 수집이 접두사 규격을 안 지켜 **검색실패 ↔ 후보없음을 못 가른다**
```

🟢 **신규 true-SAME 재집계** — GT SAME 고유 16건(기존 14 + S4 2) 중 019A known-positive 는
**2건** → **신규 true-SAME 14건**. 🔴 단 §0(WU-022-2)의 전제가 그대로 붙는다 — **품번을
주고 찾은 결과** 이고 「URL 만 주고 찾기」는 미측정이다.

---

## 7. 판정

```
MI strict     🔴 Accuracy **0.786** · **False SAME 6** — 022-2 의 1.000 은 **S4 결측의 산물**
MI threeWay   🟢 **False SAME 0** · Precision **1.000** · Accuracy 0.750(보류 7건)
AI Discovery  🟢 작동 — 신규 true-SAME **14건**
AI Identity   🔴 **측정불가**(세 단어 verdict 미수집) · AI vs MI 🔴 **미결** · Combination 🔴 **미결**
```

🔴🔴 **일반화 금지** — 원상품 6건 · 후보 36 · GT 28. 그리고 **AI 가 품번으로 찾아온 후보**
라는 선택 편향이 있다(CPO 지적 그대로).

🔴 **이번 데이터로 바꾸지 않은 것**: threshold · 색상사전 · `PRESUMED_SAME` 정책 ·
ensemble · GT · 표본 · 후보 집합 · Category/Sourcing · 운영 코드. **전부 0.**

## 8. 다음에 열리는 선택지 (CTO 가 고르지 않았다)

```
⒜ AI Identity 2차 수집(세 단어) → AI vs MI / Combination 이 열린다 ← 지시서가 예고한 다음 단계
⒝ 🔴 `Conker Stripe` · `Graystone` 이 왜 CONFLICT 가 아닌지 **조사**(변경 아님) —
   False SAME 6건이 전부 그 둘이다. 🔴 색상사전 수정은 금지 구간이라 조사만 가능하다
⒞ 현상 유지 — threeWay 축이 이미 False SAME 0 이므로 **운영 기본값은 안전하다**
```
