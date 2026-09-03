# P-33 — Registration Execution → Operations Loop 조사 보고서

- 작성: CTO
- 작성일: 2026-09-03
- 성격: **조사 전용. 코드 변경 0건, 외부 API 호출 0회**
- 목적: 운영 루프의 실제 빈틈을 찾아 P-34 구현 범위를 확정

## 0. 요약 — 무엇이 이미 있고 무엇이 없는가

| 단계 | 상태 | 비고 |
|---|---|---|
| 등록 실행 | 🟢 **거의 완성** | 플랫폼별 executor·payload·검증·이력 기록 전부 존재 |
| 등록 이력 저장 | 🟢 **완성** | `registration_attempts` + `snapshot_id` 연결 |
| 등록 후 생애주기 | 🔴 **빈칸** | 상태가 `SUBMITTED`에서 영구 고정. 되읽기 경로 미연결 |
| 운영 모니터링 | 🟡 **대상 선정이 어긋남** | 감시 대상이 "등록 상품"이 아니라 "최근 스냅샷" |
| 일괄 처리 | 🟡 **부분 존재** | `/today` 있으나 limit 20~30, 판매판단 축 미반영 |
| 대시보드 | 🟢 **존재** | 신규 개발 불필요, 확장이 맞음 |

**핵심 결론**: P-33의 진짜 빈칸은 "등록 실행"이 아니라 **등록 이후**다. 등록 버튼은 이미 동작한다.

---

## 1. 등록 실행 — 재개발 불필요

### 존재하는 자산

```
apps/admin/src/app/api/coupang/register/route.ts      실제 등록(HMAC 서명, 서버 전용)
apps/admin/src/app/api/smartstore/register/route.ts   실제 등록
packages/listing/src/executor.ts                      실행 추상화
packages/listing/src/executors/{coupang,smartstore}.executor.ts
packages/listing/src/registry.ts                      플랫폼 레지스트리
packages/listing/src/{coupang,naver,smartstore}/build-payload.ts
packages/listing/src/naver/validate-payload.ts        등록 전 검증
packages/listing/src/registration-report.ts
```

시크릿은 서버 라우트에만 존재하고 executor는 fetch만 한다 — 구조가 이미 올바르다.

### ⚠️ 보고 정정 — "재시도"는 API 재시도가 아니다

`coupang/register/route.ts`의 반복문은 **API 호출 재시도가 아니라**, 수동 마이그레이션(009/010/011/016/025) 미실행으로 없는 컬럼을 하나씩 제거해가며 `registration_attempts` insert를 다시 시도하는 **컬럼 폴백 로직**이다.

> **등록 API 자체의 실패 재시도 정책은 확인되지 않았다.** P-34에서 확인이 필요하다.

### 빈칸

- `status` enum이 `SUBMITTED | FAILED` 뿐 — 제출 이후 단계를 표현할 수 없다.
- 수정(update)/재등록 경로 미확인.

---

## 2. 등록 후 상태 — **여기가 가장 큰 빈칸** 🔴

### 있는 것

`registration_attempts` 컬럼 (마이그레이션 003→006→007→009→010→011→016 누적):

```
platform, status, error_code, trace_id, duration_ms, created_at
product_name, external_product_id, payload, response      (006)
compliance_score, compliance_report                        (007)
brand_resolution / price_breakdown / category_resolver_kpi (009/010/011)
snapshot_id  + 인덱스                                       (016)
```

- **플랫폼 상품 ID(`external_product_id`) 저장됨** ✅
- **원상품(snapshot)과 연결됨** ✅ — `compute-readiness.ts`가 `snapshot_id`로 조회해 `registered: boolean`을 만들고, `/today`가 "이미 등록됨"으로 표시한다.

### 없는 것 — 결정적

1. **상태 전이가 없다.** `SUBMITTED`가 영구 상태다. 검수중 → 승인 → 판매중 → 판매중지 → 품절 같은 실제 생애주기를 담을 곳이 없다.

2. **되읽기 경로가 연결돼 있지 않다.** 능력은 이미 있다:

   ```
   apps/admin/src/app/api/coupang/product-status/route.ts
   → sellerProductId로 실제 상태(검수중/승인대기/판매중) 조회
   ```

   그런데 **호출하는 코드가 하나도 없다**(`grep` 결과 caller 0건). 주석에도 "디버그/점검용"이라고 적혀 있다. 스마트스토어에는 대응 엔드포인트가 확인되지 않는다.

3. 따라서 **"등록했다"에서 "팔리고 있다"로 넘어가는 다리가 없다.** 등록 성공 이후 시스템은 그 상품에 대해 아무것도 모른다.

---

## 3. 운영 모니터링 — 능력은 있으나 **대상이 어긋나 있다** 🟡

### 있는 것

- `api/cron/daily-price-check/route.ts` — 일 1회 가격 재확인 + 국내 가격비교
- `price_alerts` (마이그레이션 039) — `snapshot_id` 기준, `PRICE_GAP | OPPORTUNITY | ORIGIN_TREND` × `OPEN | ACKNOWLEDGED | RESOLVED`, 활성 알림 unique 인덱스까지 설계됨
- `/api/price-alerts/summary` → `/today`에 집계 표시

### 구조적 결함

```ts
// cron/daily-price-check/route.ts
const snapshots = await listRecentSnapshotsFull(MAX_SNAPSHOTS_PER_RUN);
```

**감시 대상이 "등록한 상품"이 아니라 "최근 스냅샷 N건"이다.**

즉 등록해서 실제로 팔고 있는 상품이라도 스냅샷이 오래되면 감시 대상에서 조용히 빠진다. 반대로 등록도 안 한 상품을 계속 감시한다. 운영 루프 관점에서 **우선순위가 정반대**다.

이것이 P-33에서 찾은 가장 실질적인 결함이다 — 새 기능이 아니라 **대상 선정 기준을 바꾸는 문제**라 비용이 작고 효과가 크다.

---

## 4. 일괄 처리 / Snapshot 필요성 재평가

### 있는 것

- **`/today` 페이지가 이미 "오늘 등록할 상품을 골라주는 셀러 업무 화면"이다.** 배치 선택 UI가 이미 존재한다.
- `/api/dashboard/readiness?limit=20` — 스냅샷별 readiness를 병렬 chunk로 계산

### 한계

| 항목 | 현재 |
|---|---|
| 처리 상한 | `limit` 기본 20, **최대 30** |
| 계산 방식 | 매 요청마다 재계산 (Naver payload 검증 포함) |
| 정렬/필터 | 마진율·판매가·최저가·확인시간 (N-4.11) |
| **판매 판단 축** | ❌ 반영 안 됨 — P-32의 두 축이 대시보드엔 없음 |

### Snapshot 테이블 재평가

P-31에서 "지금은 불필요"로 판단했고, 그 근거(입력이 영속화됨 + 파생이 순수함수)는 지금도 유효하다. 다만 **P-31에서 제시한 도입 조건 중 2개가 이미 충족에 근접했다**:

- ✅ 목록 정렬/필터 필요 — `/today`가 이미 하고 있고 limit 30이 상한
- ✅ 판정 변화 알림 필요 — `price_alerts`가 이미 그 방향
- ❌ 시계열 비교 — 아직 요구 없음

→ **결론: 아직 만들지 말 것.** 먼저 §3(감시 대상 전환)을 하면 "등록 상품"이라는 훨씬 작은 모집합이 생긴다. 그 모집합이 30건을 넘어가고 계산이 실제로 느려질 때 도입하면 된다. 순서를 뒤집으면 쓰이지 않는 테이블을 먼저 만들게 된다.

---

## 5. 대시보드 — 신규 개발 불필요

| 화면 | 역할 | 판단 |
|---|---|---|
| `/today` | 셀러 업무 — 오늘 등록할 상품 | **확장 대상** |
| `/admin/dashboard` | 운영 지표 — 등록 성공/실패/ErrorCode/30일 추이 | 그대로 유지 |
| `/api/dashboard/readiness` | 스냅샷별 준비도 | **확장 대상** |

새 대시보드를 만들 이유가 없다. `/today`에 P-32의 두 축을 얹는 것이 맞다.

---

## 6. P-34 구현 범위 제안 (우선순위 순)

### 🥇 1순위 — 모니터링 대상을 등록 상품 기준으로 전환
가장 작은 변경으로 가장 큰 운영 효과. 새 테이블/새 API 불필요.
`daily-price-check`가 "최근 스냅샷" 대신 "등록 이력이 있는 스냅샷"을 우선 처리하도록 대상 선정만 바꾼다.

### 🥈 2순위 — 등록 후 생애주기 상태
`registration_attempts.status` 확장 또는 별도 상태 컬럼 + 이미 존재하는 `coupang/product-status`를 실제로 연결. 스마트스토어 대응 엔드포인트 존재 여부 확인 선행 필요.
**DB 마이그레이션이 필요할 가능성이 높다 — CEO/CPO 수동 실행 대상.**

### 🥉 3순위 — `/today`에 P-32 두 축 반영
"판매 추천 × 등록 가능" 교집합 필터. P-32에서 만든 `computeRegistrationReadiness` / `buildSellAndRegisterView`를 그대로 재사용 가능하다.

### 4순위 — 등록 API 재시도 정책 확인 및 명시화
§1 정정 사항. 현재 정책이 무엇인지부터 확인.

### 보류 — Snapshot 테이블
1·2순위 완료 후 재평가.

---

## 7. 이 조사에서 확인하지 못한 것 (정직 고지)

- **스마트스토어 상태 조회 API 존재 여부** — 쿠팡만 확인했다.
- **등록 API 자체의 재시도/실패 처리 정책** — 컬럼 폴백 로직과 구분해서 다시 봐야 한다.
- **`registration_attempts`의 실제 데이터 분포** — Supabase 자격증명이 로컬에 없어 조회하지 못했다. 등록 이력이 실제로 몇 건 쌓여 있는지, `external_product_id`가 실제로 채워지는지는 프로덕션 DB 확인이 필요하다.
- 마이그레이션 016/025 등이 프로덕션에 실제 실행됐는지 — 코드가 컬럼 부재를 폴백으로 감수하고 있어 코드만으로는 알 수 없다.
