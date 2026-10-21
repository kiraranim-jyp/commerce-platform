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
