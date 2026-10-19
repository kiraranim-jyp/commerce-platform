// @vitest-environment jsdom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CandidateComparison,
  selectOtherCandidates,
  selectVisualCheckCandidates,
  NO_CANDIDATE_AT_ALL,
  NO_SAME_BUT_CANDIDATES,
  OTHER_CANDIDATES_NOTICE,
  type CandidateWithShop,
} from "../CandidateComparison";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-091 — **후보 노출과 SAME 판정을 가른다** (CPO 지시 2026-10-19)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「8축 ❌ · threshold ❌ · matchLevel ❌ · 가격 게이트 ❌ · market gate ❌ ·
 *    Registry ❌ · AI ❌ · **판정 알고리즘 변경 ❌** · **가격 계산 변경 ❌**」
 *    ⟹ 이 WU 는 **정보 노출/구조** 만 바꾼다.
 *
 * ── 🔴🔴 이 하니스가 «동시에» 지켜야 하는 두 가지 ──────────────────────────
 * ```
 * ⒜ CPO 신규 요구 — SAME 이 아닌 후보도 **보여야 한다**
 * ⒝ 2026-09-19 사고 — SAME 이 아닌 후보가 **유력 후보처럼 보이면 안 된다**
 *    (CandidateComparison.tsx 머리 주석 · Pèpè Lulu T Bar Shoes)
 * ```
 * 🔴 둘은 모순이 아니다. 가르는 것은 **「접힘 + 판정 라벨 + 비사용 명시」** 다.
 *    그래서 아래 계약은 **보인다** 와 **유력해 보이지 않는다** 를 «같이» 단언한다.
 *
 * 🔴 화면은 **마운트한 DOM** 으로만 본다(헌장 §5 · Render PASS ≠ 소스 PASS).
 */

const HERE = path.join(process.cwd(), "src/app/pipeline/commerce");
/** 🔴 주석을 벗기고 본다 — 이 리포에서 여덟 번 걸린 함정(헌장 §5). */
const srcOf = (f: string) =>
  readFileSync(path.join(HERE, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const ORIGIN = {
  title: "Bobo Choses Pop T-shirt",
  brand: "Bobo Choses",
  imageUrl: null,
  price: { amount: 50, currency: "EUR" },
  sourceUrl: "https://bobochoses.com/en-kr/products/b226ac112-bobo-choses-pop-t-shirt",
};

const row = (
  tier: CandidateWithShop["tier"],
  shopName: string,
  over: Partial<CandidateWithShop["candidate"]> = {},
): CandidateWithShop => ({
  shopName,
  tier,
  candidate: {
    title: `${shopName} 상품`,
    url: `https://${shopName}/p/1`,
    price: { amount: 108_000, currency: "KRW" },
    imageUrl: null,
    matchReasons: ["브랜드 일치"],
    ...over,
  },
});

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mount = (rows: CandidateWithShop[], marketLabel = "국내") => {
  act(() => {
    root.render(createElement(CandidateComparison, { origin: ORIGIN, rows, marketLabel }));
  });
  return host;
};
const q = (t: string) => host.querySelector(`[data-testid="${t}"]`);
const qa = (t: string) => Array.from(host.querySelectorAll(`[data-testid="${t}"]`));

describe("WU-091 ① 「후보 없음」과 「동일상품 없음」은 다른 말이다", () => {
  it("후보가 0건이면 «찾지 못했다» 고 말한다", () => {
    mount([]);
    expect(q("cc-empty")?.textContent).toBe(NO_CANDIDATE_AT_ALL);
    /** 🔴 0건일 때 접힌 목록을 만들지 않는다 — 빈 서랍은 셀러를 속인다. */
    expect(q("cc-others")).toBeNull();
  });

  it("🔴🔴 후보는 있는데 SAME 이 없으면 «다른 문장» 을 쓴다", () => {
    mount([row("SIMILAR", "a.kr"), row("UNKNOWN", "b.kr"), row("CONFLICT", "c.kr")]);
    expect(q("cc-no-same")?.textContent).toBe(NO_SAME_BUT_CANDIDATES);
    /** 🔴 두 문장이 **서로 달라야** CPO §6 의 분리가 성립한다. */
    expect(NO_SAME_BUT_CANDIDATES).not.toBe(NO_CANDIDATE_AT_ALL);
    expect(q("cc-empty")).toBeNull();
  });

  it("검색된 «곳 수 · 건수» 를 적는다 — 「없음」으로 뭉개지 않는다", () => {
    mount([row("SIMILAR", "a.kr"), row("UNKNOWN", "a.kr"), row("CONFLICT", "b.kr")]);
    expect(q("cc-count")?.textContent).toBe("2곳 · 3건 검색됨");
  });
});

describe("WU-091 ② SAME 이 아닌 후보도 «보인다»", () => {
  it("나머지 후보가 전부 목록에 선다(거르지 않는다)", () => {
    mount([row("SIMILAR", "a.kr"), row("UNKNOWN", "b.kr"), row("CONFLICT", "c.kr")]);
    expect(qa("cc-other-row")).toHaveLength(3);
  });

  it("🔴 CONFLICT(다른상품)도 숨기지 않는다 — 그것이 이 WU 의 요구다", () => {
    mount([row("CONFLICT", "c.kr")]);
    const labels = qa("cc-other-verdict").map((e) => e.textContent);
    expect(labels.join()).toContain("다른");
  });

  it("행마다 판매처·상품명·가격·상품코드·판정·이유·링크가 있다", () => {
    mount([row("SIMILAR", "a.kr", { modelCode: "B226AC112" })]);
    expect(q("cc-other-shop")?.textContent).toBe("a.kr");
    expect(q("cc-other-title")?.textContent).toBe("a.kr 상품");
    expect(host.textContent).toContain("108,000");
    expect(q("cc-other-code")?.textContent).toBe("상품코드 B226AC112");
    expect(q("cc-other-verdict")?.textContent?.length).toBeGreaterThan(0);
    expect(q("cc-other-note")?.textContent?.length).toBeGreaterThan(0);
    expect(q("cc-other-reasons")?.textContent).toContain("브랜드 일치");
    expect((q("cc-other-link") as HTMLAnchorElement).href).toBe("https://a.kr/p/1");
  });

  it("🔴 품번이 없으면 «없음» 이라고 적는다 — 지어내지 않는다", () => {
    mount([row("SIMILAR", "a.kr")]);
    expect(q("cc-other-code")?.textContent).toBe("상품코드 없음");
  });

  it("🟢 동일상품을 찾았더라도 나머지를 숨기지 않는다", () => {
    mount([row("SAME", "same.kr"), row("CONFLICT", "c.kr")]);
    /** 🟢 카드(기존 경로)와 접힌 목록이 **둘 다** 선다. */
    expect(host.textContent).toContain("same.kr");
    expect(qa("cc-other-row")).toHaveLength(1);
  });
});

describe("WU-091 ③ 🔴🔴 그러나 «유력 후보처럼» 보이면 안 된다 (2026-09-19 사고)", () => {
  it("🔴 목록은 **기본 접힘** 이다 — `open` 속성이 없다", () => {
    mount([row("SIMILAR", "a.kr")]);
    const d = q("cc-others") as HTMLDetailsElement;
    expect(d).not.toBeNull();
    /** 🔴 이 단언이 사고의 모양(「펼쳐진 채 가격이 달려 있었다」)을 직접 막는다. */
    expect(d.hasAttribute("open")).toBe(false);
    expect(d.open).toBe(false);
  });

  it("🔴 구역이 «가격비교에 사용되지 않는다» 고 말한다", () => {
    mount([row("SIMILAR", "a.kr")]);
    expect(q("cc-others-notice")?.textContent).toBe(OTHER_CANDIDATES_NOTICE);
    expect(OTHER_CANDIDATES_NOTICE).toContain("가격비교에 사용되지 않습니다");
  });

  it("🔴 접힌 제목이 «동일상품» 이라고 말하지 않는다", () => {
    mount([row("SIMILAR", "a.kr"), row("UNKNOWN", "b.kr")]);
    const sum = q("cc-others-summary")?.textContent ?? "";
    expect(sum).toBe("국내 후보 2건 보기");
    expect(sum).not.toContain("동일상품");
  });

  it("🔴 판정 라벨이 **행마다** 있다 — 하나라도 빠지면 그 행이 중립으로 읽힌다", () => {
    mount([row("SIMILAR", "a.kr"), row("UNKNOWN", "b.kr"), row("CONFLICT", "c.kr")]);
    expect(qa("cc-other-verdict")).toHaveLength(qa("cc-other-row").length);
  });
});

describe("WU-091 ④ 판정 정책은 «그대로» 다", () => {
  it("🔴 카드에 올리는 등급 정책을 바꾸지 않았다", () => {
    const rows = [row("SAME", "s.kr"), row("PRESUMED_SAME", "p.kr"), row("SIMILAR", "x.kr")];
    expect(selectVisualCheckCandidates(rows).map((r) => r.tier)).toEqual(["SAME"]);
  });

  it("🔴 두 집합은 **겹치지 않고** 합하면 전체다(후보를 잃지 않는다)", () => {
    const rows = [
      row("SAME", "s.kr"),
      row("SAME_MODEL_OPTION_DIFF", "o.kr"),
      row("PRESUMED_SAME", "p.kr"),
      row("SIMILAR", "x.kr"),
      row("UNKNOWN", "u.kr"),
      row("CONFLICT", "c.kr"),
    ];
    const a = selectVisualCheckCandidates(rows);
    const b = selectOtherCandidates(rows);
    expect(a.length + b.length).toBe(rows.length);
    expect(a.filter((x) => b.includes(x))).toHaveLength(0);
  });

  it("🔴 확정에 가까운 쪽이 위다 — CONFLICT 가 맨 위로 올라오지 않는다", () => {
    const rows = [row("CONFLICT", "c.kr"), row("UNKNOWN", "u.kr"), row("PRESUMED_SAME", "p.kr")];
    expect(selectOtherCandidates(rows).map((r) => r.tier)).toEqual([
      "PRESUMED_SAME",
      "UNKNOWN",
      "CONFLICT",
    ]);
  });
});

describe("WU-091 ⑤ 국내/해외가 «같은 구조» 다", () => {
  it("해외도 같은 컴포넌트·같은 testid 로 그려진다", () => {
    mount([row("SIMILAR", "a.com"), row("UNKNOWN", "b.com")], "해외");
    expect(q("cc-others-summary")?.textContent).toBe("해외 후보 2건 보기");
    expect(qa("cc-other-row")).toHaveLength(2);
  });

  it("🔴 두 호출부가 **같은 컴포넌트** 를 쓴다(화면이 두 벌이 되지 않는다)", () => {
    for (const f of ["DomesticShopSearch.tsx", "ComparisonShopSearch.tsx"]) {
      expect(srcOf(f)).toContain("<CandidateComparison");
    }
  });
});

describe("WU-091 ⑥ 네이버 검색 링크 제거", () => {
  it("🔴 소스에 네이버 검색 링크가 없다", () => {
    const s = srcOf("DomesticShopSearch.tsx");
    expect(s).not.toContain("search.shopping.naver.com");
    expect(s).not.toContain("네이버에서");
  });

  it("🔴 커머스 화면 전체에서 외부 검색으로 빠지는 링크가 없다", () => {
    for (const f of ["DomesticShopSearch.tsx", "ComparisonShopSearch.tsx", "CandidateComparison.tsx"]) {
      expect(srcOf(f)).not.toContain("search.shopping.naver.com");
    }
  });
});
