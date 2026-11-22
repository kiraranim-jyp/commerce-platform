/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-CANDIDATE-ELIGIBILITY-01 — **CEO 11 사례 재현 + 전수 영향 측정**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 조사·구현 검증 전용 — **추가 HTTP 0** · DB 0 · 8축 0 · threshold 0 ·
 *    SAME 승격 0 · 가격·등록·seller 0 · alias 추가 0 · 원본 데이터 파기 0.
 *
 * 🔴🔴 **CEO 확인 사례는 테스트 기준으로만 쓴다** — `human_verdict` 에 저장하지 않고
 *    운영 판정으로 자동 반영하지 않는다(CPO §3 명시).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractCodeLikeSlugSegment,
  extractCodeLikeTitleToken,
  extractLabeledProductCode,
  extractUrlSlug,
} from "@commerce/shared/src/product-facts";
import {
  ELIGIBILITY_REASON_TEXT,
  candidateModelCodeForConflict,
  GENERIC_NAME_TOKENS,
  evaluateCandidateEligibility,
  identifyingNameTokens,
  isCandidateEligibleForDisplay,
} from "../candidate-eligibility";

const FIX = join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "__tests__", "fixtures");
const read = (f: string): unknown => JSON.parse(readFileSync(join(FIX, f), "utf8"));

/**
 * 🔵 CPO §3 이 지정한 **CEO 확인 11 사례**. 🔴 CTO 가 라벨을 만들지 않았다 —
 *    대표님 판정 원문을 그대로 옮겼다.
 * 🔴 `expect` 는 **자격(유지/제외)** 이고 **SAME 판정이 아니다**:
 * ```
 * CEO SAME       ⟹ 자격 **유지** 여야 한다(지워지면 안 된다)
 * CEO DIFFERENT  ⟹ 대부분 **제외** 지만, 🔴 「브랜드·상품명은 맞으나 품번이 달라
 *                  다른 년도」(Dress/junioredition)는 **유지가 맞다** — 그것은
 *                  사람이 비교할 가치가 있는 후보이고 CPO §2 가 그렇게 적었다.
 * ```
 */
const CEO_CASES: {
  key: string;
  ceo: "SAME" | "DIFFERENT" | "HOLD";
  expect: "ELIGIBLE" | "EXCLUDED" | "UNVERIFIABLE";
  why: string;
}[] = [
  { key: "versace-kids-baby-boys-denim", ceo: "DIFFERENT", expect: "EXCLUDED", why: "브랜드·상품 식별 근거 없는 무관 후보" },
  { key: "gingham-woven-trousers", ceo: "DIFFERENT", expect: "EXCLUDED", why: "일반 상품명 단어 중복" },
  { key: "taxi-saurus-tag-denim-pants-by-bobo", ceo: "SAME", expect: "ELIGIBLE", why: "브랜드·품번·상품명 연결" },
  { key: "diesel-viker-jeans", ceo: "DIFFERENT", expect: "EXCLUDED", why: "다른 브랜드·상품" },
  { key: "polo-ralph-lauren-jeans", ceo: "DIFFERENT", expect: "EXCLUDED", why: "다른 브랜드·상품" },
  { key: "sparkle-blue-denim-jeans", ceo: "DIFFERENT", expect: "EXCLUDED", why: "일반 상품명 유사성만" },
  { key: "products/denim-blue-jeans", ceo: "DIFFERENT", expect: "EXCLUDED", why: "일반 상품명 유사성만" },
  { key: "donokids", ceo: "SAME", expect: "ELIGIBLE", why: "구조화는 달라도 상세설명 원문에 원상품 식별정보" },
  /**
   * 🔴🔴 **CPO 정정(MI-CANDIDATE-ELIGIBILITY-02)** — 1차에 「유지」로 적었다.
   *    근거는 「품번 차이는 판정이다」였는데 **CPO 가 그 해석을 뒤집었다**:
   *    「같은 브랜드의 **다른 시즌·다른 모델** 이 MI 후보에 계속 남는다」.
   * 🟢 실측 — 원상품 `BJ21` ↔ 후보 **`BJ87`**(설명문 `Product code BJ87`) ·
   *    CEO 「브랜드와 상품명은 맞으나, 품번이 달라 다른 년도 생산 제품임」.
   */
  { key: "exclusive-handsmock-dress-in-pink-tapestry", ceo: "DIFFERENT", expect: "EXCLUDED", why: "실제 모델 품번이 명확히 다르다(BJ21 ↔ BJ87)" },
  { key: "mixed-media-jacket-in-blue-mix-by-wynken", ceo: "SAME", expect: "ELIGIBLE", why: "품번·브랜드 연결 · 색상 변형" },
  { key: "wynken-jacke-mixed-media", ceo: "SAME", expect: "ELIGIBLE", why: "판매처 자체 품번이어도 브랜드 연결" },
];

interface LabelRow {
  group: string;
  originTitle: string;
  originBrand: string | null;
  originOpCode: string | null;
  candidates: {
    domain: string | null;
    url: string;
    candidateBrand: string | null;
    candidateCode: string | null;
    candidateTitle: string | null;
    descriptionRaw: string | null;
    systemVerdict: string | null;
    blockers: string[];
    market: string;
  }[];
}

describe("MCE01 — MI 후보 진입 자격", () => {
  /* ═══ A. 술어 자체 ═══════════════════════════════════════════════════════ */

  it("A-1 🔴 **일반 단어는 식별어가 아니다** — CPO 가 지명한 셋이 들어 있다", () => {
    for (const t of ["dress", "jacket", "pants"]) {
      expect(GENERIC_NAME_TOKENS, `🔴 CPO 지명 일반어가 빠졌다: ${t}`).toContain(t);
    }
    /** 🔴🔴 **고유 디자인명은 절대 일반어가 아니다** — 넣으면 유효 후보가 죽는다. */
    for (const t of ["taxi", "saurus", "handsmock", "otter", "wynken", "bonjour", "bobo"]) {
      expect(GENERIC_NAME_TOKENS, `🔴🔴 식별어를 일반어로 넣었다: ${t}`).not.toContain(t);
    }
    /** 🟢 식별 토큰 추출 — 일반어를 걷어낸다. */
    expect(identifyingNameTokens("Taxi Saurus Tag denim pants")).toEqual(["taxi", "saurus", "tag"]);
    expect(identifyingNameTokens("Denim Blue Jeans")).toEqual([]);
    expect(identifyingNameTokens("Gingham Woven Trousers")).toEqual([]);
    /** 🔴 사유 문장이 **전부** 있다(화면과 보고가 같은 말을 쓴다). */
    for (const k of Object.keys(ELIGIBILITY_REASON_TEXT)) {
      expect(ELIGIBILITY_REASON_TEXT[k as keyof typeof ELIGIBILITY_REASON_TEXT].length).toBeGreaterThan(5);
    }
  });

  it("A-2 🔴 **연결 근거가 있으면 충돌이 있어도 유지한다** — 순서가 계약이다", () => {
    /** 🟢 실측 모양 — 품번 일치 + `COLOR_VARIANT`(색상만 다른 같은 상품 · CEO SAME). */
    const r = evaluateCandidateEligibility({
      originBrand: "Wynken",
      originModelCode: "WK21W97",
      originTitle: "Mixed Media Jacket in Ecru Mix by Wynken",
      candidateBrand: "Wynken",
      candidateModelCode: "WK21W97",
      candidateTitle: "Mixed Media Jacket in Blue Mix by Wynken",
      conflicts: ["COLOR_VARIANT"],
    });
    expect(r.eligibility).toBe("ELIGIBLE");
    expect(r.reasons).toContain("CODE_LINK");
    /** 🔴 반대로 **근거가 없고** 충돌이 명확하면 제외다. */
    const x = evaluateCandidateEligibility({
      originBrand: "Bobo Choses",
      originTitle: "Taxi Saurus Tag denim pants",
      candidateBrand: "Diesel",
      candidateTitle: "Viker Jeans",
      conflicts: ["BRAND_MISMATCH"],
    });
    expect(x.eligibility).toBe("EXCLUDED");
    expect(x.reasons).toEqual(["EXPLICIT_CONFLICT"]);
  });

  it("A-3 🔴 **원문이 아예 없으면 「제외」가 아니라 「확인 불가」** 다", () => {
    const r = evaluateCandidateEligibility({ originBrand: "Bobo Choses", originTitle: "Taxi Saurus Tag denim pants" });
    expect(r.eligibility).toBe("UNVERIFIABLE");
    expect(r.reasons).toEqual(["NO_SOURCE_TEXT"]);
    /** 🟢 그리고 표시 게이트는 **확인 불가를 숨기지 않는다**. */
    expect(isCandidateEligibleForDisplay({ originBrand: "x", originTitle: "y" })).toBe(true);
  });

  it("A-4 🟢 **상세설명 원문으로 유지된다** — 구조화가 비어도(donokids 모양)", () => {
    const r = evaluateCandidateEligibility({
      originBrand: "Bobo Choses",
      originModelCode: "B226AC073",
      originTitle: "Taxi Saurus Tag denim pants",
      candidateBrand: null,
      candidateModelCode: null,
      candidateTitle: "[[보보쇼즈] Taxi Saurus Tag denim pants #226AC073]",
      candidateDescription: "[[보보쇼즈] Taxi Saurus Tag denim pants #226AC073]",
    });
    expect(r.eligibility).toBe("ELIGIBLE");
    /** 🟢 상품명 축 **그리고** 상세설명 축 둘 다 걸린다. */
    expect(r.reasons).toContain("NAME_LINK");
    expect(r.reasons).toContain("DESCRIPTION_LINK");
    expect(r.matchedNameTokens).toEqual(["taxi", "saurus", "tag"]);
    /**
     * 🔴 **접두 한 글자가 빠진 품번** 도 상세설명 축에서 받는다 — 🔴 단 느슨한
     *    부분일치가 아니다. 꼬리를 자른 꼴은 **받지 않는다**.
     */
    const tail = evaluateCandidateEligibility({
      originModelCode: "B226AC073",
      originTitle: "Zzz",
      candidateTitle: "aaa",
      candidateDescription: "품번 B226AC07 입니다",
    });
    expect(tail.eligibility, "🔴 꼬리를 자른 품번을 일치로 받았다").toBe("EXCLUDED");
  });

  it("A-5 🔵🔵 **실제 모델 품번이 다르면 제외한다** — 음성대조 N3·N4·N5 보강", () => {
    /**
     * 🔴🔴 **N3·N4·N5 가 22건에서 통과했다** — 그 셋은 다른 축(브랜드 충돌 ·
     *    상품명 연결)이 이미 덮어서 **효과가 보이지 않는다**. 🟢 그래서 술어를
     *    **직접** 단언한다(규칙이 사라지면 여기서 FAIL 한다).
     */
    const base = {
      originBrand: "Bonjour",
      originModelCode: "BJ21",
      originTitle: "Handsmock Dress in Little Bouquet by Bonjour",
      candidateBrand: "Bonjour",
      candidateTitle: "Handsmock Dress in Pink Tapestry by Bonjour",
    };
    /** 🔴 **모델 품번 충돌** — 브랜드·상품명이 맞아도 제외다(CPO 정정). */
    const conflict = evaluateCandidateEligibility({
      ...base,
      candidateModelCode: "BJ87",
      candidateDescription: "Handsmock Dress by Bonjour. Product code BJ87 AW26",
    });
    expect(conflict.eligibility).toBe("EXCLUDED");
    expect(conflict.reasons).toEqual(["MODEL_CODE_CONFLICT"]);

    /** 🟢 **N3** — 판매처 자체 SKU(숫자만)는 모델 품번으로 쓰지 않는다 ⟹ 유지. */
    expect(candidateModelCodeForConflict("7400851022", null), "🔴 숫자만을 모델 품번으로 썼다").toBeNull();
    const sellerSku = evaluateCandidateEligibility({
      ...base,
      candidateModelCode: "7400851022",
      candidateDescription: "Diese Jacke …",
    });
    expect(sellerSku.eligibility, "🔴🔴 판매처 자체 SKU 차이로 제외했다").not.toBe("EXCLUDED");

    /** 🟢 **N4** — 라벨 없는 우연한 문자열은 모델 품번이 아니다 ⟹ 유지. */
    expect(candidateModelCodeForConflict(null, "… A2202 … J50690 …"), "🔴 라벨 없는 문자열을 품번으로 썼다").toBeNull();
    expect(candidateModelCodeForConflict(null, "Made in Spain. Product code BJ87 AW26")).toBe("BJ87");
    const noLabel = evaluateCandidateEligibility({ ...base, candidateDescription: "… A2202 … J50690 …" });
    expect(noLabel.eligibility, "🔴 라벨 없는 문자열로 제외했다").not.toBe("EXCLUDED");

    /** 🟢 **N5** — 접두 한 글자 누락은 **일치** 다(donokids 실측) ⟹ 충돌이 아니다. */
    const prefixDrop = evaluateCandidateEligibility({
      originBrand: "Bobo Choses",
      originModelCode: "B226AC073",
      originTitle: "Taxi Saurus Tag denim pants",
      candidateModelCode: "226AC073",
      candidateTitle: "zzz",
    });
    expect(prefixDrop.eligibility, "🔴🔴 접두 누락 품번을 충돌로 읽었다").toBe("ELIGIBLE");
    expect(prefixDrop.reasons).toContain("CODE_LINK");

    /** 🔴 **N6** — 색상 변형은 충돌 토큰이 아니다(품번 일치면 유지). */
    const colorVariant = evaluateCandidateEligibility({
      originBrand: "Wynken",
      originModelCode: "WK21W97",
      originTitle: "Mixed Media Jacket in Ecru Mix by Wynken",
      candidateModelCode: "WK21W97",
      candidateTitle: "Mixed Media Jacket in Blue Mix by Wynken",
      conflicts: ["COLOR_VARIANT"],
    });
    expect(colorVariant.eligibility, "🔴 색상 변형으로 제외했다").toBe("ELIGIBLE");

    /** 🔴 품번 **비교 불가** 면 나머지 근거를 쓴다(제외하지 않는다). */
    const noCode = evaluateCandidateEligibility({ ...base, candidateModelCode: null, candidateDescription: null });
    expect(noCode.eligibility).toBe("ELIGIBLE");
    expect(noCode.reasons).toContain("BRAND_LINK");
  });

  /* ═══ B. CEO 11 사례 재현 ═══════════════════════════════════════════════ */

  it("B-1 🔵🔵 **CEO 확인 11 사례를 전부 재현한다**", () => {
    const d = read("mmcl01-ceo-label.json") as { rows: LabelRow[] };
    const all = d.rows.flatMap((r) =>
      r.candidates.map((c) => ({
        origin: r,
        c,
        result: evaluateCandidateEligibility({
          originBrand: r.originBrand,
          originModelCode: r.originOpCode,
          originTitle: r.originTitle,
          candidateBrand: c.candidateBrand,
          candidateModelCode: c.candidateCode,
          candidateTitle: c.candidateTitle,
          candidateDescription: c.descriptionRaw,
          conflicts: c.blockers,
        }),
      })),
    );
    expect(all, "🔴 후보 22 가 아니다").toHaveLength(22);

    /* eslint-disable no-console */
    console.log("\n═══ CEO 11 사례 재현 ═══");
    const misses: string[] = [];
    for (const k of CEO_CASES) {
      const hit = all.find((x) => x.c.url.includes(k.key));
      expect(hit, `🔴 사례 URL 을 못 찾았다: ${k.key}`).toBeTruthy();
      const got = hit!.result.eligibility;
      const ok = got === k.expect;
      if (!ok) misses.push(`${k.key}: ${k.expect} 기대 → ${got}`);
      console.log(
        `  ${ok ? "🟢" : "🔴"} CEO=${k.ceo.padEnd(9)} 기대=${k.expect.padEnd(12)} 결과=${got.padEnd(12)}` +
          ` [${hit!.result.reasons.join(",")}]  ${k.key.slice(0, 40)}`,
      );
    }
    console.log("\n═══ 22건 전수 자격 ═══");
    for (const x of all) {
      console.log(
        `  ${String(x.c.domain ?? "(없음)").padEnd(22)} ${x.result.eligibility.padEnd(12)}` +
          ` ${x.result.reasons.join(",").padEnd(34)} ${String(x.c.candidateTitle ?? "").slice(0, 44)}`,
      );
    }
    const tally = all.reduce<Record<string, number>>((m, x) => {
      m[x.result.eligibility] = (m[x.result.eligibility] ?? 0) + 1;
      return m;
    }, {});
    console.log("\n  자격 분포: " + JSON.stringify(tally));
    /* eslint-enable no-console */

    expect(misses, "🔴🔴 CEO 사례 재현 실패").toEqual([]);
  });

  it("B-2 🔵 **CEO SAME 4건은 하나도 지워지지 않는다**(오제외 0)", () => {
    const d = read("mmcl01-ceo-label.json") as { rows: LabelRow[] };
    const sameKeys = CEO_CASES.filter((k) => k.ceo === "SAME").map((k) => k.key);
    expect(sameKeys, "🔴 CEO SAME 사례 수가 바뀌었다").toHaveLength(4);
    for (const key of sameKeys) {
      const found = d.rows
        .flatMap((r) => r.candidates.map((c) => ({ r, c })))
        .find((x) => x.c.url.includes(key));
      expect(found, `🔴 ${key} 를 못 찾았다`).toBeTruthy();
      const got = evaluateCandidateEligibility({
        originBrand: found!.r.originBrand,
        originModelCode: found!.r.originOpCode,
        originTitle: found!.r.originTitle,
        candidateBrand: found!.c.candidateBrand,
        candidateModelCode: found!.c.candidateCode,
        candidateTitle: found!.c.candidateTitle,
        candidateDescription: found!.c.descriptionRaw,
        conflicts: found!.c.blockers,
      });
      expect(got.eligibility, `🔴🔴 CEO SAME 을 제외했다: ${key}`).not.toBe("EXCLUDED");
    }
  });

  /* ═══ C. 반사실 + 전수 영향 ═════════════════════════════ */

  it("C-1 🔴🔴 **반사실 — 일반 단어를 식별어로 세면 무관 후보가 되살아난다**", () => {
    const d = read("mmcl01-ceo-label.json") as { rows: LabelRow[] };
    /**
     * 🔴 22건 제외가 **전부 `EXPLICIT_CONFLICT`** 로 나왔다 ⟹ 「일반 단어 규칙이
     *    기여하지 않았다」로 읽힐 수 있다. 🟢 그래서 **그 규칙만 끈** 반사실을 잰다:
     *    「원상품 제목 토큰을 **일반어 제거 없이** 세고 2개 이상 겹치면 NAME_LINK」.
     * 🔴 그러면 **충돌 판정보다 NAME_LINK 가 먼저** 걸려 유지로 뒤집힌다
     *    (이 파일 술어의 순서가 그렇다 — 연결 근거가 있으면 충돌을 보지 않는다).
     */
    const rawTokens = (t: string | null) => [
      ...new Set(
        (t ?? "").toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").split(/\s+/).filter((x) => x.length >= 3),
      ),
    ];
    const rescued: string[] = [];
    for (const r of d.rows) {
      const raw = rawTokens(r.originTitle);
      for (const c of r.candidates) {
        const real = evaluateCandidateEligibility({
          originBrand: r.originBrand,
          originModelCode: r.originOpCode,
          originTitle: r.originTitle,
          candidateBrand: c.candidateBrand,
          candidateModelCode: c.candidateCode,
          candidateTitle: c.candidateTitle,
          candidateDescription: c.descriptionRaw,
          conflicts: c.blockers,
        });
        if (real.eligibility !== "EXCLUDED") continue;
        const cn = (c.candidateTitle ?? "").toLowerCase();
        const overlap = raw.filter((t) => cn.includes(t));
        /** 🔴 술어와 **같은 임계** 로 비교한다(식별어 1개 원상품 고려). */
        if (overlap.length >= (raw.length <= 1 ? 1 : 2)) rescued.push(`${c.domain} ← ${overlap.join("+")}`);
      }
    }
    /* eslint-disable no-console */
    console.log("\n═══ C-1 ​반사실: 일반어를 식별어로 세면 되살아나는 무관 후보 ═══");
    for (const x of rescued) console.log("  🔴 " + x);
    console.log(`  ⇒ ${rescued.length}건이 되살아난다 — 일반 단어 규칙이 막고 있는 수다`);
    /* eslint-enable no-console */
    /** 🟢 그 수가 **0 이 아니어야** 일반 단어 규칙에 실효가 있다. */
    expect(rescued.length, "🔴 일반 단어 규칙이 아무것도 막지 않는다").toBeGreaterThanOrEqual(1);
  });

  it("C-2 🔵🔵 **전수 364 영향 측정** — 제외·유지·확인 불가와 사유 분포", () => {
    const base = read("mmse01-baseline.json") as {
      bySnapshot: {
        snapshot_id: string;
        origin_brand: string | null;
        origin_sku: string | null;
        origin_title: string | null;
        origin_desc: string | null;
        source_url: string | null;
        shopify_type: string | null;
      }[];
      rows: {
        snapshot_id: string | null;
        candidate_url: string;
        candidate_domain: string | null;
        candidate_title: string | null;
        market: string | null;
        system_verdict: string | null;
        blockers: unknown;
      }[];
    };
    const snap = new Map(base.bySnapshot.map((s) => [s.snapshot_id, s]));
    const rows = base.rows.filter((r) => r.snapshot_id != null);
    expect(rows, "🔴 분모가 364 가 아니다").toHaveLength(364);

    const tally: Record<string, number> = {};
    const why: Record<string, number> = {};
    let keptSame = 0;
    let droppedSame = 0;
    let krKept = 0;
    let krBefore = 0;
    for (const r of rows) {
      const s = snap.get(r.snapshot_id!);
      /**
       * 🔴🔴 **후보 구조화 브랜드·품번은 저장되지 않는다**(MMCS-01 실측 0/364).
       *    🟢 그래서 전수에서는 **제목 + 저장 blocker** 로만 자격을 본다 —
       *    🔴 이 측정은 **하한** 이다(상세설명·구조화가 있으면 더 살아난다).
       */
      /**
       * 🔵🔵 MI-CANDIDATE-ELIGIBILITY-02 — **원상품 운영 품번을 넘긴다.**
       *    🔴 1차에 `null` 로 비워 새 축(모델 품번 충돌)이 **발화하지 않았다** ⟹
       *       「전수에서 영향 0」이 **측정이 아니라 미발화** 였다.
       *    🟢 owner 순서 그대로 해석한다(설명문 → 제목 → URL slug · DB `sku` 아님).
       */
      const originCode =
        extractLabeledProductCode(s?.origin_desc ?? null) ??
        extractCodeLikeTitleToken(s?.origin_title ?? null) ??
        extractCodeLikeSlugSegment(extractUrlSlug(s?.source_url ?? null));
      const res = evaluateCandidateEligibility({
        originBrand: s?.origin_brand ?? null,
        originModelCode: originCode,
        originTitle: s?.origin_title ?? null,
        candidateTitle: r.candidate_title,
        conflicts: Array.isArray(r.blockers) ? (r.blockers as string[]) : null,
      });
      tally[res.eligibility] = (tally[res.eligibility] ?? 0) + 1;
      for (const x of res.reasons) why[x] = (why[x] ?? 0) + 1;
      if (r.market === "KR") krBefore += 1;
      if (res.eligibility !== "EXCLUDED") {
        if (r.market === "KR") krKept += 1;
        if (r.system_verdict === "SAME") keptSame += 1;
      } else if (r.system_verdict === "SAME") droppedSame += 1;
    }
    /* eslint-disable no-console */
    console.log("\n═══ C-2 ​전수 364 영향(🔴 하한 — 후보 구조화·상세설명 미저장) ═══");
    console.log("  자격 분포: " + JSON.stringify(tally));
    console.log("  사유 분포: " + JSON.stringify(why));
    console.log(`  🔴 기존 운영 SAME — 유지 ${keptSame} / 제외 ${droppedSame}`);
    console.log(`  🇰🇷 국내 후보 — 기존 ${krBefore} → 유지 ${krKept}`);
    /* eslint-enable no-console */
    /** 🔴🔴 **기존 운영 SAME 을 하나도 지우지 않는다**(CPO 성공 기준 ④). */
    expect(droppedSame, "🔴🔴 기존 운영 SAME 을 제외했다").toBe(0);
    expect(tally.EXCLUDED, "🔴 제외가 0 이면 아무것도 고치지 못했다").toBeGreaterThan(0);
    /**
     * 🔴🔴 **음성 대조 M6·M7 이 통과했다 — 그 둘은 22건에서 효과가 안 보인다.**
     * ```
     * M6 브랜드를 **후보 제목에서** 찾는 경로 제거   ⟹ 전수에서 BRAND_LINK 가 줄어든다
     * M7 식별어 1개 원상품의 임계를 2로              ⟹ 운영 SAME 2건이 다시 제외된다
     * ```
     * 🟢 그래서 **전수 실측값** 으로 잠근다(이 숫자가 바뀌면 FAIL 한다).
     */
    expect(tally.ELIGIBLE, "🔴 유지 수가 바뀌었다").toBe(200);
    expect(tally.EXCLUDED, "🔴 제외 수가 바뀌었다").toBe(159);
    expect(tally.UNVERIFIABLE, "🔴 확인 불가 수가 바뀌었다").toBe(5);
    expect(keptSame, "🔴 운영 SAME 유지 수가 바뀌었다").toBe(83);
    expect(krKept, "🔴🔴 국내 후보가 줄었다").toBe(krBefore);
    /** 🔴 M6 — 제목에서 브랜드를 찾는 경로가 **140건** 을 살린다. */
    expect(why.BRAND_LINK, "🔴 브랜드 연결 수가 바뀌었다 — 제목 조회 경로를 확인하라").toBe(140);
    expect(why.NAME_LINK, "🔴 상품명 연결 수가 바뀌었다").toBe(198);
    /** 🔴 일반어만 겹친 제외와 근거 없음 제외를 **갈라** 잠근다. */
    expect(why.GENERIC_TOKENS_ONLY, "🔴 일반어 제외 수가 바뀌었다").toBe(2);
    expect(why.EXPLICIT_CONFLICT, "🔴 충돌 제외 수가 바뀌었다").toBe(156);
    /**
     * 🔴🔴 **새 축(모델 품번 충돌)은 전수에서 «발화하지 않는다» — 그 사실을 잠근다.**
     *    `candidate_reviews` 에 **후보 구조화 품번·상세설명 칸이 없다**(MMCS-01 실측 0/364)
     *    ⟹ `candidateModelCodeForConflict` 가 전건 `null` 이고 비교가 성립하지 않는다.
     * 🔴 그래서 「전수에서 영향 0」을 **「안전하다」로 읽지 않는다** — **측정 불가** 다.
     * 🟢 그 축의 실측은 **라이브 관측 22건**(B-1)에서만 가능하다.
     */
    expect(why.MODEL_CODE_CONFLICT ?? 0, "🔴 전수에서 새 축이 발화했다 — 서술을 갱신해야 한다").toBe(0);
    const candCodes = rows.filter(
      (r) => candidateModelCodeForConflict(null, null) != null || (r as { candidate_brand?: unknown }).candidate_brand != null,
    );
    expect(candCodes, "🔴 후보 품번·브랜드가 저장되기 시작했다 — 새 축을 전수로 재야 한다").toHaveLength(0);
    /** 🟢 **원상품 품번은 실제로 해석됐다**(미발화 원인이 후보 측임을 증명한다). */
    const withOriginCode = base.bySnapshot.filter(
      (s) =>
        (extractLabeledProductCode(s.origin_desc) ??
          extractCodeLikeTitleToken(s.origin_title) ??
          extractCodeLikeSlugSegment(extractUrlSlug(s.source_url))) != null,
    );
    expect(withOriginCode, "🔴 원상품 품번 해석 수가 바뀌었다").toHaveLength(115);
  });
});
