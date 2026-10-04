import type { ExtractedImage } from "@commerce/shared";
import type { CrawlerConfig } from "./config";
import type { ImageCandidate, StrategySource } from "./strategies/types";
import { extractCdnImageId, normalizeUrl, toParsableUrl } from "./utils/url.util";

export interface ExtractionTrace {
  url: string;
  sources: StrategySource[];
  score: number;
  included: boolean;
  reason: string;
}

export interface ScoreAndFilterResult {
  images: ExtractedImage[];
  trace: ExtractionTrace[];
}

const EXCLUDE_KEYWORDS = [
  "recommend",
  "related",
  "crosssell",
  "cross-sell",
  "upsell",
  "up-sell",
  "recent",
  "similar",
  "guess-like",
];
const LOGO_KEYWORDS = [
  "logo",
  "icon",
  "brand",
  "payment",
  "visa",
  "mastercard",
  "404",
  "error",
  "newsletter",
  "footer",
  "placeholder",
];
/** 광고/분석 추적 픽셀 도메인 — 상품과 무관한 1x1 이미지가 실려오는 경우가 많다. */
const TRACKER_HOSTS = [
  "bat.bing.", // .com/.net 등 TLD와 무관하게 매치
  "googletagmanager.com",
  "google-analytics.com",
  "doubleclick.net",
  "facebook.com",
  "connect.facebook.net",
  "analytics.tiktok.com",
];
const GALLERY_CONTEXT_KEYWORDS = [
  "gallery",
  "swiper",
  "carousel",
  "product-image",
  "product-photo",
  "pdp",
  "zoom",
];

const SOURCE_BASE_SCORE: Record<StrategySource, number> = {
  "json-ld": 90,
  shopify: 90,
  // PrestaShop 전용 경로는 상품 페이지의 갤러리 이미지를 구조적으로 가져오므로
  // shopify와 같은 신뢰도로 둔다 — 둘 다 플랫폼 마크업이 보장하는 상품 이미지다.
  prestashop: 90,
  /* P2-1 C — tennis-warehouse 갤러리(`prod_view-multiview-image`)도 같은 이유로 90 이다:
     사이트 전용 마크업이 「이것이 이 상품의 이미지 목록」이라고 보장한다.

     🔴 이 한 줄이 없어서 실측에서 **수집이 1장 → 0장** 이 됐다. `SOURCE_BASE_SCORE[s]`
     가 undefined → 점수 NaN → MIN_SCORE 미달로 탈락하고, 대표 이미지는 URL 이 같아
     dom-scan 후보와 «병합» 되므로 **원래 살아 있던 1장까지 함께 죽었다**
     (trace: `기본 NaN점(tennis-warehouse+dom-scan)`).
     StrategySource 에 값을 더하면 이 표와 `countBySource()` 를 «같이» 고친다. */
  "tennis-warehouse": 90,
  "next-data": 70,
  "open-graph": 60,
  "dom-scan": 50,
};

/** 600px 미만이면 감점만 한다(하드 제외 아님) — 지금 실제로 동작 중인 사이트(LojaDada 등)의
 * 진짜 최대 해상도 상품 이미지가 600px보다 작은 경우가 흔하고, 다운스트림 표준화 단계가
 * 이미 소형 원본을 업스케일해서 처리하고 있다. 600px는 "선호"이지 "필수"가 아니다.
 * 완전히 작은 아이콘/스프라이트 같은 진짜 노이즈는 CrawlerConfig.minWidth/minHeight
 * (기존 기본값 200px)로 걸러낸다 — 이게 실질적인 하드 하한선이다. */
const PREFERRED_RESOLUTION = 600;
const RESOLUTION_PENALTY = 10;
const MIN_SCORE = 40;
/** Shopify의 /products/{handle}.json은 색상 등 변형(variant)이 많은 상품이면 변형별
 * 사진을 전부 한 배열로 돌려준다 — 어떤 변형이 "지금 보고 있는" 것인지 안정적으로
 * 판별할 근거가 없어서(URL에 variant 파라미터가 없는 경우가 흔함) 여기서 억지로
 * 거르는 대신, 점수 상위 N장만 최종 채택해 다운스트림(다운로드/배경제거/분류)이
 * 상품 1개당 수십~백 장을 처리하는 사태를 막는다. */
const MAX_FINAL_IMAGES = 24;

interface MergedCandidate {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  context: string;
  siblingCount: number;
  sources: Set<StrategySource>;
}

/** 경로가 실제 이미지 «파일» 을 가리키는지. 가리키면 쿼리는 부가정보다. */
const IMAGE_FILE_PATH_RE = /\.(?:jpg|jpeg|png|webp|gif|avif|bmp|svg)$/i;

/**
 * ══ P2-1 C (CPO 지시, 2026-10-04 — 실측에서 역산) ════════════════════════════
 * **이미지 URL 전용** 정규화. 🔴 공용 `normalizeUrl()` 을 바꾸지 않는 이유가 있다.
 *
 * 쿼리가 언제나 노이즈인 것은 아니다. 리사이저/프록시형 CDN 은 「어떤 이미지인가」를
 * **쿼리에** 적는다:
 *
 *   https://img.tennis-warehouse.com/watermark/rs.php?path=STMFTP-BL-2.jpg&nw=1486
 *   https://example.com/_next/image?url=%2Fp%2F2.jpg&w=1920
 *
 * 쿼리를 지우면 서로 다른 사진 5장이 같은 `rs.php` 하나가 되어 **한 장으로 합쳐진다.**
 * 실측: 테니스창고 갤러리 5장이 전부 뭉개져 최종 1장이었다.
 *
 * 🔴 그런데 같은 규칙을 공용 `normalizeUrl()` 에 넣었더니 **상품 식별이 깨졌다**
 * (회귀 4건). 상품 «페이지» URL 에는 당연히 이미지 확장자가 없으므로 쿼리가 보존되고,
 * `?utm_source=…`·`?fbclid=…` 만 다른 URL 이 다른 상품이 되어 중복등록 가드가
 * 우회됐다(lifecycle-final-02 §② — CPO 가 명시한 가드). 그래서 **축을 갈랐다**:
 * 상품 신원은 공용 함수, 이미지 중복제거는 이 함수.
 *
 * 규칙은 하나다 — 사이트 이름을 적지 않는다:
 *   경로가 이미지 파일을 가리킨다   → 쿼리는 노이즈다 (지운다, 기존 동작 그대로)
 *   경로가 파일을 가리키지 «않는다» → 쿼리가 곧 신원이다 (유지한다)
 */
export function normalizeImageUrl(url: string): string {
  try {
    const parsed = new URL(toParsableUrl(url));
    if (IMAGE_FILE_PATH_RE.test(parsed.pathname)) return normalizeUrl(url);
    return parsed.toString();
  } catch {
    return normalizeUrl(url);
  }
}

function mergeByNormalizedUrl(candidates: ImageCandidate[]): Map<string, MergedCandidate> {
  const merged = new Map<string, MergedCandidate>();

  for (const candidate of candidates) {
    const url = toParsableUrl(candidate.url);
    const key = normalizeImageUrl(url);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        url,
        alt: candidate.alt,
        width: candidate.width,
        height: candidate.height,
        context: candidate.context ?? "",
        siblingCount: candidate.siblingCount ?? 0,
        sources: new Set([candidate.source]),
      });
      continue;
    }
    existing.sources.add(candidate.source);
    existing.width = existing.width ?? candidate.width;
    existing.height = existing.height ?? candidate.height;
    existing.context = existing.context || candidate.context || "";
    existing.siblingCount = Math.max(existing.siblingCount, candidate.siblingCount ?? 0);
  }

  return merged;
}

/** 같은 사진의 해상도 변형(CDN 이미지 ID 공유)을 하나로 합친다 — 그룹 내 가장 큰 해상도를
 * 대표로 쓰고, 그룹 구성원 전체의 출처(sources)를 합쳐서 다중 소스 보너스가 유지되게 한다. */
function collapseByCdnId(merged: MergedCandidate[]): MergedCandidate[] {
  const groups = new Map<string, MergedCandidate[]>();
  const ungrouped: MergedCandidate[] = [];

  for (const candidate of merged) {
    const id = extractCdnImageId(candidate.url);
    if (!id) {
      ungrouped.push(candidate);
      continue;
    }
    groups.set(id, [...(groups.get(id) ?? []), candidate]);
  }

  const collapsed = [...ungrouped];
  for (const group of groups.values()) {
    /* 🔴 P2-1 C — 여기 있던 비교는 `w * h` 였다. 높이를 «모르는» 후보는 곱이 0 이
       되어 «항상 진다** — 그래서 폭 1486 짜리(높이 미상)가 폭 656 짜리(높이 확인됨)에
       밀려 저해상도가 대표로 뽑혔다. 높이를 모른다는 것은 해상도가 0 이라는 뜻이
       아니다. 폭을 먼저 보고, 폭이 같을 때만 높이로 가른다 — 리사이저는 폭을 바꾸므로
       이 순서가 실제 변형 축과 맞는다. 종횡비가 같은 기존 변형들(PrestaShop·
       Smallable)에서는 폭 순서와 면적 순서가 일치하므로 결과가 바뀌지 않는다.
       🔴 높이를 «지어내지» 않는다 — 비교 방식만 고친다. */
    const best = group.reduce((a, b) => {
      const aw = a.width ?? 0;
      const bw = b.width ?? 0;
      if (bw !== aw) return bw > aw ? b : a;
      return (b.height ?? 0) > (a.height ?? 0) ? b : a;
    });
    const allSources = new Set<StrategySource>();
    for (const item of group) for (const source of item.sources) allSources.add(source);
    collapsed.push({ ...best, sources: allSources });
  }
  return collapsed;
}

/** 파일명 토큰이 이 개수 이하일 때만 로고 키워드를 로고 근거로 인정한다.
 * 사이트 로고 파일명은 "logo", "site-logo", "logo-header"처럼 짧다. 반면 상품
 * 이미지 파일명은 상품 슬러그라서 토큰이 훨씬 많다. */
const LOGO_FILENAME_MAX_TOKENS = 3;

function pathTokens(value: string): string[] {
  return value.split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * MI-DOMESTIC-FIX-1 §2(CPO 지시, 2026-09-09) — 사이트 로고를 거르되 상품명에
 * 들어있는 일반 단어를 로고 근거로 쓰지 않는다.
 *
 * 이전에는 LOGO_KEYWORDS를 URL/alt/context에 대해 단순 부분문자열로 검사했다.
 * 그래서 "Halloween Logo Sweatshirt"처럼 상품명에 logo가 들어간 상품은 URL
 * 슬러그와 alt 양쪽에서 매치돼 **모든 이미지가 사이트 로고로 오인되어 폐기**됐다
 * (실측: childrensalon.com 633403). "Iconic"이 "icon"에 걸리는 것도 같은 원인이다.
 *
 * 판정을 두 가지로 좁힌다.
 *  ① 디렉터리 이름이 통째로 로고류인 경우(/icons/..., /assets/logos/...)
 *  ② 파일명이 짧고(토큰 3개 이하) 그 토큰 중 하나가 정확히 로고 키워드인 경우
 * 둘 다 "경로가 UI 자산임을 말해주는 구조"지, 상품명에 그 단어가 있느냐가 아니다.
 * 토큰 완전일치로 바꿨기 때문에 "iconic"은 "icon"에 더 이상 걸리지 않는다.
 *
 * alt/context는 아예 보지 않는다 — 거기 들어오는 건 상품명이라서, 로고 판정
 * 근거로 쓰면 같은 오탐이 되풀이된다. 반면 추천/관련상품 영역 키워드
 * (EXCLUDE_KEYWORDS)는 원래 "이 이미지가 어느 영역에 있는지"를 말하는 신호라
 * context 검사를 그대로 유지한다.
 */
function isSiteChromeImage(rawUrl: string): boolean {
  // 상대경로/프로토콜 상대 URL도 들어올 수 있다 — 파싱에 실패하면 원문을
  // 그대로 경로처럼 다룬다(쿼리스트링은 아래 토큰화에서 자연히 떨어진다).
  let pathname: string;
  try {
    pathname = new URL(toParsableUrl(rawUrl)).pathname;
  } catch {
    pathname = rawUrl.split("?")[0];
  }
  const segments = pathname.toLowerCase().split("/").filter(Boolean);
  if (segments.length === 0) return false;

  const fileSegment = segments[segments.length - 1];
  for (const segment of segments.slice(0, -1)) {
    if (LOGO_KEYWORDS.some((keyword) => segment === keyword || segment === `${keyword}s`)) return true;
  }

  const nameTokens = pathTokens(fileSegment.replace(/\.[a-z0-9]+$/, ""));
  if (nameTokens.length === 0 || nameTokens.length > LOGO_FILENAME_MAX_TOKENS) return false;
  return nameTokens.some((token) => LOGO_KEYWORDS.includes(token));
}

function scoreOne(
  candidate: MergedCandidate,
  config: Pick<CrawlerConfig, "minWidth" | "minHeight">,
): { score: number; reason: string; included: boolean } {
  const lowerUrl = candidate.url.toLowerCase();
  const lowerAlt = (candidate.alt ?? "").toLowerCase();
  const context = candidate.context.toLowerCase();

  const isExcluded = EXCLUDE_KEYWORDS.some(
    (keyword) => lowerUrl.includes(keyword) || context.includes(keyword) || lowerAlt.includes(keyword),
  );
  if (isExcluded) {
    return { score: 0, included: false, reason: "추천상품 영역 키워드 매치" };
  }

  if (isSiteChromeImage(candidate.url)) {
    return { score: 0, included: false, reason: "사이트 로고/UI 이미지 경로" };
  }

  const isTracker = TRACKER_HOSTS.some((host) => lowerUrl.includes(host));
  if (isTracker) {
    return { score: 0, included: false, reason: "광고/분석 추적 픽셀" };
  }

  const belowHardFloor =
    (candidate.width !== undefined && candidate.width < config.minWidth) ||
    (candidate.height !== undefined && candidate.height < config.minHeight);
  if (belowHardFloor) {
    return {
      score: 0,
      included: false,
      reason: `최소 해상도(${config.minWidth}x${config.minHeight}) 미달 (${candidate.width}x${candidate.height})`,
    };
  }

  const bestSourceScore = Math.max(...Array.from(candidate.sources, (s) => SOURCE_BASE_SCORE[s]));
  let score = bestSourceScore;
  const reasons = [`기본 ${bestSourceScore}점(${Array.from(candidate.sources).join("+")})`];

  const isGalleryContext = GALLERY_CONTEXT_KEYWORDS.some((keyword) => context.includes(keyword));
  if (isGalleryContext || candidate.siblingCount >= 3) {
    score += 15;
    reasons.push("갤러리 컨텍스트 +15");
  }

  if (candidate.sources.size >= 2) {
    score += 15;
    reasons.push("다중 소스 일치 +15");
  }

  const belowPreferred =
    candidate.width !== undefined &&
    candidate.height !== undefined &&
    (candidate.width < PREFERRED_RESOLUTION || candidate.height < PREFERRED_RESOLUTION);
  if (belowPreferred) {
    score -= RESOLUTION_PENALTY;
    reasons.push(`${PREFERRED_RESOLUTION}px 미만 -${RESOLUTION_PENALTY}`);
  }

  return { score, included: score >= MIN_SCORE, reason: reasons.join(", ") };
}

export function scoreAndFilter(
  candidates: ImageCandidate[],
  config: Pick<CrawlerConfig, "minWidth" | "minHeight">,
): ScoreAndFilterResult {
  const merged = collapseByCdnId(Array.from(mergeByNormalizedUrl(candidates).values()));

  const trace: ExtractionTrace[] = [];
  const scored: (MergedCandidate & { score: number })[] = [];

  for (const candidate of merged) {
    const { score, included, reason } = scoreOne(candidate, config);
    trace.push({
      url: candidate.url,
      sources: Array.from(candidate.sources),
      score,
      included,
      reason,
    });
    if (included) scored.push({ ...candidate, score });
  }

  scored.sort((a, b) => b.score - a.score);
  scored.length = Math.min(scored.length, MAX_FINAL_IMAGES);

  const images: ExtractedImage[] = scored.map((candidate) => ({
    url: candidate.url,
    alt: candidate.alt,
    width: candidate.width,
    height: candidate.height,
  }));

  return { images, trace };
}
