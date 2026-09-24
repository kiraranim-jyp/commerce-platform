import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kcNeedsAction, kcStatusNote } from "../kc-status-note";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-SAFETY(CPO 지시, 2026-09-24) — **「값이 있다」를 「확인했다」로 읽지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 실제로 일어났는가 ───────────────────────────────────────────────
 * Production 에 어린이제품이 인증번호 「12313ㄹㅇ」을 달고 등록됐다
 * (SmartStore originProductNo 13713032117, 2026-09-24). 우회가 아니라 설계대로
 * 동작한 결과다:
 *
 *   세 칸이 비어 있지 않다 → CERTIFIED_REFERENCE → 화면 「인증정보 확인됨」
 *   → ④ 모달은 KC 를 «묻지 않음» → 일반 체크 3개만 누르면 등록
 *
 * 🔴 인센티브가 거꾸로였다. KC 칸을 «채우면» 확인 절차가 사라졌다 — 아무 글자나
 * 넣은 상품이 빈 상품보다 «쉽게» 나갔다.
 *
 * ── 🔴 무엇을 고치지 «않았는가» ───────────────────────────────────────────
 * 인증번호의 진위를 판정하지 않는다. 정규식도, 더미 탐지도 넣지 않는다 —
 * 따져는 그것을 알 수 없고, 아는 척하면 그 순간 규제 판단을 대신한 것이 된다.
 * 새 KcStatus 도, 새 테이블도, payload 변경도 없다.
 *
 * 고친 것은 하나다: **판매자가 무엇을 보증하는지 보고, 명시적으로 확인하게 한다.**
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const DIR = join(__dirname, "..");
const MODAL = codeOnly(readFileSync(join(DIR, "ListingConfirmationModal.tsx"), "utf8"));
const WORKSPACE = codeOnly(readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8"));
const COMPLIANCE = readFileSync(
  join(DIR, "../../../../../../packages/listing/src/naver/compliance.ts"),
  "utf8",
);

describe("① 「확인됨」이라고 말하지 않는다", () => {
  it("🔴 ③ 에서 CERTIFIED_REFERENCE 는 더 이상 «완료» 가 아니다", () => {
    const note = kcStatusNote("CERTIFIED_REFERENCE");
    expect(note.text).toBe("KC 인증 · 입력값 확인 필요");
    expect(note.text).not.toContain("확인됨");
    expect(note.tone).toBe("ATTENTION");
    expect(note.actionLabel).toBe("확인하기");
    expect(kcNeedsAction("CERTIFIED_REFERENCE")).toBe(true);
  });

  it("🔴 ④ 라벨에서 「실제 자료 근거」가 사라졌다 — 따져는 자료를 본 적이 없다", () => {
    expect(MODAL).not.toContain("실제 자료 근거");
    expect(MODAL).not.toContain("KC 인증정보 확인됨");
    expect(MODAL).toContain("입력된 KC 인증정보를 확인해주세요");
  });

  it("나머지 세 상태의 뜻은 건드리지 않았다", () => {
    expect(kcStatusNote("NOT_APPLICABLE").tone).toBe("OK");
    expect(kcStatusNote("NOT_APPLICABLE").text).toBe("KC 인증 · 해당 없음");
    expect(kcStatusNote("SELLER_REVIEW_REQUIRED").text).toContain("판매자 확인 필요");
    expect(kcStatusNote("BLOCKED").text).toContain("카테고리 확정 후");
    expect(kcStatusNote(null).text).toBe("KC 인증 · 확인 전");
  });
});

describe("② 채웠다고 확인 절차가 사라지지 않는다", () => {
  it("🔴 CERTIFIED_REFERENCE 도 명시적 확인을 받는다", () => {
    expect(MODAL).toContain(
      'smartstoreKcStatus === "SELLER_REVIEW_REQUIRED" || smartstoreKcStatus === "CERTIFIED_REFERENCE"',
    );
  });

  it("확인 전에는 [등록]이 눌리지 않는다 — 기존 게이트를 그대로 탄다", () => {
    expect(MODAL).toContain("(!kcNeedsReview || reviewConfirmed)");
    /* P0-KC-03(2026-09-24)에서 쿠팡 고시 확인이 같은 식에 «추가» 됐다.
       KC 게이트가 사라진 게 아니라 한 겹이 더 붙은 것이므로, 두 조건이
       모두 걸려 있는지를 본다. */
    expect(MODAL).toContain("kcRegistrable && coupangNoticeRegistrable && !submitting");
  });

  it("BLOCKED 는 확인으로도 못 넘는다 — 이 규칙은 그대로다", () => {
    expect(MODAL).toContain("!kcBlocked");
  });
});

describe("③ 판매자가 «무엇을» 보증하는지 보여준다", () => {
  it("🔴 입력된 인증번호를 화면에 띄운다 — 「12313ㄹㅇ」을 봤다면 멈췄을 것이다", () => {
    expect(MODAL).toContain("smartstoreChildCertification.certificationNumber");
    expect(MODAL).toContain("smartstoreChildCertification.companyName");
    expect(MODAL).toContain("smartstoreChildCertification.certificationDate");
  });

  it("진위는 따져가 모른다고 «말한다»", () => {
    expect(MODAL).toContain("TTAEJYO는 인증번호의 진위를 확인할 수 없습니다");
  });

  it("🔴 단독 등록과 다중 등록이 같은 값을 받는다 — Single = Multi", () => {
    const single = WORKSPACE.slice(WORKSPACE.indexOf("{confirmingPlatform && listing && ("));
    const multi = WORKSPACE.slice(
      WORKSPACE.indexOf("{multiConfirmOpen && ("),
      WORKSPACE.indexOf("{confirmingPlatform && listing && ("),
    );
    for (const part of [single, multi]) {
      expect(part).toContain("smartstoreChildCertification=");
      expect(part).toContain("product.childCertification.value ?? null");
    }
  });

  it("고르지 않은 채널의 KC 를 묻지 않는다", () => {
    expect(WORKSPACE).toContain(
      'selectedCommerces.includes("smartstore") ? (product.childCertification.value ?? null) : undefined',
    );
  });
});

describe("④ 🔴 진위를 판정하지 않는다 · 모델을 늘리지 않는다", () => {
  it("인증번호를 검사하는 규칙을 만들지 않았다", () => {
    for (const forbidden of ["테스트인증", "TEST010101", "looksFake", "isDummyCert", "CERT_PATTERN"]) {
      expect(MODAL).not.toContain(forbidden);
      expect(COMPLIANCE).not.toContain(forbidden);
    }
    expect(COMPLIANCE).not.toMatch(/certificationNumber\s*\.\s*match|\/\^\[0-9\]/);
  });

  it("KcStatus 는 네 개 그대로다", () => {
    expect(COMPLIANCE).toContain(
      'export type KcStatus = "NOT_APPLICABLE" | "CERTIFIED_REFERENCE" | "SELLER_REVIEW_REQUIRED" | "BLOCKED";',
    );
  });

  it("🔴 resolveKcStatus 의 판정 규칙을 바꾸지 않았다 — 고친 것은 «표현과 확인» 이다", () => {
    expect(COMPLIANCE).toContain("return hasFullCert ? \"CERTIFIED_REFERENCE\" : \"SELLER_REVIEW_REQUIRED\";");
  });

  it("payload 에 새 값을 넣지 않았다 — 표시 전용 prop 이다", () => {
    const build = readFileSync(
      join(DIR, "../../../../../../packages/listing/src/naver/build-payload.ts"),
      "utf8",
    );
    expect(build).not.toContain("smartstoreChildCertification");
  });
});
