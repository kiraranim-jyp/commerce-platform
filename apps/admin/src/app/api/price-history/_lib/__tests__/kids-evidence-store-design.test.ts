/**
 * ════════════════════════════════════════════════════════════════════════════
 * KIDS 평가 전용 «구조화 증거 저장» 설계 — 저장 O / 판정 연결 X
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 판정 경로 연결 0 · verdict 0 · 점수/threshold 0 · 가격 자격 0 · B-38 재개 0 ·
 *    브랜드 사전 운영 반영 0 · DB 0 · 수집 0 · HTTP 0 · 배포 0.**
 * 🔴 기존 계약 2건을 **해제·약화하지 않았다** — 그 계약은 **운영 owner 5개/3개의 import** 를
 *    금지하고 이 파일은 **테스트** 다(그 owner 가 아니다 · 기존 측정 하니스와 같은 모양).
 * 🔵 설계 원칙 — **원문을 유지하고 정규화·번역 결과는 «별도 칸»** 에 둔다(표준 §2.4).
 * 🔴 상품유형(`productTypes`)을 **고유 제품명으로 취급하지 않는다**.
 * 🔴 브랜드 어휘 후보는 **문자열 출현을 센 목록** 이고 **별칭 사전에 넣지 않았다**.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";
import { brandsCompatible } from "@commerce/crawler/src/comparison-search/cross-seller";
import { extractLabeledProductCodes } from "@commerce/shared/src/product-facts";
import { confirmBrandCodeInTitle } from "@commerce/crawler/src/comparison-search/domestic-identifiers";
import { analyzeProductNameDescriptionEvidence } from "@commerce/crawler/src/comparison-search/product-name-description-evidence";

const DIR = __dirname;
const EVID = path.join(DIR, "fixtures", "mi-reeval-03-keyword-input.json");
const STORED = path.join(DIR, "fixtures", "mi-reeval-01-db-human.json");
const OUT_DIR = path.join(DIR, "preserved");
const OUT = path.join(OUT_DIR, "kids-evidence-store-design.json");

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
  system_verdict?: string | null;
  price_tier?: string | null;
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const has = (v: unknown): boolean => s(v).length > 0;
const key = (c: unknown, u: unknown) => `${s(c).toUpperCase()}|${s(u)}`;
/** 🔵 정규화값 — 🔴 원문을 **대체하지 않는다**(별도 칸에만 둔다). */
const normalized = (v: string) => v.toLowerCase().normalize("NFKC").replace(/[^a-z0-9가-힣]+/g, " ").trim();

type State = "PRESENT" | "ABSENT" | "CONFLICT" | "UNKNOWN";

/** 🔴 원문 근거 — 값과 **출처·위치** 를 같이 둔다(표준 §2.1 출처 보존). */
type Ev = { value: string | null; normalized: string | null; source: "LIST" | "TITLE" | "DESCRIPTION" | null; at: number | null };
const ev = (value: string | null, source: Ev["source"], haystack?: string): Ev => ({
  value,
  normalized: value ? normalized(value) : null,
  source: value ? source : null,
  at: value && haystack ? haystack.toLowerCase().indexOf(value.toLowerCase()) : null,
});

/**
 * 🔴 **브랜드 어휘 «후보» 목록** — 오판 사례의 실제 제목에서 관측된 이름만 둔다.
 * 🔴 **별칭 사전에 넣지 않았다**(§4 CPO 지시) · 이 배열은 **출현을 세는 용도** 다.
 */
const BRAND_VOCAB_PROBE = [
  "Hugo Boss",
  "Marc Jacobs",
  "Dolce",
  "Gabbana",
  "Moncler",
  "Burberry",
  "Ralph Lauren",
  "Kenzo",
  "Stella McCartney",
  "Mini Rodini",
  "Bonpoint",
  "Petit Bateau",
  "Liewood",
  "Konges",
] as const;

describe("KIDS 평가 전용 구조화 증거 저장 설계 (판정 연결 0)", () => {
  const evid = (JSON.parse(readFileSync(EVID, "utf8")) as { pairs: EvidPair[] }).pairs;
  const storedRaw = JSON.parse(readFileSync(STORED, "utf8")) as unknown;
  const stored: StoredRow[] = Array.isArray(storedRaw)
    ? (storedRaw as StoredRow[])
    : (Object.values(storedRaw as Record<string, unknown>).find((v) => Array.isArray(v)) as StoredRow[]);
  const byKey = new Map<string, StoredRow>();
  for (const r of stored) byKey.set(key(r.origin_code, r.candidate_url), r);

  it("109쌍의 구조화 증거를 대칭으로 추출·보관하고 preserved/ 에 쓴다", () => {
    const rows = evid.map((p) => {
      const originCode = s(p.originCode);
      const oDesc = s(p.origin.description);
      const cDesc = s(p.candidate.description);
      const oTitle = s(p.origin.title);
      const cTitle = s(p.candidate.title);

      // ── BRAND (양쪽 «각자» · Contract A — 교차 복사 금지)
      const oBrandList = s(p.origin.brand);
      const oBrandDescHit = findBrandAliasMentions(oDesc)[0]?.brand ?? null;
      const cBrandTitleHit = findBrandAliasMentions(cTitle)[0]?.brand ?? null;
      const cBrandDescHit = findBrandAliasMentions(cDesc)[0]?.brand ?? null;
      const originBrand = oBrandList
        ? ev(oBrandList, "LIST")
        : ev(oBrandDescHit, "DESCRIPTION", oDesc);
      const candidateBrand = cBrandTitleHit
        ? ev(cBrandTitleHit, "TITLE", cTitle)
        : ev(cBrandDescHit, "DESCRIPTION", cDesc);
      let brandState: State;
      if (!originBrand.value && !candidateBrand.value) brandState = "UNKNOWN";
      else if (!originBrand.value || !candidateBrand.value) brandState = "ABSENT";
      else
        brandState = brandsCompatible(originBrand.value, candidateBrand.value)
          ? "PRESENT"
          : "CONFLICT";

      // ── MODEL_CODE
      const oCodeLabeled = extractLabeledProductCodes(oDesc);
      const cCodeLabeled = extractLabeledProductCodes(cDesc);
      const cCodeDistinct = [...new Set(cCodeLabeled.map((l) => l.value.toUpperCase()))];
      const bareTitle = originCode ? confirmBrandCodeInTitle(originCode, cTitle) : null;
      const bareDesc = originCode ? confirmBrandCodeInTitle(originCode, cDesc) : null;
      const originCodeEv = originCode
        ? ev(originCode, "LIST")
        : ev(oCodeLabeled[0]?.value ?? null, "DESCRIPTION", oDesc);
      const candidateCodeEv = cCodeDistinct.length === 1
        ? ev(cCodeLabeled[0]!.value, "DESCRIPTION", cDesc)
        : bareTitle
          ? ev(bareTitle, "TITLE", cTitle)
          : ev(bareDesc, "DESCRIPTION", cDesc);
      let codeState: State;
      if (!originCodeEv.value && !candidateCodeEv.value) codeState = "UNKNOWN";
      else if (cCodeDistinct.length > 1) codeState = "CONFLICT"; // 🔴 복수 코드 — Contract M 과 같은 취지
      else if (!candidateCodeEv.value) codeState = "ABSENT";
      else
        codeState =
          s(candidateCodeEv.value).toUpperCase() === originCodeEv.value?.toUpperCase()
            ? "PRESENT"
            : "CONFLICT";

      // ── PRODUCT_NAME (owner 가 productTypes 를 «고유 이름 아님» 으로 분류한다)
      const oName = analyzeProductNameDescriptionEvidence({ title: oTitle, description: oDesc });
      const cName = analyzeProductNameDescriptionEvidence({ title: cTitle, description: cDesc });
      const oCorr = s(oName.corroborated);
      const cCorr = s(cName.corroborated);
      let nameState: State;
      if (!oCorr && !cCorr) nameState = "UNKNOWN";
      else if (!oCorr || !cCorr) nameState = "ABSENT";
      else nameState = normalized(oCorr) === normalized(cCorr) ? "PRESENT" : "CONFLICT";

      // ── 브랜드 어휘 «후보» 출현(🔴 사전에 넣지 않았다 · 문자열 출현만)
      const vocabHits = BRAND_VOCAB_PROBE.filter((b) =>
        new RegExp(b.replace(/\s+/g, "\\s*"), "i").test(`${cTitle}\n${cDesc}`),
      );

      const st = byKey.get(key(originCode, p.candidateUrl));

      return {
        originCode,
        host: p.candidateDomain,
        candidateUrl: p.candidateUrl,
        gt: p.humanGt,
        /** 🔴 저장된 운영 결과 — **바꾸지 않는다**(참조만). */
        storedVerdict: st?.system_verdict ?? null,
        storedTier: st?.price_tier ?? null,
        joinedToStored: Boolean(st),
        /** 🔵 **평가 전용 구조화 증거** — 원문 + 정규화 + 출처를 같이 담는다. */
        evidence: {
          brand: { origin: originBrand, candidate: candidateBrand, state: brandState },
          modelCode: {
            origin: originCodeEv,
            candidate: candidateCodeEv,
            state: codeState,
            candidateLabeledAll: cCodeLabeled.map((l) => `${l.label}=${l.value}`),
          },
          productName: {
            origin: ev(oCorr || null, "DESCRIPTION", oDesc),
            candidate: ev(cCorr || null, "DESCRIPTION", cDesc),
            state: nameState,
            /** 🔴 고유 이름이 **아니다** — owner 분류. */
            originProductTypes: oName.productTypes,
            candidateProductTypes: cName.productTypes,
            originState: oName.state,
            candidateState: cName.state,
          },
        },
        brandVocabCandidates: vocabHits,
        rawPresence: {
          originTitle: has(oTitle),
          originDescription: has(oDesc),
          candidateTitle: has(cTitle),
          candidateDescription: has(cDesc),
        },
      };
    });

    const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
    const tally = <T extends string>(get: (r: (typeof rows)[number]) => T) =>
      rows.reduce<Record<string, number>>((a, r) => {
        const k = get(r);
        a[k] = (a[k] ?? 0) + 1;
        return a;
      }, {});

    const vocab = BRAND_VOCAB_PROBE.map((b) => {
      const hits = rows.filter((r) => r.brandVocabCandidates.includes(b));
      return {
        brand: b,
        occurrences: hits.length,
        recognizedByExistingAlias: hits.filter((r) => Boolean(r.evidence.brand.candidate.value)).length,
        gtLinked: hits.filter((r) => has(r.gt)).length,
        gtDistribution: hits.reduce<Record<string, number>>((a, r) => {
          const k = r.gt ?? "(미라벨)";
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        hosts: [...new Set(hits.map((r) => r.host))].slice(0, 5),
      };
    }).filter((v) => v.occurrences > 0);

    const artifact = {
      note:
        "🔴 평가 전용 — 운영 판정 경로 연결 0 · verdict 변경 0 · 점수/threshold 0 · 가격 자격 0 · " +
        "브랜드 사전 운영 반영 0 · B-38 재개 0 · DB 0 · 수집 0 · HTTP 0. " +
        "기존 계약 2건은 운영 owner 5개/3개의 import 를 금지하며 이 파일은 그 owner 가 아니다(테스트). " +
        "원문을 유지하고 정규화값은 별도 칸(normalized)에 둔다. productTypes 는 고유 이름이 아니다. " +
        "brandVocabCandidates 는 «출현을 센 목록» 이고 별칭 사전에 넣지 않았다. " +
        "분모 109 는 16·19·26 과 합산하지 않는다.",
      denominator: {
        pairs: rows.length,
        joinedToStored: count((r) => r.joinedToStored),
        gtLabeled: count((r) => has(r.gt)),
        gtAndStored: count((r) => has(r.gt) && has(r.storedVerdict)),
        rawPresence: {
          originTitle: count((r) => r.rawPresence.originTitle),
          originDescription: count((r) => r.rawPresence.originDescription),
          candidateTitle: count((r) => r.rawPresence.candidateTitle),
          candidateDescription: count((r) => r.rawPresence.candidateDescription),
        },
        notMerged: { bothSideFullText: 16, gtComparable: 19, identityAxisPairs: 26 },
      },
      states: {
        brand: tally((r) => r.evidence.brand.state),
        modelCode: tally((r) => r.evidence.modelCode.state),
        productName: tally((r) => r.evidence.productName.state),
      },
      /** 🟢 직전 보고의 **미측정 1건** 을 메운다 — 상품명 증거 owner 의 state 분포. */
      productNameOwnerState: {
        origin: tally((r) => r.evidence.productName.originState),
        candidate: tally((r) => r.evidence.productName.candidateState),
        bothCorroborated: count(
          (r) => Boolean(r.evidence.productName.origin.value && r.evidence.productName.candidate.value),
        ),
      },
      brandVocabCandidates: vocab,
      unmeasurable: {
        note: "🔴 0 으로 세지 않는다 — UNKNOWN 은 「양쪽 다 없다」이고 ABSENT 는 「한쪽만 없다」다",
        originTitleMissing: count((r) => !r.rawPresence.originTitle),
        candidateDescriptionMissing: count((r) => !r.rawPresence.candidateDescription),
      },
      rows,
    };

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify(artifact, null, 1), "utf8");

    // 🔴 사실 단언만 둔다.
    expect(rows.length).toBe(evid.length);
    // 🔴 저장 전용 계약 — 이 산출물은 운영 verdict 를 **담지 않는다**(참조만 한다).
    expect(rows.every((r) => !("recomputedVerdict" in r))).toBe(true);
  });
});
