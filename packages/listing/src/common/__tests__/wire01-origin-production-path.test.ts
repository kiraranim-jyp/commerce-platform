import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCommonOrigin } from "../origin";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WIRE-01 — Common Origin 이 **실제 Production 경로에 들어갔는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 새 층을 만들어 두고 아무도 부르지 않으면 「Common 을 만들었다」가 아니다.
 * 그래서 이 파일은 «호출되는가» 를 본다.
 *
 * 🔴 그리고 더 중요한 것 — **기존 결과가 바뀌지 않는가**. 사다리를 한 곳으로
 * 모으면서 순서가 틀어지면 지금 나가는 payload 가 조용히 달라진다. 실제로
 * 처음에 순서를 반대로 썼다가(판매자 → 브랜드) 실측에서 잡혔다.
 */

const read = (...parts: string[]) => readFileSync(join(__dirname, "..", "..", ...parts), "utf8").replace(/\r\n/g, "\n");
const COUPANG = read("coupang", "build-payload.ts");
const ADMIN_ROOT = join(__dirname, "..", "..", "..", "..", "..", "apps", "admin", "src", "app", "api");
const NAVER_CONTEXT = readFileSync(join(ADMIN_ROOT, "naver", "_lib", "resolve-context.ts"), "utf8").replace(/\r\n/g, "\n");
const LOTTEON_CONTEXT = readFileSync(join(ADMIN_ROOT, "lotteon", "_lib", "build-context.ts"), "utf8").replace(/\r\n/g, "\n");

describe("① 세 채널이 «실제로» Common 을 부른다", () => {
  it.each([
    ["쿠팡 payload 빌더", COUPANG],
    ["스마트스토어 컨텍스트", NAVER_CONTEXT],
    ["롯데ON 컨텍스트", LOTTEON_CONTEXT],
  ])("%s 가 resolveCommonOrigin 을 호출한다", (_label, source) => {
    expect(source).toContain("resolveCommonOrigin(");
  });

  it("🔴 옛 사다리가 «남아 있지 않다» — 두 곳이 갈라질 자리를 없앴다", () => {
    /* 같은 세 값을 || 로 잇던 줄이 그대로 남아 있으면 한쪽만 고쳐질 수 있다. */
    expect(COUPANG).not.toContain("product.countryOfOrigin.value || brandProfile?.countryOfOrigin");
    expect(NAVER_CONTEXT).not.toContain("extractedCountryOfOrigin || brandProfile?.countryOfOrigin");
  });
});

describe("🔴 ② 기존 결과가 바뀌지 않는다 — 옛 사다리와 값이 같다", () => {
  /** 옛 코드 그대로. 이 함수가 「바뀌면 안 되는 것」의 정의다. */
  const legacy = (product?: string, brand?: string, seller?: string) =>
    product || brand || seller || undefined;

  const cases: [string | undefined, string | undefined, string | undefined][] = [
    ["Spain", "Italy", "Korea"],
    [undefined, "Italy", "Korea"],
    [undefined, undefined, "Korea"],
    [undefined, undefined, undefined],
    ["", "Italy", "Korea"],
    ["Spain", undefined, undefined],
    [undefined, "", "Korea"],
  ];

  it.each(cases)("상품=%s · 브랜드=%s · 판매자=%s 에서 같은 값", (product, brand, seller) => {
    const common =
      resolveCommonOrigin({ product: { value: product }, brandDefault: brand, sellerDefault: seller }).value ??
      undefined;
    expect(common).toBe(legacy(product, brand, seller));
  });
});

describe("🔴 ③ Spain → ES 자동 변환이 생기면 «반드시 깨진다»", () => {
  it("Common 결과에 ISO 코드가 없다", () => {
    const field = resolveCommonOrigin({ product: { value: "Spain" } });
    expect(field.value).toBe("Spain");
    expect(field.value).not.toBe("ES");
  });

  it("한글 원산지도 코드로 바뀌지 않는다", () => {
    expect(resolveCommonOrigin({ product: { value: "스페인" } }).value).toBe("스페인");
  });

  it("🔴 Common 파일 안에 국가명→코드 표가 «없다»", () => {
    const origin = read("common", "origin.ts");
    /* 지도 하나만 생겨도 이 검사가 잡는다. */
    expect(origin).not.toMatch(/"(Spain|스페인)"\s*:/);
    expect(origin).not.toMatch(/Spain.*=>.*ES/);
  });
});

describe("④ 롯데ON 은 «목록에서 고르는» 상태로 남는다", () => {
  it("Common 원산지가 있어도 롯데ON 코드를 만들지 않는다", () => {
    const field = resolveCommonOrigin({ product: { value: "스페인" } });
    expect(field.valueState).toBe("VALUE");
    /* 🔴 값이 있다는 것과 롯데ON 코드가 정해졌다는 것은 다른 사실이다.
       oplcCd 는 셀러가 89 목록에서 고른다(ORIGIN_CHANNEL_BINDINGS). */
    expect(JSON.stringify(field)).not.toContain("oplcCd");
  });
});
