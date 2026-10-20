import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HUMAN_VERDICTS, isHumanVerdict, reviewKey } from "../candidate-review";
import {
  GeminiTransientCandidates,
  HUMAN_REVIEW_VALUES,
  REVIEW_HISTORY_EMPTY,
  REVIEW_HISTORY_HEADING,
  ReviewHistorySection,
} from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-131 — **후보 검토 이력 + 셀러 GT** 계약
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **네트워크 0 · DB 0** (순수 함수 · 소스 앵커 · 마운트 DOM 만).
 * 🔴 소스 문자열 검사는 **주석을 벗기고** 한다(헌장 §5).
 * 🔴 판정 함수를 직접 부르는 단언은 **배선을 못 본다**(WU-110 교훈) → 앵커를 **같이** 둔다.
 */

const LIB = path.join(__dirname, "..");
const strip = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const SQL = readFileSync(
  path.join(LIB, "../../../../../../../packages/database/prisma/migrations_manual/079_candidate_reviews.sql"),
  "utf8",
);
const DATA = strip(path.join(LIB, "candidate-review.ts"));
const ROUTE = strip(path.join(LIB, "..", "[snapshotId]", "candidate-reviews", "route.ts"));
const CHECK = strip(path.join(LIB, "..", "check", "route.ts"));
/** 🔴 좌표를 추측하지 않는다 — `_lib` 에서 `app` 까지 **세 칸** 이다(네 칸이면 `src` 로 넘어간다). */
const PANEL = strip(
  path.join(LIB, "..", "..", "..", "pipeline", "commerce", "DomesticPriceIntelligencePanel.tsx"),
);

/* ══════════════════ A. 저장소 — 079 ══════════════════ */

describe("A. 🔴 migration 079", () => {
  it("A-1 네 상태를 **DB 가 강제** 한다 — 애플리케이션 어휘와 같다", () => {
    expect(SQL).toContain("human_verdict in ('SAME', 'SIMILAR', 'DIFFERENT', 'UNDECIDED')");
    expect([...HUMAN_VERDICTS]).toEqual(["SAME", "SIMILAR", "DIFFERENT", "UNDECIDED"]);
    /** 🔴 화면 어휘도 **같아야** 한다 — 갈라지면 누른 값이 저장에서 거절된다. */
    expect([...HUMAN_REVIEW_VALUES]).toEqual([...HUMAN_VERDICTS]);
  });

  /**
   * 🔴🔴 **1차 단언이 약했고 음성 대조가 그것을 드러냈다 — 기록해 둔다.**
   *    처음에는 `on candidate_reviews (origin_code, candidate_url)` **문자열만** 봤다.
   *    그러면 `create unique index` 를 `create index` 로 바꿔 **유니크를 없애도 통과** 한다
   *    (인덱스는 남고 중복 방지만 사라진다 — 조용히 같은 후보가 두 행이 되는 모양).
   * 🟢 그래서 **`unique` 키워드와 그 칼럼 조합을 «한 덩어리» 로** 본다.
   */
  it("A-2 🔴🔴 UNIQUE 가 **candidate_url 단독이 아니다** — 다른 원상품이 같은 URL 을 가진다", () => {
    const uniqueOn = (cols: string) =>
      new RegExp(String.raw`create\s+unique\s+index[\s\S]{0,120}?on\s+candidate_reviews\s*\(\s*${cols}\s*\)`, "i");
    expect(SQL).toMatch(uniqueOn("snapshot_id,\\s*candidate_url"));
    expect(SQL).toMatch(uniqueOn("origin_code,\\s*candidate_url"));
    /** 🔴 단독 유니크가 **없어야** 한다(있으면 두 원상품의 검토가 서로를 덮는다). */
    expect(SQL).not.toMatch(uniqueOn("candidate_url"));
    expect(SQL).not.toMatch(/unique\s*\(\s*candidate_url\s*\)/i);
  });

  it("A-3 🔴 원상품 축이 **하나는 있어야** 한다", () => {
    expect(SQL).toContain("snapshot_id is not null or origin_code is not null");
  });

  it("A-4 🔴 출처를 잃지 않는다 — GT_IMPORT 가 **별 출처** 다", () => {
    for (const s of ["OVERSEAS_AUTO", "DOMESTIC_REGISTRY", "SELLER_URL", "GEMINI", "GT_IMPORT"]) {
      expect(SQL).toContain(s);
    }
  });
});

/* ══════════════════ B. 데이터 계층 ══════════════════ */

describe("B. 🔴 데이터 계층", () => {
  it("B-1 🔴 URL 정규화기를 **새로 만들지 않았다** — 운영 owner 를 쓴다", () => {
    expect(DATA).toContain("canonicalizeProductUrl");
    /** 🔴 쿼리를 통째로 버리는 그 함수를 쓰면 Cafe24 계열이 한 행으로 접힌다. */
    expect(DATA).not.toContain("normalizeCandidateUrl");
  });

  it("B-2 🟢 식별 파라미터는 **보존** 하고 추적 파라미터만 걷는다", () => {
    const a = reviewKey("https://shop.co.kr/goods?branduid=A&_pos=1");
    const b = reviewKey("https://shop.co.kr/goods?branduid=B");
    /** 🔴 서로 다른 상품이 **같은 키가 되면 안 된다**. */
    expect(a).not.toBe(b);
    expect(a).toContain("branduid=a");
  });

  it("B-3 🟢 대소문자가 달라도 같은 후보다", () => {
    expect(reviewKey("https://Shop.COM/products/X")).toBe(reviewKey("https://shop.com/products/X"));
  });

  it("B-4 🔴🔴 **재조회가 사람 판단을 덮지 않는다** — seen 경로에 그 칸이 없다", () => {
    const seen = DATA.slice(DATA.indexOf("export async function recordSeenCandidates"), DATA.indexOf("export async function saveHumanVerdict"));
    expect(seen).toContain("last_seen_at");
    /** 🔴 이 두 칸을 쓰면 이미 판단한 후보가 재조회로 **초기화된다**. */
    expect(seen).not.toContain("human_verdict");
    expect(seen).not.toContain("reviewed_at");
  });

  it("B-5 🔴🔴 **사람 판단이 MI 산출을 덮지 않는다** — save 경로에 system 칸이 없다", () => {
    const save = DATA.slice(DATA.indexOf("export async function saveHumanVerdict"));
    expect(save).toContain("human_verdict");
    for (const sys of ["system_verdict", "match_truth", "price_tier", "blockers"]) {
      expect(save).not.toContain(sys);
    }
  });

  it("B-6 🔴 네 상태 밖의 값을 받지 않는다", () => {
    expect(isHumanVerdict("SAME")).toBe(true);
    expect(isHumanVerdict("PRESUMED_SAME")).toBe(false);
    expect(isHumanVerdict("")).toBe(false);
    expect(isHumanVerdict(null)).toBe(false);
  });
});

/* ══════════════════ C. API 배선 ══════════════════ */

describe("C. 🔴 API 배선(소스 앵커)", () => {
  it("C-1 인증·소유권을 **기존 함수** 로 건다 — 새 보안 규칙 0", () => {
    expect(ROUTE).toContain("requireUser()");
    expect(ROUTE).toContain("getSnapshot(snapshotId, workspaceId)");
  });

  it("C-2 🔴 네 상태 밖이면 **400** 이다(DB 가 막기 «전» 에)", () => {
    expect(ROUTE).toContain("isHumanVerdict(body?.humanVerdict)");
    expect(ROUTE).toContain("status: 400");
  });

  it("C-3 🔴🔴 **두 축으로 조회** 한다 — snapshot 없는 과거 GT 가 보여야 한다", () => {
    expect(ROUTE).toContain("originCode");
    const list = DATA.slice(DATA.indexOf("export async function listCandidateReviews"), DATA.indexOf("export async function recordSeenCandidates"));
    expect(list).toContain("snapshot_id.eq.");
    expect(list).toContain("origin_code.eq.");
  });

  it("C-4 🔴 `/check` 가 **이력의 생산자** 다 — 세 출처를 전부 남긴다", () => {
    expect(CHECK).toContain("recordSeenCandidates({");
    for (const s of ['"OVERSEAS_AUTO"', '"GEMINI"', '"SELLER_URL"']) expect(CHECK).toContain(s);
    /** 🔴 `domestic_product_links` 에 쓰지 않는다 — 그 표는 가격·판정 경로다. */
    expect(CHECK).not.toContain("upsertDomesticProductLink");
  });

  it("C-5 🔴 이력 저장 실패가 가격확인을 **뒤집지 않는다**", () => {
    const seg = CHECK.slice(CHECK.indexOf("recordSeenCandidates({"));
    expect(seg).toContain("catch");
  });
});

/* ══════════════════ D. 화면(마운트 DOM) ══════════════════ */

const row = {
  domain: "junioredition.com",
  title: "Hug Hairy Monster T-Shirt",
  source: "OVERSEAS_AUTO" as const,
  discoveredUrl: "https://www.junioredition.com/en-kr/products/hug",
  market: "OVERSEAS",
  priceAmount: 37,
  priceCurrency: "GBP",
};

describe("D. 🔴 화면", () => {
  it("D-1 🔴 버튼이 **넷** 이다 — 동일 · 유사 · 다름 · 보류", () => {
    const html = renderToStaticMarkup(
      GeminiTransientCandidates({ evidence: [row], onReview: () => {} }) as never,
    );
    for (const v of HUMAN_REVIEW_VALUES) expect(html).toContain(`gt-review-${v.toLowerCase()}`);
    for (const t of ["동일상품", "유사상품", "다른 상품", "판단보류"]) expect(html).toContain(t);
  });

  it("D-2 🔴 「저장됨」을 화면이 **직접 말한다**(눌렀다 ≠ 저장됐다)", () => {
    const html = renderToStaticMarkup(
      GeminiTransientCandidates({
        evidence: [row],
        onReview: () => {},
        saveState: { [row.discoveredUrl]: "SAVED" },
      }) as never,
    );
    expect(html).toContain("gt-review-save");
    expect(html).toContain("저장됨");
  });

  it("D-3 🟢 `onReview` 가 없으면 버튼이 **렌더되지 않는다**(기존 구역 불변)", () => {
    const html = renderToStaticMarkup(GeminiTransientCandidates({ evidence: [row] }) as never);
    expect(html).not.toContain("gt-human-review");
  });

  it("D-4 🔴🔴 **해외 구역에도 같은 판단 체계** 가 달린다(§8)", () => {
    const seg = PANEL.slice(PANEL.indexOf("evidence={overseasAutoRest}"));
    expect(seg.slice(0, 300)).toContain("onReview={onDomesticReview}");
    expect(seg.slice(0, 300)).toContain("saveState={reviewSaveState}");
  });

  it("D-5 🔴 📚 이력 구역 — 두 판단을 **나란히** 적고 미판단도 보여준다", () => {
    const html = renderToStaticMarkup(
      ReviewHistorySection({
        rows: [
          {
            candidateUrl: "https://a.com/p/1",
            candidateDomain: "a.com",
            candidateTitle: "후보 A",
            priceAmount: null,
            priceCurrency: null,
            market: "OVERSEAS",
            systemVerdict: "PRESUMED_SAME",
            matchTruth: null,
            humanVerdict: "DIFFERENT",
            source: "GT_IMPORT",
            lastSeenAt: "2026-10-20T00:00:00.000Z",
            reviewedAt: "2026-10-20T00:00:00.000Z",
          },
        ],
      }) as never,
    );
    expect(html).toContain(REVIEW_HISTORY_HEADING);
    /** 🔴🔴 **둘 다** 보인다 — 한쪽이 다른쪽을 덮지 않는다는 사실이 화면에 선다. */
    expect(html).toContain("PRESUMED_SAME");
    expect(html).toContain("🔴 다른 상품");
    expect(html).toContain("마지막 확인일 2026-10-20");
  });

  it("D-6 🔴 이력이 **0건** 인 것과 **안 읽은 것** 을 가른다", () => {
    expect(renderToStaticMarkup(ReviewHistorySection({ rows: [] }) as never)).toContain(REVIEW_HISTORY_EMPTY);
    /** 🔴 `null` 이면 구역 자체가 없다 — 「0건」이라고 **단정하지 않는다**. */
    expect(ReviewHistorySection({ rows: null })).toBeNull();
  });

  /**
   * 🔴🔴 **1차에 이 배선 단언이 빠져 있었고 음성 대조가 잡았다 — 기록해 둔다.**
   *    D-5/D-6 은 컴포넌트를 **직접 부르고**, D-7 은 함수 존재만 봤다. 그래서
   *    `<ReviewHistorySection …/>` 줄을 통째로 지워도 **24/24 가 통과** 했다
   *    (WU-110 이 남긴 「판정 함수를 직접 부르는 테스트는 배선을 못 본다」의 재발).
   */
  it("D-7 🔴 진입할 때 이력을 **읽고**, 저장된 판단을 버튼으로 되살린다", () => {
    expect(PANEL).toContain("const loadReviewHistory = useCallback");
    expect(PANEL).toContain("void loadReviewHistory();");
    expect(PANEL).toContain("setDomesticReview((prev) => ({ ...restored, ...prev }))");
    /** 🔴 그리고 그 구역이 **실제로 화면에 선다** — 이름이 아니라 **렌더 줄** 을 본다. */
    expect(PANEL).toContain("<ReviewHistorySection rows={reviewHistory} />");
    /** 🔴 입력이 `reviewHistory` 에서 **온다** — 엉뚱한 배열을 넣어도 이름만으론 통과한다. */
    expect(PANEL).toContain("reviewHistory={reviewHistory}");
  });

  it("D-8 🔴 저장 실패면 **되돌리고 말한다**(거짓 「저장됨」 금지)", () => {
    const seg = PANEL.slice(PANEL.indexOf("const handleDomesticReview"));
    expect(seg).toContain('"SAVING"');
    expect(seg).toContain('"ERROR"');
    expect(seg).toContain("method: \"POST\"");
  });

  it("D-9 🔴 셀러 판단이 MI/가격/알림/등록으로 **흘러가지 않는다**", () => {
    const lines = PANEL.split("\n").filter((l) => l.includes("domesticReview") || l.includes("reviewSaveState"));
    for (const l of lines) {
      for (const f of ["computeMarketIntelligence", "domesticCompetition", "sellerDecision", "priceTier", "computeMarketAlert"]) {
        expect(l).not.toContain(f);
      }
    }
  });
});
