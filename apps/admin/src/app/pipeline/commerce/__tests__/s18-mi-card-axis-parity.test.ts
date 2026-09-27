import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { originSellerLabel } from "../CandidateComparison";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-18 — **여섯 축이 «같은 의미끼리» 마주 본다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * S-12 의 교훈을 그대로 쓴다: 값이 맞는지가 아니라 «무엇과 무엇을 나란히
 * 놓았는가» 를 본다. 그때 원상품은 «브랜드», 후보는 «판매처» 를 적고 있었고
 * 값은 둘 다 맞았지만 화면은 뒤집혀 읽혔다.
 *
 *     축       원상품                      동일상품 후보
 *     ──────   ─────────────────────────   ─────────────────────
 *     판매처   origin.sourceUrl 의 호스트   shopName
 *     상품명   origin.title                candidate.title
 *     이미지   origin.imageUrl             candidate.imageUrl
 *     가격     origin.price                CandidatePrice
 *     링크     origin.sourceUrl            candidate.url
 */

const CARD = readFileSync(join(__dirname, "..", "CandidateComparison.tsx"), "utf8").replace(/\r\n/g, "\n");
/** 🔴 주석이 옛 구조를 설명하느라 같은 이름을 인용한다 — 코드만 본다. */
const code = CARD.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("① 판매처 축 — 양쪽 다 «판매처» 다", () => {
  it("원상품은 주소의 호스트를 쓴다", () => {
    expect(originSellerLabel({ sourceUrl: "https://junioredition.com/p/x" })).toBe("junioredition.com");
  });

  /* 🔴 브랜드가 판매처 자리에 돌아오면 S-12 가 그대로 재현된다. */
  it("원상품 자리에 브랜드를 그리지 않는다", () => {
    expect(code).not.toContain("{origin.brand && <p");
  });

  it("후보는 shopName(판매처)을 쓴다", () => {
    expect(code).toContain("{shopName}");
  });
});

describe("② 나머지 축도 «짝» 이 맞는다", () => {
  it.each([
    ["상품명", "origin.title", "candidate.title"],
    ["이미지", "origin.imageUrl", "candidate.imageUrl"],
  ])("%s — 양쪽이 같은 종류의 값을 쓴다", (_axis, left, right) => {
    expect(code).toContain(left);
    expect(code).toContain(right);
  });

  it("가격 — 원상품은 origin.price, 후보는 CandidatePrice 가 그린다", () => {
    expect(code).toContain("origin.price");
    expect(code).toContain("CandidatePrice");
  });

  it("링크 — 후보 줄이 candidate.url 을 키로 쓴다(같은 상품을 가리킨다)", () => {
    expect(code).toContain("candidate.url");
  });
});

describe("③ 🔴 원상품은 후보를 «입력으로도» 받지 않는다", () => {
  /* origin-product.ts 가 지키는 규칙을 이 카드에서도 지킨다 — 후보 데이터가
     원상품 쪽 표시에 끼어들 문이 없어야 한다. */
  it("OriginProduct 타입에 후보/경쟁 필드가 없다", () => {
    const at = CARD.indexOf("export interface OriginProduct");
    const block = CARD.slice(at, CARD.indexOf("\n}", at));
    expect(block).not.toMatch(/candidate|competitor|shopName/i);
  });
});
