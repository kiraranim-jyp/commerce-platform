import { describe, expect, it } from "vitest";
import { noticeSchemaFor, knownNoticeItemCodes, LOTTEON_NOTICE_SCHEMA_SOURCE } from "../notice-schema";
import { resolveLotteOnNotice, type LotteOnNoticeFacts } from "../notice-resolve";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 고시 항목 resolver — **채우는 것보다 «안 채우는 것»을 고정한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 스프린트에서 세 번 금지된 것이 있다. 말로만 두면 다음 사람이 「편의상」
 * 넣는다. 그래서 금지 자체를 검사한다 —
 *
 *   SKU  → 모델명        ❌
 *   SS26 → 출시년월       ❌
 *   6-7 Years(사이즈) → 사용연령 ❌
 *   1830 해당없음 임의 표기 ❌
 *   A/S 업체명을 판매자명·제조사로 대체 ❌
 */

/** 실제로 등록하려는 상품(아동 반바지)에서 확인된 값들. */
const REAL: LotteOnNoticeFacts = {
  color: "Lavender",
  material: "17% Recycled Cotton",
  countryOfOrigin: "Spain",
  sizeValues: ["2-3 Years", "4-5 Years", "6-7 Years"],
  careInstructions: "30도 손세탁",
  manufacturer: "Bobo Choses S.L.",
  sellerQualityGuarantee: "소비자분쟁해결기준에 따름",
  sellerAsContactNumber: "+821046458306",
};

describe("① 품목 표를 «모를» 때 — 빈 배열로 통과시키지 않는다", () => {
  it("모르는 품목은 schemaKnown=false 이고 항목을 만들지 않는다", () => {
    const result = resolveLotteOnNotice("01", REAL);
    expect(result.schemaKnown).toBe(false);
    expect(result.fills).toHaveLength(0);
    expect(result.articles).toHaveLength(0);
  });

  it("빈 품목코드도 마찬가지다", () => {
    expect(resolveLotteOnNotice("", REAL).schemaKnown).toBe(false);
    expect(resolveLotteOnNotice(null, REAL).schemaKnown).toBe(false);
  });

  it("우리가 들여온 품목은 23 하나다 — 「40품목을 안다」고 말하지 않는다", () => {
    expect(knownNoticeItemCodes()).toEqual(["23"]);
    expect(noticeSchemaFor("23")).toHaveLength(13);
    expect(noticeSchemaFor("01")).toBeNull();
  });
});

describe("② 품목 23 — 13항목 전부가 필수다", () => {
  it("13개가 나오고 모두 required 다", () => {
    const { fills } = resolveLotteOnNotice("23", REAL);
    expect(fills).toHaveLength(13);
    expect(fills.every((fill) => fill.required)).toBe(true);
  });

  it("항목코드는 공식 표 그대로다", () => {
    const codes = resolveLotteOnNotice("23", REAL).fills.map((fill) => fill.code);
    expect(codes).toEqual(["0210", "0200", "0780", "0020", "0410", "0790", "1830", "0220", "0070", "0060", "0800", "0080", "0090"]);
  });
});

describe("③ 이미 가진 값은 채운다", () => {
  const byCode = (code: string) => resolveLotteOnNotice("23", REAL).fills.find((fill) => fill.code === code)!;

  it.each([
    ["0020", "Lavender", "상품정보 · 색상"],
    ["0410", "17% Recycled Cotton", "상품정보 · 소재"],
    ["0060", "Spain", "상품정보 · 원산지"],
    ["0800", "30도 손세탁", "상품정보 · 취급 시 주의사항"],
    ["0080", "소비자분쟁해결기준에 따름", "판매자 설정 · 품질보증기준"],
  ])("%s 가 채워지고 «어디서 왔는지» 를 남긴다", (code, value, from) => {
    const fill = byCode(code);
    expect(fill.status).toBe("FILLED");
    if (fill.status === "FILLED") {
      expect(fill.value).toBe(value);
      expect(fill.from).toBe(from);
    }
  });

  it("🔴 0780 크기·중량은 «치수로 대체» 한다 — 공식 가이드라인 근거다", () => {
    const fill = byCode("0780");
    expect(fill.status).toBe("FILLED");
    if (fill.status === "FILLED") expect(fill.value).toBe("2-3 Years, 4-5 Years, 6-7 Years");
  });

  it("articles 에는 FILLED 만 들어간다", () => {
    const { fills, articles } = resolveLotteOnNotice("23", REAL);
    expect(articles).toHaveLength(fills.filter((fill) => fill.status === "FILLED").length);
    expect(articles.every((article) => article.pdArtlCd && article.pdArtlCnts)).toBe(true);
  });
});

describe("🔴 ④ 금지된 추정을 «하지 않는다»", () => {
  it("사이즈 옵션이 있어도 0790 사용연령을 채우지 않는다", () => {
    /* REAL 에는 `6-7 Years` 가 있지만 recommendedAge 는 없다. */
    const fill = resolveLotteOnNotice("23", REAL).fills.find((f) => f.code === "0790")!;
    expect(fill.status).toBe("NEEDS_INPUT");
    if (fill.status === "NEEDS_INPUT") expect(fill.reason).toContain("사용연령으로 바꾸지 않습니다");
  });

  it("상품정보에 사용연령이 «있으면» 그때는 채운다", () => {
    const fill = resolveLotteOnNotice("23", { ...REAL, recommendedAge: "4-5세" }).fills.find((f) => f.code === "0790")!;
    expect(fill.status).toBe("FILLED");
    if (fill.status === "FILLED") expect(fill.value).toBe("4-5세");
  });

  it("SKU 가 있어도 0210 모델명을 만들지 않는다", () => {
    const fill = resolveLotteOnNotice("23", { ...REAL, itemName: "아동용 반바지" }).fills.find((f) => f.code === "0210")!;
    /* 품명만 있고 모델명이 없다 — 「모두 입력」이 아니므로 채우지 않는다. */
    expect(fill.status).toBe("NEEDS_INPUT");
    if (fill.status === "NEEDS_INPUT") expect(fill.reason).toContain("상품코드(SKU)를 모델명으로 대신 쓰지 않습니다");
  });

  it("품명과 모델명이 «둘 다» 있으면 채운다", () => {
    const fill = resolveLotteOnNotice("23", { ...REAL, itemName: "아동용 반바지", modelName: "B226AC043" }).fills.find(
      (f) => f.code === "0210",
    )!;
    expect(fill.status).toBe("FILLED");
  });

  it("0220 출시년월은 «자리가 없어서» BLOCKED 다 — 시즌 코드로 대신하지 않는다", () => {
    const fill = resolveLotteOnNotice("23", REAL).fills.find((f) => f.code === "0220")!;
    expect(fill.status).toBe("BLOCKED");
    if (fill.status === "BLOCKED") expect(fill.reason).toContain("시즌 코드를 출시년월로 바꾸지 않습니다");
  });

  it("1830 크기·체중 한계는 «규칙을 몰라서» BLOCKED 다 — 「해당없음」을 넣지 않는다", () => {
    const fill = resolveLotteOnNotice("23", REAL).fills.find((f) => f.code === "1830")!;
    expect(fill.status).toBe("BLOCKED");
    const body = JSON.stringify(resolveLotteOnNotice("23", REAL).articles);
    expect(body).not.toContain("해당없음");
  });

  it("🔴 0090 은 업체명이 없으면 BLOCKED — 판매자명·제조사로 대신하지 않는다", () => {
    const fill = resolveLotteOnNotice("23", REAL).fills.find((f) => f.code === "0090")!;
    expect(fill.status).toBe("BLOCKED");
    /* 제조사가 있어도 A/S 업체명으로 새어 나가지 않는다. */
    const articles = resolveLotteOnNotice("23", REAL).articles;
    expect(articles.find((a) => a.pdArtlCd === "0090")).toBeUndefined();
  });

  /* ══════════════════════════════════════════════════════════════════════════
     🔴 COMMON-AS-PHONE-SEPARATION-01 — 번호는 «번호 칸» 에서만 온다.

     `sellerAsContactNumber` 는 A/S «안내 문구» 다(네이버 고시에서 자유 텍스트로
     실측 통과한 값). 그것을 전화번호 자리에 쓰면 고시가 거짓이 된다.
     Production 에서 실제로 「규하맘샵AS / 해외 구매대행으로 A/S 불가」가 🟢 로
     보인 적이 있고, 그것이 이 블록이 생긴 이유다.
  ══════════════════════════════════════════════════════════════════════════ */
  it("🔴 안내 문구는 0090 으로 «새지 않는다» — 번호 칸이 비면 BLOCKED 다", () => {
    /* REAL.sellerAsContactNumber 에는 번호처럼 «생긴» 값이 들어 있다. 그래도
       0090 은 그것을 쓰지 않는다 — 출처가 다르기 때문이다. */
    const fill = resolveLotteOnNotice("23", { ...REAL, sellerAsCompanyName: "따조 고객센터" }).fills.find(
      (f) => f.code === "0090",
    )!;
    expect(fill.status).toBe("BLOCKED");
    expect(JSON.stringify(resolveLotteOnNotice("23", REAL).articles)).not.toContain("+821046458306");
  });

  it("업체명 «과» 전화번호가 둘 다 있어야 채워진다", () => {
    const fill = resolveLotteOnNotice("23", {
      ...REAL,
      sellerAsCompanyName: "따조 고객센터",
      sellerAsPhoneNumber: "02-1234-5678",
    }).fills.find((f) => f.code === "0090")!;
    expect(fill.status).toBe("FILLED");
    if (fill.status === "FILLED") expect(fill.value).toBe("따조 고객센터 / 02-1234-5678");
  });

  it("🔴 번호 자리에 «문장» 이 오면 INVALID — 「값이 있다」가 「충족했다」가 아니다", () => {
    const fill = resolveLotteOnNotice("23", {
      ...REAL,
      sellerAsCompanyName: "따조 고객센터",
      sellerAsPhoneNumber: "해외 구매대행으로 A/S 불가",
    }).fills.find((f) => f.code === "0090")!;
    expect(fill.status).toBe("INVALID");
    /* 🔴 그리고 payload 에 실리지 않는다 — 거짓 고시가 나가지 않는다. */
    const articles = resolveLotteOnNotice("23", {
      ...REAL,
      sellerAsCompanyName: "따조 고객센터",
      sellerAsPhoneNumber: "해외 구매대행으로 A/S 불가",
    }).articles;
    expect(articles.find((a) => a.pdArtlCd === "0090")).toBeUndefined();
  });

  it("🔴 문장에서 숫자를 «뽑아내지» 않는다", () => {
    const fill = resolveLotteOnNotice("23", {
      ...REAL,
      sellerAsCompanyName: "따조 고객센터",
      sellerAsPhoneNumber: "문의는 02-1234-5678 로 주세요",
    }).fills.find((f) => f.code === "0090")!;
    expect(fill.status).toBe("INVALID");
  });
});

describe("⑤ 아무 값도 없으면 아무것도 만들지 않는다", () => {
  it("빈 facts → 13항목 모두 미완이고 articles 는 0건이다", () => {
    const { fills, articles } = resolveLotteOnNotice("23", {});
    expect(fills).toHaveLength(13);
    expect(fills.some((fill) => fill.status === "FILLED")).toBe(false);
    expect(articles).toHaveLength(0);
  });
});

describe("⑥ 출처를 코드가 «직접» 말한다", () => {
  it("판본과 URL 이 남아 있고, 현행성은 «확인되지 않음» 으로 표시된다", () => {
    expect(LOTTEON_NOTICE_SCHEMA_SOURCE.url).toContain("doc-pub.lotteon.com");
    expect(LOTTEON_NOTICE_SCHEMA_SOURCE.documentCreatedAt).toBe("2022-11-16");
    /* 🔴 「현행 법령」이라고 말하지 않는다 — 우리가 확인하지 못한 것이다. */
    expect(LOTTEON_NOTICE_SCHEMA_SOURCE.currencyVerified).toBe(false);
  });

  it("🔴 0200 가이드라인에 구매대행 제한 문장이 «그대로» 남아 있다", () => {
    const kc = noticeSchemaFor("23")!.find((spec) => spec.code === "0200")!;
    expect(kc.guideline).toContain("구매대행/병행수입을 선택할 수 없습니다");
  });
});
