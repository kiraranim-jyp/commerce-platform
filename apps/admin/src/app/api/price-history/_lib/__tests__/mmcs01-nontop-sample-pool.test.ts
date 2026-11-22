/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-MULTI-CATEGORY-SAMPLING-01 — **비상의 상품군 표본 «후보 풀» 확인**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **표본을 고르지 않는다**(CPO 명시). 산출물은 **CPO 가 고를 수 있는 목록과 근거** 다.
 *
 * 🔴 금지 전수 — 신규 크롤링·추가 HTTP **0** · 신규 상품 등록 **0** · 표본 임의 선정 **0** ·
 *    브랜드 alias 추가 **0** · 8축 완화 **0** · SAME 승격/판정 정책 **0** ·
 *    DB/schema/migration/backfill **0** · 운영 코드·UI **0**.
 *
 * 🔵 **CPO 가 요구한 다섯 구분을 코드로 지킨다**:
 * ```
 * ① DB `sku` 칸          ↔  운영 `brandModelCode`(설명문→제목→URL slug)
 * ② 후보 «수»            ↔  실제 **SAME** 수
 * ③ 국내 후보            ↔  해외 후보
 * ④ 「후보가 없다」       ↔  「후보 데이터가 저장되지 않았다」
 * ⑤ 기존 **운영 판정**    ↔  **사람 확인 기록**(`human_verdict`)
 * ```
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractCodeLikeSlugSegment,
  extractCodeLikeTitleToken,
  extractLabeledProductCode,
  extractUrlSlug,
} from "@commerce/shared/src/product-facts";

const FIX = join(__dirname, "fixtures");
const read = (f: string): unknown => JSON.parse(readFileSync(join(FIX, f), "utf8"));

/** 🔴 상의 계열 셋 — UIED-04 가 확정한 그 표기 그대로(임의 병합·추측 분류 0). */
const TOP_GROUPS = new Set(["T Shirt", "T-shirts", "Sweatshirts"]);

interface Snap {
  snapshot_id: string;
  snapshot_title: string | null;
  origin_brand: string | null;
  origin_sku: string | null;
  origin_title: string | null;
  origin_desc: string | null;
  origin_currency: string | null;
  origin_amount: number | null;
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

/** 🔵 ① 운영 `brandModelCode` 와 **그 출처** 를 같이 돌려준다(owner 순서 그대로). */
type CodeSource = "DB_SKU" | "DESCRIPTION" | "TITLE" | "URL_SLUG" | "NONE";
const resolveOriginCode = (s: Snap): { code: string | null; source: CodeSource } => {
  /**
   * 🔴 owner 는 `resolveBrandModelCode`(product-identity-dna.ts:200) 이고 순서가 **계약** 이다:
   *    ⒜ 설명문 명시 라벨 → ⒝ 제목 토큰 → ⒞ URL slug.
   * 🔴 **DB `sku` 칸은 그 순서에 «없다»** — 그래서 따로 적는다(CPO ① 구분).
   */
  const a = extractLabeledProductCode(s.origin_desc);
  if (a) return { code: a, source: "DESCRIPTION" };
  const b = extractCodeLikeTitleToken(s.origin_title);
  if (b) return { code: b, source: "TITLE" };
  const c = extractCodeLikeSlugSegment(extractUrlSlug(s.source_url));
  if (c) return { code: c, source: "URL_SLUG" };
  return { code: null, source: "NONE" };
};

describe("MMCS01 — 비상의 상품군 표본 후보 풀", () => {
  it("A-1 🟢🟢 **원상품 단위 후보 풀을 낸다** — 표본은 고르지 않는다", () => {
    const base = read("mmse01-baseline.json") as { bySnapshot: Snap[]; rows: Row[] };
    const u4 = read("uied04-multigroup.json") as {
      denominator: { candidates: number; origins: number };
    };

    /** 🔴 분모 — GT_IMPORT 고아행(`snapshot_id = null`)은 운영 후보가 아니다. */
    const rows = base.rows.filter((r) => r.snapshot_id != null);
    expect(rows, "🔴 운영 후보 분모가 364 가 아니다").toHaveLength(364);
    expect(u4.denominator.candidates, "🔴 UIED-04 와 분모가 갈렸다").toBe(364);
    expect(base.bySnapshot).toHaveLength(122);

    const rowsBySnap = new Map<string, Row[]>();
    for (const r of rows) {
      const k = r.snapshot_id!;
      const xs = rowsBySnap.get(k) ?? [];
      xs.push(r);
      rowsBySnap.set(k, xs);
    }

    interface Pool {
      group: string;
      groupIsRealType: boolean;
      snapshotId: string;
      originTitle: string | null;
      originUrl: string | null;
      brand: string | null;
      /** ① 둘을 **갈라** 적는다 */
      dbSku: string | null;
      opCode: string | null;
      opCodeSource: CodeSource;
      /** ③ 국내 ↔ 해외 */
      krCandidates: number;
      overseasCandidates: number;
      unknownMarket: number;
      /** ② 후보 수 ↔ 실제 SAME 수 */
      candidates: number;
      same: number;
      presumedSame: number;
      similar: number;
      conflict: number;
      unknownVerdict: number;
      /** ⑤ 사람 확인 기록 */
      humanLabeled: number;
      /** 상세 증거 — 🔴 원상품 측만 확보된다(후보 측은 저장 칸이 없다) */
      originDescChars: number;
      candidateDescStored: number;
      /** ④ 「없다」 ↔ 「저장되지 않았다」 */
      declaredCandidates: number;
      storageGap: number;
      /** 🔴 표본 사용 불가 사유(없으면 빈 배열) */
      excluded: string[];
    }

    const pools: Pool[] = [];
    for (const s of base.bySnapshot) {
      const t = (s.shopify_type ?? "").trim();
      if (TOP_GROUPS.has(t)) continue;
      const rs = rowsBySnap.get(s.snapshot_id) ?? [];
      const n = (v: string) => rs.filter((r) => r.system_verdict === v).length;
      const { code, source } = resolveOriginCode(s);
      const declared = s.candidates;
      const excluded: string[] = [];
      if (rs.length === 0) excluded.push("후보 0건(조회했으나 후보가 생기지 않았다)");
      if ((s.origin_title ?? "").trim().length === 0) excluded.push("원상품명 없음");
      if ((s.source_url ?? "").trim().length === 0) excluded.push("원상품 URL 없음");
      if (code == null) excluded.push("운영 brandModelCode 해석 불가");
      if ((s.origin_brand ?? "").trim().length === 0) excluded.push("원상품 브랜드 없음");

      pools.push({
        group: t.length > 0 ? t : "🔴 유형 없음",
        /**
         * 🔴 `AW26 DROP TWO` 는 **상품 유형이 아니다** — 드롭/컬렉션 이름이다.
         *    🔴 그것을 「상품군」으로 세면 분류가 거짓이 된다 ⟹ 표시에서 가른다.
         */
        groupIsRealType: t.length > 0 && !/^AW\d|DROP/i.test(t),
        snapshotId: s.snapshot_id,
        originTitle: s.origin_title ?? s.snapshot_title,
        originUrl: s.source_url,
        brand: s.origin_brand,
        dbSku: s.origin_sku,
        opCode: code,
        /**
         * 🔴🔴 **1차 라벨이 모순이었다 — 고쳤다.**
         *    `DB sku` 가 있고 운영 해석이 실패하면 `source` 를 `DB_SKU` 로 적었는데,
         *    그 경우 `opCode` 는 **`null`** 이다 ⟹ 「값은 없는데 출처는 DB」라는 거짓이 된다
         *    (실측 3건: `AAA1804424` · `AAA1804916` ×2 — 전부 판매처 자체 SKU 다).
         * 🟢 그래서 **운영 해석의 출처만** 적고, DB 칸은 `dbSku` 칸이 따로 말한다(CPO ① 구분).
         */
        opCodeSource: source,
        krCandidates: rs.filter((r) => r.market === "KR").length,
        overseasCandidates: rs.filter((r) => r.market === "OVERSEAS").length,
        unknownMarket: rs.filter((r) => r.market !== "KR" && r.market !== "OVERSEAS").length,
        candidates: rs.length,
        same: n("SAME"),
        presumedSame: n("PRESUMED_SAME"),
        similar: n("SIMILAR"),
        conflict: n("CONFLICT"),
        unknownVerdict: rs.filter((r) => r.system_verdict == null || r.system_verdict === "UNKNOWN").length,
        humanLabeled: rs.filter((r) => r.human_verdict != null).length,
        originDescChars: (s.origin_desc ?? "").length,
        /** 🔴 `candidate_reviews` 에 후보 상세설명 칸이 **없다** ⟹ 0 이 정상(측정 불가). */
        candidateDescStored: rs.filter((r) => (r as unknown as Record<string, unknown>).candidate_description != null).length,
        declaredCandidates: declared,
        storageGap: declared - rs.length,
        excluded,
      });
    }

    /** 🔴 상품군 우선순위 — **원상품 수 → 후보 수 → 증거 품질** 순(CPO §2-2·2-3). */
    const byGroup = new Map<string, Pool[]>();
    for (const p of pools) {
      const xs = byGroup.get(p.group) ?? [];
      xs.push(p);
      byGroup.set(p.group, xs);
    }
    const groupRank = [...byGroup.entries()]
      .map(([g, xs]) => ({
        group: g,
        isRealType: xs[0].groupIsRealType,
        origins: xs.length,
        candidates: xs.reduce((a, p) => a + p.candidates, 0),
        kr: xs.reduce((a, p) => a + p.krCandidates, 0),
        overseas: xs.reduce((a, p) => a + p.overseasCandidates, 0),
        same: xs.reduce((a, p) => a + p.same, 0),
        human: xs.reduce((a, p) => a + p.humanLabeled, 0),
        withOpCode: xs.filter((p) => p.opCode != null).length,
        usable: xs.filter((p) => p.excluded.length === 0).length,
      }))
      .sort((a, b) => b.origins - a.origins || b.candidates - a.candidates);

    /* eslint-disable no-console */
    console.log("\n═══ ① 비상의 상품군별 원상품·후보 분포 ═══");
    console.log(
      ["상품군".padEnd(18), "실유형", "원상품", "후보", "🇰🇷", "🌎", "SAME", "human", "운영품번", "🟢표본가능"].join(" | "),
    );
    for (const g of groupRank) {
      console.log(
        [
          g.group.slice(0, 18).padEnd(18),
          (g.isRealType ? "O" : "🔴X").padEnd(6),
          String(g.origins).padStart(6),
          String(g.candidates).padStart(4),
          String(g.kr).padStart(3),
          String(g.overseas).padStart(3),
          String(g.same).padStart(4),
          String(g.human).padStart(5),
          `${g.withOpCode}/${g.origins}`.padStart(8),
          `${g.usable}/${g.origins}`.padStart(10),
        ].join(" | "),
      );
    }

    console.log("\n═══ ② 표본 «후보» 원상품 목록 — 🔴 CTO 가 고르지 않았다 ═══");
    for (const p of [...pools].sort((a, b) => b.candidates - a.candidates)) {
      console.log(
        `\n  [${p.group}] ${String(p.originTitle ?? "(제목 없음)").slice(0, 58)}`,
      );
      console.log(`     URL        ${String(p.originUrl ?? "(없음)").slice(0, 84)}`);
      console.log(
        `     브랜드      ${String(p.brand ?? "🔴 없음").padEnd(22)}` +
          ` DB sku=${String(p.dbSku ?? "-").padEnd(12)} 운영품번=${String(p.opCode ?? "🔴 null").padEnd(12)}(${p.opCodeSource})`,
      );
      console.log(
        `     후보        총 ${String(p.candidates).padStart(2)} = 🇰🇷 ${p.krCandidates} · 🌎 ${p.overseasCandidates} · ❔ ${p.unknownMarket}` +
          `   (선언 ${p.declaredCandidates} · 저장 공백 ${p.storageGap})`,
      );
      console.log(
        `     운영 판정    SAME ${p.same} · PRESUMED ${p.presumedSame} · SIMILAR ${p.similar} · CONFLICT ${p.conflict} · UNKNOWN ${p.unknownVerdict}`,
      );
      console.log(
        `     증거        원상품 설명 ${p.originDescChars}자 · 🔴 후보 설명 저장 ${p.candidateDescStored}/${p.candidates}` +
          ` · 사람 확인 ${p.humanLabeled}/${p.candidates}`,
      );
      console.log(`     표본 가능    ${p.excluded.length === 0 ? "🟢 가능" : "🔴 " + p.excluded.join(" · ")}`);
    }
    /* eslint-enable no-console */

    /* eslint-disable no-console */
    /**
     * 🔴🔴 **표본 풀을 줄이는 사실 둘 — 재분류하지 않고 «사실로» 적는다.**
     *
     * ⒜ **「유형 없음」은 「비상의」가 아니다.** `shopify_type` 이 빈 것은 그 판매처가
     *    Shopify 가 아니어서일 수 있다(실측: `smallable.com`). 🔴 제목이 상의로 읽히는
     *    것이 섞여 있지만 **CTO 가 재분류하지 않았다**(추측 분류 금지 · CPO 명시) ⟹
     *    **CPO 가 제목을 보고 판단할 재료** 로 그대로 싣는다.
     * ⒝ **중복 스냅샷** — 같은 `source_url` 이 둘 이상인 원상품이 있다. 🔴 그것을 각각
     *    세면 표본 수가 부풀려진다 ⟹ **고유 URL 수** 를 따로 적는다.
     */
    /**
     * 🔴🔴 **표본 품질 경고 — 숫자만으로 된 운영 품번.**
     *    `extractCodeLikeSlugSegment` 는 숫자-only 를 **거부** 하지만(WU-095 가드),
     *    `extractLabeledProductCode(desc)` 는 **라벨이 붙은 값을 그대로** 받으므로
     *    숫자만인 문자열도 통과한다. 🔴 그것은 **판매처 상품번호일 수 있다** ⟹
     *    「브랜드 품번 확보」로 단정하지 않는다(실측 1건 · 아래에서 수로 잠근다).
     */
    const numericOnlyCode = pools.filter((p) => p.opCode != null && /^[0-9]+$/.test(p.opCode));
    /* eslint-disable no-console */
    console.log("\n═══ 🔴 숫자만으로 된 운영 품번 — 판매처 상품번호 의심(단정 0) ═══");
    for (const p of numericOnlyCode) {
      console.log(`  [${p.group}] ${String(p.originTitle).slice(0, 44)}  품번=${p.opCode}(${p.opCodeSource})`);
    }
    /* eslint-enable no-console */
    expect(numericOnlyCode, "🔴 숫자-only 품번 수가 바뀌었다").toHaveLength(1);

    const noType = pools.filter((p) => p.group === "🔴 유형 없음");
    console.log("\n═══ 🔴 「유형 없음」 묶음의 원상품명 — CPO 판단 재료(CTO 재분류 0) ═══");
    for (const p of noType) {
      console.log(`  ${String(p.originTitle ?? "(없음)").slice(0, 60).padEnd(62)} ${String(p.originUrl ?? "").slice(0, 46)}`);
    }
    const byUrl = new Map<string, number>();
    for (const p of pools) {
      const k = (p.originUrl ?? "(없음)").split("?")[0];
      byUrl.set(k, (byUrl.get(k) ?? 0) + 1);
    }
    const dups = [...byUrl.entries()].filter(([, n]) => n > 1);
    console.log("\n═══ 🔴 중복 스냅샷(같은 원상품 URL) ═══");
    for (const [u, n] of dups) console.log(`  ${n}회  ${u.slice(0, 92)}`);
    console.log(`  ⟹ 원상품 행 ${pools.length} · **고유 URL ${byUrl.size}**`);
    /* eslint-enable no-console */

    /* ── 🔴 핵심 수치를 잠근다 ────────────────────────────────────────────── */
    expect(pools, "🔴 비상의 원상품 수가 바뀌었다").toHaveLength(15);
    /** 🔴 「유형 없음」 **5건** 과 **중복** 을 수로 잠근다 — 표본 풀의 실제 크기가 걸린다. */
    expect(noType, "🔴 유형 없음 묶음 수가 바뀌었다").toHaveLength(5);
    expect(dups.length, "🔴 중복 스냅샷 수가 바뀌었다").toBe(2);
    expect(byUrl.size, "🔴 고유 원상품 URL 수가 바뀌었다").toBe(13);
    expect(pools.reduce((a, p) => a + p.candidates, 0), "🔴 비상의 후보 수가 바뀌었다").toBe(46);
    /** 🔴 명시 유형 **8** + 유형 없음 1 = 9 묶음(CPO 가 「8개 상품군」이라 한 그 분모). */
    expect(groupRank.filter((g) => g.group !== "🔴 유형 없음"), "🔴 명시 유형 수가 8 이 아니다").toHaveLength(8);
    /**
     * 🔴 ④ 「후보 없다」 ↔ 「저장되지 않았다」 — 저장 공백이 **0** 이다(선언 == 실제).
     *
     * 🔴🔴 **음성 대조 M5 가 통과했다** — `storageGap: 0` 으로 박아도 합이 0 이라 통과한다
     *    (동어반복). 🟢 그래서 **유도식 자체** 를 행마다 단언한다.
     */
    for (const p of pools) {
      expect(p.storageGap, `🔴 ${p.group} 저장 공백 유도식이 깨졌다`).toBe(p.declaredCandidates - p.candidates);
      expect(p.declaredCandidates, `🔴 ${p.group} 선언 후보 수가 실제와 다르다`).toBe(p.candidates);
    }
    expect(pools.reduce((a, p) => a + p.storageGap, 0), "🔴 저장 공백이 생겼다 — 서술을 갱신해야 한다").toBe(0);
    /**
     * 🔴🔴 **음성 대조 M6 가 통과했다** — 제외 사유를 **비워도** 통과했다.
     *    🟢 그래서 **표본 가능 수와 제외 사유 분포** 를 잠근다(CPO §4 가 요구한 칸이다).
     */
    const usable = pools.filter((p) => p.excluded.length === 0);
    expect(usable, "🔴 표본 가능 원상품 수가 바뀌었다").toHaveLength(8);
    const reasonTally = pools
      .flatMap((p) => p.excluded)
      .reduce<Record<string, number>>((m, r) => {
        m[r] = (m[r] ?? 0) + 1;
        return m;
      }, {});
    expect(reasonTally["운영 brandModelCode 해석 불가"], "🔴 제외 사유 집계가 죽었다").toBe(7);
    /** 🔴 그리고 **제외 사유는 그 하나뿐** 이다 — 제목·URL·브랜드 결손은 **0** 이다. */
    expect(Object.keys(reasonTally).sort(), "🔴 제외 사유 종류가 바뀌었다").toEqual(["운영 brandModelCode 해석 불가"]);
    /** 🔴 후보 상세설명 저장은 **전건 0**(칸이 없다 · 측정 불가) */
    expect(pools.reduce((a, p) => a + p.candidateDescStored, 0)).toBe(0);
    /** 🔴 ① DB sku 와 운영 품번은 **다른 수** 다. */
    expect(pools.filter((p) => (p.dbSku ?? "").trim().length > 0).length, "🔴 DB sku 보유 수가 바뀌었다").toBe(6);
    expect(pools.filter((p) => p.opCode != null).length, "🔴🔴 운영 품번 해석 수가 바뀌었다").toBe(8);
    /**
     * 🔴🔴 **두 칸이 서로를 대체하지 않는다는 것을 수로 잠근다**(CPO ① 구분).
     * ```
     * DB sku 있는데 운영 품번 null   **3**  ← 판매처 자체 SKU(AAA…)라 운영이 안 쓴다
     * DB sku 없는데 운영 품번 있음   **5**  ← 설명문/slug 에서 해석된다
     * ```
     * 🔴 그래서 **DB 칸으로 「품번 유무」를 세면 양방향으로 틀린다**(UIED-04 1차 오류의 뿌리).
     */
    expect(pools.filter((p) => p.opCode == null && (p.dbSku ?? "").trim().length > 0).length).toBe(3);
    expect(pools.filter((p) => p.opCode != null && (p.dbSku ?? "").trim().length === 0).length).toBe(5);
    /** 🔴 그리고 `opCode` 가 null 인 행에는 **출처가 `NONE`** 이어야 한다(라벨 모순 금지). */
    for (const p of pools) {
      if (p.opCode == null) expect(p.opCodeSource, `🔴 ${p.group} 출처 라벨이 모순이다`).toBe("NONE");
      else expect(p.opCodeSource, `🔴 ${p.group} 출처가 비었다`).not.toBe("NONE");
    }
    /** 🔴 ② 후보 46 중 운영 SAME 은 **3** 이다 — 「후보 수 = SAME 수」가 아니다. */
    expect(pools.reduce((a, p) => a + p.same, 0), "🔴 비상의 운영 SAME 수가 바뀌었다").toBe(3);
    /** 🔴 ⑤ 사람 확인 기록은 **1건** 뿐이다. */
    expect(pools.reduce((a, p) => a + p.humanLabeled, 0), "🔴 사람 확인 수가 바뀌었다").toBe(1);
    /** 🔴 ③ 국내 후보는 **0** 이다 — 비상의 상품군에 국내 후보가 없다. */
    expect(pools.reduce((a, p) => a + p.krCandidates, 0), "🔴 비상의 국내 후보 수가 바뀌었다").toBe(0);
    /** 🔴 `AW26 DROP TWO` 는 **상품 유형이 아니다** — 그 사실을 잠근다. */
    expect(groupRank.find((g) => g.group === "AW26 DROP TWO")?.isRealType, "🔴 드롭명을 상품군으로 셌다").toBe(false);

    writeFileSync(
      join(FIX, "mmcs01-nontop-pool.json"),
      JSON.stringify(
        {
          note:
            "🔴 MMCS-01 조사 산출 · HTTP 0 · 표본 선정 0 · 판정 변경 0 · 라벨 0 · 2차 산출물. " +
            "분모 — 비상의 원상품 15 · 후보 46(전체 122/364 중). 🔴 CTO 가 표본을 확정하지 않았다.",
          excludedTopGroups: [...TOP_GROUPS],
          totals: {
            origins: pools.length,
            candidates: pools.reduce((a, p) => a + p.candidates, 0),
            kr: pools.reduce((a, p) => a + p.krCandidates, 0),
            overseas: pools.reduce((a, p) => a + p.overseasCandidates, 0),
            same: pools.reduce((a, p) => a + p.same, 0),
            human: pools.reduce((a, p) => a + p.humanLabeled, 0),
            dbSku: pools.filter((p) => (p.dbSku ?? "").trim().length > 0).length,
            opCode: pools.filter((p) => p.opCode != null).length,
          },
          groupRank,
          pools,
        },
        null,
        2,
      ),
      "utf8",
    );
  });

  it("C-1 🔴 **금지 전수 — 수집·선정·판정 변경을 하지 않았다**", () => {
    const self = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const banned of [
      ["facts", "FromProductUrl"].join(""),
      ["fetch", "PlainHtml"].join(""),
      ["compute", "MarketIntelligence"].join(""),
      ["price", "TierFromLink"].join(""),
      ["candidate", "reviews"].join("_"),
      "globalThis." + "fetch",
      ["brand", "description", "evidence"].join("-"),
      ["product", "name", "description", "evidence"].join("-"),
    ]) {
      expect(self, `🔴 금지 경로를 끌어왔다: ${banned}`).not.toContain(banned);
    }
    /**
     * 🔴🔴 **표본을 고르지 않았다** — 「선정/확정」 어휘가 코드에 **없다**.
     *    🟢 `excluded` 는 **사용 불가 사유 기록** 이고 선정이 아니다(CPO §4 가 요구한 칸).
     */
    for (const sel of [["select", "Sample"].join(""), ["chosen", "Sample"].join(""), ["confirm", "Sample"].join("")]) {
      expect(self, `🔴 표본을 골랐다: ${sel}`).not.toContain(sel);
    }
    /** 🟢 입력은 기존 산출물 둘뿐이다. */
    expect(self).toContain('read("mmse01-baseline.json")');
    expect(self).toContain('read("uied04-multigroup.json")');
    /** 🔴 alias 추가·8축 완화 어휘 0. */
    for (const b of [["BRAND", "_ALIASES"].join(""), ["SAME", "_MIN_AXES"].join("")]) {
      expect(self, `🔴 금지 축을 건드렸다: ${b}`).not.toContain(b);
    }
    /**
     * 🔴🔴 **소스 앵커 — 음성 대조 M5b 가 「데이터상 구별 불가」 였다.**
     *    저장 공백이 실제로 **전건 0** 이므로 그 칸을 `0` 으로 박아도 **행동으로는 같다**.
     *    🟢 그래서 **유도식 자체** 를 소스로 잠근다 — 지우면 FAIL 한다.
     *    🔴 그리고 ④ 구분(「없다」 ↔ 「저장 안 됨」)의 근거가 이 한 줄이다.
     */
    /** 🔴 **자기참조 함정 — 여덟 번째다.** 앵커 문자열을 그대로 적으면 **자기를 찾는다**. */
    expect(self, "🔴 저장 공백 유도식이 사라졌다").toContain(
      ["storageGap", ": declared - rs.length"].join(""),
    );
    /** 🔴 운영 품번 해석은 **owner 순서 그대로** 여야 한다(DB sku 를 끼워 넣으면 FAIL). */
    const order = self.indexOf("const a = extractLabeledProductCode(s.origin_desc);");
    expect(order, "🔴 운영 품번 해석 순서가 사라졌다").toBeGreaterThan(0);
    /** 🔴 같은 함정 — 금지어를 쪼개 적는다. */
    expect(
      self.slice(0, order),
      "🔴🔴 DB sku 를 운영 해석 «앞» 에 끼워 넣었다 — owner 순서가 아니다",
    ).not.toContain(["s.", "origin_sku"].join(""));
  });
});
