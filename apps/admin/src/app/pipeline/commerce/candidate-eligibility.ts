/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-CANDIDATE-ELIGIBILITY-01 — **MI 후보 «진입 자격» 하나의 owner**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔵 CPO 승인 정책(2026-11-22) — **후보 진입 자격과 최종 SAME 판정은 분리한다.**
 *
 * 🔴🔴 **이 파일은 「동일상품 판정」을 하지 않는다.** 여기서 `ELIGIBLE` 은
 *    「사람이 비교할 가치가 있다」는 뜻이고 **SAME 이 아니다**. 그래서 이 파일에는
 *    다음 어휘가 **한 글자도 없다** — `SAME` 승격 · threshold · 가격 · tier 계산.
 *    🟢 등급(`tier`)·verdict 는 **인자로 받아 읽을 뿐** 이고 만들지 않는다.
 *
 * ── 🔴 왜 생겼나 — CEO 가 직접 본 22건에서 확인된 문제 ──────────────────────
 * ```
 * Versace 청바지 · Diesel · Polo Ralph Lauren 이 Bobo Choses 바지의 후보로 섰다.
 * 그 후보들이 들고 있던 「근거」는 전부 일반 정보였다:
 *    근거: 상품군 PANTS↔PANTS · 근거: 색상 BLUE · 근거: 대상 KIDS ·
 *    근거: 소재 cotton:100 · 근거: 핵심 상품명 일부 denim
 * ⟹ `SAME_MIN_AXES` 를 그 일반 축으로 채워 `PRESUMED_SAME` 이 되고,
 *    `mayShowCandidate` ②(「PRESUMED_SAME 이면 통과」)가 **무조건** 통과시켰다.
 * ```
 * 🔴 **8축을 완화하지도 강화하지도 않는다** — 그 판정은 그대로 두고, **표시 자격**
 *    이라는 **다른 문** 을 하나 더 세운다(CPO 「후보 발굴과 MI 후보 노출을 구분」).
 *
 * ── 🔴 경계(CPO §4-6 확정) ─────────────────────────────────────────────────
 * ```
 * 발굴 원본      🟢 보존 — 이 파일은 **아무것도 지우지 않는다**(순수 술어)
 * MI 후보 목록    🔴 여기서 거른다
 * 검토 목록       🔴 여기서 거른다
 * 가격·집계·등록   🟢 **닿지 않는다** — 소비처가 표시 게이트 둘뿐이다(계약이 잠근다)
 * ```
 */

/**
 * 🔴🔴 **일반 단어 — 「이것이 겹쳐도 식별이 아니다」.**
 *
 * 🔵 CPO 가 직접 지명한 셋(`Dress` · `Jacket` · `Pants`)에서 출발하고,
 *    **CEO 가 본 22건에 실제로 나온 말만** 더했다(🔴 추측으로 넓히지 않는다).
 * 🔴 **브랜드 사전이 아니다** — 브랜드 alias 는 이 파일에서 **추가하지 않는다**.
 * 🔴 상품 유형 · 색상 · 소재 · 대상 · 형태 묘사만 담는다. 고유 디자인명(`taxi` ·
 *    `saurus` · `handsmock` · `otter`)은 **식별어** 이므로 **절대 넣지 않는다**.
 */
export const GENERIC_NAME_TOKENS: readonly string[] = [
  /* ── 상품 유형(CPO 지명 + 22건 실측) ── */
  "dress", "jacket", "pants", "trousers", "jeans", "shirt", "tshirt", "t-shirt",
  "sweatshirt", "coat", "anorak", "cap", "backpack", "blouse", "tunique", "outer",
  "top", "bottom", "set", "suit", "puffer",
  /* ── 형태·소재 묘사 ── */
  "denim", "woven", "knit", "knitted", "reversible", "print", "printed", "gingham",
  "tartan", "cotton", "organic", "polyester", "nylon", "wool", "linen", "fur",
  "faux", "mixed", "media", "long", "short", "sleeve", "sleeves", "sleeved",
  /* ── 색상 ── */
  "blue", "black", "white", "red", "pink", "green", "brown", "grey", "gray",
  "beige", "cream", "ecru", "navy", "burgundy", "lilac", "coral", "lemon", "natural",
  "mix", "melange", "mehrfarbig",
  /* ── 대상·시즌·판매 문구 ── */
  "kids", "baby", "boys", "girls", "girl", "boy", "child", "junior", "aw26", "ss26",
  "exclusive", "preorder", "copy", "new", "the", "and", "with", "for", "by", "in", "of",
];

const GENERIC = new Set(GENERIC_NAME_TOKENS);

/** 🔴 정규화 — **새 규칙을 만들지 않는다**. 소문자 + 비영숫자/비한글 제거뿐이다. */
const norm = (s: string | null | undefined): string =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

/**
 * 🟢 **식별 토큰** — 원상품 제목 토큰 중 **일반 단어를 뺀** 것.
 * 🔴 두 글자 이하는 버린다(`nº`·`03` 같은 조각이 우연히 겹치는 것을 막는다).
 */
export function identifyingNameTokens(title: string | null | undefined): string[] {
  return [
    ...new Set(
      (title ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !GENERIC.has(t)),
    ),
  ];
}

/** 🔵 자격 상태 — 🔴 **판정 상태가 아니다**(기존 네 상태와 다른 축이다). */
export type CandidateEligibility = "ELIGIBLE" | "EXCLUDED" | "UNVERIFIABLE";

/** 🔵 자격을 준 근거 / 뺀 사유 — 🔴 화면과 보고가 **같은 말** 을 쓰도록 한 곳에 둔다. */
export type EligibilityReason =
  /* 유지 */
  | "BRAND_LINK"
  | "CODE_LINK"
  | "NAME_LINK"
  | "DESCRIPTION_LINK"
  /* 제외 */
  | "NO_IDENTITY_LINK"
  | "GENERIC_TOKENS_ONLY"
  | "EXPLICIT_CONFLICT"
  /* 확인 불가 */
  | "NO_SOURCE_TEXT";

export const ELIGIBILITY_REASON_TEXT: Record<EligibilityReason, string> = {
  BRAND_LINK: "브랜드가 일치합니다",
  CODE_LINK: "품번이 일치합니다",
  NAME_LINK: "상품명에 일반 단어를 넘어서는 식별어가 겹칩니다",
  DESCRIPTION_LINK: "상세설명 원문에서 원상품 식별정보를 확인했습니다",
  NO_IDENTITY_LINK: "브랜드·품번·상품명에 연결 근거가 없습니다",
  GENERIC_TOKENS_ONLY: "상품 유형·색상 같은 일반 단어만 겹칩니다",
  EXPLICIT_CONFLICT: "다른 상품임을 보여주는 식별정보 충돌이 있습니다",
  NO_SOURCE_TEXT: "원문을 확보하지 못해 확인할 수 없습니다",
};

/**
 * 🔵 입력 — **이미 계산된 값만** 받는다. 🔴 이 파일이 추출·판정·수집을 하지 않는다.
 *
 * 🔴🔴 **`originModelCode` 는 운영 `brandModelCode` 다** — DB `sku` 칸과 **혼용하지
 *    않는다**(CPO 반복 지시). 호출부가 어느 값을 넘기는지 그 자리에서 책임진다.
 */
export interface CandidateEligibilityInput {
  originBrand?: string | null;
  originModelCode?: string | null;
  originTitle?: string | null;
  candidateBrand?: string | null;
  candidateModelCode?: string | null;
  candidateTitle?: string | null;
  /** 🟢 후보 상세설명 **원문**(UIED-02 가 응답에 실은 그 값). 🔴 없으면 `null`. */
  candidateDescription?: string | null;
  /** 🟢 운영이 이미 적어 둔 충돌 토큰(`BRAND_MISMATCH` 등). 🔴 새로 만들지 않는다. */
  conflicts?: readonly string[] | null;
}

export interface CandidateEligibilityResult {
  eligibility: CandidateEligibility;
  reasons: EligibilityReason[];
  /** 🟢 상품명 축으로 유지된 경우 **어떤 식별어가 겹쳤는지**(화면이 그대로 보여준다). */
  matchedNameTokens: string[];
}

/**
 * 🔴 **명확한 충돌 토큰** — 운영이 이미 쓰는 이름 그대로다(새 토큰 0).
 * 🟢 `COLOR_VARIANT` · `MATERIAL` · `SIZE_SYSTEM` 은 **넣지 않는다** — CPO 가
 *    「품번은 일치하지만 색상·구성 변형 가능성」을 **별도 확인 조건** 으로 뒀다.
 */
const CONFLICT_TOKENS = new Set(["BRAND_MISMATCH", "MODEL_CODE", "GARMENT_FORM", "AUDIENCE_LINE"]);

/**
 * 🔵🔵 **자격 판정 — 유지 / 제외 / 확인 불가.**
 *
 * 🔴 순서가 계약이다:
 * ```
 * ① 연결 근거를 «먼저» 모은다 — 하나라도 있으면 **충돌이 있어도 유지** 한다.
 *    🔴 왜 — CEO 실측: `junioredition` Mixed Media Jacket 은 품번이 일치하는데
 *       `COLOR_VARIANT` 가 걸려 있다(색상만 다른 **같은 상품** · CEO SAME).
 *       충돌을 먼저 보면 **그 SAME 을 지운다**.
 * ② 근거가 없고 **원문도 없으면** → `UNVERIFIABLE`(🔴 「없음」이 아니다).
 * ③ 근거가 없고 충돌이 **명확하면** → `EXCLUDED`(사유 `EXPLICIT_CONFLICT`).
 * ④ 근거가 없으면 → `EXCLUDED`. 일반 단어만 겹쳤으면 그 사유를 적는다.
 * ```
 */
export function evaluateCandidateEligibility(
  input: CandidateEligibilityInput,
): CandidateEligibilityResult {
  const reasons: EligibilityReason[] = [];

  /* ── ① 브랜드 연결 ─────────────────────────────────────────────────────── */
  const ob = norm(input.originBrand);
  const cb = norm(input.candidateBrand);
  const candTitleNorm = norm(input.candidateTitle);
  /**
   * 🔴🔴 **후보 구조화 브랜드가 «없을 때» 를 같이 본다 — 실측이 요구했다.**
   *    `candidate_reviews` 에 후보 브랜드 칸이 **없다**(MMCS-01 실측 0/364) ⟹
   *    구조화만 보면 **제목에 브랜드가 그대로 적힌 후보까지 제외** 된다.
   * 🟢 실측 — 원상품 `Main Story` ↔ 후보 제목 「Bubble Sweatshirt in Grey Melange
   *    **by Main Story**」(운영 `STRONG_IDENTIFIER` · blocker 0). 🔴 1차 구현이 그
   *    **운영 SAME 2건을 제외** 했다.
   * 🔴 **brand alias 를 추가한 것이 아니다** — 원상품 브랜드 «문자열 그대로» 를 찾는다.
   */
  const brandInTitle = ob.length > 0 && candTitleNorm.includes(ob);
  if (ob.length > 0 && ((cb.length > 0 && ob === cb) || brandInTitle)) reasons.push("BRAND_LINK");

  /* ── ② 품번 연결 ──────────────────────────────────────────────────────── */
  const oc = norm(input.originModelCode);
  const cc = norm(input.candidateModelCode);
  if (oc.length > 0 && cc.length > 0 && oc === cc) reasons.push("CODE_LINK");

  /* ── ③ 상품명 연결 — 🔴 일반 단어는 세지 않는다 ────────────────────────── */
  const originTokens = identifyingNameTokens(input.originTitle);
  const candNorm = candTitleNorm;
  const matchedNameTokens = originTokens.filter((t) => candNorm.includes(norm(t)));
  /**
   * 🔴🔴 **임계를 「2개」로 고정하면 식별어가 하나뿐인 원상품이 구조적으로 막힌다.**
   *    실측 — `Bubble Sweatshirt - Grey Melange` 의 식별 토큰은 **`bubble` 하나** 다
   *    (`sweatshirt`·`grey`·`melange` 는 일반어) ⟹ **2개를 영원히 못 넘는다**.
   * 🟢 그래서 **원상품이 가진 식별어 수** 를 기준으로 본다 — 하나뿐이면 그 하나가
   *    **유일한 식별어** 이므로 그것의 일치로 충분하다.
   * 🔴 느슨해지는 방향이라 **반사실로 재확인** 했다(C-1 — 되살아나는 무관 후보 수 불변).
   */
  const nameLinkNeeded = originTokens.length <= 1 ? 1 : 2;
  if (originTokens.length > 0 && matchedNameTokens.length >= nameLinkNeeded) reasons.push("NAME_LINK");

  /* ── ④ 상세설명 연결 — 🟢 원문에서 원상품 식별정보를 찾는다 ─────────────── */
  const desc = input.candidateDescription ?? "";
  if (desc.length > 0) {
    const dn = norm(desc);
    /**
     * 🔴 품번은 **그대로** 든 **접두 한 글자가 빠진 꼴** 이든 받는다.
     *    실측(CEO SAME · donokids) — 원상품 `B226AC073` ↔ 후보 본문 `#226AC073`.
     *    🔴 **느슨한 부분일치를 허용하는 것이 아니다** — 뒤에서 자른 꼬리는 보지 않고
     *       **앞 한 글자만** 떼는 꼴 하나다(길이 4 이상일 때만).
     */
    const codeHit =
      oc.length > 0 && (dn.includes(oc) || (oc.length >= 4 && dn.includes(oc.slice(1))));
    const brandHit = ob.length > 0 && dn.includes(ob);
    /** 🔴 상세설명 축도 **같은 임계** 를 쓴다(식별어가 하나뿐인 원상품 고려). */
    const nameHit =
      originTokens.length > 0 &&
      originTokens.filter((t) => dn.includes(norm(t))).length >= (originTokens.length <= 1 ? 1 : 2);
    if (codeHit || brandHit || nameHit) reasons.push("DESCRIPTION_LINK");
  }

  if (reasons.length > 0) return { eligibility: "ELIGIBLE", reasons, matchedNameTokens };

  /* ── ② 확인 불가 — 🔴 원문이 아예 없다 ────────────────────────────────── */
  const hasAnySource =
    (input.candidateTitle ?? "").trim().length > 0 ||
    desc.length > 0 ||
    cb.length > 0 ||
    cc.length > 0;
  if (!hasAnySource) {
    return { eligibility: "UNVERIFIABLE", reasons: ["NO_SOURCE_TEXT"], matchedNameTokens };
  }

  /* ── ③ 명확한 충돌 ───────────────────────────────────────────────────── */
  const hasConflict = (input.conflicts ?? []).some((c) => CONFLICT_TOKENS.has(c));
  if (hasConflict) {
    return { eligibility: "EXCLUDED", reasons: ["EXPLICIT_CONFLICT"], matchedNameTokens };
  }

  /* ── ④ 연결 근거 없음 ────────────────────────────────────────────────── */
  const genericOnly =
    originTokens.length > 0 && matchedNameTokens.length < 2 && candNorm.length > 0;
  return {
    eligibility: "EXCLUDED",
    reasons: genericOnly ? ["GENERIC_TOKENS_ONLY"] : ["NO_IDENTITY_LINK"],
    matchedNameTokens,
  };
}

/** 🟢 표시 게이트가 쓰는 한 줄 — 🔴 「확인 불가」는 **숨기지 않는다**(분리해 보여준다). */
export function isCandidateEligibleForDisplay(input: CandidateEligibilityInput): boolean {
  return evaluateCandidateEligibility(input).eligibility !== "EXCLUDED";
}
