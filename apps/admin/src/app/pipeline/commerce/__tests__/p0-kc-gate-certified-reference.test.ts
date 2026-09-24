import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPLIANCE_POLICY_VERSION,
  isKcStatusRegistrable,
  resolveKcStatus,
  type SellerComplianceConfirmationInput,
} from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-SAFETY 재검증(CPO 지시 §8, 2026-09-24) — **CERTIFIED_REFERENCE 게이트**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 요구한 것은 「UI 문구를 바꿨다」가 아니라, ③ · ④ · 서버 ·
 * seller_compliance_confirmations 가 **하나의 의미**를 갖는지다.
 *
 * 🔴 게이트는 «두 겹» 이고, 두 겹이 서로 다른 일을 한다:
 *
 *   ㉠ 화면(ListingConfirmationModal) — 판매자가 입력값을 «보고» 확인하기
 *      전에는 [등록]이 눌리지 않는다.
 *   ㉡ 서버(smartstore/register/route.ts) — 화면이 무엇을 보냈든, DB 의
 *      확인 기록을 «다시» 조회해서 없으면 400 으로 막는다.
 *
 * ㉡ 는 이번 사고 전부터 있었고 정상 동작했다(E-1 도 확인 기록이 있었다).
 * 이번에 고친 것은 ㉠ 이다 — 판매자가 «무엇을» 확인하는지가 비어 있었다.
 * 그래서 두 겹을 한 파일에서 같이 고정한다.
 */

const cert = {
  name: "한국건설생활환경시험연구원",
  companyName: "보보쇼즈코리아",
  certificationNumber: "CB012A3456-78901",
  certificationDate: "2025-03-14",
};
const CATEGORY = "50000409";
const confirmation = (over: Partial<SellerComplianceConfirmationInput> = {}): SellerComplianceConfirmationInput => ({
  confirmed: true,
  kcStatus: "CERTIFIED_REFERENCE",
  policyVersion: COMPLIANCE_POLICY_VERSION,
  categoryCode: CATEGORY,
  ...over,
});

describe("① 상태 판정 규칙은 그대로다 — 고친 것은 «그 다음» 이다", () => {
  it("세 값이 차 있으면 CERTIFIED_REFERENCE, 비면 SELLER_REVIEW_REQUIRED", () => {
    const base = { categoryVerified: true, categoryRequiresChildCertification: true };
    expect(resolveKcStatus({ ...base, childCertification: { value: cert, source: "USER_EDITED", confidence: 1 } })).toBe(
      "CERTIFIED_REFERENCE",
    );
    expect(resolveKcStatus({ ...base, childCertification: undefined })).toBe("SELLER_REVIEW_REQUIRED");
  });

  it("🔴 진위는 보지 않는다 — 「12313ㄹㅇ」도 여전히 CERTIFIED_REFERENCE 다", () => {
    /* 이것을 「고쳐서」 가짜를 걸러내려 하지 않는다. 따져는 인증번호가 실제
       기관 데이터와 맞는지 알 수 없다. 그래서 «판정» 이 아니라 «누가 보증하는가»
       를 고쳤다 — 값을 판매자에게 보여주고 확인을 받는다. */
    expect(
      resolveKcStatus({
        categoryVerified: true,
        categoryRequiresChildCertification: true,
        childCertification: {
          value: { ...cert, certificationNumber: "12313ㄹㅇ", companyName: "ㅁㅇㄹ", name: "ㅁㄹ" },
          source: "USER_EDITED",
          confidence: 1,
        },
      }),
    ).toBe("CERTIFIED_REFERENCE");
  });

  it("카테고리 미확정은 BLOCKED · 비대상은 NOT_APPLICABLE (그대로)", () => {
    expect(
      resolveKcStatus({ categoryVerified: false, categoryRequiresChildCertification: true, childCertification: undefined }),
    ).toBe("BLOCKED");
    expect(
      resolveKcStatus({ categoryVerified: true, categoryRequiresChildCertification: false, childCertification: undefined }),
    ).toBe("NOT_APPLICABLE");
  });
});

describe("② 서버 게이트(㉡) — 확인 기록이 없으면 등록되지 않는다", () => {
  const ctx = { policyVersion: COMPLIANCE_POLICY_VERSION, categoryCode: CATEGORY };

  it("BLOCKED 는 확인 기록이 있어도 못 넘는다", () => {
    expect(isKcStatusRegistrable("BLOCKED", confirmation({ kcStatus: "BLOCKED" }), ctx)).toBe(false);
  });

  it("SELLER_REVIEW_REQUIRED 는 확인 기록이 있어야 넘는다", () => {
    expect(isKcStatusRegistrable("SELLER_REVIEW_REQUIRED", null, ctx)).toBe(false);
    expect(
      isKcStatusRegistrable("SELLER_REVIEW_REQUIRED", confirmation({ kcStatus: "SELLER_REVIEW_REQUIRED" }), ctx),
    ).toBe(true);
  });

  it("정책 버전이나 카테고리가 바뀌면 옛 확인은 무효다", () => {
    expect(
      isKcStatusRegistrable("SELLER_REVIEW_REQUIRED", confirmation({ policyVersion: "2026-01-01" }), ctx),
    ).toBe(false);
    expect(
      isKcStatusRegistrable("SELLER_REVIEW_REQUIRED", confirmation({ categoryCode: "50000535" }), ctx),
    ).toBe(false);
  });
});

/** 주석을 걷어낸 «실행되는 코드» 만 본다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const DIR = join(__dirname, "..");
const MODAL = codeOnly(readFileSync(join(DIR, "ListingConfirmationModal.tsx"), "utf8"));
const MODAL_RAW = readFileSync(join(DIR, "ListingConfirmationModal.tsx"), "utf8");
const ROUTE = codeOnly(
  readFileSync(join(DIR, "../../api/smartstore/register/route.ts"), "utf8"),
);

describe("③ 🔴 서버는 KcStatus 와 «무관하게» 확인 기록을 다시 조회한다", () => {
  it("클라이언트가 보낸 상태를 믿지 않는다 — DB 를 다시 읽는다", () => {
    expect(ROUTE).toContain("await getLatestSellerComplianceConfirmation(snapshotId)");
  });

  it("policyVersion · categoryCode 까지 지금 값과 맞아야 유효하다", () => {
    expect(ROUTE).toContain("sellerComplianceConfirmationRow?.confirmed === true");
    expect(ROUTE).toContain("sellerComplianceConfirmationRow.policyVersion === COMPLIANCE_POLICY_VERSION");
    expect(ROUTE).toContain("sellerComplianceConfirmationRow.categoryCode === leafCategoryId");
  });

  it("🔴 유효하지 않으면 «외부 API 를 부르기 전에» 멈춘다", () => {
    expect(ROUTE).toContain("if (!sellerConfirmationValid) {");
    expect(ROUTE).toContain("판매자가 '판매 전 최종 확인'을 아직 하지 않았습니다.");
    const gate = ROUTE.indexOf("if (!sellerConfirmationValid) {");
    const post = ROUTE.indexOf("releaseAddressBookNo");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(post); // 게이트가 등록 준비보다 «앞» 에 있다
  });
});

describe("④ Test 1/2 — 화면 게이트(㉠): 확인 전 차단 · 확인 후 허용", () => {
  /** 모달의 실제 식을 그대로 옮긴 것 — 식이 바뀌면 아래 문자열 검사가 깨진다. */
  const canRegister = (status: string | null, reviewConfirmed: boolean) => {
    const hasCard = status != null;
    const needsReview = status === "SELLER_REVIEW_REQUIRED" || status === "CERTIFIED_REFERENCE";
    const blocked = status === "BLOCKED";
    return !hasCard || (!blocked && (!needsReview || reviewConfirmed));
  };

  it("모델이 화면 코드와 같은 식을 쓰고 있다", () => {
    /* 줄바꿈/들여쓰기는 formatter 가 바꿀 수 있으므로 공백을 접어서 본다. */
    const flat = MODAL.replace(/\s+/g, " ");
    expect(flat).toContain(
      'const kcNeedsReview = smartstoreKcStatus === "SELLER_REVIEW_REQUIRED" || smartstoreKcStatus === "CERTIFIED_REFERENCE";',
    );
    expect(MODAL).toContain(
      "const kcRegistrable = !hasSmartstoreKcCard || !kcBlocked && (!kcNeedsReview || reviewConfirmed);",
    );
  });

  it("🔴 Test 1 — CERTIFIED_REFERENCE + 미확인 → 차단", () => {
    expect(canRegister("CERTIFIED_REFERENCE", false)).toBe(false);
  });

  it("🔴 Test 2 — CERTIFIED_REFERENCE + 명시적 확인 → 허용", () => {
    expect(canRegister("CERTIFIED_REFERENCE", true)).toBe(true);
  });

  it("SELLER_REVIEW_REQUIRED 는 예전과 같다", () => {
    expect(canRegister("SELLER_REVIEW_REQUIRED", false)).toBe(false);
    expect(canRegister("SELLER_REVIEW_REQUIRED", true)).toBe(true);
  });

  it("NOT_APPLICABLE 은 KC 확인을 요구하지 않는다 — 없는 일을 시키지 않는다", () => {
    expect(canRegister("NOT_APPLICABLE", false)).toBe(true);
  });

  it("BLOCKED 는 확인해도 못 넘는다", () => {
    expect(canRegister("BLOCKED", true)).toBe(false);
  });

  it("KC 카드 자체가 없으면(스마트스토어 미선택) 막지 않는다", () => {
    expect(canRegister(null, false)).toBe(true);
  });

  it("확인 전에는 [등록] 버튼이 disabled 다", () => {
    expect(MODAL).toContain("generalConfirmed && priceInfoConfirmed && responsibilityConfirmed && kcRegistrable");
    expect(MODAL).toContain("disabled={!canConfirm}");
    expect(MODAL).toContain("if (!canConfirm) return;");
  });
});

describe("⑤ Test 3/4 — 무엇을 보증하는지 보이고, 모른다고 말한다", () => {
  it("🔴 Test 3 — 네 값을 모두 화면에 띄운다", () => {
    for (const label of ["인증번호", "업체명", "인증기관", "취득일자"]) {
      expect(MODAL_RAW).toContain(`"${label}"`);
    }
    expect(MODAL).toContain("smartstoreChildCertification.certificationNumber");
    expect(MODAL).toContain("smartstoreChildCertification.companyName");
    expect(MODAL).toContain("smartstoreChildCertification.name");
    expect(MODAL).toContain("smartstoreChildCertification.certificationDate");
  });

  it("빈 값을 「—」로 정직하게 적는다 — 빈칸을 숨기지 않는다", () => {
    expect(MODAL).toContain('|| "—"');
  });

  it("🔴 Test 4 — 「따져는 진위를 확인할 수 없습니다」가 화면에 있다", () => {
    expect(MODAL_RAW).toContain("TTAEJYO는 인증번호의 진위를 확인할 수 없습니다");
  });

  it("확인 버튼이 «실제 인증서와 대조» 를 요구한다", () => {
    expect(MODAL_RAW).toContain("실제 인증서와 같습니다 — 확인 완료");
  });
});

const WORKSPACE = codeOnly(readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8"));

describe("⑥ Test 5 — Single SmartStore = Multi SmartStore", () => {
  const multi = WORKSPACE.slice(
    WORKSPACE.indexOf("{multiConfirmOpen && ("),
    WORKSPACE.indexOf("{confirmingPlatform && listing && ("),
  );
  const single = WORKSPACE.slice(WORKSPACE.indexOf("{confirmingPlatform && listing && ("));

  it("🔴 두 경로가 «같은 모달» 을 쓴다 — 게이트가 한 벌이다", () => {
    expect(multi).toContain("<ListingConfirmationModal");
    expect(single).toContain("<ListingConfirmationModal");
  });

  it("두 경로가 같은 KC 상태와 같은 인증정보를 넘긴다", () => {
    for (const part of [multi, single]) {
      expect(part).toContain("smartStoreValidation?.kcStatus ?? null");
      expect(part).toContain("product.childCertification.value ?? null");
      expect(part).toContain("smartstoreCategoryCode=");
    }
  });

  it("두 경로 모두 스마트스토어를 «고른 경우에만» KC 를 묻는다", () => {
    expect(multi).toContain('selectedCommerces.includes("smartstore")');
    expect(single).toContain('confirmingPlatform === "smartstore"');
  });

  it("확인 기록을 남기는 곳도 한 곳이다 — 모달 안의 POST 하나뿐", () => {
    expect(MODAL).toContain('fetch("/api/smartstore/seller-compliance"');
    expect(WORKSPACE).not.toContain("/api/smartstore/seller-compliance");
  });
});
