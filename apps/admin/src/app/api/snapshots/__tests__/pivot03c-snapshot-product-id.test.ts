import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-C 선행 — `ProductSnapshot.productId` 노출 (CPO 승인 2026-10-05)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 063 이 만든 `product_snapshots.product_id` 를 DTO 가 «버리고» 있었다. 그래서
 * 화면은 03-B ②④ 의 `/api/products/[productId]/…` 를 부를 키가 없었다.
 *
 * 🔴 이 패치의 위험은 「칸을 더하는 것」이 아니라 **「없음」이 둘이라는 것** 이다:
 *
 *     쿼리가 select 하지 않았다       → undefined
 *     상품 정체성 발급이 실패했다      → null
 *
 * `toSnapshot` 은 둘을 null 로 합친다. 합쳐도 되는 것은 toSnapshot 을 먹이는
 * 쿼리가 «전부» 전체 컬럼 select 이기 때문이고, **그 전제가 깨지면 화면이
 * 「상품이 있는데 없다」고 말한다.** 그래서 전제 자체를 테스트가 못박는다.
 */

const WS = "ws-1";

const hoisted = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const key of ["update", "select", "eq", "order", "limit", "insert"]) {
        chain[key] = () => chain;
      }
      chain.single = () => Promise.resolve({ data: hoisted.row, error: hoisted.row ? null : { message: "no rows" } });
      chain.maybeSingle = chain.single;
      return chain;
    },
  }),
}));

const { getSnapshot } = await import("../_lib/snapshot");

/** 실제 행 모양. 🔴 `product_id` 를 «들어 있는» 상태로 둔다 — 전체 컬럼 select 다. */
const row = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  source_url: "https://shop.example/a",
  title: "테스트 상품",
  thumbnail_url: null,
  status: "IN_PROGRESS",
  workspace: {},
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  last_opened_at: "2026-10-01T00:00:00.000Z",
  job_key: "JOB-261001-001",
  workspace_id: WS,
  product_id: "p-mine",
  ...over,
});

const source = async (file: string) => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  /* 🔴 주석을 벗긴다 — 이 파일들은 결정을 설명하는 주석이 코드보다 길다. */
  return readFileSync(join(__dirname, "..", "_lib", file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
};

beforeEach(() => {
  hoisted.row = row();
});

describe("① productId 가 DTO 로 «실제로» 건너온다", () => {
  it("행의 product_id 가 productId 로 온다", async () => {
    const snapshot = await getSnapshot("s1", WS);
    expect(snapshot?.productId).toBe("p-mine");
  });

  it("상품 정체성 발급이 실패했던 행(null)은 null 로 보존된다", async () => {
    hoisted.row = row({ product_id: null });
    expect((await getSnapshot("s1", WS))?.productId).toBeNull();
  });

  it("063 이전 행(칸 자체가 없음)도 null 이다 — undefined 를 흘려보내지 않는다", async () => {
    const legacy = row();
    delete (legacy as Record<string, unknown>).product_id;
    hoisted.row = legacy;
    const snapshot = await getSnapshot("s1", WS);
    expect(snapshot?.productId).toBeNull();
    /* 🔴 `undefined` 가 그대로 나가면 JSON 직렬화에서 «칸이 사라지고», 화면은
       「필드가 없다」와 「상품이 없다」를 구분하지 못한다. */
    expect("productId" in snapshot!).toBe(true);
  });

  it("기존 칸이 하나도 바뀌지 않았다 — 소비자 회귀", async () => {
    const snapshot = await getSnapshot("s1", WS);
    expect(snapshot).toEqual({
      id: "s1",
      sourceUrl: "https://shop.example/a",
      title: "테스트 상품",
      thumbnailUrl: null,
      status: "IN_PROGRESS",
      workspace: {},
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      lastOpenedAt: "2026-10-01T00:00:00.000Z",
      jobKey: "JOB-261001-001",
      workspaceId: WS,
      productId: "p-mine",
    });
  });
});

describe("② 🔴 전제를 못박는다 — toSnapshot 을 먹이는 쿼리는 «전부» 전체 컬럼 select", () => {
  it("toSnapshot 앞의 select 가 하나도 «명시 컬럼 목록» 이 아니다", async () => {
    const code = await source("snapshot.ts");
    const lines = code.split("\n");
    const offenders: string[] = [];

    lines.forEach((line, index) => {
      if (!/\btoSnapshot\b/.test(line) || line.includes("function toSnapshot")) return;
      /* 그 호출 위쪽에서 가장 가까운 .select( 를 찾는다. */
      for (let back = index; back >= Math.max(0, index - 70); back -= 1) {
        const match = /\.select\(([^)]*)\)/.exec(lines[back]!);
        if (!match) continue;
        const arg = match[1]!.trim();
        /* 전체 컬럼: `select()` 또는 `select("*")`. 그 밖은 명시 목록이다. */
        const isFull = arg === "" || arg === '"*"' || arg === "'*'";
        if (!isFull) offenders.push(`line ${index + 1} ← select(${arg}) @${back + 1}`);
        return;
      }
      offenders.push(`line ${index + 1} ← select 를 찾지 못함`);
    });

    expect(offenders, offenders.join(" / ")).toEqual([]);
  });

  it("🔴 가드가 공허하지 않다 — 실제로 toSnapshot 호출을 찾았다", async () => {
    const code = await source("snapshot.ts");
    const calls = code.split("\n").filter((line) => /\btoSnapshot\b/.test(line) && !line.includes("function toSnapshot"));
    expect(calls.length).toBeGreaterThan(3);
  });
});

describe("③ 🔴 목록(Summary)에는 «넣지 않았다» — 넣으려면 폴백도 같이 고쳐야 한다", () => {
  it("Summary 에 productId 가 없거나, 있다면 «두» 컬럼 목록이 모두 product_id 를 담는다", async () => {
    const types = await source("types.ts");
    const code = await source("snapshot.ts");

    const summaryBlock = types.slice(types.indexOf("export interface ProductSnapshotSummary"));
    const summaryHasProductId = /\bproductId\b/.test(summaryBlock.slice(0, summaryBlock.indexOf("\n}")));

    if (summaryHasProductId) {
      /* 🔴 목록은 명시 컬럼 목록 + 폴백 둘로 조회한다. 폴백에 칸을 안 넣으면
         구버전 경로에서 undefined → null 이 되어 «상품이 있는데 없다» 가 된다. */
      const primary = /const SUMMARY_COLUMNS\s*=\s*"([^"]*)"/.exec(code)?.[1] ?? "";
      const fallback = /const SUMMARY_COLUMNS_FALLBACK\s*=\s*"([^"]*)"/.exec(code)?.[1] ?? "";
      expect(primary, "SUMMARY_COLUMNS 에 product_id 가 없다").toContain("product_id");
      expect(fallback, "SUMMARY_COLUMNS_FALLBACK 에 product_id 가 없다").toContain("product_id");
    } else {
      /* 현재 선택: 넣지 않는다. 목록 카드는 이 값을 쓰지 않고, 폴백 경로가
         조용히 거짓을 말할 위험만 생긴다. */
      expect(summaryHasProductId).toBe(false);
    }
  });
});

describe("④ 🔴 범위 — 03-B API 와 Commerce 를 건드리지 않았다", () => {
  it("snapshot DTO 쪽에 소싱/채널 어휘가 들어오지 않았다", async () => {
    for (const file of ["snapshot.ts", "types.ts"]) {
      const code = await source(file);
      for (const forbidden of ["sourcing_candidates", "selected_sourcing_candidate_id", "computeMasterReady"]) {
        expect(code, `${file} → ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("🔴 productId 를 권한 근거로 쓰지 않는다", async () => {
    const code = await source("snapshot.ts");
    /* `product_id` 가 쿼리 «조건» 에 들어가면 그것은 권한 판단에 쓰기 시작한
       것이다. 이 파일에서 product_id 는 읽고 쓰기만 한다. */
    expect(code).not.toContain('.eq("product_id"');
  });

  it("🔴 스냅샷 하나를 짚는 쿼리는 «전부» workspace 로도 좁힌다", async () => {
    /* 🔴 처음엔 `expect(code).toContain('.eq(\"workspace_id\"')` 로 썼는데, 그것은
       「어딘가에 하나라도 있으면 통과」라 **하나를 지워도 걸리지 않았다**(음성
       대조 P5 가 통과해 버려서 드러났다). 개수로 박는 것도 의도의 대리물일
       뿐이라, 의도를 직접 본다 — `.eq("id", …)` 로 한 건을 짚는 «구문마다»
       같은 구문 안에 workspace 조건이 있는지. */
    const code = await source("snapshot.ts");
    const statements = code
      .split(";")
      .filter((statement) => /\.eq\("id",/.test(statement) && /from\("product_snapshots"\)/.test(statement));
    const unscoped = statements.filter((statement) => !/\.eq\("workspace_id",/.test(statement));

    /* ── 🔴 알려진 기준선 «하나» ─────────────────────────────────────────────
       `markSnapshotRegistered()` 가 workspace 없이 `status: "REGISTERED"` 를 쓴다.
       이 패치가 만든 것이 «아니고», 조이기 전의 느슨한 가드(`toContain`)가
       가리고 있던 기존 구멍이다. 열린 cross-workspace 쓰기는 «아니다» —
       호출부가 전부 `requireRegistrationAccess()` 3단계(스냅샷 소유권)를 먼저
       지난다. 즉 **다층 방어가 빠진 것**이고, 네 번째 호출부가 게이트를 빠뜨리면
       그때 열린다. 범위 밖이라 고치지 않고(CPO 범위 확정) 별도 과제로 넘겼다.

       🔴 `toEqual([])` 로 두면 이 테스트를 영구히 빨갛게 두거나 가드를 다시
       약하게 만들어야 한다. 대신 «아는 것 하나» 로 못박는다 — 새 구문이 하나라도
       늘면 실패하고, 저 과제가 고치면 0 이 되어 역시 실패해서 여기를 갱신하게
       된다. 어느 쪽이든 조용히 지나가지 않는다. */
    const known = unscoped.filter((statement) => /status: "REGISTERED"/.test(statement));
    const unexpected = unscoped.filter((statement) => !/status: "REGISTERED"/.test(statement));

    expect(unexpected.map((statement) => statement.trim().slice(0, 80)), "새 미검증 쓰기 경로").toEqual([]);
    expect(known, "markSnapshotRegistered 가 고쳐졌다면 이 기준선을 지워라").toHaveLength(1);

    /* 🔴 가드가 공허하지 않다 — 실제로 그런 구문을 여러 개 찾았다. */
    expect(statements.length).toBeGreaterThan(3);
  });
});
