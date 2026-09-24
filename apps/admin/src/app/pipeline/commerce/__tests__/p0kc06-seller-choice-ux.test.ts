import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-KC-06(CPO 확정, 2026-09-24) — **③ 이 ④ 와 다른 말을 하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * P0-KC-05 조사에서 드러난 것:
 *
 *   ③ KC 패널   「실제 인증정보를 직접 입력해야 합니다」
 *   ④ 최종 확인  입력 «없이» 판매자 확인만으로도 등록됨
 *
 * ③ 이 「입력 외에 길이 없다」고 말하니 셀러는 칸을 채우려 했다. 그래서 아무
 * 값이나 들어갔고, 「12313ㄹㅇ」이 실제 어린이제품에 붙었다. 🔴 이것은 문구
 * 문제가 아니라 «행동을 만든» 문제다.
 *
 * ── 🔴 이번에 «하지 않은» 것 ──────────────────────────────────────────────
 * 새 KcStatus 0 · DB schema 0 · confirmation 모델 0 · payload 0 ·
 * 쿠팡 0 · 롯데ON 0 · confirmation 누적 문제 해결 0(별도 과제).
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const DIR = join(__dirname, "..");
const PREVIEW_RAW = readFileSync(join(DIR, "PlatformPreview.tsx"), "utf8");
const PREVIEW = codeOnly(PREVIEW_RAW);
const MODAL_RAW = readFileSync(join(DIR, "ListingConfirmationModal.tsx"), "utf8");
const MODAL = codeOnly(MODAL_RAW);

describe("① ③ 안내 패널 — 두 갈래를 «둘 다» 말한다", () => {
  it("🔴 「직접 입력해야 합니다」가 사라졌다 — 그것만이 길이 아니다", () => {
    /* 🔴 PREVIEW_RAW 가 아니라 «주석을 걷어낸» 코드를 본다 — 위 변경 주석이
       옛 문구를 인용하고 있어서, 원문을 그대로 검사하면 자기 주석에 걸린다. */
    expect(PREVIEW.replace(/\s+/g, " ")).not.toContain("실제 인증정보를 직접 입력해야 합니다");
  });

  it("① 인증정보가 있으면 입력 · ② 없으면 최종 확인에서 판매자 확인", () => {
    const flat = PREVIEW_RAW.replace(/\s+/g, " ");
    expect(flat).toContain("① 실제 인증정보가 있는 경우");
    expect(flat).toContain("② 입력하지 않는 경우");
    expect(flat).toContain("판매 가능 여부를 «직접» 확인해야 합니다");
  });

  it("🔴 따져가 판정하지 않는다고 ③ 에서도 적는다", () => {
    expect(PREVIEW_RAW).toContain("TTAEJYO는 KC 인증의 진위나 법적 적용 여부를 판정하지 않습니다");
  });

  it("제목이 ③ 목록과 같은 말을 쓴다 — 「판매자 확인 필요」", () => {
    expect(PREVIEW_RAW).toContain("KC 인증 · 판매자 확인 필요");
  });

  it("KC 는 「상세페이지 참조」로 못 넘는다는 사실은 그대로 남아 있다", () => {
    expect(PREVIEW_RAW).toContain("로 대체할 수 없습니다");
  });
});

describe("② 되는 것처럼 보이는 버튼을 없앴다", () => {
  it("🔴 「인증자료 업로드」가 화면에서 사라졌다 — 미구현이었다", () => {
    expect(PREVIEW).not.toContain("인증자료 업로드");
    expect(PREVIEW_RAW).not.toContain("다음 스프린트에서 지원될 예정입니다");
  });

  it("죽은 state 도 같이 치웠다", () => {
    expect(PREVIEW).not.toContain("showUploadNote");
    expect(PREVIEW).not.toContain("setShowUploadNote");
  });
});

describe("③ 이름이 동작보다 크지 않다", () => {
  it("🔴 「판매자에게 확인 요청」 → 「요청 문구 복사」", () => {
    expect(PREVIEW).not.toContain("판매자에게 확인 요청");
    expect(PREVIEW).toContain('"요청 문구 복사"');
  });

  it("실제 동작은 그대로 클립보드 복사다 — 전송하지 않는다", () => {
    expect(PREVIEW).toContain("navigator.clipboard.writeText(text)");
    expect(PREVIEW).toContain("copyRequestText");
  });

  it("「인증정보 직접 입력」은 유지 — 입력칸으로 이동한다", () => {
    expect(PREVIEW).toContain("인증정보 직접 입력");
    expect(PREVIEW).toContain("onClick={onGoToSection}");
  });
});

describe("④ 확인 문구가 confirmation 이 «실제로 담는 것» 과 같다", () => {
  it("🔴 없는 자료를 확인했다고 적게 하지 않는다", () => {
    /* SELLER_REVIEW_REQUIRED 는 «인증자료가 없는» 상태다. */
    expect(MODAL).not.toContain("인증자료 확인 — 판매 가능 여부 확인 완료");
    expect(MODAL_RAW).toContain("이 상품을 판매해도 되는지 직접 확인했습니다");
  });

  it("인증정보가 «있는» 경우의 문구는 그대로다 — 대조를 요구한다", () => {
    expect(MODAL_RAW).toContain("실제 인증서와 같습니다 — 확인 완료");
  });

  it("저장되는 것은 그대로다 — kcStatus · confirmed · 정책버전 · 카테고리", () => {
    expect(MODAL).toContain("kcStatus: smartstoreKcStatus");
    expect(MODAL).toContain("confirmed: true");
    expect(MODAL).toContain("categoryCode: smartstoreCategoryCode");
  });
});

describe("⑤ 회귀 — Gate 자체는 건드리지 않았다", () => {
  it("SELLER_REVIEW_REQUIRED · CERTIFIED_REFERENCE 둘 다 확인을 받는다", () => {
    const flat = MODAL.replace(/\s+/g, " ");
    expect(flat).toContain(
      'const kcNeedsReview = smartstoreKcStatus === "SELLER_REVIEW_REQUIRED" || smartstoreKcStatus === "CERTIFIED_REFERENCE";',
    );
  });

  it("미확인 → 차단 · 확인 → 통과 식이 그대로다", () => {
    expect(MODAL).toContain("const kcRegistrable = !hasSmartstoreKcCard || !kcBlocked && (!kcNeedsReview || reviewConfirmed);");
    expect(MODAL).toContain("kcRegistrable && coupangNoticeRegistrable && !submitting");
  });

  it("NOT_APPLICABLE · BLOCKED 규칙 그대로", () => {
    expect(MODAL).toContain("const kcBlocked = smartstoreKcStatus === \"BLOCKED\";");
  });

  it("🔴 새 상태·새 모델을 만들지 않았다", () => {
    for (const forbidden of ["KcUploadStatus", "SellerChoice", "kc_upload", "NewKcStatus"]) {
      expect(PREVIEW).not.toContain(forbidden);
      expect(MODAL).not.toContain(forbidden);
    }
  });

  it("🔴 payload 경로를 건드리지 않았다 — certificationType 그대로", () => {
    expect(PREVIEW).toContain('fix?.("certificationType", v)');
    const build = readFileSync(
      join(DIR, "../../../../../../packages/listing/src/naver/build-payload.ts"),
      "utf8",
    );
    expect(build).toContain("certificationKindType: \"CHILD_CERTIFICATION\" as const,");
  });
});
