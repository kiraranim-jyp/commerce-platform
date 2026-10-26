import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProductFacts } from "@commerce/shared";
import {
  DETAIL_MODEL_CODE_PATTERN,
  extractDetailModelCodes,
  recoverModelCodeFromDetail,
} from "../model-code-from-detail";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-02 — **안전계약 A~F**(네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §4 가 고정한 여섯 계약을 **글자 그대로** 잠근다. 하나라도 깨지면 이 공급은
 *    **DIFFERENT 를 열 수 있다** ⟹ 그래서 계약이 먼저다.
 */

const facts = (over: Partial<ProductFacts> = {}): ProductFacts => ({
  sourceUrl: "https://example.com/products/x",
  urlSlug: "x",
  brand: "Bobo Choses",
  brandModelCode: null,
  sellerSku: null,
  title: "Hug Hairy Monster T-Shirt",
  coreTitleTokens: ["hug", "hairy", "monster"],
  categoryText: "T-shirt",
  colorText: "Light Blue",
  materialText: null,
  description: null,
  fitText: null,
  ageRangeText: null,
  sizeLabels: [],
  audienceSignals: [],
  imageUrls: [],
  ...over,
});

describe("SPRINT-02 Contract A — 기존 brandModelCode 를 «절대» 덮지 않는다", () => {
  it("설명에 다른 품번이 있어도 기존 값을 유지한다", () => {
    const f = facts({ brandModelCode: "B226AC010", description: "… REF: B226AC141 …" });
    const out = recoverModelCodeFromDetail(f);
    expect(out.brandModelCode, "🔴 덮어쓰면 기존 MODEL_CODE 충돌 보호가 무너진다").toBe("B226AC010");
    /** 🟢 같은 객체를 돌려준다 — 불필요한 사본을 만들지 않는다. */
    expect(out).toBe(f);
  });

  it("설명에 같은 품번이 있어도 기존 값을 그대로 둔다(동작 동일)", () => {
    const f = facts({ brandModelCode: "B226AC009", description: "… B226AC009 …" });
    expect(recoverModelCodeFromDetail(f).brandModelCode).toBe("B226AC009");
  });
});

describe("SPRINT-02 Contract B — 후보측만 본다(원상품 설명은 구조적으로 못 본다)", () => {
  it("함수가 ProductFacts 하나만 받는다 — 원상품을 넘길 자리가 없다", () => {
    /** 🔴 인자가 둘이 되면 「원상품 설명 → 후보 품번」이 가능해진다 ⟹ 길이로 잠근다. */
    expect(recoverModelCodeFromDetail.length, "🔴 인자가 늘면 오염 경로가 열린다").toBe(1);
    const src = readFileSync(join(__dirname, "../model-code-from-detail.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/.*$/gm, " ");
    /** 🔴 origin/query 어휘가 **코드에 없다**(주석을 벗기고 본다). */
    for (const token of ["origin", "query", "Origin", "Query"]) {
      expect(src, `🔴 「${token}」가 코드에 있으면 후보측 전용이 아니다`).not.toContain(token);
    }
  });
});

describe("SPRINT-02 Contract C — 품번이 둘 이상이면 고르지 않는다", () => {
  it("서로 다른 품번 2개면 보강하지 않는다", () => {
    const f = facts({ description: "… B226AC009 … 관련상품 B226AC010 …" });
    expect(recoverModelCodeFromDetail(f).brandModelCode, "🔴 하나를 고르면 그것이 지어내기다").toBeNull();
  });

  it("같은 품번이 여러 번 나오면 하나로 보고 보강한다", () => {
    const f = facts({ description: "B226AC009 … 다시 B226AC009 … b226ac009" });
    expect(recoverModelCodeFromDetail(f).brandModelCode).toBe("B226AC009");
  });

  it("0개면 그대로 둔다", () => {
    expect(recoverModelCodeFromDetail(facts({ description: "100% Organic Cotton" })).brandModelCode).toBeNull();
    expect(recoverModelCodeFromDetail(facts({ description: null })).brandModelCode).toBeNull();
  });
});

describe("SPRINT-02 Contract D — 승인된 패턴만 인정한다", () => {
  it("느슨한 모양을 품번으로 승격하지 않는다", () => {
    for (const bad of ["226AC009", "AC009", "B226AC09", "B226AC0099", "B22AC009", "BB226AC009", "226-AC-009"]) {
      expect(extractDetailModelCodes(`… ${bad} …`), `🔴 「${bad}」를 품번으로 쓰면 거짓 충돌이 난다`).toEqual([]);
    }
  });

  it("승인된 모양은 대소문자 무관하게 읽고 대문자로 정규화한다", () => {
    expect(extractDetailModelCodes("ref b226ac141 끝")).toEqual(["B226AC141"]);
    expect(extractDetailModelCodes("B126AI018")).toEqual(["B126AI018"]);
  });

  it("단어 경계를 지킨다 — 붙어 있는 문자열에서 뽑지 않는다", () => {
    expect(extractDetailModelCodes("xB226AC009")).toEqual([]);
    expect(extractDetailModelCodes("B226AC009x")).toEqual([]);
  });

  it("전역 regex 의 lastIndex 가 호출 사이에 공유되지 않는다", () => {
    /** 🔴 상수 하나를 재사용하면 두 번째 호출이 조용히 0건을 낸다 — 함수로 만든 이유다. */
    const a = extractDetailModelCodes("B226AC009");
    const b = extractDetailModelCodes("B226AC009");
    expect(a).toEqual(b);
    expect(DETAIL_MODEL_CODE_PATTERN()).not.toBe(DETAIL_MODEL_CODE_PATTERN());
  });
});

describe("SPRINT-02 Contract E·F — 핵심 3건(실측 문자열 그대로)", () => {
  /**
   * 🔴 아래 설명 문자열은 **실제 후보 페이지에서 읽힌 값** 이다
   *    (`core-sprint02-brandname-separability` 전수 출력에서 가져왔다 · 지어낸 것 0).
   */
  it("C05 — 품번 일치 ⟹ SAME 근거 보강(human SAME)", () => {
    const f = facts({
      description:
        "Tinyapple | FW26 Bobo Choses | Hug Hairy Monster T-shirt, Light Blue 100% Organic Cotton Wash Cold-30° B226AC009",
    });
    expect(recoverModelCodeFromDetail(f).brandModelCode).toBe("B226AC009");
  });

  it("S1-6 — 품번 «불일치» 를 복원한다 ⟹ 기존 conflict 보호가 차단한다(human DIFFERENT)", () => {
    const f = facts({
      description:
        "Tinyapple | FW26 Bobo Choses | Booty Ghosts T-shirt 100% Organic Cotton Wash Cold-30° REF: B226AC141",
    });
    const out = recoverModelCodeFromDetail(f);
    expect(out.brandModelCode).toBe("B226AC141");
    /**
     * 🔴🔴 **Contract E** — 이 값이 원상품(`B226AC010`)과 다르면 기존
     *    `compareModelCode` 가 **conflict** 를 낸다. 🔴 그 보호를 **완화하지 않는다** —
     *    이 파일은 충돌을 SAME 으로 바꾸는 코드를 한 줄도 갖지 않는다.
     */
    expect(out.brandModelCode).not.toBe("B226AC010");
  });

  it("C50 — 다른 시즌/라인 품번도 그대로 복원해 충돌을 드러낸다(human DIFFERENT)", () => {
    const f = facts({ description: "… B126AC151 …" });
    expect(recoverModelCodeFromDetail(f).brandModelCode).toBe("B126AC151");
  });

  /** 🔴 **Contract F** — 보강은 **brandModelCode 한 칸만** 바꾼다(SAME 을 깨뜨릴 다른 칸 0). */
  it("brandModelCode 외의 칸을 하나도 바꾸지 않는다", () => {
    const f = facts({ description: "… B226AC009 …" });
    const out = recoverModelCodeFromDetail(f);
    for (const k of Object.keys(f) as (keyof ProductFacts)[]) {
      if (k === "brandModelCode") continue;
      expect(out[k], `🔴 ${k} 가 바뀌면 기존 축이 흔들린다`).toEqual(f[k]);
    }
  });
});

describe("SPRINT-02 — 배선과 금지 범위를 소스에서 잠근다", () => {
  const WIRE = readFileSync(join(__dirname, "../product-url-facts.ts"), "utf8");
  const SRC = WIRE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");

  /**
   * 🔵🔵 **SPRINT-06 에서 이 계약이 «의도적으로» 갱신됐다**(CPO ⒝ GO 2026-10-26).
   *
   * ```
   * BEFORE  「공급 지점은 **하나** 다」 — Shopify 경로에만 있었다
   * AFTER   「공급 지점은 **경로마다 하나** 다」 — Shopify «그리고» PLAIN_HTML
   *         🟢 CPO 요구가 「HTML 에서도 **동일하게** 공급」이다 ⟹ 둘이 맞다
   * 🔴 그래도 **경로당 하나** 는 지킨다 — 같은 경로에서 두 번 부르면 공급원이 갈린다
   * ```
   */
  it("공급 지점이 «경로마다 하나» 다 — Shopify + PLAIN_HTML", () => {
    expect(SRC).toContain("recoverModelCodeFromDetail");
    /** 🔴 **정확히 둘** 이다. 늘면 공급원이 갈리고, 줄면 한 경로가 공급을 잃는다. */
    expect(SRC.match(/recoverModelCodeFromDetail\(/g)?.length, "🔴 경로 둘 · 각 하나여야 한다").toBe(2);
    /** 🟢 보강된 facts 가 **실제로 후보에 실린다** — 배선이 끊기면 FAIL 한다. */
    expect(SRC.match(/facts: suppliedFacts/g)?.length, "🔴 두 경로 모두 실어야 한다").toBe(2);
  });

  it("PLAIN_HTML 공급은 **JSON-LD Product.description 만** 쓴다(meta 0)", () => {
    /** 🟢 공급원이 그 함수 하나다 — 배선이 끊기면 FAIL 한다. */
    expect(SRC, "🔴 JSON-LD 공급 배선이 없다").toContain("description: jsonLdProductDescription(html)");
    /**
     * 🔴🔴 **meta/og 를 쓰지 않는다**(CPO ⒜ HOLD · SPRINT-05 실측 2/5 UNSAFE).
     *    🔴 주석을 벗기고 본다 — 이 파일 주석에는 「meta」가 설명으로 등장한다.
     */
    for (const bad of ['name="description"', "name='description'", "og:description"]) {
      expect(SRC, `🔴 「${bad}」를 description 으로 쓰면 CPO HOLD 를 깬다`).not.toContain(bad);
    }
    /** 🔴 소재 축 입력은 **계속 넘기지 않는다**(거짓 MATERIAL blocker 실측). */
    const call = SRC.slice(SRC.indexOf("productFactsFromListing({"));
    const args = call.slice(0, call.indexOf("});"));
    expect(args, "🔴 material 을 넘기면 소재 축의 의미가 바뀐다").not.toContain("material");
  });

  it("이 Sprint 가 금지한 것이 소스에 없다", () => {
    const own = readFileSync(join(__dirname, "../model-code-from-detail.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/.*$/gm, " ");
    /** 🔴 새 축·threshold·blocker 어휘를 **만들지 않았다**. */
    for (const token of ["SAME_MIN_AXES", "threshold", "NO_TITLE_OVERLAP", "blocker", "conflict", "verdict", "axes"]) {
      expect(own, `🔴 「${token}」이 있으면 이 파일이 판정에 손을 댄 것이다`).not.toContain(token);
    }
    /**
     * 🔵🔵 **SPRINT-03 Contract G — 읽는 칸이 `description` «하나» 다.**
     *
     * 🔴 `materialText` 가 **코드에서 사라져야** 한다(주석은 벗기고 본다). 남아 있으면
     *    소재 축의 칸이 다시 설명문 계약이 되어 CPO §4 금지를 되돌린다.
     */
    expect(own, "🔴 정식 Evidence Layer 칸을 읽어야 한다").toContain("facts.description");
    expect(own, "🔴 materialText 를 읽으면 SPRINT-03 의 우회 제거가 되돌아간다").not.toContain(
      "materialText",
    );
    /** 🔴 alias 폴백(`description ?? materialText`)을 두지 않았다. */
    expect(own, "🔴 ?? 폴백은 alias 사용이다").not.toMatch(/description\s*\?\?/);
    /** 🔴 그 칸에 **쓰지** 않는다 — 읽기 전용이다. */
    expect(own, "🔴 description 에 값을 넣으면 공급자가 둘이 된다").not.toMatch(/description\s*:/);
  });
});

describe("SPRINT-03 Contract B — `description` 과 `materialText` 는 «서로의 alias 가 아니다»", () => {
  /**
   * 🔴🔴 **이것이 이 Sprint 의 핵심 음성 계약이다.** 같은 문자열을 소재 칸에 넣으면
   *    **발화하지 않아야** 한다. 발화하면 우회가 살아 있다는 뜻이다.
   */
  it("같은 설명문을 `materialText` 에 넣으면 품번을 읽지 «않는다»", () => {
    const raw = "Tinyapple | FW26 Bobo Choses | Hug Hairy Monster T-shirt B226AC009";
    /** 🟢 정식 칸에 있으면 읽는다(대조군 — 이 단언이 통과해야 아래가 의미를 갖는다). */
    expect(recoverModelCodeFromDetail(facts({ description: raw })).brandModelCode).toBe("B226AC009");
    /** 🔴 소재 칸에만 있으면 읽지 않는다. */
    expect(
      recoverModelCodeFromDetail(facts({ materialText: raw })).brandModelCode,
      "🔴 읽히면 `materialText` 가 여전히 description 계약으로 쓰이는 것이다",
    ).toBeNull();
  });

  it("소재 축의 입력(`materialText`)을 한 글자도 바꾸지 않는다", () => {
    const f = facts({ materialText: "100% Organic Cotton", description: "… B226AC009 …" });
    const out = recoverModelCodeFromDetail(f);
    expect(out.materialText, "🔴 소재 칸이 바뀌면 compareMaterial 의 의미가 바뀐다").toBe(
      "100% Organic Cotton",
    );
    expect(out.description, "🔴 설명 원문도 보존한다").toBe("… B226AC009 …");
    expect(out.brandModelCode).toBe("B226AC009");
  });

  /**
   * 🟢🟢 **SPRINT-03 이 «실제로 늘린» 공급 범위** — BEFORE 는 구조적으로 못 읽던 모양이다.
   *
   * `seller-facts.ts:200` 의 `material` 은 「소재 조성이 파싱될 때만」 설명문을 담았다 ⟹
   * 🔴 소재 조성이 없는 설명문은 `materialText === null` 이라 **품번이 있어도 못 읽었다**.
   */
  it("소재 조성이 «없는» 설명문에서도 품번을 읽는다(BEFORE 는 불가능했다)", () => {
    const noComposition = "Bobo Choses Hug Hairy Monster T-shirt. Ref B226AC009. Made in Spain.";
    expect(recoverModelCodeFromDetail(facts({ description: noComposition })).brandModelCode).toBe(
      "B226AC009",
    );
  });
});

describe("SPRINT-03 — Shopify 공급을 소스에서 잠근다", () => {
  const SELLER = readFileSync(join(__dirname, "../seller-facts.ts"), "utf8");
  const SRC = SELLER.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");

  it("Shopify facts 가 `description` 을 싣는다", () => {
    /** 🔴 배선이 끊기면 보강기가 읽을 입력이 **구조적으로 없다**. */
    expect(SRC, "🔴 Shopify 경로가 정식 칸을 공급해야 한다").toMatch(/description:\s*description\s*\|\|\s*null/);
  });

  it("`material` 조건을 바꾸지 않았다 — 소재 축 입력 불변", () => {
    /** 🔴 CPO §5 — 이 줄이 바뀌면 `compareMaterial` 의 분모가 바뀐다. */
    expect(SRC).toMatch(/const material =\s*parseMaterialComposition\(description\)\.length > 0 \? description : null/);
  });

  /**
   * 🔵🔵 **SPRINT-06 에서 «의도적으로» 뒤집힌 계약이다**(CPO ⒜ GO 2026-10-26).
   *
   * ```
   * BEFORE  「HTML 경로를 description 으로 **억지로 채우지 않았다**」 — 공급 0 을 단언했다
   *         🟢 그 계약이 이번 변경을 **FAIL 로 잡았다**(가드가 살아 있다는 증거다)
   * AFTER   공급은 **하되 입력을 좁힌다** — `input.description` 을 **그대로** 받고
   *         **지어내지 않는다**(`trim() || null`). 🔴 어디서 오는지는 **호출부가** 정한다
   *         (`product-url-facts.ts` = JSON-LD Product 만 · meta/og **0**).
   * ```
   * 🔴 그래서 단언을 **지우지 않고 방향을 바꿔 강화** 했다 — 「채운다」 + 「**추정하지
   *    않는다**」 + 「**소재 칸은 여전히 null**」 셋을 같이 본다.
   */
  it("HTML 경로는 description 을 «받아서만» 채운다 — 추정 0 · 소재 칸 불변", () => {
    const listing = SRC.slice(SRC.indexOf("export function productFactsFromListing"));
    const body = listing.slice(0, listing.indexOf("\n}"));
    /** 🟢 공급이 **있다** — 끊기면 FAIL 한다. */
    expect(body, "🔴 공급 배선이 없으면 SPRINT-06 이 무의미하다").toContain("description:");
    /** 🔴 **입력을 그대로** 쓴다 — HTML/본문에서 스스로 만들지 않는다. */
    expect(body, "🔴 입력이 없는 것을 추정해 채우면 거짓 증거다").toContain("input.description");
    for (const token of ["html", "body", "innerText", "textContent"]) {
      expect(body, `🔴 「${token}」에서 description 을 만들면 추정이다`).not.toContain(token);
    }
    /** 🔴🔴 **소재 축 입력은 계속 `null`** 이다 — 계약 B(두 칸은 alias 가 아니다). */
    expect(body, "🔴 materialText 가 채워지면 compareMaterial 의 분모가 바뀐다").toContain(
      "materialText: null",
    );
  });
});
