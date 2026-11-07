# CEO 판단 **쓰기 경로** — 범위 제시(CTO → CPO · 2026-11-07)

> 🔴 CPO 지시: 「먼저 기존 설계와 **실제 호출 경로를 확인** 하고, **구현 범위·저장 흐름·
> 중복 방지·보안 경계를 제시한 뒤** 진행하십시오.」 ⟹ 🔴 **이 문서가 그 제시이고 구현은 0 이다.**
> 🟢 설계 근거 `docs/CEO-JUDGMENT-REUSE-DESIGN.md` §4-2·§6-2 · 적용 완료된 `083`.

---

## 1. 🟢 실제 호출 경로 — **확인 완료**(기존 쓰기 경로를 그대로 베낀다)

`candidate_reviews` 의 사람 판단 쓰기 경로가 **이미 있고**, 새 경로는 그것과 **같은 모양** 이어야 한다.

```
클라이언트(후보 카드 버튼)
  → POST /api/price-history/[snapshotId]/candidate-reviews        route.ts
      ① `requireUser()`                 ← 🟢 인증·workspace 소유권(새 규칙 0)
      ② `resolveOrigin(snapshotId, ws)` ← `getSnapshot` + `buildProductIdentityDna`
                                           🔴 품번을 **새로 계산하지 않는다**
      ③ 🔴 **타입을 믿지 않고 칸마다 검사**(`sanitizeCandidateContext`) —
         「모르는 칸은 넘기지 않는다(`undefined`)」 · `null` 로 덮지 않는다
      ④ `isHumanVerdict(...)` ← DB CHECK **앞에서** 400 으로 막는다
      → `saveHumanVerdict(...)`          _lib/candidate-review.ts
          `getSupabaseAdmin()`           ← 🟢 **service_role**(서버 전용)
          `reviewKey(url)` = `canonicalizeProductUrl(url).toLowerCase()`
          🔴 **조회 → update(id) / insert** (부분 유니크가 둘이라 `onConflict` 금지 ·
             42P10 으로 WU-141-R1 이 한 번 터진 그 자리) + `23505` 폴백
```

🔴 **그 경로에서 그대로 가져올 것 다섯**(사본을 만들지 않는다):
```
`requireUser` · `getSnapshot` · `buildProductIdentityDna` · `reviewKey` · `getSupabaseAdmin`
🔴 특히 `reviewKey` 를 **복제하지 않는다** — 저장 키와 조회 키가 갈라지면
   `ceo_judgments.review_url_key` 로 `candidate_reviews` 를 못 찾는다(083 주석이 그 함정을 적는다).
```

---

## 2. 🔵 구현 범위 — **신규 2파일 · 기존 0 수정**

```
① `_lib/ceo-judgment.ts`  (신규 · 저장 owner)
     `saveCeoJudgment(input)` → `{ judgment, axes }`
     `listCeoJudgments({ reviewUrlKeys | pairIds | snapshotId })`  ← 표시 배선이 쓸 조회
     🔴 `isCeoVerdict` · `isAxisState` 술어(DB CHECK **앞에서** 막는다)
② `api/price-history/[snapshotId]/ceo-judgments/route.ts`  (신규 · POST + GET)
     🟢 ①~④ 를 **기존 route 와 같은 순서** 로 한다
🔴 수정하지 않는 것 — `candidate-review.ts` · `candidate-reviews/route.ts` ·
   검색 · 매칭 · 가격 판정 · MI · 알림 · 기존 38행 · `SAME05_BASELINE` · 8축
🔴 UI 는 **이번 범위가 아니다**(CPO: 표시 UI 는 다음 독립 작업) ⟹ 배선 0 · 화면 0
```

---

## 3. 🔵 저장 흐름 — **append-only · UPDATE 0**

```
POST /api/price-history/{snapshotId}/ceo-judgments
body { pairId · humanVerdict · reviewer? · rawNote? · decisionContext? ·
        originUrl · candidateUrl · reviewKey? · axes?[] }

① requireUser()                              401 이면 끝
② resolveOrigin(snapshotId, ws)               404 이면 끝
③ 검증 — humanVerdict ∈ {SAME,DIFFERENT,UNDECIDED}       아니면 400
         axes[].state ∈ {MATCH,MISMATCH,UNKNOWN,NOT_APPLICABLE} 아니면 400
         🔴 **축을 임의 생성하지 않는다** — `axes` 가 없으면 **행을 0개** 만든다
④ reviewUrlKey = reviewKey(candidateUrl)      🟢 저장과 조회가 같은 정규화기
⑤ 다음 version 결정
     select max(version) where (review_key, pair_id)   → prev
     version = (prev?.version ?? 0) + 1
     supersedes_id = prev?.id ?? null          🟢 이력 사슬
⑥ insert ceo_judgments                        🔴 **UPDATE 를 쓰지 않는다**
⑦ insert ceo_judgment_axes (axes 가 있을 때만)  🔴 한 트랜잭션이 아니면 ⑥만 남는다 ⟹ §4
⑧ 응답 — 저장된 판단 + 축 + 🔴 **직전 버전의 verdict**(충돌을 숨기지 않는다)
```

🔴 **「최신이 이긴다」로 접지 않는다** — 조회(`listCeoJudgments`)는 **버전 전부** 를 돌려주고
「최신을 고르는 것」은 **소비처의 일** 이다(083 인덱스 주석이 그렇게 적는다).

---

## 4. 🔴🔴 중복 방지 — **세 가지를 가른다**

```
⒜ **동시/재시도로 같은 판단이 두 행** 이 되는 것
   🟢 `UNIQUE (review_key, pair_id, version)` 이 **DB 에서** 막는다.
   🔴 그런데 ⑤의 `max(version)+1` 은 **읽고 쓰는 사이에 경쟁** 이 있다(TOCTOU) ⟹
      동시 요청 둘이 같은 version 을 계산할 수 있다.
   🟢 처리 — 그때 **`23505`(unique violation)** 가 난다 ⟹ **1회 재조회 후 재시도** 한다
      (기존 `saveHumanVerdict` 가 쓰는 **같은 폴백 모양** 이다 · 새 패턴 0).
      🔴 무한 재시도 금지 — **1회** 만 하고 실패하면 **500 을 그대로** 돌려준다.
⒝ **같은 내용을 두 번 눌러 version 이 무의미하게 늘어나는** 것
   🟡 선택지 둘(🔴 CTO 가 고르지 않았다):
      ⒤ **그대로 새 버전**(append-only 의 순수 형태 · 🔴 같은 값이 version 1·2·3 으로 쌓인다)
      ⒥ **직전 버전과 verdict·rawNote·축이 전부 같으면 새 버전을 만들지 않고 직전 행을 돌려준다**
         (🟢 이력이 의미 있는 변경만 남는다 · 🔴 「같다」의 기준을 코드가 정해야 한다)
   🔴 ⒥ 는 **판단을 «버리는» 쪽** 이라 CPO 결정이 필요하다 — 기본은 ⒤ 로 둔다.
⒞ **축이 한 판단에 두 번** 들어오는 것
   🟢 `UNIQUE (judgment_id, axis)` 가 막는다 + 요청 단계에서 **같은 axis 중복이면 400**.
```

🔴 **그리고 ⑥⑦을 한 트랜잭션으로 묶는다** — 묶지 않으면 「판단은 저장됐는데 축이 없는」
행이 남고, 그것은 **「축 미입력」과 구별되지 않는다**(083 이 지키려는 그 구분이 깨진다).
🟢 Prisma `$transaction` 으로 감싼다(083 적용 때 쓴 그 모양).

---

## 5. 🔴 보안 경계

```
🟢 인증      `requireUser()` — 기존 경로와 **같은 함수**(새 규칙 0)
🟢 소유권    `getSnapshot(snapshotId, workspaceId)` 가 없으면 **404** ⟹ 남의 스냅샷에 못 쓴다
🟢 DB 접근   `getSupabaseAdmin()` = **service_role**(실측 `rolbypassrls=true`) ·
             owner 는 `apps/admin/src/lib/supabase-admin.ts` **하나** ·
             그 파일 머리가 「"use client" 컴포넌트에서 절대 import 하면 안 된다」고 적는다
🔴 클라이언트 **DB 직접 접근 0** — 화면은 이 route 만 부른다(이번엔 화면도 안 만든다) ·
             🟢 `anon` 권한 **0건** · `authenticated` 는 **SELECT 만**(083 적용 후 실측)
🔴 입력      칸마다 검사하고 **모르는 칸은 넘기지 않는다**(`undefined`) ·
             `humanVerdict`·`state` 는 **DB CHECK 앞에서** 400 으로 막는다
🔴 쓰지 않는 칸  `candidate_reviews` 의 `system_*`·`human_verdict`·`human_note`·
             `reviewed_at` 을 **건드리지 않는다**(표가 다르다 ⟹ 구조적으로 불가능)
🔴 자동 추론  `rawNote` 를 시스템이 **만들지 않는다**(없으면 빈 값) ·
             축을 메모에서 **추론하지 않는다** ⟹ 계약으로 잠근다
```

---

## 6. 🔵 미확인 3항 + 중복 — **구현과 함께 검증한다**(CPO 요구)

| 검증 | 기대 | 방법 |
|---|---|---|
| 같은 `(review_key, pair_id)` 에 version 2 저장 | **1·2 모두 보존** | 실제 쓰기 2회 → 조회로 둘 다 확인 |
| `state` 에 임의 문자열 | **CHECK 거부** | 술어 우회 경로로 직접 insert → 오류 코드 확인 |
| 축 **0행**으로 판단 저장 | 판단 본문 **정상 저장** | `axes` 없이 POST → 축 0 · 판단 1 |
| 🔴 재시도·중복 요청 | 판단이 **중복 저장되지 않는다** | 같은 요청 2회 동시 → `23505` 폴백 후 행 수 확인 |

🔴 **검증은 운영 DB 에 «쓴다»** — 그래서 **정리(cleanup)까지 한 묶음** 으로 만든다:
```
🟢 `review_key = '__CTO_VERIFY__'` 같은 **전용 키** 로 쓰고 끝에 **그 키만** 삭제한다
🔴 기존 38행·11쌍·GT 는 **건드리지 않는다**(삭제 조건에 그 키를 박아 구조적으로 불가능)
🔴 그리고 삭제 후 **행 0 을 다시 확인** 한다(남으면 다음 측정의 분모를 오염시킨다)
```

---

## 7. 🔴 이번 범위에 **포함하지 않는 것**(CPO 명시)

```
❌ `GT_IMPORT` 13행 적재(별도 승인)      ❌ 과거 DIFFERENT 표시 UI(다음 독립 작업)
❌ BL-3 D-2 계약 보완                    ❌ 기존 판단 38행 수정·삭제
❌ 기존 판정 기준·검색·가격 정책 변경      ❌ 추가 migration · 083 재적용·사후편집
❌ 축을 임의 생성·추론                    ❌ 기존 판단 UPDATE 덮어쓰기
```

---

## 8. 🔵 CPO 결정 요청 — **하나**

```
§4-⒝ **같은 내용을 두 번 눌렀을 때** —
  ⒤ 그대로 새 버전(append-only 순수 · 🔴 같은 값이 쌓인다)  ← 🟡 **기본값으로 두겠다**
  ⒥ 직전과 전부 같으면 새 버전을 만들지 않는다(🔴 「같다」의 기준을 코드가 정하게 된다)
🔴 CTO 는 ⒥ 를 **임의로 구현하지 않는다** — 판단을 버리는 쪽이라 정책이다.
🟢 ⒤ 로 진행해도 **되돌릴 수 있다**(나중에 ⒥ 를 더하면 그 뒤 버전부터 적용된다).
```

🔴 **그 하나만 확인되면 바로 구현에 들어간다**(위 §2~§6 그대로).
