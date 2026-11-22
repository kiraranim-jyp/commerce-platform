/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MMSE01 2차 — **SAME 0 상품군에만 선택적 추가 증거**(CPO §4)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **모든 후보에 반복하지 않는다**(CPO §4) — 1차 집계에서 **SAME 이 0 인 상품군** 만
 *    고르고, 그 안에서도 **「실제 다른 상품 근거」가 이미 있는 행은 제외** 한다.
 *    ⟹ 전수 381 중 **9건**(2.4%)만 라이브로 본다.
 * 🔴 부족한 증거를 **먼저 명시** 한다 — 이 9건은 전부 「품번 증거 없음 또는 미기록」이다.
 * 🟢 수집기는 운영 owner `factsFromProductUrl` 그대로(새 크롤러 0).
 * 🔴 운영 코드 0 · 판정 0 · DB 0 · 승격 0. `MMSE01_LIVE=1` 일 때만 돈다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";

const LIVE = process.env.MMSE01_LIVE === "1";
const FIX = join(__dirname, "fixtures");
const FIRST = join(FIX, "mmse01-firstpass.json");
const BASE = join(FIX, "mmse01-baseline.json");
const DUMP = join(FIX, "mmse01-secondpass.json");

/** 🔴 SAME 이 **0** 인 상품군 — 1차 집계가 낸 값이다(손으로 고르지 않았다). */
const ZERO_SAME_GROUPS = ["의류-원피스", "의류-하의", "의류-아웃터", "액세서리-모자"];

interface First {
  perRow: {
    group: string;
    originTitle: string | null;
    originSku: string | null;
    originHasSku: boolean;
    domain: string;
    url: string;
    market: string | null;
    verdict: string | null;
    tier: string | null;
    state: string;
    brand: string;
    code: string;
    note: string;
  }[];
}

/** 🟢 원상품 기준값은 **스냅샷 저장값** 에서 읽는다 — 지어내지 않는다. */
interface Base {
  bySnapshot: { origin_title: string | null; origin_brand: string | null; origin_sku: string | null; source_url: string | null }[];
}

describe("MMSE01 2차 — 선택적 추가 증거", () => {
  it.runIf(LIVE)(
    "LIVE 🟢 SAME 0 상품군의 비(非)실제다름 9건만 라이브 확인",
    async () => {
      const first = JSON.parse(readFileSync(FIRST, "utf8")) as First;
      const base = JSON.parse(readFileSync(BASE, "utf8")) as Base;

      const targets = first.perRow.filter(
        (p) => ZERO_SAME_GROUPS.includes(p.group) && p.state !== "REAL_DIFFERENT" && Boolean(p.url),
      );
      expect(targets.length, "🔴 2차 대상 수가 바뀌었다").toBe(9);

      /** 🟢 원상품별 기준값 — 같은 제목의 스냅샷에서 브랜드·품번을 읽는다. */
      const originOf = (title: string | null) =>
        base.bySnapshot.find((s) => s.origin_title === title) ?? null;

      const collectedAt = new Date().toISOString();
      let http = 0;
      const out = [];

      for (const t of targets) {
        const o = originOf(t.originTitle);
        const r = await factsFromProductUrl(t.url).catch((e: unknown) => ({
          status: "THREW" as const,
          candidate: null,
          httpCalls: 0,
          fetchPath: "NONE" as const,
          error: String(e),
        }));
        http += r.httpCalls ?? 0;
        const f = r.candidate?.facts ?? null;
        const desc = f?.description ?? null;
        const title = f?.title ?? null;
        const hay = `${title ?? ""}\n${desc ?? ""}`;

        /** 🔴 **부족했던 증거만** 본다 — 품번·브랜드·보조축(소재/색상/원산지/시즌). */
        const code = (o?.origin_sku ?? "").trim();
        const brand = (o?.origin_brand ?? "").trim();
        const codeHit =
          code.length > 0
            ? new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"), "i").exec(hay)
            : null;
        const brandHit =
          brand.length > 0
            ? new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"), "i").exec(hay)
            : null;
        const cut = (m: RegExpExecArray | null) =>
          m ? hay.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50).replace(/\s+/g, " ").trim() : null;

        out.push({
          group: t.group,
          originTitle: t.originTitle,
          originBrand: brand || null,
          originSku: code || null,
          domain: t.domain,
          url: t.url,
          firstPass: { state: t.state, brand: t.brand, code: t.code, note: t.note },
          stored: { verdict: t.verdict, tier: t.tier, market: t.market },
          /** 🔴 **부족한 증거를 먼저 적는다**(CPO §4). */
          missingEvidence: [
            t.code === "NO_EVIDENCE" || t.code === "UNKNOWN" ? "품번 증거" : null,
            t.brand === "UNKNOWN" || t.brand === "UNCONFIRMED" ? "브랜드 축 미기록" : null,
          ].filter(Boolean),
          live: {
            status: r.status,
            fetchPath: r.fetchPath,
            titleRaw: title,
            brandRaw: f?.brand ?? null,
            codeRaw: f?.brandModelCode ?? null,
            colorText: f?.colorText ?? null,
            materialText: f?.materialText ?? null,
            descriptionLength: desc?.length ?? 0,
            /** 🟢 원상품 기준값이 후보 원문에 있는가 — **원문 발췌와 함께** 적는다. */
            originCodeInCandidate: { found: Boolean(codeHit), excerpt: cut(codeHit) },
            originBrandInCandidate: { found: Boolean(brandHit), excerpt: cut(brandHit) },
            price: r.candidate?.price ?? null,
            imageUrl: r.candidate?.imageUrl ?? null,
          },
        });
      }

      writeFileSync(
        DUMP,
        JSON.stringify(
          {
            note:
              "MMSE01 2차 — SAME 0 상품군의 비실제다름 9건 선택적 증거 확인. " +
              "운영 추출기 그대로 · 승격 0 · 판정 변경 0.",
            collectedAt,
            httpCalls: http,
            zeroSameGroups: ZERO_SAME_GROUPS,
            targetCount: targets.length,
            rows: out,
          },
          null,
          1,
        ),
        "utf8",
      );

      /* eslint-disable no-console */
      console.log(`\n[MMSE01-2차] httpCalls=${http} · 대상 ${out.length}건`);
      for (const r of out) {
        console.log(
          [
            /** 🔴 `candidate_domain` 이 **null 인 행이 실재한다** — 로그가 죽지 않게 감싼다. */
            String(r.group ?? "-").padEnd(12),
            String(r.domain ?? "(도메인 없음)").padEnd(22),
            String(r.live.status ?? "-").padEnd(16),
            "원품번=" + (r.originSku ?? "없음"),
            "라이브품번=" + JSON.stringify(r.live.codeRaw),
            "라이브브랜드=" + JSON.stringify(r.live.brandRaw),
            "원품번발견=" + (r.live.originCodeInCandidate.found ? "🟢" : "-"),
            "원브랜드발견=" + (r.live.originBrandInCandidate.found ? "🟢" : "-"),
            "desc=" + r.live.descriptionLength,
          ].join(" "),
        );
        if (r.live.originCodeInCandidate.excerpt) console.log("      품번근거: " + r.live.originCodeInCandidate.excerpt);
      }
      /* eslint-enable no-console */

      expect(out).toHaveLength(9);
    },
    900_000,
  );

  it("GUARD 🔴 2차는 **1차가 고른 대상만** 본다(전수 반복 금지)", () => {
    const src = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).toContain("ZERO_SAME_GROUPS.includes(p.group)");
    expect(src).toContain('p.state !== "REAL_DIFFERENT"');
    /** 🔴 승격·판정 어휘를 만들지 않는다. */
    for (const banned of [["SAME", "MIN", "AXES"].join("_"), ["price", "TierFromLink"].join("")]) {
      expect(src, `🔴 판정을 만들었다: ${banned}`).not.toContain(banned);
    }
  });
});
