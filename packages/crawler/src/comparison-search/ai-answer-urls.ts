import { isSelfReferenceCandidate } from "./self-reference";
import { canonicalizeProductUrl } from "./self-reference";
import { classifyUrlShape } from "./url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-017 — **AI 답변 1회 붙여넣기** 의 입력 경계 (순수 함수)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **AI 가 「동일상품입니다」라고 말한 문장은 Evidence 가 아니다.**
 *    이 함수가 하는 일은 **URL 을 꺼내는 것 하나** 이고, 동일상품 여부는 그 뒤의
 *    기존 체인이 **실제 페이지를 열어** 판정한다:
 * ```
 * 이 함수 → factsFromProductUrl → confirmBrandCodeInEvidence
 *         → classifyCandidateMarket → MI → 판매판정
 * ```
 *    🔴 그래서 여기서 새 판정 규칙을 **한 줄도 만들지 않는다.** 재사용만 한다 —
 *    `canonicalizeProductUrl`(WU-009C) · `isSelfReferenceCandidate`(008A) ·
 *    `classifyUrlShape`.
 *
 * ── 🔴 WU-006 과 **입력 성질이 반대** 라는 점을 적어 둔다 ────────────────────
 * ```
 * WU-006(API 경로)  후보 URL 을 **검색결과 블록에서만** 뽑았다 — 산문 URL 은 환각이었다
 * WU-017(붙여넣기)  🔴 **산문밖에 없다.** 사람이 복사해 온 텍스트가 유일한 입력이다
 * → 그래서 「URL 을 믿는다」로 바뀌는 것이 **아니다.** 바뀌는 것은 **URL 의 출처** 이고,
 *   「그 URL 이 그 상품인가」는 **여전히 따져가 페이지를 열어** 판정한다.
 *   🟢 즉 승격된 원칙(「URL 은 Discovery signal, Evidence 는 따져가 검증」)이 그대로 지켜진다.
 * ```
 */

/** 제외된 URL 과 **이유** — 🔴 조용히 버리지 않는다(셀러가 왜 빠졌는지 알아야 한다). */
export type AiUrlDropReason =
  /** URL 로 파싱되지 않음 */
  | "INVALID_URL"
  /** http/https 가 아님 */
  | "UNSUPPORTED_SCHEME"
  /** 같은 텍스트 안에서 이미 나온 URL(정규화 기준 중복) */
  | "DUPLICATE"
  /** 원본 상품과 같은 listing — 자기 자신을 후보로 쓰지 않는다(008A) */
  | "SELF_REFERENCE"
  /** 상품 상세 페이지가 아니다(목록/검색/블로그 등) */
  | "NOT_PRODUCT_PAGE";

export interface AiUrlExtraction {
  /** 검증 체인으로 넘길 후보. 🔴 **정규화된 URL** 이다(추적/검색 파라미터 제거됨). */
  urls: string[];
  /** 🔴 제외된 것 전부 + 이유. 화면이 그대로 보여줄 수 있다. */
  dropped: { url: string; reason: AiUrlDropReason }[];
  /** 🟡 텍스트에서 발견한 URL 총수(중복 포함) — 「몇 개 중 몇 개가 남았는가」를 말하기 위한 분모. */
  foundCount: number;
}

/**
 * 🔴 URL 추출은 **보수적** 이다. 뒤에 붙는 문장부호를 떼고, 괄호/따옴표는 경계로 본다.
 *    마크다운 링크 `[텍스트](url)` 도 괄호가 경계라서 그대로 걸린다.
 */
const URL_RE = /https?:\/\/[^\s<>"'`()\[\]]+/g;
/** 🔴 문장 끝 문자는 URL 의 일부가 아니다 — 실측에서 `…jacket.` `…jacket,` 가 흔하다. */
const TRAILING_PUNCT_RE = /[.,;:!?]+$/;

/**
 * AI 답변 텍스트에서 후보 URL 을 꺼낸다.
 *
 * @param text      사람이 붙여넣은 AI 답변 전문
 * @param originUrl 원본 상품 URL — 자기참조 제거에 쓴다. 없으면 그 검사만 건너뛴다
 * @param options   `requireProductPage` 기본 **true** — 목록/검색 URL 은 후보가 아니다
 *
 * 🔴 AI 의 주장(「동일상품입니다」)은 **읽지 않는다.** 이 함수는 텍스트에서 URL 만 본다.
 */
export function extractCandidateUrlsFromAiAnswer(
  text: string,
  originUrl?: string | null,
  options?: { requireProductPage?: boolean },
): AiUrlExtraction {
  const requireProductPage = options?.requireProductPage ?? true;
  const urls: string[] = [];
  const dropped: { url: string; reason: AiUrlDropReason }[] = [];
  const seen = new Set<string>();
  let foundCount = 0;

  for (const raw0 of text.match(URL_RE) ?? []) {
    const raw = raw0.replace(TRAILING_PUNCT_RE, "");
    if (!raw) continue;
    foundCount += 1;

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      dropped.push({ url: raw, reason: "INVALID_URL" });
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      dropped.push({ url: raw, reason: "UNSUPPORTED_SCHEME" });
      continue;
    }

    /* 🟢 WU-009C 의 정규화기를 그대로 쓴다 — 추적/검색 문맥 파라미터만 걷어낸다.
       🔴 host·경로·로케일·식별 파라미터는 보존된다(시장을 합치지 않는다). */
    const canonical = canonicalizeProductUrl(raw);

    /* 🔴 중복 판단은 **정규화 키** 로 한다 — 같은 상품이 utm 만 달라 두 번 들어온다. */
    const key = canonical.toLowerCase();
    if (seen.has(key)) {
      dropped.push({ url: raw, reason: "DUPLICATE" });
      continue;
    }
    seen.add(key);

    /* 🔴 자기참조 — 원본과 같은 listing 이면 후보가 아니다(008A 정책 그대로). */
    if (originUrl && isSelfReferenceCandidate(originUrl, canonical)) {
      dropped.push({ url: raw, reason: "SELF_REFERENCE" });
      continue;
    }

    /* 🔴 상품 상세가 아니면 후보가 아니다 — AI 는 목록/검색 URL 도 함께 준다.
       🟢 판정기를 새로 만들지 않고 기존 `classifyUrlShape` 를 쓴다. */
    if (requireProductPage && classifyUrlShape(canonical) !== "PRODUCT_PAGE") {
      dropped.push({ url: raw, reason: "NOT_PRODUCT_PAGE" });
      continue;
    }

    urls.push(canonical);
  }

  return { urls, dropped, foundCount };
}
