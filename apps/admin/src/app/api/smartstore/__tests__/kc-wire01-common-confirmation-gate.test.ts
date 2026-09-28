import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toCommonConfirmation, type StoredComplianceConfirmation } from "@commerce/shared";
import { COMPLIANCE_POLICY_VERSION } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KC-WIRE-01 — 스마트스토어 게이트가 **공통 계약으로 같은 판정**을 내는가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 연결은 «규칙을 바꾸는 것이 아니다». 원래 게이트가 이랬다 —
 *
 *     row.confirmed === true
 *     && row.policyVersion === COMPLIANCE_POLICY_VERSION
 *     && row.categoryCode === leafCategoryId
 *
 * `toCommonConfirmation` 이 하는 일이 정확히 그것이고, 거기에 `platform` 대조가
 * 하나 더 있다. 이 테이블은 지금 `"smartstore"` 하드코딩으로만 쓰이므로 실제
 * 결과는 같고, 다른 채널의 확인이 섞여 들어올 때만 «막는» 쪽으로 다르다.
 *
 * 그래서 이 파일이 재는 것은 「새 기능이 도는가」가 아니라
 * **「옛 판정과 한 칸도 다르지 않은가」** 다.
 */

const ROUTE = readFileSync(join(__dirname, "..", "register", "route.ts"), "utf8").replace(/\r\n/g, "\n");
/** 🔴 주석을 벗기고 본다 — 이 저장소에서 같은 함정에 여덟 번 걸렸다. */
const codeOf = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CATEGORY = "50000167";
const stored = (patch: Partial<StoredComplianceConfirmation> = {}): StoredComplianceConfirmation => ({
  confirmed: true,
  policyVersion: COMPLIANCE_POLICY_VERSION,
  confirmedAt: "2026-09-28T00:00:00Z",
  platform: "smartstore",
  categoryCode: CATEGORY,
  ...patch,
});

const scope = { platform: "smartstore", categoryCode: CATEGORY, policyVersion: COMPLIANCE_POLICY_VERSION };

/** 옛 게이트 그대로. 🔴 이것이 «바뀌면 안 되는 기준» 이다. */
const legacyGate = (row: StoredComplianceConfirmation | null) =>
  row?.confirmed === true && row.policyVersion === COMPLIANCE_POLICY_VERSION && row.categoryCode === CATEGORY;

describe("① CPO 지정 4상태 — 옛 게이트와 «1:1» 이다", () => {
  it.each([
    ["확인 없음", null],
    ["확인 + 동일 정책 + 동일 카테고리", stored()],
    ["확인 + 다른 정책", stored({ policyVersion: "2020-01-01" })],
    ["확인 + 다른 카테고리", stored({ categoryCode: "50000999" })],
  ])("%s", (_label, row) => {
    const common = toCommonConfirmation(row, scope) !== null;
    expect(common).toBe(legacyGate(row));
  });

  it("「확인했다고 기록만 남은」 행은 통과시키지 않는다", () => {
    const row = stored({ confirmed: false });
    expect(toCommonConfirmation(row, scope)).toBeNull();
    expect(legacyGate(row)).toBe(false);
  });
});

describe("🔴 ② 달라지는 곳은 «채널 대조» 하나뿐이고, 막는 쪽이다", () => {
  it("다른 채널의 확인은 공통 계약이 막는다", () => {
    const foreign = stored({ platform: "lotteon" });
    expect(toCommonConfirmation(foreign, scope)).toBeNull();
    /* 🔴 옛 게이트는 platform 을 보지 않아 통과시켰다 — 안전한 방향으로만 다르다. */
    expect(legacyGate(foreign)).toBe(true);
  });

  it("실제로는 결과가 같다 — 이 테이블에 다른 채널이 들어가지 않는다", () => {
    const writer = readFileSync(join(__dirname, "..", "seller-compliance", "route.ts"), "utf8");
    expect(codeOf(writer)).toContain('platform: "smartstore"');
  });
});

describe("🔴 ③ 두 `kcStatus` 를 섞지 않는다", () => {
  it("공통 확인 결과에 kcStatus 가 «없다»", () => {
    const row = { ...stored(), kcStatus: "SELLER_REVIEW_REQUIRED" } as StoredComplianceConfirmation;
    expect(Object.keys(toCommonConfirmation(row, scope)!)).not.toContain("kcStatus");
  });

  it("🔴 게이트가 저장된 kcStatus 를 판정에 쓰지 않는다", () => {
    const code = codeOf(ROUTE);
    /* 로그·결과 메타에 담는 것은 괜찮다. «조건문» 에 쓰면 안 된다. */
    expect(code).not.toMatch(/if\s*\([^)]*ComplianceConfirmationRow[^)]*\.kcStatus/);
    expect(code).not.toMatch(/sellerConfirmationValid[^\n]*kcStatus/);
  });

  it("Readiness 가 쓰는 것은 «지금 계산한» kcStatus 다", () => {
    const readiness = readFileSync(
      join(__dirname, "..", "..", "snapshots", "_lib", "compute-readiness.ts"),
      "utf8",
    );
    expect(codeOf(readiness)).toContain("resolveRegistrationReadinessState(summary, priceValid, validation.kcStatus)");
  });
});

describe("④ 게이트가 실제로 공통 계약을 «부른다»", () => {
  it("register 라우트가 toCommonConfirmation 을 쓴다", () => {
    const code = codeOf(ROUTE);
    expect(code).toContain("toCommonConfirmation(sellerComplianceConfirmationRow, {");
    expect(code).toContain("const sellerConfirmationValid = sellerConfirmation !== null;");
  });

  it("🔴 옛 3줄 판정이 남아 있지 않다 — 두 벌이 되면 한쪽만 바뀐다", () => {
    const code = codeOf(ROUTE);
    expect(code).not.toContain("sellerComplianceConfirmationRow?.confirmed === true &&");
  });

  it("범위 세 축을 그대로 넘긴다", () => {
    const code = codeOf(ROUTE);
    expect(code).toContain('platform: "smartstore"');
    expect(code).toContain("categoryCode: leafCategoryId");
    expect(code).toContain("policyVersion: COMPLIANCE_POLICY_VERSION");
  });
});
