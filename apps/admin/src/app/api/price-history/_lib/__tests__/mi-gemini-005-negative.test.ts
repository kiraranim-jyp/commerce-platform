import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ProductIdentityDna } from "@commerce/shared";
import {
  collectGeminiCandidatePool,
  isGeminiDiscoveryEnabled,
  normalizeCandidateUrl,
  GEMINI_DISCOVERY_FLAG,
  GEMINI_VIRTUAL_SHOP_ID,
} from "../gemini-candidate-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-INTEGRATION-005 ⑦ — Negative Test 4종 + OFF/저장차단 가드
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 헌장 §5 — 「정상 케이스 PASS」는 테스트가 아니다. 여기서 보는 것은
 *    **실패가 운영 경로를 깨뜨리지 않는가** 하나다.
 *
 * 지시서 ⑦ 이 요구한 넷:
 *   ① CONFIG_MISSING (키 없음)   ② API_FAILURE (4xx/5xx·네트워크)
 *   ③ timeout                     ④ 후보 0건
 *
 * 🔴🔴 **①과 ④를 같은 칸에 담지 않는다.** 「키가 없다」와 「못 찾았다」가 구분되지
 *    않으면 측정이 거짓말을 한다 — 이 트랙에서 그 혼동으로 거짓 결론이 두 번 났다.
 *    그래서 네 경우 전부 `metrics.outcomes` 가 **서로 다른 값** 임을 본다.
 *
 * 🔴 실제 네트워크를 쓰지 않는다 — `fetch` 를 stub 한다(ENDPOINT 는 Gemini 다).
 *    🟢 그래서 이 파일은 LIVE 플래그 없이 전체 회귀에서 매번 돈다.
 */

/** 🔴 칸 이름을 추측하지 않는다 — `ProductIdentityDna`(product-identity-dna.ts:50)
 *     의 **전 칸을** 채운다. 이 트랙에서 칸 이름을 추측해 틀린 것이 다섯 번이다. */
const DNA: ProductIdentityDna = {
  sourceUrl: "https://example-brand.com/products/test-tunic",
  brand: { value: "Bonjour", confident: true },
  identifier: null,
  title: "Tunique With Hair Clip | Blue",
  coreTitleTokens: ["tunique", "hair", "clip"],
  color: "Blue",
  category: null,
  representativeImageUrl: null,
  brandModelCode: null,
  material: "cotton 100%",
  fit: null,
  ageRange: "4 years",
  sizeRange: ["4Y"],
  audienceSignals: ["kids"],
  urlSlug: "test-tunic",
  imageUrls: [],
};

const POOL_INPUT = {
  dna: DNA,
  scopedDomains: ["foretforet.com"] as readonly string[],
  /** 🔴 DB 의 실제 scope 어휘다 — `KIDS_CLOTHING` 은 **없는 값** 이고, 그것을
   *     추측해 써서 E2E 1차 측정을 무효로 만들었다. 테스트에도 같은 값을 쓴다. */
  categoryScopes: ["KIDS_FASHION"],
  maxCandidates: 3,
  targetUsable: 3,
  maxQueries: 2,
  existingNormalizedUrls: new Set<string>(),
};

const KEY_ENV = "GEMINI_API_KEY";
let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env[KEY_ENV];
});

afterEach(() => {
  if (savedKey === undefined) delete process.env[KEY_ENV];
  else process.env[KEY_ENV] = savedKey;
  vi.unstubAllGlobals();
});

describe("MI-GEMINI-005 ⑦ — Gemini 실패가 운영 경로를 깨뜨리지 않는다", () => {
  it("① CONFIG_MISSING — 키가 없으면 CONFIG_MISSING 이고, 🔴 토큰은 0 이 아니라 «미집계» 다", async () => {
    delete process.env[KEY_ENV];

    const result = await collectGeminiCandidatePool(POOL_INPUT);

    expect(result.searchResults).toEqual([]);
    expect(result.metrics.outcomes.CONFIG_MISSING).toBeGreaterThan(0);
    expect(result.metrics.outcomes.OK).toBeUndefined();
    expect(result.metrics.outcomes.API_FAILURE).toBeUndefined();
    /** 🔴 호출 자체를 안 했으니 Gemini 호출 수는 0 이고 model 은 null 이다.
     *     「0 토큰으로 불렀다」와 「안 불렀다」를 가르는 자리다. */
    expect(result.metrics.geminiCalls).toBe(0);
    expect(result.metrics.model).toBeNull();
    expect(result.metrics.totalTokens).toBe(0);
    /** 🔴 §10 — grounding 쿼리 수는 구조적으로 측정 불가다. 0 으로 적지 않는다. */
    expect(result.metrics.groundingQueries).toBeNull();
  });

  it("② API_FAILURE — Gemini 가 500 을 주면 throw 하지 않고 API_FAILURE 로 돌려준다", async () => {
    process.env[KEY_ENV] = "test-key-not-real";
    const fetchMock = vi.fn(async () => new Response("boom", { status: 500, statusText: "Internal" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectGeminiCandidatePool(POOL_INPUT);

    expect(result.searchResults).toEqual([]);
    expect(result.metrics.outcomes.API_FAILURE).toBeGreaterThan(0);
    expect(result.metrics.outcomes.CONFIG_MISSING).toBeUndefined();
    /** 🟢 실제로 Gemini 를 불렀다는 증거 — ① 과 구분된다. */
    expect(fetchMock).toHaveBeenCalled();
    /** 🔴 후보를 하나도 만들지 않았으므로 resolve/fetch 비용이 발생하지 않았다. */
    expect(result.metrics.resolveCalls).toBe(0);
    expect(result.metrics.miEligibleCandidates).toBe(0);
  });

  it("③ timeout — AbortError 도 CONFIG_MISSING 이 아니라 API_FAILURE 다", async () => {
    process.env[KEY_ENV] = "test-key-not-real";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const err = new Error("The operation was aborted due to timeout");
        err.name = "TimeoutError";
        throw err;
      }),
    );

    const result = await collectGeminiCandidatePool(POOL_INPUT);

    expect(result.searchResults).toEqual([]);
    expect(result.metrics.outcomes.API_FAILURE).toBeGreaterThan(0);
    /** 🔴 timeout 을 「설정 문제」로 집계하면 운영에서 키를 다시 넣게 만든다. */
    expect(result.metrics.outcomes.CONFIG_MISSING).toBeUndefined();
  });

  it("④ 후보 0건 — 🔴 OK 이면서 0 이다. 실패와 «같은 칸에 담지 않는다»", async () => {
    process.env[KEY_ENV] = "test-key-not-real";
    /** 🟢 실제 응답 모양 그대로: groundingChunks 가 빈 배열이면 URL 0 이다
     *     (extractGroundingUrls — google-discovery.ts). */
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [{ groundingMetadata: { groundingChunks: [] } }],
              usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 5, totalTokenCount: 125 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const result = await collectGeminiCandidatePool(POOL_INPUT);

    expect(result.searchResults).toEqual([]);
    /** 🔴 여기가 핵심 — outcome 은 **OK** 다. 「실패」가 아니다. */
    expect(result.metrics.outcomes.OK).toBeGreaterThan(0);
    expect(result.metrics.outcomes.API_FAILURE).toBeUndefined();
    expect(result.metrics.outcomes.CONFIG_MISSING).toBeUndefined();
    expect(result.metrics.discoveredUrls).toBe(0);
    expect(result.metrics.miEligibleCandidates).toBe(0);
    /** 🟢 그런데 비용은 «발생했다» — 0건이 무료가 아니라는 것을 숫자로 남긴다. */
    expect(result.metrics.geminiCalls).toBeGreaterThan(0);
    expect(result.metrics.totalTokens).toBeGreaterThan(0);
  });

  it("🔴 ⑧ 조기 종료 — 후보가 안 모이면 maxQueries 상한까지만 쓰고 멈춘다(무한 호출 금지)", async () => {
    process.env[KEY_ENV] = "test-key-not-real";
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ candidates: [{ groundingMetadata: { groundingChunks: [] } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectGeminiCandidatePool({ ...POOL_INPUT, maxQueries: 2 });

    expect(result.metrics.queriesUsed).toBeLessThanOrEqual(2);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe("MI-GEMINI-005 ① — flag 는 기본 OFF 다", () => {
  it("환경변수가 없으면 OFF · 'true' 가 아닌 아무 값도 OFF 다", () => {
    const saved = process.env[GEMINI_DISCOVERY_FLAG];
    try {
      delete process.env[GEMINI_DISCOVERY_FLAG];
      expect(isGeminiDiscoveryEnabled()).toBe(false);
      /** 🔴 "1"·"yes"·"TRUE" 로 켜지지 않는다 — 실수로 켜지는 경로를 만들지 않는다. */
      for (const v of ["1", "yes", "TRUE", "on", ""]) {
        process.env[GEMINI_DISCOVERY_FLAG] = v;
        expect(isGeminiDiscoveryEnabled()).toBe(false);
      }
      process.env[GEMINI_DISCOVERY_FLAG] = "true";
      expect(isGeminiDiscoveryEnabled()).toBe(true);
    } finally {
      if (saved === undefined) delete process.env[GEMINI_DISCOVERY_FLAG];
      else process.env[GEMINI_DISCOVERY_FLAG] = saved;
    }
  });
});

describe("MI-GEMINI-005 ③ — 정규화 URL dedupe", () => {
  it("www·트레일링 슬래시·쿼리·해시·대소문자를 같은 키로 모은다", () => {
    const base = normalizeCandidateUrl("https://dinossi.us/products/holly-trouser");
    expect(normalizeCandidateUrl("https://www.Dinossi.us/products/holly-trouser/")).toBe(base);
    expect(normalizeCandidateUrl("https://dinossi.us/products/holly-trouser?variant=42#desc")).toBe(base);
    /** 🔴 경로가 다르면 **다른 후보** 다 — 과도한 병합은 실제 후보를 지운다. */
    expect(normalizeCandidateUrl("https://dinossi.us/products/holly-shirt")).not.toBe(base);
  });

  it("🔴 이미 국내 경로가 낸 URL 은 Gemini 후보에서 제외된다(중복 판정 금지)", async () => {
    process.env[KEY_ENV] = "test-key-not-real";
    const dupe = "https://foretforet.com/product/abc";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                { groundingMetadata: { groundingChunks: [{ web: { uri: `${dupe}/`, title: "dup" } }] } },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const result = await collectGeminiCandidatePool({
      ...POOL_INPUT,
      existingNormalizedUrls: new Set([normalizeCandidateUrl(dupe)]),
    });

    /** 🟢 발견은 했지만 resolve 로 넘기지 않았다 — fetch 비용이 발생하지 않는다. */
    expect(result.metrics.discoveredUrls).toBeGreaterThan(0);
    expect(result.metrics.resolveCalls).toBe(0);
    expect(result.searchResults).toEqual([]);
  });
});

describe("MI-GEMINI-005 ⑤ — 가상 샵은 «저장되지 않는다»", () => {
  /** 🔴 헌장 §5 — 소스 문자열 검사는 **주석을 벗기고** 한다(여덟 번 걸린 함정). */
  const RUNNER = path.join(__dirname, "..", "run-domestic-price-check.ts");
  const stripped = readFileSync(RUNNER, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("upsertDomesticProductLink «앞» 에서 가상 샵이 걸러진다", () => {
    const idx = stripped.indexOf("const upsertResult = await upsertDomesticProductLink(");
    expect(idx).toBeGreaterThan(-1);
    const guard = stripped.lastIndexOf(`result.shopId === GEMINI_VIRTUAL_SHOP_ID`, idx);
    expect(guard).toBeGreaterThan(-1);
    /** 🔴 가드가 upsert «뒤» 에 있으면 이미 저장된 뒤다 — 순서를 본다. */
    expect(guard).toBeLessThan(idx);
    expect(stripped.slice(guard, idx)).toContain("continue");
  });

  it("recordDomesticSourceCheckAttempt 를 가상 샵 id 로 부르는 곳이 «없다»", () => {
    /** 🟢 원 함수 호출은 래퍼 한 곳으로 모였다 — import 1 + 래퍼 1 = 2 회 언급. */
    const direct = stripped.match(/void recordDomesticSourceCheckAttempt\(result\.shopId/g) ?? [];
    expect(direct).toEqual([]);
    expect(stripped).toContain("recordCheckAttempt(result.shopId");
    /** 🔴 래퍼가 실제로 가드를 갖고 있는가 — 이름만 바꾼 것이 아님을 본다. */
    const wrapper = stripped.slice(stripped.indexOf("const recordCheckAttempt"));
    expect(wrapper.slice(0, 400)).toContain("GEMINI_VIRTUAL_SHOP_ID");
  });

  it("가상 샵 id 는 등록부 id 모양(uuid)이 아니다 — FK 로 들어갈 수 없는 값이다", () => {
    expect(GEMINI_VIRTUAL_SHOP_ID).toBe("__gemini_discovery__");
    expect(GEMINI_VIRTUAL_SHOP_ID).not.toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("🔴 Gemini 후보 URL 을 DB 에 쓰는 코드가 모듈에 «없다»", () => {
    const pool = readFileSync(path.join(__dirname, "..", "gemini-candidate-pool.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const forbidden of ["supabase", "prisma", "insert(", "upsert", "INSERT", "from(\""]) {
      expect(pool).not.toContain(forbidden);
    }
  });
});
