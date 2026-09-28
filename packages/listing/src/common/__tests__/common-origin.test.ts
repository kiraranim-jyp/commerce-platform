import { describe, expect, it } from "vitest";
import { resolveCommonReadiness, type CommonField } from "@commerce/shared";
import { resolveCommonOrigin, ORIGIN_SOURCE_POLICY, ORIGIN_CHANNEL_BINDINGS } from "../origin";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMMON v1 — 원산지 하나로 «층이 실제로 도는지» 를 본다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 파일이 지키는 것은 값이 아니라 «경계» 다 —
 *   · Common 은 이름만 갖는다 (채널 코드를 만들지 않는다)
 *   · 관용 기본값을 제조국에 채우지 않는다
 *   · 값이 있다는 것과 판매자가 확인했다는 것은 다른 칸이다
 *   · 요구도와 결과 상태를 섞지 않는다
 */

describe("① 사다리 — 상품이 먼저, 없으면 판매자, 그다음 브랜드", () => {
  it("상품정보의 원산지를 쓴다", () => {
    const field = resolveCommonOrigin({ product: { value: "Spain", source: "ORIGINAL" } });
    expect(field.value).toBe("Spain");
    expect(field.valueState).toBe("VALUE");
    expect(field.source).toBe("COMMON_PRODUCT");
    /* 🔴 출처 축을 섞지 않는다 — 어느 계층이 줬나(source)와 어떻게 생겼나(provenance). */
    expect(field.provenance).toBe("ORIGINAL");
  });

  it("상품에 없으면 판매자 설정 기본값", () => {
    const field = resolveCommonOrigin({ sellerDefault: "스페인", brandDefault: "이탈리아" });
    expect(field.value).toBe("스페인");
    expect(field.source).toBe("SELLER_SETTINGS");
  });

  it("판매자 설정에도 없으면 브랜드 기본값", () => {
    const field = resolveCommonOrigin({ brandDefault: "이탈리아" });
    expect(field.value).toBe("이탈리아");
    expect(field.source).toBe("SELLER_SETTINGS");
  });

  it("상품 값이 있으면 기본값이 «덮지 못한다»", () => {
    const field = resolveCommonOrigin({
      product: { value: "Spain", source: "ORIGINAL" },
      sellerDefault: "대한민국",
      brandDefault: "이탈리아",
    });
    expect(field.value).toBe("Spain");
  });
});

describe("🔴 ② 값을 만들지 않는다", () => {
  it("아무 데도 없으면 MISSING 이고 값은 null 이다", () => {
    const field = resolveCommonOrigin({});
    expect(field.valueState).toBe("MISSING");
    expect(field.value).toBeNull();
    /* 🔴 빈 문자열로 「있는 척」하지 않는다. */
    expect(field.value).not.toBe("");
  });

  it("공백만 있는 값은 값이 아니다", () => {
    expect(resolveCommonOrigin({ product: { value: "   " } }).valueState).toBe("MISSING");
  });

  it("🔴 제조국에는 관용 기본값을 허용하지 않는다", () => {
    expect(ORIGIN_SOURCE_POLICY.defaultAllowed).toBe(false);
    expect(ORIGIN_SOURCE_POLICY.allowedSources).not.toContain("DEFAULT");
    /* 정책에 근거를 적게 강제한다. */
    expect(ORIGIN_SOURCE_POLICY.rationale).toContain("법률상 중요정보");
  });
});

describe("🔴 ③ 값과 확인은 «다른 칸» 이다", () => {
  it("값이 있어도 확인 기록이 없으면 confirmation 은 null 이다", () => {
    const field = resolveCommonOrigin({ product: { value: "Spain" } });
    expect(field.valueState).toBe("VALUE");
    expect(field.confirmation).toBeNull();
  });

  it("확인 기록은 정책 버전과 함께 실린다", () => {
    const field = resolveCommonOrigin({
      product: { value: "Spain" },
      confirmation: { confirmedAt: "2026-09-28T00:00:00Z", policyVersion: "2026-08-19" },
    });
    expect(field.confirmation?.policyVersion).toBe("2026-08-19");
  });
});

describe("🔴 ④ Common 은 «이름» 만 갖는다 — 채널 코드를 만들지 않는다", () => {
  it("결과 어디에도 채널 코드가 없다", () => {
    const body = JSON.stringify(resolveCommonOrigin({ product: { value: "Spain" } }));
    for (const code of ["ES", "oplcCd", "originAreaCode", "OPLC_CD"]) {
      expect(body).not.toContain(code);
    }
  });

  it("세 채널의 표현 방식이 «표로» 적혀 있고 근거를 갖는다", () => {
    expect(ORIGIN_CHANNEL_BINDINGS.SMARTSTORE.payloadField).toBe("originAreaInfo.originAreaCode");
    expect(ORIGIN_CHANNEL_BINDINGS.COUPANG.strategy).toBe("SELLER_TYPED");
    expect(ORIGIN_CHANNEL_BINDINGS.LOTTEON.payloadField).toBe("oplcCd");
    for (const binding of Object.values(ORIGIN_CHANNEL_BINDINGS)) {
      expect(binding.evidence.length).toBeGreaterThan(20);
    }
  });

  it("🔴 롯데ON 은 «목록에서 고르는» 방식이다 — 텍스트를 코드로 추론하지 않는다", () => {
    expect(ORIGIN_CHANNEL_BINDINGS.LOTTEON.strategy).toBe("CHANNEL_LIST");
    expect(ORIGIN_CHANNEL_BINDINGS.LOTTEON.evidence).toContain("추론하지 않는다");
  });
});

describe("⑤ Readiness — 요구도와 결과 상태를 섞지 않는다", () => {
  const withValue = resolveCommonOrigin({ product: { value: "Spain" } });
  const empty = resolveCommonOrigin({});

  it("값이 있고 채널이 필수로 요구하면 READY", () => {
    expect(resolveCommonReadiness(withValue, { requirement: "REQUIRED" })).toBe("READY");
  });

  it("값이 없고 채널이 필수로 요구하면 BLOCKED", () => {
    expect(resolveCommonReadiness(empty, { requirement: "REQUIRED" })).toBe("BLOCKED");
  });

  it("🔴 판매자 확인이 필요한 필드는 값이 있어도 NEEDS_CONFIRMATION", () => {
    expect(resolveCommonReadiness(withValue, { requirement: "USER_CONFIRMATION" })).toBe("NEEDS_CONFIRMATION");
  });

  it("확인 기록이 있으면 그때 READY", () => {
    const confirmed = resolveCommonOrigin({
      product: { value: "Spain" },
      confirmation: { confirmedAt: "2026-09-28T00:00:00Z", policyVersion: "2026-08-19" },
    });
    expect(resolveCommonReadiness(confirmed, { requirement: "USER_CONFIRMATION" })).toBe("READY");
  });

  it("조건부 필수인데 조건이 «성립하지 않으면» 막지 않는다", () => {
    expect(resolveCommonReadiness(empty, { requirement: "CONDITIONAL_REQUIRED", conditionMet: false })).toBe("READY");
  });

  it("조건이 성립하면 그때 막는다", () => {
    expect(resolveCommonReadiness(empty, { requirement: "CONDITIONAL_REQUIRED", conditionMet: true })).toBe("BLOCKED");
  });
});

describe("🔴 ⑥ 쿠팡 WARNING 을 BLOCKED 로 «올리지 않는다»", () => {
  const withValue = resolveCommonOrigin({ product: { value: "Spain" } });

  it("WARNING 은 WARNING 으로 남는다 — 지금 등록되는 상품이 막히지 않는다", () => {
    expect(resolveCommonReadiness(withValue, { requirement: "REQUIRED", channelSignal: "WARNING" })).toBe("WARNING");
    expect(resolveCommonReadiness(withValue, { requirement: "OPTIONAL", channelSignal: "WARNING" })).toBe("WARNING");
  });

  it("ERROR 는 그대로 BLOCKED 다 — 채널 판정을 뒤집지 않는다", () => {
    expect(resolveCommonReadiness(withValue, { requirement: "OPTIONAL", channelSignal: "ERROR" })).toBe("BLOCKED");
  });
});

describe("🔴 ⑦ UNKNOWN 과 MISSING 을 섞지 않는다", () => {
  it("판단할 수 없는 값도 필수 필드에서는 막힌다 — 다만 상태가 다르다", () => {
    const unknown: CommonField<string> = {
      concept: "ORIGIN",
      value: null,
      valueState: "UNKNOWN",
      requirement: "REQUIRED",
      source: "MISSING",
      confirmation: null,
    };
    expect(resolveCommonReadiness(unknown, { requirement: "REQUIRED" })).toBe("BLOCKED");
    expect(unknown.valueState).not.toBe("MISSING");
  });
});
