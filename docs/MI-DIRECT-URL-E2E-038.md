# WU-038 — 직접 URL 후보 공급 → 동일상품 가격비교 E2E

> 🔴 AI **0** · 외부 검색 API **0** · Registry 0 · threshold 0 · 색상사전 0 ·
> brand dictionary 0 · 운영 코드 변경 **0**. 쓴 것은 **우리가 직접 적은 후보 URL 의
> 공개 상품 페이지 GET** 뿐이다.

---

## 1. 먼저 — 「유사상품 11개」의 정체

```
B226AC043 Production 실측(DB)
  저장된 국내 링크 domestic_product_links   **0건**
  가격 관측                                  SELLER_ORIGIN 6건 = **원상품 자신**(₩113,136)
  동일상품(EXACT) 레코드                      **0**
```
🔴 화면의 11개는 **해외 비교검색의 `COMPARISON` tier** 이고,
`EXACT/CONFIRMED 만 동일상품 가격으로 사용` 규칙([match-display.ts:14](../apps/admin/src/app/pipeline/commerce/match-display.ts))에 따라
**애초에 가격비교 후보가 아니다.**

---

## 2. 직접 URL 공급 E2E — 실측 퍼널

### B226AC009 Hug Hairy Monster T-Shirt (원상품 brand = `"Bobo Choses"`)

| 단계 | 결과 |
|---|---:|
| ① 입력 URL | **4** |
| ② Fetch · 추출 성공 | **4** |
| ③ MI SAME | **3** |
| ④ MI PRESUMED_SAME | 1 |
| ⑤ **가격 VERIFIED_CURRENT** | **2** |
| ⑥ 그중 **KRW** | **0** 🔴 |
| ⑦ 가격비교 진입(DB 링크) | **0** 🔴 |

| 후보 | MI | 가격 | Human GT |
|---|---|---|---|
| bobochoses.com | **SAME** | **EUR 40** · VERIFIED | SAME ✅ |
| tinyapple.net | **SAME** | **USD 58** · VERIFIED | SAME ✅ |
| trenbe.com | SAME | 없음 | **DIFFERENT** 🔴 False SAME |
| luxboy.com | PRESUMED_SAME `NO_TITLE_OVERLAP` | KRW 59,000 · UNVERIFIED | DIFFERENT ✅ 막힘 |

### B226AC043 Mystery BC half zipped sweatshirt (원상품 brand = **`null`**)

| 단계 | 결과 |
|---|---:|
| ① 입력 URL | 1 |
| ② 추출 | 1 |
| ③ **MI SAME** | **1** 🟢 |
| ⑤ 가격 | **EUR 75 · VERIFIED_CURRENT** |
| ⑦ 가격비교 진입 | **0** 🔴 |

🟢🟢 **WU-037 의 효과가 실제 운영 데이터에서 확인됐다** — 원상품 brand 가 `null`(사이트가
brand 칸을 비워 둠)인데도 `bobochoses.com` 후보가 **SAME** 을 받았다. 직전까지는
`BRAND_UNCONFIRMED` 로 막혔을 쌍이다.

---

## 3. A / B / C / D — 섞지 않고 가른다 (CPO 요구)

```
A 후보 공급   🟢 **정상** — 5/5 fetch·추출 성공. UI 입력칸 → POST /check(candidateUrls)
              → url-candidate-pool → MI 까지 **이미 배선돼 있다**
B MI 연결     🟢 **정상** — SAME 4건 생성. SAME MISS **0**
              🔴 단 False SAME 1 (trenbe · WU-036 과 동일한 그 건)
C 가격 검증   🟢 **정상** — `enrichCandidatePrices` 가 transient 에도 적용되고
              VERIFIED_CURRENT 가 3건 나온다
D 집계 / UI   🔴🔴 **여기서 막힌다. 그리고 벽이 «둘» 이다.**
```

### 🔴 D-1 — 통화 게이트 (먼저 막는다)

VERIFIED 가격 3건이 **EUR 40 · USD 58 · EUR 75** 로 **전부 외화** 다.
국내 축은 `priceKrw == null` 이면 버리고 `currency: "KRW"` 로 고정한다(WU-019R).
→ **국내 동일상품 가격비교에 한 건도 들어가지 못한다.**

🔴 유일한 KRW 가격(luxboy ₩59,000)은 `UNVERIFIED_SEARCH` 이고 MI 가
`PRESUMED_SAME` 으로 막았으며 **Human GT 도 DIFFERENT** 다 — 막힌 것이 옳다.

### 🔴 D-2 — 저장 게이트 (구조적)

`isTransientShopId` 가 `upsertDomesticProductLink` **앞에서** 끊는다
([run-domestic-price-check.ts:1110](../apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts)).
그런데 가격비교/EXACT 집계는 **`listDomesticProductLinks`(DB)** 를 읽는다
([market-intelligence.ts:38](../apps/admin/src/app/api/price-history/_lib/market-intelligence.ts)).

> **직접 공급한 URL 은 SAME 이고 가격이 VERIFIED 여도 가격비교에 «구조적으로»
> 진입할 수 없다.** WU-024 가 「저장 0」을 불변식으로 세웠기 때문이다.

---

## 4. 🔴 최초 탈락 지점

```
**D-1 (통화/시장 게이트)** 이 먼저고, 그 뒤에 **D-2 (저장 게이트)** 가 있다.
A · B · C 는 전부 통과한다.
```

🔴 그러므로 「검색이 안 된다」가 **아니다.** 이 상품들은 **우리가 닿을 수 있는 범위에
국내 KRW 동일상품 판매처가 없다** — 찾아낸 동일상품이 전부 해외(EUR/USD)다.
🟢 헌장의 핵심 KPI(`55/498 = 11.0%`)와 같은 방향이고, 원인도 같다.

---

## 5. 브랜드 공백 — 측정만 (CPO 지시대로 합치지 않았다)

```
B226AC043 최신 스냅샷 brand = **""**  (과거분은 `"AW26"` = 시즌코드)
🟢 그런데 **SAME 판정을 막지 않았다** — WU-037 의 same-store 규칙이 통과시켰다.
🔴 다른 스토어였다면 `BRAND_UNCONFIRMED` 로 막혔을 것이다(WU-036 의 9건이 그것).
```
🔴 새 brand dictionary / Registry / threshold / 색상사전 **변경 0.**

---

## 6. 🔴 하니스가 두 번 틀렸고 둘 다 고쳤다 (숨기지 않는다)

```
① **CONTROL 이 거짓 통과했다** — host 정규화가 `global.`·`m.` 를 떼는데
   GT 키를 원문(`global.trenbe.com`)으로 둬서 조회가 null 이 됐고,
   **유일한 False SAME(trenbe)이 「미판정」으로 빠졌다.**
   🟢 키를 맞추고 「GT 가 전건 붙었는가」를 **먼저** 단언하도록 고쳤다.
② **운영 경로를 한 단계 빠뜨렸다** — transient 에도 적용되는
   `enrichCandidatePrices`(:1078 `isUrlPool` 분기)를 안 불렀다.
   그 상태의 1차 측정은 「SAME 전건 가격 없음」이었고 **그것이 틀린 결론** 이었다.
   🟢 추가하자 VERIFIED_CURRENT 3건이 나왔다. 이 저장소에서 반복된 §5-B 함정이다.
```

---

## 7. 검증

```
회귀      admin **553 files / 8,103 passed · failed 0** · typecheck **0**
운영 변경  **0** — 배포 없음(측정 WU)
CONTROL   WU-036 재현 — Human SAME 2 · False SAME 1(trenbe) · SAME MISS 0
```

---

## 8. 최종 판정

```
A 후보 공급   🟢 작동한다 — 직접 URL 경로는 **이미 끝까지 배선돼 있다**
B MI          🟢 작동한다 — SAME MISS 0
C 가격 검증   🟢 작동한다 — VERIFIED_CURRENT 3
D 가격비교    🔴 **막힌다** — D-1 통화 게이트 · D-2 저장 게이트
──────────────────────────────────────────
**HOLD** — 남은 둘은 **제품 정책 결정** 이고 CTO 가 임의로 바꾸지 않는다.
```

### 🔴 CPO 결정 둘

```
① **해외 동일상품 가격을 셀러에게 보여줄 것인가**
   지금은 국내 KRW 축만 가격비교에 들어간다. 이번 실측에서 **확정된 동일상품의
   가격이 전부 외화** 였다. 🔴 환산은 하지 않는다는 기존 정책과 함께 결정해야 한다.
② **직접 공급한 SAME 후보를 저장할 것인가**
   WU-024 의 「transient 저장 0」 불변식을 유지하면 **영구히 가격비교에 못 들어간다.**
   🔴 풀려면 `domestic_product_links.source_id` 가 등록부 FK 라는 점을 같이 봐야 한다
   (헌장이 이미 「Registry 구조 변경 → 별 WU」로 분리해 둔 자리다).
```

🔴 **CEO Action: NONE.**
