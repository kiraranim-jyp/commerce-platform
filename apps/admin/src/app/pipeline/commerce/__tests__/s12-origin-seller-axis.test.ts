import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { originSellerLabel } from "../CandidateComparison";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-12 — **원본과 후보는 «같은 축» 으로 적는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 대표님이 화면에서 「원본과 동일상품 후보가 뒤집혀 있다」고 하셨다.
 * 1차 조사에서 서버 여섯 곳(origin-product · same-product-sellers · panel ·
 * candidateLabel · global-market · comparison/search)과 MI 카드를 전부 뒤졌고
 * 모두 «무죄» 였다. 렌더 덤프에서도 원본은 정확히 junioredition.com 이었다.
 *
 * 🔴 답은 대표님 화면 한 장에 있었다. 「해외 동일상품 후보」 카드가
 *
 *     왼쪽(원상품)  origin.brand   → "Bobo Choses"   ← 브랜드
 *     오른쪽(후보)  shopName       → "Junior Edition" ← 판매처
 *
 * 를 나란히 놓고 있었다. **값이 틀린 게 아니라 축이 달랐다.** 그래서 서버를
 * 아무리 봐도 원인이 없었다 — 코드는 각자 맞는 값을 넣고 있었다.
 *
 * 🔴 교훈: 「어느 값이 틀렸나」가 아니라 「무엇과 무엇을 나란히 놓았나」를 봐야
 * 하는 결함이 있다. 소스 읽기로는 잡히지 않는다.
 */

const SOURCE = readFileSync(join(__dirname, "..", "CandidateComparison.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("① 원상품 카드가 «판매처» 를 적는다", () => {
  it("주소의 호스트를 그대로 쓴다", () => {
    expect(
      originSellerLabel({ sourceUrl: "https://www.junioredition.com/products/pickles-the-dog" }),
    ).toBe("junioredition.com");
  });

  /* 🔴 이름을 «지어내지 않는다». 첫 라벨만 떼어 대문자로 바꾸면
     「Junioredition」 처럼 실제로 없는 이름이 만들어진다. */
  it("호스트에서 사람 이름을 만들어내지 않는다", () => {
    const label = originSellerLabel({ sourceUrl: "https://junioredition.com/x" });
    expect(label).not.toBe("Junioredition");
    expect(label).toBe("junioredition.com");
  });

  it("주소가 없거나 깨졌으면 아무 말도 하지 않는다", () => {
    expect(originSellerLabel({})).toBeNull();
    expect(originSellerLabel({ sourceUrl: "not a url" })).toBeNull();
  });
});

describe("② 🔴 브랜드를 «판매처 자리» 에 다시 놓지 않는다", () => {
  /* 이 한 줄이 되살아나면 뒤집힘이 그대로 돌아온다. */
  it("origin.brand 를 판매처 줄에 그리지 않는다", () => {
    const code = SOURCE.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(code).not.toContain("{origin.brand && <p");
  });

  it("원상품 줄이 originSellerLabel 을 쓴다", () => {
    expect(SOURCE).toContain("originSellerLabel(origin)");
  });

  /* 후보 쪽은 그대로 판매처다 — 두 축이 «같다» 는 것이 이 수정의 전부다. */
  it("후보 줄은 여전히 판매처(shopName)다", () => {
    expect(SOURCE).toContain("{shopName}");
  });
});
