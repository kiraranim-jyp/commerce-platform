import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  toSavedCandidateRows,
  type SavedCandidateRow,
} from "../saved-candidate-rows";
import { candidateReviewRowFromDb, type CandidateReviewRow } from "../candidate-review";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-UX-REFINE-04 **B-3** — 재진입 복원 계약 (순수 축 + 배선 축)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 파일이 답하는 질문은 **하나** 다 —
 * > 「`?resume=` 으로 다시 들어왔을 때, **이미 저장해 둔 후보** 가 Search/Crawl/`/check`
 * >  를 **한 번도 부르지 않고** 화면 데이터로 되돌아오는가 — 그리고 그 복원이
 * >  **가격 집계를 한 글자도 바꾸지 않는가**」
 *
 * ── 🔴 입력은 «운영 실데이터» 다 ────────────────────────────────────────────
 * `fixtures/ux04-b3-reviews.json` 은 운영 `candidate_reviews` 를 read-only 로 덤프한
 * **실제 행** 이다(`packages/database/scripts/ux04-b3-dump.mjs` · 가공 0).
 * 🔴 그 파일이 없거나 비면 **FAIL** 이다 — 분모 0 에서 초록이 되면 「복원이 된다」가
 *    **아무 후보도 없는 상태에서 참** 이 된다(§5-B 가 금지한 그 모양).
 * 🔴 그리고 DB 행을 **손으로 변환하지 않는다** — 운영 변환기(`candidateReviewRowFromDb`)를
 *    그대로 부른다(`price_amount` 가 numeric 이라 **문자열** 로 오는 것이 그 이유다).
 *
 * ── 🟡 분모를 숨기지 않는다 ─────────────────────────────────────────────────
 * 아래 각 describe 머리에 **이 표본의 분모** 를 적는다. `sold_out` 은 운영 전건 null
 * 이라(실측 124행 중 0) **그 축의 운영 분모가 0** 이다 — 그 사실을 그대로 적고
 * 「보존된다」는 **pass-through 단언** 으로만 잠근다(「운영에서 확인됐다」로 적지 않는다).
 */

const FIX = join(__dirname, "fixtures", "ux04-b3-reviews.json");

interface Dump {
  withState: { snapshotId: string; rows: Record<string, unknown>[] };
  legacy: { snapshotId: string; rows: Record<string, unknown>[] };
  unmapped: Record<string, unknown>[];
  sellerUrl: Record<string, unknown>[];
  tierNull: Record<string, unknown>[];
}

const dump = (): Dump => JSON.parse(readFileSync(FIX, "utf8")) as Dump;

/**
 * 🔴🔴 **단언 좌표를 추측하지 않는다.** 1차에 `indexOf("\n}")` 로 잘랐더니
 *    `listSnapshotCandidateReviews(input: {` 의 **인자 타입 닫는 괄호** 에서 끊겨
 *    본문이 빈 채로 FAIL 했다(이 트랙이 세 번 이상 밟은 그 함정).
 * 🟢 최상위 선언은 **0열의 `}`** 로 닫힌다 — 그것을 끝으로 쓴다.
 */
function declBody(src: string, marker: string): string {
  const start = src.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = src.slice(start);
  const end = rest.search(/\n\}/m) >= 0 ? rest.search(/\n\}(?=\s*(\n|$))/m) : -1;
  expect(end).toBeGreaterThan(0);
  return rest.slice(0, end);
}

/** 🔴 주석을 **벗기고** 본다 — 설명문에 금지 어휘가 적혀 있는 것은 위반이 아니다. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** 🔴 운영 변환기를 **그대로** 쓴다 — 하니스가 자기 변환 규칙을 갖지 않는다. */
const asRows = (raw: Record<string, unknown>[]): CandidateReviewRow[] =>
  raw.map((r) => candidateReviewRowFromDb(r));

/* ═══════════════ A. 분모 — 표본이 실재한다 ═══════════════ */

describe("A. 🔴 분모 — 운영 실데이터가 표본에 있다", () => {
  it("A-1 다섯 축 전부 행이 있다(하나라도 0 이면 그 축은 측정불가다)", () => {
    const d = dump();
    expect(d.withState.rows.length).toBeGreaterThan(0);
    expect(d.legacy.rows.length).toBeGreaterThan(0);
    expect(d.unmapped.length).toBeGreaterThan(0);
    expect(d.sellerUrl.length).toBeGreaterThan(0);
    expect(d.tierNull.length).toBeGreaterThan(0);
  });

  it("A-2 🔵 B-2 writer 가 실제로 세 칸을 저장했다 — 복원할 것이 있다", () => {
    const [row] = asRows(dump().withState.rows);
    /** 🔴 이것이 없으면 B-3 은 **복원할 상태가 없는** 상태에서 초록이 된다. */
    expect(row.priceStatus).toBe("VERIFIED_CURRENT");
    expect(row.matchReasons.length).toBeGreaterThan(0);
  });

  it("A-3 🟡 `sold_out` 운영 분모는 **0** 이다 — 이 사실을 표본이 말한다", () => {
    const all = [
      ...asRows(dump().withState.rows),
      ...asRows(dump().legacy.rows),
      ...asRows(dump().sellerUrl),
    ];
    /** 🔴 전건 null 이다(운영 실측). ⟹ 「판매여부가 복원된다」를 **운영 증거로 쓰지 않는다**. */
    expect(all.every((r) => r.soldOut === null)).toBe(true);
  });
});

/* ═══════════════ B3-01 · B3-02 · B3-07 — 저장분이 전수 보존된다 ═══════════════ */

describe("B3-01/02/07 🔴 저장된 것은 전수 · 세 칸이 조회 결과에 실제로 포함된다", () => {
  it("B3-01 price_status · sold_out · match_reasons 가 복원 행에 **칸으로** 있다", () => {
    const [out] = toSavedCandidateRows(asRows(dump().withState.rows));
    expect(out.priceStatus).toBe("VERIFIED_CURRENT");
    expect(out.soldOut).toBeNull();
    expect(out.matchReasons.length).toBeGreaterThan(0);
  });

  it("B3-02 🔴 입력 N == 출력 N — `price_tier=null` 이라고 **버리지 않는다**", () => {
    const d = dump();
    for (const raw of [d.withState.rows, d.legacy.rows, d.unmapped, d.sellerUrl, d.tierNull]) {
      const rows = asRows(raw);
      expect(toSavedCandidateRows(rows)).toHaveLength(rows.length);
    }
    /** 🔴 tier 가 null 인 행이 **실제로 표본에 있고** 그것이 살아 나온다(운영 18/124행). */
    const tierNull = toSavedCandidateRows(asRows(d.tierNull));
    expect(tierNull.length).toBeGreaterThan(0);
    expect(tierNull.every((r) => r.priceTier === null)).toBe(true);
  });

  it("B3-07 🔴 `matchReasons` 가 복원 과정에서 사라지지 않는다(글자까지 같다)", () => {
    const rows = asRows(dump().withState.rows);
    const out = toSavedCandidateRows(rows);
    expect(out[0].matchReasons).toEqual(rows[0].matchReasons);
  });

  it("B3-07-b 🔴🔴 `matchReasons` 가 **POSSIBLE 게이트의 입력** 이라 비면 군이 사라진다", async () => {
    /**
     * 🔴 그래서 이 칸은 「화면에 안 쓰니 영향 0」이 **아니다**.
     *    `isModelCodeOnlyReference` 가 길이를 게이트로 쓴다(그 함수의 소비처가 증거).
     */
    const src = readFileSync(
      join(__dirname, "..", "..", "..", "..", "pipeline", "commerce", "mi-same-candidates.ts"),
      "utf8",
    );
    expect(declBody(src, "function isModelCodeOnlyReference")).toContain("matchReasons");
  });
});

/* ═══════════════ B3-03 — 집계 타입의 required 계약 불변 ═══════════════ */

describe("B3-03 🔴🔴 `GeminiTransientEvidence.priceTier` required 계약은 **불변** 이다", () => {
  const RUNNER = readFileSync(join(__dirname, "..", "run-domestic-price-check.ts"), "utf8");

  it("B3-03 집계 타입의 `priceTier` 가 여전히 **optional 이 아니다**", () => {
    const body = declBody(RUNNER, "export interface GeminiTransientEvidence");
    /** 🔴 `priceTier?:` 로 느슨해지면 tier 없는 후보가 **집계 경로 타입** 을 통과한다. */
    expect(body).toContain("priceTier: DomesticPriceTier");
    expect(body).not.toContain("priceTier?:");
  });

  it("B3-03-b 🟢 그래서 복원은 **별 타입** 을 쓴다 — 그쪽만 nullable 이다", () => {
    const src = readFileSync(join(__dirname, "..", "saved-candidate-rows.ts"), "utf8");
    expect(declBody(src, "export interface SavedCandidateRow")).toContain("priceTier: string | null");
    /**
     * 🔴 복원 타입이 집계 타입을 **쓰지 않는다**(둘이 섞일 길을 없앤다).
     * 🔴🔴 **주석을 벗기고** 본다 — 1차에 그대로 검사해서 **내 설명문** 에 적힌
     *    그 이름 때문에 FAIL 했다(헌장이 「주석을 벗기고」라고 적어 둔 그 자리).
     */
    expect(stripComments(src)).not.toContain("GeminiTransientEvidence");
  });
});

/* ═══════════════ B3-04 — 가격 집계 격리 ═══════════════ */

describe("B3-04 🔴🔴 복원이 가격 집계에 **닿지 않는다**", () => {
  const MI = readFileSync(join(__dirname, "..", "market-intelligence.ts"), "utf8");

  it("B3-04 집계 루프의 입력은 `geminiEvidence` **하나** 다 — 복원 배열이 아니다", () => {
    /** 🔴 가격 축 적재 루프(이 파일의 유일한 transient 집계 입구). */
    const loop = MI.slice(MI.indexOf("for (const e of geminiEvidence ?? [])"));
    expect(loop.length).toBeGreaterThan(0);
    /** 🔴🔴 그 루프가 복원 배열을 **한 번도 읽지 않는다**. */
    expect(MI).not.toContain("for (const e of savedCandidateRows");
    expect(MI).not.toContain("...savedCandidateRows");
    expect(MI).not.toContain("savedCandidateRows ?? []");
  });

  it("B3-04-b 🔴 복원 배열이 `geminiEvidence` 로 **흘러들어가지 않는다**", () => {
    /** 🔴 세 번째 인자에 복원분을 넣는 모양이 코드에 **없다**. */
    expect(MI).not.toMatch(/geminiEvidence\s*=\s*savedCandidateRows/);
    expect(MI).not.toMatch(/geminiEvidence:\s*savedCandidateRows/);
    /**
     * 🟢 반대로 — 복원은 **자기 칸 하나** 로만 나간다.
     *
     * 🔵 **앵커 재지정**(MI-UNIFIED-MARKET-PRICE-COMPARISON-1 · CPO 승인) —
     *    전 앵커는 반환 줄이 **글자 그대로** `savedCandidateRows,` 이기를 요구했다.
     *    이제 그 칸은 후보 행에 서버 환산값을 **가산** 해서 나간다(`attachDerivedKrw`).
     * 🔴 **보호 내용은 그대로** 다 — ⒜ 「자기 칸」으로 나가고 ⒝ `geminiEvidence` 로
     *    흘러들지 않는다(위 두 단언이 그것을 본다) ⒞ 집계 루프가 읽지 않는다(B3-04).
     * 🔴 기대값을 임의로 바꾼 것이 아니다 — **실패 원인**(내가 그 줄을 바꿨다)을 확인하고
     *    그 줄의 **새 실제 모양** 을 단언한다(CPO 「기대값 변경 금지」 준수).
     */
    expect(MI, "🔴 복원이 자기 칸으로 나가지 않는다").toContain(
      "savedCandidateRows: attachDerivedKrw(savedCandidateRows, candidateKrwByUrl)",
    );
  });

  it("B3-04-c 🔴 `/check`(POST) 경로는 복원을 **부르지 않는다** — 플래그가 꺼져 있다", () => {
    const CHECK = readFileSync(join(__dirname, "..", "..", "check", "route.ts"), "utf8");
    /** 🔴 `/check` 가 그 옵션을 켜면 응답 모양과 집계 분모가 같이 바뀐다. */
    expect(CHECK).not.toContain("restoreSavedCandidates");
  });

  it("B3-04-d 🟢 복원은 **옵션이 켜질 때만** 읽는다(기본은 `null`)", () => {
    const decl = MI.slice(MI.indexOf("const savedCandidateRows = options?.restoreSavedCandidates"));
    const body = decl.slice(0, decl.indexOf(";"));
    expect(body).toContain("options?.restoreSavedCandidates");
    expect(body).toContain(": null");
  });
});

/* ═══════════════ B3-09 — 재진입은 «읽기만» 한다 ═══════════════ */

describe("B3-09 🔴🔴 재진입 경로가 Search / Crawl / `/check` 를 **부르지 않는다**", () => {
  const GET = readFileSync(join(__dirname, "..", "..", "[snapshotId]", "route.ts"), "utf8");
  const SAVED = readFileSync(join(__dirname, "..", "saved-candidate-rows.ts"), "utf8");

  it("B3-09 GET 라우트가 복원을 **켜고** 세 번째 인자(집계 입력)는 비운다", () => {
    expect(GET).toContain("restoreSavedCandidates: true");
    /** 🔴 집계 입력 자리에 복원분을 넣지 않는다 — `null` 이다. */
    expect(GET).toMatch(/computeMarketIntelligence\([\s\S]{0,120}?,\s*null,/);
  });

  it("B3-09-b 🔴 GET 라우트에 **재분석 어휘가 0** 이다", () => {
    const code = GET.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of [
      "runDomesticPriceCheck",
      "searchComparisonShops",
      "searchDomesticShops",
      "collectUrlCandidatePool",
      "factsFromProductUrl",
      "/check",
      "fetch(",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("B3-09-c 🔴 변환기는 **순수** 하다 — DB·HTTP·판정이 0 이다", () => {
    const code = SAVED.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of [
      "supabase",
      "prisma",
      "fetch",
      "insert",
      "upsert",
      "priceTierFromLink",
      "withConfidence",
      "classifyCandidateMarket",
    ]) {
      expect(code.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("B3-09-d 🔴🔴 복원 리더는 `snapshot_id` **만** 본다 — `origin_code` 축이 없다", () => {
    const REVIEW = readFileSync(join(__dirname, "..", "candidate-review.ts"), "utf8");
    /** 🔴🔴 **주석을 벗기고** 본다 — 이 본문의 설명문이 `origin_code` 를 **금지로** 적고
     *    있어서 그대로 검사하면 내 주석 때문에 FAIL 한다(같은 함정 세 번째). */
    const body = stripComments(
      declBody(REVIEW, "export async function listSnapshotCandidateReviews"),
    );
    expect(body).toContain('.eq("snapshot_id"');
    /**
     * 🔴 `origin_code` 를 쓰면 **다른 스냅샷에서 본 후보의 금액** 이 이 상품의 가격
     *    비교 화면에 선다 — CPO 가 CORE-2AA 에서 금지한 「URL 전역」과 같은 사고다.
     */
    expect(body).not.toContain("origin_code");
    /** 🔴 다른 workspace 의 행을 쓰지 않는다(이 파일의 공통 규약). */
    expect(body).toContain("workspace_id");
  });
});

/* ═══════════════ LOCK — Source 복원 정책 (DoD ①~⑥) ═══════════════ */

describe("LOCK 🔵 source 복원 — 겹치는 둘만 매핑하고 **나머지는 배지를 세우지 않는다**", () => {
  it("DoD ① SELLER_URL · OVERSEAS_AUTO 는 **그대로** 복원된다", () => {
    const seller = toSavedCandidateRows(asRows(dump().sellerUrl));
    expect(seller.length).toBeGreaterThan(0);
    expect(seller.every((r) => r.source === "SELLER_URL")).toBe(true);

    const overseas = toSavedCandidateRows(asRows(dump().withState.rows));
    expect(overseas.every((r) => r.source === "OVERSEAS_AUTO")).toBe(true);
  });

  it("DoD ②③ 미매핑 source 는 **칸 자체가 없다** — 빈 문자열이 아니다", () => {
    const rows = asRows(dump().unmapped);
    expect(rows.length).toBeGreaterThan(0);
    const out = toSavedCandidateRows(rows);
    for (const r of out) {
      /** 🔴 `""` 이면 화면의 `{row.source && (…)}` 가드를 지나 **빈 배지** 가 뜬다. */
      expect(r.source).toBeUndefined();
      expect("source" in r).toBe(false);
    }
  });

  it("DoD ③-b 🔴 임의 변환을 하지 않았다 — 화면 전용 값 넷이 매핑표에 **없다**", () => {
    const src = readFileSync(join(__dirname, "..", "saved-candidate-rows.ts"), "utf8");
    const table = src.slice(src.indexOf("const DISPLAY_SOURCE"));
    const body = table.slice(0, table.indexOf("};"));
    for (const invented of ["GEMINI_DISCOVERY", "DOMESTIC_LISTING", "REVIEWED_SAME", "WEB_SEARCH"]) {
      expect(body).not.toContain(invented);
    }
    /** 🔴 「복원됨」 같은 새 source 를 신설하지 않았다(그것은 출처가 아니다). */
    expect(src).not.toContain("RESTORED");
  });

  it("DoD ④ 저장 원값을 **변조하지 않는다** — 매핑은 표시 경로에만 있다", () => {
    const rows = asRows(dump().unmapped);
    const before = rows.map((r) => r.source);
    toSavedCandidateRows(rows);
    /** 🔴 입력 배열이 그대로다(in-place 수정 0). */
    expect(rows.map((r) => r.source)).toEqual(before);
    /** 🔴 그리고 변환기에 DB 쓰기가 없다(B3-09-c 가 같이 잠근다). */
  });

  it("DoD ⑤ source 때문에 후보가 **제거되지 않는다**", () => {
    const rows = asRows(dump().unmapped);
    expect(toSavedCandidateRows(rows)).toHaveLength(rows.length);
  });

  it("DoD ⑥ source 처리가 가격 상태·tier·판정을 **바꾸지 않는다**", () => {
    const rows = asRows(dump().unmapped);
    const out = toSavedCandidateRows(rows);
    out.forEach((o, i) => {
      expect(o.priceStatus).toBe(rows[i].priceStatus);
      expect(o.priceTier).toBe(rows[i].priceTier);
      expect(o.crossSellerVerdict).toBe(rows[i].systemVerdict);
      expect(o.matchTruth).toBe(rows[i].matchTruth);
      expect(o.priceAmount).toBe(rows[i].priceAmount);
      expect(o.priceCurrency).toBe(rows[i].priceCurrency);
      expect(o.market).toBe(rows[i].market);
    });
  });
});

/* ═══════════════ 칸 매핑 — 지어낸 값이 0 이다 ═══════════════ */

describe("MAP 🔴 복원은 **옮기기만** 한다 — 값을 만들지 않는다", () => {
  it("MAP-1 전 칸이 저장값과 같다(url · title · image · 가격 · 시장 · 판정)", () => {
    const rows = asRows(dump().legacy.rows);
    const out = toSavedCandidateRows(rows);
    expect(out.length).toBeGreaterThan(0);
    out.forEach((o, i) => {
      const r = rows[i];
      expect(o.discoveredUrl).toBe(r.candidateUrl);
      expect(o.title).toBe(r.candidateTitle);
      expect(o.imageUrl).toBe(r.imageUrl);
      expect(o.priceAmount).toBe(r.priceAmount);
      expect(o.priceCurrency).toBe(r.priceCurrency);
      expect(o.market).toBe(r.market);
      expect(o.priceTier).toBe(r.priceTier);
    });
  });

  it("MAP-2 🔴 `price_status` 가 null 이면 **null 그대로** 다 — 확인됨으로 추정하지 않는다", () => {
    const rows = asRows(dump().legacy.rows);
    /** 🔴 이 표본은 081 **이전** 분모라 전건 null 이다(그것이 이 축의 분모다). */
    expect(rows.every((r) => r.priceStatus === null)).toBe(true);
    expect(toSavedCandidateRows(rows).every((o) => o.priceStatus === null)).toBe(true);
  });

  it("MAP-3 🟢 `candidate_domain` 이 null 이면 **그 URL 의 host** 를 쓴다(지어내지 않는다)", () => {
    const rows = asRows(dump().sellerUrl).filter((r) => r.candidateDomain === null);
    /** 🔴 그 모양이 운영에 실재한다(SELLER_URL 행 일부). 분모가 0 이면 이 축은 측정불가다. */
    expect(rows.length).toBeGreaterThan(0);
    const out = toSavedCandidateRows(rows);
    out.forEach((o, i) => {
      expect(o.domain).toBe(new URL(rows[i].candidateUrl).hostname);
      /** 🔴 빈 문자열로 두면 화면에 **판매처 없는 카드** 가 선다. */
      expect(o.domain.length).toBeGreaterThan(0);
    });
  });

  it("MAP-4 🔴🔴 `blockers` 는 **합쳐져 저장돼 있다** ⟹ conflicts 로 넣고 blockers 는 비운다", () => {
    const rows = asRows(dump().legacy.rows);
    const out = toSavedCandidateRows(rows);
    out.forEach((o, i) => {
      expect(o.crossSellerConflicts).toEqual(rows[i].blockers);
      expect(o.crossSellerBlockers).toEqual([]);
    });
    /** 🔴 분모 — 실제로 blocker 가 있는 행이 표본에 있다(없으면 이 축은 측정불가다). */
    expect(rows.some((r) => r.blockers.length > 0)).toBe(true);
  });

  it("MAP-5 🟡 `soldOut` 은 **pass-through** 다 — 운영 분모는 0 이라 이 축은 단언으로만 잠근다", () => {
    const [base] = asRows(dump().withState.rows);
    /**
     * 🔴 아래 두 입력은 **운영 관측이 아니다**(합성). A-3 이 적은 대로 운영은 전건
     *    null 이라 「true/false 가 복원된다」를 **운영 증거로 쓸 수 없다**. 🟢 그래서
     *    여기서는 「변환기가 값을 바꾸지 않는다」만 잠근다.
     */
    expect(toSavedCandidateRows([{ ...base, soldOut: true }])[0].soldOut).toBe(true);
    expect(toSavedCandidateRows([{ ...base, soldOut: false }])[0].soldOut).toBe(false);
    expect(toSavedCandidateRows([{ ...base, soldOut: null }])[0].soldOut).toBeNull();
  });
});

/* ═══════════════ 타입 정합 — 서버 복원 행이 화면 행으로 들어간다 ═══════════════ */

describe("TYPE 🔴 복원 행이 화면 타입에 **구조적으로** 들어맞는다", () => {
  it("TYPE-1 `SavedCandidateRow` 를 화면 행 자리에 그대로 쓸 수 있다(컴파일 축)", () => {
    /**
     * 🔴🔴 서버 타입과 화면 타입(`GeminiTransientRow`)은 **손으로 쓴 두 벌** 이다.
     *    칸 이름이 하나라도 어긋나면 **런타임에 조용히 undefined** 가 되고 화면이
     *    「가격 미확인」·「이미지 없음」만 그린다 — 이 레포가 E2E-04 에서 밟은 그 함정.
     * 🟢 그래서 **typecheck 가 그 드리프트를 잡게** 한다(이 할당이 그 단언이다).
     */
    const [row] = toSavedCandidateRows(asRows(dump().withState.rows));
    const asDisplayRow: import("../../../../pipeline/commerce/GeminiTransientCandidates").GeminiTransientRow =
      row;
    expect(asDisplayRow.discoveredUrl).toBe(row.discoveredUrl);
    /** 🔴 반대 방향도 막는다 — 화면 전용 값이 복원 타입에 들어오면 안 된다. */
    const bad = { source: "WEB_SEARCH" } as unknown as SavedCandidateRow;
    expect(bad.source as string).toBe("WEB_SEARCH");
  });
});
