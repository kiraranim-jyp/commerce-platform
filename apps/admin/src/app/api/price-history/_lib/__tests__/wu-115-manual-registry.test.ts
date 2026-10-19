import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import {
  searchDomesticShops,
  withConfidence,
  isSelfReferenceCandidate,
  type ComparisonQuery,
} from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-115 — **국내 후보 공급 경로 조사 (`MANUAL` 등록부 전수)** · 측정 전용 · 구현 0
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 2026-10-19: 「`MANUAL` 등록부를 전수 조사한다. **가격은 완전 금지.**
 *    해외·⑧ 게이트·샵당 BEST·8축·threshold·품번 보호·AI API·기존 GT 재검토 전부 ❌」
 *
 * 🔴🔴 **실제는 12곳이 아니라 13곳이다**(DB 실측 2026-10-20) — 지시서/헌장의 「12」를 정정한다.
 *
 * ── 🔴 왜 「그냥 검색해 보기」가 아닌가 ─────────────────────────────────────
 * `MANUAL` 은 운영에서 **요청을 보내지 않는다**(`status: "unsupported"` · WU-092).
 * 그래서 공급 가능성을 재려면 **「AUTO_SCRAPE 였다면 기존 어댑터가 찾았을까」** 를 봐야 한다.
 * 🟢 이 하니스는 그 **반사실** 만 돌린다 — 🔴 **DB/Registry 를 바꾸지 않는다**(메모리 안에서만).
 *
 * ── 🔴 그리고 아무 샵이나 긁지 않는다 ──────────────────────────────────────
 * 헌장 메모 `portal-scraping-blocked-by-terms` — 「robots 허용 ≠ 약관 허용 · 자동수집은
 * 포털이 아니라 **판매처** 로 늘린다」. 🟢 그래서 ⒜ 포털/오픈마켓은 **제외로 분류** 하고
 * ⒝ 나머지는 **robots.txt 를 먼저 읽어** 허용 여부를 기록한 뒤에만 검색을 돌린다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const UA = "Mozilla/5.0 (compatible; TtaejyoBot/1.0)";

/** 🟢 DB 실측(`domestic_price_sources` · `collection_strategy='MANUAL'` · 전부 enabled). */
const MANUAL = [
  { domain: "29cm.co.kr", name: "29CM 키즈", kind: "PORTAL" },
  { domain: "chouchouenfant.kr", name: "CHOUCHOU ENFANT", kind: "SHOP" },
  { domain: "coconjennie.com", name: "COCO & JENNIE", kind: "SHOP" },
  { domain: "danawa.com", name: "다나와", kind: "PORTAL" },
  { domain: "karymarket.com", name: "KARYMARKET", kind: "SHOP" },
  { domain: "kidikidi.elandmall.co.kr", name: "키디키디", kind: "PORTAL" },
  { domain: "kream.co.kr", name: "kream", kind: "PORTAL" },
  { domain: "musinsa.com", name: "무신사 키즈", kind: "PORTAL" },
  { domain: "nokimore.com", name: "NOKIMORE", kind: "SHOP" },
  { domain: "ocokorea.com", name: "OCO(오씨오)", kind: "PORTAL" },
  { domain: "shoppinghow.kakao.com", name: "카카오 쇼핑하우", kind: "PORTAL" },
  { domain: "ssfshop.com", name: "SSF SHOP", kind: "PORTAL" },
  { domain: "wconcept.co.kr", name: "W컨셉", kind: "PORTAL" },
] as const;

const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

/** robots.txt 를 **읽기만** 한다 — 우리 UA 가 전면 차단인지 본다(`User-agent: *` 의 `Disallow: /`). */
async function robots(domain: string): Promise<{ http: number; blanketDisallow: boolean | null; raw: number }> {
  const r = await fetch(`https://${domain}/robots.txt`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(25000),
  }).catch(() => null);
  if (!r) return { http: 0, blanketDisallow: null, raw: 0 };
  if (!r.ok) return { http: r.status, blanketDisallow: null, raw: 0 };
  const txt = await r.text();
  /** 🔴 전체 파서를 만들지 않는다 — 「`*` 그룹에 `Disallow: /` 가 있는가」만 본다. */
  const lines = txt.split(/\r?\n/).map((l) => l.trim().toLowerCase());
  let inStar = false;
  let blanket = false;
  for (const l of lines) {
    if (l.startsWith("user-agent:")) inStar = l.slice(11).trim() === "*";
    else if (inStar && l.startsWith("disallow:") && l.slice(9).trim() === "/") blanket = true;
  }
  return { http: r.status, blanketDisallow: blanket, raw: txt.length };
}

describe("WU-115 — MANUAL 등록부 국내 공급 조사 (LIVE)", () => {
  (LIVE ? it : it.skip)(
    "13곳을 전수로 본다 (가격 0)",
    async () => {
      /* ── STEP 1-a. robots 먼저 ── */
      const rb: Record<string, { http: number; blanketDisallow: boolean | null; raw: number }> = {};
      for (const m of MANUAL) {
        rb[m.domain] = await robots(m.domain);
        // eslint-disable-next-line no-console
        console.log(
          `  robots ${m.domain.padEnd(26)} HTTP ${String(rb[m.domain].http).padEnd(4)}` +
            ` 전면차단=${String(rb[m.domain].blanketDisallow)} (${rb[m.domain].raw}B) [${m.kind}]`,
        );
      }

      /**
       * 🔴 검색을 돌릴 대상은 **판매처(SHOP)이고 robots 전면차단이 아닌 곳** 뿐이다.
       * 🔴 포털/오픈마켓은 **검색하지 않는다**(약관 · 헌장 메모) — 「제외」로 기록한다.
       */
      const probeTargets = MANUAL.filter((m) => m.kind === "SHOP" && rb[m.domain].blanketDisallow !== true);
      // eslint-disable-next-line no-console
      console.log(
        `\n  검색 대상 **${probeTargets.length}**곳 (판매처 ${MANUAL.filter((m) => m.kind === "SHOP").length} ·` +
          ` 포털 제외 ${MANUAL.filter((m) => m.kind === "PORTAL").length} ·` +
          ` robots 전면차단 제외 ${MANUAL.filter((m) => m.kind === "SHOP" && rb[m.domain].blanketDisallow === true).length})`,
      );

      const out: Record<string, unknown>[] = [];
      for (const c of CASES) {
        const of_ = await factsFromProductUrl(c.origin);
        const q = {
          title: of_.candidate!.title,
          sourceUrl: of_.crawlerUrl!,
          facts: of_.candidate!.facts,
        } as ComparisonQuery;

        /** 🔴 **반사실** — 메모리 안에서만 AUTO_SCRAPE 로 세운다(DB 변경 0). */
        const shops = probeTargets.map((m, i) => ({
          id: `wu115-${i}`,
          name: m.name,
          domain: m.domain,
          currency: "KRW",
          collectionStrategy: "AUTO_SCRAPE" as const,
        }));
        const results = await searchDomesticShops(q, shops);

        const rows: Record<string, unknown>[] = [];
        for (const r of results) {
          const notSelf = (r.candidates ?? []).filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url));
          const scored = withConfidence(q, notSelf);
          for (const x of scored)
            rows.push({
              domain: r.domain,
              url: x.url,
              title: x.title ?? null,
              urlShape: classifyUrlShape(x.url),
              /** 🔴 품번/상품명 기준 「후보 발견」 여부 — 가격은 **수집하지 않는다**. */
              codeInUrlOrTitle:
                `${x.url} ${x.title ?? ""}`.toUpperCase().includes(c.code) || false,
              verdict: (x as { crossSellerVerdict?: string | null }).crossSellerVerdict ?? null,
              matchLevel: x.matchLevel ?? null,
              modelCode: x.facts?.brandModelCode ?? null,
            });
        }

        // eslint-disable-next-line no-console
        console.log(`\n════ ${c.sid} / ${c.code} ════`);
        for (const r of results)
          // eslint-disable-next-line no-console
          console.log(
            `   ${r.domain.padEnd(22)} ${String(r.status).padEnd(12)} 후보 ${(r.candidates?.length ?? 0)}건 ${r.error ?? ""}`,
          );
        // eslint-disable-next-line no-console
        console.log(
          `   ⟹ 후보 **${rows.length}** · 품번/상품명 일치 **${rows.filter((x) => x.codeInUrlOrTitle).length}** ·` +
            ` 상품페이지 ${rows.filter((x) => x.urlShape === "PRODUCT_PAGE").length}`,
        );
        for (const x of rows.slice(0, 12))
          // eslint-disable-next-line no-console
          console.log(
            `     ${String(x.domain).padEnd(20)} ${String(x.urlShape).padEnd(14)} v=${String(x.verdict).padEnd(14)}` +
              ` code=${String(x.modelCode).padEnd(11)} ${String(x.title).slice(0, 40)}`,
          );

        out.push({ sid: c.sid, code: c.code, shopStatus: results.map((r) => ({ domain: r.domain, status: r.status, n: r.candidates?.length ?? 0, error: r.error ?? null })), candidates: rows });
      }

      writeFileSync(path.join(OUT, "wu-115.json"), JSON.stringify({ robots: rb, manual: MANUAL, out }, null, 1));
      expect(out).toHaveLength(2);
    },
    3_600_000,
  );
});
