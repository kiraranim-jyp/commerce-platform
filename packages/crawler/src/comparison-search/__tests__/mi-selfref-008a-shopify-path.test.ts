import { describe, expect, it } from "vitest";
import { canonicalListingKey, isSelfReferenceCandidate } from "../self-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-SELF-REFERENCE-CLOSE-008A — Shopify 경로 접두사 자기참조 누출
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **실측에서 왔다(WU-4 ON-axis, 2026-10-13).** Gemini Web Discovery 가
 *    원상품과 «같은 샵·같은 상품» 을 국내 후보로 물어왔고, 그것이
 *    `STRONG_IDENTIFIER / verified true / tier EXACT` 를 받았다:
 *
 *      원상품  www.junioredition.com/collections/bobo-choses/products/booty-ghosts-…
 *      후보    www.junioredition.com/products/booty-ghosts-…
 *
 *      원상품  www.junioredition.com/en-kr/collections/pepe-shoes/products/lulu-t-bar-…
 *      후보    www.junioredition.com/products/lulu-t-bar-…
 *
 *    실측 누출 **4/24 (17%)** — junioredition ×2(EXACT) · tennis-warehouse ×2(COMPARISON).
 *
 * 🟢 **이 WU 가 닫은 것은 목록 세그먼트 하나이고, 그것으로 종료됐다.**
 *    로케일 접두사는 CPO 가 **「다른 시장이므로 자기참조 아님」으로 확정** 했다
 *    (2026-10-13 · 아래 B 참조). 🔴 그래서 로케일이 섞인 쌍은 **결함이 아니다** —
 *    「남은 누출」로 다시 세지 않는다.
 *
 * 🔴 **원인은 Gemini 가 아니다.** `canonicalListingKey` 가 host·대소문자·끝슬래시·
 *    식별 쿼리만 정규화하고 Shopify 의 `/collections/<c>/` 와 `/en-kr/` **경로
 *    접두사를 떼지 않는다.** → host 는 같은데 `key` 가 달라 자기참조가 통과한다.
 *    국내 경로에서는 원상품 host(smallable/junioredition)와 국내 Cafe24 샵 host 가
 *    겹칠 일이 없어 **잠복** 했고, Gemini 는 웹 전체를 보므로 원상품 host 자체를
 *    후보로 물어와 **발화** 시켰다.
 *
 * 🟢 **새 정규화 규칙을 만들지 않는다.** 리포에 이미 검증된 구현이 있다 —
 *    `extractShopifyHandle`(shopify-product-json.ts:14)이 `/\/products\/([a-z0-9-]+)/`
 *    로 접두사와 무관하게 handle 을 뽑고, `toCrawlerUrl`(url-shape.ts:119)이
 *    「로케일도, 목록 경로도, 쿼리스트링도 떼어 낸 «정규» 상품 URL」을 만든다.
 *    🔴 「`/collections/` 문자열을 무조건 지운다」같은 구현을 하지 않는다(지시서 §7).
 *
 * 🔴🔴 **collision 금지가 이 WU 의 핵심 제약이다.** 서로 다른 상품을 같은 key 로
 *    만들면 정상 후보가 죽는다. 아래 C·F·G·H 가 그것을 지킨다.
 */

/* ══════════════ A. collections 접두사 — 같은 상품 ══════════════ */

describe("A. /collections/<c>/products/<p> ↔ /products/<p> → 자기참조", () => {
  const ORIGIN = "https://www.junioredition.com/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
  const CANDIDATE = "https://www.junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";

  it("🔴 WU-4 실측 — EXACT 를 받았던 그 쌍이 자기참조로 잡힌다", () => {
    expect(isSelfReferenceCandidate(ORIGIN, CANDIDATE)).toBe(true);
  });

  it("방향을 바꿔도 같은 답이다", () => {
    expect(isSelfReferenceCandidate(CANDIDATE, ORIGIN)).toBe(true);
  });

  it("key 가 실제로 같아진다(host 만 같은 것이 아니다)", () => {
    expect(canonicalListingKey(ORIGIN)).toEqual(canonicalListingKey(CANDIDATE));
  });
});

/* ══════════════ B. locale + collections 접두사 ══════════════ */

describe("B. 🟢 로케일 접두사 = «다른 시장» — **확정된 제품 정책**(CPO 2026-10-13)", () => {
  const ORIGIN = "https://www.junioredition.com/en-kr/collections/pepe-shoes/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe";
  const CANDIDATE = "https://www.junioredition.com/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe";

  /**
   * 🟢🟢 **CPO 가 확정했다(2026-10-13) — 로케일은 자기참조가 아니다.**
   *
   * ```
   * /collections/<c>/products/X  ↔  /products/X        → SAME LISTING → 자기참조
   * /en-kr/collections/<c>/products/X ↔ /products/X    → **다른 시장** → 자기참조 아님
   * ```
   *
   * 🔴 근거의 우선순위가 정해졌다:
   *   ① `mi-real-05-self-reference.test.ts:153` 「경로가 다르면 **(시장 전환 포함)**
   *      제외하지 않는다」 — **제품 정책을 직접 말하는 계약** 이다. 이것이 이긴다.
   *   ② `toCrawlerUrl`(url-shape.ts:119) 의 「로케일 제거」 주석 — **URL 정규화 구현의
   *      성격** 을 설명할 뿐, listing 동일성에 대한 제품 정책 근거로는 부족하다.
   *      🔴 주석을 근거로 ①을 뒤집지 않는다.
   *
   * 🔴 따라서 아래 두 케이스는 **결함이 아니라 확정된 동작** 이다. 「남은 누출」로
   *    다시 세지 않는다(CPO 명시). 로케일 정규화를 추가하지 않는다.
   */
  it("🟢 로케일이 섞인 쌍은 자기참조가 아니다(다른 시장) — 확정 정책", () => {
    expect(isSelfReferenceCandidate(ORIGIN, CANDIDATE)).toBe(false);
  });

  it("🟢 로케일만 다른 경우도 자기참조가 아니다 — 확정 정책", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
        "https://www.junioredition.com/products/bubble-sweatshirt-in-grey-melange-by-main-story",
      ),
    ).toBe(false);
  });

  /** 🟢 단 **로케일이 양쪽에 같으면** 목록 세그먼트 제거가 정상 동작한다 —
   *     이 WU 의 수정이 로케일 경로에서도 살아 있다는 증거다. */
  it("🟢 양쪽 로케일이 같으면 목록 세그먼트만으로 자기참조가 잡힌다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.junioredition.com/en-kr/collections/pepe-shoes/products/lulu-t-bar",
        "https://www.junioredition.com/en-kr/products/lulu-t-bar",
      ),
    ).toBe(true);
  });
});

/* ══════════════ C. 다른 상품 — 🔴 collision 금지 ══════════════ */

describe("C. 같은 host · 다른 handle → 자기참조 아님", () => {
  it("🔴 /products/X ↔ /products/Z 는 다른 상품이다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
        "https://www.junioredition.com/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe",
      ),
    ).toBe(false);
  });

  it("🔴🔴 접두사가 서로 다르고 handle 도 다르면 당연히 아니다 — 과다 병합 금지", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.junioredition.com/collections/a/products/booty-ghosts",
        "https://www.junioredition.com/collections/b/products/lulu-t-bar",
      ),
    ).toBe(false);
  });

  /** 🔴 선행 MI-REAL-05 가 **명시적으로 보존하라고 적어 둔** 쌍이다.
   *     로케일을 떼도 handle 이 ac043 ↔ ac042 로 달라 유지된다. */
  it("🔴 Bobo B226AC043(로케일 있음) ↔ B226AC042 는 정상 후보로 남는다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://bobochoses.com/en-kr/products/b226ac043-mystery-bc-half-zipped-sweatshirt",
        "https://bobochoses.com/products/b226ac042-mystery-bc-half-zipped-sweatshirt?_pos=1&_psq=AW26",
      ),
    ).toBe(false);
  });
});

/* ══════════════ D. 다른 host ══════════════ */

describe("D. 다른 host + 같은 상품 → 자기참조 아님(그게 비교의 목적이다)", () => {
  it("handle 이 같아도 host 가 다르면 유지한다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
        "https://looxloo.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
      ),
    ).toBe(false);
  });

  it("🔴 브랜드 공식몰도 host 가 다르면 자기참조가 아니다 — 그것은 «등록부/정책» 문제다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
        "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
      ),
    ).toBe(false);
  });
});

/* ══════════════ E. 기존 정상 동작 보존 ══════════════ */

describe("E. query / hash / trailing slash — 기존 동작 유지", () => {
  it("trailing slash·대소문자·hash 차이는 같은 listing 이다", () => {
    expect(
      isSelfReferenceCandidate("https://www.Shop.example/Products/ABC/#gallery", "https://shop.example/products/abc"),
    ).toBe(true);
  });

  it("🔴 Shopify 문맥 파라미터(_pos/_psq)는 listing 을 가리지 못한다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://bobochoses.com/products/b226ac042-x?_pos=1&_psq=q",
        "https://bobochoses.com/products/b226ac042-x",
      ),
    ).toBe(true);
  });
});

/* ══════════════ F~H. 🔴 비-Shopify 경로는 한 글자도 바뀌지 않는다 ══════════════ */

describe("F. 메이크샵/카페24 계열 — 쿼리 식별자 경로는 영향 없음", () => {
  it("foretforet branduid 자기참조는 그대로 잡힌다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273&search=x&sort=&xcode=040",
        "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273",
      ),
    ).toBe(true);
  });

  it("branduid 가 다르면 다른 listing 이다", () => {
    expect(
      isSelfReferenceCandidate(
        "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273",
        "https://www.foretforet.com/shop/shopdetail.html?branduid=10277972",
      ),
    ).toBe(false);
  });

  /** 🔴 `/product/detail.html`(단수)은 Shopify 가 아니다 — 경로 재조립을 하지 않는다. */
  it("deuxbebe product_no 경로는 기존 규칙 그대로다", () => {
    /** 🔴🔴 **내 전제가 틀렸다 — 실제 동작을 적는다.** `cate_no` 는
     *     `NON_IDENTIFYING_PARAMS` 에 **없다** → 식별자로 취급되어 `cate_no` 가
     *     다르면 **다른 listing** 이 된다(= 자기참조로 잡지 않는다).
     *  🟢 그것이 이 파일의 설계다 — 주석이 명시한다: 「과소 제외는 기존 동작이지만
     *     과다 제외는 정상 후보를 죽인다」. 보수적으로 둔 쪽이다.
     *  🔴 `cate_no` 를 비식별 목록에 넣는 것은 **이번 WU 범위 밖** 이다(지시서 §2
     *     「필요한 최소 범위만」). 관측 한계로 기록하고 고치지 않는다. */
    expect(
      isSelfReferenceCandidate(
        "https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=62",
        "https://www.deuxbebe.com/product/detail.html?product_no=8021",
      ),
    ).toBe(false);
    /** 🟢 대신 «같은» 쿼리면 그대로 잡힌다 — 경로 재조립이 비-Shopify 를 건드리지 않는다. */
    expect(
      isSelfReferenceCandidate(
        "https://www.deuxbebe.com/product/detail.html?product_no=8021&sort=",
        "https://www.deuxbebe.com/product/detail.html?product_no=8021",
      ),
    ).toBe(true);
    expect(
      isSelfReferenceCandidate(
        "https://www.deuxbebe.com/product/detail.html?product_no=8021",
        "https://www.deuxbebe.com/product/detail.html?product_no=9999",
      ),
    ).toBe(false);
  });
});

describe("G. 🔴🔴 목록 페이지는 병합하지 않는다 — collision 의 가장 위험한 자리", () => {
  it("/collections/a ↔ /collections/b 는 **서로 다른** key 다", () => {
    const a = canonicalListingKey("https://shop.example/collections/aaa");
    const b = canonicalListingKey("https://shop.example/collections/bbb");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.key).not.toBe(b!.key);
    expect(isSelfReferenceCandidate("https://shop.example/collections/aaa", "https://shop.example/collections/bbb")).toBe(false);
  });

  it("🔴 `products` 가 뒤따르지 않으면 접두사를 떼지 않는다", () => {
    const k = canonicalListingKey("https://shop.example/collections/aaa");
    expect(k!.key).toBe("/collections/aaa");
  });
});

describe("H. 식별자를 만들 수 없으면 제외하지 않는다(기존 계약)", () => {
  it("null / 비URL 은 null 이고 자기참조도 false 다", () => {
    expect(canonicalListingKey(null)).toBeNull();
    expect(canonicalListingKey("not a url")).toBeNull();
    expect(isSelfReferenceCandidate(undefined, "https://shop.example/products/x")).toBe(false);
    expect(isSelfReferenceCandidate("https://shop.example/products/x", null)).toBe(false);
  });
});
