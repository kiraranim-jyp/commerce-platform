import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-13/14 — **찾지 못한 가격을 만들어내지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 지시(S-13): 국내 가격을 못 찾은 것을 «무조건 오류로 간주하지 않는다».
 * 먼저 갈라야 한다 — 검색을 했는가 · 조건이 적절했는가 · 결과가 있었는가 ·
 * 동일상품 판별에서 탈락한 것인가 · 국내 판매 자체가 없는가.
 *
 * 🔴 조사 결과 **이미 그렇게 돼 있다.** `summarizeRecheckResult` 가 네 갈래로
 * 나눈다. 그래서 «고치지 않았다» — 없는 결함을 만들지 않는다. 대신 이 구분이
 * 나중에 한 문장으로 뭉개지지 않도록 계약으로 고정한다.
 *
 *     🔴 오류      검색 자체가 실패했다(status 가 SUCCESS/NO_RESULT 가 아님)
 *     🟢 확인됨    국내 편집샵 가격을 실제로 저장했다
 *     🟡 탈락      후보는 찾았지만 «검증된 가격» 이 없다 — 판별에서 걸렀다
 *     ⚪ 없음      일치하는 국내 판매처를 찾지 못했다
 */

const PANEL = readFileSync(join(__dirname, "..", "DomesticPriceIntelligencePanel.tsx"), "utf8").replace(/\r\n/g, "\n");
const ORIGIN = readFileSync(join(__dirname, "..", "origin-product.ts"), "utf8").replace(/\r\n/g, "\n");

describe("① S-13 — 국내 가격 «못 찾음» 이 네 갈래로 갈린다", () => {
  it.each([
    ["오류", "원가 확인 중 오류가 발생했습니다"],
    ["확인됨", "국내 편집샵"],
    ["탈락", "비슷한 상품 후보는 찾았지만, 아직 검증된 가격은 없습니다"],
    ["없음", "일치하는 국내 편집샵 판매처는 아직 찾지 못했습니다"],
  ])("%s 상태의 문장이 있다", (_label, phrase) => {
    expect(PANEL).toContain(phrase);
  });

  /* 🔴 네 갈래가 하나로 뭉개지면 셀러는 「오류」와 「국내에 없음」을 구분할 수
     없다. 전자는 다시 시도할 일이고 후자는 기회일 수 있다 — 반대 행동이다. */
  it("「탈락」과 「없음」이 같은 문장이 아니다", () => {
    const rejected = "비슷한 상품 후보는 찾았지만, 아직 검증된 가격은 없습니다";
    const absent = "일치하는 국내 편집샵 판매처는 아직 찾지 못했습니다";
    expect(rejected).not.toBe(absent);
    expect(PANEL.indexOf(rejected)).toBeGreaterThan(-1);
    expect(PANEL.indexOf(absent)).toBeGreaterThan(-1);
  });
});

describe("② 🔴 없는 가격을 «지어내지» 않는다", () => {
  /* 못 찾았을 때 0 이나 평균가로 대신 채우는 길이 열리면 셀러는 존재하지 않는
     경쟁가를 보고 판단한다. 값이 아니라 «문장» 으로 말해야 한다. */
  it("미탐색을 숫자 0 으로 바꾸지 않는다", () => {
    expect(PANEL).not.toMatch(/lowestPriceKrw\s*[:=]\s*0\b/);
    expect(PANEL).not.toMatch(/averagePriceKrw\s*[:=]\s*0\b/);
  });
});

describe("③ S-14 — 원본 가격과 비교상품 가격을 «섞지» 않는다", () => {
  /* origin-product.ts 는 후보 목록을 «입력으로도» 받지 않는다. S-12 조사에서
     확인한 이 구조가 S-14 의 요구(둘을 혼동하지 않는다)를 이미 만족한다. */
  it("원본 링크가 후보 목록을 입력으로 받지 않는다", () => {
    const signature = ORIGIN.slice(ORIGIN.indexOf("export function buildOriginProductLink"));
    const params = signature.slice(0, signature.indexOf(")"));
    expect(params).toContain("title");
    expect(params).toContain("sourceUrl");
    /* 후보/경쟁 데이터가 인자에 있으면 그 순간 「원본」이 «우리가 고른 것» 이 된다. */
    expect(params).not.toMatch(/candidate|listing|competitor|seller/i);
  });

  it("🔴 원본은 판매자가 등록한 주소 «그대로» 라고 적혀 있다", () => {
    expect(ORIGIN).toContain("판매자가 등록한 그 URL 그대로");
  });
});
