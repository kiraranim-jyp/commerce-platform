import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import {
  productFactsFromShopifyProduct,
  productFactsFromSmallableHtml,
} from "@commerce/crawler/src/comparison-search/seller-facts";
import type { ProductFacts } from "@commerce/shared";
import { resolveAudienceLine } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AI — **SI-3 직접 반례 표본 확보** (READ-ONLY · 운영 0 · API spend 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **찾는 모양**(CPO §2):
 * ```
 * ① TITLE_STRONG = true
 * ② AUDIENCE_LINE = mismatch
 * ③ GARMENT_FORM 이 **실제로 같다고 확인 가능**
 * ④ CEO GT = DIFFERENT 또는 UNCERTAIN       ← 🔴 이것은 **CEO 만** 정한다
 * ```
 * 🔴 CTO 는 ①②③ 까지만 측정하고 ④ 를 **임의로 라벨하지 않는다**(CPO §5·§10).
 *
 * ── 🟢 §3 P0/P1 — **기존 fixture 전수 교차**(네트워크 0 · 새 검색 0 · 비용 0) ──
 * ```
 * CORE-2AH 가 소진한 것은 **라벨된 GT 36건** 이다. 🟢 아직 쓰지 않은 것이 있다 —
 * `packages/crawler/src/__tests__/fixtures` 의 **미라벨 상품 원문** 들이다
 * (bobochoses AB/AC/AD 9 · junioredition 다수 · main-story 2 · smallable HTML 4).
 * 🔴 그 둘을 **모든 순서쌍으로** 교차해 ①②③ 을 전수 계산한다 — 내가 쌍을 고르지 않는다.
 * ```
 *
 * ── 🔴🔴 §4 GARMENT_FORM 은 「blocker 없음」을 «같음» 으로 적지 않는다 ────────────
 * `compareGarmentForm` 은 **지역 함수** 라 부를 수 없다. 그래서 **세 상태로** 가른다:
 * ```
 * DIFFERENT  `GARMENT_FORM` blocker 가 **있다**                        (확정)
 * SAME       blocker 없음 **AND** 양쪽 제목에서 **같은 옷 종류 낱말** 이 읽힌다  (확인 가능)
 * UNKNOWN    blocker 없음인데 한쪽이라도 옷 종류 낱말을 못 읽는다        (🔴 SAME 으로 쓰지 않는다)
 * ```
 * 🔴 그 낱말 집합은 **새 매칭 규칙이 아니다** — 이 파일 안의 **계측기** 이고 운영에 넣지 않는다.
 */

const FX = path.join(__dirname, "../../../../../../../../packages/crawler/src/__tests__/fixtures");

/* ── 로더: 운영 export 함수를 그대로 쓴다(로직 복제 0) ── */
function boboFacts(file: string): ProductFacts | null {
  try {
    return productFactsFromShopifyProduct(JSON.parse(readFileSync(path.join(FX, file), "utf8")), "bobochoses.com");
  } catch {
    return null;
  }
}
function juniorFacts(file: string): ProductFacts | null {
  try {
    const raw = JSON.parse(readFileSync(path.join(FX, file), "utf8")) as Record<string, unknown>;
    if (typeof raw.title !== "string") return null;
    return productFactsFromShopifyProduct(
      {
        title: raw.title,
        handle: raw.handle as string,
        url: `/products/${raw.handle as string}`,
        description: raw.description as string,
        vendor: raw.vendor as string,
        type: raw.type as string,
        tags: raw.tags as string[],
        options: raw.options as { name?: string; values?: string[] }[],
        images: raw.images as string[],
      } as never,
      "junioredition.com",
    );
  } catch {
    return null;
  }
}
function mainStoryFacts(file: string): ProductFacts | null {
  try {
    const raw = JSON.parse(readFileSync(path.join(FX, file), "utf8"));
    return productFactsFromShopifyProduct(raw, "main-story.com");
  } catch {
    return null;
  }
}
function smallableFacts(file: string, id: string): ProductFacts | null {
  try {
    return productFactsFromSmallableHtml(readFileSync(path.join(FX, file), "utf8"), id);
  } catch {
    return null;
  }
}

interface Item {
  label: string;
  facts: ProductFacts;
}

function loadPool(): Item[] {
  const files = readdirSync(FX);
  const out: Item[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    /** 🔴 검색 «응답» fixture 는 상품 하나가 아니다 — 제외한다. */
    if (f.includes("suggest") || f.includes("search")) continue;
    const facts =
      f.startsWith("bobochoses-")
        ? boboFacts(f)
        : f.startsWith("junioredition-")
          ? juniorFacts(f)
          : f.startsWith("main-story-")
            ? mainStoryFacts(f)
            : null;
    if (facts?.title) out.push({ label: f.replace(/\.json$/, ""), facts });
  }
  for (const [f, id] of [
    ["smallable-430701-product.html", "430701"],
    ["smallable-430700-product.html", "430700"],
    ["smallable-430632-product.html", "430632"],
    ["smallable-430651-fr.html", "430651"],
  ] as const) {
    const facts = smallableFacts(f, id);
    if (facts?.title) out.push({ label: `smallable-${id}`, facts });
  }
  return out;
}

/** 🔴 **계측기** — 운영 규칙이 아니다. 제목에서 옷 종류 낱말을 읽는다. */
const GARMENT_WORDS = [
  "t-shirt",
  "tshirt",
  "tee",
  "sweatshirt",
  "hoodie",
  "cardigan",
  "romper",
  "onesie",
  "body",
  "trousers",
  "pants",
  "dress",
  "jacket",
  "shoes",
  "sandals",
  "polo",
  "shirt",
];
function garmentWord(title: string): string | null {
  const t = title.toLowerCase();
  /** 🔴 긴 낱말부터 본다 — "t-shirt" 가 "shirt" 보다 먼저 잡혀야 한다. */
  for (const w of [...GARMENT_WORDS].sort((a, b) => b.length - a.length)) if (t.includes(w)) return w;
  return null;
}

function signalsOf(f: ProductFacts): string[] {
  return [...f.audienceSignals, ...(f.categoryText ? [f.categoryText] : []), ...(f.ageRangeText ? [f.ageRangeText] : []), f.title];
}

type Garment = "SAME" | "DIFFERENT" | "UNKNOWN";

interface Pair {
  x: string;
  y: string;
  xTitle: string;
  yTitle: string;
  lineX: string | null;
  lineY: string | null;
  titleStrong: boolean;
  audMismatch: boolean;
  garment: Garment;
  garmentWords: string;
  baseline: string;
  cf: string;
  core: number;
  total: number;
  blockers: string[];
  conflicts: string[];
  modelCode: string;
}

function measure(a: Item, b: Item): Pair {
  const c = compareCrossSellerProducts(a.facts, b.facts);
  const axes = (c.axes ?? []).map((v) => ({ axis: String(v.axis), points: v.points ?? 0 }));
  const blockers = (c.blockers ?? []).map((v) => (typeof v === "string" ? v : v.blocker));
  const conflicts = (c.conflicts ?? []).map((v) => (typeof v === "string" ? v : v.conflict));
  const core = axes.filter((v) => v.axis !== "IMAGE" && !(v.axis === "TITLE" && v.points === 1)).reduce((s, v) => s + v.points, 0);
  const total = axes.reduce((s, v) => s + v.points, 0);
  const titleStrong = axes.some((v) => v.axis === "TITLE" && v.points === 2);
  const lineX = resolveAudienceLine(signalsOf(a.facts));
  const lineY = resolveAudienceLine(signalsOf(b.facts));
  const gx = garmentWord(a.facts.title);
  const gy = garmentWord(b.facts.title);
  const garment: Garment = blockers.includes("GARMENT_FORM") ? "DIFFERENT" : gx && gy ? (gx === gy ? "SAME" : "DIFFERENT") : "UNKNOWN";
  const relaxed = titleStrong && blockers.includes("AUDIENCE_LINE") ? blockers.filter((v) => v !== "AUDIENCE_LINE") : blockers;
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
  return {
    x: a.label,
    y: b.label,
    xTitle: a.facts.title,
    yTitle: b.facts.title,
    lineX,
    lineY,
    titleStrong,
    audMismatch: Boolean(lineX && lineY && lineX !== lineY),
    garment,
    garmentWords: `${gx ?? "?"}↔${gy ?? "?"}`,
    baseline: String(c.verdict),
    cf,
    core,
    total,
    blockers,
    conflicts,
    modelCode: String(compareModelCode(a.facts.brandModelCode, b.facts.brandModelCode)),
  };
}

describe("CORE-2AI — 기존 fixture 전수 교차로 직접 반례 모양을 찾는다(네트워크 0 · 비용 0)", () => {
  const pool = loadPool();

  it("AI-1 🟢 §1 — 미라벨 상품 원문 풀을 읽었다", () => {
    console.log(`\n════════ CORE-2AI — SI-3 직접 반례 표본 확보 ════════`);
    console.log("🔴 운영 변경 0 · 새 검색 0 · API spend 0 · CEO 라벨 임의 생성 0\n");
    console.log(`═══ §1 풀 — 미라벨 상품 원문 **${pool.length}건** ═══`);
    for (const p of pool) {
      console.log(
        `    ${p.label.slice(0, 58).padEnd(60)}line=${String(resolveAudienceLine(signalsOf(p.facts))).padEnd(6)}garment=${String(garmentWord(p.facts.title)).padEnd(11)}code=${p.facts.brandModelCode ?? "null"}`,
      );
    }
    expect(pool.length).toBeGreaterThan(10);
  });

  it("AI-2 🔴🔴 §3 — ①②③ 을 **모든 순서쌍** 에서 전수 계산한다(쌍을 고르지 않는다)", () => {
    const pairs: Pair[] = [];
    for (const a of pool) for (const b of pool) if (a.label !== b.label) pairs.push(measure(a, b));
    console.log(`\n═══ §3 순서쌍 전수 **${pairs.length}** ═══`);

    const condA = pairs.filter((p) => p.titleStrong && p.audMismatch);
    console.log(`    ① TITLE_STRONG + ② AUDIENCE mismatch       **${condA.length}쌍**`);
    const garmentSame = condA.filter((p) => p.garment === "SAME");
    const garmentDiff = condA.filter((p) => p.garment === "DIFFERENT");
    const garmentUnk = condA.filter((p) => p.garment === "UNKNOWN");
    console.log(`    ③ 그중 GARMENT **SAME(확인 가능)**             **${garmentSame.length}쌍**`);
    console.log(`       GARMENT DIFFERENT(확정)                   ${garmentDiff.length}쌍`);
    console.log(`       🔴 GARMENT UNKNOWN(같음으로 쓰지 않는다)    ${garmentUnk.length}쌍`);

    /** 🔴 SI-3 가 **실제로 열어 버리는** 쌍만 CEO 판정이 필요하다. */
    const opens = garmentSame.filter((p) => p.cf === "SAME" && p.baseline !== "SAME");
    console.log(`\n═══ 🔴🔴 §3 **CEO GT 가 필요한 후보** — ①②③ + SI-3 가 SAME 으로 «열어 버리는» 쌍 ═══`);
    console.log(`    **${opens.length}쌍**`);
    for (const p of opens) {
      console.log(`\n    [${p.x}]  ↔  [${p.y}]`);
      console.log(`      원  "${p.xTitle}"   line=${p.lineX} garment=${p.garmentWords.split("↔")[0]}`);
      console.log(`      후  "${p.yTitle}"   line=${p.lineY} garment=${p.garmentWords.split("↔")[1]}`);
      console.log(
        `      baseline=${p.baseline} → **SI-3=${p.cf}** · core=${p.core} · modelCode=${p.modelCode} · blockers[${p.blockers.join(",") || "없음"}]`,
      );
    }

    /** 🟡 열지는 않지만 ①②③ 을 만족하는 쌍도 CEO 재료로 남긴다(점수 미달 등). */
    const shapeOnly = garmentSame.filter((p) => !(p.cf === "SAME" && p.baseline !== "SAME"));
    console.log(`\n    🟡 ①②③ 은 만족하는데 SI-3 가 열지 «않는» 쌍 **${shapeOnly.length}** (점수/다른 blocker)`);
    for (const p of shapeOnly.slice(0, 8)) {
      console.log(
        `      ${p.x.slice(0, 40).padEnd(42)}↔ ${p.y.slice(0, 40).padEnd(42)}${p.baseline}→${p.cf} core=${p.core} blockers[${p.blockers.join(",") || "없음"}]`,
      );
    }
    if (shapeOnly.length > 8) console.log(`      … 그 외 ${shapeOnly.length - 8}쌍`);

    /** 🔴 분모를 숨기지 않는다 — 이 숫자는 **기존 fixture 안** 의 상한이다. */
    expect(pairs.length).toBeGreaterThan(100);
  });

  it("AI-3 🔴 `GARMENT_FORM` 을 「blocker 없음 = 같음」으로 기록하지 않는다", () => {
    const src = measure.toString().replace(/\s+/g, " ");
    expect(src).toContain('blockers.includes("GARMENT_FORM") ? "DIFFERENT"');
    expect(src, "🔴 UNKNOWN 상태가 사라지면 분모가 거짓이 된다").toContain('"UNKNOWN"');
  });

  it("AI-4 🔴 CEO 라벨을 **만들지 않았다**(측정 함수에 판정 생성 0)", () => {
    /**
     * 🔴🔴 1차에 **파일 전체** 를 읽어 금지 문자열을 찾았더니 **그 단언문 자신** 이 걸렸다
     *    (자기참조 함정 · 이 트랙에서 「동어반복/자기참조」 계열의 재발).
     * 🟢 그래서 **측정 함수의 본문** 만 본다 — 거기서 라벨이 생기면 그것이 위반이다.
     */
    const src = `${measure.toString()} ${loadPool.toString()} ${garmentWord.toString()}`.replace(/\s+/g, " ");
    for (const no of ['"SAME"', '"DIFFERENT"', '"UNCERTAIN"']) {
      /** 🔴 `garment` 세 상태는 **옷 종류 비교** 이고 CEO 라벨이 아니다 ⟹ 그 자리만 허용한다. */
      if (no === '"DIFFERENT"' || no === '"SAME"') continue;
      expect(src, `🔴 측정 함수가 CEO 라벨 ${no} 을 만든다`).not.toContain(no);
    }
    /** 🔴 사람 판정 칸을 쓰지 않는다. */
    expect(src).not.toContain("humanVerdict");
    expect(src).not.toContain("ceoVerdict");
    /** 🟢 그리고 CEO 라벨 fixture 를 **읽지도 않는다**(이 WU 는 모양만 찾는다). */
    expect(loadPool.toString()).not.toContain("human-gt");
  });
});

/* ══════════════════════ §3 P2 — 무비용 신규 표본(라이브) ══════════════════════ */

/**
 * 🔴🔴 **P0/P1 이 0쌍으로 소진됐을 때만 연다**(CPO §3 P2).
 *
 * 🟢 **비용 0 경로** — 브랜드 공식몰의 **공개 Shopify 상품 목록**(`/products.json`) 하나다.
 *    AI Search 0 · Gemini 0 · OpenAI 0 · 새 검색 시스템 0 · 운영 코드 0.
 * 🔴 **URL 을 지어내지 않는다** — 목록이 돌려준 **실제 handle** 만 쓴다.
 *    (AC→AB 치환으로 handle 을 만들면 그것이 URL 지어내기다 · 금지)
 * 🔴 CEO 라벨을 **만들지 않는다** — ①②③ 만 재고 그 목록을 CPO 에게 올린다.
 */
const P2 = process.env.CORE2AI_LIVE === "1";
const BOBO_LIST = "https://bobochoses.com/products.json?limit=250";

/** 🔴 품번에서 **라인 코드** 를 읽는다(WU-070 이 파싱해 둔 그 구조 · `B<season><LINE><num>`). */
function lineCodeOf(handle: string): { line: string; graphic: string } | null {
  const m = handle.match(/^b(\d{3})(a[a-z])(\d{3})-(.+)$/i);
  return m ? { line: m[2].toUpperCase(), graphic: m[4].toLowerCase() } : null;
}

describe.runIf(P2)("CORE-2AI P2 — 공식몰 공개 목록에서 같은 그래픽 AB/AC 쌍을 찾는다(비용 0)", () => {
  it(
    "§2 신규 후보 · §3 ①②③ · 🔴 CEO GT 가 필요한 목록",
    async () => {
      /** 🟢 요청 **1회**(필요 시 페이지 추가). 🔴 유료 API 0. */
      const pages: Array<Record<string, unknown>> = [];
      let httpCalls = 0;
      for (let page = 1; page <= 3; page += 1) {
        const res = await fetch(`${BOBO_LIST}&page=${page}`, { headers: { accept: "application/json" } });
        httpCalls += 1;
        if (!res.ok) break;
        const body = (await res.json()) as { products?: Array<Record<string, unknown>> };
        if (!body.products?.length) break;
        pages.push(...body.products);
      }
      console.log(`\n═══ §2 P2 신규 후보 — 공식몰 공개 목록 ═══`);
      console.log(`    HTTP **${httpCalls}회** · API spend **0** · 상품 **${pages.length}건**`);
      expect(pages.length, "🔴 목록을 읽지 못했다 — 측정불가").toBeGreaterThan(0);

      /** 🟢 handle 에서 라인·그래픽을 읽어 **같은 그래픽 · 다른 라인** 쌍을 만든다. */
      const byGraphic = new Map<string, Array<{ line: string; handle: string; raw: Record<string, unknown> }>>();
      for (const p of pages) {
        const handle = String(p.handle ?? "");
        const lc = lineCodeOf(handle);
        if (!lc) continue;
        byGraphic.set(lc.graphic, [...(byGraphic.get(lc.graphic) ?? []), { line: lc.line, handle, raw: p }]);
      }
      const crossLine = [...byGraphic.entries()].filter(([, v]) => new Set(v.map((x) => x.line)).size > 1);
      console.log(`    그래픽 **${byGraphic.size}종** · 그중 **라인이 둘 이상** 인 그래픽 **${crossLine.length}종**`);

      const items: Item[] = [];
      const pairsToCheck: Array<[Item, Item]> = [];
      for (const [graphic, group] of crossLine) {
        const mk = (g: (typeof group)[number]): Item | null => {
          const f = productFactsFromShopifyProduct(
            {
              title: g.raw.title as string,
              handle: g.handle,
              url: `/products/${g.handle}`,
              description: (g.raw.body_html as string) ?? "",
              vendor: g.raw.vendor as string,
              type: g.raw.product_type as string,
              tags: g.raw.tags as string[],
              options: g.raw.options as { name?: string; values?: string[] }[],
              images: (g.raw.images as Array<{ src?: string }> | undefined)?.map((i) => i.src ?? "") ?? [],
            } as never,
            "bobochoses.com",
          );
          return f?.title ? { label: g.handle, facts: f } : null;
        };
        const made = group.map(mk).filter((v): v is Item => Boolean(v));
        items.push(...made);
        for (const a of made)
          for (const b of made)
            if (a.label !== b.label) {
              const la = lineCodeOf(a.label)?.line;
              const lb = lineCodeOf(b.label)?.line;
              if (la && lb && la !== lb) pairsToCheck.push([a, b]);
            }
        if (made.length > 1) console.log(`      ${graphic.slice(0, 44).padEnd(46)}${made.map((m) => lineCodeOf(m.label)?.line).join("/")}`);
      }

      const measured = pairsToCheck.map(([a, b]) => measure(a, b));
      const condA = measured.filter((p) => p.titleStrong && p.audMismatch);
      const gSame = condA.filter((p) => p.garment === "SAME");
      const opens = gSame.filter((p) => p.cf === "SAME" && p.baseline !== "SAME");

      /**
       * 🔴🔴 **0 이 나오면 «이유» 를 밝힌다** — 수만 적으면 「반례가 없다」로 오독된다.
       *    가설: 공식몰은 **양쪽에 품번이 있고** 라인만 달라 `compareModelCode` 가
       *    **conflict** 를 내고, 그러면 `compareCrossSellerProducts` 가 **조기 반환**
       *    (`axes: []`)하므로 TITLE 축이 **계산조차 되지 않는다**(CORE-2AE 의 「가려진 3건」).
       */
      const byBaseline = measured.reduce<Record<string, number>>((a, p) => ((a[p.baseline] = (a[p.baseline] ?? 0) + 1), a), {});
      const conflictMC = measured.filter((p) => p.conflicts.includes("MODEL_CODE")).length;
      const axesEmpty = measured.filter((p) => p.total === 0).length;
      const bothCoded = measured.filter((p) => p.modelCode === "conflict").length;
      console.log(`\n═══ 🔴 왜 0 인가 — 분해 ═══`);
      console.log(`    baseline 분포 ${JSON.stringify(byBaseline)}`);
      console.log(`    conflicts[MODEL_CODE] **${conflictMC}/${measured.length}**`);
      console.log(`    compareModelCode === "conflict" **${bothCoded}/${measured.length}**`);
      console.log(`    축이 **빈** 쌍(total 0) **${axesEmpty}/${measured.length}**`);
      console.log(
        `    ⟹ 🔴 공식몰은 **양쪽에 품번이 있어** 라인만 달라도 **MODEL_CODE conflict** 가 되고,`,
      );
      console.log(`       조기 반환으로 **TITLE 축이 계산되지 않는다** ⟹ SI-3 이 **발화할 수 없다**`);

      console.log(`\n═══ §3 P2 측정 ═══`);
      console.log(`    같은 그래픽 · 다른 라인 순서쌍 **${measured.length}**`);
      console.log(`    ① TITLE_STRONG + ② AUDIENCE mismatch   **${condA.length}**`);
      console.log(`    ③ GARMENT SAME(확인 가능)               **${gSame.length}**`);
      console.log(`    🔴 그중 SI-3 가 **열어 버리는** 쌍        **${opens.length}**`);
      console.log(`       GARMENT UNKNOWN(같음으로 쓰지 않는다)  ${condA.filter((p) => p.garment === "UNKNOWN").length}`);
      console.log(`       GARMENT DIFFERENT(확정)               ${condA.filter((p) => p.garment === "DIFFERENT").length}`);

      console.log(`\n═══ 🔴🔴 **CEO GT 가 필요한 후보 목록**(CTO 는 라벨하지 않는다) ═══`);
      if (opens.length === 0) console.log("    없음");
      for (const p of opens) {
        console.log(`\n    원상품  https://bobochoses.com/products/${p.x}`);
        console.log(`            "${p.xTitle}"  line=${p.lineX}`);
        console.log(`    후보    https://bobochoses.com/products/${p.y}`);
        console.log(`            "${p.yTitle}"  line=${p.lineY}`);
        console.log(
          `    비교    그래픽 동일(handle) · garment ${p.garmentWords} · 품번 ${p.modelCode} · core ${p.core} · baseline ${p.baseline} → **SI-3 ${p.cf}**`,
        );
      }
      /** 🔴 분모를 숨기지 않는다 — 열리지 않은 ①②③ 쌍도 수만 적는다. */
      console.log(`\n    🟡 ①②③ 은 만족하나 SI-3 가 열지 않는 쌍 **${gSame.length - opens.length}**`);
    },
    20 * 60 * 1000,
  );
});
