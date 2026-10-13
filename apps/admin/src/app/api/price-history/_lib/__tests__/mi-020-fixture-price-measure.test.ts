/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-020 §10 — **실제 캡처 HTML 로 재는 측정** (추가 HTTP 0 · Gemini 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 「구조적으로 가능하다」를 「된다」로 쓰지 않는다. 그래서 리포에 **이미 있는
 *    실제 캡처 fixture** 로 JSON-LD 가격 추출을 돌려 숫자를 낸다 — 지시서 §10
 *    (「후보 HTML 이 이미 존재하는 fixture/dump 를 사용한다 · 실제 URL 재접속도
 *     원칙적으로 하지 않는다」)가 허용하는 유일한 측정 방법이다.
 *
 * 🔴 host 를 **파일명에서 추측하지 않는다** — fixture 안의 canonical/og:url 에서 읽는다.
 *    읽히지 않으면 그 건은 시장 분류에서 **제외** 한다(UNRESOLVED_HOST).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractFromJsonLd } from "@commerce/crawler";
import { classifyCandidateMarket } from "../candidate-market";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
/** 🔴 `__dirname` 은 `__tests__` 다 — 리포 루트까지 **여덟 칸** 이다(한 칸 모자라면 조용히 0건이 된다). */
const CRAWLER_SRC = path.join(__dirname, "../../../../../../../../packages/crawler/src");
const FIXTURE_DIRS = [
  path.join(CRAWLER_SRC, "__tests__/fixtures"),
  path.join(CRAWLER_SRC, "site-strategies/__tests__/fixtures"),
];

/** 🔴 국내 등록부 도메인 — 덤프가 있으면 그것을 쓰고, 없으면 분류를 하지 않는다. */
function registryDomains(): Set<string> | null {
  const p = path.join(OUT_DIR, "e2e-sources.json");
  if (!existsSync(p)) return null;
  const rows = JSON.parse(readFileSync(p, "utf8")) as { domain: string }[];
  return new Set(rows.map((r) => r.domain.trim().toLowerCase()));
}

const CANONICAL_RE = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i;
const OG_URL_RE = /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i;

function hostFromHtml(html: string): string | null {
  const raw = CANONICAL_RE.exec(html)?.[1] ?? OG_URL_RE.exec(html)?.[1] ?? null;
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** 🟢 운영 `priceFromJsonLd`(product-url-facts.ts)와 **같은 규칙** 이다. */
function priceOf(html: string): { amount: number; currency: string } | null {
  const price = extractFromJsonLd(html)?.price;
  if (!price) return null;
  if (!Number.isFinite(price.amount) || price.amount <= 0) return null;
  const currency = price.currency?.trim().toUpperCase();
  if (!currency) return null;
  return { amount: price.amount, currency };
}

describe("🔴 MI-020 측정 — 실제 캡처 HTML 에서 JSON-LD 가격이 나오는가 (HTTP 0)", () => {
  it("fixture 전수를 돌려 가격·통화·시장을 센다", () => {
    const registry = registryDomains();
    const rows: Record<string, unknown>[] = [];

    for (const dir of FIXTURE_DIRS) {
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
        const html = readFileSync(path.join(dir, file), "utf8");
        const price = priceOf(html);
        const host = hostFromHtml(html);
        const market =
          host === null
            ? { market: "—", basis: "UNRESOLVED_HOST" }
            : registry === null
              ? { market: "—", basis: "NO_REGISTRY_DUMP" }
              : classifyCandidateMarket({
                  domain: host,
                  currency: price?.currency ?? null,
                  isRegisteredDomesticShop: registry.has(host),
                });
        rows.push({
          fixture: file,
          host: host ?? "🔴 (읽지 못함)",
          "JSON-LD 가격": price ? `${price.amount} ${price.currency}` : "🔴 없음",
          "🔴 Source Market": market.market,
          분류근거: market.basis,
          "등록부 소속": host && registry ? registry.has(host) : null,
          bytes: html.length,
        });
      }
    }

    const priced = rows.filter((r) => r["JSON-LD 가격"] !== "🔴 없음");
    const report = {
      "🔴🔴 DISCLAIMER":
        "리포에 **이미 있는** 캡처 fixture 전수다. 🔴 추가 HTTP 0 · Gemini 0 · 실제 URL 재접속 0. " +
        "🔴 이 fixture 들은 다른 WU 가 다른 목적으로 캡처한 것이고 **Gemini 후보 표본이 아니다** — " +
        "비율을 Gemini 후보의 기대 성공률로 쓰지 않는다. 그리고 일부는 `-head.html`(head 만 캡처)이다.",
      "① 합계": {
        fixture: rows.length,
        "🟢 JSON-LD 가격 획득": priced.length,
        "🔴 미획득": rows.length - priced.length,
      },
      "② 통화 분포(획득분)": priced.reduce<Record<string, number>>((t, r) => {
        const cur = String(r["JSON-LD 가격"]).split(" ")[1] ?? "?";
        t[cur] = (t[cur] ?? 0) + 1;
        return t;
      }, {}),
      "③ 시장 분포(획득분)": priced.reduce<Record<string, number>>((t, r) => {
        const k = `${r["🔴 Source Market"]} / ${r.분류근거}`;
        t[k] = (t[k] ?? 0) + 1;
        return t;
      }, {}),
      fixtures: rows,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    let seq = 1;
    while (existsSync(path.join(OUT_DIR, `fx020-${seq}.json`))) seq += 1;
    writeFileSync(path.join(OUT_DIR, `fx020-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
    // eslint-disable-next-line no-console
    console.log("\n" + JSON.stringify(report, null, 1));

    expect(rows.length).toBeGreaterThan(0);
  });
});
