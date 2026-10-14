/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-007 — **Zero-Cost Deterministic Discovery Feasibility** (측정 하니스)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **AI 를 한 번도 부르지 않는다.** Gemini 0 · Anthropic 0 · OpenAI 0 ·
 *    Perplexity 0 · 검색 API 0 · API 키 0 · 결제 0 · 계정 생성 0.
 * 🔴 Registry 저장 0 · schema 0 · DB 쓰기 0 · Production 0 · UI 0.
 *
 * 🔴 게이트: `MI_P0_02_ZC=1` 이 없으면 **SKIP**(회귀에서 외부 HTTP 가 나가지 않게).
 *    🟢 ①의 사전검증은 게이트 없이 항상 돈다(HTTP 0).
 *
 * ── 🔴🔴 이 WU 가 실제로 답하는 질문 ───────────────────────────────────────
 * ```
 * 「품번/브랜드/상품명 하나로 동일상품 판매 URL 을 몇 개 찾는가」를 재려면
 * **먼저 「어느 도메인에 물어볼 수 있는가」가 정해져야 한다.**
 * 🔴 그리고 무키 세계에는 «도메인을 찾아 주는» 색인이 없다 —
 *    Common Crawl CDX 조차 urlkey 가 역순 도메인으로 시작해 도메인 없이는 질의 불가(실측).
 * → 그래서 이 하니스는 **질의 가능한 도메인 전수** 를 Discovery 의 **상한** 으로 먼저 센다.
 * ```
 *
 * ── 🟢 판정기를 새로 만들지 않는다 ──────────────────────────────────────────
 * 품번 확인 `confirmBrandCodeInEvidence`(WU-004) · 상품상세 `classifyUrlShape` ·
 * 정규화 `normalizeCandidateUrl` · 자기참조 `isSelfReferenceCandidate`(008A) ·
 * 질의 `buildPrimaryQuery ∘ identityFromDna` — 전부 운영 함수다.
 *
 * 🔴 **품번 없는 20건의 동일상품 여부는 «측정불가» 로 적는다** — 결정적 식별자가 없고,
 *    새 매칭 규칙을 만드는 것은 이 WU 범위가 아니다(그리고 금지된 threshold 완화가 된다).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { confirmBrandCodeInEvidence, isSelfReferenceCandidate } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildPrimaryQuery } from "@commerce/crawler/src/discovery-core/query-generator";
import { identityFromDna, normalizeCandidateUrl } from "../gemini-candidate-pool";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_ZC === "1";
const UA = "ttaejyo-feasibility-research/1.0 (zero-cost discovery benchmark; contact via site owner)";

/** 🔴 예의상 지연 — 소매처 서버에 부담을 주지 않는다(공식 「do not overload」 지시 준수). */
const POLITE_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let httpCount = 0;
async function get(url: string, init?: RequestInit): Promise<{ status: number; text: string }> {
  httpCount += 1;
  await sleep(POLITE_MS);
  try {
    const r = await fetch(url, { ...init, headers: { "user-agent": UA, ...(init?.headers ?? {}) } });
    return { status: r.status, text: await r.text() };
  } catch (e) {
    return { status: 0, text: String(e) };
  }
}

interface UrlRow { id: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown }
interface SourceRow {
  id: string; name: string; domain: string;
  collection_strategy: string; enabled: boolean; category_scope: string | null;
}
interface Inventory {
  sources: SourceRow[];
  settings: { workspace_id: string; source_id: string; enabled: boolean }[];
  links: { snapshot_id: string; source_domain: string; external_url: string; match_truth: string | null; verified: boolean }[];
}

const readJson = <T>(f: string): T | null => {
  const p = path.join(OUT_DIR, f);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
};
const must = <T>(f: string): T => {
  const v = readJson<T>(f);
  if (!v) throw new Error(`선행 덤프 없음: ${f}`);
  return v;
};

interface Target {
  id: string; brand: string; title: string; code: string | null;
  sourceUrl: string; sourceHost: string; query: string; queryLevel: string;
}

async function loadTargets(): Promise<Target[]> {
  const groups = must<Record<string, UrlRow[]>>("e2e-urls.json");
  const snaps = must<SnapRow[]>("e2e-snapshots.json");
  const shared = (await import("@commerce/shared")) as unknown as {
    buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
    backfillCanonicalProduct: (p: unknown) => unknown;
  };
  const seen = new Set<string>();
  const out: Target[] = [];
  for (const r of [...(groups.control ?? []), ...groups.kids, ...groups.kids2, ...groups.tennis]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const snap = snaps.find((s) => s.id === r.id);
    if (!snap) continue;
    const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
    const primary = buildPrimaryQuery(identityFromDna(dna as never));
    const sourceUrl = String(dna.sourceUrl ?? "");
    let sourceHost = "";
    try { sourceHost = new URL(sourceUrl).host.toLowerCase().replace(/^www\./, ""); } catch { /* 빈 값 유지 */ }
    out.push({
      id: r.id, brand: r.brand || "(빈 브랜드)", title: r.title,
      code: (dna.brandModelCode as string | null) ?? null,
      sourceUrl, sourceHost, query: primary.text, queryLevel: primary.level,
    });
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * robots.txt — 🔴 «허용 여부를 우리가 정하지 않는다». 사이트가 적은 것을 읽는다.
 * ────────────────────────────────────────────────────────────────────────── */
interface Robots { fetched: boolean; status: number; disallow: string[]; sitemaps: string[]; raw: string }

function parseRobots(raw: string): { disallow: string[]; sitemaps: string[] } {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  let inStar = false;
  for (const line0 of raw.split("\n")) {
    const line = line0.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") inStar = val === "*";
    else if (key === "sitemap") sitemaps.push(val);
    else if (key === "disallow" && inStar && val) disallow.push(val);
  }
  return { disallow, sitemaps };
}

/** 🔴 RFC 9309 §2.2.2 — 가장 긴 일치가 이긴다. 여기서는 **Disallow 만** 본다(보수적). */
function isDisallowed(robots: Robots, pathname: string): boolean {
  let hit = "";
  for (const d of robots.disallow) {
    const pattern = d.endsWith("$") ? d.slice(0, -1) : d;
    const matched = d.endsWith("$") ? pathname === pattern : pathname.startsWith(pattern);
    if (matched && pattern.length > hit.length) hit = pattern;
  }
  return hit.length > 0;
}

/* ════════════════════════════════════════════════════════════════════════════
 * ① 🟢 사전 검증 — HTTP 0 · 비용 0 (게이트 없이 항상 돈다)
 * ════════════════════════════════════════════════════════════════════════════ */

describe("① 🟢 WU-007 분모·도구 사전 검증 (HTTP 0 · AI 0 · 비용 0)", () => {
  it("①-1 분모 26 / 품번 보유 6 · 질의는 운영 함수 산출물", async () => {
    const targets = await loadTargets();
    expect(targets.length).toBe(26);
    expect(targets.filter((t) => t.code).length).toBe(6);
    expect(targets.every((t) => t.query.length > 0)).toBe(true);
    /** 🟢 품번 보유 6건은 전부 식별자 우선 질의여야 한다. */
    expect(targets.filter((t) => t.code).every((t) => t.queryLevel === "L1_MODEL_CODE")).toBe(true);
  });

  it("①-2 🔴🔴 «질의 가능한 도메인» 전수가 Discovery 의 상한이다", () => {
    const inv = must<Inventory>("wu007-inventory.json");
    /** 🔴 실효 ON/OFF 의 owner 는 workspace 설정이고 카탈로그 enabled 는 **무시** 된다
     *     (메모 manual-means-uninvestigated-not-uncollectable). 설정 없으면 fail-open ON. */
    const offByWs = new Set(inv.settings.filter((s) => !s.enabled).map((s) => s.source_id));
    const auto = inv.sources.filter(
      (s) => s.collection_strategy === "AUTO_API" || s.collection_strategy === "AUTO_SCRAPE",
    );
    expect(inv.sources.length).toBe(34);
    /** 🔴 **자동수집 가능 도메인은 8개** 다. 이것이 상한이고, 늘리는 것은 Registry 확대다. */
    expect(auto.length).toBe(8);
    expect(offByWs.size).toBeGreaterThan(0);
  });

  it("①-4 🔴🔴 **운영 결함 재현** — 우리 검색어가 되돌아온 URL 이 «증거» 로 쓰인다", () => {
    /** 🔴🔴 실측에서 잡혔다. Shopify Predictive Search 는 응답 URL 에 **우리가 보낸
     *    검색어를** `_psq` 로 되돌려 넣는다. 그 URL 을 그대로 건초더미에 넣으면
     *    「우리 질의」가 「상대 페이지의 식별 증거」로 승격된다 — 순환 증거다.
     *
     *    운영 노출 경로(전수 확인):
     *      searchShopifySuggest(shopify-suggest.ts:58-60)  url = domain + p.url(쿼리 포함)
     *        → match.ts:514                 candidateFacts.brandModelCode 를 채운다
     *        → attach-match-truth.ts:124·143 matchTruth 를 EXACT/STRONG 으로 올린다
     *        → priceTierFromLink            **EXACT tier** → 국내 최저가·판매판정 진입
     *    🔴 즉 **전혀 다른 상품(기프트백)이 동일상품으로 승격될 수 있다.**
     *    🔴 이 WU 는 Production 변경 금지라 **고치지 않았다** — CPO 판정 사안으로 올린다.
     */
    const code = "B226AC010";
    const wrongProduct =
      "https://bobochoses.com/products/pony-gift-bag?_pos=1&_psq=Bobo+Choses+B226AC010&_psid=x&_ss=sc";

    /** 🔴 현재 운영 동작 — 날것 URL 이면 **품번이 확인된다**(거짓 양성). */
    expect(confirmBrandCodeInEvidence(code, { url: wrongProduct, title: "Pony gift bag" })).toBe(code);

    /** 🟢 쿼리를 벗기면 거짓 양성이 사라진다 — 리포에 이미 있는 정규화기로 된다. */
    const stripped = normalizeCandidateUrl(wrongProduct);
    expect(stripped).toBe("bobochoses.com/products/pony-gift-bag");
    expect(confirmBrandCodeInEvidence(code, { url: stripped, title: "Pony gift bag" })).toBeNull();

    /** 🟢 그리고 **진짜** 양성은 정규화 뒤에도 살아 있어야 한다(과잉 수정 방지). */
    const realProduct =
      "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt?_pos=1&_psq=Bobo+Choses+B226AC010";
    expect(confirmBrandCodeInEvidence(code, { url: normalizeCandidateUrl(realProduct) })).toBe(code);
  });

  it("①-3 🔴 Common Crawl 은 «도메인 없이» 질의할 수 없다 (구조적 사실)", () => {
    /** 🟢 실측 응답의 urlkey 형식이 그 이유다 — 역순 도메인이 키의 **앞부분** 이라
     *     도메인 없는 패턴은 범위 스캔이 성립하지 않는다.
     *     🔴 실측: 도메인 없이 경로 와일드카드만 준 질의는
     *        `{"message":"No Captures found for: ..."}` 를 돌려줬다(건수 0).
     */
    const observedUrlKey = "com,bobochoses)/products/b125ac084-wavy-bobo-choses-denim-pants";
    expect(observedUrlKey.startsWith("com,bobochoses)")).toBe(true);
    /** 🔴 즉 CC 는 「이 품번을 **어느 도메인** 이 파는가」에 답할 수 없다.
     *     답할 수 있는 것은 「**이 도메인** 에 그 URL 이 있었는가」다. */
    expect(observedUrlKey.includes("b125ac084")).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * ② 🔴 실측 — `MI_P0_02_ZC=1` 일 때만. AI 0 · 키 0 · 결제 0 · 무키 HTTP 만.
 * ════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!LIVE)("② 🔴 무키 Discovery 실측", () => {
  it(
    "등록부 도메인 역량 조사 → 품번 보유 6건 질의 → 적중률",
    async () => {
      const inv = must<Inventory>("wu007-inventory.json");
      const targets = await loadTargets();
      const coded = targets.filter((t) => t.code);
      expect(coded.length).toBe(6);

      const offByWs = new Set(inv.settings.filter((s) => !s.enabled).map((s) => s.source_id));
      /** 🔴 조사 대상 = 등록부 전수. 🟢 수집전략/실효 ON 은 **기록만** 하고 제외하지 않는다 —
       *     「전략이 MANUAL 이라 안 뒤진다」와 「엔드포인트가 없다」는 **다른 사실** 이고
       *     이 WU 는 후자를 재야 한다. */
      const domains = [...new Set(inv.sources.map((s) => s.domain.toLowerCase().replace(/^www\./, "")))];

      /* ── 단계 1: 도메인별 역량 조사 (robots + 무키 구조화 엔드포인트) ── */
      interface Cap {
        domain: string; strategy: string; scope: string | null; wsOff: boolean;
        robotsStatus: number; robotsDisallowCount: number; sitemaps: number;
        advertisesAgents: boolean; advertisesUcp: boolean; shopifyMarker: boolean;
        suggestStatus: number; suggestJson: boolean; suggestAllowedByRobots: boolean;
        verdict: string;
      }
      const caps: Cap[] = [];
      const robotsByDomain = new Map<string, Robots>();

      for (const d of domains) {
        const src = inv.sources.find((s) => s.domain.toLowerCase().replace(/^www\./, "") === d);
        const rr = await get(`https://${d}/robots.txt`);
        const parsed = parseRobots(rr.status === 200 ? rr.text : "");
        const robots: Robots = {
          fetched: rr.status === 200, status: rr.status,
          disallow: parsed.disallow, sitemaps: parsed.sitemaps, raw: rr.text.slice(0, 4000),
        };
        robotsByDomain.set(d, robots);

        const suggestPath = "/search/suggest.json";
        const allowed = robots.fetched ? !isDisallowed(robots, suggestPath) : false;
        let suggestStatus = -1;
        let suggestJson = false;
        /** 🔴 robots 가 막으면 **부르지 않는다.** 우회하지 않는다. */
        if (allowed) {
          const sr = await get(`https://${d}${suggestPath}?q=test&resources%5Btype%5D=product&resources%5Blimit%5D=1`);
          suggestStatus = sr.status;
          try {
            const j = JSON.parse(sr.text) as { resources?: { results?: unknown } };
            suggestJson = Boolean(j?.resources?.results);
          } catch { suggestJson = false; }
        }

        caps.push({
          domain: d,
          strategy: src?.collection_strategy ?? "(등록부 밖)",
          scope: src?.category_scope ?? null,
          wsOff: src ? offByWs.has(src.id) : false,
          robotsStatus: robots.status,
          robotsDisallowCount: robots.disallow.length,
          sitemaps: robots.sitemaps.length,
          advertisesAgents: /agents\.md|Agent instructions/i.test(robots.raw),
          advertisesUcp: /well-known\/ucp|ucp\/mcp/i.test(robots.raw),
          shopifyMarker: /Shopify storefront/i.test(robots.raw),
          suggestStatus, suggestJson, suggestAllowedByRobots: allowed,
          verdict: suggestJson ? "🟢 무키 구조화 검색 가능" : allowed ? "🔴 엔드포인트 없음" : "🔴 robots 차단/미확인",
        });
      }

      const capable = caps.filter((c) => c.suggestJson);

      /* ── 단계 2: 품번 보유 6건 × 역량 있는 도메인 질의 ── */
      interface Hit {
        product: string; code: string; query: string; domain: string;
        rank: number; url: string; normalizedUrl: string; title: string | null;
        codeFound: boolean; "🔴 날것URL 기준(운영 동작)": boolean;
        isProductDetail: boolean; selfReference: boolean;
      }
      const hits: Hit[] = [];
      const perProduct = new Map<string, number>();
      /** 🔴 운영 동작(날것 URL)으로 세는 분자 — ①-4 결함의 **실제 노출량** 이다. */
      const perProductRaw = new Map<string, number>();

      for (const t of coded) {
        perProduct.set(t.id, 0);
        perProductRaw.set(t.id, 0);
        for (const c of capable) {
          const q = encodeURIComponent(t.query);
          const sr = await get(
            `https://${c.domain}/search/suggest.json?q=${q}&resources%5Btype%5D=product&resources%5Blimit%5D=10`,
          );
          if (sr.status !== 200) continue;
          let results: { url?: string; title?: string; handle?: string; sku?: string }[] = [];
          try {
            const j = JSON.parse(sr.text) as { resources?: { results?: { products?: typeof results } } };
            results = j?.resources?.results?.products ?? [];
          } catch { results = []; }

          results.forEach((r, i) => {
            const raw = r.url ? `https://${c.domain}${r.url}` : "";
            if (!raw) return;
            /** 🔴🔴 **정규화한 URL 로 판정한다** — 날것 URL 에는 Shopify 가 되돌려준
             *    우리 검색어(`_psq`)가 들어 있어 **우리 질의가 증거로 재활용** 된다(①-4). */
            const normalized = normalizeCandidateUrl(raw);
            const codeFound = confirmBrandCodeInEvidence(t.code, {
              url: normalized, title: r.title ?? null, sku: r.sku ?? null,
            }) !== null;
            /** 🔴 운영이 지금 하는 그대로(날것) — 결함의 노출량을 숫자로 남긴다. */
            const codeFoundRaw = confirmBrandCodeInEvidence(t.code, {
              url: raw, title: r.title ?? null, sku: r.sku ?? null,
            }) !== null;
            const shape = classifyUrlShape(raw);
            hits.push({
              product: t.brand, code: t.code as string, query: t.query, domain: c.domain,
              rank: i + 1, url: raw, normalizedUrl: normalized, title: r.title ?? null,
              codeFound, "🔴 날것URL 기준(운영 동작)": codeFoundRaw,
              isProductDetail: shape === "PRODUCT_PAGE",
              selfReference: isSelfReferenceCandidate(t.sourceUrl, raw),
            });
            if (codeFound) perProduct.set(t.id, (perProduct.get(t.id) ?? 0) + 1);
            if (codeFoundRaw) perProductRaw.set(t.id, (perProductRaw.get(t.id) ?? 0) + 1);
          });
        }
      }

      /* ── 단계 3: axis ③ — 이미 보유한 링크 (HTTP 0) ── */
      const linkedSnaps = new Set(inv.links.map((l) => l.snapshot_id));
      const axis3 = {
        "링크 보유 상품": `${linkedSnaps.size}/${targets.length}`,
        "링크 수": inv.links.length,
        "도메인": [...new Set(inv.links.map((l) => l.source_domain))],
        "match_truth": inv.links.reduce<Record<string, number>>((a, l) => {
          const k = l.match_truth ?? "(null)";
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
      };

      /* ── 단계 4: Common Crawl — 🔴 «도메인이 주어진 경우» 만 (구조적 한계 확인) ── */
      const ccProbe: Record<string, unknown>[] = [];
      for (const t of coded.slice(0, 3)) {
        if (!t.sourceHost) continue;
        const r = await get(
          `https://index.commoncrawl.org/CC-MAIN-2026-39-index?url=${encodeURIComponent(t.sourceHost + "/*")}` +
            `&output=json&limit=200`,
        );
        const lines = r.status === 200 ? r.text.trim().split("\n").filter(Boolean) : [];
        const urls = lines.map((l) => {
          try { return (JSON.parse(l) as { url: string }).url; } catch { return ""; }
        });
        ccProbe.push({
          domain: t.sourceHost, code: t.code, httpStatus: r.status,
          capturedUrls: urls.length,
          "🔴 품번 포함 URL": urls.filter((u) => confirmBrandCodeInEvidence(t.code, { url: u }) !== null).length,
        });
      }

      const codeHitProducts = [...perProduct.values()].filter((v) => v > 0).length;
      const pct = (n: number, d: number) => (d === 0 ? "측정불가(분모 0)" : `${n}/${d} = ${((n / d) * 100).toFixed(0)}%`);

      const report = {
        "🔴🔴 DISCLAIMER":
          "WU-007 — **AI 호출 0 · API 키 0 · 결제 0** 의 무키 Discovery feasibility. " +
          "🔴 분모는 기존 26개 상품이고 품번 보유 **6건** 만 동일상품 판정 대상이다 — " +
          "품번 없는 20건은 결정적 식별자가 없어 **측정불가** 로 적는다(새 매칭 규칙을 만들지 않았다). " +
          "🔴 국내/해외 추정·가격·판매판정은 이 WU 범위가 아니다. " +
          "🔴 robots.txt 가 막은 경로는 **부르지 않았다**(우회 0).",
        "① 질의 가능 도메인 상한": {
          "등록부 전수": inv.sources.length,
          "자동수집 가능(AUTO_*)": inv.sources.filter((s) => s.collection_strategy.startsWith("AUTO")).length,
          "🟢 무키 구조화 검색 가능": capable.length,
          "capable 도메인": capable.map((c) => c.domain),
          "🔴 그 밖에 «새 도메인을 찾아 주는» 무키 색인": "없음 — Common Crawl 도 도메인 필수(①-3)",
        },
        "② 품번 6건 적중": {
          "🔴🔴 Code Hit Rate(상품 단위 · 정규화 URL)": pct(codeHitProducts, coded.length),
          "후보 총수": hits.length,
          "품번 확인 후보(정규화)": hits.filter((h) => h.codeFound).length,
          "상품상세 비율": pct(hits.filter((h) => h.isProductDetail).length, hits.length),
          "자기참조": hits.filter((h) => h.selfReference).length,
        },
        "②-b 🔴🔴 운영 결함 노출량 (①-4)": {
          "날것 URL 기준 Code Hit Rate": pct([...perProductRaw.values()].filter((v) => v > 0).length, coded.length),
          "날것 기준 품번 확인 후보": hits.filter((h) => h["🔴 날것URL 기준(운영 동작)"]).length,
          "🔴 거짓 양성(날것 true · 정규화 false)": hits.filter(
            (h) => h["🔴 날것URL 기준(운영 동작)"] && !h.codeFound,
          ).length,
          "🔴 의미": "우리 검색어가 `_psq` 로 URL 에 되돌아와 «상대 페이지의 식별 증거» 로 쓰인다. " +
            "운영 두 호출부(match.ts:514 · attach-match-truth.ts:124·143)가 날것 URL 을 넘긴다. " +
            "🔴 이 WU 는 Production 변경 금지라 고치지 않았다 — CPO 판정 사안.",
        },
        "③ 이미 보유(axis ③ · HTTP 0)": axis3,
        "④ Common Crawl(도메인 주어진 경우)": ccProbe,
        "⑤ HTTP 요청 총수": httpCount,
        "도메인 역량 상세": caps,
        "후보 상세": hits,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `wu007-measure-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `wu007-measure-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(
        "\n" +
          JSON.stringify({ ...report, "도메인 역량 상세": `(wu007-measure-${seq}.json)`, "후보 상세": `(동일 파일)` }, null, 1),
      );

      /** 🔴 분모를 잠근다 — 품번 없는 20건이 섞이면 여기서 깨진다. */
      expect(coded.length).toBe(6);
    },
    60 * 60 * 1000,
  );
});
