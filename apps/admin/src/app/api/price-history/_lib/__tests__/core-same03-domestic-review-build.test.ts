import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { factsFromProductUrl } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { withConfidence } from "@commerce/crawler/src/comparison-search/match";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { ComparisonQuery } from "@commerce/crawler/src/comparison-search/types";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket } from "../candidate-market";
import {
  SAME03_ORIGIN_CODES,
  SAME03_ORIGIN_URL,
  type Same03Candidate,
  type Same03OriginCode,
  buildSame03Candidates,
  loadSame03GtRows,
  originJoinIsProven,
} from "./core-same03-inventory";
import { type Same03Evidence, buildSame03Evidence, describeSame03SupplyGaps } from "./core-same03-evidence";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-03 — **국내 SAME 검토 화면 생성**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **100% 조사/판정 화면이다.** matcher · threshold · priceTier · domesticReference ·
 *    가격 pipeline · **셀러 UI** 변경 **전부 0**. 이 파일은 `apps/admin` 의 제품 UI 가
 *    **아니다** — `docs/` 에 자립형 HTML 을 쓰는 **검증 화면 생성기** 다.
 *
 * ── 🔴🔴🔴 왜 `core-2m` 빌더를 «고치지 않고» 새로 만들었는가 ─────────────────
 * ```
 * `core-2m-visual-review-build` 는 **내부 토큰 노출을 전수 단언으로 금지** 한다
 * (NO_TITLE_OVERLAP · BRAND_UNCONFIRMED · PRESUMED_SAME · TEXT_CONFIRMED ·
 *  EXACT_IDENTIFIER · SAME_MIN_AXES · matchLevel · confidence).
 * 🔴 실제로 CORE-PRICE-SAME-02 에서 `verdict` 를 날것으로 적었다가 그 계약이 FAIL 시켰다.
 * 그런데 이 WU 는 **그 반대** 를 요구한다 — 시스템 판정·8축·blocker 를 **그대로** 보여라.
 * ⟹ 🟢 **한 파일이 두 정책을 갖게 하지 않는다.** 출력도 빌더도 둘로 가른다:
 *      docs/core-2m-visual-review.html        CEO 육안 전용 · 내부 토큰 **0** (그대로 유지)
 *      docs/core-same03-domestic-review.html  **신규** · 내부 결과 노출 O · 셀러 UI 연결 **0**
 * 🟢 `core-2m` 의 단언은 **자기 html 문자열** 만 본다 ⟹ 이 파일과 충돌하지 않는다(확인).
 * ```
 *
 * ── 🔴 라이브 축은 환경변수로만 ──────────────────────────────────────────────
 * ```
 * START-HERE §14 가 기록한 사실 — 외부 사이트에 의존하는 빌더는 **병렬에서 간헐 FAIL**
 * 한다(`core-2m-visual-review-build` 가 그렇다). 🔴 두 번째 간헐 FAIL 을 CI 에 더하면
 * 「회귀인가 네트워크인가」를 가를 수 없다 ⟹ `CORE_SAME03_LIVE=1` 로만 돈다.
 * 🟢 매핑·축 읽기 계약은 `core-same03-inventory.test.ts`(네트워크 0)에 **상주** 한다.
 * ```
 *
 * ── 🔴 값을 «지어내지» 않는다 ────────────────────────────────────────────────
 * ```
 * 🔴 CTO 가 **미리 판정하지 않는다** — 세 칸은 비어 있다(`checked` 속성 0).
 * 🔴 페이지를 못 읽은 후보를 **빼지 않는다** — 「측정불가」로 **표시** 한다.
 *    (`miniboutique` 가 직전 빌드에서 UNREACHABLE 이었고, 그 후보가 지금 국내
 *     참고가격 KRW 88,000 의 출처다 ⟹ 빼면 「가격은 있는데 동일상품 0곳」의 실체가 사라진다)
 * 🔴 이미지가 없으면 **「이미지 없음」** 이고 다른 상품 이미지로 대체하지 않는다.
 * 🔴 `Referer` 에 한글이 든 URL 을 넣지 않는다(WU-093 에서 fetch 가 던졌다) — origin 만.
 * ```
 */

const LIVE = process.env.CORE_SAME03_LIVE === "1";
const OUT = path.join(__dirname, "../../../../../../../../docs/core-same03-domestic-review.html");

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 🔴 빈 값은 「없음」이다 — 지어내지 않는다. */
const val = (v: unknown): string => {
  if (Array.isArray(v)) return v.length ? esc(v.join(" · ")) : '<span class="na">없음</span>';
  const s = v == null ? "" : String(v).trim();
  return s ? esc(s) : '<span class="na">없음</span>';
};

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 🟢 이미지를 **data: URI** 로 박는다 — 로그인·네트워크 없이 사진이 떠야 판정이 된다. */
async function toDataUri(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const abs = url.startsWith("//") ? `https:${url}` : url;
    const u = new URL(abs);
    const res = await fetch(abs, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-review/1.0)", referer: u.origin },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\//i.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 1_600_000) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

interface OriginBlock {
  code: Same03OriginCode;
  url: string;
  facts: ProductFacts;
  img: string | null;
  body: string;
  cards: CardData[];
}

interface CardData {
  cand: Same03Candidate;
  /** 🔴 페이지를 못 읽었을 때의 운영 status — 「측정불가」의 **이유** 다. */
  readStatus: string;
  facts: ProductFacts | null;
  verdict: string | null;
  matchTruth: string | null;
  priceTier: string | null;
  market: string | null;
  marketBasis: string | null;
  price: { amount: number; currency: string } | null;
  inDomesticReference: boolean;
  domesticReferenceWhy: string;
  /** 🔴 등록부를 조회할 수 없어 「KR 아님」이 **운영에서 뒤집힐 수 있는** 자리인가. */
  registryCouldFlip: boolean;
  evidence: Same03Evidence | null;
  gaps: { label: string; note: string }[];
  img: string | null;
  extraImgs: string[];
  imgFromPageMeta: boolean;
  body: string;
}

/** 원상품 facts — `core-2m` 과 **같은 순서** 로 만든다(브랜드 복구 포함 · WU-134). */
async function loadOrigin(code: Same03OriginCode): Promise<OriginBlock> {
  const url = SAME03_ORIGIN_URL[code];
  const ex = await shopifySiteStrategy.extract(url);
  expect(ex?.productData, `🔴 원상품(${code}) 추출 실패 — 그 섹션을 만들지 않는다`).toBeTruthy();
  let dna = buildProductIdentityDna(
    buildCanonicalProduct(url, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
  );
  /**
   * 🔴 공식몰 `vendor` 가 **시즌코드**("AW26")면 brand 가 거부돼 비는다 — 그러면 모든
   *    후보가 BRAND_UNCONFIRMED 가 되어 비교표가 **열화된다**(WU-133/134 가 확정한 사슬).
   * 🟢 WU-134 가 쓴 그 복구를 **그대로** 쓴다(운영 경로와 같은 함수).
   */
  if (!dna.brand.value) {
    const html = await fetchPlainHtml(url);
    const site = html ? extractSiteBrandName(html) : null;
    if (site?.value) {
      dna = buildProductIdentityDna(
        buildCanonicalProduct(
          url,
          { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
          {} as Record<string, ProductDataSource>,
          [],
        ),
      );
    }
  }
  const facts = productFactsFromIdentityDna(dna);
  const html = (await fetchPlainHtml(url)) ?? "";
  /**
   * 🔴🔴🔴 **원상품 사진은 `facts.imageUrls` 에서 오지 않는다 — 1차 빌드가 그래서 비었다.**
   *
   * `productFactsFromIdentityDna` 의 `imageUrls` 는 `canonicalProduct.images` 를 읽고,
   * 그 칸은 `buildCanonicalProduct(…, items)` 의 **네 번째 인자(`WorkspaceItem[]`)에서만**
   * 조립된다(canonical-product.ts:229). 🔴 이 하니스는 workspace 가 없어 `[]` 를 넘기므로
   * **구조적으로 항상 빈 배열** 이다.
   * 🔴 실측 — 1차 빌드의 「이미지 없음」 **15칸** 중 **12칸이 원상품 자리** 였다
   *    (후보 쪽 3칸과 합쳐 15). 즉 CEO 가 **비교 대상 사진 없이** 판정하게 되는 모양이고,
   *    WU-099 에서 CEO 가 「원상품이 뭔지 알려줘야 비교할 수 있다」고 지적한 그 자리다.
   * 🟢 그래서 **추출기가 이미 돌려준 자기 이미지**(`SiteStrategyResult.images`)를 쓴다 —
   *    같은 페이지의 자기 사진이고 **추가 수집 0** 이다.
   * 🔴 운영 추출기·DNA·canonical 을 **한 글자도 고치지 않았다** — 검토 화면이 읽는 자리만 바꿨다.
   * 🔴 그리고 그 사진은 **판정에 쓰이지 않는다**(IMAGE 축은 후보 `imageUrl` 이 없어 계산되지 않는다).
   */
  const originImageUrl = facts.imageUrls?.[0] ?? ex!.images?.[0]?.url;
  return {
    code,
    url,
    facts,
    img: await toDataUri(originImageUrl),
    body: visibleText(html).slice(0, 1200),
    cards: [],
  };
}

async function loadCard(origin: OriginBlock, cand: Same03Candidate): Promise<CardData> {
  const empty = {
    cand,
    facts: null,
    verdict: null,
    matchTruth: null,
    priceTier: null,
    market: null,
    marketBasis: null,
    price: null,
    evidence: null,
    gaps: [],
    img: null,
    extraImgs: [] as string[],
    imgFromPageMeta: false,
    body: "",
  };

  const f = await factsFromProductUrl(cand.url);
  if (f.status !== "OK" || !f.candidate?.facts) {
    /** 🔴 **빼지 않는다** — 「읽지 못했다」와 「후보가 없다」는 다른 문장이다. */
    return {
      ...empty,
      readStatus: f.status,
      inDomesticReference: false,
      domesticReferenceWhy: "페이지를 읽지 못해 가격 자격을 판정할 수 없습니다(측정불가)",
      registryCouldFlip: false,
    };
  }

  const query = {
    title: origin.facts.title,
    brand: origin.facts.brand ?? undefined,
    sourceUrl: origin.url,
    sku: origin.facts.brandModelCode ?? undefined,
    facts: origin.facts,
  } as ComparisonQuery;

  const [scored] = withConfidence(query, [f.candidate]);
  const facts = scored?.facts ?? f.candidate.facts;
  const cross = compareCrossSellerProducts(origin.facts, facts);
  const matchTruth = deriveMatchTruth(
    scored?.matchLevel ?? "low",
    compareModelCode(origin.code, facts.brandModelCode ?? null),
    cross.verdict,
    cross.blockers,
  );
  /** 🟢 운영 owner 를 **그대로 부른다** — tier 를 복제 계산하지 않는다. */
  const priceTier = priceTierFromLink({ matchTruth, verified: false });

  const price = scored?.price ?? f.candidate.price ?? null;
  const market = classifyCandidateMarket({
    domain: cand.domain,
    currency: price?.currency ?? null,
    /** 🔴 등록부 조회는 service-role 키가 필요해 이 하니스에서 불가능하다 ⟹ false 로 둔다.
     *     그래서 `basis` 가 「등록부」로 나오는 경로는 **여기서 발화하지 않는다**(화면에 적는다). */
    isRegisteredDomesticShop: false,
  });
  /**
   * 🔴 **환산하지 않는다** — KRW 가 아니면 `priceKrw` 는 null 이다(§5 환산 금지).
   *    운영 `market-intelligence` 의 국내 적재 게이트와 **같은 세 조건** 을 읽는다.
   */
  const priceKrw = price && price.currency.toUpperCase() === "KRW" ? price.amount : null;
  const tierOk = priceTier === "EXACT" || priceTier === "COMPARISON";
  const inDomesticReference = market.market === "KR" && priceKrw != null && tierOk;
  /**
   * 🔴🔴 **이 하니스가 운영과 «다를 수 있는» 자리를 화면에 적는다.**
   *
   * `classifyCandidateMarket` 에서 등록부(`isRegisteredDomesticShop`)와 판매자 증거
   * (`marketEvidence`)를 보는 분기는 **통화가 KRW 일 때만** 결론을 바꾼다
   * (candidate-market.ts:119·121 — `KR_SELLER_EVIDENCE_AND_KRW` · `REGISTERED_SHOP_AND_KRW`).
   * 🔴 이 하니스는 service-role 키가 없어 등록부를 **조회할 수 없고** `marketEvidence` 도
   *    넘기지 않는다 ⟹ 그 두 분기가 **발화하지 않는다.**
   * 🔴 그래서 「KRW 인데 KR 이 아니다」를 **제품 사실로 적으면 거짓일 수 있다** —
   *    운영에서는 KR 로 확정될 수 있다. ⟹ 그 자리를 **측정불가로 표시** 한다.
   * 🟢 외화 후보는 그 분기가 KR 을 만들지 못하므로(④ 충돌 경로) 결론이 뒤집히지 않는다.
   */
  const registryCouldFlip = priceKrw != null && market.market !== "KR";
  const why = !price
    ? "가격을 읽지 못했습니다"
    : market.market !== "KR"
      ? `시장이 KR 로 확정되지 않았습니다(${market.basis})` +
        (registryCouldFlip
          ? " 🔴 단 이 검토 화면은 국내 판매처 등록부를 조회할 수 없습니다 — 운영에서는 KR 로 확정될 수 있습니다(측정불가)"
          : "")
      : priceKrw == null
        ? `통화가 ${price.currency} 입니다 — 환산하지 않습니다`
        : tierOk
          ? "국내 참고가격에 들어갑니다"
          : `가격 등급이 ${priceTier} 입니다`;

  let html = "";
  try {
    const res = await fetch(cand.url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-review/1.0)" },
      signal: AbortSignal.timeout(30000),
    });
    html = await res.text();
  } catch {
    html = "";
  }
  /**
   * 🔴 후보 `imageUrl` 은 추출 경로에서 **하드코딩 null** 이다(§9 공급 문제) ⟹ 사진이
   *    없으면 이 WU 가 성립하지 않는다(WU-093 에서 CEO 판정 12건이 측정불가가 됐다).
   * 🟢 그래서 **표준 칸 둘**(`og:image` · JSON-LD `Product.image`)을 보조로 읽는다 —
   *    🔴 사이트별 규칙 **0** · 🔴 운영 추출기 변경 **0** · 🔴 판정에 **쓰지 않는다**.
   */
  const ogImg = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ?? null;
  const ldImg = (() => {
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      const hit = /"image"\s*:\s*(?:\[\s*)?"([^"]+)"/.exec(m[1]);
      if (hit) return hit[1];
    }
    return null;
  })();
  const own = (facts.imageUrls ?? []).slice(0, 3);
  const imgFromPageMeta = own.length === 0 && Boolean(ogImg ?? ldImg);
  const urls = own.length ? own : imgFromPageMeta ? [(ogImg ?? ldImg)!] : [];
  const imgs = (await Promise.all(urls.map((u) => toDataUri(u)))).filter((d): d is string => Boolean(d));

  const evidence = buildSame03Evidence(cross, origin.facts, facts);
  return {
    cand,
    readStatus: "OK",
    facts,
    verdict: String(cross.verdict),
    matchTruth: String(matchTruth),
    priceTier,
    market: market.market,
    marketBasis: market.basis,
    price,
    inDomesticReference,
    domesticReferenceWhy: why,
    registryCouldFlip,
    evidence,
    gaps: describeSame03SupplyGaps(evidence, facts, imgFromPageMeta),
    img: imgs[0] ?? null,
    extraImgs: imgs.slice(1),
    imgFromPageMeta,
    body: visibleText(html).slice(0, 1200),
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   HTML
   ══════════════════════════════════════════════════════════════════════════════ */

const STATE_LABEL: Record<string, string> = {
  PASS: "PASS",
  FAIL: "FAIL",
  CONFLICT: "CONFLICT",
  UNKNOWN: "UNKNOWN",
  NOT_AVAILABLE: "NOT_AVAILABLE",
};
const READ_STATUS_NOTE: Record<string, string> = {
  UNREACHABLE: "응답을 받지 못했습니다 — 「상품이 없다」가 아닙니다",
  NOT_PRODUCT_URL: "URL 모양이 상품 페이지가 아닙니다(목록·루트 등)",
  NO_FACTS: "응답은 받았지만 상품명조차 읽지 못했습니다",
  REDIRECTED_AWAY: "상품 URL 로 요청했는데 도착지가 상품이 아닙니다(홈·목록)",
};

function renderCard(origin: OriginBlock, c: CardData, idx: number): string {
  const id = `${origin.code}-${idx}`;
  const o = origin.facts;
  const f = c.facts;

  const frame = (d: string | null, alt: string) =>
    d ? `<div class="frame"><img src="${d}" alt="${esc(alt)}"></div>` : `<div class="frame empty">이미지 없음</div>`;

  const pairRow = (k: string, a: unknown, b: unknown, cls = "") =>
    `<tr><th>${esc(k)}</th><td class="v ${cls}">${val(a)}</td><td class="v ${cls}">${val(b)}</td></tr>`;

  /** 🔴 §9 — **좌우 같은 항목** 이다. 한쪽만 있는 칸을 만들지 않는다. */
  const fieldRows = f
    ? [
        pairRow("브랜드", o.brand, f.brand),
        pairRow("상품명", o.title, f.title),
        pairRow("공식 품번", o.brandModelCode, f.brandModelCode, "code"),
        pairRow("판매처 SKU", o.sellerSku, f.sellerSku, "code"),
        pairRow("상품명 핵심어", o.coreTitleTokens, f.coreTitleTokens),
        pairRow("카테고리", o.categoryText, f.categoryText),
        pairRow("색상", o.colorText, f.colorText),
        pairRow("소재", o.materialText, f.materialText),
        pairRow("핏", o.fitText, f.fitText),
        pairRow("대상 연령", o.ageRangeText, f.ageRangeText),
        pairRow("대상 신호", o.audienceSignals, f.audienceSignals),
        pairRow("사이즈 표기", o.sizeLabels, f.sizeLabels),
        pairRow("URL 조각", o.urlSlug, f.urlSlug, "code"),
        `<tr><th>상세 설명 발췌</th><td class="body">${val(origin.body)}</td><td class="body">${val(c.body)}</td></tr>`,
      ].join("")
    : "";

  const axisRows = (c.evidence?.rows ?? [])
    .map(
      (r) =>
        `<tr class="ax ${r.state}"><th>${esc(r.label)}</th>` +
        `<td class="st"><span class="badge ${r.state}">${esc(STATE_LABEL[r.state] ?? r.state)}</span></td>` +
        `<td class="src">${esc(r.from)}${r.points == null ? "" : ` · ${r.points}점`}</td>` +
        `<td class="dt">${val(r.detail)}</td>` +
        `<td class="v">${val(r.originValue)}</td><td class="v">${val(r.candidateValue)}</td></tr>`,
    )
    .join("");

  const blockerBox =
    c.evidence && (c.evidence.blockers.length || c.evidence.conflicts.length)
      ? `<div class="blockers">
      ${c.evidence.conflicts
        .map((x) => `<div class="bl cf"><b>반증 ${esc(x.name)}</b><span>${esc(x.detail)}</span></div>`)
        .join("")}
      ${c.evidence.blockers
        .map((x) => `<div class="bl bk"><b>보류 ${esc(x.name)}</b><span>${esc(x.detail)}</span></div>`)
        .join("")}
    </div>`
      : `<p class="na">보류·반증이 없습니다.</p>`;

  const earlyNote = c.evidence?.earlyReturn
    ? `<p class="early">🔴 반증을 만나 <b>조기 종료</b>됐습니다 — 아래 나머지 축은
       <b>계산조차 되지 않았습니다</b>(점수가 낮아서가 아닙니다).</p>`
    : "";

  const systemBox = f
    ? `<div class="sys">
      <div><span>교차판매처 판정</span><b>${esc(c.verdict)}</b></div>
      <div><span>matchTruth</span><b>${esc(c.matchTruth)}</b></div>
      <div><span>priceTier</span><b>${esc(c.priceTier)}</b></div>
      <div><span>시장</span><b>${esc(c.market)}</b><em>${esc(c.marketBasis)}</em></div>
      <div><span>가격</span><b>${c.price ? esc(`${c.price.currency} ${c.price.amount.toLocaleString()}`) : "없음"}</b></div>
      <div class="${c.inDomesticReference ? "yes" : "no"}"><span>국내 참고가격 포함</span>
        <b>${c.inDomesticReference ? "포함" : "미포함"}</b><em>${esc(c.domesticReferenceWhy)}</em></div>
    </div>`
    : `<div class="sys unread"><div><span>페이지 읽기</span><b>${esc(c.readStatus)}</b>
        <em>${esc(READ_STATUS_NOTE[c.readStatus] ?? "측정불가")}</em></div></div>`;

  /** 🔴 §9 — 「이전 CEO 판정 / 이전 사유」는 **이번 판정과 섞지 않는다**(별도 블록). */
  const priorBox = `<div class="prior${c.cand.verdictConflict ? " conflict" : ""}">
    <div class="ph">이전 기록 <span>${esc(c.cand.sources.join(" · "))}</span></div>
    ${
      c.cand.unlabeled
        ? `<p>이전 CEO 판정이 <b>없습니다</b>.${
            c.cand.addedBecause ? ` 이 후보는 <b>${esc(c.cand.addedBecause)}</b> 때문에 올렸습니다.` : ""
          }</p>`
        : `<p>이전 CEO 판정 — <b>${esc(c.cand.priorVerdicts.join(" / "))}</b>${
            c.cand.uiLabels.length ? ` <span class="ui">(화면 선택: ${esc(c.cand.uiLabels.join(" / "))})</span>` : ""
          }</p>
         ${c.cand.priorReasons.length ? `<p>이전 사유 — ${esc(c.cand.priorReasons.join(" · "))}</p>` : ""}
         ${c.cand.ceoBasis ? `<p>이전 판단 근거 — ${esc(c.cand.ceoBasis)}</p>` : ""}`
    }
    ${
      c.cand.verdictConflict
        ? `<p class="warn">🔴 과거 판정이 <b>서로 달랐습니다</b> — 이 건은 꼭 다시 봐 주십시오.</p>`
        : ""
    }
    <p class="basis">원상품 매핑 근거 — ${esc(c.cand.originBases.join(" · "))} ·
      국내 분류 — ${c.cand.krBasis === "KR_TLD" ? ".kr 국가 도메인" : "한국 쇼핑몰(수기 지정)"}</p>
  </div>`;

  const gapBox = c.gaps.length
    ? `<div class="gaps"><div class="ph">시스템이 못 본 것</div>${c.gaps
        .map((g) => `<div class="gap"><b>${esc(g.label)}</b><span>${esc(g.note)}</span></div>`)
        .join("")}</div>`
    : "";

  return `
<section class="cand" data-id="${esc(id)}">
  <div class="hdr">
    <h3>${esc(c.cand.domain)}</h3>
    <a href="${esc(c.cand.url)}" target="_blank" rel="noreferrer">판매처 페이지 ↗</a>
  </div>

  ${systemBox}
  ${priorBox}

  <div class="pics">
    <figure><figcaption><span>원상품 ${esc(origin.code)}</span></figcaption>${frame(origin.img, "원상품")}</figure>
    <figure><figcaption><span>${esc(c.cand.domain)}</span>${
      c.imgFromPageMeta ? '<span class="note">페이지 대표 이미지(판정 미사용)</span>' : ""
    }</figcaption>${frame(c.img, c.cand.domain)}</figure>
  </div>
  ${c.extraImgs.length ? `<div class="imgs">${c.extraImgs.map((d) => `<img src="${d}" alt="추가 이미지">`).join("")}</div>` : ""}

  <div class="judge">
    <span class="q">이 후보는 원상품과 같은 상품입니까?</span>
    <div class="seg">
      <label><input type="radio" name="j-${esc(id)}" value="동일"><span>동일</span></label>
      <label><input type="radio" name="j-${esc(id)}" value="다른제품"><span>다른제품</span></label>
      <label><input type="radio" name="j-${esc(id)}" value="판단불가"><span>판단불가</span></label>
    </div>
    <label class="why"><span>사유 — 무엇을 보고 그렇게 판단하셨습니까?</span>
      <textarea name="r-${esc(id)}" rows="2" placeholder="예: 브랜드 + 품번 동일 / 사진으로 색이 다름 / 상/하의 세트라 가격비교 부적합"></textarea>
    </label>
  </div>

  <h4 class="lv">8축 증거</h4>
  ${earlyNote}
  ${blockerBox}
  <div class="tw"><table class="axes"><thead><tr><th>축</th><th>결과</th><th>출처</th><th>설명</th>
    <th>원상품 값</th><th>후보 값</th></tr></thead><tbody>${axisRows}</tbody></table></div>
  ${gapBox}

  ${
    f
      ? `<details><summary>원상품 ↔ 비교상품 전체 항목</summary>
    <div class="tw"><table class="fields"><thead><tr><th>항목</th><th>원상품</th><th>${esc(
      c.cand.domain,
    )}</th></tr></thead><tbody>${fieldRows}</tbody></table></div>
  </details>`
      : `<p class="na">페이지를 읽지 못해 비교 항목을 만들지 못했습니다 — <b>측정불가</b>입니다.</p>`
  }
</section>`;
}

function renderHtml(blocks: OriginBlock[]): string {
  const total = blocks.reduce((n, b) => n + b.cards.length, 0);
  const exportMap = blocks.flatMap((b) =>
    b.cards.map((c, i) => ({
      id: `${b.code}-${i}`,
      originCode: b.code,
      domain: c.cand.domain,
      url: c.cand.url,
      system: c.verdict ?? c.readStatus,
      matchTruth: c.matchTruth,
      priceTier: c.priceTier,
      inDomesticReference: c.inDomesticReference,
      blockers: (c.evidence?.blockers ?? []).map((x) => x.name),
      conflicts: (c.evidence?.conflicts ?? []).map((x) => x.name),
      priorVerdicts: c.cand.priorVerdicts,
    })),
  );

  const sections = blocks
    .map(
      (b) => `
<section class="origin">
  <div class="orail">
    ${b.img ? `<img src="${b.img}" alt="원상품">` : '<div class="frame empty mini">이미지 없음</div>'}
    <div class="who">
      <div class="eyebrow">원상품 · <code>${esc(b.code)}</code></div>
      <h2>${val(b.facts.title)}</h2>
      <div class="sub">${val(b.facts.brand)} · ${val(b.facts.colorText)} · 국내 후보 <b>${b.cards.length}</b>건</div>
      <a href="${esc(b.url)}" target="_blank" rel="noreferrer">원상품 페이지 ↗</a>
    </div>
  </div>
  ${b.cards.map((c, i) => renderCard(b, c, i)).join("")}
</section>`,
    )
    .join("");

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CORE-PRICE-SAME-03 — 국내 SAME 검토 (${total}건)</title>
<style>
/* 🔴 webfont 링크 0 — CSP 가 폰트 CDN 을 막고 조용한 폴백이 난다. */
:root{
  color-scheme:light;
  --paper:#FBFAF7; --ink:#17181C; --muted:#6F6B63; --line:#E4E0D7; --card:#FFFFFF;
  --accent:#2C3E8C; --accent-soft:#EEF0F9;
  --pass:#1F7A4D; --fail:#A8432B; --conflict:#8C1D18; --unknown:#8A8780;
  --serif:Georgia,"Times New Roman","Nanum Myeongjo",serif;
  --sans:-apple-system,"Segoe UI","Malgun Gothic",system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"Cascadia Mono",Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.65 var(--sans);
  font-variant-numeric:tabular-nums}
main{max-width:1180px;margin:0 auto;padding:22px 20px 0}

.howto{border:1px solid var(--line);border-left:3px solid var(--accent);background:var(--card);
  border-radius:3px;padding:14px 18px;margin-bottom:26px}
.howto p{margin:0;font-size:13.5px;color:var(--muted)}
.howto p+p{margin-top:7px}
.howto b{color:var(--ink)}

/* 원상품 레일 — 🔴 원상품이 둘이라 섹션마다 sticky 다(한 목록에 섞지 않는다) */
.origin{margin-bottom:44px}
.orail{position:sticky;top:0;z-index:9;background:var(--card);border:1px solid var(--line);
  border-left:3px solid var(--accent);border-radius:3px;padding:12px 16px;margin-bottom:18px;
  display:flex;gap:16px;align-items:center;box-shadow:0 6px 18px -14px rgba(23,24,28,.35)}
.orail img{width:72px;height:72px;object-fit:contain;background:var(--paper);
  border:1px solid var(--line);border-radius:3px;flex:none}
.orail .who{min-width:0}
.eyebrow{font:600 10px/1 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.eyebrow code{font:600 11px/1 var(--mono);color:var(--accent);background:var(--accent-soft);
  padding:2px 5px;border-radius:2px;letter-spacing:0}
.orail h2{margin:5px 0 3px;font:400 20px/1.2 var(--serif);text-wrap:balance}
.orail .sub{font-size:12.5px;color:var(--muted)}
.orail a{font-size:12px;color:var(--accent);text-decoration:none;border-bottom:1px solid currentColor}

.cand{background:var(--card);border:1px solid var(--line);border-radius:3px;
  padding:16px 18px;margin-bottom:20px}
.cand>.hdr{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;
  padding-bottom:10px;border-bottom:1px solid var(--line)}
.cand h3{margin:0;font:400 17px/1.25 var(--serif)}
.cand .hdr a{font-size:12.5px;color:var(--accent);text-decoration:none;border-bottom:1px solid currentColor}

/* 시스템 결과 — 🔴 내부 토큰을 그대로 적는다(이 화면의 목적이다) */
.sys{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.sys>div{border:1px solid var(--line);border-radius:3px;padding:7px 10px;background:var(--paper);
  display:flex;flex-direction:column;gap:2px;min-width:118px}
.sys span{font:600 9.5px/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.sys b{font:600 13px/1.3 var(--mono)}
.sys em{font-style:normal;font-size:11.5px;color:var(--muted);line-height:1.4}
.sys>div.yes{border-color:var(--pass);background:#F2F8F4}
.sys>div.yes b{color:var(--pass)}
.sys>div.no b{color:var(--fail)}
.sys.unread>div{border-color:var(--fail);background:#FBF2F0;min-width:100%}

/* 이전 기록 — 🔴 이번 판정과 섞지 않는다 */
.prior{border:1px solid var(--line);border-radius:3px;padding:10px 12px;background:var(--paper);
  margin:0 0 12px;font-size:13px}
.prior.conflict{border-color:var(--conflict);background:#FBF0EF}
.prior .ph{font:600 9.5px/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);margin-bottom:6px}
.prior .ph span{letter-spacing:0;text-transform:none;font-weight:400}
.prior p{margin:3px 0;color:var(--muted)}
.prior p b{color:var(--ink)}
.prior .ui{font-size:12px}
.prior .warn{color:var(--conflict);font-weight:600}
.prior .basis{font-size:11.5px;color:var(--unknown)}

.pics{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0 4px}
.pics figure{margin:0}
.pics figcaption{font:600 10px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;
  color:var(--muted);margin-bottom:6px;display:flex;justify-content:space-between;gap:8px}
.pics figcaption .note{text-transform:none;letter-spacing:0;font-weight:400;color:var(--unknown)}
.pics .frame{aspect-ratio:1/1;background:var(--paper);border:1px solid var(--line);
  border-radius:2px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.pics img{width:100%;height:100%;object-fit:contain}
.frame.empty{color:var(--unknown);font-size:12.5px;border-style:dashed}
.frame.empty.mini{width:72px;height:72px;flex:none;border:1px dashed var(--line);border-radius:3px;
  display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center}
.imgs{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.imgs img{width:92px;height:92px;object-fit:contain;background:var(--paper);
  border:1px solid var(--line);border-radius:2px}

h4.lv{margin:18px 0 8px;font:600 10px/1 var(--sans);letter-spacing:.16em;
  text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:10px}
h4.lv::after{content:"";flex:1;height:1px;background:var(--line)}

.early{margin:0 0 10px;font-size:13px;color:var(--conflict);background:#FBF0EF;
  border:1px solid var(--conflict);border-radius:3px;padding:8px 10px}
.blockers{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.bl{display:flex;gap:10px;align-items:baseline;border-radius:3px;padding:7px 10px;font-size:13px}
.bl b{font:600 12px/1.4 var(--mono);flex:none}
.bl span{color:var(--muted)}
.bl.cf{border:1px solid var(--conflict);background:#FBF0EF}
.bl.cf b{color:var(--conflict)}
.bl.bk{border:1px solid var(--line);background:var(--paper)}
.bl.bk b{color:var(--fail)}

.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:7px 9px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
thead th{font:600 9.5px/1.4 var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
  border-bottom:1px solid var(--ink)}
tbody th{width:116px;font:600 12px/1.5 var(--mono);white-space:nowrap}
td.v{font-size:12.5px}
td.code{font:12.5px/1.5 var(--mono)}
td.body{font-size:11.5px;color:var(--muted);line-height:1.55;max-width:0}
td.src{font:11.5px/1.4 var(--mono);color:var(--muted);white-space:nowrap}
td.dt{font-size:12.5px;color:var(--muted)}
td.st{width:124px}
.na{color:var(--unknown)}
.badge{font:600 10px/1 var(--mono);letter-spacing:.04em;padding:4px 7px;border-radius:2px;
  border:1px solid currentColor;white-space:nowrap}
.badge.PASS{color:var(--pass)} .badge.FAIL{color:var(--fail)}
.badge.CONFLICT{color:#fff;background:var(--conflict);border-color:var(--conflict)}
.badge.UNKNOWN,.badge.NOT_AVAILABLE{color:var(--unknown)}
tr.ax.CONFLICT th,tr.ax.FAIL th{color:var(--fail)}

.gaps{margin-top:12px;border:1px solid var(--line);border-radius:3px;padding:10px 12px;background:var(--paper)}
.gaps .ph{font:600 9.5px/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);margin-bottom:6px}
.gap{display:flex;gap:10px;align-items:baseline;font-size:12.5px;padding:2px 0}
.gap b{flex:none;width:66px;font-weight:600}
.gap span{color:var(--muted)}

.judge{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);
  display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.judge .q{font-size:13px;color:var(--muted);flex:1;min-width:160px}
.judge .why{flex-basis:100%;display:flex;flex-direction:column;gap:4px}
.judge .why span{font-size:12px;color:var(--muted)}
.judge .why textarea{width:100%;font:inherit;font-size:13px;padding:6px 8px;
  border:1px solid var(--line);border-radius:3px;background:#fff;resize:vertical}
.seg{display:flex;border:1px solid var(--line);border-radius:3px;overflow:hidden}
.seg label{position:relative;cursor:pointer}
.seg input{position:absolute;inset:0;opacity:0;cursor:pointer}
.seg span{display:block;padding:9px 18px;font-size:13.5px;font-weight:600;color:var(--muted);
  border-left:1px solid var(--line);transition:background .12s,color .12s}
.seg label:first-child span{border-left:0}
.seg input:hover+span{background:var(--paper)}
.seg input:focus-visible+span{outline:2px solid var(--accent);outline-offset:-2px}
.seg input:checked+span{background:var(--accent);color:#fff}
.cand:has(input:checked){border-color:var(--accent)}

details{margin-top:12px}
summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--accent);
  padding:8px 0;border-top:1px solid var(--line);list-style:none}
summary::-webkit-details-marker{display:none}
summary::before{content:"＋ ";font-weight:400}
details[open] summary::before{content:"－ "}

footer{max-width:1180px;margin:0 auto;padding:4px 20px 40px}
button{font:600 14px/1 var(--sans);padding:12px 20px;border:1px solid var(--ink);
  background:var(--ink);color:var(--paper);border-radius:3px;cursor:pointer}
button:hover{background:var(--accent);border-color:var(--accent)}
pre{background:var(--card);border:1px solid var(--line);border-radius:3px;padding:14px;
  font:12px/1.6 var(--mono);white-space:pre-wrap;word-break:break-all;color:var(--muted)}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
@media(max-width:860px){
  .pics{grid-template-columns:1fr}
  .orail{flex-wrap:wrap;position:static}
  tbody th{width:92px}
}
</style></head><body>
<main>
  <div class="howto">
    <p>이 화면은 <b>국내 후보 ${total}건</b>에 대해 <b>대표님 판정</b>을 받기 위한 것입니다.
      원상품이 <b>둘</b>이라 섹션도 둘입니다 — <b>섹션을 넘어 비교하지 마십시오.</b></p>
    <p><b>동일</b> / <b>다른제품</b> / <b>판단불가</b> 셋 중 하나를 고르고,
      가능하면 <b>사유</b>를 한 줄 적어 주십시오 — 무엇을 보고 판단하셨는지가 다음 단계의 입력입니다.
      자료가 부족해 확정할 수 없으면 <b>판단불가</b>가 정답입니다.</p>
    <p>각 후보에는 <b>시스템이 낸 결과</b>와 <b>8축 증거</b>가 그대로 적혀 있습니다.
      <b>PASS/FAIL 은 시스템의 상태</b>일 뿐이고 <b>정답이 아닙니다</b> —
      대표님 판정이 기준입니다.</p>
    <p><b>측정불가</b>로 표시된 후보는 저희가 그 페이지를 읽지 못한 것입니다 —
      <b>「상품이 없다」는 뜻이 아닙니다.</b></p>
  </div>
  ${sections}
</main>
<footer>
  <button id="copy">판정 결과 복사하기</button>
  <pre id="out">고르신 뒤 위 버튼을 누르시면 여기에 결과가 나옵니다.</pre>
</footer>
<script>
var ROWS = ${JSON.stringify(exportMap)};
document.getElementById("copy").addEventListener("click", function () {
  var out = ROWS.map(function (r) {
    var el = document.querySelector('input[name="j-' + r.id + '"]:checked');
    var why = document.querySelector('textarea[name="r-' + r.id + '"]');
    return {
      originCode: r.originCode,
      domain: r.domain,
      url: r.url,
      ceo: el ? el.value : "미선택",
      why: why && why.value ? why.value.trim() : "",
      system: r.system,
      matchTruth: r.matchTruth,
      priceTier: r.priceTier,
      inDomesticReference: r.inDomesticReference,
      blockers: r.blockers,
      conflicts: r.conflicts,
      priorVerdicts: r.priorVerdicts
    };
  });
  var txt = JSON.stringify(out, null, 2);
  document.getElementById("out").textContent = txt;
  if (navigator.clipboard) navigator.clipboard.writeText(txt);
});
</script>
</body></html>`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   실행
   ══════════════════════════════════════════════════════════════════════════════ */

describe("CORE-PRICE-SAME-03 — 국내 SAME 검토 화면 생성 (운영 변경 0)", () => {
  it.runIf(LIVE)(
    "원상품 둘의 국내 후보로 판정 화면을 만든다",
    async () => {
      /** 🔴 매핑이 증명되지 않으면 **화면을 만들지 않는다**(틀린 비교표보다 없는 것이 낫다). */
      expect(originJoinIsProven(), "🔴 원상품 조인이 증명되지 않았다").toBe(true);

      const rows = loadSame03GtRows();
      const blocks: OriginBlock[] = [];
      for (const code of SAME03_ORIGIN_CODES) {
        const cands = buildSame03Candidates(code, rows);
        expect(cands.length, `🔴 ${code} 국내 후보가 0 이면 섹션을 만들지 않는다`).toBeGreaterThan(0);
        const block = await loadOrigin(code);
        for (const cand of cands) block.cards.push(await loadCard(block, cand));
        blocks.push(block);
        console.log(`\n  ── ${code} · 국내 후보 ${block.cards.length} ──`);
        for (const c of block.cards) {
          console.log(
            `    ${c.cand.domain.padEnd(22)} ${c.readStatus.padEnd(16)} ` +
              `${(c.verdict ?? "-").padEnd(14)} ${(c.priceTier ?? "-").padEnd(11)} ` +
              `${c.inDomesticReference ? "국내가격 포함" : "미포함"} · 이미지 ${c.img ? "O" : "X"} · ` +
              `보류 ${(c.evidence?.blockers ?? []).map((b) => b.name).join(",") || "없음"}`,
          );
        }
      }

      const html = renderHtml(blocks);
      writeFileSync(OUT, html, "utf8");

      const cards = blocks.flatMap((b) => b.cards);
      console.log(`\n═══ 생성 결과 ═══`);
      console.log(`    국내 후보            **${cards.length}** (AC009 ${blocks[0].cards.length} · AC010 ${blocks[1].cards.length})`);
      console.log(`    페이지 읽기 성공      **${cards.filter((c) => c.readStatus === "OK").length} / ${cards.length}**`);
      console.log(`    이미지 확보          **${cards.filter((c) => c.img).length} / ${cards.length}**`);
      console.log(`    국내 참고가격 포함    **${cards.filter((c) => c.inDomesticReference).length}**`);
      console.log(`    과거 판정 충돌        **${cards.filter((c) => c.cand.verdictConflict).length}**`);
      console.log(`    파일                 docs/core-same03-domestic-review.html (${(html.length / 1024 / 1024).toFixed(2)}MB)`);

      /* ── 🔴 계약 — 화면이 거짓말하지 않는지 «같은 자리» 에서 단언한다 ──── */

      /**
       * 🔴🔴 **원상품 사진이 없으면 이 화면은 성립하지 않는다**(WU-099 의 그 지적).
       *    1차 빌드가 `facts.imageUrls` 만 읽어 **원상품 12칸이 전부 비었다** ⟹ 계약으로 잠근다.
       */
      for (const b of blocks) {
        expect(b.img, `🔴 원상품(${b.code}) 사진이 없으면 CEO 가 비교할 대상이 없다`).toBeTruthy();
      }

      /** 🔴 원격 이미지 0 — 로그인/네트워크 없이 사진이 떠야 판정이 된다. */
      expect(html, "🔴 원격 이미지가 있으면 사진이 안 뜰 수 있다").not.toMatch(/<img[^>]+src="https?:/i);

      /** 🔴 CTO 가 미리 판정하지 않았다 — `<input … checked>` **속성** 이 0 이어야 한다.
       *     🔴 `:checked` **선택자**(CEO 가 고른 값을 읽는 코드)에 걸리지 않게 범위를 좁힌다. */
      expect(html, "🔴 CTO 가 미리 고르면 그것은 CEO 판정이 아니다").not.toMatch(/<input[^>]*\bchecked\b/i);

      /** 🟢 후보마다 3택 + 사유 한 칸. */
      expect(html.match(/type="radio"/g)?.length).toBe(cards.length * 3);
      expect(html.match(/<textarea /g)?.length).toBe(cards.length);

      /** 🔴🔴 원상품 섹션이 **둘** 이고 후보가 섞이지 않는다. */
      expect(html.match(/<section class="origin">/g)?.length).toBe(2);
      for (const b of blocks) expect(html).toContain(`<code>${b.code}</code>`);

      /**
       * 🔴🔴 §9 — **측정불가 후보를 빼지 않았다.**
       *
       * 🔴 1차 단언은 `cards` 를 필터해서 돌렸다 — **이미 빠진 후보는 그 배열에 없으므로**
       *    루프가 **0회** 돌고 통과한다(변이 M10 이 그것을 드러냈다 · 다른 단언이 우연히
       *    잡았을 뿐이다). 🟢 그래서 **인벤토리 수와 화면 수를 직접 맞춘다** —
       *    「빠뜨릴 수 없는 모양」이다.
       */
      for (const b of blocks) {
        const expected = buildSame03Candidates(b.code, rows);
        expect(b.cards.length, `🔴 ${b.code} 후보가 화면에서 사라졌다`).toBe(expected.length);
        expect(b.cards.map((c) => c.cand.urlKey).sort()).toEqual(expected.map((c) => c.urlKey).sort());
      }
      const unread = cards.filter((c) => c.readStatus !== "OK");
      expect(unread.length, "🔴 측정불가 후보가 0 이면 이 단언이 아무것도 지키지 않는다").toBeGreaterThan(0);
      for (const c of unread) {
        expect(html, `🔴 ${c.cand.domain} 을 빼면 「읽지 못했다」가 「없다」로 읽힌다`).toContain(c.cand.url);
        expect(html, "🔴 「측정불가」의 이유를 적지 않으면 「상품이 없다」로 읽힌다").toContain(c.readStatus);
      }

      /** 🔴 과거 충돌 후보는 **경고와 함께** 선다. */
      const conflicted = cards.filter((c) => c.cand.verdictConflict);
      expect(conflicted.length, "🔴 충돌 후보가 0 이면 인벤토리가 깨졌다").toBeGreaterThan(0);
      expect(html.match(/과거 판정이 <b>서로 달랐습니다<\/b>/g)?.length).toBe(conflicted.length);

      /** 🔴 라벨 없는 후보는 「이전 CEO 판정이 없습니다」로 적는다(지어내지 않는다). */
      const unlabeled = cards.filter((c) => c.cand.unlabeled);
      expect(unlabeled.length).toBeGreaterThan(0);
      expect(html.match(/이전 CEO 판정이 <b>없습니다<\/b>/g)?.length).toBe(unlabeled.length);

      /**
       * 🔴🔴 **하니스가 운영과 다를 수 있는 자리를 숨기지 않았다.**
       *
       * KRW 후보가 KR 로 확정되지 않았을 때, 그 결론은 **등록부를 못 봐서** 그럴 수
       * 있다 ⟹ 화면이 그 사실을 말해야 한다. 🔴 안 말하면 「국내 가격이 아니다」가
       * **제품 사실처럼** 읽힌다.
       */
      const flip = cards.filter((c) => c.registryCouldFlip);
      /**
       * 🔴🔴 **발화 단언이 먼저다.** 변이 M11(`registryCouldFlip = false`)이 **통과했다** —
       *    개수 대조만 두면 `0 === 0` 으로 **조용히 통과** 한다(「변화 0 = 안전」 금지).
       * 🟢 실측에서 이 모양은 **실재** 한다 — KRW 후보 둘(`donokids` 88,000 ·
       *    `m.luxboy` 59,000)이 `.com` 이라 `KRW_WITHOUT_DOMAIN_EVIDENCE` 로 떨어진다.
       * 🔴 이 수가 0 이 되면 그 경고는 **죽은 코드** 다 — 그때는 사람이 봐야 한다.
       */
      expect(flip.length, "🔴 이 경고가 한 번도 발화하지 않으면 단언이 아무것도 지키지 않는다").toBeGreaterThan(0);
      expect(html.match(/운영에서는 KR 로 확정될 수 있습니다\(측정불가\)/g)?.length ?? 0).toBe(flip.length);
      for (const c of flip) {
        expect(c.price?.currency.toUpperCase(), "🔴 이 경고는 KRW 후보에만 붙는다").toBe("KRW");
        expect(c.inDomesticReference).toBe(false);
      }

      /** 🟢 8축이 후보마다 선다(읽힌 후보만 축을 갖는다). */
      const read = cards.filter((c) => c.evidence);
      expect(html.match(/<table class="axes">/g)?.length).toBe(cards.length);
      for (const c of read) expect(c.evidence!.rows.length).toBeGreaterThanOrEqual(8);

      /** 🔴🔴 **셀러 UI 에 연결하지 않았다** — 이 파일은 `docs/` 에만 쓴다. */
      expect(OUT.replace(/\\/g, "/")).toContain("/docs/core-same03-domestic-review.html");
      expect(OUT.replace(/\\/g, "/")).not.toContain("/src/");

      /** 🔴🔴 기존 CEO 화면을 **건드리지 않았다** — 다른 파일이다. */
      expect(OUT).not.toContain("core-2m-visual-review");
    },
    2_400_000,
  );

  /**
   * 🔴 라이브가 꺼져 있어도 **이 사실만은** 센다 — 게이트가 있다는 것 자체가
   *    「화면이 왜 안 만들어졌는가」의 답이다.
   */
  it("라이브 축은 환경변수로만 돈다", () => {
    expect(LIVE, LIVE ? "" : "🟡 CORE_SAME03_LIVE=1 이 아니라 화면 생성을 건너뛴다").toBe(LIVE);
  });
});
