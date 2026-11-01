import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { canonicalListingKey } from "@commerce/crawler";
/**
 * 🔴🔴 **칸을 문자열로 더듬지 않는다 — 운영 타입을 그대로 쓴다.**
 *    1차에 `Record<string, unknown>` 으로 받았고 **typecheck 가 잡았다**. 그 상태로
 *    두면 `facts.colorTxt` 같은 오타가 **전건 null** 로 조용히 통과한다(이 트랙에서
 *    칸 이름을 14번 틀린 그 자리 · 메모 `measure-with-the-production-function`).
 */
import type { ComparisonCandidate } from "@commerce/crawler/src/comparison-search/types";
import type { ProductFacts } from "@commerce/shared";
import {
  FIELD_MAP,
  classify,
  sitePresence,
  type EvidenceState,
  type RawPage,
  type Step4Field,
} from "./gt-master-step4-fields";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 — **Step 4: 70후보 raw evidence**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **목표는 SAME 을 늘리는 것이 «아니다»**(CPO 작업지시). 목표는 하나다 —
 * > 「**사이트에 실제로 존재하는 증거**」와 「**crawler 가 수집하지 못한 증거**」를 분리.
 *
 * 🔴 **금지 전수 준수** — threshold · SAME_MIN_AXES · blocker 삭제 · 새 점수축 ·
 *    Search provider/query · candidate cap · price eligibility · UI · Registry ·
 *    DB 데이터 수정 · CEO GT 수정 · 공식 분모 80→70 변경 **전부 0**.
 * 🔴 **Step 4 는 측정만 한다.**
 *
 * ── 🔴 분모(LOCK 유지 · CPO 판정 2026-11-01) ──────────────────────────────
 * ```
 * 공식 분모     생성기 행 **80**
 * 보조 측정값   고유 (상품,URL) **70**     ← fetch 단위
 * CEO SAME 43 · DIFFERENT 24 · REVIEW 10 · CONFLICT 3
 * ```
 *
 * ── 🔴🔴 join owner 는 계속 운영 `canonicalListingKey` 다 ───────────────────
 * Step 3 에서 자작 키가 **같은 후보를 두 번 세게** 했다(2건 → 키 혼용으로 5건).
 * 🔴 그래서 이 파일도 **키를 하나만** 쓴다. 층은 셋으로 유지한다 —
 *    원본 GT · crawler 결과 · 분석 결과(CPO 마지막 문장).
 *
 * ── 🔴 fetch owner 도 운영이다 ──────────────────────────────────────────────
 * 원문은 `fetchPlainHtmlWithFinalUrl`(운영)로 받는다. 🔴 `node:https`/raw `fetch` 를
 * 새로 만들지 않는다 — 그러면 SSRF·DNS rebinding·rate-limit 가드를 **우회** 한다
 * (WU-084 가 같은 이유로 자작 스택을 만들지 않았다).
 *
 * 🔴 게이트 `GTM4_LIVE=1` 없으면 LIVE SKIP. 🔴 jsdom 금지(WU-133).
 */

const LIVE = process.env.GTM4_LIVE === "1";

function repoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, "docs", "identity-gt-master", "MASTER-GT-DATA.json"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("repo 루트를 찾지 못했다");
}
const readRoot = <T>(rel: string): T => JSON.parse(readFileSync(join(repoRoot(), rel), "utf8")) as T;

/** 🔴 Step 3 과 **같은 규칙** 이어야 한다 — 규칙이 둘이면 후보가 갈린다. */
function joinKey(raw: string): string {
  const k = canonicalListingKey(raw);
  if (k) return `${k.host}${k.key}`;
  try {
    const u = new URL(String(raw).trim());
    return `${u.host.toLowerCase().replace(/^www\./, "")}${u.pathname.toLowerCase().replace(/\/+$/, "")}`;
  } catch {
    return String(raw).trim().toLowerCase();
  }
}

/* ───────────────────────────── 입력 층 ① 원본 GT ───────────────────────────── */

interface MasterCandidate {
  originRaw: string;
  url: string;
  dedupeKey: string;
  CEO_GT: "SAME" | "DIFFERENT" | "REVIEW" | null;
  GT_CONFLICT: boolean;
  GT_SOURCE_FIXTURES: string[];
  GT_VALUES: string[];
  productId: string;
}
interface Master {
  _counts: { uniqueCandidates: number; SAME: number; DIFFERENT: number; REVIEW: number; GT_CONFLICT: number };
  products: { productId: string; originKey: string }[];
  candidates: MasterCandidate[];
}

/** 🔴 fetch 단위 = 고유 (상품,URL). `gtRows` 로 80 축을 **보존** 한다. */
interface Target {
  productId: string;
  key: string;
  url: string;
  CEO_GT: string | null;
  gtRows: { originRaw: string; CEO_GT: string | null; fixtures: string[] }[];
}

export function buildTargets(): Target[] {
  const m = readRoot<Master>("docs/identity-gt-master/MASTER-GT-DATA.json");
  const out = new Map<string, Target>();
  for (const c of m.candidates) {
    const key = joinKey(c.url);
    const id = `${c.productId}||${key}`;
    const prev = out.get(id);
    const row = { originRaw: c.originRaw, CEO_GT: c.CEO_GT, fixtures: c.GT_SOURCE_FIXTURES };
    if (prev) {
      prev.gtRows.push(row);
      /** 🔴 **한쪽을 고르지 않는다**(CPO §5) — 상충은 상충으로 적는다. */
      if (prev.CEO_GT !== c.CEO_GT) prev.CEO_GT = "GT_CONFLICT_CROSS_ORIGIN";
      /** 🔴 `return` 이 아니라 `continue` 다 — 1차에 `return` 을 써서 분모가 11 로 잘렸다. */
      continue;
    }
    out.set(id, {
      productId: c.productId,
      key,
      url: c.url,
      CEO_GT: c.GT_CONFLICT ? "GT_CONFLICT" : c.CEO_GT,
      gtRows: [row],
    });
  }
  return [...out.values()];
}

/* ───────────────────── 입력 층 ② Step 3 운영 Identity 산출 ───────────────────── */

interface Step3Row {
  dedupeKey: string;
  url: string;
  domain: string;
  matchTruth: string | null;
  crossSellerVerdict: string | null;
  crossSellerBlockers: string[] | null;
  crossSellerConflicts: string[] | null;
  matchLevel: string | null;
  confidence: number | null;
  priceTier: string | null;
  priceStatus: string | null;
  market: string | null;
  display: string | null;
  priced: boolean;
}
interface Step3Product {
  productId: string;
  originKey: string;
  unavailableReason: string | null;
  preconditions: string[];
  rows: Step3Row[];
  lost: { url: string; CEO_GT: string | null; dedupeKey: string }[];
  metrics: Record<string, unknown>[];
}

export function step3Index(): Map<string, Step3Row> {
  const d = readRoot<{ products: Step3Product[] }>("docs/identity-gt-master/STEP3-REPLAY.json");
  const ix = new Map<string, Step3Row>();
  for (const p of d.products) for (const r of p.rows) ix.set(`${p.productId}||${joinKey(r.url)}`, r);
  return ix;
}

/* ──────────────────────────── 계약 (네트워크 0) ──────────────────────────── */

describe("GTM4 분모·지도 — LOCK 과 필드 지도를 측정 전에 고정한다", () => {
  /** 🔴 GTM4-A — 공식 분모 80 과 보조 70 을 **둘 다** 지킨다(바꾸지 않는다). */
  it("GTM4-A 분모 80(공식) / 70(보조) 이 유지된다", () => {
    const m = readRoot<Master>("docs/identity-gt-master/MASTER-GT-DATA.json");
    expect(m.candidates).toHaveLength(80);
    expect(buildTargets()).toHaveLength(70);
    expect([m._counts.SAME, m._counts.DIFFERENT, m._counts.REVIEW, m._counts.GT_CONFLICT]).toEqual([43, 24, 10, 3]);
  });

  /**
   * 🔴🔴 GTM4-B — **필드 지도를 수치로 고정한다.**
   *    `factsKey === null` 인 필드는 **구조적으로 A 가 불가능** 하다. 그 사실을 모르고
   *    「사이트에 없다(C)」로 적으면 CPO §2 의 금지를 어긴다.
   */
  it("GTM4-B 조사 필드 17 · 수집 칸 없는 필드는 composition/season/collection 셋", () => {
    expect(FIELD_MAP).toHaveLength(17);
    const noSlot = FIELD_MAP.filter((f) => f.factsKey === null).map((f) => f.field);
    expect(noSlot).toEqual(["composition", "season", "collection"]);
    /** 🔴 그중 **season·collection 은 비교 축도 없다** — composition 은 있다(제목 유래). */
    const noCompare = FIELD_MAP.filter((f) => f.comparedBy === null).map((f) => f.field);
    expect(noCompare).toEqual(["description", "season", "collection", "image"]);
    /* eslint-disable-next-line no-console */
    console.log(`[GTM4-map] 수집칸 없음 ${JSON.stringify(noSlot)} · 비교 안 됨 ${JSON.stringify(noCompare)}`);
  });

  /**
   * 🔴🔴🔴 GTM4-C — **분류 전용 reader 가 운영에 들어가지 않는다**(CPO §7).
   *    운영 파일이 이 모듈을 import 하면 **FAIL** 한다. 🔴 「측정용으로 만들었다」가
   *    「운영에 안 들어간다」를 보장하지 않는다 — 계약이 보장한다.
   */
  it("GTM4-C 분류 전용 reader 를 운영 코드가 import 하지 않는다", async () => {
    const { execSync } = await import("node:child_process");
    const root = repoRoot();
    let hits = "";
    try {
      hits = execSync(
        `git grep -l "gt-master-step4-fields" -- "apps/**/*.ts" "apps/**/*.tsx" "packages/**/*.ts"`,
        { cwd: root, encoding: "utf8" },
      );
    } catch {
      hits = "";
    }
    const files = hits.split("\n").map((s) => s.trim()).filter(Boolean);
    /** 🟢 허용되는 것은 **`__tests__` 안** 뿐이다. */
    const outside = files.filter((f) => !f.includes("__tests__"));
    expect(outside, `🔴 운영 코드가 분류 전용 reader 를 import 한다: ${outside.join(" · ")}`).toEqual([]);
  });

  /**
   * 🔴 GTM4-D — **Step 3 산출과 join 이 붙는지** 측정 «전» 에 확인한다.
   *    Step 3 의 도달 33행이 전부 이 70 분모 안에 들어와야 한다 — 안 붙으면 키가 갈렸다.
   */
  it("GTM4-D Step 3 도달 33행이 전부 70 분모에 붙는다", () => {
    const targets = new Set(buildTargets().map((t) => `${t.productId}||${t.key}`));
    const ix = step3Index();
    expect(ix.size).toBe(33);
    const orphan = [...ix.keys()].filter((k) => !targets.has(k));
    expect(orphan, `🔴 Step 3 행이 Step 4 분모에 없다 — join 키가 갈렸다: ${orphan.join(" · ")}`).toEqual([]);
  });
});

/* ───────────────────────────── LIVE 측정 ───────────────────────────── */

export interface Step4Row {
  productId: string;
  key: string;
  url: string;
  domain: string;
  CEO_GT: string | null;
  gtRows: { originRaw: string; CEO_GT: string | null; fixtures: string[] }[];
  /** 운영 추출 결과 */
  factsStatus: string;
  fetchPath: string;
  httpCalls: number;
  /** 🔴 필드별 A/B/C/D + **무엇이 증명했는가** */
  fields: Record<string, { state: EvidenceState; collected: string | null; via: string | null }>;
  /** Step 3 운영 Identity 산출(없으면 미도달) */
  identity: Step3Row | null;
  rawNote: string;
}

describe("GTM4 — 70후보 raw evidence + A/B/C/D (측정만)", () => {
  it.runIf(LIVE)(
    "🔴 고유 70 후보의 필드별 증거 상태를 전수 확정한다",
    async () => {
      const { factsFromProductUrl } = await import("@commerce/crawler/src/comparison-search/product-url-facts");
      const { fetchPlainHtmlWithFinalUrl, extractShopifyHandle, stripShopifyLocalePrefix } = await import(
        "@commerce/crawler/src/shopify-product-json"
      );
      const { getSupabaseAdmin } = await import("@/lib/supabase-admin");

      /** 🔴 **쓰기 불가를 측정 전에 증명한다**(Step 3 과 같은 2중 방어 중 하나). */
      expect(getSupabaseAdmin(), "service-role 이 있다 — 측정 하니스로 운영 DB 를 건드릴 수 있다").toBeNull();

      const targets = buildTargets();
      const ix = step3Index();
      const out: Step4Row[] = [];

      for (const [i, t] of targets.entries()) {
        /* ── ① 운영 추출(= A 축 입력) ── */
        const r = await factsFromProductUrl(t.url);
        const facts = r.candidate?.facts ?? null;

        /* ── ② 원문(= B vs C 판정 전용) ── */
        let page: RawPage = { shopify: null, html: null, reachable: false, note: "미시도" };
        const handle = extractShopifyHandle(t.url);
        if (handle) {
          const origin = new URL(t.url).origin;
          const jsonUrl = `${origin}/products/${handle}.json`;
          const got = await fetchPlainHtmlWithFinalUrl(stripShopifyLocalePrefix(jsonUrl));
          if (got) {
            try {
              const body = JSON.parse(got.html) as { product?: Record<string, unknown> };
              if (body.product) page = { shopify: body.product, html: null, reachable: true, note: "shopify json" };
              else page = { shopify: null, html: null, reachable: false, note: "shopify json 에 product 없음" };
            } catch {
              page = { shopify: null, html: null, reachable: false, note: "shopify json 파싱 실패" };
            }
          } else {
            page = { shopify: null, html: null, reachable: false, note: "shopify json fetch 실패" };
          }
        }
        if (!page.reachable) {
          const got = await fetchPlainHtmlWithFinalUrl(t.url);
          if (got) page = { shopify: page.shopify, html: got.html, reachable: true, note: `html ${got.html.length}B` };
          else if (page.note === "미시도") page = { ...page, note: "html fetch 실패" };
        }

        /* ── ③ 필드별 분류 ── */
        const fields: Step4Row["fields"] = {};
        for (const fm of FIELD_MAP) {
          const collectedValue = collectedOf(fm.field, facts, r.candidate);
          const presence = sitePresence(fm.field, page);
          fields[fm.field] = {
            state: classify(collectedValue != null, page, presence),
            collected: collectedValue,
            via: presence.via,
          };
        }

        out.push({
          productId: t.productId,
          key: t.key,
          url: t.url,
          domain: (() => {
            try {
              return new URL(t.url).host.toLowerCase().replace(/^www\./, "");
            } catch {
              return "?";
            }
          })(),
          CEO_GT: t.CEO_GT,
          gtRows: t.gtRows,
          factsStatus: r.status,
          fetchPath: r.fetchPath,
          httpCalls: r.httpCalls,
          fields,
          identity: ix.get(`${t.productId}||${t.key}`) ?? null,
          rawNote: page.note,
        });

        /* eslint-disable no-console */
        const counts = tally(Object.values(fields).map((f) => f.state));
        console.log(
          `[GTM4 ${String(i + 1).padStart(2)}/70] ${t.productId} ${pad(out.at(-1)!.domain, 24)}` +
            ` ceo=${pad(t.CEO_GT ?? "-", 26)} ${pad(r.status, 17)} ${pad(r.fetchPath, 13)}` +
            ` A${counts.A} B${counts.B} C${counts.C} D${counts.D}  ${page.note}`,
        );
      }

      writeFileSync(
        join(repoRoot(), "docs/identity-gt-master/STEP4-EVIDENCE.json"),
        JSON.stringify({ _wu: "IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 Step 4", _lock: { ledger: 80, unique: 70 }, rows: out }, null, 2),
      );

      /* ── 집계 출력 ── */
      console.log(`\n════════ 필드별 A/B/C/D (분모 ${out.length}) ════════`);
      console.log(`   ${pad("필드", 14)}${pad("A", 5)}${pad("B", 5)}${pad("C", 5)}${pad("D", 5)}  수집칸`);
      for (const fm of FIELD_MAP) {
        const c = tally(out.map((o) => o.fields[fm.field].state));
        console.log(
          `   ${pad(fm.field, 14)}${pad(c.A, 5)}${pad(c.B, 5)}${pad(c.C, 5)}${pad(c.D, 5)}  ${fm.factsKey ?? "🔴 없음"}`,
        );
      }

      /** 🔴 **「사이트에 있는데 못 가져온 것」 전수** — CPO §6-⑦ 의 그 숫자. */
      const bTotal = out.reduce((n, o) => n + Object.values(o.fields).filter((f) => f.state.startsWith("B")).length, 0);
      const cTotal = out.reduce((n, o) => n + Object.values(o.fields).filter((f) => f.state.startsWith("C")).length, 0);
      const dTotal = out.reduce((n, o) => n + Object.values(o.fields).filter((f) => f.state.startsWith("D")).length, 0);
      console.log(`\n   🔴 crawler missing(B) ${bTotal} · site missing(C) ${cTotal} · 확인불가(D) ${dTotal}`);

      /** 🔴 분모를 바꾸지 않았다는 것만 단언한다 — 숫자를 기대값으로 박지 않는다. */
      expect(out).toHaveLength(70);
      /** 🔴 **D 를 0 으로 가정하지 않는다** — 다만 전건 D 면 측정이 무효다. */
      expect(out.filter((o) => o.rawNote.includes("실패")).length, "전건 원문 fetch 실패 — 측정 무효").toBeLessThan(70);
    },
    3_000_000,
  );
});

/* ───────────────────────────── 보조(순수) ───────────────────────────── */

const pad = (v: unknown, n: number) => {
  const s = String(v);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
};

function tally(states: EvidenceState[]): { A: number; B: number; C: number; D: number } {
  const o = { A: 0, B: 0, C: 0, D: 0 };
  for (const s of states) o[s[0] as "A" | "B" | "C" | "D"] += 1;
  return o;
}

/**
 * 🔴🔴 **운영이 수집한 값** — `ProductFacts` 의 **실제 칸** 에서만 읽는다.
 *    🔴 칸이 없는 필드(composition·season·collection)는 **항상 null** 이다 ⟹ A 불가.
 *    🔴 값을 지어내지 않는다.
 */
function collectedOf(
  field: Step4Field,
  facts: ProductFacts | null,
  candidate: ComparisonCandidate | null,
): string | null {
  const s = (v: unknown): string | null => {
    if (v == null) return null;
    if (Array.isArray(v)) return v.length ? v.slice(0, 3).map(String).join(" | ") : null;
    const t = String(v).trim();
    return t === "" ? null : t.slice(0, 120);
  };
  if (field === "price") {
    const p = candidate?.price;
    return p && p.amount != null && p.currency ? `${p.amount} ${p.currency}` : null;
  }
  if (!facts) return null;
  switch (field) {
    case "brand":
      return s(facts.brand);
    case "modelCode":
      return s(facts.brandModelCode);
    case "title":
      return s(facts.title);
    case "description":
      return s(facts.description);
    case "category":
      return s(facts.categoryText);
    case "color":
      return s(facts.colorText);
    case "material":
      return s(facts.materialText);
    case "fit":
      return s(facts.fitText);
    case "size":
      return s(facts.sizeLabels);
    case "age":
      return s(facts.ageRangeText);
    case "audience":
      return s(facts.audienceSignals);
    case "sellerSku":
      return s(facts.sellerSku);
    case "image":
      return s(facts.imageUrls);
    /** 🔴 **수집 칸이 없다** — 사이트에 있어도 A 가 될 수 없다(GTM4-B 가 잠근다). */
    case "composition":
    case "season":
    case "collection":
      return null;
    default:
      return null;
  }
}
