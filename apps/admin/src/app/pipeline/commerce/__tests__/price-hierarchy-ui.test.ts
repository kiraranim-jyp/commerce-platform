import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRICE_LINE_LABEL } from "../price-hierarchy";

/**
 * P2 UX POLISH(CEO 지시, 2026-09-12) — "더 예쁘게"가 아니라, 지금의 가격 계산
 * UX를 그대로 두고 화면을 덜 길고 더 빨리 읽히게 만든다.
 *
 * ── 이 테스트가 지키는 것 ────────────────────────────────────────────────
 * ① 짧아진 이유가 "줄을 지워서"가 아니라는 것. 계산 사슬 열 줄은 그대로 있고,
 *    줄어든 것은 여백·중복 문구·입력칸 높이뿐이다(P2-1).
 * ② 권장 판매가격과 최종 판매가격이 **다른 층위**로 보인다는 것. 둘이 같은
 *    ₩143,500을 가리켜도 하나는 계산 결과이고 하나는 실제 등록가다(P2-2).
 * ③ 권장가가 최종가로 조용히 넘어가지 않는다는 것 — 자동 적용 금지는
 *    N-3.9부터 이어진 계약이고, 층위를 만든다고 거기 손대지 않았다(P2-2).
 * ④ 오른쪽 기둥에서 채널이 반복되지 않지만 채널이 사라지지도 않는다는 것(P2-3).
 * ⑤ 설명 문구가 읽히는 크기라는 것 — 정보를 숨기려고 글씨를 줄이지 않는다(P2-4).
 *
 * ── 왜 소스 텍스트를 검사하는가 ──────────────────────────────────────────
 * price-single-surface.test.ts / price-display-layout.test.ts와 같은 이유다.
 * 밀도와 층위는 계산 규칙이 아니라 **배치 규칙**이라 순수 함수로 표현할 수
 * 없는데, 깨지는 방식은 늘 똑같다: 누군가 "여기 설명을 한 줄 더 넣자",
 * "추천가도 크게 보여주자"며 예전 모양으로 되돌린다.
 *
 * 이 테스트가 실패하면 고쳐야 할 것은 테스트가 아니라 배치다.
 */
/** 작업 트리가 CRLF라 여러 줄 검사는 정규화하고 본다(이 폴더의 다른 배치 테스트와 동일). */
function read(relativeToThisFile: string): string {
  return readFileSync(fileURLToPath(new URL(relativeToThisFile, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
}

const editor = read("../PriceEditor.tsx");
const actionCenter = read("../ActionCenter.tsx");

describe("P2-1: 카드가 짧아진 이유는 밀도지 삭제가 아니다", () => {
  it("계산 사슬의 열 줄이 하나도 빠지지 않았다", () => {
    // 순서는 price-single-surface.test.ts가 고정한다. 여기서 고정하는 것은
    // "존재"다 — 카드를 줄이라는 지시를 줄을 지워서 만족시키지 않는다.
    for (const label of [
      "원본 가격",
      "환율",
      PRICE_LINE_LABEL.SOURCE_PRICE_KRW,
      PRICE_LINE_LABEL.INTERNATIONAL_SHIPPING,
      PRICE_LINE_LABEL.LANDED_COST,
      "예상 수수료",
      "목표 마진",
      "권장 판매가격",
      "예상 수수료 금액",
      "예상 이익(최종 판매가격 기준)",
    ]) {
      expect(editor, `${label} 줄이 사라졌다`).toContain(label);
    }
    // 관세/부가세·국내 배송원가(MI 판단용 입력)도 그대로다.
    for (const label of ["국내 배송원가", "관세", "부가세"]) {
      expect(editor).toContain(`<Row label="${label}">`);
    }
  });

  it("줄 높이는 한 곳에서만 정한다 — 입력칸 모양이 화면 안에서 두 가지가 되지 않는다", () => {
    expect(editor).toContain("const FIELD_CLASS =");
    expect(editor).toContain("px-2 py-0.5 text-sm");
    // 예전처럼 같은 문자열을 행마다 복사해두면 다음에 높이를 고치는 사람이
    // 그중 몇 개를 빠뜨린다.
    expect(editor).not.toContain("rounded border border-border px-2 py-1 text-sm");
  });

  it("사슬의 줄 간격과 행 정렬이 조밀한 값으로 고정돼 있다", () => {
    expect(editor).toContain('<div className="mt-2 space-y-1.5 text-xs">');
    // Row는 더 이상 라벨을 입력칸 첫 줄에 맞추려고 위쪽 여백을 넣지 않는다.
    expect(editor).toContain('<div className="flex items-center justify-between gap-3">');
    expect(editor).not.toContain('<span className="w-24 shrink-0 pt-1.5 text-text-secondary">');
  });

  it("제목 아래 안내문이 아래 문구와 같은 말을 세 번 하지 않는다", () => {
    // 이 문장이 말하던 두 사실은 각각 최종 판매가격 칸의 안내와 상세 맨 아래
    // 추정치 문단에 그대로 살아 있다 — 줄인 것은 사본이지 사실이 아니다.
    expect(editor).not.toContain("배송비/수수료/마진/원본가격을 고치면 아래 값이 즉시 다시 계산됩니다");
    expect(editor).toContain("아는 값으로 고치면 즉시 다시 계산됩니다");
    expect(editor).toContain("아직 저장된 값이 없어 권장 판매가격을 보여주고 있습니다");
  });
});

describe("P2-2: 권장 판매가격과 최종 판매가격은 다른 층위로 보인다", () => {
  it("결론(최종 판매가격)이 계산 결과(권장 판매가격)보다 크다", () => {
    // 최종 판매가격 입력칸은 text-base, 권장 판매가격 값은 그 아래 단계다.
    expect(editor).toContain("w-32 rounded border border-border px-2 py-1 text-base font-semibold");
    expect(editor).toContain(
      '<span className="text-sm font-semibold text-text-secondary">{formatKrw(recommendedPriceKrw)}</span>',
    );
    // 둘이 같은 크기/같은 색으로 돌아가면 화면은 다시 "무엇이 실제 판매가인지"를
    // 말하지 못한다.
    expect(editor).not.toContain(
      '<span className="text-base font-semibold text-text-primary">{formatKrw(breakdown.suggestedPriceKrw)}</span>',
    );
  });

  it("둘의 관계를 화면이 직접 말한다 — 세 경우가 전부 다른 문장이다", () => {
    expect(editor).toContain("const recommendationRelation =");
    // ① 아직 저장 전(위 칸이 권장가를 비추고 있을 뿐이다)
    expect(editor).toContain("위 칸이 이 값을 그대로 비추고 있습니다");
    // ② 저장했고 마침 같은 금액
    expect(editor).toContain("저장된 최종 판매가격과 같은 금액입니다.");
    // ③ 저장한 값이 권장가와 다르다 — 차액을 숨기지 않는다
    expect(editor).toContain("const finalMinusRecommendedKrw = finalPriceKrw - recommendedPriceKrw;");
    expect(editor).toContain("높습니다");
    expect(editor).toContain("낮습니다");
  });

  it("추천은 여전히 자동으로 최종 판매가격이 되지 않는다", () => {
    // 실제 등록가(priceOverrideKrw)를 바꾸는 통로는 둘뿐이다:
    // 최종 판매가격 입력칸의 커밋과 [최종 판매가격에 적용] 버튼.
    expect(editor.match(/onUpdateSalePriceKrw\(/g) ?? []).toHaveLength(2);
    expect(editor).toContain("최종 판매가격에 적용");
    // 권장가가 바뀔 때 최종가를 따라 쓰는 effect가 없다(자동 적용 금지).
    expect(editor).not.toContain("useEffect(() => {\n    onUpdateSalePriceKrw");
    expect(editor).toContain("const finalPriceKrw = product.priceOverrideKrw?.value ?? breakdown.suggestedPriceKrw;");
  });
});

describe("P2-3: 오른쪽 기둥은 채널을 반복하지 않지만 채널을 숨기지도 않는다", () => {
  it("행동이 없는 채널은 버튼 모양을 갖지 않는다", () => {
    expect(actionCenter).toContain(
      'const actionableChannels = channels.filter((channel) => channel.availability !== "COMING_SOON");',
    );
    expect(actionCenter).toContain(
      'const soonChannels = channels.filter((channel) => channel.availability === "COMING_SOON");',
    );
    // 버튼은 이제 누를 수 있는 것만 그린다 — disabled 버튼 자리가 사라졌다.
    expect(actionCenter).not.toContain("disabled={soon}");
  });

  it("준비중 채널은 목록에서 사라지지 않고 한 줄로 남는다", () => {
    // "없는 것"과 "아직인 것"은 다른 사실이다(registration-channels.ts의 판단).
    expect(actionCenter).toContain("function SoonChannelNote(");
    expect(actionCenter).toContain('{channels.map((channel) => channel.label).join(" · ")} 준비중');
    // 목록 모드와 요약 모드 양쪽에서 한 번씩 — 상태를 보여주는 자리는 그대로다.
    expect(actionCenter.match(/<SoonChannelNote /g) ?? []).toHaveLength(2);
  });

  it("등록 흐름은 그대로다 — 채널을 하나의 버튼으로 합치지 않았다", () => {
    // 채널마다 자기 버튼이 있고, 그 버튼은 여전히 채널 화면으로 데려갈 뿐이다.
    expect(actionCenter).toContain("<ChannelButton key={channel.id}");
    expect(actionCenter).toContain("onClick={() => onGoToChannel(channel.id)}");
    expect(actionCenter).toContain("채널 화면으로 이동합니다 — 최종 확인 후 등록됩니다.");
  });
});

describe("P2-4: 설명 문구는 읽히는 크기다", () => {
  it("두 화면에서 10px 글씨가 사라졌다", () => {
    // 필요한 문장이면 읽히게 두고, 읽을 필요가 없으면 지운다 — 글씨를 줄여
    // 정보를 숨기는 중간 상태를 만들지 않는다.
    expect(editor).not.toContain("text-[10px]");
    expect(actionCenter).not.toContain("text-[10px]");
  });

  it("계산을 설명하는 문장은 tertiary가 아니라 secondary다", () => {
    for (const snippet of [
      '<p className="mt-1 text-xs text-text-secondary">',
      '<p className="pt-0.5 text-xs text-text-secondary">',
    ]) {
      expect(editor).toContain(snippet);
    }
    // 판단 기준을 말하는 오른쪽 기둥의 한 줄도 같은 단계로 올라왔다.
    expect(actionCenter).toContain('<p className="mt-0.5 text-xs text-text-secondary">');
  });

  it("머리말(Label)은 globals.css 규약을 그대로 쓴다 — 새 체계를 만들지 않았다", () => {
    expect(actionCenter.match(/text-\[11px\] font-medium leading-4 text-text-tertiary/g) ?? []).toHaveLength(3);
  });
});
