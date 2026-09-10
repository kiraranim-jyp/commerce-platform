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
