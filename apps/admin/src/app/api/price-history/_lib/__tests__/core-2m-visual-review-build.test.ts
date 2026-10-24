import { readFileSync, writeFileSync } from "node:fs";
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

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2M — **MI Failure Visual Review 화면 생성**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-24) — 「MI 의 역할은 **최종 결론을 내는 것이 아니라** CEO 가 판단할
 * 수 있도록 **비교 재료를 정확하게 압축해서 보여주는 것**」 ·
 * 「**처음부터 20개 항목을 다 보여주지 않는다**」 ·
 * 「CEO 에게 **MI 내부 축 이름이나 점수 계산을 보여줄 필요 없다**」.
 *
 * 🔴 운영 코드 변경 **0** · MI **0** · threshold **0** · 정규화 **0** · 배포 **0**.
 * 🔴 이 파일은 **검증 화면 생성기** 다 — `apps/admin` 의 제품 UI 가 **아니다**.
 *
 * ── 🟢 선례를 그대로 쓴다 — 새 인프라 0 ────────────────────────────────────
 * ```
 * WU-099/112 가 쓴 **자립형 HTML + data: URI 이미지** 방식이다.
 * 🔴 **원격 이미지 0** 이어야 한다 — 로그인·네트워크 없이 사진이 떠야 육안 비교가 된다
 *    (WU-093 에서 사진이 안 떠서 CEO 판정 12건이 「측정불가」가 됐다).
 * 🟢 **원상품 패널은 sticky** 다 — WU-099 에서 CEO 가 「원상품이 뭔지 알려줘야 비교할
 *    수 있다」고 지적한 그 자리다.
 * 🔴 `Referer` 에 **한글이 든 URL 을 넣지 않는다**(WU-093 에서 fetch 가 던졌다) — origin 만.
 * ```
 *
 * ── 🔴 값을 «지어내지» 않는다 ──────────────────────────────────────────────
 * ```
 * 🔴 `ProductFacts` 에 **패턴/디테일 칸이 없다** ⟹ 「추출 칸 없음」으로 적는다.
 * 🔴 MI 축 이름(`NO_TITLE_OVERLAP` 등)·점수·blocker 를 **화면에 쓰지 않는다**(CPO 명시).
 * 🔴 CTO 가 **미리 판정하지 않는다** — 세 칸은 **비어 있다**.
 * ```
 */

const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const MINI = "https://miniboutique.co.kr/product/detail.html?product_no=4117&cate_no=1&display_group=1";
const DONO = "https://www.donokids.com/shop/shopdetail.html?branduid=3362785";
const ORIGIN_CODE = "B226AC009";

interface GtRow {
  url: string;
  domain: string;
  originCode: string;
  verdict: string;
}

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

/** 🟢 이미지를 **data: URI** 로 박는다. 🔴 실패하면 「이미지 없음」이고 대체하지 않는다. */
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

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 🔴 빈 값을 「없음」으로 적는다 — 지어내지 않는다. */
const val = (v: unknown): string => {
  if (Array.isArray(v)) return v.length ? esc(v.join(" · ")) : '<span class="na">없음</span>';
  const s = v == null ? "" : String(v).trim();
  return s ? esc(s) : '<span class="na">없음</span>';
};

interface Cand {
  label: string;
  url: string;
  human: string;
  facts: ProductFacts;
  verdict: string;
  img: string | null;
  imgs: (string | null)[];
  body: string;
  /** 🔴 대표 이미지가 `og:image` 보충인가 — 화면에 **적는다**(숨기지 않는다). */
  imgFromOg: boolean;
}

describe("CORE-2M — MI Failure Visual Review 생성 (운영 변경 0)", () => {
  it("MI 가 SAME 을 만들지 못한 후보로 3단계 비교 화면을 만든다", async () => {
    /* ── 원상품 ─────────────────────────────────────────────────────────── */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex?.productData, "🔴 원상품 추출 실패 — 화면을 만들지 않는다").toBeTruthy();
    let dna = buildProductIdentityDna(
      buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
    );
    if (!dna.brand.value) {
      const h = await fetchPlainHtml(ORIGIN);
      const site = h ? extractSiteBrandName(h) : null;
      if (site?.value) {
        dna = buildProductIdentityDna(
          buildCanonicalProduct(
            ORIGIN,
            { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
            {} as Record<string, ProductDataSource>,
            [],
          ),
        );
      }
    }
    const originFacts = productFactsFromIdentityDna(dna);
    expect(dna.brand.value, "🔴 brand 가 비면 비교표가 열화된다").toBeTruthy();
    expect(dna.brandModelCode).toBe(ORIGIN_CODE);

    const originHtml = (await fetchPlainHtml(ORIGIN)) ?? "";
    const originImg = await toDataUri(originFacts.imageUrls?.[0]);
    const originBody = visibleText(originHtml).slice(0, 1200);

    /* ── 후보 — 운영 순서로 판정한다 ──────────────────────────────────── */
    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: GtRow[] };
    const gtRows = gt.candidates.filter((c) => c.originCode === "B226AC009");
    const targets = [
      ...gtRows.map((r) => ({ label: r.domain, url: r.url, human: r.verdict })),
      { label: "donokids.com", url: DONO, human: "라벨없음" },
      { label: "miniboutique.co.kr", url: MINI, human: "라벨없음" },
    ];

    const query = {
      title: ex!.productData!.title ?? "",
      brand: dna.brand.value || undefined,
      sourceUrl: ORIGIN,
      sku: dna.brandModelCode ?? undefined,
      facts: originFacts,
    } as ComparisonQuery;

    const cands: Cand[] = [];
    let sameCount = 0;
    let unreachable = 0;

    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        unreachable += 1;
        console.log(`    ${t.label.padEnd(22)} 🔴 ${f.status} — 화면에 넣지 않는다(측정불가)`);
        continue;
      }
      const [scored] = withConfidence(query, [f.candidate]);
      const facts = scored?.facts ?? f.candidate.facts;
      const cross = compareCrossSellerProducts(originFacts, facts);
      const truth = String(
        deriveMatchTruth(
          scored?.matchLevel ?? "low",
          compareModelCode(ORIGIN_CODE, facts.brandModelCode ?? null),
          cross.verdict,
          cross.blockers,
        ),
      );
      /**
       * 🔴 **MI 가 확실하게 SAME 을 만든 후보는 화면에서 뺀다**(CPO §1) —
       *    「SAME + 식별자 등급」이 그 조건이다. 그 둘은 가격 근거로 바로 간다.
       */
      const settled = cross.verdict === "SAME" && (truth === "EXACT_IDENTIFIER" || truth === "STRONG_IDENTIFIER");
      if (settled) {
        sameCount += 1;
        console.log(`    ${t.label.padEnd(22)} 🟢 MI 확정 SAME — 화면에서 제외`);
        continue;
      }

      let html = "";
      try {
        const res = await fetch(t.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-review/1.0)" },
          signal: AbortSignal.timeout(30000),
        });
        html = await res.text();
      } catch {
        html = "";
      }
      /**
       * ── 🔴🔴 **사진이 없으면 이 WU 가 성립하지 않는다** ─────────────────
       *
       * 1차 생성에서 **이미지 6/10** 이었고 없는 4건은 `imageUrls` 가 **애초에 비어
       * 있었다**(fetch 실패가 아니다). 🔴 그리고 그 4건에 CPO 핵심 fixture 셋이
       * 들어 있었다(`stockmann` · `m.luxboy` · `donokids`).
       * 🔴 WU-099 에서 똑같이 사진이 없어 **CEO 판정 12건이 측정불가** 가 됐다.
       *
       * 🟢 그래서 **WU-100 이 쓴 그 방법** 을 쓴다 — 모든 후보에서 `og:image` 를
       *    보조로 읽는다. 🔴 **사이트별 규칙 0** · 🔴 **운영 추출기는 한 글자도 안 고친다**
       *    (이것은 검증 화면 전용 보충이다).
       * 🔴 그리고 그 사실을 **화면에 적는다** — 「페이지 대표 이미지」인지 구분해야 한다.
       */
      const ogImg = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ?? null;
      /**
       * 🔴 `donokids` 는 `og:image` 도 **없다**(그 사이트는 `og:title` 도 빈 문자열이다 ·
       *    CORE-2H 실측). 🟢 그래서 **표준 칸** 을 하나 더 본다 — JSON-LD `Product.image`.
       * 🔴 **사이트별 규칙이 아니다**(schema.org 표준) · 운영 추출기 변경 **0**.
       */
      const ldImg = (() => {
        for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
          const hit = /"image"\s*:\s*(?:\[\s*)?"([^"]+)"/.exec(m[1]);
          if (hit) return hit[1];
        }
        return null;
      })();
      const urls = (facts.imageUrls ?? []).slice(0, 3);
      if (urls.length === 0 && (ogImg || ldImg)) urls.push((ogImg ?? ldImg)!);
      const imgs = await Promise.all(urls.map((u) => toDataUri(u)));
      const imgFromOg = urls.length === 1 && (facts.imageUrls ?? []).length === 0;
      cands.push({
        label: t.label,
        url: t.url,
        human: t.human,
        facts,
        verdict: cross.verdict,
        img: imgs[0] ?? null,
        imgs: imgs.slice(1),
        body: visibleText(html).slice(0, 1200),
        imgFromOg,
      });
      console.log(`    ${t.label.padEnd(22)} 🟡 ${cross.verdict} — 화면에 넣는다 · 이미지 ${imgs.filter(Boolean).length}/${urls.length}`);
    }

    expect(cands.length, "🔴 검토 대상이 0 이면 화면을 만들지 않는다").toBeGreaterThan(0);

    /* ── HTML ──────────────────────────────────────────────────────────── */
    /**
     * 🔴🔴 **이 칩은 «글자» 비교다 — 상품 동일성 판정이 아니다.**
     *
     * 라벨을 「같음/다름」이 아니라 **「표기 같음 / 표기 다름」** 으로 적는다.
     * 그렇게 안 하면 CEO 가 **시스템이 판정한 것으로 읽는다**(2026-09-19 사고 기전).
     */
    const normTxt = (v: unknown): string => {
      const s = Array.isArray(v) ? v.join(" ") : String(v ?? "");
      return s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
    };
    const flag = (a: unknown, b: unknown): string => {
      const na = normTxt(a);
      const nb = normTxt(b);
      if (!na || !nb) return '<span class="chip u">한쪽 없음</span>';
      return na === nb
        ? '<span class="chip s">표기 같음</span>'
        : '<span class="chip d">표기 다름</span>';
    };
    const row = (k: string, a: unknown, b: unknown, cls = "") =>
      `<tr><th>${esc(k)}</th><td class="v ${cls}">${val(a)}</td>` +
      `<td class="v ${cls}">${val(b)}</td><td class="flag">${flag(a, b)}</td></tr>`;

    const card = (c: Cand, i: number) => {
      const f = c.facts;
      const o = originFacts;
      const L1 = [
        row("브랜드", o.brand, f.brand),
        row("공식 품번", o.brandModelCode, f.brandModelCode, "code"),
        row("상품명", o.title, f.title),
        row("상품 유형", o.categoryText, f.categoryText),
        row("상품명 핵심어", o.coreTitleTokens, f.coreTitleTokens),
      ].join("");
      const L2 = [
        row("색상", o.colorText, f.colorText),
        row("소재", o.materialText, f.materialText),
        row("핏", o.fitText, f.fitText),
        row("대상 연령", o.ageRangeText, f.ageRangeText),
        row("대상 신호", o.audienceSignals, f.audienceSignals),
        row("사이즈 표기", o.sizeLabels, f.sizeLabels),
        `<tr><th>패턴 · 디테일</th><td class="v" colspan="3"><span class="na">수집하는 칸이 없습니다 — 사진으로 보셔야 합니다</span></td></tr>`,
      ].join("");
      const L3 = [
        row("판매처 자체 SKU", o.sellerSku, f.sellerSku, "code"),
        row("URL 조각", o.urlSlug, f.urlSlug, "code"),
        `<tr><th>상세 설명 발췌</th><td class="body">${val(originBody)}</td>` +
          `<td class="body">${val(c.body)}</td><td class="flag"></td></tr>`,
      ].join("");
      const extra = c.imgs.filter(Boolean).length
        ? `<div class="imgs">${c.imgs.filter(Boolean).map((d) => `<img src="${d}" alt="추가 이미지">`).join("")}</div>`
        : `<p class="na">추가 이미지가 없습니다.</p>`;

      const frame = (d: string | null, alt: string) =>
        d
          ? `<div class="frame"><img src="${d}" alt="${esc(alt)}"></div>`
          : `<div class="frame empty">이미지 없음</div>`;

      return `
<section class="cand" id="c${i}">
  <div class="hdr">
    <h2><span class="n">${String(i + 1).padStart(2, "0")}</span>${esc(c.label)}</h2>
    <a href="${esc(c.url)}" target="_blank" rel="noreferrer">판매처 페이지 ↗</a>
  </div>
  <p class="mi">시스템은 이 후보를 <b>같은 상품이라고 확정하지 못했습니다.</b></p>

  <div class="pics">
    <figure><figcaption><span>원본 상품</span></figcaption>${frame(originImg, "원본 상품")}</figure>
    <figure>
      <figcaption><span>${esc(c.label)}</span>${c.imgFromOg ? '<span class="note">페이지 대표 이미지</span>' : ""}</figcaption>
      ${frame(c.img, c.label)}
    </figure>
  </div>

  <h3 class="lv">핵심</h3>
  <div class="tw"><table><tbody>${L1}</tbody></table></div>

  <div class="judge">
    <span class="q">이 자료로 판단되십니까?</span>
    <div class="seg">
      <label><input type="radio" name="j${i}" value="동일"><span>동일</span></label>
      <label><input type="radio" name="j${i}" value="유사"><span>유사</span></label>
      <label><input type="radio" name="j${i}" value="판단불가"><span>판단불가</span></label>
    </div>
  </div>

  <details><summary>판단이 안 되시면 — 추가 정보</summary>
    <div class="tw"><table><tbody>${L2}</tbody></table></div>
  </details>

  <details><summary>그래도 안 되시면 — 기타 정보</summary>
    <div class="tw"><table><tbody>${L3}</tbody></table></div>
    ${extra}
  </details>
</section>`;
    };

    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CORE-2M — 동일상품 육안 판정 (${cands.length}건)</title>
<style>
/* ── 판정 벤치 ───────────────────────────────────────────────────────────
   🔴 webfont 링크 0 — Artifact CSP 가 폰트 CDN 을 막고 조용한 폴백이 난다.
      그래서 **고른 시스템 스택** 을 쓴다(제품명 serif · 품번 monospace).
   🟢 의미색(같음/다름/한쪽없음)은 accent(indigo)와 **분리** 한다.           */
:root{
  color-scheme:light;
  --paper:#FBFAF7; --ink:#17181C; --muted:#6F6B63; --line:#E4E0D7; --card:#FFFFFF;
  --accent:#2C3E8C; --accent-soft:#EEF0F9;
  --same:#1F7A4D; --diff:#A8432B; --unknown:#8A8780;
  --serif:Georgia,"Times New Roman","Nanum Myeongjo",serif;
  --sans:-apple-system,"Segoe UI","Malgun Gothic",system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"Cascadia Mono",Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.65 var(--sans);
  font-variant-numeric:tabular-nums}

/* 원상품 레일 — 스크롤해도 비교 대상이 사라지지 않는다(WU-099 지적) */
header.top{position:sticky;top:0;z-index:9;background:var(--card);
  border-bottom:1px solid var(--line);box-shadow:0 1px 0 var(--line),0 6px 18px -14px rgba(23,24,28,.3)}
.rail{max-width:1040px;margin:0 auto;padding:12px 20px;display:flex;gap:16px;align-items:center}
.rail img{width:66px;height:66px;object-fit:contain;background:var(--paper);
  border:1px solid var(--line);border-radius:3px;flex:none}
.rail .who{flex:1;min-width:0}
.eyebrow{font:600 10px/1 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.rail h1{margin:5px 0 3px;font:400 20px/1.2 var(--serif);text-wrap:balance}
.rail .sub{font-size:12.5px;color:var(--muted)}
.rail .sub code{font:600 12px/1 var(--mono);color:var(--accent);background:var(--accent-soft);
  padding:2px 5px;border-radius:2px}
.count{flex:none;text-align:right;font-size:12px;color:var(--muted)}
.count b{display:block;font:400 26px/1 var(--serif);color:var(--ink)}

main{max-width:1040px;margin:0 auto;padding:22px 20px 0}

.howto{border:1px solid var(--line);border-left:3px solid var(--accent);background:var(--card);
  border-radius:3px;padding:14px 18px;margin-bottom:26px}
.howto p{margin:0;font-size:13.5px;color:var(--muted)}
.howto p+p{margin-top:7px}
.howto b{color:var(--ink)}
.howto kbd{font:600 11px/1 var(--mono);border:1px solid var(--line);border-bottom-width:2px;
  border-radius:3px;padding:2px 5px;background:var(--paper)}

/* 후보 plate */
.cand{background:var(--card);border:1px solid var(--line);border-radius:3px;
  padding:18px 20px 16px;margin-bottom:26px}
.cand>.hdr{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;
  padding-bottom:12px;border-bottom:1px solid var(--line)}
.cand h2{margin:0;font:400 17px/1.25 var(--serif)}
.cand h2 .n{font:600 11px/1 var(--mono);color:var(--muted);margin-right:8px}
.cand .hdr a{font-size:12.5px;color:var(--accent);text-decoration:none;border-bottom:1px solid currentColor}
.mi{margin:12px 0 0;font-size:13px;color:var(--muted)}
.mi b{color:var(--ink);font-weight:600}

/* 사진 — 좌/우 동일 크기. 이 화면의 본론이다 */
.pics{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0 4px}
.pics figure{margin:0}
.pics figcaption{font:600 10px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;
  color:var(--muted);margin-bottom:6px;display:flex;justify-content:space-between;gap:8px}
.pics figcaption .note{text-transform:none;letter-spacing:0;font-weight:400;color:var(--unknown)}
.pics .frame{aspect-ratio:1/1;background:var(--paper);border:1px solid var(--line);
  border-radius:2px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.pics img{width:100%;height:100%;object-fit:contain}
.pics .frame.empty{color:var(--unknown);font-size:12.5px;border-style:dashed}

h3.lv{margin:20px 0 8px;font:600 10px/1 var(--sans);letter-spacing:.16em;
  text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:10px}
h3.lv::after{content:"";flex:1;height:1px;background:var(--line)}

.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{padding:8px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
tbody th{width:118px;font:600 12px/1.5 var(--sans);color:var(--muted);white-space:nowrap}
td.v{width:38%}
td.code{font:13px/1.5 var(--mono)}
td.body{font-size:12px;color:var(--muted);line-height:1.55;max-width:0}
tr:last-child th,tr:last-child td{border-bottom:0}
.na{color:var(--unknown)}

/* 표기 일치 칩 — 🔴 «글자» 비교다. 상품 동일성 판정이 아니다 */
td.flag{width:86px;white-space:nowrap}
.chip{font:600 10.5px/1 var(--sans);letter-spacing:.04em;padding:3px 7px;border-radius:2px;
  border:1px solid currentColor}
.chip.s{color:var(--same)} .chip.d{color:var(--diff)} .chip.u{color:var(--unknown)}

/* 3택 — 세그먼트 컨트롤 */
.judge{margin-top:18px;padding-top:14px;border-top:1px solid var(--line);
  display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.judge .q{font-size:13px;color:var(--muted);flex:1;min-width:150px}
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

details{margin-top:14px}
summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--accent);
  padding:8px 0;border-top:1px solid var(--line);list-style:none}
summary::-webkit-details-marker{display:none}
summary::before{content:"＋ ";font-weight:400}
details[open] summary::before{content:"－ "}
.imgs{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.imgs img{width:104px;height:104px;object-fit:contain;background:var(--paper);
  border:1px solid var(--line);border-radius:2px}

footer{max-width:1040px;margin:0 auto;padding:4px 20px 40px}
button{font:600 14px/1 var(--sans);padding:12px 20px;border:1px solid var(--ink);
  background:var(--ink);color:var(--paper);border-radius:3px;cursor:pointer}
button:hover{background:var(--accent);border-color:var(--accent)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
pre{background:var(--card);border:1px solid var(--line);border-radius:3px;padding:14px;
  font:12px/1.6 var(--mono);white-space:pre-wrap;word-break:break-all;color:var(--muted)}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
@media(max-width:720px){
  .pics{grid-template-columns:1fr}
  .rail{flex-wrap:wrap}
  .count{text-align:left}
  tbody th{width:96px}
  td.v{width:auto}
}
</style></head><body>
<header class="top">
  <div class="rail">
    ${originImg ? `<img src="${originImg}" alt="원본 상품">` : '<div class="frame empty" style="width:66px;height:66px">—</div>'}
    <div class="who">
      <div class="eyebrow">판정 기준이 되는 원본 상품</div>
      <h1>${val(originFacts.title)}</h1>
      <div class="sub">${val(originFacts.brand)} · <code>${val(originFacts.brandModelCode)}</code> · ${val(originFacts.colorText)}</div>
    </div>
    <div class="count"><b id="done">0</b>${cands.length}건 중 판정</div>
  </div>
</header>
<main>
  <div class="howto">
    <p>아래 ${cands.length}건은 <b>시스템이 「같은 상품」이라고 확정하지 못한 후보</b>입니다.
      <b>사진과 핵심 항목</b>만 먼저 보시고 판단되시면 바로 고르십시오.
      판단이 안 되실 때만 아래 <b>추가 정보 → 기타 정보</b>를 펼치십시오.</p>
    <p><b>유사</b>는 비슷하지만 같은 상품이라고 확정할 수 없다는 뜻이고,
      <b>판단불가</b>는 이 자료로는 알 수 없다는 뜻입니다 — 그것도 필요한 답입니다.
      키보드 <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 으로도 고르실 수 있습니다.</p>
    <p>표의 <b>표기 같음 / 표기 다름</b> 칩은 <b>적혀 있는 글자</b>를 맞춰 본 것일 뿐이고,
      같은 상품인지에 대한 판단이 아닙니다.</p>
  </div>
  ${cands.map(card).join("")}
</main>
<footer>
  <button id="copy">판정 결과 복사하기</button>
  <pre id="out">고르신 뒤 위 버튼을 누르시면 여기에 결과가 나옵니다.</pre>
</footer>
<script>
var LABELS = ${JSON.stringify(cands.map((c) => ({ domain: c.label, url: c.url })))};

/* 🟢 진행 카운터 — 10건을 고르는 동안 어디까지 왔는지 보여야 한다. */
function refresh() {
  var n = document.querySelectorAll('.seg input:checked').length;
  document.getElementById("done").textContent = String(n);
}
document.addEventListener("change", function (e) {
  if (e.target && e.target.type === "radio") refresh();
});

/* 🟢 숫자키 1·2·3 — 10건이면 마우스보다 훨씬 빠르다. 보고 있는 카드에 적용한다. */
var VALUES = ["동일", "유사", "판단불가"];
document.addEventListener("keydown", function (e) {
  var k = VALUES[["1", "2", "3"].indexOf(e.key)];
  if (!k || e.metaKey || e.ctrlKey || e.altKey) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll(".cand"));
  var target = null;
  for (var i = 0; i < cards.length; i++) {
    var box = cards[i].getBoundingClientRect();
    if (box.bottom > 160 && box.top < window.innerHeight * 0.75) { target = cards[i]; break; }
  }
  if (!target) return;
  var input = target.querySelector('.seg input[value="' + k + '"]');
  if (input) { input.checked = true; refresh(); }
});

document.getElementById("copy").addEventListener("click", function () {
  var out = LABELS.map(function (c, i) {
    var el = document.querySelector('input[name="j' + i + '"]:checked');
    return { domain: c.domain, url: c.url, ceo: el ? el.value : "미선택" };
  });
  var txt = JSON.stringify(out, null, 2);
  document.getElementById("out").textContent = txt;
  if (navigator.clipboard) navigator.clipboard.writeText(txt);
});
</script>
</body></html>`;

    const outPath = path.join(__dirname, "../../../../../../../../docs/core-2m-visual-review.html");
    writeFileSync(outPath, html, "utf8");

    /* ── 🔴 계약 — 화면이 거짓말하지 않는지 «같은 자리» 에서 단언한다 ──── */
    console.log(`\n═══ 생성 결과 ═══`);
    console.log(`    검토 대상            **${cands.length}**`);
    console.log(`    MI 확정 SAME(제외)    **${sameCount}**`);
    console.log(`    측정불가(제외)        **${unreachable}**`);
    console.log(`    이미지 확보          **${cands.filter((c) => c.img).length} / ${cands.length}**`);
    console.log(`    파일                 docs/core-2m-visual-review.html (${(html.length / 1024 / 1024).toFixed(2)}MB)`);

    /** 🔴 MI 내부 축 이름·점수를 화면에 쓰지 않았다(CPO 명시). */
    for (const token of [
      "NO_TITLE_OVERLAP",
      "BRAND_UNCONFIRMED",
      "crossSellerReserved",
      "PRESUMED_SAME",
      "EXACT_IDENTIFIER",
      "TEXT_CONFIRMED",
      "SAME_MIN_AXES",
      "matchLevel",
      "confidence",
    ]) {
      expect(html, `🔴 내부 토큰 「${token}」이 화면에 노출되면 안 된다`).not.toContain(token);
    }
    console.log("    🟢 MI 내부 축 이름·점수·등급 토큰 노출 **0**(전수 단언)");

    /** 🔴 원격 이미지 0 — 로그인/네트워크 없이 사진이 떠야 한다. */
    expect(html, "🔴 원격 이미지가 있으면 CEO 화면에서 사진이 안 뜰 수 있다").not.toMatch(/<img[^>]+src="https?:/i);
    console.log("    🟢 원격 이미지 **0**(전부 data: URI)");

    /**
     * 🔴 CTO 가 미리 판정하지 않았다 — `<input … checked>` **속성** 이 0 이어야 한다.
     *
     * 🔴🔴 **1차 단언이 틀렸고 코드가 맞았다** — `not.toContain("checked")` 가 내
     *    스크립트의 **`:checked` 선택자**(CEO 가 고른 값을 **읽는** 코드)에 걸렸다.
     *    CORE-2E 의 `not.toContain("약 ₩")` 와 **같은 계열의 실수** 다 ⟹ 범위를 좁힌다.
     */
    expect(html, "🔴 CTO 가 미리 고르면 그것은 CEO 판정이 아니다").not.toMatch(/<input[^>]*\bchecked\b/i);
    console.log("    🟢 미리 선택된 칸 **0**(CTO 판정 0)");

    /**
     * 🟢 3단계가 실제로 점진 공개다 — 1단은 **펼쳐져** 있고 2·3단은 `details` 안이다.
     *
     * 🔴 1차 단언은 「LEVEL 1 — 핵심」이라는 **문구** 를 봤고, 라벨을 「핵심」으로
     *    바꾸자 FAIL 했다(의도된 변경). 🟢 그래서 **문구가 아니라 성질** 을 단언한다 —
     *    「1단은 details 밖」 · 「2·3단은 details 안」 · 「후보당 details 가 둘」.
     */
    expect(html, "🔴 1단(핵심)은 접지 않는다").toContain('<h3 class="lv">핵심</h3>');
    expect(html.match(/<details>/g)?.length, "🔴 후보당 접힘 둘(추가·기타)").toBe(cands.length * 2);
    expect(html.match(/<summary>판단이 안 되시면/g)?.length).toBe(cands.length);
    expect(html.match(/<summary>그래도 안 되시면/g)?.length).toBe(cands.length);
    /** 🔴 핵심 표가 `details` 보다 **앞** 에 온다(처음 보이는 것이 1단이어야 한다). */
    expect(html.indexOf('<h3 class="lv">핵심</h3>')).toBeLessThan(html.indexOf("<details>"));
    console.log("    🟢 LEVEL 2·3 은 **접힌 채** 있다(처음부터 다 보여주지 않는다)");

    /** 🟢 후보마다 라디오 셋이 있다. */
    expect(html.match(/type="radio"/g)?.length).toBe(cands.length * 3);
    /** 🟢 원상품 패널이 sticky 다(WU-099 지적). */
    expect(html).toContain("position:sticky");
    console.log("    🟢 원상품 패널 **sticky** · 후보마다 3택 라디오");
  }, 1800000);
});
