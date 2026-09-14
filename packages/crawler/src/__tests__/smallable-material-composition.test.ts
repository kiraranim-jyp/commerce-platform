import { describe, expect, it } from "vitest";
import { extractCountryOfOrigin, extractMaterial } from "../description-facts";

/**
 * REWORK-5 ①(CEO 지시, 2026-09-14) — **소재 자동입력이 왜 비었나**를 가르는
 * 파일. 지시는 둘 중 하나를 증거로 고르라고 했다:
 *
 *   A  원문에 소재가 있는데 추출 실패  → 버그. 추출 경로를 고친다
 *   B  원문에도 소재가 없음            → 자동입력 불가
 *
 * ── 답은 A다. 추측이 아니라 라이브 원문으로 확인했다 ──────────────────────
 * Ground Truth로 지정된 상품(smallable.com/.../bobo-choses-organic-cotton-
 * t-shirt-ecru-bobo-choses-430700)을 실제로 받아서(HTTP 200, 728KB) 본 결과,
 * 소재는 **원문에 분명히 있었다** — 두 군데에 각각 있다:
 *
 *   1) schema.org JSON-LD `description`
 *      "  COMPOSITION    100% Organic Cotton    Find out more  …"
 *   2) Next.js 페이로드의 `longDescription` HTML
 *      "<div class=\"title\"><strong>COMPOSITION</strong></div>
 *       <ul><li>100% Organic Cotton</li></ul>…"
 *
 * 그런데 extractMaterial()은 둘 다에서 undefined를 돌려주고 있었다. 원인은
 * 구성비 정규식이 `숫자% + 원단이름`만 허용해서 **퍼센트와 원단 사이에
 * "Organic" 한 단어가 끼면 그대로 실패**하는 것이었다. 아래 첫 두 테스트가
 * 그 경계를 그대로 고정한다 — "100% Cotton"은 원래도 잡혔고
 * "100% Organic Cotton"만 빠지고 있었다는 사실까지 같이 남긴다.
 *
 * 🔴 이 파일은 값을 지어내지 않는다는 description-facts.ts의 불변식을 함께
 * 지킨다 — 마지막 describe가 "원문에 없으면 여전히 undefined"와 할인 문구
 * 오탐이 돌아오지 않았음을 고정한다.
 */

/** 라이브로 받은 원문에서 그대로 옮긴 문자열. 손으로 지어낸 문장이 아니다. */
const LIVE_JSON_LD_DESCRIPTION =
  "  COMPOSITION    100% Organic Cotton    Find out more    Wash Cold-30°  Made in Portugal  ";

/** 같은 페이지의 longDescription 원문(HTML). 크롤러가 태그를 벗겨 넘긴다. */
const LIVE_LONG_DESCRIPTION_HTML =
  '<div class="title"><strong>COMPOSITION</strong></div><ul><li>100% Organic Cotton</li></ul>' +
  '<div class="title"><strong>Find out more</strong></div><ul><li>Wash Cold-30°</li><li>Made in Portugal</li></ul>';

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("REWORK-5 ① — smallable 430700 실제 원문에서 소재를 뽑는다(A: 추출 버그였다)", () => {
  it("JSON-LD description에서 '100% Organic Cotton'을 뽑는다", () => {
    expect(extractMaterial(LIVE_JSON_LD_DESCRIPTION)).toBe("100% Organic Cotton");
  });

  it("longDescription(태그 제거)에서도 같은 값을 뽑는다", () => {
    expect(extractMaterial(stripTags(LIVE_LONG_DESCRIPTION_HTML))).toBe("100% Organic Cotton");
  });

  /**
   * 같은 원문에서 제조국은 **원래도 잘 뽑히고 있었다**("Made in Portugal").
   * 즉 "이 페이지는 파싱이 안 되는 페이지"가 아니라 소재 정규식 하나만
   * 빠져 있었다는 것 — A(버그)라는 판정의 근거를 한 줄 더 남긴다.
   */
  it("같은 원문의 제조국은 전부터 정상이었다 — 페이지 문제가 아니라 소재 규칙 문제였다", () => {
    expect(extractCountryOfOrigin(LIVE_JSON_LD_DESCRIPTION)).toBe("Portugal");
  });

  it("수식어가 없는 '100% Cotton'은 전부터 잡히고 있었다(회귀 기준선)", () => {
    expect(extractMaterial("100% Cotton")).toBe("100% Cotton");
  });
});

describe("REWORK-5 ① — 수식어 허용이 오탐을 불러오지 않는다", () => {
  it("여러 성분 목록을 그대로 잡는다", () => {
    expect(extractMaterial("88% Recycled Polyester, 12% Elastane")).toBe(
      "88% Recycled Polyester, 12% Elastane",
    );
  });

  it("수식어 2개까지 허용한다", () => {
    expect(extractMaterial("100% Recycled Organic Cotton")).toBe("100% Recycled Organic Cotton");
  });

  it("'50% Off Sale' 같은 할인 문구는 여전히 소재가 아니다", () => {
    expect(extractMaterial("50% Off Sale — ends today")).toBeUndefined();
    expect(extractMaterial("30% discount on all items")).toBeUndefined();
  });

  /**
   * 화이트리스트 밖의 단어가 퍼센트와 원단 사이에 오면 잡지 않는다 — 이것이
   * `[a-z]+` 무제한 허용과 이 구현이 갈리는 지점이다("30% discount on cotton
   * items"를 소재로 읽지 않는다).
   */
  it("화이트리스트에 없는 수식어는 잡지 않는다 — 지어내는 것보다 비워 두는 쪽이다", () => {
    expect(extractMaterial("30% discount cotton")).toBeUndefined();
  });

  it("'Composition:' 라벨도 material/fabric과 같은 라벨로 읽는다", () => {
    expect(extractMaterial("Composition: Organic Cotton")).toBe("Organic Cotton");
  });

  it("원문에 소재가 없으면 여전히 undefined다(B였다면 이 상태가 정답이었다)", () => {
    expect(extractMaterial("A soft t-shirt for everyday wear.")).toBeUndefined();
    expect(extractMaterial(undefined)).toBeUndefined();
  });
});
