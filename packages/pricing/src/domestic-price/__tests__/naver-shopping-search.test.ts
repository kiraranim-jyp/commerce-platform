import { afterEach, describe, expect, it, vi } from "vitest";
import { createNaverShoppingSearchSource } from "../naver-shopping-search";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createNaverShoppingSearchSource — 계약 테스트(실제 네트워크 호출 없음)", () => {
  it("credential이 없으면 NOT_CONFIGURED — fetch를 아예 호출하지 않는다", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const source = createNaverShoppingSearchSource(null);
    const result = await source.search("아동용 반팔 티셔츠");
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.listings).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("credential이 있으면 공식 문서 기준 헤더(X-Naver-Client-Id/Secret)와 엔드포인트로 호출한다", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 1, items: [{ title: "테스트 상품", link: "https://shopping.naver.com/x", lprice: "19900", hprice: "0", mallName: "테스트몰" }] }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const source = createNaverShoppingSearchSource({ clientId: "id", clientSecret: "secret" });
    const result = await source.search("아동용 반팔 티셔츠");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("https://openapi.naver.com/v1/search/shop.json");
    expect(url).toContain(encodeURIComponent("아동용 반팔 티셔츠"));
    expect(init.headers["X-Naver-Client-Id"]).toBe("id");
    expect(init.headers["X-Naver-Client-Secret"]).toBe("secret");

    expect(result.status).toBe("OK");
    expect(result.listings).toEqual([
      { mallName: "테스트몰", priceKrw: 19900, productUrl: "https://shopping.naver.com/x", title: "테스트 상품" },
    ]);
  });

  it("items가 빈 배열이면 NO_RESULTS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 0, items: [] }) }),
    );
    const source = createNaverShoppingSearchSource({ clientId: "id", clientSecret: "secret" });
    const result = await source.search("존재하지않는상품명xyz123");
    expect(result.status).toBe("NO_RESULTS");
  });

  it("HTTP 에러 응답이면 ERROR를 반환하고 예외를 던지지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const source = createNaverShoppingSearchSource({ clientId: "bad", clientSecret: "bad" });
    const result = await source.search("test");
    expect(result.status).toBe("ERROR");
    expect(result.message).toContain("401");
  });

  it("fetch 자체가 실패해도(네트워크 오류) 예외를 던지지 않고 ERROR로 감싼다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const source = createNaverShoppingSearchSource({ clientId: "id", clientSecret: "secret" });
    const result = await source.search("test");
    expect(result.status).toBe("ERROR");
    expect(result.message).toContain("network down");
  });

  it("가격을 숫자로 못 읽는 리스팅은 0원으로 지어내지 않고 제외한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 2,
        items: [
          { title: "정상", link: "https://x", lprice: "10000", hprice: "0", mallName: "A" },
          { title: "가격없음", link: "https://y", lprice: "", hprice: "", mallName: "B" },
        ],
      }),
    }));
    const source = createNaverShoppingSearchSource({ clientId: "id", clientSecret: "secret" });
    const result = await source.search("test");
    expect(result.status).toBe("OK");
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].mallName).toBe("A");
  });

  it("title의 <b> 강조 태그를 제거한다(네이버 검색 API가 검색어를 하이라이트로 감싸서 준다)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        items: [{ title: "<b>보보쇼즈</b> 스웨트셔츠", link: "https://x", lprice: "50000", hprice: "0", mallName: "A" }],
      }),
    }));
    const source = createNaverShoppingSearchSource({ clientId: "id", clientSecret: "secret" });
    const result = await source.search("보보쇼즈");
    expect(result.listings[0].title).toBe("보보쇼즈 스웨트셔츠");
  });
});
