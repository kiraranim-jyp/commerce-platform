/**
 * ════════════════════════════════════════════════════════════════════════════
 * KIDS 핵심 증거 «충돌» 게이트 반사실 — BRAND / MODEL_CODE / PRODUCT_NAME 분리 (평가 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 변경 0 · verdict 변경 0 · 점수·threshold 0 · 가격 자격 0 · HTTP 0 · 수집 0 · DB 0.**
 * 🔴 B-38 재개 **0** — 후보 `brandModelCode` 를 운영에 채우지 않는다(여기서는 **분류용 관측** 이다).
 * 🔴🔴 **가정 게이트** 를 세어 보는 것이지 코드에 넣는 것이 아니다:
 *    「해당 충돌 유형이 있으면 `PRESUMED_SAME` 을 주지 않는다」가 **독립 적용** 됐을 때의 효과.
 * 🔴 기준은 **저장된 운영 verdict** 다(`system_verdict`·`price_tier`) — 재계산하지 않는다.
 * 🔴 **단순 토큰 불일치를 제품 정체성 충돌로 취급하지 않는다**(CPO 명시) ⟹ 유형 ③은
 *    **측정만** 하고 **게이트 후보에서 제외** 한다. 가르는 축은 **상세설명의 확증 제품명** 이다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { brandsCompatible } from "@commerce/crawler/src/comparison-search/cross-seller";
import { productFactsFromListing } from "@commerce/crawler/src/comparison-search/seller-facts";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";
import { extractLabeledProductCode } from "@commerce/shared/src/product-facts";
import { analyzeProductNameDescriptionEvidence } from "@commerce/crawler/src/comparison-search/product-name-description-evidence";

const DIR = __dirname;
const EVID = path.join(DIR, "fixtures", "mi-reeval-03-keyword-input.json");
const STORED = path.join(DIR, "fixtures", "mi-reeval-01-db-human.json");
const OUT_DIR = path.join(DIR, "preserved");
const OUT = path.join(OUT_DIR, "kids-conflict-gate-counterfactual.json");

type EvidPair = {
  originCode: string | null;
  candidateUrl: string | null;
  candidateDomain: string | null;
  humanGt: string | null;
  origin: { title?: string | null; description?: string | null; brand?: string | null };
  candidate: { title?: string | null; description?: string | null };
};
type StoredRow = {
  origin_code?: string | null;
  candidate_url?: string | null;
  human_verdict?: string | null;
  system_verdict?: string | null;
  price_tier?: string | null;
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const has = (v: unknown): boolean => s(v).length > 0;
const key = (c: unknown, u: unknown) => `${s(c).toUpperCase()}|${s(u)}`;
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim();

describe("KIDS 증거 충돌 게이트 반사실 (평가 전용 · 운영 변경 0)", () => {
  const evid = (JSON.parse(readFileSync(EVID, "utf8")) as { pairs: EvidPair[] }).pairs;
  const storedRaw = JSON.parse(readFileSync(STORED, "utf8")) as unknown;
  const stored: StoredRow[] = Array.isArray(storedRaw)
    ? (storedRaw as StoredRow[])
    : (Object.values(storedRaw as Record<string, unknown>).find((v) => Array.isArray(v)) as StoredRow[]);
  const byKey = new Map<string, StoredRow>();
  for (const r of stored) byKey.set(key(r.origin_code, r.candidate_url), r);

  it("충돌 유형을 분리해 독립 게이트 효과를 측정하고 preserved/ 에 보존한다", () => {
    const scope = evid
      .map((p) => ({ p, st: byKey.get(key(p.originCode, p.candidateUrl)) }))
      .filter(({ p, st }) => Boolean(st) && has(p.humanGt) && has(st?.system_verdict));

    const rows = scope.map(({ p, st }) => {
      const originCode = s(p.originCode);
      const oDesc = s(p.origin.description);
      const cDesc = s(p.candidate.description);
      const oTitle = s(p.origin.title);
      const cTitle = s(p.candidate.title);

      // ── ① BRAND 명시적 충돌 (양쪽 모두 읽혔고 서로 안 맞을 때만)
      const oBrand =
        s(p.origin.brand) || findBrandAliasMentions(oDesc).map((m) => m.brand)[0] || "";
      const cBrands = [
        ...new Set(
          [...findBrandAliasMentions(cTitle), ...findBrandAliasMentions(cDesc)].map((m) => m.brand),
        ),
      ];
      const brandConflict =
        Boolean(oBrand) && cBrands.length > 0 && !cBrands.some((b) => brandsCompatible(oBrand, b));

      // ── ② MODEL_CODE 명시적 충돌 (후보 «자신의» 라벨 품번이 있고 다를 때만)
      const cOwnCode = extractLabeledProductCode(cDesc);
      const cmp = cOwnCode && originCode ? compareModelCode(originCode, cOwnCode) : "unavailable";
      const codeConflict = cmp === "conflict";

      // ── ③ PRODUCT_NAME «토큰» 불일치 — 🔴 정체성 충돌로 쓰지 않는다(측정만)
      const oFacts = productFactsFromListing({
        title: oTitle || "(없음)",
        url: s(p.candidateUrl) || "about:blank",
        brand: s(p.origin.brand) || null,
        description: oDesc || null,
      });
      const cFacts = productFactsFromListing({
        title: cTitle || "(없음)",
        url: s(p.candidateUrl) || "about:blank",
        description: cDesc || null,
      });
      const sharedTokens = oFacts.coreTitleTokens.filter((t) => cFacts.coreTitleTokens.includes(t));
      const titleTokenConflict = has(oTitle) && has(cTitle) && sharedTokens.length === 0;

      // ── ④⑤ 상세설명의 «확증 제품명» 으로 가른다(운영 owner · 관찰 전용)
      const oName = analyzeProductNameDescriptionEvidence({ title: oTitle, description: oDesc });
      const cName = analyzeProductNameDescriptionEvidence({ title: cTitle, description: cDesc });
      const oCorr = s(oName.corroborated);
      const cCorr = s(cName.corroborated);
      const bothCorroborated = Boolean(oCorr && cCorr);
      const corroboratedAgree =
        bothCorroborated && (norm(oCorr) === norm(cCorr) || norm(cCorr).includes(norm(oCorr)) || norm(oCorr).includes(norm(cCorr)));
      /** 유형 ⑤ — 상세설명에서도 제품 정체성이 충돌한다(확증 이름이 둘 다 있고 다르다). */
      const descriptionIdentityConflict = bothCorroborated && !corroboratedAgree;
      /** 유형 ④ — 목록 제목만 충돌하고 상세설명 확증 이름은 일치한다. */
      const titleOnlyConflict = titleTokenConflict && corroboratedAgree;

      const type =
        brandConflict
          ? "1_BRAND_CONFLICT"
          : codeConflict
            ? "2_MODEL_CODE_CONFLICT"
            : descriptionIdentityConflict
              ? "5_DESCRIPTION_IDENTITY_CONFLICT"
              : titleOnlyConflict
                ? "4_TITLE_ONLY_CONFLICT"
                : titleTokenConflict
                  ? "3_TITLE_TOKEN_CONFLICT_ONLY"
                  : "6_INSUFFICIENT";

      return {
        originCode,
        host: p.candidateDomain,
        candidateUrl: p.candidateUrl,
        gt: p.humanGt,
        storedVerdict: st?.system_verdict ?? null,
        storedTier: st?.price_tier ?? null,
        type,
        signals: {
          brandConflict,
          codeConflict,
          titleTokenConflict,
          descriptionIdentityConflict,
          titleOnlyConflict,
          originBrand: oBrand || null,
          candidateBrands: cBrands,
          candidateOwnCode: cOwnCode,
          compareModelCode: cmp,
          originCorroboratedName: oCorr || null,
          candidateCorroboratedName: cCorr || null,
          /** 🔴 고유 이름이 아니다 — owner 가 그렇게 분류한다. */
          originProductTypes: oName.productTypes,
          candidateProductTypes: cName.productTypes,
          sharedTitleTokens: sharedTokens,
        },
      };
    });

    const isPresumed = (v: string | null) => v === "PRESUMED_SAME";
    /** 가정 게이트 — 「그 충돌이 있으면 PRESUMED_SAME 을 주지 않는다」 */
    const gate = (name: string, hit: (r: (typeof rows)[number]) => boolean) => {
      const presumed = rows.filter((r) => isPresumed(r.storedVerdict));
      const flipped = presumed.filter(hit);
      return {
        gate: name,
        presumedBefore: presumed.length,
        flipped: flipped.length,
        presumedAfter: presumed.length - flipped.length,
        gtDifferentContaminationRemoved: flipped.filter((r) => r.gt === "DIFFERENT").length,
        /** 🔴 부작용 — GT SAME 을 잃는가. */
        gtSameLost: flipped.filter((r) => r.gt === "SAME").length,
        gtSimilarChanged: flipped.filter((r) => r.gt === "SIMILAR").length,
        comparisonTierRemoved: flipped.filter((r) => r.storedTier === "COMPARISON").length,
        cases: flipped.map((r) => ({ host: r.host, gt: r.gt, tier: r.storedTier, type: r.type })),
      };
    };

    const artifact = {
      note:
        "🔴 평가 전용 · 운영 변경 0 · verdict 재계산 0 · 점수/threshold 0 · 가격 자격 0 · B-38 재개 0. " +
        "기준은 저장된 운영 verdict(system_verdict · price_tier) 다. " +
        "게이트는 «가정» 이다 — 코드에 넣지 않았다. " +
        "🔴 유형 ③(토큰 불일치 단독)은 CPO 명시대로 정체성 충돌로 쓰지 않는다 — 측정만 한다. " +
        "productTypes 는 고유 이름이 아니다(owner 분류). 분모는 조인·GT·저장 verdict 가 셋 다 있는 행이다.",
      denominator: {
        scope: rows.length,
        gt: rows.reduce<Record<string, number>>((a, r) => {
          const k = r.gt as string;
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        storedVerdict: rows.reduce<Record<string, number>>((a, r) => {
          const k = r.storedVerdict as string;
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        notMerged: { evidencePairs: 109, bothSideFullText: 16, identityAxisPairs: 26 },
      },
      byType: rows.reduce<Record<string, Record<string, number>>>((a, r) => {
        a[r.type] = a[r.type] ?? {};
        const g = r.gt as string;
        a[r.type][g] = (a[r.type][g] ?? 0) + 1;
        return a;
      }, {}),
      gates: [
        gate("①_BRAND_CONFLICT", (r) => r.signals.brandConflict),
        gate("②_MODEL_CODE_CONFLICT", (r) => r.signals.codeConflict),
        gate("⑤_DESCRIPTION_IDENTITY_CONFLICT", (r) => r.signals.descriptionIdentityConflict),
        gate("①+②", (r) => r.signals.brandConflict || r.signals.codeConflict),
        gate("①+②+⑤", (r) =>
          r.signals.brandConflict || r.signals.codeConflict || r.signals.descriptionIdentityConflict,
        ),
        /** 🔴 금지 후보 — 참고로만 센다(CPO: 토큰 불일치를 정체성 충돌로 쓰지 않는다). */
        gate("🔴참고_③_TITLE_TOKEN_ONLY", (r) => r.signals.titleTokenConflict),
      ],
      unmeasurable: {
        note:
          "🔴 0 으로 세지 않는다 — 조인/GT/저장 verdict 중 하나라도 없는 행은 분모 밖이다. " +
          "유형 ④⑤ 는 양쪽 «확증 제품명» 이 둘 다 있어야 가를 수 있다.",
        bothCorroboratedAbsent: rows.filter(
          (r) => !r.signals.originCorroboratedName || !r.signals.candidateCorroboratedName,
        ).length,
      },
      rows,
    };

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify(artifact, null, 1), "utf8");

    // 🔴 사실 단언만 둔다.
    expect(rows.length).toBeGreaterThan(0);
    expect(artifact.gates.length).toBe(6);
  });
});
