import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna, resolveAudienceLine } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AG — **TITLE_STRONG × AUDIENCE_LINE 경계 사례** (READ-ONLY · 운영 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **질문 하나**(CPO §0): 「같은 그래픽/TITLE 을 가진 **baby ↔ kids** 상품에서
 *    `AUDIENCE_LINE` 을 비차단으로 두는 것이 **CEO 의 동일상품 판단과 일치하는가**」.
 *
 * ── 🟢 §3 표본 우선순위 — **기존 데이터에서 찾았다**(새 검색/수집 **0**) ────────
 * ```
 * 🟢🟢 `fixtures/wu-112-human-gt.json` — **CEO 라벨 27건이 이미 있다**
 *    원상품 둘 — S1 `B226AC010`(Booty Ghosts · 15건) · S2 `B226AC009`(Hug Hairy Monster · 12건)
 *    그 안에 **경계 사례가 그대로 들어 있다**:
 *      bobochoses `b226ab046` / `b226ab040`   ← **AB(baby) 라인 · 같은 그래픽**
 *      cissywears `...baby-booty-ghosts...` / `...babyhug-hairy-monster...`
 *      junioredition `hug-hairy-monster-**baby**-t-shirt`
 *      billsstore `booty-ghosts-**long-sleeve**-t-shirt-**baby**`   ← 소매 길이까지 다르다
 *      bornyesterdaykids `...baby-...-l-s-t-shirt-...-pants-**set**...` ← **세트**
 * 🔴 원상품 URL 도 **리포에 실재하는 문자열** 을 썼다(지어내지 않았다).
 * 🔴 CEO 에게 새로 판정을 요청하지 않았다 — 기존 라벨을 **그대로** 쓴다(CPO §14).
 * ```
 *
 * ── 🔴 SI-3 조건(CORE-2AF 에서 고정 · 여기서 바꾸지 않는다) ────────────────────
 * ```
 * IF AUDIENCE_LINE mismatch AND TITLE 축 points === 2  THEN AUDIENCE_LINE 비차단
 * 🔴 점수 0 · threshold 0 · 다른 blocker 0 · MODEL_CODE conflict 0 · crossSeller 0
 * ```
 * 🔴 WU-143 5쌍 회귀의 **owner 는 `core-2af`** 다 — 여기서 **복제하지 않는다**(전체 회귀가 돈다).
 */

const LIVE = process.env.CORE2AG_LIVE === "1";

const GT112 = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/wu-112-human-gt.json"), "utf8"),
) as {
  counts: { SAME: number; DIFFERENT: number; UNCERTAIN: number; total: number };
  candidates: Array<{ sid: string; originCode: string; domain: string; url: string; verdict: string; reason?: string }>;
};

/** 🔴 원상품 URL — **리포에 이미 있는 문자열** 이다(grep 으로 확인 · 추측 0). */
const ORIGINS: Record<string, string> = {
  B226AC009: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
  B226AC010: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
};

interface Shot {
  verdict: string;
  blockers: string[];
  conflicts: string[];
  axes: Array<{ axis: string; points: number }>;
  total: number;
  core: number;
  titleStrong: boolean;
  audienceMismatch: boolean;
  lineX: string | null;
  lineY: string | null;
  modelCode: string;
  identifierConfirmed: boolean;
}

/** 🔴 운영 `signalsOf`(cross-seller.ts:385) 복제 — 지역 함수라 부를 수 없다(CORE-2AE 와 동일). */
function signalsOf(f: ProductFacts): string[] {
  return [
    ...f.audienceSignals,
    ...(f.categoryText ? [f.categoryText] : []),
    ...(f.ageRangeText ? [f.ageRangeText] : []),
    f.title,
  ];
}

function shoot(x: ProductFacts, y: ProductFacts): Shot {
  const c = compareCrossSellerProducts(x, y);
  const axes = (c.axes ?? []).map((a) => ({ axis: String(a.axis), points: a.points ?? 0 }));
  const lineX = resolveAudienceLine(signalsOf(x));
  const lineY = resolveAudienceLine(signalsOf(y));
  return {
    verdict: String(c.verdict),
    blockers: (c.blockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
    conflicts: (c.conflicts ?? []).map((v) => (typeof v === "string" ? v : v.conflict)),
    axes,
    total: axes.reduce((s, a) => s + a.points, 0),
    /** 🟢 CORE-2AD 가 고정한 운영 산식(IMAGE · TITLE 1점 제외). */
    core: axes
      .filter((a) => a.axis !== "IMAGE" && !(a.axis === "TITLE" && a.points === 1))
      .reduce((s, a) => s + a.points, 0),
    titleStrong: axes.some((a) => a.axis === "TITLE" && a.points === 2),
    audienceMismatch: Boolean(lineX && lineY && lineX !== lineY),
    lineX,
    lineY,
    modelCode: String(compareModelCode(x.brandModelCode, y.brandModelCode)),
    identifierConfirmed: Boolean(c.identifierConfirmed),
  };
}

/** 🔴 SI-3 조건부 완화 — `AUDIENCE_LINE` «하나만» 비차단. 점수·다른 blocker 는 그대로. */
function si3(s: Shot): string {
  if (s.conflicts.length > 0) return "CONFLICT";
  const relax = s.titleStrong && s.blockers.includes("AUDIENCE_LINE");
  const blockers = relax ? s.blockers.filter((b) => b !== "AUDIENCE_LINE") : s.blockers;
  if (blockers.length === 0 && s.core >= 5) return "SAME";
  if (s.total >= 3) return "PRESUMED_SAME";
  if (s.total >= 1) return "SIMILAR";
  return "UNKNOWN";
}

/* ═══════════════════════ 계약 — 네트워크 0 (CI 상주) ═══════════════════════ */

describe("CORE-2AG 계약 — 표본 출처와 SI-3 정의를 고정한다(네트워크 0)", () => {
  it("AG-1 🟢 §3 — 표본은 **기존 CEO GT**(wu-112) 다 · 27건 · 원상품 둘", () => {
    expect(GT112.candidates.length).toBe(27);
    expect(GT112.counts).toEqual({ SAME: 19, DIFFERENT: 6, UNCERTAIN: 2, total: 27 });
    const origins = new Set(GT112.candidates.map((c) => c.originCode));
    expect([...origins].sort()).toEqual(["B226AC009", "B226AC010"]);
    for (const o of origins) expect(ORIGINS[o], `🔴 원상품 URL 이 없다: ${o}`).toBeTruthy();
  });

  it("AG-2 🟢 경계 사례가 **그 GT 안에 실재** 한다(baby 라인 · 같은 그래픽)", () => {
    const urls = GT112.candidates.map((c) => c.url);
    for (const needle of ["b226ab046", "b226ab040", "baby-booty-ghosts", "babyhug-hairy-monster"]) {
      expect(urls.some((u) => u.includes(needle)), `🔴 ${needle} 가 표본에 없다`).toBe(true);
    }
  });

  it("AG-3 🔴 SI-3 정의가 CORE-2AF 와 **같다** — TITLE 2점 · AUDIENCE_LINE 하나만 비차단", () => {
    const src = si3.toString().replace(/\s+/g, " ");
    expect(src).toContain("s.titleStrong && s.blockers.includes(\"AUDIENCE_LINE\")");
    expect(src).toContain('b !== "AUDIENCE_LINE"');
    /** 🔴 점수·threshold 를 건드리지 않았다. */
    expect(src).toContain("s.core >= 5");
    expect(src, "🔴 다른 blocker 를 같이 풀면 SI-3 이 아니다").not.toContain("blockers = []");
  });

  it("AG-4 🔴 `resolveAudienceLine` 성질 유지(CORE-2AE AE-S5 와 같은 단언)", () => {
    expect(resolveAudienceLine(["Kids T-shirts", "Baby"])).toBe("BABY");
    expect(resolveAudienceLine(["Kids T-shirts"])).toBe("CHILD");
  });
});

/* ═══════════════════════════════ 라이브 ═══════════════════════════════ */

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

describe.runIf(LIVE)("CORE-2AG 라이브 — 경계 사례 27건 · SI-3 회수/누출", () => {
  it(
    "§1 표본 · §2 GT · §3 baseline · §4 CF · §6 기존 10건",
    async () => {
      const originFacts: Record<string, ProductFacts> = {};
      for (const [code, url] of Object.entries(ORIGINS)) originFacts[code] = await originFactsOf(url);

      console.log("\n════════ CORE-2AG — TITLE_STRONG × AUDIENCE_LINE 경계 사례 ════════");
      console.log("🔴 운영 변경 0 · blocker 제거 0 · threshold 0 · 새 검색/수집 0\n");
      for (const [code, f] of Object.entries(originFacts)) {
        console.log(`    원상품 ${code}  line=${resolveAudienceLine(signalsOf(f))}  title="${f.title}"`);
      }

      interface Row {
        sid: string;
        origin: string;
        domain: string;
        url: string;
        ceo: string;
        s: Shot;
        cf: string;
        group: "A" | "B" | "C" | "-";
      }
      const rows: Row[] = [];
      let unreachable = 0;
      for (const g of GT112.candidates) {
        const r = await factsFromProductUrl(g.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          unreachable += 1;
          console.log(`    🔴 측정불가 ${g.domain.padEnd(24)}${r.status}`);
          continue;
        }
        const s = shoot(originFacts[g.originCode], r.candidate.facts);
        /**
         * 🟢 §2 군 분류 — **측정값으로만** 가른다(내가 손으로 고르지 않는다):
         *   A = TITLE_STRONG + audience mismatch (이 WU 의 분모)
         *   B = A 중 CEO 가 SAME 이 **아니라고** 한 것(반례 후보)
         *   C = A 중 CEO SAME (회수 대상)
         */
        const inA = s.titleStrong && s.audienceMismatch;
        const group: Row["group"] = !inA ? "-" : g.verdict === "SAME" ? "C" : "B";
        rows.push({ sid: g.sid, origin: g.originCode, domain: g.domain, url: g.url, ceo: g.verdict, s, cf: si3(s), group });
      }

      /** 🔴 replicationGate — 복제 verdict 가 운영 verdict 를 전건 재현해야 한다. */
      const predict = (s: Shot) =>
        s.conflicts.length > 0
          ? "CONFLICT"
          : s.blockers.length === 0 && s.core >= 5
            ? "SAME"
            : s.total >= 3
              ? "PRESUMED_SAME"
              : s.total >= 1
                ? "SIMILAR"
                : "UNKNOWN";
      const mm = rows.filter((r) => predict(r.s) !== r.s.verdict);
      console.log(`\n═══ 🔴 replicationGate — mismatch **${mm.length}/${rows.length}** ═══`);
      for (const m of mm) console.log(`    🔴 ${m.domain}: 복제 ${predict(m.s)} ↔ 운영 ${m.s.verdict}`);
      expect(mm.length, "🔴🔴 복제식이 운영을 재현하지 못한다 — 숫자를 쓰지 않는다").toBe(0);

      /* ── §2 전수표 ── */
      console.log("\n═══ §2 Ground Truth × 측정 (27건 전수 · 🔴 측정불가 제외) ═══");
      console.log(
        `    ${"판매처".padEnd(24)}${"원".padEnd(5)}${"CEO".padEnd(10)}${"TS".padEnd(4)}${"AUDmm".padEnd(7)}${"line".padEnd(14)}${"baseline".padEnd(16)}${"SI-3".padEnd(16)}군`,
      );
      for (const r of rows) {
        console.log(
          `    ${r.domain.slice(0, 23).padEnd(24)}${r.origin.slice(-3).padEnd(5)}${r.ceo.padEnd(10)}${(r.s.titleStrong ? "Y" : "N").padEnd(4)}${(r.s.audienceMismatch ? "Y" : "N").padEnd(7)}${`${r.s.lineX}>${r.s.lineY}`.padEnd(14)}${r.s.verdict.padEnd(16)}${r.cf.padEnd(16)}${r.group}`,
        );
      }

      /* ── §1 군 집계 ── */
      const A = rows.filter((r) => r.group !== "-");
      const B = rows.filter((r) => r.group === "B");
      const C = rows.filter((r) => r.group === "C");
      console.log("\n═══ §1 Sample ═══");
      console.log(`    총 사례 **${rows.length}** (측정불가 ${unreachable})`);
      console.log(`    A군(TITLE_STRONG + AUDIENCE mismatch) **${A.length}**`);
      console.log(`    B군(A 중 CEO 가 SAME 이 아니라 한 것 · 반례) **${B.length}**`);
      console.log(`    C군(A 중 CEO SAME · 회수 대상) **${C.length}**`);

      /* ── §8 반례 상세 ── */
      console.log("\n═══ 🔴 §8 반례(B군) 상세 — 「같은 그래픽 + baby/kids + 별도 상품」 ═══");
      if (B.length === 0) console.log("    없음");
      for (const r of B) {
        console.log(`    ${r.domain}  CEO=${r.ceo}  baseline=${r.s.verdict} → SI-3=${r.cf}`);
        console.log(`        url=${r.url}`);
        console.log(
          `        축[${r.s.axes.map((a) => `${a.axis}:${a.points}`).join(" ")}] core=${r.s.core} modelCode=${r.s.modelCode} blockers[${r.s.blockers.join(",")}]`,
        );
      }

      /* ── §3/§4 KPI ── */
      const ceoSame = rows.filter((r) => r.ceo === "SAME").length;
      const baseSame = rows.filter((r) => r.s.verdict === "SAME");
      /**
       * 🔴🔴 **두 가지를 «섞지 않는다»** — 1차에 `cf === "SAME" && ceo !== "SAME"` 로 셌더니
       *    **기존 baseline 오포함**(tinyapple sweatshirt · CEO DIFFERENT · baseline 이 **이미** SAME)이
       *    「SI-3 누출 1」로 찍혔다. 🔴 그대로 보고했으면 **거짓** 이다.
       * 🟢 그래서 나눈다:
       * ```
       * baselineWrong   기존에 이미 SAME 인데 CEO 가 SAME 이 아니다   ← 이 WU 와 **무관**
       * si3Leak         baseline 이 SAME 이 **아니었는데** SI-3 로 SAME 이 되고 CEO 가 SAME 이 아니다
       * si3Recovered    baseline 이 SAME 이 아니었는데 SI-3 로 SAME 이 되고 CEO 가 SAME 이다
       * ```
       */
      let rec = 0;
      let dLeak = 0;
      let uLeak = 0;
      let baselineWrong = 0;
      let si3Recovered = 0;
      let si3Leak = 0;
      const moved: string[] = [];
      const baselineWrongList: string[] = [];
      for (const r of rows) {
        if (r.cf !== r.s.verdict) moved.push(`${r.domain}:${r.s.verdict}→${r.cf}`);
        const becameSame = r.cf === "SAME" && r.s.verdict !== "SAME";
        if (r.s.verdict === "SAME" && r.ceo !== "SAME") {
          baselineWrong += 1;
          baselineWrongList.push(`${r.domain}(CEO ${r.ceo})`);
        }
        if (becameSame) {
          if (r.ceo === "SAME") si3Recovered += 1;
          else si3Leak += 1;
        }
        if (r.cf === "SAME") {
          if (r.ceo === "SAME") rec += 1;
          if (r.ceo === "DIFFERENT") dLeak += 1;
          if (r.ceo === "UNCERTAIN") uLeak += 1;
        }
      }
      console.log("\n═══ §3 Baseline ═══");
      console.log(
        `    CEO  SAME ${ceoSame} · DIFFERENT ${rows.filter((r) => r.ceo === "DIFFERENT").length} · UNCERTAIN ${rows.filter((r) => r.ceo === "UNCERTAIN").length}`,
      );
      console.log(
        `    운영 baseline SAME **${baseSame.length}** (그중 CEO SAME ${baseSame.filter((r) => r.ceo === "SAME").length} · 오포함 ${baseSame.filter((r) => r.ceo !== "SAME").length})`,
      );
      console.log(`    AUDIENCE_LINE blocker **${rows.filter((r) => r.s.blockers.includes("AUDIENCE_LINE")).length}건**`);
      console.log("\n═══ §4 SI-3 Counterfactual ═══");
      console.log(`    변화 — ${moved.join(" · ") || "0건"}`);
      console.log(`    🟢 **SI-3 가 만든 회수** **${si3Recovered}**`);
      console.log(`    🔴 **SI-3 가 만든 누출** **${si3Leak}**`);
      console.log(`    ── 참고(섞어 쓰지 않는다) ──`);
      console.log(`    누적 SAME ∩ CEO SAME  ${rec}/${ceoSame}   (기존 baseline SAME 포함)`);
      console.log(`    누적 DIFFERENT 포함  ${dLeak} · UNCERTAIN 포함 ${uLeak}`);
      console.log(
        `    🔴 **기존 baseline 오포함 ${baselineWrong}건** — ${baselineWrongList.join(", ") || "없음"}  (이 WU 와 무관)`,
      );

      /** 🔴🔴 CPO §7 판정은 **SI-3 가 만든 누출** 로 한다. */
      if (si3Leak > 0) {
        console.log(`\n    🔴🔴 **SI-3 가 누출을 만들었다 — 운영 반영 보류**(${si3Leak}건)`);
      } else {
        console.log(`\n    🟢 **SI-3 가 만든 누출 0** — 기존 오포함 ${baselineWrong}건은 별개 사안이다`);
      }
      expect(si3Leak, "🔴 SI-3 가 DIFFERENT/UNCERTAIN 을 SAME 으로 열었다 — 즉시 STOP").toBe(0);
      expect(rows.length, "🔴 표본이 비면 측정하지 않는다").toBeGreaterThan(0);
    },
    30 * 60 * 1000,
  );
});
