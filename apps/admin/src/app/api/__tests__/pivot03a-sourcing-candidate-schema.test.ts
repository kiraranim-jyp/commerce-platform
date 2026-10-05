import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-A — SourcingCandidate / Selected Source 스키마 계약 (CPO 확정 2026-10-05)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 것은 「표가 생겼다」가 아니라 **PIVOT-02 가 내린 결정들이
 * 스키마에 그대로 박혀 있는가** 다. 결정을 글로만 남기면 다음 사람이 모른다.
 *
 *   ① Candidate 소유자는 Product (snapshot 아님) + provenance 보존
 *   ② Selected Source 는 Product 의 명시적 reference
 *   ③ MI 결과(CASE·마진·radar·판정)를 저장하지 «않는다»
 *   ④/⑤ Master lifecycle 상태 컬럼을 만들지 «않는다» — 파생이다
 *
 * 🔴 SQL 과 Prisma 가 «같은 것» 을 말하는지도 본다 — 둘이 갈리면 ORM 이 없는
 * 컬럼을 가리키고, 그 사고가 이 저장소에 이미 기록돼 있다(schema.prisma:23-25).
 */
const SQL = readFileSync(
  join(__dirname, "../../../../../../packages/database/prisma/migrations_manual/075_sourcing_candidates.sql"),
  "utf8",
);
const PRISMA = readFileSync(
  join(__dirname, "../../../../../../packages/database/prisma/schema.prisma"),
  "utf8",
);

/** 🔴 주석을 벗긴다 — 이 두 파일은 «결정을 설명하는» 주석이 코드보다 길다.
 *  벗기지 않으면 「MI 를 저장하지 않는다」를 설명하는 문장이 「margin 이 있다」로
 *  잡힌다(이 저장소에서 반복해 걸린 함정). */
const sqlCode = SQL.replace(/^\s*--.*$/gm, "");
const prismaCode = PRISMA.replace(/^\s*\/\/\/?.*$/gm, "");

describe("① 🔴 소유자는 Product 다 — snapshot 이 아니다", () => {
  it("SQL: product_id 가 NOT NULL 이고 products 를 CASCADE 로 참조한다", () => {
    expect(sqlCode).toContain("product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE");
  });

  it("🔴 SQL: provenance 는 «따로» 있고 NULL 허용 · SET NULL 이다", () => {
    /* snapshot 이 지워져도 후보는 살아야 한다 — 소유자가 Product 이기 때문이다. */
    expect(sqlCode).toContain("originating_snapshot_id UUID NULL REFERENCES product_snapshots(id) ON DELETE SET NULL");
  });

  it("Prisma: 같은 관계를 말한다", () => {
    expect(prismaCode).toContain('product   Product @relation("ProductCandidates"');
    expect(prismaCode).toContain("onDelete: Cascade");
    expect(prismaCode).toContain('originatingSnapshotId String? @map("originating_snapshot_id")');
  });

  it("🔴 provenance 가 소유자 역할을 하지 «않는다» — NOT NULL 이 아니다", () => {
    expect(sqlCode).not.toContain("originating_snapshot_id UUID NOT NULL");
  });
});

describe("② 🔴 Selected Source 는 Product 의 명시적 칸이다", () => {
  it("SQL: products 에 ADD COLUMN 으로 «더한다» — 기존 컬럼을 고치지 않는다", () => {
    expect(sqlCode).toContain("ALTER TABLE products");
    expect(sqlCode).toContain("ADD COLUMN IF NOT EXISTS selected_sourcing_candidate_id UUID NULL");
    expect(sqlCode).toContain("REFERENCES sourcing_candidates(id) ON DELETE SET NULL");
  });

  it("🔴 snapshot workspace jsonb 에 넣지 않았다", () => {
    expect(sqlCode).not.toContain("product_snapshots SET workspace");
    expect(sqlCode).not.toContain("ALTER TABLE product_snapshots");
  });

  it("Prisma 가 같은 컬럼명을 가리킨다", () => {
    expect(prismaCode).toContain('@map("selected_sourcing_candidate_id")');
  });
});

describe("③ 🔴 MI 결과를 저장하지 «않는다» — 칸이 없다", () => {
  /* PIVOT-02 ③ 결정. 「22.4%」가 지금 판단인지 과거인지 모호해지는 것을 막는다. */
  const FORBIDDEN = [
    "market_case",
    "case_code",
    "margin",
    "net_margin",
    "radar",
    "recommendation",
    "final_judgment",
    "verdict",
    "expected_selling_price",
    "landed_cost",
  ];

  it("SQL 에 MI 판단 칸이 하나도 없다", () => {
    for (const column of FORBIDDEN) {
      expect(sqlCode.toLowerCase(), `${column} 칸이 생겼다 — MI 는 현재 시점 계산이다`).not.toContain(column);
    }
  });

  it("Prisma 모델에도 없다", () => {
    const model = prismaCode.slice(prismaCode.indexOf("model SourcingCandidate"));
    const body = model.slice(0, model.indexOf("}"));
    for (const column of FORBIDDEN) {
      expect(body.toLowerCase(), `${column}`).not.toContain(column);
    }
  });

  it("🔴 가드가 공허하지 않다 — 원가 근거 칸은 «있다»", () => {
    expect(sqlCode).toContain("price_amount");
    expect(sqlCode).toContain("observed_at");
  });
});

describe("④⑤ 🔴 Master lifecycle 상태 컬럼을 만들지 않았다 — 파생이다", () => {
  it("SQL 에 master/lifecycle 상태 칸이 없다", () => {
    for (const column of ["master_confirmed", "master_status", "lifecycle", "pivot_status"]) {
      expect(sqlCode.toLowerCase(), column).not.toContain(column);
    }
  });

  it("🔴 snapshot.status 를 확장하지 않았다 — 두 lifecycle 을 섞지 않는다", () => {
    /* snapshot.status 는 「수집·분석 실행」의 lifecycle 이고 Master 는 Product 의
       것이다. 섞으면 재분석으로 새 snapshot 이 IN_PROGRESS 가 되는 순간 이미
       확정된 Master 가 미확정으로 보인다. */
    expect(sqlCode).not.toContain("DISCOVERED");
    expect(sqlCode).not.toContain("MI_READY");
    expect(sqlCode).not.toContain("SOURCING_READY");
    expect(sqlCode).not.toContain("MASTER_CONFIRMED");
  });
});

describe("🔴 어휘를 새로 만들지 않았다 — 기존 것과 «같은 말»", () => {
  it("availability CHECK 가 SourceStockState 와 정확히 같다", () => {
    /* 🔴 목록을 테스트에 다시 적지 «않는다» — 적으면 그것이 또 하나의 진실이 되고,
       shared 가 값을 더할 때 둘이 갈린다. 타입 «원문» 을 읽어 대조한다.
       (런타임 배열 export 가 없다 — 처음에 있다고 가정했다가 확인해서 고쳤다.) */
    const stockSource = readFileSync(
      join(__dirname, "../../../../../../packages/shared/src/source-stock.ts"),
      "utf8",
    );
    const union = stockSource.slice(stockSource.indexOf("export type SourceStockState"));
    const states = [...union.slice(0, union.indexOf(";")).matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
    expect(states.length, "SourceStockState 를 읽지 못했다").toBeGreaterThan(2);
    for (const state of states) {
      expect(sqlCode, `availability 에 ${state} 가 빠졌다`).toContain(`'${state}'`);
    }
  });

  it("identity_match_truth 가 030 의 MatchTruth 6값과 같다", () => {
    for (const truth of [
      "EXACT_IDENTIFIER",
      "STRONG_IDENTIFIER",
      "TEXT_CONFIRMED",
      "SIMILAR",
      "INSUFFICIENT_EVIDENCE",
      "CONFLICT",
    ]) {
      expect(sqlCode, truth).toContain(`'${truth}'`);
    }
  });
});

describe("🔴 기존 경로를 건드리지 않았다", () => {
  it("MI · Commerce · 채널 표를 수정하지 않았다", () => {
    for (const table of [
      "price_observations",
      "domestic_product_links",
      "channel_products",
      "registration_attempts",
    ]) {
      expect(sqlCode, `${table} 를 건드렸다`).not.toContain(`ALTER TABLE ${table}`);
      expect(sqlCode, `${table} 를 지웠다`).not.toContain(`DROP TABLE ${table}`);
    }
  });

  it("🔴 sourceUrl 기반 자동 merge 를 만들지 않았다", () => {
    /* 자동 merge 금지는 CPO 확정이고 schema.prisma 머리 주석이 그 근거다. */
    expect(sqlCode).not.toContain("UPDATE products SET");
    expect(sqlCode).not.toMatch(/MERGE|ON CONFLICT \(.*sourceUrl/i);
  });

  it("되돌리는 방법이 적혀 있다 — 순서까지", () => {
    expect(SQL).toContain("DROP TABLE IF EXISTS sourcing_candidates;");
    expect(SQL).toContain("ALTER TABLE products DROP COLUMN IF EXISTS selected_sourcing_candidate_id;");
  });
});
