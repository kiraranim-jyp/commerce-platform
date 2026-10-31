import { describe, expect, it } from "vitest";
import {
  canonicalListingKey,
  identifyingParams,
  isSameListingReference,
  isSelfReferenceCandidate,
  productHandle,
} from "../self-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SELF-REFERENCE-NARROW-FIX-04 — 경계 6 + 보호 3 + owner 1 (CPO 2026-10-31)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 정책: `same host AND same product handle AND same identifying parameters`.
 *    locale 차이는 자기참조를 **깨지 않는다**. 식별 파라미터는 **보존** 한다.
 * 🔴 `canonicalListingKey` 변경 0 · 시장 분류 변경 0.
 */

const ORIGIN =
  "https://www.junioredition.com/en-kr/collections/4-years/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses?utm_source=chatgpt.com";

describe("SL-03 경계 — 자기참조여야 한다", () => {
  /** 🔴🔴 ① locale 만 다름 — **실측 쌍**. 전에는 `false` 였다. */
  it("① 동일 host + 동일 handle + locale 만 다름 → true", () => {
    const self = "https://junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
    expect(isSameListingReference(ORIGIN, self)).toBe(true);
    expect(isSelfReferenceCandidate(ORIGIN, self)).toBe(true);
  });

  /** ② utm 만 다름 — 비식별 파라미터는 비교에서 무시한다. */
  it("② 동일 host + 동일 handle + utm 만 다름 → true", () => {
    const a = "https://junioredition.com/products/x?utm_source=a&utm_medium=b";
    const b = "https://junioredition.com/products/x";
    expect(isSameListingReference(a, b)).toBe(true);
    expect(isSelfReferenceCandidate(a, b)).toBe(true);
  });

  /** ③ 식별 파라미터가 **같으면** 자기참조다(locale 이 달라도). */
  it("③ 동일 host + 동일 handle + 동일 식별 파라미터 → true", () => {
    const a = "https://junioredition.com/en-kr/products/x?variant=777";
    const b = "https://www.junioredition.com/products/x?variant=777&utm_source=z";
    expect(isSameListingReference(a, b)).toBe(true);
    expect(isSelfReferenceCandidate(a, b)).toBe(true);
  });
});

describe("SL-03 경계 — 자기참조가 아니어야 한다", () => {
  /**
   * 🔴🔴🔴 ④ **1차 구현을 STOP 시킨 그 모양.**
   *    `?variant=` 는 실제 listing 식별자다 — 다르면 **다른 상품** 이다.
   */
  it("④ 동일 host + 동일 handle + variant 가 다름 → false", () => {
    const a = "https://junioredition.com/products/x?variant=1";
    const b = "https://junioredition.com/products/x?variant=2";
    expect(isSameListingReference(a, b)).toBe(false);
    expect(isSelfReferenceCandidate(a, b)).toBe(false);
    /** 🔴 한쪽에만 식별자가 있어도 다른 listing 이다. */
    expect(isSameListingReference("https://junioredition.com/products/x", a)).toBe(false);
    /** 🔴 메이크샵 계열 식별자(`branduid`)도 같은 성질이다. */
    expect(
      isSelfReferenceCandidate(
        "https://foretforet.com/products/x?branduid=1",
        "https://foretforet.com/products/x?branduid=2",
      ),
    ).toBe(false);
  });

  /** ⑤ 같은 판매처의 **다른 상품** 은 정상 후보다(CPO 명시). */
  it("⑤ 동일 host + 서로 다른 handle → false", () => {
    expect(
      isSameListingReference(ORIGIN, "https://junioredition.com/products/booty-ghosts-t-shirt-by-bobo-choses"),
    ).toBe(false);
    /** 🟢 AB046(실측 POSSIBLE 후보)은 후보로 **남아야** 한다. */
    expect(isSelfReferenceCandidate(ORIGIN, "https://bobochoses.com/products/b226ab046-booty-ghosts-t-shirt")).toBe(
      false,
    );
    /** 🟢 `self-reference.ts` 머리 주석이 지키라고 적어 둔 그 쌍(ac042 ↔ ac043). */
    expect(
      isSelfReferenceCandidate(
        "https://bobochoses.com/en-kr/products/b226ac043-x",
        "https://bobochoses.com/products/b226ac042-x",
      ),
    ).toBe(false);
  });

  /** ⑥ 다른 판매처의 같은 handle 은 경쟁 후보다 — 그것이 비교의 목적이다. */
  it("⑥ 서로 다른 host → false", () => {
    const rival = "https://cissywears.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
    expect(isSameListingReference(ORIGIN, rival)).toBe(false);
    expect(isSelfReferenceCandidate(ORIGIN, rival)).toBe(false);
  });
});

describe("SL-03 보호 — 기존 동작이 그대로다", () => {
  /** 🔴 보호 ① handle 을 지어내지 않는다 — 모양이 아니면 발화하지 않는다. */
  it("보호① 상품 handle 이 없으면 발화하지 않는다", () => {
    for (const u of [
      "https://junioredition.com/collections/bobo-choses",
      "https://junioredition.com/products/",
      "https://junioredition.com/products/x/reviews",
      "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
      "ftp://junioredition.com/products/x",
      "not-a-url",
      "",
    ]) {
      expect(productHandle(u), u).toBeNull();
      expect(isSameListingReference(ORIGIN, u), u).toBe(false);
    }
    expect(isSameListingReference(null, ORIGIN)).toBe(false);
    expect(isSameListingReference(ORIGIN, undefined)).toBe(false);
  });

  /**
   * 🔴🔴 보호 ② **`canonicalListingKey` 가 그대로라는 증거.**
   *    그 함수는 **여전히** 로케일과 식별자를 구분한다 ⟹ 시장 분류 정책 보존.
   */
  it("보호② canonicalListingKey 는 여전히 로케일과 식별자를 구분한다", () => {
    const a = canonicalListingKey("https://junioredition.com/en-kr/products/x");
    const b = canonicalListingKey("https://junioredition.com/products/x");
    expect(a?.host).toBe(b?.host);
    expect(a?.key, "로케일이 접혔다 — 시장 분류 정책이 바뀐 것이다").not.toBe(b?.key);
    expect(canonicalListingKey("https://j.com/products/x?variant=1")?.key).not.toBe(
      canonicalListingKey("https://j.com/products/x?variant=2")?.key,
    );
  });

  /** 🔴 보호 ③ WU-008A 의 목록 세그먼트 축이 **여전히** 발화한다. */
  it("보호③ collections 세그먼트 축 보존", () => {
    expect(
      isSelfReferenceCandidate(
        "https://junioredition.com/collections/bobo-choses/products/x",
        "https://junioredition.com/products/x",
      ),
    ).toBe(true);
    expect(isSelfReferenceCandidate(ORIGIN, ORIGIN)).toBe(true);
  });
});

describe("SL-03 owner — identifyingParams 는 «추출» 이다", () => {
  /**
   * 🔴🔴 새 규칙이 아니라는 증거 — `canonicalListingKey` 의 `key` 가 이 함수 산출로
   *    **그대로** 조립된다는 것을 직접 단언한다(의미 분기 금지).
   */
  it("identifyingParams 가 canonicalListingKey 의 key 와 같은 의미다", () => {
    for (const raw of [
      "https://j.com/products/x?variant=7&utm_source=a&sort=&_pos=2",
      "https://j.com/products/x?branduid=10&search=%EC%8B%A0%EB%B0%9C&gfdt=abc",
      "https://j.com/products/x",
    ]) {
      const params = identifyingParams(new URL(raw));
      const expected = params.length > 0 ? `/products/x?${params.join("&")}` : "/products/x";
      expect(canonicalListingKey(raw)!.key, raw).toBe(expected);
    }
  });
});
