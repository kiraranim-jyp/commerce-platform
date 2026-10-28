import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCompositeDiscoveryQuery, buildDiscoverySearchQuery } from "../query-planner";
import type { ProductIdentity } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 QUERY-ARCH-01 — **상품당 «하나» 의 복합 Query** 계약 (순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-28) — 품번 중심 Query 로 회귀하지 않는다.
 * `BRAND + [MODEL CODE] + PRODUCT NAME + PRODUCT FACTS + 판매처 신호` **한 개**.
 *
 * 🔴 이 파일은 **Discovery 질의** 만 본다 — SAME/threshold/8축에 닿지 않는다(§9).
 */

const base: ProductIdentity = {
  brand: null,
  productName: null,
  productType: null,
  genderAge: null,
  color: null,
  size: null,
  season: null,
  productCode: null,
  sourceUrl: "https://example.com/products/x",
  sourceSite: null,
  sourceCountry: null,
  market: null,
};
const id = (o: Partial<ProductIdentity>): ProductIdentity => ({ ...base, ...o });

describe("QUERY-ARCH-01 — 복합 Query", () => {
  /** 🔴 §6 — E2E-HISTORY-10 이 「10건 중 8건 Search 0」으로 실측한 그 결함을 닫는다. */
  it("Q1 🔴🔴 **품번이 없어도** 질의가 선다", () => {
    const q = buildCompositeDiscoveryQuery(
      id({ brand: "Sergio Tacchini", productName: "Men's Racchetto Polo", color: "Brilliant White" }),
    );
    expect(q.text, "품번이 없다고 질의를 포기했다 — E2E-HISTORY-10 의 결함이다").not.toBeNull();
    expect(q.text).toContain("Sergio Tacchini");
    expect(q.text).toContain("Racchetto");
    expect(q.text).toContain("Brilliant White");
  });

  /**
   * 🔴 §4 — 품번은 **다른 정보와 함께** 쓴다. 단독 질의를 만들지 않는다.
   *
   * 🔴🔴 **운영 진입점으로도 같이 단언한다.** 1차에는 `buildCompositeDiscoveryQuery`
   *    만 봤는데, 변이 N5(`buildDiscoverySearchQuery` 앞에 품번 단축을 끼움)가
   *    **통과했다** — 조립기는 멀쩡한데 **운영이 부르는 함수** 가 품번 단독으로
   *    되돌아갈 수 있었다. 두 자리를 **같이** 잠근다.
   */
  it("Q2 🔴 품번이 있어도 **품번 단독 질의가 아니다**(운영 진입점 포함)", () => {
    const input = id({
      brand: "Bobo Choses",
      productCode: "B226AC009",
      productName: "Hug Hairy Monster T-shirt",
    });
    for (const [where, text] of [
      ["조립기", buildCompositeDiscoveryQuery(input).text],
      ["운영 진입점", buildDiscoverySearchQuery(input)],
    ] as const) {
      expect(text, `${where}: 질의가 없다`).not.toBeNull();
      expect(text!, `${where}`).toContain('"B226AC009"');
      expect(text!, `${where}`).toContain('"Bobo Choses"');
      expect(text!, `${where}`).toContain("Hug");
      expect(text!, `${where}: 품번 하나로 쪼그라들었다`).not.toBe('"B226AC009"');
    }
    expect(buildCompositeDiscoveryQuery(input).parts.design.length).toBeGreaterThan(0);
  });

  it("Q3 🔴 재료가 **아무것도** 없으면 질의를 만들지 않는다(신호만 남기지 않는다)", () => {
    const q = buildCompositeDiscoveryQuery(id({}));
    expect(q.text).toBeNull();
    expect(q.tokenCount).toBe(0);
  });

  /** 🔴 §2-1 — 상품당 정확히 1개. 조립기는 문자열 **하나** 만 돌려준다. */
  it("Q4 🔴 질의는 **한 개** 다 — 배열/변형을 내지 않는다", () => {
    const q = buildDiscoverySearchQuery(id({ brand: "BOSS", productName: "Baby Boys Logo Top" }));
    expect(typeof q).toBe("string");
    expect(q!.split(/\s+/).length).toBeLessThanOrEqual(20);
  });

  /** 🔴 따옴표를 디자인명·사실에 걸면 정확일치 요구가 되어 recall 이 죽는다. */
  it("Q5 🔴 따옴표는 **식별자(브랜드·품번)에만** 건다", () => {
    const q = buildCompositeDiscoveryQuery(
      id({ brand: "Main Story", productCode: "AW26MS185", productName: "Bubble Sweatshirt", color: "Grey" }),
    )
      .text!;
    expect(q).toContain('"Main Story"');
    expect(q).toContain('"AW26MS185"');
    expect(q).not.toContain('"Bubble"');
    expect(q).not.toContain('"Grey"');
  });

  /**
   * 🔴 1차 Preview 에서 실제로 났다 — `Bubble Sweatshirt **Melange** Grey **Melange**`.
   *    같은 근거를 두 번 세지 않는다.
   */
  it("Q6 🔴 같은 단어가 **두 번** 실리지 않는다", () => {
    const q = buildCompositeDiscoveryQuery(
      id({ brand: "Main Story", productName: "Bubble Sweatshirt in Melange", color: "Grey Melange" }),
    ).text!;
    const words = q.toLowerCase().replace(/"/g, "").split(/\s+/);
    const dup = words.filter((w, i) => words.indexOf(w) !== i);
    expect(dup, `중복 단어: ${dup.join(",")}`).toEqual([]);
  });

  /**
   * 🔴 1차 수정에서 내가 깨뜨렸다 — 기능어를 구 «안쪽» 까지 거르니
   *    `true to size` 가 **`true size`** 가 됐다. 가장자리에서만 떼어 낸다.
   */
  it("Q7 🔴 사실의 **구를 깨뜨리지 않는다** — `true to size` 가 보존된다", () => {
    const q = buildCompositeDiscoveryQuery(
      id({ brand: "Sergio Tacchini", productName: "Polo", facts: ["true to size"] }),
    ).text!;
    expect(q).toContain("true to size");
  });

  /** 🟢 SP-09 `S-A2` — 끊긴 꼬리 전치사는 질의를 좁히지 못한다. */
  it("Q8 🟢 디자인명의 **끊긴 기능어** 는 들어가지 않는다", () => {
    const q = buildCompositeDiscoveryQuery(
      id({ brand: "The Animals Observatory", productName: "Pupfish Kid T-Shirt in" }),
    ).text!;
    expect(q.split(/\s+/)).not.toContain("in");
  });

  /** 🔴 사이즈/연령은 denylist 가 노이즈로 판정한 축이다 — 질의에 넣지 않는다. */
  it("Q9 🔴 사이즈는 질의에 들어가지 않는다", () => {
    const q = buildCompositeDiscoveryQuery(
      id({ brand: "Bobo Choses", productName: "T-shirt", size: "4-5Y" }),
    ).text!;
    expect(q).not.toContain("4-5Y");
  });

  /**
   * 🔴🔴 §9 — Query 를 풍부하게 만든 것이 Identity 를 바꾸지 않는다.
   *    질의 조립기가 매칭/판정 모듈을 **import 하지 않는다**(방향 가드).
   */
  it("Q10 🔴 질의 조립기는 **Identity 모듈을 import 하지 않는다**", () => {
    const src = readFileSync(join(__dirname, "../query-planner.ts"), "utf8");
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    for (const i of imports) {
      expect(
        /match-truth|cross-seller|market-intelligence|product-identity\b/.test(i),
        `질의 조립기가 판정 모듈을 끌어온다: ${i}`,
      ).toBe(false);
    }
  });

  /**
   * 🔴🔴 **운영 호출부가 재료를 채워야** 조립기가 의미를 갖는다. 1차 상태가 바로
   *    그 반대였다 — `productName: null · color: null` 이라 질의가 품번 하나였다.
   */
  it("Q11 🔴🔴 운영 호출부가 **재료를 비워 보내지 않는다**", () => {
    const runner = readFileSync(
      join(__dirname, "../../../../../apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const at = runner.indexOf("collectWebSearchUrls({");
    expect(at).toBeGreaterThan(0);
    const call = runner.slice(at, runner.indexOf("});", at));
    expect(call, "productName 을 null 로 되돌렸다").toContain("productName: input.dna.title");
    expect(call, "color 를 null 로 되돌렸다").toContain("color: input.dna.color");
    expect(call, "상세 사실(facts) 배선이 끊겼다").toContain("facts:");
    expect(call).toContain("input.dna.material");
  });
});
