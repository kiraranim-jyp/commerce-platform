import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isCrawlable, resolveCandidate, type PageProbe } from "@commerce/crawler/src/discovery-core";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-074 — **Product Evidence / soft-404 오염 전수 규명** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「원인 확정 → 전수검토 → 최적안 → 보고」까지. hard gate 즉시 구현 ❌ ·
 *    JSON-LD 필수화 ❌ · URL classifier 수정 ❌ · MI 완화 ❌ · 가격 parser ❌
 *
 * ── ① 코드 레벨 원인 (확정) ──────────────────────────────────────────────────
 * ```
 * ④ 의 게이트는 **둘뿐** 이다:
 *    ⒜ `fetchPlainHtml`(shopify-product-json.ts:602) — `!response.ok` 면 null
 *    ⒝ `product-url-facts.ts:226-228` — `<title>` 또는 `og:title` 이 있으면 **OK**
 * 🔴 그래서 「`/products/X` 를 요청했는데 **홈이 왔다**」를 구분할 방법이 **없다** —
 *    `fetchPlainHtml` 이 `response.url`(최종 도착지)을 **버린다**.
 * 🔴🔴 그리고 CEO 가 「404」라고 본 4건이 **전부 HTTP 200** 이다(실측) ⟹ 진짜 soft-404.
 * ```
 *
 * ── ②🟢🟢 방어는 **이미 구현돼 있다. 다만 이 경로에 배선되지 않았다** ───────────
 * ```
 * `resolveCandidate`(discovery-core/url-resolver.ts:78-101)
 *    ⒜ status 404|410            → NOT_FOUND
 *    ⒝ rel=canonical 이 다르면     → target 을 그쪽으로 옮긴다(CANONICALIZED)
 *    ⒞ 「모양은 상품인데 도착지가 상품이 아니면」 → **UNUSABLE**
 *  🟢 그 주석이 **`main-story.com` 을 실측 사례로 지명** 한다 — CEO 의 **S4-1** 이다.
 *
 * 🔴 배선 비대칭(전수 grep):
 *    Gemini 후보  gemini-candidate-pool.ts:290 → resolveCandidate 🟢 → :298 facts
 *    AI 후보      ai-answer-pool.ts:95         → factsFromProductUrl **직접** 🔴
 *    URL 후보     url-candidate-pool.ts:154    → factsFromProductUrl **직접** 🔴
 * ```
 *
 * ── ③🔴 **변이가 내 인과 설명을 정정했다** ──────────────────────────────────
 * ```
 * W1(도착지 모양 가드 `shape = "UNUSABLE"` 제거) 가 **통과** 했다.
 * 🔴 이유: 루트 URL 은 애초에 `PRODUCT_PAGE` 가 아니고 `isCrawlable` 이
 *    `classification === "PRODUCT_PAGE"` 를 요구하므로 **이미 막힌다.**
 *    ⟹ 실제로 막는 것은 그 줄이 아니라 **「최종 URL 의 모양을 본다」** 는 사실이다.
 * W4(canonical 분기 제거)도 통과 — 이 표본은 **리다이렉트만으로** 전건 루트에 닿는다.
 * W3(404 분기 제거)도 통과 — **전건 HTTP 200** 이라 그 분기가 애초에 안 쓰인다.
 * ```
 *
 * 🟢🟢 **그래서 최적안의 비용이 «0» 이다** — `fetchPlainHtml` 은 **이미 리다이렉트를
 *    따라간다**(`fetch` 기본값). `response.url` 을 **버리고 있을 뿐** 이다.
 *    ⟹ 추가 HTTP 0 · 추가 파서 0 · 새 규칙 0 (기존 `classifyUrlShape` 재사용).
 * 🔴 **그래도 고치지 않았다** — 판별 정책 변경이고 CPO 가 구현을 금지했다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-032-cache");
const NEW_GT = path.join(__dirname, "fixtures", "wu-068-new-gt.json");
const LIVE_F = path.join(OUT, "wu-074-live.json");
const RES_F = path.join(OUT, "wu-074-resolve.json");
const READY =
  existsSync(LIVE_F) && existsSync(RES_F) && existsSync(NEW_GT) && existsSync(path.join(OUT, "wu-036-3way.json"));
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

/** 🔴 「404 처럼 보이는 글자」 — 정상 상품 페이지에도 흔하다(아래에서 오탐이 측정된다). */
const SOFT_RE = /페이지를 찾을 수 없|존재하지 않는|404 Page Not Found|Page not found|찾으시는 페이지|삭제된 상품|Not Found|잘못된 접근/i;

type Sig = { ldProd: boolean; ldOffer: boolean; micro: number; ogProduct: boolean; soft: boolean; canonRoot: boolean };

function signals(html: string, url: string): Sig {
  const lds = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .join(" ");
  const canon = /rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1] ?? "";
  let canonRoot = false;
  try {
    const u = new URL(canon, url);
    canonRoot = u.pathname === "/" || u.pathname === "";
  } catch {
    /* canonical 이 없거나 깨졌다 — 신호 없음으로 둔다(「없음」을 「루트」로 읽지 않는다) */
  }
  return {
    ldProd: /"@type"\s*:\s*"?\[?[^\]"]*Product/i.test(lds),
    ldOffer: /"offers"/i.test(lds),
    micro: (html.match(/itemtype=["'][^"']*schema\.org\/Product/gi) ?? []).length,
    ogProduct: /product/i.test(/property=["']og:type["'][^>]+content=["']([^"']+)/i.exec(html)?.[1] ?? "-"),
    soft: SOFT_RE.test(html),
    canonRoot,
  };
}

describe("WU-074 — product evidence 판별축 (캐시 필요)", () => {
  (READY ? it : it.skip)("① 전수 분류 · ② 축별 차단/오차단 · ③ 최적안", () => {
    const nw = JSON.parse(readFileSync(NEW_GT, "utf8")) as { id: string; url: string; gt: string; why: string | null }[];
    const live = JSON.parse(readFileSync(LIVE_F, "utf8")) as Record<string, { httpStatus: number | null; html: string }>;
    const res = JSON.parse(readFileSync(RES_F, "utf8")) as Record<
      string,
      { url: string; crawlable: boolean; classification: string; steps: string[]; finalUrl: string }
    >;
    const g3 = (JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")) as { rows: { candidateUrl: string }[] }).rows;

    /** 🔴 **CEO 가 직접 적은 사유** 로만 비상품을 가른다 — CTO 가 라벨을 만들지 않았다. */
    const isNonProduct = (why: string | null) => /404|홈페이지/.test(String(why));

    const NON = nw.filter((r) => isNonProduct(r.why)).map((r) => ({ ...r, sig: signals(live[r.id].html, r.url), http: live[r.id].httpStatus }));
    const OK19 = nw.filter((r) => !isNonProduct(r.why)).map((r) => ({ ...r, sig: signals(live[r.id].html, r.url), http: live[r.id].httpStatus }));
    const OK51 = g3
      .map((r) => ({ url: r.candidateUrl, f: path.join(CACHE, `${key(r.candidateUrl)}.html`) }))
      .filter((r) => existsSync(r.f))
      .map((r) => ({ id: r.url, url: r.url, sig: signals(readFileSync(r.f, "utf8"), r.url), http: 200 as number | null }));
    const PROD = [...OK19, ...OK51];

    const rc = (u: string) => res[key(u)];
    const pct = (a: number, b: number) => `${String(a).padStart(2)}/${b} = ${((100 * a) / b).toFixed(1)}%`;

    /** 🔴 축 = 「이 술어가 참이면 **차단** 한다」. */
    const AXES: { name: string; block: (x: { sig: Sig; http: number | null; url: string }) => boolean }[] = [
      { name: "CF-6 현재 로직 유지(title 만)", block: () => false },
      { name: "CF-3 HTTP 404/410", block: (x) => x.http === 404 || x.http === 410 },
      { name: "CF-5 soft-404 «텍스트»", block: (x) => x.sig.soft },
      { name: "CF-1 JSON-LD Product 없음", block: (x) => !x.sig.ldProd },
      { name: "CF-2 구조화 Product + 가격 없음", block: (x) => !(x.sig.ldProd && x.sig.ldOffer) && !x.sig.micro },
      { name: "CF-2b og:type 이 product 아님", block: (x) => !x.sig.ogProduct },
      { name: "CF-4 canonical → 루트", block: (x) => x.sig.canonRoot },
      { name: "🟢 CF-7 resolveCandidate(운영)", block: (x) => rc(x.url) != null && !rc(x.url).crawlable },
      {
        /** 🟢🟢 **최소 축** — 최종 도착 URL 로 모양을 다시 본다(추가 HTTP 0). */
        name: "🟢 CF-8 최종 URL 모양 ≠ 상품",
        block: (x) => {
          const f = rc(x.url)?.finalUrl;
          return f != null && classifyUrlShape(f) !== "PRODUCT_PAGE";
        },
      },
    ];

    console.log(`\n════════ WU-074 축별 — 비상품 차단 vs 정상상품 오차단 ════════`);
    console.log(` 분모: 비상품 ${NON.length}(CEO 사유 라벨) · 정상상품 ${PROD.length}(CEO13 + WU-036 GT ${OK51.length})\n`);
    console.log(` 축                               비상품 차단       정상상품 오차단`);
    const table: Record<string, { blocked: number; falseBlock: number }> = {};
    for (const a of AXES) {
      const b = NON.filter(a.block).length;
      const fb = PROD.filter(a.block).length;
      table[a.name] = { blocked: b, falseBlock: fb };
      console.log(` ${a.name.padEnd(32)} ${pct(b, NON.length).padEnd(17)} ${pct(fb, PROD.length)}`);
    }

    console.log(`\n-- 비상품 6건 · 운영 resolveCandidate 판정 --`);
    for (const r of NON) {
      const k = rc(r.url);
      console.log(`  ${r.id.padEnd(5)} http=${String(r.http).padEnd(4)} ${String(k?.classification).padEnd(10)} steps=${(k?.steps ?? []).join(">")}  「${r.why}」`);
    }
    console.log(`\n-- 🔴 og:type 축이 오차단하는 정상상품(한국 쇼핑몰) --`);
    for (const r of PROD.filter((x) => !x.sig.ogProduct)) console.log(`     ${String(r.url).slice(0, 78)}`);
    console.log(`-- 🔴 구조화 축이 오차단하는 정상상품(WU-052/054 위험군) --`);
    for (const r of PROD.filter((x) => !(x.sig.ldProd && x.sig.ldOffer) && !x.sig.micro)) console.log(`     ${String(r.url).slice(0, 78)}`);

    writeFileSync(path.join(OUT, "wu-074.json"), JSON.stringify({ table, non: NON.length, prod: PROD.length }, null, 1));

    /* ══════════════════ 🔴 계약 ══════════════════ */

    /** ① 🔴🔴 **CEO 가 404 라고 본 것이 전부 HTTP 200 이다** — 진짜 soft-404. */
    expect(NON.filter((r) => /404/.test(String(r.why))).length).toBe(4);
    expect(NON.every((r) => r.http === 200)).toBe(true);
    /** ① 그래서 HTTP 상태 축은 **아무것도 막지 못한다**. */
    expect(table["CF-3 HTTP 404/410"]).toEqual({ blocked: 0, falseBlock: 0 });
    /** ① 현재 로직은 비상품을 **하나도** 막지 않는다(④ 통과율 100% 의 정체). */
    expect(table["CF-6 현재 로직 유지(title 만)"]).toEqual({ blocked: 0, falseBlock: 0 });

    /** ② 🔴 soft-404 **텍스트** 는 정상 상품에서 더 많이 터진다 — 채택 불가. */
    expect(table["CF-5 soft-404 «텍스트»"].falseBlock).toBeGreaterThan(table["CF-5 soft-404 «텍스트»"].blocked);

    /** ② 🔴 JSON-LD 필수화는 **정상 상품을 죽인다**(CPO 금지와 데이터가 일치). */
    expect(table["CF-1 JSON-LD Product 없음"].falseBlock).toBeGreaterThan(0);
    expect(table["CF-2 구조화 Product + 가격 없음"].falseBlock).toBeGreaterThan(0);
    /** ② 🔴 og:type 축은 **한국 쇼핑몰** 을 체계적으로 오차단한다. */
    expect(table["CF-2b og:type 이 product 아님"].falseBlock).toBeGreaterThan(0);

    /** ③ 🟢🟢 **기존 운영 함수가 완전 분리를 낸다** — 비상품 전건 차단 · 오차단 0. */
    expect(table["🟢 CF-7 resolveCandidate(운영)"].blocked).toBe(NON.length);
    expect(table["🟢 CF-7 resolveCandidate(운영)"].falseBlock).toBe(0);
    /** ③ 🔴 그런데 주 메커니즘은 canonical 이 **아니라 리다이렉트** 다(내 1차 가설 정정). */
    expect(NON.filter((r) => (rc(r.url)?.steps ?? []).includes("REDIRECTED")).length).toBe(6);
    expect(NON.filter((r) => (rc(r.url)?.steps ?? []).includes("CANONICALIZED")).length).toBe(1);
    /** ③ 🟢🟢 **최소 축도 같은 완전 분리를 낸다** — 그리고 추가 HTTP 가 0 이다. */
    expect(table["🟢 CF-8 최종 URL 모양 ≠ 상품"]).toEqual({ blocked: NON.length, falseBlock: 0 });
    /** ③ 🟢 정상 상품 64건은 전부 `PRODUCT_PAGE` 로 남는다. */
    expect(PROD.every((r) => rc(r.url)?.classification === "PRODUCT_PAGE")).toBe(true);
  });

  /**
   * 🔴🔴 **위 블록은 «캐시» 를 읽는다 — 그래서 `resolveCandidate` 를 고쳐도 안 깨진다.**
   *    WU-064 에서 똑같이 당했다(생산자가 아니라 산출을 단언했다). 그래서 아래는
   *    **운영 함수를 직접** 부른다 — 기록된 probe triple 을 재생하는 stub 으로.
   *    🟢 네트워크 0 · 비결정성 0 · 그리고 변이가 **실제로** 깨뜨린다.
   */
  it("🟢 생산자 계약 — resolveCandidate 를 직접 부른다(HTTP 0)", async () => {
    const nw = JSON.parse(readFileSync(NEW_GT, "utf8")) as { id: string; url: string; why: string | null }[];
    const rec = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "wu-074-probe.json"), "utf8")) as Record<
      string,
      { url: string; status: number; finalUrl: string; canonicalUrl: string | null }
    >;
    const probe: PageProbe = async (u) => {
      const hit = Object.values(rec).find((r) => r.url === u);
      if (!hit) throw new Error(`기록되지 않은 URL: ${u}`);
      return { status: hit.status, finalUrl: hit.finalUrl, canonicalUrl: hit.canonicalUrl };
    };

    let blocked = 0;
    let falseBlock = 0;
    for (const r of nw) {
      const resolved = await resolveCandidate(r.url, [], probe);
      const nonProduct = /404|홈페이지/.test(String(r.why));
      if (nonProduct && !isCrawlable(resolved)) blocked += 1;
      if (!nonProduct && !isCrawlable(resolved)) falseBlock += 1;
    }
    /** 🔴🔴 비상품 6건 전건 차단 · 정상 13건 오차단 0 — **운영 함수가 낸 값** 이다. */
    expect(blocked).toBe(6);
    expect(falseBlock).toBe(0);

    /** 🔴 축의 정체 — 「요청은 상품 URL 인데 **최종 도착지가 사이트 루트**」. */
    const rootBound = Object.values(rec).filter((r) => new URL(r.finalUrl).pathname === "/");
    expect(rootBound).toHaveLength(6);
    /** 🔴 HTTP 상태로는 하나도 가릴 수 없다 — 전건 200. */
    expect(Object.values(rec).every((r) => r.status === 200)).toBe(true);

    /**
     * 🔴🔴 **W1 이 통과한 이유를 계약으로 박는다** — 막는 것은 `UNUSABLE` 라인이
     *    아니라 **`isCrawlable` 이 요구하는 「최종 URL 모양 = PRODUCT_PAGE」** 다.
     *    요청 URL 의 모양은 **19건 전부 상품** 이다 — 거기서는 아무것도 못 가린다.
     */
    expect(nw.every((r) => classifyUrlShape(r.url) === "PRODUCT_PAGE")).toBe(true);
    expect(rootBound.every((r) => classifyUrlShape(r.finalUrl) !== "PRODUCT_PAGE")).toBe(true);
  });
});
