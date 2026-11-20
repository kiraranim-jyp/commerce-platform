/**
 * ════════════════════════════════════════════════════════════════════════════
 * 원상품 PRODUCT_NAME — OBSERVED 미승격 «사유» 전수 분류 (평가 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **승격 조건 변경 0 · OBSERVED→CORROBORATED 승격 0 · verdict 재계산 0 ·
 *    운영 판정 연결 0 · 계약 변경 0 · DB 0 · 수집 0 · HTTP 0 · 배포 0.**
 * 🔴 목적은 **CORROBORATED 숫자를 늘리는 것이 아니라** 「실제 고유 제품명을 잘못 버리는가」다.
 * 🔴🔴 **재현 한계를 먼저 적는다** — owner 의 `usable` 계산은 비공개 `uniqueOf()` 를 쓴다.
 *    이 하니스는 그것을 **호출할 수 없다** ⟹ 관측 가능한 칸
 *    (`productAttributable` · `genericTypeOnly` · `contextKind` · `source`)으로만 가른다.
 *    🔴 그 범위를 넘는 행은 **`UNDETERMINED`** 로 둔다(억지로 배정하지 않는다).
 * 🟢 상태(`state`)는 owner 가 준 값을 그대로 쓴다 — 내가 재계산하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { analyzeProductNameDescriptionEvidence } from "@commerce/crawler/src/comparison-search/product-name-description-evidence";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";
import { extractLabeledProductCodes } from "@commerce/shared/src/product-facts";

const DIR = __dirname;
const EVID = path.join(DIR, "fixtures", "mi-reeval-03-keyword-input.json");
const STORED = path.join(DIR, "fixtures", "mi-reeval-01-db-human.json");
const OUT_DIR = path.join(DIR, "preserved");
const OUT = path.join(OUT_DIR, "kids-origin-name-nonpromotion.json");

type EvidPair = {
  originCode: string | null;
  candidateUrl: string | null;
  candidateDomain: string | null;
  humanGt: string | null;
  origin: { title?: string | null; description?: string | null };
};
type StoredRow = { origin_code?: string | null; candidate_url?: string | null; system_verdict?: string | null };

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const has = (v: unknown): boolean => s(v).length > 0;
const key = (c: unknown, u: unknown) => `${s(c).toUpperCase()}|${s(u)}`;
const clip = (v: string, n = 160) => (v.length > n ? `${v.slice(0, n)}…` : v);

type Reason =
  | "NO_UNIQUE_NAME_OBSERVED"
  | "GENERIC_TYPE_ONLY"
  | "DIRECT_SINGLE_SOURCE"
  | "MULTIPLE_SOURCE_NOT_CORROBORATED"
  | "OTHER_REASON"
  | "UNDETERMINED";

describe("원상품 PRODUCT_NAME 미승격 사유 분류 (평가 전용 · 승격 0)", () => {
  const evid = (JSON.parse(readFileSync(EVID, "utf8")) as { pairs: EvidPair[] }).pairs;
  const storedRaw = JSON.parse(readFileSync(STORED, "utf8")) as unknown;
  const stored: StoredRow[] = Array.isArray(storedRaw)
    ? (storedRaw as StoredRow[])
    : (Object.values(storedRaw as Record<string, unknown>).find((v) => Array.isArray(v)) as StoredRow[]);
  const byKey = new Map<string, StoredRow>();
  for (const r of stored) byKey.set(key(r.origin_code, r.candidate_url), r);

  it("원상품 미승격 사유를 전수 분류하고 preserved/ 에 보존한다", () => {
    const rows = evid.map((p) => {
      const title = s(p.origin.title);
      const desc = s(p.origin.description);
      const ev = analyzeProductNameDescriptionEvidence({ title, description: desc });

      const obs = ev.observations as unknown as Array<{
        raw: string;
        source: string;
        contextKind?: string;
        productAttributable?: boolean;
        genericTypeOnly?: boolean;
        producer?: string;
      }>;

      /** 🔴 **대용치** — owner 의 `usable` 이 아니다(비공개 `uniqueOf` 미호출). */
      const attributable = obs.filter((o) => o.productAttributable === true);
      const nonGeneric = attributable.filter((o) => o.genericTypeOnly !== true);
      const direct = nonGeneric.filter((o) => o.contextKind === "DIRECT");
      const directSources = [...new Set(direct.map((o) => o.source))];

      let reason: Reason;
      if (ev.state === "CORROBORATED") reason = "MULTIPLE_SOURCE_NOT_CORROBORATED"; // 발생 시 뒤집힘 신호
      else if (obs.length === 0 || attributable.length === 0) reason = "NO_UNIQUE_NAME_OBSERVED";
      else if (nonGeneric.length === 0) reason = "GENERIC_TYPE_ONLY";
      else if (direct.length === 0) reason = "OTHER_REASON"; // 전부 COMPARATIVE 문맥
      else if (directSources.length === 1) reason = "DIRECT_SINGLE_SOURCE";
      else if (directSources.length >= 2) reason = "UNDETERMINED"; // 🔴 두 출처인데 미승격 ⟹ uniqueOf 영역
      else reason = "UNDETERMINED";

      const st = byKey.get(key(p.originCode, p.candidateUrl));

      return {
        originCode: s(p.originCode),
        host: p.candidateDomain,
        gt: p.humanGt,
        joinedToStored: Boolean(st),
        storedVerdict: st?.system_verdict ?? null,
        ownerState: ev.state,
        reason,
        /** 🟢 owner 가 적은 사유 원문 — 내가 쓴 것이 아니다. */
        ownerReasons: ev.reasons,
        productTypes: ev.productTypes,
        directSources,
        observations: obs.map((o) => ({
          raw: clip(o.raw, 90),
          source: o.source,
          producer: o.producer ?? null,
          contextKind: o.contextKind ?? null,
          productAttributable: o.productAttributable ?? null,
          genericTypeOnly: o.genericTypeOnly ?? null,
        })),
        rawTitle: clip(title),
        rawDescription: clip(desc, 220),
      };
    });

    const observedRows = rows.filter((r) => r.ownerState === "OBSERVED");
    const tally = <T extends string>(src: typeof rows, get: (r: (typeof rows)[number]) => T) =>
      src.reduce<Record<string, number>>((a, r) => {
        const k = get(r);
        a[k] = (a[k] ?? 0) + 1;
        return a;
      }, {});

    /** 🟡 「두 출처 요건이 불필요해 보이는 사례」 — 🔴 판정하지 않고 **근거만** 모은다. */
    const singleSourceUniqueName = observedRows
      .filter((r) => r.reason === "DIRECT_SINGLE_SOURCE")
      .map((r) => ({
        host: r.host,
        originCode: r.originCode,
        gt: r.gt,
        source: r.directSources[0] ?? null,
        /** 🔴 고유명 «후보» 원문 — owner 관측 그대로다(내 해석 0). */
        uniqueNameObservations: r.observations
          .filter((o) => o.productAttributable === true && o.genericTypeOnly !== true)
          .map((o) => `${o.source}:${o.raw}`),
        productTypes: r.productTypes,
      }));

    const artifact = {
      note:
        "🔴 평가 전용 — 승격 조건 변경 0 · OBSERVED→CORROBORATED 승격 0 · verdict 재계산 0 · " +
        "운영 판정 연결 0 · 계약 0 · DB 0 · 수집 0 · HTTP 0. " +
        "🔴 재현 한계 — owner 의 `usable` 은 비공개 `uniqueOf()` 를 쓰므로 호출할 수 없다. " +
        "이 분류는 관측 가능한 칸(productAttributable · genericTypeOnly · contextKind · source)의 " +
        "**대용치** 이고, 그 범위를 넘는 행은 UNDETERMINED 로 둔다. state 는 owner 값 그대로다. " +
        "분모 109(행 단위)는 16·19·26 과 합산하지 않는다.",
      denominator: {
        rows: rows.length,
        ownerState: tally(rows, (r) => r.ownerState as string),
        observedRows: observedRows.length,
        joinedToStored: rows.filter((r) => r.joinedToStored).length,
        gtLabeled: rows.filter((r) => has(r.gt)).length,
      },
      /** CPO §3 분류 — 🔴 OBSERVED 안에서만 센다. */
      observedReasonBreakdown: tally(observedRows, (r) => r.reason),
      /** 🔴 전체(UNKNOWN 포함) 사유 분포도 같이 둔다 — 두 분모를 섞지 않도록. */
      allReasonBreakdown: tally(rows, (r) => r.reason),
      gtLinkage: {
        observedWithGt: tally(
          observedRows.filter((r) => has(r.gt)),
          (r) => r.gt as string,
        ),
        observedWithGtAndStored: observedRows.filter((r) => has(r.gt) && has(r.storedVerdict)).length,
      },
      singleSourceUniqueName: {
        count: singleSourceUniqueName.length,
        note:
          "🟡 「두 출처 요건이 불필요해 보이는 사례」의 **근거 모음** 이다 — " +
          "🔴 CTO 가 불필요하다고 판정하지 않았다. 완화 승인은 CPO 사안이다.",
        cases: singleSourceUniqueName.slice(0, 20),
      },
      ownerReasonTexts: [...new Set(rows.flatMap((r) => r.ownerReasons))],
      rows,
    };

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify(artifact, null, 1), "utf8");

    // 🔴 사실 단언만 둔다.
    expect(rows.length).toBe(evid.length);
    // 🔴 승격 금지 — 이 하니스는 CORROBORATED 를 만들지 않는다(owner 가 준 값만 읽는다).
    expect(rows.every((r) => r.ownerState !== "CORROBORATED")).toBe(true);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 제목 «단일 출처» 고유 제품명의 GT 신뢰도 — 🔴 승격 0 · 조건 변경 0
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴 **GT SAME 이라고 제목만으로 동일성이 입증된 것이 아니고**, GT DIFFERENT 라고
   *    **제목 추출이 실패한 것도 아니다** — 그 둘을 섞지 않는다.
   * 🔴 「GT 연결 불가」와 「근거 부재」를 **다른 칸** 으로 센다.
   */
  it("제목 단일 출처 고유명이 GT 에서 무엇을 설명하는지 측정한다", () => {
    const rows = evid.map((p) => {
      const oTitle = s(p.origin.title);
      const oDesc = s(p.origin.description);
      const cTitle = s((p as unknown as { candidate?: { title?: string | null; description?: string | null } }).candidate?.title);
      const cDesc = s((p as unknown as { candidate?: { description?: string | null } }).candidate?.description);
      const oEv = analyzeProductNameDescriptionEvidence({ title: oTitle, description: oDesc });
      const cEv = analyzeProductNameDescriptionEvidence({ title: cTitle, description: cDesc });

      const pick = (e: ReturnType<typeof analyzeProductNameDescriptionEvidence>) => {
        const obs = e.observations as unknown as Array<{
          raw: string; source: string; contextKind?: string;
          productAttributable?: boolean; genericTypeOnly?: boolean;
        }>;
        const use = obs.filter(
          (o) => o.productAttributable === true && o.genericTypeOnly !== true && o.contextKind === "DIRECT",
        );
        return { name: use[0]?.raw ?? null, source: use[0]?.source ?? null, sources: [...new Set(use.map((o) => o.source))] };
      };
      const o = pick(oEv);
      const c = pick(cEv);

      /** 🔴 「이름이 같다」는 **동일성 결론이 아니다** — 토큰 공유 관측값이다. */
      const tok = (v: string | null) =>
        v ? new Set(v.toLowerCase().normalize("NFKC").replace(/[^a-z0-9가-힣]+/g, " ").trim().split(" ").filter((t) => t.length > 1)) : null;
      const ot = tok(o.name);
      const ct = tok(c.name);
      const sharedTokens = ot && ct ? [...ot].filter((t) => ct.has(t)) : null;
      const nameRelation =
        !ot || !ct ? "UNLINKABLE" : sharedTokens!.length > 0 ? "SHARES_TOKEN" : "NO_SHARED_TOKEN";

      /** 🟡 제목 밖의 다른 근거가 **같이 있는가** — 별도 표시(제목 효과와 섞지 않는다). */
      const otherEvidence = {
        candidateBrandAlias: findBrandAliasMentions(`${cTitle}\n${cDesc}`).length > 0,
        candidateLabeledCode: extractLabeledProductCodes(cDesc).length > 0,
        originLabeledCode: extractLabeledProductCodes(oDesc).length > 0,
        candidateHasDescription: has(cDesc),
      };

      const st = byKey.get(key(p.originCode, p.candidateUrl));
      return {
        originCode: s(p.originCode),
        host: p.candidateDomain,
        gt: p.humanGt,
        storedVerdict: st?.system_verdict ?? null,
        ownerState: oEv.state,
        originName: o.name,
        originNameSource: o.source,
        originSingleSource: o.sources.length === 1,
        candidateName: c.name,
        candidateNameSource: c.source,
        nameRelation,
        sharedTokens,
        otherEvidence,
      };
    });

    const observed = rows.filter((r) => r.ownerState === "OBSERVED");
    const t = <T extends string>(src: typeof rows, get: (r: (typeof rows)[number]) => T) =>
      src.reduce<Record<string, number>>((a, r) => {
        const k = get(r);
        a[k] = (a[k] ?? 0) + 1;
        return a;
      }, {});

    const gtLinked = observed.filter((r) => has(r.gt));
    const artifact = {
      note:
        "🔴 평가 전용 — CORROBORATED 승격 0 · sources.size>=2 변경 0 · verdict 재계산 0 · " +
        "운영 판정 연결 0 · 수집 0 · HTTP 0 · 사전/threshold/점수 0 · 계약 0. " +
        "🔴 nameRelation 은 **토큰 공유 관측값** 이고 동일성 결론이 아니다. " +
        "🔴 UNLINKABLE 은 「GT 연결 불가」가 아니라 「양쪽 고유명 중 하나가 없다」다 — " +
        "GT 미라벨과 **다른 칸** 이다. 분모 109 는 16·19·26 과 합산하지 않는다.",
      denominator: {
        rows: rows.length,
        observed: observed.length,
        observedGtLabeled: gtLinked.length,
        observedGtAndStored: observed.filter((r) => has(r.gt) && has(r.storedVerdict)).length,
        observedSingleSource: observed.filter((r) => r.originSingleSource).length,
      },
      gtDistribution: t(observed, (r) => (r.gt ?? "(미라벨)") as string),
      storedVerdictDistribution: t(observed, (r) => (r.storedVerdict ?? "(없음)") as string),
      /** 핵심 표 — 제목 고유명의 «관계» × GT */
      nameRelationByGt: gtLinked.reduce<Record<string, Record<string, number>>>((a, r) => {
        const g = r.gt as string;
        a[g] = a[g] ?? {};
        a[g][r.nameRelation] = (a[g][r.nameRelation] ?? 0) + 1;
        return a;
      }, {}),
      nameRelationAll: t(observed, (r) => r.nameRelation),
      /** 🟡 제목 밖 근거 동시 보유 — 제목 단독 효과와 **섞지 않기 위해** 따로 센다. */
      otherEvidencePresence: {
        candidateBrandAlias: observed.filter((r) => r.otherEvidence.candidateBrandAlias).length,
        candidateLabeledCode: observed.filter((r) => r.otherEvidence.candidateLabeledCode).length,
        originLabeledCode: observed.filter((r) => r.otherEvidence.originLabeledCode).length,
      },
      examples: {
        gtSame: gtLinked.filter((r) => r.gt === "SAME").slice(0, 6).map((r) => ({
          host: r.host, origin: r.originName, candidate: r.candidateName, rel: r.nameRelation, shared: r.sharedTokens,
        })),
        gtDifferent: gtLinked.filter((r) => r.gt === "DIFFERENT").slice(0, 6).map((r) => ({
          host: r.host, origin: r.originName, candidate: r.candidateName, rel: r.nameRelation, shared: r.sharedTokens,
        })),
      },
      unmeasured: {
        originVsCandidateTitleReliability:
          "🔴 **UNMEASURED** — 원상품 제목과 후보 제목의 «정확성» 을 가릴 ground truth 가 " +
          "기존 자료에 없다(둘 다 판매처 페이지에서 수집된 값이고 「제목이 맞다/틀렸다」 라벨이 없다).",
        note: "🔴 0 으로 세지 않는다 · 추측하지 않는다",
      },
      rows,
    };

    const OUT2 = path.join(OUT_DIR, "kids-title-single-source-reliability.json");
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT2, JSON.stringify(artifact, null, 1), "utf8");

    expect(observed.length).toBe(92);
    // 🔴 승격 0 — owner 상태를 바꾸지 않았다.
    expect(rows.every((r) => r.ownerState !== "CORROBORATED")).toBe(true);
  });
});
