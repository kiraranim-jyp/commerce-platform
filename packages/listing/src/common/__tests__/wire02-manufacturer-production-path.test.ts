import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveManufacturer } from "../manufacturer";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WIRE-02 — 제조사 폴백을 세 채널이 «같은 함수» 로 본다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 WIRE-01 과 같은 규칙이다: 잇기 전에 «기존 결과» 를 먼저 못박고, 이은 뒤에
 * 값으로 대조한다. 원산지에서 순서가 반대인 것을 이 방식으로 잡았다.
 */

const ADMIN = join(__dirname, "..", "..", "..", "..", "..", "apps", "admin", "src", "app", "api");
const NAVER = readFileSync(join(ADMIN, "naver", "_lib", "resolve-context.ts"), "utf8").replace(/\r\n/g, "\n");
const COUPANG = readFileSync(join(__dirname, "..", "..", "coupang", "build-payload.ts"), "utf8");
const LOTTEON = readFileSync(join(__dirname, "..", "..", "lotteon", "build-payload.ts"), "utf8");

describe("① 세 채널이 «실제로» 공통 함수를 부른다", () => {
  it.each([
    ["스마트스토어", NAVER],
    ["쿠팡", COUPANG],
    ["롯데ON", LOTTEON],
  ])("%s", (_label, source) => {
    expect(source).toContain("resolveManufacturer(");
  });

  it("🔴 네이버의 옛 사슬이 남아 있지 않다", () => {
    expect(NAVER).not.toContain("brandProfile?.manufacturer || brandName || null");
    /* 값과 라벨을 «따로» 읽던 줄도 사라졌다 — 둘이 갈릴 자리를 없앴다. */
    expect(NAVER).not.toContain('brandProfile?.manufacturer ? "BRAND_DEFAULT"');
  });
});

describe("🔴 ② 값이 바뀌지 않는다 — 옛 조건과 대조", () => {
  const legacyValue = (brand?: string, brandName?: string) => brand || brandName || null;
  const legacySource = (brand?: string, brandName?: string) =>
    brand ? "BRAND_DEFAULT" : brandName ? "PRODUCT_BRAND" : "NONE";

  const cases: [string | undefined, string | undefined][] = [
    ["Bobo Choses S.L.", "Bobo Choses"],
    [undefined, "Bobo Choses"],
    [undefined, undefined],
    ["", "Bobo Choses"],
    ["Bobo Choses S.L.", undefined],
    ["   ", "Bobo Choses"],
  ];

  it.each(cases)("브랜드프로필=%s · 브랜드명=%s 에서 값이 같다", (brand, brandName) => {
    const r = resolveManufacturer({ brandProfileManufacturer: brand, brandName });
    expect(r.value || null).toBe(legacyValue(brand?.trim() || undefined, brandName));
  });

  it.each(cases)("브랜드프로필=%s · 브랜드명=%s 에서 라벨도 같다", (brand, brandName) => {
    const r = resolveManufacturer({ brandProfileManufacturer: brand, brandName });
    expect(r.source).toBe(legacySource(brand?.trim() || undefined, brandName));
  });
});

describe("🔴 ③ 판매 사업자는 여전히 제조사가 아니다", () => {
  it("판매자 제조사를 넣어도 후보가 되지 않는다", () => {
    const input: Record<string, unknown> = { sellerProfileManufacturer: "규하맘샵" };
    expect(resolveManufacturer(input as never).source).toBe("NONE");
  });

  it("공통 설정의 제조사를 네이버 컨텍스트가 읽지 않는다", () => {
    /* 🔴 주석을 «벗기고» 본다. 이 저장소에서 같은 함정에 여덟 번 걸렸다 —
       「판매 사업자(sellerSettings.manufacturer)가 사라졌다」는 설명 주석이
       그대로 «사용» 으로 읽힌다. 실제로 이 검사를 쓰면서 또 한 번 걸렸다. */
    const code = NAVER.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toContain("sellerSettings.manufacturer");
  });
});
