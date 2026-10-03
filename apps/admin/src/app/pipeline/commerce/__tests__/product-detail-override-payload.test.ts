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

/* 🔴 `as never` 를 값 선언에 붙이지 않는다 — 붙이면 테스트가 자기 fixture 를
   읽을 수 없다(TEMPLATE.shippingInfo 가 타입 오류가 된다). 조립기 인자 자리에서만
   좁힌다. */
const TEMPLATE = {
  shippingInfo: "평일 14시 이전 주문은 당일 출고됩니다.",
  exchangeInfo: "교환은 수령 후 7일 이내입니다.",
  returnInfo: "반품은 수령 후 7일 이내입니다.",
};

const COMMON_IMAGES = {
  topCommonImageUrl: "https://cdn.example.com/seller/top-banner.jpg",
  topCommonImageEnabled: true,
  bottomCommonImageUrl: "https://cdn.example.com/seller/bottom-banner.jpg",
  bottomCommonImageEnabled: true,
};

const CTX = {
  aiDescription: "65% 코튼 혼방 테니스 상의입니다.",
  template: TEMPLATE as never,
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

  /* 🔴 codeOnly() 가 줄을 chr(10) 으로 다시 이어 주므로 CR 은 남지 않는다 —
     그래서 개행 하나로 가른다. */
  const SPLIT_NEWLINE = String.fromCharCode(10);

  const SEAMS = [
    ["쿠팡 등록", "coupang/register/route.ts"],
    ["쿠팡 미리보기", "coupang/payload-preview/route.ts"],
    ["롯데ON 상세조립", "lotteon/_lib/build-context.ts"],
    ["네이버 공통 resolver", "naver/_lib/resolve-context.ts"],
  ] as const;

  it.each(SEAMS)("%s 가 resolveProductDetailBlocks 를 부른다", (_label, rel) => {
    expect(read(rel)).toContain("resolveProductDetailBlocks(");
  });

  /**
   * 🔴 처음에 「옛 resolveDetailBlocks 호출이 한 건도 없다」로 박았더니 실패했다 —
   * 그리고 그 실패가 «맞았다». naver/resolve-context.ts 는 호출이 «둘» 이다:
   *
   *     detailBlocks:              resolveProductDetailBlocks(...)   ← payload 가 쓴다
   *     sellerDefaultDetailBlocks: resolveDetailBlocks(...)          ← 화면 기준선
   *
   * 후자는 상품별 편집기가 「무엇이 공통이고 무엇을 내가 바꿨나」를 가르기 위해
   * override 를 «적용하지 않은» 구성을 받아야 해서 있는 것이고, payload 에는
   * 쓰이지 않는다. 그래서 계약을 「호출이 없다」가 아니라 **「payload 로 가는
   * 칸은 반드시 resolveProductDetailBlocks 가 채운다」** 로 고친다.
   */
  it.each(SEAMS)("🔴 %s 의 payload 칸은 resolveProductDetailBlocks 가 «만» 채운다", (_label, rel) => {
    const src = read(rel);
    for (const line of src.split(SPLIT_NEWLINE)) {
      if (!/resolveDetailBlocks\(/.test(line)) continue;
      /* 옛 함수가 남아 있다면 그 줄은 «화면 기준선» 한 칸뿐이어야 한다. */
      expect(line, `${rel}: payload 경로에 옛 통로가 남아 있다 — ${line.trim()}`).toContain(
        "sellerDefaultDetailBlocks:",
      );
    }
  });

  /**
   * 🔴 네 seam 의 «모양이 서로 다르다». 하나의 규칙으로 재려다 두 번 틀렸다:
   *
   *   ① 쿠팡 등록       변수를 거친다        const resolvedDetailBlocks = 새통로(...)
   *   ② 쿠팡 미리보기   속성에 직접          detailBlocks: 새통로(...)
   *   ③ 롯데ON 상세조립 **위치 인자**        assembleNaverDetailContent(새통로(...), {
   *   ④ 네이버 resolver 속성에 직접          detailBlocks: 새통로(...)
   *
   * ③ 은 `detailBlocks:` 라는 글자가 «아예 없다» — 속성으로 찾는 규칙은 거기서
   * 공허하게 통과하거나(0건) 거짓 실패한다. 그래서 각 seam 이 블록을 «어떻게»
   * 먹이는지 표로 적고 그 모양을 그대로 확인한다. 통로를 바꾸면 깨진다.
   */
  const FEEDS = [
    ["쿠팡 등록", "coupang/register/route.ts", "const resolvedDetailBlocks = resolveProductDetailBlocks("],
    ["쿠팡 미리보기", "coupang/payload-preview/route.ts", "detailBlocks: resolveProductDetailBlocks("],
    ["롯데ON 상세조립", "lotteon/_lib/build-context.ts", "assembleNaverDetailContent(resolveProductDetailBlocks("],
    ["네이버 공통 resolver", "naver/_lib/resolve-context.ts", "detailBlocks: resolveProductDetailBlocks("],
  ] as const;

  it.each(FEEDS)("🔴 %s 가 블록을 새 통로에서 «그대로» 먹인다", (_label, rel, feed) => {
    expect(read(rel), `${rel}: 통로가 바뀌었다`).toContain(feed);
  });

  it("🔴 쿠팡 등록의 payload 칸이 그 변수를 쓴다 — 중간에 다른 값으로 갈리지 않는다", () => {
    const src = read("coupang/register/route.ts");
    expect(src).toContain("detailBlocks: resolvedDetailBlocks");
    /* 그 변수에 다시 대입하는 곳이 없다(한 번만 정해진다). */
    expect((src.match(/resolvedDetailBlocks\s*=/g) ?? []).length).toBe(1);
  });

  it("🔴 화면 기준선은 payload 에 «쓰이지 않는다» — 등록 라우트가 그 칸을 읽지 않는다", () => {
    for (const rel of ["coupang/register/route.ts", "smartstore/register/route.ts", "lotteon/register/route.ts"]) {
      expect(read(rel), `${rel} 가 화면 전용 기준선을 읽는다`).not.toContain("sellerDefaultDetailBlocks");
    }
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

/* ══════════════════════════════════════════════════════════════════════════
   ⑦ SELLER-UX-FINAL — 상품별 이미지가 «세 채널 모두» 에 같은 자리로 들어간다
   ══════════════════════════════════════════════════════════════════════════

   🔴 조립기는 «하나» 다: assembleNaverDetailContent 가 내부에서
   assembleContentsFromBlocks 를 부른다(naver/build-payload.ts:269). 그래서
   롯데ON=스마트스토어 계약이 이미지에서도 구조적으로 유지된다. */
describe("⑦ 상품별 이미지 — 3채널", () => {
  const OWN = "https://cdn.example.com/own/worn.jpg";
  const CAPTION = "실제 착용 사진입니다 — 모델 신장 180cm, M 착용";

  const imageOnly: ProductDetailOverride = {
    added: [{ id: "p0", kind: "CUSTOM_IMAGE", url: OWN, enabled: true, customImageId: "ci-0" }],
  };
  const imageWithText: ProductDetailOverride = {
    added: [{ id: "p0", kind: "CUSTOM_IMAGE", url: OWN, caption: CAPTION, enabled: true, customImageId: "ci-0" }],
  };

  it.each(CHANNELS)("%s — 이미지 URL 이 payload 에 들어간다", (channel) => {
    expect(payloads(SELLER_SAVED, imageOnly)[channel]).toContain(OWN);
  });

  it.each(CHANNELS)("%s — 문구를 적으면 이미지와 «둘 다» 들어간다", (channel) => {
    const out = payloads(SELLER_SAVED, imageWithText)[channel];
    expect(out).toContain(OWN);
    expect(out).toContain(CAPTION);
  });

  it("🔴 문구가 이미지 «아래» 에 온다 — 위에 두려면 텍스트 블록을 앞 순서에 놓는다", () => {
    const out = payloads(SELLER_SAVED, imageWithText).smartstore;
    expect(out.indexOf(OWN)).toBeLessThan(out.indexOf(CAPTION));
  });

  it("🔴 롯데ON === 스마트스토어 (문자 단위) — 이미지가 있어도 유지된다", () => {
    for (const ov of [imageOnly, imageWithText]) {
      const p = payloads(SELLER_SAVED, ov);
      expect(p.lotteon).toBe(p.smartstore);
    }
  });

  it("🔴 이미지를 빼면 payload 가 기존과 «문자 단위로» 같다 — 초기화 복귀", () => {
    const legacy = legacyPayloads(SELLER_SAVED);
    for (const channel of CHANNELS) {
      expect(payloads(SELLER_SAVED, imageWithText)[channel]).not.toBe(legacy[channel]);
      expect(payloads(SELLER_SAVED, undefined)[channel]).toBe(legacy[channel]);
    }
  });

  it("🔴 순서 변경이 이미지에도 걸린다", () => {
    const out = payloads(SELLER_SAVED, {
      ...imageWithText,
      order: ["CUSTOM_IMAGE:ci-0", "AI_DESCRIPTION"],
    }).smartstore;
    expect(out.indexOf(OWN)).toBeLessThan(out.indexOf(CTX.aiDescription));
  });

  it("🔴 꺼진 이미지 블록은 payload 에 «안» 들어간다", () => {
    const out = payloads(SELLER_SAVED, {
      ...imageWithText,
      patches: { "CUSTOM_IMAGE:ci-0": { enabled: false } },
    }).smartstore;
    expect(out).not.toContain(OWN);
    expect(out).not.toContain(CAPTION);
  });

  /* ── 🔴 안전하지 않은 URL — 등록 payload 에 «닿지 않아야» 한다 ──────────
     data: URI 가 채널 payload 에 닿은 전례가 있다(유입은 `?? 폴백` 한 줄이었다).
     그래서 조립 직전에 `isRegistrationSafeImageUrl`(http(s) allowlist)로 막는다. */
  for (const [label, url] of [
    ["data: URI", "data:image/jpeg;base64,/9j/4AAQSkZJRg=="],
    ["blob:", "blob:http://localhost/abcd"],
    ["file:", "file:///C:/secret.jpg"],
    ["스킴 없음", "cdn.example.com/x.jpg"],
    ["빈 문자열", ""],
    ["공백만", "   "],
    ["javascript:", "javascript:alert(1)"],
  ] as [string, string][]) {
    it.each(CHANNELS)(`🔴 ${label} 은 %s payload 에 들어가지 않는다`, (channel) => {
      const unsafe: ProductDetailOverride = {
        added: [{ id: "p0", kind: "CUSTOM_IMAGE", url, caption: "불안전", enabled: true, customImageId: "ci-0" }],
      };
      const out = payloads(SELLER_SAVED, unsafe)[channel];
      if (url.trim()) expect(out).not.toContain(url.trim());
      /* 🔴 그리고 문구도 함께 빠진다 — 이미지 없는 캡션만 남으면
         구매자가 「무엇에 대한 설명인지」 알 수 없는 문장을 보게 된다. */
      expect(out).not.toContain("불안전");
    });
  }

  it("🔴 안전하지 않은 이미지 하나 때문에 «나머지가 멈추지 않는다»", () => {
    const mixed: ProductDetailOverride = {
      added: [
        { id: "bad", kind: "CUSTOM_IMAGE", url: "data:image/png;base64,AAA", enabled: true, customImageId: "ci-0" },
        { id: "good", kind: "CUSTOM_IMAGE", url: OWN, caption: CAPTION, enabled: true, customImageId: "ci-1" },
      ],
    };
    const out = payloads(SELLER_SAVED, mixed).smartstore;
    expect(out).not.toContain("data:image");
    expect(out).toContain(OWN);
    expect(out).toContain(CAPTION);
  });

  it("🔴 가드가 기존 공용 함수다 — 새 판정을 만들지 않았다", () => {
    const src = readFileSync(
      join(__dirname, "../../../../../../../packages/listing/src/coupang/build-payload.ts"),
      "utf8",
    );
    expect(src).toContain("if (!isRegistrationSafeImageUrl(block.url)) continue;");
    /* 자체 정규식으로 다시 판정하지 않는다. */
    const seg = src.slice(src.indexOf('block.kind === "CUSTOM_IMAGE"'), src.indexOf("TEMPLATE_SECTION\")"));
    expect(seg).not.toMatch(/https\?:/);
  });
});
