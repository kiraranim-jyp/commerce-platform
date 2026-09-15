import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GLOBAL-MARKET ③-2(CPO 확정, 2026-09-11) — "한 판매자가 편집샵을 끄면 모든
 * 판매자의 목록에서 사라진다"는 구조적 결함이 다시 생기지 않게 고정한다.
 *
 * 지금 실사용자가 한 명이라 이 버그는 화면에 드러난 적이 없다. 그래서 더더욱
 * 테스트로 못 박아야 한다 — 두 번째 판매자가 생기는 날 회귀를 발견하면 이미
 * 사고다. 검증 대상은 "실효 노출을 어디서 어떻게 합치는가"(listDomesticPriceSources)와
 * "토글이 어느 테이블에 쓰는가"(setWorkspaceDomesticShopEnabled) 두 가지다.
 */

const WORKSPACE_A = "11111111-1111-1111-1111-111111111111";
const WORKSPACE_B = "22222222-2222-2222-2222-222222222222";
const SHOP_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function catalogRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SHOP_ID,
    name: "테스트 편집샵",
    domain: "test-shop.co.kr",
    url: "https://test-shop.co.kr",
    currency: "KRW",
    category_scope: [],
    priority: "P1",
    collection_strategy: "AUTO_SCRAPE",
    status: "ACTIVE",
    last_error_code: null,
    last_error_message: null,
    source: "SYSTEM",
    enabled: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface SettingRow {
  workspace_id: string;
  source_id: string;
  enabled: boolean;
}

/** 최소 Supabase 쿼리 빌더 스텁. eq 조건을 실제로 적용해서 "workspace 조건이
 * 진짜로 걸리는가"를 관찰할 수 있게 한다(snapshot-ownership.test.ts와 동일 방식). */
function makeSupabaseStub(options: {
  catalog: Record<string, unknown>[];
  settings: SettingRow[];
  /** 마이그레이션 047 미실행 상황 재현. */
  settingsTableMissing?: boolean;
}) {
  const settings = [...options.settings];
  const upserts: Record<string, unknown>[] = [];
  const catalogUpdates: Record<string, unknown>[] = [];

  function builder(table: string) {
    const filters: Array<[string, unknown]> = [];
    let mode: "select" | "upsert" | "update" = "select";
    /** GOLF-01 축 A — listDomesticPriceSources가 거는 소유자 필터
     * (`workspace_id.is.null,workspace_id.eq.<uuid>`). 스텁이 이 조건을 실제로
     * 적용해야 "셀러 추가분이 남의 목록에 안 보인다"를 관찰할 수 있다. */
    let ownerFilter: string | null = null;

    const chain = {
      select: () => chain,
      order: () => chain,
      or: (expr: string) => {
        const m = /workspace_id\.eq\.([0-9a-fA-F-]+)/.exec(expr);
        ownerFilter = m ? m[1] : null;
        return chain;
      },
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return chain;
      },
      upsert: (row: Record<string, unknown>) => {
        mode = "upsert";
        upserts.push(row);
        return chain;
      },
      update: (patch: Record<string, unknown>) => {
        mode = "update";
        if (table === "domestic_price_sources") catalogUpdates.push(patch);
        return chain;
      },
      then: (resolve: (v: unknown) => unknown) => {
        if (table === "domestic_price_sources") {
          if (mode === "select") {
            const visible = options.catalog.filter((row) => {
              const owner = (row as { workspace_id?: string | null }).workspace_id ?? null;
              if (owner === null) return true; // 중앙 기본 카탈로그는 모두가 본다
              return ownerFilter !== null && owner === ownerFilter;
            });
            return resolve({ data: visible, error: null });
          }
          return resolve({ error: null });
        }
        if (options.settingsTableMissing) {
          return resolve({
            data: null,
            // PostgREST가 실제로 내는 형태(테이블 자체가 스키마 캐시에 없음).
            error: {
              code: "PGRST205",
              message: "Could not find the table 'public.workspace_domestic_shop_settings' in the schema cache",
            },
          });
        }
        if (mode === "upsert") {
          for (const row of upserts.slice(-1)) {
            const existing = settings.find(
              (s) => s.workspace_id === row.workspace_id && s.source_id === row.source_id,
            );
            if (existing) existing.enabled = row.enabled as boolean;
            else
              settings.push({
                workspace_id: row.workspace_id as string,
                source_id: row.source_id as string,
                enabled: row.enabled as boolean,
              });
          }
          return resolve({ error: null });
        }
        const matched = settings.filter((s) =>
          filters.every(([col, val]) => (s as unknown as Record<string, unknown>)[col] === val),
        );
        return resolve({ data: matched.map((s) => ({ source_id: s.source_id, enabled: s.enabled })), error: null });
      },
    };
    return chain;
  }

  return { from: builder, upserts, catalogUpdates, settings };
}

let stub: ReturnType<typeof makeSupabaseStub>;

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => stub,
}));

describe("GLOBAL-MARKET ③-2 — 국내 편집샵 ON/OFF는 워크스페이스별이다", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("설정 행이 없으면 그 워크스페이스에서는 켜진 것으로 본다", async () => {
    // 카탈로그에 편집샵이 추가되면 기존 판매자에게도 기본으로 보여야 한다 —
    // 반대로 하면 새 편집샵이 아무에게도 안 보인다(마이그레이션 047 주석).
    stub = makeSupabaseStub({ catalog: [catalogRow()], settings: [] });
    const { listDomesticPriceSources } = await import("../domestic-price-source");

    const [shop] = await listDomesticPriceSources(WORKSPACE_A);
    expect(shop.workspaceEnabled).toBe(true);
    expect(shop.enabled).toBe(true);
  });

  it("A가 끈 편집샵은 A에게만 숨겨지고 B에게는 그대로 보인다", async () => {
    stub = makeSupabaseStub({
      catalog: [catalogRow()],
      settings: [{ workspace_id: WORKSPACE_A, source_id: SHOP_ID, enabled: false }],
    });
    const { listDomesticPriceSources } = await import("../domestic-price-source");

    const [forA] = await listDomesticPriceSources(WORKSPACE_A);
    const [forB] = await listDomesticPriceSources(WORKSPACE_B);
    expect(forA.enabled).toBe(false);
    expect(forB.enabled).toBe(true);
    // 카탈로그 자체는 여전히 켜져 있다 — A의 선택이 공용 상태를 바꾸지 않았다.
    expect(forA.catalogEnabled).toBe(true);
  });

  it("운영자가 내린 편집샵(카탈로그 OFF)은 내가 켜 뒀어도 보이지 않는다", async () => {
    stub = makeSupabaseStub({
      catalog: [catalogRow({ enabled: false })],
      settings: [{ workspace_id: WORKSPACE_A, source_id: SHOP_ID, enabled: true }],
    });
    const { listDomesticPriceSources } = await import("../domestic-price-source");

    const [forA] = await listDomesticPriceSources(WORKSPACE_A);
    const [forB] = await listDomesticPriceSources(WORKSPACE_B);
    expect(forA.enabled).toBe(false);
    expect(forB.enabled).toBe(false);
    // 체크박스는 여전히 내 선택(켬)을 보여줘야 한다 — 화면이 내 설정을
    // 임의로 뒤집지 않는다(안 보이는 이유는 별도 배지로 표시된다).
    expect(forA.workspaceEnabled).toBe(true);
  });

  it("A에서 토글해도 B의 목록은 바뀌지 않는다 — 쓰기는 (workspace_id, source_id)로만 간다", async () => {
    stub = makeSupabaseStub({ catalog: [catalogRow()], settings: [] });
    const { listDomesticPriceSources, setWorkspaceDomesticShopEnabled } = await import("../domestic-price-source");

    const result = await setWorkspaceDomesticShopEnabled(WORKSPACE_A, SHOP_ID, false);
    expect(result.ok).toBe(true);

    const [forA] = await listDomesticPriceSources(WORKSPACE_A);
    const [forB] = await listDomesticPriceSources(WORKSPACE_B);
    expect(forA.enabled).toBe(false);
    expect(forB.enabled).toBe(true);

    // 토글이 공용 카탈로그를 건드리지 않는다는 것을 쓰기 호출 자체로 확인한다 —
    // 이 한 줄이 이번에 고친 버그의 재발 방지선이다.
    expect(stub.catalogUpdates).toHaveLength(0);
    expect(stub.upserts[0]).toMatchObject({ workspace_id: WORKSPACE_A, source_id: SHOP_ID, enabled: false });
  });

  it("마이그레이션 047 미실행(테이블 없음)이어도 목록은 비지 않는다 — 카탈로그 상태로 열린다", async () => {
    stub = makeSupabaseStub({
      catalog: [catalogRow(), catalogRow({ id: "bbbb", domain: "b.co.kr", enabled: false })],
      settings: [],
      settingsTableMissing: true,
    });
    const { listDomesticPriceSources } = await import("../domestic-price-source");

    const sources = await listDomesticPriceSources(WORKSPACE_A);
    expect(sources).toHaveLength(2);
    // 설정을 못 읽었을 때는 전부 "설정 없음 = ON"으로 보고, 실효 노출이
    // 카탈로그 상태와 정확히 같아진다(마이그레이션 전 동작 그대로).
    expect(sources[0].enabled).toBe(true);
    expect(sources[1].enabled).toBe(false);
  });

  /**
   * GOLF-01 축 A(CEO 지시, 2026-09-15) — 047이 만든 "판매자별"은 on/off에만
   * 적용되고 **목록의 구성**에는 적용되지 않았다: createDomesticPriceSource()가
   * workspace_id 없이 공용 카탈로그에 넣어서, A가 추가한 사이트가 B·C에게도
   * 보였다. 실사용에서 아직 터지지 않은 이유는 source='USER' 국내 소스가 실측
   * 0행이기 때문일 뿐이다 — 위 on/off 버그와 정확히 같은 종류의 잠복이라
   * 같은 자리에서 못 박는다.
   */
  it("B가 추가한 사이트는 A의 목록에 나타나지 않는다", async () => {
    stub = makeSupabaseStub({
      catalog: [
        catalogRow(), // 중앙 기본 카탈로그(workspace_id 없음)
        catalogRow({ id: "b-only", domain: "b-only.co.kr", source: "USER", workspace_id: WORKSPACE_B }),
      ],
      settings: [],
    });
    const { listDomesticPriceSources } = await import("../domestic-price-source");

    const forA = await listDomesticPriceSources(WORKSPACE_A);
    const forB = await listDomesticPriceSources(WORKSPACE_B);
    expect(forA.map((s) => s.domain), "B가 추가한 사이트가 A에게 새어 나갔다").toEqual(["test-shop.co.kr"]);
    expect(forB.map((s) => s.domain).sort()).toEqual(["b-only.co.kr", "test-shop.co.kr"]);
    // 중앙 기본 사이트는 양쪽 다에게 보인다 — 격리가 공용 카탈로그까지 먹으면
    // 모든 판매자의 목록이 통째로 비어 버린다.
    expect(forA[0].workspaceId).toBeNull();
    expect(forB.find((s) => s.domain === "b-only.co.kr")!.workspaceId).toBe(WORKSPACE_B);
  });

  it("카탈로그 메타데이터 수정은 enabled를 절대 쓰지 않는다", async () => {
    stub = makeSupabaseStub({ catalog: [catalogRow()], settings: [] });
    const { updateDomesticPriceSource } = await import("../domestic-price-source");

    await updateDomesticPriceSource(SHOP_ID, { priority: "P0", status: "PAUSED" });
    expect(stub.catalogUpdates).toHaveLength(1);
    expect(stub.catalogUpdates[0]).not.toHaveProperty("enabled");
    expect(stub.catalogUpdates[0]).toMatchObject({ priority: "P0", status: "PAUSED" });
  });
});
