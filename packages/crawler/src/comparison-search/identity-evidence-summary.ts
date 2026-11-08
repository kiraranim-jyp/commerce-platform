import {
  type EvidenceAxis,
  type EvidenceItem,
  type EvidenceSource,
  type ProductFacts,
  IDENTITY_EVIDENCE_AXES,
  PROBE_EVIDENCE_AXES,
  brandIdentitiesCompatible,
  buildCoreTitleTokens,
  normalizeFactText,
  resolveBrandIdentity,
  resolveGarmentForms,
} from "@commerce/shared";
/** 🟢 BRAND-1 이 만든 **등록부 조회** owner — 🔴 alias 추가 0 · 새 사전 0. */
import { findBrandAliasMentions } from "./brand-alias";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 COMMON-EVIDENCE-1 — **원본 ↔ 후보 증거 대조 요약**(관찰 전용 · CPO 승인)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **Matcher 입력이 아니다.** `ProductFacts.evidence` 의 Contract P2(「비교 함수가
 *    이 칸을 읽지 않는다」)는 그대로다. 이 파일은 그 칸을 **읽어서 설명만** 한다 —
 *    산출물은 어떤 판정 함수에도 들어가지 않는다(계약이 그것을 잠근다).
 *
 * ── 🔵 STANDARD-V1 §2.1 네 상태 ────────────────────────────────────────────────
 * ```
 * PRESENT       양쪽(또는 해당 쪽)에서 증거를 읽었다
 * MISSING       🔴 원문은 **있었는데** 그 축에서 아무것도 못 읽었다
 * NOT_MEASURED  🔴 원문 자체가 **없었다** ⟹ 잴 기회가 없었다
 * CONFLICT      양쪽이 읽혔고 정규화 값이 **겹치지 않는다**
 * ```
 * 🔴🔴 **`MISSING` 과 `NOT_MEASURED` 를 섞지 않는다**(CPO 검증 기준 6 · 절대 불변 ⑤
 *    「미측정 ≠ 실패 0」). 이 구분이 가능한 이유는 **출처 보유 여부를 입력으로 받기**
 *    때문이다 — `title`/`description` 이 있었는지를 facts 에서 직접 본다.
 *
 * ── 🔴 CPO C-3 「원본값·정규화값·출처·충돌 근거를 구분한다」 ────────────────────
 * ```
 * 🔴 `EvidenceItem.normalized` 는 **boolean** 이다(「정규화 파생표현이 만들어졌는가」).
 *    ⟹ 정규화 **문자열** 을 거기 넣으면 **기존 필드 의미가 훼손된다** ⟹ 하지 않았다.
 * 🟢 그래서 **타입을 바꾸지 않고** 이 파일의 산출 타입에 네 칸을 따로 둔다 —
 *    `raw` · `normalized` · `source` · `conflictBasis`.
 * 🟢 정규화는 **기존 owner** `normalizeFactText` 하나만 쓴다(새 정규화 0).
 * ```
 *
 * ── 🔴 CPO C-4 「중복 증거 방지」 ──────────────────────────────────────────────
 * ```
 * 🔴 같은 축에서 **같은 출처** 가 여러 항목을 내는 일이 실재한다 —
 *    예: COLOR/DESCRIPTION 은 생산자가 **셋**(라벨 · extractColor · 앞머리 구)이고
 *        MATERIAL 은 TITLE·DESCRIPTION 양쪽에서 성분을 쪼개 담는다.
 * ⟹ 🔴 항목 수를 「독립 증거 수」로 세면 **한 문장이 세 번 계산** 된다.
 * 🟢 그래서 `independentSources` 는 **출처 집합의 크기** 로 센다(항목 수가 아니다).
 * 🔴 그리고 `DESCRIPTION` 하나에서 나온 값들은 **서로 독립이 아니다** — 같은 원문이다.
 * ```
 */

/** 🔵 STANDARD-V1 §2.1 네 상태. 🔴 이 배열이 그 경계를 기계로 읽게 해 준다. */
export const IDENTITY_EVIDENCE_STATES = ["PRESENT", "MISSING", "NOT_MEASURED", "CONFLICT"] as const;
export type EvidenceState = (typeof IDENTITY_EVIDENCE_STATES)[number];

export interface AxisEvidenceValue {
  /** 🔴 **원문 그대로**. */
  raw: string;
  /** 🟢 비교용 정규화 — owner `normalizeFactText` 산출. 🔴 새 정규화를 만들지 않았다. */
  normalized: string;
  /** 🟢 기존 `EvidenceSource` 타입 그대로. */
  source: EvidenceSource;
}

export interface AxisEvidenceSummary {
  axis: EvidenceAxis;
  /** 🟡 그 축이 **판정 축** 인지 **관측 전용** 인지 — 기존 두 배열에서 유도한다(사본 0). */
  observationOnly: boolean;
  originState: EvidenceState;
  candidateState: EvidenceState;
  /** 🔵 양쪽을 합친 대조 상태. */
  comparison: EvidenceState;
  origin: AxisEvidenceValue[];
  candidate: AxisEvidenceValue[];
  /**
   * 🔴 **독립 출처 수** — 항목 수가 아니라 **출처 집합의 크기** 다(CPO C-4).
   * 같은 `DESCRIPTION` 에서 파생된 값 셋은 **1** 로 센다.
   */
  originIndependentSources: number;
  candidateIndependentSources: number;
  /** 🔴 `CONFLICT` 일 때만 채워진다 — 사람이 읽는 충돌 근거. */
  conflictBasis: string | null;
}

export interface IdentityEvidenceSummary {
  axes: AxisEvidenceSummary[];
  /** 🔵 공급 상태 — 🔴 「양쪽에 evidence 칸이 있는가」이고 **정확도가 아니다**. */
  supply: {
    originHasEvidence: boolean;
    candidateHasEvidence: boolean;
    /** 🔴 한쪽만 있으면 **비대칭** 이다 — 그 사실을 숨기지 않는다. */
    asymmetric: boolean;
  };
}

/** 🔴 그 facts 가 그 출처의 **원문을 갖고 있었는가** — `MISSING` ↔ `NOT_MEASURED` 를 가른다. */
function measuredSources(facts: ProductFacts): Set<EvidenceSource> {
  const out = new Set<EvidenceSource>();
  if ((facts.title ?? "").trim()) out.add("TITLE");
  if ((facts.description ?? "").trim()) out.add("DESCRIPTION");
  if ((facts.imageUrls ?? []).length > 0) out.add("IMAGE");
  return out;
}

const valuesOf = (items: EvidenceItem[] | undefined): AxisEvidenceValue[] =>
  (items ?? [])
    .map((i) => ({ raw: i.value, normalized: normalizeFactText(i.value).replace(/\s+/g, " ").trim(), source: i.source }))
    .filter((v) => v.normalized.length > 0);

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **축별 양립 판정** — 한글↔라틴 거짓 CONFLICT 를 없앤다(CPO 추가 결정 2026-11-08)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 필요했나** — 1차 요약기는 **정규화 문자열 단순 겹침** 으로 판정했다:
 * ```
 * 원본 「Bobo Choses」 ↔ 후보 「보보쇼즈」  → 겹침 0 ⟹ **거짓 CONFLICT**
 * 🔴🔴 그것이 **WU-080 CF-3 의 악화 기전** 이고 BRAND-1 이 자기 모듈 안에서
 *      이미 한 번 밟아 고친 함정이다(그 파일 `canonicalBrand` 주석).
 * ```
 * 🟢 **해결은 BRAND-1 과 같다** — 사전을 만들지 않고 **등록부가 이미 아는 대응을 조회** 한다.
 *
 * 🔴 **금지를 지킨 방식**:
 * ```
 * ❌ 새 alias 추가            🟢 `findBrandAliasMentions`(등록부 그대로) 호출만
 * ❌ 새 브랜드 동의어 사전     🟢 등록부는 `brand-alias.ts` 하나 · 브랜드 4 · alias 1
 * ❌ 새 상품명 판정 규칙       🟢 `buildCoreTitleTokens`(shared owner) 그대로
 * ❌ 원문 훼손                🟢 `raw` 는 **그대로** 보존 — 비교 «키» 만 바꾼다
 * ❌ 등록부 밖 값의 동일 추정   🟢 모르면 **정규화 문자열로 비교**(기존 동작)
 * ❌ Matcher 연결             🟢 이 판정은 **표시용** 이다(계약 P2 유지)
 * ```
 */

/** 🔴 등록부가 **값 전체로 한 브랜드를 가리킬 때만** 정규 문자열을 쓴다(긴 문장 오인 방지). */
function brandComparisonKey(raw: string): string {
  const mentions = findBrandAliasMentions(raw);
  return mentions.length === 1 ? mentions[0]!.brand : raw;
}

/** 🟢 상품명 비교 토큰 — 브랜드 낱말을 **잡음으로 넘겨** owner 가 걷어낸다. */
function nameTokens(raw: string, brandNoise: string[]): string[] {
  return buildCoreTitleTokens(raw, brandNoise).filter((t) => resolveGarmentForms(t).size === 0);
}

function axisValuesCompatible(
  axis: EvidenceAxis,
  origin: AxisEvidenceValue[],
  candidate: AxisEvidenceValue[],
): boolean {
  if (axis === "BRAND") {
    /** 🟢 양립 판정 owner 는 `brandIdentitiesCompatible` 하나다(자체 비교식 0). */
    return origin.some((o) =>
      candidate.some((c) =>
        brandIdentitiesCompatible(
          resolveBrandIdentity(brandComparisonKey(o.raw)),
          resolveBrandIdentity(brandComparisonKey(c.raw)),
        ),
      ),
    );
  }
  if (axis === "PRODUCT_NAME") {
    /**
     * 🔴 상품명은 **문자열 동일성** 으로 볼 수 없다(판매처가 브랜드·시즌을 붙여 적는다).
     * 🟢 그래서 PRODUCT-NAME-1 과 **같은 기준** — 유형 어휘를 뺀 핵심 토큰이 하나라도 겹치면 양립.
     * 🔴 겹치는 토큰이 **하나도 없으면** CONFLICT 가 아니라… 🔴 **CONFLICT 로 둔다** —
     *    그래야 「서로 다른 상품명」이 화면에 드러난다(표시용이고 판정이 아니다).
     */
    const noise = [...origin, ...candidate].flatMap((v) =>
      findBrandAliasMentions(v.raw).flatMap((m) => [m.brand, m.matched]),
    );
    const oTok = new Set(origin.flatMap((v) => nameTokens(v.raw, noise)));
    if (oTok.size === 0) return true; /* 🔴 비교할 고유 토큰이 없으면 «충돌» 이라 하지 않는다 */
    const cTok = candidate.flatMap((v) => nameTokens(v.raw, noise));
    if (cTok.length === 0) return true;
    return cTok.some((t) => oTok.has(t));
  }
  /** 🟢 그 외 축은 **기존 동작 그대로** — 정규화 문자열 겹침이다(규칙을 늘리지 않는다). */
  const cn = new Set(candidate.map((v) => v.normalized));
  return origin.some((v) => cn.has(v.normalized));
}

/**
 * 🔴 **한쪽의 상태** — 넷 중 하나를 고른다.
 *
 * 🔴 `evidence` 칸이 **아예 없는 것** 과 「그 축이 비었다」를 섞지 않는다:
 * ```
 * evidence 칸 없음(공급 안 됨)   ⟹ **NOT_MEASURED**  (잴 기회가 없었다)
 * 원문 없음                      ⟹ **NOT_MEASURED**
 * 원문 있고 그 축이 빔            ⟹ **MISSING**       (재 봤는데 없었다)
 * 값이 있음                      ⟹ **PRESENT**
 * ```
 */
function sideState(facts: ProductFacts, values: AxisEvidenceValue[]): EvidenceState {
  if (values.length > 0) return "PRESENT";
  if (!facts.evidence) return "NOT_MEASURED";
  return measuredSources(facts).size > 0 ? "MISSING" : "NOT_MEASURED";
}

/**
 * 원본 ↔ 후보의 증거를 **축별로 대조** 한다. 순수 함수 · HTTP 0 · DB 0.
 *
 * 🔴 **국내/해외 분기가 없다** — 도메인·TLD·언어를 보지 않는다.
 * 🔴 **한쪽에 없는 값을 다른 쪽에서 추측해 채우지 않는다**(CPO C-1) — 없으면 상태로 적는다.
 */
export function summarizeIdentityEvidence(origin: ProductFacts, candidate: ProductFacts): IdentityEvidenceSummary {
  const probe = new Set<string>(PROBE_EVIDENCE_AXES);
  const allAxes = [...IDENTITY_EVIDENCE_AXES, ...PROBE_EVIDENCE_AXES] as readonly EvidenceAxis[];

  const axes: AxisEvidenceSummary[] = allAxes.map((axis) => {
    const o = valuesOf(origin.evidence?.[axis]);
    const c = valuesOf(candidate.evidence?.[axis]);
    const originState = sideState(origin, o);
    const candidateState = sideState(candidate, c);

    let comparison: EvidenceState;
    let conflictBasis: string | null = null;
    if (originState === "PRESENT" && candidateState === "PRESENT") {
      const overlap = axisValuesCompatible(axis, o, c);
      comparison = overlap ? "PRESENT" : "CONFLICT";
      if (!overlap) {
        conflictBasis = `원본 ${JSON.stringify(o.map((v) => v.raw))} ↔ 후보 ${JSON.stringify(c.map((v) => v.raw))}`;
      }
    } else if (originState === "NOT_MEASURED" || candidateState === "NOT_MEASURED") {
      /** 🔴 한쪽이라도 **잴 기회가 없었으면** 대조는 `NOT_MEASURED` 다 — 「없다」가 아니다. */
      comparison = "NOT_MEASURED";
    } else {
      comparison = "MISSING";
    }

    return {
      axis,
      observationOnly: probe.has(axis),
      originState,
      candidateState,
      comparison,
      origin: o,
      candidate: c,
      /** 🔴 출처 집합의 크기 — 같은 원문에서 파생된 값 여럿을 **하나** 로 센다. */
      originIndependentSources: new Set(o.map((v) => v.source)).size,
      candidateIndependentSources: new Set(c.map((v) => v.source)).size,
      conflictBasis,
    };
  });

  return {
    axes,
    supply: {
      originHasEvidence: Boolean(origin.evidence),
      candidateHasEvidence: Boolean(candidate.evidence),
      asymmetric: Boolean(origin.evidence) !== Boolean(candidate.evidence),
    },
  };
}
