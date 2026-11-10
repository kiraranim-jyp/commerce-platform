import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-DOMESTIC-COMPETITIVE-SELLABILITY STEP 1 — **국내 재고 3상태 전달**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 고친 것: `market-intelligence.ts` 의 국내 transient 레코드가 `soldOut: null` 을
 * **무조건** 썼다 ⟹ `littleluna`(품절 마커) · `foretforet`(옵션 단위)가 **실제로 생산한**
 * 재고 신호가 집계 입구에서 **버려졌다**. 「국내 재고 정보가 없다」의 원인 중
 * **배선 쪽 절반** 이 이것이었다(수집 쪽 절반은 어댑터 3곳이 신호를 안 준다는 사실).
 *
 * 🔴🔴 이 WU 가 승인받은 범위는 **관측 전달뿐** 이다(CPO §2) — 재고를 판매 판단에
 *    «사용» 하는 것은 별도 승인이고, 아래 계약이 그 경계를 잠근다.
 * 🔴 소스 단언은 **주석을 벗기고** 본다(이 저장소에서 아홉 번 걸린 함정).
 */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const INTEL = strip(
  readFileSync(path.join(__dirname, "..", "market-intelligence.ts"), "utf8"),
);
const CROP = (from: string, to: string) =>
  INTEL.slice(INTEL.indexOf(from), INTEL.indexOf(to, INTEL.indexOf(from)));

describe("A 🔵 3상태를 «그대로» 옮긴다 — 값을 만들지 않는다", () => {
  it("A-1 🔴🔴 국내 transient «판정 입력» 레코드에는 재고를 넣지 않는다", () => {
    /**
     * 🔴🔴 **내 1차 구현이 CPO §2 를 넘었고 회귀가 그것을 잡았다.** 여기에
     *    `e.soldOut ?? null` 을 넣었더니 `wu-061-price-closure:282`(「transient 는 품절
     *    기회 신호를 만들지 못한다」)가 FAIL 했다 — 그 계약이 **이 `null` 을 근거로**
     *    서 있었다.
     * 🔴 이 레코드는 `domesticTransientRecords` → 판정 경로로 가고
     *    `computeSellerAction` 의 `soldOutCount` 는 `DOMESTIC_SHOP` 행만 센다 ⟹
     *    실제 `true` 가 들어오면 **판매 판단이 조용히 바뀐다**(CPO 금지).
     * 🟢 그래서 재고는 **응답/표시 경로로만** 간다(A-3·A-4 가 그 배선을 문다).
     */
    const rec = CROP('source: "DOMESTIC_SHOP"', "checkedAt:");
    expect(rec, "🔴 판정 입력에 재고가 들어갔다 — 별도 승인 사항이다").toContain("soldOut: null");
    expect(rec, "🔴 판정 입력이 생산값을 읽는다").not.toContain("e.soldOut");
  });

  it("A-2 🔴 `?? null` 이 있다 — 값이 없다는 이유로 `false` 를 만들지 않는다", () => {
    /**
     * 🔴 `e.soldOut || false` 나 `Boolean(e.soldOut)` 로 쓰면 **「확인 불가」가
     *    「구매 가능」으로 뒤집힌다** — 그것이 이 축의 최악 오류다.
     */
    expect(INTEL).not.toMatch(/soldOut:\s*Boolean\(/);
    expect(INTEL).not.toMatch(/soldOut:\s*e\.soldOut\s*\|\|/);
    expect(INTEL).not.toMatch(/soldOut:\s*e\.soldOut\s*\?\?\s*false/);
  });

  it("A-3 🟢 집계 입력 계약에 `soldOut` 이 있다(Pick 목록)", () => {
    const pick = CROP("type AggregationEvidence", "> & { basis:");
    expect(pick).toContain('| "soldOut"');
  });

  it("A-4 🔵 POST·GET 이 **같은 계약** 을 쓴다 — 복원기도 3상태를 되돌린다", () => {
    const restore = CROP("function savedCandidateRowsToEvidence", "return out;");
    expect(restore, "🔴 GET 복원분이 재고를 잃는다").toContain("soldOut: r.soldOut");
    /** 🔴 복원에서 기본값을 지어내지 않는다. */
    expect(restore).not.toMatch(/soldOut:\s*(false|true)/);
  });
});

describe("B 🔴🔴 가격 있음 ≠ 재고 있음 (CPO 금지 설계의 음성 계약)", () => {
  it("B-1 🔴 가격으로 재고를 추정하는 식이 **없다**", () => {
    /**
     * 🔴 CPO 가 명시적으로 금지한 설계다 — 「검색 결과에 가격이 있으면 재고 있음」.
     * 🟢 그리고 코드가 이미 그 반례를 적어 뒀다 — `chocoel` 은 가격을 채우면서
     *    `soldOut` 을 `null` 로 둔다(응답 실패 시에도).
     */
    expect(INTEL).not.toMatch(/soldOut:[^\n]*price/i);
    expect(INTEL).not.toMatch(/soldOut:[^\n]*(priceAmount|priceKrw|amount)/);
  });

  it("B-2 🔴 재고 신호로 **가격 자격** 을 바꾸지 않는다", () => {
    /** 🔴 역방향도 막는다 — 재고가 가격 적격성/tier 를 건드리면 안 된다. */
    expect(INTEL).not.toMatch(/priceTier[^\n]*soldOut/);
    expect(INTEL).not.toMatch(/priceStatus[^\n]*soldOut/);
  });
});

describe("C 🔴🔴 관측 전달뿐 — 판매 판단에 «사용» 하지 않는다 (CPO §2 경계)", () => {
  it("C-1 🔴 판정/추천/수익성 어휘와 재고가 **같은 줄에 서지 않는다**", () => {
    for (const owner of [
      "sellerAction",
      "computePriceRecommendation",
      "computeReferenceProfitability",
      "toSellerFacingVerdict",
      "computeSellability",
    ]) {
      expect(INTEL, `🔴 재고가 ${owner} 입력으로 흘러갔다`).not.toMatch(
        new RegExp(`${owner}[^\\n]*soldOut`),
      );
      expect(INTEL, `🔴 ${owner} 가 재고를 읽는다`).not.toMatch(
        new RegExp(`soldOut[^\\n]*${owner}`),
      );
    }
  });

  it("C-2 🟢 `soldOut` 에 **대입하는 자리** 는 승인된 셋뿐이다", () => {
    /**
     * 🔴🔴 **내 1차 단언이 틀렸다** — `/soldOut/g` 전체를 세어 **3** 을 기대했는데 실제 **8**
     *    이었다. 그 칸은 이 파일에 **이 WU 전에도** 여러 번 등장한다(해외 레코드 등).
     *    ⟹ 「전체 등장 수」는 이 계약이 지키려는 것과 **다른 것** 을 센다.
     * 🟢 그래서 **«대입하는 자리»** 만 센다 — 그것이 「누가 이 값을 만들어 넣는가」다.
     *    승인된 셋: ⒜ Pick 계약(대입 아님) ⒝ GET 복원 ⒞ 국내 transient 레코드.
     *    🔴 넷째 대입이 생기면 FAIL 하고 그것이 **「판정에 쓰기 시작했다」는 신호** 다.
     */
    const assigns = INTEL.match(/soldOut:\s*[^\n,]+/g) ?? [];
    /**
     * 🟢 승인된 전달 대입은 **GET 복원 하나** 다(`r.soldOut`).
     * 🔴 판정 입력(transient)에는 넣지 않는다 — A-1 이 그것을 문다.
     */
    expect(
      assigns.filter((a) => a.includes("r.soldOut")).length,
      "🔴 GET 복원 전달 배선이 사라졌다",
    ).toBe(1);
    expect(
      assigns.filter((a) => a.includes("e.soldOut")).length,
      "🔴 판정 입력 쪽으로 재고가 흘러갔다 — 별도 승인 사항이다",
    ).toBe(0);
    /** 🔴 그리고 **상수를 대입하는 자리가 없다** — 값을 지어내지 않는다. */
    expect(
      assigns.filter((a) => /soldOut:\s*(true|false)\b/.test(a)),
      "🔴 재고 값을 상수로 지어냈다",
    ).toHaveLength(0);
  });
});

describe("D 🟢 생산자 의미는 어댑터가 owner 다 — 여기서 재해석하지 않는다", () => {
  const ADAPTER = (name: string) =>
    strip(
      readFileSync(
        path.join(
          __dirname,
          /** 🔴 깊이 **8** 이다(__tests__→_lib→price-history→api→app→src→admin→apps→root). */
          "..","..","..","..","..","..","..","..",
          "packages","crawler","src","comparison-search",`${name}.ts`,
        ),
        "utf8",
      ),
    );

  it("D-1 🟢 `foretforet` 의 «옵션 단위» 해석이 보존된다", () => {
    /**
     * 🔴 「하나라도 구매 가능이면 전체 `soldOut=false`」는 **어댑터의 판단** 이다.
     *    MI 가 그것을 다시 해석하면 owner 가 둘이 된다.
     */
    expect(ADAPTER("foretforet")).toContain("soldOut");
    expect(INTEL, "🔴 MI 가 옵션 단위를 재해석한다").not.toMatch(/option[^\n]*soldOut/i);
  });

  it("D-2 🔴 `chocoel` 은 «항상 null» 이다 — 그 사실을 MI 가 덮지 않는다", () => {
    const c = ADAPTER("chocoel");
    expect(c).toContain("soldOut: null");
    /** 🔴 MI 에 샵 이름별 분기가 **없다**(어댑터별 특례를 만들지 않는다). */
    expect(INTEL).not.toMatch(/chocoel|looxloo|littleluna|deuxbebe|foretforet/i);
  });
});
