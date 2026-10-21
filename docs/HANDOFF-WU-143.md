# 🟡 WU-143 — **상품 동일성 표현력 보강** (조사 2건 완료 · 🔴 CEO 정책 확인에서 막혔다)

> 🔴🔴 **운영 변경 0** · threshold 0 · 8축 0 · UI 0 · 새 규칙 0.
> 측정 하니스 하나(`wu-143-domestic-brand-signal.test.ts` · `WU_143_PROBE=1` · 회귀 SKIP).
>
> 🔴 CPO 지정 범위 — ① CHILD↔BABY / MODEL_CODE ② 국내 BRAND_UNCONFIRMED
> ③ 2상품 counterfactual ④ Precision/DIFFERENT 방어 확인.
> 🟢 **①②는 답이 나왔다.** 🔴 **③④는 ①의 정책 질문이 닫히기 전에는 의미가 없다**(사유 §3).

---

## ① CHILD↔BABY / MODEL_CODE — 🔴🔴 **MI 결함이 아니라 «CEO 지시 충돌» 이다**

### Q1. AC ↔ AB 품번 차이는 동일 상품의 라인/표기 차이인가?

```
관측(WU-142 STEP C · 운영 추출값)
  원상품 B226AC010 · 제목 "Booty Ghosts T-shirt"
     ↔ bobochoses  **B226AB046** · 제목 "Booty Ghosts T-shirt"          🟢 제목 동일
  원상품 B226AC009 · 제목 "Hug Hairy Monster T-shirt"
     ↔ bobochoses  **B226AB040** · 제목 "Hug Hairy Monster T-shirt"      🟢 제목 동일
     ↔ junioredition **B226AB040** · "Hug Hairy Monster **Baby** T-Shirt" 🟢 같은 그래픽
```
🔴 **번호 변환 규칙은 없다**(WU-070 실측 그대로 · AC009↔AB040 차 **31** · AC010↔AB046 차 **36**).
⟹ 🔴 **품번만으로는 AC↔AB 가 같은 상품인지 판단할 수 없다.** 품번 축을 비차단하면 동일성
판단이 **나머지 축(제목·색상·소재·상품군·대상)에 전적으로 의존** 한다.
🟢 그런데 **제목이 같다** — 즉 사실관계로는 「같은 그래픽의 BABY판」이 맞다.

### Q2. CHILD↔BABY 를 어떻게 구별하는가 → 🔴🔴 **코드가 이미 정책을 적어 뒀다**

`packages/crawler/src/comparison-search/cross-seller.ts:347-374` 원문:

> `MATCHING-3.2-B(CEO 지시, 2026-09-14)` — 「… 같은 그래픽의 BABY판과 CHILD판은
> **다른 상품이 맞지만**, 그 둘을 "충돌"로 선언할 만큼 원문이 늘 명확하지는 않다
> (**증거 존재율 46.8%**, 실측). 그래서 **SAME 으로 올라가는 것만 막고** CONFLICT 로는
> 내리지 않는 보류에 둔다.」

🔴🔴 **그래서 이것은 버그가 아니다 — 설계된 정책이고, 그 전제가 「BABY판 ≠ CHILD판」이다.**

🔴🔴 **그런데 CEO 육안 GT(2026-10-19 · WU-112)는 그 반대를 라벨했다**:
```
b226ab046(BABY)            → **SAME**
b226ab040(BABY) ×2         → **SAME**
billsstore "… T-Shirt Baby" → **SAME**
cissywears "Baby Hug …"     → **SAME**
⟹ CHILD↔BABY 5건 전부 SAME
```
🟡 그리고 **반대 1건** — `tinyapple` 「Baby Booty Ghosts **sweatshirt**」는 human **DIFFERENT**
이고 `GARMENT_FORM`(SHIRT↔SWEATSHIRT)이 **동반** 한다.

### ⟹ 🔴 이 WU 는 여기서 **STOP** 이다 (§3 「정책 결정 필요」)

```
2026-09-14 CEO 지시  「BABY판과 CHILD판은 다른 상품이 맞다」  → AUDIENCE_LINE 축 신설
2026-10-19 CEO 라벨  그 유형 5건을 **전부 SAME**
⟹ 🔴 **CEO 지시 둘이 서로 충돌한다.** CTO 가 어느 쪽으로도 구현할 수 없고,
   counterfactual 을 돌려도 그 충돌이 해소되지 않는다(숫자가 정책을 고르지 못한다).
```
🔴 **CTO 가 축을 열지 않았다.** CPO/CEO 가 아래 한 문장을 닫아야 한다:

> **「같은 그래픽의 BABY 라인과 CHILD 라인은 셀러에게 «같은 상품» 인가?」**

🟢 닫히는 방향에 따라 다음 작업이 **완전히 갈린다**:
```
⒜ 「같은 상품이다」   → AUDIENCE_LINE 보류를 조건부로 해제 + MODEL_CODE 의 AC↔AB 를
                      «라인 차이» 로 해석. 🟢 이 표본에서 막아야 할 DIFFERENT 는
                      `GARMENT_FORM` 과 `COLOR` 가 **이미 동반해서** 막는다(§③ 설계 참고)
⒝ 「다른 상품이다」   → 🔴 recall 6/19 중 **5건은 영구 손실이고 그것이 정답** 이다.
                      그러면 남은 축은 국내 BRAND 뿐이고 그것도 ② 에서 NO-GO 다
                      ⟹ **MI recall 작업 자체가 닫힌다**
```

---

## ② 국내 BRAND_UNCONFIRMED — 🔴 **NO-GO (측정 결과 신호가 없다)**

실측(HTTP 200 · 두 페이지 전수 · 네 자리만 읽었다 · 추론 0):

| 자리 | `www.beaumonde.co.kr` | `biskuit.kr` |
|---|---|---|
| JSON-LD `Product.brand` | **없음** | 🔴 `["비스킷" ×4]` |
| JSON-LD `Organization.name` | **없음** | **없음** |
| `og:site_name` | **없음** | 🔴 `["비스킷"]` |
| `meta product:brand` | **없음** | **없음** |
| **브랜드를 직접 말하는 자리** | **0** | **0**(있는 것은 전부 샵 이름) |

🔴🔴 **WU-134 의 복구 조건이 둘 다 성립하지 않는다** — 그 방식은
「`og:site_name` == JSON-LD `Organization.name`」이 **같을 때만** 발화한다.
```
beaumonde  두 자리 **모두 없음**           ⟹ 발화 불가
biskuit    og:site_name 있으나 Organization.name 없음 · 그 값이 **샵 이름("비스킷")**
           ⟹ 🔴🔴 그대로 적용하면 **"비스킷"을 브랜드로 «확정»** 한다.
              현재 `BRAND_MISMATCH`(거짓 신호지만 보수적)가
              **「확정된 잘못된 브랜드」** 로 **악화** 된다 — WU-080 이 계약으로 잠근 축이다
```
🟢 ⟹ **CPO 의 「shop name fallback 금지」는 이 데이터에 정확히 근거한다.**

🟡 남는 자리는 **제목** 하나다(둘 다 제목에 「보보쇼즈」 + 품번).
🔴 그러나 ⒜ 제목에서 한글 브랜드를 긁는 것은 **새 추출 규칙** 이고
⒝ biskuit 제목은 `[보보쇼즈] … - 비스킷` 로 **브랜드와 샵 이름이 같은 문자열에 둘 다** 있어
**어느 쪽을 고를지 규칙이 필요** 하며 ⒞ WU-080 이 REJECT 한 축과 인접하다.
⟹ 🔴 **CTO 가 구현하지 않았다. CPO 판정 사안이다.**

---

## ③④ counterfactual — 🟢 설계는 확정했다 · 🔴 **①이 닫히기 전에 돌리지 않는다**

🔴 **입력 조작 방식은 쓸 수 없다**(이번에 확인):
```
MODEL_CODE  🟢 가능 — 후보 품번을 원상품 것으로 바꾸면 충돌이 사라진다(WU-134 선례)
AUDIENCE_LINE 🔴 **불가** — 그 축의 입력은 `audienceSignals + categoryText +
              ageRangeText + **title**`(cross-seller.ts:379-384)이다.
              "baby" 를 지우려면 **제목을 건드려야** 하고 그러면 TITLE 축이 같이 움직인다
              ⟹ 두 축이 동시에 바뀌어 **무엇이 효과인지 가를 수 없다**
```
🟢 **그래서 규칙 수준 counterfactual 이 맞고, 그 재료는 이미 반환된다** —
`compareCrossSellerProducts`(cross-seller.ts:738)가 `{verdict, axes, conflicts, blockers,
identifierConfirmed, reasons}` 를 돌려주고, 판정 규칙은 **1077-1081 네 줄** 이다:
```ts
const blocked = blockers.length > 0;
if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME";
if (totalPoints >= PRESUMED_SAME_MIN_AXES && !sameSellerWithoutIdentity) return "PRESUMED_SAME";
```
🔴 단 `corePoints` · `brandOk` · `sameSellerWithoutIdentity` 는 **반환되지 않는다**
⟹ 🔴 복제식이 필요하고, 그러면 **§5-B 절차가 강제** 된다:
```
ownerGate        운영 verdict == 복제식 verdict
replicationGate  27건 전수 재현 · expect(mismatch).toBe(0)   ← 🔴 이것이 통과한 «뒤에만»
                 counterfactual 숫자를 쓴다
CONTROL          「돌았다」가 아니라 **운영이 낸 그 verdict 가 재현된다**
```
🟢 돌릴 CF 는 넷이다(①이 ⒜로 닫히면):
```
CF-1  blockers 에서 AUDIENCE_LINE 만 제거                     → SAME +? · DIFF leak ?
CF-2  conflicts 에서 MODEL_CODE 를 **AC↔AB 한정** 으로 제거     → junioredition AC141 은 **제외**
CF-3  CF-1 + CF-2                                            ← CPO 가 말한 「하나의 문제」
CF-4  CF-3 **+ GARMENT_FORM 은 그대로 둔다**                   ← tinyapple sweatshirt 방어 유지
🔴 전건을 **human SAME 과 DIFFERENT 둘 다** 에 적용한다(leak 를 못 세면 측정이 아니다)
🔴 성공 조건(CPO) — precision 유지 · **DIFFERENT leak 0** · recall > 6/19.
   단 한 건이라도 새면 **실패** 다.
```

---

## 🔴 이번에 내가 틀린 것 셋 (전부 적는다)

```
⒜ 🔴🔴 **URL 을 지어냈다** — biskuit 주소를 `/product/detail.html?product_no=1902` 로
   추측해 박았다(실제는 Cafe24 한글 slug `/product/보보쇼즈-…-b226ac009/8891/…`).
   🟢 GT 와 대조해 **실행 전에** 잡았고, 하니스를 **GT 에서 URL 을 읽도록** 바꿨다
   (지어낼 자리를 없앴다). 🔴 beaumonde 는 우연히 맞았다 — 「맞았으니 괜찮다」가 아니다.
⒝ 🔴🔴 **운영 MI 파일을 쉘로 편집해 망가뜨렸다** — `cross-seller.ts` 에 날것 NUL 바이트가
   4개 있어 `grep` 이 그 파일을 **binary 로 보고 조사를 막았다**(WU-045 `7607fb4b` 부터).
   `perl -pe 's/\x00/\\u0000/g'` 로 고치려 했더니 **리터럴 `0000` 이 박혔다**
   (= 구분자가 NUL 에서 문자열 "0000" 으로 바뀌는 **실제 동작 변경**).
   🟢 출력을 눈으로 확인해 즉시 되돌렸다(`git status` 깨끗 · NUL 4개 복구 확인).
   🔴 헌장이 「정규식을 쉘/파이썬으로 편집하지 않는다」고 적어 둔 그 함정을 **그대로 밟았다**.
   ⟹ 🟡 **남은 사실** — 그 파일은 여전히 `grep` 에 안 보인다. 조사할 때 `sed`/`node`/Read 로 읽는다.
      🔴 2바이트 복구는 **CPO 범위 밖** 이라 하지 않았다(비기능적 이유로 MI 코어를 건드리지 않는다).
⒞ 🔴 「소스 계약이 이 파일을 못 본다」고 과장했다 — `readSourceAt`+`includes()` 는 **정상 동작**
   하고 `git diff` 도 **정상** 이다(실측). 깨지는 것은 **`grep`/ripgrep 뿐** 이다.
```

---

# 🟢🟢 STEP 2 실행 완료 — **counterfactual 측정됐다 (GO 모양)** · 🔴 구현은 하지 않았다

🔴 **운영 코드를 임시 변경해 «실제 엔진» 으로 쟀다**(복제식 0 · §5-B 위증 경로 제거).
🟢 측정 후 **전부 되돌렸다** — `CF-MARKER-WU143` 잔재 0 · NUL 4 복구 · MI 테스트 714 passed.

## 측정한 변경 셋 (CF-ALL · 셋 동시)
```
C1  AUDIENCE_LINE mismatch → blocker 를 **밀지 않는다**     (cross-seller.ts:934)
C2  MODEL_CODE conflict    → conflict 를 **밀지 않는다**     (:821)
C3  modelCode === "exact"  → **brandKnown/brandOk 를 충족**  (:751-752)
    🔴 C3 의 근거 — 후보 페이지가 **원상품의 브랜드 품번을 글자 그대로** 들고 있으면
       그것은 브랜드 문자열보다 **강한** 브랜드 증거다(`confirmBrandCodeInEvidence` 와 같은 축).
       🔴 「샵 이름 = 브랜드」가 **아니다**(CPO 금지축을 건드리지 않는다).
```

## 결과
```
            recall      오포함(DIFFERENT 누출)
baseline    **6/19**    **0 / 0**
CF-ALL      **9/19**    **0 / 0**   🟢🟢 CPO 절대조건 충족
```
```
S2 B226AC009 🌎 해외 SAME **3 → 5** · 가격확인 3 → 5
   기준가 USD 58 → **GBP 33 · SGD 70 · USD 58**
   새로 진입 — junioredition(AB040 · GBP 33) · kids21(샵 SKU · SGD 70)
S1 B226AC010 beaumonde **SAME 이 됐다**(C3 발화) 🟢
🟢 방어가 예측대로 독립적으로 버텼다 —
   junioredition **AC141**(human DIFFERENT) → **COLOR 충돌** 이 막았다
   tinyapple **Baby sweatshirt**(human DIFFERENT) → **GARMENT_FORM** 이 막았다
🔴 새 깊이방어가 드러났다 — `bobochoses.com`(AB046/AB040)은 MODEL_CODE 가 사라지자
   **`SAME_SELLER_DISTINCT_LISTING`** 이 대신 막았다(같은 판매처의 다른 리스팅 가드).
   ⟹ CEO 가 SAME 이라 한 그 2건은 **여전히 SAME 이 아니다**
```

## 🔴🔴 그런데 CPO 의 성공 기준 「🇰🇷 SAME ≥ 1」은 **두 상품 모두 미달** 이고, 이유가 MI 밖이다
```
B226AC009 🇰🇷  biskuit — C3 로 BRAND_MISMATCH 는 사라졌다. 🔴 남은 것 둘:
              ⒜ `NO_TITLE_OVERLAP` blocker (**CPO 금지축**)
              ⒝ corePoints **4** < SAME_MIN_AXES **5**
                 (품번 3 + 상품군 1 — 제목 겹침 0 · 색상 없음 · 소재 없음 · 대상 없음)
              ⟹ 🔴 threshold 를 내리지 않으면 **구조적으로 불가** 하다
B226AC010 🇰🇷  beaumonde — 🟢 **SAME 은 됐다**. 🔴 그런데 **가격이 없어** `.kr` + 통화없음 →
              `classifyCandidateMarket` 가 **UNKNOWN** 을 낸다(WU-020 계약: 통화 단독 결정 금지)
              ⟹ 🔴 `selectMiSameCandidates(rows,"KR")` 가 `market==="KR"` 을 요구해 **🇰🇷 에 안 선다**
              ⟹ 막는 것은 **MI 가 아니라 가격 축** 이다(§00-B 보류)
```
🟢 즉 **MI recall 은 올라갔는데(6→9) 🇰🇷 블록은 0 이다.** 그 0 의 이유가 이번에 **둘로 갈렸다**:
`biskuit` = 축 수 + 금지축 · `beaumonde` = **가격 부재**.

## 🔴 그래서 CF-ALL 을 «그대로» 구현하지 않았다 (CTO 판단 아님 · 범위 문제)
```
🔴 C2 는 **MODEL_CODE conflict 전면 비활성화** 다 — CPO 가 승인한 것은
   「품번이 다르더라도 전체 증거가 지지하면 SAME」이고, **「AC↔AB 한정」** 을 명시했다
   (「`B226AC141` 같은 케이스는 반드시 DIFFERENT 방어로 유지」).
🔴 전면 비활성화는 WU-069/070 이 **더 큰 GT(51·63쌍)에서 「품번 보호 해체」** 로 측정한 그것이고,
   이번 분모는 **19 SAME / 6 DIFFERENT** 다 ⟹ 이 표본의 leak 0 으로 전면 해제를 정당화할 수 없다.
🟢 **범위를 좁힌 C2' 가 필요하다** — 「같은 시즌 접두를 공유하고 **라인 문자에서** 갈리는
   경우에만 conflict 를 내리지 않는다」(AC↔AB 는 index 5 에서 갈리고 AC010↔AC141 은 index 6).
   🔴 그것은 `compareModelCode` 에 **라인 구조 해석을 새로 넣는 것** 이고,
      WU-070 이 「라인 코드를 보는 코드는 없다」고 적은 자리다 ⟹ **새 규칙** 이다.
```

## 🟡 다음 세션이 준비 없이 이어갈 좌표
```
① C3 는 **단독으로 안전해 보인다** — beaumonde SAME · biskuit BRAND_MISMATCH 해소 · leak 0.
   🔴 단 C3 단독 측정을 **따로 돌리지 않았다**(CF-ALL 로만 쟀다) ⟹ 먼저 C3 단독 CF 를 돌린다.
   🔴 그리고 `m.luxboy`(품번 exact · human DIFFERENT)가 C3 로 brandOk 를 얻는다 —
      이 표본에서는 `NO_TITLE_OVERLAP` 이 막았다. 그 의존을 계약으로 적어야 한다.
② C2' (AC↔AB 한정)는 **설계가 필요하다** — 위 「index 에서 갈린다」가 유일한 관측 기준이고
   표본은 **3건** 이다(AB046 · AB040 ×2). 🔴 과적합 위험을 CPO 가 판정해야 한다.
③ `SAME_SELLER_DISTINCT_LISTING` — bobochoses 2건은 그 가드가 막는다.
   🔴 그 가드는 **이중 잠금의 한 겹**(WU-059 계약)이라 건드리면 다른 보호가 같이 열린다.
④ 🇰🇷 목표는 **MI 로 닫히지 않는다** — beaumonde 는 **가격**, biskuit 은 **축 수**다.
```

---

# 🔴🔴🔴 STEP 3 결과 — **네 변경을 전부 재고 전부 되돌렸다 (구현 0)**

🟢 회귀 **621 files / 8,664 passed · 0 failed** · typecheck **0** · 운영 동작 **0 변화**
(남긴 것은 **주석과 계약** 뿐 · `codeEvidence` 는 기존 호출을 hoist 한 것으로 동작 동일).

## 2상품 GT 만 보면 전부 GO 로 보였다 — 🔴 그게 함정이었다
```
C1 AUDIENCE_LINE 비차단 + C2 MODEL_CODE 비충돌 + C3 품번 exact⟹brandOk
   → recall **6/19 → 9/19** · DIFFERENT leak **0 / 0**
C4 `.kr`+가격없음 ⟹ KR  → 🇰🇷 「동일상품 1곳 · 가격 확인 필요 1곳」 (CPO P2/P3 달성)
```
🔴🔴 **그런데 전체 회귀가 넷 다 막았다**:

| 변경 | 전체 회귀 | 막은 것 | 판정 |
|---|---|---|---|
| **C1** AUDIENCE_LINE | 🔴 **13건** | `cross-seller-matching` 5쌍 negative fixture | 🔴 **NO-GO** |
| **C3** 품번⟹brand | 🔴 **16건 / 12파일** | `wu-057` · **`wu-068`(GT 63)** · `wu-060` · `wu-069` · `wu-037` · `fit-normalization` | 🔴 **HOLD** |
| **C4** 시장/가격 분리 | 🔴 **4건** | `mi-020` · **`wu-060`(알림 체인)** · `wu-063` · `wu-077` | 🔴 **HOLD** |
| **C2** MODEL_CODE | — | CPO 명시 금지(전면 해제) | 🔴 **금지** |

### 🔴🔴 C1 이 가장 중요한 발견이다 — **그 축은 BABY 만 막고 있지 않았다**
```
원상품 430632(아동) ↔ bobochoses **Mush Monster Duo** all over T-shirt   → SAME 이 됐다
                    ↔ bobochoses **Softpaw Monster** all over T-shirt    → SAME 이 됐다
                    ↔ junioredition **Juicy Tomatoes** All Over Baby Tee → SAME 이 됐다
                    ↔ junioredition **Bobo Choses Color** All Over Baby  → SAME 이 됐다
```
🔴 그 넷은 **BABY판이 아니라 «다른 그래픽»** 이다. 「all over T-shirt」 공통 어휘로 제목·
상품군·소재·대상 축이 맞아떨어지고, **가르던 유일한 축이 연령 라인** 이었다.
⟹ 🔴 CPO 절대조건(DIFFERENT → SAME = 0) **위반** · false SAME **13건**.

🟡 **CPO 정책(BABY=CHILD)은 폐기가 아니다 — 범위를 좁혀야 한다**(다음 WU · CPO 판정):
> 「연령 라인이 달라도 **핵심 상품명 토큰이 사실상 동일** 할 때만 비차단」
> 🟢 위 넷은 그래픽 **이름이 서로 다르다** ⟹ 그 조건이 넷을 가른다.
> 🔴 단 **새 규칙** 이고 「사실상 동일」의 문턱 설계 + 표본이 선행이다.

### 🔴 C4 가 막힌 이유 — 시장 자격이 **알림 체인의 입구** 다
```
wu-060 「CF-3 승격 5건 중 국내(KR) 시장 자격이 **0** 이다」  ← 그 0 이 알림 체인을 닫는다
wu-063 「KRW 가 아니면 국내 시장이 되지 않는다(`.kr` 이어도 충돌)」
```
🔴 국내 축은 `computeMarketAlert → openAlertIfNotActive` 로 **영속 `price_alerts` 행** 을
만들 수 있다(WU-039/059 계약). ⟹ 🔴 시장 자격을 넓히는 변경은 **그 체인 측정이 선행** 이다.
🟡 그 측정은 `wu-059`/`wu-060` 이 이미 하니스를 갖고 있다 — 거기서 이어가면 된다.

## 🟢 그래서 남긴 것 — 되돌린 «사실» 을 계약으로 잠갔다
`packages/crawler/src/comparison-search/__tests__/wu-143-identity-expressiveness.test.ts`
(**10건**) 이 ① 품번 exact 로 브랜드를 확인하지 않는다 ② BABY↔CHILD 보류가 **그대로 선다**
③ MODEL_CODE 충돌이 **그대로다** 를 단언한다. 🔴 다음 사람이 같은 변경을 다시 넣으면
**여기서 먼저 걸리고** 각 축 주석에서 **왜 막혔는지** 를 읽는다.

## 🔴 그리고 이것이 이 WU 의 교훈이다
```
2상품 GT(19 SAME / 6 DIFFERENT)에서 leak 0  ≠  안전
리포의 **목적성 negative fixture** 와 **precision 측정 계약(GT 63)** 이 전부 반대를 말했다
⟹ 🔴 「내 표본에서 leak 0」을 GO 근거로 쓰지 않는다
```
