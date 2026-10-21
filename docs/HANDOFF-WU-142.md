# 🟡 WU-142 — **2상품 MI recall 손실 지점 확정** (STEP A/B/C 완료 · CPO 판정 대기)

> 🔴🔴 **UI 를 고치지 않았다.** 운영 변경 **0** · 측정 하니스 하나
> (`wu-142-two-product-mi.test.ts` · `WU_142_PROBE=1` 게이트 · 회귀에서 **SKIP**).
> 🔴 threshold 0 · 8축 0 · Registry 0 · 새 축 0 · 후보 노출 변경 0.
>
> 🟢 재실행: `cd apps/admin && WU_142_PROBE=1 npx vitest run src/app/api/price-history/_lib/__tests__/wu-142-two-product-mi.test.ts`

## ⓞ 분모 — CEO 육안 GT `wu-112-human-gt.json` 27건

```
B226AC010 (S1)  human SAME 9 · DIFFERENT 4 · UNCERTAIN 2
B226AC009 (S2)  human SAME 10 · DIFFERENT 2 · UNCERTAIN 0
🔴 UNCERTAIN 2 는 정확도 분모에서 뺀다(사람이 판단하지 못한 것이다).
```

## ① 현재 상태 — precision 은 완벽하고 recall 이 32%

```
🟢🟢 precision **6/6** — human DIFFERENT 누출 **0 / 0** (두 상품 모두)
🔴   recall     **6/19 (32%)**
```

| 상품 | 시장 | human SAME | 후보 | 판정 | MI SAME | 판매중 | 가격확인 | 최종 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| B226AC010 | 🇰🇷 국내 | 0 | 1 | 1 | 0 | 0 | 1 | 0 |
| B226AC010 | 🌎 해외 | 6 | 7 | 7 | 3 | 1 | 6 | 3 |
| B226AC010 | ❔ 미확정 | 3 | 7 | 7 | 0 | 0 | 0 | 0 |
| B226AC009 | 🇰🇷 국내 | 1 | 1 | 1 | 0 | 0 | 1 | 0 |
| B226AC009 | 🌎 해외 | 7 | 8 | 8 | 3 | 2 | 7 | 3 |
| B226AC009 | ❔ 미확정 | 2 | 3 | 1 | 0 | 0 | 1 | 0 |

🔴 **❔ 미확정에 human SAME 5건** 이 있다(시장 UNKNOWN). CPO 결정대로 **1차 화면에
세 번째 시장을 만들지 않고**, 내부 측정 대상으로만 보존한다.

## ② 📊 셀러가 보는 값 (운영 산출)

```
S1 B226AC010  verdict SAME_BUT_NONE_ON_SALE · 🌎 동일상품 3 · 판매중 0 · 가격확인 3
              기준가 CAD 64 · GBP 37 · USD 58 · 🇰🇷 전부 0 · 보류 4(색상 2 · 품번 2)
S2 B226AC009  verdict ON_SALE · 🌎 동일상품 3 · 판매중 1 · 가격확인 2 · 확인필요 1
              기준가 USD 58 · 🇰🇷 전부 0 · 보류 7
```

## ③ STEP B — 축별 분리 (🔴 DIFFERENT 방어를 «같이» 센다)

| 축 | SAME 손실 | 🔴 DIFF 방어 | 판매처 |
|---|---:|---:|---|
| **MODEL_CODE** | 4 | **1** | SAME: bobochoses ×2 · junioredition · kids21 / DIFF: **junioredition** |
| **NO_BLOCKER** | 2 | 0 | rboutique · eraldo |
| **AUDIENCE_LINE** | 2 | 0 | billsstore · cissywears |
| **SHOP_GATE** | 2 | 0 | stockmann.ee · bornyesterdaykids |
| **SHOP_REP** | 1 | **3** | SAME: cissywears / DIFF: luksusbaby · tinyapple ×2 |
| **BRAND_UNCONFIRMED** | 1 | 0 | beaumonde.co.kr |
| **BRAND_MISMATCH+TITLE** | 1 | 0 | biskuit.kr |
| (OTHER) | 0 | 2 | parkette · m.luxboy |

🔴 「방어 0」은 **이 표본에서 0** 이다. DIFFERENT 분모가 **6건** 이라 CPO 의 HOLD 기준
(「DIFFERENT 방어 데이터 부족」)에 걸린다 — **안전 증거로 단독 사용하지 않는다.**

## ④🔴🔴 STEP C 의 핵심 — **13건 중 5건이 «하나의 제품 질문» 이다**

```
MODEL_CODE 3건   원상품 B226AC010 ↔ 후보 **B226AB046**   (bobochoses)
                 원상품 B226AC009 ↔ 후보 **B226AB040**   (bobochoses)
                 원상품 B226AC009 ↔ 후보 **B226AB040**   (junioredition · 제목 "Baby")
AUDIENCE_LINE 2건 "… T-Shirt **Baby**"(billsstore) · "**Baby** Hug Hairy Monster"(cissywears)
                 축 근거 = 「보류: 연령 라인 **CHILD ↔ BABY**」
```
🟢🟢 **같은 사실이 두 축으로 나타난다** — 품번으로는 `AC ↔ AB`, 제목으로는 `CHILD ↔ BABY`.
그리고 **CEO 는 그 5건을 전부 SAME 으로 라벨했다**(WU-112 의 `b226ab046`·`b226ab040`
포함 · WU-093 S1-1 과 합쳐 누적 N=6+).

🔴 그래서 이것은 **threshold 문제가 아니라 제품 정책 질문** 이다 —
**「kids 라인과 baby 라인은 같은 상품인가?」** WU-048/069/070 이 HOLD 한 그 질문이다.

### 🟢 그리고 이번에 **막아야 하는 쪽이 구별된다**(새 증거)

```
MODEL_CODE 가 막는 human DIFFERENT 1건 — junioredition (S1)
   facts.brandModelCode = **B226AC141**   ← 🟢 AB 가 아니라 **같은 AC 라인의 다른 번호**
   facts.colorText      = **Light Blue**  (원상품 Heather grey)
   축 근거 = ["충돌: 색상 GREY ↔ BLUE", "충돌: 모델코드 B226AC010 ↔ B226AC141"]
   ⟹ 🟢🟢 **COLOR 충돌이 독립적으로 동반된다**
```
🟡 단 **BABY 가 전부 SAME 인 것은 아니다**:
```
tinyapple (S1) "Bobo Choses **Baby** Booty Ghosts **sweatshirt**" — human **DIFFERENT**
   축 근거에 「보류: 연령 라인 CHILD ↔ BABY」 **그리고** 「보류: 옷의 형태 SHIRT ↔ SWEATSHIRT」
```
⟹ 🔴 「BABY 면 SAME」은 **단독으로 안전하지 않다.** 이 표본에서는 `GARMENT_FORM` 이
그 1건을 가른다. 🔴 **CTO 가 규칙을 설계하지 않았다 — CPO 판정 사안이다.**

## ⑤ 나머지 축의 진단 (CPO P1~P3)

```
P1 NO_BLOCKER 2건 — 🔴 **표현력 문제가 맞다**(CPO 추정 확인)
   rboutique  맞은 축 **3**(제목 booty/ghosts · 상품군 TOP↔TOP · 대상 KIDS) · 품번 null · 색상 null
   eraldo     맞은 축 **4**(+ 색상 GREY) · 품번 null
   ⟹ `SAME_MIN_AXES = 5` 에 1~2축 모자라다. 🔴 후보측 **품번이 없으면 식별 축이 영구히 빈다.**
   🔴 축 수를 내리는 것은 **threshold 완화** 이고 CPO 가 금지했다.
   🟡 미측정 — 브랜드 일치가 **축으로 세어지지 않는다**(두 후보 모두 brand 가 있는데
      `crossSellerReasons` 에 브랜드 축이 없다). 그것이 의도인지 누락인지 **확인 안 했다.**

P2 SHOP_GATE 2건 — 🟢 **MI 가 아니라 그 앞단** 이다(CPO 분리 지시 그대로)
   stockmann.ee · bornyesterdaykids — **둘 다 `top matchLevel = low`** ⟹ ⑧
   `isEvidenceEvaluationWorthwhile`(WU-096/088 이 확정한 그 게이트). 🔴 MI 정확도와 섞지 않는다.

P2 SHOP_REP 1건 — 🔴🔴 **NO-GO 방향의 증거가 나왔다**
   cissywears 는 같은 샵에 SAME 2건이 있고 **#0 이 이미 최종에 섰다** ⟹ 손실의 가격 정보가 적다.
   그런데 이 축이 막는 human DIFFERENT **3건** 중 `tinyapple` 1건은
   **축 5개가 전부 「근거」이고 충돌 0** 이다 ⟹ 샵당 1건 구조를 풀면 **그 DIFFERENT 가 바로 샌다**
   (WU-112/113 의 tinyapple USD 53↔58 과 같은 계열).

P2 BRAND_UNCONFIRMED 1건 — beaumonde.co.kr
   원상품 brand = Bobo Choses(confident) · 🔴 **후보측 `facts.brand` 가 비어 있다**
   title = "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt **B226AC010**"
   ⟹ 🔴 WU-134 의 브랜드 복구는 **Shopify 경로 전용** 이라 Cafe24 계열에서 발화하지 않는다
      (CPO 지시대로 **재개발하지 않고 원인만** 확인했다).
   🟢 그리고 **제목에 품번이 그대로 있다.**

P3 BRAND_MISMATCH+TITLE 1건 — biskuit.kr
   facts.brand = **비스킷**(샵 이름 · WU-080 이 확정한 거짓 신호) ·
   title = "[보보쇼즈] 허그 헤어리 몬스터 티셔츠 **B226AC009** - 비스킷"
   🔴 CPO 지시대로 **CLOSED 유지.**
```

🟢🟢 **국내 2건이 «같은 모양» 이다** — beaumonde · biskuit 둘 다 **제목에 품번과 한글
브랜드가 있는데** 후보측 `facts.brand` 가 비었거나(beaumonde) 샵 이름(biskuit)이다.
⟹ 국내 병목은 **브랜드 축 하나** 이고 **품번은 제목에 있다.**

## ⑥ 🔴 반대 증거도 같이 적는다 — 품번 일치가 동일성을 보장하지 않는다

```
m.luxboy.com (S2)  facts.brandModelCode = **B226AC009**(정확히 일치) · human **DIFFERENT**
   축 근거 = ["근거: 브랜드 품번 일치", …, "보류: 핵심 상품명에 겹치는 말이 없다"]
   ⟹ 🔴 `NO_TITLE_OVERLAP` 이 이 1건을 막고 있다. 그 축을 풀면 **품번이 맞는 다른 상품** 이 샌다.
```

## ⑦ CPO 판정에 필요한 정리 (🔴 CTO 가 고르지 않았다)

```
축                      SAME +    DIFF 누출 위험                      구별 수단(이 표본)
AC↔AB 라인(품번+제목)      **+5**   tinyapple Baby **sweatshirt** 1건   🟢 GARMENT_FORM
MODEL_CODE 일반 완화       +4       junioredition AC141 1건            🟢 COLOR 충돌 동반
NO_BLOCKER(축 수)          +2       미측정                             🔴 threshold — 금지
SHOP_GATE(⑧)              +2       미측정                             🟡 MI 밖 · 별 축
SHOP_REP(샵당 1건)         +1       **3건**(그중 1건은 충돌 0)          🔴 없음 → NO-GO 방향
BRAND_UNCONFIRMED         +1       미측정                             🟡 Cafe24 브랜드 추출
BRAND_MISMATCH+TITLE      +1       미측정                             🔴 CLOSED 유지
```
🟢 **recall 상한** — 전부 열면 6/19 → 최대 16/19. 🔴 그러나 **precision 100% 유지가
절대 조건** 이므로 CPO 기준으로 의미 있는 것은 **「DIFFERENT 누출 0 을 지키며 +N」** 이다.

## ⑧ 측정불가 / 한계

```
⒜ 원상품 **2개** · human DIFFERENT 분모 **6건** ⟹ 「방어 0」은 약한 증거다
⒝ ❔ 미확정 human SAME 5건은 국내/해외 축에 없어 **화면에 존재하지 않는다**
⒞ 브랜드 축이 `crossSellerReasons` 에 세어지지 않는 이유 **미확인**
⒟ counterfactual 을 **돌리지 않았다** — CPO 가 요구한 것은 축별 «진단» 이었다
   (「실제 식별 실패인지 정상 방어인지 확인」). 완화 구현은 CPO GO 뒤의 일이다
```

## 🔴 하니스를 네 번 틀렸고 넷 다 적는다

```
⒜ `"🇰🇷 국내".length` 가 **7** 이라 `pad` 가 숫자를 잘라먹었다(「🇰🇷 국0」)
⒝ `countPendingCandidates` 는 숫자가 아니라 `PendingSummary` → `[object Object]`
⒞ 🔴🔴 `market === "UNKNOWN"` 을 두 버킷 어디에도 넣지 않아 `beaumonde.co.kr`
   (human SAME · `.kr`)이 **사라졌다** ⟹ 같은 실행의 누락 목록과 **모순** 했다
   (WU-140 ⒠ 가 화면에서 지적한 그 구멍을 내 표가 복제했다)
⒟ `res.domain`(`stockmann.ee`) ↔ GT host(`www.stockmann.ee`) 불일치로 게이트 진단이
   **「후보 0건 · 사유 ?」** 로 비었다 — 「후보가 없다」는 **거짓** 이었다
```
