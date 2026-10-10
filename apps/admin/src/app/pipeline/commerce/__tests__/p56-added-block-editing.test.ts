/**
 * ══════════════════════════════════════════════════════════════════════════
 *  P5.6 후속 ③ — **추가 블록의 상품별 편집** (CPO 확정 2026-10-10)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 고정한 한 문장:
 *
 *   「기본 상세페이지 블록은 건드리지 않는다. 상품에 추가한 블록 각각에 대해
 *     텍스트와 이미지를 상품별로 수정·추가·교체·삭제할 수 있게 한다.」
 *
 * ── CPO ⑦ 의 답 — 코드로 가린 것 ────────────────────────────────────────
 *
 * 「`+ 이 상품 이미지` 만 편집되는 것이 설계인가」 → **설계 의도가 아니라 구조적
 * 한계였다.** 여덟 kind 중 자기 데이터를 «가진» 것은 둘뿐이었다:
 *
 *   CUSTOM_TEXT       content      ← 가짐
 *   CUSTOM_IMAGE      url/caption  ← 가짐
 *   AI_DESCRIPTION    ctx.aiDescription        ← 문맥에서 읽음(고칠 자리 없음)
 *   BRAND_INTRO       ctx.brandIntro           ← 문맥
 *   PRODUCT_IMAGES    ctx.productImageUrls     ← 문맥
 *   SIZE_CHART_IMAGES ctx.sizeChartImageUrls   ← 문맥
 *   TEMPLATE_SECTION  ctx.template             ← 셀러 설정 소유 · 추가 불가
 *   COMMON_IMAGE      ctx.sellerConfig         ← 셀러 설정 소유 · 추가 불가
 *
 * 그래서 「추가했는데 고칠 수가 없다」가 된 것이다.
 *
 * ── 이 가드가 지키는 경계 ───────────────────────────────────────────────
 * override 칸은 **전부 optional** 이고 셀러 기본 블록에는 들어가지 않는다.
 * 값이 없으면 조립기는 문맥값을 읽는다 — 기존 등록 결과가 한 글자도 안 바뀐다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assembleContentsFromBlocks,
  mergeProductDetailBlocks,
  type DetailPageBlock,
} from "@commerce/listing";

const REPO = join(__dirname, "../../../../../../..");
const strip = (src: string) =>
  readFileSync(join(REPO, src), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

/** 조립기 문맥 — 실제 호출부가 넘기는 모양 그대로. */
const CTX = {
  aiDescription: "원본 상세설명 본문입니다.",
  template: null,
  sellerConfig: {
    topCommonImageEnabled: false,
    topCommonImageUrl: "",
    bottomCommonImageEnabled: false,
    bottomCommonImageUrl: "",
  },
  productImageUrls: ["https://cdn.example.com/p1.jpg", "https://cdn.example.com/p2.jpg"],
  sizeChartImageUrls: ["https://cdn.example.com/size.jpg"],
  brandIntro: "브랜드 관리에 저장된 소개글입니다.",
} as never;

/** 조립 결과를 텍스트/이미지로 평탄화 — 단정을 읽기 쉽게 한다. */
function flatten(blocks: DetailPageBlock[]) {
  const out = assembleContentsFromBlocks(blocks, CTX) as never as {
    contentsType: string;
    contentDetails: { content: string }[];
  }[];
  return {
    texts: out.filter((c) => c.contentsType === "TEXT").flatMap((c) => c.contentDetails.map((d) => d.content)),
    images: out.filter((c) => c.contentsType === "IMAGE").flatMap((c) => c.contentDetails.map((d) => d.content)),
  };
}

/* ══ 0. 절대 변경하지 않을 범위 — 기본 블록 ═════════════════════════════ */
describe("0. 기본 블록은 «한 글자도» 바뀌지 않는다 (CPO 절대 경계)", () => {
  const sellerDefault: DetailPageBlock[] = [
    { id: "d1", kind: "AI_DESCRIPTION", enabled: true },
    { id: "d2", kind: "BRAND_INTRO", enabled: true },
    { id: "d3", kind: "PRODUCT_IMAGES", enabled: true },
    { id: "d4", kind: "SIZE_CHART_IMAGES", enabled: true },
  ];

  it("🔴 무편집이면 셀러 기본값 «그 객체» 가 그대로 나온다", () => {
    expect(mergeProductDetailBlocks(sellerDefault, null)).toBe(sellerDefault);
    expect(mergeProductDetailBlocks(sellerDefault, undefined)).toBe(sellerDefault);
  });

  it("🔴 기본 블록은 문맥값을 읽는다 — override 칸이 없으므로 전과 동일", () => {
    const { texts, images } = flatten(sellerDefault);
    /* 🔴 블록 사이는 `\n\n` 이고 제목-본문 사이는 `\n` 이다(조립기 flushText).
       내가 `\n` 하나로 단정했다가 틀렸다 — 두 구분자는 다른 뜻이다. */
    expect(texts).toEqual(["원본 상세설명 본문입니다.\n\n브랜드 관리에 저장된 소개글입니다."]);
    expect(images).toEqual([
      "https://cdn.example.com/p1.jpg",
      "https://cdn.example.com/p2.jpg",
      "https://cdn.example.com/size.jpg",
    ]);
  });

  it("🔴 기본 블록에 제목이 붙지 «않는다» — 셀러가 적은 적이 없다", () => {
    const { texts } = flatten(sellerDefault);
    expect(texts.join("\n")).not.toContain("브랜드 소개");
  });

  it("🔴 UI 가 기본 블록에는 편집칸을 그리지 않는다 — `isProductOnly` 로 막는다", () => {
    const panel = strip("apps/admin/src/app/pipeline/commerce/ProductDetailBlocksPanel.tsx");
    expect(panel).toContain('isProductOnly && (block.kind === "AI_DESCRIPTION" || block.kind === "BRAND_INTRO")');
    expect(panel).toContain('isProductOnly && (block.kind === "PRODUCT_IMAGES" || block.kind === "SIZE_CHART_IMAGES")');
  });

  it("🔴 `patches` 에 파생 블록용 칸을 열지 «않았다» — 열면 기본 블록이 바뀐다", () => {
    const ov = strip("packages/listing/src/common/detail-override.ts");
    const patchType = /export interface DetailBlockPatch \{([\s\S]*?)\n\}/.exec(ov)?.[1] ?? "";
    expect(patchType.length).toBeGreaterThan(0);
    expect(patchType).not.toContain("textOverride");
    expect(patchType).not.toContain("imageUrlsOverride");
    expect(patchType).not.toContain("url");
  });

  it("🔴 추가 블록 편집은 `override.added` 를 고친다 — patches 가 아니다", () => {
    const panel = strip("apps/admin/src/app/pipeline/commerce/ProductDetailBlocksPanel.tsx");
    expect(panel).toContain("function patchAdded(");
    expect(panel).toContain("commit({ ...override, added });");
  });
});

/* ══ ⑥ 추가 블록별 — 텍스트 ═════════════════════════════════════════════ */
describe("⑥ AI 생성 설명 · 브랜드 소개 — 상품별 텍스트 수정", () => {
  it("🔴 AI 생성 설명을 이 상품에서만 갈아끼운다", () => {
    const { texts } = flatten([
      { id: "a", kind: "AI_DESCRIPTION", enabled: true, textOverride: "이 상품만의 설명." },
    ]);
    expect(texts).toEqual(["이 상품만의 설명."]);
    expect(texts.join()).not.toContain("원본 상세설명");
  });

  it("🔴 브랜드 소개를 제목 + 본문으로 수정한다(CPO 예시)", () => {
    const { texts } = flatten([
      {
        id: "b",
        kind: "BRAND_INTRO",
        enabled: true,
        heading: "Louis Louise",
        textOverride: "프랑스 키즈 브랜드입니다.",
      },
    ]);
    expect(texts).toEqual(["Louis Louise\n프랑스 키즈 브랜드입니다."]);
  });

  it("🔴 override 가 «없으면» 문맥값 — 기본 문구로 되돌리기가 동작한다", () => {
    const { texts } = flatten([{ id: "b", kind: "BRAND_INTRO", enabled: true }]);
    expect(texts).toEqual(["브랜드 관리에 저장된 소개글입니다."]);
  });

  it("🔴 빈 문자열은 「본문 없음」이고 «문맥값으로 되돌아가지 않는다»", () => {
    /* `??` 와 `||` 의 차이가 여기서 사실을 가른다 — `||` 면 셀러가 비운 선택이
       조용히 무시되고 원본 문구가 다시 나간다. */
    const { texts } = flatten([{ id: "a", kind: "AI_DESCRIPTION", enabled: true, textOverride: "" }]);
    expect(texts).toEqual([]);
  });

  it("제목만 적고 본문은 문맥값을 쓰는 것도 된다", () => {
    const { texts } = flatten([{ id: "a", kind: "AI_DESCRIPTION", enabled: true, heading: "상품 특징" }]);
    expect(texts).toEqual(["상품 특징\n원본 상세설명 본문입니다."]);
  });
});

/* ══ ⑥ 추가 블록별 — 이미지 ═════════════════════════════════════════════ */
describe("⑥ 사이즈표 · 상품 상세이미지 — 상품별 이미지 추가/교체/삭제", () => {
  it("🔴 이미지 목록을 이 상품에서만 갈아끼운다(교체)", () => {
    const { images } = flatten([
      {
        id: "s",
        kind: "SIZE_CHART_IMAGES",
        enabled: true,
        imageUrlsOverride: ["https://cdn.example.com/my-size.jpg"],
      },
    ]);
    expect(images).toEqual(["https://cdn.example.com/my-size.jpg"]);
  });

  it("🔴 추가 — 목록에 더하면 둘 다 나간다", () => {
    const { images } = flatten([
      {
        id: "p",
        kind: "PRODUCT_IMAGES",
        enabled: true,
        imageUrlsOverride: ["https://cdn.example.com/p1.jpg", "https://cdn.example.com/extra.jpg"],
      },
    ]);
    expect(images).toEqual(["https://cdn.example.com/p1.jpg", "https://cdn.example.com/extra.jpg"]);
  });

  it("🔴 삭제 — 빈 배열은 「이미지 없음」이고 문맥값으로 되돌아가지 않는다", () => {
    const { images } = flatten([{ id: "p", kind: "PRODUCT_IMAGES", enabled: true, imageUrlsOverride: [] }]);
    expect(images).toEqual([]);
  });

  it("🔴 override 가 없으면 문맥값 — 기본 이미지로 되돌리기가 동작한다", () => {
    const { images } = flatten([{ id: "p", kind: "PRODUCT_IMAGES", enabled: true }]);
    expect(images).toEqual(["https://cdn.example.com/p1.jpg", "https://cdn.example.com/p2.jpg"]);
  });

  it("🔴 제목 + 이미지가 «한 블록» 안에 같이 산다(CPO ④)", () => {
    const { texts, images } = flatten([
      {
        id: "s",
        kind: "SIZE_CHART_IMAGES",
        enabled: true,
        heading: "사이즈 정보",
        imageUrlsOverride: ["https://cdn.example.com/my-size.jpg"],
      },
    ]);
    expect(texts).toEqual(["사이즈 정보"]);
    expect(images).toEqual(["https://cdn.example.com/my-size.jpg"]);
  });
});

/* ══ ⑤ 저장 왕복 ════════════════════════════════════════════════════════ */
describe("⑤ 저장 → 재진입 — 수정값이 유지된다", () => {
  const sellerDefault: DetailPageBlock[] = [{ id: "d1", kind: "AI_DESCRIPTION", enabled: true }];
  const override = {
    added: [
      { id: "b", kind: "BRAND_INTRO", enabled: true, heading: "Louis Louise", textOverride: "프랑스 키즈." },
      { id: "s", kind: "SIZE_CHART_IMAGES", enabled: true, imageUrlsOverride: ["https://cdn.example.com/s.jpg"] },
      { id: "t", kind: "CUSTOM_TEXT", enabled: true, heading: "사이즈 정보", content: "실측 표 참고." },
    ],
  } as never;

  it("🔴 JSON 왕복 후에도 조립 결과가 «같다»", () => {
    const before = flatten(mergeProductDetailBlocks(sellerDefault, override));
    const reloaded = JSON.parse(JSON.stringify(override)) as never;
    const after = flatten(mergeProductDetailBlocks(sellerDefault, reloaded));
    expect(after).toEqual(before);
  });

  it("🔴 세 추가 블록의 값이 payload 에 «전부» 닿는다", () => {
    const { texts, images } = flatten(mergeProductDetailBlocks(sellerDefault, override));
    expect(texts.join("\n")).toContain("Louis Louise");
    expect(texts.join("\n")).toContain("프랑스 키즈.");
    expect(texts.join("\n")).toContain("사이즈 정보");
    expect(texts.join("\n")).toContain("실측 표 참고.");
    expect(images).toEqual(["https://cdn.example.com/s.jpg"]);
  });

  it("🔴 추가 블록을 꺼도 기본 블록은 남는다", () => {
    const off = { added: [{ id: "b", kind: "BRAND_INTRO", enabled: false, textOverride: "x" }] } as never;
    const { texts } = flatten(mergeProductDetailBlocks(sellerDefault, off));
    expect(texts).toEqual(["원본 상세설명 본문입니다."]);
  });
});

/* ══ ⑦ TEMPLATE_SECTION · COMMON_IMAGE 는 열지 않았다 ══════════════════ */
describe("⑦ 셀러 설정 소유 블록에는 override 칸을 «열지 않았다»", () => {
  it("🔴 타입에 override 칸이 없다 — 상품에서 추가할 수도 없는 블록이다", () => {
    const src = strip("packages/listing/src/coupang/build-payload.ts");
    const union = /export type DetailPageBlock =([\s\S]*?)\n\n/.exec(src)?.[1] ?? "";
    expect(union.length).toBeGreaterThan(0);
    const templateLine = /kind: "TEMPLATE_SECTION";[\s\S]*?\}/.exec(union)?.[0] ?? "";
    expect(templateLine).not.toContain("textOverride");
    expect(templateLine).not.toContain("imageUrlsOverride");
    const commonLine = /kind: "COMMON_IMAGE";[^}]*\}/.exec(union)?.[0] ?? "";
    expect(commonLine.length).toBeGreaterThan(0);
    expect(commonLine).not.toContain("Override");
  });

  it("추가 목록(ADDABLE)에도 그 둘이 없다", () => {
    const panel = strip("apps/admin/src/app/pipeline/commerce/ProductDetailBlocksPanel.tsx");
    const addable = /const ADDABLE[\s\S]*?\n\];/.exec(panel)?.[0] ?? "";
    expect(addable.length).toBeGreaterThan(0);
    expect(addable).not.toContain("TEMPLATE_SECTION");
    expect(addable).not.toContain("COMMON_IMAGE");
  });
});
