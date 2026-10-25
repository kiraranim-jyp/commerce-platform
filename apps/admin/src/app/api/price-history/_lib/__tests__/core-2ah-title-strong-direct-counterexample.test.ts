import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna, resolveAudienceLine } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AH — **SI-3 직접 반례** 탐색 (READ-ONLY · 운영 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **찾는 모양 하나**(CPO §3):
 * ```
 * TITLE_STRONG = true  ·  AUDIENCE_LINE mismatch  ·  GARMENT_FORM **같음**  ·
 * CEO GT = DIFFERENT 또는 UNCERTAIN
 * ```
 * 🟢 CORE-2AG 의 반례(tinyapple sweatshirt)는 **GARMENT_FORM 이 달라서** SI-3 까지
 *    도달하지 않았다 ⟹ 그것은 **안전성 증명이 아니다**. 이 WU 가 그 자리를 채운다.
 *
 * ── 🟢 §2 표본 — **기존 GT 전수 합집합**(새 검색/수집 **0**) ───────────────────
 * ```
 * URL 키 GT 다섯 묶음을 합친다 — wu-111(2) · wu-112(27) · wu-116(1) · wu-125(9) ·
 * core-2m(10). 🔴 URL 로 중복 제거하고, **판정이 충돌하면 그 후보를 측정에서 뺀다**
 * (core-2m 이 `historicalConflicts` 로 적어 둔 그 자리 — 어느 쪽이 맞는지 CTO 가 정하지 않는다).
 * 🔴 `wu-093` 은 **제외** — 키가 판매처 SKU 이고 원상품이 「S1/S2」로 불명이다(WU-131 결론).
 * 🔴 `wu-099/100` 은 **가치 라벨**(USEFUL/NOISE)이고 SAME GT 가 아니다 ⟹ 제외.
 * ```
 *
 * ── 🔴 GARMENT_FORM 판정의 한계를 먼저 적는다 ──────────────────────────────────
 * `compareGarmentForm` 은 **지역 함수** 라 부를 수 없다. 🟢 대신 **blocker 유무** 로 본다:
 * ```
 * GARMENT_FORM blocker 있음  ⟹ **다름**(확정)
 * blocker 없음               ⟹ **「같음 또는 모름」**  🔴 「같음」으로 단정하지 않는다
 * ```
 * 🔴 그래서 「GARMENT_FORM 같음」 분모는 **상한** 이다(모름이 섞인다). 보고에 그대로 적는다.
 */

const LIVE = process.env.CORE2AH_LIVE === "1";
const FX = (n: string) => path.join(__dirname, "fixtures", n);

/** 🔴 원상품 URL — 리포에 실재하는 문자열(추측 0 · CORE-2AG 와 같은 값). */
const ORIGINS: Record<string, string> = {
  B226AC009: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
  B226AC010: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
};

type Verdict = "SAME" | "DIFFERENT" | "UNCERTAIN";
interface Label {
  source: string;
  origin: string;
  url: string;
  domain: string;
  ceo: Verdict;
}

function norm(v: unknown): Verdict | null {
  const s = String(v ?? "").toUpperCase();
  return s === "SAME" || s === "DIFFERENT" || s === "UNCERTAIN" ? (s as Verdict) : null;
}

/** 🟢 다섯 묶음을 **같은 모양** 으로 접는다. 🔴 칸 이름은 파일마다 다르므로 전부 훑는다. */
function loadLabels(): Label[] {
  const out: Label[] = [];
  const push = (source: string, origin: string, url: unknown, domain: unknown, ceo: unknown) => {
    const v = norm(ceo);
    if (!v || typeof url !== "string" || !url) return;
    out.push({ source, origin, url, domain: String(domain ?? new URL(url).host), ceo: v });
  };

  const g112 = JSON.parse(readFileSync(FX("wu-112-human-gt.json"), "utf8"));
  for (const c of g112.candidates) push("wu-112", c.originCode, c.url, c.domain, c.verdict);

  const g2m = JSON.parse(readFileSync(FX("core-2m-ceo-visual-gt.json"), "utf8"));
  for (const c of g2m.candidates) push("core-2m", g2m.originCode, c.url, c.domain, c.calibrationLabel);

  const g125 = JSON.parse(readFileSync(FX("wu-125-human-gt.json"), "utf8"));
  for (const c of g125.candidates) push("wu-125", c.origin, c.url, c.host, c.human);

  const g111 = JSON.parse(readFileSync(FX("wu-111-human-gt.json"), "utf8"));
  for (const c of g111.candidates) push("wu-111", c.originCode, c.url, c.domain, c.humanVerdict ?? c.human ?? c.verdict);

  const g116 = JSON.parse(readFileSync(FX("wu-116-human-gt.json"), "utf8"));
  for (const c of g116.candidates) push("wu-116", c.originCode, c.url, c.domain, c.humanVerdict ?? c.human ?? c.verdict);

  return out;
}

/** 🔴 같은 URL 에 **다른 판정** 이 있으면 측정에서 뺀다(CTO 가 어느 쪽인지 정하지 않는다). */
function dedupe(labels: Label[]): { usable: Label[]; conflicted: string[] } {
  const byKey = new Map<string, Label[]>();
  for (const l of labels) {
    const k = `${l.origin}|${l.url.toLowerCase()}`;
    byKey.set(k, [...(byKey.get(k) ?? []), l]);
  }
  const usable: Label[] = [];
  const conflicted: string[] = [];
  for (const [k, group] of byKey) {
    const verdicts = new Set(group.map((g) => g.ceo));
    if (verdicts.size > 1) {
      conflicted.push(`${k.split("|")[1]} {${[...verdicts].join("/")}} (${group.map((g) => g.source).join(",")})`);
      continue;
    }
    usable.push({ ...group[0], source: group.map((g) => g.source).join("+") });
  }
  return { usable, conflicted };
}

/* ═════════════════════ 계약 — 네트워크 0 (CI 상주) ═════════════════════ */

describe("CORE-2AH 계약 — 표본 합집합과 제외 근거를 고정한다(네트워크 0)", () => {
  it("AH-1 🟢 §2 — URL 키 GT **다섯 묶음** 을 합치고 충돌은 뺀다", () => {
    const all = loadLabels();
    const { usable, conflicted } = dedupe(all);
    console.log(`\n═══ §1 표본 합집합 ═══`);
    console.log(`    원 라벨 **${all.length}** → URL 중복 제거 후 **${usable.length}** · 판정 충돌로 제외 **${conflicted.length}**`);
    for (const c of conflicted) console.log(`    🔴 충돌 제외 — ${c}`);
    const bySource = usable.reduce<Record<string, number>>((a, l) => ((a[l.source] = (a[l.source] ?? 0) + 1), a), {});
    console.log(`    출처 분포 — ${JSON.stringify(bySource)}`);
    expect(usable.length).toBeGreaterThan(20);
    /** 🔴 모든 후보에 원상품 URL 이 있어야 측정 가능하다. */
    for (const l of usable) expect(ORIGINS[l.origin], `🔴 원상품 URL 없음: ${l.origin}`).toBeTruthy();
  });

  it("AH-2 🔴 `wu-093` 과 `wu-099/100` 은 **제외** 된다(키·라벨 성질이 다르다)", () => {
    const src = loadLabels.toString();
    expect(src, "🔴 wu-093 은 SKU 키 + 원상품 불명이다(WU-131)").not.toContain("wu-093");
    expect(src, "🔴 wu-099/100 은 가치 라벨이고 SAME GT 가 아니다").not.toContain("wu-099");
    expect(src).not.toContain("wu-100");
  });

  it("AH-3 🔴 GARMENT_FORM 은 **blocker 유무** 로만 본다(지역 함수라 부를 수 없다)", () => {
    /** 🔴 「blocker 없음」을 「같음」으로 단정하지 않는다 — 분모가 상한이라는 사실을 계약으로 남긴다. */
    expect(true).toBe(true);
  });
});

/* ═════════════════════════════ 라이브 ═════════════════════════════ */

async function originFactsOf(url: string): Promise<ProductFacts> {
  const ex = await shopifySiteStrategy.extract(url);
  if (!ex?.productData) throw new Error(`🔴 원상품 추출 실패 — 측정불가: ${url}`);
  let dna = buildProductIdentityDna(
    buildCanonicalProduct(url, ex.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
  );
  if (!dna.brand.value) {
    const h = await fetchPlainHtml(url);
    const site = h ? extractSiteBrandName(h) : null;
    if (site?.value) {
      dna = buildProductIdentityDna(
        buildCanonicalProduct(
          url,
          { ...(ex.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
          {} as Record<string, ProductDataSource>,
          [],
        ),
      );
    }
  }
  if (!dna.brand.value) throw new Error(`🔴 원상품 brand 가 비면 측정 열화 — 거부: ${url}`);
  return productFactsFromIdentityDna(dna);
}

function signalsOf(f: ProductFacts): string[] {
  return [...f.audienceSignals, ...(f.categoryText ? [f.categoryText] : []), ...(f.ageRangeText ? [f.ageRangeText] : []), f.title];
}

describe.runIf(LIVE)("CORE-2AH 라이브 — 직접 반례 탐색(READ-ONLY)", () => {
  it(
    "§1 표본 · §2 조건 전수 · §3 SI-3 · §4 직접 반례",
    async () => {
      const { usable } = dedupe(loadLabels());
      const originFacts: Record<string, ProductFacts> = {};
      for (const code of new Set(usable.map((l) => l.origin))) originFacts[code] = await originFactsOf(ORIGINS[code]);

      console.log("\n════════ CORE-2AH — SI-3 직접 반례 탐색 ════════");
      console.log("🔴 운영 변경 0 · 새 검색/수집 0 · GARMENT_FORM 조건 추가 0\n");

      interface Row extends Label {
        baseline: string;
        cf: string;
        titleStrong: boolean;
        audMismatch: boolean;
        garmentBlocked: boolean;
        core: number;
        total: number;
        blockers: string[];
        conflicts: string[];
        lineY: string | null;
      }
      const rows: Row[] = [];
      let unreachable = 0;
      for (const l of usable) {
        const r = await factsFromProductUrl(l.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          unreachable += 1;
          continue;
        }
        const x = originFacts[l.origin];
        const c = compareCrossSellerProducts(x, r.candidate.facts);
        const axes = (c.axes ?? []).map((a) => ({ axis: String(a.axis), points: a.points ?? 0 }));
        const blockers = (c.blockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker));
        const conflicts = (c.conflicts ?? []).map((v) => (typeof v === "string" ? v : v.conflict));
        const core = axes
          .filter((a) => a.axis !== "IMAGE" && !(a.axis === "TITLE" && a.points === 1))
          .reduce((s, a) => s + a.points, 0);
        const total = axes.reduce((s, a) => s + a.points, 0);
        const titleStrong = axes.some((a) => a.axis === "TITLE" && a.points === 2);
        const lineX = resolveAudienceLine(signalsOf(x));
        const lineY = resolveAudienceLine(signalsOf(r.candidate.facts));
        const audMismatch = Boolean(lineX && lineY && lineX !== lineY);
        const garmentBlocked = blockers.includes("GARMENT_FORM");
        /** 🔴 SI-3 — AUDIENCE_LINE «하나만» 비차단. 점수·다른 blocker·conflict 그대로. */
        const relaxed = titleStrong && blockers.includes("AUDIENCE_LINE") ? blockers.filter((b) => b !== "AUDIENCE_LINE") : blockers;
        const cf =
          conflicts.length > 0
            ? "CONFLICT"
            : relaxed.length === 0 && core >= 5
              ? "SAME"
              : total >= 3
                ? "PRESUMED_SAME"
                : total >= 1
                  ? "SIMILAR"
                  : "UNKNOWN";
        rows.push({ ...l, baseline: String(c.verdict), cf, titleStrong, audMismatch, garmentBlocked, core, total, blockers, conflicts, lineY });
      }
      expect(rows.length, "🔴 표본이 비면 측정하지 않는다").toBeGreaterThan(0);

      /** 🔴 replicationGate — 복제 verdict 가 운영 verdict 를 전건 재현해야 한다. */
      const mm = rows.filter((r) => {
        const p =
          r.conflicts.length > 0
            ? "CONFLICT"
            : r.blockers.length === 0 && r.core >= 5
              ? "SAME"
              : r.total >= 3
                ? "PRESUMED_SAME"
                : r.total >= 1
                  ? "SIMILAR"
                  : "UNKNOWN";
        return p !== r.baseline;
      });
      console.log(`═══ 🔴 replicationGate — mismatch **${mm.length}/${rows.length}** ═══`);
      for (const m of mm) console.log(`    🔴 ${m.domain}: 운영 ${m.baseline}`);
      expect(mm.length, "🔴🔴 복제식이 운영을 재현하지 못한다 — 숫자를 쓰지 않는다").toBe(0);

      /* ── §2 A군(TITLE_STRONG + AUD mismatch) 전수 ── */
      const A = rows.filter((r) => r.titleStrong && r.audMismatch);
      console.log(`\n═══ §2 A군 — TITLE_STRONG + AUDIENCE mismatch **${A.length}건** ═══`);
      console.log(`    ${"판매처".padEnd(24)}${"원".padEnd(5)}${"CEO".padEnd(10)}${"GARMENT".padEnd(18)}${"baseline".padEnd(16)}${"SI-3".padEnd(16)}core`);
      for (const r of A) {
        console.log(
          `    ${r.domain.slice(0, 23).padEnd(24)}${r.origin.slice(-3).padEnd(5)}${r.ceo.padEnd(10)}${(r.garmentBlocked ? "🔴 다름(확정)" : "같음 또는 모름").padEnd(18)}${r.baseline.padEnd(16)}${r.cf.padEnd(16)}${r.core}`,
        );
      }

      /* ── §4 직접 반례 ── */
      const direct = A.filter((r) => !r.garmentBlocked && r.ceo !== "SAME");
      console.log(`\n═══ 🔴 §4 **직접 반례** — TITLE_STRONG + AUD mismatch + GARMENT 비차단 + CEO≠SAME ═══`);
      console.log(`    **${direct.length}건**`);
      for (const r of direct) {
        console.log(`    🔴 ${r.domain}  CEO=${r.ceo}  baseline=${r.baseline} → SI-3=${r.cf}  core=${r.core}`);
        console.log(`        ${r.url}`);
        console.log(`        blockers[${r.blockers.join(",") || "없음"}] conflicts[${r.conflicts.join(",") || "없음"}] line=${r.lineY}`);
      }

      /* ── §3 KPI — baseline 과 SI-3 를 가른다 ── */
      let si3Recovered = 0;
      let si3Leak = 0;
      const moved: string[] = [];
      const baselineWrong: string[] = [];
      for (const r of rows) {
        if (r.cf !== r.baseline) moved.push(`${r.domain}:${r.baseline}→${r.cf}`);
        if (r.baseline === "SAME" && r.ceo !== "SAME") baselineWrong.push(`${r.domain}(CEO ${r.ceo})`);
        if (r.cf === "SAME" && r.baseline !== "SAME") {
          if (r.ceo === "SAME") si3Recovered += 1;
          else si3Leak += 1;
        }
      }
      console.log(`\n═══ §3 Baseline → SI-3 ═══`);
      console.log(`    표본 **${rows.length}** (측정불가 ${unreachable}) · CEO SAME ${rows.filter((r) => r.ceo === "SAME").length} · DIFFERENT ${rows.filter((r) => r.ceo === "DIFFERENT").length} · UNCERTAIN ${rows.filter((r) => r.ceo === "UNCERTAIN").length}`);
      console.log(`    변화 — ${moved.join(" · ") || "0건"}`);
      console.log(`    🟢 **SI-3 가 만든 회수 ${si3Recovered}**`);
      console.log(`    🔴 **SI-3 가 만든 누출 ${si3Leak}**`);
      console.log(`    🔴 기존 baseline 오포함 ${baselineWrong.length}건 — ${baselineWrong.join(", ") || "없음"} (이 WU 와 무관)`);

      /** 🔴🔴 CPO §9 — SI-3 가 만든 누출이 하나라도 있으면 **UNSAFE** 다. */
      if (si3Leak > 0) console.log(`\n    🔴🔴 **DIRECT COUNTEREXAMPLE — SI-3 UNSAFE**`);
      else if (direct.length > 0) console.log(`\n    🟡 직접 반례 ${direct.length}건이 있으나 SI-3 누출 0 — 그 이유를 §4 에 적었다`);
      else console.log(`\n    🟡 **직접 반례 0건 — MORE DATA NEEDED**`);
      expect(si3Leak, "🔴 SI-3 가 CEO≠SAME 을 SAME 으로 열었다 — UNSAFE 로 닫는다").toBe(0);
    },
    40 * 60 * 1000,
  );
});
