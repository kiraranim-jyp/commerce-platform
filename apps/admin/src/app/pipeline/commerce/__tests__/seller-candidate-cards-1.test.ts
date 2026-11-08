// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SellerCandidateCards,
  SELLER_DOMESTIC_LABEL,
  SELLER_NO_IMAGE,
  SELLER_NO_PRICE,
  SELLER_NO_URL,
  SELLER_NO_VERDICT,
  SELLER_OVERSEAS_LABEL,
} from "../SellerCandidateCards";
import { NO_CANDIDATE_AT_ALL, NO_SAME_BUT_CANDIDATES, OTHER_CANDIDATES_NOTICE } from "../CandidateComparison";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SELLER-COMPARISON-UI-1 STEP 1+2 — **마운트 DOM** 검증 (CPO 승인 2026-11-08)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「국내·해외 카드 동일성 · 행마다 판정 라벨 · 격자 밖 최상단은
 *    **소스 확인만으로 PASS 하지 않는다**」 ⟹ 셋 다 **마운트/위치** 로 본다.
 * 🔴 `.test.ts` + `createElement` — vitest `include` 가 `.test.tsx` 를 수집하지 않는다.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const mount = async (rows: GeminiTransientRow[] | null) => {
  await act(async () => root.render(createElement(SellerCandidateCards, { rows })));
};
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const all = (id: string) => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const txt = (id: string) => q(id)?.textContent ?? "";
const openBody = async () => {
  const b = q("seller-candidates-toggle") as HTMLButtonElement | null;
  if (!b) throw new Error("토글이 없다");
  await act(async () => b.click());
};

const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "WEB_SEARCH",
    domain: "a.test",
    discoveredUrl: "https://a.test/p1",
    title: "Hug Hairy Monster T-Shirt",
    imageUrl: "https://a.test/i.jpg",
    market: "KR",
    priceAmount: 28000,
    priceCurrency: "KRW",
    crossSellerVerdict: "PRESUMED_SAME",
    ...over,
  }) as unknown as GeminiTransientRow;

/* ════════════════════════════════════════════════════════════════════════════
 * §1 🔴🔴 WU-091 네 조건 — 사진·가격·URL 보다 «우선» 한다
 * ════════════════════════════════════════════════════════════════════════════ */

describe("SELLER-SOURCING §1 — WU-091 네 조건", () => {
  it("①-a 🔴 **기본 접힘** — 후보 목록이 펼쳐져 있지 않다", async () => {
    await mount([row({}), row({ discoveredUrl: "https://b.test/p", market: "OVERSEAS", priceCurrency: "GBP", priceAmount: 17 })]);
    expect(q("seller-candidates")).toBeTruthy();
    /** 🔴 펼치면 「유력 후보」로 읽힌다(2026-09-19 사고 기전). */
    expect(q("seller-candidates-body")).toBeNull();
    expect(all("seller-card")).toHaveLength(0);
  });

  it("①-b 🔴 「동일상품 없음」을 **먼저** 안내한다(목록보다 위)", async () => {
    await mount([row({ crossSellerVerdict: "PRESUMED_SAME" })]);
    expect(txt("seller-candidates-headline")).toBe(NO_SAME_BUT_CANDIDATES);
    await openBody();
    /** 🔴 **문서 순서** 로 안내가 목록보다 앞에 있다. */
    const head = q("seller-candidates-headline")!;
    const body = q("seller-candidates-body")!;
    expect(head.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("①-c 🔴🔴 **행마다 실제 판정 라벨** 이 있다(마운트 DOM)", async () => {
    const rows = [row({}), row({ discoveredUrl: "https://b.test/p", crossSellerVerdict: "CONFLICT" })];
    await mount(rows);
    await openBody();
    expect(all("seller-card")).toHaveLength(rows.length);
    /** 🔴 라벨 개수 == 행 수 — 하나라도 빠지면 FAIL. */
    expect(all("seller-card-verdict")).toHaveLength(rows.length);
    const labels = all("seller-card-verdict").map((n) => n.textContent);
    expect(labels).toContain("PRESUMED_SAME");
    expect(labels).toContain("CONFLICT");
  });

  it("①-d 🔴 「가격비교에 사용되지 않습니다」 안내가 **기존 문구 그대로** 선다", async () => {
    await mount([row({})]);
    expect(txt("seller-candidates-scope")).toBe(OTHER_CANDIDATES_NOTICE);
    expect(txt("seller-candidates-scope")).toContain("가격비교에 사용되지 않습니다");
  });

  it("①-e 🔴 판정값을 **만들지 않는다** — 없으면 「판정 없음」(긍정으로 치환 0)", async () => {
    await mount([row({ crossSellerVerdict: null, matchTruth: null })]);
    await openBody();
    expect(txt("seller-card-verdict")).toBe(SELLER_NO_VERDICT);
    expect(txt("seller-card-verdict")).not.toContain("SAME");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * §2 국내·해외 **동일 템플릿** (마운트 DOM 으로 비교)
 * ════════════════════════════════════════════════════════════════════════════ */

describe("SELLER-SOURCING §2 — 국내·해외 동일성", () => {
  const KR = row({ market: "KR", priceCurrency: "KRW", priceAmount: 28000, discoveredUrl: "https://kr.test/p" });
  const OS = row({ market: "OVERSEAS", priceCurrency: "GBP", priceAmount: 17, discoveredUrl: "https://os.test/p" });

  it("②-a 🟢 두 묶음이 **같은 testid 구조** 를 낸다(카드 내부 순서까지)", async () => {
    await mount([KR, OS]);
    await openBody();
    expect(q("seller-group-DOMESTIC")).toBeTruthy();
    expect(q("seller-group-OVERSEAS")).toBeTruthy();
    const shape = (m: string) => {
      const g = q(`seller-group-${m}`)!;
      return [...g.querySelectorAll("[data-testid]")].map((n) => n.getAttribute("data-testid"));
    };
    /** 🔴🔴 **국내와 해외의 DOM 모양이 글자 그대로 같다** — 템플릿이 갈릴 구조가 없다. */
    expect(shape("DOMESTIC")).toEqual(shape("OVERSEAS"));
  });

  it("②-b 🔴 **환산 0** — 국내는 KRW · 해외는 원문 통화로 적힌다", async () => {
    await mount([KR, OS]);
    await openBody();
    const prices = all("seller-card-price").map((n) => n.textContent ?? "");
    expect(prices.some((p) => p.includes("KRW") && p.includes("28,000"))).toBe(true);
    expect(prices.some((p) => p.includes("GBP") && p.includes("17"))).toBe(true);
    /** 🔴 기호 변환·환산 흔적이 **없다**. */
    for (const p of prices) {
      expect(p).not.toContain("₩");
      expect(p).not.toContain("약 ");
      expect(p).not.toContain("≈");
    }
  });

  it("②-c 🔴 사진·URL 이 **원문 값 그대로** 걸린다", async () => {
    await mount([KR]);
    await openBody();
    expect(q("seller-card-image")?.getAttribute("src")).toBe("https://a.test/i.jpg");
    expect(q("seller-card-url")?.getAttribute("href")).toBe("https://kr.test/p");
  });

  it("②-d 🔴 시장이 확정되지 않은 후보를 국내·해외로 **지어 넣지 않는다**", async () => {
    await mount([row({ market: null, discoveredUrl: "https://u.test/p" })]);
    await openBody();
    expect(txt("seller-candidates-unknown")).toContain("확인하지 못한 후보 1건");
    expect(all("seller-card")).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * §3 🔴 누락 데이터 — 허위 값 0
 * ════════════════════════════════════════════════════════════════════════════ */

describe("SELLER-SOURCING §3 — 누락 처리", () => {
  it("③-a 🔴 사진 없음 → 「이미지 없음」(대체 이미지 0)", async () => {
    await mount([row({ imageUrl: null })]);
    await openBody();
    expect(q("seller-card-image")).toBeNull();
    expect(txt("seller-card-image-missing")).toBe(SELLER_NO_IMAGE);
  });

  it("③-b 🔴 가격 없음 → 「가격 확인 필요」(0원으로 적지 않는다)", async () => {
    await mount([row({ priceAmount: null, priceCurrency: null })]);
    await openBody();
    expect(txt("seller-card-price")).toBe(SELLER_NO_PRICE);
    expect(txt("seller-card-price")).not.toContain("0");
  });

  it("③-c 🔴 통화만 없으면 가격을 **적지 않는다**(통화 없는 금액 금지)", async () => {
    await mount([row({ priceAmount: 28000, priceCurrency: null })]);
    await openBody();
    expect(txt("seller-card-price")).toBe(SELLER_NO_PRICE);
  });

  it("③-d 🔴 URL 없음 → **클릭 불가능한 링크를 만들지 않는다**", async () => {
    await mount([row({ discoveredUrl: "" })]);
    await openBody();
    expect(q("seller-card-url")).toBeNull();
    expect(txt("seller-card-url-missing")).toBe(SELLER_NO_URL);
  });

  it("③-e 🔴 후보 0 → 「비교 후보를 찾지 못했습니다」 · 목록 0", async () => {
    await mount([]);
    expect(txt("seller-candidates-headline")).toBe(NO_CANDIDATE_AT_ALL);
    expect(q("seller-candidates-toggle")).toBeNull();
    expect(all("seller-card")).toHaveLength(0);
  });

  it("③-f 🔴 `null`(경로 미실행) → **영역 자체를 만들지 않는다**", async () => {
    await mount(null);
    expect(q("seller-candidates")).toBeNull();
  });

  it("③-g 🟢 그 묶음에 후보가 없으면 「후보 없음」(다른 제품으로 채우지 않는다)", async () => {
    await mount([row({ market: "KR" })]);
    await openBody();
    const os = q("seller-group-OVERSEAS")!;
    expect(os.querySelector('[data-testid="seller-group-empty"]')?.textContent).toBe("후보 없음");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * §4 🔴 배치 — **격자 밖 최상단** · 단계/탭 불변 · 출처 축 보존
 * ════════════════════════════════════════════════════════════════════════════ */

describe("SELLER-SOURCING §4 — 배치와 보존", () => {
  const REPO = path.join(__dirname, "..", "..", "..", "..", "..", "..", "..");
  const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const WS = strip(readFileSync(path.join(REPO, "apps/admin/src/app/pipeline/CommerceWorkspace.tsx"), "utf8"));

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 SELLER-DECISION-UI-1 ⒜ — **이 계약이 «양방향» 으로 뒤집혔다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CEO 실화면 확인: 「이번에 추가한 소싱 후보 리스트는 별로야 제거하자」 ⟹ CPO 확정.
   * 🔴 이력을 전부 남긴다:
   * ```
   * STEP 1+2            슬롯이 격자 밖 최상단에 **있다**(④-a/b/c 가 그것을 잠갔다)
   * SELLER-DECISION-UI-1  🔴 셀러 화면에서 **없다** ⟹ ④-a 가 「제거」를 잠근다
   * ```
   * 🔴🔴 **그런데 「제거」와 「삭제」는 다른 말이다.** 그래서 이 describe 는 이제
   *    **두 명제를 같이** 들고 간다 — 하나만 두면 다음 사람이 반대쪽으로 넘어간다:
   * ```
   * ④-a  셀러 화면에 **렌더되지 않는다**        ← 되살리면 FAIL
   * ④-b  컴포넌트와 그 안전 계약은 **살아 있다** ← 파일/조건을 지우면 FAIL
   * ④-c  후보 **데이터 배선** 은 살아 있다      ← 결론 영역이 그대로 쓴다
   * ```
   */
  it("④-a 🔴🔴 셀러 화면에서 **제거** 됐다(렌더 0 · import 0)", () => {
    expect(WS).not.toContain('data-testid="seller-candidates-slot"');
    expect(WS).not.toContain("<SellerCandidateCards");
    expect(WS, "🔴 import 가 남으면 다음 사람이 다시 꽂는다").not.toContain(
      'from "./commerce/SellerCandidateCards"',
    );
  });

  it("④-b 🔴🔴 **삭제가 아니다** — 컴포넌트와 WU-091 안전 계약이 살아 있다", () => {
    const src = strip(readFileSync(path.join(REPO, "apps/admin/src/app/pipeline/commerce/SellerCandidateCards.tsx"), "utf8"));
    expect(src).toContain("export function SellerCandidateCards");
    /** 🔴 WU-091 네 조건의 문구 owner 재사용이 그대로 있어야 한다(사본 0). */
    for (const k of ["OTHER_CANDIDATES_NOTICE", "NO_CANDIDATE_AT_ALL", "NO_SAME_BUT_CANDIDATES"]) {
      expect(src, `🔴 ${k} 가 사라졌다 — 안전 계약이 같이 죽는다`).toContain(k);
    }
  });

  it("④-c 🔴🔴 **후보 데이터 배선은 살아 있다** — 결론 영역이 그대로 쓴다", () => {
    expect(WS, "🔴 rows 공급이 끊기면 후보가 화면에서 통째로 사라진다").toContain(
      "rows={marketComparison?.rows ?? null}",
    );
    const src = strip(readFileSync(path.join(REPO, "apps/admin/src/app/pipeline/commerce/SellerCandidateCards.tsx"), "utf8"));
    for (const banned of ["fetch(", "useEffect", "/api/", "SAME_MIN_AXES", "threshold", "priceTierFromLink"]) {
      expect(src, `🔴 ${banned} 가 있다`).not.toContain(banned);
    }
  });

  it("④-d 🔴🔴 **출처 축을 잃지 않았다**(`wu-130 F-3`) — 기존 구역 넷이 그대로다", () => {
    const panel = readFileSync(
      path.join(REPO, "apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx"),
      "utf8",
    );
    /** 🟢 기존 후보 구역 배선이 **한 글자도 안 바뀌었다**(출처 일곱 칸 그대로 내려간다). */
    expect(panel).toContain("<TransientCandidateSections");
    for (const k of ["web=", "supplied=", "overseasAuto=", "reviewedSame=", "domesticListing=", "webSearch=", "weak="]) {
      expect(panel, `🔴 출처 축 ${k} 가 사라졌다`).toContain(k);
    }
    /** 🔴 새 카드가 그 구역을 **합치거나 지우지 않았다**. */
    const src = strip(readFileSync(path.join(REPO, "apps/admin/src/app/pipeline/commerce/SellerCandidateCards.tsx"), "utf8"));
    expect(src).not.toContain("TransientCandidateSections");
  });

  it("④-e 🟢 문구 owner 를 **재사용** 한다(사본 0)", () => {
    const src = strip(readFileSync(path.join(REPO, "apps/admin/src/app/pipeline/commerce/SellerCandidateCards.tsx"), "utf8"));
    expect(src).toContain("OTHER_CANDIDATES_NOTICE");
    expect(src).toContain("NO_CANDIDATE_AT_ALL");
    expect(src).toContain("NO_SAME_BUT_CANDIDATES");
    /** 🔴 그 문구를 **직접 적지 않았다**(사본이면 둘이 갈린다). */
    expect(src).not.toContain("가격비교에 사용되지 않습니다");
    expect(src).not.toContain("비교 후보를 찾지 못했습니다");
  });
});
