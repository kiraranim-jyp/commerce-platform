import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_KC_EXEMPTION_TEXT, isComplianceCritical } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-03(CPO 확정 ㉯, 2026-09-24) — **따져가 대신 적은 문장을 판매자가 본다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 쿠팡의 KC 관련 고시 칸은 사람이 아무것도 안 하면 따져가
 * 「KC마크 없이 구매대행 가능한 품목」을 넣는다(A-12.3-P0-3, 현재 정책).
 * 실제 등록 11건이 전부 이 경로였고 — 사람이 override 를 넣은 건 0건 —
 * 그 문장을 판매자가 본 적은 한 번도 없다.
 *
 * ── 🔴 이번에 «하지 않은» 것 ──────────────────────────────────────────────
 * · 기본 문구를 바꾸거나 없애지 않았다(㉰ 아님). payload 값은 한 글자도 그대로다.
 * · KC 면제 여부를 판정하지 않는다. 어느 칸이 KC 칸인지조차 새로 정하지 않고
 *   빌더의 `isComplianceCritical()` 을 «그대로» 쓴다.
 * · 스마트스토어의 KcStatus / seller_compliance_confirmations 체계를 쿠팡에
 *   복사하지 않았다.
 *
 * ── 확인의 «뜻» ───────────────────────────────────────────────────────────
 * 「지금 등록될 문구가 무엇인지 확인했다」 하나뿐이다.
 * 「이 상품이 법적으로 KC 면제다」도, 「따져가 면제를 확인했다」도 아니다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const DIR = join(__dirname, "..");
const MODAL = codeOnly(readFileSync(join(DIR, "ListingConfirmationModal.tsx"), "utf8"));
const MODAL_RAW = readFileSync(join(DIR, "ListingConfirmationModal.tsx"), "utf8");
const WORKSPACE = codeOnly(readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8"));
const BUILDER = readFileSync(
  join(DIR, "../../../../../../packages/listing/src/coupang/build-payload.ts"),
  "utf8",
);

/** 모달의 실제 식을 그대로 옮긴 것. 식이 바뀌면 아래 문자열 검사가 깨진다. */
const canRegister = (
  notices: { autoFilled: boolean }[] | undefined,
  confirmed: boolean,
) => {
  const needsReview = (notices ?? []).filter((n) => n.autoFilled).length > 0;
  return !needsReview || confirmed;
};
const auto = { fieldName: "KC인증 여부", value: DEFAULT_KC_EXEMPTION_TEXT, autoFilled: true };
const typed = { fieldName: "KC인증 여부", value: "KC 안전확인 제12-345호", autoFilled: false };

describe("① Test 1/2 — 확인 전 차단 · 확인 후 허용", () => {
  it("모델이 화면 코드와 같은 식을 쓴다", () => {
    const flat = MODAL.replace(/\s+/g, " ");
    expect(flat).toContain("const autoFilledCoupangNotices = (coupangKcNotices ?? []).filter((n) => n.autoFilled);");
    expect(flat).toContain("const coupangNoticeNeedsReview = autoFilledCoupangNotices.length > 0;");
    expect(flat).toContain(
      "const coupangNoticeRegistrable = !coupangNoticeNeedsReview || coupangNoticeConfirmed;",
    );
  });

  it("🔴 Test 1 — 자동 입력 문구 있음 + 확인 안 함 → 차단", () => {
    expect(canRegister([auto], false)).toBe(false);
  });

  it("🔴 Test 2 — 확인함 → 허용", () => {
    expect(canRegister([auto], true)).toBe(true);
  });

  it("등록 버튼이 이 게이트를 실제로 탄다", () => {
    expect(MODAL).toContain("kcRegistrable && coupangNoticeRegistrable && !submitting");
    expect(MODAL).toContain("disabled={!canConfirm}");
    expect(MODAL).toContain("if (!canConfirm) return;");
  });

  it("🔴 사람이 «직접 넣은» 값은 다시 묻지 않는다 — 이미 판매자의 문장이다", () => {
    expect(canRegister([typed], false)).toBe(true);
  });

  it("Test 6 — KC 칸 자체가 없으면 아무것도 막지 않는다(일반 고시 fallback 과 충돌 없음)", () => {
    expect(canRegister([], false)).toBe(true);
    expect(canRegister(undefined, false)).toBe(true);
  });
});

describe("② Test 3 — payload 값이 바뀌지 않는다", () => {
  it("🔴 기본 문구는 그대로다", () => {
    expect(DEFAULT_KC_EXEMPTION_TEXT).toBe("KC마크 없이 구매대행 가능한 품목");
    expect(BUILDER).toContain('export const DEFAULT_KC_EXEMPTION_TEXT = "KC마크 없이 구매대행 가능한 품목";');
  });

  it("🔴 빌더의 값 결정 로직을 건드리지 않았다", () => {
    expect(BUILDER).toContain("value: context.kcExemptionText || DEFAULT_KC_EXEMPTION_TEXT,");
  });

  it("🔴 화면이 payload 를 만들지 않는다 — 표시 전용이다", () => {
    /* 확인 여부가 빌더로 흘러가면 「확인하면 값이 달라진다」가 되어버린다.
       coupangKcNotices 는 모달 안에서만 쓰인다. */
    expect(BUILDER).not.toContain("coupangKcNotices");
    expect(BUILDER).not.toContain("coupangNoticeConfirmed");
    const registerRoute = readFileSync(
      join(DIR, "../../api/coupang/register/route.ts"),
      "utf8",
    );
    expect(registerRoute).not.toContain("coupangNoticeConfirmed");
  });
});

describe("③ 🔴 판정하지 않는다 · 모델을 복사하지 않는다", () => {
  it("어느 칸이 KC 칸인지 화면이 «다시 정하지» 않는다 — 빌더 함수를 쓴다", () => {
    expect(WORKSPACE).toContain("isComplianceCritical(r.fieldName)");
    expect(WORKSPACE).toContain("  isComplianceCritical,");
    // 화면이 자기만의 키워드 목록을 만들지 않았다.
    expect(WORKSPACE).not.toContain('["kc", "인증"]');
  });

  it("규칙은 빌더 한 곳에만 있다", () => {
    expect(isComplianceCritical("KC인증 여부")).toBe(true);
    expect(isComplianceCritical("인증/허가 사항")).toBe(true);
    expect(isComplianceCritical("품명 및 모델명")).toBe(false);
  });

  it("🔴 스마트스토어 KC 체계를 쿠팡에 복사하지 않았다", () => {
    const coupangRoute = readFileSync(join(DIR, "../../api/coupang/register/route.ts"), "utf8");
    for (const forbidden of ["isKcStatusRegistrable", "resolveKcStatus", "seller_compliance_confirmations"]) {
      expect(coupangRoute).not.toContain(forbidden);
    }
  });

  it("🔴 새 테이블·새 상태 모델을 만들지 않았다", () => {
    for (const forbidden of ["coupang_compliance_confirmations", "CoupangKcStatus", "NoticeConfirmationStatus"]) {
      expect(WORKSPACE).not.toContain(forbidden);
      expect(MODAL).not.toContain(forbidden);
    }
  });
});

describe("④ 확인의 «뜻» 을 화면이 좁게 적는다", () => {
  it("「법적으로 판정하지 않는다」고 말한다", () => {
    expect(MODAL_RAW).toContain("KC 적용 여부나 면제");
    expect(MODAL_RAW).toContain("법적으로 판정하지 않습니다");
  });

  it("🔴 체크박스 문구는 «봤다» 까지만 말한다 — 면제를 증명하지 않는다", () => {
    expect(MODAL_RAW).toContain("위 입력값을 확인했습니다.");
    expect(MODAL_RAW).not.toContain("KC 면제임을 확인합니다");
    expect(MODAL_RAW).not.toContain("면제 대상임을 확인");
  });

  it("실제 등록될 문장을 «그대로» 띄운다 — 「KC 관련 정보」로 뭉개지 않는다", () => {
    expect(MODAL).toContain("notice.value");
    expect(MODAL).toContain("notice.fieldName");
  });
});

describe("⑤ Test 4/5 — Single = Multi · 롯데ON 영향 없음", () => {
  const multi = WORKSPACE.slice(
    WORKSPACE.indexOf("{multiConfirmOpen && ("),
    WORKSPACE.indexOf("{confirmingPlatform && listing && ("),
  );
  const single = WORKSPACE.slice(WORKSPACE.indexOf("{confirmingPlatform && listing && ("));

  it("🔴 Test 4 — 두 경로가 같은 값을 받는다", () => {
    expect(multi).toContain("coupangKcNotices={selectedCommerces.includes(\"coupang\") ? coupangKcNotices : undefined}");
    expect(single).toContain("coupangKcNotices={confirmingPlatform === \"coupang\" ? coupangKcNotices : undefined}");
  });

  it("쿠팡을 «고른 경우에만» 묻는다", () => {
    expect(multi).toContain('selectedCommerces.includes("coupang")');
    expect(single).toContain('confirmingPlatform === "coupang"');
  });

  it("🔴 탭을 열지 않아도 계산된다 — 다중 등록에서 문구가 사라지지 않는다", () => {
    expect(WORKSPACE).toContain('if (tab !== "coupang" && !selectedCommerces.includes("coupang")) return null;');
  });

  it("🔴 Test 5 — 롯데ON 은 이 게이트와 무관하다", () => {
    expect(MODAL).not.toContain("lotteon");
    expect(multi).not.toContain("lotteOnKcNotices");
  });
});
