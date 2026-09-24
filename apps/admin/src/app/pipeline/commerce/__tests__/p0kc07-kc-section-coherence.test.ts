import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-07(CPO 확정, 2026-09-24) — **KC 영역은 «한 목소리» 로 말한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 P0-KC-06 이 왜 Production 에서 FAIL 이었는가 ───────────────────────
 * P0-KC-06 은 `KcCertificationBlock` «한 컴포넌트만» 고쳤고, 테스트도 그 파일
 * 하나만 읽었다. 그런데 스마트스토어 탭의 KC 섹션에는 세 덩어리가 «같이» 쌓인다:
 *
 *   ① KcSellerStatusBanner   「판매 가능 여부를 확인해주세요」 + [판매 가능 상품으로 확인]
 *   ② KcCertificationBlock   「① 있으면 입력 / ② 없으면 최종 확인에서 직접 확인」
 *   ③ 섹션 맨 아래 한 줄     「인증번호를 «반드시» 입력해야 승인됩니다」  ← 정반대
 *
 * ③ 이 ①②를 덮어써서, 셀러는 「값을 넣어야만 등록된다」고 읽었다. 그리고 그
 * 문장은 사실도 아니었다 — KC 는 판매자 확인으로도 등록된다
 * (isKcStatusRegistrable + seller_compliance_confirmations).
 *
 * 🔴 교훈: 한 컴포넌트를 고쳐 놓고 그 파일만 검사하면, 같은 화면의 다른 문구가
 * 정반대를 말하는 것을 못 잡는다. 그래서 이 파일은 **KC 섹션에 실제로 렌더되는
 * 모든 파일을 한꺼번에** 본다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const DIR = join(__dirname, "..");

/** KC 섹션에 실제로 그려지는 것들 — 하나라도 빠지면 이 테스트의 의미가 없다. */
const KC_SECTION_FILES = [
  "PlatformPreview.tsx",
  "KcSellerStatusBanner.tsx",
  "ListingConfirmationModal.tsx",
  "kc-status-note.ts",
];
const SECTION = KC_SECTION_FILES.map((f) => codeOnly(readFileSync(join(DIR, f), "utf8"))).join("\n");

describe("① 🔴 「반드시 입력해야 등록된다」고 말하는 곳이 한 군데도 없다", () => {
  it.each([
    "반드시\n            입력해야 승인",
    "반드시 입력해야 승인",
    "인증번호를 반드시",
    "입력해야 승인됩니다",
  ])("KC 섹션 어디에도 없다: %s", (phrase) => {
    expect(SECTION.replace(/\s+/g, " ")).not.toContain(phrase.replace(/\s+/g, " "));
  });

  it("KC 를 「비워두면 된다」고 카테고리 기준으로 일반화하지 않는다", () => {
    /* 「해당 없는 카테고리는 비워두면 됩니다」는 셀러가 «카테고리 해당 여부» 를
       스스로 판정하라는 말이 된다. 그 판정은 resolveKcStatus 가 이미 한다. */
    expect(SECTION.replace(/\s+/g, " ")).not.toContain("해당 없는 카테고리는 비워두면 됩니다");
  });
});

describe("② 두 갈래가 KC 섹션 전체에서 일관된다", () => {
  const flat = SECTION.replace(/\s+/g, " ");

  it("판매자 확인 경로가 «존재한다» 고 말한다", () => {
    expect(flat).toContain("판매 가능 상품으로 확인");      // ① 배너의 실제 버튼
    expect(flat).toContain("② 입력하지 않는 경우");          // ② 블록의 두 번째 갈래
    expect(flat).toContain("이 상품을 판매해도 되는지 직접 확인했습니다"); // ④ 모달
  });

  it("실제 인증정보 입력 경로도 그대로 남아 있다", () => {
    expect(flat).toContain("① 실제 인증정보가 있는 경우");
    expect(flat).toContain("인증정보 직접 입력");
  });

  it("🔴 임의값을 넣지 말라고 명시한다", () => {
    expect(flat).toContain("값이 없으면 비워둡니다(임의 값 금지)");
  });

  it("🔴 따져가 판정하지 않는다고 말한다", () => {
    expect(flat).toContain("TTAEJYO는 KC 인증의 진위나 법적 적용 여부를 판정하지 않습니다");
  });

  it("KC 는 「상세페이지 참조」로 못 넘는다는 사실은 유지", () => {
    expect(flat).toContain("로 대체할 수 없습니다");
  });
});

describe("③ 🔴 규칙은 하나도 건드리지 않았다", () => {
  const COMPLIANCE = readFileSync(
    join(DIR, "../../../../../../packages/listing/src/naver/compliance.ts"),
    "utf8",
  );

  it("KcStatus 4-state 그대로", () => {
    expect(COMPLIANCE).toContain(
      'export type KcStatus = "NOT_APPLICABLE" | "CERTIFIED_REFERENCE" | "SELLER_REVIEW_REQUIRED" | "BLOCKED";',
    );
  });

  it("판정 규칙 그대로 — 고친 것은 «말» 이다", () => {
    expect(COMPLIANCE).toContain('return hasFullCert ? "CERTIFIED_REFERENCE" : "SELLER_REVIEW_REQUIRED";');
  });

  it("등록 게이트 식 그대로", () => {
    const modal = codeOnly(readFileSync(join(DIR, "ListingConfirmationModal.tsx"), "utf8"));
    expect(modal).toContain(
      "const kcRegistrable = !hasSmartstoreKcCard || !kcBlocked && (!kcNeedsReview || reviewConfirmed);",
    );
  });
});

describe("④ 세로 스크롤은 하나다", () => {
  const SHELL = codeOnly(readFileSync(join(DIR, "../../../components/layout/AppShell.tsx"), "utf8"));

  it("페이지 스크롤 컨테이너는 main 하나뿐이다", () => {
    expect(SHELL).toContain('<div className="flex h-dvh flex-col overflow-hidden">');
    expect(SHELL).toContain('<main className="min-h-0 flex-1 overflow-y-auto">');
  });

  it("🔴 KC 영역이 자기 세로 스크롤을 만들지 않는다", () => {
    for (const f of ["KcSellerStatusBanner.tsx", "PlatformPreview.tsx"]) {
      const src = codeOnly(readFileSync(join(DIR, f), "utf8"));
      /* 예외는 payload/log viewer(<pre>)뿐 — KC 영역에는 그것도 없다. */
      const kc = src.slice(src.indexOf("KcCertificationBlock"), src.indexOf("section-description"));
      expect(kc).not.toContain("overflow-y-auto");
      expect(kc).not.toContain("overflow-y-scroll");
      expect(kc).not.toContain("max-h-");
    }
  });
});
