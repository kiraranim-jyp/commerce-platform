/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-019A-SEARCH-ALT — **DuckDuckGo Discovery PoC** (API 0 · 비용 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본 SKIP(`MI_019A_ALT_LIVE=1`). AI API 0 · Gemini 0 · GPT 0 · 키 0 · 결제 0 ·
 *    UA 위장 0 · robots 우회 0 · CAPTCHA 0 · 운영 코드 변경 0 · DB 0 · UI 0 · 배포 0.
 * 🟡 쓰는 것: `html.duckduckgo.com` **상품당 1회** + 후보 페이지 GET.
 *
 * 🔴 **조건부 PoC 근거**(CPO 표현 그대로) — 「허용이 확인됐다」가 아니라
 *    「현재 확보한 1차자료상 자동 접근을 금지하는 조항을 확인하지 못했고 robots 는
 *     허용 상태이므로 제한된 PoC 를 진행할 근거가 있다」.
 *    실측: `html.duckduckgo.com/robots.txt` → `Allow: /` · DDG ToS 본문(8,394자)에
 *    automat/scrap/crawl/robot/bot/extract **0건**.
 * 🔴 차단/요청제한/추가 정책 신호가 보이면 **즉시 중단하고 기록** 한다.
 *
 * ── 🔴 새로 만들지 않은 것 (전부 기존 owner) ───────────────────────────────
 * ```
 * 검색어   `buildPrimaryQuery(identityFromDna(dna))`  ← 운영 Gemini 경로와 **같은 함수**
 * 후보필터 `extractCandidateUrlsFromAiAnswer`         ← WU-017-1
 * 사실수집 `factsFromProductUrl`                       ← WU-017-2 경로
 * 판정     `withConfidence`(원상품별 **배열 1회**)      ← 운영 판정기
 * 🔴 유일한 glue 는 「DDG HTML → URL 목록」 한 조각이고 **판정 규칙이 아니다.**
 * ```
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductIdentityDna } from "@commerce/shared";
import { productFactsFromIdentityDna } from "@commerce/shared";
import { buildPrimaryQuery } from "@commerce/crawler/src/discovery-core";
import {
  extractCandidateUrlsFromAiAnswer,
  factsFromProductUrl,
  withConfidence,
  type ComparisonCandidate,
} from "@commerce/crawler";
import { identityFromDna } from "../gemini-candidate-pool";

const LIVE = process.env.MI_019A_ALT_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** 🟢 WU-019A 의 원상품 6건 + 알려진 정답(known-positive) 7건. 🔴 정답 집합은 **하한** 이다. */
const TARGETS = [
  { id: "S1", prefix: "c0725ecc", known: ["bobochoses.com/products/b226ac010-booty-ghosts-t-shirt"] },
  { id: "S2", prefix: "cd93efd9", known: ["bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt"] },
  { id: "S3", prefix: "c5395889", known: ["bobochoses.com/products/b126ai018-curious-turnip-all-over-swim-cap"] },
  { id: "S4", prefix: "c27d4727", known: ["littleluna.co.kr/product/"] },
  { id: "S5", prefix: "32f7b651", known: ["foretforet.com/shop/shopdetail.html?branduid=10226592", "deuxbebe.com/product/detail.html?product_no=8021"] },
  { id: "S6", prefix: "278d4c38", known: ["bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket"] },
];

/**
 * 🔴 **glue 한 조각** — DDG 결과 HTML 에서 링크만 모은다. 판정하지 않는다.
 *    DDG html 엔드포인트는 결과를 `/l/?uddg=<encoded>` 로 감싸므로 그것을 풀어 준다.
 */
function urlsFromDdgHtml(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const raw = m[1];
    const hit = /[?&]uddg=([^&"]+)/.exec(raw);
    const u = hit ? decodeURIComponent(hit[1]) : raw.startsWith("http") ? raw : null;
    if (!u) continue;
    if (/duckduckgo\.com|duck\.co/i.test(u)) continue;
    out.push(u);
  }
  return [...new Set(out)];
}

const describeLive = LIVE ? describe : describe.skip;

describeLive("WU-019A-SEARCH-ALT — DDG Discovery PoC (상품당 1회)", () => {
  it(
    "DDG 가 MI 가 못 찾는 후보를 가져오는가",
    async () => {
      const casesPath = path.join(OUT_DIR, "mi-017-e2e-cases.json");
      if (!existsSync(casesPath)) throw new Error(`선행 덤프 없음: ${casesPath}`);
      const rows = JSON.parse(readFileSync(casesPath, "utf8")) as {
        id: string;
        source_url: string;
        canonical_product: Record<string, unknown>;
      }[];
      const byPrefix = new Map(rows.map((r) => [String(r.id).slice(0, 8), r]));

      const report: Record<string, unknown>[] = [];
      let ddgCalls = 0;
      let factsCalls = 0;

      for (const t of TARGETS) {
        const row = byPrefix.get(t.prefix);
        if (!row) throw new Error(`원상품 덤프 없음: ${t.prefix}`);
        const dna = buildProductIdentityDna(row.canonical_product as never);
        /* 🔴 운영 Gemini 경로와 **같은 함수** 로 검색어를 만든다(새 생성기 0). */
        const primary = buildPrimaryQuery(identityFromDna(dna));

        const rec: Record<string, unknown> = {
          searchId: t.id,
          sourceUrl: dna.sourceUrl,
          query: primary.text,
          queryLevel: primary.level,
        };
        if (!primary.text) {
          rec.ddg = "NO_PRIMARY_QUERY";
          report.push(rec);
          continue;
        }

        /* ── DDG 1회 ───────────────────────────────────────────────────── */
        let html: string | null = null;
        let status = 0;
        try {
          const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(primary.text)}`, {
            headers: { "User-Agent": UA, "Accept-Language": "en,ko" },
            signal: AbortSignal.timeout(20000),
          });
          ddgCalls += 1;
          status = res.status;
          html = res.ok ? await res.text() : null;
        } catch {
          ddgCalls += 1;
        }
        rec.ddgStatus = status;
        /** 🔴 차단 신호를 숨기지 않는다. */
        if (html && /anomaly|unusual traffic|captcha/i.test(html.slice(0, 4000))) rec.blockSignal = true;
        if (!html) {
          rec.ddg = "FETCH_FAILED";
          report.push(rec);
          continue;
        }

        const rawUrls = urlsFromDdgHtml(html);
        /* 🟢 필터는 017-1 그대로 — 목록/자기참조/중복/비상품을 이유와 함께 거른다. */
        const ex = extractCandidateUrlsFromAiAnswer(rawUrls.join("\n"), dna.sourceUrl);
        rec.ddgResultUrls = rawUrls.length;
        rec.productCandidates = ex.urls.length;
        rec.droppedReasons = ex.dropped.reduce<Record<string, number>>((a, d) => ({ ...a, [d.reason]: (a[d.reason] ?? 0) + 1 }), {});

        /* ── known-positive 발견 여부 ─────────────────────────────────── */
        const lower = ex.urls.map((u) => decodeURI(u).toLowerCase());
        rec.knownFound = t.known.filter((k) => lower.some((u) => u.includes(k.toLowerCase())));
        rec.knownMissed = t.known.filter((k) => !lower.some((u) => u.includes(k.toLowerCase())));

        /* ── 후보 검증 + MI 판정 (상한 6개 · 비용 통제) ─────────────── */
        const query = {
          title: dna.title.replace(/^\s*\[[^\]]*\]\s*/, "").trim(),
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          facts: productFactsFromIdentityDna(dna),
        };
        const cands: ComparisonCandidate[] = [];
        const factsFail: { url: string; status: string }[] = [];
        for (const u of ex.urls.slice(0, 6)) {
          try {
            const f = await factsFromProductUrl(u);
            factsCalls += f.httpCalls;
            if (f.status === "OK" && f.candidate) cands.push(f.candidate);
            else factsFail.push({ url: u, status: f.status });
          } catch {
            factsFail.push({ url: u, status: "UNREACHABLE" });
          }
        }
        const scored = cands.length ? withConfidence(query, cands) : [];
        rec.factsOk = cands.length;
        rec.factsFail = factsFail;
        rec.verified = scored.map((c) => ({
          url: c.url,
          title: c.title,
          mi: c.crossSellerVerdict ?? null,
          matchLevel: c.matchLevel ?? null,
          confidence: c.confidence,
          /** 🟢 GT 보조 — 원상품 품번이 후보 제목/URL 에 **그대로** 있는가. 🔴 없으면 **미검증** 이다. */
          skuInEvidence: query.sku
            ? `${c.title} ${c.url}`.toLowerCase().includes(query.sku.toLowerCase())
            : null,
        }));
        report.push(rec);
      }

      /* ── 보고: A(Discovery) / B(Identity) 를 **분리** 한다(CPO §6) ──── */
      console.log(`\n══ WU-019A-SEARCH-ALT  DDG calls ${ddgCalls} · 후보페이지 HTTP ${factsCalls}`);
      console.log(`\n── A. Discovery (DDG 가 어디까지 찾아왔는가)`);
      for (const r of report) {
        console.log(
          `  ${r.searchId} q="${String(r.query ?? "").slice(0, 46)}"(${r.queryLevel}) status=${r.ddgStatus ?? "-"} ` +
            `결과URL ${r.ddgResultUrls ?? "-"} → 상품후보 ${r.productCandidates ?? "-"} ` +
            `· known 발견 ${JSON.stringify(r.knownFound ?? [])} 미발견 ${JSON.stringify(r.knownMissed ?? [])}` +
            (r.blockSignal ? " 🔴 차단신호" : "") + (r.ddg ? ` 🔴 ${r.ddg}` : ""),
        );
        if (r.droppedReasons) console.log(`       거른 것 ${JSON.stringify(r.droppedReasons)}`);
      }
      console.log(`\n── B. Identity (찾아온 후보를 MI 가 어떻게 판단했는가)`);
      for (const r of report) {
        for (const v of (r.verified as Record<string, unknown>[] | undefined) ?? []) {
          console.log(
            `  ${r.searchId} ${String(v.mi ?? "(없음)").padEnd(14)} ${String(v.matchLevel).padEnd(10)} ${v.confidence} ` +
              `품번증거=${v.skuInEvidence} | ${String(v.title).slice(0, 38)} | ${String(v.url).slice(0, 64)}`,
          );
        }
        if ((r.factsFail as unknown[] | undefined)?.length) console.log(`       🔴 facts 실패 ${JSON.stringify(r.factsFail)}`);
      }
      const knownTotal = TARGETS.reduce((a, t) => a + t.known.length, 0);
      const knownFound = report.reduce((a, r) => a + ((r.knownFound as string[] | undefined)?.length ?? 0), 0);
      console.log(
        `\n  🔴 known-positive discovery rate ${knownFound}/${knownTotal} (sample 원상품 N=6)` +
          `\n  🔴 「Recall」로 적지 않는다 · 정답 집합은 **하한** 이다` +
          `\n  🔴 알려진 목록에 없는 후보는 **미검증 신규 후보** 이고 false positive 가 아니다`,
      );

      writeFileSync(path.join(OUT_DIR, "mi-019a-alt-ddg-result.json"), JSON.stringify({ report, ddgCalls, factsCalls, knownFound, knownTotal }, null, 2), "utf8");
      expect(ddgCalls).toBeLessThanOrEqual(TARGETS.length);
      expect(report).toHaveLength(TARGETS.length);
    },
    25 * 60 * 1000,
  );
});

describe("WU-019A-SEARCH-ALT 정의", () => {
  it("🔴 상품당 1회 · 원상품 6건 — 대량 검색을 하지 않는다", () => {
    expect(TARGETS).toHaveLength(6);
    expect(TARGETS.reduce((a, t) => a + t.known.length, 0)).toBe(7);
  });

  it("🔴 glue 는 링크 수집만 한다 — DDG 자체 링크를 후보로 올리지 않는다", () => {
    const urls = urlsFromDdgHtml(
      '<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbobochoses.com%2Fproducts%2Fx&rut=1">x</a>' +
        '<a href="https://duckduckgo.com/settings">s</a><a href="https://a.com/products/y">y</a>',
    );
    expect(urls).toEqual(["https://bobochoses.com/products/x", "https://a.com/products/y"]);
  });
});
