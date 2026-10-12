# MI Domestic Link Coverage — NO_LINK 331 원인분해 WU

> 🟢 **종료.** 판정은 §6 — **CHANGE DIRECTION (원인이 Discovery 가 아니다)**.
> 🔴 **Production 0 · DB 0(SELECT 만) · 정책 0 · 새 fetch 0**(선행 측정 재사용).
> 🔴🔴 **핵심 답: `NO_LINK` 의 지배적 원인은 「국내 미취급」도 「검색 실패」도 아니다.**
> **「그 브랜드를 취급하는 국내 샵이 `MANUAL` 로 분류돼 «검색 대상에서 빠져 있다»」** 다.

---

## 1. Strategic Question

> 「국내에 실제 판매처가 있는 상품을 현재 시스템이 얼마만큼 찾아내고 있는가?」

---

## 2. STEP 0 §5-B — 「탐색하지 않는다」를 결정하는 owner

```
isBatchSurveyTarget(source, categoryScopes)      run-domestic-price-check.ts:442
  = source.enabled
  AND source.status === "ACTIVE"
  AND isCollectableAccess(source.accessStatus)     🔴 null 은 «통과» 다
  AND sourceFitsScopes(source.categoryScope, categoryScopes)
```
🟢 그 함수 주석이 「조건을 새로 쓰지 않는다 · 그 함수의 계약이 곧 정책이다」라고
적어 뒀다. 🟢 **복제하지 않고 그 계약을 그대로 읽었다.**

🟢 그리고 같은 파일이 저장경로의 **7단계**를 명시한다(:460 부근) —
`①자기참조 제외 → ②isEvidenceEvaluationWorthwhile → ③selectDomesticCandidate →
④toDomesticMatchType → ⑤decideCandidateEvidence → ⑥matchTruth → ⑦priceTierFromLink`.

---

## 3. 🔴🔴 샵 등록부 실측 — **검색되는 샵이 7개뿐이다** (전수 34)

```
전체 샵                              34
enabled AND status=ACTIVE            20
access 통과                          20
🟢🟢 **자동수집 가능(AUTO_API|AUTO_SCRAPE)**   **7**
```

### 전략별 분포 (전수)

| enabled | status | strategy | 수 | 샵 |
|---|---|---|---:|---|
| ✓ | ACTIVE | **MANUAL** | **12** | 29CM 키즈 · 무신사 키즈 · W컨셉 · 키디키디 · SSF SHOP · 카카오 쇼핑하우 · OCO · kream · KARYMARKET · NOKIMORE · **CHOUCHOU ENFANT** · **COCO & JENNIE** |
| ✓ | NOT_AVAILABLE | NOT_AVAILABLE | 12 | 쿠팡 · 네이버 스마트스토어 · G마켓 · 11번가 · SSG · 롯데ON · GS SHOP · CJ온스타일 · 옥션 · 현대H몰 · 에누리 · KREAM |
| ✓ | ACTIVE | **AUTO_SCRAPE** | **6** | CHOCO.EL · DEUXBEBE · LITTLE LUNA · LOOXLOO · RULII · 포레포레 |
| ✓ | ACTIVE | AUTO_SCRAPE | 1 | 스카이스포츠 (scope=TENNIS) |
| ✓ | NOT_AVAILABLE | — | 1 | 네이버 쇼핑 (API_DISCONTINUED) |
| **✗** | ACTIVE | **AUTO_API** | **1** | 🔴 **Bobo Choses Korea(공식)** |
| ✓ | ACTIVE | MANUAL | 1 | 다나와 |

### 🔴🔴 링크 88건을 실제로 만든 샵은 **4개** 뿐이다

```
Bobo Choses Korea(공식)  32 링크 / 32 스냅샷   🔴 **enabled = false** (지금은 검색 안 됨)
포레포레                 32 링크 / 32 스냅샷   🟢 AUTO_SCRAPE
DEUXBEBE(듀베베)         23 링크 / 23 스냅샷   🟢 AUTO_SCRAPE
LITTLE LUNA(리틀루나)     1 링크 /  1 스냅샷   🟢 AUTO_SCRAPE
```

🔴 **링크의 36%(32/88)를 만든 샵이 현재 `enabled=false` 다.** 선행 WU 에서
「`bobochoses.com` 이 등록부 disabled 라 CONTROL 2건이 재현 실패했다」고 기록된
그 샵이다. 🔴 왜 비활성인지는 **미조사** — 추측하지 않는다.

🔴 활성 자동수집 샵 7개 중 **실제로 링크를 만든 것은 3개**(포레포레 · 듀베베 ·
리틀루나). CHOCO.EL · LOOXLOO · RULII 는 0건이고, 선행 WU 가 그 이유를 이미 쟀다
(chocoel 교집합 MYMY 1건 · looxloo/rulii 는 품번을 제목에 안 적는다).

---

## 4. 🔴🔴 가장 중요한 발견 — `MANUAL` 의 의미를 잘못 읽으면 결론이 뒤집힌다

선행 WU 가 샵 카탈로그를 실측한 4곳은 **전부 `MANUAL`** 이다(= 검색 대상이 아니다).
그런데 그중 **2곳이 우리 「링크 0 브랜드」를 실제로 취급한다**:

```
coconjennie.com    (MANUAL)  → Louise Misha(상품 10) · Emile et Ida(5) ·
                                the new society(3) · Misha & Puff(1)
chouchouenfant.kr  (MANUAL)  → Bobo Choses(84) · Bonpoint(1)
nokimore.com       (MANUAL)  → 교집합 **0**
karymarket.com     (MANUAL)  → 교집합 **0**
🔴 sample N=4 샵 · 요청 10회 (선행 WU 실측, 재측정 안 함)
```

🟢🟢 **`MANUAL` 은 「자동수집 불가」가 «아니다».** owner 주석이 명시한다
(`domestic-price-source.ts:261`, 대표님 지시 N-4.06 Track 1):
> 「임의로 `AUTO_SCRAPE` 로 확정하지 않는다 — **실제 사이트 구조를 조사하기
>  전까지는 기본값을 `MANUAL` 로 둔다**(추정 금지 원칙).」

🔴 **즉 `MANUAL` 12곳은 「조사되지 않은 샵」 이고 「수집 불가 샵」이 아니다.**
그래서 `NO_LINK` 의 큰 덩어리는 **「국내에 없다」가 아니라 「우리가 그 샵을 아직
검색 대상으로 만들지 않았다」** 다 — CPO 5분류의 **⑤ 「현재 전략상 탐색하지 않는
경우」** 다.

🔴 단 **MANUAL 전체가 그렇다고 일반화하지 않는다**:
```
🔴 chouchouenfant 는 브랜드는 맞지만 **현 시즌 상품이 없다**
   (선행 WU 실측: Bobo 품번 50건 전수에 현행 226 = **0** → 과거시즌 아웃렛)
🔴 coconjennie 는 sixshop product path 미관찰 → **UNKNOWN 유지**
🔴 nokimore · karymarket 는 교집합 **0** → 그 둘은 열어도 효과가 없다
🔴 NOT_AVAILABLE 12곳(쿠팡·네이버·G마켓 등)은 **약관이 막는다**(선행 메모
   portal-scraping-blocked-by-terms). 🔴 이것은 조사 부족이 아니라 «정책» 이다
```

---

## 5. NO_LINK 분해 (CPO 5분류 · 전수 498 중 링크 0 = **429**)

🔴 **보고 전 자가감사에서 두 숫자를 고쳤다** — `AW26` 44 → **40** · Louise Misha
16 → **12**. 「브랜드 전체 상품수」와 「링크 0 인 상품수」를 섞어 쓴 것이다
(각각 4건은 링크를 갖고 있다). 🔴 섞으면 분해 합이 과대가 된다.

### 링크 0 **429**건의 브랜드 상위 (실측)
```
Bobo Choses 139 · AW26 40 · Sergio Tacchini 27 · (빈 문자열) 25 ·
Pèpè Shoes 19 · The Animals Observatory 18 · Louis Louise 18 ·
Mini Rodini 17 · Tumble N'Dry 16 · Main Story 13
```

| 분류 | 건수 | 근거 | 확신도 |
|---|---:|---|---|
| ⑤ **전략상 탐색 안 함** — 취급 샵이 `MANUAL`/`NOT_AVAILABLE` | 🔴 **하한 21** | coconjennie 교집합 중 링크 0 인 것 — Louise Misha **12** · Emile et Ida **9** (+ the new society · Misha & Puff 는 소수) | 🟢 샵 카탈로그 실측 |
| ⑤-b **탐색 대상이 비활성** | **32** | 🔴 Bobo Choses Korea `enabled=false` 가 만든 링크 32 | 🟢 DB 실측 |
| ① **국내 미취급(추정)** | ~170 | 링크 0 브랜드 26개 상품 204 − 위 ⑤ 교집합분 | 🟡 **직접 확인 안 됨** |
| ①-b **scope 밖이 맞다** | **28** | Sergio Tacchini 27(테니스) + 골프 — 아동의류 샵을 안 뒤지는 게 맞다 | 🟢 |
| ③ **식별정보 부족** | **25** | 브랜드 빈 문자열 25건 | 🟢 DB 실측 |
| ③-b 브랜드 오염 | **40** | 🔴 `AW26` 은 브랜드가 아니다(backfill 문제). 전체 44 중 4건은 링크가 있다 | 🟢 |
| 🔴 **Bobo Choses 139** (최대 덩어리) | **139** | 링크 0 중 최대. 🔴 공식몰(AUTO_API)이 **비활성** 이고 chouchouenfant 는 **현 시즌 0**(아웃렛) → ⑤와 ①이 겹친다 | 🟡 혼재 |
| ②④ **검색 실패 / 후보 reject** | 🔴 **측정불가** | 저장되는 것은 ACTIVE 링크뿐(88/88) — 떨어진 후보의 흔적이 **DB 에 없다** | 🔴 |

🔴 **합계를 내지 않는다** — 분류가 상호배타가 아니고(한 상품이 여러 사유에 걸린다)
②④가 측정불가라 분모가 닫히지 않는다. 🔴 「①국내 미취급 ~170」은 **추정**이고
직접 확인하지 않았다.

### 🔴 ②④를 왜 못 재는가 (구조적 이유)

```
domestic_product_links.status = ACTIVE **88/88** (전건)
→ gate ②④ 에서 떨어진 후보는 **행으로 남지 않는다**
→ 사후에 「후보가 있었는데 reject 됐다」와 「후보가 아예 없었다」를 **구분할 수 없다**
🔴 그러므로 ②④ 는 0 이 아니라 **측정불가** 다. 가르려면 라이브 재실행이 필요하다.
```

### 🟢 식별정보 축 (전수 498)

```
sku 있음          **498/498**  🟢 전건
brand 있음           473/498
color 있음           291/498
marketCategoryProfileId  179/498  → 🔴 319건은 **자동 추정 scope** 를 쓴다
🔴 brandModelCode 0/498 은 «결함이 아니다» — canonicalProduct 에 `identity` 키가
   **없다**. 내가 경로를 틀렸다. canonicalProduct 키 실측:
   sku brand color price title images options titleKo keywords material …
   (선행 메모 mi-p0-02-whitelist-works-chain-breaks-at-identity 와 정합)
```

---

## 6. 판정 — **CHANGE DIRECTION**

```
🔴 「331 을 검색으로 해결한다」는 방향이 **틀렸다.**
🟢 지배적 레버는 **등록부** 다 — 취급 샵이 있는데 MANUAL/비활성이라 안 뒤진다.
   · Bobo Choses Korea 가 **enabled=false**(링크 36%의 출처였다)
   · coconjennie 가 우리 브랜드 4개를 취급하는데 **MANUAL**
🔴 그러나 「MANUAL 을 전부 AUTO 로 바꾸자」도 **아니다**:
   · chouchouenfant 는 현 시즌 0 (아웃렛)
   · nokimore · karymarket 는 교집합 0
   · NOT_AVAILABLE 12곳은 **약관**이 막는다(조사 부족이 아니다)
🟢 다음은 코드가 아니라 **조사와 정책 결정** 이다 — §7.
```

🔴 **CPO 가 금지한 것을 하지 않았다** — Identity 재구성 0 · 가격 비교 로직 변경 0 ·
Discovery 확대 0 · Registry 대량 추가 0.

---

## 7. 🔴 CEO/CPO 결정 영역 — **셋**

```
① 🔴 Bobo Choses Korea(공식) 가 왜 `enabled=false` 인가.
   링크 36%(32/88)의 출처였고 AUTO_API 다. 🔴 비활성 이유 **미조사** —
   의도(공식몰 제외 정책?)인지 사고인지 CTO 가 단정하지 않았다
② 🔴 `coconjennie` 를 AUTO_SCRAPE 로 승격할 것인가.
   우리 브랜드 4개를 취급한다(실측). 🔴 단 sixshop product path 미관찰 →
   먼저 **조사** 가 필요하다(추정 금지)
③ 🔴 MANUAL 12곳 중 어디를 조사할 것인가.
   🟢 판별 기준은 이미 있다(선행 메모 auto-source-adoption-standard):
      「우리 UA 가 robots 에서 허용되는가」 + 「상품명·URL 에 해외 품번을 적는가」
   🔴 NOT_AVAILABLE 12곳(포털/오픈마켓)은 약관이라 **대상이 아니다**
```

---

## 8. Known Unknowns

```
🔴 ②검색 실패 / ④후보 reject 는 **구조적 측정불가**(떨어진 후보가 DB 에 없다)
🔴 「①국내 미취급 ~170」은 **추정** 이다 — 직접 확인하지 않았다
🔴 샵 카탈로그 실측은 **sample N=4 샵** 이다. MANUAL 12곳 중 8곳 미측정
🔴 Bobo Choses Korea 비활성 이유 미조사
🔴 coconjennie product path 미관찰 → 승격 가능성 UNKNOWN
🔴 marketCategoryProfileId 가 없는 319건의 «자동 추정 scope» 가 실제로 어떤
   샵 집합을 고르는지 미측정
🔴 `AW26` 40건(링크 0 기준) · 브랜드 공백 25건이 backfill 로 복구 가능한지 미측정
   (🔴 선행 WU 가 brand backfill 변경을 금지했다 — 이 WU 에서 손대지 않았다)
```
