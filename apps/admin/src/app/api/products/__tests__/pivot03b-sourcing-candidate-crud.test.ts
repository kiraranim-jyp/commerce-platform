import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ② — Candidate CRUD 라우트. CPO 게이트 3개를 «동작» 으로 잰다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 여기서 재는 것은 「소스에 checkCandidateAccess 라는 글자가 있는가」가 «아니다».
 * 글자만 보면 불러 놓고 결과를 버리는 코드도 통과한다(comparison-shops auth-gate
 * 테스트가 같은 이유로 적어 둔 경고다). 실제 응답 코드와 **행이 남아 있는가** 를 본다.
 *
 *   ① ownership 이 force 보다 «먼저» — force=true 로도 남의 후보가 지워지지 않는다
 *   ② CREATE 시점 provenance — 077 의 CHECK 가 못 지키는 쪽
 *   ③ Selected 삭제 — 409 · force=true 일 때만 · 해제 사실 명시
 */

const WS = "ws-1";
const OTHER_WS = "ws-2";

const hoisted = vi.hoisted(() => ({
  authOk: true,
  /** FK 의 `ON DELETE SET NULL` 이 적용돼 있는가를 «끌 수 있게» 둔다. */
  fkSetNull: true,
  db: {} as Record<string, Record<string, unknown>[]>,
  seq: 0,
}));

vi.mock("@/lib/auth/require-user", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireUser: async () =>
      hoisted.authOk
        ? { ok: true, user: { userId: "u1", email: "a@b.c", workspaceId: WS, impersonated: false } }
        : {
            ok: false,
            response: NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 }),
          },
  };
});

/* ── 최소 Supabase 대역 ───────────────────────────────────────────────────────
   🔴 unique 제약과 077 CHECK, 그리고 `ON DELETE SET NULL` 까지 흉내 낸다 —
   그것들이 흉내 나지 않으면 409/422 경로가 테스트에서 «영원히» 안 돌아간다. */
type Row = Record<string, unknown>;

class Query {
  private filters: [string, unknown][] = [];
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row = {};

  constructor(private table: string) {}

  select() {
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order() {
    return Promise.resolve(this.run());
  }
  maybeSingle() {
    const r = this.run();
    return Promise.resolve(r.error ? r : { data: r.data[0] ?? null, error: null });
  }
  single() {
    const r = this.run();
    if (r.error) return Promise.resolve(r);
    return Promise.resolve(
      r.data.length ? { data: r.data[0], error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } },
    );
  }
  then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
    return Promise.resolve(this.run()).then(onOk, onErr);
  }

  private rows() {
    return (hoisted.db[this.table] ??= []);
  }
  private matched() {
    return this.rows().filter((row) => this.filters.every(([column, value]) => row[column] === value));
  }

  private run(): { data: Row[]; error: { code?: string; message: string } | null } {
    if (this.op === "insert") {
      const payload = this.payload;
      if (this.table === "sourcing_candidates") {
        const clash = this.rows().some(
          (row) => row.product_id === payload.product_id && row.source_url === payload.source_url,
        );
        /* 075 `UNIQUE(product_id, source_url)` */
        if (clash) return { data: [], error: { code: "23505", message: "duplicate key" } };
        /* 077 `CHECK (source_kind <> 'SELLER_ENTERED' OR originating_snapshot_id IS NULL)` */
        if (payload.source_kind === "SELLER_ENTERED" && payload.originating_snapshot_id != null) {
          return { data: [], error: { code: "23514", message: "check violation" } };
        }
      }
      const now = new Date().toISOString();
      const row: Row = { id: `cand-${++hoisted.seq}`, created_at: now, updated_at: now, ...payload };
      this.rows().push(row);
      return { data: [row], error: null };
    }

    if (this.op === "update") {
      const hits = this.matched();
      if (this.table === "sourcing_candidates" && typeof this.payload.source_url === "string") {
        const clash = this.rows().some(
          (row) =>
            !hits.includes(row) && row.product_id === hits[0]?.product_id && row.source_url === this.payload.source_url,
        );
        if (clash) return { data: [], error: { code: "23505", message: "duplicate key" } };
      }
      for (const row of hits) Object.assign(row, this.payload);
      return { data: hits, error: null };
    }

    if (this.op === "delete") {
      const hits = this.matched();
      hoisted.db[this.table] = this.rows().filter((row) => !hits.includes(row));
      if (this.table === "sourcing_candidates" && hoisted.fkSetNull) {
        for (const product of hoisted.db.products ?? []) {
          if (hits.some((row) => row.id === product.selected_sourcing_candidate_id)) {
            product.selected_sourcing_candidate_id = null;
          }
        }
      }
      return { data: hits, error: null };
    }

    return { data: this.matched(), error: null };
  }
}

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ from: (table: string) => new Query(table) }),
}));

const { GET: LIST, POST } = await import("../[productId]/sourcing-candidates/route");
const { GET, PATCH, DELETE } = await import("../[productId]/sourcing-candidates/[candidateId]/route");

const base = "http://localhost/api/products";
const listParams = (productId: string) => ({ params: Promise.resolve({ productId }) });
const itemParams = (productId: string, candidateId: string) => ({ params: Promise.resolve({ productId, candidateId }) });

const post = (productId: string, body: unknown) =>
  POST(new Request(`${base}/${productId}/sourcing-candidates`, { method: "POST", body: JSON.stringify(body) }), listParams(productId));

const patch = (productId: string, candidateId: string, body: unknown) =>
  PATCH(
    new Request(`${base}/${productId}/sourcing-candidates/${candidateId}`, { method: "PATCH", body: JSON.stringify(body) }),
    itemParams(productId, candidateId),
  );

const del = (productId: string, candidateId: string, query = "") =>
  DELETE(
    new Request(`${base}/${productId}/sourcing-candidates/${candidateId}${query}`, { method: "DELETE" }),
    itemParams(productId, candidateId),
  );

const candidates = () => hoisted.db.sourcing_candidates ?? [];
const product = (id: string) => (hoisted.db.products ?? []).find((row) => row.id === id);

/** 정상 후보 하나. `SELLER_ENTERED` 라 snapshot 이 필요 없다. */
const seedCandidate = (over: Row = {}): Row => ({
  id: "c1",
  product_id: "p-mine",
  workspace_id: WS,
  source_kind: "SELLER_ENTERED",
  originating_snapshot_id: null,
  source_url: "https://shop.example/a",
  source_site: "example",
  source_country: null,
  price_amount: "1000",
  currency: "USD",
  availability: "IN_STOCK",
  shipping_note: null,
  identity_match_truth: null,
  observed_at: null,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  hoisted.authOk = true;
  hoisted.fkSetNull = true;
  hoisted.seq = 0;
  hoisted.db = {
    products: [
      { id: "p-mine", workspace_id: WS, selected_sourcing_candidate_id: null },
      { id: "p-other-ws", workspace_id: OTHER_WS, selected_sourcing_candidate_id: null },
      { id: "p-sibling", workspace_id: WS, selected_sourcing_candidate_id: null },
      /* 066 이전 행 — workspace_id 가 NULL 이다. 「주인 없음」을 통과시키지 않는다. */
      { id: "p-legacy", workspace_id: null, selected_sourcing_candidate_id: null },
    ],
    product_snapshots: [
      { id: "s-mine", workspace_id: WS, product_id: "p-mine" },
      { id: "s-sibling", workspace_id: WS, product_id: "p-sibling" },
      { id: "s-other-ws", workspace_id: OTHER_WS, product_id: "p-other-ws" },
    ],
    sourcing_candidates: [],
  };
});

describe("① 🔴 ownership 이 force 보다 «먼저» 다", () => {
  it("로그인하지 않으면 401 이고 DB 를 건드리지 않는다", async () => {
    hoisted.authOk = false;
    hoisted.db.sourcing_candidates = [seedCandidate()];
    const res = await del("p-mine", "c1", "?force=true");
    expect(res.status).toBe(401);
    expect(candidates()).toHaveLength(1);
  });

  it("🔴 남의 workspace Product 의 후보는 force=true 로도 지워지지 않는다", async () => {
    hoisted.db.sourcing_candidates = [seedCandidate({ product_id: "p-other-ws", workspace_id: OTHER_WS })];
    hoisted.db.products![1].selected_sourcing_candidate_id = "c1";

    const res = await del("p-other-ws", "c1", "?force=true");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "상품을 찾을 수 없습니다." });
    /* 🔴 응답만 보지 않는다 — 행이 «살아 있어야» 한다. */
    expect(candidates()).toHaveLength(1);
    expect(product("p-other-ws")!.selected_sourcing_candidate_id).toBe("c1");
  });

  it("🔴 같은 workspace 라도 «다른 Product» 의 후보는 force=true 로도 지워지지 않는다", async () => {
    hoisted.db.sourcing_candidates = [seedCandidate({ product_id: "p-sibling" })];
    const res = await del("p-mine", "c1", "?force=true");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "소싱 후보를 찾을 수 없습니다." });
    expect(candidates()).toHaveLength(1);
  });

  it("066 이전의 주인 없는 Product(workspace_id NULL)도 통과시키지 않는다", async () => {
    const res = await LIST(new Request(`${base}/p-legacy/sourcing-candidates`), listParams("p-legacy"));
    expect(res.status).toBe(404);
  });

  it("🔴 없는 Product 와 남의 Product 가 «같은» 응답이다 — 존재 여부를 알려주지 않는다", async () => {
    const missing = await LIST(new Request(`${base}/p-nope/sourcing-candidates`), listParams("p-nope"));
    const foreign = await LIST(new Request(`${base}/p-other-ws/sourcing-candidates`), listParams("p-other-ws"));
    expect(missing.status).toBe(foreign.status);
    expect(await missing.json()).toEqual(await foreign.json());
  });

  it("자기 Product 의 목록은 선택 id 와 «함께» 돌려준다", async () => {
    hoisted.db.sourcing_candidates = [seedCandidate()];
    hoisted.db.products![0].selected_sourcing_candidate_id = "c1";
    const res = await LIST(new Request(`${base}/p-mine/sourcing-candidates`), listParams("p-mine"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.candidates).toHaveLength(1);
    expect(body.selectedCandidateId).toBe("c1");
    /* 🔴 내부 격리 식별자를 내보내지 않는다. */
    expect(JSON.stringify(body)).not.toContain(WS);
  });

  it("🔴 남의 workspace 후보는 목록에 섞이지 않는다", async () => {
    hoisted.db.sourcing_candidates = [
      seedCandidate(),
      seedCandidate({ id: "c2", workspace_id: OTHER_WS, source_url: "https://shop.example/b" }),
    ];
    const res = await LIST(new Request(`${base}/p-mine/sourcing-candidates`), listParams("p-mine"));
    const body = await res.json();
    expect(body.candidates.map((c: { id: string }) => c.id)).toEqual(["c1"]);
  });
});

describe("② 🔴 CREATE 시점 provenance", () => {
  const body = { sourceUrl: "https://shop.example/new", sourceSite: "example" };

  it("SELLER_ENTERED + snapshot 없음 → 201", async () => {
    const res = await post("p-mine", { ...body, sourceKind: "SELLER_ENTERED" });
    expect(res.status).toBe(201);
    const saved = (await res.json()).candidate;
    expect(saved.sourceKind).toBe("SELLER_ENTERED");
    expect(saved.originatingSnapshotId).toBeNull();
    expect(candidates()).toHaveLength(1);
  });

  it("🔴 SELLER_ENTERED + snapshot 있음 → 422 · 행이 생기지 않는다", async () => {
    const res = await post("p-mine", { ...body, sourceKind: "SELLER_ENTERED", originatingSnapshotId: "s-mine" });
    expect(res.status).toBe(422);
    expect(candidates()).toHaveLength(0);
  });

  it("DISCOVERED + 같은 Product 의 snapshot → 201", async () => {
    const res = await post("p-mine", { ...body, sourceKind: "DISCOVERED", originatingSnapshotId: "s-mine" });
    expect(res.status).toBe(201);
    expect((await res.json()).candidate.originatingSnapshotId).toBe("s-mine");
  });

  it("🔴 DISCOVERED + snapshot 없음 → 422 (CHECK 로는 못 막는 쪽)", async () => {
    const res = await post("p-mine", { ...body, sourceKind: "DISCOVERED" });
    expect(res.status).toBe(422);
    expect(candidates()).toHaveLength(0);
  });

  it("🔴 DISCOVERED + «다른 Product» 의 snapshot → 404 · 행이 생기지 않는다", async () => {
    const res = await post("p-mine", { ...body, sourceKind: "DISCOVERED", originatingSnapshotId: "s-sibling" });
    expect(res.status).toBe(404);
    expect(candidates()).toHaveLength(0);
  });

  it("🔴 DISCOVERED + 남의 workspace snapshot → 404 (존재 여부를 알려주지 않는다)", async () => {
    const res = await post("p-mine", { ...body, sourceKind: "DISCOVERED", originatingSnapshotId: "s-other-ws" });
    expect(res.status).toBe(404);
    expect(candidates()).toHaveLength(0);
  });

  it("🔴 sourceKind 를 생략하면 거절한다 — 신규 행에 NULL 을 만들지 않는다", async () => {
    const res = await post("p-mine", body);
    expect(res.status).toBe(422);
    /* 077 이 NULL 을 허용하는 것은 «기존 행» 때문이다. 신규 정상 상태가 아니다. */
    expect(candidates()).toHaveLength(0);
  });

  it("🔴 모르는 sourceKind 값에 기본값을 골라 주지 않는다", async () => {
    const res = await post("p-mine", { ...body, sourceKind: "AUTO" });
    expect(res.status).toBe(422);
    expect(candidates()).toHaveLength(0);
  });

  it("🔴 모르는 칸이 있으면 거절한다 — 조용히 버리고 201 을 주지 않는다", async () => {
    const res = await post("p-mine", { ...body, sourceKind: "SELLER_ENTERED", priceAmont: 1000 });
    expect(res.status).toBe(422);
    expect(candidates()).toHaveLength(0);
  });

  it("🔴 body 의 workspaceId/productId 를 권한 근거로 쓰지 않는다 — 거절된다", async () => {
    for (const sneaky of [{ workspaceId: OTHER_WS }, { productId: "p-other-ws" }, { id: "forced" }]) {
      hoisted.db.sourcing_candidates = [];
      const res = await post("p-mine", { ...body, sourceKind: "SELLER_ENTERED", ...sneaky });
      expect(res.status, JSON.stringify(sneaky)).toBe(422);
      expect(candidates()).toHaveLength(0);
    }
  });

  it("소싱처 주소나 사이트 이름이 없으면 400", async () => {
    expect((await post("p-mine", { sourceKind: "SELLER_ENTERED", sourceSite: "example" })).status).toBe(400);
    expect((await post("p-mine", { sourceKind: "SELLER_ENTERED", sourceUrl: "https://x/y" })).status).toBe(400);
    expect((await post("p-mine", { sourceKind: "SELLER_ENTERED", sourceUrl: "   ", sourceSite: "  " })).status).toBe(400);
  });

  it("🔴 같은 Product 에 같은 소싱처 URL 은 두 번 서지 않는다 → 409 + 「수정하라」", async () => {
    hoisted.db.sourcing_candidates = [seedCandidate({ source_url: "https://shop.example/new" })];
    const res = await post("p-mine", { ...body, sourceKind: "SELLER_ENTERED" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("가격을 수정하세요");
    expect(candidates()).toHaveLength(1);
  });

  it("재고/근거 값이 어휘 밖이면 422 — DB CHECK 문구가 셀러에게 가지 않는다", async () => {
    const bad = await post("p-mine", { ...body, sourceKind: "SELLER_ENTERED", availability: "SOLDOUT" });
    expect(bad.status).toBe(422);
    expect((await bad.json()).error).not.toContain("CHECK");
    expect((await post("p-mine", { ...body, sourceKind: "SELLER_ENTERED", identityMatchTruth: "MAYBE" })).status).toBe(422);
    expect((await post("p-mine", { ...body, sourceKind: "SELLER_ENTERED", priceAmount: "무료" })).status).toBe(422);
    expect(candidates()).toHaveLength(0);
  });

  it("남의 Product 에는 만들 수 없다 — ownership 이 body 검사보다 먼저다", async () => {
    const res = await post("p-other-ws", { ...body, sourceKind: "SELLER_ENTERED" });
    expect(res.status).toBe(404);
    expect(candidates()).toHaveLength(0);
  });
});

describe("③ 🔴 Selected 삭제 — 409 · force=true 일 때만", () => {
  beforeEach(() => {
    hoisted.db.sourcing_candidates = [seedCandidate()];
  });

  it("Selected 가 아니면 그냥 지워진다 — selectedCleared=false", async () => {
    const res = await del("p-mine", "c1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, selectedCleared: false });
    expect(candidates()).toHaveLength(0);
  });

  it("🔴 Selected + force 없음 → 409 · 행과 선택이 «그대로» 다", async () => {
    hoisted.db.products![0].selected_sourcing_candidate_id = "c1";
    const res = await del("p-mine", "c1");
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("선택을 해제한 뒤 삭제");
    expect(candidates()).toHaveLength(1);
    expect(product("p-mine")!.selected_sourcing_candidate_id).toBe("c1");
  });

  it("🔴 force=true → 삭제 + 선택 해제 + 해제 사실을 «명시» 한다", async () => {
    hoisted.db.products![0].selected_sourcing_candidate_id = "c1";
    const res = await del("p-mine", "c1", "?force=true");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, selectedCleared: true });
    expect(candidates()).toHaveLength(0);
    expect(product("p-mine")!.selected_sourcing_candidate_id).toBeNull();
  });

  it("🔴 force 는 «명시적 true» 만 인정한다 — ?force=1 · ?force · ?force=yes 는 아니다", async () => {
    for (const query of ["?force=1", "?force", "?force=yes", "?force=TRUE", ""]) {
      hoisted.db.sourcing_candidates = [seedCandidate()];
      hoisted.db.products![0].selected_sourcing_candidate_id = "c1";
      const res = await del("p-mine", "c1", query);
      expect(res.status, query).toBe(409);
      expect(candidates(), query).toHaveLength(1);
    }
  });

  it("🔴 FK 의 SET NULL 이 «없어도» 선택이 남아 있지 않다 — 단정하지 않고 확인한다", async () => {
    /* 076 이 적용돼 있다는 가정에 기대지 않는다. 적용돼 있지 않으면 dangling 이
       남고, 화면은 「선택됨」이라면서 그 후보를 찾지 못한다. */
    hoisted.fkSetNull = false;
    hoisted.db.products![0].selected_sourcing_candidate_id = "c1";
    const res = await del("p-mine", "c1", "?force=true");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, selectedCleared: true });
    expect(product("p-mine")!.selected_sourcing_candidate_id).toBeNull();
  });

  it("없는 후보를 지우려 하면 404 — force 여부와 무관하다", async () => {
    expect((await del("p-mine", "c-nope", "?force=true")).status).toBe(404);
  });
});

describe("UPDATE — 🔴 provenance 는 read-only", () => {
  beforeEach(() => {
    hoisted.db.sourcing_candidates = [seedCandidate()];
  });

  it("가격과 재고는 수정된다 — updated_at 도 바뀐다", async () => {
    const res = await patch("p-mine", "c1", { priceAmount: 2500, availability: "OUT_OF_STOCK" });
    expect(res.status).toBe(200);
    const saved = (await res.json()).candidate;
    expect(saved.priceAmount).toBe(2500);
    expect(saved.availability).toBe("OUT_OF_STOCK");
    expect(saved.updatedAt).not.toBe("2026-10-01T00:00:00.000Z");
  });

  it("🔴 sourceKind 를 바꾸려 하면 422 · 값이 «그대로» 다", async () => {
    const res = await patch("p-mine", "c1", { sourceKind: "DISCOVERED" });
    expect(res.status).toBe(422);
    expect(candidates()[0].source_kind).toBe("SELLER_ENTERED");
  });

  it("🔴 originatingSnapshotId 를 붙이려 하면 422", async () => {
    const res = await patch("p-mine", "c1", { originatingSnapshotId: "s-mine" });
    expect(res.status).toBe(422);
    expect(candidates()[0].originating_snapshot_id).toBeNull();
  });

  it("🔴 productId 를 바꿔 «소유자를 옮기는» 우회도 막는다", async () => {
    const res = await patch("p-mine", "c1", { productId: "p-sibling" });
    expect(res.status).toBe(422);
    expect(candidates()[0].product_id).toBe("p-mine");
  });

  it("🔴 모르는 칸은 거절한다 — 조용히 버리고 200 을 주지 않는다", async () => {
    const res = await patch("p-mine", "c1", { priceAmont: 999 });
    expect(res.status).toBe(422);
    expect(candidates()[0].price_amount).toBe("1000");
  });

  it("🔴 빈 수정을 성공으로 돌려주지 않는다", async () => {
    expect((await patch("p-mine", "c1", {})).status).toBe(422);
  });

  it("어휘 밖의 재고 값은 422 — DB 까지 가지 않는다", async () => {
    const res = await patch("p-mine", "c1", { availability: "SOLDOUT" });
    expect(res.status).toBe(422);
    expect(candidates()[0].availability).toBe("IN_STOCK");
  });

  it("남의 Product 의 후보는 수정되지 않는다", async () => {
    hoisted.db.sourcing_candidates = [seedCandidate({ product_id: "p-other-ws", workspace_id: OTHER_WS })];
    const res = await patch("p-other-ws", "c1", { priceAmount: 1 });
    expect(res.status).toBe(404);
    expect(candidates()[0].price_amount).toBe("1000");
  });

  it("단건 조회는 선택 여부를 «Product 쪽 값과 대조해» 돌려준다", async () => {
    hoisted.db.products![0].selected_sourcing_candidate_id = "c1";
    const res = await GET(new Request(`${base}/p-mine/sourcing-candidates/c1`), itemParams("p-mine", "c1"));
    const body = await res.json();
    expect(body.isSelected).toBe(true);
    expect(body.candidate.id).toBe("c1");
  });
});

describe("🔴 범위 — Commerce 등록 경로를 건드리지 않는다", () => {
  it("이 라우트들이 SmartStore/Coupang/LotteON 을 import 하지 않는다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(__dirname, "..", "[productId]", "sourcing-candidates");
    for (const file of ["route.ts", join("[candidateId]", "route.ts")]) {
      const code = readFileSync(join(dir, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      for (const forbidden of ["smartstore", "coupang", "lotteon", "naver", "channel-product"]) {
        expect(code.toLowerCase(), `${file} → ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
