# P0-CHANNEL-03 PHASE D-2 — Product Identity 재정의 설계

> CPO 확정 ㉮ (2026-09-25). **조사·설계 문서이며 구현이 아니다.**
> 코드 변경 0 · DB write 0 · migration 실행 0 · Production API 0건.

---

## 1. `Product` 현재 사용 현황

```prisma
model Product {
  id        String   @id @default(cuid())
  sourceUrl String   @unique      // 🔴 잘못된 Identity
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

| 항목 | 값 |
|---|---|
| 행 수 | **0** |
| 애플리케이션 참조 | **0건** (`prisma.product` 호출 없음) |
| FK 참조 | **없음** |

프로젝트 초기 잔재. 실제 파이프라인은 `product_snapshots` 로만 동작한다.
**행이 0건이므로 재정의에 데이터 손실 위험이 없다.**

## 2·3. 재정의안 — `sourceUrl` 의 의미를 바꾼다

```prisma
model Product {
  id        String   @id @default(cuid())   // ← 유일한 상품 Identity
  sourceUrl String?                          // @unique «제거» · nullable
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  snapshots       ProductSnapshot[]
  channelProducts ChannelProduct[]
}
```

🔴 **`sourceUrl` 은 식별자가 아니라 「동일성 판단 후보 정보」다.**
- URL 변경 ≠ 새 Product
- URL 동일 ≠ 같은 Product 확정
- `@unique` 를 두면 locale/campaign 변형마다 별개 Product 가 되고, 같은 URL 에서 상품이 바뀌어도 같은 Product 가 된다 — 둘 다 틀리다.

**`sourceUrl` 로 자동 merge 하지 않는다.** 동일성 판단은 사람 또는 별도 매칭 작업이며, 이번 범위 밖이다.

필드 추가는 **하지 않는다**. `title` 은 `product_snapshots.title` 과 중복이지만, Product 는 「이 상품이 무엇인가」의 최소 표지이고 snapshot 은 버전이므로 중복이 아니다. 그 외(브랜드·이미지 등)는 전부 snapshot/canonicalProduct 에 있으므로 Product 로 올리지 않는다.

## 4·5. Snapshot → Product 연결 — **C안 채택**

| 안 | 판단 |
|---|---|
| A. 신규만 연결, 기존 381건 legacy | 기존 상품의 수정/재등록이 영원히 불가 |
| B. `sourceUrl` 로 backfill | 🔴 **금지** — 자동 merge 는 CPO 금지선. 그리고 중복 6건이 잘못 합쳐진다 |
| **C. `productId` nullable · 점진 연결** | ✅ **채택** |

```text
Snapshot.productId  String?   ← 초기 nullable 필수
```

- 기존 381건은 `productId = null` 로 **그대로 보존**한다(변경 0).
- 신규 수집: Product 생성 → Snapshot 이 그 Product 를 참조.
- 기존 snapshot 은 **사람이 확인한 뒤에만** 연결한다(별도 작업).

**자동 backfill 가능한 데이터: 없음.** 동일성 판단 근거가 `sourceUrl` 뿐인데 그것을 식별자로 쓰지 않기로 했기 때문이다.

## 6. Snapshot 을 참조하는 7개 테이블 — **전부 그대로 둔다**

| 테이블 | Product FK 필요? | 이유 |
|---|---|---|
| `registration_attempts` | ❌ (대신 `channel_product_id`) | 등록은 «그 버전으로» 시도한 이력. snapshot 참조가 맞다 |
| `seller_compliance_confirmations` | ❌ | 확인은 그 시점 카테고리/정책버전에 묶인다 |
| `audit_log` · `price_alerts` · `price_observations` · `domestic_product_links` · `vision_observations` | ❌ | 전부 특정 버전에 대한 관측/기록 |

🔴 **Product Identity 를 추가한다고 모든 테이블을 Product 기준으로 바꾸지 않는다.** Product 로 조회해야 하는 것은 `Product → Snapshot → 각 테이블` 로 도달 가능하다.

## 7. ChannelProduct 최소 설계

```prisma
model ChannelProduct {
  id                String   @id @default(cuid())
  productId         String
  channel           String   // "smartstore" | "coupang" | "lotteon"
  externalProductId String
  status            String   // "LIVE" | "SUSPENDED" | "UNKNOWN"
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  product  Product              @relation(...)
  attempts RegistrationAttempt[]
  // @@unique([productId, channel])  ← 🔴 지금 걸지 않는다(§9)
}
```

**보류한 필드와 이유**
- `currentSnapshotId` — 「마지막으로 반영된 버전」이 필요해질 때 추가. 지금은 attempt 로 도달 가능.
- `previousExternalProductId` — §8 참조.
- `lastRegistrationAttemptId` — 역참조로 얻을 수 있어 중복.

### RECREATE 이력 — A안(최소) 채택

| 안 | 판단 |
|---|---|
| **A. `previousExternalProductId` 1칸** | ✅ 1인 운영 기준 최소. **단 2세대까지만** 보존 |
| B. `ChannelProductVersion[]` 별도 표 | 완전하지만 지금 필요 근거가 없다 |

🔴 **A 를 쓰되 한계를 명시한다**: 3회 이상 RECREATE 하면 가장 오래된 외부번호를 잃는다.
**대안**: 컬럼을 두지 말고 **RECREATE 시 `registration_attempts` 에 `operation="RECREATE"` + 이전 `external_product_id` 를 기록**하면 이력이 자동으로 완전해진다. **이 방식을 권장한다** — 새 컬럼 0개.

## 8. RegistrationAttempt 연결 방향

```prisma
model RegistrationAttempt {
  channelProductId String?   // nullable — 기존 97건 보존
  operation        String?   // "CREATE" | "UPDATE" | "RECREATE", nullable
  // snapshotId 는 그대로 유지
}
```

역할 분리를 고정한다:

| 객체 | 역할 |
|---|---|
| Product | 상품 정체성 |
| Snapshot | 수집·분석 시점의 버전 |
| **ChannelProduct** | **현재** 외부 상품과의 연결(상태) |
| **RegistrationAttempt** | 실행 **이력**(행위) |

🔴 `registration_attempts` 를 현재 상태 저장소로 쓰지 않는다. 「마지막 행 = 현재 상태」라는 가정이 지금의 중복 6건을 만들었다.

## 9. 기존 Production 데이터 · Duplicate Prevention

**기존 데이터: 읽기만.** merge·삭제·external ID 변경·소급 연결 전부 없음.

```text
SmartStore 중복  13668016862 · 13669115052 · 13670383541
                 13672230124 · 13672322468 · 13713032117
Coupang 중복     16336681622 · 16338809221 · 16340176952
정상 등록        13713593585(SS) · 16394846257(CP)
```

🔴 **`@@unique([productId, channel])` 를 «지금» 걸지 않는다.** 기존 중복이 Product 에 연결되는 순간 제약 위반이 된다. 순서는 ① 제약 없이 도입 → ② 중복 정리(CEO 사업 판단) → ③ 그 뒤에 제약.

**중복방지 전환**
```text
전: registration_attempts 의 latest SUBMITTED (snapshot 단위)
후: ChannelProduct(product_id, channel) 존재 여부
    존재 → CREATE 차단, UPDATE/RECREATE 로 유도
    없음 → CREATE 허용
    사용자가 RECREATE 를 «명시적으로» 고른 경우만 예외
```

## 10. Channel Capability Matrix

```text
SmartStore  CREATE ✅ · UPDATE API존재 · CATEGORY_UPDATE UNKNOWN  · RECREATE candidate
Coupang     CREATE ✅ · UPDATE 근거없음 · CATEGORY_UPDATE NOT_SUPPORTED · RECREATE required
LotteON     CREATE ✅ · UPDATE apiNo90  · CATEGORY_UPDATE UNKNOWN  · RECREATE candidate
```
🔴 `UNKNOWN` 을 `NOT_SUPPORTED` 로 바꾸지 않는다.

## 11. Prisma migration 초안 (실행하지 않음)

```sql
-- 1) Product 재정의 — 행 0건이라 안전
DROP INDEX IF EXISTS "Product_sourceUrl_key";
ALTER TABLE "Product" ALTER COLUMN "sourceUrl" DROP NOT NULL;

-- 2) Snapshot → Product (nullable — 기존 381건 그대로 null)
ALTER TABLE product_snapshots ADD COLUMN product_id TEXT NULL
  REFERENCES "Product"(id) ON DELETE SET NULL;
CREATE INDEX ON product_snapshots(product_id);

-- 3) ChannelProduct
CREATE TABLE channel_products (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_product_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON channel_products(product_id, channel);
-- 🔴 UNIQUE(product_id, channel) 는 중복 정리 뒤에

-- 4) Attempt → ChannelProduct (nullable — 기존 97건 그대로)
ALTER TABLE registration_attempts
  ADD COLUMN channel_product_id TEXT NULL REFERENCES channel_products(id),
  ADD COLUMN operation TEXT NULL;
```

**전부 additive · nullable** — 기존 데이터 변경 0, 기존 코드 영향 0.

## 12. Rollback

각 단계가 독립이라 역순으로 되돌릴 수 있다.
```sql
ALTER TABLE registration_attempts DROP COLUMN channel_product_id, DROP COLUMN operation;
DROP TABLE channel_products;
ALTER TABLE product_snapshots DROP COLUMN product_id;
-- Product 의 @unique 복원은 행 0건일 때만 가능 — 이미 Product 를 쓰기 시작했다면 복원하지 않는다.
```
🔴 **되돌릴 수 없는 지점**: `Product` 에 행이 생긴 뒤에는 `sourceUrl @unique` 를 되살릴 수 없다(중복 URL 가능). 그 전에 판단해야 한다.

## 13. 코드 변경 예정 파일 (구현 단계)

```text
packages/database/prisma/schema.prisma        Product 재정의 · ChannelProduct
packages/database/prisma/migrations_manual/   위 SQL
apps/admin/src/app/api/snapshots/route.ts     신규 수집 시 Product 생성·연결
apps/admin/src/app/api/snapshots/_lib/snapshot.ts
apps/admin/src/app/api/*/register/route.ts    등록 성공 시 ChannelProduct upsert
apps/admin/src/app/api/snapshots/[id]/attempts/route.ts  판정 기준 전환
apps/admin/src/app/pipeline/commerce/commerce-registry.ts  isAlreadyRegistered
```

## 14. 테스트 계획 (CPO Case A~E)

```text
A  P·S1 → SmartStore CREATE → ChannelProduct(SS) 생성
B  P·S2 → SmartStore UPDATE → external ID «동일»
C  P·S3 → Coupang CATEGORY 변경 → RECREATE → 새 external, 옛 것 이력 보존
D  P·새 Snapshot → Coupang CREATE 시도 → 🔴 중복 CREATE 차단
E  기존 중복 Production 데이터가 migration 으로 «변하지 않는다»
```
핵심 회귀: **새 snapshot 이 생겨도 기존 external ID 연결이 끊어지지 않는다.**

## 15·16·17

```text
실제 코드 변경   0
DB write         0 (migration 실행 0 · Product 데이터 생성 0 · backfill 0)
Production API   0건
```
