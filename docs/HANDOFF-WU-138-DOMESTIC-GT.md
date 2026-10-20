# 🟡 WU-138 후속 — **국내 GT 전수 검토 · 분모를 1 → 5 로 늘릴 수 있다**

> 🔴 CPO: 「국내 human SAME/DIFFERENT GT 확보 가능성을 조사하고 **기존 데이터에서
> 재사용 가능한 국내 GT 까지 전수 검토** 한 뒤 **최소 표본과 측정방법** 을 확정.
> 코드 수정부터 하지 않는다. 충분히 확보되지 않으면 **그 사실 자체를 근거와 함께** 보고.」
>
> 🔴 **코드 변경 0 · DB 쓰기 0 · 외부 HTTP 0.** 조사 전용.

---

## 1. 🟢 기존 라벨 전수 (fixture · URL 키 · 가치라벨 제외)

```
라벨행 39 → 고유 URL **37**  (🔴 wu-099/100 은 USEFUL/NOISE 「가치 라벨」이라 제외)

🇰🇷 .kr TLD          n **6**  SAME 2 · DIFFERENT 2 · UNCERTAIN 2 · 상충 0
🟡 .com 한국몰(추정)  n **2**  SAME 1 · DIFFERENT 1
🌎 해외              n **29** SAME 21 · DIFFERENT 8
🔴 둘을 합쳐 「국내 8건」으로 적지 않는다 — 운영 `classifyCandidateMarket` 은 `.kr`
   TLD / 등록부 둘만 KR 증거로 보고 **통화 단독 결정을 금지** 한다(WU-020 계약).
```

### 국내 라벨 전수 — **원상품이 둘로 갈린다**

| 원상품 | 판정 | 호스트 | 출처 |
|---|---|---|---|
| **B226AC009** | SAME | `biskuit.kr` | wu-112 |
| B226AC009 | SAME | `global.trenbe.com` | wu-111 · wu-112 |
| B226AC009 | DIFFERENT | `m.luxboy.com` | wu-112 |
| **B226AC010** | SAME | `beaumonde.co.kr` | wu-112 |
| B226AC010 | UNCERTAIN | `beaumonde.co.kr`(다른 URL) | wu-112 |
| B226AC010 | DIFFERENT | `luksusbaby.kr` | wu-112 |
| B226AC010 | UNCERTAIN | `luksusbaby.kr`(다른 URL) | wu-112 |
| B226AC010 | DIFFERENT | `kream.co.kr` | wu-116 |

🟢 **판단 상충 0** — 같은 호스트의 SAME/UNCERTAIN 은 **다른 URL** 이다.

---

## 2. 🟢 운영 DB 에 쌓인 셀러 판단 (`candidate_reviews`)

```
SAME **13** · DIFFERENT **4**  (전부 B226AC009 · WU-131 이 시딩한 그 17건)
🇰🇷 국내(추정) 라벨 **3** — biskuit.kr SAME · trenbe SAME · luxboy DIFFERENT
🔴 fixture 와 **같은 3건** 이다 ⟹ **운영 DB 에 추가 국내 GT 는 없다**
```

---

## 3. 🟢🟢 **분모를 늘릴 수 있다 — WU-133 의 「측정불가」가 더 이상 유효하지 않다**

🔴 WU-133 은 「`B226AC010` 스냅샷이 DB 에 **0건** 이라 그 GT 는 측정불가」로 닫았다.
🟢 **그 판단은 «DB 경로» 기준이었다**(`/check` 가 저장된 `canonicalProduct` 를 읽는다).

🟢🟢 **그런데 WU-138 funnel 하니스는 DB 스냅샷을 쓰지 않는다** — **원상품 URL 에서
직접 추출** 한다(`shopifySiteStrategy.extract` → `buildCanonicalProduct` → DNA).
⟹ 🔴 **`B226AC010` 도 지금 측정할 수 있다.** 스냅샷은 필요하지 않다.

```
                        현재 측정 분모      확장 후 분모
🇰🇷 국내 SAME            **1** (biskuit)    **2** (+ beaumonde.co.kr)
🇰🇷 국내 DIFFERENT       **1** (luxboy)     **3** (+ luksusbaby.kr · kream.co.kr)
🟡 UNCERTAIN            0                 2 (🔴 판정에 쓰지 않는다 · 관측만)
⟹ 1:1  →  **2:3**
```

🔴 **DB 실측 재확인** — `B226AC010` 스냅샷 **0건**(그 숫자는 그대로다). 바뀐 것은
**그것이 측정을 막지 않는다** 는 사실이다.

---

## 4. 🔴 그래도 **「충분하다」고 적지 않는다**

```
⒜ 🔴 확장해도 국내 SAME 분모는 **2** 다. 「SAME 회복률」을 백분율로 적을 수 없다
⒝ 🔴 원상품이 **둘** 뿐이고 **같은 브랜드(Bobo Choses)** 다 — 브랜드 축의 특수성
   (공식몰 vendor 가 시즌코드)이 그대로 들어온다
⒞ 🔴 `beaumonde.co.kr` 은 WU-061/079 가 **가격 추출 실패 사이트** 로 측정했다
   (JS 렌더 · 구조화 데이터 0) ⟹ SAME 이 돼도 **가격이 없어 최종 비교에 못 갈 수 있다**
   🟢 그 사실을 **먼저** 재야 한다 — 안 재면 「MI 를 고쳤는데 화면이 안 바뀐다」가 된다
⒟ 🔴 국내 후보 **공급원** 도 좁다(실측 등록부 34 — AUTO_SCRAPE 7 · AUTO_API 1 ·
   MANUAL 13 · NOT_AVAILABLE 13). 🔴 Registry 확대는 §12-0 금지축이다
```

---

## 5. 🟡 **확정한 측정방법** (구현 아님 · CPO 승인 대기)

```
① 분모 — B226AC009 + **B226AC010** 의 국내 라벨 **5건**(SAME 2 · DIFFERENT 3)
   🔴 UNCERTAIN 2 는 분모에서 뺀다(판정 근거로 쓰지 않는다 · 관측만 적는다)
② 하니스 — **WU-138 funnel 그대로**(URL 단위 · 운영 함수 · 스냅샷 불필요)
   🟢 추가 코드 없음. 원상품 URL 만 하나 더 넣으면 된다
③ 먼저 재는 것 — 🔴 **MI 가 아니라 ⒞ 다**: 다섯 후보의 「후보 → 판정 → 대표 → 시장
   → 가격」을 먼저 찍는다. 가격이 없으면 MI 개선으로는 화면이 안 바뀐다
④ 그 다음 — 각 후보의 **blocker 조합** 을 적고, SAME 2 와 DIFFERENT 3 을 **가르는
   축이 실재하는지** 본다. 🔴 없으면 그것이 결론이고 완화하지 않는다
⑤ 판정 — 가르는 축이 있으면 그 축 하나만 최소 수정하고 **반사실로 5건 전수** 재측정
   (biskuit·beaumonde 회복 ↔ luxboy·luksusbaby·kream 방어)
```

🔴 **⑤에 도달하기 전에 코드를 만지지 않는다**(CPO 순서: GT → 측정 → 원인 → 최적안 → 구현).

---

## 6. 🟢🟢 **실행 결과 — 국내 GT 5건 전수 funnel** (CPO 승인 분모 · 2026-10-21)

`wu-138-domestic-funnel.test.ts`(게이트 `WU_138_PROBE=1` · 운영 함수 · 원상품 HTTP 2건).

```
B226AC009 원상품  brand "Bobo Choses" · code B226AC009 · color "Light blue"
B226AC010 원상품  brand "Bobo Choses" · code B226AC010 · color "Heather grey"
🟢 두 원상품 모두 **브랜드가 산다**(WU-137 배선 수정이 여기서도 발화한다)
```

| 원상품 | 호스트 | human | 후보 | 판정 | 대표 | tier | 시장 | 가격 | 최종 | 축 |
|---|---|---|---:|---:|---:|---|---|---|---:|---|
| AC009 | `biskuit.kr` | SAME | O | O | O | PRESUMED_SAME | **KR** | **KRW 88,000** | X | **A MI** |
| AC010 | `beaumonde.co.kr` | SAME | O | O | O | PRESUMED_SAME | **UNKNOWN** | **없음** | X | **A MI + B 가격** |
| AC009 | `m.luxboy.com` | DIFFERENT | **X** | X | X | — | — | — | X | ② URL 게이트 |
| AC010 | `luksusbaby.kr` | DIFFERENT | **X** | X | X | — | — | — | X | ② URL 게이트 |
| AC010 | `kream.co.kr` | DIFFERENT | **X** | X | X | — | — | — | X | ② URL 게이트 |

```
🇰🇷 국내 SAME 2 — 최종 비교 도달 **0** · 둘 다 **A(MI 판정)** 에서 탈락
🇰🇷 국내 DIFFERENT 3 — 누출 0  🔴 단 아래 ⒞ 때문에 **「방어됐다」로 적지 않는다**
```

### 🔴🔴 **두 SAME 의 blocker 가 «다르다» — 이것이 이번 측정의 핵심이다**

```
biskuit.kr     BRAND_MISMATCH · NO_TITLE_OVERLAP   🟢 가격은 **있다**(KRW 88,000)
beaumonde      **BRAND_UNCONFIRMED 하나**          🔴 가격이 **없다** · market UNKNOWN
```

🟢🟢 **CPO 가 예측한 ⒞ 가 그대로 나왔다** — `beaumonde` 는 **SAME 이 돼도 화면에 못 선다**
(가격 0 · market UNKNOWN). ⟹ 🔴 **MI 를 고쳐도 국내 가격비교는 그 1건으로는 안 생긴다.**
WU-061/079 가 측정한 「JS 렌더 · 구조화 데이터 0」 사이트이고 **B 축(가격 수집)** 이다.

⟹ 🔴 **국내 최종 비교를 만들 수 있는 후보는 실질적으로 `biskuit.kr` 1건이고**, 그 1건을
열려면 `NO_TITLE_OVERLAP` 을 열어야 하며 **그것은 WU-138 STEP 4 에서 DIFFERENT 누출로
측정됐다**(순손실). ⟹ **경우 2(기존 축으로 구분 불가) + 경우 3(가격 수집 문제) 동시 성립.**

### 🔴 측정불가 / 정정 (숨기지 않는다)

```
⒜ 🔴 `beaumonde` 의 `BRAND_UNCONFIRMED` 는 biskuit 와 **다른 사유** 다 — 그 샵이
   brand 를 **아예 안 적는다**(biskuit 는 자기 이름을 적는다). 🔴 메우면 WU-080 이
   REJECT 한 그 방향이고 **악화** 가 측정됐다 ⟹ 열지 않았다
⒝ 🔴 `beaumonde` 는 market **UNKNOWN** 이다 — `.co.kr` 인데 **가격이 없어** 통화
   증거가 없다(운영 `classifyCandidateMarket` 은 통화 단독 결정을 금지한다) ⟹
   **가격이 생기면 KR 로 확정될 가능성** 이 있다. 🔴 지금은 미확인이다
⒞ 🔴🔴 **DIFFERENT 3건의 「후보 생성 X」를 「차단 성공」으로 적지 않는다.**
   같은 세션의 WU-138 본 실행에서 `m.luxboy.com` 은 **후보로 들어왔다**(O·O·O).
   이 실행에서는 X 다 ⟹ **실행 간 불안정** 이고 원인 미규명(입력 URL 수·중복 경로).
   🔴 그래서 「DIFFERENT 누출 0」은 **분모가 비어서 나온 값** 이고 **측정불가** 다.
   🟢 유효한 DIFFERENT 방어 측정은 **WU-138 본 실행의 4/4**(해외 포함) 쪽이다
⒟ 🔴 `luksusbaby.kr/collections/bobo-choses` 는 **컬렉션 URL** 이라 상품 상세가 아니다 —
   그 차단은 **올바르다**(WU-073/075 축). 🔴 「동일상품을 버렸다」로 읽지 않는다
⒠ 🔴 국내 SAME 분모는 **2** 다. 「국내 MI 정확도 X%」를 적지 않는다(CPO 지시)
```

---

## 7. 🔴 CPO 판정이 필요한 것 하나

```
🟡 **`B226AC010` 을 측정 분모에 넣을 것인가** — 🟢 기술적으로 가능하고 추가 비용은
   원상품 URL 1건의 HTTP 뿐이다. 🔴 단 그 라벨은 **wu-112/116 의 과거 CEO 판정** 이고
   그 원상품을 CEO 가 **지금** 다시 보는 것이 아니다(라벨 시점이 다르다).
   🔴 CTO 가 「그 라벨을 그대로 쓴다」를 임의로 결정하지 않았다.
🔴 그리고 그것을 넣어도 국내 SAME 분모는 **2** 다 — 「충분한 표본」이라고 적지 않는다.
   추가가 필요하면 그것은 **CEO 육안 GT 작업** 이고 CTO 범위 밖이다.
```

🟢 **CEO 액션 없음**(이번 조사 범위에서).
