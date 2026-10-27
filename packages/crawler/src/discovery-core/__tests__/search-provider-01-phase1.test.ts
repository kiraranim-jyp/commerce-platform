import { describe, expect, it } from "vitest";
import {
  EXPERIMENT_CAPS,
  capCandidateUrls,
  checkSearchBudget,
  estimateGroundingCostUsd,
  summarizeLedger,
  type SearchUsageRow,
} from "../search-cost-ledger";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-01 PHASE 1 — **비용 측정 하니스**(라이브 게이트)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **Gemini 를 채택한 것이 아니다.** 이것은 **후보 Provider 실험** 이고, 목표는
 *    「상품 1개당 얼마가 드는가」를 **돈을 거의 쓰지 않고** 확정하는 것이다.
 *
 * ── 🔴 실행 조건 ────────────────────────────────────────────────────────────
 * ```
 * CORE_SEARCH_PROVIDER_LIVE=1  +  GEMINI_API_KEY
 * 🔴 기본은 **SKIP** 이다. flag 없이는 **호출이 구조적으로 불가능** 하다.
 * ```
 *
 * ── 🔴🔴 이 하니스가 지키는 것 ──────────────────────────────────────────────
 * ```
 * ① 상품당 API 호출 **1회**                      ② 우리 쿼리 **1개**
 * ③ 출력은 **URL 배열만**(판단·설명 금지)        ④ URL **상한으로 자른다**
 * ⑤ 🔴 **호출 «전» 에 예산 게이트** 를 통과해야 한다(사후 집계는 이미 늦다)
 * ⑥ 매 호출마다 **원장 1행** — 쿼리 수 · 토큰 · 추정 비용 · URL 수
 * ```
 *
 * 🔴 **Gemini 에게 판단을 시키지 않는다** — 동일상품 여부 · 가격 · 설명 전부 금지.
 *    그 뒤는 기존 pipeline(Crawl → Evidence → Identity → Price → MI)의 책임이다.
 */

const LIVE = process.env.CORE_SEARCH_PROVIDER_LIVE === "1";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

/** 🟢 PHASE 1 표본 — 이 저장소의 GT 에 **이미 있는** 실제 상품만 쓴다(새 상품 0). */
const SAMPLE: { productId: string; query: string }[] = [
  { productId: "B226AC010", query: '"Bobo Choses" "B226AC010" Booty Ghosts T-shirt' },
  { productId: "B226AC009", query: '"Bobo Choses" "B226AC009" Hug Hairy Monster T-shirt' },
  { productId: "AW26MS185", query: '"Main Story" "AW26MS185" Bubble Sweatshirt' },
];

/**
 * 🔴 **출력을 극단적으로 줄인다** — URL 배열 하나만 받는다.
 *    설명·판단·가격을 요구하면 출력 토큰과 내부 검색이 같이 늘어난다.
 */
const PROMPT = (query: string) =>
  `Search the web for pages selling this exact product and return ONLY the product detail page URLs.\n` +
  `Query: ${query}\n` +
  `Rules: return at most ${EXPERIMENT_CAPS.maxCandidateUrlsPerProduct} URLs. ` +
  `Do NOT judge whether products are the same. Do NOT include prices or explanations.\n` +
  `Respond with JSON only: {"candidateUrls":["https://..."]}`;

interface GeminiBody {
  candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { webSearchQueries?: string[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

function urlsFromText(raw: string): string[] {
  /** 🔴 JSON 이 깨져 와도 **지어내지 않는다** — 정규식으로 URL 만 건진다. */
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as { candidateUrls?: unknown };
      if (Array.isArray(parsed.candidateUrls)) return parsed.candidateUrls.map(String);
    }
  } catch {
    /* fallthrough */
  }
  return raw.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? [];
}

describe.skipIf(!LIVE)("DISCOVERY-SEARCH-PROVIDER-01 PHASE 1 — 단일 호출 비용 측정(라이브)", () => {
  it(
    "상품당 1회 호출로 Candidate URL 을 얻고 «실제 비용» 을 기록한다",
    async () => {
      const key = process.env.GEMINI_API_KEY?.trim();
      expect(key, "GEMINI_API_KEY 가 없다").toBeTruthy();

      const rows: SearchUsageRow[] = [];
      const blocked: string[] = [];
      let httpStatusSeen: number[] = [];

      for (const s of SAMPLE) {
        /** 🔴🔴 ⑤ — **호출 전** 게이트. 넘으면 **부르지 않는다**. */
        const gate = checkSearchBudget({
          groundingQueriesSoFar: rows.reduce((a, r) => a + r.searchQueries, 0),
          callsForThisProduct: rows.filter((r) => r.productId === s.productId).length,
        });
        if (!gate.allowed) {
          blocked.push(`${s.productId}: ${gate.reason}`);
          continue;
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: PROMPT(s.query) }] }],
              tools: [{ google_search: {} }],
              generationConfig: { temperature: 0 },
            }),
          },
        );
        httpStatusSeen.push(res.status);
        const text = await res.text();
        if (!res.ok) {
          /** 🔴 402 등은 **무과금** 이다 — 「실패」로 적고 추정 비용을 만들지 않는다. */
          console.log(`  🔴 ${s.productId} HTTP ${res.status} — ${text.slice(0, 160)}`);
          continue;
        }
        const body = JSON.parse(text) as GeminiBody;
        const wsq = body.candidates?.[0]?.groundingMetadata?.webSearchQueries ?? [];
        const out = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
        const urls = capCandidateUrls(urlsFromText(out));
        const usedBefore = rows.reduce((a, r) => a + r.searchQueries, 0);
        rows.push({
          productId: s.productId,
          query: s.query,
          apiCalls: 1,
          /** 🔴🔴 **과금 단위** — 우리 쿼리 1개여도 이 값은 1 이 아닐 수 있다. */
          searchQueries: wsq.length,
          searchQueryTexts: wsq,
          inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
          outputTokens:
            (body.usageMetadata?.candidatesTokenCount ?? 0) + (body.usageMetadata?.thoughtsTokenCount ?? 0),
          candidateUrlCount: urls.length,
          estimatedUsd: estimateGroundingCostUsd(usedBefore, wsq.length),
        });
        console.log(`  🟢 ${s.productId} · 검색쿼리 ${wsq.length} · URL ${urls.length}`);
        for (const u of urls) console.log(`      ${u}`);
        for (const q of wsq) console.log(`      [검색어] ${q}`);
      }

      const sum = summarizeLedger(rows);
      console.log(`\n${"═".repeat(96)}`);
      console.log("  [PHASE 1] 비용 원장 — 🔴 추정치다(ground truth 는 Billing)");
      console.log(`${"═".repeat(96)}`);
      console.log(`  상품 ${sum.products} · API 호출 ${sum.apiCalls} · **검색 쿼리 ${sum.searchQueries}**`);
      console.log(`  🔴 호출당 평균 검색 쿼리 **${sum.queriesPerCall}**  ← 「1 call = 1 query」가 아니다`);
      console.log(`  후보 URL ${sum.candidateUrls} · 추정 $${sum.estimatedUsd}`);
      if (blocked.length) console.log(`  🔴 예산 게이트가 막은 건 ${blocked.length}: ${blocked.join(" · ")}`);
      console.log(`  HTTP 상태 ${JSON.stringify(httpStatusSeen)}`);

      /** 🔴 호출이 **하나도 성공하지 않았으면** 그것은 측정불가다 — 성공으로 적지 않는다. */
      expect(rows.length, `호출 성공 0건(HTTP ${httpStatusSeen.join(",")}) — 측정불가`).toBeGreaterThan(0);
      /** 🔴 상한을 넘지 않았음을 **사후에도** 확인한다. */
      expect(sum.searchQueries).toBeLessThanOrEqual(EXPERIMENT_CAPS.maxGroundingQueriesPerRun);
      for (const r of rows) expect(r.apiCalls).toBe(1);
    },
    15 * 60 * 1000,
  );
});
