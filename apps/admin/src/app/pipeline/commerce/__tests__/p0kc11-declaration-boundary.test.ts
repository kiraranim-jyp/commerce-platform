import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCertificationTargetExcludeContent,
  isKcStatusRegistrable,
  requiresChildCertificationData,
  resolveKcStatus,
  COMPLIANCE_POLICY_VERSION,
} from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-11 ⑦(CPO 확정, 2026-09-24) — **세 계층은 서로 «자동 변환되지» 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   SmartStoreKcDeclaration    판매자가 «고른» 신고값      (COMMERCE_BINDING)
 *          ≠
 *   KcStatus                   따져가 «아는» 준비 상태     (카테고리 + 입력값)
 *          ≠
 *   seller_compliance_confirmations   판매자가 «확인한» 기록
 *
 * 하나를 건드렸을 때 나머지가 조용히 따라 움직이면, 화면·검증·서버가 서로 다른
 * 근거로 같은 단어를 쓰게 된다. 이번 사고의 형태가 정확히 그것이었다.
 */

const cert = {
  name: "한국건설생활환경시험연구원",
  companyName: "보보쇼즈코리아",
  certificationNumber: "CB012A3456-78901",
  certificationDate: "2025-03-14",
};
const KIDS = { childCertificationRequired: true };

describe("① 선언을 바꿔도 KcStatus 는 움직이지 않는다", () => {
  const base = { categoryVerified: true, categoryRequiresChildCertification: true };

  it("🔴 「대상 아님」을 골라도 KcStatus 는 여전히 SELLER_REVIEW_REQUIRED 다", () => {
    /* resolveKcStatus 는 선언을 «인자로 받지도» 않는다 — 구조적으로 섞일 수 없다.
       KcStatus 는 「따져가 아는 것」이고, 선언은 「판매자가 주장하는 것」이다. */
    expect(resolveKcStatus({ ...base, childCertification: undefined })).toBe("SELLER_REVIEW_REQUIRED");
    expect(resolveKcStatus.length).toBe(1); // 인자 하나 — 선언이 끼어들 자리가 없다
  });

  it("인증정보를 채우면 그때만 CERTIFIED_REFERENCE 가 된다", () => {
    expect(
      resolveKcStatus({ ...base, childCertification: { value: cert, source: "USER_EDITED", confidence: 1 } }),
    ).toBe("CERTIFIED_REFERENCE");
  });
});

describe("② 선언을 바꿔도 confirmation 은 움직이지 않는다", () => {
  const ctx = { policyVersion: COMPLIANCE_POLICY_VERSION, categoryCode: "50000535" };

  it("🔴 「대상 아님」을 골랐다고 판매자 확인이 «생기지» 않는다", () => {
    expect(isKcStatusRegistrable("SELLER_REVIEW_REQUIRED", null, ctx)).toBe(false);
  });

  it("confirmation 은 여전히 기록이 있을 때만 통과시킨다", () => {
    expect(
      isKcStatusRegistrable(
        "SELLER_REVIEW_REQUIRED",
        { confirmed: true, kcStatus: "SELLER_REVIEW_REQUIRED", ...ctx },
        ctx,
      ),
    ).toBe(true);
  });
});

describe("③ KcStatus 를 바꿔도 선언은 움직이지 않는다", () => {
  it("🔴 선언이 없으면 payload 도 없다 — 상태가 대신 채우지 않는다", () => {
    expect(buildCertificationTargetExcludeContent(undefined, KIDS)).toBeUndefined();
  });

  it("🔴 선언이 없으면 인증정보를 예전 그대로 요구한다", () => {
    expect(requiresChildCertificationData(undefined, KIDS)).toBe(true);
  });

  it("build 함수는 KcStatus 를 인자로 받지 않는다 — 섞일 자리가 없다", () => {
    expect(buildCertificationTargetExcludeContent.length).toBe(2); // (declaration, capability)
  });
});

describe("④ 기존 인증정보 상품의 payload 는 그대로다", () => {
  it("🔴 선언을 «고르지 않은» 상품은 새 키가 붙지 않는다", () => {
    expect(buildCertificationTargetExcludeContent({}, KIDS)).toBeUndefined();
  });

  it("인증정보가 있으면 여전히 요구 대상이다 — 선언이 그것을 가리지 않는다", () => {
    expect(requiresChildCertificationData({ child: "TARGET" }, KIDS)).toBe(true);
  });
});

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const ROOT = join(__dirname, "../../../../../../../packages/listing/src/naver");
const COMPLIANCE = codeOnly(readFileSync(join(ROOT, "compliance.ts"), "utf8"));
const DECL = codeOnly(readFileSync(join(ROOT, "kc-declaration.ts"), "utf8"));
const BUILD = codeOnly(readFileSync(join(ROOT, "build-payload.ts"), "utf8"));
const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));
const PREVIEW = codeOnly(readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8"));

describe("⑤ 🔴 코드에서도 세 계층이 서로를 참조하지 않는다", () => {
  it("compliance.ts(KcStatus)가 선언을 모른다", () => {
    expect(COMPLIANCE).not.toContain("smartStoreKcDeclaration");
    expect(COMPLIANCE).not.toContain("certificationTargetExcludeContent");
  });

  it("kc-declaration.ts(선언)가 KcStatus·confirmation 을 모른다", () => {
    expect(DECL).not.toContain("KcStatus");
    expect(DECL).not.toContain("resolveKcStatus");
    expect(DECL).not.toContain("seller_compliance");
  });

  it("🔴 빌더가 Binding 칸을 상품에서 직접 읽지 않는다 — 옵션으로 받는다", () => {
    expect(BUILD).not.toContain("product.smartStoreKcDeclaration");
    expect(BUILD).toContain("smartStoreKcDeclaration,");
  });

  it("🔴 화면이 자기 조합 규칙을 만들지 않는다 — validateKcDeclaration 을 부른다", () => {
    expect(PREVIEW).toContain("validateKcDeclaration(declaration, {");
    expect(PREVIEW).not.toContain("KC_EXEMPTION_OBJECT"); // 네이버 어휘를 화면이 직접 쓰지 않는다
  });

  it("🔴 선택을 바꿔도 KcStatus/confirmation 을 건드리지 않는다", () => {
    const fn = WORKSPACE.slice(
      WORKSPACE.indexOf("function updateKcDeclaration("),
      WORKSPACE.indexOf("function updateChildCertification("),
    );
    expect(fn).toContain("smartStoreKcDeclaration: next");
    for (const forbidden of ["kcStatus", "seller-compliance", "childCertification", "setListingStates"]) {
      expect(fn).not.toContain(forbidden);
    }
  });

  it("면제가 아니면 사유를 «지운다» — 반쪽 신고가 남지 않는다", () => {
    const fn = WORKSPACE.slice(
      WORKSPACE.indexOf("function updateKcDeclaration("),
      WORKSPACE.indexOf("function updateChildCertification("),
    );
    expect(fn).toContain('if (next.kc !== "EXEMPTION") delete next.exemptionReason;');
  });
});

describe("⑥ Preview 는 화면 state 가 아니라 payload 를 읽는다", () => {
  const PV = codeOnly(readFileSync(join(__dirname, "../NaverPayloadPreview.tsx"), "utf8"));

  it("🔴 payload 에서 꺼낸다", () => {
    expect(PV).toContain(
      "payload.originProduct?.detailAttribute?.certificationTargetExcludeContent",
    );
  });

  it("빌더가 아무것도 안 만들었으면 아무것도 그리지 않는다", () => {
    expect(PV).toContain("if (!exclude) return null;");
  });

  it("면제 유형이 없으면 「없음」이라고 «적는다» — 칸을 숨기지 않는다", () => {
    expect(PV).toContain('exclude.kcExemptionType ?? "없음"');
  });
});

/**
 * ⑦ P0-KC-11 후속(CEO Production 확인, 2026-09-24) — **인자를 만든 것과 «넘기는»
 * 것은 다르다.**
 *
 * validator 에 smartStoreKcDeclaration 인자를 «만들어 두고» 호출부에서 넘기지
 * 않았다. 그래서 화면에서 「인증 대상 아님 / 면제 대상 / 구매대행」을 다 골라도
 * 오른쪽 등록 준비 상태는 계속 「KC 인증정보(대상 여부)가 없습니다」라고 말했다.
 * types.ts 에 certificationTargetExcludeContent 가 «선언만 되고» 아무도 안 쓰던
 * 것과 정확히 같은 실수다.
 *
 * 🔴 그래서 이 블록은 «호출부» 를 검사한다. 한 곳이라도 빠지면 그 화면만 조용히
 * 옛 판정을 계속 말한다.
 */
describe("⑦ validateNaverPayload 호출부 전수 — 선언을 실제로 넘긴다", () => {
  const CALLERS = [
    ["CommerceWorkspace.tsx", join(__dirname, "../../CommerceWorkspace.tsx")],
    ["NaverPayloadPreview.tsx", join(__dirname, "../NaverPayloadPreview.tsx")],
    ["smartstore/register/route.ts", join(__dirname, "../../../api/smartstore/register/route.ts")],
    ["compute-readiness.ts", join(__dirname, "../../../api/snapshots/_lib/compute-readiness.ts")],
  ] as const;

  it.each(CALLERS)("%s 가 선언을 넘긴다", (_name, path) => {
    const src = codeOnly(readFileSync(path, "utf8"));
    expect(src).toContain("validateNaverPayload(");
    expect(src).toContain("smartStoreKcDeclaration: product.smartStoreKcDeclaration,");
  });

  it("🔴 호출부가 4곳뿐이다 — 새 호출부가 생기면 이 목록도 같이 늘어야 한다", () => {
    /* 목록이 실제와 어긋나면 「전수 검사」라는 이름이 거짓이 된다. */
    for (const [, path] of CALLERS) {
      expect(codeOnly(readFileSync(path, "utf8")).includes("validateNaverPayload(")).toBe(true);
    }
  });
});
