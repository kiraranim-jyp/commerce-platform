/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-007A — 🔴🔴 **검색어가 식별 증거로 재활용되는 FP 를 막는다** (CPO GO)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 fixture 는 **실측값** 이다 — WU-007 에서 `bobochoses.com/search/suggest.json`
 *    이 실제로 돌려준 URL·제목 그대로다(날조 0 · 메모 fixtures-must-be-dirty).
 *    그 28건 중 **품번이 상품 handle 에 있는 것은 0건** 이다 → 전부 순수 FP 다.
 *
 * 🔴 threshold 변경 0 · Identity 규칙 완화 0 · 품번 질의 삭제 0 · provider 변경 0 ·
 *    AI/API 0 · schema 0.
 */
import { describe, expect, it } from "vitest";
import {
  confirmBrandCodeInEvidence,
  confirmBrandCodeInTitle,
  stripSearchContextFromUrl,
} from "../domestic-identifiers";

/** 🟢 WU-007 실측 후보 (bobochoses.com Predictive Search · 2026-10-14). */
const FP_FIXTURE: { code: string; url: string; title: string | null }[] = [
  { code: "B226AC010", url: "https://bobochoses.com/products/b324eb008-poma-green-t-shirt?_pos=1&_psq=Bobo+Choses+B226AC010&_psid=445fddf02&_ss=e", title: "Poma green T-shirt" },
  { code: "B226AC010", url: "https://bobochoses.com/products/flower-gift-bag?_pos=2&_psq=Bobo+Choses+B226AC010&_psid=445fddf02&_ss=e", title: "Flower gift bag" },
  { code: "B226AC010", url: "https://bobochoses.com/products/cup-gift-bag?_pos=3&_psq=Bobo+Choses+B226AC010&_psid=445fddf02&_ss=e", title: "Cup gift bag" },
  { code: "B226AC010", url: "https://bobochoses.com/products/dog-gift-bag?_pos=4&_psq=Bobo+Choses+B226AC010&_psid=445fddf02&_ss=e", title: "Dog gift bag" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b400hh012-camel-pierre-veja-trainers?_pos=1&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Camel pierre Veja trainers" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b400hi006-extra-white-nautico-veja-trainers-junior?_pos=2&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Extra-white nautico Veja trainers JUNIOR" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b400hk002-eagle-calcaire-veja-trainers?_pos=3&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Eagle calcaire VEJA trainers" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b400hi001-extra-white-ouro-veja-trainers-kid?_pos=4&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Extra-white ouro Veja trainers KID" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b400hi002-extra-white-emeraude-veja-trainers-kid?_pos=5&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Extra-white emeraude Veja trainers KID" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b226ai052-bobo-choses-ski-boots?_pos=6&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Bobo Choses ski boots" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b226ai057-bobo-choses-ski-boots?_pos=7&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Bobo Choses ski boots" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b226ac152-bobo-choses-down-filled-anorak?_pos=8&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Bobo Choses down filled anorak" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b226ac104-bobo-choses-padded-anorak?_pos=9&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Bobo Choses padded anorak" },
  { code: "01195-VERNICE-NERO", url: "https://bobochoses.com/products/b226ac100-almost-moire-all-over-reversible-anorak?_pos=10&_psq=P%C3%A8p%C3%A8+Shoes+01195-VERNICE-NERO&_psid=4be811c95&_ss=e", title: "Almost Moiré all over reversible anorak" },
  { code: "B226AC035", url: "https://bobochoses.com/products/pony-gift-bag?_pos=1&_psq=Bobo+Choses+B226AC035&_psid=2d5ae1226&_ss=e", title: "Pony gift bag" },
  { code: "B226AC035", url: "https://bobochoses.com/products/flower-gift-bag?_pos=2&_psq=Bobo+Choses+B226AC035&_psid=2d5ae1226&_ss=e", title: "Flower gift bag" },
  { code: "B226AC035", url: "https://bobochoses.com/products/cup-gift-bag?_pos=3&_psq=Bobo+Choses+B226AC035&_psid=2d5ae1226&_ss=e", title: "Cup gift bag" },
  { code: "B226AC035", url: "https://bobochoses.com/products/dog-gift-bag?_pos=4&_psq=Bobo+Choses+B226AC035&_psid=2d5ae1226&_ss=e", title: "Dog gift bag" },
  { code: "B126AC050", url: "https://bobochoses.com/products/b324eb008-poma-green-t-shirt?_pos=1&_psq=Bobo+Choses+B126AC050&_psid=bc7116eff&_ss=e", title: "Poma green T-shirt" },
  { code: "B126AC050", url: "https://bobochoses.com/products/pony-gift-bag?_pos=2&_psq=Bobo+Choses+B126AC050&_psid=bc7116eff&_ss=e", title: "Pony gift bag" },
  { code: "B126AC050", url: "https://bobochoses.com/products/flower-gift-bag?_pos=3&_psq=Bobo+Choses+B126AC050&_psid=bc7116eff&_ss=e", title: "Flower gift bag" },
  { code: "B126AC050", url: "https://bobochoses.com/products/cup-gift-bag?_pos=4&_psq=Bobo+Choses+B126AC050&_psid=bc7116eff&_ss=e", title: "Cup gift bag" },
  { code: "B126AC050", url: "https://bobochoses.com/products/dog-gift-bag?_pos=5&_psq=Bobo+Choses+B126AC050&_psid=bc7116eff&_ss=e", title: "Dog gift bag" },
  { code: "B226AC058", url: "https://bobochoses.com/products/b324eb008-poma-green-t-shirt?_pos=1&_psq=Bobo+Choses+B226AC058&_psid=acd56f06c&_ss=e", title: "Poma green T-shirt" },
  { code: "B226AC058", url: "https://bobochoses.com/products/pony-gift-bag?_pos=2&_psq=Bobo+Choses+B226AC058&_psid=acd56f06c&_ss=e", title: "Pony gift bag" },
  { code: "B226AC058", url: "https://bobochoses.com/products/flower-gift-bag?_pos=3&_psq=Bobo+Choses+B226AC058&_psid=acd56f06c&_ss=e", title: "Flower gift bag" },
  { code: "B226AC058", url: "https://bobochoses.com/products/cup-gift-bag?_pos=4&_psq=Bobo+Choses+B226AC058&_psid=acd56f06c&_ss=e", title: "Cup gift bag" },
  { code: "B226AC058", url: "https://bobochoses.com/products/dog-gift-bag?_pos=5&_psq=Bobo+Choses+B226AC058&_psid=acd56f06c&_ss=e", title: "Dog gift bag" },
];

describe("WU-007A ① 실측 FP fixture — 28건 전부 차단된다", () => {
  it("🔴🔴 fixture 의 품번은 **URL 쿼리에만** 있다 (FP 입력이 진짜임을 먼저 증명)", () => {
    /* 🔴 「고쳤으니 0 이다」만 단언하면 fixture 가 애초에 FP 였는지 알 수 없다.
       그래서 **입력 성질** 을 먼저 못박는다 — 수정 전에는 전건 매칭됐을 입력이다. */
    for (const f of FP_FIXTURE) {
      expect(f.url.toUpperCase()).toContain(f.code.toUpperCase().split(/[^A-Z0-9]+/)[0]);
      /* 🟢 그리고 품번이 **경로에는 없다** — 즉 진짜 양성이 섞여 있지 않다. */
      const path = f.url.split("?")[0];
      expect(confirmBrandCodeInEvidence(f.code, { url: path })).toBeNull();
    }
  });

  it("🟢 수정 후 FP = **0 / 28**", () => {
    const fps = FP_FIXTURE.filter(
      (f) => confirmBrandCodeInEvidence(f.code, { url: f.url, title: f.title }) !== null,
    );
    expect(fps).toEqual([]);
  });
});

describe("WU-007A ② CPO 지정 필수 케이스 셋", () => {
  const CODE = "B226AC010";

  it("Negative — `_psq` 에만 품번이 있고 path/handle 에는 없으면 **FALSE**", () => {
    const url =
      "https://bobochoses.com/products/pony-gift-bag?_pos=1&_psq=Bobo+Choses+B226AC010&_psid=x&_ss=sc";
    expect(confirmBrandCodeInEvidence(CODE, { url, title: "Pony gift bag" })).toBeNull();
  });

  it("Positive — 실제 path/handle 에 품번이 있고 `_psq` 도 있으면 **TRUE**", () => {
    const url =
      "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt?_pos=1&_psq=Bobo+Choses+B226AC010&_ss=e";
    expect(confirmBrandCodeInEvidence(CODE, { url })).toBe(CODE);
  });

  it("Negative — `_psq` 에 **다른 상품의** 품번만 있으면 **FALSE**", () => {
    const url = "https://bobochoses.com/products/pony-gift-bag?_pos=1&_psq=B999ZZ999";
    expect(confirmBrandCodeInEvidence("B999ZZ999", { url })).toBeNull();
    /* 🟢 그리고 그 URL 로 **원래 찾던** 품번도 당연히 FALSE 다. */
    expect(confirmBrandCodeInEvidence(CODE, { url })).toBeNull();
  });
});

describe("WU-007A ③ 과잉 수정 방지 — 식별에 쓰이는 파라미터는 **보존** 한다", () => {
  it("🔴 쿼리 «전체» 를 버리지 않는다 — variant/product_no/branduid 는 남는다", () => {
    expect(stripSearchContextFromUrl("https://a.com/products/x?variant=40096037535807")).toBe(
      "https://a.com/products/x?variant=40096037535807",
    );
    expect(stripSearchContextFromUrl("https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=6")).toBe(
      "https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=6",
    );
    expect(stripSearchContextFromUrl("https://www.foretforet.com/shop/shopdetail.html?branduid=10226592")).toBe(
      "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592",
    );
  });

  it("🟢 식별 파라미터에 적힌 품번은 증거로 **살아 있다**", () => {
    /* 🔴 쿼리를 통째로 버리는 구현이면 이 단언이 깨진다. */
    expect(confirmBrandCodeInEvidence("B226AC010", { url: "https://a.com/p/x?sku=B226AC010" })).toBe("B226AC010");
  });

  it("검색 문맥만 골라 걷어낸다 (혼합 쿼리)", () => {
    expect(
      stripSearchContextFromUrl("https://a.com/p/x?_psq=B226AC010&variant=123&keyword=B226AC010&cate_no=6"),
    ).toBe("https://a.com/p/x?variant=123&cate_no=6");
  });

  it("상대 경로와 fragment 도 처리한다", () => {
    expect(stripSearchContextFromUrl("/products/x?_psq=CODE#frag")).toBe("/products/x");
    expect(stripSearchContextFromUrl("/products/x")).toBe("/products/x");
  });

  it("🟢 `confirmBrandCodeInTitle` 은 **건드리지 않았다** (제목 경로 불변)", () => {
    expect(confirmBrandCodeInTitle("B226AC010", "Booty Ghosts B226AC010 T-shirt")).toBe("B226AC010");
    expect(confirmBrandCodeInTitle("B226AC010", "Pony gift bag")).toBeNull();
  });
});
