/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 ② A④ 설명문 근거 **보강** — 분모 7 → 실제 확보분(네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **목표는 숫자를 11 로 만드는 것이 아니다**(CPO 명시) — **양쪽 설명문이 실제로
 *    둘 다 있는 쌍만** 정확하게 더한다. 확보 못 하면 **확보된 분모만** 적는다.
 *
 * 🔴🔴 **기존 결과물을 덮어쓰지 않는다** — `a07-both-fulltext-axes.json` ·
 *    `a22-candidate-descriptions.json` · `fixtures/*` 는 **읽기만** 하고 결과는 새 파일에.
 * 🟢 축 비교는 **기존 로직 그대로** 다(`extractKeywords` · `compareAxis` · `ALL_AXES`) —
 *    사본 0 · 새 규칙 0.
 *
 * 🔴 **금지 그대로** — 제목 토큰을 `brandModelCode` 로 승격 · 상세설명 품번 레버 승격 ·
 *    SAME 기준 완화 · verdict 재계산 · 새 HTTP · DB · 운영 배선.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ALL_AXES,
  compareAxis,
  extractKeywords,
  type ExtractInput,
  type ExtractOptions,
} from "./mi-reeval-shadow-keywords";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

const GT_FACTS = path.join(HERE, "fixtures", "wu-059-gt-facts.json");
const KW = path.join(HERE, "fixtures", "mi-reeval-03-keyword-input.json");
const A22 = path.join(HERE, "preserved", "a22-candidate-descriptions.json");
const A07 = path.join(HERE, "preserved", "a07-both-fulltext-axes.json");
const COORD = path.join(HERE, "preserved", "a33-candidate-coordinates.json");
const SHADOW = path.join(ROOT, "docs", "MI-REEVAL-STEP5-SHADOW.json");
/** 🔴 쓰기는 **이 파일 하나** — 기존 산출물과 다른 이름이다. */
const OUT = path.join(HERE, "preserved", "a11-fulltext-axes-boosted.json");

const GUARDS_OFF: ExtractOptions = {};
const GUARDS_ON: ExtractOptions = { useObserved: true };

/** 🔴 `{value}` 포장과 평문 둘 다 온다 — 한쪽만 읽으면 조용히 비어 보인다. */
const val = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object" && "value" in v) {
    const inner = (v as { value?: unknown }).value;
    return typeof inner === "string" ? inner.trim() || null : null;
  }
  return null;
};

type CanonicalProduct = {
  sku?: string | null;
  brand?: unknown;
  color?: unknown;
  title?: unknown;
  titleKo?: unknown;
  material?: unknown;
  sourceUrl?: string | null;
  description?: unknown;
  descriptionKo?: unknown;
};
type PairA = { pairId: string; originUrl: string; candidateUrl: string; priorGt?: string | null; ceoLatest?: string | null };
type A22Row = { pairId: string; host: string; gt: string | null; hasDescription: boolean; title: string | null; description: string | null };
type KwRow = { originCode: string | null; candidateUrl: string; candidate: { title: string | null; description: string | null } | null };

const base = () => {
  const gt = read(GT_FACTS) as { origins: Record<string, { canonicalProduct: CanonicalProduct }> };
  const shadow = (read(SHADOW) as { pairsA: PairA[] }).pairsA;
  const coord = (read(COORD) as { pairs: { pairId: string; candidateUrl: string; originUrl: string }[] }).pairs;
  const a22 = (read(A22) as { rows: A22Row[] }).rows;
  const kw = (read(KW) as { pairs: KwRow[] }).pairs;
  /** 🟢 원상품 `sourceUrl` → S* 역색인(손으로 고르지 않는다 · a07 과 같은 방식). */
  const byUrl = new Map<string, string>();
  for (const [s, v] of Object.entries(gt.origins)) {
    const u = v.canonicalProduct?.sourceUrl;
    if (u) byUrl.set(u, s);
  }
  const id = (p: string) => String(p).split("|")[0] ?? "";
  const pairToS = new Map<string, string>();
  for (const p of shadow) {
    const s = byUrl.get(p.originUrl);
    if (s) pairToS.set(id(p.pairId), s);
  }
  const gtByPair = new Map(shadow.map((p) => [id(p.pairId), p]));
  return { gt, shadow, coord, a22, kw, pairToS, gtByPair, id };
};

/**
 * 🔴🔴 **최신 GT 와 과거 라벨을 «섞지 않는다»**(CPO ⑤).
 *    `ceoLatest` 가 있으면 그것이 truth 고, 없으면 **「최신 판정 없음」** 으로 적는다 —
 *    🔴 `priorGt` 를 최신 truth 처럼 쓰지 않는다.
 */
const latestGt = (p: PairA | undefined) => ({
  label: p?.ceoLatest ?? null,
  priorLabel: p?.priorGt ?? null,
  source: p?.ceoLatest ? "CEO_LATEST" : "NO_LATEST_JUDGEMENT",
  superseded: Boolean(p?.ceoLatest && p.priorGt && p.ceoLatest !== p.priorGt),
});

/** 🔴 **타입을 느슨하게 하지 않는다** — 모듈이 선언한 `ExtractInput` 을 그대로 쓴다(tsc 가 잡았다). */
const axesOf = (originInput: ExtractInput, candInput: ExtractInput) => {
  const out: Record<string, { off: string; on: string }> = {};
  for (const axis of ALL_AXES) {
    out[axis] = {
      off: compareAxis(axis, extractKeywords(originInput, GUARDS_OFF), extractKeywords(candInput, GUARDS_OFF)).status,
      on: compareAxis(axis, extractKeywords(originInput, GUARDS_ON), extractKeywords(candInput, GUARDS_ON)).status,
    };
  }
  return out;
};

const tally = (xs: (string | null)[]) =>
  xs.reduce<Record<string, number>>((a, x) => ({ ...a, [x ?? "NO_LABEL"]: (a[x ?? "NO_LABEL"] ?? 0) + 1 }), {});

describe("② A④ 분모 보강 — 양쪽 원문 쌍만(HTTP 0 · 덮어쓰기 0)", () => {
  /* ═══════ ①②③ 조인 근거 — 🔴 URL 단독 금지 · 쌍 단위 유일성 증명 ═══════ */

  it("B-1 🔴🔴 추가 후보의 **쌍 단위 유일성** 을 증명한다(첫 행 임의 선택 금지)", () => {
    const { coord, kw, a22, id } = base();
    const got = new Set(a22.filter((r) => r.hasDescription).map((r) => id(r.pairId)));
    expect(got.size, "🔴 기존 확보분이 7 이 아니다").toBe(7);

    const addable = coord.filter(
      (c) => !got.has(id(c.pairId)) && kw.some((k) => k.candidateUrl === c.candidateUrl && val(k.candidate?.description)),
    );
    expect(addable.length, "🟡 추가 후보 수(확보 수가 아니다)").toBe(4);

    /** 🔴 `pairId` 가 A군에서 유일해야 한다 — 중복이면 어느 쌍인지 가를 수 없다. */
    for (const c of addable) {
      expect(coord.filter((x) => id(x.pairId) === id(c.pairId)), `🔴 ${c.pairId} 쌍이 중복이다`).toHaveLength(1);
    }
    /**
     * 🔴🔴 **후보 URL 이 kw 에서 여러 행일 수 있다**(다른 원상품과 짝). 그때는 첫 행을
     *    집지 않고 **설명문이 하나로 모이는지** 본다 — 갈리면 분모에서 **뺀다**.
     * 🟢 실측: `global.trenbe.com` 은 2행인데 **설명문 고유 1** 이다.
     */
    for (const c of addable) {
      const rows = kw.filter((k) => k.candidateUrl === c.candidateUrl && val(k.candidate?.description));
      const uniq = new Set(rows.map((r) => val(r.candidate?.description)));
      expect(uniq.size, `🔴 ${c.pairId} 의 후보 설명문이 행마다 다르다 — 분모에 넣을 수 없다`).toBe(1);
    }
  });

  /* ═══════ ④⑤⑥ 재측정 — 기존 7쌍과 추가 쌍을 «구분해» 적는다 ═══════ */

  it("B-2 🔵 양쪽 원문 쌍만 축 집계하고 **기존/추가를 구분** 해 보존한다", () => {
    const { gt, coord, a22, kw, pairToS, gtByPair, id } = base();
    const rows: Record<string, unknown>[] = [];

    const originInputOf = (pairId: string) => {
      const s = pairToS.get(pairId);
      if (!s) return null;
      const cp = gt.origins[s]?.canonicalProduct;
      const oDesc = val(cp?.description);
      /** 🔴 원본측 설명문이 없으면 **분모에 넣지 않는다**(억지로 채우지 않는다). */
      if (!cp || !oDesc) return null;
      return {
        s,
        input: {
          title: val(cp.title),
          description: oDesc,
          descriptionKo: val(cp.descriptionKo),
          brand: val(cp.brand),
          color: val(cp.color),
          material: val(cp.material),
          /** 🟢 code 는 **원본 sku** 다 — 쌍 ID 오용을 반복하지 않는다. */
          code: val(cp.sku),
        },
      };
    };

    const push = (
      pairId: string,
      host: string,
      origin: ReturnType<typeof originInputOf>,
      cand: { title: string | null; description: string | null },
      group: "EXISTING_A22" | "ADDED_FROM_B_FIXTURE",
      originCode: string | null,
    ) => {
      if (!origin) return;
      const g = latestGt(gtByPair.get(pairId));
      rows.push({
        pairId,
        /** 🔴 조인 키를 **보존** 한다(③ 흐름 검증이 잡은 결함). */
        originS: origin.s,
        originCodeFromCandidateSource: originCode,
        host,
        group,
        gtLatest: g.label,
        gtPrior: g.priorLabel,
        gtSource: g.source,
        gtSuperseded: g.superseded,
        originDescriptionLength: origin.input.description?.length ?? 0,
        candidateDescriptionLength: cand.description?.length ?? 0,
        axes: axesOf(origin.input, cand),
      });
    };

    /** ⒜ 기존 7쌍 — 출처는 **A22 라이브 수집** 이다. */
    for (const r of a22.filter((x) => x.hasDescription)) {
      const pid = id(r.pairId);
      push(pid, r.host, originInputOf(pid), { title: r.title, description: r.description }, "EXISTING_A22", null);
    }

    /** ⒝ 추가 쌍 — 출처는 **B군 fixture 의 후보 설명문** 이다(새 HTTP 0). */
    const got = new Set(a22.filter((r) => r.hasDescription).map((r) => id(r.pairId)));
    for (const c of coord) {
      const pid = id(c.pairId);
      if (got.has(pid)) continue;
      const hits = kw.filter((k) => k.candidateUrl === c.candidateUrl && val(k.candidate?.description));
      if (hits.length === 0) continue;
      const uniq = new Set(hits.map((r) => val(r.candidate?.description)));
      /** 🔴 설명문이 갈리면 **넣지 않는다**. */
      if (uniq.size !== 1) continue;
      push(
        pid,
        new URL(c.candidateUrl).hostname,
        originInputOf(pid),
        { title: hits[0].candidate?.title ?? null, description: val(hits[0].candidate?.description) },
        "ADDED_FROM_B_FIXTURE",
        hits[0].originCode ?? null,
      );
    }

    const grp = (g: string) => rows.filter((r) => r.group === g);
    const axisTally = (rs: Record<string, unknown>[], mode: "off" | "on") =>
      Object.fromEntries(
        ALL_AXES.map((axis) => [
          axis,
          tally(rs.map((r) => (r.axes as Record<string, Record<string, string>>)[axis]?.[mode] ?? null)),
        ]),
      );
    const byGt = (rs: Record<string, unknown>[]) =>
      Object.fromEntries(
        [...new Set(rs.map((r) => (r.gtLatest as string | null) ?? "NO_LABEL"))].map((label) => [
          label,
          {
            n: rs.filter((r) => ((r.gtLatest as string | null) ?? "NO_LABEL") === label).length,
            /** 🔴 DESIGN·PRODUCT_TYPE 이 GT DIFFERENT 를 가르지 못한다는 기존 결론을 다시 본다. */
            design: tally(rs.filter((r) => ((r.gtLatest as string | null) ?? "NO_LABEL") === label).map((r) => (r.axes as Record<string, Record<string, string>>).DESIGN?.off ?? null)),
            productType: tally(rs.filter((r) => ((r.gtLatest as string | null) ?? "NO_LABEL") === label).map((r) => (r.axes as Record<string, Record<string, string>>).PRODUCT_TYPE?.off ?? null)),
            modelCode: tally(rs.filter((r) => ((r.gtLatest as string | null) ?? "NO_LABEL") === label).map((r) => (r.axes as Record<string, Record<string, string>>).MODEL_CODE?.off ?? null)),
          },
        ]),
      );

    const guardChanged = rows.filter((r) =>
      ALL_AXES.some((a) => {
        const ax = (r.axes as Record<string, Record<string, string>>)[a];
        return ax && ax.off !== ax.on;
      }),
    ).length;

    const prior = read(A07) as { denominator: Record<string, number>; gtDistribution: Record<string, number> };

    const out = {
      note:
        "🔴 평가 전용 — 새 HTTP 0 · 운영 변경 0 · verdict 재계산 0 · **기존 산출물 덮어쓰기 0**. " +
        "🔴 목표는 11 이 아니라 **양쪽 원문이 실제로 있는 쌍** 이다. " +
        "🔴 `ceoLatest` 가 없는 쌍은 **NO_LATEST_JUDGEMENT** 로 적고 과거 라벨을 truth 로 쓰지 않는다.",
      priorArtifact: { file: "preserved/a07-both-fulltext-axes.json", denominator: prior.denominator, gtDistribution: prior.gtDistribution },
      denominator: {
        aGroupPairs: coord.length,
        existingFromA22: grp("EXISTING_A22").length,
        addedFromBFixture: grp("ADDED_FROM_B_FIXTURE").length,
        total: rows.length,
        addableCandidates: 4,
        note: "🔴 「추가 후보 4」와 「실제 추가」를 구분한다 — 원본측 설명문이 없으면 넣지 않는다",
      },
      gtLatest: {
        all: tally(rows.map((r) => (r.gtLatest as string | null) ?? null)),
        existing: tally(grp("EXISTING_A22").map((r) => (r.gtLatest as string | null) ?? null)),
        added: tally(grp("ADDED_FROM_B_FIXTURE").map((r) => (r.gtLatest as string | null) ?? null)),
        supersededPairs: rows.filter((r) => r.gtSuperseded).map((r) => ({ pairId: r.pairId, prior: r.gtPrior, latest: r.gtLatest })),
        labelSource: tally(rows.map((r) => r.gtSource as string)),
      },
      axisTallyGuardsOff: axisTally(rows, "off"),
      axisTallyGuardsOn: axisTally(rows, "on"),
      guardChangedPairs: guardChanged,
      byGtLatest: { all: byGt(rows), existing: byGt(grp("EXISTING_A22")), added: byGt(grp("ADDED_FROM_B_FIXTURE")) },
      /**
       * 🟢 **쌍 단위 행을 보존한다** — ③ 흐름 검증이 「산출물이 조인 키를 버리면 되짚을 수
       *    없다」를 잡았다. 🔴 원문은 넣지 않고 **길이와 축** 만 적는다.
       */
      rows,
      limitations: [
        "🔴 추가 쌍의 후보 설명문은 **B군 fixture** 출처다 — 수집 시점이 A22 와 다르다(원문 동일성 보장 없음)",
        "🔴 A군 33 중 양쪽 원문이 없는 쌍은 **여전히 비교 불가** 다(0% 로 적지 않는다)",
        "🔴 `ceoLatest` 없는 쌍은 안전성 판정 분모에 넣지 않는다",
      ],
      leverRejectionUnchanged:
        "🔴 상세설명 품번 레버의 거부 근거는 **A 평가(IDENTITY_AXIS 26쌍 · cemarose.ca · tinyapple.net)** 에 " +
        "있고 **이 분모가 아니다** ⟹ 이 보강은 그 거부를 **건드리지 않는다**(안전성 기준 완화 0).",
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    /** 🟢 기존 7쌍이 **그대로 7** 이고 추가분과 섞이지 않는다. */
    expect(out.denominator.existingFromA22).toBe(7);
    expect(out.denominator.total).toBe(out.denominator.existingFromA22 + out.denominator.addedFromBFixture);
    /** 🔴 모든 행이 **양쪽 원문** 을 갖는다(한쪽이라도 0 이면 분모 오염이다). */
    expect(rows.every((r) => (r.originDescriptionLength as number) > 0 && (r.candidateDescriptionLength as number) > 0)).toBe(true);
  });

  /* ═══════ 보존 계약 ═══════ */

  it("B-3 🔴🔴 기존 산출물·fixture 를 **덮어쓰지 않았다**", () => {
    const self = readFileSync(path.join(HERE, "a11-fulltext-axes-boosted.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    for (const victim of ["a07-both-fulltext", "a22-candidate", "a33-candidate", "fixtures", "MI-REEVAL", "c-candidate", "a-identity"]) {
      expect(
        new RegExp(`writeFileSync\\([^)]*${victim}`).test(self),
        `🔴 ${victim} 에 쓰려 했다 — 과거 기록 덮어쓰기 금지`,
      ).toBe(false);
    }
    /** 🟢 쓰기 대상이 **새 파일** 임을 상수 선언으로 못 박는다(③ 에서 배운 탐지 함정). */
    expect(self).toContain('"preserved", "a11-fulltext-axes-boosted.json"');
  });

  it("B-4 🔴 금지 레버를 **이 분모에서도 열지 않았다**", () => {
    const self = readFileSync(path.join(HERE, "a11-fulltext-axes-boosted.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    for (const token of [
      ["brandModelCode", " ="],
      ["SAME", "_MIN_AXES"],
      ["judgeDomestic", "Candidate"],
      ["fetchPlain", "Html"],
      ["DATABASE", "_URL"],
    ].map(([a, b]) => `${a}${b}`)) {
      expect(self, `🔴 ${token} — 보강 WU 가 경계를 넘었다`).not.toContain(token);
    }
    /** 🟢 축 비교는 **기존 로직** 이다 — 사본을 만들지 않았다. */
    expect(self).toContain("./mi-reeval-shadow-keywords");
  });
});
