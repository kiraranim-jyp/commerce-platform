import { describe, expect, it } from "vitest";
import { assembleContentsFromBlocks, type DetailPageBlock } from "../coupang/build-payload";
import { detailBlockIdentity, mergeProductDetailBlocks } from "../common/detail-override";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P0-2(CEO 요구, 2026-10-09) — **블록 나열이 아니라 「항목」이다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 가 원한 구조:
 *   [상품 특징]  텍스트 + 이미지
 *   [사이즈 정보] 텍스트 + 이미지
 *
 * 지금까지는 «제목» 이라는 칸이 없어서 텍스트 블록과 이미지 블록이 서로를
 * 모르는 두 조각이었다. heading 을 더해 한 항목으로 묶는다.
 *
 * 🔴 optional 이다 — 운영 중인 detailOverride 121건에 이 칸이 «없고», 없으면
 *    지금까지와 한 글자도 다르지 않게 조립된다. 그 회귀가 ③ 이다.
 */
const CTX = {
  aiDescription: "",
  template: null,
  sellerConfig: {} as never,
  productImageUrls: [],
  sizeChartImageUrls: [],
  brandIntro: null,
};
const text = (c: Partial<Extract<DetailPageBlock, { kind: "CUSTOM_TEXT" }>>) =>
  ({ id: "t1", kind: "CUSTOM_TEXT", content: "", enabled: true, ...c }) as DetailPageBlock;
const image = (c: Partial<Extract<DetailPageBlock, { kind: "CUSTOM_IMAGE" }>>) =>
  ({ id: "i1", kind: "CUSTOM_IMAGE", url: "https://cdn.example.com/a.jpg", enabled: true, ...c }) as DetailPageBlock;
const flat = (blocks: DetailPageBlock[]) =>
  assembleContentsFromBlocks(blocks, CTX as never).flatMap((c) =>
    c.contentDetails.map((d) => `${c.contentsType}:${d.content}`),
  );

describe("🔴🔴 ① 텍스트 항목이 제목을 갖는다", () => {
  it("제목이 본문 «앞» 에 온다", () => {
    expect(flat([text({ heading: "상품 특징", content: "가볍고 따뜻합니다" })])).toEqual([
      "TEXT:상품 특징\n가볍고 따뜻합니다",
    ]);
  });

  it("제목만 있어도 항목 이름이 나간다", () => {
    expect(flat([text({ heading: "사이즈 정보", content: "" })])).toEqual(["TEXT:사이즈 정보"]);
  });

  it("🔴 제목이 없으면 지금까지와 «같다» — 121건 호환", () => {
    expect(flat([text({ content: "그냥 본문" })])).toEqual(["TEXT:그냥 본문"]);
  });

  it("본문도 제목도 없으면 아무것도 내지 않는다", () => {
    expect(flat([text({ content: "   " })])).toEqual([]);
  });
});

describe("🔴🔴 ② 이미지 항목도 제목을 갖는다 — 제목은 «위», 문구는 «아래»", () => {
  it("제목 → 이미지 → 문구 순서다", () => {
    expect(flat([image({ heading: "소재 정보", caption: "확대 사진" })])).toEqual([
      "TEXT:소재 정보",
      "IMAGE:https://cdn.example.com/a.jpg",
      "TEXT:확대 사진",
    ]);
  });

  it("🔴 제목이 캡션 자리로 내려가지 않는다 — 그러면 항목 이름이 아니다", () => {
    const got = flat([image({ heading: "소재 정보" })]);
    expect(got[0]).toBe("TEXT:소재 정보");
    expect(got[1]).toContain("IMAGE:");
  });

  it("🔴 제목이 없으면 지금까지와 «같다» — 이미지 다음에 캡션", () => {
    expect(flat([image({ caption: "확대 사진" })])).toEqual([
      "IMAGE:https://cdn.example.com/a.jpg",
      "TEXT:확대 사진",
    ]);
  });
});

describe("🔴🔴 ③ 한 항목이 텍스트와 이미지를 함께 갖는다 (CEO 구조)", () => {
  it("[상품 특징] 텍스트 + 이미지 · [사이즈 정보] 텍스트 + 이미지", () => {
    const got = flat([
      text({ id: "t1", heading: "상품 특징", content: "가볍고 따뜻합니다" }),
      image({ id: "i1", heading: "상품 특징", url: "https://cdn.example.com/f.jpg" }),
      text({ id: "t2", heading: "사이즈 정보", content: "2~10세" }),
      image({ id: "i2", heading: "사이즈 정보", url: "https://cdn.example.com/s.jpg" }),
    ]);
    /* 🔴 텍스트는 다음 이미지 «직전» 에 한 번에 흘러나간다(기존 flushText 규칙).
       같은 항목의 제목·본문이 한 TEXT 로 묶이는 것이 정확한 모양이다. */
    expect(got).toHaveLength(4);
    expect(got[0]).toContain("상품 특징");
    expect(got[0]).toContain("가볍고 따뜻합니다");
    expect(got[1]).toBe("IMAGE:https://cdn.example.com/f.jpg");
    expect(got[2]).toContain("사이즈 정보");
    expect(got[2]).toContain("2~10세");
    expect(got[3]).toBe("IMAGE:https://cdn.example.com/s.jpg");
    /* 🔴 다음 항목의 말이 앞 항목에 섞이지 «않는다». */
    expect(got[0]).not.toContain("사이즈 정보");
  });

  it("🔴 순서가 보존된다 — 항목끼리 섞이지 않는다", () => {
    const got = flat([
      text({ id: "a", heading: "A", content: "1" }),
      text({ id: "b", heading: "B", content: "2" }),
    ]);
    expect(got[0]).toContain("A");
    expect(got[0]!.indexOf("A")).toBeLessThan(got[0]!.indexOf("B"));
  });
});

describe("🔴 ④ 저장/복원이 제목을 잃지 않는다", () => {
  const patchOf = (block: DetailPageBlock, patch: Record<string, unknown>) =>
    mergeProductDetailBlocks([block], { patches: { [detailBlockIdentity(block)]: patch } } as never)[0] as Record<
      string,
      unknown
    >;

  it("CUSTOM_TEXT 제목을 덮어쓴다", () => {
    const next = patchOf(text({ heading: "옛 제목", content: "본문" }), { heading: "새 제목" });
    expect(next.heading).toBe("새 제목");
    expect(next.content).toBe("본문");
  });

  it("CUSTOM_IMAGE 제목을 덮어쓴다", () => {
    const next = patchOf(image({ heading: "옛", caption: "캡션" }), { heading: "새" });
    expect(next.heading).toBe("새");
    expect(next.caption).toBe("캡션");
  });

  it("🔴 patch 에 heading 이 없으면 기존 제목을 «지우지 않는다»", () => {
    const next = patchOf(text({ heading: "유지", content: "x" }), { content: "y" });
    expect(next.heading).toBe("유지");
    expect(next.content).toBe("y");
  });
});
