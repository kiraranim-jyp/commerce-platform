# CEO 판단 재사용 — **설계안 제출**(CTO → CPO · 2026-11-07)

> 🔴 CPO 지시 §6: 「이번 단계는 **설계·조사·Shadow 검증만** 수행한다.」
> 🔴 운영 판정 규칙 변경 **0** · 자동 차단 **0** · GT 원본 수정 **0** · **migration 0** ·
> DB 쓰기 **0** · 기존 SAME 재사용 경로 회귀 **0** · CEO 판단 자동 추론/확정 **0**.
> 🟢 선행 감사 `docs/CEO-JUDGMENT-REUSE-AUDIT.md`. 🔴 **재조사 금지.**

---

## 1. 🟢 **C42 / C50 별도 CEO GT 반영 — 완료**(CPO 지시 §1)

```
구현  `__tests__/ceo-gt-latest.ts`(측정 전용 모듈 · 운영 import 0)
계약  `ceo-gt-latest-preservation.test.ts` — **14 passed**
```

| 보존 조건(CPO) | 계약 | 결과 |
|---|---|---|
| `SAME05_BASELINE` 변경 금지 | A-1 | 🟢 `{33·18·9·6·fp 1·6/18}` 불변 |
| 기존 GT 덮어쓰기 금지 | A-2 | 🟢 `wu-059` 의 C42=**SAME** · C50=**DIFFERENT** 그대로 |
| 최신 조서를 기준선에 주입 금지 | A-3 | 🟢 `CEO_RELABEL` 에 **C06 만** · C42·C50 **없음** |
| 33쌍 분모 불변 | A-4 | 🟢 쌍 33 · SAME 18 · DIFFERENT 9 |
| C42 **충돌 보존** | B-2 | 🟢 `{C42: prior SAME ↔ latest DIFFERENT}` **둘 다** 보존 |
| C50 **확정 분모 제외** | B-3 | 🟢 `CEO_UNDECIDED_IDS=["C50"]` · 확정 **10** · 목록에는 **남아 있다** |
| Main Story 정책 불변 | D-1 | 🟢 다섯 쌍 전부 DIFFERENT · C42 가 `main-story.com` 임을 단언 |

🟢 **충돌은 정확히 둘** 이다 — `C50`(DIFFERENT→UNDECIDED) · `C42`(SAME→DIFFERENT).
🟢 그리고 **C42 의 뒤집힘은 CEO 의 Main Story 결정과 일관** 된다(그 쌍이 `main-story.com`).

🔴 **CTO 가 하지 않은 것**(CPO §5·§6 금지 준수 · 계약으로 잠금):
```
C-2 `ceoAxes` **전건 `{}` 그대로** — 추론해 채우지 않았다(**미입력 ≠ UNKNOWN**)
C-3 그룹 메모를 개별 쌍에 **분배하지 않았다** — 고유 note **5개**(크기 5·2·2·1·1)
C-1 `ceoNote` **바이트 동일**         B-4 사유 문자열(「404」·「반팔」…)을 **조건으로 쓰지 않았다**
D-2 이 모듈이 운영 경로를 **import 하지 않는다**(사람 판단이 그 경로로 새지 않게)
```

---

## 2. 🔴🔴 **조사 결과 — `candidate_reviews` 실측**(CPO 지시 §3 선행 조건)

```
PK      `id` uuid  default `gen_random_uuid()`
FK      `snapshot_id → product_snapshots(id) ON DELETE CASCADE`   (FK 는 이것 **하나**)
🟢 **이 표를 가리키는 FK 가 «0» 이다** ⟹ 새 표가 이것을 **참조할 수 있다**(순환 없음)
🔴🔴 **이력 칸이 «0» 이다** — `version`·`history`·`revision`·`prev`·`superseded`·`updated`
    이름으로 **하나도 없다**(실측). 있는 것은 `first_seen_at`·`last_seen_at`·`reviewed_at` 뿐
CHECK   `human_verdict IN (SAME, SIMILAR, DIFFERENT, UNDECIDED)`  🟢 **UNDECIDED 가 이미 허용**
CHECK   `snapshot_id IS NOT NULL OR origin_code IS NOT NULL`
CHECK   `source IN (OVERSEAS_AUTO, DOMESTIC_REGISTRY, SELLER_URL, GEMINI, GT_IMPORT,
                    WEB_SEARCH, DOMESTIC_LISTING)`
부분 유니크 **둘** — `(snapshot_id, candidate_url) WHERE snapshot_id IS NOT NULL` ·
                  `(origin_code, candidate_url) WHERE snapshot_id IS NULL AND origin_code IS NOT NULL`
칸 24개 · 수동 migration 최신 **082** ⟹ 다음 번호 **083**
```

### 🔴🔴 데이터 실측이 설계를 바꾼 사실 **셋**

```
① **`human_note` 가 DB 에 «전건 0» 이다**(SAME 22 · DIFFERENT 15 · SIMILAR 1 전부 note 0)
   ⟹ 🔴 CEO 의 산문 근거는 **fixture 에만** 있고 **운영 DB 에는 없다.**
   ⟹ 🔴 「원문 메모를 항상 보존」은 **지금 DB 에서 성립하지 않는다** — 쓰는 경로가 없다.
② **같은 후보 URL 에 사람 판단이 «이미 충돌» 한다**(실측 1건) —
   `villagekids.co.uk/products/pale-blue-3d-logo-t-shirt` → `DIFFERENT | SAME` **둘 다 실재**
   🔴 그런데 **버전 칸이 없어** 어느 것이 최신인지 `reviewed_at` 으로만 알 수 있다.
   🟢 ⟹ CPO 의 「충돌 보존」 결정은 **가정이 아니라 이미 벌어진 상황** 이다.
③ 같은 URL 에 행이 **최대 39행** 이다(부분 유니크가 둘이라 snapshot 축 · origin 축으로 쪼개진다)
   ⟹ 🔴 새 표의 FK 를 `candidate_reviews.id` 로 걸면 **한 판단이 여러 행에 흩어진다.**
```

🔴🔴 **그래서 ③이 ERD 의 핵심 설계 질문이다** — 아래 §4 에서 갈랐다.

---

## 3. 🟡 **과거 DIFFERENT 표시 경로 — 설계**(CPO 지시 §2 · 자동 차단 불승인)

### 3-1 지금 있는 것 / 없는 것
```
🟢 **표시 자리가 이미 있다** — 📚 「이전에 확인한 후보」 구역(WU-131) ·
   조회 owner `listCandidateReviews`(snapshot 축 + origin 축 둘 다 읽는다)
🟢 그 경로는 **`human_verdict` 로 거르지 않는다**(「사람이 아직 안 본 후보도 화면에 서야 한다」
   · candidate-review.ts:202) ⟹ 🟢 **DIFFERENT 행이 이미 그 목록에 올라온다**
🔴 **없는 것 셋** — ⒜ 「이번 조회 후보」 옆에 과거 판단을 **붙이는 배선**
   ⒝ **충돌 표시**(과거 ↔ 최신) ⒞ 판단자·시각·근거 **표시**(근거는 §2-① 때문에 비어 있다)
```

### 3-2 제안 — **표시 전용 조인 하나**(차단 0)
```
입력   이번 조회 후보 목록(transient) + `listCandidateReviews` 결과
키     `reviewKey(candidate_url)`  🟢 **저장과 같은 정규화기**(두 축의 중복을 접는다)
산출   후보 행마다 `priorHumanReview | null`
         { verdict · reviewedAt · source · noteExists · conflict }
🔴 `conflict` = 같은 키에 **서로 다른 `human_verdict` 가 둘 이상** 있을 때 true
   (🟢 실측 1건이 바로 그 모양이다 · 버전 칸이 없으므로 **`reviewed_at` 최신값을 같이** 낸다)
🔴🔴 **차단에 쓰지 않는다** — 그 값은 후보 집합·MI 판정·가격 자격·검색 범위에
   **들어가지 않는다**(계약으로 잠근다 · 아래 §6).
```

### 3-3 표시 어휘(CPO 표 그대로)
| 과거 판단 | 표시 |
|---|---|
| SAME | 기존 검증 SAME **참고 정보** |
| DIFFERENT | 과거 사람 판단 **경고 표시** |
| SIMILAR | 유사상품 판단 **이력 표시** |
| UNDECIDED | 판단 **미확정 이력 표시** |

🔴 **「제외됨」·「차단」 어휘를 쓰지 않는다** — 그 글자가 뜨면 셀러는 차단된 줄로 읽는다.

---

## 4. 🔵 **별도 테이블 ERD + migration 초안**(CPO 지시 §3 · 🔴 **승인 전 적용 0**)

### 4-1 🔴 먼저 — **FK 를 `candidate_reviews.id` 로 걸지 않는다**
```
이유(실측 §2-③) — 같은 후보 URL 이 **최대 39행** 으로 흩어진다(부분 유니크가 둘).
   그 중 어느 `id` 에 CEO 판단을 매달지 **고를 근거가 없다** ⟹ 한 판단이 쪼개진다.
🟢 그래서 **CEO 판단의 키를 「조서 + 쌍 식별」로 둔다** — `candidate_reviews` 와는
   **URL 키로 «조회만»** 잇는다(FK 없음 · 느슨한 결합).
🔴 그리고 그것이 CPO 조건과도 맞는다 — 「기존 `candidate_reviews` 의 데이터와 필드는 유지」.
```

### 4-2 ERD
```
┌──────────────────────────────────────────────────────────────┐
│ ceo_judgments                      «CEO 전체 판단 기록»        │
├──────────────────────────────────────────────────────────────┤
│ id              uuid PK   default gen_random_uuid()           │
│ review_key      text NN   조서 식별(예: CEO-EVIDENCE-REVIEW)   │
│ pair_id         text NN   쌍 식별(C42 · S1-6 …)                │
│ origin_url      text NN   🔴 판단 시점의 원본 URL(기록)         │
│ candidate_url   text NN   🔴 판단 시점의 후보 URL(기록)         │
│ review_url_key  text NN   🟢 reviewKey(candidate_url) — 조인용 │
│ human_verdict   text NN   CHECK (SAME·DIFFERENT·UNDECIDED)    │
│ reviewer        text NN   판단자                               │
│ reviewed_at     timestamptz NN                                │
│ raw_note        text      🔴 **원문 메모 — 가공 금지**          │
│ version         int  NN   default 1      🟢 판단 버전          │
│ supersedes_id   uuid      FK → ceo_judgments(id)  🟢 이전 판단  │
│ snapshot_id     uuid      FK → product_snapshots(id) NULL 허용 │
│ created_at      timestamptz NN default now()                  │
│                                                               │
│ UNIQUE (review_key, pair_id, version)                         │
│ INDEX  (review_url_key) · (pair_id) · (snapshot_id)           │
└──────────────────────────────────────────────────────────────┘
                              │ 1
                              │
                              │ N
┌──────────────────────────────────────────────────────────────┐
│ ceo_judgment_axes                  «CEO 속성별 판단 기록»      │
├──────────────────────────────────────────────────────────────┤
│ id            uuid PK   default gen_random_uuid()             │
│ judgment_id   uuid NN   FK → ceo_judgments(id) ON DELETE CASCADE│
│ axis          text NN   축 이름(PRODUCT_TYPE · SLEEVE · COLOR…)│
│ state         text NN   CHECK (MATCH·MISMATCH·UNKNOWN·NOT_APPLICABLE)│
│ origin_value  text      원본 값(그 축에서 본 것)               │
│ candidate_value text    후보 값                                │
│ rationale     text      🔴 그 축에 대한 **사람이 확인한** 근거  │
│ evidence_source text    근거 출처(TITLE·DESCRIPTION·IMAGE·URL) │
│ created_at    timestamptz NN default now()                    │
│                                                               │
│ UNIQUE (judgment_id, axis)                                    │
└──────────────────────────────────────────────────────────────┘
```

### 4-3 🔴 CPO 조건 다섯에 대한 설계 대응
| CPO 조건 | 설계 |
|---|---|
| 기존 `human_verdict`·`human_note`·`reviewed_at` 삭제/대체 금지 | 🟢 `candidate_reviews` **칸 변경 0** · 새 표 둘만 추가 |
| 기존 CEO GT · DB GT 덮어쓰기 금지 | 🟢 새 표는 **추가만** · 기존 표를 UPDATE 하지 않는다 |
| 과거 판단을 UPDATE 로 소거하지 않고 **새 버전 추가** | 🟢 `version` + `supersedes_id` · UNIQUE 가 `(review_key, pair_id, version)` 이라 같은 쌍에 **여러 버전이 공존** |
| 10개 축을 **모두 채우지 않아도** 저장 가능 | 🟢 축은 **별도 행** 이다 ⟹ 0개 축이어도 판단이 저장된다 |
| **미입력과 UNKNOWN 을 구분** | 🟢🟢 **행이 없으면 미입력 · `state='UNKNOWN'` 이면 「확인 불가」로 사람이 찍은 것** |

🔴 **migration 초안은 `083_ceo_judgments.sql` 이고 이 세션에서 «작성하지 않았다»** —
CPO 가 「설계안을 제출한 후 migration 을 승인받는다」라고 했고, 🔴 이 저장소의 수동
migration 은 **사람이 손으로 적용** 하므로 승인 전에 파일을 만들면 **밀린 migration** 이 된다
(WU-130 이 기록한 그 함정 — `078` 이 DB 에 없던 사례).

---

## 5. 🟡 **C06 반례 보호 방법**(CPO 지시 §3 보고 항목)

🔴 C06 은 **과거 DIFFERENT → 최신 SAME** 으로 뒤집힌 쌍이다. 자동 차단이 왜 위험한지의 증거다.

```
보호 ① **차단 경로를 만들지 않는다**(§3-2) — 과거 판단은 **표시** 로만 간다.
      🟢 계약으로 잠근다: 과거 판단이 후보 집합·MI·가격 자격·검색 범위에 **0**.
보호 ② **버전으로 뒤집기가 가능해야 한다**(§4-2 `version`·`supersedes_id`) —
      🔴 지금 `candidate_reviews` 에는 그 칸이 **없다**(실측) ⟹ 뒤집힌 기록이 **덮인다**.
      🟢 새 표가 그것을 가능하게 한다(이전 행을 지우지 않고 새 버전을 얹는다).
보호 ③ **충돌을 숨기지 않는다** — 같은 키에 다른 판단이 둘 이상이면 `conflict=true` 를
      **화면에 띄운다**(§3-2). 🔴 「최신으로 접어서」 보여주면 C06 같은 뒤집힘이 안 보인다.
보호 ④ **회귀 계약** — `CEO_BASELINE_CONFLICTS` 가 **prior 와 latest 를 둘 다** 들고 있고
      그 둘이 다름을 단언한다(B-2). 🟢 「최신이 이긴다」로 접으면 FAIL 한다.
```

---

## 6. 🔵 **기존 11쌍 입력 UX 개선안**(CPO 지시 §4 — 라디오 확장 금지)

### 6-1 🔴 실측이 말하는 것
```
제공한 입력칸  축 라디오 **10축 × 11쌍 × 3값 = 330** + 전체 판정 **44**
실제 입력      전체 판정 **11/11** 🟢  ·  축 라디오 **0/110** 🔴
그런데 `ceoNote` 에는 축 어휘가 **10/11 쌍** 에 있다
⟹ 🔴 「라디오를 더 잘 만든다」가 답이 아니다. 대표님은 **보이는 증거를 순서대로 훑으며
   산문으로 적는** 방식을 썼다(「1. 상품명 원문 … 2. 정규화 토큰 … 3. 상세설명 … 결론)」).
🔴 N=1 해석이다 — 단정하지 않는다.
```

### 6-2 제안 — **필수는 하나 · 구조화는 «판단에 영향을 준 축만»**
```
필수   전체 판단  SAME / DIFFERENT / UNDECIDED          (지금도 100% 채워진다)
선택   「판단을 가른 축」을 **고른 뒤에만** 그 축의 상태·이유를 묻는다
       🔴 10축을 **먼저 다 펼치지 않는다** — 그것이 0/110 을 만든 모양이다
항상   **원문 메모** 칸(지금 방식 그대로 · 그 칸이 유일하게 실제로 채워진 칸이다)
       + 판단 시점 상품 정보 · 원본/후보 URL
```

🟢 **S1-6 이 그 설계로 표현된다**(CPO 예시):
| 항목 | 값 |
|---|---|
| 전체 판단 | `DIFFERENT` |
| 축 — 상품 종류 | `MATCH` |
| 축 — **소매 길이** | `MISMATCH` |
| 원문 메모 | 「… 반팔과 긴팔차이라 다른제품이다 **하지만, 이제품은 유사상품으로 분류가 되어도 문제되지 않는다**」 |

🔴🔴 **그 마지막 문장이 구조화로 표현되지 않는다** — 그것은 축 판단이 아니라 **정책 발화** 다
(「유사상품 분류는 허용 가능」). 🔴 CPO 예시표의 「유사상품 분류: 허용 가능」 줄을 **축으로
만들면** 그것이 **새 판정 축** 이 된다. 🟡 그래서 선택지 둘을 올린다(🔴 CTO 가 고르지 않았다):
```
⒜ `ceo_judgments` 에 **정책 메모 칸** 을 따로 둔다(축이 아니라 「이 판단에 딸린 정책」)
⒝ 원문 메모에만 남긴다(지금) — 🔴 그러면 **검색·재사용이 안 된다**
```

🟢 **C50 도 그 설계로 표현된다**:
| 항목 | 값 |
|---|---|
| 전체 판단 | `UNDECIDED` |
| 축 — 비교 가능 여부 | `NOT_APPLICABLE` |
| 원문 메모 | 「404 에러로 비교 판단 불가 · 애초에 비교대상에 담지도 제거하는게 맞음」 |
| 후속 조치 | 🔴 **코드가 만들지 않는다** — 그 요구는 CPO §5 404 백로그로 이미 있다 |

🔴 **AI 가 원문 메모를 축 판단으로 변환하지 않는다**(CPO 명시) — 위 표의 축 값은
**예시** 이고, 실제 저장은 **대표님이 확인·확정한 값만** 들어간다. 계약 C-2 가 그것을 잠근다.

---

## 7. 테스트 및 운영 영향

```
신규 계약 **14**(`ceo-gt-latest-preservation.test.ts`) · 전건 passed
운영 코드 변경 **0** · DB 쓰기 **0** · migration **0** · 네트워크 **0** ·
GT 원본 수정 **0** · `SAME05_BASELINE` **불변**(계약 A-1) ·
기존 SAME 재사용 경로(`listReviewedSameUrls` · `listSnapshotVerifiedSameKeys`) **변경 0**
🟢 새 모듈은 `__tests__/` 안에 있고 **운영 경로를 import 하지 않는다**(계약 D-2)
```

---

## 7-B. 🔴🔴 **CPO 지시 ②(신규 쓰기 경로)는 «지금 구현할 수 없다» — 083 적용이 선행이다**

```
🔴 CPO 가 ②(신규 CEO 판단 쓰기 경로)의 **설계·구현** 을 승인했다.
🔴🔴 그런데 **쓸 표가 없다** — `083` 은 **작성 승인 / 적용 보류** 이고,
   `ceo_judgments` · `ceo_judgment_axes` 는 DB 에 **존재하지 않는다**(실측 0행).
⟹ 🔴 지금 구현하면 **배포하는 순간 런타임 오류** 가 나는 경로를 만드는 것이다.
   (이 저장소가 이미 겪은 모양 — WU-130 이 「만들고 적용 안 하면 **화면이 깨진다**」로 기록했다)
🟢 그래서 ②는 **설계까지만** 했다(§6-2 입력 방식 · §4-2 저장 모양) ⟹ **구현 0.**
🔴 ②의 구현 선행조건은 **하나** 다 — `083` **적용 승인**.

🟢 반면 **④(과거 DIFFERENT 표시 UI)는 083 과 무관하다** — 읽는 것이
   기존 `candidate_reviews` 이고 그 표에 사람 판단 **38행** 이 이미 있다
   (SAME 22 · DIFFERENT 15 · SIMILAR 1 · 🟢 `villagekids` 충돌 1건 포함).
   ⟹ 🟡 **④는 바로 구현 가능** 하고, 이 세션은 용량 판단(§4-C)으로 **다음 세션에 넘긴다**.
   🔴 좌표는 §3-2 에 있다(조인 키 · 산출 모양 · 금지) — **재조사 없이 들어갈 수 있다.**
```

---

## 8. 🔴 CPO 승인 요청 — **넷**

```
① **migration `083_ceo_judgments.sql` 작성·적용 승인**(§4 ERD 기준)
   🔴 이 저장소의 수동 migration 은 **사람이 손으로 적용** 하므로 승인 전에 파일을
      만들면 밀린 migration 이 된다 ⟹ **파일도 만들지 않았다.**
② 🔴🔴 **`human_note` 가 DB 에 전건 0 이라는 사실의 처리**(§2-①) —
   「원문 메모를 항상 보존」은 **지금 쓰는 경로가 없어서** 성립하지 않는다.
   🟡 선택지 — ⒜ `083` 과 함께 쓰기 경로를 연다 ⒝ 기존 11쌍을 `GT_IMPORT` 로 적재한다
   (🔴 ⒝ 는 **DB 쓰기** 라 승인 사안)
③ **S1-6 의 「유사상품 분류는 허용 가능」을 어디에 담을 것인가**(§6-2 ⒜/⒝) —
   🔴 축으로 만들면 **새 판정 축** 이 된다(8축 CLOSED 와 충돌).
④ **과거 DIFFERENT 표시 배선을 구현할 것인가**(§3-2) — 🔴 UI 변경이라 별도 승인이다.
```

🔴 **CTO 는 넷 중 아무것도 집행하지 않았다.**
