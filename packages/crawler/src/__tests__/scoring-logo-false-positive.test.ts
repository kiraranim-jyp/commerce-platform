import { describe, expect, it } from "vitest";
import { scoreAndFilter } from "../scoring";
import type { ImageCandidate } from "../strategies/types";

/**
 * MI-DOMESTIC-FIX-1 §2(CPO 지시, 2026-09-09).
 *
 * 지키는 불변조건: **상품명에 들어있는 단어가 사이트 로고 판정 근거가 되지 않는다.**
 * 실측 사고 — childrensalon.com의 "Halloween Logo Sweatshirt"(633403)는 URL
 * 슬러그와 alt 양쪽에 "logo"가 들어 있어서 상품 이미지가 전부 폐기됐다.
 * 로고 필터를 없애는 게 아니라, 판정 근거를 "경로 구조"로 옮긴 것이다.
 */
const CONFIG = { minWidth: 200, minHeight: 200 };

function candidate(url: string, alt = "", context = "product-detail"): ImageCandidate {
  return { url, alt, context, siblingCount: 1, source: "dom-scan" };
}

const urlsOf = (cands: ImageCandidate[]) => scoreAndFilter(cands, CONFIG).images.map((i) => i.url);

describe("사이트 로고는 계속 제거된다 — 기능이 약해지지 않았다", () => {
  it("/logo-header.svg는 제외", () => {
    expect(urlsOf([candidate("https://shop.example.com/logo-header.svg")])).toHaveLength(0);
  });

  it("/site-logo.png는 제외", () => {
    expect(urlsOf([candidate("https://shop.example.com/static/site-logo.png")])).toHaveLength(0);
  });

  it("파일명이 logo 하나뿐이어도 제외", () => {
    expect(urlsOf([candidate("https://shop.example.com/assets/logo.png")])).toHaveLength(0);
  });

  it("디렉터리가 통째로 로고/아이콘류면 제외 — /icons/cart.svg", () => {
    expect(urlsOf([candidate("https://shop.example.com/icons/cart.svg")])).toHaveLength(0);
  });

  it("결제수단 배지도 제외", () => {
    expect(urlsOf([candidate("https://shop.example.com/img/payment-visa.png")])).toHaveLength(0);
  });
});

describe("핵심 회귀 — 상품명에 logo가 있어도 상품 이미지는 살아남는다", () => {
  const PRODUCT_URL =
    "https://www.childrensalon.com/media/catalog/product/cache/0/image/1000x1000/9df78eab33525d08d6e5fb8d27136e95/s/t/stella-mccartney-kids-girls-black-cotton-halloween-logo-sweatshirt-633403-70f4f9f8f2e89cc7257db34db7005307.jpg";

  it("실측 사고 재현: Halloween Logo Sweatshirt 이미지가 포함된다", () => {
    expect(urlsOf([candidate(PRODUCT_URL)])).toHaveLength(1);
  });

  it("alt에 'Logo Sweatshirt'가 있어도 포함된다 — alt는 상품명이지 로고 근거가 아니다", () => {
    const alt = "Stella McCartney Kids-Girls Black Cotton Halloween Logo Sweatshirt | Childrensalon";
    expect(urlsOf([candidate(PRODUCT_URL, alt)])).toHaveLength(1);
  });

  it("Logo Hoodie / Logo T-Shirt 슬러그도 포함된다", () => {
    const urls = [
      "https://shop.example.com/media/acme-kids-logo-hoodie-navy-12345.jpg",
      "https://shop.example.com/media/acme-logo-t-shirt-white-98765.jpg",
    ];
    expect(urlsOf(urls.map((u) => candidate(u)))).toHaveLength(2);
  });

  it("'Iconic'이 'icon'에 걸리지 않는다 — 토큰 완전일치로 바꾼 결과", () => {
    expect(urlsOf([candidate("https://shop.example.com/media/acme-iconic-jacket-black-4321.jpg")])).toHaveLength(1);
  });

  it("평범한 상품 이미지는 그대로 포함된다", () => {
    expect(urlsOf([candidate("https://shop.example.com/media/plain-cotton-dress-777.jpg")])).toHaveLength(1);
  });
});

describe("추천상품 영역 필터는 유지된다 — 로고 필터와 목적이 다르다", () => {
  it("related 컨텍스트의 이미지는 계속 제외된다", () => {
    const c = candidate("https://shop.example.com/media/plain-dress-777.jpg", "", "related-products carousel");
    expect(urlsOf([c])).toHaveLength(0);
  });
});
