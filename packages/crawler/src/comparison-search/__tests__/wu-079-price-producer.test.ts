import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WU-079 생산자 계약 — **운영 가격 extractor 를 직접 부른다** (네트워크 0)
 *
 * 🔴 CPO §11: 「캐시 결과만 읽는 테스트 금지 · producer-level mutation 으로 검증」.
 *    🔴 내 1차 하니스가 캐시를 읽어서 `extractFromJsonLd` 를 죽여도 **통과했다.**
 *    🟢 그래서 이 파일을 추가했다 — 운영 `factsFromProductUrl` 이 실제로 읽는다.
 *
 * 🔴 HTML 은 **관측된 모양** 만 재현한다(지어내지 않는다):
 *    ⒜ beaumonde — JSON-LD 0 · microdata 0 · meta 0 · 「판매가 N원」 라벨 ·
 *       `class="cost"` 에 **다른 상품** 금액들 · 배송비/적립금
 *    ⒝ 성공군 — JSON-LD `offers.price` + 배송비/적립금 숫자가 **같이** 있다
 */

let router: (url: string) => { status: number; finalUrl: string; body: string };

vi.mock("../../rate-limit/domain-rate-limiter", () => ({
  fetchWithDomainRateLimit: async (url: string) => {
    const r = router(url);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      url: r.finalUrl,
      text: async () => r.body,
      json: async () => JSON.parse(r.body),
    } as unknown as Response;
  },
}));

const { factsFromProductUrl } = await import("../product-url-facts");

/** 🔴 실측 C13/C27 의 모양 — 구조화 0, 라벨 금액 1, 그리고 **다른 상품** 금액 다수. */
const BEAUMONDE = `<html><head><title>보보쇼즈 26FW 아동 긴팔 티셔츠 B226AC010</title></head><body>
<div class="goods_price"><span>판매가</span> 170,000 원</div>
<div><span>정가</span> 170,000 원</div>
<div><span>배송비</span> 3,500 원</div><div>적립금 : 1,000 원</div>
<ul class="recommend"><li><span class="cost">52,000 원</span></li>
<li><span class="cost">210,000 원</span></li><li><span class="cost">58,600 원</span></li></ul>
</body></html>`;

/** 🟢 성공군 모양 — JSON-LD 가 진실이고, 배송비/적립금 숫자가 **같이** 있다. */
const WITH_LD = (price: number) => `<html><head><title>보보쇼즈 티셔츠</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product",
"name":"보보쇼즈 티셔츠","offers":{"@type":"Offer","price":${price},"priceCurrency":"KRW"}}</script>
</head><body><li class="delivery_price_css">3,500원</li>
<span class="mileage_price">2340</span>
<ul><li><span class="cost">999,000 원</span></li></ul></body></html>`;

const U_PLAIN = "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021";
const U_LD = "https://biskuit.kr/product/x/8891/category/367/display/1/";

beforeEach(() => {
  router = () => ({ status: 200, finalUrl: U_PLAIN, body: BEAUMONDE });
});

describe("WU-079 — 가격 생산자 계약", () => {
  /* ───────── ① 실패군이 «정말» 실패인가 ───────── */

  it("🔴 Q1 beaumonde 모양 — 상품으로는 통과하는데 가격만 없다", async () => {
    const r = await factsFromProductUrl(U_PLAIN);
    expect(r.status).toBe("OK");
    expect(r.candidate?.title).toBeTruthy();
    /** 🔴 본문에 「170,000 원」이 있는데도 **가격은 null** 이다 — 설계대로다. */
    expect(r.candidate?.price).toBeNull();
    expect(r.candidate?.priceStatus).toBe("PRICE_UNAVAILABLE");
  });

  it("🟢 Q6 **본문 숫자를 가격으로 쓰지 않는다** — 배송비 3,500 도 다른상품 52,000 도 안 들어간다", async () => {
    const r = await factsFromProductUrl(U_PLAIN);
    expect(r.candidate?.price).toBeNull();
    /** 🔴 이 단언이 generic 숫자 parser 가 들어오는 것을 **막는 계약** 이다. */
    expect(JSON.stringify(r.candidate?.price ?? null)).not.toMatch(/3500|52000|170000/);
  });

  /* ───────── ② 성공군이 오염에도 정확한가 ───────── */

  it("🟢 Q2 JSON-LD 가 있으면 **그 값** 이다 — 배송비·적립금·다른상품에 흔들리지 않는다", async () => {
    router = () => ({ status: 200, finalUrl: U_LD, body: WITH_LD(117000) });
    const r = await factsFromProductUrl(U_LD);
    expect(r.candidate?.price).toEqual({ amount: 117000, currency: "KRW" });
  });

  it("🟢 Q6 통화가 없으면 **가격을 만들지 않는다**(금액만 있는 JSON-LD)", async () => {
    router = () => ({
      status: 200,
      finalUrl: U_LD,
      body: `<html><head><title>t</title><script type="application/ld+json">
{"@type":"Product","name":"t","offers":{"price":117000}}</script></head><body>117,000원</body></html>`,
    });
    expect((await factsFromProductUrl(U_LD)).candidate?.price).toBeNull();
  });

  it("🟢 Q6 0 이나 음수는 가격이 아니다", async () => {
    router = () => ({ status: 200, finalUrl: U_LD, body: WITH_LD(0) });
    expect((await factsFromProductUrl(U_LD)).candidate?.price).toBeNull();
  });

  /* ───────── ③ precedence — 낮은 신뢰도가 높은 것을 침범하지 않는가 ───────── */

  it("🔴 Q8 precedence — JSON-LD 가 있으면 **microdata 가 덮지 못한다**", async () => {
    router = () => ({
      status: 200,
      finalUrl: U_LD,
      body: `<html><head><title>t</title><script type="application/ld+json">
{"@type":"Product","name":"t","offers":{"price":117000,"priceCurrency":"KRW"}}</script></head>
<body><div itemscope itemtype="https://schema.org/Product">
<span itemprop="price" content="999000"></span><meta itemprop="priceCurrency" content="KRW">
</div></body></html>`,
    });
    const r = await factsFromProductUrl(U_LD);
    expect(r.candidate?.price?.amount).toBe(117000);
  });
});
