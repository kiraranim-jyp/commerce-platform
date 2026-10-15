/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-017-E2E — 「URL 을 받아 따져가 실제 동일상품으로 정확하게 검증하는가」
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **기본 SKIP.** `MI_017_E2E_LIVE=1` 일 때만 실제 판매처에 요청한다
 *    (`MI_P0_02_LIVE` 와 **다른 키** — 다른 라이브 하니스를 같이 깨우지 않는다).
 * 🔴 AI 호출 0 · Gemini 0 · 외부 검색 API 0 · 키 0 · 결제 0 · DB 쓰기 0 ·
 *    운영 코드 변경 0 · threshold 0 · Registry 0 · 배포 0.
 * 🟡 쓰는 비용은 **판매처 HTTP(GET)** 뿐이다 — 선행 WU 들이 쓴 것과 같은 종류다.
 *
 * ── 🔴🔴 입력의 출처를 먼저 적는다 (과장 금지) ─────────────────────────────
 * ```
 * 지시서 §2 는 「사람이 브라우저에서 AI 로 조사해 답변을 붙여넣는다」 다.
 * 🔴 CTO 는 그것을 할 수 없다 — 소비자 AI 웹 UI 자동화는 §12 에서 STOP 이고
 *    AI API 는 CPO 가 전면 금지했다. 그래서 **AI 가 찾아온 URL 을 쓰지 않는다.**
 * 🟢 대신 입력 URL 을 **운영 DB 실데이터** 에서 가져온다(읽기 전용 덤프 2개).
 *    측정 대상은 「URL 의 출처」가 아니라 **그 뒤 체인의 판정 정확도** 이고,
 *    체인은 URL 이 어디서 왔는지 모른다(`collectAiAnswerCandidatePool` 은
 *    텍스트만 받는다). 🔴 그러므로 이 측정으로 **「AI Recall」을 적지 않는다** —
 *    분모가 AI 가 아니다. 적을 수 있는 것은 **「주어진 URL 에 대한 판정 정확도」** 다.
 * ```
 *
 * ── 🔴 운영 query 를 «복제하지 않는다» ─────────────────────────────────────
 * ```
 * check/route.ts:52            buildProductIdentityDna(canonicalProduct)
 * run-domestic-price-check:732 title = stripLeadingDevTag(dna.title)
 *                        :733 sku   = identifier.tier === "SKU" ? identifier.value : undefined
 *                        :801 query = { title, brand, sourceUrl, sku, searchTerm(s), facts }
 *                        :808 facts = productFactsFromIdentityDna(dna)
 * 🟢 아래 `queryOf` 가 그 줄들을 **같은 owner 로** 만든다.
 * 🔴 `searchTerm`/`searchTerms` 는 **넣지 않는다** — 이 경로는 검색을 하지 않고
 *    (URL 이 입력이다) 점수 계산은 그 두 칸을 읽지 않는다(match.ts 전수 확인:
 *    query 에서 읽는 칸은 sku · title · brand · facts · sourceUrl 뿐이다).
 * ```
 *
 * ── 🔴 GT(정답)는 «우리 판정» 이 아니다 ────────────────────────────────────
 * ```
 * `domestic_product_links.match_truth` 는 **우리가 낸 값** 이라 GT 로 쓰면 자기채점이다.
 * 🟢 GT 는 **품번(sku)과 상품명/색상** 으로 CTO 가 손으로 정했고, 근거를 케이스마다 적었다.
 * ```
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { collectAiAnswerCandidatePool } from "../ai-answer-pool";
import { factsFromProductUrl } from "../product-url-facts";
import type { ComparisonCandidate, ComparisonQuery } from "../types";

const LIVE = process.env.MI_017_E2E_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🟢 운영 `stripLeadingDevTag`(run-domestic-price-check.ts:202)와 **같은 식** 이다. */
const stripLeadingDevTag = (title: string): string => title.replace(/^\s*\[[^\]]*\]\s*/, "").trim();

interface CaseRow {
  id: string;
  source_url: string;
  canonical_product: Record<string, unknown>;
}

/** 🔴 측정용 GT 어휘다 — **제품 코드의 판정 어휘가 아니다**(섞어 쓰지 않는다). */
type Gt =
  /** 실제로 같은 상품(같은 품번·같은 색) */
  | "SAME"
  /** 같은 상품인데 **다른 시장/로케일** URL */
  | "SAME_OTHER_MARKET"
  /** 원상품 자기 자신(같은 listing) */
  | "SELF"
  /** 같은 모델인데 **색상이 다르다** */
  | "DIFFERENT_COLOR"
  /** 브랜드는 같고 **다른 상품** */
  | "DIFFERENT_SAME_BRAND"
  /** 브랜드도 상품도 다르다 */
  | "DIFFERENT"
  /** 상품 상세 페이지가 아니다(목록) */
  | "NOT_PRODUCT_PAGE"
  /** 그 URL 이 존재하지 않는다(실측 404) */
  | "UNREACHABLE";

interface E2eCase {
  caseId: string;
  /** §6 의 어느 검증 항목인가. */
  kind: string;
  /** 원상품 스냅샷 id 앞 8자리(덤프 키). */
  origin: string;
  /** 🔴 사람이 붙여넣는 모양 — 산문 + URL. AI 의 «주장» 을 일부러 섞어 둔다. */
  answer: string;
  /** URL → GT. 🔴 근거를 `why` 에 적는다(추측 금지). */
  gt: { url: string; gt: Gt; why: string }[];
}

const BOBO_010 = "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt";
const BOBO_070 = "https://bobochoses.com/products/b226ac070-stamp-bloom-all-over-denim-pants";
const JE_010_PLAIN = "https://www.junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
const JE_010_ENKR =
  "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
const BOBO_117_COM = "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket";
const BOBO_117_ENKR = "https://bobochoses.com/en-kr/products/b226ac117-b-c-embossed-tracksuit-jacket";
const BOBO_117_JP_ENKR = "https://bobochoses.co.jp/en-kr/products/b226ac117-b-c-embossed-tracksuit-jacket";
const BOBO_LIST = "https://bobochoses.com/collections/new-arrivals-kid";
const FORET_PEPE = "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592";
const DEUX_PEPE = "https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=62&display_group=1";
const JE_PEPE_TOBACCO = "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe";

/**
 * 🟢 **URL 전부 운영 DB 실데이터** 다(덤프 `mi-017-e2e-urlset.json`).
 *    `bobochoses.com/collections/new-arrivals-kid` 와 `bobochoses.co.jp/en-kr/...` 둘만
 *    예외이고, 전자는 **목록 URL 모양** 이 필요해서, 후자는 WU-008 이 **404 를 실측** 한
 *    그 URL 이기 때문이다(둘 다 근거가 `why` 에 있다).
 */
const CASES: E2eCase[] = [
  {
    caseId: "C1",
    kind: "진짜 동일상품(품번 일치) + 브랜드만 같은 다른 상품 + 목록 URL",
    origin: "d92ba611",
    answer: `동일 상품을 세 곳에서 찾았습니다. 모두 **같은 상품**이고 국내 최저가는 ₩49,000 입니다.
1. ${BOBO_010}
2. ${BOBO_070}
3. ${BOBO_LIST}`,
    gt: [
      { url: BOBO_010, gt: "SAME", why: "원상품 sku B226AC010 · 후보 handle 에 b226ac010 · 제목 Booty Ghosts 동일" },
      { url: BOBO_070, gt: "DIFFERENT_SAME_BRAND", why: "같은 공식몰이지만 품번 B226AC070 · 상품군 denim pants(원상품은 긴팔 티셔츠)" },
      { url: BOBO_LIST, gt: "NOT_PRODUCT_PAGE", why: "컬렉션(목록) URL — 상품 상세가 아니다" },
    ],
  },
  {
    caseId: "C2",
    kind: "원상품 자기참조(/collections/ 경유) + 로케일만 다른 동일상품",
    origin: "d92ba611",
    answer: `원본과 같은 상품입니다.
1. ${JE_010_PLAIN}
2. ${JE_010_ENKR}`,
    gt: [
      { url: JE_010_PLAIN, gt: "SELF", why: "원상품이 junioredition.com/collections/bobo-choses/products/booty-ghosts-… 이고 008A 정책상 목록 세그먼트는 같은 listing" },
      { url: JE_010_ENKR, gt: "SAME_OTHER_MARKET", why: "같은 판매처·같은 상품의 en-kr 시장 URL — CPO 확정 정책상 자기참조가 아니다" },
    ],
  },
  {
    caseId: "C3",
    kind: "같은 상품의 JP / Global / KR URL + 존재하지 않는 시장 URL",
    origin: "278d4c38",
    answer: `이 상품은 세 시장에서 팔립니다. 가격은 전부 같습니다.
1. ${BOBO_117_COM}
2. ${BOBO_117_ENKR}
3. ${BOBO_117_JP_ENKR}`,
    gt: [
      { url: BOBO_117_COM, gt: "SAME_OTHER_MARKET", why: "원상품은 bobochoses.co.jp 의 B226AC117 · 이것은 같은 품번의 .com(Global) 스토어" },
      { url: BOBO_117_ENKR, gt: "SAME_OTHER_MARKET", why: "같은 품번의 .com en-kr(한국 시장) URL · WU-008 에서 KRW 258,000 실측" },
      { url: BOBO_117_JP_ENKR, gt: "UNREACHABLE", why: "WU-008 실측 — 일본 스토어에 en-kr 시장이 없다(404)" },
    ],
  },
  {
    caseId: "C4",
    kind: "국내 진짜 동일상품 2건(CEO 정답 쌍) + 같은 모델 다른 색상",
    origin: "0695a024",
    answer: `국내 판매처 두 곳과 색상 다른 모델을 찾았습니다. 세 개 모두 **동일 상품**입니다.
1. ${FORET_PEPE}
2. ${DEUX_PEPE}
3. ${JE_PEPE_TOBACCO}`,
    gt: [
      { url: FORET_PEPE, gt: "SAME", why: "원상품 Pèpè Lulu T Bar VERNICE NERO · 후보 제목 'VERNICE NERO T-스트랩 슈즈'(운영 링크 보유)" },
      { url: DEUX_PEPE, gt: "SAME", why: "후보 제목 '페페 VERNICE NERO'(운영 링크 보유)" },
      { url: JE_PEPE_TOBACCO, gt: "DIFFERENT_COLOR", why: "운영 DB sku 01195-NEVADA-TOBACCO vs 원상품 01195-VERNICE-NERO — 같은 모델 01195, 색상이 다르다" },
    ],
  },
];

/** 한 후보에 대해 체인이 실제로 낸 것 — 🔴 가공하지 않는다. */
interface Observed {
  url: string;
  kind: string;
  gt: Gt;
  why: string;
  /** 제외됐으면 그 이유(= 체인이 HTTP 전/후에 거른 것). */
  droppedReason: string | null;
  notFetched: boolean;
  title: string | null;
  candidateUrl: string | null;
  brand: string | null;
  matchLevel: string | null;
  confidence: number | null;
  crossSellerVerdict: string | null;
  /** 🔴 타입을 **추측하지 않는다** — owner 타입에서 읽는다(이 트랙에서 열한 번 걸린 실수). */
  crossSellerBlockers: ComparisonCandidate["crossSellerBlockers"] | null;
  crossSellerConflicts: ComparisonCandidate["crossSellerConflicts"] | null;
  price: unknown;
}

function queryOf(row: CaseRow): ComparisonQuery {
  /* 🟢 운영 owner 를 그대로 — 손으로 facts 를 만들지 않는다. */
  const dna = buildProductIdentityDna(row.canonical_product as never);
  return {
    title: stripLeadingDevTag(dna.title),
    brand: dna.brand.value || undefined,
    sourceUrl: dna.sourceUrl,
    sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
    facts: productFactsFromIdentityDna(dna),
  };
}

const describeLive = LIVE ? describe : describe.skip;

describeLive("WU-017-E2E — 주어진 URL 에 대한 판정 정확도(실제 상품 · 실제 HTTP)", () => {
  it(
    "케이스 전건을 실제 체인으로 돌리고 GT 와 대조한다",
    async () => {
      const casesPath = path.join(OUT_DIR, "mi-017-e2e-cases.json");
      if (!existsSync(casesPath)) throw new Error(`선행 덤프 없음: ${casesPath} — mi-017-e2e-case-dump.mjs 를 먼저 돌린다`);
      const rows = JSON.parse(readFileSync(casesPath, "utf8")) as CaseRow[];
      const byPrefix = new Map(rows.map((r) => [String(r.id).slice(0, 8), r]));

      const observed: Observed[] = [];
      let httpCalls = 0;

      for (const c of CASES) {
        const row = byPrefix.get(c.origin);
        if (!row) throw new Error(`원상품 덤프 없음: ${c.origin}`);
        const query = queryOf(row);

        const pool = await collectAiAnswerCandidatePool({
          text: c.answer,
          query,
          /** 🔴 케이스의 URL 전부를 본다 — 상한으로 측정을 자르지 않는다. */
          maxUrls: 10,
          /** 🟢 **운영 함수** 로 실제 페이지를 연다. */
          fetchFacts: factsFromProductUrl,
        });
        httpCalls += pool.httpCalls;

        const byUrl = new Map<string, ComparisonCandidate>();
        for (const cand of pool.candidates) byUrl.set(cand.url, cand);

        for (const g of c.gt) {
          /* 🔴 제외 목록은 **붙여넣은 URL** 기준으로 적힌다(정규화 전 문자열). */
          const drop = pool.dropped.find((d) => d.url === g.url || d.url === g.url.replace(/\?.*$/, ""));
          /* 🟢 후보는 crawlerUrl 로 돌아오므로 host+경로 접두로 맞춘다. */
          const cand =
            byUrl.get(g.url) ??
            pool.candidates.find((x) => sameListingish(x.url, g.url)) ??
            null;
          observed.push({
            url: g.url,
            kind: c.kind,
            gt: g.gt,
            why: g.why,
            droppedReason: drop?.reason ?? null,
            notFetched: pool.notFetchedOverLimit.includes(g.url),
            title: cand?.title ?? null,
            candidateUrl: cand?.url ?? null,
            brand: cand?.brand ?? null,
            matchLevel: cand?.matchLevel ?? null,
            confidence: cand?.confidence ?? null,
            crossSellerVerdict: cand?.crossSellerVerdict ?? null,
            crossSellerBlockers: cand?.crossSellerBlockers ?? null,
            crossSellerConflicts: cand?.crossSellerConflicts ?? null,
            price: cand?.price ?? null,
          });
        }

        console.log(
          `\n[${c.caseId}] ${c.kind}\n  원상품: ${query.sourceUrl}\n  query: title="${query.title}" brand=${
            query.brand ?? "(없음)"
          } sku=${query.sku ?? "(없음)"}\n  후보 ${pool.candidates.length} · 제외 ${pool.dropped.length} · HTTP ${pool.httpCalls}`,
        );
        for (const o of observed.filter((x) => x.kind === c.kind)) {
          console.log(
            `    GT=${o.gt.padEnd(20)} ${
              o.droppedReason ? `DROPPED:${o.droppedReason}` : `${o.crossSellerVerdict ?? "(판정없음)"}/${o.matchLevel ?? "-"}/${o.confidence ?? "-"}`
            }  ${o.url}`,
          );
        }
      }

      if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(
        path.join(OUT_DIR, "mi-017-e2e-result.json"),
        JSON.stringify({ observed, httpCalls, sample: { cases: CASES.length, urls: observed.length } }, null, 2),
        "utf8",
      );
      console.log(`\n총 HTTP ${httpCalls} · URL ${observed.length}건 → mi-017-e2e-result.json`);

      /* ═══ Precision 우선 — 🔴 GT 가 「다르다」인 것이 동일상품으로 올라오면 실패 ═══ */
      const falseSame = observed.filter(
        (o) =>
          ["DIFFERENT", "DIFFERENT_SAME_BRAND", "DIFFERENT_COLOR"].includes(o.gt) &&
          (o.crossSellerVerdict === "SAME" || o.matchLevel === "very_high"),
      );
      expect(falseSame.map((o) => `${o.gt} ${o.url} → ${o.crossSellerVerdict}/${o.matchLevel}`)).toEqual([]);

      /* 🔴 자기참조는 후보로 남아서는 안 된다(가격 오염 경로다). */
      for (const o of observed.filter((x) => x.gt === "SELF")) {
        expect(o.droppedReason, `자기참조가 후보로 남았다: ${o.url}`).toBe("SELF_REFERENCE");
      }

      /* 🔴 목록 URL 은 HTTP 를 쓰지 않고 걸러져야 한다. */
      for (const o of observed.filter((x) => x.gt === "NOT_PRODUCT_PAGE")) {
        expect(o.droppedReason, `목록 URL 이 후보가 됐다: ${o.url}`).toBe("NOT_PRODUCT_PAGE");
      }

      /**
       * 🔴🔴 존재하지 않는 URL 은 **후보가 되어서는 안 된다.**
       *    처음에 이 단언을 `[null, "UNREACHABLE", …]` 로 썼다가 **공짜로 통과** 했다 —
       *    `null`(= 후보로 남았다)을 허용했기 때문이다. 이 트랙의 반복 함정이라 조인다.
       * 🔴 그리고 **이유가 `UNREACHABLE` 로 적히지 않는다** — 정규화기가 로케일을 떼서
       *    «다른(실존) 페이지» 를 열기 때문이다. 그래서 어떤 이유로든 **제외되는 것만**
       *    고정하고, 「404 를 404 로 말하지 못한다」는 사실은 보고서에 남긴다.
       */
      for (const o of observed.filter((x) => x.gt === "UNREACHABLE")) {
        expect(o.droppedReason, `존재하지 않는 URL 이 후보가 됐다: ${o.url}`).not.toBeNull();
      }

      /* 🔴🔴 **열린 페이지가 원상품과 같으면** GT 와 무관하게 후보가 아니다(가격 오염). */
      const originListing = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\?.*$/, "");
      for (const o of observed) {
        if (!o.candidateUrl) continue;
        const originOf = CASES.find((c) => c.kind === o.kind);
        const row = originOf ? byPrefix.get(originOf.origin) : null;
        if (!row) continue;
        expect(
          originListing(o.candidateUrl) === originListing(row.source_url),
          `원상품 자기 자신이 후보가 됐다: ${o.candidateUrl}`,
        ).toBe(false);
      }
    },
    15 * 60 * 1000,
  );
});

/** 🔴 비교용 느슨한 동일 listing 판정 — **측정 보조** 이고 제품 판정이 아니다. */
function sameListingish(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const x = new URL(u);
      return `${x.hostname.replace(/^www\./, "").toLowerCase()}${x.pathname.toLowerCase().replace(/\/+$/, "")}`;
    } catch {
      return u.toLowerCase();
    }
  };
  /* 🔴 host 는 반드시 같아야 하고, 경로는 **목록 세그먼트/로케일만** 다를 수 있다
     (crawlerUrl 이 그 둘을 떼기 때문이다). 마지막 경로 조각으로 맞춘다. */
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  const [ha, ...pa] = na.split("/");
  const [hb, ...pb] = nb.split("/");
  return ha === hb && pa.length > 0 && pb.length > 0 && pa[pa.length - 1] === pb[pb.length - 1];
}

/** 🟢 SKIP 상태에서도 **케이스 정의 자체** 는 검사한다(HTTP 0 · 비용 0). */
describe("WU-017-E2E 케이스 정의", () => {
  it("🔴 GT 는 케이스마다 **근거** 가 있다 — 추측으로 정답을 적지 않는다", () => {
    for (const c of CASES) {
      expect(c.gt.length).toBeGreaterThan(0);
      for (const g of c.gt) {
        expect(g.why.length, `${c.caseId} ${g.url} 근거 없음`).toBeGreaterThan(10);
        expect(g.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("🔴 §6 검증 항목이 케이스에 **전부** 들어 있다", () => {
    const gts = new Set(CASES.flatMap((c) => c.gt.map((g) => g.gt)));
    for (const required of [
      "SAME",
      "SAME_OTHER_MARKET",
      "SELF",
      "DIFFERENT_COLOR",
      "DIFFERENT_SAME_BRAND",
      "NOT_PRODUCT_PAGE",
      "UNREACHABLE",
    ] as Gt[]) {
      expect(gts.has(required), `GT 유형 누락: ${required}`).toBe(true);
    }
  });

  it("🔴 AI 의 «주장» 이 답변 텍스트에 실제로 섞여 있다 — 전염 여부를 측정할 수 있게", () => {
    const claims = CASES.map((c) => c.answer).join("\n");
    expect(claims).toMatch(/동일 상품|같은 상품/);
    expect(claims).toMatch(/₩|최저가|가격/);
  });
});
