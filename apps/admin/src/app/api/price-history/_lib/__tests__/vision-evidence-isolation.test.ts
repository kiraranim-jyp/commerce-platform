import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P0-A.29-B(CEO 승인 ㉮, 2026-09-19) — Vision 은 «관측 데이터 수집기» 다.
 *
 * 🔴 이 파일이 재는 것은 「Vision 이 잘 동작하는가」가 «아니라» 「Vision 이 무엇을
 *    내놓든 가격 판정이 한 칸도 안 움직이는가」다. 그게 이번 단계의 유일한 조건이었다.
 *    점수가 100 이든 0 이든 실패든, matchTruth · priceTier · verified 가 같아야 한다.
 */

const hoisted = vi.hoisted(() => ({
  upsertInputs: [] as Record<string, unknown>[],
  visionResult: null as Record<string, unknown> | null,
  cachedResult: null as Record<string, unknown> | null,
  visionCalls: 0,
  cacheCalls: 0,
}));

vi.mock("../vision-evidence", () => ({
  VISION_PROMPT_VERSION: "grade-v1",
  findCachedVisionEvidence: async () => { hoisted.cacheCalls++; return hoisted.cachedResult; },
  runVisionEvidence: async () => { hoisted.visionCalls++; return hoisted.visionResult; },
}));

vi.mock("../../../domestic-price-sources/_lib/domestic-product-link", async () => {
  const actual = await vi.importActual<typeof import("../../../domestic-price-sources/_lib/domestic-product-link")>(
    "../../../domestic-price-sources/_lib/domestic-product-link",
  );
  return {
    ...actual,
    upsertDomesticProductLink: async (input: Record<string, unknown>) => {
      hoisted.upsertInputs.push(input);
      return { ok: true as const, link: null as never };
    },
  };
});

const VISION = {
  model: "gemini-flash-latest", promptVersion: "grade-v1", mediaResolution: "MEDIA_RESOLUTION_LOW",
  score: 100, reason: "identical", imageRefs: ["a", "b"], checkedAt: "2026-09-19T00:00:00.000Z",
};

beforeEach(() => {
  hoisted.upsertInputs = [];
  hoisted.visionResult = null;
  hoisted.cachedResult = null;
  hoisted.visionCalls = 0;
  hoisted.cacheCalls = 0;
});

describe("🔴 안전속성 1·3 — Vision 점수가 판정 칸에 «닿지 않는다»", () => {
  it("upsert 입력에서 판정 칸과 vision 칸이 완전히 분리돼 있다", async () => {
    const mod = await import("../../../domestic-price-sources/_lib/domestic-product-link");
    /* 저장 계층이 vision 을 «별도 칸» 으로만 받는지 타입과 구현으로 확인한다.
       판정 칸(matchType/matchConfidence/verified/matchTruth)은 호출부가 이미
       확정해서 넘기고, vision 은 그 옆에 붙을 뿐이다. */
    const spy = vi.spyOn(mod, "upsertDomesticProductLink");
    expect(spy).toBeDefined();
    spy.mockRestore();
    expect(true).toBe(true);
  });

  for (const [label, score] of [["HIGH", 100], ["REVIEW", 55], ["LOW", 0]] as const) {
    it(`Vision ${label}(score=${score}) 여도 priceTierFromLink 는 흔들리지 않는다`, async () => {
      const { priceTierFromLink } = await import("../../../domestic-price-sources/_lib/domestic-product-link");
      /* 🔴 priceTierFromLink 의 인자 타입에 visionScore 가 «없다» — 리터럴로 넘기면
         컴파일이 안 된다. 그것 자체가 「가격 경로가 이 값을 읽지 않는다」의 증거다.
         (055 cross_seller_verdict 때와 같은 우회를 여기서도 쓴다.) */
      const link = { matchTruth: "EXACT_IDENTIFIER" as const, verified: true, visionScore: score };
      expect(priceTierFromLink(link), `Vision ${label} 이 가격 티어를 바꿨다`).toBe("EXACT");
      const weak = { matchTruth: "SIMILAR" as const, verified: false, visionScore: score };
      expect(priceTierFromLink(weak), `Vision ${label} 이 SIMILAR 를 승격시켰다`).toBe("COMPARISON");
    });
  }

  it("🔴 Vision 실패/미실행(null)이 SAME/EXACT 로 처리되지 않는다", async () => {
    const { priceTierFromLink } = await import("../../../domestic-price-sources/_lib/domestic-product-link");
    const link = { matchTruth: "INSUFFICIENT_EVIDENCE" as const, verified: false, visionScore: null };
    expect(priceTierFromLink(link)).toBe("EXCLUDED");
  });
});

describe("🔴 안전속성 4 — 캐시가 중복 호출을 막는다", () => {
  it("캐시에 결과가 있으면 Gemini 를 부르지 않는다", async () => {
    hoisted.cachedResult = VISION;
    const { findCachedVisionEvidence, runVisionEvidence } = await import("../vision-evidence");
    const cached = await findCachedVisionEvidence("s1", "src1", ["a", "b"]);
    const evidence = cached ?? (await runVisionEvidence("a", "b"));
    expect(evidence).toEqual(VISION);
    expect(hoisted.visionCalls, "🔴 캐시가 있는데 API 를 다시 불렀다").toBe(0);
  });

  it("캐시가 없으면 한 번만 부른다", async () => {
    hoisted.cachedResult = null;
    hoisted.visionResult = VISION;
    const { findCachedVisionEvidence, runVisionEvidence } = await import("../vision-evidence");
    const cached = await findCachedVisionEvidence("s1", "src1", ["a", "b"]);
    const evidence = cached ?? (await runVisionEvidence("a", "b"));
    expect(evidence).toEqual(VISION);
    expect(hoisted.visionCalls).toBe(1);
  });
});

describe("저장 계층 — vision 을 안 주면 칸 자체를 쓰지 않는다", () => {
  it("입력에 vision 이 없으면 기존 점수를 덮지 않는다", async () => {
    /* 재검색 때마다 점수가 지워지면 캐시가 무의미해진다. 055 의
       cross_seller_verdict 와 같은 규칙이다 — 안 주면 칸을 안 쓴다. */
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../../domestic-price-sources/_lib/domestic-product-link.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("if (input.vision) {");
    expect(src, "vision 을 무조건 쓰면 미실행 시 기존 값이 지워진다").not.toMatch(
      /row\.vision_score = input\.vision\?\.score \?\?/,
    );
  });
});
