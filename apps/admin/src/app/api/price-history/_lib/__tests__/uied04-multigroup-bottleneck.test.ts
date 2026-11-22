/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UNIFIED-IDENTITY-EVIDENCE-04 — **다상품군 SAME 확대 병목 조사**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔵 CPO 지시(2026-11-22 · UIED-03 승인 뒤) — 세 축:
 * ```
 * ① 기존 364건에서 **상품군별 원상품·후보 분포** + 네 영역의 **관측 가능 범위**
 * ② BRAND alias 누락 · 품번 기준 부재 · 다국어 상품명 · 상세설명 보완이
 *    각각 **어느 상품군에서** 발생하는지
 * ③ **실제 SAME 가능 후보가 늘어날 병목** ↔ **단순 표시 개선** 을 분리
 * ```
 *
 * 🟢 **CPO ⒜ 해석 기준을 채택한다** — `originState` / `candidateState` / `comparison`
 *    셋을 갈라 읽는다. 🔴 「후보 품번 PRESENT + 원상품 MISSING」은 **후보 추출 실패가
 *    아니라 원상품 측 비교 기준 부재** 다.
 *
 * 🔴 조사 전용 — 운영 코드 0 · 배포 0 · DB 0 · schema 0 · **추가 HTTP 0** ·
 *    후보 재관측 0 · 새 상태 0 · `observedInText` 운영 연결 0 · 판정 정책 0 ·
 *    SAME 승격 0 · UI 0. 입력은 **기존 산출물 셋** 뿐이다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";
import {
  extractCodeLikeSlugSegment,
  extractCodeLikeTitleToken,
  extractLabeledProductCode,
  extractUrlSlug,
} from "@commerce/shared/src/product-facts";

/**
 * 🔴🔴 **내 1차 라벨이 틀렸고 그것을 여기서 고친다.**
 *
 * 1차에 「원상품 품번 기준 부재」를 **DB `sku` 칸**(43/122)으로 셌다. 🔴 그런데 운영
 * 비교축이 쓰는 값은 `ProductFacts.brandModelCode` 이고 그 owner 는
 * `resolveBrandModelCode`(product-identity-dna.ts:200) 이며 **셋을 순서대로** 본다:
 * ```
 * ⒜ 설명문 명시 라벨  →  ⒝ 제목 토큰  →  ⒞ **URL slug**
 * ```
 * 🟢 실측 — 그 순서를 그대로 재현하면 **115/122** 가 채워진다(설명문 43 · slug 72).
 * 🔴 그래서 「원상품 품번이 없다」는 **DB 칸 이야기** 이고 **운영 입력 이야기가 아니다**.
 * 🔴 함수를 복제하지 않고 **그 네 함수를 그대로 불러** 같은 순서로 쓴다.
 */
const originCode = (desc: string | null, title: string | null, url: string | null): string | null =>
  extractLabeledProductCode(desc) ??
  extractCodeLikeTitleToken(title) ??
  extractCodeLikeSlugSegment(extractUrlSlug(url));

const FIX = join(__dirname, "fixtures");
const read = (f: string): unknown => JSON.parse(readFileSync(join(FIX, f), "utf8"));

interface Snap {
  snapshot_id: string;
  origin_brand: string | null;
  origin_sku: string | null;
  origin_title: string | null;
  origin_desc: string | null;
  shopify_type: string | null;
  source_url: string | null;
  candidates: number;
  kr: number;
  overseas: number;
  unknown_mkt: number;
}
interface Row {
  snapshot_id: string | null;
  candidate_url: string;
  candidate_domain: string | null;
  candidate_title: string | null;
  market: string | null;
  system_verdict: string | null;
  match_truth: string | null;
  price_tier: string | null;
  human_verdict: string | null;
  blockers: unknown;
}
interface FirstRow {
  group: string;
  originSku: string | null;
  originHasSku: boolean;
  domain: string;
  url: string;
  verdict: string | null;
  tier: string | null;
  human: string | null;
  state: string;
  brand: string;
  code: string;
  nameSimilarity: number;
  titleOverlapZero?: boolean;
}

/** 🔴 다국어 — 한글/가나/한자. 번역하지 않는다. */
const multi = (s: string | null | undefined): boolean =>
  Boolean(s && /[ㄱ-힝぀-ヿ一-鿿]/.test(s));

/** 🟢 상품군 — `shopify_type` 하나로만 가른다(🔴 제목 추측 분류 금지 · MMSE-01 교훈). */
const groupOf = (t: string | null): string => {
  const v = (t ?? "").trim();
  return v.length > 0 ? v : "🔴 미분류(원상품 유형 없음)";
};

describe("UIED04 — 다상품군 SAME 확대 병목", () => {
  it("A-1 🟢🟢 **①②③ 을 한 번에 측정한다** — 상품군 · 네 영역 · 병목/표시 분리", () => {
    const base = read("mmse01-baseline.json") as {
      totals: { rows: number; snapshots: number; domains: number; human_labeled: number }[];
      bySnapshot: Snap[];
      rows: Row[];
    };
    const first = read("mmse01-firstpass.json") as { perRow: FirstRow[] };
    const code = read("mmse02-code-evidence.json") as {
      match: { snapshot: string; group: string; domain: string; originDbSku: string | null; candUrlCode: string | null }[];
      conflict: { snapshot: string; group: string; domain: string; originDbSku: string | null; candUrlCode: string | null }[];
    };

    /**
     * 🔴🔴 **분모를 먼저 고정한다 — CPO 가 한 번 정정한 자리다.**
     *    `rows` 381 안에 `snapshot_id = null` 인 **GT_IMPORT 시딩 17건** 이 섞여 있다.
     *    🔴 그것을 운영 후보로 세면 분모가 틀린다(CPO 명시) ⟹ **364** 로 센다.
     */
    const orphans = base.rows.filter((r) => r.snapshot_id == null);
    const rows = base.rows.filter((r) => r.snapshot_id != null);
    expect(base.rows, "🔴 baseline 전수가 바뀌었다").toHaveLength(381);
    expect(orphans, "🔴 GT_IMPORT 고아행 수가 바뀌었다").toHaveLength(17);
    expect(rows, "🔴 운영 후보 분모가 364 가 아니다").toHaveLength(364);
    expect(base.bySnapshot, "🔴 원상품 수가 바뀌었다").toHaveLength(122);

    const snapById = new Map(base.bySnapshot.map((s) => [s.snapshot_id, s]));
    const firstByUrl = new Map(first.perRow.map((r) => [r.url, r]));
    const codeByKey = new Map<string, "MATCH" | "CONFLICT">();
    for (const m of code.match) codeByKey.set(m.snapshot + "|" + m.domain, "MATCH");
    for (const c of code.conflict) codeByKey.set(c.snapshot + "|" + c.domain, "CONFLICT");

    /* ═══ ① 상품군별 분포 + 네 영역 관측 가능 범위 ═════════════════════════ */

    interface GroupStat {
      group: string;
      origins: number;
      candidates: number;
      kr: number;
      overseas: number;
      unknownMkt: number;
      opSame: number;
      human: number;
      /** 네 영역 — 🔴 원상품 측과 후보 측을 **갈라** 센다(CPO ⒜) */
      originBrand: number;
      originSku: number;
      /** 🟢 **운영 입력** — `resolveBrandModelCode` 순서 재현(DB 칸이 아니다) */
      originCodeResolved: number;
      originDesc: number;
      candTitle: number;
      /** 🔴 후보 측 브랜드·상세설명은 **저장되지 않는다** ⟹ 측정 불가 */
      candBrandStored: number;
      candDescStored: number;
      /* ② 네 현상 */
      aliasGap: number;
      aliasCovered: number;
      noOriginCode: number;
      multilingualTitle: number;
      /* ③ 병목 ↔ 표시 */
      bottleneck: number;
      displayOnly: number;
      realDifferent: number;
    }
    const G = new Map<string, GroupStat>();
    const ensure = (g: string): GroupStat => {
      let x = G.get(g);
      if (!x) {
        x = {
          group: g, origins: 0, candidates: 0, kr: 0, overseas: 0, unknownMkt: 0, opSame: 0, human: 0,
          originBrand: 0, originSku: 0, originCodeResolved: 0, originDesc: 0, candTitle: 0, candBrandStored: 0, candDescStored: 0,
          aliasGap: 0, aliasCovered: 0, noOriginCode: 0, multilingualTitle: 0,
          bottleneck: 0, displayOnly: 0, realDifferent: 0,
        };
        G.set(g, x);
      }
      return x;
    };

    for (const s of base.bySnapshot) {
      const g = ensure(groupOf(s.shopify_type));
      g.origins += 1;
      if ((s.origin_brand ?? "").trim().length > 0) g.originBrand += 1;
      if ((s.origin_sku ?? "").trim().length > 0) g.originSku += 1;
      if (originCode(s.origin_desc, s.origin_title, s.source_url) != null) g.originCodeResolved += 1;
      if ((s.origin_desc ?? "").trim().length > 0) g.originDesc += 1;
    }

    /** 🔴 현상별 상세 목록 — 숫자만 적지 않는다. */
    const aliasGapRows: { group: string; domain: string; brand: string; title: string }[] = [];
    const multiRows: { group: string; domain: string; title: string; verdict: string | null }[] = [];
    const bottleneckRows: { group: string; domain: string; why: string; verdict: string | null }[] = [];

    for (const r of rows) {
      const snap = snapById.get(r.snapshot_id!);
      const g = ensure(groupOf(snap?.shopify_type ?? null));
      g.candidates += 1;
      if (r.market === "KR") g.kr += 1;
      else if (r.market === "OVERSEAS") g.overseas += 1;
      else g.unknownMkt += 1;
      if (r.system_verdict === "SAME") g.opSame += 1;
      if (r.human_verdict != null) g.human += 1;
      if ((r.candidate_title ?? "").trim().length > 0) g.candTitle += 1;
      /**
       * 🔴 `candidate_reviews` 에 후보 brand·description 칸이 **없다** ⟹ 전건 0 이 정상이다.
       * 🔴 `Row` 에 그 칸이 선언돼 있지 않아 **직접 단정 변환이 타입 오류** 다
       *    (typecheck 가 잡았다 · 이 저장소에서 반복되는 그 자리) ⟹ `unknown` 경유로 읽는다.
       */
      const raw = r as unknown as Record<string, unknown>;
      if (raw.candidate_brand != null) g.candBrandStored += 1;
      if (raw.candidate_description != null) g.candDescStored += 1;

      /* ── ② BRAND alias 누락 — 🟢 CPO 미확정 항목을 «직접» 잰다 ──────────── */
      const ob = (snap?.origin_brand ?? "").trim();
      const title = r.candidate_title ?? "";
      if (ob.length > 0 && title.length > 0) {
        /** 🔴 **새 추출 규칙이 아니다** — 원상품 브랜드 «문자열» 이 제목에 평문으로 있는가. */
        const plain = title.toLowerCase().includes(ob.toLowerCase());
        /** 🟢 운영 관찰 함수(등록부 두 칸)가 그것을 찾는가. */
        const viaRegistry = findBrandAliasMentions(title).some((m) => m.brand.toLowerCase() === ob.toLowerCase());
        if (plain && !viaRegistry) {
          g.aliasGap += 1;
          if (aliasGapRows.length < 40) aliasGapRows.push({ group: g.group, domain: r.candidate_domain ?? "-", brand: ob, title: title.slice(0, 70) });
        } else if (plain && viaRegistry) g.aliasCovered += 1;
      }

      /**
       * ── ② 품번 기준 부재 — 🔵 CPO ⒜ 기준(원상품 측) ────────────────────────
       * 🔴 **운영 입력 기준으로 센다** — DB `sku` 칸이 아니다(1차에 그걸로 세서 틀렸다).
       */
      const oCode = originCode(snap?.origin_desc ?? null, snap?.origin_title ?? null, snap?.source_url ?? null);
      if (oCode == null) g.noOriginCode += 1;

      /* ── ② 다국어 상품명 ─────────────────────────────────────────────────── */
      if (multi(title)) {
        g.multilingualTitle += 1;
        if (multiRows.length < 40) multiRows.push({ group: g.group, domain: r.candidate_domain ?? "-", title: title.slice(0, 50), verdict: r.system_verdict });
      }

      /* ── ③ 병목 ↔ 표시 개선 분리 ──────────────────────────────────────────── */
      const fr = firstByUrl.get(r.candidate_url);
      const codeAxis = codeByKey.get(String(r.snapshot_id) + "|" + String(r.candidate_domain));
      if (fr?.state === "REAL_DIFFERENT" || codeAxis === "CONFLICT") {
        /** 🟢 실제 다른 상품 — SAME 확대 대상이 **아니다**(정확한 차단이다). */
        g.realDifferent += 1;
      } else if (r.system_verdict === "SAME") {
        /** 🟢 이미 SAME — 남은 것은 **근거를 보여주는 일**(표시 개선)이다. */
        g.displayOnly += 1;
      } else {
        /**
         * 🟡 **SAME 이 아니고 실제 다른 상품도 아니다** ⟹ 병목 후보.
         * 🔴 「SAME 으로 올릴 수 있다」가 아니다 — **그 자리를 세는 것** 이다.
         */
        g.bottleneck += 1;
        const why =
          oCode == null
            ? "원상품 품번 기준 부재(운영 입력)"
            : fr?.brand === "UNCONFIRMED"
              ? "브랜드 미확인"
              : fr?.code === "NO_EVIDENCE"
                ? "후보 품번 증거 없음"
                : fr?.titleOverlapZero
                  ? "제목 겹침 0"
                  : /**
                     * 🟢 그래도 남으면 **운영이 저장한 blocker** 를 그대로 읽는다.
                     * 🔴 지어내지 않는다 — 비어 있으면 「blocker 없음」으로 적는다.
                     */
                    (() => {
                      const bl = Array.isArray(r.blockers) ? (r.blockers as string[]) : [];
                      return bl.length > 0 ? "blocker: " + bl.slice(0, 2).join("+") : "🔴 blocker 없음(사유 미확정)";
                    })();
        if (bottleneckRows.length < 200) bottleneckRows.push({ group: g.group, domain: r.candidate_domain ?? "-", why, verdict: r.system_verdict });
      }
    }

    const stats = [...G.values()].sort((a, b) => b.candidates - a.candidates);

    /* eslint-disable no-console */
    console.log("\n═══ ① 상품군별 원상품·후보 분포(분모 원상품 122 · 후보 364) ═══");
    console.log(
      ["상품군".padEnd(26), "원상품", "후보", "🇰🇷", "🌎", "❔", "운영SAME", "human"].join(" | "),
    );
    for (const s of stats) {
      console.log(
        [
          s.group.slice(0, 26).padEnd(26),
          String(s.origins).padStart(6),
          String(s.candidates).padStart(4),
          String(s.kr).padStart(3),
          String(s.overseas).padStart(3),
          String(s.unknownMkt).padStart(3),
          String(s.opSame).padStart(8),
          String(s.human).padStart(5),
        ].join(" | "),
      );
    }

    console.log("\n═══ ① 네 영역의 «관측 가능 범위» — 🔴 원상품 측과 후보 측을 가른다 ═══");
    console.log(
      [
        "상품군".padEnd(26), "원브랜드", "DB품번", "🟢운영품번", "원설명", "후보제목",
        "🔴후보브랜드", "🔴후보설명",
      ].join(" | "),
    );
    for (const s of stats) {
      console.log(
        [
          s.group.slice(0, 26).padEnd(26),
          `${s.originBrand}/${s.origins}`.padStart(8),
          `${s.originSku}/${s.origins}`.padStart(6),
          `${s.originCodeResolved}/${s.origins}`.padStart(8),
          `${s.originDesc}/${s.origins}`.padStart(6),
          `${s.candTitle}/${s.candidates}`.padStart(8),
          `${s.candBrandStored}/${s.candidates}`.padStart(12),
          `${s.candDescStored}/${s.candidates}`.padStart(11),
        ].join(" | "),
      );
    }

    console.log("\n═══ ② 네 현상이 «어느 상품군» 에서 발생하는가 ═══");
    console.log(
      ["상품군".padEnd(26), "alias누락", "alias적중", "원품번부재", "다국어제목"].join(" | "),
    );
    for (const s of stats) {
      console.log(
        [
          s.group.slice(0, 26).padEnd(26),
          String(s.aliasGap).padStart(9),
          String(s.aliasCovered).padStart(9),
          String(s.noOriginCode).padStart(10),
          String(s.multilingualTitle).padStart(10),
        ].join(" | "),
      );
    }

    console.log("\n═══ ③ 병목 ↔ 표시 개선 ↔ 실제 다른 상품 ═══");
    console.log(["상품군".padEnd(26), "🟡병목", "🟢표시개선", "🟢실제다름", "합"].join(" | "));
    for (const s of stats) {
      console.log(
        [
          s.group.slice(0, 26).padEnd(26),
          String(s.bottleneck).padStart(6),
          String(s.displayOnly).padStart(9),
          String(s.realDifferent).padStart(9),
          String(s.bottleneck + s.displayOnly + s.realDifferent).padStart(3),
        ].join(" | "),
      );
    }
    const whyTally = bottleneckRows.reduce<Record<string, number>>((m, r) => {
      m[r.why] = (m[r.why] ?? 0) + 1;
      return m;
    }, {});
    console.log("\n═══ ③ 병목 사유 분포 ═══");
    console.log("  " + JSON.stringify(whyTally));

    console.log("\n═══ ② BRAND alias 누락 실례(최대 12) — 🔴 등록부 밖 브랜드다 ═══");
    for (const a of aliasGapRows.slice(0, 12)) {
      console.log(`  [${a.group.slice(0, 12)}] ${a.domain.padEnd(24)} brand=${a.brand.padEnd(22)} 「${a.title}」`);
    }
    console.log("\n═══ ② 다국어 상품명 실례(최대 8) ═══");
    for (const m of multiRows.slice(0, 8)) {
      console.log(`  [${m.group.slice(0, 12)}] ${m.domain.padEnd(22)} ${String(m.verdict).padEnd(14)} 「${m.title}」`);
    }
    /* eslint-enable no-console */

    /* ── 🔴 핵심 수치를 잠근다 ────────────────────────────────────────────── */
    const T = (k: keyof GroupStat) => stats.reduce((a, s) => a + (s[k] as number), 0);
    expect(T("candidates"), "🔴 후보 합이 분모와 다르다").toBe(364);
    expect(T("origins"), "🔴 원상품 합이 분모와 다르다").toBe(122);
    expect(T("bottleneck") + T("displayOnly") + T("realDifferent"), "🔴 세 갈래가 분모를 덮지 않는다").toBe(364);
    /** 🔴 후보 측 브랜드·상세설명은 **저장되지 않는다** ⟹ 전건 0 이어야 한다. */
    expect(T("candBrandStored"), "🔴 후보 브랜드가 저장되기 시작했다 — 서술을 갱신해야 한다").toBe(0);
    expect(T("candDescStored"), "🔴 후보 상세설명이 저장되기 시작했다").toBe(0);
    /** 🟢 그리고 상품군이 **둘 이상** 이다(다상품군 질문의 전제). */
    expect(stats.filter((s) => s.candidates > 0).length, "🔴 상품군이 하나다").toBeGreaterThanOrEqual(4);
    /** 🟢 alias 누락이 **실측된다**(CPO 미확정 항목) · 🔴 그 수를 잠근다. */
    /**
     * 🔴🔴 **음성 대조가 내 단언의 구멍 셋을 찾았다 — 아래가 그 보강이다.**
     * ```
     * M2 운영 품번 해석을 **DB 칸으로 되돌려도** 통과했다   ⟹ 그 수(115)를 잠근다
     * M4 세 갈래를 **둘로 뭉개도** 통과했다(합만 봤다)      ⟹ 각 갈래 수를 잠근다
     * ```
     * 🔴 아래는 전부 **실측값** 이다 — 이 산출이 바뀌면 FAIL 하는 것이 목적이다.
     */
    expect(T("origins")).toBe(122);
    expect(T("opSame"), "🔴 운영 SAME 분모가 바뀌었다").toBe(83);
    expect(T("human"), "🔴 human 라벨 수가 바뀌었다").toBe(22);
    /**
     * M2 — 🟢 **DB 칸 43 ↔ 운영 입력 115** 는 **다른 수** 다. 둘을 같이 잠근다.
     * 🔴 1차에 DB 칸으로 병목을 세어 「원상품 품번 기준 부재 78」이라는 **거짓 숫자** 를 냈다.
     */
    expect(T("originSku"), "🔴 DB sku 보유 수가 바뀌었다").toBe(43);
    expect(T("originCodeResolved"), "🔴🔴 운영 품번 해석이 DB 칸으로 되돌아갔다").toBe(115);
    expect(T("originDesc")).toBe(122);
    expect(T("originBrand"), "🔴 원상품 브랜드 보유 수가 바뀌었다").toBe(118);
    /** M4 — 🔴 세 갈래를 **각각** 잠근다(합만 보면 뭉개도 통과한다). */
    expect(T("bottleneck"), "🔴 병목 수가 바뀌었다").toBe(124);
    expect(T("displayOnly"), "🔴 표시 개선 수가 바뀌었다").toBe(82);
    expect(T("realDifferent"), "🔴 실제 다름 수가 바뀌었다").toBe(158);
    /** 🟢 alias 누락이 **실측된다**(CPO 미확정 항목) · 🔴 그 수를 잠근다. */
    expect(T("aliasGap"), "🔴 alias 누락 측정이 죽었다").toBe(9);
    expect(T("aliasCovered"), "🔴 alias 적중 수가 바뀌었다").toBe(126);
    expect(T("multilingualTitle"), "🔴 다국어 제목 수가 바뀌었다").toBe(51);
    /** 🔴 그리고 **운영 입력 기준** 품번 부재는 **21** 이다(DB 칸 79 가 아니다). */
    expect(T("noOriginCode"), "🔴 품번 부재를 DB 칸으로 셌다").toBe(21);

    writeFileSync(
      join(FIX, "uied04-multigroup.json"),
      JSON.stringify(
        {
          note:
            "🔴 UIED-04 조사 산출 · HTTP 0 · 판정 변경 0 · 라벨 0 · 2차 산출물(이중 집계 금지). " +
            "분모 — 후보 364(GT_IMPORT 고아 17 제외) · 원상품 122.",
          denominator: { baselineRows: base.rows.length, orphans: orphans.length, candidates: rows.length, origins: base.bySnapshot.length },
          groups: stats,
          bottleneckWhy: whyTally,
          aliasGapRows,
          multilingualRows: multiRows,
          bottleneckRows,
        },
        null,
        2,
      ),
      "utf8",
    );
  });

  it("B-1 🔵 **CPO ⒜ 해석 기준을 기계로 적용한다** — 세 상태를 갈라 읽는다", () => {
    /**
     * 🟢 UIED-03 이 「구분 불가」로 둔 품번 3건을 ⒜ 기준으로 다시 읽는다.
     * 🔴 「후보 품번 추출 실패」가 **아니라** 「원상품 측 비교 기준 부재」다.
     */
    const u3 = read("uied03-failure-states.json") as {
      rows: { domain: string; area: string; axisComparison: string | null; situation: string }[];
    };
    const cap = read("mic01-candidate-originals.json") as {
      identityEvidence: {
        domain: string;
        evidence: { axes: { axis: string; originState: string; candidateState: string; comparison: string }[] } | null;
      }[];
    };
    const undecidable = u3.rows.filter((r) => r.area === "MODEL_CODE" && r.situation.includes("구분 불가"));
    expect(undecidable, "🔴 UIED-03 의 구분 불가 3건이 사라졌다").toHaveLength(3);

    /* eslint-disable no-console */
    console.log("\n═══ ⒜ 적용 — 품번 「구분 불가 3건」을 세 상태로 갈라 읽는다 ═══");
    for (const r of undecidable) {
      const ax = cap.identityEvidence
        .find((e) => e.domain === r.domain)
        ?.evidence?.axes.find((a) => a.axis === "MODEL_CODE");
      expect(ax, `🔴 ${r.domain} 축 행이 없다`).toBeTruthy();
      /** 🔴🔴 **그 셋의 모양이 정확히 이것이다** — 후보는 있고 원상품이 없다. */
      expect(ax!.candidateState, `🔴 ${r.domain} 후보 상태가 바뀌었다`).toBe("PRESENT");
      expect(ax!.originState, `🔴 ${r.domain} 원상품 상태가 바뀌었다`).toBe("MISSING");
      expect(ax!.comparison).toBe("MISSING");
      console.log(
        `  ${r.domain.padEnd(22)} origin=${ax!.originState.padEnd(9)} candidate=${ax!.candidateState.padEnd(9)}` +
          ` comparison=${ax!.comparison.padEnd(9)} ⟹ 🔵 원상품 측 비교 기준 부재(후보 추출 실패 아님)`,
      );
    }
    /* eslint-enable no-console */
    /**
     * 🔴🔴 **M6 보강** — 위 세 단언 중 하나를 지워도 음성 대조가 **통과했다**.
     *    그래서 **결론 자체** 를 개수로 잠근다: 「후보는 있고 원상품이 없는」 모양이 **셋** 이다.
     */
    const originSideGap = undecidable.filter((r) => {
      const ax = cap.identityEvidence
        .find((e) => e.domain === r.domain)
        ?.evidence?.axes.find((a) => a.axis === "MODEL_CODE");
      return ax?.candidateState === "PRESENT" && ax?.originState === "MISSING";
    });
    expect(originSideGap, "🔴 ⒜ 해석의 결론이 깨졌다").toHaveLength(3);
  });

  it("C-1 🔴 **운영을 부르지 않고 수집도 하지 않았다**", () => {
    const self = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const banned of [
      ["compute", "MarketIntelligence"].join(""),
      ["price", "TierFromLink"].join(""),
      ["facts", "FromProductUrl"].join(""),
      ["compare", "CrossSellerProducts"].join(""),
      ["candidate", "reviews"].join("_"),
      "globalThis." + "fetch",
      ["brand", "description", "evidence"].join("-"),
      ["product", "name", "description", "evidence"].join("-"),
    ]) {
      expect(self, `🔴 금지 경로를 끌어왔다: ${banned}`).not.toContain(banned);
    }
    /** 🟢 입력은 기존 산출물뿐이다. */
    for (const f of [
      "mmse01-baseline.json",
      "mmse01-firstpass.json",
      "mmse02-code-evidence.json",
      "uied03-failure-states.json",
    ]) {
      expect(self, `🔴 입력이 바뀌었다: ${f}`).toContain(`read("${f}")`);
    }
    /** 🔴 새 상태·운영 연결을 만들지 않았다. */
    expect(self, "🔴 새 운영 상태가 생겼다").not.toContain(["EXTRACTION", "FAILED"].join("_"));
    /** 🔴 **자기참조 함정 — 일곱 번째다.** 금지어를 그대로 적으면 자신을 잡는다. */
    expect(self, "🔴 보류된 관찰 칸을 운영에 연결했다").not.toContain(["observed", "InText"].join(""));
  });
});
