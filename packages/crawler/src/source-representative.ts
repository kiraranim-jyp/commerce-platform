/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-1 — **원소스가 «명시한» 대표 이미지 한 장을 찾는다.** (CPO 확정 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 인정 조건은 「단일 선언」 하나다 ───────────────────────────────────
 * schema.org `Product` 의 `image` 가 **단일 값** 으로 선언됐을 때만 대표로 본다.
 *
 *     JSON-LD    Product.image = "https://…"            🟢 단일 string
 *     Microdata  Product 스코프 안의 itemprop="image"    🟢 정확히 1개
 *
 * 🔴 **「image[0] 이라서」가 아니다.** 후보가 하나뿐이라 «순서 모호성이 구조적으로
 * 존재할 수 없어서» 대표인 것이다. 그래서 다음은 모두 대표로 «확정하지 않는다»:
 *
 *     Product.image = [a, b, c]   배열 — 순서가 대표를 뜻한다는 보장이 스키마에 없다
 *     itemprop="image" 0개        선언이 없다
 *     itemprop="image" 2개 이상    어느 것인지 사이트가 가리지 않았다
 *     og:image                    실제 상품 fixture 11건 중 0건 — 검증 불가라 쓰지 않는다
 *
 * ── 실측 근거 ─────────────────────────────────────────────────────────────
 *     tennis-warehouse  itemtype="http://schema.org/Product" 안에
 *                       <img itemprop="image" class="main_image" …> 가 «1개»
 *                       그 페이지는 data-imageCount="5" 로 5장이라고 스스로 말한다
 *                       → 5장 중 1장을 사이트가 대표로 지정했다 = 실익이 있다
 *     smallable         JSON-LD Product.image = 단일 string (fixture 6/6 · 배열 0건)
 *
 * ── 🔴 microdata 스코프 판정의 한계를 숨기지 않는다 ───────────────────────
 * 정식 microdata 파싱에는 DOM 이 필요한데 이 함수는 **원문 HTML 문자열** 만 받는다
 * (추출 파이프라인이 그 시점에 가진 것이 그것이다). 그래서 이렇게 좁힌다:
 *
 *     ① `schema.org/Product` itemtype 선언이 **정확히 1개** 일 때만 본다
 *        (둘 이상이면 어느 Product 의 image 인지 가릴 수 없다 → 포기)
 *     ② 그 선언 **뒤쪽** 문자열에서만 `itemprop="image"` 를 센다
 *        — Product 가 가장 바깥 스코프이므로 그 뒤가 곧 스코프 안이다
 *     ③ 거기서 **정확히 1개** 일 때만 대표로 인정한다
 *
 * 🔴 ②는 «근사» 다. Product 선언 뒤에 Product 밖 영역이 오는 마크업이면 과다
 * 집계될 수 있는데, 그때는 ③이 2개 이상이 되어 **대표를 포기하는 쪽으로** 틀린다.
 * 안전한 방향으로 틀리게 만든 것이다 — 「모르면 고르지 않는다」.
 */

/** 🔴 `//cdn…` 같은 프로토콜 상대 URL 을 비교 가능한 형태로 맞춘다. */
function absolutize(url: string, pageUrl?: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (pageUrl) {
    try {
      return new URL(trimmed, pageUrl).toString();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

/** JSON-LD 노드를 평탄화한다 — 배열·`@graph` 를 모두 펼친다. */
function flattenNodes(value: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const item of value) flattenNodes(item, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  if (Array.isArray(node["@graph"])) {
    for (const child of node["@graph"]) flattenNodes(child, out);
  }
  out.push(node);
}

function isProductNode(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  return type === "Product" || (Array.isArray(type) && type.includes("Product"));
}

/**
 * JSON-LD 쪽. 🔴 Product 가 여럿이면 포기한다 — 어느 상품의 대표인지 가릴 수 없다.
 * 🔴 `image` 가 배열이거나 없으면 포기한다(§3 금지).
 */
function fromJsonLd(html: string, pageUrl?: string): string | null {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const products: Record<string, unknown>[] = [];
  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* 🔴 깨진 JSON-LD 는 «없는 것» 으로 둔다 — 추측해서 고치지 않는다. */
      continue;
    }
    const nodes: Record<string, unknown>[] = [];
    flattenNodes(parsed, nodes);
    for (const node of nodes) if (isProductNode(node)) products.push(node);
  }
  if (products.length !== 1) return null;

  const image = products[0]!["image"];
  /* 🔴 «단일 string» 만 인정한다. */
  if (typeof image === "string") {
    const url = absolutize(image, pageUrl);
    return url || null;
  }
  /* `{ "@type": "ImageObject", url: "…" }` 단일 객체도 «하나» 라는 뜻은 같다. */
  if (image && typeof image === "object" && !Array.isArray(image)) {
    const inner = (image as { url?: unknown }).url;
    if (typeof inner === "string") {
      const url = absolutize(inner, pageUrl);
      return url || null;
    }
  }
  return null;
}

/** `itemprop="image"` 를 가진 태그에서 URL 을 꺼낸다 — `content` 가 `src` 보다 명시적이다. */
function urlFromTag(tag: string): string | null {
  const content = /\bcontent=["']([^"']+)["']/i.exec(tag);
  if (content?.[1]) return content[1];
  const src = /\bsrc=["']([^"']+)["']/i.exec(tag);
  if (src?.[1]) return src[1];
  const href = /\bhref=["']([^"']+)["']/i.exec(tag);
  return href?.[1] ?? null;
}

/** Microdata 쪽. 위 §한계 주석의 ①②③ 규칙을 그대로 구현한다. */
function fromMicrodata(html: string, pageUrl?: string): string | null {
  const productDecls = [...html.matchAll(/itemtype=["'][^"']*schema\.org\/Product["']/gi)];
  if (productDecls.length !== 1) return null;

  const scope = html.slice(productDecls[0]!.index!);
  const imageTags = [...scope.matchAll(/<[a-z][^>]*\bitemprop=["']image["'][^>]*>/gi)];
  if (imageTags.length !== 1) return null;

  const raw = urlFromTag(imageTags[0]![0]);
  if (!raw) return null;
  const url = absolutize(raw, pageUrl);
  return url || null;
}

/**
 * 원소스가 명시한 대표 이미지 URL. 없으면 `null`.
 *
 * 🔴 JSON-LD 를 먼저 본다 — 사이트가 구조화 데이터로 «직접 명시» 한 것이고,
 * `scoring.ts` 의 출처 점수도 json-ld(90) > open-graph(60) 로 그렇게 보고 있다.
 * 🔴 둘 다 없으면 `null` 이고, 호출부는 **기존 선정 로직을 그대로 쓴다** —
 * 여기서 아무것도 「골라 주지」 않는다.
 */
export function findSourceRepresentativeImageUrl(html: string, pageUrl?: string): string | null {
  if (!html) return null;
  return fromJsonLd(html, pageUrl) ?? fromMicrodata(html, pageUrl);
}

/* ════════════════════════════════════════════════════════════════════════════
   대표 URL → 추출 목록의 «인덱스»
   ════════════════════════════════════════════════════════════════════════════

   🔴 왜 인덱스인가: `downloader.service.ts` 가 `ExtractedImage[]` 의 인덱스를
   파일명(`0000.jpg`…)으로 쓰고, 그 baseName 이 그대로 이미지 id 가 된다. 그래서
   「몇 번째」만 알면 최종 이미지와 짝이 맞는다 — 레이어마다 플래그를 들고
   다니는 구조를 만들 필요가 없다.

   🔴 URL 을 느슨하게 맞추는 이유: 전략이 찾은 원문 URL 과 점수/병합을 거친
   `images[].url` 이 쿼리스트링(`?utm_…`·리사이즈 파라미터)만 다를 수 있다.
   그래서 ①완전일치 → ②쿼리 제거 후 일치 → ③마지막 경로 조각 일치 순으로 본다.
   🔴 ③까지도 못 맞으면 **포기하고 `null`** 이다 — 비슷해 보이는 것을 고르지 않는다. */

const stripQuery = (url: string) => url.split(/[?#]/)[0] ?? url;
const lastSegment = (url: string) => {
  const path = stripQuery(url);
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
};

/**
 * 대표 URL 이 `images` 의 몇 번째인지. 못 찾으면 `-1`.
 *
 * 🔴 여러 장이 같은 조건으로 걸리면(③단계에서 흔히 생길 수 있다) **포기한다** —
 * 어느 것인지 가릴 수 없으면 대표를 고르지 않는 쪽이 정책이다.
 */
export function findSourceRepresentativeIndex(
  images: readonly { url: string }[],
  representativeUrl: string | null | undefined,
): number {
  const target = (representativeUrl ?? "").trim();
  if (!target || images.length === 0) return -1;

  const exact = images.findIndex((image) => image.url === target);
  if (exact >= 0) return exact;

  const byPath = images
    .map((image, index) => ({ index, hit: stripQuery(image.url) === stripQuery(target) }))
    .filter((x) => x.hit);
  if (byPath.length === 1) return byPath[0]!.index;

  const segment = lastSegment(target);
  if (!segment) return -1;
  const bySegment = images
    .map((image, index) => ({ index, hit: lastSegment(image.url) === segment }))
    .filter((x) => x.hit);
  return bySegment.length === 1 ? bySegment[0]!.index : -1;
}

/** 인덱스를 다운로드 파일명 baseName(= 이미지 id)으로 바꾼다. `downloader.service.ts` 와 같은 규칙. */
export function representativeIdForIndex(index: number): string | null {
  return index < 0 ? null : String(index).padStart(4, "0");
}
