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

function mergeByNormalizedUrl(candidates: ImageCandidate[]): Map<string, MergedCandidate> {
  const merged = new Map<string, MergedCandidate>();

  for (const candidate of candidates) {
    const url = toParsableUrl(candidate.url);
    const key = normalizeUrl(url);
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
    const best = group.reduce((a, b) =>
      (b.width ?? 0) * (b.height ?? 0) > (a.width ?? 0) * (a.height ?? 0) ? b : a,
    );
    const allSources = new Set<StrategySource>();
    for (const item of group) for (const source of item.sources) allSources.add(source);
    collapsed.push({ ...best, sources: allSources });
  }
  return collapsed;
}

function scoreOne(
  candidate: MergedCandidate,
  config: Pick<CrawlerConfig, "minWidth" | "minHeight">,
): { score: number; reason: string; included: boolean } {
  const lowerUrl = candidate.url.toLowerCase();
  const lowerAlt = (candidate.alt ?? "").toLowerCase();
  const context = candidate.context.toLowerCase();

  const isExcluded = [...EXCLUDE_KEYWORDS, ...LOGO_KEYWORDS].some(
    (keyword) => lowerUrl.includes(keyword) || context.includes(keyword) || lowerAlt.includes(keyword),
  );
  if (isExcluded) {
    return { score: 0, included: false, reason: "추천상품/로고 키워드 매치" };
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
