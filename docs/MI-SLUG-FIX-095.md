# WU-095 — `extractSlug` Cafe24 공통 결함 수정 + 영향 범위 (구현 / 배포)

> 🔴 CPO 지시 2026-10-19. 「**새 매칭 규칙을 만드는 작업이 아니다.** 상품 식별에 쓸 수 없는
> 공통 URL 꼬리값 `"1"` 을 slug 로 쓰는 **명백한 구현 오류를 제거하는 작업**이다.」
> 금지 12항 — SAME threshold ❌ · 8축 ❌ · title normalization ❌ · 띄어쓰기 ❌ ·
> brand fallback ❌ · color ❌ · model code ❌ · `very_high → SAME` ❌ · price policy ❌ ·
> Registry ❌ · UI ❌ · AI ❌

---

# WU-095 FINAL

## ① STEP 1 — `extractSlug` **모든 소비처** (🔴 복제본이 **셋**)

| # | 함수 / 위치 | 소비처 | `slug="1"` 의 영향 |
|---|---|---|---|
| ① | `extractSlug` · `match.ts:81` | `:477` **0.95 바닥값** · `:494` 품번 URL 포함 | 🔴🔴 **confidence 거짓 상승 → `very_high`** |
| ② | `extractSlug`(복제) · `product-identity.ts:60` | `:155` `deriveProductMatchTruthFromText` | 🔴🔴🔴 **즉시 `EXACT_PRODUCT`** |
| ③ | `extractUrlSlug` · `shared/product-facts.ts:717` | `sameSellerDistinctListing`(cross-seller:730) · `slugCarriesCode`(:681) · dedupe key(:316) · `extractCodeLikeSlugSegment`(seller-facts:204) | 🟡 **결과 변화 0**(아래) |

🔴 ②의 주석이 **스스로 복제를 자인한다** — 「match.ts를 수정하지 않기 위해 여기 독립적으로 둔다」.

### 🔴🔴 ②가 ①보다 **더 세다**
`deriveProductMatchTruthFromText` 는 slug 가 같으면 **점수를 올리는 게 아니라 `EXACT_PRODUCT` 를
확정** 한다. 그리고 `overseasMatchDisplay`(match-display.ts:319)가 그것을 **`TIERS.SAME`** 으로
바꾼다 ⟹ 🔴 **해외 경로에서 화면에 🟢「동일상품」으로 뜬다.**

### 🟢 ③은 왜 결과가 안 바뀌나 (코드로 확인)
```
sameSellerDistinctListing  현재: slugX==="1" && slugY==="1" → `slugX !== slugY` **false**
                           수정: 둘 다 null → `if (!slugX || !slugY) return false` **false**  ⟹ 같다
slugCarriesCode            "1" 은 4자 미만 코드를 포함 못 함 → false / null → false        ⟹ 같다
dedupe key                 `${sourceUrl} ${urlSlug??""} ${title}` — sourceUrl 이 가른다      ⟹ 안전
extractCodeLikeSlugSegment "1" → 길이·`[a-z]&&[0-9]` 미달로 null / null → null              ⟹ 같다
```
🔴 그래도 **같이 고쳤다** — 셋이 **같은 개념** 이고, 하나만 고치면 다음 사람이 「여기는 왜 다르지」에서
다시 틀린다.

## ② STEP 2 — URL 유형별 현재 동작 (N=**4,247** · 네트워크 0)

| 유형 | 합 | 🔴 숫자 slug | 빈값 | 고유 |
|---|---:|---:|---:|---:|
| 기타 | 2,335 | 69 | 173 | 2,093 |
| **Shopify(`/products/`)** | **1,402** | 🟢 **1 (0.07%)** | 0 | 1,401 |
| 기타 `/product/` | 359 | 54 | 0 | 305 |
| `goods`·`item` 계열 | 119 | 3 | 0 | 116 |
| **Cafe24(`/product/…/display/N/`)** | **32** | 🔴 **32 (100%)** | 0 | **0** |

```
실례  /product/보보쇼즈-허그-헤어리-몬스터-티셔츠-b226ac009/8891/category/367/display/1/ → slug "1"
🔴 slug "1" : URL **26** · 호스트 **3** · **거짓 일치 쌍 325**
🔴 숫자 slug 가 만든 쌍 합계 **781** · 🟢 숫자만 거부해도 남는 쌍 **34,849**(진짜 handle 일치)
```
🔴 **4,247 은 「저장된 측정 산출물」이고 운영 트래픽 분모가 아니다**(CPO §8 준수).

## ③ STEP 3 — 올바른 slug 정의 — 🟢 **기존 기준을 재사용했다**

```
🔴 「두 번째 세그먼트를 쓴다」는 **사이트별 규칙** 이라 채택하지 않았다(이 리포 금지 방향).
🔴 `canonicalListingKey`(self-reference.ts)도 쓸 수 없다 — **host 를 포함** 해서
   교차판매처 비교에서는 **영원히 불일치** 가 된다(의미가 다르다).
🟢 채택: **「숫자만으로 된 세그먼트는 식별 문자열이 아니다」 → null(= 「모른다」)**
   근거는 **이 리포에 이미 있다** — `extractCodeLikeSlugSegment`(product-facts.ts:759)가
   식별자 후보에 **`[a-z]` 와 `[0-9]` 를 둘 다** 요구한다.
🟢 측정이 그 선택을 지지한다 — Shopify 1,402 중 숫자는 **1건** 이라 **잃는 것이 거의 없고**,
   Cafe24 32건은 **전부** 거짓이다.
```

## ④ STEP 4 — 수정 (운영 **3 파일 · +59/-3줄** · 대부분 주석)
```ts
if (!last) return null;
const slug = <기존 정규화>;
/** 🔴 WU-095 — 숫자만이면 식별 신호로 쓰지 않는다(null = 「모른다」). */
if (!slug || SLUG_IS_NUMERIC_ONLY.test(slug)) return null;
return slug;
```
🔴 **새 SAME 규칙도 threshold 도 추가하지 않았다** — 거짓 신호를 **빼기만** 했다.

## ⑤ STEP 5 — **결정적 counterfactual** (S1 5건 · 운영 함수)

| | 수정 전 | 수정 후 |
|---|---|---|
| confidence | **0.95 ×5** | **0.1 ×3 · 0 ×2** |
| matchLevel | **very_high ×5** | **low ×5** |
| reason | 「URL slug 일치」 ×5 | 🟢 **사라짐** |
| `toDomesticMatchType` | **EXACT ×5** | **NOT_MATCHED ×5** |
| `matchTruth` | TEXT_CONFIRMED 3 · CONFLICT 2 | INSUFFICIENT_EVIDENCE 7 · CONFLICT 3 |
| `deriveProductMatchTruth` | 🔴 **EXACT_PRODUCT ×3** | 🟢 **0** (SIMILAR 3 · CONFLICT 3) |
| 🟢 **False SAME** | **0** | **0** (유지) |
| SAME 승격 | — | 🔴 **0** |

🔴 **S1-1 / S1-4 / S1-5 는 여전히 구별되지 않는다**(셋 다 `low` · SIMILAR). 🟢 **그래도
이것이 성공** 이다 — CPO §5 의 성공 기준은 「**confidence 가 실제 텍스트 증거를 반영하는 것**」
이지 「SAME 증가」가 아니다. 🔴 WU-093 의 「precision 40%」도 **거짓 confidence 위의 값** 이라
폐기한다.

## ⑥ STEP 6 — 가격/비용 게이트 재검증 (정책 변경 **0**)
```
상세확인 대상  **2 → 0**
⟹ 🔴 「잘못된 very_high 때문에 상세확인 대상이 잘못 선정되었는가」 = **그렇다. 2건이었다.**
🟢 그 2건은 외부 HTTP 를 쓰는 작업이었다(불필요한 비용).
🔴 가격 자격 정책 자체는 **한 줄도 바꾸지 않았다** — 입력이 정직해졌을 뿐이다.
```
🔴 WU-094 의 「EXACT_PRODUCT 3건 → cap 2 → 배열 순서로 2건」도 **사라졌다**(EXACT_PRODUCT 0).

## ⑦ STEP 7 — Gemini 게이트 영향
```
foundVeryHighInP0 의 입력 = `candidates.some(c => c.matchLevel === "very_high")`
   수정 전 very_high **5** ⟹ **스킵 발화**(Gemini 안 부름)
   수정 후 very_high **0** ⟹ **스킵 안 함**
⟹ 🔴 **거짓 very_high 가 Gemini 탐색을 막고 있었다.**
🔴 flag OFF 라 **실제 호출 증가는 측정불가** 이고 🔴 **비용 추정도 하지 않았다**(CPO 지시).
```

## ⑧ STEP 8 — 영향 URL 분모 (재검증)
```
전수 4,247 · 숫자 마지막 세그먼트 **159** · 값 "1" **26**
호스트: looxloo 20 · biskuit 19 · miniboutique 18 · mustit 17 · littleluna 19 ·
        luxboy 9 · wconcept 3  ⟹ 🔴 **전부 한국 쇼핑몰**
🔴 「404」 25건은 WU-076 의 probe URL 이라 **운영 분모가 아니다**(노이즈로 표시)
🔴 **4,247 을 운영 트래픽 분모라고 쓰지 않는다**
```

## ⑨ regression
```
계약 **7건**(`wu-095-numeric-slug.test.ts` · **네트워크 0**)
음성대조 — **M1 2F**(match 가드 제거) · **M2 2F**(identity) · **M3 2F**(shared) ·
          **M4 3F**(조건 **반전** → Shopify 를 죽인다) → 복구 **7 passed**
🟢🟢 전체 **599 files / 8,361 passed · failed 0**
   🔴 **기존 계약이 하나도 안 깨졌다** — 그 거짓 신호에 **의존하는 올바른 계약이 없었다**는 뜻이다
typecheck **0** · build **exit 0**
```

## ⑩ production smoke
배포 후 아래 §Deploy 참조.

---

## 🔴🔴 측정 오류를 하나 잡았다 — 그대로면 거짓 결론이었다

```
1차: GT 를 **인덱스**(`S1-domain-N`)로 매핑했다.
🔴 그런데 `withConfidence` 가 **정렬** 을 하므로 slug 수정으로 **순서가 바뀌었고**
   라벨이 **엉뚱한 후보에 붙었다** — 수정 후 「human SAME 인데 conf 0(양말)」이 나왔다.
🔴 그대로 보고했으면 **「수정했더니 진짜 동일상품이 0점이 됐다」** 는 거짓 결론이었다.
🟢 fixture 를 **SKU 키** 로 바꿔 고정했다(`76A7D-L30-05` 등).
```

## 🔴 CPO 질문 — **「최소 1개 함수로 끝나는가」**

```
🔴 **아니다.** 같은 로직이 **세 벌** 로 복제돼 있고 셋 다 고쳐야 했다.
🟢 다만 **소비처별 별도 처리는 필요 없었다** — 세 함수에 **같은 한 줄** 이면 끝난다.
🔴 세 벌을 **하나로 합치는 리팩터는 하지 않았다** — 이 WU 의 범위가 아니고,
   합치려면 `normalizeText`/`normalizeFactText` 가 서로 다른 패키지라 의존 방향을 바꿔야 한다.
```

---

## 🔴 Known Unknowns

```
① 🔴 **4,247 은 저장된 측정 산출물** 이다 — 운영 트래픽 분모가 아니다
② 🔴 **S1 1상품 · 후보 5건** 으로만 전후를 비교했다. 전수 재측정은 하지 않았다
③ 🔴 Gemini 스킵 변화는 **조건 변화만** 쟀다 — 실제 호출 증가·비용은 **측정불가**(flag OFF)
④ 🔴 숫자 slug 159건 중 **「1」이 아닌 상품번호**(4117·9445 등)도 null 이 된다.
   같은 사이트 안에서 그 번호가 유일한 식별자였던 경우의 **손실은 미측정**
   (🟢 자기참조는 `isSelfReferenceCandidate` 가 따로 처리한다)
⑤ 🔴 Shopify 의 숫자 handle **1건**(`/products/7417855`)도 null 이 된다 — 그 1건의 영향 미측정
⑥ 🔴 이 수정이 **국내 EXACT 를 늘리지 않는다**. 여덟 보호축 결론은 **그대로** 다
⑦ 🔴 세 복제본을 **합치지 않았다** — 다음에 네 번째 복제가 생기는 것을 막는 장치는 **계약 테스트 하나** 뿐이다
```

## 판정 — 🟢 **구현 / 배포 완료**

```
🟢 거짓 slug 신호 제거 · confidence 가 실제 텍스트 증거를 반영한다(0.95 → 0.1/0.0)
🟢 잘못된 가격 상세확인 대상 **2 → 0** · 거짓 Gemini 스킵 **제거**
🟢 False SAME **0 유지** · Shopify 의 진짜 handle 일치 **보존**
🔴 SAME 은 늘지 않았다 — **그것이 이 WU 의 목표가 아니다**
```

## CEO Action — **없음**
