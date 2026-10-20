// @vitest-environment jsdom
/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-022 §5 — **fixture 주입 → 실제 mount → DOM 확인**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **소스 확인만으로 완료 선언하지 않는다**(지시서 §5). 그래서 이 파일은
 *    `createRoot` 로 **실제 DOM 에 마운트** 하고 `textContent` 로 확인한다
 *    (메모 `render-pass-is-not-source-pass` 의 그 요구다).
 * 🟢 선례와 같은 방식이다 — `bulk-reference-reachability.test.ts`(jsdom + act).
 * 🔴 Gemini 호출 0 · fetch 0 · DB 0. 이 컴포넌트는 **표시 전용** 이다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GeminiTransientCandidates,
  PRICE_UNKNOWN_TEXT,
  TRANSIENT_NOTICE,
  TRANSIENT_SCOPE_NOTICE,
  marketText,
  priceText,
  type GeminiTransientRow,
} from "../GeminiTransientCandidates";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React 가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const mount = async (evidence: GeminiTransientRow[] | null) => {
  await act(async () => root.render(createElement(GeminiTransientCandidates, { evidence })));
  return container;
};

/** 🟢 운영 `GeminiTransientEvidence` 의 칸 이름 그대로 쓴 fixture. */
const KR_ROW: GeminiTransientRow = {
  domain: "babybubble.co.kr",
  discoveredUrl: "https://babybubble.co.kr/p/1",
  crossSellerVerdict: "SAME",
  matchTruth: "STRONG_IDENTIFIER",
  priceTier: "EXACT",
  priceAmount: 150000,
  priceCurrency: "KRW",
  market: "KR",
  basis: "KR_TLD_AND_KRW",
  matchReasons: ["품번 일치", "색상 일치"],
};
const EUR_ROW: GeminiTransientRow = {
  domain: "smallable.com",
  discoveredUrl: "https://smallable.com/p/2",
  crossSellerVerdict: "PRESUMED_SAME",
  priceTier: "COMPARISON",
  priceAmount: 75,
  priceCurrency: "EUR",
  market: "OVERSEAS",
  basis: "FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE",
  crossSellerBlockers: ["BRAND_UNCONFIRMED"],
};
/** 🔴 WU-019R 의 실제 충돌 사례 — 등록부 샵인데 EUR → market UNKNOWN. */
const UNKNOWN_ROW: GeminiTransientRow = {
  domain: "bobochoses.com",
  discoveredUrl: "https://bobochoses.com/p/3",
  crossSellerVerdict: "SAME",
  priceTier: "EXACT",
  priceAmount: 75,
  priceCurrency: "EUR",
  market: "UNKNOWN",
  basis: "CONFLICT_REGISTERED_SHOP_WITH_FOREIGN_CURRENCY",
};
const NO_PRICE_ROW: GeminiTransientRow = {
  domain: "tennis-warehouse.com",
  discoveredUrl: "https://tennis-warehouse.com/p/4",
  crossSellerVerdict: "PRESUMED_SAME",
  priceTier: "COMPARISON",
  priceAmount: null,
  priceCurrency: null,
  market: "UNKNOWN",
  basis: "NO_PRICE_EVIDENCE",
};

describe("① 🟢 evidence 가 있으면 구역이 **실제 DOM 에** 나타난다", () => {
  it("후보 수·고정 문구 둘·출처·판정이 전부 보인다", async () => {
    const el = await mount([KR_ROW, EUR_ROW]);
    const section = el.querySelector('[data-testid="gemini-transient"]');
    expect(section).not.toBeNull();
    const text = section?.textContent ?? "";
    expect(text).toContain("웹 검색 후보 2건");
    /** 🔴 CPO 가 글자로 지정한 두 문구 — 둘 다 있어야 한다. */
    expect(text).toContain(TRANSIENT_NOTICE);
    expect(text).toContain(TRANSIENT_SCOPE_NOTICE);
    /**
     * 🟢🟢 WU-028 — **판정이 보인다는 성질은 그대로이고, 보이는 «말» 이 바뀌었다.**
     *
     * 전에는 내부 enum(`SAME` / `PRESUMED_SAME`)을 화면에 그대로 찍었다. CPO 가
     * Production 화면 검토에서 「판정의 의미가 즉시 이해되지 않는다」(③)를 병목으로
     * 확정했고, 그래서 **라벨 owner**(`match-display.ts` · MATCHING-UNIFY-1)가 정한
     * 말로 바꿨다 — 국내/해외가 같은 판정을 같은 말로 부르게 한 바로 그 owner 다.
     * 🔴 판정값도 가격 정책도 한 글자 바뀌지 않았다. 바뀐 것은 **표현** 뿐이다.
     */
    expect(text).toContain("동일상품");
    expect(text).toContain("동일상품 추정");
    /** 🔴 그리고 내부 enum 이 사용자에게 **새지 않는다** — 그것이 이번 변경의 목적이다. */
    expect(text).not.toContain("PRESUMED_SAME");
    expect(text).toContain("babybubble.co.kr");
    expect(text).toContain("smallable.com");
    /** 🟢 근거 없이 판정만 보여주지 않는다. */
    expect(text).toContain("품번 일치");
    expect(text).toContain("보류 근거");
  });

  it("후보 URL 이 실제 링크로 나간다(셀러가 열어 확인할 수 있다)", async () => {
    const el = await mount([EUR_ROW]);
    const a = el.querySelector('[data-testid="gt-url"]') as HTMLAnchorElement | null;
    expect(a?.getAttribute("href")).toBe("https://smallable.com/p/2");
    expect(a?.getAttribute("rel")).toContain("noopener");
  });
});

describe("② 🔴 evidence 가 없으면 구역이 **없다** (flag OFF 가 그 상태다)", () => {
  it("null 이면 아무것도 렌더하지 않는다", async () => {
    const el = await mount(null);
    expect(el.querySelector('[data-testid="gemini-transient"]')).toBeNull();
    expect(el.textContent).toBe("");
  });

  it("빈 배열이어도 구역이 없다 — 「후보 0건」 빈 상자를 만들지 않는다", async () => {
    const el = await mount([]);
    expect(el.querySelector('[data-testid="gemini-transient"]')).toBeNull();
    expect(el.textContent).toBe("");
  });
});

describe("③ 🔴 통화를 **그대로** 적는다 — 환산하지 않는다", () => {
  it("EUR 75 는 `EUR 75` 로 보인다(원화 숫자가 나타나지 않는다)", async () => {
    const el = await mount([EUR_ROW]);
    const price = el.querySelector('[data-testid="gt-price"]')?.textContent ?? "";
    expect(price).toBe("EUR 75");
    /** 🔴 환산했다면 10만 단위 숫자가 생긴다 — 그런 숫자가 **없어야** 한다. */
    expect(el.textContent ?? "").not.toMatch(/\d{3},\d{3}/);
    expect(el.textContent ?? "").not.toContain("원");
  });

  it("KRW 는 KRW 로 적는다 — 통화 칸을 숨기지 않는다", async () => {
    const el = await mount([KR_ROW]);
    expect(el.querySelector('[data-testid="gt-price"]')?.textContent).toBe("KRW 150,000");
  });
});

describe("④ 🔴 가격이 없으면 「가격 미확인」", () => {
  it("0 원·대시로 적지 않는다", async () => {
    const el = await mount([NO_PRICE_ROW]);
    const price = el.querySelector('[data-testid="gt-price"]')?.textContent ?? "";
    expect(price).toBe(PRICE_UNKNOWN_TEXT);
    expect(price).not.toContain("0");
    expect(price).not.toBe("-");
  });
});

describe("⑤ 🔴🔴 UNKNOWN 을 「국내」로 적지 않는다", () => {
  it("market UNKNOWN 이면 시장 뱃지가 **아예 없다**", async () => {
    const el = await mount([UNKNOWN_ROW]);
    expect(el.querySelector('[data-testid="gt-market"]')).toBeNull();
    /**
     * 🔴 단언 범위를 **후보 항목(li)** 으로 좁힌다 — 구역 전체를 보면 고정 문구의
     *    「**국내** 최저가 및 판매판정에 영향을 주지 않습니다」가 걸려서 통과할 수 없다.
     *    🔴 처음에 전체 textContent 로 단언했다가 바로 그것에 걸렸다(단언이 틀렸다).
     */
    const item = el.querySelector("li")?.textContent ?? "";
    expect(item).not.toContain("국내");
    expect(item).not.toContain("해외");
    /** 🟢 그런데 후보 자체는 보인다 — 숨기는 것이 아니라 «단정하지 않는» 것이다. */
    expect(item).toContain("bobochoses.com");
  });

  it("KR/OVERSEAS 는 확인된 경우에만 적는다", async () => {
    expect(marketText("KR")).toBe("국내");
    expect(marketText("OVERSEAS")).toBe("해외");
    expect(marketText("UNKNOWN")).toBeNull();
    expect(marketText(null)).toBeNull();
    expect(marketText(undefined)).toBeNull();
  });

  it("KR 후보에는 「국내」 뱃지가 실제로 보인다(대조군)", async () => {
    const el = await mount([KR_ROW]);
    expect(el.querySelector('[data-testid="gt-market"]')?.textContent).toBe("국내");
  });
});

describe("⑥ 🔴 판정·가격 계산에 손대지 않았다 — 소스 계약", () => {
  const panel = readFileSync(path.join(__dirname, "..", "DomesticPriceIntelligencePanel.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("transient 값이 기존 `candidates` 배열에 섞이지 않는다", () => {
    /** 🔴 setCandidates 에 gemini 값이 들어가면 기존 후보 목록·레이더가 오염된다. */
    expect(panel).not.toMatch(/setCandidates\([^)]*gemini/i);
    expect(panel).toContain("setGeminiEvidence(json.domesticShop?.geminiEvidence ?? null)");
  });

  /**
   * 🔴🔴 **개수로 단언하지 않는다.** 처음에 `toBe(7)` 로 썼다가 8 이 나와 틀렸고,
   *    맞춰도 주석 한 줄에 깨지는 약한 프록시다(메모 `coverage-is-a-property-not-a-filename`).
   * 🟢 대신 **속성** 으로 본다 — transient 값이 «판정/집계 계산과 같은 줄에» 나타나면 FAIL.
   */
  it("판매판정/국내 최저가 계산이 transient 값을 읽지 않는다", () => {
    const FORBIDDEN = [
      "sellerDecision",
      "domesticMarketSplit",
      "domesticCompetition",
      "summarize",
      "setCandidates",
      "radar",
      "representativeVerdict",
      "recommendation",
    ];
    const offending = panel
      .split("\n")
      .filter((line) => line.includes("geminiEvidence"))
      .filter((line) => FORBIDDEN.some((f) => line.toLowerCase().includes(f.toLowerCase())));
    expect(offending).toEqual([]);
    /**
     * 🟢 그리고 실제로 쓰이는 자리 셋은 **있어야** 한다(배선이 사라지면 FAIL).
     *
     * 🟢 WU-029 — 마지막 앵커만 갱신했다. 렌더가 **이름 있는 블록**
     *    (`TransientCandidateSections`)으로 빠졌기 때문이다 — 본문 줄 수 상한을
     *    올리지 않으면서 결과를 접힘 밖에 세우기 위한 것이고, **배선은 그대로** 다.
     */
    expect(panel).toContain("const [geminiEvidence, setGeminiEvidence]");
    expect(panel).toContain("geminiEvidence={geminiEvidence}");
    expect(panel).toContain("<TransientCandidateSections web={geminiEvidence}");
    /**
     * 🔴🔴 WU-081 — **앵커를 갱신하고 «강화» 했다.** 렌더 입력이 `web` → `webRest`
     *    (국내 행을 🇰🇷 구역으로 **옮긴** 나머지)로 바뀌었다. 🟢 **배선 성질은 그대로** 다.
     *    🔴 그래서 이름 하나가 아니라 **「그 파생이 `web` 에서 나온다」** 까지 잠근다 —
     *       이름만 보면 엉뚱한 배열을 넣어도 통과한다(WU-075 에서 당한 계열).
     */
    /**
     * 🔴🔴 WU-136 — **앵커를 갱신하고 또 «강화» 했다.** 그 구역이 이제 **기본 접힘**
     *    으로 그려진다(`collapsed`) — CPO §D 「유사·보류 후보는 셀러 시야에서 치운다」.
     *    🟢 **배선 성질은 그대로** 다(입력도 `webRest` 그대로 · 행/버튼/저장 0 변경).
     *    🔴 **강화** — 「접혔다」까지 단언한다. 접힘을 떼면 후보가 다시 펼쳐지고
     *       그것이 2026-09-19 사고(「유력 후보 5건」)의 기전이다.
     */
    expect(panel).toMatch(/<GeminiTransientCandidates evidence=\{webRest\}\s+collapsed\s*\/>/);
    expect(panel).toContain("const webRest = (web ?? []).filter(");
    /**
     * 🔴 국내 구역도 **transient 입력에서만** 나온다(새 데이터 출처를 만들지 않았다).
     *
     * 🔴🔴 WU-130 — 입력이 **셋** 이 되어 앵커를 갱신했다(해외 자동검색 합류).
     *    🟢 성질은 그대로다 — 🇰🇷 구역의 행은 **전부 transient 배열에서** 온다.
     *    🔴 **강화** 한 점: 세 배열이 **전부** 그 파생에 들어가야 한다. 하나를
     *       빠뜨리면 그 출처의 KR 후보가 **조용히 사라지는** 길이 생긴다.
     */
    /**
     * 🔴🔴 WU-132 — 입력이 **넷** 이 됐다(이전 판단 재투입이 더해졌다). 🟢 성질은
     *    그대로이고 **강화** 도 그대로다 — 네 배열이 **전부** 그 파생에 들어가야 한다.
     *    🔴 하나를 빠뜨리면 그 출처의 KR 후보가 **조용히 사라진다**.
     */
    expect(panel).toContain(
      "const krRows = [...(web ?? []), ...(supplied ?? []), ...(overseasAuto ?? []), ...(reviewedSame ?? [])].filter(isKr)",
    );
    expect(panel).toContain("const overseasAutoRest = (overseasAuto ?? []).filter(");
    expect(panel).toContain("const reviewedSameRest = (reviewedSame ?? []).filter(");
    expect(panel).toContain("<TransientCandidateSections web={geminiEvidence} supplied={urlCandidateEvidence} overseasAuto={overseasAutoEvidence} reviewedSame={reviewedSameEvidence}");
    /** 🔴 그리고 그 구역이 판정/집계 어휘와 **같은 줄에 서지 않는다**(위 FORBIDDEN 과 같은 원칙). */
    const krLines = panel.split(String.fromCharCode(10)).filter((l) => l.includes("krRows") || l.includes("domesticReview"));
    expect(krLines.filter((l) => FORBIDDEN.some((f) => l.toLowerCase().includes(f.toLowerCase())))).toEqual([]);
  });

  it("🔴 저장 호출 0 — transient 구역에 PATCH/POST 승격 경로가 없다", () => {
    const comp = readFileSync(path.join(__dirname, "..", "GeminiTransientCandidates.tsx"), "utf8");
    expect(comp).not.toContain("fetch(");
    expect(comp).not.toContain("confirmSameProduct");
    expect(comp).not.toMatch(/method:\s*"(POST|PATCH|PUT)"/);
  });

  it("🔴 Gemini 호출·flag 를 건드리지 않았다", () => {
    const comp = readFileSync(path.join(__dirname, "..", "GeminiTransientCandidates.tsx"), "utf8");
    expect(comp).not.toContain("MI_GEMINI_DISCOVERY_ENABLED");
    expect(comp).not.toContain("collectGeminiCandidatePool");
    expect(panel).not.toContain("MI_GEMINI_DISCOVERY_ENABLED");
  });

  it("🟢 환산 함수를 쓰지 않는다(통화 그대로)", () => {
    const comp = readFileSync(path.join(__dirname, "..", "GeminiTransientCandidates.tsx"), "utf8");
    expect(comp).not.toContain("convertToKrw");
    expect(comp).not.toContain("exchangeRate");
    expect(priceText({ domain: "d", discoveredUrl: "u", priceAmount: 75, priceCurrency: "EUR" })).toBe("EUR 75");
  });
});
