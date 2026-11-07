# MI-REEVAL **STEP 1** — 기존 테스트 데이터 전수 조사 · 중복 제거 기준

> 🔴 **운영 코드 변경 0 · matcher 0 · Identity 0 · extractor 0 · alias 0 · GT 변경 0 ·
> DB 쓰기 0 · schema 0 · Shadow 평가 0.** STEP 1 은 **분모와 키를 정하는 단계** 다(CPO §8).
> 산출 — `mi-reeval-01-inventory.test.ts`(네트워크 0 · DB 0) · 영속 fixture 둘.

---

## 0. 🔵 중복 제거 기준 — **제안** (CPO 확인 필요)

```
PRIMARY KEY  canonicalizeProductUrl(원본 URL) + " >> " + canonicalizeProductUrl(후보 URL)
FALLBACK KEY originCode + " >> " + canonicalizeProductUrl(후보 URL)
             🔴 원본 URL 이 **없는** 행에만 쓴다(스냅샷 소실 17건) · 🔴 두 키를 합치지 않는다
```

**왜 그 정규화기인가**
```
🟢 `canonicalizeProductUrl` 은 이 리포의 **식별 보존** 정규화기다 — `?variant=` ·
   `?product_no=` · `?branduid=` 같은 **실재하는 식별 정보를 지우지 않는다**.
🔴 `normalizeCandidateUrl` 은 쿼리를 **통째로** 비운다 ⟹ 같은 상품의 다른 옵션이 한 쌍으로 뭉친다.
🔴 **로케일을 접지 않는다** — `/en-kr/` 과 `/` 는 이 리포 정책상 **다른 시장** 이다
   (메모 `self-reference-collapses-collections-not-locale` · `self-reference` 계약).
```

🔴 **CPO 확인 포인트 둘** — ⒜ 로케일을 접지 않는 것이 맞는가 ⒝ 보조 키(originCode)를
1급 키와 **분리해서** 세는 것이 맞는가. **CTO 가 임의로 합치지 않았다.**

---

## 1. 출처별 «원시» 규모 — 🔴 **합산하지 않는다**

| 출처 | 규모 | 들고 있는 것 |
|---|---:|---|
| [참고] fixture 전수 인구조사 | 전체 **44** · 수집 17 · 제외 27 | 🔴 그 17 파일의 라벨 행은 **이 인벤토리의 분모가 아니다** |
| `SAME05_PAIRS`(wu-059 + wu-068) | **33** 쌍 | 원본 URL · **기존 기준 GT** · `ProductFacts` |
| CEO Evidence Review(2026-11-07) | **11** 쌍 | 🔴 **CEO 최신 판정**(별도 칸) · 운영 재현값 · DB MI |
| DB `candidate_reviews` 사람 판정 | **38** 행 | `human_verdict` · 🔴 **그중 원상품 스냅샷 없음 17** |
| 상세설명 비교 | **109** 쌍 | 🟢 **다섯 증거 확보 현황의 유일한 출처** |

🔴 인구조사 합이 44 인 이유 — `core-same03-human-gt.json` 이 **수집·제외 두 목록에 모두**
있다(「수집함(아래 별도)」). 🟢 결함이 아니다.

---

## 2. 중복 제거 결과

```
🟢 고유 비교 쌍(Pair)  **140**
🟢 키를 만들 수 없어 제외  **0**   (조용히 버린 행이 없다)
```

| 출처 조합 | 쌍 |
|---|---:|
| `desc-compare` 단독 | **71** |
| `db:candidate_reviews` + `desc-compare` | **36** |
| `same05` 단독 | **22** |
| `ceo-review` + `same05` | **11** |

🔴🔴 **주목 — `same05`(33) 와 `desc-compare`(109) 가 «하나도» 겹치지 않는다.**
```
원인은 **원상품 집합이 다르다** — `same05` 는 원본 6개(S1~S6)이고 상세설명 비교는
`product_snapshots` 의 원본 **27개** 다.
⟹ 🔴 두 증거 묶음이 **서로를 보강하지 못한다**. 「140쌍을 한 분모로」 쓰면 그 사실이 가려진다.
⟹ 🟡 STEP 5 평가의 실질 분모는 **세 묶음으로 갈라야** 한다 — ⒜ same05 33 ⒝ CEO 11
   ⒞ desc-compare 109(그중 DB 라벨 36).
```

---

## 3. 라벨 — 🔴 **기존 GT 와 CEO 최신을 섞지 않았다**(CPO §2)

```
기존 GT 보유  **69**   ·   CEO 최신 보유  **11**   ·   둘 다  **11**
```
🟢 계약으로 잠갔다 — CEO 최신이 기존 GT 칸(`priorGt`)에 들어가면 **FAIL** 한다.

### 🔴 충돌 **3건** — 전부 적는다

| # | 쌍 | 충돌 | 성격 |
|---|---|---|---|
| ① | `villagekids.co.uk/products/pale-blue-3d-logo-t-shirt`(B226AC009) | **db=SAME ↔ desc-gt=DIFFERENT** | 🔴 **기존 GT «내부» 충돌** — 같은 쌍에 서로 다른 기존 라벨이 있다 |
| ② | `tinyapple.net/...modern-tracksuit-jacket-multicolor`(C50) | 기존 DIFFERENT ↔ **CEO UNDECIDED** | 404 로 비교 불가(CEO 가 그렇게 적었다) |
| ③ | `main-story.com/products/bubble-sweatshirt-grey-melange-1`(C42) | 기존 SAME ↔ **CEO DIFFERENT** | Main Story · 🔴 CPO 가 **기존 GT 유지** 로 판정했다 |

🔴 ① 은 **이번에 처음 드러났다** — CPO 가 판정할 사안이다(어느 라벨이 기준인가).
🔴 CTO 는 **아무 라벨도 고치지 않았다.**

---

## 4. 운영 MI 결과 보유 — 🔴 **재현값과 DB 저장값을 가른다**

```
재현값 보유  **118 / 140**        DB 저장값 보유  **20 / 140**
재현 분포   PRESUMED_SAME 84 · SAME 13 · CONFLICT 3 · SIMILAR 1 ·
            🔴 BASELINE_NOT_REPRODUCED **17** · 없음 **22**
DB 분포     PRESUMED_SAME 16 · SAME 4 · 없음 **120**
```
🔴 「없음 22」는 `same05` 단독 쌍이다 — 그 쌍의 운영 재현은 **STEP 4** 에서 `same05Judge` 로 만든다.
🔴 **DB 저장 MI 는 140 중 20 뿐이다** ⟹ 「기존 MI 판정」의 주 출처는 **재현값** 이고,
   그것은 **「그때의 운영 판정」이 아니다**(STEP 4 보고에 그대로 적는다).

---

## 5. 🔴🔴 CEO 다섯 증거 확보 현황 — **③ 품번이 병목이다**

분모는 **상세설명 비교가 닿은 107쌍** 이다(🔴 나머지 **33쌍은 측정불가** — 그 조사가 닿지 않았다).

| CEO 기준 | 확보 | 비고 |
|---|---:|---|
| ① 상품명 원문 | **90 / 107** | 원본·후보 제목이 **둘 다** 있는 쌍 |
| ② 상품명 | **107 / 107** | 🟢 전건 |
| ③ **품번 / 모델 코드** | 🔴 **29 / 107** | **27%** — 다섯 축 중 유일하게 낮다 |
| ④ 상세설명 | **80 / 107** | 원본·후보 설명문이 **둘 다** 있는 쌍 |
| ⑤ 정규화 토큰 | **107 / 107** | 🟢 전건 |

🔴🔴 **그래서 STEP 5 설계의 제약이 하나 확정됐다** — 품번은 **107쌍 중 29** 에서만 쓸 수 있다.
「품번 일치만으로 SAME 금지」는 CPO 가 이미 못 박았고, 여기 숫자는 그 반대 방향도 말한다 —
**품번 부재가 다수** 이므로 ①②④⑤ 가 실질 판단축이 된다.

---

## 6. 🔴 측정불가 · 한계 — 숨기지 않는다

```
🔴 33 / 140 쌍은 **증거 확보 현황을 모른다**(상세설명 비교가 닿지 않았다)
🔴 17 행은 **원상품 스냅샷이 없다**(전부 `B226AC009`) ⟹ 원본 쪽 증거가 **구조적으로 측정불가**
   🟢 단 그 GT 라벨은 **실재한다** ⟹ 버리지 않고 보조 키로 실었다
🔴 `same05` 22쌍은 운영 재현값이 **아직 없다**(STEP 4 에서 만든다)
🔴 `BASELINE_NOT_REPRODUCED` **17** 쌍은 기존 MI 와 대조 자체가 성립하지 않는다
🔴 `same05` ↔ `desc-compare` **교집합 0** ⟹ 한 분모로 쓰면 그 사실이 가려진다
🔴 브랜드 편향 — Bobo Choses 계열이 다수다(이전 조사에서 57~85% 로 측정됐다)
```

---

## 7. 🔴 내가 이번에 고친 것 — 조용한 손실 하나

```
🔴🔴 1차 덤프가 `join` 이라 **행 17개를 조용히 버렸다**:
   `human_verdict` 전체 **38** → `product_snapshots` inner join **21** → 🔴 손실 **17**
   (전부 `origin_code = B226AC009` · 그 스냅샷이 DB 에 없다 · WU-133 과 같은 성질)
🟢 `left join` 으로 고쳐 **38 행 전수** 를 싣고 `origin_snapshot_missing` 으로 표시했다.
🔴 그대로 보고했으면 「DB GT 21건」이라는 **과소 분모** 가 올라갔다.
```

🟢 그리고 **기존 fixture 전수 분류 가드가 내 새 fixture 둘을 또 잡았다**(이 트랙 세 번째) —
느슨하게 하지 않고 분류를 추가했다(미분류 **0**).

---

## 8. 산출물

| # | 산출물 | 위치 |
|:-:|---|---|
| 1 | 전수 인벤토리 하니스(네트워크 0 · DB 0) | `apps/.../__tests__/mi-reeval-01-inventory.test.ts` |
| 2 | DB 사람 판정 38행(영속화) | `fixtures/mi-reeval-01-db-human.json` |
| 3 | 상세설명 비교 109쌍 식별자 요약(영속화) | `fixtures/mi-reeval-01-desc-pairs.json` |
| 4 | 덤프 스크립트(읽기 전용) | `packages/database/scripts/mi-reeval-dump.mjs` |
| 5 | 본 보고서 | 이 문서 |

🔴 2·3 을 리포로 들여온 이유 — 원본이 `%TEMP%` 에 있어 **세션이 바뀌면 사라진다**.
🟢 설명문 **원문은 옮기지 않았다**(식별자와 판정 요약만 · 용량).

---

## 9. CPO 확인 요청 — **넷**

```
① 중복 제거 키 승인 — 로케일을 접지 않는 것 · 보조 키를 분리해 세는 것(§0)
② 🔴 기존 GT «내부» 충돌 1건 — `villagekids.co.uk`(db=SAME ↔ desc-gt=DIFFERENT) 의 기준
③ 평가 분모 분할 — `same05` ↔ `desc-compare` 교집합이 **0** 이므로 **세 묶음으로 갈라** 평가할 것인가
④ 품번 확보 **29/107** 을 전제로 STEP 3(증거 확보 현황) → STEP 5(Shadow) 로 진행할 것인가
```

🔴 **STEP 2 이후는 착수하지 않았다**(CPO §8 「각 단계가 끝나면 결과를 먼저 보고」).
