import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  isSuccessfulHttpStatus,
  offerRowsToOptions,
  type OptionExtractionFailure,
} from "../product-data-extractor";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.5-B ㉠(CPO 승인, 2026-10-08) — **PROVENANCE INFRA.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 성공 기준은 「테니스 옵션 문제가 해결됐다」가 «아니다». 다음 수집부터
 *    축 0 이 생겼을 때 ①②③ 중 무엇 때문인지 **증명할 수 있다** — 거기까지다.
 *
 * 실측 배경: tennis-warehouse 18 snapshot 중 6건이 축 0 이고, 같은 상품
 * (STMMLS)이 축 있는 건과 없는 건을 둘 다 가진다. SKU·가격·재고는 살아 있었다
 * → `offerRowsToOptions` 가 null 을 냈고, 어느 조건인지 남는 곳이 없었다.
 */

/** 🔴 실측 그 모양 — Tennis Magro 의 사이즈 5행(SKU·재고 포함). 더미로 바꾸지 않는다. */
const MEASURED_OK = [
  { name: "Magro Long Sleeve S", sku: "STMMLSWH1", stock: 1 },
  { name: "Magro Long Sleeve M", sku: "STMMLSWH2", stock: 4 },
  { name: "Magro Long Sleeve L", sku: "STMMLSWH3", stock: 2 },
  { name: "Magro Long Sleeve XL", sku: "STMMLSWH4", stock: 3 },
  { name: "Magro Long Sleeve XXL", sku: "STMMLSWH5", stock: 1 },
];

/** 🔴 실측 — JOB-261006-002 의 색+사이즈 합성 모양. 「옵션」 축으로 남아야 한다. */
const MEASURED_COMBINED = [
  { name: "Fico Jacket Bl/White S", sku: "A1" },
  { name: "Fico Jacket Bl/White M", sku: "A2" },
  { name: "Fico Jacket Humus L", sku: "A3" },
];

function capture(rows: Parameters<typeof offerRowsToOptions>[0]) {
  const seen: OptionExtractionFailure[] = [];
  const got = offerRowsToOptions(rows, (reason) => seen.push(reason));
  return { got, seen };
}

describe("🔴 ① 실패 사유가 조건과 1:1 로 기록된다", () => {
  it("INSUFFICIENT_NAMED_OFFERS — 이름 있는 offer 가 2개 미만", () => {
    const { got, seen } = capture([{ name: "Magro Long Sleeve S", sku: "A1" }]);
    expect(got).toBeNull();
    expect(seen).toEqual(["INSUFFICIENT_NAMED_OFFERS"]);
  });

  it("이름이 전부 비어 있어도 같은 사유다 — 「offer 가 없다」와 구분되지 않는다", () => {
    const { got, seen } = capture([{ name: "  " }, { name: "" }]);
    expect(got).toBeNull();
    expect(seen).toEqual(["INSUFFICIENT_NAMED_OFFERS"]);
  });

  it("EMPTY_OPTION_VALUE — 공통 접두사가 이름 전체를 먹었다", () => {
    /* 두 이름이 «완전히 같으면» 접두사가 전체가 되고 값이 빈다. */
    const { got, seen } = capture([{ name: "Magro", sku: "A1" }, { name: "Magro", sku: "A2" }]);
    expect(got).toBeNull();
    expect(seen).toEqual(["EMPTY_OPTION_VALUE"]);
  });

  it("DUPLICATE_OPTION_VALUE — 옵션값이 중복이다", () => {
    const { got, seen } = capture([
      { name: "Magro S", sku: "A1" },
      { name: "Magro S ", sku: "A2" },
      { name: "Magro M", sku: "A3" },
    ]);
    expect(got).toBeNull();
    expect(seen).toEqual(["DUPLICATE_OPTION_VALUE"]);
  });

  it("🔴 성공할 때는 «아무 사유도» 기록되지 않는다", () => {
    const { got, seen } = capture(MEASURED_OK);
    expect(got).not.toBeNull();
    expect(seen).toEqual([]);
  });
});

describe("🔴🔴 ② 기존 결과가 한 글자도 달라지지 않는다", () => {
  it("실측 S/M/L/XL/XXL 이 그대로 나온다", () => {
    const got = offerRowsToOptions(MEASURED_OK);
    expect(got).not.toBeNull();
    expect(got!.optionGroups).toEqual([{ name: "사이즈", values: ["S", "M", "L", "XL", "XXL"] }]);
    expect(got!.variants.map((v) => v.id)).toEqual([
      "STMMLSWH1",
      "STMMLSWH2",
      "STMMLSWH3",
      "STMMLSWH4",
      "STMMLSWH5",
    ]);
    expect(got!.variants.map((v) => v.stockQuantity)).toEqual([1, 4, 2, 3, 1]);
  });

  it("🔴 「Bl/White S」 합성 모양도 기존 그대로 — 「옵션」 축이고 억지 분해하지 않는다", () => {
    const got = offerRowsToOptions(MEASURED_COMBINED);
    expect(got).not.toBeNull();
    expect(got!.optionGroups[0].name).toBe("옵션");
    expect(got!.optionGroups[0].values).toEqual(["Bl/White S", "Bl/White M", "Humus L"]);
  });

  it("🔴 콜백을 주든 안 주든 반환값이 «완전히 동일» 하다", () => {
    const withCb = offerRowsToOptions(MEASURED_OK, () => {});
    const without = offerRowsToOptions(MEASURED_OK);
    expect(JSON.stringify(withCb)).toBe(JSON.stringify(without));
  });

  it("🔴 null 을 임의 옵션으로 바꾸지 않는다", () => {
    expect(offerRowsToOptions([{ name: "only one", sku: "A1" }])).toBeNull();
  });
});

describe("🔴 ③ 콜백이 없으면 로그로 남는다 — 관찰 자체가 사라지지 않는다", () => {
  it("고정 접두사로 사유를 적는다 (런타임 로그에서 grep 가능)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(offerRowsToOptions([{ name: "one", sku: "A1" }])).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      const line = String(warn.mock.calls[0]?.[0] ?? "");
      expect(line).toContain("[option-extraction]");
      expect(line).toContain("INSUFFICIENT_NAMED_OFFERS");
    } finally {
      warn.mockRestore();
    }
  });

  it("🔴 성공 경로는 로그를 만들지 않는다 — 정상 수집이 로그를 오염시키지 않는다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      offerRowsToOptions(MEASURED_OK);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   🔴🔴 ㉠ 보강 — 접근 거부를 「옵션 없음」으로 적지 않는다.

   실측: tennis-warehouse 를 Playwright 로 열었더니 **406 · 본문 171B** 였고
   microdata offer 0 이라 INSUFFICIENT_NAMED_OFFERS 가 떴다. 그 값은 「이 상품에
   offer 가 2개 미만」과 완전히 같아서 다음 실패도 오진하게 된다.
   ───────────────────────────────────────────────────────────────────────── */
describe("🔴🔴 ④ SOURCE_ACCESS_BLOCKED — 접근 실패와 데이터 부재를 가른다", () => {
  it("2xx 만 성공이다", () => {
    expect(isSuccessfulHttpStatus(200)).toBe(true);
    expect(isSuccessfulHttpStatus(204)).toBe(true);
    /* 🔴 실측 두 건 — Smallable 403 · tennis-warehouse 406 */
    expect(isSuccessfulHttpStatus(403)).toBe(false);
    expect(isSuccessfulHttpStatus(406)).toBe(false);
    expect(isSuccessfulHttpStatus(500)).toBe(false);
    /* 3xx 는 추적이 끝난 뒤의 최종 상태여야 하므로 성공이 아니다. */
    expect(isSuccessfulHttpStatus(302)).toBe(false);
  });

  it("🔴 사유 어휘에 SOURCE_ACCESS_BLOCKED 가 «있다» — 기존 3개도 그대로다", () => {
    const all: OptionExtractionFailure[] = [
      "SOURCE_ACCESS_BLOCKED",
      "INSUFFICIENT_NAMED_OFFERS",
      "EMPTY_OPTION_VALUE",
      "DUPLICATE_OPTION_VALUE",
    ];
    expect(new Set(all).size).toBe(4);
  });

  it("🔴 호출부가 상태를 보고 사유를 «바꿔 적는다» — 결과는 바뀌지 않는다", () => {
    /* extractProductData 는 Playwright page 를 요구해 여기서 마운트할 수 없다.
       🔴 그래서 「무엇을 보고 바꾸는가」를 소스로 확인한다 — 이 파일이 보장하는
          것과 못 하는 것을 숨기지 않는다(실제 406 재현은 ㉡ 실측 몫이다). */
    const src = readFileSync(
      new URL("../product-data-extractor.ts", import.meta.url),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const block = src.slice(src.indexOf("const offerOptions ="), src.indexOf("const textOptionGroups"));
    expect(block).toContain("isSuccessfulHttpStatus(options.httpStatus)");
    expect(block).toContain('"SOURCE_ACCESS_BLOCKED"');
    /* 🔴 상태를 모르면 기존 사유를 그대로 쓴다 — 지어내지 않는다. */
    expect(block).toContain("blocked ? \"SOURCE_ACCESS_BLOCKED\" : reason");
    /* 🟡 offerRowsToOptions 를 «여전히 부른다» — 분기를 건너뛰지 않았다.
       🔴 다만 이 단언은 «하중을 받지 않는다»: mutation Y4(단축회로를 끼워
          넣어도 문자열이 남는다)가 통과했다. 동작으로 잠그려면 Playwright
          page 를 마운트해야 하고 그건 새 harness 다(CPO 금지).
          🔴 그래서 「결과 불변」의 실제 근거는 위 ②의 반환값 비교이고,
             이 줄은 «읽는 사람을 위한 표시» 로만 남긴다. */
    expect(block).toContain("offerRowsToOptions(");
  });
});
