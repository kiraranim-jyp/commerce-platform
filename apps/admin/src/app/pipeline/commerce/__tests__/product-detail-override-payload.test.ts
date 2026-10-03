import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assembleContentsFromBlocks,
  assembleNaverDetailContent,
  defaultDetailBlocks,
  detailBlockIdentities,
  resolveDetailBlocks,
  resolveProductDetailBlocks,
  type DetailPageBlock,
  type ProductDetailOverride,
} from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCT-INFO-UX-06 PHASE 1-3 — **가장 중요한 회귀** (CEO 지시, 2026-10-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *     override 없음  → 기존 payload === 신규 payload
 *     override 있음  → 상품 수정사항 반영
 *     override 삭제  → 기존 payload 복귀
 *
 * 🔴 세 채널의 **실제 조립 함수를 실행** 해서 «최종 문자열» 을 비교한다.
 * commerce-detail-source.test.ts 가 「코드상 그렇다로 여섯 번 틀렸다」고 적어
 * 둔 저장소다 — 블록 배열이 같은지가 아니라 **payload 문자열이 같은지** 를 본다.
 *
 * 🔴 그리고 기존 최강 계약을 그대로 들고 온다:
 *     롯데ON 상세 콘텐츠 === 스마트스토어 상세 콘텐츠 (문자 단위)
 * override 가 있을 때도 깨지지 않아야 한다 — 둘이 같은 merge 함수 하나를
 * 통과하기 때문에 구조적으로 같아야 하고, 아니면 어딘가에 전용 경로가 생긴 것이다.
 */

const TEMPLATE = {
  shippingInfo: "평일 14시 이전 주문은 당일 출고됩니다.",
  exchangeInfo: "교환은 수령 후 7일 이내입니다.",
  returnInfo: "반품은 수령 후 7일 이내입니다.",
} as never;

const COMMON_IMAGES = {
  topCommonImageUrl: "https://cdn.example.com/seller/top-banner.jpg",
  topCommonImageEnabled: true,
  bottomCommonImageUrl: "https://cdn.example.com/seller/bottom-banner.jpg",
  bottomCommonImageEnabled: true,
};

const CTX = {
  aiDescription: "65% 코튼 혼방 테니스 상의입니다.",
  template: TEMPLATE,
  productImageUrls: ["https://cdn.example.com/product/1.jpg"],
  sizeChartImageUrls: ["https://cdn.example.com/product/size.jpg"],
  brandIntro: "세르지오 타키니는 이탈리아 테니스 브랜드입니다.",
};

/** 셀러가 Settings 에 실제로 저장해 둔 구성(기본값과 다르게 둔다). */
const SELLER_SAVED: DetailPageBlock[] = [
  { id: "default-0", kind: "COMMON_IMAGE", position: "top", enabled: true },
  { id: "default-1", kind: "PRODUCT_IMAGES", enabled: true },
  { id: "default-2", kind: "AI_DESCRIPTION", enabled: true },
  { id: "default-3", kind: "COMMON_IMAGE", position: "bottom", enabled: true },
  { id: "default-4", kind: "TEMPLATE_SECTION", section: "shipping", enabled: true },
];

/* ── 세 채널의 «최종 문자열» ─────────────────────────────────────────────── */

function smartstore(b: DetailPageBlock[]): string {
  return assembleNaverDetailContent(b, { ...CTX, commonImages: COMMON_IMAGES });
}
/** 🔴 롯데ON 은 스마트스토어와 «같은» 조립기를 쓴다(build-context.ts:131). */
function lotteon(b: DetailPageBlock[]): string {
  return assembleNaverDetailContent(b, { ...CTX, commonImages: COMMON_IMAGES });
}
function coupang(b: DetailPageBlock[]): string {
  return JSON.stringify(assembleContentsFromBlocks(b, { ...CTX, sellerConfig: { ...COMMON_IMAGES } as never }));
}

/** 세 채널 payload 를 한 번에. */
function payloads(sellerDefault: DetailPageBlock[] | null, override?: ProductDetailOverride | null) {
  const b = resolveProductDetailBlocks(sellerDefault, override);
  return { smartstore: smartstore(b), coupang: coupang(b), lotteon: lotteon(b) };
}

/** PRODUCT-INFO-UX-06 «이전» 의 코드 경로 — 비교 대조군. */
function legacyPayloads(sellerDefault: DetailPageBlock[] | null) {
  const b = resolveDetailBlocks(sellerDefault);
  return { smartstore: smartstore(b), coupang: coupang(b), lotteon: lotteon(b) };
}

const CHANNELS = ["smartstore", "coupang", "lotteon"] as const;

describe("① 🔴 override 없음 → 기존 payload 와 «문자 단위로» 같다", () => {
  for (const [label, sellerDefault] of [
    ["셀러가 저장한 구성", SELLER_SAVED],
    ["셀러 설정 없음(코드 상수 폴백)", null],
  ] as [string, DetailPageBlock[] | null][]) {
    describe(label, () => {
      const legacy = legacyPayloads(sellerDefault);

      for (const [ovLabel, ov] of [
        ["undefined", undefined],
        ["null", null],
        ["빈 객체", {}],
        ["빈 맵/배열만", { patches: {}, added: [], order: [] }],
      ] as [string, ProductDetailOverride | null | undefined][]) {
        it.each(CHANNELS)(`${ovLabel} → %s payload 동일`, (channel) => {
          expect(payloads(sellerDefault, ov)[channel]).toBe(legacy[channel]);
        });
      }

      it("🔴 세 payload 모두 비어 있지 않다 — 빈 문자열끼리 같다고 말하지 않는다", () => {
        for (const channel of CHANNELS) {
          expect(legacy[channel].length, `${channel} 가 비어 있다`).toBeGreaterThan(50);
        }
      });
    });
  }
});

describe("② override 있음 → 수정사항이 세 채널에 «모두» 반영된다", () => {
  const ADDED_TEXT = "이 상품은 유럽 사이즈 기준입니다 — 한 치수 크게 선택해 주세요.";
  const OVERRIDE: ProductDetailOverride = {
    patches: { "TEMPLATE_SECTION:shipping": { enabled: false } },
    added: [{ id: "p-0", kind: "CUSTOM_TEXT", content: ADDED_TEXT, enabled: true, customTextId: "ct-0" }],
  };

  it.each(CHANNELS)("%s — 추가한 문장이 payload 에 들어 있다", (channel) => {
    expect(payloads(SELLER_SAVED, OVERRIDE)[channel]).toContain(ADDED_TEXT);
  });

  it.each(CHANNELS)("%s — 끈 블록의 내용이 payload 에서 빠졌다", (channel) => {
    const before = payloads(SELLER_SAVED, undefined)[channel];
    const after = payloads(SELLER_SAVED, OVERRIDE)[channel];
    expect(before).toContain(TEMPLATE.shippingInfo);
    expect(after).not.toContain(TEMPLATE.shippingInfo);
  });

  it.each(CHANNELS)("%s — 건드리지 않은 것은 그대로다(셀러 공통 이미지)", (channel) => {
    const after = payloads(SELLER_SAVED, OVERRIDE)[channel];
    expect(after).toContain(COMMON_IMAGES.topCommonImageUrl);
    expect(after).toContain(COMMON_IMAGES.bottomCommonImageUrl);
    expect(after).toContain(CTX.aiDescription);
  });

  it("🔴 순서 변경이 payload 순서를 실제로 바꾼다", () => {
    const reordered = payloads(SELLER_SAVED, {
      order: ["AI_DESCRIPTION", "COMMON_IMAGE:top", "PRODUCT_IMAGES", "COMMON_IMAGE:bottom"],
    }).smartstore;
    const body = reordered.indexOf(CTX.aiDescription);
    const top = reordered.indexOf(COMMON_IMAGES.topCommonImageUrl);
    expect(body).toBeLessThan(top); // 기본값은 top → body 였다
    expect(payloads(SELLER_SAVED, undefined).smartstore.indexOf(COMMON_IMAGES.topCommonImageUrl)).toBeLessThan(
      payloads(SELLER_SAVED, undefined).smartstore.indexOf(CTX.aiDescription),
    );
  });

  it("🔴 템플릿 변경이 여전히 전파된다 — 상품이 설정에서 «분리되지» 않았다", () => {
    /* 셀러가 Settings 에서 블록을 하나 추가했다. 상품 override 는 그대로인데도
       새 블록이 상품 payload 에 나타나야 한다 — 방안 A(전체 복사)를 썼다면
       나타나지 않는다. 이것이 B 를 고른 이유다. */
    const sellerChanged: DetailPageBlock[] = [
      ...SELLER_SAVED,
      { id: "default-5", kind: "SIZE_CHART_IMAGES", enabled: true },
    ];
    const after = payloads(sellerChanged, OVERRIDE).smartstore;
    expect(after).toContain(CTX.sizeChartImageUrls[0]);
    /* 그리고 상품 override 도 여전히 살아 있다. */
    expect(after).toContain(ADDED_TEXT);
    expect(after).not.toContain(TEMPLATE.shippingInfo);
  });
});

describe("③ 🔴 override 삭제 → 기존 payload 로 «정확히» 복귀한다", () => {
  const legacy = legacyPayloads(SELLER_SAVED);

  it.each(CHANNELS)("%s — 편집 → 삭제 후 문자 단위로 원래와 같다", (channel) => {
    const edited = payloads(SELLER_SAVED, {
      patches: { AI_DESCRIPTION: { enabled: false }, "COMMON_IMAGE:top": { enabled: false } },
      added: [{ id: "p-0", kind: "CUSTOM_TEXT", content: "임시 안내", enabled: true, customTextId: "ct-0" }],
      order: ["PRODUCT_IMAGES"],
    })[channel];
    expect(edited).not.toBe(legacy[channel]);

    const reset = payloads(SELLER_SAVED, undefined)[channel];
    expect(reset).toBe(legacy[channel]);
    expect(reset).not.toContain("임시 안내");
    expect(reset).toContain(CTX.aiDescription);
  });
});

describe("④ 🔴 롯데ON === 스마트스토어 (문자 단위) — override 가 있어도 유지된다", () => {
  for (const [label, ov] of [
    ["override 없음", undefined],
    ["patch 만", { patches: { "TEMPLATE_SECTION:shipping": { enabled: false } } }],
    ["추가 블록", { added: [{ id: "p", kind: "CUSTOM_TEXT", content: "추가", enabled: true, customTextId: "ct-0" }] }],
    ["순서 변경", { order: ["AI_DESCRIPTION", "PRODUCT_IMAGES"] }],
  ] as [string, ProductDetailOverride | undefined][]) {
    it(`${label} — 한 글자라도 다르면 롯데ON 전용 가공이 생긴 것이다`, () => {
      const p = payloads(SELLER_SAVED, ov);
      expect(p.lotteon).toBe(p.smartstore);
    });
  }
});

describe("⑤ 🔴 세 채널이 «같은» 최종 블록 소스를 쓴다 — 배선 원문 확인", () => {
  const API = join(__dirname, "../../../api");
  const codeOnly = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
  const read = (rel: string) => codeOnly(readFileSync(join(API, rel), "utf8"));

  /* 🔴 소스 문자열 검사는 주석을 벗기고 한다 — 이 파일들의 주석에 함수 이름이
     설명으로 여러 번 나온다(여덟 번 걸린 함정). */
  const SEAMS = [
    ["쿠팡 등록", "coupang/register/route.ts"],
    ["쿠팡 미리보기", "coupang/payload-preview/route.ts"],
    ["롯데ON 상세조립", "lotteon/_lib/build-context.ts"],
    ["네이버 공통 resolver", "naver/_lib/resolve-context.ts"],
  ] as const;

  it.each(SEAMS)("%s 가 resolveProductDetailBlocks 를 부른다", (_label, rel) => {
    expect(read(rel)).toContain("resolveProductDetailBlocks(");
  });

  it.each(SEAMS)("🔴 %s 에 옛 resolveDetailBlocks 호출이 «남아 있지 않다» — 통로가 둘로 갈리면 안 된다", (_label, rel) => {
    expect(read(rel)).not.toMatch(/[^t]resolveDetailBlocks\(/);
  });

  it("🔴 네이버 통로가 «하나» 다 — 미리보기·실등록·readiness 가 같은 함수를 본다", () => {
    const src = read("naver/_lib/resolve-context.ts");
    expect((src.match(/resolveProductDetailBlocks\(/g) ?? []).length).toBe(1);
  });

  it("🔴 클라이언트가 보낸 상세 블록/override 를 읽는 라우트가 «없다»", () => {
    for (const [, rel] of SEAMS) {
      const src = read(rel);
      expect(src, `${rel} 가 클라이언트 블록을 읽는다`).not.toMatch(/body[?.]*\.detailBlocks/);
      expect(src, `${rel} 가 클라이언트 override 를 읽는다`).not.toMatch(/body[?.]*\.detailOverride/);
    }
  });

  it("override 내용은 서버 로더 하나에서만 온다", () => {
    const loader = codeOnly(readFileSync(join(__dirname, "../../../../lib/product-detail-override.ts"), "utf8"));
    expect(loader).toContain('.from("product_snapshots")');
    /* 🔴 workspace_id 로 좁힌다 — 가드 하나에 의존하지 않는다. */
    expect(loader).toContain("workspace_id");
    /* 🔴 새 테이블/컬럼을 만들지 않았다. */
    expect(loader).toContain("workspace->");
  });
});

describe("⑥ 🔴 식별자가 기본 9블록에서 충돌하지 않는다 — patch 가 엉뚱한 곳에 붙지 않는다", () => {
  it("기본값과 셀러 저장본 모두 식별자가 유일하다", () => {
    for (const b of [defaultDetailBlocks(), SELLER_SAVED]) {
      const ids = detailBlockIdentities(b);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
