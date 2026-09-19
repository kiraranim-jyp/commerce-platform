import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P0-A.8 MATCHING MEASUREMENT ONLY(CEO 승인, 2026-09-18).
 *
 * 🔴 이 테스트가 지키는 것은 «값이 저장된다»가 아니다. CEO가 명시한 금지 조건들이
 *    실제로 코드에서 지켜지는가다:
 *      · 기존 데이터 소급/추정 금지      → 호출부가 안 주면 칸 자체를 안 쓴다
 *      · UNKNOWN 강제 변환 금지          → undefined 를 "UNKNOWN"으로 메우지 않는다
 *      · 가격 경로 변경 금지             → priceTierFromLink 가 이 값을 읽지 않는다
 *      · 판정 로직 변경 금지             → 저장 계층이 verdict 로 무엇도 재계산하지 않는다
 */

const hoisted = vi.hoisted(() => ({
  upsertRows: [] as Record<string, unknown>[],
  /** 컬럼이 없는 환경(마이그레이션 055 미실행)을 흉내낸다. */
  rejectCrossSellerColumn: false,
  existing: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: hoisted.existing, error: null }) }),
          maybeSingle: async () => ({ data: hoisted.existing, error: null }),
        }),
      }),
      upsert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            hoisted.upsertRows.push({ ...row });
            if (hoisted.rejectCrossSellerColumn && "cross_seller_verdict" in row) {
              return { data: null, error: { message: `column "cross_seller_verdict" does not exist` } };
            }
            return { data: { ...row, id: "l1", created_at: "t", updated_at: "t" }, error: null };
          },
        }),
      }),
    }),
  }),
}));

const load = () => import("../domestic-product-link");

const base = {
  snapshotId: "s1",
  sourceId: "src1",
  externalUrl: "https://example.com/p",
  matchType: "EXACT" as const,
  matchConfidence: 0.99,
  matchReasons: ["모델명 유사도 100%"],
  matchTruth: "EXACT_IDENTIFIER" as const,
  verified: true,
};

beforeEach(() => {
  hoisted.upsertRows = [];
  hoisted.rejectCrossSellerColumn = false;
  hoisted.existing = null;
});

describe("🔴 실제 근거가 있을 때만 기록한다", () => {
  it("호출부가 판정을 주면 그 값이 그대로 저장된다", async () => {
    const { upsertDomesticProductLink } = await load();
    const res = await upsertDomesticProductLink({ ...base, crossSellerVerdict: "PRESUMED_SAME" });
    expect(res.ok).toBe(true);
    expect(hoisted.upsertRows[0].cross_seller_verdict).toBe("PRESUMED_SAME");
  });

  it("🔴 호출부가 안 주면 «칸 자체를» 쓰지 않는다 — 소급/추정 금지", async () => {
    const { upsertDomesticProductLink } = await load();
    await upsertDomesticProductLink(base);
    expect(
      "cross_seller_verdict" in hoisted.upsertRows[0],
      "판정을 받지 않았는데 컬럼에 무언가를 적었다",
    ).toBe(false);
  });

  it("🔴 undefined 를 «UNKNOWN» 으로 메우지 않는다", async () => {
    const { upsertDomesticProductLink } = await load();
    await upsertDomesticProductLink({ ...base, crossSellerVerdict: undefined });
    expect(hoisted.upsertRows[0].cross_seller_verdict).toBeUndefined();
  });

  it("판정기가 «실제로» UNKNOWN 을 냈으면 그건 기록한다 — null 과 다른 사실이다", async () => {
    const { upsertDomesticProductLink } = await load();
    await upsertDomesticProductLink({ ...base, crossSellerVerdict: "UNKNOWN" });
    expect(hoisted.upsertRows[0].cross_seller_verdict).toBe("UNKNOWN");
  });

  it("다섯 값이 모두 왕복한다", async () => {
    const { upsertDomesticProductLink } = await load();
    for (const v of ["SAME", "PRESUMED_SAME", "SIMILAR", "UNKNOWN", "CONFLICT"] as const) {
      hoisted.upsertRows = [];
      const res = await upsertDomesticProductLink({ ...base, crossSellerVerdict: v });
      expect(res.ok && res.link.crossSellerVerdict).toBe(v);
    }
  });
});

describe("🔴 측정 칸 때문에 «가격 공급 경로»가 끊기지 않는다", () => {
  it("055 미실행 환경에서도 링크 저장은 성공한다 (그 칸만 빼고 재시도)", async () => {
    hoisted.rejectCrossSellerColumn = true;
    const { upsertDomesticProductLink } = await load();
    const res = await upsertDomesticProductLink({ ...base, crossSellerVerdict: "SAME" });
    expect(res.ok, "컬럼이 없다고 링크 저장 전체가 실패했다").toBe(true);
    expect(hoisted.upsertRows).toHaveLength(2);
    expect("cross_seller_verdict" in hoisted.upsertRows[1]).toBe(false);
    // 나머지 칸은 한 글자도 안 바뀐다.
    expect(hoisted.upsertRows[1].match_truth).toBe("EXACT_IDENTIFIER");
    expect(hoisted.upsertRows[1].verified).toBe(true);
  });
});

describe("🔴 가격 경로는 이 값을 읽지 않는다", () => {
  it("priceTierFromLink 는 verdict 가 무엇이든 match_truth 만 본다", async () => {
    const { priceTierFromLink } = await load();
    /* 🔴 priceTierFromLink 의 인자 타입은 Pick<DomesticProductLink,"matchTruth"|"verified"> 다 —
       crossSellerVerdict 를 객체 리터럴로 직접 넘기면 «컴파일이 안 된다». 그것 자체가
       「가격 경로가 이 값을 읽지 않는다」의 가장 강한 증거이고, 그래서 여기서는
       변수를 거쳐 런타임에 실어 보낸다(초과 속성 검사는 리터럴에만 걸린다).
       이 우회가 필요 없어지는 날 = 누군가 이 값을 가격 판정에 넣은 날이다. */
    for (const v of ["SAME", "PRESUMED_SAME", "SIMILAR", "UNKNOWN", "CONFLICT", null] as const) {
      const link = { matchTruth: "EXACT_IDENTIFIER" as const, verified: true, crossSellerVerdict: v };
      expect(priceTierFromLink(link), `verdict=${v} 에서 가격 티어가 흔들렸다`).toBe("EXACT");
    }
    // CONFLICT verdict 라도 matchTruth 가 SIMILAR 면 COMPARISON 그대로다.
    const conflicting = { matchTruth: "SIMILAR" as const, verified: true, crossSellerVerdict: "CONFLICT" };
    expect(priceTierFromLink(conflicting)).toBe("COMPARISON");
  });

  it("레거시 행(verdict 없음)의 티어가 기존과 같다 — 회귀", async () => {
    const { priceTierFromLink } = await load();
    expect(priceTierFromLink({ matchTruth: null, verified: true })).toBe("EXACT");
    expect(priceTierFromLink({ matchTruth: null, verified: false })).toBe("COMPARISON");
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: true })).toBe("EXCLUDED");
  });
});
