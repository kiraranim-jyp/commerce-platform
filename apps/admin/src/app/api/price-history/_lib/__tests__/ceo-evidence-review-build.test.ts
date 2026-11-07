import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS, same05Judge, type Same05Pair } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CEO EVIDENCE REVIEW — **전체 수집 데이터 + 상세설명 «전문»** 검토 화면
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 코드 · 추출기 · matcher · Identity · alias · BRAND 정책 · GT · DB · schema · UI
 *    변경 0.** **네트워크 0** · **DB 직접 접근 0** · **추가 크롤링 0** · **새 번역 0**.
 *
 * ── 🔴🔴 상세설명을 «어디서» 가져왔는지 먼저 적는다 ──────────────────────────
 * ```
 * 저장 fixture 의 후보 `facts.description`   🔴 **0 / 11**   (`facts.evidence` 도 0/11)
 * ⟹ 기존 화면은 `CORE_DESC_REVIEW_LIVE=1` 로 **라이브 재수집** 해 설명문을 넣었고,
 *    🟢 그 결과물이 **리포에 커밋돼 있다** — `docs/core-desc-evidence-review.html`.
 * ⟹ 🟢 이 하니스는 그 **커밋된 산출물에서 원문을 읽는다** ⟹ **재수집 0**.
 * 🔴 그래서 그 파일을 **덮어쓰지 않는다** — 설명문의 유일한 저장 출처다.
 * ```
 *
 * ── 🔴🔴 MI 결과는 «두 출처» 를 갈라서 보여준다(섞으면 거짓이 된다) ──────────
 * ```
 * ⒜ DB 저장값   `candidate_reviews` — 🔴 **보유 3/11 · verdict 는 1/11** 뿐이다
 *               (덤프는 `ceo-evidence-review-dump.mjs` 가 만든 읽기 전용 fixture)
 * ⒝ 운영 «재현»  `same05Judge()` — cross-seller → compareModelCode → deriveMatchTruth
 *               → priceTierFromLink 를 **그 순서 그대로** 부른다(사본 0 · 새 축 0).
 *               🔴 이것은 **재현** 이고 「그때의 운영 판정」이 아니다 ⟹ 화면에 그렇게 적는다.
 * ```
 *
 * 🔴 **표의 「값 대조」 열은 MI 판정이 아니다** — 문자열 동일 여부다. 어휘가 겹치므로
 *    열 제목과 화면 머리글에 **명시** 한다(메모 `guard-blocking-my-name-means-the-name-collides`).
 * 🔴 **수집되지 않은 값을 채우지 않는다** — `미수집` 으로 적고 그 사실을 센다(CPO §2).
 */

const LIVE = process.env.CEO_EVIDENCE_REVIEW === "1";
const HERE = __dirname;
const FIX = join(HERE, "fixtures");
const DOCS = join(HERE, "../../../../../../../../docs");

/** 🔴 기존 화면과 **같은 11건** 이다 — 대상을 임의로 바꾸지 않는다. */
const TARGET_IDS = ["C27", "C05", "C06", "C19", "C20", "C50", "S1-5", "S1-6", "C22", "C42", "C25"];

const esc = (s: unknown): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s: string): string =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/**
 * 🔴🔴 `canonicalProduct` 는 **칸마다 모양이 다르다**(실측):
 *    `{value,source,confidence}` 래퍼 **28칸** · 평평한 값 **14칸**
 *    (`images` `variants` `sourceUrl` `shopifyTags` `optionGroups` `regularPrice` …).
 *    ⟹ 래퍼를 **조건부로** 벗긴다. 모든 칸을 래퍼로 가정하면 조용히 `undefined` 가 된다.
 */
const isWrapped = (x: unknown): x is { value: unknown; source?: unknown } =>
  Boolean(x) && typeof x === "object" && !Array.isArray(x) && "value" in (x as object);
const V = (x: unknown): unknown => (isWrapped(x) ? x.value : x);
const SRC = (x: unknown): string | null => (isWrapped(x) && x.source ? String(x.source) : null);

const isEmpty = (v: unknown): boolean =>
  v === null || v === undefined || v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

const NA = '<span class="na">미수집</span>';
const show = (v: unknown): string => {
  if (isEmpty(v)) return NA;
  if (Array.isArray(v)) {
    return v.map((x) => `<code>${esc(typeof x === "object" ? JSON.stringify(x) : x)}</code>`).join(" ");
  }
  if (typeof v === "object") return `<pre class="j">${esc(JSON.stringify(v, null, 1))}</pre>`;
  return esc(v);
};
const norm = (v: unknown): string =>
  (Array.isArray(v) ? v.join(" ") : String(v ?? "")).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
/** 🔴 **문자열 대조** 다 — MI 판정이 아니다. 표기·번역 차이도 `MISMATCH` 로 나온다. */
const cmp = (a: unknown, b: unknown): [string, string] => {
  if (isEmpty(a) && isEmpty(b)) return ["UNKNOWN", "양쪽 미수집"];
  if (isEmpty(a)) return ["UNKNOWN", "원본 미수집"];
  if (isEmpty(b)) return ["UNKNOWN", "후보 미수집"];
  return norm(a) === norm(b) ? ["MATCH", "문자열 동일"] : ["MISMATCH", "문자열 다름 — 표기·번역 차이 포함"];
};
const host = (u: string): string => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "?"; } };

interface OriginImage {
  id?: string; originalUrl?: string; cleanedUrl?: string; classification?: string;
  isRepresentative?: boolean; useInDescription?: boolean; useInProductGallery?: boolean;
}
interface DbRow {
  candidate_url: string; candidate_domain: string | null; origin_code: string | null;
  candidate_title: string | null; image_url: string | null;
  price_amount: number | string | null; price_currency: string | null; market: string | null;
  price_status: string | null; sold_out: boolean | null;
  system_verdict: string | null; match_truth: string | null; price_tier: string | null;
  blockers: unknown; human_verdict: string | null; human_note: string | null;
  source: string | null; first_seen_at: string | null; last_seen_at: string | null;
}

describe.skipIf(!LIVE)("CEO-EVIDENCE-REVIEW — 전체 수집 데이터 검토 화면(네트워크 0 · 운영 변경 0)", () => {
  it("원본·후보의 수집 전수와 상세설명 전문을 담은 화면을 만든다", () => {
    const raw = JSON.parse(readFileSync(join(FIX, "wu-059-gt-facts.json"), "utf8")) as {
      origins: Record<string, { canonicalProduct: Record<string, unknown> }>;
    };
    const db = JSON.parse(readFileSync(join(FIX, "ceo-evidence-review-db.json"), "utf8")) as { rows: DbRow[] };
    const normU = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();
    /**
     * 🔴🔴 **같은 후보에 행이 여럿 있다**(실측 — `global.trenbe.com` 2행 중 **하나만** verdict 보유).
     *    1차 구현은 `new Map(...)` 이라 **마지막 행이 우연히** 이겼다 ⟹ 값이 있는 쪽을
     *    **결정적으로** 고른다. 안 그러면 verdict 를 가진 후보가 「DB 행 없음」으로 보인다.
     */
    const score = (r: DbRow) => (r.system_verdict ? 4 : 0) + (r.price_amount != null ? 2 : 0) + (r.blockers ? 1 : 0);
    const DB = new Map<string, DbRow>();
    for (const r of db.rows) {
      const k = normU(r.candidate_url);
      const cur = DB.get(k);
      if (!cur || score(r) > score(cur)) DB.set(k, r);
    }

    /** 🟢 상세설명 — **커밋된 산출물** 에서 읽는다(네트워크 0). */
    const old = readFileSync(join(DOCS, "core-desc-evidence-review.html"), "utf8");
    const DESC = new Map<string, { origin?: string | null; candidate?: string | null }>();
    for (const card of old.split('<section class="card">').slice(1)) {
      const id = (card.match(/class="cid">([^<]*)/) ?? [])[1];
      if (!id) continue;
      const got: { origin?: string | null; candidate?: string | null } = {};
      for (const m of card.matchAll(/<div class="desc( empty)?"><b>([^<]*)<\/b><p>([\s\S]*?)<\/p><\/div>/g)) {
        got[m[2].includes("원상품") ? "origin" : "candidate"] = m[1] ? null : unesc(m[3]).trim();
      }
      DESC.set(id, got);
    }
    expect(DESC.size, "🔴 기존 산출물에서 설명문을 읽지 못하면 이 화면이 성립하지 않는다").toBeGreaterThan(0);

    const pairs = SAME05_PAIRS.filter((p) => TARGET_IDS.includes(p.id));
    expect(pairs.length, "🔴 대상이 11이 아니면 기존 화면과 분모가 달라진다").toBe(TARGET_IDS.length);

    const tally = { originDesc: 0, candDesc: 0, dbRows: 0, dbVerdict: 0, originImgs: 0, candImgs: 0, reproduced: 0 };

    /** CPO §5 비교 표 + §3 전체 수집 항목 중 **데이터에 존재하는 것**. */
    const ROWS: {
      label: string; o: (c: Record<string, unknown>, f: ProductFacts) => unknown;
      n: (f: ProductFacts) => unknown; mono?: boolean; src: string; note?: string;
    }[] = [
      { label: "브랜드", o: (c) => V(c.brand), n: (f) => f.brand, src: "canonicalProduct.brand / facts.brand" },
      { label: "모델 코드 · 품번", o: (_c, f) => f.brandModelCode, n: (f) => f.brandModelCode, mono: true, src: "facts.brandModelCode" },
      { label: "모델명(저장분)", o: (c) => V(c.modelName), n: () => null, src: "canonicalProduct.modelName", note: "🔴 후보측 수집 칸이 없다" },
      { label: "판매처 SKU", o: (c) => V(c.sku), n: (f) => f.sellerSku, mono: true, src: "canonicalProduct.sku / facts.sellerSku", note: "🔴 matcher 가 읽지 않는다 — 보존만" },
      { label: "상품명 원문", o: (c) => V(c.title), n: (f) => f.title, src: "canonicalProduct.title / facts.title" },
      { label: "상품명 한글(저장분)", o: (c) => V(c.titleKo), n: () => null, src: "canonicalProduct.titleKo", note: "🔴 후보측 수집 칸이 없다" },
      { label: "정규화 상품명 토큰", o: (_c, f) => f.coreTitleTokens, n: (f) => f.coreTitleTokens, src: "facts.coreTitleTokens" },
      { label: "제조사", o: (c) => V(c.manufacturer), n: () => null, src: "canonicalProduct.manufacturer", note: "🔴 후보측 수집 칸이 없다" },
      { label: "수입사", o: (c) => V(c.importer), n: () => null, src: "canonicalProduct.importer", note: "🔴 후보측 수집 칸이 없다" },
      { label: "카테고리 · 상품 유형", o: (c, f) => f.categoryText ?? V(c.shopifyProductType), n: (f) => f.categoryText, src: "facts.categoryText / canonicalProduct.shopifyProductType" },
      { label: "색상", o: (c) => V(c.color), n: (f) => f.colorText, src: "canonicalProduct.color / facts.colorText" },
      { label: "소재", o: (c) => V(c.material), n: (f) => f.materialText, src: "canonicalProduct.material / facts.materialText", note: "🔴 Shopify 경로는 이 칸에 설명문 전문이 들어온다(ProductFacts 계약 B)" },
      { label: "핏 · 착용 형태", o: (_c, f) => f.fitText, n: (f) => f.fitText, src: "facts.fitText" },
      { label: "사이즈 라벨", o: (_c, f) => f.sizeLabels, n: (f) => f.sizeLabels, src: "facts.sizeLabels" },
      { label: "대상 연령", o: (c, f) => V(c.recommendedAge) || f.ageRangeText, n: (f) => f.ageRangeText, src: "canonicalProduct.recommendedAge / facts.ageRangeText" },
      { label: "대상 신호(breadcrumb·태그)", o: (_c, f) => f.audienceSignals, n: (f) => f.audienceSignals, src: "facts.audienceSignals" },
      { label: "옵션", o: (c) => V(c.options), n: () => null, src: "canonicalProduct.options", note: "🔴 후보측 수집 칸이 없다" },
      { label: "옵션 그룹 · 조합", o: (c) => c.optionGroups, n: () => null, src: "canonicalProduct.optionGroups" },
      { label: "재고 수량", o: (c) => V(c.stockQuantity), n: () => null, src: "canonicalProduct.stockQuantity" },
      { label: "원산지", o: (c) => V(c.countryOfOrigin), n: () => null, src: "canonicalProduct.countryOfOrigin" },
      { label: "취급 주의", o: (c) => V(c.careInstructions), n: () => null, src: "canonicalProduct.careInstructions" },
      { label: "인증(KC 등)", o: (c) => V(c.certification), n: () => null, src: "canonicalProduct.certification" },
      { label: "이미지 수", o: (c, f) => ((c.images as OriginImage[]) ?? []).length || f.imageUrls.length, n: (f) => f.imageUrls.length, mono: true, src: "canonicalProduct.images / facts.imageUrls" },
      { label: "URL slug", o: (_c, f) => f.urlSlug, n: (f) => f.urlSlug, mono: true, src: "facts.urlSlug" },
      { label: "수집 URL", o: (_c, f) => f.sourceUrl, n: (f) => f.sourceUrl, src: "facts.sourceUrl" },
    ];

    /** 🔴 **가격은 별도 영역** 이다 — 동일성 증거와 섞지 않는다(CPO §2 · §3-E). */
    const PRICE_ROWS: { label: string; o: (c: Record<string, unknown>) => unknown; d: (r: DbRow | null) => unknown }[] = [
      { label: "표시 가격", o: (c) => V(c.price), d: (r) => (r?.price_amount == null ? null : `${r.price_amount} ${r.price_currency ?? ""}`.trim()) },
      { label: "정상 가격", o: (c) => c.regularPrice, d: () => null },
      { label: "배송비", o: (c) => V(c.shippingFee), d: () => null },
      { label: "가격 구성", o: (c) => c.priceBreakdown, d: () => null },
      { label: "가격 유효성 · 검증 상태", o: (c) => c.priceValidity, d: (r) => r?.price_status ?? null },
      { label: "KRW 환산(저장분)", o: (c) => c.priceOverrideKrw, d: () => null },
      { label: "시장 · 출처 국가", o: () => null, d: (r) => r?.market ?? null },
      { label: "재고 · 품절", o: (c) => V(c.stockQuantity), d: (r) => (r?.sold_out == null ? null : String(r.sold_out)) },
      { label: "판매처 · 수집 경로", o: () => null, d: (r) => (r ? `${r.candidate_domain ?? ""} · ${r.source ?? ""}`.trim() : null) },
      { label: "수집 시점", o: () => null, d: (r) => (r ? `최초 ${r.first_seen_at} · 최근 ${r.last_seen_at}` : null) },
    ];

    const AXES: [string, string][] = [
      ["brand", "브랜드"], ["code", "모델 코드"], ["name", "상품명"], ["color", "색상"],
      ["material", "소재"], ["form", "디자인 · 형태"], ["size", "사이즈 · 핏"],
      ["audience", "대상 연령 · 성별"], ["set", "구성 · 옵션"], ["desc", "상세설명"],
    ];

    /** 🟢 이미지 — **저장된 URL 을 그대로 건다.** 🔴 바이트를 내려받지 않았다(추가 크롤링 0). */
    const imgStrip = (items: { url: string; cap: string }[], who: string): string => {
      if (!items.length) {
        return `<div class="imgs empty">🔴 ${esc(who)} 이미지 <b>미수집</b> — 「이미지가 없는 상품」이 아니라`
          + ` <b>우리가 저장하지 않은 것</b>일 수 있습니다.</div>`;
      }
      return `<div class="imgs"><div class="ih">${esc(who)} 이미지 <b>${items.length}</b>장</div><div class="strip">`
        + items.map((it, i) => `<figure><img src="${esc(it.url)}" referrerpolicy="no-referrer" loading="lazy" alt=""`
          + ` onerror="this.closest('figure').classList.add('fail')"><figcaption><b>${i + 1}</b>`
          + `<span class="cap">${esc(it.cap)}</span><span class="failmark">🔴 로드 실패</span>`
          + `<a href="${esc(it.url)}" target="_blank" rel="noreferrer">URL</a></figcaption></figure>`).join("")
        + "</div></div>";
    };

    const cards = pairs.map((p: Same05Pair) => {
      const cp = raw.origins[p.searchId]?.canonicalProduct ?? {};
      const d = DESC.get(p.id) ?? {};
      const dbr = DB.get(normU(p.url)) ?? null;
      if (d.origin) tally.originDesc += 1;
      if (d.candidate) tally.candDesc += 1;
      if (dbr) tally.dbRows += 1;
      if (dbr?.system_verdict) tally.dbVerdict += 1;

      const oImgsRaw = ((cp.images as OriginImage[]) ?? []);
      const oImgs = oImgsRaw
        .map((im) => ({
          url: String(im.cleanedUrl ?? im.originalUrl ?? ""),
          cap: [im.isRepresentative ? "대표" : null, im.useInDescription ? "상세설명" : null, im.classification ?? null]
            .filter(Boolean).join("·") || "—",
        }))
        .filter((x) => x.url);
      const cImgs = (p.facts.imageUrls ?? []).filter(Boolean).map((u, i) => ({ url: String(u), cap: i === 0 ? "대표" : "—" }));
      if (oImgs.length) tally.originImgs += 1;
      if (cImgs.length) tally.candImgs += 1;

      /** ⒝ 운영 판정 «재현» — 🔴 사슬 순서를 그대로 쓰는 기존 함수를 부른다. */
      const judged = same05Judge(p.origin, p.facts);
      tally.reproduced += 1;
      const blockers = (judged.cross.blockers ?? []).map((b) => String(b.blocker));
      const conflicts = (judged.cross.conflicts ?? []).map((x) => String(x.conflict));
      const reasons = (judged.cross.reasons ?? []).map((x) => String(x));

      const evRows = ROWS.map((r) => {
        const ov = r.o(cp, p.origin);
        const nv = r.n(p.facts);
        const [st, why] = cmp(ov, nv);
        return `<tr class="st-${st}"><th>${esc(r.label)}${r.note ? `<em>${esc(r.note)}</em>` : ""}</th>`
          + `<td${r.mono ? ' class="mono"' : ""}>${show(ov)}</td>`
          + `<td${r.mono ? ' class="mono"' : ""}>${show(nv)}</td>`
          + `<td class="st"><b>${st}</b><span>${esc(why)}</span></td>`
          + `<td class="src"><code>${esc(r.src)}</code></td></tr>`;
      }).join("");

      const descBlock = (text: string | null | undefined, who: string, url: string): string => (text
        ? `<details class="dsc" open><summary><b>${esc(who)} 상세설명 전문</b><span class="len">${text.length}자</span>`
          + `<a href="${esc(url)}" target="_blank" rel="noreferrer">출처 URL ↗</a></summary>`
          + `<div class="raw">${esc(text)}</div>`
          + `<p class="prov">수집 출처 — 기존 CORE-DESC-REVIEW 라이브 수집분을 <b>커밋된 산출물에서 그대로</b> 읽었습니다(재수집 0).</p></details>`
        : `<div class="dsc empty"><b>${esc(who)} 상세설명</b> — 🔴 <b>미수집</b>입니다.`
          + ` 「설명이 없는 상품」이 아니라 <b>우리가 읽지 못한 것</b>일 수 있습니다.`
          + ` <a href="${esc(url)}" target="_blank" rel="noreferrer">원문 열기 ↗</a></div>`);

      const dump = (title: string, obj: Record<string, unknown>): string =>
        `<details class="dump"><summary>${esc(title)} <em>전수 ${Object.keys(obj).length}칸</em></summary>`
        + `<table class="kv">${Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
          const val = V(v); const src = SRC(v);
          return `<tr${isEmpty(val) ? ' class="empty"' : ""}><th>${esc(k)}</th><td>${show(val)}</td>`
            + `<td class="src">${src ? `<code>${esc(src)}</code>` : "—"}</td></tr>`;
        }).join("")}</table></details>`;

      return `
<section class="card" data-id="${esc(p.id)}">
  <h2><span class="cid">${esc(p.id)}</span>${esc(host(p.url))}
    <span class="ids">원본 <code>${esc(p.searchId)}</code> · fixture <code>${esc(p.src)}</code></span></h2>
  <div class="links">
    <a href="${esc(p.origin.sourceUrl)}" target="_blank" rel="noreferrer">원본 상품 열기 ↗</a>
    <a href="${esc(p.url)}" target="_blank" rel="noreferrer">후보 상품 열기 ↗</a>
  </div>

  <div class="mi">
    <b>④ MI 판단 근거 — 🔴 아래 «수집 데이터» 와 분리해서 보십시오</b>
    <table class="kv2">
      <tr><th>이전 CEO 판정(기록)</th><td><b>${esc(p.human)}</b> <em>출처 ${esc(p.src)}</em></td></tr>
      <tr><th>DB 저장 MI 판정</th><td>${dbr
        ? `verdict <b>${show(dbr.system_verdict)}</b> · matchTruth ${show(dbr.match_truth)} · tier ${show(dbr.price_tier)}`
        : "🔴 <b>DB 행 없음</b> — 이 후보는 <code>candidate_reviews</code> 에 기록이 없습니다"}</td></tr>
      <tr><th>DB 저장 blocker</th><td>${dbr ? show(dbr.blockers) : NA}</td></tr>
      <tr class="rep"><th>운영 판정 «재현»</th><td>verdict <b>${esc(String(judged.cross.verdict))}</b>
        · 품번 비교 <code>${esc(judged.code)}</code> · matchTruth <code>${esc(judged.truth)}</code>
        · tier <code>${esc(String(judged.tier))}</code>
        <em>🔴 저장 facts 를 입력으로 운영 사슬(cross-seller → compareModelCode → deriveMatchTruth
        → priceTierFromLink)을 <b>다시 부른</b> 값입니다. 「그때의 운영 판정」이 아닙니다.</em></td></tr>
      <tr><th>blocker 전체(재현)</th><td>${show(blockers)}</td></tr>
      <tr><th>conflict 전체(재현)</th><td>${show(conflicts)}</td></tr>
      <tr><th>판단 사유(재현)</th><td>${show(reasons)}</td></tr>
      <tr><th>🔴 비교에 쓰이지 «못한» 항목</th><td>후보측 <b>제조사 · 수입사 · 모델명 · 옵션 · 재고 · 원산지 · 취급주의 · 인증</b>
        은 <b>수집 칸 자체가 없습니다</b>. 후보 <code>facts.description</code> · <code>facts.evidence</code> 는
        저장분이 <b>전건 비어</b> 있습니다(0/11) ⟹ MI 는 <b>상세설명을 보지 않았습니다</b>.</td></tr>
    </table>
  </div>

  <div class="sec"><h3>① 이미지 — 나란히 비교</h3>
    <div class="two">${imgStrip(oImgs, "원본 상품")}${imgStrip(cImgs, "후보 상품")}</div>
    <p class="hint">🔴 이미지는 <b>저장된 URL 을 그대로 건 것</b>입니다(바이트를 내려받지 않았습니다).
      판매처가 외부 연결을 막으면 「🔴 로드 실패」가 뜨고, 그때도 <b>URL 은 그대로 보입니다</b>.</p>
  </div>

  <div class="sec"><h3>② 증거 비교 — 수집값 그대로</h3>
    <table class="ev"><thead><tr><th>비교 항목</th><th>원본 상품</th><th>후보 상품</th>
      <th>값 대조<em>🔴 MI 판정이 아니라 «문자열» 대조입니다</em></th><th>근거 · 출처 칸</th></tr></thead>
      <tbody>${evRows}</tbody></table>
  </div>

  <div class="sec"><h3>③ 상세설명 — 전문</h3>
    ${descBlock(d.origin, "원본 상품", p.origin.sourceUrl)}
    ${descBlock(d.candidate, "후보 상품", p.url)}
    <div class="two">
      ${V(cp.descriptionKo)
        ? `<details class="dsc"><summary><b>원본 저장 번역문(descriptionKo)</b><span class="len">${String(V(cp.descriptionKo)).length}자</span></summary><div class="raw">${esc(V(cp.descriptionKo))}</div></details>`
        : '<div class="dsc empty"><b>원본 저장 번역문(descriptionKo)</b> — 🔴 미수집</div>'}
      ${V(cp.seoDescription)
        ? `<details class="dsc"><summary><b>원본 저장 요약문(seoDescription)</b><span class="len">${String(V(cp.seoDescription)).length}자</span></summary><div class="raw">${esc(V(cp.seoDescription))}</div></details>`
        : '<div class="dsc empty"><b>원본 저장 요약문(seoDescription)</b> — 🔴 미수집</div>'}
    </div>
    <p class="hint">🔴 <b>상세설명에서 자동으로 뽑은 속성은 저장분이 없습니다</b> —
      후보 <code>facts.evidence</code> <b>0/11</b> · <code>facts.description</code> <b>0/11</b>.
      🔴 상세설명 <b>이미지</b> · <b>HTML 원본</b> · <b>수집 시점</b>은 이 데이터에 <b>저장 칸이 없습니다</b>(확인 불가).
      🔴 번역되지 않은 문장을 <b>새로 번역하지 않았습니다</b>.</p>
  </div>

  <div class="sec"><h3>⑤ 가격 · 판매 정보 <em>🔴 참고 자료입니다 — 상품 동일성의 증거가 아닙니다</em></h3>
    <table class="ev price"><thead><tr><th>항목</th><th>원본 상품(저장분)</th><th>후보(candidate_reviews)</th></tr></thead>
      <tbody>${PRICE_ROWS.map((r) => `<tr><th>${esc(r.label)}</th><td>${show(r.o(cp))}</td><td>${show(r.d(dbr))}</td></tr>`).join("")}</tbody></table>
  </div>

  <div class="sec"><h3>⑥ 수집 전수 덤프 — 그대로</h3>
    ${dump("원본 상품 canonicalProduct", cp)}
    ${dump("후보 ProductFacts", p.facts as unknown as Record<string, unknown>)}
    ${dbr ? dump("후보 candidate_reviews 행", dbr as unknown as Record<string, unknown>)
      : '<div class="dsc empty">후보 <code>candidate_reviews</code> 행 — 🔴 <b>없음</b></div>'}
  </div>

  <form class="ask" data-case="${esc(p.id)}">
    <b>🟡 대표님 판단</b>
    <p class="hint">누르는 즉시 저장됩니다. 맨 아래에서 <b>JSON · CSV 로 내보내기</b> 하실 수 있습니다.</p>
    <fieldset class="final">
      <legend>이 후보는 원본 상품과 <b>같은 상품</b>입니까?</legend>
      <div class="opts big">${[["SAME", "같은 상품"], ["SIMILAR", "유사 상품"], ["DIFFERENT", "다른 상품"], ["UNDECIDED", "판단 보류"]]
        .map(([v, t]) => `<label><input type="radio" name="${esc(p.id)}__verdict" value="${esc(v)}"><span>${esc(t)}</span></label>`).join("")}</div>
      <div class="diff" data-diff="${esc(p.id)}"></div>
    </fieldset>
    <fieldset><legend>항목별 판단 <em>(판단하신 것만 — 비워 두셔도 됩니다)</em></legend>
      <table class="per">${AXES.map(([k, label]) => `<tr><th>${esc(label)}</th><td>${
        [["SAME", "같다"], ["DIFFERENT", "다르다"], ["UNKNOWN", "확인 불가"]]
          .map(([v, t]) => `<label><input type="radio" name="${esc(p.id)}__ax__${esc(k)}" value="${esc(v)}"><span>${esc(t)}</span></label>`).join("")
      }</td></tr>`).join("")}</table>
    </fieldset>
    <fieldset><legend>판단 사유 · 메모</legend>
      <div class="grab"><button type="button" class="btn" data-grab="${esc(p.id)}">선택한 문장 담기</button>
        <button type="button" class="btn ghost" data-clear="${esc(p.id)}">지우기</button></div>
      <textarea name="${esc(p.id)}__note" rows="3" placeholder="예) 상세설명에 품번 B226AC009 가 그대로 적혀 있다"></textarea>
    </fieldset>
  </form>
</section>`;
    }).join("\n");

    const CASES = pairs.map((p) => ({
      id: p.id, searchId: p.searchId, domain: p.domain, candidateUrl: p.url,
      originUrl: p.origin.sourceUrl, priorCeo: p.human,
      dbMi: DB.get(normU(p.url))?.system_verdict ?? null,
      reproduced: String(same05Judge(p.origin, p.facts).cross.verdict),
    }));

    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CEO Evidence Review — 전체 수집 데이터 · 상세설명 전문</title>
<style>
:root{--bg:#0f1115;--card:#171a21;--line:#2a2f3a;--tx:#e6e9ef;--dim:#9aa3b2;--ok:#36c08a;--bad:#e5645e;--warn:#e0a84e;--acc:#6ea8fe}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.65 -apple-system,"Segoe UI",system-ui,sans-serif}
header{padding:20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:#0f1115f2;backdrop-filter:blur(6px);z-index:20}
h1{margin:0 0 8px;font-size:19px}main{padding:20px;max-width:1500px;margin:0 auto}
.note{color:var(--dim);font-size:13px;margin:4px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 26px}
h2{margin:0 0 4px;font-size:17px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cid{background:var(--acc);color:#07101f;border-radius:6px;padding:2px 9px;font-size:13px;font-weight:700}
.ids{color:var(--dim);font-size:12px;font-weight:400}
.links{display:flex;gap:10px;margin:8px 0 14px}.links a{color:var(--acc);font-size:13px}
h3{font-size:14px;margin:0 0 10px;color:var(--dim)}
h3 em{color:var(--bad);font-style:normal;font-weight:400;font-size:12px;margin-left:6px}
.sec{margin:18px 0;padding-top:14px;border-top:1px solid var(--line)}
.mi{background:#121722;border:1px solid #2f3a4e;border-radius:9px;padding:12px;margin:10px 0}
.mi>b{display:block;margin-bottom:8px;font-size:13px}.mi tr.rep{background:#141b28}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid var(--line)}
th{color:var(--dim);font-weight:600;width:1%;white-space:nowrap}
th em,td em{display:block;color:var(--warn);font-weight:400;font-style:normal;font-size:11px;white-space:normal;max-width:560px}
.ev thead th{color:var(--tx);border-bottom:2px solid var(--line)}
.ev td:nth-child(2),.ev td:nth-child(3){width:28%}
.mono,code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
code{background:#0c0f14;border:1px solid var(--line);border-radius:4px;padding:1px 5px;word-break:break-all}
pre.j{margin:0;white-space:pre-wrap;word-break:break-all;background:#0c0f14;border:1px solid var(--line);border-radius:6px;padding:6px;font-size:11px;max-height:220px;overflow:auto}
.na{color:var(--dim);font-style:italic}
.st b{display:block;font-size:11px}.st span{color:var(--dim);font-size:11px}
.st-MATCH .st b{color:var(--ok)}.st-MISMATCH .st b{color:var(--bad)}.st-UNKNOWN .st b{color:var(--dim)}
td.src code{font-size:10px;color:var(--dim)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:1000px){.two{grid-template-columns:1fr}}
.imgs{background:#0c0f14;border:1px solid var(--line);border-radius:9px;padding:10px}
.imgs.empty{color:var(--warn);font-size:13px;background:#1b1612;border-color:#4a3a20;padding:12px;border-radius:9px}
.ih{font-size:12px;color:var(--dim);margin-bottom:8px}
.strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px}
figure{margin:0;flex:0 0 auto;width:136px}
figure img{width:136px;height:136px;object-fit:contain;background:#fff;border-radius:7px;display:block}
figcaption{font-size:10px;color:var(--dim);display:flex;gap:5px;align-items:center;margin-top:4px;flex-wrap:wrap}
figcaption a{color:var(--acc)}.failmark{display:none;color:var(--bad)}
figure.fail img{display:none}figure.fail .failmark{display:inline}
.dsc{background:#0c0f14;border:1px solid var(--line);border-radius:9px;padding:10px;margin:0 0 12px}
.dsc.empty{color:var(--warn);background:#1b1612;border-color:#4a3a20;font-size:13px}
.dsc summary{cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px}
.len{color:var(--dim);font-size:11px}.dsc summary a{color:var(--acc);font-size:11px}
.raw{margin-top:10px;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.75;background:#0a0d12;border:1px solid var(--line);border-radius:7px;padding:12px;max-height:460px;overflow:auto}
.prov{color:var(--dim);font-size:11px;margin:6px 0 0}
.dump{background:#0c0f14;border:1px solid var(--line);border-radius:9px;padding:10px;margin:0 0 10px}
.dump summary{cursor:pointer;font-size:13px}.dump em{color:var(--dim);font-style:normal;font-size:11px}
.kv th,.kv2 th{width:230px;white-space:normal}.kv tr.empty th,.kv tr.empty td{opacity:.55}
.hint{color:var(--dim);font-size:12px;margin:8px 0 0}
.ask{margin-top:18px;padding-top:14px;border-top:2px solid var(--acc)}
.ask>b{font-size:14px}fieldset{border:1px solid var(--line);border-radius:9px;margin:12px 0;padding:10px 12px}
legend{font-size:12px;color:var(--dim);padding:0 6px}legend em{font-style:normal}
.opts{display:flex;gap:8px;flex-wrap:wrap}.opts.big label{padding:9px 14px;font-size:14px}
.opts label,.per label{display:inline-flex;gap:6px;align-items:center;background:#0c0f14;border:1px solid var(--line);border-radius:7px;padding:6px 10px;cursor:pointer;font-size:12px}
.opts input:checked+span,.per input:checked+span{color:var(--ok);font-weight:700}
.per th{width:160px}.per td{display:flex;gap:6px;flex-wrap:wrap}
textarea{width:100%;background:#0c0f14;color:var(--tx);border:1px solid var(--line);border-radius:7px;padding:9px;font:13px/1.6 inherit}
.btn{background:var(--acc);color:#07101f;border:0;border-radius:7px;padding:7px 12px;font-weight:700;cursor:pointer;font-size:12px}
.btn.ghost{background:transparent;color:var(--dim);border:1px solid var(--line)}
.grab{display:flex;gap:8px;margin-bottom:8px}
.diff{margin-top:8px;font-size:12px;color:var(--warn)}
footer{position:sticky;bottom:0;background:#0f1115f2;backdrop-filter:blur(6px);border-top:1px solid var(--line);padding:14px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#out{display:none;white-space:pre-wrap;word-break:break-all;background:#0c0f14;border:1px solid var(--line);border-radius:7px;padding:10px;font-size:11px;max-height:260px;overflow:auto;width:100%}
#out.on{display:block}#said{color:var(--ok);font-size:12px}#done{color:var(--dim);font-size:12px}
</style></head><body>
<header>
  <h1>CEO Evidence Review — 전체 수집 데이터 · 상세설명 전문</h1>
  <p class="note">🔴 <b>수집되지 않은 값은 채우지 않았습니다</b> — <span class="na">미수집</span> 으로 표시됩니다.</p>
  <p class="note">🔴 <b>「값 대조」 열은 MI 판정이 아니라 «문자열» 대조</b>입니다 — 표기·번역 차이도 MISMATCH 로 나옵니다.
     MI 판단 근거는 각 카드의 <b>④</b> 에 따로 있습니다.</p>
  <p class="note">🔴 <b>추가 수집 · 추가 번역을 하지 않았습니다.</b> 상세설명은 기존 CORE-DESC-REVIEW 산출물에 저장된
     원문을 <b>그대로</b> 읽었고, 이미지는 <b>저장된 URL 을 그대로</b> 걸었습니다.</p>
  <p class="note">대상 <b>${pairs.length}쌍</b> · 원본 설명문 <b>${tally.originDesc}/${pairs.length}</b> ·
     후보 설명문 <b>${tally.candDesc}/${pairs.length}</b> · 원본 이미지 <b>${tally.originImgs}/${pairs.length}</b> ·
     후보 이미지 <b>${tally.candImgs}/${pairs.length}</b> ·
     <code>candidate_reviews</code> 행 <b>${tally.dbRows}/${pairs.length}</b>(verdict 보유 <b>${tally.dbVerdict}</b>) ·
     운영 판정 재현 <b>${tally.reproduced}/${pairs.length}</b></p>
</header>
<main>${cards}</main>
<footer>
  <button class="btn" id="json">JSON 내보내기</button>
  <button class="btn" id="csv">CSV 내보내기</button>
  <button class="btn ghost" id="show">화면에 보기</button>
  <span id="done"></span><span id="said"></span>
  <pre id="out"></pre>
</footer>
<script>
(function(){
  var KEY = "ceo-evidence-review-v1";
  var CASES = ${JSON.stringify(CASES)};
  var AXES = ${JSON.stringify(AXES.map(([k]) => k))};
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { store = {}; }

  function put(name, value){
    var parts = name.split("__");
    var id = parts[0];
    store[id] = store[id] || {};
    if (parts[1] === "ax") { store[id].axes = store[id].axes || {}; store[id].axes[parts[2]] = value; }
    else { store[id][parts[1]] = value; }
    localStorage.setItem(KEY, JSON.stringify(store));
    paint();
  }
  document.addEventListener("change", function(e){
    var t = e.target;
    if (t && (t.type === "radio" || t.tagName === "TEXTAREA")) put(t.name, t.value);
  });
  document.addEventListener("input", function(e){
    if (e.target && e.target.tagName === "TEXTAREA") put(e.target.name, e.target.value);
  });
  document.addEventListener("click", function(e){
    var g = e.target.getAttribute && e.target.getAttribute("data-grab");
    if (g){
      var sel = String(window.getSelection ? window.getSelection() : "");
      if (!sel) return;
      var ta = document.querySelector('textarea[name="' + g + '__note"]');
      ta.value = (ta.value ? ta.value + "\\n" : "") + sel.trim();
      put(ta.name, ta.value);
    }
    var c = e.target.getAttribute && e.target.getAttribute("data-clear");
    if (c){
      var t2 = document.querySelector('textarea[name="' + c + '__note"]');
      t2.value = ""; put(t2.name, "");
    }
  });

  function paint(){
    CASES.forEach(function(c){
      var s = store[c.id] || {};
      if (s.verdict){
        var r = document.querySelector('input[name="' + c.id + '__verdict"][value="' + s.verdict + '"]');
        if (r) r.checked = true;
      }
      if (s.axes){
        AXES.forEach(function(a){
          if (!s.axes[a]) return;
          var el = document.querySelector('input[name="' + c.id + '__ax__' + a + '"][value="' + s.axes[a] + '"]');
          if (el) el.checked = true;
        });
      }
      if (s.note){
        var ta = document.querySelector('textarea[name="' + c.id + '__note"]');
        if (ta && !ta.value) ta.value = s.note;
      }
      var box = document.querySelector('[data-diff="' + c.id + '"]');
      if (box){
        if (!s.verdict) { box.textContent = ""; }
        else {
          var bits = [];
          if (c.priorCeo && c.priorCeo !== s.verdict) bits.push("이전 CEO 판정 " + c.priorCeo + " 과 다릅니다");
          if (c.dbMi) { if (c.dbMi !== s.verdict) bits.push("DB 저장 MI 판정 " + c.dbMi + " 과 다릅니다"); }
          else { bits.push("DB 저장 MI 판정이 없어 비교할 수 없습니다"); }
          if (c.reproduced !== s.verdict) bits.push("운영 재현 판정 " + c.reproduced + " 과 다릅니다");
          box.textContent = bits.length ? "🔴 " + bits.join(" · ") : "🟢 모든 기존 판정과 같습니다";
        }
      }
    });
    var n = CASES.filter(function(c){ return (store[c.id] || {}).verdict; }).length;
    document.getElementById("done").textContent = "판단 " + n + " / " + CASES.length;
  }

  function jsonPayload(){
    return JSON.stringify({
      review: "CEO-EVIDENCE-REVIEW",
      cases: CASES.length,
      pairs: CASES.map(function(c){
        var s = store[c.id] || {};
        return { id: c.id, searchId: c.searchId, domain: c.domain,
                 originUrl: c.originUrl, candidateUrl: c.candidateUrl,
                 priorCeoVerdict: c.priorCeo, dbMiVerdict: c.dbMi, reproducedVerdict: c.reproduced,
                 ceoVerdict: s.verdict || null, ceoAxes: s.axes || {}, ceoNote: s.note || "" };
      })
    }, null, 2);
  }
  function csvPayload(){
    var cols = ["id","searchId","domain","originUrl","candidateUrl","priorCeoVerdict","dbMiVerdict","reproducedVerdict","ceoVerdict","ceoNote"];
    var head = cols.concat(AXES.map(function(a){ return "ax_" + a; })).join(",");
    var body = CASES.map(function(c){
      var s = store[c.id] || {}; var ax = s.axes || {};
      var row = [c.id,c.searchId,c.domain,c.originUrl,c.candidateUrl,c.priorCeo,c.dbMi || "",c.reproduced,s.verdict || "",(s.note || "").replace(/\\n/g," ")]
        .concat(AXES.map(function(a){ return ax[a] || ""; }));
      return row.map(function(v){ return '"' + String(v == null ? "" : v).replace(/"/g,'""') + '"'; }).join(",");
    }).join("\\n");
    return head + "\\n" + body;
  }
  function deliver(text, label){
    var said = document.getElementById("said");
    function fallback(){
      var pre = document.getElementById("out");
      pre.textContent = text; pre.classList.add("on");
      var r = document.createRange(); r.selectNodeContents(pre);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      said.textContent = "🟡 자동 복사가 막혔습니다 — 아래 블록이 선택돼 있으니 그대로 복사해 주십시오";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){ said.textContent = "🟢 " + label + " 복사했습니다"; }, fallback);
    } else { fallback(); }
  }
  document.getElementById("json").addEventListener("click", function(){ deliver(jsonPayload(), "JSON"); });
  document.getElementById("csv").addEventListener("click", function(){ deliver(csvPayload(), "CSV"); });
  document.getElementById("show").addEventListener("click", function(){
    var pre = document.getElementById("out"); pre.textContent = jsonPayload(); pre.classList.toggle("on");
  });
  paint();
})();
</script></body></html>`;

    writeFileSync(join(DOCS, "ceo-evidence-review.html"), html, "utf8");

    /* ═══════ 계약 — 화면이 지시서를 충족하는지 **기계로** 단언한다 ═══════════ */
    const N = pairs.length;
    /**
     * 🔴 상세설명 **전문** 이 들어 있어야 한다 — 요약으로 대체 금지(CPO §3-C).
     * 🔴 「상세설명 전문」이라는 **문구** 를 세면 `<title>`·`<h1>` 까지 걸린다
     *    (1차 단언이 23 ↔ 21 로 FAIL 했고 그것이 정확한 지적이었다) ⟹ **블록 마커** 로 센다.
     */
    expect(html.match(/<details class="dsc" open>/g)?.length, "🔴 펼쳐진 설명문 전문 블록 수")
      .toBe(tally.originDesc + tally.candDesc);
    expect(tally.originDesc, "🔴 원본 설명문이 하나도 없으면 이 화면이 성립하지 않는다").toBeGreaterThan(0);
    expect(tally.candDesc, "🔴 후보 설명문이 하나도 없으면 이 화면이 성립하지 않는다").toBeGreaterThan(0);
    /** 🔴 **MI 판정이 아니라는 것** 을 화면이 스스로 말해야 한다. */
    for (const must of ["MI 판정이 아니라", "참고 자료입니다", "수집되지 않은 값은 채우지 않았습니다", "재수집 0"]) {
      expect(html, `🔴 「${must}」 가 없으면 CEO 가 값 대조를 MI 판정으로 읽는다`).toContain(must);
    }
    /**
     * 🔴 CEO 4상태 — 사건당 라디오 4개.
     * 🔴 이름 패턴만 세면 **아래 스크립트의 선택자 문자열까지** 걸린다(1차 단언이 45 ↔ 44 로
     *    FAIL 했고 그것이 정확한 지적이었다) ⟹ **`<input` 태그에 붙여** 센다.
     */
    expect(html.match(/<input type="radio" name="[^"]+__verdict"/g)?.length, "🔴 최종 판단 선택지는 사건당 4개여야 한다").toBe(N * 4);
    /** 🔴 항목별 판단 — 사건당 10축 × 3상태. */
    expect(html.match(/<input type="radio" name="[^"]+__ax__/g)?.length, "🔴 항목별 판단 입력 수").toBe(N * AXES.length * 3);
    /** 🔴 사유 입력칸 · 문장 담기. */
    expect(html.match(/<textarea/g)?.length).toBe(N);
    expect(html.match(/data-grab="/g)?.length).toBe(N);
    /** 🔴 저장 · 내보내기가 없으면 CEO 입력이 갇힌다. */
    for (const must of ["localStorage.setItem", 'id="json"', 'id="csv"', 'id="out"', "jsonPayload", "csvPayload"]) {
      expect(html, `🔴 ${must} 가 없으면 입력이 보존·전달되지 않는다`).toContain(must);
    }
    /** 🔴 내보내기에 **식별자와 CEO 입력이 함께** 보존돼야 한다(CPO §7). */
    for (const must of ["originUrl", "candidateUrl", "ceoVerdict", "ceoAxes", "ceoNote", "searchId"]) {
      expect(html, `🔴 내보내기에 ${must} 가 빠지면 결과를 되짚을 수 없다`).toContain(must);
    }
    /** 🔴 CTO 가 CEO 판정을 **채우지 않았다** 는 것을 기계로 단언한다. */
    expect(html).not.toMatch(/"ceoVerdict"\s*:\s*"(SAME|SIMILAR|DIFFERENT|UNDECIDED)"/);
    /** 🔴 각 사건의 식별자가 입력 이름에 그대로 들어가야 답이 섞이지 않는다. */
    for (const p of pairs) expect(html).toContain(`name="${p.id}__verdict"`);
    /** 🔴 미수집 표시가 **실제로** 쓰여야 한다(빈 칸을 조용히 비우지 않았다). */
    expect(html).toContain("미수집");

    /**
     * 🔴🔴 **마크업 균형** — 문자열 계약만 두면 마크업이 깨져도 통과한다(WU-136 선례:
     *    JSX 가 깨져 빌드가 불가했는데 소스 문자열 계약은 **그 상태에서도 통과** 했다).
     *    ⟹ 여는 태그와 닫는 태그 수를 **같이** 단언한다.
     */
    const count = (re: RegExp) => html.match(re)?.length ?? 0;
    for (const [open, close, name] of [
      [/<details/g, /<\/details>/g, "details"],
      [/<section class="card"/g, /<\/section>/g, "section.card"],
      [/<form/g, /<\/form>/g, "form"],
      [/<tbody>/g, /<\/tbody>/g, "tbody"],
      [/<fieldset/g, /<\/fieldset>/g, "fieldset"],
    ] as [RegExp, RegExp, string][]) {
      expect(count(open), `🔴 ${name} 여닫음이 어긋나면 화면이 깨진 채로 통과한다`).toBe(count(close));
    }
    /** 🔴 **임베드 스크립트가 없으면 CEO 입력이 저장되지 않는다.** */
    const script = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(script, "🔴 스크립트 블록이 없으면 저장·내보내기가 동작하지 않는다").not.toBeNull();
    /** 🔴 `</script>` 가 문자열 안에 섞여 블록이 **일찍 닫히면** JS 가 조용히 죽는다. */
    expect(count(/<script>/g), "🔴 스크립트 블록은 하나여야 한다").toBe(1);
    expect(count(/<\/script>/g), "🔴 스크립트 블록이 일찍 닫히면 JS 가 죽는다").toBe(1);

    console.log(`\n  🟢 화면 생성 — docs/ceo-evidence-review.html (${(html.length / 1024).toFixed(0)}KB)`);
    console.log(`  대상 ${N}쌍 · 비교 항목 ${ROWS.length} · CEO 항목별 축 ${AXES.length}`);
    console.log(`  원본 설명문 ${tally.originDesc}/${N} · 후보 설명문 ${tally.candDesc}/${N}`);
    console.log(`  원본 이미지 ${tally.originImgs}/${N} · 후보 이미지 ${tally.candImgs}/${N}`);
    console.log(`  candidate_reviews ${tally.dbRows}/${N}(verdict ${tally.dbVerdict}) · 운영 재현 ${tally.reproduced}/${N}`);
    console.log("  🔴 네트워크 0 · DB 직접 접근 0 · 운영 변경 0");
  });
});
