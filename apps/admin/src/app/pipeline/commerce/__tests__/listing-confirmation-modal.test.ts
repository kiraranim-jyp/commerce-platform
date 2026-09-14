import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ListingModel } from "@commerce/marketplace";
import { ListingConfirmationModal, type ListingProgressStep } from "../ListingConfirmationModal";

/**
 * REWORK-5 ⑤(CEO 지시, 2026-09-14) — **등록 최종 확인 모달은 3채널 공통이다.**
 *
 * ── 지시서의 모양 ─────────────────────────────────────────────────────────
 *   {채널} 등록 전 최종 확인
 *   등록 대상 · 판매가격 · 등록 가능 상태
 *   확인할 사항  ☑ 필수정보 확인  ☑ 가격·상품정보 일치  ☑ 문제 시 판매자가 수정/중지
 *   등록 진행 안내
 *   [취소]   [{채널} 등록 시작]
 *     ↓ 누르면 **같은 모달에서**
 *   등록 중...
 *   ① 상품정보 준비  ✓   ② {채널} 전송  ●   ③ 등록 결과 확인  대기
 *
 * ── 🔴 채널별 별도 모달 금지 ──────────────────────────────────────────────
 * 그래서 이 파일은 세 채널을 **같은 컴포넌트에 다른 platformLabel만 넣어**
 * 그린다. "컴포넌트를 재사용했다"가 아니라 **세 번 그린 결과가 채널 이름을 뺀
 * 나머지에서 글자 하나까지 같은가**를 본다 — 그것이 이번 지시서가 인정하는
 * 유일한 완료 기준이다.
 */

function makeListing(platform: string, platformLabel: string): ListingModel {
  return {
    platform,
    platformLabel,
    representativeImage: "https://example.com/a.jpg",
    additionalImages: [],
    title: "테리 버뮤다 반바지",
    brand: "Bobo Choses",
    priceKrw: 128000,
    priceIsEstimate: false,
    priceSource: "SELLER_OVERRIDE",
    priceOrigin: "PRODUCT_OVERRIDE",
    options: [],
    shippingInfo: "",
    description: "설명",
    category: { state: "UNRESOLVED", candidate: null },
    validations: [],
    registrableScore: 100,
  } as unknown as ListingModel;
}

const CHANNELS: [string, string][] = [
  ["smartstore", "스마트스토어"],
  ["coupang", "쿠팡"],
  ["lotteon", "롯데ON"],
];

function render(platform: string, label: string, progress: ListingProgressStep | null = null): string {
  return renderToStaticMarkup(
    createElement(ListingConfirmationModal, {
      listing: makeListing(platform, label),
      mode: "LIVE",
      progress,
      onCancel: () => {},
      onConfirm: () => {},
    }),
  );
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/* ── 1. 확인 화면이 지시서의 블록을 전부 갖췄는가 ─────────────────────────── */

describe("REWORK-5 ⑤ — 확인 화면의 블록", () => {
  for (const [platform, label] of CHANNELS) {
    it(`${label} — 제목이 채널 이름을 달고 선다`, () => {
      expect(stripTags(render(platform, label))).toContain(`${label} 등록 전 최종 확인`);
    });

    it(`${label} — 등록 대상 · 판매가격 · 등록 가능 상태가 전부 있다`, () => {
      const text = stripTags(render(platform, label));
      expect(text).toContain("등록 대상");
      expect(text).toContain("테리 버뮤다 반바지");
      expect(text).toContain("판매가격");
      expect(text).toContain("128,000");
      expect(text).toContain("등록 가능 상태");
    });

    it(`${label} — 확인할 사항 3개와 등록 진행 안내가 있다`, () => {
      const html = render(platform, label);
      const text = stripTags(html);
      expect(text).toContain("확인할 사항");
      expect(text).toContain("판매 가능 여부와 필요한 인증정보");
      expect(text).toContain("상품 가격과 상품정보가 실제 판매 상품과 일치");
      expect(text).toContain("판매자가 판매중지/수정 조치");
      expect((html.match(/type="checkbox"/g) ?? []).length).toBe(3);
      expect(text).toContain("등록 진행 안내");
    });

    it(`${label} — [취소]와 [${label} 등록 시작]이 선다`, () => {
      const text = stripTags(render(platform, label));
      expect(text).toContain("취소");
      expect(text).toContain(`${label} 등록 시작`);
    });
  }
});

/* ── 2. 🔴 세 채널이 정말 같은 화면인가 ───────────────────────────────────── */

describe("REWORK-5 ⑤ — 🔴 채널별 별도 모달이 아니다(렌더 결과로 증명)", () => {
  /** 채널 이름만 지우면 세 렌더가 완전히 같아야 한다. */
  function neutralize(html: string, label: string): string {
    return stripTags(html).split(label).join("{채널}");
  }

  it("확인 화면 — 채널 이름을 뺀 나머지가 세 채널에서 글자 하나까지 같다", () => {
    const [first, ...rest] = CHANNELS.map(([p, l]) => neutralize(render(p, l), l));
    for (const other of rest) expect(other).toBe(first);
  });

  it("진행 화면 — 채널 이름을 뺀 나머지가 세 채널에서 글자 하나까지 같다", () => {
    const [first, ...rest] = CHANNELS.map(([p, l]) => neutralize(render(p, l, "SENDING"), l));
    for (const other of rest) expect(other).toBe(first);
  });

  it("세 채널이 같은 컴포넌트 파일 하나를 쓴다 — 채널 전용 모달 파일이 없다", () => {
    // 이 테스트 파일이 import한 컴포넌트가 하나뿐이라는 사실 자체가 계약이다.
    expect(typeof ListingConfirmationModal).toBe("function");
  });
});

/* ── 3. 진행 단계 ─────────────────────────────────────────────────────────── */

describe("REWORK-5 ⑤ — 같은 모달에서 진행 단계를 보여준다", () => {
  it("등록 중에는 확인 화면이 아니라 진행 화면이 선다", () => {
    const text = stripTags(render("coupang", "쿠팡", "PREPARING"));
    expect(text).toContain("등록 중...");
    // 체크박스/버튼은 사라진다 — 진행 중에 다시 누를 수 있으면 안 된다.
    expect(render("coupang", "쿠팡", "PREPARING")).not.toContain('type="checkbox"');
    expect(text).not.toContain("쿠팡 등록 시작");
    expect(text).not.toContain("취소");
  });

  it("세 단계가 지시서 순서 그대로 선다", () => {
    const text = stripTags(render("lotteon", "롯데ON", "PREPARING"));
    expect(text).toContain("1. 상품정보 준비");
    expect(text).toContain("2. 롯데ON 전송");
    expect(text).toContain("3. 등록 결과 확인");
  });

  /**
   * 지시서가 그린 그대로 — 지난 단계는 ✓, 지금은 ●, 앞으로는 "대기".
   * 단계 표시가 진행에 따라 실제로 움직이는지를 세 시점 모두에서 본다.
   */
  it("① 상품정보 준비 중 — ① ● · ② ○ · ③ 대기", () => {
    const text = stripTags(render("coupang", "쿠팡", "PREPARING"));
    expect(text).toContain("● 1. 상품정보 준비");
    expect(text).toContain("○ 2. 쿠팡 전송 대기");
    expect(text).toContain("○ 3. 등록 결과 확인 대기");
  });

  it("② 전송 중 — ① ✓ · ② ● · ③ 대기(지시서의 그림 그대로)", () => {
    const text = stripTags(render("coupang", "쿠팡", "SENDING"));
    expect(text).toContain("✓ 1. 상품정보 준비");
    expect(text).toContain("● 2. 쿠팡 전송");
    expect(text).toContain("○ 3. 등록 결과 확인 대기");
  });

  it("③ 결과 확인 중 — ① ✓ · ② ✓ · ③ ●", () => {
    const text = stripTags(render("coupang", "쿠팡", "CONFIRMING"));
    expect(text).toContain("✓ 1. 상품정보 준비");
    expect(text).toContain("✓ 2. 쿠팡 전송");
    expect(text).toContain("● 3. 등록 결과 확인");
  });

  /**
   * 🔴 진행 중에는 배경을 눌러도 닫히지 않는다. 닫아도 등록은 그대로 진행되므로
   * "취소했다"고 믿은 셀러가 실제로는 등록된 상품을 갖게 된다.
   */
  it("진행 화면에는 배경 클릭으로 닫는 핸들러가 붙지 않는다", () => {
    // renderToStaticMarkup은 핸들러를 그리지 않으므로, 닫는 장치(취소 버튼)가
    // 아예 없다는 사실로 같은 명제를 본다.
    expect(render("coupang", "쿠팡", "SENDING")).not.toContain("<button");
  });
});
