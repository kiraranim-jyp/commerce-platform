/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-006 — **Anthropic Web Research Controlled Benchmark** (하니스)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **키가 없으면 돌지 않는다.** `ANTHROPIC_API_KEY` **와** `MI_P0_02_ANTHROPIC=1`
 *    이 둘 다 있어야 호출한다. 그 전에는 **SKIP** 이다 — CPO 지시:
 *    「실제 키·계정·결제가 필요한 경우에는 실측 직전에 CEO에게 보고하고,
 *      임의로 결제하거나 계정을 만들지 않습니다」.
 *
 * 🔴 Gemini 호출 0 · Exa 0 · OpenAI 0 · Perplexity 0 · Registry 저장 0 ·
 *    가격 수집 0 · 판매판정 변경 0 · UI 0 · Production 0.
 *    결과는 **transient benchmark artifact**(JSON 파일) 로만 남는다.
 *
 * ── 🔴🔴 이 하니스의 핵심 설계 — CPO 가 승격한 원칙 하나 ───────────────────
 * ```
 * 「AI 가 만들어낸 URL 문자열을 그대로 믿지 않는다.
 *   URL 은 Discovery signal 이고, Evidence 는 따져가 직접 검증한다.」
 *
 * → 그래서 후보 URL 을 **Claude 의 산문/JSON 에서 읽지 않는다.**
 *   `web_search_tool_result` **블록** 에 실제로 들어온 검색결과에서만 뽑는다.
 *   🟢 그 성질을 ①-2 가 **음성 대조로** 잠근다(산문에 심은 URL 이 후보에 섞이면 FAIL).
 * ```
 *
 * ── 🟢 판정기를 새로 만들지 않는다 ──────────────────────────────────────────
 * ```
 * 품번 발견   confirmBrandCodeInEvidence   (WU-004 · 운영 함수 그대로)
 * 상품 상세   classifyUrlShape             (기존 함수)
 * URL 정규화  normalizeCandidateUrl        (기존 함수)
 * 자기참조    isSelfReferenceCandidate     (008A 정책 그대로)
 * 질의        buildPrimaryQuery ∘ identityFromDna  (운영 함수 · 변형 0)
 * 국내/해외   🔴 **추정** 이다 — TLD + 등록부. `classifyCandidateMarket`(WU-020)은
 *            **통화 증거** 를 요구하므로 가격 없는 Discovery 단계에서는 UNKNOWN 만 나온다.
 * ```
 *
 * ── 🟢 비용은 추정하지 않는다 ───────────────────────────────────────────────
 * ```
 * 과금 단위가 공식 문서로 확정돼 있다:
 *   web_search  → `usage.server_tool_use.web_search_requests` · **$10 / 1,000 searches**
 *                 「Each web search counts as one use, regardless of the number of
 *                  results returned. If an error occurs during web search, the web
 *                  search will not be billed.」
 *   web_fetch   → `usage.server_tool_use.web_fetch_requests` · **no additional cost**
 *                 (토큰만 든다)
 * → 🟢 그래서 **응답의 usage 실측값** 을 적는다. 🔴 원화 환산은 하지 않는다
 *   (환율·과금 원장은 CTO 가 읽을 수 없다 — 헌장 §5-B「측정불가」).
 * ```
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { confirmBrandCodeInEvidence, isSelfReferenceCandidate } from "@commerce/crawler";
/** 🔴 `classifyUrlShape`·`buildPrimaryQuery` 는 **루트에서 export 되지 않는다** —
 *    운영이 쓰는 경로를 그대로 쓴다(추측 금지). */
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildPrimaryQuery } from "@commerce/crawler/src/discovery-core/query-generator";
/** 🟢 DNA → ProductIdentity 변환도 **운영 함수** 를 쓴다 — 복제하지 않는다. */
import { identityFromDna, normalizeCandidateUrl } from "../gemini-candidate-pool";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY?.trim();
/** 🔴 **두 조건이 모두** 필요하다 — 키만 있어도 돌지 않는다(실수로 돈이 새지 않게). */
const LIVE = Boolean(ANTHROPIC_KEY) && process.env.MI_P0_02_ANTHROPIC === "1";

/* ──────────────────────────────────────────────────────────────────────────
 * 호출 상한 — 🔴 **코드에 박는다.** 추정하지 않고 상한으로 통제한다(헌장 §12 비용 4중).
 * ────────────────────────────────────────────────────────────────────────── */
const MODEL = process.env.MI_P0_02_ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
/** 상품 1건 = **요청 1건**. 재시도 0. */
const REQUESTS_PER_PRODUCT = 1;
/** 🔴 상품당 web_search 상한. 초과 시 Anthropic 이 `max_uses_exceeded` 로 막는다(공식). */
const MAX_SEARCHES_PER_PRODUCT = 3;
/** 🔴 상품당 web_fetch 상한. fetch 는 추가 과금이 없지만 **토큰** 이 든다. */
const MAX_FETCHES_PER_PRODUCT = 2;
/** 🔴 fetch 1건이 context 에 밀어넣는 토큰 상한(공식 파라미터). */
const MAX_CONTENT_TOKENS = 8_000;

interface UrlRow { id: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown }
interface SourceRow { domain: string; name: string }

const readJson = <T>(f: string): T | null => {
  const p = path.join(OUT_DIR, f);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
};
const must = <T>(f: string): T => {
  const v = readJson<T>(f);
  if (!v) throw new Error(`선행 덤프 없음: ${f}`);
  return v;
};

/** 🔴 국내/해외는 **추정** 이다(가격이 없어 통화 증거가 없다). 근거를 같이 남긴다. */
function guessMarket(domain: string, registry: Set<string>): { market: string; basis: string } {
  const d = domain.toLowerCase();
  if (d.endsWith(".kr") || d.includes(".co.kr")) return { market: "KR(추정)", basis: "TLD(.kr)" };
  if (registry.has(d)) return { market: "KR(추정)", basis: "국내 등록부 도메인" };
  if (/\.(jp|co\.jp|us|fr|de|uk|co\.uk|it|es|cn|hk|tw)$/.test(d)) return { market: "해외(추정)", basis: "국가 TLD" };
  return { market: "UNKNOWN", basis: "🔴 증거 없음 — 추측하지 않는다" };
}

interface Target {
  id: string;
  brand: string;
  title: string;
  code: string;
  sourceUrl: string;
  query: string;
  queryLevel: string;
}

/** 🟢 품번 보유 상품만 고른다 — 분모는 **6건** 이고 품번 없는 20건을 섞지 않는다(CPO). */
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
    const code = (dna.brandModelCode as string | null) ?? null;
    if (!code) continue;
    /** 🔴 **질의를 변형하지 않는다** — 운영 `buildPrimaryQuery` 산출물 그대로다(CPO). */
    const primary = buildPrimaryQuery(identityFromDna(dna as never));
    out.push({
      id: r.id,
      brand: r.brand || "(빈 브랜드)",
      title: r.title,
      code,
      sourceUrl: String(dna.sourceUrl ?? ""),
      query: primary.text,
      queryLevel: primary.level,
    });
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Research Prompt — 🔴 「판정하지 마라」가 들어간다. 동일상품 판정은 MI 가 한다.
 * ────────────────────────────────────────────────────────────────────────── */
function buildResearchPrompt(t: Target): string {
  return [
    `다음 상품과 **같은 상품** 을 파는 판매 페이지를 웹에서 찾아 주세요.`,
    ``,
    `검색어: ${t.query}`,
    `브랜드: ${t.brand}`,
    `모델/품번: ${t.code}`,
    ``,
    `규칙:`,
    `- **상품 상세 페이지** 만 찾습니다. 목록/검색결과/블로그/뉴스/SNS 는 제외합니다.`,
    `- 같은 상품인지 **판정하지 마십시오.** 판정은 저희 시스템이 합니다.`,
    `- 아래 페이지 자신(원본)은 제외합니다: ${t.sourceUrl || "(원본 URL 없음)"}`,
    `- 가격을 **환산하지 마십시오.** 페이지에 적힌 통화와 숫자를 그대로 적습니다.`,
    `- 찾은 페이지가 없으면 **없다고 답하고 지어내지 마십시오.**`,
    ``,
    `각 후보에 대해 적어 주세요: 판매처 이름 · 페이지 제목 · 페이지에 적힌 품번(있으면) ·`,
    `페이지에 적힌 가격과 통화(있으면).`,
  ].join("\n");
}

/* ──────────────────────────────────────────────────────────────────────────
 * 🔴🔴 URL 수확기 — **검색결과 블록에서만** 뽑는다
 * ────────────────────────────────────────────────────────────────────────── */
interface AnthropicBlock {
  type: string;
  text?: string;
  name?: string;
  input?: { query?: string; url?: string };
  content?: unknown;
}
interface AnthropicResponse {
  model?: string;
  stop_reason?: string;
  content?: AnthropicBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number };
  };
  error?: { type?: string; message?: string };
}

interface Harvest {
  /** 🟢 검색결과 블록에서 온 URL — **이것만** 후보가 된다 */
  searchResultUrls: { url: string; title: string | null; pageAge: string | null }[];
  /** 🟢 Claude 가 실제로 돌린 내부 검색어(= Gemini 의 groundingQueryTexts 대응) */
  searchQueries: string[];
  /** 🟢 실제로 fetch 한 URL */
  fetchedUrls: string[];
  /** 🔴 도구 오류 코드 — 「돌았다」와 「성공했다」를 가른다 */
  toolErrors: string[];
  /** 🔴 산문에만 등장한 URL — **후보로 쓰지 않고**, 몇 개였는지만 센다 */
  proseOnlyUrlCount: number;
  textLength: number;
}

function harvest(res: AnthropicResponse): Harvest {
  const searchResultUrls: Harvest["searchResultUrls"] = [];
  const searchQueries: string[] = [];
  const fetchedUrls: string[] = [];
  const toolErrors: string[] = [];
  let text = "";

  const walk = (blocks: AnthropicBlock[] | undefined): void => {
    for (const b of blocks ?? []) {
      if (b.type === "text" && typeof b.text === "string") text += `\n${b.text}`;
      if (b.type === "server_tool_use") {
        if (b.name === "web_search" && b.input?.query) searchQueries.push(b.input.query);
        if (b.name === "web_fetch" && b.input?.url) fetchedUrls.push(b.input.url);
      }
      if (b.type === "web_search_tool_result" || b.type === "web_fetch_tool_result") {
        const c = b.content;
        /** 🔴 오류는 **단일 객체** 로 온다(공식). 배열이면 결과다. */
        if (c && !Array.isArray(c)) {
          const obj = c as { type?: string; error_code?: string };
          if (obj.type?.endsWith("_error") && obj.error_code) toolErrors.push(obj.error_code);
        }
        if (Array.isArray(c)) {
          for (const r of c as { type?: string; url?: string; title?: string; page_age?: string }[]) {
            if (r.type === "web_search_result" && r.url) {
              searchResultUrls.push({ url: r.url, title: r.title ?? null, pageAge: r.page_age ?? null });
            }
          }
        }
        /** dynamic filtering 시 중첩 블록이 올 수 있다 — 같은 규칙으로 내려간다. */
        if (Array.isArray(c)) walk((c as AnthropicBlock[]).filter((x) => typeof x?.type === "string"));
      }
    }
  };
  walk(res.content);

  const fromResults = new Set(searchResultUrls.map((r) => r.url));
  const proseUrls = new Set((text.match(/https?:\/\/[^\s)<>"'\]]+/g) ?? []).map((u) => u.replace(/[.,;:]+$/, "")));
  let proseOnly = 0;
  for (const u of proseUrls) if (!fromResults.has(u)) proseOnly += 1;

  return { searchResultUrls, searchQueries, fetchedUrls, toolErrors, proseOnlyUrlCount: proseOnly, textLength: text.length };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 요청 본문 — 🟢 공식 문서 형식 그대로(버전 문자열·헤더 포함)
 * ────────────────────────────────────────────────────────────────────────── */
function buildRequestBody(t: Target): Record<string, unknown> {
  return {
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: buildResearchPrompt(t) }],
    tools: [
      /** 🔴 기본 버전으로 고정한다 — dynamic filtering 비교는 이 WU 범위가 아니다. */
      { type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES_PER_PRODUCT },
      {
        type: "web_fetch_20250910",
        name: "web_fetch",
        max_uses: MAX_FETCHES_PER_PRODUCT,
        max_content_tokens: MAX_CONTENT_TOKENS,
        citations: { enabled: true },
      },
    ],
  };
}

async function callAnthropic(body: Record<string, unknown>): Promise<{ res: AnthropicResponse; ms: number; status: number }> {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY as string,
      /** 🟢 공식 필수 헤더. 🔴 beta 헤더는 필요하지 않다(두 도구 모두 GA). */
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const res = (await r.json()) as AnthropicResponse;
  return { res, ms, status: r.status };
}

/* ════════════════════════════════════════════════════════════════════════════
 * ① 🟢 **키 없이 먼저 검증한다** — 돈을 쓰기 «전» 에 측정 로직이 맞는지 본다
 * ════════════════════════════════════════════════════════════════════════════ */

describe("① 🟢 측정 파이프라인 사전 검증 (호출 0 · 비용 $0)", () => {
  it("①-1 저장된 실제 후보 URL 로 판정기 전부가 기대대로 동작한다", async () => {
    const registry = new Set((readJson<SourceRow[]>("e2e-sources.json") ?? []).map((s) => s.domain.toLowerCase()));
    /** 🟢 선행 WU 가 저장한 **실제** 후보 URL 로 전 단계를 돌린다(WU-005 P1 과 동일 표본). */
    const samples = [
      { code: "B226AC010", url: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt", title: "Booty Ghosts T-shirt" },
      { code: "B226AC010", url: "https://global.trenbe.com/products/bobo-choses-kids-twin-ghost-long-sleeve-t-shirt-gray-b226ac010-041-160484656-p", title: "보보쇼즈" },
      { code: "B226AC010", url: "https://m.web.mustit.co.kr/v2/m/product/product_detail/126769866", title: "보보쇼즈 티셔츠" },
    ];
    const rows = samples.map((s) => ({
      url: s.url,
      normalized: normalizeCandidateUrl(s.url),
      shape: classifyUrlShape(s.url),
      codeFound: confirmBrandCodeInEvidence(s.code, { url: s.url, title: s.title }) !== null,
      market: guessMarket(new URL(s.url).host.replace(/^www\./, ""), registry),
      selfRef: isSelfReferenceCandidate("https://bobochoses.co.jp/products/b226ac117-x", s.url),
    }));

    /** 🔴 **기대값을 글자로 박는다** — 파이프라인이 조용히 바뀌면 여기서 깨진다. */
    expect(rows[0].codeFound).toBe(true);
    expect(rows[1].codeFound).toBe(true);
    expect(rows[2].codeFound).toBe(false); // mustit URL 에는 품번이 없다(실측)
    expect(rows[0].shape).toBe("PRODUCT_PAGE");
    expect(rows[1].market.market).toBe("UNKNOWN"); // 🔴 `.com` + 등록부 밖 → 추측하지 않는다
    expect(rows[2].market.market).toBe("KR(추정)");
    expect(rows.every((r) => r.selfRef === false)).toBe(true);

    const targets = await loadTargets();
    /** 🟢 분모가 **6건** 임을 잠근다 — 품번 없는 20건이 섞이면 여기서 깨진다. */
    expect(targets.length).toBe(6);
    expect(targets.every((t) => t.query.length > 0)).toBe(true);
    /** 🟢 6/6 이 식별자 우선 질의(L1)여야 한다 — WU-014 가 의도한 모양. */
    expect(targets.every((t) => t.queryLevel === "L1_MODEL_CODE")).toBe(true);

    writeFileSync(
      path.join(OUT_DIR, "p006-dryrun.json"),
      JSON.stringify({ rows, targets: targets.map((t) => ({ brand: t.brand, code: t.code, query: t.query, level: t.queryLevel })) }, null, 1),
      "utf8",
    );
    // eslint-disable-next-line no-console
    console.log("\n[WU-006 사전검증] 판정기 OK · 대상 6건\n" + targets.map((t) => `  ${t.brand} | ${t.code} | ${t.queryLevel} | "${t.query}"`).join("\n"));
  });

  it("①-2 🔴🔴 산문에만 있는 URL 은 후보가 되지 않는다 (CPO 승격 원칙의 음성 대조)", () => {
    /** 🟢 공식 문서의 응답 구조를 그대로 쓴 fixture 다. 🔴 호출 0.
     *  🔴 산문 블록에 **실재하지 않는 URL** 을 심었다 — 그것이 후보에 섞이면 FAIL 이다. */
    const fixture: AnthropicResponse = {
      model: "fixture-model",
      stop_reason: "end_turn",
      content: [
        { type: "text", text: "후보는 https://totally-made-up-shop.example/products/fake-9999 에 있습니다." },
        { type: "server_tool_use", name: "web_search", input: { query: "Bobo Choses B226AC010" } },
        {
          type: "web_search_tool_result",
          content: [
            { type: "web_search_result", url: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt", title: "Booty Ghosts T-shirt", page_age: "April 1, 2026" },
            { type: "web_search_result", url: "https://m.web.mustit.co.kr/v2/m/product/product_detail/126769866", title: "보보쇼즈 티셔츠" },
          ],
        },
        { type: "server_tool_use", name: "web_fetch", input: { url: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" } },
        { type: "web_fetch_tool_result", content: { type: "web_fetch_tool_result_error", error_code: "url_not_accessible" } },
      ],
      usage: { input_tokens: 1, output_tokens: 1, server_tool_use: { web_search_requests: 1, web_fetch_requests: 1 } },
    };

    const h = harvest(fixture);
    const urls = h.searchResultUrls.map((r) => r.url);

    /** 🟢 검색결과 블록의 URL 2개만 후보다. */
    expect(urls).toHaveLength(2);
    /** 🔴🔴 이것이 이 WU 의 핵심 단언 — **지어낸 URL 이 후보에 없다**. */
    expect(urls.some((u) => u.includes("totally-made-up-shop"))).toBe(false);
    /** 🟢 그러나 「몇 개가 산문에만 있었는가」는 **센다**(환각률 관측값). */
    expect(h.proseOnlyUrlCount).toBe(1);
    /** 🟢 내부 검색어와 fetch 대상도 포착된다. */
    expect(h.searchQueries).toEqual(["Bobo Choses B226AC010"]);
    expect(h.fetchedUrls).toEqual(["https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt"]);
    /** 🔴 「fetch 가 돌았다」와 「fetch 가 성공했다」를 가른다. */
    expect(h.toolErrors).toEqual(["url_not_accessible"]);
  });

  it("①-3 🔴 요청 본문이 상한을 코드로 들고 있다 (비용 통제)", async () => {
    const targets = await loadTargets();
    const body = buildRequestBody(targets[0]) as {
      tools: { type: string; name: string; max_uses?: number; allowed_domains?: string[]; blocked_domains?: string[] }[];
      messages: { content: string }[];
    };

    const search = body.tools.find((t) => t.name === "web_search");
    const fetchTool = body.tools.find((t) => t.name === "web_fetch");
    expect(search?.type).toBe("web_search_20250305");
    expect(fetchTool?.type).toBe("web_fetch_20250910");
    /** 🔴 상한이 **반드시** 실려야 한다 — 없으면 web_fetch 는 공식적으로 무제한이다. */
    expect(search?.max_uses).toBe(MAX_SEARCHES_PER_PRODUCT);
    expect(fetchTool?.max_uses).toBe(MAX_FETCHES_PER_PRODUCT);
    /** 🔴 `allowed_domains` 와 `blocked_domains` 를 **같이** 보내면 400 이다(공식). */
    for (const t of body.tools) expect(Boolean(t.allowed_domains) && Boolean(t.blocked_domains)).toBe(false);
    /** 🔴 프롬프트가 「판정하지 마라」·「환산하지 마라」를 들고 있어야 한다(역할 분리). */
    expect(body.messages[0].content).toMatch(/판정하지 마/);
    expect(body.messages[0].content).toMatch(/환산하지 마/);
    /** 🔴 상한 환산 — 6상품 × 3검색 = 최대 18 searches. 그 사실을 숫자로 잠근다. */
    expect(6 * REQUESTS_PER_PRODUCT).toBe(6);
    expect(6 * MAX_SEARCHES_PER_PRODUCT).toBe(18);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * ② 🔴 실측 — `ANTHROPIC_API_KEY` + `MI_P0_02_ANTHROPIC=1` 일 때만
 * ════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!LIVE)("② 🔴 Anthropic 실측 — 품번 보유 6건 · 상품당 1 요청", () => {
  it(
    "6 요청 (재시도 0 · 검색 상한 3 · fetch 상한 2)",
    async () => {
      const registry = new Set((readJson<SourceRow[]>("e2e-sources.json") ?? []).map((s) => s.domain.toLowerCase()));
      const targets = await loadTargets();
      expect(targets.length).toBe(6);

      /** 🟢 교차 provider 중복용 — 선행 WU 가 저장한 Gemini 후보 URL. 🔴 Gemini 호출 0. */
      const geminiUrls = new Set<string>();
      const acc = readJson<{ products: Record<string, unknown>[] }>("acc011-1.json");
      for (const p of acc?.products ?? []) {
        for (const j of ((p["판정"] as Record<string, unknown>[] | undefined) ?? [])) {
          if (j.url) geminiUrls.add(normalizeCandidateUrl(String(j.url)));
        }
      }
      const one = readJson<{ "⑥ 후보별": Record<string, unknown>[] }>("onecall023-1.json");
      for (const c of one?.["⑥ 후보별"] ?? []) if (c.url) geminiUrls.add(normalizeCandidateUrl(String(c.url)));

      const rows: Record<string, unknown>[] = [];
      let calls = 0;
      let searchRequests = 0;
      let fetchRequests = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let failures = 0;

      for (const t of targets) {
        const { res, ms, status } = await callAnthropic(buildRequestBody(t));
        calls += 1;

        /** 🔴 HTTP 오류는 **그대로 적는다**. 재시도하지 않는다(CPO: retry 0). */
        const httpFailed = status !== 200 || Boolean(res.error);
        if (httpFailed) failures += 1;

        const h = harvest(res);
        searchRequests += res.usage?.server_tool_use?.web_search_requests ?? 0;
        fetchRequests += res.usage?.server_tool_use?.web_fetch_requests ?? 0;
        inputTokens += res.usage?.input_tokens ?? 0;
        outputTokens += res.usage?.output_tokens ?? 0;

        /** 🟢 중복 URL 은 한 번만 센다(정규화 기준). */
        const seenNorm = new Set<string>();
        const cands: Record<string, unknown>[] = [];
        h.searchResultUrls.forEach((r, i) => {
          const norm = normalizeCandidateUrl(r.url);
          if (seenNorm.has(norm)) return;
          seenNorm.add(norm);
          const host = (() => {
            try {
              return new URL(r.url).host.toLowerCase().replace(/^www\./, "");
            } catch {
              return "(파싱 실패)";
            }
          })();
          const m = guessMarket(host, registry);
          const shape = classifyUrlShape(r.url);
          cands.push({
            rank: i + 1,
            rawUrl: r.url,
            normalizedUrl: norm,
            domain: host,
            shape,
            isProductDetail: shape === "PRODUCT_PAGE",
            "🔴 품번 발견": confirmBrandCodeInEvidence(t.code, { url: r.url, title: r.title }) !== null,
            confirmBrandCodeInEvidence: confirmBrandCodeInEvidence(t.code, { url: r.url, title: r.title }),
            market: m.market,
            marketBasis: m.basis,
            selfReference: isSelfReferenceCandidate(t.sourceUrl, r.url),
            pageAge: r.pageAge,
            title: r.title,
            "🟢 Gemini 와 중복": geminiUrls.has(norm),
            "🟢 AI 가 실제로 fetch 함": h.fetchedUrls.includes(r.url),
          });
        });

        rows.push({
          brand: t.brand,
          code: t.code,
          query: t.query,
          queryLevel: t.queryLevel,
          httpStatus: status,
          "🔴 error": res.error ?? null,
          resolvedModel: res.model ?? null,
          stopReason: res.stop_reason ?? null,
          latencyMs: ms,
          "🟢 web_search_requests(과금 단위)": res.usage?.server_tool_use?.web_search_requests ?? 0,
          "🟢 web_fetch_requests(과금 0 · 토큰만)": res.usage?.server_tool_use?.web_fetch_requests ?? 0,
          inputTokens: res.usage?.input_tokens ?? 0,
          outputTokens: res.usage?.output_tokens ?? 0,
          cacheReadTokens: res.usage?.cache_read_input_tokens ?? 0,
          "🟢 AI 내부 검색어": h.searchQueries,
          "🟢 AI 가 fetch 한 URL": h.fetchedUrls,
          "🔴 도구 오류": h.toolErrors,
          "🔴 산문에만 있던 URL 수(후보로 쓰지 않음)": h.proseOnlyUrlCount,
          resultCount: h.searchResultUrls.length,
          dedupedCandidateCount: cands.length,
          candidates: cands,
        });
      }

      /** ─────────── 측정 13개 (CPO 지정) ─────────── */
      const all = rows.flatMap((r) => r.candidates as Record<string, unknown>[]);
      const pct = (n: number, d: number) => (d === 0 ? "측정불가(분모 0)" : `${n}/${d} = ${((n / d) * 100).toFixed(0)}%`);
      const bestRank = (r: Record<string, unknown>) => {
        const hit = (r.candidates as Record<string, unknown>[]).find((c) => c["🔴 품번 발견"]);
        return hit ? Number(hit.rank) : null;
      };
      const ranks = rows.map(bestRank).filter((x): x is number => x != null);

      const kpi = {
        "①  Top-1 Hit(품번)": pct(ranks.filter((r) => r === 1).length, rows.length),
        "②  Top-3 Hit(품번)": pct(ranks.filter((r) => r <= 3).length, rows.length),
        "③  Top-10 Hit(품번)": pct(ranks.filter((r) => r <= 10).length, rows.length),
        "④  🔴🔴 Code Hit Rate(상품 단위)": pct(ranks.length, rows.length),
        "⑤  Product Detail Rate": pct(all.filter((c) => c.isProductDetail).length, all.length),
        "⑥  KR Candidate Rate(추정)": pct(all.filter((c) => String(c.market).startsWith("KR")).length, all.length),
        "⑦  Overseas Candidate Rate(추정)": pct(all.filter((c) => String(c.market).startsWith("해외")).length, all.length),
        "⑧  🔴 UNKNOWN market": pct(all.filter((c) => c.market === "UNKNOWN").length, all.length),
        "⑨  Self-reference Rate": pct(all.filter((c) => c.selfReference).length, all.length),
        "⑩  🟢 Gemini 와 URL 중복": pct(all.filter((c) => c["🟢 Gemini 와 중복"]).length, all.length),
        "⑪  호출 수 / 검색 수 / fetch 수": `calls ${calls} · web_search_requests ${searchRequests} · web_fetch_requests ${fetchRequests}`,
        "⑫  토큰(실측)": `input ${inputTokens} · output ${outputTokens}`,
        "⑬  🔴 실패율": pct(failures, rows.length),
        "— 보조: 상품당 후보 수": rows.length === 0 ? "측정불가" : (all.length / rows.length).toFixed(2),
        "— 보조: 산문에만 있던 URL 합계": rows.reduce((s, r) => s + Number(r["🔴 산문에만 있던 URL 수(후보로 쓰지 않음)"] ?? 0), 0),
        "— 보조: 도구 오류 합계": rows.flatMap((r) => r["🔴 도구 오류"] as string[]).length,
      };

      const report = {
        "🔴🔴 DISCLAIMER":
          "WU-006 — **Anthropic 단독** 실측. 🔴 Gemini·Exa·OpenAI·Perplexity 호출 0 · Registry 저장 0 · " +
          "가격 수집 0 · Production 0. 🔴 분모는 **품번 보유 6건** 이고 품번 없는 20건을 섞지 않았다. " +
          "🔴 국내/해외는 **추정** 이다(가격이 없어 통화 증거가 없다 — WU-020 분류기는 통화를 요구한다). " +
          "🔴🔴 후보 URL 은 `web_search_tool_result` **블록** 에서만 뽑았다 — Claude 의 산문에 있던 URL 은 " +
          "후보로 쓰지 않고 **개수만** 셌다(CPO 승격 원칙). " +
          "🔴 **AI 가 「같은 상품」이라고 말했는지는 KPI 가 아니다** — 동일상품 판정은 WU-004/020 계층이 한다. " +
          "🔴 과금액은 `web_search_requests` **실측값** 이고 원화 환산은 하지 않는다(공식 단가 $10/1,000 searches · " +
          "web_fetch 는 추가 과금 0 · 실패한 검색은 과금되지 않는다).",
        "모델(요청/응답)": `${MODEL} / ${rows[0]?.resolvedModel ?? "n/a"}`,
        "상한(코드)": `요청 ${REQUESTS_PER_PRODUCT}/상품 · web_search ${MAX_SEARCHES_PER_PRODUCT} · web_fetch ${MAX_FETCHES_PER_PRODUCT} · max_content_tokens ${MAX_CONTENT_TOKENS} · retry 0`,
        "측정 13": kpi,
        상세: rows,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `p006-anthropic-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `p006-anthropic-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, 상세: `(p006-anthropic-${seq}.json)` }, null, 1));

      /** 🔴 호출 수 상한을 **단언으로** 잠근다 — 초과하면 그 사실이 보고서에 남는다. */
      expect(calls).toBe(6);
      /** 🔴 과금 단위도 상한 안이어야 한다(6 × 3). */
      expect(searchRequests).toBeLessThanOrEqual(6 * MAX_SEARCHES_PER_PRODUCT);
    },
    30 * 60 * 1000,
  );
});
