import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeLotteOnRegistrationReadiness,
  isLotteOnCategoryChosen,
  listLotteOnBlockingConditions,
  EMPTY_LOTTEON_CHANNEL_FORM,
  type LotteOnChannelForm,
  type LotteOnValidationField,
  type LotteOnValidationSnapshot,
} from "../lotteon-channel-form";

/**
 * 커머스 등록 구조 재정렬 §11(CEO 지시, 2026-09-14) — **판매 판단 ≠ 등록 가능성.**
 *
 * ── 이 파일이 고정하는 명제 ────────────────────────────────────────────────
 * 네 칸짜리 표에서 **대각선 두 칸이 실제로 가능해야 한다**:
 *
 *            롯데ON 🟢 등록가능      롯데ON 🔴 등록불가
 *   MI 🟢     (당연히 가능)          ← 이 칸이 가능해야 한다
 *   MI 🔴     ← 이 칸이 가능해야 한다  (당연히 가능)
 *
 * 두 칸 중 하나라도 구조적으로 불가능해지는 순간, 어딘가에서 MI 값이 등록
 * 가능성으로(또는 그 반대로) 흘러들어간 것이다. "잘 팔릴 것 같다"는 판단이
 * 등록을 열어주거나, "안 팔릴 것 같다"가 등록을 막는 화면은 셀러에게 거짓말을
 * 한다 — 롯데ON이 상품을 거절하는 이유는 시장이 아니라 필수 항목이다.
 *
 * ── 왜 렌더가 아니라 이 방식인가 ───────────────────────────────────────────
 * 등록 가능성의 값은 서버 검증(validateLotteOnPayload) 응답에서만 나오므로
 * 화면을 통째로 그려서는 "통과한 상태"를 만들 수 없다(fetch가 필요하다).
 * 그래서 ① 판정 함수가 validation 하나만 읽는다는 것과, ② MI 값이 이 탭까지
 * 올 **배선 자체가 없다**는 것을 각각 고정한다. 배선이 없으면 값이 샐 수 없다.
 */

/** 줄바꿈 정규화 — 이 저장소의 작업 트리는 CRLF다.
 * 경로는 __dirname으로 잡는다: import.meta.url을 쓰면 사용자 홈 경로의 한글이
 * 퍼센트 인코딩돼 파일을 못 연다(이 저장소의 실제 작업 경로가 그렇다). */
function readSource(relativePath: string): string {
  return readFileSync(join(__dirname, "..", relativePath), "utf8").replace(/\r\n/g, "\n");
}

/** 블록 주석/줄 주석을 걷어낸다 — 이 저장소의 주석은 "왜"를 길게 적어서 금지어가
 * 주석에 등장하는 것은 정상이고, 막아야 하는 것은 실제 코드다. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function snapshot(fields: LotteOnValidationField[]): LotteOnValidationSnapshot {
  const readyCount = fields.filter((f) => f.status === "READY").length;
  const missingCount = fields.filter((f) => f.status === "MISSING").length;
  const blockedCount = fields.filter((f) => f.status === "BLOCKED").length;
  return {
    ok: missingCount === 0 && blockedCount === 0,
    fields,
    readyCount,
    missingCount,
    blockedCount,
  };
}

/** 전부 통과 — 롯데ON 🟢. */
const ALL_READY = snapshot([
  { field: "spdNm", label: "상품명", status: "READY" },
  { field: "scatNo", label: "표준카테고리", status: "READY" },
  { field: "dcatLst", label: "전시카테고리", status: "READY" },
  { field: "owhpNo", label: "출고지번호", status: "READY" },
]);

/** 필수 누락 — 롯데ON 🔴. */
const NOT_READY = snapshot([
  { field: "spdNm", label: "상품명", status: "READY" },
  { field: "scatNo", label: "표준카테고리", status: "READY" },
  { field: "owhpNo", label: "출고지번호", status: "MISSING", reason: "출고지번호가 없습니다." },
  { field: "dvCstPolNo", label: "배송비정책번호", status: "BLOCKED", reason: "판매자센터에 먼저 등록해야 합니다." },
]);

/**
 * CommerceWorkspace.tsx의 `lotteOnLevel`과 **같은 식**이다. 탭 배지가 이 값으로
 * 그려지므로, 여기서 🟢/🔴을 말할 수 있으면 화면에서도 같은 색이 뜬다.
 */
function lotteOnLevel(validation: LotteOnValidationSnapshot): "GREEN" | "YELLOW" | "RED" {
  const readiness = computeLotteOnRegistrationReadiness(validation);
  if (readiness.allRequiredPassed) return "GREEN";
  return readiness.percent >= 60 ? "YELLOW" : "RED";
}

/** MI가 낼 수 있는 판정 전부. 등록 가능성은 이 중 무엇이든 **몰라야** 한다. */
const ALL_MI_VERDICTS = ["RECOMMENDED", "NOT_RECOMMENDED", "CAUTION", "UNKNOWN"] as const;

describe("§11 — 판매 판단(MI)과 롯데ON 등록 가능성은 서로를 움직이지 못한다", () => {
  it("MI 🟢 판매추천 + 롯데ON 🔴 등록불가 조합이 가능하다", () => {
    // 시장에서는 팔릴 상품이어도 출고지/배송비정책이 없으면 롯데ON은 거절한다.
    expect(lotteOnLevel(NOT_READY)).toBe("RED");
    expect(computeLotteOnRegistrationReadiness(NOT_READY).allRequiredPassed).toBe(false);
  });

  it("MI 🔴 판매비추천 + 롯데ON 🟢 등록가능 조합이 가능하다", () => {
    // 마진이 얇아 팔지 말라고 말해주는 상품이어도, 등록 자체는 막히지 않는다.
    expect(lotteOnLevel(ALL_READY)).toBe("GREEN");
    expect(computeLotteOnRegistrationReadiness(ALL_READY).allRequiredPassed).toBe(true);
  });

  it("어떤 MI 판정이 와도 등록 가능성 값은 한 글자도 바뀌지 않는다", () => {
    // 판정 함수의 인자에 MI가 들어갈 자리 자체가 없다는 것을 값으로 확인한다.
    const baseline = computeLotteOnRegistrationReadiness(NOT_READY);
    for (const _verdict of ALL_MI_VERDICTS) {
      expect(computeLotteOnRegistrationReadiness(NOT_READY)).toEqual(baseline);
    }
    expect(baseline.percent).toBe(50);
  });

  it("등록 가능성은 validation 외의 입력을 받지 않는다 (함수 인자 1개)", () => {
    expect(computeLotteOnRegistrationReadiness.length).toBe(1);
    // validation이 없으면 0% — 모르는 것을 "가능"으로 낙관하지 않는다.
    expect(computeLotteOnRegistrationReadiness(null)).toEqual({
      percent: 0,
      total: 0,
      readyCount: 0,
      allRequiredPassed: false,
    });
  });
});

describe("§11 — MI 값이 롯데ON 탭에 도달할 배선이 없다", () => {
  /** MI 쪽에서만 쓰는 이름들. 하나라도 롯데ON 코드에 나타나면 배선이 생긴 것이다. */
  const MI_IDENTIFIERS = [
    "marketSignal",
    "priceLevel",
    "sellerVerdict",
    "DomesticPriceIntelligencePanel",
    "MiRadar",
    "mi-verdict",
    "mi-headline",
    "profitability",
    "onPriceLevelChange",
    "onSellerVerdictChange",
    "onMarketSignalChange",
  ];

  it("LotteOnRegistrationPanel.tsx에 MI 식별자가 하나도 없다", () => {
    const source = stripComments(readSource("LotteOnRegistrationPanel.tsx"));
    for (const identifier of MI_IDENTIFIERS) {
      expect(source, `롯데ON 탭이 MI 값을 받기 시작했다: "${identifier}"`).not.toContain(identifier);
    }
  });

  it("lotteon-channel-form.ts / lotteon-category.ts에도 MI 식별자가 없다", () => {
    for (const file of ["lotteon-channel-form.ts", "lotteon-category.ts"]) {
      const source = stripComments(readSource(file));
      for (const identifier of MI_IDENTIFIERS) {
        expect(source, `${file}이 MI 값을 읽기 시작했다: "${identifier}"`).not.toContain(identifier);
      }
    }
  });

  it("CommerceWorkspace가 롯데ON 탭에 넘기는 prop 중 MI에서 온 것이 없다", () => {
    const source = readSource("../CommerceWorkspace.tsx").replace(/\r\n/g, "\n");
    const startAt = source.indexOf("<LotteOnRegistrationPanel");
    expect(startAt, "롯데ON 패널 마운트 지점을 찾지 못했다").toBeGreaterThan(-1);
    const endAt = source.indexOf("/>", startAt);
    const mountBlock = stripComments(source.slice(startAt, endAt));
    for (const identifier of MI_IDENTIFIERS) {
      expect(mountBlock, `롯데ON 패널에 MI 값이 prop으로 넘어간다: "${identifier}"`).not.toContain(identifier);
    }
  });

  it("탭 배지(lotteOnLevel)는 롯데ON 검증 결과 하나에서만 나온다", () => {
    const source = readSource("../CommerceWorkspace.tsx");
    const startAt = source.indexOf("const lotteOnLevel");
    expect(startAt).toBeGreaterThan(-1);
    const block = source.slice(startAt, source.indexOf(";", source.indexOf(": null", startAt)));
    expect(block).toContain("lotteOnReadiness");
    for (const identifier of MI_IDENTIFIERS) {
      expect(block, `롯데ON 탭 배지가 MI를 읽는다: "${identifier}"`).not.toContain(identifier);
    }
  });
});

describe("§17·§18 — 카테고리 전에는 등록 가능성을 숫자로 말하지 않는다", () => {
  it("빈 폼은 '카테고리 미선택'이다", () => {
    expect(isLotteOnCategoryChosen(EMPTY_LOTTEON_CHANNEL_FORM)).toBe(false);
  });

  it("표준카테고리를 고르면 판단이 열린다", () => {
    const form: LotteOnChannelForm = {
      ...EMPTY_LOTTEON_CHANNEL_FORM,
      category: { standardCategoryNo: "1234567", displayCategoryNos: ["9988"] },
    };
    expect(isLotteOnCategoryChosen(form)).toBe(true);
  });

  it("공백만 적은 것은 고른 것이 아니다", () => {
    const form: LotteOnChannelForm = {
      ...EMPTY_LOTTEON_CHANNEL_FORM,
      category: { standardCategoryNo: "   ", displayCategoryNos: [] },
    };
    expect(isLotteOnCategoryChosen(form)).toBe(false);
  });

  it("화면이 '판단 제한' 문구와 이동 버튼을 실제로 들고 있다", () => {
    const panel = readSource("LotteOnRegistrationPanel.tsx");
    expect(panel).toContain("등록 가능성 판단 제한");
    expect(panel).toContain("카테고리를 먼저 선택해주세요");
    expect(panel).toContain("lotteon-section-category");
  });

  it("막는 조건은 BLOCKED가 먼저 오고, READY는 목록에 없다", () => {
    const ordered = listLotteOnBlockingConditions(NOT_READY);
    expect(ordered.map((f) => f.field)).toEqual(["dvCstPolNo", "owhpNo"]);
    expect(ordered.every((f) => f.status !== "READY")).toBe(true);
  });

  it("막는 조건의 문장은 서버가 준 것 그대로다 — 화면이 다시 쓰지 않는다", () => {
    const ordered = listLotteOnBlockingConditions(NOT_READY);
    expect(ordered[0].reason).toBe("판매자센터에 먼저 등록해야 합니다.");
    expect(ordered[0].label).toBe("배송비정책번호");
  });

  it("전부 통과하면 막는 조건이 하나도 없다", () => {
    expect(listLotteOnBlockingConditions(ALL_READY)).toEqual([]);
  });
});
