import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "../product-types";
import { blocksRegistration, payloadStockQuantity, resolveSourceStock } from "../source-stock";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-2E — **원본 재고는 «사실» 이고, 모른다는 것은 품절이 아니다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 확정 정책(2026-09-26):
 *
 *     원본 재고 > 0      등록 가능
 *     원본 재고 = 0      🔴 등록 «차단»
 *     비정상값           차단 — 원본 확인 필요
 *     UNKNOWN            🔴 임의 보정 금지. 다만 «막지도 않는다»
 *     판매 여부·가격     셀러가 결정한다(시스템이 대신 판단하지 않는다)
 *
 * ── 이 파일이 막으려는 것 ──────────────────────────────────────────────────
 * 같은 함정에 두 번 빠졌다.
 *   C-2D 전  naver 빌더의 `|| 1` 이 0 을 1 로 바꿔서 검증기를 무효화했다
 *   C-2D 후  내가 쓴 `product.stockQuantity.value > 0` 도 무효였다 —
 *            그 값은 사실상 언제나 999(파이프라인 DEFAULT)다
 *
 * 🔴 두 번 다 원인이 같다: **「값이 있다」를 「사실이다」로 읽었다.**
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 1 };
}

function product(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    stockQuantity: field(999, "DEFAULT"),
    variants: [],
    ...overrides,
  } as CanonicalProduct;
}

const variant = (id: string, stockQuantity?: number) =>
  ({ id, optionValues: {}, ...(stockQuantity === undefined ? {} : { stockQuantity }) }) as CanonicalProduct["variants"][number];

describe("① 옵션의 실측이 «원본의 사실» 이다", () => {
  it("옵션 재고 합이 0보다 크면 IN_STOCK", () => {
    const fact = resolveSourceStock(product({ variants: [variant("a", 0), variant("b", 3)] }));
    expect(fact.state).toBe("IN_STOCK");
    expect(fact.quantity).toBe(3);
    expect(fact.from).toBe("VARIANTS");
  });

  /* 🔴 상품 레벨이 999 여도 옵션이 전부 품절이면 품절이다 — C-2D 규칙이
     놓쳤던 바로 그 경우다. */
  it("옵션이 전부 0 이면 OUT_OF_STOCK — 상품 레벨 999 에 속지 않는다", () => {
    const fact = resolveSourceStock(product({ variants: [variant("a", 0), variant("b", 0)] }));
    expect(fact.state).toBe("OUT_OF_STOCK");
    expect(blocksRegistration(fact)).toBe(true);
    expect(fact.note).toContain("등록할 수 없습니다");
  });

  /* 수량을 «안 준» 옵션을 0 으로 세지 않는다 — 모르는 것을 품절로 만들지 않는다. */
  it("수량 없는 옵션은 0 으로 세지 않는다", () => {
    const fact = resolveSourceStock(product({ variants: [variant("a"), variant("b", 2)] }));
    expect(fact.state).toBe("IN_STOCK");
    expect(fact.quantity).toBe(2);
  });

  it("옵션이 전부 수량을 안 주면 UNKNOWN 이다", () => {
    expect(resolveSourceStock(product({ variants: [variant("a"), variant("b")] })).state).toBe("UNKNOWN");
  });

  it("음수는 INVALID — 차단하되 «품절» 이라고 하지 않는다", () => {
    const fact = resolveSourceStock(product({ variants: [variant("a", -1)] }));
    expect(fact.state).toBe("INVALID");
    expect(blocksRegistration(fact)).toBe(true);
    expect(fact.note).toContain("올바르지 않습니다");
  });
});

describe("② 🔴 999 는 「재고 있음」이 아니라 「모른다」다", () => {
  it("DEFAULT 999 는 UNKNOWN", () => {
    const fact = resolveSourceStock(product());
    expect(fact.state).toBe("UNKNOWN");
    expect(fact.quantity).toBeNull();
  });

  it("🔴 UNKNOWN 은 등록을 막지 않는다 — 모른다는 것은 품절이 아니다", () => {
    expect(blocksRegistration(resolveSourceStock(product()))).toBe(false);
  });

  /* hydrate 폴백 `emptyField(0)` 은 값이 0 이고 source 가 REQUIRED 다.
     🔴 그냥 읽으면 «품절» 로 오해되고, 그 오해는 등록을 막으므로 더 나쁘다. */
  it("REQUIRED 0(출처 없음)은 품절이 아니라 UNKNOWN", () => {
    const fact = resolveSourceStock(product({ stockQuantity: field(0, "REQUIRED") }));
    expect(fact.state).toBe("UNKNOWN");
    expect(blocksRegistration(fact)).toBe(false);
  });

  it("실측 0(ORIGINAL/USER_EDITED)은 품절이다", () => {
    for (const source of ["ORIGINAL", "USER_EDITED"] as const) {
      const fact = resolveSourceStock(product({ stockQuantity: field(0, source) }));
      expect(fact.state, source).toBe("OUT_OF_STOCK");
    }
  });
});

describe("③ 🔴 payload 는 보정하지 않는다", () => {
  it("품절이면 0 이 그대로 나간다 — 1 로 올리지 않는다", () => {
    expect(payloadStockQuantity(product({ variants: [variant("a", 0)] }))).toBe(0);
    expect(payloadStockQuantity(product({ stockQuantity: field(0, "ORIGINAL") }))).toBe(0);
  });

  it("실측이 있으면 그 수량이 나간다", () => {
    expect(payloadStockQuantity(product({ variants: [variant("a", 4), variant("b", 6)] }))).toBe(10);
  });

  it("UNKNOWN 이면 기존 값을 그대로 둔다 — 새 숫자를 지어내지 않는다", () => {
    expect(payloadStockQuantity(product())).toBe(999);
  });
});

describe("④ 🔴 `|| 1` 류 보정이 세 채널 어디에도 없다", () => {
  const ROOT = join(__dirname, "..", "..", "..");
  const FILES = [
    ["스마트스토어", join(ROOT, "listing", "src", "naver", "build-payload.ts")],
    ["쿠팡", join(ROOT, "listing", "src", "coupang", "build-payload.ts")],
    ["롯데ON", join(ROOT, "listing", "src", "lotteon", "build-payload.ts")],
  ] as const;

  it.each(FILES)("%s 빌더가 재고에 `||` 보정을 쓰지 않는다", (_label, path) => {
    const source = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    /* 주석은 이 변경을 «설명» 하느라 같은 문구를 쓴다 — 코드만 본다. */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/stock[A-Za-z]*\s*[:=][^\n;,]*\|\|\s*\d/i);
  });

  it("해석은 이 파일 하나에서만 한다 — 채널이 각자 규칙을 만들지 않는다", () => {
    for (const [label, path] of FILES) {
      const code = readFileSync(path, "utf8");
      /* 채널 파일이 `product.stockQuantity.value > 0` 같은 «자기 판정» 을 다시
         쓰면 C-2D 의 실수가 반복된다. 판정은 resolveSourceStock 만 한다. */
      expect(code, label).not.toMatch(/stockQuantity\.value\s*>\s*0/);
    }
  });
});
