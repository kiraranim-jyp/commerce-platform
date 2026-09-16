import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshDomesticProductPrice } from "../comparison-search";
import { extractForetforetShippingPolicy, fetchForetforetProductPrice } from "../comparison-search/foretforet";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * DOMESTIC-SHIPPING-03(CEO 지시, 2026-09-16) — 포레포레 «한 곳» 수직 슬라이스
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 원문: "«배송비를 계산하는 기능»을 만드는 게 아니라, «배송비에 대해 실제로
 * 무엇을 알고 있는지»를 시스템이 정확하게 기록하게 만드는 것이다."
 *
 * 그래서 이 파일이 재는 것은 셋뿐이다.
 *   ① 실측 원문에서 «상태»를 읽는가 — 그리고 «금액은 읽지 않는가».
 *   ② note가 «판매처 원문»인가 — 우리가 다듬은 문장이 아닌가(공백·태그 외 무변경).
 *   ③ 못 읽은 것과 읽고도 못 찾은 것이 «다른 값»으로 남는가.
 *
 * fixture는 2026-09-16에 실제로 받은 HTTP 200 응답(239,389 bytes)에서 파서가 보는
 * 네 조각만 «한 글자도 고치지 않고» 잘라낸 것이다. 전체 응답과 이 발췌에 대해
 * 파서 결과가 같다는 것은 발췌 시점에 실측으로 확인했다(파일 머리말 참고).
 */

const FORETFORET_HTML = readFileSync(
  fileURLToPath(new URL("./fixtures/foretforet-shopdetail-10226592.html", import.meta.url)),
  "utf-8",
);

const PRODUCT_URL = "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592";

/** 2026-09-16 실측 원문. 이 문자열은 판매처가 쓴 것이고 우리가 쓴 것이 아니다. */
const MEASURED_NOTE = [
  "총 결제금액이 70,000원 미만시 배송비 3,000원이 청구됩니다.",
  "아래 지역에 배송비가 추가됩니다.",
  "진도군 조도면 : 3,000원(10,000,000원 미만시), 울릉군 : 3,000원(10,000,000원 미만시), 제주도 : 3,000원(10,000,000원 미만시), 서귀포시 : 3,000원(10,000,000원 미만시), 제주시 : 3,000원(10,000,000원 미만시), 제주,한경면 : 3,000원(10,000,000원 미만시)",
].join("\n");

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

function mockFetch(handler: (url: string) => Response) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    return handler(url);
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ═══════ ① 실측 원문에서 상태를 읽는다 — 금액은 읽지 않는다 ═══════ */

describe("DOMESTIC-SHIPPING-03 ①: 포레포레 실측 원문 → CONDITIONAL_FREE", () => {
  it("배송비 필드의 MakeShop 라벨 «(조건)»이 상태의 근거다", () => {
    expect(extractForetforetShippingPolicy(FORETFORET_HTML).status).toBe("CONDITIONAL_FREE");
    // 라벨이 실제로 그 자리에 있다(상태를 본문 문장 해석으로 정한 것이 아니다).
    expect(FORETFORET_HTML).toContain('<span class="shopdetailInfoName">배송비</span>');
    expect(FORETFORET_HTML).toContain("배송조건 : (조건)");
  });

  it("🔴 파서가 돌려주는 값에 «금액» 칸 자체가 없다 — 3,000원을 뽑지 않는다", () => {
    const policy = extractForetforetShippingPolicy(FORETFORET_HTML);
    expect(Object.keys(policy).sort()).toEqual(["note", "status"]);
    // 원문에 「3,000원」이 여러 번 나오지만, 그건 note 안의 «판매처 문장»으로만
    // 존재한다. 숫자로 승격된 칸은 어디에도 없다.
    expect(policy.note).toContain("3,000원");
    expect(JSON.parse(JSON.stringify(policy))).toEqual({ status: "CONDITIONAL_FREE", note: MEASURED_NOTE });
  });
});

/* ═══════ ② note는 «판매처 원문»이다 ═══════ */

describe("DOMESTIC-SHIPPING-03 ②: note를 우리가 다듬지 않았다", () => {
  it("🔴 note는 «입점사 배송비» 블록과 공백·태그를 뺀 모든 글자가 같다", () => {
    const rawBlock = /<dt>\s*입점사 배송비\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/.exec(FORETFORET_HTML)![1];
    const stripped = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/gu, "");
    // 이 한 줄이 "우리 해석이 섞이지 않았다"의 실제 증명이다 — 요약도, 재작성도,
    // 단위 정규화도 했다면 이 비교가 깨진다.
    expect(stripped(extractForetforetShippingPolicy(FORETFORET_HTML).note ?? "")).toBe(stripped(rawBlock));
  });

  it("🔴 note는 «한 자리»에서 왔다 — 두 블록을 이어 붙이지 않았다", () => {
    const note = extractForetforetShippingPolicy(FORETFORET_HTML).note!;
    // 배송비 필드의 alert 문장은 입점사 블록의 «첫 문장과 같은 문장»이다(실측).
    // 그래서 note 한 자리만으로 두 자리의 사실이 모두 남는다.
    const alertText = /javascript:alert\('([\s\S]*?)'\)/.exec(FORETFORET_HTML)![1];
    expect(note.startsWith(alertText.trim())).toBe(true);
    // 반면 «포레포레 기본 배송비 기준»(다른 dl, 샵 공통 정책)은 들어오지 않았다 —
    // 서로 다른 블록을 합치면 그 문장은 판매처 원문이 아니라 우리 편집물이 된다.
    expect(note).not.toContain("포레포레 기본 배송비 기준");
    expect(note).not.toContain("결제 완료 후 평균 3일 이내출고");
  });

  it("🔴 우리 어휘를 note에 심지 않았다 — 상태 이름은 note에 나타나지 않는다", () => {
    const note = extractForetforetShippingPolicy(FORETFORET_HTML).note!;
    for (const ours of ["CONDITIONAL_FREE", "조건부", "무료배송으로 확인됨", "배송조건 : (조건)"]) {
      expect(note).not.toContain(ours);
    }
  });
});

/* ═══════ ③ 못 읽은 것과 읽고도 못 찾은 것 ═══════ */

describe("DOMESTIC-SHIPPING-03 ③: «모른다»의 종류를 섞지 않는다", () => {
  it("읽었는데 배송비 필드가 없으면 UNREAD·note null이다", () => {
    expect(extractForetforetShippingPolicy("<html><body>배송비 얘기가 없는 페이지</body></html>")).toEqual({
      status: "UNREAD",
      note: null,
    });
  });

  it("🔴 실측하지 않은 라벨은 «추측해서 승격시키지 않는다» — UNREAD로 두되 원문은 남긴다", () => {
    // 「(무료)면 FREE겠지」는 추측이다. 실측 1건으로 어휘를 넓히지 않는다.
    const html = `<p><span class="shopdetailInfoName">배송비</span>
      <span class="shopdetailInfoCont"><a href="javascript:alert('무료배송입니다.');"><span>배송조건 : (무료)</span></a></p>`;
    const policy = extractForetforetShippingPolicy(html);
    expect(policy.status).toBe("UNREAD");
    // 🔴 FREE로도, 0원으로도 바뀌지 않는다. 다음 실측 때 쓸 근거는 그대로 남는다.
    expect(policy.note).toBe("무료배송입니다.");
  });

  it("🔴 응답 자체를 못 받으면 두 칸을 «채우지 않는다» — UNREAD는 읽었다는 주장이다", async () => {
    mockFetch(() => htmlResponse("", 404));
    const result = await fetchForetforetProductPrice(PRODUCT_URL);
    expect(result.shippingPolicyStatus).toBeUndefined();
    expect(result.shippingPolicyNote).toBeUndefined();
    expect("shippingPolicyStatus" in result).toBe(false);
  });
});

/* ═══════ ④ 어댑터 → refreshDomesticProductPrice 배관 ═══════ */

describe("DOMESTIC-SHIPPING-03 ④: 어댑터가 읽은 값이 배관을 그대로 통과한다", () => {
  it("가격·품절과 «같은 자리»에서 배송비 상태가 함께 올라온다", async () => {
    mockFetch(() => htmlResponse(FORETFORET_HTML));
    const result = await fetchForetforetProductPrice(PRODUCT_URL);
    expect(result.price).toEqual({ amount: 258000, currency: "KRW" });
    expect(result.soldOut).toBe(false);
    expect(result.shippingPolicyStatus).toBe("CONDITIONAL_FREE");
    expect(result.shippingPolicyNote).toBe(MEASURED_NOTE);
  });

  it("refreshDomesticProductPrice(foretforet.com)가 두 칸을 그대로 옮긴다", async () => {
    mockFetch(() => htmlResponse(FORETFORET_HTML));
    const result = await refreshDomesticProductPrice("foretforet.com", PRODUCT_URL);
    expect(result.status).toBe("OK");
    expect(result.price).toEqual({ amount: 258000, currency: "KRW" });
    expect(result.shippingPolicyStatus).toBe("CONDITIONAL_FREE");
    expect(result.shippingPolicyNote).toBe(MEASURED_NOTE);
  });

  it("가격을 못 찾아도(UNAVAILABLE) 배송비 정책을 확인한 사실은 남는다", async () => {
    // 가격 변수만 없는 페이지 — 배송비 블록은 실측 원문 그대로다.
    mockFetch(() => htmlResponse(FORETFORET_HTML.replace("var product_price = '258000';", "")));
    const result = await refreshDomesticProductPrice("foretforet.com", PRODUCT_URL);
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.price).toBeNull();
    expect(result.shippingPolicyStatus).toBe("CONDITIONAL_FREE");
  });
});

/* ═══════ ⑤ 나머지 어댑터 5개는 한 줄도 바뀌지 않았다 ═══════ */

describe("DOMESTIC-SHIPPING-03 ⑤: 다른 판매처 5곳은 «배송비 칸 자체가 없다»", () => {
  /** 🔴 soldOut 선례(N-4.18-G) 그대로 — 실측한 사이트만 채운다. 나머지는 값을
   *  넘기지 않으므로 키조차 생기지 않고, 저장 시 undefined → null이 된다.
   *  「모른다」가 「UNREAD」로도 「무료」로도 승격되는 경로가 없다는 뜻이다. */
  const OTHER_DOMAINS: Array<[string, string]> = [
    ["looxloo.com", "https://looxloo.com/product/detail.html?product_no=1"],
    ["bobochoses.com", "https://bobochoses.com/products/some-handle"],
    ["rulii.co.kr", "https://rulii.co.kr/product/detail.html?product_no=1"],
    ["deuxbebe.com", "https://deuxbebe.com/product/detail.html?product_no=1"],
    ["chocoel.co.kr", "https://chocoel.co.kr/product/detail.html?product_no=1"],
  ];

  it.each(OTHER_DOMAINS)("%s — shippingPolicyStatus/Note 키가 결과에 없다", async (domain, url) => {
    mockFetch(() => htmlResponse("", 404));
    const result = await refreshDomesticProductPrice(domain, url);
    expect(Object.keys(result)).not.toContain("shippingPolicyStatus");
    expect(Object.keys(result)).not.toContain("shippingPolicyNote");
  });

  it("지원하지 않는 도메인도 마찬가지다(UNSUPPORTED)", async () => {
    const result = await refreshDomesticProductPrice("example.com", "https://example.com/p/1");
    expect(result).toEqual({ status: "UNSUPPORTED", price: null });
  });
});
