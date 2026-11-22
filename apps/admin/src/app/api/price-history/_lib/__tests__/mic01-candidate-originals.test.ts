/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-PRODUCT-IDENTITY-COMPARISON-01 — **후보 8건 원문 수집(읽기 전용)**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 목적은 **비교표의 입력** 하나다 — 화면 0 · 판정 로직 0 · DB 쓰기 0.
 * 🟢 수집기는 **운영 owner `factsFromProductUrl` 그대로** 다(새 크롤러 0 · CPO §2).
 * 🟢 식별 근거도 운영 owner `summarizeIdentityEvidence` 를 그대로 부른다.
 * 🔴 **값을 지어내지 않는다** — 접근 못 하면 그 `status` 를 그대로 적는다.
 * 🔴 라이브 HTTP 를 쓰므로 `MIC01_LIVE=1` 일 때만 돈다(기본 SKIP · 비용 통제).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { summarizeIdentityEvidence } from "@commerce/crawler/src/comparison-search/identity-evidence-summary";

const LIVE = process.env.MIC01_LIVE === "1";
const DUMP = join(__dirname, "fixtures", "mic01-candidate-originals.json");

/** 🔴 DB 에서 뜬 후보 전수(읽기 전용 SELECT 산출). 손으로 고르지 않았다. */
const PULLED = join(__dirname, "fixtures", "mic01-db-pull.json");

interface Pull {
  origin: Record<string, { value?: unknown } | null | undefined> & {
    sourceUrl?: string | null;
  };
  reviews: {
    candidate_url: string;
    candidate_domain: string;
    candidate_title: string | null;
    market: string | null;
    system_verdict: string | null;
    price_tier: string | null;
  }[];
}

describe("MIC01 — 후보 원문 수집", () => {
  it.runIf(LIVE)(
    "LIVE 🟢 8건(+원본)의 브랜드·품번·상품명·상세설명을 운영 추출기로 확인한다",
    async () => {
      const pull = JSON.parse(readFileSync(PULLED, "utf8")) as Pull;
      /** 🔴 검토 대상 = 확정 SAME(tier EXACT + verdict SAME)을 뺀 나머지. 손으로 안 고른다. */
      const targets = pull.reviews.filter(
        (r) => !(r.price_tier === "EXACT" && r.system_verdict === "SAME"),
      );
      expect(targets, "🔴 검토 대상이 8건이 아니다").toHaveLength(8);

      const originUrl = String(pull.origin.sourceUrl ?? "");
      expect(originUrl, "🔴 원본 URL 이 없다").toMatch(/^https?:/);

      const urls = [originUrl, ...targets.map((t) => t.candidate_url)];
      const out: Record<string, unknown>[] = [];
      const fullFacts: (Parameters<typeof summarizeIdentityEvidence>[0] | null)[] = [];
      let http = 0;

      for (const url of urls) {
        const r = await factsFromProductUrl(url).catch((e: unknown) => ({
          status: "THREW" as const,
          crawlerUrl: null,
          dedupeKey: null,
          candidate: null,
          httpCalls: 0,
          fetchPath: "NONE" as const,
          error: String(e),
        }));
        http += r.httpCalls ?? 0;
        const f = r.candidate?.facts ?? null;
        /**
         * 🔴🔴 **전체 facts 를 보관한다 — 잘라서 넘겼더니 식별 근거가 전건
         *    `NOT_MEASURED` 로 나왔다**(내 하니스 결함 · 그대로 보고했으면 「운영이 축을
         *    재지 않는다」는 거짓 결론이었다). 🟢 `summarizeIdentityEvidence` 는
         *    **ProductFacts 전체** 를 받는다.
         */
        fullFacts.push(f);
        out.push({
          url,
          status: r.status,
          fetchPath: r.fetchPath,
          httpCalls: r.httpCalls,
          title: r.candidate?.title ?? null,
          price: r.candidate?.price ?? null,
          imageUrl: r.candidate?.imageUrl ?? null,
          facts: f
            ? {
                brand: f.brand,
                brandModelCode: f.brandModelCode,
                sellerSku: f.sellerSku,
                title: f.title,
                coreTitleTokens: f.coreTitleTokens,
                categoryText: f.categoryText,
                colorText: f.colorText,
                materialText: f.materialText,
                fitText: f.fitText,
                ageRangeText: f.ageRangeText,
                sizeLabels: f.sizeLabels,
                audienceSignals: f.audienceSignals,
                descriptionText: (f as unknown as { descriptionText?: string | null })
                  .descriptionText ?? null,
              }
            : null,
        });
      }

      /** 🟢 식별 근거 — 운영 owner 를 그대로 부른다(복제 계산 0). */
      const originFacts = fullFacts[0] ?? null;
      const evidence = out.slice(1).map((c, i) => {
        const cf = fullFacts[i + 1] ?? null;
        return {
          url: c.url,
          domain: targets[i]!.candidate_domain,
          evidence: originFacts && cf ? summarizeIdentityEvidence(originFacts, cf) : null,
        };
      });

      writeFileSync(
        DUMP,
        JSON.stringify(
          {
            note:
              "MI-PRODUCT-IDENTITY-COMPARISON-01 — 운영 추출기(factsFromProductUrl) 산출. " +
              "원본 1 + 후보 8. 읽기 전용 · 값 생성 0.",
            httpCalls: http,
            originUrl,
            rows: out,
            identityEvidence: evidence,
          },
          null,
          1,
        ),
        "utf8",
      );

      /* eslint-disable no-console */
      console.log("\n[MIC01] httpCalls =", http);
      for (const r of out) {
        const f = r.facts as Record<string, unknown> | null;
        console.log(
          [
            String(r.url).replace(/^https?:\/\//, "").slice(0, 48),
            r.status,
            r.fetchPath,
            "brand=" + JSON.stringify(f?.brand ?? null),
            "code=" + JSON.stringify(f?.brandModelCode ?? null),
            "sku=" + JSON.stringify(f?.sellerSku ?? null),
            "color=" + JSON.stringify(f?.colorText ?? null),
            "mat=" + JSON.stringify(f?.materialText ?? null),
            /** 🔴 `price` 객체가 `{amount,currency}` 를 같이 들고 있다(별도 칸이 없다). */
            "price=" + JSON.stringify(r.price),
          ].join(" | "),
        );
      }
      /* eslint-enable no-console */

      expect(out).toHaveLength(9);
    },
    600_000,
  );

  it("GUARD 🔴 이 파일은 **운영 owner 를 복제하지 않는다**(수집기 하나)", () => {
    const src = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    /** 🔴 **자기참조 함정** — 금지 문자열을 그대로 적으면 이 단언이 자신을 잡는다. */
    expect(src, "🔴 자체 fetch 를 만들었다").not.toContain(["globalThis", "fetch ="].join("."));
    expect(src).toContain("factsFromProductUrl(url)");
    expect(src).toContain("summarizeIdentityEvidence(");
  });
});
