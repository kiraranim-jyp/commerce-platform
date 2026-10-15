# WU-018 — MI 동일상품 판정 정확도 (URL/fetch 축과 **분리**)

🔴 AI 0 · Gemini 0 · 외부 검색 API 0 · 키 0 · 결제 **₩0** · DB 쓰기 0 · schema 0 ·
UI 0 · threshold 0 · Registry 0 · 새 adapter 0 · 배포 0. 🟡 판매처 GET **12회**.

---

## 1. 실제 테스트셋 — 쌍 **14** (원상품 5 · 후보 URL 11 · 전부 운영 DB 실데이터)

원상품 query 는 운영 owner 로 만들었다(복제 0): `buildProductIdentityDna` →
`productFactsFromIdentityDna` → `withConfidence`(**원상품별 배열 단위 1회**).

| 원상품 | sku | 색상 |
|---|---|---|
| Booty Ghosts Long Sleeve T-Shirt | `B226AC010` | Heather Grey |
| Hug Hairy Monster T-Shirt | `B226AC009` | Light Blue |
| Curious Turnip Swim Cap | `B126AI018` | Green |
| Bubble Sweatshirt (Main Story) | `AW26MS185` | **Grey Melange** |
| Lulu T Bar Shoes (Pèpè) | `01195-VERNICE-NERO` | — |
| B.C. Embossed tracksuit jacket(.co.jp) | 🔴 **없음** | Blue |

## 2. GT — 품번 + 상품명 + 색상 기준 (🔴 `match_truth` 를 쓰지 않았다)

```
EXACT_SAME 6 · SAME_OTHER_MARKET 1 · SAME_BRAND_DIFF_MODEL 3 ·
SAME_MODEL_DIFF_COLOR 2 · SIMILAR 2 · DIFFERENT 1
🟢 「동일상품」으로 세는 GT = EXACT_SAME + SAME_OTHER_MARKET **뿐**
   🔴 색상만 달라도 동일상품이 아니다(테스트가 GT 정의 자체를 잠근다)
```

## 3. MI 결과

| | GT | MI 결과 | |
|---|---|---|---|
| P1 | EXACT_SAME | `SAME` / very_high / 0.97 | 🟢 |
| P2 | SIMILAR | `CONFLICT` / low / 0.45 | 🟢 |
| P3 | SAME_BRAND_DIFF_MODEL | `CONFLICT` / low / 0.3 | 🟢 |
| P4 | DIFFERENT | `CONFLICT` / low / 0 | 🟢 |
| P5 | EXACT_SAME | `SAME` / very_high / 1.0 | 🟢 |
| P6 | SIMILAR (P2 반대 방향) | `CONFLICT` / low / 0.48 | 🟢 |
| P7 | EXACT_SAME | **제외** `UNREACHABLE` | ⚪ |
| P8 | SAME_BRAND_DIFF_MODEL | `CONFLICT` / low / 0.3 | 🟢 |
| P9 | EXACT_SAME (국내 littleluna) | `SAME` / low / 0.66 | 🟢 |
| P10 | **SAME_MODEL_DIFF_COLOR** | 🔴 `PRESUMED_SAME` / low / 0.62 | 🔴 |
| P11 | EXACT_SAME (국내 foretforet) | `SIMILAR` / low / 0.55 | 🟡 |
| P12 | EXACT_SAME (국내 deuxbebe) | `SIMILAR` / low / 0.58 | 🟡 |
| P13 | SAME_MODEL_DIFF_COLOR | `CONFLICT` / medium / 0.78 | 🟢 |
| P14 | SAME_OTHER_MARKET | `PRESUMED_SAME` / very_high / 1.0 | 🟢 |

🟢 **방향 대칭성 확인** — P2 ↔ P6 이 같은 쌍을 뒤집은 것이고 둘 다 `CONFLICT` 다.

## 4. Precision / 5. Recall — 🔴 분모를 같이 적는다

```
MI 분모 13 (facts OK) · 제외 1 (P7 `UNREACHABLE` → **WU-017 축**)
Precision  4/5 = **80%**  (sample N=5)   🔴 거짓 동일상품 **1건**(P10)
Recall     4/6 = **67%**  (sample N=6)   🟡 손실 2건(P11·P12)
```
🔴 **N=5 / N=6 을 「우리 시스템의 정확도」로 일반화하지 않는다.**

## 6·7. 오판 목록과 원인 — 🔴 성질이 **서로 다르다**

### 🔴 P10 — 거짓 동일상품 1건 (**page facts extraction · 색상**)

```
원상품  AW26MS185 Bubble Sweatshirt **Grey Melange**
후보    deuxbebe  「AW26MS185 - Bubble Sweatshirt - **Rose Shadow**」(실측 200 · og:title 그대로)
MI      PRESUMED_SAME / 0.62 · blockers [] · conflicts []
후보 facts  brand 🟢 · brandModelCode 🟢 · **colorText ✗** · categoryText ✗ · titleTokens 5
```
🔴 **원인은 scoring 이 아니다** — 색상 추출기가 그 색을 모른다(실측):
```
extractColorFromTitle("AW26MS185 - Bubble Sweatshirt - Rose Shadow") → undefined
extractColorFromTitle("Bubble Sweatshirt in Grey Melange by Main Story") → "Grey"
extractColorFromTitle("Lulu T Bar Shoes in Tobacco by PèPè") → undefined
```
→ 색상 축이 생기지 않아 **품번 일치만 남고** 「확정 보류(PRESUMED_SAME)」가 됐다.
🟢 MI 는 색상이 다르다는 것을 **알 수 없었다** — 증거가 없었다.

### 🟡 P11·P12 — Recall 손실 2건 (**identity field 부족** · 오판이 아니다)

```
후보 facts  brand 🟢 · **brandModelCode ✗** · colorText ✗ · titleTokens 8 / 3
foretforet 제목의 품번은 **자체 품번** `PP24KASHE1195NER`(원상품은 `01195-VERNICE-NERO`)
```
🟢 즉 **MI 는 증거가 없는데 SAME 을 주지 않았다 = 설계대로** 다. 헌장·메모
(`domestic-discovery-dies-at-low-not-at-search`)의 기존 결론과 **정합** 한다.
🔴 그래서 「MI 오판」으로 적지 않고 **「증거 부족으로 확정 못 함」** 으로 적는다.
🔴 threshold 를 낮춰 SAME 으로 만들지 않았다(CPO·헌장 금지).

### ⚪ P7 — MI 분모 제외 (WU-017 축)

🟢 하니스 결함이 아니다 — 그 URL 은 **실제로 404** 다(직접 GET 확인).
운영 DB 에 링크가 남아 있지만 상품이 사라졌다. 🔴 「MI 가 틀렸다」로 세지 않는다.

## 8. 수정 여부 — 🔴 **하지 않았다 (CPO 판정 사안)**

P10 의 최소 수정 후보는 둘이고 **둘 다 「최소」가 아니다**:
```
⒜ 색상 사전 확장(Rose·Tobacco…) → 🔴 모든 후보의 colorText 가 바뀌어 **전역 판정**
   에 닿는다. 🔴 FP 위험도 있다(「Rose」는 프린트 이름으로도 흔하다).
   🔴 그리고 **반례가 있다** — P13(tobacco)은 색상 없이도 `CONFLICT/medium` 로
      정확히 걸렀다. 즉 「사전을 넓히면 해결된다」가 **증명되지 않는다.**
⒝ 「품번 일치 + 한쪽 색상 미확인」에 보류를 주지 않는다 → 🔴 **판정 정책 변경** 이고
   진짜 동일상품(색상 못 읽는 후보)의 Recall 을 깎는다.
```
🔴 헌장 선례가 같은 방향을 가리킨다 — `compareMaterial` 수정 금지 · pattern/print 축
신설 금지 · 「SAME 문턱에 식별 증거 요구 금지」. **CTO 가 임의로 고르지 않는다.**

🟢 대신 **양방향으로 잠갔다**(묻어 두지도, 영구 FAIL 로 두지도 않는다):
```
KNOWN_FALSE_SAME = ["P10"]
 ① 목록에 없는 새 거짓 동일상품이 생기면 **FAIL**(회귀 방지)
 ② 등록된 오판이 **사라지면 FAIL** → 수정이 들어왔다는 증거(쿠팡 고시 선례와 같은 방식)
```

## 9. 수정 후 재검증 — ⚪ 해당 없음(수정 0). 라이브 재실행 2회 결과 동일.

## 10~13

```
회귀      admin **531 files / 7,785 passed · failed 0**(skipped 50/69)
typecheck admin **0** · crawler **2** = 변경 전과 동일
build     exit **0**
commit    아래 커밋 하나 · main **미반영**(ahead 17 · 머지·배포 0)
CEO Action **NONE**
```
