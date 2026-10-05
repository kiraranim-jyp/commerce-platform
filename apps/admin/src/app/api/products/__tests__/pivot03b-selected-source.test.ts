import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ④ — Selected Source. CPO 검증 10개를 «동작» 으로 잰다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   1 동일 Product 후보만 선택 가능      6 새 후보 자동 선택 «금지»
 *   2 workspace isolation                7 OUT_OF_STOCK 이어도 선택 유지
 *   3 다른 Product 후보 선택 차단        8 재분석이 selection 을 바꾸지 않음
 *   4 없는 후보 차단                     9 Commerce/ChannelProduct 변경 없음
 *   5 `selected_...id` «만» 변경        10 Master Ready 는 기존 순수 함수로 계산
 *
 * 🔴 6·8·9 는 «부정형» 이다 — 코드의 «없음» 을 재는 것이라 테스트로만 남는다.
 * 그래서 쓰기를 전부 기록해 두고 「무엇을 건드렸는가」로 판정한다.
 */

const WS = "ws-1";
const OTHER_WS = "ws-2";

const hoisted = vi.hoisted(() => ({
  authOk: true,
  /** products 쓰기를 «먹어 버린다» — 076 이 DB 에서 거절한 경우를 흉내 낸다. */
  blockSelectionWrite: false,
  db: {} as Record<string, Record<string, unknown>[]>,
  /** 🔴 모든 쓰기를 기록한다. 부정형(9·5)을 이것으로 판정한다. */
  writes: [] as { table: string; op: string; keys: string[] }[],
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
    if (this.op !== "select") {
      hoisted.writes.push({ table: this.table, op: this.op, keys: Object.keys(this.payload) });
    }

    if (this.op === "insert") {
      const now = new Date().toISOString();
      const row: Row = { id: `cand-${++hoisted.seq}`, created_at: now, updated_at: now, ...this.payload };
      this.rows().push(row);
      return { data: [row], error: null };
    }
    if (this.op === "update") {
      const hits = this.matched();
      /* 🔴 「썼다」가 「반영됐다」가 아닌 경우를 만든다 — 라우트가 다시 읽는지 본다. */
      if (!(this.table === "products" && hoisted.blockSelectionWrite)) {
        for (const row of hits) Object.assign(row, this.payload);
      }
      return { data: hits, error: null };
    }
    if (this.op === "delete") {
      const hits = this.matched();
      hoisted.db[this.table] = this.rows().filter((row) => !hits.includes(row));
      return { data: hits, error: null };
    }
    return { data: this.matched(), error: null };
  }
}

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ from: (table: string) => new Query(table) }),
}));

const { GET, PUT, DELETE } = await import("../[productId]/selected-source/route");
/** ②의 생성 라우트. 🔴 「새 후보가 자동 선택되지 않는다」를 재기 위해 쓴다. */
const { POST: CREATE_CANDIDATE } = await import("../[productId]/sourcing-candidates/route");

const base = "http://localhost/api/products";
const ctx = (productId: string) => ({ params: Promise.resolve({ productId }) });

const get = (productId: string, query = "") =>
  GET(new Request(`${base}/${productId}/selected-source${query}`), ctx(productId));

const put = (productId: string, body: unknown) =>
  PUT(new Request(`${base}/${productId}/selected-source`, { method: "PUT", body: JSON.stringify(body) }), ctx(productId));

const clear = (productId: string, query = "") =>
  DELETE(new Request(`${base}/${productId}/selected-source${query}`, { method: "DELETE" }), ctx(productId));

const product = (id: string) => (hoisted.db.products ?? []).find((row) => row.id === id)!;
const candidates = () => hoisted.db.sourcing_candidates ?? [];

const candidate = (over: Row = {}): Row => ({
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
  hoisted.blockSelectionWrite = false;
  hoisted.seq = 0;
  hoisted.writes = [];
  hoisted.db = {
    products: [
      { id: "p-mine", workspace_id: WS, selected_sourcing_candidate_id: null, title: "원래 제목", updatedAt: "T0" },
      { id: "p-other-ws", workspace_id: OTHER_WS, selected_sourcing_candidate_id: null, title: "남의 것" },
      { id: "p-sibling", workspace_id: WS, selected_sourcing_candidate_id: null, title: "형제" },
    ],
    product_snapshots: [{ id: "s-mine", workspace_id: WS, product_id: "p-mine" }],
    sourcing_candidates: [candidate(), candidate({ id: "c2", source_url: "https://shop.example/b" })],
  };
});

describe("1·3·4 🔴 «이 Product 의» 후보만 고를 수 있다", () => {
  it("자기 후보를 고르면 선택된다", async () => {
    const res = await put("p-mine", { candidateId: "c1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.selectedCandidateId).toBe("c1");
    expect(body.selectedCandidate.id).toBe("c1");
    expect(product("p-mine").selected_sourcing_candidate_id).toBe("c1");
  });

  it("🔴 다른 Product 의 후보는 404 · 선택이 «그대로» 다", async () => {
    hoisted.db.sourcing_candidates!.push(candidate({ id: "c-sib", product_id: "p-sibling", source_url: "https://s/x" }));
    const res = await put("p-mine", { candidateId: "c-sib" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "소싱 후보를 찾을 수 없습니다." });
    expect(product("p-mine").selected_sourcing_candidate_id).toBeNull();
  });

  it("🔴 없는 후보와 «남의 후보» 가 같은 응답이다 — 존재 여부를 알려주지 않는다", async () => {
    hoisted.db.sourcing_candidates!.push(candidate({ id: "c-sib", product_id: "p-sibling", source_url: "https://s/x" }));
    const missing = await put("p-mine", { candidateId: "c-nope" });
    const foreign = await put("p-mine", { candidateId: "c-sib" });
    expect(missing.status).toBe(foreign.status);
    expect(await missing.json()).toEqual(await foreign.json());
  });

  it("후보를 지정하지 않으면 400", async () => {
    expect((await put("p-mine", {})).status).toBe(400);
    expect((await put("p-mine", { candidateId: "   " })).status).toBe(400);
  });

  it("🔴 선택 command 로 후보 값을 고칠 수 없다 — 422", async () => {
    /* ②와 ④의 경계다. 이것이 열리면 PATCH 하나가 선택까지 바꾸는 쪽으로 다시 섞인다. */
    const res = await put("p-mine", { candidateId: "c1", priceAmount: 9 });
    expect(res.status).toBe(422);
    expect(product("p-mine").selected_sourcing_candidate_id).toBeNull();
    expect(candidates()[0].price_amount).toBe("1000");
  });
});

describe("2 🔴 workspace isolation", () => {
  it("로그인하지 않으면 401 이고 쓰기가 «한 번도» 없다", async () => {
    hoisted.authOk = false;
    const res = await put("p-mine", { candidateId: "c1" });
    expect(res.status).toBe(401);
    expect(hoisted.writes).toEqual([]);
  });

  it("🔴 남의 workspace Product 는 404 · 그 Product 의 선택이 바뀌지 않는다", async () => {
    const res = await put("p-other-ws", { candidateId: "c1" });
    expect(res.status).toBe(404);
    expect(product("p-other-ws").selected_sourcing_candidate_id).toBeNull();
    expect(hoisted.writes).toEqual([]);
  });

  it("남의 Product 의 선택을 «해제» 할 수도 없다", async () => {
    product("p-other-ws").selected_sourcing_candidate_id = "c1";
    const res = await clear("p-other-ws");
    expect(res.status).toBe(404);
    expect(product("p-other-ws").selected_sourcing_candidate_id).toBe("c1");
  });

  it("없는 Product 와 남의 Product 가 같은 응답이다", async () => {
    const missing = await get("p-nope");
    const foreign = await get("p-other-ws");
    expect(missing.status).toBe(foreign.status);
    expect(await missing.json()).toEqual(await foreign.json());
  });
});

describe("5 🔴 `selected_sourcing_candidate_id` «만» 변경한다", () => {
  it("쓰기는 products 한 번이고, 패치의 칸이 «하나» 다", async () => {
    await put("p-mine", { candidateId: "c1" });
    const writes = hoisted.writes;
    expect(writes).toHaveLength(1);
    expect(writes[0]!.table).toBe("products");
    expect(writes[0]!.op).toBe("update");
    /* 🔴 `updated_at` 조차 없다 — Product 의 다른 칸을 건드리면 「상품이 수정됐다」로
       읽히고, 등록 경로가 그 시각을 근거로 쓴다. */
    expect(writes[0]!.keys).toEqual(["selected_sourcing_candidate_id"]);
  });

  it("Product 의 다른 칸이 그대로다", async () => {
    await put("p-mine", { candidateId: "c1" });
    expect(product("p-mine").title).toBe("원래 제목");
    expect(product("p-mine").updatedAt).toBe("T0");
  });

  it("후보 표에는 «쓰지 않는다» — 선택은 Product 의 칸이다", async () => {
    await put("p-mine", { candidateId: "c1" });
    expect(hoisted.writes.some((w) => w.table === "sourcing_candidates")).toBe(false);
    expect(candidates()).toHaveLength(2);
  });

  it("🔴 해제는 후보를 «지우지 않는다»", async () => {
    product("p-mine").selected_sourcing_candidate_id = "c1";
    const res = await clear("p-mine");
    expect(res.status).toBe(200);
    expect((await res.json()).selectedCandidateId).toBeNull();
    expect(candidates()).toHaveLength(2);
    expect(hoisted.writes.every((w) => w.op !== "delete")).toBe(true);
  });

  it("🔴 「썼다」를 「반영됐다」로 단정하지 않는다 — 다시 읽어 확인한다", async () => {
    hoisted.blockSelectionWrite = true;
    const res = await put("p-mine", { candidateId: "c1" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("반영되지 않았습니다");
  });

  it("같은 후보를 두 번 골라도 같은 결과다 — idempotent", async () => {
    const first = await put("p-mine", { candidateId: "c1" });
    const second = await put("p-mine", { candidateId: "c1" });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).selectedCandidateId).toBe("c1");
  });
});

describe("6 🔴 새 후보가 생겨도 «자동으로 선택되지 않는다»", () => {
  it("②의 생성 라우트가 선택을 건드리지 않는다", async () => {
    const res = await CREATE_CANDIDATE(
      new Request(`${base}/p-mine/sourcing-candidates`, {
        method: "POST",
        body: JSON.stringify({ sourceKind: "SELLER_ENTERED", sourceUrl: "https://shop.example/z", sourceSite: "example" }),
      }),
      ctx("p-mine"),
    );
    expect(res.status).toBe(201);
    /* 🔴 「첫 후보니까 골라 주자」가 없다 — 선택은 사람의 의사표시다. */
    expect(product("p-mine").selected_sourcing_candidate_id).toBeNull();
    expect(hoisted.writes.some((w) => w.table === "products")).toBe(false);
  });

  it("이미 고른 뒤에 후보가 늘어도 선택이 바뀌지 않는다", async () => {
    await put("p-mine", { candidateId: "c2" });
    hoisted.db.sourcing_candidates!.push(candidate({ id: "c3", source_url: "https://shop.example/c" }));
    const body = await (await get("p-mine")).json();
    expect(body.selectedCandidateId).toBe("c2");
    expect(body.candidateCount).toBe(3);
  });
});

describe("7 🔴 품절이어도 선택을 유지한다", () => {
  beforeEach(() => {
    hoisted.db.sourcing_candidates = [candidate({ availability: "OUT_OF_STOCK" })];
  });

  it("품절 후보도 «고를 수 있다» — 막지 않는다", async () => {
    const res = await put("p-mine", { candidateId: "c1", registrationReady: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.selectedCandidateId).toBe("c1");
    expect(body.masterReady.masterConfirmed).toBe(true);
  });

  it("🔴 경고만 올린다 — 결정은 셀러에게 남긴다", async () => {
    const body = await (await put("p-mine", { candidateId: "c1" })).json();
    expect(body.masterReady.warning).toContain("품절");
    expect(body.masterReady.warning).toContain("다른 후보로 바꾸거나");
  });

  it("고른 뒤 품절이 되어도 선택이 «풀리지 않는다»", async () => {
    await put("p-mine", { candidateId: "c1" });
    hoisted.writes = [];
    candidates()[0].availability = "OUT_OF_STOCK";
    const body = await (await get("p-mine")).json();
    expect(body.selectedCandidateId).toBe("c1");
    /* 🔴 조회가 쓰기를 «하지 않는다» — 자동 해제 경로가 없다. */
    expect(hoisted.writes).toEqual([]);
  });

  it("재고를 «모르는» 경우를 품절로 읽지 않는다", async () => {
    candidates()[0].availability = null;
    const body = await (await put("p-mine", { candidateId: "c1" })).json();
    expect(body.masterReady.warning).toContain("확인하지 못했습니다");
    expect(body.masterReady.warning).not.toContain("품절");
  });

  it("🔴 어휘 밖의 재고 문자열을 그대로 믿지 않는다", async () => {
    candidates()[0].availability = "SOLDOUT";
    const body = await (await put("p-mine", { candidateId: "c1" })).json();
    /* 모르는 값은 「모름」으로 떨어진다 — 「재고 있음」으로 읽지 않는다. */
    expect(body.masterReady.warning).toContain("확인하지 못했습니다");
  });
});

describe("8 🔴 재분석이 기존 selection 을 바꾸지 않는다", () => {
  it("snapshot 이 늘어도 선택과 단계가 같다", async () => {
    await put("p-mine", { candidateId: "c1", registrationReady: true });
    const before = await (await get("p-mine", "?registrationReady=true")).json();

    hoisted.db.product_snapshots!.push({ id: "s-new", workspace_id: WS, product_id: "p-mine" });
    hoisted.writes = [];
    const after = await (await get("p-mine", "?registrationReady=true")).json();

    expect(after.selectedCandidateId).toBe(before.selectedCandidateId);
    expect(after.masterReady).toEqual(before.masterReady);
    expect(hoisted.writes).toEqual([]);
  });

  it("🔴 이 라우트는 snapshot 을 «읽지도» 않는다 — 바꿀 경로가 없다", async () => {
    await put("p-mine", { candidateId: "c1" });
    await get("p-mine");
    const touched = new Set(hoisted.writes.map((w) => w.table));
    expect(touched.has("product_snapshots")).toBe(false);

    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(join(__dirname, "..", "[productId]", "selected-source", "route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).not.toContain("product_snapshots");
    expect(code.toLowerCase()).not.toContain("snapshot");
  });
});

describe("9 🔴 Commerce / ChannelProduct 를 건드리지 않는다", () => {
  it("쓰기가 닿은 표는 products 뿐이다", async () => {
    await put("p-mine", { candidateId: "c1" });
    await clear("p-mine");
    expect([...new Set(hoisted.writes.map((w) => w.table))]).toEqual(["products"]);
  });

  it("소스가 채널 코드를 import 하지 않는다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const files = [
      join(__dirname, "..", "[productId]", "selected-source", "route.ts"),
      join(__dirname, "..", "_lib", "selected-source-store.ts"),
      join(__dirname, "..", "..", "..", "..", "lib", "selected-source-policy.ts"),
    ];
    for (const file of files) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      for (const forbidden of ["smartstore", "coupang", "lotteon", "naver", "channel_products", "ChannelProduct"]) {
        expect(code.toLowerCase(), `${file} → ${forbidden}`).not.toContain(forbidden.toLowerCase());
      }
    }
  });
});

describe("10 🔴 Master Ready 를 «다시 구현하지 않는다»", () => {
  it("판정 함수를 라우트가 재구현하지 않았다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(join(__dirname, "..", "[productId]", "selected-source", "route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    /* 기존 순수 함수를 «부른다». */
    expect(code).toContain("computeMasterReady");
    /* 🔴 등록 readiness 판정을 두 곳에서 구현하면 화면과 서버가 다른 말을 한다. */
    expect(code).not.toContain("computeChecklistReadiness");
    expect(code).not.toContain("validateNaverPayload");
    /* 단계 문자열을 라우트가 지어내지 않는다 — 순수 함수의 출력이다. */
    expect(code).not.toContain("READY_FOR_COMMERCE");
    expect(code).not.toContain("SOURCING_READY");
  });

  it("단계가 상태에 따라 갈린다 — 후보 0 / 미선택 / 선택 / 등록가능", async () => {
    hoisted.db.sourcing_candidates = [];
    expect((await (await get("p-mine")).json()).masterReady.stage).toBe("DISCOVERED");

    hoisted.db.sourcing_candidates = [candidate()];
    expect((await (await get("p-mine")).json()).masterReady.stage).toBe("SOURCING_READY");

    await put("p-mine", { candidateId: "c1" });
    expect((await (await get("p-mine")).json()).masterReady.stage).toBe("SOURCE_SELECTED");
    expect((await (await get("p-mine", "?registrationReady=true")).json()).masterReady.stage).toBe(
      "READY_FOR_COMMERCE",
    );
  });

  it("🔴 readiness 를 «받지 못했으면» 평가되지 않았다고 말한다 — 「아니다」가 아니다", async () => {
    await put("p-mine", { candidateId: "c1" });
    const unknown = await (await get("p-mine")).json();
    expect(unknown.registrationReadyEvaluated).toBe(false);
    /* 평가 안 된 상태로 「등록 가능」을 띄우지 않는다. */
    expect(unknown.masterReady.stage).not.toBe("READY_FOR_COMMERCE");

    const evaluated = await (await get("p-mine", "?registrationReady=false")).json();
    expect(evaluated.registrationReadyEvaluated).toBe(true);
    expect(evaluated.masterReady.readyForCommerce).toBe(false);
  });

  it("🔴 readiness 에 모르는 값이 오면 기본값을 골라 주지 않는다 — 422", async () => {
    expect((await get("p-mine", "?registrationReady=maybe")).status).toBe(422);
    expect((await put("p-mine", { candidateId: "c1", registrationReady: "maybe" })).status).toBe(422);
    expect(product("p-mine").selected_sourcing_candidate_id).toBeNull();
  });

  it("🔴 readiness 입력이 «쓰기» 에는 영향을 주지 않는다", async () => {
    await put("p-mine", { candidateId: "c1", registrationReady: true });
    expect(hoisted.writes).toHaveLength(1);
    expect(hoisted.writes[0]!.keys).toEqual(["selected_sourcing_candidate_id"]);
  });
});
