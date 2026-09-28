import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveNoticeFieldValue } from "../../notice/reference-eligibility";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WIRE-03 색상 — **통합할 사다리가 «없다». 그래서 경계를 고정한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 조사 결과 ─────────────────────────────────────────────────────────────
 * 원산지·제조사와 달리 색상에는 폴백 사슬이 없다. 세 채널 모두 `product.color`
 * 하나만 본다 —
 *
 *   쿠팡    coupang/build-payload.ts   `product.color.value || undefined`
 *   롯데ON  lotteon/_lib/build-context `product.color.value`
 *   네이버  naver/build-payload.ts     `resolveNoticeFieldValue("color", product.color)`
 *
 * 그래서 `resolveCommonColor()` 를 만들면 `product.color.value` 를 그대로
 * 돌려주는 껍데기가 된다. 🔴 층을 위해 층을 만들지 않는다.
 *
 * ── 🔴 그런데 «하나» 가 다르다. 그리고 그것은 사고가 아니라 «결정» 이다 ──
 * 네이버만 「상세페이지 참조」 대체를 쓴다. 그 함수는 이미 공통 폴더에 있다
 * (`notice/reference-eligibility.ts`). 쿠팡·롯데ON 은 쓰지 않는다.
 *
 * 롯데ON 에 그 길을 여는 것은 **CPO 가 보류한 사안** 이다 —
 *
 *   「롯데ON 이 그 표기를 받아들이는지 «확인한 적이 없다» — 확인 없이 열면
 *    오등록이다」(P0-B-SOURCE-EVIDENCE.md ③)
 *   「오등록 가능성이 있는 우회로를 Readiness 해제 수단으로 쓰지 않습니다」(CPO)
 *
 * 🔴 그래서 이 파일이 지키는 것은 「셋을 같게 만들라」가 아니라 **「셋이 다른
 * 것은 결정이고, 그 결정을 모르는 사람이 «통합» 이라는 이름으로 조용히
 * 뒤집지 못하게」** 다.
 */

const LISTING = join(__dirname, "..", "..");
const ADMIN = join(LISTING, "..", "..", "..", "apps", "admin", "src", "app", "api");
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
/** 🔴 주석을 벗기고 본다 — 이 저장소에서 같은 함정에 여덟 번 걸렸다. */
const codeOf = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const COUPANG = read(join(LISTING, "coupang", "build-payload.ts"));
const NAVER = read(join(LISTING, "naver", "build-payload.ts"));
const LOTTEON_CTX = read(join(ADMIN, "lotteon", "_lib", "build-context.ts"));

describe("① 색상은 «단일 출처» 다 — 세 채널이 상품 값만 본다", () => {
  it("쿠팡", () => {
    expect(codeOf(COUPANG)).toContain("color: product.color.value || undefined");
  });

  it("롯데ON", () => {
    expect(codeOf(LOTTEON_CTX)).toContain("color: product.color.value");
  });

  it("네이버 — 같은 필드를 보되 참조 대체를 «거쳐서» 본다", () => {
    expect(codeOf(NAVER)).toContain('resolveNoticeFieldValue("color", product.color)');
  });
});

describe("🔴 ② 「상세페이지 참조」는 네이버 «만» 의 길이다 (CPO 보류 보호)", () => {
  it("값이 있으면 셋 다 같은 값이다 — 여기에는 차이가 없다", () => {
    const field = { value: "Lavender", source: "ORIGINAL" as const, confidence: 1 };
    expect(resolveNoticeFieldValue("color", field)).toBe("Lavender");
  });

  it("🔴 값이 없고 판매자가 «참조» 를 골랐을 때만 네이버가 문구로 대체한다", () => {
    const referenced = { value: "", source: "DETAIL_PAGE_REFERENCE" as const, confidence: 1 };
    expect(resolveNoticeFieldValue("color", referenced)).toBe("상품 상세페이지 참조");
    /* 참조를 고르지 «않았으면» 대체하지 않는다 — 빈 값은 빈 값이다. */
    expect(resolveNoticeFieldValue("color", { value: "", source: "ORIGINAL", confidence: 1 })).toBeUndefined();
  });

  it("🔴 롯데ON 이 참조 경로를 «쓰지 않는다» — 열려면 CPO 결정이 먼저다", () => {
    const code = codeOf(LOTTEON_CTX);
    expect(code).not.toContain("resolveNoticeFieldValue");
    expect(code).not.toContain("DETAIL_PAGE_REFERENCE_TEXT");
  });

  it("🔴 쿠팡도 아직 그 길을 쓰지 않는다 — 결정 기록이 없다", () => {
    const code = codeOf(COUPANG);
    expect(code).not.toContain("resolveNoticeFieldValue");
  });
});

describe("🔴 ③ 색상을 «정규화하거나 코드로 바꾸지» 않는다", () => {
  it.each([
    ["Lavender", "Lavender"],
    ["라벤더", "라벤더"],
    ["  Navy  ", "  Navy  "],
    ["Blue/Green", "Blue/Green"],
  ])("%s 는 그대로 나간다", (input, expected) => {
    expect(resolveNoticeFieldValue("color", { value: input, source: "ORIGINAL", confidence: 1 })).toBe(expected);
  });

  it("🔴 색상 이름→코드 표가 어디에도 없다", () => {
    for (const source of [COUPANG, NAVER, LOTTEON_CTX]) {
      const code = codeOf(source);
      /* 「Lavender: "…"」 같은 지도가 한 줄만 생겨도 잡는다. */
      expect(code).not.toMatch(/(Lavender|라벤더|Navy|네이비)\s*:/);
    }
  });
});
