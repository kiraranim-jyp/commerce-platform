/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-019A-SEARCH — **AI Search 결과 수집/분석 파이프라인** (AI 호출 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CTO 는 AI 검색을 대신하지 않는다.** Gemini API 0 · GPT API 0 · 키 0 ·
 *    비용 0 · 자동 브라우저 0 · 소비자 AI UI 자동화 0. 사람이 수집한 **답변 원문** 을
 *    파일로 받는다. 🔴 **AI Search 결과가 들어오기 전에는 AI Accuracy 를 계산하지 않는다.**
 *
 * ── 🔴 CPO 가 정정한 순서를 그대로 구현한다 ────────────────────────────────
 * ```
 * ① AI Search(사람 수집 · raw 보존)
 *      ↓  이 파일
 * ② 후보 URL 추출            ← WU-017-1 `extractCandidateUrlsFromAiAnswer` **재사용**
 *      ↓                        🔴 AI 의 「동일상품입니다」 문장은 증거가 아니다
 * ③ 따져가 URL 검증          ← WU-017-2 경로(`factsFromProductUrl`) · 별 단계
 *      ↓
 * ④ AI Identity vs MI Identity ← WU-019A / 019A-EXT 가 담당(여기서 하지 않는다)
 * ```
 *
 * ── 🔴🔴 Discovery 지표의 분모를 **과장하지 않는다** ───────────────────────
 * ```
 * 우리가 가진 「정답 후보」는 019A 의 GT=SAME 7건이고 그것은 **하한** 이다.
 * 🔴 그래서 「후보 Recall」이라고 쓰지 않는다 — 전수 정답 집합이 없다.
 *    적을 수 있는 것은 **「알려진 정답 후보를 찾았는가」** 하나다.
 * 🔴 AI 가 우리 목록에 «없는» URL 을 가져오면 그것을 **오탐으로 세지 않는다** —
 *    「미검증 신규 후보」 다. 진짜 동일상품일 수 있고, 판정은 ③④가 한다.
 * 🔴 「Search 실패 ≠ 후보 실패 ≠ Identity 실패」를 섞지 않는다(CPO).
 * ```
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "../ai-answer-urls";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH_FILE = path.join(OUT_DIR, "mi-019a-search-results.json");

/**
 * 🟢 **원상품 6건** — 🔴 019A 의 14건은 (원상품, 후보) **쌍** 이고 원상품은 6개다.
 *    Search 작업은 원상품 단위이므로 작업량은 **6 × 모델 수** 다(14 가 아니다).
 * 🔴 `knownAnswers` 는 019A 에서 GT=SAME 으로 확정된 후보이고 **하한** 이다.
 */
export const SEARCH_TARGETS: {
  searchId: string;
  sourceUrl: string;
  knownAnswers: string[];
  /** 🔴 그 정답이 지금도 열리는가 — 019A 실측값. 안 열리면 Discovery 분모에서 뺀다. */
  knownAnswerReachable: boolean;
}[] = [
  { searchId: "S1", sourceUrl: "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
    knownAnswers: ["https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt"], knownAnswerReachable: true },
  { searchId: "S2", sourceUrl: "https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses",
    knownAnswers: ["https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt"], knownAnswerReachable: true },
  /** 🔴 019A 실측에서 이 정답 URL 은 **404** 였다(상품이 사라졌다). */
  { searchId: "S3", sourceUrl: "https://www.junioredition.com/en-kr/products/curious-turnip-all-over-swim-cap-by-bobo-choses",
    knownAnswers: ["https://bobochoses.com/products/b126ai018-curious-turnip-all-over-swim-cap"], knownAnswerReachable: false },
  { searchId: "S4", sourceUrl: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
    knownAnswers: ["https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/2"], knownAnswerReachable: true },
  { searchId: "S5", sourceUrl: "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe",
    knownAnswers: [
      "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592",
      "https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=62&display_group=1",
    ], knownAnswerReachable: true },
  { searchId: "S6", sourceUrl: "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket",
    knownAnswers: ["https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket"], knownAnswerReachable: true },
];

export interface SearchEntry {
  searchId: string;
  model: string;
  /** 🔴 **AI 답변 원문 전체.** 가공하지 않는다 — 추출은 우리가 한다. */
  rawAnswer: string;
}

export interface SearchValidation {
  entries: SearchEntry[];
  rejected: { index: number; searchId: string | null; why: string }[];
  models: string[];
  missingByModel: Record<string, string[]>;
}

/** 🔴 순수 함수 — AI 데이터 없이도 테스트된다. 🔴 빈 답변을 「후보 0」으로 **묻지 않는다**. */
export function validateSearchFile(raw: unknown, knownIds: readonly string[]): SearchValidation {
  const entries: SearchEntry[] = [];
  const rejected: SearchValidation["rejected"] = [];
  if (!Array.isArray(raw)) {
    return { entries, rejected: [{ index: -1, searchId: null, why: "최상위가 배열이 아니다" }], models: [], missingByModel: {} };
  }
  raw.forEach((row, index) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const searchId = typeof r.searchId === "string" ? r.searchId : null;
    if (!searchId) return void rejected.push({ index, searchId: null, why: "searchId 없음" });
    if (!knownIds.includes(searchId)) return void rejected.push({ index, searchId, why: "작업표에 없는 searchId" });
    const model = typeof r.model === "string" && r.model.trim() ? r.model.trim() : null;
    if (!model) return void rejected.push({ index, searchId, why: "model 없음 — 모델별 비교가 목적이라 필수다" });
    const rawAnswer = typeof r.rawAnswer === "string" ? r.rawAnswer : "";
    if (!rawAnswer.trim()) return void rejected.push({ index, searchId, why: "rawAnswer 가 비었다 — 「후보 0」과 구분해야 한다" });
    if (entries.some((e) => e.model === model && e.searchId === searchId)) {
      return void rejected.push({ index, searchId, why: `중복 (model=${model})` });
    }
    entries.push({ searchId, model, rawAnswer });
  });
  const models = [...new Set(entries.map((e) => e.model))].sort();
  const missingByModel: Record<string, string[]> = {};
  for (const m of models) {
    const have = new Set(entries.filter((e) => e.model === m).map((e) => e.searchId));
    missingByModel[m] = knownIds.filter((i) => !have.has(i));
  }
  return { entries, rejected, models, missingByModel };
}

/** 🟢 비교용 느슨한 동일 URL 판정 — host+경로 소문자, 쿼리 제거. 🔴 판정기가 아니다. */
function sameUrlish(a: string, b: string): boolean {
  const n = (u: string): string => {
    try {
      const x = new URL(decodeURI(u));
      return `${x.hostname.replace(/^www\./, "").toLowerCase()}${decodeURIComponent(x.pathname).toLowerCase().replace(/\/+$/, "")}`;
    } catch {
      return u.toLowerCase();
    }
  };
  return n(a) === n(b);
}

export interface DiscoveryRow {
  searchId: string;
  model: string;
  /** 추출된 후보 URL(017-1 통과분). */
  candidates: string[];
  /** 017-1 이 거른 것 + 이유. */
  dropped: { url: string; reason: string }[];
  /** 텍스트에서 발견한 URL 총수(분모). */
  foundCount: number;
  /** 🟢 알려진 정답 중 **찾은 것**. */
  knownAnswersFound: string[];
  /** 🔴 우리 목록에 없는 URL — **오탐이 아니다.** 「미검증 신규 후보」 다. */
  unverifiedNew: string[];
}

/** 🔴 Search 답변 → 후보 URL. **새 파서를 만들지 않는다**(017-1 재사용). */
export function discoveryRowsOf(entries: readonly SearchEntry[]): DiscoveryRow[] {
  return entries.map((e) => {
    const target = SEARCH_TARGETS.find((t) => t.searchId === e.searchId)!;
    /* 🔴 자기참조 제거 기준도 017-1 그대로 — 원상품 자신을 후보로 세지 않는다. */
    const ex = extractCandidateUrlsFromAiAnswer(e.rawAnswer, target.sourceUrl);
    const found = target.knownAnswers.filter((k) => ex.urls.some((u) => sameUrlish(u, k)));
    return {
      searchId: e.searchId,
      model: e.model,
      candidates: ex.urls,
      dropped: ex.dropped.map((d) => ({ url: d.url, reason: d.reason })),
      foundCount: ex.foundCount,
      knownAnswersFound: found,
      unverifiedNew: ex.urls.filter((u) => !target.knownAnswers.some((k) => sameUrlish(u, k))),
    };
  });
}

describe("WU-019A-SEARCH ① 수집 파일 검증기 (AI 0 · HTTP 0)", () => {
  const ids = SEARCH_TARGETS.map((t) => t.searchId);

  it("🟢 작업표는 **원상품 6건** 이다 — 019A 의 14 는 (원상품,후보) 쌍 수다", () => {
    expect(SEARCH_TARGETS).toHaveLength(6);
    expect(SEARCH_TARGETS.flatMap((t) => t.knownAnswers)).toHaveLength(7);
    /* 🔴 S3 의 정답은 404 라 Discovery 분모에서 빠진다. */
    expect(SEARCH_TARGETS.filter((t) => !t.knownAnswerReachable).map((t) => t.searchId)).toEqual(["S3"]);
  });

  it("🔴 model 누락 · 빈 rawAnswer · 모르는 searchId · 중복을 **거부하고 이유를 남긴다**", () => {
    const v = validateSearchFile(
      [
        { searchId: "S1", rawAnswer: "x" },
        { searchId: "S1", model: "gemini", rawAnswer: "   " },
        { searchId: "ZZ", model: "gemini", rawAnswer: "x" },
        { searchId: "S1", model: "gemini", rawAnswer: "후보: https://a.com/products/x" },
        { searchId: "S1", model: "gemini", rawAnswer: "또" },
      ],
      ids,
    );
    expect(v.entries).toHaveLength(1);
    expect(v.rejected.map((r) => r.why.replace(/ —.*$/, "").replace(/:.*$/, ""))).toEqual([
      "model 없음",
      "rawAnswer 가 비었다",
      "작업표에 없는 searchId",
      "중복 (model=gemini)",
    ]);
    expect(v.missingByModel.gemini).toEqual(["S2", "S3", "S4", "S5", "S6"]);
  });

  it("🔴 빈 답변을 「후보 0」으로 묻지 않는다 — 둘은 다른 상태다", () => {
    const empty = validateSearchFile([{ searchId: "S1", model: "gpt", rawAnswer: "" }], ids);
    expect(empty.entries).toEqual([]);
    const noCandidate = validateSearchFile([{ searchId: "S1", model: "gpt", rawAnswer: "동일상품을 찾지 못했습니다." }], ids);
    expect(noCandidate.entries).toHaveLength(1);
    expect(discoveryRowsOf(noCandidate.entries)[0].candidates).toEqual([]);
  });

  it("🟢 추출은 017-1 을 그대로 쓴다 — 알려진 정답은 «찾음», 나머지는 «미검증 신규»", () => {
    const rows = discoveryRowsOf([
      {
        searchId: "S1",
        model: "gemini",
        rawAnswer: `동일상품입니다(확신 95%).
1. https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt?utm_source=x
2. https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt
3. https://bobochoses.com/collections/new-arrivals-kid
4. ${SEARCH_TARGETS[0].sourceUrl}`,
      },
    ]);
    const r = rows[0];
    expect(r.knownAnswersFound).toEqual(["https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt"]);
    /** 🔴 b226ac009 는 **오탐이 아니라** 미검증 신규 후보다(판정은 ③④가 한다). */
    expect(r.unverifiedNew).toEqual(["https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt"]);
    /** 🟢 목록 URL 과 원상품 자기참조는 017-1 이 걸렀다. */
    expect(r.dropped.map((d) => d.reason).sort()).toEqual(["NOT_PRODUCT_PAGE", "SELF_REFERENCE"]);
    expect(r.foundCount).toBe(4);
  });

  it("🔴🔴 AI 의 주장(확신·가격)이 추출 결과에 **들어오지 않는다**", () => {
    const rows = discoveryRowsOf([
      { searchId: "S5", model: "gpt", rawAnswer: "확신 99% · 국내 최저가 ₩49,000 · https://www.foretforet.com/shop/shopdetail.html?branduid=10226592" },
    ]);
    expect(JSON.stringify(rows[0])).not.toMatch(/99|49,000|최저가|확신/);
    expect(rows[0].knownAnswersFound).toHaveLength(1);
  });
});

describe("WU-019A-SEARCH ② Discovery 집계", () => {
  it("Search 결과가 있으면 모델별 발견율을 낸다 — 없으면 **측정불가**", () => {
    const ids = SEARCH_TARGETS.map((t) => t.searchId);
    if (!existsSync(SEARCH_FILE)) {
      console.log(
        `\n🔴🔴 AI Search 결과 **측정불가** — ${SEARCH_FILE} 없음.\n` +
          `   🔴 「AI 가 못 찾았다」가 아니다. 아직 수집하지 않았다.\n` +
          `   🟢 작업표/프롬프트/붙여넣기 위치: docs/AI-SEARCH-COLLECTION-019A-SEARCH.md\n` +
          `   🟢 작업량: 원상품 **6건** × 모델 수 (🔴 14 가 아니다 — 14 는 쌍 수다)`,
      );
      expect(existsSync(SEARCH_FILE)).toBe(false);
      return;
    }
    const v = validateSearchFile(JSON.parse(readFileSync(SEARCH_FILE, "utf8")), ids);
    const rows = discoveryRowsOf(v.entries);
    const out: Record<string, unknown> = {};
    console.log(`\n══ WU-019A-SEARCH  원상품 N=${ids.length} · 모델 ${v.models.join(",") || "없음"}`);
    for (const model of v.models) {
      const mine = rows.filter((r) => r.model === model);
      /* 🔴 분모는 **정답이 지금도 열리는** 원상품만(S3 제외). */
      const scopes = mine.filter((r) => SEARCH_TARGETS.find((t) => t.searchId === r.searchId)!.knownAnswerReachable);
      const hit = scopes.filter((r) => r.knownAnswersFound.length > 0);
      out[model] = {
        knownAnswerFound: `${hit.length}/${scopes.length}`,
        candidatesPerSearch: mine.map((r) => `${r.searchId}:${r.candidates.length}`).join(" "),
        unverifiedNewTotal: mine.reduce((a, r) => a + r.unverifiedNew.length, 0),
        noCandidate: mine.filter((r) => r.candidates.length === 0).map((r) => r.searchId),
      };
      console.log(`  [${model}] 알려진 정답 발견 ${hit.length}/${scopes.length} (🔴 「Recall」로 적지 않는다 · 정답 집합은 하한)`);
      console.log(`     후보수 ${(out[model] as Record<string, string>).candidatesPerSearch}`);
      console.log(`     미검증 신규 후보 ${(out[model] as Record<string, number>).unverifiedNewTotal}건 — 🔴 오탐으로 세지 않는다`);
    }
    if (v.rejected.length) console.log(`  🔴 거부 ${v.rejected.length}건: ${JSON.stringify(v.rejected)}`);
    for (const [m, miss] of Object.entries(v.missingByModel)) {
      if (miss.length) console.log(`  🔴 ${m} 미수집 ${miss.length}건: ${miss.join(",")} — **채우지 않았다**`);
    }
    writeFileSync(path.join(OUT_DIR, "mi-019a-search-result.json"), JSON.stringify({ rows, summary: out, rejected: v.rejected, missingByModel: v.missingByModel }, null, 2), "utf8");
    expect(rows.length).toBeGreaterThan(0);
  });
});
