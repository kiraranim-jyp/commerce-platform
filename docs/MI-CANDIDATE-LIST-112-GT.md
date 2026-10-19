# WU-112 GT 결과 — **동일상품 11/19 가 가격비교에 반영되지 않는다** (측정 · 구현 0)

> 🔴 CPO 고정 순서의 ② 단계. 「GT 수신 후에만 ⒜ DROPPED 안의 SAME ⒝ 시스템 SAME 중
> Human DIFFERENT 를 보고 **그 둘이 나올 때만** MI 최소 수정을 설계한다」 ⟹ **둘 다 나왔다.**

---

# [WU-112 GT 분석 보고]

## 0. GT 수신 — **27/27 전건 판정**

```
SAME **19** · DIFFERENT **6** · UNCERTAIN **2**     (CEO 2026-10-19T14:20Z)
🟢 덤프와 **URL 키로 27/27 조인**(미매칭 0) — 인덱스 매핑 금지(WU-095 교훈)
🟢 라벨 `fixtures/wu-112-human-gt.json`
🔴 UNCERTAIN 2 의 사유가 **둘 다 「볼 수 없었다」** 다 — 가치 판단이 아니다
   ⒜ luksusbaby 「이미지가 잘려 확인할 수 없음」 ⒝ beaumonde **목록 페이지**
   🔴 ⒝ 는 **WU-073 이 기록한 그 결함** 이다(한국 CMS `goods_list.php` 가 PRODUCT_PAGE 로 통과)
```

## 1. 🔴🔴 **⒜ 성립 — 「이 샵은 제외됨」 안에 Human SAME 이 3건 있다**

| 샵 | 시스템 | 게이트 | Human |
|---|---|---|---|
| `rboutique.com` USD 44 | SIMILAR | `EVIDENCE_NOT_WORTHWHILE` | 🔴 **SAME** |
| `stockmann.ee` EUR 40 | SIMILAR | `EVIDENCE_NOT_WORTHWHILE` | 🔴 **SAME** |
| `bornyesterdaykids.com` KRW 189,000 | CONFLICT | `EVIDENCE_NOT_WORTHWHILE` | 🔴 **SAME** |
| luksusbaby ×2 · parkette | CONFLICT | 같은 게이트 | 🟢 DIFFERENT / UNCERTAIN |

```
⟹ 🔴🔴 **⑧ `isEvidenceEvaluationWorthwhile` 가 동일상품을 버린다 — 3/6.**
🔴 **WU-100 의 「26/26 NOISE ⟹ ⑧ 은 하나도 틀리지 않았다」와 반대 결과** 다.
   🟢 모순이 아니다 — **분모가 다르다**: WU-100 의 원상품은 **B226AC112** 였고
   WU-102 가 「그 상품은 애초에 AI 조사 대상이 아니었다」로 확정했다. 거기엔
   **좋은 후보가 입력에 없었다.** 이번은 **동일상품이 실재하는 표본** 이다.
🔴 그래서 WU-100 의 결론을 「폐기」하지 않고 **「분모 밖」으로** 적는다.
```

## 2. 🔴🔴 **⒝ 성립 — False EXACT 1건이고, 그것이 «셀러가 보는 최저가» 다**

```
tinyapple.net `/bobo-choses-booty-ghosts-t-shirt` **USD 53**
  시스템  crossSeller **SAME** · tier **EXACT** · VERIFIED_CURRENT · 금액 집계 **진입**
  Human   🔴 **DIFFERENT** — 「반팔셔츠」
🔴🔴 그리고 그것이 **S1 의 USD 최저가 53** 이다(WU-111 §2 에서 「UI 보인다」로 확인된 그 값)
⟹ 🔴 **셀러가 보는 「해외 동일상품 USD 최저가」가 다른 상품(반팔)의 가격이다.**

🔴🔴 **원인이 8축이 아니다 — «같은 샵 안에서 대표를 잘못 골랐다»**:
   같은 tinyapple 에 Human **SAME** 인 `…-heather-grey` **USD 58** 이 있는데
   그 후보는 **「샵 2순위」라 적재되지 않았다**(sink 는 샵당 best 1건 · WU-109).
   ⟹ 🟢 **owner 는 대표 선택** 이고, WU-109 §4 가 「best 가 올바른 대표인가는 범위 밖」
      으로 남겨 둔 **바로 그 자리** 다.
```

## 3. 🔴🔴 핵심 수치 — **Human SAME 19 중 가격비교 반영 8 (42%)**

| 반영된 8건 | 반영 안 된 11건 · 원인 |
|---|---|
| cissywears GBP 37 (EXACT) | **EXCLUDED(품번 충돌) 4** — bobochoses `b226ab046`·`b226ab040`(AB 라인) · junioredition · kids21 |
| kolkid CAD 64 (EXACT) | **샵 제외(⑧) 3** — rboutique USD 44 · stockmann EUR 40 · bornyesterdaykids |
| tinyapple USD 58 (EXACT) | **샵 2순위라 미적재 2** — tinyapple USD 58 · cissywears GBP 33 |
| trenbe USD 84 (EXACT) | **가격 없음 1** — beaumonde(JS 렌더 · WU-079 HOLD) |
| thefrontshop USD 58 (EXACT) | **KRW + 시장 미확정 1** — billsstore.com.au KRW 70,000 |
| eraldo EUR 40 · cissywears GBP 33 (COMPARISON) | |
| 🇰🇷 biskuit KRW 88,000 (COMPARISON) | |

```
🟢 정밀도 — 시스템 SAME 7 중 Human SAME **6** (85.7%) · tier EXACT 6 중 **5** (83.3%)
🔴 금액 집계 진입 9건 중 **오포함 1**(위 §2) ⟹ 🔴 **WU-108 의 「오포함 0」을 정정한다**
   (그때는 Human GT 가 없어 「오포함 0」이라 적을 근거가 실은 없었다)
🔴 재현율 — 동일상품 **19건 중 8건** 만 셀러 화면의 가격 비교에 들어간다
```

## 4. 🟢 CEO 라벨이 **열려 있던 질문 둘에 답했다**

```
① 🔴🔴 **AC ↔ AB(baby) 라인 차이 = CEO 기준 «동일상품»**
   bobochoses `b226ab046`(S1) · `b226ab040`(S2) **둘 다 SAME** ⟹ WU-048/069 가
   **HOLD 로 남긴 그 질문** 에 라벨이 붙었다(🟢 WU-093 S1-1 과 합쳐 3건).
   🔴 그러나 그 완화는 WU-069/070 에서 **「품번 보호의 해체」** 로 측정됐다 ⟹ **CPO 판정 사안.**
② 🟢 **품번이 같아도 색이 다르면 DIFFERENT** — `m.luxboy.com` 은 품번 **B226AC009 exact**
   인데 Human **DIFFERENT**(「컬러 다름」)다.
   🟢🟢 우리 시스템은 그것을 **PRESUMED_SAME + market UNKNOWN** 으로 **금액에서 빼냈다** = 정답.
   🔴 ⟹ **「품번 일치만으로 SAME」 방향을 열면 이 건이 뚫린다.** ①과 ②가 **같은 레버의 양면** 이다.
```

🟡 **부수 관측(판정 안 함)** — CEO 는 「반팔 ↔ 긴팔」을 **다른 상품** 으로, 「kids ↔ baby 라인」과
「세트 구성(bornyesterdaykids)」은 **같은 상품** 으로 봤다. 🔴 소매 길이 축은 현재 **아무 코드도
보지 않는다**(8축에 없다). 🔴 새 축을 만들지 않았다 — N 이 작고 8축은 CLOSED 다.

## 5. 🟡 최소 수정 **설계**(🔴 구현 0 · CPO 지정 대기 · 영향 큰 순서)

| | 수정 자리 | 효과(이 표본) | 위험 |
|---|---|---|---|
| **P1** | **샵 대표(best) 선택** — 같은 샵에서 Human SAME 후보가 2순위로 밀렸다 | 🔴 **False EXACT 1건 제거 + S1 USD 최저가가 53→58(정답)** | 🟢 8축·threshold 무변경 · 가장 좁다 |
| **P2** | ⑧ `EVIDENCE_NOT_WORTHWHILE` (샵 전체 DROPPED) | 🟢 Human SAME **3건** 회수 | 🔴 노이즈 3건도 같이 들어온다(이 표본 6건 중 3) · 비용 게이트 |
| **P3** | 샵당 1건 제한(sink) | 🟢 SAME 2건 회수 | 🔴 집계 구조 변경 · 중복 집계 위험 |
| **P4** | 품번 충돌(AB 라인 · 샵 SKU) | 🟢 SAME 4건 회수 | 🔴🔴 **품번 보호 해체** · WU-069/070 이 HOLD · luxboy 가 뚫릴 방향 |
| **P5** | billsstore KRW+UNKNOWN · beaumonde 가격없음 | SAME 2건 | 🔴 **가격 작업이라 CPO 가 보류** 중 |

```
🔴 **CTO 는 하나도 구현하지 않았다.** P1 이 가장 좁고 효과가 직접적이지만
   「대표 선택 규칙 변경」도 판정 산출을 바꾸므로 **CPO 가 지정해야** 한다.
🔴 P4 는 CEO 라벨이 생겼어도 **단독으로 열지 않는다** — ②(luxboy)가 그 반대 방향 증거다.
```

---

## 🔴 Known Unknowns

```
① 🔴 원상품 **2개 · 후보 27건** 이다 — 「42%」를 전수 재현율로 쓰지 않는다
② 🔴 UNCERTAIN 2 는 **측정불가** 다(0% 도 DIFFERENT 도 아니다)
③ 🔴 이 목록은 **AI URL 풀 한 생산자** 의 산출이다 — 등록부 경로는 분모 밖
④ 🔴 「반팔/긴팔」 축의 전수 빈도 **미측정** · 「AB 라인 = SAME」은 **N=3**
⑤ 🔴 P1~P4 의 효과는 **이 표본의 counterfactual 이 아니다** — 아직 돌려보지 않았다
```

## 결론 — 🔴 **MI 최소 수정 근거가 확보됐다 · 지정 대기**

```
⒜ DROPPED 안의 Human SAME  🔴 **3건** — ⑧ 게이트가 동일상품을 버린다
⒝ 시스템 SAME 중 Human DIFFERENT  🔴 **1건** — 그것이 **S1 USD 최저가** 다(실제 화면 영향)
동일상품 19 중 가격비교 반영  🔴 **8 (42%)**
정밀도  시스템 SAME 6/7 · tier EXACT 5/6
🔴 운영 변경 **0** · 배포 0 · 가격 작업 **0**(CPO 보류 준수)
```
