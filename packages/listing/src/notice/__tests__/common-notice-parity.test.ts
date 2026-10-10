import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  channelNoticeCodes,
  channelNoticeMapping,
  commonNoticeModelFor,
  noticeRequiredness,
} from "../common-notice-model";
import { noticeSchemaFor } from "../../lotteon/notice-schema";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 공통 고시 모델 — 「채널의 실제 코드와 어긋나면 떨어진다」
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 공통 모델의 위험은 하나다: **조용히 낡는 것.** 채널이 항목을 하나 더
 *    요구하기 시작하면 모델은 그대로이고, 아무도 모른다. 그러면 「공통화했다」는
 *    말만 남고 실제로는 두 개의 서로 다른 진실이 생긴다.
 *
 *    그래서 이 파일은 모델을 «다른 파일의 권위 출처» 와 전수 대조한다 —
 *    모델이 스스로를 검사하는 순환 테스트가 아니다.
 *
 *      LotteON   notice-schema.ts 의 pdArtlCd 집합과 양방향 대조(누락·잉여 0)
 *      Naver     build-payload.ts 의 kids/wear 칸 이름과 대조 (🔴 주석을 벗긴다)
 *      Coupang   「고정 코드가 없다」는 모델의 주장이 실제 코드와 맞는가
 *
 * 🔴 Naver 쪽은 «소스» 대조임을 숨기지 않는다 — payload 실측이 아니다.
 *    payload 수준 대조는 builder 를 이 모델로 교체할 때(실등록 해제 후) 한다.
 */

const LISTING_SRC = join(__dirname, "..", "..");

/** 🔴 주석을 벗긴다. 여덟 번 걸린 함정이다 — 주석에 든 코드/칸 이름이
 *  「있다」로 잡히면 가드가 아무것도 지키지 않는다. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function readStripped(relative: string): string {
  return stripComments(readFileSync(join(LISTING_SRC, relative), "utf8"));
}

describe("① LotteON — 권위 스키마와 양방향 전수 대조", () => {
  it.each([
    ["APPAREL" as const, "01"],
    ["KIDS_APPAREL" as const, "23"],
  ])("🔴 %s 의 모델 코드 집합이 품목 %s 과 «정확히» 같다", (kind, itemCode) => {
    const schema = noticeSchemaFor(itemCode);
    expect(schema).not.toBeNull();
    const schemaCodes = [...(schema ?? [])].map((s) => s.code).sort();
    const modelCodes = channelNoticeCodes(kind, "LOTTEON").sort();

    /* 🔴 「모델에 없는 채널 항목」과 「채널에 없는 모델 코드」를 «갈라» 본다.
       집합 비교 하나로 뭉치면 어느 쪽이 낡았는지 알 수 없다. */
    const missingInModel = schemaCodes.filter((c) => !modelCodes.includes(c));
    const extraInModel = modelCodes.filter((c) => !schemaCodes.includes(c));
    expect({ missingInModel, extraInModel }).toEqual({ missingInModel: [], extraInModel: [] });
  });

  it("🔴 공통 항목 수와 채널 항목 수가 «다를 수 있다» — 그 차이를 숫자로 고정한다", () => {
    expect(noticeSchemaFor("01")).toHaveLength(9);
    expect(noticeSchemaFor("23")).toHaveLength(13);

    /* 의류는 1:1 이다. */
    expect(commonNoticeModelFor("APPAREL").items).toHaveLength(9);
    expect(channelNoticeCodes("APPAREL", "LOTTEON")).toHaveLength(9);

    /* 🔴 어린이제품은 «14 : 13» 이다. 롯데ON 의 `0780` 한 칸이 「크기, 중량」
       이고 네이버는 그것을 `size` 와 `weight` 두 칸으로 받기 때문이다.
       공통 모델은 두 채널의 의미를 다 담아야 하므로 항목이 하나 많다.

       🔴 이 차이를 「13으로 맞추기」로 해소하지 않는다. 억지로 13 으로 줄이면
       네이버의 두 칸 중 하나가 공통 모델에서 사라지고, 그 칸은 조용히 비어서
       나간다. 숫자를 맞추는 것보다 사실을 적는 것이 맞다. */
    expect(commonNoticeModelFor("KIDS_APPAREL").items).toHaveLength(14);
    expect(channelNoticeCodes("KIDS_APPAREL", "LOTTEON")).toHaveLength(13);
    expect(channelNoticeCodes("KIDS_APPAREL", "NAVER")).toHaveLength(13);
  });

  it("🔴 한 칸을 둘이 공유하는 사실이 모델에 적혀 있다 — 0780 = 크기 + 중량", () => {
    const size = channelNoticeMapping("KIDS_APPAREL", "size", "LOTTEON");
    const weight = channelNoticeMapping("KIDS_APPAREL", "weight", "LOTTEON");
    expect(size?.codes).toEqual(["0780"]);
    expect(weight?.codes).toEqual(["0780"]);
    expect(size?.note).toContain("같은 칸");
    expect(weight?.note).toContain("같은 칸");
  });

  it("🔴 품목 01 의 A/S 이름을 품목 23 에서 옮겨오지 않았다", () => {
    /* notice-schema.ts 가 같은 이유로 옮기지 않았다 — 항목코드는 품목마다
       이름이 갈릴 수 있고, 긴 이름을 짧은 품목에 붙이면 우리가 지어낸 것이 된다. */
    const appareL = commonNoticeModelFor("APPAREL").items.find((i) => i.semanticKey === "asContact");
    const kids = commonNoticeModelFor("KIDS_APPAREL").items.find((i) => i.semanticKey === "asContact");
    expect(appareL?.label).toBe("A/S");
    expect(kids?.label).toBe("A/S 책임자와 전화번호");
  });
});

describe("② Naver — build-payload 의 실제 칸 이름과 대조 (주석 제거 후)", () => {
  const source = readStripped(join("naver", "build-payload.ts"));

  it.each([
    ["APPAREL" as const],
    ["KIDS_APPAREL" as const],
  ])("🔴 %s 모델이 가리키는 네이버 칸이 builder 에 «실제로» 있다", (kind) => {
    const codes = channelNoticeCodes(kind, "NAVER");
    expect(codes.length).toBeGreaterThan(0);
    const absent = codes.filter((key) => !new RegExp(`\\b${key}\\s*:`).test(source));
    expect(absent).toEqual([]);
  });

  it("🔴 네이버 kids/wear 블록의 칸 수가 바뀌면 알아챈다", () => {
    /* 칸 이름을 블록에서 직접 센다 — 모델이 아니라 제품 코드를 센다. */
    const block = (name: "kids" | "wear"): string[] => {
      const start = source.indexOf(`${name}: {`);
      expect(start).toBeGreaterThan(-1);
      const slice = source.slice(start, source.indexOf("\n            }", start));
      return [...slice.matchAll(/^\s{16}([a-zA-Z]+):/gm)].map((m) => m[1]);
    };
    expect(block("wear")).toHaveLength(8);
    expect(block("kids")).toHaveLength(13);
  });

  it("🔴 네이버에 «자리가 없는» 것을 「요구하지 않는다」로 적지 않았다", () => {
    const origin = channelNoticeMapping("KIDS_APPAREL", "countryOfOrigin", "NAVER");
    expect(origin?.codes).toEqual([]);
    expect(origin?.note).toContain("확인하지 못했다");
    /* 대조군 — 자리가 «있는» 것은 비어 있지 않다. */
    expect(channelNoticeMapping("KIDS_APPAREL", "color", "NAVER")?.codes).toEqual(["color"]);
  });

  it("🔴 품명·모델명이 네이버에서 «두 칸» 으로 나뉘는 사실이 적혀 있다", () => {
    const mapping = channelNoticeMapping("KIDS_APPAREL", "itemAndModelName", "NAVER");
    expect(mapping?.codes).toEqual(["itemName", "modelName"]);
    expect(mapping?.note).toContain("두 칸");
  });
});

describe("③ Coupang — 「고정 코드가 없다」는 주장이 코드와 맞는가", () => {
  it("🔴 모델은 쿠팡 코드를 «하나도» 들고 있지 않다", () => {
    expect(channelNoticeCodes("APPAREL", "COUPANG")).toEqual([]);
    expect(channelNoticeCodes("KIDS_APPAREL", "COUPANG")).toEqual([]);
  });

  it("🔴 그 이유가 실제 builder 와 일치한다 — 카테고리 메타가 항목을 정한다", () => {
    const source = readStripped(join("coupang", "build-payload.ts"));
    /* 모델의 evidence 가 주장하는 바로 그 필드가 builder 에 있어야 한다.
       없으면 모델이 쿠팡에 대해 틀린 말을 하고 있는 것이다. */
    expect(source).toContain("noticeCategoryDetailNames");
    expect(source).toMatch(/MANDATORY|OPTIONAL/);
  });

  it("🔴 쿠팡 필수여부는 UNKNOWN 이다 — 「선택」으로 단정하지 않는다", () => {
    expect(noticeRequiredness("APPAREL", "material", "COUPANG")).toBe("UNKNOWN");
    expect(noticeRequiredness("KIDS_APPAREL", "kcCertification", "COUPANG")).toBe("UNKNOWN");
  });
});

describe("④ required 를 하나로 합치지 않는다 (B③)", () => {
  it("🔴 채널 override 가 공통값을 이기고, 없으면 공통값으로 내려간다", () => {
    /* 네이버 packDate 는 실측 근거가 있는 REQUIRED override 다. */
    expect(noticeRequiredness("APPAREL", "packDate", "NAVER")).toBe("REQUIRED");
    /* override 가 없는 항목은 공통값(REQUIRED)을 그대로 본다. */
    expect(noticeRequiredness("APPAREL", "material", "NAVER")).toBe("REQUIRED");
    expect(channelNoticeMapping("APPAREL", "material", "NAVER")?.required).toBeNull();
  });

  it("🔴 같은 의미가 채널마다 다른 답을 낼 수 있다 — 세 값이 한 칸으로 뭉개지지 않는다", () => {
    const perChannel = (["NAVER", "COUPANG", "LOTTEON"] as const).map((c) =>
      noticeRequiredness("KIDS_APPAREL", "releaseDate", c),
    );
    expect(perChannel).toEqual(["UNKNOWN", "UNKNOWN", "REQUIRED"]);
  });

  it("🔴 근거 없는 「선택」을 만들지 않았다 — releaseDate 는 OPTIONAL 이 아니다", () => {
    /* NAVER_NOTICE_REQUIRED_CONFIRMED 가 false 로 적어 두었지만 그 파일 스스로
       근거가 없다고 적고 있다. 그래서 UNKNOWN 이다. */
    const mapping = channelNoticeMapping("KIDS_APPAREL", "releaseDate", "NAVER");
    expect(mapping?.required).toBe("UNKNOWN");
    expect(mapping?.required).not.toBe("OPTIONAL");
  });

  it("모든 항목과 매핑에 근거가 붙어 있다 (빈 문자열 금지)", () => {
    for (const kind of ["APPAREL", "KIDS_APPAREL"] as const) {
      for (const item of commonNoticeModelFor(kind).items) {
        expect(item.evidence.length).toBeGreaterThan(10);
        for (const mapping of item.mappings) expect(mapping.evidence.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("⑤ UNKNOWN 은 항목을 만들지 않는다 (B④)", () => {
  it("🔴 품목을 모르면 ready=false 이고 items 가 비어 있다", () => {
    const model = commonNoticeModelFor("UNKNOWN");
    expect(model.ready).toBe(false);
    expect(model.items).toEqual([]);
    expect(model.reason).toContain("임의로 만들지 않습니다");
  });

  it("🔴 그럴듯한 기본 품목으로 떨어뜨리지 않는다 — APPAREL 이 되지 않는다", () => {
    const unknown = commonNoticeModelFor("UNKNOWN");
    const appareL = commonNoticeModelFor("APPAREL");
    expect(unknown.items).not.toEqual(appareL.items);
    expect(unknown.kind).toBe("UNKNOWN");
  });

  it("모르는 의미를 물으면 UNKNOWN 이다 — 값을 지어내지 않는다", () => {
    expect(noticeRequiredness("UNKNOWN", "material", "LOTTEON")).toBe("UNKNOWN");
    expect(channelNoticeMapping("UNKNOWN", "material", "LOTTEON")).toBeUndefined();
  });
});
