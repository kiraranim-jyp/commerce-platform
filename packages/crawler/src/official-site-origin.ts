import { extractCountryOfOrigin } from "./description-facts";
import { fetchHtmlDirect } from "./utils/direct-html-fetch";
import { checkRobots, type RobotsVerdict } from "./utils/robots-gate";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P2(CPO 결정, 2026-10-09) — **제조국은 «공식몰에서 확인된 것» 만 쓴다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실측(세르지오 타치니): 「원산지는 대상 브랜드의 공식 홈페이지에서 찾아서
 * 입력해야 한다」. CPO 확정 사슬:
 *
 *   브랜드 → 공식몰 식별 → robots/접근 확인 → 제조국 근거 탐색
 *   → manufacturingCountry → 상품정보 원산지에 «근거와 함께» 반영
 *
 * ── 🔴 정책 ──────────────────────────────────────────────────────────────
 *   · 브랜드 국가 ≠ 제조국. 브랜드가 이탈리아 회사라는 사실은 제조국 근거가 아니다.
 *   · 공식몰에서 «확인된 경우에만» 자동 입력. 못 찾으면 `미확인`.
 *   · 해외 판매몰(편집샵)의 국가를 제조국으로 오인하지 않는다 — 공식몰만 본다.
 *   · AI 추정으로 제조국을 만들지 않는다. 이 파일에 LLM 호출이 없다.
 *   · 공식몰 URL 과 근거 문장을 provenance 로 «보존» 한다.
 *   · HTTP 는 후보 브랜드에 한정한다 — 무차별 크롤링하지 않는다(아래 ③).
 *
 * ── 🔴 왜 「후보 브랜드에 한정」이 구조로 보장되는가 ───────────────────────
 * 이 함수는 공식몰 도메인을 «스스로 찾지 않는다». 호출부가 도메인을 주어야 하고,
 * 그 도메인은 우리가 이미 「이 도메인은 이 브랜드의 공식몰」이라고 «관측해 둔»
 * 목록에서만 온다(`officialSiteForBrand`). 검색엔진으로 브랜드명을 쳐서 도메인을
 * 추측하는 경로를 만들지 않았다 — 그것이 무차별 수집의 입구다.
 *
 * ── 🔴 HTTP 는 최대 2회다 ────────────────────────────────────────────────
 *   ① robots.txt   도메인당 한 번(호출부가 캐시한다)
 *   ② 확인 페이지  하나만 받는다. 사이트 전체를 돌지 않는다.
 * 못 찾으면 «더 뒤지지 않고» UNVERIFIED 로 끝낸다. 「한 페이지 더」가 쌓이는 것이
 * 무차별 크롤링이다.
 */

/**
 * 「이 도메인은 이 브랜드의 공식몰」이라고 **관측된** 쌍.
 *
 * 🔴 추측으로 늘리지 않는다. `seller-facts.ts` 의 `OFFICIAL_STORE_BRANDS` 가
 * 같은 규칙으로 도메인→브랜드를 들고 있고(실측 1건), 이 표는 그 역방향이다.
 * 브랜드명을 도메인으로 «짜 맞추는» 규칙(예: 소문자+공백제거+.com)을 만들지
 * 않는다 — `main-story.com`(하이픈)과 `mainstory.com`(인도네시아 데이케어 업체)
 * 이 그 규칙이 왜 위험한지 보여 준 실측 사례다.
 */
const OFFICIAL_SITE_BY_BRAND: Record<string, string> = {
  "bobo choses": "bobochoses.com",
};

/** 브랜드명 → 공식몰 도메인. 🔴 모르면 null 이고, 추측하지 않는다. */
export function officialSiteForBrand(brand: string | null | undefined): string | null {
  const key = (brand ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!key) return null;
  return OFFICIAL_SITE_BY_BRAND[key] ?? null;
}

export type OfficialOriginState =
  /** 공식몰에서 제조국 문장을 찾았다. 이 값만 자동 입력한다. */
  | "VERIFIED"
  /** 공식몰을 받았지만 제조국 문장이 없었다 → 미확인. */
  | "UNVERIFIED"
  /** robots 가 막았거나 받지 못했다 → 미확인(우회하지 않는다). */
  | "BLOCKED"
  /** 이 브랜드의 공식몰을 «모른다» → 미확인. */
  | "NO_OFFICIAL_SITE";

export interface OfficialOriginEvidence {
  state: OfficialOriginState;
  /** VERIFIED 일 때만 값이 있다. 그 밖에는 항상 null — 「미확인」이다. */
  manufacturingCountry: string | null;
  /** 어느 URL 에서 확인했는가. provenance 로 보존한다. */
  sourceUrl: string | null;
  /** 어떤 문장에서 읽었는가. 🔴 요약하지 않고 원문 조각을 남긴다. */
  snippet: string | null;
  /** 셀러에게 보여줄 한 줄. */
  reason: string;
}

const UNVERIFIED = (reason: string, sourceUrl: string | null = null): OfficialOriginEvidence => ({
  state: "UNVERIFIED",
  manufacturingCountry: null,
  sourceUrl,
  snippet: null,
  reason,
});

/** HTML → 텍스트. 🔴 태그만 벗긴다. 의미를 해석하지 않는다. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ══ 🔴 실측이 잡은 결함(bobochoses.com, 2026-10-09) ════════════════════════
 *
 * 처음에는 「국가명이 «처음» 나오는 자리」를 근거로 잘랐다. 실제 상품 페이지를
 * 돌려 보니 그 자리가 **배송 국가 드롭다운** 이었다 —
 *
 *   근거(틀림) : "… South Korea (KRW ₩) South Sudan (EUR €) Spain (EUR €) St. Bar …"
 *   근거(맞음) : "… 100% Cotton. Responsibly made in Spain. Find your perfect fit …"
 *
 * 추출값("Spain")은 맞았다. 틀린 것은 «셀러에게 보여 줄 근거» 였다. 그리고 그것이
 * 더 위험하다 — 셀러가 그 조각을 보고 「배송 국가를 제조국으로 읽었구나」로
 * 판단할 수도, 반대로 틀린 근거를 믿고 확정할 수도 있다.
 * ([[smallable-market-is-shipping-destination]] 이 같은 함정을 기록해 뒀다.)
 *
 * 🔴 그래서 «단서 뒤에 오는» 국가명만 근거로 자른다. 단서를 못 찾으면 **null** 이다 —
 *    틀린 근거를 보여주는 것보다 근거 없음이 낫다(그 경우 호출부가 값만 보여준다).
 * 🔴 단서 목록은 `extractCountryOfOrigin` 의 패턴과 «같은 어휘» 다. 두 벌이 되면
 *    추출은 됐는데 근거는 못 찾는 상태가 생긴다.
 */
const ORIGIN_CUES = ["made in", "country of origin", "origin:", "origin :", "제조국", "원산지"];

export function originSnippet(text: string, country: string): string | null {
  const lower = text.toLowerCase();
  const target = country.toLowerCase();
  /* 🔴 국가명이 나오는 «모든» 자리를 보고, 그중 앞 60자 안에 단서가 있는 것을 고른다.
     첫 등장만 보면 배송 드롭다운에 걸린다(위 실측). */
  for (let at = lower.indexOf(target); at >= 0; at = lower.indexOf(target, at + 1)) {
    const before = lower.slice(Math.max(0, at - 60), at);
    if (!ORIGIN_CUES.some((cue) => before.includes(cue))) continue;
    const from = Math.max(0, at - 80);
    return text.slice(from, Math.min(text.length, at + country.length + 60)).trim();
  }
  return null;
}

/**
 * 공식몰 «한 페이지» 에서 제조국을 확인한다.
 *
 * @param pageUrl 확인할 URL. 🔴 호출부가 정한다 — 이 함수가 사이트를 돌지 않는다.
 * @param robots  이미 확인한 robots 판정. 🔴 넘기지 않으면 여기서 «직접» 확인한다
 *   (도메인당 1회를 호출부가 캐시하라는 뜻이지, 생략해도 되는 뜻이 아니다).
 */
export async function verifyOriginFromOfficialPage(
  pageUrl: string,
  robots?: RobotsVerdict,
): Promise<OfficialOriginEvidence> {
  const gate = robots ?? (await checkRobots(pageUrl));
  if (gate.state === "DISALLOWED") {
    return {
      state: "BLOCKED",
      manufacturingCountry: null,
      sourceUrl: pageUrl,
      snippet: null,
      /* 🔴 우회하지 않는다. 막혔다는 사실을 그대로 적는다. */
      reason: `공식몰 robots 가 이 경로를 허용하지 않습니다(${gate.rule}) — 제조국은 미확인으로 둡니다.`,
    };
  }
  if (gate.state === "UNKNOWN") {
    return {
      state: "BLOCKED",
      manufacturingCountry: null,
      sourceUrl: pageUrl,
      snippet: null,
      reason: `공식몰 robots 를 확인하지 못했습니다(${gate.reason}) — 확인 전에는 받지 않습니다.`,
    };
  }

  const res = await fetchHtmlDirect(pageUrl);
  if (!res || res.status !== 200) {
    return {
      state: "BLOCKED",
      manufacturingCountry: null,
      sourceUrl: pageUrl,
      snippet: null,
      reason: res ? `공식몰 응답 ${res.status} — 제조국을 확인하지 못했습니다.` : "공식몰에 연결하지 못했습니다.",
    };
  }

  return classifyOfficialOriginHtml(res.html, res.finalUrl || pageUrl);
}

/**
 * ══ 🔴 판정을 «네트워크에서 꺼냈다»(음성 대조 U10, 2026-10-09) ═════════════
 *
 * 처음에는 이 판정이 `verifyOriginFromOfficialPage` 안에 있었다. 그러자 음성
 * 대조에서 **「확인하지 못했는데 VERIFIED + 지어낸 값」으로 바꿔도 한 건도
 * 실패하지 않았다** — 그 분기를 재려면 네트워크가 필요해서, 테스트가 소스
 * 문자열만 보고 있었기 때문이다.
 *
 * 🔴 소스 검사는 「그 줄이 있다」만 말하고 「그 줄이 그렇게 «동작한다»」는 말하지
 *    못한다. 그래서 순수 함수로 꺼낸다 — 이제 HTML 한 조각으로 전수 판정할 수 있다.
 *    (M4 에서 `classifySiblingConnectionRows` 를 꺼낸 것과 같은 처방이다.)
 */
export function classifyOfficialOriginHtml(html: string, sourceUrl: string): OfficialOriginEvidence {
  const text = htmlToText(html);
  /* 🔴 추출기를 새로 만들지 않는다 — `extractCountryOfOrigin` 은 상품 수집이
     쓰는 그 순수 함수이고, 「Made in X · Country of Origin: X · 제조국: X」
     다섯 패턴만 본다. 패턴이 없으면 undefined 를 돌려주고 우리는 거기서 멈춘다. */
  const country = extractCountryOfOrigin(text);
  if (!country) {
    /* 🔴 추측하지 않는다. 브랜드 국가도, AI 도 쓰지 않는다 — 미확인이다. */
    return UNVERIFIED("공식몰에서 제조국 표기를 찾지 못했습니다 — 추측하지 않고 미확인으로 둡니다.", sourceUrl);
  }
  return {
    state: "VERIFIED",
    manufacturingCountry: country,
    sourceUrl,
    snippet: originSnippet(text, country),
    reason: `공식몰에서 제조국 표기를 확인했습니다 — 「${country}」.`,
  };
}

/**
 * 브랜드로 시작하는 전체 사슬. 🔴 공식몰을 모르면 **HTTP 를 한 번도 쓰지 않는다.**
 *
 * @param pagePath 공식몰에서 확인할 경로. 호출부가 상품 페이지 경로를 알면 그것을
 *   주고, 모르면 생략해 «루트 한 장» 만 본다. 🔴 경로를 우리가 지어내 여러 장을
 *   돌지 않는다.
 */
export async function verifyOriginForBrand(
  brand: string | null | undefined,
  pagePath?: string,
): Promise<OfficialOriginEvidence> {
  const domain = officialSiteForBrand(brand);
  if (!domain) {
    return {
      state: "NO_OFFICIAL_SITE",
      manufacturingCountry: null,
      sourceUrl: null,
      snippet: null,
      /* 🔴 「공식몰이 없다」가 아니다 — 「우리가 모른다」다. 그 둘을 구별해 적는다. */
      reason: "이 브랜드의 공식몰을 아직 확인해 두지 않았습니다 — 제조국은 미확인입니다.",
    };
  }
  const path = pagePath && pagePath.startsWith("/") ? pagePath : "/";
  return verifyOriginFromOfficialPage(`https://${domain}${path}`);
}
