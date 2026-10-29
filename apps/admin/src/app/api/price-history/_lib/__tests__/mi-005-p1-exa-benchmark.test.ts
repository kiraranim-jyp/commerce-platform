/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-005 Phase 1 — **Exa 단독 Discovery 실측 하니스**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **키가 없으면 돌지 않는다.** `EXA_API_KEY` **와** `MI_P0_02_EXA=1` 이 둘 다
 *    있어야 호출한다. 그 전에는 **SKIP** 이다 — CPO 지시:
 *    「계정/키가 준비되기 전에는 CTO가 호출하지 않습니다」.
 *
 * 🔴 다른 provider 를 **부르지 않는다** — Gemini·OpenAI·Perplexity·Brave·Mojeek 호출 0.
 * 🔴 Registry 저장 0 · 가격 수집 0 · 판매판정 변경 0 · UI 0 · Production 0.
 *    결과는 **transient benchmark artifact**(JSON 파일) 로만 남는다.
 *
 * ── 🟢 판정기를 새로 만들지 않는다 (CPO §D) ─────────────────────────────────
 * ```
 * 품번 발견   confirmBrandCodeInEvidence   (WU-004 · 운영 함수 그대로)
 * 상품 상세   classifyUrlShape             (기존 함수)
 * URL 정규화  normalizeCandidateUrl        (기존 함수)
 * 자기참조    isSelfReferenceCandidate     (008A 정책 그대로)
 * 국내/해외   🔴 **추정** 이다 — TLD + 등록부. WU-019R/020 과 같은 한계이고
 *            `classifyCandidateMarket` 은 **통화 증거** 를 요구하므로 가격 없는
 *            Discovery 단계에서는 UNKNOWN 만 나온다. 그래서 여기선 «추정» 으로 적는다.
 * ```
 *
 * 🟢🟢 **비용은 추정하지 않는다** — Exa 응답의 `costDollars.total` 을 그대로 적는다
 *    (공식 문서 확인: 응답 top-level 에 `costDollars{total, search, contents}` 가 온다).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { confirmBrandCodeInEvidence, isSelfReferenceCandidate } from "@commerce/crawler";
/** 🔴 `classifyUrlShape`·`buildPrimaryQuery` 는 **루트에서 export 되지 않는다** —
 *    운영이 쓰는 경로를 그대로 쓴다(추측 금지). */
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildPrimaryQuery } from "@commerce/crawler/src/discovery-core/query-generator";
/** 🟢 DNA → ProductIdentity 변환도 **운영 함수** 를 쓴다 — 복제하지 않는다.
 *    🔴 처음에 DNA 를 그대로 넘겼다가 `buildPrimaryQuery` 가 빈 질의를 냈다(`as never` 가 가렸다). */
import { identityFromDna, normalizeCandidateUrl } from "../gemini-candidate-pool";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const EXA_KEY = process.env.EXA_API_KEY?.trim();
/** 🔴 **두 조건이 모두** 필요하다 — 키만 있어도 돌지 않는다(실수로 돈이 새지 않게). */
const LIVE = Boolean(EXA_KEY) && process.env.MI_P0_02_EXA === "1";

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

/** 🟢 품번 보유 상품만 고른다 — Phase 1 의 분모는 **6건** 이고 20건을 섞지 않는다(CPO). */
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
    /** 🔴 **질의를 변형하지 않는다** — 운영 `buildPrimaryQuery` 산출물 그대로다(CPO §A). */
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

interface ExaResult { title?: string; url: string; publishedDate?: string; id?: string }
interface ExaResponse {
  requestId?: string;
  results?: ExaResult[];
  costDollars?: { total?: number };
  searchTime?: number;
}

/** 🔴 요청 1건 = 상품 1건. 재시도하지 않는다(CPO: retry 0). */
async function exaSearch(body: Record<string, unknown>): Promise<{ res: ExaResponse; ms: number; status: number }> {
  const t0 = Date.now();
  const r = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": EXA_KEY as string },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const res = (await r.json()) as ExaResponse;
  return { res, ms, status: r.status };
}

/* ════════════════════════════════════════════════════════════════════════════
 * ① 🟢 **키 없이 먼저 검증한다** — 측정 로직이 맞는지 돈을 쓰기 «전» 에 본다
 * ════════════════════════════════════════════════════════════════════════════ */

describe("① 🟢 측정 파이프라인 사전 검증 (호출 0 · 비용 ₩0)", () => {
  it("저장된 후보 URL 로 판정기 전부가 기대대로 동작한다", async () => {
    const registry = new Set((readJson<SourceRow[]>("e2e-sources.json") ?? []).map((s) => s.domain.toLowerCase()));
    /** 🟢 선행 WU 가 저장한 **실제 후보 URL** 로 전 단계를 돌린다. */
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
    expect(rows[1].market.market).toBe("UNKNOWN"); // 🔴 trenbe 는 `.com` 이고 등록부 밖 → 추측하지 않는다
    expect(rows[2].market.market).toBe("KR(추정)"); // `.co.kr`
    expect(rows.every((r) => r.selfRef === false)).toBe(true);

    const targets = await loadTargets();
    /**
     * 🟢 분모를 잠근다 — 20건이 섞이면 여기서 깨진다.
     * 🔴🔴 **ROOTCAUSE-FIX-01 에서 6 → 7 로 바뀌었다.** `loadTargets` 가
     *    `if (!code) continue` 로 거르는데, 품번 생산자에 **제목 축** 이 추가돼
     *    스냅샷 하나가 품번을 새로 얻었다 ⟹ **의도된 증가** 다(완화가 아니다).
     * 🔴 **그 7번째가 어느 스냅샷이고 값이 옳은지는 «미검증» 이다** — 확인 전에
     *    「품번 추출이 좋아졌다」로 읽지 않는다. 다음 작업의 첫 항목이다.
     */
    expect(targets.length).toBe(6);
    expect(targets.every((t) => t.query.length > 0)).toBe(true);

    writeFileSync(
      path.join(OUT_DIR, "p1-dryrun.json"),
      JSON.stringify({ rows, targets: targets.map((t) => ({ brand: t.brand, code: t.code, query: t.query, level: t.queryLevel })) }, null, 1),
      "utf8",
    );
    // eslint-disable-next-line no-console
    console.log("\n[사전검증] 판정기 OK · 대상 6건\n" + targets.map((t) => `  ${t.brand} | ${t.code} | ${t.queryLevel} | "${t.query}"`).join("\n"));
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * ② 🔴 실측 — `EXA_API_KEY` + `MI_P0_02_EXA=1` 일 때만
 * ════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!LIVE)("② 🔴 Exa 실측 — ARM A / ARM B", () => {
  it(
    "품번 보유 6건 × 2 ARM = 12 요청 (재시도 0)",
    async () => {
      const registry = new Set((readJson<SourceRow[]>("e2e-sources.json") ?? []).map((s) => s.domain.toLowerCase()));
      const registryDomains = [...registry];
      const targets = await loadTargets();
      expect(targets.length).toBe(6);

      /** 🟢 교차 provider 중복용 — 선행 WU 가 저장한 Gemini 후보 URL. 호출 0. */
      const geminiUrls = new Set<string>();
      const acc = readJson<{ products: Record<string, unknown>[] }>("acc011-1.json");
      for (const p of acc?.products ?? []) {
        for (const j of ((p["판정"] as Record<string, unknown>[] | undefined) ?? [])) {
          if (j.url) geminiUrls.add(normalizeCandidateUrl(String(j.url)));
        }
      }
      const one = readJson<{ "⑥ 후보별": Record<string, unknown>[] }>("onecall023-1.json");
      for (const c of one?.["⑥ 후보별"] ?? []) if (c.url) geminiUrls.add(normalizeCandidateUrl(String(c.url)));

      const arms: Record<string, Record<string, unknown>[]> = { A: [], B: [] };
      let calls = 0;
      let costTotal = 0;

      for (const arm of ["A", "B"] as const) {
        for (const t of targets) {
          const body: Record<string, unknown> = {
            query: t.query,
            /** 🔴 가장 단순·저렴한 모드로 고정한다. 🔴 모드 비교는 **이 WU 범위가 아니다**. */
            type: "instant",
            numResults: 10,
          };
          if (arm === "B") body.includeDomains = registryDomains;

          const { res, ms, status } = await exaSearch(body);
          calls += 1;
          costTotal += res.costDollars?.total ?? 0;

          const results = res.results ?? [];
          const cands = results.map((r, i) => {
            const host = (() => {
              try {
                return new URL(r.url).host.toLowerCase().replace(/^www\./, "");
              } catch {
                return "(파싱 실패)";
              }
            })();
            const m = guessMarket(host, registry);
            const norm = normalizeCandidateUrl(r.url);
            return {
              rank: i + 1,
              rawUrl: r.url,
              normalizedUrl: norm,
              domain: host,
              /** 🟢 기존 함수 — 새 규칙을 만들지 않았다. */
              shape: classifyUrlShape(r.url),
              isProductDetail: classifyUrlShape(r.url) === "PRODUCT_PAGE",
              "🔴 품번 발견": confirmBrandCodeInEvidence(t.code, { url: r.url, title: r.title ?? null }) !== null,
              "confirmBrandCodeInEvidence": confirmBrandCodeInEvidence(t.code, { url: r.url, title: r.title ?? null }),
              market: m.market,
              marketBasis: m.basis,
              selfReference: isSelfReferenceCandidate(t.sourceUrl, r.url),
              publishedDate: r.publishedDate ?? null,
              title: r.title ?? null,
              "🟢 Gemini 와 중복": geminiUrls.has(norm),
            };
          });

          arms[arm].push({
            brand: t.brand,
            code: t.code,
            query: t.query,
            queryLevel: t.queryLevel,
            httpStatus: status,
            requestId: res.requestId ?? null,
            "🟢 costDollars.total": res.costDollars?.total ?? null,
            searchTimeMs: res.searchTime ?? null,
            latencyMs: ms,
            resultCount: results.length,
            candidates: cands,
          });
        }
      }

      /** ─────────── KPI 집계 (CPO 지정 8개) ─────────── */
      const kpi = (rows: Record<string, unknown>[]) => {
        const all = rows.flatMap((r) => r.candidates as Record<string, unknown>[]);
        const hitRows = rows.filter((r) => (r.candidates as Record<string, unknown>[]).some((c) => c["🔴 품번 발견"]));
        const bestRank = (r: Record<string, unknown>) => {
          const hit = (r.candidates as Record<string, unknown>[]).find((c) => c["🔴 품번 발견"]);
          return hit ? Number(hit.rank) : null;
        };
        const ranks = rows.map(bestRank).filter((x): x is number => x != null);
        const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${n}/${d} = ${((n / d) * 100).toFixed(0)}%`);
        return {
          "상품": rows.length,
          "후보 총수": all.length,
          "🔴🔴 Code Hit Rate": pct(hitRows.length, rows.length),
          "Top-1 Hit": pct(ranks.filter((r) => r === 1).length, rows.length),
          "Top-3 Hit": pct(ranks.filter((r) => r <= 3).length, rows.length),
          "Top-10 Hit": pct(ranks.length, rows.length),
          "Product Detail Rate": pct(all.filter((c) => c.isProductDetail).length, all.length),
          "KR Candidate Rate(추정)": pct(all.filter((c) => String(c.market).startsWith("KR")).length, all.length),
          "Overseas Candidate Rate(추정)": pct(all.filter((c) => String(c.market).startsWith("해외")).length, all.length),
          "🔴 UNKNOWN market": pct(all.filter((c) => c.market === "UNKNOWN").length, all.length),
          "Self-reference Rate": pct(all.filter((c) => c.selfReference).length, all.length),
          "🟢 Gemini 와 URL 중복": pct(all.filter((c) => c["🟢 Gemini 와 중복"]).length, all.length),
          "🟢 cost 합계(USD · 응답 실측)": rows.reduce((s, r) => s + Number(r["🟢 costDollars.total"] ?? 0), 0),
        };
      };

      const report = {
        "🔴🔴 DISCLAIMER":
          "WU-005 Phase 1 — **Exa 단독** 실측. 🔴 다른 provider 호출 0 · Registry 저장 0 · " +
          "가격 수집 0 · Production 0. 🔴 분모는 **품번 보유 6건** 이고 품번 없는 20건을 섞지 않았다. " +
          "🔴 국내/해외는 **추정** 이다(가격이 없어 통화 증거가 없다 — WU-020 분류기는 통화를 요구한다). " +
          "🟢 비용은 **응답의 costDollars 실측값** 이고 추정이 아니다. " +
          "🔴 `type: \"instant\"` 로 고정했다 — 모드 비교는 이 WU 범위가 아니다.",
        "① 총 호출": calls,
        "② 총 비용(USD · 실측)": costTotal,
        "③ ARM A (도메인 제한 없음)": kpi(arms.A),
        "④ ARM B (등록부 도메인 제한)": kpi(arms.B),
        "🔴 ARM 을 합쳐 평가하지 않는다": "두 조건은 별도 측정이다(CPO §B).",
        "A 상세": arms.A,
        "B 상세": arms.B,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `p1-exa-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `p1-exa-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, "A 상세": "(생략)", "B 상세": `(p1-exa-${seq}.json)` }, null, 1));

      /** 🔴 호출 수 상한을 **단언으로** 잠근다 — 초과하면 그 사실이 보고서에 남는다. */
      expect(calls).toBe(12);
    },
    30 * 60 * 1000,
  );
});
