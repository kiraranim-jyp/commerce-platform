import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DOMESTIC-PRICE-TRIGGER-1(CEO 지시, 2026-09-12) — **하지 않기로 한 것**을 고정한다.
 *
 * 이번 작업은 "쓰는 자리를 하나 되살리는" 일이지, "쓰는 자리를 늘리는" 일이
 * 아니다. 두 경계가 흐려지면 되살린 트리거보다 더 비싼 것이 딸려 온다:
 *
 *  ① 화면 조회용 /api/domestic-price-sources/search는 지금도, 앞으로도 아무것도
 *     저장하지 않는다. 이 라우트는 셀러가 화면을 볼 때마다 실시간으로 도는
 *     읽기 전용 경로다(라우트 상단 P-7-B 주석). 여기에 저장을 붙이면 화면을
 *     여닫는 것만으로 링크/관측이 쌓인다.
 *
 *  ② 일 1회 배치는 되살리지 않는다. 51758aa가 배치를 걷어내면서
 *     listAllSnapshotsForBatch도 함께 지웠고, 그건 "workspace 경계를 넘어
 *     스냅샷을 읽는 유일한 경로"였다(BETA-SECURITY-2 §11 예외). 배치를
 *     되살리는 순간 그 예외도 같이 돌아온다.
 */

const ADMIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const REPO_ROOT = path.resolve(ADMIN_ROOT, "../..");
const SHOP_DOMAIN = "kidsboutique.example.com";

const hoisted = vi.hoisted(() => ({
  searchDomesticShops: vi.fn(),
  listDomesticPriceSources: vi.fn(),
  upsertDomesticProductLink: vi.fn(),
  recordPriceObservations: vi.fn(),
  recordDomesticSourceCheckAttempt: vi.fn(),
}));

vi.mock("@commerce/crawler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@commerce/crawler")>();
  return { ...actual, searchDomesticShops: hoisted.searchDomesticShops };
});

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: async () => ({ ok: true, user: { id: "user-1", workspaceId: "ws-1" } }),
}));

vi.mock("../../../domestic-price-sources/_lib/domestic-price-source", () => ({
  listDomesticPriceSources: hoisted.listDomesticPriceSources,
  recordDomesticSourceCheckAttempt: hoisted.recordDomesticSourceCheckAttempt,
}));

// 이 두 모듈이 "쓰는 자리"의 전부다. 검색 라우트는 오늘 이 모듈들을 import조차
// 하지 않는다 — 누군가 나중에 배선하면 아래 not.toHaveBeenCalled()가 깨진다.
vi.mock("../../../domestic-price-sources/_lib/domestic-product-link", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../domestic-price-sources/_lib/domestic-product-link")>();
  return { ...actual, upsertDomesticProductLink: hoisted.upsertDomesticProductLink };
});

vi.mock("../price-observations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../price-observations")>();
  return { ...actual, recordPriceObservations: hoisted.recordPriceObservations };
});

beforeEach(() => {
  hoisted.searchDomesticShops.mockReset();
  hoisted.listDomesticPriceSources.mockReset();
  hoisted.upsertDomesticProductLink.mockReset();
  hoisted.recordPriceObservations.mockReset();
  hoisted.recordDomesticSourceCheckAttempt.mockReset();

  hoisted.listDomesticPriceSources.mockResolvedValue([
    {
      id: "source-1",
      name: "키즈부티크",
      domain: SHOP_DOMAIN,
      url: `https://${SHOP_DOMAIN}`,
      currency: "KRW",
      categoryScope: [],
      priority: "P0",
      collectionStrategy: "AUTO_SCRAPE",
      status: "ACTIVE",
      lastErrorCode: null,
      lastErrorMessage: null,
      lastCheckedAt: null,
      lastSuccessAt: null,
      source: "SYSTEM",
      sourceType: "VERTICAL",
      enabled: true,
      catalogEnabled: true,
      workspaceEnabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  hoisted.searchDomesticShops.mockResolvedValue([
    {
      shopId: "source-1",
      shopName: "키즈부티크",
      domain: SHOP_DOMAIN,
      status: "ok",
      candidates: [
        {
          title: "보보쇼즈 미스터리 BC 하프집 스웨트셔츠",
          url: `https://${SHOP_DOMAIN}/product/b226ac043`,
          price: { amount: 129000, currency: "KRW" },
          imageUrl: null,
          confidence: 0.97,
          matchLevel: "very_high",
          matchReasons: ["브랜드 일치"],
        },
      ],
    },
  ]);
});

describe("DOMESTIC-PRICE-TRIGGER-1 경계 ①: 화면 조회 경로는 여전히 아무것도 저장하지 않는다", () => {
  it("검색 라우트는 후보를 그대로 돌려줄 뿐 링크/관측을 한 건도 쓰지 않는다", async () => {
    const { POST } = await import("../../../domestic-price-sources/search/route");
    const res = await POST(
      new Request("http://localhost/api/domestic-price-sources/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Mystery BC Half Zipped Sweatshirt", brand: "Bobo Choses", sku: "B226AC043" }),
      }),
    );
    const body = (await res.json()) as { ok: boolean; results: Array<{ candidates: unknown[] }> };

    expect(body.ok).toBe(true);
    expect(body.results[0].candidates).toHaveLength(1);
    expect(hoisted.upsertDomesticProductLink).not.toHaveBeenCalled();
    expect(hoisted.recordPriceObservations).not.toHaveBeenCalled();
    // 이 테스트가 오래 걸리는 이유는 단언이 아니라 위 동적 import다 — 라우트
    // 하나를 부르려고 그 모듈 그래프 전체를 변환한다(단독 실행 ~1.6초). 화면
    // 조립 테스트(product-tab-*)가 들어오면서 워커가 붐비자 기본 5초를 간헐적
    // 으로 넘겼다. 검사하는 내용은 한 글자도 바꾸지 않고, 변환에 쓸 시간만
    // 넉넉히 준다.
  }, 30_000);

  it("검색 라우트 소스에 쓰기 함수 이름이 아예 등장하지 않는다", () => {
    const source = readFileSync(
      path.join(ADMIN_ROOT, "src/app/api/domestic-price-sources/search/route.ts"),
      "utf8",
    );
    for (const writer of ["upsertDomesticProductLink", "recordPriceObservations", "recordDomesticSourceCheckAttempt"]) {
      expect(source).not.toContain(writer);
    }
  });
});

describe("DOMESTIC-PRICE-TRIGGER-1 경계 ②: 일 1회 배치를 되살리지 않았다", () => {
  it("vercel.json에 crons 설정이 없다", () => {
    for (const candidate of [path.join(REPO_ROOT, "vercel.json"), path.join(ADMIN_ROOT, "vercel.json")]) {
      if (!existsSync(candidate)) continue;
      const config = JSON.parse(readFileSync(candidate, "utf8")) as Record<string, unknown>;
      expect(config.crons).toBeUndefined();
    }
  });

  it("cron 라우트 디렉터리가 없다", () => {
    expect(existsSync(path.join(ADMIN_ROOT, "src/app/api/cron"))).toBe(false);
  });

  it("listAllSnapshotsForBatch(workspace 경계를 넘던 유일한 읽기 경로)가 존재하지 않는다", async () => {
    const snapshotModule = await import("../../../snapshots/_lib/snapshot");
    expect("listAllSnapshotsForBatch" in snapshotModule).toBe(false);

    // 제거 사실을 설명하는 주석은 남아 있어야 한다(왜 없는지를 코드가 기억한다).
    // 그래서 "이름이 소스에 없다"가 아니라 "선언으로 되살아나지 않았다"를 본다.
    const source = readFileSync(path.join(ADMIN_ROOT, "src/app/api/snapshots/_lib/snapshot.ts"), "utf8");
    expect(source).not.toMatch(/export\s+(async\s+)?function\s+listAllSnapshotsForBatch/);
  });

  it("트리거는 스냅샷 하나만 받는다 — 기존 스냅샷을 훑는 호출이 없다", () => {
    const source = readFileSync(path.join(ADMIN_ROOT, "src/app/api/price-history/_lib/trigger-domestic-price-check.ts"), "utf8");
    // 주석에는 "왜 배치를 안 되살리는가"를 설명하느라 이름이 등장한다 —
    // 문자열이 아니라 **호출/임포트**가 없다는 것을 본다.
    for (const batchy of ["listAllSnapshotsForBatch", "listRecentSnapshotsFull", "listRecentSnapshots"]) {
      expect(source).not.toMatch(new RegExp(`${batchy}\\s*\\(`));
      expect(source).not.toMatch(new RegExp(`import[^;]*${batchy}`));
    }
  });
});
