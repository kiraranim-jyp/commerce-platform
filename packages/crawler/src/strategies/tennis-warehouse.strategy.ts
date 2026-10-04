import type { ExtractionContext, ExtractionStrategy, ImageCandidate } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-1 C — tennis-warehouse 갤러리 (CPO 지시, 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 사고: 실제 상품 페이지에 상품 이미지가 **5장** 있는데 수집은 **1장** 이었다.
 * 단계별로 세어 보니 ①collector 에서 이미 1장이었다 — 그 아래(canonical · 화면 ·
 * detailBlocks · payload)는 전부 그 1장을 받고 있었을 뿐이다. UI 결함이 아니다.
 *
 * 원인: 이 사이트는 전용 전략이 없어 범용 추출기(JSON-LD · OpenGraph · DOM scan)로
 * 떨어지고, 거기서는 대표 1장만 잡힌다. 갤러리는 전용 마크업에 있다:
 *
 *   <span class="prod_view-multiview-image"
 *         data-imgsrc=".../watermark/rs.php?path=STMFTP-BL-2.jpg&nw=43">
 *
 * ── 🔴 왜 SiteStrategy(fast path)가 아니라 ExtractionStrategy 인가 ───────────
 * `universal-extractor.ts:110-114` 의 `tryFastPath()` 는 **파이프라인 전체를
 * 단축한다.** SiteStrategy 가 이미지를 돌려주면 범용 전략이 아예 돌지 않으므로,
 * 이미지만 돌려주면 제목·브랜드·가격·소재·옵션을 «전부 잃는다». 그건 이미지 4장을
 * 얻으려고 상품 정보를 버리는 거래다.
 *
 * `ExtractionStrategy` 는 **이미지만 기여하고** productData 는 건드리지 않는다.
 * 여러 전략의 후보가 병합되고 `scoreAndFilter` 가 중복을 지운다 — 그래서 대표
 * 이미지가 두 전략에서 같이 나와도 한 장으로 합쳐진다. 이 자리가 맞는 자리다.
 *
 * ── 🔴 추측하지 않는다 (CPO 조건) ───────────────────────────────────────────
 * 금지된 것과 한 것을 갈라 적는다:
 *
 *   ❌ 파일명 번호 증가(`-2.jpg`, `-3.jpg` …)로 URL 을 «만들지» 않는다.
 *      → 경로는 전부 `data-imgsrc` 에서 «읽는다».
 *   ❌ `nw`(리사이저 폭)를 상수로 박지 않는다.
 *      → **그 페이지가 스스로 쓰는 최대 폭** 을 읽어서 쓴다. 실측(Trattino)에서
 *        대표 이미지는 16가지 폭(43 … 1486)으로 등장하고 갤러리 썸네일은 43 뿐이다.
 *   ❌ 워터마크를 우회하지 않는다. `watermark/rs.php` 경로를 그대로 둔다.
 *   ❌ 접근 제한을 우회하지 않는다. robots 의 `User-agent: *` 는 경로 제한만이고
 *      (`/zzz/` · `/mailings/` · `/search-*.html` · `/SearchResults/`) 상품 페이지는
 *      허용이다 — 실측 확인.
 *
 * 🔴 그리고 그 조합을 «실제로 받아서» 확인했다(추정으로 끝내지 않았다):
 *      path=STMFTP-BL-1..5.jpg & nw=1486  →  HTTP 200 · image/jpeg · 1486×1981
 *      바이트 수가 전부 다르다(225,965 / 263,478 / 115,471 / 797,504 / 625,900)
 *      — 같은 그림이 반복된 것이 아니라 «서로 다른» 5장이다.
 *
 * 🔴 `?img=N` 링크를 따라가는 길은 **막혀 있다** — 그 페이지들의 서버 HTML 이
 * 동일하다(197,826 bytes, 메인은 여전히 `-1.jpg`). 전환이 클라이언트 JS 다.
 * 그래서 「각 이미지의 전체 크기 URL 을 그 이미지의 페이지에서 읽는다」는 더 보수적인
 * 방법을 쓸 수 없었다. 이 사실을 적어 둔다 — 다음 사람이 다시 시도하지 않도록.
 */

const HOSTS = ["tennis-warehouse.com", "www.tennis-warehouse.com"];

/** 리사이저 URL — `path`(파일)와 `nw`(폭)로 이뤄진다. 둘 다 페이지에서 읽는다. */
const RESIZER_RE = /rs\.php\?path=([^"'&\s]+)&(?:amp;)?nw=(\d+)/gi;

/** 갤러리 썸네일 — 이 class 안의 `data-imgsrc` 가 상품 이미지 목록이다. */
const GALLERY_RE = /class="[^"]*prod_view-multiview-image[^"]*"[^>]*data-imgsrc="([^"]+)"/gi;

export function isTennisWarehouseUrl(url: string): boolean {
  try {
    return HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** 이 페이지가 스스로 쓰는 **최대 리사이저 폭**. 상수로 박지 않는 이유가 이것이다. */
export function readMaxResizerWidth(html: string): number | null {
  let max: number | null = null;
  for (const m of html.matchAll(RESIZER_RE)) {
    const w = Number.parseInt(m[2], 10);
    if (Number.isFinite(w) && (max === null || w > max)) max = w;
  }
  return max;
}

/**
 * 갤러리 이미지 경로를 **문서 순서대로** 읽는다(순서가 의미다 — 1번이 대표다).
 * 🔴 중복은 지우되 순서는 유지한다.
 */
export function readGalleryPaths(html: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(GALLERY_RE)) {
    const src = m[1].replace(/&amp;/g, "&");
    const path = /[?&]path=([^&"']+)/.exec(src)?.[1];
    if (!path || seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  return paths;
}

/**
 * 갤러리 경로 × 그 페이지의 최대 폭 → 전체 크기 후보.
 *
 * 🔴 폭을 못 읽으면 **아무것도 돌려주지 않는다.** 43px 썸네일을 상품 이미지로
 * 올리는 것은 1장만 수집하는 것보다 나쁘다(채널 이미지 규격에 걸리고, 셀러는
 * 「5장 들어왔다」고 믿는다).
 */
export function buildTennisWarehouseGallery(html: string, pageUrl: string): ImageCandidate[] {
  const paths = readGalleryPaths(html);
  if (paths.length === 0) return [];
  const width = readMaxResizerWidth(html);
  if (width === null) return [];

  /* 리사이저 엔드포인트도 «읽는다» — img.tennis-warehouse.com/watermark/rs.php 를
     상수로 박지 않는다. 워터마크 경로가 여기 포함돼 있고, 그대로 유지된다. */
  const endpoint = /(https?:\/\/[^"'\s]+?rs\.php)\?path=/i.exec(html.replace(/&amp;/g, "&"))?.[1] ?? null;
  if (!endpoint) return [];

  return paths.map((path, index) => ({
    url: `${endpoint}?path=${path}&nw=${width}`,
    /* 점수화가 갤러리로 인정하도록 실제 class 이름을 그대로 넘긴다
       (추천/관련 상품 제외 키워드와 겹치지 않는다 — scoring.ts 확인). */
    context: "prod_view-multiview prod_view-multiview-image gallery",
    /* 요청한 폭이 곧 결과 폭이다(실측 1486 요청 → 1486 반환). 해상도 감점에
       걸리지 않도록 «읽은» 값을 그대로 적는다 — 높이는 모르므로 적지 않는다. */
    width,
    siblingCount: paths.length,
    source: "tennis-warehouse" as const,
    alt: `product image ${index + 1}`,
  }));
}

export const tennisWarehouseStrategy: ExtractionStrategy = {
  name: "tennis-warehouse",

  canHandle(ctx: ExtractionContext) {
    /* 🔴 호스트«와» 갤러리 마커를 «둘 다» 본다. 마커가 없는 페이지(목록·검색 등)에서
       조용히 0장을 돌려주는 것과, 애초에 돌지 않는 것은 다르다. */
    return isTennisWarehouseUrl(ctx.url) && ctx.html.includes("prod_view-multiview-image");
  },

  async extract(ctx: ExtractionContext) {
    return buildTennisWarehouseGallery(ctx.html, ctx.url);
  },
};
