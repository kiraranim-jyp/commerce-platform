# WU-073 — 국내 후보 발견량 / 후보 풀 완전성 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「기존 데이터/로그/저장 결과만으로 · 새 AI API 금지 ·
> MI 보호조건 완화 금지 · **soft-404/listing 을 수정하지 말고 어느 단계에서 얼마나
> 섞이는지만** 측정」 · 최종 산출물은 **표 하나**.

---

## 0. 📋 최종 표 — 국내 후보 funnel

| 단계 | 입력 후보 | 국내 | 탈락(국내) | 주요 원인 |
|---|---:|---:|---:|---|
| ① AI 후보 | **181** | **46** | — | 4 모델 합산 · 중복 제거 |
| ② URL 분류 | 181 | **30** | **91 (16)** | `NOT_PRODUCT_PAGE` 87 · `SELF_REFERENCE` 4 |
| ③ fetch 시도 | 90 | 23 | 20 (7) | 🔴 **GT/worklist 선별 — 측정 범위 밖** |
| ④ product evidence | 70 | 23 | **0 (0)** | 🔴 통과율 100% — soft-404 6건도 통과 |
| ⑤ price evidence | 17 | 15 | 2 (2) | beaumonde 구조화 0 |
| ⑥ market KR 확정 | 17 | **7** | 10 | KRW+도메인 증거 없음 · 외화 |
| ⑦ 국내 가격 버킷 | 17 | **5** | 2 | tier `EXCLUDED` |
| ⑧ 최종 EXACT | 5 | **0** | — | 삼중 잠금(WU-069) |

🔴 **③은 이 측정의 한계다** — GT 선별이지 제품 동작이 아니다. 「탈락」으로 읽지 않는다.

### 🔴🔴 그래서 다음 개선은 **discovery 가 아니다**

```
발견량은 병목이 아니다 — AI 가 국내 후보를 **46건** 올린다(①).
🔴 가장 크게 깎이는 구간은 ② **URL 분류**(국내 46 → 30 · −35%) 이고,
🔴 그 다음이 ⑥ **시장 확정**(17 → 7) 과 ⑦⑧ **판정**(5 → 0) 이다.
⟹ 레버 순서는 **② URL 분류 품질 → ⑥ 시장 증거 → ⑦⑧ 판정** 이다.
🔴 단 ⑦⑧ 는 WU-069~072 가 전부 **완화 불가** 로 닫았다.
```

---

## 1. 🔴🔴 가장 큰 발견 — `classifyUrlShape` 가 **양방향으로** 틀린다

| | URL | 운영 분류 | 실제 |
|---|---|---|---|
| 🔴 오통과 | `beaumonde.co.kr/goods/goods_list.php?brandCd=…` | **PRODUCT_PAGE** | 목록 |
| 🔴 오통과 | `bbambam.com/m/product_list.html?type=M` ×2 | **PRODUCT_PAGE** | 목록 |
| 🔴 오통과 | `foretforet.com/shop/shopbrand.html` | **PRODUCT_PAGE** | 목록 |
| 🔴 오통과 | `donokids.com/shop/shopbrand.html` | **PRODUCT_PAGE** | 목록 |
| 🔴 오차단 | `shinsegaemall.ssg.com/item/itemView.ssg?itemId=…` | **UNKNOWN_PAGE** | **상품** |
| 🟢 정상 | `kids21.com/collections/bobo-choses-aw2026` | LISTING_PAGE | 목록 |

```
🔴 오통과 **5건** — 전부 한국 쇼핑몰 CMS(Cafe24/메이크샵 계열) 목록 패턴
🔴 오차단 **1건** — SSG 의 진짜 상품 상세
🟢 ② 통과 90건의 운영 shape 는 **전부 PRODUCT_PAGE** (LISTING/UNKNOWN 0)
```

🔴🔴 **그러므로 ②의 91건 탈락을 「정확한 차단」으로 읽으면 안 된다.** 분류기가
**영문권 URL 문법**(`/products/<handle>`)에 맞춰져 있어 **한국 CMS 를 반대로 읽는다.**
이것이 국내 46 → 30 손실의 성질이다.

🔴 **고치지 않았다** — WU-052 가 「안전한 목록/상품 분리 증거가 없다」로 **HOLD** 했고
(`tennis-warehouse` 오차단 선례) 이번 범위도 **측정** 이다.

### 🔴 측정 중 내가 틀린 것 — 「오통과 7건」을 5건으로 정정했다

```
처음에 URL **전체** 로 CMS 패턴을 매칭했더니 추적 파라미터
`?icid=MAIN.product_listmain_2` 가 걸려 **진짜 상품 페이지 2건**
(littleluna · miniboutique)이 「오통과」로 세어졌다.
🟢 **경로만** 보도록 고쳐 **5건** 으로 확정했다.
🔴 WU-007A 의 「우리 쿼리가 증거로 재활용된다」와 **같은 계열의 함정** 이다.
```

---

## 2. 후보 풀 오염률 (CPO 요청 — 수치화만)

| 오염 유형 | AI 원본 181 | ② 통과 90 | ④ 통과 |
|---|---:|---:|---:|
| 목록 / 검색 URL | **21** | 5 (오통과) | 포함 |
| 홈 / 루트 URL | **9** | — | 포함 |
| soft-404 · 홈 (CEO 확인 · WU-067) | 6 | 6 | 🔴 **6 전부 통과** |
| 자기참조 | 4 | 0 (②가 차단) | — |

🔴🔴 **④ product evidence 가 아무것도 거르지 못한다** — 70 → 70. CEO 가 블라인드
리뷰에서 **404·홈페이지** 라고 직접 판정한 6건이 **전부 facts 를 만들었다.**
🟢 그래도 ⑥⑦⑧ 가 막아서 **최종 가격에는 들어가지 않았다** — 깊이방어는 작동한다.
🔴 단 **화면 후보 목록에는 보인다**(WU-010 이 관측한 그 성질).

---

## 3. 회귀 / Mutation

**Mutation** — baseline **1 passed**

| | 변형 | 결과 |
|---|---|---|
| V1 | `classifyUrlShape` 가 항상 `PRODUCT_PAGE` | 🔴 **1 failed** |
| V2 | 항상 `LISTING_PAGE` | 🔴 **1 failed** |
| — | 원상복구 | 🟢 **1 passed** |

**전체 회귀** — 🔴 CPO §10 포착 장치 적용

```
apps/admin  **579 files / 8,264 passed** / failed **0** (skipped 95)
포착된 실패명 **없음** · typecheck **0** · build **exit 0**
🟢 WU-072 baseline(578/8,263)에서 **+1 file / +1 test** — 이 WU 의 신규 계약뿐이다
```

🔴 금지 준수 — 운영 코드 변경 **0** · 새 AI API 0 · 자동화 0 · MI 완화 0 ·
soft-404/listing **수정 0** · Registry 0 · threshold 0 · 배포 0.

---

## 4. 🔴 Known Unknowns

```
① 🔴 ③ fetch 단계는 **제품 동작이 아니다** — GT 선별이다. 그 20건을 「탈락」으로 세지 않았다
② 🔴 ①의 181 은 **WU-067 표본**(4 모델 · 상품 소수)이다. 전수 498 값이 아니다
③ 🔴 「국내 46」은 도메인 휴리스틱 라벨이고 **운영 `classifyCandidateMarket` 이 아니다**
   (운영 결과는 ⑥의 7 이다 — 두 숫자를 섞지 않는다)
④ 🔴 오통과 5 · 오차단 1 은 **이 표본에서** 관측된 하한이다. 전수 비율이 아니다
⑤ 🔴 ⑤~⑧ 의 분모 17 은 WU-063 표본이고 ①~④ 의 분모와 **다르다**
```

---

## 5. Final Gate

```
Code PASS:   ⚪ 해당 없음(운영 변경 0)   Deploy PASS:         ⚪ 해당 없음
Test PASS:   🟢                        Production UI PASS:  ⚪ 해당 없음
Type PASS:   🟢                        Production API PASS: ⚪ 해당 없음
Build PASS:  🟢                        Production PASS:     ⚪ 해당 없음
```

## 6. CEO Action — **없음**

---

## 7. 🟢 다음 축 (CPO 판단용 · CTO 가 고르지 않았다)

```
⒜ 🔴 **② URL 분류 품질** — 가장 큰 손실 구간이고 **양방향 오류** 가 실측됐다.
   단 WU-052 가 HOLD 한 자리다 — 「URL 문자열로 목록/상품을 가른다」는 증거가 약하다.
   🟡 다른 축 — **fetch 한 HTML 로** 판별한다(JSON-LD Product scope 개수 · WU-053 선례).
   🔴 그러면 비용 축이 바뀐다(차단 전에 받아야 한다) → **제품 정책 판단**
⒝ 🔴 **④ product evidence 가 soft-404 를 통과시킨다** — 6/6. 판별 증거는 미조사
⒞ 🟡 한국어↔영어 음역 매칭(WU-064 가 「범위 밖」으로 남긴 축)
```
