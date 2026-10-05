import { describe, expect, it } from "vitest";
import {
  CANDIDATE_AVAILABILITY_VALUES,
  CANDIDATE_IMMUTABLE_FIELDS,
  CANDIDATE_MATCH_TRUTH_VALUES,
  CANDIDATE_MUTABLE_FIELDS,
  checkCandidateAccess,
  checkCandidateDelete,
  checkCandidateValues,
  checkCreateProvenance,
  checkUpdatePatch,
  parseSourceKind,
} from "../sourcing-candidate-policy";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ② — Candidate CRUD 정책 (CPO 게이트 3개)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 라우트가 아니라 «결정» 을 잰다. 라우트가 여러 개 생겨도 판정은 하나여야 하고,
 * 그 하나가 깨지지 않는지 보는 것이 이 파일이다.
 *
 *   ① ownership 이 force 보다 «먼저»
 *   ② CREATE 시점 provenance (077 이 CHECK 로 못 지키는 쪽)
 *   ③ Selected 삭제는 409 · force 일 때만 · 해제 사실 명시
 */
const WS = "ws-1";
const OTHER_WS = "ws-2";

describe("① 🔴 ownership — workspace → Product → Candidate", () => {
  it("자기 workspace 의 Product 는 통과한다", () => {
    expect(checkCandidateAccess({ requesterWorkspaceId: WS, productId: "A", productWorkspaceId: WS }).ok).toBe(true);
  });

  it("🔴 다른 workspace 의 Product 는 404 다 — 403 이 아니다", () => {
    const r = checkCandidateAccess({ requesterWorkspaceId: WS, productId: "A", productWorkspaceId: OTHER_WS });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      /* 403 으로 돌려주면 「그 Product 가 존재한다」가 새어 나간다(존재 여부 탐지).
         없음과 남의 것을 같은 응답으로 만든다. */
      expect(r.status).toBe(404);
      expect(r.error).toBe("상품을 찾을 수 없습니다.");
    }
  });

  it("Product 가 없으면 «같은» 404 다 — 구분되지 않는다", () => {
    const missing = checkCandidateAccess({ requesterWorkspaceId: WS, productId: "A", productWorkspaceId: null });
    const foreign = checkCandidateAccess({ requesterWorkspaceId: WS, productId: "A", productWorkspaceId: OTHER_WS });
    expect(missing).toEqual(foreign);
  });

  it("workspace 를 모르면 403 이다", () => {
    const r = checkCandidateAccess({ requesterWorkspaceId: null, productId: "A", productWorkspaceId: WS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("🔴 다른 Product 의 후보는 404 — 그 후보가 존재한다는 사실을 숨긴다", () => {
    const r = checkCandidateAccess({
      requesterWorkspaceId: WS,
      productId: "A",
      productWorkspaceId: WS,
      candidateProductId: "B",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(404);
      expect(r.error).toBe("소싱 후보를 찾을 수 없습니다.");
      /* 내부 식별자를 노출하지 않는다. */
      expect(r.error).not.toContain("B");
    }
  });

  it("자기 Product 의 후보는 통과한다", () => {
    expect(
      checkCandidateAccess({
        requesterWorkspaceId: WS,
        productId: "A",
        productWorkspaceId: WS,
        candidateProductId: "A",
      }).ok,
    ).toBe(true);
  });
});

describe("② 🔴 CREATE provenance — 077 이 CHECK 로 못 지키는 쪽", () => {
  it("SELLER_ENTERED + snapshot 없음 → 통과", () => {
    expect(
      checkCreateProvenance({
        sourceKind: "SELLER_ENTERED",
        originatingSnapshotId: null,
        productId: "A",
      }).ok,
    ).toBe(true);
  });

  it("🔴 SELLER_ENTERED + snapshot 있음 → 거절 (077 CHECK 와 같은 규칙)", () => {
    const r = checkCreateProvenance({
      sourceKind: "SELLER_ENTERED",
      originatingSnapshotId: "s1",
      snapshotProductId: "A",
      productId: "A",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("DISCOVERED + 같은 Product 의 snapshot → 통과", () => {
    expect(
      checkCreateProvenance({
        sourceKind: "DISCOVERED",
        originatingSnapshotId: "s1",
        snapshotProductId: "A",
        productId: "A",
      }).ok,
    ).toBe(true);
  });

  it("🔴 DISCOVERED + snapshot 없음 → 거절 (생성 시점 규칙 — CHECK 로는 못 지킨다)", () => {
    const r = checkCreateProvenance({ sourceKind: "DISCOVERED", originatingSnapshotId: null, productId: "A" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("🔴 DISCOVERED + «다른 Product» 의 snapshot → 404", () => {
    const r = checkCreateProvenance({
      sourceKind: "DISCOVERED",
      originatingSnapshotId: "s-of-B",
      snapshotProductId: "B",
      productId: "A",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(404);
      expect(r.error).not.toContain("B");
    }
  });

  it("🔴 삭제 후 상태(DISCOVERED + NULL)를 «생성» 으로는 만들 수 없다", () => {
    /* 077 이 그 상태를 DB 에서 «허용» 하는 것과, API 가 그렇게 «만들 수 있는» 것은
       다른 문제다. 허용은 snapshot 삭제의 결과일 때만이다. */
    expect(checkCreateProvenance({ sourceKind: "DISCOVERED", originatingSnapshotId: null, productId: "A" }).ok).toBe(
      false,
    );
  });
});

describe("UPDATE — 🔴 provenance 는 read-only", () => {
  it("가격·URL 수정은 통과한다", () => {
    expect(checkUpdatePatch({ priceAmount: 1000, sourceUrl: "https://x/y" }).ok).toBe(true);
  });

  it("🔴 sourceKind 를 바꾸려 하면 거절한다", () => {
    const r = checkUpdatePatch({ sourceKind: "SELLER_ENTERED" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("🔴 originatingSnapshotId 를 바꾸려 하면 거절한다", () => {
    expect(checkUpdatePatch({ originatingSnapshotId: "s-of-B" }).ok).toBe(false);
  });

  it("🔴 productId 를 바꿔 «소유자를 옮기는» 우회도 막는다", () => {
    expect(checkUpdatePatch({ productId: "B" }).ok).toBe(false);
  });

  it("🔴 내부 필드명을 메시지에 노출하지 않는다", () => {
    const r = checkUpdatePatch({ sourceKind: "DISCOVERED" });
    if (!r.ok) {
      expect(r.error).not.toContain("sourceKind");
      expect(r.error).not.toContain("source_kind");
    }
  });

  it("불변 목록이 비어 있지 않다 — 가드가 공허하지 않다", () => {
    expect(CANDIDATE_IMMUTABLE_FIELDS.length).toBeGreaterThan(3);
  });
});

describe("③ 🔴 Selected 삭제 — 409 · force 일 때만", () => {
  it("Selected 가 아니면 그냥 삭제된다 — selectedCleared=false", () => {
    const r = checkCandidateDelete({ isSelected: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selectedCleared).toBe(false);
  });

  it("🔴 Selected + force 없음 → 409", () => {
    const r = checkCandidateDelete({ isSelected: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(409);
      expect(r.error).toContain("선택한 소싱처입니다");
      expect(r.error).toContain("선택을 해제한 뒤 삭제");
    }
  });

  it("🔴 force=true → 삭제 허용 + «해제 사실을 명시» 반환", () => {
    const r = checkCandidateDelete({ isSelected: true, force: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selectedCleared).toBe(true);
  });

  it("🔴 force 는 «명시적 true» 만 인정한다 — truthy 아무 값이 아니다", () => {
    for (const notTrue of [undefined, false, null, 1, "true", "yes"] as unknown[]) {
      const r = checkCandidateDelete({ isSelected: true, force: notTrue as boolean });
      expect(r.ok, String(notTrue)).toBe(false);
    }
  });
});

describe("🔴 ownership 이 force 보다 «먼저» 다 — 순서가 계약이다", () => {
  it("삭제 정책 함수는 소유권을 «보지 않는다» — 그래서 라우트가 먼저 불러야 한다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    /* 🔴 주석을 벗긴다 — 이 파일은 결정을 설명하는 주석이 코드보다 길다. */
    const code = readFileSync(join(__dirname, "../sourcing-candidate-policy.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    const fn = code.slice(code.indexOf("export function checkCandidateDelete"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    /* 입력에 workspace/product 가 «없다» = force 가 소유권을 우회할 경로가
       타입 수준에서 존재하지 않는다. 대신 라우트가 순서를 지켜야 하고,
       그 요구를 주석과 이 테스트가 함께 못박는다. */
    expect(body).not.toContain("workspace");
    expect(body).not.toContain("productId");
  });

  it("🔴 force 가 들어와도 다른 Product 후보는 access 단계에서 막힌다", () => {
    /* 라우트 순서를 모사한다: access → delete. 첫 단계가 막으면 두 번째는
       아예 호출되지 않는다. */
    const access = checkCandidateAccess({
      requesterWorkspaceId: WS,
      productId: "A",
      productWorkspaceId: WS,
      candidateProductId: "B",
    });
    expect(access.ok).toBe(false);
    if (!access.ok) expect(access.status).toBe(404);
  });

  it("🔴 다른 workspace + force 조합도 access 에서 막힌다", () => {
    const access = checkCandidateAccess({
      requesterWorkspaceId: WS,
      productId: "A",
      productWorkspaceId: OTHER_WS,
      candidateProductId: "A",
    });
    expect(access.ok).toBe(false);
  });
});

describe("🔴 정책이 순수하다 — DB 도 네트워크도 보지 않는다", () => {
  it("소스에 DB/네트워크 호출이 없다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(join(__dirname, "../sourcing-candidate-policy.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toContain("supabase");
    expect(code).not.toContain("prisma");
    expect(code).not.toContain("fet" + "ch(");
  });

  it("같은 입력이면 같은 답이다", () => {
    const input = { isSelected: true, force: true };
    expect(checkCandidateDelete(input)).toEqual(checkCandidateDelete(input));
  });
});

describe("🔴 신규 행에 `source_kind = NULL` 을 만들 수 없다", () => {
  it("두 값만 통과한다", () => {
    for (const kind of ["DISCOVERED", "SELLER_ENTERED"] as const) {
      const r = parseSourceKind(kind);
      expect(r.ok, kind).toBe(true);
      if (r.ok) expect(r.sourceKind).toBe(kind);
    }
  });

  it("🔴 생략·null·모르는 값에 기본값을 골라 주지 않는다 — 전부 422", () => {
    for (const bad of [undefined, null, "", "AUTO", "discovered", 1, true, {}] as unknown[]) {
      const r = parseSourceKind(bad);
      expect(r.ok, String(bad)).toBe(false);
      if (!r.ok) expect(r.status, String(bad)).toBe(422);
    }
  });

  it("🔴 077 이 NULL 을 허용하는 것과 API 가 NULL 을 «만들 수 있는» 것은 다르다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(__dirname, "../../../../../packages/database/prisma/migrations_manual/077_sourcing_candidate_source_kind.sql"),
      "utf8",
    );
    /* NULL 허용은 «기존 행을 backfill 하지 않기로» 한 결과다 — 077 이 그렇게 적었다.
       그 뜻이 유지되는 한, 생성 경로는 NULL 을 막아야 한다. */
    expect(sql).toContain("source_kind TEXT NULL");
    expect(sql.toLowerCase()).toContain("backfill");
    expect(parseSourceKind(null).ok).toBe(false);
  });
});

describe("🔴 어휘를 새로 만들지 않았다 — 세 곳이 같은 말을 쓴다", () => {
  const read = async (relative: string) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return readFileSync(join(__dirname, "../../../../../", relative), "utf8");
  };

  it("availability 목록이 source-stock.ts 의 SourceStockState 와 «같다»", async () => {
    const code = await read("packages/shared/src/source-stock.ts");
    const declaration = code.slice(code.indexOf("export type SourceStockState"));
    const body = declaration.slice(0, declaration.indexOf(";"));
    const literals = [...body.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
    expect(literals.length).toBeGreaterThan(0);
    expect([...CANDIDATE_AVAILABILITY_VALUES].sort()).toEqual([...new Set(literals)].sort());
  });

  it("availability·identity_match_truth 목록이 075 SQL 의 CHECK 와 «같다»", async () => {
    const sql = await read("packages/database/prisma/migrations_manual/075_sourcing_candidates.sql");
    const checkOf = (column: string) => {
      const at = sql.indexOf(`${column} TEXT NULL`);
      expect(at, column).toBeGreaterThan(-1);
      const chunk = sql.slice(at, sql.indexOf("))", at));
      return [...new Set([...chunk.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]))].sort();
    };
    expect(checkOf("availability")).toEqual([...CANDIDATE_AVAILABILITY_VALUES].sort());
    expect(checkOf("identity_match_truth")).toEqual([...CANDIDATE_MATCH_TRUTH_VALUES].sort());
  });

  it("🔴 어휘 밖의 값은 DB 까지 가지 않는다 — CHECK 문구가 셀러에게 가지 않는다", () => {
    const stock = checkCandidateValues({ availability: "SOLDOUT" });
    expect(stock.ok).toBe(false);
    if (!stock.ok) {
      expect(stock.status).toBe(422);
      expect(stock.error).not.toContain("CHECK");
      expect(stock.error).not.toContain("availability");
    }
    expect(checkCandidateValues({ identityMatchTruth: "MAYBE" }).ok).toBe(false);
  });

  it("어휘 안의 값과 「없음」은 통과한다", () => {
    for (const value of CANDIDATE_AVAILABILITY_VALUES) {
      expect(checkCandidateValues({ availability: value }).ok, value).toBe(true);
    }
    expect(checkCandidateValues({ availability: null, identityMatchTruth: null }).ok).toBe(true);
    expect(checkCandidateValues({}).ok).toBe(true);
  });

  it("🔴 원가는 숫자여야 한다 — NUMERIC 칸에서 터지게 두지 않는다", () => {
    for (const bad of ["무료", "", NaN, -1, Infinity] as unknown[]) {
      expect(checkCandidateValues({ priceAmount: bad }).ok, String(bad)).toBe(false);
    }
    for (const good of [0, 1000, "1234.56"] as unknown[]) {
      expect(checkCandidateValues({ priceAmount: good }).ok, String(good)).toBe(true);
    }
    /* 🔴 「값이 없다」는 0 이 아니다 — 모름을 0 으로 바꾸지 않는다. */
    expect(checkCandidateValues({ priceAmount: null }).ok).toBe(true);
  });
});

describe("🔴 UPDATE 허용 목록 — 금지 목록이 아니다", () => {
  it("모르는 칸은 거절한다 — 조용히 버리지 않는다", () => {
    const r = checkUpdatePatch({ priceAmont: 1000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it("빈 수정을 성공으로 돌려주지 않는다", () => {
    expect(checkUpdatePatch({}).ok).toBe(false);
  });

  it("허용 목록과 불변 목록이 «겹치지 않는다»", () => {
    const overlap = CANDIDATE_MUTABLE_FIELDS.filter((field) =>
      (CANDIDATE_IMMUTABLE_FIELDS as readonly string[]).includes(field),
    );
    expect(overlap).toEqual([]);
  });

  it("허용된 칸은 통과하고, 어느 칸이 바뀌는지 돌려준다", () => {
    const r = checkUpdatePatch({ priceAmount: 1, availability: "IN_STOCK" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields.sort()).toEqual(["availability", "priceAmount"]);
  });
});
