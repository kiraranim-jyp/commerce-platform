import { canonicalizeProductUrl } from "./self-reference";
import { classifyUrlShape, toCrawlerUrl } from "./url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-019A-ALT ③ — **Discovery URL 을 세 층으로 갈라 적는다** (순수 함수)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 필요한가 — 실측된 KPI 왜곡 하나(WU-019A-ALT):
 * ```
 * DDG 가 준 URL        bobochoses.com/<로케일·쿼리 장식>/products/b226ac010-…
 * 알려진 정답 URL      bobochoses.com/products/b226ac010-…
 * → 문자열로 맞추면 **미발견**(1/7) · 검증 단계의 정규화 URL 로 맞추면 **발견**(2/7)
 * 🔴 같은 데이터인데 KPI 가 두 배 달라졌다. 기준을 고정하지 않으면 다른 검색 경로
 *    (Gemini/GPT/다른 엔진)와 **같은 표에 넣을 수 없다.**
 * ```
 *
 * 🔴 **새 정규화기를 만들지 않는다** — 세 층 전부 기존 owner 의 산출이다:
 * ```
 * ① rawSearchUrl  검색엔진이 «실제로» 준 문자열 그대로 — 🔴 시장/로케일이 보존된다
 * ② canonicalUrl  `canonicalizeProductUrl`(WU-009C) — 추적/검색 파라미터만 걷는다.
 *                 🟢 **열 수 있는 URL** 이고 로케일·식별 파라미터가 남는다
 * ③ identityKey   `toCrawlerUrl(...).dedupeKey` — 검증 경로가 «같은 페이지» 를
 *                 가리는 데 쓰는 그 키다. 🔴 Shopify 분기에서 **로케일이 접힌다**
 *                 (「원산지 기준가」 계약 · discovery-benchmark.test.ts:123-125)
 * ```
 *
 * ── 🔴 어느 층으로 무엇을 하는가 (이 규칙이 KPI 정의다) ────────────────────
 * ```
 * KPI 대조(발견/중복 판정)   → **③ identityKey** 로만 한다
 * 화면·저장·재방문            → **② canonicalUrl**
 * 「엔진이 무엇을 줬는가」 보고 → **① rawSearchUrl**(가공 금지 · 시장 증거)
 * 🔴 ①로 대조하면 1/7 처럼 **과소** 가 되고, ③을 저장하면 **시장이 사라진다.**
 *    그래서 **세 층을 다 남긴다** — 하나로 합치지 않는다.
 * ```
 */
export interface DiscoveryUrlRecord {
  /** ① 검색엔진이 준 원문. 🔴 가공하지 않는다. */
  rawSearchUrl: string;
  /** ② 열 수 있는 정규 URL(추적 파라미터만 제거 · 로케일 보존). */
  canonicalUrl: string;
  /** ③ 같은 페이지를 가리는 키. 🔴 **대조는 이것으로만** 한다. 만들 수 없으면 null. */
  identityKey: string | null;
  /** 🟢 ③을 만들지 못한 이유를 말할 수 있게 모양도 남긴다. */
  shape: ReturnType<typeof classifyUrlShape>;
}

/** 🔴 세 층을 **동시에** 낸다 — 호출부가 하나만 들고 다니지 못하게 한다. */
export function discoveryUrlRecord(rawSearchUrl: string): DiscoveryUrlRecord {
  const canonicalUrl = canonicalizeProductUrl(rawSearchUrl);
  const shape = classifyUrlShape(canonicalUrl);
  const { dedupeKey } = toCrawlerUrl(canonicalUrl, shape);
  return { rawSearchUrl, canonicalUrl, identityKey: dedupeKey, shape };
}

/**
 * 🔴 **KPI 대조의 유일한 자리.** 「엔진이 이 정답을 찾았는가」를 ③으로 판단한다.
 *
 * 🔴 정답 쪽도 **같은 함수** 를 통과시킨다 — 한쪽만 정규화하면 그것이 1/7 왜곡이다.
 * 🔴 ③을 만들 수 없는 URL(상품 모양이 아님 등)은 **맞았다고 하지 않는다**(null 은 불일치).
 */
export function matchesKnownPositive(foundUrl: string, knownPositiveUrl: string): boolean {
  const a = discoveryUrlRecord(foundUrl).identityKey;
  const b = discoveryUrlRecord(knownPositiveUrl).identityKey;
  return a !== null && b !== null && a === b;
}
