import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "@commerce/crawler";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 4-G — **IDENTITY POLICY 01 의 A·B 를 «반사실» 로 잰다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 변경 0 · 네트워크 0 · threshold 0 · 점수 0 · GT 수정 0.**
 *
 * CPO 가 GO 한 셋 중 **C(정의/주석)만 구현했다**. A·B 는 실제로 구현해서 전수 측정했고
 * **회귀 39건(28파일)과 충돌** 해 `CPO` 판정으로 올렸다(전문 `docs/STAGE4G-IDENTITY-POLICY-01.md`).
 * 🔴 헌장 §4-D — 「계약 변경이 필요하면 **임의 구현하지 않는다** — 변경 범위와 부작용까지
 *    «분석» 해 올린다」. 그 39건 중 25건이 **Legacy GT 기준선 가드** 이고, 작업지시서가
 *    **「Legacy GT 수정」을 금지** 한다 ⟹ CTO 가 그 숫자를 다시 박을 수 없다.
 *
 * 🟢 그래서 **숫자를 CI 에 남긴다** — 다음 세션이 이 측정을 **다시 하지 않는다.**
 *
 * ── 정책 정의(이 파일 안에서만 계산한다) ───────────────────────────────────
 * ```
 * BASE  현재 운영 그대로
 * A     Generic 축만으로 PRESUMED_SAME 금지 (식별 축 = TITLE · MODEL_CODE)
 * B     COLOR 를 Identity 에서 제외 (positive +1 제거 · COLOR_VARIANT 제거)
 * AB    둘 다
 * ```
 */

const FIX = path.join(__dirname, "fixtures");
const pad = (s: unknown, n: number) =>
  String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));

/* ═══════════════════ 운영 산식 복제 — §5-B replicationGate ═══════════════════ */

const SAME_MIN_AXES = 5;
const PRESUMED_SAME_MIN_AXES = 3;

type Axis = { axis: string; points: number };
interface Observed {
  verdict: string;
  axes: Axis[];
  blockers: string[];
  conflicts: string[];
}
type Policy = "BASE" | "A" | "B" | "AB";

/**
 * 🟢 **운영 분기를 글자 그대로 베꼈다**(cross-seller.ts 의 verdict IIFE).
 * 🔴 `brandOk` 는 반환되지 않는다 — 그런데 SAME 분기는 `!blocked` 와 **함께** 걸리고,
 *    `blockers` 가 비면 `BRAND_MISMATCH`/`BRAND_UNCONFIRMED` 가 둘 다 없으므로
 *    `brandOk` 가 **참임이 따라온다**. 그래서 복제식에서 생략해도 **동치** 다.
 *    🔴 그 동치가 깨지면 아래 `replicationGate` 가 **먼저 FAIL** 한다.
 */
function replicate(o: Observed, policy: Policy): string {
  const dropColor = policy === "B" || policy === "AB";
  const requireIdentity = policy === "A" || policy === "AB";

  if (o.conflicts.length > 0 && o.axes.length === 0) return "CONFLICT";

  const axes = dropColor ? o.axes.filter((a) => a.axis !== "COLOR") : o.axes;
  const blockers = dropColor ? o.blockers.filter((b) => b !== "COLOR_VARIANT") : o.blockers;

  const total = axes.reduce((s, a) => s + a.points, 0);
  const core = axes
    .filter((a) => a.axis !== "IMAGE" && !(a.axis === "TITLE" && a.points === 1))
    .reduce((s, a) => s + a.points, 0);
  const hasIdentity = axes.some((a) => a.axis === "TITLE" || a.axis === "MODEL_CODE");
  const sameSellerWithoutIdentity = !hasIdentity && blockers.includes("SAME_SELLER_DISTINCT_LISTING");

  if (blockers.length === 0 && core >= SAME_MIN_AXES) return "SAME";
  if (total >= PRESUMED_SAME_MIN_AXES && (requireIdentity ? hasIdentity : !sameSellerWithoutIdentity)) {
    return "PRESUMED_SAME";
  }
  if (total >= 1) return "SIMILAR";
  return "UNKNOWN";
}

const POSITIVE = new Set(["SAME", "PRESUMED_SAME"]);

/* ═══════════════════════════ GT 분모 (네트워크 0) ═══════════════════════════ */

interface GtCandidate {
  searchId: string;
  domain: string;
  humanGt: string;
  facts: Record<string, unknown>;
}
const GT = JSON.parse(readFileSync(path.join(FIX, "wu-059-gt-facts.json"), "utf8")) as {
  origins: Record<string, { canonicalProduct: unknown }>;
  candidates: Record<string, GtCandidate>;
};

const originFacts = new Map<string, ProductFacts>();
for (const [sid, o] of Object.entries(GT.origins)) {
  originFacts.set(sid, productFactsFromIdentityDna(buildProductIdentityDna(o.canonicalProduct as never)));
}

const rows = Object.entries(GT.candidates)
  .map(([id, c]) => {
    const of_ = originFacts.get(c.searchId);
    if (!of_) return null;
    const r = compareCrossSellerProducts(of_, c.facts as unknown as ProductFacts) as unknown as {
      verdict: string;
      axes: Axis[];
      blockers: { blocker: string }[];
      conflicts: { conflict: string }[];
    };
    const o: Observed = {
      verdict: String(r.verdict),
      axes: (r.axes ?? []).map((a) => ({ axis: String(a.axis), points: a.points ?? 0 })),
      blockers: (r.blockers ?? []).map((b) => String(b.blocker)),
      conflicts: (r.conflicts ?? []).map((c2) => String(c2.conflict)),
    };
    return { id, c, o };
  })
  .filter((v): v is { id: string; c: GtCandidate; o: Observed } => v !== null);

describe("STAGE4-G — A·B 반사실 측정(운영 변경 0)", () => {
  it("🔴🔴 replicationGate — 복제식이 운영 verdict 를 **전건 재현** 해야 숫자를 쓴다", () => {
    const mismatch = rows.filter((r) => replicate(r.o, "BASE") !== r.o.verdict);
    for (const m of mismatch) {
      // eslint-disable-next-line no-console
      console.log(`  🔴 ${m.id} 복제 ${replicate(m.o, "BASE")} ↔ 운영 ${m.o.verdict}`);
    }
    expect(rows.length, "🔴 GT 분모가 비었다 — 측정불가").toBe(14);
    expect(mismatch.length, "🔴🔴 복제식이 운영을 재현하지 못한다 — 이 파일의 숫자를 쓰지 않는다").toBe(0);
  });

  it("🔎 정책별 표 — TP(positive 유지) · FP · SAME 등급", () => {
    /* eslint-disable no-console */
    const humanSame = rows.filter((r) => r.c.humanGt === "SAME");
    const humanDiff = rows.filter((r) => r.c.humanGt === "DIFFERENT");

    console.log("\n═══ STAGE4-G — 정책별(GT 14 · human SAME 7 · DIFFERENT 7) ═══");
    console.log(`${pad("정책", 6)} ${pad("TP positive", 13)} ${pad("FP positive", 13)} ${pad("SAME 등급", 10)} PRESUMED`);
    for (const p of ["BASE", "A", "B", "AB"] as Policy[]) {
      const tp = humanSame.filter((r) => POSITIVE.has(replicate(r.o, p))).length;
      const fp = humanDiff.filter((r) => POSITIVE.has(replicate(r.o, p))).length;
      const same = rows.filter((r) => replicate(r.o, p) === "SAME").length;
      const pre = rows.filter((r) => replicate(r.o, p) === "PRESUMED_SAME").length;
      console.log(`${pad(p, 6)} ${pad(`${tp}/7`, 13)} ${pad(`${fp}/7`, 13)} ${pad(same, 10)} ${pre}`);
    }

    console.log("\n  🔴 등급이 «움직인» 행만 적는다(BASE → AB)");
    for (const r of rows) {
      const b = replicate(r.o, "BASE");
      const ab = replicate(r.o, "AB");
      if (b !== ab) console.log(`   ${pad(r.id, 5)} ${pad(r.c.domain, 22)} human ${pad(r.c.humanGt, 10)} ${b} → ${ab}`);
    }

    /** 🟢 이 분모에서는 FN 이 생기지 않는다 — 네 정책 전부 TP 7/7. */
    for (const p of ["BASE", "A", "B", "AB"] as Policy[]) {
      const tp = humanSame.filter((r) => POSITIVE.has(replicate(r.o, p))).length;
      expect(tp, `🔴 ${p} 가 이 분모에서 동일상품을 놓쳤다`).toBe(7);
    }
    /** 🔴 그리고 **FP 도 줄지 않는다** — 이 분모에 Generic-only FP 가 없다. */
    const fpBase = humanDiff.filter((r) => POSITIVE.has(replicate(r.o, "BASE"))).length;
    const fpAb = humanDiff.filter((r) => POSITIVE.has(replicate(r.o, "AB"))).length;
    expect(fpAb, "🔴 FP 가 늘었다면 즉시 STOP 이다").toBeLessThanOrEqual(fpBase);
  });

  it("🔴🔴 B 는 **SAME 등급을 깎는다** — C42(human SAME)가 PRESUMED_SAME 으로 내려간다", () => {
    /**
     * 🔴 이것이 회귀 32건의 원인이다. `EXACT` tier 는 `SAME` 에서 나오므로
     *    등급이 내려가면 **가격비교의 「동일상품」 칸이 바뀐다**(wu-068 EXACT 16 → 14).
     * 🟢 positive 에는 남는다(COMPARISON) ⟹ **FN 은 아니다.**
     */
    const c42 = rows.find((r) => r.id === "C42")!;
    expect(c42.c.humanGt).toBe("SAME");
    expect(replicate(c42.o, "BASE")).toBe("SAME");
    expect(replicate(c42.o, "B"), "🔴 B 의 등급 비용이 바뀌었다 — 보고 숫자를 갱신한다").toBe("PRESUMED_SAME");
  });

  it("🟢 B 를 넣어도 **C25·C20 이 SAME 으로 올라가지 않는다**(WU-043 참사는 재발하지 않는다)", () => {
    /** 🔴 `COLOR_VARIANT` 를 없애면 blocker 가 사라지지만, 색의 +1 도 같이 사라져
     *     corePoints 가 1 줄어 SAME 문턱에 못 닿는다 — **둘을 같이** 넣어야 성립한다. */
    for (const id of ["C20", "C25"]) {
      const r = rows.find((x) => x.id === id)!;
      expect(r.c.humanGt).toBe("DIFFERENT");
      expect(replicate(r.o, "AB"), `🔴 ${id} 이 SAME 으로 올라갔다 — 즉시 STOP`).not.toBe("SAME");
    }
  });
});

/* ═══════════ 운영 분모 — A 의 이득은 «여기» 에만 있다(저장 근거 문장) ═══════════ */

const OPS = JSON.parse(readFileSync(path.join(FIX, "sprint5-brand-gt.json"), "utf8")) as {
  rows: {
    id: string;
    candidateDomain: string | null;
    systemVerdict: string | null;
    humanVerdict: string;
    matchReasons: string[] | null;
  }[];
};

/**
 * 🔴 운영 행에는 **facts 가 없다** ⟹ `compareCrossSellerProducts` 로 다시 돌릴 수 없다.
 *    그래서 **owner 가 적어 둔 근거 문장** 으로 센다(지어내지 않는다).
 * 🟢 그 문장의 owner 는 `axes[].detail` 이다 —
 *    TITLE → 「핵심 상품명 …」 · MODEL_CODE → 「브랜드 품번 일치」/「모델코드 부분 일치 …」
 */
const IDENTIFYING_REASON = /핵심 상품명|브랜드 품번|모델코드/;
const reasonAxes = (r: { matchReasons: string[] | null }) =>
  (r.matchReasons ?? []).filter((l) => l.startsWith("근거:")).map((l) => l.slice(4).trim());

describe("STAGE4-G — 운영 분모에서 A 의 이득", () => {
  it("🟢🟢 Generic-only 운영 FP **9건** 이 실재한다 — A 의 유일한 측정된 이득", () => {
    /* eslint-disable no-console */
    const scored = OPS.rows.filter((r) => r.systemVerdict && POSITIVE.has(r.systemVerdict));
    const fp = scored.filter((r) => r.humanVerdict === "DIFFERENT");
    const tp = scored.filter((r) => r.humanVerdict === "SAME");
    const withReasons = (rs: typeof scored) => rs.filter((r) => reasonAxes(r).length > 0);
    const genericOnly = (rs: typeof scored) =>
      withReasons(rs).filter((r) => !reasonAxes(r).some((a) => IDENTIFYING_REASON.test(a)));

    const fpGeneric = genericOnly(fp);
    const tpGeneric = genericOnly(tp);

    console.log("\n═══ STAGE4-G — 운영 분모(저장 근거 문장) ═══");
    console.log(`  positive ${scored.length} · FP ${fp.length} · TP ${tp.length}`);
    console.log(`  근거 보유  FP ${withReasons(fp).length}/${fp.length} · TP ${withReasons(tp).length}/${tp.length}`);
    console.log(`  🟢 Generic-only FP **${fpGeneric.length}** ← A 가 SIMILAR 로 내린다`);
    for (const r of fpGeneric) console.log(`     ${r.id} ${pad(r.candidateDomain, 24)} [${reasonAxes(r).join(" · ")}]`);
    console.log(`  🔴 Generic-only TP ${tpGeneric.length}`);
    console.log(
      `  🔴🔴 **근거 문장이 없는 TP ${tp.length - withReasons(tp).length}/${tp.length} 는 «측정불가»** — 0 으로 세지 않는다`,
    );
    console.log(`  🔴 그리고 그 9건은 **B 로도 죽는다**(근거에 「색상 …」이 7/9) ⟹ A 와 B 의 이득이 겹친다`);

    expect(fpGeneric.length, "🔴 Generic-only FP 가 0 이면 A 의 근거가 이 분모에 없다").toBe(9);
    expect(tpGeneric.map((r) => `${r.id}/${r.candidateDomain}`), "🔴 A 가 «근거 있는» 운영 TP 를 깎는다").toEqual([]);
  });
});

/* ═══════════════════ C — 구현한 것은 이것뿐이다(동작 0) ═══════════════════ */

describe("STAGE4-G · C — MODEL CODE 정의(구현됨 · 동작 변경 0)", () => {
  const SRC = readFileSync(
    path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/cross-seller.ts"),
    "utf8",
  );
  const NO_COMMENT = SRC.replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ");

  it("C-1 🟢 정의가 소스에 있다 — 「모델 식별 O · 판매 단위 보증 X」", () => {
    expect(SRC).toContain("«모델» 을 식별한다");
    expect(SRC).toContain("«판매 단위(SKU)» 를 보증하지 않는다");
  });

  it("C-2 🔴 **동작은 한 글자도 바뀌지 않았다** — 상수·게이트·산식이 그대로다", () => {
    expect(NO_COMMENT).toContain("const SAME_MIN_AXES = 5;");
    expect(NO_COMMENT).toContain("const PRESUMED_SAME_MIN_AXES = 3;");
    expect(NO_COMMENT).toContain("const IDENTIFIER_AXIS_POINTS = 3;");
    expect(NO_COMMENT).toContain('if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME";');
    /** 🔴 A 는 들어 있지 «않다» — 들어가면 이 줄이 FAIL 하고 그것이 신호다. */
    expect(NO_COMMENT).toContain(
      'if (totalPoints >= PRESUMED_SAME_MIN_AXES && !sameSellerWithoutIdentity) return "PRESUMED_SAME";',
    );
    /** 🔴 B 도 들어 있지 «않다». */
    expect(NO_COMMENT).toContain('axes.push({ axis: "COLOR"');
    expect(NO_COMMENT).toContain('blockers.push({ blocker: "COLOR_VARIANT"');
  });

  it("C-3 🔴 품번 일치 **하나로는 SAME 에 닿지 못한다**(정의의 구현)", () => {
    const base: ProductFacts = {
      sourceUrl: "https://a.com/products/x",
      urlSlug: null,
      brand: "Main Story",
      brandModelCode: "AW26MS185",
      sellerSku: null,
      title: "Bubble Sweatshirt",
      coreTitleTokens: ["bubble"],
      categoryText: null,
      colorText: null,
      materialText: null,
      fitText: null,
      ageRangeText: null,
      sizeLabels: [],
      audienceSignals: [],
      imageUrls: [],
    };
    const y: ProductFacts = {
      ...base,
      sourceUrl: "https://b.com/products/y",
      title: "Unrelated Words",
      coreTitleTokens: ["unrelated", "words"],
    };
    const r = compareCrossSellerProducts(base, y) as unknown as { verdict: string; axes: Axis[] };
    expect(r.axes.map((a) => a.axis), "🔴 품번 축이 서지 않았다 — 이 케이스가 C-3 을 측정하지 못한다").toContain(
      "MODEL_CODE",
    );
    expect(String(r.verdict)).not.toBe("SAME");
  });
});
