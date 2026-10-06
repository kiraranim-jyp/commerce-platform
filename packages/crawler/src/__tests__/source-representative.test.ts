import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findSourceRepresentativeImageUrl,
  findSourceRepresentativeIndex,
  representativeIdForIndex,
} from "../source-representative";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-1 — **원소스가 «명시한» 대표 이미지.** (CPO 확정 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 인정 조건은 「schema.org Product 의 image 가 «단일 선언»」 하나다.
 * 「`image[0]` 이라서」가 아니라 **후보가 하나뿐이라 모호성이 구조적으로
 * 불가능해서** 대표다. 그래서 배열 · 0개 · 2개 이상 · og:image 는 전부 거부한다.
 *
 * ── 🔴 입력이 실측이다 ────────────────────────────────────────────────────
 * 아래 두 fixture 는 지어낸 것이 아니다:
 *     tennis-warehouse-magro-offers.html  186KB 실제 페이지(2026-10-06 저장)
 *                                         microdata — Product 안 itemprop=image 1개
 *     smallable-430632-product.html       JSON-LD — Product.image 단일 string
 * 합성 HTML 은 «거부 조건» 을 재는 데만 쓴다(실제 페이지에 그 모양이 없다).
 */
const FIXTURES = join(__dirname, "fixtures");
const read = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

describe("① 🔴 실측 — tennis-warehouse (microdata 단일 선언)", () => {
  const html = read("tennis-warehouse-magro-offers.html");

  it("🔴 공허 방지 — fixture 가 실제로 그 모양이다", () => {
    expect(html.length).toBeGreaterThan(100_000);
    /* JSON-LD 도 og:image 도 «없는» 페이지다 — microdata 가 유일한 출처다. */
    expect(html).not.toContain("application/ld+json");
    expect(html).not.toContain("og:image");
    expect((html.match(/itemtype=["'][^"']*schema\.org\/Product["']/g) ?? []).length).toBe(1);
    expect((html.match(/\bitemprop=["']image["']/g) ?? []).length).toBe(1);
  });

  it("원소스 대표로 STMMLS-WH-1 을 찾는다", () => {
    const url = findSourceRepresentativeImageUrl(html, "https://www.tennis-warehouse.com/x/a.html");
    expect(url).toBeTruthy();
    expect(url).toContain("STMMLS-WH-1.jpg");
  });

  it("🔴 srcset 이 아니라 src 를 쓴다 — 여러 해상도 중 하나를 지어내지 않는다", () => {
    const url = findSourceRepresentativeImageUrl(html) ?? "";
    expect(url).toContain("nw=455");
  });
});

describe("② 🔴 실측 — smallable (JSON-LD Product.image 단일 string)", () => {
  const html = read("smallable-430632-product.html");

  it("🔴 공허 방지 — Product.image 가 단일 string 이다", () => {
    expect(html).toContain("application/ld+json");
    expect(html).toContain('"@type":"Product"');
  });

  it("단일 string 을 원소스 대표로 인정하고 절대 URL 로 만든다", () => {
    const url = findSourceRepresentativeImageUrl(html, "https://www.smallable.com/x");
    expect(url).toBeTruthy();
    /* 원문은 `//staticv3…` 프로토콜 상대 URL 이다. */
    expect(url!.startsWith("https://")).toBe(true);
    expect(url).toContain("all-about-monsters-washed-t-shirt-organic-cotton.webp");
  });
});

describe("③ 🔴 거부 조건 — 「모르면 고르지 않는다」", () => {
  const ld = (image: string) =>
    `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"x","image":${image}}</script>`;

  it("JSON-LD image 가 «배열» 이면 대표로 확정하지 않는다", () => {
    expect(findSourceRepresentativeImageUrl(ld('["https://a/1.jpg","https://a/2.jpg"]'))).toBeNull();
  });

  it("배열이 한 칸뿐이어도 «배열» 은 거부한다 — 순서 의미를 빌리지 않는다", () => {
    expect(findSourceRepresentativeImageUrl(ld('["https://a/1.jpg"]'))).toBeNull();
  });

  it("단일 ImageObject 는 인정한다 — «하나» 라는 뜻이 같다", () => {
    expect(findSourceRepresentativeImageUrl(ld('{"@type":"ImageObject","url":"https://a/1.jpg"}'))).toBe(
      "https://a/1.jpg",
    );
  });

  it("🔴 Product 가 둘이면 포기한다 — 어느 상품의 대표인지 가릴 수 없다", () => {
    expect(findSourceRepresentativeImageUrl(ld('"https://a/1.jpg"') + ld('"https://a/2.jpg"'))).toBeNull();
  });

  it("🔴 microdata itemprop=image 가 2개 이상이면 포기한다", () => {
    const html =
      '<div itemtype="http://schema.org/Product"><img itemprop="image" src="https://a/1.jpg">' +
      '<img itemprop="image" src="https://a/2.jpg"></div>';
    expect(findSourceRepresentativeImageUrl(html)).toBeNull();
  });

  it("🔴 Product 스코프 «밖» 의 itemprop=image 는 대표가 아니다", () => {
    /* Product 선언이 없으면 microdata 경로가 아예 열리지 않는다. */
    const html = '<div itemtype="http://schema.org/Organization"><img itemprop="image" src="https://a/logo.jpg"></div>';
    expect(findSourceRepresentativeImageUrl(html)).toBeNull();
  });

  it("🔴 og:image 는 대표로 승격하지 않는다", () => {
    expect(findSourceRepresentativeImageUrl('<meta property="og:image" content="https://a/og.jpg">')).toBeNull();
  });

  it("깨진 JSON-LD 는 «없는 것» 으로 둔다 — 추측해서 고치지 않는다", () => {
    expect(findSourceRepresentativeImageUrl('<script type="application/ld+json">{nope</script>')).toBeNull();
  });

  it("빈 HTML 은 null", () => {
    expect(findSourceRepresentativeImageUrl("")).toBeNull();
  });
});

describe("④ 🔴 대표 URL → 추출 인덱스 → 이미지 id", () => {
  const imgs = (...urls: string[]) => urls.map((url) => ({ url }));

  it("완전일치", () => {
    expect(findSourceRepresentativeIndex(imgs("https://a/1.jpg", "https://a/2.jpg"), "https://a/2.jpg")).toBe(1);
  });

  it("쿼리만 다르면 맞춘다 — 리사이즈 파라미터가 흔하다", () => {
    expect(findSourceRepresentativeIndex(imgs("https://a/1.jpg?nw=1408"), "https://a/1.jpg?nw=455")).toBe(0);
  });

  it("마지막 경로 조각으로도 맞춘다", () => {
    expect(findSourceRepresentativeIndex(imgs("https://cdn/x/1.jpg"), "https://origin/y/1.jpg")).toBe(0);
  });

  it("🔴 여러 장이 같은 조건으로 걸리면 포기한다 — 비슷한 것을 고르지 않는다", () => {
    expect(findSourceRepresentativeIndex(imgs("https://a/1.jpg", "https://b/1.jpg"), "https://c/1.jpg")).toBe(-1);
  });

  it("못 찾으면 -1 이고 id 는 null", () => {
    expect(findSourceRepresentativeIndex(imgs("https://a/1.jpg"), "https://a/zzz.jpg")).toBe(-1);
    expect(representativeIdForIndex(-1)).toBeNull();
  });

  it("대표 URL 이 없으면 -1", () => {
    expect(findSourceRepresentativeIndex(imgs("https://a/1.jpg"), null)).toBe(-1);
  });

  it("🔴 id 규칙이 downloader 와 «같다» — 4자리 0 패딩", () => {
    expect(representativeIdForIndex(0)).toBe("0000");
    expect(representativeIdForIndex(3)).toBe("0003");
    expect(representativeIdForIndex(12)).toBe("0012");
  });
});
