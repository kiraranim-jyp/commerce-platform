import { describe, expect, it } from "vitest";
import { buildSummaryChecks } from "../summary-checklist";
import type { ReadinessItem } from "../readiness";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REAL-REGISTRATION-02 §6(CEO 지시, 2026-09-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 「validator 가 반환하는 field · label · reason · code 를 UI 까지 살려라」
 *
 * ── 무엇이 문제였나 ────────────────────────────────────────────────────────
 * 검증기는 처음부터 필드 이름과 사유를 주고 있었다. 그런데 우측 요약이 자리
 * 단위로 접으면서 그것을 **버렸다**. 셀러가 본 것은 이것뿐이었다.
 *
 *     ✗ 배송
 *     ✗ 고시정보
 *     ✗ 채널 필수정보
 *
 * 배송의 «무엇» 이 «왜» 막는지는 화면 어디에도 없었다. 특히 「채널 필수정보」는
 * 이름만으로는 아무것도 알려주지 않는다 — 셀러가 다음에 무엇을 해야 하는지
 * 알 수 없다.
 *
 * 🔴 여기서 고정하는 것은 두 가지다.
 *    ① 막는 항목이 «이름과 사유를 달고» 살아남는가
 *    ② 그러면서 기존 passed 판정이 한 글자도 바뀌지 않았는가
 */

const item = (over: Partial<ReadinessItem> & { label: string }): ReadinessItem => ({
  passed: false,
  required: true,
  ...over,
});

/** 롯데ON 검증기가 실제로 내는 모양 그대로(validate-payload.ts 의 field/label/reason). */
const LOTTEON_FIELDS: ReadinessItem[] = [
  item({ label: "표준카테고리", passed: true, sectionId: "lotteon-section-category" }),
  item({ label: "판매자상품명", passed: true, sectionId: "lotteon-section-basic" }),
  item({
    label: "출고지번호",
    hint: "출고지번호는 롯데ON 판매자센터(또는 거래처 API)에 먼저 등록돼 있어야 합니다. 임의 값을 보낼 수 없습니다.",
    sectionId: "lotteon-section-shipping",
  }),
  item({
    label: "회수지(반품지)번호",
    hint: "회수지(반품지)번호는 롯데ON 판매자센터(또는 거래처 API)에 먼저 등록돼 있어야 합니다. 임의 값을 보낼 수 없습니다.",
    sectionId: "lotteon-section-shipping",
  }),
  item({
    label: "상품품목코드(고시)",
    hint: "상품품목코드(PD_ITMS_CD)가 지정되지 않았습니다.",
    sectionId: "lotteon-section-notice",
  }),
  item({ label: "수입대행코드", hint: "선택한 안전인증유형은 수입대행코드(IMP_PRX_CD)가 필수입니다.", sectionId: "lotteon-section-codes" }),
];

const find = (checks: ReturnType<typeof buildSummaryChecks>, label: string) => checks.find((c) => c.label === label)!;

describe("§6 필드 단위 blocker — 「✗ 배송」에서 멈추지 않는다", () => {
  const checks = buildSummaryChecks(LOTTEON_FIELDS);

  it("🔴 배송이 막는 «이유» 가 항목 이름으로 나온다", () => {
    const shipping = find(checks, "배송");
    expect(shipping.passed).toBe(false);
    expect(shipping.blocking.map((b) => b.label)).toEqual(["출고지번호", "회수지(반품지)번호"]);
  });

  it("🔴 왜 막는지가 따라온다 — 다만 API 내부 필드명은 «걷어낸다»", () => {
    const notice = find(checks, "고시정보");
    expect(notice.blocking[0]!.label).toBe("상품품목코드(고시)");
    // 검증기 원문: "상품품목코드(PD_ITMS_CD)가 지정되지 않았습니다."
    // 🔴 CEO 지시(2026-09-22): API 내부 필드명을 셀러에게 그대로 보이지 않는다.
    expect(notice.blocking[0]!.hint).toBe("상품품목코드가 지정되지 않았습니다.");
  });

  it("🔴 문장을 «새로 쓰지» 않는다 — 지우기만 한다(검증기와 화면이 다른 말을 하면 안 된다)", () => {
    const shipping = find(checks, "배송");
    // 원문의 첫 문장이 그대로다. 뒤따르던 「임의 값을 보낼 수 없습니다」(구현
    // 사정)만 빠졌고, 우리가 지어낸 단어는 하나도 없다.
    expect(shipping.blocking[0]!.hint).toBe(
      "출고지번호는 롯데ON 판매자센터(또는 거래처 API)에 먼저 등록돼 있어야 합니다.",
    );
  });

  it("🔴 한 자리에 세 개까지만 편다 — 우측은 «요약» 이지 목록이 아니다", () => {
    const many = buildSummaryChecks(
      Array.from({ length: 5 }, (_, i) => item({ label: `필드${i}`, sectionId: "lotteon-section-shipping" })),
    );
    const shipping = many.find((c) => c.label === "배송")!;
    expect(shipping.blocking).toHaveLength(3);
    expect(shipping.hiddenBlockingCount).toBe(2);
  });

  it("🔴 「채널 필수정보」도 무엇인지 말한다 — 이름만으로는 아무것도 알 수 없었다", () => {
    expect(find(checks, "채널 필수정보").blocking.map((b) => b.label)).toEqual(["수입대행코드"]);
  });

  it("어디서 고치는지(sectionId)를 들고 간다 — 클릭해서 갈 자리다", () => {
    expect(find(checks, "배송").blocking[0]!.sectionId).toBe("lotteon-section-shipping");
  });

  it("🔴 통과한 자리는 blocking 이 비어 있다 — 통과했는데 뭔가 남아 있으면 안 된다", () => {
    expect(find(checks, "카테고리").passed).toBe(true);
    expect(find(checks, "카테고리").blocking).toEqual([]);
    expect(find(checks, "상품정보").blocking).toEqual([]);
  });
});

describe("무회귀 — passed 판정은 한 글자도 바뀌지 않았다", () => {
  it("한 항목이라도 막으면 그 자리는 실패다", () => {
    const checks = buildSummaryChecks(LOTTEON_FIELDS);
    expect(checks.filter((c) => !c.passed).map((c) => c.label)).toEqual(["배송", "고시정보", "채널 필수정보"]);
  });

  it("전부 통과하면 전부 ✓ 이고 blocking 은 모두 비어 있다", () => {
    const checks = buildSummaryChecks(LOTTEON_FIELDS.map((f) => ({ ...f, passed: true })));
    expect(checks.every((c) => c.passed)).toBe(true);
    expect(checks.every((c) => c.blocking.length === 0)).toBe(true);
  });

  it("항목이 하나도 없는 자리는 여전히 «나오지 않는다»", () => {
    const checks = buildSummaryChecks([item({ label: "표준카테고리", passed: true, sectionId: "lotteon-section-category" })]);
    expect(checks.map((c) => c.label)).toEqual(["카테고리"]);
  });

  it("🔴 화면 밖에서 고쳐야 하는 항목은 «판매자 설정» 자리로 가고 갈 곳을 들고 간다", () => {
    const checks = buildSummaryChecks([item({ label: "판매자 기본 배송비", externalHref: "/settings" })]);
    const seller = find(checks, "판매자 설정");
    expect(seller.blocking[0]!.externalHref).toBe("/settings");
  });
});
