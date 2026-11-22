/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UNIFIED-IDENTITY-EVIDENCE-03 — **추출 실패 ↔ 원문 부재 구분 조사**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사·설계 전용.** 운영 코드 0 · 배포 0 · DB/schema/migration/backfill 0 ·
 *    새 크롤러 0 · **추가 HTTP 0** · 추출 임계값·판정 정책 0 · SAME 승격 0 · UI 0 ·
 *    **새 운영 상태 타입 0**.
 *
 * 🔵 CPO 핵심 질문 — 「**현재 데이터만으로 실패와 부재를 실제로 구별할 수 있는가**」.
 *
 * 🔴🔴 **import 안전 규칙** — 이 세션에서 **미추적 모듈을 import 해 배포가 깨졌다**
 *    (`brand-description-evidence` · `product-name-description-evidence` 는
 *     `git ls-files` 에 **없다**). 🟢 그래서 **추적된 모듈만** 쓴다:
 *    `brand-alias.ts`(findBrandAliasMentions) · `model-code-from-detail.ts`.
 *
 * 🔴 coupleshot 은 **관측 사례 하나** 다 — 일반 실패 유형으로 확대하지 않는다(CPO 명시).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";
import { extractDetailModelCodes } from "@commerce/crawler/src/comparison-search/model-code-from-detail";

const FIX = join(__dirname, "fixtures");
const read = (f: string): unknown => JSON.parse(readFileSync(join(FIX, f), "utf8"));

/**
 * 🔵 CPO §2 의 다섯 상황. 🔴 **운영 타입이 아니다** — 이 조사가 쓰는 **분류 라벨** 이고
 *    기존 넷(`PRESENT`/`MISSING`/`NOT_MEASURED`/`CONFLICT`)의 의미를 바꾸지 않는다.
 */
const SITUATION = {
  /** ① 원문이 있고 그 식별 정보가 **실제로 없다**. */
  ABSENT_IN_TEXT: "원문 있음 · 증거 실제 부재",
  /** ② 원문이 있고 **그 안에 증거가 있는데** 관측·추출이 실패했다. */
  EXTRACTION_FAILED: "원문 있음 · 증거 있음 · 추출 실패",
  /** ③ 원문 자체가 없거나 수집되지 않았다. */
  NO_SOURCE_TEXT: "원문 자체 없음",
  /** ④ 그 영역을 측정하지 않았다. */
  NOT_MEASURED: "미측정",
  /**
   * 🔴🔴 **CPO ⑤ 를 둘로 갈랐다 — 내 1차 라벨이 거짓이었다.**
   * 운영 `CONFLICT` 는 「**원상품 ↔ 후보** 값이 호환 안 됨」이고,
   * CPO ⑤(「복수 관측값이 충돌함」)는 「**한쪽 안에서** 값이 여러 개이고 서로 다름」이다.
   * 🔴 둘을 한 라벨로 적으면 숫자가 조용히 틀린다.
   */
  CROSS_CONFLICT: "원상품 ↔ 후보 값 불일치(운영 CONFLICT)",
  MULTI_VALUE_CONFLICT: "한쪽 내 복수 관측값 충돌",
  /**
   * 🔴 **그 질문의 분모가 아니다** — 축이 이미 `PRESENT` 이거나, 그 영역이
   *    「원문 수집 여부」자체인 경우. 🔴 1차에 이 줄들을 「증거 실제 부재」로 적었고
   *    그것은 **거짓 서술** 이었다.
   */
  NOT_APPLICABLE: "해당 없음(분모 밖)",
  /** 🔴 분류 불가 — 추정으로 채우지 않는다. */
  UNDECIDABLE: "🔴 구분 불가(미확정)",
} as const;

type Situation = (typeof SITUATION)[keyof typeof SITUATION];

interface AxisRow {
  domain: string;
  area: "BRAND" | "MODEL_CODE" | "PRODUCT_NAME" | "DESCRIPTION";
  /** 운영 축 상태(그대로) */
  axisComparison: string | null;
  /** 원문 유무 — 🔴 「없음」과 「비었음」을 가른다 */
  titlePresent: boolean;
  descPresent: boolean;
  /** 구조화 칸(별도 취급 · CPO §5) */
  structured: string | null;
  /** 🟢 **관찰 전용 재검색** — 원문에 기준값이 실제로 있는가 */
  foundInText: boolean;
  foundWhere: ("TITLE" | "DESCRIPTION")[];
  excerpt: string | null;
  /** 🔴 형식 문제 관측 */
  encodingDamaged: boolean;
  multilingual: boolean;
  situation: Situation;
}

/** 🔴 인코딩 손상 — 치환문자 비율로만 본다(복원하지 않는다). */
const damaged = (s: string | null | undefined): boolean => {
  if (!s) return false;
  /** 🔴 U+FFFD(치환문자) 와 **제어문자** 를 코드포인트로만 센다. */
  const bad = (s.match(/[\uFFFD\u0000-\u0008\u000E-\u001F]/g) ?? []).length;
  return bad > 0 && bad / s.length > 0.02;
};
/** 🔴 다국어 — 한글/가나/한자가 섞였는가. 번역하지 않는다. */
const multi = (s: string | null | undefined): boolean =>
  Boolean(s && /[\u3131-\uD79D\u3040-\u30FF\u4E00-\u9FFF]/.test(s));

const excerptAround = (text: string, needle: string): string => {
  const i = text.toUpperCase().indexOf(needle.toUpperCase());
  if (i < 0) return "";
  return text.slice(Math.max(0, i - 40), Math.min(text.length, i + needle.length + 40)).replace(/\s+/g, " ").trim();
};

describe("UIED03 — 추출 실패 ↔ 원문 부재 구분", () => {
  /* ═══ §1. 네 영역의 실제 추출·관측 경로 ═══════════════════════════════════ */

  it("A-1 🟢🟢 **네 영역의 추출 규칙을 코드에서 확정한다**(추정 0)", () => {
    const CS = join(
      __dirname, "..", "..", "..", "..", "..", "..", "..", "..",
      "packages", "crawler", "src", "comparison-search",
    );
    /** 🔴 `product-evidence.ts` 는 NUL 바이트가 섞여 있어 `replace` 로 읽는다. */
    const ev = readFileSync(join(CS, "product-evidence.ts")).toString("utf8");

    /**
     * 🔴🔴 **BRAND 축은 「등록부 alias 조회」 하나에 의존한다** — 그것이 이 WU 의 핵심이다.
     *    `lookupBrandByAliasInTitle` 은 등록부의 **`alias` 칸만** 본다(한글 표기).
     *    ⟹ 라틴 표기(`Bobo Choses`)가 원문에 **있어도** 축은 비어 있을 수 있다.
     */
    expect(ev, "🔴 BRAND 축 생산자가 바뀌었다").toContain('b.add("BRAND", "TITLE", lookupBrandByAliasInTitle(title)');
    expect(ev, "🔴 BRAND 설명 경로가 바뀌었다").toContain('b.add("BRAND", "DESCRIPTION", lookupBrandByAliasInTitle(desc)');
    /** 🔴 MODEL_CODE 는 **승인된 패턴 하나** 다. */
    expect(ev).toContain('b.add("MODEL_CODE", "DESCRIPTION", code)');
    /** 🔴 PRODUCT_NAME 은 라벨 정규식 + 제목. */
    expect(ev).toContain('b.add("PRODUCT_NAME", "DESCRIPTION", PRODUCT_NAME_LABEL_RE.exec(desc)');
    /** 🔴 네 번째 영역(상세설명)은 **축이 아니라 원문 입력** 이다. */
    expect(ev, "🔴 상세설명은 입력이다").toContain("const desc = input.description ?? null;");

    const alias = readFileSync(join(CS, "brand-alias.ts"), "utf8");
    /** 🟢 등록부는 **브랜드 3~4개** 뿐이다(무차별 확장 금지 규칙 때문). */
    const entries = alias.match(/\{ brand: "[^"]+", alias: "[^"]+" \}/g) ?? [];
    expect(entries.length, "🔴 등록부 크기가 크게 바뀌었다").toBeLessThanOrEqual(8);
    /** 🟢 그리고 **두 칸을 다 보는 관찰 전용 함수가 이미 있다**(BRAND-1 · alias 추가 0). */
    expect(alias).toContain("export function findBrandAliasMentions");
    const code = readFileSync(join(CS, "model-code-from-detail.ts"), "utf8");
    expect(code).toContain("export const DETAIL_MODEL_CODE_PATTERN");
  });

  /* ═══ §2·§3. 다섯 상황 분류 + 구분 가능/불가능 ═══════════════════════════ */

  it("B-1 🟢🟢 다섯 상황을 **실측으로 분류한다** — 구분 가능 범위를 가른다", () => {
    const cap = read("mic01-candidate-originals.json") as {
      identityEvidence: {
        url: string;
        domain: string;
        evidence: {
          axes: {
            axis: string;
            comparison: string;
            origin: { normalized: string }[];
            candidate: { normalized: string }[];
          }[];
        } | null;
      }[];
    };
    const reass = read("mier01-reassessment.json") as {
      originCriteria?: Record<string, unknown>;
      origin: { brandRaw: string | null; codeRaw: string | null; titleRaw: string | null };
      rows: {
        domain: string;
        candidate: {
          brandRaw: string | null;
          codeRaw: string | null;
          titleRaw: string | null;
          descriptionRaw: string | null;
        };
      }[];
    };

    const originBrand = reass.origin.brandRaw ?? "";
    const originCode = reass.origin.codeRaw ?? "";
    expect(originBrand, "🔴 기준 브랜드가 없다").not.toBe("");
    expect(originCode, "🔴 기준 품번이 없다").not.toBe("");

    const axisRowOf = (domain: string, axis: string) =>
      cap.identityEvidence.find((e) => e.domain === domain)?.evidence?.axes.find((a) => a.axis === axis) ?? null;
    const axisOf = (domain: string, axis: string): string | null => axisRowOf(domain, axis)?.comparison ?? null;
    /**
     * 🟢 CPO ⑤ — **한쪽 안에서** 관측값이 둘 이상이고 서로 다른가.
     * 🔴 운영 `CONFLICT`(원상품↔후보)와 **다른 질문** 이라 따로 센다.
     */
    const multiValueConflict = (domain: string, axis: string): boolean => {
      const a = axisRowOf(domain, axis);
      if (!a) return false;
      const uniq = (xs: { normalized: string }[]) => new Set(xs.map((x) => x.normalized)).size;
      return uniq(a.origin) > 1 || uniq(a.candidate) > 1;
    };

    const rows: AxisRow[] = [];
    for (const r of reass.rows) {
      const title = r.candidate.titleRaw;
      const desc = r.candidate.descriptionRaw;
      const texts: [("TITLE" | "DESCRIPTION"), string | null][] = [
        ["TITLE", title],
        ["DESCRIPTION", desc],
      ];
      const anyText = Boolean(title) || Boolean(desc);

      /* ── ① BRAND — 🟢 관찰 전용 `findBrandAliasMentions`(등록부 두 칸) ─────── */
      {
        const where: ("TITLE" | "DESCRIPTION")[] = [];
        let excerpt: string | null = null;
        for (const [src, t] of texts) {
          if (!t) continue;
          const hit = findBrandAliasMentions(t).some(
            (m) => m.brand.toLowerCase() === originBrand.toLowerCase(),
          );
          if (hit) {
            where.push(src);
            excerpt ??= excerptAround(t, originBrand) || excerptAround(t, "\uBCF4\uBCF4\uC1FC\uC988");
          }
        }
        const axis = axisOf(r.domain, "BRAND");
        const found = where.length > 0;
        rows.push({
          domain: r.domain,
          area: "BRAND",
          axisComparison: axis,
          titlePresent: Boolean(title),
          descPresent: Boolean(desc),
          structured: r.candidate.brandRaw,
          foundInText: found,
          foundWhere: where,
          excerpt,
          encodingDamaged: damaged(title) || damaged(desc),
          multilingual: multi(title) || multi(desc),
          situation: multiValueConflict(r.domain, "BRAND")
            ? SITUATION.MULTI_VALUE_CONFLICT
            : axis === "CONFLICT"
              ? SITUATION.CROSS_CONFLICT
              : axis == null
                ? SITUATION.NOT_MEASURED
                : axis === "PRESENT"
                  ? SITUATION.NOT_APPLICABLE
                  : !anyText
                    ? SITUATION.NO_SOURCE_TEXT
                    : found
                      ? SITUATION.EXTRACTION_FAILED
                      : SITUATION.ABSENT_IN_TEXT,
        });
      }

      /* ── ② MODEL_CODE — 🟢 승인된 패턴 하나(`extractDetailModelCodes`) ────── */
      {
        const where: ("TITLE" | "DESCRIPTION")[] = [];
        let excerpt: string | null = null;
        for (const [src, t] of texts) {
          if (!t) continue;
          if (extractDetailModelCodes(t).includes(originCode.toUpperCase())) {
            where.push(src);
            excerpt ??= excerptAround(t, originCode);
          }
        }
        const axis = axisOf(r.domain, "MODEL_CODE");
        const found = where.length > 0;
        rows.push({
          domain: r.domain,
          area: "MODEL_CODE",
          axisComparison: axis,
          titlePresent: Boolean(title),
          descPresent: Boolean(desc),
          structured: r.candidate.codeRaw,
          foundInText: found,
          foundWhere: where,
          excerpt,
          encodingDamaged: damaged(title) || damaged(desc),
          multilingual: multi(title) || multi(desc),
          situation: multiValueConflict(r.domain, "MODEL_CODE")
            ? SITUATION.MULTI_VALUE_CONFLICT
            : axis === "CONFLICT"
              ? SITUATION.CROSS_CONFLICT
              : axis == null
                ? SITUATION.NOT_MEASURED
                : axis === "PRESENT"
                  ? SITUATION.NOT_APPLICABLE
                  : !anyText
                    ? SITUATION.NO_SOURCE_TEXT
                    : found
                    ? /**
                       * 🔴🔴 **여기를 「추출 실패」로 단정하지 않는다.**
                       * 후보 쪽 축은 `PRESENT`(후보가 그 품번을 적었다)인데 **원상품 쪽이
                       * 비어** `comparison` 이 `MISSING` 이 되는 모양이 실재한다
                       * (junioredition 실측). ⟹ 그것은 **후보의 추출 실패가 아니다**.
                       */
                      SITUATION.UNDECIDABLE
                    : SITUATION.ABSENT_IN_TEXT,
        });
      }

      /* ── ③ PRODUCT_NAME — 🔴 원문 제목 그대로(새 추출기 0) ────────────────── */
      {
        const axis = axisOf(r.domain, "PRODUCT_NAME");
        rows.push({
          domain: r.domain,
          area: "PRODUCT_NAME",
          axisComparison: axis,
          titlePresent: Boolean(title),
          descPresent: Boolean(desc),
          structured: r.candidate.titleRaw,
          /** 🟢 제목이 있으면 그 축의 **원문은 확보된 것** 이다. */
          foundInText: Boolean(title),
          foundWhere: title ? ["TITLE"] : [],
          excerpt: title ? title.slice(0, 80) : null,
          encodingDamaged: damaged(title),
          multilingual: multi(title),
          situation: multiValueConflict(r.domain, "PRODUCT_NAME")
            ? SITUATION.MULTI_VALUE_CONFLICT
            : axis === "CONFLICT"
              ? SITUATION.CROSS_CONFLICT
              : axis == null
                ? SITUATION.NOT_MEASURED
                : axis === "PRESENT"
                  ? SITUATION.NOT_APPLICABLE
                  : !title
                    ? SITUATION.NO_SOURCE_TEXT
                    : damaged(title)
                      ? SITUATION.EXTRACTION_FAILED
                      : SITUATION.UNDECIDABLE,
        });
      }

      /* ── ④ DESCRIPTION — 🔴 축이 아니라 **원문 그 자체** 다 ───────────────── */
      rows.push({
        domain: r.domain,
        area: "DESCRIPTION",
        axisComparison: null,
        titlePresent: Boolean(title),
        descPresent: Boolean(desc),
        structured: null,
        foundInText: (desc ?? "").length > 0,
        foundWhere: desc ? ["DESCRIPTION"] : [],
        excerpt: desc ? desc.slice(0, 80) : null,
        encodingDamaged: damaged(desc),
        multilingual: multi(desc),
        /**
         * 🔴🔴 이 영역의 질문은 「식별 증거가 있나」가 **아니라** 「원문이 수집됐나」다.
         *    🔴 1차에 확보된 7건을 「증거 실제 부재」로 적었고 **거짓 서술** 이었다.
         */
        situation:
          desc == null
            ? SITUATION.NO_SOURCE_TEXT
            : desc.length === 0
              ? SITUATION.ABSENT_IN_TEXT
              : damaged(desc)
                ? SITUATION.EXTRACTION_FAILED
                : SITUATION.NOT_APPLICABLE,
      });
    }

    /* ── 🔴 「해당 없음」은 실패/부재 질문의 **분모가 아니다** ──────────────── */
    const inScope = rows.filter((r) => r.situation !== SITUATION.NOT_APPLICABLE);

    /* eslint-disable no-console */
    console.log("\n═══ §2 네 영역 × 다섯 상황 (후보 8 × 영역 4 = 32줄) ═══");
    console.log(
      ["영역".padEnd(13), "후보".padEnd(22), "축", "원문(T/D)", "구조화".padEnd(20), "원문재검색", "상황"].join(" | "),
    );
    for (const r of rows) {
      console.log(
        [
          r.area.padEnd(13),
          r.domain.padEnd(22),
          String(r.axisComparison ?? "-").padEnd(13),
          `${r.titlePresent ? "O" : "-"}/${r.descPresent ? "O" : "-"}`.padEnd(9),
          String(r.structured ?? "-").slice(0, 20).padEnd(20),
          (r.foundInText ? "O " + r.foundWhere.join("+") : "-").padEnd(18),
          r.situation + (r.encodingDamaged ? " · 🔴인코딩손상" : "") + (r.multilingual ? " · 다국어" : ""),
        ].join(" | "),
      );
    }
    const tally = (xs: AxisRow[]) =>
      xs.reduce<Record<string, number>>((m, r) => {
        m[r.situation] = (m[r.situation] ?? 0) + 1;
        return m;
      }, {});
    console.log("\n═══ §3 상황 분포(전체 32줄) ═══");
    console.log("  " + JSON.stringify(tally(rows), null, 1).replace(/\n\s*/g, " "));
    console.log("═══ §3 상황 분포(해당 없음 제외 = 실패/부재 질문의 분모) ═══");
    console.log("  분모 " + inScope.length + " · " + JSON.stringify(tally(inScope), null, 1).replace(/\n\s*/g, " "));
    for (const area of ["BRAND", "MODEL_CODE", "PRODUCT_NAME", "DESCRIPTION"] as const) {
      console.log(`  ${area.padEnd(13)} ` + JSON.stringify(tally(rows.filter((r) => r.area === area))).slice(0, 180));
    }
    console.log("\n═══ §2 「추출 실패」로 분류된 줄의 **원문 발췌** (단정 근거) ═══");
    for (const r of rows.filter((x) => x.situation === SITUATION.EXTRACTION_FAILED)) {
      console.log(`  ${r.area} ${r.domain} ← ${r.foundWhere.join("+") || "형식문제"}`);
      console.log(`     「${(r.excerpt ?? "").slice(0, 120)}」`);
    }
    /* eslint-enable no-console */

    /* ── 🔴 분모와 핵심 수치를 **잠근다** ──────────────────────────────────── */
    expect(rows).toHaveLength(32);
    /**
     * 🟢🟢 **CPO 핵심 질문의 답 — BRAND 영역에서는 구별된다.**
     *    축이 비었는데 **원문에 기준 브랜드가 실재** 하는 줄이 있다 ⟹ 「추출 실패」다.
     *    🔴 그 근거는 **관찰 전용 함수**(`findBrandAliasMentions`)이고 운영 축을 바꾸지 않았다.
     */
    const brandFailed = rows.filter((r) => r.area === "BRAND" && r.situation === SITUATION.EXTRACTION_FAILED);
    expect(brandFailed, "🔴 BRAND 에서 추출 실패를 구별하지 못했다").toHaveLength(3);
    /** 🔴 그리고 그 줄은 **발췌를 들고 있다** — 「포함」만 적지 않는다. */
    for (const r of brandFailed) expect((r.excerpt ?? "").length, `🔴 ${r.domain} 발췌 없음`).toBeGreaterThan(0);
    /**
     * 🔴🔴 **MODEL_CODE 는 구별되지 않는다** — 축의 `MISSING` 이 **원상품 쪽 공백** 때문일
     *    수 있어 「후보의 추출 실패」로 단정할 수 없다 ⟹ `UNDECIDABLE` 로 적는다.
     */
    const codeUndecidable = rows.filter((r) => r.area === "MODEL_CODE" && r.situation === SITUATION.UNDECIDABLE);
    expect(codeUndecidable, "🔴 품번 영역의 구분 불가가 사라졌다").toHaveLength(3);
    /** 🔴 상세설명 원문은 **8/8 확보** 돼 있다 ⟹ 「원문 자체 없음」이 **0** 이다. */
    expect(rows.filter((r) => r.area === "DESCRIPTION" && r.situation === SITUATION.NO_SOURCE_TEXT)).toHaveLength(0);

    /**
     * 🔴🔴 **음성 대조가 내 단언의 구멍 셋을 찾았다 — 아래가 그 보강이다.**
     * ```
     * M3 두 충돌 라벨을 «합쳐도» 통과했다      ⟹ 각 라벨의 **개수** 를 잠근다
     * M4 PRESENT 를 「실제 부재」로 적어도 통과 ⟹ 「PRESENT ⟺ 해당없음」을 잠근다
     * M6 인코딩 검사를 지워도 통과            ⟹ 손상 줄 **수** 와 그 영향을 잠근다
     * ```
     */
    const n = (sit: Situation) => rows.filter((r) => r.situation === sit).length;
    /** M3 — 🔴 운영 `CONFLICT`(원상품↔후보)와 CPO ⑤(한쪽 내 복수값)는 **다른 수** 다. */
    expect(n(SITUATION.CROSS_CONFLICT), "🔴 원상품↔후보 불일치 수가 바뀌었다").toBe(6);
    expect(n(SITUATION.MULTI_VALUE_CONFLICT), "🔴 한쪽 내 복수값 충돌은 이 표본에 **0** 이다").toBe(0);
    /** M4 — 🔴 축이 `PRESENT` 인 줄은 **전부** 분모 밖이고, 그 역도 성립한다. */
    for (const r of rows) {
      if (r.axisComparison === "PRESENT") {
        expect(r.situation, `🔴 ${r.area} ${r.domain} — PRESENT 를 실패/부재로 적었다`).toBe(SITUATION.NOT_APPLICABLE);
      }
    }
    expect(n(SITUATION.NOT_APPLICABLE), "🔴 분모 밖 줄 수가 바뀌었다").toBe(9);
    expect(inScope, "🔴 실패/부재 질문의 분모가 바뀌었다").toHaveLength(23);
    /** M6 — 🔴 손상은 **한 후보의 네 영역** 에서만 관측됐다(coupleshot · 일반화 금지). */
    const damagedRows = rows.filter((r) => r.encodingDamaged);
    expect(damagedRows, "🔴 인코딩 손상 검사가 죽었다").toHaveLength(4);
    expect(new Set(damagedRows.map((r) => r.domain)).size, "🔴 손상이 한 후보를 넘었다").toBe(1);
    /** 🔴 그리고 상세설명 영역의 「추출 실패」는 **그 손상 1건뿐** 이다. */
    const descFailed = rows.filter((r) => r.area === "DESCRIPTION" && r.situation === SITUATION.EXTRACTION_FAILED);
    expect(descFailed, "🔴 상세설명 추출 실패 수가 바뀌었다").toHaveLength(1);
    expect(descFailed[0].encodingDamaged).toBe(true);
    /** 🔴 다국어 관측도 수로 잠근다 — kids-world 네 영역. */
    expect(rows.filter((r) => r.multilingual).length, "🔴 다국어 관측이 바뀌었다").toBe(4);

    /**
     * 🔵🔵 **교차 사실 — 추출 실패가 걸린 곳이 「동일상품」 쪽이다.**
     *
     * 🔴🔴 **라벨의 거처를 섞지 않는다**(이 저장소에서 반복해 틀린 자리):
     * ```
     * CEO 확인 판단   🟢 **CPO 작업지시서 기록**(MIER-01 §5 가 그대로 받아 적은 값)
     * candidate_reviews.human_verdict   🔴 **10/10 null**(`mic01-db-pull.json` 실측)
     * ⟹ 🔴 「DB 에 CEO 라벨이 있다」로 적지 않는다.
     * ```
     * 🟢 그 문서 기록에서 **SAME 은 junioredition · kids-world 둘** 이고
     *    **추가 확인 필요는 coupleshot** 이다. 🔴 그리고 BRAND 추출 실패로 분류된
     *    **셋이 정확히 그 셋** 이다 ⟹ 🔴 **우연이 아닌지는 N=8 로 단정하지 않는다.**
     */
    const CEO_SAME_OR_CHECK = ["junioredition.com", "kids-world.com", "coupleshot.com"];
    const brandFailedDomains = rows
      .filter((r) => r.area === "BRAND" && r.situation === SITUATION.EXTRACTION_FAILED)
      .map((r) => r.domain)
      .sort();
    expect(
      brandFailedDomains,
      "🔴 브랜드 추출 실패 집합이 바뀌었다 — 그러면 아래 교차 서술이 거짓이 된다",
    ).toEqual([...CEO_SAME_OR_CHECK].sort());
    /** 🔴 그리고 CEO 가 DIFFERENT 라 한 다섯은 **추출 실패가 아니다**(실제 부재다). */
    const brandAbsent = rows
      .filter((r) => r.area === "BRAND" && r.situation === SITUATION.ABSENT_IN_TEXT)
      .map((r) => r.domain);
    expect(brandAbsent).toHaveLength(5);
    for (const d of brandAbsent) expect(CEO_SAME_OR_CHECK, `🔴 ${d} 분류 충돌`).not.toContain(d);

    /** 🔴 **DB 라벨이 비어 있다는 사실도 기계로 잠근다.** */
    const dbPull = read("mic01-db-pull.json") as { reviews: { human_verdict: string | null }[] };
    expect(dbPull.reviews.filter((x) => x.human_verdict != null), "🔴 DB 라벨이 생겼다 — 서술을 갱신해야 한다").toHaveLength(0);

    writeFileSync(
      join(FIX, "uied03-failure-states.json"),
      JSON.stringify(
        {
          note: "🔴 UIED-03 조사 산출 · 운영 상태 타입 아님 · 라벨 0 · HTTP 0",
          originCriteria: { brand: originBrand, code: originCode, title: reass.origin.titleRaw },
          denominator: { rows: rows.length, inScope: inScope.length, candidates: reass.rows.length },
          situations: SITUATION,
          rows,
        },
        null,
        2,
      ),
      "utf8",
    );
  });

  /* ═══ §4·§6. 금지 전수 ═══════════════════════════════════════════════════ */

  it("C-1 🔴 **새 운영 상태를 추가하지 않았다** — 기존 넷의 의미도 그대로다", () => {
    const CS = join(
      __dirname, "..", "..", "..", "..", "..", "..", "..", "..",
      "packages", "crawler", "src", "comparison-search",
    );
    const sum = readFileSync(join(CS, "identity-evidence-summary.ts"), "utf8");
    expect(sum, "🔴 운영 상태 집합이 바뀌었다").toContain(
      'IDENTITY_EVIDENCE_STATES = ["PRESENT", "MISSING", "NOT_MEASURED", "CONFLICT"]',
    );
    expect(sum, "🔴 새 상태가 운영 타입에 들어갔다").not.toContain(["EXTRACTION", "FAILED"].join("_"));
    /** 🟢 이 조사의 라벨은 **이 파일 안에만** 있다(운영 파일 0). */
    const self = readFileSync(__filename, "utf8");
    expect(self).toContain("const SITUATION = {");
  });

  it("C-2 🔴 **운영을 부르지 않고 수집도 하지 않았다**", () => {
    const self = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const banned of [
      ["compute", "MarketIntelligence"].join(""),
      ["price", "TierFromLink"].join(""),
      ["facts", "FromProductUrl"].join(""),
      ["compare", "CrossSellerProducts"].join(""),
      ["candidate", "reviews"].join("_"),
      "globalThis." + "fetch",
    ]) {
      expect(self, `🔴 금지 경로를 끌어왔다: ${banned}`).not.toContain(banned);
    }
    /** 🟢 입력은 **기존 산출물 둘** 뿐이다. */
    expect(self).toContain('read("mic01-candidate-originals.json")');
    expect(self).toContain('read("mier01-reassessment.json")');
    /**
     * 🔴🔴 **미추적 모듈을 import 하지 않았다** — 이 세션에서 그렇게 해서 **배포가 깨졌다**.
     */
    /** 🔴 **자기참조 함정 — 여섯 번째다.** 금지어를 그대로 적으면 자신을 잡는다. */
    for (const untracked of [
      ["brand", "description", "evidence"].join("-"),
      ["product", "name", "description", "evidence"].join("-"),
    ]) {
      expect(self, `🔴 미추적 모듈 import: ${untracked}`).not.toContain(untracked);
    }
  });
});
