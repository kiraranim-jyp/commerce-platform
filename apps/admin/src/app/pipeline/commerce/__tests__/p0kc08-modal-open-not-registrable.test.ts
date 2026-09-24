import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-08(CPO 확정, 2026-09-24) — **모달 OPEN ≠ 등록 허용**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 교착 ──────────────────────────────────────────────────────────────────
 *   KC 미확인 → 필수 미통과 → DRAFT → 모달 차단 → KC 확인 불가 → 계속 DRAFT
 *
 * KC 를 푸는 «유일한» 경로가 ④ 모달인데 그 모달이 KC 때문에 안 열렸다. 그리고
 * `openListingModal()` 이 조용히 return 해서 셀러에게는 「버튼이 고장났다」로
 * 보였다.
 *
 * ── 🔴 어떻게 풀었나 ──────────────────────────────────────────────────────
 * DRAFT 를 통째로 열지 «않았다»(N-3.60 회귀 금지). KC 판매자 확인이 필요한
 * 경우에만 연다. 그리고 열린 모달 안에서는 readinessBlockers 가 [등록 시작]을
 * 계속 막고 «무엇이 부족한지» 적는다.
 *
 *   연다 = 확인할 자리를 준다.   ≠   등록해도 된다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const DIR = join(__dirname, "..");
const MODAL = codeOnly(readFileSync(join(DIR, "ListingConfirmationModal.tsx"), "utf8"));
const MODAL_RAW = readFileSync(join(DIR, "ListingConfirmationModal.tsx"), "utf8");
const WORKSPACE = codeOnly(readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8"));

/** openListingModal() 의 실제 식을 그대로 옮긴 것. */
const opens = (status: string, tab: string, kcStatus: string | null) => {
  const kcReviewNeeded = tab === "smartstore" && kcStatus === "SELLER_REVIEW_REQUIRED";
  return !(status === "DRAFT" && !kcReviewNeeded);
};
/** 모달의 실제 식. */
const canRegister = (blockers: string[], kcConfirmed: boolean, kcStatus: string | null) => {
  const needsReview = kcStatus === "SELLER_REVIEW_REQUIRED" || kcStatus === "CERTIFIED_REFERENCE";
  const kcOk = kcStatus == null || (kcStatus !== "BLOCKED" && (!needsReview || kcConfirmed));
  return blockers.length === 0 && kcOk;
};

describe("① 모델이 실제 코드와 같은 식을 쓴다", () => {
  it("openListingModal 의 예외 조건", () => {
    const flat = WORKSPACE.replace(/\s+/g, " ");
    expect(flat).toContain(
      'const kcReviewNeeded = tab === "smartstore" && smartStoreValidation?.kcStatus === "SELLER_REVIEW_REQUIRED";',
    );
    expect(flat).toContain('if (effectiveListingStatus === "DRAFT" && !kcReviewNeeded) return;');
  });

  it("모달의 등록 게이트에 readiness 가 «추가» 됐다 — KC 게이트는 그대로", () => {
    expect(MODAL).toContain("const readinessOk = blockers.length === 0;");
    expect(MODAL).toContain(
      "generalConfirmed && priceInfoConfirmed && responsibilityConfirmed && kcRegistrable && coupangNoticeRegistrable && readinessOk && !submitting;",
    );
  });
});

describe("② Test A/B — 언제 열리는가", () => {
  it("🔴 A. SELLER_REVIEW_REQUIRED + DRAFT → 모달 OPEN", () => {
    expect(opens("DRAFT", "smartstore", "SELLER_REVIEW_REQUIRED")).toBe(true);
  });

  it("🔴 B. 일반 DRAFT → 차단 (N-3.60 그대로)", () => {
    expect(opens("DRAFT", "smartstore", null)).toBe(false);
    expect(opens("DRAFT", "smartstore", "NOT_APPLICABLE")).toBe(false);
    expect(opens("DRAFT", "smartstore", "CERTIFIED_REFERENCE")).toBe(false);
    expect(opens("DRAFT", "smartstore", "BLOCKED")).toBe(false);
  });

  it("🔴 DRAFT 를 통째로 열지 않았다 — 다른 탭은 예외가 없다", () => {
    expect(opens("DRAFT", "coupang", "SELLER_REVIEW_REQUIRED")).toBe(false);
  });

  it("준비된 상품은 예전처럼 열린다", () => {
    expect(opens("READY", "smartstore", null)).toBe(true);
    expect(opens("READY", "coupang", null)).toBe(true);
  });
});

describe("③ Test C/D — 열렸다고 등록되지 않는다", () => {
  it("🔴 C. KC 만 확인 → 여전히 등록 불가", () => {
    expect(canRegister(["원산지", "제조사"], true, "SELLER_REVIEW_REQUIRED")).toBe(false);
  });

  it("🔴 C. 부족 항목을 «적는다» — 조용히 막지 않는다", () => {
    expect(MODAL_RAW).toContain("아직 등록할 수 없습니다");
    expect(MODAL).toContain("blockers.slice(0, 5).map");
    expect(MODAL_RAW).toContain("KC 확인은 지금 하실 수 있습니다");
  });

  it("🔴 D. KC 확인 + 필수 충족 → 등록 가능", () => {
    expect(canRegister([], true, "SELLER_REVIEW_REQUIRED")).toBe(true);
  });

  it("필수는 충족했는데 KC 미확인 → 여전히 불가", () => {
    expect(canRegister([], false, "SELLER_REVIEW_REQUIRED")).toBe(false);
  });
});

describe("④ Test E/F — 기존 흐름 유지", () => {
  it("E. CERTIFIED_REFERENCE — 확인 필요는 그대로", () => {
    expect(canRegister([], false, "CERTIFIED_REFERENCE")).toBe(false);
    expect(canRegister([], true, "CERTIFIED_REFERENCE")).toBe(true);
  });

  it("F. NOT_APPLICABLE — KC 확인을 요구하지 않는다", () => {
    expect(canRegister([], false, "NOT_APPLICABLE")).toBe(true);
  });

  it("BLOCKED 는 확인해도 못 넘는다", () => {
    expect(canRegister([], true, "BLOCKED")).toBe(false);
  });
});

describe("⑤ Test G/H/I — 바꾸지 않은 것", () => {
  it("G. Single / Multi 가 같은 모달을 쓴다", () => {
    const multi = WORKSPACE.slice(
      WORKSPACE.indexOf("{multiConfirmOpen && ("),
      WORKSPACE.indexOf("{confirmingPlatform && listing && ("),
    );
    const single = WORKSPACE.slice(WORKSPACE.indexOf("{confirmingPlatform && listing && ("));
    expect(multi).toContain("<ListingConfirmationModal");
    expect(single).toContain("<ListingConfirmationModal");
    expect(single).toContain("readinessBlockers=");
  });

  it("🔴 H. confirmation 생성 시점이 그대로다 — [등록 시작]에서 1회", () => {
    expect(MODAL).toContain("if (!canConfirm) return;");
    expect(MODAL).toContain('fetch("/api/smartstore/seller-compliance"');
    expect(WORKSPACE).not.toContain("/api/smartstore/seller-compliance");
  });

  it("🔴 I. payload · KcStatus 모델을 건드리지 않았다", () => {
    const compliance = readFileSync(
      join(DIR, "../../../../../../packages/listing/src/naver/compliance.ts"),
      "utf8",
    );
    expect(compliance).toContain(
      'export type KcStatus = "NOT_APPLICABLE" | "CERTIFIED_REFERENCE" | "SELLER_REVIEW_REQUIRED" | "BLOCKED";',
    );
    expect(compliance).toContain('return hasFullCert ? "CERTIFIED_REFERENCE" : "SELLER_REVIEW_REQUIRED";');
    const build = readFileSync(
      join(DIR, "../../../../../../packages/listing/src/naver/build-payload.ts"),
      "utf8",
    );
    expect(build).not.toContain("readinessBlockers");
  });

  it("🔴 서버 게이트는 그대로다 — 화면을 믿지 않는다", () => {
    const route = codeOnly(readFileSync(join(DIR, "../../api/smartstore/register/route.ts"), "utf8"));
    expect(route).toContain("if (!sellerConfirmationValid) {");
    expect(route).toContain("await getLatestSellerComplianceConfirmation(snapshotId)");
  });
});
