# MLS2 — FINAL EVIDENCE STANDARD (동일상품 판단 기준)

> 🔴🔴 **코드 변경 0 · 새 수집 0 · HTTP 0 · DB 쓰기 0 · Identity/가격 정책 변경 0.**
> 🟢 재현: `npx tsx packages/database/scripts/mls2-standard-analysis.mjs` (read-only)
> 🟢 전체 후보 비교표: `%TEMP%\mi-p0-02\mls2-candidate-table.jsonl` (**38행** · 후보당 1행)
> 🔵 선행 자료 — `docs/IPES-STEP1-EVIDENCE-INVENTORY.md` · `docs/IPES-STEP2-CPO-EVIDENCE-DOSSIER.md`

---

## 1. 제품 목적과 동일상품 판단 원칙

**100% 동일상품을 증명하는 시스템이 아니다.** 판매 가능성이 높은 후보를 **놓치지 않고**
발견하고, 근거와 불확실성을 투명하게 보여 **셀러가 판단**하게 한다(CPO 확정).

```
① 후보 발견      넓게            ② 동일상품 가능성  핵심 근거로 분류
③ 판매 판단      가격 + 근거      ④ 가격 비교        고확률 ↔ 유사 후보를 섞지 않는다
```

## 2~3. Evidence 전체 정의 — **핵심 3축 + 가산 축**

| 구분 | 축 | 정의 | 비교 방법 |
|---|---|---|---|
| **핵심** | `BRAND` | 브랜드 | 영문·한글·표기 변형 정규화 |
| **핵심** | `PRODUCT_NAME` | 상품명 | 번역·표기·시즌명 차이 고려 |
| **핵심** | `DETAIL_IDENTIFIER` | 품번·모델코드·스타일코드 | 기본정보 **및 상세설명** 출처 비교 |
| 가산 | `IMAGE` `FORM` `COLOR` `MATERIAL` `AUDIENCE` `CATEGORY` `OPTION/SET` | 보강 근거 | 🔴 **핵심 불일치를 덮지 못한다** |

🔴 **상세설명에서 찾은 브랜드는 `BRAND` 에, 상품명은 `PRODUCT_NAME` 에, 품번은
`DETAIL_IDENTIFIER` 에 귀속한다** — **네 번째 축을 만들지 않는다**(CPO 보정).
🔴 같은 정보를 여러 출처에서 읽었다고 **독립 근거로 중복 계산하지 않는다**.

## 4. 영문·한글 브랜드 정규화 기준

```
🟢 등록부(`brand-alias.ts`)에 **실측 등록된** 한글 표기만 공식 검색어로 쓴다
   현재 4건 — Bobo Choses→보보쇼즈 · Pèpè Shoes→페페 · Emile et Ida→에밀에이다 ·
              Konges Slojd Clothing→콩제슬래드
🔴 미등록 브랜드의 alias 를 **추론·자동번역·유사발음으로 만들지 않는다**
🔴 미등록이어도 **원문 영문 검색은 유지** 한다(사전 등록 ↔ 검색 가능을 분리한다)
🟢 정규화는 NFKD + 결합 발음기호 제거 + 소문자(`PèPè` == `pepe`)
```

## 5. 상품명 번역 및 표기 변형 기준

```
🔴🔴 **상품명 표기 차이는 「다른 상품」이 아니다.** 국내 판매처는 상품명을 **자기 말로
   다시 쓴다** — 「허그 헤어리 몬스터 티셔츠」 ↔ 「Hug Hairy Monster T-shirt」는
   토큰 겹침이 **0** 이고 그것이 **정상** 이다.
🔴 그래서 `NO_TITLE_OVERLAP` 은 **약한 차이** 로 분류한다(§9).
🔴 **식별력 없는 한글 번역어는 검색어로 쓰지 않는다** — 실측: 저장된 `titleKo` 의 한글
   토큰이 전부 일반 카테고리 명사다(「키즈 티셔츠」·「바지」) ⟹ 브랜드 전체 카탈로그를 부른다.
🟢 한글 질의는 **「alias + 고유 식별 토큰」** 꼴만 만든다(`buildKoreanDiscoveryQueries`).
```

## 6. 상세설명 식별정보 추출 기준

```
🟢 라벨된 품번 — 「Product code」 / 「Article code」(`extractLabeledProductCode`)
🟢 우선순위(`resolveBrandModelCode`) — ⒜ **설명문 라벨** → ⒝ 제목 → ⒞ URL slug
🔴 **기본정보에 값이 없다는 이유로 상세설명 근거를 버리지 않는다**
🔴 판매자 SKU 를 제조사 품번으로 **단정하지 않는다**(Smallable `AAA1804922` 와
   Bobo `B226AC114` 는 글자 구성이 사실상 같아 모양으로 못 가른다)
🔴 이미지 OCR 은 **운영 미지원** 이다 — 「지원한다」로 적지 않는다
```

## 7. 원본 출처 및 신뢰도 보존 기준

각 Evidence 는 **원본값 · 정규화값 · 출처 · 추출 위치 · 신뢰도 · 상태 · 충돌 여부**를
같이 들고 간다. 🟢 원상품은 이미 `{value, source, confidence}` 로 저장돼 있다.
🔴 기본정보와 상세설명의 값이 다르면 **하나를 고르지 않고 둘 다 보존해 충돌로 표시**한다.

## 8~9. 상태 정의 — **네 상태 · 불일치는 두 등급**

| 상태 | 뜻 | 계산 |
|---|---|---|
| `MATCHED` | 양쪽이 같다고 **확인됐다** | 일치로 센다 |
| `MISMATCHED` | 양쪽이 다르다고 **확인됐다** | 🔴 등급을 가른다(아래) |
| `UNKNOWN` | **모른다**(값이 없다) | 🔴 일치로도 불일치로도 **세지 않는다** |
| `CONFLICT` | 출처끼리 값이 다르다 | 🔴 숨기지 않고 **따로 표시** |

```
강한 불일치   BRAND 확정 불일치 · DETAIL_IDENTIFIER 확정 불일치
              ⟹ 🔴 고확률에서 **제외** 한다(언어 중립 축이라 「다름」이 곧 다른 상품)
약한 차이     PRODUCT_NAME 불일치(번역 · 표기 · 시즌명 · 판매처 자체 상품명)
              ⟹ 🟢 **고확률을 막지 않는다** · 🔴 단 「상품명 표기 차이」로 **말한다**
```

## 10~11. 2-of-3 고확률 판단 기준 + 가산 기준

```
CONFLICTED     강한 불일치 ≥ 1          ← 🔴 **개수 검사보다 먼저** 본다
HIGH           확인된 일치 ≥ 2 · 강한 불일치 0
POSSIBLE       확인된 일치 = 1 · 강한 불일치 0
INSUFFICIENT   확인된 일치 = 0 (전부 미확인)
```
🔴 가산 근거는 **보강만** 한다 — 아무리 많아도 강한 불일치를 덮지 못한다(계약으로 잠김).
🔴 축당 상태는 **하나** 다 ⟹ 같은 원문을 여러 경로로 읽어도 **한 축은 한 번만** 센다.
🔴 이 분류는 **표현 계층** 이다 — `crossSellerVerdict` 를 입력으로만 쓰고 **덮지 않는다**.

## 12. 🔴🔴🔴 전체 CEO GT 대조 결과 — **기준을 검증할 수 없다**

**분모**: 운영 DB 사람 판정 **38행** · 원상품 **6** · 고유 후보 URL **36**(🔴 중복 2 · 병합 0)
CEO 판정 — **SAME 22 · DIFFERENT 15 · SIMILAR 1**

| 상품 | CEO 분포 |
|---|---|
| B226AC009 | SAME 18 · DIFFERENT 5 |
| B226AC033 | DIFFERENT 5 · SAME 1 |
| B226AC110 | DIFFERENT 3 · SIMILAR 1 |
| B226AC036 | SAME 2 |
| B226AC170 | DIFFERENT 2 |
| B226AC073 | SAME 1 |

### 🔴🔴 핵심 3축 확보 현황 — **이것이 이 문서의 가장 중요한 숫자다**

| 축 | MATCHED | MISMATCHED | **UNKNOWN** |
|---|---:|---:|---:|
| `BRAND` | 24 | 10 | 4 |
| `PRODUCT_NAME` | **3** | 11 | **24** |
| `DETAIL_IDENTIFIER` | **0** | 1 | **37** |

🔴🔴🔴 **축 셋 중 둘이 사실상 미측정이다.** `DETAIL_IDENTIFIER` 는 **37/38 이 UNKNOWN** 이고
`MATCHED` 가 **0** 이다 ⟹ **「독립 근거 2개 이상」이 구조적으로 성립할 수 없다.**

### CEO 판정 × 고확률 분류

| CEO 판정 | HIGH | POSSIBLE | CONFLICTED | INSUFFICIENT | 합계 |
|---|---:|---:|---:|---:|---:|
| SAME | **1** | 18 | 0 | 3 | 22 |
| DIFFERENT | **0** | 4 | 10 | 1 | 15 |
| SIMILAR | 0 | 0 | 1 | 0 | 1 |
| UNCERTAIN | — | — | — | — | 0 |

```
평가 가능 분모 **36 / 38** (🔴 핵심 3축 전건 UNKNOWN 2행 제외 — 성공/실패로 세지 않는다)
   평가 가능 CEO SAME **20** · CEO DIFFERENT **15**
🟢 DIFFERENT → HIGH (오포함)  **0 / 15**     ⟸ 🟢 **기준이 다른 상품을 넣지 않는다**
🔴 SAME → HIGH               **1 / 20**     ⟸ 🔴 **이 수를 재현율로 쓰지 않는다**
```

🔴🔴 **「1/20」은 기준의 성능이 아니라 «저장 데이터의 결손» 이다.** 놓친 19건의 축이
`BRAND:MATCHED · PRODUCT_NAME:UNKNOWN · DETAIL_IDENTIFIER:UNKNOWN` 으로 **같고**,
그 UNKNOWN 의 원인은 Evidence 가 **애초에 저장되지 않은 것**이다:

| Evidence 칸 | 확보 | 비율 |
|---|---:|---:|
| `match_truth`(품번 축 입력) | 16 / 38 | 42% |
| `match_reasons`(상품명 축 입력) | 12 / 38 | 32% |
| `system_verdict` | 21 / 38 | 55% |
| `candidate_title` | 17 / 38 | 45% |
| `price_amount` | 17 / 38 | 45% |
| `price_status` | 12 / 38 | 32% |
| `market` | 16 / 38 | 42% |
| 🔴 `image_url` | **0 / 38** | **0%** |
| 🔴 `human_note`(CEO 사유) | **0 / 38** | **0%** |

🔴 **CEO 판정 사유가 운영 DB 에 한 건도 없다.** 🟢 단 fixture 쪽에는 있다
(`core-same03-human-gt.json` 의 `why` · `core-2m-ceo-visual-gt.json` 의 `ceoBasis`) ⟹
**두 자료를 합쳐야** 사유가 보존된다(DOSSIER §1 의 그 분리).

## 13. 오분류 및 미측정 사례

```
🟢 **오포함 0** — CEO DIFFERENT 15건 중 HIGH 로 올라간 것이 **없다**
🟢 CEO DIFFERENT 15 중 **CONFLICTED 10** — 강한 불일치가 정확히 잡는다
   (BRAND_MISMATCH 10 · NO_TITLE_OVERLAP 11 · BRAND_UNCONFIRMED 4)
🔴 CEO DIFFERENT → POSSIBLE **4** — 브랜드만 맞고 나머지가 미확인인 행이다
   ⟹ 🔴 「가능성 있음」이 과하다고 볼 수도 있으나 **근거가 없어 가릴 수 없다**(측정불가)
🔴 CEO SAME → INSUFFICIENT **3** · 평가 제외 **2**
🔴 시스템 판정이 **없는** 행 **17 / 38**(CEO SAME 중 15) ⟹ 대조 자체가 불가능한 구간
🔴 가격 자격(`VERIFIED_CURRENT`) 통과 **2 / 38** ⟹ 가격 비교 검증도 이 분모로는 불가
```

## 14. 기존 Identity 정책과의 관계

```
🟢 **읽기만 한다** — `crossSellerVerdict` · `blockers` · `matchTruth` · `matchReasons`
🔴 변경하지 않는다 — threshold · `SAME_MIN_AXES` · 8축 · blocker · GT · human_verdict ·
   가격 eligibility · brand-alias 등록부 · Registry · DB/schema
🟢 **분류 어휘를 분리했다** — `HIGH/POSSIBLE/CONFLICTED/INSUFFICIENT` 는 Identity 어휘
   (`SAME`/`PRESUMED_SAME`)와 **겹치지 않는다**(계약으로 잠김) ⟹ 「여기서 판정이 일어난다」
   고 읽히지 않는다
🔵 기존 시스템과의 차이(실측) — `PRESUMED_SAME → CONFLICTED` **13** 이 이 기준의 주된 기여다
   (그 13행은 DOSSIER 가 전수 제출한 **사람 DIFFERENT ↔ 시스템 PRESUMED_SAME** 과 같은 집합)
```

## 15. 실제 후보별 판정 예시

🟢 전수는 `mls2-candidate-table.jsonl`(38행 · 축 상태 · 근거 · 가격 · 생산자 포함).

| 원상품 | 후보 | CEO | 시스템 | 축 상태 | 분류 |
|---|---|---|---|---|---|
| AC033 | junioredition.com | **SAME** | PRESUMED_SAME | BRAND ✅ · NAME ✅ · ID ❔ | 🟢 **HIGH** |
| AC033 | designerkidswear.com | DIFFERENT | PRESUMED_SAME | BRAND ❌(STONE ISLAND) | 🔴 CONFLICTED |
| AC033 | kidbizkid.com | DIFFERENT | PRESUMED_SAME | BRAND ❌(Hugo Boss) | 🔴 CONFLICTED |
| AC009 | biskuit.kr | SAME | (없음) | BRAND ✅ · NAME ❔ · ID ❔ | 🟡 POSSIBLE |
| AC009 | villagekids.co.uk | DIFFERENT | PRESUMED_SAME | BRAND ❔ · NAME ❌ | 🔴 CONFLICTED |

---

## 🔵 기준 확정 결과 — **CPO 판정을 요청하는 지점 둘**

🟢 **확정된 것(이 문서 §1~§11)** — 축 정의 · 정규화 · 네 상태 · 불일치 두 등급 ·
2-of-3 · 가산 규칙 · 출처 보존. 🟢 그 기준은 **오포함 0/15** 로 검증됐다.

🔴🔴 **확정할 수 없는 것 — 재현율** 이고 원인이 명확하다:
```
`DETAIL_IDENTIFIER` MATCHED **0/38** · `PRODUCT_NAME` MATCHED **3/38**
⟹ 축 셋 중 둘이 저장돼 있지 않아 **2-of-3 이 발화할 분모가 없다**
🔴 이것은 **기준을 느슨하게 해서 풀 문제가 아니다** — 느슨하게 하면 오포함 0 이 깨진다
🟢 풀리는 길은 하나 — **기존 후보 URL 로 Evidence 를 다시 채우는 것**
   (후보 URL 은 36개가 **전부 보존돼 있다** ⟹ 새 검색·새 수집이 필요 없다)
```

🟡 **CPO 결정 요청 2건**(🔴 CTO 가 고르지 않았다)
```
⒜ **Evidence 재적재** — 보존된 후보 URL 36개로 BRAND·PRODUCT_NAME·DETAIL_IDENTIFIER 를
   다시 추출해 저장할 것인가. 🔴 새 상품 수집이 **아니고** 기존 후보의 근거 보강이다.
   🟢 그것이 되면 이 문서 §12 표를 **같은 분모로 다시** 채울 수 있다.
⒝ **CEO 판정 사유 통합** — DB 에 `human_note` 가 0 이고 fixture 에만 `why`/`ceoBasis` 가
   있다. 두 자료를 합칠 것인가(🔴 라벨 번역·병합은 CPO 결정이라 CTO 가 하지 않았다).
```
