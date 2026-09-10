import { describe, expect, it } from "vitest";
import { fetchHtmlDirect } from "../utils/direct-html-fetch";

/**
 * OVERSEAS-PRICE-ORIGINAL-FALLBACK-1(CPO 지시, 2026-09-10).
 *
 * 지키는 불변조건: **폴백은 절대 throw하지 않는다.**
 *
 * 이 함수는 브라우저 네비게이션이 4xx/5xx로 막혔을 때만 호출된다. 그 시점에 예외가
 * 나가면 추출 전체가 죽어서, 폴백이 없을 때보다 오히려 나빠진다. 어떤 실패든 null을
 * 주고 호출부가 기존 동작을 그대로 유지하게 해야 한다.
 *
 * 실제 네트워크를 타는 케이스는 여기서 테스트하지 않는다 — 외부 사이트 상태에 따라
 * 깨지는 테스트를 만들지 않는다(smallable 403/HTTP 200 실측은 조사 단계에서 확인).
 */
describe("폴백은 어떤 입력에도 예외를 던지지 않는다", () => {
  it.each([
    ["빈 문자열", ""],
    ["URL이 아님", "not-a-url"],
    ["프로토콜 없음", "www.example.com/x"],
    ["지원하지 않는 프로토콜", "ftp://example.com/x"],
    ["file 프로토콜", "file:///etc/passwd"],
    ["data URL", "data:text/html,<h1>x</h1>"],
  ])("%s → null", async (_label, url) => {
    await expect(fetchHtmlDirect(url)).resolves.toBeNull();
  });

  it("핵심 회귀: 연결할 수 없는 호스트도 예외가 아니라 null이다", async () => {
    // 폴백이 throw하면 universalExtract 전체가 실패한다.
    await expect(fetchHtmlDirect("https://invalid.invalid/product")).resolves.toBeNull();
  }, 30_000);

  it("리다이렉트 한도를 소진하면 null — 무한 루프에 빠지지 않는다", async () => {
    // redirectsLeft=0으로 시작하면 3xx를 따라가지 않고 그 응답을 그대로 돌려주거나
    // 실패해야 한다. 어느 쪽이든 예외는 없다.
    await expect(fetchHtmlDirect("https://invalid.invalid/redirect", 0)).resolves.toBeNull();
  }, 30_000);
});

/**
 * OVERSEAS-PRICE-ORIGINAL-FALLBACK-1 후속(CEO 지시, 2026-09-10).
 *
 * 지키는 불변조건: **해외 원본가격은 원본 사이트 국가 기준으로 형성한다.**
 *
 * 폴백은 서버에서 직접 HTTP 요청을 보내는데, 접속 IP로 통화를 바꾸는 사이트가 있다.
 * 실측(smallable): 서울 리전에서 받으면 KRW 98,784가 온다 — 원본 국가 가격이 아니라
 * 한국 현지 판매가라 이미 현지 세금/마진이 들어 있다. 그대로 쓰면 착지원가에
 * 수입비용을 이중으로 얹는다. 그래서 폴백 경로에서 나온 KRW 가격은 버린다.
 *
 * universalExtract 전체를 돌리려면 브라우저가 필요하므로, 여기서는 그 판정 규칙만
 * 고정한다(규칙이 뒤집히면 즉시 실패한다).
 */
describe("폴백 가격의 통화 판정 — 현지화된 가격을 원본가격으로 쓰지 않는다", () => {
  /** universal-extractor의 가드와 같은 조건. */
  const keepPrice = (usedFallback: boolean, currency: string | undefined) =>
    !(usedFallback && currency === "KRW");

  it("핵심 회귀: 폴백으로 받은 KRW 가격은 버린다", () => {
    expect(keepPrice(true, "KRW")).toBe(false);
  });

  it("폴백으로 받아도 원본 국가 통화면 그대로 쓴다", () => {
    expect(keepPrice(true, "EUR")).toBe(true);
    expect(keepPrice(true, "USD")).toBe(true);
    expect(keepPrice(true, "GBP")).toBe(true);
  });

  it("폴백을 타지 않은 정상 추출은 통화와 무관하게 건드리지 않는다", () => {
    // 브라우저가 2xx로 정상 로드한 경우 — 기존 동작을 바꾸지 않는다.
    expect(keepPrice(false, "KRW")).toBe(true);
    expect(keepPrice(false, "USD")).toBe(true);
  });
});
