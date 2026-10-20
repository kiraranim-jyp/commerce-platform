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

## 6. 🔴 CPO 판정이 필요한 것 하나

```
🟡 **`B226AC010` 을 측정 분모에 넣을 것인가** — 🟢 기술적으로 가능하고 추가 비용은
   원상품 URL 1건의 HTTP 뿐이다. 🔴 단 그 라벨은 **wu-112/116 의 과거 CEO 판정** 이고
   그 원상품을 CEO 가 **지금** 다시 보는 것이 아니다(라벨 시점이 다르다).
   🔴 CTO 가 「그 라벨을 그대로 쓴다」를 임의로 결정하지 않았다.
🔴 그리고 그것을 넣어도 국내 SAME 분모는 **2** 다 — 「충분한 표본」이라고 적지 않는다.
   추가가 필요하면 그것은 **CEO 육안 GT 작업** 이고 CTO 범위 밖이다.
```

🟢 **CEO 액션 없음**(이번 조사 범위에서).
