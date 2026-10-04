import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ComparisonCandidate } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 스카이스포츠(skysport.co.kr) — **테니스 의류 AUTO_SCRAPE 1호** (CPO 확정 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 국내 테니스 전문점. TENNIS 시장조사의 «첫» 자동 가격수집원이다 — 그전까지
 * 테니스 국내 소스는 다나와·카카오 쇼핑하우 둘뿐이었고 둘 다 MANUAL 이라
 * 「조사 대상 2곳」이라고 표시하면서 자동 결과가 0건이었다.
 *
 * ── 🔴 채택 근거 (실측 2026-10-04) ────────────────────────────────────────
 * 후보 11곳을 같은 기준으로 재서 2곳이 통과했고 그중 상세 9항목까지 확인한
 * 쪽이다. 기준은 **「우리가 실제로 쓰는 UA 가 robots 에서 허용되는가」** 다:
 *
 *     robots.txt   User-agent: * 가 /admin · /api · /exec/front/ · /member/ ·
 *                  /myshop/ · /protected/ · /skin- 계열 · 게시판 경로만 Disallow.
 *                  🔴 상품/검색 경로는 «허용» — Cafe24 표준이고 looxloo·rulii 와
 *                  같은 모양이다. (무신사·SSF SHOP 은 `*` 가 Disallow: / 라서
 *                  STOP 했다 — 명시 허용 목록에 우리가 없다.)
 *     약관         제22조 저작권 귀속(표준 전자상거래 약관)만 있고 **자동수집·
 *                  크롤링·스크래핑을 명시적으로 금지하는 조항이 없다.**
 *                  🔴 표준 약관 하나로 STOP 하지 않는다 — 그 기준이면 기존
 *                  어댑터 여덟이 전부 STOP 대상이 된다(price-source-adapter.ts 주석).
 *     응답         검색 83건·4페이지, HTTP 200, 가격이 서버 HTML 에 있다.
 *                  (29CM 는 robots 를 통과했지만 SPA 라 서버 HTML 에 가격이
 *                  0이어서 부적합이었다 — 그 차이가 여기서 갈린다.)
 *
 * ── 🔴 왜 rulii 를 복사하지 «않았는가» ────────────────────────────────────
 * 같은 Cafe24 지만 스킨이 다르다. rulii 가 쓰는 `rel="판매가"` · `rel="브랜드"` ·
 * `id="span_product_price_sale"` 가 이 사이트에는 **0건** 이다(실측). 대신 더
 * 안정적인 것이 있다:
 *
 *     <li id="anchorBoxId_5172" data-price="69,000^58,000" class="item DB_rate xans-record-">
 *
 * 🔴 `data-price` 가 **「소비자가^판매가」** 를 속성에 그대로 담는다. 텍스트
 * 노드를 긁는 것보다 스킨 변경에 강하다 — 그래서 이것을 1순위로 읽고,
 * 없을 때만 내부 텍스트로 내려간다.
 *
 * 상품명은 `id="eListPrdImage{no}_"` 의 `alt` 에 있다(실측). 목록의 <p class="name">
 * 은 스킨마다 위치가 달라 쓰지 않는다.
 *
 * ── 어댑터가 하는 일과 하지 않는 일 ──────────────────────────────────────
 *   한다:    검색 → 후보 목록(상품명·가격·소비자가·이미지·URL·상품번호)
 *   안 한다: Playwright·브라우저를 쓰지 않는다(이 사이트는 서버 렌더링이라
 *            필요가 없다). 새 범용 크롤러를 만들지 않는다 — 기존 어댑터 계약
 *            (ComparisonCandidate[] 반환, 실패는 throw)을 그대로 따른다.
 *   안 한다: 🔴 값을 «지어내지» 않는다. 가격을 못 읽으면 `price: null` 이고,
 *            그 후보를 버리지도 않는다 — 「이 판매처에 이 상품이 있다」는 사실은
 *            가격과 별개이고, 호출부가 그 구분을 이미 다룬다.
 */
const DOMAIN = "skysport.co.kr";
const FETCH_TIMEOUT_MS = 10000;
/* 🔴 기존 어댑터 열 곳이 쓰는 그 UA 다. robots 의 `User-agent: *` 가 상품/검색
   경로를 허용하므로 이 요청은 robots 를 위반하지 않는다(위 주석 참고). */
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** 상품 한 칸의 시작. 🔴 `class` 가 `item DB_rate xans-record-` 처럼 중간에
 * 다른 토큰이 끼므로 class 를 패턴에 넣지 않는다 — id 만으로 가른다. */
const ITEM_SPLIT_RE = /<li id="anchorBoxId_(\d+)"/;
/** 🔴 「소비자가^판매가」. 둘 중 하나만 있는 상품도 있어 split 결과를 그대로 센다. */
const DATA_PRICE_RE = /data-price="([^"]*)"/;
const IMG_RE = /<img src="([^"]+)" id="eListPrdImage\d+_"[^>]*alt="([^"]*)"/;
const HREF_RE = /href="(\/product\/detail\.html\?product_no=\d+[^"]*)"/;

/** 상세 페이지(사이즈·색상 확인용). */
const DETAIL_SALE_RE = /id="span_product_price_sale"[^>]*>\s*([0-9,]+)/;
const DETAIL_REGULAR_RE = /id="span_product_price_text"[^>]*>\s*([0-9,]+)/;

export interface SkysportDetail {
  salePrice: number | null;
  regularPrice: number | null;
  /** 옵션 <select> 에서 읽은 값. 못 읽으면 빈 배열이고 «지어내지 않는다». */
  options: string[];
}

/** "69,000" → 69000. 🔴 숫자로 못 바꾸면 null 이다 — 0 으로 떨구지 않는다. */
export function parseSkysportPrice(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * `data-price="69,000^58,000"` 를 가른다.
 *
 * 🔴 Cafe24 는 「소비자가^판매가」 순서로 넣는다(실측: 69,000^58,000 이고 화면
 * 표시는 판매가 58,000 · 소비자가 69,000). 값이 하나뿐이면 그것을 판매가로 본다 —
 * 할인이 없는 상품이고, 그때 소비자가를 «같은 값으로 복제하지 않는다»(할인이
 * 있는 것처럼 보이게 된다).
 */
export function parseSkysportDataPrice(raw: string | undefined | null): {
  salePrice: number | null;
  regularPrice: number | null;
} {
  const parts = (raw ?? "").split("^").map((p) => parseSkysportPrice(p));
  if (parts.length >= 2) {
    const [regular, sale] = parts;
    /* 🔴 소비자가가 판매가보다 «크지 않으면» 할인이 아니다 — null 로 둔다
       (rulii 가 N-4.18-Q2 에서 내린 것과 같은 판단). */
    const isDiscounted = regular != null && sale != null && regular > sale;
    return { salePrice: sale ?? regular ?? null, regularPrice: isDiscounted ? regular : null };
  }
  return { salePrice: parts[0] ?? null, regularPrice: null };
}

/** 상세 페이지에서 가격과 옵션을 읽는다. 🔴 실패는 throw 하지 않고 빈 값이다 —
 * 상세 조회는 «보강» 이고, 목록에서 이미 가격을 얻었기 때문이다. */
export async function fetchSkysportDetail(url: string): Promise<SkysportDetail> {
  const empty: SkysportDetail = { salePrice: null, regularPrice: null, options: [] };
  try {
    const response = await fetchWithDomainRateLimit(url, {
      headers: { Accept: "text/html", "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return empty;
    const html = await response.text();
    return {
      salePrice: parseSkysportPrice(DETAIL_SALE_RE.exec(html)?.[1]),
      regularPrice: parseSkysportPrice(DETAIL_REGULAR_RE.exec(html)?.[1]),
      options: extractSkysportOptions(html),
    };
  } catch {
    return empty;
  }
}

/**
 * 옵션 <select> 의 값들. 🔴 「품절」 같은 상태 문구와 안내 문구(「- 선택 -」)는
 * 옵션이 아니므로 뺀다. 못 찾으면 빈 배열이고, 그것은 「옵션이 없다」가 아니라
 * 「못 읽었다」다 — 호출부가 값을 지어내지 않게 빈 배열을 그대로 돌려준다.
 */
export function extractSkysportOptions(html: string): string[] {
  const select = /<select[^>]*(?:id|name)="[^"]*option[^"]*"[^>]*>([\s\S]*?)<\/select>/i.exec(html);
  if (!select) return [];
  const out: string[] = [];
  for (const m of select[1].matchAll(/<option[^>]*>([^<]*)<\/option>/g)) {
    const text = m[1].replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (/^-+\s*선택|선택하세요|^\*/.test(text)) continue;
    out.push(text);
  }
  return out;
}

/**
 * 검색 → 후보 목록.
 *
 * 🔴 경로는 Cafe24 표준 `/product/search.html?keyword=` 이고 **실측으로 확인**했다
 * (83건·4페이지·HTTP 200). 추측한 패턴이 아니다.
 */
export async function searchSkysport(query: string): Promise<ComparisonCandidate[]> {
  const url = `https://${DOMAIN}/product/search.html?keyword=${encodeURIComponent(query)}`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "text/html", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`SKYSPORT search ${response.status}`);

  const html = await response.text();
  return parseSkysportSearchHtml(html);
}

/** 🔴 파싱을 «순수 함수» 로 꺼냈다 — 테스트가 네트워크 없이 실제 HTML 모양으로
 * 잴 수 있게 한다(기존 어댑터들이 검색 함수 안에 파싱을 묻어 두어 테스트가
 * 구조를 직접 재지 못했다). */
export function parseSkysportSearchHtml(html: string): ComparisonCandidate[] {
  const candidates: ComparisonCandidate[] = [];
  /* id 로 자른다 — 앞 조각은 목록 바깥이므로 버린다. */
  const chunks = html.split(/<li id="anchorBoxId_/).slice(1);

  for (const chunk of chunks) {
    if (candidates.length >= 5) break;
    const block = `<li id="anchorBoxId_${chunk.slice(0, 6000)}`;
    const productNo = ITEM_SPLIT_RE.exec(block)?.[1];
    if (!productNo) continue;

    const img = IMG_RE.exec(block);
    /* 🔴 상품명이 없으면 후보로 쓰지 않는다 — 이름 없는 가격은 매칭에 쓸 수 없다. */
    const title = img?.[2]?.replace(/\s+/g, " ").trim();
    if (!title) continue;

    const { salePrice, regularPrice } = parseSkysportDataPrice(DATA_PRICE_RE.exec(block)?.[1]);
    const href = HREF_RE.exec(block)?.[1];
    const rawImg = img?.[1];

    candidates.push({
      title,
      url: href ? `https://${DOMAIN}${href}` : `https://${DOMAIN}/product/detail.html?product_no=${productNo}`,
      price: salePrice != null ? { amount: salePrice, currency: "KRW" } : null,
      regularPrice: regularPrice != null ? { amount: regularPrice, currency: "KRW" } : null,
      imageUrl: rawImg ? (rawImg.startsWith("//") ? `https:${rawImg}` : rawImg) : null,
      sku: productNo,
      /* 🔴 `confidence` 는 필수다. 검색 단계에서는 «매칭을 판정하지 않는다» —
         0 을 넣고 점수는 기존 매칭 단계가 매긴다(어댑터가 신뢰도를 지어내면
         그것이 곧 「유사상품을 동일상품처럼」 보이게 하는 길이다). */
      confidence: 0,
      priceSource: "search",
    });
  }
  return candidates;
}
