# WU-087 — 실제 AI 결과 한 덩어리 → 국내/해외 가격비교 운영 E2E (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「AI API ❌ · 자동 브라우저 ❌ · 검색엔진 ❌ ·
> AI 의 SAME 판정 ❌ · 8축 ❌ · **코드 변경 0 이 기본값**」

---

# WU-087 FINAL

## 1. 실제 AI 결과 입력 방식 — 🔴 **한계를 먼저 적는다**

```
🔴 새 AI 를 부르지 않았다(금지). B226AC112 를 «새로 조사시킨» 결과가 **아니다.**
🟢 대신 WU-073 이 저장한 **실제 AI 산출** 을 썼다 — **4개 모델 · Bobo Choses 상품군 ·
   URL 181**. 그것을 「1. 판매처 … — https://…」 형태의 **답변 산문** 으로 되돌려
   운영 추출기(`extractCandidateUrlsFromAiAnswer`)에 **그대로** 넣었다.
🔴 즉 측정한 것은 **「AI 가 내는 URL 의 품질 분포」** 이고 **AI 정확도가 아니다**(CPO §1 과 일치).
```

## 2~10. 📋 Funnel (운영 owner 호출)

| 단계 | 전체 | 국내 | 해외 |
|---|---:|---:|---:|
| ① AI URL | **181** | 46 | 135 |
| ② URL 추출 | **94** | 30 | 64 |
| ③ fetch OK | **69** | 20 | 49 |
| ④ evidence(브랜드/품번) | **62** | 13 | 49 |
| ⑤ **가격** | **12** | 9 | 3 |
| ⑥ market 확정 | **8** | 5 | 3 |
| ⑦ 국내/해외 자격 | **8** | **5** | **3** |

🔴 **UI 후보(⑩)는 재지 않았다** — `priceTier` 는 `judgeDomesticCandidate` 가 만들고
WU-085 에서 **지어내다 걸렸으므로** 반복하지 않았다.

### 🔴🔴 ⑤ 가 **최대 손실 구간** 이다 — 62 → 12 (**-50**)

```
해외가 특히 심하다 — evidence **49 → 가격 3**.
🔴 내가 처음에 「내 하니스가 enrichCandidatePrices 를 안 불러서」로 의심했다(WU-079 의 교훈).
🟢 **운영 경로(collectUrlCandidatePool → withConfidence → enrichCandidatePrices)로
   다시 돌렸고 «같은 숫자» 가 나왔다** — 가격 12(국내 9 · 해외 3) · 국내 자격 5 · 해외 3.
⟹ **분모 오염이 아니다. 진짜 병목이다.**
```

🟢 **owner 확정** — `price-source-adapter.ts` `enrichCandidatePrices`:
```
const eligibleIndexes = selectCandidatesForDetailConfirmation(withDefaultSource, query);
if (eligibleIndexes.length === 0) return withDefaultSource;   ← 🔴 여기서 끝난다
```
🔴 그리고 그 앞에 **Shopify 경로가 `price: null` 로 고정** 된다(통화를 모른다).
실측: fetch OK 69 중 **SHOPIFY_JSON 53** · 가격 없는 57 중 **53 이 SHOPIFY_JSON**.

## 11~12. 국내 / 해외 funnel

### 국내
```
AI 46 → 추출 30 → fetch 20 → evidence 13 → 가격 9 → **market KR 5** → 자격 **5**
🟢 5건: biskuit ₩88,000 · biskuit ₩258,000 · littleluna ₩117,000 ·
        miniboutique ₩117,000 · mustit ₩226,000
🔴 가격 9 중 4건이 `KRW_WITHOUT_DOMAIN_EVIDENCE` 로 **UNKNOWN**
   ⟹ **KRW 라는 이유만으로 KR 로 올리지 않았다**(CPO §4 준수 · WU-077 이 REJECT 한 군)
```

### 해외
```
AI 135 → 추출 64 → fetch 49 → evidence 49 → 가격 3 → **OVERSEAS 3**
🔴 evidence 49 → 가격 3 이 **이 WU 최대의 단일 손실** 이다(위 ⑤ owner).
```

## 13. 주요 탈락 원인 (Top causes)

| 순위 | 원인 | 건수 | 비고 |
|---|---|---:|---|
| 1 | ⑤ **가격 미확보** | **50** | `selectCandidatesForDetailConfirmation` + Shopify `price:null` |
| 2 | ② `NOT_PRODUCT_PAGE` | **87** | AI URL 의 **48%** 가 목록/홈/카테고리다 |
| 3 | ③ `UNREACHABLE` | 15 | 사이트 쪽 |
| 4 | ③ `REDIRECTED_AWAY` | **8** | 🟢 **WU-075 가 일하고 있다**(홈/목록으로 튄 후보) |
| 5 | ⑥ `KRW_WITHOUT_DOMAIN_EVIDENCE` | 4 | 🟢 올바른 보류(WU-051/077) |
| 6 | ③ `NO_FACTS` | 2 | 제목조차 없음 |

### 🔴 URL 품질 분류 (운영 `classifyUrlShape` · N=181)
```
PRODUCT_PAGE **94** · LISTING_PAGE **58** · UNKNOWN_PAGE **29**
⟹ AI 가 주는 URL 의 **절반 가까이가 상품 페이지가 아니다.**
🔴 WU-086 에서 본 모양이 그대로 재현됐다 — 홈 · 카테고리 · 쿠팡 스토어.
🔴 그리고 WU-073 이 기록한 **분류기 양방향 오류** 는 그대로다(한국 CMS 목록이 PRODUCT_PAGE ·
   SSG 진짜 상품이 UNKNOWN). 🔴 이번에도 **고치지 않았다**(WU-052 HOLD).
```

## 14. 코드 변경 — **0**

```
운영 코드 0 · 8축 0 · Registry 0 · AI API 0 · 검색엔진 0 · 배포 0
🔴 §7 의 수정 조건(「정상 통과해야 할 URL 을 **시스템 버그** 로 탈락」)에 해당하는 것을
   **찾지 못했다**. ⑤의 가격 게이트는 **버그가 아니라 비용 정책** 이다
   (`MAX_DETAIL_CONFIRMATIONS_PER_SHOP` 계열 · 의도된 상한).
```

## 15~16. regression / production

```
apps/admin  **595 files / 8,333 passed** / failed **0** (skipped 105)
typecheck **0** · build **exit 0** · Production **200**
🟡 HTTP 약 190 요청(read-only · 캐시 적용) · provider 호출 **0**
```

## 17. 🟡 **HOLD**

```
GO      🔴 아니다 — 배선은 연결되지만 **양** 이 운영 가치를 말하기엔 부족하다
                    (AI URL 181 → 국내 자격 **5**(2.8%) · 해외 **3**)
REJECT  🔴 아니다 — **구조적으로 불가능하지 않다.** 실제로 국내 5 · 해외 3 이 끝까지 갔다
🟡 **HOLD** — CPO §9 의 「후보는 들어오지만 AI 후보량/품질 때문에 운영 가치 판단이
   불가능함」에 정확히 해당한다.
```

## 18. 운영 결론

```
🟢 **배선은 끝나 있다**(WU-086 이 증명 · 이번에 181건 규모로 재확인).
🔴 그런데 **AI 한 덩어리로 얻는 국내 후보는 5건** 이다. 그리고 그 5건에
   **품번이 하나도 없다**(`code=null` 5/5) — 동일성은 다른 축으로 가려야 한다.
🔴🔴 **지금 가장 큰 레버는 「AI 를 더 부르는 것」이 아니라 두 가지다**:
   ⒜ ⑤ **가격 확보**(-50) — 🔴 비용 게이트라 **제품 정책** 이다. 코드 버그가 아니다
   ⒝ ② **AI URL 품질**(상품 페이지 48%) — 🔴 그것은 **프롬프트/운영 방식** 이지 코드가 아니다
🟢 그래서 「운영 프로토콜」의 결론은 하나다 —
   **AI 에게 「상품 상세 페이지 URL 만」 요구하는 것이 코드 수정보다 효과가 크다.**
   🔴 단 그것은 CPO/CEO 의 운영 지침이지 CTO 가 정할 것이 아니다.
```

## 🔴 Known Unknowns

```
① 🔴 **B226AC112 를 새로 조사시킨 AI 결과가 아니다** — WU-073 저장분이다(AI 호출 금지)
② 🔴 ⑩ UI 후보 수는 **재지 않았다**(`priceTier` 를 지어내지 않기 위해)
③ 🔴 국내 5건에 **품번이 0건** 이다 — 「동일상품 5건」이 아니라 「가격 자격 5건」이다
④ 🔴 ⑤의 50건 손실에서 **Shopify `price:null`** 과 **`selectCandidatesForDetailConfirmation`**
   의 기여도를 **가르지 않았다**(둘 다 owner 로 확인만 했다)
⑤ 🔴 「국내 46 / 해외 135」는 **도메인 휴리스틱 라벨** 이고 운영 `classifyCandidateMarket`
   산출(국내 5)과 **다른 축** 이다 — 섞지 않는다
```

## CEO Action — **없음**
