import type { ExtractionContext, ExtractionStrategy, ImageCandidate } from "./types";

interface RawImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  context: string;
  anchorHref: string | null;
  siblingCount: number;
}

const LAZY_ATTRS = [
  "data-src",
  "data-lazy",
  "data-original",
  "data-zoom",
  "data-image",
  "data-large",
  "data-full",
];

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

/** 이미지가 '다른 상품 페이지'로 연결된 링크(<a>) 안에 있으면 추천/관련 상품 썸네일로 간주해 제외한다.
 * 갤러리 이미지는 보통 원본 이미지 파일로 링크되거나(라이트박스) 링크가 없다. */
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

/**
 * 항상 실행되는 안전망 Strategy — 실제 렌더링된 DOM을 스캔한다. 구조화 데이터가 없거나
 * 대표 이미지 1장만 주는 사이트에서도 전체 상품 갤러리(여러 장)를 찾아내는 유일한 경로다.
 *
 * 기존 로직(img 스캔 + 링크-다른페이지 제외) 위에 세 가지를 추가한다:
 * 1. srcset/<picture><source srcset>에서 w descriptor가 가장 큰 후보로 업그레이드
 *    (currentSrc는 브라우저 뷰포트가 "선택"한 크기라 항상 최대 해상도가 아니다).
 * 2. data-src류 lazy-load 속성 — currentSrc가 blur/placeholder(1x1, base64 등)로
 *    보이는데 lazy 속성에 실제 URL이 있으면 그쪽을 우선한다.
 * 3. 라이트박스 갤러리 패턴(PrestaShop 기본 테마 등) — 썸네일 <img src="...small...">를
 *    감싼 <a href="...large/original....jpg">가 있으면 그 href가 진짜 원본 크기다.
 *    지금까지는 이 href를 "다른 페이지로 링크됐는지" 판별에만 쓰고 실제 후보로는
 *    한 번도 채택하지 않아서, 이 패턴을 쓰는 사이트에서 썸네일(대개 100px 안팎이라
 *    최소 해상도 미달로 걸러짐)만 남고 진짜 큰 사진은 통째로 누락되고 있었다.
 */
export const domScanStrategy: ExtractionStrategy = {
  name: "dom-scan",
  canHandle() {
    return true;
  },
  async extract(ctx: ExtractionContext): Promise<ImageCandidate[]> {
    const rawImages: RawImage[] = await ctx.page.evaluate((lazyAttrs) => {
      function bestFromSrcset(srcset: string | null): string | null {
        if (!srcset) return null;
        const candidates = srcset
          .split(",")
          .map((part) => part.trim().split(/\s+/))
          .filter((parts) => parts[0])
          .map(([url, descriptor]) => ({
            url,
            width: descriptor && descriptor.endsWith("w") ? parseInt(descriptor, 10) : 0,
          }));
        if (candidates.length === 0) return null;
        return candidates.reduce((a, b) => (b.width > a.width ? b : a)).url;
      }

      function looksLikePlaceholder(src: string): boolean {
        return (
          src.startsWith("data:") ||
          /\b1x1\b|blank\.(gif|png)|placeholder/i.test(src)
        );
      }

      const out: {
        url: string;
        alt: string;
        width: number;
        height: number;
        context: string;
        anchorHref: string | null;
        siblingCount: number;
      }[] = [];

      const imageExtensionRe = /\.(jpe?g|png|webp|gif)$/i;

      for (const img of Array.from(document.querySelectorAll("img"))) {
        let src = img.currentSrc || img.src;

        const picture = img.closest("picture");
        const sourceSrcset = picture?.querySelector("source[srcset]")?.getAttribute("srcset");
        const bestPicture = bestFromSrcset(sourceSrcset ?? null);
        const bestOwnSrcset = bestFromSrcset(img.getAttribute("srcset"));
        const upgraded = bestPicture ?? bestOwnSrcset;
        if (upgraded) src = upgraded;

        if (!src || looksLikePlaceholder(src)) {
          for (const attr of lazyAttrs) {
            const value = img.getAttribute(attr);
            if (value) {
              src = value;
              break;
            }
          }
        }

        const anchor = img.closest("a");
        // 라이트박스 갤러리: <a href="...큰사진.jpg"><img src="...작은썸네일.jpg"></a>.
        // 앵커가 같은 출처의 실제 이미지 파일을 가리키면 썸네일보다 신뢰도 높은
        // "진짜 원본" 후보이므로 우선한다. 이때 img의 naturalWidth/Height는 화면에
        // 실제로 로드된 "썸네일" 크기이지 앵커가 가리키는 원본 크기가 아니다 — 0으로
        // 비우면 "해상도 모름"으로는 통과하지만, 같은 CDN ID를 가진 다른 후보와
        // "누가 더 큰가" 비교할 때(collapseByCdnId) 무조건 지게 된다(실제로는 라이트박스
        // 원본이 제일 큰 게 거의 확실한데도). 그래서 "모름"이 아니라 "확실히 크다"는
        // 뜻으로 큰 sentinel 값을 준다.
        let linkedToFullSize = false;
        if (anchor?.href) {
          try {
            const anchorUrl = new URL(anchor.href, location.href);
            if (
              anchorUrl.origin === location.origin &&
              imageExtensionRe.test(anchorUrl.pathname)
            ) {
              src = anchor.href;
              linkedToFullSize = true;
            }
          } catch {
            // 무시 — anchor.href 파싱 실패 시 기존 src를 그대로 쓴다.
          }
        }

        if (!src || looksLikePlaceholder(src)) continue;

        let context = "";
        let el: Element | null = img;
        for (let i = 0; i < 5 && el; i++) {
          context += ` ${el.className ?? ""} ${el.id ?? ""}`.toLowerCase();
          el = el.parentElement;
        }

        const siblingCount = img.parentElement
          ? img.parentElement.querySelectorAll("img").length
          : 1;

        out.push({
          url: src,
          alt: img.alt ?? "",
          width: linkedToFullSize ? 4000 : img.naturalWidth || img.width,
          height: linkedToFullSize ? 4000 : img.naturalHeight || img.height,
          context,
          anchorHref: anchor ? anchor.href : null,
          siblingCount,
        });
      }

      // 일부 사이트(특히 갤러리를 object-fit: cover로 채우는 커스텀 슬라이더)는
      // <img> 대신 배경색 스타일로 상품 사진을 넣는다. computed style을 봐야
      // 인라인 style이 아니어도(CSS 클래스로 지정돼도) 잡힌다.
      const BG_URL_RE = /url\(["']?(https?:\/\/[^"')]+|\/\/[^"')]+)["']?\)/i;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        const bg = getComputedStyle(el).backgroundImage;
        const match = BG_URL_RE.exec(bg);
        if (!match) continue;

        // 화면에 실제로 안 보이는(0x0) 요소는 아이콘/트리거 같은 장식 요소일 뿐
        // 진짜 상품 사진이 아니다 — width=0을 "해상도 모름"으로 착각해 필터를
        // 건너뛰지 않도록 여기서 걸러낸다.
        const preRect = el.getBoundingClientRect();
        if (preRect.width < 10 || preRect.height < 10) continue;

        let context = "";
        let node: Element | null = el;
        for (let i = 0; i < 5 && node; i++) {
          context += ` ${node.className ?? ""} ${node.id ?? ""}`.toLowerCase();
          node = node.parentElement;
        }

        out.push({
          url: match[1],
          alt: "",
          width: Math.round(preRect.width),
          height: Math.round(preRect.height),
          context,
          anchorHref: null,
          siblingCount: 0,
        });
      }

      return out;
    }, LAZY_ATTRS);

    return rawImages
      .filter((image) => {
        const lowerUrl = image.url.toLowerCase();
        if (lowerUrl.endsWith(".svg")) return false;
        if (linksToDifferentPage(image.anchorHref, ctx.url)) return false;
        return true;
      })
      .map((image) => ({
        url: image.url,
        alt: image.alt,
        width: image.width || undefined,
        height: image.height || undefined,
        context: image.context,
        siblingCount: image.siblingCount,
        source: "dom-scan" as const,
      }));
  },
};
