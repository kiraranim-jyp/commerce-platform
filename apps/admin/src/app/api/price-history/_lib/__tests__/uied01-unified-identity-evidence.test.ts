/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UNIFIED-IDENTITY-EVIDENCE-DESIGN-01 — **네 영역 통합 증거 검증**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 확인 기준 — 「브랜드·품번·상품명·상세설명 **네 영역 중 하나라도 빠지면 미완**」.
 *    그래서 이 파일은 **한 행에 네 축을 같이** 세운다(품번 보고서가 아니다).
 * 🔴 조사·설계 전용 — 운영 코드 0 · schema 0 · migration 0 · backfill 0 ·
 *    `candidate_reviews` 쓰기 0 · 후보 재관측 0(**HTTP 0**) · SAME 기준·blocker 0 ·
 *    상세설명 운영 판정 연결 0 · 가격·등록 0.
 * 🟢 입력은 **기존 산출물 넷** 뿐이다(새 상품·새 수집 0).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FIX = join(__dirname, "fixtures");
const DUMP = join(FIX, "uied01-unified.json");
const read = (f: string): unknown => JSON.parse(readFileSync(join(FIX, f), "utf8"));

/**
 * 🔴🔴 **§6 — 상태를 임의로 만들지 않는다.** 기존 운영 타입이
 *    `IDENTITY_EVIDENCE_STATES = ["PRESENT","MISSING","NOT_MEASURED","CONFLICT"]` **넷** 이다.
 * 🟢 CPO 가 쓴 다섯 이름을 그 넷에 **매핑** 한다(새 운영 타입 0):
 * ```
 * CPO            기존 운영 값            뜻
 * MATCH          PRESENT                양쪽 있고 **호환**(axisValuesCompatible true)
 * CONFLICT       CONFLICT               양쪽 있고 **호환 안 됨**(conflictBasis 가 붙는다)
 * UNKNOWN        MISSING                한쪽/양쪽이 **값이 없다**(관찰은 했다)
 * NOT_MEASURED   NOT_MEASURED           🔴 **잴 기회가 없었다** — 「없다」가 아니다
 * EXTRACTION_FAILED  🔴 **기존 타입에 없다**  ⟹ 아래 술어로 **관찰만** 한다(운영 타입 0)
 * ```
 * 🔴 `EXTRACTION_FAILED` 는 운영 타입이 아니므로 **구조화 칸이 비었는데 원문 관찰은 있는**
 *    모양으로 «유도» 한다. 🔴 그것을 판정으로 쓰지 않는다.
 */
const STATE_MAP = {
  MATCH: "PRESENT",
  CONFLICT: "CONFLICT",
  UNKNOWN: "MISSING",
  NOT_MEASURED: "NOT_MEASURED",
} as const;

type AxisKey = "BRAND" | "MODEL_CODE" | "PRODUCT_NAME";

interface AxisValue {
  raw: string;
  normalized: string;
  source: "TITLE" | "DESCRIPTION" | "IMAGE";
}
interface AxisSummary {
  axis: string;
  originState: string;
  candidateState: string;
  comparison: string;
  origin: AxisValue[];
  candidate: AxisValue[];
  conflictBasis: string | null;
}

/** 🟢 CPO §9-B — **한 행에 네 영역**. 🔴 구조화 값과 원문 관찰값을 **합치지 않는다**. */
interface UnifiedRow {
  group: string;
  originTitle: string | null;
  domain: string;
  /** ── A. 브랜드 ── */
  brand: {
    originStructured: string | null;
    candidateStructured: string | null;
    axis: { comparison: string; origin: AxisValue[]; candidate: AxisValue[]; conflictBasis: string | null } | null;
    descriptionHit: { found: boolean; excerpt: string | null } | null;
    extractionFailed: boolean;
  };
  /** ── B. 품번 ── */
  code: {
    originDbSku: string | null;
    originUrlSlug: string | null;
    candidateStructured: string | null;
    axis: { comparison: string; origin: AxisValue[]; candidate: AxisValue[] } | null;
    descriptionHit: { found: boolean; excerpt: string | null } | null;
    variantScope: "FULL_VARIANT" | "BASE_ONLY" | "UNKNOWN";
  };
  /** ── C. 상품명 ── */
  name: {
    originStructured: string | null;
    candidateStructured: string | null;
    axis: { comparison: string; origin: AxisValue[]; candidate: AxisValue[] } | null;
    descriptionHit: { found: boolean; excerpt: string | null } | null;
    encodingDamaged: boolean;
    multilingual: boolean;
  };
  /** ── D. 상세설명 ── */
  description: { length: number; available: boolean };
  /** 기존 운영 판정(🔴 재검토 대상이 아니라 **대조군** 이다) */
  stored: { verdict: string | null; tier: string | null; blockers: string[] };
  /** §4 시나리오 번호(1~10) */
  scenario: number;
  scenarioLabel: string;
}

/** 🔴 **인코딩 손상** 판정 — 치환문자/제어문자 비율로만 본다(복원하지 않는다). */
const damaged = (s: string | null | undefined): boolean => {
  if (!s) return false;
  const bad = (s.match(/[�-]/g) ?? []).length;
  return bad > 0 && bad / s.length > 0.1;
};
/** 🔴 **다국어** — 한글/가나/한자가 섞였는가. 번역하지 않는다. */
const multilingual = (s: string | null | undefined): boolean =>
  Boolean(s && /[ㄱ-힝぀-ヿ一-鿿]/.test(s));

const canon = (s: string | null | undefined) => (s ? s.toUpperCase().replace(/[^A-Z0-9]/g, "") : null);

describe("UIED01 — 브랜드·품번·상품명·상세설명 통합 증거", () => {
  /* ═══ §2. 기존 구조로 표현 가능한가 — 🟢 네 영역 경로를 코드에서 확인 ═════ */

  it("A-1 🟢🟢 **네 영역의 생성·전달 경로가 모두 기존 구조에 있다**(새 구조 0)", () => {
    const LIB = join(__dirname, "..");
    const CRAWLER = join(LIB, "..", "..", "..", "..", "..", "..", "..", "packages", "crawler", "src", "comparison-search");
    const SHARED = join(LIB, "..", "..", "..", "..", "..", "..", "..", "packages", "shared", "src");
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

    /** ① 구조화 세 칸 — `ProductFacts` 가 **셋 다** 들고 있다. */
    const facts = strip(readFileSync(join(SHARED, "product-facts.ts"), "utf8"));
    for (const f of ["brand:", "brandModelCode:", "title:"]) {
      expect(facts, `🔴 구조화 칸이 사라졌다: ${f}`).toContain(f);
    }
    /** ② 원문 관찰값 — `evidence` 맵과 `EvidenceSource` 셋. */
    expect(facts, "🔴 원문 관찰 맵이 없다").toContain("evidence?");
    expect(facts).toContain('export type EvidenceSource = "TITLE" | "DESCRIPTION" | "IMAGE"');
    /** ③ 축별 대조 — 세 축이 **같은 요약기** 에 있다. */
    const sum = strip(readFileSync(join(CRAWLER, "identity-evidence-summary.ts"), "utf8"));
    expect(sum).toContain("IDENTITY_EVIDENCE_AXES");
    expect(sum).toContain("AxisEvidenceValue");
    /** ④ 상세설명 — 원문 칸이 `facts.description` 이다(별도 추출기 없이 실린다). */
    expect(facts, "🔴 상세설명 원문 칸이 없다").toContain("description?");
    /** 🟢 전달 — STEP 1 이 확인한 그 세 줄. */
    const runner = strip(readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8"));
    /** 🔵 UIED-02 가 같은 칸에 `observedAt` 을 더했다 — 배열 배선은 그대로다. */
    expect(runner).toContain("identityEvidence: { candidates: identityEvidenceRows,");
    /**
     * 🔵🔵 UIED-02 — **§A 가 적은 「상세설명만 응답 칸이 없다」가 닫혔다.**
     * 🔴 그래서 이 계약의 방향을 뒤집는다 — 이제 **있어야** 한다.
     */
    expect(runner, "🔴 상세설명 원문 전달이 사라졌다").toContain("raw: candidateDescription ?? null");
  });

  it("A-2 🔴🔴 **상태 다섯을 기존 넷에 매핑했다** — 운영 타입을 늘리지 않았다", () => {
    /**
     * 🔴🔴 **파일을 추측했다가 틀렸다** — 1차에 이 상수를 `shared/product-facts.ts`
     *    에서 찾았고 **거기 없었다**. 🟢 실제 owner 는 crawler 의 요약기다(이 저장소에서
     *    「칸·파일 위치를 추측하면 틀린다」가 반복된 그 함정이다).
     */
    const CRAWLER = join(
      __dirname, "..", "..", "..", "..", "..", "..", "..", "..",
      "packages", "crawler", "src", "comparison-search",
    );
    const sum = readFileSync(join(CRAWLER, "identity-evidence-summary.ts"), "utf8");
    expect(sum, "🔴 기존 상태 집합이 바뀌었다").toContain(
      'IDENTITY_EVIDENCE_STATES = ["PRESENT", "MISSING", "NOT_MEASURED", "CONFLICT"]',
    );
    /** 🔴 내 매핑이 그 넷을 넘지 않는다. */
    for (const v of Object.values(STATE_MAP)) {
      expect(["PRESENT", "MISSING", "NOT_MEASURED", "CONFLICT"]).toContain(v);
    }
    /** 🔴 `EXTRACTION_FAILED` 는 **운영 타입에 없다** — 유도 관찰로만 쓴다. */
    expect(sum, "🔴 운영 타입이 늘어났다").not.toContain(["EXTRACTION", "FAILED"].join("_"));
  });

  /* ═══ §3·§4. 통합 비교표 + 10 시나리오 — 🟢 기존 산출물만 ═══════════════ */

  it("B-1 🟢🟢 통합 비교표 조립 — 네 영역 한 행 · 여러 상품군 · 10 시나리오 분류", () => {
    const cap = read("mic01-candidate-originals.json") as {
      rows: { url: string; status: string; facts: Record<string, unknown> | null; title: string | null }[];
      identityEvidence: { domain: string; evidence: { axes: AxisSummary[] } | null }[];
    };
    const reass = read("mier01-reassessment.json") as {
      origin: { brandRaw: string | null; codeRaw: string | null; titleRaw: string | null };
      rows: {
        domain: string;
        candidate: {
          titleRaw: string | null;
          brandRaw: string | null;
          codeRaw: string | null;
          descriptionRaw: string | null;
          descriptionLength: number;
        };
        stored: { verdict: string | null; priceTier: string | null; blockers: string[] };
        hitsInDescription: { key: string; found: boolean; excerpts: string[] }[];
      }[];
    };
    const second = read("mmse01-secondpass.json") as {
      rows: {
        group: string;
        originTitle: string | null;
        originBrand: string | null;
        originSku: string | null;
        domain: string | null;
        firstPass: { state: string; brand: string; code: string };
        stored: { verdict: string | null; tier: string | null; market: string | null };
        live: {
          titleRaw: string | null;
          brandRaw: string | null;
          codeRaw: string | null;
          descriptionLength: number;
          originCodeInCandidate: { found: boolean; excerpt: string | null };
          originBrandInCandidate: { found: boolean; excerpt: string | null };
        };
      }[];
    };
    const codeEv = read("mmse02-code-evidence.json") as {
      match: { domain: string | null; originDbSku: string | null; originUrlCode: string | null }[];
      conflict: { domain: string | null; originDbSku: string | null; originUrlCode: string | null }[];
    };

    const axisOf = (domain: string, axis: AxisKey): AxisSummary | null => {
      const e = cap.identityEvidence.find((x) => x.domain.replace(/^www\./, "") === domain.replace(/^www\./, ""));
      return e?.evidence?.axes.find((a) => a.axis === axis) ?? null;
    };
    const hit = (r: (typeof reass.rows)[number] | undefined, key: string) => {
      const h = r?.hitsInDescription.find((x) => x.key === key);
      return h ? { found: h.found, excerpt: h.excerpts[0] ?? null } : null;
    };

    const rows: UnifiedRow[] = [];

    /* ── 상품군 ①: 의류-상의(Bobo Choses Pop sweatshirt) — 네 영역 전부 확보 ── */
    for (const r of reass.rows) {
      const d = r.domain.replace(/^www\./, "");
      const ce = [...codeEv.match, ...codeEv.conflict].find((x) => (x.domain ?? "").replace(/^www\./, "") === d);
      const brandAxis = axisOf(d, "BRAND");
      const codeAxis = axisOf(d, "MODEL_CODE");
      const nameAxis = axisOf(d, "PRODUCT_NAME");
      rows.push({
        group: "의류-상의",
        originTitle: reass.origin.titleRaw,
        domain: d,
        brand: {
          originStructured: reass.origin.brandRaw,
          candidateStructured: r.candidate.brandRaw,
          axis: brandAxis
            ? {
                comparison: brandAxis.comparison,
                origin: brandAxis.origin,
                candidate: brandAxis.candidate,
                conflictBasis: brandAxis.conflictBasis,
              }
            : null,
          descriptionHit: hit(r, "BRAND_BOBO_CHOSES"),
          /** 🔴 **추출 실패 유도** — 구조화 칸은 비었는데 상세설명엔 있다. */
          extractionFailed:
            !r.candidate.brandRaw && Boolean(hit(r, "BRAND_BOBO_CHOSES")?.found),
        },
        code: {
          originDbSku: ce?.originDbSku ?? null,
          originUrlSlug: ce?.originUrlCode ?? null,
          candidateStructured: r.candidate.codeRaw,
          axis: codeAxis
            ? { comparison: codeAxis.comparison, origin: codeAxis.origin, candidate: codeAxis.candidate }
            : null,
          descriptionHit: hit(r, "CODE_B226AC033"),
          /** 🔴 변형 접미가 없으면 **기본 모델만** 가리킨다(Wynken 실증). */
          variantScope: /[-_][0-9]{2,4}$/.test(r.candidate.codeRaw ?? "")
            ? "FULL_VARIANT"
            : r.candidate.codeRaw
              ? "BASE_ONLY"
              : "UNKNOWN",
        },
        name: {
          originStructured: reass.origin.titleRaw,
          candidateStructured: r.candidate.titleRaw,
          axis: nameAxis
            ? { comparison: nameAxis.comparison, origin: nameAxis.origin, candidate: nameAxis.candidate }
            : null,
          descriptionHit: hit(r, "NAME_POP_SWEATSHIRT"),
          encodingDamaged: damaged(r.candidate.titleRaw) || damaged(r.candidate.descriptionRaw),
          multilingual: multilingual(r.candidate.titleRaw),
        },
        description: { length: r.candidate.descriptionLength, available: r.candidate.descriptionLength > 0 },
        stored: { verdict: r.stored.verdict, tier: r.stored.priceTier, blockers: r.stored.blockers },
        scenario: 0,
        scenarioLabel: "",
      });
    }

    /* ── 상품군 ②~⑤: 원피스·하의·아웃터·모자 — 🔴 축 요약은 없다(미확보로 적는다) ── */
    for (const r of second.rows) {
      rows.push({
        group: r.group,
        originTitle: r.originTitle,
        domain: r.domain ?? "(도메인 없음)",
        brand: {
          originStructured: r.originBrand,
          candidateStructured: r.live.brandRaw,
          /** 🔴 이 상품군은 **축 요약을 확보하지 못했다** — null 로 적고 추정하지 않는다. */
          axis: null,
          descriptionHit: r.live.originBrandInCandidate,
          extractionFailed: !r.live.brandRaw && r.live.originBrandInCandidate.found,
        },
        code: {
          originDbSku: r.originSku,
          originUrlSlug: null,
          candidateStructured: r.live.codeRaw,
          axis: null,
          descriptionHit: r.live.originCodeInCandidate,
          variantScope: /[-_][0-9]{2,4}$/.test(r.live.codeRaw ?? "")
            ? "FULL_VARIANT"
            : r.live.codeRaw
              ? "BASE_ONLY"
              : "UNKNOWN",
        },
        name: {
          originStructured: r.originTitle,
          candidateStructured: r.live.titleRaw,
          axis: null,
          descriptionHit: null,
          encodingDamaged: damaged(r.live.titleRaw),
          multilingual: multilingual(r.live.titleRaw),
        },
        description: { length: r.live.descriptionLength, available: r.live.descriptionLength > 0 },
        stored: { verdict: r.stored.verdict, tier: r.stored.tier, blockers: [] },
        scenario: 0,
        scenarioLabel: "",
      });
    }

    /* ── §4. 10 시나리오 분류 — 🔴 승격하지 않는다. 분류만 한다. ───────────── */
    const SCEN: { n: number; label: string; test: (r: UnifiedRow) => boolean }[] = [
      {
        n: 8,
        label: "브랜드가 실제로 다른 상품",
        test: (r) =>
          Boolean(r.brand.candidateStructured) &&
          Boolean(r.brand.originStructured) &&
          canon(r.brand.candidateStructured) !== canon(r.brand.originStructured) &&
          !r.brand.descriptionHit?.found,
      },
      {
        n: 7,
        label: "품번 일치 · 색상·변형 충돌",
        test: (r) =>
          canon(r.code.candidateStructured) === canon(r.code.originDbSku) &&
          Boolean(r.code.candidateStructured) &&
          r.code.variantScope !== "FULL_VARIANT" &&
          /blue|ecru|navy|midnight/i.test(`${r.name.originStructured ?? ""} ${r.name.candidateStructured ?? ""}`) &&
          canon(r.name.originStructured) !== canon(r.name.candidateStructured),
      },
      {
        n: 1,
        label: "브랜드·품번·상품명 모두 일치",
        test: (r) =>
          canon(r.brand.candidateStructured) === canon(r.brand.originStructured) &&
          Boolean(r.brand.candidateStructured) &&
          Boolean(r.code.candidateStructured) &&
          r.name.axis?.comparison === "PRESENT",
      },
      {
        n: 4,
        label: "구조화 브랜드 불일치 · 상세설명에서 기준 브랜드 확인",
        test: (r) =>
          Boolean(r.brand.candidateStructured) &&
          canon(r.brand.candidateStructured) !== canon(r.brand.originStructured) &&
          Boolean(r.brand.descriptionHit?.found),
      },
      {
        n: 5,
        label: "구조화 품번 누락 · 상세설명에서 기준 품번 확인",
        test: (r) => !r.code.candidateStructured && Boolean(r.code.descriptionHit?.found),
      },
      {
        n: 6,
        label: "구조화 상품명 불일치 · 상세설명에서 기준 상품명 확인",
        test: (r) => Boolean(r.name.descriptionHit?.found) && r.name.axis?.comparison !== "PRESENT",
      },
      {
        n: 3,
        label: "품번 일치 · 상품명 다국어 차이",
        test: (r) => Boolean(r.code.descriptionHit?.found || r.code.candidateStructured) && r.name.multilingual,
      },
      {
        n: 10,
        label: "상세설명에 기준 브랜드가 단순 언급(구조화 브랜드 없음)",
        test: (r) => r.brand.extractionFailed,
      },
      {
        n: 2,
        label: "브랜드·상품명 일치 · 품번 없음",
        test: (r) =>
          canon(r.brand.candidateStructured) === canon(r.brand.originStructured) &&
          Boolean(r.brand.candidateStructured) &&
          !r.code.candidateStructured &&
          !r.code.descriptionHit?.found,
      },
      {
        n: 9,
        label: "세 기준 모두 미측정",
        test: (r) =>
          !r.brand.candidateStructured && !r.code.candidateStructured && !r.name.candidateStructured,
      },
    ];
    for (const r of rows) {
      const m = SCEN.find((s) => s.test(r));
      r.scenario = m?.n ?? 0;
      r.scenarioLabel = m?.label ?? "🔴 분류 불가(미확정)";
    }

    const byScenario: Record<string, number> = {};
    for (const r of rows) byScenario[`${r.scenario}`] = (byScenario[`${r.scenario}`] ?? 0) + 1;
    const byGroup: Record<string, number> = {};
    for (const r of rows) byGroup[r.group] = (byGroup[r.group] ?? 0) + 1;

    writeFileSync(
      DUMP,
      JSON.stringify(
        {
          note:
            "MI-UNIFIED-IDENTITY-EVIDENCE-DESIGN-01 — 브랜드·품번·상품명·상세설명 통합 비교표. " +
            "기존 산출물 넷만 재사용 · HTTP 0 · 승격 0 · 판정 변경 0.",
          stateMapping: STATE_MAP,
          baseline: { candidates: 364, origins: 122, operationalSame: 83, humanLabels: 22 },
          byGroup,
          byScenario,
          rows,
        },
        null,
        1,
      ),
      "utf8",
    );

    /* eslint-disable no-console */
    console.log("\n═══ 통합 비교표 — 상품군 분포 ═══");
    console.log("  " + JSON.stringify(byGroup));
    console.log("═══ §4 시나리오 분포(1~10 · 0=분류 불가) ═══");
    console.log("  " + JSON.stringify(byScenario));
    console.log("\n═══ 한 행에 네 영역 ═══");
    console.log(
      ["상품군".padEnd(12), "후보".padEnd(22), "브랜드(구조화/축/설명)", "품번(DB/구조화/설명/변형)", "상품명(축/다국어/손상)", "설명", "기존", "시나리오"].join(" | "),
    );
    for (const r of rows) {
      console.log(
        [
          r.group.padEnd(12),
          r.domain.slice(0, 22).padEnd(22),
          `${r.brand.candidateStructured ?? "-"}/${r.brand.axis?.comparison ?? "미확보"}/${r.brand.descriptionHit?.found ? "O" : "-"}`.padEnd(30),
          `${r.code.originDbSku ?? "-"}|${r.code.candidateStructured ?? "-"}/${r.code.descriptionHit?.found ? "O" : "-"}/${r.code.variantScope}`.padEnd(34),
          `${r.name.axis?.comparison ?? "미확보"}/${r.name.multilingual ? "다국어" : "-"}/${r.name.encodingDamaged ? "손상" : "-"}`.padEnd(22),
          String(r.description.length).padStart(5),
          `${r.stored.verdict ?? "-"}`.padEnd(14),
          `#${r.scenario} ${r.scenarioLabel}`,
        ].join(" | "),
      );
    }
    /* eslint-enable no-console */

    /** 🔴 분모를 잠근다 — 상품군 **다섯** · 행 **17**. */
    expect(rows).toHaveLength(17);
    expect(Object.keys(byGroup).length, "🔴 상품군이 둘 이하면 「다수 상품군」이 아니다").toBeGreaterThanOrEqual(4);
    /** 🔴 네 영역이 **행마다** 칸을 갖는다(하나라도 빠지면 FAIL · CPO 확인 기준). */
    for (const r of rows) {
      expect(r.brand, `🔴 ${r.domain} 브랜드 영역이 없다`).toBeTruthy();
      expect(r.code, `🔴 ${r.domain} 품번 영역이 없다`).toBeTruthy();
      expect(r.name, `🔴 ${r.domain} 상품명 영역이 없다`).toBeTruthy();
      expect(r.description, `🔴 ${r.domain} 상세설명 영역이 없다`).toBeTruthy();
    }
    /**
     * 🔴🔴 **위 네 줄만으로는 부족하다 — 음성 대조 M2 가 통과했다.**
     *    상세설명을 `{length:0, available:false}` 로 **비워도** 객체는 truthy 라
     *    「영역이 있다」가 성립했다. ⟹ 🟢 **실측값으로** 잠근다(아래는 관측된 수다).
     */
    const withBrand = rows.filter((r) => r.brand.candidateStructured != null).length;
    const withCode = rows.filter((r) => r.code.candidateStructured != null || r.code.originDbSku != null).length;
    const withNameAxis = rows.filter((r) => r.name.axis != null).length;
    const withDesc = rows.filter((r) => r.description.available).length;
    const descChars = rows.reduce((a, r) => a + r.description.length, 0);
    expect(withBrand, "🔴 브랜드 영역이 비었다").toBeGreaterThanOrEqual(10);
    expect(withCode, "🔴 품번 영역이 비었다").toBeGreaterThanOrEqual(5);
    expect(withNameAxis, "🔴 상품명 축이 비었다").toBeGreaterThanOrEqual(5);
    expect(withDesc, "🔴 상세설명 영역이 비었다").toBeGreaterThanOrEqual(10);
    expect(descChars, "🔴 상세설명 원문이 실리지 않았다").toBeGreaterThan(5_000);
  });

  /* ═══ §7. 소비처 비개입 — 🔴 이 조사가 운영에 닿지 않는다 ═══════════════ */

  it("C-1 🔴 이 파일은 **운영 판정·가격·등록을 부르지 않는다**", () => {
    const src = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const banned of [
      ["compute", "MarketIntelligence"].join(""),
      ["price", "TierFromLink"].join(""),
      ["attach", "MatchTruth"].join(""),
      ["compare", "CrossSellerProducts"].join(""),
      /** 🔴 **자기참조 함정 — 이 세션 네 번째다.** 금지어를 그대로 적으면 자신을 잡는다. */
      ["candidate", "reviews"].join("_"),
    ]) {
      expect(src, `🔴 운영 경로를 끌어왔다: ${banned}`).not.toContain(banned);
    }
    /** 🟢 입력은 **기존 산출물 넷** 뿐이다(라이브 수집 0). */
    expect(src).toContain('read("mic01-candidate-originals.json")');
    expect(src).toContain('read("mier01-reassessment.json")');
    expect(src).toContain('read("mmse01-secondpass.json")');
    expect(src).toContain('read("mmse02-code-evidence.json")');
    /** 🔴 **자기참조 함정 — 다섯 번째다.** 금지어를 그대로 적으면 자신을 잡는다. */
    expect(src, "🔴 라이브 수집을 했다").not.toContain(["facts", "FromProductUrl"].join(""));
  });
});
