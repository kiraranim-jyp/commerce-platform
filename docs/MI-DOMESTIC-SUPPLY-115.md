# WU-115 — 국내 동일상품 후보 **공급 경로 조사** (`MANUAL` 전수 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「`MANUAL` 등록부를 전수 조사한다. **가격 완전 금지.**
> 해외 · ⑧ 게이트 · 샵당 BEST · 8축 · threshold · 품번 보호 · AI API · 기존 GT 재검토 전부 ❌」

---

# [WU-115 완료 보고]

## 0. 🔴 먼저 — **`MANUAL` 은 12곳이 아니라 13곳이다**

DB 실측(`domestic_price_sources` · `collection_strategy='MANUAL'` · 전부 `enabled=true`):

```
29cm.co.kr · chouchouenfant.kr · coconjennie.com · danawa.com · karymarket.com ·
kidikidi.elandmall.co.kr · kream.co.kr · musinsa.com · nokimore.com · ocokorea.com ·
shoppinghow.kakao.com · ssfshop.com · wconcept.co.kr          ⟹ **13**
🔴 지시서/헌장의 「12」를 정정한다.
```

## 1. STEP 1 — 조사 대상을 **먼저 가렸다**(아무 샵이나 긁지 않는다)

🔴 헌장 메모 `portal-scraping-blocked-by-terms` — 「robots 허용 ≠ 약관 허용 · 자동수집은
포털이 아니라 **판매처** 로 늘린다」. 🟢 그래서 **robots.txt 를 읽기만** 하고 포털은 **검색하지 않았다**.

| 분류 | 수 | 비고 |
|---|---:|---|
| 포털/오픈마켓 | **9** | 🔴 **검색 안 함**(약관) — 그중 `musinsa` · `wconcept` · `kidikidi` · `shoppinghow` 는 robots **전면차단**(`Disallow: /`)이기도 하다 |
| 판매처(SHOP) | **4** | chouchouenfant.kr · coconjennie.com · karymarket.com · nokimore.com |
| robots 조회 실패 | 2 | `ocokorea.com` · `ssfshop.com`(둘 다 포털 · HTTP 0) |

```
🟢 robots 13곳 전수 조회 — HTTP 200 **11** · 실패 2 · 전면차단 **4**(전부 포털)
🟢 판매처 4곳은 전면차단이 **아니다** ⟹ 그 4곳만 검색 반사실을 돌렸다
```

## 2. 🔴🔴 STEP 2 결과 — **새 국내 후보 0 건** · 그런데 원인이 「상품이 없다」가 아니다

```
S1 B226AC010 / S2 B226AC009 — 판매처 4곳 전부 **status: "unsupported" · 후보 0**
```

🔴🔴 **그리고 그 `unsupported` 는 「MANUAL 이라서」가 아니다** — 반사실에서 **AUTO_SCRAPE 로
세워도 같았다.** 코드로 확인한 게이트는 **둘** 이다(`index.ts:271·278`):

```ts
① source.collectionStrategy !== AUTO_API && !== AUTO_SCRAPE  → unsupported
② findPriceSourceAdapter(domain, "DOMESTIC") === null         → unsupported   ← 🔴 여기서 막혔다
```

```
🔴🔴 즉 **등록부 전략을 바꿔도 후보는 0 이다.** 막는 것은 **도메인 어댑터의 부재** 다.
🟢 국내 어댑터는 **8개** 뿐이다(price-source-adapter.ts) —
   looxloo.com · bobochoses.com · rulii.co.kr · skysport.co.kr ·
   deuxbebe.com · littleluna.co.kr · chocoel.co.kr · foretforet.com
   🔴 그중 `bobochoses.com` 은 등록부에서 **enabled=false** · `skysport` 은 **TENNIS** scope
   ⟹ 아동의류에서 실제로 뒤지는 곳은 **6곳**(WU-092/114 가 돌린 그 6곳)
🔴 등록부 34곳 중 **26곳은 어댑터가 없다** ⟹ 「등록부에 있다」≠「뒤질 수 있다」
```

## 3. STEP 3 — **생성하지 않았다**

```
새 국내 후보가 **0건** 이라 CEO 육안 GT 목록을 만들 대상이 없다.
🟢 기존 GT 27건은 **다시 판정하지 않았다**(CPO 금지 준수).
```

## 4. 🔴🔴 STEP 4 — **조건이 성립한다**

> 🔴 **「현재 Registry 구조로는 국내 동일상품 후보 공급이 부족하다」 — 확정.**

```
근거 셋
 ① `MANUAL` 13곳 중 **판매처는 4곳** 이고, 그 4곳은 **어댑터가 없어 검색 자체가 안 된다**
 ② 나머지 9곳은 **포털/오픈마켓** 이고 **약관으로 자동수집 대상이 아니다**(헌장 메모)
 ③ 아동의류에서 실제로 뒤지는 샵은 **6곳** 이고, WU-114 에서 그 6곳이
    S1·S2 에 대해 **정상 응답 + 후보 0**(그 상품을 안 판다)
⟹ 🔴 공급을 늘리는 길은 **샵별 어댑터 추가** 하나이고, 그것은 §12-0 이
   「카테고리마다 별도 사이트 Adapter 추가 ❌ · 국내 쇼핑몰 Registry 확대 ❌」로 **금지한 방향** 이다.
🔴 **그래서 CTO 는 어댑터를 만들지 않았다.** 다음 결정은 CPO 몫이다.
```

🟡 **참고로 남는 사실 하나**(이번 범위 밖 · 구현 0) — 현재 국내 후보 **3건은 전부
「AI URL 풀」** 에서 왔다(WU-114). 🔴 즉 **지금 국내 공급은 등록부가 아니라 AI 가 하고 있다.**
🔴 그 경로를 늘리는 것은 **AI 프롬프트/정책** 영역이고 CPO/CEO 결정이다.

---

## 🔴 Known Unknowns

```
① 🔴 표본 **원상품 2개** 다 — 「판매처 4곳이 그 상품을 판다/안 판다」는 **측정하지 못했다**
   (검색 자체가 돌지 않았으므로 **「없다」가 아니라 「확인 불가」** 다)
② 🔴 robots 판정은 「`*` 그룹의 `Disallow: /`」만 봤다 — 경로별 규칙은 **보지 않았다**
③ 🔴 포털 9곳은 **의도적으로 조사하지 않았다**(약관) — 「후보 0」으로 세지 않는다
④ 🔴 `ocokorea.com` · `ssfshop.com` 의 robots 조회 실패 원인은 **규명하지 않았다**(포털이라 범위 밖)
⑤ 🔴 가격은 **한 건도 수집·평가하지 않았다**(CPO 금지)
```

## 결론 — 🔴 **공급 부족 확정 / 다음은 CPO 결정**

```
MANUAL 전수            🟢 **13곳**(지시서 12 정정) · robots 전수 조회 완료
검색 가능 판매처         🔴 **0** — 4곳 전부 **어댑터 부재** 로 `unsupported`
새 국내 후보            🔴 **0** ⟹ STEP 3 생성 대상 없음
막는 지점               🟢 `index.ts:278` `findPriceSourceAdapter(domain,"DOMESTIC") === null`
국내 어댑터 보유         🟢 **8개**(아동의류 실효 **6곳**) · 등록부 34곳 중 **26곳은 어댑터 없음**
⟹ 🔴 **STEP 4 성립** — 현재 Registry 구조로는 국내 공급이 부족하다
🔴 운영 변경 **0** · 배포 0 · DB 변경 **0** · Registry 변경 **0** · 가격 **0**
```
