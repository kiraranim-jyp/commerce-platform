/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SELLER-UX-GAP-INVESTIGATION-1 — **현재 셀러 화면의 «전수 목록»**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 전용이다.** 운영 코드 변경 **0** · 개선 **0** · PASS 선언 **0**.
 *    CPO 가 이 결과를 보고 **제품 정책과 목표 화면을 먼저 확정** 한 뒤 구현한다.
 *
 * 🔴 CEO Production FAIL(2026-11-09) — 「기존과 달라진 게 없고, 불필요한 정보가 여전히
 *    많이 노출되며, 판매 판정도 계속 **조건부 판매** 다」. 이 파일이 그 셋을 **숫자로** 센다.
 *
 * 🟢 하니스는 **새로 만들지 않는다** — `seller-surface-composition`(31c77058)을 그대로 쓴다.
 *    🔴 그래야 「CTO 검토 화면」이 아니라 **운영이 조립하는 그 트리** 를 보는 것이 된다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  sellerSurfaceElement,
  SNAPSHOT_ID,
  surfaceRegions,
  type SellerSurfaceOptions,
} from "./seller-surface-composition";
import { productionData, withDomesticComparable } from "./product-tab-composition";
import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import { FINAL_VERDICT_COPY, resolveSellVerdictCopy } from "../DomesticPriceIntelligencePanel";

let container: HTMLDivElement;
let root: Root;

function stubFetch(data: PriceHistoryResponse | null): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url === `/api/price-history/${SNAPSHOT_ID}`) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data ?? { ok: false }) });
      }
      if (url.startsWith("/api/domestic-price-sources/links")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, links: [] }) });
      }
      if (url.includes("/alerts")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, alerts: [] }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

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
  vi.unstubAllGlobals();
});

async function mount(options: SellerSurfaceOptions = {}): Promise<void> {
  await act(async () => {
    root.render(sellerSurfaceElement(options));
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** 🔴 닫힌 `details` 를 지운다 = 셀러가 **펼치지 않고** 보는 것. */
function visibleClone(el: HTMLElement): HTMLElement {
  const clone = el.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return clone;
}

/** 한 영역의 **1차 글자 수**(접힘 제외)와 **전체 글자 수**. */
function weight(el: HTMLElement): { first: number; whole: number } {
  const t = (n: HTMLElement) => (n.textContent ?? "").replace(/\s+/g, " ").trim().length;
  return { first: t(visibleClone(el)), whole: t(el) };
}

/** 영역 안의 `data-testid` 목록(문서 순서 · 1차에 보이는 것만). */
function testidsIn(el: HTMLElement): string[] {
  return [...visibleClone(el).querySelectorAll("[data-testid]")].map(
    (n) => (n as HTMLElement).dataset.testid ?? "",
  );
}

describe("SELLER-UX-GAP-INVESTIGATION-1 — ①② 화면 구성요소 전수(관측)", () => {
  it("덤프 — 영역별 1차 요소 · 글자 비중", async () => {
    stubFetch(productionData());
    await mount();
    const { summary, conclusion, right } = surfaceRegions(container);
    const rows: string[] = ["\n━━━━━━━━━━ ① 영역별 1차 구성 (CASE D · 운영 최빈 상태) ━━━━━━━━━━"];
    for (const [name, el] of [
      ["상단 요약", summary],
      ["결론(가격 분석)", conclusion],
      ["ActionCenter", right],
    ] as const) {
      if (!el) {
        rows.push(`${name} : 🔴 서지 않는다`);
        continue;
      }
      const w = weight(el);
      rows.push(
        `\n▸ ${name}  1차 ${w.first}자 / 전체 ${w.whole}자 (접힘 비중 ${(((w.whole - w.first) / Math.max(1, w.whole)) * 100).toFixed(0)}%)`,
      );
      rows.push(`  testid(1차): ${testidsIn(el).join(" · ") || "—"}`);
      rows.push(`  글자(1차): ${(visibleClone(el).textContent ?? "").replace(/\s+/g, " ").trim()}`);
    }
    const all = weight(container);
    rows.push(
      `\n▸ 화면 전체  1차 ${all.first}자 / 전체 ${all.whole}자 — 셀러가 «펼치지 않고» 읽는 양이 1차다`,
    );
    // eslint-disable-next-line no-console
    console.log(rows.join("\n"));
    expect(true).toBe(true);
  });

  /**
   * 🔴 CASE D 는 후보가 **0** 이라 「후보 목록」의 무게를 재지 못한다. CPO ②가 그 영역을
   *    지목했으므로 **후보가 있는 상태** 를 따로 뜬다. 🟢 `savedCandidateRows` 는 서버가
   *    이미 내려주는 칸이고(재진입 복원용 · `CANDIDATE-UX-REFINE-04 B-3`) 여기서
   *    **지어내는 값이 아니다** — 모양만 운영 타입 그대로 채운다.
   */
  it("덤프 — 후보가 «있을 때» 의 1차 무게", async () => {
    const row = (over: Record<string, unknown>) =>
      ({
        source: "OVERSEAS_AUTO",
        domain: "a.example",
        title: "Terry Bermuda Shorts",
        imageUrl: null,
        soldOut: false,
        discoveredUrl: "https://a.example/p/1",
        matchTruth: "EXACT_IDENTIFIER",
        priceTier: "EXACT",
        crossSellerVerdict: "SAME",
        confidence: 1,
        matchReasons: [],
        crossSellerBlockers: [],
        crossSellerConflicts: [],
        priceAmount: 37,
        priceCurrency: "GBP",
        priceStatus: "VERIFIED_CURRENT",
        market: "OVERSEAS",
        basis: "TLD",
        ...over,
      }) as never;
    const data = productionData() as PriceHistoryResponse & { savedCandidateRows?: unknown };
    data.savedCandidateRows = [
      row({ domain: "junioredition.com", discoveredUrl: "https://junioredition.com/p/1" }),
      row({ domain: "www.tinyapple.net", discoveredUrl: "https://www.tinyapple.net/p/2", priceAmount: 58, priceCurrency: "USD" }),
      row({ domain: "biskuit.kr", discoveredUrl: "https://biskuit.kr/p/3", market: "KR", priceAmount: 88000, priceCurrency: "KRW" }),
    ];
    stubFetch(data);
    await mount();
    const { conclusion } = surfaceRegions(container);
    const w = weight(conclusion!);
    // eslint-disable-next-line no-console
    console.log(
      [
        "\n━━━━━━━━━━ ①-b 후보 3건이 있을 때 (결론 영역) ━━━━━━━━━━",
        `  1차 ${w.first}자 / 전체 ${w.whole}자 (접힘 비중 ${(((w.whole - w.first) / Math.max(1, w.whole)) * 100).toFixed(0)}%)`,
        `  testid(1차) ${testidsIn(conclusion!).length}개`,
        `  글자(1차): ${(visibleClone(conclusion!).textContent ?? "").replace(/\s+/g, " ").trim()}`,
      ].join("\n"),
    );
    expect(true).toBe(true);
  });

  it("덤프 — 판정 문구가 «몇 곳» 에서 반복되는가", async () => {
    stubFetch(productionData());
    await mount();
    const data = productionData();
    const title = resolveSellVerdictCopy(
      data.sellerDecision!.finalVerdict,
      data.representativeVerdict!.code,
    )!.title;
    const { summary, conclusion, right } = surfaceRegions(container);
    const areas = [
      ["요약", summary],
      ["결론", conclusion],
      ["ActionCenter", right],
    ] as const;
    const hits = areas
      .filter(([, el]) => el != null && (visibleClone(el).textContent ?? "").includes(title))
      .map(([name]) => name);
    // eslint-disable-next-line no-console
    console.log(`\n━━━━━━━━━━ ② 판정 문구 「${title}」 반복 ━━━━━━━━━━\n  1차 노출 영역: ${hits.join(" · ")} (${hits.length}곳)`);
    expect(true).toBe(true);
  });
});

describe("SELLER-UX-GAP-INVESTIGATION-1 — ③④ 「조건부 판매」의 owner 사슬(관측)", () => {
  /**
   * 🔴🔴 **이 표가 이 조사의 핵심이다.**
   *
   * `SELLER_FACING_MAP`(representative-seller-decision.ts:314)이 **여섯 코드를 셋으로**
   * 압축한다. 🔴 그중 **다섯이 `CONDITIONAL`**(= 「조건부 판매」)이고 `READY` 하나만
   * 「판매 추천」이다. 그리고 `MI-REVIEW-MATCH-DISPLAY-1` 의 resolver 는 그 다섯 중
   * **`REVIEW_MATCH` 하나만** 다른 문구로 바꾼다.
   */
  const CODES = [
    "READY",
    "REVIEW_MATCH",
    "REVIEW_PRICE",
    "MARKET_OPPORTUNITY",
    "NEEDS_INFO",
    "HOLD",
  ] as const;

  it("덤프 — representative code → 화면 문구 (resolver 전수)", () => {
    const rows = ["\n━━━━━━━━━━ ③ representative → 셀러 화면 문구 ━━━━━━━━━━"];
    rows.push("  code                 finalVerdict      화면 문구");
    for (const code of CODES) {
      /** 🔴 `finalVerdict` 는 서버가 `SELLER_FACING_MAP` 으로 이미 정한 값이다. */
      const facing =
        code === "READY" ? "RECOMMENDED" : code === "HOLD" ? "NOT_RECOMMENDED" : "CONDITIONAL";
      const copy = resolveSellVerdictCopy(facing as never, code as never)!;
      rows.push(
        `  ${code.padEnd(20)} ${facing.padEnd(17)} ${copy.icon} ${copy.title}${
          copy.title === FINAL_VERDICT_COPY.CONDITIONAL.title ? "   ← 🔴 조건부 판매" : ""
        }`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(rows.join("\n"));

    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🟢🟢 **이 단언이 «뒤집혔다»** — `SELLER-UX-IMPLEMENTATION-1`(CPO 승인 2026-11-09)
     * ══════════════════════════════════════════════════════════════════════
     *
     * 🔴 조사 시점(`3c7fa173`)에는 「조건부 판매」로 보이는 코드가 **셋** 이었고 이 자리는
     *    `toBeGreaterThan(1)` 로 **그 결함을 고정** 했다. CPO 가 분리를 승인했으므로
     *    **그 단언이 FAIL 로 뒤집히는 것이 수정의 증거** 다(이 저장소 앵커 규약).
     * 🟢 이제 **반대 방향** 을 잠근다 — 여섯 코드가 **서로 다른 문구** 를 갖는다.
     */
    const titles = CODES.map((code) => {
      const facing =
        code === "READY" ? "RECOMMENDED" : code === "HOLD" ? "NOT_RECOMMENDED" : "CONDITIONAL";
      return resolveSellVerdictCopy(facing as never, code as never)!.title;
    });
    /** 🔴 「조건부 판매」가 **어느 코드에도** 남지 않았다(그것이 덮던 셋이 갈렸다). */
    expect(titles, "🔴 「조건부 판매」가 되돌아왔다").not.toContain(
      FINAL_VERDICT_COPY.CONDITIONAL.title,
    );
    /** 🔴 그리고 **여섯이 전부 다른 말** 이다(둘이 같아지면 다시 덮는 것이다). */
    expect(new Set(titles).size, `🔴 문구가 겹친다: ${titles.join(" · ")}`).toBe(CODES.length);
    /**
     * 🔴🔴 **행동 지시가 있어야 하는 넷** 과 **없어야 하는 둘** 을 갈라서 단언한다.
     *    `READY`(추천)·`HOLD`(비추천)는 **결론** 이라 행동 지시가 아니다(CPO 범위).
     */
    for (const code of CODES) {
      const facing =
        code === "READY" ? "RECOMMENDED" : code === "HOLD" ? "NOT_RECOMMENDED" : "CONDITIONAL";
      const copy = resolveSellVerdictCopy(facing as never, code as never)!;
      if (code === "READY" || code === "HOLD") {
        expect(copy.action ?? null, `🔴 ${code} 에 행동 지시가 생겼다`).toBeNull();
      } else {
        expect(copy.action, `🔴 ${code} 에 다음 행동이 없다`).toBeTruthy();
      }
    }
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔴🔴 **불변식 — 분리는 `CONDITIONAL` 코드에만 적용된다**(tone 이 갈라지면 CTA 가 깨진다)
     * ══════════════════════════════════════════════════════════════════════
     *
     * 🔴 왜 필요한가 — 비추천 CTA 게이트(`③`)는 `sellVerdictCopy.tone === "STOP"` 을 본다.
     *    만약 `REPRESENTATIVE_DISPLAY` 에 **facing 이 RECOMMENDED/NOT_RECOMMENDED 인 코드**
     *    가 들어가면 tone 이 `CAUTION` 으로 덮여 **그 게이트가 조용히 죽는다.**
     * 🟢 실제로 이 WU 에서 그 모양을 봤다 — 거짓 fixture(`NOT_RECOMMENDED + REVIEW_PRICE`)가
     *    STOP 게이트를 통과시켰다. 🟢 운영에선 불가능한 조합이지만 **계약으로 잠근다.**
     */
    for (const code of CODES) {
      const facing =
        code === "READY" ? "RECOMMENDED" : code === "HOLD" ? "NOT_RECOMMENDED" : "CONDITIONAL";
      const copy = resolveSellVerdictCopy(facing as never, code as never)!;
      if (facing === "CONDITIONAL") {
        expect(copy.tone, `🔴 ${code} 의 tone 이 CAUTION 이 아니다`).toBe("CAUTION");
      } else {
        /** 🔴 분리 대상이 아니면 `FINAL_VERDICT_COPY` 가 **그대로** 이긴다(tone 보존). */
        expect(copy, `🔴 ${code} 가 분리 맵에 들어갔다(tone 이 덮인다)`).toEqual(
          FINAL_VERDICT_COPY[facing as "RECOMMENDED" | "NOT_RECOMMENDED"],
        );
      }
    }
    // eslint-disable-next-line no-console
    console.log(`\n  🟢 여섯 코드가 서로 다른 문구를 갖는다: ${titles.join(" · ")}`);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 **다섯 번째 consumer 는 «소스 축» 으로만 지킬 수 있다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 조사가 찾은 자리 — `Panel` 의 `marketSignal.verdictLabel` 은 `workflow.ts:494·506`
   *    으로 가서 **단계 메시지**(「분석 완료 · {label}」)가 된다. 🔴 이 하니스는 `StageBody`
   *    를 마운트하지 않으므로 **그 우회를 행동으로 잡을 수 없다**(WU-110 교훈의 반복).
   * 🟢 그래서 **주석을 벗긴 소스** 로 못박는다 — `FINAL_VERDICT_COPY` 를 **직접** 읽어
   *    `verdictLabel` 을 만들면 FAIL 한다.
   */
  it("🔴 배선 — 다섯 번째 consumer 가 공통 resolver 를 쓴다(우회 금지)", () => {
    const src = readFileSync(
      join(__dirname, "..", "DomesticPriceIntelligencePanel.tsx"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    /** 🟢 resolver 를 통과한다. */
    expect(src).toMatch(/verdictLabel:\s*\n?\s*resolveSellVerdictCopy\(/);
    /** 🔴 그리고 **직접 읽는 모양이 없다**(그것이 조사가 찾은 그 우회다). */
    expect(src, "🔴 verdictLabel 이 FINAL_VERDICT_COPY 를 직접 읽는다").not.toMatch(
      /verdictLabel:\s*verdict\s*\?\s*FINAL_VERDICT_COPY/,
    );
  });

  it("덤프 — 「판매 추천」이 되는 유일한 조건", async () => {
    stubFetch(withDomesticComparable());
    await mount();
    const { summary } = surfaceRegions(container);
    // eslint-disable-next-line no-console
    console.log(
      [
        "\n━━━━━━━━━━ ④ 「판매 추천」이 서는 조건 ━━━━━━━━━━",
        "  READY 만 RECOMMENDED 이고, READY 는 두 자리에서 모두",
        "  **domesticBasis === \"EXACT\"** 를 요구한다:",
        "    :236  if (code === \"READY\" && input.domesticBasis !== \"EXACT\") code = \"REVIEW_MATCH\"",
        "    :252  const code = input.domesticBasis === \"EXACT\" ? \"READY\" : \"REVIEW_MATCH\"",
        `  ⟹ 국내 EXACT 동일상품이 없으면 「판매 추천」이 **구조적으로 불가능** 하다.`,
        `  fixture basis=EXACT 일 때 요약 1차: ${(visibleClone(summary!).textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90)}`,
      ].join("\n"),
    );
    expect(true).toBe(true);
  });
});
