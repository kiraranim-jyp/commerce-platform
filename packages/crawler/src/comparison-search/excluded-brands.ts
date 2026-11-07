/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **취급 제외 브랜드** — CEO 결정(2026-11-07) · CPO 승인 범위 §1~§3
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이것은 «판정» 이 아니다.** 동일성 비교를 하기 «전» 에 그 상품/후보를 **다루지
 *    않겠다**는 사업 결정이다. 그래서 matcher 와 분리된 **독립 순수 모듈** 로 둔다.
 * ```
 * ❌ 품번 신뢰도를 낮춘다        ❌ 소재·색상 공통 규칙을 만든다
 * ❌ SAME/SIMILAR 기준을 바꾼다  ❌ alias 등록부(`brand-alias.ts`)를 건드린다
 * 🟢 허용 — 「이 브랜드는 비교 대상이 아니다」를 **그 앞에서** 가른다
 * ```
 *
 * ── 🔴 왜 `brand-alias.ts` 가 아니라 새 파일인가 ────────────────────────────
 * ```
 * 그 파일은 **브랜드를 «찾는»** 등록부다(alias → 브랜드). 이 모듈은 **브랜드를 «거부»**
 * 한다. 같은 파일에 두면 다음 사람이 「alias 를 늘리면 제외도 늘어난다」로 읽는다.
 * 🔴 그리고 CPO 가 alias 등록부 변경을 **금지** 했다.
 * ```
 *
 * ── 🔴🔴 왜 Main Story 뿐인가 — 일반화 금지 ─────────────────────────────────
 * ```
 * CEO 가 적은 사유는 그 브랜드에 한정된다 — 「품번 코드가 모든 제품 동일한게 문제가
 * 있음, 그리고 셀러 취급도 하지 않음」.
 * 🔴 CPO 정정: 「품번이 같아도 소재·색상이 다를 수 있다」는 **일반 규칙이 아니다**.
 *    다른 브랜드의 동일 품번은 **기존 MI 기준대로** 비교한다.
 * ```
 */

/**
 * 🔴 **취급 제외 브랜드 — 하나다.** 늘릴 때는 CEO 결정이 선행한다(사업 결정이다).
 * 🔴 표기 변형만 적는다 — 「Main Story」 / 「main-story」 / 「메인스토리」 / 「매인스토리」.
 *    🔴 `Story` 단독은 **적지 않는다** — 다른 브랜드(예: Story Loris)를 지운다.
 */
export const EXCLUDED_BRAND_NAMES: readonly string[] = ["Main Story", "메인스토리", "매인스토리"];

/** 🔴 그 브랜드의 **공식몰 호스트**. 후보 `brand` 가 비어 있을 때의 둘째 신호다. */
export const EXCLUDED_BRAND_HOSTS: readonly string[] = ["main-story.com"];

/** 🟢 사용자에게 보여줄 이름 — 화면 문구가 이 값을 쓴다(사본 금지). */
export const EXCLUDED_BRAND_LABEL = "Main Story";

/**
 * 🔴 화면 문구의 **단일 owner**. CPO §3 이 글자를 고정했다 — 여기서만 적는다.
 * 🔴 「후보를 찾지 못했습니다」·「검색 결과 없음」·「상품 매칭 실패」로 **적지 않는다** —
 *    검색을 **시도하지 않았다**. 원인을 정확히 가른다.
 */
export const EXCLUDED_BRAND_NOTICE =
  "취급 제외 브랜드입니다. Main Story는 현재 취급 대상이 아니므로 상품 검색 및 가격 비교를 진행하지 않았습니다.";

/**
 * 🔴🔴🔴 **부분 탐색이 아니라 «완전 일치» 다 — 이것이 이 모듈의 안전장치다.**
 *
 * 🔴 1차 구현은 토큰 사이 구분자를 허용하는 **부분 탐색** 이었고, 내 계약이 그것을 잡았다:
 * ```
 * 「Mainstory Kids」가 제외됐다  ⟹ 🔴 **다른 브랜드를 지울 수 있는 모양** 이다
 * ```
 * 🟢 그런데 이 술어가 보는 것은 **산문이 아니라 «선언된 brand 칸»** 이다
 *    (`canonicalProduct.brand.value` · `facts.brand`). 선언된 칸에는 브랜드 이름만 들어온다
 *    ⟹ **정규화 후 완전 일치** 가 정확하고, 부분 탐색의 위험이 **구조적으로 사라진다**.
 *
 * 정규화 — NFKC · 소문자 · **영숫자/한글만 남긴다**(공백·하이픈·밑줄·점 제거).
 * ```
 * 🟢 제외   Main Story · main story · MAIN STORY · main-story · Main_Story · Mainstory
 *          메인스토리 · 매인스토리
 * 🔴 유지   Story · Story Loris · Storybook · Main · Main Storybook · Mainstory Kids
 * ```
 * 🔴 **알려진 한계** — brand 칸에 「Main Story Kids」처럼 **라인명이 붙어 오면 걸리지 않는다**.
 *    그 경우는 실측에 없고(6/6 이 정확히 `Main Story` 다), 느슨하게 하면 다른 브랜드가
 *    위험해진다 ⟹ **좁은 쪽을 택했다**. 늘릴 때는 실측을 먼저 올린다.
 */
const normBrand = (s: string): string =>
  s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");

const EXCLUDED_NORMALIZED: readonly string[] = EXCLUDED_BRAND_NAMES.map(normBrand);

function hasExcludedName(brand: string): boolean {
  const n = normBrand(brand);
  if (!n) return false;
  return EXCLUDED_NORMALIZED.includes(n);
}

/**
 * 🟢 **원상품 쪽 술어** — `canonicalProduct.brand.value`(= `dna.brand.value`) 하나만 본다.
 *
 * 🔴 제목·설명문을 보지 않는다. 원상품 브랜드는 선언된 값이고, 산문에서 브랜드를
 *    읽는 것은 **별개 문제**(BRAND 증거 트랙)이며 CPO 가 그 축을 열지 않았다.
 */
export function isExcludedOriginBrand(brand: string | null | undefined): boolean {
  if (!brand) return false;
  return hasExcludedName(brand);
}

/**
 * 🟢 **후보 쪽 술어** — 선언된 `brand` **또는** 공식몰 호스트.
 *
 * 🔴 실측(CEO Evidence Review 11쌍): 후보 `brand` 로 4/5 · 호스트로 2/5 가 잡히고,
 *    남는 1건(`donokids.com` · 후보 brand `null`)은 **원상품이 Main Story** 라
 *    `isExcludedOriginBrand` 가 먼저 끊는다 ⟹ 둘을 합쳐 **5/5** 다.
 * 🔴 후보 **제목** 은 보지 않는다 — 「by Main Story」 같은 귀속 문구를 읽는 것은
 *    새 추출 규칙이고, 그 축은 CPO 가 열지 않았다(실측에서 필요하지도 않다).
 */
export function isExcludedCandidate(input: { brand?: string | null; url?: string | null }): boolean {
  if (input.brand && hasExcludedName(input.brand)) return true;
  const url = input.url;
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  /** 🟢 서브도메인도 같은 판매처다 — 🔴 단 **접미사 경계** 를 지킨다(`notmain-story.com` 금지). */
  return EXCLUDED_BRAND_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}
