import type { Page } from "playwright-core";
import type { ExtractedImage } from "@commerce/shared";
import { launchChromium } from "./browser-launcher";
import { loadCrawlerConfig, type CrawlerConfig } from "./config";

interface RawImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  context: string;
  anchorHref: string | null;
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

export async function extractProductImages(url: string): Promise<ExtractedImage[]> {
  const config = loadCrawlerConfig();
  const browser = await launchChromium();

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: config.navigationTimeoutMs });
    await autoScroll(page);

    const rawImages: RawImage[] = await page.evaluate(() => {
      const out: RawImage[] = [];
      for (const img of Array.from(document.querySelectorAll("img"))) {
        const src = img.currentSrc || img.src;
        if (!src) continue;

        let context = "";
        let el: Element | null = img;
        for (let i = 0; i < 5 && el; i++) {
          context += ` ${el.className ?? ""} ${el.id ?? ""}`.toLowerCase();
          el = el.parentElement;
        }

        const anchor = img.closest("a");

        out.push({
          url: src,
          alt: img.alt ?? "",
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          context,
          anchorHref: anchor ? anchor.href : null,
        });
      }
      return out;
    });

    return filterAndDedupe(rawImages, url, config);
  } finally {
    await browser.close();
  }
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let scrolled = 0;
      const step = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        scrolled += step;
        if (scrolled >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
  await page.waitForTimeout(500);
}

function filterAndDedupe(
  raw: RawImage[],
  pageUrl: string,
  config: CrawlerConfig,
): ExtractedImage[] {
  const seen = new Set<string>();
  const out: ExtractedImage[] = [];

  for (const image of raw) {
    if (!isAllowed(image, pageUrl, config)) continue;
    const key = normalizeUrl(image.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: image.url, alt: image.alt, width: image.width, height: image.height });
  }
  return dedupeByCdnImageId(out);
}

/**
 * 많은 쇼핑몰(PrestaShop 계열 등)은 이미지 URL에 "/{숫자ID}-{사이즈명}/파일명" 형태로
 * 같은 사진의 여러 해상도 변형을 표시한다 (예: /24726-big_default/, /24726-home_default/).
 * 지각적 해시(perceptual hash)만으로는 같은 배경/구도의 서로 다른 실제 사진들을
 * 오탐지로 합쳐버릴 수 있어서(예: 같은 흰 배경 위 카키 바지의 다른 각도 사진들),
 * 신뢰도 높은 URL 패턴을 우선 사용해 같은 ID의 저해상도 중복만 제거한다.
 * ID 패턴이 없는 URL은 건드리지 않는다.
 */
function dedupeByCdnImageId(images: ExtractedImage[]): ExtractedImage[] {
  const groups = new Map<string, ExtractedImage[]>();
  const ungrouped: ExtractedImage[] = [];

  for (const image of images) {
    const id = extractCdnImageId(image.url);
    if (!id) {
      ungrouped.push(image);
      continue;
    }
    groups.set(id, [...(groups.get(id) ?? []), image]);
  }

  const deduped = [...ungrouped];
  for (const group of groups.values()) {
    const best = group.reduce((a, b) =>
      (b.width ?? 0) * (b.height ?? 0) > (a.width ?? 0) * (a.height ?? 0) ? b : a,
    );
    deduped.push(best);
  }
  return deduped;
}

function extractCdnImageId(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = /\/(\d{3,})-[a-z0-9_]+\//i.exec(pathname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function isAllowed(image: RawImage, pageUrl: string, config: CrawlerConfig): boolean {
  const lowerUrl = image.url.toLowerCase();
  const lowerAlt = image.alt.toLowerCase();

  if (lowerUrl.endsWith(".svg") || lowerUrl.endsWith(".gif")) return false;

  const isExcluded = config.excludeKeywords.some(
    (keyword) =>
      lowerUrl.includes(keyword) || image.context.includes(keyword) || lowerAlt.includes(keyword),
  );
  if (isExcluded) return false;

  if (image.width > 0 && image.width < config.minWidth) return false;
  if (image.height > 0 && image.height < config.minHeight) return false;

  if (linksToDifferentPage(image.anchorHref, pageUrl)) return false;

  return true;
}

/**
 * 이미지가 '다른 상품 페이지'로 연결된 링크(<a>) 안에 있으면 추천/관련 상품 썸네일로 간주해 제외한다.
 * 갤러리 이미지는 보통 원본 이미지 파일로 링크되거나(라이트박스) 링크가 없다.
 */
function linksToDifferentPage(anchorHref: string | null, pageUrl: string): boolean {
  if (!anchorHref) return false;

  let anchor: URL;
  let current: URL;
  try {
    anchor = new URL(anchorHref);
    current = new URL(pageUrl);
  } catch {
    return false;
  }

  if (anchor.origin !== current.origin) return false;
  if (IMAGE_EXTENSIONS.some((ext) => anchor.pathname.toLowerCase().endsWith(ext))) return false;

  return anchor.pathname !== current.pathname;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}
