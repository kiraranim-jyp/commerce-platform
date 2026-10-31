import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 PRICE-POLICY-CONDITIONAL-AUDIT-01 — **TEXT_CONFIRMED 7건은 6:1 로 안 갈린다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 모집단 **7**(샵 대표 · 새 Search 0 · Crawl 0 · 운영 코드 0). 실측 전수:
 * ```
 * seller              human       code         blk                              근거수
 * biskuit.kr          SAME        B226AC009    BRAND_MISMATCH,NO_TITLE_OVERLAP     2
 * cissywears.com      SAME        null         AUDIENCE_LINE                       3
 * kids21.com          SAME        null         AUDIENCE_LINE                       4
 * 🔴 m.luxboy.com     DIFFERENT   B226AC009    NO_TITLE_OVERLAP                    3
 * kolkid.ca           SAME        null         AUDIENCE_LINE                       6
 * rboutique.com       SAME        null         (없음)                              3
 * billsstore.com.au   SAME        null         AUDIENCE_LINE                       4
 * ```
 *
 * 🔴🔴🔴 **누출 1건과 가장 가까운 정답을 기존 Evidence 로 가를 수 없다**:
 * ```
 *                 biskuit.kr(SAME)        m.luxboy.com(DIFFERENT)
 * code            B226AC009               B226AC009        ← **완전히 같다**
 * color           null                    null
 * material        null                    null
 * fit             null                    null
 * images          1                       1
 * market          KR                      KR
 * blocker 수      2                        1               ← 🔴 **역방향**(정답이 더 많다)
 * 근거 수          2                        3               ← 🔴 **역방향**(누출이 더 많다)
 * ```
 * 🔴 실제로 가른 것은 제목의 **「긴팔」**(long sleeve) 하나다 — 원상품은 반팔이다.
 *    그 축(소매 길이)은 **새 축** 이고 WU-123/125 가 「N=2 · 일반화 금지」로 닫았다.
 *    `GARMENT_FORM` 은 둘을 **둘 다 SHIRT** 로 읽어 발화하지 않는다(그 주석 원문).
 *
 * 🟡 **그래도 부분 분리는 있다** — 「`NO_TITLE_OVERLAP` 없음」:
 * ```
 * SAME 유지 5/6 · SAME 손실 1 · DIFFERENT 누출 **0**
 * 🔴 그런데 잃는 1건이 `biskuit.kr` ₩88,000 — **국내 유일한 정답 가격** 이다.
 *    국내 TEXT_CONFIRMED 는 그 둘(biskuit · luxboy)뿐이라 ⟹ **국내 가격 축이 빈다**.
 * ```
 *
 * 🔴 **정책을 구현하지 않았다**(CPO STOP) — `if (matchTruth === …)`·`if (blocker === …)` **0**.
 */

const LIB = join(__dirname, "..");
const HARNESS = readFileSync(join(__dirname, "dif-02-identity-funnel.test.ts"), "utf8").replace(/\r\n/g, "\n");
/** 🔴 주석을 벗긴다 — 메모 `source-scan-must-strip-comments`. */
const CODE = HARNESS.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
const RUNNER = readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8").replace(/\r\n/g, "\n");

describe("PP-01 C1~C5 — 모집단과 값의 출처", () => {
  /** 🔴 PP-C1 — 모집단 술어가 `matchTruth === "TEXT_CONFIRMED"` 다(샵 대표 분모). */
  it("PP-C1 🔴 TEXT_CONFIRMED 모집단을 **그 술어로** 뽑는다", () => {
    expect(CODE).toContain('rows.filter((r) => r.matchTruth === "TEXT_CONFIRMED")');
    /** 🔴 7 이라는 숫자를 코드에 박지 않는다 — 데이터가 바뀌면 숫자도 바뀐다. */
    expect(CODE, "🔴 모집단 크기를 하드코딩했다").not.toContain("TEXT_CONFIRMED\").length === 7");
  });

  /** 🔴 PP-C2 — Human GT 가 행마다 보존된다(집계로 뭉개지 않는다). */
  it("PP-C2 🔴 7건의 Human GT 가 **행 단위로** 출력된다", () => {
    const at = CODE.indexOf("【PP-01 A】");
    expect(at, "전수표 블록이 사라졌다").toBeGreaterThan(-1);
    /**
     * 🔴🔴 **변이 N1 이 이 단언을 뚫었다** — 1600자 슬라이스에 아래 D 표가 섞여 있어
     *    `r.human` 이 거기서 발견돼 통과했다(전수표 행에서는 지워졌는데도).
     * 🟢 그래서 **A 블록만** 자른다(D 표 앞에서 끊는다).
     */
    const end = CODE.indexOf("【PP-01 D】", at);
    expect(end, "D 표 경계가 사라졌다").toBeGreaterThan(at);
    const block = CODE.slice(at, end);
    for (const w of ["r.human", "r.verdict", "r.tier", "r.priceEligible", "r.blockers", "r.reasons"])
      expect(block, `🔴 전수표 행에서 ${w} 가 사라졌다`).toContain(w);
    /** 🔴 그리고 **라벨 글자** 까지 단언한다 — 값만 찍고 이름을 지우면 읽을 수 없다. */
    expect(block, "🔴 human 라벨이 사라졌다").toContain("human=");
  });

  /** 🔴 PP-C3/C4 — `matchTruth`·`priceTier` 는 운영 반환값 그대로다(재계산 0). */
  it("PP-C3/C4 🔴 운영 owner 의 값을 그대로 쓴다", () => {
    expect(RUNNER).toContain("matchTruth: evidenceDecision.truth");
    expect(RUNNER).toContain("priceTier: priceTierFromLink({ matchTruth: evidenceDecision.truth, verified })");
    expect(CODE).toContain('matchTruth: j.kind === "JUDGED" && isBest ? j.matchTruth : null');
    expect(CODE).toContain('tier: j.kind === "JUDGED" && isBest ? j.priceTier : null');
    expect(CODE, "🔴 하니스가 tier 를 재계산한다").not.toContain("priceTierFromLink(");
  });

  /** 🔴 PP-C5 — `priceEligible` 은 `tier` 두 값에서만 나온다. */
  it("PP-C5 🔴 자격 술어가 `tier` 두 값뿐이다", () => {
    expect(CODE).toContain('j.priceTier === "EXACT" || j.priceTier === "COMPARISON"');
    expect(priceTierFromLink({ matchTruth: "TEXT_CONFIRMED", verified: false })).toBe("COMPARISON");
  });
});

describe("PP-01 C6~C8 — 범위와 금지", () => {
  /**
   * 🔴 PP-C6 — **Evidence 를 새로 크롤링하지 않았다.** 후보가 이미 들고 있는
   *    `candidate.facts` 를 그대로 적는다.
   */
  it("PP-C6 🔴 Evidence 는 후보의 `facts` 를 그대로 읽는다(추가 fetch 0)", () => {
    for (const f of ["c.facts?.brand", "c.facts?.brandModelCode", "c.facts?.colorText", "c.facts?.coreTitleTokens"])
      expect(CODE, f).toContain(f);
    /** 🔴 전수표 블록이 새 네트워크를 쓰지 않는다. */
    const at = CODE.indexOf("【PP-01 A】");
    const block = CODE.slice(at, at + 1600);
    for (const w of ["fetch", "factsFromProductUrl", "shopifySiteStrategy", "collectUrlCandidatePool"])
      expect(block, `전수표가 ${w} 를 부른다`).not.toContain(w);
  });

  /**
   * 🔴🔴 PP-C7/C8 — **운영/정책 코드를 바꾸지 않았다.** 가격 자격 owner 에
   *    `matchTruth`/blocker 이름 분기가 **없다**.
   */
  it("PP-C7/C8 🔴 가격 자격 owner 에 조건부 분기가 **없다**", () => {
    const src = readFileSync(
      join(LIB, "../../domestic-price-sources/_lib/domestic-product-link.ts"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const at = src.indexOf("export function priceTierFromLink");
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf("\n}", at)).replace(/\/\*[\s\S]*?\*\//g, " ");
    expect(body, "🔴 가격 자격이 blocker 를 본다").not.toContain("blocker");
    for (const w of ["NO_TITLE_OVERLAP", "AUDIENCE_LINE", "BRAND_MISMATCH", "MODEL_CODE_AGE_LINE"])
      expect(body, `🔴 ${w} 전용 분기가 생겼다`).not.toContain(w);
  });

  /**
   * 🔴🔴🔴 **이 WU 의 결론을 계약으로 못박는다** — 소매 길이 축을 **만들지 않았다**.
   *    그것이 biskuit ↔ luxboy 를 가르는 유일한 차이였고, WU-123/125 가 닫은 자리다.
   * 🟢 `GARMENT_FORM` 은 둘을 같은 형태로 읽는다 — 그 성질을 바꾸지 않았다.
   */
  it("PP-C8-b 🔴 **소매 길이 축을 만들지 않았다**", () => {
    const cross = readFileSync(
      join(LIB, "../../../../../../../packages/crawler/src/comparison-search/cross-seller.ts"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const code = cross.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
    for (const w of ["SLEEVE", "sleeveLength", "longSleeve", "long_sleeve", "긴팔"])
      expect(code, `🔴 소매 길이 축이 생겼다: ${w}`).not.toContain(w);
  });
});
