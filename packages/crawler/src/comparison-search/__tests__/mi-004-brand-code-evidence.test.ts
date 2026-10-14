/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-004 Track A — `confirmBrandCodeInEvidence` 계약
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 WU 의 최우선 KPI 는 **False Positive 0** 이다. 그래서 이 파일은
 *    「찾는다」보다 **「찾지 «않는다»」** 를 더 많이 단언한다.
 *
 * 🔴 CPO 가 글자로 고정한 구분을 그대로 잠근다:
 * ```
 * B226AC117                      → 브랜드 품번 가능성 높음  → 🟢 근거로 쓴다
 * AAA1804532                     → Smallable 내부 코드      → 🔴 SAME 근거 아님
 * cafe24_...P0000GCJ000A         → Cafe24 내부 코드         → 🔴 SAME 근거 아님
 * SKU 만 일치                     → 🔴 제외
 * ```
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { confirmBrandCodeInEvidence, confirmBrandCodeInTitle } from "../domestic-identifiers";

/* ═══════════ ① 실측에서 나온 그 사례들 — 🟢 찾아야 한다 ═══════════ */

describe("① 🟢 원본 품번이 후보 «URL» 에 있으면 찾는다 (벤치마크 실측 3건)", () => {
  it("bobochoses 공식몰 — `/products/b226ac010-booty-ghosts-t-shirt`", () => {
    expect(
      confirmBrandCodeInEvidence("B226AC010", {
        title: "Booty Ghosts T-shirt",
        url: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
      }),
    ).toBe("B226AC010");
  });

  it("🟢🟢 global.trenbe.com — 등록부 «밖» 리세일 플랫폼(WU-023B 에서 SAME 0.53)", () => {
    expect(
      confirmBrandCodeInEvidence("B226AC010", {
        title: "보보쇼즈 키즈 트윈 고스트 긴팔 티셔츠",
        url: "https://global.trenbe.com/products/bobo-choses-kids-twin-ghost-long-sleeve-t-shirt-gray-b226ac010-041-160484656-p",
      }),
    ).toBe("B226AC010");
  });

  it("쿼리스트링에 품번이 있어도 찾는다(운영 링크 실측)", () => {
    expect(
      confirmBrandCodeInEvidence("B226AC010", {
        url: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt?_pos=1&_psq=B226AC010",
      }),
    ).toBe("B226AC010");
  });

  it("🔴 **title 에만** 있어도 기존처럼 찾는다 — 기존 동작을 잃지 않았다", () => {
    expect(
      confirmBrandCodeInEvidence("AW26MS185", { title: "[메인스토리]  AW26MS185 - Bubble Sweatshirt - Grey Melange" }),
    ).toBe("AW26MS185");
  });

  it("sku 칸에 원본 품번이 적혀 있으면 찾는다", () => {
    expect(confirmBrandCodeInEvidence("B226AC117", { title: "Tracksuit jacket", sku: "B226AC117" })).toBe("B226AC117");
  });
});

/* ═══════════ ② 🔴🔴 FP 방지 — 찾아서는 «안 되는» 것들 ═══════════ */

describe("② 🔴🔴 판매처 자체코드를 품번 근거로 쓰지 않는다 (CPO 고정)", () => {
  it("🔴 Smallable 내부 코드 `AAA1804532` 는 품번이 아니다", () => {
    /** 원본 품번이 B226AC010 인데 후보 sku 가 AAA… 면 **찾히지 않아야** 한다. */
    expect(confirmBrandCodeInEvidence("B226AC010", { sku: "AAA1804532", title: "T-shirt" })).toBeNull();
  });

  it("🔴 Cafe24 내부 코드도 품번이 아니다", () => {
    expect(
      confirmBrandCodeInEvidence("B226AC010", { sku: "cafe24_littlelunakr_1_4117_P0000GCJ000A" }),
    ).toBeNull();
  });

  it("🔴🔴 **부분일치를 인정하지 않는다** — 품번이 더 긴 코드의 일부면 찾지 않는다", () => {
    /** 🔴 Mini Rodini `2672014894` 가 숫자 10자리라 포함 검사로는 가격·상품번호에 걸린다.
     *     그 위험을 토큰 전체 일치로 막는다 — 이 단언이 그 계약이다. */
    expect(confirmBrandCodeInEvidence("B226AC010", { url: "https://x.com/products/b226ac0100-other" })).toBeNull();
    expect(confirmBrandCodeInEvidence("2672014894", { title: "가격 12672014894 원" })).toBeNull();
    expect(confirmBrandCodeInEvidence("01195", { url: "https://x.com/p/9011954" })).toBeNull();
  });

  it("🔴 **다른 상품의 품번** 이 적혀 있으면 찾지 않는다", () => {
    expect(
      confirmBrandCodeInEvidence("B226AC010", {
        title: "Bobo Choses B226AC035 Jogging Pants",
        url: "https://x.com/products/b226ac058-sweatshirt",
      }),
    ).toBeNull();
  });

  it("🔴 품번이 없으면 `null` 이다 — 지어내지 않는다", () => {
    expect(confirmBrandCodeInEvidence(null, { title: "x", url: "y", sku: "z" })).toBeNull();
    expect(confirmBrandCodeInEvidence("", { title: "x" })).toBeNull();
    expect(confirmBrandCodeInEvidence("B226AC010", {})).toBeNull();
    expect(confirmBrandCodeInEvidence("B226AC010", { title: null, url: null, sku: null })).toBeNull();
  });
});

/* ═══════════ ③ 안전 성질 ①②③ 보존 ═══════════ */

describe("③ 🔴 반환 값 공간이 `code | null` 둘뿐이다 (구조적 FP 상한)", () => {
  it("찾으면 **원본 품번 문자열 그대로** 돌려준다 — 후보 쪽 문자열을 돌려주지 않는다", () => {
    /** 🔴 후보 URL 은 소문자였는데 반환은 **원본 대문자** 여야 한다.
     *     그래야 compareModelCode 가 `exact` 아니면 `unavailable` 밖에 못 낸다. */
    const r = confirmBrandCodeInEvidence("B226AC010", { url: "https://x.com/p/b226ac010-tee" });
    expect(r).toBe("B226AC010");
  });

  it("🟢 기존 함수와 **같은 규칙** 이다 — 규칙을 복제하지 않았다", () => {
    const code = "AW26MS185";
    const title = "[메인스토리] AW26MS185 - Bubble";
    expect(confirmBrandCodeInEvidence(code, { title })).toBe(confirmBrandCodeInTitle(code, title));
    const noHit = "완전히 다른 제목";
    expect(confirmBrandCodeInEvidence(code, { title: noHit })).toBe(confirmBrandCodeInTitle(code, noHit));
  });

  it("🔴 `description` 을 받지 않는다 — FP 벡터라 일부러 제외했다", () => {
    /** 🔴 타입에 `description` 칸이 **없다**. 넣으려면 벤치마크를 먼저 해야 한다. */
    const fields = { title: null, url: null, sku: null } satisfies Parameters<typeof confirmBrandCodeInEvidence>[1];
    expect(Object.keys(fields).sort()).toEqual(["sku", "title", "url"]);
  });
});

/* ═══════════ ④ 🔴🔴 하이픈 품번 — 구조적 FN 을 고쳤다 ═══════════ */

describe("④ 🔴🔴 구분자가 든 품번도 찾는다 (실측 FN 2/6 건)", () => {
  it("Pèpè `01195-VERNICE-NERO` — URL 에 그대로 있는데 전에는 null 이었다", () => {
    expect(
      confirmBrandCodeInEvidence("01195-VERNICE-NERO", { url: "https://x.com/p/01195-vernice-nero-shoes" }),
    ).toBe("01195-VERNICE-NERO");
  });

  it("Misha & Puff `B1408F26-670`", () => {
    expect(confirmBrandCodeInEvidence("B1408F26-670", { url: "https://x.com/p/b1408f26-670-cardigan" })).toBe(
      "B1408F26-670",
    );
  });

  it("🔴 그런데 **수열이 연속** 이어야 한다 — 토큰이 떨어져 있으면 찾지 않는다", () => {
    expect(confirmBrandCodeInEvidence("B1408F26-670", { title: "B1408F26 사이즈 670" })).toBeNull();
    expect(confirmBrandCodeInEvidence("01195-VERNICE-NERO", { title: "01195 VERNICE BLU NERO" })).toBeNull();
  });

  it("🔴 수열이어도 **각 토큰은 전체 일치** 다 — 부분일치는 여전히 금지", () => {
    expect(confirmBrandCodeInEvidence("B1408F26-670", { url: "https://x.com/p/b1408f26-6700-x" })).toBeNull();
    expect(confirmBrandCodeInEvidence("01195-VERNICE-NERO", { url: "https://x.com/p/011950-vernice-nero" })).toBeNull();
  });
});

/* ═══════════ ⑤ 🔴 호출부가 실제로 URL 을 넘기는가 (M5 가드 공백) ═══════════ */

describe("⑤ 🔴🔴 운영 호출부가 **url 을 넘긴다** — 넘기지 않으면 효과가 0 이다", () => {
  const strip = (p: string) =>
    readFileSync(path.join(__dirname, p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  const MATCH = strip("../match.ts");

  it("match.ts 가 confirmBrandCodeInEvidence 에 `url: c.url` 을 넘긴다", () => {
    const at = MATCH.indexOf("confirmBrandCodeInEvidence(");
    expect(at).toBeGreaterThan(0);
    const block = MATCH.slice(at, MATCH.indexOf("})", at) + 2);
    expect(block).toContain("title: c.title");
    expect(block).toContain("url: c.url");
    expect(block).toContain("sku:");
    /* 🔴 null 로 막아 두면 FAIL 해야 한다(M5 가 그렇게 뚫렸다). */
    expect(block).not.toContain("url: null");
  });

  it("🔴 기존 title-only 함수를 그 자리에서 다시 쓰지 않는다", () => {
    expect(MATCH).not.toContain("confirmBrandCodeInTitle(query.facts.brandModelCode");
  });
});

/* ═══════════ ⑥ 🔴🔴 반환은 «원본 품번» 이다 (M4 가드 공백) ═══════════ */

describe("⑥ 🔴🔴 후보 페이지의 표기 형태를 돌려주지 않는다", () => {
  /**
   * 🔴 처음 단언은 구분자가 **양쪽 다 하이픈** 인 사례만 썼다 → 매치 문자열과 원본이
   *    글자까지 같아서 「후보 쪽 문자열을 돌려주는」 변형(M4)을 **잡지 못했다**.
   * 🟢 그래서 구분자가 **다른** 형태를 쓴다 — 그래야 둘이 갈라진다.
   */
  it("구분자 없이 붙어 있어도 **원본 하이픈 형태** 를 돌려준다", () => {
    expect(confirmBrandCodeInEvidence("B1408F26-670", { url: "https://x.com/p/b1408f26670-cardigan" })).toBe(
      "B1408F26-670",
    );
  });

  it("구분자가 `_` 여도 원본 형태를 돌려준다", () => {
    expect(confirmBrandCodeInEvidence("B1408F26-670", { sku: "b1408f26_670" })).toBe("B1408F26-670");
  });

  it("🔴 그래야 compareModelCode 가 `exact|unavailable` 만 낸다 — 값 공간 계약", () => {
    const r = confirmBrandCodeInEvidence("01195-VERNICE-NERO", { url: "https://x.com/p/01195.vernice.nero" });
    expect(r).toBe("01195-VERNICE-NERO");
    expect(r).not.toBe("01195.VERNICE.NERO");
  });
});
