import {
  IDENTITY_EVIDENCE_AXES,
  PROBE_EVIDENCE_AXES,
  type EvidenceItem,
  type ProductEvidence,
  type ProductFacts,
  resolveGarmentForms,
} from "@commerce/shared";
import { lookupBrandByAliasInTitle } from "./brand-alias";
import { extractDetailModelCodes } from "./model-code-from-detail";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-FINAL-VISUAL-01 — **TEST/QA X-Ray 전용 설명기**(CPO GO 2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴🔴 **이 파일은 판정에 «절대» 들어가지 않는다.**
 * ```
 * ❌ synonym → SAME        ❌ 한글 정규화 → SAME      ❌ normalized text score → SAME
 * ❌ matcher · threshold · MATCHING 정책 · shortcut
 * 🟢 하는 일 — 「시스템이 무엇을 읽었고 어떻게 해석했는가」를 **사람이 읽을 수 있게 펴는 것**
 * ```
 * 🔴 계약이 이것을 잠근다 — `cross-seller` · `match-truth` · `model-code` 는 이 모듈을
 *    **import 하지 않는다**(양방향 검사).
 *
 * ── 🔴🔴 가장 중요한 설계 결정: **동의어가 «차이» 를 지우지 않는다** (CPO §8) ──
 * ```
 * 같게 보는 것   T-shirt · T shirt · Tee · Tee Shirt · 티셔츠   ⟹ 전부 SHIRT 계열
 * 🔴 **절대 같게 보지 않는 것**
 *    Long Sleeve ≠ Short Sleeve      ⟹ 별도 «관측» 축(SLEEVE)으로 **갈라서** 적는다
 *    T-shirt ≠ Sweatshirt            ⟹ `resolveGarmentForms` 가 이미 다른 형태로 읽는다
 *    Shirt ≠ T-shirt                 ⟹ 🔴 현재 운영 어휘는 **둘을 같은 SHIRT 로 읽는다**
 *                                       ⟹ 그 사실을 **숨기지 않고 화면에 적는다**
 *    Generic `Top`                   ⟹ TOP 은 **별도 형태** 이고 SHIRT 로 승격하지 않는다
 * ```
 * 🔴🔴 **소매 길이를 보는 판정 축은 이 저장소에 «없다»**(WU-124 확정). 그래서 여기서
 *    읽는 `SLEEVE` 는 **관측값** 이고, 그것이 SAME/DIFFERENT 를 바꾸지 않는다.
 *    🟢 S1-5 · S1-6(긴팔↔반팔 DIFFERENT)이 **왜 텍스트로 안 갈리는지** 를 화면이 말해 준다.
 */

export type ExplainSource = "TITLE" | "DESCRIPTION" | "IMAGE";

export interface ExplainedValue {
  value: string;
  source: ExplainSource;
  /** 🔴 설명문에서 **복구** 된 값인가(원래 TITLE 에 없던 것) — CPO §5 가 요구한 구분. */
  recovered?: boolean;
  /** 사람이 읽는 부가 설명(예: 「보보쇼즈 → BOBO CHOSES」). */
  note?: string;
}

/** 🟡 관측 전용 — 판정 축이 **아니다**. 화면이 그 사실을 같이 적는다. */
export interface SleeveObservation {
  /** `LONG` · `SHORT` · null(원문이 말하지 않았다). */
  kind: "LONG" | "SHORT" | null;
  source: ExplainSource | null;
  phrase: string | null;
}

export interface LanguageAnalysis {
  /** 원문에 한글이 있는가 — 한/영 대응을 볼 자리인지 알려 준다. */
  hasKorean: boolean;
  hasLatin: boolean;
  /** 한글 → 영문으로 **대응된** 항목(브랜드·형태). 🔴 판정에 쓰지 않는다. */
  mappings: { from: string; to: string; axis: string }[];
  /** 같은 뜻으로 읽은 표기 묶음(예: SHIRT ← 티셔츠 · tee). */
  synonymGroups: { canonical: string; matched: string[] }[];
}

export interface ExplainedEvidence {
  axis: string;
  /** 🟡 관측 전용 축인가(matcher 축 아님). */
  probeOnly: boolean;
  values: ExplainedValue[];
}

export interface EvidenceExplanation {
  /* ── 원본 ── */
  sourceUrl: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  /* ── 추출 Evidence(출처 포함) ── */
  evidence: ExplainedEvidence[];
  /* ── 언어 / 의미 ── */
  language: LanguageAnalysis;
  /** 상품명에서 읽어 낸 구조(브랜드·시즌·형태·품번·나머지 이름). */
  titleStructure: {
    brand: ExplainedValue | null;
    season: ExplainedValue | null;
    modelCode: ExplainedValue | null;
    forms: string[];
    /** 브랜드·시즌·품번을 걷어낸 **나머지 상품명**. */
    productName: string | null;
  };
  sleeve: SleeveObservation;
  /* ── 이미지 ── */
  image: {
    count: number;
    representative: string | null;
    normalized: boolean;
    digest: string | null;
  };
  /** 🔴 **화면이 반드시 같이 적어야 하는 한계** — 숨기면 화면이 거짓말을 한다. */
  caveats: string[];
}

/* ─────────────────────────── 어휘(관측된 것만) ─────────────────────────── */

/** 🔴 시즌 코드 — `brand-resolver` 가 브랜드에서 버리는 그 모양이다(26FW · AW26 · SS25). */
const SEASON_RE = /\b((?:ss|aw|fw|pe)\s?\d{2}|\d{2}\s?(?:ss|aw|fw|pe))\b/i;

/** 🔴 **긴팔/반팔은 갈라서** 읽는다(CPO §8 — 동의어로 묶으면 안 되는 축). */
const LONG_SLEEVE_RE = /(긴\s?팔|long\s?-?\s?sleeve|longsleeve|l\/s)/i;
const SHORT_SLEEVE_RE = /(반\s?팔|short\s?-?\s?sleeve|shortsleeve|s\/s)/i;

/**
 * 🟢 형태 동의어는 **새 사전을 만들지 않는다** — `resolveGarmentForms` 의 어휘가 owner 다.
 *    이 표는 **화면에 「무엇을 같은 뜻으로 읽었는가」를 보여주기 위한 표기 목록** 이고,
 *    판정은 여전히 그 함수가 한다.
 * 🔴 그래서 여기에 없는 말을 넣어도 판정은 변하지 않는다(그 점을 화면이 적는다).
 */
const FORM_SURFACE_FORMS: Record<string, string[]> = {
  SHIRT: ["t-shirt", "t shirt", "tshirt", "tee", "tee shirt", "티셔츠", "셔츠", "shirt", "blouse", "polo"],
  SWEATSHIRT: ["sweatshirt", "sweat", "jumper", "맨투맨", "스웨트셔츠"],
  HOODIE: ["hoodie", "hooded", "후디", "후드집업"],
  JACKET: ["jacket", "cardigan", "coat", "자켓", "재킷", "카디건"],
  PANTS: ["pants", "trousers", "leggings", "shorts", "바지", "팬츠", "레깅스"],
  DRESS: ["dress", "원피스"],
  SKIRT: ["skirt", "스커트"],
  TOP: ["top", "상의"],
  SOCKS: ["socks", "양말"],
  ROMPER: ["romper", "playsuit"],
  BODYSUIT: ["bodysuit", "body", "바디수트"],
  OVERALL: ["overall", "jumpsuit", "dungarees"],
};

/** 🔴 한글 형태 표기 → 영문 라벨. **표시 전용** 이다(판정 입력 아님). */
const KOREAN_FORM_LABEL: Record<string, string> = {
  "티셔츠": "T-shirt",
  "셔츠": "Shirt",
  "맨투맨": "Sweatshirt",
  "스웨트셔츠": "Sweatshirt",
  "후디": "Hoodie",
  "자켓": "Jacket",
  "재킷": "Jacket",
  "카디건": "Cardigan",
  "바지": "Pants",
  "팬츠": "Pants",
  "레깅스": "Leggings",
  "원피스": "Dress",
  "스커트": "Skirt",
  "상의": "Top",
  "양말": "Socks",
  "바디수트": "Bodysuit",
};

const HANGUL_RE = /[ㄱ-ㆎ가-힣]/;
const LATIN_RE = /[A-Za-z]/;

const itemsOf = (ev: ProductEvidence | null | undefined, axis: string): EvidenceItem[] =>
  (ev?.[axis as keyof ProductEvidence] as EvidenceItem[] | undefined) ?? [];

function readSleeve(title: string, description: string | null): SleeveObservation {
  for (const [source, text] of [
    ["TITLE", title],
    ["DESCRIPTION", description ?? ""],
  ] as const) {
    const long = LONG_SLEEVE_RE.exec(text);
    if (long) return { kind: "LONG", source, phrase: long[0] };
    const short = SHORT_SLEEVE_RE.exec(text);
    if (short) return { kind: "SHORT", source, phrase: short[0] };
  }
  return { kind: null, source: null, phrase: null };
}

/**
 * `ProductFacts`(+ 이미 붙어 있는 `evidence`)를 **사람이 읽을 수 있는 설명** 으로 편다.
 *
 * 🔴 **순수 함수 · 네트워크 0 · 판정 0.** 새 값을 만들어 facts 에 돌려주지 않는다.
 * 🔴 **없는 것을 지어내지 않는다** — 못 읽은 축은 값이 비고, 그 사실이 화면에 남는다.
 */
export function explainEvidence(facts: ProductFacts): EvidenceExplanation {
  const title = facts.title ?? "";
  const description = facts.description ?? null;
  const ev = facts.evidence;

  /* ── 축별 Evidence(출처 보존) ── */
  const probe = new Set<string>(PROBE_EVIDENCE_AXES);
  const titleCodes = new Set(extractDetailModelCodes(title));
  const evidence: ExplainedEvidence[] = [...IDENTITY_EVIDENCE_AXES, ...PROBE_EVIDENCE_AXES].map((axis) => ({
    axis,
    probeOnly: probe.has(axis),
    values: itemsOf(ev, axis).map((i) => ({
      value: i.value,
      source: i.source as ExplainSource,
      /**
       * 🔴 **CPO §5 — 설명문에서 «복구» 된 품번을 상품명의 품번과 구분한다.**
       *    설명문 출처인데 상품명에는 없던 값이면 복구된 것이다.
       */
      recovered: axis === "MODEL_CODE" && i.source === "DESCRIPTION" ? !titleCodes.has(i.value) : undefined,
    })),
  }));

  /* ── 상품명 구조 ── */
  const brandAlias = lookupBrandByAliasInTitle(title) ?? null;
  const seasonMatch = SEASON_RE.exec(title);
  const titleCodeList = [...titleCodes];
  const forms = [...resolveGarmentForms(title)].map(String).sort();

  let remainder = title;
  for (const drop of [brandAlias, seasonMatch?.[0], ...titleCodeList]) {
    if (drop) remainder = remainder.replace(new RegExp(drop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  }
  /** 🔴 한글 브랜드 표기도 같이 걷는다 — alias 가 영문으로 돌아오기 때문이다. */
  for (const korean of Object.keys(KOREAN_FORM_LABEL)) {
    void korean;
  }
  remainder = remainder.replace(/\s+/g, " ").trim();

  /* ── 언어 / 의미 ── */
  const haystack = `${title} ${description ?? ""}`;
  const mappings: LanguageAnalysis["mappings"] = [];
  if (brandAlias && HANGUL_RE.test(title)) {
    /** 🟢 실제 대응을 적는다 — 「보보쇼즈 → Bobo Choses」. */
    const koreanBrand = title.match(/[ㄱ-ㆎ가-힣]+/)?.[0] ?? null;
    if (koreanBrand && koreanBrand !== brandAlias) {
      mappings.push({ from: koreanBrand, to: brandAlias, axis: "BRAND" });
    }
  }
  for (const [korean, english] of Object.entries(KOREAN_FORM_LABEL)) {
    if (haystack.includes(korean)) mappings.push({ from: korean, to: english, axis: "FORM" });
  }

  const lower = haystack.toLowerCase();
  const synonymGroups: LanguageAnalysis["synonymGroups"] = [];
  for (const [canonical, surfaces] of Object.entries(FORM_SURFACE_FORMS)) {
    const matched = surfaces.filter((s) => lower.includes(s.toLowerCase()));
    if (matched.length > 0) synonymGroups.push({ canonical, matched });
  }

  /* ── 이미지 ── */
  const imageItems = itemsOf(ev, "IMAGE");
  const rep = imageItems.find((i) => i.representative) ?? imageItems[0] ?? null;

  /* ── 🔴 한계를 «화면에» 적는다 ── */
  const caveats: string[] = [];
  const sleeve = readSleeve(title, description);
  if (sleeve.kind) {
    caveats.push(
      `소매 길이(${sleeve.kind === "LONG" ? "긴팔" : "반팔"})는 **관측값** 이고 동일상품 판정 축이 아닙니다 — 이 값이 SAME/DIFFERENT 를 바꾸지 않습니다.`,
    );
  }
  if (forms.includes("SHIRT")) {
    caveats.push("현재 형태 어휘는 **셔츠와 티셔츠를 같은 SHIRT 로** 읽습니다(차단을 만들지 않기 위한 기존 정책).");
  }
  if (!description) caveats.push("상세설명 원문이 없습니다 — DESCRIPTION 출처의 증거는 **없는 것이 정상** 입니다.");
  if (imageItems.length === 0) caveats.push("이미지 증거가 없습니다 — 판정 결함이 아니라 **공급 상태** 입니다.");
  caveats.push("이 화면의 의미 분석(동의어·한글 대응)은 **표시 전용** 이며 동일상품 판정에 들어가지 않습니다.");

  return {
    sourceUrl: facts.sourceUrl,
    title,
    description,
    imageUrls: facts.imageUrls ?? [],
    evidence,
    language: {
      hasKorean: HANGUL_RE.test(haystack),
      hasLatin: LATIN_RE.test(haystack),
      mappings,
      synonymGroups,
    },
    titleStructure: {
      brand: brandAlias ? { value: brandAlias, source: "TITLE", note: "브랜드 표기 등록부" } : null,
      season: seasonMatch ? { value: seasonMatch[0], source: "TITLE" } : null,
      modelCode: titleCodeList[0] ? { value: titleCodeList[0], source: "TITLE" } : null,
      forms,
      productName: remainder || null,
    },
    sleeve,
    image: {
      count: (facts.imageUrls ?? []).length,
      representative: rep?.value ?? null,
      normalized: Boolean(rep?.normalized),
      digest: rep?.digest ?? null,
    },
    caveats,
  };
}
