/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-022 — AI Search 후보를 «기존» Identity 경로에 연결하는 다리
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 파일이 왜 필요한가 — 019A 하니스 둘 사이에 **이음새가 없었다**:
 *
 *   ① mi-019a-search-ingest   rawAnswer → 후보 URL → **Discovery 집계까지**
 *                             🔴 후보 페이지를 열지 않고 MI 도 부르지 않는다
 *   ② mi-019a-ai-vs-mi-bench  **고정된 14 쌍**(CASES)만 fetch → MI → GT → KPI
 *                             🔴 caseId 가 미리 있어야 하고 GT 가 미리 적혀 있어야 한다
 *
 *   → AI 가 «새로» 찾아온 URL 은 caseId 도 GT 도 없어서 ②에 들어갈 수 없다.
 *     이 파일이 그 구간을 잇는다. 🔴 **새 MI 도 새 추출기도 만들지 않는다** —
 *     ①의 export 와 ②의 운영 호출 경로를 그대로 가져다 쓴다.
 *
 * 🔴 금지 전수(이 파일이 지키는 것): 새 검색엔진 0 · 새 URL 파서 0 · 새 Identity 0 ·
 *    threshold 0 · 색상사전 0 · PRESUMED_SAME 정책 0 · 운영 코드 0 · DB 0 · AI API 0.
 *
 * 🔴🔴 GT 규칙 — 이 파일의 가장 중요한 불변식:
 *    **GT 를 MI 에서 파생하지 않는다.** GT 는 사람이 독립 증거(품번·모델명·색상·옵션)로
 *    적어 넣는 «별 파일» 이고, `gtToken` 으로 **관측된 제목과 대조** 해 깨진 GT 를
 *    측정 «전» 에 잡는다(019A §3 의 장치를 그대로 쓴다).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { withConfidence } from "../match";
import { factsFromProductUrl, type ProductUrlFactsResult } from "../product-url-facts";
/* 🔴 원상품 조회 키를 «문자열 완전일치» 로 쓰면 안 된다 — 덤프의 source_url 에 Shopify
   검색문맥(`?_pos=1&_sid=…&_ss=r`)이 붙어 있어 S4 가 통째로 빠졌다(WU-022-2 결측).
   🟢 새 규칙을 만들지 않고 기존 owner 를 쓴다(WU-009-C). */
import { canonicalizeProductUrl } from "../self-reference";
import type { ComparisonCandidate, ComparisonQuery } from "../types";
/* 🟢 ①의 export 를 **그대로** 쓴다 — 작업표·검증기·추출을 다시 쓰지 않는다. */
import { SEARCH_TARGETS, validateSearchFile, discoveryRowsOf } from "./mi-019a-search-ingest.test";
/* 🟢 ②의 정규화 축을 **그대로** 쓴다 — strict / threeWay 두 축을 새로 정의하지 않는다. */
import { normalizeMi, normalizeAiVerdict, type Gt, type ThreeWay } from "./__fixtures__/mi-identity-benchmark";

const LIVE = process.env.MI_022_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH_FILE = path.join(OUT_DIR, "mi-019a-search-results.json");
const GT_FILE = path.join(OUT_DIR, "mi-022-gt.json");
const AI_FILE = path.join(OUT_DIR, "mi-022-ai-verdicts.json");
const ORIGIN_DUMP = path.join(OUT_DIR, "mi-017-e2e-cases.json");

/* ──────────────────────────────────────────────────────────────────────────
 * GT 파일 규격 — 🔴 MI 필드가 **없다**. 구조로 오염을 막는다.
 * ────────────────────────────────────────────────────────────────────────── */
export interface GtEntry {
  searchId: string;
  candidateUrl: string;
  gt: Gt;
  /** 🔴 비어 있으면 거부한다 — 「근거 없는 GT」를 측정에 넣지 않는다. */
  gtReason: string;
  /** 🔴 관측된 제목과 대조할 토큰(019A §3). 없으면 대조를 건너뛰되 그 사실을 적는다. */
  gtToken?: { mustInclude?: string[]; mustExclude?: string[] };
}

export interface GtValidation {
  entries: GtEntry[];
  rejected: { index: number; reason: string }[];
}

/**
 * 🔴 모르는 searchId · 빈 gt/gtReason · 중복 (searchId,url) · 비배열을 **거부** 한다.
 * 🔴 빠진 후보를 **채우지 않는다** — 누락은 누락으로 보고된다.
 */
export function validateGtFile(raw: unknown, knownIds: readonly string[]): GtValidation {
  const entries: GtEntry[] = [];
  const rejected: { index: number; reason: string }[] = [];
  if (!Array.isArray(raw)) return { entries, rejected: [{ index: -1, reason: "최상위가 배열이 아니다" }] };
  const seen = new Set<string>();
  raw.forEach((r, index) => {
    const row = r as Partial<GtEntry>;
    if (!row || typeof row !== "object") return void rejected.push({ index, reason: "객체가 아니다" });
    if (typeof row.searchId !== "string" || !knownIds.includes(row.searchId))
      return void rejected.push({ index, reason: `모르는 searchId: ${String(row.searchId)}` });
    if (typeof row.candidateUrl !== "string" || row.candidateUrl.trim() === "")
      return void rejected.push({ index, reason: "candidateUrl 누락" });
    if (row.gt !== "SAME" && row.gt !== "DIFFERENT")
      return void rejected.push({ index, reason: `gt 는 SAME|DIFFERENT 만: ${String(row.gt)}` });
    if (typeof row.gtReason !== "string" || row.gtReason.trim() === "")
      return void rejected.push({ index, reason: "gtReason 이 비었다 — 근거 없는 GT 를 받지 않는다" });
    const key = `${row.searchId}::${row.candidateUrl}`;
    if (seen.has(key)) return void rejected.push({ index, reason: `중복: ${key}` });
    seen.add(key);
    entries.push(row as GtEntry);
  });
  return { entries, rejected };
}

/** 🔴 GT 가 실제 페이지와 어긋나면 **측정 전에** 깨뜨린다(019A §3 장치). */
export function gtTokenMismatch(entry: GtEntry, observedTitle: string | null): string | null {
  if (!entry.gtToken || observedTitle == null) return null;
  const t = observedTitle.toLowerCase();
  for (const m of entry.gtToken.mustInclude ?? []) if (!t.includes(m.toLowerCase())) return `mustInclude 불일치: ${m}`;
  for (const m of entry.gtToken.mustExclude ?? []) if (t.includes(m.toLowerCase())) return `mustExclude 위반: ${m}`;
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * KPI — 🔴 축 이름을 여기서 고정한다. `recall` 이라는 칸을 만들지 않는다.
 * ────────────────────────────────────────────────────────────────────────── */
export interface AxisKpi {
  n: number;
  accuracy: number | null;
  /** SAME 으로 «올린» 것 중 GT SAME 비율. 🔴 UNCERTAIN 은 분자·분모 모두에서 뺀다. */
  precisionSame: number | null;
  falseSame: number;
  missedSame: number;
}

export function axisKpi(rows: { gt: Gt; call: ThreeWay | null }[]): AxisKpi {
  const scored = rows.filter((r) => r.call != null);
  const correct = scored.filter((r) => (r.call === "SAME") === (r.gt === "SAME")).length;
  const saidSame = scored.filter((r) => r.call === "SAME");
  return {
    n: scored.length,
    accuracy: scored.length ? correct / scored.length : null,
    precisionSame: saidSame.length ? saidSame.filter((r) => r.gt === "SAME").length / saidSame.length : null,
    falseSame: saidSame.filter((r) => r.gt === "DIFFERENT").length,
    missedSame: scored.filter((r) => r.call !== "SAME" && r.gt === "SAME").length,
  };
}

export interface Quadrant {
  aiSame_miSame: number;
  aiSame_miDiff: number;
  aiDiff_miSame: number;
  aiDiff_miDiff: number;
  agreement: number | null;
  aiOnlyCorrect: number;
  miOnlyCorrect: number;
  bothCorrect: number;
  bothWrong: number;
}

export function quadrantOf(rows: { gt: Gt; ai: ThreeWay | null; mi: ThreeWay | null }[]): Quadrant {
  const both = rows.filter((r) => r.ai != null && r.mi != null);
  const q: Quadrant = {
    aiSame_miSame: 0, aiSame_miDiff: 0, aiDiff_miSame: 0, aiDiff_miDiff: 0,
    agreement: both.length ? both.filter((r) => r.ai === r.mi).length / both.length : null,
    aiOnlyCorrect: 0, miOnlyCorrect: 0, bothCorrect: 0, bothWrong: 0,
  };
  for (const r of both) {
    const a = r.ai === "SAME", m = r.mi === "SAME";
    if (a && m) q.aiSame_miSame++; else if (a && !m) q.aiSame_miDiff++;
    else if (!a && m) q.aiDiff_miSame++; else q.aiDiff_miDiff++;
    const aOk = a === (r.gt === "SAME"), mOk = m === (r.gt === "SAME");
    if (aOk && mOk) q.bothCorrect++; else if (aOk) q.aiOnlyCorrect++;
    else if (mOk) q.miOnlyCorrect++; else q.bothWrong++;
  }
  return q;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ① 계약 — AI 데이터 0 · HTTP 0 에서 항상 돈다
 * ══════════════════════════════════════════════════════════════════════════ */
describe("WU-022 ① GT 검증기 (AI 0 · HTTP 0)", () => {
  const ids = SEARCH_TARGETS.map((t) => t.searchId);

  it("🟢 정상 입력을 받는다", () => {
    const v = validateGtFile(
      [{ searchId: "S1", candidateUrl: "https://x/p/1", gt: "SAME", gtReason: "품번 B226AC010 일치" }],
      ids,
    );
    expect(v.entries).toHaveLength(1);
    expect(v.rejected).toHaveLength(0);
  });

  it("🔴 모르는 searchId · 빈 gtReason · 중복 · 비배열을 **거부하고 이유를 남긴다**", () => {
    const v = validateGtFile(
      [
        { searchId: "S9", candidateUrl: "https://x/1", gt: "SAME", gtReason: "r" },
        { searchId: "S1", candidateUrl: "https://x/2", gt: "SAME", gtReason: "   " },
        { searchId: "S1", candidateUrl: "https://x/3", gt: "MAYBE", gtReason: "r" },
        { searchId: "S1", candidateUrl: "https://x/4", gt: "SAME", gtReason: "r" },
        { searchId: "S1", candidateUrl: "https://x/4", gt: "DIFFERENT", gtReason: "r" },
      ],
      ids,
    );
    expect(v.entries).toHaveLength(1);
    expect(v.rejected).toHaveLength(4);
    expect(v.rejected.map((r) => r.reason).join(" ")).toContain("gtReason 이 비었다");
    expect(validateGtFile({ not: "array" }, ids).rejected[0]?.reason).toContain("배열이 아니다");
  });

  it("🔴🔴 GT 규격에 **MI 칸이 없다** — MI 를 GT 로 복사할 자리를 구조로 없앤다", () => {
    const v = validateGtFile(
      [{ searchId: "S1", candidateUrl: "https://x/1", gt: "SAME", gtReason: "r", miRaw: "SAME", crossSellerVerdict: "SAME" } as never],
      ids,
    );
    expect(v.entries).toHaveLength(1);
    /* 🔴 들어와도 **읽지 않는다** — 집계가 쓰는 칸은 gt 하나다. */
    expect(Object.keys(v.entries[0]!)).toContain("gt");
    const row = v.entries[0] as unknown as Record<string, unknown>;
    expect(axisKpi([{ gt: row.gt as Gt, call: "SAME" }]).falseSame).toBe(0);
  });

  it("🔴 gtToken 이 관측 제목과 어긋나면 **측정 전에** 잡는다", () => {
    const e: GtEntry = { searchId: "S1", candidateUrl: "u", gt: "SAME", gtReason: "r", gtToken: { mustInclude: ["booty"], mustExclude: ["monster"] } };
    expect(gtTokenMismatch(e, "Booty Ghosts T-Shirt")).toBeNull();
    expect(gtTokenMismatch(e, "Hug Hairy Monster T-Shirt")).toContain("mustInclude");
    expect(gtTokenMismatch(e, "Booty Monster")).toContain("mustExclude");
    /* 🔴 제목을 못 읽었으면 «통과» 가 아니라 대조 불가다 — null 을 「일치」로 쓰지 않는다. */
    expect(gtTokenMismatch(e, null)).toBeNull();
  });
});

describe("WU-022 ② KPI 축 (AI 0 · HTTP 0)", () => {
  it("🔴 UNCERTAIN 은 Precision 분자·분모에 **들어가지 않는다**", () => {
    const k = axisKpi([
      { gt: "SAME", call: "SAME" },
      { gt: "DIFFERENT", call: "UNCERTAIN" },
      { gt: "SAME", call: "UNCERTAIN" },
    ]);
    expect(k.precisionSame).toBe(1);
    expect(k.falseSame).toBe(0);
    /* 🔴 UNCERTAIN + GT **SAME** 만 missed-SAME 이다 — 여기서는 1건이다.
       🔴 UNCERTAIN + GT DIFFERENT 는 missed 가 아니다(놓친 SAME 이 없다).
       🔴 그리고 accuracy 분모에는 셋이 다 들어간다 — Precision 분모와 «다른 분모» 다. */
    expect(k.missedSame).toBe(1);
    expect(k.n).toBe(3);
    expect(k.accuracy).toBeCloseTo(2 / 3);
  });

  it("🔴 판정이 없는 행(fetch 실패 등)은 **0 이 아니라 분모에서 빠진다**", () => {
    expect(axisKpi([{ gt: "SAME", call: null }]).n).toBe(0);
    expect(axisKpi([{ gt: "SAME", call: null }]).accuracy).toBeNull();
  });

  it("🟢 PRESUMED_SAME 은 strict/threeWay **두 축으로 갈린다** — 정책이 아니라 집계 라벨", () => {
    expect(normalizeMi("PRESUMED_SAME")).toEqual({ strict: "SAME", threeWay: "UNCERTAIN" });
    expect(normalizeMi("SAME")).toEqual({ strict: "SAME", threeWay: "SAME" });
  });

  it("🔴 AI 정규화는 **세 값만** 받는다 — confidence·가격·산문을 읽지 않는다", () => {
    expect(normalizeAiVerdict("SAME")).toBe("SAME");
    expect(normalizeAiVerdict("SAME (0.95)")).toBeNull();
    expect(normalizeAiVerdict("동일상품 ₩49,000")).toBeNull();
  });

  it("🟢 4분면 · Agreement · only-correct 가 AI×MI×GT 로 갈린다", () => {
    const q = quadrantOf([
      { gt: "SAME", ai: "SAME", mi: "SAME" },
      { gt: "SAME", ai: "SAME", mi: "DIFFERENT" },
      { gt: "DIFFERENT", ai: "SAME", mi: "DIFFERENT" },
      { gt: "DIFFERENT", ai: "DIFFERENT", mi: "SAME" },
    ]);
    expect(q.aiSame_miSame).toBe(1);
    expect(q.aiSame_miDiff).toBe(2);
    expect(q.aiDiff_miSame).toBe(1);
    expect(q.bothCorrect).toBe(1);
    expect(q.aiOnlyCorrect).toBe(2);
    expect(q.miOnlyCorrect).toBe(1);
    expect(q.agreement).toBeCloseTo(0.25);
  });

  it("🔴 KPI 에 `recall` 칸을 만들지 않는다 — Discovery 는 known-positive 축이다", () => {
    const k = axisKpi([{ gt: "SAME", call: "SAME" }]) as unknown as Record<string, unknown>;
    expect(Object.keys(k)).not.toContain("recall");
    expect(Object.keys(quadrantOf([]) as unknown as Record<string, unknown>)).not.toContain("recall");
  });
});

describe("WU-022 ③-b 원상품 조회 키는 **정규화된 URL** 이다 (WU-022-2 S4 결측의 원인)", () => {
  /* 🔴 실제로 덤프에 들어 있던 모양이다 — 이 꼬리 때문에 S4 가 11후보째 통째로 빠졌다. */
  const DUMPED = "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story?_pos=1&_sid=a0738e824&_ss=r";
  const TARGET = "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story";

  it("🔴🔴 문자열 완전일치는 **실패한다** — 그것이 결측의 원인이었다", () => {
    expect(DUMPED).not.toBe(TARGET);
  });

  it("🟢 canonicalizeProductUrl 로 조회하면 **같은 키** 가 된다 (새 규칙 0 · 기존 owner 재사용)", () => {
    expect(canonicalizeProductUrl(DUMPED)).toBe(canonicalizeProductUrl(TARGET));
  });

  it("🔴 로케일·경로·식별 파라미터는 **보존된다** — 시장을 뭉개지 않는다", () => {
    const k = canonicalizeProductUrl(DUMPED);
    expect(k).toContain("/en-kr/");
    expect(k).toContain("bubble-sweatshirt-in-grey-melange-by-main-story");
    expect(canonicalizeProductUrl("https://x.com/p/1?variant=42")).toContain("variant=42");
  });
});

describe("WU-022 ③ 작업표는 019A-SEARCH 와 **같은 배열** 이다 (사본 금지)", () => {
  it("🟢 원상품 6건 · known-positive 분모는 5 (S3 제외)", () => {
    expect(SEARCH_TARGETS).toHaveLength(6);
    expect(SEARCH_TARGETS.filter((t) => t.knownAnswerReachable)).toHaveLength(5);
    expect(SEARCH_TARGETS.find((t) => t.searchId === "S3")!.knownAnswerReachable).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * ④ LIVE — 🔴 기본 SKIP. 후보 페이지 GET 이 일어나므로 명시 opt-in 이다.
 *    MI_022_LIVE=1
 * ══════════════════════════════════════════════════════════════════════════ */
const describeLive = LIVE ? describe : describe.skip;

describeLive("WU-022 ④ AI 후보 → fetch → MI → GT → KPI (실측)", () => {
  it(
    "rawAnswer 가 있으면 후보를 열어 MI 를 재고, GT 가 있으면 AI vs MI 를 낸다",
    async () => {
      mkdirSync(OUT_DIR, { recursive: true });
      const ids = SEARCH_TARGETS.map((t) => t.searchId);

      if (!existsSync(SEARCH_FILE)) {
        console.log(
          `\n🔴🔴 **측정불가** — ${SEARCH_FILE} 없음. 「AI 가 못 찾았다」가 아니다.\n` +
            `   🟢 수집 규격: docs/AI-SEARCH-COLLECTION-019A-SEARCH.md\n` +
            `   🟢 작업량: 원상품 **6건** × 모델 수`,
        );
        expect(existsSync(SEARCH_FILE)).toBe(false);
        return;
      }
      if (!existsSync(ORIGIN_DUMP)) throw new Error(`선행 덤프 없음: ${ORIGIN_DUMP}`);

      const originRows = JSON.parse(readFileSync(ORIGIN_DUMP, "utf8")) as {
        source_url: string;
        canonical_product: Record<string, unknown>;
      }[];
      const byUrl = new Map(originRows.map((r) => [canonicalizeProductUrl(r.source_url), r]));

      const sv = validateSearchFile(JSON.parse(readFileSync(SEARCH_FILE, "utf8")), ids);
      const drows = discoveryRowsOf(sv.entries);

      /* ── ① 후보 fetch — 🔴 GT·AI 파일을 **읽기 전에** 끝낸다(주입 불가 구조) ── */
      const factsCache = new Map<string, ProductUrlFactsResult>();
      let httpCalls = 0;
      for (const url of new Set(drows.flatMap((r) => r.candidates))) {
        try {
          const f = await factsFromProductUrl(url);
          httpCalls += f.httpCalls;
          factsCache.set(url, f);
        } catch {
          factsCache.set(url, { status: "UNREACHABLE", crawlerUrl: null, dedupeKey: null, candidate: null, httpCalls: 1, fetchPath: "PLAIN_HTML" });
          httpCalls += 1;
        }
      }

      /* ── ② MI — 🔴 운영 경로 그대로(019A 와 같은 함수·같은 순서) ───────────── */
      interface Row { searchId: string; model: string; candidateUrl: string; observedTitle: string | null; factsStatus: string; miRaw: string | null; miStrict: ThreeWay | null; miThreeWay: ThreeWay | null }
      const rows: Row[] = [];
      const missingOrigin: string[] = [];
      for (const dr of drows) {
        const target = SEARCH_TARGETS.find((t) => t.searchId === dr.searchId)!;
        const origin = byUrl.get(canonicalizeProductUrl(target.sourceUrl));
        if (!origin) { missingOrigin.push(dr.searchId); continue; }
        const dna = buildProductIdentityDna(origin.canonical_product as never);
        const query: ComparisonQuery = {
          title: dna.title.replace(/^\s*\[[^\]]*\]\s*/, "").trim(),
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          facts: productFactsFromIdentityDna(dna),
        };
        const ok = dr.candidates.filter((u) => factsCache.get(u)?.status === "OK");
        const scored = ok.length ? withConfidence(query, ok.map((u) => factsCache.get(u)!.candidate as ComparisonCandidate)) : [];
        const scoredByUrl = new Map(scored.map((c) => [c.url, c]));
        for (const u of dr.candidates) {
          const f = factsCache.get(u)!;
          const cand = f.candidate ? scoredByUrl.get(f.candidate.url) ?? null : null;
          const mi = cand ? normalizeMi(cand.crossSellerVerdict ?? null) : null;
          rows.push({ searchId: dr.searchId, model: dr.model, candidateUrl: u, observedTitle: cand?.title ?? null, factsStatus: f.status, miRaw: cand?.crossSellerVerdict ?? null, miStrict: mi?.strict ?? null, miThreeWay: mi?.threeWay ?? null });
        }
      }
      console.log(`\n══ WU-022  후보 ${rows.length}건 · HTTP ${httpCalls}회 · 원상품 덤프 누락 ${missingOrigin.length}건 ${missingOrigin.join(",")}`);

      /* ── ③ GT — 🔴 없으면 «작업표» 를 써내고 측정불가로 끝낸다 ─────────────── */
      if (!existsSync(GT_FILE)) {
        const worklist = rows.map((r) => ({ searchId: r.searchId, candidateUrl: r.candidateUrl, observedTitle: r.observedTitle, factsStatus: r.factsStatus, gt: "<SAME|DIFFERENT>", gtReason: "<독립 증거: 품번/모델명/색상/옵션>" }));
        writeFileSync(path.join(OUT_DIR, "mi-022-gt-worklist.json"), JSON.stringify(worklist, null, 2), "utf8");
        console.log(`  🔴 GT **측정불가** — ${GT_FILE} 없음. 작업표를 썼다: mi-022-gt-worklist.json`);
        console.log(`  🔴 GT 를 MI 에서 복사하지 않는다 — 독립 증거로 적는다.`);
        expect(rows.length).toBeGreaterThan(0);
        return;
      }

      const gv = validateGtFile(JSON.parse(readFileSync(GT_FILE, "utf8")), ids);
      const gtByKey = new Map(gv.entries.map((e) => [`${e.searchId}::${e.candidateUrl}`, e]));

      /* 🔴 GT 가 «아직 없는» 행을 항상 내보낸다 — 「미검증 후보 별도 분리」가 규격이고,
         조용히 빠지면 분모가 줄어든 것을 아무도 못 본다. */
      const ungated = rows.filter((r) => !gtByKey.has(`${r.searchId}::${r.candidateUrl}`));
      writeFileSync(
        path.join(OUT_DIR, "mi-022-gt-worklist.json"),
        JSON.stringify(ungated.map((r) => ({ searchId: r.searchId, candidateUrl: r.candidateUrl, observedTitle: r.observedTitle, factsStatus: r.factsStatus, miRaw: r.miRaw, gt: "<SAME|DIFFERENT>", gtReason: "<독립 증거>" })), null, 2),
        "utf8",
      );
      console.log(`  🟡 GT 미부여 ${ungated.length}건 → mi-022-gt-worklist.json (🔴 분모에서 빠진다)`);
      const broken: string[] = [];
      const joined = rows.flatMap((r) => {
        const g = gtByKey.get(`${r.searchId}::${r.candidateUrl}`);
        if (!g) return [];
        const mm = gtTokenMismatch(g, r.observedTitle);
        if (mm) { broken.push(`${r.searchId} ${r.candidateUrl}: ${mm}`); return []; }
        return [{ ...r, gt: g.gt }];
      });
      if (broken.length) console.log(`  🔴 GT 토큰 불일치 ${broken.length}건 — **측정에서 뺐다**: ${broken.join(" | ")}`);

      /* ── ④ AI 축 — 🔴 없으면 AI KPI 는 측정불가다(0% 가 아니다) ───────────── */
      const aiRaw = existsSync(AI_FILE) ? (JSON.parse(readFileSync(AI_FILE, "utf8")) as { searchId: string; candidateUrl: string; verdict: string }[]) : [];
      const aiByKey = new Map(aiRaw.map((a) => [`${a.searchId}::${a.candidateUrl}`, normalizeAiVerdict(a.verdict)]));

      const final = joined.map((r) => ({ ...r, ai: aiByKey.get(`${r.searchId}::${r.candidateUrl}`) ?? null }));
      const summary = {
        httpCalls,
        candidates: rows.length,
        gtJoined: final.length,
        gtRejected: gv.rejected,
        gtTokenBroken: broken,
        /* 🔴 Discovery 분모는 «정답이 열리는» 원상품만(S3 제외). */
        knownPositiveDiscoveryRate: (() => {
          const scope = drows.filter((d) => SEARCH_TARGETS.find((t) => t.searchId === d.searchId)!.knownAnswerReachable);
          return `${scope.filter((d) => d.knownAnswersFound.length > 0).length}/${scope.length}`;
        })(),
        unverifiedNew: drows.reduce((a, d) => a + d.unverifiedNew.length, 0),
        miStrict: axisKpi(final.map((r) => ({ gt: r.gt, call: r.miStrict }))),
        miThreeWay: axisKpi(final.map((r) => ({ gt: r.gt, call: r.miThreeWay }))),
        ai: aiRaw.length ? axisKpi(final.map((r) => ({ gt: r.gt, call: r.ai }))) : "측정불가 — AI verdict 파일 없음",
        quadrantVsStrict: aiRaw.length ? quadrantOf(final.map((r) => ({ gt: r.gt, ai: r.ai, mi: r.miStrict }))) : "측정불가",
        quadrantVsThreeWay: aiRaw.length ? quadrantOf(final.map((r) => ({ gt: r.gt, ai: r.ai, mi: r.miThreeWay }))) : "측정불가",
      };
      console.log(JSON.stringify(summary, null, 2));
      writeFileSync(path.join(OUT_DIR, "mi-022-result.json"), JSON.stringify({ rows: final, summary }, null, 2), "utf8");
      expect(final.length).toBeGreaterThan(0);
    },
    20 * 60_000,
  );
});
