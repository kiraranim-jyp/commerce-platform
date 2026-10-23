import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { extractSiteBrandName } from "@commerce/crawler";
import { resolveBrandName } from "@commerce/crawler/src/brand-resolver";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { buildProductIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-173 — **원상품 brand 복구 안정성**(조사 전용 · 상품 3종 × 10회)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「**추측하지 말고 각각 raw evidence 로 확인**」 ·
 * 「오직 **원상품 brand acquisition** 만 조사」.
 *
 * 🔴 MI **0** · threshold **0** · MODEL_CODE **0** · TITLE **0** · 동의어 **0** ·
 *    가격 **0** · 공급 **0** · Adapter/Registry **0** · Gemini **0** · UI **0** ·
 *    운영 코드 **0** · 배포 **0**.
 * 🔴 게이트 `WU_173_PROBE=1` 없으면 SKIP.
 *
 * ── 🟢 경로를 코드로 읽었다 — 분기가 **다섯** 이다(`shopify.site-strategy.ts:80` `fillRejectedBrand`)
 * ```
 * ① `productData.brand` 가 **비어 있으면** → 보러 가지 않는다(「모르면 채우지 않는다」)
 * ② `resolveBrandName(raw)` 가 **거부(changed && !cleaned)** 가 아니면 → 그대로 둔다
 * ③ `productData.siteBrandName` 이 **이미 있으면** → 다시 받지 않는다
 * ④ `fetchPlainHtml(url)` 이 **null** 이면 → 포기        ← 🔴 의심 지점
 * ⑤ `extractSiteBrandName(html)` 이 **null** 이면 → 포기  ← 🔴 의심 지점
 *    (조건: `og:site_name` **와** JSON-LD `Organization.name` 이 **둘 다 있고 같아야** 한다)
 * ```
 * 🔴 `fetchPlainHtml` 은 **export 가 아니다** ⟹ 하니스는 같은 URL 을 **직접 fetch** 해서
 *    ④와 ⑤를 가른다. 🔴 「운영과 같은 fetch」가 아니므로 그 차이를 **보고에 적는다**.
 */
const LIVE = process.env.WU_173_PROBE === "1";
const N = Number(process.env.WU_173_N ?? "10");
/** 🔴 시도 사이 간격 — 내가 429 를 유발하지 않기 위해서다(1차 실행의 교훈). */
const GAP_MS = Number(process.env.WU_173_GAP_MS ?? "20000");

const PRODUCTS = [
  { code: "B226AC009", url: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt" },
  { code: "B226AC010", url: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt" },
  { code: "B226AC117", url: "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket" },
];

/** 🔴 `site-brand-name.ts` 의 내부 두 함수와 **같은 정규식** 을 쓴다(사본 · 변경 0). */
const ogSiteName = (html: string) =>
  (/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i.exec(html))?.[1] ?? null;
const jsonLdOrgName = (html: string) => {
  for (const b of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(b[1]) as unknown;
      const walk = (v: unknown): string | null => {
        if (Array.isArray(v)) {
          for (const x of v) {
            const r = walk(x);
            if (r) return r;
          }
          return null;
        }
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          if (String(o["@type"] ?? "") === "Organization" && typeof o.name === "string") return o.name;
          for (const x of Object.values(o)) {
            const r = walk(x);
            if (r) return r;
          }
        }
        return null;
      };
      const r = walk(j);
      if (r) return r;
    } catch {
      /* 무시 — 운영도 같다 */
    }
  }
  return null;
};

interface Trial {
  n: number;
  vendor: string;
  rejected: boolean;
  siteBrandFromStrategy: string | null;
  rawStatus: number | null;
  rawKB: number;
  og: string | null;
  org: string | null;
  siteBrandFromHtml: string | null;
  finalBrand: string;
  cause: string;
}

describe("WU-173 — 원상품 brand 복구 안정성", () => {
  it.runIf(LIVE)(`상품 3종 × ${N}회 반복해 실패 원인을 분해한다`, async () => {
    /* eslint-disable no-console */
    const summary: { code: string; ok: number; fail: number; causes: Record<string, number> }[] = [];

    for (const p of PRODUCTS) {
      console.log(`\n══════════ ${p.code} ══════════`);
      const trials: Trial[] = [];
      for (let i = 1; i <= N; i += 1) {
        /** 🔴 시도 사이에 간격을 둔다 — 429 를 내가 만들지 않기 위해서다. */
        if (i > 1) await new Promise((r) => setTimeout(r, GAP_MS));
        const ex = await shopifySiteStrategy.extract(p.url);
        const pd = (ex?.productData ?? {}) as ExtractedProductData & { siteBrandName?: string };
        const vendor = (pd.brand ?? "").trim();
        const res = vendor ? resolveBrandName(vendor) : null;
        const rejected = Boolean(res?.changed && !res.cleaned.trim());
        const siteBrandFromStrategy = pd.siteBrandName ?? null;

        /**
         * 🔴🔴 ④와 ⑤를 가르기 위해 같은 URL 을 직접 받아 본다.
         *
         * 🔴🔴 **1차 실행에서 내가 `429` 를 유발했다** — 반복 호출 **＋** 이 직접 fetch 가
         *    같이 돌아 분당 요청이 두 배가 됐고, `bobochoses.com` 이 **429 Too Many
         *    Requests** 를 돌려줬다. ⟹ 그 상태의 「성공률 22%」는 **측정 아티팩트** 다.
         * 🟢 그래서 ⒜ **전략이 실패했을 때만** 직접 fetch 하고 ⒝ 시도 사이에 **간격** 을 둔다.
         *    🔴 그래야 「사이트가 안 준다」와 「내가 너무 빨리 불렀다」가 갈린다.
         */
        let rawStatus: number | null = null;
        let html = "";
        if (!siteBrandFromStrategy) {
          await new Promise((r) => setTimeout(r, GAP_MS));
          try {
            const r = await fetch(p.url, {
              headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
              signal: AbortSignal.timeout(30000),
            });
            rawStatus = r.status;
            html = await r.text();
          } catch {
            rawStatus = null;
          }
        }
        const og = html ? ogSiteName(html) : null;
        const org = html ? jsonLdOrgName(html) : null;
        const fromHtml = html ? (extractSiteBrandName(html)?.value ?? null) : null;

        const dna = ex
          ? buildProductIdentityDna(
              buildCanonicalProduct(p.url, pd as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
            )
          : null;
        const finalBrand = dna?.brand.value ?? "";

        /** 🔴 **원인을 하나로 단정하지 않고 분기 순서대로** 고른다(①~⑤ + 성공). */
        const cause = finalBrand
          ? "🟢 성공"
          : !ex
            ? "① 원상품 추출 실패"
            : !vendor
              ? "① vendor 비어 있음(보러 가지 않는다)"
              : !rejected
                ? "② vendor 가 거부되지 않음(복구 경로 미진입)"
                : siteBrandFromStrategy
                  ? "⑦ siteBrandName 은 있는데 최종 brand 가 빔(merge 소실)"
                  : rawStatus !== 200
                    ? `④ 추가 fetch 실패(직접 fetch status=${rawStatus})`
                    : !og || !org
                      ? `⑤ og/Organization 부재(og=${JSON.stringify(og)} org=${JSON.stringify(org)})`
                      : og !== org
                        ? `⑤ og ≠ Organization(${JSON.stringify(og)} ≠ ${JSON.stringify(org)})`
                        : fromHtml
                          ? "④ 운영 추가 fetch 만 실패(직접 fetch 로는 복구된다)"
                          : "⑥ HTML 은 왔는데 siteBrandName 추출 실패";

        trials.push({
          n: i,
          vendor,
          rejected,
          siteBrandFromStrategy,
          rawStatus,
          rawKB: Math.round(html.length / 1024),
          og,
          org,
          siteBrandFromHtml: fromHtml,
          finalBrand,
          cause,
        });
        console.log(
          `  ${String(i).padStart(2)} vendor=${JSON.stringify(vendor).padEnd(10)} 거부=${rejected ? "🟢" : "🔴"}` +
            ` 전략siteBrand=${JSON.stringify(siteBrandFromStrategy).padEnd(15)}` +
            ` raw=${String(rawStatus).padStart(4)}/${String(Math.round(html.length / 1024)).padStart(4)}KB` +
            ` htmlSiteBrand=${JSON.stringify(fromHtml).padEnd(15)} final=${JSON.stringify(finalBrand).padEnd(15)} ${cause}`,
        );
      }
      const ok = trials.filter((t) => t.finalBrand).length;
      const causes: Record<string, number> = {};
      for (const t of trials) if (!t.finalBrand) causes[t.cause] = (causes[t.cause] ?? 0) + 1;
      summary.push({ code: p.code, ok, fail: trials.length - ok, causes });
    }

    console.log("\n══════════ 🔴🔴 §5 안정성 표 ══════════");
    console.log(`  ${"상품".padEnd(11)} ${"시도".padStart(4)} ${"brand 발견".padStart(10)} ${"미발견".padStart(6)} ${"성공률".padStart(6)}`);
    for (const s of summary) {
      const n = s.ok + s.fail;
      console.log(
        `  ${s.code.padEnd(11)} ${String(n).padStart(4)} ${String(s.ok).padStart(10)} ${String(s.fail).padStart(6)}` +
          ` ${`${Math.round((s.ok / Math.max(1, n)) * 100)}%`.padStart(6)}`,
      );
    }
    console.log("\n══════════ 🔴 실패 원인 분류 ══════════");
    for (const s of summary) {
      if (s.fail === 0) {
        console.log(`  ${s.code} — 🟢 실패 0`);
        continue;
      }
      for (const [c, n] of Object.entries(s.causes)) console.log(`  ${s.code} — ${String(n).padStart(2)}회  ${c}`);
    }
    const totalOk = summary.reduce((n, s) => n + s.ok, 0);
    const total = summary.reduce((n, s) => n + s.ok + s.fail, 0);
    console.log(`\n  전체 ${totalOk}/${total} (${Math.round((totalOk / Math.max(1, total)) * 100)}%)`);
    console.log("  🔴 하니스의 `raw` 는 **직접 fetch** 다 — 운영 `fetchPlainHtml` 과 헤더/스택이 다를 수 있다");
    console.log("  🔴 그래서 「운영 fetch 만 실패」와 「사이트가 안 준다」를 그 차이로 가른다");

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(total).toBeGreaterThan(0);
  }, 1_800_000);
});
