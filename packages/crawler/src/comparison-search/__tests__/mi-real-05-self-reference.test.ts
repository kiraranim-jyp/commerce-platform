import { describe, expect, it } from "vitest";
import { canonicalListingKey, isSelfReferenceCandidate } from "../self-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-REAL-05(CEO 지시, 2026-09-20) — 자기참조 후보 차단.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 아래 URL 은 «지어낸 것이 아니라» MI-REAL-04 #5 에서 Production DB 와 실제
 *    HTTP 응답으로 확인한 값 그대로다. 두 응답의 본문 텍스트 SHA-256 이
 *    `4f10497a1b6c7d70c7666bb5f0b3baed` 로 완전히 같았다(9,324자).
 */
const FORETFORET_ORIGIN =
  "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273&search=%EC%8B%A0%EB%B0%9C&sort=&xcode=040&mcode=000&scode=&GfDT=Z2p3Vw%3D%3D";
const FORETFORET_CANDIDATE = "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273";

/** 같은 브랜드 도메인이지만 **다른 상품**이다 — 절대 제외되면 안 된다.
 *  MI-REAL-04 #1 에서 실물 검증한 그 쌍(AC043 ↔ AC042). */
const BOBO_ORIGIN = "https://bobochoses.com/en-kr/products/b226ac043-mystery-bc-half-zipped-sweatshirt";
const BOBO_CANDIDATE =
  "https://bobochoses.com/products/b226ac042-mystery-bc-half-zipped-sweatshirt?_pos=1&_psq=AW26+mystery+bc+half+zipped";

describe("A. 동일 host + 동일 listing → 제외", () => {
  it("🔴 FORETFORET branduid=10278273 자기참조를 잡는다", () => {
    expect(isSelfReferenceCandidate(FORETFORET_ORIGIN, FORETFORET_CANDIDATE)).toBe(true);
  });

  it("방향을 바꿔도 같은 답이다", () => {
    expect(isSelfReferenceCandidate(FORETFORET_CANDIDATE, FORETFORET_ORIGIN)).toBe(true);
  });
});

describe("B. 동일 host + 다른 listing → 유지", () => {
  it("🔴 Bobo B226AC043 ↔ B226AC042 는 정상 후보로 남는다", () => {
    expect(isSelfReferenceCandidate(BOBO_ORIGIN, BOBO_CANDIDATE)).toBe(false);
  });

  it("같은 상품이라도 branduid 가 다르면 다른 listing 이다", () => {
    expect(
      isSelfReferenceCandidate(
        FORETFORET_ORIGIN,
        "https://www.foretforet.com/shop/shopdetail.html?branduid=10277972",
      ),
    ).toBe(false);
  });

  it("🔴 host 가 같다는 이유만으로 제외하지 않는다 — 그게 이 작업의 핵심 제약이다", () => {
    expect(canonicalListingKey(BOBO_ORIGIN)!.host).toBe(canonicalListingKey(BOBO_CANDIDATE)!.host);
    expect(isSelfReferenceCandidate(BOBO_ORIGIN, BOBO_CANDIDATE)).toBe(false);
  });
});

describe("C. 다른 host + 동일 상품 → 유지", () => {
  it("판매처가 다르면 자기참조가 아니다(그게 비교의 목적이다)", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.smallable.com/en/product/bobo-choses-organic-cotton-ample-joggers-lavender-bobo-choses-430663",
        "https://bobochoses.com/products/b226ac060-bobo-choses-straight-jogging-pants",
      ),
    ).toBe(false);
  });

  it("경로가 완전히 같아도 host 가 다르면 유지한다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://shop-a.example/shop/shopdetail.html?branduid=1",
        "https://shop-b.example/shop/shopdetail.html?branduid=1",
      ),
    ).toBe(false);
  });
});

describe("D. query parameter 만 다른 동일 URL → 제외", () => {
  it("검색·정렬·카테고리 파라미터는 listing 을 가리지 못한다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273&search=%EC%8B%A0%EB%B0%9C&sort=&xcode=040",
        "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273",
      ),
    ).toBe(true);
  });

  it("🔴 GfDT 는 요청마다 새로 발급되는 추적 토큰이다 — 같은 페이지를 두 번 받아도 다르다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.foretforet.com/shop/shopdetail.html?branduid=1&GfDT=bm16Ww%3D%3D",
        "https://www.foretforet.com/shop/shopdetail.html?branduid=1&GfDT=aG53",
      ),
    ).toBe(true);
  });

  it("Shopify 의 밑줄 파라미터(_pos/_psq)도 문맥일 뿐이다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://bobochoses.com/products/b226ac042-x",
        "https://bobochoses.com/products/b226ac042-x?_pos=1&_psq=AW26",
      ),
    ).toBe(true);
  });

  it("파라미터 순서가 달라도 같은 listing 이다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://shop.example/p?b=2&a=1",
        "https://shop.example/p?a=1&b=2",
      ),
    ).toBe(true);
  });
});

describe("E. canonical URL 이 동일한 경우 → 제외", () => {
  it("www 유무 · 끝 슬래시 · 대소문자 · fragment 는 같은 listing 이다", () => {
    expect(
      isSelfReferenceCandidate("https://www.Shop.example/Products/ABC/#gallery", "https://shop.example/products/abc"),
    ).toBe(true);
  });

  it("정규형 키가 실제로 같은지 직접 확인한다", () => {
    expect(canonicalListingKey("https://www.foretforet.com/shop/shopdetail.html?branduid=10278273&sort=")).toEqual(
      canonicalListingKey("https://foretforet.com/shop/ShopDetail.html?branduid=10278273"),
    );
  });
});

describe("F. 식별자가 없으면 기존 동작 유지 — 추측해서 제외하지 않는다", () => {
  it.each([
    ["원본 URL 없음", undefined, FORETFORET_CANDIDATE],
    ["원본 URL 빈 문자열", "", FORETFORET_CANDIDATE],
    ["원본이 URL 이 아님", "not a url", FORETFORET_CANDIDATE],
    ["후보가 URL 이 아님", FORETFORET_ORIGIN, "/shop/shopdetail.html?branduid=10278273"],
    ["http/https 가 아님", "javascript:void(0)", "javascript:void(0)"],
  ])("%s → 제외하지 않는다", (_label, origin, candidate) => {
    expect(isSelfReferenceCandidate(origin as string | undefined, candidate)).toBe(false);
  });

  it("canonicalListingKey 는 만들 수 없으면 null 을 준다", () => {
    expect(canonicalListingKey(null)).toBeNull();
    expect(canonicalListingKey("not a url")).toBeNull();
  });
});

describe("🔴 무회귀 — 제외는 «같은 listing» 에서만 일어난다", () => {
  it("값이 있는 미등록 파라미터는 식별자로 본다(과다 제외 방지)", () => {
    // `variant` 는 denylist 에 없다 → 다르면 다른 listing 으로 «본다» = 유지.
    expect(
      isSelfReferenceCandidate(
        "https://bobochoses.com/products/b226ac060-x?variant=111",
        "https://bobochoses.com/products/b226ac060-x?variant=222",
      ),
    ).toBe(false);
  });

  it("경로가 다르면(시장 전환 포함) 제외하지 않는다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://bobochoses.com/en-kr/products/b226ac060-x",
        "https://bobochoses.com/products/b226ac060-x",
      ),
    ).toBe(false);
  });
});
