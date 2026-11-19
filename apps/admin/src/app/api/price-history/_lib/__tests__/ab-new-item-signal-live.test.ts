/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **신상품 신호 A/B — 기존 Apify 경로 재사용**(기본 SKIP · 운영 상수 불변)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 **새 인프라 0** — 기존 생산자 `collectWebSearchUrls` 와 기존 측정 훅
 *    `buildCompositeDiscoveryQuery(identity, { signal })` 를 그대로 쓴다.
 *
 * 🔴🔴 **기본은 실행하지 않는다.** 두 조건이 **동시에** 갖춰져야 돈다 —
 *    `AB_SIGNAL_PROBE=1` **그리고** `APIFY_API_TOKEN` 존재. 그러지 않으면 **SKIP** 이다
 *    (리포 선례 `MI_P0_02_LIVE=1` · `CASE_01_PROBE=1` 과 같은 규약).
 *
 * 🔴🔴🔴 **토큰을 대화로 받지 않는다**(헌장 §10 절대 금지). 실행 방법은 하나다 —
 *    **CEO 가 자기 머신의 `scripts/.env` 에 `APIFY_API_TOKEN=` 을 직접 적고**,
 *    A/B 직후 **그 줄을 지우고 Apify 콘솔에서 그 토큰을 폐기** 한다.
 *    🔴 이 하니스는 **값을 출력하지 않는다**(존재 여부만 본다 · 계약 L-3).
 *
 * 🔴 운영 `SELLER_SIGNAL` **변경 0** · 질의 사본 **0** · 상태 축 **0** ·
 *    SAME/가격/약관/어댑터/DB **전부 0**.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import type { ProductIdentity } from "@commerce/crawler/src/discovery-core/types";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const PLANNER = path.join(ROOT, "packages", "crawler", "src", "discovery-core", "query-planner.ts");
const OUT = path.join(HERE, "preserved", "ab-new-item-signal-live.json");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

const SIGNAL_A = "국내해외 동일상품 판매처";
const SIGNAL_B = "국내해외 동일상품 새상품 판매처";
const ROUNDS = 2;

/** 🔴 **실행 게이트 — 둘 다** 필요하다. */
const ARMED = process.env.AB_SIGNAL_PROBE === "1" && Boolean(process.env.APIFY_API_TOKEN);

const val = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object" && "value" in v) {
    const i = (v as { value?: unknown }).value;
    return typeof i === "string" ? i.trim() || null : null;
  }
  return null;
};

/**
 * 🔴🔴 **분모를 지어내지 않는다.** CPO 가 요청한 「기존 10개 상품」 목록은 **자산에서
 *    복원되지 않는다**(그 A/B 산출물이 리포에 없다). 🟢 원상품 identity 를 **완전히**
 *    만들 수 있는 것은 `wu-059-gt-facts.json` 의 **6개** 다 ⟹ 그 6으로 돌리고
 *    **분모를 6 으로 적는다**. 🔴 10 으로 늘리려면 **CPO 가 상품 목록을 지정** 해야 한다.
 */
const identities = (): { id: string; identity: ProductIdentity }[] => {
  const gt = read(path.join(HERE, "fixtures", "wu-059-gt-facts.json")) as {
    origins: Record<string, { canonicalProduct: Record<string, unknown> }>;
  };
  return Object.entries(gt.origins).map(([id, o]) => {
    const cp = o.canonicalProduct;
    return {
      id,
      identity: {
        brand: val(cp.brand),
        productName: val(cp.title),
        productType: null,
        genderAge: null,
        color: val(cp.color),
        size: null,
        season: null,
        productCode: val(cp.sku),
        sourceUrl: val(cp.sourceUrl) ?? "",
        sourceSite: null,
        sourceCountry: null,
        market: null,
        facts: [val(cp.material)].filter((x): x is string => Boolean(x)),
      },
    };
  });
};

/** 🔴 **휴리스틱임을 이름에 적는다** — 운영 시장 분류기(`classifyCandidateMarket`)가 아니다. */
const krTldHost = (u: string): boolean => {
  try {
    return new URL(u).hostname.toLowerCase().endsWith(".kr");
  } catch {
    return false;
  }
};
const USED_IN_URL = /used|중고|refurb|리퍼|vintage|secondhand|pre-?owned/i;

describe("A/B 준비 계약(네트워크 0 · 항상 실행)", () => {
  it("L-1 🔴 실행 게이트가 **둘 다** 요구된다(기본 SKIP)", () => {
    const self = readFileSync(path.join(HERE, "ab-new-item-signal-live.test.ts"), "utf8");
    expect(self).toContain('process.env.AB_SIGNAL_PROBE === "1"');
    expect(self).toContain("Boolean(process.env.APIFY_API_TOKEN)");
    /** 🟢 둘을 **AND** 로 묶는다 — 하나만으로는 돌지 않는다. */
    expect(self).toMatch(/AB_SIGNAL_PROBE === "1" && Boolean\(process\.env\.APIFY_API_TOKEN\)/);
  });

  it("L-2 🔴 운영 `SELLER_SIGNAL` 을 **바꾸지 않았다** · 차이는 한 토큰이다", () => {
    expect(readFileSync(PLANNER, "utf8")).toContain(`const SELLER_SIGNAL = "${SIGNAL_A}"`);
    expect(SIGNAL_B.replace(" 새상품", "")).toBe(SIGNAL_A);
    expect(SIGNAL_B.split(/\s+/).length - SIGNAL_A.split(/\s+/).length).toBe(1);
  });

  it("L-3 🔴🔴 토큰 **값을 쓰지 않는다**(존재 여부만 · 산출물에 비밀 0)", () => {
    const bare = readFileSync(path.join(HERE, "ab-new-item-signal-live.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    /**
     * 🔴 토큰을 **읽어서 넘기지 않는다** — 생산자가 `process.env` 에서 직접 집는다.
     * 🔴🔴 금지 토큰을 **런타임에 조립** 한다 — 리터럴로 적으면 **내 금지 목록이 내 파일을
     *    잡는다**(자기참조 · 이 트랙 7번째 · 1차에서 실제로 FAIL 했다).
     */
    const passKey = `${"tok"}en:`;
    expect(bare, "🔴 토큰을 변수로 옮기면 로그·산출물로 흘러나갈 길이 생긴다").not.toContain(passKey);
    expect(bare).toContain("Boolean(process.env.APIFY_API_TOKEN)");
  });

  it("L-4 🔴 분모를 **지어내지 않았다**(요청 10 ↔ 가용 6)", () => {
    const ids = identities();
    expect(ids.length, "🔴 10 으로 늘리려면 CPO 가 상품 목록을 지정해야 한다").toBe(6);
    expect(ids.every((x) => x.identity.sourceUrl.length > 0)).toBe(true);
  });
});

/* ═══════════ 실행 — 🔴 ARMED 일 때만 ═══════════ */

describe.skipIf(!ARMED)("A/B 실측(기존 Apify 경로 · 유료 호출)", () => {
  it(
    "L-5 🔵 6상품 × 2조건 × 2회 — 지표를 상품별로 기록한다",
    async () => {
      const { collectWebSearchUrls } = await import("../web-search-pool");
      type Run = {
        id: string;
        condition: "A" | "B";
        round: number;
        query: string | null;
        urls: number;
        krTldUrls: number;
        hosts: number;
        productPageUrls: number;
        usedLikeUrls: number;
        organic: number | null;
        failed: boolean | null;
        errorStatus: number | null;
        urlList: string[];
      };
      const runs: Run[] = [];

      for (let round = 1; round <= ROUNDS; round += 1) {
        for (const { id, identity } of identities()) {
          /** 🔴 **순서 편향 최소화** — 라운드마다 A/B 순서를 바꾼다. */
          const order: ("A" | "B")[] = round % 2 === 1 ? ["A", "B"] : ["B", "A"];
          for (const condition of order) {
            /** 🟢 `signal` 만 갈아 끼운다 — 다른 입력은 **동일** 하다. */
            const pool = await collectWebSearchUrls({
              identity,
              ...(condition === "B" ? { signal: SIGNAL_B } : {}),
            });
            const urls = pool.urls ?? [];
            const m = pool.metrics ?? {};
            runs.push({
              id,
              condition,
              round,
              query: (m as { query?: string | null }).query ?? null,
              urls: urls.length,
              krTldUrls: urls.filter(krTldHost).length,
              hosts: new Set(urls.map((u) => { try { return new URL(u).hostname; } catch { return u; } })).size,
              productPageUrls: urls.filter((u) => classifyUrlShape(u) === "PRODUCT_PAGE").length,
              usedLikeUrls: urls.filter((u) => USED_IN_URL.test(u)).length,
              organic: (m as { organic?: number | null }).organic ?? null,
              failed: (m as { failed?: boolean | null }).failed ?? null,
              errorStatus: (m as { errorStatus?: number | null }).errorStatus ?? null,
              urlList: urls,
            });
          }
        }
      }

      const side = (c: "A" | "B") => runs.filter((r) => r.condition === c);
      const sum = (rs: Run[], k: "urls" | "krTldUrls" | "productPageUrls" | "usedLikeUrls") =>
        rs.reduce((a, r) => a + r[k], 0);
      /** 🔴 **반복 간 중복률** — 같은 (상품, 조건) 의 두 라운드 URL 교집합. */
      const repeatOverlap = identities().flatMap(({ id }) =>
        (["A", "B"] as const).map((c) => {
          const r1 = new Set(runs.find((r) => r.id === id && r.condition === c && r.round === 1)?.urlList ?? []);
          const r2 = runs.find((r) => r.id === id && r.condition === c && r.round === 2)?.urlList ?? [];
          const inter = r2.filter((u) => r1.has(u)).length;
          return { id, condition: c, union: new Set([...r1, ...r2]).size, intersection: inter };
        }),
      );

      const out = {
        note:
          "🔴 **기존 Apify 경로 재사용** — 새 인프라 0 · 운영 상수 불변 · 토큰 값 미기록. " +
          "🔴 분모 **6**(요청 10 ↔ 자산에서 복원 가능한 원상품 identity 6).",
        signals: { A: SIGNAL_A, B: SIGNAL_B, onlyDifference: "「새상품」 한 토큰" },
        rounds: ROUNDS,
        totals: {
          A: { urls: sum(side("A"), "urls"), krTld: sum(side("A"), "krTldUrls"), productPage: sum(side("A"), "productPageUrls"), usedLike: sum(side("A"), "usedLikeUrls") },
          B: { urls: sum(side("B"), "urls"), krTld: sum(side("B"), "krTldUrls"), productPage: sum(side("B"), "productPageUrls"), usedLike: sum(side("B"), "usedLikeUrls") },
        },
        perRun: runs.map(({ urlList, ...rest }) => ({ ...rest, urlSample: urlList.length })),
        repeatOverlap,
        caveats: [
          "🔴 `krTldUrls` 는 **TLD 휴리스틱** 이다 — 운영 시장 분류기(`classifyCandidateMarket`)가 아니다",
          "🔴 `usedLikeUrls` 는 **URL 문자열** 축이다(제목·본문을 받지 않는다)",
          "🔴 분모 6 · 라운드 2 ⟹ 작은 표본이다. 단순 URL 수로 B 를 채택하지 않는다",
          "🔴 SP-10 의 실행 간 변동(URL 겹침 3~30%)이 유효하다",
        ],
      };
      writeFileSync(OUT, JSON.stringify(out, null, 2));

      expect(runs.length).toBe(6 * 2 * ROUNDS);
      expect(out.totals.A.urls + out.totals.B.urls).toBeGreaterThanOrEqual(0);
    },
    20 * 60_000,
  );
});
