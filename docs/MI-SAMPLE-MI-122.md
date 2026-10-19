# WU-122 — 해외 B 목록 소수 표본 MI 판별 (측정 · 구현 0 · 가격 0)

> 🔴 CPO 2026-10-20: 「679 전수 금지 · **최대 30** · **source 별 층화** · 문자열 단서 있는 것과
> 없는 것을 **같이** 넣어 편향 측정 · 새 판정 규칙 ❌ · **1-hop 구현 ❌** · 가격 HOLD」

---

# [WU-122 완료 보고]

## 1. 표본 — **24건 / source 14** (상한 30 준수)

```
층화 규칙 — host 별 「문자열 단서 있는 것 2 + 없는 것 1」 · 총 상한 30
단서 있는 표본 **10** · 없는 표본 **14**
🔴 문자열 단서는 **표본 선정에만** 썼다 — 판정은 운영 함수(`withConfidence` + `attachMatchTruth`)가 했다
🔴 두 원상품(S1·S2) **각각** 에 판정을 돌렸다(어느 쪽 후보인지 미리 정하지 않았다)
```

## 2. 🟢🟢 결과 — **SAME 5 · PRESUMED_SAME 2**

| source | 표본 | 상품확인 | SAME | PRESUMED | CONFLICT | UNKNOWN |
|---|---:|---:|---:|---:|---:|---:|
| tinyapple.net | 3 | 3 | **2** | **1** | 0 | 0 |
| scoutandcokids.com | 3 | 3 | **2** | 0 | 0 | 1 |
| junioredition.com | 3 | 3 | **1** | 0 | 2 | 0 |
| cemarose.ca | 3 | 3 | 0 | **1** | 2 | 0 |
| bobochoses.com | 3 | 2 | 0 | 0 | 2 | 1 |
| shoptheyoungsters · bobochoses.co.jp | 2 | 2 | 0 | 0 | 2 | 0 |
| kodomoboston | 1 | 1 | 0 | 0 | 0 | 1 |
| 🔴 **facebook · twitter · pinterest · plus.google · pages.coupang · (빈 host)** | **6** | **0** | 0 | 0 | 0 | 6 |
| **합계** | **24** | **17** | **5** | **2** | **8** | **9** |

### 🟢 SAME/PRESUMED 7건은 **전부 기존 후보 풀에 없던 URL** 이다
```
junioredition `/en-kr/…/booty-ghosts-long-sleeve-t-shirt` code **B226AC010** · S1 **SAME**
tinyapple     `/en-kr/products/…booty-ghosts…`                       S1 **SAME**
tinyapple     `/en-kr/products/…hug-hairy-monster…`                   S2 **SAME**
scoutandcokids `/…/booty-ghosts-t-shirt`                              S1 **SAME**
scoutandcokids `/…/hug-hairy-monster-t-…`                             S2 **SAME**
tinyapple     `…embossed…`(단서 없음)                                 PRESUMED_SAME
cemarose      `…booty-ghosts-sweatshirt`                              PRESUMED_SAME
🔴 **CTO 가 이들을 동일상품으로 확정하지 않았다** — 운영 MI 산출을 적은 것이다(GT 는 CEO 몫).
```

## 3. 🔴 **두 가지 편향이 같이 측정됐다** (1-hop 설계의 재료)

```
① 🟢 **문자열 단서가 강한 선별 신호** — 단서 있는 10건 중 SAME **5**(50%) ·
   단서 없는 14건 중 SAME **0** · PRESUMED 1
   ⟹ 🔴 「링크를 전부 넣는다」가 아니라 **선별이 필수** 다(CPO 가 말한 구조와 일치)
② 🔴🔴 **목록 페이지의 href 를 그대로 쓰면 SNS 가 후보로 들어온다** —
   표본 24 중 **6건이 facebook · twitter · pinterest · plus.google · pages.coupang · 빈 host** 였고
   **상품확인 0/6** 이다. ⟹ 1-hop 을 열면 **그 필터가 먼저 필요하다**
🟢 상품확인은 17/24 이고 실패 7건은 **전부 ②의 비상품 링크** 다(fetch 결함이 아니다)
```

## 4. 🔴🔴 CPO 판정 분기 — **①(의미 있는 SAME/SIMILAR 발견)에 해당한다**

```
🟢 「거의 전부 DIFFERENT」 ❌ — SAME 5 · PRESUMED 2 (유효 분모 17 중 **7**)
🟢 「대부분 UNKNOWN/실패」 ❌ — UNKNOWN 9 중 **6건이 SNS 링크** 라 fetch/facts 결함이 아니다
⟹ 🟢🟢 **1-hop 후보 공급을 «별도 WU 로 설계할 가치» 가 확인됐다**
   🔴 단 구조는 CPO 가 적은 그대로여야 한다 —
   **「검색 결과 → 관련 상품 링크 추출 → 후보 «선별» → MI」**(링크 679 투입 ❌)
🔴 **이번에 구현하지 않았다**(CPO 명시) · 운영 코드 변경 **0**
```

---

## 🔴 Known Unknowns

```
① 🔴 표본 **24 / 679**(3.5%) 다 — 「679 중 SAME 이 N건」으로 환산하지 않는다
② 🔴 층화가 host 별 **최대 3건** 이라 큰 목록(kodomoboston 289링크)이 **과소 대표** 됐다
③ 🔴 이 SAME 7건은 **시스템 판정** 이고 **Human GT 가 아니다** — CEO 판정 전이다
④ 🔴 1-hop 의 **비용**(페이지당 추가 HTTP · 후보 수십 개 유입)은 측정하지 않았다 ·
   ⑧ 게이트·샵당 1건과의 충돌도 **미설계**
⑤ 🔴 가격은 한 건도 건드리지 않았다
```

## 결론 — 🟢 **분기 ① 성립 · 1-hop 은 설계 가치 확인 · 구현 0**

```
표본 **24**(상한 30 준수) · 상품확인 17 · **SAME 5 · PRESUMED_SAME 2** · CONFLICT 8 · UNKNOWN 9
🟢🟢 **신규 후보 중 MI 가 SAME 이라 하는 것이 실재한다**(전부 기존 풀 밖 URL)
🟢 단서 있는 표본의 SAME 율 **50%** ↔ 단서 없는 표본 **0%** ⟹ **선별이 필수**
🔴 SNS 링크 6건이 섞였다 ⟹ **비상품 링크 필터가 선행 조건**
🔴 운영 변경 **0** · 배포 0 · 가격 **0** · 1-hop **0** · 8축 0 · Registry 0 · UI 0
```
