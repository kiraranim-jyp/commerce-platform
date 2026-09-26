import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { NaverPayloadValidationResult } from "@commerce/listing";
import { computeNaverPayloadReadiness } from "../readiness";
import { classifyMissing, missingKindLabel } from "../commerce-registry";
import { lotteOnFixLocationToMissingKind } from "../lotteon-channel-form";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 Phase E — **셀러에게 «다시 입력하라»고 말하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Phase A 가 찾은 두 가지 균열을 닫는다.
 *
 *   ① readiness.ts 가 스마트스토어의 «전 필드» 에 MANUAL_REQUIRED 를 박았다.
 *      그래서 classifyMissing() 이 every(MANUAL_REQUIRED) 로 판정하는 순간
 *      스마트스토어는 «영원히» 「입력 필요」였다 — 출고지·반품지·택배사·
 *      반품/교환배송비·품질보증·A/S 가 Settings 에 이미 있어도.
 *
 *   ② 롯데ON 은 「어디서 고치는가」를 네 갈래로 알고 있는데(LotteOnFixLocation)
 *      상위 목록으로 올라오면서 그 정보가 버려져 배지가 아예 안 나왔다.
 *
 * 🔴 새 상태 축을 만들지 않았다. `AUTO` 도 쓰지 않았다 — 그 값은 「채워졌다」는
 * 뜻인데 sourceStatus 는 passed 항목에 붙지 않는다(규칙을 넓히지 않았다).
 */

function naverField(field: string, status: "READY" | "MISSING" | "BLOCKED") {
  return status === "READY" ? { field, status } : { field, status, reason: "테스트 사유" };
}

function naverValidation(
  fields: { field: string; status: "READY" | "MISSING" | "BLOCKED"; reason?: string }[],
): NaverPayloadValidationResult {
  return {
    ok: fields.every((f) => f.status === "READY"),
    readyCount: fields.filter((f) => f.status === "READY").length,
    missingCount: fields.filter((f) => f.status === "MISSING").length,
    blockedCount: fields.filter((f) => f.status === "BLOCKED").length,
    fields,
    issues: [],
    advisoryNotes: [],
    kcStatus: "NOT_APPLICABLE",
  } as unknown as NaverPayloadValidationResult;
}

const sourceStatusOf = (result: ReturnType<typeof computeNaverPayloadReadiness>, label: string) =>
  result.items.find((i) => i.label === label)?.sourceStatus;

describe("E-2 — Settings 에서 해결되는 네이버 필드는 「직접 입력」이 아니다", () => {
  /* 🔴 라벨은 readiness.ts 의 NAVER_FIELD_LABEL 이 정한다. 여기서 새로 짓지 않고
     그 표가 쓰는 글자를 그대로 기대한다. */
  const SETTINGS_FIELDS: [field: string, label: string][] = [
    ["claimDeliveryInfo.shippingAddressId", "출고지 주소"],
    ["claimDeliveryInfo.returnAddressId", "반품지 주소"],
    ["deliveryInfo.deliveryCompany", "출고 택배사"],
    ["claimDeliveryInfo.returnDeliveryFee", "반품 배송비"],
    ["claimDeliveryInfo.exchangeDeliveryFee", "교환 배송비"],
  ];

  it.each(SETTINGS_FIELDS)("%s → SETTINGS_DEFAULT", (field, label) => {
    const summary = computeNaverPayloadReadiness(naverValidation([naverField(field, "MISSING")]));
    expect(sourceStatusOf(summary, label)).toBe("SETTINGS_DEFAULT");
  });

  it("고시정보의 품질보증기준·A/S 책임자도 Settings 에서 채운다", () => {
    const summary = computeNaverPayloadReadiness(
      naverValidation([
        naverField("productInfoProvidedNotice(WEAR).warrantyPolicy", "MISSING"),
        naverField("productInfoProvidedNotice(WEAR).afterServiceDirector", "MISSING"),
      ]),
    );
    for (const item of summary.items) expect(item.sourceStatus).toBe("SETTINGS_DEFAULT");
  });

  /* 🔴 이 한 줄이 Phase A 가 찾은 «빠진 곳» 이다. detailAttribute. 로 시작해서
     기존 두 규칙(prefix · 고시 suffix) 어디에도 걸리지 않았는데, validate-payload 의
     사유는 「Settings 의 판매자 정보 탭에서 … 입력하면 해결됩니다」였다. */
  it("A/S 전화번호도 Settings 필드다 — 예전엔 어디에도 안 걸렸다", () => {
    const summary = computeNaverPayloadReadiness(
      naverValidation([naverField("detailAttribute.afterServiceInfo.afterServiceTelephoneNumber", "MISSING")]),
    );
    expect(summary.items[0]?.sourceStatus).toBe("SETTINGS_DEFAULT");
    expect(summary.items[0]?.externalHref).toBe("/settings");
  });
});

describe("E-2 — 정말 셀러가 적어야 하는 것은 그대로 MANUAL_REQUIRED 다", () => {
  const MANUAL_FIELDS: [field: string, label: string][] = [
    ["productInfoProvidedNotice(KIDS).certificationType", "인증구분"],
    ["naverShoppingSearchInfo.modelName", "네이버 쇼핑 카탈로그 모델명"],
    ["productInfoProvidedNotice(WEAR).material", "소재"],
  ];

  it.each(MANUAL_FIELDS)("%s → MANUAL_REQUIRED", (field, label) => {
    const summary = computeNaverPayloadReadiness(naverValidation([naverField(field, "MISSING")]));
    expect(sourceStatusOf(summary, label)).toBe("MANUAL_REQUIRED");
  });

  it("통과한 필드에는 sourceStatus 를 붙이지 않는다 — 규칙을 넓히지 않았다", () => {
    const summary = computeNaverPayloadReadiness(
      naverValidation([naverField("claimDeliveryInfo.shippingAddressId", "READY")]),
    );
    expect(summary.items[0]?.sourceStatus).toBeUndefined();
  });
});

describe("E-2 — classifyMissing 이 드디어 「확인 필요」를 말할 수 있다", () => {
  it("설정 필드만 비면 CONFIRM — 예전에는 every(MANUAL_REQUIRED) 라 늘 INPUT 이었다", () => {
    const summary = computeNaverPayloadReadiness(
      naverValidation([naverField("claimDeliveryInfo.shippingAddressId", "MISSING")]),
    );
    const statuses = summary.items.map((i) => i.sourceStatus);
    expect(classifyMissing(statuses)).toBe("CONFIRM");
    expect(classifyMissing(statuses)).not.toBe("INPUT");
  });

  it("상품 필드가 섞이면 여전히 INPUT 이 아니다 — 하나라도 근거가 있으면 CONFIRM", () => {
    const summary = computeNaverPayloadReadiness(
      naverValidation([
        naverField("claimDeliveryInfo.shippingAddressId", "MISSING"),
        naverField("productInfoProvidedNotice(WEAR).material", "MISSING"),
      ]),
    );
    expect(classifyMissing(summary.items.map((i) => i.sourceStatus))).toBe("CONFIRM");
  });

  it("전부 상품 필드면 INPUT 그대로", () => {
    const summary = computeNaverPayloadReadiness(
      naverValidation([naverField("productInfoProvidedNotice(WEAR).material", "MISSING")]),
    );
    expect(classifyMissing(summary.items.map((i) => i.sourceStatus))).toBe("INPUT");
  });
});

describe("E-3 — 롯데ON 의 「어디서 고치는가」를 버리지 않는다", () => {
  it("판매자센터에서만 생기는 값은 「입력 필요」가 아니다", () => {
    expect(lotteOnFixLocationToMissingKind("LOTTEON_SELLER_CENTER")).toBe("SELLER_CENTER");
    expect(missingKindLabel("SELLER_CENTER")).toBe("판매자센터 등록 필요");
  });

  it("설정에서 해결되는 값은 CONFIRM", () => {
    expect(lotteOnFixLocationToMissingKind("SETTINGS")).toBe("CONFIRM");
  });

  it("우리 화면에 적는 값은 INPUT", () => {
    expect(lotteOnFixLocationToMissingKind("COMMON_PRODUCT")).toBe("INPUT");
    expect(lotteOnFixLocationToMissingKind("LOTTEON_TAB")).toBe("INPUT");
  });

  it("🔴 출고지·반품지·배송비정책은 LOTTEON_SELLER_CENTER 로 분류돼 있다", () => {
    const source = readFileSync(join(__dirname, "..", "lotteon-channel-form.ts"), "utf8");
    for (const key of ["owhpNo", "rtrpNo", "dvCstPolNo"]) {
      const block = source.slice(source.indexOf(`  ${key}: {`));
      expect(block.slice(0, 600), key).toContain('where: "LOTTEON_SELLER_CENTER"');
    }
  });

  it("🔴 CommerceWorkspace 가 where 를 kind 로 옮긴다 — 예전엔 버렸다", () => {
    const source = readFileSync(join(__dirname, "..", "..", "CommerceWorkspace.tsx"), "utf8");
    expect(source).toContain("kind: lotteOnFixLocationToMissingKind(item.where)");
  });
});

describe("E-4 — AUTO 는 쓰지 않는다(타입을 억지로 살리지 않는다)", () => {
  it("readiness.ts 가 sourceStatus 로 AUTO 를 부여하지 않는다", () => {
    const source = readFileSync(join(__dirname, "..", "readiness.ts"), "utf8");
    expect(source).not.toMatch(/sourceStatus:\s*\(?"AUTO"/);
  });

  it("「passed 에는 표시하지 않는다」는 규칙 문장이 그대로 남아 있다", () => {
    const source = readFileSync(join(__dirname, "..", "readiness.ts"), "utf8");
    expect(source).toContain("통과(passed=true)한 항목엔 표시하지 않는다");
  });
});
