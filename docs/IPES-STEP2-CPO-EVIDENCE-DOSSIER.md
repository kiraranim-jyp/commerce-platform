# IPES PHASE A~B — CPO 직접 검토용 Evidence DOSSIER

> 🔴🔴 **CTO 는 이 문서에서 판정 기준을 만들지 않았다.** 점수·가중치·필수조건·임계값 **0** ·
> 라벨 **번역 0** · 병합 **0** · 중복 제거 **0** · 추론 보충 **0** · 새 검색/추출 **0** · DB 쓰기 **0**.
>
> 🟢 재현(read-only): `node packages/database/scripts/ipes-dossier.mjs`
> 🟢 인벤토리(선행): `docs/IPES-STEP1-EVIDENCE-INVENTORY.md`

---

## 1. 패키지 구성 — 추가 요청 없이 검토할 수 있도록 한 번에

| 산출물 | 내용 | 행 수 |
|---|---|---:|
| `ipes-rows.jsonl` | **원본 행 전수** — `source_id` · `source_row_id` · 원문 라벨 · `raw`(원본 노드 통째) | **491** |
| `ipes-evidence.jsonl` | (원상품 × 후보) 쌍별 **Evidence 나란히** + 출처 + 확인상태 + 기계적 비교 | **249** |
| `ipes-lineage.jsonl` | 같은 후보 URL 이 여러 자료에 등장하는가 — 🔴 **표시만** | **67** |

경로: `%TEMP%\mi-p0-02\` (세션 재생성 가능 · 스크립트가 read-only)

### 원본 행 — 자료 성격 넷으로 갈라 보존(CPO A-2)

```
CEO_GT                  90    사람이 직접 내린 동일/다름/판단불가
OPERATIONAL_DB_HUMAN    38    운영 candidate_reviews 의 human_verdict 보유 행
OPERATIONAL_DB_OBSERVED 142   human_verdict 없는 관측 행
DB_EXPORT               38    🔴 sprint5-brand-gt = 위 38행의 export(**같은 데이터**)
VALUE_LABEL             52    🔴 USEFUL/NOISE/UNSURE — **동일상품 판정이 아니다**
SYSTEM_DUMP            131    🔴 시스템 판정(운영 덤프) — 사람 판정으로 세지 않는다
```

🔴 **합계를 「고유 후보 수」로 읽지 않는다.** 중복 가능성 URL **67건**이 표시돼 있고, 중복
확정·병합은 **CPO 검토 전 수행하지 않았다**.

---

## 2. 🟢 라벨 어휘 — **원문 전수**(번역 0)

```
verdict=PRESUMED_SAME 61 · verdict=SAME 52 · verdict=DIFFERENT 27 · verdict=CONFLICT 4 ·
verdict=UNCERTAIN 2                                   ← 🔴 이 `verdict` 는 **시스템** 판정이다
humanVerdict=SAME 46 · DIFFERENT 31 · SIMILAR 2        ← 운영 DB + export(중복 포함)
human=SAME 23 · DIFFERENT 16 · UNCERTAIN 8             ← fixture 계열
ceoUiLabel=동일 8 · 유사 1 · 판단불가 1
calibrationLabel=SAME 8 · DIFFERENT 1 · UNCERTAIN 1    ← 🟢 `유사 1` ↔ `DIFFERENT 1` 이 parkette
ceo=동일 5 · 판단불가 5                                 ← core-same03(「다른제품」 0)
value=NOISE 38 · UNSURE 12 · USEFUL 2                  ← 🔴 가치 라벨
```

🔴 **CTO 측정 한계 하나를 적는다** — 제 수집기가 `label`/`value` 키를 라벨로 보기 때문에
`label=Bobo Choses` · `label=Racchetto Polo` 같은 **브랜드/상품명 문자열 10건** 이 섞여 집계됐다.
🟢 `ipes-rows.jsonl` 의 `raw` 에 원본이 그대로 있으니 CPO 가 직접 가릴 수 있다. 🔴 제가
**분류를 고치지 않았다**(그것이 「라벨 임의 통합」이다).

---

## 3. 사람 ↔ 시스템 대조 — 🔴 **두 분모를 섞지 않는다**

| 분모 | 불일치 행 | 구성 |
|---|---:|---|
| **운영 DB 단독**(권위) | **18** | DIFFERENT↔PRESUMED **13** · SAME↔PRESUMED **4** · SIMILAR↔PRESUMED **1** |
| 전체 자료(중복 포함) | 37 | DIFFERENT↔PRESUMED 26 · SAME↔PRESUMED 8 · SIMILAR↔PRESUMED 2 · DIFFERENT↔CONFLICT 1 |

🔴 **37 은 `DB_EXPORT` 38행이 DB 38행과 겹쳐 생긴 수** 다 ⟹ **정밀도 계산에 쓰지 않는다.**
🟢 STEP 1 이 보고한 **21행 대조 / PRESUMED 4·18** 은 **운영 DB 단독 분모** 이고 이번에 원본
행으로 **재현됐다**(SAME↔SAME 3 + 위 18 = 21).

---

## 4. 🟢🟢🟢 사람 DIFFERENT ↔ 시스템 PRESUMED_SAME **13행 전수** — 한 가지 모양이다

CPO 가 전수 제출을 지시한 그 13행이다. 🔴 **일치 근거 세 축이 13행에서 글자 그대로 반복된다.**

| 원상품 | 후보 판매처 | 후보 상품명 | 일치 근거(`근거:`) | 불일치 근거(`보류:`) | 가격 |
|---|---|---|---|---|---|
| AC033 | designerkidswear | Boys Blue Cotton Sweatshirt | 상품군 TOP↔TOP · 색상 BLUE · 대상 KIDS | **브랜드 Bobo Choses ↔ STONE ISLAND JUNIOR** · 상품명 겹침 0 · 소재 | 260 CAD |
| AC033 | folkberlin | Baby Sweater Suit ''Blue Moon'' | 상품군 TOP↔TOP · 색상 BLUE · 대상 KIDS | **브랜드 ↔ Gray Label** · 상품명 겹침 0 · 소재 · 연령 CHILD↔BABY | 39 EUR |
| AC033 | kidbizkid | **Hugo Boss** Navy Zip Sweatshirt | 상품군 TOP↔TOP · 색상 BLUE · 대상 KIDS | **브랜드 ↔ Hugo Boss** · 색상명 · 상품명 겹침 0 · 소재 polyester:100 · 연령 CHILD↔JUNIOR | 27100 CAD |
| AC033 | petitemaisonkids | Maya Girls' Blue Cotton Sweater Top | 상품군 TOP↔TOP · 색상 BLUE · 대상 KIDS | **브랜드 ↔ Petite Maison Kids** · 상품명 겹침 0 · 소재 · 연령 · **형태 SWEATSHIRT↔TOP** | 12700 USD |
| AC033 | shoppiccoliandco | Jude Navy Baby Boy Anchor Sweater | 상품군 TOP↔TOP · 색상 BLUE · 대상 KIDS | **브랜드 ↔ Piccoli & Co™** · 색상명 · 상품명 겹침 0 · 연령 | 9700 USD |
| AC009 | villagekids.co.uk | Pale Blue 3D Logo T-Shirt | *(reasons 미보존)* | NO_TITLE_OVERLAP · MATERIAL · AUDIENCE_LINE · **BRAND_UNCONFIRMED** | 21.2 GBP |
| AC009 | cemarose.ca | *(미보존)* | *(미보존)* | *(blockers null)* | — |
| AC009 | tinyapple.net | *(미보존)* | *(미보존)* | *(blockers null)* | — |
| *(나머지 5행은 `ipes-evidence.jsonl` 에 전수 수록)* | | | | | |

### 🔴 이 표에서 CTO 가 «관측만» 하고 판정하지 않은 것

```
① 일치 근거가 **상품군 · 색상 · 대상** 셋으로 13행에서 **반복** 된다
② 불일치 근거에 **브랜드** 가 거의 항상 있다(BRAND_MISMATCH 또는 BRAND_UNCONFIRMED)
③ 「핵심 상품명에 겹치는 말이 없다」가 거의 항상 같이 있다
④ 그런데도 시스템 판정은 **PRESUMED_SAME** 이고 tier 는 **COMPARISON** 이다
🔴 ①~④ 를 「그러므로 기준은 이러해야 한다」로 **적지 않았다** — 그것이 CPO 결정이다
🟢 참고 — 🟢 **가격 «자격» 에서는 BRAND_MISMATCH 가 이미 막는다**(운영 89건 → 집계 0건 ·
   `brand-conflict-price-real.test.ts`). 즉 ④는 **후보 노출/판정 축** 의 사실이다
```

🟡 **부수 관측(이미 CPO 가 「수정 불필요」로 판정한 축)** — `27100 CAD` · `12700 USD` ·
`9700 USD` 는 `271.00 → 27100` 꼴 **소수점 유실 ×100 패턴** 이고, 앞서 GBP 에서 본 것과 같다.

---

## 5. 🔴 Evidence 결손 — 원본 기준 재확인(사람 판정 38행)

```
image_url **38/38 없음**  ·  price_status 26  ·  market 22  ·  match_truth 22  ·
candidate_title 21  ·  price_amount 21  ·  system_verdict 17  ·  🟢 match_reasons **0**
```
🔴 **STEP 1 보고의 「match_reasons 38/38 없음」을 정정한다** — 실제는 **0/38 없음**(전건 보유)이다.
🔴 결손 이유는 **원인 미상** 으로 둔다(확인 가능한 출처가 자료에 없다).
🔴 위 13행 중 3행(cemarose · tinyapple · villagekids 일부)은 `reasons`/`blockers` 가 비어 있다 —
   **그 공백을 추론으로 채우지 않았다.**

### 🟢 원상품 Evidence 는 «출처·신뢰도» 를 들고 저장돼 있다

`product_snapshots.workspace.canonicalProduct` 의 각 칸이 `{value, source, confidence}` 다.
🟢 그래서 `ipes-evidence.jsonl` 의 `origin_source`/`origin_confidence` 는 **지어낸 값이 아니다**.
🔴 실측 예 — B226AC009 의 `brand = {value:"", source:"REQUIRED", confidence:0}`
   ⟹ **원상품 브랜드가 빈 문자열** 이다(그 사실이 그대로 보존돼 있다).
🟢 원상품 스냅샷이 품번으로 매칭된 상품 **27개**(B226AB069 … B226TC179).

---

## 6. 🔵 CEO 가 당시 검수한 «화면» 자립형 HTML 12종 — 원본 그대로

```
docs/core-same03-domestic-review.html  4.6MB   docs/core-2m-visual-review.html   8.3MB
docs/core-2aj-ceo-review.html          4.0MB   docs/core-2al-ceo-review.html     6.1MB
docs/wu-112-candidate-list.html        7.6MB   docs/wu-099-dropped-review.html   7.8MB
docs/wu-123-gt-review.html             3.9MB   docs/wu-125-gt-review.html        1.4MB
docs/wu-093-gt-review.html             2.6MB   docs/wu-111-gt-review.html        0.7MB
docs/core-desc-evidence-review.html    0.1MB   docs/search-provider-05-urls.html 1.3MB
```
🟢 이미지가 `data:` URI 로 **임베드** 돼 있어 로그인·네트워크 없이 그때의 후보 사진이 뜬다.
🔴 그래서 **「image_url 38/38 없음」과 「당시 사진을 볼 수 없다」는 다른 말** 이다 —
   DB 칸은 비었지만 **화면 자료에는 사진이 있다**. 🔴 단 **같은 후보라고 추정해 연결하지 않았다**
   (CPO A-1 의 그 금지) — 연결은 URL 이 일치할 때만 가능하고 그 대조는 수행하지 않았다.

---

## 7. 🔴 PHASE A~B 에서 «하지 않은» 것 — 전수

```
❌ 판정 기준 · 점수 · 가중치 · 필수조건 · 임계값 수립
❌ 라벨 번역/정렬(SAME ↔ 동일 ↔ USEFUL …)      ❌ 중복 확정 · 병합 · 제거
❌ 결손 Evidence 추론 보충                      ❌ 이미지 추정 연결
❌ 새 검색 · 새 추출 · 새 후보 수집              ❌ 기존 CEO 판정 데이터 수정
❌ Identity / 가격 자격 / GT / Search 정책 변경  ❌ DB 쓰기
❌ AI Search 20→40 확대(별도 건 · 이번 작업과 혼합 금지)
```

---

## 8. 🔵 CPO 결정을 기다리는 항목 여덟 (PHASE C)

| | 결정 사항 | 이 문서가 제공하는 재료 |
|---|---|---|
| ① | 동일상품 판단의 **핵심** Evidence | §4 의 13행 + §5 의 원상품 `{value,source,confidence}` |
| ② | **보조** Evidence | §4 에서 13행 전부가 공유하는 세 축(상품군·색상·대상) |
| ③ | 동일상품을 **제한** 하는 불일치 Evidence | §4 의 `보류:` 열(브랜드·상품명·소재·연령·형태) |
| ④ | **확인 불가** Evidence 처리 | §5 결손표 · `BRAND_UNCONFIRMED` 사례(villagekids) |
| ⑤ | Evidence **충돌** 처리 | §4 의 `COLOR_VARIANT`(색상명 ↔ 색조) 2건 |
| ⑥ | Evidence **조합** 기준 | §4 — 세 축 일치 + 브랜드 불일치가 PRESUMED 를 받는 모양 |
| ⑦ | CEO 라벨 **의미 정렬** | §2 어휘 전수 · parkette(`유사`→`DIFFERENT`) · core-same03(「다른제품」 0) |
| ⑧ | 기존 Identity 정책과의 **관계** | STAGE 4-G(`cross-seller.ts:1309` PRESUMED 가 blocker 를 안 본다 · CPO 동결 중) |

🔴 **기준이 확정되면** CTO 는 자료 재수집 없이 **PHASE D(B226AC009 파일럿)** 로 바로 들어간다.
🔴 그 전까지 규칙을 만들거나 전체 상품에 적용하지 않는다.
