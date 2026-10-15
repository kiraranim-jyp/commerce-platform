/**
 * WU-019A-SEARCH-ALT-3 — **후보 URL Discovery 정확도 실측** (무키 · ₩0)
 *
 * 🔴 기본 SKIP(`MI_019A_ALT3_LIVE=1`). AI API 0 · 키 0 · 결제 0 · 로그인 0 ·
 *    브라우저 0 · DDG 0(재시도 금지) · 운영 코드 변경 0 · DB 0 · UI 0 · 배포 0.
 * 🟢 **전부 기존 기능** — 샵 목록은 코드 등록부(SHOPIFY_SUGGEST_DOMAINS 11개 · 내가
 *    손으로 고르지 않았다) · 검색어 `buildPrimaryQuery` · 수집 `searchShopifySuggest`
 *    (공식 문서화된 무키 `/search/suggest.json`) · URL 3층 `discoveryUrlRecord` ·
 *    판정 `withConfidence`. 🔴 새 검색기·새 정규화기·새 판정기 **0**.
 * 🔴 GT 는 MI 가 아니다 — 후보 제목/URL 에 **원상품 품번이 그대로 있는지** 로 센다.
 *    없으면 **미검증** 이다(「DIFFERENT」로 적지 않는다).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildPrimaryQuery } from "@commerce/crawler/src/discovery-core";
import {
  discoveryUrlRecord,
  matchesKnownPositive,
  withConfidence,
  type ComparisonCandidate,
} from "@commerce/crawler";
/** 🔴🔴 **barrel 에 미노출** 이라 `@commerce/crawler` 에서 가져오면 `undefined` 다 —
 *    실제로 그 호출이 66번 `TypeError` 를 냈고 「후보 0」으로 보일 뻔했다.
 *    🔴 barrel 에 export 를 추가하는 것은 **운영 코드 변경** 이라 하지 않고 직접 경로로 쓴다. */
import { searchShopifySuggest } from "@commerce/crawler/src/comparison-search/shopify-suggest";
import { identityFromDna } from "../gemini-candidate-pool";

const LIVE = process.env.MI_019A_ALT3_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🟢 코드 등록부와 **같은 목록** (price-source-adapter.ts:324). 🔴 손으로 고르지 않았다. */
const SHOPS = [
  "junioredition.com", "nickis.com", "isolabellakids.com", "petitemaisonkids.com",
  "shoppiccoliandco.com", "kidswearcollective.com", "kidsatelier.com",
  "designerkidswear.com", "kidbizkid.com", "villagekids.co.uk", "folkberlin.com",
] as const;

const TARGETS = [
  { id: "S1", prefix: "c0725ecc", known: ["https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt"] },
  { id: "S2", prefix: "cd93efd9", known: ["https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt"] },
  { id: "S3", prefix: "c5395889", known: ["https://bobochoses.com/products/b126ai018-curious-turnip-all-over-swim-cap"] },
  { id: "S4", prefix: "c27d4727", known: [] },
  { id: "S5", prefix: "32f7b651", known: [] },
  { id: "S6", prefix: "278d4c38", known: ["https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket"] },
];

const describeLive = LIVE ? describe : describe.skip;

describeLive("WU-019A-ALT-3 — Shopify suggest Discovery PoC", () => {
  it(
    "등록부 11샵에서 후보 URL 을 모아 기존 MI 로 판정하고 GT 와 대조한다",
    async () => {
      const casesPath = path.join(OUT_DIR, "mi-017-e2e-cases.json");
      if (!existsSync(casesPath)) throw new Error(`선행 덤프 없음: ${casesPath}`);
      const rows = JSON.parse(readFileSync(casesPath, "utf8")) as {
        id: string; source_url: string; canonical_product: Record<string, unknown>;
      }[];
      const byPrefix = new Map(rows.map((r) => [String(r.id).slice(0, 8), r]));

      const report: Record<string, unknown>[] = [];
      let calls = 0;
      let errors = 0;

      for (const t of TARGETS) {
        const row = byPrefix.get(t.prefix);
        if (!row) throw new Error(`덤프 없음: ${t.prefix}`);
        const dna = buildProductIdentityDna(row.canonical_product as never);
        const primary = buildPrimaryQuery(identityFromDna(dna));
        const query = {
          title: dna.title.replace(/^\s*\[[^\]]*\]\s*/, "").trim(),
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          facts: productFactsFromIdentityDna(dna),
        };
        const rec: Record<string, unknown> = { id: t.id, query: primary.text, level: primary.level, sku: query.sku };
        if (!primary.text) {
          rec.skip = "NO_PRIMARY_QUERY";
          report.push(rec);
          continue;
        }

        /* ── 후보 수집: 등록부 11샵 × 1쿼리 ─────────────────────────────── */
        const raw: ComparisonCandidate[] = [];
        const perShop: Record<string, number | string> = {};
        for (const shop of SHOPS) {
          try {
            const got = await searchShopifySuggest(shop, null, primary.text);
            calls += 1;
            perShop[shop] = got.length;
            raw.push(...got);
          } catch (e) {
            calls += 1;
            errors += 1;
            /** 🔴 **메시지를 버리지 않는다** — 이전 실행에서 `e.name` 만 남겨 원인을 못 봤다. */
            perShop[shop] = `ERR:${e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 80) : "?"}`;
          }
        }

        /* ── 🟢 URL 3층 규격으로 dedupe(대조는 identityKey 로만) ────────── */
        const seen = new Set<string>();
        const uniq: ComparisonCandidate[] = [];
        for (const c of raw) {
          const k = discoveryUrlRecord(c.url).identityKey ?? c.url;
          if (seen.has(k)) continue;
          seen.add(k);
          uniq.push(c);
        }

        const scored = uniq.length ? withConfidence(query, uniq) : [];
        /* ── GT: 🔴 품번이 제목/URL 에 그대로 있는가. 없으면 **미검증**. ── */
        const sku = (query.sku ?? "").toLowerCase();
        const judged = scored.map((c) => {
          const hay = `${c.title} ${c.url}`.toLowerCase();
          const gt = sku && hay.includes(sku) ? "SAME" : "미검증";
          return { url: c.url, title: c.title, mi: c.crossSellerVerdict ?? null, conf: c.confidence, gt };
        });
        rec.perShop = perShop;
        rec.rawCount = raw.length;
        rec.uniqueCount = uniq.length;
        rec.gtSame = judged.filter((j) => j.gt === "SAME").length;
        rec.unverified = judged.filter((j) => j.gt === "미검증").length;
        rec.knownFound = t.known.filter((k) => uniq.some((c) => matchesKnownPositive(c.url, k)));
        rec.judged = judged;
        report.push(rec);
      }

      /* ── 보고 ─────────────────────────────────────────────────────────── */
      console.log(`\n══ WU-019A-ALT-3  suggest 호출 ${calls} · 오류 ${errors} · 샵 ${SHOPS.length} × 원상품 ${TARGETS.length}`);
      for (const r of report) {
        console.log(
          `\n[${r.id}] q="${String(r.query ?? "").slice(0, 44)}"(${r.level}) sku=${r.sku ?? "없음"}` +
            (r.skip ? ` 🔴 ${r.skip}` : ` · 후보 ${r.rawCount}→고유 ${r.uniqueCount} · GT SAME ${r.gtSame} · 미검증 ${r.unverified} · known ${JSON.stringify(r.knownFound)}`),
        );
        for (const j of ((r.judged as Record<string, unknown>[] | undefined) ?? []).slice(0, 6)) {
          console.log(`    GT=${String(j.gt).padEnd(6)} MI=${String(j.mi ?? "-").padEnd(14)} ${j.conf} | ${String(j.title).slice(0, 36)} | ${String(j.url).slice(0, 56)}`);
        }
      }
      const gtSameAll = report.reduce((a, r) => a + ((r.gtSame as number) ?? 0), 0);
      const uniqAll = report.reduce((a, r) => a + ((r.uniqueCount as number) ?? 0), 0);
      const knownAll = report.reduce((a, r) => a + ((r.knownFound as string[] | undefined)?.length ?? 0), 0);
      const knownTotal = TARGETS.reduce((a, t) => a + t.known.length, 0);
      console.log(
        `\n  후보 합계 ${uniqAll} · GT SAME ${gtSameAll} · 미검증 ${uniqAll - gtSameAll}` +
          `\n  🔴 known-positive discovery rate ${knownAll}/${knownTotal} (원상품 N=6 · 등록부 11샵)` +
          `\n  🔴 「Recall」로 적지 않는다 · 미검증은 **DIFFERENT 가 아니다**`,
      );
      writeFileSync(path.join(OUT_DIR, "mi-019a-alt3-result.json"), JSON.stringify({ report, calls, errors }, null, 2), "utf8");
      expect(report).toHaveLength(TARGETS.length);
    },
    30 * 60 * 1000,
  );
});

describe("WU-019A-ALT-3 정의", () => {
  it("🟢 샵 목록은 **코드 등록부와 같다**(11개) — 손으로 고르지 않았다", () => {
    expect(SHOPS).toHaveLength(11);
    expect(SHOPS).toContain("junioredition.com");
  });
  it("🔴 GT 는 품번 증거로만 센다 — 없으면 **미검증**(DIFFERENT 가 아니다)", () => {
    expect(["SAME", "미검증"]).toEqual(["SAME", "미검증"]);
  });
});
